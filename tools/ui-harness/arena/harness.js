/*
 * Trang thử Sân đấu: máy chủ giả (FakeSocket) chạy lại các trận mẫu sinh bằng engine thật (fixtures.json).
 * Mở: node tools/ui-harness/serve.js 4174  →  http://127.0.0.1:4174/harness/arena/
 * Tham số: ?login=1 (bắt đăng nhập)  ?players=crowded|few|empty  ?offset=ms (lệch giờ máy chủ)  ?nopanel=1  ?nostart=1  ?reduced đã có sẵn qua emulate của Playwright.
 *          ?jump=A:choosing:3  (vào thẳng giữa trận: tên trận : pha lobby|choosing|reveal : số lượt)  &myPick=...  &opLocked=1  &buffs=mid
 * window.H là tay lái cho kiểm tra tự động và thử bằng tay.
 */
(async function () {
  'use strict';
  const q = new URLSearchParams(location.search);
  const fx = await (await fetch('/harness/arena/fixtures.json')).json();
  const offset = +(q.get('offset') || 0);
  const serverNow = () => Date.now() + offset;
  const M = window.MARTIAL;
  const ME = { pid: 101, name: fx.A.you.name, look: fx.A.you.look };
  const NAMES = ['Minh Tâm', 'Thanh Vân', 'Bảo An', 'Quảng Đức', 'Diệu Hạnh', 'Nguyên Phúc', 'Tuệ Minh', 'Từ Bi', 'An Nhiên', 'Nguyễn Hoàng Thiên Phúc', 'Trí Dũng', 'Ngọc Hân', 'Hải Đăng', 'Mai Phương'];
  const mkRow = (i, st) => ({ pid: 300 + i, name: NAMES[i % NAMES.length], look: { c: (i * 5) % 12, g: i % 2 ? 'nam' : 'nu', h: i % 4 }, lv: 1 + (i * 3) % 10, wins: (i * 7) % 31, losses: (i * 5) % 17, st });
  const rosterOf = kind => {
    if (kind === 'empty') return [];
    if (kind === 'few') return [mkRow(0, 'free'), mkRow(1, 'busy')];
    return NAMES.map((n, i) => mkRow(i, ['free', 'free', 'busy', 'free', 'dnd'][i % 5]));
  };
  const S = { players: rosterOf(q.get('players') || 'crowded'), dnd: false, blocks: [{ uid: 'u9', name: 'Tâm Bình' }, { uid: 'u8', name: 'Quảng Hải' }], place: 'hall', match: null, seq: 0 };
  const O = { startDelay: 0, auto: true, opDelay: 500, revealDelay: 250, revealMs: 6500, endDelay: 700, opLockMs: 1500, inviteOutcome: 'accept', inviteDelay: 1000, lobbyAuto: true, fail: {} };
  const timers = [];
  const later = (ms, fn) => { const t = setTimeout(fn, ms); timers.push(t); return t; };
  const failOr = (ev, fn) => { if (O.fail[ev]) { const a = O.fail[ev]; delete O.fail[ev]; return a; } return fn(); };
  const toastEl = document.getElementById('toast'), toasts = [];
  let toastT = 0;
  const host = {
    toast(t) { toasts.push(t); toastEl.textContent = t; toastEl.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove('show'), 2600); },
    serverNow, goto: n => Places.go(n),
    cfg: () => ({ martial: { enabled: true, pk: true, speedup: false, loginRequired: !!H.loginRequired } }),
    auth: () => ({ enabled: !!H.loginRequired, signedIn: !H.loginRequired }),
    login() { H.loginClicks++; },
    me: () => ME, meritTotal: () => 1234, vnd: n => n + 'đ'
  };

  /* ---------- trận giả ---------- */
  function newMatch(name, o) {
    const f = fx[name || 'A'];
    return (S.match = {
      id: 'm' + (++S.seq), name: name || 'A', f, mode: o.buffs ? 'buff' : 'balanced', buffs: o.buffs ? fx.buff[o.buffs] : null,
      phase: 'lobby', idx: 0, cur: null, youLoad: null, picked: null, opLocked: false, lobbyDeadline: serverNow() + (o.lobbyMs || 30000), nextAt: null, you: f.you, op: f.op
    });
  }
  const send = (ev, d) => H.socket.receive(ev, d);
  function startLobby(o) {
    o = o || {};
    const m = newMatch(o.fixture, o);
    send('pk:lobby', { matchId: m.id, mode: m.mode, deadlineAt: m.lobbyDeadline, loadoutMs: o.lobbyMs || 30000, you: m.you, op: Object.assign({}, m.op), buffs: m.buffs });
    if (o.opReady !== false) later(o.opReady || O.opLockMs, () => { if (S.match === m && m.phase === 'lobby') { m.opLocked = true; send('pk:lobby:status', { matchId: m.id, opLocked: true }); maybeGo(m); } });
    later(m.lobbyDeadline - serverNow() + 300, () => { if (S.match === m && m.phase === 'lobby' && O.lobbyAuto) startTurn(m, 0); });
    return m;
  }
  // như máy chủ thật: hai bên khóa xong là pk:turn đi ngay, TRƯỚC cả ack của pk:loadout
  function maybeGo(m) {
    if (!(m.phase === 'lobby' && m.youLoad && m.opLocked)) return;
    if (O.startDelay > 0) later(O.startDelay, () => { if (S.match === m && m.phase === 'lobby') startTurn(m, 0); });   // chỉ để chụp được màn "hai bên đã sẵn sàng"
    else startTurn(m, 0);
  }
  function startTurn(m, idx) {
    const t = m.f.turns[idx];
    if (!t) return;
    m.idx = idx; m.cur = t; m.phase = 'choosing'; m.picked = null; m.opLocked = false; m.deadline = serverNow() + 20000;
    if (!m.youLoad) m.youLoad = m.f.you.loadout;
    const load = { you: m.youLoad, op: m.f.turns[0].loadouts.op };
    const legal = idx === 0 ? m.youLoad.filter(id => M.SKILLS[id].mana <= t.state.you.mana).concat([M.REST_ID]) : t.legal;
    m.curLegal = legal;
    const d = { matchId: m.id, turn: t.turn, deadlineAt: m.deadline, forced: t.forced, legal, state: t.state };
    if (idx === 0) d.loadouts = load;
    send('pk:turn', d);
    if (t.forced && O.auto) later(O.opDelay * 2, () => { if (S.match === m && m.phase === 'choosing' && m.cur === t) { m.picked = t.forced; lockOp(); later(O.revealDelay, reveal); } });   // máy chủ tự khóa bên đang tụ lực
  }
  function lockOp() { const m = S.match; if (!m || m.phase !== 'choosing') return; m.opLocked = true; send('pk:locked', { matchId: m.id, turn: m.cur.turn }); }
  function reveal() {
    const m = S.match;
    if (!m || m.phase !== 'choosing') return;
    const r = m.f.reveals[m.idx];
    m.phase = 'reveal'; m.nextAt = r.ended ? null : serverNow() + O.revealMs;
    send('pk:reveal', Object.assign({ matchId: m.id, nextAt: m.nextAt }, JSON.parse(JSON.stringify(r))));
    if (r.ended) { if (O.auto) later(O.endDelay, () => end(Object.assign({ matchId: m.id }, m.f.end))); }
    else if (O.auto) later(O.revealMs, () => { if (S.match === m && m.phase === 'reveal') startTurn(m, m.idx + 1); });
  }
  function end(d) { const m = S.match; if (m) m.phase = 'ended'; send('pk:end', Object.assign({ matchId: m && m.id }, d)); }
  const snapNow = () => {
    const m = S.match;
    if (!m || m.phase === 'ended') return null;
    const f = m.f, base = { matchId: m.id, mode: m.mode, you: { pid: f.you.pid, name: f.you.name, look: f.you.look, level: f.you.level, hpMax: 200, manaMax: f.you.manaMax, loadout: m.youLoad || f.you.loadout }, op: { pid: f.op.pid, name: f.op.name, look: f.op.look, level: f.op.level, hpMax: 200, manaMax: f.op.manaMax }, buffs: m.buffs };
    if (m.phase === 'lobby') { base.you.learned = f.you.learned; base.you.warnings = []; return Object.assign(base, { phase: 'lobby', turn: 0, deadlineAt: m.lobbyDeadline, state: null, loadouts: null, legal: [], forced: null, myPick: null, opLocked: m.opLocked, lastReveal: null, loadoutMs: 30000, myLocked: !!m.myLocked }); }
    const loads = { you: m.youLoad, op: f.turns[0].loadouts.op };
    if (m.phase === 'choosing') return Object.assign(base, { phase: 'choosing', turn: m.cur.turn, deadlineAt: m.deadline, state: m.cur.state, loadouts: loads, legal: m.curLegal, forced: m.cur.forced, myPick: m.cur.forced || m.picked, opLocked: m.opLocked, lastReveal: null });   // như máy chủ thật: lastReveal chỉ có ở pha reveal
    const r = f.reveals[m.idx];
    return Object.assign(base, { phase: 'reveal', turn: r.turn, deadlineAt: m.nextAt, state: r.state, loadouts: loads, legal: [], forced: null, myPick: null, opLocked: true, lastReveal: Object.assign({ matchId: m.id, nextAt: m.nextAt }, JSON.parse(JSON.stringify(r))) });
  };
  /** Vào thẳng giữa trận (cho kiểm tra vào lại). */
  function jump(name, phase, turnNo, o) {
    o = o || {};
    const m = newMatch(name, { buffs: o.buffs });
    m.youLoad = o.lobbyPick || m.f.you.loadout;
    if (phase === 'lobby') { m.lobbyDeadline = serverNow() + (o.left || 20000); m.opLocked = !!o.opLocked; return m; }
    m.idx = turnNo - 1; m.cur = m.f.turns[m.idx]; m.curLegal = m.idx === 0 ? m.f.turns[0].legal : m.cur.legal;
    if (phase === 'choosing') {
      m.phase = 'choosing'; m.deadline = serverNow() + (o.left || 14000); m.picked = o.myPick || null; m.opLocked = !!o.opLocked;
      if ((m.picked || m.cur.forced) && O.auto) later(O.opDelay, lockOp), later(O.opDelay + O.revealDelay, reveal);
    } else {
      m.phase = 'reveal'; m.nextAt = m.f.reveals[m.idx].ended ? null : serverNow() + (o.left || 2500);
      if (O.auto) { if (m.f.reveals[m.idx].ended) later((o.left || 2500), () => end(Object.assign({ matchId: m.id }, m.f.end))); else later(o.left || 2500, () => startTurn(m, m.idx + 1)); }
    }
    return m;
  }

  /* ---------- socket giả ---------- */
  const rowOf = pid => S.players.find(p => p.pid === pid);
  const handlers = {
    'place:set': d => {
      S.place = d.place;
      if (d.place !== 'arena') return { ok: true, place: d.place };
      return failOr('place:set', () => ({ ok: true, place: 'arena', arena: { players: S.players.map(p => Object.assign({}, p)), dnd: S.dnd, hasMatch: !!snapNow(), enabled: true } }));
    },
    'pk:resume': () => failOr('pk:resume', () => ({ ok: true, snapshot: snapNow(), message: O.resumeMessage || undefined })),
    'martial:state': () => ({ ok: true, profile: { learned: fx.A.you.learned, loadout: fx.A.you.loadout } }),
    'arena:dnd': d => failOr('arena:dnd', () => { S.dnd = !!d.on; return { ok: true, dnd: S.dnd }; }),
    'arena:blocks': () => failOr('arena:blocks', () => ({ ok: true, list: S.blocks.slice() })),
    'pk:block': d => failOr('pk:block', () => { const p = rowOf(d.pid); if (!p) return { ok: false, reason: 'Không thấy người này.' }; S.blocks.push({ uid: 'u' + p.pid, name: p.name }); return { ok: true }; }),
    'pk:unblock': d => failOr('pk:unblock', () => { S.blocks = S.blocks.filter(b => b.uid !== d.uid); return { ok: true }; }),
    'pk:invite': d => failOr('pk:invite', () => {
      const p = rowOf(d.toPid);
      if (!p) return { ok: false, reason: 'Người này vừa rời sân.' };
      const id = 'inv' + (++S.seq), exp = serverNow() + 20000;
      S.out = { id, pid: d.toPid, mode: d.mode };
      if (O.inviteOutcome === 'accept') later(O.inviteDelay, () => { if (S.out && S.out.id === id) { S.out = null; send('pk:invite:closed', { inviteId: id, reason: 'accepted' }); startLobby({ buffs: d.mode === 'buff' ? 'mid' : null }); } });
      else if (O.inviteOutcome === 'decline') later(O.inviteDelay, () => { if (S.out && S.out.id === id) { S.out = null; send('pk:invite:closed', { inviteId: id, reason: 'declined' }); } });
      else later(exp - serverNow(), () => { if (S.out && S.out.id === id) { S.out = null; send('pk:invite:closed', { inviteId: id, reason: 'expired' }); } });
      return { ok: true, inviteId: id, expiresAt: exp };
    }),
    'pk:invite:cancel': d => { if (S.out && S.out.id === d.inviteId) { S.out = null; later(50, () => send('pk:invite:closed', { inviteId: d.inviteId, reason: 'cancelled' })); return { ok: true }; } return { ok: false, reason: 'Lời mời không còn.' }; },
    'pk:respond': d => failOr('pk:respond', () => {
      const inv = S.incoming && S.incoming[d.inviteId];
      if (!inv) return { ok: false, reason: 'Lời mời không còn.' };
      delete S.incoming[d.inviteId];
      later(60, () => send('pk:invite:closed', { inviteId: d.inviteId, reason: d.accept ? 'accepted' : 'declined' }));
      if (d.accept) later(500, () => startLobby({ buffs: inv.mode === 'buff' ? 'mid' : null }));
      return { ok: true };
    }),
    'pk:loadout': d => failOr('pk:loadout', () => {
      const m = S.match;
      if (!m || d.matchId !== m.id || m.phase !== 'lobby') return { ok: false, reason: 'Sảnh đã đóng.' };
      const v = M.validateLoadout(d.skills, m.f.you.learned);
      if (!v.ok) return v;
      m.youLoad = d.skills.slice(); m.myLocked = true; maybeGo(m);
      return { ok: true, locked: true, warnings: M.loadoutWarnings(d.skills) };
    }),
    'pk:pick': d => failOr('pk:pick', () => {
      const m = S.match;
      if (!m || d.matchId !== m.id || m.phase !== 'choosing' || d.turn !== m.cur.turn) return { ok: false, reason: 'Lượt này đã qua.' };
      if (m.picked) return { ok: false, reason: 'Bạn đã khóa chiêu lượt này rồi.' };
      if (!m.curLegal.includes(d.skillId)) return { ok: false, reason: 'Không chọn được chiêu này.' };
      m.picked = d.skillId;
      if (O.auto) { later(O.opDelay, lockOp); later(O.opDelay + O.revealDelay, reveal); }
      return { ok: true, locked: true };
    }),
    'pk:forfeit': d => failOr('pk:forfeit', () => {
      const m = S.match;
      if (!m || d.matchId !== m.id) return { ok: false, reason: 'Không có trận nào để bỏ.' };
      m.phase = 'ended'; return { ok: true };
    })
  };
  const socket = new window.FakeSocket(handlers);
  socket.latency = +(q.get('latency') || 30);
  host.socket = socket;

  /* ---------- tay lái ---------- */
  const H = window.H = {
    socket, state: S, opts: O, fx, toasts, loginClicks: 0, loginRequired: false, host, serverNow,
    send, startLobby, startTurn: i => startTurn(S.match, i), lockOp, reveal, end, jump, snapNow,
    invite(o) {
      o = o || {};
      const id = 'in' + (++S.seq), from = Object.assign({ pid: 301, name: 'Thanh Vân', look: { c: 3, g: 'nu', h: 1 }, lv: 4, wins: 12, losses: 7 }, o.from || {});
      S.incoming = S.incoming || {}; S.incoming[id] = { mode: o.mode || 'balanced' };
      const buffs = o.mode === 'buff' ? (o.noBuffs ? null : fx.buff[o.buffs || 'mid']) : null;
      send('pk:invited', { inviteId: id, mode: o.mode || 'balanced', expiresAt: serverNow() + (o.ms || 20000), from, buffs });
      return id;
    },
    close(id, reason) { send('pk:invite:closed', { inviteId: id, reason }); },
    add(row) { S.players.push(row); send('arena:add', row); },
    del(pid) { S.players = S.players.filter(p => p.pid !== pid); send('arena:del', { pid }); },
    upd(pid, f) { const p = rowOf(pid); if (p) Object.assign(p, f); send('arena:upd', Object.assign({ pid }, f)); },
    row: mkRow,
    opReady() { const m = S.match; if (m && m.phase === 'lobby') { m.opLocked = true; send('pk:lobby:status', { matchId: m.id, opLocked: true }); maybeGo(m); } },
    open: () => Places.go('arena'),
    disconnect() { socket.connected = false; socket.receive('disconnect', 'transport close'); Places.setConnected(false); },
    reconnect() { socket.connected = true; socket.receive('connect'); Places.setConnected(true); return Places.resume(); },
    reset() { timers.forEach(clearTimeout); timers.length = 0; S.match = null; S.out = null; S.incoming = {}; },
    endKinds: {
      'win-ko': { result: 'win', reason: 'ko' }, 'lose-ko': { result: 'lose', reason: 'ko' }, 'draw-double': { result: 'draw', reason: 'double-ko' },
      'win-double': { result: 'win', reason: 'double-ko' }, 'lose-double': { result: 'lose', reason: 'double-ko' },
      'win-limit': { result: 'win', reason: 'turn-limit' }, 'lose-limit': { result: 'lose', reason: 'turn-limit' }, 'draw-limit': { result: 'draw', reason: 'turn-limit' },
      'forfeit-op': { result: 'win', reason: 'forfeit', who: 'op' }, 'forfeit-you': { result: 'lose', reason: 'forfeit', who: 'you' },
      'idle-op': { result: 'win', reason: 'idle-forfeit', who: 'op' }, 'idle-you': { result: 'lose', reason: 'idle-forfeit', who: 'you' },
      'both-away': { result: 'draw', reason: 'both-away' }, 'void': { result: 'draw', reason: 'void' }
    },
    sendEnd(kind) {
      const k = H.endKinds[kind], m = S.match, st = (m && m.cur && m.cur.state) || fx.A.turns[2].state;
      const rec = { wins: 13 + (k.result === 'win' ? 1 : 0), losses: 8 + (k.result === 'lose' ? 1 : 0), draws: 1 + (k.result === 'draw' && !['void', 'both-away'].includes(k.reason) ? 1 : 0) };
      end(Object.assign({ turns: (m && m.cur && m.cur.turn) || 5, state: { you: Object.assign({}, st.you, { hp: k.result === 'lose' ? 0 : 54 }), op: Object.assign({}, st.op, { hp: k.result === 'win' ? 0 : 88 }) }, record: rec }, k));
    }
  };
  H.loginClicks = 0; H.loginRequired = !!q.get('login');

  /* ---------- khởi động ---------- */
  Places.init({ setPlace: (name, cb) => socket.emit('place:set', { place: name }, cb), toast: host.toast });
  Arena.init(host);
  Places.register('arena', { el: document.getElementById('place-arena'), mod: Arena });
  document.getElementById('goArena').addEventListener('click', () => Places.go('arena'));
  const btns = document.getElementById('hxBtns');
  const addBtn = (t, fn) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'btn small'; b.textContent = t; b.addEventListener('click', fn); btns.appendChild(b); };
  addBtn('Mời đến (cân bằng)', () => H.invite()); addBtn('Mời đến (buff)', () => H.invite({ mode: 'buff' }));
  addBtn('Vào sảnh (buff)', () => H.startLobby({ buffs: 'mid' })); addBtn('Vào sảnh (cân bằng)', () => H.startLobby());
  addBtn('Ngắt mạng', () => H.disconnect()); addBtn('Nối lại', () => H.reconnect());
  Object.keys(H.endKinds).forEach(k => addBtn('Kết: ' + k, () => H.sendEnd(k)));
  if (q.get('nopanel')) document.getElementById('hx').hidden = true;
  const j = q.get('jump');
  if (j) { const [n, ph, t] = j.split(':'); jump(n, ph, +t || 1, { myPick: q.get('myPick') || null, opLocked: !!q.get('opLocked'), buffs: q.get('buffs') || null, left: +q.get('left') || 0 }); }
  if (!q.get('nostart')) await Places.go('arena');
  window.__ready = true;
})();
