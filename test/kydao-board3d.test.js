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
  assert.deepEqual({ ...view.stats(), geometries: 0, textures: 0 }, { geometries: 0, textures: 0, pieceSkins: 1, halves: 1, effects: 0 });
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
