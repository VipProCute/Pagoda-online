/*
 * Hào quang cúng dường: 9 cảnh giới như truyện tu tiên.
 * Dùng chung cho máy chủ (tính mốc, cộng dồn) và trình duyệt (vẽ, bảng mốc).
 *
 * Luật:
 *  - Chỉ tính khi nhà chùa đã xác nhận nhận tiền (admin bấm Xác nhận, hoặc SePay báo).
 *  - Cộng dồn: còn hào quang thì số tiền mới cộng vào số cũ, đủ mốc thì lên cảnh giới.
 *    Ví dụ 3 lần 20.000đ = 60.000đ, lên Trúc Cơ (mốc 50.000đ).
 *  - Mỗi lần cúng dường, hào quang tỏa sáng lại từ đầu trong thời gian của cảnh giới hiện tại:
 *    mốc 1 được 5 phút, mốc 2 được 6 phút… mốc 9 được 13 phút. Hết giờ thì tắt, cộng dồn về 0.
 *  - Số tiền chưa tới mốc 1 (ví dụ 10.000đ) vẫn được giữ 5 phút để cộng dồn.
 */
(function (root) {
  'use strict';
  const MIN = 60e3;
  const TIERS = [
    { n: 1, min: 20000, name: 'Luyện Khí', desc: 'Khí lành quấn quanh thân', color: '#bfe6d4' },
    { n: 2, min: 50000, name: 'Trúc Cơ', desc: 'Đài sen vàng dưới chân', color: '#f1d78a' },
    { n: 3, min: 100000, name: 'Kim Đan', desc: 'Kim đan sáng nơi đan điền, vầng sáng trên đầu', color: '#ffc94d' },
    { n: 4, min: 200000, name: 'Nguyên Anh', desc: 'Nguyên anh bay vòng quanh, tia sáng tỏa ra', color: '#f2a6ff' },
    { n: 5, min: 500000, name: 'Hóa Thần', desc: 'Thần quang xanh bốc lên như lửa', color: '#8fd3ff' },
    { n: 6, min: 1000000, name: 'Luyện Hư', desc: 'Vòng hư không đầy sao bao quanh', color: '#b39cff' },
    { n: 7, min: 2000000, name: 'Hợp Thể', desc: 'Ngũ hành châu xoay quanh thân', color: '#7fe3b4' },
    { n: 8, min: 5000000, name: 'Đại Thừa', desc: 'Kim quang rực rỡ, cột sáng, hoa sen nở', color: '#ffd36b' },
    { n: 9, min: 10000000, name: 'Độ Kiếp', desc: 'Lôi kiếp giáng xuống, hào quang ngũ sắc', color: '#ffffff' }
  ].map(t => Object.assign(t, { ms: (4 + t.n) * MIN }));

  /** Cảnh giới ứng với tổng tiền đang cộng dồn (0 = chưa tới mốc). */
  function tierOf(amount) {
    let t = 0;
    for (const x of TIERS) if (amount >= x.min) t = x.n;
    return t;
  }

  /** Cộng thêm một lượt cúng dường đã xác nhận. prev: { amount, tier, until } hoặc null. */
  function stack(prev, amount, now) {
    const alive = !!(prev && prev.until > now);
    const total = (alive ? prev.amount : 0) + Math.max(0, amount);
    const tier = tierOf(total);
    const before = alive ? prev.tier : 0;
    return { amount: total, tier, until: now + (tier ? TIERS[tier - 1].ms : TIERS[0].ms), up: tier > before, before };
  }

  /** Còn bao nhiêu tiền nữa để lên cảnh giới kế tiếp (0 nếu đã cao nhất). */
  function toNext(amount) {
    const next = TIERS.find(x => x.min > amount);
    return next ? { tier: next, need: next.min - amount } : null;
  }

  const api = { TIERS, tierOf, stack, toNext };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AURA = api;
})(this);
