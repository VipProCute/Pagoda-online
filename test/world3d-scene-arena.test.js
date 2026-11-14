'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ViewMath = require('../public/js/view-math.js');
const dependencies = Promise.all([
  import('three'), import('../public/js/world3d/kit.mjs'), import('../public/js/world3d/scenes/arena.mjs?v=11')
]);

async function fixture(options = {}) {
  const [THREE, kit, module] = await dependencies;
  const ctx = { THREE, kit, size: ViewMath.SCENE_SIZE.arena, quality: 'medium', reduceMotion: false, ...options };
  return { THREE, kit, ctx, scene: module.build(ctx) };
}
function down(THREE, x, z, y = 8) {
  const p = ViewMath.toWorld('arena', x, z);
  return new THREE.Raycaster(new THREE.Vector3(p.x, y, p.z), new THREE.Vector3(0, -1, 0));
}
function near(actual, expected) { assert.ok(Math.abs(actual - expected) < 0.00001, `${actual} ≈ ${expected}`); }
function cleanup(scene, kit) { scene.dispose(); kit.disposeKit(); }

test('Ba mức đồ họa dựng được cảnh kín, dùng khối kit và không quá sáu đèn điểm', async () => {
  for (const quality of ['low', 'medium', 'high']) {
    const { scene, kit } = await fixture({ quality });
    try {
      let points = 0, meshes = 0;
      scene.group.traverse(object => {
        if (object.isPointLight) points++;
        if (object.isMesh) {
          meshes++;
          for (const value of object.geometry.attributes.position.array) assert.ok(Number.isFinite(value));
        }
        if (quality === 'low') assert.ok(!object.castShadow, 'Mức Thấp không có bóng đổ');
      });
      assert.ok(points > 0 && points <= 6);
      assert.ok(meshes > 50);
      for (const name of ['sky', 'floor', 'wall', 'gate', 'roof', 'weaponRack', 'drum', 'banner', 'wooden-dummy', 'stone-lamp']) {
        assert.ok(scene.group.getObjectByName(name), name);
      }
      const walls = scene.group.children.filter(object => object.name === 'wall');
      for (const side of ['left', 'right', 'back', 'front']) {
        assert.ok(walls.some(wall => side === 'left' ? wall.position.x < -9 : side === 'right' ? wall.position.x > 9 : side === 'back' ? wall.position.z < -6 : wall.position.z > 6), side);
      }
      assert.deepEqual(scene.bounds, { minX: -9.8, maxX: 9.8, minZ: -6.05, maxZ: 6.05 });
      for (const [x, z] of [[.03, .12], [.97, .97], [.5, .67]]) for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
        const view = ViewMath.createView(); view.yaw = yaw;
        const pose = ViewMath.cameraPose(view, ViewMath.toWorld('arena', x, z), scene.bounds);
        near(Math.atan2(pose.pos.y - pose.look.y, Math.hypot(pose.pos.x - pose.look.x, pose.pos.z - pose.look.z)), view.pitch);
        assert.ok(pose.pos.x >= scene.bounds.minX && pose.pos.x <= scene.bounds.maxX);
        assert.ok(pose.pos.z >= scene.bounds.minZ && pose.pos.z <= scene.bounds.maxZ);
      }
    } finally { cleanup(scene, kit); }
  }
});

test('Võ đài và đồ vật khớp tọa độ sàn của drawArenaYard và ARENA_PROPS', async () => {
  const { THREE, scene, kit } = await fixture();
  try {
    const source = fs.readFileSync(path.join(__dirname, '../public/js/hall.js'), 'utf8');
    const match = source.match(/const PLAT = \{ x0: ([\d.]+), x1: ([\d.]+), z0: ([\d.]+), z1: ([\d.]+) \}/);
    assert.ok(match, 'Đọc mốc 2D để phát hiện lệch vị trí khi hall.js đổi');
    const [x0, x1, z0, z1] = match.slice(1).map(Number);
    const bounds = new THREE.Box3().setFromObject(scene.group.getObjectByName('platform'));
    near(ViewMath.toFloor('arena', bounds.min.x, bounds.min.z).x, x0);
    near(ViewMath.toFloor('arena', bounds.max.x, bounds.max.z).x, x1);
    near(ViewMath.toFloor('arena', bounds.min.x, bounds.min.z).z, z0);
    near(ViewMath.toFloor('arena', bounds.max.x, bounds.max.z).z, z1);
    for (const [name, x, z] of [['weaponRack', 0.1, 0.06], ['drum', 0.9, 0.07], ['wooden-dummy', 0.13, 0.78], ['stone-lamp', 0.88, 0.8]]) {
      const object = scene.group.getObjectByName(name);
      const floor = ViewMath.toFloor('arena', object.position.x, object.position.z);
      near(floor.x, x); near(floor.z, z);
    }
  } finally { cleanup(scene, kit); }
});

test('Raycast thật chọn sàn, mặt võ đài và bậc theo tọa độ 0..1', async () => {
  const { THREE, scene, kit } = await fixture();
  try {
    for (const [x, z] of [[0.43, 0.87], [0.5, 0.42], [0.5, 0.66]]) {
      const hit = scene.pick(down(THREE, x, z));
      assert.equal(hit.kind, 'floor'); near(hit.x, x); near(hit.z, z);
    }
    assert.equal(scene.surfaceHeight(0.5, 0.42), 0.54);
    assert.equal(scene.surfaceHeight(0.5, 0.66), 0.36);
    assert.equal(scene.surfaceHeight(0.43, 0.87), 0);
    const edge = scene.pick(down(THREE, 0.005, 0.5, 1));
    assert.deepEqual(edge, { kind: 'floor', x: 0.03, z: 0.5 });
  } finally { cleanup(scene, kit); }
});

test('Chọn người chỉ trả id công khai; cập nhật vị trí, thay áo và rời cảnh không giữ hit cũ', async () => {
  const { THREE, scene, kit } = await fixture();
  try {
    const player = { id: 7, uid: 'khong-duoc-tra-ve', x: 0.4, z: 0.82, name: '<b>Tâm</b>', look: { g: 'nu', c: 2, h: 1 } };
    const snapshot = { me: 1, players: [player] }, original = JSON.stringify(snapshot);
    scene.update(snapshot, 0.016);
    assert.equal(JSON.stringify(snapshot), original, 'Không sửa ảnh chụp game');
    assert.deepEqual(scene.pick(down(THREE, 0.4, 0.82)), { kind: 'person', id: 7 });
    scene.update({ players: [{ ...player, x: 0.58, look: { c: 6 } }] }, 0.016);
    assert.equal(scene.pick(down(THREE, 0.4, 0.82)).kind, 'floor');
    assert.deepEqual(scene.pick(down(THREE, 0.58, 0.82)), { kind: 'person', id: 7 });
    assert.equal(scene.group.getObjectByName('avatar').userData.look.c, 6);
    scene.update({ players: [] });
    assert.equal(scene.pick(down(THREE, 0.58, 0.82)).kind, 'floor');
    assert.equal(scene.group.getObjectByName('avatar'), undefined);
  } finally { cleanup(scene, kit); }
});

test('Góc thứ nhất ẩn người mình, nâng chân trên võ đài và bỏ dữ liệu vị trí không hợp lệ', async () => {
  const { THREE, scene, kit } = await fixture();
  try {
    scene.update({ me: 'self', view: 'first', players: [
      { id: 'self', x: 0.5, z: 0.42 }, { id: 2, x: NaN, z: 0.5 }, null
    ] });
    const avatar = scene.group.getObjectByName('avatar');
    assert.equal(avatar.position.y, 0.54);
    assert.equal(avatar.getObjectByName('body').visible, false);
    assert.equal(scene.pick(down(THREE, 0.5, 0.42)).kind, 'floor');
    assert.equal(scene.group.children.filter(child => child.name === 'avatar').length, 1);
    scene.update({ me: 'self', view: 'third', players: [{ id: 'self', x: 0.5, z: 0.42 }] });
    assert.equal(avatar.getObjectByName('body').visible, true);
  } finally { cleanup(scene, kit); }
});

test('Tường và vật trang trí chặn chọn xuyên, hướng nhìn trời trả null', async () => {
  const { THREE, scene, kit } = await fixture();
  try {
    assert.equal(scene.pick(down(THREE, 0.13, 0.78)), null);
    const up = new THREE.Raycaster(new THREE.Vector3(0, 7, 0), new THREE.Vector3(0, 1, 0));
    assert.equal(scene.pick(up), null);
    scene.update({ players: [{ id: 2, x: 0.98, z: 0.75 }] });
    const behindWall = new THREE.Raycaster(new THREE.Vector3(12, 1, 3.125), new THREE.Vector3(-1, 0, 0));
    assert.equal(scene.pick(behindWall), null);
  } finally { cleanup(scene, kit); }
});

test('Giảm chuyển động giữ cờ, đèn đứng yên; đổi lại không làm nghiêng cột', async () => {
  const { scene, kit, ctx } = await fixture({ reduceMotion: true });
  try {
    const banner = scene.group.getObjectByName('banner');
    const cloth = banner.children.find(child => child.material.name === 'fabric');
    const pole = banner.children.find(child => child.material.name === 'wood');
    const base = cloth.geometry.attributes.position.array.slice(), poleBase = pole.geometry.attributes.position.array.slice();
    scene.update({}, 0.1);
    assert.deepEqual(cloth.geometry.attributes.position.array, base);
    ctx.reduceMotion = false; scene.update({}, 0.1);
    assert.notDeepEqual(cloth.geometry.attributes.position.array, base);
    assert.deepEqual(pole.geometry.attributes.position.array, poleBase);
    ctx.reduceMotion = true; scene.update({}, 0.1);
    assert.deepEqual(cloth.geometry.attributes.position.array, base);
  } finally { cleanup(scene, kit); }
});

test('dispose dọn một lần và không hủy vật liệu kit đang dùng ở cảnh khác', async () => {
  const { THREE, scene, kit, ctx } = await fixture();
  const [, , module] = await dependencies;
  const other = module.build(ctx);
  try {
    scene.update({ players: [{ id: 3, x: 0.4, z: 0.8 }] });
    const owned = scene.group.getObjectByName('platform').geometry;
    const shared = kit.materials.stone;
    let ownDisposals = 0, sharedDisposals = 0;
    owned.addEventListener('dispose', () => ownDisposals++);
    shared.addEventListener('dispose', () => sharedDisposals++);
    scene.dispose(); scene.dispose(); scene.update({ players: [{ id: 3, x: 0.4, z: 0.8 }] });
    assert.equal(ownDisposals, 1); assert.equal(sharedDisposals, 0);
    assert.equal(scene.group.children.length, 0); assert.equal(scene.pick(down(THREE, 0.5, 0.8)), null);
    assert.equal(other.pick(down(THREE, 0.5, 0.8)).kind, 'floor');
  } finally { scene.dispose(); cleanup(other, kit); }
});

test('ctx.size quyết định mét và pick hoạt động khi nhóm cảnh tịnh tiến', async () => {
  const { THREE, scene, kit } = await fixture({ size: { width: 24, depth: 15 } });
  try {
    assert.equal(scene.bounds.maxX, 11.8);
    scene.group.position.set(3, 2, -4);
    const ray = new THREE.Raycaster(new THREE.Vector3(3, 9, (0.85 - 0.5) * 15 - 4), new THREE.Vector3(0, -1, 0));
    const hit = scene.pick(ray); assert.equal(hit.kind, 'floor'); near(hit.x, 0.5); near(hit.z, 0.85);
  } finally { cleanup(scene, kit); }
});

test('Trang thử có cú pháp hợp lệ, đúng đường Three.js và điều khiển theo ViewMath', () => {
  const html = fs.readFileSync(path.join(__dirname, '../public/world3d-scene-arena.html'), 'utf8');
  const source = html.match(/<script type="module">([\s\S]*?)<\/script>/)[1];
  assert.doesNotThrow(() => new vm.Script(source.replace(/^\s*import .*;$/gm, '')));
  assert.ok(html.includes('/vendor/three/three.module.js'));
  assert.ok(!html.includes('three.module.min.js') && !html.includes('/addons/'));
  for (const name of ['createView', 'cameraPose', 'moveTarget', 'SCENE_SIZE.arena']) assert.ok(source.includes('ViewMath.' + name));
  assert.ok(source.includes('content.pick(raycaster)'));
  assert.ok(!source.includes('innerHTML'));
});

test('suất Sân đấu tách công đức khỏi hào quang và giữ người gần máy quay ở mức Thấp', async () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'StandMath');
  globalThis.StandMath = require('../public/js/stand-math.js');
  const { THREE, scene, kit, ctx } = await fixture({ quality: 'low' });
  try {
    ctx.camera = new THREE.PerspectiveCamera(); ctx.camera.position.set(-8, 17, 4);
    scene.group.position.set(1, 0.5, -2);
    const players = Array.from({ length: 6 }, (_, i) => ({
      id: i === 5 ? 'self' : 'p' + i, x: 0.1 + i * 0.12, z: 0.85, demon: { n: 4 }, aura: { t: 5 }
    }));
    const state = { me: 'self', players };
    scene.update(state, 0.016);
    const avatars = scene.group.children.filter(node => node.name === 'avatar').sort((a, b) => a.position.x - b.position.x);
    assert.equal(avatars.length, 6);
    for (let i = 0; i < avatars.length; i++) {
      const avatar = avatars[i], fx = avatar.userData.fx;
      const position = avatar.getWorldPosition(new THREE.Vector3());
      const expected = Math.hypot(position.x - ctx.camera.position.x, position.z - ctx.camera.position.z);
      assert.ok(Math.abs(fx.distance - expected) < 1e-6);
      assert.equal(fx.slots.demon, i < 2 || i === 5);
      assert.equal(fx.slots.aura, i < 2 || i === 5);
    }
    assert.equal(avatars[2].userData.fx.slots.demon, false);
    players.push({ id: 'meritOnly', x: 0.9, z: 0.85, meritRank: 2 });
    scene.update(state, 0.016);
    const meritOnly = scene.group.children.find(node => node.name === 'avatar' && node.userData.fx.slots.merit);
    assert.ok(meritOnly);
    assert.deepEqual(meritOnly.userData.fx.slots, { demon: false, aura: false, merit: true });
    assert.equal(meritOnly.userData.fx.slot, true);
    ctx.camera = null; scene.update(state, 0.016);
    for (const avatar of avatars) assert.equal(avatar.userData.fx.distance, Infinity);
    delete globalThis.StandMath; scene.update(state, 0.016);
    for (const avatar of avatars) {
      assert.equal(avatar.userData.fx.slot, true);
      assert.equal(avatar.userData.fx.slots, undefined);
    }
  } finally {
    cleanup(scene, kit);
    if (previous) Object.defineProperty(globalThis, 'StandMath', previous); else delete globalThis.StandMath;
  }
});
