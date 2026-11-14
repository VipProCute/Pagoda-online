'use strict';

import { makeAvatar } from '../avatar-glb.mjs?v=7';

/* Cùng hợp đồng build/update/pick/bounds/dispose với hall.mjs.
 * state: { daylight: boolean | 0..1,
 *   tables: [{ id: 1..4, x, z, seats: [[x,z],[x,z]], name?, occupants? }] }.
 * occupants: [tên | {name,look}, null]. Cảnh sở hữu thầy bói và người ngồi;
 * người đi lại do lớp gọi dựng, không tự quyết trạng thái hoặc gọi socket.
 * pick: {kind:'table',id,seat:-1|0|1}, {kind:'reader',id}, {kind:'floor',x,z}.
 * drawReaders/proj ở hall.js: chân thầy ở màn hình (.2/.8,.63), suy ra
 * z=(.63-.5)/.5=.26, x=.5±.3/(2*(.36+.28*.26)). Mặt tiền hướng +Z.
 */
export function build({ THREE, kit, quality = 'medium', reduceMotion = false, size }) {
  const { width, depth } = size;
  const group = new THREE.Group(); group.name = 'yard';
  const geometries = new Set(), materials = new Set(), textures = new Set();
  const tables = new Map(), readers = [], lanterns = [], lights = [];
  const shadows = quality === 'high';
  let disposed = false, elapsed = 0, daylight = 1;
  const world = (x, z) => [(x - 0.5) * width, (z - 0.5) * depth];
  const geometry = value => { geometries.add(value); return value; };
  function material(color, extra = {}) {
    const value = new THREE.MeshStandardMaterial({ color, roughness: 0.86, ...extra });
    materials.add(value); return value;
  }
  const stone = material(0x9c9079), dark = material(0x41271f), gold = material(0xc89b54, { metalness: 0.4 });
  const brick = material(0x97563e), grout = material(0x665245), red = material(0x782b26);
  const ivory = material(0xe4cfa4), blue = material(0x53436d), green = material(0x425d3e);
  const glow = material(0xb64223, { emissive: 0xff962f, emissiveIntensity: 0.1 });
  const unitBox = geometry(new THREE.BoxGeometry(1, 1, 1)), unitPlane = geometry(new THREE.PlaneGeometry(1, 1));
  const unitBall = geometry(new THREE.SphereGeometry(1, quality === 'low' ? 6 : 10, 6));
  function mesh(parent, shape, mat, x, y, z, sx, sy, sz) {
    const object = new THREE.Mesh(shape, mat); object.position.set(x, y, z); object.scale.set(sx, sy, sz);
    object.castShadow = shadows; object.receiveShadow = shadows; parent.add(object); return object;
  }
  const box = (parent, mat, x, y, z, sx, sy, sz) => mesh(parent, unitBox, mat, x, y, z, sx, sy, sz);
  function place(object, x, z, y = 0, scale = 1, parent = group) {
    object.position.set(x, y, z); object.scale.setScalar(scale); parent.add(object);
    object.traverse(node => {
      if (node.geometry) geometries.add(node.geometry);
      if (node.isMesh) { node.castShadow = shadows; node.receiveShadow = shadows; }
    });
    return object;
  }
  function label(parent, initial, x, y, z, w = 1.5, h = 0.32) {
    const plaque = new THREE.Group(); parent.add(plaque);
    box(plaque, gold, x, y, z, w + 0.07, h + 0.07, 0.07);
    box(plaque, red, x, y, z + 0.04, w, h, 0.03);
    const canvas = globalThis.document?.createElement('canvas'), paint = canvas?.getContext('2d');
    let texture, mat, previous;
    if (paint) {
      canvas.width = 768; canvas.height = 160;
      texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; textures.add(texture);
      mat = new THREE.MeshBasicMaterial({ map: texture }); materials.add(mat);
      mesh(plaque, unitPlane, mat, x, y, z + 0.057, w, h, 1);
    }
    function set(text) {
      text = String(text).slice(0, 80);
      if (text === previous) return;
      previous = text; plaque.userData.text = text;
      if (!paint) return;
      paint.fillStyle = '#782b26'; paint.fillRect(0, 0, 768, 160);
      paint.fillStyle = '#ffe0a0'; paint.font = '500 68px Georgia, serif';
      paint.textAlign = 'center'; paint.textBaseline = 'middle'; paint.fillText(text, 384, 85, 730);
      texture.needsUpdate = true;
    }
    set(initial);
    return { set, dispose() { texture?.dispose(); mat?.dispose(); textures.delete(texture); materials.delete(mat); } };
  }

  // Sân gạch đất nung, biến sắc từng viên trong một lượt vẽ.
  const shellX = width / 2 + 1.5, back = -depth / 2 - 7.4, front = depth / 2 + 1.3;
  box(group, grout, 0, -0.16, (back + front) / 2, shellX * 2, 0.3, front - back).userData.pick = { kind: 'floor' };
  const nx = 36, nz = 32, tileDepth = front - back;
  const tiles = new THREE.InstancedMesh(unitBox, brick, nx * nz), transform = new THREE.Object3D();
  tiles.name = 'yard-tiles'; tiles.receiveShadow = shadows; tiles.userData.pick = { kind: 'floor' };
  for (let x = 0; x < nx; x++) for (let z = 0; z < nz; z++) {
    transform.position.set(-shellX + (x + 0.5) * shellX * 2 / nx, -0.004, back + (z + 0.5) * tileDepth / nz);
    transform.scale.set(shellX * 2 / nx - 0.018, 0.025, tileDepth / nz - 0.018); transform.updateMatrix();
    tiles.setMatrixAt(x * nz + z, transform.matrix);
    tiles.setColorAt(x * nz + z, new THREE.Color([0xd6ad8c, 0xe8ba94, 0xc89a7c][(x * 7 + z * 11) % 3]));
  }
  group.add(tiles);
  for (const sign of [-1, 1]) box(group, stone, sign * 2, 0.015, 0, 0.13, 0.03, depth).userData.pick = { kind: 'floor' };

  // Vỏ kín bốn phía, hình khối có cả mặt trong và mặt ngoài.
  function wallRun(length, x, z, angle) {
    const count = Math.ceil(length / 2.4);
    for (let i = 0; i < count; i++) {
      const offset = (i + 0.5) * length / count - length / 2;
      const wall = place(kit.createWall(quality), x + Math.cos(angle) * offset, z + Math.sin(angle) * offset);
      wall.rotation.y = -angle; wall.scale.set(length / count / 2.4, 1.2, 1.8);
    }
  }
  wallRun(shellX * 2, 0, back, 0); wallRun(shellX * 2, 0, front, 0);
  for (const sign of [-1, 1]) wallRun(front - back, sign * shellX, (back + front) / 2, Math.PI / 2);
  const gate = place(kit.createGate(quality), 0, front - 0.4, 0, 1.25); gate.rotation.y = Math.PI;
  for (const x of [-2.4, 0, 2.4]) {
    const door = place(kit.createDoor(quality), x, front - 0.18); door.rotation.y = Math.PI;
    door.scale.set(x ? 0.85 : 1.2, x ? 1.3 : 1.6, 1);
  }
  const innerSign = new THREE.Group(); innerSign.rotation.y = Math.PI;
  innerSign.position.z = front - 0.83; group.add(innerSign);
  label(innerSign, 'CHÙA TÂM AN', 0, 4, 0, 2.7, 0.42);

  // Mặt tiền lớn: bậc đá, hiên cột, cửa bức bàn và mái chồng diêm.
  const templeDepth = 6.4, templeZ = -depth / 2 - templeDepth / 2 - 0.15;
  const temple = place(kit.templeHall({ width: width * 0.79, depth: templeDepth, quality, tiers: 2 }), 0, templeZ);
  temple.name = 'yard-temple'; label(temple, 'CHÁNH ĐIỆN', 0, 4.16, templeDepth / 2 - 0.06, 4.5, 0.56);
  // Trần có mặt dưới để góc nhìn tầm mắt không xuyên qua mái hiên.
  box(group, dark, 0, 4.65, templeZ, width * 0.79, 0.16, templeDepth);
  for (const sign of [-1, 1]) {
    const x = sign * (shellX - 1.25), midZ = (front - depth / 2) / 2;
    const roof = place(kit.roof({ width: front + depth / 2 + 0.8, depth: 2.8, quality }), x, midZ, 3.65);
    roof.rotation.y = Math.PI / 2;
    box(group, dark, x, 3.56, midZ, 2.55, 0.18, front + depth / 2);
    box(group, dark, sign * (shellX - 2.4), 3.4, midZ, 0.16, 0.24, front + depth / 2);
    for (let z = -depth / 2 + 0.3; z < front; z += 3.1) {
      const column = place(kit.createColumn(quality), sign * (shellX - 2.4), z);
      column.scale.set(1.1, 3.5 / 2.68, 1.1);
    }
    for (const z of [-5.7, 1.95]) {
      const treeX = sign * (width / 2 - 1.9);
      box(group, stone, treeX, 0.15, z, 1.25, 0.3, 1.7);
      box(group, green, treeX, 0.31, z, 1.05, 0.03, 1.5);
      place(kit.createBodhiTree(quality), treeX, z, 0.32, z < 0 ? 1.35 : 1.05);
    }
    place(kit.createOilLamp(quality), sign * 1.9, -depth / 2 + 1.25, 0.30, 1.3);
  }
  const burner = place(kit.createIncenseBurner(quality), 0, -depth * 0.16, 0.28, 1.8); burner.name = 'yard-incense';
  box(group, stone, 0, 0.12, burner.position.z, 2.15, 0.24, 1.9);
  box(group, gold, 0, 0.255, burner.position.z, 1.9, 0.03, 1.65);

  // Hai dãy đèn và đèn dưới hiên; chỉ 2/4/6 nguồn điểm tùy mức đồ họa.
  function lantern(x, z, y, lit = false) {
    const object = place(kit.createLantern(quality), x, z, y);
    object.traverse(node => { if (node.material?.name === 'fabric') node.material = glow; }); lanterns.push(object);
    if (lit) {
      const light = new THREE.PointLight(0xffb05e, 3, 11, 2); light.position.set(x, y + 1.16, z);
      group.add(light); lights.push(light);
    }
  }
  for (const sign of [-1, 1]) {
    const x = sign * (shellX - 2.6);
    for (let i = 0; i < 6; i++) {
      const z = -depth / 2 + 1.2 + i * 2.65;
      lantern(x, z, 1.85, i === 2 || (quality !== 'low' && i === 4));
      box(group, dark, x, 3.58, z, 0.05, 0.3, 0.05);
    }
    for (const x of [sign * 3.1, sign * 7.2]) lantern(x, -depth / 2 - 0.3, 2.45, quality === 'high' && Math.abs(x) < 4);
  }
  const ambient = new THREE.HemisphereLight(0xffe4bb, 0x594032, 1.9); group.add(ambient);
  const sun = new THREE.DirectionalLight(0xffdbab, 2.5); sun.position.set(-8, 15, 7); sun.castShadow = shadows;
  Object.assign(sun.shadow.camera, { left: -17, right: 17, top: 18, bottom: -18, near: 0.5, far: 45 });
  sun.shadow.mapSize.set(2048, 2048); sun.shadow.normalBias = 0.045; group.add(sun, sun.target);
  const fill = new THREE.DirectionalLight(0x8ba9c7, 0.55); fill.position.set(6, 9, -8); group.add(fill);
  const dayAmbient = new THREE.Color(0xffe4bb), dayGround = new THREE.Color(0x594032), daySun = new THREE.Color(0xffdbab);

  // Bầu trời chuyển sắc tự vẽ; không tải tài nguyên bên thứ ba.
  const skyColors = [0x121e36, 0x79b9d3, 0x8f6970, 0xe7cfae, 0x26392e, 0x94a984].map(c => new THREE.Color(c));
  const skyMaterial = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: { topColor: { value: new THREE.Color() }, horizonColor: { value: new THREE.Color() }, groundColor: { value: new THREE.Color() } },
    vertexShader: 'varying vec3 vSky; void main(){vSky=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: `varying vec3 vSky; uniform vec3 topColor; uniform vec3 horizonColor; uniform vec3 groundColor;
      void main(){float h=normalize(vSky).y; vec3 c=mix(groundColor,horizonColor,smoothstep(-0.25,0.04,h));
      c=mix(c,topColor,smoothstep(0.02,0.75,h)); gl_FragColor=vec4(c,1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      }`
  }); materials.add(skyMaterial);
  const sky = new THREE.Mesh(geometry(new THREE.SphereGeometry(100, 24, 12)), skyMaterial); sky.name = 'yard-sky';
  sky.userData.sky = true; group.add(sky);
  const orbMaterial = new THREE.MeshBasicMaterial({ color: 0xffe2a3 }); materials.add(orbMaterial);
  const orb = mesh(group, unitBall, orbMaterial, 35, 29, -49, 2.5, 2.5, 2.5); orb.userData.sky = true;

  for (const [index, id] of ['horoscope', 'tarot'].entries()) {
    const x = 0.5 + (index ? 0.3 : -0.3) / (2 * (0.36 + 0.28 * 0.26));
    const [wx, wz] = world(x, 0.26), node = new THREE.Group(); node.name = 'reader-' + id;
    node.userData.pick = { kind: 'reader', id }; node.position.set(wx, 0, wz); group.add(node);
    const avatar = makeAvatar({ g: 'nam', c: index ? 4 : 9, h: 2 }, { role: 'reader', reducedMotion: reduceMotion });
    avatar.group.position.z = -0.34; node.add(avatar.group); readers.push(avatar);
    avatar.update({ sit: 'bench', reducedMotion: reduceMotion }, 0);
    box(node, dark, 0, 0.64, 0.28, 1.45, 0.12, 0.85);
    box(node, index ? blue : red, 0, 0.71, 0.3, 1.36, 0.025, 0.77);
    for (const sx of [-0.55, 0.55]) for (const sz of [-0.03, 0.6]) box(node, dark, sx, 0.3, sz, 0.10, 0.6, 0.10);
    box(node, stone, 0, 0.39, -0.34, 0.62, 0.12, 0.48);
    label(node, index ? 'TAROT' : 'TỬ VI', 0, 0.56, 0.72, 1.1, 0.24);
    for (let i = 0; i < 3; i++) box(node, ivory, (i - 1) * 0.25, 0.732, 0.3, 0.18, 0.018, 0.3).rotation.y = (i - 1) * 0.12;
    place(kit.createOilLamp(quality), -0.52, 0.3, 0.73, 0.7, node);
  }

  // Tách bàn/ghế của kit đã gộp theo vật liệu, rồi đặt ghế theo state.seats.
  // Không giữ ghế trang trí cố định của kit bên dưới ghế lấy từ trạng thái.
  function furniture() {
    const source = kit.createStoneTable(quality), parts = [new THREE.Group(), new THREE.Group(), new THREE.Group()];
    source.traverse(node => {
      if (!node.isMesh) return;
      const p = node.geometry.attributes.position, n = node.geometry.attributes.normal;
      const positions = [[], [], []], normals = [[], [], []];
      for (let i = 0; i < p.count; i += 3) {
        const center = (p.getX(i) + p.getX(i + 1) + p.getX(i + 2)) / 3;
        const part = center < -0.72 ? 1 : center > 0.72 ? 2 : 0, offset = part === 1 ? -1 : part === 2 ? 1 : 0;
        for (let j = i; j < i + 3; j++) {
          positions[part].push(p.getX(j) - offset, p.getY(j), p.getZ(j));
          normals[part].push(n.getX(j), n.getY(j), n.getZ(j));
        }
      }
      for (let i = 0; i < 3; i++) if (positions[i].length) {
        const shape = geometry(new THREE.BufferGeometry());
        shape.setAttribute('position', new THREE.Float32BufferAttribute(positions[i], 3));
        shape.setAttribute('normal', new THREE.Float32BufferAttribute(normals[i], 3));
        const object = new THREE.Mesh(shape, node.material); object.castShadow = shadows; object.receiveShadow = shadows; parts[i].add(object);
      }
      node.geometry.dispose();
    });
    return parts;
  }
  function makeTable(id) {
    const [node, ...benches] = furniture(); node.name = 'table-' + id;
    node.userData.pick = { kind: 'table', id, seat: -1 }; group.add(node);
    const sign = label(node, 'Bàn ' + id, 0, 0.65, 0.65, 1.6, 0.28);
    const occupants = benches.map((bench, seat) => {
      bench.name = 'table-' + id + '-seat-' + seat; bench.userData.pick = { kind: 'table', id, seat }; group.add(bench);
      const avatar = makeAvatar({}, { reducedMotion: reduceMotion }); avatar.group.name = 'occupant'; bench.add(avatar.group); return avatar;
    });
    return { node, benches, occupants, sign };
  }
  function removeTable(entry) {
    entry.occupants.forEach(avatar => avatar.dispose()); entry.sign.dispose();
    for (const node of [entry.node, ...entry.benches]) {
      node.traverse(child => {
        if (child.geometry && child.geometry !== unitBox && child.geometry !== unitPlane) { child.geometry.dispose(); geometries.delete(child.geometry); }
      }); node.removeFromParent();
    }
  }
  function update(state = {}, dt = 0) {
    if (disposed) return;
    const seconds = Math.max(0, Math.min(Number.isFinite(dt) ? dt : 0, 0.1));
    if (!reduceMotion) elapsed += seconds;
    const target = typeof state.daylight === 'number' && Number.isFinite(state.daylight)
      ? THREE.MathUtils.clamp(state.daylight, 0, 1) : state.daylight === false ? 0 : 1;
    daylight = !seconds || reduceMotion ? target : THREE.MathUtils.lerp(daylight, target, 1 - Math.exp(-seconds * 3));
    skyMaterial.uniforms.topColor.value.lerpColors(skyColors[0], skyColors[1], daylight);
    skyMaterial.uniforms.horizonColor.value.lerpColors(skyColors[2], skyColors[3], daylight);
    skyMaterial.uniforms.groundColor.value.lerpColors(skyColors[4], skyColors[5], daylight);
    // Game dùng giờ Việt Nam thật, khác trang thử mặc định ban ngày và có env map.
    // Giữ ánh trăng phủ toàn sân kể cả mức Thấp, không phụ thuộc bản đồ phản xạ.
    ambient.color.set(0xaac7ed).lerp(dayAmbient, daylight);
    ambient.groundColor.set(0x65758b).lerp(dayGround, daylight);
    sun.color.set(0xb6d0ff).lerp(daySun, daylight);
    ambient.intensity = 1.15 + daylight * 0.75; sun.intensity = 0.85 + daylight * 1.65; fill.intensity = 0.55;
    glow.emissiveIntensity = 0.12 + (1 - daylight) * 2.5;
    lights.forEach(light => { light.intensity = 3 + (1 - daylight) * 37; });
    orbMaterial.color.setHex(daylight > 0.5 ? 0xffe2a3 : 0xd9dfeb);
    lanterns.forEach((node, i) => { node.rotation.z = reduceMotion ? 0 : Math.sin(elapsed * 0.8 + i) * 0.012; });
    const seen = new Set();
    for (const data of Array.isArray(state.tables) ? state.tables : []) {
      if (!data || !Number.isInteger(data.id) || data.id < 1 || data.id > 4 || !Number.isFinite(data.x) || !Number.isFinite(data.z) || !Array.isArray(data.seats)) continue;
      seen.add(data.id);
      let entry = tables.get(data.id);
      if (!entry) { entry = makeTable(data.id); tables.set(data.id, entry); }
      const [x, z] = world(data.x, data.z); entry.node.position.set(x, 0, z); entry.sign.set(data.name || 'Bàn ' + data.id);
      entry.benches.forEach((bench, index) => {
        const seat = data.seats[index], occupant = data.occupants?.[index], avatar = entry.occupants[index];
        bench.visible = Array.isArray(seat) && Number.isFinite(seat[0]) && Number.isFinite(seat[1]); avatar.group.visible = bench.visible && !!occupant;
        if (bench.visible) {
          const [sx, sz] = world(seat[0], seat[1]); bench.position.set(sx, 0, sz);
          avatar.setLook(occupant?.look || {});
          avatar.update({ name: typeof occupant === 'string' ? occupant : occupant?.name || '',
            sit: 'bench', yaw: Math.atan2(x - sx, z - sz), reducedMotion: reduceMotion }, seconds);
        }
      });
    }
    for (const [id, entry] of tables) if (!seen.has(id)) { removeTable(entry); tables.delete(id); }
  }
  function pick(raycaster) {
    if (disposed) return null;
    group.updateWorldMatrix(true, true);
    // Chữ nổi không phải khối chạm, cũng không cần raycaster.camera khi test.
    const meshes = [];
    group.traverse(node => { if (node.isMesh && !node.userData.sky) meshes.push(node); });
    for (const hit of raycaster.intersectObjects(meshes, false)) {
      let node = hit.object, visible = true, action;
      while (node) { visible = visible && node.visible; action ||= node.userData.pick; node = node.parent; }
      if (!visible || hit.object.isSprite || hit.object.userData.sky) continue;
      if (!action) return null;
      if (action.kind !== 'floor') return { ...action };
      const p = group.worldToLocal(hit.point.clone());
      return { kind: 'floor', x: THREE.MathUtils.clamp(p.x / width + 0.5, 0.03, 0.97), z: THREE.MathUtils.clamp(p.z / depth + 0.5, 0.12, 0.97) };
    }
    return null;
  }
  function dispose() {
    if (disposed) return;
    disposed = true; tables.forEach(removeTable); tables.clear(); readers.forEach(avatar => avatar.dispose());
    group.traverse(node => { if (node.isInstancedMesh || node.isLight) node.dispose?.(); });
    geometries.forEach(value => value.dispose()); materials.forEach(value => value.dispose()); textures.forEach(value => value.dispose());
    group.removeFromParent(); group.clear();
    // Vật liệu dùng chung của kit thuộc bên gọi; không gọi disposeKit() ở đây.
  }
  update();
  return { group, update, pick, bounds: { minX: -width / 2, maxX: width / 2, minZ: -depth / 2 + 0.2, maxZ: depth / 2 + 0.55 }, dispose };
}
