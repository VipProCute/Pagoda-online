'use strict';

// state: { daylight: boolean, tables: [{ id, x, z, seats: [[x,z],[x,z]], name?, occupants? }] }.
// Tọa độ bàn và ghế nằm trong khoảng 0..1; occupants là hai tên hoặc null.
export function build({ THREE, kit, quality = 'medium', reduceMotion = false, size }) {
  const { width, depth } = size;
  const group = new THREE.Group();
  group.name = 'yard';
  const bounds = { minX: -width / 2 + 0.3, maxX: width / 2 - 0.3, minZ: -depth / 2 + 0.3, maxZ: depth / 2 - 0.3 };
  const ownedMaterials = new Set();
  const textures = new Set();
  const picks = [];
  const tables = new Map();
  let disposed = false;
  const material = (color, extra = {}) => {
    const value = new THREE.MeshStandardMaterial({ color, ...extra });
    ownedMaterials.add(value);
    return value;
  };
  const stone = material(0xb89b80), grout = material(0x806b5d), wall = material(0xd9c5a5);
  const dark = material(0x55362b), bronze = material(0xc49343, { metalness: 0.35, roughness: 0.55 });
  const skyMaterial = material(0xa5c9d1, { side: THREE.BackSide, roughness: 1 });
  const robe = material(0x75483f), purple = material(0x554663), skin = material(0xdcae82);
  function box(parent, mat, x, y, z, sx, sy, sz) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat);
    mesh.position.set(x, y, z); mesh.receiveShadow = quality !== 'low';
    mesh.castShadow = quality === 'high'; parent.add(mesh); return mesh;
  }
  function place(object, x, z, parent = group) { object.position.set(x, 0, z); parent.add(object); return object; }
  function world(x, z) { return { x: (x - 0.5) * width, z: (z - 0.5) * depth }; }
  function label(parent, text, x, y, z, labelWidth = 1.5) {
    if (typeof document === 'undefined') return;
    const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 128;
    const paint = canvas.getContext('2d'); if (!paint) return;
    paint.fillStyle = '#542b20'; paint.fillRect(0, 0, 512, 128);
    paint.strokeStyle = '#e2bd70'; paint.lineWidth = 7; paint.strokeRect(5, 5, 502, 118);
    paint.fillStyle = '#ffdf9c'; paint.textAlign = 'center'; paint.textBaseline = 'middle';
    paint.font = 'bold 48px Georgia, serif'; paint.fillText(String(text).slice(0, 32), 256, 66, 470);
    const texture = new THREE.CanvasTexture(canvas); textures.add(texture);
    const mat = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide }); ownedMaterials.add(mat);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(labelWidth, labelWidth / 4), mat);
    mesh.position.set(x, y, z); parent.add(mesh);
  }
  const floor = box(group, stone, 0, -0.12, 0, width, 0.24, depth);
  floor.userData.pick = { type: 'floor' }; picks.push(floor);
  for (let x = -width / 2 + 2; x < width / 2; x += 2) box(group, grout, x, 0.006, 0, 0.018, 0.012, depth);
  for (let z = -depth / 2 + 1.5; z < depth / 2; z += 1.5) box(group, grout, 0, 0.007, z, width, 0.014, 0.018);
  const sky = new THREE.Mesh(new THREE.SphereGeometry(Math.max(width, depth) * 3, 24, 12), skyMaterial); group.add(sky);
  const temple = place(kit.templeHall({ width: 10.5, depth: 4.2, quality, tiers: 2 }), 0, -depth / 2 + 1.4);
  label(temple, 'CHÁNH ĐIỆN', 0, 4.16, 2.25, 2.5);
  const gate = place(kit.createGate(quality), 0, depth / 2 - 0.35); gate.rotation.y = Math.PI;
  for (const side of [-1, 1]) {
    box(group, wall, side * (width / 2 - 0.15), 1.05, 0, 0.3, 2.1, depth);
    box(group, dark, side * (width / 2 - 0.15), 2.12, 0, 0.45, 0.18, depth);
    box(group, wall, side * (width / 4 + 1.5), 1.0, depth / 2 - 0.15, width / 2 - 3, 2, 0.3);
    box(group, wall, side * (width * 0.38), 1.0, -depth / 2 + 0.15, width * 0.24, 2, 0.3);
    for (const z of [-depth * 0.25, depth * 0.15, depth * 0.39]) {
      const tree = place(kit.createBodhiTree(quality), side * (width / 2 - 1.2), z); tree.scale.setScalar(0.8);
    }
    const lantern = place(kit.createLantern(quality), side * 4.5, -depth / 2 + 4.7); lantern.position.y = 2.6;
    const light = new THREE.PointLight(0xffb568, 14, 7); light.position.set(side * 4.5, 2.7, -depth / 2 + 4.7); group.add(light);
  }
  const ambient = new THREE.HemisphereLight(0xffe5bb, 0x514235, 2.0); group.add(ambient);
  const sun = new THREE.DirectionalLight(0xffd9a6, 2.2); sun.position.set(-7, 12, 5); sun.castShadow = quality === 'high'; group.add(sun);
  for (const [index, kind] of ['horoscope', 'tarot'].entries()) {
    const point = world(index ? 0.8 : 0.2, 0.28);
    const reader = new THREE.Group(); reader.userData.pick = { type: 'reader', id: kind }; place(reader, point.x, point.z); picks.push(reader);
    box(reader, dark, 0, 0.42, 0, 1.25, 0.12, 0.6);
    box(reader, index ? purple : robe, 0, 0.83, -0.22, 0.42, 0.65, 0.32);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8), skin); head.position.set(0, 1.3, -0.22); reader.add(head);
    label(reader, index ? 'TAROT' : 'TỬ VI', 0, 0.42, 0.315, 0.8);
  }
  function removeObject(object) {
    object.removeFromParent();
    object.traverse(item => { if (item.geometry) item.geometry.dispose(); });
  }
  function makeTable(data) {
    const node = new THREE.Group(); node.userData.pick = { type: 'table', id: data.id };
    place(kit.createStoneTable(quality), 0, 0, node); group.add(node); picks.push(node);
    label(node, data.name || 'BÀN ' + data.id, 0, 0.9, 0.44, 1.1);
    const benches = [new THREE.Group(), new THREE.Group()]; benches.forEach(bench => {
      box(bench, stone, 0, 0.34, 0, 0.62, 0.13, 0.4); box(bench, grout, 0, 0.15, 0, 0.3, 0.3, 0.25);
      const sitter = new THREE.Group(); sitter.name = 'occupant';
      box(sitter, robe, 0, 0.72, 0, 0.36, 0.55, 0.28);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 8), skin); head.position.y = 1.15; sitter.add(head);
      bench.add(sitter); group.add(bench);
    });
    return { node, benches };
  }
  function update(state = {}, dt = 0) {
    if (disposed) return;
    const day = state.daylight !== false;
    skyMaterial.color.setHex(day ? 0xa5c9d1 : 0x172839);
    ambient.intensity = day ? 2.0 : 0.42; sun.intensity = day ? 2.2 : 0.22;
    const seen = new Set();
    for (const data of Array.isArray(state.tables) ? state.tables : []) {
      if (!Number.isInteger(data.id) || !Number.isFinite(data.x) || !Number.isFinite(data.z) || !Array.isArray(data.seats)) continue;
      seen.add(data.id);
      let entry = tables.get(data.id);
      if (!entry) { entry = makeTable(data); tables.set(data.id, entry); }
      const point = world(data.x, data.z); entry.node.position.set(point.x, 0, point.z);
      entry.benches.forEach((bench, index) => {
        const seat = data.seats[index]; bench.getObjectByName('occupant').visible = !!data.occupants?.[index]; bench.visible = Array.isArray(seat) && Number.isFinite(seat[0]) && Number.isFinite(seat[1]);
        if (bench.visible) { const position = world(seat[0], seat[1]); bench.position.set(position.x, 0, position.z); }
      });
    }
    for (const [id, entry] of tables) if (!seen.has(id)) {
      picks.splice(picks.indexOf(entry.node), 1); removeObject(entry.node); entry.benches.forEach(removeObject); tables.delete(id);
    }
  }
  function pick(raycaster) {
    group.updateMatrixWorld(true);
    const hits = raycaster.intersectObjects(picks, true);
    for (const hit of hits) {
      let object = hit.object;
      while (object && !object.userData.pick) object = object.parent;
      if (!object) continue;
      const result = object.userData.pick;
      if (result.type === 'floor') return { type: 'floor', x: hit.point.x / width + 0.5, z: hit.point.z / depth + 0.5 };
      return { ...result };
    }
    return null;
  }
  function dispose() {
    if (disposed) return; disposed = true; group.removeFromParent();
    group.traverse(item => { if (item.geometry) item.geometry.dispose(); });
    textures.forEach(texture => texture.dispose()); ownedMaterials.forEach(value => value.dispose());
    group.clear(); tables.clear(); picks.length = 0;
  }
  update();
  return { group, update, pick, bounds, dispose };
}
