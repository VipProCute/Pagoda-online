'use strict';
// Đầu-cuối: luận võ với NPC Hắc Phong Ma Khách trên server.js thật; trận không đụng thắng / thua PK.
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer } = require('./helpers/live');
const { connect, call, join, waitFor } = require('./helpers/client');

test('luận võ với Hắc Phong Ma Khách: chỉ ở Sân đấu, đánh hết trận, ghi riêng ngoài thành tích PK', async t => {
  const srv = await startServer({ PK_TIME_SCALE: '0.05' });
  t.after(() => srv.stop());
  const socket = await connect(srv.port);
  t.after(() => socket.close());
  assert.equal((await join(socket, 'Người Thử', 'npc-e2e-user-1')).ok, true);
  assert.equal((await call(socket, 'pk:npc', { level: 2 })).code, 'place', 'ngoài Sân đấu thì từ chối');
  assert.equal((await call(socket, 'place:set', { place: 'arena' })).ok, true);
  assert.equal((await call(socket, 'pk:npc', { level: 7 })).ok, false);

  const lobby = waitFor(socket, 'pk:lobby');
  const r = await call(socket, 'pk:npc', { level: 1 });
  assert.equal(r.ok, true, r.reason);
  const L = await lobby;
  assert.equal(L.op.name, 'Hắc Phong Ma Khách');
  assert.equal(L.npc.level, 1);
  const turn = waitFor(socket, 'pk:turn');
  assert.equal((await call(socket, 'pk:loadout', { matchId: r.matchId, skills: L.you.loadout })).ok, true);
  await turn;
  // để hết giờ mọi lượt (đứng yên): 3 lượt liền quá giờ thì thua, trận kết thúc
  const end = await waitFor(socket, 'pk:end', () => true, 30000);
  assert.ok(end.npc);
  assert.equal(end.result, 'lose');
  assert.deepEqual(end.record, { wins: 0, losses: 0, draws: 0 }, 'thành tích PK không đổi');
  assert.deepEqual(end.npc.record, { wins: 0, losses: 1, draws: 0 });
  const st = await call(socket, 'martial:state', {});
  assert.equal(st.profile.losses, 0);
});
