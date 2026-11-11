'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../public/js/kydao/chess');

const DEEP = process.env.PERFT_DEEP === '1';

/* Số chuẩn: Chess Programming Wiki "Perft Results" (Phụ lục A của kế hoạch đợt 2026-11) */
const PERFT = [
  { ten: 'Đầu ván', fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', n: [20, 400, 8902, 197281] },
  { ten: 'Kiwipete', fen: 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1', n: [48, 2039, 97862, 4085603] },
  { ten: 'Thế 3', fen: '8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1', n: [14, 191, 2812, 43238] },
  { ten: 'Thế 4', fen: 'r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1', n: [6, 264, 9467, 422333] },
  { ten: 'Thế 5', fen: 'rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8', n: [44, 1486, 62379, 2103487] }
];

function deepFreeze(o) {
  Object.freeze(o);
  for (const k of Object.keys(o)) if (o[k] && typeof o[k] === 'object' && !Object.isFrozen(o[k])) deepFreeze(o[k]);
  return o;
}
const at = fen => C.create({ fen });
/** Đi liên tiếp nhiều nước (UCI), mỗi nước phải hợp lệ. */
function playAll(state, moves) {
  let s = state;
  for (const m of moves) {
    const r = C.play(s, m);
    assert.equal(r.ok, true, `nước ${m} phải hợp lệ: ${r.reason}`);
    s = r.state;
  }
  return s;
}

/* ---------- perft ---------- */
for (const p of PERFT) {
  test(`perft d1–d3 đúng: ${p.ten}`, () => {
    const s = at(p.fen);
    const before = JSON.stringify(s);
    for (let d = 1; d <= 3; d++) assert.equal(C.perft(s, d), p.n[d - 1], `độ sâu ${d}`);
    assert.equal(JSON.stringify(s), before, 'perft không được sửa state');
  });
}

test('legalMoves ở thế đầu ván có 20 nước, khớp perft d1', () => {
  const m = C.legalMoves(C.create());
  assert.equal(m.length, 20);
  assert.ok(m.includes('e2e4') && m.includes('g1f3'));
});

test('perft d3 thế đầu ván dưới 1 giây', () => {
  const s = C.create();
  const t0 = process.hrtime.bigint();
  assert.equal(C.perft(s, 3), 8902);
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  assert.ok(ms < 1000, `mất ${ms} ms`);
});

test('perft d4 cả 5 thế (chỉ chạy khi PERFT_DEEP=1)', { skip: !DEEP && 'đặt PERFT_DEEP=1 để chạy', timeout: 600000 }, () => {
  for (const p of PERFT) assert.equal(C.perft(at(p.fen), 4), p.n[3], p.ten);
});

/* ---------- ca riêng ---------- */
test('nhập thành bị cấm khi Vua đi qua ô bị chiếu (Xe đen ở f3 khống chế f1)', () => {
  const m = C.legalMoves(at('r3k2r/8/8/8/8/5r2/8/R3K2R w KQkq - 0 1'));
  assert.ok(!m.includes('e1g1'), 'O-O đi qua f1 bị chiếu');
  assert.ok(m.includes('e1c1'), 'O-O-O vẫn được');
});

test('nhập thành bị cấm khi Vua đang bị chiếu hoặc đích bị chiếu', () => {
  const inCheck = C.legalMoves(at('4k3/8/8/8/8/8/4r3/R3K2R w KQ - 0 1'));
  assert.ok(!inCheck.includes('e1g1') && !inCheck.includes('e1c1'));
  const dest = C.legalMoves(at('4k3/8/8/8/8/6r1/8/R3K2R w KQ - 0 1'));
  assert.ok(!dest.includes('e1g1'), 'g1 bị chiếu');
  assert.ok(dest.includes('e1c1'));
});

test('nhập thành xa: ô b1 chỉ bị chiếu thì vẫn nhập được (Vua không đi qua b1)', () => {
  const m = C.legalMoves(at('r3k3/8/8/8/8/1r6/8/R3K3 w Q - 0 1'));
  assert.ok(m.includes('e1c1'));
});

test('nhập thành bị cấm khi ô giữa có quân hoặc mất quyền', () => {
  assert.ok(!C.legalMoves(at('4k3/8/8/8/8/8/8/R3KB1R w KQ - 0 1')).includes('e1g1'));
  assert.ok(!C.legalMoves(at('4k3/8/8/8/8/8/8/R3K2R w - - 0 1')).includes('e1g1'));
  // Xe đi rồi về: mất quyền
  let s = at('4k3/8/8/8/8/8/8/R3K2R w KQ - 0 1');
  s = playAll(s, ['h1h2', 'e8e7', 'h2h1', 'e7e8']);
  assert.equal(s.castling, 'Q');
  assert.ok(!C.legalMoves(s).includes('e1g1'));
  assert.ok(C.legalMoves(s).includes('e1c1'));
});

test('nhập thành đặt đúng Xe và Vua, cả hai bên', () => {
  let s = at('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
  let r = C.play(s, 'e1g1');
  assert.equal(r.info.castle, 'K');
  assert.equal(r.state.board[6], 'K');
  assert.equal(r.state.board[5], 'R');
  assert.equal(r.state.board[7], '');
  assert.equal(r.state.castling, 'kq');
  r = C.play(r.state, 'e8c8');
  assert.equal(r.state.board[58], 'k');
  assert.equal(r.state.board[59], 'r');
  assert.equal(r.state.board[56], '');
  assert.equal(r.state.castling, '-');
});

test('bắt tốt qua đường: đi được và ăn đúng Tốt', () => {
  const s = at('4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1');
  assert.ok(C.legalMoves(s).includes('e5d6'));
  const r = C.play(s, 'e5d6');
  assert.equal(r.state.board[43], 'P', 'Tốt Trắng ở d6');
  assert.equal(r.state.board[35], '', 'Tốt Đen ở d5 đã bị ăn');
  assert.equal(r.info.capture, 'p');
  assert.equal(r.info.enPassant, true);
});

test('FEN bắt qua đường phải khớp Tốt, ô đích và ô xuất phát ở cả hai bên', () => {
  for (const fen of [
    '8/8/8/3kP3/8/8/8/K7 w - d6 0 1',
    '4k3/8/3n4/3pP3/8/8/8/4K3 w - d6 0 1',
    '4k3/3n4/8/3pP3/8/8/8/4K3 w - d6 0 1',
    '4k3/8/8/8/3Pp3/3N4/8/4K3 b - d3 0 1',
    '4k3/8/8/8/3Pp3/8/3N4/4K3 b - d3 0 1',
    '4k3/8/8/8/4p3/8/8/4K3 b - d3 0 1'
  ]) assert.equal(C.fromFen(fen), null, fen);
  const black = at('4k3/8/8/8/3Pp3/8/8/4K3 b - d3 0 1');
  assert.ok(C.legalMoves(black).includes('e4d3'));
  const broken = { ...black, board: black.board.slice() };
  broken.board[27] = '';
  assert.ok(!C.legalMoves(broken).includes('e4d3'));
});

test('bắt tốt qua đường bị cấm khi làm lộ Vua cho Xe trên cùng hàng', () => {
  const m = C.legalMoves(at('4k3/8/8/KPp4r/8/8/8/8 w - c6 0 1'));
  assert.ok(!m.includes('b5c6'));
  assert.ok(m.includes('b5b6'));
});

test('ô bắt tốt qua đường chỉ sinh ra sau nước đi hai ô', () => {
  let s = playAll(C.create(), ['e2e4']);
  assert.equal(s.ep, 'e3');
  s = playAll(s, ['g8f6']);
  assert.equal(s.ep, null);
});

test('phong cấp đủ 4 loại; thiếu chữ phong cấp bị từ chối', () => {
  const s = at('8/P7/8/8/8/8/8/k6K w - - 0 1');
  const m = C.legalMoves(s).filter(x => x.startsWith('a7a8')).sort();
  assert.deepEqual(m, ['a7a8b', 'a7a8n', 'a7a8q', 'a7a8r']);
  const bad = C.play(s, 'a7a8');
  assert.equal(bad.ok, false);
  assert.match(bad.reason, /phong cấp/);
  for (const [c, ch] of [['q', 'Q'], ['r', 'R'], ['b', 'B'], ['n', 'N']]) {
    const r = C.play(s, 'a7a8' + c);
    assert.equal(r.state.board[56], ch);
    assert.equal(r.info.promotion, c);
  }
});

test('phong cấp bằng cách ăn quân', () => {
  const s = at('1r2k3/P7/8/8/8/8/8/4K3 w - - 0 1');
  const m = C.legalMoves(s);
  assert.ok(m.includes('a7b8q') && m.includes('a7b8n'));
  assert.equal(C.play(s, 'a7b8q').info.capture, 'r');
});

test('chiếu hết: nước ngốc nghếch (fool\'s mate)', () => {
  const s = playAll(C.create(), ['f2f3', 'e7e5', 'g2g4', 'd8h4']);
  assert.deepEqual(C.status(s), { over: true, winner: 'b', reason: 'checkmate' });
  assert.equal(C.inCheck(s), true);
  assert.equal(C.legalMoves(s).length, 0);
  assert.equal(C.play(s, 'a2a3').ok, false);
});

test('hết nước đi mà không bị chiếu là hòa (stalemate)', () => {
  const s = at('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1');
  assert.equal(C.inCheck(s), false);
  assert.deepEqual(C.status(s), { over: true, winner: null, reason: 'stalemate' });
});

test('chiếu hết bên Trắng thắng: winner = a', () => {
  const s = at('7k/8/6K1/8/8/8/8/R7 w - - 0 1');
  const r = C.play(s, 'a1a8');
  assert.deepEqual(C.status(r.state), { over: true, winner: 'a', reason: 'checkmate' });
  assert.equal(r.info.check, true);
});

test('lặp thế 3 lần là hòa (ván mới: thế đầu xuất hiện lần 3 sau 8 nửa nước)', () => {
  const cycle = ['g1f3', 'g8f6', 'f3g1', 'f6g8'];
  let s = playAll(C.create(), cycle);
  assert.equal(C.status(s).over, false, 'mới lặp lần 2');
  s = playAll(s, cycle.slice(0, 3));
  assert.equal(C.status(s).over, false);
  s = playAll(s, ['f6g8']);
  assert.deepEqual(C.status(s), { over: true, winner: null, reason: 'repetition' });
});

test('lặp thế: nước không đảo ngược được (đi Tốt) xóa lịch sử lặp', () => {
  const s = playAll(C.create(), ['g1f3', 'g8f6', 'f3g1', 'f6g8', 'e2e4']);
  assert.ok(s.keys.length <= 2);
});

test('lặp thế không tính khi quyền nhập thành khác nhau', () => {
  let s = at('r3k3/8/8/8/8/8/8/R3K2R w KQq - 0 1');
  s = playAll(s, ['h1h2', 'a8a7', 'h2h1', 'a7a8', 'h1h2', 'a8a7', 'h2h1', 'a7a8']);
  // Quyền K mất sau Xe h1 đi, nên các thế không còn trùng thế ban đầu
  assert.equal(C.status(s).over, false);
});

test('50 nước: nửa nước thứ 100 không ăn quân/đi tốt là hòa; chiếu hết ở nước đó vẫn là chiếu hết', () => {
  const s99 = at('4k3/8/8/8/8/8/8/R3K3 w - - 99 80');
  assert.equal(C.status(s99).over, false);
  const r = C.play(s99, 'a1a2');
  assert.deepEqual(C.status(r.state), { over: true, winner: null, reason: 'fifty' });
  assert.equal(C.status(at('4k3/8/8/8/8/8/8/R3K3 w - - 100 80')).reason, 'fifty');
  const mate = C.play(at('7k/8/6K1/8/8/8/8/R7 w - - 99 80'), 'a1a8');
  assert.equal(C.status(mate.state).reason, 'checkmate');
});

test('bộ đếm FEN vượt 32 bit không bị tràn, giới hạn ở số nguyên an toàn', () => {
  const draw = at('4k3/8/8/8/8/8/8/R3K3 w - - 2147483648 1');
  assert.equal(C.status(draw).reason, 'fifty');
  const s = at('4k3/8/8/8/8/8/8/R3K3 b - - 0 2147483648');
  const r = C.play(s, 'e8e7');
  assert.equal(r.ok, true);
  assert.equal(r.state.fullmove, 2147483649);
  assert.equal(C.toFen(C.fromFen(C.toFen(r.state))), C.toFen(r.state));
  const max = at('4k3/8/8/8/8/8/8/R3K3 b - - 0 9007199254740991');
  assert.equal(C.play(max, 'e8e7').state.fullmove, Number.MAX_SAFE_INTEGER);
  assert.equal(C.fromFen('4k3/8/8/8/8/8/8/R3K3 w - - 0 9007199254740992'), null);
});

test('đi tốt hoặc ăn quân đặt lại bộ đếm 50 nước', () => {
  const r = C.play(at('4k3/8/8/8/8/8/P7/R3K3 w - - 90 80'), 'a2a3');
  assert.equal(r.state.halfmove, 0);
  const r2 = C.play(at('4k3/r7/8/8/8/8/8/R3K3 w - - 90 80'), 'a1a7');
  assert.equal(r2.state.halfmove, 0);
});

test('không đủ quân chiếu hết: 4 ca hòa', () => {
  const ca = [
    '4k3/8/8/8/8/8/8/4K3 w - - 0 1',            // Vua – Vua
    '4k3/8/8/8/8/8/8/2B1K3 w - - 0 1',          // Vua+Tượng – Vua
    '4k3/8/8/8/8/8/8/1N2K3 w - - 0 1',          // Vua+Mã – Vua
    '4kb2/8/8/8/8/8/8/2B1K3 w - - 0 1'          // Tượng hai bên cùng màu ô (c1 và f8 đều ô tối)
  ];
  for (const f of ca) assert.deepEqual(C.status(at(f)), { over: true, winner: null, reason: 'insufficient' }, f);
});

test('hàng Tốt khóa kín là thế chết, không bên nào có thể chiếu hết', () => {
  for (const fen of [
    '4k3/8/8/p1p1p1p1/P1P1P1P1/8/8/4K3 w - - 0 1',
    '4k3/8/8/1p1p1p1p/1P1P1P1P/8/8/4K3 b - - 0 1',
    '4k3/8/p1p1p1p1/P1P1P1P1/8/8/8/4K3 w - - 0 1',
    '4k3/8/p1p1p1p1/P1P1P1P1/8/8/8/4K3 b - - 0 1',
    '4k3/8/8/8/1p1p1p1p/1P1P1P1P/8/4K3 w - - 0 1'
  ]) {
    const s = at(fen);
    assert.deepEqual(C.status(s), { over: true, winner: null, reason: 'insufficient' });
    assert.equal(C.canMate(s, 'a'), false);
    assert.equal(C.canMate(s, 'b'), false);
  }
  const open = at('4k3/8/8/p1p1p1p1/P1P1P1P1/8/8/R3K3 w - - 0 1');
  assert.equal(C.canMate(open, 'a'), true, 'Xe có thể phá hàng rào');
  assert.equal(C.status(open).over, false);
});

test('nước bắt buộc ăn Hậu dẫn tới thế chết', () => {
  const s = at('kQ6/8/2K5/8/8/8/8/8 b - - 0 1');
  assert.deepEqual(C.legalMoves(s), ['a8b8']);
  assert.deepEqual(C.status(s), { over: true, winner: null, reason: 'insufficient' });
  assert.equal(C.canMate(s, 'a'), false);
  assert.equal(C.canMate(s, 'b'), false);
  const escape = at('4k3/8/8/8/8/8/8/R3K3 w - - 0 1');
  assert.equal(C.canMate(escape, 'a'), true);
});

test('còn đủ quân chiếu hết thì ván chưa kết thúc', () => {
  const ca = [
    '2b1k3/8/8/8/8/8/8/2B1K3 w - - 0 1',        // Tượng khác màu ô
    '4k3/8/8/8/8/8/P7/4K3 w - - 0 1',           // có Tốt
    '4k3/8/8/8/8/8/8/R3K3 w - - 0 1',           // có Xe
    '4k3/8/8/8/8/8/8/1NN1K3 w - - 0 1',         // hai Mã
    '4k3/8/8/8/8/8/8/1NB1K3 w - - 0 1'          // Mã + Tượng
  ];
  for (const f of ca) assert.equal(C.status(at(f)).over, false, f);
});

test('canMate: bên chỉ còn Vua hoặc Vua+Mã không đủ quân (để xử hết giờ hòa)', () => {
  const s = at('4k3/8/8/8/8/8/8/1N2K3 w - - 0 1');
  assert.equal(C.canMate(s, 'a'), false);
  assert.equal(C.canMate(s, 'b'), false);
  const r = at('4k3/8/8/8/8/8/8/R3K3 w - - 0 1');
  assert.equal(C.canMate(r, 'a'), true);
  assert.equal(C.canMate(r, 'b'), false);
});

/* ---------- ký hiệu SAN ---------- */
test('SAN: nước thường, ăn quân, nhập thành', () => {
  assert.equal(C.notation(C.create(), 'g1f3'), 'Nf3');
  assert.equal(C.notation(C.create(), 'e2e4'), 'e4');
  const s = playAll(C.create(), ['e2e4', 'd7d5']);
  assert.equal(C.notation(s, 'e4d5'), 'exd5');
  const c = playAll(C.create(), ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'f8c5']);
  assert.equal(C.notation(c, 'e1g1'), 'O-O');
  assert.equal(C.notation(at('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1'), 'e1c1'), 'O-O-O');
});

test('SAN: chiếu "+" và chiếu hết "#"', () => {
  const s = playAll(C.create(), ['f2f3', 'e7e5', 'g2g4']);
  assert.equal(C.notation(s, 'd8h4'), 'Qh4#');
  assert.equal(C.play(s, 'd8h4').info.san, 'Qh4#');
  assert.equal(C.notation(at('1k6/4P3/8/8/8/8/8/4K3 w - - 0 1'), 'e7e8q'), 'e8=Q+');
  assert.equal(C.notation(at('6k1/5ppp/8/8/8/8/8/R3K3 w - - 0 1'), 'a1a8'), 'Ra8#');
  assert.equal(C.notation(at('4k3/8/8/8/8/8/8/R3K3 w - - 0 1'), 'a1a8'), 'Ra8+');
  assert.equal(C.notation(at('8/P7/8/8/8/8/8/k6K w - - 0 1'), 'a7a8n'), 'a8=N');
});

test('SAN: phân biệt khi hai quân cùng tới một ô (cột, hàng, cả hai)', () => {
  const mas = at('4k3/8/8/8/8/8/8/1N2KN2 w - - 0 1');
  assert.equal(C.notation(mas, 'b1d2'), 'Nbd2');
  assert.equal(C.notation(mas, 'f1d2'), 'Nfd2');
  const cung = at('4k3/8/8/8/8/N7/8/N3K3 w - - 0 1');
  assert.equal(C.notation(cung, 'a3c2'), 'N3c2');
  assert.equal(C.notation(cung, 'a1c2'), 'N1c2');
  const hau = at('8/7k/8/8/8/Q1Q5/8/Q3K3 w - - 0 1');
  assert.equal(C.notation(hau, 'a3b2'), 'Qa3b2');
  assert.equal(C.notation(hau, 'c3b2'), 'Qcb2');
  assert.equal(C.notation(hau, 'a1b2'), 'Q1b2');
});

test('SAN: ăn quân bằng quân có phân biệt, và nước sai trả chuỗi rỗng', () => {
  const s = at('4k3/8/8/3p4/8/2N1N3/8/4K3 w - - 0 1');
  assert.equal(C.notation(s, 'c3d5'), 'Ncxd5');
  assert.equal(C.notation(s, 'e3d5'), 'Nexd5');
  assert.equal(C.notation(s, 'a1a8'), '');
  assert.equal(C.notation(s, 'xx'), '');
});

/* ---------- FEN, state bất biến ---------- */
test('FEN vào/ra khứ hồi cho mọi thế mẫu và ca bắt tốt qua đường', () => {
  const ds = PERFT.map(p => p.fen).concat([
    C.START_FEN,
    '4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 3',
    'r3k2r/8/8/8/8/8/8/R3K2R b kq - 12 40',
    '8/8/8/8/8/8/8/k6K w - - 0 1'
  ]);
  for (const f of ds) assert.equal(C.toFen(C.fromFen(f)), f);
});

test('FEN sau khi đi vài nước vẫn khứ hồi và cho cùng danh sách nước đi', () => {
  const s = playAll(C.create(), ['e2e4', 'c7c5', 'g1f3', 'd7d6', 'd2d4']);
  const t = C.fromFen(C.toFen(s));
  assert.equal(C.toFen(t), C.toFen(s));
  assert.deepEqual(C.legalMoves(t).sort(), C.legalMoves(s).sort());
  assert.equal(C.toFen(s), 'rnbqkbnr/pp2pppp/3p4/2p5/3PP3/5N2/PPP2PPP/RNBQKB1R b KQkq d3 0 3');
});

test('FEN sai hoặc thế bất khả thi trả null; create ném lỗi', () => {
  for (const f of [
    '', 'abc', null, 8,
    'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBN w KQkq - 0 1',        // thiếu ô
    'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR x KQkq - 0 1',        // bên đi sai
    '4k3/8/8/8/8/8/8/8 w - - 0 1',                                      // thiếu Vua Trắng
    'P3k3/8/8/8/8/8/8/4K3 w - - 0 1',                                   // Tốt ở hàng 8
    '4k3/8/8/8/8/8/4R3/4K3 w - - 0 1',                                  // Đen bị chiếu mà Trắng có lượt
    '4k3/8/8/8/8/8/8/4K3 w - e5 0 1'                                    // ô bắt qua đường vô lý
  ]) assert.equal(C.fromFen(f), null, String(f));
  for (const fen of ['', null, 'bậy']) assert.throws(() => C.create({ fen }));
  for (const counters of ['1e2 1', '0 1e2', '+1 1', '0 0x10']) {
    assert.equal(C.fromFen('4k3/8/8/8/8/8/8/4K3 w - - ' + counters), null);
  }
});

test('FEN: quyền nhập thành không có Xe/Vua đúng chỗ bị bỏ', () => {
  const s = C.fromFen('4k3/8/8/8/8/8/8/4K3 w KQkq - 0 1');
  assert.equal(s.castling, '-');
});

test('play không sửa state cũ (state đóng băng sâu)', () => {
  const s = deepFreeze(C.create());
  const snap = JSON.stringify(s);
  const r = C.play(s, 'e2e4');
  assert.equal(r.ok, true);
  assert.equal(JSON.stringify(s), snap);
  assert.notEqual(r.state, s);
  assert.notEqual(r.state.board, s.board);
  assert.equal(r.state.turn, 'b');
  assert.equal(C.turn(s), 'a');
  assert.equal(C.turn(r.state), 'b');
  // các hàm đọc cũng không được sửa state đóng băng
  C.legalMoves(s); C.status(s); C.view(s, 'a'); C.notation(s, 'e2e4'); C.perft(s, 2); C.canMate(s, 'a'); C.inCheck(s);
  assert.equal(JSON.stringify(s), snap);
});

test('state là JSON thuần: đi qua JSON.stringify/parse vẫn chơi tiếp được', () => {
  let s = playAll(C.create(), ['e2e4', 'e7e5']);
  s = JSON.parse(JSON.stringify(s));
  assert.equal(C.play(s, 'g1f3').ok, true);
  assert.equal(C.view(s, 'b'), s);
});

test('play từ chối nước sai với lý do tiếng Việt, không ném lỗi', () => {
  const s = C.create();
  for (const m of ['', 'e2', 'e2e5', 'e7e5', 'a3a4', 'e4e5', 'zzzz', null, undefined, 42, 'e1g1']) {
    const r = C.play(s, m);
    assert.equal(r.ok, false, String(m));
    assert.equal(typeof r.reason, 'string');
    assert.ok(r.reason.length > 0);
  }
  assert.equal(C.play(s, 'E2E4').ok, true, 'chữ hoa vẫn nhận');
});

test('sides, turn, view theo giao diện chung', () => {
  assert.deepEqual(C.sides, ['a', 'b']);
  assert.equal(C.turn(C.create()), 'a');
  assert.equal(C.pieceAt(C.create(), 'e1'), 'K');
  assert.equal(C.pieceAt(C.create(), 'e4'), '');
  assert.equal(C.status(C.create()).over, false);
});

test('ván ngẫu nhiên có hạt giống: play/legalMoves/status/FEN luôn nhất quán', () => {
  let seed = 12345;
  const rnd = n => { seed = (Math.imul(seed, 1103515245) + 12345) & 0x7fffffff; return seed % n; };
  for (let g = 0; g < 40; g++) {
    let s = C.create();
    for (let ply = 0; ply < 250; ply++) {
      const st = C.status(s);
      const moves = C.legalMoves(s);
      assert.equal(st.over, moves.length === 0 || st.reason === 'insufficient' || st.reason === 'repetition' || st.reason === 'fifty');
      if (st.over) break;
      const mv = moves[rnd(moves.length)];
      const r = C.play(s, mv);
      assert.equal(r.ok, true);
      assert.equal(C.notation(s, mv), r.info.san);
      s = r.state;
      const t = C.fromFen(C.toFen(s));
      assert.ok(t, C.toFen(s));
      assert.equal(C.toFen(t), C.toFen(s));
    }
  }
});
