'use strict';

// Tài nguyên đều là giả: không đọc atlas, ảnh bàn hoặc GLB do T-208 đang sinh.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const Skins = require('../public/js/kydao-skins.js');
const Chess = require('../public/js/kydao/chess.js');
const Xiangqi = require('../public/js/kydao/xiangqi.js');

function recorder(canvas = {}) {
  const log = [];
  const ctx = new Proxy({ canvas }, {
    get(target, key) {
      if (key in target) return target[key];
      if (key === 'createLinearGradient' || key === 'createRadialGradient') {
        return (...args) => { log.push([key, ...args]); return { addColorStop: (...stops) => log.push(['stop', ...stops]) }; };
      }
      return (...args) => log.push([key, ...args]);
    },
    set(target, key, value) { target[key] = value; log.push(['=' + String(key), value]); return true; }
  });
  return { ctx, log };
}
function options(game, extra = {}) {
  return { game, w: 400, h: game === 'chess' ? 400 : 444, dpr: 1, catalog: Skins,
    board: game === 'chess' ? Chess.create().board : Xiangqi.create({ variant: game, seed: 1 }).board, ...extra };
}
function withImages(fn) {
  const oldImage = global.Image, made = [];
  const filename = require.resolve('../public/js/kydao-draw.js');
  delete require.cache[filename];
  const draw = require(filename);
  global.Image = class { constructor() { made.push(this); } };
  const run = o => { const r = recorder(); draw.draw(r.ctx, o); return r.log; };
  try { fn({ draw, made, run }); } finally {
    if (oldImage === undefined) delete global.Image; else global.Image = oldImage;
  }
}
const atlasCalls = log => log.filter(c => c[0] === 'drawImage' && c.length === 10);
const boardCalls = log => log.filter(c => c[0] === 'drawImage' && c.length === 6 && c[1].src);
const loadAll = made => made.forEach(img => img.onload());
// So chuỗi lệnh vẽ qua JSON: gradient giả là object mới mỗi lần vẽ nên deepEqual chặt luôn báo khác.
const sameLog = (a, b, message) => assert.equal(JSON.stringify(a), JSON.stringify(b), message);

test('Mặc định: danh mục trả đúng đường dẫn, không thêm skin classic', () => {
  assert.equal(Skins.defaultPiecesAtlas(), '/img/kydao/pieces2d/classic.webp');
  assert.equal(Skins.defaultPiecesModel(), '/models/kydao/pieces/classic.glb');
  assert.equal(Skins.defaultBoardImage('chess'), '/img/kydao/boards/chess.webp');
  for (const game of ['xiangqi', 'jieqi']) assert.equal(Skins.defaultBoardImage(game), '/img/kydao/boards/xiangqi.webp');
  assert.equal(Skins.defaultBoardImage('go'), null);
  assert.equal(Skins.defaultBoardImage('gomoku'), null);
  assert.equal(Skins.normalize({ pieces: 'classic' }).pieces, null);
  assert.equal(Object.keys(Skins.PIECES).length, 8);
});

test('2D: thiếu cờ hoặc tắt cờ giữ nguyên chuỗi vẽ và không yêu cầu ảnh', () => withImages(({ run, made }) => {
  for (const game of ['chess', 'xiangqi', 'jieqi']) {
    const o = options(game);
    const before = run(o);
    sameLog(run({ ...o, defaultAssets: false }), before);
    assert.equal(atlasCalls(before).length, 0);
    assert.ok(before.some(c => c[0] === 'bezierCurveTo'));
  }
  for (const game of ['go', 'gomoku']) run({ game, size: 9, w: 400, h: 400, board: [], catalog: Skins, defaultAssets: true });
  assert.equal(made.length, 0);
}));

test('2D cờ vua: chờ tải và 404 giống đường cũ; ảnh sẵn thì phủ bàn và đủ 32 quân', () => {
  for (const success of [false, true]) withImages(({ run, made, draw }) => {
    const base = options('chess'), before = run(base);
    let again = 0;
    const o = { ...base, defaultAssets: true, onAsset: () => again++ };
    sameLog(run(o), before, 'chờ ảnh vẫn vẽ như cũ');
    assert.deepEqual(made.map(i => i.src).sort(), [Skins.defaultBoardImage('chess'), Skins.defaultPiecesAtlas()].sort());
    made.forEach(i => success ? i.onload() : i.onerror());
    if (!success) { sameLog(run(o), before); assert.equal(again, 0); return; }
    assert.equal(again, 2);
    for (const flip of [false, true]) {
      const log = run({ ...o, flip, margin: 0.5 });
      assert.equal(atlasCalls(log).length, 32);
      assert.ok(atlasCalls(log).every(c => c[1].src === Skins.defaultPiecesAtlas()));
      const [face] = boardCalls(log);
      assert.equal(boardCalls(log).length, 1);
      const g = draw.layout('chess', o.w, o.h, undefined, 0.5);
      assert.deepEqual(face.slice(2), [g.ox, g.oy, 8 * g.cell, 8 * g.cell]);
      let fillStyle;
      assert.equal(log.filter(c => {
        if (c[0] === '=fillStyle') fillStyle = c[1];
        return c[0] === 'fillRect' && fillStyle === '#b58863';
      }).length, 0, 'không tô ô sẫm bằng mã');
      assert.equal(log.filter(c => c[0] === 'bezierCurveTo').length, 0, 'ảnh thay vân gỗ');
    }
  });
});

test('2D cờ tướng/úp: atlas disc giữ mực và chữ mặc định; ảnh phủ đúng mặt gỗ', () => withImages(({ run, made, draw }) => {
  const o = options('xiangqi', { defaultAssets: true });
  run(o); loadAll(made);
  const log = run(o), calls = atlasCalls(log), g = draw.layout(o.game, o.w, o.h), m = g.cell * 0.6;
  assert.equal(calls.length, 32);
  assert.ok(calls.every(c => c[2] === 768));
  assert.deepEqual(boardCalls(log)[0].slice(2), [g.ox - m, g.oy - m, g.cell * 8 + 2 * m, g.cell * 9 + 2 * m]);
  for (const color of ['#9e2420', '#211d18', '#fff0c8']) assert.ok(log.some(c => c[0] === '=fillStyle' && c[1] === color));
  const board = Array(90).fill(''); board[0] = board[8] = 'X'; board[81] = board[89] = 'x';
  const hidden = run(options('jieqi', { defaultAssets: true, board })), discs = atlasCalls(hidden);
  assert.equal(discs.length, 4);
  const signature = c => {
    const i = hidden.indexOf(c), end = hidden.findIndex((v, j) => j > i && v[0] === 'restore');
    return [c.slice(1, 6), c.slice(8), hidden.slice(i + 1, end).map(v => v[0] === 'fillText' ? v.slice(0, 2) : v)];
  };
  for (const row of [0, 128]) {
    const pair = discs.filter(c => c[3] === row);
    assert.equal(pair.length, 2); assert.deepEqual(signature(pair[0]), signature(pair[1]));
  }
  assert.equal(hidden.filter(c => c[0] === 'fillText' && c[1] === '?').length, 8);
}));

test('2D cờ tướng/úp: ảnh lỗi hoàn toàn giống lệnh vẽ cũ', () => {
  for (const game of ['xiangqi', 'jieqi']) withImages(({ run, made }) => {
    const base = options(game), before = run(base), o = { ...base, defaultAssets: true };
    sameLog(run(o), before); made.forEach(i => i.onerror());
    sameLog(run(o), before);
  });
});

test('2D: bên có skin dùng atlas riêng, bên kia dùng atlas mặc định cả khi chấn động', () => withImages(({ run, made }) => {
  const o = options('chess', { defaultAssets: true, skins: { a: { pieces: 'jade' } } });
  run(o); loadAll(made);
  const log = run({ ...o, jolt: () => ({ dx: 3, dy: -2 }) }), calls = atlasCalls(log);
  assert.equal(calls.filter(c => c[1].src === Skins.piecesAtlas('jade') && c[3] === 0).length, 16);
  assert.equal(calls.filter(c => c[1].src === Skins.defaultPiecesAtlas() && c[3] === 128).length, 16);
}));

test('2D: nền đệm dựng lại đúng một lần khi ảnh bàn mặc định tải xong', () => withImages(({ draw, made }) => {
  const oldDocument = global.document, canvases = [];
  global.document = { createElement: () => {
    const c = {}, rec = recorder(c); c.getContext = () => rec.ctx; c.log = rec.log; canvases.push(c); return c;
  } };
  try {
    const o = options('xiangqi', { board: [], time: 10, defaultAssets: true });
    draw.draw(recorder().ctx, o); assert.equal(canvases.length, 1);
    draw.draw(recorder().ctx, { ...o, time: 20 }); assert.equal(canvases.length, 1);
    made.find(i => i.src === Skins.defaultBoardImage('xiangqi')).onload();
    draw.draw(recorder().ctx, { ...o, time: 30 }); assert.equal(canvases.length, 2);
    assert.equal(boardCalls(canvases[1].log).length, 1);
    draw.draw(recorder().ctx, { ...o, time: 40 }); assert.equal(canvases.length, 2);
  } finally { if (oldDocument === undefined) delete global.document; else global.document = oldDocument; }
}));

test('2D: atlas tải xong thay ngay quân vector đã đệm bitmap', () => withImages(({ draw, made }) => {
  const doc = { createElement: () => {
    const canvas = {}, rec = recorder(canvas); canvas.getContext = () => rec.ctx; return canvas;
  } };
  const rec = recorder({ ownerDocument: doc }); rec.ctx.getTransform = () => ({ a: 1 });
  const o = options('chess', { defaultAssets: true });
  draw.draw(rec.ctx, o);
  assert.equal(rec.log.filter(c => c[0] === 'drawImage' && c.length === 6).length, 32);
  loadAll(made); rec.log.length = 0;
  draw.draw(rec.ctx, o);
  assert.equal(atlasCalls(rec.log).length, 32);
  assert.equal(boardCalls(rec.log).length, 1);
}));

// Hình học Three thật, thay GPU và DOM; bộ nạp bên dưới chỉ tạo tài nguyên trong RAM.
const threeURL = pathToFileURL(path.join(path.dirname(require.resolve('three')), 'three.module.js')).href;
let renderedScene;
global.__DefaultBoardRenderer = class {
  constructor() {
    this.shadowMap = {}; this.capabilities = { getMaxAnisotropy: () => 4 };
    this.info = { memory: { geometries: 0, textures: 0 } }; this.live = { geometries: new Set(), textures: new Set() };
  }
  track(kind, resource) {
    const set = this.live[kind]; if (set.has(resource)) return;
    set.add(resource);
    const gone = () => { resource.removeEventListener('dispose', gone); set.delete(resource); this.info.memory[kind] = set.size; };
    resource.addEventListener('dispose', gone);
  }
  setPixelRatio() {}
  setSize() {}
  render(scene) {
    renderedScene = scene;
    scene.traverse(o => {
      if (o.geometry) this.track('geometries', o.geometry);
      for (const m of [].concat(o.material || [])) for (const v of Object.values(m)) if (v && v.isTexture) this.track('textures', v);
    });
    for (const kind of ['geometries', 'textures']) this.info.memory[kind] = this.live[kind].size;
  }
  dispose() {}
  forceContextLoss() {}
};
const source = fs.readFileSync(path.join(__dirname, '../public/js/world3d/board3d.mjs'), 'utf8')
  .replace(/import \* as THREE from '[^']+';/, `import * as Real from '${threeURL}'; const THREE = { ...Real, WebGLRenderer: globalThis.__DefaultBoardRenderer };`);
const modulePromise = import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
const settle = async () => { for (let i = 0; i < 12; i++) await new Promise(resolve => setImmediate(resolve)); };
function surface() {
  const queue = new Map(), canvases = []; let serial = 0;
  global.document = { createElement: () => { const c = {}, r = recorder(c); c.getContext = () => r.ctx; c.log = r.log; canvases.push(c); return c; } };
  global.window = { devicePixelRatio: 1, matchMedia: () => ({ matches: true, addEventListener() {}, removeEventListener() {} }) };
  global.ResizeObserver = class { observe() {} disconnect() {} };
  global.requestAnimationFrame = fn => { queue.set(++serial, fn); return serial; };
  global.cancelAnimationFrame = id => queue.delete(id);
  const canvas = { style: {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 640, height: 640 }),
    addEventListener() {}, removeEventListener() {}, hasPointerCapture: () => false };
  const flush = () => { const callbacks = [...queue.values()]; queue.clear(); callbacks.forEach(fn => fn(performance.now() + 10000)); };
  return { canvas, canvases, flush };
}
async function assetsFixture(haveModel = true) {
  const T = await import(threeURL), asked = [], image = { width: 1024, height: 1024 };
  const root = new T.Group();
  for (const name of ['K', 'Q', 'R', 'B', 'N', 'P', 'disc']) {
    const node = new T.Group(); node.name = name;
    const body = new T.Mesh(new T.BoxGeometry(0.8, name === 'disc' ? 0.18 : 1.5, 0.8), new T.MeshStandardMaterial({ name: 'body' }));
    body.name = 'classic-' + name; body.position.y = name === 'disc' ? 0.09 : 0.75;
    node.add(body); root.add(node);
  }
  const api = {
    loadImage: async url => { asked.push(url); return image; },
    loadModel: async url => { asked.push(url); return haveModel ? root : null; },
    instantiate(node) {
      const clone = node.clone(true), resources = new Set();
      clone.traverse(o => { if (o.isMesh) { o.geometry = o.geometry.clone(); resources.add(o.geometry); } });
      return { root: clone, resources };
    }
  };
  const dispose = () => root.traverse(o => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
  return { api, asked, image, dispose };
}
const meshes = () => { const out = []; renderedScene.traverse(o => { if (o.isMesh) out.push(o); }); return out; };
const boardFace = () => meshes().find(o => o.geometry.type === 'PlaneGeometry' && o.material.map && o.geometry.parameters.width > 8 && o.geometry.parameters.width < 20);
async function open3D(game, fixture, extra = {}) {
  const { createBoard3D } = await modulePromise, env = surface();
  const view = createBoard3D({ canvas: env.canvas, game, skins: Skins, assets: fixture.api, defaultAssets: true, ...extra });
  const state = game === 'chess' ? Chess.create() : Xiangqi.view(Xiangqi.create({ variant: game, seed: 1 }), 'a');
  view.setState({ ...state, vi: true }); env.flush();
  return { env, view, state };
}

test('3D: nạp mặc định một lần, giữ texture mặt bàn và vật liệu chuẩn, dispose trả hết', async () => {
  for (const game of ['chess', 'xiangqi', 'jieqi']) {
    const fixture = await assetsFixture(), { env, view, state } = await open3D(game, fixture);
    try {
      const map = boardFace().material.map, before = view.stats().textures, version = map.version;
      await settle(); env.flush();
      assert.ok(fixture.asked.includes(Skins.defaultPiecesModel()));
      assert.ok(fixture.asked.includes(Skins.defaultBoardImage(game)));
      assert.equal(view.stats().defaultModel, 1); assert.equal(view.stats().pieceSkins, 0);
      assert.equal(boardFace().material.map, map); assert.ok(map.version > version);
      const painted = map.image.log.filter(c => c[0] === 'drawImage');
      assert.equal(painted.length, 1); assert.equal(painted[0][1], fixture.image);
      if (game === 'chess') {
        assert.deepEqual(painted[0].slice(2), [-4, -4, 8, 8]);
        assert.equal(view.stats().textures, before, 'không tạo texture mới khi ảnh về');
      }
      const bodies = meshes().filter(o => o.name.startsWith('classic-'));
      assert.equal(bodies.length, 32);
      const colors = new Set(bodies.map(o => '#' + o.material.color.getHexString()));
      assert.deepEqual([...colors].sort(), game === 'chess' ? ['#292d29', '#f7dfae'] : ['#ddae69']);
      if (game !== 'chess') {
        const faces = meshes().filter(o => o.userData.role === 'face');
        assert.equal(faces.length, 32);
        assert.ok(faces.every(o => Math.abs(o.position.y - 0.184) < 1e-6));
      }
      view.setState({ ...state, vi: false }); await settle(); env.flush();
      assert.equal(fixture.asked.filter(u => u === Skins.defaultPiecesModel()).length, 1);
    } finally {
      view.dispose(); fixture.dispose();
      assert.deepEqual([view.stats().geometries, view.stats().textures], [0, 0]);
    }
  }
});

test('3D: tắt cờ không nạp gì; models:false hoặc mô hình thiếu giữ hình dựng bằng mã', async () => {
  for (const extra of [{ defaultAssets: false }, { models: false }, {}]) {
    const fixture = await assetsFixture(false), { env, view } = await open3D('chess', fixture, extra);
    try {
      await settle(); env.flush();
      assert.ok(meshes().some(o => o.geometry.type === 'LatheGeometry'));
      assert.equal(meshes().filter(o => o.name.startsWith('classic-')).length, 0);
      if (extra.defaultAssets === false) assert.deepEqual(fixture.asked, []);
      else assert.equal(view.stats().defaultModel, 0);
      if (extra.models === false) assert.equal(fixture.asked.filter(u => u.endsWith('.glb')).length, 0);
    } finally {
      view.dispose(); fixture.dispose();
      assert.deepEqual([view.stats().geometries, view.stats().textures], [0, 0]);
    }
  }
});

test('3D: một bên có skin quân, bên kia vẫn dùng mô hình và vật liệu mặc định', async () => {
  const fixture = await assetsFixture(), { env, view, state } = await open3D('chess', fixture);
  try {
    await settle(); env.flush();
    view.setState({ ...state, skins: { a: { pieces: 'jade' } } }); await settle(); env.flush();
    const bodies = meshes().filter(o => o.name.startsWith('classic-'));
    assert.equal(bodies.filter(o => '#' + o.material.color.getHexString() === Skins.PIECES.jade.a.base).length, 16);
    assert.equal(bodies.filter(o => '#' + o.material.color.getHexString() === '#292d29').length, 16);
    assert.equal(view.stats().pieceSkins, 1); assert.equal(view.stats().defaultModel, 1);
  } finally {
    view.dispose(); fixture.dispose();
    assert.deepEqual([view.stats().geometries, view.stats().textures], [0, 0]);
  }
});

test('3D: fieldImages:false bỏ ảnh bàn; ảnh trả muộn không vẽ lên texture cũ hay bàn đã huỷ', async () => {
  const fixture = await assetsFixture(); let resolveImage;
  fixture.api.loadImage = url => { fixture.asked.push(url); return new Promise(resolve => { resolveImage = resolve; }); };
  const { env, view, state } = await open3D('chess', fixture);
  const map = boardFace().material.map, version = map.version;
  const first = resolveImage;
  view.setState({ ...state, vi: false }); env.flush();
  first(fixture.image); await settle(); env.flush();
  assert.equal(map.version, version, 'thế hệ cũ bị bỏ qua');
  const current = boardFace().material.map, currentVersion = current.version;
  view.dispose(); resolveImage(fixture.image); await settle();
  assert.equal(current.version, currentVersion, 'không vẽ lại sau dispose');
  assert.deepEqual([view.stats().geometries, view.stats().textures], [0, 0]); fixture.dispose();
  const off = await assetsFixture(), second = await open3D('chess', off, { fieldImages: false });
  await settle(); second.env.flush();
  assert.ok(off.asked.includes(Skins.defaultPiecesModel()));
  assert.equal(off.asked.filter(u => u.endsWith('.webp')).length, 0);
  second.view.dispose(); off.dispose();
  assert.deepEqual([second.view.stats().geometries, second.view.stats().textures], [0, 0]);
});


test('3D: cờ vây và caro không nạp bộ mặc định dù bật cờ', async () => {
  const { createBoard3D } = await modulePromise;
  for (const game of ['go', 'gomoku']) {
    const fixture = await assetsFixture(), env = surface(), size = game === 'go' ? 9 : 15;
    const view = createBoard3D({ canvas: env.canvas, game, skins: Skins, assets: fixture.api, defaultAssets: true });
    try {
      view.setState({ size, board: Array(size * size).fill('') }); await settle(); env.flush();
      assert.deepEqual(fixture.asked, []); assert.equal(view.stats().defaultModel, 0);
    } finally {
      view.dispose(); fixture.dispose();
      assert.deepEqual([view.stats().geometries, view.stats().textures], [0, 0]);
    }
  }
});
