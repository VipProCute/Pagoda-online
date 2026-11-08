'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../public/js/martial');
const R = require('../lib/pk/rules');
const { computeBuff } = require('../lib/pk/buffs');
const { fromSequence } = require('../lib/pk/rng');
const { createArenaManager } = require('../lib/pk/manager');

/* ---------- đồng hồ giả: không dùng setTimeout thật ---------- */
function makeClock(t0 = 1700000000000) {
  let t = t0, seq = 0;
  const timers = new Map();
  return {
    now: () => t,
    setTimer(fn, ms) { const id = ++seq; timers.set(id, { id, at: t + Math.max(0, ms), fn }); return id; },
    clearTimer(id) { timers.delete(id); },
    pending: () => timers.size,
    advance(ms) {
      const target = t + ms;
      for (;;) {
        let best = null;
        for (const x of timers.values()) if (x.at <= target && (!best || x.at < best.at || (x.at === best.at && x.id < best.id))) best = x;
        if (!best) break;
        timers.delete(best.id);
        t = Math.max(t, best.at);
        best.fn();
      }
      t = target;
    }
  };
}

/* hai bộ chiêu không chung chiêu nào, để dò rò rỉ */
const LA = ['trong-quyen', 'thiet-bich', 'phan-chan', 'kim-chung-trao'];
const LB = ['tat-phong-quyen', 'lieu-diep-chuong', 'nhu-van-bo', 'anh-bo-ho-than'];
const ALL = M.SKILL_ORDER.slice();

/** Môi trường giả: mọi gói gửi đi được ghi lại (đã sao chép) theo thứ tự. */
function env(o = {}) {
  const clock = makeClock();
  const sent = [];                 // { uid, ev, p }
  const roomSent = [];             // { ev, p }
  const online = new Set(), fighters = new Map(), active = new Map(), blocks = new Set(), buffIn = new Map();
  const saved = [], results = [], logs = [];
  const last = new Map();          // uid -> { ev: payload mới nhất }
  let ids = 1000, seeds = 0;
  const hooks = { emitThrows: null, saveThrows: false };
  const deps = {
    now: clock.now, setTimer: clock.setTimer, clearTimer: clock.clearTimer,
    emit(uid, ev, p) {
      if (hooks.emitThrows && hooks.emitThrows(uid, ev)) throw new Error('emit hỏng');
      const c = JSON.parse(JSON.stringify(p));
      sent.push({ uid, ev, p: c });
      if (!last.has(uid)) last.set(uid, {});
      last.get(uid)[ev] = c;
    },
    emitRoom(ev, p) { roomSent.push({ ev, p: JSON.parse(JSON.stringify(p)) }); },
    isOnline: uid => online.has(uid),
    fighterOf: uid => (fighters.has(uid) ? JSON.parse(JSON.stringify(fighters.get(uid))) : null),
    buffInputsOf: uid => ({ ...(buffIn.get(uid) || { Lc: 0, Lq: 0, Ld: 0 }) }),
    recordResult(uid, r) {
      results.push({ uid, r });
      const f = fighters.get(uid);
      f[r === 'win' ? 'wins' : r === 'loss' ? 'losses' : 'draws']++;
      return { wins: f.wins, losses: f.losses, draws: f.draws };
    },
    setActiveMatch: (uid, id) => { if (id == null) active.delete(uid); else active.set(uid, id); },
    getActiveMatch: uid => (active.has(uid) ? active.get(uid) : null),
    saveMatch(rec) { if (hooks.saveThrows) throw new Error('lưu hỏng'); saved.push(JSON.parse(JSON.stringify(rec))); },
    isBlocked: (by, other) => blocks.has(by + '|' + other),
    newId: () => ++ids,
    newSeed: () => 'seed-' + (++seeds),
    log: (...a) => logs.push(a.join(' ')),
    config: { enabled: true, maxMatches: 20, ...(o.config || {}) },
    ...(o.deps || {})
  };
  const mgr = createArenaManager(deps);
  let pidSeq = 0;
  const E = {
    clock, sent, roomSent, online, fighters, active, blocks, buffIn, saved, results, logs, hooks, mgr, last, deps,
    /** Thêm người chơi và cho vào sân. */
    player(uid, f = {}, join = true) {
      fighters.set(uid, { level: 3, learned: ALL.slice(), loadout: [], wins: 0, losses: 0, draws: 0, ...f });
      online.add(uid);
      const pid = f.pid || ++pidSeq + 10;
      const r = join ? mgr.join(uid, { pid, name: 'ten-' + uid, look: { g: 'nam', c: 1, h: 0 } }) : null;
      return { uid, pid, row: r };
    },
    to: (uid, ev) => sent.filter(x => x.uid === uid && x.ev === ev).map(x => x.p),
    lastOf: (uid, ev) => { const a = E.to(uid, ev); return a[a.length - 1]; },
    count: (uid, ev) => E.to(uid, ev).length,
    roomEv: ev => roomSent.filter(x => x.ev === ev).map(x => x.p)
  };
  return E;
}

/** Mời và nhận lời giữa hai người đã join; trả matchId. */
function startMatch(e, A, B, mode = 'balanced') {
  const inv = e.mgr.invite(A.uid, B.pid, mode);
  assert.equal(inv.ok, true, inv.reason);
  const r = e.mgr.respond(B.uid, inv.inviteId, true);
  assert.equal(r.ok, true, r.reason);
  return e.lastOf(A.uid, 'pk:lobby').matchId;
}
/** Cả hai khóa bộ chiêu: lượt 1 bắt đầu. */
function lockBoth(e, A, B, mid, la = LA, lb = LB) {
  assert.equal(e.mgr.setLoadout(A.uid, mid, la).ok, true);
  assert.equal(e.mgr.setLoadout(B.uid, mid, lb).ok, true);
}
function duel(e, mode = 'balanced', la = LA, lb = LB, fa = {}, fb = {}) {
  const A = e.player('A', { loadout: la, ...fa }), B = e.player('B', { loadout: lb, ...fb });
  const mid = startMatch(e, A, B, mode);
  lockBoth(e, A, B, mid, la, lb);
  return { A, B, mid };
}
const turnOf = (e, uid) => e.lastOf(uid, 'pk:turn');
const pickFor = (e, P, mid, skill) => e.mgr.pick(P.uid, mid, turnOf(e, P.uid).turn, skill);
/** Bot chọn bừa trong các chiêu hợp lệ (rnd: () => [0,1)). */
const randomPick = (t, rnd) => t.legal[Math.floor(rnd() * t.legal.length)];
function lcg(seed) { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }

/** Chơi hết trận bằng chiêu hợp lệ của cả hai bên. */
function playOut(e, A, B, mid, rnd = lcg(7)) {
  for (let guard = 0; guard < 200 && e.mgr.hasMatch(A.uid); guard++) {
    const ta = turnOf(e, A.uid), tb = turnOf(e, B.uid);
    const a = e.mgr.pick(A.uid, mid, ta.turn, randomPick(ta, rnd));
    assert.equal(a.ok, true, a.reason);
    if (!e.mgr.hasMatch(A.uid)) break;
    const b = e.mgr.pick(B.uid, mid, tb.turn, randomPick(tb, rnd));
    assert.equal(b.ok, true, b.reason);
    e.clock.advance(R.REVEAL_MS);
  }
  assert.equal(e.mgr.hasMatch(A.uid), false, 'trận phải kết thúc');
}

/* ============================================================ người ở sân ============================================================ */

test('sân: join / leave / dnd phát arena:add, arena:upd, arena:del đúng hình dạng hàng', () => {
  const e = env();
  const a = e.player('A', { level: 4, wins: 2, losses: 1 });
  assert.deepEqual(a.row.row, { pid: a.pid, name: 'ten-A', look: { g: 'nam', c: 1, h: 0 }, lv: 4, wins: 2, losses: 1, st: 'free' });
  assert.deepEqual(e.roomEv('arena:add'), [a.row.row]);
  const b = e.player('B');
  assert.equal(e.mgr.list().length, 2);
  assert.deepEqual(Object.keys(e.mgr.rowOf('B')).sort(), ['look', 'losses', 'lv', 'name', 'pid', 'st', 'wins']);
  assert.equal(e.mgr.rowOf('khong-co'), null);
  assert.equal(e.mgr.setDnd('A', true).ok, true);
  assert.deepEqual(e.roomEv('arena:upd').pop(), { pid: a.pid, st: 'dnd' });
  assert.equal(e.mgr.rowOf('A').st, 'dnd');
  e.mgr.setDnd('A', false);
  assert.deepEqual(e.roomEv('arena:upd').pop(), { pid: a.pid, st: 'free' });
  assert.equal(e.mgr.leave('B', 'left').ok, true);
  assert.deepEqual(e.roomEv('arena:del').pop(), { pid: b.pid });
  assert.equal(e.mgr.list().length, 1);
  assert.equal(e.mgr.setDnd('B', true).ok, false, 'người đã rời không đặt dnd được');
  // không lộ uid ra ngoài
  assert.equal(JSON.stringify(e.roomSent).includes('"A"'), false);
});

test('sân: join lại cập nhật pid / tên / dáng, không nhân đôi hàng', () => {
  const e = env();
  const a = e.player('A');
  e.player('B');
  assert.equal(e.mgr.join('A', { pid: a.pid, name: 'Tên mới', look: { g: 'nu', c: 2, h: 1 } }).ok, true);
  assert.deepEqual(e.roomEv('arena:upd').pop(), { pid: a.pid, name: 'Tên mới', look: { g: 'nu', c: 2, h: 1 } });
  assert.equal(e.mgr.list().length, 2);
  const nxt = a.pid + 500;
  e.mgr.join('A', { pid: nxt, name: 'Tên mới', look: { g: 'nu', c: 2, h: 1 } });
  assert.deepEqual(e.roomEv('arena:del').pop(), { pid: a.pid });
  assert.equal(e.roomEv('arena:add').pop().pid, nxt);
  assert.equal(e.mgr.list().length, 2);
  // mời bằng pid cũ không còn tác dụng, pid mới thì có
  assert.equal(e.mgr.invite('B', a.pid, 'balanced').ok, false);
  assert.equal(e.mgr.invite('B', nxt, 'balanced').ok, true);
});

test('sân: join sai dữ liệu hoặc tắt sân thì từ chối, không ném lỗi', () => {
  const e = env();
  for (const bad of [null, undefined, 5, 'x', {}, { pid: 'a' }, { pid: 1.5 }, { pid: NaN }, []]) assert.equal(e.mgr.join('A', bad).ok, false);
  assert.equal(e.mgr.join(null, { pid: 1 }).ok, false);
  assert.equal(e.mgr.join({}, { pid: 1 }).ok, false);
  const off = env({ config: { enabled: false } });
  off.fighters.set('A', { level: 1, learned: ALL, loadout: [], wins: 0, losses: 0, draws: 0 });
  const r = off.mgr.join('A', { pid: 1, name: 'x', look: null });
  assert.equal(r.ok, false);
  assert.match(r.reason, /chưa mở/);
});

/* ============================================================ lời mời ============================================================ */

test('mời: gửi tới đúng người, đủ trường, không lộ uid; hết hạn 20 giây', () => {
  const e = env();
  const A = e.player('A', { level: 5, wins: 3, losses: 2 }), B = e.player('B');
  const t0 = e.clock.now();
  const r = e.mgr.invite('A', B.pid, 'balanced');
  assert.equal(r.ok, true);
  assert.equal(r.expiresAt, t0 + R.INVITE_MS);
  const got = e.lastOf('B', 'pk:invited');
  assert.deepEqual(got, {
    inviteId: r.inviteId, mode: 'balanced', expiresAt: t0 + 20000,
    from: { pid: A.pid, name: 'ten-A', look: { g: 'nam', c: 1, h: 0 }, lv: 5, wins: 3, losses: 2 }, buffs: { you: computeBuff({}), op: computeBuff({}) }
  });
  assert.equal(e.count('A', 'pk:invited'), 0);
  assert.equal(e.mgr.stats().invites, 1);
  e.clock.advance(19999);
  assert.equal(e.count('B', 'pk:invite:closed'), 0);
  e.clock.advance(1);
  assert.deepEqual(e.lastOf('A', 'pk:invite:closed'), { inviteId: r.inviteId, reason: 'expired' });
  assert.deepEqual(e.lastOf('B', 'pk:invite:closed'), { inviteId: r.inviteId, reason: 'expired' });
  assert.equal(e.mgr.stats().invites, 0);
  assert.equal(e.mgr.respond('B', r.inviteId, true).ok, false, 'đã hết hạn thì không nhận được');
  assert.equal(e.clock.pending(), 0);
});

test('mời: nhận lời mở sảnh cho cả hai, đóng lời mời "accepted", hàng thành busy', () => {
  const e = env();
  const A = e.player('A'), B = e.player('B');
  const inv = e.mgr.invite('A', B.pid, 'balanced');
  const r = e.mgr.respond('B', inv.inviteId, true);
  assert.deepEqual(r, { ok: true });
  for (const u of ['A', 'B']) assert.deepEqual(e.lastOf(u, 'pk:invite:closed'), { inviteId: inv.inviteId, reason: 'accepted' });
  assert.equal(e.count('A', 'pk:lobby'), 1);
  assert.equal(e.count('B', 'pk:lobby'), 1);
  assert.equal(e.mgr.rowOf('A').st, 'busy');
  assert.equal(e.mgr.rowOf('B').st, 'busy');
  assert.deepEqual(e.roomEv('arena:upd').filter(x => x.st === 'busy').map(x => x.pid).sort(), [A.pid, B.pid].sort());
  assert.equal(e.mgr.hasMatch('A'), true);
  assert.equal(e.active.get('A'), e.lastOf('A', 'pk:lobby').matchId);
  assert.equal(e.mgr.stats().matches, 1);
  assert.equal(e.mgr.stats().invites, 0);
});

test('mời: từ chối đóng "declined", 5 phút sau mới mời lại đúng người đó', () => {
  const e = env();
  e.player('A'); const B = e.player('B'); const C = e.player('C');
  const inv = e.mgr.invite('A', B.pid, 'balanced');
  assert.equal(e.mgr.respond('B', inv.inviteId, false).ok, true);
  assert.deepEqual(e.lastOf('A', 'pk:invite:closed'), { inviteId: inv.inviteId, reason: 'declined' });
  e.clock.advance(11000);
  const again = e.mgr.invite('A', B.pid, 'balanced');
  assert.equal(again.ok, false);
  assert.match(again.reason, /từ chối/);
  assert.equal(e.mgr.invite('A', C.pid, 'balanced').ok, true, 'người khác thì vẫn mời được');
  e.clock.advance(5 * 60000 - 11000 - 1);
  assert.equal(e.mgr.invite('A', B.pid, 'balanced').ok, false);
  e.clock.advance(1);
  assert.equal(e.mgr.invite('A', B.pid, 'balanced').ok, true);
});

test('mời: bên mời hủy được; người được mời sau đó không nhận được; người khác không hủy được', () => {
  const e = env();
  e.player('A'); const B = e.player('B'); e.player('C');
  const inv = e.mgr.invite('A', B.pid, 'balanced');
  assert.equal(e.mgr.cancelInvite('B', inv.inviteId).ok, false, 'người được mời không hủy thay bên mời');
  assert.equal(e.mgr.cancelInvite('C', inv.inviteId).ok, false);
  assert.equal(e.mgr.cancelInvite('A', 'khong-co').ok, false);
  assert.equal(e.mgr.cancelInvite('A', inv.inviteId).ok, true);
  for (const u of ['A', 'B']) assert.deepEqual(e.lastOf(u, 'pk:invite:closed'), { inviteId: inv.inviteId, reason: 'cancelled' });
  assert.equal(e.mgr.respond('B', inv.inviteId, true).ok, false);
  assert.equal(e.mgr.cancelInvite('A', inv.inviteId).ok, false, 'hủy lần hai');
  assert.equal(e.clock.pending(), 0, 'hủy rồi thì không còn hẹn giờ');
});

test('mời: mọi điều kiện chặn', () => {
  const e = env();
  const A = e.player('A'), B = e.player('B'), C = e.player('C'), D = e.player('D');
  const out = e.player('OUT', {}, false);
  const why = (r, re) => { assert.equal(r.ok, false); assert.match(r.reason, re); };
  why(e.mgr.invite('OUT', B.pid, 'balanced'), /ra Sân đấu/);            // người mời chưa vào sân
  why(e.mgr.invite('A', 99999, 'balanced'), /Không thấy/);              // pid không có
  why(e.mgr.invite('A', A.pid, 'balanced'), /tự mời/);                  // tự mời mình
  e.mgr.join('A', { pid: A.pid + 700, name: 'ten-A', look: null });      // cùng uid, pid mới: vẫn là chính mình
  why(e.mgr.invite('A', A.pid + 700, 'balanced'), /tự mời/);
  why(e.mgr.invite('A', B.pid, 'xyz'), /Chế độ/);
  why(e.mgr.invite('A', B.pid, null), /Chế độ/);
  why(e.mgr.invite('A', B.pid, undefined), /Chế độ/);
  why(e.mgr.invite('A', B.pid, { toString: () => 'buff' }), /Chế độ/);
  // dnd và bị chặn cùng một lời, không lộ ai chặn ai
  e.mgr.setDnd('B', true);
  const dndMsg = e.mgr.invite('A', B.pid, 'balanced');
  why(dndMsg, /không nhận lời mời/);
  e.mgr.setDnd('B', false);
  e.blocks.add('B|A');
  const blockMsg = e.mgr.invite('A', B.pid, 'balanced');
  assert.equal(blockMsg.reason, dndMsg.reason);
  const c2b = e.mgr.invite('C', B.pid, 'balanced');
  assert.equal(c2b.ok, true, 'chặn A không ảnh hưởng C');
  e.blocks.delete('B|A');
  // đang đấu
  assert.equal(e.mgr.respond('B', c2b.inviteId, true).ok, true);
  why(e.mgr.invite('A', B.pid, 'balanced'), /đang đấu/);
  why(e.mgr.invite('C', D.pid, 'balanced'), /đang trong trận/);
  // chưa có hồ sơ / chưa đủ chiêu
  e.player('NOPROF', {}, true);
  e.fighters.delete('NOPROF');
  why(e.mgr.invite('A', e.mgr.rowOf('NOPROF').pid, 'balanced'), /chưa có hồ sơ/);
  e.player('FEW', { learned: M.STARTERS.slice(0, 3) });
  why(e.mgr.invite('A', e.mgr.rowOf('FEW').pid, 'balanced'), /chưa học đủ 4 chiêu/);
  why(e.mgr.invite('FEW', D.pid, 'balanced'), /ít nhất 4 chiêu/);
  e.fighters.delete('A');
  why(e.mgr.invite('A', D.pid, 'balanced'), /chưa có hồ sơ/);
});

test('mời: chống spam (10 giây, một lời mời chờ, tối đa 3 lời mời nhận, 5 phút sau từ chối)', () => {
  const e = env();
  e.player('A'); const B = e.player('B'), C = e.player('C'); e.player('D'); e.player('F');
  // một lời mời chờ gửi đi
  assert.equal(e.mgr.invite('A', B.pid, 'balanced').ok, true);
  const second = e.mgr.invite('A', C.pid, 'balanced');
  assert.equal(second.ok, false);
  assert.match(second.reason, /đang có một lời mời/);
  // hủy rồi vẫn phải đợi đủ 10 giây kể từ lần gửi
  e.mgr.cancelInvite('A', e.lastOf('B', 'pk:invited').inviteId);
  e.clock.advance(9000);
  const fast = e.mgr.invite('A', C.pid, 'balanced');
  assert.equal(fast.ok, false);
  assert.match(fast.reason, /đợi 1 giây/);
  e.clock.advance(1000);
  assert.equal(e.mgr.invite('A', C.pid, 'balanced').ok, true);
  // tối đa 3 lời mời đang chờ nhận
  assert.equal(e.mgr.invite('B', C.pid, 'balanced').ok, true);
  assert.equal(e.mgr.invite('D', C.pid, 'balanced').ok, true);
  const over = e.mgr.invite('F', C.pid, 'balanced');
  assert.equal(over.ok, false);
  assert.match(over.reason, /quá nhiều lời mời/);
  // một lời mời được trả lời thì có chỗ trống
  e.mgr.respond('C', e.to('C', 'pk:invited')[2].inviteId, false);
  assert.equal(e.mgr.invite('F', C.pid, 'balanced').ok, true);
});

test('mời: nhận lời thì đóng mọi lời mời khác của cả hai bên bằng "busy"', () => {
  const e = env();
  const A = e.player('A'), B = e.player('B'), C = e.player('C'), D = e.player('D');
  const a2b = e.mgr.invite('A', B.pid, 'balanced');
  const c2b = e.mgr.invite('C', B.pid, 'balanced');
  const b2d = e.mgr.invite('B', D.pid, 'balanced');
  const d2a = e.mgr.invite('D', A.pid, 'balanced');
  assert.equal(b2d.ok, true); assert.equal(d2a.ok, true);
  assert.equal(e.mgr.respond('B', a2b.inviteId, true).ok, true);
  const closed = u => e.to(u, 'pk:invite:closed').map(x => x.inviteId + ':' + x.reason);
  assert.ok(closed('C').includes(c2b.inviteId + ':busy'));
  assert.ok(closed('D').includes(b2d.inviteId + ':busy'));
  assert.ok(closed('D').includes(d2a.inviteId + ':busy'));
  assert.equal(e.mgr.stats().invites, 0);
  assert.equal(e.mgr.respond('B', c2b.inviteId, true).ok, false);
  // người bị đóng lời mời mời được người khác (sau khoảng cách 10 giây)
  e.clock.advance(10000);
  assert.equal(e.mgr.invite('C', D.pid, 'balanced').ok, true);
  assert.equal(e.clock.pending() > 0, true);
});

test('mời: vượt maxMatches thì "busy" kèm lý do kín chỗ', () => {
  const e = env({ config: { maxMatches: 1 } });
  const A = e.player('A'), B = e.player('B'), C = e.player('C'), D = e.player('D');
  startMatch(e, A, B);
  const inv = e.mgr.invite('C', D.pid, 'balanced');
  assert.equal(inv.ok, true);
  const r = e.mgr.respond('D', inv.inviteId, true);
  assert.equal(r.ok, false);
  assert.match(r.reason, /kín chỗ/);
  for (const u of ['C', 'D']) assert.deepEqual(e.lastOf(u, 'pk:invite:closed'), { inviteId: inv.inviteId, reason: 'busy' });
  assert.equal(e.mgr.hasMatch('C'), false);
  assert.equal(e.mgr.stats().matches, 1);
  assert.equal(e.mgr.rowOf('C').st, 'free');
});

test('mời: người ra khỏi sân (cả left lẫn disconnect) thì lời mời liên quan đóng "left"', () => {
  const e = env();
  e.player('A'); const B = e.player('B'); const C = e.player('C');
  const inv = e.mgr.invite('A', B.pid, 'balanced');
  e.mgr.leave('B', 'disconnect');
  assert.deepEqual(e.lastOf('A', 'pk:invite:closed'), { inviteId: inv.inviteId, reason: 'left' });
  assert.equal(e.mgr.stats().invites, 0);
  assert.equal(e.mgr.respond('B', inv.inviteId, true).ok, false);
  e.clock.advance(10000);
  const inv2 = e.mgr.invite('A', C.pid, 'balanced');
  e.mgr.leave('A', 'left');
  assert.deepEqual(e.lastOf('C', 'pk:invite:closed'), { inviteId: inv2.inviteId, reason: 'left' });
  assert.equal(e.clock.pending(), 0);
});

test('mời: dữ liệu client lạ kiểu (số, đối tượng, null, chuỗi rất dài) không ném lỗi', () => {
  const e = env();
  e.player('A'); const B = e.player('B');
  const big = 'x'.repeat(100000);
  const weird = [undefined, null, 0, -1, 1.5, NaN, Infinity, 'a', big, {}, [], [1, 2], { a: 1 }, () => 1, true, Symbol.iterator];
  const inv = e.mgr.invite('A', B.pid, 'balanced');
  for (const w of weird) {
    for (const r of [
      e.mgr.invite('A', w, 'balanced'), e.mgr.invite('A', B.pid, w), e.mgr.cancelInvite('A', w), e.mgr.respond('B', w, true), e.mgr.respond('B', inv.inviteId, typeof w === 'boolean' ? 'x' : w),
      e.mgr.setLoadout('A', w, w), e.mgr.pick('A', w, w, w), e.mgr.forfeit('A', w), e.mgr.setDnd(w, w), e.mgr.resume(w), e.mgr.join(w, w), e.mgr.leave(w, w)
    ]) assert.ok(r && typeof r === 'object', 'phải trả đối tượng');
    assert.equal(typeof e.mgr.hasMatch(w), 'boolean');
  }
  assert.equal(e.mgr.respond('B', inv.inviteId, 'true').ok, false, 'accept không phải boolean');
  assert.equal(e.mgr.stats().invites, 1, 'lời mời hợp lệ không bị phá');
  assert.equal(e.mgr.respond('B', String(inv.inviteId), true).ok, true, 'id dạng chuỗi số vẫn khớp');
  // chuỗi rất dài làm matchId / skillId
  const mid2 = e.lastOf('A', 'pk:lobby').matchId;
  assert.equal(e.mgr.setLoadout('A', mid2, [big, big, big, big]).ok, false);
  assert.equal(e.mgr.setLoadout('A', mid2, new Array(100000).fill('trong-quyen')).ok, false);
});

/* ============================================================ sảnh chọn bộ chiêu ============================================================ */

test('sảnh: pk:lobby đủ trường theo hợp đồng, balanced không có buff', () => {
  const e = env();
  const A = e.player('A', { level: 4, loadout: LA }), B = e.player('B', { level: 6 });
  const t0 = e.clock.now();
  const inv = e.mgr.invite('A', B.pid, 'balanced');
  e.mgr.respond('B', inv.inviteId, true);
  const la = e.lastOf('A', 'pk:lobby'), lb = e.lastOf('B', 'pk:lobby');
  assert.equal(la.matchId, lb.matchId);
  assert.equal(la.mode, 'balanced');
  assert.equal(la.deadlineAt, t0 + R.LOADOUT_MS);
  assert.equal(la.loadoutMs, 30000);
  assert.deepEqual(la.buffs, { you: computeBuff({}), op: computeBuff({}) });
  assert.deepEqual(la.you, {
    pid: A.pid, name: 'ten-A', look: { g: 'nam', c: 1, h: 0 }, level: 4, hpMax: R.HP, manaMax: M.manaMaxOf(4),
    learned: ALL, loadout: LA, warnings: []
  });
  assert.deepEqual(la.op, { pid: B.pid, name: 'ten-B', look: { g: 'nam', c: 1, h: 0 }, level: 6, hpMax: R.HP, manaMax: M.manaMaxOf(6) });
  assert.deepEqual(lb.op, { pid: A.pid, name: 'ten-A', look: { g: 'nam', c: 1, h: 0 }, level: 4, hpMax: R.HP, manaMax: M.manaMaxOf(4) });
  assert.equal(lb.you.loadout.length, 4, 'chưa lưu bộ nào thì gợi ý 4 chiêu bậc nhập môn đầu tiên');
  assert.deepEqual(lb.you.loadout, M.STARTERS.slice(0, 4));
  assert.equal(JSON.stringify([la, lb]).includes('seed'), false);
});

test('sảnh: khóa đủ cả hai thì vào lượt 1 ngay, công bố bộ chiêu hai bên; đối thủ nhận pk:lobby:status', () => {
  const e = env();
  const A = e.player('A'), B = e.player('B');
  const mid = startMatch(e, A, B);
  const t0 = e.clock.now();
  const r = e.mgr.setLoadout('A', mid, LA);
  assert.deepEqual(r, { ok: true, locked: true, warnings: [] });
  assert.deepEqual(e.lastOf('B', 'pk:lobby:status'), { matchId: mid, opLocked: true });
  assert.equal(e.count('A', 'pk:lobby:status'), 0, 'người khóa không nhận status của chính mình');
  assert.equal(e.count('A', 'pk:turn'), 0, 'mới một bên khóa thì chưa bắt đầu');
  e.clock.advance(5000);
  assert.equal(e.mgr.setLoadout('B', mid, LB).ok, true);
  const ta = turnOf(e, 'A'), tb = turnOf(e, 'B');
  assert.equal(ta.turn, 1);
  assert.equal(ta.deadlineAt, t0 + 5000 + R.TURN_MS);
  assert.deepEqual(ta.loadouts, { you: LA, op: LB });
  assert.deepEqual(tb.loadouts, { you: LB, op: LA });
  assert.equal(ta.forced, null);
  assert.deepEqual(ta.legal.filter(x => x !== M.REST_ID).sort(), LA.slice().sort());
  assert.ok(ta.legal.includes(M.REST_ID));
  assert.deepEqual(Object.keys(ta.state).sort(), ['op', 'you']);
  assert.deepEqual(ta.state.you, ta.state.op.level === ta.state.you.level ? ta.state.op : ta.state.you);
  for (const k of ['level', 'hp', 'hpMax', 'mana', 'manaMax', 'rage', 'charging', 'kc', 'exposed', 'offExt', 'defP', 'dodgeB']) assert.ok(k in ta.state.you, k);
  // khóa xong thì hết giờ sảnh không bắt đầu thêm lần nữa
  e.clock.advance(R.LOADOUT_MS - 5000 - R.TURN_MS + 1000);
  assert.equal(e.count('A', 'pk:turn'), 1);
  assert.equal(e.count('A', 'pk:reveal'), 0);
});

test('sảnh: bộ chiêu sai bị từ chối (đủ kiểu), khóa rồi không đổi, sau giờ không khóa được', () => {
  const e = env();
  const A = e.player('A', { learned: M.STARTERS.slice() }), B = e.player('B');
  const mid = startMatch(e, A, B);
  const bad = (skills, re) => { const r = e.mgr.setLoadout('A', mid, skills); assert.equal(r.ok, false, String(JSON.stringify(skills)).slice(0, 60)); if (re) assert.match(r.reason, re); };
  bad(undefined, /4 chiêu/); bad(null, /4 chiêu/); bad('trong-quyen', /4 chiêu/); bad({}, /4 chiêu/);
  bad(LA.slice(0, 3), /4 chiêu/); bad(LA.concat('thiet-bich'), /4 chiêu/); bad([], /4 chiêu/);
  bad(['trong-quyen', 'trong-quyen', 'thiet-bich', 'tat-phong-quyen'], /khác nhau/);
  bad(['trong-quyen', 'thiet-bich', 'tat-phong-quyen', 'khong-co'], /không tồn tại/);
  bad(['trong-quyen', 'thiet-bich', 'tat-phong-quyen', 'constructor'], /không tồn tại/);
  bad(['trong-quyen', 'thiet-bich', 'tat-phong-quyen', 1], /không hợp lệ/);
  bad(['trong-quyen', 'thiet-bich', 'tat-phong-quyen', null], /không hợp lệ/);
  bad(['trong-quyen', 'thiet-bich', 'tat-phong-quyen', {}], /không hợp lệ/);
  bad(['trong-quyen', 'thiet-bich', 'tat-phong-quyen', 'x'.repeat(5000)], /không hợp lệ/);
  bad(['trong-quyen', 'thiet-bich', 'tat-phong-quyen', 'kim-chung-trao'], /chưa học/);      // chiêu bậc 2 chưa học
  bad(['trong-quyen', 'thiet-bich', 'tat-phong-quyen', 'dieu-tuc'], /không tồn tại/);
  assert.equal(e.mgr.setLoadout('A', mid + 1, M.STARTERS.slice(0, 4)).ok, false, 'sai matchId');
  assert.equal(e.mgr.setLoadout('A', null, M.STARTERS.slice(0, 4)).ok, false);
  assert.equal(e.mgr.setLoadout('khong-co', mid, M.STARTERS.slice(0, 4)).ok, false, 'người không trong trận');
  assert.equal(e.count('B', 'pk:lobby:status'), 0, 'bộ sai không báo khóa cho đối thủ');
  const ok = M.STARTERS.slice(0, 4);
  assert.equal(e.mgr.setLoadout('A', mid, ok).ok, true);
  const again = e.mgr.setLoadout('A', mid, M.STARTERS.slice(1, 5));
  assert.equal(again.ok, false);
  assert.match(again.reason, /đã khóa/);
  assert.equal(e.count('B', 'pk:lobby:status'), 1);
  e.clock.advance(R.LOADOUT_MS);
  const late = e.mgr.setLoadout('B', mid, LB);
  assert.equal(late.ok, false);
  assert.match(late.reason, /hết giờ/);
});

test('sảnh: hết giờ chưa khóa thì dùng bộ đã lưu nếu hợp lệ, không thì 4 chiêu đã học đầu tiên theo thứ tự', () => {
  const e = env();
  // A có bộ lưu hợp lệ, B có bộ lưu không hợp lệ (chiêu chưa học) và chỉ học vài chiêu
  const learnedB = ['tat-phong-quyen', 'thiet-bich', 'trong-quyen', 'nhu-van-bo', 'lieu-diep-chuong'];
  const A = e.player('A', { loadout: LA }), B = e.player('B', { learned: learnedB, loadout: ['kim-chung-trao', 'phan-chan', 'trong-quyen', 'thiet-bich'] });
  const mid = startMatch(e, A, B);
  assert.equal(e.mgr.setLoadout('A', mid, LB).ok, true, 'A tự khóa bộ khác');
  e.clock.advance(R.LOADOUT_MS - 1);
  assert.equal(e.count('B', 'pk:turn'), 0);
  e.clock.advance(1);
  const ta = turnOf(e, 'A'), tb = turnOf(e, 'B');
  assert.deepEqual(ta.loadouts.you, LB, 'bộ đã khóa được giữ');
  const expectB = M.SKILL_ORDER.filter(id => learnedB.includes(id)).slice(0, 4);
  assert.deepEqual(tb.loadouts.you, expectB);
  assert.deepEqual(tb.loadouts.op, LB);
  assert.equal(ta.deadlineAt, e.clock.now() + R.TURN_MS);
  // bộ lưu hợp lệ được dùng khi hết giờ
  const e2 = env();
  const C = e2.player('C', { loadout: LA }), D = e2.player('D', { loadout: LB });
  startMatch(e2, C, D);
  e2.clock.advance(R.LOADOUT_MS);
  assert.deepEqual(turnOf(e2, 'C').loadouts, { you: LA, op: LB });
  assert.deepEqual(turnOf(e2, 'D').loadouts, { you: LB, op: LA });
});

/* ============================================================ vòng lượt ============================================================ */

test('lượt: chạy hết trận bằng pick hợp lệ cả hai bên, pk:end đúng hợp đồng, dọn sạch', () => {
  const e = env();
  const A = e.player('A', { loadout: LA }), B = e.player('B', { loadout: LB });
  const mid = startMatch(e, A, B);
  lockBoth(e, A, B, mid);
  playOut(e, A, B, mid);
  const ea = e.lastOf('A', 'pk:end'), eb = e.lastOf('B', 'pk:end');
  assert.equal(e.count('A', 'pk:end'), 1); assert.equal(e.count('B', 'pk:end'), 1);
  assert.equal(ea.matchId, mid);
  assert.ok(['win', 'lose', 'draw'].includes(ea.result));
  assert.equal(eb.result, ea.result === 'win' ? 'lose' : ea.result === 'lose' ? 'win' : 'draw');
  assert.ok(['ko', 'double-ko', 'turn-limit'].includes(ea.reason), ea.reason);
  assert.ok(ea.turns >= 1 && ea.turns <= R.MAX_TURNS);
  assert.deepEqual(Object.keys(ea.state).sort(), ['op', 'you']);
  assert.equal(ea.state.you.hp, eb.state.op.hp);
  assert.deepEqual(Object.keys(ea.record).sort(), ['draws', 'losses', 'wins']);
  assert.equal('who' in ea, false);
  // ghi nhận thắng thua đúng một lần mỗi người
  assert.equal(e.results.length, 2);
  const mine = e.results.find(x => x.uid === 'A').r;
  assert.equal(mine, ea.result === 'win' ? 'win' : ea.result === 'lose' ? 'loss' : 'draw');
  assert.equal(ea.record.wins + ea.record.losses + ea.record.draws, 1);
  // lưu trận
  assert.equal(e.saved.length, 1);
  const rec = e.saved[0];
  assert.equal(rec.id, 1001);
  assert.equal(rec.mode, 'balanced'); assert.equal(rec.seed, 'seed-1');
  assert.deepEqual(rec.a, { uid: 'A', name: 'ten-A' }); assert.deepEqual(rec.b, { uid: 'B', name: 'ten-B' });
  assert.deepEqual(rec.loadouts, { a: LA, b: LB });
  assert.deepEqual(rec.buffs, { a: computeBuff({}), b: computeBuff({}) });
  assert.equal(rec.turns, ea.turns);
  assert.equal(rec.log.length, ea.turns);
  assert.ok(rec.log.every(t => t.picks && Array.isArray(t.events) && Object.keys(t).sort().join() === 'events,picks,turn'));
  assert.equal(typeof rec.at, 'number');
  assert.equal(rec.reason, ea.reason);
  assert.equal(rec.result, ea.result === 'win' ? 'a' : ea.result === 'lose' ? 'b' : 'draw');
  // dọn
  assert.equal(e.active.size, 0);
  assert.equal(e.mgr.rowOf('A').st, 'free'); assert.equal(e.mgr.rowOf('B').st, 'free');
  assert.deepEqual(e.mgr.stats(), { players: 2, matches: 0, invites: 0 });
  assert.equal(e.clock.pending(), 0, 'không còn hẹn giờ mồ côi');
  // hàng sân cập nhật thắng/thua và về free
  const upd = e.roomEv('arena:upd').filter(x => x.st === 'free');
  assert.equal(upd.length, 2);
  // ra trận mới được ngay
  e.clock.advance(11000);
  assert.equal(e.mgr.invite('A', B.pid, 'balanced').ok, true);
});

test('lượt: pk:reveal đổi góc nhìn a/b thành you/op ở mọi trường và đủ trường hợp đồng', () => {
  const e = env();
  const { A, B, mid } = duel(e);
  const t0 = e.clock.now();
  pickFor(e, A, mid, 'trong-quyen');
  pickFor(e, B, mid, 'nhu-van-bo');
  const ra = e.lastOf('A', 'pk:reveal'), rb = e.lastOf('B', 'pk:reveal');
  assert.deepEqual(Object.keys(ra).sort(), ['ended', 'events', 'matchId', 'nextAt', 'picks', 'state', 'turn']);
  assert.equal(ra.turn, 1); assert.equal(ra.matchId, mid);
  assert.equal(ra.nextAt, t0 + R.REVEAL_MS);
  assert.deepEqual(ra.picks.you, { skill: 'trong-quyen', phase: null, auto: false, invalid: false, mana: 14 });
  assert.deepEqual(ra.picks.op, { skill: 'nhu-van-bo', phase: null, auto: false, invalid: false, mana: 7 });
  assert.deepEqual(rb.picks.you, ra.picks.op); assert.deepEqual(rb.picks.op, ra.picks.you);
  assert.equal(ra.ended, null);
  const sides = x => JSON.stringify(x);
  for (const ev of ra.events.concat(rb.events)) {
    for (const k of ['side', 'atk', 'def', 'target']) if (k in ev) assert.ok(ev[k] === 'you' || ev[k] === 'op', sides(ev));
  }
  assert.equal(ra.events.some(x => 'a' in x || 'b' in x), false);
  assert.equal(/"(a|b)"/.test(sides(ra)), false, 'không còn a / b trong gói');
  const pa = ra.events.filter(x => x.k === 'pick').map(x => x.side + ':' + x.skill);
  assert.deepEqual(pa.sort(), ['op:nhu-van-bo', 'you:trong-quyen']);
  const pb = rb.events.filter(x => x.k === 'pick').map(x => x.side + ':' + x.skill);
  assert.deepEqual(pb.sort(), ['op:trong-quyen', 'you:nhu-van-bo']);
  // sự kiện nào của A nhìn thành "you" thì B nhìn thành "op"
  const dodgeA = ra.events.find(x => x.k === 'dodge'), dodgeB = rb.events.find(x => x.k === 'dodge');
  assert.equal(dodgeA.atk, 'you'); assert.equal(dodgeA.def, 'op');
  assert.equal(dodgeB.atk, 'op'); assert.equal(dodgeB.def, 'you');
  assert.deepEqual(ra.state.you, rb.state.op); assert.deepEqual(ra.state.op, rb.state.you);
  assert.ok(ra.state.you.mana < ra.state.you.manaMax || ra.state.you.mana === ra.state.you.manaMax);
  // sau REVEAL_MS mới có pk:turn lượt 2
  assert.equal(e.count('A', 'pk:turn'), 1);
  e.clock.advance(R.REVEAL_MS - 1);
  assert.equal(e.count('A', 'pk:turn'), 1);
  e.clock.advance(1);
  assert.equal(turnOf(e, 'A').turn, 2);
  assert.equal(turnOf(e, 'A').deadlineAt, t0 + R.REVEAL_MS + R.TURN_MS);
  assert.equal('loadouts' in turnOf(e, 'A'), false, 'chỉ lượt 1 mới có loadouts');
});

test('lượt: sự kiện đỡ và phản đòn đổi side / target / atk / def đúng góc nhìn', () => {
  const e = env({ deps: { rngFor: () => fromSequence([0.0], 0.5) } });      // số 0.0: đỡ luôn thành công
  const { A, B, mid } = duel(e);
  pickFor(e, A, mid, 'phan-chan'); pickFor(e, B, mid, 'tat-phong-quyen');
  const ra = e.lastOf('A', 'pk:reveal'), rb = e.lastOf('B', 'pk:reveal');
  assert.deepEqual(ra.events.find(x => x.k === 'parry'), { ...ra.events.find(x => x.k === 'parry'), atk: 'op', def: 'you', ok: true });
  assert.deepEqual(rb.events.find(x => x.k === 'parry'), { ...rb.events.find(x => x.k === 'parry'), atk: 'you', def: 'op', ok: true });
  const ca = ra.events.find(x => x.k === 'counter'), cb = rb.events.find(x => x.k === 'counter');
  assert.deepEqual([ca.side, ca.target], ['you', 'op']);
  assert.deepEqual([cb.side, cb.target], ['op', 'you']);
  assert.equal(ca.dmg, cb.dmg);
  assert.equal(ra.state.op.hp, R.HP - ca.dmg);
  assert.equal(rb.state.you.hp, R.HP - ca.dmg);
  assert.equal(ra.events.some(x => x.k === 'exposed' && x.side === 'op'), true, 'bị đỡ hết thì sơ hở');
  assert.equal(ra.state.op.exposed, 1);
});

test('lượt: HAI NGƯỜI KHÔNG BAO GIỜ nhận gói chứa chiêu đối thủ trước pk:reveal', () => {
  for (const seed of [1, 2, 3]) {
    const e = env();
    const { A, B, mid } = duel(e, 'balanced', LA, LB, { learned: ALL.filter(id => !LB.includes(id)) }, { learned: ALL.filter(id => !LA.includes(id)) });
    const rnd = lcg(seed * 101);
    const picks = {};                                   // uid -> { turn: skill }
    picks.A = {}; picks.B = {};
    for (let g = 0; g < 100 && e.mgr.hasMatch('A'); g++) {
      const ta = turnOf(e, 'A'), tb = turnOf(e, 'B');
      const sa = randomPick(ta, rnd), sb = randomPick(tb, rnd);
      picks.A[ta.turn] = sa; picks.B[tb.turn] = sb;
      // thỉnh thoảng một bên không chọn (hết giờ) hoặc đợi lâu
      const mode = Math.floor(rnd() * 4);
      if (mode === 0) { e.mgr.pick('A', mid, ta.turn, sa); e.clock.advance(R.TURN_MS); }
      else if (mode === 1) { e.mgr.pick('B', mid, tb.turn, sb); e.clock.advance(R.TURN_MS); }
      else { e.mgr.pick('A', mid, ta.turn, sa); e.clock.advance(300); e.mgr.pick('B', mid, tb.turn, sb); }
      e.clock.advance(R.REVEAL_MS);
    }
    assert.equal(e.mgr.hasMatch('A'), false);
    // duyệt toàn bộ gói đã gửi
    const stripped = p => {
      const c = JSON.parse(JSON.stringify(p));
      delete c.loadouts;                                        // lượt 1 công bố bộ chiêu là hợp lệ
      if (c.state && c.state.op) delete c.state.op.charging;    // đang tụ lực là công khai
      return JSON.stringify(c);
    };
    for (const [me, op, opLoad] of [['A', 'B', LB], ['B', 'A', LA]]) {
      const mine = e.sent.filter(x => x.uid === me);
      for (let i = 0; i < mine.length; i++) {
        if (mine[i].ev !== 'pk:turn') continue;
        const t = mine[i].p.turn;
        for (let j = i; j < mine.length && !(mine[j].ev === 'pk:reveal' && mine[j].p.turn === t) && mine[j].ev !== 'pk:end'; j++) {
          const text = stripped(mine[j].p);
          for (const id of opLoad) assert.equal(text.includes(id), false, `${me} nhận chiêu ${id} của ${op} trước reveal lượt ${t} (${mine[j].ev})`);
          if (mine[j].ev === 'pk:locked') assert.deepEqual(Object.keys(mine[j].p).sort(), ['matchId', 'turn']);
        }
      }
      // trước lượt 1 (sảnh) cũng không có chiêu của đối thủ
      const firstTurn = mine.findIndex(x => x.ev === 'pk:turn');
      for (const x of mine.slice(0, firstTurn)) for (const id of opLoad) assert.equal(stripped(x.p).includes(id), false);
    }
    // seed không bao giờ gửi cho client
    assert.equal(JSON.stringify(e.sent).includes('seed-'), false);
    assert.equal(JSON.stringify(e.roomSent).includes('seed-'), false);
  }
});

test('lượt: pk:locked chỉ đến đối thủ, không kèm gì khác; người bị ép tụ lực không phát pk:locked', () => {
  const e = env();
  const la = ['tu-luc-pha-son', 'thiet-bich', 'trong-quyen', 'tat-phong-quyen'];
  const { A, B, mid } = duel(e, 'balanced', la, LB, { level: 9 }, { level: 9 });
  pickFor(e, A, mid, 'tu-luc-pha-son');
  assert.deepEqual(e.to('B', 'pk:locked'), [{ matchId: mid, turn: 1 }]);
  assert.equal(e.count('A', 'pk:locked'), 0);
  pickFor(e, B, mid, 'nhu-van-bo');
  assert.equal(e.count('A', 'pk:locked'), 1, 'B là bên chọn sau: A nhận đúng một pk:locked rồi tới pk:reveal');
  assert.equal(e.sent.filter(x => x.uid === 'A').at(-2).ev, 'pk:locked');
  assert.equal(e.sent.filter(x => x.uid === 'A').at(-1).ev, 'pk:reveal');
  e.clock.advance(R.REVEAL_MS);
  const t2a = turnOf(e, 'A'), t2b = turnOf(e, 'B');
  assert.equal(t2a.forced, 'tu-luc-pha-son');
  assert.deepEqual(t2a.legal, ['tu-luc-pha-son']);
  assert.equal(t2b.forced, null);
  assert.equal(t2a.state.you.charging, 'tu-luc-pha-son');
  assert.equal(t2b.state.op.charging, 'tu-luc-pha-son', 'đối thủ thấy bạn đang tụ lực');
  const lockedBefore = e.count('B', 'pk:locked');
  // A đã tự khóa: B chọn xong là giải ngay, B không nhận pk:locked nào của A, A cũng không nhận
  const r = pickFor(e, B, mid, 'tat-phong-quyen');
  assert.equal(r.ok, true);
  assert.equal(e.count('B', 'pk:locked'), lockedBefore, 'bên bị ép không phát pk:locked cho đối thủ');
  assert.equal(e.count('A', 'pk:locked'), 2, 'A vẫn nhận pk:locked khi B khóa');
  assert.equal(e.lastOf('A', 'pk:reveal').turn, 2);
  assert.equal(e.lastOf('A', 'pk:reveal').picks.you.phase, 'release');
});

test('lượt: cả hai bị ép tụ lực thì giải ngay không chờ giờ', () => {
  const e = env();
  const l = ['tu-luc-pha-son', 'thiet-bich', 'trong-quyen', 'tat-phong-quyen'];
  const { A, B, mid } = duel(e, 'balanced', l, l, { level: 9 }, { level: 9 });
  pickFor(e, A, mid, 'tu-luc-pha-son'); pickFor(e, B, mid, 'tu-luc-pha-son');
  e.clock.advance(R.REVEAL_MS);
  assert.equal(turnOf(e, 'A').forced, 'tu-luc-pha-son');
  assert.equal(turnOf(e, 'B').forced, 'tu-luc-pha-son');
  assert.equal(e.lastOf('A', 'pk:reveal').turn, 2, 'lượt 2 giải ngay lúc bắt đầu');
  assert.equal(e.count('A', 'pk:locked') + e.count('B', 'pk:locked'), 2, 'chỉ hai pk:locked của lượt 1');
  e.clock.advance(R.REVEAL_MS);
  assert.equal(turnOf(e, 'A').turn, 3);
});

test('pick: từ chối trùng, sai lượt, sai trận, sau khi khóa, pha lật, ngoài bộ, thiếu nội lực, đang tụ lực', () => {
  const e = env();
  const la = ['tu-luc-pha-son', 'thiet-bich', 'trong-quyen', 'tat-phong-quyen'];
  const { A, B, mid } = duel(e, 'balanced', la, LB, { level: 9 }, { level: 1 });
  const bad = (r, re) => { assert.equal(r.ok, false); if (re) assert.match(r.reason, re); };
  bad(e.mgr.pick('A', mid, 2, 'trong-quyen'), /Sai lượt/);
  bad(e.mgr.pick('A', mid, 0, 'trong-quyen'), /Sai lượt/);
  bad(e.mgr.pick('A', mid, '1', 'trong-quyen'), /Sai lượt/);
  bad(e.mgr.pick('A', mid, 1.5, 'trong-quyen'), /Sai lượt/);
  bad(e.mgr.pick('A', mid, null, 'trong-quyen'), /Sai lượt/);
  bad(e.mgr.pick('A', mid + 999, 1, 'trong-quyen'), /Không đúng trận/);
  bad(e.mgr.pick('A', undefined, 1, 'trong-quyen'), /Không đúng trận/);
  bad(e.mgr.pick('Z', mid, 1, 'trong-quyen'), /không có trận/);
  bad(e.mgr.pick('A', mid, 1, 'tat-phong-quyen-khac'), /không có trong bộ/);
  bad(e.mgr.pick('A', mid, 1, 'kim-chung-trao'), /không có trong bộ/);                 // tồn tại nhưng ngoài bộ
  bad(e.mgr.pick('A', mid, 1, 'dung-yen'), /Đứng yên/);
  bad(e.mgr.pick('A', mid, 1, ''), /không hợp lệ/);
  bad(e.mgr.pick('A', mid, 1, null), /không hợp lệ/);
  bad(e.mgr.pick('A', mid, 1, { x: 1 }), /không hợp lệ/);
  bad(e.mgr.pick('A', mid, 1, 'x'.repeat(100000)), /không hợp lệ/);
  bad(e.mgr.pick('A', mid, 1, '__proto__'), /không có trong bộ/);
  assert.equal(e.count('B', 'pk:locked'), 0, 'pick hỏng không báo khóa');
  // chiêu của người kia nhưng ngoài bộ của mình
  bad(e.mgr.pick('A', mid, 1, 'nhu-van-bo'), /không có trong bộ/);
  // hợp lệ → khóa; trùng / đổi chiêu bị từ chối
  assert.deepEqual(e.mgr.pick('A', mid, 1, 'trong-quyen'), { ok: true, locked: true });
  bad(e.mgr.pick('A', mid, 1, 'trong-quyen'), /đã khóa/);
  bad(e.mgr.pick('A', mid, 1, 'thiet-bich'), /đã khóa/);
  assert.equal(e.count('B', 'pk:locked'), 1, 'pick trùng không phát lại pk:locked');
  assert.equal(e.mgr.pick('B', mid, 1, 'tat-phong-quyen').ok, true);
  // pha lật chiêu
  bad(e.mgr.pick('A', mid, 1, 'trong-quyen'), /lật chiêu/);
  bad(e.mgr.pick('A', mid, 2, 'trong-quyen'), /lật chiêu/);
  e.clock.advance(R.REVEAL_MS);
  // lượt 2: thiếu nội lực. B level 1: mana tối đa 80. Làm cạn nội lực bằng nhiều lượt tốn.
  for (let i = 0; i < 40 && turnOf(e, 'B').legal.includes('tat-phong-quyen') && e.mgr.hasMatch('A'); i++) {
    pickFor(e, A, mid, 'thiet-bich');
    pickFor(e, B, mid, 'tat-phong-quyen');
    e.clock.advance(R.REVEAL_MS);
  }
  if (e.mgr.hasMatch('A') && !turnOf(e, 'B').legal.includes('tat-phong-quyen')) {
    const t = turnOf(e, 'B');
    bad(e.mgr.pick('B', mid, t.turn, 'tat-phong-quyen'), /nội lực/);
  }
});

test('pick: bị ép tụ lực thì chỉ được chiêu đang tụ (gọi lại chiêu đúng là vô hại)', () => {
  const e = env();
  const la = ['tu-luc-pha-son', 'thiet-bich', 'trong-quyen', 'tat-phong-quyen'];
  const { A, B, mid } = duel(e, 'balanced', la, LB, { level: 9 }, { level: 9 });
  pickFor(e, A, mid, 'tu-luc-pha-son'); pickFor(e, B, mid, 'nhu-van-bo');
  e.clock.advance(R.REVEAL_MS);
  const t = turnOf(e, 'A');
  assert.equal(t.forced, 'tu-luc-pha-son');
  const bad = e.mgr.pick('A', mid, t.turn, 'trong-quyen');
  assert.equal(bad.ok, false);
  assert.match(bad.reason, /tụ lực/);
  assert.equal(e.mgr.pick('A', mid, t.turn, 'dieu-tuc').ok, false);
  assert.deepEqual(e.mgr.pick('A', mid, t.turn, 'tu-luc-pha-son'), { ok: true, locked: true });
  assert.equal(e.count('B', 'pk:locked'), 1, 'chỉ pk:locked của lượt 1 (A chọn lượt 1)');
  // đối thủ chọn thì giải ngay, đòn tụ lực được tung
  pickFor(e, B, mid, 'nhu-van-bo');
  assert.equal(e.lastOf('A', 'pk:reveal').picks.you.phase, 'release');
  assert.equal(e.lastOf('A', 'pk:reveal').picks.you.auto, false);
});

test('giờ: hai pick gần như cùng lúc rồi hết giờ vẫn chỉ giải đúng một lần', () => {
  const e = env();
  const { A, B, mid } = duel(e);
  const t0 = e.clock.now();
  e.clock.advance(R.TURN_MS - 1);
  pickFor(e, A, mid, 'trong-quyen');
  pickFor(e, B, mid, 'nhu-van-bo');
  assert.equal(e.count('A', 'pk:reveal'), 1);
  e.clock.advance(1);                                  // đúng mốc hết giờ cũ
  assert.equal(e.count('A', 'pk:reveal'), 1, 'hẹn giờ cũ đã bị hủy');
  assert.equal(e.mgr.pick('A', mid, 1, 'trong-quyen').ok, false);
  e.clock.advance(R.REVEAL_MS - 1);
  assert.equal(turnOf(e, 'A').turn, 2);
  assert.equal(e.count('A', 'pk:reveal'), 1);
  assert.equal(e.lastOf('A', 'pk:reveal').nextAt, t0 + R.TURN_MS - 1 + R.REVEAL_MS);
  // pick đến cùng đúng mốc hết giờ: bên nào đến trước thắng, vẫn một lần
  const e2 = env();
  const d2 = duel(e2);
  e2.clock.advance(R.TURN_MS - 1);
  pickFor(e2, d2.A, d2.mid, 'trong-quyen');
  e2.clock.advance(1);                                 // hẹn giờ lượt nổ: B chưa chọn → Đứng yên
  assert.equal(e2.count('A', 'pk:reveal'), 1);
  assert.equal(pickFor(e2, d2.B, d2.mid, 'nhu-van-bo').ok, false, 'B chọn muộn sau khi đã lật');
  assert.equal(e2.count('A', 'pk:reveal'), 1);
});

test('giờ: quá giờ bên chưa chọn tự Đứng yên, bên đã chọn giữ chiêu', () => {
  const e = env();
  const { A, B, mid } = duel(e);
  const t0 = e.clock.now();
  pickFor(e, A, mid, 'trong-quyen');
  e.clock.advance(R.TURN_MS - 1);
  assert.equal(e.count('A', 'pk:reveal'), 0);
  e.clock.advance(1);
  const ra = e.lastOf('A', 'pk:reveal'), rb = e.lastOf('B', 'pk:reveal');
  assert.equal(ra.picks.you.skill, 'trong-quyen'); assert.equal(ra.picks.you.auto, false);
  assert.equal(ra.picks.op.skill, M.IDLE_ID); assert.equal(ra.picks.op.auto, true);
  assert.equal(rb.picks.you.skill, M.IDLE_ID); assert.equal(rb.picks.you.auto, true);
  assert.equal(ra.nextAt, t0 + R.TURN_MS + R.REVEAL_MS);
  assert.ok(ra.events.some(x => x.k === 'idle' && x.side === 'op'));
});

test('giờ: 3 lượt quá giờ liên tiếp thì thua idle-forfeit (who = bên bỏ); chọn lại thì đếm về 0', () => {
  const e = env();
  const { A, B, mid } = duel(e);
  // B bỏ 2 lượt rồi chọn lại → về 0
  for (let i = 0; i < 2; i++) { pickFor(e, A, mid, 'thiet-bich'); e.clock.advance(R.TURN_MS); e.clock.advance(R.REVEAL_MS); }
  assert.equal(e.mgr.hasMatch('A'), true);
  pickFor(e, A, mid, 'thiet-bich'); pickFor(e, B, mid, 'anh-bo-ho-than'); e.clock.advance(R.REVEAL_MS);
  for (let i = 0; i < 2; i++) { pickFor(e, A, mid, 'dieu-tuc'); e.clock.advance(R.TURN_MS); e.clock.advance(R.REVEAL_MS); }
  assert.equal(e.mgr.hasMatch('A'), true, 'đã chọn lại giữa chừng nên chưa đủ 3 lượt liên tiếp');
  // lượt thứ 3 liên tiếp
  pickFor(e, A, mid, 'dieu-tuc');
  e.clock.advance(R.TURN_MS);
  assert.equal(e.mgr.hasMatch('A'), false);
  const ra = e.lastOf('A', 'pk:reveal'), ea = e.lastOf('A', 'pk:end'), eb = e.lastOf('B', 'pk:end');
  assert.equal(ra.nextAt, null);
  assert.deepEqual(ra.ended, { result: 'win', reason: 'idle-forfeit' });
  assert.equal(ra.events.at(-1).k, 'end');
  assert.equal(ea.result, 'win'); assert.equal(ea.reason, 'idle-forfeit'); assert.equal(ea.who, 'op');
  assert.equal(eb.result, 'lose'); assert.equal(eb.who, 'you');
  assert.deepEqual(e.results.map(x => x.uid + ':' + x.r).sort(), ['A:win', 'B:loss']);
  assert.equal(e.saved[0].reason, 'idle-forfeit'); assert.equal(e.saved[0].result, 'a');
  assert.equal(e.clock.pending(), 0);
});

test('giờ: người bị ép tụ lực không bị tính quá giờ; cả hai cùng bỏ 3 lượt thì void không tính thắng thua', () => {
  const e = env();
  const { A, B, mid } = duel(e);
  for (let i = 0; i < 3; i++) e.clock.advance(R.TURN_MS + R.REVEAL_MS);
  assert.equal(e.mgr.hasMatch('A'), false);
  assert.equal(e.lastOf('A', 'pk:end').reason, 'void');
  assert.equal(e.lastOf('A', 'pk:end').result, 'draw');
  assert.equal(e.results.length, 0);
  assert.equal(e.saved[0].result, 'void');
  // bên bị ép: tụ lực rồi bỏ, lượt ép không tính
  const e2 = env();
  const la = ['tu-luc-pha-son', 'thiet-bich', 'trong-quyen', 'tat-phong-quyen'];
  const d = duel(e2, 'balanced', la, LB, { level: 9 }, { level: 9 });
  pickFor(e2, d.A, d.mid, 'tu-luc-pha-son'); pickFor(e2, d.B, d.mid, 'anh-bo-ho-than'); e2.clock.advance(R.REVEAL_MS);
  // lượt 2: A bị ép tung đòn (tự khóa), B bỏ → chỉ B bị tính (1)
  e2.clock.advance(R.TURN_MS);
  const r2 = e2.lastOf('A', 'pk:reveal');
  assert.equal(r2.turn, 2);
  assert.equal(r2.picks.you.auto, false, 'lượt bị ép tung không phải là tự đứng yên');
  e2.clock.advance(R.REVEAL_MS);
  // lượt 3: cả hai bỏ → A (1), B (2)
  e2.clock.advance(R.TURN_MS + R.REVEAL_MS);
  assert.equal(e2.mgr.hasMatch('A'), true, 'chưa ai đủ 3 lượt');
  // lượt 4: cả hai bỏ → B chạm 3 trước, A mới 2 (nếu tính lượt bị ép thì cả hai cùng 3 và trận bị void)
  e2.clock.advance(R.TURN_MS);
  assert.equal(e2.mgr.hasMatch('A'), false);
  assert.equal(e2.lastOf('A', 'pk:end').reason, 'idle-forfeit');
  assert.equal(e2.lastOf('A', 'pk:end').result, 'win');
  assert.equal(e2.lastOf('A', 'pk:end').who, 'op');
  assert.equal(e2.lastOf('B', 'pk:end').who, 'you');
});

test('giờ: cả hai không online liên tục đủ BOTH_AWAY_MS thì hủy "both-away", không tính thắng thua', () => {
  const e = env();
  const { A, B, mid } = duel(e);
  e.online.delete('A'); e.online.delete('B');
  e.mgr.leave('A', 'disconnect'); e.mgr.leave('B', 'disconnect');
  assert.equal(e.mgr.hasMatch('A'), true, 'mất kết nối chưa hủy ngay');
  e.clock.advance(R.BOTH_AWAY_MS - 1);
  assert.equal(e.mgr.hasMatch('A'), true);
  e.clock.advance(1);
  assert.equal(e.mgr.hasMatch('A'), false);
  const ea = e.lastOf('A', 'pk:end');
  assert.equal(ea.reason, 'both-away'); assert.equal(ea.result, 'draw');
  assert.equal(e.results.length, 0);
  assert.equal(e.saved.length, 1); assert.equal(e.saved[0].reason, 'both-away'); assert.equal(e.saved[0].result, 'void');
  assert.equal(e.active.size, 0);
  assert.equal(e.clock.pending(), 0);
});

test('giờ: một bên quay lại trước hạn thì không hủy; đếm both-away tính lại từ đầu', () => {
  const e = env();
  const { A, B, mid } = duel(e);
  // cứ lượt thứ 3 thì cả hai chọn (không bị xử thua vì quá giờ liên tiếp), các lượt khác bỏ qua
  const done = {};
  const keep = ms => {
    for (let i = 0; i < ms / 1000; i++) {
      e.clock.advance(1000);
      if (!e.mgr.hasMatch('A')) return;
      const t = turnOf(e, 'A');
      if (t.turn % 3 === 0 && !done[t.turn]) { done[t.turn] = true; for (const P of [A, B]) e.mgr.pick(P.uid, mid, t.turn, 'dieu-tuc'); }
    }
  };
  e.online.delete('A'); e.online.delete('B');
  e.mgr.leave('A', 'disconnect'); e.mgr.leave('B', 'disconnect');
  keep(50000);
  assert.equal(e.mgr.hasMatch('A'), true);
  e.online.add('A');                                   // A quay lại
  e.mgr.join('A', { pid: A.pid, name: 'ten-A', look: null });
  keep(20000);
  assert.equal(e.mgr.hasMatch('A'), true, 'đã quá 60 giây kể từ lúc rớt nhưng A đã quay lại');
  // cả hai lại vắng: phải đủ 60 giây từ lần vắng mới
  e.online.delete('A');
  e.mgr.leave('A', 'disconnect');
  keep(R.BOTH_AWAY_MS - 2000);
  assert.equal(e.mgr.hasMatch('A'), true);
  keep(2000);
  assert.equal(e.mgr.hasMatch('A'), false);
  assert.equal(e.lastOf('A', 'pk:end').reason, 'both-away');
});

test('giờ: mạng rớt không qua leave (isOnline đổi) vẫn bị phát hiện bằng thăm dò', () => {
  const e = env();
  duel(e);
  e.online.clear();
  e.clock.advance(R.BOTH_AWAY_MS + 3500);
  assert.equal(e.mgr.hasMatch('A'), false);
  assert.equal(e.lastOf('B', 'pk:end').reason, 'both-away');
});

test('forfeit: thua ngay "forfeit", who đúng góc nhìn, ghi thắng thua, dọn trận', () => {
  const e = env();
  const { A, mid } = duel(e);
  const bad = e.mgr.forfeit('A', mid + 99);
  assert.equal(bad.ok, false);
  assert.equal(e.mgr.hasMatch('A'), true);
  assert.deepEqual(e.mgr.forfeit('A', mid), { ok: true });
  const ea = e.lastOf('A', 'pk:end'), eb = e.lastOf('B', 'pk:end');
  assert.equal(ea.result, 'lose'); assert.equal(ea.reason, 'forfeit'); assert.equal(ea.who, 'you');
  assert.equal(eb.result, 'win'); assert.equal(eb.who, 'op');
  assert.equal(ea.turns, 0);
  assert.deepEqual(e.results.map(x => x.uid + ':' + x.r).sort(), ['A:loss', 'B:win']);
  assert.equal(ea.record.losses, 1); assert.equal(eb.record.wins, 1);
  assert.equal(e.mgr.hasMatch('A'), false);
  assert.equal(e.mgr.forfeit('A', mid).ok, false, 'gọi lại không làm gì');
  assert.equal(e.count('A', 'pk:end'), 1);
  assert.equal(e.saved.length, 1);
  assert.equal(e.clock.pending(), 0);
});

test('rời sảnh (forfeit khi còn chọn bộ chiêu) hủy trận, không ai bị tính thua', () => {
  const e = env();
  const A = e.player('A'), B = e.player('B');
  const mid = startMatch(e, A, B);
  assert.equal(e.mgr.forfeit('B', mid).ok, true);
  const ea = e.lastOf('A', 'pk:end'), eb = e.lastOf('B', 'pk:end');
  assert.equal(ea.result, 'draw'); assert.equal(ea.reason, 'void'); assert.equal(ea.who, 'op');
  assert.equal(eb.result, 'draw'); assert.equal(eb.who, 'you');
  assert.equal(e.results.length, 0, 'không ghi thắng thua');
  assert.equal(e.saved[0].result, 'void');
  assert.deepEqual(e.saved[0].loadouts, { a: null, b: null });
  assert.equal(e.clock.pending(), 0);
});

test("leave('left') giữa trận = bỏ cuộc; leave('disconnect') giữ trận chạy", () => {
  const e = env();
  const { A, B, mid } = duel(e);
  e.mgr.leave('A', 'left');
  assert.equal(e.mgr.hasMatch('A'), false);
  assert.equal(e.lastOf('B', 'pk:end').result, 'win');
  assert.equal(e.lastOf('B', 'pk:end').reason, 'forfeit');
  assert.equal(e.lastOf('B', 'pk:end').who, 'op');
  assert.equal(e.mgr.rowOf('A'), null, 'đã rời sân');
  assert.equal(e.mgr.rowOf('B').st, 'free');
  assert.equal(e.results.find(x => x.uid === 'A').r, 'loss');
  // mất kết nối: trận vẫn chạy, hàng bị xóa khỏi sân, B vẫn chơi được
  const e2 = env();
  const d = duel(e2);
  e2.online.delete('A');
  e2.mgr.leave('A', 'disconnect');
  assert.equal(e2.mgr.hasMatch('A'), true);
  assert.equal(e2.mgr.rowOf('A'), null);
  assert.deepEqual(e2.roomEv('arena:del').pop(), { pid: d.A.pid });
  assert.equal(e2.mgr.pick('B', d.mid, 1, 'tat-phong-quyen').ok, true);
  e2.clock.advance(R.TURN_MS);
  assert.equal(e2.lastOf('B', 'pk:reveal').picks.op.auto, true, 'A mất kết nối thì tự đứng yên');
  // A đứng yên đủ 3 lượt thì thua
  for (let i = 0; i < 2; i++) {
    e2.clock.advance(R.REVEAL_MS);
    e2.mgr.pick('B', d.mid, turnOf(e2, 'B').turn, 'dieu-tuc');
    e2.clock.advance(R.TURN_MS);
  }
  assert.equal(e2.mgr.hasMatch('B'), false);
  assert.equal(e2.lastOf('B', 'pk:end').reason, 'idle-forfeit');
  assert.equal(e2.lastOf('B', 'pk:end').result, 'win');
});

test('vào lại: join lại giữa trận trả hàng busy, resume trả đúng snapshot', () => {
  const e = env();
  const { A, B, mid } = duel(e);
  e.online.delete('A'); e.mgr.leave('A', 'disconnect');
  e.online.add('A');
  const r = e.mgr.join('A', { pid: A.pid + 50, name: 'ten-A', look: null });
  assert.equal(r.row.st, 'busy');
  assert.equal(e.roomEv('arena:add').pop().st, 'busy');
  assert.equal(e.mgr.resume('A').snapshot.matchId, mid);
});

test('resume: không có trận thì snapshot null; không có gì để báo thì không có message', () => {
  const e = env();
  e.player('A');
  assert.deepEqual(e.mgr.resume('A'), { ok: true, snapshot: null });
  assert.deepEqual(e.mgr.resume('khong-co'), { ok: true, snapshot: null });
});

test('resume: trong sảnh (chưa khóa / đã khóa), có learned, warnings, hạn', () => {
  const e = env();
  const A = e.player('A', { loadout: LA }), B = e.player('B');
  const mid = startMatch(e, A, B);
  const t0 = e.clock.now();
  e.clock.advance(7000);
  let s = e.mgr.resume('A').snapshot;
  assert.equal(s.phase, 'lobby'); assert.equal(s.matchId, mid); assert.equal(s.mode, 'balanced');
  assert.equal(s.turn, 0); assert.equal(s.deadlineAt, t0 + R.LOADOUT_MS);
  assert.deepEqual(s.you.loadout, LA); assert.deepEqual(s.you.learned, ALL);
  assert.equal('loadout' in s.op, false, 'bộ chiêu đối thủ chưa công bố');
  assert.equal(s.loadouts, null); assert.equal(s.myPick, null); assert.equal(s.opLocked, false); assert.equal(s.lastReveal, null);
  assert.equal(s.myLocked, false);
  assert.deepEqual(s.legal, []); assert.equal(s.forced, null);
  assert.equal(s.state.you.hp, R.HP); assert.equal(s.state.op.hp, R.HP);
  const mine = ['trong-quyen', 'thiet-bich', 'tat-phong-quyen', 'nhu-van-bo'];
  e.mgr.setLoadout('A', mid, mine);
  s = e.mgr.resume('A').snapshot;
  assert.equal(s.myLocked, true);
  assert.deepEqual(s.you.loadout, mine);
  assert.equal(s.opLocked, false);
  assert.equal(e.mgr.resume('B').snapshot.opLocked, true, 'B thấy A đã khóa');
  assert.equal(e.mgr.resume('B').snapshot.myLocked, false);
});

test('resume: pha chọn có myPick của mình (không có chiêu đối thủ), opLocked, legal, forced', () => {
  const e = env();
  const { A, B, mid } = duel(e);
  let s = e.mgr.resume('A').snapshot;
  assert.equal(s.phase, 'choosing'); assert.equal(s.turn, 1); assert.equal(s.myPick, null); assert.equal(s.opLocked, false);
  assert.deepEqual(s.loadouts, { you: LA, op: LB });
  assert.equal(s.deadlineAt, turnOf(e, 'A').deadlineAt);
  assert.deepEqual(s.legal, turnOf(e, 'A').legal);
  assert.equal(s.lastReveal, null);
  assert.deepEqual(s.op.loadout, LB);
  pickFor(e, B, mid, 'nhu-van-bo');
  s = e.mgr.resume('A').snapshot;
  assert.equal(s.opLocked, true);
  assert.equal(s.myPick, null);
  assert.equal(JSON.stringify(s).includes('nhu-van-bo'), true, 'chỉ trong bộ chiêu đã công bố');
  const noLoadouts = { ...s, loadouts: null, op: { ...s.op, loadout: null } };
  assert.equal(JSON.stringify(noLoadouts).includes('nhu-van-bo'), false, 'ngoài bộ chiêu công bố không có chiêu đã chọn của đối thủ');
  pickFor(e, A, mid, 'thiet-bich');                       // đóng lượt → reveal
  const t = e.mgr.resume('B').snapshot;
  assert.equal(t.phase, 'reveal');
});

test('resume: pha chọn của người đã khóa; người tụ lực được tự khóa và không lộ cho đối thủ', () => {
  const e = env();
  const l = ['tu-luc-pha-son', 'thiet-bich', 'trong-quyen', 'tat-phong-quyen'];
  const { A, B, mid } = duel(e, 'balanced', l, LB, { level: 9 }, { level: 9 });
  pickFor(e, A, mid, 'trong-quyen');
  const sa = e.mgr.resume('A').snapshot, sb = e.mgr.resume('B').snapshot;
  assert.equal(sa.myPick, 'trong-quyen'); assert.equal(sa.opLocked, false);
  assert.equal(sb.myPick, null); assert.equal(sb.opLocked, true);
  pickFor(e, B, mid, 'nhu-van-bo');
  // đưa sang trận có tụ lực
  const e2 = env();
  const d = duel(e2, 'balanced', l, LB, { level: 9 }, { level: 9 });
  pickFor(e2, d.A, d.mid, 'tu-luc-pha-son'); pickFor(e2, d.B, d.mid, 'nhu-van-bo'); e2.clock.advance(R.REVEAL_MS);
  const ra = e2.mgr.resume('A').snapshot, rb = e2.mgr.resume('B').snapshot;
  assert.equal(ra.forced, 'tu-luc-pha-son'); assert.deepEqual(ra.legal, ['tu-luc-pha-son']);
  assert.equal(ra.myPick, 'tu-luc-pha-son', 'đang tụ lực tự khóa');
  assert.equal(rb.opLocked, false, 'tự khóa do tụ lực không lộ cho đối thủ');
  assert.equal(rb.forced, null);
});

test('resume: pha lật chiêu có lastReveal đúng góc nhìn và hạn là nextAt', () => {
  const e = env();
  const { A, B, mid } = duel(e);
  pickFor(e, A, mid, 'trong-quyen'); pickFor(e, B, mid, 'nhu-van-bo');
  e.clock.advance(1000);
  const sa = e.mgr.resume('A').snapshot, sb = e.mgr.resume('B').snapshot;
  assert.equal(sa.phase, 'reveal'); assert.equal(sa.turn, 1);
  assert.deepEqual(sa.lastReveal, e.lastOf('A', 'pk:reveal'));
  assert.deepEqual(sb.lastReveal, e.lastOf('B', 'pk:reveal'));
  assert.equal(sa.deadlineAt, e.lastOf('A', 'pk:reveal').nextAt);
  assert.deepEqual(sa.state, e.lastOf('A', 'pk:reveal').state);
  assert.deepEqual(sa.legal, []); assert.equal(sa.forced, null);
  assert.equal(sa.myPick, 'trong-quyen');
  // sau khi sang lượt 2 thì lastReveal = null
  e.clock.advance(R.REVEAL_MS);
  assert.equal(e.mgr.resume('A').snapshot.lastReveal, null);
  assert.equal(e.mgr.resume('A').snapshot.phase, 'choosing');
  assert.equal(e.mgr.resume('A').snapshot.turn, 2);
});

test('resume sau khởi động lại: con trỏ trận còn mà trận không còn → báo hủy, xóa con trỏ, chỉ báo một lần', () => {
  const e = env();
  e.player('A');
  e.active.set('A', 4242);
  const r = e.mgr.resume('A');
  assert.deepEqual(r, { ok: true, snapshot: null, message: 'Trận trước đã bị hủy vì máy chủ khởi động lại. Không ai bị tính thua.' });
  assert.equal(e.active.has('A'), false);
  assert.deepEqual(e.mgr.resume('A'), { ok: true, snapshot: null });
  assert.equal(e.results.length, 0);
});

test('buff: xem trước lúc mời, chụp một lần lúc nhận lời và giữ suốt trận', () => {
  const e = env();
  const A = e.player('A'), B = e.player('B');
  e.buffIn.set('A', { Lc: 6, Lq: 0, Ld: 9 });
  e.buffIn.set('B', { Lc: 0, Lq: 4, Ld: 0 });
  const inv = e.mgr.invite('A', B.pid, 'buff');
  const prev = e.lastOf('B', 'pk:invited').buffs;
  assert.equal(prev.you.Lq, 4); assert.equal(prev.op.Lc, 6); assert.equal(prev.op.Ld, 9);
  assert.deepEqual(Object.keys(prev.you).sort(), ['Lc', 'Ld', 'Lq', 'defP', 'dodgeB', 'labels', 'offExt']);
  assert.ok(prev.op.labels.length >= 1);
  // đổi công đức / hết giờ hào quang TRƯỚC khi nhận lời: bản chính thức lấy lúc nhận
  e.buffIn.set('A', { Lc: 2, Lq: 0, Ld: 0 });
  e.mgr.respond('B', inv.inviteId, true);
  const lob = e.lastOf('A', 'pk:lobby');
  assert.equal(lob.buffs.you.Lc, 2); assert.equal(lob.buffs.you.Ld, 0);
  assert.equal(lob.buffs.op.Lq, 4);
  assert.deepEqual(e.lastOf('B', 'pk:lobby').buffs.op, lob.buffs.you);
  const mid = lob.matchId;
  lockBoth(e, A, B, mid);
  const t1 = turnOf(e, 'A');
  const defA = t1.state.you.defP, offB = t1.state.op.offExt;
  assert.ok(defA > 0 && offB > 0);
  // sau khi nhận lời đổi hết đầu vào: không ảnh hưởng
  e.buffIn.set('A', { Lc: 6, Lq: 4, Ld: 9 }); e.buffIn.set('B', { Lc: 0, Lq: 0, Ld: 0 });
  pickFor(e, A, mid, 'thiet-bich'); pickFor(e, B, mid, 'tat-phong-quyen'); e.clock.advance(R.REVEAL_MS);
  const t2 = turnOf(e, 'A');
  assert.equal(t2.state.you.defP, defA); assert.equal(t2.state.op.offExt, offB);
  const s = e.mgr.resume('A').snapshot;
  assert.equal(s.buffs.you.Lc, 2); assert.equal(s.buffs.op.Lq, 4);
  // bản lưu có buff của hai bên
  e.mgr.forfeit('A', mid);
  assert.equal(e.saved[0].mode, 'buff');
  assert.equal(e.saved[0].buffs.a.Lc, 2); assert.equal(e.saved[0].buffs.b.Lq, 4);
});

test('mọi chế độ kể cả token balanced cũ bắt buộc dùng buff', () => {
  const e = env();
  const A = e.player('A'), B = e.player('B');
  e.buffIn.set('A', { Lc: 6, Lq: 4, Ld: 9 });
  e.mgr.invite('A', B.pid, 'balanced');
  assert.equal(e.lastOf('B', 'pk:invited').buffs.op.Ld, 9);
  e.mgr.respond('B', e.lastOf('B', 'pk:invited').inviteId, true);
  const mid = e.lastOf('A', 'pk:lobby').matchId;
  lockBoth(e, A, B, mid);
  assert.ok(turnOf(e, 'A').state.you.offExt > 0);
  assert.equal(e.mgr.resume('A').snapshot.buffs.you.Lq, 4);
});

test('buff: buffInputsOf chỉ được gọi lúc mời (xem trước) và lúc nhận lời, không gọi giữa trận', () => {
  let calls = 0;
  const e = env({ deps: { buffInputsOf: () => { calls++; return { Lc: 3, Lq: 0, Ld: 0 }; } } });
  const A = e.player('A'), B = e.player('B');
  const mid = startMatch(e, A, B, 'buff');
  const afterAccept = calls;
  assert.equal(afterAccept, 4, '2 lần xem trước + 2 lần chụp');
  lockBoth(e, A, B, mid);
  playOut(e, A, B, mid);
  assert.equal(calls, afterAccept);
});

test('timeScale: nhân vào mọi mốc giờ (mời, sảnh, lượt, lật chiêu, cooldown, both-away)', () => {
  const k = 0.1;
  const e = env({ config: { timeScale: k } });
  const A = e.player('A'), B = e.player('B');
  const t0 = e.clock.now();
  const inv = e.mgr.invite('A', B.pid, 'balanced');
  assert.equal(inv.expiresAt, t0 + R.INVITE_MS * k);
  assert.equal(e.mgr.invite('A', B.pid, 'balanced').ok, false);
  e.clock.advance(R.INVITE_MS * k);
  assert.equal(e.lastOf('A', 'pk:invite:closed').reason, 'expired');
  assert.equal(e.mgr.invite('A', B.pid, 'balanced').ok, true, 'cooldown 10 giây cũng nhân tỉ lệ (1 giây)');
  const mid = (e.mgr.respond('B', e.lastOf('B', 'pk:invited').inviteId, true), e.lastOf('A', 'pk:lobby').matchId);
  const lob = e.lastOf('A', 'pk:lobby');
  assert.equal(lob.loadoutMs, R.LOADOUT_MS * k);
  assert.equal(lob.deadlineAt, e.clock.now() + R.LOADOUT_MS * k);
  e.clock.advance(R.LOADOUT_MS * k);
  const t1 = turnOf(e, 'A');
  assert.equal(t1.turn, 1);
  assert.equal(t1.deadlineAt, e.clock.now() + R.TURN_MS * k);
  e.clock.advance(R.TURN_MS * k);
  const rv = e.lastOf('A', 'pk:reveal');
  assert.equal(rv.nextAt, e.clock.now() + R.REVEAL_MS * k);
  e.clock.advance(R.REVEAL_MS * k);
  assert.equal(turnOf(e, 'A').turn, 2);
  // từ chối: 5 phút nhân tỉ lệ
  e.mgr.forfeit('A', mid);
  e.clock.advance(1000);
  const i2 = e.mgr.invite('A', B.pid, 'balanced');
  e.mgr.respond('B', i2.inviteId, false);
  e.clock.advance(5 * 60000 * k - 1000);
  assert.equal(e.mgr.invite('A', B.pid, 'balanced').ok, false);
  e.clock.advance(1000);
  assert.equal(e.mgr.invite('A', B.pid, 'balanced').ok, true);
  // timeScale sai (âm, 0, chữ) thì về 1
  for (const bad of [0, -2, 'x', NaN, null]) {
    const e2 = env({ config: { timeScale: bad } });
    e2.player('A'); const b = e2.player('B');
    assert.equal(e2.mgr.invite('A', b.pid, 'balanced').expiresAt, e2.clock.now() + R.INVITE_MS);
  }
});

test('shutdown: dọn mọi hẹn giờ (lời mời, sảnh, lượt, lật chiêu, thăm dò), không phát gì thêm', () => {
  const e = env();
  const [A, B, C, D, F, G, H, I] = ['A', 'B', 'C', 'D', 'F', 'G', 'H', 'I'].map(u => e.player(u));
  startMatch(e, A, B);                                   // đang ở sảnh
  const m2 = startMatch(e, C, D); lockBoth(e, C, D, m2); // đang chọn chiêu
  const m3 = startMatch(e, G, H); lockBoth(e, G, H, m3); // đang lật chiêu
  pickFor(e, G, m3, 'trong-quyen'); pickFor(e, H, m3, 'nhu-van-bo');
  assert.equal(e.mgr.resume('G').snapshot.phase, 'reveal');
  assert.equal(e.mgr.invite('F', I.pid, 'balanced').ok, true);   // lời mời đang chờ
  assert.equal(e.mgr.stats().matches, 3);
  assert.equal(e.clock.pending(), 7, 'sảnh 2 + lượt 2 + lật 2 + lời mời 1');
  const before = e.sent.length;
  assert.equal(e.mgr.shutdown().ok, true);
  assert.equal(e.clock.pending(), 0);
  e.clock.advance(10 * 60000);
  assert.equal(e.sent.length, before, 'sau shutdown không phát gì');
  assert.equal(e.active.get('A') != null, true, 'giữ con trỏ trận để báo "bị hủy" sau khi khởi động lại');
  assert.equal(e.results.length, 0);
  assert.equal(e.saved.length, 0);
  assert.equal(e.mgr.join('A', { pid: 1, name: 'x', look: null }).ok, false);
  assert.equal(e.mgr.invite('F', I.pid, 'balanced').ok, false);
  assert.deepEqual(e.mgr.stats(), { players: 0, matches: 0, invites: 0 });
  assert.equal(e.mgr.shutdown().ok, true, 'gọi lại vô hại');
});

test('chịu lỗi: emit ném lỗi, saveMatch ném lỗi, recordResult ném lỗi → trận vẫn kết thúc và dọn sạch', () => {
  const e = env({ deps: { recordResult: () => { throw new Error('hỏng ghi'); } } });
  const { A, B, mid } = duel(e);
  e.hooks.emitThrows = (uid, ev) => uid === 'A' && ev === 'pk:reveal';
  e.hooks.saveThrows = true;
  pickFor(e, A, mid, 'trong-quyen'); pickFor(e, B, mid, 'nhu-van-bo');
  e.clock.advance(R.REVEAL_MS);
  assert.equal(turnOf(e, 'B').turn, 2, 'lỗi gửi cho A không cản B');
  e.mgr.forfeit('A', mid);
  assert.equal(e.mgr.hasMatch('A'), false);
  assert.equal(e.lastOf('B', 'pk:end').reason, 'forfeit');
  assert.equal(e.active.size, 0);
  assert.equal(e.clock.pending(), 0);
  assert.ok(e.logs.length >= 3, 'lỗi được ghi log');
});

test('chịu lỗi: lỗi bất ngờ trong hẹn giờ không làm sập, trận bị hủy gọn (void)', () => {
  const e = env({ deps: { rngFor: () => { throw new Error('rng hỏng'); } } });
  const A = e.player('A'), B = e.player('B');
  const mid = startMatch(e, A, B);
  assert.doesNotThrow(() => lockBoth(e, A, B, mid));
  assert.equal(e.mgr.hasMatch('A'), false);
  assert.equal(e.lastOf('A', 'pk:end').reason, 'void');
  assert.equal(e.results.length, 0);
  assert.equal(e.clock.pending(), 0);
  assert.equal(e.mgr.rowOf('A').st, 'free');
  // lỗi trong hẹn giờ sảnh
  const e2 = env({ deps: { rngFor: () => { throw new Error('rng hỏng'); } } });
  const C = e2.player('C'), D = e2.player('D');
  startMatch(e2, C, D);
  assert.doesNotThrow(() => e2.clock.advance(R.LOADOUT_MS));
  assert.equal(e2.mgr.hasMatch('C'), false);
  assert.equal(e2.clock.pending(), 0);
});

test('chịu lỗi: fighterOf / buffInputsOf / isOnline / isBlocked ném lỗi thì không sập', () => {
  const boom = () => { throw new Error('hỏng'); };
  const e = env({ deps: { buffInputsOf: boom, isBlocked: boom, isOnline: boom } });
  const A = e.player('A'), B = e.player('B');
  const mid = startMatch(e, A, B, 'buff');
  lockBoth(e, A, B, mid);
  assert.equal(turnOf(e, 'A').state.you.defP, 0);
  e.clock.advance(R.BOTH_AWAY_MS + 5000);               // isOnline hỏng ⇒ coi như còn online, không hủy oan
  assert.equal(e.mgr.hasMatch('A'), true);
  const e2 = env({ deps: { fighterOf: boom } });
  const r = e2.mgr.join('A', { pid: 1, name: 'x', look: null });
  assert.equal(r.ok, true);
  assert.equal(r.row.lv, 1);
});

/* ============================================================ duyệt ngẫu nhiên ============================================================ */

test('ngẫu nhiên: cả trăm trận với bot chọn bừa luôn kết thúc, không ném lỗi, không để hẹn giờ mồ côi', () => {
  const N = 120;
  const e = env({ config: { maxMatches: N } });
  const rnd = lcg(20260506);
  const pairs = [];
  for (let i = 0; i < N; i++) {
    const level = 1 + Math.floor(rnd() * 10);
    const learnedAll = rnd() < 0.5;
    const learned = learnedAll ? ALL.slice() : M.STARTERS.slice();
    const A = e.player('a' + i, { level, learned, pid: 100 + i * 2 }), B = e.player('b' + i, { level: 1 + Math.floor(rnd() * 10), learned: ALL.slice(), pid: 101 + i * 2 });
    const mode = rnd() < 0.5 ? 'buff' : 'balanced';
    if (mode === 'buff') { e.buffIn.set(A.uid, { Lc: Math.floor(rnd() * 7), Lq: Math.floor(rnd() * 5), Ld: Math.floor(rnd() * 10) }); e.buffIn.set(B.uid, { Lc: Math.floor(rnd() * 7), Lq: Math.floor(rnd() * 5), Ld: Math.floor(rnd() * 10) }); }
    const inv = e.mgr.invite(A.uid, B.pid, mode);
    assert.equal(inv.ok, true, inv.reason);
    assert.equal(e.mgr.respond(B.uid, inv.inviteId, true).ok, true);
    pairs.push({ A, B, mid: e.lastOf(A.uid, 'pk:lobby').matchId, seen: { a: 0, b: 0 }, quirk: rnd(), locked: false });
  }
  assert.equal(e.mgr.stats().matches, N);
  const seenEnd = new Set();
  for (let step = 0; step < 4000 && e.mgr.stats().matches > 0; step++) {
    for (const P of pairs) {
      if (!e.mgr.hasMatch(P.A.uid)) continue;
      const lobby = e.last.get(P.A.uid)['pk:lobby'];
      if (!P.locked && !e.last.get(P.A.uid)['pk:turn']) {
        // sảnh: ngẫu nhiên khóa, khóa sai hay bỏ qua
        const roll = rnd();
        if (roll < 0.3) e.mgr.setLoadout(P.A.uid, P.mid, lobby.you.loadout);
        else if (roll < 0.4) e.mgr.setLoadout(P.B.uid, P.mid, ['x', 1, null, {}]);
        else if (roll < 0.5) e.mgr.setLoadout(P.B.uid, P.mid, e.last.get(P.B.uid)['pk:lobby'].you.loadout);
        P.locked = true;
      }
      for (const [who, key] of [[P.A, 'a'], [P.B, 'b']]) {
        const t = e.last.get(who.uid)['pk:turn'];
        if (!t || t.turn <= P.seen[key] || !e.mgr.hasMatch(who.uid)) continue;
        P.seen[key] = t.turn;
        const roll = rnd();
        if (roll < 0.7) e.mgr.pick(who.uid, P.mid, t.turn, randomPick(t, rnd));
        else if (roll < 0.78) e.mgr.pick(who.uid, P.mid, t.turn, ['zzz', null, 5, {}][Math.floor(rnd() * 4)]);
        else if (roll < 0.79) e.mgr.forfeit(who.uid, P.mid);
        else if (roll < 0.80) { e.online.delete(who.uid); e.mgr.leave(who.uid, rnd() < 0.5 ? 'left' : 'disconnect'); }
      }
      if (P.quirk < 0.05 && e.mgr.hasMatch(P.A.uid)) { e.online.delete(P.A.uid); e.online.delete(P.B.uid); }
    }
    e.clock.advance(1500);
  }
  assert.equal(e.mgr.stats().matches, 0, 'mọi trận phải kết thúc');
  for (const P of pairs) {
    assert.equal(e.count(P.A.uid, 'pk:end'), 1, 'mỗi người nhận pk:end đúng một lần');
    assert.equal(e.count(P.B.uid, 'pk:end'), 1);
    seenEnd.add(e.lastOf(P.A.uid, 'pk:end').reason);
  }
  assert.equal(e.saved.length, N);
  assert.equal(e.active.size, 0);
  assert.equal(e.mgr.stats().invites, 0);
  e.clock.advance(10 * 60000);
  assert.equal(e.clock.pending(), 0, 'không còn hẹn giờ mồ côi');
  assert.equal(e.logs.length, 0, 'không có lỗi nào trong hẹn giờ: ' + e.logs.slice(0, 3).join(' | '));
  // nhất quán thắng / thua
  const wins = e.results.filter(x => x.r === 'win').length, losses = e.results.filter(x => x.r === 'loss').length;
  assert.equal(wins, losses);
  assert.equal(e.results.filter(x => x.r === 'draw').length % 2, 0);
  for (const rec of e.saved) {
    assert.ok(rec.log.length <= 60);
    assert.ok(['ko', 'double-ko', 'turn-limit', 'forfeit', 'idle-forfeit', 'both-away', 'void'].includes(rec.reason), rec.reason);
    if (rec.reason === 'void' || rec.reason === 'both-away') assert.equal(rec.result, 'void');
  }
  const voids = e.saved.filter(x => x.result === 'void').length;
  assert.equal(e.results.length, (N - voids) * 2, 'void không ghi thắng thua');
  assert.ok(seenEnd.size >= 3, 'cần đủ nhiều kiểu kết thúc: ' + [...seenEnd].join());
  assert.equal(JSON.stringify(e.sent).includes('seed-'), false);
});

test('ngẫu nhiên: seed cố định cho cùng kết quả (tái lập được từ bản lưu)', () => {
  const runOnce = () => {
    const e = env({ deps: { newSeed: () => 'cố-định' } });
    const A = e.player('A', { loadout: LA }), B = e.player('B', { loadout: LB });
    const mid = startMatch(e, A, B);
    lockBoth(e, A, B, mid);
    playOut(e, A, B, mid, lcg(99));
    return e.saved[0];
  };
  const x = runOnce(), y = runOnce();
  assert.deepEqual(x.log, y.log);
  assert.equal(x.reason, y.reason);
  const { Duel } = require('../lib/pk/engine');
  const d = new Duel({ seed: x.seed, a: { level: 3, loadout: LA }, b: { level: 3, loadout: LB } });
  for (const t of x.log) { const s = d.step(t.picks.a.skill === M.IDLE_ID ? null : t.picks.a.skill, t.picks.b.skill === M.IDLE_ID ? null : t.picks.b.skill); assert.deepEqual(s.events, t.events); }
});

test('rngFor tiêm vào được: dãy cố định ép kết quả né / đỡ', () => {
  const e = env({ deps: { rngFor: () => fromSequence([0.0, 0.5, 0.5, 0.5], 0.5) } });
  const { A, B, mid } = duel(e);
  pickFor(e, A, mid, 'trong-quyen'); pickFor(e, B, mid, 'nhu-van-bo');
  const rv = e.lastOf('A', 'pk:reveal');
  const dodge = rv.events.find(x => x.k === 'dodge');
  assert.equal(dodge.ok, true, 'số 0.0 luôn nhỏ hơn xác suất ⇒ né được');
});

test("leave('left') khi còn ở sảnh cũng chỉ hủy trận, không tính thua", () => {
  const e = env();
  const A = e.player('A'), B = e.player('B');
  startMatch(e, A, B);
  e.mgr.leave('B', 'left');
  assert.equal(e.lastOf('A', 'pk:end').reason, 'void');
  assert.equal(e.results.length, 0);
  assert.equal(e.mgr.rowOf('A').st, 'free');
});

test('bộ chiêu mặc định khi hết giờ sảnh: chiêu bậc thấp, và luôn có ít nhất một đòn công nếu học được', () => {
  const e = env();
  // 3 chiêu nhập môn đều không phải đòn công, thêm Kim Chung (bậc 2) và Liên Hoàn Cước (đòn công, bậc 3)
  const learned = ['thiet-bich', 'anh-bo-ho-than', 'nhu-van-bo', 'kim-chung-trao', 'khinh-than-bo', 'lien-hoan-cuoc'];
  const A = e.player('A'), B = e.player('B', { learned });
  startMatch(e, A, B);
  const lb = e.lastOf('B', 'pk:lobby');
  assert.deepEqual(lb.you.loadout, ['thiet-bich', 'anh-bo-ho-than', 'nhu-van-bo', 'lien-hoan-cuoc']);
  assert.ok(lb.you.loadout.some(id => M.isAttacking(M.SKILLS[id])));
  // học đủ cả 15 chiêu mà chưa lưu bộ: không bị đẩy vào trận toàn thủ
  const e2 = env();
  const C = e2.player('C'), D = e2.player('D');
  startMatch(e2, C, D);
  assert.ok(e2.lastOf('C', 'pk:lobby').you.loadout.some(id => M.isAttacking(M.SKILLS[id])));
});

test('người rớt mạng bị xử thua lúc vắng: vào lại được báo kết quả một lần', () => {
  const e = env();
  const { A, B, mid } = duel(e);
  e.online.delete('B');
  for (let i = 0; i < 3; i++) { pickFor(e, A, mid, 'dieu-tuc'); e.clock.advance(R.TURN_MS); if (e.mgr.hasMatch('A')) e.clock.advance(R.REVEAL_MS); }
  assert.equal(e.mgr.hasMatch('A'), false);
  assert.equal(e.results.find(x => x.uid === 'B').r, 'loss');
  e.online.add('B');
  const r1 = e.mgr.resume('B');
  assert.equal(r1.ok, true); assert.equal(r1.snapshot, null);
  assert.match(r1.message, /bạn thua/);
  assert.match(r1.message, /quá giờ/);
  assert.equal(e.mgr.resume('B').message, undefined, 'chỉ báo một lần');
  assert.equal(e.mgr.resume('A').message, undefined, 'người còn online lúc kết thúc đã nhận pk:end nên không báo lại');
});
