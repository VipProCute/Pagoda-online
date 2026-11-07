'use strict';
/*
 * Hai khái niệm "ở đâu" sống chung sau khi gộp nhánh xin xăm / sân chùa với nhánh Võ Học Các / Sân đấu:
 *   - cảnh (scene): chánh điện hay sân chùa, cùng một trang, cùng một khung vẽ; có hàng chờ xin xăm ở chánh điện.
 *   - nơi (place): chánh điện, Võ Học Các hay Sân đấu; mỗi nơi là một màn hình riêng.
 * Người đi sang Võ Học Các / Sân đấu thì rời hàng chờ xin xăm và không xin xăm được từ đó.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, freePort } = require('./helpers/live');
const { connect, call, join, waitFor, sleep } = require('./helpers/client');

const digest = v => crypto.createHash('sha256').update(v).digest('base64url');

test('cảnh (chánh điện / sân chùa) và nơi (Võ Học Các / Sân đấu) không dẫm lên nhau', async t => {
  const port = await freePort();
  const token = crypto.randomBytes(32).toString('base64url');
  const acct = 'google:test-scene-1';
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chua-scene-'));
  const dataFile = path.join(dir, 'db.json');
  const day = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
  fs.writeFileSync(dataFile, JSON.stringify({ version: 2, day, authSessions: { [digest(token)]: { uid: acct, until: Date.now() + 864e5 } } }));
  const srv = await startServer({ PORT: String(port), DATA_FILE: dataFile, GOOGLE_CLIENT_ID: 'id-thu', GOOGLE_CLIENT_SECRET: 'bi-mat-thu', AUTH_ORIGIN: `http://127.0.0.1:${port}`, CULTIVATION_TIME_SCALE: '1' });
  t.after(() => srv.stop());
  const open = [];
  t.after(() => open.forEach(s => s.close()));
  const as = async (name, uid, signedIn) => {
    const socket = await connect(port, signedIn ? { extraHeaders: { cookie: 'ta-session=' + token } } : {});
    open.push(socket);
    return { socket, join: await join(socket, name, uid) };
  };

  const watcher = await as('Nguoi Xem', 'khach-xem-00001', false);
  const pjP = waitFor(watcher.socket, 'pj', p => p.name === 'Nguoi Ban');
  const a = await as('Nguoi Ban', 'khach-ban-00001', true);
  const pj = await pjP;
  assert.equal(pj.scene, 'hall', 'vào chánh điện thì ở cảnh chánh điện');
  assert.equal(pj.at, undefined, 'chưa đi nơi nào khác');

  // sang sân chùa: không xin xăm được ở đó
  const toYard = waitFor(watcher.socket, 'pscene', d => d.id === pj.id && d.scene === 'yard');
  assert.equal((await call(a.socket, 'scene', 'yard')).ok, true);
  await toYard;
  const refused = await call(a.socket, 'fortune:join', null);
  assert.equal(refused.ok, false, 'ở sân chùa không xin xăm');
  const late = await as('Nguoi Den Sau', 'khach-sau-00001', false);
  assert.equal(late.join.players.find(p => p.id === pj.id).scene, 'yard', 'người vào sau thấy đúng cảnh');

  // về chánh điện: vào hàng chờ xin xăm được
  assert.equal((await call(a.socket, 'scene', 'hall')).ok, true);
  const queued = await call(a.socket, 'fortune:join', null);
  assert.equal(queued.ok, true, queued.reason);
  await sleep(150);
  const q1 = watcher.socket.log.filter(x => x.ev === 'fortune:queue').pop().payload;
  assert.equal(q1.current && q1.current.id, pj.id, 'đang được xin xăm');

  // đi Võ Học Các: rời hàng chờ, các nơi khác thấy người này "ở" Võ Học Các
  const toDojo = waitFor(watcher.socket, 'pplace', d => d.id === pj.id && d.place === 'dojo');
  assert.equal((await call(a.socket, 'place:set', { place: 'dojo' })).ok, true);
  await toDojo;
  await sleep(150);
  const q2 = watcher.socket.log.filter(x => x.ev === 'fortune:queue').pop().payload;
  assert.equal(q2.current, null, 'rời chánh điện thì rời hàng chờ');
  assert.equal(q2.waiting.length, 0);
  const refused2 = await call(a.socket, 'fortune:join', null);
  assert.equal(refused2.ok, false, 'đang ở Võ Học Các thì không xin xăm');
  const late2 = await as('Nguoi Den Sau Nua', 'khach-sau-00002', false);
  assert.equal(late2.join.players.find(p => p.id === pj.id).at, 'dojo', 'người vào sau thấy người này đang ở Võ Học Các');

  // trở về chánh điện thì xin xăm lại được
  assert.equal((await call(a.socket, 'place:set', { place: 'hall' })).ok, true);
  assert.equal((await call(a.socket, 'fortune:join', null)).ok, true);
});

/*
 * Tàng Kinh Các là một cảnh đi lại được: có bồ đoàn để ngồi thiền. Mỗi bồ đoàn một người.
 * Đang tu nội công mà ngồi bồ đoàn thì người khác thấy công pháp đang tu (để vẽ linh khí); đi chỗ khác thì đứng dậy.
 */
test('Tàng Kinh Các: ngồi bồ đoàn, linh khí khi đang tu, đứng dậy khi đi hay đổi cảnh', async t => {
  const port = await freePort();
  const token = crypto.randomBytes(32).toString('base64url');
  const acct = 'google:test-scene-2';
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chua-lib-'));
  const dataFile = path.join(dir, 'db.json');
  const day = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
  fs.writeFileSync(dataFile, JSON.stringify({ version: 2, day, authSessions: { [digest(token)]: { uid: acct, until: Date.now() + 864e5 } } }));
  const srv = await startServer({ PORT: String(port), DATA_FILE: dataFile, GOOGLE_CLIENT_ID: 'id-thu', GOOGLE_CLIENT_SECRET: 'bi-mat-thu', AUTH_ORIGIN: `http://127.0.0.1:${port}`, CULTIVATION_TIME_SCALE: '1' });
  t.after(() => srv.stop());
  const open = [];
  t.after(() => open.forEach(s => s.close()));
  const as = async (name, uid, signedIn) => {
    const socket = await connect(port, signedIn ? { extraHeaders: { cookie: 'ta-session=' + token } } : {});
    open.push(socket);
    return { socket, join: await join(socket, name, uid) };
  };
  const watcher = await as('Nguoi Xem', 'khach-xem-00011', false);
  const a = await as('Nguoi Tu', 'khach-tu-00011', true);
  const g = await as('Khach Vang Lai', 'khach-vl-00011', false);
  const aid = a.join.you, gid = g.join.you;

  // chưa vào Tàng Kinh Các thì chưa ngồi bồ đoàn được
  assert.equal((await call(a.socket, 'sit', { seat: 0 })).ok, false, 'ở chánh điện không có bồ đoàn');

  const pscene = waitFor(watcher.socket, 'pscene', d => d.id === aid && d.scene === 'library');
  assert.equal((await call(a.socket, 'scene', 'library')).ok, true);
  const ps = await pscene;
  assert.ok(Math.abs(ps.x - 0.5) < 0.01 && ps.z > 0.8, 'vào Tàng Kinh Các thì đứng ở cửa');
  assert.equal((await call(g.socket, 'scene', 'library')).ok, true);
  a.socket.emit('scene', 'constructor');                   // cảnh lạ (kể cả tên thuộc tính của Object) bị bỏ qua

  // ngồi: người khác thấy; bồ đoàn đã có người thì không ngồi chồng được
  assert.equal((await call(a.socket, 'sit', { seat: 9 })).ok, false, 'không có bồ đoàn số 10');
  const sat = waitFor(watcher.socket, 'psit', d => d.id === aid && d.sit === 1);
  const r1 = await call(a.socket, 'sit', { seat: 1 });
  assert.equal(r1.ok, true, r1.reason);
  assert.equal((await sat).cm, '', 'chưa tu thì chưa có linh khí');
  const taken = await call(g.socket, 'sit', { seat: 1 });
  assert.equal(taken.ok, false, 'bồ đoàn đã có người');
  assert.match(taken.reason, /Nguoi Tu/);

  // bắt đầu tu khi đang ngồi: mọi người nhận công pháp đang tu
  const cult = waitFor(watcher.socket, 'psit', d => d.id === aid && d.cm === 'tinh-tam-quyet');
  const st = await call(a.socket, 'tu:start', { methodId: 'tinh-tam-quyet', duration: '15m' });
  assert.equal(st.ok, true, st.reason);
  await cult;
  const late = await as('Nguoi Den Sau', 'khach-sau-00011', false);
  const seen = late.join.players.find(p => p.id === aid);
  assert.equal(seen.sit, 1, 'người vào sau thấy đang ngồi');
  assert.equal(seen.cm, 'tinh-tam-quyet', 'và thấy đang tu');

  // khách vãng lai ngồi được (tĩnh tọa) nhưng không có linh khí
  const gsat = waitFor(watcher.socket, 'psit', d => d.id === gid && d.sit === 3);
  assert.equal((await call(g.socket, 'sit', { seat: 3 })).ok, true);
  assert.equal((await gsat).cm, '');

  // đi chỗ khác thì đứng dậy; phiên tu vẫn chạy
  const stood = waitFor(watcher.socket, 'psit', d => d.id === aid && d.sit === -1);
  a.socket.emit('move', { x: 0.5, z: 0.9 });
  await stood;
  const ms = await call(a.socket, 'martial:state', {});
  assert.ok(ms.session && ms.session.methodId === 'tinh-tam-quyet', 'đứng dậy không hủy phiên tu');

  // ngồi lại rồi đổi cảnh: cũng đứng dậy
  assert.equal((await call(a.socket, 'sit', { seat: 1 })).ok, true);
  const stood2 = waitFor(watcher.socket, 'psit', d => d.id === aid && d.sit === -1);
  assert.equal((await call(a.socket, 'scene', 'hall')).ok, true);
  await stood2;

  // khách đứng dậy bằng nút
  const gstood = waitFor(watcher.socket, 'psit', d => d.id === gid && d.sit === -1);
  g.socket.emit('stand');
  await gstood;

  // ra Sân đấu thì máy chủ cho đứng ở cổng sân (gửi kèm chỗ đứng)
  const toArena = waitFor(watcher.socket, 'pplace', d => d.id === aid && d.place === 'arena');
  assert.equal((await call(a.socket, 'place:set', { place: 'arena' })).ok, true);
  const pa = await toArena;
  assert.ok(pa.z >= 0.84 && pa.z <= 0.92 && pa.x >= 0.36 && pa.x <= 0.64, 'đứng ở cổng sân đấu');
});
