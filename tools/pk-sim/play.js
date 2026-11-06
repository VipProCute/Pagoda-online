'use strict';
const { makeRng } = require('../../lib/pk/rng');
const { decide } = require('./bots');
const { realCtx } = require('./ctx');

/**
 * Chơi một trận trên Duel thật. o: { seed, bots:[kind,kind], loadouts:{a,b}, levels:[la,lb], buffs:[ba,bb], ctx, cache, exact, stats }.
 * Tái lập theo seed (kể cả bot). Trả về tóm tắt một trận.
 */
function playMatch(o) {
  const ctx = o.ctx || realCtx();
  const levels = o.levels || [7, 7], buffs = o.buffs || [];
  const seed = String(o.seed);
  const d = new ctx.Duel({
    seed, a: { level: levels[0], loadout: o.loadouts.a, buff: buffs[0] }, b: { level: levels[1], loadout: o.loadouts.b, buff: buffs[1] }
  });
  const r = makeRng(seed + '|bot');
  const kinds = o.bots || ['eq', 'eq'];
  const cache = o.exact ? null : (o.cache || new Map());
  const keyBase = o.loadouts.a.join() + '/' + o.loadouts.b.join();
  const usage = { a: {}, b: {} }, dec = { a: 0, b: 0 };
  let turns = 0;
  while (!d.over) {
    const [pa, pb] = decide(d, kinds, r, cache, keyBase, o.stats, ctx.M.REST_ID);
    const out = d.step(pa, pb);
    turns = out.turn;
    for (const s of ['a', 'b']) {
      const p = out.picks[s];
      if (p.phase === 'release') continue;
      usage[s][p.skill] = (usage[s][p.skill] || 0) + 1;
      dec[s]++;
    }
  }
  return {
    winner: d.over.result, reason: d.over.reason, turns, sudden: d.sudden != null && d.sudden < turns + 1,
    suddenFrom: d.sudden, hp: [d.f.a.hp, d.f.b.hp], usage, decisions: dec
  };
}

/** Điểm của bên a: thắng 1, hòa 0,5. */
const scoreOf = w => (w === 'a' ? 1 : w === 'draw' ? 0.5 : 0);

/**
 * Chơi n trận cùng cấu hình, seed `${seed}:${i}`; dùng chung bộ nhớ đệm lời giải. Trả về thống kê gộp.
 */
function series(o, n, seed) {
  const cache = o.exact ? null : new Map();
  const res = { n, a: 0, b: 0, draw: 0, turns: [], sudden: 0, reasons: {}, usage: { a: {}, b: {} }, decisions: { a: 0, b: 0 }, sumSq: 0, sum: 0 };
  for (let i = 0; i < n; i++) {
    const m = playMatch({ ...o, seed: `${seed}:${i}`, cache });
    res[m.winner === 'a' ? 'a' : m.winner === 'b' ? 'b' : 'draw']++;
    res.turns.push(m.turns);
    if (m.sudden) res.sudden++;
    res.reasons[m.reason] = (res.reasons[m.reason] || 0) + 1;
    for (const s of ['a', 'b']) {
      res.decisions[s] += m.decisions[s];
      for (const k in m.usage[s]) res.usage[s][k] = (res.usage[s][k] || 0) + m.usage[s][k];
    }
    const x = scoreOf(m.winner);
    res.sum += x; res.sumSq += x * x;
  }
  return summarize(res);
}

function summarize(r) {
  const n = r.n, mean = r.sum / n, varr = Math.max(0, r.sumSq / n - mean * mean);
  const t = r.turns.slice().sort((x, y) => x - y);
  return {
    n, win: r.a / n, loss: r.b / n, draw: r.draw / n, score: mean, se: Math.sqrt(varr / n),
    medTurns: t[Math.floor(n / 2)], p90Turns: t[Math.floor(n * 0.9)], meanTurns: t.reduce((s, x) => s + x, 0) / n,
    sudden: r.sudden / n, reasons: r.reasons, usage: r.usage, decisions: r.decisions
  };
}

module.exports = { playMatch, series, scoreOf, summarize };
