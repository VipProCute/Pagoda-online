'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const EventEmitter = require('node:events');
const M = require('../public/js/martial');
const R = require('../lib/pk/rules');
const NPC = require('../lib/pk/npc');
const { Duel } = require('../lib/pk/engine');
const { makeRng } = require('../lib/pk/rng');
const { createArenaManager } = require('../lib/pk/manager');
const { createNpcPool } = require('../lib/pk/npc-pool');

const LOADOUT_A = ['tu-luc-pha-son', 'trong-quyen', 'lien-hoan-cuoc', 'khinh-than-bo'];
function newDuel(seed, secretsA) {
  const b = NPC.fighter({ level: 10, mastery: {} }, 3);
  return new Duel({ seed, a: { level: 10, loadout: LOADOUT_A, secretSkills: secretsA || [] }, b: { level: 10, loadout: b.loadout, mastery: b.mastery, buff: { offExt: 0.1, defP: 0.05, dodgeB: 0.02 } } });
}
const tick = () => new Promise(r => setImmediate(r));

test('ảnh chụp Duel dựng lại đúng: kế hoạch và chiêu chọn y hệt NPC.decide trên Duel gốc', () => {
  const d = newDuel('snap-1', ['kamui', 'nhu-lai-than-chuong']);
  const ra = makeRng('r-snap'), rb = makeRng('r-snap');
  let n = 0;
  while (!d.over && n++ < 12) {
    const snap = JSON.parse(JSON.stringify(NPC.snapshot(d)));   // qua JSON như khi gửi sang luồng khác
    const copy = NPC.restore(snap);
    const direct = NPC.decide(d, 'b', 3, ra);
    const viaPlan = NPC.pickFromPlan(NPC.plan(copy, 'b'), rb, d.legal('b').picks);
    assert.equal(viaPlan, direct, `lượt ${n}`);
    assert.equal(ra(), rb(), 'cùng tiêu thụ rng');
    const la = d.legal('a');
    d.step(la.forced || la.picks[n % la.picks.length], direct);
  }
});

test('luồng phụ thật: kết quả bằng đúng gọi NPC.decide đồng bộ với cùng rng', async () => {
  const pool = createNpcPool({ size: 2 });
  try {
    const d = newDuel('worker-1', ['kamui']);
    const ra = makeRng('r-w'), rb = makeRng('r-w');
    for (let n = 1; n <= 6 && !d.over; n++) {
      const sync = NPC.decide(d, 'b', 3, ra);
      const plan = await pool.plan(NPC.snapshot(d), 'b');
      assert.equal(NPC.pickFromPlan(plan, rb, d.legal('b').picks), sync, `lượt ${n}`);
      const la = d.legal('a');
      d.step(la.forced || la.picks[n % la.picks.length], sync);
    }
    assert.equal(pool.stats().workers <= 2, true);
  } finally { pool.close(); }
});

/* ---------- hồ luồng với worker giả ---------- */
function fakeWorkers() {
  const list = [];
  const spawn = () => {
    const w = new EventEmitter();
    w.posted = [];
    w.postMessage = m => { w.posted.push(m); if (w.auto) w.auto(m); };
    w.terminate = () => { w.terminated = true; };
    w.unref = () => {};
    list.push(w);
    return w;
  };
  return { list, spawn };
}

test('hồ luồng: luồng sập thì reject việc đang làm và lần sau tạo luồng mới', async () => {
  const F = fakeWorkers();
  const pool = createNpcPool({ spawn: F.spawn, timeoutMs: 1000 });
  const p1 = pool.plan({}, 'b');
  F.list[0].emit('error', new Error('boom'));
  await assert.rejects(p1, e => e.code === 'error');
  assert.equal(F.list[0].terminated, true);
  const p2 = pool.plan({}, 'b');
  assert.equal(F.list.length, 2, 'tạo luồng mới');
  F.list[1].emit('message', { id: F.list[1].posted[0].id, plan: { forced: 'x' } });
  assert.deepEqual(await p2, { forced: 'x' });
  pool.close();
});

test('hồ luồng: quá giờ thì reject và bỏ luồng; trả lời muộn không làm gì; hàng chờ đầy thì busy', async () => {
  const F = fakeWorkers();
  const pool = createNpcPool({ spawn: F.spawn, timeoutMs: 20, maxQueue: 1 });
  const keep = setTimeout(() => {}, 5000);   // hẹn giờ của hồ luồng là unref, giữ vòng lặp sống cho test
  const p1 = pool.plan({}, 'b');
  const p2 = pool.plan({}, 'b');                       // xếp hàng
  await assert.rejects(pool.plan({}, 'b'), e => e.code === 'busy');
  await assert.rejects(p1, e => e.code === 'timeout');
  F.list[0].emit('message', { id: 1, plan: { forced: 'muon' } });   // trả lời muộn của luồng đã bỏ: im lặng
  await assert.rejects(p2, e => e.code === 'timeout');
  clearTimeout(keep);
  pool.close();
  await assert.rejects(pool.plan({}, 'b'), e => e.code === 'closed');
});

/* ---------- manager với hồ luồng giả (điều khiển được lúc trả lời) ---------- */
function makeClock(t0 = 1700000000000) {
  let t = t0, seq = 0;
  const timers = new Map();
  return {
    now: () => t,
    setTimer(fn, ms) { const id = ++seq; timers.set(id, { id, at: t + Math.max(0, ms), fn }); return id; },
    clearTimer(id) { timers.delete(id); },
    advance(ms) {
      const target = t + ms;
      for (;;) {
        let best = null;
        for (const x of timers.values()) if (x.at <= target && (!best || x.at < best.at || (x.at === best.at && x.id < best.id))) best = x;
        if (!best) break;
        timers.delete(best.id); t = Math.max(t, best.at); best.fn();
      }
      t = target;
    }
  };
}
function env(npcPool) {
  const clock = makeClock(), sent = [], logs = [], active = new Map();
  const fighter = { level: 7, learned: M.SKILL_ORDER.slice(), loadout: ['trong-quyen', 'tat-phong-quyen', 'thiet-bich', 'nhu-van-bo'], mastery: {}, wins: 0, losses: 0, draws: 0 };
  const deps = {
    now: clock.now, setTimer: clock.setTimer, clearTimer: clock.clearTimer,
    emit: (uid, ev, p) => sent.push({ uid, ev, p: JSON.parse(JSON.stringify(p)) }),
    emitRoom: () => {}, isOnline: () => true, log: (...a) => logs.push(a.join(' ')),
    fighterOf: uid => (uid === 'u1' ? JSON.parse(JSON.stringify(fighter)) : null),
    recordResult: () => null, recordBotResult: () => ({ wins: 0, losses: 0, draws: 0 }),
    setActiveMatch: (uid, id) => { if (id == null) active.delete(uid); else active.set(uid, id); },
    getActiveMatch: uid => active.get(uid) || null,
    saveMatch: () => {}, newSeed: () => 'npc-seed', config: { enabled: true, maxMatches: 5 }, npcPool
  };
  const mgr = createArenaManager(deps);
  mgr.join('u1', { pid: 1, name: 'Đạo Hữu', look: null });
  const r = mgr.challengeBot('u1', 3);
  mgr.setLoadout('u1', r.matchId, ['trong-quyen', 'tat-phong-quyen', 'thiet-bich', 'nhu-van-bo']);
  return { clock, sent, logs, mgr, matchId: r.matchId, of: ev => sent.filter(x => x.ev === ev) };
}
function controlledPool() {
  const calls = [];
  return { calls, plan(snap, side) { return new Promise((resolve, reject) => calls.push({ snap, side, resolve, reject })); }, close() { this.closed = true; } };
}
const planOf = c => NPC.plan(NPC.restore(c.snap), c.side);

test('manager + hồ luồng: NPC khóa chiêu khi luồng trả lời, bằng đúng chiêu tính đồng bộ', async () => {
  const pool = controlledPool();
  const E = env(pool);
  E.clock.advance(4000);
  assert.equal(pool.calls.length, 1, 'mức 3 đi qua hồ luồng');
  assert.equal(E.of('pk:locked').length, 0, 'chưa trả lời thì chưa khóa');
  pool.calls[0].resolve(planOf(pool.calls[0]));
  await tick();
  assert.equal(E.of('pk:locked').length, 1);
});

test('manager + hồ luồng: trả lời muộn sau khi trận kết thúc hoặc đã sang lượt khác thì bị bỏ', async () => {
  // a) trận đã kết thúc
  let pool = controlledPool();
  let E = env(pool);
  E.clock.advance(4000);
  E.mgr.forfeit('u1', E.matchId);
  pool.calls[0].resolve(planOf(pool.calls[0]));
  await tick();
  assert.equal(E.of('pk:locked').length, 0);
  assert.equal(E.logs.length, 0, 'không lỗi gì');
  // b) hết giờ lượt 1, sang lượt 2 rồi luồng mới trả lời lượt 1
  pool = controlledPool();
  E = env(pool);
  E.clock.advance(4000);
  E.clock.advance(R.TURN_MS + R.REVEAL_MS + 10);
  assert.equal(E.of('pk:turn').at(-1).p.turn, 2);
  pool.calls[0].resolve(planOf(pool.calls[0]));
  await tick();
  assert.equal(E.of('pk:locked').length, 0, 'câu trả lời của lượt 1 không khóa lượt 2');
  // lượt 2 vẫn khóa được bình thường bằng câu trả lời của lượt 2
  E.clock.advance(4000);
  const c2 = pool.calls.at(-1);
  assert.notEqual(c2, pool.calls[0]);
  c2.resolve(planOf(c2));
  await tick();
  assert.equal(E.of('pk:locked').length, 1);
});

test('manager + hồ luồng: lỗi thì tính đồng bộ, hàng chờ đầy thì hạ xuống mức nhẹ, trận vẫn chạy', async () => {
  for (const code of ['error', 'timeout', 'busy']) {
    const pool = controlledPool();
    const E = env(pool);
    E.clock.advance(4000);
    const e = new Error('giả lập'); e.code = code;
    pool.calls[0].reject(e);
    await tick();
    assert.equal(E.of('pk:locked').length, 1, code);
  }
});
