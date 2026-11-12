'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const TUVI = require('../public/js/tuvi.js');
const Lunar = require('../public/js/lunar.js');

const m12 = (n) => ((n % 12) + 12) % 12;

// Bộ ngẫu nhiên có hạt giống để test lặp lại được
function lcg(seed) {
  let s = seed >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}
const CHI_TEN = ['Tý', 'Sửu', 'Dần', 'Mão', 'Thìn', 'Tỵ', 'Ngọ', 'Mùi', 'Thân', 'Dậu', 'Tuất', 'Hợi'];

function randomInputs(n, seed) {
  const rnd = lcg(seed);
  const out = [];
  while (out.length < n) {
    const y = 1900 + Math.floor(rnd() * 200), m = 1 + Math.floor(rnd() * 12), d = 1 + Math.floor(rnd() * 28);
    out.push({
      date: { solar: { d, m, y } }, hour: Math.floor(rnd() * 12),
      gender: rnd() < 0.5 ? 'nam' : 'nu', viewYear: 2026,
    });
  }
  return out;
}

function posOf(chart, code) {
  const c = chart.palaces.find((p) => p.chinh.some((s) => s.code === code) || p.phu.includes(code));
  return c ? c.pos : -1;
}

test('Tử Vi: ca kiểm nhanh an Tử Vi (Thủy nhị cục)', () => {
  assert.equal(TUVI.anTuVi(2, 1), 1, 'ngày 1 → Sửu');
  assert.equal(TUVI.anTuVi(2, 2), 2, 'ngày 2 → Dần');
  const c = TUVI.chart({ date: { lunar: { d: 1, m: 1, y: 2000 } }, hour: 0, gender: 'nam', viewYear: 2026 });
  assert.equal(c.noHour, false);
});

test('Tử Vi: bảng an Tử Vi 5 Cục × 30 ngày khớp cách đếm thủ công', () => {
  // Cách đếm tay: lần lượt thử từng cung "mượn" x; x chẵn thì tiến, lẻ thì lùi
  function tay(cuc, ngay) {
    for (let x = 0; x < cuc; x++) {
      if ((ngay + x) % cuc) continue;
      const q = (ngay + x) / cuc;
      let pos = 2; // Dần
      for (let i = 1; i < q; i++) pos = (pos + 1) % 12;
      for (let i = 0; i < x; i++) pos = (pos + (x % 2 === 0 ? 1 : 11)) % 12;
      return pos;
    }
    throw new Error('không tới được');
  }
  for (const cuc of [2, 3, 4, 5, 6]) {
    for (let d = 1; d <= 30; d++) assert.equal(TUVI.anTuVi(cuc, d), tay(cuc, d), `cục ${cuc} ngày ${d}`);
  }
  // Hàng Thủy nhị cục theo bảng in: Sửu, Dần, Dần, Mão, Mão, Thìn, Thìn, Tỵ, Tỵ, Ngọ, Ngọ, Mùi, Mùi, Thân, Thân, Dậu, Dậu, Tuất, Tuất, Hợi, Hợi, Tý, Tý, Sửu, Sửu, Dần, Dần, Mão, Mão, Thìn
  const thuy2 = [1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 0, 0, 1, 1, 2, 2, 3, 3, 4];
  assert.deepEqual(Array.from({ length: 30 }, (_, i) => TUVI.anTuVi(2, i + 1)), thuy2);
  // Ngày chia hết cho cục: Tử Vi ở cung thứ (ngày / cục) tính từ Dần
  for (const cuc of [2, 3, 4, 5, 6]) for (let q = 1; 12 > q && cuc * q <= 30; q++) assert.equal(TUVI.anTuVi(cuc, cuc * q), m12(2 + q - 1));
});

test('Tử Vi: bất biến cấu trúc trên 600 lá số ngẫu nhiên', () => {
  for (const inp of randomInputs(600, 54)) {
    const c = TUVI.chart(inp);
    const tag = JSON.stringify(inp);
    // Mỗi chính tinh đúng một lần
    for (const code of TUVI.CHINH_TINH) assert.equal(c.palaces.filter((p) => p.chinh.some((s) => s.code === code)).length, 1, `${code} ${tag}`);
    assert.equal(c.palaces.reduce((n, p) => n + p.chinh.length, 0), 14);
    const t = posOf(c, 'tuvi'), p = posOf(c, 'thienphu');
    assert.equal(p, m12(4 - t), `Phủ đối xứng Tử Vi qua Dần–Thân ${tag}`);
    // Chuỗi Tử Vi (nghịch) và Thiên Phủ (thuận)
    for (const [code, off] of [['thienco', -1], ['thaiduong', -3], ['vukhuc', -4], ['thiendong', -5], ['liemtrinh', -8]]) assert.equal(posOf(c, code), m12(t + off), code);
    for (const [code, off] of [['thaiam', 1], ['thamlang', 2], ['cumon', 3], ['thientuong', 4], ['thienluong', 5], ['thatsat', 6], ['phaquan', 10]]) assert.equal(posOf(c, code), m12(p + off), code);
    // Đối xứng Tả–Hữu, Xương–Khúc, Kiếp–Không
    assert.equal(m12(posOf(c, 'taphu') + posOf(c, 'huubat')), 2);
    assert.equal(m12(posOf(c, 'vanxuong') + posOf(c, 'vankhuc')), 2);
    assert.equal(m12(posOf(c, 'diakiep') + posOf(c, 'diakhong')), 10);
    // Kình Dương và Đà La kẹp Lộc Tồn
    const loc = posOf(c, 'locton');
    assert.equal(posOf(c, 'kinhduong'), m12(loc + 1));
    assert.equal(posOf(c, 'dala'), m12(loc - 1));
    // Thiên Khôi – Thiên Việt, Hồng Loan – Thiên Hỷ đối cung
    assert.equal(m12(posOf(c, 'hongloan') + 6), posOf(c, 'thienhy'));
    // Mệnh – Thân đối xứng quanh Dần–Thân... : Mệnh + Thân = 2 × (2 + m − 1)
    assert.equal(m12(c.menhPos + c.thanPos), m12(2 * (2 + c.lunar.m - 1)));
    // 12 cung đủ, mỗi mã một lần; Mệnh đúng chỗ
    assert.deepEqual(c.palaces.map((x) => x.cung).sort(), TUVI.CUNG.slice().sort());
    assert.equal(c.palaces[c.menhPos].cung, 'menh');
    assert.equal(c.palaces.filter((x) => x.than).length, 1);
    // Tràng Sinh: đủ 12 vòng, mỗi sao một lần
    assert.deepEqual(c.palaces.map((x) => x.trangSinh).sort(), TUVI.TRANG_SINH.slice().sort());
    // Tứ Hóa: 4 sao, mỗi hóa nằm cùng cung sao được hóa
    assert.equal(c.hoa.length, 4);
    for (const hh of c.hoa) assert.ok(c.palaces[hh.pos].hoa.some((x) => x.code === hh.code && x.star === hh.star));
    // Cục thuộc {2..6} và khớp nạp âm cung Mệnh
    assert.ok([2, 3, 4, 5, 6].includes(c.cuc.so));
    // Đại vận: 12 cung, tăng đều 10 năm, bắt đầu từ số Cục tại cung Mệnh
    assert.equal(c.palaces[c.menhPos].daiVan.tu, c.cuc.so);
    const dv = c.palaces.map((x) => x.daiVan.tu).sort((a, b) => a - b);
    assert.deepEqual(dv, Array.from({ length: 12 }, (_, i) => c.cuc.so + 10 * i));
    // Tuần chiếm hai cung liền nhau, Triệt cũng vậy
    assert.equal(c.palaces.filter((x) => x.tuan).length, 2);
    assert.equal(c.palaces.filter((x) => x.triet).length, 2);
    // Độ sáng chỉ nhận M, V, Đ(D), B, H
    for (const x of c.palaces) for (const s of x.chinh) assert.match(s.sang, /^[MVDBH]$/);
  }
});

test('Tử Vi: hướng đại vận theo Âm Dương Nam Nữ', () => {
  // Năm Canh Thìn 2000 (Dương): Nam thuận, Nữ nghịch
  const nam = TUVI.chart({ date: { lunar: { d: 10, m: 5, y: 2000 } }, hour: 3, gender: 'nam', viewYear: 2026 });
  const nu = TUVI.chart({ date: { lunar: { d: 10, m: 5, y: 2000 } }, hour: 3, gender: 'nu', viewYear: 2026 });
  assert.equal(nam.amDuong, 'duong'); assert.equal(nam.thuan, true); assert.equal(nu.thuan, false);
  assert.equal(nam.palaces[m12(nam.menhPos + 1)].daiVan.tu, nam.cuc.so + 10);
  assert.equal(nu.palaces[m12(nu.menhPos - 1)].daiVan.tu, nu.cuc.so + 10);
  assert.equal(nam.menhPos, nu.menhPos);
});

test('Tử Vi: không giờ sinh → bỏ phần cần giờ, trả cờ noHour', () => {
  const c = TUVI.chart({ date: { solar: { d: 15, m: 6, y: 1990 } }, hour: null, gender: 'nu', viewYear: 2026 });
  assert.equal(c.noHour, true);
  assert.equal(c.palaces, null);
  assert.equal(c.menhPos, null);
  assert.equal(c.cuc, null);
  assert.equal(c.canChi.nam.name, 'Canh Ngọ');
  assert.ok(c.banMenh.ten);
  assert.equal(c.hoa.length, 4);
  assert.equal(c.luu.canChi, 'Bính Ngọ');
  assert.equal(c.luu.thaiTuePos, 6);
  assert.equal(c.yearStars.thienma, 8); // Ngọ → Thân
});

test('Tử Vi: lưu niên theo can chi năm xem', () => {
  const c = TUVI.chart({ date: { lunar: { d: 1, m: 1, y: 1985 } }, hour: 6, gender: 'nam', viewYear: 2026 });
  // 2026 = Bính Ngọ: Lộc Tồn ở Tỵ, Kình Ngọ, Đà Thìn, Mã ở Thân
  assert.equal(c.luu.thaiTuePos, 6);
  assert.equal(c.luu.locTonPos, 5);
  assert.equal(c.luu.kinhDuongPos, 6);
  assert.equal(c.luu.daLaPos, 4);
  assert.equal(c.luu.thienMaPos, 8);
  // Bính: Đồng Cơ Xương Liêm
  assert.deepEqual(c.luu.hoa.map((x) => x.star), ['thiendong', 'thienco', 'vanxuong', 'liemtrinh']);
  assert.equal(c.tuoi, 42);
  assert.ok(c.daiVanHienTai.tu <= 42 && 42 <= c.daiVanHienTai.den);
});

test('Tử Vi: giờ Tý 23h tính sang ngày sau (mặc định) và tắt được', () => {
  const base = { date: { solar: { d: 28, m: 2, y: 1999 } }, gender: 'nam', viewYear: 2026 };
  const a = TUVI.chart({ ...base, hour: 0, options: { hour24: 23 } });
  const b = TUVI.chart({ ...base, hour: 0, options: { hour24: 23, lateTy: false } });
  const next = TUVI.chart({ ...base, date: { solar: { d: 1, m: 3, y: 1999 } }, hour: 0 });
  assert.equal(a.lateTyShifted, true);
  assert.deepEqual(a.lunar, next.lunar);
  assert.equal(a.menhPos, next.menhPos);
  assert.equal(b.lateTyShifted, false);
  assert.equal(b.lunar.d, Lunar.toLunar(28, 2, 1999)[0]);
});

test('Tử Vi: tháng nhuận tính như tháng chính, đổi được sang quy tắc sau ngày 15', () => {
  // Nhuận tháng 6 năm 2017 (Đinh Dậu)
  const solar = Lunar.toSolar(20, 6, 2017, 1);
  assert.ok(solar, 'có tháng 6 nhuận 2017');
  const inp = { date: { lunar: { d: 20, m: 6, y: 2017 }, leap: true }, hour: 4, gender: 'nam', viewYear: 2026 };
  const a = TUVI.chart(inp);
  const chinh = TUVI.chart({ ...inp, date: { lunar: { d: 20, m: 6, y: 2017 } } });
  assert.equal(a.lunar.leap, true);
  assert.equal(a.menhPos, chinh.menhPos);
  const b = TUVI.chart({ ...inp, options: { leapRule: 'sau15' } });
  assert.equal(b.menhPos, m12(2 + 6 - 4)); // tháng 7: 2 + (7 − 1) − 4
});

test('Tử Vi: đầu vào sai ném RangeError tiếng Việt', () => {
  assert.throws(() => TUVI.chart({ date: { solar: { d: 31, m: 2, y: 2000 } }, hour: 0, gender: 'nam' }), RangeError);
  assert.throws(() => TUVI.chart({ date: { solar: { d: 1, m: 1, y: 2000 } }, hour: 12, gender: 'nam' }), RangeError);
  assert.throws(() => TUVI.chart({ date: { solar: { d: 1, m: 1, y: 2000 } }, hour: 0, gender: 'x' }), RangeError);
  assert.throws(() => TUVI.chart({ date: { lunar: { d: 31, m: 2, y: 2001 } }, hour: 0, gender: 'nam' }), RangeError);
});

test('Tử Vi: mã sao, mã cung đúng Phụ lục B', () => {
  assert.equal(TUVI.CUNG.length, 12);
  assert.equal(TUVI.CHINH_TINH.length, 14);
  assert.equal(TUVI.PHU_TINH.length, 26);
  assert.deepEqual(TUVI.TRANG_SINH.slice(0, 3), ['trangsinh', 'mocduc', 'quandoi']);
  for (const code of Object.keys(TUVI.SANG)) {
    assert.ok(TUVI.CHINH_TINH.includes(code));
    assert.equal(TUVI.SANG[code].length, 12);
  }
  assert.equal(Object.keys(TUVI.SANG).length, 14);
  const c = TUVI.chart(randomInputs(1, 7)[0]);
  const all = new Set([...TUVI.CHINH_TINH, ...TUVI.PHU_TINH, ...TUVI.TRANG_SINH]);
  for (const p of c.palaces) {
    for (const s of p.chinh) assert.ok(all.has(s.code));
    for (const s of p.phu) assert.ok(all.has(s));
    for (const s of p.hoa) assert.ok(all.has(s.code));
  }
});

test('Tử Vi: dưới 10 ms một lá số', () => {
  const inputs = randomInputs(200, 99);
  TUVI.chart(inputs[0]); // khởi động bộ nhớ đệm lịch
  const t0 = process.hrtime.bigint();
  for (const i of inputs) TUVI.chart(i);
  const ms = Number(process.hrtime.bigint() - t0) / 1e6 / inputs.length;
  assert.ok(ms < 10, `trung bình ${ms.toFixed(2)} ms`);
});

// ================= Kiểm giá trị bảng theo Phụ lục B (viết cứng, độc lập với mã) =================
const cx = (s) => { const i = CHI_TEN.indexOf(s); assert.ok(i >= 0, 'tên chi sai: ' + s); return i; };
const cxs = (s) => s.split(/[ ,]+/).filter(Boolean).map(cx);
// Năm âm lịch 1984 (Giáp Tý) + k: can = k mod 10, chi = k mod 12 → đủ 60 năm hoa giáp
const yearOf = (can, chi) => { for (let k = 0; k < 60; k++) if (k % 10 === can && k % 12 === chi) return 1984 + k; throw new Error('không có năm'); };
const chartAt = (can, chi, extra) => TUVI.chart({ date: { lunar: { d: 1, m: 1, y: yearOf(can, chi) } }, hour: 0, gender: 'nam', viewYear: 2026, ...extra });
const CAN_TEN = ['Giáp', 'Ất', 'Bính', 'Đinh', 'Mậu', 'Kỷ', 'Canh', 'Tân', 'Nhâm', 'Quý'];

test('Tử Vi: bảng an Tử Vi 5 Cục × 30 ngày khớp bảng in', () => {
  const bang = {
    2: 'Sửu,Dần,Dần,Mão,Mão,Thìn,Thìn,Tỵ,Tỵ,Ngọ,Ngọ,Mùi,Mùi,Thân,Thân,Dậu,Dậu,Tuất,Tuất,Hợi,Hợi,Tý,Tý,Sửu,Sửu,Dần,Dần,Mão,Mão,Thìn',
    3: 'Thìn,Sửu,Dần,Tỵ,Dần,Mão,Ngọ,Mão,Thìn,Mùi,Thìn,Tỵ,Thân,Tỵ,Ngọ,Dậu,Ngọ,Mùi,Tuất,Mùi,Thân,Hợi,Thân,Dậu,Tý,Dậu,Tuất,Sửu,Tuất,Hợi',
    4: 'Hợi,Thìn,Sửu,Dần,Tý,Tỵ,Dần,Mão,Sửu,Ngọ,Mão,Thìn,Dần,Mùi,Thìn,Tỵ,Mão,Thân,Tỵ,Ngọ,Thìn,Dậu,Ngọ,Mùi,Tỵ,Tuất,Mùi,Thân,Ngọ,Hợi',
    5: 'Ngọ,Hợi,Thìn,Sửu,Dần,Mùi,Tý,Tỵ,Dần,Mão,Thân,Sửu,Ngọ,Mão,Thìn,Dậu,Dần,Mùi,Thìn,Tỵ,Tuất,Mão,Thân,Tỵ,Ngọ,Hợi,Thìn,Dậu,Ngọ,Mùi',
    6: 'Dậu,Ngọ,Hợi,Thìn,Sửu,Dần,Tuất,Mùi,Tý,Tỵ,Dần,Mão,Hợi,Thân,Sửu,Ngọ,Mão,Thìn,Tý,Dậu,Dần,Mùi,Thìn,Tỵ,Sửu,Tuất,Mão,Thân,Tỵ,Ngọ',
  };
  for (const [cuc, row] of Object.entries(bang)) {
    const want = cxs(row);
    assert.equal(want.length, 30);
    assert.deepEqual(Array.from({ length: 30 }, (_, i) => TUVI.anTuVi(Number(cuc), i + 1)), want, `Cục ${cuc}`);
  }
  // Ngày 1 của 4 Cục: Thìn (Mộc 3), Hợi (Kim 4), Ngọ (Thổ 5), Dậu (Hỏa 6)
  assert.deepEqual([3, 4, 5, 6].map((c) => TUVI.anTuVi(c, 1)), cxs('Thìn Hợi Ngọ Dậu'));
});

test('Tử Vi: bảng Cục theo can năm × chi cung Mệnh (nạp âm cung Mệnh)', () => {
  // Hàng = nhóm can năm (Ngũ Hổ Độn); cột = 6 cặp chi cung Mệnh: Tý–Sửu, Dần–Mão, Thìn–Tỵ, Ngọ–Mùi, Thân–Dậu, Tuất–Hợi
  const bang = [
    { cans: [0, 5], row: [2, 6, 3, 5, 4, 6], danCan: 2 }, // Giáp, Kỷ: Dần = Bính
    { cans: [1, 6], row: [6, 5, 4, 3, 2, 5], danCan: 4 }, // Ất, Canh: Dần = Mậu
    { cans: [2, 7], row: [5, 3, 2, 4, 6, 3], danCan: 6 }, // Bính, Tân: Dần = Canh
    { cans: [3, 8], row: [3, 4, 6, 2, 5, 4], danCan: 8 }, // Đinh, Nhâm: Dần = Nhâm
    { cans: [4, 9], row: [4, 2, 5, 6, 3, 2], danCan: 0 }, // Mậu, Quý: Dần = Giáp
  ];
  for (const { cans, row, danCan } of bang) {
    for (const can of cans) {
      for (let menh = 0; menh < 12; menh++) {
        const m = ((menh - 2) % 12 + 12) % 12 + 1; // tháng sao cho giờ Tý rơi đúng cung Mệnh
        const c = TUVI.chart({ date: { lunar: { d: 5, m, y: yearOf(can, can % 2) } }, hour: 0, gender: 'nam', viewYear: 2026 });
        assert.equal(c.menhPos, menh);
        assert.equal(c.cuc.so, row[Math.floor(menh / 2)], `${CAN_TEN[can]} Mệnh ${CHI_TEN[menh]}`);
        // Can cung Mệnh theo Ngũ Hổ Độn: Dần mang can danCan, đi thuận
        assert.equal(c.palaces[menh].can, (danCan + ((menh - 2) % 12 + 12) % 12) % 10, `can cung ${CHI_TEN[menh]}`);
        assert.equal(c.palaces[2].can, danCan);
      }
    }
  }
});

test('Tử Vi: Lộc Tồn, Kình, Đà, Khôi, Việt, Triệt, Tứ Hóa đủ 10 can', () => {
  const locton = cxs('Dần Mão Tỵ Ngọ Tỵ Ngọ Thân Dậu Hợi Tý');
  const khoi = cxs('Sửu Tý Hợi Hợi Sửu Tý Ngọ Ngọ Mão Mão');
  const viet = cxs('Mùi Thân Dậu Dậu Mùi Thân Dần Dần Tỵ Tỵ');
  const triet = ['Thân Dậu', 'Ngọ Mùi', 'Thìn Tỵ', 'Dần Mão', 'Tý Sửu', 'Thân Dậu', 'Ngọ Mùi', 'Thìn Tỵ', 'Dần Mão', 'Tý Sửu'].map(cxs);
  const tuHoa = [
    'liemtrinh phaquan vukhuc thaiduong', 'thienco thienluong tuvi thaiam', 'thiendong thienco vanxuong liemtrinh',
    'thaiam thiendong thienco cumon', 'thamlang thaiam huubat thienco', 'vukhuc thamlang thienluong vankhuc',
    'thaiduong vukhuc thaiam thiendong', 'cumon thaiduong vankhuc vanxuong', 'thienluong tuvi taphu vukhuc',
    'phaquan cumon thaiam thamlang',
  ].map((s) => s.split(' '));
  for (let can = 0; can < 10; can++) {
    const chi = can % 2 === 0 ? 0 : 1; // chi cùng tính chẵn lẻ với can
    const c = chartAt(can, chi);
    const tag = CAN_TEN[can];
    assert.equal(c.sao.locton, locton[can], `Lộc Tồn ${tag}`);
    assert.equal(c.sao.kinhduong, m12(locton[can] + 1), `Kình ${tag}`);
    assert.equal(c.sao.dala, m12(locton[can] - 1), `Đà ${tag}`);
    assert.equal(c.sao.thienkhoi, khoi[can], `Khôi ${tag}`);
    assert.equal(c.sao.thienviet, viet[can], `Việt ${tag}`);
    assert.deepEqual(c.palaces.filter((p) => p.triet).map((p) => p.pos), triet[can], `Triệt ${tag}`);
    assert.deepEqual(c.hoa.map((x) => x.code), ['hoaloc', 'hoaquyen', 'hoakhoa', 'hoaky']);
    assert.deepEqual(c.hoa.map((x) => x.star), tuHoa[can], `Tứ Hóa ${tag}`);
    for (const hh of c.hoa) assert.equal(hh.pos, c.sao[hh.star], `${hh.star} ${tag}`);
  }
  // Tuỳ chọn Khoa của can Nhâm
  assert.equal(chartAt(8, 0).hoa[2].star, 'taphu');
  assert.equal(chartAt(8, 0, { options: { nhamKhoa: 'thienphu' } }).hoa[2].star, 'thienphu');
});

test('Tử Vi: Tuần theo can chi năm (vài năm cụ thể)', () => {
  const tuan = (y) => TUVI.chart({ date: { lunar: { d: 1, m: 1, y } }, hour: 0, gender: 'nam', viewYear: 2026 }).palaces.filter((p) => p.tuan).map((p) => p.pos);
  assert.deepEqual(tuan(1984), cxs('Tuất Hợi')); // Giáp Tý: tuần Giáp Tý, trống Tuất Hợi
  assert.deepEqual(tuan(1990), cxs('Tuất Hợi')); // Canh Ngọ vẫn thuộc tuần Giáp Tý
  assert.deepEqual(tuan(1994), cxs('Thân Dậu')); // Giáp Tuất: tuần Giáp Tuất, trống Thân Dậu
  assert.deepEqual(tuan(2008), cxs('Ngọ Mùi')); // Mậu Tý: tuần Giáp Thân, trống Ngọ Mùi
  assert.deepEqual(tuan(2004), cxs('Ngọ Mùi')); // Giáp Thân: đầu tuần Giáp Thân, trống Ngọ Mùi
  assert.deepEqual(tuan(1995), cxs('Thân Dậu')); // Ất Hợi: tuần Giáp Tuất
});

test('Tử Vi: Thiên Mã, Đào Hoa, Hỏa, Linh, Tiểu vận theo nhóm tam hợp chi năm', () => {
  const nhom = [
    { chi: 'Dần Ngọ Tuất', ma: 'Thân', dao: 'Mão', hoa: 'Sửu', linh: 'Mão', tv: 'Thìn' },
    { chi: 'Thân Tý Thìn', ma: 'Dần', dao: 'Dậu', hoa: 'Dần', linh: 'Tuất', tv: 'Tuất' },
    { chi: 'Tỵ Dậu Sửu', ma: 'Hợi', dao: 'Ngọ', hoa: 'Mão', linh: 'Tuất', tv: 'Mùi' },
    { chi: 'Hợi Mão Mùi', ma: 'Tỵ', dao: 'Tý', hoa: 'Dậu', linh: 'Tuất', tv: 'Sửu' },
  ];
  for (const g of nhom) {
    for (const chi of cxs(g.chi)) {
      for (const gender of ['nam', 'nu']) {
        for (let can = chi % 2; can < 10; can += 2) {
          const y = yearOf(can, chi);
          const duong = can % 2 === 0;
          const thuan = duong === (gender === 'nam');
          const s = thuan ? 1 : -1;
          for (let h = 0; h < 12; h++) {
            const c = TUVI.chart({ date: { lunar: { d: 3, m: 4, y } }, hour: h, gender, viewYear: 2026 });
            const tag = `${CAN_TEN[can]} ${CHI_TEN[chi]} ${gender} h${h}`;
            assert.equal(c.sao.thienma, cx(g.ma), 'Mã ' + tag);
            assert.equal(c.sao.daohoa, cx(g.dao), 'Đào ' + tag);
            assert.equal(c.sao.hoatinh, m12(cx(g.hoa) + s * h), 'Hỏa ' + tag);
            assert.equal(c.sao.linhtinh, m12(cx(g.linh) - s * h), 'Linh ' + tag);
            if (h === 0) {
              // Tiểu vận: tuổi 1 ở cung khởi; Nam thuận, Nữ nghịch
              const tvs = gender === 'nam' ? 1 : -1;
              assert.ok(c.palaces[cx(g.tv)].tieuVan.includes(1), 'Tiểu vận khởi ' + tag);
              assert.ok(c.palaces[m12(cx(g.tv) + tvs)].tieuVan.includes(2), 'Tiểu vận 2 ' + tag);
              assert.ok(c.palaces[m12(cx(g.tv) + tvs * 11)].tieuVan.includes(12), 'Tiểu vận 12 ' + tag);
              assert.ok(c.palaces[cx(g.tv)].tieuVan.includes(13), 'Tiểu vận 13 ' + tag);
            }
          }
        }
      }
    }
  }
});

test('Tử Vi: Hồng Loan, Thiên Hỷ, Thái Tuế theo chi năm', () => {
  // Hồng Loan: Tý → Mão, đếm nghịch; Thiên Hỷ đối cung
  const hl = cxs('Mão Dần Sửu Tý Hợi Tuất Dậu Thân Mùi Ngọ Tỵ Thìn');
  for (let chi = 0; chi < 12; chi++) {
    const c = chartAt(chi % 2, chi);
    assert.equal(c.sao.hongloan, hl[chi], 'Hồng Loan ' + CHI_TEN[chi]);
    assert.equal(c.sao.thienhy, m12(hl[chi] + 6), 'Thiên Hỷ ' + CHI_TEN[chi]);
    assert.equal(c.sao.thaitue, chi);
  }
});

test('Tử Vi: sao theo giờ (Xương, Khúc, Kiếp, Không) và sao theo tháng', () => {
  const xuong = cxs('Tuất Dậu Thân Mùi Ngọ Tỵ Thìn Mão Dần Sửu Tý Hợi');
  const khuc = cxs('Thìn Tỵ Ngọ Mùi Thân Dậu Tuất Hợi Tý Sửu Dần Mão');
  const kiep = cxs('Hợi Tý Sửu Dần Mão Thìn Tỵ Ngọ Mùi Thân Dậu Tuất');
  const khong = cxs('Hợi Tuất Dậu Thân Mùi Ngọ Tỵ Thìn Mão Dần Sửu Tý');
  for (let h = 0; h < 12; h++) {
    const c = TUVI.chart({ date: { lunar: { d: 8, m: 8, y: 1995 } }, hour: h, gender: 'nam', viewYear: 2026 });
    assert.equal(c.sao.vanxuong, xuong[h], 'Xương giờ ' + CHI_TEN[h]);
    assert.equal(c.sao.vankhuc, khuc[h], 'Khúc giờ ' + CHI_TEN[h]);
    assert.equal(c.sao.diakiep, kiep[h], 'Kiếp giờ ' + CHI_TEN[h]);
    assert.equal(c.sao.diakhong, khong[h], 'Không giờ ' + CHI_TEN[h]);
  }
  // Tả Phù khởi Thìn thuận, Hữu Bật khởi Tuất nghịch, Thiên Hình khởi Dậu thuận, Thiên Diêu khởi Sửu thuận (tháng 1…12)
  const ta = cxs('Thìn Tỵ Ngọ Mùi Thân Dậu Tuất Hợi Tý Sửu Dần Mão');
  const huu = cxs('Tuất Dậu Thân Mùi Ngọ Tỵ Thìn Mão Dần Sửu Tý Hợi');
  const hinh = cxs('Dậu Tuất Hợi Tý Sửu Dần Mão Thìn Tỵ Ngọ Mùi Thân');
  const dieu = cxs('Sửu Dần Mão Thìn Tỵ Ngọ Mùi Thân Dậu Tuất Hợi Tý');
  for (let m = 1; m <= 12; m++) {
    const c = TUVI.chart({ date: { lunar: { d: 8, m, y: 1995 } }, hour: 3, gender: 'nam', viewYear: 2026 });
    assert.equal(c.sao.taphu, ta[m - 1], 'Tả tháng ' + m);
    assert.equal(c.sao.huubat, huu[m - 1], 'Hữu tháng ' + m);
    assert.equal(c.sao.thienhinh, hinh[m - 1], 'Thiên Hình tháng ' + m);
    assert.equal(c.sao.thiendieu, dieu[m - 1], 'Thiên Diêu tháng ' + m);
  }
});

test('Tử Vi: Tràng Sinh khởi theo hành Cục và chiều thuận/nghịch', () => {
  const khoi = { 4: 'Tỵ', 3: 'Hợi', 2: 'Thân', 5: 'Thân', 6: 'Dần' }; // theo số Cục: Kim, Mộc, Thủy, Thổ, Hỏa
  const seen = new Set();
  for (const inp of randomInputs(900, 11)) {
    const c = TUVI.chart(inp);
    const start = c.palaces.findIndex((p) => p.trangSinh === 'trangsinh');
    assert.equal(start, cx(khoi[c.cuc.so]), `khởi Tràng Sinh Cục ${c.cuc.so}`);
    const s = c.thuan ? 1 : -1;
    TUVI.TRANG_SINH.forEach((code, i) => assert.equal(c.palaces[m12(start + s * i)].trangSinh, code, `${code} Cục ${c.cuc.so} thuan=${c.thuan}`));
    seen.add(c.cuc.so + (c.thuan ? 't' : 'n'));
  }
  assert.equal(seen.size, 10, 'đủ 5 Cục × 2 chiều');
});

test('Tử Vi: Can giờ (Ngũ Thử Độn), chủ mệnh, chủ thân, thứ tự 12 cung', () => {
  // Giờ Tý của ngày có can: Giáp/Kỷ → Giáp, Ất/Canh → Bính, Bính/Tân → Mậu, Đinh/Nhâm → Canh, Mậu/Quý → Nhâm
  const gioTy = [0, 2, 4, 6, 8];
  const chuMenh = ['thamlang', 'cumon', 'locton', 'vankhuc', 'liemtrinh', 'vukhuc', 'phaquan', 'vukhuc', 'liemtrinh', 'vankhuc', 'locton', 'cumon'];
  const chuThan = ['linhtinh', 'thientuong', 'thienluong', 'thiendong', 'vanxuong', 'thienco', 'hoatinh', 'thientuong', 'thienluong', 'thiendong', 'vanxuong', 'thienco'];
  // Thứ tự đi thuận từ Mệnh: Mệnh, Phụ Mẫu (Mệnh+1), Phúc Đức…, Huynh Đệ (Mệnh−1)
  const cung = ['menh', 'phumau', 'phucduc', 'dientrach', 'quanloc', 'nopboc', 'thiendi', 'tatach', 'taibach', 'tutuc', 'phuthe', 'huynhde'];
  for (const inp of randomInputs(300, 21)) {
    const c = TUVI.chart(inp);
    const g = c.canChi.gio;
    assert.equal(g.can, (gioTy[c.canChi.ngay.can % 5] + inp.hour) % 10, 'can giờ');
    assert.equal(g.chi, inp.hour);
    assert.equal(c.chuMenh, chuMenh[c.menhPos]);
    const chiNam = (c.lunar.y + 8) % 12;
    assert.equal(c.chuThan, chuThan[chiNam]);
    cung.forEach((code, i) => assert.equal(c.palaces[m12(c.menhPos + i)].cung, code, `cung ${code}`));
  }
});

test('Tử Vi: lá số tính tay 1 · dương 15/6/1990 giờ Ngọ, nam (âm 23/5 Canh Ngọ)', () => {
  const c = TUVI.chart({ date: { solar: { d: 15, m: 6, y: 1990 } }, hour: 6, gender: 'nam', viewYear: 2026 });
  assert.deepEqual(c.lunar, { d: 23, m: 5, y: 1990, leap: false });
  assert.equal(c.canChi.nam.name, 'Canh Ngọ');
  assert.equal(c.canChi.ngay.name, 'Tân Hợi');
  assert.equal(c.canChi.gio.name, 'Giáp Ngọ');
  assert.equal(c.amDuong, 'duong'); assert.equal(c.thuan, true);
  assert.equal(c.banMenh.ten, 'Lộ Bàng Thổ');
  assert.equal(c.menhPos, cx('Tý')); assert.equal(c.thanPos, cx('Tý'));
  assert.equal(c.palaces[0].canChi, 'Mậu Tý'); // Tích Lịch Hỏa
  assert.equal(c.cuc.so, 6); assert.equal(c.cuc.ma, 'hoa6');
  assert.equal(c.sinhKhac, 'cucsinhmenh');
  const want = {
    tuvi: 'Thìn', thienco: 'Mão', thaiduong: 'Sửu', vukhuc: 'Tý', thiendong: 'Hợi', liemtrinh: 'Thân',
    thienphu: 'Tý', thaiam: 'Sửu', thamlang: 'Dần', cumon: 'Mão', thientuong: 'Thìn', thienluong: 'Tỵ', thatsat: 'Ngọ', phaquan: 'Tuất',
    taphu: 'Thân', huubat: 'Ngọ', vanxuong: 'Thìn', vankhuc: 'Tuất', diakiep: 'Tỵ', diakhong: 'Tỵ',
    locton: 'Thân', kinhduong: 'Dậu', dala: 'Mùi', thienkhoi: 'Ngọ', thienviet: 'Dần', thienma: 'Thân',
    hoatinh: 'Mùi', linhtinh: 'Dậu', daohoa: 'Mão', hongloan: 'Dậu', thienhy: 'Mão', thaitue: 'Ngọ',
    thienhinh: 'Sửu', thiendieu: 'Tỵ',
  };
  for (const [code, chi] of Object.entries(want)) assert.equal(c.sao[code], cx(chi), code);
  assert.deepEqual(c.hoa.map((x) => [x.star, x.pos]), [['thaiduong', 1], ['vukhuc', 0], ['thaiam', 1], ['thiendong', 11]]);
  assert.deepEqual(c.palaces.filter((p) => p.tuan).map((p) => p.pos), cxs('Tuất Hợi'));
  assert.deepEqual(c.palaces.filter((p) => p.triet).map((p) => p.pos), cxs('Ngọ Mùi'));
  assert.equal(c.palaces[cx('Dần')].trangSinh, 'trangsinh');
  assert.equal(c.palaces[cx('Mão')].trangSinh, 'mocduc');
  assert.equal(c.palaces[cx('Sửu')].trangSinh, 'duong');
  assert.equal(c.palaces[cx('Sửu')].cung, 'phumau');
  assert.equal(c.palaces[cx('Hợi')].cung, 'huynhde');
  assert.deepEqual(c.palaces[cx('Tý')].daiVan, { tu: 6, den: 15 });
  assert.deepEqual(c.palaces[cx('Mão')].daiVan, { tu: 36, den: 45 });
  assert.equal(c.chuMenh, 'thamlang'); assert.equal(c.chuThan, 'hoatinh');
  assert.equal(c.tuoi, 37);
  assert.equal(c.daiVanHienTai.pos, cx('Mão'));
  assert.equal(c.tieuVanHienTai.pos, cx('Thìn'));
  assert.equal(c.thaiTuePos, cx('Ngọ'));
  // Độ sáng đọc từ bảng SANG theo cung: Tử Vi Thìn, Thiên Phủ Tý
  const tv = c.palaces[cx('Thìn')].chinh.find((s) => s.code === 'tuvi');
  assert.equal(tv.sang, TUVI.SANG.tuvi[cx('Thìn')]);
});

test('Tử Vi: lá số tính tay 2 · dương 12/11/1990 giờ Tỵ, nam (âm 26/9 Canh Ngọ)', () => {
  const c = TUVI.chart({ date: { solar: { d: 12, m: 11, y: 1990 } }, hour: 5, gender: 'nam', viewYear: 2026 });
  assert.deepEqual(c.lunar, { d: 26, m: 9, y: 1990, leap: false });
  assert.equal(c.canChi.ngay.name, 'Tân Tỵ');
  assert.equal(c.canChi.gio.name, 'Quý Tỵ');
  assert.equal(c.menhPos, cx('Tỵ')); assert.equal(c.thanPos, cx('Mão'));
  assert.equal(c.palaces[cx('Tỵ')].canChi, 'Tân Tỵ'); // Bạch Lạp Kim
  assert.equal(c.palaces[cx('Mão')].canChi, 'Kỷ Mão');
  assert.equal(c.cuc.so, 4); assert.equal(c.cuc.ma, 'kim4');
  const want = {
    tuvi: 'Tuất', thienco: 'Dậu', thaiduong: 'Mùi', vukhuc: 'Ngọ', thiendong: 'Tỵ', liemtrinh: 'Dần',
    thienphu: 'Ngọ', thaiam: 'Mùi', thamlang: 'Thân', cumon: 'Dậu', thientuong: 'Tuất', thienluong: 'Hợi', thatsat: 'Tý', phaquan: 'Thìn',
    taphu: 'Tý', huubat: 'Dần', vanxuong: 'Tỵ', vankhuc: 'Dậu', diakiep: 'Thìn', diakhong: 'Ngọ', hoatinh: 'Ngọ', linhtinh: 'Tuất',
  };
  for (const [code, chi] of Object.entries(want)) assert.equal(c.sao[code], cx(chi), code);
  assert.deepEqual(c.hoa.map((x) => [x.star, x.pos]), [['thaiduong', cx('Mùi')], ['vukhuc', cx('Ngọ')], ['thaiam', cx('Mùi')], ['thiendong', cx('Tỵ')]]);
  assert.equal(c.palaces[cx('Tỵ')].trangSinh, 'trangsinh');
  assert.equal(c.palaces[cx('Ngọ')].trangSinh, 'mocduc');
  assert.deepEqual(c.palaces[cx('Tỵ')].daiVan, { tu: 4, den: 13 });
  assert.equal(c.daiVanHienTai.pos, cx('Thân')); // tuổi 37 ∈ 34–43
  assert.equal(c.tieuVanHienTai.pos, cx('Thìn'));
});

test('Tử Vi: lá số tính tay 3 · nữ Dương, đại vận và tiểu vận đi nghịch (xem năm 2027, tuổi 38)', () => {
  const c = TUVI.chart({ date: { solar: { d: 15, m: 6, y: 1990 } }, hour: 6, gender: 'nu', viewYear: 2027 });
  assert.equal(c.tuoi, 38);
  assert.equal(c.thuan, false);
  assert.deepEqual(c.palaces[cx('Hợi')].daiVan, { tu: 16, den: 25 });
  assert.deepEqual(c.palaces[cx('Dậu')].daiVan, { tu: 36, den: 45 });
  assert.equal(c.daiVanHienTai.pos, cx('Dậu'));
  assert.equal(c.palaces[cx('Dần')].trangSinh, 'trangsinh');
  assert.equal(c.palaces[cx('Sửu')].trangSinh, 'mocduc'); // nghịch
  assert.equal(c.tieuVanHienTai.pos, cx('Mão')); // khởi Thìn, tuổi 38 = lùi 37 cung
  assert.equal(c.palaces[cx('Mão')].tieuVan.includes(38), true);
  assert.equal(c.luu.canChi, 'Đinh Mùi');
});

// Lá số mẫu của T-055 (test/fixtures/tuvi-golden.json). Chưa có file thì bỏ qua.
// Định dạng thật: { samples:[{ id, input:{ lunar:{year,month,day,leap}, hourBranch, lateTy, gender:'male|female' },
//   expected:{ menh, than, cuc:'kim4', chinhTinh:{ma:chi}, tuHoaViet:[tên sao ×4] }, differsFromViet }] }.
// Mẫu do iztro (trường phái Trung Quốc) lập. Chỉ so các trường KHÔNG khác quy ước Việt:
// bỏ qua độ sáng (differsFromViet.brightnessCells), chủ thân (Tý/Ngọ), Hỏa/Linh, Khôi/Việt Canh.
// Tứ Hóa so với `tuHoaViet` (không phải `tuHoaIztro`); mẫu nào ghi differsFromViet.tuHoa === true thì bỏ qua Tứ Hóa.
const goldenFile = path.join(__dirname, 'fixtures', 'tuvi-golden.json');
const SAO_TEN = {
  tuvi: 'Tử Vi', thienco: 'Thiên Cơ', thaiduong: 'Thái Dương', vukhuc: 'Vũ Khúc', thiendong: 'Thiên Đồng',
  liemtrinh: 'Liêm Trinh', thienphu: 'Thiên Phủ', thaiam: 'Thái Âm', thamlang: 'Tham Lang', cumon: 'Cự Môn',
  thientuong: 'Thiên Tướng', thienluong: 'Thiên Lương', thatsat: 'Thất Sát', phaquan: 'Phá Quân',
  taphu: 'Tả Phù', huubat: 'Hữu Bật', vanxuong: 'Văn Xương', vankhuc: 'Văn Khúc',
};
test('Tử Vi: 12 lá số mẫu khớp 100% phần chính', { skip: !fs.existsSync(goldenFile) && 'chưa có test/fixtures/tuvi-golden.json (T-055)' }, () => {
  const raw = JSON.parse(fs.readFileSync(goldenFile, 'utf8'));
  const list = raw.samples || [];
  assert.equal(list.length, 12);
  assert.deepEqual(raw.inputFormat && Object.keys(raw.inputFormat), ['lunar', 'hourBranch', 'lateTy', 'gender']);
  const idx = (v) => CHI_TEN.indexOf(v);
  for (const g of list) {
    const inp = g.input, e = g.expected, name = g.id;
    const opt = inp.lateTy ? { hour24: 23 } : undefined; // sinh 23h: tính sang ngày âm kế (D11)
    const c = TUVI.chart({
      date: { lunar: { d: inp.lunar.day, m: inp.lunar.month, y: inp.lunar.year }, leap: !!inp.lunar.leap },
      hour: inp.hourBranch, gender: inp.gender === 'male' ? 'nam' : 'nu', viewYear: 2026, options: opt,
    });
    assert.equal(c.lateTyShifted, !!inp.lateTy, `Giờ Tý muộn ${name}`);
    assert.equal(c.menhPos, idx(e.menh), `Mệnh ${name}`);
    assert.equal(c.thanPos, idx(e.than), `Thân ${name}`);
    assert.equal(c.cuc.so, Number(e.cuc.slice(-1)), `Cục ${name}`);
    const chinh = Object.entries(e.chinhTinh);
    assert.equal(chinh.length, 14, `đủ 14 chính tinh ${name}`);
    for (const [code, chi] of chinh) assert.equal(posOf(c, code), idx(chi), `${code} ${name}`);
    if (!(g.differsFromViet && g.differsFromViet.tuHoa)) {
      assert.deepEqual(c.hoa.map((x) => SAO_TEN[x.star]), e.tuHoaViet, `Tứ Hóa ${name}`);
    }
  }
});
