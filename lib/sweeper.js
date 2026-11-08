'use strict';
// Gặp Tảo Địa Tăng là một sự kiện do máy chủ quyết định, không nhận dữ liệu xuất hiện từ client.
const crypto = require('crypto');
function createSweeper({ now = Date.now, random = Math.random, id = () => crypto.randomBytes(12).toString('hex'), chance = 1 / 1000 } = {}) {
  let active = null, nextRoll = now() + 60000;
  function current() { return active && now() < active.until ? { ...active } : null; }
  function tick() {
    const t = now();
    if (active && t >= active.until) { active = null; return { changed: true, event: null }; }
    if (!active && t >= nextRoll) {
      nextRoll = t + 60000;
      if (random() < chance) {
        active = { id: id(), x: 0.5, z: 0.55, until: t + 120000 };
        return { changed: true, event: current() };
      }
    }
    return { changed: false, event: current() };
  }
  return { current, tick };
}
module.exports = { createSweeper };
