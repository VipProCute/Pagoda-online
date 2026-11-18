'use strict';
/* Phát danh hiệu từ máy chủ (T-041): ptt, titles, ticker, sổ "Các đời", công đức theo mùa, gộp khách, TITLES_ENABLED=0. */
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, freePort } = require('./helpers/live');
const { connect, join, call, waitFor, sleep } = require('./helpers/client');
const Records = require('../lib/records');

const UA = 'uid-ttl-a0000001', UB = 'uid-ttl-b0000001';
const day = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
// ngưỡng thấp + chu kỳ ngắn để thử nhanh
const FAST = { TITLE_MIN_MERIT_TOTAL: '100', TITLE_MIN_MERIT_SEASON: '5', TITLES_SWEEP_MS: '300' };

function seed(merit) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pagoda-titles-'));
  const file = path.join(dir, 'db.json');
  fs.writeFileSync(file, JSON.stringify({ version: 2, day: day(), merit }));
  return file;
}
const readDb = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const mk = (name, total) => ({ name, total, today: 0, day: day() });

async function twoPlayers(t, env) {
  const file = seed({ [UA]: mk('Nguoi A', 500), [UB]: mk('Nguoi B', 495) });
  const srv = await startServer({ DATA_FILE: file, ...FAST, ...env });
  const a = await connect(srv.port), b = await connect(srv.port);
  t.after(() => { a.close(); b.close(); });
  const ja = await join(a, 'Nguoi A', UA), jb = await join(b, 'Nguoi B', UB);
  assert.ok(ja.ok && jb.ok);
  return { srv, file, a, b, ja, jb };
}

test('người thứ hai vượt người thứ nhất: ptt, titles, ticker đổi đúng, sổ Các đời có dòng mới có id, không lộ uid', async t => {
  const { srv, file, a, b, ja, jb } = await twoPlayers(t, {});
  t.after(() => srv.stop());
  assert.equal(ja.config.titles.enabled, true);
  assert.equal(ja.config.titles.names['merit.history'], 'Vô Lượng Công Đức');
  assert.equal(ja.config.titles.priority[0], 'pk.history');
  const self = jb.players.find(p => p.id === jb.you), selfA = jb.players.find(p => p.id === ja.you);
  assert.deepEqual(self.tt, []);
  assert.deepEqual(selfA.tt, ['merit.history'], 'A (500) đang giữ danh hiệu lịch sử công đức');
  const first = await waitFor(b, 'titles', () => true, 3000, true);
  assert.deepEqual(first['merit.history'], { name: 'Nguoi A', v: 500 });

  const pttB = waitFor(a, 'ptt', x => x.id === jb.you && x.tt.includes('merit.history'));
  const pttA = waitFor(a, 'ptt', x => x.id === ja.you && x.tt.length === 0);
  const titles = waitFor(a, 'titles', x => x['merit.history'] && x['merit.history'].name === 'Nguoi B');
  const ticker = waitFor(a, 'ticker', x => /vừa trở thành/.test(x.text));
  assert.ok((await call(b, 'incense', { sticks: 1, kind: 'Cầu an' })).ok);   // +10: 495 -> 505 > 500

  assert.deepEqual((await pttB).tt, ['merit.history', 'merit.season']);
  assert.deepEqual((await pttA).tt, []);
  assert.deepEqual((await titles)['merit.season'].name, 'Nguoi B');
  assert.equal((await ticker).text, 'Nguoi B vừa trở thành Vô Lượng Công Đức.');
  await sleep(700);
  assert.equal(a.log.filter(x => x.ev === 'ticker' && /vừa trở thành/.test(x.payload.text)).length, 1, 'hai danh hiệu cùng hạng mục: một ticker');

  // người vào sau thấy ngay tt của B và ảnh chụp titles
  const c = await connect(srv.port); t.after(() => c.close());
  const jc = await join(c, 'Nguoi C', 'uid-ttl-c0000001');
  assert.deepEqual(jc.players.find(p => p.id === jb.you).tt, ['merit.history', 'merit.season']);
  assert.equal((await waitFor(c, 'titles', () => true, 3000, true))['merit.history'].name, 'Nguoi B');

  // không gói nào chứa uid
  for (const s of [a, b, c]) for (const x of s.log) if (['ptt', 'titles', 'ticker'].includes(x.ev)) {
    const j = JSON.stringify(x.payload);
    assert.ok(!j.includes(UA) && !j.includes(UB), x.ev + ' lộ uid');
  }
  assert.ok(!JSON.stringify(jc.players).includes(UB));

  await srv.stop();
  const db = readDb(file);
  assert.ok(db.records.log.length >= 1);
  const line = db.records.log.find(x => x.kind === 'history' && x.cat === 'merit');
  assert.ok(line && Number.isInteger(line.id) && line.name === 'Nguoi B' && line.v === 505 && line.at > 0);
  assert.ok(db.merit[UB].season && db.merit[UB].season.key === Records.seasonKey(Date.now()) && db.merit[UB].season.v === 10, 'công đức theo mùa được ghi');
});

test('TITLES_ENABLED=0: không tính, không phát ptt/titles/ticker, tt rỗng, không ghi sổ', async t => {
  const { srv, file, a, b, ja, jb } = await twoPlayers(t, { TITLES_ENABLED: '0' });
  t.after(() => srv.stop());
  assert.equal(ja.config.titles.enabled, false);
  assert.ok(jb.players.every(p => Array.isArray(p.tt) && p.tt.length === 0));
  assert.ok((await call(b, 'incense', { sticks: 1, kind: 'Cầu an' })).ok);
  await sleep(1200);
  for (const s of [a, b]) assert.equal(s.log.filter(x => ['ptt', 'titles'].includes(x.ev) || (x.ev === 'ticker' && /vừa trở thành/.test(x.payload.text))).length, 0);
  await srv.stop();
  assert.deepEqual(readDb(file).records.log, []);
});

test('khởi động rồi tính lần đầu: không ghi sổ, không ticker hàng loạt', async t => {
  const file = seed({ [UA]: mk('Nguoi A', 500), [UB]: mk('Nguoi B', 300) });
  const srv = await startServer({ DATA_FILE: file, ...FAST });
  t.after(() => srv.stop());
  const a = await connect(srv.port); t.after(() => a.close());
  await join(a, 'Nguoi A', UA);
  await sleep(900);
  assert.equal(a.log.filter(x => x.ev === 'ticker' && /vừa trở thành/.test(x.payload.text)).length, 0);
  await srv.stop();
  assert.deepEqual(readDb(file).records.log, []);
});

test('gộp khách vào tài khoản: giữ đúng điểm mùa của công đức (cùng mùa thì cộng)', async t => {
  const port = await freePort();
  const origin = `http://127.0.0.1:${port}`;
  const fake = path.join(__dirname, 'helpers', 'fake-google.js').replace(/\\/g, '/');
  const key = Records.seasonKey(Date.now());
  const acct = 'google:' + crypto.createHash('sha256').update('nguoi-thu-1').digest('base64url'), guest = 'uid-ttl-guest001';
  const file = seed({ [acct]: { ...mk('Chu Tai Khoan', 40), season: { key, v: 7, at: 1000 } } });
  const srv = await startServer({
    DATA_FILE: file, PORT: String(port), GOOGLE_CLIENT_ID: 'client-thu', GOOGLE_CLIENT_SECRET: 'bi-mat-thu', AUTH_ORIGIN: origin,
    NODE_OPTIONS: `--require "${fake}"`, ...FAST
  });
  t.after(() => srv.stop());
  const g = await connect(srv.port); t.after(() => g.close());
  assert.ok((await join(g, 'Khach Thu', guest)).ok);
  assert.ok((await call(g, 'incense', { sticks: 1, kind: 'Cầu an' })).ok);     // khách +10

  const cookieOf = (res, name) => res.headers.getSetCookie().map(c => c.split(';')[0]).find(c => c.startsWith(name + '='));
  const start = await fetch(origin + '/api/auth/google', { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify({ guest }) });
  assert.equal(start.status, 200);
  const flowCookie = cookieOf(start, 'ta-google-flow');
  const flow = JSON.parse(Buffer.from(flowCookie.slice(flowCookie.indexOf('=') + 1).split('.')[0], 'base64url').toString('utf8'));
  const code = Buffer.from(JSON.stringify({ nonce: flow.nonce, sub: 'nguoi-thu-1' })).toString('base64url');
  const cb = await fetch(`${origin}/api/auth/google/callback?${new URLSearchParams({ state: flow.state, code })}`, { redirect: 'manual', headers: { cookie: flowCookie } });
  assert.ok(cb.headers.get('location').includes('auth=ok'));
  await srv.stop();
  const db = readDb(file);
  assert.equal(db.merit[guest], undefined, 'dòng khách đã gộp');
  assert.equal(db.merit[acct].total, 50);
  assert.equal(db.merit[acct].season.key, key);
  assert.equal(db.merit[acct].season.v, 17, '7 của tài khoản + 10 của khách');
  assert.ok(db.merit[acct].season.at >= 1000);
});
