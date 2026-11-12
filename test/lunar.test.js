'use strict';
// Kiểm lịch âm (public/js/lunar.js): Tết 1900–2100, tháng nhuận, múi giờ trước 1968, khứ hồi, can chi, tiết khí.
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const Lunar = require('../public/js/lunar.js');

// Mùng Một Tết (mmdd) của từng năm dương 1900..2100: UTC+8 trước 1968, UTC+7 từ 1968.
// ĐÃ đối chiếu (bằng tay / so bản cũ), chưa đủ 201 năm:
//  - Tết Trung Hoa (HKO, Baidu Baike, nongli.info) 1900–1967: khớp trừ ngoại lệ do quy ước UTC+8 thuần
//    (KH §2.3): 1903, 1916 (Trung Hoa 3/2, ở đây 4/2), 1935, 1965 lệch một ngày so với UTC+7.
//    1900–1928 không đổi sang giờ Bắc Kinh (~UTC+7:46): thử đổi sửa Tết 1916 nhưng làm sai tháng
//    nhuận 1917 và 1922, nên giữ UTC+8 (chờ chủ dự án chốt).
//  - 1968–2100: thuật toán cũ UTC+7 (bản nền) 0 Tết lệch; mốc 1968 theo QĐ 121-CP (8/8/1967).
//  - 1968, 1985, 2007, 2017–2030 đã kiểm tay với bảng Hồ Ngọc Đức.
// CHƯA xong: đối chiếu đủ 201 năm với một nguồn độc lập tải được (ví dụ gói lunardate/bảng HKO);
// môi trường thợ không có mạng. Bảng dưới vẫn do thuật toán sinh ra, nên test này là hồi quy,
// không phải bằng chứng đúng tuyệt đối.
const TET = [
  '0131 0219 0208 0129 0216 0204 0125 0213 0202 0122',
  '0210 0130 0218 0206 0126 0214 0204 0123 0211 0201',
  '0220 0208 0128 0216 0205 0124 0213 0202 0123 0210',
  '0130 0217 0206 0126 0214 0204 0124 0211 0131 0219',
  '0208 0127 0215 0205 0125 0213 0202 0122 0210 0129',
  '0217 0206 0127 0214 0203 0124 0212 0131 0218 0208',
  '0128 0215 0205 0125 0213 0202 0121 0209 0129 0216',
  '0206 0127 0215 0203 0123 0211 0131 0218 0207 0128',
  '0216 0205 0125 0213 0202 0121 0209 0129 0217 0206',
  '0127 0215 0204 0123 0210 0131 0219 0207 0128 0216',
  '0205 0124 0212 0201 0122 0209 0129 0217 0207 0126',
  '0214 0203 0123 0210 0131 0219 0208 0128 0216 0205',
  '0125 0212 0201 0122 0210 0129 0217 0206 0126 0213',
  '0202 0123 0211 0131 0219 0208 0128 0215 0204 0124',
  '0212 0201 0122 0210 0130 0217 0206 0126 0214 0202',
  '0123 0211 0201 0218 0208 0128 0215 0204 0124 0212',
  '0202 0121 0209 0129 0217 0205 0126 0214 0203 0123',
  '0211 0131 0219 0207 0127 0215 0205 0124 0212 0202',
  '0122 0209 0129 0217 0206 0126 0214 0203 0124 0210',
  '0130 0218 0207 0127 0215 0205 0125 0212 0201 0121',
  '0209',
].join(' ').split(' ');

const iso = (d) => `${d[2]}-${String(d[1]).padStart(2, '0')}-${String(d[0]).padStart(2, '0')}`;

test('lunar: require ở Node trả thẳng API', () => {
  for (const f of ['toLunar', 'toSolar', 'describe', 'canChiNgay', 'canChiThang', 'canChiGio', 'napAm', 'solarTerms']) {
    assert.equal(typeof Lunar[f], 'function', f);
  }
});

test('lunar: Mùng Một Tết 1900–2100 khớp bảng', () => {
  assert.equal(TET.length, 201);
  for (let y = 1900; y <= 2100; y++) {
    const mm = Number(TET[y - 1900].slice(0, 2)), dd = Number(TET[y - 1900].slice(2));
    assert.deepEqual(Lunar.toLunar(dd, mm, y), [1, 1, y, 0], `Tết ${y}`);
    assert.deepEqual(Lunar.toSolar(1, 1, y, 0), [dd, mm, y], `toSolar Tết ${y}`);
  }
});

test('lunar: các Tết quen thuộc', () => {
  const known = { 1968: '1968-01-29',2000: '2000-02-05', 1985: '1985-01-21', 2007: '2007-02-17', 2017: '2017-01-28', 2020: '2020-01-25', 2024: '2024-02-10', 2025: '2025-01-29', 2026: '2026-02-17', 2030: '2030-02-02' }; // 1985, 2007, 2030: lệch Trung Quốc vì Việt Nam dùng UTC+7
  for (const [y, s] of Object.entries(known)) assert.equal(iso(Lunar.toSolar(1, 1, Number(y), 0)), s, y);
});

test('lunar: trước 1968 dùng UTC+8, 4 ngày lệch cả năm so với UTC+7', () => {
  // Với UTC+7 (bản cũ) các ngày này đã là Mùng Một Tết; với UTC+8 vẫn là 30 tháng Chạp, hôm sau mới là Tết.
  for (const [d, m, y] of [[28, 1, 1903], [3, 2, 1916], [3, 2, 1935], [1, 2, 1965]]) {
    assert.deepEqual(Lunar.toLunar(d, m, y), [30, 12, y - 1, 0], `${d}/${m}/${y}`);
    assert.deepEqual(Lunar.toSolar(1, 1, y, 0), Lunar.fromJdn(Lunar.jdn(d, m, y) + 1), `Tết ${y} lùi một ngày`);
  }
});

test('lunar: hồi quy 4 ngày bản cũ trả "ngày 0" và ngày sóc 9/12/2072', () => {
  assert.deepEqual(Lunar.toLunar(19, 4, 1939), [30, 2, 1939, 0]);
  assert.deepEqual(Lunar.toLunar(22, 3, 1947), [30, 2, 1947, 0]);
  assert.deepEqual(Lunar.toLunar(7, 5, 2054), [30, 3, 2054, 0]);
  assert.deepEqual(Lunar.toLunar(9, 4, 2062), [30, 2, 2062, 0]);
  // Hồi quy theo mô hình ΔT đã chọn, không khẳng định chắc chắn ngày sóc sát nửa đêm.
  assert.deepEqual(Lunar.toLunar(9, 12, 2072), [1, 11, 2072, 0]);
  assert.deepEqual(Lunar.toLunar(15, 11, 2077), [1, 10, 2077, 0]);
});

test('lunar: 12 trung khí đúng tên', () => {
  const names = Lunar.solarTerms(2025).filter((x) => x.zhongqi).map((x) => x.name);
  assert.deepEqual(names, ['Đại hàn', 'Vũ thủy', 'Xuân phân', 'Cốc vũ', 'Tiểu mãn', 'Hạ chí',
    'Đại thử', 'Xử thử', 'Thu phân', 'Sương giáng', 'Tiểu tuyết', 'Đông chí']);
});

test('lunar: tháng nhuận 2017–2033', () => {
  const leaps = { 2017: 6, 2020: 4, 2023: 2, 2025: 6, 2028: 5, 2031: 3, 2033: 11 };
  for (let y = 2017; y <= 2033; y++) {
    const found = [];
    for (let m = 1; m <= 12; m++) if (Lunar.toSolar(1, m, y, 1)) found.push(m);
    assert.deepEqual(found, leaps[y] ? [leaps[y]] : [], `năm ${y}`);
  }
  // 2025: 1/6 nhuận là ngày dương 25/7/2025
  assert.deepEqual(Lunar.toSolar(1, 6, 2025, 1), [25, 7, 2025]);
  assert.deepEqual(Lunar.toLunar(25, 7, 2025), [1, 6, 2025, 1]);
});

test('lunar: khứ hồi dương → âm → dương mọi ngày 1900–2100, độ dài tháng 29/30', () => {
  const start = Lunar.jdn(1, 1, 1900), end = Lunar.jdn(31, 12, 2100);
  let prev = null;
  for (let j = start; j <= end; j++) {
    const [d, m, y] = Lunar.fromJdn(j);
    const l = Lunar.toLunar(d, m, y);
    assert.ok(l[0] >= 1 && l[0] <= 30, `ngày âm ${l} của ${d}/${m}/${y}`);
    assert.deepEqual(Lunar.toSolar(l[0], l[1], l[2], l[3]), [d, m, y], `${d}/${m}/${y}`);
    if (prev) {
      // ngày âm tăng 1, hoặc về 1 sau tháng 29/30 ngày
      if (l[0] === 1) assert.ok(prev[0] === 29 || prev[0] === 30, `cuối tháng ${prev} → ${l}`);
      else assert.equal(l[0], prev[0] + 1);
    }
    prev = l;
  }
});

test('lunar: toSolar từ chối ngày/tháng không có', () => {
  assert.equal(Lunar.toSolar(30, 1, 2026, 0) === null, Lunar.monthLength(1, 2026, 0) < 30);
  assert.equal(Lunar.toSolar(31, 1, 2026, 0), null);
  assert.equal(Lunar.toSolar(1, 6, 2026, 1), null); // 2026 không nhuận
});

test('lunar: từ chối đầu vào sai và giữ năm âm 1899', () => {
  for (const bad of [NaN, Infinity, -Infinity, 1.5, '1', null]) {
    assert.equal(Lunar.toSolar(bad, 1, 2025, 0), null);
    assert.equal(Lunar.toSolar(1, bad, 2025, 0), null);
    assert.equal(Lunar.toSolar(1, 1, bad, 0), null);
    assert.equal(Lunar.monthLength(bad, 2025, 0), 0);
    assert.equal(Lunar.monthLength(1, bad, 0), 0);
    assert.equal(Lunar.toLunar(1, 1, bad), null);
  }
  for (const year of [1898, 2101]) {
    assert.equal(Lunar.toSolar(1, 1, year, 0), null);
    assert.equal(Lunar.monthLength(1, year, 0), 0);
  }
  assert.equal(Lunar.toLunar(29, 2, 2025), null);
  assert.equal(Lunar.toLunar(1, 1, 1899), null);
  assert.deepEqual(Lunar.toSolar(1, 12, 1899, 0), [1, 1, 1900]);
});

test('lunar: đầu vào từng gây treo kết thúc trong tiến trình con', () => {
  const code = `const l = require('./public/js/lunar');
    if (l.toSolar(1, 1, NaN, 0) !== null || l.toSolar(1, 1, Infinity, 0) !== null ||
        l.monthLength(1, NaN, 0) !== 0 || l.toLunar(1, 1, NaN) !== null) process.exit(1);`;
  const child = spawnSync(process.execPath, ['-e', code], { cwd: require('node:path').join(__dirname, '..'), timeout: 3000 });
  assert.ifError(child.error);
  assert.equal(child.status, 0, child.stderr.toString());
});

test('lunar: can chi năm/tháng/ngày/giờ', () => {
  assert.equal(Lunar.canChiNam(2026).name, 'Bính Ngọ');
  assert.equal(Lunar.canChiNam(1984).name, 'Giáp Tý');
  // 1/1/2000 là ngày Mậu Ngọ
  assert.equal(Lunar.canChiNgay(Lunar.jdn(1, 1, 2000)).name, 'Mậu Ngọ');
  // 29/1/2025 (Mùng Một Tết Ất Tỵ) là ngày Mậu Tuất
  assert.equal(Lunar.canChiNgay(Lunar.jdn(29, 1, 2025)).name, 'Mậu Tuất');
  // Năm Giáp: tháng Giêng Bính Dần; năm Ất: Mậu Dần; tháng 11 năm Giáp: Bính Tý
  assert.equal(Lunar.canChiThang(1, 1984).name, 'Bính Dần');
  assert.equal(Lunar.canChiThang(1, 1985).name, 'Mậu Dần');
  assert.equal(Lunar.canChiThang(11, 1984).name, 'Bính Tý');
  assert.equal(Lunar.canChiThang(12, 1984).name, 'Đinh Sửu');
  // Ngày Giáp: giờ Tý là Giáp Tý; ngày Kỷ (Giáp lệch 5): cũng Giáp Tý
  const giap = Lunar.jdn(1, 1, 2000) - 4; // Mậu → Giáp cách 4 ngày
  assert.equal(Lunar.canChiNgay(giap).can, 0);
  assert.equal(Lunar.canChiGio(giap, 0).name, 'Giáp Tý');
  assert.equal(Lunar.canChiGio(giap, 12).name, 'Canh Ngọ');
  // Giờ Tý muộn 23h: chi Tý, can theo ngày kế tiếp (Giáp → Ất → Bính Tý)
  assert.equal(Lunar.canChiGio(giap, 23).name, 'Bính Tý');
  assert.equal(Lunar.canChiGio(giap, 1).chi, 1);
  assert.equal(Lunar.canChiGio(giap, 22).chi, 11);
});

test('lunar: nạp âm 60 hoa giáp', () => {
  assert.equal(Lunar.napAm(Lunar.canChiNam(1984)), 'Hải Trung Kim'); // Giáp Tý
  assert.equal(Lunar.napAm(1, 1), 'Hải Trung Kim'); // Ất Sửu
  assert.equal(Lunar.napAm(Lunar.canChiNam(2026)), 'Thiên Hà Thủy'); // Bính Ngọ
  assert.equal(Lunar.napAm(Lunar.canChiNam(2024)), 'Phú Đăng Hỏa'); // Giáp Thìn
  assert.equal(Lunar.napAm(9, 11), 'Đại Hải Thủy'); // Quý Hợi
  assert.equal(Lunar.napAm(0, 1), ''); // Giáp Sửu không tồn tại
  const seen = new Set();
  for (let i = 0; i < 60; i++) seen.add(Lunar.napAm(i % 10, i % 12));
  assert.equal(seen.size, 30);
});

test('lunar: 24 tiết khí', () => {
  const t = Lunar.solarTerms(2025);
  assert.equal(t.length, 24);
  assert.equal(t[0].name, 'Tiểu hàn');
  assert.equal(t.filter((x) => x.zhongqi).length, 12);
  const byName = Object.fromEntries(t.map((x) => [x.name, x]));
  assert.deepEqual([byName['Lập xuân'].d, byName['Lập xuân'].m], [3, 2]);
  assert.deepEqual([byName['Xuân phân'].d, byName['Xuân phân'].m], [20, 3]);
  assert.deepEqual([byName['Hạ chí'].d, byName['Hạ chí'].m], [21, 6]);
  assert.deepEqual([byName['Đông chí'].d, byName['Đông chí'].m], [21, 12]);
  for (let i = 1; i < 24; i++) assert.ok(t[i].jdn > t[i - 1].jdn);
  assert.equal(Lunar.solarTermOf(5, 2, 2025).name, 'Lập xuân');
  assert.equal(Lunar.solarTermOf(1, 1, 2025).name, 'Đông chí');
});

test('lunar: describe giữ định dạng đầu trang', () => {
  // 29/1/2025 03:00 giờ VN = Mùng Một Tết Ất Tỵ
  const ms = Date.UTC(2025, 0, 28, 20, 0, 0);
  const d = Lunar.describe(ms);
  assert.equal(d.solar, 'Thứ tư 29/1/2025');
  assert.equal(d.lunar, 'Mùng 1 tháng 1 năm Ất Tỵ');
  assert.equal(d.holy, true);
  assert.equal(d.next, 'Hôm nay là Mùng Một');
  const r = Lunar.describe(Date.UTC(2025, 1, 12, 5, 0, 0)); // 12/2/2025 = Rằm
  assert.equal(r.lunar, 'Rằm tháng 1 năm Ất Tỵ');
  const n = Lunar.describe(Date.UTC(2025, 1, 1, 5, 0, 0)); // 1/2/2025 = 4/1
  assert.equal(n.lunar, 'Mùng 4 tháng 1 năm Ất Tỵ');
  assert.equal(n.next, 'Còn 11 ngày đến Rằm');
  const leap = Lunar.describe(Date.UTC(2025, 6, 25, 5, 0, 0));
  assert.equal(leap.lunar, 'Mùng 1 tháng 6 nhuận năm Ất Tỵ');
  assert.equal(typeof Lunar.describe().lunar, 'string');
});
