'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ViewMath = require('../public/js/view-math.js');
const seats = [[0.22, 0.44], [0.41, 0.44], [0.59, 0.44], [0.78, 0.44], [0.22, 0.72], [0.41, 0.72], [0.59, 0.72], [0.78, 0.72]];
const dependencies = Promise.all([import('three'), import('../public/js/world3d/kit.mjs'), import('../public/js/world3d/scenes/library.mjs')]);
async function setup(options = {}) {
  const [THREE, kit, { build }] = await dependencies;
  const library = build({ THREE, kit, size: ViewMath.SCENE_SIZE.library, ...options });
  library.update({ seats });
  return { THREE, kit, library };
}
function cast(THREE, library, from, direction) {
  return library.pick(new THREE.Raycaster(new THREE.Vector3(...from), new THREE.Vector3(...direction).normalize()));
}
function inlineScript() {
  const html = fs.readFileSync(path.join(__dirname, '../public/world3d-scene-library.html'), 'utf8');
  return html.match(/<script type="module">([\s\S]*?)<\/script>/)[1].replace(/^\s*import .+;$/gm, '');
}

test('Tám bồ đoàn chọn đúng chỉ số, khớp LIB_SEATS của bản 2D', async () => {
  const { THREE, kit, library } = await setup();
  const source = fs.readFileSync(path.join(__dirname, '../public/js/hall.js'), 'utf8');
  assert.deepEqual(JSON.parse(source.match(/const LIB_SEATS = (\[[^;]+);/)[1]), seats);
  seats.forEach(([x, z], index) => {
    assert.deepEqual(cast(THREE, library, [(x - 0.5) * 16, 1.4, (z - 0.5) * 10], [0, -1, 0]), { kind: 'seat', index });
  });
  const floor = cast(THREE, library, [0, 3, 4.2], [0, -1, 0]);
  assert.equal(floor.kind, 'floor'); assert.equal(floor.x, 0.5); assert.ok(Math.abs(floor.z - 0.92) < 1e-6);
  library.dispose(); kit.disposeKit();
});

test('Kệ cao ba vách quay mặt vào phòng; trái đọc kinh, phải học võ, tường che pick', async () => {
  const { THREE, kit, library } = await setup();
  const shelves = library.group.children.filter(node => node.name === 'bookshelf');
  assert.equal(shelves.length, 14);
  assert.equal(shelves.filter(node => node.rotation.y === 0).length, 4);
  for (const [x, direction, kind] of [[-4.2, [0, 0, -1], 'read'], [4.2, [0, 0, -1], 'dojo']]) {
    assert.deepEqual(cast(THREE, library, [x, 1.5, -3], direction), { kind: 'shelf', shelf: kind });
  }
  for (const [direction, kind] of [[[-1, 0, 0], 'read'], [[1, 0, 0], 'dojo']]) {
    assert.deepEqual(cast(THREE, library, [0, 1.5, 0.55], direction), { kind: 'shelf', shelf: kind });
  }
  assert.equal(cast(THREE, library, [-4.2, 1.5, -8], [0, 0, 1]), null);
  library.dispose(); kit.disposeKit();
});

test('Cập nhật tọa độ mới, ẩn ghế thiếu hoặc sai, không tạo ghế vượt chỉ số 7', async () => {
  const { THREE, kit, library } = await setup();
  const state = Object.freeze({ seats: Object.freeze([Object.freeze({ x: 0.5, z: 0.5 }), { x: NaN, z: 0.4 }, { x: 2, z: 0.5 }]) });
  library.update(state, 0.1);
  assert.deepEqual(cast(THREE, library, [0, 1, 0], [0, -1, 0]), { kind: 'seat', index: 0 });
  const cushions = library.group.children.filter(node => node.name === 'cushion');
  assert.equal(cushions.filter(node => node.visible).length, 1);
  assert.equal(library.group.children.filter(node => node.name === 'reading-desk' && node.visible).length, 1);
  library.update({ seats: Array(30).fill([0.5, 0.5]) });
  assert.equal(cushions.length, 8);
  library.update(); assert.ok(cushions.every(node => !node.visible));
  assert.equal(cast(THREE, library, [0, 1, 0], [0, -1, 0]).kind, 'floor');
  library.dispose(); kit.disposeKit();
});

test('Phòng kín sáu hướng ở tầm mắt, có trần xà, bàn kinh và cửa về phía z lớn', async () => {
  const { THREE, kit, library } = await setup(); library.group.updateMatrixWorld(true);
  for (const origin of [[0, 1.55, 0], [0, 1.55, 4.3], [-6.5, 1.55, 3.3]]) {
    for (const direction of [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [0, 1, 0], [0, -1, 0]]) {
      const ray = new THREE.Raycaster(new THREE.Vector3(...origin), new THREE.Vector3(...direction));
      assert.ok(ray.intersectObject(library.group, true).length > 0, 'Vỏ phải kín: ' + origin + '/' + direction);
    }
  }
  assert.ok(library.group.getObjectByName('ceiling-beam'));
  assert.ok(library.group.getObjectByName('window-lattice'));
  assert.ok(library.group.getObjectByName('exit-door').position.z > 5);
  assert.equal(library.group.children.filter(node => node.name === 'reading-desk').length, 8);
  library.dispose(); kit.disposeKit();
});

test('Ngày có vệt nắng, đêm giữ đèn ấm; giảm chuyển động giữ cảnh đứng yên', async () => {
  const { kit, library } = await setup({ reduceMotion: true });
  const stripes = library.group.getObjectByName('sun-stripes');
  const light = library.group.children.find(node => node.isDirectionalLight);
  assert.equal(stripes.visible, true); const intensity = light.intensity;
  library.update({ seats, daylight: false }, 1);
  assert.equal(stripes.visible, false); assert.ok(light.intensity < intensity);
  const lamps = library.group.children.filter(node => node.isPointLight);
  const values = lamps.map(node => node.intensity);
  const count = library.group.children.length;
  library.update({ seats, daylight: false }, 1000);
  assert.deepEqual(lamps.map(node => node.intensity), values); assert.equal(library.group.children.length, count);
  library.dispose(); kit.disposeKit();
});

test('Ba mức chất lượng có hình hữu hạn; chỉ mức Cao bật bóng đổ', async t => {
  const totals = [];
  for (const quality of ['low', 'medium', 'high']) {
    const { kit, library } = await setup({ quality }); let triangles = 0;
    library.group.traverse(node => {
      if (quality !== 'high') assert.ok(!node.castShadow);
      if (!node.isMesh) return;
      for (const n of node.geometry.attributes.position.array) assert.ok(Number.isFinite(n));
      triangles += (node.geometry.index?.count ?? node.geometry.attributes.position.count) / 3 * (node.isInstancedMesh ? node.count : 1);
    });
    totals.push(triangles); library.dispose(); kit.disposeKit();
  }
  assert.ok(totals[0] < totals[1] && totals[1] < totals[2]);
  t.diagnostic('Tam giác Thấp/Vừa/Cao: ' + totals.join('/'));
});

test('Pick sàn dùng tọa độ cục bộ kể cả khi đặt cả cảnh lệch gốc', async () => {
  const { THREE, kit, library } = await setup(); library.group.position.set(10, 0, 20);
  const floor = cast(THREE, library, [10, 3, 24.2], [0, -1, 0]);
  assert.equal(floor.kind, 'floor'); assert.ok(Math.abs(floor.x - 0.5) < 1e-6); assert.ok(Math.abs(floor.z - 0.92) < 1e-6);
  library.dispose(); kit.disposeKit();
});

test('Giải phóng đúng một lần tài nguyên riêng, không hủy vật liệu kit hay cảnh khác', async () => {
  const { THREE, kit, library } = await setup(); const other = await setup();
  const resources = new Set(), shared = new Set(Object.values(kit.materials));
  library.group.traverse(node => {
    if (node.geometry) resources.add(node.geometry);
    if (node.isInstancedMesh) resources.add(node);
    if (node.material && !shared.has(node.material)) resources.add(node.material);
  });
  let disposed = 0, sharedDisposed = 0;
  resources.forEach(value => value.addEventListener('dispose', () => disposed++));
  const listener = () => sharedDisposed++; shared.forEach(value => value.addEventListener('dispose', listener));
  library.dispose(); library.dispose(); library.update({ seats });
  assert.equal(disposed, resources.size); assert.equal(sharedDisposed, 0); assert.equal(library.group.children.length, 0);
  assert.equal(cast(THREE, library, [0, 3, 0], [0, -1, 0]), null);
  assert.ok(other.library.group.getObjectByName('exit-door'));
  shared.forEach(value => value.removeEventListener('dispose', listener)); other.library.dispose(); kit.disposeKit();
});

test('Avatar có người ngồi dùng đúng tư thế bồ đoàn, nhìn về trang kinh', async () => {
  const { createAvatar } = await import('../public/js/world3d/avatar.mjs');
  const avatar = createAvatar();
  for (const sit of [0, 7]) {
    avatar.update({ sit, yaw: Math.PI, reducedMotion: true }, 0);
    assert.equal(avatar.group.getObjectByName('hips').position.y, 0.36);
    assert.equal(avatar.group.getObjectByName('left-leg').rotation.x, -Math.PI / 2);
    assert.equal(avatar.group.getObjectByName('body').rotation.y, Math.PI);
  }
  avatar.dispose();
});

// Chạy trang thật với Three thật, chỉ thay renderer và DOM vì Node không có WebGL.
async function preview() {
  const [THREE, Kit, { build }] = await dependencies;
  const { createAvatar } = await import('../public/js/world3d/avatar.mjs');
  function element(extra = {}) {
    return { events: {}, addEventListener(type, fn) { this.events[type] = fn; }, removeEventListener() {}, ...extra };
  }
  const elements = {
    stage: element({ clientWidth: 1280, clientHeight: 720, prepend() {} }), pick: element({ textContent: '' }),
    quality: element({ value: 'medium' }), view: element(), reset: element()
  };
  const canvas = element({ setPointerCapture() {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 1280, height: 720 }) });
  let frame, rendered;
  const events = {};
  class Renderer {
    constructor() { this.domElement = canvas; this.shadowMap = {}; }
    setPixelRatio(value) { this.pixelRatio = value; }
    setSize() {}
    render(scene, camera) { rendered = { scene, camera }; }
    dispose() {}
  }
  const context = {
    THREE: { ...THREE, WebGLRenderer: Renderer }, Kit, build, createAvatar, ViewMath,
    document: { getElementById: id => elements[id], createElement: () => ({ getContext: () => ({ createLinearGradient: () => ({ addColorStop() {} }), fillRect() {} }) }) },
    matchMedia: () => element({ matches: false }), URLSearchParams, location: { search: '' }, devicePixelRatio: 1,
    ResizeObserver: class { observe() {} disconnect() {} }, requestAnimationFrame: fn => { frame = fn; },
    addEventListener: (type, fn) => { events[type] = fn; }, removeEventListener() {}
  };
  vm.runInNewContext(inlineScript(), context);
  assert.ok(frame, elements.pick.textContent);
  return { elements, events, canvas, step(now) { frame(now); return rendered; }, cleanup() { events.pagehide(); } };
}

test('Trang thử khởi động, mặc định nhìn chếch 20 độ, V đổi góc, WASD đi và đổi đồ họa', async t => {
  const page = await preview();
  t.after(() => page.cleanup());
  const [THREE] = await dependencies;
  let rendered = page.step(16);
  const direction = rendered.camera.getWorldDirection(new THREE.Vector3());
  assert.ok(Math.abs(Math.asin(-direction.y) - 0.34) < 0.015);
  assert.ok(rendered.camera.position.y < 3.1 && rendered.camera.position.z < 7.1);
  const hero = rendered.scene.children.find(node => node.name === 'avatar'); const startZ = hero.position.z;
  const key = key => ({ key, target: { closest: () => false }, preventDefault() {} });
  page.events.keydown(key('w')); page.step(66); page.events.keyup(key('w')); assert.ok(hero.position.z < startZ);
  page.events.keydown(key('v')); rendered = page.step(100);
  assert.equal(hero.getObjectByName('body').visible, false); assert.ok(rendered.camera.position.y < 1.7);
  page.elements.quality.value = 'high'; page.elements.quality.events.change(); page.step(150);
  assert.doesNotMatch(page.elements.pick.textContent, /Chưa dựng/);
  page.elements.reset.events.click(); page.step(200); assert.ok(Math.abs(hero.position.z - 3.4) < 1e-6);
});

test('Trang thử chạm bồ đoàn trống ngồi đọc, in pick, rồi đứng lên và chạm sàn để đi', async t => {
  const page = await preview(); t.after(() => page.cleanup());
  const [THREE] = await dependencies; let { scene, camera } = page.step(16);
  function tap(x, y, z) {
    const point = new THREE.Vector3(x, y, z).project(camera);
    const event = { pointerId: 1, pointerType: 'touch', clientX: (point.x + 1) * 640, clientY: (1 - point.y) * 360 };
    page.canvas.events.pointerdown(event); page.canvas.events.pointerup({ ...event, type: 'pointerup' });
  }
  tap((seats[1][0] - 0.5) * 16, 0.255, (seats[1][1] - 0.5) * 10);
  assert.deepEqual(JSON.parse(page.elements.pick.textContent), { kind: 'seat', index: 1 });
  ({ camera } = page.step(66));
  const hero = scene.children.find(node => node.name === 'avatar');
  assert.equal(hero.getObjectByName('hips').position.y, 0.36);
  assert.equal(hero.getObjectByName('head').rotation.x, 0.28);
  page.elements.reset.events.click(); ({ camera } = page.step(116));
  tap(1.2, 0.004, 4.2);
  assert.equal(JSON.parse(page.elements.pick.textContent).kind, 'floor');
  const start = hero.position.clone(); page.step(166); assert.ok(hero.position.distanceTo(start) > 0);
  assert.equal(hero.getObjectByName('hips').position.y > 0.6, true);
});
