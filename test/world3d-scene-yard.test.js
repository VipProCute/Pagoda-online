'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ViewMath = require('../public/js/view-math');

const dependencies = Promise.all([import('three'), import('../public/js/world3d/kit.mjs'), import('../public/js/world3d/scenes/yard.mjs?v=10')]);
const size = ViewMath.SCENE_SIZE.yard;
const hallSource = fs.readFileSync(require.resolve('../public/js/hall.js'), 'utf8');
const tables = JSON.parse(JSON.stringify(vm.runInNewContext(hallSource.match(/const YARD_TABLES = (\[[\s\S]*?\n  \]);/)[1])));
async function setup(t, options = {}) {
  const [THREE, kit, module] = await dependencies;
  const yard = module.build({ THREE, kit, size, quality: 'low', ...options });
  t.after(() => yard.dispose());
  return { THREE, kit, yard };
}
function down(THREE, x, z, height = 2.5) {
  return new THREE.Raycaster(new THREE.Vector3(x, height, z), new THREE.Vector3(0, -1, 0));
}

test('Cùng giao diện Chánh điện, bốn bàn và tám ghế khớp YARD_TABLES bản 2D', async t => {
  const { THREE, yard } = await setup(t);
  for (const key of ['update', 'pick', 'dispose']) assert.equal(typeof yard[key], 'function');
  assert.ok(yard.bounds.minX < yard.bounds.maxX);
  yard.update({ daylight: true, tables });
  for (const data of tables) {
    const node = yard.group.getObjectByName('table-' + data.id), p = ViewMath.toWorld('yard', data.x, data.z);
    assert.equal(node.position.x, p.x); assert.equal(node.position.z, p.z);
    assert.deepEqual(yard.pick(down(THREE, p.x, p.z)), { kind: 'table', id: data.id, seat: -1 });
    data.seats.forEach(([x, z], seat) => {
      const bench = yard.group.getObjectByName('table-' + data.id + '-seat-' + seat), q = ViewMath.toWorld('yard', x, z);
      assert.equal(bench.position.x, q.x); assert.equal(bench.position.z, q.z);
      assert.deepEqual(yard.pick(down(THREE, q.x, q.z)), { kind: 'table', id: data.id, seat });
    });
  }
});

test('Bàn ghế đổi vị trí, tên, dáng ngồi và áo theo ảnh chụp mới rồi được gỡ sạch', async t => {
  const { THREE, yard } = await setup(t);
  const data = { id: 1, x: .3, z: .61, seats: [[.24, .61], [.35, .63]], name: 'Bàn thử', occupants: [{ name: 'An', look: { g: 'nu', c: 4, h: 1 } }, null] };
  yard.update({ tables: [data] });
  const bench = yard.group.getObjectByName('table-1-seat-0'), avatar = bench.getObjectByName('occupant');
  assert.equal(avatar.visible, true); assert.equal(avatar.userData.look.c, 4);
  assert.equal(avatar.getObjectByName('hips').position.y, .41);
  const p = ViewMath.toWorld('yard', .24, .61);
  assert.deepEqual(yard.pick(down(THREE, p.x, p.z)), { kind: 'table', id: 1, seat: 0 });
  yard.update({ tables: [{ ...data, x: .4, z: .5, name: 'Tên mới', seats: [[.3, .5], null], occupants: [null, null] }] });
  assert.equal(avatar.visible, false); assert.equal(bench.position.x, (.3 - .5) * size.width);
  assert.equal(yard.group.getObjectByName('table-1-seat-1').visible, false);
  assert.equal(yard.group.getObjectByName('table-1').children.some(node => node.userData.text === 'Tên mới'), true);
  yard.update({}); assert.equal(yard.group.getObjectByName('table-1'), undefined);
  assert.equal(yard.group.getObjectByName('table-1-seat-0'), undefined);
});

test('Hai thầy bói theo phép chiếu drawReaders, chọn được bàn và người', async t => {
  const { THREE, yard } = await setup(t);
  for (const [screenX, id] of [[.2, 'horoscope'], [.8, 'tarot']]) {
    const node = yard.group.getObjectByName('reader-' + id);
    const z = (.63 - .5) / .5, x = .5 + (screenX - .5) / (2 * (.36 + .28 * z));
    const p = ViewMath.toWorld('yard', x, z);
    assert.ok(Math.abs(node.position.x - p.x) < 1e-10); assert.ok(Math.abs(node.position.z - p.z) < 1e-10);
    for (const offset of [-.34, .3]) assert.deepEqual(yard.pick(down(THREE, p.x, p.z + offset)), { kind: 'reader', id });
  }
});

test('Sàn trả tọa độ nội bộ và không chọn xuyên tường hoặc đồ trang trí', async t => {
  const { THREE, yard } = await setup(t);
  const ray = down(THREE, 0, 2);
  assert.deepEqual(yard.pick(ray), { kind: 'floor', x: .5, z: 2 / size.depth + .5 });
  yard.group.position.set(3, 1, -2);
  ray.set(new THREE.Vector3(3, 5, 0), new THREE.Vector3(0, -1, 0));
  assert.deepEqual(yard.pick(ray), { kind: 'floor', x: .5, z: 2 / size.depth + .5 });
  yard.group.position.set(0, 0, 0);
  ray.set(new THREE.Vector3(20, 1, 0), new THREE.Vector3(-1, 0, 0));
  yard.update({ tables }); assert.equal(yard.pick(ray), null);
  ray.set(new THREE.Vector3(0, 1, 2), new THREE.Vector3(0, 0, -1));
  assert.equal(yard.pick(ray), null, 'lư hương che đường chọn phía sau');
});

test('Tường và cổng khép kín bốn hướng ở tầm mắt tại nhiều điểm đi lại', async t => {
  const { THREE, yard } = await setup(t);
  yard.group.updateWorldMatrix(true, true);
  const meshes = [];
  yard.group.traverse(node => { if (node.isMesh && !node.userData.sky) meshes.push(node); });
  for (const [x, z] of [[0, 2], [-10, 6], [10, 6], [0, -5.4]]) {
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const hits = new THREE.Raycaster(new THREE.Vector3(x, 1.55, z), new THREE.Vector3(dx, 0, dz)).intersectObjects(meshes, false);
      assert.ok(hits.some(hit => !hit.object.userData.sky && hit.distance < 35), `kín tại ${x},${z} hướng ${dx},${dz}`);
    }
  }
  const temple = yard.group.getObjectByName('yard-temple');
  const bounds = new THREE.Box3().setFromObject(temple), span = bounds.getSize(new THREE.Vector3());
  assert.ok(span.x > size.width * .8); assert.ok(span.y > 6); assert.ok(bounds.max.z < -5);
  assert.ok(yard.group.getObjectByName('yard-incense'));
});

test('Trời chuyển sắc và đèn sáng hơn ban đêm, không đổi vật liệu kit dùng chung', async t => {
  const { yard, kit } = await setup(t, { quality: 'medium' });
  const sky = yard.group.getObjectByName('yard-sky'), uniforms = sky.material.uniforms;
  const pointLights = yard.group.children.filter(node => node.isPointLight);
  const sharedEmissive = kit.materials.fabric.emissive.clone();
  yard.update({ daylight: true }); const dayColor = uniforms.topColor.value.clone(), dayPower = pointLights[0].intensity;
  yard.update({ daylight: false }); const nightColor = uniforms.topColor.value.clone();
  assert.notDeepEqual(dayColor, nightColor); assert.ok(pointLights.every(light => light.intensity > dayPower));
  yard.update({ daylight: .5 });
  assert.equal(uniforms.topColor.value.equals(dayColor), false); assert.equal(uniforms.topColor.value.equals(nightColor), false);
  assert.deepEqual(kit.materials.fabric.emissive, sharedEmissive);
});

test('Mức Thấp tắt bóng, giảm chuyển động giữ đèn đứng yên và cập nhật ngày đêm ngay', async t => {
  const { yard } = await setup(t, { reduceMotion: true });
  const lanterns = [];
  yard.group.traverse(node => { if (node.name === 'lantern') lanterns.push(node); if (node.isLight) assert.equal(node.castShadow, false); });
  assert.ok(lanterns.length >= 12);
  yard.update({ daylight: false }, .1);
  assert.ok(lanterns.every(node => node.rotation.z === 0));
  assert.ok(yard.group.children.filter(node => node.isPointLight).every(light => light.intensity === 40));
});

test('Đêm trong game không có env map vẫn có ánh trăng phủ cổng, cây và bàn đá ở mọi mức', async t => {
  for (const quality of ['low', 'medium', 'high']) {
    const { yard, THREE } = await setup(t, { quality });
    const scene = new THREE.Scene(); scene.add(yard.group);
    assert.equal(scene.environment, null, 'giống lớp World3D trong game');
    yard.update({ daylight: false, tables });
    const ambient = yard.group.children.find(node => node.isHemisphereLight);
    const moon = yard.group.children.find(node => node.isDirectionalLight);
    assert.ok(ambient.intensity >= 1.1, 'ánh sáng nền phủ toàn sân');
    assert.ok(moon.intensity >= .8, 'ánh trăng chiếu rõ các khối');
    assert.ok(ambient.color.b > ambient.color.r && moon.color.b > moon.color.r, 'đêm có tông xanh trăng');
    assert.ok(ambient.groundColor.b > ambient.groundColor.r, 'mặt dưới cây và mái vẫn nhận ánh sáng');
    assert.ok(yard.group.children.filter(node => node.isPointLight).every(light => light.intensity >= 40));
    yard.update({ daylight: true });
    assert.equal(ambient.intensity, 1.9); assert.equal(moon.intensity, 2.5);
    assert.ok(ambient.color.r > ambient.color.b, 'ban ngày giữ tông ấm');
  }
});

test('Dữ liệu bàn lỗi không dựng vật lạ; dispose nhiều lần và sau dispose không chọn được', async t => {
  const { THREE, kit, yard } = await setup(t);
  yard.update({ tables: [null, { id: 5, x: .5, z: .5, seats: [] }, { id: 2, x: NaN, z: .5, seats: [] }] });
  assert.equal(yard.group.children.some(node => node.userData.pick?.kind === 'table'), false);
  let sharedDisposed = 0;
  const listener = () => sharedDisposed++;
  kit.materials.stone.addEventListener('dispose', listener);
  yard.dispose(); yard.dispose(); yard.update({ tables });
  assert.equal(sharedDisposed, 0); kit.materials.stone.removeEventListener('dispose', listener);
  assert.equal(yard.group.children.length, 0); assert.equal(yard.pick(down(THREE, 0, 2)), null);
});

test('Trang thử dùng cùng tọa độ 2D, máy quay mặc định không bị ép sát tường ở ba cỡ màn', async t => {
  const { THREE, yard } = await setup(t);
  const html = fs.readFileSync(require.resolve('../public/world3d-scene-yard.html'), 'utf8');
  const fixture = vm.runInNewContext(html.match(/const tables = (\[[\s\S]*?\n      \]);/)[1]);
  assert.deepEqual(JSON.parse(JSON.stringify(fixture.map(({ id, x, z, seats }) => ({ id, x, z, seats })))), tables);
  const script = html.match(/<script type="module">([\s\S]*?)<\/script>/)[1];
  assert.doesNotThrow(() => new vm.Script(script.replace(/^\s*import .*;$/gm, '')));
  const start = html.match(/const self = \{ x: ([\d.]+), z: ([\d.]+)/);
  const pitch = Number(html.match(/view\.pitch = ([\d.]+);/)[1]), dist = Number(html.match(/view\.dist = ([\d.]+);/)[1]);
  const view = ViewMath.createView(); Object.assign(view, { pitch, dist });
  const target = ViewMath.toWorld('yard', Number(start[1]), Number(start[2])), pose = ViewMath.cameraPose(view, target, yard.bounds);
  const measured = Math.atan2(pose.pos.y - pose.look.y, Math.hypot(pose.pos.x - pose.look.x, pose.pos.z - pose.look.z));
  assert.ok(Math.abs(measured - 20 * Math.PI / 180) < .02); assert.ok(pose.pos.z < yard.bounds.maxZ - .5);
  for (const [w, h] of [[375, 667], [768, 1024], [1440, 900]]) {
    const camera = new THREE.PerspectiveCamera(62, w / h, .06, 150);
    camera.position.set(pose.pos.x, pose.pos.y, pose.pos.z); camera.lookAt(pose.look.x, pose.look.y, pose.look.z); camera.updateMatrixWorld();
    const sign = new THREE.Vector3(0, 4.16, -7.7).project(camera);
    assert.ok(Math.abs(sign.x) < 1 && Math.abs(sign.y) < 1 && sign.z < 1, `${w}×${h}: thấy biển Chánh điện`);
  }
});
