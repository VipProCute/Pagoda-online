'use strict';
/*
 * Kho dữ liệu: toàn bộ trạng thái nằm trong RAM (một object db), ghi nền ra nơi lưu.
 *  - Có DATABASE_URL: PostgreSQL (Neon), ghi phần chênh theo từng khóa (lib/store-pg.js).
 *  - Không có: một file JSON như trước (ghi file tạm rồi đổi tên).
 * Logic của server chỉ cần đổi db rồi gọi store.save().
 */
const fs = require('fs');
const path = require('path');
const S = require('./store-sections');

const COUNTERS = S.COUNTERS;
const RETRY_MS = 5000;

const envMs = (name, def) => {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n >= 200 ? n : def;
};

function createStore(options = {}) {
  const env = process.env;
  const url = options.databaseUrl !== undefined ? options.databaseUrl : (env.DATABASE_URL || '').trim();
  const backend = options.backend || (url ? 'pg' : 'json');
  const FILE = options.file || env.DATA_FILE || path.join(__dirname, '..', 'data', 'db.json');
  const flushMs = options.flushMs || (backend === 'pg' ? envMs('PG_FLUSH_MS', 10000) : 4000);
  const retryMs = options.retryMs || RETRY_MS;
  const sink = options.log || console;
  const out = lvl => (...a) => (sink[lvl] || sink.log || (() => {})).apply(sink, a);
  const log = { log: out('log'), warn: out('warn'), error: out('error') };
  const readOnly = !!options.readOnly;

  const db = S.fresh();   // định danh không đổi suốt vòng đời: init/load điền vào đúng object này
  const st = { ready: false, dirty: false, lastFlushAt: null, lastError: null, lastErrorAt: null, flushes: 0 };
  let timer = null, closed = false;
  const lastWarn = { text: '', at: 0 };

  // cùng một lỗi lặp lại thì chỉ in mỗi phút một lần
  function warn(text) {
    const t = Date.now();
    if (text === lastWarn.text && t - lastWarn.at < 60000) return;
    lastWarn.text = text; lastWarn.at = t;
    log.warn(text);
  }

  const impl = backend === 'pg' ? require('./store-pg').createPgBackend({
    db, st, log, warn, url, file: FILE, readOnly,
    ssl: options.ssl !== undefined ? options.ssl : env.PG_SSL,
    importJson: options.importJson !== undefined ? options.importJson : env.PG_IMPORT_JSON !== '0',
    retryDelays: options.retryDelays || [1500, 3000],
    pgOptions: options.pgOptions
  }) : jsonBackend();

  function jsonBackend() {
    function load() {
      let raw = null;
      try {
        raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
      } catch (e) {
        if (e.code !== 'ENOENT') {
          log.error('[store] Không đọc được dữ liệu, bắt đầu mới:', e.message);
          // giữ lại bản hỏng, kẻo lần ghi tới đè mất
          try { fs.copyFileSync(FILE, FILE + '.hong-' + Date.now()); } catch {}
        }
      }
      S.adopt(db, raw);
      S.repairSeq(db);
      st.ready = true;
      return db;
    }
    async function flush() {
      if (readOnly) return true;
      st.dirty = false;
      try {
        fs.mkdirSync(path.dirname(FILE), { recursive: true });
        const tmp = FILE + '.tmp';
        fs.writeFileSync(tmp, JSON.stringify(db));
        fs.renameSync(tmp, FILE);
        st.flushes++; st.lastFlushAt = Date.now(); st.lastError = null;
        return true;
      } catch (e) {
        st.dirty = true;
        st.lastError = e.message; st.lastErrorAt = Date.now();
        warn('[store] Lỗi ghi dữ liệu: ' + e.message);
        return false;
      }
    }
    return { load, init: async () => (st.ready ? db : load()), flush, close: async () => {}, docCount: () => 0 };
  }

  function arm(ms) {
    if (closed || timer) return;
    timer = setTimeout(() => { timer = null; flush(); }, ms);
    if (backend === 'pg') timer.unref();
  }

  function save() {
    if (closed || readOnly) return;
    st.dirty = true;
    arm(flushMs);
  }

  /** Luôn trả Promise<boolean>. Ở chế độ JSON phần việc chạy đồng bộ ngay trong lời gọi. */
  function flush() {
    clearTimeout(timer); timer = null;
    const p = impl.flush().catch(e => { warn('[store] Lỗi ghi dữ liệu: ' + e.message); return false; });
    p.then(ok => { if (!ok && st.ready) arm(retryMs); });
    return p;
  }

  function load() {
    if (backend !== 'json') throw new Error('store.load() chỉ dùng được ở chế độ JSON; chế độ PostgreSQL phải gọi await store.init().');
    return impl.load();
  }

  async function close({ timeoutMs = 10000, discard = false } = {}) {
    closed = true;
    clearTimeout(timer); timer = null;
    let ok = true;
    if (!discard) {
      let t;
      ok = await Promise.race([flush(), new Promise(r => { t = setTimeout(() => r(false), timeoutMs); t.unref(); })]);
      clearTimeout(t);
    }
    await impl.close();
    return ok;
  }

  function importData(raw, meta) {
    if (backend !== 'pg') throw new Error('importData chỉ dùng ở chế độ PostgreSQL.');
    return impl.importData(raw, meta);
  }

  return {
    backend, FILE, COUNTERS,
    init: () => impl.init(),
    load, save, flush, close, importData,
    get: () => db,
    nextId: () => db.seq++,
    status: () => ({
      backend, ready: st.ready, dirty: st.dirty, lastFlushAt: st.lastFlushAt, lastError: st.lastError,
      lastErrorAt: st.lastErrorAt, flushes: st.flushes
    }),
    docCount: () => impl.docCount(),
    get pool() { return impl.pool || null; }
  };
}

module.exports = createStore();
module.exports.createStore = createStore;
