#!/usr/bin/env node
'use strict';
// Reproducible audit; gameplay modules are loaded unchanged from this checkout.
const fs = require('fs');
const path = require('path');
const os = require('os');
const assert = require('assert/strict');
const crypto = require('crypto');
const { Worker, isMainThread, parentPort } = require('worker_threads');
const { execFileSync } = require('child_process');
const { Duel } = require('../../lib/pk/engine');
const R = require('../../lib/pk/rules');
const M = require('../../public/js/martial');
const { computeBuff } = require('../../lib/pk/buffs');
const { makeRng } = require('../../lib/pk/rng');
const { decide } = require('./bots');
const L = require('./loadouts');
const SEED = 'Pagoda-PhaSon-v2-20261108';
const OUT = path.resolve(process.env.PK_AUDIT_OUT || './audit-results');
const ALL = L.allSets(M);
const CL = [0, 60, 200, 350, 600, 900, 1200, 1800, 2400, 3000];
const TAM = [0, 0, 40, 70, 120, 200, 250, 300, 300, 300];
function profile(level) {
  const congLuc = CL[level - 1], tam = Object.fromEntries(M.BRANCH_ORDER.map(b => [b, TAM[level - 1]]));
  const p = { congLuc, tam, learned: M.STARTERS.slice() };
  for (const id of M.SKILL_ORDER) if (!p.learned.includes(id) && M.canLearn(p, id).ok) p.learned.push(id);
  assert.equal(M.levelOf(congLuc), level);
  return p;
}
const PROFILES = Array.from({ length: 10 }, (_, i) => profile(i + 1));
const POOLS = PROFILES.map(p => ALL.filter(s => M.validateLoadout(s.ids, p.learned).ok));
const csv = x => '"' + String(x ?? '').replaceAll('"', '""') + '"';
function choose(arr, rng) { return arr[Math.floor(rng() * arr.length)]; }
function resultScore(w) { return w === 'A' ? 1 : w === 'B' ? 0 : 0.5; }
function play(job, index) {
  const id = job.start + index, seed = `${SEED}:${id}`, rng = makeRng(seed + '|setup');
  const la = job.levels[0], lb = job.levels[1];
  let aa = job.idsA || choose(POOLS[la - 1], rng).ids;
  let bb = job.idsB || choose(POOLS[lb - 1], rng).ids;
  if (job.shared) bb = aa.slice();
  assert.ok(M.validateLoadout(aa, PROFILES[la - 1].learned).ok);
  assert.ok(M.validateLoadout(bb, PROFILES[lb - 1].learned).ok);
  const swap = id % 2 === 1, role = swap ? { A: 'b', B: 'a' } : { A: 'a', B: 'b' };
  const practiceFor = (lv, ids) => M.masteryMap(Object.fromEntries(ids.map(id => [id, job.stage === 'crosslevel' ? 0 : job.stage === 'progression' ? M.MASTERY_AT[Math.floor((lv - 1) / 2)] : M.MASTERY_MAX])), ids);
  const fa = { level: la, loadout: aa, mastery: practiceFor(la, aa), buff: job.buffA || computeBuff({}) };
  const fb = { level: lb, loadout: bb, mastery: practiceFor(lb, bb), buff: job.buffB || computeBuff({}) };
  const d = new Duel({ seed, a: swap ? fb : fa, b: swap ? fa : fb });
  const r = makeRng(seed + '|bot'), usage = { A: {}, B: {} }, dec = { A: 0, B: 0 };
  const ev = { A: { charge: 0, release: 0, hit: 0, dodgeTry: 0, dodgeOK: 0, parryTry: 0, parryOK: 0, counter: 0 }, B: { charge: 0, release: 0, hit: 0, dodgeTry: 0, dodgeOK: 0, parryTry: 0, parryOK: 0, counter: 0 } };
  function forcedOr(side, want) {
    const legal = d.legal(side);
    return legal.forced || (legal.picks.includes(want) ? want : M.REST_ID);
  }
  while (!d.over) {
    let picks;
    if (!job.script) picks = decide(d, [job.bot, job.bot], r, null, '', null, M.REST_ID);
    else {
      const a = role.A, b = role.B;
      const pa = forcedOr(a, job.script === 'fast-vs-parry' ? L.CODE.TPQ : L.CODE.TL);
      const pb = forcedOr(b, job.script === 'fast-vs-parry' ? L.CODE.TLB : (d.f[a].charging ? job.response : L.CODE.TPQ));
      picks = swap ? [pb, pa] : [pa, pb];
    }
    assert.ok(d.validatePick('a', picks[0]).ok && d.validatePick('b', picks[1]).ok);
    const out = d.step(...picks);
    for (const label of ['A', 'B']) {
      const side = role[label], p = out.picks[side];
      assert.equal(p.invalid, false);
      if (p.phase !== 'release') { usage[label][p.skill] = (usage[label][p.skill] || 0) + 1; dec[label]++; }
      assert.ok(Number.isFinite(d.f[side].hp) && d.f[side].mana >= 0 && d.f[side].mana <= d.f[side].manaMax);
    }
    for (const e of out.events) {
      const lab = s => s === role.A ? 'A' : 'B';
      if (e.k === 'charge' || e.k === 'release' || e.k === 'counter') ev[lab(e.side)][e.k]++;
      if (e.k === 'hit') ev[lab(e.atk)].hit++;
      if (e.k === 'dodge' || e.k === 'parry') { ev[lab(e.def)][e.k + 'Try']++; if (e.ok) ev[lab(e.def)][e.k + 'OK']++; }
    }
    assert.ok(out.turn <= R.MAX_TURNS);
  }
  const winner = d.over.result === 'draw' ? 'draw' : d.over.result === role.A ? 'A' : 'B';
  return { id, stage: job.stage, scenario: job.scenario, bot: job.bot, levelA: la, levelB: lb, loadoutA: L.label(aa), loadoutB: L.label(bb), sideA: role.A,
    winner, score: resultScore(winner), turns: d.history.at(-1).turn, sudden: d.sudden !== null ? 1 : 0, reason: d.over.reason,
    hpA: d.f[role.A].hp, hpB: d.f[role.B].hp, usageA: usage.A, usageB: usage.B, decisionsA: dec.A, decisionsB: dec.B, eventsA: ev.A, eventsB: ev.B,
    trace: index === 0 && job.trace ? { seed, role, inputs: { A: fa, B: fb }, history: d.history } : null };
}
if (!isMainThread) {
  parentPort.on('message', job => {
    try { const rows = []; for (let i = 0; i < job.n; i++) rows.push(play(job, i)); parentPort.postMessage({ rows }); }
    catch (e) { parentPort.postMessage({ error: e.stack }); }
  });
} else {
  const FIELDS = ['id','stage','scenario','bot','levelA','levelB','loadoutA','loadoutB','sideA','winner','score','turns','sudden','reason','hpA','hpB','decisionsA','decisionsB','usageA','usageB','eventsA','eventsB'];
  let nextId = 0, completed = 0;
  const rows = [], traces = [];
  function task(stage, scenario, n, extra) { const j = { stage, scenario, n, start: nextId, ...extra }; nextId += n; return j; }
  function split(stage, scenario, n, extra) {
    const a = []; for (let i = 0; i < n; i += 100) a.push(task(stage, scenario, Math.min(100, n - i), { ...extra, trace: i === 0 })); return a;
  }
  async function runBatch(jobs) {
    let idx = 0;
    await Promise.all(Array.from({ length: Math.min(6, os.availableParallelism?.() || 4, jobs.length) }, () => new Promise((resolve, reject) => {
      const worker = new Worker(__filename);
      const dispatch = () => {
        if (idx >= jobs.length) { worker.terminate().then(resolve, reject); return; }
        worker.postMessage(jobs[idx++]);
      };
      worker.on('error', reject);
      worker.on('message', msg => {
        if (msg.error) { worker.terminate(); reject(new Error(msg.error)); return; }
        for (const x of msg.rows) { if (x.trace) traces.push({ id: x.id, stage: x.stage, scenario: x.scenario, ...x.trace }); delete x.trace; rows.push(x); }
        completed += msg.rows.length;
        if (completed % 1000 < msg.rows.length) console.log(`${completed}/100000 matches (${((Date.now()-T0)/1000).toFixed(1)}s)`);
        dispatch();
      });
      dispatch();
    })));
    fs.writeFileSync(path.join(OUT, 'checkpoint.json'), JSON.stringify({ completed, allocated: nextId, seconds: (Date.now()-T0)/1000 }));
  }
  function stat(rr) {
    const n = rr.length, scores = rr.map(x => x.score), mean = scores.reduce((s,x)=>s+x,0)/n;
    const se = Math.sqrt(Math.max(0,scores.reduce((s,x)=>s+x*x,0)/n-mean*mean)/n);
    const turns = rr.map(x=>x.turns).sort((a,b)=>a-b);
    return { n, win: rr.filter(x=>x.winner==='A').length/n, draw: rr.filter(x=>x.winner==='draw').length/n, loss: rr.filter(x=>x.winner==='B').length/n,
      score: mean, ci95: [Math.max(0,mean-1.96*se),Math.min(1,mean+1.96*se)], meanTurns: turns.reduce((s,x)=>s+x,0)/n, medianTurns: turns[Math.floor(n/2)], p90Turns: turns[Math.floor(n*0.9)],
      sudden: rr.reduce((s,x)=>s+x.sudden,0)/n, reasons: Object.fromEntries([...new Set(rr.map(x=>x.reason))].map(k=>[k,rr.filter(x=>x.reason===k).length])) };
  }
  const T0 = Date.now();
  async function main() {
    fs.mkdirSync(OUT, { recursive: true });
    let jobs = [];
    for (let level = 1; level <= 10; level++) for (const bot of ['random','eq']) jobs.push(...split('progression',`L${level}-${bot}`,2000,{levels:[level,level],bot}));
    const pairs = [[2,1],[3,1],[3,2],[5,3],[7,5],[10,7],[10,9],[10,1],[7,1],[5,1]];
    const base = L.ids('TQ TPQ TB NVB');
    for (const [a,b] of pairs) for (const mode of ['shared-starters','available-skills']) jobs.push(...split('crosslevel',`L${a}-L${b}-${mode}`,1000,{levels:[a,b],bot:'eq',...(mode==='shared-starters'?{idsA:base,idsB:base}:{})}));
    for (const set of ALL) jobs.push(task('screen',set.name,12,{levels:[10,10],bot:'random',idsA:set.ids}));
    await runBatch(jobs);
    // Discovery and validation use disjoint seeds/opponents. Selection is frozen before holdout.
    const screen = ALL.map(s=>({name:s.name,ids:s.ids,...stat(rows.filter(x=>x.stage==='screen'&&x.scenario===s.name))})).sort((a,b)=>b.score-a.score || a.name.localeCompare(b.name));
    const candidates = screen.slice(0,12).map(s=>({name:s.name,ids:s.ids,source:'screen-top12'}));
    for (const name of ['Cương1','Tốc1','Nhu1','Phối1']) {
      const p = L.PRESETS.find(s=>s.name===name); candidates.push({...p,source:'predeclared-control'});
    }
    // Duplicate sets are allowed as named controls; their independent seeds remain valid.
    fs.writeFileSync(path.join(OUT,'candidates.json'),JSON.stringify(candidates,null,2));
    jobs = [];
    for (const s of candidates) jobs.push(...split('holdout',s.name,400,{levels:[10,10],bot:'eq',idsA:s.ids}));
    for(let i=0;i<candidates.length;i++) for(let j=i+1;j<candidates.length;j++) jobs.push(task('roundrobin',`${i}:${j}`,50,{levels:[10,10],bot:'eq',idsA:candidates[i].ids,idsB:candidates[j].ids}));
    for (const [name,script,response] of [['charge-vs-guard','charge',L.CODE.TB],['charge-vs-dodge','charge',L.CODE.NVB],['charge-vs-parry','charge',L.CODE.TLB],['fast-vs-parry','fast-vs-parry',L.CODE.TLB]]) {
      const idsA=script==='charge'?L.ids('TL TQ TB KCT'):L.ids('TPQ LHC KTB ABH');
      const idsB=L.ids('TPQ TB NVB TLB');
      jobs.push(...split('focus',name,305,{levels:[10,10],bot:'scripted',script,response,idsA,idsB}));
    }
    const buffCases = {donation9:{Ld:9},merit6:{Lc:6},demon4:{Lq:4},merit6donation9:{Lc:6,Ld:9},demon4donation9:{Lq:4,Ld:9}};
    for (const [name,input] of Object.entries(buffCases)) jobs.push(...split('buff',name,2000,{levels:[10,10],bot:'eq',shared:true,buffA:computeBuff(input)}));
    assert.equal(nextId,100000);
    await runBatch(jobs);
    rows.sort((a,b)=>a.id-b.id);
    assert.equal(rows.length,100000); assert.equal(new Set(rows.map(x=>x.id)).size,100000);
    assert.equal(rows[0].id,0); assert.equal(rows.at(-1).id,99999);
    const groups = {};
    for(const stage of [...new Set(rows.map(x=>x.stage))]) {
      const ss=rows.filter(x=>x.stage===stage); groups[stage]={total:stat(ss),scenarios:{}};
      for(const k of [...new Set(ss.map(x=>x.scenario))]) groups[stage].scenarios[k]=stat(ss.filter(x=>x.scenario===k));
    }
    const sourceFiles=['lib/pk/engine.js','lib/pk/rules.js','lib/pk/buffs.js','lib/pk/rng.js','public/js/martial.js','tools/pk-sim/bots.js','tools/pk-sim/enumerate.js','tools/pk-sim/audit100k.js'];
    const sha = execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
    const summary={meta:{seed:SEED,commit:sha,workingTreeDirty:execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim() !== '',masteryPlan:'progression: rank 1 at levels 1-2, rank 2 at 3-4, rank 3 at 5-6, rank 4 at 7-8, rank 5 at 9-10; crosslevel: rank 1 both sides to isolate inner level; screen/holdout/roundrobin/focus/buff: rank 5',date:new Date().toISOString(),matches:rows.length,seconds:(Date.now()-T0)/1000,node:process.version,buffScale:R.BUFF_SCALE,botEvaluation:'exact outcome enumeration with damage variance fixed at 1 only during planning; real matches use +/-10% variance; one-turn equilibrium plus forced-charge lookahead; no rounded state cache',sourceHashes:Object.fromEntries(sourceFiles.map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,'../..',f))).digest('hex')]))},
      profiles:PROFILES.map((p,i)=>({level:i+1,...p,mana:M.manaMaxOf(i+1),power:M.combatPower(i+1),loadoutCount:POOLS[i].length})),totals:stat(rows),groups,screen,candidates,buffCases:Object.fromEntries(Object.entries(buffCases).map(([k,v])=>[k,computeBuff(v)])),skills:M.SKILL_LIST,presets:L.PRESETS,rules:R};
    fs.writeFileSync(path.join(OUT,'summary.json'),JSON.stringify(summary,null,2));
    const fd=fs.openSync(path.join(OUT,'matches.csv'),'w');fs.writeSync(fd,FIELDS.join(',')+'\n');
    for(const row of rows) fs.writeSync(fd,FIELDS.map(f=>csv(typeof row[f]==='object'?JSON.stringify(row[f]):row[f])).join(',')+'\n');
    fs.closeSync(fd);
    fs.writeFileSync(path.join(OUT,'traces.json'),JSON.stringify(traces,null,2));
    console.log(`DONE: ${rows.length}; ${summary.meta.seconds.toFixed(1)}s; commit ${sha}; output ${OUT}`);
  }
  main().catch(e=>{console.error(e.stack);process.exitCode=1;});
}
