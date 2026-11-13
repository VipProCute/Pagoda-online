'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ViewMath = require('../public/js/view-math.js');
const dependencies = Promise.all([
  import('three'), import('../public/js/world3d/kit.mjs'), import('../public/js/world3d/scenes/hall.mjs')
]);

async function setup(options = {}) {
  const [THREE, kit, { build }] = await dependencies;
  return { THREE, kit, hall: build({ THREE, kit, size: ViewMath.SCENE_SIZE.hall, ...options }) };
}
function cast(THREE, hall, from, to) {
  const origin = new THREE.Vector3(...from);
  return hall.pick(new THREE.Raycaster(origin, new THREE.Vector3(...to).sub(origin).normalize()));
}

test('Chánh điện dựng được bằng Three thật ở ba mức, miền sàn và vật thể hữu hạn', async t => {
  const totals = [];
  for (const quality of ['low', 'medium', 'high']) {
    const { hall, kit } = await setup({ quality });
    let triangles = 0, lights = 0;
    hall.group.traverse(node => {
      if (node.isPointLight) lights++;
      if (quality === 'low') assert.ok(!node.castShadow);
      if (!node.isMesh) return;
      for (const n of node.geometry.attributes.position.array) assert.ok(Number.isFinite(n));
      triangles += (node.geometry.index?.count ?? node.geometry.attributes.position.count) / 3 * (node.isInstancedMesh ? node.count : 1);
    });
    assert.equal(lights, 4);
    assert.ok(hall.bounds.minX < -8 && hall.bounds.maxX > 8);
    assert.ok(hall.bounds.minZ < -6 && hall.bounds.maxZ > 5);
    const statues = hall.group.children.filter(node => node.name === 'buddhaStatue');
    assert.equal(statues.length, 3);
    assert.deepEqual(statues.map(node => node.userData.pick.x), [0.18, 0.5, 0.82]);
    assert.equal(statues[1].position.z, (-22 / 300 - 0.5) * 10);
    const altar = hall.group.getObjectByName('altar');
    assert.equal(altar.position.z, (22 / 300 - 0.5) * 10);
    assert.equal(hall.group.getObjectByName('fortuneTube').userData.pick.kind, 'jar');
    totals.push(triangles); hall.dispose(); kit.disposeKit();
  }
  assert.ok(totals[0] < totals[1] && totals[1] < totals[2]);
  t.diagnostic('Tam giác Thấp/Vừa/Cao: ' + totals.join('/'));
});

test('Pick đúng sàn, bát hương, tượng, ống xăm và Tàng Kinh Các; tường che vật', async () => {
  const { THREE, hall, kit } = await setup();
  const floor = cast(THREE, hall, [3, 4, 2], [3, 0, 2]);
  assert.equal(floor.kind, 'floor');
  assert.ok(Math.abs(floor.x - (3 / 16 + 0.5)) < 1e-6);
  assert.ok(Math.abs(floor.z - 0.7) < 1e-6);
  assert.equal(cast(THREE, hall, [0, 1.7, -2], [0, 1.7, -4.3]).kind, 'bowl');
  assert.equal(cast(THREE, hall, [0, 3.6, -3], [0, 3.6, -5.8]).kind, 'statue');
  const jarX = 71 / 691.2 * 16;
  assert.equal(cast(THREE, hall, [jarX, 1.58, -3], [jarX, 1.58, -4.3]).kind, 'jar');
  assert.equal(cast(THREE, hall, [-9.728, 1.3, -1], [-9.728, 1.3, -5]).kind, 'lib');
  assert.equal(cast(THREE, hall, [0, 3.6, -9], [0, 3.6, -5.8]), null);
  hall.dispose(); assert.equal(cast(THREE, hall, [0, 4, 2], [0, 0, 2]), null); kit.disposeKit();
});

test('Vỏ kín bốn phía và trần ở tầm mắt, kể cả sau tượng và ngoài tủ trái', async () => {
  const { THREE, hall, kit } = await setup();
  hall.group.updateMatrixWorld(true);
  for (const origin of [[0, 1.55, 0], [-9.4, 1.55, -3], [0, 1.55, -6.4]]) {
    for (const direction of [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [0, 1, 0], [0, -1, 0]]) {
      const ray = new THREE.Raycaster(new THREE.Vector3(...origin), new THREE.Vector3(...direction));
      assert.ok(ray.intersectObject(hall.group, true).some(hit => hit.object.isMesh), 'Vỏ phải kín: ' + origin + '/' + direction);
    }
  }
  hall.dispose(); kit.disposeKit();
});

test('Ảnh chụp nhang lọc theo giờ máy chủ, cháy ngắn dần, chặn tối đa 45 và không sửa đầu vào', async () => {
  const { hall, kit } = await setup({ quality: 'high' });
  const stick = Object.freeze({ id: 1, x: 0, tilt: 0, litAt: 1000, until: 11000 });
  const incense = Object.freeze([stick, Object.freeze({ ...stick, litAt: 20000, until: 30000 }), Object.freeze({ ...stick, until: 1000 })]);
  const state = Object.freeze({ now: 1000, incense, altar: Object.freeze({ lotus: 9, lamp: 3, rose: 5, fruit: 4 }) });
  hall.update(state, 0.02);
  const stems = hall.group.getObjectByName('incense-stems');
  const ember = hall.group.getObjectByName('incense-embers');
  const smoke = hall.group.getObjectByName('incense-smoke');
  assert.equal(stems.count, 1); assert.equal(smoke.geometry.drawRange.count, 8);
  const initialHeight = ember.instanceMatrix.array[13];
  hall.update({ ...state, now: 9000 }, 0.02);
  assert.ok(ember.instanceMatrix.array[13] < initialHeight);
  const count = hall.group.children.length;
  hall.update({ ...state, incense: Array(80).fill(stick) }, 10000);
  assert.equal(stems.count, 45); assert.equal(smoke.geometry.drawRange.count, 360);
  assert.equal(hall.group.children.length, count);
  hall.update({ ...state, now: 11000 }, 0.02);
  assert.equal(stems.count, 0); assert.equal(smoke.geometry.drawRange.count, 0);
  hall.update({ incense: [{ litAt: NaN, until: Infinity }] }, NaN);
  assert.equal(stems.count, 0);
  hall.dispose(); kit.disposeKit();
});

test('Lễ vật hiện theo số lượng, mặc định hai bình sen và không tạo thêm nguồn sáng', async () => {
  const { hall, kit } = await setup();
  const visible = name => hall.group.children.filter(node => node.name === name && node.visible).length;
  const lamps = hall.group.children.filter(node => node.name === 'oilLamp').slice(2);
  assert.equal(lamps.filter(node => node.visible).length, 0);
  assert.equal(visible('offering-lotus'), 4);
  hall.update({ altar: { lamp: 3, lotus: 100, rose: 8, fruit: 5 } }, 0);
  assert.equal(lamps.filter(node => node.visible).length, 3);
  assert.equal(visible('offering-lotus'), 14);
  assert.equal(visible('offering-rose'), 8);
  assert.equal(visible('offering-fruit'), 5);
  assert.ok(lamps[0].position.x < 0 && lamps[1].position.x === 0 && lamps[2].position.x > 0);
  hall.update({ altar: { lamp: 1 } }, 0);
  assert.equal(lamps[0].position.x, 0);
  hall.update({ altar: { lamp: 1e9, lotus: Infinity, rose: -9 } }, 0);
  assert.equal(lamps.filter(node => node.visible).length, 12);
  hall.update(); assert.equal(lamps.filter(node => node.visible).length, 0);
  hall.dispose(); kit.disposeKit();
});

test('Khói chỉ có ở mức Cao khi không giảm chuyển động', async () => {
  for (const options of [{ quality: 'low' }, { quality: 'medium' }, { quality: 'high', reduceMotion: true }]) {
    const { hall, kit } = await setup(options);
    assert.equal(hall.group.getObjectByName('incense-smoke'), undefined);
    hall.dispose(); kit.disposeKit();
  }
});

test('Dispose một lần mỗi tài nguyên cảnh, không hủy vật liệu kit hoặc cảnh khác', async () => {
  const { hall, kit } = await setup({ quality: 'high' });
  const other = await setup();
  const geometries = new Set(), ownMaterials = new Set(), shared = new Set(Object.values(kit.materials));
  hall.group.traverse(node => {
    if (node.geometry) geometries.add(node.geometry);
    if (node.material && !shared.has(node.material)) ownMaterials.add(node.material);
  });
  let disposed = 0, sharedDisposed = 0;
  for (const value of [...geometries, ...ownMaterials]) value.addEventListener('dispose', () => disposed++);
  const listener = () => sharedDisposed++;
  shared.forEach(value => value.addEventListener('dispose', listener));
  hall.dispose(); hall.dispose(); hall.update({}, 1);
  assert.equal(disposed, geometries.size + ownMaterials.size);
  assert.equal(sharedDisposed, 0); assert.equal(hall.group.children.length, 0);
  assert.ok(other.hall.group.getObjectByName('buddhaStatue'));
  shared.forEach(value => value.removeEventListener('dispose', listener));
  other.hall.dispose(); kit.disposeKit();
});

test('Trang thử dùng module đúng đường dẫn, toán camera/di chuyển và mã inline hợp cú pháp', () => {
  const html = fs.readFileSync(path.join(__dirname, '../public/world3d-scene-hall.html'), 'utf8');
  assert.match(html, /\/vendor\/three\/three\.module\.js/);
  assert.doesNotMatch(html, /three\.module\.min|addons\//);
  for (const symbol of ['moveTarget', 'createView', 'cameraPose', 'createAvatar', 'hall.pick']) assert.ok(html.includes(symbol));
  const inline = html.match(/<script type="module">([\s\S]*?)<\/script>/)[1];
  new vm.Script(inline.replace(/^\s*import .+;$/gm, ''));
  assert.doesNotMatch(html, /innerHTML/);
});
