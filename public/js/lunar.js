/* Lịch âm Việt Nam · viết độc lập từ công thức thiên văn công khai.
 *
 * Nguồn công thức: Jean Meeus, "Astronomical Algorithms" (2nd ed.):
 *  - chương 49: thời điểm trăng mới (các số hạng chu kỳ và hiệu chỉnh hành tinh);
 *  - chương 25: kinh độ biểu kiến của Mặt Trời (độ chính xác thấp, đủ cho ngày);
 *  - ΔT: các đa thức Espenak & Meeus (NASA) cho 1900–2150.
 * Quy tắc lịch: ngày bắt đầu tại nửa đêm giờ địa phương; tháng bắt đầu từ ngày
 * có trăng mới; tháng 11 là tháng chứa Đông chí; năm có 13 tháng thì tháng nhuận
 * là tháng đầu tiên (sau tháng 11) không có trung khí.
 * Múi giờ: UTC+8 trước 1968-01-01, UTC+7 từ 1968 (lịch Việt Nam).
 * Quy ước và giới hạn (cho T-054/T-055 và tài liệu tử vi):
 *  - Mốc 1968 theo QĐ 121-CP (8/8/1967) và Thông tư 01-VLĐC-1967: múi giờ 7 từ 1/1/1968, tức là
 *    theo miền Bắc. Miền Nam dùng UTC+8 đến 1975 nên Tết 1968 ở miền Nam là 30/1 (ở đây là 29/1);
 *    lá số người sinh ở miền Nam 1968–1975 có thể lệch một ngày âm quanh ngày sóc.
 *  - 1900–1928 dùng UTC+8 thuần. Lịch Trung Hoa thời đó dùng giờ địa phương Bắc Kinh (~UTC+7:46),
 *    nên lệch lịch Trung Hoa chính thống một số ngày (ví dụ Tết 1916: ở đây 4/2, Trung Hoa 3/2).
 *    Chưa quyết đổi sang giờ Bắc Kinh: chờ chủ dự án.
 *  - Hai tháng có trăng mới sát nửa đêm giờ Việt Nam (9/12/2072 lúc 23:58:48 và 15/11/2077 lúc
 *    23:59:50) nhỏ hơn sai số ΔT ngoại suy: kết quả hai tháng này không chắc chắn.
 *  - canChiThang không nhận tháng nhuận: tháng nhuận lấy can chi của tháng chính liền trước.
 * Chỉ dùng lịch Gregorian (phạm vi 1900–2100). Không đụng DOM ở mức module.
 *
 * API: toLunar(d,m,y) → [ngày, tháng, năm, nhuận(0|1)] · toSolar(ld,lm,ly,leap) → [d,m,y] | null
 *      jdn(d,m,y) · canChiNam/Thang/Ngay/Gio · napAm · solarTerms(năm) · solarTermOf(d,m,y) · describe()
 */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module && module.exports) module.exports = api;
  else root.Lunar = api;
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  const RAD = Math.PI / 180;
  const SYNODIC = 29.530588861;
  const JDN_1968 = jdnFromDate(1, 1, 1968);

  // ---- Ngày Julius (lịch Gregorian) ----
  function jdnFromDate(d, m, y) {
    const a = Math.floor((14 - m) / 12), yy = y + 4800 - a, mm = m + 12 * a - 3;
    return d + Math.floor((153 * mm + 2) / 5) + 365 * yy + Math.floor(yy / 4) - Math.floor(yy / 100) + Math.floor(yy / 400) - 32045;
  }
  function dateFromJdn(j) {
    const a = j + 32044, b = Math.floor((4 * a + 3) / 146097), c = a - Math.floor(146097 * b / 4);
    const d = Math.floor((4 * c + 3) / 1461), e = c - Math.floor(1461 * d / 4), m = Math.floor((5 * e + 2) / 153);
    return [e - Math.floor((153 * m + 2) / 5) + 1, m + 3 - 12 * Math.floor(m / 10), 100 * b + d - 4800 + Math.floor(m / 10)];
  }
  const mod = (a, n) => ((a % n) + n) % n;
  // Múi giờ áp dụng cho một ngày (theo số ngày JDN)
  const tzOfDay = (j) => (j < JDN_1968 ? 8 : 7);

  // ---- ΔT = TT − UT (giây), Espenak & Meeus ----
  function deltaT(year) {
    const y = year;
    let t;
    if (y < 1920) { t = y - 1900; return -2.79 + 1.494119 * t - 0.0598939 * t * t + 0.0061966 * t ** 3 - 0.000197 * t ** 4; }
    if (y < 1941) { t = y - 1920; return 21.20 + 0.84493 * t - 0.076100 * t * t + 0.0020936 * t ** 3; }
    if (y < 1961) { t = y - 1950; return 29.07 + 0.407 * t - t * t / 233 + t ** 3 / 2547; }
    if (y < 1986) { t = y - 1975; return 45.45 + 1.067 * t - t * t / 260 - t ** 3 / 718; }
    if (y < 2005) { t = y - 2000; return 63.86 + 0.3345 * t - 0.060374 * t * t + 0.0017275 * t ** 3 + 0.000651814 * t ** 4 + 0.00002373599 * t ** 5; }
    if (y < 2050) { t = y - 2000; return 62.92 + 0.32217 * t + 0.005589 * t * t; }
    const u = (y - 1820) / 100;
    return -20 + 32 * u * u - 0.5628 * (2150 - y);
  }
  // Năm thập phân gần đúng từ JD
  const yearOfJd = (jd) => 2000 + (jd - 2451545) / 365.25;

  // ---- Trăng mới thứ k (k = 0 ↔ trăng mới đầu 2000-01-06), trả JDE (TT) ----
  const NM_TERMS = [
    // [hệ số, mũ E, M, M', F, Ω]
    [-0.40720, 0, 0, 1, 0, 0], [0.17241, 1, 1, 0, 0, 0], [0.01608, 0, 0, 2, 0, 0], [0.01039, 0, 0, 0, 2, 0],
    [0.00739, 1, -1, 1, 0, 0], [-0.00514, 1, 1, 1, 0, 0], [0.00208, 2, 2, 0, 0, 0], [-0.00111, 0, 0, 1, -2, 0],
    [-0.00057, 0, 0, 1, 2, 0], [0.00056, 1, 1, 2, 0, 0], [-0.00042, 0, 0, 3, 0, 0], [0.00042, 1, 1, 0, 2, 0],
    [0.00038, 1, 1, 0, -2, 0], [-0.00024, 1, -1, 2, 0, 0], [-0.00017, 0, 0, 0, 0, 1], [-0.00007, 0, 2, 1, 0, 0],
    [0.00004, 0, 0, 2, -2, 0], [0.00004, 0, 3, 0, 0, 0], [0.00003, 0, 1, 1, -2, 0], [0.00003, 0, 0, 2, 2, 0],
    [-0.00003, 0, 1, 1, 2, 0], [0.00003, 0, -1, 1, 2, 0], [-0.00002, 0, -1, 1, -2, 0], [-0.00002, 0, 1, 3, 0, 0],
    [0.00002, 0, 0, 4, 0, 0],
  ];
  // [pha đầu, tốc độ theo k, biên độ]
  const NM_PLANET = [
    [299.77, 0.107408, 0.000325], [251.88, 0.016321, 0.000165], [251.83, 26.651886, 0.000164], [349.42, 36.412478, 0.000126],
    [84.66, 18.206239, 0.000110], [141.74, 53.303771, 0.000062], [207.14, 2.453732, 0.000060], [154.84, 7.306860, 0.000056],
    [34.52, 27.261239, 0.000047], [207.19, 0.121824, 0.000042], [291.34, 1.844379, 0.000040], [161.72, 24.198154, 0.000037],
    [239.56, 25.513099, 0.000035], [331.55, 3.592518, 0.000023],
  ];
  const nmCache = new Map();
  function newMoonJDE(k) {
    if (nmCache.has(k)) return nmCache.get(k);
    const T = k / 1236.85, T2 = T * T, T3 = T2 * T, T4 = T3 * T;
    let jde = 2451550.09766 + SYNODIC * k + 0.00015437 * T2 - 0.000000150 * T3 + 0.00000000073 * T4;
    const E = 1 - 0.002516 * T - 0.0000074 * T2;
    const M = (2.5534 + 29.10535670 * k - 0.0000014 * T2 - 0.00000011 * T3) * RAD;
    const Mp = (201.5643 + 385.81693528 * k + 0.0107582 * T2 + 0.00001238 * T3 - 0.000000058 * T4) * RAD;
    const F = (160.7108 + 390.67050284 * k - 0.0016118 * T2 - 0.00000227 * T3 + 0.000000011 * T4) * RAD;
    const Om = (124.7746 - 1.56375588 * k + 0.0020672 * T2 + 0.00000215 * T3) * RAD;
    for (const [c, e, a, b, f, o] of NM_TERMS) {
      jde += c * (e === 0 ? 1 : e === 1 ? E : E * E) * Math.sin(a * M + b * Mp + f * F + o * Om);
    }
    for (let i = 0; i < NM_PLANET.length; i++) {
      const [p0, v, amp] = NM_PLANET[i];
      let A = p0 + v * k;
      if (i === 0) A -= 0.009173 * T2;
      jde += amp * Math.sin(A * RAD);
    }
    nmCache.set(k, jde);
    return jde;
  }
  // Số ngày (JDN địa phương) của ngày có trăng mới thứ k
  function newMoonDay(k) {
    const jde = newMoonJDE(k);
    const ut = jde - deltaT(yearOfJd(jde)) / 86400;
    const d8 = Math.floor(ut + 0.5 + 8 / 24);
    if (d8 < JDN_1968) return d8;
    return Math.floor(ut + 0.5 + 7 / 24);
  }
  // k gần đúng của trăng mới gần JDN cho trước
  const kOfJdn = (j) => Math.floor((j - 2451550.09766) / SYNODIC);

  // ---- Kinh độ biểu kiến của Mặt Trời (độ, 0..360) tại JDE ----
  function sunLongitude(jde) {
    const T = (jde - 2451545) / 36525, T2 = T * T;
    const L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T2;
    const M = (357.52911 + 35999.05029 * T - 0.0001537 * T2) * RAD;
    const C = (1.914602 - 0.004817 * T - 0.000014 * T2) * Math.sin(M) + (0.019993 - 0.000101 * T) * Math.sin(2 * M) + 0.000289 * Math.sin(3 * M);
    const om = (125.04 - 1934.136 * T) * RAD;
    return mod(L0 + C - 0.00569 - 0.00478 * Math.sin(om), 360);
  }
  // Cung 30° (0..11) của Mặt Trời lúc 0 giờ địa phương của ngày j
  function sunSector(j) {
    const ut = j - 0.5 - tzOfDay(j) / 24;
    return Math.floor(sunLongitude(ut + deltaT(yearOfJd(ut)) / 86400) / 30);
  }

  // ---- Dựng danh sách tháng từ Đông chí năm Y-1 đến Đông chí năm Y ----
  // Trả về { starts:[...n+1 ngày bắt đầu], months:[{m, leap, year, start, len}] }
  const winterCache = new Map();
  // Ngày bắt đầu tháng chứa Đông chí (Mặt Trời vào cung 270°) của năm dương y
  function winterStart(y) {
    if (winterCache.has(y)) return winterCache.get(y);
    // Tìm ngày đầu tháng w sao cho cung Mặt Trời đầu ngày tháng sau đã qua 270° và đầu tháng w thì chưa
    let k = kOfJdn(jdnFromDate(31, 12, y)) + 1;
    let res = 0;
    for (let i = 0; i < 4; i++, k--) {
      const s = newMoonDay(k), nx = newMoonDay(k + 1);
      // tháng [s, nx) chứa Đông chí ⇔ đầu ngày s Mặt Trời chưa tới 270° (cung ≤ 8) và đầu ngày nx đã qua (cung ≥ 9)
      // (không đòi nx đúng cung 9 hay s đúng cung 8: một tháng có thể kéo qua nhiều cung)
      if (sunSector(s) <= 8 && sunSector(nx) >= 9) { res = s; break; }
    }
    winterCache.set(y, res);
    return res;
  }
  const yearCache = new Map();
  function buildYear(Y) {
    if (yearCache.has(Y)) return yearCache.get(Y);
    const a = winterStart(Y - 1), b = winterStart(Y);
    if (!a || !b || b <= a) throw new RangeError('Không tìm được biên Đông chí');
    const starts = [a];
    let k = kOfJdn(a);
    while (newMoonDay(k) < a) k++;
    while (newMoonDay(k) > a) k--;
    for (; starts[starts.length - 1] < b; k++) starts.push(newMoonDay(k + 1));
    // phần tử cuối trùng b
    const n = starts.length - 1;
    let leapIdx = -1;
    if (n === 13) {
      for (let i = 1; i < n; i++) {
        if (sunSector(starts[i]) === sunSector(starts[i + 1])) { leapIdx = i; break; }
      }
    }
    const months = [];
    let num = 11;
    for (let i = 0; i < n; i++) {
      let leap = 0;
      if (i === leapIdx) leap = 1;
      else if (i > 0) num = num === 12 ? 1 : num + 1;
      months.push({ m: num, leap, year: num >= 11 ? Y - 1 : Y, start: starts[i], len: starts[i + 1] - starts[i] });
    }
    const out = { months };
    yearCache.set(Y, out);
    return out;
  }

  // ---- Đổi dương → âm ----
  function toLunarJdn(j) {
    const y = dateFromJdn(j)[2];
    const Y = j < winterStart(y) ? y : y + 1;
    const ms = buildYear(Y).months;
    for (let i = ms.length - 1; i >= 0; i--) {
      if (ms[i].start <= j) return [j - ms[i].start + 1, ms[i].m, ms[i].year, ms[i].leap];
    }
    return [0, 0, 0, 0];
  }
  function toLunar(d, m, y) {
    if (!Number.isInteger(y) || y < 1900 || y > 2100 || !Number.isInteger(m) || m < 1 || m > 12 ||
        !Number.isInteger(d) || d < 1 || d > 31) return null;
    const j = jdnFromDate(d, m, y);
    const date = dateFromJdn(j);
    if (date[0] !== d || date[1] !== m || date[2] !== y) return null;
    return toLunarJdn(j);
  }

  // Năm âm 1899 cần cho những ngày đầu năm dương 1900.
  const validLunarMonth = (lm, ly) => Number.isInteger(ly) && ly >= 1899 && ly <= 2100 &&
    Number.isInteger(lm) && lm >= 1 && lm <= 12;

  // ---- Đổi âm → dương; sai (tháng không có / ngày vượt độ dài) trả null ----
  function toSolar(ld, lm, ly, leap) {
    if (!validLunarMonth(lm, ly) || !Number.isInteger(ld) || ld < 1 || ld > 30) return null;
    leap = leap ? 1 : 0;
    for (const Y of [ly, ly + 1]) {
      for (const mo of buildYear(Y).months) {
        if (mo.year === ly && mo.m === lm && mo.leap === leap) {
          if (ld < 1 || ld > mo.len) return null;
          return dateFromJdn(mo.start + ld - 1);
        }
      }
    }
    return null;
  }
  function monthLength(lm, ly, leap) {
    if (!validLunarMonth(lm, ly)) return 0;
    for (const Y of [ly, ly + 1]) {
      for (const mo of buildYear(Y).months) if (mo.year === ly && mo.m === lm && mo.leap === (leap ? 1 : 0)) return mo.len;
    }
    return 0;
  }

  // ---- Can chi ----
  const CAN = ['Giáp', 'Ất', 'Bính', 'Đinh', 'Mậu', 'Kỷ', 'Canh', 'Tân', 'Nhâm', 'Quý'];
  const CHI = ['Tý', 'Sửu', 'Dần', 'Mão', 'Thìn', 'Tỵ', 'Ngọ', 'Mùi', 'Thân', 'Dậu', 'Tuất', 'Hợi'];
  const mk = (can, chi) => ({ can, chi, name: CAN[can] + ' ' + CHI[chi] });
  const canChiNam = (ly) => mk(mod(ly + 6, 10), mod(ly + 8, 12));
  // Tháng âm lm (1 = Dần) của năm âm ly
  const canChiThang = (lm, ly) => mk(mod(2 * mod(ly + 6, 10) + 2 + (lm - 1), 10), mod(lm + 1, 12));
  const canChiNgay = (j) => mk(mod(j + 9, 10), mod(j + 1, 12));
  // Giờ (0–23) của ngày j. Giờ Tý muộn (23h) tính can theo ngày kế tiếp (ngũ thử độn);
  // ngày âm lịch vẫn giữ nguyên.
  function canChiGio(j, hour) {
    const chi = Math.floor((hour + 1) / 2) % 12;
    const dayCan = mod(j + 9, 10) + (hour === 23 ? 1 : 0);
    return mk(mod(2 * dayCan + chi, 10), chi);
  }
  // ---- Nạp âm theo 60 hoa giáp ----
  const NAP_AM = ['Hải Trung Kim', 'Lô Trung Hỏa', 'Đại Lâm Mộc', 'Lộ Bàng Thổ', 'Kiếm Phong Kim', 'Sơn Đầu Hỏa',
    'Giản Hạ Thủy', 'Thành Đầu Thổ', 'Bạch Lạp Kim', 'Dương Liễu Mộc', 'Tuyền Trung Thủy', 'Ốc Thượng Thổ',
    'Tích Lịch Hỏa', 'Tùng Bách Mộc', 'Trường Lưu Thủy', 'Sa Trung Kim', 'Sơn Hạ Hỏa', 'Bình Địa Mộc',
    'Bích Thượng Thổ', 'Kim Bạch Kim', 'Phú Đăng Hỏa', 'Thiên Hà Thủy', 'Đại Trạch Thổ', 'Thoa Xuyến Kim',
    'Tang Đố Mộc', 'Đại Khê Thủy', 'Sa Trung Thổ', 'Thiên Thượng Hỏa', 'Thạch Lựu Mộc', 'Đại Hải Thủy'];
  // Nhận {can, chi} hoặc (can, chi); can và chi phải cùng chẵn lẻ
  function napAm(can, chi) {
    if (can && typeof can === 'object') { chi = can.chi; can = can.can; }
    if ((can - chi) % 2 !== 0) return '';
    for (let i = 0; i < 60; i++) if (i % 10 === can && i % 12 === chi) return NAP_AM[i >> 1];
    return '';
  }

  // ---- 24 tiết khí ----
  const TERMS = ['Xuân phân', 'Thanh minh', 'Cốc vũ', 'Lập hạ', 'Tiểu mãn', 'Mang chủng', 'Hạ chí', 'Tiểu thử',
    'Đại thử', 'Lập thu', 'Xử thử', 'Bạch lộ', 'Thu phân', 'Hàn lộ', 'Sương giáng', 'Lập đông', 'Tiểu tuyết',
    'Đại tuyết', 'Đông chí', 'Tiểu hàn', 'Đại hàn', 'Lập xuân', 'Vũ thủy', 'Kinh trập']; // chỉ số = kinh độ / 15
  // JDE khi Mặt Trời tới kinh độ lon trong năm dương y
  function termJde(y, lon) {
    const est = jdnFromDate(20, 3, y) + (lon >= 285 ? lon - 360 : lon) / 360 * 365.2422;
    let lo = est - 20, hi = est + 20;
    const f = (jde) => mod(sunLongitude(jde) - lon + 180, 360) - 180;
    for (let i = 0; i < 60; i++) { const mid = (lo + hi) / 2; if (f(mid) < 0) lo = mid; else hi = mid; }
    return (lo + hi) / 2;
  }
  // Ngày địa phương (JDN) của tiết khí
  function termDay(y, lon) {
    const jde = termJde(y, lon);
    const ut = jde - deltaT(yearOfJd(jde)) / 86400;
    const d8 = Math.floor(ut + 0.5 + 8 / 24);
    return d8 < JDN_1968 ? d8 : Math.floor(ut + 0.5 + 7 / 24);
  }
  // 24 tiết của năm dương y, từ Tiểu hàn (tháng 1) đến Đông chí (tháng 12)
  function solarTerms(y) {
    const out = [];
    for (let i = 0; i < 24; i++) {
      const lon = mod(285 + 15 * i, 360), jdn = termDay(y, lon);
      const [d, m, yy] = dateFromJdn(jdn);
      out.push({ name: TERMS[lon / 15], lon, jdn, d, m, y: yy, zhongqi: lon % 30 === 0 });
    }
    return out;
  }
  // Tiết khí đang là của ngày d/m/y (tiết gần nhất đã qua)
  function solarTermOf(d, m, y) {
    const j = jdnFromDate(d, m, y);
    let best = null;
    for (const yy of [y - 1, y]) for (const t of solarTerms(yy)) if (t.jdn <= j && (!best || t.jdn > best.jdn)) best = t;
    return best;
  }

  // ---- Hiển thị đầu trang ----
  const WD = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];
  // Ngày theo giờ Việt Nam (UTC+7)
  function vnDate(ms) { const d = new Date((ms === undefined ? Date.now() : ms) + 7 * 3600e3); return { d: d.getUTCDate(), m: d.getUTCMonth() + 1, y: d.getUTCFullYear(), wd: d.getUTCDay() }; }
  function describe(ms) {
    const t = vnDate(ms);
    const j = jdnFromDate(t.d, t.m, t.y);
    const [ld, lm, ly, leap] = toLunarJdn(j);
    const dayName = ld === 15 ? 'Rằm' : (ld <= 10 ? 'Mùng ' + ld : 'Ngày ' + ld);
    const year = canChiNam(ly).name;
    let next = '';
    if (ld === 1 || ld === 15) next = 'Hôm nay là ' + (ld === 1 ? 'Mùng Một' : 'Rằm');
    else for (let i = 1; i < 32; i++) {
      const xd = toLunarJdn(j + i)[0];
      if (xd === 1 || xd === 15) { next = `Còn ${i} ngày đến ${xd === 1 ? 'Mùng Một' : 'Rằm'}`; break; }
    }
    return { solar: `${WD[t.wd]} ${t.d}/${t.m}/${t.y}`, lunar: `${dayName} tháng ${lm}${leap ? ' nhuận' : ''} năm ${year}`, next, holy: ld === 1 || ld === 15 };
  }

  return {
    toLunar, toSolar, describe, monthLength,
    jdn: jdnFromDate, fromJdn: dateFromJdn,
    canChiNam, canChiThang, canChiNgay, canChiGio, napAm,
    solarTerms, solarTermOf, CAN, CHI, NAP_AM, TERMS,
  };
});
