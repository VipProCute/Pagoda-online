'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
globalThis.StandMath = require('../public/js/stand-math.js');
const load = () => import('../public/js/world3d/fx3d/index.mjs?v=3');
const loadAssets = () => import('../public/js/world3d/fx3d/assets.mjs');
const loadMaterials = () => import('../public/js/world3d/fx3d/materials.mjs?v=3');
const emptyCovers = () => ({ demon: false, lotus: false, aura: false, merit: false });
const settle = () => new Promise(resolve => setTimeout(resolve, 0));

function makeHost(THREE) {
  const group = new THREE.Group(), rig = new THREE.Group(), head = new THREE.Group();
  rig.name = 'body'; head.name = 'head';
  group.add(rig); rig.add(head);
  return { group, rig, head };
}

function watchDispose(resource) {
  let count = 0;
  const original = resource.dispose;
  resource.dispose = function () { count++; return original.call(this); };
  return () => count;
}

test('assets giả trả null thì covers toàn false, không ném lỗi', async () => {
  const [{ createFx3d }, { createAssets }, THREE] = await Promise.all([load(), loadAssets(), import('three')]);
  const assets = createAssets({ loadGltf: async () => null });
  let model = null;
  const url = '/models/fx/demon-4.glb';
  const demon = env => {
    env.assets.load(url).then(asset => { model = asset; });
    return { update: () => !!model, dispose: () => env.assets.release(url) };
  };
  const fx = createFx3d(makeHost(THREE), { assets, parts: { demon } });
  await settle();
  assert.deepEqual(fx.update({ demon: { n: 4, alpha: 1 } }, 0.016, {}), emptyCovers());
  fx.dispose();
});

test('loadGltf ném lỗi hoặc 404 thì load trả null và không ghi console', async t => {
  const { createAssets } = await loadAssets();
  let logs = 0;
  for (const name of ['error', 'warn']) t.mock.method(console, name, () => { logs++; });
  const assets = createAssets({ loadGltf: async () => { throw new Error('404'); } });
  assert.equal(await assets.load('/models/fx/khong-co.glb'), null);
  assert.equal(logs, 0);
  assert.equal(assets.size(), 0);
});

test('bộ đệm theo URL và đếm tham chiếu', async () => {
  const [{ createAssets }, THREE] = await Promise.all([loadAssets(), import('three')]);
  const scene = new THREE.Group();
  const geometry = new THREE.BoxGeometry(), material = new THREE.MeshBasicMaterial();
  const texture = new THREE.Texture();
  material.map = material.alphaMap = texture;
  scene.add(new THREE.Mesh(geometry, [material, material]));
  scene.add(new THREE.Mesh(geometry, material));
  const geometryCount = watchDispose(geometry), materialCount = watchDispose(material), textureCount = watchDispose(texture);
  let calls = 0;
  const assets = createAssets({ loadGltf: async () => { calls++; return { scene, animations: [] }; } });
  const url = '/models/fx/demon-4.glb';
  const first = assets.load(url), second = assets.load(url);
  assert.equal(first, second);
  const [a, b] = await Promise.all([first, second]);
  assert.equal(calls, 1);
  assert.equal(a.scene, b.scene);
  assert.equal(typeof a.clone, 'function');
  assert.notEqual(a.clone(scene), scene);
  assets.release(url);
  assert.equal(geometryCount(), 0);
  assert.equal(assets.size(), 1);
  assets.release(url);
  assert.equal(geometryCount(), 1);
  assert.equal(materialCount(), 1);
  assert.equal(textureCount(), 1);
  assert.equal(assets.size(), 0);
  assets.release(url);
  assert.equal(geometryCount(), 1);
});

test('dispose gọi dispose trên mọi geometry, material đã tạo', async () => {
  const [{ createFx3d }, materials, THREE] = await Promise.all([load(), loadMaterials(), import('three')]);
  const counts = [], host = makeHost(THREE);
  const demon = env => {
    const resources = [new THREE.BoxGeometry(), materials.spiritMaterial(), materials.flameShellMaterial(), materials.glowMaterial()];
    for (const resource of resources) { env.track(resource); counts.push(watchDispose(resource)); }
    return { update: () => true };
  };
  const fx = createFx3d(host, { parts: { demon } });
  fx.dispose();
  assert.deepEqual(counts.map(count => count()), [1, 1, 1, 1]);
  assert.equal(host.group.getObjectByName('fx3d'), undefined);
  assert.doesNotThrow(() => fx.dispose());
  assert.deepEqual(counts.map(count => count()), [1, 1, 1, 1]);
  assert.deepEqual(fx.update({}), emptyCovers());
});

test('giảm chuyển động thì không tạo THREE.Points', async () => {
  const [{ createFx3d, RENDER }, THREE] = await Promise.all([load(), import('three')]);
  for (const [quality, reducedMotion, expected] of [['high', true, 0], ['high', false, 1], ['medium', false, 0]]) {
    const aura = env => {
      env.particles(80, env.track(new THREE.PointsMaterial()));
      return { update: () => true };
    };
    const fx = createFx3d(makeHost(THREE), { quality, reducedMotion, parts: { aura } });
    const points = [];
    fx.root.traverse(node => { if (node.isPoints) points.push(node); });
    assert.equal(points.length, expected);
    if (points.length) {
      assert.ok(points[0].geometry.attributes.position.count <= 48);
      assert.equal(points[0].renderOrder, RENDER.particles);
      assert.equal(points[0].frustumCulled, false);
    }
    fx.dispose();
  }
});

test('ẩn ở góc nhìn thứ nhất hoặc ngoài suất', async () => {
  const [{ createFx3d }, THREE] = await Promise.all([load(), import('three')]);
  let hidden = 0;
  const fx = createFx3d(makeHost(THREE), { parts: { demon: () => ({ update: () => true, hide() { hidden++; } }) } });
  const covers = fx.covers;
  for (const ctx of [{ hidden: true }, { slot: false }]) {
    assert.equal(fx.update({}, 0, ctx), covers);
    assert.equal(fx.root.visible, false);
    assert.deepEqual(covers, emptyCovers());
  }
  assert.equal(hidden, 2);
  assert.equal(fx.update({}, 0, {}), covers);
  assert.equal(fx.root.visible, true);
  assert.equal(covers.demon, true);
  fx.dispose();
  assert.equal(fx.covers, covers);
  assert.deepEqual(covers, emptyCovers());
});

test('factory lỗi không làm hỏng phần khác', async () => {
  const [{ createFx3d }, THREE] = await Promise.all([load(), import('three')]);
  const fx = createFx3d(makeHost(THREE), { parts: {
    demon: () => { throw new Error('Lỗi dựng phần'); },
    lotus: () => ({ update: () => true, hide: () => { throw new Error('Lỗi ẩn'); } }),
    aura: () => ({ update: () => { throw new Error('Lỗi cập nhật'); }, dispose: () => { throw new Error('Lỗi dọn'); } }),
    merit: () => ({})
  } });
  assert.deepEqual(fx.update({}), { demon: false, lotus: true, aura: false, merit: false });
  assert.doesNotThrow(() => fx.update({}, 0, { hidden: true }));
  assert.doesNotThrow(() => fx.dispose());
});

test('register chỉ nhận tên hợp lệ', async () => {
  const { register, registered, PARTS, RENDER } = await load();
  assert.equal(register('demon', () => ({ update: () => false })), true);
  assert.equal(register('xyz', () => {}), false);
  assert.equal(register('lotus', 5), false);
  assert.ok(registered().includes('demon'));
  assert.deepEqual(PARTS, ['demon', 'lotus', 'aura', 'merit']);
  assert.ok(Object.isFrozen(PARTS));
  assert.ok(Object.isFrozen(RENDER));
});

test('noiseTexture dùng chung, 64×64, lặp liền mép', async () => {
  const [{ noiseTexture }, THREE] = await Promise.all([loadMaterials(), import('three')]);
  const texture = noiseTexture();
  assert.equal(texture, noiseTexture());
  assert.equal(texture.image.width, 64);
  assert.equal(texture.image.height, 64);
  assert.equal(texture.image.data.length, 4096);
  assert.ok(texture.image.data instanceof Uint8Array);
  assert.ok(new Set(texture.image.data).size >= 20);
  assert.equal(texture.format, THREE.RedFormat);
  assert.equal(texture.type, THREE.UnsignedByteType);
  assert.equal(texture.wrapS, THREE.RepeatWrapping);
  assert.equal(texture.wrapT, THREE.RepeatWrapping);
  assert.equal(texture.magFilter, THREE.LinearFilter);
  assert.equal(texture.minFilter, THREE.LinearFilter);
  assert.equal(texture.generateMipmaps, false);
  // Biên đối diện là hai mẫu kề nhau trên miền tuần hoàn, không phải hai mẫu trùng nhau.
  for (let i = 0; i < 64; i++) {
    assert.ok(Math.abs(texture.image.data[i * 64] - texture.image.data[i * 64 + 63]) < 45);
    assert.ok(Math.abs(texture.image.data[i] - texture.image.data[63 * 64 + i]) < 45);
  }
});

test('vật liệu đúng cờ trong suốt', async () => {
  const [materials, THREE] = await Promise.all([loadMaterials(), import('three')]);
  const spirit = materials.spiritMaterial();
  assert.equal(spirit.transparent, true);
  assert.equal(spirit.depthWrite, false);
  assert.equal(spirit.side, THREE.FrontSide);
  assert.equal(spirit.depthFunc, THREE.LessEqualDepth);
  assert.equal(spirit.forceSinglePass, false);
  assert.ok(spirit.userData.uniforms.uAlpha);
  const shader = { uniforms: {}, vertexShader: THREE.ShaderLib.standard.vertexShader, fragmentShader: THREE.ShaderLib.standard.fragmentShader };
  spirit.onBeforeCompile(shader);
  assert.match(shader.vertexShader, /vLocalY/);
  assert.match(shader.fragmentShader, /spiritCut/);
  assert.match(shader.fragmentShader, /float fr = pow\(1\.0 - abs\(dot\(normalize\(normal\), normalize\(vViewPosition\)\)\), 4\.0\)/);
  assert.equal(shader.uniforms.uRim, spirit.userData.uniforms.uRim);
  assert.equal(spirit.customProgramCacheKey(), 'fx-spirit');
  const masked = materials.spiritMaterial({ glowMask: true });
  assert.equal(masked.defines.SPIRIT_GLOW, '');
  assert.equal(masked.customProgramCacheKey(), 'fx-spirit-glow');
  const shell = materials.flameShellMaterial({ side: THREE.BackSide });
  assert.equal(shell.blending, THREE.AdditiveBlending);
  assert.equal(shell.side, THREE.BackSide);
  assert.equal(shell.depthWrite, false);
  assert.equal(shell.transparent, true);
  assert.match(shell.fragmentShader, /#include <colorspace_fragment>/);
  assert.equal(shell.toneMapped, false);
  const depth = materials.spiritDepthMaterial();
  assert.equal(depth.colorWrite, false);
  assert.equal(depth.depthWrite, true);
  assert.equal(depth.transparent, true);
  assert.equal(depth.side, THREE.FrontSide);
  assert.notEqual(depth.customProgramCacheKey(), spirit.customProgramCacheKey());
  const depthShader = { uniforms: {}, vertexShader: THREE.ShaderLib.basic.vertexShader, fragmentShader: THREE.ShaderLib.basic.fragmentShader };
  depth.onBeforeCompile(depthShader);
  assert.match(depthShader.vertexShader, /vLocalY = transformed.y/);
  assert.match(depthShader.fragmentShader, /if \(spiritCut < uThreshold\) discard/);
  assert.equal(depthShader.uniforms.uNoise.value, shader.uniforms.uNoise.value);
  const map = new THREE.Texture(), normalMap = new THREE.Texture(), emissiveMap = new THREE.Texture();
  const textured = materials.spiritMaterial({ map, normalMap, emissiveMap, glowMask: true });
  assert.equal(textured.map, map);
  assert.equal(textured.normalMap, normalMap);
  assert.equal(textured.emissiveMap, emissiveMap);
  assert.equal(textured.emissive.getHexString(), 'ffffff');
  assert.equal(textured.emissiveIntensity, 1);
  assert.equal(textured.vertexColors, false);
  assert.equal(textured.defines.SPIRIT_TEX, '');
  assert.equal(textured.defines.SPIRIT_GLOW, undefined);
  assert.equal(textured.customProgramCacheKey(), 'fx-spirit-tex');
  const texturedShader = { uniforms: {}, vertexShader: THREE.ShaderLib.standard.vertexShader, fragmentShader: THREE.ShaderLib.standard.fragmentShader };
  textured.onBeforeCompile(texturedShader);
  assert.match(texturedShader.fragmentShader, /#include <emissivemap_fragment>[\s\S]*spiritGlow = max\(max\(emissiveColor.r/);
  assert.match(texturedShader.fragmentShader, /float glowA = spiritGlow \* spiritCut/);
  const ribbon = materials.flameShellMaterial({ ribbon: true });
  assert.equal(ribbon.side, THREE.DoubleSide);
  assert.equal(ribbon.defines.FLAME_RIBBON, '');
  assert.match(ribbon.vertexShader, /#include <skinning_vertex>/);
  const glow = materials.glowMaterial();
  assert.equal(glow.toneMapped, false);
  materials.tick(spirit, 2); materials.tick(shell, 2); materials.tick(depth, 2);
  assert.equal(spirit.userData.uniforms.uTime.value, 2);
  assert.equal(shell.uniforms.uTime.value, 2);
  assert.equal(depth.userData.uniforms.uTime.value, 2);
  assert.doesNotThrow(() => materials.tick(null, 2));
  for (const material of [spirit, masked, shell, glow, depth, textured, ribbon]) material.dispose();
  for (const texture of [map, normalMap, emissiveMap]) texture.dispose();
});

test('viền linh thể có ảnh dùng pháp tuyến chưa nhiễu của Three.js r187', async t => {
  const [{ spiritMaterial }, THREE] = await Promise.all([loadMaterials(), import('three')]);
  const map = new THREE.Texture(), normalMap = new THREE.Texture(), emissiveMap = new THREE.Texture();
  const material = spiritMaterial({ map, normalMap, emissiveMap });
  t.after(() => { material.dispose(); for (const texture of [map, normalMap, emissiveMap]) texture.dispose(); });
  const shader = { uniforms: {}, vertexShader: THREE.ShaderLib.standard.vertexShader, fragmentShader: THREE.ShaderLib.standard.fragmentShader };
  material.onBeforeCompile(shader);
  // Bung chunk thật để kiểm cả tên lẫn thứ tự khai báo trước chỗ dùng.
  const expand = source => source.replace(/#include <(\w+)>/g, (include, name) => {
    assert.equal(typeof THREE.ShaderChunk[name], 'string', 'chunk phải có thật: ' + name);
    return expand(THREE.ShaderChunk[name]);
  });
  const fragment = expand(shader.fragmentShader);
  assert.match(fragment, /vec3 nonPerturbedNormal = normal;/);
  assert.match(fragment, /float fr = pow\(1\.0 - abs\(dot\(normalize\(nonPerturbedNormal\), normalize\(vViewPosition\)\)\), 4\.0\)/);
  assert.ok(fragment.indexOf('vec3 nonPerturbedNormal = normal;') < fragment.indexOf('float fr ='));
  assert.match(fragment, /totalEmissiveRadiance \+= uRim \* fr \* 0\.6;/);
  assert.match(fragment, /float rimA = fr \* spiritCut/);
});

test('placeholder vẽ được ba phần và trả covers', async () => {
  const [{ createFx3d }, { placeholderParts }, THREE] = await Promise.all([load(), import('../public/js/world3d/fx3d/placeholder.mjs'), import('three')]);
  const host = makeHost(THREE);
  const fx = createFx3d(host, { parts: placeholderParts() });
  assert.deepEqual(fx.update({ tier: 5, color: '#8fd3ff', fade: 1, demon: { n: 4, alpha: 0.5 } }, 0.016, {}),
    { demon: true, lotus: true, aura: true, merit: false });
  const demon = host.rig.getObjectByName('fx3d-demon');
  assert.ok(demon);
  assert.equal(demon.parent, host.rig);
  fx.update({}, 0, { hidden: true });
  assert.equal(demon.visible, false);
  assert.deepEqual(fx.update({ tier: 0, demon: null }, 0.016, {}), emptyCovers());
  assert.doesNotThrow(() => fx.dispose());
  assert.equal(host.rig.getObjectByName('fx3d-demon'), undefined);
});

test('thiếu host trả khung rỗng an toàn và giữ covers', async () => {
  const { createFx3d } = await load();
  for (const host of [undefined, null, {}]) {
    const fx = createFx3d(host);
    assert.equal(fx.root, null);
    assert.equal(fx.update(), fx.covers);
    assert.deepEqual(fx.covers, emptyCovers());
    assert.doesNotThrow(() => { fx.setQuality('high'); fx.setReducedMotion(true); fx.dispose(); });
  }
});

test('đổi mức chất lượng và giảm chuyển động chuyển đúng cờ cho phần con', async () => {
  const [{ createFx3d }, THREE] = await Promise.all([load(), import('three')]);
  const changes = [];
  const fx = createFx3d(makeHost(THREE), { parts: { aura: env => ({
    update: () => true,
    setQuality(q) { changes.push([q, env.quality]); },
    setReducedMotion(flag) { changes.push([flag, env.reducedMotion]); }
  }) } });
  fx.setQuality('sai'); fx.setQuality('high'); fx.setReducedMotion(1); fx.setReducedMotion(false);
  assert.deepEqual(changes, [['high', 'high'], [true, true], [false, false]]);
  fx.dispose();
});

test('URL không hợp lệ bỏ qua và tải thất bại được thử lại', async () => {
  const { createAssets } = await loadAssets();
  let calls = 0;
  const assets = createAssets({ loadGltf: async () => { calls++; return null; } });
  for (const url of [null, undefined, 3, '', '   ']) assert.equal(await assets.load(url), null);
  assert.equal(calls, 0);
  assert.equal(await assets.load('/loi.glb'), null);
  assert.equal(await assets.load('/loi.glb'), null);
  assert.equal(calls, 2);
  assert.equal(assets.size(), 0);
});

test('release lúc đang tải dọn kết quả muộn và không xóa lượt tải mới', async () => {
  const [{ createAssets }, THREE] = await Promise.all([loadAssets(), import('three')]);
  const waiting = [];
  const assets = createAssets({ loadGltf: () => new Promise(resolve => waiting.push(resolve)) });
  const first = assets.load('/cho.glb');
  await settle();
  assets.release('/cho.glb');
  const second = assets.load('/cho.glb');
  await settle();
  const oldScene = new THREE.Group(), newScene = new THREE.Group();
  const geometry = new THREE.BoxGeometry(), material = new THREE.MeshBasicMaterial();
  oldScene.add(new THREE.Mesh(geometry, material));
  const count = watchDispose(geometry);
  waiting[0]({ scene: oldScene, animations: [] });
  assert.equal(await first, null);
  assert.equal(count(), 1);
  assert.equal(assets.size(), 1);
  waiting[1]({ scene: newScene, animations: [] });
  assert.equal((await second).scene, newScene);
  assets.release('/cho.glb');
  assert.equal(assets.size(), 0);
});

test('placeholder đổi chất lượng không giữ hạt đang hiện khi giảm chuyển động', async () => {
  const [{ createFx3d }, { placeholderParts }, THREE] = await Promise.all([load(), import('../public/js/world3d/fx3d/placeholder.mjs'), import('three')]);
  const fx = createFx3d(makeHost(THREE), { quality: 'medium', parts: placeholderParts() });
  const state = { tier: 5, color: '#8fd3ff', fade: 0.7 };
  fx.update(state, 0.016);
  fx.setQuality('high'); fx.update(state, 0.016);
  const points = [];
  fx.root.traverse(node => { if (node.isPoints) points.push(node); });
  assert.equal(points.length, 1);
  assert.equal(points[0].visible, true);
  fx.setReducedMotion(true);
  assert.equal(points[0].visible, false);
  fx.setReducedMotion(false); fx.update(state, 0.016);
  assert.equal(points[0].visible, true);
  fx.setQuality('low');
  assert.equal(points[0].visible, false);
  fx.dispose();
});

function fakeAsset({ THREE, skinned = false }) {
  const scene = new THREE.Group(), geometry = new THREE.BoxGeometry();
  const count = geometry.attributes.position.count;
  geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(count * 3).fill(1), 3));
  geometry.setAttribute('color_1', new THREE.BufferAttribute(new Float32Array(count * 3).fill(1), 3));
  const spirit = new THREE.MeshStandardMaterial(); spirit.name = 'spirit';
  const body = skinned ? new THREE.SkinnedMesh(geometry, spirit) : new THREE.Mesh(geometry, spirit);
  if (skinned) {
    geometry.setAttribute('skinIndex', new THREE.BufferAttribute(new Uint16Array(count * 4), 4));
    const weights = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) weights[i * 4] = 1;
    geometry.setAttribute('skinWeight', new THREE.BufferAttribute(weights, 4));
    const bone = new THREE.Bone(); body.add(bone); body.bind(new THREE.Skeleton([bone]));
  }
  body.name = 'spirit'; scene.add(body);
  for (const name of ['shell', 'petals0', 'petals1', 'petals2', 'pod']) {
    const material = new THREE.MeshStandardMaterial();
    material.name = name.startsWith('petals') ? 'petal' : name;
    const node = new THREE.Mesh(geometry, material); node.name = name; scene.add(node);
  }
  const animations = ['emerge', 'idle', 'drift', 'scoff', 'peek', 'taunt1', 'taunt2', 'vanish']
    .map(name => new THREE.AnimationClip(name, 1, []));
  return { scene, animations, clone: source => source.clone(true) };
}

async function realFx(opts = {}) {
  const [{ createFx3d }, { createAssets }, { demonPart }, { lotusPart }, { auraPart }, THREE] = await Promise.all([
    load(), loadAssets(), import('../public/js/world3d/fx3d/demon.mjs?v=3'),
    import('../public/js/world3d/fx3d/lotus.mjs?v=2'), import('../public/js/world3d/fx3d/aura.mjs?v=3'), import('three')
  ]);
  const assets = createAssets({ loadGltf: opts.loadGltf || (async () => fakeAsset({ THREE, skinned: opts.skinned })) });
  const host = makeHost(THREE);
  const fx = createFx3d(host, { ...opts, assets, parts: { demon: demonPart, lotus: lotusPart, aura: auraPart } });
  return { fx, assets, host, THREE };
}

test('demon 3D chỉ phủ cấp 4 sau khi nạp xong', async t => {
  const { fx } = await realFx(); t.after(() => fx.dispose());
  assert.equal(fx.update({ demon: { n: 4 } }, 0.016).demon, false);
  await settle();
  assert.equal(fx.update({ demon: { n: 4 } }, 0.016).demon, true);
  assert.equal(fx.update({ demon: { n: 2 } }, 0.016).demon, false);
  assert.equal(fx.update({ demon: { n: 0 } }, 1).demon, false);
});

test('demon bám theo sau lưng và quay theo chủ', async t => {
  const { fx, host } = await realFx(); t.after(() => fx.dispose());
  const state = { demon: { n: 4 }, yaw: 0 };
  fx.update(state); await settle();
  for (let i = 0; i < 120; i++) fx.update(state, 1 / 60);
  const demon = host.group.getObjectByName('fx3d-demon');
  const near = expected => demon.position.toArray().forEach((value, i) => assert.ok(Math.abs(value - expected[i]) < 0.02));
  near([0, 1.2, -0.55]);
  state.yaw = Math.PI / 2;
  for (let i = 0; i < 120; i++) fx.update(state, 1 / 60);
  near([-0.55, 1.2, 0]);
  assert.ok(Math.abs(demon.rotation.y - state.yaw) < 0.02);
  host.group.position.x = 2;
  fx.update(state, 1 / 60);
  assert.ok(demon.position.x < -1, 'quỷ còn trễ sau khi chủ đổi vị trí');
  for (let i = 0; i < 120; i++) fx.update(state, 1 / 60);
  near([-0.55, 1.2, 0]);
});

test('.glb lỗi thì demon, lotus, aura đều không phủ', async t => {
  let calls = 0;
  const { fx } = await realFx({ loadGltf: async () => { calls++; return null; } }); t.after(() => fx.dispose());
  const state = { tier: 5, demon: { n: 4 } };
  assert.deepEqual(fx.update(state), emptyCovers());
  await settle();
  for (let i = 0; i < 3; i++) assert.deepEqual(fx.update(state, 0.016), emptyCovers());
  assert.equal(calls, 3, 'mỗi phần chỉ thử nạp một lần');
});

test('lotus phủ bậc 2 đến 7, aura chỉ bậc 5', async t => {
  const { fx } = await realFx(); t.after(() => fx.dispose());
  fx.update({ tier: 5 }); await settle();
  assert.deepEqual(fx.update({ tier: 5 }, 0.016), { demon: false, lotus: true, aura: true, merit: false });
  for (let tier = 0; tier <= 9; tier++) {
    const covers = fx.update({ tier }, 0.016);
    assert.equal(covers.lotus, tier >= 2 && tier <= 7);
    assert.equal(covers.aura, tier === 5);
  }
});

test('giảm chuyển động: không có hạt, sen nở ngay', async t => {
  const { fx } = await realFx({ quality: 'high', reducedMotion: true }); t.after(() => fx.dispose());
  const state = { tier: 5, demon: { n: 4 } };
  fx.update(state); await settle(); fx.update(state, 0.016);
  fx.root.traverse(node => assert.ok(!node.isPoints));
  for (const name of ['petals0', 'petals1', 'petals2']) {
    assert.equal(fx.root.getObjectByName('fx3d-lotus').getObjectByName(name).scale.x, 1);
  }
});

test('dispose trả tài nguyên về bộ đệm', async () => {
  const { fx, assets } = await realFx({ skinned: true });
  fx.update({ tier: 5, demon: { n: 4 } }); await settle();
  fx.update({ tier: 5, demon: { n: 4 } });
  assert.equal(assets.size(), 3);
  fx.dispose(); fx.dispose();
  assert.equal(assets.size(), 0);
});

test('demon tan dần và mờ khi gần máy quay', async t => {
  const { fx } = await realFx(); t.after(() => fx.dispose());
  const state = { demon: { n: 4, alpha: 0.5 } };
  fx.update(state); await settle(); fx.update(state, 0.016, { distance: 1.2 });
  const mat = fx.root.getObjectByName('spirit').material;
  assert.equal(mat.userData.uniforms.uAlpha.value, 0.275);
  fx.update({}, 0, { distance: 3 });
  assert.equal(fx.covers.demon, true);
  fx.update({}, 0.3, { distance: 3 });
  assert.equal(mat.userData.uniforms.uAlpha.value, 0.5);
  fx.update({}, 0.31);
  assert.equal(fx.covers.demon, false);
  fx.setReducedMotion(true);
  assert.equal(fx.update({}, 0.016).demon, false);
});

test('giảm chuyển động đưa quỷ về idle ngay giữa lúc chuyển clip', async t => {
  const THREE = await import('three');
  const { fx } = await realFx({ loadGltf: async () => {
    const asset = fakeAsset({ THREE });
    asset.animations = [
      new THREE.AnimationClip('emerge', 1, [new THREE.NumberKeyframeTrack('spirit.position[y]', [0, 1], [2, 2])]),
      new THREE.AnimationClip('idle', 1, [new THREE.NumberKeyframeTrack('spirit.position[y]', [0, 1], [0, 0])])
    ];
    return asset;
  } });
  t.after(() => fx.dispose());
  const state = { demon: { n: 4 } };
  fx.update(state); await settle(); fx.update(state, 0.1);
  const spirit = fx.root.getObjectByName('spirit');
  assert.equal(spirit.position.y, 2);
  fx.setReducedMotion(true); fx.update(state, 0.016);
  assert.equal(spirit.position.y, 0);
  for (let i = 0; i < 10; i++) fx.update(state, 0.016);
  assert.equal(spirit.position.y, 0);
});

test('đổi chất lượng giữ ba, hai, một lớp vỏ và ẩn hạt ngay, không tạo lại hạt', async t => {
  const { fx } = await realFx({ quality: 'high' }); t.after(() => fx.dispose());
  const state = { tier: 5 };
  fx.update(state); await settle(); fx.update(state, 0.016);
  const points = [];
  fx.root.traverse(node => { if (node.isPoints) points.push(node); });
  assert.equal(points.length, 2);
  const shells = fx.root.getObjectByName('fx3d-aura').children;
  assert.equal(shells.length, 6, 'mỗi lớp có mặt sau và mặt trước');
  assert.equal(shells.filter(shell => shell.visible).length, 6);
  fx.setQuality('medium');
  assert.equal(shells.filter(shell => shell.visible).length, 4);
  assert.deepEqual(shells.filter(shell => shell.visible).map(shell => shell.material.uniforms.uSeed.value), [0, 0, 0.37, 0.37]);
  for (const point of points) assert.equal(point.visible, false);
  for (const shell of shells) assert.equal(shell.material.uniforms.uDisplace.value, 1);
  fx.setQuality('low');
  for (const point of points) assert.equal(point.visible, false);
  assert.equal(shells.filter(shell => shell.visible).length, 2);
  assert.ok(shells.filter(shell => shell.visible).every(shell => shell.material.uniforms.uSeed.value === 0));
  for (const shell of shells) assert.equal(shell.material.uniforms.uDisplace.value, 0);
  fx.setQuality('high');
  assert.equal(shells.filter(shell => shell.visible).length, 6);
  for (const shell of shells) assert.equal(shell.material.uniforms.uDisplace.value, 1);
  fx.setReducedMotion(true); fx.update(state, 0.016);
  for (const point of points) assert.equal(point.visible, false);
  fx.setReducedMotion(false); fx.update(state, 0.016);
  for (const point of points) assert.equal(point.visible, true);
  const after = []; fx.root.traverse(node => { if (node.isPoints) after.push(node); });
  assert.deepEqual(after, points);
});

test('ba lớp lửa lệch pha nhiễu, tăng kích thước và giảm độ đục ra ngoài', async t => {
  const { fx, THREE } = await realFx({ quality: 'high' }); t.after(() => fx.dispose());
  const state = { tier: 5, fade: 0.8, color: '#8fd3ff' };
  fx.update(state); await settle(); fx.update(state, 0.016);
  const shells = fx.root.getObjectByName('fx3d-aura').children;
  assert.equal(shells.length, 6);
  const scales = [[1, 1, 1], [1.1, 1.22, 1.1], [1.2, 1.45, 1.2]];
  const seeds = [0, 0.37, 0.71], opacities = [1, 0.7, 0.45];
  for (let i = 0; i < 3; i++) {
    const [back, front] = shells.slice(i * 2, i * 2 + 2);
    assert.equal(back.material.side, THREE.BackSide);
    assert.equal(front.material.side, THREE.FrontSide);
    for (const shell of [back, front]) {
      assert.deepEqual(shell.scale.toArray(), scales[i]);
      assert.equal(shell.material.uniforms.uSeed.value, seeds[i]);
      assert.equal(shell.material.uniforms.uColor.value.getHexString(), '8fd3ff');
    }
    assert.equal(front.material.uniforms.uOpacity.value, state.fade * opacities[i]);
    assert.equal(back.material.uniforms.uOpacity.value, state.fade * opacities[i] * 0.45);
  }
});

test('dispose trước khi tải xong trả đủ tham chiếu và không gắn mô hình muộn', async () => {
  const waiting = [];
  const { fx, host, assets, THREE } = await realFx({ loadGltf: () => new Promise(resolve => waiting.push(resolve)) });
  fx.update({ tier: 5, demon: { n: 4 } }); await settle();
  assert.equal(waiting.length, 3);
  fx.dispose();
  waiting.forEach(resolve => resolve(fakeAsset({ THREE })));
  await settle();
  assert.equal(assets.size(), 0);
  assert.equal(host.group.getObjectByName('fx3d'), undefined);
});

test('tải quỷ lỗi rồi tải lại không trả nhầm tham chiếu của lượt sau', async t => {
  const [{ createFx3d }, { createAssets }, { demonPart }, THREE] = await Promise.all([
    load(), loadAssets(), import('../public/js/world3d/fx3d/demon.mjs?v=3'), import('three')
  ]);
  const asset = fakeAsset({ THREE });
  const disposed = watchDispose(asset.scene.getObjectByName('spirit').geometry);
  let calls = 0;
  const assets = createAssets({ loadGltf: async () => {
    if (++calls === 1) throw new Error('Lỗi tải lần đầu');
    return asset;
  } });
  const release = t.mock.method(assets, 'release');
  const make = () => createFx3d(makeHost(THREE), { assets, parts: { demon: demonPart } });
  const first = make(), second = make(), third = make();
  t.after(() => { first.dispose(); second.dispose(); third.dispose(); });
  const state = { demon: { n: 4 } };
  first.update(state); await settle();
  assert.equal(first.update(state).demon, false);
  assert.equal(assets.size(), 0);
  second.update(state); third.update(state); await settle();
  assert.equal(second.update(state).demon, true);
  assert.equal(third.update(state).demon, true);
  first.dispose();
  assert.equal(release.mock.callCount(), 0, 'lượt lỗi không được release lượt thành công cùng URL');
  second.dispose();
  assert.equal(disposed(), 0);
  assert.equal(assets.size(), 1);
  third.dispose();
  assert.equal(disposed(), 1);
  assert.equal(assets.size(), 0);
  assert.equal(calls, 2);
});

test('mọi nhóm hiệu ứng của người xa vẽ trước người gần và bảng tên', async t => {
  const [{ createFx3d }, THREE] = await Promise.all([load(), import('three')]);
  const part = env => {
    const holder = env.group('thử');
    holder.add(new THREE.Group());
    return { update() { holder.children[0].add(new THREE.Group()); return true; } };
  };
  const near = createFx3d(makeHost(THREE), { parts: { demon: part } });
  const far = createFx3d(makeHost(THREE), { parts: { demon: part } });
  t.after(() => { near.dispose(); far.dispose(); });
  const orders = fx => {
    const values = [];
    fx.root.traverse(node => { if (node.isGroup) values.push(node.renderOrder); });
    assert.ok(values.length >= 4, 'kiểm cả nhóm gốc và nhóm lồng vừa sinh');
    return values;
  };
  near.update({}, 0, { distance: 3 }); far.update({}, 0, { distance: 12 });
  assert.ok(orders(near).every(order => order === -31));
  assert.ok(orders(far).every(order => order === -121 && order < near.root.renderOrder && order < 0));
  near.update({}, 0, { distance: Infinity });
  assert.ok(orders(near).every(order => order === -9999));
});

test('neo quỷ dùng vị trí chủ mới ngay khi ma trận thế giới chưa cập nhật', async t => {
  const { fx, host, THREE } = await realFx({ reducedMotion: true });
  t.after(() => fx.dispose());
  const parent = new THREE.Group(); parent.position.set(4, 0.5, -3); parent.add(host.group);
  const state = { demon: { n: 4 }, yaw: 0.7 };
  fx.update(state); await settle(); fx.update(state);
  host.group.position.set(2, 0.3, 5);
  fx.update(state);
  const demon = fx.root.getObjectByName('fx3d-demon');
  const position = demon.getWorldPosition(new THREE.Vector3());
  const anchor = globalThis.StandMath.ANCHOR[4];
  const expected = new THREE.Vector3(6 + anchor.z * Math.sin(state.yaw), 0.8 + anchor.y, 2 + anchor.z * Math.cos(state.yaw));
  assert.ok(position.distanceTo(expected) < 1e-6, 'neo phải theo vị trí mới trong cùng khung');
});

test('thân quỷ có ảnh ghi chiều sâu bằng bản sao chung xương và chỉ lửa có hai mặt', async t => {
  const THREE = await import('three');
  const asset = fakeAsset({ THREE, skinned: true });
  const source = asset.scene.getObjectByName('spirit');
  asset.scene.remove(...asset.scene.children.filter(node => node !== source));
  source.name = 'demon_body'; source.material.name = 'demon_body';
  source.material.map = new THREE.Texture();
  source.material.normalMap = new THREE.Texture();
  source.material.emissiveMap = new THREE.Texture();
  const flame = new THREE.Mesh(new THREE.PlaneGeometry(), new THREE.MeshBasicMaterial());
  flame.name = 'demon_flame'; flame.material.name = 'demon_flame'; asset.scene.add(flame);
  const { fx } = await realFx({ reducedMotion: true, loadGltf: async () => asset });
  t.after(() => fx.dispose());
  const state = { demon: { n: 4 } };
  fx.update(state); await settle(); fx.update(state, 0, { distance: 3 });
  const body = fx.root.getObjectByName('demon_body'), pre = fx.root.getObjectByName('demon_body-depth');
  const ribbon = fx.root.getObjectByName('demon_flame');
  assert.ok(pre.isSkinnedMesh);
  assert.equal(pre.parent, body.parent);
  assert.equal(pre.geometry, body.geometry);
  assert.equal(pre.skeleton, body.skeleton);
  assert.deepEqual(pre.bindMatrix, body.bindMatrix);
  assert.equal(pre.material.colorWrite, false);
  assert.equal(pre.material.depthWrite, true);
  assert.equal(pre.material.transparent, true);
  assert.equal(body.material.side, THREE.FrontSide);
  assert.equal(body.material.depthWrite, false);
  assert.equal(body.material.depthFunc, THREE.LessEqualDepth);
  assert.equal(body.material.vertexColors, false);
  assert.equal(body.material.map, source.material.map);
  assert.equal(body.material.normalMap, source.material.normalMap);
  assert.equal(body.material.emissiveMap, source.material.emissiveMap);
  assert.equal(body.material.userData.uniforms.uRim.value.getHexString(), '7a1a08');
  assert.ok(pre.renderOrder < body.renderOrder && body.renderOrder < ribbon.renderOrder);
  fx.root.getObjectByName('fx3d-demon').traverse(node => {
    if (node.isMesh && node !== ribbon) assert.equal(node.material.side, THREE.FrontSide);
  });
  assert.equal(ribbon.material.side, THREE.DoubleSide);
  fx.update({ demon: { n: 4, alpha: 0.01 } }, 0, { distance: 3 });
  assert.equal(pre.visible, false, 'quỷ gần tan không để lại lỗ chiều sâu');
  assert.equal(pre.material.userData.uniforms.uAlpha.value, 0.01);
  assert.equal(ribbon.material.uniforms.uOpacity.value, 0.01 * 0.9);
  fx.update(state, 0, { distance: 3 });
  assert.equal(pre.visible, true);
});

test('quỷ của mình đứng lệch sang trái ở chế độ side và trả được về cover', async t => {
  const { SELF_DEMON } = await import('../public/js/world3d/fx3d/demon.mjs?v=3');
  const previous = SELF_DEMON.mode;
  const { fx } = await realFx({ reducedMotion: true });
  t.after(() => { SELF_DEMON.mode = previous; fx.dispose(); });
  const state = { demon: { n: 4 }, yaw: 0 };
  SELF_DEMON.mode = 'cover';
  fx.update(state); await settle(); fx.update(state, 0, { isSelf: true, distance: 1.2 });
  const demon = fx.root.getObjectByName('fx3d-demon');
  const coverPosition = demon.position.clone(), material = demon.getObjectByName('spirit').material;
  assert.equal(material.userData.uniforms.uAlpha.value, 0.3);
  SELF_DEMON.mode = 'side';
  fx.update(state, 0, { isSelf: true, distance: 1.2 });
  assert.ok(demon.position.x - coverPosition.x >= 0.5);
  assert.ok(Math.abs(demon.position.x - coverPosition.x - 0.9) < 1e-6);
  assert.ok(Math.abs(demon.position.y - coverPosition.y - 0.3) < 1e-6);
  assert.ok(Math.abs(demon.position.z - coverPosition.z - 0.35) < 1e-6);
  assert.equal(material.userData.uniforms.uAlpha.value, 0.55);
  SELF_DEMON.mode = 'cover';
  fx.update(state, 0, { isSelf: true });
  assert.ok(demon.position.distanceTo(coverPosition) < 1e-6);
});
