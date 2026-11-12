'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const G = require('../public/js/kydao/gomoku');

// Đi một chuỗi nước (đều phải hợp lệ). Trả về state cuối.
function playAll(state, moves) {
  let s = state;
  for (const m of moves) {
    const r = G.play(s, m);
    assert.equal(r.ok, true, 'nước ' + m + ' bị từ chối: ' + (r.reason || ''));
    s = r.state;
  }
  return s;
}

// Nước xen kẽ cho bên còn lại: các ô hàng 15 (o15, n15, ...) không tạo dãy 5 và không chặn ai.
const FILLER = ['o15', 'n15', 'm15', 'l15', 'k15', 'j15', 'i15', 'h15'];

test('bàn mới là 15×15, X (bên a) đi trước, có 225 nước đi', () => {
  const s = G.create();
  assert.equal(s.size, 15);
  assert.equal(G.turn(s), 'a');
  assert.equal(G.legalMoves(s).length, 225);
  assert.deepEqual(G.status(s), { over: false });
  assert.deepEqual(G.sides, ['a', 'b']);
});

test('ký hiệu h8: cột a–o, hàng 1–15 (hàng 1 ở đáy), chữ hoa vẫn nhận', () => {
  const s = G.create();
  assert.ok(G.legalMoves(s).includes('h8'));
  assert.ok(G.legalMoves(s).includes('a1'));
  assert.ok(G.legalMoves(s).includes('o15'));
  assert.equal(G.play(s, 'H8').ok, true);
  assert.equal(G.notation(s, 'H8'), 'X h8');
  assert.equal(G.notation(s, 'zz'), '');
});

test('thắng ngang: 5 quân liên tiếp không bị chặn', () => {
  let s = G.create();
  s = playAll(s, ['f8', 'o15', 'g8', 'n15', 'h8', 'm15', 'i8', 'l15']);
  const r = G.play(s, 'j8');
  assert.equal(r.ok, true);
  assert.equal(r.state.over, true);
  assert.equal(r.state.winner, 'a');
  assert.deepEqual(G.status(r.state), { over: true, winner: 'a', reason: 'Đủ năm quân liên tiếp.' });
  assert.equal(r.info.win, true);
  assert.deepEqual(r.info.line, ['f8', 'g8', 'h8', 'i8', 'j8']);
});

test('thắng dọc', () => {
  let s = G.create();
  s = playAll(s, ['h1', 'o15', 'h2', 'n15', 'h3', 'm15', 'h4', 'l15']);
  const r = G.play(s, 'h5');
  assert.equal(r.state.over, true);
  assert.equal(r.state.winner, 'a');
});

test('thắng chéo chính (đi lên bên phải)', () => {
  let s = G.create();
  s = playAll(s, ['a1', 'o15', 'b2', 'n15', 'c3', 'm15', 'd4', 'l15']);
  const r = G.play(s, 'e5');
  assert.equal(r.state.over, true);
  assert.equal(r.state.winner, 'a');
});

test('thắng chéo ngược (đi lên bên trái)', () => {
  let s = G.create();
  s = playAll(s, ['e1', 'o15', 'd2', 'n15', 'c3', 'm15', 'b4', 'l15']);
  const r = G.play(s, 'a5');
  assert.equal(r.state.over, true);
  assert.equal(r.state.winner, 'a');
});

test('bên O thắng cũng theo đúng luật (đi sau)', () => {
  let s = G.create();
  // X đi rải rác hàng 1 (không liền nhau), O xếp dọc cột k từ k2 đến k5
  s = playAll(s, ['a1', 'k2', 'c1', 'k3', 'e1', 'k4', 'g1', 'k5', 'i1']);
  const r = G.play(s, 'k6');
  assert.equal(r.state.over, true);
  assert.equal(r.state.winner, 'b');
});

test('dãy 5 bị chặn cả hai đầu thì không thắng, ván tiếp tục', () => {
  let s = G.create();
  // a: g8 h8 i8 j8 k8; b chặn f8 và l8
  s = playAll(s, ['g8', 'f8', 'h8', 'l8', 'i8', 'a1', 'j8', 'a2']);
  const r = G.play(s, 'k8');
  assert.equal(r.ok, true);
  assert.equal(r.state.over, false);
  assert.equal(r.state.winner, null);
  assert.equal(G.turn(r.state), 'b');
});

test('chặn một đầu vẫn thắng', () => {
  let s = G.create();
  // a: f8..j8 ; b chặn e8, k8 trống
  s = playAll(s, ['f8', 'e8', 'g8', 'a1', 'h8', 'a2', 'i8', 'a3']);
  const r = G.play(s, 'j8');
  assert.equal(r.state.over, true);
  assert.equal(r.state.winner, 'a');
});

test('6 quân liên tiếp vẫn thắng (ghép từ hai dãy, hai đầu trống)', () => {
  let s = G.create();
  // a: f8 g8 h8 | j8 k8 rồi i8 ghép thành f8..k8 (6 quân), e8 và l8 trống
  s = playAll(s, ['f8', 'a1', 'g8', 'c1', 'h8', 'e1', 'j8', 'g1', 'k8', 'i1']);
  const r = G.play(s, 'i8');
  assert.equal(r.state.over, true);
  assert.equal(r.state.winner, 'a');
  assert.equal(r.info.line.length, 6);
});

test('sát mép bàn vẫn thắng: mép không tính là chặn', () => {
  let s = G.create();
  // a: a1..e1 sát mép trái; f1 do b chặn một đầu, đầu kia là mép bàn
  s = playAll(s, ['a1', 'a2', 'b1', 'a3', 'c1', 'a4', 'd1', 'f1']);
  const r = G.play(s, 'e1');
  assert.equal(r.state.over, true);
  assert.equal(r.state.winner, 'a');
});

test('sát mép bàn phải, đầu còn lại trống: thắng', () => {
  let s = G.create();
  // X: o1 n1 m1 l1 rồi k1 thành 5 sát mép phải; O xếp dọc cột o (không chặn được hàng 1)
  s = playAll(s, ['o1', 'o2', 'n1', 'o3', 'm1', 'o4', 'l1', 'o5']);
  const r = G.play(s, 'k1');
  assert.equal(r.state.over, true);
  assert.equal(r.state.winner, 'a');
});

test('ô đã có quân bị từ chối, lý do tiếng Việt', () => {
  let s = G.create();
  s = playAll(s, ['h8']);
  const r = G.play(s, 'h8');
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'Ô này đã có quân.');
});

test('nước ra ngoài bàn bị từ chối: cột p, hàng 0, hàng 16, chuỗi lạ', () => {
  const s = G.create();
  for (const bad of ['p1', 'a0', 'a16', 'z5', 'h99', '', 'hello']) {
    const r = G.play(s, bad);
    assert.equal(r.ok, false, bad);
    assert.equal(typeof r.reason, 'string');
    assert.ok(r.reason.length > 0);
  }
  assert.equal(G.play(s, 'p1').reason, 'Nước đi ra ngoài bàn.');
  assert.equal(G.play(s, 'a16').reason, 'Nước đi ra ngoài bàn.');
  assert.equal(G.play(s, 'hello').reason, 'Nước đi không hợp lệ, ví dụ h8.');
});

test('play không sửa state cũ', () => {
  const s = G.create();
  const before = JSON.stringify(s);
  const r = G.play(s, 'h8');
  assert.equal(r.ok, true);
  assert.equal(JSON.stringify(s), before);
  assert.notEqual(r.state, s);
});

test('sau ván kết thúc không nhận thêm nước, legalMoves rỗng', () => {
  let s = G.create();
  s = playAll(s, ['f8', 'o15', 'g8', 'n15', 'h8', 'm15', 'i8', 'l15', 'j8']);
  assert.deepEqual(G.legalMoves(s), []);
  const r = G.play(s, 'a1');
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'Ván đã kết thúc.');
});

test('kín bàn không ai thắng thì hòa', () => {
  // Thế kín 224 ô, không có dãy 5 cùng màu theo bất kỳ hướng nào:
  // màu ô (x, y) = 'a' khi (x + 2y) mod 4 < 2, ngược lại 'b'. Ô cuối là o1 (x=14, y=14).
  const n = 15;
  const cells = new Array(n * n).fill(null);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (x === 14 && y === 14) continue;
      cells[y * n + x] = ((x + 2 * y) % 4) < 2 ? 'a' : 'b';
    }
  }
  const s = { size: n, cells, ply: 224, over: false, winner: null, reason: null };
  assert.equal(G.turn(s), 'a');
  assert.deepEqual(G.legalMoves(s), ['o1']);
  const r = G.play(s, 'o1');
  assert.equal(r.ok, true);
  assert.equal(r.state.over, true);
  assert.equal(r.state.winner, null);
  assert.deepEqual(G.status(r.state), { over: true, winner: null, reason: 'Bàn kín, hòa.' });
});

test('view trả bản sao, sửa bản sao không ảnh hưởng state', () => {
  const s = playAll(G.create(), ['h8']);
  const v = G.view(s, 'b');
  assert.deepEqual(v, s);
  assert.notEqual(v, s);
  v.cells[0] = 'b';
  assert.equal(s.cells[0], null);
});

test('chuỗi ghi nhận cho người đọc dùng X/O theo lượt', () => {
  const s = G.create();
  assert.equal(G.notation(s, 'h8'), 'X h8');
  const s2 = playAll(s, ['h8']);
  assert.equal(G.notation(s2, 'g7'), 'O g7');
});
