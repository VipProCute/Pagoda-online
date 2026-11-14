'use strict';

const registry = require('./registry');
const elo = require('./elo');
const { newSeed } = require('../pk/rng');
// Danh mục skin dùng chung với trình duyệt (UMD); máy chủ chỉ dùng để kiểm mã (KE-HOACH-KY-DAI K1, K2).
const KydaoSkins = require('../../public/js/kydao-skins.js');

// Người gọi truyền hồ sơ đã xác thực { uid, pid, name, look } và đối tượng
// đích đã phân giải từ pid; quyền vị trí, chặn và DND thuộc lớp socket.
function createKydaoManager(deps) {
  const config = deps.config || {};
  const scale = Number.isFinite(config.timeScale) && config.timeScale > 0 ? config.timeScale : 1;
  const maxGames = Number.isInteger(config.maxGames) && config.maxGames > 0 ? config.maxGames : 12;
  const now = deps.now;
  const games = new Map(), byUid = new Map(), invites = new Map();
  const sentAt = new Map(), rejected = new Map(), watching = new Map();
  const tables = Array.from({ length: 4 }, (_, i) => ({ id: i + 1, seats: [null, null], host: null, rules: null, game: null, watchers: new Set(), timer: null, flip: false }));
  const timers = new Set();
  const fail = (reason, code) => Object.assign({ ok: false, reason }, code ? { code } : {});
  const ok = () => ({ ok: true });
  const own = (o, k) => o && Object.prototype.hasOwnProperty.call(o, k);
  const field = (o, k) => own(o, k) ? o[k] : undefined;
  const validUser = p => p && typeof p.uid === 'string' && p.uid && ((typeof p.pid === 'string' && p.pid) || Number.isSafeInteger(p.pid)) && typeof p.name === 'string';
  const user = p => ({ uid: p.uid, pid: p.pid, name: p.name, look: p.look, x: p.x, z: p.z });
  const pub = p => p ? { pid: p.pid, name: p.name, ready: !!p.ready } : null;
  const tableOf = n => Number.isInteger(n) && n >= 1 && n <= 4 ? tables[n - 1] : null;
  const ms = n => n * scale;
  const arm = (fn, delay) => {
    let id;
    id = deps.setTimer(() => {
      timers.delete(id);
      try { fn(); } catch (_) { if (deps.log) { try { deps.log('Lỗi hẹn giờ Kỳ Đạo.'); } catch (_) {} } }
    }, Math.max(0, delay));
    timers.add(id);
    return id;
  };
  const disarm = id => { if (id != null) { deps.clearTimer(id); timers.delete(id); } };
  const emit = (uid, ev, data) => deps.emit(uid, ev, data);
  const room = (name, ev, data) => deps.emitRoom(name, ev, data);
  const notify = (g, ev, data) => {
    emit(g.a.uid, ev, data); emit(g.b.uid, ev, data);
    // Người xem nhận qua phòng kd:<bàn>; người chơi không vào phòng này (KY-DAO §5.3).
    if (g.table) room('kd:' + g.table.id, ev, data);
  };
  const pairKey = (a, b) => JSON.stringify([a, b]);
  const busy = uid => byUid.has(uid) || tables.some(t => t.seats.some(p => p && p.uid === uid));
  const downgraded = 'Hai bạn đã đủ 3 ván xếp hạng hôm nay ở môn này; ván này là giao hữu.';
  const pairFull = (a, b, game) => deps.pairCountToday(a, b, game) >= 3;
  const rulesFor = data => {
    const game = field(data, 'game'), pace = field(data, 'pace'), rated = field(data, 'rated'), size = field(data, 'size');
    const rule = registry.get(game);
    if (!rule || !own(rule.paces, pace) || typeof rated !== 'boolean') return null;
    if (game === 'go') {
      const s = size === undefined ? 9 : size;
      if (!rule.sizes.includes(s) || (rated && !rule.ratedSizes.includes(s))) return null;
      return { game, pace, rated, size: s, rule };
    }
    if (size !== undefined) return null;
    return { game, pace, rated, rule };
  };
  const goRatedSize = data => field(data, 'game') === 'go' && field(data, 'rated') === true && field(data, 'size') !== undefined && field(data, 'size') !== 9;
  const login = p =>!deps.isAccount(p.uid);
  const tableData = t => {
    const out = { table: t.id, status: t.game ? 'playing' : t.host ? 'waiting' : 'free', seats: t.seats.map(pub), watchers: t.watchers.size };
    if (t.host) out.host = t.host.pid;
    if (t.rules) {
      Object.assign(out, { game: t.rules.game, rated: t.rules.rated, pace: t.rules.pace });
      if (t.rules.size) out.size = t.rules.size;
      if (t.rules.rated && t.seats[0] && t.seats[1] && pairFull(t.seats[0].uid, t.seats[1].uid, t.rules.game)) out.note = downgraded;
    }
    return out;
  };
  const innerData = (g, ended) => ({ table: null, gameId: g.id, inner: true, status: ended ? 'free' : 'playing', seats: ended ? [null, null] : [pub(g.a), pub(g.b)], watchers: 0 });
  const tableEvent = t => room('yard', 'kd:table', tableData(t));
  const innerEvent = (g, ended) => room('hall', 'kd:table', innerData(g, ended));
  const waitTimer = t => {
    disarm(t.timer); t.timer = null;
    if (t.host && !t.game) t.timer = arm(() => {
      t.timer = null;
      if (!t.game) { t.seats = [null, null]; t.host = null; t.rules = null; t.flip = false; tableEvent(t); }
    }, ms(300000));
  };
  const clock = g => ({ a: g.clock.a, b: g.clock.b, turn: g.clock.turn, turnStartedAt: g.clock.turnStartedAt, incMs: g.clock.incMs });
  const marks = g => ({ dead: Array.from(g.dead), agreed: { a: g.agreed.a, b: g.agreed.b }, deadlineAt: g.deadlineAt, clock: clock(g) });
  // Skin là trạng thái của ván trong RAM (K3): bản sao để không ai giữ tham chiếu vào g.
  const skins = g => ({ a: { field: g.skins.a.field, pieces: g.skins.a.pieces }, b: { field: g.skins.b.field, pieces: g.skins.b.pieces } });
  const playerInfo = (p, g) => {
    const s = g.rated ? deps.getRating(p.uid, g.rules.game) : null;
    return { pid: p.pid, name: p.name, look: p.look || null, elo: s ? s.r : null, prov: s ? elo.isProvisional(s.n) : true };
  };
  const startPayload = (g, side, resumed) => {
    const p = { gameId: g.id, table: g.table ? g.table.id : null, game: g.rules.game, rated: g.rated, pace: g.rules.pace, a: playerInfo(g.a, g), b: playerInfo(g.b, g), state: g.rules.rule.module.view(g.state, side || 'a'), ply: g.state.ply, moves: g.moves.slice(-400), clock: clock(g), offer: g.offer ? g.offer.side : null };
    if (g.rules.size) p.size = g.rules.size;
    if (side) p.you = side;
    if (resumed) p.resumed = true;
    if (g.downgraded) p.downgraded = downgraded;
    if (g.phase === 'scoring') { const m = marks(g); delete m.clock; p.marks = m; }
    p.skins = skins(g);
    return p;
  };
  const sideOf = (g, uid) => g.a.uid === uid ? 'a' : g.b.uid === uid ? 'b' : null;
  const other = s => s === 'a' ? 'b' : 'a';
  const closeInvite = (i, reason) => {
    if (!invites.has(i.id)) return;
    invites.delete(i.id); disarm(i.timer);
    const data = { inviteId: i.id, reason };
    emit(i.from.uid, 'kd:invite:closed', data); emit(i.to.uid, 'kd:invite:closed', data);
  };
  const clearOffers = (g, state) => {
    if (!g.offer) return;
    disarm(g.offer.timer); g.offer = null;
    const payload = { gameId: g.id, kind: 'draw', state };
    emit(g.a.uid, 'kd:offer', payload); emit(g.b.uid, 'kd:offer', payload);
  };
  const finish = (g, result, reason, score) => {
    if (g.over) return;
    g.over = true;
    for (const id of [g.timer, g.firstTimer, g.awayTimer, g.scoreTimer, g.offer && g.offer.timer]) disarm(id);
    if (g.rated && result !== 'abort' && g.state.ply < g.rules.rule.minPlies) { result = 'abort'; reason = 'too-short'; }
    let change;
    // saveGame là nơi ghi biên bản và tăng bộ đếm cặp cho ván rated.
    if (result !== 'abort') {
      let rated = g.rated && !pairFull(g.a.uid, g.b.uid, g.rules.game);
      let sa, sb, na, nb;
      if (rated) {
        sa = deps.getRating(g.a.uid, g.rules.game) || elo.newStat(); sb = deps.getRating(g.b.uid, g.rules.game) || elo.newStat();
        const points = result === 'draw' ? 0.5 : result === 'a' ? 1 : 0;
        const calc = elo.update({ ra: sa.r, rb: sb.r, na: sa.n, nb: sb.n, score: points });
        na = elo.applyResult(sa, { newR: calc.ra, score: points, now: now() });
        nb = elo.applyResult(sb, { newR: calc.rb, score: 1 - points, now: now() });
        change = { a: { from: sa.r, to: na.r }, b: { from: sb.r, to: nb.r } };
      }
      const record = { id: g.id, at: now(), game: g.rules.game, rated, pace: g.rules.pace, a: { uid: g.a.uid, name: g.a.name, eloFrom: change ? change.a.from : null, eloTo: change ? change.a.to : null }, b: { uid: g.b.uid, name: g.b.name, eloFrom: change ? change.b.from : null, eloTo: change ? change.b.to : null }, result, reason, moves: g.moves.map(m => m.r ? { m: m.m, r: m.r } : { m: m.m }) };
      if (g.seed) record.seed = g.seed;
      if (g.rules.size) record.size = g.rules.size;
      if (rated) { deps.setRating(g.a.uid, g.rules.game, na); deps.setRating(g.b.uid, g.rules.game, nb); }
      deps.saveGame(record);
    }
    byUid.delete(g.a.uid); byUid.delete(g.b.uid); games.delete(g.id);
    deps.setActive(g.a.uid, null); deps.setActive(g.b.uid, null);
    const loserName = result === 'a' ? g.b.name : result === 'b' ? g.a.name : '';
    let text = result === 'abort' ? 'Ván cờ đã hủy.' : 'Ván cờ đã kết thúc.';
    if (reason === 'timeout') text = `${loserName} hết giờ.`;
    else if (reason === 'resign') text = `${loserName} xin thua.`;
    else if (reason === 'timeout-insufficient') text = 'Hết giờ, đối thủ không đủ quân chiếu hết: hòa.';
    else if (reason === 'no-start') text = 'Không ai đi nước đầu, ván đã hủy.';
    const end = { gameId: g.id, result, reason, text };
    if (g.rules.game === 'jieqi') {
      // Hết ván mới lật toàn bộ quân; không gửi bảng bí mật hoặc seed.
      end.final = g.rules.rule.module.view(g.state);
      end.final.board = g.state.board.map((p, i) => p === 'X' || p === 'x' ? g.state.hidden[i] : p);
    }
    if (change) end.elo = change;
    if (score) end.score = { a: score.a, b: score.b, komi: score.komi };
    notify(g, 'kd:end', end);
    if (g.table) {
      g.table.game = null; g.table.flip = !g.table.flip;
      g.table.seats.forEach(p => { if (p) p.ready = false; });
      waitTimer(g.table); tableEvent(g.table);
    } else innerEvent(g, true);
  };
  const timeout = g => {
    if (g.over || !g.clock.turn) return;
    const loser = g.clock.turn, winner = other(loser), mod = g.rules.rule.module;
    if (g.rules.game === 'chess' && typeof mod.sufficient === 'function' && !mod.sufficient(g.state, winner)) finish(g, 'draw', 'timeout-insufficient');
    else finish(g, winner, 'timeout');
  };
  const expired = g => g.clock.turn && now() - g.clock.turnStartedAt >= g.clock[g.clock.turn];
  const armClock = g => {
    disarm(g.timer);
    if (g.clock.turn) g.timer = arm(() => { if (!g.over) { if (expired(g)) timeout(g); else armClock(g); } }, Math.max(0, g.clock[g.clock.turn] - (now() - g.clock.turnStartedAt)));
  };
  const scoreGame = g => {
    const s = g.rules.rule.module.score(g.state, Array.from(g.dead));
    finish(g, s.a === s.b ? 'draw' : s.a > s.b ? 'a' : 'b', 'score', s);
  };
  const start = (a, b, rules, t) => {
    if (games.size >= maxGames) return fail('Chùa đang có quá nhiều ván cờ, thử lại sau.');
    if (a.uid === b.uid || byUid.has(a.uid) || byUid.has(b.uid)) return fail('Người này đang bận.');
    if (rules.rated && (login(a) || login(b))) return fail('Hãy đăng nhập để đấu xếp hạng.', 'login');
    const id = deps.newId();
    if (typeof id !== 'string' || !id || games.has(id)) return fail('Không thể tạo ván cờ.');
    // Người vào ván thì thôi xem bàn khác (KY-DAO §5.3).
    for (const u of [a, b]) { const w = watching.get(u.uid); if (w) { w.watchers.delete(u.uid); watching.delete(u.uid); tableEvent(w); } }
    const pace = rules.rule.paces[rules.pace], stamp = now();
    const seed = rules.game === 'jieqi' ? (deps.newSeed || newSeed)() : undefined;
    const g = { id, a, b, rules, table: t, rated: rules.rated && !pairFull(a.uid, b.uid, rules.game), downgraded: rules.rated && pairFull(a.uid, b.uid, rules.game), state: rules.rule.module.create(seed ? { seed } : rules.size ? { size: rules.size } : {}), moves: [], phase: 'playing', over: false, dead: new Set(), agreed: { a: false, b: false }, deadlineAt: null, offer: null, offers: { a: 0, b: 0 }, absent: new Set(), clock: { a: ms(pace.baseMs), b: ms(pace.baseMs), turn: 'a', turnStartedAt: stamp, incMs: ms(pace.incMs) } };
    if (seed) g.seed = seed;
    // Ván mới luôn bắt đầu bằng skin mặc định; skinAt = lúc đổi gần nhất của từng bên để giới hạn tần suất.
    g.skins = { a: { field: null, pieces: null }, b: { field: null, pieces: null } };
    g.skinAt = { a: { field: -Infinity, pieces: -Infinity }, b: { field: -Infinity, pieces: -Infinity } };
    games.set(id, g); byUid.set(a.uid, g); byUid.set(b.uid, g);
    deps.setActive(a.uid, id); deps.setActive(b.uid, id);
    if (t) { t.game = g; disarm(t.timer); t.timer = null; }
    for (const i of Array.from(invites.values())) if ([a.uid, b.uid].includes(i.from.uid) || [a.uid, b.uid].includes(i.to.uid)) closeInvite(i, 'busy');
    armClock(g); g.firstTimer = arm(() => { if (!g.over && g.state.ply === 0) finish(g, 'abort', 'no-start'); }, ms(30000));
    emit(a.uid, 'kd:start', startPayload(g, 'a')); emit(b.uid, 'kd:start', startPayload(g, 'b'));
    if (t) { room('kd:' + t.id, 'kd:start', startPayload(g, null)); tableEvent(t); } else innerEvent(g, false);
    return ok();
  };
  const gameFor = (p, data) => {
    const id = field(data, 'gameId'), g = typeof id === 'string' ? games.get(id) : null;
    if (!g) return { error: fail('Không có ván này.', 'stale') };
    const side = sideOf(g, p.uid);
    if (!side) return { error: fail('Bạn không phải người chơi của ván này.') };
    if (g.state.ply === 0 && now() - g.clock.turnStartedAt >= ms(30000)) {
      finish(g, 'abort', 'no-start');
      return { error: fail('Ván đã kết thúc.', 'stale') };
    }
    return { g, side };
  };
  const safe = fn => (p, data) => {
    try {
      if (config.enabled === false) return fail('Bàn cờ đang nghỉ.', 'off');
      if (!validUser(p)) return fail('Không có người chơi này.');
      return fn(p, data || {});
    } catch (err) { if (deps.log) { try { deps.log('Lỗi bộ quản lý Kỳ Đạo.'); } catch (_) {} } return fail('Không thể xử lý yêu cầu.'); }
  };
  const api = {};
  api.tables = safe(() => ({ ok: true, tables: tables.map(tableData).concat(Array.from(games.values()).filter(g => !g.table).map(g => innerData(g, false))), serverTime: now() }));
  api.sit = safe((p, d) => {
    const t = tableOf(field(d, 'table')), seat = field(d, 'seat');
    if (!t || (seat !== 0 && seat !== 1)) return fail('Không có bàn này.');
    if (busy(p.uid)) return fail('Bạn đang ở một bàn khác.');
    if (t.game) return fail('Bàn đang đấu; chạm bàn để xem.');
    if (t.seats[seat]) return fail('Ghế này đã có người.');
    if (watching.has(p.uid)) { const old = watching.get(p.uid); old.watchers.delete(p.uid); watching.delete(p.uid); tableEvent(old); }
    const u = user(p); u.ready = false; t.seats[seat] = u; if (!t.host) t.host = u;
    waitTimer(t); tableEvent(t); return { ok: true, table: t.id, seat };
  });
  api.setup = safe((p, d) => {
    const t = tableOf(field(d, 'table')); if (!t) return fail('Không có bàn này.');
    if (!t.host || t.host.uid !== p.uid) return fail('Chỉ chủ bàn chọn luật.');
    if (t.game) return fail('Ván đã bắt đầu.');
    const r = rulesFor(d); if (!r) return fail(goRatedSize(d) ? 'Cờ vây chỉ xếp hạng ở bàn 9×9.' : 'Luật chơi không hợp lệ hoặc chưa hỗ trợ.');
    if (r.rated && login(p)) return fail('Hãy đăng nhập để đấu xếp hạng.', 'login');
    t.rules = r; t.seats.forEach(s => { if (s) s.ready = false; }); waitTimer(t); tableEvent(t); return ok();
  });
  api.ready = safe((p, d) => {
    const t = tableOf(field(d, 'table')); if (!t) return fail('Không có bàn này.');
    const s = t.seats.find(x => x && x.uid === p.uid);
    if (!s || t.game || typeof field(d, 'ready') !== 'boolean') return fail('Không thể sẵn sàng.');
    if (!t.rules) return fail('Chủ bàn chưa chọn luật.');
    if (t.rules.rated && login(p)) return fail('Hãy đăng nhập để đấu xếp hạng.', 'login');
    s.ready = d.ready;
    if (t.seats.every(x => x && x.ready)) {
      const a = t.seats[t.flip ? 1 : 0], b = t.seats[t.flip ? 0 : 1];
      const result = start(a, b, t.rules, t); if (!result.ok) { s.ready = false; tableEvent(t); } return result;
    }
    tableEvent(t); return ok();
  });
  api.stand = safe((p, d) => {
    const t = tableOf(field(d, 'table')); if (!t) return fail('Không có bàn này.');
    const idx = t.seats.findIndex(s => s && s.uid === p.uid); if (idx < 0) return fail('Bạn không ngồi bàn này.');
    const resigned = !!t.game;
    if (t.game) finish(t.game, other(sideOf(t.game, p.uid)), 'resign');
    t.seats[idx] = null; if (t.host && t.host.uid === p.uid) t.host = t.seats[1 - idx];
    if (!t.host) { t.rules = null; t.flip = false; }
    waitTimer(t); tableEvent(t); return { ok: true, resigned };
  });
  api.invite = safe((p, d) => {
    const target = field(d, 'target'), r = rulesFor(d);
    if (!validUser(target) || target.uid === p.uid) return fail('Không có người chơi này.');
    if (busy(p.uid)) return fail('Bạn đang ở một ván hoặc bàn khác.');
    if (busy(target.uid)) return fail('Người này đang bận.');
    if (!r) return fail(goRatedSize(d) ? 'Cờ vây chỉ xếp hạng ở bàn 9×9.' : 'Luật chơi không hợp lệ hoặc chưa hỗ trợ.');
    if (r.rated && login(p)) return fail('Hãy đăng nhập để đấu xếp hạng.', 'login');
    if ((rejected.get(pairKey(p.uid, target.uid)) || 0) > now()) return fail('Bạn vừa bị từ chối, đợi 5 phút.');
    if (sentAt.has(p.uid) && now() - sentAt.get(p.uid) < ms(10000)) return fail('Bạn thao tác quá nhanh.');
    if (Array.from(invites.values()).some(i => i.from.uid === p.uid)) return fail('Bạn đang có một lời mời chờ trả lời.');
    if (Array.from(invites.values()).filter(i => i.to.uid === target.uid).length >= 3) return fail('Người này đang bận.');
    const id = deps.newId(); if (typeof id !== 'string' || !id || invites.has(id)) return fail('Không thể tạo lời mời.');
    const i = { id, from: user(p), to: user(target), rules: r, expiresAt: now() + ms(20000) };
    invites.set(id, i); sentAt.set(p.uid, now()); i.timer = arm(() => closeInvite(i, 'expired'), ms(20000));
    const down = r.rated && pairFull(p.uid, target.uid, r.game);
    const payload = { inviteId: id, game: r.game, rated: down ? false : r.rated, pace: r.pace, expiresAt: i.expiresAt, from: playerInfo(i.from, { rated: r.rated, rules: r }) };
    if (r.size) payload.size = r.size; if (down) payload.downgraded = downgraded;
    emit(target.uid, 'kd:invited', payload);
    const result = { ok: true, inviteId: id, expiresAt: i.expiresAt }; if (down) result.downgraded = downgraded; return result;
  });
  api.cancelInvite = safe((p, d) => { const i = invites.get(field(d, 'inviteId')); if (!i || i.from.uid !== p.uid) return fail('Lời mời đã hết hạn.'); closeInvite(i, 'cancelled'); return ok(); });
  api.respond = safe((p, d) => {
    const i = invites.get(field(d, 'inviteId'));
    if (!i || i.to.uid !== p.uid || now() >= i.expiresAt) { if (i && now() >= i.expiresAt) closeInvite(i, 'expired'); return fail('Lời mời đã hết hạn.'); }
    if (typeof field(d, 'accept') !== 'boolean') return fail('Lời mời không hợp lệ.');
    if (!d.accept) { rejected.set(pairKey(i.from.uid, i.to.uid), now() + ms(300000)); closeInvite(i, 'declined'); return ok(); }
    if (i.rules.rated && login(p)) return fail('Hãy đăng nhập để đấu xếp hạng.', 'login');
    if (busy(i.from.uid) || busy(i.to.uid)) { closeInvite(i, 'busy'); return fail('Người này đang bận.'); }
    if (games.size >= maxGames) return fail('Chùa đang có quá nhiều ván cờ, thử lại sau.');
    const x = Number.isFinite(i.from.x) ? i.from.x : 0.5, z = Number.isFinite(i.from.z) ? i.from.z : 0.8;
    const centers = [[0.25, 0.50], [0.75, 0.50], [0.18, 0.76], [0.82, 0.76]];
    const t = tables.filter(t => !t.host && !t.game).sort((a, b) => {
      const dist = t => (centers[t.id - 1][0] - x) ** 2 + (centers[t.id - 1][1] - z) ** 2;
      return dist(a) - dist(b) || a.id - b.id;
    })[0];
    if (t) { t.seats = [i.from, i.to]; t.host = i.from; t.rules = i.rules; }
    closeInvite(i, 'accepted');
    const result = start(i.from, i.to, i.rules, t || null);
    if (!result.ok && t) { t.seats = [null, null]; t.host = null; t.rules = null; }
    return result;
  });
  api.move = safe((p, d) => {
    const found = gameFor(p, d); if (found.error) return found.error;
    const { g, side } = found, move = field(d, 'move'), ply = field(d, 'ply'), mod = g.rules.rule.module;
    if (expired(g)) { timeout(g); return fail('Ván đã kết thúc.', 'stale'); }
    if (ply !== g.state.ply) return fail('Ván đã đổi, hãy đồng bộ lại.', 'stale');
    if (g.phase !== 'playing' || mod.turn(g.state) !== side) return fail('Chưa tới lượt bạn.');
    if (typeof move !== 'string' || move.length > 8 || !g.rules.rule.movePattern.test(move) || !mod.legalMoves(g.state).includes(move)) return fail('Nước đi không hợp lệ.');
    const text = mod.notation(g.state, move), played = mod.play(g.state, move);
    if (!played.ok) return fail('Nước đi không hợp lệ.');
    const stamp = now(); g.clock[side] -= stamp - g.clock.turnStartedAt; g.clock[side] += g.clock.incMs;
    g.state = played.state; g.moves.push({ m: move, t: text, ...(played.info && played.info.reveal ? { r: played.info.reveal } : {}) });
    g.clock.turn = other(side); g.clock.turnStartedAt = stamp;
    if (g.firstTimer) { disarm(g.firstTimer); g.firstTimer = null; }
    if (g.offer && g.offer.side !== side) clearOffers(g, 'declined');
    let status = mod.status(g.state);
    const max = typeof g.rules.rule.maxPlies === 'number' ? g.rules.rule.maxPlies : g.rules.rule.maxPlies[g.rules.size];
    if (!status.over && g.state.ply >= max) status = { over: true, winner: null, reason: g.rules.game === 'gomoku' ? 'full-board' : 'limit' };
    if (status.phase === 'scoring' && !status.over) { g.phase = 'scoring'; g.clock.turn = null; g.deadlineAt = stamp + ms(180000); disarm(g.timer); g.scoreTimer = arm(() => { if (!g.over && g.phase === 'scoring') scoreGame(g); }, ms(180000)); }
    else if (!status.over) armClock(g);
    const payload = { gameId: g.id, ply: g.state.ply, move, text, side, clock: clock(g) };
    if (played.info && played.info.reveal) payload.reveal = played.info.reveal;
    if (played.info && Array.isArray(played.info.capture)) { if (played.info.capture.length) payload.capture = played.info.capture.length; }
    else if (played.info && played.info.capture) payload.capture = played.info.capture;
    if (played.info && played.info.check) payload.check = played.info.check;
    if (status.over || status.phase === 'scoring') payload.status = status;
    notify(g, 'kd:moved', payload);
    if (status.over) finish(g, status.winner || 'draw', status.reason);
    else if (g.phase === 'scoring') notify(g, 'kd:marks', Object.assign({ gameId: g.id }, marks(g)));
    return { ok: true, ply: g.state.ply };
  });
  api.resign = safe((p, d) => { const f = gameFor(p, d); if (f.error) return f.error; if (expired(f.g)) timeout(f.g); else finish(f.g, other(f.side), 'resign'); return ok(); });
  api.draw = safe((p, d) => {
    const f = gameFor(p, d); if (f.error) return f.error; const { g, side } = f, act = field(d, 'act');
    if (expired(g)) { timeout(g); return fail('Ván đã kết thúc.', 'stale'); }
    if (act === 'offer') {
      if (g.state.ply < 4 || g.offer) return fail('Chưa thể xin hòa lúc này.');
      if (g.offers[side] >= 3) return fail('Bạn đã xin hòa quá nhiều lần.');
      g.offers[side]++; g.offer = { side, timer: arm(() => { if (!g.over) clearOffers(g, 'expired'); }, ms(30000)) };
      const payload = { gameId: g.id, kind: 'draw', state: 'open', from: side };
      emit(g.a.uid, 'kd:offer', payload); emit(g.b.uid, 'kd:offer', payload); return ok();
    }
    if (!g.offer || g.offer.side === side || (act !== 'accept' && act !== 'decline')) return fail('Không có lời xin hòa.');
    if (act === 'accept') finish(g, 'draw', 'agreed'); else clearOffers(g, 'declined'); return ok();
  });
  api.mark = safe((p, d) => {
    const f = gameFor(p, d); if (f.error) return f.error; const g = f.g, point = field(d, 'point');
    if (g.phase !== 'scoring' || g.rules.game !== 'go') return fail('Chưa tới lúc đánh dấu quân.');
    if (now() >= g.deadlineAt) { scoreGame(g); return fail('Ván đã kết thúc.', 'stale'); }
    if (typeof point !== 'string' || point.length > 8 || !/^[A-HJ-T](?:1[0-9]|[1-9])$/.test(point)) return fail('Điểm này không có quân.');
    const letters = 'ABCDEFGHJKLMNOPQRST';
    const x = letters.indexOf(point[0]), y = Number(point.slice(1)) - 1;
    if (x < 0 || x >= g.state.size || y < 0 || y >= g.state.size || !g.state.board[y * g.state.size + x]) return fail('Điểm này không có quân.');
    const group = g.rules.rule.module.groupAt(g.state, point);
    if (!group.length) return fail('Điểm này không có quân.');
    const remove = g.dead.has(point); group.forEach(x => remove ? g.dead.delete(x) : g.dead.add(x)); g.agreed = { a: false, b: false };
    notify(g, 'kd:marks', Object.assign({ gameId: g.id }, marks(g))); return ok();
  });
  api.agree = safe((p, d) => {
    const f = gameFor(p, d); if (f.error) return f.error; const g = f.g;
    if (g.phase !== 'scoring') return fail('Chưa tới lúc đánh dấu quân.');
    if (now() >= g.deadlineAt) { scoreGame(g); return fail('Ván đã kết thúc.', 'stale'); }
    g.agreed[f.side] = true; notify(g, 'kd:marks', Object.assign({ gameId: g.id }, marks(g)));
    if (g.agreed.a && g.agreed.b) scoreGame(g); return ok();
  });
  api.resumePlay = safe((p, d) => {
    const f = gameFor(p, d); if (f.error) return f.error; const g = f.g;
    if (g.phase !== 'scoring') return fail('Chưa tới lúc đánh dấu quân.');
    if (now() >= g.deadlineAt) { scoreGame(g); return fail('Ván đã kết thúc.', 'stale'); }
    disarm(g.scoreTimer); g.state = g.rules.rule.module.resume(g.state, f.side); g.phase = 'playing'; g.dead.clear(); g.agreed = { a: false, b: false }; g.deadlineAt = null;
    g.clock.turn = f.side; g.clock.turnStartedAt = now(); armClock(g);
    notify(g, 'kd:marks', Object.assign({ gameId: g.id }, marks(g))); return ok();
  });
  // Đổi skin nửa sân / skin quân của chính mình (KE-HOACH-KY-DAI §4.2, K7): client chỉ gửi mã,
  // mã lạ thành null (về mặc định). Sân: 1 lần / 20 giây; quân: 1 lần / 3 giây, tính riêng từng người trong ván.
  const SKIN_GAP = { field: 20000, pieces: 3000 };
  // Loại skin theo danh mục cửa hàng: nửa sân = 'field'; quân = 'stones' ở cờ vây/caro, ngược lại 'pieces'.
  const skinKind = (game, k) => k === 'field' ? 'field' : KydaoSkins.STONE_GAMES.includes(game) ? 'stones' : 'pieces';
  const skinAllowed = (uid, kind, id) => (deps.skinAllowed ? deps.skinAllowed(uid, kind, id) !== false : true);
  api.skin = safe((p, d) => {
    const f = gameFor(p, d); if (f.error) return f.error; const { g, side } = f;
    if (expired(g)) { timeout(g); return fail('Ván đã kết thúc.', 'stale'); }
    if (!KydaoSkins.supportsPieces(g.rules.game)) return fail('Môn này chưa có skin.');
    const stone = KydaoSkins.STONE_GAMES.includes(g.rules.game);
    if (stone && own(d, 'field') && !own(d, 'pieces')) return fail('Môn này không có skin sân.');
    const keys = (stone ? ['pieces'] : ['field', 'pieces']).filter(k => own(d, k));
    if (!keys.length) return fail('Chưa chọn skin.');
    const want = KydaoSkins.normalize({ field: field(d, 'field'), pieces: field(d, 'pieces') }, g.rules.game);
    const mine = g.skins[side], at = g.skinAt[side], stamp = now();
    const change = keys.filter(k => want[k] !== mine[k]);
    // Khóa skin (T-171): kiểm quyền mở TRƯỚC kiểm tần suất. Chỉ chặn skin cụ thể; về mặc định (null) luôn được.
    for (const k of change) {
      if (want[k] === null) continue;
      const kind = skinKind(g.rules.game, k);
      if (!skinAllowed(p.uid, kind, want[k])) {
        return Object.assign(fail('Skin này cần cúng dường để mở.', 'locked'), { kind, id: want[k], price: deps.skinPrice ? deps.skinPrice(kind, want[k]) : null });
      }
    }
    for (const k of change) {
      const retryAt = at[k] + ms(SKIN_GAP[k]);
      if (retryAt > stamp) {
        const wait = Math.ceil((retryAt - stamp) / 1000);
        return Object.assign(fail(`Đợi ${wait} giây nữa mới đổi được ${k === 'field' ? 'sân' : 'quân'}.`, 'rate'), { retryAt });
      }
    }
    if (change.length) {
      const opened = change.includes('field') && want.field !== null;
      for (const k of change) { mine[k] = want[k]; at[k] = stamp; }
      notify(g, 'kd:skin', { gameId: g.id, side, field: mine.field, pieces: mine.pieces, opened });
    }
    return { ok: true, field: mine.field, pieces: mine.pieces };
  });
  // Cửa hàng vừa bật hoặc đổi: gỡ skin mà chủ bên đó không còn được dùng (về null, phát kd:skin). Trả số bên đã gỡ.
  api.revalidateSkins = () => {
    let n = 0;
    for (const g of games.values()) {
      if (g.over || !g.skins) continue;
      for (const side of ['a', 'b']) {
        const mine = g.skins[side], uid = g[side].uid;
        let cut = false;
        for (const k of ['field', 'pieces']) {
          if (mine[k] === null || mine[k] === undefined) continue;
          if (!skinAllowed(uid, skinKind(g.rules.game, k), mine[k])) { mine[k] = null; g.skinAt[side][k] = -Infinity; cut = true; }   // bị gỡ ngoài ý muốn: không tính vào giới hạn tần suất
        }
        if (cut) { n++; notify(g, 'kd:skin', { gameId: g.id, side, field: mine.field, pieces: mine.pieces, opened: false }); }
      }
    }
    return n;
  };
  api.watch = safe((p, d) => {
    const t = tableOf(field(d, 'table')); if (!t || !t.game) return fail('Bàn này không có ván.');
    if (busy(p.uid)) return fail('Bạn đang ở một bàn khác.');
    if (!t.watchers.has(p.uid) && t.watchers.size >= 50) return fail('Bàn này đã đủ người xem.');
    const old = watching.get(p.uid); if (old && old !== t) { old.watchers.delete(p.uid); tableEvent(old); }
    t.watchers.add(p.uid); watching.set(p.uid, t); emit(p.uid, 'kd:start', startPayload(t.game, null, true)); tableEvent(t); return { ok: true, table: t.id };
  });
  api.unwatch = safe((p, d) => { const t = tableOf(field(d, 'table')); if (!t) return fail('Không có bàn này.'); t.watchers.delete(p.uid); if (watching.get(p.uid) === t) watching.delete(p.uid); tableEvent(t); return ok(); });
  api.resume = safe(p => {
    const g = byUid.get(p.uid);
    if (g) { g.absent.delete(p.uid); disarm(g.awayTimer); g.awayTimer = null; if (expired(g)) { timeout(g); return { ok: true, start: null }; } return { ok: true, start: startPayload(g, sideOf(g, p.uid), true) }; }
    if (deps.getActive(p.uid)) { deps.setActive(p.uid, null); return { ok: true, start: null, message: 'Ván cờ trước đã bị hủy vì máy chủ khởi động lại. Không ai bị tính thua.' }; }
    return { ok: true, start: null };
  });
  api.leave = safe((p, d) => {
    const why = typeof d === 'string' ? d : field(d, 'why');
    const watched = watching.get(p.uid); if (watched) { watched.watchers.delete(p.uid); watching.delete(p.uid); tableEvent(watched); }
    for (const i of Array.from(invites.values())) if (i.from.uid === p.uid || i.to.uid === p.uid) closeInvite(i, 'left');
    const g = byUid.get(p.uid);
    if (g) {
      if (why === 'account') { finish(g, 'abort', 'account'); }
      else if (!(g.table === null && why !== 'disconnect')) {
        g.absent.add(p.uid);
        if (g.absent.size === 2 && !g.awayTimer) g.awayTimer = arm(() => { if (!g.over && g.absent.size === 2) finish(g, 'abort', 'away'); }, ms(60000));
        return ok();
      } else return ok();
    }
    const t = tables.find(x => x.seats.some(s => s && s.uid === p.uid));
    if (t) return api.stand(p, { table: t.id });
    return ok();
  });
  api.stats = () => ({ games: games.size, invites: invites.size, watchers: watching.size });
  api.shutdown = () => { for (const id of Array.from(timers)) disarm(id); };
  return api;
}

module.exports = { createKydaoManager };
