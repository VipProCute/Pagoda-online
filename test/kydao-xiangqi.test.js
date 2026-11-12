'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const game = require('../public/js/kydao/xiangqi');

function position(pieces, side = 'w', halfmove = 0) {
  const board = Array.from({ length: 10 }, () => Array(9).fill(null));
  for (const [sq, p] of Object.entries(pieces)) board[Number(sq[1])][sq.charCodeAt(0) - 97] = p;
  const rows = board.reverse().map(row => {
    let text = '', n = 0;
    for (const p of row) {
      if (!p) n++;
      else { if (n) text += n; n = 0; text += p; }
    }
    return text + (n || '');
  });
  return game.fromFen(rows.join('/') + ' ' + side + ' - - ' + halfmove + ' 1');
}
function moves(pieces, side) { return game.legalMoves(position(pieces, side)); }
function perft(state, depth) {
  if (!depth) return 1;
  const list = game.legalMoves(state);
  if (depth === 1) return list.length;
  return list.reduce((sum, move) => sum + perft(game.play(state, move).state, depth - 1), 0);
}
function sequence(state, list) {
  for (const move of list) {
    const result = game.play(state, move);
    assert.equal(result.ok, true, move);
    state = result.state;
  }
  return state;
}

test('UMD, FEN khứ hồi và state thuần không bị sửa', () => {
  const sandbox = {};
  vm.runInNewContext(fs.readFileSync(require.resolve('../public/js/kydao/xiangqi'), 'utf8'), sandbox);
  assert.equal(typeof sandbox.KyXiangqi.create, 'function');
  const state = game.create();
  const fen = 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w - - 0 1';
  assert.equal(game.toFen(state), fen);
  assert.equal(game.toFen(game.fromFen(fen)), fen);
  Object.freeze(state.board); Object.freeze(state.history); Object.freeze(state);
  const result = game.play(state, 'h2e2');
  assert.equal(result.ok, true);
  assert.equal(game.toFen(state), fen);
  assert.equal(state.variant, 'xiangqi');
  assert.equal(state.hidden, null);
  assert.notEqual(game.view(state), state);
  assert.throws(() => game.create({ variant: 'jieqi' }));
  assert.throws(() => game.fromFen('không hợp lệ'));
});

test('perft thế đầu d1–d3', () => {
  const state = game.create();
  assert.equal(perft(state, 1), 44);
  assert.equal(perft(state, 2), 1920);
  assert.equal(perft(state, 3), 79666);
  if (process.env.PERFT_DEEP === '1') assert.equal(perft(state, 4), 3290240);
});

test('lộ mặt tướng, mắt tượng, chân mã và ngòi pháo', () => {
  let list = moves({ e0: 'K', e9: 'k', e4: 'R' });
  assert(!list.includes('e4d4'));
  list = moves({ e0: 'K', d9: 'k', c0: 'B', d1: 'P' });
  assert(!list.includes('c0e2'));
  assert(list.includes('c0a2'));
  list = moves({ e0: 'K', d9: 'k', b0: 'N', b1: 'P' });
  assert(!list.includes('b0a2')); assert(!list.includes('b0c2'));
  list = moves({ e0: 'K', d9: 'k', a0: 'C', a2: 'P', a5: 'r', a7: 'n' });
  assert(list.includes('a0a5')); assert(!list.includes('a0a7')); assert(!list.includes('a0a3'));
  list = moves({ e0: 'K', d9: 'k', a0: 'C', a5: 'r' });
  assert(!list.includes('a0a5'));
});

test('sông và cung giới hạn đường đi', () => {
  let list = moves({ e0: 'K', d9: 'k', a4: 'P', c4: 'B' });
  assert(!list.includes('a4b4')); assert(list.includes('a4a5')); assert(!list.includes('c4e6'));
  list = moves({ e0: 'K', d9: 'k', a5: 'P', d2: 'A' });
  assert(list.includes('a5b5')); assert(!list.includes('d2c3')); assert(list.includes('e0e1'));
  list = moves({ e2: 'K', d9: 'k', d2: 'A' });
  assert(!list.includes('e2e3')); assert(!list.includes('d2c1'));
});

test('ký hiệu Việt theo hướng mỗi bên và quân trước sau', () => {
  const state = game.create();
  assert.equal(game.notation(state, 'h2e2'), 'P2-5');
  assert.equal(game.notation(state, 'b0c2'), 'M8.7');
  const s = position({ e0: 'K', d9: 'k', i1: 'R', a1: 'R', a3: 'R' });
  assert.equal(game.notation(s, 'i1i0'), 'X1/1');
  assert.equal(game.notation(s, 'a3a4'), 'Xt.1');
  assert.equal(game.notation(s, 'a1a2'), 'Xs.1');
});

test('hết nước là thua, 120 nửa nước không ăn là hòa', () => {
  const trapped = position({ e0: 'K', e9: 'k', d1: 'r', f1: 'r', e2: 'r' });
  assert.deepEqual(game.status(trapped), { over: true, winner: 'b', reason: 'Hết nước hợp lệ' });
  const draw = position({ e0: 'K', d9: 'k', a0: 'R' }, 'w', 120);
  assert.equal(game.status(draw).winner, null);
  assert.equal(game.play(draw, 'a0a1').ok, false);
  const capture = position({ e0: 'K', d9: 'k', a0: 'R', a1: 'p' }, 'w', 119);
  assert.equal(game.play(capture, 'a0a1').state.halfmove, 0);
});

test('lặp ba lần: hòa hoặc bên chiếu liên tục thua', () => {
  const normal = position({ e0: 'K', d9: 'k', a0: 'R', i9: 'r' });
  const repeated = sequence(normal, ['a0a1', 'i9i8', 'a1a0', 'i8i9', 'a0a1', 'i9i8', 'a1a0', 'i8i9']);
  assert.equal(game.status(repeated).winner, null);
  assert.equal(game.status(repeated).reason, 'Lặp thế ba lần');
  const checking = position({ e0: 'K', e9: 'k', d8: 'R', e4: 'P' });
  const chased = sequence(checking, ['d8e8', 'e9d9', 'e8d8', 'd9e9', 'd8e8', 'e9d9', 'e8d8', 'd9e9']);
  assert.equal(game.status(chased).winner, 'b');
  assert.equal(game.status(chased).reason, 'Chiếu liên tục khi lặp thế');
  // Một chiếu một dừng: Đỏ xen nước chiếu và nước không chiếu thì chỉ hòa
  const mixed = position({ e0: 'K', e9: 'k', d8: 'R', e4: 'P' });
  const dawn = sequence(mixed, ['d8e8', 'e9f9', 'e8d8', 'f9e9', 'd8e8', 'e9f9', 'e8d8', 'f9e9']);
  assert.deepEqual(game.status(dawn), { over: true, winner: null, reason: 'Lặp thế ba lần' });
});

test('hết nước hợp lệ mà không bị chiếu vẫn là thua', () => {
  const blocked = game.fromFen('4k4/9/3r1r3/9/9/4N4/9/9/r8/4K4 w - - 0 1');
  assert.deepEqual(game.legalMoves(blocked), []);
  assert.deepEqual(game.status(blocked), { over: true, winner: 'b', reason: 'Hết nước hợp lệ' });
  const stalemate = position({ e0: 'K', f9: 'k', d8: 'r', a1: 'r' });
  assert.deepEqual(game.legalMoves(stalemate), []);
  assert.deepEqual(game.status(stalemate), { over: true, winner: 'b', reason: 'Hết nước hợp lệ' });
});

test('ký hiệu Việt của bên Đen và FEN lượt đen khứ hồi', () => {
  const state = sequence(game.create(), ['h2e2']);
  assert.equal(game.notation(state, 'b7e7'), 'P2-5');
  assert.equal(game.notation(state, 'h9g7'), 'M8.7');
  assert.equal(game.notation(state, 'i9i8'), 'X9.1');
  const s = position({ e0: 'K', d9: 'k', a8: 'r', a6: 'r' }, 'b');
  assert.equal(game.notation(s, 'a6a5'), 'Xt.1');
  assert.equal(game.notation(s, 'a8a7'), 'Xs.1');
  const fen = '4k4/9/9/9/9/9/9/9/9/4K4 b - - 7 12';
  assert.equal(game.toFen(game.fromFen(fen)), fen);
});
