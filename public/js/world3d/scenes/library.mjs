'use strict';

/* Cảnh tự đứng, không gọi socket. Tọa độ sàn theo ViewMath.SCENE_SIZE.library.
 * update({ seats: [[x,z], ...] | [{x,z}, ...], daylight?: boolean }, dt: giây).
 * Bồ đoàn 0..7 chỉ lấy tọa độ từ state (LIB_SEATS của hall.js), không tự đoán.
 * Người chơi do lớp nối dựng qua avatar.mjs: sit = chỉ số ghế, yaw = Math.PI
 * để ngồi hướng về bàn kinh phía z nhỏ; cảnh không nhân đôi avatar.
 * pick: seat/index → handlers.seat(index); shelf/read → handlers.read();
 * shelf/dojo → handlers.dojo(); floor/x/z → handlers.floor(x,z).
 * Kệ trái đọc kinh, kệ phải học võ như shelfL/shelfR ở libGeo của hall.js.
 * Cửa phía z lớn chỉ trang trí, chưa thêm handler hay giao thức.
 */
export function build({ THREE, kit, quality = 'medium', reduceMotion = false, size }) {
  const { width, depth } = size;
  const group = new THREE.Group(); group.name = 'library';
  const geometries = new Set(), materials = new Set(), textures = new Set();
  const shadows = quality === 'high';
  const left = -width * 0.56, right = width * 0.56;
  const back = -depth * 0.62, front = depth * 0.77, height = 5.6;
  const spanX = right - left, spanZ = front - back, centerZ = (front + back) / 2;
  let disposed = false;
  function material(color, extra = {}) {
    const value = new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...extra });
    materials.add(value); return value;
  }
  const wood = material(0x49291d), panel = material(0x68402b), dark = material(0x291c16);
  const gold = material(0xb78c47, { metalness: 0.45, roughness: 0.45 });
  const red = material(0x642b23), paper = material(0xddc99c), ink = material(0x776448);
  const straw = material(0x9b8150), plankColors = [0x744b32, 0x81573b, 0x69432e].map(color => new THREE.Color(color));
  const unit = new THREE.BoxGeometry(1, 1, 1); geometries.add(unit);
  function box(name, mat, x, y, z, w, h, d, parent = group) {
    const object = new THREE.Mesh(unit, mat); object.name = name;
    object.position.set(x, y, z); object.scale.set(w, h, d);
    object.castShadow = shadows; object.receiveShadow = shadows; parent.add(object); return object;
  }
  function place(create, x, y, z, rotation = 0, scale = [1, 1, 1]) {
    const object = create(quality); object.position.set(x, y, z);
    object.rotation.y = rotation; object.scale.set(...scale); group.add(object); return object;
  }
  const mark = (object, data) => { object.userData.pick = data; return object; };
  function plaque(text, x, y, z, w, rotation = 0) {
    const sign = new THREE.Group(); sign.position.set(x, y, z); sign.rotation.y = rotation; group.add(sign);
    box('plaque-frame', gold, 0, 0, 0, w + 0.12, 0.56, 0.10, sign);
    box('plaque', red, 0, 0, 0.06, w, 0.45, 0.04, sign);
    if (typeof document !== 'undefined') {
      const canvas = document.createElement('canvas'); canvas.width = 768; canvas.height = 128;
      const c = canvas.getContext('2d'); c.fillStyle = '#642b23'; c.fillRect(0, 0, 768, 128);
      c.fillStyle = '#efd599'; c.font = '500 66px Georgia,serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(text, 384, 68, 730);
      const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; textures.add(texture);
      const mat = new THREE.MeshBasicMaterial({ map: texture }); materials.add(mat);
      const geometry = new THREE.PlaneGeometry(w, 0.45); geometries.add(geometry);
      const face = new THREE.Mesh(geometry, mat); face.position.z = 0.085; sign.add(face);
    }
    return sign;
  }

  // Vỏ gỗ kín và sàn ván so le. Phần cửa rộng phía trước đủ chỗ cho máy quay.
  mark(box('floor', dark, 0, -0.12, centerZ, spanX, 0.24, spanZ), { kind: 'floor' });
  const floorPlanks = mark(new THREE.InstancedMesh(unit, material(0xffffff), 24 * 8), { kind: 'floor' });
  floorPlanks.name = 'floor-planks'; floorPlanks.receiveShadow = shadows; group.add(floorPlanks);
  const transform = new THREE.Object3D();
  for (let i = 0; i < 24; i++) for (let j = 0; j < 8; j++) {
    const x = left + (i + 0.5) * spanX / 24, z = back + (j + 0.5) * spanZ / 8;
    transform.position.set(x, -0.008, z); transform.scale.set(spanX / 24 - 0.012, 0.022, spanZ / 8 - 0.012); transform.updateMatrix();
    floorPlanks.setMatrixAt(i * 8 + j, transform.matrix);
    floorPlanks.setColorAt(i * 8 + j, plankColors[(i * 7 + j) % 3]);
  }
  for (const z of [back, front]) {
    box('wood-wall', panel, 0, height / 2, z, spanX + 0.3, height, 0.28);
    for (let i = 0; i <= 24; i++) box('wall-batten', wood, left + i * spanX / 24, height / 2, z + (z === back ? 0.16 : -0.16), 0.045, height, 0.035);
  }
  for (const x of [left, right]) {
    box('wood-wall', panel, x, height / 2, centerZ, 0.28, height, spanZ);
    box('wall-wainscot', wood, x, 0.42, centerZ, 0.36, 0.84, spanZ);
    box('wall-cornice', gold, x, 4.42, centerZ, 0.38, 0.045, spanZ);
  }
  box('ceiling', dark, 0, height + 0.10, centerZ, spanX, 0.22, spanZ);
  for (let x = left + 0.4; x < right; x += 0.6) box('ceiling-board', panel, x, height - 0.035, centerZ, 0.58, 0.06, spanZ);
  for (const z of [back + 0.6, -2.4, 1.2, 4.8, front - 0.4]) {
    box('ceiling-beam', wood, 0, height - 0.28, z, spanX, 0.44, 0.28);
    box('beam-trim', gold, 0, height - 0.51, z, spanX, 0.035, 0.30);
    for (const x of [left + 1.0, right - 1.0]) {
      place(kit.createColumn, x, 0, z, 0, [1.25, (height - 0.5) / 2.68, 1.25]);
      const brace = box('column-brace', wood, x + (x < 0 ? 0.38 : -0.38), height - 0.8, z, 1.12, 0.14, 0.20);
      brace.rotation.z = x < 0 ? Math.PI / 4 : -Math.PI / 4;
    }
  }
  // Kệ cao trên cả ba vách, quay mặt sách vào phòng; giữa vách sau là cửa sổ.
  function shelf(x, z, rotation, kind, scaleX = 1.25) {
    return mark(place(kit.createBookshelf, x, 0.02, z, rotation, [scaleX, 1.95, 1.55]), { kind: 'shelf', shelf: kind });
  }
  for (const x of [-6.45, -4.2, 4.2, 6.45]) {
    const kind = x < 0 ? 'read' : 'dojo'; shelf(x, back + 0.63, 0, kind);
    mark(plaque(kind === 'read' ? 'KỆ KINH' : 'VÕ HỌC', x, 4.10, back + 1.11, 1.8), { kind: 'shelf', shelf: kind });
  }
  for (const z of [-3.95, -1.7, 0.55, 2.8, 5.05]) {
    shelf(left + 0.64, z, Math.PI / 2, 'read', 1.22);
    shelf(right - 0.64, z, -Math.PI / 2, 'dojo', 1.22);
  }
  const door = place(kit.createDoor, 0, 0.02, front - 0.25, Math.PI, [1.7, 1.7, 1]); door.name = 'exit-door';
  plaque('LỐI VỀ CHÁNH ĐIỆN', 0, 4.42, front - 0.5, 3.8, Math.PI);
  box('door-step', wood, 0, 0.045, front - 0.64, 3.8, 0.09, 0.64);

  const windowMaterial = material(0xf2d89d, { emissive: 0xe9b965, emissiveIntensity: 0.7 });
  box('window-glass', windowMaterial, 0, 2.8, back + 0.18, 3.2, 2.45, 0.08);
  for (const x of [-1.7, 1.7]) box('window-frame', wood, x, 2.8, back + 0.32, 0.16, 2.75, 0.3);
  for (const y of [1.46, 4.14]) box('window-frame', wood, 0, y, back + 0.32, 3.55, 0.16, 0.3);
  for (let i = -5; i <= 5; i++) box('window-lattice', wood, i * 0.28, 2.8, back + 0.29, 0.045, 2.5, 0.09);
  for (const y of [1.96, 2.8, 3.64]) box('window-lattice', wood, 0, y, back + 0.30, 3.2, 0.055, 0.09);
  plaque('TÀNG KINH CÁC', 0, 4.82, back + 0.32, 4.2);
  const sunStripes = new THREE.Group(); sunStripes.name = 'sun-stripes'; group.add(sunStripes);
  const sunMaterial = new THREE.MeshBasicMaterial({ color: 0xffdc93, transparent: true, opacity: 0.18, depthWrite: false }); materials.add(sunMaterial);
  for (let i = -5; i <= 5; i++) {
    const stripe = box('sun-stripe', sunMaterial, i * 0.33 + 0.8, 0.012, -2.9, 0.19, 0.005, 4.2, sunStripes);
    stripe.rotation.y = -0.22; stripe.castShadow = false; stripe.receiveShadow = false;
  }

  // Chiếu dưới hai hàng bồ đoàn, như drawLibrary của bản 2D.
  const matZ = (0.59 - 0.5) * depth;
  mark(box('woven-mat', straw, 0, 0.017, matZ, width * 0.84, 0.018, depth * 0.58), { kind: 'floor' });
  for (const x of [-width * 0.42, width * 0.42]) mark(box('mat-border', red, x, 0.03, matZ, 0.06, 0.012, depth * 0.58), { kind: 'floor' });
  for (const z of [matZ - depth * 0.29, matZ + depth * 0.29]) mark(box('mat-border', red, 0, 0.03, z, width * 0.84, 0.012, 0.06), { kind: 'floor' });
  for (let i = 0; i < 38; i++) mark(box('mat-weave', ink, 0, 0.028, matZ - depth * 0.29 + i * depth * 0.58 / 38, width * 0.84, 0.004, 0.012), { kind: 'floor' });

  function book(parent, x, y, z, scale = 1) {
    box('sutra-cover', red, x, y, z, 0.62 * scale, 0.035, 0.39 * scale, parent);
    for (const sign of [-1, 1]) {
      const page = box('sutra-page', paper, x + sign * 0.151 * scale, y + 0.035, z, 0.29 * scale, 0.035, 0.36 * scale, parent);
      page.rotation.z = sign * -0.08;
      for (let i = 0; i < 5; i++) box('sutra-lines', ink, x + sign * 0.151 * scale, y + 0.058, z + (i - 2) * 0.052 * scale, 0.21 * scale, 0.003, 0.007, parent);
    }
  }
  const cushions = [], desks = [];
  for (let index = 0; index < 8; index++) {
    const cushion = mark(place(kit.createCushion, 0, 0.04, 0), { kind: 'seat', index });
    const desk = new THREE.Group(); desk.name = 'reading-desk'; group.add(desk);
    box('desk-top', wood, 0, 0.45, 0, 1.5, 0.10, 0.65, desk);
    box('desk-edge', gold, 0, 0.47, 0.332, 1.51, 0.025, 0.018, desk);
    for (const x of [-0.61, 0.61]) for (const z of [-0.22, 0.22]) box('desk-leg', wood, x, 0.22, z, 0.09, 0.44, 0.09, desk);
    book(desk, 0, 0.52, 0, 1.3); cushions.push(cushion); desks.push(desk);
  }
  // Bàn dưới cửa sổ và đèn dầu; đèn lồng định hình chiều sâu dọc hai lối biên.
  box('window-table', red, 0, 0.65, back + 1.3, 3.6, 0.15, 0.95);
  for (const x of [-1.5, 1.5]) box('window-table-leg', wood, x, 0.30, back + 1.3, 0.15, 0.6, 0.65);
  book(group, 0, 0.75, back + 1.3, 1.4);
  for (const x of [-1.32, 1.1]) place(kit.createOilLamp, x, 0.73, back + 1.3);
  const lamp = new THREE.PointLight(0xffb263, 30, 10, 2); lamp.position.set(0, 1.8, back + 1.9); group.add(lamp);
  for (const x of [-width * 0.37, width * 0.37]) for (const z of [-2.2, 3.9]) {
    place(kit.createLantern, x, 2.75, z, 0, [0.85, 0.85, 0.85]);
    const light = new THREE.PointLight(0xffb46e, 22, 9, 2); light.position.set(x, 3.7, z); group.add(light);
  }
  group.add(new THREE.HemisphereLight(0xffe6bf, 0x463126, 1.15));
  const sun = new THREE.DirectionalLight(0xffdda1, 2.4); sun.position.set(-1.5, 4.1, back + 0.6);
  sun.target.position.set(1.3, 0, -0.8); sun.castShadow = shadows;
  Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 8, bottom: -8, near: 0.1, far: 22 });
  sun.shadow.mapSize.set(1024, 1024); sun.shadow.normalBias = 0.035;
  group.add(sun, sun.target);
  const fill = new THREE.DirectionalLight(0xc7c3b3, 0.55); fill.position.set(1, 4.5, 5); group.add(fill);
  group.traverse(node => {
    if (node.geometry) geometries.add(node.geometry);
    if (node.isMesh && node.material !== sunMaterial) { node.castShadow = shadows; node.receiveShadow = shadows; }
  });

  function update(state = {}, dt = 0) {
    if (disposed) return;
    const seats = Array.isArray(state.seats) ? state.seats : [];
    cushions.forEach((cushion, index) => {
      const seat = seats[index], x = Array.isArray(seat) ? seat[0] : seat?.x, z = Array.isArray(seat) ? seat[1] : seat?.z;
      const visible = Number.isFinite(x) && Number.isFinite(z) && x >= 0 && x <= 1 && z >= 0 && z <= 1;
      cushion.visible = desks[index].visible = visible;
      if (!visible) return;
      cushion.position.set((x - 0.5) * width, 0.04, (z - 0.5) * depth);
      desks[index].position.set(cushion.position.x, 0, cushion.position.z - 0.78);
    });
    const day = state.daylight !== false;
    sunStripes.visible = day; sun.intensity = day ? 2.4 : 0.35;
    windowMaterial.emissiveIntensity = day ? 0.7 : 0.12;
    // Đèn đứng yên ở cả ba mức, luôn tôn trọng chế độ giảm chuyển động.
  }
  function pick(raycaster) {
    if (disposed) return null;
    group.updateWorldMatrix(true, true);
    for (const hit of raycaster.intersectObject(group, true)) {
      let node = hit.object, action, visible = true;
      while (node) { visible = visible && node.visible; action ||= node.userData.pick; node = node.parent; }
      if (!visible || hit.object.material === sunMaterial) continue;
      if (!action) return null;
      if (action.kind !== 'floor') return { ...action };
      const point = group.worldToLocal(hit.point.clone());
      return { kind: 'floor', x: THREE.MathUtils.clamp(point.x / width + 0.5, 0.03, 0.97), z: THREE.MathUtils.clamp(point.z / depth + 0.5, 0.03, 0.97) };
    }
    return null;
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    group.traverse(node => { if (node.isLight || node.isInstancedMesh) node.dispose?.(); });
    geometries.forEach(value => value.dispose()); materials.forEach(value => value.dispose()); textures.forEach(value => value.dispose());
    // Vật liệu dùng chung thuộc kit, không giải phóng ở đây.
    group.removeFromParent(); group.clear();
  }
  update();
  return { group, update, pick, bounds: { minX: left + 1.4, maxX: right - 1.4, minZ: back + 1.6, maxZ: front - 0.6 }, dispose };
}
