'use strict';
// NPC cơ duyên đi lang thang: máy chủ tự tính vị trí theo giờ (public/js/actors.js), không tin toạ độ client gửi.
const test = require('node:test');
const assert = require('node:assert/strict');
const ACTORS = require('../public/js/actors');
const { startServer } = require('./helpers/live');
const { connect, call, join, sleep } = require('./helpers/client');
const { chase } = require('./helpers/npc-chase');

test('NPC cơ duyên đi lang thang: ở xa thì máy chủ báo far kèm chỗ NPC đang đứng, đuổi kịp thì được trò chuyện', async t => {
  const srv = await startServer();
  t.after(() => srv.stop());
  const a = await connect(srv.port); t.after(() => a.close());
  await join(a, 'Nguoi Tu', 'npc-wander-test-user-1');
  const ask = role => call(a, 'martial:secret-encounter', { role });
  assert.equal((await ask('constructor')).ok, false, 'vai lạ bị từ chối');
  assert.equal((await call(a, 'martial:secret-encounter', { role: { toString: 1 } })).ok, false, 'dữ liệu lạ bị từ chối');
  assert.equal((await ask('wanderer')).reason, 'Không tìm thấy người này tại đây.', 'đang ở chánh điện, Vạn Lý Độc Hành ở sân chùa');
  assert.equal((await call(a, 'scene', 'yard')).ok, true);
  // góc sau cùng bên trái sân: luôn ngoài tầm trò chuyện vì NPC chỉ đi trong vùng FLOOR
  a.emit('move', { x: 0.03, z: 0.12 });
  await sleep(4600);
  const f = ACTORS.FORTUNE_NPCS.wanderer, far = await ask('wanderer');
  assert.equal(far.code, 'far');
  const now = ACTORS.wanderAt(f.seed, f.area, Date.now());
  assert.ok(Math.hypot((far.x - now.x) * ACTORS.X_WEIGHT, far.z - now.z) < 0.05, 'máy chủ trả đúng chỗ NPC đang đứng');
  // đuổi theo NPC: tới gần thì máy chủ thôi báo far (người mới chưa đủ điều kiện nhận bí kíp nên trả 'conditions')
  const near = await chase(a, f.seed, f.area, 'martial:secret-encounter', { role: 'wanderer' });
  assert.ok(near && near.code !== 'far', 'đuổi kịp NPC đang đi');
  assert.equal(near.ok, false);
  assert.equal(near.code, 'conditions');
});
