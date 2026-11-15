'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const MODELS = path.join(__dirname, '..', 'public', 'models', 'avatar');
const load = () => import('../public/js/world3d/avatar-glb.mjs?v=9');
const settle = async () => { for (let i = 0; i < 6; i++) await new Promise(resolve => setImmediate(resolve)); };

function canvasFactory() {
  return () => ({ width: 0, height: 0, getContext: () => ({
    clearRect() {}, beginPath() {}, roundRect() {}, fill() {}, stroke() {}, fillRect() {},
    save() {}, restore() {}, translate() {}, scale() {}, moveTo() {}, bezierCurveTo() {}, closePath() {},
    setTransform() {}, rotate() {}, arc() {}, lineTo() {}, quadraticCurveTo() {}, setLineDash() {},
    createLinearGradient: () => ({ addColorStop() {} }), createRadialGradient: () => ({ addColorStop() {} }),
    measureText: text => ({ width: Array.from(text).length * 14 }), fillText() {}
  }) });
}

// Bộ nạp thật dùng chính file .glb trong repo (GLTFLoader của three đọc được trong Node vì không có ảnh).
async function parseGlb(file) {
  const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
  const buf = fs.readFileSync(path.join(MODELS, file));
  return new Promise((ok, no) => new GLTFLoader().parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '', ok, no));
}
async function fakeAssets(log = []) {
  const { clone } = await import('three/examples/jsm/utils/SkeletonUtils.js');
  const cache = new Map();
  return { log, async load(url) {
    log.push(url);
    const file = path.basename(url);
    if (!cache.has(file)) { const gltf = await parseGlb(file); cache.set(file, { scene: gltf.scene, animations: gltf.animations, clone }); }
    return cache.get(file);
  } };
}
// Mỗi test chỉ nhớ và trả lại localStorage gốc một lần, dù đổi giá trị nhiều lần (after chạy theo thứ tự đăng ký).
const restoring = new WeakSet();
function keepStorage(t) {
  if (restoring.has(t)) return;
  restoring.add(t);
  const old = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  t.after(() => { if (old) Object.defineProperty(globalThis, 'localStorage', old); else delete globalThis.localStorage; });
}
function withSwitch(t, value) {
  keepStorage(t);
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: key => key === 'ta-avatar' ? value : null } });
}
function withThrowingStorage(t) {
  keepStorage(t);
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem() { throw new Error('bị chặn'); } } });
}
const stand = avatar => avatar.group.getObjectByName('body').children.find(node => node.name === 'hips');
const glb = avatar => avatar.group.getObjectByName('avatar-glb');
const robeOf = model => { let found = null; model.traverse(node => { if (node.isMesh) for (const m of [].concat(node.material)) if (m.name === 'robe') found = m; }); return found; };

test('clipFor: ngồi hơn vái hơn đi hơn đứng yên', async () => {
  const { clipFor } = await load();
  assert.equal(clipFor({}), 'idle');
  assert.equal(clipFor(undefined), 'idle');
  assert.equal(clipFor({ walking: true }), 'walk');
  assert.equal(clipFor({ bow: 0.4, walking: true }), 'bow');
  for (const sit of [true, 0, 3, 'cushion', 'bench']) assert.equal(clipFor({ sit, walking: true, bow: 1 }), 'sit', String(sit));
  for (const sit of [false, -1, null, 'khac']) assert.equal(clipFor({ sit }), 'idle', String(sit));
  assert.equal(clipFor({ bow: Number.NaN }), 'idle');
});

test('khóa = code: makeAvatar trả bản dựng bằng mã và không nạp .glb', async t => {
  withSwitch(t, 'code');
  const { makeAvatar, blenderEnabled } = await load();
  assert.equal(blenderEnabled(), false);
  const assets = await fakeAssets();
  const avatar = makeAvatar({ g: 'nam', c: 1, h: 0 }, { assets, createCanvas: canvasFactory() });
  await settle();
  assert.equal(glb(avatar), undefined);
  assert.equal(stand(avatar).visible, true);
  assert.deepEqual(assets.log, []);
  avatar.dispose();
});

test('mặc định: chưa có khóa, khóa "blender", giá trị rác hoặc localStorage ném lỗi đều dùng nhân vật Blender', async t => {
  const { makeAvatar, blenderEnabled } = await load();
  for (const value of [null, 'blender', 'rac']) {
    withSwitch(t, value);
    assert.equal(blenderEnabled(), true, String(value));
    const assets = await fakeAssets();
    const avatar = makeAvatar({ g: 'nu', c: 0, h: 0 }, { assets, createCanvas: canvasFactory() });
    await settle();
    assert.ok(glb(avatar), 'có mô hình khi khóa = ' + value);
    assert.equal(stand(avatar).visible, false);
    assert.deepEqual(assets.log, ['/models/avatar/nu.glb']);
    avatar.dispose();
  }
  withThrowingStorage(t);
  assert.equal(blenderEnabled(), true);
  const assets = await fakeAssets();
  const avatar = makeAvatar({ g: 'nam', c: 0, h: 0 }, { assets, createCanvas: canvasFactory() });
  await settle();
  assert.ok(glb(avatar));
  avatar.dispose();
});

test('mặc định mà .glb không nạp được: vẫn có nhân vật bản mã, không ghi console', async t => {
  withSwitch(t, null);
  const { makeAvatar } = await load();
  const logs = [];
  for (const name of ['log', 'warn', 'error']) t.mock.method(console, name, (...args) => logs.push(args));
  const avatar = makeAvatar({ g: 'nam', c: 0, h: 0 }, { assets: { load: async () => { throw new Error('404'); } }, createCanvas: canvasFactory() });
  await settle();
  avatar.update({ walking: true, yaw: 1 }, 0.05);
  assert.equal(glb(avatar), undefined);
  assert.equal(stand(avatar).visible, true);
  avatar.dispose();
  assert.deepEqual(logs, []);
});

test('công tắc bật: ẩn thân thế thân, hiện mô hình, màu áo và tóc theo look', async t => {
  withSwitch(t, 'blender');
  const { makeAvatar } = await load();
  const { AVATAR_COLORS } = await import('../public/js/world3d/avatar.mjs?v=9');
  const assets = await fakeAssets();
  const a = makeAvatar({ g: 'nam', c: 6, h: 1 }, { assets, createCanvas: canvasFactory() });
  const b = makeAvatar({ g: 'nu', c: 2, h: 3 }, { assets, createCanvas: canvasFactory() });
  assert.equal(stand(a).visible, true, 'trong lúc chờ nạp vẫn thấy thế thân');
  await settle();
  for (const [avatar, g, c, h] of [[a, 'nam', 6, 1], [b, 'nu', 2, 3]]) {
    const model = glb(avatar);
    assert.ok(model, 'có mô hình ' + g);
    assert.equal(stand(avatar).visible, false);
    assert.equal(model.visible, true);
    assert.equal(model.parent.name, 'body', 'đi theo hướng yaw của nhóm body');
    assert.equal(robeOf(model).color.getHexString(), AVATAR_COLORS[c].slice(1));
    for (let i = 0; i < 4; i++) assert.equal(model.getObjectByName('hair' + i).visible, i === h, `${g} hair${i}`);
    assert.ok(avatar.group.getObjectByName('contact-shadow'), 'bóng của thế thân vẫn còn');
    assert.ok(avatar.group.getObjectByName('nameplate'), 'nhãn tên vẫn còn');
  }
  assert.notEqual(robeOf(glb(a)), robeOf(glb(b)), 'mỗi người một vật liệu áo');
  assert.deepEqual(assets.log.sort(), ['/models/avatar/nam.glb', '/models/avatar/nu.glb']);
  // khăn quấn của nữ nhuộm theo áo, của nam màu mực
  const wrap = model => { let m = null; model.traverse(n => { if (n.isMesh && n.material.name === 'hairwrap') m = n.material; }); return m; };
  assert.notEqual(wrap(glb(b)).color.getHexString(), wrap(glb(a)).color.getHexString());
  // đổi kiểu tóc và màu áo ngay
  a.setLook({ g: 'nam', c: 0, h: 2 });
  assert.equal(robeOf(glb(a)).color.getHexString(), AVATAR_COLORS[0].slice(1));
  assert.equal(glb(a).getObjectByName('hair2').visible, true);
  assert.equal(glb(a).getObjectByName('hair1').visible, false);
  // đổi giới: thay mô hình, trong lúc chờ thấy lại thế thân
  a.setLook({ g: 'nu', c: 0, h: 2 });
  assert.equal(glb(a), undefined);
  assert.equal(stand(a).visible, true);
  await settle();
  assert.ok(glb(a));
  assert.equal(assets.log.at(-1), '/models/avatar/nu.glb');
  a.dispose(); b.dispose();
});

test('bộ nạp trả null hoặc ném lỗi: giữ thế thân, không ghi console', async t => {
  withSwitch(t, 'blender');
  const { makeAvatar } = await load();
  const logs = [];
  for (const name of ['log', 'warn', 'error']) t.mock.method(console, name, (...args) => logs.push(args));
  for (const load of [async () => null, async () => { throw new Error('404'); }]) {
    const avatar = makeAvatar({ g: 'nam', c: 0, h: 0 }, { assets: { load }, createCanvas: canvasFactory() });
    await settle();
    avatar.update({ walking: true, yaw: 1 }, 0.05);
    assert.equal(glb(avatar), undefined);
    assert.equal(stand(avatar).visible, true);
    avatar.dispose();
  }
  assert.deepEqual(logs, []);
});

test('vai NPC không có mô hình riêng và look npcFashion không vai luôn dùng bản mã', async t => {
  withSwitch(t, 'blender');
  const { makeAvatar } = await load();
  const assets = await fakeAssets();
  for (const role of ['fortune', 'reader', 'visitor', 'sword', 'toString', '__proto__']) {
    const avatar = makeAvatar({ g: 'nam', c: 0, h: 0 }, { role, assets, createCanvas: canvasFactory() });
    await settle();
    assert.equal(glb(avatar), undefined, role);
    assert.equal(stand(avatar).visible, true, role);
    avatar.dispose();
  }
  const fashion = makeAvatar({ g: 'nu', c: 0, h: 0, npcFashion: true }, { assets, createCanvas: canvasFactory() });
  await settle();
  assert.equal(glb(fashion), undefined);
  assert.deepEqual(assets.log, []);
  fashion.dispose();
});

// Mô hình Obito giả: xương mang tên như sau GLTFLoader, thân cao 0,18 m, một quả bom phải ẩn.
async function fakeObito(log = []) {
  const THREE = await import('three');
  const scene = new THREE.Group();
  const names = ['pelvis_03', 'spine_lower_04', 'spine_upper_05', 'head_neck_upper_07', 'arm_right_shoulder_028', 'arm_left_shoulder_047',
    'arm_right_elbow_029', 'arm_left_elbow_048', 'leg_right_thigh_090', 'leg_left_thigh_094', 'leg_right_knee_091', 'leg_left_knee_095'];
  for (const name of names) { const bone = new THREE.Bone(); bone.name = name; scene.add(bone); }
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.18, 0.04), new THREE.MeshBasicMaterial({ name: 'Material46' }));
  body.position.y = 0.09; body.name = 'Object_6';
  const bomb = new THREE.Mesh(new THREE.SphereGeometry(0.01), new THREE.MeshBasicMaterial({ name: '-Bomb' }));
  bomb.name = 'Object_21';
  scene.add(body, bomb);
  return { log, async load(url) { log.push(url); return { scene, animations: [] }; } };
}

test('NPC Obito dùng mô hình .glb riêng: ẩn thế thân, cao 1,62 m, bỏ quả bom, xương chân tay động khi đi', async t => {
  withSwitch(t, 'blender');
  const { makeAvatar } = await load();
  const { NPC_GLB } = await import('../public/js/world3d/npc-glb.mjs?v=2');
  const THREE = await import('three');
  const assets = await fakeObito();
  const avatar = makeAvatar({ g: 'nam', c: 11, h: 2 }, { role: 'obito', assets, reducedMotion: false, createCanvas: canvasFactory() });
  await settle();
  assert.deepEqual(assets.log, [NPC_GLB.obito.url]);
  const model = avatar.group.getObjectByName('npc-glb');
  assert.ok(model, 'đã gắn mô hình');
  assert.equal(stand(avatar).visible, false);
  avatar.update({ walking: false }, 0);
  avatar.group.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model.getObjectByName('Object_6'));
  assert.ok(Math.abs(box.max.y - box.min.y - 1.62) < 0.01, 'chiều cao ' + (box.max.y - box.min.y));
  assert.ok(Math.abs(box.min.y) < 0.01, 'chân chạm đất');
  assert.equal(model.getObjectByName('Object_21').visible, false, 'quả bom bị ẩn');
  assert.equal(model.getObjectByName('Object_6').material.type, 'MeshStandardMaterial', 'vật liệu có ánh sáng');
  const thigh = model.getObjectByName('leg_right_thigh_090');
  avatar.update({ walking: true }, 0.05);
  const a = thigh.quaternion.clone();
  avatar.update({ walking: true }, 0.1);
  assert.notDeepEqual(thigh.quaternion.toArray(), a.toArray(), 'chân đung đưa khi đi');
  avatar.update({ walking: true, reducedMotion: true }, 0.1);
  assert.ok(Math.abs(thigh.quaternion.x) < 1e-9, 'giảm chuyển động thì đứng thẳng');
  // nhãn tên và bong bóng vẫn ở bản mã
  avatar.update({ name: 'Obito', bubble: 'Mặt nạ này không che được tâm đâu.' }, 0);
  avatar.dispose();
  assert.equal(avatar.group.getObjectByName('npc-glb'), undefined);
});

test('NPC Obito: .glb lỗi thì giữ thế thân, không ghi console; công tắc bản mã thì không tải', async t => {
  withSwitch(t, 'blender');
  const { makeAvatar } = await load();
  const logs = [];
  for (const name of ['log', 'warn', 'error']) t.mock.method(console, name, (...args) => logs.push(args));
  for (const fail of [async () => null, async () => { throw new Error('404'); }]) {
    const avatar = makeAvatar({ g: 'nam', c: 11, h: 2 }, { role: 'obito', assets: { load: fail }, createCanvas: canvasFactory() });
    await settle();
    avatar.update({ walking: true }, 0.05);
    assert.equal(avatar.group.getObjectByName('npc-glb'), undefined);
    assert.equal(stand(avatar).visible, true);
    avatar.dispose();
  }
  assert.deepEqual(logs, []);
  withSwitch(t, 'code');
  const assets = await fakeObito();
  const code = makeAvatar({ g: 'nam', c: 11, h: 2 }, { role: 'obito', assets, createCanvas: canvasFactory() });
  await settle();
  assert.deepEqual(assets.log, []);
  code.dispose();
});

test('file obito.glb có đủ xương, vật liệu bom và ghi nguồn CC-BY', () => {
  const buf = fs.readFileSync(path.join(__dirname, '..', 'public', 'models', 'npc', 'obito.glb'));
  assert.equal(buf.toString('latin1', 0, 4), 'glTF');
  const json = JSON.parse(buf.toString('utf8', 20, 20 + buf.readUInt32LE(12)));
  const names = json.nodes.map(node => node.name.toLowerCase());
  for (const bone of ['leg right thigh', 'leg left thigh', 'arm right shoulder', 'arm left shoulder', 'spine lower', 'head neck upper']) {
    assert.ok(names.some(name => name.startsWith(bone)), bone);
  }
  assert.ok(json.materials.some(material => /bomb/i.test(material.name)));
  assert.match(json.asset.extras.license, /CC-BY-4\.0/);
  const notice = fs.readFileSync(path.join(__dirname, '..', 'public', 'img', 'NOTICE.txt'), 'utf8');
  assert.match(notice, /models\/npc\/obito\.glb/);
});

// Mô hình NPC giả theo bộ xương chung của tools/blender/npc/build.py: thân cao 0,5 m.
async function fakeNpc(log = []) {
  const THREE = await import('three');
  const scene = new THREE.Group();
  for (const name of ['hips', 'spine', 'chest', 'neck', 'head', 'arm_L', 'arm_R', 'forearm_L', 'forearm_R', 'thigh_L', 'thigh_R', 'shin_L', 'shin_R']) {
    const bone = new THREE.Bone(); bone.name = name; scene.add(bone);
  }
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.5, 0.1), new THREE.MeshStandardMaterial({ name: 'tripo', metalness: 1 }));
  body.position.y = 0.3; body.name = 'body';
  scene.add(body);
  return { log, async load(url) { log.push(url); return { scene, animations: [] }; } };
}

test('Tế Công, Vạn Lý Độc Hành, Tảo Địa Tăng và cô nương dùng mô hình riêng; cô nương chọn theo màu áo', async t => {
  withSwitch(t, 'blender');
  const { makeAvatar } = await load();
  const { NPC_GLB, LADY_GLB, npcModel } = await import('../public/js/world3d/npc-glb.mjs?v=2');
  const THREE = await import('three');
  assert.equal(npcModel('fortune'), null);
  assert.equal(npcModel('__proto__'), null);
  assert.equal(npcModel('lady', { c: 0 }), LADY_GLB[0]);
  assert.equal(npcModel('lady', { c: 7 }), LADY_GLB[7]);
  assert.ok(npcModel('lady', { c: 11 }), 'màu lạ vẫn có mô hình');
  assert.equal(new Set(Object.values(LADY_GLB).map(spec => spec.url)).size, 4, 'bốn cô bốn mô hình');
  assert.match(npcModel('reader', { c: 4 }).url, /thay-boi-tarot\.glb/, 'thầy bói Tarot áo tím');
  assert.equal(npcModel('reader', { c: 9 }), null, 'thầy Tử Vi vẫn là bản mã');
  const cases = [['beggar', { g: 'nam', c: 9, h: 3 }, NPC_GLB.beggar], ['wanderer', { g: 'nam', c: 11, h: 3 }, NPC_GLB.wanderer],
    ['sweeper', { g: 'nam', c: 8, h: 2 }, NPC_GLB.sweeper], ['lady', { g: 'nu', c: 2, h: 0, npcFashion: true }, LADY_GLB[2]],
    ['lady', { g: 'nu', c: 5, h: 1 }, LADY_GLB[5]]];
  for (const [role, look, spec] of cases) {
    const assets = await fakeNpc();
    const avatar = makeAvatar(look, { role, assets, reducedMotion: false, createCanvas: canvasFactory() });
    await settle();
    assert.deepEqual(assets.log, [spec.url], role);
    const model = avatar.group.getObjectByName('npc-glb');
    assert.ok(model, role);
    assert.equal(stand(avatar).visible, false, role);
    avatar.update({}, 0);
    avatar.group.updateMatrixWorld(true);
    const mesh = model.getObjectByName('body');
    const box = new THREE.Box3().setFromObject(mesh);
    assert.ok(Math.abs(box.max.y - box.min.y - spec.height) < 0.01, role + ' cao ' + (box.max.y - box.min.y));
    assert.equal(mesh.material.metalness, 0, 'vật liệu nhám, không kim loại');
    const thighR = model.getObjectByName('thigh_R'), armR = model.getObjectByName('arm_R'), armL = model.getObjectByName('arm_L');
    // Đi tới lúc sin = 1: chân phải ra sau (quay +X), tay trái ra sau (quay +Z), tay phải cầm đạo cụ thì đánh nhẹ hơn tay trái.
    avatar.update({ walking: true }, Math.PI / 32);
    avatar.update({ walking: true }, Math.PI / 32);
    assert.ok(thighR.quaternion.x > 0.05, role + ' chân phải ra sau');
    assert.ok(armL.quaternion.z > 0.01, role + ' tay trái đánh');
    if (spec.hold) assert.ok(armR.quaternion.z < armL.quaternion.z / 2, role + ' tay cầm đạo cụ đánh nhẹ');
    avatar.update({ walking: false, bow: 1 }, 0);
    assert.ok(model.getObjectByName('spine').quaternion.x > 0.2, role + ' vái thì cúi');
    avatar.update({ walking: true, reducedMotion: true }, 0.1);
    assert.ok(Math.abs(thighR.quaternion.x) < 1e-9, role + ' giảm chuyển động thì đứng thẳng');
    avatar.dispose();
    assert.equal(avatar.group.getObjectByName('npc-glb'), undefined);
  }
});

test('file .glb của Tế Công, Vạn Lý Độc Hành, Tảo Địa Tăng có bộ xương chung, đạo cụ và ghi nguồn', async () => {
  const { NPC_GLB, LADY_GLB } = await import('../public/js/world3d/npc-glb.mjs?v=2');
  const notice = fs.readFileSync(path.join(__dirname, '..', 'public', 'img', 'NOTICE.txt'), 'utf8');
  const specs = [NPC_GLB.beggar, NPC_GLB.wanderer, NPC_GLB.sweeper, ...Object.values(LADY_GLB)];
  for (const spec of specs) {
    const file = path.basename(spec.url.split('?')[0]);
    const buf = fs.readFileSync(path.join(__dirname, '..', 'public', 'models', 'npc', file));
    assert.equal(buf.toString('latin1', 0, 4), 'glTF', file);
    assert.ok(buf.length < 1.6e6, file + ' nặng ' + buf.length);
    const json = JSON.parse(buf.toString('utf8', 20, 20 + buf.readUInt32LE(12)));
    const names = new Set(json.nodes.map(node => node.name));
    for (const bone of ['spine', 'chest', 'head', 'arm_L', 'arm_R', 'thigh_L', 'thigh_R', 'shin_L', 'shin_R']) assert.ok(names.has(bone), file + ' thiếu ' + bone);
    assert.equal(json.skins?.length, 1, file);
    if (spec === NPC_GLB.wanderer || spec === NPC_GLB.sweeper) assert.ok(names.has('prop'), file + ' có đạo cụ');
    assert.ok(notice.includes('models/npc/' + file), file + ' ghi nguồn trong NOTICE.txt');
  }
  // Thầy bói Tarot: tượng ngồi, không xương.
  const tarot = fs.readFileSync(path.join(__dirname, '..', 'public', 'models', 'npc', 'thay-boi-tarot.glb'));
  assert.ok(tarot.length < 1.6e6, 'thay-boi-tarot.glb nặng ' + tarot.length);
  assert.ok(notice.includes('models/npc/thay-boi-tarot.glb'), 'thầy bói Tarot ghi nguồn');
});

test('setLook sang npcFashion khi .glb còn đang tải: bỏ kết quả tải, giữ thế thân; trở lại thì nạp mô hình', async t => {
  withSwitch(t, 'blender');
  const { makeAvatar } = await load();
  const real = await fakeAssets();
  const waiting = [];
  const assets = { load(url) { return new Promise(resolve => waiting.push(() => resolve(real.load(url)))); } };
  const avatar = makeAvatar({ g: 'nu', c: 0, h: 0 }, { assets, createCanvas: canvasFactory() });
  avatar.setLook({ g: 'nu', c: 0, h: 0, npcFashion: true });
  waiting.forEach(done => done());
  await settle();
  assert.equal(glb(avatar), undefined, 'kết quả tải cũ bị bỏ');
  assert.equal(stand(avatar).visible, true);
  avatar.setLook({ g: 'nu', c: 0, h: 0 });
  waiting.forEach(done => done());
  await settle();
  assert.ok(glb(avatar), 'bỏ trang phục NPC thì nạp mô hình');
  assert.equal(stand(avatar).visible, false);
  avatar.setLook({ g: 'nu', c: 0, h: 0, npcFashion: true });
  assert.equal(glb(avatar), undefined, 'đã nạp xong rồi chuyển sang npcFashion thì gỡ mô hình');
  assert.equal(stand(avatar).visible, true);
  avatar.dispose();
});

test('reducedMotion đổi giữa chừng khi clip không đổi: dừng rồi chạy tiếp mixer', async t => {
  withSwitch(t, 'blender');
  const { makeAvatar } = await load();
  const avatar = makeAvatar({ g: 'nam', c: 0, h: 0 }, { assets: await fakeAssets(), createCanvas: canvasFactory() });
  await settle();
  const model = glb(avatar);
  const pose = () => { avatar.group.updateMatrixWorld(true); return ['hips', 'thigh_L', 'upper_arm_R', 'head'].map(n => model.getObjectByName(n).quaternion.toArray().concat(model.getObjectByName(n).position.toArray())).flat(); };
  avatar.update({}, 0.1);
  avatar.update({}, 0.4);
  const moving = pose();
  avatar.update({ reducedMotion: true }, 0.3);
  const still = pose();
  avatar.update({ reducedMotion: true }, 0.3);
  assert.deepEqual(pose(), still, 'bật giảm chuyển động: clip idle đứng yên');
  avatar.update({}, 0.3);
  avatar.update({}, 0.3);
  assert.notDeepEqual(pose(), still, 'tắt lại: mixer chạy tiếp dù clip vẫn là idle');
  assert.ok(moving.length === still.length);
  avatar.dispose();
});

test('update đổi clip theo trạng thái; giảm chuyển động không chạy mixer', async t => {
  withSwitch(t, 'blender');
  const { makeAvatar } = await load();
  const assets = await fakeAssets();
  const avatar = makeAvatar({ g: 'nam', c: 0, h: 0 }, { assets, createCanvas: canvasFactory() });
  await settle();
  const model = glb(avatar), bone = name => model.getObjectByName(name);
  const pose = () => { avatar.group.updateMatrixWorld(true); return ['hips', 'thigh_L', 'upper_arm_R', 'head'].map(n => bone(n).quaternion.toArray().concat(bone(n).position.toArray())).flat(); };
  avatar.update({ reducedMotion: true }, 0);
  const idle = pose();
  avatar.update({ reducedMotion: true, walking: true }, 0.5);
  assert.deepEqual(pose(), idle, 'giảm chuyển động: đi vẫn đứng ở khung idle đầu');
  avatar.update({ reducedMotion: true, sit: true }, 0);
  const sit = pose();
  assert.notDeepEqual(sit, idle);
  assert.ok(model.position.y > 0.1, 'ngồi bồ đoàn được nâng lên');
  avatar.update({ reducedMotion: true, sit: 'bench' }, 0);
  assert.ok(model.position.y > 0.2, 'ghế đá cao hơn bồ đoàn');
  avatar.update({ reducedMotion: true, bow: 1 }, 0);
  const bowed = pose();
  assert.notDeepEqual(bowed, idle);
  assert.equal(model.position.y, 0);
  // chuyển động thường: đi thì xương đổi theo thời gian, hướng mặt theo yaw của nhóm body
  avatar.update({ walking: true, yaw: 1.2 }, 0.05);
  avatar.update({ walking: true, yaw: 1.2 }, 0.3);
  const walk1 = pose();
  avatar.update({ walking: true, yaw: 1.2 }, 0.2);
  assert.notDeepEqual(pose(), walk1);
  assert.notDeepEqual(walk1, idle);
  assert.equal(avatar.group.getObjectByName('body').rotation.y, 1.2);
  // Obito (state.obito) hiện lại thế thân
  avatar.update({ obito: true }, 0);
  assert.equal(stand(avatar).visible, true);
  assert.equal(model.visible, false);
  avatar.update({}, 0);
  assert.equal(stand(avatar).visible, false);
  avatar.dispose();
});

test('hào quang cúng dường gắn theo xương đầu của mô hình khi bật hào quang', async t => {
  withSwitch(t, 'blender');
  const { makeAvatar } = await load();
  const avatar = makeAvatar({ g: 'nu', c: 0, h: 0 }, { assets: await fakeAssets(), createCanvas: canvasFactory() });
  const halo = avatar.group.getObjectByName('halo');
  await settle();
  assert.equal(halo.parent.name, 'head');
  assert.equal(halo.parent.isBone, true, 'gắn vào xương đầu của mô hình, không phải đầu thế thân');
  avatar.update({ aura: { t: 4, color: '#ffd36b' }, reducedMotion: true }, 0);
  assert.equal(halo.visible, true);
  avatar.group.updateMatrixWorld(true);
  const at = halo.getWorldPosition(new (await import('three')).Vector3());
  assert.ok(at.y > 1.2 && at.y < 1.5, 'quanh tầm đầu: ' + at.y);
  assert.ok(at.z < -0.2, 'ở phía sau đầu');
  avatar.dispose();
});

test('dispose giải phóng mixer, vật liệu nhân bản và thế thân; bộ đệm gốc còn nguyên', async t => {
  withSwitch(t, 'blender');
  const { makeAvatar } = await load();
  const assets = await fakeAssets();
  const avatar = makeAvatar({ g: 'nam', c: 3, h: 0 }, { assets, createCanvas: canvasFactory() });
  await settle();
  const model = glb(avatar), robe = robeOf(model);
  const source = await assets.load('/models/avatar/nam.glb');
  const sourceGeo = source.scene.getObjectByName('hair0').geometry;
  let disposed = 0, geoDisposed = 0;
  robe.addEventListener('dispose', () => { disposed++; });
  sourceGeo.addEventListener('dispose', () => { geoDisposed++; });
  const scene = new (await import('three')).Scene();
  scene.add(avatar.group);
  avatar.dispose();
  assert.equal(disposed, 1, 'vật liệu áo nhân bản bị giải phóng');
  assert.equal(geoDisposed, 0, 'hình học dùng chung không bị giải phóng');
  assert.equal(model.parent, null);
  assert.equal(avatar.group.parent, null);
  assert.equal(avatar.group.children.length, 0, 'thế thân đã dọn');
  avatar.dispose();
  avatar.update({ walking: true }, 0.1);
  assert.equal(disposed, 1, 'dispose nhiều lần vẫn an toàn');
  // đang chờ nạp mà dispose thì mô hình không gắn muộn
  const late = makeAvatar({ g: 'nam', c: 0, h: 0 }, { assets, createCanvas: canvasFactory() });
  late.dispose();
  await settle();
  assert.equal(late.group.children.length, 0);
});

test('mô hình .glb trong repo: ≤ 1.300 tam giác khi bật một kiểu tóc, ≤ 3 vật liệu hiện, ≤ 220 KB', async () => {
  for (const file of ['nam.glb', 'nu.glb']) {
    assert.ok(fs.statSync(path.join(MODELS, file)).size <= 220 * 1024, file + ' quá nặng');
    const gltf = await parseGlb(file);
    const clips = gltf.animations.map(a => a.name).sort();
    assert.deepEqual(clips, ['bow', 'idle', 'sit', 'walk']);
    for (let h = 0; h < 4; h++) {
      let tris = 0; const mats = new Set();
      gltf.scene.traverse(node => {
        if (!node.isMesh) return;
        if (/^hair\d$/.test(node.name) && node.name !== 'hair' + h) return;
        tris += node.geometry.index.count / 3;
        for (const m of [].concat(node.material)) mats.add(m.name);
      });
      assert.ok(tris <= 1300, `${file} hair${h}: ${tris} tam giác`);
      assert.ok(mats.size <= 3, `${file} hair${h}: ${[...mats]}`);
      assert.ok(mats.has('body') && mats.has('robe'));
    }
  }
});
