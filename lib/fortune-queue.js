'use strict';
const crypto = require('crypto');
// Hàng đợi dùng chung cho một tiến trình Socket.IO. Kết quả chỉ gửi riêng người xin; quẻ 1–12 rút bằng crypto.randomInt.
function createFortuneQueue({ broadcast, duration = 5000, pick = () => crypto.randomInt(1, 13) }) {
  let queue = [], current = null, timer = null;
  const snapshot = () => ({ current: current ? { id: current.id, name: current.name, endsAt: current.endsAt } : null, waiting: queue.map(p => ({ id: p.id, name: p.name })) });
  const notify = () => broadcast(snapshot());
  function start() {
    if (current || !queue.length) { notify(); return; }
    current = queue.shift(); current.endsAt = Date.now() + duration; notify();
    timer = setTimeout(() => {
      const done = current; current = null; timer = null;
      done.deliver(pick()); start();
    }, duration);
  }
  return {
    snapshot,
    join(person) { if ((current && current.id === person.id) || queue.some(p => p.id === person.id)) return false; queue.push(person); start(); return true; },
    remove(id) { const before = queue.length; queue = queue.filter(p => p.id !== id); if (current && current.id === id) { clearTimeout(timer); timer = null; current = null; start(); } else if (before !== queue.length) notify(); }
  };
}
module.exports = createFortuneQueue;
