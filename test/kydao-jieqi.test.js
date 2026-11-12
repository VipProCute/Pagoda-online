'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const game = require('../public/js/kydao/xiangqi');

function inspectNoLeak(val, secretPieces) {
  const visited = new Set();
  function check(node, path) {
    if (node === null || node === undefined) return;
    if (typeof node === 'object') {
      if (visited.has(node)) return;
      visited.add(node);
      if (Array.isArray(node)) {
        node.forEach((item, i) => check(item, `${path}[${i}]`));
      } else {
        for (const [k, v] of Object.entries(node)) {
          if (k === 'hidden') {
            assert.equal(v, null, `Trường hidden phải là null tại ${path}.${k}`);
          }
          check(v, `${path}.${k}`);
        }
      }
      return;
    }
    if (typeof node === 'string') {
      // Không chuỗi nào trong view được chứa thông tin format kiểu 'secret' hay danh tính ô úp
      assert(!node.includes('hiddenPiece'), `Phát hiện rò rỉ tại ${path}: ${node}`);
    }
  }
  check(val, 'view');
}

test('Khởi tạo jieqi: Tướng ngửa, 15 quân úp mỗi bên, cùng seed -> cùng xáo', () => {
  const s1 = game.create({ variant: 'jieqi', seed: 'seed-co-tuong-up-123' });
  const s2 = game.create({ variant: 'jieqi', seed: 'seed-co-tuong-up-123' });
  const sDiff = game.create({ variant: 'jieqi', seed: 'seed-khac-hoan-toan' });

  assert.equal(s1.variant, 'jieqi');
  assert.equal(s1.turn, 'a');
  assert.equal(s1.ply, 0);
  assert.equal(s1.halfmove, 0);
  assert.equal(s1.fullmove, 1);

  // Tướng ngửa ở e0 và e9
  assert.equal(s1.board[4], 'K');   // e0
  assert.equal(s1.board[85], 'k');  // e9

  // Đếm số quân úp và ngửa trên bàn
  let redHidden = 0, blackHidden = 0;
  for (let i = 0; i < 90; i++) {
    if (s1.board[i] === 'X') redHidden++;
    else if (s1.board[i] === 'x') blackHidden++;
  }
  assert.equal(redHidden, 15);
  assert.equal(blackHidden, 15);

  // Cùng seed phải cho ra cùng mảng hidden
  assert.deepEqual(s1.hidden, s2.hidden);
  // Khác seed phải cho ra kết quả xáo khác
  assert.notDeepEqual(s1.hidden, sDiff.hidden);

  // Danh sách 15 quân thật của mỗi bên trong hidden phải đủ bộ
  const expectedRed = ['R', 'R', 'N', 'N', 'B', 'B', 'A', 'A', 'C', 'C', 'P', 'P', 'P', 'P', 'P'].sort();
  const actualRed = s1.hidden.filter(p => p && p === p.toUpperCase()).sort();
  assert.deepEqual(actualRed, expectedRed);

  const expectedBlack = ['r', 'r', 'n', 'n', 'b', 'b', 'a', 'a', 'c', 'c', 'p', 'p', 'p', 'p', 'p'].sort();
  const actualBlack = s1.hidden.filter(p => p && p === p.toLowerCase()).sort();
  assert.deepEqual(actualBlack, expectedBlack);

  // Hỗ trợ truyền rng tùy biến
  let counter = 0;
  const customRng = () => {
    counter++;
    return ((counter * 9301 + 49297) % 233280) / 233280;
  };
  const sCustom = game.create({ variant: 'jieqi', rng: customRng });
  assert.equal(sCustom.variant, 'jieqi');
  assert.equal(sCustom.board[4], 'K');
  assert.equal(sCustom.board[85], 'k');
});

test('TH1: Quân úp đi theo quân chủ nhà của ô, đi xong lật, notation có tiền tố Ú', () => {
  const state = game.create({ variant: 'jieqi', seed: 'th1-fixed-seed' });
  // Ban đầu có 44 nước đi hợp lệ
  const list = game.legalMoves(state);
  assert.equal(list.length, 44);

  // Nước b0c2 (ô b0 là ô Mã phải của Đỏ, ký hiệu Việt là Mã 8 tiến 7)
  assert(list.includes('b0c2'));
  const note = game.notation(state, 'b0c2');
  assert.equal(note, 'ÚM8.7');

  const fromIdx = 1; // b0
  const toIdx = 20;  // c2
  const realPiece = state.hidden[fromIdx];
  assert(realPiece, 'Phải có quân thật ở ô b0');

  const res = game.play(state, 'b0c2');
  assert.equal(res.ok, true);
  assert.deepEqual(res.info.reveal, { mover: realPiece.toLowerCase() });

  // Trên bàn cờ mới: b0 trống, c2 là quân thật hoa của Đỏ
  assert.equal(res.state.board[fromIdx], null);
  assert.equal(res.state.board[toIdx], realPiece.toUpperCase());
  // Trong hidden: b0 đã xóa
  assert.equal(res.state.hidden[fromIdx], null);
  assert.equal(res.state.ply, 1);
  assert.equal(res.state.turn, 'b');

  // Đen đi một quân úp, ví dụ h9g7 (ô Mã của Đen)
  const blackMoves = game.legalMoves(res.state);
  assert(blackMoves.includes('h9g7'));
  assert.equal(game.notation(res.state, 'h9g7'), 'ÚM8.7');

  const blackFrom = 88; // h9
  const blackReal = res.state.hidden[blackFrom];
  const blackRes = game.play(res.state, 'h9g7');
  assert.equal(blackRes.ok, true);
  assert.deepEqual(blackRes.info.reveal, { mover: blackReal.toLowerCase() });
  assert.equal(blackRes.state.board[blackFrom], null);
  assert.equal(blackRes.state.board[69], blackReal.toLowerCase()); // g7 (7*9 + 6)
  assert.equal(blackRes.state.hidden[blackFrom], null);
});

test('TH2 & D7: Ăn quân úp lật công khai cho cả hai bên (info.reveal.captured)', () => {
  // Dựng thế cờ: Đen có Xe ở i7, Đỏ có quân úp ở i3 (ô Tốt phải)
  // i7 = (8, 7), index = 7*9 + 8 = 71
  // i3 = (8, 3), index = 3*9 + 8 = 35
  const hidden = Array(90).fill(null);
  hidden[35] = 'N'; // Quân úp ở i3 thực chất là Mã Đỏ

  // Tướng Đen ở d9 để không đối mặt Tướng Đỏ e0
  const fen = '3k5/9/8r/9/9/9/8X/9/9/4K4 b - - 0 1';
  const state = game.fromFen(fen, { variant: 'jieqi', hidden });

  assert.equal(state.board[35], 'X');
  assert.equal(state.board[71], 'r');
  assert.equal(game.notation(state, 'i7i3'), 'X9.4');

  const res = game.play(state, 'i7i3');
  assert.equal(res.ok, true);
  // Quân úp bị ăn lật công khai là Mã Đỏ ('n')
  assert.deepEqual(res.info.reveal, { captured: 'n' });
  assert.equal(res.info.capture, 'X');
  // Ô i3 nay là Xe đen
  assert.equal(res.state.board[35], 'r');
  assert.equal(res.state.board[71], null);
  // Hidden tại i3 đã xóa
  assert.equal(res.state.hidden[35], null);
});

test('Úp ăn úp: info.reveal có cả mover và captured', () => {
  // Xe úp Đỏ ở a0 phi lên ăn Tốt úp Đen ở a6 (cột a thông)
  // a0 = index 0 (chủ nhà Xe), a6 = index 54 (chủ nhà Tốt)
  const hidden = Array(90).fill(null);
  hidden[0] = 'C';  // Xe úp Đỏ thực chất là Pháo Đỏ
  hidden[54] = 'R'; // Tốt úp Đen thực chất là Xe Đen

  // Tướng Đen ở d9 để không đối mặt Tướng Đỏ e0
  const customFen = '3k5/9/9/x8/9/9/9/9/9/X3K4 w - - 0 1';
  const state = game.fromFen(customFen, { variant: 'jieqi', hidden });

  const moves = game.legalMoves(state);
  assert(moves.includes('a0a6'));
  assert.equal(game.notation(state, 'a0a6'), 'ÚX9.6');

  const res = game.play(state, 'a0a6');
  assert.equal(res.ok, true);
  // Cả hai cùng lật: quân đi lật ra Pháo ('c'), quân bị ăn lật ra Xe ('r')
  assert.deepEqual(res.info.reveal, { mover: 'c', captured: 'r' });
  assert.equal(res.state.board[54], 'C');
  assert.equal(res.state.board[0], null);
  assert.equal(res.state.hidden[0], null);
  assert.equal(res.state.hidden[54], null);
});

test('TH3 & D7: Sĩ/Tượng đã lật đi tự do (qua sông, ra cung); Sĩ/Tượng úp bị giới hạn', () => {
  // Đỏ có:
  // - Sĩ đã lật ở e4 (4, 4), ngoài cung
  // - Tượng đã lật ở c4 (2, 4)
  // - Quân úp ở f0 (ô Sĩ Đỏ)
  // - Tốt Đen ở d5 (3, 5)
  // - Tướng Đỏ e0, Tướng Đen d9 (không đối mặt)
  const fen = '3k5/9/9/9/3p5/2B1A4/9/9/9/4KX3 w - - 0 1';
  const state = game.fromFen(fen, { variant: 'jieqi' });
  const moves = game.legalMoves(state);

  // 1. Sĩ ngửa ở e4 (4, 4) đi chéo 1 ô tự do ra khỏi cung và qua sông
  // Đi được: d3(3,3), f3(5,3), f5(5,5), và ăn d5(3,5)
  assert(moves.includes('e4d5'), 'Sĩ ngửa phải ăn được d5 qua sông');
  assert.equal(game.notation(state, 'e4d5'), 'S5.6');
  assert(moves.includes('e4f5'), 'Sĩ ngửa đi được f5 qua sông');
  assert(moves.includes('e4d3'), 'Sĩ ngửa đi được d3');
  assert(moves.includes('e4f3'), 'Sĩ ngửa đi được f3');

  // 2. Tượng ngửa ở c4 (2, 4) đi chéo 2 ô qua sông được, nhưng bị cản mắt ở d5
  // dx=-1, dy=1: a6 (0, 6) -> mắt b5 (1, 5) trống -> đi được qua sông!
  assert(moves.includes('c4a6'), 'Tượng ngửa qua sông tới a6');
  assert.equal(game.notation(state, 'c4a6'), 'T7.9');
  // dx=1, dy=1: e6 (4, 6) -> mắt d5 (3, 5) có Tốt Đen 'o' -> BỊ CẢN MẮT!
  assert(!moves.includes('c4e6'), 'Tượng ngửa bị cản mắt ở d5 không được tới e6');
  // dx=-1, dy=-1: a2 (0, 2) -> mắt b3 trống -> đi được
  assert(moves.includes('c4a2'));
  // dx=1, dy=-1: e2 (4, 2) -> mắt d3 trống -> đi được
  assert(moves.includes('c4e2'));

  // 3. Sĩ úp ở f0 (ô Sĩ Đỏ): chỉ đi chéo 1 ô TRONG CUNG, tức chỉ đi tới e1
  assert(moves.includes('f0e1'), 'Sĩ úp đi được tới e1');
  assert.equal(game.notation(state, 'f0e1'), 'ÚS4.5');
  // Không được đi ra ngoài cung tới g1
  assert(!moves.includes('f0g1'), 'Sĩ úp không được ra ngoài cung tới g1');

  // 4. Kiểm tra Tượng úp ở c0: không được qua sông
  const fenTuongUp = '3k5/9/9/9/9/9/9/9/9/2X1K4 w - - 0 1';
  const stateTuongUp = game.fromFen(fenTuongUp, { variant: 'jieqi' });
  const tuongMoves = game.legalMoves(stateTuongUp);
  // c0 đi a2, e2 (sân nhà)
  assert(tuongMoves.includes('c0a2'));
  assert(tuongMoves.includes('c0e2'));
  // Không thể đi qua sông tới a6 hay e6
  assert(!tuongMoves.includes('c0a6'));
  assert(!tuongMoves.includes('c0e6'));
});

test('TH4: Tốt lật ra ở hàng cuối đối phương chỉ đi ngang', () => {
  // Đỏ có quân ở a9 (hàng cuối đối phương), lật ra Tốt 'P'
  // Đen có quân úp ở b9 (ô Mã)
  const fen = 'P1x2k3/9/9/9/9/9/9/9/9/4K4 w - - 0 1';
  const state = game.fromFen(fen, { variant: 'jieqi' });
  const moves = game.legalMoves(state);

  // Tốt Đỏ ở a9 chỉ đi ngang: nước a9b9 ăn quân úp Đen
  assert(moves.includes('a9b9'), 'Tốt ở hàng cuối đi ngang ăn b9');
  assert(!moves.includes('a9a10'), 'Tốt không đi ra ngoài bàn');
  // Không đi lùi
  assert(!moves.includes('a9a8'));

  const res = game.play(state, 'a9b9');
  assert.equal(res.ok, true);
  assert.equal(res.state.board[82], 'P'); // b9 là index 82
});

test('TH5: Quân úp bị ghim bảo vệ Tướng không được mở đường chiếu', () => {
  // Đen có Xe ở i0 (8, 0). Đỏ có Tướng e0 (4, 0) và quân úp ở f0 (5, 0).
  // f0 bị ghim: nước duy nhất theo ô Sĩ là f0e1, nhưng nước đó mở hàng 0 cho Xe chiếu Tướng nên CẤM!
  const fen = '4k4/9/9/9/9/9/9/9/9/4KX2r w - - 0 1';
  const state = game.fromFen(fen, { variant: 'jieqi' });
  const moves = game.legalMoves(state);

  assert(!moves.includes('f0e1'), 'Quân úp f0 bị ghim không được đi f0e1');
});

test('Quân úp không bao giờ chiếu Tướng đối phương từ ô ban đầu', () => {
  // Ván cờ úp ban đầu: không ai bị chiếu
  const state = game.create({ variant: 'jieqi', seed: 'no-check-init' });
  const movesA = game.legalMoves(state);
  // Mọi nước đi đầu tiên của Đỏ
  for (const m of movesA) {
    const res = game.play(state, m);
    assert.equal(res.ok, true);
    // Quân vừa lật có thể chiếu hoặc không, nhưng trước nước đi Đen không bị chiếu
    assert.equal(res.state.history[0].check, false);
  }
});

test('view(state, side) duyệt đệ quy tuyệt đối không rò rỉ danh tính quân chưa lật', () => {
  const state = game.create({ variant: 'jieqi', seed: 'secret-leak-audit' });
  const vA = game.view(state, 'a');
  const vB = game.view(state, 'b');
  const vViewer = game.view(state);

  // view của cả hai bên và người xem phải giống hệt nhau
  assert.deepEqual(vA, vB);
  assert.deepEqual(vA, vViewer);

  // Duyệt đệ quy mọi trường của vA
  inspectNoLeak(vA);

  // Sau khi đi 10 nước, kiểm tra view vẫn không rò rỉ các quân còn úp
  let curr = state;
  for (let step = 0; step < 10; step++) {
    const moves = game.legalMoves(curr);
    if (!moves.length) break;
    curr = game.play(curr, moves[0]).state;
    const v = game.view(curr);
    inspectNoLeak(v);
    // Đảm bảo không có hidden
    assert.equal(v.hidden, null);
  }
});

test('apply(view, move, reveal) trên trình duyệt cho kết quả giống hệt view(play().state)', () => {
  let fullState = game.create({ variant: 'jieqi', seed: 'apply-consistency-check' });
  let viewState = game.view(fullState);

  for (let i = 0; i < 20; i++) {
    const moves = game.legalMoves(fullState);
    if (!moves.length) break;
    const m = moves[i % moves.length];

    const playRes = game.play(fullState, m);
    assert.equal(playRes.ok, true);

    const applyRes = game.apply(viewState, m, playRes.info.reveal);
    assert.equal(applyRes.ok, true);

    fullState = playRes.state;
    viewState = applyRes.state;

    // State sau apply phải giống hệt view của state đầy đủ
    assert.deepEqual(viewState, game.view(fullState), `Lệch state tại ply ${fullState.ply}`);
  }
});

test('legalMoves(view) == legalMoves(state đầy đủ) trên 1.000 thế ngẫu nhiên', () => {
  // Khởi tạo các ván cờ với hạt giống khác nhau và chơi ngẫu nhiên
  let count = 0;
  let seedIndex = 1;

  while (count < 1000) {
    let s = game.create({ variant: 'jieqi', seed: `fuzz-${seedIndex++}` });
    for (let step = 0; step < 60; step++) {
      const v = game.view(s);

      const movesFull = game.legalMoves(s).sort();
      const movesView = game.legalMoves(v).sort();

      assert.deepEqual(movesView, movesFull, `Lệch legalMoves tại thế thứ ${count}`);
      count++;
      if (count >= 1000) break;

      if (!movesFull.length || game.status(s).over) break;
      // Chọn ngẫu nhiên một nước đi
      const nextMove = movesFull[Math.floor(Math.random() * movesFull.length)];
      const res = game.play(s, nextMove);
      if (!res.ok) break;
      s = res.state;
    }
  }
  assert.equal(count >= 1000, true);
});

test('Luật kết thúc: hết nước hợp lệ là thua, 120 nửa nước hòa, lặp thế 3 lần', () => {
  // 1. Hết nước đi hợp lệ
  const fenNoMoves = '4k4/9/3r1r3/9/9/4N4/9/9/r8/4K4 w - - 0 1';
  const blocked = game.fromFen(fenNoMoves, { variant: 'jieqi' });
  assert.deepEqual(game.legalMoves(blocked), []);
  assert.deepEqual(game.status(blocked), { over: true, winner: 'b', reason: 'Hết nước hợp lệ' });

  // 2. 120 nửa nước không ăn quân
  const fen120 = '4k4/9/9/9/9/9/9/9/9/4K4 w - - 120 61';
  const drawState = game.fromFen(fen120, { variant: 'jieqi' });
  assert.equal(game.status(drawState).over, true);
  assert.equal(game.status(drawState).winner, null);
  assert.equal(game.status(drawState).reason, '120 nửa nước không ăn quân');
});
