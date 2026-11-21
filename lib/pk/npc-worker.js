'use strict';
/*
 * Luồng phụ tính nước đi nặng của NPC (mức Toàn lực, ma trận 2 lượt, ~40 ms hoặc hơn mỗi lượt) để không chặn vòng lặp chính.
 * Nhận { id, snap, side } (ảnh chụp Duel từ NPC.snapshot), trả { id, plan } hoặc { id, error }. Không dùng rng.
 */
const { parentPort } = require('worker_threads');
const NPC = require('./npc');

parentPort.on('message', msg => {
  const id = msg && msg.id;
  try {
    parentPort.postMessage({ id, plan: NPC.plan(NPC.restore(msg.snap), msg.side) });
  } catch (e) {
    parentPort.postMessage({ id, error: String(e && e.message || e) });
  }
});
