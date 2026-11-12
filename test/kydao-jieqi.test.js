'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const game = require('../public/js/kydao/xiangqi');

function inspectNoLeak(val) {
  const visited = new Set();
  const strings = [];
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
          if (k === 'board') {
            assert(Array.isArray(v), `Trường board phải là mảng tại ${path}.${k}`);
            for (const cell of v) {
              assert(cell === null || /^[rnbakcpxRNBAKCPX]$/.test(cell), `Ô bàn cờ không hợp lệ: ${cell}`);
            }
          }
          check(v, `${path}.${k}`);
        }
      }
      return;
    }
    if (typeof node === 'string') {
      strings.push(node);
    }
  }
  check(val, 'view');
  return strings;
}

function sequence(state, list) {
  for (const move of list) {
    const result = game.play(state, move);
    assert.equal(result.ok, true, move);
    state = result.state;
  }
  return state;
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

test('TH1: Quân úp ở ô Mã đi như Mã rồi lật ra Pháo, nước kế đi theo Pháo', () => {
  // Đỏ có Tướng e0, quân úp ở b0 (ô Mã của Đỏ, index 1) với quân thật trong hidden là Pháo Đỏ ('C').
  // Đen có Tướng d9 (index 84).
  const hidden = Array(90).fill(null);
  hidden[1] = 'C';
  const fen = '3k5/9/9/9/9/9/9/9/9/1X2K4 w - - 0 1';
  const state = game.fromFen(fen, { variant: 'jieqi', hidden });

  // Ban đầu b0 là ô Mã, đi theo quân chủ nhà Mã: có nước b0c2 (Mã 8 tiến 7)
  const list = game.legalMoves(state);
  assert(list.includes('b0c2'));
  assert.equal(game.notation(state, 'b0c2'), 'ÚM8.7');

  // Đỏ đi b0c2 lật ra Pháo Đỏ
  const res1 = game.play(state, 'b0c2');
  assert.equal(res1.ok, true);
  assert.deepEqual(res1.info.reveal, { mover: 'c' });
  assert.equal(res1.state.board[1], null);
  assert.equal(res1.state.board[20], 'C'); // c2 là index 20
  assert.equal(res1.state.hidden[1], null);

  // Đen đi một nước hợp lệ, ví dụ d9d8
  const res2 = game.play(res1.state, 'd9d8');
  assert.equal(res2.ok, true);

  // Nước kế tiếp của Đỏ: quân ở c2 nay là Pháo ngửa, phải sinh nước theo Pháo
  const movesRed = game.legalMoves(res2.state);
  const c2Moves = movesRed.filter(m => m.startsWith('c2'));

  // 1. Có các nước đi kiểu Pháo (đường thẳng trong ô trống)
  assert(c2Moves.includes('c2c5'), 'Pháo c2 đi dọc lên c5');
  assert(c2Moves.includes('c2e2'), 'Pháo c2 đi ngang sang e2');
  assert(c2Moves.includes('c2a2'), 'Pháo c2 đi ngang sang a2');
  assert.equal(game.notation(res2.state, 'c2e2'), 'P7-5');

  // 2. Không còn bất kỳ nước đi nào kiểu Mã từ c2 (chữ L: c2a1, c2a3, c2b4, c2d4, c2e1, c2e3)
  const knightJumps = ['c2a1', 'c2a3', 'c2b4', 'c2d4', 'c2e1', 'c2e3'];
  for (const kj of knightJumps) {
    assert(!c2Moves.includes(kj), `Quân đã lật ra Pháo không được đi nước kiểu Mã ${kj}`);
  }
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

test('TH4: Quân úp a0 (ô Xe) hidden là Tốt đi a0a9 lật ra Tốt, nước kế chỉ có a9b9 ăn quân úp Đen', () => {
  // Đỏ: Tướng e0, quân úp a0 (ô Xe Đỏ, index 0) có hidden là Tốt Đỏ ('P').
  // Đen: Tướng d9, quân úp b9 (ô Mã Đen, index 82) có hidden là Xe Đen ('r').
  // Cột a thông từ a0 tới a9.
  const hidden = Array(90).fill(null);
  hidden[0] = 'P';
  hidden[82] = 'r';

  // FEN: hàng 9: 1x1k5 (b9 là x, d9 là k), hàng 0: X3K4 (a0 là X, e0 là K)
  const fen = '1x1k5/9/9/9/9/9/9/9/9/X3K4 w - - 0 1';
  const state = game.fromFen(fen, { variant: 'jieqi', hidden });

  // 1. Quân úp a0 đi như Xe dọc cột a thông tới a9
  const moves1 = game.legalMoves(state);
  assert(moves1.includes('a0a9'));
  assert.equal(game.notation(state, 'a0a9'), 'ÚX9.9');

  const res1 = game.play(state, 'a0a9');
  assert.equal(res1.ok, true);
  // Lật ra Tốt Đỏ
  assert.deepEqual(res1.info.reveal, { mover: 'p' });
  assert.equal(res1.state.board[0], null);
  assert.equal(res1.state.board[81], 'P'); // a9 là (0, 9) -> index 81
  assert.equal(res1.state.hidden[0], null);

  // 2. Đen đi một nước hợp lệ, ví dụ d9d8
  const res2 = game.play(res1.state, 'd9d8');
  assert.equal(res2.ok, true);

  // 3. Nước kế tiếp của Đỏ: Tốt ở a9 (hàng cuối đối phương) chỉ có duy nhất nước a9b9
  const a9Moves = game.legalMoves(res2.state).filter(m => m.startsWith('a9'));
  assert.deepEqual(a9Moves, ['a9b9'], 'Tốt ở hàng cuối chỉ còn nước đi ngang duy nhất a9b9');

  // 4. Đỏ đi a9b9 ăn quân úp Đen ở b9
  const res3 = game.play(res2.state, 'a9b9');
  assert.equal(res3.ok, true);
  assert.equal(res3.info.capture, 'x');
  // Quân bị ăn lật công khai là Xe Đen ('r')
  assert.deepEqual(res3.info.reveal, { captured: 'r' });
  assert.equal(res3.state.board[82], 'P');
  assert.equal(res3.state.board[81], null);
  assert.equal(res3.state.hidden[82], null);
});

test('TH5: Quân úp bị ghim bảo vệ Tướng không được mở đường chiếu', () => {
  // Đen có Xe ở i0 (8, 0). Đỏ có Tướng e0 (4, 0) và quân úp ở f0 (5, 0).
  // f0 bị ghim: nước duy nhất theo ô Sĩ là f0e1, nhưng nước đó mở hàng 0 cho Xe chiếu Tướng nên CẤM!
  // Quân thật ở f0 là Xe ('R'), nhưng vì ô f0 chủ nhà là Sĩ nên không có bất kỳ nước đi nào của Xe (f0g0, f0h0, f0i0).
  const hidden = Array(90).fill(null);
  hidden[5] = 'R'; // f0 là x=5, y=0 -> index 5

  const fen = '4k4/9/9/9/9/9/9/9/9/4KX2r w - - 0 1';
  const state = game.fromFen(fen, { variant: 'jieqi', hidden });
  const moves = game.legalMoves(state);

  // f0e1 bị cấm do ghim
  assert(!moves.includes('f0e1'), 'Quân úp f0 bị ghim không được đi f0e1');

  // Dù quân thật là Xe ('R'), tuyệt đối không có nước f0g0 / f0h0 / f0i0
  assert(!moves.includes('f0g0'), 'Không có nước f0g0 dù quân thật là Xe');
  assert(!moves.includes('f0h0'), 'Không có nước f0h0 dù quân thật là Xe');
  assert(!moves.includes('f0i0'), 'Không có nước f0i0 dù quân thật là Xe');

  // Quân f0 hoàn toàn không có nước đi hợp lệ nào
  const f0Moves = moves.filter(m => m.startsWith('f0'));
  assert.deepEqual(f0Moves, [], 'Quân f0 bị ghim hoàn toàn không có nước hợp lệ');
});

test('Quân úp không bao giờ chiếu Tướng đối phương từ ô ban đầu', () => {
  // (a) Dựng thế chỉ có quân úp ở ô gốc:
  // e3 là ô Tốt Đỏ (x=4, y=3 -> index 31), quân thật trong hidden là Xe ('R').
  // Cột e thông thẳng tới Tướng Đen ở e9.
  // Nếu tính theo quân thật Xe thì đã chiếu thẳng Tướng Đen;
  // nhưng theo luật jieqi, quân úp đi theo ô chủ nhà (Tốt tại e3 chỉ tiến 1 bước tới e4),
  // nên Tướng Đen KHÔNG bị chiếu.
  const hiddenE3 = Array(90).fill(null);
  hiddenE3[31] = 'R';
  const fenE3 = '4k4/9/9/9/9/9/4X4/9/9/4K4 w - - 0 1';
  const stateE3 = game.fromFen(fenE3, { variant: 'jieqi', hidden: hiddenE3 });

  // Kiểm tra thế trước khi lật: Đỏ đi nước chờ e0d0
  const resWait = game.play(stateE3, 'e0d0');
  assert.equal(resWait.ok, true);
  // Tướng Đen không bị chiếu
  assert.equal(resWait.info.check, false);
  assert.equal(resWait.state.history[resWait.state.history.length - 1].check, false);
  assert.equal(game.status(resWait.state).over, false);

  // Khi quân úp e3 tiến lên e4 và lật ra Xe Đỏ: LÚC ĐÓ MỚI CHIẾU!
  const resReveal = game.play(stateE3, 'e3e4');
  assert.equal(resReveal.ok, true);
  assert.deepEqual(resReveal.info.reveal, { mover: 'r' });
  assert.equal(resReveal.info.check, true);
  assert.equal(resReveal.state.history[resReveal.state.history.length - 1].check, true);

  // Tương tự: quân úp ở e3 (ô Tốt Đỏ, index 31), quân thật là Pháo 'C', có ngòi Tốt Đen ở e6.
  // Nếu tính theo Pháo thì chiếu e9 qua ngòi e6; nhưng e3 là ô Tốt nên không chiếu.
  const hiddenCannon = Array(90).fill(null);
  hiddenCannon[31] = 'C';
  const fenCannon = '4k4/9/9/4p4/9/9/4X4/9/9/4K4 w - - 0 1';
  const stateCannon = game.fromFen(fenCannon, { variant: 'jieqi', hidden: hiddenCannon });
  const resCannon = game.play(stateCannon, 'e0d0');
  assert.equal(resCannon.ok, true);
  assert.equal(resCannon.info.check, false);
  assert.equal(resCannon.state.history[resCannon.state.history.length - 1].check, false);

  // Tương tự: quân úp ở d0 (ô Sĩ Đỏ, index 3), quân thật là Xe 'R'.
  // Tướng Đen ở d9, cột d thông. Ô d0 chủ nhà là Sĩ, không thể chiếu d9.
  const hiddenD0 = Array(90).fill(null);
  hiddenD0[3] = 'R';
  const fenD0 = '3k5/9/9/9/9/9/9/9/9/3XK4 w - - 0 1';
  const stateD0 = game.fromFen(fenD0, { variant: 'jieqi', hidden: hiddenD0 });
  const resD0 = game.play(stateD0, 'e0e1');
  assert.equal(resD0.ok, true);
  assert.equal(resD0.info.check, false);
  assert.equal(resD0.state.history[resD0.state.history.length - 1].check, false);

  // (b) Với nhiều seed khởi tạo ban đầu:
  // Thế trước khi lật không có quân úp nào tấn công ô Tướng đối phương (e9),
  // bên Đen cũng có đủ 44 nước hợp lệ nếu đổi lượt ngay từ đầu (không bị chiếu).
  // Và sau mọi nước đầu của Đỏ, phần tử history CUỐI phải khớp res.info.check.
  for (let sIdx = 1; sIdx <= 5; sIdx++) {
    const s = game.create({ variant: 'jieqi', seed: `no-check-init-${sIdx}` });
    const movesA = game.legalMoves(s);
    assert.equal(movesA.some(m => m.endsWith('e9')), false, 'Quân úp ở ô gốc không được tấn công e9');
    const blackMovesIfTurn = game.legalMoves({ ...s, turn: 'b' });
    assert.equal(blackMovesIfTurn.length, 44, 'Thế ban đầu bên Đen không bị chiếu nên có đủ 44 nước');
    for (const m of movesA) {
      const res = game.play(s, m);
      assert.equal(res.ok, true);
      const lastHistory = res.state.history[res.state.history.length - 1];
      assert.equal(lastHistory.check, res.info.check);
    }
  }
});

test('view(state, side) duyệt đệ quy tuyệt đối không rò rỉ danh tính quân chưa lật', () => {
  // 1. So sánh view của hai state cùng bàn nhưng hidden hoán vị khác nhau phải deepEqual
  const sA = game.create({ variant: 'jieqi', seed: 'leak-audit-seed-AAA' });
  const sB = game.create({ variant: 'jieqi', seed: 'leak-audit-seed-BBB' });
  assert.notDeepEqual(sA.hidden, sB.hidden, 'Hai seed khác nhau phải có hidden khác nhau');
  assert.deepEqual(sA.board, sB.board, 'Bàn cờ ban đầu của hai seed phải có cùng vị trí quân úp');
  assert.deepEqual(game.view(sA), game.view(sB), 'View của hai state cùng bàn nhưng hidden khác nhau phải deepEqual');
  assert.deepEqual(game.view(sA, 'a'), game.view(sB, 'b'), 'View của hai bên phải deepEqual');
  assert.deepEqual(game.view(sA), game.view(sA, 'a'));
  assert.deepEqual(game.view(sA), game.view(sA, 'b'));

  // 2. Dựng thế cờ cụ thể có quân úp: thay đổi quân thật trong hidden không làm đổi view
  const fen = '3k5/9/9/9/9/9/9/9/9/X3K4 w - - 0 1';
  const hiddenR = Array(90).fill(null);
  hiddenR[0] = 'R';
  const stateR = game.fromFen(fen, { variant: 'jieqi', hidden: hiddenR });

  const hiddenC = Array(90).fill(null);
  hiddenC[0] = 'C';
  const stateC = game.fromFen(fen, { variant: 'jieqi', hidden: hiddenC });

  const viewR = game.view(stateR);
  const viewC = game.view(stateC);
  assert.deepEqual(viewR, viewC, 'Đổi quân thật ở ô a0 từ R sang C không được làm thay đổi view');

  // Mọi chuỗi và mảng trong view không chứa ký hiệu quân thật 'R' của ô đang úp
  assert.equal(viewR.board[0], 'X');
  assert.equal(viewR.hidden, null);
  const stringsR = inspectNoLeak(viewR);
  for (const str of stringsR) {
    assert(!str.includes('R') && !str.includes('r'), `Phát hiện ký hiệu quân thật R/r trong chuỗi view: ${str}`);
  }
  const stringsC = inspectNoLeak(viewC);
  for (const str of stringsC) {
    assert(!str.includes('C') && !str.includes('c'), `Phát hiện ký hiệu quân thật C/c trong chuỗi view: ${str}`);
  }

  // 3. Sau khi đi 10 nước ngẫu nhiên, kiểm tra view vẫn tuyệt đối không rò rỉ
  let curr = sA;
  for (let step = 0; step < 10; step++) {
    const moves = game.legalMoves(curr);
    if (!moves.length) break;
    curr = game.play(curr, moves[0]).state;
    const v = game.view(curr);
    inspectNoLeak(v);
    assert.equal(v.hidden, null);
    // Tại mọi ô còn quân úp 'X' hoặc 'x' trên bàn, trong view chỉ là 'X' hoặc 'x'
    for (let i = 0; i < 90; i++) {
      if (curr.board[i] === 'X' || curr.board[i] === 'x') {
        assert.equal(v.board[i], curr.board[i]);
      }
    }
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

  // 3. Lặp thế ba lần trong jieqi
  // 3a. Lặp thế không ai chiếu liên tục -> Hòa
  const fenRepeat = '3k4r/9/9/9/9/9/9/9/9/R3K4 w - - 0 1';
  const stateRepeat = game.fromFen(fenRepeat, { variant: 'jieqi' });
  const repeated = sequence(stateRepeat, ['a0a1', 'i9i8', 'a1a0', 'i8i9', 'a0a1', 'i9i8', 'a1a0', 'i8i9']);
  assert.deepEqual(game.status(repeated), { over: true, winner: null, reason: 'Lặp thế ba lần' });

  // 3b. Lặp thế mà một bên chiếu liên tục -> Bên chiếu thua
  const fenCheckRepeat = '4k4/3R5/9/9/4P4/9/9/9/9/4K4 w - - 0 1';
  const stateCheckRepeat = game.fromFen(fenCheckRepeat, { variant: 'jieqi' });
  const chased = sequence(stateCheckRepeat, ['d8e8', 'e9d9', 'e8d8', 'd9e9', 'd8e8', 'e9d9', 'e8d8', 'd9e9']);
  assert.deepEqual(game.status(chased), { over: true, winner: 'b', reason: 'Chiếu liên tục khi lặp thế' });
});
