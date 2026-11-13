/* State: { seats: [[x, z], ...] hoặc [{x, z}, ...], daylight?: boolean }.
   Người chơi và tư thế ngồi do bộ nối cảnh quản lý qua chỉ số sit. */
export function build({ THREE, kit, quality = 'medium', reduceMotion = false, size }) {
  const { width, depth } = size;
  const group = new THREE.Group();
  group.name = 'library';
  const targets = [];
  const cushions = [];
  const ownMaterials = new Set();
  const addKit = (object, x, y, z, rotation = 0) => {
    object.position.set(x, y, z);
    object.rotation.y = rotation;
    object.traverse(child => { if (child.isMesh) { child.castShadow = quality === 'high'; child.receiveShadow = quality !== 'low'; } });
    group.add(object);
    return object;
  };
  const mark = (object, data) => { object.userData.pick = data; targets.push(object); return object; };
  const box = (name, color, x, y, z, w, h, d) => {
    const material = new THREE.MeshStandardMaterial({ color, roughness: 0.9 });
    ownMaterials.add(material);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.name = name; mesh.position.set(x, y, z); mesh.receiveShadow = quality !== 'low'; group.add(mesh); return mesh;
  };
  const floor = box('floor', '#8b6849', 0, -0.08, 0, width, 0.16, depth);
  mark(floor, { kind: 'floor' });
  for (let x = -width / 2 + 0.7; x < width / 2; x += 1.4) box('floor seam', '#6c4c35', x, 0.003, 0, 0.012, 0.006, depth);
  for (const z of [-depth / 2, depth / 2]) {
    const wall = addKit(kit.createWall(quality), 0, 0, z, z > 0 ? Math.PI : 0);
    wall.scale.set(width / 2.4, 1.5, 1);
  }
  for (const x of [-width / 2, width / 2]) {
    const wall = addKit(kit.createWall(quality), x, 0, 0, Math.PI / 2);
    wall.scale.set(depth / 2.4, 1.5, 1);
  }
  box('ceiling', '#4a2c20', 0, 3.5, 0, width, 0.16, depth);
  for (const x of [-width / 2 + 0.48, width / 2 - 0.48]) for (const z of [-depth / 2 + 0.5, depth / 2 - 0.5]) {
    const column = addKit(kit.createColumn(quality), x, 0, z); column.scale.y = 1.3;
  }
  for (const [x, shelf] of [[-width * 0.32, 'read'], [width * 0.32, 'dojo']]) {
    for (const offset of [-0.95, 0.95]) {
      const bookcase = addKit(kit.createBookshelf(quality), x + offset, 0, -depth / 2 + 0.38);
      bookcase.scale.set(1.12, 1.35, 1.15);
      mark(bookcase, { kind: 'shelf', shelf });
    }
  }
  const window = box('window', '#f8d58a', 0, 2.05, -depth / 2 + 0.14, 2.1, 1.65, 0.08);
  window.material.emissive = new THREE.Color('#a15e21'); window.material.emissiveIntensity = 0.32;
  for (const x of [-1.1, 0, 1.1]) box('window frame', '#583220', x, 2.05, -depth / 2 + 0.24, 0.09, 1.85, 0.1);
  for (const y of [1.18, 2.05, 2.92]) box('window frame', '#583220', 0, y, -depth / 2 + 0.24, 2.28, 0.08, 0.1);
  const table = addKit(kit.createStoneTable(quality), 0, 0, -depth / 2 + 1.1);
  table.scale.set(1.25, 0.85, 0.9);
  for (const x of [-0.55, 0.55]) {
    addKit(kit.createOilLamp(quality), x, 0.68, -depth / 2 + 1.1);
    const light = new THREE.PointLight('#ffb85f', 7, 4.5); light.position.set(x, 1.35, -depth / 2 + 1.1); group.add(light);
  }
  const bounds = { minX: -width / 2 + 0.25, maxX: width / 2 - 0.25, minZ: -depth / 2 + 0.25, maxZ: depth / 2 - 0.25 };
  let disposed = false;
  function update(state = {}, dt = 0) {
    if (disposed) return;
    const seats = Array.isArray(state.seats) ? state.seats : [];
    while (cushions.length < seats.length) {
      const index = cushions.length;
      const cushion = mark(addKit(kit.createCushion(quality), 0, 0.01, 0), { kind: 'seat', index });
      cushions.push(cushion);
    }
    cushions.forEach((cushion, index) => {
      const seat = seats[index]; cushion.visible = !!seat;
      if (!seat) return;
      const x = Array.isArray(seat) ? seat[0] : seat.x;
      const z = Array.isArray(seat) ? seat[1] : seat.z;
      cushion.visible = Number.isFinite(x) && Number.isFinite(z);
      if (cushion.visible) cushion.position.set((x - 0.5) * width, 0.01, (z - 0.5) * depth);
    });
    window.material.emissiveIntensity = state.daylight === false ? 0.08 : 0.32;
  }
  function pick(raycaster) {
    if (disposed) return null;
    group.updateMatrixWorld(true);
    const hits = raycaster.intersectObjects(targets.filter(target => target.visible), true);
    for (const hit of hits) {
      let object = hit.object;
      while (object && !object.userData.pick) object = object.parent;
      if (!object) continue;
      const result = { ...object.userData.pick };
      if (result.kind === 'floor') { result.x = Math.max(0, Math.min(1, hit.point.x / width + 0.5)); result.z = Math.max(0, Math.min(1, hit.point.z / depth + 0.5)); }
      return result;
    }
    return null;
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    group.traverse(object => { if (object.geometry) object.geometry.dispose(); });
    ownMaterials.forEach(material => material.dispose());
    group.removeFromParent();
  }
  return { group, update, pick, bounds, dispose };
}
