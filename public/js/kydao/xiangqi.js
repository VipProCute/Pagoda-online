(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.KyXiangqi = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const INITIAL = 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w - - 0 1';
  const sides = Object.freeze(['a', 'b']);
  const other = side => side === 'a' ? 'b' : 'a';
  const owner = piece => piece === piece.toUpperCase() ? 'a' : 'b';
  const index = (x, y) => y * 9 + x;
  const inside = (x, y) => x >= 0 && x < 9 && y >= 0 && y < 10;
  const square = (x, y) => String.fromCharCode(97 + x) + y;
  const palace = (x, y, side) => x >= 3 && x <= 5 && (side === 'a' ? y <= 2 : y >= 7);
  const river = (y, side) => side === 'a' ? y >= 5 : y <= 4;

  function placement(board) {
    const rows = [];
    for (let y = 9; y >= 0; y--) {
      let row = '', empty = 0;
      for (let x = 0; x < 9; x++) {
        const p = board[index(x, y)];
        if (!p) empty++;
        else { if (empty) row += empty; empty = 0; row += p; }
      }
      if (empty) row += empty;
      rows.push(row);
    }
    return rows.join('/');
  }
  function key(state) { return placement(state.board) + ' ' + state.turn; }

  function fromFen(fen) {
    if (typeof fen !== 'string') throw new Error('FEN không hợp lệ');
    const fields = fen.trim().split(/\s+/);
    const rows = fields[0].split('/');
    if (fields.length !== 6 || rows.length !== 10 || !/^[wb]$/.test(fields[1]) || fields[2] !== '-' || fields[3] !== '-' || !/^\d+$/.test(fields[4]) || !/^[1-9]\d*$/.test(fields[5])) throw new Error('FEN không hợp lệ');
    const board = Array(90).fill(null);
    rows.forEach((row, rank) => {
      let x = 0;
      for (const p of row) {
        if (/^[1-9]$/.test(p)) x += Number(p);
        else if (/^[rnbakcpRNBAKCP]$/.test(p)) {
          if (x >= 9) throw new Error('FEN không hợp lệ');
          board[index(x++, 9 - rank)] = p;
        } else throw new Error('FEN không hợp lệ');
      }
      if (x !== 9) throw new Error('FEN không hợp lệ');
    });
    const state = { board, turn: fields[1] === 'w' ? 'a' : 'b', halfmove: Number(fields[4]), fullmove: Number(fields[5]), variant: 'xiangqi', hidden: null, history: [] };
    state.history.push({ key: key(state), side: null, check: false });
    return state;
  }
  function toFen(state) {
    return placement(state.board) + ' ' + (state.turn === 'a' ? 'w' : 'b') + ' - - ' + state.halfmove + ' ' + state.fullmove;
  }
  function create(opts) {
    opts = opts || {};
    if (opts.variant && opts.variant !== 'xiangqi') throw new Error('Biến thể chưa được hỗ trợ');
    if (opts.hidden != null) throw new Error('Quân úp chưa được hỗ trợ');
    return fromFen(INITIAL);
  }

  // Sinh nước theo hình học; không tự kiểm tra an toàn của tướng.
  function pseudo(board, side) {
    const moves = [];
    for (let y = 0; y < 10; y++) for (let x = 0; x < 9; x++) {
      const p = board[index(x, y)];
      if (!p || owner(p) !== side) continue;
      const type = p.toLowerCase();
      function add(nx, ny) {
        if (!inside(nx, ny)) return;
        const target = board[index(nx, ny)];
        if (!target || owner(target) !== side) moves.push([x, y, nx, ny]);
      }
      if (type === 'r' || type === 'c') {
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          let nx = x + dx, ny = y + dy, screen = false;
          while (inside(nx, ny)) {
            const target = board[index(nx, ny)];
            if (type === 'r') {
              if (!target) add(nx, ny);
              else { add(nx, ny); break; }
            } else if (!screen) {
              if (!target) add(nx, ny); else screen = true;
            } else if (target) { add(nx, ny); break; }
            nx += dx; ny += dy;
          }
        }
      } else if (type === 'n') {
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          if (board[index(x + dx, y + dy)] || !inside(x + dx, y + dy)) continue;
          for (const sign of [-1, 1]) add(x + 2 * dx + sign * dy, y + 2 * dy + sign * dx);
        }
      } else if (type === 'b') {
        for (const dx of [-1, 1]) for (const dy of [-1, 1]) {
          const nx = x + 2 * dx, ny = y + 2 * dy;
          if (inside(nx, ny) && !river(ny, side) && !board[index(x + dx, y + dy)]) add(nx, ny);
        }
      } else if (type === 'a') {
        for (const dx of [-1, 1]) for (const dy of [-1, 1]) if (palace(x + dx, y + dy, side)) add(x + dx, y + dy);
      } else if (type === 'k') {
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (palace(x + dx, y + dy, side)) add(x + dx, y + dy);
        // Tướng nhìn thẳng tướng cũng là một đòn chiếu.
        const dy = side === 'a' ? 1 : -1;
        for (let ny = y + dy; inside(x, ny); ny += dy) {
          const target = board[index(x, ny)];
          if (target) { if (target.toLowerCase() === 'k' && owner(target) !== side) add(x, ny); break; }
        }
      } else if (type === 'p') {
        add(x, y + (side === 'a' ? 1 : -1));
        if (river(y, side)) { add(x - 1, y); add(x + 1, y); }
      }
    }
    return moves;
  }
  function checked(board, side) {
    const king = board.indexOf(side === 'a' ? 'K' : 'k');
    if (king < 0) return true;
    return pseudo(board, other(side)).some(m => index(m[2], m[3]) === king);
  }
  function applyBoard(board, m) {
    const next = board.slice();
    next[index(m[2], m[3])] = next[index(m[0], m[1])];
    next[index(m[0], m[1])] = null;
    return next;
  }
  function legalRaw(state) {
    return pseudo(state.board, state.turn).filter(m => {
      const target = state.board[index(m[2], m[3])];
      return (!target || target.toLowerCase() !== 'k') && !checked(applyBoard(state.board, m), state.turn);
    });
  }
  function encode(m) { return square(m[0], m[1]) + square(m[2], m[3]); }
  function legalMoves(state) { return legalRaw(state).map(encode); }
  function play(state, move) {
    const m = legalRaw(state).find(candidate => encode(candidate) === move);
    if (!m) return { ok: false, reason: 'Nước đi không hợp lệ' };
    if (status(state).over) return { ok: false, reason: 'Ván cờ đã kết thúc' };
    const capture = state.board[index(m[2], m[3])];
    const board = applyBoard(state.board, m);
    const check = checked(board, other(state.turn));
    const next = { board, turn: other(state.turn), halfmove: capture ? 0 : state.halfmove + 1, fullmove: state.fullmove + (state.turn === 'b' ? 1 : 0), variant: state.variant, hidden: state.hidden, history: state.history.slice() };
    next.history.push({ key: key(next), side: state.turn, check });
    return { ok: true, state: next, info: { capture: capture || null, check } };
  }
  function status(state) {
    if (!legalRaw(state).length) return { over: true, winner: other(state.turn), reason: 'Hết nước hợp lệ' };
    const current = key(state);
    const positions = [];
    state.history.forEach((entry, i) => { if (entry.key === current) positions.push(i); });
    if (positions.length >= 3) {
      const cycle = state.history.slice(positions[positions.length - 3] + 1);
      const offenders = sides.filter(side => {
        const moves = cycle.filter(entry => entry.side === side);
        return moves.length > 0 && moves.every(entry => entry.check);
      });
      if (offenders.length === 1) return { over: true, winner: other(offenders[0]), reason: 'Chiếu liên tục khi lặp thế' };
      return { over: true, winner: null, reason: 'Lặp thế ba lần' };
    }
    if (state.halfmove >= 120) return { over: true, winner: null, reason: '120 nửa nước không ăn quân' };
    return { over: false };
  }
  function notation(state, move) {
    const m = legalRaw(state).find(candidate => encode(candidate) === move);
    if (!m) return '';
    const [x, y, nx, ny] = m;
    const p = state.board[index(x, y)];
    const type = p.toLowerCase();
    const label = { r: 'X', n: 'M', b: 'T', a: 'S', k: 'Tg', c: 'P', p: 'B' }[type];
    const same = [];
    for (let rank = 0; rank < 10; rank++) if (state.board[index(x, rank)] === p) same.push(rank);
    const file = col => state.turn === 'a' ? 9 - col : col + 1;
    let origin = String(file(x));
    if (same.length > 1) {
      same.sort((a, b) => state.turn === 'a' ? b - a : a - b);
      origin = same.length === 2 ? (same[0] === y ? 't' : 's') : String(same.indexOf(y) + 1);
    }
    const forward = state.turn === 'a' ? ny > y : ny < y;
    const op = ny === y ? '-' : forward ? '.' : '/';
    const destination = ny === y || type === 'n' || type === 'b' || type === 'a' ? file(nx) : Math.abs(ny - y);
    return label + origin + op + destination;
  }
  function view(state) { return JSON.parse(JSON.stringify(state)); }
  return { create, sides, turn: state => state.turn, legalMoves, play, status, view, notation, fromFen, toFen };
}));
