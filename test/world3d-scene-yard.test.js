'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

const dependencies = Promise.all([import('three'), import('../public/js/world3d/kit.mjs'), import('../public/js/world3d/scenes/yard.mjs')]);
const size = { width: 24, depth: 15 };
const tables = [{ id: 1, x: 0.17, z: 0.5, seats: [[0.125, 0.5], [0.215, 0.5]], occupants: ['An', null] }];

test('Dựng sân, đặt bàn ghế theo trạng thái và chọn bàn hoặc sàn', async () => {
  const [THREE, kit, yardModule] = await dependencies;
  const yard = yardModule.build({ THREE, kit, quality: 'low', size });
  yard.update({ daylight: true, tables });
  const table = yard.group.children.find(child => child.userData.pick?.type === 'table');
  assert.equal(table.position.x, (tables[0].x - 0.5) * size.width);
  const ray = new THREE.Raycaster(new THREE.Vector3(table.position.x, 8, table.position.z), new THREE.Vector3(0, -1, 0));
  assert.deepEqual(yard.pick(ray), { type: 'table', id: 1 });
  ray.set(new THREE.Vector3(0, 8, 1), new THREE.Vector3(0, -1, 0));
  const floor = yard.pick(ray);
  assert.equal(floor.type, 'floor'); assert.ok(Math.abs(floor.x - 0.5) < 0.001);
  yard.update({ daylight: false, tables: [] });
  assert.equal(yard.group.children.some(child => child.userData.pick?.type === 'table'), false);
  yard.dispose(); yard.dispose(); assert.equal(yard.group.children.length, 0);
});

test('Chọn đúng hai thầy bói và không hủy vật liệu dùng chung', async () => {
  const [THREE, kit, yardModule] = await dependencies;
  const yard = yardModule.build({ THREE, kit, quality: 'medium', size });
  for (const [x, id] of [[0.2, 'horoscope'], [0.8, 'tarot']]) {
    const ray = new THREE.Raycaster(new THREE.Vector3((x - 0.5) * size.width, 5, (0.28 - 0.5) * size.depth), new THREE.Vector3(0, -1, 0));
    assert.deepEqual(yard.pick(ray), { type: 'reader', id });
  }
  let disposed = false;
  const shared = Object.values(kit.materials)[0]; shared.addEventListener('dispose', () => { disposed = true; });
  yard.dispose(); assert.equal(disposed, false);
});
