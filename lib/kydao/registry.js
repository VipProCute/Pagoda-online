'use strict';

// Danh mục luật và nhịp theo docs/KY-DAO-GIAO-THUC.md §2–3.
// TODO T-024: chỉ bật jieqi khi KyXiangqi hỗ trợ biến thể và che quân úp.
const chess = require('../../public/js/kydao/chess');
const xiangqi = require('../../public/js/kydao/xiangqi');
const go = require('../../public/js/kydao/go');
const gomoku = require('../../public/js/kydao/gomoku');

// Chuẩn hóa các module luật hiện có theo hợp đồng mà manager sử dụng.
const chessRules = {
  ...chess, sufficient: chess.canMate,
  create(opts) { return { ...chess.create(opts), ply: 0 }; },
  play(state, move) {
    const result = chess.play(state, move);
    return result.ok ? { ...result, state: { ...result.state, ply: state.ply + 1 } } : result;
  },
  status(state) {
    const result = chess.status(state);
    return result.reason === 'repetition' ? { ...result, reason: 'threefold' } : result;
  }
};
chessRules.apply = chessRules.play;

const xiangqiReasons = {
  'Hết nước hợp lệ': 'no-moves',
  'Chiếu liên tục khi lặp thế': 'perpetual',
  'Lặp thế ba lần': 'threefold',
  '120 nửa nước không ăn quân': 'sixty'
};
const xiangqiRules = {
  ...xiangqi,
  create(opts) { return { ...xiangqi.create(opts), ply: 0 }; },
  play(state, move) {
    const result = xiangqi.play(state, move);
    return result.ok ? { ...result, state: { ...result.state, ply: state.ply + 1 } } : result;
  },
  status(state) {
    const result = xiangqi.status(state);
    return result.over ? { ...result, reason: xiangqiReasons[result.reason] || result.reason } : result;
  }
};
xiangqiRules.apply = xiangqiRules.play;

const goLetters = 'ABCDEFGHJKLMNOPQRST';
function goPoint(state, point) {
  if (typeof point !== 'string' || !/^[A-HJ-T](?:[1-9]|1[0-9])$/.test(point)) return -1;
  const x = goLetters.indexOf(point[0]);
  const y = Number(point.slice(1)) - 1;
  return x < state.size && y < state.size ? y * state.size + x : -1;
}
function goLabel(state, index) {
  return goLetters[index % state.size] + (Math.floor(index / state.size) + 1);
}
const goRules = {
  ...go,
  create(opts) { return { ...go.create(opts), ply: 0 }; },
  play(state, move, side) {
    const result = go.play(state, move, side);
    if (!result.ok) return result;
    return { ...result, state: { ...result.state, ply: state.ply + (state.phase === 'play' ? 1 : 0) } };
  },
  status(state) {
    const result = go.status(state);
    if (result.over) return { ...result, reason: 'score' };
    return state.phase === 'mark' ? { over: false, phase: 'scoring' } : result;
  },
  groupAt(state, point) {
    const start = goPoint(state, point);
    if (start < 0) return [];
    const color = state.board[start];
    const seen = new Set([start]);
    const queue = [start];
    let touchesStone = !!color;
    for (let i = 0; i < queue.length; i++) {
      const pos = queue[i]; const x = pos % state.size; const y = Math.floor(pos / state.size);
      const neighbors = [];
      if (x > 0) neighbors.push(pos - 1);
      if (x + 1 < state.size) neighbors.push(pos + 1);
      if (y > 0) neighbors.push(pos - state.size);
      if (y + 1 < state.size) neighbors.push(pos + state.size);
      neighbors.forEach(n => {
        if (state.board[n]) touchesStone = true;
        if (state.board[n] === color && !seen.has(n)) { seen.add(n); queue.push(n); }
      });
    }
    return touchesStone ? queue.map(i => goLabel(state, i)) : [];
  },
  score(state, dead) {
    const marked = dead === undefined ? state.dead : dead.map(point => goPoint(state, point)).filter(i => i >= 0 && state.board[i]);
    const result = go.score({ ...state, dead: marked });
    return { ...result, detail: { territory: result.territory } };
  },
  resume(state, side) {
    const result = go.play(state, 'resumePlay', side);
    return result.ok ? { ...result.state, turn: side } : state;
  }
};
goRules.apply = goRules.play;

const gomokuRules = {
  ...gomoku, apply: gomoku.play,
  status(state) {
    const result = gomoku.status(state);
    return result.over ? { ...result, reason: result.winner === null ? 'full-board' : 'five' } : result;
  },
  notation(state, move) { return move; }
};

const registry = Object.freeze({
  chess: {
    id: 'chess', name: 'Cờ vua', module: chessRules,
    paces: { fast: { baseMs: 300000, incMs: 3000 }, normal: { baseMs: 600000, incMs: 5000 } },
    minPlies: 4, maxPlies: 300, movePattern: /^[a-h][1-8][a-h][1-8][qrbn]?$/
  },
  xiangqi: {
    id: 'xiangqi', name: 'Cờ tướng', module: xiangqiRules,
    paces: { fast: { baseMs: 600000, incMs: 5000 }, normal: { baseMs: 900000, incMs: 10000 } },
    minPlies: 4, maxPlies: 300, movePattern: /^[a-i][0-9][a-i][0-9]$/
  },
  go: {
    id: 'go', name: 'Cờ vây', module: goRules, sizes: [9, 13, 19], ratedSizes: [9],
    paces: { fast: { baseMs: 300000, incMs: 5000 }, normal: { baseMs: 600000, incMs: 10000 } },
    minPlies: 20, maxPlies: { 9: 200, 13: 400, 19: 800 }, movePattern: /^(?:pass|[A-HJ-T](?:1[0-9]|[1-9]))$/
  },
  gomoku: {
    id: 'gomoku', name: 'Caro', module: gomokuRules,
    paces: { fast: { baseMs: 180000, incMs: 3000 }, normal: { baseMs: 300000, incMs: 5000 } },
    minPlies: 10, maxPlies: 225, movePattern: /^[a-o](?:1[0-5]|[1-9])$/
  }
});

// Không tra qua prototype: tên môn đến từ dữ liệu bên ngoài.
function get(id) {
  return typeof id === 'string' && Object.prototype.hasOwnProperty.call(registry, id) ? registry[id] : null;
}

module.exports = { registry, get };
