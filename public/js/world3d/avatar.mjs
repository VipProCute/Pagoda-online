'use strict';

import * as THREE from 'three';

// Đơn vị mét, chân ở y=0, mặt hướng +Z; yaw tính bằng radian.
// opts: role (beggar/wanderer/obito/sweeper/fortune), isSelf, view,
// reducedMotion, createCanvas (tùy chọn để kiểm thử không cần DOM).
// state.reducedMotion/view có thể ghi đè lựa chọn của opts khi đổi cài đặt.
// update nhận ảnh chụp trạng thái đầy đủ, dt tính bằng giây; không tự đổi vị trí.
// sit: false/-1 = đứng, true/0..n/'cushion' = bồ đoàn, 'bench' = ghế đá.
// aura: boolean, màu CSS, hoặc { color }; bubble: chuỗi hoặc { text }.
// dispose sở hữu toàn bộ geometry/material/texture; gọi nhiều lần vẫn an toàn.
export const AVATAR_COLORS = Object.freeze([
  '#c0392b', '#e2a93b', '#e48aa5', '#3fa58d', '#8e5fb8', '#efe8da',
  '#3b78c2', '#e07b39', '#7b8ea6', '#8a6a4c', '#5f9a4a', '#2c2a30'
]);

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const finite = (v, fallback = 0) => Number.isFinite(v) ? v : fallback;
const textOf = (value, length) => Array.from(typeof value === 'string' ? value : '').slice(0, length).join('');
const normalize = look => ({
  g: look?.g === 'nu' ? 'nu' : 'nam',
  c: Number.isInteger(look?.c) && look.c >= 0 && look.c < 12 ? look.c : 0,
  h: Number.isInteger(look?.h) && look.h >= 0 && look.h < 4 ? look.h : 0
});

function wrap(ctx, text, width, limit) {
  const lines = [];
  let line = '';
  for (const character of text.replace(/\s+/g, ' ').trim()) {
    if (ctx.measureText(line + character).width > width && line) {
      lines.push(line.trim());
      line = '';
      if (lines.length === limit) break;
    }
    line += character;
  }
  if (line && lines.length < limit) lines.push(line.trim());
  if (lines.length === limit) lines[limit - 1] = lines[limit - 1].replace(/.{0,3}$/u, '…');
  return lines;
}

function makeLabel(createCanvas, bubble = false) {
  const canvas = createCanvas();
  const ctx = canvas?.getContext('2d');
  const material = new THREE.SpriteMaterial({ transparent: true, depthWrite: false, toneMapped: false });
  const sprite = new THREE.Sprite(material);
  sprite.name = bubble ? 'bubble' : 'nameplate';
  sprite.visible = false;
  let texture = null, previous = null;
  const labelPosition = new THREE.Vector3(), cameraPosition = new THREE.Vector3(), parentScale = new THREE.Vector3(), cameraSpace = new THREE.Vector3();
  let baseWidth = 1, baseHeight = 1, contentRatio = 1;
  // Tính theo pixel CSS, độc lập DPR, áp dụng cả nhân vật do từng cảnh dựng.
  sprite.onBeforeRender = (renderer, scene, camera) => {
    sprite.getWorldPosition(labelPosition);
    camera.getWorldPosition(cameraPosition);
    const distance = labelPosition.distanceTo(cameraPosition);
    material.opacity = clamp((distance - 1.2) / 1.2, 0, 1);
    const depth = -cameraSpace.copy(labelPosition).applyMatrix4(camera.matrixWorldInverse).z;
    const pixels = renderer.domElement.getBoundingClientRect().height;
    const maxHeight = (bubble ? 96 : 28) * 2 * Math.max(0, depth) / (contentRatio * camera.projectionMatrix.elements[5] * Math.max(1, pixels));
    sprite.parent?.getWorldScale(parentScale);
    const factor = Math.min(1, maxHeight / (baseHeight * Math.abs(parentScale.y || 1)));
    sprite.scale.set(baseWidth * factor, baseHeight * factor, 1);
    sprite.updateWorldMatrix(false, false);
  };
  function set(text, tag = '') {
    text = text.trim(); tag = tag.trim();
    const key = text + '\n' + tag;
    if (key === previous) return;
    previous = key;
    sprite.visible = !!text && !!ctx;
    if (!ctx || !text) return;
    canvas.width = 512;
    canvas.height = bubble ? 256 : 128;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = `${bubble ? 26 : 30}px system-ui, sans-serif`;
    const lines = bubble ? wrap(ctx, text, 456, 5) : [text];
    const height = bubble ? lines.length * 34 + 28 : tag ? 100 : 64;
    contentRatio = (height + 12) / canvas.height;
    ctx.fillStyle = bubble ? '#fff1d7' : 'rgba(45,30,24,0.90)';
    ctx.strokeStyle = bubble ? '#bc8b49' : '#ae8650';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(6, 6, 500, height, 18);
    ctx.fill(); ctx.stroke();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = bubble ? '#4a2e20' : '#fff1d7';
    lines.forEach((line, i) => ctx.fillText(line, 256, bubble ? 36 + i * 34 : 39, 456));
    if (tag) {
      ctx.font = '23px system-ui, sans-serif';
      ctx.fillStyle = '#e6bc72';
      ctx.fillText(tag, 256, 79, 456);
    }
    if (!texture) {
      texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      material.map = texture;
      material.needsUpdate = true;
    }
    texture.needsUpdate = true;
    // Khung chữ dùng kích thước cố định để không nhảy khi đổi nội dung.
    baseWidth = bubble ? 2 : 1.55; baseHeight = baseWidth * canvas.height / canvas.width;
    sprite.scale.set(baseWidth, baseHeight, 1);
    sprite.center.set(0.5, 1 - (height / 2 + 6) / canvas.height);
  }
  return { sprite, set, dispose() { texture?.dispose(); material.dispose(); } };
}

export function createAvatar(initialLook = {}, opts = {}) {
  const group = new THREE.Group();
  group.name = 'avatar';
  const rig = new THREE.Group();
  rig.name = 'body';
  group.add(rig);
  const geometries = new Set(), materials = new Set();
  const geometry = value => { geometries.add(value); return value; };
  const material = (color, extra = {}) => {
    const value = new THREE.MeshStandardMaterial({ color, roughness: 0.92, flatShading: true, ...extra });
    materials.add(value);
    return value;
  };
  const cloth = material(AVATAR_COLORS[0]);
  const trim = material('#825b35');
  const skin = material('#f0c9a4');
  const hair = material('#1f1612');
  const ivory = material('#efe8da');
  const wood = material('#68432e');
  const straw = material('#c5a36a');
  const ink = material('#2c2a30');
  const gold = material('#c99b50', { metalness: 0.25 });
  const clay = material('#b96d38');
  const box = geometry(new THREE.BoxGeometry(1, 1, 1));
  const cylinder = geometry(new THREE.CylinderGeometry(1, 1, 1, 6, 1, true));
  const ball = geometry(new THREE.SphereGeometry(1, 8, 4));
  function mesh(parent, shape, mat, size, position, name) {
    const object = new THREE.Mesh(shape, mat);
    object.scale.set(...size);
    object.position.set(...position);
    object.name = name || '';
    object.castShadow = true;
    parent.add(object);
    return object;
  }
  const part = (parent, name, position) => {
    const node = new THREE.Group(); node.name = name; node.position.set(...position); parent.add(node); return node;
  };
  const hips = part(rig, 'hips', [0, 0.6425, 0]);
  const torso = part(hips, 'torso', [0, 0, 0]);
  const closedCylinder = geometry(new THREE.CylinderGeometry(1, 1, 1, 6));
  const coat = mesh(torso, closedCylinder, cloth, [0.205, 0.43, 0.14], [0, 0.235, 0]);
  const collar = mesh(torso, cylinder, trim, [0.075, 0.06, 0.067], [0, 0.465, 0]);
  mesh(torso, box, ivory, [0.008, 0.27, 0.008], [0.10, 0.24, 0.124]).rotation.z = 0.16;
  mesh(torso, cylinder, skin, [0.055, 0.09, 0.055], [0, 0.51, 0]);
  const head = part(torso, 'head', [0, 0.70, 0]);
  mesh(head, ball, skin, [0.165, 0.195, 0.15], [0, 0, 0]);
  for (const x of [-0.055, 0.055]) mesh(head, box, ink, [0.023, 0.025, 0.018], [x, 0.008, 0.143]);
  mesh(head, box, clay, [0.043, 0.01, 0.012], [0, -0.067, 0.139]);
  const hairRoot = part(head, 'hair', [0, 0, 0]);
  const hairCap = mesh(hairRoot, geometry(new THREE.SphereGeometry(1, 8, 2, 0, Math.PI * 2, 0, Math.PI / 2)), hair,
    [0.176, 0.16, 0.16], [0, 0.065, -0.012]);
  const longHair = mesh(hairRoot, box, hair, [0.29, 0.34, 0.075], [0, -0.10, -0.126]);
  const bun = mesh(hairRoot, geometry(new THREE.IcosahedronGeometry(1, 0)), hair, [0.09, 0.09, 0.08], [0, 0.20, -0.055]);
  const turban = mesh(hairRoot, closedCylinder, trim, [0.197, 0.10, 0.18], [0, 0.16, 0]);
  const skirt = part(hips, 'skirt', [0, 0, 0]);
  // Hai tà rời để còn thấy quần trắng và khoảng xẻ hai bên áo dài.
  const panelGeometry = geometry(new THREE.CylinderGeometry(0.16, 0.255, 0.48, 4, 1, false));
  for (const z of [-0.075, 0.075]) mesh(skirt, panelGeometry, cloth, [1, 1, 0.39], [0, -0.22, z]);
  const legs = [], knees = [], arms = [], elbows = [];
  for (const sign of [-1, 1]) {
    const leg = part(hips, sign < 0 ? 'left-leg' : 'right-leg', [sign * 0.095, -0.01, 0]);
    mesh(leg, box, ivory, [0.12, 0.27, 0.12], [0, -0.135, 0]);
    const knee = part(leg, 'knee', [0, -0.27, 0]);
    mesh(knee, box, ivory, [0.108, 0.28, 0.108], [0, -0.14, 0]);
    mesh(knee, box, wood, [0.13, 0.065, 0.22], [0, -0.33, 0.045]);
    legs.push(leg); knees.push(knee);
    const arm = part(torso, sign < 0 ? 'left-arm' : 'right-arm', [sign * 0.225, 0.38, 0]);
    mesh(arm, cylinder, cloth, [0.073, 0.22, 0.073], [0, -0.11, 0]);
    const elbow = part(arm, 'elbow', [0, -0.22, 0]);
    mesh(elbow, cylinder, cloth, [0.06, 0.18, 0.06], [0, -0.09, 0]);
    mesh(elbow, box, skin, [0.06, 0.11, 0.055], [0, -0.215, 0]);
    arms.push(arm); elbows.push(elbow);
  }
  const accessory = part(torso, 'accessory', [0, 0, 0]);
  const role = opts.role;
  if (role === 'beggar') {
    hair.color.set('#b8ad98');
    mesh(head, box, ivory, [0.06, 0.15, 0.035], [0, -0.16, 0.12]);
    const bowl = geometry(new THREE.CylinderGeometry(0.13, 0.065, 0.08, 8, 1, true));
    mesh(accessory, bowl, wood, [1, 1, 1], [0.28, 0.03, 0.23]);
    mesh(accessory, geometry(new THREE.CircleGeometry(0.115, 8)), ink, [1, 1, 1], [0.28, 0.055, 0.23]).rotation.x = -Math.PI / 2;
    mesh(torso, box, straw, [0.085, 0.10, 0.012], [-0.095, 0.19, 0.126]).rotation.z = 0.18;
  } else if (role === 'wanderer') {
    mesh(head, geometry(new THREE.ConeGeometry(0.33, 0.18, 10)), straw, [1, 1, 1], [0, 0.21, 0]);
    mesh(torso, box, wood, [0.15, 0.39, 0.13], [0.10, 0.20, -0.19]).rotation.z = -0.25;
    mesh(torso, box, straw, [0.035, 0.43, 0.035], [-0.08, 0.21, 0.14]).rotation.z = -0.38;
  } else if (role === 'obito') {
    const mask = mesh(head, geometry(new THREE.CircleGeometry(0.16, 10)), clay, [1, 1.1, 1], [0, 0, 0.163]);
    // Đường xoắn tự dựng, không dùng ảnh ngoài.
    const points = [];
    for (let i = 0; i <= 28; i++) {
      const angle = i / 28 * Math.PI * 4, radius = 0.012 + i / 28 * 0.13;
      points.push(new THREE.Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius, 0.002));
    }
    const lineMat = new THREE.LineBasicMaterial({ color: '#633b26' }); materials.add(lineMat);
    mask.add(new THREE.Line(geometry(new THREE.BufferGeometry().setFromPoints(points)), lineMat));
    mesh(head, box, ink, [0.028, 0.02, 0.012], [0.015, 0, 0.18]);
  } else if (role === 'sweeper') {
    const broom = part(accessory, 'broom', [0.35, -0.6325, 0.15]);
    broom.rotation.z = 0.16;
    mesh(broom, cylinder, wood, [0.018, 1.12, 0.018], [0, 0.63, 0]);
    mesh(broom, geometry(new THREE.CylinderGeometry(0.035, 0.15, 0.22, 6)), straw, [1, 1, 0.55], [0, 0.10, 0]);
    mesh(broom, cylinder, wood, [0.047, 0.03, 0.036], [0, 0.20, 0]);
  } else if (role === 'fortune' || role === 'reader') {
    hair.color.set('#b8ad98');
    mesh(accessory, box, wood, [0.25, 0.035, 0.17], [0, 0.11, 0.27]).rotation.x = 0.2;
    mesh(accessory, box, ivory, [0.225, 0.016, 0.15], [0, 0.134, 0.27]).rotation.x = 0.2;
    mesh(head, box, ivory, [0.055, 0.19, 0.04], [0, -0.18, 0.12]);
  }
  const auraMaterial = new THREE.MeshBasicMaterial({ color: '#e7bc67', transparent: true, opacity: 0.65, side: THREE.DoubleSide, depthWrite: false });
  materials.add(auraMaterial);
  // Bóng tiếp xúc nhẹ vẫn có ở mức Vừa, không cần bản đồ bóng cho từng người.
  const shadowMaterial = new THREE.MeshBasicMaterial({ color: '#281c14', transparent: true, opacity: 0.18, depthWrite: false });
  materials.add(shadowMaterial);
  const shadow = mesh(rig, geometry(new THREE.CircleGeometry(1, 12)), shadowMaterial, [0.29, 0.18, 1], [0, 0.004, 0], 'contact-shadow');
  shadow.rotation.x = -Math.PI / 2; shadow.castShadow = false;
  const aura = mesh(rig, geometry(new THREE.RingGeometry(0.38, 0.41, 16)), auraMaterial, [1, 1, 1], [0, 0.012, 0], 'aura');
  aura.rotation.x = -Math.PI / 2; aura.castShadow = false;
  const halo = mesh(head, geometry(new THREE.RingGeometry(0.225, 0.24, 16)), auraMaterial, [1, 1, 1], [0, 0.02, -0.20], 'halo');
  halo.castShadow = false;
  const createCanvas = opts.createCanvas || (() => globalThis.document?.createElement('canvas'));
  const nameplate = makeLabel(createCanvas), bubble = makeLabel(createCanvas, true);
  group.add(nameplate.sprite, bubble.sprite);
  let look, elapsed = 0, disposed = false, lastState = {};
  function setLook(nextLook) {
    if (disposed) return;
    look = normalize(nextLook);
    group.userData.look = { ...look };
    cloth.color.set(AVATAR_COLORS[look.c]);
    trim.color.copy(cloth.color).multiplyScalar(0.62);
    coat.scale.x = look.g === 'nu' ? 0.185 : 0.205;
    skirt.scale.x = look.g === 'nu' ? 1.08 : 1;
    hairCap.visible = look.h !== 3;
    longHair.visible = look.h === 0;
    bun.visible = look.h === 1;
    turban.visible = look.h === 3;
    turban.material = look.g === 'nam' ? ink : trim;
  }
  function update(state = {}, dt = 0) {
    if (disposed) return;
    lastState = state;
    const reduced = state.reducedMotion ?? opts.reducedMotion ?? !!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (!reduced) elapsed += clamp(finite(dt), 0, 0.1);
    const sitting = state.sit === true || state.sit === 'cushion' || state.sit === 'bench' || (Number.isInteger(state.sit) && state.sit >= 0);
    const bench = state.sit === 'bench';
    const bow = clamp(finite(state.bow), 0, 1);
    const walking = !!state.walking && !sitting && !bow;
    const swing = walking && !reduced ? Math.sin(elapsed * 8) * 0.45 : 0;
    const breath = reduced || walking ? 0 : Math.sin(elapsed * 1.8) * 0.006;
    const first = (state.isSelf ?? opts.isSelf) && (state.view || opts.view) === 'first';
    rig.visible = !first;
    rig.rotation.y = finite(state.yaw);
    hips.position.y = (sitting ? bench ? 0.41 : 0.36 : 0.6425) + (walking && !reduced ? Math.abs(swing) * 0.035 : 0);
    torso.position.y = breath;
    torso.rotation.x = bow * 0.9;
    head.rotation.x = bow * 0.16;
    skirt.scale.y = sitting ? 0.55 : 1;
    skirt.scale.z = sitting ? 0.4 : 1;
    skirt.rotation.x = sitting ? -Math.PI / 2 : swing * 0.08;
    for (let i = 0; i < 2; i++) {
      const sign = i ? 1 : -1;
      legs[i].rotation.set(sitting ? -Math.PI / 2 : sign * swing, 0, sitting && !bench ? sign * 0.88 : 0);
      knees[i].rotation.set(sitting ? bench ? Math.PI / 2 : 3 : Math.max(0, -sign * swing) * 0.5, 0, sitting && !bench ? -sign * 0.6 : 0);
      const prayer = !walking;
      arms[i].rotation.set(prayer ? -0.28 : -sign * swing, 0, prayer ? -sign * 0.30 : sign * 0.06);
      elbows[i].rotation.set(prayer ? -0.8 : -0.12, 0, prayer ? -sign * 0.78 : 0);
    }
    // Khi nói chỉ hơi nghiêng đầu; chế độ giảm chuyển động giữ nguyên tư thế.
    head.rotation.z = state.talk && !reduced ? Math.sin(elapsed * 5) * 0.025 : 0;
    aura.visible = halo.visible = !!state.aura;
    const auraColor = typeof state.aura === 'string' ? state.aura : state.aura?.color;
    auraMaterial.color.set(typeof auraColor === 'string' ? auraColor : '#e7bc67');
    auraMaterial.opacity = reduced ? 0.65 : 0.60 + Math.sin(elapsed * 2) * 0.10;
    const name = textOf(state.name, 48).trim(), tag = textOf(state.tag, 64).trim();
    const speech = textOf(typeof state.bubble === 'string' ? state.bubble : state.bubble?.text, 180).trim();
    nameplate.set(name, tag);
    bubble.set(speech);
    nameplate.sprite.visible = !first && !!name && !!nameplate.sprite.material.map;
    bubble.sprite.visible = !first && !!speech && !!bubble.sprite.material.map;
    const top = hips.position.y + 1.10 - bow * 0.24;
    nameplate.sprite.position.set(0, top, 0);
    bubble.sprite.position.set(0, top + (state.tag ? 0.55 : 0.46), 0);
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    group.removeFromParent();
    nameplate.dispose(); bubble.dispose();
    geometries.forEach(value => value.dispose());
    materials.forEach(value => value.dispose());
    group.clear();
  }
  setLook(initialLook);
  update(opts.state || {}, 0);
  return { group, update, setLook(nextLook) { setLook(nextLook); update(lastState, 0); }, dispose };
}
