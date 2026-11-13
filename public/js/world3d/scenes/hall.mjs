'use strict';

/* Cảnh tự đứng, không gọi socket, không tự quyết trạng thái trò chơi.
 * ctx = { THREE, kit, size: ViewMath.SCENE_SIZE.hall, quality, reduceMotion }.
 * update({ now: mili giây giờ máy chủ, altar: { lotus, rose, lamp, fruit },
 *   incense: [{ id, pid, x: -1..1, tilt: radian, litAt, until }] }, dt: giây).
 * Mỗi lần update là ảnh chụp đầy đủ; thiếu trường tương đương bàn thờ trống.
 * Người chơi do lớp T-088 dựng bằng avatar.mjs, không thuộc cảnh này.
 * pick trả kind bowl/statue/lib/jar/floor và x,z sàn; ánh xạ handler 2D:
 * bowl → altar, lib → library, jar → fortune; chuông/mõ chỉ là trang trí.
 * Đối chiếu geo/proj/drawBg ở hall.js với khung chuẩn 960×600:
 * chân tượng z=-22/300, bàn thờ z=22/300, hai tượng x=.18/.82;
 * ống xăm x=.5+71/691.2, cùng mặt bàn; tủ trái x≈-.108, z=2/300.
 * Các z âm và tủ ngoài x=0 là vách/hiên, không phải vùng đi lại mới.
 */

export function build({ THREE, kit, size, quality = 'medium', reduceMotion = false }) {
  const { width, depth } = size;
  const group = new THREE.Group(); group.name = 'hall';
  const geometries = new Set(), materials = new Set(), textures = new Set();
  const shadows = quality === 'high';
  let disposed = false, elapsed = 0;
  const world = (x, z) => [(x - 0.5) * width, (z - 0.5) * depth];
  const bounded = (n, max) => Math.min(max, Math.max(0, Number.isFinite(n) ? n : 0));
  const ownGeometry = geometry => { geometries.add(geometry); return geometry; };
  function material(color, extra = {}) {
    const value = new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...extra });
    materials.add(value); return value;
  }
  const wood = material(0x49271e), gold = material(0xcba25b, { metalness: 0.55, roughness: 0.38 });
  const red = material(0x651e21), stone = material(0x756755), ceiling = material(0x332820);
  const pink = material(0xe7a1ad), rose = material(0xc6435a);
  const green = material(0x58744c), jade = material(0x6c9c92), fruit = material(0xd49c35);
  const flame = material(0xffdc91, { emissive: 0xff9c37, emissiveIntensity: 1.7 });
  const ash = material(0xb89466), incenseRed = material(0x9c3326);
  const unitBox = ownGeometry(new THREE.BoxGeometry(1, 1, 1));
  const unitBall = ownGeometry(new THREE.SphereGeometry(1, quality === 'low' ? 6 : 10, 6));
  const unitStem = ownGeometry(new THREE.CylinderGeometry(1, 1, 1, 5));

  function mesh(geometry, mat, x, y, z, sx = 1, sy = 1, sz = 1, parent = group) {
    const object = new THREE.Mesh(geometry, mat);
    object.position.set(x, y, z); object.scale.set(sx, sy, sz);
    object.castShadow = shadows; object.receiveShadow = shadows; parent.add(object); return object;
  }
  const box = (mat, x, y, z, w, h, d, parent) => mesh(unitBox, mat, x, y, z, w, h, d, parent);
  function place(create, x, z, y = 0, scale = 1, kind) {
    const object = create(quality), [wx, wz] = world(x, z);
    object.position.set(wx, y, wz); object.scale.setScalar(scale);
    if (kind) object.userData.pick = { kind, x, z };
    group.add(object); return object;
  }
  function label(text, x, y, z, w, h) {
    const plaque = new THREE.Group(); group.add(plaque);
    box(gold, x, y, z, w + 0.08, h + 0.08, 0.08, plaque);
    box(red, x, y, z + 0.05, w, h, 0.035, plaque);
    if (typeof document !== 'undefined') {
      const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 160;
      const c = canvas.getContext('2d');
      c.fillStyle = '#651e21'; c.fillRect(0, 0, 1024, 160);
      c.fillStyle = '#efcf88'; c.font = '500 72px Georgia, serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(text, 512, 85, 970);
      const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; textures.add(texture);
      const mat = new THREE.MeshBasicMaterial({ map: texture }); materials.add(mat);
      mesh(ownGeometry(new THREE.PlaneGeometry(w, h)), mat, x, y, z + 0.071, 1, 1, 1, plaque);
    }
    return plaque;
  }

  // Sàn và vỏ kín vượt nhẹ miền đi lại để chứa tủ trái và ba tòa sen của 2D.
  const left = -0.20 * width - width / 2, right = 0.55 * width;
  const back = -0.73 * depth, front = 0.56 * depth, height = 6.4;
  const centerX = (left + right) / 2, centerZ = (back + front) / 2;
  const spanX = right - left, spanZ = front - back;
  box(stone, centerX, -0.13, centerZ, spanX, 0.24, spanZ).userData.pick = { kind: 'floor' };
  const tiles = new THREE.InstancedMesh(unitBox, material(0x754735), 28 * 20);
  const transform = new THREE.Object3D();
  for (let i = 0; i < 28; i++) for (let j = 0; j < 20; j++) {
    transform.position.set(left + (i + 0.5) * spanX / 28, -0.014, back + (j + 0.5) * spanZ / 20);
    transform.scale.set(spanX / 28 - 0.018, 0.025, spanZ / 20 - 0.018); transform.updateMatrix();
    tiles.setMatrixAt(i * 20 + j, transform.matrix);
    tiles.setColorAt(i * 20 + j, new THREE.Color([0x87513b, 0x754735, 0x935d43][(i * 7 + j * 11) % 3]));
  }
  tiles.receiveShadow = shadows; tiles.userData.pick = { kind: 'floor' }; group.add(tiles);
  const carpet = box(red, 0, 0.006, 0, width * 0.20, 0.012, depth);
  carpet.userData.pick = { kind: 'floor' };
  for (const x of [-0.09, 0.09]) box(gold, x * width, 0.014, 0, 0.025, 0.009, depth).userData.pick = { kind: 'floor' };
  for (const z of [back, front]) {
    const wall = kit.createWall(quality); wall.scale.set(spanX / 2.4, height / 2.3, 1.6);
    wall.position.set(centerX, 0, z); group.add(wall);
  }
  for (const x of [left, right]) {
    const wall = kit.createWall(quality); wall.scale.set(spanZ / 2.4, height / 2.3, 1.6);
    wall.rotation.y = Math.PI / 2; wall.position.set(x, 0, centerZ); group.add(wall);
  }
  box(ceiling, centerX, height + 0.06, centerZ, spanX, 0.16, spanZ);
  const roof = kit.roof({ width: spanX + 1.6, depth: spanZ + 1.6, tiers: 2, quality });
  roof.position.set(centerX, height + 0.15, centerZ); group.add(roof);
  for (const z of [-0.60, -0.20, 0.20, 0.50]) {
    box(wood, centerX, height - 0.18, z * depth, spanX, 0.32, 0.26);
    box(gold, centerX, height - 0.37, z * depth, spanX, 0.035, 0.28);
  }
  for (const x of [-0.50, -0.17, 0.17, 0.50]) {
    box(wood, x * width, height - 0.05, centerZ, 0.18, 0.25, spanZ);
    // Hàng cột của 2D, thêm hàng phía cửa để tạo chiều sâu.
    for (const z of [0.015, 0.66]) {
      const column = place(kit.createColumn, x + 0.5, z);
      column.scale.set(1.55, height / 2.68, 1.55);
    }
  }
  for (const x of [-0.37, 0, 0.37]) {
    const door = place(kit.createDoor, x + 0.5, 1.045); door.scale.set(2.5, 1.7, 1);
  }

  // Hậu cung ba tượng: hai tượng phụ thấp hơn, đối xứng quanh tượng chính.
  for (const [x, scale] of [[0.18, 1.25], [0.5, 1.60], [0.82, 1.25]]) {
    const [wx, wz] = world(x, -22 / 300);
    box(wood, wx, 0.24, wz, scale * 2.2, 0.48, 1.9);
    box(gold, wx, 0.49, wz, scale * 2.24, 0.05, 1.95);
    place(kit.createBuddhaStatue, x, -22 / 300, 0.52, scale, 'statue');
  }
  label('TỪ BI HỶ XẢ', 0, 5.55, back + 0.30, 5.7, 0.80);
  const altarZ = 22 / 300, [, altarWorldZ] = world(0.5, altarZ);
  const altar = place(kit.createAltar, 0.5, altarZ, 0, 1, 'bowl'); altar.scale.x = width * 0.62 / 2.84;
  const bowl = place(kit.createIncenseBowl, 0.5, altarZ, 1.13, 2.1, 'bowl');
  // Bỏ nhang trang trí cố định của kit, chỉ hiện nhang từ ảnh chụp trạng thái.
  for (const child of [...bowl.children]) if (['fabric', 'woodLight', 'flame'].includes(child.material?.name)) {
    bowl.remove(child); child.geometry.dispose();
  }
  const jarX = 0.5 + 71 / 691.2;
  place(kit.createFortuneTube, jarX, altarZ, 1.13, 1.15, 'jar');
  place(kit.createBellStand, 0.90, 0.14, 0, 0.9);
  const fish = place(kit.createWoodenFish, 0.78, 0.19, 0.65, 1.2);
  box(wood, fish.position.x, 0.31, fish.position.z, 1.65, 0.62, 1.15);
  const libX = -0.108, libZ = 2 / 300;
  const library = place(kit.createBookshelf, libX, libZ, 0, 1.1, 'lib');
  const libraryRoof = kit.roof({ width: 2.7, depth: 1.3, quality });
  libraryRoof.position.set(library.position.x, 2.6, library.position.z); group.add(libraryRoof);
  libraryRoof.userData.pick = { kind: 'lib', x: libX, z: libZ };
  const libSign = label('TÀNG KINH CÁC', library.position.x, 2.85, library.position.z + 0.42, 2.55, 0.39);
  libSign.userData.pick = { kind: 'lib', x: libX, z: libZ };

  // Hai đèn bàn, bốn đèn lồng; tổng cộng bốn nguồn sáng điểm.
  for (const sign of [-1, 1]) {
    const x = sign * width * 0.192;
    place(kit.createOilLamp, x / width + 0.5, altarZ, 1.13, 1.15, 'bowl');
    const light = new THREE.PointLight(0xffb85e, 38, 10, 2);
    light.position.set(x, 2.1, altarWorldZ + 0.6); group.add(light);
  }
  for (const z of [0.05, 0.64]) for (const x of [0.09, 0.91]) {
    place(kit.createLantern, x, z, 3.65, 1.15);
    if (z === 0.64) {
      const [wx, wz] = world(x, z), light = new THREE.PointLight(0xffa55c, 32, 12, 2);
      light.position.set(wx, 4.95, wz); group.add(light);
    }
  }
  group.add(new THREE.HemisphereLight(0xffe5b9, 0x49352b, 1.6));
  const key = new THREE.DirectionalLight(0xffe0a2, 2.5); key.position.set(-3, 5.4, 1.3);
  key.target.position.set(0, 2, altarWorldZ); key.castShadow = shadows;
  Object.assign(key.shadow.camera, { left: -11, right: 11, top: 9, bottom: -9, near: 0.1, far: 24 });
  key.shadow.mapSize.set(1024, 1024); key.shadow.normalBias = 0.035;
  group.add(key, key.target);
  const fill = new THREE.DirectionalLight(0xb9c9d3, 0.65); fill.position.set(5, 3, 4); group.add(fill);

  // Lễ vật đổi hoa và đèn, không tạo thêm đối tượng mỗi khung hình.
  const buds = [], roses = [], lamps = [], fruits = [];
  for (const sign of [-1, 1]) {
    const x = sign * width * 0.267;
    mesh(unitBall, jade, x, 1.43, altarWorldZ, 0.23, 0.35, 0.22).userData.pick = { kind: 'bowl', x: 0.5, z: altarZ };
    for (let i = 0; i < 7; i++) {
      const flower = new THREE.Group(); flower.name = 'offering-lotus';
      flower.userData.pick = { kind: 'bowl', x: 0.5, z: altarZ }; group.add(flower);
      const dx = (i % 3 - 1) * 0.17, y = 1.95 + (i % 3) * 0.14;
      mesh(unitStem, green, x + dx / 2, (y + 1.5) / 2, altarWorldZ, 0.012, y - 1.5, 0.012, flower);
      for (let j = 0; j < 5; j++) {
        const angle = j * Math.PI * 2 / 5;
        mesh(unitBall, pink, x + dx + Math.cos(angle) * 0.065, y, altarWorldZ + Math.sin(angle) * 0.065, 0.06, 0.14, 0.06, flower);
      }
      buds.push({ object: flower, index: i });
    }
    const offering = place(kit.createOfferings, 0.5 + sign * 0.112, altarZ - 0.035, 1.13, 0.9);
    offering.userData.pick = { kind: 'bowl', x: 0.5, z: altarZ };
  }
  for (let i = 0; i < 14; i++) {
    const sign = i % 2 ? 1 : -1, x = sign * (1.35 + Math.floor(i / 2) * 0.30);
    const flower = mesh(unitBall, rose, x, 1.2, altarWorldZ + 0.55, 0.12, 0.07, 0.12);
    flower.name = 'offering-rose';
    flower.userData.pick = { kind: 'bowl', x: 0.5, z: altarZ }; roses.push(flower);
  }
  for (let i = 0; i < 12; i++) {
    lamps.push(place(kit.createOilLamp, 0.5, 32 / 300, 0.015, 0.8));
    const extraFruit = mesh(unitBall, fruit, (i % 4 - 1.5) * 0.28, 1.9 + Math.floor(i / 4) * 0.17, altarWorldZ - 0.35, 0.13, 0.13, 0.13);
    extraFruit.name = 'offering-fruit';
    extraFruit.userData.pick = { kind: 'bowl', x: 0.5, z: altarZ }; fruits.push(extraFruit);
  }
  const stems = new THREE.InstancedMesh(unitStem, ash, 45);
  const feet = new THREE.InstancedMesh(unitStem, incenseRed, 45);
  const embers = new THREE.InstancedMesh(unitBall, flame, 45);
  stems.name = 'incense-stems'; feet.name = 'incense-feet'; embers.name = 'incense-embers';
  for (const node of [stems, feet, embers]) {
    node.count = 0; node.frustumCulled = false; node.userData.pick = { kind: 'bowl', x: 0.5, z: altarZ }; group.add(node);
  }
  let smoke;
  if (quality === 'high' && !reduceMotion) {
    const geometry = ownGeometry(new THREE.BufferGeometry());
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(45 * 8 * 3), 3));
    const mat = new THREE.PointsMaterial({ color: 0xd2c5ae, size: 0.065, transparent: true, opacity: 0.19, depthWrite: false });
    materials.add(mat); smoke = new THREE.Points(geometry, mat); smoke.frustumCulled = false;
    smoke.name = 'incense-smoke';
    geometry.setDrawRange(0, 0); group.add(smoke);
  }
  group.traverse(node => {
    if (node.isMesh) { node.castShadow = shadows; node.receiveShadow = shadows; }
    if (node.geometry) geometries.add(node.geometry);
  });

  function update(state = {}, dt = 0) {
    if (disposed) return;
    if (!reduceMotion) elapsed += bounded(dt, 0.1);
    const offerings = state.altar || {};
    const budCount = Math.min(7, 2 + Math.ceil(Math.log2(1 + bounded(offerings.lotus, 1e6)) * 1.3));
    buds.forEach(({ object, index }) => { object.visible = index < budCount; });
    roses.forEach((node, i) => { node.visible = i < bounded(offerings.rose, 14); });
    fruits.forEach((node, i) => { node.visible = i < bounded(offerings.fruit, 12); });
    const lampCount = Math.floor(bounded(offerings.lamp, 12));
    lamps.forEach((node, i) => {
      node.visible = i < lampCount;
      node.position.x = lampCount < 2 ? 0 : width * 0.285 * (2 * i / (lampCount - 1) - 1);
    });
    const now = Number.isFinite(state.now) ? state.now : 0;
    const list = (Array.isArray(state.incense) ? state.incense : []).slice(-45)
      .filter(stick => stick && Number.isFinite(stick.litAt) && Number.isFinite(stick.until) && stick.until > stick.litAt && now >= stick.litAt && now < stick.until);
    stems.count = feet.count = embers.count = list.length;
    const smokePositions = smoke?.geometry.attributes.position;
    list.forEach((stick, i) => {
      const progress = (now - stick.litAt) / (stick.until - stick.litAt), length = 1.5 * (1 - 0.74 * progress);
      const tilt = THREE.MathUtils.clamp(Number.isFinite(stick.tilt) ? stick.tilt : 0, -0.5, 0.5);
      const x = THREE.MathUtils.clamp(Number.isFinite(stick.x) ? stick.x : 0, -1, 1) * 0.48;
      const z = altarWorldZ + Math.sin(i * 12.9898) * 0.12, base = 1.83;
      transform.rotation.set(0, 0, -tilt);
      for (const [node, offset, h, r] of [[feet, 0.14, 0.28, 0.012], [stems, (length + 0.28) / 2, Math.max(0.02, length - 0.28), 0.009]]) {
        transform.position.set(x + Math.sin(tilt) * offset, base + Math.cos(tilt) * offset, z);
        transform.scale.set(r, h, r); transform.updateMatrix(); node.setMatrixAt(i, transform.matrix);
      }
      const tipX = x + Math.sin(tilt) * length, tipY = base + Math.cos(tilt) * length;
      transform.position.set(tipX, tipY, z); transform.scale.setScalar(0.025); transform.updateMatrix(); embers.setMatrixAt(i, transform.matrix);
      if (smokePositions) for (let j = 0; j < 8; j++) {
        const t = (elapsed * 0.22 + j / 8 + i * 0.13) % 1;
        smokePositions.setXYZ(i * 8 + j, tipX + Math.sin(t * 7 + i) * t * 0.28, tipY + t * 1.7, z + Math.cos(t * 6 + i) * t * 0.12);
      }
    });
    for (const node of [stems, feet, embers]) node.instanceMatrix.needsUpdate = true;
    if (smoke) { smoke.geometry.setDrawRange(0, list.length * 8); smokePositions.needsUpdate = true; }
  }
  function pick(raycaster) {
    if (disposed) return null;
    group.updateWorldMatrix(true, true);
    // Tường che vật phía sau; bỏ qua vật đang ẩn trước khi chọn.
    const hits = raycaster.intersectObject(group, true);
    for (const hit of hits) {
      let node = hit.object, visible = true, action;
      while (node) { visible = visible && node.visible; action ||= node.userData.pick; node = node.parent; }
      if (!visible || hit.object.isLight || hit.object.isPoints) continue;
      if (!action) return null;
      if (action.kind !== 'floor') return { ...action };
      const p = group.worldToLocal(hit.point.clone());
      return { kind: 'floor', x: THREE.MathUtils.clamp(p.x / width + 0.5, 0.03, 0.97), z: THREE.MathUtils.clamp(p.z / depth + 0.5, 0.12, 0.97) };
    }
    return null;
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    group.traverse(node => { if (node.isInstancedMesh || node.isLight) node.dispose?.(); });
    geometries.forEach(value => value.dispose()); materials.forEach(value => value.dispose()); textures.forEach(value => value.dispose());
    // Vật liệu dùng chung của kit thuộc bên gọi, không gọi disposeKit ở đây.
    group.removeFromParent(); group.clear();
  }
  update();
  return { group, update, pick, bounds: { minX: left + 0.4, maxX: right - 0.4, minZ: back + 0.4, maxZ: front - 0.4 }, dispose };
}
