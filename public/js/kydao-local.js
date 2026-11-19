/*
 * Kỳ Đạo · Ván trên máy (KydaoLocal): đánh với máy và giải thế cờ, chạy hoàn toàn trên trình duyệt.
 * Dùng lại bảng cờ KydaoUI: module này đóng vai "máy chủ giả" qua hooks.send (kd:move, kd:resign…)
 * và đẩy kd:moved / kd:end vào KydaoUI.apply. Không cộng công đức, không Elo, máy chủ không biết gì về ván này.
 *
 * API:
 *   KydaoLocal.init(host)                host: { name(), sound(kind), toast(text), onOpen(game), onClose(), unlockSolution?(done) }
 *     unlockSolution: "Xem lời giải" cần cúng dường vui; host gọi done() khi đã tạo xong mã QR.
 *     requestHint(puzzleId, step, cb): gợi ý trừ 5 công đức trên máy chủ (kd:hint), cb({ ok, square, cost } | { ok:false, reason }).
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
    { key: 'win-end', name: 'Thắng thế tàn cục', goal: 'win' },
    { key: 'win-mid', name: 'Đòn phối hợp trung cuộc', goal: 'win' }
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
  // nhóm đề: trường group của tools/kydao-puzzles/build.js (mate1..3, draw, win-end, win-mid)
  const catOf = p => (typeof p.group === 'string' ? p.group : p.goal === 'mate' ? 'mate' + p.n : p.goal === 'win' ? 'win-mid' : p.goal);

  // Sổ thế cờ trên máy: 1 = giải đúng ngay lần đầu (không gợi ý), 2 = giải được sau khi trượt / có gợi ý, 'x' = đã thử, chưa giải.
  function solvedMap() { try { return JSON.parse(root.localStorage.getItem(STORE) || '{}') || {}; } catch (e) { return {}; } }
  function markPuzzle(id, mark) {
    try {
      const m = solvedMap(), cur = m[id];
      if (cur === 1 || (cur === 2 && mark === 'x')) return;   // không hạ bậc kết quả đã có
      m[id] = mark; root.localStorage.setItem(STORE, JSON.stringify(m));
    } catch (e) { /* bỏ qua */ }
  }

  /* ---------- máy nghĩ nước (Web Worker; lỗi thì đi nước hợp lệ ngẫu nhiên để ván không treo) ---------- */
  function getWorker() {
    if (worker || workerBroken || typeof root.Worker !== 'function') return worker;
    try {
      worker = new root.Worker('/js/kydao/ai-worker.js?v=ai2');
      worker.onmessage = e => {
        const d = e.data || {}, p = pending.get(d.id);
        if (!p) return;
        pending.delete(d.id); clearTimeout(p.timer);
        p.resolve(d);
      };
      worker.onerror = () => { workerBroken = true; worker = null; for (const p of pending.values()) { clearTimeout(p.timer); p.resolve(null); } pending.clear(); };
    } catch (e) { workerBroken = true; worker = null; }
    return worker;
  }
  function ask(msg) {
    return new Promise(resolve => {
      const w = getWorker();
      if (!w) { resolve(null); return; }
      const id = ++reqSeq;
      const timer = setTimeout(() => { pending.delete(id); resolve(null); }, AI_TIMEOUT_MS);
      pending.set(id, { resolve, timer });
      try { w.postMessage(Object.assign({ id }, msg)); } catch (e) { pending.delete(id); clearTimeout(timer); resolve(null); }
    });
  }
  const think = (game, state, level) => ask({ game, state, level }).then(d => (d && typeof d.move === 'string' ? d.move : null));
  // Máy phòng thủ thế chiếu hết: { move, escape, n } (engine.defend trong Worker) hoặc null khi lỗi
  const defend = (game, state, left) => ask({ kind: 'defend', game, state, left }).then(d => (d && d.defend && typeof d.defend.move === 'string' ? d.defend : null));

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
    if (s.kind === 'puzzle') hooks.retry = () => playPuzzle(s.game, s.cat, s.puzzle.id);
    if (s.kind === 'puzzle') { hooks.hint = () => hint(s); hooks.hintLabel = typeof host.requestHint === 'function' ? 'Gợi ý · −5 công đức' : 'Gợi ý'; }
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
      if (s.kind === 'puzzle') {
        if (s.over) return;
        if (typeof host.unlockSolution === 'function') host.unlockSolution(() => { if (session === s && !s.closed) showSolution(s); });
        else showSolution(s);
        return;
      }
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
    const list = (data && data[game]) || [], book = solvedMap();
    return CATS.map(c => {
      const ps = list.filter(p => catOf(p) === c.key);
      return {
        key: c.key, name: c.name, total: ps.length,
        first: ps.filter(p => book[p.id] === 1).length,                       // giải đúng ngay lần đầu
        solved: ps.filter(p => book[p.id] === 1 || book[p.id] === 2).length,  // đã giải (kể cả sau khi trượt)
        tried: ps.filter(p => book[p.id] != null).length
      };
    }).filter(c => c.total > 0);
  }
  function stateFrom(game, fen) {
    const mod = modOf(game);
    return game === 'chess' ? mod.create({ fen }) : mod.fromFen(fen);
  }
  /**
   * Mở một thế cờ. Luật (👤 chủ dự án chốt 19/11):
   *  - Chiếu hết N nước: đi nước hợp lệ nào cũng được, máy phòng thủ tìm nước chống lâu nhất; hết N nước mà chưa chiếu hết
   *    (hoặc máy đã thoát được) là trượt. Chấp nhận cả lời giải khác đáp án.
   *  - Tìm đường hòa, thắng thế: phải đi đúng đường của đề (Lichess), đi sai một nước là trượt.
   *  - Mỗi lần mở là một mạng; trượt thì Thử lại. Chỉ giải đúng ngay lần đầu, không gợi ý, mới tính "giải lần đầu".
   */
  function playPuzzle(game, key, id) {
    if (!data) { loadPuzzles().then(() => playPuzzle(game, key, id)).catch(() => toast('Chưa tải được kho thế cờ, xin thử lại.')); return false; }
    const mod = modOf(game), cat = CATS.find(c => c.key === key);
    if (!mod || !cat || !UI()) return false;
    const list = (data[game] || []).filter(p => catOf(p) === key);
    if (!list.length) { toast('Nhóm thế cờ này chưa có bài.'); return false; }
    const book = solvedMap();
    let p = id ? list.find(x => x.id === id) : null;
    if (!p) {
      const last = session && session.kind === 'puzzle' && session.game === game && session.cat === key ? list.indexOf(session.puzzle) : -1;
      const order = list.slice(last + 1).concat(list.slice(0, last + 1));
      p = order.find(x => book[x.id] !== 1 && book[x.id] !== 2) || order[0];
    }
    let state;
    try { state = stateFrom(game, p.fen); } catch (e) { toast('Thế cờ này bị lỗi, chuyển sang thế khác.'); return false; }
    const you = mod.turn(state);
    const retried = book[p.id] != null;
    const s = { kind: 'puzzle', game, mod, you, gameId: 'local-' + (++seq), state, start: state, ply: 0, over: false, closed: false,
      puzzle: p, cat: key, k: 0, used: 0, onLine: true, hinted: false, retried, busy: false };
    const no = list.indexOf(p) + 1;
    const goalText = p.goal === 'mate' ? `Chiếu hết trong ${p.n} nước` : p.goal === 'draw' ? 'Tìm đường cầm hòa' : 'Tìm nước giành thế thắng';
    const moves = [];
    if (p.last) moves.push({ m: p.last, t: 'Nước vừa đi' });
    open(s, Object.assign({
      gameId: s.gameId, table: null, game, rated: false, pace: 'normal', you, state, ply: 0, moves, clock: null,
      local: 'puzzle', resignLabel: 'Xem lời giải · cúng dường',
      title: `Thế cờ · ${cat.name} · Bài ${no}/${list.length}` + (p.rating ? ` · Độ khó ${p.rating}` : '')
    }, names(you, typeof host.name === 'function' ? host.name() || 'Bạn' : 'Bạn', 'Đề bài')));
    markPuzzle(p.id, 'x');
    toast(`${goalText}. Bạn cầm quân ${you === 'a' ? (game === 'chess' ? 'Trắng' : 'Đỏ') : 'Đen'}. Đi sai là trượt bài.`);
    return true;
  }
  // Dòng nước của đáp án, viết theo ký hiệu, tính từ thế ban đầu.
  function lineText(s) {
    const words = [];
    let st = s.start;
    for (const m of s.puzzle.moves) {
      words.push(s.mod.notation(st, m) || m);
      const r = s.mod.play(st, m);
      if (!r || !r.ok) break;
      st = r.state;
    }
    return words.join(' · ');
  }
  function failed(s, why) {
    end(s, { result: other(s.you), reason: 'puzzle-fail', head: 'Chưa giải được', text: why + ' Đáp án: ' + lineText(s) + '.', canRetry: true });
  }
  function solved(s) {
    const first = !s.retried && !s.hinted;
    markPuzzle(s.puzzle.id, first ? 1 : 2);
    end(s, {
      result: s.you, reason: 'puzzle', head: 'Giải đúng!',
      text: (first ? 'Giải ngay lần đầu, cao tay!' : s.hinted ? 'Giải đúng, có dùng gợi ý.' : 'Giải đúng sau khi thử lại.')
        + (s.onLine ? '' : ' Bạn tìm được đường khác đáp án, vẫn tính đúng.')
        + (s.puzzle.source && s.puzzle.source.startsWith('lichess:') ? ' Đề bài từ kho thế cờ Lichess.' : '')
    });
  }
  function puzzleMove(s, move, r, cb) {
    if (s.busy) return cb({ ok: false, reason: 'Đợi đối phương đi đã.' });
    const p = s.puzzle;
    if (p.goal !== 'mate') {
      // Tìm đường hòa / thắng thế: đi đúng đường của đề, sai một nước là trượt (nước sai vẫn hiện trên bàn)
      s.state = r.state; s.ply += 1; s.used += 1;
      cb({ ok: true });
      if (move !== p.moves[s.k]) { failed(s, 'Nước này chưa đúng.'); return; }
      s.k += 1;
      if (s.k >= p.moves.length) { solved(s); return; }
      const answer = p.moves[s.k];
      s.busy = true;
      setTimeout(() => {
        s.busy = false;
        if (s.over || s.closed) return;
        if (!reply(s, answer)) { solved(s); return; }
        s.k += 1;
        if (s.k >= p.moves.length) solved(s);
      }, REPLY_MS);
      return;
    }
    // Chiếu hết N nước: chấm theo kết quả, máy phòng thủ
    s.state = r.state; s.ply += 1; s.used += 1;
    if (s.onLine && move === p.moves[s.k]) s.k += 1; else s.onLine = false;
    cb({ ok: true });
    const st = s.mod.status(s.state);
    if (st && st.over) {
      if (st.winner === s.you) solved(s);
      else failed(s, 'Ván kết thúc mà chưa chiếu hết (hết nước đi, hòa).');
      return;
    }
    const left = p.n - s.used;
    if (left <= 0) { failed(s, `Đã đi đủ ${p.n} nước mà chưa chiếu hết.`); return; }
    s.busy = true;
    const at = s.ply, t0 = Date.now();
    defend(s.game, s.state, left).then(d => {
      if (s.over || s.closed || s.ply !== at) return;
      let move2 = null, escape = false;
      const stored = s.onLine ? p.moves[s.k] : null;
      if (d) { escape = !!d.escape; move2 = !escape && stored && s.mod.legalMoves(s.state).includes(stored) ? stored : d.move; }
      else move2 = stored || randomLegal(s);            // Worker lỗi: đi theo đáp án, không có thì nước bất kỳ
      if (s.onLine && move2 === stored) s.k += 1; else s.onLine = false;
      setTimeout(() => {
        s.busy = false;
        if (s.over || s.closed) return;
        if (!move2 || !reply(s, move2)) { failed(s, 'Đối phương không còn nước đi, ván hòa.'); return; }
        if (escape) failed(s, `Nước vừa rồi chưa đủ mạnh: đối phương thoát được, không thể chiếu hết trong ${p.n} nước.`);
      }, Math.max(0, REPLY_MS - (Date.now() - t0)));
    });
  }
  // Gợi ý trừ 5 công đức trên máy chủ (kd:hint qua host.requestHint); cùng một bước chỉ trả một lần.
  // Gợi ý theo đường đáp án: đi khác đáp án (vẫn có thể thắng) thì không còn gợi ý.
  function hint(s) {
    if (s.over) return;
    if (!s.onLine) { toast('Bạn đang đi khác đáp án nên không còn gợi ý. Cứ tiếp tục, chiếu hết đúng hạn vẫn tính đúng.'); return; }
    const k = s.k;
    if (!s.hints) s.hints = {};
    const show = sq => toast('Gợi ý: hãy xem quân ở ô ' + sq + '.');
    if (s.hints[k]) { show(s.hints[k]); return; }
    if (typeof host.requestHint !== 'function') { const m = s.puzzle.moves[k]; if (m) { s.hinted = true; show(m.slice(0, 2)); } return; }
    if (s.hintBusy) return;
    s.hintBusy = true;
    host.requestHint(s.puzzle.id, k, r => {
      s.hintBusy = false;
      if (!r || !r.ok) { toast((r && r.reason) || 'Chưa xin được gợi ý, thử lại nhé.'); return; }
      s.hints[k] = r.square; s.hinted = true;
      if (session === s && !s.closed) toast(`Gợi ý (−${r.cost} công đức): hãy xem quân ở ô ${r.square}.`);
    });
  }
  function showSolution(s) {
    end(s, { result: other(s.you), reason: 'solution', head: 'Lời giải', text: lineText(s), canRetry: true });
  }

  function init(h) { host = h || {}; }
  root.KydaoLocal = { init, playAi, loadPuzzles, categories, playPuzzle, GAMES, LEVELS, CATS, isOpen: () => !!session };
})(this);
