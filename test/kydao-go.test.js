'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const go = require('../public/js/kydao/go');
const letters = 'ABCDEFGHJKLMNOPQRST';
function index(s, p) { return (Number(p.slice(1)) - 1) * s.size + letters.indexOf(p[0]); }
function setup(size, stones) {
  const s = go.create({ size });
  Object.entries(stones).forEach(([p, color]) => { s.board[index(s, p)] = color; });
  s.history = [];
  return s;
}
function move(s, m, side) {
  const r = go.play(s, m, side);
  assert.equal(r.ok, true, m);
  return r.state;
}
test('UMD, kích thước, tọa độ và bản sao độc lập', () => {
  const context = {}; vm.runInNewContext(fs.readFileSync(require.resolve('../public/js/kydao/go'), 'utf8'), context);
  assert.equal(context.KyGo.create({ size: 13 }).board.length, 169);
  assert.equal(go.create({ size: 19 }).board.length, 361);
  assert.throws(() => go.create({ size: 10 }));
  const s = go.create(); const t = move(s, 'D4');
  assert.equal(s.board[index(s, 'D4')], null);
  assert.equal(go.play(s, 'I4').ok, false);
  assert.equal(go.notation(s, 'D4'), 'D4');
  const v = go.view(t); v.board[0] = 'b'; assert.equal(t.board[0], null);
});
test('Bắt quân, bắt nhóm và cấm tự sát', () => {
  let s = setup(9, { B2: 'b', A2: 'a', B1: 'a', C2: 'a' });
  let r = go.play(s, 'B3'); assert.deepEqual(r.info.capture, ['B2']);
  assert.equal(r.state.board[index(s, 'B2')], null);
  s = setup(9, { B2: 'b', C2: 'b', A2: 'a', B1: 'a', C1: 'a', D2: 'a', B3: 'a' });
  r = go.play(s, 'C3'); assert.equal(r.info.capture.length, 2);
  s = setup(9, { A2: 'b', B1: 'b', C2: 'b', B3: 'b' });
  assert.equal(go.play(s, 'B2').ok, false);
  assert.equal(go.legalMoves(s).includes('B2'), false);
});
test('Cô đơn và siêu cô ba cô theo vị trí', () => {
  const s = setup(19, {
    B2:'a', D2:'a', C1:'a', C2:'b', B3:'b', D3:'b', C4:'b',
    H2:'b', K2:'b', J1:'b', J2:'a', H3:'a', K3:'a', J4:'a',
    O2:'a', Q2:'a', P1:'a', P2:'b', O3:'b', Q3:'b', P4:'b'
  });
  let single = go.create();
  for (const p of ['B2', 'C2', 'D2', 'B3', 'C1', 'D3', 'J9', 'C4', 'C3']) single = move(single, p);
  assert.equal(go.play(single, 'C2').ok, false);
  let t = move(s, 'C3');
  for (const p of ['J3', 'P3', 'C2', 'J2', 'P2']) t = move(t, p);
  // Thế gốc (trước C3) không nằm trong history vì setup đặt history = []; sau sáu nước
  // chỉ lặp lại thế sau nước C3 đầu tiên mới bị cấm.
  assert.equal(go.play(t, 'C3').ok, false);
});
test('Hai pass, đánh dấu nhóm, xóa đồng ý, đánh tiếp và hết giờ', () => {
  let s = setup(9, { A1:'a', B1:'a', D4:'b' });
  s = move(move(s, 'pass'), 'pass');
  assert.equal(s.phase, 'mark');
  assert.equal(go.play(s, 'agree').ok, false);
  s = move(s, 'agree', 'a');
  s = move(s, 'mark:A1', 'b');
  assert.deepEqual(s.dead, [0, 1]); assert.deepEqual(s.agreed, []);
  s = move(s, 'mark:B1', 'a'); assert.deepEqual(s.dead, []);
  const resumed = move(s, 'resumePlay', 'b');
  assert.equal(resumed.phase, 'play'); assert.equal(resumed.passes, 0);
  assert.equal(go.finalize(resumed).ok, false);
  const timed = go.finalize(s); assert.equal(go.status(timed.state).over, true);
  s = move(move(s, 'agree', 'a'), 'agree', 'b');
  assert.equal(go.status(s).over, true); assert.equal(go.play(s, 'pass').ok, false);
});
// Dựng bàn từ sơ đồ: hàng đầu là y=size, 'X' = Đen (a), 'O' = Trắng (b), '.' = trống.
function fromRows(rows) {
  const stones = {};
  rows.forEach((row, r) => {
    row.split('').forEach((c, x) => {
      if (c !== '.') stones[letters[x] + (rows.length - r)] = c === 'X' ? 'a' : 'b';
    });
  });
  return setup(rows.length, stones);
}
function markPhase(s) { s.phase = 'mark'; return s; }
const rep = (row, n) => Array(n).fill(row);
// Năm thế cuối ván 9×9 TỰ DỰNG, tính tay theo diện tích Trung Quốc (komi 7,5).
// Thế tự dựng, điểm tính tay theo luật tính diện tích của Trung Quốc (quân trên bàn + đất, komi 7,5):
// Luật cờ vây Trung Quốc 2002; Sensei's Library, mục Area scoring và Seki.
// Khâu soát đã tính lại độc lập và điểm khớp. Đây không phải biên bản ván lấy từ nguồn nào.
test('Năm thế cuối ván 9×9 có điểm tính tay (quân chết đánh dấu qua mark)', () => {
  // 1) Ranh giới dọc, cột E là dame: Đen 9 quân + 27 đất; Trắng 9 quân + 27 đất + komi.
  let s = fromRows(rep('...X.O...', 9));
  let sc = go.score(s);
  assert.deepEqual([sc.a, sc.b, sc.territory.a, sc.territory.b], [36, 43.5, 27, 27]);
  assert.equal(go.finalize(markPhase(s)).state.result.winner, 'b');
  // 2) Như thế 1 nhưng có quân chết hai bên: không đánh dấu thì vùng giáp hai màu, không là đất.
  s = fromRows(rep('...X.O...', 9)); s.board[index(s, 'B5')] = 'b'; s.board[index(s, 'H5')] = 'a';
  sc = go.score(s);
  assert.deepEqual([sc.a, sc.b, sc.territory.a, sc.territory.b], [10, 17.5, 0, 0]);
  markPhase(s); s = move(s, 'mark:B5', 'a'); s = move(s, 'mark:H5', 'b');
  assert.deepEqual(s.dead.length, 2);
  sc = go.score(s);
  assert.deepEqual([sc.a, sc.b, sc.territory.a, sc.territory.b], [36, 43.5, 27, 27]);
  // 3) Ranh giới ngang: Đen hàng 5, Trắng hàng 3, hàng 4 là dame. Đen thắng.
  const flat = [].concat(rep('.........', 4), ['XXXXXXXXX', '.........', 'OOOOOOOOO'], rep('.........', 2));
  s = fromRows(flat); sc = go.score(s);
  assert.deepEqual([sc.a, sc.b, sc.territory.a, sc.territory.b], [45, 34.5, 36, 18]);
  assert.equal(go.finalize(markPhase(s)).state.result.winner, 'a');
  // 4) Thế 3 cộng nhóm 2 quân Đen chết (B1,C1) và 1 quân Trắng chết (E8); đánh dấu cả nhóm.
  s = fromRows(flat); ['B1', 'C1'].forEach(p => { s.board[index(s, p)] = 'a'; }); s.board[index(s, 'E8')] = 'b';
  markPhase(s); s = move(s, 'mark:B1', 'a'); s = move(s, 'mark:E8', 'b');
  assert.equal(s.dead.length, 3);
  sc = go.score(s);
  assert.deepEqual([sc.a, sc.b, sc.territory.a, sc.territory.b], [45, 34.5, 36, 18]);
  assert.equal(go.finalize(s).state.result.winner, 'a');
  // 5) Thắng sát 0,5 điểm: Đen 27 đất + 9 quân = 36; Trắng 18 đất + 9 quân + 2 quân F5,F6 = 29, + 7,5 = 36,5.
  const rows = rep('...X..O..', 9); rows[4] = '...X.OO..'; rows[3] = '...X.OO..';
  s = fromRows(rows); sc = go.score(s);
  assert.deepEqual([sc.a, sc.b, sc.territory.a, sc.territory.b], [36, 36.5, 27, 18]);
  const done = go.finalize(markPhase(s)).state.result;
  assert.equal(done.winner, 'b'); assert.equal(done.score.b - done.score.a, 0.5);
});
test('Seki thật: hai nhóm không mắt chung hai khí, khí chung không là đất', () => {
  // Toàn bàn: Đen cột A–D, Trắng cột E–J; hai điểm trống D5 và E3 giáp cả hai nhóm.
  const rows = rep('XXXXOOOOO', 9); rows[4] = 'XXX.OOOOO'; rows[6] = 'XXXX.OOOO';
  const s = fromRows(rows);
  const sc = go.score(s);
  // Không đánh dấu gì: quân hai bên đều tính, hai khí chung không vào đất bên nào.
  assert.deepEqual([sc.a, sc.b, sc.territory.a, sc.territory.b], [35, 51.5, 0, 0]);
  // Cả hai điểm chung đều đi được (nhóm còn khí kia), không phải nước tự sát.
  const legal = go.legalMoves(s);
  assert.equal(legal.includes('D5'), true); assert.equal(legal.includes('E3'), true);
  // Nhưng tự lấp một khí thì bị bắt ngay: Đen D5 rồi Trắng E3 bắt cả nhóm Đen (35 quân + D5).
  const t = move(s, 'D5'); const r = go.play(t, 'E3');
  assert.equal(r.ok, true); assert.equal(r.info.capture.length, 36);
  // Seki có mắt: mỗi bên một mắt (A9 Đen, J1 Trắng) cùng hai khí chung D5, E3.
  // Theo luật Trung Quốc mắt vẫn là đất của bên đó; khí chung không vào đất bên nào.
  const eyes = rows.map((row, i) => i === 0 ? '.XXXOOOOO' : i === 8 ? 'XXXXOOOO.' : row);
  const e = fromRows(eyes);
  const es = go.score(e);
  // Đen 34 quân + 1 đất = 35; Trắng 43 quân + 1 đất + 7,5 komi = 51,5.
  assert.deepEqual([es.a, es.b, es.territory.a, es.territory.b], [35, 51.5, 1, 1]);
  // Có mắt nên tự lấp khí chung không bị bắt ngay: Đen D5 rồi Trắng E3 không bắt gì.
  const e2 = go.play(move(e, 'D5'), 'E3');
  assert.equal(e2.ok, true); assert.equal(e2.info.capture.length, 0);
});
test('resumePlay xóa dấu quân chết cũ; cỡ mặc định 9; legalMoves theo bên đã đồng ý', () => {
  let s = setup(9, { A1:'a', B1:'a', D4:'b' });
  s = move(move(s, 'pass'), 'pass');
  assert.equal(go.create().size, 9);
  s = move(s, 'mark:A1', 'b'); s = move(s, 'agree', 'a');
  assert.equal(s.dead.length, 2);
  assert.equal(go.legalMoves(s, 'a').includes('agree'), false);
  assert.equal(go.legalMoves(s, 'b').includes('agree'), true);
  const r = move(s, 'resumePlay', 'a');
  assert.deepEqual(r.dead, []); assert.deepEqual(r.agreed, []);
  assert.equal(go.KOMI, 7.5); assert.equal(go.score(r).komi, go.KOMI);
});
test('Bấm agree hai lần liên tiếp bị từ chối, ván vẫn ở giai đoạn mark', () => {
  let s = setup(9, { A1:'a', B1:'a', D4:'b' });
  s = move(move(s, 'pass'), 'pass');
  s = move(s, 'agree', 'a');
  const again = go.play(s, 'agree', 'a');
  assert.equal(again.ok, false);
  assert.equal(s.phase, 'mark'); assert.deepEqual(s.agreed, ['a']);
  assert.equal(go.status(s).over, false);
});
test('Tọa độ biên, sai lượt và pass rồi đặt quân thì hết pass liên tiếp', () => {
  const s19 = go.create({ size: 19 }); const s9 = go.create({ size: 9 });
  assert.equal(go.play(s19, 'T19').ok, true);
  assert.equal(go.play(s9, 'T19').ok, false);
  ['A0', 'a4', 'T20', 'I5', 'A'].forEach(m => assert.equal(go.play(s19, m).ok, false, m));
  assert.equal(go.play(s9, 'J9').ok, true); assert.equal(go.play(s9, 'J10').ok, false);
  assert.equal(go.play(s9, 'D4', 'b').ok, false);
  let t = move(s9, 'pass', 'a'); t = move(t, 'D4', 'b'); t = move(t, 'pass', 'a');
  assert.equal(t.phase, 'play'); assert.equal(t.passes, 1);
});
