'use strict';
/*
 * Kho PostgreSQL. Đọc TEST_DATABASE_URL (mặc định postgres://pagoda:pagoda@127.0.0.1:5432/pagoda_test, SSL tắt cục bộ).
 * Không nối được thì bỏ qua có thông báo. Mỗi lần chạy dùng một schema riêng rồi xóa (TEST_PG_ISOLATE=0 để dùng schema mặc định).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const sameDb = (x, y) => { assert.ok(x.seq >= y.seq, 'seq không lùi'); assert.deepEqual({ ...x, seq: 0 }, { ...y, seq: 0 }); };
const fs = require('fs');
const os = require('os');
const net = require('net');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const { Client } = require('pg');
const { createStore } = require('../lib/store');
const S = require('../lib/store-sections');
const { poolConfig, maskUrl } = require('../lib/store-pg');

const ROOT = path.join(__dirname, '..');
const CLI = path.join(ROOT, 'tools', 'db-migrate.js');
const BASE = process.env.TEST_DATABASE_URL || 'postgres://pagoda:pagoda@127.0.0.1:5432/pagoda_test';
const ISOLATE = process.env.TEST_PG_ISOLATE !== '0';
const SCHEMA = 'st_' + process.pid + '_' + crypto.randomBytes(3).toString('hex');

function withParams(url, set) {
  const u = new URL(url);
  if (!u.searchParams.has('sslmode') && !u.searchParams.has('ssl')) u.searchParams.set('sslmode', 'disable');
  for (const [k, v] of Object.entries(set)) u.searchParams.set(k, v);
  return u.toString();
}
const URL_ISO = withParams(BASE, ISOLATE ? { options: '-c search_path=' + SCHEMA } : {});

const quiet = () => {
  const lines = [];
  const push = lvl => (...a) => lines.push(lvl + ' ' + a.join(' '));
  return { lines, log: { log: push('log'), warn: push('warn'), error: push('error') } };
};
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function waitFor(fn, ms = 4000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { if (await fn()) return true; await sleep(15); }
  return false;
}

/** Dữ liệu mẫu đủ mọi phần, có chữ đặc biệt và id không theo thứ tự chữ (9 < 10 < 100). */
function fill(db) {
  db.day = '2026-11-06';
  db.today.incense = 3; db.total.incense = 10; db.total.visits = 99;
  db.merit.u_a = { name: 'Ánh "Nguyệt" \\ \' 🙏 NULL {}[],', total: 120, today: 20, day: db.day };
  db.merit.g_b = { name: 'Khách\nxuống dòng\ttab', total: 5, today: 5, day: db.day };
  db.linkedGuests.g_b = 'u_a';
  db.authSessions.hash1 = { uid: 'u_a', until: 1.8e12 };
  db.auras.u_a = { amount: 500000, tier: 3, until: 1.8e12, name: 'Ánh' };
  for (const id of [9, 10, 100]) db.prayers.push({ id, kind: 'cau-an', text: 'Nguyện ' + id, name: 'A', t: id, n: 0, by: [] });
  for (const id of [11, 12]) db.chat.push({ id, pid: 1, name: 'A', c: 1, text: 'xin chào {"x":1} \\u0000', t: id });
  db.incense.push({ id: 13, pid: 1, x: 0.1, tilt: -0.02, litAt: 1, until: 2 });
  db.donations.push({ code: 'CD100002', status: 'confirmed', amount: 50000, createdAt: 10 }, { code: 'CD100001', status: 'pending', amount: 20000, createdAt: 20 });
  db.martial.profiles.u_a = { uid: 'u_a', congLuc: 7, tam: { cuong: 1, toc: 2, nhu: 3 }, learned: ['a'], loadout: [], blocked: [] };
  db.martial.sessions[5] = { id: 5, uid: 'u_a', status: 'active' };
  db.martial.ledger['session:5'] = { uid: 'u_a', at: 1, congLuc: 2, tam: {} };
  db.martial.matches.push({ id: 14, at: 1, a: { uid: 'u_a' }, b: { uid: 'u_b' }, result: 'a' });
  db.martial.audit.push({ id: 15, at: 1, actor: 'admin', action: 'x', target: '', detail: null });
  db.kydao.ratings.u_a = { name: 'Ánh', chess: { r: 1230, peak: 1250, peakAt: 5, n: 22, w: 12, l: 8, d: 2, last: 6 } };
  db.kydao.games.push({ id: 16, at: 1, game: 'chess', a: { uid: 'u_a' }, b: { uid: 'u_b' }, result: 'a' });
  db.kydao.active.u_a = 16;
  db.kydao.pairs['2026-11-11|u_a|u_b|chess'] = 3;
  db.records.log.push({ id: 17, at: 1, cat: 'xiangqi.now', kind: 'season', name: 'Ánh', v: 1300, season: '2026-10' });
  db.seq = 200;
  return db;
}
const v1Of = db => { const o = JSON.parse(JSON.stringify(db)); o.version = 1; delete o.martial; delete o.kydao; delete o.records; return o; };
const kind = sql => (/^BEGIN/.test(sql) ? 'BEGIN' : sql === 'COMMIT' ? 'COMMIT' : sql === 'ROLLBACK' ? 'ROLLBACK' : /^INSERT INTO docs/.test(sql) ? 'UPSERT' : /^DELETE FROM docs/.test(sql) ? 'DELETE' : sql.slice(0, 24));

/** Bọc pool để ghi lại mọi câu lệnh (cả của kết nối mượn qua pool.connect), có thể gắn hook để ép lỗi. */
function spyOn(store) {
  const pool = store.pool;
  const spy = { sqls: [], hook: null, active: 0, maxActive: 0 };
  const wrap = c => {
    if (c.__spy) return c;
    c.__spy = true;
    const q = c.query.bind(c);
    c.query = async (...a) => {
      const sql = String(typeof a[0] === 'string' ? a[0] : (a[0] && a[0].text) || '').replace(/\s+/g, ' ').trim();
      spy.sqls.push(sql);
      if (/^BEGIN/.test(sql)) spy.maxActive = Math.max(spy.maxActive, ++spy.active);
      if (sql === 'COMMIT' || sql === 'ROLLBACK') spy.active--;
      if (spy.hook) await spy.hook(sql, c);
      return q(...a);
    };
    return c;
  };
  const oc = pool.connect.bind(pool);
  pool.connect = (...a) => (typeof a[0] === 'function' ? oc(...a) : oc().then(wrap));
  const oq = pool.query.bind(pool);
  pool.query = (...a) => { spy.sqls.push(String(typeof a[0] === 'string' ? a[0] : a[0].text)); return oq(...a); };
  spy.kinds = () => spy.sqls.map(kind);
  spy.reset = () => { spy.sqls.length = 0; };
  return spy;
}

/** Cổng trung gian TCP: refuse cho N kết nối đầu, killAll() cắt mọi kết nối (giả lập Neon cắt kết nối / khởi động nguội). */
function flakyProxy(target, failFirst = 0) {
  const socks = new Set();
  const p = { port: 0, accepted: 0, failFirst };
  const server = net.createServer(sock => {
    p.accepted++;
    if (p.accepted <= p.failFirst) { sock.destroy(); return; }
    const up = net.connect(target.port, target.host);
    socks.add(sock); socks.add(up);
    sock.pipe(up); up.pipe(sock);
    const end = () => { sock.destroy(); up.destroy(); socks.delete(sock); socks.delete(up); };
    sock.on('error', end); up.on('error', end); sock.on('close', end); up.on('close', end);
  });
  p.killAll = () => { for (const s of [...socks]) s.destroy(); };
  p.close = () => { p.killAll(); return new Promise(r => server.close(r)); };
  p.listen = () => new Promise(r => server.listen(0, '127.0.0.1', () => { p.port = server.address().port; r(p); }));
  return p;
}

/* ---- không cần CSDL: cấu hình SSL, che mật khẩu ---- */

test('poolConfig: giữ chuỗi kết nối nguyên văn, chỉ đổi sslmode=require sang verify-full', () => {
  const url = 'postgres://u:p@ep-x-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';
  const c = poolConfig(url, {});
  assert.equal(c.connectionString, 'postgres://u:p@ep-x-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=verify-full&channel_binding=require');
  assert.equal(c.max, 3);
  assert.equal(c.idleTimeoutMillis, 30000);
  assert.equal(c.connectionTimeoutMillis, 15000);
  assert.equal(c.ssl, undefined);
  assert.equal(poolConfig('postgres://u:p@h/db?sslmode=verify-full', {}).connectionString, 'postgres://u:p@h/db?sslmode=verify-full');
  assert.equal(poolConfig('postgres://u:p@h/db', {}).connectionString, 'postgres://u:p@h/db');
});

test('poolConfig: PG_SSL=0 tắt SSL, no-verify vẫn mã hóa nhưng không kiểm chứng', () => {
  for (const off of ['0', 'false', 'off']) {
    const c = poolConfig('postgres://u:p@h/db?sslmode=require&x=1', { ssl: off });
    assert.equal(c.ssl, false);
    assert.equal(c.connectionString, 'postgres://u:p@h/db?x=1');
  }
  assert.equal(poolConfig('postgres://u:p@h/db?sslmode=require', { ssl: '0' }).connectionString, 'postgres://u:p@h/db');
  const nv = poolConfig('postgres://u:p@h/db?a=1&sslmode=require', { ssl: 'no-verify' });
  assert.deepEqual(nv.ssl, { rejectUnauthorized: false });
  assert.equal(nv.connectionString, 'postgres://u:p@h/db?a=1');
});

test('poolConfig: không gây cảnh báo SSL của pg 8.x (kiểm bằng tiến trình con)', () => {
  const script = `
    const { poolConfig } = require('./lib/store-pg');
    const { parse } = require('pg-connection-string');
    let n = 0; process.on('warning', w => { n++; });
    const raw = process.argv[1] === 'raw';
    const cs = raw ? 'postgres://u:p@h/db?sslmode=require' : poolConfig('postgres://u:p@h/db?sslmode=require', {}).connectionString;
    parse(cs);
    setImmediate(() => console.log(n));`;
  const run = mode => spawnSync(process.execPath, ['-e', script, mode], { cwd: ROOT, encoding: 'utf8', env: { PATH: process.env.PATH } });
  const ours = run('ours');
  assert.equal(ours.stdout.trim(), '0', ours.stderr);
  const raw = run('raw');
  console.log(`# (tham khảo) sslmode=require nguyên văn gây ${raw.stdout.trim()} cảnh báo với pg ${require('pg/package.json').version}`);
});

test('maskUrl che mật khẩu', () => {
  assert.equal(maskUrl('postgresql://neondb_owner:npg_BiMat123@ep-x-pooler.neon.tech/neondb?sslmode=require'), 'postgresql://neondb_owner:***@ep-x-pooler.neon.tech/neondb?sslmode=require');
  assert.equal(maskUrl('postgres://u:p%40ss@h/db'), 'postgres://u:***@h/db');
  assert.equal(maskUrl('postgres://h/db'), 'postgres://h/db');
});

test('init() ném lỗi rõ ràng khi thiếu DATABASE_URL, không lộ mật khẩu khi nối sai', async () => {
  const noUrl = createStore({ backend: 'pg', databaseUrl: '', log: quiet().log });
  await assert.rejects(noUrl.init(), /Thiếu DATABASE_URL/);
  const q = quiet();
  const bad = createStore({ backend: 'pg', databaseUrl: 'postgres://pagoda:MAT_KHAU_BI_MAT@127.0.0.1:1/x?sslmode=disable', log: q.log, retryDelays: [10, 10], importJson: false });
  const t0 = Date.now();
  await assert.rejects(bad.init(), e => {
    assert.match(e.message, /Không kết nối được CSDL/);
    assert.ok(!e.message.includes('MAT_KHAU_BI_MAT'), e.message);
    assert.match(e.message, /:\*\*\*@/);
    return true;
  });
  assert.equal(q.lines.filter(l => /thử lại/.test(l)).length, 2, 'đúng 3 lần thử (2 lần chờ)');
  assert.ok(!q.lines.join('\n').includes('MAT_KHAU_BI_MAT'));
  assert.ok(Date.now() - t0 < 5000);
  assert.equal(bad.status().ready, false);
  assert.equal(await bad.flush(), false, 'chưa sẵn sàng thì không bao giờ ghi');
  assert.equal(await bad.close(), false);
});

/* ---- cần CSDL ---- */

async function tryConnect() {
  const c = new Client({ connectionString: withParams(BASE, {}), connectionTimeoutMillis: 3000 });
  c.on('error', () => {});
  try { await c.connect(); return c; } catch (e) { try { await c.end(); } catch {} return { error: e }; }
}

test('PostgreSQL: kho dữ liệu', async t => {
  const root = await tryConnect();
  if (!root.query) { t.skip(`Không nối được PostgreSQL (${maskUrl(BASE)}): ${root.error && root.error.message}. Bỏ qua các test PG.`); return; }
  if (ISOLATE) await root.query(`CREATE SCHEMA ${SCHEMA}`);
  const admin = new Client({ connectionString: URL_ISO });
  admin.on('error', () => {});
  await admin.connect();
  const q = (sql, p) => admin.query(sql, p).then(r => r.rows);
  const cnt = async (section) => Number((await q(section ? 'SELECT count(*) n FROM docs WHERE section = $1' : 'SELECT count(*) n FROM docs', section ? [section] : []))[0].n);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'store-pg-'));
  const NOFILE = path.join(tmp, 'khong-co.json');
  const open = [];
  const closers = [];
  let uncaught = null;
  const onUncaught = e => { uncaught = e; };
  process.on('uncaughtException', onUncaught);

  const mk = (opts = {}) => {
    const l = quiet();
    const s = createStore({
      databaseUrl: URL_ISO, importJson: false, file: NOFILE, log: l.log, retryDelays: [20, 20], flushMs: 3600e3, retryMs: 60,
      ...opts
    });
    s.logs = l.lines;
    open.push(s);
    return s;
  };
  const fresh = async (opts) => { const s = mk(opts); await s.init(); return s; };
  const reload = async () => fresh();
  const reset = async () => {
    for (const s of open.splice(0)) await s.close({ discard: true, timeoutMs: 1000 }).catch(() => {});
    for (const c of closers.splice(0)) await c();
    await q('DROP TABLE IF EXISTS docs, schema_info');
  };

  const cases = [];
  const it = (name, fn) => cases.push([name, fn]);

  it('CSDL trống khởi tạo đúng', async () => {
    const s = mk();
    const db = s.get();
    assert.equal(s.status().ready, false);
    assert.equal(await s.init(), db);
    assert.equal(s.get(), db, 'định danh db không đổi');
    assert.deepEqual(db, S.fresh());
    assert.equal(db.version, 2);
    assert.deepEqual(s.status(), { backend: 'pg', ready: true, dirty: false, lastFlushAt: null, lastError: null, lastErrorAt: null, flushes: 0 });
    assert.equal(s.docCount(), 0);
    assert.equal(await cnt(), 0);
    assert.equal((await q(`SELECT to_regclass('docs') IS NOT NULL AS a, to_regclass('schema_info') IS NOT NULL AS b`))[0].a, true);
    assert.equal((await q(`SELECT count(*)::int n FROM schema_info WHERE key = 'schema'`))[0].n, 1);
    const cols = await q(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'docs' AND table_schema = ${ISOLATE ? '$1' : 'current_schema()'} ORDER BY ordinal_position`, ISOLATE ? [SCHEMA] : []);
    assert.deepEqual(cols.map(c => c.column_name + ':' + c.data_type), ['section:text', 'k:text', 'v:jsonb', 'updated_at:timestamp with time zone']);
    const spy = spyOn(s);
    assert.equal(await s.flush(), true);
    assert.deepEqual(spy.kinds(), ['BEGIN', 'UPSERT', 'COMMIT'], 'CSDL mới tinh: lần ghi đầu đặt dòng meta nền');
    assert.equal(await cnt(), 1);
    spy.reset();
    assert.equal(await s.flush(), true);
    assert.deepEqual(spy.sqls, [], 'sau đó không đổi gì thì không ghi');
    assert.equal(await s.init(), db, 'init lần hai không nạp lại');
    const again = await reload();
    const spy2 = spyOn(again);
    assert.equal(await again.flush(), true);
    assert.deepEqual(spy2.sqls, [], 'nạp lại rồi flush ngay cũng không ghi gì (meta không bị coi là đã đổi)');
  });

  it('thay đổi → flush → store thứ hai nạp ra y hệt, mọi phần, mảng đúng thứ tự', async () => {
    const a = await fresh();
    fill(a.get());
    a.save();
    assert.equal(a.status().dirty, true);
    assert.equal(await a.flush(), true);
    assert.equal(a.status().dirty, false);
    assert.equal(a.status().flushes, 1);
    for (const s of S.SECTIONS) assert.ok(await cnt(s.name) > 0, 'phần ' + s.name + ' có dòng');
    const b = await reload();
    sameDb(b.get(), a.get());
    const spyB = spyOn(b);
    b.save(); assert.equal(await b.flush(), true);
    assert.deepEqual(spyB.sqls, [], 'vừa nạp xong, flush ngay không có gì để ghi (seq nhảy chỉ nằm trong RAM)');
    assert.deepEqual(b.get().prayers.map(p => p.id), [9, 10, 100]);
    assert.deepEqual(b.get().donations.map(d => d.code), ['CD100002', 'CD100001']);
    assert.equal(b.get().seq, a.get().seq + 100000, 'nạp lại thì seq nhảy lên để không trùng id với bản cũ chạy chồng');
    // sửa một dòng cũ (đổi vị trí vật lý trong bảng), xóa đầu mảng, thêm mới
    a.get().prayers[0].text = 'đã sửa';
    a.get().chat.shift();
    a.get().chat.push({ id: 150, text: 'mới' });
    a.get().merit.u_a.total += 1;
    a.get().today.mo = 7;
    a.save();
    assert.equal(await a.flush(), true);
    const c = await reload();
    sameDb(c.get(), a.get());
    assert.deepEqual(c.get().chat.map(m => m.id), [12, 150]);
    assert.deepEqual(c.get().prayers.map(p => p.id), [9, 10, 100]);
  });

  it('thứ tự khi nạp: id số, donations theo createdAt, dù dòng nằm lộn xộn trong bảng', async () => {
    await (await fresh()).close();
    const ins = (s, k, v) => q('INSERT INTO docs (section, k, v) VALUES ($1, $2, $3)', [s, k, JSON.stringify(v)]);
    await ins('prayers', '100', { id: 100 }); await ins('prayers', '9', { id: 9 }); await ins('prayers', '10', { id: 10 });
    await ins('donations', 'B', { code: 'B', createdAt: 30 }); await ins('donations', 'A', { code: 'A', createdAt: 5 }); await ins('donations', 'C', { code: 'C', createdAt: 20 });
    await ins('chat', '7', { id: 7 });
    const s = await fresh();
    assert.deepEqual(s.get().prayers.map(p => p.id), [9, 10, 100]);
    assert.deepEqual(s.get().donations.map(d => d.code), ['A', 'C', 'B']);
    assert.ok(s.nextId() > 100, 'meta thiếu: seq vẫn lớn hơn mọi id');
  });

  it('xóa khóa khỏi RAM thì xóa dòng trong CSDL', async () => {
    const a = await fresh();
    fill(a.get());
    a.save(); await a.flush();
    const db = a.get();
    delete db.merit.g_b; delete db.linkedGuests.g_b; delete db.authSessions.hash1; delete db.auras.u_a;
    delete db.martial.profiles.u_a; delete db.martial.sessions[5]; delete db.martial.ledger['session:5'];
    db.chat.shift(); db.prayers.pop(); db.incense.length = 0; db.donations.pop(); db.martial.matches.length = 0; db.martial.audit.length = 0;
    delete db.kydao.ratings.u_a; delete db.kydao.active.u_a; db.kydao.pairs = {}; db.kydao.games.length = 0; db.records.log.length = 0;
    a.save();
    assert.equal(await a.flush(), true);
    assert.equal(await cnt('merit'), 1);
    for (const sec of ['linkedGuests', 'authSessions', 'auras', 'martial.profiles', 'martial.sessions', 'martial.ledger', 'incense', 'martial.matches', 'martial.audit', 'kydao.ratings', 'kydao.active', 'kydao.pairs', 'kydao.games', 'records.log']) assert.equal(await cnt(sec), 0, sec);
    assert.equal(await cnt('chat'), 1);
    assert.equal(await cnt('prayers'), 2);
    assert.equal(await cnt('donations'), 1);
    assert.equal(await cnt('meta'), 1);
    sameDb((await reload()).get(), db);
    // xóa sạch cả phần
    db.merit = {}; a.save(); await a.flush();
    assert.equal(await cnt('merit'), 0);
  });

  it('flush không có gì đổi thì không gửi câu lệnh nào; đổi một khóa thì đúng BEGIN, một upsert, COMMIT', async () => {
    const a = await fresh();
    fill(a.get());
    a.save(); await a.flush();
    const spy = spyOn(a);
    const before = a.status().flushes;
    await a.flush(); a.save(); await a.flush(); await a.flush();
    assert.deepEqual(spy.sqls, []);
    assert.equal(a.status().flushes, before, 'không đếm là một lần ghi');
    a.get().merit.u_a.total++;
    a.save(); await a.flush();
    assert.deepEqual(spy.kinds(), ['BEGIN', 'UPSERT', 'COMMIT']);
    assert.equal(a.status().flushes, before + 1);
    spy.reset();
    a.get().chat.shift();
    a.save(); await a.flush();
    assert.deepEqual(spy.kinds(), ['BEGIN', 'DELETE', 'COMMIT']);
    assert.equal(await cnt('merit'), 2);
    assert.equal((await q(`SELECT v->>'total' t FROM docs WHERE section='merit' AND k='u_a'`))[0].t, '121');
  });

  it('chỉ ghi khóa đã đổi: các dòng không đổi giữ nguyên updated_at', async () => {
    const a = await fresh();
    fill(a.get());
    a.save(); await a.flush();
    const before = Object.fromEntries((await q('SELECT section, k, updated_at FROM docs')).map(r => [r.section + '/' + r.k, +r.updated_at]));
    await sleep(15);
    a.get().merit.u_a.total++;
    a.save(); await a.flush();
    const after = Object.fromEntries((await q('SELECT section, k, updated_at FROM docs')).map(r => [r.section + '/' + r.k, +r.updated_at]));
    const changed = Object.keys(after).filter(k => after[k] !== before[k]);
    assert.deepEqual(changed, ['merit/u_a']);
  });

  it('save() hẹn ghi nền sau PG_FLUSH_MS, không ghi ngay', async () => {
    const a = await fresh({ flushMs: 120 });
    a.get().merit.u1 = { name: 'A', total: 1 };
    a.save();
    assert.equal(await cnt('merit'), 0, 'chưa ghi ngay');
    assert.ok(await waitFor(() => a.status().flushes === 1), 'tự ghi sau flushMs');
    assert.equal(await cnt('merit'), 1);
    assert.equal(a.status().dirty, false);
  });

  it('lỗi giữa chừng: không mất dữ liệu bẩn, CSDL không bị ghi dở, tự thử lại thành công', async () => {
    const a = await fresh();
    fill(a.get());
    a.save(); await a.flush();
    const spy = spyOn(a);
    const db = a.get();
    for (let i = 0; i < 2500; i++) db.merit['x' + i] = { name: 'Người ' + i, total: i, today: 0, day: db.day };
    db.merit.u_a.total = 999;
    db.chat.shift();
    a.save();
    let n = 0;
    spy.hook = sql => { if (/^INSERT INTO docs/.test(sql) && ++n === 2) throw new Error('lỗi giả giữa chừng'); };
    assert.equal(await a.flush(), false);
    const st = a.status();
    assert.equal(st.dirty, true);
    assert.match(st.lastError, /lỗi giả giữa chừng/);
    assert.equal(st.flushes, 1);
    assert.equal(uncaught, null);
    assert.ok(a.logs.some(l => /Lỗi ghi PostgreSQL/.test(l)));
    assert.equal(await cnt('merit'), 2, 'giao dịch bị hủy toàn bộ, lô đầu không lọt vào');
    assert.equal(await cnt('chat'), 2);
    assert.equal((await q(`SELECT v->>'total' t FROM docs WHERE section='merit' AND k='u_a'`))[0].t, '120');
    spy.hook = null;
    assert.ok(await waitFor(() => !a.status().dirty && a.status().flushes === 2), 'tự thử lại sau retryMs');
    assert.equal(a.status().lastError, null);
    assert.equal(await cnt('merit'), 2502);
    sameDb((await reload()).get(), db);
  });

  it('lỗi rồi thử lại bằng flush() tay cũng thành công và giữ đủ phần xóa', async () => {
    const a = await fresh({ retryMs: 3600e3 });
    fill(a.get());
    a.save(); await a.flush();
    const spy = spyOn(a);
    a.get().chat.shift();
    a.get().merit.zz = { name: 'Z', total: 1 };
    a.save();
    spy.hook = sql => { if (/^DELETE FROM docs/.test(sql)) throw new Error('hỏng lệnh xóa'); };
    assert.equal(await a.flush(), false);
    assert.equal(await cnt('merit'), 2, 'upsert trước đó cũng đã hủy');
    spy.hook = null;
    assert.equal(await a.flush(), true);
    assert.equal(await cnt('merit'), 3);
    assert.equal(await cnt('chat'), 1);
  });

  it('mất kết nối giữa giao dịch: flush trả false, không sập, nối lại ghi được', async () => {
    const proxy = await flakyProxy({ host: '127.0.0.1', port: Number(new URL(BASE).port || 5432) }).listen();
    closers.push(() => proxy.close());
    const u = new URL(URL_ISO); u.hostname = '127.0.0.1'; u.port = String(proxy.port);
    const a = await fresh({ databaseUrl: u.toString(), retryMs: 40 });
    const spy = spyOn(a);
    a.get().merit.u1 = { name: 'A', total: 1 };
    a.save();
    let cut = true;
    spy.hook = sql => { if (cut && /^INSERT INTO docs/.test(sql)) { cut = false; proxy.killAll(); return sleep(30); } };
    assert.equal(await a.flush(), false);
    assert.equal(a.status().dirty, true);
    assert.ok(await waitFor(() => !a.status().dirty && a.status().lastError === null), 'tự nối lại và ghi');
    assert.equal(await cnt('merit'), 1);
    assert.equal(uncaught, null);
  });

  it('kết nối rảnh bị cắt (Neon tự cắt) không làm sập tiến trình, lần ghi sau vẫn được', async () => {
    const proxy = await flakyProxy({ host: '127.0.0.1', port: Number(new URL(BASE).port || 5432) }).listen();
    closers.push(() => proxy.close());
    const u = new URL(URL_ISO); u.hostname = '127.0.0.1'; u.port = String(proxy.port);
    const a = await fresh({ databaseUrl: u.toString() });
    a.get().merit.u1 = { name: 'A', total: 1 };
    a.save(); assert.equal(await a.flush(), true);
    proxy.killAll();
    await sleep(80);
    assert.equal(uncaught, null);
    assert.ok(a.logs.some(l => /kết nối CSDL rảnh bị ngắt/.test(l)), 'pool.on(error) bắt được và ghi log');
    a.get().merit.u1.total = 2;
    a.save(); assert.equal(await a.flush(), true);
    assert.equal((await q(`SELECT v->>'total' t FROM docs WHERE section='merit' AND k='u1'`))[0].t, '2');
    assert.doesNotThrow(() => a.pool.emit('error', new Error('Connection terminated unexpectedly')));
    assert.equal(uncaught, null);
  });

  it('khởi động nguội: vài lần nối đầu bị từ chối vẫn nạp được (thử lại 3 lần)', async () => {
    const proxy = await flakyProxy({ host: '127.0.0.1', port: Number(new URL(BASE).port || 5432) }, 2).listen();
    closers.push(() => proxy.close());
    const u = new URL(URL_ISO); u.hostname = '127.0.0.1'; u.port = String(proxy.port);
    const a = mk({ databaseUrl: u.toString() });
    await a.init();
    assert.equal(a.status().ready, true);
    assert.equal(a.logs.filter(l => /thử lại/.test(l)).length, 2);
    // nhưng hỏng cả 3 lần thì ném lỗi, không tự bắt đầu với dữ liệu trống
    const proxy2 = await flakyProxy({ host: '127.0.0.1', port: Number(new URL(BASE).port || 5432) }, 99).listen();
    closers.push(() => proxy2.close());
    const u2 = new URL(URL_ISO); u2.hostname = '127.0.0.1'; u2.port = String(proxy2.port);
    const b = mk({ databaseUrl: u2.toString() });
    await assert.rejects(b.init(), /Không kết nối được CSDL/);
    assert.equal(b.status().ready, false);
    assert.equal(proxy2.accepted, 3);
    assert.equal(await b.flush(), false);
  });

  it('sai mật khẩu: init() ném lỗi và không lộ mật khẩu', async () => {
    const u = new URL(URL_ISO); u.password = 'sai_mat_khau_zzz';
    const a = mk({ databaseUrl: u.toString(), retryDelays: [10] });
    await assert.rejects(a.init(), e => { assert.ok(!e.message.includes('sai_mat_khau_zzz')); assert.match(e.message, /password|xác thực|authentication/i); return true; });
    assert.ok(!a.logs.join('\n').includes('sai_mat_khau_zzz'));
    assert.equal(a.status().ready, false);
  });

  it('flush được xếp hàng: gọi dồn dập không chạy chồng; đổi lúc đang ghi thì chạy thêm một vòng', async () => {
    const a = await fresh();
    const spy = spyOn(a);
    const db = a.get();
    db.merit.a1 = { name: 'A1', total: 1 };
    const p1 = a.flush();
    db.merit.a2 = { name: 'A2', total: 2 };
    const p2 = a.flush();
    db.merit.a3 = { name: 'A3', total: 3 };
    const p3 = a.flush();
    assert.deepEqual(await Promise.all([p1, p2, p3]), [true, true, true]);
    assert.equal(spy.maxActive, 1, 'không bao giờ hai giao dịch cùng lúc');
    assert.equal(await cnt('merit'), 3);
    assert.ok(a.status().flushes >= 2);
    assert.deepEqual((await reload()).get().merit, db.merit);
  });

  it('chia lô khi quá nhiều dòng', async () => {
    const a = await fresh();
    const spy = spyOn(a);
    for (let i = 0; i < 2500; i++) a.get().merit['m' + i] = { name: 'N' + i, total: i };
    a.save(); assert.equal(await a.flush(), true);
    assert.equal(spy.kinds().filter(k => k === 'UPSERT').length, 3, '1000 + 1000 + 500 dòng');
    assert.equal(spy.kinds().filter(k => k === 'BEGIN').length, 1, 'vẫn là một giao dịch');
    spy.reset();
    for (let i = 0; i < 2500; i++) delete a.get().merit['m' + i];
    a.save(); assert.equal(await a.flush(), true);
    assert.equal(spy.kinds().filter(k => k === 'DELETE').length, 3);
    assert.equal(await cnt('merit'), 0);
  });

  it('chuỗi có NUL hoặc surrogate lẻ không làm hỏng lượt ghi và không ghi lại mãi', async () => {
    const a = await fresh();
    a.get().chat.push({ id: 1, text: 'a\u0000b \ud800 c' });
    a.get().merit['u\u0000x'] = { name: 'n\u0000', total: 1 };
    a.save();
    assert.equal(await a.flush(), true);
    assert.equal(a.status().lastError, null);
    const spy = spyOn(a);
    a.save(); assert.equal(await a.flush(), true);
    assert.deepEqual(spy.sqls, []);
    const b = await reload();
    assert.equal(b.get().chat[0].text, 'ab � c');
    assert.deepEqual(Object.keys(b.get().merit), ['ux']);
  });

  it('khóa cấp cao chưa có phần lưu thì cảnh báo rõ (không im lặng mất dữ liệu)', async () => {
    const a = await fresh();
    a.get().khoaLa = { x: 1 };
    a.get().merit.u1 = { name: 'A', total: 1 };
    a.save(); await a.flush();
    assert.ok(a.logs.some(l => /khoaLa/.test(l) && /KHÔNG lưu/.test(l)), a.logs.join('\n'));
    assert.equal(await cnt('merit'), 1);
  });

  it('nhập từ JSON: CSDL trống + file cũ (version 1) → nhập một giao dịch, đếm khớp, ghi schema_info', async () => {
    const full = fill(S.fresh());
    const raw = v1Of(full);
    const file = path.join(tmp, 'db-v1.json');
    fs.writeFileSync(file, JSON.stringify(raw));
    const a = mk({ importJson: true, file });
    await a.init();
    const db = a.get();
    assert.equal(db.version, 2);
    assert.deepEqual(db.martial, S.fresh().martial);
    assert.deepEqual(db.kydao, S.fresh().kydao);
    assert.deepEqual(db.records, S.fresh().records);
    const expected = S.counts(S.adopt({}, raw));
    assert.deepEqual(S.counts(db), expected);
    assert.equal(Object.keys(db.merit).length, 2);
    assert.equal(db.donations.length, 2);
    assert.equal(Object.keys(db.authSessions).length, 1);
    assert.equal(db.seq, 200);
    for (const [sec, n] of Object.entries(expected)) assert.equal(await cnt(sec), n, sec);
    const info = (await q(`SELECT value FROM schema_info WHERE key = 'imported_from_json'`))[0].value;
    assert.equal(info.file, file);
    assert.deepEqual(info.counts, expected);
    assert.ok(Date.parse(info.at) > 0);
    assert.ok(a.logs.some(l => /2 người có công đức, 2 lượt cúng dường, 1 phiên đăng nhập, 3 lời nguyện/.test(l)), a.logs.join('\n'));
    assert.equal(a.status().dirty, false);
    assert.equal(a.docCount(), await cnt());
    assert.ok(fs.existsSync(file), 'không xóa file gốc');
    // nạp lại từ CSDL ra y hệt
    sameDb((await reload()).get(), db);
  });

  it('nhập từ JSON chạy lần hai không nhập lại; CSDL đã có dữ liệu thì luôn lấy từ CSDL', async () => {
    const file = path.join(tmp, 'db-2.json');
    const raw = fill(S.fresh());
    fs.writeFileSync(file, JSON.stringify(raw));
    const a = mk({ importJson: true, file });
    await a.init();
    const at = (await q(`SELECT value->>'at' AS ts FROM schema_info WHERE key = 'imported_from_json'`))[0].ts;
    // file đổi hẳn, CSDL đã có dữ liệu → không nhập đè
    const other = S.fresh(); other.merit.khac = { name: 'Khác', total: 1 };
    fs.writeFileSync(file, JSON.stringify(other));
    const b = mk({ importJson: true, file });
    await b.init();
    sameDb(b.get(), a.get());
    assert.equal(b.get().merit.khac, undefined);
    assert.equal((await q(`SELECT value->>'at' AS ts FROM schema_info WHERE key = 'imported_from_json'`))[0].ts, at);
    assert.ok(!b.logs.some(l => /Đã nhập dữ liệu từ/.test(l)));
    // thay đổi ở CSDL rồi nạp lại: vẫn lấy từ CSDL
    b.get().merit.u_a.total = 4242; b.save(); await b.flush();
    const c = mk({ importJson: true, file });
    await c.init();
    assert.equal(c.get().merit.u_a.total, 4242);
  });

  it('không nhập khi importJson tắt (PG_IMPORT_JSON=0) hoặc file không tồn tại', async () => {
    const file = path.join(tmp, 'db-3.json');
    fs.writeFileSync(file, JSON.stringify(fill(S.fresh())));
    const a = mk({ importJson: false, file });
    await a.init();
    assert.equal(Object.keys(a.get().merit).length, 0);
    assert.equal(await cnt(), 0);
    await a.close({ discard: true });
    await q('DROP TABLE docs, schema_info');
    const old = process.env.PG_IMPORT_JSON;
    process.env.PG_IMPORT_JSON = '0';
    try {
      const l = quiet();
      const b = createStore({ databaseUrl: URL_ISO, file, log: l.log });
      open.push(b);
      await b.init();
      assert.equal(Object.keys(b.get().merit).length, 0, 'đọc PG_IMPORT_JSON=0 từ môi trường');
    } finally { if (old === undefined) delete process.env.PG_IMPORT_JSON; else process.env.PG_IMPORT_JSON = old; }
    const c = mk({ importJson: true, file: path.join(tmp, 'khong-ton-tai.json') });
    await c.init();
    assert.equal(c.status().ready, true);
    assert.equal(await cnt('merit'), 0);
  });

  it('file JSON cũ hỏng thì init() ném lỗi chỉ rõ cách bỏ qua, không ghi gì vào CSDL', async () => {
    const file = path.join(tmp, 'db-hong.json');
    fs.writeFileSync(file, '{"merit": {"u1": ');
    const a = mk({ importJson: true, file });
    await assert.rejects(a.init(), /bị hỏng.*PG_IMPORT_JSON=0/);
    assert.equal(await cnt(), 0);
    assert.equal(a.status().ready, false);
  });

  it('nextId không bao giờ lùi sau nạp lại, kể cả khi meta cũ hơn dữ liệu', async () => {
    const a = await fresh();
    const ids = [];
    for (let i = 0; i < 5; i++) { const id = a.nextId(); ids.push(id); a.get().prayers.push({ id, text: 'p' + id }); }
    a.get().chat.push({ id: a.nextId(), text: 'c' });
    a.save(); await a.flush();
    const lastBefore = a.get().seq - 1;
    const b = await reload();
    const n1 = b.nextId();
    assert.ok(n1 > lastBefore, `${n1} phải lớn hơn mọi id đã cấp (${lastBefore})`);
    assert.ok(n1 > Math.max(...ids));
    // phá meta: seq về 1 trong CSDL
    await q(`UPDATE docs SET v = jsonb_set(v, '{seq}', '1') WHERE section = 'meta'`);
    const c = await reload();
    assert.ok(c.nextId() > lastBefore, 'seq được sửa theo id lớn nhất đang có');
    // nextId liên tục và có lưu
    const d = await reload();
    const x = d.nextId(), y = d.nextId();
    assert.equal(y, x + 1);
    d.save(); await d.flush();
    assert.ok((await reload()).nextId() > y);
  });

  it('hai store đọc cùng CSDL thấy cùng dữ liệu; hai store khởi tạo song song trên CSDL trống đều ổn', async () => {
    const [a, b] = [mk(), mk()];
    await Promise.all([a.init(), b.init()]);
    fill(a.get());
    a.save(); await a.flush();
    const [c, d] = [mk(), mk()];
    await Promise.all([c.init(), d.init()]);
    sameDb(c.get(), d.get());
    sameDb(c.get(), a.get());
    // b nạp từ trước khi a ghi: ghi khóa khác thì hợp nhất theo khóa, không đè khóa của a
    b.get().merit.tu_b = { name: 'B', total: 3 };
    b.save(); await b.flush();
    const e = await reload();
    assert.equal(e.get().merit.tu_b.total, 3);
    assert.equal(e.get().merit.u_a.total, 120);
    assert.equal(e.get().chat.length, 2);
  });

  it('close() ghi nốt phần chưa lưu rồi đóng pool; gọi lại không sao', async () => {
    const a = await fresh({ flushMs: 3600e3 });
    a.get().merit.u1 = { name: 'A', total: 1 };
    a.save();
    assert.equal(await cnt('merit'), 0);
    assert.equal(await a.close(), true);
    assert.equal(a.pool, null);
    assert.equal(await cnt('merit'), 1);
    a.save();
    await a.close();
    const b = await reload();
    assert.equal(b.get().merit.u1.name, 'A');
  });

  it('SSL: sslmode=require với chứng chỉ tự ký bị từ chối, no-verify vẫn mã hóa', async t2 => {
    const host = new URL(BASE).hostname;
    const sslOn = (await q('SHOW ssl'))[0].ssl === 'on';
    if (!sslOn || !['127.0.0.1', 'localhost'].includes(host)) { t2.skip('máy chủ thử nghiệm không bật SSL tự ký'); return; }
    const u = new URL(URL_ISO); u.searchParams.set('sslmode', 'require');
    const strict = mk({ databaseUrl: u.toString(), retryDelays: [] });
    await assert.rejects(strict.init(), /certificate|altnames|self.signed|Hostname/i);
    const lax = mk({ databaseUrl: u.toString(), ssl: 'no-verify' });
    await lax.init();
    const r = await lax.pool.query('SELECT ssl FROM pg_stat_ssl WHERE pid = pg_backend_pid()');
    assert.equal(r.rows[0].ssl, true);
    const off = mk({ databaseUrl: u.toString(), ssl: '0' });
    await off.init();
    assert.equal((await off.pool.query('SELECT ssl FROM pg_stat_ssl WHERE pid = pg_backend_pid()')).rows[0].ssl, false);
  });

  it('tải lớn: 20.000 người có công đức, đổi 1% rồi flush', async () => {
    const N = 20000;
    const a = await fresh();
    const db = a.get();
    for (let i = 0; i < N; i++) db.merit['u_' + i] = { name: 'Người công đức số ' + i, total: i * 3, today: i % 7, day: '2026-11-06' };
    for (let i = 0; i < 500; i++) db.chat.push({ id: a.nextId(), pid: i, name: 'N' + i, text: 'lời ' + i, t: i });
    a.save();
    let t0 = Date.now();
    assert.equal(await a.flush(), true);
    const tFull = Date.now() - t0;
    assert.equal(await cnt('merit'), N);

    t0 = Date.now();
    const b = await reload();
    const tLoad = Date.now() - t0;
    assert.equal(Object.keys(b.get().merit).length, N);
    assert.deepEqual(b.get().merit.u_19999, db.merit.u_19999);

    t0 = Date.now();
    await b.flush();
    const tNoop = Date.now() - t0;
    const spy = spyOn(b);
    const heap0 = process.memoryUsage().heapUsed;
    for (let i = 0; i < N; i += 100) b.get().merit['u_' + i].total += 1;
    b.save();
    t0 = Date.now();
    assert.equal(await b.flush(), true);
    const tDelta = Date.now() - t0;
    assert.deepEqual(spy.kinds(), ['BEGIN', 'UPSERT', 'COMMIT'], '1% = 200 dòng trong một câu lệnh');
    const c = await reload();
    assert.equal(c.get().merit.u_300.total, 901);
    assert.equal(c.get().merit.u_301.total, 903);
    console.log(`# tải lớn ${N} người: ghi đầy đủ lần đầu ${tFull} ms · nạp ${tLoad} ms · flush không đổi ${tNoop} ms · đổi 200 khóa rồi flush ${tDelta} ms · heap +${Math.round((process.memoryUsage().heapUsed - heap0) / 1e6)} MB`);
    assert.ok(tDelta < 5000, 'flush phần chênh quá chậm: ' + tDelta + ' ms');
    assert.ok(tFull < 90000, 'ghi đầy đủ quá chậm: ' + tFull + ' ms');
    assert.ok(tLoad < 30000, 'nạp quá chậm: ' + tLoad + ' ms');
  });

  /* ---- công cụ dòng lệnh ---- */
  const cli = (args, env = {}) => {
    const r = spawnSync(process.execPath, [CLI, ...args], { cwd: tmp, encoding: 'utf8', env: { PATH: process.env.PATH, DATABASE_URL: URL_ISO, ...env } });
    return { code: r.status, out: r.stdout, err: r.stderr, all: r.stdout + r.stderr };
  };

  it('db-migrate: stats, import, verify, export, khứ hồi', async () => {
    const dir = fs.mkdtempSync(path.join(tmp, 'cli-'));
    const noUrl = cli(['stats'], { DATABASE_URL: '' });
    assert.equal(noUrl.code, 2);
    assert.match(noUrl.all, /Chưa đặt DATABASE_URL/);
    assert.equal(cli(['linh-tinh']).code, 2);

    const s0 = cli(['stats']);
    assert.equal(s0.code, 0, s0.all);
    assert.match(s0.out, /Chưa có bảng docs/);

    const full = fill(S.fresh());
    const f1 = path.join(dir, 'cu.json');
    fs.writeFileSync(f1, JSON.stringify(v1Of(full)));
    const imp = cli(['import', f1]);
    assert.equal(imp.code, 0, imp.all);
    assert.match(imp.out, /OK: mọi phần khớp/);
    assert.ok(!imp.all.includes(':pagoda@'), 'không in mật khẩu');
    assert.match(imp.out, /postgres:\/\/pagoda:\*\*\*@/);

    const again = cli(['import', f1]);
    assert.equal(again.code, 1);
    assert.match(again.all, /đã có \d+ tài liệu nên KHÔNG nhập/);
    const rep = cli(['import', f1, '--replace']);
    assert.equal(rep.code, 1);
    assert.match(rep.all, /--yes/);

    const ver = cli(['verify', f1]);
    assert.equal(ver.code, 0, ver.all);
    assert.match(ver.out, /OK: mọi phần khớp/);
    assert.match(ver.out, /Tổng công đức: 125/);
    assert.match(ver.out, /Tổng tiền cúng dường đã xác nhận \(đồng\): 50\.000/);
    assert.match(ver.out, /Số phiên đăng nhập: 1/);

    const st = cli(['stats']);
    assert.equal(st.code, 0, st.all);
    assert.match(st.out, /merit\s+2\s/);
    assert.match(st.out, /Đã nhập từ JSON lúc/);

    // lệch: sửa trong CSDL một giá trị rồi xóa một dòng
    await q(`UPDATE docs SET v = jsonb_set(v, '{total}', '777') WHERE section='merit' AND k='u_a'`);
    const bad = cli(['verify', f1]);
    assert.equal(bad.code, 1);
    assert.match(bad.out, /KHÁC BIỆT/);
    assert.match(bad.out, /Tổng công đức: 125 \(tệp\) \/ 782 \(CSDL\).*KHÁC/);
    await q(`DELETE FROM docs WHERE section='prayers' AND k='9'`);
    const bad2 = cli(['verify', f1]);
    assert.equal(bad2.code, 1);
    assert.match(bad2.out, /prayers\s+3\s+2\s+KHÁC/);

    // export: mặc định không có phiên đăng nhập, quyền 600
    const out = path.join(dir, 'ra.json');
    const ex = cli(['export', out]);
    assert.equal(ex.code, 0, ex.all);
    const exported = JSON.parse(fs.readFileSync(out, 'utf8'));
    assert.equal('authSessions' in exported, false);
    assert.equal(exported.version, 2);
    assert.equal(exported.merit.u_a.total, 777);
    if (process.platform !== 'win32') assert.equal(fs.statSync(out).mode & 0o777, 0o600);
    const out2 = path.join(dir, 'ra-day-du.json');
    assert.equal(cli(['export', out2, '--with-sessions']).code, 0);
    const withSessions = JSON.parse(fs.readFileSync(out2, 'utf8'));
    assert.equal(Object.keys(withSessions.authSessions).length, 1);
    const def = cli(['export']);
    assert.equal(def.code, 0, def.all);
    assert.ok(fs.readdirSync(tmp).some(f => /^pagoda-export-\d{8}-\d{4}\.json$/.test(f)), 'tên mặc định có ngày giờ');
    for (const f of fs.readdirSync(tmp)) if (/^pagoda-export-/.test(f)) fs.rmSync(path.join(tmp, f));
    const toStdout = cli(['export', '-']);
    assert.equal(JSON.parse(toStdout.out).merit.u_a.total, 777);

    // khứ hồi: file export nạp được ở chế độ JSON và nhập lại được vào CSDL khác
    const js = createStore({ backend: 'json', file: out, log: quiet().log });
    js.load();
    assert.deepEqual(js.get().merit, exported.merit);
    assert.deepEqual(js.get().authSessions, {});
    const rp = cli(['import', out2, '--replace', '--yes']);
    assert.equal(rp.code, 0, rp.all);
    assert.match(rp.out, /OK: mọi phần khớp/);
    assert.equal(cli(['verify', out2]).code, 0);
    assert.equal(await cnt('prayers'), 2, 'file export lấy đúng trạng thái CSDL lúc đó (đã xóa lời nguyện 9)');
    // --replace xóa cả những gì file không có
    const small = S.fresh(); small.merit.chi_mot = { name: 'Một', total: 1 };
    const f3 = path.join(dir, 'nho.json');
    fs.writeFileSync(f3, JSON.stringify(small));
    assert.equal(cli(['import', f3, '--replace', '--yes']).code, 0);
    assert.equal(await cnt('merit'), 1);
    assert.equal(await cnt('prayers'), 0);
    assert.equal(cli(['verify', f3]).code, 0);
    // file hỏng
    const hong = path.join(dir, 'hong.json'); fs.writeFileSync(hong, '{');
    assert.equal(cli(['verify', hong]).code, 1);
    assert.equal(cli(['import', path.join(dir, 'khong-co.json')]).code, 1);
  });

  t.after(async () => {
    process.off('uncaughtException', onUncaught);
    await reset().catch(() => {});
    await admin.end().catch(() => {});
    if (ISOLATE) await root.query(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`).catch(() => {});
    await root.end().catch(() => {});
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  for (const [name, fn] of cases) {
    await reset();
    await t.test(name, fn);
  }
});
