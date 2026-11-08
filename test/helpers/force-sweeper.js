'use strict';
// Chỉ nạp trong tiến trình server của bài kiểm thử, không có đường bật từ game.
const mod = require('../../lib/sweeper');
mod.createSweeper = () => {
  const event = { id: '1234567890abcdef12345678', x: 0.5, z: 0.55, until: Date.now() + 120000 };
  return { current: () => Date.now() < event.until ? { ...event } : null, tick: () => ({ changed: false }) };
};
