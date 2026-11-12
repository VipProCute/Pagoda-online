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
  const isHidden = piece => piece === 'X' || piece === 'x';

  const RED_SLOTS = [
    index(0, 0), index(1, 0), index(2, 0), index(3, 0),
    index(5, 0), index(6, 0), index(7, 0), index(8, 0),
    index(1, 2), index(7, 2),
    index(0, 3), index(2, 3), index(4, 3), index(6, 3), index(8, 3)
  ];
  const BLACK_SLOTS = [
    index(0, 6), index(2, 6), index(4, 6), index(6, 6), index(8, 6),
    index(1, 7), index(7, 7),
    index(0, 9), index(1, 9), index(2, 9), index(3, 9),
    index(5, 9), index(6, 9), index(7, 9), index(8, 9)
  ];
  const RED_PIECES = ['R', 'R', 'N', 'N', 'B', 'B', 'A', 'A', 'C', 'C', 'P', 'P', 'P', 'P', 'P'];
  const BLACK_PIECES = ['r', 'r', 'n', 'n', 'b', 'b', 'a', 'a', 'c', 'c', 'p', 'p', 'p', 'p', 'p'];

  function hostType(x, y) {
    if (y === 0 || y === 9) {
      if (x === 0 || x === 8) return 'r';
      if (x === 1 || x === 7) return 'n';
      if (x === 2 || x === 6) return 'b';
      if (x === 3 || x === 5) return 'a';
      if (x === 4) return 'k';
    } else if (y === 2 || y === 7) {
      if (x === 1 || x === 7) return 'c';
    } else if (y === 3 || y === 6) {
      if (x === 0 || x === 2 || x === 4 || x === 6 || x === 8) return 'p';
    }
    return null;
  }

  function sfc32(a, b, c, d) {
    return function () {
      a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
      let t = (a + b) | 0; a = b ^ (b >>> 9); b = (c + (c << 3)) | 0;
      c = (c << 21) | (c >>> 11); d = (d + 1) | 0; t = (t + d) | 0; c = (c + t) | 0;
      return (t >>> 0) / 4294967296;
    };
  }

  function hashSeed(seed) {
    const str = String(seed);
    let h1 = 0xdeadbeef, h2 = 0x41c64e6d, h3 = 0x12345678, h4 = 0x87654321;
    for (let i = 0; i < str.length; i++) {
      const ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
      h3 = Math.imul(h3 ^ ch, 3812015801);
      h4 = Math.imul(h4 ^ ch, 2718281829);
    }
    return [h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0];
  }

  function makeRng(seed) {
    const [a, b, c, d] = hashSeed(seed);
    const rng = sfc32(a, b, c, d);
    for (let i = 0; i < 15; i++) rng();
    return rng;
  }

  function shuffle(array, rng) {
    const arr = array.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const temp = arr[i]; arr[i] = arr[j]; arr[j] = temp;
    }
    return arr;
  }

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

  function fromFen(fen, opts) {
    opts = opts || {};
    if (typeof fen !== 'string') throw new Error('FEN không hợp lệ');
    const fields = fen.trim().split(/\s+/);
    const rows = fields[0].split('/');
    if (fields.length !== 6 || rows.length !== 10 || !/^[wb]$/.test(fields[1]) || fields[2] !== '-' || fields[3] !== '-' || !/^\d+$/.test(fields[4]) || !/^[1-9]\d*$/.test(fields[5])) throw new Error('FEN không hợp lệ');
    const board = Array(90).fill(null);
    let hasHidden = false;
    rows.forEach((row, rank) => {
      let x = 0;
      for (const p of row) {
        if (/^[1-9]$/.test(p)) x += Number(p);
        else if (/^[rnbakcpxRNBAKCPX]$/.test(p)) {
          if (x >= 9) throw new Error('FEN không hợp lệ');
          if (p === 'x' || p === 'X') hasHidden = true;
          board[index(x++, 9 - rank)] = p;
        } else throw new Error('FEN không hợp lệ');
      }
      if (x !== 9) throw new Error('FEN không hợp lệ');
    });
    const halfmove = Number(fields[4]);
    const fullmove = Number(fields[5]);
    const turn = fields[1] === 'w' ? 'a' : 'b';
    const ply = (fullmove - 1) * 2 + (turn === 'b' ? 1 : 0);
    const variant = opts.variant || (hasHidden ? 'jieqi' : 'xiangqi');
    const hidden = opts.hidden ? opts.hidden.slice() : null;
    const state = { board, turn, halfmove, fullmove, ply, variant, hidden, history: [] };
    state.history.push({ key: key(state), side: null, check: false });
    return state;
  }
  function toFen(state) {
    return placement(state.board) + ' ' + (state.turn === 'a' ? 'w' : 'b') + ' - - ' + state.halfmove + ' ' + state.fullmove;
  }
  function create(opts) {
    opts = opts || {};
    const variant = opts.variant || 'xiangqi';
    if (variant !== 'xiangqi' && variant !== 'jieqi') throw new Error('Biến thể chưa được hỗ trợ');
    if (variant === 'xiangqi') {
      if (opts.hidden != null) throw new Error('Quân úp chưa được hỗ trợ');
      return fromFen(INITIAL);
    }
    const rng = typeof opts.rng === 'function' ? opts.rng : (opts.seed != null ? makeRng(opts.seed) : Math.random);
    const board = Array(90).fill(null);
    const hidden = Array(90).fill(null);

    board[index(4, 0)] = 'K';
    board[index(4, 9)] = 'k';

    const red = shuffle(RED_PIECES, rng);
    RED_SLOTS.forEach((slot, i) => {
      board[slot] = 'X';
      hidden[slot] = red[i];
    });

    const black = shuffle(BLACK_PIECES, rng);
    BLACK_SLOTS.forEach((slot, i) => {
      board[slot] = 'x';
      hidden[slot] = black[i];
    });

    const state = {
      board,
      turn: 'a',
      halfmove: 0,
      fullmove: 1,
      ply: 0,
      variant: 'jieqi',
      hidden,
      history: []
    };
    state.history.push({ key: key(state), side: null, check: false });
    return state;
  }

  // Sinh nước theo hình học; không tự kiểm tra an toàn của tướng.
  function pseudo(board, side, variant) {
    const moves = [];
    for (let y = 0; y < 10; y++) for (let x = 0; x < 9; x++) {
      const p = board[index(x, y)];
      if (!p || owner(p) !== side) continue;
      const hidden = isHidden(p);
      const type = hidden ? hostType(x, y) : p.toLowerCase();
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
        const canCrossRiver = variant === 'jieqi' && !hidden;
        for (const dx of [-1, 1]) for (const dy of [-1, 1]) {
          const nx = x + 2 * dx, ny = y + 2 * dy;
          if (inside(nx, ny) && (canCrossRiver || !river(ny, side)) && !board[index(x + dx, y + dy)]) add(nx, ny);
        }
      } else if (type === 'a') {
        const freeMove = variant === 'jieqi' && !hidden;
        for (const dx of [-1, 1]) for (const dy of [-1, 1]) {
          const nx = x + dx, ny = y + dy;
          if (inside(nx, ny) && (freeMove || palace(nx, ny, side))) add(nx, ny);
        }
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
  function checked(board, side, variant) {
    const king = board.indexOf(side === 'a' ? 'K' : 'k');
    if (king < 0) return true;
    return pseudo(board, other(side), variant).some(m => index(m[2], m[3]) === king);
  }
  function applyBoard(board, m) {
    const next = board.slice();
    next[index(m[2], m[3])] = next[index(m[0], m[1])];
    next[index(m[0], m[1])] = null;
    return next;
  }
  function legalRaw(state) {
    return pseudo(state.board, state.turn, state.variant).filter(m => {
      const target = state.board[index(m[2], m[3])];
      return (!target || target.toLowerCase() !== 'k') && !checked(applyBoard(state.board, m), state.turn, state.variant);
    });
  }
  function encode(m) { return square(m[0], m[1]) + square(m[2], m[3]); }
  function legalMoves(state) { return legalRaw(state).map(encode); }
  function play(state, move) {
    const m = legalRaw(state).find(candidate => encode(candidate) === move);
    if (!m) return { ok: false, reason: 'Nước đi không hợp lệ' };
    if (status(state).over) return { ok: false, reason: 'Ván cờ đã kết thúc' };

    const fromIdx = index(m[0], m[1]);
    const toIdx = index(m[2], m[3]);
    const mover = state.board[fromIdx];
    const target = state.board[toIdx];

    const nextBoard = state.board.slice();
    const nextHidden = state.hidden ? state.hidden.slice() : null;
    let reveal = null;

    if (state.variant === 'jieqi') {
      let moverReveal = null;
      let capturedReveal = null;

      if (isHidden(mover)) {
        const real = nextHidden ? nextHidden[fromIdx] : null;
        if (real) {
          moverReveal = real.toLowerCase();
          nextBoard[toIdx] = state.turn === 'a' ? real.toUpperCase() : real.toLowerCase();
          nextHidden[fromIdx] = null;
        } else {
          nextBoard[toIdx] = mover;
        }
      } else {
        nextBoard[toIdx] = mover;
      }
      nextBoard[fromIdx] = null;

      if (target && isHidden(target)) {
        const realCap = nextHidden ? nextHidden[toIdx] : null;
        if (realCap) {
          capturedReveal = realCap.toLowerCase();
          nextHidden[toIdx] = null;
        }
      }

      if (moverReveal || capturedReveal) {
        reveal = {};
        if (moverReveal) reveal.mover = moverReveal;
        if (capturedReveal) reveal.captured = capturedReveal;
      }
    } else {
      nextBoard[toIdx] = mover;
      nextBoard[fromIdx] = null;
    }

    const check = checked(nextBoard, other(state.turn), state.variant);
    const ply = (state.ply !== undefined ? state.ply : (state.fullmove - 1) * 2 + (state.turn === 'b' ? 1 : 0)) + 1;
    const next = {
      board: nextBoard,
      turn: other(state.turn),
      halfmove: target ? 0 : state.halfmove + 1,
      fullmove: state.fullmove + (state.turn === 'b' ? 1 : 0),
      ply,
      variant: state.variant,
      hidden: nextHidden,
      history: state.history.slice()
    };
    next.history.push({ key: key(next), side: state.turn, check });

    const info = { capture: target || null, check };
    if (reveal) info.reveal = reveal;
    return { ok: true, state: next, info };
  }

  function apply(state, move, reveal) {
    if (state.variant !== 'jieqi') return play(state, move);

    const m = legalRaw(state).find(candidate => encode(candidate) === move);
    if (!m) return { ok: false, reason: 'Nước đi không hợp lệ' };
    if (status(state).over) return { ok: false, reason: 'Ván cờ đã kết thúc' };

    const fromIdx = index(m[0], m[1]);
    const toIdx = index(m[2], m[3]);
    const mover = state.board[fromIdx];
    const target = state.board[toIdx];

    const nextBoard = state.board.slice();

    if (isHidden(mover)) {
      if (reveal && reveal.mover) {
        nextBoard[toIdx] = state.turn === 'a' ? reveal.mover.toUpperCase() : reveal.mover.toLowerCase();
      } else {
        nextBoard[toIdx] = mover;
      }
    } else {
      nextBoard[toIdx] = mover;
    }
    nextBoard[fromIdx] = null;

    const check = checked(nextBoard, other(state.turn), state.variant);
    const ply = (state.ply !== undefined ? state.ply : (state.fullmove - 1) * 2 + (state.turn === 'b' ? 1 : 0)) + 1;
    const next = {
      board: nextBoard,
      turn: other(state.turn),
      halfmove: target ? 0 : state.halfmove + 1,
      fullmove: state.fullmove + (state.turn === 'b' ? 1 : 0),
      ply,
      variant: state.variant,
      hidden: null,
      history: state.history.slice()
    };
    next.history.push({ key: key(next), side: state.turn, check });

    const info = { capture: target || null, check };
    if (reveal) info.reveal = reveal;
    return { ok: true, state: next, info };
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
    const hidden = isHidden(p);
    const type = hidden ? hostType(x, y) : p.toLowerCase();
    const pieceLabels = { r: 'X', n: 'M', b: 'T', a: 'S', k: 'Tg', c: 'P', p: 'B' };
    const label = (hidden ? 'Ú' : '') + pieceLabels[type];
    const file = col => state.turn === 'a' ? 9 - col : col + 1;
    let origin = String(file(x));
    if (!hidden) {
      const same = [];
      for (let rank = 0; rank < 10; rank++) if (state.board[index(x, rank)] === p) same.push(rank);
      if (same.length > 1) {
        same.sort((a, b) => state.turn === 'a' ? b - a : a - b);
        origin = same.length === 2 ? (same[0] === y ? 't' : 's') : String(same.indexOf(y) + 1);
      }
    }
    const forward = state.turn === 'a' ? ny > y : ny < y;
    const op = ny === y ? '-' : forward ? '.' : '/';
    const destination = ny === y || type === 'n' || type === 'b' || type === 'a' ? file(nx) : Math.abs(ny - y);
    return label + origin + op + destination;
  }
  function view(state) {
    const v = {
      board: state.board.slice(),
      turn: state.turn,
      halfmove: state.halfmove,
      fullmove: state.fullmove,
      ply: state.ply !== undefined ? state.ply : (state.fullmove - 1) * 2 + (state.turn === 'b' ? 1 : 0),
      variant: state.variant,
      hidden: null,
      history: state.history.map(h => ({ key: h.key, side: h.side, check: h.check }))
    };
    return JSON.parse(JSON.stringify(v));
  }
  return { create, sides, turn: state => state.turn, legalMoves, play, apply, status, view, notation, fromFen, toFen };
}));
