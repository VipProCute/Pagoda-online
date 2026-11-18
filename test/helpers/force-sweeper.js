'use strict';
// Chỉ nạp trong tiến trình server của bài kiểm thử, không có đường bật từ game.
// Mỗi lần khởi động máy chủ, cao nhân lại đứng ở Tàng Kinh Các với cùng mã sự kiện cho tới khi được nhận.
const mod = require('../../lib/sweeper');
mod.createSweeper = () => {
  const event = { id: '1234567890abcdef12345678', x: 0.5, z: 0.55, at: Date.now(), until: Date.now() + mod.STAY_MS };
  let gone = false;
  return {
    current: () => gone ? null : { ...event },
    tick: () => ({ changed: false, event: gone ? null : { ...event } }),
    release: id => { if (gone || id !== event.id) return false; gone = true; return true; }
  };
};
