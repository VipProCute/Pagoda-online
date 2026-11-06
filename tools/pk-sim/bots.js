'use strict';
/*
 * Ba loại bot, mỗi lượt chọn một lựa chọn hợp lệ của Duel thật:
 *   random  chọn đều trong chiêu đủ nội lực; chỉ Điều tức khi nội lực <= 20 hoặc hết chiêu dùng được
 *   greedy  tham lam một lượt: chọn chiêu có kỳ vọng tốt nhất nếu đối thủ chọn đều ngẫu nhiên
 *   eq      cân bằng kéo-búa-bao: lập ma trận kỳ vọng một lượt (liệt kê mọi nhánh né / đỡ trên Duel thật),
 *           giải trò chơi tổng bằng 0 bằng regret matching, rồi rút thăm theo chiến lược hỗn hợp
 * Hai bot cùng loại định giá giống nhau nên chia sẻ một ma trận mỗi lượt. Bot chỉ nhìn trước MỘT lượt
 * (trừ tụ lực: tính luôn lượt tung đòn bắt buộc) và không đọc thói quen đối thủ.
 */
const { outcomes, expectedValue } = require('./enumerate');

/* trọng số định giá một lượt, quy ra "máu": nội lực, nộ, Kim Chung, sơ hở, thắng/thua dứt điểm */
const W = { mana: 0.3, rage: 0.08, kc: 4, exposed: 3.2, terminal: 40 };

/** Giá trị trạng thái sau lượt theo góc nhìn của bên a (dương là a lợi). */
function value(d) {
  const a = d.f.a, b = d.f.b;
  let v = Math.max(0, a.hp) - Math.max(0, b.hp);
  v += W.mana * (a.mana - b.mana) + W.rage * (a.rage - b.rage);
  v += W.kc * ((a.kc > 0 ? 1 : 0) - (b.kc > 0 ? 1 : 0)) - W.exposed * (a.exposed - b.exposed);
  if (d.over) v += d.over.result === 'a' ? W.terminal : d.over.result === 'b' ? -W.terminal : 0;
  return v;
}
/** Chỉ máu và dứt điểm (dùng cho nhìn trước lượt tung đòn tụ lực). */
function hpValue(d) {
  let v = Math.max(0, d.f.a.hp) - Math.max(0, d.f.b.hp);
  if (d.over) v += d.over.result === 'a' ? W.terminal : d.over.result === 'b' ? -W.terminal : 0;
  return v;
}

/** Nhìn trước lượt tung đòn: bên đang tụ lực bị ép tung, bên kia chọn cách đỡ tốt nhất. */
function chargeLook(d) {
  if (d.over) return 0;
  const ca = d.f.a.charging, cb = d.f.b.charging;
  if (!ca && !cb) return 0;
  if (ca && cb) { return expectedValue(outcomes(d, ca, cb), hpValue); }
  if (ca) {
    let best = Infinity;
    for (const g of d.legal('b').picks) best = Math.min(best, expectedValue(outcomes(d, ca, g), hpValue));
    return best;
  }
  let best = -Infinity;
  for (const g of d.legal('a').picks) best = Math.max(best, expectedValue(outcomes(d, g, cb), hpValue));
  return best;
}

/** Ma trận kỳ vọng M[i][j] (góc nhìn bên a) với a chọn picksA[i], b chọn picksB[j]. */
function matrix(d, picksA, picksB) {
  return picksA.map(pa => picksB.map(pb => {
    let v = 0;
    for (const br of outcomes(d, pa, pb)) v += br.w * (value(br.d) + chargeLook(br.d));
    return v;
  }));
}

/** Giải trò chơi ma trận tổng bằng 0: chiến lược trung bình của hai bên (regret matching+, trung bình tuyến tính). */
function solve(Mx, iters = 500) {
  const n = Mx.length, m = Mx[0].length;
  if (n === 1 && m === 1) return [[1], [1]];
  const rA = new Float64Array(n), rB = new Float64Array(m), sA = new Float64Array(n), sB = new Float64Array(m);
  const pA = new Float64Array(n), pB = new Float64Array(m);
  const strat = (r, p) => { let s = 0; for (let i = 0; i < r.length; i++) s += r[i]; for (let i = 0; i < r.length; i++) p[i] = s > 0 ? r[i] / s : 1 / r.length; };
  for (let t = 1; t <= iters; t++) {
    strat(rA, pA); strat(rB, pB);
    let vA = 0;
    const uA = new Float64Array(n), uB = new Float64Array(m);
    for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) { const x = Mx[i][j]; uA[i] += x * pB[j]; uB[j] -= x * pA[i]; }
    for (let i = 0; i < n; i++) vA += uA[i] * pA[i];
    let vB = 0;
    for (let j = 0; j < m; j++) vB += uB[j] * pB[j];
    for (let i = 0; i < n; i++) { rA[i] = Math.max(0, rA[i] + uA[i] - vA); sA[i] += t * pA[i]; }
    for (let j = 0; j < m; j++) { rB[j] = Math.max(0, rB[j] + uB[j] - vB); sB[j] += t * pB[j]; }
  }
  const norm = s => { let z = 0; for (const x of s) z += x; return Array.from(s, x => x / z); };
  return [norm(sA), norm(sB)];
}

const sample = (list, p, r) => { let x = r(); for (let i = 0; i < p.length - 1; i++) { x -= p[i]; if (x < 0) return list[i]; } return list[list.length - 1]; };

/** Khóa nhóm trạng thái để dùng lại lời giải (làm tròn nội lực, nộ; máu chỉ chính xác khi thấp). */
function stateKey(d, la, lb) {
  const f = s => {
    const x = d.f[s];
    const hp = x.hp <= 90 ? x.hp : 'H';
    return `${hp},${Math.floor(x.mana / 8)},${Math.round(x.rage / 10)},${x.kc},${x.exposed},${x.charging || ''},${x.offExt},${x.defP},${x.dodgeB},${x.manaMax}`;
  };
  const late = d.sudden != null || d.turn >= 18 ? d.turn + ':' + d.noDamageStreak : d.noDamageStreak;
  return la + '|' + lb + '|' + f('a') + '|' + f('b') + '|' + late;
}

const randomPick = (d, side, r, restId) => {
  const l = d.legal(side);
  if (l.forced) return l.forced;
  const sk = l.picks.filter(x => x !== restId), mana = d.f[side].mana;
  const list = sk.length && mana > 20 ? sk : l.picks;
  return list[Math.floor(r() * list.length)];
};

/**
 * Chọn cho cả hai bên. kinds: ['eq' | 'greedy' | 'random', ...]; cache: Map dùng lại lời giải giữa các trận cùng cặp bộ chiêu
 * (truyền null để tắt); exact: không gom nhóm trạng thái.
 */
function decide(d, kinds, r, cache, keyBase, stats, restId) {
  const la = d.legal('a'), lb = d.legal('b');
  const need = kinds[0] !== 'random' || kinds[1] !== 'random';
  let sol = null;
  if (need && (!la.forced || !lb.forced)) {
    const key = cache ? keyBase + '#' + stateKey(d, la.picks.join(), lb.picks.join()) : null;
    sol = key ? cache.get(key) : null;
    if (!sol) {
      sol = { Mx: matrix(d, la.picks, lb.picks), eq: null };
      if (key) cache.set(key, sol);
      if (stats) stats.solved++;
    } else if (stats) stats.hit++;
    if (kinds.includes('eq') && !sol.eq) sol.eq = solve(sol.Mx);
  } else if (stats && need) stats.skipped++;
  const pick = (side, i, list, forced) => {
    if (forced) return forced;
    const kind = kinds[i];
    if (kind === 'random') return randomPick(d, side, r, restId);
    if (kind === 'eq') return sample(list, sol.eq[i], r);
    // greedy: tối đa hóa kỳ vọng nếu đối thủ chọn đều
    const Mx = sol.Mx;
    let best = -Infinity, bi = 0;
    if (i === 0) for (let x = 0; x < Mx.length; x++) { const v = Mx[x].reduce((s, y) => s + y, 0) / Mx[x].length; if (v > best + 1e-9) { best = v; bi = x; } }
    else for (let y = 0; y < Mx[0].length; y++) { let v = 0; for (let x = 0; x < Mx.length; x++) v -= Mx[x][y]; v /= Mx.length; if (v > best + 1e-9) { best = v; bi = y; } }
    return list[bi];
  };
  return [pick('a', 0, la.picks, la.forced), pick('b', 1, lb.picks, lb.forced)];
}

module.exports = { decide, matrix, solve, value, W, randomPick, stateKey };
