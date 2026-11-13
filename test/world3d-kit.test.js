'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const kitPromise = import('../public/js/world3d/kit.mjs');
const threePromise = import('three');
const html = fs.readFileSync(path.join(__dirname, '../public/world3d-kit.html'), 'utf8');
const legacyNames = ['Roof', 'Column', 'Wall', 'Door', 'Floor', 'Steps', 'Lantern',
  'Cushion', 'Bookshelf', 'StoneTable', 'BodhiTree', 'IncenseBurner', 'Bell', 'WoodenFish'];
const newNames = ['BuddhaStatue', 'Altar', 'Offerings', 'IncenseBowl', 'FortuneTube',
  'BellStand', 'OilLamp', 'WeaponRack', 'Drum', 'Banner', 'Gate'];

function count(group) {
  let triangles = 0;
  group.traverse(mesh => {
    if (mesh.isMesh) triangles += (mesh.geometry.index?.count ?? mesh.geometry.attributes.position.count) / 3;
  });
  return triangles;
}

function vertices(group, materialName) {
  const result = [];
  group.traverse(mesh => {
    if (!mesh.isMesh || (materialName && mesh.material.name !== materialName)) return;
    const a = mesh.geometry.attributes.position;
    for (let i = 0; i < a.count; i++) result.push([a.getX(i), a.getY(i), a.getZ(i)]);
  });
  return result;
}

function gallery(kit) {
  // Đo đúng danh sách trang thử, tránh bỏ sót khối lớn khi tính ngân sách.
  const source = html.match(/const items = (\[[\s\S]*?\n    \]);/);
  assert.ok(source, 'Trang thử phải khai báo danh sách khối');
  return vm.runInNewContext(source[1], { Kit: kit });
}

test('Giữ đủ 14 API cũ và bổ sung 11 khối cùng mái, chánh điện có kích thước', async () => {
  const kit = await kitPromise;
  for (const name of [...legacyNames, ...newNames]) assert.equal(typeof kit['create' + name], 'function', name);
  assert.equal(typeof kit.roof, 'function');
  assert.equal(typeof kit.templeHall, 'function');
  for (const name of legacyNames) assert.equal(kit['create' + name]('medium').type, 'Group');
  kit.disposeKit();
});

test('Mọi khối có tọa độ hữu hạn, gốc mặt sàn và gộp thành một mesh mỗi vật liệu', async () => {
  const kit = await kitPromise;
  for (const quality of ['low', 'medium', 'high']) {
    for (const [name, create] of gallery(kit)) {
      const group = create(quality);
      assert.equal(group.type, 'Group', name);
      assert.deepEqual(group.position.toArray(), [0, 0, 0]);
      assert.ok(group.children.length > 0);
      const used = new Set();
      for (const mesh of group.children) {
        assert.ok(mesh.isMesh, name);
        assert.ok(!used.has(mesh.material), name + ': vật liệu bị chia mesh');
        used.add(mesh.material);
        assert.ok(Object.values(kit.materials).includes(mesh.material));
        assert.ok(mesh.geometry.attributes.position.count > 0);
        assert.equal(mesh.geometry.attributes.position.count % 3, 0);
        for (const key of ['position', 'normal']) {
          for (const value of mesh.geometry.attributes[key].array) assert.ok(Number.isFinite(value), name + ': ' + key);
        }
        assert.ok(mesh.geometry.boundingSphere.radius > 0);
      }
      const minY = vertices(group).reduce((min, p) => Math.min(min, p[1]), Infinity);
      assert.ok(minY >= -0.06, name + ': xuyên mặt sàn ' + minY);
    }
    kit.disposeKit();
  }
});

test('Mái bốn phía phủ gian 16×10 m, diềm võng và bốn đầu đao vểnh rõ', async () => {
  const kit = await kitPromise;
  const THREE = await threePromise;
  const group = kit.roof({ width:18.4, depth:12.4, tiers:1 });
  const bounds = new THREE.Box3().setFromObject(group);
  assert.ok(bounds.max.x - bounds.min.x > 18.4);
  assert.ok(bounds.max.z - bounds.min.z > 12.4);
  const points = vertices(group, 'tile');
  for (const mesh of group.children.filter(child => child.material.name === 'tile')) {
    const normals = mesh.geometry.attributes.normal;
    for (let i = 0; i < normals.count; i++) assert.ok(normals.getY(i) >= -0.001, 'Mặt ngói hướng lên trời');
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const corner = points.filter(p => p[0] * sx > 8.8 && p[2] * sz > 5.8);
    const middle = points.filter(p => Math.abs(p[0]) < 0.5 && p[2] * sz > 6.1);
    assert.ok(corner.length && middle.length, 'Đủ góc và giữa diềm');
    assert.ok(Math.max(...corner.map(p => p[1])) - Math.min(...middle.map(p => p[1])) > 1, 'Đầu đao cao hơn giữa diềm');
  }
  for (const sx of [-1, 1]) {
    assert.ok(points.some(p => p[0] * sx > 9 && Math.abs(p[2]) < 0.5), 'Có mặt mái hồi');
  }
  assert.ok(points.some(p => Math.abs(p[2]) < 0.1 && p[1] > 3.3), 'Có nóc cao trên hai mặt mái chính');
  const tiered = kit.roof({ width:18.4, depth:12.4, tiers:2 });
  const tieredBounds = new THREE.Box3().setFromObject(tiered);
  assert.ok(tieredBounds.max.y > bounds.max.y + 1);
  assert.ok(count(tiered) > count(group));
  assert.equal(tiered.userData.tiers, 2);
  kit.disposeKit();
});

test('Chánh điện ghép đủ nền, cột son, tường, cửa và mái phủ thân nhà', async () => {
  const kit = await kitPromise;
  const THREE = await threePromise;
  for (const [width, depth] of [[16, 10], [12, 8]]) {
    const group = kit.templeHall({ width, depth });
    const bounds = new THREE.Box3().setFromObject(group);
    assert.ok(bounds.min.y >= -0.001 && bounds.min.y <= 0.001);
    assert.ok(bounds.max.x - bounds.min.x > width + 2.4);
    assert.ok(bounds.max.z - bounds.min.z > depth + 2.4);
    assert.ok(bounds.max.y > 8);
    for (const name of ['stone', 'stoneLight', 'lacquer', 'wood', 'plaster', 'gold', 'tile']) {
      assert.ok(group.children.some(mesh => mesh.material.name === name), name);
    }
    const door = vertices(group, 'woodLight');
    assert.ok(door.some(p => p[2] > depth / 2 - 2 && p[1] > 2));
  }
  kit.disposeKit();
});

test('Trang thử bày đủ 26 khối dưới 60 nghìn tam giác ở mức Vừa', async t => {
  const kit = await kitPromise;
  const items = gallery(kit);
  assert.equal(items.length, 26);
  const total = items.reduce((sum, [, create]) => sum + count(create('medium')), 0);
  t.diagnostic('Mức Vừa: ' + total.toLocaleString('vi-VN') + ' tam giác khối dựng; nền thêm 2 tam giác.');
  assert.ok(total + 2 < 60000, 'Tổng trang thử: ' + (total + 2));
  assert.match(html, /\/vendor\/three\/three\.module\.js/);
  assert.doesNotMatch(html, /three\.module\.min\.js/);
  assert.match(html, /kit\.mjs\?v=2/);
  kit.disposeKit();
});

test('Ba mức đồ họa giảm tam giác cho cả bộ khối và mái lớn', async () => {
  const kit = await kitPromise;
  const totals = ['low', 'medium', 'high'].map(quality => {
    const total = gallery(kit).reduce((sum, [, create]) => sum + count(create(quality)), 0);
    kit.disposeKit(); return total;
  });
  assert.ok(totals[0] < totals[1] && totals[1] < totals[2], totals.join(' < '));
  assert.ok(count(kit.roof({ quality:'low' })) < count(kit.roof({ quality:'medium' })));
  kit.disposeKit();
});

test('Vật liệu đồng có ánh kim, đồ vật dùng chung vật liệu qua nhiều lần tạo', async () => {
  const kit = await kitPromise;
  const first = kit.createBell();
  const second = kit.createIncenseBurner();
  const bronze = first.children.find(mesh => mesh.material.name === 'bronze').material;
  assert.equal(second.children.find(mesh => mesh.material.name === 'bronze').material, bronze);
  assert.ok(bronze.metalness > 0.5 && bronze.roughness < 0.5);
  assert.equal(kit.createColumn().children.find(mesh => mesh.material.name === 'lacquer').material, kit.materials.lacquer);
  kit.disposeKit();
});

test('Giải phóng mọi geometry và vật liệu một lần, có thể khởi tạo lại sau đó', async () => {
  const kit = await kitPromise;
  const groups = gallery(kit).map(([, create]) => create('medium'));
  let expected = 0, disposed = 0;
  for (const group of groups) for (const mesh of group.children) {
    expected++; mesh.geometry.addEventListener('dispose', () => disposed++);
  }
  for (const mat of Object.values(kit.materials)) { expected++; mat.addEventListener('dispose', () => disposed++); }
  kit.disposeKit(); assert.equal(disposed, expected);
  kit.disposeKit(); assert.equal(disposed, expected);
  assert.equal(Object.keys(kit.materials).length, 0);
  assert.ok(kit.templeHall().children.length > 0);
  kit.disposeKit();
});
