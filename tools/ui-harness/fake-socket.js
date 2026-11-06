/*
 * Socket giả cho trang thử giao diện. Dùng như socket.io-client:
 *   const socket = new FakeSocket({ 'tu:start': (data) => ({ ok: true, session: {...} }) });
 *   socket.on('tu:update', fn);
 *   socket.emit('tu:start', data, ack)   → gọi handler đã khai báo (có thể trả Promise), rồi gọi ack(kết quả)
 *   socket.receive('pk:turn', payload)   → giả lập máy chủ gửi sự kiện xuống
 *   socket.sent                          → mảng { event, data } đã gửi, để kiểm tra
 */
(function (root) {
  'use strict';
  class FakeSocket {
    constructor(handlers) { this.handlers = handlers || {}; this.listeners = {}; this.sent = []; this.connected = true; this.latency = 30; }
    on(ev, fn) { (this.listeners[ev] = this.listeners[ev] || []).push(fn); return this; }
    off(ev, fn) { this.listeners[ev] = (this.listeners[ev] || []).filter(f => f !== fn); return this; }
    emit(ev, ...args) {
      const ack = typeof args[args.length - 1] === 'function' ? args.pop() : null, data = args[0];
      this.sent.push({ event: ev, data });
      const h = this.handlers[ev];
      if (!ack) { if (h) Promise.resolve(h(data, this)); return this; }
      setTimeout(async () => {
        try { ack(h ? await h(data, this) : { ok: false, reason: 'Chưa giả lập sự kiện ' + ev }); } catch (e) { ack({ ok: false, reason: String(e && e.message || e) }); }
      }, this.latency);
      return this;
    }
    receive(ev, payload) { (this.listeners[ev] || []).slice().forEach(fn => fn(payload)); }
  }
  root.FakeSocket = FakeSocket;
})(window);
