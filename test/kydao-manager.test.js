'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { registry, get } = require('../lib/kydao/registry');
const { createKydaoManager } = require('../lib/kydao/manager');

// Đồng hồ giả thực thi timer theo thứ tự thời điểm, kể cả timer được tạo lại.
function makeClock() {
  let time = 1700000000000, seq = 0;
  const timers = new Map();
  return {
    now: () => time,
    setTimer(fn, ms) { const id = ++seq; timers.set(id, { at: time + Math.max(0, ms), fn }); return id; },
    clearTimer(id) { timers.delete(id); },
    advance(ms) {
      const end = time + ms;
      for (;;) {
        let selected = null;
        for (const [id, timer] of timers) {
          if (timer.at <= end && (!selected || timer.at < selected.timer.at ||
              (timer.at === selected.timer.at && id < selected.id))) selected = { id, timer };
        }
        if (!selected) break;
        timers.delete(selected.id);
        time = selected.timer.at;
        selected.timer.fn();
      }
      time = end;
    }
  };
}

function managerEnv(config = {}) {
  const clock = makeClock();
  const sent = [], rooms = [], saved = [], active = new Map(), ratings = new Map();
  let sequence = 0;
  const deps = {
    now: clock.now, setTimer: clock.setTimer, clearTimer: clock.clearTimer,
    newId: () => `id-${++sequence}`, newSeed: () => 'seed', rngFor: () => () => 0.5,
    emit: (uid, ev, payload) => sent.push({ uid, ev, payload: structuredClone(payload) }),
    emitRoom: (room, ev, payload) => rooms.push({ room, ev, payload: structuredClone(payload) }),
    isOnline: () => true, isAccount: () => true,
    saveGame: record => saved.push(structuredClone(record)),
    getRating: (uid, game) => ratings.get(`${uid}:${game}`) || null,
    setRating: (uid, game, rating) => ratings.set(`${uid}:${game}`, rating),
    pairCountToday: () => 0,
    getActive: uid => active.get(uid) || null,
    setActive: (uid, id) => id == null ? active.delete(uid) : active.set(uid, id),
    log: () => {}, config: { enabled: true, maxGames: 12, timeScale: 1, ...config }
  };
  return { clock, sent, rooms, saved, active, ratings, deps, manager: createKydaoManager(deps) };
}

function startGame(env, game = 'chess', rated = false, size) {
  const a = { uid: 'uid-secret-a', pid: 'pid-a', name: 'An' };
  const b = { uid: 'uid-secret-b', pid: 'pid-b', name: 'Bình' };
  const m = env.manager;
  for (const result of [m.sit(a, { table: 1, seat: 0 }), m.sit(b, { table: 1, seat: 1 }),
    m.setup(a, { table: 1, game, pace: 'fast', rated, ...(size ? { size } : {}) }), m.ready(a, { table: 1, ready: true }),
    m.ready(b, { table: 1, ready: true })]) assert.equal(result.ok, true, result.reason);
  const start = m.resume(a).start;
  assert.ok(start);
  return { a, b, gameId: start.gameId, start };
}

test('Cờ úp: hai người chơi, vào lại và khán giả chỉ nhận view đã che và quân vừa lật', () => {
  const e = managerEnv(), mod = get('jieqi').module;
  const { a, b, gameId } = startGame(e, 'jieqi');
  const viewer = { uid: 'uid-secret-viewer', pid: 'pv', name: 'Khách' };
  const outsider = { uid: 'uid-secret-outside', pid: 'po', name: 'Người ngoài' };
  let secret = mod.create({ seed: 'seed' });
  const scan = () => {
    for (const event of [...e.sent, ...e.rooms]) {
      const p = event.payload;
      const json = JSON.stringify(p);
      for (const u of [a, b, viewer, outsider]) assert.ok(!json.includes(u.uid), event.ev);
      assert.ok(!json.includes('"seed"'), event.ev);
      assert.ok(!json.includes(JSON.stringify(secret.hidden)), event.ev);
      if (p.state) assert.deepEqual(p.state, mod.view(secret), event.ev);
      if (event.ev === 'kd:moved') assert.deepEqual(p.reveal, expectedReveal);
      // kd:skin (T-110) chỉ mang mã skin của một bên, không có gì về quân.
      if (event.ev === 'kd:skin') assert.deepEqual(Object.keys(p).sort(), ['field', 'gameId', 'opened', 'pieces', 'side']);
      if (event.uid) assert.notEqual(event.uid, outsider.uid);
    }
    e.sent.length = e.rooms.length = 0;
  };
  let expectedReveal;
  assert.equal(e.manager.watch(viewer, { table: 1 }).ok, true);
  scan();
  assert.equal(e.manager.skin(a, { gameId, field: 'volcano', pieces: 'magma' }).ok, true);
  assert.equal(e.manager.skin(b, { gameId, field: 'ocean', pieces: 'coral' }).ok, true);
  assert.equal(e.rooms.filter(x => x.ev === 'kd:skin').length, 2, 'người xem nhận kd:skin');
  scan();
  for (let ply = 0; ply < 40 && !mod.status(secret).over; ply++) {
    if (ply === 10) {
      e.clock.advance(20000);
      assert.equal(e.manager.skin(b, { gameId, field: 'thunder', pieces: 'storm' }).ok, true);
      scan();
    }
    const who = mod.turn(secret) === 'a' ? a : b;
    assert.equal(e.manager.move(viewer, { gameId, ply, move: 'a3a4' }).ok, false);
    assert.equal(e.manager.move(who, { gameId, ply, move: 'a0a9' }).ok, false);
    const moves = mod.legalMoves(secret);
    // Ưu tiên quân còn úp để liên tục kiểm ranh giới giữa bí mật và reveal.
    const move = moves.find(m => /[Xx]/.test(secret.board[Number(m[1]) * 9 + m.charCodeAt(0) - 97] || '')) || moves[ply % moves.length];
    const result = mod.play(secret, move); expectedReveal = result.info.reveal;
    const before = mod.view(secret);
    secret = result.state;
    assert.equal(e.manager.move(who, { gameId, ply, move }).ok, true);
    assert.deepEqual(mod.apply(before, move, expectedReveal).state, mod.view(secret));
    scan();
    if (mod.status(secret).over) break;
    for (const p of [a, b]) {
      assert.deepEqual(e.manager.resume(p).start.state, mod.view(secret));
    }
    assert.equal(e.manager.watch(viewer, { table: 1 }).ok, true);
    scan();
  }
  if (e.manager.resume(a).start) e.manager.resign(b, { gameId });
  const end = e.sent.find(x => x.ev === 'kd:end');
  if (end) {
    assert.equal(end.payload.final.hidden, null);
    assert.ok(!end.payload.final.board.some(p => p === 'X' || p === 'x'));
  }
  assert.equal(e.saved[0].seed, 'seed');
  assert.ok(e.saved[0].moves.some(m => m.r && m.r.mover));
  e.manager.shutdown();
});

test('Đồng hồ Fischer, nước cũ, đầu hàng và bảo vệ uid', () => {
  const e = managerEnv();
  const { a, b, gameId, start } = startGame(e);
  assert.equal(start.clock.a, 300000);
  e.clock.advance(1000);
  assert.equal(e.manager.move(a, { gameId, ply: 0, move: 'e2e4' }).ok, true);
  const moved = e.sent.filter(x => x.ev === 'kd:moved').at(-1).payload;
  assert.equal(moved.clock.a, 302000);
  assert.equal(moved.clock.turn, 'b');
  assert.equal(e.manager.move(a, { gameId, ply: 0, move: 'e2e4' }).ok, false);
  assert.equal(e.manager.resign(b, { gameId }).ok, true);
  assert.equal(e.saved.length, 1);
  assert.equal(e.manager.resign(b, { gameId }).ok, false);
  assert.equal(e.saved.length, 1);
  for (const event of [...e.sent, ...e.rooms]) {
    const payload = JSON.stringify(event.payload);
    assert.ok(!payload.includes(a.uid) && !payload.includes(b.uid), event.ev);
  }
  e.manager.shutdown();
});

test('Hủy khi không đi nước đầu và khi ván xếp hạng quá ngắn', () => {
  const e = managerEnv({ timeScale: 0.5 });
  const game = startGame(e);
  e.clock.advance(14999);
  assert.ok(e.manager.resume(game.a).start);
  e.clock.advance(1);
  assert.equal(e.manager.resume(game.a).start, null);
  assert.equal(e.saved.length, 0);
  assert.equal(e.sent.filter(x => x.ev === 'kd:end').at(-1).payload.reason, 'no-start');
  e.manager.shutdown();
  const f = managerEnv();
  const rated = startGame(f, 'chess', true);
  assert.equal(f.manager.resign(rated.b, { gameId: rated.gameId }).ok, true);
  assert.equal(f.saved.length, 0);
  assert.equal(f.ratings.size, 0);
  assert.equal(f.sent.filter(x => x.ev === 'kd:end').at(-1).payload.reason, 'too-short');
  f.manager.shutdown();
});

test('Người xem nhận bản dựng lại và các nước chỉ gửi vào phòng bàn', () => {
  const e = managerEnv();
  const { a, gameId } = startGame(e);
  const viewer = { uid: 'uid-secret-viewer', pid: 'pid-viewer', name: 'Khách' };
  assert.equal(e.manager.watch(viewer, { table: 1 }).ok, true);
  assert.equal(e.manager.watch(viewer, { table: 1 }).ok, true);
  const snapshot = e.sent.filter(x => x.uid === viewer.uid && x.ev === 'kd:start').at(-1).payload;
  assert.equal(snapshot.you, undefined);
  assert.equal(snapshot.resumed, true);
  assert.equal(e.manager.move(viewer, { gameId, ply: 0, move: 'e2e4' }).ok, false);
  assert.equal(e.manager.move(a, { gameId, ply: 0, move: 'e2e4' }).ok, true);
  assert.ok(e.rooms.some(x => x.room === 'kd:1' && x.ev === 'kd:moved'));
  e.manager.shutdown();
});

test('Cờ vây qua tính điểm rồi đánh tiếp với lượt của người bấm', () => {
  const e = managerEnv();
  const { a, b, gameId } = startGame(e, 'go');
  for (const [p, ply, move] of [[a, 0, 'D4'], [b, 1, 'E4'], [a, 2, 'pass'], [b, 3, 'pass']]) {
    assert.equal(e.manager.move(p, { gameId, ply, move }).ok, true);
  }
  assert.equal(e.manager.mark(a, { gameId, point: 'D4' }).ok, true);
  assert.equal(e.manager.agree(a, { gameId }).ok, true);
  assert.equal(e.manager.resumePlay(b, { gameId }).ok, true);
  const start = e.manager.resume(b).start;
  assert.equal(start.clock.turn, 'b');
  assert.equal(start.ply, 4);
  assert.equal(e.manager.move(b, { gameId, ply: 4, move: 'F4' }).ok, true);
  e.manager.shutdown();
});

test('Danh mục đăng ký các môn đã có và chặn khóa prototype', () => {
  assert.deepEqual(Object.keys(registry), ['chess', 'xiangqi', 'jieqi', 'go', 'gomoku']);
  for (const id of Object.keys(registry)) {
    const rule = get(id);
    assert.equal(rule.id, id);
    for (const method of ['create', 'turn', 'legalMoves', 'play', 'apply', 'status', 'view', 'notation']) {
      assert.equal(typeof rule.module[method], 'function', `${id}.${method}`);
    }
    const state = rule.module.create({});
    assert.equal(state.ply, 0, id);
    const move = rule.module.legalMoves(state)[0];
    const played = rule.module.play(state, move);
    assert.equal(played.ok, true, id);
    assert.equal(state.ply, 0, `${id}: state gốc không đổi`);
    assert.equal(played.state.ply, 1, id);
  }
  assert.equal(get('jieqi').module.create({ seed: 'thử' }).variant, 'jieqi');
  assert.equal(get('__proto__'), null);
  assert.equal(get('constructor'), null);
  assert.equal(get(null), null);
});

test('Áp nước công khai khớp thế do máy chủ gửi', () => {
  for (const [id, move] of [['chess', 'e2e4'], ['xiangqi', 'b0c2'], ['jieqi', 'a3a4'], ['go', 'D4'], ['gomoku', 'h8']]) {
    const rules = get(id).module;
    const state = rules.create({});
    const played = rules.play(state, move);
    assert.equal(played.ok, true, id);
    assert.deepEqual(rules.apply(rules.view(state), move, played.info.reveal).state, rules.view(played.state), id);
    assert.equal(rules.view(played.state).ply, 1, id);
  }
});

test('Adapter chuẩn hóa mã kết quả và kiểm tra đủ quân chiếu hết', () => {
  const chess = get('chess').module;
  assert.equal(chess.sufficient(chess.fromFen('8/8/8/8/8/8/4k3/6K1 w - - 0 1'), 'a'), false);
  const gomoku = get('gomoku').module;
  assert.equal(gomoku.status({ over: true, winner: 'a' }).reason, 'five');
  assert.equal(gomoku.status({ over: true, winner: null }).reason, 'full-board');
  const xiangqi = get('xiangqi').module;
  const state = xiangqi.create({});
  state.halfmove = 120;
  assert.equal(xiangqi.status(state).reason, 'sixty');
});

test('Cờ vây chuyển qua tính điểm, đánh dấu và đánh tiếp', () => {
  const go = get('go').module;
  let state = go.create({ size: 9 });
  for (const move of ['D4', 'E4', 'pass', 'pass']) {
    const result = go.play(state, move);
    assert.equal(result.ok, true, move);
    state = result.state;
  }
  assert.equal(state.ply, 4);
  assert.equal(go.status(state).phase, 'scoring');
  assert.deepEqual(go.groupAt(state, 'D4'), ['D4']);
  const live = go.score(state, []);
  const dead = go.score(state, ['D4']);
  assert.notDeepEqual(dead, live);
  assert.equal(typeof dead.a, 'number');
  assert.equal(typeof dead.b, 'number');
  assert.equal(dead.komi, 7.5);
  const resumed = go.resume(state, 'b');
  assert.equal(go.turn(resumed), 'b');
  assert.notEqual(go.status(resumed).phase, 'scoring');
  assert.equal(resumed.ply, 4);
});

test('Nhịp, giới hạn và định dạng nước khớp giao thức', () => {
  for (const [id, fast, normal, minPlies, maxPlies] of [
    ['chess', [300000, 3000], [600000, 5000], 4, 300],
    ['xiangqi', [600000, 5000], [900000, 10000], 4, 300],
    ['go', [300000, 5000], [600000, 10000], 20, { 9: 200, 13: 400, 19: 800 }],
    ['gomoku', [180000, 3000], [300000, 5000], 10, 225]
  ]) {
    const rule = get(id);
    assert.deepEqual(rule.paces.fast, { baseMs: fast[0], incMs: fast[1] }, id);
    assert.deepEqual(rule.paces.normal, { baseMs: normal[0], incMs: normal[1] }, id);
    assert.equal(rule.minPlies, minPlies, id);
    assert.deepEqual(rule.maxPlies, maxPlies, id);
  }
  assert.deepEqual(get('go').sizes, [9, 13, 19]);
  assert.deepEqual(get('go').ratedSizes, [9]);
  assert.deepEqual(get('go').maxPlies, { 9: 200, 13: 400, 19: 800 });
  assert.equal(get('gomoku').minPlies, 10);
  assert.equal(get('gomoku').maxPlies, 225);
  for (const [id, valid, invalid] of [
    ['chess', 'e7e8q', 'e7e8k'],
    ['xiangqi', 'h2e2', 'j2e2'],
    ['go', 'pass', 'I9'],
    ['gomoku', 'a15', 'a16']
  ]) {
    assert.match(valid, get(id).movePattern);
    assert.doesNotMatch(invalid, get(id).movePattern);
  }
});

// ---- Hành vi bộ quản lý (đồng hồ giả) ----
const CHESS4 = ['e2e4', 'e7e5', 'g1f3', 'b8c6'];
function play(e, g, moves) {
  let ply = e.manager.resume(g.a).start.ply;
  for (const mv of moves) {
    const p = ply % 2 === 0 ? g.a : g.b;
    const r = e.manager.move(p, { gameId: g.gameId, ply, move: mv });
    assert.equal(r.ok, true, `${mv}: ${r.reason}`);
    ply++;
  }
}
function lastEnd(e) { return e.sent.filter(x => x.ev === 'kd:end').at(-1).payload; }

test('Ngồi, chọn luật, sẵn sàng: chỉ chủ bàn chọn luật, đổi luật xóa sẵn sàng', () => {
  const e = managerEnv(); const m = e.manager;
  const a = { uid: 'ua', pid: 'pa', name: 'An' }, b = { uid: 'ub', pid: 'pb', name: 'Bình' };
  assert.equal(m.sit(a, { table: 1, seat: 0 }).ok, true);
  assert.equal(m.sit(a, { table: 2, seat: 0 }).ok, false, 'mỗi uid một chỗ');
  assert.equal(m.sit(b, { table: 1, seat: 0 }).ok, false, 'ghế có người');
  assert.equal(m.sit(b, { table: 1, seat: 1 }).ok, true);
  assert.equal(m.setup(b, { table: 1, game: 'chess', pace: 'fast', rated: false }).ok, false);
  assert.equal(m.setup(a, { table: 1, game: 'jieqi', pace: 'fast', rated: false }).ok, true);
  assert.equal(m.setup(a, { table: 1, game: 'go', size: 13, pace: 'fast', rated: true }).ok, false, 'vây 13 không xếp hạng');
  assert.equal(m.setup(a, { table: 1, game: '__proto__', pace: 'fast', rated: false }).ok, false);
  assert.equal(m.setup(a, { table: 1, game: 'chess', pace: 'fast', rated: false }).ok, true);
  assert.equal(m.ready(a, { table: 1, ready: true }).ok, true);
  m.setup(a, { table: 1, game: 'xiangqi', pace: 'fast', rated: false });
  const t = m.tables(a).tables.find(x => x.table === 1);
  assert.deepEqual(t.seats.map(s => s.ready), [false, false]);
  assert.equal(t.status, 'waiting');
  m.ready(a, { table: 1, ready: true });
  assert.equal(m.ready(b, { table: 1, ready: true }).ok, true);
  assert.equal(m.tables(a).tables.find(x => x.table === 1).status, 'playing');
  m.shutdown();
});

test('Lời mời: 20 giây, giãn 10 giây, 1 lời đi, ≤ 3 lời đến, từ chối chờ 5 phút', () => {
  const e = managerEnv(); const m = e.manager;
  const u = n => ({ uid: 'u' + n, pid: 'p' + n, name: 'N' + n });
  const [a, b, c, d, f] = [1, 2, 3, 4, 5].map(u);
  const rules = { game: 'chess', pace: 'fast', rated: false };
  const r1 = m.invite(a, { target: b, ...rules });
  assert.equal(r1.ok, true);
  assert.equal(r1.expiresAt, e.clock.now() + 20000);
  assert.equal(m.invite(a, { target: c, ...rules }).ok, false, '1 lời đi / giãn 10 giây');
  e.clock.advance(20000);
  assert.ok(e.sent.some(x => x.ev === 'kd:invite:closed' && x.payload.reason === 'expired'));
  assert.equal(m.respond(b, { inviteId: r1.inviteId, accept: true }).ok, false, 'hết hạn');
  for (const p of [a, c, d]) { assert.equal(m.invite(p, { target: b, ...rules }).ok, true); e.clock.advance(1); }
  assert.equal(m.invite(f, { target: b, ...rules }).ok, false, 'quá 3 lời đến');
  const mine = e.sent.filter(x => x.ev === 'kd:invited' && x.uid === b.uid).map(x => x.payload);
  assert.ok(mine.every(p => !JSON.stringify(p).includes('"uid"')));
  // lời của d (cuối cùng) bị từ chối
  assert.equal(m.respond(b, { inviteId: mine.at(-1).inviteId, accept: false }).ok, true);
  e.clock.advance(11000);
  assert.equal(m.invite(d, { target: b, ...rules }).ok, false, 'bị từ chối: đợi 5 phút');
  e.clock.advance(300000);
  assert.equal(m.invite(d, { target: b, ...rules }).ok, true);
  m.shutdown();
});

test('Nhận lời mời: chọn bàn thật, hết bàn dùng bàn trong, KYDAO_MAX_GAMES', () => {
  const e = managerEnv({ maxGames: 5 }); const m = e.manager;
  const rules = { game: 'chess', pace: 'fast', rated: false };
  const ids = [];
  for (let i = 0; i < 5; i++) {
    const a = { uid: 'x' + i, pid: 'px' + i, name: 'A' + i }, b = { uid: 'y' + i, pid: 'py' + i, name: 'B' + i };
    assert.equal(m.invite(a, { target: b, ...rules }).ok, true);
    const inviteId = e.sent.filter(x => x.ev === 'kd:invited').at(-1).payload.inviteId;
    const res = m.respond(b, { inviteId, accept: true });
    assert.equal(res.ok, true, res.reason);
    ids.push(e.sent.filter(x => x.ev === 'kd:start').at(-1).payload.table);
    e.clock.advance(1000);
  }
  assert.deepEqual(ids.slice(0, 4).sort(), [1, 2, 3, 4]);
  assert.equal(ids[4], null, 'bàn trong');
  assert.ok(e.rooms.some(x => x.room === 'hall' && x.ev === 'kd:table' && x.payload.inner && x.payload.status === 'playing'));
  assert.equal(m.tables({ uid: 'z', pid: 'z', name: 'Z' }).tables.filter(t => t.inner).length, 1);
  const a = { uid: 'x9', pid: 'px9', name: 'A' }, b = { uid: 'y9', pid: 'py9', name: 'B' };
  m.invite(a, { target: b, ...rules });
  const inviteId = e.sent.filter(x => x.ev === 'kd:invited').at(-1).payload.inviteId;
  const res = m.respond(b, { inviteId, accept: true });
  assert.equal(res.ok, false);
  assert.match(res.reason, /quá nhiều ván/);
  m.shutdown();
});

test('Bàn trong xếp hạng bình thường', () => {
  const e = managerEnv(); const m = e.manager;
  for (let t = 1; t <= 4; t++) m.sit({ uid: 's' + t, pid: 'ps' + t, name: 'S' }, { table: t, seat: 0 });
  const a = { uid: 'ia', pid: 'pia', name: 'A' }, b = { uid: 'ib', pid: 'pib', name: 'B' };
  m.invite(a, { target: b, game: 'chess', pace: 'fast', rated: true });
  const inviteId = e.sent.filter(x => x.ev === 'kd:invited').at(-1).payload.inviteId;
  assert.equal(m.respond(b, { inviteId, accept: true }).ok, true);
  const start = e.sent.filter(x => x.ev === 'kd:start').at(-1).payload;
  assert.equal(start.table, null);
  assert.equal(start.rated, true);
  const g = { a, b, gameId: start.gameId };
  play(e, g, CHESS4);
  m.resign(b, { gameId: g.gameId });
  assert.equal(e.saved.length, 1);
  assert.equal(e.saved[0].rated, true);
  assert.equal(lastEnd(e).result, 'a');
  assert.ok(lastEnd(e).elo);
  m.shutdown();
});

test('Ngưỡng minPlies: 3 nước hủy, 4 nước tính Elo một lần', () => {
  for (const [plies, expectRated] of [[3, false], [4, true]]) {
    const e = managerEnv(); const g = startGame(e, 'chess', true);
    play(e, g, CHESS4.slice(0, plies));
    e.manager.resign(g.b, { gameId: g.gameId });
    e.manager.resign(g.b, { gameId: g.gameId });
    assert.equal(e.saved.length, expectRated ? 1 : 0, `plies=${plies}`);
    if (expectRated) {
      assert.equal(e.ratings.size, 2);
      const r = e.ratings.get('uid-secret-a:chess');
      assert.equal(r.n, 1);
      assert.ok(r.r > 1200);
      assert.equal(lastEnd(e).elo.a.to, r.r);
    } else assert.equal(lastEnd(e).reason, 'too-short');
    assert.equal(e.sent.filter(x => x.ev === 'kd:end').length, 2, 'mỗi người chơi nhận đúng một kd:end');
    e.manager.shutdown();
  }
});

test('Cặp đủ 3 ván/ngày: hạ xuống giao hữu và báo trước', () => {
  const e = managerEnv(); e.deps.pairCountToday = () => 3;
  const g = startGame(e, 'chess', true);
  assert.equal(g.start.rated, false);
  assert.match(g.start.downgraded, /giao hữu/);
  play(e, g, CHESS4);
  e.manager.resign(g.b, { gameId: g.gameId });
  assert.equal(e.saved[0].rated, false);
  assert.equal(e.ratings.size, 0);
  e.manager.shutdown();
});

test('Hết giờ: bên tới lượt thua; cờ vua đối thủ không đủ quân thì hòa', () => {
  const e = managerEnv(); const g = startGame(e);
  e.clock.advance(300000);
  assert.equal(lastEnd(e).reason, 'no-start', 'chưa ai đi: hủy sau 30 giây');
  e.manager.shutdown();
  const f = managerEnv(); const h = startGame(f);
  play(f, h, ['e2e4']);
  f.clock.advance(300000 - 1); // bên b còn đúng 300000 ms
  assert.equal(f.sent.filter(x => x.ev === 'kd:end').length, 0);
  f.clock.advance(1);
  assert.equal(lastEnd(f).reason, 'timeout');
  assert.equal(lastEnd(f).result, 'a');
  f.manager.shutdown();
  const k = managerEnv(); const j = startGame(k);
  play(k, j, ['e2e4']);
  const mod = get('chess').module, orig = mod.sufficient;
  mod.sufficient = () => false;
  try {
    k.clock.advance(300000);
    assert.equal(lastEnd(k).reason, 'timeout-insufficient');
    assert.equal(lastEnd(k).result, 'draw');
  } finally { mod.sufficient = orig; }
  k.manager.shutdown();
});

test('Hủy: hai bên vắng 60 giây; một bên vắng thì không hủy', () => {
  const e = managerEnv(); const g = startGame(e);
  play(e, g, ['e2e4']);
  e.manager.leave(g.a, 'disconnect');
  e.clock.advance(61000);
  assert.equal(e.sent.filter(x => x.ev === 'kd:end').length, 0);
  e.manager.leave(g.b, 'disconnect');
  e.clock.advance(59999);
  assert.equal(e.sent.filter(x => x.ev === 'kd:end').length, 0);
  e.clock.advance(1);
  assert.equal(lastEnd(e).reason, 'away');
  assert.equal(lastEnd(e).result, 'abort');
  assert.equal(e.saved.length, 0);
  e.manager.shutdown();
});

test('Xin hòa: chưa đủ nước, hết hạn, từ chối, giới hạn 3 lời, đồng ý', () => {
  const e = managerEnv(); const g = startGame(e); const m = e.manager;
  assert.equal(m.draw(g.a, { gameId: g.gameId, act: 'offer' }).ok, false, 'chưa đủ 4 nước');
  play(e, g, CHESS4);
  assert.equal(m.draw(g.a, { gameId: g.gameId, act: 'offer' }).ok, true);
  assert.equal(m.draw(g.a, { gameId: g.gameId, act: 'accept' }).ok, false, 'không tự đồng ý');
  e.clock.advance(30000);
  assert.ok(e.sent.some(x => x.ev === 'kd:offer' && x.payload.state === 'expired'));
  assert.equal(m.draw(g.a, { gameId: g.gameId, act: 'offer' }).ok, true);
  assert.equal(m.draw(g.b, { gameId: g.gameId, act: 'decline' }).ok, true);
  assert.equal(m.draw(g.a, { gameId: g.gameId, act: 'offer' }).ok, true);
  m.draw(g.b, { gameId: g.gameId, act: 'decline' });
  assert.equal(m.draw(g.a, { gameId: g.gameId, act: 'offer' }).ok, false, 'tối đa 3 lời');
  assert.equal(m.draw(g.b, { gameId: g.gameId, act: 'offer' }).ok, true);
  assert.equal(m.draw(g.a, { gameId: g.gameId, act: 'accept' }).ok, true);
  assert.equal(lastEnd(e).reason, 'agreed');
  assert.equal(lastEnd(e).result, 'draw');
  m.shutdown();
});

test('Bên kia đi một nước thì lời xin hòa bị từ chối', () => {
  const e = managerEnv(); const g = startGame(e);
  play(e, g, CHESS4);
  e.manager.draw(g.a, { gameId: g.gameId, act: 'offer' });
  assert.equal(e.manager.move(g.a, { gameId: g.gameId, ply: 4, move: 'f1c4' }).ok, true);
  assert.equal(e.sent.some(x => x.ev === 'kd:offer' && x.payload.state === 'declined'), false);
  assert.equal(e.manager.move(g.b, { gameId: g.gameId, ply: 5, move: 'g8f6' }).ok, true);
  assert.ok(e.sent.some(x => x.ev === 'kd:offer' && x.payload.state === 'declined'));
  e.manager.shutdown();
});

test('Cờ vây: đổi dấu xóa đồng ý; 3 phút tính theo dấu hiện có; hai bên đồng ý tính ngay', () => {
  const e = managerEnv(); const g = startGame(e, 'go');
  for (const [p, ply, move] of [[g.a, 0, 'D4'], [g.b, 1, 'E4'], [g.a, 2, 'pass'], [g.b, 3, 'pass']]) {
    assert.equal(e.manager.move(p, { gameId: g.gameId, ply, move }).ok, true);
  }
  const marks = () => e.sent.filter(x => x.ev === 'kd:marks').at(-1).payload;
  assert.equal(marks().clock.turn, null);
  assert.equal(marks().deadlineAt, e.clock.now() + 180000);
  assert.equal(e.manager.mark(g.a, { gameId: g.gameId, point: 'A1' }).ok, false, 'ô trống');
  assert.equal(e.manager.mark(g.a, { gameId: g.gameId, point: 'E4' }).ok, true);
  e.manager.agree(g.b, { gameId: g.gameId });
  assert.deepEqual(marks().agreed, { a: false, b: true });
  e.manager.mark(g.b, { gameId: g.gameId, point: 'E4' });
  assert.deepEqual(marks().agreed, { a: false, b: false }, 'đổi dấu xóa đồng ý');
  e.manager.mark(g.b, { gameId: g.gameId, point: 'E4' });
  e.clock.advance(179999);
  assert.equal(e.sent.filter(x => x.ev === 'kd:end').length, 0);
  e.clock.advance(1);
  const end = lastEnd(e);
  assert.equal(end.reason, 'score');
  assert.equal(typeof end.score.a, 'number');
  assert.equal(end.score.komi, 7.5);
  e.manager.shutdown();
  const f = managerEnv(); const h = startGame(f, 'go');
  for (const [p, ply, move] of [[h.a, 0, 'D4'], [h.b, 1, 'E4'], [h.a, 2, 'pass'], [h.b, 3, 'pass']]) f.manager.move(p, { gameId: h.gameId, ply, move });
  f.manager.agree(h.a, { gameId: h.gameId });
  f.manager.agree(h.b, { gameId: h.gameId });
  assert.equal(lastEnd(f).reason, 'score');
  f.manager.shutdown();
});

test('Resume: ván đang chạy, và câu báo sau khi máy chủ khởi động lại', () => {
  const e = managerEnv(); const g = startGame(e);
  assert.equal(e.active.get(g.a.uid), g.gameId);
  const rs = e.manager.resume(g.b);
  assert.equal(rs.start.you, 'b');
  assert.equal(rs.start.resumed, true);
  play(e, g, ['e2e4']);
  e.manager.resign(g.b, { gameId: g.gameId });
  assert.equal(e.active.size, 0);
  e.manager.shutdown();
  const f = managerEnv(); f.active.set('uid-cu', 'game-cu');
  const old = { uid: 'uid-cu', pid: 'pc', name: 'C' };
  const r = f.manager.resume(old);
  assert.equal(r.start, null);
  assert.equal(r.message, 'Ván cờ trước đã bị hủy vì máy chủ khởi động lại. Không ai bị tính thua.');
  assert.equal(f.active.size, 0);
  assert.equal(f.manager.resume(old).message, undefined);
  f.manager.shutdown();
});

test('Người xem: tối đa 50, gọi lại không tính thêm, bàn không ván bị từ chối', () => {
  const e = managerEnv(); startGame(e);
  for (let i = 0; i < 50; i++) assert.equal(e.manager.watch({ uid: 'w' + i, pid: 'pw' + i, name: 'W' }, { table: 1 }).ok, true);
  assert.equal(e.manager.watch({ uid: 'w50', pid: 'pw50', name: 'W' }, { table: 1 }).ok, false);
  assert.equal(e.manager.watch({ uid: 'w0', pid: 'pw0', name: 'W' }, { table: 1 }).ok, true);
  assert.equal(e.manager.watch({ uid: 'w1', pid: 'pw1', name: 'W' }, { table: 2 }).ok, false);
  e.manager.shutdown();
});

test('timeScale áp cho mọi mốc; safe không ném lỗi; tắt thì code off', () => {
  const e = managerEnv({ timeScale: 0.1 });
  const a = { uid: 'ua', pid: 'pa', name: 'A' }, b = { uid: 'ub', pid: 'pb', name: 'B' };
  const r = e.manager.invite(a, { target: b, game: 'chess', pace: 'fast', rated: false });
  assert.equal(r.expiresAt, e.clock.now() + 2000);
  assert.equal(e.manager.move(null, {}).ok, false);
  assert.equal(e.manager.move(a, null).ok, false);
  assert.equal(e.manager.sit(a, { table: '__proto__', seat: 0 }).ok, false);
  assert.equal(e.manager.setup(a, { table: 1, game: { toString() { throw new Error('x'); } } }).ok, false);
  e.manager.shutdown();
  const off = managerEnv({ enabled: false });
  assert.equal(off.manager.sit(a, { table: 1, seat: 0 }).code, 'off');
  off.manager.shutdown();
});

test('manager và registry không require socket/timer/fs', () => {
  const fs = require('node:fs');
  for (const f of ['manager.js', 'registry.js']) {
    const src = fs.readFileSync(require('node:path').join(__dirname, '..', 'lib', 'kydao', f), 'utf8');
    assert.doesNotMatch(src, /require\(['"](?:node:)?(?:fs|timers|socket\.io)/, f);
    assert.doesNotMatch(src, /\bsetTimeout\b|\bsetInterval\b|Date\.now/, f);
  }
});

test('Quét mọi emit: không uid, không bí mật; người xem nhận qua phòng', () => {
  const e = managerEnv(); const g = startGame(e);
  const viewer = { uid: 'uid-secret-viewer', pid: 'pid-viewer', name: 'Khách' };
  e.manager.watch(viewer, { table: 1 });
  play(e, g, CHESS4);
  e.manager.draw(g.a, { gameId: g.gameId, act: 'offer' });
  e.manager.draw(g.b, { gameId: g.gameId, act: 'accept' });
  const all = [...e.sent, ...e.rooms];
  assert.ok(all.length > 10);
  for (const ev of all) {
    const text = JSON.stringify(ev.payload);
    for (const s of ['uid-secret-a', 'uid-secret-b', 'uid-secret-viewer']) assert.ok(!text.includes(s), `${ev.ev} lộ ${s}`);
    assert.ok(!/"uid"|"seed"|"hidden"/.test(text), `${ev.ev} có khóa bí mật`);
  }
  assert.ok(e.rooms.some(x => x.room === 'kd:1' && x.ev === 'kd:moved'));
  assert.ok(!e.sent.some(x => x.uid === viewer.uid && x.ev === 'kd:moved'));
  e.manager.shutdown();
});

test('finish gọi lại đồng bộ giữa lúc đang kết thúc chỉ ghi một lần', () => {
  for (const reenter of [
    (e, g) => e.manager.leave(g.a, 'account'),
    (e, g) => e.manager.resign(g.b, { gameId: g.gameId })
  ]) {
    const e = managerEnv(); const g = startGame(e, 'chess', true);
    play(e, g, CHESS4);
    let calls = 0;
    e.deps.saveGame = record => { e.saved.push(structuredClone(record)); if (calls++ === 0) reenter(e, g); };
    let ratingWrites = 0; const set = e.deps.setRating;
    e.deps.setRating = (...args) => { ratingWrites++; set(...args); };
    e.manager.resign(g.b, { gameId: g.gameId });
    assert.equal(e.saved.length, 1);
    assert.equal(ratingWrites, 2, 'mỗi người một lần');
    assert.equal(e.ratings.get('uid-secret-a:chess').n, 1);
    assert.equal(e.sent.filter(x => x.ev === 'kd:end').length, 2, 'mỗi người chơi nhận đúng một kd:end');
    e.manager.shutdown();
  }
});

test('kd:move kiểm ply: đúng lượt nhưng ply cũ hoặc vượt bị chặn', () => {
  const e = managerEnv(); const g = startGame(e);
  play(e, g, ['e2e4', 'e7e5']);
  const movedBefore = e.sent.filter(x => x.ev === 'kd:moved').length;
  const before = e.manager.resume(g.a).start;
  for (const ply of [1, 3, -1, '2', undefined]) {
    const r = e.manager.move(g.a, { gameId: g.gameId, ply, move: 'g1f3' });
    assert.equal(r.ok, false, `ply=${ply}`);
    assert.equal(r.code, 'stale');
  }
  const after = e.manager.resume(g.a).start;
  assert.equal(after.ply, before.ply);
  assert.deepEqual(after.clock, before.clock);
  assert.equal(e.sent.filter(x => x.ev === 'kd:moved').length, movedBefore);
  e.manager.shutdown();
});

test('Hẹn giờ trễ: nước tới sau hạn bị xử hết giờ, không được nhận', () => {
  const e = managerEnv(); e.deps.setTimer = () => 0; // hẹn giờ không bao giờ chạy
  const g = startGame(e);
  play(e, g, ['e2e4']);
  e.clock.advance(300000);
  const r = e.manager.move(g.b, { gameId: g.gameId, ply: 1, move: 'e7e5' });
  assert.equal(r.ok, false);
  assert.equal(e.sent.filter(x => x.ev === 'kd:moved').length, 2, 'chỉ nước e2e4 (mỗi người một gói)');
  assert.equal(lastEnd(e).reason, 'timeout');
  assert.equal(lastEnd(e).result, 'a');
  assert.match(lastEnd(e).text, /hết giờ/);
  e.manager.shutdown();
});

test('Người đang xem bàn nhận lời mời thì thôi xem', () => {
  const e = managerEnv(); const m = e.manager;
  const a = { uid: 'ua', pid: 'pa', name: 'An' }, b = { uid: 'ub', pid: 'pb', name: 'Bình' };
  m.sit({ uid: 'uc', pid: 'pc', name: 'C' }, { table: 1, seat: 0 });
  m.sit({ uid: 'ud', pid: 'pd', name: 'D' }, { table: 1, seat: 1 });
  m.setup({ uid: 'uc', pid: 'pc', name: 'C' }, { table: 1, game: 'chess', pace: 'fast', rated: false });
  m.ready({ uid: 'uc', pid: 'pc', name: 'C' }, { table: 1, ready: true });
  m.ready({ uid: 'ud', pid: 'pd', name: 'D' }, { table: 1, ready: true });
  assert.equal(m.watch(b, { table: 1 }).ok, true);
  assert.equal(m.stats().watchers, 1);
  m.invite(a, { target: b, game: 'chess', pace: 'fast', rated: false });
  const inviteId = e.sent.filter(x => x.ev === 'kd:invited').at(-1).payload.inviteId;
  assert.equal(m.respond(b, { inviteId, accept: true }).ok, true);
  assert.equal(m.stats().watchers, 0);
  assert.equal(m.tables(a).tables.find(t => t.table === 1).watchers, 0);
  m.shutdown();
});

test('Cờ vây 13 xếp hạng: câu lỗi riêng; lời mời trùng báo đúng người gửi', () => {
  const e = managerEnv(); const m = e.manager;
  const a = { uid: 'ua', pid: 'pa', name: 'An' }, b = { uid: 'ub', pid: 'pb', name: 'Bình' };
  const r = m.invite(a, { target: b, game: 'go', size: 13, pace: 'fast', rated: true });
  assert.equal(r.reason, 'Cờ vây chỉ xếp hạng ở bàn 9×9.');
  assert.equal(m.invite(a, { target: b, game: 'chess', pace: 'fast', rated: false }).ok, true);
  e.clock.advance(11000);
  assert.match(m.invite(a, { target: { uid: 'uz', pid: 'pz', name: 'Z' }, game: 'chess', pace: 'fast', rated: false }).reason, /lời mời chờ/);
  m.shutdown();
});

test('Bàn chờ quá 5 phút bị dọn và đặt lại lượt đi trước', () => {
  const e = managerEnv(); const m = e.manager;
  const a = { uid: 'ua', pid: 'pa', name: 'An' };
  m.sit(a, { table: 1, seat: 0 });
  e.clock.advance(299999);
  assert.equal(m.tables(a).tables.find(t => t.table === 1).status, 'waiting');
  e.clock.advance(1);
  assert.equal(m.tables(a).tables.find(t => t.table === 1).status, 'free');
  assert.equal(m.sit(a, { table: 1, seat: 0 }).ok, true);
  m.shutdown();
});

test('Đủ KYDAO_MAX_GAMES: bắt đầu từ bàn ngồi (ready) bị từ chối', () => {
  const e = managerEnv({ maxGames: 1 }); const m = e.manager;
  startGame(e);
  const c = { uid: 'uc', pid: 'pc', name: 'C' }, d = { uid: 'ud', pid: 'pd', name: 'D' };
  m.sit(c, { table: 2, seat: 0 }); m.sit(d, { table: 2, seat: 1 });
  m.setup(c, { table: 2, game: 'chess', pace: 'fast', rated: false });
  m.ready(c, { table: 2, ready: true });
  const r = m.ready(d, { table: 2, ready: true });
  assert.equal(r.ok, false);
  assert.match(r.reason, /quá nhiều ván/);
  assert.equal(m.tables(c).tables.find(t => t.table === 2).seats[1].ready, false);
  m.shutdown();
});

/* ----- T-110: skin sân / skin quân (kd:skin) ----- */

const NULL_SKINS = { a: { field: null, pieces: null }, b: { field: null, pieces: null } };

test('kd:skin: hai người chơi và người xem nhận cùng gói; ảnh chụp ván có skins; không lộ uid', () => {
  const e = managerEnv(); const m = e.manager;
  const { a, b, gameId, start } = startGame(e);
  const viewer = { uid: 'uid-secret-viewer', pid: 'pv', name: 'Khách' };
  assert.deepEqual(start.skins, NULL_SKINS, 'ván mới bắt đầu bằng null');
  for (const ev of e.sent.filter(x => x.ev === 'kd:start')) assert.deepEqual(ev.payload.skins, NULL_SKINS);
  for (const ev of e.rooms.filter(x => x.ev === 'kd:start')) assert.deepEqual(ev.payload.skins, NULL_SKINS);
  assert.equal(m.watch(viewer, { table: 1 }).ok, true);
  e.sent.length = e.rooms.length = 0;

  assert.deepEqual(m.skin(a, { gameId, field: 'volcano', pieces: 'magma' }), { ok: true, field: 'volcano', pieces: 'magma' });
  const expected = { gameId, side: 'a', field: 'volcano', pieces: 'magma', opened: true };
  assert.deepEqual(e.sent.filter(x => x.ev === 'kd:skin').map(x => [x.uid, x.payload]), [[a.uid, expected], [b.uid, expected]]);
  assert.deepEqual(e.rooms.filter(x => x.ev === 'kd:skin').map(x => [x.room, x.payload]), [['kd:1', expected]]);

  // Đổi quân (không đổi sân) thì không chạy màn khai mở.
  e.clock.advance(3000);
  assert.equal(m.skin(b, { gameId, pieces: 'jade' }).ok, true);
  assert.deepEqual(e.rooms.at(-1).payload, { gameId, side: 'b', field: null, pieces: 'jade', opened: false });
  // Đổi từ skin này sang skin khác vẫn là khai mở.
  assert.equal(m.move(a, { gameId, ply: 0, move: 'e2e4' }).ok, true);   // qua mốc 30 giây "không đi nước đầu"
  e.clock.advance(20000);
  assert.equal(m.skin(a, { gameId, field: 'river' }).ok, true);
  assert.deepEqual(e.rooms.at(-1).payload, { gameId, side: 'a', field: 'river', pieces: 'magma', opened: true });
  // Bỏ sân: field null, opened false.
  e.clock.advance(20000);
  assert.equal(m.skin(a, { gameId, field: null }).ok, true);
  assert.deepEqual(e.rooms.at(-1).payload, { gameId, side: 'a', field: null, pieces: 'magma', opened: false });
  e.clock.advance(20000);
  assert.equal(m.skin(a, { gameId, field: 'lotus' }).ok, true);

  const want = { a: { field: 'lotus', pieces: 'magma' }, b: { field: null, pieces: 'jade' } };
  assert.deepEqual(m.resume(a).start.skins, want);
  assert.deepEqual(m.resume(b).start.skins, want);
  assert.equal(m.watch(viewer, { table: 1 }).ok, true);
  assert.deepEqual(e.sent.filter(x => x.ev === 'kd:start' && x.uid === viewer.uid).at(-1).payload.skins, want);
  for (const event of [...e.sent, ...e.rooms]) {
    const json = JSON.stringify(event.payload);
    for (const u of [a, b, viewer]) assert.ok(!json.includes(u.uid), event.ev);
  }
  m.shutdown();
});

test('kd:skin: chỉ người chơi; mã lạ, kiểu lạ, __proto__ thành null; môn không hỗ trợ bị từ chối', () => {
  const e = managerEnv(); const m = e.manager;
  const { a, b, gameId } = startGame(e);
  assert.equal(m.move(a, { gameId, ply: 0, move: 'e2e4' }).ok, true);
  const viewer = { uid: 'uid-v', pid: 'pv', name: 'Khách' };
  assert.equal(m.watch(viewer, { table: 1 }).ok, true);
  assert.equal(m.skin(viewer, { gameId, field: 'volcano' }).reason, 'Bạn không phải người chơi của ván này.');
  assert.equal(m.skin({ uid: 'uid-o', pid: 'po', name: 'Ngoài' }, { gameId, field: 'volcano' }).ok, false);
  assert.equal(m.skin(a, { gameId: 'khong-co', field: 'volcano' }).code, 'stale');
  assert.equal(m.skin(a, { gameId: { toString: () => gameId }, field: 'volcano' }).ok, false);
  assert.equal(m.skin(a, { gameId }).reason, 'Chưa chọn skin.');
  assert.equal(m.skin(a, null).ok, false);
  assert.equal(e.sent.filter(x => x.ev === 'kd:skin').length, 0);

  // Khóa lạ bị bỏ; khóa kế thừa (không phải khóa riêng) không được đọc.
  const inherited = Object.create({ field: 'volcano' }); inherited.gameId = gameId;
  assert.equal(m.skin(a, inherited).reason, 'Chưa chọn skin.');
  assert.equal(m.skin(a, { gameId, side: 'b', fields: 'volcano' }).reason, 'Chưa chọn skin.');

  // Mỗi lần đặt skin thật trước, rồi gửi mã xấu: về null (mặc định). Đồng hồ của b vẫn chạy nên giữ tổng thời gian dưới 300 giây.
  const bad = ['__proto__', 'constructor', 'toString', 'hasOwnProperty', 'VOLCANO', 'volcano ', '', 7, true, ['volcano'], { id: 'volcano' }];
  for (const v of bad) {
    e.clock.advance(3000);
    assert.equal(m.skin(a, { gameId, pieces: 'wood' }).ok, true);
    e.clock.advance(3000);
    const r = m.skin(a, JSON.parse(JSON.stringify({ gameId, field: v, pieces: v })));
    assert.deepEqual(r, { ok: true, field: null, pieces: null }, JSON.stringify(v));
  }
  for (const v of ['__proto__', 'toString', { id: 'volcano' }]) {
    e.clock.advance(20000);
    assert.equal(m.skin(a, { gameId, field: 'forest' }).ok, true);
    e.clock.advance(20000);
    const r = m.skin(a, JSON.parse(JSON.stringify({ gameId, field: v })));
    assert.deepEqual(r, { ok: true, field: null, pieces: null }, JSON.stringify(v));
    assert.equal(e.rooms.at(-1).payload.opened, false);
  }
  // __proto__ là khóa riêng (như JSON.parse tạo ra) cũng không làm bẩn gì.
  e.clock.advance(20000);
  const r = m.skin(a, JSON.parse(`{"gameId":"${gameId}","__proto__":{"field":"volcano"},"pieces":"ice"}`));
  assert.deepEqual(r, { ok: true, field: null, pieces: 'ice' });
  assert.equal({}.field, undefined);
  // Bên b không bị đổi bởi bất cứ yêu cầu nào của a (side không lấy từ client).
  assert.deepEqual(m.resume(b).start.skins.b, { field: null, pieces: null });
  m.shutdown();

  for (const game of ['go', 'gomoku']) {
    const g = managerEnv();
    const s = startGame(g, game);
    assert.deepEqual(s.start.skins, NULL_SKINS);
    assert.equal(g.manager.skin(s.a, { gameId: s.gameId, field: 'volcano' }).reason, 'Môn này không có skin sân.');
    assert.equal(g.sent.some(x => x.ev === 'kd:skin'), false);
    g.manager.shutdown();
  }
});

test('kd:skin: caro và cờ vây chín nhân chín chỉ đổi bộ đá, giữ giới hạn ba giây', () => {
  for (const game of ['gomoku', 'go']) {
    const e = managerEnv(); const m = e.manager;
    const { a, b, gameId } = startGame(e, game, false, game === 'go' ? 9 : undefined);
    const viewer = { uid: 'uid-v', pid: 'pv', name: 'Khách' };
    assert.equal(m.watch(viewer, { table: 1 }).ok, true);
    assert.equal(m.skin(viewer, { gameId, pieces: 'cosmos' }).reason, 'Bạn không phải người chơi của ván này.');
    assert.equal(m.skin(a, { gameId, field: 'volcano' }).reason, 'Môn này không có skin sân.');
    assert.deepEqual(m.skin(a, { gameId, pieces: 'cosmos' }), { ok: true, field: null, pieces: 'cosmos' });
    const expected = { gameId, side: 'a', field: null, pieces: 'cosmos', opened: false };
    assert.deepEqual(e.sent.filter(x => x.ev === 'kd:skin').map(x => [x.uid, x.payload]), [[a.uid, expected], [b.uid, expected]]);
    assert.deepEqual(e.rooms.filter(x => x.ev === 'kd:skin').map(x => [x.room, x.payload]), [['kd:1', expected]]);
    assert.equal(m.skin(a, { gameId, pieces: 'forest' }).code, 'rate');
    e.clock.advance(2999);
    assert.equal(m.skin(a, { gameId, pieces: 'forest' }).code, 'rate');
    e.clock.advance(1);
    assert.deepEqual(m.skin(a, { gameId, pieces: 'forest', field: 'river' }), { ok: true, field: null, pieces: 'forest' });
    assert.deepEqual(e.rooms.at(-1).payload, { gameId, side: 'a', field: null, pieces: 'forest', opened: false });
    const want = { a: { field: null, pieces: 'forest' }, b: { field: null, pieces: null } };
    assert.deepEqual(m.resume(a).start.skins, want);
    assert.equal(m.watch(viewer, { table: 1 }).ok, true);
    assert.deepEqual(e.sent.filter(x => x.ev === 'kd:start' && x.uid === viewer.uid).at(-1).payload.skins, want);
    e.clock.advance(3000);
    assert.deepEqual(m.skin(a, { gameId, pieces: 'jade' }), { ok: true, field: null, pieces: null });
    assert.deepEqual(e.rooms.at(-1).payload, { gameId, side: 'a', field: null, pieces: null, opened: false });
    m.shutdown();
  }
});

test('kd:skin: giới hạn sân 20 giây, quân 3 giây, theo đồng hồ tiêm và KYDAO_TIME_SCALE', () => {
  const e = managerEnv(); const m = e.manager;
  const { a, b, gameId } = startGame(e);
  assert.equal(m.move(a, { gameId, ply: 0, move: 'e2e4' }).ok, true);
  const t0 = e.clock.now();
  assert.equal(m.skin(a, { gameId, field: 'volcano', pieces: 'magma' }).ok, true);
  const count = () => e.sent.filter(x => x.ev === 'kd:skin').length;
  const sent = count();

  // Gửi lại đúng mã đang dùng: không phải thay đổi, không tính lượt, không phát.
  assert.deepEqual(m.skin(a, { gameId, field: 'volcano', pieces: 'magma' }), { ok: true, field: 'volcano', pieces: 'magma' });
  assert.equal(count(), sent);

  e.clock.advance(2999);
  let r = m.skin(a, { gameId, pieces: 'jade' });
  assert.equal(r.ok, false); assert.equal(r.code, 'rate'); assert.equal(r.retryAt, t0 + 3000);
  assert.match(r.reason, /quân/);
  e.clock.advance(1);
  assert.equal(m.skin(a, { gameId, pieces: 'jade' }).ok, true);

  // Sân còn khóa thì cả yêu cầu bị từ chối, phần quân cũng không đổi.
  e.clock.advance(5000);
  r = m.skin(a, { gameId, field: 'river', pieces: 'ice' });
  assert.equal(r.code, 'rate'); assert.equal(r.retryAt, t0 + 20000);
  assert.equal(r.reason, 'Đợi 12 giây nữa mới đổi được sân.');
  assert.equal(m.resume(a).start.skins.a.pieces, 'jade');
  // Giới hạn tính riêng từng người.
  assert.equal(m.skin(b, { gameId, field: 'river' }).ok, true);
  e.clock.advance(t0 + 20000 - e.clock.now());
  assert.equal(m.skin(a, { gameId, field: 'river', pieces: 'ice' }).ok, true);
  m.shutdown();

  const fast = managerEnv({ timeScale: 0.05 });
  const s = startGame(fast);
  assert.equal(fast.manager.skin(s.a, { gameId: s.gameId, field: 'volcano' }).ok, true);
  fast.clock.advance(999);
  assert.equal(fast.manager.skin(s.a, { gameId: s.gameId, field: 'river' }).code, 'rate');
  fast.clock.advance(1);
  assert.equal(fast.manager.skin(s.a, { gameId: s.gameId, field: 'river' }).ok, true);
  fast.manager.shutdown();
});

test('kd:skin: ván đã kết thúc bị từ chối; đấu lại bắt đầu bằng null; bàn trong chỉ gửi hai người chơi', () => {
  const e = managerEnv(); const m = e.manager;
  const { a, b, gameId } = startGame(e);
  assert.equal(m.skin(a, { gameId, field: 'volcano' }).ok, true);
  assert.equal(m.resign(b, { gameId }).ok, true);
  const r = m.skin(a, { gameId, field: 'river' });
  assert.equal(r.ok, false); assert.equal(r.code, 'stale');
  // Biên bản ván không mang skin (không lưu bền, K3).
  assert.equal(JSON.stringify(e.saved).includes('volcano'), false);
  assert.equal(m.ready(a, { table: 1, ready: true }).ok, true);
  assert.equal(m.ready(b, { table: 1, ready: true }).ok, true);
  const again = m.resume(a).start;
  assert.notEqual(again.gameId, gameId);
  assert.deepEqual(again.skins, NULL_SKINS);
  m.shutdown();

  // Hết bàn: ván mời thành bàn trong, không có phòng người xem.
  const f = managerEnv(); const n = f.manager;
  for (let i = 1; i <= 4; i++) assert.equal(n.sit({ uid: 'us' + i, pid: 'ps' + i, name: 'S' + i }, { table: i, seat: 0 }).ok, true);
  const c = { uid: 'uc', pid: 'pc', name: 'C' }, d = { uid: 'ud', pid: 'pd', name: 'D' };
  assert.equal(n.invite(c, { target: d, game: 'xiangqi', pace: 'fast', rated: false }).ok, true);
  const inviteId = f.sent.filter(x => x.ev === 'kd:invited').at(-1).payload.inviteId;
  assert.equal(n.respond(d, { inviteId, accept: true }).ok, true);
  const inner = n.resume(c).start;
  assert.equal(inner.table, null);
  f.rooms.length = 0;
  assert.equal(n.skin(d, { gameId: inner.gameId, pieces: 'bronze' }).ok, true);
  assert.equal(f.rooms.some(x => x.ev === 'kd:skin'), false);
  assert.deepEqual(f.sent.filter(x => x.ev === 'kd:skin').map(x => x.uid), [c.uid, d.uid]);
  n.shutdown();
});

/* ----- T-151: khóa skin (skinAllowed / skinPrice) và revalidateSkins ----- */

test('kd:skin: skin chưa mở bị từ chối code locked kèm giá; kiểm quyền đứng trước kiểm tần suất; về mặc định luôn được', () => {
  const owned = new Set(['field:river', 'pieces:wood']);
  let on = true;
  const calls = [];
  const e = managerEnv();
  e.deps.skinAllowed = (uid, kind, id) => { calls.push([uid, kind, id]); return !on || owned.has(kind + ':' + id); };
  e.deps.skinPrice = (kind, id) => (kind === 'field' ? 50000 : 20000);
  const m = createKydaoManager(e.deps);
  const { a, gameId } = startGame({ ...e, manager: m });
  const r = m.skin(a, { gameId, field: 'volcano', pieces: 'magma' });
  assert.deepEqual(r, { ok: false, reason: 'Skin này cần cúng dường để mở.', code: 'locked', kind: 'field', id: 'volcano', price: 50000 });
  assert.equal(e.sent.some(x => x.ev === 'kd:skin'), false, 'không phát gì khi bị khóa');
  assert.deepEqual(m.skin(a, { gameId, pieces: 'magma' }), { ok: false, reason: 'Skin này cần cúng dường để mở.', code: 'locked', kind: 'pieces', id: 'magma', price: 20000 });
  // skin đã mở thì được
  assert.equal(m.skin(a, { gameId, field: 'river', pieces: 'wood' }).ok, true);
  // đổi liền (đang trong thời gian chờ) sang skin chưa mở: trả locked chứ không phải rate
  assert.equal(m.skin(a, { gameId, pieces: 'magma' }).code, 'locked');
  assert.equal(m.move(a, { gameId, ply: 0, move: 'e2e4' }).ok, true);   // qua mốc 30 giây "không đi nước đầu"
  // về mặc định (null) không bị khóa; còn trong thời gian chờ thì là 'rate', không phải 'locked'
  assert.equal(m.skin(a, { gameId, field: null }).code, 'rate');
  e.clock.advance(20000);
  assert.equal(m.skin(a, { gameId, field: null, pieces: null }).ok, true);
  assert.ok(calls.every(c => c[0] === a.uid), 'tra quyền theo đúng uid của người đổi');
  // cửa hàng tắt: tự do
  on = false;
  e.clock.advance(20000);
  assert.equal(m.skin(a, { gameId, field: 'volcano' }).ok, true);
  m.shutdown();
});

test('kd:skin: cờ vây/caro tra loại stones, cờ vua tra loại pieces', () => {
  for (const [game, kind] of [['gomoku', 'stones'], ['go', 'stones'], ['chess', 'pieces']]) {
    const e = managerEnv();
    e.deps.skinAllowed = () => false;
    const m = createKydaoManager(e.deps);
    const { a, gameId } = startGame({ ...e, manager: m }, game, false, game === 'go' ? 9 : undefined);
    const r = m.skin(a, { gameId, pieces: game === 'chess' ? 'magma' : 'cosmos' });
    assert.equal(r.code, 'locked'); assert.equal(r.kind, kind);
    assert.equal(r.price, null, 'không có skinPrice thì giá null');
    m.shutdown();
  }
});

test('revalidateSkins: gỡ skin không còn được phép ở mọi ván, chỉ bên bị ảnh hưởng, phát kd:skin opened:false', () => {
  const owned = new Set();
  let on = false;
  const e = managerEnv();
  e.deps.skinAllowed = (uid, kind, id) => !on || (uid === 'uid-secret-b' && owned.has(kind + ':' + id));
  const m = createKydaoManager(e.deps);
  const { a, b, gameId } = startGame({ ...e, manager: m });
  owned.add('field:ocean'); owned.add('pieces:coral');
  assert.equal(m.skin(a, { gameId, field: 'volcano', pieces: 'magma' }).ok, true);
  assert.equal(m.skin(b, { gameId, field: 'ocean', pieces: 'coral' }).ok, true);
  assert.equal(m.revalidateSkins(), 0, 'cửa hàng tắt: không gỡ gì');
  on = true;
  e.sent.length = e.rooms.length = 0;
  assert.equal(m.revalidateSkins(), 1, 'chỉ bên a bị gỡ');
  const ev = e.sent.filter(x => x.ev === 'kd:skin');
  assert.equal(ev.length, 2, 'cả hai người chơi nhận');
  assert.deepEqual(ev[0].payload, { gameId, side: 'a', field: null, pieces: null, opened: false });
  assert.deepEqual(m.resume(a).start.skins, { a: { field: null, pieces: null }, b: { field: 'ocean', pieces: 'coral' } });
  assert.equal(m.revalidateSkins(), 0, 'chạy lại không gỡ thêm');
  m.shutdown();
});
