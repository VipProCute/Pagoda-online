'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { startServer } = require('./helpers/live');
const { connect, call, join } = require('./helpers/client');
const { chase } = require('./helpers/npc-chase');
const ACTORS = require('../public/js/actors');

test('gặp cao nhân: máy chủ kiểm tra vị trí, chống cộng trùng và giữ thưởng sau khởi động lại', async t => {
  const srv = await startServer({ NODE_OPTIONS: '--require=' + path.join(__dirname, 'helpers', 'force-sweeper.js') });
  t.after(() => srv.stop());
  let a = await connect(srv.port); t.after(() => a.close());
  const intro = await join(a, 'Nguoi Tu', 'sweeper-test-user-123');
  assert.ok(intro.sweeper);
  const id = intro.sweeper.id;
  assert.equal((await call(a, 'sweeper:claim', { id: 'aaaaaaaaaaaaaaaaaaaaaaaa' })).ok, false);
  assert.equal((await call(a, 'sweeper:claim', { id })).ok, false, 'ngoài Tàng Kinh Các');
  assert.equal((await call(a, 'scene', 'library')).ok, true);
  // Tảo Địa Tăng đi lang thang theo mã sự kiện: đứng ở lối vào (0,5; 0,9) mà NPC đang xa thì máy chủ báo far
  const seed = ACTORS.seedOf(id), area = ACTORS.SWEEPER.area;
  if (ACTORS.distanceTo(seed, area, 0.5, 0.9, Date.now()) > ACTORS.TALK_RANGE + 0.08) assert.equal((await call(a, 'sweeper:claim', { id })).code, 'far');
  const reward = await chase(a, seed, area, 'sweeper:claim', { id });
  assert.equal(reward.ok, true, reward.reason);
  assert.equal(reward.gain, 60);
  assert.equal(reward.level, 2);
  assert.equal((await call(a, 'sweeper:claim', { id })).already, true);
  assert.equal((await call(a, 'martial:state', {})).profile.congLuc, 60);
  a.close(); await srv.restart();
  a = await connect(srv.port);
  await join(a, 'Nguoi Tu', 'sweeper-test-user-123');
  assert.equal((await call(a, 'martial:state', {})).profile.congLuc, 60);
  await call(a, 'scene', 'library');
  assert.equal((await chase(a, seed, area, 'sweeper:claim', { id })).already, true);
  assert.equal((await call(a, 'martial:state', {})).profile.congLuc, 60);
});
