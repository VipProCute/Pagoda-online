'use strict';
/* Phòng theo cảnh: gói vị trí 'p' và hiệu ứng thị giác chỉ tới người cùng cảnh; đổi cảnh thì nhận ảnh chụp vị trí cảnh mới. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer } = require('./helpers/live');
const { connect, call, join, sleep } = require('./helpers/client');

const open = [];
test.after(() => open.forEach(s => s.close()));
async function enter(srv, name, uid) {
  const socket = await connect(srv.port);
  open.push(socket);
  const r = await join(socket, name, uid);
  assert.ok(r && r.ok, r && r.reason);
  socket.me = r.you;
  return socket;
}
/** Các bản ghi vị trí của người pid mà socket nhận được (từ mốc `from` trong log). */
const posOf = (socket, pid, from = 0) => socket.log.slice(from).filter(x => x.ev === 'p').flatMap(x => x.payload).filter(r => r[0] === pid);

test('chỉ người cùng cảnh nhận vị trí; đổi cảnh nhận ảnh chụp vị trí của cảnh mới', async t => {
  const srv = await startServer({});
  t.after(() => srv.stop());
  const a = await enter(srv, 'Minh A', 'uid-room-a000001');
  const b = await enter(srv, 'Minh B', 'uid-room-b000001');
  const c = await enter(srv, 'Minh C', 'uid-room-c000001');
  assert.equal((await call(c, 'scene', 'yard')).ok, true);
  await sleep(150);

  const markA = a.log.length, markC = c.log.length;
  b.emit('move', { x: 0.2, z: 0.7 });
  for (let i = 0; i < 100; i++) {   // chờ B tới nơi (A thấy vị trí cuối đúng đích)
    const ps = posOf(a, b.me, markA), l = ps[ps.length - 1];
    if (l && Math.abs(l[1] / 1000 - 0.2) < 0.005 && Math.abs(l[2] / 1000 - 0.7) < 0.005) break;
    await sleep(100);
  }
  await sleep(150);
  assert.ok(posOf(a, b.me, markA).length > 0, 'A cùng cảnh chánh điện nhận vị trí của B');
  assert.equal(posOf(c, b.me, markC).length, 0, 'C ở sân chùa không nhận vị trí của B');

  // B đã dừng; C về chánh điện phải nhận ngay vị trí hiện tại của B
  const mark2 = c.log.length;
  assert.equal((await call(c, 'scene', 'hall')).ok, true);
  await sleep(200);
  const snap = posOf(c, b.me, mark2);
  assert.ok(snap.length > 0, 'có ảnh chụp vị trí của B');
  const last = snap[snap.length - 1];
  assert.ok(Math.abs(last[1] / 1000 - 0.2) < 0.01 && Math.abs(last[2] / 1000 - 0.7) < 0.01, 'đúng chỗ B đang đứng');
  // pscene vẫn là sự kiện toàn cục
  assert.ok(a.log.some(x => x.ev === 'pscene' && x.payload.id === c.me && x.payload.scene === 'yard'));
});

test('emote bow chỉ tới người cùng cảnh', async t => {
  const srv = await startServer({});
  t.after(() => srv.stop());
  const a = await enter(srv, 'Minh A', 'uid-room-a000002');
  const b = await enter(srv, 'Minh B', 'uid-room-b000002');
  const c = await enter(srv, 'Minh C', 'uid-room-c000002');
  await call(c, 'scene', 'library');
  await sleep(100);
  b.emit('emote', { type: 'bow' });
  await sleep(300);
  assert.ok(a.log.some(x => x.ev === 'emote' && x.payload.pid === b.me), 'A thấy B cúi lạy');
  assert.ok(!c.log.some(x => x.ev === 'emote' && x.payload.pid === b.me), 'C ở Tàng Kinh Các không nhận');
});

test('tệp tĩnh có ?v= được cache dài immutable, tệp không ?v= giữ 10 phút, html no-cache', async t => {
  const srv = await startServer({});
  t.after(() => srv.stop());
  const v = await fetch(srv.url + '/js/app.js?v=abc');
  assert.equal(v.status, 200);
  assert.match(v.headers.get('cache-control'), /max-age=31536000.*immutable/);
  const plain = await fetch(srv.url + '/js/app.js');
  assert.match(plain.headers.get('cache-control'), /max-age=600/);
  assert.doesNotMatch(plain.headers.get('cache-control'), /immutable/);
  const html = await fetch(srv.url + '/');
  assert.match(html.headers.get('cache-control'), /no-cache/);
  const miss = await fetch(srv.url + '/js/khong-co.js?v=1');
  assert.equal(miss.status, 404);
  assert.doesNotMatch(miss.headers.get('cache-control') || '', /immutable/);
});
