'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../public/js/martial');
const R = require('../lib/pk/rules');
const NPC = require('../lib/pk/npc');
const { Duel } = require('../lib/pk/engine');
const { makeRng } = require('../lib/pk/rng');
const { createArenaManager, BOT_PID } = require('../lib/pk/manager');

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

function env() {
  const clock = makeClock(), sent = [], results = [], botResults = [], saved = [], active = new Map(), online = new Set(['u1']);
  const fighter = { level: 7, learned: M.SKILL_ORDER.slice(), loadout: ['trong-quyen', 'tat-phong-quyen', 'thiet-bich', 'nhu-van-bo'], mastery: { 'trong-quyen': 120, 'thiet-bich': 20 }, wins: 3, losses: 1, draws: 0 };
  const deps = {
    now: clock.now, setTimer: clock.setTimer, clearTimer: clock.clearTimer,
    emit: (uid, ev, p) => sent.push({ uid, ev, p: JSON.parse(JSON.stringify(p)) }),
    emitRoom: () => {},
    isOnline: uid => online.has(uid),
    fighterOf: uid => (uid === 'u1' ? JSON.parse(JSON.stringify(fighter)) : null),
    recordResult: (uid, r) => { results.push({ uid, r }); return null; },
    recordBotResult: (uid, r) => { botResults.push({ uid, r }); return { wins: r === 'win' ? 1 : 0, losses: r === 'loss' ? 1 : 0, draws: r === 'draw' ? 1 : 0 }; },
    setActiveMatch: (uid, id) => { if (id == null) active.delete(uid); else active.set(uid, id); },
    getActiveMatch: uid => active.get(uid) || null,
    saveMatch: rec => saved.push(rec),
    newSeed: () => 'npc-seed',
    config: { enabled: true, maxMatches: 5 }
  };
  const mgr = createArenaManager(deps);
  mgr.join('u1', { pid: 1, name: 'Đạo Hữu', look: null });
  return { clock, sent, results, botResults, saved, active, online, mgr, of: ev => sent.filter(x => x.ev === ev) };
}

test('NPC Hắc Phong: cùng cấp người chơi, bộ chiêu theo mức, không chiêu bí truyền', () => {
  for (const diff of [1, 2, 3]) {
    for (const level of [1, 3, 5, 7, 10]) {
      const f = NPC.fighter({ level, mastery: { 'trong-quyen': 240 } }, diff);
      assert.equal(f.level, level);
      assert.equal(f.loadout.length, 4);
      assert.equal(new Set(f.loadout).size, 4);
      for (const id of f.loadout) assert.ok(M.SKILLS[id].req.level <= level, `${id} quá cấp ${level}`);
      assert.deepEqual(f.secretSkills, []);
      assert.ok(M.validateLoadout(f.loadout, f.learned).ok);
    }
  }
  assert.equal(NPC.fighter({ level: 10, mastery: { 'trong-quyen': 240 } }, 1).mastery['trong-quyen'], 0);
  assert.equal(NPC.fighter({ level: 10, mastery: { 'trong-quyen': 240, x: 0 } }, 3).mastery['trong-quyen'], 240);
});

test('NPC luôn chọn chiêu hợp lệ ở cả ba mức, kể cả lượt tụ lực', () => {
  for (const diff of [1, 2, 3]) {
    const rng = makeRng('kiem-thu-' + diff);
    const b = NPC.fighter({ level: 10, mastery: {} }, diff);
    const d = new Duel({ seed: 's' + diff, a: { level: 10, loadout: ['tu-luc-pha-son', 'trong-quyen', 'tat-phong-quyen', 'thiet-bich'] }, b: { level: 10, loadout: b.loadout, mastery: b.mastery } });
    let n = 0;
    while (!d.over && n++ < 45) {
      const pb = NPC.decide(d, 'b', diff, rng);
      assert.ok(d.legal('b').picks.includes(pb), `mức ${diff}: ${pb}`);
      const la = d.legal('a');
      d.step(la.forced || la.picks[n % la.picks.length], pb);
    }
    assert.ok(d.over, 'trận phải kết thúc');
  }
});

test('trận với NPC: sảnh tự khóa, NPC khóa kín rồi lật chiêu, kết quả ghi riêng không vào điểm PK', () => {
  const E = env();
  assert.equal(E.mgr.challengeBot('u1', 9).ok, false);
  assert.equal(E.mgr.challengeBot('khach', 2).ok, false);
  const r = E.mgr.challengeBot('u1', 3);
  assert.equal(r.ok, true, r.reason);
  assert.equal(E.mgr.challengeBot('u1', 3).ok, false, 'đang trong trận');
  const lobby = E.of('pk:lobby');
  assert.equal(lobby.length, 1);
  assert.equal(lobby[0].uid, 'u1');
  assert.equal(lobby[0].p.op.name, NPC.NAME);
  assert.equal(lobby[0].p.op.pid, BOT_PID);
  assert.equal(lobby[0].p.op.level, 7);
  assert.equal(lobby[0].p.npc.level, 3);
  assert.equal(E.of('pk:lobby:status')[0].p.opLocked, true);
  assert.ok(E.sent.every(x => x.uid === 'u1'), 'không gửi gì cho uid của NPC');
  assert.equal(E.active.size, 1);

  E.mgr.setLoadout('u1', r.matchId, ['trong-quyen', 'tat-phong-quyen', 'thiet-bich', 'nhu-van-bo']);
  assert.equal(E.of('pk:turn').length, 1);
  // NPC suy nghĩ vài giây rồi khóa; người chơi chỉ thấy pk:locked, chưa thấy chiêu
  E.clock.advance(4000);
  assert.equal(E.of('pk:locked').length, 1);
  assert.equal(E.of('pk:reveal').length, 0);
  let guard = 0;
  while (!E.of('pk:end').length && guard++ < 60) {
    const turn = E.of('pk:turn').at(-1).p;
    if (!turn.forced) E.mgr.pick('u1', r.matchId, turn.turn, turn.legal.includes('trong-quyen') ? 'trong-quyen' : M.REST_ID);
    E.clock.advance(R.TURN_MS + R.REVEAL_MS + 10);
  }
  const end = E.of('pk:end');
  assert.equal(end.length, 1);
  assert.ok(['win', 'lose', 'draw'].includes(end[0].p.result));
  assert.equal(end[0].p.npc.level, 3);
  assert.deepEqual(E.results, [], 'không gọi recordResult');
  assert.equal(E.botResults.length, 1);
  assert.equal(E.botResults[0].uid, 'u1');
  assert.deepEqual(end[0].p.record, { wins: 3, losses: 1, draws: 0 }, 'thành tích PK giữ nguyên');
  assert.equal(E.saved[0].npc.level, 3);
  assert.equal(E.active.size, 0);
  assert.equal(E.mgr.hasMatch('u1'), false);
  // đấu lại được ngay
  assert.equal(E.mgr.challengeBot('u1', 1).ok, true);
});

test('người chơi rớt mạng đủ lâu thì trận với NPC bị hủy, không ghi kết quả', () => {
  const E = env();
  const r = E.mgr.challengeBot('u1', 1);
  assert.equal(r.ok, true);
  E.online.delete('u1');
  E.mgr.leave('u1', 'disconnect');
  E.clock.advance(R.BOTH_AWAY_MS + 5000);
  assert.equal(E.mgr.hasMatch('u1'), false);
  assert.deepEqual(E.botResults, []);
  assert.deepEqual(E.results, []);
});
