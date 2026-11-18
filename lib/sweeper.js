'use strict';
// Gặp Tảo Địa Tăng là một sự kiện do máy chủ quyết định, không nhận dữ liệu xuất hiện từ client.
// Mỗi phút rút thăm một lần (mặc định 1/512). Khi đã xuất hiện, cao nhân đứng chờ ở Tàng Kinh Các
// cho tới khi trao xong cơ duyên cho một người (`release`), không tự rời đi theo giờ.
const crypto = require('crypto');
// Mốc "còn ở lại" gửi cho trình duyệt: rất xa trong tương lai, để mã cũ so `until > now` vẫn đúng.
const STAY_MS = 10 * 365 * 86400e3;
function createSweeper({ now = Date.now, random = Math.random, id = () => crypto.randomBytes(12).toString('hex'), chance = 1 / 512 } = {}) {
  let active = null, nextRoll = now() + 60000;
  function current() { return active ? { ...active } : null; }
  function tick() {
    const t = now();
    if (!active && t >= nextRoll) {
      nextRoll = t + 60000;
      if (random() < chance) {
        active = { id: id(), x: 0.5, z: 0.55, at: t, until: t + STAY_MS };
        return { changed: true, event: current() };
      }
    }
    return { changed: false, event: current() };
  }
  /** Cao nhân đã trao cơ duyên xong thì rời đi; lần rút kế tiếp tính từ lúc này. Trả true nếu đúng sự kiện đang có. */
  function release(eventId) {
    if (!active || active.id !== eventId) return false;
    active = null;
    nextRoll = now() + 60000;
    return true;
  }
  return { current, tick, release };
}
module.exports = { createSweeper, STAY_MS };
