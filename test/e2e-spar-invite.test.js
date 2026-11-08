'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer } = require('./helpers/live');
const { connect, call, join, waitFor } = require('./helpers/client');

test('chạm mời từ chánh điện: cả hai đồng ý ra sân rồi mới chọn chế độ PK', async t => {
  const srv = await startServer(); t.after(() => srv.stop());
  const a = await connect(srv.port), b = await connect(srv.port), other = await connect(srv.port);
  t.after(() => { a.close(); b.close(); other.close(); });
  const ja = await join(a, 'Dao Huu A', 'spar-room-a-00001');
  const jb = await join(b, 'Dao Huu B', 'spar-room-b-00001');
  await join(other, 'Nguoi Khac', 'spar-room-other-01');
  const invited = waitFor(b, 'spar:invited');
  assert.ok((await call(a, 'spar:invite', { toPid: jb.you })).ok);
  const i = await invited;
  assert.equal(i.name, 'Dao Huu A');
  assert.equal((await call(other, 'spar:respond', { id: i.id, accept: true })).ok, false);
  const accA = waitFor(a, 'spar:accepted'), accB = waitFor(b, 'spar:accepted');
  assert.ok((await call(b, 'spar:respond', { id: i.id, accept: true })).ok);
  await Promise.all([accA, accB]);
  assert.equal((await call(a, 'pk:invite', { toPid: jb.you, mode: 'balanced' })).ok, false, 'không đánh trong chánh điện');
  assert.ok((await call(a, 'place:set', { place: 'arena' })).ok);
  const ready = waitFor(a, 'spar:ready');
  assert.ok((await call(b, 'place:set', { place: 'arena' })).ok);
  assert.equal((await ready).toPid, jb.you);
  const actualInvite = waitFor(b, 'pk:invited');
  assert.ok((await call(a, 'pk:invite', { toPid: jb.you, mode: 'balanced' })).ok);
  assert.equal((await actualInvite).from.pid, ja.you);
});

test('chặn mời khác khu và tôn trọng lời từ chối', async t => {
  const srv = await startServer(); t.after(() => srv.stop());
  const a = await connect(srv.port), b = await connect(srv.port);
  t.after(() => { a.close(); b.close(); });
  await join(a, 'Dao Huu A', 'spar-room-c-00001');
  const jb = await join(b, 'Dao Huu B', 'spar-room-d-00001');
  await call(b, 'scene', 'yard');
  assert.equal((await call(a, 'spar:invite', { toPid: jb.you })).ok, false);
  // Người khác mời vì mỗi người có giới hạn tốc độ riêng.
  await call(a, 'scene', 'yard');
  const hit = waitFor(a, 'spar:invited');
  assert.ok((await call(b, 'spar:invite', { toPid: 1 })).ok);
  const i = await hit, declined = waitFor(b, 'spar:declined');
  assert.ok((await call(a, 'spar:respond', { id: i.id, accept: false })).ok);
  await declined;
});
