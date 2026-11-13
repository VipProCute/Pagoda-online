'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const load = () => import('../public/js/world3d/avatar.mjs');
function canvasFactory(writes = []) {
  return () => ({ width: 0, height: 0, getContext: () => ({
    clearRect() {}, beginPath() {}, roundRect() {}, fill() {}, stroke() {}, fillRect() {},
    save() {}, restore() {}, translate() {}, scale() {}, moveTo() {}, bezierCurveTo() {}, closePath() {},
    setTransform() {}, rotate() {}, arc() {}, lineTo() {}, quadraticCurveTo() {}, setLineDash() {},
    createLinearGradient: () => ({ addColorStop() {} }), createRadialGradient: () => ({ addColorStop() {} }),
    measureText: text => ({ width: Array.from(text).length * 14 }),
    fillText(text) { writes.push(text); }
  }) });
}
function triangles(group) {
  let count = 0;
  group.traverseVisible(object => {
    if (object.isMesh) count += (object.geometry.index?.count ?? object.geometry.attributes.position.count) / 3;
    else if (object.isSprite) count += 2;
  });
  return count;
}
function matrices(group) {
  group.updateMatrixWorld(true);
  const result = [];
  group.traverse(object => result.push(...object.matrixWorld.elements));
  return result;
}

function browserImages(t) {
  const old = Object.getOwnPropertyDescriptor(globalThis, 'document'), urls = [];
  globalThis.document = { createElement: canvasFactory(), createElementNS() {
    const listeners = new Map();
    return { width: 256, height: 384,
      addEventListener(name, fn) { listeners.set(name, fn); },
      removeEventListener(name) { listeners.delete(name); },
      set src(url) { urls.push(url); queueMicrotask(() => listeners.get('load')?.call(this)); }
    };
  } };
  t.after(() => { if (old) Object.defineProperty(globalThis, 'document', old); else delete globalThis.document; });
  return urls;
}

test('nhân vật 3D giữ 12 màu áo của Hall và mọi mẫu kể cả NPC có dưới 600 tam giác', async () => {
  const { createAvatar, AVATAR_COLORS } = await load();
  const hall = fs.readFileSync(require.resolve('../public/js/hall.js'), 'utf8');
  const palette = hall.slice(hall.indexOf('const COLORS'), hall.indexOf('const HAIRS'));
  assert.deepEqual(AVATAR_COLORS, [...palette.matchAll(/c: '(#[a-f0-9]+)'/g)].map(match => match[1]));
  for (const role of [undefined, 'beggar', 'wanderer', 'obito', 'sweeper', 'fortune']) {
    for (const g of ['nam', 'nu']) for (let c = 0; c < 12; c++) for (let h = 0; h < 4; h++) {
      const avatar = createAvatar({ g, c, h }, { role, createCanvas: canvasFactory() });
      avatar.update({ aura: true, name: 'Thiện Tâm', tag: 'Duyên lành', bubble: 'Nam mô A Di Đà Phật' });
      assert.ok(triangles(avatar.group) <= 600, `${role}/${g}/${c}/${h}: ${triangles(avatar.group)}`);
      assert.deepEqual(avatar.group.userData.look, { g, c, h });
      avatar.dispose();
    }
  }
});

test('đi, vái, ngồi bồ đoàn và ghế có tư thế riêng; giảm chuyển động giữ nguyên khối', async () => {
  const { createAvatar } = await load();
  const THREE = await import('three');
  const avatar = createAvatar({ g: 'nu', c: 2, h: 1 });
  const node = name => avatar.group.getObjectByName(name);
  const standing = matrices(avatar.group);
  avatar.group.position.set(2, 0, 3);
  avatar.update({ walking: true, yaw: 1.2 }, 0.1);
  const firstStep = matrices(avatar.group);
  avatar.update({ walking: true, yaw: 1.2 }, 0.1);
  assert.notDeepEqual(matrices(avatar.group), firstStep);
  assert.deepEqual(avatar.group.position.toArray(), [2, 0, 3], 'không tự đổi vị trí game');
  assert.equal(node('body').rotation.y, 1.2);
  avatar.group.position.set(0, 0, 0);
  avatar.update({ bow: 1, walking: true, reducedMotion: true });
  assert.ok(node('torso').rotation.x > 0.7);
  assert.ok(Math.abs(node('left-leg').rotation.x) === 0, 'vái ưu tiên hơn bước đi');
  avatar.update({ sit: 0, reducedMotion: true });
  const cushion = matrices(avatar.group);
  assert.notDeepEqual(cushion, standing);
  assert.ok(node('hips').position.y < 0.5, 'chỉ số bồ đoàn 0 vẫn là ngồi');
  for (const name of ['left-leg', 'right-leg']) {
    const bounds = new THREE.Box3().setFromObject(node(name));
    assert.ok(bounds.min.y >= 0.14, 'chân xếp bằng nằm trên bồ đoàn cao 0,15 m');
  }
  avatar.update({ sit: 'bench', reducedMotion: true });
  assert.notDeepEqual(matrices(avatar.group), cushion);
  assert.equal(node('left-leg').rotation.z, 0, 'ngồi ghế thả chân, không xếp bằng');
  for (const name of ['left-leg', 'right-leg']) {
    const bounds = new THREE.Box3().setFromObject(node(name));
    assert.ok(bounds.min.y >= 0 && bounds.min.y < 0.05, 'chân sát sàn khi ngồi ghế');
  }
  for (const state of [{}, { walking: true }, { bow: 0.7 }, { sit: 'cushion' }, { sit: 'bench', talk: true }]) {
    const reduced = { ...state, reducedMotion: true, aura: true };
    avatar.update(reduced, 0.1);
    const before = matrices(avatar.group), opacity = node('aura').material.opacity;
    for (let i = 0; i < 10; i++) avatar.update(reduced, 0.1);
    assert.deepEqual(matrices(avatar.group), before);
    assert.equal(node('aura').material.opacity, opacity);
  }
  avatar.update({ sit: -1, bow: Infinity, yaw: NaN, reducedMotion: true }, NaN);
  assert.deepEqual(matrices(avatar.group), standing, 'trạng thái không hữu hạn không làm hỏng ma trận');
  avatar.dispose();
});

test('nhãn và chat chỉ vẽ chữ, giới hạn độ dài, tái dùng texture và ẩn đúng người ở góc thứ nhất', async () => {
  const { createAvatar } = await load();
  const writes = [];
  const avatar = createAvatar({}, { isSelf: true, createCanvas: canvasFactory(writes) });
  const nameplate = avatar.group.getObjectByName('nameplate'), bubble = avatar.group.getObjectByName('bubble');
  const state = { name: '<img onerror=alert(1)>', tag: 'Bình an', bubble: { text: 'Một lời lành. '.repeat(30) }, aura: true };
  avatar.update(state);
  assert.ok(writes.includes(state.name), 'chữ HTML được đưa nguyên vào fillText');
  assert.ok(writes.includes(state.tag));
  assert.equal(nameplate.isSprite, true);
  assert.equal(nameplate.material.map.isCanvasTexture, true);
  assert.equal(bubble.material.map.isCanvasTexture, true);
  assert.ok(writes.length <= 7, 'tối đa năm dòng chat, một tên và một danh hiệu');
  const version = nameplate.material.map.version, count = writes.length;
  for (let i = 0; i < 5; i++) avatar.update(state, 0.1);
  assert.equal(writes.length, count);
  assert.equal(nameplate.material.map.version, version, 'không tải texture lại mỗi khung hình');
  avatar.update({ ...state, view: 'first' });
  assert.equal(nameplate.visible, false); assert.equal(bubble.visible, false);
  assert.equal(avatar.group.getObjectByName('body').visible, false);
  avatar.update({ ...state, view: 'first', isSelf: false });
  assert.equal(nameplate.visible, true); assert.equal(bubble.visible, true);
  assert.equal(avatar.group.getObjectByName('body').visible, true);
  avatar.update({ ...state, view: 'third', name: 'Đ'.repeat(100), tag: 'T'.repeat(100) });
  assert.ok(writes.includes('Đ'.repeat(48))); assert.ok(writes.includes('T'.repeat(64)));
  avatar.update({ name: 123, bubble: {}, tag: null });
  assert.equal(nameplate.visible, false); assert.equal(bubble.visible, false);
  avatar.dispose();
});

test('Bảng tên chặn ở 28 pixel CSS, mờ gần máy quay, không vẽ tên rỗng sau khi từng có chữ', async () => {
  const { createAvatar } = await load(), THREE = await import('three');
  const avatar = createAvatar({}, { createCanvas: canvasFactory() });
  const label = avatar.group.getObjectByName('nameplate');
  const camera = new THREE.PerspectiveCamera(55, 1, .1, 100);
  avatar.update({ name: 'An Tâm', tag: 'Bình an' });
  const render = (distance, pixels) => {
    avatar.group.updateMatrixWorld(true);
    const anchor = label.getWorldPosition(new THREE.Vector3());
    camera.position.copy(anchor).add(new THREE.Vector3(0, 0, distance));
    camera.lookAt(anchor); camera.updateMatrixWorld(true);
    label.onBeforeRender({ domElement: { getBoundingClientRect: () => ({ height: pixels }) } }, null, camera);
    const scale = label.getWorldScale(new THREE.Vector3());
    // Khung có danh hiệu cao 112 px trong texture 128 px; bỏ phần trong suốt.
    return scale.y * camera.projectionMatrix.elements[5] * pixels / (2 * distance) * 112 / 128;
  };
  for (const pixels of [667, 1024, 900]) for (const distance of [1.21, 1.5, 3, 10]) {
    assert.ok(render(distance, pixels) <= 28 + 1e-10);
  }
  render(1, 900); assert.equal(label.material.opacity, 0);
  render(1.8, 900); assert.ok(label.material.opacity > 0 && label.material.opacity < 1);
  render(3, 900); assert.equal(label.material.opacity, 1);
  avatar.group.scale.setScalar(2); assert.ok(render(2, 900) <= 28 + 1e-10, 'cả khi nhóm cha có tỉ lệ khác');
  for (const name of ['', '   ', '\n\t']) {
    avatar.update({ name, tag: 'Danh hiệu còn lại' });
    assert.equal(label.visible, false);
  }
  avatar.update({ name: 'Trở lại' }); assert.equal(label.visible, true);
  avatar.dispose();
});

test('đổi ngoại hình không tạo thêm tài nguyên; dispose một lần và không ảnh hưởng nhân vật khác', async () => {
  const { createAvatar } = await load();
  const THREE = await import('three');
  const avatar = createAvatar({}, { createCanvas: canvasFactory() });
  const other = createAvatar({}, { createCanvas: canvasFactory() });
  avatar.update({ name: 'Người thử', bubble: 'Bình an' });
  other.update({ name: 'Người khác' });
  const resources = new Set();
  avatar.group.traverse(object => {
    // Sprite dùng geometry nội bộ dùng chung của Three.js, avatar không sở hữu nó.
    if (object.geometry && !object.isSprite) resources.add(object.geometry);
    if (object.material) { resources.add(object.material); if (object.material.map) resources.add(object.material.map); }
  });
  const disposals = new Map();
  resources.forEach(resource => resource.addEventListener('dispose', () => disposals.set(resource, (disposals.get(resource) || 0) + 1)));
  for (let h = 0; h < 4; h++) for (let c = 0; c < 12; c++) avatar.setLook({ g: 'nu', c, h });
  avatar.setLook({ g: 'sai', c: -100, h: null });
  assert.deepEqual(avatar.group.userData.look, { g: 'nam', c: 0, h: 0 });
  let count = 0; avatar.group.traverse(() => count++);
  assert.ok(count < 70, 'đổi look chỉ đổi màu/ẩn hiện, không chồng thêm khối');
  const parent = new THREE.Group(); parent.add(avatar.group);
  avatar.dispose(); avatar.dispose(); avatar.update({}); avatar.setLook({});
  assert.equal(avatar.group.parent, null); assert.equal(avatar.group.children.length, 0);
  resources.forEach(resource => assert.equal(disposals.get(resource), 1));
  assert.ok(other.group.children.length > 0);
  assert.equal(other.group.getObjectByName('nameplate').visible, true);
  other.dispose();
});

test('chín bậc hào quang nạp đúng ảnh 2D khi cần, vẫn hiện mức Thấp và mờ/tắt theo giờ máy chủ', async t => {
  const { createAvatar } = await load(), AURA = require('../public/js/aura');
  const urls = browserImages(t), avatar = createAvatar(); t.after(() => avatar.dispose());
  assert.equal(urls.length, 0, 'không tải hiệu ứng cho người chưa có hào quang');
  for (const tier of AURA.TIERS) {
    const state = { now: 1000, aura: { t: tier.n, until: 61000, color: tier.color }, quality: 'low' };
    avatar.update(state); await Promise.resolve(); avatar.update(state);
    assert.ok(avatar.group.getObjectByName('aura-back').visible);
    assert.ok(avatar.group.getObjectByName('aura-front').visible);
    assert.equal(!!avatar.group.getObjectByName('lotus'), tier.n >= 2);
    assert.equal(!!avatar.group.getObjectByName('aura-halo'), tier.n >= 3);
    assert.equal(!!avatar.group.getObjectByName('mandorla'), tier.n >= 6);
    assert.ok(triangles(avatar.group) <= 600, 'cả hiệu ứng vẫn giữ ngân sách tam giác');
  }
  assert.deepEqual([...new Set(urls)].sort(), ['halo-gold', 'lotus-gold', 'lotus-pink', 'lotus-rainbow', 'mandorla-gold', 'mandorla-violet'].map(name => `/img/fx/aura/${name}.webp`).sort());
  const aura = { t: 9, until: 61000, color: '#ffffff' };
  avatar.update({ aura, now: 51000, reducedMotion: true });
  assert.equal(avatar.group.getObjectByName('lotus').material.opacity, 0.5);
  assert.equal(avatar.group.getObjectByName('lightning').visible, false);
  avatar.update({ aura, now: 61000 });
  assert.equal(avatar.group.getObjectByName('aura').visible, false);
  assert.equal(avatar.group.getObjectByName('lotus'), undefined);
  assert.equal(avatar.group.getObjectByName('aura-back'), undefined);
});

test('pháp tướng và bốn quỷ chia sẻ texture, không bắt tia chọn và chỉ giải phóng khi hết người dùng', async t => {
  const { createAvatar } = await load(), THREE = await import('three');
  const urls = browserImages(t), a = createAvatar(), b = createAvatar();
  t.after(() => { a.dispose(); b.dispose(); });
  for (let meritRank = 1; meritRank <= 6; meritRank++) {
    a.update({ meritRank }); assert.ok(a.group.getObjectByName('merit-form').visible);
  }
  for (let n = 1; n <= 4; n++) {
    a.update({ demon: { n, alpha: 0.12 } }); await Promise.resolve(); a.update({ demon: { n, alpha: 0.12 } });
    assert.equal(a.group.getObjectByName('demon').material.opacity, 0.12);
    assert.ok(a.group.getObjectByName('demon').visible);
  }
  for (let n = 1; n <= 4; n++) assert.ok(urls.includes(`/img/fx/demon-${n}.webp`));
  const state = { meritRank: 6, demon: { n: 4, alpha: 1 }, aura: { t: 9, color: '#ffffff' }, name: 'An Tâm', bubble: 'Bình an' };
  a.update(state); b.update(state); await Promise.resolve(); a.update(state); b.update(state);
  for (const name of ['merit-form', 'demon', 'lotus', 'aura-back', 'aura-front', 'aura-halo', 'mandorla']) {
    assert.equal(a.group.getObjectByName(name).material.map, b.group.getObjectByName(name).material.map);
  }
  const textures = new Set(); let disposals = 0;
  a.group.getObjectByName('effects').traverse(node => {
    if (node.material?.map) textures.add(node.material.map);
  });
  textures.forEach(texture => texture.addEventListener('dispose', () => { disposals++; }));
  a.group.traverse(node => {
    if (!node.isSprite) return;
    const hits = []; node.raycast(new THREE.Raycaster(), hits);
    assert.deepEqual(hits, []); assert.equal(node.material.depthWrite, false);
  });
  a.dispose(); assert.equal(disposals, 0);
  assert.ok(b.group.getObjectByName('demon').visible);
  b.dispose(); assert.equal(disposals, textures.size);
});

test('hiệu ứng quay về máy quay, quỷ theo trễ; giảm chuyển động đứng yên và góc thứ nhất ẩn hiệu ứng của mình', async t => {
  const { createAvatar } = await load(), THREE = await import('three');
  browserImages(t);
  const avatar = createAvatar({}, { isSelf: true }); t.after(() => avatar.dispose());
  const state = { meritRank: 6, demon: { n: 4, alpha: 1 }, aura: { t: 9 }, reducedMotion: true };
  avatar.update(state); await Promise.resolve(); avatar.update(state);
  const before = matrices(avatar.group);
  for (let i = 0; i < 10; i++) avatar.update(state, 0.1);
  assert.deepEqual(matrices(avatar.group), before);
  const node = avatar.group.getObjectByName('demon'), camera = new THREE.PerspectiveCamera();
  camera.position.set(0, 2, 6); camera.updateMatrixWorld(true);
  avatar.update({ ...state, reducedMotion: false }, 0.1);
  avatar.group.position.x = 2; avatar.update({ ...state, reducedMotion: false }, 0.1);
  node.onBeforeRender(null, null, camera);
  assert.ok(node.getWorldPosition(new THREE.Vector3()).x < 1, 'quỷ còn ở gần vị trí trước bước đi');
  avatar.update(state); node.onBeforeRender(null, null, camera);
  assert.ok(Math.abs(node.getWorldPosition(new THREE.Vector3()).x - 2) < 0.2, 'giảm chuyển động bỏ trễ theo sau');
  avatar.update({ ...state, view: 'first' });
  assert.equal(avatar.group.getObjectByName('effects').visible, false);
  avatar.update({ ...state, view: 'first', isSelf: false });
  assert.equal(avatar.group.getObjectByName('effects').visible, true);
});

test('NPC nữ giữ váy ngắn, vai trần, bốn kiểu tóc; Obito có áo mây dùng chung và mặt nạ cam một mắt', async () => {
  const { createAvatar } = await load();
  const options = { createCanvas: canvasFactory() };
  const avatar = createAvatar({ g: 'nu', c: 2, h: 0, npcFashion: true }, options);
  assert.equal(avatar.group.userData.look.npcFashion, true);
  assert.ok(avatar.group.getObjectByName('neckline').visible);
  assert.equal(avatar.group.getObjectByName('upper-leg').material.color.getHexString(), 'f0c9a4');
  assert.ok(avatar.group.getObjectByName('skirt').children[0].scale.y < 0.5);
  for (let h = 0; h < 4; h++) {
    avatar.setLook({ g: 'nu', c: 2, h });
    assert.equal(avatar.group.getObjectByName('long-hair').visible, h === 0);
    assert.equal(avatar.group.getObjectByName('bun').visible, h === 1);
    assert.equal(avatar.group.getObjectByName('turban').visible, h === 3);
  }
  const obito = createAvatar({}, { ...options, role: 'obito' });
  avatar.update({ obito: true });
  const cloak = avatar.group.getObjectByName('obito-cloak');
  assert.ok(cloak.visible); assert.equal(avatar.group.getObjectByName('coat').visible, false);
  assert.ok(cloak.children[0].material.map.isCanvasTexture);
  assert.equal(cloak.children[0].material.map, obito.group.getObjectByName('obito-cloak').children[0].material.map);
  assert.equal(avatar.group.getObjectByName('obito-mask').children[0].material.color.getHexString(), 'e87924');
  avatar.update({}); assert.equal(cloak.visible, false);
  avatar.dispose(); obito.dispose();
});

test('Node không có document vẫn dựng đủ trạng thái mà không cố nạp ảnh', async () => {
  const { createAvatar } = await load();
  assert.equal(globalThis.document, undefined);
  const avatar = createAvatar({}, { role: 'obito' });
  avatar.update({ meritRank: 6, aura: { t: 9 }, demon: { n: 4, alpha: 1 } });
  assert.equal(avatar.group.getObjectByName('demon'), undefined);
  avatar.dispose();
});

test('cả bộ hiệu ứng cao nhất và trang phục cô nương vẫn không quá 600 tam giác mỗi người', async t => {
  const { createAvatar } = await load(); browserImages(t);
  for (const role of [undefined, 'beggar', 'wanderer', 'obito', 'sweeper', 'fortune']) {
    for (const g of ['nam', 'nu']) for (let h = 0; h < 4; h++) {
      const avatar = createAvatar({ g, c: 2, h, npcFashion: g === 'nu' });
      const state = { aura: { t: 9 }, meritRank: 6, demon: { n: 4, alpha: 1 }, name: 'An Tâm', bubble: 'Bình an' };
      try {
        avatar.update(state); await Promise.resolve(); avatar.update(state);
        assert.ok(triangles(avatar.group) <= 600, `${role}/${g}/${h}: ${triangles(avatar.group)}`);
      } finally { avatar.dispose(); }
    }
  }
});
