'use strict';
// Kiểm phần thuần của bảng bàn cờ: chuyển chạm → ô, chọn quân, phong cấp, thứ tự gói kd:moved, đồng hồ.
const test = require('node:test');
const assert = require('node:assert');
const KyChess = require('../public/js/kydao/chess.js');
const KyXiangqi = require('../public/js/kydao/xiangqi.js');
const KydaoDraw = require('../public/js/kydao-draw.js');

global.KyChess = KyChess;
global.KyXiangqi = KyXiangqi;
global.KydaoDraw = KydaoDraw;
const { core } = require('../public/js/kydao-ui.js');

function session(game, mod, you, extra) {
  return core.makeSession(Object.assign({ gameId: 'g1', table: 1, game, you, state: mod.create({}), ply: 0, moves: [],
    clock: { a: 60000, b: 60000, turn: 'a', turnStartedAt: 1000, incMs: 0 }, a: {}, b: {} }, extra || {}), mod);
}

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
