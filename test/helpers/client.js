'use strict';
/* Trợ giúp socket.io-client cho test e2e. Chỉ xuất hàm. */
const { io } = require('socket.io-client');

/** Kết nối và ghi lại mọi sự kiện nhận được vào socket.log = [{ ev, payload, at }]. */
function connect(port, opts = {}) {
  return new Promise((resolve, reject) => {
    const socket = io(`http://127.0.0.1:${port}`, { transports: ['websocket'], forceNew: true, reconnection: false, ...opts });
    socket.log = [];
    socket.onAny((ev, payload) => socket.log.push({ ev, payload, at: Date.now() }));
    socket.once('connect', () => resolve(socket));
    socket.once('connect_error', reject);
  });
}
/** Gửi sự kiện có ack, trả Promise của kết quả (quá 5 giây thì lỗi). */
const call = (socket, ev, data) => new Promise((resolve, reject) => {
  socket.timeout(5000).emit(ev, data, (err, res) => (err ? reject(new Error(`Hết giờ chờ ack của ${ev}`)) : resolve(res)));
});
/** Vào chánh điện. uid cố định để vào lại được cùng hồ sơ. */
const join = (socket, name, uid) => call(socket, 'join', { name, look: { g: 'nam', c: 1, h: 0 }, uid });
/** Chờ sự kiện thỏa điều kiện (xét cả các sự kiện đã nhận trước đó trong socket.log nếu includePast). */
function waitFor(socket, ev, pred = () => true, ms = 8000, includePast = false) {
  return new Promise((resolve, reject) => {
    if (includePast) { const hit = socket.log.find(x => x.ev === ev && pred(x.payload)); if (hit) return resolve(hit.payload); }
    const t = setTimeout(() => { socket.off(ev, h); reject(new Error(`Hết giờ chờ ${ev}`)); }, ms);
    function h(payload) { if (pred(payload)) { clearTimeout(t); socket.off(ev, h); resolve(payload); } }
    socket.on(ev, h);
  });
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

module.exports = { connect, call, join, waitFor, sleep };
