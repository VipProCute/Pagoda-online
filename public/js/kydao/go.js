'use strict';

(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.KyGo = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const sides = ['a', 'b'];
  const KOMI = 7.5; // Luật Trung Quốc: Trắng (b) được cộng 7,5 điểm.
  const letters = 'ABCDEFGHJKLMNOPQRST';
  const other = side => side === 'a' ? 'b' : 'a';
  const copy = value => JSON.parse(JSON.stringify(value));

  // Băm nhanh (tính lại cả bàn, không cộng dồn kiểu Zobrist); tính đúng nhờ luôn đối chiếu
  // thêm chuỗi thế bàn khi băm trùng. Ghi chú: view()/history mang cả chuỗi bàn, T-020/T-028
  // nên cân nhắc bỏ history khỏi gói gửi client.
  function randomWord(seed) {
    let x = seed | 0;
    x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
    return x >>> 0;
  }
  function hash(board) {
    let a = 0; let b = 0;
    board.forEach((stone, i) => {
      if (!stone) return;
      const seed = (i * 2 + (stone === 'a' ? 1 : 2)) * 0x9e3779b1;
      a ^= randomWord(seed);
      b ^= randomWord(seed ^ 0x6d2b79f5);
    });
    return (a >>> 0).toString(16) + ':' + (b >>> 0).toString(16);
  }
  function key(board) { return board.map(v => v || '.').join(''); }
  function point(size, text) {
    if (typeof text !== 'string' || !/^[A-HJ-T](?:[1-9]|1[0-9])$/.test(text)) return -1;
    const x = letters.indexOf(text[0]);
    const y = Number(text.slice(1)) - 1;
    return x < size && y < size ? y * size + x : -1;
  }
  function label(size, i) { return letters[i % size] + (Math.floor(i / size) + 1); }
  function neighbors(size, i) {
    const x = i % size; const y = Math.floor(i / size); const out = [];
    if (x) out.push(i - 1);
    if (x + 1 < size) out.push(i + 1);
    if (y) out.push(i - size);
    if (y + 1 < size) out.push(i + size);
    return out;
  }
  function group(board, size, start) {
    const color = board[start]; const seen = new Set([start]); const liberties = new Set();
    const queue = [start];
    for (let n = 0; n < queue.length; n++) {
      neighbors(size, queue[n]).forEach(i => {
        if (!board[i]) liberties.add(i);
        else if (board[i] === color && !seen.has(i)) { seen.add(i); queue.push(i); }
      });
    }
    return { stones: queue, liberties: liberties };
  }
  function create(opts) {
    const size = opts && opts.size !== undefined ? opts.size : 9;
    if (![9, 13, 19].includes(size)) throw new RangeError('Kích thước bàn không hợp lệ.');
    const board = Array(size * size).fill(null);
    return { size: size, board: board, turn: 'a', phase: 'play', passes: 0,
      history: [{ hash: hash(board), board: key(board) }], dead: [], agreed: [], result: null };
  }
  function place(state, i) {
    if (state.board[i]) return null;
    const board = state.board.slice(); const side = state.turn; const captured = [];
    board[i] = side;
    neighbors(state.size, i).forEach(n => {
      if (board[n] !== other(side)) return;
      const g = group(board, state.size, n);
      if (!g.liberties.size) g.stones.forEach(p => { board[p] = null; captured.push(p); });
    });
    if (!group(board, state.size, i).liberties.size) return null;
    const h = hash(board); const k = key(board);
    if (state.history.some(entry => entry.hash === h && entry.board === k)) return null;
    return { board: board, hash: h, key: k, captured: captured };
  }
  // Chỉ loại quân đã được đánh dấu; vùng trống giáp cả hai màu là khí chung.
  function score(state) {
    const board = state.board.slice();
    state.dead.forEach(i => { board[i] = null; });
    const totals = { a: 0, b: KOMI }; const territory = { a: 0, b: 0 }; const seen = new Set();
    board.forEach((stone, i) => {
      if (stone) { totals[stone]++; return; }
      if (seen.has(i)) return;
      const queue = [i]; const borders = new Set(); seen.add(i);
      for (let n = 0; n < queue.length; n++) {
        neighbors(state.size, queue[n]).forEach(p => {
          if (board[p]) borders.add(board[p]);
          else if (!seen.has(p)) { seen.add(p); queue.push(p); }
        });
      }
      if (borders.size === 1) {
        const side = borders.values().next().value;
        territory[side] += queue.length; totals[side] += queue.length;
      }
    });
    return { a: totals.a, b: totals.b, territory: territory, komi: KOMI };
  }
  function finish(state) {
    const points = score(state);
    state.phase = 'finished';
    state.result = { over: true, winner: points.a > points.b ? 'a' : points.b > points.a ? 'b' : null,
      reason: 'Tính điểm', score: points };
  }
  // Trong giai đoạn đánh dấu, side là người thao tác; đồng hồ thuộc manager.
  function play(state, move, side) {
    const fail = () => ({ ok: false, reason: 'Nước đi không hợp lệ.' });
    if (state.phase === 'finished' || typeof move !== 'string') return fail();
    if (state.phase === 'mark') {
      if (!sides.includes(side)) return fail();
      const next = copy(state);
      if (move === 'resumePlay') {
        next.phase = 'play'; next.passes = 0; next.dead = []; next.agreed = [];
      } else if (move === 'agree') {
        if (next.agreed.includes(side)) return fail();
        next.agreed.push(side);
        if (next.agreed.length === 2) finish(next);
      } else if (move.startsWith('mark:')) {
        const i = point(state.size, move.slice(5));
        if (i < 0 || !state.board[i]) return fail();
        const stones = group(state.board, state.size, i).stones;
        const marked = new Set(next.dead); const remove = marked.has(i);
        stones.forEach(p => { if (remove) marked.delete(p); else marked.add(p); });
        next.dead = Array.from(marked).sort((a, b) => a - b); next.agreed = [];
      } else return fail();
      return { ok: true, state: next, info: {} };
    }
    if (side !== undefined && side !== state.turn) return fail();
    const next = copy(state);
    if (move === 'pass') {
      next.passes++;
      next.turn = other(state.turn);
      if (next.passes === 2) { next.phase = 'mark'; next.dead = []; next.agreed = []; }
      return { ok: true, state: next, info: {} };
    }
    const i = point(state.size, move);
    if (i < 0) return fail();
    const result = place(state, i);
    if (!result) return fail();
    next.board = result.board; next.turn = other(state.turn); next.passes = 0;
    next.history.push({ hash: result.hash, board: result.key });
    return { ok: true, state: next, info: { capture: result.captured.map(p => label(state.size, p)) } };
  }
  // Manager gọi khi hết ba phút; module thuần không tự giữ đồng hồ.
  function finalize(state) {
    if (state.phase !== 'mark') return { ok: false, reason: 'Chưa đến giai đoạn tính điểm.' };
    const next = copy(state);
    finish(next);
    return { ok: true, state: next, info: {} };
  }
  function legalMoves(state, side) {
    if (state.phase === 'finished') return [];
    if (state.phase === 'mark') {
      const done = side !== undefined && state.agreed.includes(side);
      return state.board.flatMap((v, i) => v ? ['mark:' + label(state.size, i)] : [])
        .concat(done ? [] : ['agree']).concat(['resumePlay']);
    }
    const moves = [];
    state.board.forEach((v, i) => { if (!v && place(state, i)) moves.push(label(state.size, i)); });
    moves.push('pass');
    return moves;
  }
  return { create: create, sides: sides, turn: state => state.turn, legalMoves: legalMoves,
    play: play, status: state => state.result ? copy(state.result) : { over: false },
    view: state => copy(state), notation: (state, move) => move, score: score, finalize: finalize, KOMI: KOMI };
}));
