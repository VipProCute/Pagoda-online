'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const Draw = require('../public/js/kydao-draw.js');
const Chess = require('../public/js/kydao/chess.js');
const Xiangqi = require('../public/js/kydao/xiangqi.js');
const Go = require('../public/js/kydao/go.js');
const Gomoku = require('../public/js/kydao/gomoku.js');

// Dùng hình học Three thật, thay riêng GPU và bề mặt trình duyệt trong Node.
// Các ca này không thay thế ảnh chụp WebGL2 ở trình duyệt.
const threeURL = pathToFileURL(path.join(path.dirname(require.resolve('three')), 'three.module.js')).href;
const source = fs.readFileSync(path.join(__dirname, '../public/js/world3d/board3d.mjs'), 'utf8')
  .replace(/import \* as THREE from '[^']+';/, `import * as Real from '${threeURL}'; const THREE = { ...Real, WebGLRenderer: globalThis.__BoardRenderer };`);
let renderedScene, renderedCamera, renderCount = 0, disposals = 0;
global.__BoardRenderer = class {
  constructor() { this.shadowMap = {}; this.capabilities = { getMaxAnisotropy: () => 4 }; }
  setPixelRatio() {}
  setSize() {}
  render(scene, camera) { renderedScene = scene; renderedCamera = camera; renderCount++; }
  dispose() { disposals++; }
  forceContextLoss() {}
};
const modulePromise = import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));

test('Bàn 3D: mọi ô vua, tướng, úp khớp squareAt ở cả hai hướng nhìn', async () => {
  const { boardLayout, squareAtWorld } = await modulePromise;
  for (const game of ['chess', 'xiangqi', 'jieqi']) {
    const l = boardLayout(game), g = Draw.layout(game, 640, 640);
    for (const flip of [false, true]) for (let r = 0; r < l.rows; r++) for (let c = 0; c < l.cols; c++) {
      const p = Draw.cellXY(g, c, r, flip), x = (flip ? l.cols - 1 - c : c) - (l.cols - 1) / 2;
      const z = (l.rows - 1) / 2 - (flip ? l.rows - 1 - r : r);
      assert.equal(squareAtWorld(l, x, z, flip), Draw.squareAt(g, p.x, p.y, flip));
    }
    assert.equal(squareAtWorld(l, 100, 0), null);
    assert.equal(squareAtWorld(l, NaN, 0), null);
    if (!l.chess) assert.equal(squareAtWorld(l, -3.5, 4), null);
  }
});

test('Bàn 3D: vây bỏ cột I, caro dùng hàng từ đáy và kiểm kích thước', async () => {
  const { boardLayout, squareAtWorld } = await modulePromise;
  const go = boardLayout('go', 19), gomoku = boardLayout('gomoku', 15);
  assert.equal(squareAtWorld(go, -1, 0), 'J10');
  assert.equal(squareAtWorld(go, 9, -9), 'T19');
  assert.equal(squareAtWorld(gomoku, 0, 0), 'h8');
  assert.equal(squareAtWorld(gomoku, -7, 7), 'a1');
  assert.throws(() => boardLayout('go', 15));
  assert.throws(() => boardLayout('gomoku', 20));
});

test('Bàn 3D: ghép quân đi, quân bị ăn, nhập thành, bắt qua đường và phong cấp', async () => {
  const { boardLayout, transitionPieces } = await modulePromise;
  const l = boardLayout('chess');
  const board = entries => {
    const out = Array(64).fill('');
    for (const [name, ch] of Object.entries(entries)) { const q = Draw.parseSq('chess', name); out[q.row * 8 + q.col] = ch; }
    return out;
  };
  for (const [before, after, last, captured, pairs] of [
    [{ e2: 'P', d4: 'p' }, { e4: 'P', d4: 'p' }, ['e2', 'e4'], [], [[28, 12]]],
    [{ e4: 'P', d5: 'p' }, { d5: 'P' }, ['e4', 'd5'], [35], [[35, 28]]],
    [{ e1: 'K', h1: 'R' }, { g1: 'K', f1: 'R' }, ['e1', 'g1'], [], [[6, 4], [5, 7]]],
    [{ e5: 'P', d5: 'p' }, { d6: 'P' }, ['e5', 'd6'], [35], [[43, 36]]],
    [{ a7: 'P' }, { a8: 'Q' }, ['a7', 'a8'], [], [[56, 48]]]
  ]) {
    const a = board(before), b = board(after), result = transitionPieces(a, b, last, l);
    assert.equal(result.move, true); assert.deepEqual(result.captured, captured);
    for (const [to, from] of pairs) assert.equal(result.pairs.get(to), from);
    assert.deepEqual(a, board(before)); assert.deepEqual(b, board(after));
  }
  assert.equal(transitionPieces([], Chess.create({}).board, [], l).move, false);
  let go = Go.create({ size: 9 });
  for (const move of ['B1', 'A1']) go = Go.play(go, move).state;
  const taken = Go.play(go, 'A2').state;
  const delta = transitionPieces(go.board, taken.board, ['A2'], boardLayout('go', 9));
  assert.equal(delta.move, true); assert.deepEqual(delta.captured, [0]);
});

function fakeSurface() {
  const texts = [], listeners = new Map(), queue = new Map(); let serial = 0;
  const ctx = new Proxy({ fillText: text => texts.push(text) }, { get(target, key) { return key in target ? target[key] : () => {}; } });
  global.document = { createElement: () => ({ getContext: () => ctx }) };
  const media = { matches: false, addEventListener() {}, removeEventListener() {} };
  global.window = { devicePixelRatio: 1, matchMedia: () => media };
  global.ResizeObserver = class { observe() {} disconnect() {} };
  global.requestAnimationFrame = fn => { queue.set(++serial, fn); return serial; };
  global.cancelAnimationFrame = id => queue.delete(id);
  const canvas = {
    style: { touchAction: 'manipulation' }, getBoundingClientRect: () => ({ left: 0, top: 0, width: 640, height: 640 }),
    addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: name => listeners.delete(name),
    setPointerCapture() {}, hasPointerCapture: () => false, releasePointerCapture() {}
  };
  const flush = () => { const callbacks = [...queue.values()]; queue.clear(); callbacks.forEach(fn => fn(performance.now() + 1000)); };
  return { canvas, texts, listeners, queue, flush, media };
}

test('Bàn 3D: dựng hình, raycast chạm, trượt, xếp quân ăn, giảm chuyển động và dọn vòng đời', async () => {
  const { createBoard3D } = await modulePromise;
  const THREE = await import(threeURL), env = fakeSurface();
  const view = createBoard3D({ canvas: env.canvas, game: 'chess' });
  let state = Chess.create({}), name;
  const snapshot = structuredClone(state);
  view.onPick(value => { name = value; }); view.setState({ game: 'chess', board: state.board }); env.flush();
  assert.deepEqual(state, snapshot);
  const geometries = []; renderedScene.traverse(m => { if (m.geometry) geometries.push(m.geometry.type); });
  assert.ok(geometries.includes('LatheGeometry')); assert.ok(geometries.includes('ExtrudeGeometry'));
  assert.equal(env.queue.size, 0); // Không vẽ liên tục khi bàn đứng yên.
  function tap(x, z, flip) {
    view.setFlip(flip); env.flush();
    const point = new THREE.Vector3(x, 0, z).project(renderedCamera);
    const event = { button: 0, pointerId: 1, clientX: (point.x + 1) * 320, clientY: (1 - point.y) * 320, type: 'pointerup' };
    env.listeners.get('pointerdown')(event); env.listeners.get('pointerup')(event);
  }
  tap(0.5, 0.5, false); assert.equal(name, 'e4');
  tap(-0.5, -0.5, true); assert.equal(name, 'e4');
  name = null;
  const press = { button: 0, pointerId: 2, clientX: 320, clientY: 320 };
  env.listeners.get('pointerdown')(press);
  env.listeners.get('pointermove')({ ...press, clientX: 380 });
  env.listeners.get('pointerup')({ ...press, clientX: 380, type: 'pointerup' });
  assert.equal(name, null); // Kéo xoay không phát nước đi.
  view.setFlip(false);
  for (const move of ['e2e4', 'd7d5', 'e4d5']) {
    state = Chess.play(state, move).state;
    view.setState({ board: state.board, last: [move.slice(0, 2), move.slice(2)] }); env.flush();
  }
  const captured = []; renderedScene.traverse(m => { if (m.type === 'Group' && m.position.y === -0.18) captured.push(m); });
  assert.equal(captured.length, 1); assert.ok(Math.abs(captured[0].position.x) > 4);
  env.media.matches = true;
  state = Chess.play(state, 'd8d5').state; view.setState({ board: state.board, last: ['d8', 'd5'] }); env.flush();
  assert.equal(env.queue.size, 0); assert.ok(renderCount > 0);
  const before = disposals; view.dispose(); view.dispose();
  assert.equal(disposals, before + 1); assert.equal(env.listeners.size, 0); assert.equal(env.queue.size, 0);
  assert.equal(env.canvas.style.touchAction, 'manipulation');
});

test('Bàn 3D: chữ Việt, quân úp không lộ chữ, vây/caro dựng được từ dữ liệu luật thật', async () => {
  const { createBoard3D } = await modulePromise;
  for (const game of ['xiangqi', 'jieqi', 'go', 'gomoku']) {
    const env = fakeSurface(), view = createBoard3D({ canvas: env.canvas, game });
    let state;
    if (game === 'go') state = Go.play(Go.create({ size: 9 }), 'C3').state;
    else if (game === 'gomoku') state = Gomoku.play(Gomoku.create({}), 'h8').state;
    else state = Xiangqi.view(Xiangqi.create({ variant: game, seed: 1 }), 'a');
    view.setState({ game, ...state, vi: true }); env.flush();
    if (game === 'xiangqi') {
      assert.ok(env.texts.includes('Tướng'));
      state = Xiangqi.play(state, 'b2b9').state;
      view.setState({ game, ...state, last: ['b2', 'b9'], vi: false });
      view.setState({ game, ...state, last: ['b2', 'b9'], vi: true }); env.flush();
      const arrived = []; renderedScene.traverse(m => {
        if (m.type === 'Group' && m.position.x === -3 && m.position.z === -4.5) arrived.push(m);
      });
      assert.equal(arrived.length, 1); // Đổi chữ giữa nước đi không làm quân đứng lại giữa đường.
    }
    if (game === 'jieqi') assert.ok(!env.texts.some(text => ['Xe', 'Mã', 'Tượng', 'Sĩ', 'Pháo', 'Tốt'].includes(text)));
    view.dispose();
  }
});

test('Trang thử: mọi nước mẫu trong HTML hợp lệ theo luật hiện hành', () => {
  const html = fs.readFileSync(path.join(__dirname, '../public/world3d-board.html'), 'utf8');
  const fixtures = [...html.matchAll(/addBoard\('(chess|xiangqi|go|gomoku)',[^\n]*window\.Ky\w+, (\[[^\]]+\])/g)];
  assert.equal(fixtures.length, 4);
  for (const [, game, list] of fixtures) {
    const mod = { chess: Chess, xiangqi: Xiangqi, go: Go, gomoku: Gomoku }[game];
    const moves = JSON.parse(list.replace(/'/g, '"'));
    let state = mod.create(game === 'go' ? { size: 9 } : {});
    for (const move of moves) { const result = mod.play(state, move); assert.equal(result.ok, true, move); state = result.state; }
  }
});
