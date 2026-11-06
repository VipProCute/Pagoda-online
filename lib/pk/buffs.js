'use strict';
/*
 * Buff của "phòng có buff": pháp tướng công đức (Lc 0–6), quỷ (Lq 0–4), hào quang cúng dường (Ld 0–9).
 * Chụp MỘT LẦN lúc hai bên nhận lời vào phòng có buff, hiện cho cả hai thấy rồi mới đánh.
 * Hào quang hết giờ, đổi công đức hay cúng dường giữa trận không ảnh hưởng trận đang đánh.
 *
 * Công thức gốc (số thử nghiệm của chủ dự án), trước khi nhân hệ số RULES.BUFF_SCALE:
 *   Pháp tướng: giảm sát thương = min(2% × Lc, 12%) · cộng né = min(1 điểm × Lc, 6 điểm)
 *   Quỷ:        tăng sát thương = min(4% × Lq, 16%)
 *   Hào quang:  tăng sát thương = min(2% × Ld, 18%) · giảm sát thương = min(1% × Ld, 9%) · cộng né = min(0,5 điểm × Ld, 4,5 điểm)
 * Tổng cuối cùng còn bị chặn bởi các trần trong rules.js (tăng tối đa +50% gồm cả nộ, giảm bị động tối đa 15%,
 * cộng né tối đa 8 điểm, xác suất né tối đa 90%) nên không ai bất tử hoặc né 100%.
 * Buff né chỉ áp dụng cho NÉ, không áp dụng cho ĐỠ (parry).
 */
const R = require('./rules');

const clampInt = (v, lo, hi) => Math.max(lo, Math.min(hi, Number.isFinite(+v) ? Math.floor(+v) : 0));
const pct = x => (Math.round(x * 1000) / 10).toString().replace('.', ',');   // 0.065 → "6,5"

const NONE = Object.freeze({ Lc: 0, Lq: 0, Ld: 0, offExt: 0, defP: 0, dodgeB: 0, labels: [] });

/**
 * @param {{Lc?:number, Lq?:number, Ld?:number}} levels
 * @param {number} [scale]  hệ số nhân, mặc định RULES.BUFF_SCALE
 * @returns {{Lc:number, Lq:number, Ld:number, offExt:number, defP:number, dodgeB:number, labels:string[]}}
 *   offExt: cộng vào sát thương gây ra · defP: giảm sát thương nhận · dodgeB: cộng xác suất né (0.03 = 3 điểm %)
 */
function computeBuff(levels, scale = R.BUFF_SCALE) {
  const Lc = clampInt(levels && levels.Lc, 0, 6), Lq = clampInt(levels && levels.Lq, 0, 4), Ld = clampInt(levels && levels.Ld, 0, 9);
  if (!Lc && !Lq && !Ld) return NONE;
  const pt = { def: Math.min(0.02 * Lc, 0.12), dodge: Math.min(0.01 * Lc, 0.06) };
  const qu = { off: Math.min(0.04 * Lq, 0.16) };
  const hq = { off: Math.min(0.02 * Ld, 0.18), def: Math.min(0.01 * Ld, 0.09), dodge: Math.min(0.005 * Ld, 0.045) };
  const offExt = Math.min(R.OFF_CAP, (qu.off + hq.off) * scale);
  const defP = Math.min(R.DEF_PASSIVE_CAP, (pt.def + hq.def) * scale);
  const dodgeB = Math.min(R.DODGE_BONUS_CAP, (pt.dodge + hq.dodge) * scale);
  const labels = [];
  if (Lc) labels.push(`Pháp tướng cấp ${Lc}: giảm ${pct(pt.def * scale)}% sát thương nhận, cộng ${pct(pt.dodge * scale)} điểm né`);
  if (Lq) labels.push(`Quỷ ám cấp ${Lq}: tăng ${pct(qu.off * scale)}% sát thương gây ra`);
  if (Ld) labels.push(`Hào quang cảnh giới ${Ld}: tăng ${pct(hq.off * scale)}% sát thương, giảm ${pct(hq.def * scale)}% sát thương nhận, cộng ${pct(hq.dodge * scale)} điểm né`);
  return { Lc, Lq, Ld, offExt, defP, dodgeB, labels };
}

module.exports = { computeBuff, NONE };
