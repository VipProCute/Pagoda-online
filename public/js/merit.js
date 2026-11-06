/*
 * Công đức: pháp tướng sau lưng khi công đức cao, quỷ theo sau khi công đức âm.
 * Dùng chung cho máy chủ (khi nào báo cho mọi người) và trình duyệt (vẽ, bảng luật).
 * Tính theo công đức TẤT CẢ (tổng), không phải công đức hôm nay.
 *
 * Pháp tướng công đức khác hào quang cúng dường (public/js/aura.js):
 *  - Pháp tướng là “vật” sau lưng (vòng, vương miện, cánh, kiếm, rồng, thánh luân), còn mãi khi công đức còn đủ mốc.
 *  - Hào quang cúng dường là ánh sáng quanh thân, sáng vài phút.
 *  - Có cả hai thì hào quang nhuộm màu lên viền và ngọc của pháp tướng, hai lớp sáng cùng nhau.
 */
(function (root) {
  'use strict';
  const RANKS = [
    { n: 1, min: 100, name: 'Linh Quang Hoàn', desc: 'Vòng linh quang vàng sau đầu, kết ngọc bích', color: '#ffe08a' },
    { n: 2, min: 500, name: 'Thanh Liên Bảo Quan', desc: 'Vương miện sen pha lê xanh ngọc tỏa sau đầu', color: '#8fe8d8' },
    { n: 3, min: 1000, name: 'Kim Diễm Song Dực', desc: 'Đôi cánh lửa vàng, vòng phù văn xoay', color: '#ffc94d', spin: true },
    { n: 4, min: 5000, name: 'Vạn Kiếm Quy Tông', desc: 'Bánh xe kiếm bạch kim xoay sau lưng', color: '#eef4ff', spin: true },
    { n: 5, min: 10000, name: 'Kim Long Pháp Tướng', desc: 'Pháp luân rồng vàng hoa văn son, hai vòng xoay ngược', color: '#ff9a5c', spin: true },
    { n: 6, min: 50000, name: 'Cửu Tiêu Thánh Luân', desc: 'Thánh luân chín tầng trời, cánh ngũ sắc', color: '#fff6d8', spin: true }
  ];
  const DEMONS = [
    { n: 1, at: -1, name: 'Tiểu Quỷ', desc: 'Bóng quỷ nhỏ mắt đỏ lẽo đẽo theo sau. Hiện mờ từ khi công đức âm, rõ hẳn ở −100.' },
    { n: 2, at: -200, name: 'Ác Quỷ', desc: 'Quỷ có sừng, cánh dơi, nanh vuốt.' },
    { n: 3, at: -500, name: 'Quỷ Vương', desc: 'Quỷ vương đội vương miện sừng, lửa đen bao quanh.' },
    { n: 4, at: -1000, name: 'Ma Vương', desc: 'Bóng ma vương khổng lồ ba mắt, cao hơn cả người.' }
  ];
  // Cách cộng công đức (máy chủ dùng đúng các con số này)
  const EARN = { heart: 1, mo: 1, rejoice: 1, bow: 2, bell: 3, offer: 5, chantStart: 5, incense: 10, chantJoin: 15, perVnd: 1000 };

  function rankOf(mt) { let r = 0; for (const x of RANKS) if (mt >= x.min) r = x.n; return r; }
  function demonOf(mt) {
    if (!(mt < 0)) return null;
    let n = 1; for (const d of DEMONS) if (mt <= d.at) n = d.n;
    return { n, alpha: Math.max(0.12, Math.min(1, 0.12 + 0.88 * (-mt) / 100)) };   // −100 là rõ hẳn
  }
  /** Khóa hình ảnh: chỉ báo cho cả chánh điện khi khóa này đổi (đỡ tốn băng thông). */
  function visualKey(mt) {
    if (mt >= 0) return 'r' + rankOf(mt);
    const d = demonOf(mt);
    return 'd' + d.n + ':' + Math.min(10, Math.ceil(-mt / 10));
  }
  function nextRank(mt) { const r = RANKS.find(x => x.min > mt); return r ? { rank: r, need: r.min - mt } : null; }

  const api = { RANKS, DEMONS, EARN, rankOf, demonOf, visualKey, nextRank };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.MERIT = api;
})(this);
