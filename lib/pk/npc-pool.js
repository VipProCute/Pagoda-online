'use strict';
/*
 * Hồ luồng phụ (worker_threads) cho NPC Hắc Phong mức Toàn lực. Tạo luồng khi cần, unref (không giữ tiến trình sống),
 * luồng sập thì bỏ và lần sau tạo lại. Mỗi luồng làm một việc một lúc; việc chờ xếp hàng tối đa `maxQueue`,
 * quá thì từ chối ngay (code 'busy') để manager hạ xuống cách tính nhẹ, không để máy chủ nghẽn.
 * plan(snap, side) trả Promise<kế hoạch>; lỗi / quá giờ thì reject (code 'error' | 'timeout' | 'busy' | 'closed').
 */
const path = require('path');

const WORKER_FILE = path.join(__dirname, 'npc-worker.js');

function createNpcPool(opts) {
  opts = opts || {};
  const size = Math.max(1, Math.min(4, Math.floor(Number(opts.size)) || 1));
  const timeoutMs = Number(opts.timeoutMs) > 0 ? Number(opts.timeoutMs) : 8000;
  const maxQueue = Number.isFinite(Number(opts.maxQueue)) && Number(opts.maxQueue) >= 0 ? Math.floor(Number(opts.maxQueue)) : 12;
  // spawn tiêm được để test (mặc định: worker_threads thật).
  const spawn = typeof opts.spawn === 'function' ? opts.spawn : () => new (require('worker_threads').Worker)(WORKER_FILE);
  const slots = [];            // { w, job }
  const queue = [];            // job chờ
  let seq = 0, closed = false;

  const reject = (job, code, msg) => {
    clearTimeout(job.timer);
    const e = new Error(msg); e.code = code; job.reject(e);
  };

  function drop(slot) {
    const i = slots.indexOf(slot);
    if (i >= 0) slots.splice(i, 1);
    try { slot.w.removeAllListeners(); slot.w.on('error', () => {}); slot.w.terminate(); } catch (_) { /* nuốt */ }
  }

  function make() {
    const w = spawn();
    const slot = { w, job: null };
    if (w.unref) w.unref();
    w.on('message', msg => {
      const job = slot.job;
      if (!job || !msg || msg.id !== job.id) return;      // trả lời của việc đã quá giờ: bỏ
      slot.job = null;
      if (msg.error) reject(job, 'error', msg.error);
      else { clearTimeout(job.timer); job.resolve(msg.plan); }
      pump();
    });
    const died = e => {
      const job = slot.job; slot.job = null;
      drop(slot);
      if (job) reject(job, 'error', 'Luồng NPC sập: ' + (e && e.message || e || 'thoát'));
      pump();
    };
    w.on('error', died);
    w.on('exit', died);
    slots.push(slot);
    return slot;
  }

  function pump() {
    while (queue.length && !closed) {
      let slot = slots.find(s => !s.job);
      if (!slot && slots.length < size) slot = make();
      if (!slot) return;
      const job = queue.shift();
      slot.job = job;
      job.timer = setTimeout(() => {
        if (slot.job === job) { slot.job = null; drop(slot); reject(job, 'timeout', 'NPC tính quá lâu'); pump(); }
      }, timeoutMs);
      if (job.timer.unref) job.timer.unref();
      try { slot.w.postMessage({ id: job.id, snap: job.snap, side: job.side }); } catch (e) {
        slot.job = null; drop(slot); reject(job, 'error', String(e && e.message || e));
      }
    }
  }

  function plan(snap, side) {
    return new Promise((resolve, rej) => {
      if (closed) { const e = new Error('Hồ luồng đã đóng'); e.code = 'closed'; return rej(e); }
      const busy = slots.filter(s => s.job).length;
      if (busy >= size && queue.length >= maxQueue) { const e = new Error('Hàng chờ NPC đã đầy'); e.code = 'busy'; return rej(e); }
      queue.push({ id: ++seq, snap, side, resolve, reject: rej, timer: null });
      pump();
    });
  }

  function close() {
    closed = true;
    for (const job of queue.splice(0)) reject(job, 'closed', 'Hồ luồng đã đóng');
    for (const slot of slots.slice()) { const job = slot.job; slot.job = null; drop(slot); if (job) reject(job, 'closed', 'Hồ luồng đã đóng'); }
  }

  return { plan, close, stats: () => ({ workers: slots.length, busy: slots.filter(s => s.job).length, queued: queue.length }) };
}

module.exports = { createNpcPool };
