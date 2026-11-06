'use strict';
/*
 * Kho PostgreSQL (Neon): dữ liệu vẫn nằm trong RAM, chỉ ghi nền phần chênh xuống bảng docs.
 * Mỗi tài liệu là một dòng (phần, khóa) -> jsonb; "shadow" nhớ chuỗi JSON đã ghi để biết khóa nào đổi.
 */
const fs = require('fs');
const S = require('./store-sections');

const BATCH_ROWS = 1000;
const BATCH_BYTES = 4 * 1024 * 1024;
const LOCK_KEY = 727203;

const DDL = [
  `CREATE TABLE IF NOT EXISTS docs (
     section text NOT NULL,
     k text NOT NULL,
     v jsonb NOT NULL,
     updated_at timestamptz NOT NULL DEFAULT now(),
     PRIMARY KEY (section, k)
   )`,
  'CREATE TABLE IF NOT EXISTS schema_info (key text PRIMARY KEY, value jsonb NOT NULL)'
];
const UPSERT = `INSERT INTO docs (section, k, v)
  SELECT * FROM unnest($1::text[], $2::text[], $3::jsonb[])
  ON CONFLICT (section, k) DO UPDATE SET v = EXCLUDED.v, updated_at = now()`;
const DELETE = `DELETE FROM docs d USING unnest($1::text[], $2::text[]) AS t(s, k)
  WHERE d.section = t.s AND d.k = t.k`;
const SET_INFO = `INSERT INTO schema_info (key, value) VALUES ($1, $2)
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;

const sleep = (ms, unref) => new Promise(r => { const t = setTimeout(r, ms); if (unref) t.unref(); });
const errText = e => (e && (e.message || (e.errors && e.errors.map(x => x.message).join('; ')) || e.code)) || String(e);

/** Che mật khẩu trong chuỗi kết nối để in log. */
function maskUrl(url) {
  return String(url || '').replace(/(:\/\/[^:/?#]*:)[^/?#]*@/, '$1***@');
}
function hostOf(url) {
  try { return new URL(String(url).trim()).host || '?'; } catch { return '?'; }
}
function secretsOf(url) {
  try {
    const pw = new URL(String(url).trim()).password;
    return [pw, decodeURIComponent(pw)].filter(x => x && x.length >= 4);
  } catch { return []; }
}

/**
 * Cấu hình pool pg. Chuỗi kết nối giữ nguyên, trừ sslmode=require/prefer/verify-ca được đổi sang verify-full
 * (pg 8.x vốn hiểu chúng như verify-full nhưng in cảnh báo bảo mật). Neon dùng chứng chỉ công khai nên verify-full chạy tốt.
 * ssl (PG_SSL): '0' tắt SSL (chạy cục bộ); 'no-verify' vẫn mã hóa nhưng không kiểm chứng chứng chỉ.
 */
function poolConfig(url, { ssl, extra } = {}) {
  let cs = String(url).trim();
  const mode = ssl == null ? '' : String(ssl).trim().toLowerCase();
  const off = ['0', 'false', 'off', 'no', 'disable'].includes(mode);
  const cfg = {
    max: 3, idleTimeoutMillis: 30000, connectionTimeoutMillis: 15000,
    query_timeout: 60000, keepAlive: true, application_name: 'chua-tam-an'
  };
  if (off || mode === 'no-verify') {
    cs = cs.replace(/([?&])sslmode=[^&]*&?/i, '$1').replace(/[?&]$/, '');
    cfg.ssl = off ? false : { rejectUnauthorized: false };
  } else {
    cs = cs.replace(/([?&]sslmode=)(require|prefer|verify-ca)(?=&|$)/i, '$1verify-full');
  }
  return { ...cfg, connectionString: cs, ...extra };
}

function createPool(url, opts, onError) {
  const { Pool } = require('pg');
  const pool = new Pool(poolConfig(url, opts));
  pool.on('error', onError || (() => {}));
  return pool;
}

function* batches(rows, bytesOf) {
  let cur = [], bytes = 0;
  for (const r of rows) {
    const b = bytesOf(r);
    if (cur.length && (cur.length >= BATCH_ROWS || bytes + b > BATCH_BYTES)) { yield cur; cur = []; bytes = 0; }
    cur.push(r); bytes += b;
  }
  if (cur.length) yield cur;
}

/**
 * Mượn một kết nối, chạy fn(c) trong giao dịch. Lỗi: ROLLBACK rồi hủy kết nối.
 * Kết nối đang mượn mà bị ngắt (Neon cắt) sẽ phát 'error'; không có người nghe thì sập tiến trình nên luôn gắn một người nghe.
 */
async function inTx(pool, begin, fn) {
  const c = await pool.connect();
  const onErr = () => {};
  c.on('error', onErr);
  try {
    await c.query(begin);
    const r = await fn(c);
    await c.query('COMMIT');
    c.removeListener('error', onErr);
    c.release();
    return r;
  } catch (e) {
    try { await c.query('ROLLBACK'); } catch {}
    c.release(true);
    throw e;
  }
}

function ensureSchema(pool) {
  return inTx(pool, 'BEGIN', async c => {
    await c.query('SELECT pg_advisory_xact_lock($1)', [LOCK_KEY]);
    for (const sql of DDL) await c.query(sql);
    await c.query(`INSERT INTO schema_info (key, value) VALUES ('schema', $1) ON CONFLICT (key) DO NOTHING`,
      [JSON.stringify({ version: 1, createdAt: new Date().toISOString() })]);
  });
}

/** Đọc mọi tài liệu trong một giao dịch chỉ đọc để các phần cùng một thời điểm. */
function loadRows(pool) {
  return inTx(pool, 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY', async c => {
    const rows = new Map();
    let n = 0;
    for (const s of S.SECTIONS) {
      const r = await c.query('SELECT k, v FROM docs WHERE section = $1', [s.name]);
      rows.set(s.name, r.rows);
      n += r.rows.length;
    }
    return { rows, n };
  });
}

function readJsonFile(file) {
  let text;
  try { text = fs.readFileSync(file, 'utf8'); }
  catch (e) {
    if (e.code === 'ENOENT') return null;
    throw Object.assign(new Error(`Không đọc được ${file}: ${e.message}. Đặt PG_IMPORT_JSON=0 để bỏ qua bước nhập.`), { fatal: true });
  }
  let raw;
  try { raw = JSON.parse(text); }
  catch (e) { raw = null; }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw Object.assign(new Error(`File dữ liệu ${file} bị hỏng nên không nhập được. Sửa hoặc xóa file, hoặc đặt PG_IMPORT_JSON=0 để bỏ qua bước nhập.`), { fatal: true });
  }
  return raw;
}

/**
 * ctx = { db, st, log, warn, url, ssl, file, importJson, retryDelays, pgOptions, readOnly }
 * st là trạng thái dùng chung với store.js (ready, dirty, lastFlushAt, lastError, flushes).
 */
function createPgBackend(ctx) {
  const { db, st, log } = ctx;
  const safe = text => secretsOf(ctx.url).reduce((t, p) => t.split(p).join('***'), String(text));
  let pool = null;
  let shadow = new Map();   // phần -> Map(khóa -> chuỗi JSON đã ghi)
  let initing = null;
  let running = null, again = false;
  let extras = [];          // việc phụ làm trong cùng giao dịch ở lượt ghi kế tiếp
  let warnedKeys = '';

  function checkKeys() {
    const k = S.unknownKeys(db).join(', ');
    if (k && k !== warnedKeys) ctx.warn(`[store] db có khóa chưa có phần lưu nên PostgreSQL sẽ KHÔNG lưu: ${k}. Thêm phần mới vào lib/store-sections.js.`);
    warnedKeys = k;
  }

  const newPool = () => createPool(ctx.url, { ssl: ctx.ssl, extra: ctx.pgOptions },
    e => ctx.warn('[store] Một kết nối CSDL rảnh bị ngắt, sẽ tự nối lại: ' + safe(errText(e))));

  async function dropPool() {
    if (!pool) return;
    const p = pool; pool = null;
    await Promise.race([p.end().catch(() => {}), sleep(3000, true)]);
  }

  function setShadow(rows) {
    shadow = new Map();
    for (const s of S.SECTIONS) {
      const m = new Map();
      for (const { k, v } of rows.get(s.name) || []) {
        const str = S.ser(s.kind === 'meta' ? S.sortKeys(v) : v);
        if (str !== undefined) m.set(k, str);
      }
      shadow.set(s.name, m);
    }
  }

  async function attempt() {
    if (!pool) pool = newPool();
    extras = [];
    await ensureSchema(pool);
    const { rows, n } = await loadRows(pool);
    const hasMeta = (rows.get('meta') || []).length > 0;
    shadow = new Map();
    if (!hasMeta && n === 0 && ctx.importJson) {
      const raw = readJsonFile(ctx.file);
      if (raw) { await importData(raw, { file: ctx.file }, true); return; }
    }
    S.adopt(db, S.rowsToRaw(rows));
    S.repairSeq(db);
    setShadow(rows);
  }

  async function doInit() {
    if (!ctx.url) throw new Error('Thiếu DATABASE_URL: chưa biết nối tới CSDL PostgreSQL nào.');
    const delays = ctx.retryDelays;
    for (let i = 0; ; i++) {
      const t0 = Date.now();
      try {
        await attempt();
        st.ready = true;
        st.lastError = null;
        log.log(`[store] Đã nạp ${docCount()} tài liệu từ PostgreSQL (${hostOf(ctx.url)}) trong ${Date.now() - t0} ms.`);
        return db;
      } catch (e) {
        const msg = safe(errText(e));
        if (e.fatal || i >= delays.length) {
          await dropPool();
          if (e.fatal) throw e;
          throw Object.assign(new Error(`Không kết nối được CSDL PostgreSQL (${maskUrl(ctx.url)}): ${msg}`), { code: e.code });
        }
        log.warn(`[store] Chưa nối được CSDL (${msg}), thử lại sau ${delays[i] / 1000}s (lần ${i + 2}/${delays.length + 1}).`);
        await sleep(delays[i]);
      }
    }
  }

  function init() {
    if (st.ready) return Promise.resolve(db);
    if (!initing) initing = doInit().finally(() => { initing = null; });
    return initing;
  }

  function docCount() {
    let n = 0;
    for (const m of shadow.values()) n += m.size;
    return n;
  }

  function commit(d, extra) {
    return inTx(pool, 'BEGIN', async c => {
      for (const b of batches(d.upserts, r => r[1].length + r[2].length)) {
        await c.query(UPSERT, [b.map(r => r[0]), b.map(r => r[1]), b.map(r => r[2])]);
      }
      for (const b of batches(d.deletes, r => r[1].length)) {
        await c.query(DELETE, [b.map(r => r[0]), b.map(r => r[1])]);
      }
      for (const fn of extra) await fn(c);
    });
  }

  function fail(e) {
    st.dirty = true;
    st.lastError = safe(errText(e));
    st.lastErrorAt = Date.now();
    ctx.warn('[store] Lỗi ghi PostgreSQL, sẽ thử lại: ' + st.lastError);
    return false;
  }

  async function round() {
    st.dirty = false;
    const extra = extras;
    extras = [];
    let cur, d;
    try {
      checkKeys();
      cur = S.snapshot(db);
      d = S.diff(shadow, cur);
    } catch (e) { extras = extra.concat(extras); return fail(e); }
    if (!d.upserts.length && !d.deletes.length && !extra.length) {
      st.lastFlushAt = Date.now(); st.lastError = null;
      return true;
    }
    try { await commit(d, extra); }
    catch (e) { extras = extra.concat(extras); return fail(e); }
    shadow = cur;
    st.flushes++; st.lastFlushAt = Date.now(); st.lastError = null;
    return true;
  }

  /** Xếp hàng: không chạy chồng; có yêu cầu mới trong lúc đang ghi thì chạy thêm một vòng. */
  function flush(opts = {}) {
    if (ctx.readOnly) return Promise.resolve(true);
    if (!st.ready && !opts.booting) return Promise.resolve(false);
    if (running) { again = true; return running; }
    running = (async () => {
      try {
        let ok;
        do { again = false; ok = await round(); } while (again && ok);
        return ok;
      } catch (e) { return fail(e); }
      finally { running = null; }
    })();
    return running;
  }

  /** Thay toàn bộ db bằng raw rồi ghi hết trong một giao dịch, kèm dấu vết nhập trong schema_info. */
  async function importData(raw, meta = {}, booting) {
    S.adopt(db, raw);
    S.repairSeq(db);
    const info = { at: new Date().toISOString(), file: meta.file || null, counts: S.counts(db), totals: S.totals(db) };
    extras.push(c => c.query(SET_INFO, ['imported_from_json', JSON.stringify(info)]));
    st.dirty = true;
    if (!await flush({ booting })) throw Object.assign(new Error('Không nhập được dữ liệu vào PostgreSQL: ' + (st.lastError || 'không rõ lỗi')), { fatal: false });
    const c = info.counts;
    log.log(`[store] Đã nhập dữ liệu từ ${meta.file || 'JSON'} vào PostgreSQL: ${c.merit} người có công đức, ${c.donations} lượt cúng dường, ${c.authSessions} phiên đăng nhập, ${c.prayers} lời nguyện, ${c.chat} tin nhắn, ${c['martial.profiles']} hồ sơ võ học.`);
    return info;
  }

  async function close() { await dropPool(); }

  return {
    init, flush, close, importData, docCount,
    get pool() { return pool; }
  };
}

module.exports = { createPgBackend, createPool, poolConfig, maskUrl };
