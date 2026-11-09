'use strict';
/*
 * Quản lý Sân đấu: người ở sân, lời mời, sảnh chọn bộ chiêu, vòng lượt, giờ, vào lại, kết thúc.
 * THUẦN: không biết Socket.IO; mọi thứ bên ngoài đi qua deps (hợp đồng sự kiện: docs/VO-HOC-GIAO-THUC.md mục 4).
 *
 * Một trận đi qua: lobby → (choosing → reveal) lặp lại → kết thúc.
 * Chiêu chọn kín chỉ lộ ở pk:reveal; trong lúc chọn đối thủ chỉ nhận pk:locked { matchId, turn }.
 * deps.config.timeScale nhân vào MỌI mốc giờ (chỉ để chạy thử nhanh); deadlineAt / expiresAt / nextAt gửi đi là giờ thật đã nhân.
 */
const M = require('../../public/js/martial');
const R = require('./rules');
const { Duel, newFighter, publicState } = require('./engine');
const { computeBuff } = require('./buffs');
const rngLib = require('./rng');

const SIDES = ['a', 'b'];
const flip = s => (s === 'a' ? 'b' : 'a');
const INVITE_GAP_MS = 10000;          // mỗi người gửi lời mời cách nhau
const DECLINE_WAIT_MS = 5 * 60000;    // bị từ chối thì chờ mới mời lại đúng người đó
const MAX_INCOMING = 3;
const LOG_TURNS = 60;
const RESTART_MSG = 'Trận trước đã bị hủy vì máy chủ khởi động lại. Không ai bị tính thua.';
const FAIL_MSG = 'Có lỗi, bạn thử lại nhé.';

const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const fail = reason => ({ ok: false, reason });
const okUid = u => (typeof u === 'string' && u.length > 0 && u.length <= 200) || (typeof u === 'number' && Number.isFinite(u));
const idKey = x => ((typeof x === 'string' && x.length > 0 && x.length <= 64) || (typeof x === 'number' && Number.isFinite(x)) ? String(x) : null);
const idEq = (x, id) => { const k = idKey(x); return k !== null && k === String(id); };
const clone = x => JSON.parse(JSON.stringify(x));
const sameJson = (a, b) => a === b || JSON.stringify(a) === JSON.stringify(b);
const buffCopy = b => ({ ...b, labels: b.labels.slice() });
const isSkillId = x => typeof x === 'string' && x.length <= 64 && has(M.SKILLS, x);
// Bộ chiêu mặc định khi hết giờ sảnh mà chưa lưu bộ nào: chiêu bậc thấp trước (sort ổn định giữ thứ tự nhánh),
// và nếu 4 chiêu đó không có đòn công thì đổi chiêu cuối lấy một đòn công, để không bị đẩy vào trận toàn thủ.
const defaultLoadout = learned => {
  const order = M.SKILL_ORDER.filter(id => learned.includes(id)).sort((a, b) => M.SKILLS[a].tier - M.SKILLS[b].tier);
  const pick = order.slice(0, 4);
  if (pick.length === 4 && !pick.some(id => M.isAttacking(M.SKILLS[id]))) {
    const atk = order.slice(4).find(id => M.isAttacking(M.SKILLS[id]));
    if (atk) pick[3] = atk;
  }
  return pick;
};

/** Đổi sự kiện của engine (a / b) sang góc nhìn của bên `s` (you / op). */
function viewEvent(e, s) {
  const o = { ...e };
  for (const k of ['side', 'atk', 'def', 'target']) if (k in o) o[k] = o[k] === s ? 'you' : 'op';
  if (Array.isArray(o.immune)) o.immune = o.immune.map(side => side === s ? 'you' : 'op');
  if (o.k === 'end') o.result = o.result === 'draw' ? 'draw' : o.result === s ? 'you' : 'op';
  return o;
}
const viewResult = (result, s) => (result === 'draw' || result === 'void' ? 'draw' : result === s ? 'win' : 'lose');

function createArenaManager(deps) {
  deps = deps || {};
  const cfg = deps.config || {};
  const enabled = cfg.enabled !== false;
  const S = Number(cfg.timeScale) > 0 && Number.isFinite(Number(cfg.timeScale)) ? Number(cfg.timeScale) : 1;
  const T = ms => Math.max(1, Math.round(ms * S));
  const maxMatches = Number(cfg.maxMatches) >= 1 ? Math.floor(Number(cfg.maxMatches)) : 20;
  const now = typeof deps.now === 'function' ? deps.now : Date.now;
  const setT = typeof deps.setTimer === 'function' ? deps.setTimer : (fn, ms) => { const h = setTimeout(fn, ms); if (h && h.unref) h.unref(); return h; };
  const clearT = typeof deps.clearTimer === 'function' ? deps.clearTimer : h => clearTimeout(h);
  const newSeed = typeof deps.newSeed === 'function' ? deps.newSeed : rngLib.newSeed;
  const rngFor = typeof deps.rngFor === 'function' ? deps.rngFor : rngLib.makeRng;
  const AWAY_POLL_MS = Math.max(10, Math.min(3000, Math.round(T(R.BOTH_AWAY_MS) / 20)));

  const rows = new Map();          // uid -> { uid, pid, name, look, lv, wins, losses, dnd, match }
  const pidToUid = new Map();
  const invites = new Map();       // String(inviteId) -> inv
  const outgoing = new Map();      // uid -> lời mời đang chờ gửi đi
  const incoming = new Map();      // uid -> Set lời mời đang chờ nhận
  const matches = new Map();       // String(matchId) -> m
  const matchOfUid = new Map();
  const lastSent = new Map();      // uid -> giờ gửi lời mời gần nhất
  const declined = new Map();      // uid mời -> Map(uid bị mời -> giờ được mời lại)
  let inviteSeq = 0, matchSeq = 0, closed = false;

  /* ---------- tiện ích gọi ra ngoài ---------- */
  const logErr = (where, e) => { try { if (deps.log) deps.log('[arena] ' + where + ':', e && e.stack || e); } catch (_) { /* nuốt */ } };
  const call = (where, fn, dflt) => { try { return fn(); } catch (e) { logErr(where, e); return dflt; } };
  const send = (uid, ev, payload) => call('emit ' + ev, () => { if (deps.emit) deps.emit(uid, ev, payload); });
  const room = (ev, payload) => call('emitRoom ' + ev, () => { if (deps.emitRoom) deps.emitRoom(ev, payload); });
  const stop = h => { if (h != null) call('clearTimer', () => clearT(h)); };
  const online = uid => call('isOnline', () => (deps.isOnline ? !!deps.isOnline(uid) : true), true);
  const blockedBy = (by, other) => call('isBlocked', () => (deps.isBlocked ? !!deps.isBlocked(by, other) : false), false);

  /** Hồ sơ đấu đã chuẩn hóa; null nếu chưa có. */
  function fighterOf(uid) {
    const f = call('fighterOf', () => (deps.fighterOf ? deps.fighterOf(uid) : null), null);
    if (!f || typeof f !== 'object') return null;
    const num = x => (Number.isFinite(+x) && +x > 0 ? Math.floor(+x) : 0);
    return {
      level: Math.max(1, Math.min(M.LEVEL_MAX, num(f.level) || 1)),
      learned: [...new Set(Array.isArray(f.learned) ? f.learned.filter(isSkillId) : [])],
      loadout: Array.isArray(f.loadout) ? f.loadout.slice(0, 8) : [],
      mastery: M.masteryMap(f.mastery, Array.isArray(f.learned) ? f.learned : []),
      secretSkills: Array.isArray(f.secretSkills) ? f.secretSkills.filter(id => ['tau-vi-thuong-sach', 'nhu-lai-than-chuong', 'kamui'].includes(id)) : [],
      wins: num(f.wins), losses: num(f.losses), draws: num(f.draws)
    };
  }
  const buffFor = uid => computeBuff(call('buffInputsOf', () => (deps.buffInputsOf ? deps.buffInputsOf(uid) : null), null) || {});

  /* ---------- hẹn giờ của trận ---------- */
  function arm(m, key, ms, fn) {
    disarm(m, key);
    m.timers[key] = setT(() => {
      m.timers[key] = null;
      if (closed || m.over) return;
      try { fn(); } catch (e) { logErr('hẹn giờ ' + key, e); abort(m); }
    }, ms);
  }
  function disarm(m, key) {
    const h = m.timers[key];
    if (h != null) { m.timers[key] = null; stop(h); }
  }
  /** Lỗi bất ngờ trong trận: hủy trận (không tính thắng thua) thay vì để treo. */
  function abort(m) {
    try { finish(m, { result: 'void', reason: 'void' }); } catch (e) {
      logErr('hủy trận', e);
      m.over = true;
      for (const k of Object.keys(m.timers)) disarm(m, k);
      matches.delete(String(m.id));
      for (const s of SIDES) if (matchOfUid.get(m.p[s].uid) === m) matchOfUid.delete(m.p[s].uid);
    }
  }

  /* ---------- hàng người ở sân ---------- */
  const stOf = r => (r.match ? 'busy' : r.dnd ? 'dnd' : 'free');
  const pub = r => ({ pid: r.pid, name: r.name, look: r.look, lv: r.lv, wins: r.wins, losses: r.losses, draws: r.draws, st: stOf(r) });
  function touch(r, fn) {
    const before = pub(r);
    fn();
    const after = pub(r), d = {};
    for (const k of Object.keys(after)) if (!sameJson(after[k], before[k])) d[k] = after[k];
    if (Object.keys(d).length) room('arena:upd', { pid: after.pid, ...d });
  }
  const sideOf = (m, uid) => (m.p.a.uid === uid ? 'a' : 'b');

  function join(uid, info) {
    if (!enabled || closed) return fail('Sân đấu chưa mở.');
    if (!okUid(uid) || !info || typeof info !== 'object' || !Number.isInteger(info.pid)) return fail('Thông tin vào sân không hợp lệ.');
    const name = String(info.name == null ? '' : info.name).slice(0, 60), look = info.look == null ? null : info.look;
    const f = fighterOf(uid), m = matchOfUid.get(uid) || null;
    let r = rows.get(uid);
    const stats = () => { if (f) { r.lv = f.level; r.wins = f.wins; r.losses = f.losses; r.draws = f.draws; } };
    if (!r) {
      r = { uid, pid: info.pid, name, look, lv: 1, wins: 0, losses: 0, draws: 0, dnd: false, match: m };
      stats();
      rows.set(uid, r); pidToUid.set(r.pid, uid);
      room('arena:add', pub(r));
    } else if (r.pid !== info.pid) {
      room('arena:del', { pid: r.pid });
      if (pidToUid.get(r.pid) === uid) pidToUid.delete(r.pid);
      r.pid = info.pid; r.name = name; r.look = look; r.match = m;
      stats();
      pidToUid.set(r.pid, uid);
      room('arena:add', pub(r));
    } else {
      touch(r, () => { r.name = name; r.look = look; r.match = m; stats(); });
    }
    if (m) {
      const P = m.p[sideOf(m, uid)];
      P.pid = r.pid; P.name = r.name; P.look = r.look;
      m.awaySince = null;
    }
    return { ok: true, row: pub(r) };
  }

  function leave(uid, reason) {
    if (!okUid(uid)) return fail('Thông tin không hợp lệ.');
    closeInvitesOf(uid, 'left');
    const r = rows.get(uid), m = matchOfUid.get(uid);
    if (r) {
      rows.delete(uid);
      if (pidToUid.get(r.pid) === uid) pidToUid.delete(r.pid);
      room('arena:del', { pid: r.pid });
    }
    if (m) {
      const s = sideOf(m, uid);
      if (reason === 'left') finish(m, m.phase === 'lobby' ? { result: 'void', reason: 'void', who: s } : { result: flip(s), reason: 'forfeit', who: s });
      else checkAway(m, uid);
    }
    return { ok: true };
  }

  function setDnd(uid, on) {
    if (!enabled || closed) return fail('Sân đấu chưa mở.');
    const r = okUid(uid) ? rows.get(uid) : null;
    if (!r) return fail('Bạn cần ra Sân đấu trước.');
    touch(r, () => { r.dnd = !!on; });
    return { ok: true, dnd: r.dnd };
  }

  const list = () => [...rows.values()].map(pub);
  const rowOf = uid => { const r = rows.get(uid); return r ? pub(r) : null; };

  /* ---------- lời mời ---------- */
  function closeInvite(inv, reason) {
    if (invites.get(String(inv.id)) !== inv) return;
    invites.delete(String(inv.id));
    stop(inv.timer); inv.timer = null;
    if (outgoing.get(inv.from) === inv) outgoing.delete(inv.from);
    const set = incoming.get(inv.to);
    if (set) { set.delete(inv); if (!set.size) incoming.delete(inv.to); }
    send(inv.from, 'pk:invite:closed', { inviteId: inv.id, reason });
    send(inv.to, 'pk:invite:closed', { inviteId: inv.id, reason });
  }
  function closeInvitesOf(uid, reason) {
    const all = [];
    if (outgoing.has(uid)) all.push(outgoing.get(uid));
    if (incoming.has(uid)) all.push(...incoming.get(uid));
    for (const inv of all) closeInvite(inv, reason);
  }
  function pruneCooldowns() {
    const t = now();
    for (const [uid, at] of lastSent) if (t - at >= T(INVITE_GAP_MS)) lastSent.delete(uid);
    for (const [uid, m] of declined) {
      for (const [to, until] of m) if (until <= t) m.delete(to);
      if (!m.size) declined.delete(uid);
    }
  }

  function invite(fromUid, toPid, mode) {
    if (!enabled || closed) return fail('Sân đấu chưa mở.');
    const me = okUid(fromUid) ? rows.get(fromUid) : null;
    if (!me) return fail('Bạn cần ra Sân đấu trước.');
    if (mode !== 'balanced' && mode !== 'buff') return fail('Chế độ đấu không hợp lệ.');
    const toUid = Number.isInteger(toPid) ? pidToUid.get(toPid) : undefined, him = toUid !== undefined ? rows.get(toUid) : null;
    if (!him) return fail('Không thấy người này ở Sân đấu.');
    if (toUid === fromUid) return fail('Bạn không thể tự mời mình.');
    if (me.match) return fail('Bạn đang trong trận.');
    if (him.match) return fail('Người này đang đấu.');
    if (him.dnd || blockedBy(toUid, fromUid)) return fail('Người này không nhận lời mời lúc này.');
    if (outgoing.has(fromUid)) return fail('Bạn đang có một lời mời chờ trả lời.');
    if (lastSent.size > 500 || declined.size > 500) pruneCooldowns();
    const t = now(), last = lastSent.get(fromUid);
    if (last !== undefined && t - last < T(INVITE_GAP_MS)) return fail(`Bạn mời hơi nhanh, đợi ${Math.ceil((T(INVITE_GAP_MS) - (t - last)) / 1000)} giây nữa nhé.`);
    const until = declined.has(fromUid) ? declined.get(fromUid).get(toUid) : undefined;
    if (until !== undefined && until > t) return fail(`Người này vừa từ chối. Khoảng ${Math.ceil((until - t) / 60000)} phút nữa bạn mới mời lại được.`);
    if ((incoming.get(toUid) || { size: 0 }).size >= MAX_INCOMING) return fail('Người này đang có quá nhiều lời mời chờ trả lời.');
    const fa = fighterOf(fromUid), fb = fighterOf(toUid);
    if (!fa) return fail('Bạn chưa có hồ sơ võ học.');
    if (!fb) return fail('Người này chưa có hồ sơ võ học.');
    if (fa.learned.length < 4) return fail('Bạn cần học ít nhất 4 chiêu mới đấu được.');
    if (fb.learned.length < 4) return fail('Người này chưa học đủ 4 chiêu để đấu.');
    touch(me, () => { me.lv = fa.level; me.wins = fa.wins; me.losses = fa.losses; me.draws = fa.draws; });
    touch(him, () => { him.lv = fb.level; him.wins = fb.wins; him.losses = fb.losses; him.draws = fb.draws; });

    const inv = { id: ++inviteSeq, from: fromUid, to: toUid, mode, expiresAt: t + T(R.INVITE_MS), timer: null };
    invites.set(String(inv.id), inv);
    outgoing.set(fromUid, inv);
    if (!incoming.has(toUid)) incoming.set(toUid, new Set());
    incoming.get(toUid).add(inv);
    lastSent.set(fromUid, t);
    inv.timer = setT(() => {
      inv.timer = null;
      if (closed) return;
      try { closeInvite(inv, 'expired'); } catch (e) { logErr('hết hạn lời mời', e); }
    }, T(R.INVITE_MS));
    send(toUid, 'pk:invited', {
      inviteId: inv.id, mode, expiresAt: inv.expiresAt,
      from: { pid: me.pid, name: me.name, look: me.look, lv: me.lv, wins: me.wins, losses: me.losses },
      buffs: { you: buffCopy(buffFor(toUid)), op: buffCopy(buffFor(fromUid)) }
    });
    return { ok: true, inviteId: inv.id, expiresAt: inv.expiresAt };
  }

  function cancelInvite(uid, inviteId) {
    const k = idKey(inviteId), inv = k === null ? null : invites.get(k);
    if (!inv || inv.from !== uid) return fail('Không thấy lời mời này.');
    closeInvite(inv, 'cancelled');
    return { ok: true };
  }

  function respond(uid, inviteId, accept) {
    if (!enabled || closed) return fail('Sân đấu chưa mở.');
    if (typeof accept !== 'boolean') return fail('Câu trả lời không hợp lệ.');
    const k = idKey(inviteId), inv = k === null ? null : invites.get(k);
    if (!inv || inv.to !== uid) return fail('Lời mời này không còn nữa.');
    if (!accept) {
      if (!declined.has(inv.from)) declined.set(inv.from, new Map());
      declined.get(inv.from).set(uid, now() + T(DECLINE_WAIT_MS));
      closeInvite(inv, 'declined');
      return { ok: true };
    }
    if (matches.size >= maxMatches) { closeInvite(inv, 'busy'); return fail('Sân đấu đang kín chỗ, bạn đợi một lát nhé.'); }
    const him = rows.get(inv.from), me = rows.get(uid);
    if (!him || !me || him.match || me.match) { closeInvite(inv, 'busy'); return fail('Người mời không còn sẵn sàng đấu.'); }
    const fa = fighterOf(inv.from), fb = fighterOf(uid);
    const bad = !fb ? 'Bạn chưa có hồ sơ võ học.' : fb.learned.length < 4 ? 'Bạn cần học ít nhất 4 chiêu mới đấu được.'
      : !fa || fa.learned.length < 4 ? 'Người mời chưa đủ điều kiện để đấu.' : null;
    if (bad) { closeInvite(inv, 'busy'); return fail(bad); }

    const m = buildMatch(inv, fa, fb);
    closeInvite(inv, 'accepted');
    closeInvitesOf(inv.from, 'busy');
    closeInvitesOf(uid, 'busy');
    registerMatch(m);
    return { ok: true };
  }

  /* ---------- dựng trận ---------- */
  function buildMatch(inv, fa, fb) {
    let id = null;
    if (typeof deps.newId === 'function') id = call('newId', () => deps.newId(), null);
    if (id == null || matches.has(String(id))) { do { id = ++matchSeq; } while (matches.has(String(id))); }
    const mk = (uid, f) => {
      const r = rows.get(uid);
      return {
        uid, pid: r.pid, name: r.name, look: r.look, level: f.level, learned: f.learned, mastery: { ...f.mastery }, secretSkills: f.secretSkills.slice(),
        prefill: M.validateLoadout(f.loadout, f.learned).ok ? f.loadout.slice() : defaultLoadout(f.learned),
        record: { wins: f.wins, losses: f.losses, draws: f.draws },
        loadout: null, lobbyLocked: false,
        pick: null, locked: false, byPlayer: false, forced: null, idle: 0
      };
    };
    const buffs = { a: buffFor(inv.from), b: buffFor(inv.to) };   // chụp một lần, giữ suốt trận
    return {
      id, seed: newSeed(), mode: inv.mode, buffs, phase: 'lobby', turn: 0, over: false, duel: null,
      p: { a: mk(inv.from, fa), b: mk(inv.to, fb) },
      deadline: now() + T(R.LOADOUT_MS), nextAt: null, lastReveal: null, awaySince: null, timers: {}
    };
  }

  function registerMatch(m) {
    matches.set(String(m.id), m);
    for (const s of SIDES) {
      const uid = m.p[s].uid;
      matchOfUid.set(uid, m);
      const r = rows.get(uid);
      if (r) touch(r, () => { r.match = m; });
      call('setActiveMatch', () => deps.setActiveMatch && deps.setActiveMatch(uid, m.id));
    }
    for (const s of SIDES) send(m.p[s].uid, 'pk:lobby', lobbyPayload(m, s));
    arm(m, 'lobby', T(R.LOADOUT_MS), () => lobbyTimeout(m));
    arm(m, 'watch', AWAY_POLL_MS, () => checkAway(m));
  }

  const manaOf = P => M.manaMaxOf(P.level);
  const publicSide = P => ({ pid: P.pid, name: P.name, look: P.look, level: P.level, hpMax: R.HP, manaMax: manaOf(P) });
  const buffsView = (m, s) => (m.buffs ? { you: buffCopy(m.buffs[s]), op: buffCopy(m.buffs[flip(s)]) } : null);
  const stateOf = (m, s) => (m.duel ? m.duel.state(s) : publicState(newFighter({ level: m.p[s].level, buff: m.buffs ? m.buffs[s] : null })));

  function lobbyPayload(m, s) {
    const P = m.p[s], load = P.loadout || P.prefill;
    return {
      matchId: m.id, mode: m.mode, deadlineAt: m.deadline, loadoutMs: T(R.LOADOUT_MS),
      you: { ...publicSide(P), learned: P.learned.slice(), mastery: { ...P.mastery }, loadout: load.slice(), warnings: M.loadoutWarnings(load) },
      op: publicSide(m.p[flip(s)]),
      buffs: buffsView(m, s)
    };
  }

  /* ---------- sảnh chọn bộ chiêu ---------- */
  function setLoadout(uid, matchId, skills) {
    const m = matchOfUid.get(uid);
    if (!m) return fail('Bạn không có trận nào đang diễn ra.');
    if (!idEq(matchId, m.id)) return fail('Không đúng trận.');
    if (m.phase !== 'lobby') return fail('Đã hết giờ chọn bộ chiêu.');
    const s = sideOf(m, uid), P = m.p[s];
    if (P.lobbyLocked) return fail('Bạn đã khóa bộ chiêu rồi, không đổi được.');
    if (!Array.isArray(skills) || skills.length !== 4) return fail('Cần chọn đúng 4 chiêu.');
    for (const x of skills) {
      if (typeof x !== 'string' || x.length > 64) return fail('Có chiêu không hợp lệ.');
      if (!has(M.SKILLS, x)) return fail('Có chiêu không tồn tại.');
    }
    const v = M.validateLoadout(skills, P.learned);
    if (!v.ok) return fail(v.reason);
    P.loadout = skills.slice();
    P.lobbyLocked = true;
    send(m.p[flip(s)].uid, 'pk:lobby:status', { matchId: m.id, opLocked: true });
    const warnings = M.loadoutWarnings(P.loadout);
    if (m.p.a.lobbyLocked && m.p.b.lobbyLocked) beginDuel(m);
    return { ok: true, locked: true, warnings };
  }

  function lobbyTimeout(m) {
    if (m.phase !== 'lobby') return;
    for (const s of SIDES) if (!m.p[s].lobbyLocked) m.p[s].loadout = m.p[s].prefill.slice();
    beginDuel(m);
  }

  function beginDuel(m) {
    disarm(m, 'lobby');
    try {
      const side = s => ({ level: m.p[s].level, loadout: m.p[s].loadout.slice(), mastery: m.p[s].mastery, secretSkills: m.p[s].secretSkills, buff: m.buffs ? m.buffs[s] : undefined });
      m.duel = new Duel({ seed: m.seed, rng: rngFor(m.seed), mode: m.mode, a: side('a'), b: side('b') });
      startTurn(m);
    } catch (e) { logErr('bắt đầu trận', e); abort(m); }
  }

  /* ---------- vòng lượt ---------- */
  function turnPayload(m, s) {
    const D = m.duel, o = flip(s), L = D.legal(s);
    const p = {
      matchId: m.id, turn: m.turn, deadlineAt: m.deadline, forced: L.forced, legal: L.picks.slice(),
      state: { you: D.state(s), op: D.state(o) }
    };
    if (m.turn === 1) p.loadouts = { you: m.p[s].loadout.slice(), op: m.p[o].loadout.slice() };
    return p;
  }

  function startTurn(m) {
    if (m.over) return;
    m.phase = 'choosing';
    m.turn = m.duel.turn;
    m.nextAt = null;
    m.deadline = now() + T(R.TURN_MS);
    for (const s of SIDES) {
      const P = m.p[s], f = m.duel.legal(s).forced;
      P.forced = f; P.pick = f; P.locked = !!f; P.byPlayer = false;     // đang tụ lực thì tự khóa, không báo cho đối thủ
    }
    arm(m, 'turn', T(R.TURN_MS), () => resolve(m));
    for (const s of SIDES) send(m.p[s].uid, 'pk:turn', turnPayload(m, s));
    if (m.p.a.locked && m.p.b.locked) resolve(m);
  }

  function pick(uid, matchId, turn, skillId) {
    const m = matchOfUid.get(uid);
    if (!m) return fail('Bạn không có trận nào đang diễn ra.');
    if (!idEq(matchId, m.id)) return fail('Không đúng trận.');
    if (m.phase === 'lobby') return fail('Chưa tới lượt đấu, hãy chọn bộ chiêu trước.');
    if (m.phase !== 'choosing') return fail('Đang lật chiêu, đợi lượt sau nhé.');
    if (!Number.isInteger(turn) || turn !== m.turn) return fail('Sai lượt, chiêu này không được tính.');
    if (typeof skillId !== 'string' || !skillId || skillId.length > 64) return fail('Chiêu không hợp lệ.');
    const s = sideOf(m, uid), P = m.p[s], Q = m.p[flip(s)];
    if (P.forced) return skillId === P.forced ? { ok: true, locked: true } : fail('Bạn đang tụ lực, lượt này phải tung đòn.');
    if (P.locked) return fail('Bạn đã khóa chiêu rồi, không đổi được.');
    const v = m.duel.validatePick(s, skillId);
    if (!v.ok) return fail(v.reason);
    P.pick = skillId; P.locked = true; P.byPlayer = true;
    send(Q.uid, 'pk:locked', { matchId: m.id, turn: m.turn });
    if (Q.locked) resolve(m);
    return { ok: true, locked: true };
  }

  /** Giải lượt đúng một lần: đổi pha trước, hủy hẹn giờ, rồi mới tính. */
  function resolve(m) {
    try { resolveTurn(m); } catch (e) { logErr('giải lượt', e); abort(m); }
  }
  function resolveTurn(m) {
    if (m.over || m.phase !== 'choosing') return;
    m.phase = 'reveal';
    disarm(m, 'turn');
    for (const s of SIDES) {
      const P = m.p[s];
      if (P.forced) continue;
      P.idle = P.byPlayer ? 0 : P.idle + 1;
    }
    const r = m.duel.step(m.p.a.pick, m.p.b.pick);
    let end = r.ended ? { result: r.ended.result, reason: r.ended.reason } : null;
    let extra = null;
    if (!end) {
      const ia = m.p.a.idle >= R.IDLE_FORFEIT_TURNS, ib = m.p.b.idle >= R.IDLE_FORFEIT_TURNS;
      if (ia && ib) end = { result: 'void', reason: 'void' };
      else if (ia || ib) end = { result: ia ? 'b' : 'a', reason: 'idle-forfeit', who: ia ? 'a' : 'b' };
      if (end) extra = { k: 'end', result: end.result === 'void' ? 'draw' : end.result, reason: end.reason };
    }
    m.nextAt = end ? null : now() + T(R.REVEAL_MS);
    m.lastReveal = {};
    for (const s of SIDES) {
      const o = flip(s), events = r.events.map(e => viewEvent(e, s));
      if (extra) events.push(viewEvent(extra, s));
      const payload = {
        matchId: m.id, turn: r.turn, nextAt: m.nextAt,
        picks: { you: { ...r.picks[s] }, op: { ...r.picks[o] } },
        events,
        state: { you: r.state[s], op: r.state[o] },
        ended: end ? { result: viewResult(end.result, s), reason: end.reason } : null
      };
      m.lastReveal[s] = payload;
      send(m.p[s].uid, 'pk:reveal', clone(payload));
    }
    if (end) finish(m, end);
    else arm(m, 'next', T(R.REVEAL_MS), () => startTurn(m));
  }

  /* ---------- hai bên cùng vắng ---------- */
  function checkAway(m, gone) {
    if (m.over) return;
    const need = T(R.BOTH_AWAY_MS), t = now();
    const away = SIDES.every(s => { const u = m.p[s].uid; return u === gone || !online(u); });
    if (!away) m.awaySince = null;
    else if (m.awaySince == null) m.awaySince = t;
    if (away && t - m.awaySince >= need) { finish(m, { result: 'void', reason: 'both-away' }); return; }
    arm(m, 'watch', away ? Math.max(1, Math.min(AWAY_POLL_MS, m.awaySince + need - t)) : AWAY_POLL_MS, () => checkAway(m));
  }

  /* ---------- kết thúc ---------- */
  /** o = { result:'a'|'b'|'draw'|'void', reason, who?:'a'|'b' }. 'void' (kể cả both-away) không tính thắng thua. */
  function finish(m, o) {
    if (m.over) return;
    m.over = true;
    for (const k of Object.keys(m.timers)) disarm(m, k);
    matches.delete(String(m.id));
    for (const s of SIDES) if (matchOfUid.get(m.p[s].uid) === m) matchOfUid.delete(m.p[s].uid);

    const turns = m.duel ? m.duel.history.length : 0, record = {};
    for (const s of SIDES) {
      const uid = m.p[s].uid;
      let rec = null;
      if (o.result !== 'void') {
        const kind = o.result === 'draw' ? 'draw' : o.result === s ? 'win' : 'loss';
        rec = call('recordResult', () => deps.recordResult(uid, kind), null);
      }
      if (!rec || typeof rec !== 'object') rec = fighterOf(uid) || m.p[s].record;
      record[s] = { wins: rec.wins | 0, losses: rec.losses | 0, draws: rec.draws | 0 };
    }
    for (const s of SIDES) {
      const P = m.p[s], out = {
        matchId: m.id, result: viewResult(o.result, s), reason: o.reason, turns,
        state: { you: stateOf(m, s), op: stateOf(m, flip(s)) }, record: { ...record[s] }
      };
      if (o.who) out.who = o.who === s ? 'you' : 'op';
      if (o.reason === 'double-ko' && m.duel) { out.state.you.down = Math.max(0, -m.duel.f[s].hp); out.state.op.down = Math.max(0, -m.duel.f[flip(s)].hp); }   // máu âm: ai ít âm hơn thắng
      send(P.uid, 'pk:end', out);
      // người đang rớt mạng không nhận được pk:end: giữ lại một câu để báo khi họ vào lại
      if (!call('isOnline', () => deps.isOnline(P.uid), true)) rememberEnd(P.uid, o, viewResult(o.result, s));
    }
    call('saveMatch', () => {
      if (!deps.saveMatch) return;
      deps.saveMatch({
        id: m.id, at: now(), mode: m.mode, seed: m.seed,
        a: { uid: m.p.a.uid, name: m.p.a.name }, b: { uid: m.p.b.uid, name: m.p.b.name },
        loadouts: { a: m.p.a.loadout && m.p.a.loadout.slice(), b: m.p.b.loadout && m.p.b.loadout.slice() },
        levels: { a: m.p.a.level, b: m.p.b.level },
        mastery: { a: { ...m.p.a.mastery }, b: { ...m.p.b.mastery } },
        buffs: m.buffs ? { a: buffCopy(m.buffs.a), b: buffCopy(m.buffs.b) } : null,
        result: o.result, reason: o.reason, turns,
        log: m.duel ? clone(m.duel.history.slice(0, LOG_TURNS)) : []
      });
    });
    for (const s of SIDES) {
      const uid = m.p[s].uid;
      call('setActiveMatch', () => deps.setActiveMatch && deps.setActiveMatch(uid, null));
      const r = rows.get(uid);
      if (r && r.match === m) touch(r, () => { r.match = null; r.wins = record[s].wins; r.losses = record[s].losses; r.draws = record[s].draws; });
    }
  }

  const lastEnds = new Map();      // uid -> { at, message }: kết quả trận kết thúc khi người đó đang vắng, báo một lần ở resume
  const END_KEEP_MS = 10 * 60e3;
  function rememberEnd(uid, o, res) {
    const why = o.reason === 'idle-forfeit' ? ' vì quá giờ chọn chiêu 3 lượt liền' : o.reason === 'forfeit' ? ' vì bỏ cuộc' : o.reason === 'ko' || o.reason === 'double-ko' ? ' trên sân' : '';
    const text = res === 'draw' && (o.reason === 'void' || o.reason === 'both-away')
      ? 'Trận vừa rồi đã bị hủy vì cả hai cùng vắng mặt. Không ai bị tính thua.'
      : `Trận vừa rồi đã kết thúc khi bạn không có mặt: ${res === 'win' ? 'bạn thắng' : res === 'lose' ? 'bạn thua' : 'hòa'}${why}.`;
    if (lastEnds.size > 200) for (const [k, v] of lastEnds) if (now() - v.at > END_KEEP_MS) lastEnds.delete(k);
    lastEnds.set(uid, { at: now(), message: text });
  }

  function forfeit(uid, matchId) {
    const m = matchOfUid.get(uid);
    if (!m) return fail('Bạn không có trận nào đang diễn ra.');
    if (!idEq(matchId, m.id)) return fail('Không đúng trận.');
    const s = sideOf(m, uid);
    // chưa vào trận (còn ở sảnh chọn bộ chiêu): rời là hủy, không ai bị tính thua
    finish(m, m.phase === 'lobby' ? { result: 'void', reason: 'void', who: s } : { result: flip(s), reason: 'forfeit', who: s });
    return { ok: true };
  }

  /* ---------- vào lại ---------- */
  function snapshot(m, s) {
    const o = flip(s), P = m.p[s], Q = m.p[o], D = m.duel, lobby = m.phase === 'lobby', choosing = m.phase === 'choosing';
    const you = { ...publicSide(P), loadout: (P.loadout || P.prefill).slice(), mastery: M.masteryMap(P.mastery, lobby ? P.learned : P.loadout || P.prefill) };
    const op = { ...publicSide(Q) };
    if (D) op.loadout = Q.loadout.slice();
    if (lobby) { you.learned = P.learned.slice(); you.warnings = M.loadoutWarnings(you.loadout); }
    const L = choosing ? D.legal(s) : { forced: null, picks: [] };
    return {
      matchId: m.id, phase: m.phase, turn: m.turn, deadlineAt: m.phase === 'reveal' ? m.nextAt : m.deadline, mode: m.mode,
      you, op, buffs: buffsView(m, s),
      state: { you: stateOf(m, s), op: stateOf(m, o) },
      loadouts: D ? { you: P.loadout.slice(), op: Q.loadout.slice() } : null,
      legal: L.picks.slice(), forced: L.forced,
      myPick: lobby ? null : P.pick, opLocked: lobby ? Q.lobbyLocked : Q.byPlayer,
      lastReveal: m.phase === 'reveal' && m.lastReveal ? clone(m.lastReveal[s]) : null,
      ...(lobby ? { loadoutMs: T(R.LOADOUT_MS), myLocked: P.lobbyLocked } : {})
    };
  }

  function resume(uid) {
    if (!okUid(uid)) return fail('Thông tin không hợp lệ.');
    const m = matchOfUid.get(uid);
    if (m) {
      m.awaySince = null;
      return { ok: true, snapshot: snapshot(m, sideOf(m, uid)) };
    }
    const le = lastEnds.get(uid);
    if (le) {
      lastEnds.delete(uid);
      if (now() - le.at < END_KEEP_MS) { call('setActiveMatch', () => deps.setActiveMatch && deps.setActiveMatch(uid, null)); return { ok: true, snapshot: null, message: le.message }; }
    }
    const stale = call('getActiveMatch', () => (deps.getActiveMatch ? deps.getActiveMatch(uid) : null), null);
    if (stale != null && stale !== false && stale !== '') {
      call('setActiveMatch', () => deps.setActiveMatch && deps.setActiveMatch(uid, null));
      return { ok: true, snapshot: null, message: RESTART_MSG };
    }
    return { ok: true, snapshot: null };
  }

  function shutdown() {
    closed = true;
    for (const m of matches.values()) { m.over = true; for (const k of Object.keys(m.timers)) disarm(m, k); }
    for (const inv of invites.values()) { stop(inv.timer); inv.timer = null; }
    matches.clear(); matchOfUid.clear(); invites.clear(); outgoing.clear(); incoming.clear();
    rows.clear(); pidToUid.clear(); lastSent.clear(); declined.clear();
    return { ok: true };
  }

  /* ---------- giao diện công khai: không hàm nào ném lỗi ra ngoài ---------- */
  const safe = (name, fn, dflt) => (...args) => {
    try { return fn(...args); } catch (e) { logErr(name, e); return typeof dflt === 'function' ? dflt() : dflt; }
  };
  const err = () => fail(FAIL_MSG);
  return {
    join: safe('join', join, err),
    leave: safe('leave', leave, err),
    list: safe('list', list, () => []),
    rowOf: safe('rowOf', rowOf, null),
    setDnd: safe('setDnd', setDnd, err),
    invite: safe('invite', invite, err),
    cancelInvite: safe('cancelInvite', cancelInvite, err),
    respond: safe('respond', respond, err),
    setLoadout: safe('setLoadout', setLoadout, err),
    pick: safe('pick', pick, err),
    forfeit: safe('forfeit', forfeit, err),
    resume: safe('resume', resume, err),
    hasMatch: safe('hasMatch', uid => matchOfUid.has(uid), false),
    stats: safe('stats', () => ({ players: rows.size, matches: matches.size, invites: invites.size }), () => ({ players: 0, matches: 0, invites: 0 })),
    shutdown: safe('shutdown', shutdown, err)
  };
}

module.exports = { createArenaManager };
