/*
 * Kỳ Đạo · Ván trên máy (KydaoLocal): đánh với máy và giải thế cờ, chạy hoàn toàn trên trình duyệt.
 * Dùng lại bảng cờ KydaoUI: module này đóng vai "máy chủ giả" qua hooks.send (kd:move, kd:resign…)
 * và đẩy kd:moved / kd:end vào KydaoUI.apply. Không cộng công đức, không Elo, máy chủ không biết gì về ván này.
 *
 * API:
 *   KydaoLocal.init(host)                host: { name(), sound(kind), toast(text), onOpen(game), onClose() }
 *   KydaoLocal.playAi({ game, level, side })      game 'chess' | 'xiangqi'; level 1..3; side 'a' | 'b' | 'random'
 *   KydaoLocal.loadPuzzles() → Promise<data>      tải /data/kydao-puzzles.json một lần
 *   KydaoLocal.categories(game) → [{ key, name, total, solved }]
 *   KydaoLocal.playPuzzle(game, key)              thế chưa giải kế tiếp của nhóm (giải hết thì quay vòng)
 * Bộ máy nghĩ nước: public/js/kydao/ai-worker.js (Web Worker) với ai-chess.js / ai-xiangqi.js.
 * Thế cờ đã giải lưu ở localStorage 'ta-kd-puzzles' (chỉ để đánh dấu, không gửi đi đâu).
 */
(function (root) {
  'use strict';
  const GAMES = { chess: 'Cờ vua', xiangqi: 'Cờ tướng' };
  const LEVELS = { 1: 'Sơ cơ', 2: 'Trung cơ', 3: 'Cao cơ' };
  const CATS = [
    { key: 'mate1', name: 'Chiếu hết 1 nước', goal: 'mate', n: 1 },
    { key: 'mate2', name: 'Chiếu hết 2 nước', goal: 'mate', n: 2 },
    { key: 'mate3', name: 'Chiếu hết 3 nước', goal: 'mate', n: 3 },
    { key: 'draw', name: 'Tìm đường hòa', goal: 'draw' },
    { key: 'win', name: 'Thắng thế', goal: 'win' }
  ];
  const STORE = 'ta-kd-puzzles';
  // Kỳ thủ máy mang tên NPC Ngọa Long Kỳ Sư (hall.js; mô hình 3D: world3d/npc-glb.mjs vai 'kysu')
  const BOT_NAME = 'Ngọa Long Kỳ Sư';
  const AI_TIMEOUT_MS = 9000;
  const REPLY_MS = 550;

  let host = {}, session = null, seq = 0, worker = null, workerBroken = false, reqSeq = 0, data = null, loading = null;
  const pending = new Map();

  const UI = () => root.KydaoUI;
  const modOf = game => (game === 'chess' ? root.KyChess : game === 'xiangqi' ? root.KyXiangqi : null);
  const other = s => (s === 'a' ? 'b' : 'a');
  const toast = t => { try { if (host.toast) host.toast(t); } catch (e) { /* bỏ qua */ } };
  const catOf = p => (p.goal === 'mate' ? 'mate' + p.n : p.goal);

  function solvedMap() { try { return JSON.parse(root.localStorage.getItem(STORE) || '{}') || {}; } catch (e) { return {}; } }
  function markSolved(id) {
    try { const m = solvedMap(); m[id] = 1; root.localStorage.setItem(STORE, JSON.stringify(m)); } catch (e) { /* bỏ qua */ }
  }

  /* ---------- máy nghĩ nước (Web Worker; lỗi thì đi nước hợp lệ ngẫu nhiên để ván không treo) ---------- */
  function getWorker() {
    if (worker || workerBroken || typeof root.Worker !== 'function') return worker;
    try {
      worker = new root.Worker('/js/kydao/ai-worker.js?v=ai1');
      worker.onmessage = e => {
        const d = e.data || {}, p = pending.get(d.id);
        if (!p) return;
        pending.delete(d.id); clearTimeout(p.timer);
        p.resolve(typeof d.move === 'string' ? d.move : null);
      };
      worker.onerror = () => { workerBroken = true; worker = null; for (const p of pending.values()) { clearTimeout(p.timer); p.resolve(null); } pending.clear(); };
    } catch (e) { workerBroken = true; worker = null; }
    return worker;
  }
  function think(game, state, level) {
    return new Promise(resolve => {
      const w = getWorker();
      if (!w) { resolve(null); return; }
      const id = ++reqSeq;
      const timer = setTimeout(() => { pending.delete(id); resolve(null); }, AI_TIMEOUT_MS);
      pending.set(id, { resolve, timer });
      try { w.postMessage({ id, game, state, level }); } catch (e) { pending.delete(id); clearTimeout(timer); resolve(null); }
    });
  }

  /* ---------- phiên ---------- */
  function names(you, mine, theirs) {
    const me = { pid: -1, name: mine }, op = { pid: -2, name: theirs };
    return you === 'a' ? { a: me, b: op } : { a: op, b: me };
  }
  function open(s, start) {
    session = s;
    const hooks = {
      send: (name, d, cb) => onSend(s, name, d || {}, cb || function () {}),
      now: () => Date.now(),
      sound: kind => { try { if (host.sound) host.sound(kind); } catch (e) { /* bỏ qua */ } },
      onClose: () => { if (session === s) session = null; s.closed = true; try { if (host.onClose) host.onClose(); } catch (e) { /* bỏ qua */ } },
      again: () => (s.kind === 'ai' ? playAi(s.opts) : playPuzzle(s.game, s.cat)),
      againLabel: s.kind === 'ai' ? 'Ván mới' : 'Thế kế tiếp'
    };
    if (s.kind === 'puzzle') hooks.hint = () => hint(s);
    try { if (host.onOpen) host.onOpen(s.game); } catch (e) { /* bỏ qua */ }
    UI().open(start, hooks);
  }
  const emit = (s, ev) => { if (session === s && !s.closed) UI().apply(ev); };
  function end(s, ev) {
    if (s.over) return;
    s.over = true;
    emit(s, Object.assign({ type: 'kd:end', gameId: s.gameId }, ev));
  }
  function statusEnd(s) {
    const st = s.mod.status(s.state);
    if (!st || !st.over) return false;
    const why = (s.mod.REASON_TEXT && s.mod.REASON_TEXT[st.reason]) || st.reason || '';
    const result = st.winner || 'draw';
    const head = s.kind === 'ai' ? (result === 'draw' ? 'Hòa cờ' : result === s.you ? 'Bạn thắng ' + BOT_NAME : BOT_NAME + ' thắng') : undefined;
    end(s, { result, reason: st.reason || 'over', text: why, head });
    return true;
  }
  /** Áp một nước của "đối phương" (máy hoặc lời giải) và báo cho bảng cờ. */
  function reply(s, move) {
    if (s.over || s.closed) return false;
    const text = s.mod.notation(s.state, move) || move, side = s.mod.turn(s.state);
    const r = s.mod.play(s.state, move);
    if (!r || !r.ok) return false;
    s.state = r.state; s.ply += 1;
    const info = r.info || {};
    emit(s, { type: 'kd:moved', gameId: s.gameId, ply: s.ply, move, text, side, capture: !!info.capture, check: !!info.check });
    return true;
  }
  function randomLegal(s) { const list = s.mod.legalMoves(s.state); return list.length ? list[Math.floor(Math.random() * list.length)] : null; }
  async function aiTurn(s) {
    if (s.over || s.closed || s.mod.turn(s.state) === s.you) return;
    const t0 = Date.now(), ply = s.ply;
    let move = await think(s.game, s.state, s.opts.level);
    if (s.over || s.closed || s.ply !== ply) return;
    if (!move || !s.mod.legalMoves(s.state).includes(move)) move = randomLegal(s);
    const wait = Math.max(0, 350 - (Date.now() - t0));    // máy nghĩ quá nhanh thì chờ một chút cho người kịp nhìn
    setTimeout(() => {
      if (s.over || s.closed || s.ply !== ply) return;
      if (move && reply(s, move)) statusEnd(s);
    }, wait);
  }

  function onSend(s, name, d, cb) {
    if (s.closed || session !== s) return cb({ ok: false, reason: 'Ván này đã đóng.' });
    if (name === 'kd:move') return onMove(s, d, cb);
    if (name === 'kd:resign') {
      cb({ ok: true });
      if (s.kind === 'puzzle') return showSolution(s);
      return end(s, { result: other(s.you), reason: 'resign', text: 'Bạn đã chịu thua.', head: BOT_NAME + ' thắng' });
    }
    if (name === 'kd:draw') return cb({ ok: false, reason: s.kind === 'ai' ? 'Kỳ sư không nhận hòa, đánh tiếp nhé.' : 'Thế cờ không xin hòa được.' });
    return cb({ ok: false });
  }

  function onMove(s, d, cb) {
    if (s.over) return cb({ ok: false, reason: 'Ván cờ đã kết thúc.' });
    if (d.ply !== s.ply || s.mod.turn(s.state) !== s.you) return cb({ ok: false, reason: 'Chưa tới lượt bạn.' });
    const move = String(d.move || '');
    const r = s.mod.play(s.state, move);
    if (!r || !r.ok) return cb({ ok: false, reason: (r && r.reason) || 'Nước đi không hợp lệ.' });
    if (s.kind === 'puzzle') return puzzleMove(s, move, r, cb);
    s.state = r.state; s.ply += 1;
    cb({ ok: true });
    if (!statusEnd(s)) aiTurn(s);
  }

  /* ---------- đánh với máy ---------- */
  function playAi(opts) {
    const game = GAMES[opts && opts.game] ? opts.game : 'chess', mod = modOf(game);
    if (!mod || !UI()) { toast('Bàn cờ chưa sẵn sàng, xin tải lại trang.'); return false; }
    const level = LEVELS[opts && opts.level] ? Number(opts.level) : 2;
    const you = opts && (opts.side === 'a' || opts.side === 'b') ? opts.side : Math.random() < 0.5 ? 'a' : 'b';
    const s = { kind: 'ai', game, mod, you, gameId: 'local-' + (++seq), state: mod.create(), ply: 0, over: false, closed: false, opts: { game, level, side: opts && opts.side } };
    const me = typeof host.name === 'function' ? host.name() || 'Bạn' : 'Bạn';
    open(s, Object.assign({
      gameId: s.gameId, table: null, game, rated: false, pace: 'normal', you, state: s.state, ply: 0, moves: [], clock: null,
      local: 'ai', title: 'Đối cờ với ' + BOT_NAME + ' · ' + GAMES[game] + ' · ' + LEVELS[level]
    }, names(you, me, BOT_NAME + ' · ' + LEVELS[level])));
    aiTurn(s);
    return true;
  }

  /* ---------- giải thế cờ ---------- */
  function loadPuzzles() {
    if (data) return Promise.resolve(data);
    if (loading) return loading;
    loading = fetch('/data/kydao-puzzles.json?v=1').then(r => { if (!r.ok) throw new Error('http ' + r.status); return r.json(); })
      .then(j => { data = { chess: Array.isArray(j.chess) ? j.chess : [], xiangqi: Array.isArray(j.xiangqi) ? j.xiangqi : [] }; return data; })
      .catch(e => { loading = null; throw e; });
    return loading;
  }
  function categories(game) {
    const list = (data && data[game]) || [], solved = solvedMap();
    return CATS.map(c => {
      const ps = list.filter(p => catOf(p) === c.key);
      return { key: c.key, name: c.name, total: ps.length, solved: ps.filter(p => solved[p.id]).length };
    }).filter(c => c.total > 0);
  }
  function stateFrom(game, fen) {
    const mod = modOf(game);
    return game === 'chess' ? mod.create({ fen }) : mod.fromFen(fen);
  }
  function playPuzzle(game, key) {
    if (!data) { loadPuzzles().then(() => playPuzzle(game, key)).catch(() => toast('Chưa tải được kho thế cờ, xin thử lại.')); return false; }
    const mod = modOf(game), cat = CATS.find(c => c.key === key);
    if (!mod || !cat || !UI()) return false;
    const list = (data[game] || []).filter(p => catOf(p) === key);
    if (!list.length) { toast('Nhóm thế cờ này chưa có bài.'); return false; }
    const solved = solvedMap();
    const last = session && session.kind === 'puzzle' && session.game === game && session.cat === key ? list.indexOf(session.puzzle) : -1;
    const order = list.slice(last + 1).concat(list.slice(0, last + 1));
    const p = order.find(x => !solved[x.id]) || order[0];
    let state;
    try { state = stateFrom(game, p.fen); } catch (e) { toast('Thế cờ này bị lỗi, chuyển sang thế khác.'); return false; }
    const you = mod.turn(state);
    const s = { kind: 'puzzle', game, mod, you, gameId: 'local-' + (++seq), state, ply: 0, over: false, closed: false, puzzle: p, cat: key, k: 0, tries: 0 };
    const no = list.indexOf(p) + 1;
    const goalText = p.goal === 'mate' ? `Chiếu hết sau ${p.n} nước` : p.goal === 'draw' ? 'Tìm đường cầm hòa' : 'Tìm nước giành thế thắng';
    const moves = [];
    if (p.last) moves.push({ m: p.last, t: 'Nước vừa đi' });
    open(s, Object.assign({
      gameId: s.gameId, table: null, game, rated: false, pace: 'normal', you, state, ply: 0, moves, clock: null,
      local: 'puzzle', resignLabel: 'Xem lời giải',
      title: `Thế cờ · ${cat.name} · Bài ${no}/${list.length}` + (p.rating ? ` · Độ khó ${p.rating}` : '')
    }, names(you, typeof host.name === 'function' ? host.name() || 'Bạn' : 'Bạn', 'Đề bài')));
    toast(`${goalText}. Bạn cầm quân ${you === 'a' ? (game === 'chess' ? 'Trắng' : 'Đỏ') : 'Đen'}.`);
    return true;
  }
  function puzzleMove(s, move, r, cb) {
    const p = s.puzzle, expect = p.moves[s.k];
    const st = s.mod.status(r.state);
    const mated = p.goal === 'mate' && st && st.over && st.winner === s.you;
    if (move !== expect && !mated) {
      s.tries++;
      return cb({ ok: false, reason: 'Chưa phải nước hay nhất. Thử nước khác nhé.' });
    }
    s.state = r.state; s.ply += 1; s.k += 1;
    cb({ ok: true });
    if (mated || s.k >= p.moves.length) { solved(s); return; }
    const answer = p.moves[s.k];
    setTimeout(() => {
      if (s.over || s.closed) return;
      if (!reply(s, answer)) { solved(s); return; }
      s.k += 1;
      if (s.k >= p.moves.length) solved(s);
    }, REPLY_MS);
  }
  function solved(s) {
    markSolved(s.puzzle.id);
    end(s, {
      result: s.you, reason: 'puzzle', head: 'Giải đúng!',
      text: (s.tries ? `Bạn giải được sau ${s.tries} lần thử.` : 'Giải ngay lần đầu, cao tay!') + (s.puzzle.source && s.puzzle.source.startsWith('lichess:') ? ' Đề bài từ kho thế cờ Lichess.' : '')
    });
  }
  function hint(s) {
    if (s.over) return;
    const m = s.puzzle.moves[s.k];
    if (m) toast('Gợi ý: hãy xem quân ở ô ' + m.slice(0, 2) + '.');
  }
  function showSolution(s) {
    const p = s.puzzle, words = [];
    let st = s.state;
    for (let i = s.k; i < p.moves.length; i++) {
      words.push(s.mod.notation(st, p.moves[i]) || p.moves[i]);
      const r = s.mod.play(st, p.moves[i]);
      if (!r || !r.ok) break;
      st = r.state;
    }
    end(s, { result: other(s.you), reason: 'solution', head: 'Lời giải', text: words.join(' · ') });
  }

  function init(h) { host = h || {}; }
  root.KydaoLocal = { init, playAi, loadPuzzles, categories, playPuzzle, GAMES, LEVELS, CATS, isOpen: () => !!session };
})(this);
