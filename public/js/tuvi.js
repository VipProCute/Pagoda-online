/* Bộ máy an sao Tử Vi Đẩu Số · trường phái Việt Nam (T-054).
 *
 * Công thức: docs/KE-HOACH-DOT-2026-11.md §7.3 và Phụ lục B (mã sao, mã cung ở "Mã dữ liệu").
 * Chạy hoàn toàn trên trình duyệt (hoặc Node khi test): ngày giờ sinh không gửi đi đâu.
 * Phụ thuộc duy nhất: Lunar (public/js/lunar.js) để đổi lịch và tính can chi.
 * Không đụng DOM, không timer, không I/O ở mức module.
 *
 * Quy ước chỉ số: địa chi Tý = 0 … Hợi = 11; can Giáp = 0 … Quý = 9; "pos" là chi của cung (0–11).
 *
 * API: TUVI.chart({ date:{ solar:{d,m,y} | lunar:{d,m,y}, leap }, hour, gender, viewYear, options })
 *   - hour: 0–11 (Tý … Hợi) hoặc null/undefined = không nhớ giờ (trả cờ noHour).
 *   - gender: 'nam' | 'nu'.
 *   - options.hour24: 0–23, nếu có thì thay cho `hour`; 23h tính sang ngày hôm sau
 *     trừ khi options.lateTy === false (mặc định bật, D11).
 *     Lưu ý: `hour` 0 không phân biệt được Tý 23h với Tý 0h; muốn quy tắc 23h sang ngày sau (D11)
 *     có tác dụng thì người gọi (T-057) phải truyền options.hour24.
 *   - options.leapRule: 'chinh' (mặc định: tháng nhuận như tháng chính) | 'sau15'
 *     (nhuận sau ngày 15 tính sang tháng kế; nhuận tháng 12 thì đổi thành tháng 1, giữ nguyên năm âm: hiếm gặp).
 *   - viewYear: số nguyên; không phải số nguyên thì lấy năm âm hiện tại. Trước năm sinh thì đại vận/tiểu vận hiện tại là null.
 *   - Đầu vào sai ném RangeError: người gọi phải bắt lỗi.
 *   - res.luu.palaces: đặt lưu Mệnh tại cung có Thái Tuế năm xem (một trường phái; ghi ở docs/TU-VI-QUY-UOC.md).
 *   - options.nhamKhoa: 'taphu' (mặc định) | 'thienphu' (Khoa của can Nhâm).
 *   TUVI.anTuVi(cuc, ngayAm) · TUVI.CUNG · TUVI.CHINH_TINH · TUVI.PHU_TINH · TUVI.TRANG_SINH · TUVI.SANG
 * Điểm khác trường phái: xem tools/tuvi-crosscheck/README.md và docs/TU-VI-QUY-UOC.md (T-055).
 */
(function (root, factory) {
  'use strict';
  const lunar = (typeof module === 'object' && module && module.exports) ? require('./lunar.js') : root.Lunar;
  const api = factory(lunar);
  if (typeof module === 'object' && module && module.exports) module.exports = api;
  else root.TUVI = api;
})(typeof window !== 'undefined' ? window : this, function (Lunar) {
  'use strict';

  const m12 = (n) => ((n % 12) + 12) % 12;
  const m10 = (n) => ((n % 10) + 10) % 10;

  // ---- Mã dữ liệu (khớp KH Phụ lục B) ----
  const CUNG = ['menh', 'phumau', 'phucduc', 'dientrach', 'quanloc', 'nopboc', 'thiendi', 'tatach', 'taibach', 'tutuc', 'phuthe', 'huynhde'];
  const CHINH_TINH = ['tuvi', 'thienco', 'thaiduong', 'vukhuc', 'thiendong', 'liemtrinh', 'thienphu', 'thaiam', 'thamlang', 'cumon', 'thientuong', 'thienluong', 'thatsat', 'phaquan'];
  const PHU_TINH = ['taphu', 'huubat', 'vanxuong', 'vankhuc', 'thienkhoi', 'thienviet', 'locton', 'kinhduong', 'dala', 'thienma', 'hoatinh', 'linhtinh', 'diakhong', 'diakiep', 'hoaloc', 'hoaquyen', 'hoakhoa', 'hoaky', 'tuan', 'triet', 'daohoa', 'hongloan', 'thienhy', 'thienhinh', 'thiendieu', 'thaitue'];
  const TRANG_SINH = ['trangsinh', 'mocduc', 'quandoi', 'lamquan', 'devuong', 'suy', 'benh', 'tu', 'mo', 'tuyet', 'thai', 'duong'];
  const HOA = ['hoaloc', 'hoaquyen', 'hoakhoa', 'hoaky'];
  const CUC_MA = { 2: 'thuy2', 3: 'moc3', 4: 'kim4', 5: 'tho5', 6: 'hoa6' };
  const HANH_CUC = { thuy: 2, moc: 3, kim: 4, tho: 5, hoa: 6 };
  const HANH_TEN = { Kim: 'kim', Mộc: 'moc', Thủy: 'thuy', Hỏa: 'hoa', Thổ: 'tho' };

  // ---- Bảng theo can (chỉ số can 0–9) ----
  const LOC_TON = [2, 3, 5, 6, 5, 6, 8, 9, 11, 0];
  const KHOI = [1, 0, 11, 11, 1, 0, 6, 6, 3, 3];
  const VIET = [7, 8, 9, 9, 7, 8, 2, 2, 5, 5];
  const TRIET = [[8, 9], [6, 7], [4, 5], [2, 3], [0, 1], [8, 9], [6, 7], [4, 5], [2, 3], [0, 1]];
  const TU_HOA = [
    ['liemtrinh', 'phaquan', 'vukhuc', 'thaiduong'],
    ['thienco', 'thienluong', 'tuvi', 'thaiam'],
    ['thiendong', 'thienco', 'vanxuong', 'liemtrinh'],
    ['thaiam', 'thiendong', 'thienco', 'cumon'],
    ['thamlang', 'thaiam', 'huubat', 'thienco'],
    ['vukhuc', 'thamlang', 'thienluong', 'vankhuc'],
    ['thaiduong', 'vukhuc', 'thaiam', 'thiendong'],
    ['cumon', 'thaiduong', 'vankhuc', 'vanxuong'],
    ['thienluong', 'tuvi', 'taphu', 'vukhuc'],
    ['phaquan', 'cumon', 'thaiam', 'thamlang'],
  ];
  // ---- Bảng theo chi năm: nhóm tam hợp (0: Dần Ngọ Tuất · 1: Thân Tý Thìn · 2: Tỵ Dậu Sửu · 3: Hợi Mão Mùi) ----
  const NHOM = [1, 2, 0, 3, 1, 2, 0, 3, 1, 2, 0, 3];
  const THIEN_MA = [8, 2, 11, 5];
  const HOA_TINH = [1, 2, 3, 9];
  const LINH_TINH = [3, 10, 10, 10];
  const DAO_HOA = [3, 9, 6, 0];
  const TIEU_VAN = [4, 10, 7, 1];
  // ---- Chủ mệnh (theo chi cung Mệnh), chủ thân (theo chi năm sinh) ----
  const CHU_MENH = ['thamlang', 'cumon', 'locton', 'vankhuc', 'liemtrinh', 'vukhuc', 'phaquan', 'vukhuc', 'liemtrinh', 'vankhuc', 'locton', 'cumon'];
  const CHU_THAN = ['linhtinh', 'thientuong', 'thienluong', 'thiendong', 'vanxuong', 'thienco', 'hoatinh', 'thientuong', 'thienluong', 'thiendong', 'vanxuong', 'thienco'];
  // Chi cung khởi Tràng Sinh theo hành Cục
  const TRANG_SINH_KHOI = { kim: 5, moc: 11, thuy: 8, tho: 8, hoa: 2 };

  // ---- Độ sáng 14 chính tinh × 12 cung (Tý … Hợi). TẠM: chờ T-055 đối chiếu hai nguồn ----
  const SANG = {
    tuvi: 'DMMBDVMMDBDV',
    thienco: 'DHMVDBDHMVDB',
    thaiduong: 'HHVMVVMDBHHH',
    vukhuc: 'VMVDMBVMVDMB',
    thiendong: 'VHDMBHHHDMBV',
    liemtrinh: 'BVMBVHBVMBVH',
    thienphu: 'MMMHMDVMDMMD',
    thaiam: 'MMHHHHHDBVMM',
    thamlang: 'HMDDMHHMDDMH',
    cumon: 'VHMMHVVHMDHV',
    thientuong: 'MDMHDDMDMHDD',
    thienluong: 'MDMMVHMDHDVH',
    thatsat: 'MDMHMDMDMHMD',
    phaquan: 'MVHHVHMVHHVH',
  };

  // ---- An Tử Vi theo Cục và ngày âm (Phụ lục B) ----
  function anTuVi(cuc, ngay) {
    let x = 0;
    while ((ngay + x) % cuc !== 0) x++;
    const q = (ngay + x) / cuc;
    const goc = m12(2 + q - 1);
    return m12(x % 2 === 0 ? goc + x : goc - x);
  }

  function badInput(msg) { return new RangeError(msg); }

  // ---- Đổi ngày về lịch âm (có xử lý 23h sang ngày sau) ----
  function resolveDate(date, hour24, lateTy) {
    if (!date || typeof date !== 'object') throw badInput('Thiếu ngày sinh');
    let solar, lun;
    if (date.solar) {
      const s = date.solar;
      solar = Array.isArray(s) ? s.slice(0, 3) : [s.d, s.m, s.y];
      lun = Lunar.toLunar(solar[0], solar[1], solar[2]);
      if (!lun) throw badInput('Ngày dương không hợp lệ (chỉ hỗ trợ 1900–2100)');
    } else if (date.lunar) {
      const l = date.lunar;
      const arr = Array.isArray(l) ? l : [l.d, l.m, l.y];
      solar = Lunar.toSolar(arr[0], arr[1], arr[2], date.leap ? 1 : 0);
      if (!solar) throw badInput('Ngày âm không hợp lệ');
      lun = Lunar.toLunar(solar[0], solar[1], solar[2]);
      if (!lun) throw badInput('Ngày âm không hợp lệ');
    } else throw badInput('Thiếu ngày sinh (solar hoặc lunar)');
    let shifted = false;
    let jd = Lunar.jdn(solar[0], solar[1], solar[2]);
    if (hour24 === 23 && lateTy !== false) {
      jd += 1;
      solar = Lunar.fromJdn(jd);
      lun = Lunar.toLunar(solar[0], solar[1], solar[2]);
      if (!lun) throw badInput('Ngày sinh ngoài phạm vi hỗ trợ');
      shifted = true;
    }
    return { solar, lun, jd, shifted };
  }

  function hanhOf(canChi) {
    const name = Lunar.napAm(canChi.can, canChi.chi);
    const last = name.split(' ').pop();
    return { name, hanh: HANH_TEN[last] || '' };
  }
  // Quan hệ giữa hành Cục và hành bản mệnh (cho phần tổng quan luận giải)
  const SINH = { moc: 'hoa', hoa: 'tho', tho: 'kim', kim: 'thuy', thuy: 'moc' };
  const KHAC = { moc: 'tho', tho: 'thuy', thuy: 'hoa', hoa: 'kim', kim: 'moc' };
  function sinhKhac(hanhCuc, hanhMenh) {
    if (hanhCuc === hanhMenh) return 'binhhoa';
    if (SINH[hanhCuc] === hanhMenh) return 'cucsinhmenh';
    if (SINH[hanhMenh] === hanhCuc) return 'menhsinhcuc';
    if (KHAC[hanhCuc] === hanhMenh) return 'cuckhacmenh';
    return 'menhkhaccuc';
  }

  function vnTodayLunarYear() {
    const d = new Date(Date.now() + 7 * 3600e3);
    const l = Lunar.toLunar(d.getUTCDate(), d.getUTCMonth() + 1, d.getUTCFullYear());
    return l ? l[2] : d.getUTCFullYear();
  }

  // Các sao chỉ phụ thuộc năm (can, chi) — dùng được cả khi không có giờ sinh
  function yearStars(can, chi) {
    const nh = NHOM[chi];
    const loc = LOC_TON[can];
    const hl = m12(3 - chi);
    const tr = m12(chi - can + 10);
    return {
      thienma: THIEN_MA[nh], daohoa: DAO_HOA[nh], hongloan: hl, thienhy: m12(hl + 6), thaitue: chi,
      locton: loc, kinhduong: m12(loc + 1), dala: m12(loc - 1),
      thienkhoi: KHOI[can], thienviet: VIET[can],
      tuan: [tr, m12(tr + 1)], triet: TRIET[can].slice(),
    };
  }

  function tuHoaOf(can, nhamKhoa) {
    const t = TU_HOA[can].slice();
    if (can === 8 && nhamKhoa === 'thienphu') t[2] = 'thienphu';
    return t;
  }

  function chart(input) {
    if (!input || typeof input !== 'object') throw badInput('Thiếu dữ liệu lá số');
    const options = input.options || {};
    const gender = input.gender;
    if (gender !== 'nam' && gender !== 'nu') throw badInput("Giới tính phải là 'nam' hoặc 'nu'");

    let hour = input.hour;
    let hour24 = null;
    if (options.hour24 !== undefined && options.hour24 !== null) {
      hour24 = options.hour24;
      if (!Number.isInteger(hour24) || hour24 < 0 || hour24 > 23) throw badInput('Giờ sinh không hợp lệ');
      hour = Math.floor((hour24 + 1) / 2) % 12;
    }
    const noHour = hour === null || hour === undefined;
    if (!noHour && (!Number.isInteger(hour) || hour < 0 || hour > 11)) throw badInput('Giờ sinh không hợp lệ (0–11)');

    const { solar, lun, jd, shifted } = resolveDate(input.date, hour24, options.lateTy);
    const ld = lun[0], ly = lun[2], leap = lun[3] === 1;
    let lm = lun[1];
    if (leap && options.leapRule === 'sau15' && ld > 15) lm = lm === 12 ? 1 : lm + 1;

    const canNam = m10(ly + 6), chiNam = m12(ly + 8);
    const duong = canNam % 2 === 0;
    const thuan = duong === (gender === 'nam');
    const step = thuan ? 1 : -1;
    const banMenh = hanhOf({ can: canNam, chi: chiNam });
    const viewYear = Number.isInteger(input.viewYear) ? input.viewYear : vnTodayLunarYear();
    const tuoi = viewYear - ly + 1; // tuổi âm (tuổi mụ)

    const canThang1 = m10(2 * (canNam % 5) + 2); // can tháng Giêng (Ngũ Hổ Độn)
    const dayCC = Lunar.canChiNgay(jd);
    const ys = yearStars(canNam, chiNam);

    const res = {
      noHour,
      input: { gender, hour: noHour ? null : hour, viewYear },
      solar, lunar: { d: ld, m: lun[1], y: ly, leap }, lateTyShifted: shifted,
      canChi: {
        nam: Lunar.canChiNam(ly),
        thang: Lunar.canChiThang(lm, ly),
        ngay: dayCC,
        gio: noHour ? null : { can: m10(2 * dayCC.can + hour), chi: hour, name: Lunar.CAN[m10(2 * dayCC.can + hour)] + ' ' + Lunar.CHI[hour] },
      },
      amDuong: duong ? 'duong' : 'am', thuan,
      banMenh: { ten: banMenh.name, hanh: banMenh.hanh },
      tuoi,
      thaiTuePos: chiNam,
    };

    // ---- Lưu niên (không cần giờ, trừ vị trí các sao theo giờ) ----
    const lcan = m10(viewYear + 6), lchi = m12(viewYear + 8);
    const lys = yearStars(lcan, lchi);
    const sao = {}; // vị trí các sao đã biết (cho Tứ Hóa)
    const luuHoaTen = tuHoaOf(lcan, options.nhamKhoa);
    const namHoaTen = tuHoaOf(canNam, options.nhamKhoa);

    if (noHour) {
      // Sao chỉ cần tháng
      sao.taphu = m12(4 + lm - 1);
      sao.huubat = m12(10 - (lm - 1));
      res.yearStars = ys;
      res.hoa = namHoaTen.map((star, i) => ({ code: HOA[i], star, pos: sao[star] === undefined ? null : sao[star] }));
      res.luu = luuInfo(viewYear, lcan, lchi, lys, luuHoaTen, sao);
      res.palaces = null;
      res.menhPos = null; res.thanPos = null; res.cuc = null;
      return res;
    }

    // ---- Cần giờ sinh ----
    const h = hour;
    const menhPos = m12(2 + (lm - 1) - h);
    const thanPos = m12(2 + (lm - 1) + h);
    const canAt = (pos) => m10(canThang1 + m12(pos - 2));
    const menhCC = { can: canAt(menhPos), chi: menhPos };
    const cucHanh = hanhOf(menhCC);
    const cucSo = HANH_CUC[cucHanh.hanh];
    if (!cucSo) throw new Error('Không xác định được Cục');

    const t = anTuVi(cucSo, ld);
    sao.tuvi = t; sao.thienco = m12(t - 1); sao.thaiduong = m12(t - 3); sao.vukhuc = m12(t - 4);
    sao.thiendong = m12(t - 5); sao.liemtrinh = m12(t - 8);
    const p = m12(4 - t);
    sao.thienphu = p; sao.thaiam = m12(p + 1); sao.thamlang = m12(p + 2); sao.cumon = m12(p + 3);
    sao.thientuong = m12(p + 4); sao.thienluong = m12(p + 5); sao.thatsat = m12(p + 6); sao.phaquan = m12(p + 10);

    sao.taphu = m12(4 + lm - 1); sao.huubat = m12(10 - (lm - 1));
    sao.vanxuong = m12(10 - h); sao.vankhuc = m12(4 + h);
    sao.diakiep = m12(11 + h); sao.diakhong = m12(11 - h);
    for (const k of ['locton', 'kinhduong', 'dala', 'thienkhoi', 'thienviet', 'thienma', 'daohoa', 'hongloan', 'thienhy', 'thaitue']) sao[k] = ys[k];
    const nh = NHOM[chiNam];
    // Dương Nam / Âm Nữ (thuận): Hỏa thuận, Linh nghịch; ngược lại thì đảo
    sao.hoatinh = m12(HOA_TINH[nh] + step * h);
    sao.linhtinh = m12(LINH_TINH[nh] - step * h);
    sao.thienhinh = m12(9 + (lm - 1));
    sao.thiendieu = m12(1 + (lm - 1));

    // ---- Dựng 12 cung theo vị trí ----
    const palaces = [];
    for (let pos = 0; pos < 12; pos++) {
      palaces.push({
        pos, chi: Lunar.CHI[pos], can: canAt(pos), canChi: Lunar.CAN[canAt(pos)] + ' ' + Lunar.CHI[pos],
        cung: CUNG[m12(pos - menhPos)], than: pos === thanPos,
        chinh: [], phu: [], hoa: [], tuan: false, triet: false,
        trangSinh: null, daiVan: null, tieuVan: [],
      });
    }
    for (const code of CHINH_TINH) palaces[sao[code]].chinh.push({ code, sang: SANG[code][sao[code]] });
    for (const code of PHU_TINH) {
      if (HOA.includes(code) || code === 'tuan' || code === 'triet') continue;
      palaces[sao[code]].phu.push(code);
    }
    namHoaTen.forEach((star, i) => palaces[sao[star]].hoa.push({ code: HOA[i], star }));
    for (const pos of ys.tuan) palaces[pos].tuan = true;
    for (const pos of ys.triet) palaces[pos].triet = true;
    // Vòng Tràng Sinh
    const tsKhoi = TRANG_SINH_KHOI[cucHanh.hanh];
    TRANG_SINH.forEach((code, i) => { palaces[m12(tsKhoi + step * i)].trangSinh = code; });
    // Đại vận
    for (let i = 0; i < 12; i++) {
      const tu = cucSo + 10 * i;
      palaces[m12(menhPos + step * i)].daiVan = { tu, den: tu + 9 };
    }
    // Tiểu vận: tuổi 1 ở cung khởi, Nam thuận, Nữ nghịch
    const tvStep = gender === 'nam' ? 1 : -1;
    for (let age = 1; age <= 108; age++) palaces[m12(TIEU_VAN[nh] + tvStep * (age - 1))].tieuVan.push(age);

    const dvPos = tuoi >= cucSo ? palaces.findIndex((c) => c.daiVan && tuoi >= c.daiVan.tu && tuoi <= c.daiVan.den) : -1;
    res.palaces = palaces;
    res.menhPos = menhPos; res.thanPos = thanPos;
    res.cuc = { ma: CUC_MA[cucSo], so: cucSo, hanh: cucHanh.hanh, ten: cucHanh.name };
    res.sinhKhac = sinhKhac(cucHanh.hanh, banMenh.hanh);
    res.chuMenh = CHU_MENH[menhPos];
    res.chuThan = CHU_THAN[chiNam];
    res.hoa = namHoaTen.map((star, i) => ({ code: HOA[i], star, pos: sao[star] }));
    res.daiVanHienTai = dvPos >= 0 ? { pos: dvPos, cung: palaces[dvPos].cung, tu: palaces[dvPos].daiVan.tu, den: palaces[dvPos].daiVan.den } : null;
    const tvPos = m12(TIEU_VAN[nh] + tvStep * (Math.max(tuoi, 1) - 1));
    res.tieuVanHienTai = tuoi >= 1 ? { pos: tvPos, cung: palaces[tvPos].cung } : null;
    res.luu = luuInfo(viewYear, lcan, lchi, lys, luuHoaTen, sao);
    res.luu.cungLuuMenh = palaces[lchi].cung; // cung gốc đang nằm ở vị trí lưu Thái Tuế
    res.luu.palaces = palaces.map((c) => ({ pos: c.pos, cung: CUNG[m12(c.pos - lchi)] }));
    res.sao = sao;
    return res;
  }

  function luuInfo(viewYear, can, chi, lys, hoaTen, sao) {
    return {
      year: viewYear, can, chi, canChi: Lunar.CAN[can] + ' ' + Lunar.CHI[chi],
      thaiTuePos: chi, locTonPos: lys.locton, kinhDuongPos: lys.kinhduong, daLaPos: lys.dala,
      thienMaPos: lys.thienma,
      hoa: hoaTen.map((star, i) => ({ code: HOA[i], star, pos: sao[star] === undefined ? null : sao[star] })),
    };
  }

  return { chart, anTuVi, CUNG, CHINH_TINH, PHU_TINH, TRANG_SINH, SANG, CUC_MA, TU_HOA };
});
