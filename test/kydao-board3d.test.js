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
const Skins = require('../public/js/kydao-skins.js');
const assetsURL = pathToFileURL(path.join(__dirname, '../public/js/world3d/board-assets.mjs')).href;

// Dùng hình học Three thật, thay riêng GPU và bề mặt trình duyệt trong Node.
// Các ca này không thay thế ảnh chụp WebGL2 ở trình duyệt.
const threeURL = pathToFileURL(path.join(path.dirname(require.resolve('three')), 'three.module.js')).href;
const source = fs.readFileSync(path.join(__dirname, '../public/js/world3d/board3d.mjs'), 'utf8')
  .replace(/import \* as THREE from '[^']+';/, `import * as Real from '${threeURL}'; const THREE = { ...Real, WebGLRenderer: globalThis.__BoardRenderer };`);
let renderedScene, renderedCamera, renderCount = 0, disposals = 0;
// renderer.info.memory giả lập đúng cách WebGLRenderer đếm: hình/texture được vẽ thì "nằm trên GPU" tới khi dispose().
global.__BoardRenderer = class {
  constructor() {
    this.shadowMap = {}; this.capabilities = { getMaxAnisotropy: () => 4 };
    this.info = { memory: { geometries: 0, textures: 0 } }; this.live = { geometries: new Set(), textures: new Set() };
  }
  track(kind, res) {
    const set = this.live[kind];
    if (set.has(res)) return;
    set.add(res);
    const gone = () => { res.removeEventListener('dispose', gone); set.delete(res); this.info.memory[kind] = set.size; };
    res.addEventListener('dispose', gone);
  }
  setPixelRatio() {}
  setSize() {}
  render(scene, camera) {
    renderedScene = scene; renderedCamera = camera; renderCount++;
    scene.traverse(o => {
      if (o.geometry) this.track('geometries', o.geometry);
      for (const m of [].concat(o.material || [])) for (const v of Object.values(m)) if (v && v.isTexture) this.track('textures', v);
    });
    this.info.memory.geometries = this.live.geometries.size; this.info.memory.textures = this.live.textures.size;
  }
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
  const ctx = new Proxy({ fillText: text => texts.push(text), createLinearGradient: () => ({ addColorStop() {} }) }, { get(target, key) { return key in target ? target[key] : () => {}; } });
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
  // Chạy đúng một khung ở mốc thời gian cho trước (hiệu ứng bắt đầu đếm từ khung đầu tiên).
  const flushAt = t => { const callbacks = [...queue.values()]; queue.clear(); callbacks.forEach(fn => fn(t)); };
  return { canvas, texts, listeners, queue, flush, flushAt, media };
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

/* ---- T-113 · Skin sân, skin quân và hiệu ứng trên bàn 3D ---- */

const noModels = { loadModel: async () => null, instantiate: () => { throw new Error('Không được nhân bản khi không có mô hình.'); } };
const settle = async () => { for (let i = 0; i < 12; i++) await new Promise(resolve => setImmediate(resolve)); };
function chessBoard(entries) {
  const out = Array(64).fill('');
  for (const [name, ch] of Object.entries(entries)) { const q = Draw.parseSq('chess', name); out[q.row * 8 + q.col] = ch; }
  return out;
}
async function openBoard(game, opts = {}) {
  const { createBoard3D } = await modulePromise;
  const env = fakeSurface();
  const view = createBoard3D({ canvas: env.canvas, game, skins: Skins, assets: opts.assets || noModels, quality: opts.quality });
  return { env, view };
}
const halfNode = side => renderedScene.getObjectByName('kd-half-' + side);
const meshes = root => { const out = []; root.traverse(o => { if (o.isMesh) out.push(o); }); return out; };
const hex = m => '#' + m.material.color.getHexString();
// Nhóm quân đứng ở toạ độ bàn (x, z): con trực tiếp của nhóm bàn.
function pieceAt(x, z) {
  let found = null;
  renderedScene.traverse(o => {
    if (o.type === 'Group' && o.parent && o.parent.parent === renderedScene && Math.abs(o.position.x - x) < 1e-6 && Math.abs(o.position.z - z) < 1e-6) found = o;
  });
  return found;
}

test('Kỳ Đài: hàm thuần cho sóng phong cấp, khai mở, rung, đổ Vua và nửa sân', async () => {
  const m = await modulePromise, { FX } = m;
  assert.equal(m.joltLift(0, 100), 0);
  assert.equal(m.joltLift(1, 1 / FX.wave - 1), 0); // sóng chưa tới
  const peak = d => { let best = 0, at = 0; for (let t = 0; t < 3000; t += 5) { const v = m.joltLift(d, t); if (v > best) { best = v; at = t; } } return { best, at }; };
  const near = peak(1), mid = peak(4), far = peak(9);
  assert.ok(near.best > mid.best && mid.best > far.best, 'gần nảy cao hơn xa');
  assert.ok(near.at < mid.at && mid.at < far.at, 'gần nảy sớm hơn xa');
  assert.ok(Math.abs(near.at - (1 / FX.wave + FX.hop / 2)) <= 5);
  assert.ok(far.best > 0.1, 'quân xa nhất vẫn thấy nảy');
  assert.equal(m.joltLift(9, m.joltDuration(9) + 1), 0);
  let last = -1;
  for (let t = 0; t <= FX.domain; t += 25) { const r = m.revealProgress(t); assert.ok(r.front >= last); last = r.front; }
  assert.equal(m.revealProgress(0).front, 0);
  assert.deepEqual(m.revealProgress(FX.domain), { front: 1, glow: 0, done: true });
  assert.equal(m.revealProgress(Infinity).done, true);
  assert.equal(m.riseAt(0.3, 0), 1); assert.equal(m.riseAt(0.3, 0.9), 0); assert.equal(m.riseAt(1, 1), 1);
  assert.deepEqual(m.shakeOffset(-1), { x: 0, y: 0 }); assert.deepEqual(m.shakeOffset(FX.shake), { x: 0, y: 0 });
  const s = m.shakeOffset(40); assert.ok(Math.hypot(s.x, s.y) > 0 && Math.hypot(s.x, s.y) <= FX.shakeAmp);
  assert.equal(m.waveRing(500, 7).radius, 500 * FX.wave); // vòng sáng chạy đúng tốc độ sóng nảy
  assert.equal(m.waveRing(-1, 7).opacity, 0); assert.equal(m.waveRing(1e5, 7).opacity, 0);
  const tall = m.fallPose('tall', Infinity), disk = m.fallPose('disk', Infinity);
  assert.ok(tall.done && Math.abs(tall.angle - (Math.PI / 2 - 0.05)) < 1e-9);
  assert.ok(disk.done && Math.abs(disk.angle - Math.PI) < 1e-9 && Math.abs(disk.lift - 0.285) < 1e-9);
  assert.equal(m.fallPose('tall', 0).angle, 0);
  assert.equal(m.pillarPose(FX.strike).reach, 1);
  assert.deepEqual(m.pillarPose(FX.pillar), { reach: 1, opacity: 0, done: true });
  const chess = m.boardLayout('chess'), xq = m.boardLayout('xiangqi');
  assert.deepEqual([0, 3, 4, 7].map(r => m.halfOf(chess, r)), ['a', 'a', 'b', 'b']);
  assert.deepEqual([0, 4, 5, 9].map(r => m.halfOf(xq, r)), ['a', 'a', 'b', 'b']);
  assert.equal(m.halfOf(m.boardLayout('go', 9), 0), null); assert.equal(m.halfOf(chess, 8), null);
  // Nửa sân của bên a là nửa có quân a lúc khai cuộc.
  Chess.create({}).board.forEach((ch, i) => { if (ch) assert.equal(m.halfOf(chess, Math.floor(i / 8)), ch === ch.toUpperCase() ? 'a' : 'b'); });
  for (const variant of ['xiangqi', 'jieqi']) {
    Xiangqi.create({ variant, seed: 2 }).board.forEach((ch, i) => { if (ch) assert.equal(m.halfOf(xq, Math.floor(i / 9)), ch === ch.toUpperCase() ? 'a' : 'b'); });
  }
  for (const l of [chess, xq]) {
    const { w, d } = m.boardSize(l);
    for (const side of ['a', 'b']) {
      const list = m.decorAnchors(l, side);
      assert.ok(list.length >= 4);
      for (const p of list) {
        assert.ok(side === 'a' ? p.z > 0 : p.z < 0, 'đồ trang trí nằm phía nửa sân của mình');
        assert.ok(Math.abs(p.x) > (w + 0.25) / 2 || Math.abs(p.z) > (d + 0.25) / 2, 'nằm ngoài thành bàn');
        assert.ok(Math.abs(p.z) > 3, 'tránh dải xếp quân bị ăn');
      }
    }
  }
  assert.deepEqual(m.decorAnchors(m.boardLayout('gomoku', 15), 'a'), []);
  for (const kind of ['ember', 'ripple', 'leaf', 'snow', 'bubble', 'petal', 'spark', 'sand', 'dust', 'rise']) {
    for (let i = 0; i < 24; i++) for (const t of [0, 0.3, 0.7, 1]) {
      const p = m.particlePoint(kind, i, t);
      assert.ok(['u', 'v', 'y'].every(k => Number.isFinite(p[k])));
      assert.deepEqual(m.particlePoint(kind, i, t), p); // tất định
    }
  }
});

test('Kỳ Đài: màu skin luôn đủ tương phản để đọc thế cờ', async () => {
  const m = await modulePromise;
  for (const [id, def] of Object.entries(Skins.PIECES)) {
    for (const side of ['a', 'b']) assert.ok(m.contrastRatio(m.readableInk(def[side].base, def[side].accent), def[side].base) >= 4.5, id + side);
    assert.ok(m.contrastRatio(def.a.base, def.b.base) >= 3, id + ': a sáng, b tối');
  }
  for (const [id, def] of Object.entries(Skins.FIELDS)) {
    const xq = m.fieldTones(def.palette, false), ch = m.fieldTones(def.palette, true);
    assert.ok(m.contrastRatio(xq.line, xq.ground) >= 3, id + ': nét kẻ cờ tướng');
    assert.ok(m.contrastRatio(ch.line, ch.frame) >= 3, id + ': chữ toạ độ cờ vua');
    assert.ok(m.contrastRatio(ch.dark, '#000000') >= 2.3, id + ': ô tối không nuốt quân đen');
    assert.ok(m.contrastRatio(ch.light, ch.dark) >= 1.3, id + ': phân biệt hai màu ô');
  }
  assert.equal(m.mixColor('#000000', '#ffffff', 0.5), '#808080');
  assert.ok(m.contrastRatio(m.readableInk('#ffffff', 'oops'), '#ffffff') >= 4.5); // màu hỏng thì vẫn ra mực đọc được
});

test('Kỳ Đài: o.skins đổi từng nửa sân và quân từng bên; mã lạ, môn không hỗ trợ bị bỏ qua', async () => {
  const THREE = await import(threeURL);
  const { env, view } = await openBoard('chess'), st = Chess.create({});
  view.setState({ board: st.board }); env.flush();
  assert.equal(halfNode('a'), undefined); assert.equal(halfNode('b'), undefined);
  const plainColors = new Set(meshes(renderedScene).map(hex));
  assert.ok(plainColors.has('#f7dfae') && plainColors.has('#292d29')); // ngà và mun mặc định
  view.setState({ board: st.board, skins: { a: { field: 'volcano', pieces: 'magma' }, b: { field: 'hack', pieces: '__proto__' }, __proto__: { field: 'river' } } });
  env.flush();
  assert.ok(halfNode('a')); assert.equal(halfNode('b'), undefined);
  assert.deepEqual({ ...view.stats(), geometries: 0, textures: 0 }, { geometries: 0, textures: 0, pieceSkins: 1, halves: 1, effects: 0, fieldImages: 0 });
  const colors = meshes(renderedScene).map(hex);
  assert.equal(colors.filter(c => c === Skins.PIECES.magma.a.base).length >= 16, true, 'thân 16 quân trắng mang màu Dung Nham');
  assert.ok(colors.includes(Skins.PIECES.magma.a.accent), 'viền quân theo accent');
  assert.ok(colors.includes('#292d29'), 'bên b vẫn gỗ mun mặc định');
  // Nửa sân a nằm phía +Z (phía quân trắng), dưới mọi dấu nước đi.
  const box = new THREE.Box3().setFromObject(halfNode('a'));
  assert.ok(box.min.z >= -1e-6 && box.max.z > 4);
  for (const plane of meshes(halfNode('a')).filter(o => o.geometry.type === 'PlaneGeometry')) {
    assert.ok(plane.getWorldPosition(new THREE.Vector3()).y < 0.022);
  }
  view.setState({ board: st.board, skins: { a: { pieces: 'magma' }, b: { field: 'glacier', pieces: 'ice' } } }); env.flush();
  assert.equal(halfNode('a'), undefined);
  const bBox = new THREE.Box3().setFromObject(halfNode('b'));
  assert.ok(bBox.max.z <= 1e-6 && bBox.min.z < -4);
  assert.equal(view.stats().pieceSkins, 2);
  view.setState({ board: st.board }); env.flush();
  assert.deepEqual([view.stats().pieceSkins, view.stats().halves], [0, 0]);
  assert.deepEqual(new Set(meshes(renderedScene).map(hex)), plainColors, 'bỏ skin thì về đúng hình cũ');
  view.dispose();
  for (const game of ['go', 'gomoku']) {
    const other = await openBoard(game);
    const state = game === 'go' ? Go.create({ size: 9 }) : Gomoku.create({});
    other.view.setState({ game, ...state, skins: { a: { field: 'volcano', pieces: 'magma' } } }); other.env.flush();
    assert.equal(halfNode('a'), undefined); assert.equal(other.view.stats().pieceSkins, 0);
    other.view.dispose();
  }
});

test('Kỳ Đài: cờ úp có skin vẫn để mọi quân úp một bên giống hệt nhau, không lộ chữ', async () => {
  const { env, view } = await openBoard('jieqi');
  const st = Xiangqi.view(Xiangqi.create({ variant: 'jieqi', seed: 3 }));
  for (const vi of [true, false]) {
    view.setState({ game: 'jieqi', ...st, vi, skins: { a: { field: 'river', pieces: 'jade' }, b: { field: 'desert', pieces: 'storm' } } }); env.flush();
    const faces = meshes(renderedScene).filter(o => o.userData.role === 'face'), count = new Map();
    for (const f of faces) count.set(f.material, (count.get(f.material) || 0) + 1);
    assert.equal(faces.length, 32);
    assert.deepEqual([...count.values()].sort((a, b) => a - b), [1, 1, 15, 15]); // K, k, 15 lưng đỏ, 15 lưng đen
    const backs = faces.filter(f => count.get(f.material) === 15);
    for (const f of backs) {
      const twin = backs.find(o => o.material === f.material);
      assert.equal(f.parent.children.length, twin.parent.children.length);
      f.parent.children.forEach((c, i) => { assert.equal(c.geometry, twin.parent.children[i].geometry); assert.equal(c.material, twin.parent.children[i].material); });
    }
  }
  assert.ok(!env.texts.some(text => ['Xe', 'Mã', 'Tượng', 'Sĩ', 'Pháo', 'Tốt', '俥', '傌', '炮', '兵', '砲', '卒'].includes(text)));
  view.dispose();
});

test('Kỳ Đài: khai mở đổi dần từ mép người chơi; giảm chuyển động đổi tức thì; mức Thấp không hạt', async () => {
  const { FX } = await modulePromise;
  for (const quality of ['medium', 'low']) {
    const { env, view } = await openBoard('chess', { quality }), st = Chess.create({}), T0 = performance.now() + 5000;
    const points = () => { let n = 0; renderedScene.traverse(o => { if (o.isPoints) n++; }); return n; };
    view.setState({ board: st.board }); env.flushAt(T0);
    view.setState({ board: st.board, skins: { a: { field: 'volcano' } } });
    const done = view.playFx('domain', { side: 'a' });
    const pivot = () => halfNode('a').children[0];
    assert.ok(pivot().scale.z < 0.01, 'chưa vẽ khung nào đã giấu nửa sân mới');
    env.flushAt(T0 + 10); assert.ok(pivot().scale.z < 0.01);
    env.flushAt(T0 + 10 + FX.front / 3);
    const mid = pivot().scale.z;
    assert.ok(mid > 0.3 && mid < 1, 'đang lan dần');
    assert.equal(points(), quality === 'low' ? 0 : 1);
    assert.equal(view.stats().effects, 1);
    env.flushAt(T0 + 10 + FX.domain + 1);
    assert.equal(pivot().scale.z, 1); assert.equal(env.queue.size, 0); assert.equal(await done, true);
    assert.equal(points(), 0); assert.equal(view.stats().effects, 0);
    // Truyền field: đổi từ sân cũ sang sân mới ngay trong hiệu ứng, sân cũ được dọn khi xong.
    const swap = view.playFx('domain', { side: 'a', field: 'forest' });
    env.flushAt(T0 + 3000);
    let names = 0; renderedScene.traverse(o => { if (o.name === 'kd-half-a') names++; });
    assert.equal(names, 2, 'sân cũ nằm dưới trong lúc sân mới phủ lên');
    env.flushAt(T0 + 3000 + FX.domain + 1); assert.equal(await swap, true);
    names = 0; renderedScene.traverse(o => { if (o.name === 'kd-half-a') names++; });
    assert.equal(names, 1);
    env.media.matches = true;
    view.setState({ board: st.board, skins: { a: { field: 'river' } } });
    assert.equal(await view.playFx('domain', { side: 'a' }), true);
    assert.equal(pivot().scale.z, 1); env.flush(); assert.equal(env.queue.size, 0);
    assert.equal(await view.playFx('domain', { side: 'b' }), false, 'nửa chưa có skin thì không có gì để khai mở');
    assert.equal(await view.playFx('nope', {}), false);
    view.dispose();
  }
});

test('Kỳ Đài: phong cấp rung máy quay, quân nảy theo sóng từ ô phong cấp rồi đứng yên', async () => {
  const { FX } = await modulePromise;
  const { env, view } = await openBoard('chess'), T0 = performance.now() + 5000;
  const base = { e1: 'K', e8: 'k', b8: 'n', h1: 'R', c6: 'p' };
  view.setState({ board: chessBoard({ ...base, a7: 'P' }) }); env.flushAt(T0);
  const camera = renderedCamera.position.clone();
  view.setState({ board: chessBoard({ ...base, a8: 'Q' }), last: ['a7', 'a8'] });
  const done = view.playFx('promote', { at: 'a8' });
  const knight = pieceAt(-2.5, -3.5), rook = pieceAt(3.5, 3.5); // b8 cách 1 ô, h1 cách ~9,9 ô
  const rings = () => meshes(renderedScene).filter(o => o.geometry.type === 'RingGeometry').length;
  env.flushAt(T0 + 20);
  assert.ok(rings() >= 1);
  env.flushAt(T0 + 20 + 1 / FX.wave + FX.hop / 2);
  const knightPeak = knight.position.y;
  assert.ok(knightPeak > 0.015 + 0.4, 'quân kề bật cao'); assert.equal(rook.position.y, 0.015, 'quân xa chưa tới lượt');
  assert.ok(Math.abs(knight.rotation.x) > 0 || Math.abs(knight.rotation.z) > 0, 'ngả ra xa tâm chấn');
  assert.ok(renderedCamera.position.distanceTo(camera) > 1e-4, 'máy quay rung');
  env.flushAt(T0 + 20 + Math.hypot(7, 7) / FX.wave + FX.hop / 2);
  assert.ok(rook.position.y > 0.015 + 0.05 && rook.position.y < knightPeak, 'quân xa nảy thấp và trễ');
  env.flushAt(T0 + 1e4);
  assert.equal(await done, true); assert.equal(env.queue.size, 0); assert.equal(rings(), 0);
  for (const g of [knight, rook]) { assert.equal(g.position.y, 0.015); assert.deepEqual([g.rotation.x, g.rotation.z], [0, 0]); }
  assert.ok(renderedCamera.position.distanceTo(camera) < 1e-9, 'máy quay về chỗ cũ');
  env.media.matches = true;
  assert.equal(await view.playFx('promote', { at: 'a8' }), true);
  env.flush(); assert.equal(env.queue.size, 0); assert.equal(knight.position.y, 0.015);
  assert.equal(await view.playFx('promote', { at: 'z9' }), false);
  view.dispose();
});

test('Kỳ Đài: chiến thắng làm Vua/Tướng bên thua đổ, cột sáng dội rồi tắt; ván mới dựng lại', async () => {
  const THREE = await import(threeURL), { FX } = await modulePromise;
  const pillars = () => meshes(renderedScene).filter(o => o.geometry.type === 'CylinderGeometry' && o.material.blending === THREE.AdditiveBlending).length;
  {
    const { env, view } = await openBoard('chess'), T0 = performance.now() + 5000;
    let st = Chess.create({});
    for (const m of ['f2f3', 'e7e5', 'g2g4', 'd8h4']) st = Chess.play(st, m).state;
    const skins = { b: { field: 'thunder' } };
    view.setState({ board: st.board, skins }); env.flushAt(T0);
    const white = pieceAt(0.5, 3.5), black = pieceAt(0.5, -3.5);
    const done = view.playFx('win', { result: 'b', reason: 'checkmate' });
    env.flushAt(T0 + 10); env.flushAt(T0 + 10 + 120);
    assert.equal(pillars(), 2); // vỏ + lõi
    env.flushAt(T0 + 10 + FX.pillar + FX.fall);
    assert.equal(await done, true); assert.equal(env.queue.size, 0); assert.equal(pillars(), 0);
    assert.ok(white.rotation.x > 1.4, 'Vua trắng ngã về phía mép của mình'); assert.ok(Math.abs(black.rotation.x) < 1e-9);
    view.setState({ board: st.board, skins, selected: 'e2' }); env.flush();
    assert.ok(white.rotation.x > 1.4, 'chọn ô không dựng Vua dậy');
    view.setState({ board: Chess.create({}).board, skins }); env.flush();
    assert.equal(white.rotation.x, 0); assert.equal(white.position.y, 0.015);
    env.media.matches = true;
    assert.equal(await view.playFx('win', { result: 'a' }), true);
    assert.ok(black.rotation.x < -1.4); env.flush(); assert.equal(env.queue.size, 0); assert.equal(pillars(), 0);
    view.dispose();
  }
  {
    const { env, view } = await openBoard('xiangqi'), T0 = performance.now() + 5000, st = Xiangqi.create({});
    view.setState({ game: 'xiangqi', ...st }); env.flushAt(T0);
    const general = pieceAt(0, 4.5); // e0 của bên đỏ
    const done = view.playFx('win', { result: 'b' });
    env.flushAt(T0 + 10); env.flushAt(T0 + 10 + 1e4);
    assert.equal(await done, true); assert.ok(Math.abs(general.rotation.x - Math.PI) < 1e-9); assert.ok(general.position.y > 0.29);
    view.dispose();
  }
  for (const game of ['gomoku', 'go']) {
    const { env, view } = await openBoard(game), T0 = performance.now() + 5000;
    let st = game === 'go' ? Go.create({ size: 9 }) : Gomoku.create({});
    for (const m of (game === 'go' ? ['C3'] : ['h8', 'a1', 'i8', 'a2', 'j8', 'a3', 'k8', 'a4', 'l8'])) st = (game === 'go' ? Go : Gomoku).play(st, m).state;
    view.setState({ game, ...st }); env.flushAt(T0);
    const done = view.playFx('win', game === 'go' ? { result: 'draw' } : { result: 'a', line: ['h8', 'i8', 'j8', 'k8', 'l8'] });
    env.flushAt(T0 + 10); env.flushAt(T0 + 200);
    assert.equal(pillars(), game === 'go' ? 2 : 10);
    env.flushAt(T0 + 1e4); assert.equal(await done, true); assert.equal(pillars(), 0);
    view.dispose();
  }
});

test('Kỳ Đài: nạp .glb lười qua board-assets; 404 thì lùi về vẽ bằng mã', async () => {
  const THREE = await import(threeURL), Assets = await import(assetsURL);
  const urls = [];
  let imports = 0;
  const shared = { geometry: new THREE.BoxGeometry(0.5, 1.2, 0.5), body: new THREE.MeshStandardMaterial({ name: 'Than' }), accent: new THREE.MeshStandardMaterial({ name: 'Accent_vien' }) };
  const piecesScene = () => {
    const root = new THREE.Group();
    ['K', 'Q', 'R', 'B', 'N', 'P', 'disc'].forEach((name, i) => {
      const g = new THREE.Group(); g.name = name; g.position.x = i * 2; // xếp hàng ngang như trong Blender
      const body = new THREE.Mesh(shared.geometry, shared.body); body.position.y = 0.6;
      const trim = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.05, 6, 12), shared.accent);
      g.add(body, trim); root.add(g);
    });
    return root;
  };
  const fieldScene = () => {
    const root = new THREE.Group(), tree = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1, 7), new THREE.MeshStandardMaterial({ name: 'Reu', map: new THREE.Texture() }));
    tree.name = 'Tree'; tree.position.set(5, 0, -2); root.add(tree); return root;
  };
  class FakeGLTFLoader {
    loadAsync(url) {
      urls.push(url);
      if (url === '/models/kydao/pieces/jade.glb') return Promise.resolve({ scene: piecesScene() });
      if (url === '/models/kydao/fields/forest.glb') return Promise.resolve({ scene: fieldScene() });
      return Promise.reject(new Error('404'));
    }
  }
  const loader = Assets.createAssetLoader({ importer: async () => { imports++; return { GLTFLoader: FakeGLTFLoader }; } });
  const api = { loadModel: loader.loadModel, instantiate: Assets.instantiate };
  const { env, view } = await openBoard('chess', { assets: api }), st = Chess.create({});
  view.setState({ board: st.board }); env.flush(); await settle();
  assert.equal(imports, 0, 'không có skin thì không nạp GLTFLoader');
  const skins = { a: { field: 'forest', pieces: 'jade' }, b: { field: 'volcano', pieces: 'magma' } };
  view.setState({ board: st.board, skins }); env.flush(); await settle(); env.flush();
  assert.equal(imports, 1);
  assert.deepEqual([...urls].sort(), ['/models/kydao/fields/forest.glb', '/models/kydao/fields/volcano.glb', '/models/kydao/pieces/jade.glb', '/models/kydao/pieces/magma.glb']);
  const bodies = meshes(renderedScene).filter(o => o.geometry.type === 'BoxGeometry' && o.geometry.parameters.height === 1.2);
  assert.equal(bodies.length, 16, '16 quân trắng dùng mô hình Ngọc Bích');
  assert.ok(bodies.every(o => hex(o) === Skins.PIECES.jade.a.base && o.geometry !== shared.geometry));
  assert.ok(meshes(renderedScene).some(o => o.geometry.type === 'TorusGeometry' && hex(o) === Skins.PIECES.jade.a.accent), 'vật liệu tên "accent" lấy màu accent');
  const lathes = meshes(renderedScene).filter(o => o.geometry.type === 'LatheGeometry' && hex(o) === Skins.PIECES.magma.b.base);
  assert.ok(lathes.length >= 16, 'Dung Nham 404 nên quân đen vẫn vẽ bằng mã');
  // Đáy mô hình đặt ở Y = 0 dù trong file đặt lệch.
  const king = pieceAt(0.5, 3.5);
  const kb = new THREE.Box3().setFromObject(king);
  assert.ok(Math.abs(kb.min.y - 0.015) < 1e-6 && Math.abs((kb.min.x + kb.max.x) / 2 - 0.5) < 1e-6);
  const tree = halfNode('a').getObjectByName('Tree');
  assert.ok(tree, 'nửa sân Đại Ngàn gắn mô hình');
  assert.ok(tree.getWorldPosition(new THREE.Vector3()).z > 0, 'bên a quay mô hình 180° về phía mình');
  assert.ok(meshes(halfNode('b')).some(o => o.geometry.type === 'ConeGeometry'), 'Hỏa Diệm Sơn 404 vẫn có đồ trang trí dựng bằng mã');
  let templateDisposed = 0;
  for (const r of [shared.geometry, shared.body, shared.accent]) r.addEventListener('dispose', () => templateDisposed++);
  view.dispose();
  assert.equal(templateDisposed, 0, 'mẫu trong bộ nhớ đệm không bị giải phóng theo bàn');
  const second = await openBoard('chess', { assets: api });
  second.view.setState({ board: st.board, skins }); second.env.flush(); await settle();
  assert.equal(urls.length, 4, 'bàn thứ hai dùng lại bộ nhớ đệm, không tải lại (kể cả file thiếu)');
  second.view.dispose();
  const off = await (await modulePromise).createBoard3D({ canvas: fakeSurface().canvas, game: 'chess', skins: Skins, assets: api, models: false });
  off.setState({ board: st.board, skins: { a: { pieces: 'wood' } } }); await settle();
  assert.equal(urls.length, 4, 'models:false thì không bao giờ nạp');
  off.dispose();
});

test('board-assets: nạp lười, nhớ đệm cả kết quả thiếu, lỗi trả null, instantiate tách tài nguyên', async () => {
  const THREE = await import(threeURL), A = await import(assetsURL);
  let imports = 0, loads = 0;
  const loader = A.createAssetLoader({
    importer: async url => {
      imports++; assert.equal(url, '/vendor/three-addons/loaders/GLTFLoader.js');
      return { GLTFLoader: class { loadAsync(u) { loads++; return u === '/x.glb' ? Promise.resolve({ scene: new THREE.Group() }) : Promise.reject(new Error('404')); } } };
    }
  });
  assert.equal(imports, 0);
  const [a, b, c] = await Promise.all([loader.loadModel('/x.glb'), loader.loadModel('/x.glb'), loader.loadModel('/thieu.glb')]);
  assert.ok(a && a.isObject3D); assert.equal(a, b); assert.equal(c, null);
  assert.equal(imports, 1); assert.equal(loads, 2);
  assert.equal(await loader.loadModel('/thieu.glb'), null); assert.equal(loads, 2);
  assert.equal(await loader.loadModel('https://example.com/x.glb'), null);
  assert.equal(await loader.loadModel(null), null);
  assert.equal(await A.createAssetLoader({ importer: async () => { throw new Error('mạng'); } }).loadModel('/x.glb'), null);
  assert.equal(await A.createAssetLoader({ importer: async () => ({}) }).loadModel('/x.glb'), null);
  const tex = new THREE.Texture(), mat = new THREE.MeshStandardMaterial({ map: tex }), geo = new THREE.BoxGeometry();
  const root = new THREE.Group(); root.add(new THREE.Mesh(geo, mat), new THREE.Mesh(geo, mat));
  const inst = A.instantiate(root), [m1, m2] = inst.root.children;
  assert.notEqual(m1.geometry, geo); assert.equal(m1.geometry, m2.geometry);
  assert.notEqual(m1.material, mat); assert.equal(m1.material, m2.material); assert.notEqual(m1.material.map, tex);
  assert.equal(inst.resources.size, 3);
  let disposed = 0; for (const r of [geo, mat, tex]) r.addEventListener('dispose', () => disposed++);
  A.disposeAll(inst.resources); assert.equal(disposed, 0); assert.equal(inst.resources.size, 0);
  const bare = A.instantiate(root, { materials: false });
  assert.equal(bare.root.children[0].material, mat); assert.equal(bare.resources.size, 1);
});

test('Kỳ Đài: đổi skin 20 lần không tăng bộ nhớ GPU; dispose trả hết', async () => {
  const { FX } = await modulePromise, fields = Object.keys(Skins.FIELDS), sets = Object.keys(Skins.PIECES);
  const combo = i => ({ a: { field: fields[i % 8], pieces: sets[i % 8] }, b: { field: fields[(i + 3) % 8], pieces: sets[(i + 5) % 8] } });
  for (const game of ['chess', 'xiangqi', 'jieqi']) {
    const { env, view } = await openBoard(game);
    const st = game === 'chess' ? Chess.create({}) : Xiangqi.view(Xiangqi.create({ variant: game, seed: 5 }));
    let T = performance.now() + 5000;
    const show = (i, fx) => {
      view.setState({ game, ...st, skins: combo(i) });
      if (fx) { view.playFx('domain', { side: 'a' }); view.playFx('promote', { at: game === 'chess' ? 'e2' : 'e3' }); }
      env.flushAt(T += 10); env.flushAt(T += 1e4);
    };
    view.setState({ game, ...st }); env.flushAt(T);
    const plain = view.stats();
    show(0, true);
    const first = view.stats();
    assert.ok(first.geometries > plain.geometries && first.textures > plain.textures);
    for (let i = 1; i <= 20; i++) show(i, i % 3 === 0);
    show(0, true);
    assert.deepEqual(view.stats(), first, game + ': bộ nhớ giữ nguyên sau 20 lần đổi');
    view.setState({ game, ...st }); env.flush();
    assert.deepEqual([view.stats().pieceSkins, view.stats().halves, view.stats().effects], [0, 0, 0]);
    view.dispose();
    const after = view.stats();
    assert.deepEqual([after.geometries, after.textures], [0, 0], game + ': dispose giải phóng mọi hình và texture');
    assert.equal(FX.domain > 0, true);
  }
});

test('Trang thử: có import map cho GLTFLoader, nạp danh mục skin, nước mẫu cờ úp hợp lệ', () => {
  const html = fs.readFileSync(path.join(__dirname, '../public/world3d-board.html'), 'utf8');
  assert.match(html, /<script type="importmap">\{ "imports": \{ "three": "\/vendor\/three\/three\.module\.js\?v=0\.187\.0" \} \}<\/script>/);
  assert.match(html, /<script src="\/js\/kydao-skins\.js\?v=\d+"><\/script>/);
  const m = html.match(/addBoard\('jieqi',[^\n]*window\.KyXiangqi, (\[[^\]]+\]), [^\n]*\{ variant: 'jieqi', seed: (\d+) \}/);
  assert.ok(m, 'có bàn cờ úp');
  let state = Xiangqi.create({ variant: 'jieqi', seed: Number(m[2]) });
  for (const move of JSON.parse(m[1].replace(/'/g, '"'))) { const r = Xiangqi.play(state, move); assert.equal(r.ok, true, move); state = r.state; }
  const chess = html.match(/addBoard\('chess',[^\n]*window\.KyChess, (\[[^\]]+\])/);
  assert.ok(JSON.parse(chess[1].replace(/'/g, '"')).some(move => move.length === 5), 'chuỗi cờ vua có nước phong cấp để thử chấn động');
});

/* ---- T-122 · Dòng sông giữa bàn cờ tướng ---- */

const riverParts = () => { const out = []; renderedScene.traverse(o => { if (o.name && o.name.startsWith('kd-river')) out.push(o); }); return out; };

test('sông cờ tướng: có ở xiangqi và jieqi, không có ở cờ vua', async () => {
  const { riverOffset, riverFrameGap } = await modulePromise;
  for (const [game, expected] of [['xiangqi', true], ['jieqi', true], ['chess', false]]) {
    const { env, view } = await openBoard(game);
    const st = game === 'chess' ? Chess.create({}) : Xiangqi.view(Xiangqi.create({ variant: game, seed: 5 }));
    view.setState({ game, ...st }); env.flush();
    const parts = riverParts(), water = parts.find(o => o.name === 'kd-river-water');
    assert.equal(!!water, expected, game);
    if (expected) {
      assert.equal(parts.filter(o => o.name === 'kd-river-bank').length, 2);
      assert.ok(parts.some(o => o.name === 'kd-river-label'));
      assert.equal('#' + water.material.color.getHexString(), '#2f8aa3');
      assert.equal(water.material.transparent, true); assert.equal(water.material.opacity, 0.92);
      assert.equal(water.material.roughness, 0.15); assert.ok(Math.abs(water.position.y - 0.004) < 1e-9);
      assert.equal(water.material.map.wrapS, 1000); // RepeatWrapping
      assert.equal(water.geometry.parameters.height, 1); // đúng khoảng giữa hàng 4 và hàng 5
    }
    view.dispose();
  }
  assert.equal(riverOffset(0), 0); assert.ok(riverOffset(1000) < 0 && riverOffset(1000) > -1);
  assert.ok(riverOffset(1e9) <= 0 && riverOffset(1e9) > -1); assert.equal(riverOffset(NaN), 0);
  assert.notEqual(riverOffset(1000), riverOffset(2000));
  assert.ok(riverFrameGap('low') > riverFrameGap('medium') && riverFrameGap('high') === riverFrameGap('medium'));
});

test('sông cờ tướng: chảy liên tục khi canvas hiện, dừng khi ẩn, tháo khỏi trang hoặc dispose', async () => {
  const { env, view } = await openBoard('xiangqi');
  const st = Xiangqi.view(Xiangqi.create({ variant: 'xiangqi', seed: 5 }));
  env.canvas.isConnected = true; global.document.visibilityState = 'visible';
  view.setState({ game: 'xiangqi', ...st }); env.flushAt(1000);
  const water = riverParts().find(o => o.name === 'kd-river-water'), at = () => water.material.map.offset.x;
  const first = at();
  assert.equal(env.queue.size, 1, 'còn khung kế tiếp để sông tiếp tục chảy');
  env.flushAt(1010); assert.equal(at(), first, 'chưa tới nhịp 33ms thì chưa đổi offset');
  env.flushAt(1100); assert.notEqual(at(), first);
  global.document.visibilityState = 'hidden'; env.flushAt(1200);
  assert.equal(env.queue.size, 0, 'tab ẩn thì dừng vòng lặp');
  global.document.visibilityState = 'visible'; view.setFlip(false); env.flushAt(1300);
  assert.equal(env.queue.size, 1);
  env.canvas.isConnected = false; env.flushAt(1400); env.flushAt(1500);
  assert.equal(env.queue.size, 0, 'canvas rời khỏi trang thì dừng');
  env.canvas.isConnected = true; view.setFlip(true); env.flushAt(1600);
  assert.equal(env.queue.size, 1);
  view.dispose(); assert.equal(env.queue.size, 0);
  delete global.document.visibilityState;
});

test('giảm chuyển động thì sông không đổi offset', async () => {
  const { env, view } = await openBoard('jieqi');
  const st = Xiangqi.view(Xiangqi.create({ variant: 'jieqi', seed: 5 }));
  env.canvas.isConnected = true; env.media.matches = true;
  view.setState({ game: 'jieqi', ...st }); env.flushAt(5000);
  const water = riverParts().find(o => o.name === 'kd-river-water');
  assert.equal(water.material.map.offset.x, 0);
  view.setFlip(true); env.flushAt(9000); view.setFlip(false); env.flushAt(20000);
  assert.equal(water.material.map.offset.x, 0);
  assert.equal(env.queue.size, 0, 'không giữ vòng lặp khi giảm chuyển động');
  view.dispose();
});

test('ta-fx tắt thì bàn 3D không rung khi phong cấp', async () => {
  const { env, view } = await openBoard('chess');
  global.window.localStorage = { getItem: k => (k === 'ta-fx' ? '0' : null) };
  try {
    const base = { e1: 'K', e8: 'k', b8: 'n', h1: 'R', c6: 'p' };
    view.setState({ board: chessBoard({ ...base, a8: 'Q' }), last: ['a7', 'a8'] });
    assert.equal(await view.playFx('promote', { at: 'a8' }), true);
    env.flush();
    assert.equal(env.queue.size, 0);
    const knight = pieceAt(-2.5, -3.5);
    if (knight) assert.equal(knight.position.y, 0.015);
  } finally {
    delete global.window.localStorage;
    view.dispose();
  }
});

/* ---- T-125 · Bàn 3D dùng ảnh sân v2 làm mặt sân, có dải cảnh quanh bàn ---- */

const fakeImage = () => ({ width: 1408, height: 704 });
// Bộ nạp giả: ảnh có sẵn cho mã trong `have` (hoặc mọi mã nếu true), còn lại 404 (null).
function imageAssets(have) {
  const asked = [];
  return { asked, loadModel: async () => null, instantiate: () => { throw new Error('không có mô hình'); },
    loadImage: async url => { asked.push(url); return have === true || (have && have.some(id => url.includes('/' + id + '-'))) ? fakeImage() : null; } };
}
const imagePlane = side => renderedScene.getObjectByName('kd-field-image-' + side);
const worldBox = (THREE, o) => { renderedScene.updateMatrixWorld(true); return new THREE.Box3().setFromObject(o); };

test('Kỳ Đài 3D: fieldPlane tính đúng kích thước, vị trí và hướng mặt phẳng ảnh v2', async () => {
  const { fieldPlane, FIELD_MARGIN } = await modulePromise;
  assert.equal(FIELD_MARGIN, 1.5);
  const chessA = fieldPlane('chess', 'a'), chessB = fieldPlane('chess', 'b');
  assert.deepEqual([chessA.w, chessA.d, chessA.x, chessA.z, chessA.rotY], [11, 5.5, 0, 2.75, 0]);
  assert.deepEqual([chessB.w, chessB.d, chessB.z, chessB.rotY], [11, 5.5, -2.75, Math.PI]);
  assert.equal(chessA.near, 0); assert.equal(chessA.far, 5.5);
  for (const game of ['xiangqi', 'jieqi']) {
    const a = fieldPlane(game, 'a'), b = fieldPlane(game, 'b');
    assert.equal(a.z, 3.25); assert.equal(b.z, -3.25); // đường giữa ảnh ở hàng sát sông (z = ±0,5)
    assert.equal(a.near, 0.5); assert.equal(a.far, 6); assert.equal(b.far, -6);
    assert.equal(a.far - 1.5, 4.5, 'mép bàn của ảnh = hàng cuối (z = 4,5)');
  }
  assert.equal(fieldPlane('go', 'a'), null); assert.equal(fieldPlane('chess', 'c'), null);
});

test('Kỳ Đài 3D: cờ vua có ảnh v2 thì nửa sân dùng mặt phẳng ảnh, ẩn lớp phủ palette và đồ trang trí; 404 thì như cũ', async () => {
  const THREE = await import(threeURL), st = Chess.create({});
  const assets = imageAssets(['volcano']);
  const { env, view } = await openBoard('chess', { assets });
  view.setState({ board: st.board }); env.flush();
  view.setState({ board: st.board, skins: { a: { field: 'volcano' }, b: { field: 'river' } } }); await settle(); env.flush();
  const planeA = imagePlane('a');
  assert.ok(planeA, 'nửa a có mặt phẳng ảnh'); assert.equal(imagePlane('b'), undefined, 'nửa b 404 nên không có');
  assert.ok(assets.asked.every(url => url.startsWith('/img/kydao/fields2/') && url.endsWith('-chess.webp')));
  assert.equal(view.stats().fieldImages, 1);
  const box = worldBox(THREE, planeA);
  assert.ok(Math.abs(box.min.x + 5.5) < 1e-6 && Math.abs(box.max.x - 5.5) < 1e-6 && Math.abs(box.min.z) < 1e-6 && Math.abs(box.max.z - 5.5) < 1e-6);
  assert.ok(box.max.y > 0.004 && box.max.y < 0.022, 'cao hơn mặt bàn, thấp hơn dấu nước đi');
  assert.equal(planeA.receiveShadow, true); assert.equal(planeA.material.map.colorSpace, THREE.SRGBColorSpace);
  assert.ok(planeA.material.roughness >= 0.8);
  // Nửa a: lớp phủ palette, thành palette và đồ trang trí đều bị ẩn. Nửa b (không có ảnh) vẫn như cũ.
  const a = halfNode('a'), b = halfNode('b');
  assert.deepEqual(a.children.slice(0, 3).map(c => c.visible), [false, false, false]);
  assert.deepEqual(b.children.slice(0, 3).map(c => c.visible), [true, true, true]);
  assert.ok(renderedScene.getObjectByName('kd-field-labels'), 'chữ toạ độ vẫn có (lớp riêng phía trên ảnh)');
  view.dispose();
});

test('Kỳ Đài 3D: ảnh v2 cờ vua hai nửa; nửa b xoay 180° và nằm ở z âm; không có lưới', async () => {
  const THREE = await import(threeURL), st = Chess.create({});
  const { env, view } = await openBoard('chess', { assets: imageAssets(true) });
  view.setState({ board: st.board, skins: { a: { field: 'volcano' }, b: { field: 'glacier' } } }); await settle(); env.flush();
  const pa = imagePlane('a'), pb = imagePlane('b');
  assert.ok(pa && pb);
  const boxB = worldBox(THREE, pb);
  assert.ok(Math.abs(boxB.min.z + 5.5) < 1e-6 && Math.abs(boxB.max.z) < 1e-6);
  // Đỉnh ảnh (v = 1) nằm ở đường giữa bàn cho cả hai nửa.
  const topZ = o => { const v = new THREE.Vector3(0, 2.75, 0); o.localToWorld(v); return v.z; };
  assert.ok(Math.abs(topZ(pa)) < 1e-6 && Math.abs(topZ(pb)) < 1e-6);
  assert.equal(view.stats().fieldImages, 2);
  assert.equal(renderedScene.getObjectByName('kd-field-grid-a'), undefined);
  view.dispose();
});

test('Kỳ Đài 3D: cờ tướng/cờ úp có ảnh v2 bắt đầu từ hàng sát sông, có lưới phía trên và sông giữ nguyên', async () => {
  const THREE = await import(threeURL);
  for (const game of ['xiangqi', 'jieqi']) {
    const st = Xiangqi.view(Xiangqi.create({ variant: game, seed: 5 }));
    const assets = imageAssets(true), { env, view } = await openBoard(game, { assets });
    view.setState({ game, ...st, skins: { a: { field: 'river' }, b: { field: 'desert' } } }); await settle(); env.flush();
    assert.ok(assets.asked.length && assets.asked.every(url => url.endsWith('-xiangqi.webp')), game + ': dùng bản -xiangqi');
    for (const side of ['a', 'b']) {
      const box = worldBox(THREE, imagePlane(side)), sign = side === 'a' ? 1 : -1;
      assert.ok(Math.abs(Math.min(sign * box.min.z, sign * box.max.z) - 0.5) < 1e-6, game + side + ': mép giữa ở hàng sát sông');
      assert.ok(Math.abs(Math.max(sign * box.min.z, sign * box.max.z) - 6) < 1e-6);
      assert.ok(Math.abs(box.max.x - 5.5) < 1e-6);
      const grid = renderedScene.getObjectByName('kd-field-grid-' + side);
      assert.ok(grid, 'lưới kẻ nằm trên ảnh'); assert.ok(grid.position.y > imagePlane(side).position.y && grid.position.y < 0.022);
      assert.equal(grid.material.transparent, true); assert.equal(grid.material.depthWrite, false);
    }
    const water = riverParts().find(o => o.name === 'kd-river-water');
    assert.ok(water && water.visible, 'sông vẫn còn');
    assert.ok(Math.abs(water.position.y - 0.004) < 1e-9 && water.geometry.parameters.height === 1);
    view.dispose();
  }
});

test('Kỳ Đài 3D: ảnh sân v2 có thì không nạp .glb nửa sân; ảnh null (404) mới nạp .glb', async () => {
  const st = Chess.create({}), models = [];
  const assets = { ...imageAssets(['volcano']), loadModel: async url => { models.push(url); return null; } };
  const { env, view } = await openBoard('chess', { assets });
  view.setState({ board: st.board, skins: { a: { field: 'volcano' }, b: { field: 'river' } } }); await settle(); env.flush();
  assert.ok(imagePlane('a'), 'nửa a có ảnh v2');
  assert.ok(!models.includes('/models/kydao/fields/volcano.glb'), 'có ảnh v2 thì không gọi loadModel cho sân');
  assert.ok(models.includes('/models/kydao/fields/river.glb'), 'ảnh 404 thì mới nạp .glb của sân');
  view.dispose();
});

test('Kỳ Đài 3D: fieldImages:false, thiếu loadImage hoặc lỗi mạng thì giữ cách cũ, không lỗi', async () => {
  const { createBoard3D } = await modulePromise, st = Chess.create({});
  const assets = imageAssets(true);
  const env = fakeSurface(), off = createBoard3D({ canvas: env.canvas, game: 'chess', skins: Skins, assets, fieldImages: false });
  off.setState({ board: st.board, skins: { a: { field: 'volcano' } } }); await settle(); env.flush();
  assert.equal(assets.asked.length, 0); assert.equal(imagePlane('a'), undefined);
  assert.equal(halfNode('a').children[0].visible, true);
  off.dispose();
  const bare = await openBoard('chess'); // noModels không có loadImage
  bare.view.setState({ board: st.board, skins: { a: { field: 'volcano' } } }); await settle(); bare.env.flush();
  assert.equal(imagePlane('a'), undefined); assert.equal(halfNode('a').children[2].visible, true);
  bare.view.dispose();
  const boom = { ...imageAssets(true), loadImage: async () => { throw new Error('mạng'); } };
  const err = await openBoard('chess', { assets: boom });
  err.view.setState({ board: st.board, skins: { a: { field: 'volcano' } } }); await settle(); err.env.flush();
  assert.equal(imagePlane('a'), undefined);
  err.view.dispose();
});

test('Kỳ Đài 3D: có ảnh v2 thì quân bị ăn lùi ra ngoài dải cảnh và máy quay lùi xa hơn', async () => {
  const { env, view } = await openBoard('chess', { assets: imageAssets(true) });
  let state = Chess.create({});
  view.setState({ board: state.board }); env.flush();
  for (const move of ['e2e4', 'd7d5', 'e4d5']) { state = Chess.play(state, move).state; view.setState({ board: state.board, last: [move.slice(0, 2), move.slice(2)] }); env.flush(); }
  const taken = () => { const out = []; renderedScene.traverse(m => { if (m.type === 'Group' && m.position.y === -0.18) out.push(m); }); return out; };
  env.media.matches = true; // giảm chuyển động: quân vào chỗ ngay
  const before = taken()[0].position.x, camBefore = renderedCamera.position.length();
  assert.ok(Math.abs(before) < 5.5);
  view.setState({ board: state.board, skins: { a: { field: 'volcano' } } }); await settle(); env.flush();
  assert.ok(Math.abs(taken()[0].position.x) >= 5.5 + 0.9, 'ngoài dải cảnh (|x| > 5,5)');
  assert.ok(renderedCamera.position.length() > camBefore, 'máy quay lùi để cả dải cảnh nằm trong khung');
  view.dispose();
});

test('Kỳ Đài 3D: khai mở lộ dần ảnh v2 từ mép người chơi; giảm chuyển động hiện ngay', async () => {
  const { FX } = await modulePromise, T0 = performance.now() + 5000;
  const { env, view } = await openBoard('chess', { assets: imageAssets(true) }), st = Chess.create({});
  view.setState({ board: st.board }); env.flushAt(T0);
  view.setState({ board: st.board, skins: { a: { field: 'volcano' } } });
  const done = view.playFx('domain', { side: 'a' });
  await settle(); env.flushAt(T0 + 10);
  const pivot = () => imagePlane('a').parent;
  assert.ok(pivot().scale.z < 0.05, 'mới bắt đầu: ảnh gần như chưa lộ');
  assert.equal(imagePlane('a').material.map.repeat.y, pivot().scale.z, 'texture co cùng tỉ lệ, ảnh không bị bóp');
  env.flushAt(T0 + 10 + FX.front / 3);
  const mid = pivot().scale.z; assert.ok(mid > 0.3 && mid < 1);
  env.flushAt(T0 + 10 + FX.domain + 1);
  assert.equal(pivot().scale.z, 1); assert.equal(imagePlane('a').material.map.repeat.y, 1); assert.equal(await done, true);
  env.media.matches = true;
  view.setState({ board: st.board, skins: { a: { field: 'river' } } }); await settle();
  assert.equal(await view.playFx('domain', { side: 'a' }), true);
  assert.equal(pivot().scale.z, 1);
  view.dispose();
});

test('Kỳ Đài 3D: đổi skin 20 lần với ảnh v2 không tăng bộ nhớ GPU; dispose trả hết; ảnh dùng chung không bị giải phóng', async () => {
  const fields = ['volcano', 'river', 'forest', 'glacier', 'ocean'];
  for (const game of ['chess', 'xiangqi']) {
    const image = fakeImage(); let disposedImage = 0; image.dispose = () => disposedImage++;
    const assets = { ...imageAssets(true), loadImage: async () => image };
    const { env, view } = await openBoard(game, { assets });
    const st = game === 'chess' ? Chess.create({}) : Xiangqi.view(Xiangqi.create({ variant: 'xiangqi', seed: 5 }));
    let T = performance.now() + 5000;
    const show = async i => {
      view.setState({ game, ...st, skins: { a: { field: fields[i % 5] }, b: { field: fields[(i + 2) % 5] } } });
      await settle(); env.flushAt(T += 10); env.flushAt(T += 1e4);
    };
    view.setState({ game, ...st }); env.flushAt(T);
    await show(0);
    const first = view.stats();
    assert.equal(first.fieldImages, 2);
    for (let i = 1; i <= 20; i++) await show(i);
    await show(0);
    assert.deepEqual(view.stats(), first, game + ': bộ nhớ giữ nguyên sau 20 lần đổi');
    view.setState({ game, ...st }); env.flush();
    assert.equal(view.stats().fieldImages, 0);
    view.setState({ game, ...st, skins: { a: { field: 'volcano' } } }); await settle(); env.flush();
    view.dispose();
    const after = view.stats();
    assert.deepEqual([after.geometries, after.textures], [0, 0], game + ': dispose giải phóng mọi hình và texture');
    assert.equal(disposedImage, 0, 'ảnh giải mã nằm trong bộ đệm dùng chung nên không bị dispose');
  }
});

test('board-assets: nạp ảnh một lần, nhớ cả kết quả thiếu, lỗi trả null', async () => {
  const A = await import(assetsURL);
  let made = 0;
  const loader = A.createImageLoader({ make: async url => { made++; if (url === '/a.webp') return { width: 4, height: 2 }; if (url === '/bad.webp') return { width: 0, height: 0 }; throw new Error('404'); } });
  const [x, y] = await Promise.all([loader.loadImage('/a.webp'), loader.loadImage('/a.webp')]);
  assert.equal(x, y); assert.equal(x.width, 4);
  assert.equal(await loader.loadImage('/thieu.webp'), null); assert.equal(await loader.loadImage('/thieu.webp'), null);
  assert.equal(await loader.loadImage('/bad.webp'), null);
  assert.equal(made, 3, 'mỗi đường dẫn chỉ nạp một lần');
  assert.equal(await loader.loadImage('https://x.test/a.webp'), null); assert.equal(await loader.loadImage(null), null);
  assert.equal(typeof A.loadImage, 'function');
});

// ---- T-143 · skin đá cho cờ vây và caro ----
const stoneAssets = have => {
  const asked = [];
  return { asked, loadModel: async () => null, instantiate: () => { throw new Error('không có mô hình'); },
    loadImage: async url => { asked.push(url); return have ? { width: 256, height: 128 } : null; } };
};
const stoneState = game => (game === 'go'
  ? Go.play(Go.play(Go.create({ size: 9 }), 'C3').state, 'G7').state
  : Gomoku.play(Gomoku.play(Gomoku.create({}), 'h8').state, 'i8').state);
const stoneBodies = () => meshes(renderedScene).filter(o => o.geometry.type === 'SphereGeometry' && o.geometry.parameters.radius === 0.43 && o.position.y === 0.14);

test('Kỳ Đài 3D: đá cờ vây/caro theo bộ của từng bên; bên không skin giữ mặc định; cờ vua không bị ảnh hưởng', async () => {
  for (const game of ['go', 'gomoku']) {
    const { env, view } = await openBoard(game, { assets: stoneAssets(false) });
    const st = stoneState(game);
    view.setState({ game, ...st, skins: { a: { pieces: 'cosmos' } } }); await settle(); env.flush();
    const bodies = stoneBodies(), colors = bodies.map(hex);
    assert.equal(bodies.length, 2);
    assert.ok(colors.includes(Skins.STONES.cosmos.a.base), game + ': đá bên a theo màu Tinh Hà');
    assert.ok(colors.includes('#f7dfae'), game + ': bên b không skin giữ ngà mặc định');
    const mat = bodies.find(b => hex(b) === Skins.STONES.cosmos.a.base).material;
    assert.equal(mat.roughness, 0.25); assert.equal(mat.metalness, 0.05);
    assert.equal(mat.emissive.getHexString(), Skins.STONES.cosmos.a.glow.slice(1)); assert.equal(mat.emissiveIntensity, 0.18);
    assert.equal(view.stats().pieceSkins, 1);
    if (game === 'gomoku') assert.ok(meshes(renderedScene).some(o => hex(o) === Skins.STONES.cosmos.a.mark), 'dấu X theo màu mark');
    view.setState({ game, ...st, skins: { a: { pieces: 'cosmos' }, b: { pieces: 'forest' } } }); env.flush();
    assert.ok(stoneBodies().map(hex).includes(Skins.STONES.forest.b.base));
    view.setState({ game, ...st, skins: { a: { pieces: 'hack' }, b: { pieces: '__proto__' } } }); env.flush();
    assert.deepEqual(stoneBodies().map(hex).sort(), ['#292d29', '#f7dfae']);
    assert.equal(view.stats().pieceSkins, 0, 'bỏ skin thì giải phóng');
    view.dispose();
  }
  const { env, view } = await openBoard('chess', { assets: stoneAssets(false) }), st = Chess.create({});
  view.setState({ game: 'chess', board: st.board, skins: { a: { pieces: 'cosmos' } } }); env.flush();
  assert.equal(view.stats().pieceSkins, 0, 'cosmos không có trong PIECES của cờ vua');
  view.dispose();
});

test('Kỳ Đài 3D: đá có ảnh atlas thì phủ chỏm trên bằng ô của đúng bên; 404 thì chỉ màu', async () => {
  const THREE = await import(threeURL);
  const assets = stoneAssets(true), { env, view } = await openBoard('go', { assets });
  view.setState({ game: 'go', ...stoneState('go'), skins: { a: { pieces: 'magma' }, b: { pieces: 'ocean' } } }); await settle(); env.flush();
  assert.deepEqual([...new Set(assets.asked)].sort(), ['/img/kydao/stones/magma.webp', '/img/kydao/stones/ocean.webp']);
  const caps = meshes(renderedScene).filter(o => o.geometry.type === 'SphereGeometry' && o.geometry.parameters.thetaLength === 0.78);
  assert.equal(caps.length, 2);
  const cell = side => caps.find(c => c.material.map.offset.x >= (side === 'a' ? 0 : 0.5) && c.material.map.offset.x < (side === 'a' ? 0.5 : 1));
  assert.ok(cell('a') && cell('b') && cell('a') !== cell('b'), 'mỗi bên một ô atlas');
  for (const c of caps) { assert.equal(c.material.map.colorSpace, THREE.SRGBColorSpace); assert.ok(c.material.map.repeat.x < 0.5 && c.material.map.repeat.y < 1); assert.equal(c.castShadow, false); }
  const uv = caps[0].geometry.attributes.uv; let lo = 1, hi = 0;
  for (let i = 0; i < uv.count; i++) { lo = Math.min(lo, uv.getX(i), uv.getY(i)); hi = Math.max(hi, uv.getX(i), uv.getY(i)); }
  assert.ok(lo >= -1e-6 && hi <= 1 + 1e-6, 'UV chiếu trong [0,1]');
  view.dispose();
  const none = stoneAssets(false), second = await openBoard('go', { assets: none });
  second.view.setState({ game: 'go', ...stoneState('go'), skins: { a: { pieces: 'magma' } } }); await settle(); second.env.flush();
  assert.equal(meshes(renderedScene).filter(o => o.geometry.parameters && o.geometry.parameters.thetaLength === 0.78).length, 0);
  second.view.dispose();
});

test('Kỳ Đài 3D: đổi bộ đá 20 lần không tăng bộ nhớ GPU; dispose trả hết', async () => {
  const sets = Object.keys(Skins.STONES);
  for (const game of ['go', 'gomoku']) {
    const { env, view } = await openBoard(game, { assets: stoneAssets(true) }), st = stoneState(game);
    let T = performance.now() + 5000;
    const show = i => { view.setState({ game, ...st, skins: { a: { pieces: sets[i % 8] }, b: { pieces: sets[(i + 5) % 8] } } }); env.flushAt(T += 10); };
    view.setState({ game, ...st }); env.flushAt(T);
    show(0); await settle(); env.flushAt(T += 10);
    const first = view.stats();
    assert.equal(first.pieceSkins, 2);
    for (let i = 1; i <= 20; i++) { show(i); await settle(); env.flushAt(T += 10); }
    show(0); await settle(); env.flushAt(T += 10);
    assert.deepEqual(view.stats(), first, game + ': bộ nhớ giữ nguyên sau 20 lần đổi');
    view.dispose();
    const after = view.stats();
    assert.deepEqual([after.geometries, after.textures], [0, 0], game + ': dispose giải phóng mọi hình và texture');
  }
});
