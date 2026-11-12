'use strict';
/*
 * Elo và điều kiện xếp hạng của Kỳ Đạo (KH §5.6, quyết định D6).
 * Hàm thuần: không socket, không timer, không I/O. Thời gian truyền vào qua `now`.
 * Không ném lỗi: giá trị lạ được đưa về mức an toàn (xem num()).
 *
 * Công thức: expected = 1 / (1 + 10^((Rđối - Rmình) / 400)); mới = cũ + K × (điểm - expected).
 * Điểm: thắng 1, hòa 0,5, thua 0. Làm tròn số nguyên, sàn 100.
 * K: 40 khi dưới 20 ván; 20 khi dưới 2000 Elo; 10 từ 2000 trở lên (xét theo ván và Elo TRƯỚC ván này).
 *
 * Lưu ý: hàm không ném lỗi, nhưng update() có thể ném nếu đầu vào không hợp lệ
 * (ví dụ: toString không phải function). Gọi hàm nên bọc try/catch.
 */

const START = 1200;            // Elo khởi điểm
const FLOOR = 100;             // sàn Elo
const PEAK_FROM = 20;          // peak chỉ cập nhật khi số ván xếp hạng (sau ván này) ≥ 20
const PROVISIONAL_BELOW = 10;  // dưới 10 ván: hiện dấu "?" (tạm tính)
const PAIR_DAY_CAP = 3;        // mỗi cặp, mỗi môn, mỗi ngày tối đa 3 ván xếp hạng

// Chuỗi hoặc số lạ → số hữu hạn, nếu không được thì dùng mặc định.
function num(x, def) {
  if (x === null || x === undefined || x === '') return def;
  const n = Number(x);
  return Number.isFinite(n) ? n : def;
}

// Kiểm tra minPlies hợp lệ (phải là số ≥ 0)
function isValidMinPlies(minPlies) {
  const n = num(minPlies);
  return Number.isInteger(n) && n >= 0;
}

function clamp01(x) {
  return Math.min(1, Math.max(0, num(x, 0.5)));
}

// K theo số ván xếp hạng (n) và Elo (r) trước ván.
function kFactor(n, r) {
  if (n < 20) return 40;
  if (r < 2000) return 20;
  return 10;
}

// Xác suất thắng kỳ vọng của bên có Elo r trước đối thủ có Elo rDoi.
function expected(r, rDoi) {
  return 1 / (1 + Math.pow(10, (rDoi - r) / 400));
}

/*
 * update({ ra, rb, na, nb, score })
 *   ra, rb: Elo trước ván; na, nb: số ván xếp hạng trước ván; score: điểm của bên A (1, 0,5 hoặc 0).
 * Trả { ra, rb, ka, kb }: Elo mới của hai bên (số nguyên, ≥ 100) và K đã dùng.
 */
function update({ ra, rb, na, nb, score } = {}) {
  const A = num(ra, START), B = num(rb, START);
  const NA = Math.max(0, num(na, 0)), NB = Math.max(0, num(nb, 0));
  const s = clamp01(score);
  const ka = kFactor(NA, A), kb = kFactor(NB, B);
  const ea = expected(A, B), eb = expected(B, A);
  const newA = Math.max(FLOOR, Math.round(A + ka * (s - ea)));
  const newB = Math.max(FLOOR, Math.round(B + kb * ((1 - s) - eb)));
  return { ra: newA, rb: newB, ka, kb };
}

/*
 * eligible({ rated, aIsAccount, bIsAccount, plies, minPlies, pairToday, googleEnabled })
 *   rated: chủ bàn chọn "Xếp hạng"; aIsAccount/bIsAccount: cả hai là tài khoản (khi bật Google);
 *   plies: số nửa nước đã đi; minPlies: số nửa nước tối thiểu của môn (KH §5.5);
 *   pairToday: số ván xếp hạng đã có của cặp này, môn này, trong ngày (do bên gọi đếm);
 *   googleEnabled: Google đã bật (mặc định true nếu không truyền).
 * Trả { ok:true } hoặc { ok:false, reason } (tiếng Việt).
 */
function eligible({ rated, aIsAccount, bIsAccount, plies, minPlies, pairToday, googleEnabled } = {}) {
  const googleOn = num(googleEnabled, 1) !== 0;

  if (!rated) {
    // Ván giao hữu: luôn được (dù Google bật hay tắt)
    return { ok: true };
  }

  // Ván xếp hạng:
  // Khi Google bật: cả hai phải là tài khoản. Khi Google tắt: bỏ qua kiểm tra tài khoản (D6).
  if (googleOn && (!aIsAccount || !bIsAccount)) return { ok: false, reason: 'Chỉ tính Elo giữa hai tài khoản.' };

  const need = Math.max(0, num(minPlies, 0));
  if (!isValidMinPlies(minPlies)) return { ok: false, reason: 'Số nước tối thiểu không hợp lệ.' };
  if (num(plies, 0) < need) return { ok: false, reason: 'Ván chưa đủ số nước tối thiểu để xếp hạng, nên không tính Elo.' };
  if (num(pairToday, 0) >= PAIR_DAY_CAP) return { ok: false, reason: 'Cặp này đã đủ ' + PAIR_DAY_CAP + ' ván xếp hạng trong ngày ở môn này; ván này thành giao hữu.' };
  return { ok: true };
}

// Hồ sơ mới của một người ở một môn.
function newStat() {
  return { r: START, peak: null, peakAt: null, n: 0, w: 0, l: 0, d: 0, last: null };
}

/*
 * applyResult(stat, { newR, score, now }) → hồ sơ mới (không sửa stat cũ).
 *   newR: Elo mới đã tính bằng update(); score: điểm của chính người này; now: mốc thời gian của ván.
 * peak chỉ đổi khi số ván sau ván này ≥ 20 và Elo mới cao hơn peak hiện có.
 * Tiền điều kiện: stat phải là object hợp lệ (có r, n, w, l, d) hoặc null.
 */
function applyResult(stat, { newR, score, now } = {}) {
  const s = stat || newStat();
  const n = s.n + 1;
  const r = Math.max(FLOOR, Math.round(num(newR, s.r)));
  const sc = clamp01(score);
  const out = {
    r,
    peak: s.peak,
    peakAt: s.peakAt,
    n,
    w: s.w + (sc === 1 ? 1 : 0),
    l: s.l + (sc === 0 ? 1 : 0),
    d: s.d + (sc !== 1 && sc !== 0 ? 1 : 0),
    last: num(now, s.last),
  };
  if (n >= PEAK_FROM && (out.peak === null || r > out.peak)) {
    out.peak = r;
    out.peakAt = out.last;
  }
  return out;
}

// Dấu "tạm tính" khi chưa đủ số ván (n là số ván đã xếp hạng).
function isProvisional(n) {
  return num(n, 0) < PROVISIONAL_BELOW;
}

module.exports = {
  START, FLOOR, PEAK_FROM, PROVISIONAL_BELOW, PAIR_DAY_CAP,
  kFactor, expected, update, eligible, newStat, applyResult, isProvisional,
};
