'use strict';
// Đuổi theo NPC đang đi lang thang (đường đi tính bằng public/js/actors.js, cùng cách máy chủ tính).
const ACTORS = require('../../public/js/actors');
const { call, sleep } = require('./client');

/** Đi tới chỗ NPC sắp tới rồi hỏi lại tới khi máy chủ thôi báo 'far'. Trả về ack cuối cùng. */
async function chase(socket, seed, area, ev, data, tries = 20) {
  let r = null;
  for (let i = 0; i < tries; i++) {
    const at = ACTORS.wanderAt(seed, area, Date.now() + 600);
    socket.emit('move', { x: at.x, z: Math.min(0.97, at.z + 0.03) });
    await sleep(700);
    r = await call(socket, ev, data);
    if (!r || r.code !== 'far') return r;
  }
  return r;
}

module.exports = { chase };
