'use strict';
// Kiểm phần thuần của bảng bàn cờ: chuyển chạm → ô, chọn quân, phong cấp, thứ tự gói kd:moved, đồng hồ.
const test = require('node:test');
const assert = require('node:assert');
const KyChess = require('../public/js/kydao/chess.js');
const KyXiangqi = require('../public/js/kydao/xiangqi.js');
const KydaoDraw = require('../public/js/kydao-draw.js');
const KyGo = require('../public/js/kydao/go');
const KyGomoku = require('../public/js/kydao/gomoku');

global.KyChess = KyChess;
global.KyXiangqi = KyXiangqi;
global.KydaoDraw = KydaoDraw;
globalThis.KydaoSkins = require('../public/js/kydao-skins.js');
const { core } = require('../public/js/kydao-ui.js');

function session(game, mod, you, extra) {
  return core.makeSession(Object.assign({ gameId: 'g1', table: 1, game, you, state: mod.create({}), ply: 0, moves: [],
    clock: { a: 60000, b: 60000, turn: 'a', turnStartedAt: 1000, incMs: 0 }, a: {}, b: {} }, extra || {}), mod);
}

test('makeSession đọc skins từ StartPayload, mã lạ thành null', () => {
  const S = session('chess', KyChess, 'a', { skins: { a: { field: 'volcano', pieces: 'xyz' }, b: null } });
  assert.deepStrictEqual(S.skins, { a: { field: 'volcano', pieces: null }, b: { field: null, pieces: null } });
});

test('applySkin chỉ nhận gói đúng ván và đúng bên', () => {
  const S = session('chess', KyChess, 'a');
  const before = structuredClone(S.skins);
  assert.strictEqual(core.applySkin(S, { gameId: 'g2', side: 'b', field: 'ocean' }), false);
  assert.deepStrictEqual(S.skins, before);
  assert.strictEqual(core.applySkin(S, { gameId: 'g1', side: 'c', field: 'ocean' }), false);
  assert.deepStrictEqual(S.skins, before);
  assert.strictEqual(core.applySkin(S, { gameId: 'g1', side: 'b', field: 'ocean' }), true);
  assert.strictEqual(S.skins.b.field, 'ocean');
});

test('applySkin không nhận khóa nguy hiểm', () => {
  const S = session('chess', KyChess, 'a');
  assert.strictEqual(core.applySkin(S, { gameId: 'g1', side: 'a', field: '__proto__' }), true);
  assert.strictEqual(S.skins.a.field, null);
});

test('Bàn vây 9/13/19 và caro: mọi giao điểm chạm đúng ở 375px, hai hướng và khi phóng to', () => {
  for (const [game, size] of [['go', 9], ['go', 13], ['go', 19], ['gomoku', 15]]) {
    for (const width of [355, 887]) for (const flip of [false, true]) {
      const g = KydaoDraw.layout(game, width, width, size);
      for (let col = 0; col < size; col++) for (let row = 0; row < size; row++) {
        const name = KydaoDraw.nameOf(game, col, row), p = KydaoDraw.cellXY(g, col, row, flip);
        assert.equal(KydaoDraw.squareAt(g, p.x, p.y, flip), name);
        assert.deepEqual(KydaoDraw.parseSq(game, name, size), { col, row });
        assert.equal(KydaoDraw.boardIndex(game, col, row, size), (game === 'gomoku' ? size - row - 1 : row) * size + col);
      }
      assert.equal(KydaoDraw.squareAt(g, -50, -50, flip), null);
    }
    assert.equal(KydaoDraw.starPoints(size).length, size === 9 ? 5 : 9);
  }
});

test('Cờ vây: chạm đặt đá, bỏ lượt và đánh dấu không phụ thuộc bên tới lượt', () => {
  const s = session('go', KyGo, 'a');
  assert.deepEqual(core.tapSquare(s, 'A1'), { kind: 'move', move: 'A1' });
  assert.equal(core.pushMove(s, 'A1', 'A1', null).ok, true);
  assert.equal(s.state.board[0], 'a'); assert.deepEqual(s.last, ['A1']);
  assert.equal(core.handleMoved(s, { ply: 2, move: 'pass' }), 'applied');
  assert.equal(core.pushMove(s, 'pass', 'Bỏ lượt', null).ok, true);
  assert.equal(s.state.phase, 'mark'); assert.deepEqual(s.last, []);
  s.marks = { dead: [], agreed: {}, deadlineAt: 180000 }; s.you = 'b';
  assert.deepEqual(core.tapSquare(s, 'A1'), { kind: 'mark', point: 'A1' });
  s.you = null; assert.deepEqual(core.tapSquare(s, 'A1'), { kind: 'none' });
});

test('Caro: X/O và dãy thắng theo luật; cờ úp áp reveal máy chủ cho cả hai bên', () => {
  const s = session('gomoku', KyGomoku, 'a');
  for (const [i, move] of ['a1', 'a2', 'b1', 'b2', 'c1', 'c2', 'd1', 'd2', 'e1'].entries()) {
    assert.equal(core.handleMoved(s, { ply: i + 1, move }), 'applied');
  }
  assert.deepEqual(s.win, ['a1', 'b1', 'c1', 'd1', 'e1']);
  assert.deepEqual(s.last, ['e1']);
  let secret = KyXiangqi.create({ variant: 'jieqi', seed: 'bí mật' });
  for (const you of ['a', 'b', undefined]) {
    const q = session('jieqi', KyXiangqi, you, { state: KyXiangqi.view(secret) });
    const result = KyXiangqi.play(secret, 'a3a4');
    assert.equal(core.handleMoved(q, { ply: 1, move: 'a3a4', reveal: result.info.reveal }), 'applied');
    assert.deepEqual(q.state, KyXiangqi.view(result.state));
  }
});

test('Nét vẽ vây, X/O, quân chết, dãy thắng và quân úp dùng được không DOM', () => {
  for (const game of ['go', 'gomoku', 'jieqi']) {
    const mod = { go: KyGo, gomoku: KyGomoku, jieqi: KyXiangqi }[game];
    let state = mod.create(game === 'jieqi' ? { variant: 'jieqi', seed: 1 } : { size: 19 });
    if (game !== 'jieqi') state = mod.play(state, game === 'go' ? 'T19' : 'o15').state;
    const ctx = drawingContext();
    KydaoDraw.draw(ctx, { game, size: state.size, board: state.board || state.cells, w: 355, h: 355, dead: ['T19'], win: ['a1', 'e1'], reveal: { square: 'a0', progress: 0.3 } });
    assert.equal(ctx.saves, 0);
    if (game === 'jieqi') assert.equal(ctx.calls.filter(x => x[0] === 'fillText' && x[1] === '?').length, 60);
  }
});

test('KydaoDraw: chạm → ô cờ vua, hai hướng nhìn', () => {
  const g = KydaoDraw.layout('chess', 400, 400);
  assert.strictEqual(g.cell, 50);
  for (const flip of [false, true]) {
    for (const name of ['a1', 'h1', 'a8', 'h8', 'e4', 'd5']) {
      const q = KydaoDraw.parseSq('chess', name);
      const p = KydaoDraw.cellXY(g, q.col, q.row, flip);
      assert.strictEqual(KydaoDraw.squareAt(g, p.x, p.y, flip), name);
    }
  }
  // bên Trắng ở dưới: a1 ở góc dưới-trái; bên Đen: a1 ở góc trên-phải
  assert.strictEqual(KydaoDraw.squareAt(g, 5, 395, false), 'a1');
  assert.strictEqual(KydaoDraw.squareAt(g, 395, 5, true), 'a1');
  assert.strictEqual(KydaoDraw.squareAt(g, -3, 10, false), null);
});

test('KydaoDraw: chạm → giao điểm cờ tướng, ngoài bàn thì null', () => {
  const g = KydaoDraw.layout('xiangqi', 368, 408);
  for (const flip of [false, true]) {
    for (const name of ['a0', 'i0', 'a9', 'i9', 'e4', 'e5', 'h2']) {
      const q = KydaoDraw.parseSq('xiangqi', name);
      const p = KydaoDraw.cellXY(g, q.col, q.row, flip);
      assert.strictEqual(KydaoDraw.squareAt(g, p.x, p.y, flip), name);
    }
  }
  const mid = KydaoDraw.cellXY(g, 0, 0, false);
  assert.strictEqual(KydaoDraw.squareAt(g, mid.x + g.cell * 0.5, mid.y - g.cell * 0.5, false), null); // giữa ô, xa giao điểm
  assert.strictEqual(KydaoDraw.squareAt(g, -50, 10, false), null);
  assert.strictEqual(KydaoDraw.parseSq('xiangqi', 'j1'), null);
  assert.strictEqual(KydaoDraw.parseSq('chess', 'a9'), null);
});

// Ghi lệnh Canvas để kiểm đường vẽ và bộ đệm trong Node, không cần DOM thật.
function drawingContext(ownerDocument) {
  const calls = [];
  let saves = 0;
  const ctx = { canvas: { ownerDocument }, calls, get saves() { return saves; } };
  for (const method of ['beginPath', 'closePath', 'fill', 'stroke', 'clip', 'rect', 'arc', 'ellipse',
    'moveTo', 'lineTo', 'bezierCurveTo', 'quadraticCurveTo', 'fillRect', 'strokeRect', 'clearRect',
    'setTransform', 'translate', 'scale', 'drawImage', 'fillText']) {
    ctx[method] = (...args) => {
      for (const value of args) if (typeof value === 'number') assert.ok(Number.isFinite(value));
      calls.push([method, ...args]);
    };
  }
  ctx.save = () => { saves++; };
  ctx.restore = () => { assert.ok(saves > 0); saves--; };
  ctx.getTransform = () => ({ a: 2 });
  ctx.createLinearGradient = ctx.createRadialGradient = (...args) => {
    assert.ok(args.every(Number.isFinite));
    return { addColorStop(stop) { assert.ok(stop >= 0 && stop <= 1); } };
  };
  return ctx;
}

test('KydaoDraw: vẽ đủ quân không có DOM, giữ hình học và dữ liệu ở ô 36/72px', () => {
  for (const cell of [36, 72]) for (const flip of [false, true]) {
    for (const game of ['chess', 'xiangqi', 'jieqi']) {
      const chess = game === 'chess';
      const state = (chess ? KyChess : KyXiangqi).create(chess ? {} : { variant: game, seed: 1 });
      const board = state.board.slice();
      const w = cell * (chess ? 8 : 9.2), h = cell * (chess ? 8 : 10.2);
      for (const vi of [false, true]) {
        const ctx = drawingContext();
        const g = KydaoDraw.draw(ctx, { game, w, h, dpr: 2, board, flip, vi,
          selected: 'e2', last: ['e2', 'e4'], checkSq: chess ? 'e1' : 'e0', targets: ['e3', 'e4'] });
        assert.deepStrictEqual(g, KydaoDraw.layout(game, w, h));
        assert.strictEqual(ctx.saves, 0);
        if (game === 'jieqi') assert.ok(ctx.calls.some(call => call[0] === 'fillText' && call[1] === '?'));
        if (game === 'xiangqi') assert.ok(ctx.calls.some(call => call[0] === 'fillText' && call[1] === (vi ? 'Tướng' : '帥')));
      }
      assert.deepStrictEqual(board, state.board);
    }
  }
});

test('KydaoDraw: dùng lại ảnh quân, tách bộ đệm theo cỡ ô, điểm ảnh và chữ Việt', () => {
  const buffers = [];
  const doc = { createElement(tag) {
    assert.strictEqual(tag, 'canvas');
    const buffer = drawingContext(doc);
    buffers.push(buffer);
    return { getContext: () => buffer };
  } };
  for (const game of ['chess', 'xiangqi']) {
    const ctx = drawingContext(doc);
    let scale = 1;
    ctx.getTransform = () => ({ a: scale });
    const board = (game === 'chess' ? KyChess : KyXiangqi).create({}).board;
    const options = { game, w: game === 'chess' ? 288 : 331.2, h: game === 'chess' ? 288 : 367.2, board };
    KydaoDraw.draw(ctx, options);
    assert.strictEqual(ctx.calls.filter(call => call[0] === 'drawImage').length, 32);
    let count = buffers.length;
    assert.ok(count > 0);
    KydaoDraw.draw(ctx, { ...options, flip: true, selected: 'e2' });
    assert.strictEqual(buffers.length, count, 'Đổi hướng và chọn ô không dựng lại quân');
    if (game === 'xiangqi') {
      KydaoDraw.draw(ctx, { ...options, vi: true });
      assert.ok(buffers.length > count);
      assert.ok(buffers.slice(count).some(buffer => buffer.calls.some(call => call[0] === 'fillText' && call[1] === 'Tướng')));
      count = buffers.length;
    }
    scale = 2;
    KydaoDraw.draw(ctx, { ...options, dpr: scale });
    assert.ok(buffers.length > count, 'Màn hình nhiều điểm ảnh cần ảnh quân nét hơn');
    count = buffers.length;
    KydaoDraw.draw(ctx, { ...options, w: options.w * 2, h: options.h * 2, dpr: scale });
    assert.ok(buffers.length > count, 'Cỡ ô lớn dùng ảnh quân riêng');
  }
  assert.ok(buffers.every(buffer => buffer.saves === 0));
});

test('tapSquare: chọn quân, chấm ô đi được, đi nước', () => {
  const S = session('chess', KyChess, 'a');
  let r = core.tapSquare(S, 'e2');
  assert.strictEqual(r.kind, 'select');
  assert.deepStrictEqual(r.targets.sort(), ['e3', 'e4']);
  r = core.tapSquare(S, 'e4');
  assert.deepStrictEqual(r, { kind: 'move', move: 'e2e4' });
  assert.strictEqual(core.tapSquare(S, 'e2').kind, 'clear'); // vẫn đang chọn e2 (chờ giao diện áp nước): chạm lại bỏ chọn
  assert.strictEqual(core.tapSquare(S, 'e2').kind, 'select');
  assert.strictEqual(core.tapSquare(S, 'e7').kind, 'clear'); // chạm quân đối thủ khi đang chọn: bỏ chọn
  assert.strictEqual(core.tapSquare(S, 'e7').kind, 'none');  // chưa chọn gì thì không làm gì
  assert.strictEqual(core.tapSquare(session('chess', KyChess, 'b'), 'e7').kind, 'none'); // chưa tới lượt
});

test('nước phong cấp có 5 ký tự và pushMove giữ info.promotion', () => {
  const state = KyChess.fromFen('8/4P2k/8/8/8/8/8/K7 w - - 0 1');
  const S = session('chess', KyChess, 'a', { state });
  const result = core.pushMove(S, 'e7e8q', 'e8=Q');
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.info.promotion, 'q');
});

test('tapSquare: phong cấp hỏi chọn quân', () => {
  const state = KyChess.fromFen('8/4P2k/8/8/8/8/8/K7 w - - 0 1');
  const S = session('chess', KyChess, 'a', { state });
  assert.strictEqual(core.tapSquare(S, 'e7').kind, 'select');
  const r = core.tapSquare(S, 'e8');
  assert.strictEqual(r.kind, 'promo');
  assert.deepStrictEqual(r.options.slice().sort(), ['b', 'n', 'q', 'r']);
});

test('tapSquare: cờ tướng và chấm ô', () => {
  const S = session('xiangqi', KyXiangqi, 'a');
  const r = core.tapSquare(S, 'h2');
  assert.strictEqual(r.kind, 'select');
  assert.ok(r.targets.includes('e2'));
  assert.deepStrictEqual(core.tapSquare(S, 'e2'), { kind: 'move', move: 'h2e2' });
});

test('handleMoved: đúng thứ tự §6.1.1', () => {
  const S = session('chess', KyChess, 'b');
  assert.strictEqual(core.handleMoved(S, { ply: 1, move: 'e2e4', text: 'e4', check: false, clock: { a: 1, b: 2, turn: 'b', turnStartedAt: 5 } }), 'applied');
  assert.strictEqual(S.ply, 1);
  assert.deepStrictEqual(S.last, ['e2', 'e4']);
  assert.strictEqual(core.handleMoved(S, { ply: 1, move: 'e2e4', text: 'e4' }), 'synced'); // gói của nước đã áp thử
  assert.strictEqual(core.handleMoved(S, { ply: 0, move: 'e2e4' }), 'dup');
  assert.strictEqual(core.handleMoved(S, { ply: 4, move: 'e7e5' }), 'gap');
  assert.strictEqual(S.ply, 1);
  assert.strictEqual(core.handleMoved(S, { ply: 2, move: 'zzzz' }), 'gap');
  assert.strictEqual(S.ply, 1);
  assert.strictEqual(core.handleMoved(S, { ply: 2, move: 'e7e5', text: 'e5' }), 'applied');
  assert.strictEqual(S.moves.length, 2);
});

test('kingSquare và tô chiếu', () => {
  const S = session('chess', KyChess, 'a');
  assert.strictEqual(core.kingSquare(S, 'a'), 'e1');
  assert.strictEqual(core.kingSquare(S, 'b'), 'e8');
  const X = session('xiangqi', KyXiangqi, 'a');
  assert.strictEqual(core.kingSquare(X, 'a'), 'e0');
  assert.strictEqual(core.kingSquare(X, 'b'), 'e9');
});

test('đồng hồ theo giờ máy chủ', () => {
  const clock = { a: 60000, b: 50000, turn: 'a', turnStartedAt: 1000 };
  assert.strictEqual(core.clockRemaining(clock, 'a', 11000), 50000);
  assert.strictEqual(core.clockRemaining(clock, 'b', 11000), 50000);
  assert.strictEqual(core.clockRemaining(clock, 'a', 999999), 0);
  assert.strictEqual(core.clockRemaining(Object.assign({}, clock, { turn: null }), 'a', 11000), 60000);
  assert.strictEqual(core.fmtClock(291000), '04:51');
  assert.strictEqual(core.fmtClock(0), '00:00');
  assert.strictEqual(core.fmtClock(59001), '01:00');
});

test('settleClock: chốt giờ bên đang đi lúc hết ván, không nhảy ngược', () => {
  const clock = { a: 60000, b: 40000, turn: 'a', turnStartedAt: 1000 };
  const e = core.settleClock(clock, 11000, 'b', 'resign');
  assert.strictEqual(e.a, 50000);
  assert.strictEqual(e.b, 40000);
  assert.strictEqual(e.turn, null);
  assert.strictEqual(core.clockRemaining(e, 'a', 99999), 50000);
  assert.strictEqual(clock.turn, 'a'); // không sửa bản gốc
});

test('settleClock: hết giờ thì bên thua về 0', () => {
  const clock = { a: 5000, b: 40000, turn: 'a', turnStartedAt: 1000 };
  const e = core.settleClock(clock, 20000, 'b', 'timeout');
  assert.strictEqual(e.a, 0);
  assert.strictEqual(e.b, 40000);
  assert.strictEqual(core.settleClock(null, 1, 'a', 'timeout'), null);
});

test('nextSkinIndex: mũi tên đi vòng tròn, Home/End về đầu/cuối, phím lạ trả -1', () => {
  assert.strictEqual(core.nextSkinIndex(9, 0, 'ArrowRight'), 1);
  assert.strictEqual(core.nextSkinIndex(9, 8, 'ArrowDown'), 0);
  assert.strictEqual(core.nextSkinIndex(9, 0, 'ArrowLeft'), 8);
  assert.strictEqual(core.nextSkinIndex(9, 3, 'ArrowUp'), 2);
  assert.strictEqual(core.nextSkinIndex(9, 4, 'Home'), 0);
  assert.strictEqual(core.nextSkinIndex(9, 4, 'End'), 8);
  assert.strictEqual(core.nextSkinIndex(9, 4, 'a'), -1);
  assert.strictEqual(core.nextSkinIndex(0, 0, 'ArrowRight'), -1);
});
