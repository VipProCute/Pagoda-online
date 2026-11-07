'use strict';
const { makeRng } = require('../../lib/pk/rng');
const { series } = require('./play');
const L = require('./loadouts');
const { makeCtx } = require('./ctx');
const F = require('./format');

const log = (o, msg) => { if (!o.quiet) process.stderr.write(msg + '\n'); };

/** Bối cảnh + tham số chung. */
function common(o) {
  const ctx = makeCtx(o.set);
  const bot = o.mode || 'eq';
  if (!['eq', 'greedy', 'random'].includes(bot)) throw new Error('--mode phải là eq, greedy hoặc random');
  const lv = Number(o.level == null ? 7 : o.level);
  return { ctx, bot, bots: [bot, bot], level: lv, levels: [lv, lv], seed: String(o.seed == null ? 1 : o.seed), exact: !o.fast };
}

const metaOf = (name, c, o, extra) => ({ command: name, mode: c.bot, level: c.level, seed: c.seed, set: [].concat(o.set || []), exact: c.exact, ...extra });

function skillName(ctx, id) { return ctx.M.SKILLS[id].name; }

/* ---------- roundrobin ---------- */

function pickSets(c, which, seed) {
  const m = /^random:(\d+)$/.exec(which || '');
  if (m) return shuffle(L.allSets(c.ctx.M), makeRng(seed + ':sets')).slice(0, Number(m[1]));
  if (which === 'pure') return L.pureSets(c.ctx.M);
  if (which === 'all') return [...L.PRESETS, ...L.pureSets(c.ctx.M)];
  if (which === 'check') return [...L.PRESETS.slice(0, 4), L.NO_ATTACK];
  return L.PRESETS;
}

function roundrobin(o) {
  const c = common(o), t0 = Date.now();
  const games = Number(o.games || 150), which = o.sets || 'presets';
  const sets = pickSets(c, which, c.seed), n = sets.length;
  const matrix = Array.from({ length: n }, () => new Array(n).fill(null));
  const cell = Array.from({ length: n }, () => new Array(n).fill(null));
  const useUses = {}, useDec = {};
  let restUses = 0, restDec = 0;
  const tot = { n: 0, draw: 0, sudden: 0, turns: [], reasons: {} };
  let done = 0;
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    const r = series({ bots: c.bots, loadouts: { a: sets[i].ids, b: sets[j].ids }, levels: c.levels, ctx: c.ctx, exact: c.exact }, games, `${c.seed}:rr:${i}:${j}`);
    matrix[i][j] = r.score; matrix[j][i] = 1 - r.score;
    cell[i][j] = { win: r.win, loss: r.loss, draw: r.draw, med: r.medTurns, p90: r.p90Turns, sudden: r.sudden, se: r.se };
    restUses += (r.usage.a[c.ctx.M.REST_ID] || 0) + (r.usage.b[c.ctx.M.REST_ID] || 0); restDec += r.decisions.a + r.decisions.b;
    for (const [side, idx] of [['a', i], ['b', j]]) {
      for (const id of sets[idx].ids) { useUses[id] = (useUses[id] || 0) + (r.usage[side][id] || 0); useDec[id] = (useDec[id] || 0) + r.decisions[side]; }
    }
    tot.n += r.n; tot.draw += r.draw * r.n; tot.sudden += r.sudden * r.n;
    tot.turns.push([r.medTurns, r.meanTurns, r.n]);
    for (const k in r.reasons) tot.reasons[k] = (tot.reasons[k] || 0) + r.reasons[k];
    if (++done % 20 === 0) log(o, `[roundrobin] ${done}/${n * (n - 1) / 2}`);
  }
  const scores = sets.map((s, i) => {
    const vals = matrix[i].filter((x, j) => j !== i && x != null);
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    return { name: s.name, ids: s.ids, branch: s.branch || null, score: mean, min: Math.min(...vals), max: Math.max(...vals) };
  });
  const usage = Object.keys(useUses).map(id => ({ id, abbr: L.abbr(id), name: skillName(c.ctx, id), share: useUses[id] / useDec[id], held: sets.filter(s => s.ids.includes(id)).length }));
  usage.push({ id: c.ctx.M.REST_ID, abbr: 'ĐT', name: 'Điều tức', share: restUses / restDec, held: n });
  usage.sort((a, b) => b.share - a.share);
  const medTurns = (() => { const arr = []; for (const [m, , k] of tot.turns) for (let q = 0; q < k; q++) arr.push(m); arr.sort((a, b) => a - b); return arr[Math.floor(arr.length / 2)]; })();
  const res = {
    meta: metaOf('roundrobin', c, o, { games, sets: which, pairs: n * (n - 1) / 2, totalGames: tot.n, elapsedMs: Date.now() - t0 }),
    sets: sets.map(s => ({ name: s.name, ids: s.ids, branch: s.branch || null })), matrix, cell, scores, usage,
    totals: { drawRate: tot.draw / tot.n, suddenRate: tot.sudden / tot.n, medianOfPairMedians: medTurns, meanTurns: tot.turns.reduce((a, [, m, k]) => a + m * k, 0) / tot.n, reasons: tot.reasons }
  };
  if (which === 'pure') {
    res.branches = branchMatrix(c.ctx, sets, matrix);
    res.branchesAttack = branchMatrix(c.ctx, sets, matrix, st => st.ids.some(id => c.ctx.M.isAttacking(c.ctx.M.SKILLS[id])));
  }
  return res;
}

/** Trung bình điểm theo nhánh: hàng thắng cột, gộp mọi cặp bộ thuần của hai nhánh. */
function branchMatrix(ctx, sets, matrix, keep) {
  const B = ctx.M.BRANCH_ORDER, out = {};
  const ok = s => !keep || keep(s);
  for (const x of B) {
    out[x] = {};
    for (const y of B) {
      if (x === y) { out[x][y] = null; continue; }
      const vals = [];
      sets.forEach((s, i) => sets.forEach((t, j) => { if (ok(s) && ok(t) && s.branch === x && t.branch === y) vals.push(matrix[i][j]); }));
      const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
      const sd = Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length);
      out[x][y] = { score: mean, sd, min: Math.min(...vals), max: Math.max(...vals), pairs: vals.length };
    }
  }
  return out;
}

function printBranches(ctx, bm, label) {
  const B = ctx.M.BRANCH_ORDER, name = b => ctx.M.BRANCHES[b].name;
  const rows = B.map(x => [name(x), ...B.map(y => (x === y ? '-' : F.pct(bm[x][y].score) + '%'))]);
  let s = F.title(`Quan hệ giữa các nhánh (điểm của hàng so với cột, trung bình mọi cặp bộ thuần${label || ''})`) + '\n' + F.table(['', ...B.map(name)], rows);
  s += '\nLàm tròn; khoảng dao động giữa các cặp bộ (thấp nhất - cao nhất):\n';
  for (const x of B) for (const y of B) if (x !== y && B.indexOf(x) < B.indexOf(y)) {
    const v = bm[x][y]; s += `  ${name(x)} vs ${name(y)}: ${F.pct(v.score)}% (từng cặp bộ từ ${F.pct(v.min)}% tới ${F.pct(v.max)}%)\n`;
  }
  return s;
}

function printRoundrobin(r, ctx) {
  const n = r.sets.length;
  let s = `Đấu vòng tròn · bot ${r.meta.mode} · cấp ${r.meta.level} · ${r.meta.games} trận mỗi cặp (${r.meta.pairs} cặp, ${r.meta.totalGames} trận) · seed ${r.meta.seed} · ${(r.meta.elapsedMs / 1000).toFixed(1)}s`;
  s += F.title('Điểm trung bình mỗi bộ (thắng = 1, hòa = 0,5) so với các bộ còn lại');
  const ord = r.scores.map((x, i) => ({ ...x, i })).sort((a, b) => b.score - a.score);
  s += '\n' + F.table(['Bộ', 'Chiêu', 'Điểm', 'Thấp nhất', 'Cao nhất'], ord.map(x => [x.name, x.ids.map(L.abbr).join(' '), F.pct(x.score, 1) + '%', F.pct(x.min) + '%', F.pct(x.max) + '%']), ['l', 'l', 'r', 'r', 'r']);
  s += F.title('Ma trận điểm (hàng so với cột, %)');
  const hdr = ['', ...r.sets.map((x, i) => String(i + 1))];
  s += '\n' + F.table(hdr, r.sets.map((x, i) => [`${i + 1} ${x.name}`, ...r.matrix[i].map((v, j) => (i === j ? '-' : F.pct(v)))]), ['l', ...r.sets.map(() => 'r')]);
  if (r.branches) s += printBranches(ctx, r.branches) + printBranches(ctx, r.branchesAttack, ', chỉ bộ có đòn tấn công chủ động');
  s += F.title('Tỉ lệ chọn từng chiêu (trong các lần được chọn tự do khi chiêu có trong bộ; đều tay = 20%)');
  s += '\n' + F.table(['Chiêu', 'Tên', 'Chọn', 'Trong số bộ'], r.usage.map(u => [u.abbr, u.name, F.pct(u.share, 1) + '%', u.held]), ['l', 'l', 'r', 'r']);
  const t = r.totals;
  s += F.title('Độ dài trận');
  s += `\nLượt trung vị: ${t.medianOfPairMedians} · trung bình: ${t.meanTurns.toFixed(1)} · hòa: ${F.pct(t.drawRate, 1)}% · vào suy kiệt: ${F.pct(t.suddenRate, 1)}%\nKết thúc: ${Object.entries(t.reasons).map(([k, v]) => `${k} ${F.pct(v / r.meta.totalGames, 1)}%`).join(' · ')}`;
  return s + '\n';
}

/* ---------- grid ---------- */

function shuffle(arr, r) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

function scoreVs(c, ids, opps, g, seed, bot) {
  let sum = 0, n = 0;
  const win = { w: 0, d: 0, l: 0 };
  opps.forEach((op, k) => {
    const r = series({ bots: [bot, bot], loadouts: { a: ids, b: op.ids }, levels: c.levels, ctx: c.ctx, exact: c.exact }, g, `${seed}:${k}`);
    sum += r.score * g; n += g; win.w += r.win * g; win.d += r.draw * g; win.l += r.loss * g;
  });
  const mean = sum / n;
  return { score: mean, n, win: win.w / n, draw: win.d / n, loss: win.l / n };
}

function grid(o) {
  const c = common(o), t0 = Date.now();
  const all = L.allSets(c.ctx.M);
  const K = Number(o.opp || 24), G = Number(o.games || 5), r = makeRng(c.seed + ':grid');
  const opps = shuffle(all, r).slice(0, K);
  const top = Number(o.top || 30), extra = Number(o.sample || 120), K2 = Number(o.opp2 || 12), G2 = Number(o.games2 || 3);
  const finN = Number(o.finalists || 12), finK = Number(o.finalOpp || 20), finG = Number(o.finalGames || 6);
  // 1) sàng lọc bằng bot ngẫu nhiên trên mọi bộ
  const screen = all.map((s, i) => ({ ...s, i, ...scoreVs(c, s.ids, opps.filter(x => x.name !== s.name), G, `${c.seed}:g1:${i}`, 'random') }));
  log(o, `[grid] sàng lọc xong ${all.length} bộ (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  const byScreen = screen.slice().sort((a, b) => b.score - a.score);
  // 2) bot eq trên: đầu bảng + mẫu ngẫu nhiên của phần còn lại
  const head = byScreen.slice(0, top);
  const rest = shuffle(byScreen.slice(top), makeRng(c.seed + ':grid2')).slice(0, extra);
  const opps2 = shuffle(all, makeRng(c.seed + ':opp2')).slice(0, K2);
  const eqScore = new Map();
  [...head, ...rest].forEach(s => eqScore.set(s.i, scoreVs(c, s.ids, opps2.filter(x => x.name !== s.name), G2, `${c.seed}:g2:${s.i}`, 'eq')));
  log(o, `[grid] bot eq xong ${head.length + rest.length} bộ (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  // 3) vòng chung kết: những bộ điểm eq cao nhất, nhiều trận hơn, đối thủ khác
  const fin = [...eqScore.entries()].map(([i, v]) => ({ i, v })).sort((a, b) => b.v.score - a.v.score).slice(0, finN);
  const oppsF = shuffle(all, makeRng(c.seed + ':oppF')).slice(0, finK);
  const strong = [...eqScore.entries()].map(([i, v]) => ({ i, v })).sort((a, b) => b.v.score - a.v.score).slice(0, finK + 1).map(x => screen[x.i]);
  const finals = fin.map(({ i }) => {
    const s = screen[i];
    const res = scoreVs(c, s.ids, oppsF.filter(x => x.name !== s.name), finG, `${c.seed}:gf:${i}`, 'eq');
    const st = scoreVs(c, s.ids, strong.filter(x => x.name !== s.name).slice(0, finK), finG, `${c.seed}:gs:${i}`, 'eq');
    return { name: s.name, ids: s.ids, branch: L.branchOf(c.ctx.M, s.ids), random: s.score, eq1: eqScore.get(i).score, eq: res.score, strong: st.score, n: res.n };
  });
  finals.sort((a, b) => b.strong - a.strong);
  // thống kê chiêu: điểm trung bình của các bộ có chiêu đó (bot ngẫu nhiên: mọi bộ; bot eq: chỉ mẫu ngẫu nhiên, không thiên lệch)
  const skills = c.ctx.M.SKILL_ORDER.map(id => {
    const withS = screen.filter(x => x.ids.includes(id)), eqs = rest.filter(x => x.ids.includes(id)).map(x => eqScore.get(x.i).score);
    return { id, abbr: L.abbr(id), name: skillName(c.ctx, id), random: withS.reduce((a, b) => a + b.score, 0) / withS.length, eq: eqs.length ? eqs.reduce((a, b) => a + b, 0) / eqs.length : null, eqN: eqs.length };
  });
  const sc = screen.map(x => x.score), mean = sc.reduce((a, b) => a + b, 0) / sc.length, sd = Math.sqrt(sc.reduce((a, b) => a + (b - mean) ** 2, 0) / sc.length);
  const sampleEq = rest.map(x => eqScore.get(x.i).score), meanEq = sampleEq.reduce((a, b) => a + b, 0) / sampleEq.length;
  const sdEq = Math.sqrt(sampleEq.reduce((a, b) => a + (b - meanEq) ** 2, 0) / sampleEq.length);
  return {
    meta: metaOf('grid', c, o, { sets: all.length, opponents: K, gamesPerOpp: G, eqOpponents: K2, eqGames: G2, finalists: finN, finalOpp: finK, finalGames: finG, elapsedMs: Date.now() - t0 }),
    random: { mean, sd, min: Math.min(...sc), max: Math.max(...sc) },
    eqSample: { n: sampleEq.length, mean: meanEq, sd: sdEq, min: Math.min(...sampleEq), max: Math.max(...sampleEq) },
    topRandom: byScreen.slice(0, top).map(x => ({ name: x.name, branch: L.branchOf(c.ctx.M, x.ids), random: x.score, eq: eqScore.has(x.i) ? eqScore.get(x.i).score : null })),
    bottomRandom: byScreen.slice(-10).reverse().map(x => ({ name: x.name, branch: L.branchOf(c.ctx.M, x.ids), random: x.score })),
    finals, skills
  };
}

function printGrid(r) {
  const m = r.meta;
  let s = `Quét mọi bộ 4 chiêu (${m.sets} bộ) · cấp ${m.level} · seed ${m.seed} · ${(m.elapsedMs / 1000).toFixed(1)}s`;
  s += `\nGiai đoạn 1: bot ngẫu nhiên, ${m.opponents} đối thủ × ${m.gamesPerOpp} trận mỗi bộ. Giai đoạn 2: bot eq cho ${r.topRandom.length} bộ đầu bảng + ${r.eqSample.n} bộ chọn ngẫu nhiên, ${m.eqOpponents} đối thủ × ${m.eqGames} trận. Giai đoạn 3: ${m.finalists} bộ eq cao nhất đấu ${m.finalOpp} bộ ngẫu nhiên khác và ${m.finalOpp} bộ mạnh nhất vòng 2, mỗi đối thủ ${m.finalGames} trận.`;
  s += F.title('Phân bố điểm');
  s += `\nBot ngẫu nhiên: trung bình ${F.pct(r.random.mean, 1)}%, độ lệch ${F.pct(r.random.sd, 1)}, thấp nhất ${F.pct(r.random.min)}%, cao nhất ${F.pct(r.random.max)}%`;
  s += `\nBot eq (mẫu ${r.eqSample.n} bộ ngẫu nhiên): trung bình ${F.pct(r.eqSample.mean, 1)}%, độ lệch ${F.pct(r.eqSample.sd, 1)}, thấp nhất ${F.pct(r.eqSample.min)}%, cao nhất ${F.pct(r.eqSample.max)}%`;
  s += F.title('Chung kết (bot eq): điểm so với bộ ngẫu nhiên và so với nhóm bộ mạnh nhất');
  s += '\n' + F.table(['Bộ', 'Nhánh', 'Ngẫu nhiên', 'Eq vòng 2', 'Eq vs ngẫu nhiên', 'Eq vs nhóm mạnh', 'Số trận'], r.finals.map(x => [x.name, x.branch, F.pct(x.random) + '%', F.pct(x.eq1) + '%', F.pct(x.eq) + '%', F.pct(x.strong) + '%', x.n]), ['l', 'l', 'r', 'r', 'r', 'r', 'r']);
  s += F.title('Đầu bảng bot ngẫu nhiên');
  s += '\n' + F.table(['Bộ', 'Nhánh', 'Ngẫu nhiên', 'Eq vòng 2'], r.topRandom.slice(0, 15).map(x => [x.name, x.branch, F.pct(x.random) + '%', x.eq == null ? '' : F.pct(x.eq) + '%']), ['l', 'l', 'r', 'r']);
  s += F.title('Cuối bảng bot ngẫu nhiên');
  s += '\n' + F.table(['Bộ', 'Nhánh', 'Ngẫu nhiên'], r.bottomRandom.map(x => [x.name, x.branch, F.pct(x.random) + '%']), ['l', 'l', 'r']);
  s += F.title('Điểm trung bình của các bộ có chiêu này');
  s += '\n' + F.table(['Chiêu', 'Tên', 'Ngẫu nhiên', 'Eq (mẫu)'], r.skills.slice().sort((a, b) => (b.eq == null ? b.random : b.eq) - (a.eq == null ? a.random : a.eq)).map(x => [x.abbr, x.name, F.pct(x.random, 1) + '%', x.eq == null ? '' : F.pct(x.eq, 1) + '%']), ['l', 'l', 'r', 'r']);
  return s + '\n';
}

/* ---------- buffs ---------- */

const MIRRORS = ['Cương1', 'Tốc1', 'Nhu1', 'Phối1'];
function namedSets(names) {
  const out = [];
  for (const nm of names) {
    const p = L.PRESETS.find(x => x.name === nm);
    if (p) out.push(p);
    else if (L.CODE[nm.split(/[ ,]+/)[0]]) out.push({ name: nm, ids: L.ids(nm.replace(/,/g, ' ')) });
    else throw new Error('Không có bộ ' + nm + ' (dùng tên bộ tiêu biểu hoặc viết tắt chiêu, vd "TQ TPQ KTB TLB")');
  }
  return out;
}

function buffs(o) {
  const c = common(o), t0 = Date.now();
  const games = Number(o.games || 80);
  const scales = String(o.scales || '0.25,0.5,1').split(',').map(Number);
  const sets = namedSets(o.sets ? String(o.sets).split('|') : MIRRORS);
  const full = !!o.full, onlyMax = o.only === 'max';
  const LC = full ? [0, 1, 2, 3, 4, 5, 6] : [0, 2, 4, 6], LQ = full ? [1, 2, 3, 4] : [1, 2, 3, 4], LD = full ? [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] : [0, 3, 6, 9];
  const out = { sets: [] };
  for (const st of sets) {
    const ent = { name: st.name, ids: st.ids, scales: [] };
    for (const scale of scales) {
      const run = (lv, tag) => {
        const b = c.ctx.computeBuff(lv, scale);
        const r = series({ bots: c.bots, loadouts: { a: st.ids, b: st.ids }, levels: c.levels, buffs: [b, undefined], ctx: c.ctx, exact: c.exact }, games, `${c.seed}:bf:${st.name}:${scale}:${tag}`);
        return { score: r.score, win: r.win, draw: r.draw, loss: r.loss, se: r.se, buff: { offExt: b.offExt, defP: b.defP, dodgeB: b.dodgeB } };
      };
      const gridLc = {}, gridLq = {};
      if (!onlyMax) {
        for (const lc of LC) { gridLc[lc] = {}; for (const ld of LD) gridLc[lc][ld] = lc === 0 && ld === 0 ? null : run({ Lc: lc, Ld: ld }, `c${lc}d${ld}`); }
        for (const lq of LQ) { gridLq[lq] = {}; for (const ld of LD) gridLq[lq][ld] = run({ Lq: lq, Ld: ld }, `q${lq}d${ld}`); }
      }
      const maxes = {
        'Lc6+Ld9': run({ Lc: 6, Ld: 9 }, 'm1'), 'Lq4+Ld9': run({ Lq: 4, Ld: 9 }, 'm2'), 'Lc6+Lq4+Ld9': run({ Lc: 6, Lq: 4, Ld: 9 }, 'm3'),
        'Lc6': run({ Lc: 6 }, 'm4'), 'Lq4': run({ Lq: 4 }, 'm5'), 'Ld9': run({ Ld: 9 }, 'm6')
      };
      ent.scales.push({ scale, lc: gridLc, lq: gridLq, maxes });
    }
    out.sets.push(ent);
    log(o, `[buffs] xong ${st.name} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  }
  out.meta = metaOf('buffs', c, o, { games, scales, full, onlyMax, axesLc: LC, axesLq: LQ, axesLd: LD, elapsedMs: Date.now() - t0 });
  return out;
}

function printBuffs(r) {
  const m = r.meta;
  let s = `Buff: bên A có buff, bên B không, cùng bộ chiêu (gương) · bot ${m.mode} · cấp ${m.level} · ${m.games} trận mỗi ô (sai số một ô khoảng ±${F.pct(0.5 / Math.sqrt(m.games) * 1.96, 0)} điểm %) · seed ${m.seed} · ${(m.elapsedMs / 1000).toFixed(1)}s`;
  s += '\nÔ = điểm của bên có buff (thắng 1, hòa 0,5), 50% là ngang nhau. Cột là hào quang Ld.';
  for (const st of r.sets) for (const sc of st.scales) {
    s += F.title(`Bộ ${st.name} (${st.ids.map(L.abbr).join(' ')}) · BUFF_SCALE ${sc.scale}`);
    const rows = [];
    for (const lc of m.axesLc) if (sc.lc[lc]) rows.push(['Lc ' + lc, ...m.axesLd.map(ld => (sc.lc[lc][ld] ? F.pct(sc.lc[lc][ld].score) : '50'))]);
    for (const lq of m.axesLq) if (sc.lq[lq]) rows.push(['Lq ' + lq, ...m.axesLd.map(ld => F.pct(sc.lq[lq][ld].score))]);
    if (rows.length) s += '\n' + F.table(['', ...m.axesLd.map(d => 'Ld' + d)], rows);
    s += '\nTổ hợp mạnh nhất: ' + Object.entries(sc.maxes).map(([k, v]) => `${k} ${F.pct(v.score)}%`).join(' · ') + '\n';
    const mx = sc.maxes['Lc6+Lq4+Ld9'].buff;
    s += `Số buff của Lc6+Lq4+Ld9: tăng sát thương ${F.pct(mx.offExt, 1)}%, giảm sát thương nhận ${F.pct(mx.defP, 1)}%, cộng né ${F.pct(mx.dodgeB, 1)} điểm\n`;
  }
  return s;
}

/* ---------- levels ---------- */

function levels(o) {
  const c = common(o), t0 = Date.now();
  const games = Number(o.games || 200);
  const pairs = String(o.pairs || '2:1,3:1,5:1,7:1,10:1,10:5,10:7,7:5,5:3,3:2').split(',').map(p => p.split(':').map(Number));
  const sets = namedSets(o.sets ? String(o.sets).split('|') : MIRRORS);
  const rows = [];
  for (const st of sets) for (const [a, b] of pairs) {
    const r = series({ bots: c.bots, loadouts: { a: st.ids, b: st.ids }, levels: [a, b], ctx: c.ctx, exact: c.exact }, games, `${c.seed}:lv:${st.name}:${a}:${b}`);
    rows.push({ set: st.name, hi: a, lo: b, manaHi: c.ctx.M.manaMaxOf(a), manaLo: c.ctx.M.manaMaxOf(b), score: r.score, win: r.win, draw: r.draw, loss: r.loss, se: r.se, med: r.medTurns });
  }
  return { meta: metaOf('levels', c, o, { games, pairs, elapsedMs: Date.now() - t0 }), rows, sets: sets.map(s => ({ name: s.name, ids: s.ids })) };
}

function printLevels(r) {
  const m = r.meta;
  let s = `Chênh cấp nội công (cùng bộ chiêu, chỉ khác nội lực tối đa) · bot ${m.mode} · ${m.games} trận mỗi dòng · seed ${m.seed} · ${(m.elapsedMs / 1000).toFixed(1)}s`;
  s += '\nĐiểm của bên cấp cao hơn (50% là ngang nhau).\n';
  const by = {};
  for (const x of r.rows) (by[x.set] = by[x.set] || []).push(x);
  const names = Object.keys(by);
  const head = ['Cấp (nội lực)', ...names];
  const rows = by[names[0]].map((x, i) => [`${x.hi} vs ${x.lo} (${x.manaHi} vs ${x.manaLo})`, ...names.map(n => F.pct(by[n][i].score) + '%')]);
  s += F.table(head, rows);
  return s + '\n';
}

/* ---------- param ---------- */

function param(o) {
  const c0 = common(o), t0 = Date.now();
  const key = o.key, values = String(o.values || '').split(',').filter(Boolean).map(Number);
  if (!key || !values.length) throw new Error('param cần --key (vd rules.REGEN, skill.tu-luc-pha-son.mana) và --values a,b,c');
  const games = Number(o.games || 60), trGames = Number(o.triGames || 20);
  const rows = [];
  for (const v of values) {
    const set = [...(o.set || []), `${key}=${v}`];
    const c = common({ ...o, set });
    const rr = roundrobin({ ...o, set, games, sets: 'presets', quiet: true });
    const tri = roundrobin({ ...o, set, games: trGames, sets: 'pure', quiet: true });
    const sc = rr.scores.map(x => x.score);
    const watchSet = {};
    for (const nm of String(o.watchSet || '').split(',').filter(Boolean)) { const f = rr.scores.find(x => x.name === nm); if (f) watchSet[nm] = f.score; }
    const watch = {};
    for (const ab of String(o.watch || '').split(',').filter(Boolean)) { const f = rr.usage.find(x => x.abbr === ab); if (f) watch[ab] = f.share; }
    const sd = Math.sqrt(sc.reduce((a, b) => a + (b - 0.5) ** 2, 0) / sc.length);
    const B = c.ctx.M.BRANCH_ORDER, bm = tri.branches;
    rows.push({
      value: v, spread: { best: Math.max(...sc), worst: Math.min(...sc), sd },
      best: rr.scores.slice().sort((a, b) => b.score - a.score)[0].name, worst: rr.scores.slice().sort((a, b) => a.score - b.score)[0].name,
      triangle: { cuongVsToc: bm.cuong.toc.score, tocVsNhu: bm.toc.nhu.score, nhuVsCuong: bm.nhu.cuong.score },
      draw: rr.totals.drawRate, sudden: rr.totals.suddenRate, medTurns: rr.totals.medianOfPairMedians, meanTurns: rr.totals.meanTurns,
      minUsage: Math.min(...rr.usage.map(u => u.share)), minUsageSkill: rr.usage[rr.usage.length - 1].abbr, watch, watchSet
    });
    log(o, `[param] ${key}=${v} xong (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  }
  return { meta: metaOf('param', c0, o, { key, values, games, triGames: trGames, elapsedMs: Date.now() - t0 }), rows };
}

function printParam(r) {
  const m = r.meta;
  let s = `Quét tham số ${m.key} · bot ${m.mode} · cấp ${m.level} · seed ${m.seed} · ${(m.elapsedMs / 1000).toFixed(1)}s`;
  s += `\n13 bộ tiêu biểu × ${m.games} trận mỗi cặp; tam giác nhánh từ 15 bộ thuần × ${m.triGames} trận mỗi cặp. Chiêu ít được chọn nhất ghi kèm.\n`;
  const wk = Object.keys(r.rows[0].watch), ws = Object.keys(r.rows[0].watchSet);
  s += F.table(['Giá trị', 'Cương>Tốc', 'Tốc>Nhu', 'Nhu>Cương', 'Bộ mạnh nhất', 'Bộ yếu nhất', 'Hòa', 'Suy kiệt', 'Lượt tb', 'Chiêu ít chọn', ...wk.map(k => 'Chọn ' + k), ...ws.map(k => 'Điểm ' + k)],
    r.rows.map(x => [x.value, F.pct(x.triangle.cuongVsToc) + '%', F.pct(x.triangle.tocVsNhu) + '%', F.pct(x.triangle.nhuVsCuong) + '%',
      `${x.best} ${F.pct(x.spread.best)}%`, `${x.worst} ${F.pct(x.spread.worst)}%`, F.pct(x.draw) + '%', F.pct(x.sudden) + '%', x.meanTurns.toFixed(1), `${x.minUsageSkill} ${F.pct(x.minUsage)}%`,
      ...wk.map(k => F.pct(x.watch[k]) + '%'), ...ws.map(k => F.pct(x.watchSet[k]) + '%')]),
    ['r', 'r', 'r', 'r', 'l', 'l', 'r', 'r', 'r', 'l', ...wk.map(() => 'r'), ...ws.map(() => 'r')]);
  return s + '\n';
}

module.exports = { roundrobin, grid, buffs, levels, param, printRoundrobin, printGrid, printBuffs, printLevels, printParam, common };
