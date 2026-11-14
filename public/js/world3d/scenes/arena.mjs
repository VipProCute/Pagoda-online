'use strict';

import { makeAvatar } from '../avatar-glb.mjs?v=7';

// Cảnh khu đi lại, không phải sàn PK. ctx: { THREE, kit, size: ViewMath.SCENE_SIZE.arena,
// quality: 'low'|'medium'|'high', reduceMotion }. Không đọc socket, không đổi trạng thái game.
// update nhận ảnh chụp đầy đủ { me: id, view: 'first'|'third', players: [
//   { id, x, z, look:{g,c,h}, name, tag, walking, yaw, sit, bow, aura, bubble }
// ] }. x,z là tọa độ sàn 0..1 đã nội suy; chỉ dùng id công khai, không cần uid.
// pick → { kind:'person', id } | { kind:'floor', x, z } | null (vật trang trí/trời).
// surfaceHeight(x,z) bổ sung độ cao hiển thị cho máy quay; không tạo luật va chạm.
// dispose chỉ dọn tài nguyên cảnh; chủ World3D gọi kit.disposeKit khi mọi cảnh đã tháo.
const PLATFORM = Object.freeze({ x0: 0.28, x1: 0.72, z0: 0.24, z1: 0.6, height: 0.54 });
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

export function build(ctx) {
  const { THREE, kit, size } = ctx;
  if (!size || !Number.isFinite(size.width) || !Number.isFinite(size.depth) || size.width <= 0 || size.depth <= 0) {
    throw new TypeError('Cảnh Sân đấu cần kích thước từ ViewMath.SCENE_SIZE.arena.');
  }
  const { width, depth } = size;
  const quality = ['low', 'medium', 'high'].includes(ctx.quality) ? ctx.quality : 'medium';
  const shadows = quality !== 'low';
  const group = new THREE.Group(); group.name = 'arena-yard';
  const resources = new Set(), kitGeometries = new Set(), prototypes = new Map(), people = new Map();
  const solids = [], flags = [], lamps = [];
  let disposed = false, elapsed = 0;
  const keep = resource => { resources.add(resource); return resource; };
  const material = (color, extra = {}) => keep(new THREE.MeshStandardMaterial({ color, roughness: 0.88, ...extra }));
  const stone = material('#988d78'), darkStone = material('#514d43');
  const pale = material('#e1cda0'), gold = material('#bd9146', { metalness: 0.48, roughness: 0.4 });
  const red = material('#802e25'), wood = material('#65432e');
  const world = (x, z) => [(x - 0.5) * width, (z - 0.5) * depth];
  function place(object, x, z, y = 0) {
    const [wx, wz] = world(x, z); object.position.set(wx, y, wz); group.add(object); return object;
  }
  function mesh(geometry, mat, x, y, z, name, floor = false) {
    const object = new THREE.Mesh(keep(geometry), mat);
    object.name = name; object.position.set(x, y, z);
    object.castShadow = shadows; object.receiveShadow = shadows;
    if (floor) object.userData.floor = true;
    group.add(object); solids.push(object); return object;
  }
  function box(w, h, d, mat, x, y, z, name, floor = false) {
    return mesh(new THREE.BoxGeometry(w, h, d), mat, x, y, z, name, floor);
  }
  // Mỗi loại khối chỉ dựng một lần; bản sao chia sẻ geometry và vật liệu của kit.
  function piece(name, create) {
    if (!prototypes.has(name)) {
      const source = create();
      source.traverse(object => { if (object.geometry) kitGeometries.add(object.geometry); });
      prototypes.set(name, source);
    }
    const object = prototypes.get(name).clone(true);
    object.traverse(child => {
      if (child.isMesh) { child.castShadow = shadows; child.receiveShadow = shadows; }
    });
    group.add(object); solids.push(object); return object;
  }

  // Trời và nền ngoài tường kín mọi hướng, kể cả khi nhìn lên ở góc thứ nhất.
  const skyMaterial = keep(new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: { top: { value: new THREE.Color('#718f9b') }, horizon: { value: new THREE.Color('#eed1a3') } },
    vertexShader: 'varying vec3 vDirection; void main(){vDirection=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: 'uniform vec3 top; uniform vec3 horizon; varying vec3 vDirection; void main(){float h=smoothstep(-0.08,0.85,normalize(vDirection).y); gl_FragColor=vec4(mix(horizon,top,h),1.0);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}'
  }));
  const sky = new THREE.Mesh(keep(new THREE.SphereGeometry(110, 24, 16)), skyMaterial);
  sky.name = 'sky'; sky.renderOrder = -10; group.add(sky);
  const landscape = material('#657564');
  mesh(new THREE.CylinderGeometry(85, 85, 0.3, 48), landscape, 0, -0.3, 0, 'landscape');
  const mountain = material('#778e85', { flatShading: true });
  for (let i = 0; i < 14; i++) {
    const angle = i * Math.PI * 2 / 14;
    mesh(new THREE.ConeGeometry(12 + i % 3, 10 + i % 4 * 2, 5), mountain,
      Math.cos(angle) * 56, 1, Math.sin(angle) * 56, 'mountain');
  }

  // Sân đá có mạch nhỏ và biến sắc xác định, không cần ảnh hay RNG.
  box(width + 0.7, 0.16, depth + 0.7, darkStone, 0, -0.09, 0, 'floor', true);
  const columns = 20, rows = 14;
  const tiles = new THREE.InstancedMesh(keep(new THREE.BoxGeometry(width / columns - 0.025, 0.035, depth / rows - 0.025)), stone, columns * rows);
  const matrix = new THREE.Matrix4(), color = new THREE.Color();
  for (let row = 0; row < rows; row++) for (let col = 0; col < columns; col++) {
    const index = row * columns + col;
    matrix.makeTranslation((col + 0.5) * width / columns - width / 2, -0.0175, (row + 0.5) * depth / rows - depth / 2);
    tiles.setMatrixAt(index, matrix);
    tiles.setColorAt(index, color.setHSL(0.105, 0.13, 0.64 + ((col * 7 + row * 11) % 5) * 0.016));
  }
  tiles.name = 'paving'; tiles.userData.floor = true; tiles.receiveShadow = shadows;
  group.add(tiles); solids.push(tiles); keep(tiles);

  function wallRun(length, x, z, angle) {
    const count = Math.ceil(length / 2.4), segment = length / count;
    for (let i = 0; i < count; i++) {
      const offset = -length / 2 + (i + 0.5) * segment;
      const wall = piece('wall', () => kit.createWall(quality));
      wall.scale.x = segment / 2.4 + 0.012;
      wall.rotation.y = angle; wall.position.set(x + Math.cos(angle) * offset, 0, z - Math.sin(angle) * offset);
    }
    const roof = piece('wall-roof-' + length, () => kit.roof({ width: length + 0.3, depth: 0.64, quality }));
    roof.position.set(x, 2.32, z); roof.rotation.y = angle; roof.scale.y = 0.5;
  }
  wallRun(depth + 0.5, -width / 2 - 0.12, 0, Math.PI / 2);
  wallRun(depth + 0.5, width / 2 + 0.12, 0, Math.PI / 2);
  wallRun(width + 0.5, 0, depth / 2 + 0.12, 0);
  const wing = width / 2 - 3.05;
  for (const sign of [-1, 1]) wallRun(wing, sign * (3.05 + wing / 2), -depth / 2, 0);
  place(piece('gate', () => kit.createGate(quality)), 0.5, 0.012);
  const door = place(piece('door', () => kit.createDoor(quality)), 0.5, 0.01);
  door.scale.set(1.22, 1.35, 1);
  for (const sign of [-1, 1]) {
    const sideDoor = piece('door', () => kit.createDoor(quality));
    sideDoor.scale.set(0.64, 1.17, 1); sideDoor.position.set(sign * 1.91, 0, -depth / 2 + 0.1);
  }
  // Biển tên chỉ là chữ do dự án viết; Node không cần canvas để dựng hoặc pick.
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas'); canvas.width = 768; canvas.height = 160;
    const c = canvas.getContext('2d');
    if (c) {
      c.fillStyle = '#682b23'; c.fillRect(0, 0, 768, 160);
      c.strokeStyle = '#d6b56f'; c.lineWidth = 4; c.strokeRect(12, 12, 744, 136);
      c.fillStyle = '#f5dd9f'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.font = 'bold 66px Georgia, serif'; c.fillText('LUẬN VÕ ĐƯỜNG', 384, 83, 714);
      const texture = keep(new THREE.CanvasTexture(canvas)); texture.colorSpace = THREE.SRGBColorSpace;
      const sign = mesh(new THREE.PlaneGeometry(2.48, 0.51), keep(new THREE.MeshBasicMaterial({ map: texture })),
        0, 3.22, -depth / 2 + 0.48, 'sign');
      sign.castShadow = false;
    }
  }
  for (const [x, z, scale] of [[0.05, -0.12, 1.35], [0.23, -0.19, 1.1], [0.77, -0.16, 1.25], [0.97, -0.13, 1.5]]) {
    const tree = place(piece('tree', () => kit.createBodhiTree(quality)), x, z); tree.scale.setScalar(scale);
  }

  const pw = (PLATFORM.x1 - PLATFORM.x0) * width, pd = (PLATFORM.z1 - PLATFORM.z0) * depth;
  const pz = ((PLATFORM.z0 + PLATFORM.z1) / 2 - 0.5) * depth, py = PLATFORM.height;
  box(pw, py - 0.08, pd, darkStone, 0, (py - 0.08) / 2, pz, 'platform-base', true);
  box(pw, 0.08, pd, stone, 0, py - 0.04, pz, 'platform', true);
  for (const sign of [-1, 1]) {
    box(pw, 0.035, 0.055, gold, 0, py + 0.005, pz + sign * (pd / 2 - 0.04), 'platform-inlay', true);
    box(0.055, 0.035, pd, gold, sign * (pw / 2 - 0.04), py + 0.005, pz, 'platform-inlay', true);
    box(pw, 0.06, 0.04, red, 0, 0.19, pz + sign * (pd / 2 + 0.006), 'platform-trim');
  }
  const steps = piece('steps', () => kit.createSteps(quality));
  steps.position.set(0, 0, (PLATFORM.z1 - 0.5) * depth + 0.58);
  steps.traverse(object => { if (object.isMesh) object.userData.floor = true; });
  for (let i = 1; i < 9; i++) box(pw - 0.2, 0.004, 0.012, darkStone, 0, py + 0.003, pz - pd / 2 + i * pd / 9, 'platform-joint', true);

  function disc(radius, mat, x, z, y) {
    const object = mesh(new THREE.CircleGeometry(radius, quality === 'low' ? 32 : 64), mat, x, y, z, 'taiji', true);
    object.rotation.x = -Math.PI / 2; object.castShadow = false; return object;
  }
  // Thái cực khảm đá, mỗi lớp nhích cao để không tranh bộ đệm chiều sâu.
  const radius = width * 0.085;
  disc(radius, pale, 0, pz, py + 0.012);
  const half = mesh(new THREE.CircleGeometry(radius, 48, -Math.PI / 2, Math.PI), darkStone, 0, py + 0.014, pz, 'taiji', true);
  half.rotation.x = -Math.PI / 2; half.castShadow = false;
  disc(radius / 2, pale, 0, pz - radius / 2, py + 0.016);
  disc(radius / 2, darkStone, 0, pz + radius / 2, py + 0.018);
  disc(radius * 0.12, darkStone, 0, pz - radius / 2, py + 0.020);
  disc(radius * 0.12, pale, 0, pz + radius / 2, py + 0.022);

  for (const [x, z] of [[0.28, 0.24], [0.72, 0.24], [0.28, 0.6], [0.72, 0.6]]) {
    const flag = place(piece('banner', () => kit.createBanner(quality)), x, z, py);
    flag.rotation.y = x < 0.5 ? -0.22 : 0.22;
    // Chỉ phần vải uốn nhẹ; cột và chân đá đứng yên.
    flag.traverse(child => {
      if (child.isMesh && ['fabric', 'cushion', 'blue', 'ivory', 'green'].includes(child.material.name)) {
        child.geometry = keep(child.geometry.clone());
        flags.push({ mesh: child, base: child.geometry.attributes.position.array.slice() });
      }
    });
  }
  for (const [a, b] of [[[0.28, 0.24], [0.72, 0.24]], [[0.28, 0.24], [0.28, 0.6]], [[0.72, 0.24], [0.72, 0.6]]]) {
    const [ax, az] = world(...a), [bx, bz] = world(...b);
    const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(ax, py + 0.98, az),
      new THREE.Vector3((ax + bx) / 2, py + 0.63, (az + bz) / 2), new THREE.Vector3(bx, py + 0.98, bz));
    mesh(new THREE.TubeGeometry(curve, 16, 0.025, 5, false), red, 0, 0, 0, 'rope');
  }
  place(piece('weapon-rack', () => kit.createWeaponRack(quality)), 0.1, 0.06);
  place(piece('drum', () => kit.createDrum(quality)), 0.9, 0.07);

  // Mộc nhân và đèn đá của ARENA_PROPS; kit chưa có hai khối này.
  const [dx, dz] = world(0.13, 0.78);
  mesh(new THREE.CylinderGeometry(0.16, 0.21, 1.9, 10), wood, dx, 0.95, dz, 'wooden-dummy');
  box(0.85, 0.10, 0.65, darkStone, dx, 0.05, dz, 'dummy-base');
  for (const [side, y] of [[-1, 1.4], [1, 1.35], [1, 0.86]]) {
    const arm = box(0.58, 0.075, 0.09, wood, dx + side * 0.28, y, dz + 0.12, 'dummy-arm'); arm.rotation.z = side * -0.28;
  }
  const [lx, lz] = world(0.88, 0.8);
  box(0.75, 0.16, 0.75, darkStone, lx, 0.08, lz, 'stone-lamp');
  box(0.22, 0.64, 0.22, stone, lx, 0.48, lz, 'stone-lamp');
  box(0.65, 0.12, 0.65, pale, lx, 0.86, lz, 'stone-lamp');
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(0.07, 0.4, 0.07, stone, lx + sx * 0.25, 1.1, lz + sz * 0.25, 'stone-lamp');
  const lampRoof = piece('lamp-roof', () => kit.roof({ width: 0.85, depth: 0.85, quality })); lampRoof.position.set(lx, 1.25, lz);
  const flame = material('#ffd48a', { emissive: '#ffb64b', emissiveIntensity: 1.2 });
  mesh(new THREE.SphereGeometry(0.10, 8, 6), flame, lx, 1.08, lz, 'flame');
  for (const x of [0.33, 0.67]) place(piece('lantern', () => kit.createLantern(quality)), x, 0.018, 1.15);

  group.add(new THREE.HemisphereLight('#ffecd1', '#697563', 2.2));
  const sun = new THREE.DirectionalLight('#ffdaa0', 3.1); sun.position.set(-9, 14, 7);
  sun.castShadow = shadows; sun.shadow.mapSize.set(quality === 'high' ? 2048 : 1024, quality === 'high' ? 2048 : 1024);
  Object.assign(sun.shadow.camera, { left: -width, right: width, top: depth, bottom: -depth, near: 0.5, far: 55 });
  sun.shadow.normalBias = 0.035; sun.shadow.bias = -0.00015; keep(sun.shadow); group.add(sun, sun.target);
  const rim = new THREE.DirectionalLight('#b2c8d0', 0.65); rim.position.set(6, 5, -8); group.add(rim);
  for (const [x, y, z, power] of [[lx, 1.12, lz, 12], [-width * 0.17, 2.3, -depth * 0.482, 16], [width * 0.17, 2.3, -depth * 0.482, 16]]) {
    const light = new THREE.PointLight('#ffb65f', power, 5, 2); light.position.set(x, y, z); group.add(light); lamps.push({ light, power });
  }

  function surfaceHeight(x, z) {
    if (x >= PLATFORM.x0 && x <= PLATFORM.x1 && z >= PLATFORM.z0 && z <= PLATFORM.z1) return py;
    const [wx, wz] = world(x, z), front = (PLATFORM.z1 - 0.5) * depth;
    if (Math.abs(wx) <= 1.2 && wz > front && wz <= front + 1.18) {
      return wz <= front + 0.38 ? 0.54 : wz <= front + 0.78 ? 0.36 : 0.18;
    }
    return 0;
  }
  const hitGeometry = keep(new THREE.CylinderGeometry(0.32, 0.32, 1.65, 8));
  const hitMaterial = keep(new THREE.MeshBasicMaterial({ visible: false }));
  const personPosition = new THREE.Vector3();
  function update(state = {}, dt = 0) {
    if (disposed) return;
    const reduced = !!(ctx.reduceMotion ?? ctx.reducedMotion);
    const step = Number.isFinite(dt) ? clamp(dt, 0, 0.1) : 0;
    if (!reduced) elapsed += step;
    for (const flag of flags) {
      const attribute = flag.mesh.geometry.attributes.position;
      for (let i = 0; i < attribute.count; i++) {
        const x = flag.base[i * 3], y = flag.base[i * 3 + 1];
        attribute.setZ(i, flag.base[i * 3 + 2] + (reduced ? 0 : Math.sin(elapsed * 2.4 + x * 3 + y) * (2.95 - y) * 0.035));
      }
      attribute.needsUpdate = true;
    }
    for (const lamp of lamps) lamp.light.intensity = lamp.power * (reduced ? 1 : 1 + Math.sin(elapsed * 3.2) * 0.025);
    const list = (Array.isArray(state.players) ? state.players : []).filter(player => player &&
      ['number', 'string'].includes(typeof player.id) && Number.isFinite(player.x) && Number.isFinite(player.z));
    const cam = ctx.camera?.position, SM = globalThis.StandMath;
    group.updateWorldMatrix(true, false);
    const distances = new Map(list.map(player => {
      const [wx, wz] = world(clamp(player.x, 0, 1), clamp(player.z, 0, 1));
      personPosition.set(wx, 0, wz); group.localToWorld(personPosition);
      return [player.id, cam ? Math.hypot(personPosition.x - cam.x, personPosition.z - cam.z) : Infinity];
    }));
    const slots = SM ? SM.fxSlots(list.map(player => ({ id: player.id, distance: distances.get(player.id),
      demon: !!player.demon, aura: !!player.aura, merit: Number(player.meritRank) > 0 })), state.me, quality) : null;
    const seen = new Set();
    for (const player of list) {
      if (seen.has(player.id)) continue;
      seen.add(player.id);
      let entry = people.get(player.id);
      if (!entry) {
        const avatar = makeAvatar(player.look, { reducedMotion: reduced });
        const hit = new THREE.Mesh(hitGeometry, hitMaterial); hit.userData.person = player.id;
        group.add(avatar.group, hit); entry = { avatar, hit, look: '' }; people.set(player.id, entry);
        avatar.group.traverse(object => { if (object.isMesh) { object.castShadow = shadows; object.receiveShadow = shadows; } });
      }
      const look = JSON.stringify([player.look?.g, player.look?.c, player.look?.h]);
      if (entry.look !== look) { entry.avatar.setLook(player.look); entry.look = look; }
      const x = clamp(player.x, 0, 1), z = clamp(player.z, 0, 1), [wx, wz] = world(x, z);
      const y = surfaceHeight(x, z), self = player.id === state.me;
      entry.avatar.group.position.set(wx, y, wz); entry.hit.position.set(wx, y + 0.825, wz);
      entry.hit.userData.enabled = !self;
      const s = slots?.get(player.id);
      const fx = { distance: distances.get(player.id), slot: s ? s.slot : true, ...(s ? { slots: { demon: s.demon, aura: s.aura, merit: s.merit } } : {}) };
      entry.avatar.group.userData.fx = fx;
      entry.avatar.update({ ...player, isSelf: self, view: state.view || 'third', reducedMotion: reduced, quality,
        ...(state.now === undefined ? {} : { now: state.now }), fx }, step);
    }
    for (const [id, entry] of people) if (!seen.has(id)) {
      entry.avatar.dispose(); entry.hit.removeFromParent(); people.delete(id);
    }
    group.updateMatrixWorld(true);
  }
  function pick(raycaster) {
    if (disposed) return null;
    group.updateWorldMatrix(true, true);
    const targets = solids.concat([...people.values()].filter(entry => entry.hit.userData.enabled).map(entry => entry.hit));
    const hit = raycaster.intersectObjects(targets, true)[0];
    if (!hit) return null;
    if (hit.object.userData.person !== undefined) return { kind: 'person', id: hit.object.userData.person };
    if (!hit.object.userData.floor) return null;
    const local = group.worldToLocal(hit.point.clone());
    return { kind: 'floor', x: clamp(local.x / width + 0.5, 0.03, 0.97), z: clamp(local.z / depth + 0.5, 0.12, 0.97) };
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    for (const entry of people.values()) entry.avatar.dispose();
    people.clear();
    for (const geometry of kitGeometries) geometry.dispose();
    for (const resource of resources) resource.dispose();
    resources.clear(); kitGeometries.clear(); prototypes.clear(); solids.length = flags.length = lamps.length = 0;
    group.removeFromParent(); group.clear();
  }
  update();
  return { group, update, pick, surfaceHeight, dispose,
    // Biên máy quay bao hết miền đi lại 0.03..0.97, vẫn ở phía trong tường.
    bounds: { minX: -width / 2 + 0.2, maxX: width / 2 - 0.2, minZ: -depth / 2 + 0.2, maxZ: depth / 2 - 0.2 } };
}
