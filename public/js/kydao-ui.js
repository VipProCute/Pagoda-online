/*
 * Kỳ Đạo · Bảng bàn cờ (KydaoUI): năm môn, đồng hồ và tính điểm vây.
 *
 * API công khai:
 *   KydaoUI.open(start, hooks)   mở bảng từ StartPayload (kd:start, hoặc `start` của ack kd:resume)
 *   KydaoUI.apply(event)         nhận kd:moved, kd:start, kd:marks, kd:end, kd:offer.
 *   KydaoUI.close()              đóng bảng và chip
 *   KydaoUI.isOpen()
 * hooks (đều tùy chọn):
 *   send(name, data, cb)  gửi socket (mặc định không làm gì)
 *   now()                 giờ máy chủ, ms (mặc định Date.now; nối vào Hall.serverNow)
 *   sound(kind)           'move' | 'capture' | 'check'
 *   onClose(), onMinimize(minimized:boolean)
 * Phần lõi thuần (không DOM) nằm ở KydaoUI.core để test trong Node.
 * Chữ do máy chủ/người dùng gửi chỉ gán bằng textContent (helper h() riêng của file này).
 */
(function (root, factory) {
  'use strict';
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.KydaoUI = api;
})(typeof self !== 'undefined' ? self : (typeof globalThis !== 'undefined' ? globalThis : this), function (root) {
  'use strict';

  const GAME_NAME = { chess: 'Cờ vua', xiangqi: 'Cờ tướng', jieqi: 'Cờ tướng úp', go: 'Cờ vây', gomoku: 'Caro' };
  const SIDE_NAME = { chess: { a: 'Trắng', b: 'Đen' }, xiangqi: { a: 'Đỏ', b: 'Đen' }, go: { a: 'Đen', b: 'Trắng' }, gomoku: { a: 'X', b: 'O' } };
  const PROMO_NAME = { q: 'Hậu', r: 'Xe', b: 'Tượng', n: 'Mã' };
  const SUPPORTED = { chess: 'KyChess', xiangqi: 'KyXiangqi', jieqi: 'KyXiangqi', go: 'KyGo', gomoku: 'KyGomoku' };
  const isGrid = game => game === 'go' || game === 'gomoku';
  const lastSquares = (game, move) => isGrid(game) ? (move === 'pass' ? [] : [move]) : [move.slice(0, 2), move.slice(2, 4)];

  function moduleFor(game) {
    const k = SUPPORTED[game];
    return k && root[k] ? root[k] : null;
  }

  /* ================= Lõi thuần ================= */

  /** Số ms còn lại của bên `side` tại giờ `now` (đồng hồ chỉ trừ cho bên đang tới lượt). */
  function clockRemaining(clock, side, now) {
    if (!clock) return 0;
    let ms = Number(clock[side]) || 0;
    if (clock.turn === side) ms -= Math.max(0, now - (Number(clock.turnStartedAt) || now));
    return Math.max(0, ms);
  }

  /**
   * Chốt đồng hồ lúc hết ván: trừ giờ đã trôi của bên đang đi, rồi bỏ lượt.
   * Hết giờ (`timeout`, result là bên thắng) thì bên thua về 0. Trả đồng hồ mới (không sửa bản gốc).
   */
  function settleClock(clock, now, result, reason) {
    if (!clock) return clock;
    const out = Object.assign({}, clock);
    if (clock.turn === 'a' || clock.turn === 'b') out[clock.turn] = clockRemaining(clock, clock.turn, now);
    if (reason === 'timeout' && (result === 'a' || result === 'b')) out[result === 'a' ? 'b' : 'a'] = 0;
    out.turn = null;
    return out;
  }

  function fmtClock(ms) {
    const s = Math.ceil(Math.max(0, ms) / 1000);
    return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
  }

  const sideOfPiece = ch => (ch === ch.toUpperCase() ? 'a' : 'b');
  const applyFn = mod => mod.apply || mod.play;

  function kingSquare(S, side) {
    const D = root.KydaoDraw;
    const want = side === 'a' ? 'K' : 'k';
    const n = S.game === 'chess' ? 8 : 9, rows = S.game === 'chess' ? 8 : 10;
    for (let r = 0; r < rows; r++) for (let c = 0; c < n; c++) {
      if (S.state.board[r * n + c] === want) return D.nameOf(S.game, c, r);
    }
    return null;
  }

  const NO_SKIN = () => ({ field: null, pieces: null });
  /** Chuẩn hóa skin của hai bên từ dữ liệu máy chủ; không có danh mục thì coi như mặc định. */
  function readSkins(raw) {
    const K = root.KydaoSkins, o = raw && typeof raw === 'object' ? raw : {};
    return { a: K ? K.normalize(o.a) : NO_SKIN(), b: K ? K.normalize(o.b) : NO_SKIN() };
  }
  /** Áp một gói kd:skin lên phiên. Trả true nếu gói hợp lệ và thuộc ván này. */
  function applySkin(S, ev) {
    if (!S || !ev || ev.gameId !== S.gameId || (ev.side !== 'a' && ev.side !== 'b')) return false;
    const K = root.KydaoSkins;
    S.skins[ev.side] = K ? K.normalize(ev) : NO_SKIN();
    return true;
  }
  /** Dựng phiên ván từ StartPayload. */
  function makeSession(start, mod) {
    const S = {
      mod, gameId: start.gameId, table: start.table == null ? null : start.table, game: start.game,
      rated: !!start.rated, pace: start.pace, you: start.you === 'a' || start.you === 'b' ? start.you : null,
      a: start.a || {}, b: start.b || {}, state: start.state, ply: Number(start.ply) || 0,
      moves: Array.isArray(start.moves) ? start.moves.map(x => ({ m: x.m, t: x.t, r: x.r })) : [],
      clock: start.clock || null, over: false, sel: null, targets: [], last: [], inCheck: false,
      offer: start.offer || null, downgraded: start.downgraded || null,
      marks: start.marks || null, win: [], zoom: 1, skins: readSkins(start.skins), jolt: null
    };
    if (S.moves.length) S.last = lastSquares(S.game, S.moves[S.moves.length - 1].m);
    if (S.game === 'chess' && mod.inCheck) S.inCheck = !!mod.inCheck(S.state);
    return S;
  }

  const sessionTurn = S => S.mod.turn(S.state);
  const canPlay = S => !!S.you && !S.over && !S.marks && sessionTurn(S) === S.you;

  function legalFrom(S, from) {
    return S.mod.legalMoves(S.state).filter(m => m.slice(0, 2) === from);
  }

  /**
   * Chạm một ô. Trả về một trong:
   *  { kind:'none' } · { kind:'select', from, targets } · { kind:'clear' }
   *  { kind:'move', move } · { kind:'promo', from, to, options:[q,r,b,n] }
   */
  function tapSquare(S, sq) {
    if (S.game === 'go' && S.marks && S.you && !S.over && sq) {
      const p = root.KydaoDraw.parseSq('go', sq, S.state.size);
      return p && S.state.board[p.row * S.state.size + p.col] ? { kind: 'mark', point: sq } : { kind: 'none' };
    }
    if (!sq || !canPlay(S)) return { kind: 'none' };
    if (isGrid(S.game)) return S.mod.legalMoves(S.state).includes(sq) ? { kind: 'move', move: sq } : { kind: 'none' };
    const D = root.KydaoDraw;
    const q = D.parseSq(S.game, sq);
    const piece = q ? S.state.board[D.boardIndex(S.game, q.col, q.row)] : null;
    if (piece && sideOfPiece(piece) === S.you) {
      if (S.sel === sq) { S.sel = null; S.targets = []; return { kind: 'clear' }; }
      const list = legalFrom(S, sq);
      S.sel = sq;
      S.targets = Array.from(new Set(list.map(m => m.slice(2, 4))));
      return { kind: 'select', from: sq, targets: S.targets };
    }
    if (S.sel && S.targets.indexOf(sq) >= 0) {
      const cands = legalFrom(S, S.sel).filter(m => m.slice(2, 4) === sq);
      const from = S.sel;
      if (cands.length === 1) return { kind: 'move', move: cands[0] };
      if (cands.length > 1) return { kind: 'promo', from, to: sq, options: cands.map(m => m[4]).filter(Boolean) };
    }
    if (S.sel) { S.sel = null; S.targets = []; return { kind: 'clear' }; }
    return { kind: 'none' };
  }

  /** Áp một nước lên phiên (đã có `text`). Trả { ok, reason?, info? }. Không sửa gì nếu lỗi. */
  function pushMove(S, move, text, reveal, clock, check) {
    const r = S.game === 'jieqi' ? applyFn(S.mod)(S.state, move, reveal) : applyFn(S.mod)(S.state, move);
    if (!r || !r.ok) return { ok: false, reason: (r && r.reason) || 'Nước đi không hợp lệ.' };
    S.state = r.state;
    S.ply += 1;
    S.moves.push({ m: move, t: text, r: reveal || undefined });
    S.last = lastSquares(S.game, move);
    if (r.info && r.info.line) S.win = r.info.line;
    S.inCheck = check !== undefined ? !!check : !!(r.info && r.info.check);
    if (clock) S.clock = clock;
    S.sel = null; S.targets = [];
    return { ok: true, info: r.info || {} };
  }

  /**
   * Xử một gói kd:moved theo quy tắc KY-DAO-GIAO-THUC §6.1.1.
   * Trả 'applied' | 'dup' | 'synced' | 'gap' | 'bad'.
   */
  function handleMoved(S, ev) {
    const ply = Number(ev.ply);
    if (!Number.isInteger(ply)) return 'bad';
    if (ply < S.ply) return 'dup';
    if (ply === S.ply) { // gói của chính nước mình vừa áp thử: chỉ đồng bộ đồng hồ và chữ
      if (ev.clock) S.clock = ev.clock;
      if (S.moves.length && typeof ev.text === 'string' && S.moves[S.moves.length - 1].m === ev.move) S.moves[S.moves.length - 1].t = ev.text;
      return 'synced';
    }
    if (ply > S.ply + 1) return 'gap';
    const r = pushMove(S, ev.move, typeof ev.text === 'string' ? ev.text : ev.move, ev.reveal, ev.clock, !!ev.check);
    return r.ok ? 'applied' : 'gap';
  }

  const core = { clockRemaining, settleClock,fmtClock, makeSession, tapSquare, pushMove, handleMoved, canPlay, kingSquare, sideOfPiece, readSkins, applySkin };

  /* ================= Giao diện ================= */
  if (typeof document === 'undefined') return { core };

  function h(tag, attrs) {
    const el = document.createElement(tag);
    if (attrs) for (const k of Object.keys(attrs)) {
      const v = attrs[k];
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k.slice(0, 2) === 'on' && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : String(v));
    }
    for (let i = 2; i < arguments.length; i++) {
      const c = arguments[i];
      if (c == null || c === false) continue;
      el.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
    }
    return el;
  }

  const reduced = () => !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const VI_KEY = 'kydao.vi';
  const HIDE_KEY = 'kydao.hideFoeSkin';
  let hideFoe = false;
  try { hideFoe = root.localStorage && root.localStorage.getItem(HIDE_KEY) === '1'; } catch (e) { /* bỏ qua */ }
  const SKIN_KEY = 'kydao.skin';          // { field, pieces } người chơi ưa thích
  function loadPref() {
    try { const K = root.KydaoSkins; return K ? K.normalize(JSON.parse(root.localStorage.getItem(SKIN_KEY) || '{}')) : { field: null, pieces: null }; }
    catch (e) { return { field: null, pieces: null }; }
  }
  function savePref(p) { try { root.localStorage.setItem(SKIN_KEY, JSON.stringify(p)); } catch (e) { /* bỏ qua */ } }
  let pref = { field: null, pieces: null };
  let fieldSentAt = 0;                    // lần gần nhất gửi khai mở (ms), chặn bấm liên tục

  let ui = null;        // các phần tử DOM
  let S = null;         // phiên ván
  let hooks = {};
  let timer = 0, resizeFn = null, geom = null;
  let vi = false;
  try { vi = root.localStorage && root.localStorage.getItem(VI_KEY) === '1'; } catch (e) { /* bỏ qua */ }
  const pending = {};   // gameId → { at, evs:[] } cho kd:moved tới trước kd:start (§6.1.2)
  let minimized = false, resultTimer = 0, confirmOpen = false, rematchSent = false;

  const send = (name, data, cb) => { if (typeof hooks.send === 'function') hooks.send(name, data, cb || function () {}); else if (cb) cb({ ok: false }); };
  const now = () => (typeof hooks.now === 'function' ? hooks.now() : Date.now());
  const sound = k => { if (typeof hooks.sound === 'function') try { hooks.sound(k); } catch (e) { /* bỏ qua */ } };

  function say(text) { if (ui) ui.msg.textContent = text || ''; }
  function announce(text) { if (ui) ui.live.textContent = text; }

  function build() {
    const btn = (cls, label, fn, extra) => h('button', Object.assign({ type: 'button', class: 'kd-btn ' + (cls || ''), onclick: fn }, extra || {}), label);
    const el = {};
    el.title = h('div', { class: 'kd-title' });
    el.minBtn = h('button', { type: 'button', class: 'kd-icon', 'aria-label': 'Thu nhỏ bảng cờ', onclick: () => setMin(true) }, '–');
    el.closeBtn = h('button', { type: 'button', class: 'kd-icon', 'aria-label': 'Đóng bảng cờ', onclick: () => api.close() }, '✕');
    const player = which => {
      const p = { root: h('div', { class: 'kd-player kd-' + which }) };
      p.dot = h('span', { class: 'kd-dot' });
      p.name = h('span', { class: 'kd-pname' });
      p.elo = h('span', { class: 'kd-pelo' });
      p.clock = h('span', { class: 'kd-clock', 'aria-label': 'Đồng hồ' }, '--:--');
      p.root.append(p.dot, p.name, p.elo, p.clock);
      return p;
    };
    el.top = player('top');
    el.bot = player('bot');
    el.canvas = h('canvas', { class: 'kd-canvas', 'aria-label': 'Bàn cờ', role: 'img' });
    el.promo = h('div', { class: 'kd-promo', hidden: true });
    el.result = h('div', { class: 'kd-result', hidden: true, role: 'alertdialog', 'aria-label': 'Kết quả ván cờ' });
    el.viewport = h('div', { class: 'kd-viewport', tabindex: '0', 'aria-label': 'Bàn cờ; phóng to rồi vuốt hoặc kéo để xem các giao điểm' }, el.canvas);
    el.wrap = h('div', { class: 'kd-boardwrap' }, el.viewport, el.promo, el.result);
    el.scoreText = h('div', { class: 'kd-score', role: 'status' });
    el.passBtn = btn('', 'Bỏ lượt', () => { if (S && canPlay(S)) sendMove('pass'); });
    el.agreeBtn = btn('', 'Đồng ý điểm', () => scoringAct('kd:agree'));
    el.continueBtn = btn('', 'Đánh tiếp', () => scoringAct('kd:resume-play'));
    el.goBar = h('div', { class: 'kd-go' }, el.scoreText, h('div', { class: 'kd-actions' }, el.passBtn, el.agreeBtn, el.continueBtn));
    el.zoomBtn = btn('', 'Phóng to', () => { S.zoom = S.zoom === 1 ? 2.5 : 1; el.zoomBtn.textContent = S.zoom === 1 ? 'Phóng to' : 'Thu về'; el.zoomBtn.setAttribute('aria-pressed', String(S.zoom !== 1)); fit(); redraw(); });
    el.offerText = h('span', { class: 'kd-offer-text' });
    el.offer = h('div', { class: 'kd-offerbar', hidden: true }, el.offerText,
      btn('', 'Đồng ý', () => drawAct('accept')), btn('kd-ghost', 'Từ chối', () => drawAct('decline')));
    el.drawBtn = btn('', 'Xin hòa', () => drawAct('offer'));
    el.resignBtn = btn('kd-danger', 'Đầu hàng', () => { confirmOpen = true; renderControls(); });
    el.movesBtn = btn('', 'Nước đi ▾', () => { el.moves.hidden = !el.moves.hidden; el.movesBtn.setAttribute('aria-expanded', String(!el.moves.hidden)); }, { 'aria-expanded': 'false' });
    el.viBtn = btn('', 'Chữ Việt', () => setVi(!vi), { 'aria-pressed': 'false' });
    el.boardBtn = btn('', 'Bàn 3D', toggleBoard3D, { 'aria-pressed': 'false' });
    el.skinBtn = btn('', 'Lãnh địa', () => { el.skins.hidden = !el.skins.hidden; el.skinBtn.setAttribute('aria-expanded', String(!el.skins.hidden)); if (!el.skins.hidden) renderSkins(); }, { 'aria-expanded': 'false' });
    el.skins = h('div', { class: 'kd-skins', hidden: true });
    el.webgl = hasBoardWebGL();
    el.boardBtn.hidden = !el.webgl;
    el.actions = h('div', { class: 'kd-actions' }, el.drawBtn, el.resignBtn, el.movesBtn, el.viBtn, el.boardBtn, el.zoomBtn, el.skinBtn);
    el.confirm = h('div', { class: 'kd-confirm', hidden: true }, h('span', null, 'Đầu hàng ván này?'),
      btn('kd-danger', 'Đầu hàng', () => { confirmOpen = false; renderControls(); send('kd:resign', { gameId: S && S.gameId }, ack => { if (ack && !ack.ok) say(ack.reason || ''); }); }),
      btn('kd-ghost', 'Thôi', () => { confirmOpen = false; renderControls(); }));
    el.moves = h('ol', { class: 'kd-moves', hidden: true });
    el.msg = h('div', { class: 'kd-msg', role: 'status' });
    el.live = h('div', { class: 'kd-sr', 'aria-live': 'polite' });
    el.panel = h('div', { class: 'kd-panel', role: 'dialog', 'aria-label': 'Bảng bàn cờ' },
      h('div', { class: 'kd-head' }, el.title, el.minBtn, el.closeBtn),
      el.top.root, el.wrap, el.bot.root, el.goBar, el.offer, el.actions, el.skins, el.confirm, el.moves, el.msg, el.live);
    el.chip = h('button', { type: 'button', class: 'kd-chip', hidden: true, onclick: () => setMin(false) });
    // Chạm thả mới đi quân: khi phóng to, vuốt trong vùng cuộn chỉ kéo bàn.
    let down = null;
    el.canvas.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY, left: el.viewport.scrollLeft, top: el.viewport.scrollTop }; });
    el.canvas.addEventListener('pointermove', e => {
      if (!down || !S || S.zoom === 1 || e.pointerType !== 'mouse') return;
      el.viewport.scrollLeft = down.left + down.x - e.clientX;
      el.viewport.scrollTop = down.top + down.y - e.clientY;
    });
    el.canvas.addEventListener('pointercancel', () => { down = null; });
    el.canvas.addEventListener('pointerup', e => {
      if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 8 && Math.abs(el.viewport.scrollLeft - down.left) < 4 && Math.abs(el.viewport.scrollTop - down.top) < 4) onPointer(e);
      down = null;
    });
    document.body.append(el.panel, el.chip);
    return el;
  }

  function onPointer(e) {
    if (!S || !geom) return;
    e.preventDefault();
    const rc = ui.canvas.getBoundingClientRect();
    // Bảo hiểm: CSS có thể co canvas khác kích thước vẽ, nên đổi về toạ độ vẽ trước khi tra ô.
    const kx = rc.width > 0 && ui.canvas._w ? ui.canvas._w / rc.width : 1;
    const ky = rc.height > 0 && ui.canvas._h ? ui.canvas._h / rc.height : 1;
    const sq = root.KydaoDraw.squareAt(geom, (e.clientX - rc.left) * kx, (e.clientY - rc.top) * ky, S.you === 'b');
    onSquare(sq);
  }

  function onSquare(sq) {
    if (!S) return;
    const r = tapSquare(S, sq);
    if (r.kind === 'move') sendMove(r.move);
    else if (r.kind === 'mark') scoringAct('kd:mark', { point: r.point });
    else if (r.kind === 'promo') showPromo(r);
    else hidePromo();
    redraw();
  }

  function hasBoardWebGL() {
    try {
      const canvas = document.createElement('canvas'), gl = canvas.getContext('webgl2');
      if (!gl) return false;
      const lose = gl.getExtension('WEBGL_lose_context'); if (lose) lose.loseContext();
      return true;
    } catch (e) { return false; }
  }

  function stopBoard3D() {
    if (!ui) return;
    ui.boardLoad = null;
    if (ui.board3d) ui.board3d.dispose();
    if (ui.canvas3d) ui.canvas3d.remove();
    ui.board3d = null; ui.canvas3d = null;
    ui.canvas.style.display = '';
    ui.boardBtn.disabled = false; ui.boardBtn.textContent = 'Bàn 3D'; ui.boardBtn.setAttribute('aria-pressed', 'false');
  }

  async function toggleBoard3D() {
    if (!ui || !S || !['chess', 'xiangqi'].includes(S.game)) return;
    if (ui.board3d) { stopBoard3D(); fit(); redraw(); return; }
    const panel = ui, session = S, token = {};
    panel.boardLoad = token; panel.boardBtn.disabled = true; panel.boardBtn.textContent = 'Đang mở…';
    try {
      const { createBoard3D } = await import('/js/world3d/board3d.mjs?v=2');
      if (ui !== panel || S !== session || panel.boardLoad !== token) return;
      panel.canvas3d = h('canvas', { class: 'kd-canvas', tabindex: '0', 'aria-label': 'Bàn cờ 3D. Kéo hoặc dùng phím mũi tên để xoay; cuộn để thu phóng.' });
      panel.canvas3d.style.width = panel.canvas._w + 'px'; panel.canvas3d.style.height = panel.canvas._h + 'px';
      panel.canvas.style.display = 'none'; panel.viewport.prepend(panel.canvas3d);
      panel.board3d = createBoard3D({ canvas: panel.canvas3d, game: S.game });
      panel.board3d.onPick(onSquare);
      panel.canvas3d.addEventListener('webglcontextlost', e => {
        e.preventDefault();
        if (ui === panel && panel.canvas3d === e.currentTarget && panel.board3d) { stopBoard3D(); fit(); redraw(); say('Bàn 3D tạm nghỉ. Xin tiếp tục trên bàn 2D.'); }
      });
      panel.boardBtn.textContent = 'Bàn 2D'; panel.boardBtn.setAttribute('aria-pressed', 'true');
      fit(); redraw();
    } catch (e) {
      if (ui === panel && S === session) { stopBoard3D(); fit(); redraw(); say('Chưa mở được bàn 3D. Xin tiếp tục trên bàn 2D.'); }
    } finally {
      if (ui === panel && panel.boardLoad === token) { panel.boardLoad = null; panel.boardBtn.disabled = false; }
    }
  }

  function showPromo(r) {
    ui.promo.textContent = '';
    ui.promo.appendChild(h('span', null, 'Phong cấp thành:'));
    ['q', 'r', 'b', 'n'].filter(p => r.options.indexOf(p) >= 0).forEach(p => {
      ui.promo.appendChild(h('button', { type: 'button', class: 'kd-btn', onclick: () => { hidePromo(); sendMove(r.from + r.to + p); redraw(); } }, PROMO_NAME[p]));
    });
    ui.promo.appendChild(h('button', { type: 'button', class: 'kd-btn kd-ghost', onclick: () => { hidePromo(); S.sel = null; S.targets = []; redraw(); } }, 'Thôi'));
    ui.promo.hidden = false;
  }
  function hidePromo() { if (ui) ui.promo.hidden = true; }

  function sendMove(move) {
    if (!S || !canPlay(S)) return;
    if (S.game === 'jieqi') {
      // Chờ máy chủ lật quân; không áp thử quân úp trên trình duyệt.
      send('kd:move', { gameId: S.gameId, ply: S.ply, move }, ack => { if (ack && !ack.ok) { if (ack.code === 'stale') resume(); else say(ack.reason || 'Không đi được nước này.'); } });
      return;
    }
    const prev = { state: S.state, ply: S.ply, n: S.moves.length, last: S.last, check: S.inCheck, clock: S.clock, win: S.win };
    const text = S.mod.notation(S.state, move) || move;
    const gid = S.gameId;
    const before = S.ply;
    const r = pushMove(S, move, text, null, null, undefined);
    if (!r.ok) { say(r.reason); return; }
    say('');
    sound(r.info.capture ? 'capture' : r.info.check ? 'check' : 'move');
    if (S.game === 'chess' && move.length === 5) { redraw(); playPromote(move.slice(2, 4), move[4]); }
    send('kd:move', { gameId: gid, ply: before, move }, ack => {
      if (!S || S.gameId !== gid || (ack && ack.ok)) return;
      if (ack && ack.code === 'stale') { resume(); return; }
      if (S.ply === before + 1) { // hoàn lại nước áp thử
        S.state = prev.state; S.ply = prev.ply; S.moves.length = prev.n; S.last = prev.last; S.inCheck = prev.check; S.clock = prev.clock; S.win = prev.win;
      }
      say((ack && ack.reason) || 'Không đi được nước này.');
      render();
    });
    render();
  }

  const canSkin = () => !!(S && S.you && !S.over && root.KydaoSkins && root.KydaoSkins.supports(S.game));
  /** Gửi skin hiện có của mình lên máy chủ. openField = true khi người chơi bấm "Khai mở". */
  function sendSkin(openField) {
    if (!canSkin()) return;
    const mine = S.skins[S.you];
    const data = { gameId: S.gameId, pieces: pref.pieces, field: openField ? pref.field : mine.field };
    if (openField) fieldSentAt = now();
    send('kd:skin', data, ack => { if (ack && !ack.ok) say(ack.reason || 'Chưa đổi được skin.'); });
  }

  function drawAct(act) {
    if (!S) return;
    const gid = S.gameId;
    send('kd:draw', { gameId: gid, act }, ack => {
      if (!S || S.gameId !== gid) return;
      if (ack && !ack.ok) { say(ack.reason || ''); return; }
      if (act === 'offer') { S.offer = S.you; say('Đã gửi lời xin hòa.'); renderControls(); }
    });
    if (act !== 'offer') { S.offer = null; renderControls(); }
  }

  function resume() {
    send('kd:resume', {}, ack => { if (ack && ack.ok && ack.start) api.open(ack.start, hooks); });
  }

  function scoringAct(event, data) {
    if (!S || !S.you || S.over || !S.marks) return;
    const gid = S.gameId;
    send(event, Object.assign({ gameId: gid }, data), ack => { if (S && S.gameId === gid && ack && !ack.ok) say(ack.reason || ''); });
  }

  function applyMarks(session, ev) {
    if (ev.clock) session.clock = ev.clock;
    session.marks = ev.deadlineAt == null ? null : { dead: ev.dead || [], agreed: ev.agreed || {}, deadlineAt: ev.deadlineAt };
    session.state = Object.assign({}, session.state, { phase: session.marks ? 'mark' : 'play', dead: [], agreed: [], passes: session.marks ? 2 : 0, turn: ev.clock && ev.clock.turn || session.state.turn });
  }

  function setVi(v) {
    vi = !!v;
    try { root.localStorage && root.localStorage.setItem(VI_KEY, vi ? '1' : '0'); } catch (e) { /* bỏ qua */ }
    renderControls(); redraw();
  }

  function setMin(m) {
    minimized = !!m;
    if (!ui) return;
    if (minimized) stopBoard3D();
    ui.panel.hidden = minimized;
    ui.chip.hidden = !minimized;
    if (typeof hooks.onMinimize === 'function') hooks.onMinimize(minimized);
    if (!minimized) { fit(); redraw(); }
    tick();
  }

  /* ---------- vẽ ---------- */
  function fit() {
    if (!ui || !S || ui.panel.hidden) return;
    const D = root.KydaoDraw;
    let padX = 0;
    try {
      const cs = root.getComputedStyle(ui.wrap);
      padX = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
    } catch (e) { padX = 8; }
    const availW = Math.max(160, (ui.wrap.clientWidth || ui.panel.clientWidth || 320) - padX);
    const availH = Math.max(160, (root.innerHeight || 700) - 250);
    const asp = D.aspect(S.game);
    const base = Math.floor(Math.min(availW, availH * asp));
    const w = Math.floor(base * S.zoom), hh = Math.floor(w / asp);
    ui.viewport.style.width = base + 'px'; ui.viewport.style.height = Math.floor(base / asp) + 'px';
    ui.viewport.classList.toggle('kd-zoomed', S.zoom > 1);
    const dpr = Math.min(2, root.devicePixelRatio || 1);
    ui.canvas.style.width = w + 'px'; ui.canvas.style.height = hh + 'px';
    ui.canvas.width = Math.round(w * dpr); ui.canvas.height = Math.round(hh * dpr);
    ui.canvas._dpr = dpr; ui.canvas._w = w; ui.canvas._h = hh;
    if (ui.canvas3d) {
      ui.canvas3d.style.width = w + 'px'; ui.canvas3d.style.height = hh + 'px';
      ui.board3d.resize();
    }
  }

  function redraw() {
    if (!ui || !S || ui.panel.hidden || !ui.canvas._w) return;
    const options = {
      game: S.game, size: S.state.size, w: ui.canvas._w, h: ui.canvas._h, dpr: ui.canvas._dpr, board: S.state.board || S.state.cells,
      dead: S.marks ? S.marks.dead : [], win: S.win, reveal: S.reveal,
      flip: S.you === 'b', selected: S.sel, targets: S.targets, last: S.last,
      checkSq: S.inCheck && !S.over ? kingSquare(S, sessionTurn(S)) : null, vi
    };
    if (root.KydaoSkins && root.KydaoSkins.supports(S.game)) {
      options.skins = S.skins;
      const foe = S.you === 'a' ? 'b' : S.you === 'b' ? 'a' : null;
      options.hideSkins = { a: hideFoe && foe === 'a', b: hideFoe && foe === 'b' };
      options.jolt = S.jolt || null;
      options.onAsset = () => { if (ui && S) redraw(); };
    }
    if (ui.board3d) ui.board3d.setState(options);
    else geom = root.KydaoDraw.draw(ui.canvas.getContext('2d'), options);
  }

  const sideLabel = side => (SIDE_NAME[S.game] || SIDE_NAME.xiangqi)[side];

  function fillPlayer(p, side) {
    const info = S[side] || {};
    p.dot.className = 'kd-dot kd-dot-' + (S.game === 'go' ? (side === 'a' ? 'b' : 'a') : side);
    p.name.textContent = (info.name || (side === 'a' ? 'Bên 1' : 'Bên 2')) + ' · ' + sideLabel(side) + (S.you === side ? ' (bạn)' : '');
    p.elo.textContent = info.elo == null ? '' : info.elo + (info.prov ? '?' : '');
    p.root.dataset.side = side;
  }

  function updateClocks() {
    if (!ui || !S) return;
    const t = now();
    const top = S.you === 'a' ? 'b' : 'a', bot = S.you === 'a' ? 'a' : 'b';
    const set = (p, side) => {
      const ms = clockRemaining(S.clock, side, t);
      p.clock.textContent = fmtClock(ms);
      p.clock.classList.toggle('kd-low', ms < 30000 && !S.over);
      p.root.classList.toggle('kd-turn', !S.over && !!S.clock && S.clock.turn === side);
    };
    set(ui.top, top); set(ui.bot, bot);
    if (S.game === 'go' && S.marks) renderGo();
    if (minimized) ui.chip.textContent = 'Đang đánh cờ · ' + fmtClock(clockRemaining(S.clock, S.you || 'a', t));
  }

  function tick() {
    clearInterval(timer); timer = 0;
    if (!S || S.over) { updateClocks(); return; }
    updateClocks();
    timer = setInterval(updateClocks, 250);
  }

  function renderSkins() {
    if (!ui || !S) return;
    const K = root.KydaoSkins, box = ui.skins;
    box.textContent = '';
    if (!K) return;
    const row = (title, kind, catalog, current, pick) => {
      const list = h('div', { class: 'kd-skin-row', role: 'radiogroup', 'aria-label': title });
      const item = (id, name) => {
        const b = h('button', { type: 'button', class: 'kd-skin' + (current === id ? ' is-on' : ''), role: 'radio', 'aria-checked': String(current === id), onclick: () => pick(id) });
        if (id) { const im = h('img', { class: 'kd-skin-img', alt: '', loading: 'lazy', width: '96', height: '60' }); im.src = K.thumb(kind, id); b.appendChild(im); }
        else b.appendChild(h('span', { class: 'kd-skin-img kd-skin-none' }));
        b.appendChild(h('span', { class: 'kd-skin-name' }, name));
        return b;
      };
      list.appendChild(item(null, 'Mặc định'));
      Object.keys(catalog).forEach(id => list.appendChild(item(id, catalog[id].name)));
      return h('div', { class: 'kd-skin-group' }, h('div', { class: 'kd-skin-title' }, title), list);
    };
    box.appendChild(row('Sân của bạn', 'field', K.FIELDS, pref.field, id => { pref.field = id; savePref(pref); renderSkins(); }));
    box.appendChild(row('Quân của bạn', 'pieces', K.PIECES, pref.pieces, id => { pref.pieces = id; savePref(pref); renderSkins(); sendSkin(false); }));
    const mine = canSkin() ? S.skins[S.you] : null;
    const wait = Math.max(0, 20000 - (now() - fieldSentAt));
    const open = h('button', { type: 'button', class: 'kd-btn kd-gold', onclick: () => { sendSkin(true); ui.skins.hidden = true; ui.skinBtn.setAttribute('aria-expanded', 'false'); } }, pref.field ? 'Khai mở' : 'Về sân mặc định');
    open.disabled = !mine || mine.field === pref.field || wait > 0;
    const hide = h('button', { type: 'button', class: 'kd-btn kd-ghost', 'aria-pressed': String(hideFoe), onclick: () => {
      hideFoe = !hideFoe; try { root.localStorage.setItem(HIDE_KEY, hideFoe ? '1' : '0'); } catch (e) { /* bỏ qua */ } renderSkins(); redraw();
    } }, hideFoe ? 'Hiện skin đối thủ' : 'Ẩn skin đối thủ');
    box.appendChild(h('div', { class: 'kd-actions' }, open, hide));
    if (wait > 0) box.appendChild(h('div', { class: 'kd-skin-note' }, 'Chờ ' + Math.ceil(wait / 1000) + ' giây nữa mới khai mở lại được.'));
  }

  function renderControls() {
    if (!ui || !S) return;
    const player = !!S.you, live = player && !S.over;
    ui.drawBtn.hidden = ui.resignBtn.hidden = !live;
    ui.actions.hidden = false;
    ui.drawBtn.disabled = S.offer === S.you;
    ui.viBtn.hidden = !['xiangqi', 'jieqi'].includes(S.game);
    ui.boardBtn.hidden = !['chess', 'xiangqi'].includes(S.game) || !ui.webgl;
    ui.zoomBtn.hidden = !isGrid(S.game);
    ui.goBar.hidden = S.game !== 'go';
    renderGo();
    ui.viBtn.setAttribute('aria-pressed', String(vi));
    ui.confirm.hidden = !(live && confirmOpen);
    ui.offer.hidden = !(live && S.offer && S.offer !== S.you);
    if (!ui.offer.hidden) ui.offerText.textContent = 'Đối thủ xin hòa.';
    ui.minBtn.hidden = !player || S.over; // người xem/ván xong thì chỉ đóng
    const skinOk = canSkin();
    ui.skinBtn.hidden = !skinOk;
    if (!skinOk) { ui.skins.hidden = true; ui.skinBtn.setAttribute('aria-expanded', 'false'); }
    ui.closeBtn.hidden = live;            // đang đấu: không đóng được, chỉ thu nhỏ hoặc đầu hàng
  }

  function renderGo() {
    if (!ui || !S || S.game !== 'go') return;
    const marking = !!S.marks, live = !!S.you && !S.over;
    ui.passBtn.hidden = !live || marking; ui.passBtn.disabled = !canPlay(S);
    ui.agreeBtn.hidden = ui.continueBtn.hidden = !live || !marking;
    ui.agreeBtn.disabled = !!(marking && S.marks.agreed[S.you]);
    const dead = marking ? S.marks.dead.map(n => root.KydaoDraw.parseSq('go', n, S.state.size)).filter(Boolean).map(p => p.row * S.state.size + p.col) : [];
    const score = S.mod.score(Object.assign({}, S.state, { dead }));
    ui.scoreText.textContent = 'Tạm tính: Đen ' + score.a + ' · Trắng ' + score.b + ' (bù ' + score.komi + ')' + (marking ? ' · ' + fmtClock(S.marks.deadlineAt - now()) + '. Chạm nhóm quân chết; hai bên đồng ý để kết thúc.' + (S.marks.agreed.a ? ' Đen đã đồng ý.' : '') + (S.marks.agreed.b ? ' Trắng đã đồng ý.' : '') : ' · Hai lần bỏ lượt để tính điểm.');
  }

  function renderMoves() {
    ui.moves.textContent = '';
    const label = m => {
      const r = m.r, names = root.KydaoDraw.VIET;
      return (m.t || m.m) + (r && r.mover ? ' · lật ' + names[r.mover] : '') + (r && r.captured ? ' · ăn quân úp ' + names[r.captured] : '');
    };
    for (let i = 0; i < S.moves.length; i += 2) {
      const a = S.moves[i], b = S.moves[i + 1];
      ui.moves.appendChild(h('li', { value: Math.floor(i / 2) + 1 }, label(a) + (b ? '   ' + label(b) : '')));
    }
    ui.moves.scrollTop = ui.moves.scrollHeight;
  }

  function render() {
    if (!ui || !S) return;
    const gname = GAME_NAME[S.game] || S.game;
    ui.title.textContent = (S.table ? 'Bàn ' + S.table : 'Bàn trong') + ' · ' + gname + ' · ' + (S.rated ? 'Xếp hạng' : 'Giao hữu');
    const top = S.you === 'a' ? 'b' : 'a', bot = S.you === 'a' ? 'a' : 'b';
    fillPlayer(ui.top, top); fillPlayer(ui.bot, bot);
    ui.canvas.setAttribute('aria-label', 'Bàn ' + gname + (S.you ? ', bạn cầm quân ' + sideLabel(S.you) : ''));
    renderControls(); renderMoves(); updateClocks(); redraw();
    if (S.downgraded && !ui.msg.textContent) say(S.downgraded);
  }

  /* ---------- kết quả ---------- */
  function showResult(ev) {
    ui.result.textContent = '';
    let head = 'Ván cờ kết thúc';
    if (ev.result === 'abort') head = 'Ván bị hủy';
    else if (ev.result === 'draw') head = 'Hòa cờ';
    else if (S.you) head = ev.result === S.you ? 'Bạn thắng' : 'Bạn thua';
    else head = (sideLabel(ev.result) || '') + ' thắng';
    ui.result.appendChild(h('div', { class: 'kd-result-head' }, head));
    if (ev.score) ui.result.appendChild(h('div', { class: 'kd-result-text' }, 'Đen ' + ev.score.a + ' · Trắng ' + ev.score.b + ' (bù ' + ev.score.komi + ')'));
    if (ev.text) ui.result.appendChild(h('div', { class: 'kd-result-text' }, ev.text));
    if (ev.elo && S.you && ev.elo[S.you]) {
      const e = ev.elo[S.you], d = e.to - e.from;
      ui.result.appendChild(h('div', { class: 'kd-result-elo' }, 'Elo: ' + e.from + ' → ' + e.to + ' (' + (d >= 0 ? '+' : '') + d + ')'));
    }
    const row = h('div', { class: 'kd-result-btns' });
    if (S.you && S.table != null) {
      const again = h('button', { type: 'button', class: 'kd-btn' }, 'Đấu lại');
      again.addEventListener('click', () => {
        if (rematchSent) return;
        rematchSent = true; again.disabled = true; again.textContent = 'Đang chờ đối thủ…';
        send('kd:ready', { table: S.table, ready: true }, ack => { if (ack && !ack.ok) { rematchSent = false; again.disabled = false; again.textContent = 'Đấu lại'; say(ack.reason || ''); } });
      });
      row.appendChild(again);
      row.appendChild(h('button', { type: 'button', class: 'kd-btn kd-ghost', onclick: () => { send('kd:stand', { table: S.table }); api.close(); } }, 'Rời bàn'));
    } else {
      row.appendChild(h('button', { type: 'button', class: 'kd-btn', onclick: () => api.close() }, 'Đóng'));
    }
    ui.result.appendChild(row);
    ui.result.hidden = false;
    announce(head + (ev.text ? '. ' + ev.text : ''));
  }

  /** Gọi sau khi một bên đổi skin. T-115b nối màn khai mở vào đây. */
  function boardOffset() {
    const c = (ui.canvas3d || ui.canvas).getBoundingClientRect(), w = ui.wrap.getBoundingClientRect();
    return { x: c.left - w.left, y: c.top - w.top, w: c.width, h: c.height };
  }
  /** Nửa sân của bên `side` trên màn hình: bên mình luôn ở nửa dưới. */
  function halfRect(side) {
    const o = boardOffset(), flip = S.you === 'b';
    const bottom = (side === 'a') !== flip;
    return { rect: { x: o.x, y: o.y + (bottom ? o.h / 2 : 0), w: o.w, h: o.h / 2 }, fromBottom: bottom };
  }
  function fxPoint(sq) {
    const D = root.KydaoDraw;
    if (!geom || !sq) return null;
    const q = D.parseSq(S.game, sq, S.state.size);
    if (!q) return null;
    const p = D.cellXY(geom, q.col, q.row, S.you === 'b'), o = boardOffset();
    return { x: o.x + p.x, y: o.y + p.y };
  }
  function playPromote(sq, piece) {
    if (!ui || ui.panel.hidden) return;
    sound('check');
    if (ui.board3d && typeof ui.board3d.playFx === 'function') { ui.board3d.playFx('promote', { at: sq, piece }); return; }
    const at = fxPoint(sq);
    if (!root.KydaoFx || !at) return;
    const session = S, o = boardOffset();
    root.KydaoFx.mount(ui.wrap, { reduced: reduced() });
    root.KydaoFx.play('promote', { at, piece, cell: geom.cell, onJolt: get => {
      if (S !== session || !ui) return;
      S.jolt = get ? (x, y) => get(x + o.x, y + o.y) : null;
      redraw();
    } });
  }
  function playWin(ev) {
    if (!ui || ui.panel.hidden || ev.result === 'abort' || reduced()) return 0;
    const mine = S.you ? (ev.result === 'draw' ? null : ev.result === S.you) : null;
    const loser = ev.result === 'a' ? 'b' : ev.result === 'b' ? 'a' : null;
    const boardGame = S.game === 'chess' || S.game === 'xiangqi' || S.game === 'jieqi';
    const kingSq = boardGame && loser ? kingSquare(S, loser) : null;
    if (ui.board3d && typeof ui.board3d.playFx === 'function') {
      ui.board3d.playFx('win', { game: S.game, reason: ev.reason, result: ev.result, mine, king: kingSq, line: S.win || [] });
      return 2400;
    }
    if (!root.KydaoFx) return 0;
    root.KydaoFx.mount(ui.wrap, { reduced: false });
    const line = (S.win || []).map(fxPoint).filter(Boolean);
    root.KydaoFx.play('win', { game: S.game, reason: ev.reason, result: ev.result, mine, king: kingSq ? fxPoint(kingSq) : null, line });
    return 2400;
  }
  function onSkinEvent(ev) {
    if (ui && !ui.skins.hidden) renderSkins();
    if (!ev.opened || !ev.field || !ui || ui.panel.hidden) return;
    const foe = S.you && ev.side !== S.you;
    if (foe && hideFoe) return;
    const K = root.KydaoSkins, f = K && K.field(ev.field);
    if (f) announce((S[ev.side] && S[ev.side].name ? S[ev.side].name + ': ' : '') + f.cry + ' ' + f.name + '.');
    sound('check');
    if (ui.board3d && typeof ui.board3d.playFx === 'function') { ui.board3d.playFx('domain', { side: ev.side, fieldId: ev.field }); return; }
    if (!root.KydaoFx) return;
    root.KydaoFx.mount(ui.wrap, { reduced: reduced() });
    const hr = halfRect(ev.side);
    root.KydaoFx.play('domain', { side: ev.side, fieldId: ev.field, rect: hr.rect, fromBottom: hr.fromBottom });
  }

  /* ---------- API ---------- */
  function flushPending() {
    const b = pending[S.gameId];
    delete pending[S.gameId];
    if (!b) return;
    b.evs.filter(e => e.ply > S.ply).sort((x, y) => x.ply - y.ply).forEach(e => onMoved(e));
  }

  function onMoved(ev) {
    if (!ev || typeof ev.gameId !== 'string') return;
    if (!S || S.gameId !== ev.gameId) {
      const b = pending[ev.gameId] || (pending[ev.gameId] = { at: Date.now(), evs: [] });
      b.evs.push(ev);
      setTimeout(() => { if (pending[ev.gameId] === b) delete pending[ev.gameId]; }, 10000);
      return;
    }
    const was = S.ply;
    const r = handleMoved(S, ev);
    if (r === 'gap' || r === 'bad') { if (S.you) resume(); else send('kd:watch', { table: S.table }); return; }
    if (r === 'applied') {
      if (ev.reveal) {
        const names = root.KydaoDraw.VIET;
        say((ev.reveal.mover ? 'Lật quân: ' + names[ev.reveal.mover] + '.' : '') + (ev.reveal.captured ? ' Quân úp bị ăn: ' + names[ev.reveal.captured] + '.' : ''));
      }
      if (S.game === 'jieqi' && ev.reveal && ev.reveal.mover && !reduced()) {
        const session = S, started = Date.now(), square = ev.move.slice(2, 4);
        const animate = () => {
          if (S !== session || !ui || S.over) return;
          const progress = Math.min(1, (Date.now() - started) / 280);
          S.reveal = progress < 1 ? { square, progress } : null; redraw();
          if (progress < 1) root.requestAnimationFrame(animate);
        };
        animate();
      }
      hidePromo();
      const mover = ev.side || (S.moves.length % 2 ? 'a' : 'b');
      if (S.you && mover !== S.you) announce('Đối thủ: ' + (ev.text || ev.move));
      else if (!S.you) announce((ev.text || ev.move));
      sound(ev.capture ? 'capture' : ev.check ? 'check' : 'move');
      if (S.offer && S.offer !== mover) S.offer = null; // đối thủ đi một nước = từ chối lời xin hòa của mình
      render();
      if (S.game === 'chess' && typeof ev.move === 'string' && ev.move.length === 5) playPromote(ev.move.slice(2, 4), ev.move[4]);
    } else if (r === 'synced') { updateClocks(); renderMoves(); }
    if (was === S.ply && r !== 'synced') updateClocks();
  }

  const api = {
    open(start, h2) {
      if (!start || typeof start !== 'object') return false;
      const mod = moduleFor(start.game);
      if (!mod || !root.KydaoDraw) return false;
      stopBoard3D();
      hooks = h2 || hooks || {};
      clearTimeout(resultTimer);
      if (root.KydaoFx) root.KydaoFx.stop();
      S = makeSession(start, mod);
      rematchSent = false; confirmOpen = false; minimized = false;
      if (!ui) {
        ui = build();
        resizeFn = () => { fit(); redraw(); };
        root.addEventListener('resize', resizeFn);
      }
      ui.panel.hidden = false; ui.chip.hidden = true; ui.result.hidden = true; ui.moves.hidden = true;
      ui.movesBtn.setAttribute('aria-expanded', 'false');
      ui.zoomBtn.textContent = 'Phóng to'; ui.zoomBtn.setAttribute('aria-pressed', 'false'); ui.viewport.scrollLeft = ui.viewport.scrollTop = 0;
      hidePromo(); say('');
      ui.panel.classList.toggle('kd-reduced', reduced());
      fit(); render(); tick(); flushPending();
      pref = loadPref(); fieldSentAt = 0;
      if (ui.skins) { ui.skins.hidden = true; ui.skinBtn.setAttribute('aria-expanded', 'false'); }
      if (canSkin() && pref.pieces && S.skins[S.you].pieces !== pref.pieces) sendSkin(false);
      return true;
    },
    close() {
      clearInterval(timer); timer = 0; clearTimeout(resultTimer);
      if (root.KydaoFx) root.KydaoFx.unmount();
      stopBoard3D();
      if (ui) { ui.panel.remove(); ui.chip.remove(); if (resizeFn) root.removeEventListener('resize', resizeFn); }
      ui = null; S = null; geom = null; minimized = false;
      if (typeof hooks.onClose === 'function') hooks.onClose();
    },
    isOpen() { return !!ui; },
    apply(ev) {
      if (!ev || typeof ev !== 'object') return;
      const type = String(ev.type || '').replace(/^kd:/, '');
      if (type === 'start') api.open(ev, hooks);
      else if (type === 'moved') onMoved(ev);
      else if (type === 'marks' && S && S.game === 'go' && ev.gameId === S.gameId) {
        applyMarks(S, ev); render();
      } else if (type === 'offer' && S && ev.gameId === S.gameId) {
        S.offer = ev.state === 'open' ? (ev.from || null) : null;
        if (ev.state === 'declined') say('Lời xin hòa bị từ chối.');
        else if (ev.state === 'expired') say('Lời xin hòa đã hết hạn.');
        renderControls();
      } else if (type === 'skin' && S) {
        if (applySkin(S, ev)) { redraw(); onSkinEvent(ev); }
      } else if (type === 'end' && S && ev.gameId === S.gameId) {
        S.over = true; S.sel = null; S.targets = []; S.offer = null;
        S.reveal = null;
        if (S.game === 'jieqi' && ev.final) S.state = ev.final;
        if (S.clock) S.clock = settleClock(S.clock, now(), ev.result, ev.reason);
        confirmOpen = false;
        hidePromo(); render(); tick();
        clearTimeout(resultTimer);
        S.jolt = null;
        const wait = playWin(ev);
        resultTimer = setTimeout(() => { if (S && S.over && ui) showResult(ev); }, reduced() ? 0 : Math.max(450, wait));
      }
    },
    core
  };
  return api;
});
