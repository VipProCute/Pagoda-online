'use strict';
/* Kho chế độ JSON: khứ hồi, nạp file cũ, định danh db ổn định, ghi file tạm rồi đổi tên, lỗi ghi. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { createStore } = require('../lib/store');
const S = require('../lib/store-sections');

const ROOT = path.join(__dirname, '..');
const quiet = () => {
  const lines = [];
  const push = lvl => (...a) => lines.push(lvl + ' ' + a.join(' '));
  return { lines, log: { log: push('log'), warn: push('warn'), error: push('error') } };
};
const tmpDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'store-json-'));
const rm = d => fs.rmSync(d, { recursive: true, force: true });

/** Mỗi test một thư mục tạm và một store riêng; dọn sau khi xong. */
function setup(t, opts = {}) {
  const dir = tmpDir();
  const q = quiet();
  const file = opts.file || path.join(dir, 'db.json');
  const store = createStore({ backend: 'json', file, log: q.log, ...opts.store });
  t.after(async () => { await store.close({ discard: true }); rm(dir); });
  return { dir, file, store, lines: q.lines, make: o => { const s = createStore({ backend: 'json', file, log: q.log, ...o }); t.after(() => s.close({ discard: true })); return s; } };
}

/** Dữ liệu mẫu đủ mọi phần, có chữ đặc biệt và id không theo thứ tự chữ. */
function fill(db) {
  db.day = '2026-11-06';
  db.today.incense = 3; db.total.incense = 10; db.total.visits = 99;
  db.merit.u_a = { name: 'Ánh "Nguyệt" \\ 🙏', total: 120, today: 20, day: db.day };
  db.merit.g_b = { name: 'Khách\nxuống dòng', total: 5, today: 5, day: db.day };
  db.linkedGuests.g_b = 'u_a';
  db.authSessions.hash1 = { uid: 'u_a', until: 1.8e12 };
  db.auras.u_a = { amount: 500000, tier: 3, until: 1.8e12, name: 'Ánh' };
  for (const id of [9, 10, 100]) db.prayers.push({ id, kind: 'cau-an', text: 'Nguyện ' + id, name: 'A', t: id, n: 0, by: [] });
  for (const id of [11, 12]) db.chat.push({ id, pid: 1, name: 'A', c: 1, text: 'xin chào {"x":1}', t: id });
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

test('khứ hồi: ghi rồi nạp bằng store khác ra y hệt', async t => {
  const a = setup(t);
  a.store.load();
  fill(a.store.get());
  a.store.save();
  assert.equal(await a.store.flush(), true);
  const b = a.make();
  b.load();
  assert.deepEqual(b.get(), a.store.get());
  assert.deepEqual(JSON.parse(fs.readFileSync(a.file, 'utf8')), JSON.parse(JSON.stringify(a.store.get())));
  assert.equal(b.get().version, 2);
  assert.deepEqual(b.get().martial.matches, a.store.get().martial.matches);
});

test('hình dạng mặc định có version 2 và martial', t => {
  const { store } = setup(t);
  const db = store.load();
  assert.equal(db.version, 2);
  assert.deepEqual(db.martial, { profiles: {}, sessions: {}, ledger: {}, matches: [], audit: [] });
  assert.equal(db.seq, 1);
  for (const k of ['merit', 'linkedGuests', 'authSessions', 'auras']) assert.deepEqual(db[k], {});
  for (const k of ['prayers', 'chat', 'incense', 'donations']) assert.deepEqual(db[k], []);
  assert.equal(typeof store.COUNTERS, 'function');
  assert.deepEqual(Object.keys(store.COUNTERS()), ['incense', 'lotus', 'rose', 'lamp', 'fruit', 'hearts', 'mo', 'bows', 'bells', 'chants', 'visits']);
  assert.ok(store.FILE.endsWith('db.json'));
});

test('nạp file version 1 (không có martial) và bổ sung mặc định', t => {
  const { store, file } = setup(t);
  const v1 = {
    version: 1, day: '2026-01-02', today: { incense: 2 }, total: { incense: 9, visits: 4 },
    merit: { u1: { name: 'A', total: 30, today: 0, day: '2026-01-01' } }, linkedGuests: { g1: 'u1' },
    authSessions: { h: { uid: 'u1', until: 5 } }, prayers: [{ id: 3, text: 'x' }], chat: [], incense: [],
    donations: [{ code: 'CD1', status: 'confirmed', amount: 1000, createdAt: 1 }], auras: {}, seq: 4, khoaLa: { giuNguyen: true }
  };
  fs.writeFileSync(file, JSON.stringify(v1));
  const db = store.load();
  assert.equal(db.version, 2);
  assert.deepEqual(db.martial, { profiles: {}, sessions: {}, ledger: {}, matches: [], audit: [] });
  assert.equal(db.today.incense, 2);
  assert.equal(db.today.lotus, 0, 'bộ đếm thiếu được bổ sung 0');
  assert.equal(db.total.visits, 4);
  assert.equal(db.merit.u1.total, 30);
  assert.equal(db.donations[0].code, 'CD1');
  assert.deepEqual(db.khoaLa, { giuNguyen: true }, 'chế độ JSON giữ nguyên khóa lạ');
  assert.ok(store.nextId() > 3);
});

test('nạp file thiếu một phần martial hoặc sai kiểu thì vá lại', t => {
  const { store, file } = setup(t);
  fs.writeFileSync(file, JSON.stringify({ version: 1, merit: [], donations: {}, prayers: 'x', martial: { profiles: { u: { uid: 'u' } }, matches: null } }));
  const db = store.load();
  assert.deepEqual(db.merit, {});
  assert.deepEqual(db.donations, []);
  assert.deepEqual(db.prayers, []);
  assert.deepEqual(Object.keys(db.martial.profiles), ['u']);
  assert.deepEqual(db.martial.matches, []);
  assert.deepEqual(db.martial.audit, []);
});

test('định danh object db không đổi sau load / init / load lại', async t => {
  const { store, file } = setup(t);
  const before = store.get();
  assert.equal(before.version, 2, 'trước khi nạp đã có hình dạng đầy đủ');
  fs.writeFileSync(file, JSON.stringify({ version: 1, merit: { u1: { name: 'A', total: 1 } }, seq: 7 }));
  assert.equal(store.load(), before);
  assert.equal(store.get(), before);
  assert.equal(before.merit.u1.name, 'A');
  fs.writeFileSync(file, JSON.stringify({ version: 1, merit: { u2: { name: 'B', total: 2 } }, seq: 9 }));
  store.load();
  assert.equal(store.get(), before);
  assert.deepEqual(Object.keys(before.merit), ['u2']);
  assert.equal(await store.init(), before, 'init không nạp lại khi đã sẵn sàng');
  assert.deepEqual(Object.keys(before.merit), ['u2']);
});

test('init() ở chế độ JSON đọc file', async t => {
  const { store, file } = setup(t);
  fs.writeFileSync(file, JSON.stringify({ merit: { u1: { name: 'A', total: 1 } } }));
  assert.equal(store.status().ready, false);
  const db = await store.init();
  assert.equal(db, store.get());
  assert.equal(db.merit.u1.name, 'A');
  assert.equal(store.status().ready, true);
});

test('ghi file tạm rồi đổi tên, không để lại file tạm', async t => {
  const { store, file, dir } = setup(t);
  store.load();
  fill(store.get());
  store.save();
  const calls = [];
  const origWrite = fs.writeFileSync, origRename = fs.renameSync;
  const w = t.mock.method(fs, 'writeFileSync', function (p, ...r) { calls.push(['write', p]); return origWrite.call(this, p, ...r); });
  const rn = t.mock.method(fs, 'renameSync', function (a, b) { calls.push(['rename', a, b]); return origRename.call(this, a, b); });
  assert.equal(await store.flush(), true);
  w.mock.restore(); rn.mock.restore();
  assert.deepEqual(calls, [['write', file + '.tmp'], ['rename', file + '.tmp', file]]);
  assert.deepEqual(fs.readdirSync(dir), ['db.json']);
});

test('ghi dở dang (lỗi giữa chừng) không làm hỏng file cũ, flush trả false rồi tự thử lại', async t => {
  const { store, file, lines } = setup(t, { store: { retryMs: 30 } });
  store.load();
  store.get().merit.u1 = { name: 'Cũ', total: 1 };
  assert.equal(await store.flush(), true);
  const good = fs.readFileSync(file, 'utf8');
  store.get().merit.u1 = { name: 'Mới', total: 2 };
  store.save();
  let fail = true;
  const origWrite = fs.writeFileSync;
  t.mock.method(fs, 'writeFileSync', function (p, ...r) {
    if (fail) { origWrite.call(this, p, '{"cut":'); throw new Error('đĩa đầy giả'); }
    return origWrite.call(this, p, ...r);
  });
  assert.equal(await store.flush(), false);
  assert.equal(fs.readFileSync(file, 'utf8'), good, 'file chính còn nguyên');
  assert.equal(store.status().dirty, true);
  assert.match(store.status().lastError, /đĩa đầy giả/);
  assert.ok(lines.some(l => /Lỗi ghi dữ liệu/.test(l)));
  fail = false;
  for (let i = 0; i < 100 && store.status().dirty; i++) await new Promise(r => setTimeout(r, 20));
  assert.equal(store.status().dirty, false, 'tự thử lại sau retryMs');
  assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).merit.u1.name, 'Mới');
  assert.equal(store.status().lastError, null);
});

test('flush trả Promise<boolean> và ghi file ngay trong lời gọi (đồng bộ)', async t => {
  const { store, file } = setup(t);
  store.load();
  store.get().merit.u1 = { name: 'A', total: 1 };
  const p = store.flush();
  assert.ok(p instanceof Promise);
  assert.equal(fs.existsSync(file), true, 'file đã có trước khi await');
  assert.equal(await p, true);
  fs.rmSync(file);
  assert.equal(typeof (await store.flush()), 'boolean');
});

test('flush lỗi (không tạo được thư mục) trả false, không ném', async t => {
  const dir = tmpDir();
  t.after(() => rm(dir));
  const blocker = path.join(dir, 'la-file');
  fs.writeFileSync(blocker, 'x');
  const q = quiet();
  const store = createStore({ backend: 'json', file: path.join(blocker, 'con', 'db.json'), log: q.log, retryMs: 60000 });
  t.after(() => store.close({ discard: true }));
  store.load();
  store.save();
  assert.equal(await store.flush(), false);
  assert.equal(store.status().dirty, true);
  assert.ok(store.status().lastError);
});

test('save() hẹn ghi sau 4 giây, nhiều lần save chỉ ghi một lần', async t => {
  const { store, file } = setup(t);
  store.load();
  t.mock.timers.enable({ apis: ['setTimeout'] });
  store.get().merit.u1 = { name: 'A', total: 1 };
  store.save();
  t.mock.timers.tick(2000);
  store.save();
  t.mock.timers.tick(1999);
  assert.equal(fs.existsSync(file), false, 'chưa tới 4 giây');
  assert.equal(store.status().dirty, true);
  t.mock.timers.tick(1);
  assert.equal(fs.existsSync(file), true);
  assert.equal(store.status().dirty, false);
  assert.equal(store.status().flushes, 1);
  assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).merit.u1.name, 'A');
});

test('file hỏng: ghi log, bắt đầu mới, giữ lại bản hỏng', t => {
  const { store, file, dir, lines } = setup(t);
  fs.writeFileSync(file, '{"merit": {"u1": ');
  const db = store.load();
  assert.deepEqual(db.merit, {});
  assert.ok(lines.some(l => /^error .*Không đọc được dữ liệu/.test(l)));
  const kept = fs.readdirSync(dir).filter(f => f.startsWith('db.json.hong-'));
  assert.equal(kept.length, 1);
  assert.equal(fs.readFileSync(path.join(dir, kept[0]), 'utf8'), '{"merit": {"u1": ');
  assert.equal(store.status().ready, true);
});

test('file có JSON hợp lệ nhưng không phải object cũng coi là hỏng', t => {
  const { store, file, dir } = setup(t);
  fs.writeFileSync(file, '[1,2,3]');
  const db = store.load();
  assert.deepEqual(db.merit, {});
  assert.equal(fs.readdirSync(dir).filter(f => f.includes('.hong-')).length, 1);
});

test('chưa nạp thì flush không đè file cũ', async t => {
  const { store, file } = setup(t);
  fs.writeFileSync(file, JSON.stringify({ merit: { u1: { name: 'A', total: 9 } } }));
  assert.equal(await store.flush(), false);
  assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).merit.u1.total, 9);
  assert.equal(await store.close(), false);
  assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).merit.u1.total, 9);
});

test('nextId tăng dần và không bao giờ lùi sau nạp lại', async t => {
  const a = setup(t);
  a.store.load();
  const db = a.store.get();
  const ids = [a.store.nextId(), a.store.nextId(), a.store.nextId()];
  assert.deepEqual(ids, [1, 2, 3]);
  db.prayers.push({ id: ids[2], text: 'x' });
  db.seq = 2;   // meta cũ hơn dữ liệu: nạp lại phải sửa
  await a.store.flush();
  const b = a.make();
  b.load();
  assert.ok(b.nextId() > 3, 'seq lớn hơn mọi id đang có');
  const c = a.make();
  c.load();
  const first = c.nextId();
  await c.flush();
  const d = a.make();
  d.load();
  assert.ok(d.nextId() > first);
});

test('close() ghi nốt phần chưa lưu; sau đó save() không làm gì', async t => {
  const { store, file } = setup(t);
  store.load();
  store.get().merit.u1 = { name: 'A', total: 1 };
  store.save();
  assert.equal(await store.close(), true);
  assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).merit.u1.name, 'A');
  store.get().merit.u1.name = 'B';
  store.save();
  await new Promise(r => setTimeout(r, 30));
  assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).merit.u1.name, 'A');
});

test('status() có đủ trường', async t => {
  const { store } = setup(t);
  store.load();
  assert.deepEqual(Object.keys(store.status()).sort(), ['backend', 'dirty', 'flushes', 'lastError', 'lastErrorAt', 'lastFlushAt', 'ready']);
  assert.equal(store.backend, 'json');
  assert.equal(store.status().dirty, false);
  store.save();
  assert.equal(store.status().dirty, true);
  await store.flush();
  const s = store.status();
  assert.equal(s.dirty, false);
  assert.equal(s.flushes, 1);
  assert.ok(s.lastFlushAt > 0);
  assert.equal(s.lastError, null);
});

test('load() ở chế độ PostgreSQL ném lỗi rõ ràng', t => {
  const q = quiet();
  const store = createStore({ backend: 'pg', databaseUrl: 'postgres://u:matkhau@127.0.0.1:1/x', log: q.log });
  assert.equal(store.backend, 'pg');
  assert.throws(() => store.load(), /init\(\)/);
});

test('singleton chọn chế độ theo DATABASE_URL, có createStore', () => {
  const run = env => spawnSync(process.execPath, ['-e', "const s=require('./lib/store');console.log(s.backend, typeof s.createStore, typeof s.get().seq, s.FILE.endsWith('db.json')||s.FILE)"],
    { cwd: ROOT, env: { PATH: process.env.PATH, ...env }, encoding: 'utf8' });
  const a = run({});
  assert.equal(a.stdout.trim(), 'json function number true', a.stderr);
  const b = run({ DATABASE_URL: 'postgres://u:p@127.0.0.1:1/x' });
  assert.match(b.stdout.trim(), /^pg function number/, b.stderr);
  const c = run({ DATA_FILE: '/tmp/khac/db-khac.json' });
  assert.equal(c.stdout.trim(), 'json function number /tmp/khac/db-khac.json', c.stderr);
});

test('store-sections: snapshot / diff / adopt cho biết đúng phần chênh', () => {
  const db = fill(S.fresh());
  const shadow = S.snapshot(db);
  assert.deepEqual(S.diff(shadow, S.snapshot(db)), { upserts: [], deletes: [] });
  db.merit.u_a.total++;
  db.chat.shift();
  db.martial.audit.push({ id: 99, at: 1 });
  const d = S.diff(shadow, S.snapshot(db));
  assert.deepEqual(d.upserts.map(x => x.slice(0, 2)).sort(), [['martial.audit', '99'], ['merit', 'u_a']]);
  assert.deepEqual(d.deletes, [['chat', '11']]);
  assert.deepEqual(S.unknownKeys(db), []);
  db.khoaLa = 1;
  assert.deepEqual(S.unknownKeys(db), ['khoaLa']);
  delete db.khoaLa;
  db.kydao.khoaCon = 1; db.records.khoaCon = 1;
  assert.deepEqual(S.unknownKeys(db), ['kydao.khoaCon', 'records.khoaCon']);
});

test('store-sections: kydao và records có mặc định, vá khi thiếu/sai kiểu, và diff theo id', () => {
  const f = S.fresh();
  assert.deepEqual(f.kydao, { ratings: {}, games: [], active: {}, pairs: {} });
  assert.deepEqual(f.records, { log: [] });
  const db = S.adopt({}, { version: 2, kydao: { games: 'x', ratings: { u: { name: 'U' } } }, records: null });
  assert.deepEqual(db.kydao, { ratings: { u: { name: 'U' } }, games: [], active: {}, pairs: {} });
  assert.deepEqual(db.records, { log: [] });
  const old = S.adopt({}, { version: 2 });
  assert.deepEqual(old.kydao, S.fresh().kydao, 'dữ liệu cũ không có hai khóa vẫn nạp được');
  for (let i = 1; i <= 3; i++) { old.kydao.games.push({ id: i }); old.records.log.push({ id: 10 + i }); }
  const shadow = S.snapshot(old);
  old.kydao.games.shift(); old.records.log.shift();
  const d = S.diff(shadow, S.snapshot(old));
  assert.deepEqual(d.upserts, [], 'cắt bớt đầu danh sách không ghi lại mục còn lại');
  assert.deepEqual(d.deletes.sort(), [['kydao.games', '1'], ['records.log', '11']]);
});

test('store-sections: kydao.pairs khứ hồi qua snapshot → rowsToRaw → adopt, không bị coi là khóa lạ', () => {
  const db = S.adopt({}, { version: 2 });
  db.kydao.pairs['2026-11-11|a|b|go'] = 2;
  assert.deepEqual(S.unknownKeys(db), []);
  const rows = new Map();
  for (const [name, m] of S.snapshot(db)) rows.set(name, [...m].map(([k, str]) => ({ k, v: JSON.parse(str) })));
  const back = S.adopt({}, S.rowsToRaw(rows));
  assert.deepEqual(back.kydao.pairs, { '2026-11-11|a|b|go': 2 });
});

test('store-sections: chuỗi có NUL hoặc surrogate lẻ được làm sạch để jsonb nhận', () => {
  const s = S.ser({ a: 'x\u0000y', b: 'z\ud800', c: 'ok \\u0000 giữ nguyên chữ' });
  const v = JSON.parse(s);
  assert.equal(v.a, 'xy');
  assert.equal(v.b, 'z�');
  assert.equal(v.c, 'ok \\u0000 giữ nguyên chữ');
});
