'use strict';
/*
 * Ước tính thời gian tu luyện để đủ điều kiện học chiêu / lên cấp, cho người chơi chăm.
 * Quy hoạch động trên (công lực, tổng tâm đắc cần thiết) với giả định chia tâm đắc đều ba nhánh:
 * là cận dưới (thực tế lệch nhánh và phiên dài thô hơn nên lâu hơn một chút).
 */
const M = require('../../public/js/martial');

function options(limit) {
  const out = [];
  for (const m of M.METHOD_LIST) for (const d of m.durations) {
    if (limit && ((limit.max && d.minutes > limit.max) || (limit.min && d.minutes < limit.min))) continue;
    const r = M.rewardOf(m.id, d.key);
    out.push({ id: m.id, name: m.name, key: d.key, minutes: d.minutes, congLuc: r.congLuc, tam: r.tam.cuong + r.tam.toc + r.tam.nhu, reqLevel: m.reqLevel });
  }
  return out;
}

/** Số phút ít nhất để đạt `congLuc` và tổng tâm đắc `tam` (cộng cả ba nhánh). limit: { max?, min? } độ dài phiên (phút). */
function plan(congLuc, tam, limit) {
  const C = congLuc, T = tam, W = T + 1, INF = 1e12;
  const opts = options(limit);
  const best = new Float64Array((C + 1) * W).fill(INF), from = new Int32Array((C + 1) * W).fill(-1), via = new Int16Array((C + 1) * W).fill(-1);
  best[0] = 0;
  for (let c = 0; c <= C; c++) {
    const lv = M.levelOf(c);
    for (let t = 0; t <= T; t++) {
      const v = best[c * W + t];
      if (v >= INF) continue;
      for (let i = 0; i < opts.length; i++) {
        const o = opts[i];
        if (o.reqLevel > lv) continue;
        const nc = Math.min(C, c + o.congLuc), nt = Math.min(T, t + o.tam), k = nc * W + nt, nv = v + o.minutes;
        if (nv < best[k]) { best[k] = nv; from[k] = c * W + t; via[k] = i; }
      }
    }
  }
  const end = C * W + T;
  if (best[end] >= INF) return { minutes: Infinity, sessions: [] };
  const count = new Map();
  for (let k = end; from[k] >= 0; k = from[k]) { const o = opts[via[k]], key = o.name + ' ' + o.key; count.set(key, (count.get(key) || 0) + 1); }
  return { minutes: best[end], sessions: [...count].map(([name, n]) => ({ name, n })) };
}

/** Điều kiện (công lực, tổng tâm đắc) để học hết các chiêu tới bậc `tier`. */
function needFor(tier) {
  const r = M.TIER_REQ[tier];
  return { congLuc: M.LEVEL_AT[r.level - 1], tam: 3 * r.tam };
}

/** Bảng thời gian: mỗi bậc chiêu, đủ 15 chiêu, và cấp tối đa; theo ba kiểu người chơi. */
function report() {
  const kinds = [
    { name: 'liên tục, chọn phiên tối ưu', limit: null },
    { name: 'chỉ phiên từ 4 giờ trở lên (ít phải vào)', limit: { min: 240 } },
    { name: 'chỉ phiên tối đa 1 giờ (phải canh)', limit: { max: 60 } }
  ];
  const rows = [];
  for (const k of kinds) {
    const row = { kind: k.name, tiers: {} };
    for (const tier of [2, 3, 4]) { const n = needFor(tier); row.tiers[tier] = plan(n.congLuc, n.tam, k.limit); }
    row.max = plan(M.CONG_LUC_MAX, 3 * M.TAM_MAX, k.limit);
    rows.push(row);
  }
  return rows;
}

module.exports = { plan, needFor, report, options };
