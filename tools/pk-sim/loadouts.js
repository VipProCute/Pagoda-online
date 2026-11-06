'use strict';
/* Bộ chiêu tiêu biểu, bộ thuần từng nhánh, mọi bộ 4 chiêu. Viết tắt chiêu dùng trong bảng. */
const CODE = {
  TQ: 'trong-quyen', KCT: 'kim-chung-trao', TL: 'tu-luc-pha-son', TB: 'thiet-bich', PC: 'phan-chan',
  KTB: 'khinh-than-bo', ABH: 'anh-bo-ho-than', TPQ: 'tat-phong-quyen', LHC: 'lien-hoan-cuoc', DAP: 'doat-anh-phan-kich',
  NVB: 'nhu-van-bo', TKP: 'tiep-kinh-phan-chuong', TLH: 'ta-luc-hoa-giai', LDC: 'lieu-diep-chuong', TLB: 'tu-lang-bat-thien-can'
};
const ABBR = Object.fromEntries(Object.entries(CODE).map(([k, v]) => [v, k]));
const abbr = id => ABBR[id] || id;
const ids = s => s.split(/\s+/).map(c => { if (!CODE[c]) throw new Error('Viết tắt chiêu không có: ' + c); return CODE[c]; });

const PRESETS = [
  ['Cương1', 'TQ KCT TB TL'], ['Cương2', 'TQ KCT TB PC'],
  ['Tốc1', 'TPQ LHC KTB DAP'], ['Tốc2', 'TPQ LHC KTB ABH'],
  ['Nhu1', 'LDC NVB TKP TLB'], ['Nhu2', 'LDC TLH TKP TLB'],
  ['Cuồng công', 'TQ TPQ LHC TL'], ['Phản đòn', 'TKP TLB DAP TB'],
  ['Phối1', 'TQ TPQ KTB TLB'], ['Phối2', 'TQ KTB TKP TB'], ['Phối3', 'TPQ DAP TB TKP'],
  ['Tân thủ', 'TQ TPQ TB NVB'], ['Toàn thủ', 'TB KCT TLH ABH']
].map(([name, s]) => ({ name, ids: ids(s) }));

/** Tên bộ theo viết tắt chiêu: "TQ KCT TB TL". */
const label = list => list.map(abbr).join(' ');

function combos(arr, k) {
  const out = [];
  const go = (start, cur) => {
    if (cur.length === k) { out.push(cur.slice()); return; }
    for (let i = start; i < arr.length; i++) { cur.push(arr[i]); go(i + 1, cur); cur.pop(); }
  };
  go(0, []);
  return out;
}

/** Mọi bộ 4 chiêu thuần một nhánh (5 bộ mỗi nhánh). */
function pureSets(M) {
  const out = [];
  for (const b of M.BRANCH_ORDER) {
    const ids = M.SKILL_ORDER.filter(id => M.SKILLS[id].branch === b);
    combos(ids, 4).forEach((c, i) => out.push({ name: `${M.BRANCHES[b].name}${i + 1}`, branch: b, ids: c }));
  }
  return out;
}

/** Mọi bộ 4 chiêu (C(15,4) = 1365), thứ tự cố định. */
function allSets(M) {
  return combos(M.SKILL_ORDER, 4).map(c => ({ name: label(c), ids: c }));
}

/** Nhánh thuộc về nhiều nhất của một bộ: 'cuong' | 'toc' | 'nhu' | 'phoi' (phối). */
function branchOf(M, list) {
  const n = {};
  for (const id of list) n[M.SKILLS[id].branch] = (n[M.SKILLS[id].branch] || 0) + 1;
  const top = Object.entries(n).sort((a, b) => b[1] - a[1]);
  return top[0][1] >= 3 ? top[0][0] : 'phoi';
}

module.exports = { CODE, abbr, ids, label, PRESETS, combos, pureSets, allSets, branchOf };
