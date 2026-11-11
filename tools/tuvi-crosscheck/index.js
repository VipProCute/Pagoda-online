'use strict';
// Đối chiếu bộ máy an sao (public/js/tuvi.js) với thư viện `iztro` (MIT, trường phái Trung Quốc).
// CHỈ DÙNG KHI PHÁT TRIỂN: không thêm iztro vào package.json.
//   1) Cài iztro TẠM ở ngoài repo:  mkdir /tmp/iztro && cd /tmp/iztro && npm i iztro
//   2) node tools/tuvi-crosscheck/index.js --iztro /tmp/iztro/node_modules/iztro --n 10000 --seed 1
// Đưa vào iztro NGÀY ÂM + GIỜ (byLunar), không đưa ngày dương: iztro đổi lịch theo UTC+8 nên
// lệch lịch Việt Nam ở một số ngày (Tết 1985, Tết 2007…). Bỏ qua tháng nhuận (iztro xử lý nhuận khác).
// So: 14 chính tinh, cung Mệnh, cung Thân, Cục. Xem README.md cùng thư mục về các khác biệt có chủ đích.
const path = require('node:path');
const Lunar = require('../../public/js/lunar.js');
const TUVI = require('../../public/js/tuvi.js');

function arg(name, def) {
  const i = process.argv.indexOf('--' + name);
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : def;
}
const N = Number(arg('n', 10000));
const SEED = Number(arg('seed', 1));
const SHOW = Number(arg('show', 10));
const iztroPath = arg('iztro', process.env.IZTRO_PATH || 'iztro');

let iztro;
try { iztro = require(path.isAbsolute(iztroPath) ? iztroPath : (iztroPath.startsWith('.') ? path.resolve(iztroPath) : iztroPath)); } catch (e) {
  console.error('Không nạp được iztro (' + iztroPath + '). Cài tạm ngoài repo rồi truyền --iztro <đường dẫn>.');
  process.exit(2);
}
const astro = iztro.astro || iztro;

const BRANCH = '子丑寅卯辰巳午未申酉戌亥';
const STAR_ZH = {
  紫微: 'tuvi', 天机: 'thienco', 太阳: 'thaiduong', 武曲: 'vukhuc', 天同: 'thiendong', 廉贞: 'liemtrinh', 天府: 'thienphu',
  太阴: 'thaiam', 贪狼: 'thamlang', 巨门: 'cumon', 天相: 'thientuong', 天梁: 'thienluong', 七杀: 'thatsat', 破军: 'phaquan',
};
const CUC_ZH = { 水二局: 2, 木三局: 3, 金四局: 4, 土五局: 5, 火六局: 6 };

let s = SEED >>> 0;
const rnd = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };

let diff = 0, ok = 0, skipped = 0, lechLich = 0;
const shown = [];
const lechLichShown = [];
for (let i = 0; i < N; i++) {
  const ly = 1900 + Math.floor(rnd() * 200), lm = 1 + Math.floor(rnd() * 12), ld = 1 + Math.floor(rnd() * 30);
  const hour = Math.floor(rnd() * 12), gender = rnd() < 0.5 ? 'nam' : 'nu';
  const solar = Lunar.toSolar(ld, lm, ly, 0);
  if (!solar) { skipped++; continue; } // ngày không tồn tại (tháng thiếu)
  const mine = TUVI.chart({ date: { lunar: { d: ld, m: lm, y: ly } }, hour, gender, viewYear: 2026 });
  // iztro: timeIndex 0 = giờ Tý đầu ngày, 1..11 = Sửu..Hợi; tham số: ngày 'YYYY-M-D', timeIndex, giới tính, nhuận, fixLeap, ngôn ngữ
  let ref;
  try {
    ref = astro.byLunar(`${ly}-${lm}-${ld}`, hour, gender === 'nam' ? '男' : '女', false, false, 'zh-CN');
  } catch (e) {
    // Ngày 30 có ở lịch Việt nhưng tháng đó ở lịch Trung Quốc chỉ 29 ngày: đếm riêng, không dừng cả lượt
    lechLich++;
    if (lechLichShown.length < SHOW) lechLichShown.push(`âm ${ld}/${lm}/${ly}: ${e && e.message ? e.message : e}`);
    continue;
  }
  const theirs = {};
  for (const p of ref.palaces) {
    for (const st of p.majorStars || []) if (STAR_ZH[st.name]) theirs[STAR_ZH[st.name]] = BRANCH.indexOf(p.earthlyBranch);
  }
  const issues = [];
  for (const code of TUVI.CHINH_TINH) {
    const mp = mine.palaces.find((c) => c.chinh.some((x) => x.code === code)).pos;
    if (theirs[code] !== mp) issues.push(`${code}: ta ${mp}, iztro ${theirs[code]}`);
  }
  if (BRANCH.indexOf(ref.earthlyBranchOfSoulPalace) !== mine.menhPos) issues.push(`Mệnh: ta ${mine.menhPos}, iztro ${BRANCH.indexOf(ref.earthlyBranchOfSoulPalace)}`);
  if (BRANCH.indexOf(ref.earthlyBranchOfBodyPalace) !== mine.thanPos) issues.push(`Thân: ta ${mine.thanPos}, iztro ${BRANCH.indexOf(ref.earthlyBranchOfBodyPalace)}`);
  if (CUC_ZH[ref.fiveElementsClass] !== mine.cuc.so) issues.push(`Cục: ta ${mine.cuc.so}, iztro ${CUC_ZH[ref.fiveElementsClass]}`);
  if (issues.length) { diff++; if (shown.length < SHOW) shown.push(`âm ${ld}/${lm}/${ly} giờ ${hour} ${gender}: ${issues.join('; ')}`); } else ok++;
}
console.log(`Đối chiếu ${ok + diff} lá số (bỏ qua ${skipped}, lệch lịch ${lechLich}): khớp ${ok}, lệch ${diff}.`);
for (const line of shown) console.log('  ' + line);
if (lechLich) console.log('Lệch lịch (iztro không nhận ngày, không tính là lệch sao):');
for (const line of lechLichShown) console.log('  ' + line);
process.exit(diff ? 1 : 0);
