'use strict';
import * as THREE from 'three';

// Đơn vị mét; mặt trước hướng +Z. Vật liệu dùng chung trong suốt vòng đời kit.
export const materials = {};
const geometries = new Set();
const palette = {
  wood: 0x62271e, woodLight: 0x995032, lacquer: 0x8e2924,
  tile: 0x743c30, tileLight: 0xa65e43, plaster: 0xd5c29b,
  stone: 0x827e72, stoneLight: 0xb3aa96, bronze: 0x997039,
  gold: 0xd8ac56, fabric: 0xa52e29, cushion: 0xc88a42,
  leaf: 0x365847, leafLight: 0x64835a, dark: 0x30251f,
  blue: 0x40596b, green: 0x68794b, ivory: 0xe6d6ad,
  fruit: 0xc6a340, redFruit: 0xb74730, flame: 0xffce73
};

function material(name) {
  if (!materials[name]) {
    const metal = name === 'bronze' || name === 'gold';
    materials[name] = new THREE.MeshStandardMaterial({
      color: palette[name], roughness: metal ? 0.34 : name === 'lacquer' ? 0.38 : 0.87,
      metalness: metal ? 0.68 : 0,
      emissive: name === 'flame' ? 0xff9b32 : 0x000000,
      emissiveIntensity: name === 'flame' ? 0.7 : 0
    });
    materials[name].name = name;
  }
  return materials[name];
}

function options(value) { return typeof value === 'string' ? { quality: value } : value || {}; }
function builder(quality = 'medium') {
  const parts = new Map();
  const segments = quality === 'high' ? 16 : quality === 'low' ? 6 : 8;
  function add(name, geometry, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
    geometry.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(1, 1, 1)));
    const flat = geometry.index ? geometry.toNonIndexed() : geometry;
    if (flat !== geometry) geometry.dispose();
    if (!parts.has(name)) parts.set(name, []);
    parts.get(name).push(flat);
  }
  function box(name, x, y, z, width, height, depth, rz = 0) {
    add(name, new THREE.BoxGeometry(width, height, depth), x, y, z, 0, 0, rz);
  }
  function cylinder(name, x, y, z, top, bottom, height, count = segments) {
    add(name, new THREE.CylinderGeometry(top, bottom, height, count), x, y, z);
  }
  function ball(name, x, y, z, radius, sx = 1, sy = 1, sz = 1) {
    const geometry = new THREE.SphereGeometry(radius, segments, Math.max(4, Math.floor(segments / 2)));
    geometry.scale(sx, sy, sz); add(name, geometry, x, y, z);
  }
  function beam(name, from, to, radius, bottom = radius) {
    const a = new THREE.Vector3(...from), end = new THREE.Vector3(...to);
    const geometry = new THREE.CylinderGeometry(radius, bottom, a.distanceTo(end), segments);
    geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), end.sub(a).normalize()));
    const center = a.add(new THREE.Vector3(...to)).multiplyScalar(0.5);
    add(name, geometry, center.x, center.y, center.z);
  }
  function path(name, points, radius, sides = 5) {
    const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
    add(name, new THREE.TubeGeometry(curve, points.length - 1, radius, sides, false));
  }
  function ring(name, x, y, z, radius, tube, rx = 0, ry = 0) {
    add(name, new THREE.TorusGeometry(radius, tube, quality === 'low' ? 3 : 5, segments * 2), x, y, z, rx, ry);
  }
  function lathe(name, profile, x = 0, y = 0, z = 0) {
    add(name, new THREE.LatheGeometry(profile.map(p => new THREE.Vector2(...p)), segments), x, y, z);
  }
  // Nhóm con được tiêu thụ và gộp lại theo vật liệu, không giữ geometry thừa.
  function merge(group, x = 0, y = 0, z = 0, sx = 1, sy = sx, sz = sx) {
    group.position.set(x, y, z); group.scale.set(sx, sy, sz); group.updateMatrixWorld(true);
    group.traverse(mesh => {
      if (!mesh.isMesh) return;
      add(mesh.material.name, mesh.geometry.clone().applyMatrix4(mesh.matrixWorld));
      geometries.delete(mesh.geometry); mesh.geometry.dispose();
    });
  }
  function finish(name) {
    const group = new THREE.Group(); group.name = name;
    for (const [key, items] of parts) {
      const length = items.reduce((n, item) => n + item.attributes.position.array.length, 0);
      const positions = new Float32Array(length), normals = new Float32Array(length);
      let offset = 0;
      for (const item of items) {
        positions.set(item.attributes.position.array, offset);
        normals.set(item.attributes.normal.array, offset);
        offset += item.attributes.position.array.length; item.dispose();
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
      geometry.computeBoundingSphere(); geometries.add(geometry);
      const mesh = new THREE.Mesh(geometry, material(key));
      mesh.castShadow = true; mesh.receiveShadow = true; group.add(mesh);
    }
    return group;
  }
  return { add, box, cylinder, ball, beam, path, ring, lathe, merge, finish, segments };
}

// t chạy từ nóc xuống diềm, u chạy dọc từng mặt mái. Một hàm cong dùng chung
// cho mặt ngói, hàng ngói ống, bờ guột và diềm để không hở ở góc mái.
function roofTier(b, width, depth, base, quality) {
  const halfW = width / 2, halfD = depth / 2;
  const ridge = Math.max(width * 0.10, halfW - depth * 0.36);
  const rise = depth * 0.27, curl = depth * 0.105;
  const trim = Math.min(1, depth / 5);
  const rows = quality === 'low' ? 3 : quality === 'high' ? 9 : 5;
  function point(face, u, t) {
    const span = ridge + (halfW - ridge) * t;
    const y = base + rise * (1 - t) - depth * 0.045 * Math.sin(Math.PI * t)
      + curl * Math.pow(t, 3) * Math.pow(Math.abs(u), 6);
    if (face < 2) return [u * span, y, (face === 0 ? 1 : -1) * halfD * t];
    return [(face === 2 ? 1 : -1) * span, y, u * halfD * t];
  }
  function surface(face) {
    const cols = face < 2 ? rows * 2 : rows;
    const vertices = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const a = point(face, -1 + 2 * c / cols, r / rows);
      const d = point(face, -1 + 2 * (c + 1) / cols, r / rows);
      const e = point(face, -1 + 2 * (c + 1) / cols, (r + 1) / rows);
      const f = point(face, -1 + 2 * c / cols, (r + 1) / rows);
      // Xoay thứ tự đỉnh để cả bốn mặt đều hướng lên trời.
      const normal = new THREE.Vector3(...e).sub(new THREE.Vector3(...a))
        .cross(new THREE.Vector3(...f).sub(new THREE.Vector3(...a)));
      if (normal.y >= 0) vertices.push(...a, ...d, ...f, ...d, ...e, ...f);
      else vertices.push(...a, ...f, ...d, ...d, ...f, ...e);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.computeVertexNormals(); b.add('tile', geometry);
    const spacing = quality === 'low' ? 0.85 : quality === 'high' ? 0.32 : 0.62;
    const count = Math.max(4, Math.ceil((face < 2 ? width : depth) / spacing));
    const tileRows = quality === 'low' ? 4 : quality === 'high' ? 14 : 8;
    // Ngói ống nửa tròn, từng viên có khe nối; không thành tấm gợn sóng liền.
    for (let c = 1; c < count; c++) {
      const tileVertices = [], radius = Math.min(0.065, depth * 0.017);
      for (let r = 0; r < tileRows; r++) {
        const start = new THREE.Vector3(...point(face, -1 + 2 * c / count, (r + 0.015) / tileRows));
        const end = new THREE.Vector3(...point(face, -1 + 2 * c / count, (r + 0.985) / tileRows));
        start.y += 0.025; end.y += 0.025;
        const tangent = end.clone().sub(start).normalize();
        const right = tangent.clone().cross(new THREE.Vector3(0, 1, 0)).normalize();
        const up = right.clone().cross(tangent).normalize();
        const sides = quality === 'high' ? 5 : 3;
        function arch(center, i) {
          const angle = i / sides * Math.PI;
          return center.clone().addScaledVector(right, Math.cos(angle) * radius)
            .addScaledVector(up, Math.sin(angle) * radius).toArray();
        }
        for (let i = 0; i < sides; i++) {
          const a = arch(start, i), d = arch(start, i + 1), e = arch(end, i), f = arch(end, i + 1);
          tileVertices.push(...a, ...e, ...d, ...d, ...e, ...f);
        }
      }
      const tileGeometry = new THREE.BufferGeometry();
      tileGeometry.setAttribute('position', new THREE.Float32BufferAttribute(tileVertices, 3));
      tileGeometry.computeVertexNormals(); b.add(c % 4 === 0 ? 'tileLight' : 'tile', tileGeometry);
    }
    const edge = [];
    for (let i = 0; i <= rows * 2; i++) edge.push(point(face, -1 + i / rows, 1));
    b.path('wood', edge.map(p => [p[0], p[1] - 0.10 * trim, p[2]]), 0.095 * trim);
    b.path('tileLight', edge, 0.085 * trim);
  }
  for (let face = 0; face < 4; face++) surface(face);
  // Bốn bờ guột liền mạch vươn khỏi diềm thành đầu đao.
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const points = [];
    for (let i = 0; i <= rows; i++) points.push(point(sz === 1 ? 0 : 1, sx, i / rows));
    const tip = points[points.length - 1];
    points.push([tip[0] + sx * depth * 0.045, tip[1] + depth * 0.12, tip[2] + sz * depth * 0.04]);
    b.path('tileLight', points, 0.115 * trim);
    const end = points[points.length - 1];
    b.path('gold', [end, [end[0] - sx * 0.05 * trim, end[1] + 0.18 * trim, end[2]],
      [end[0] - sx * 0.16 * trim, end[1] + 0.14 * trim, end[2]]], 0.035 * trim);
  }
  b.beam('tileLight', [-ridge, base + rise + 0.06 * trim, 0], [ridge, base + rise + 0.06 * trim, 0], 0.14 * trim);
  // Kìm nóc cách điệu: thân cong, mõm, mắt và sừng, hai đầu quay vào giữa.
  for (const sign of [-1, 1]) {
    const x = sign * ridge, y = base + rise;
    const decoration = [[0, 0.06], [0.24, 0.34], [0.20, 0.70], [-0.12, 0.83], [-0.32, 0.63]];
    b.path('tileLight', decoration.map(([dx, dy]) => [x + sign * dx * trim, y + dy * trim, 0]), 0.12 * trim);
    b.ball('gold', x - sign * 0.18 * trim, y + 0.76 * trim, 0.105 * trim, 0.04 * trim);
    b.beam('gold', [x + sign * 0.18 * trim, y + 0.68 * trim, 0],
      [x + sign * 0.35 * trim, y + 0.97 * trim, 0], 0.015 * trim, 0.06 * trim);
  }
}

/** Mái rời; width/depth là kích thước phủ bì diềm, chưa tính đầu đao. */
export function roof({ width = 18.4, depth = 12.4, tiers = 1, quality = 'medium' } = {}) {
  const b = builder(quality);
  roofTier(b, width, depth, 0.20, quality);
  if (tiers === 2) {
    b.box('lacquer', 0, depth * 0.17, 0, width * 0.66, depth * 0.14, depth * 0.56);
    b.box('gold', 0, depth * 0.23, 0, width * 0.68, 0.07, depth * 0.58);
    roofTier(b, width * 0.76, depth * 0.73, depth * 0.225, quality);
  }
  const group = b.finish('roof'); group.userData = { width, depth, tiers, quality }; return group;
}

// Giữ chữ ký vòng 1; gọi roof({...}) khi cần mái phủ một gian lớn.
export function createRoof(quality = 'medium') {
  return roof({ width: 3.6, depth: 2.8, ...options(quality) });
}

export function createColumn(quality = 'medium') {
  const b = builder(options(quality).quality);
  b.cylinder('stone', 0, 0.10, 0, 0.25, 0.30, 0.2);
  b.cylinder('stoneLight', 0, 0.24, 0, 0.23, 0.25, 0.08);
  b.cylinder('lacquer', 0, 1.38, 0, 0.16, 0.20, 2.2);
  for (const y of [0.32, 2.45]) b.cylinder('gold', 0, y, 0, 0.205, 0.205, 0.055);
  b.box('wood', 0, 2.58, 0, 0.54, 0.20, 0.48); return b.finish('column');
}

export function createWall(quality = 'medium') {
  const b = builder(options(quality).quality);
  b.box('plaster', 0, 1.15, 0, 2.4, 2.3, 0.18);
  b.box('stone', 0, 0.18, 0, 2.45, 0.36, 0.23);
  b.box('wood', 0, 2.3, 0, 2.5, 0.16, 0.25);
  for (const x of [-1.14, 1.14]) b.box('lacquer', x, 1.3, 0.12, 0.1, 2.1, 0.08);
  return b.finish('wall');
}

export function createDoor(quality = 'medium') {
  const b = builder(options(quality).quality);
  for (let i = 0; i < 4; i++) {
    const x = -0.72 + i * 0.48;
    b.box('lacquer', x, 0.70, 0, 0.455, 1.4, 0.12);
    b.box('woodLight', x, 0.70, 0.065, 0.32, 1.02, 0.025);
    for (const y of [0.27, 1.10, 1.43, 2.12]) b.box('wood', x, y, 0.02, 0.46, 0.065, 0.16);
    for (let j = -2; j <= 2; j++) b.box('wood', x + j * 0.08, 1.78, 0, 0.025, 0.65, 0.10);
    for (const y of [1.60, 1.80, 2.00]) b.box('wood', x, y, 0, 0.44, 0.026, 0.10);
    b.ball('gold', x + 0.13, 0.95, 0.1, 0.025);
  }
  b.box('wood', 0, 2.24, 0, 2.10, 0.16, 0.25);
  b.box('stoneLight', 0, 0.045, 0, 2.12, 0.09, 0.32); return b.finish('door');
}

export function createFloor(quality = 'medium') {
  const b = builder(options(quality).quality); b.box('tile', 0, 0.04, 0, 2.4, 0.08, 2.4);
  for (let i = -2; i <= 2; i++) {
    b.box('tileLight', i * 0.48, 0.082, 0, 0.012, 0.005, 2.4);
    b.box('tileLight', 0, 0.082, i * 0.48, 2.4, 0.005, 0.012);
  }
  return b.finish('floor');
}

export function createSteps(quality = 'medium') {
  const b = builder(options(quality).quality);
  for (let i = 0; i < 3; i++) b.box(i % 2 ? 'stoneLight' : 'stone', 0, 0.09 + i * 0.18, -i * 0.20, 2.4, 0.18, 1.2 - i * 0.4);
  return b.finish('steps');
}

/** Một gian chánh điện, mặt tiền +Z, kích thước thân nhà chưa tính hiên/mái. */
export function templeHall({ width = 16, depth = 10, quality = 'medium', tiers = 2 } = {}) {
  const b = builder(quality), floor = 0.72, eave = 4.85;
  for (let i = 0; i < 3; i++) b.box(i === 2 ? 'stoneLight' : 'stone', 0, 0.12 + i * 0.24, 0,
    width + 1.8 - i * 0.55, 0.24, depth + 1.8 - i * 0.55);
  b.box('tile', 0, floor + 0.025, 0, width, 0.05, depth);
  for (const x of [-width / 2 + 0.3, width / 2 - 0.3]) {
    b.box('plaster', x, 2.65, -0.65, 0.25, 3.85, depth - 1.5);
    b.box('stone', x, 1.0, -0.65, 0.3, 0.55, depth - 1.5);
    b.box('wood', x, eave - 0.1, 0, 0.32, 0.3, depth);
  }
  b.box('plaster', 0, 2.65, -depth / 2 + 0.2, width, 3.85, 0.25);
  for (const z of [depth / 2 - 0.45, -depth / 2 + 0.5]) {
    b.box('wood', 0, eave - 0.1, z, width, 0.32, 0.32);
    for (let i = 0; i <= 6; i++) {
      const x = (i / 6 - 0.5) * (width - 0.9);
      b.merge(createColumn(quality), x, floor, z, 1.22, (eave - floor) / 2.68, 1.22);
      for (const sign of [-1, 1]) b.beam('woodLight', [x, eave - 0.75, z], [x + sign * 0.65, eave - 0.25, z], 0.075);
    }
  }
  const bay = (width - 0.9) / 6;
  for (let i = 0; i < 6; i++) b.merge(createDoor(quality), (i - 2.5) * bay, floor, depth / 2 - 1.8, bay / 2.13, 1.57, 1);
  b.box('lacquer', 0, 4.16, depth / 2 - 0.25, width * 0.28, 0.65, 0.12);
  for (const y of [3.86, 4.46]) b.box('gold', 0, y, depth / 2 - 0.17, width * 0.28, 0.035, 0.035);
  // Họa tiết hình học, không giả chữ Hán hay gắn biển tên vào cảnh dùng chung.
  for (const x of [-0.85, 0, 0.85]) b.box('gold', x, 4.16, depth / 2 - 0.17, 0.22, 0.22, 0.04, Math.PI / 4);
  for (let i = 0; i < 4; i++) b.box(i % 2 ? 'stoneLight' : 'stone', 0, 0.09 + i * 0.18,
    depth / 2 + 0.9 - i * 0.23, width * 0.36, 0.18, 1.6 - i * 0.32);
  b.merge(roof({ width: width + 2.4, depth: depth + 2.4, tiers, quality }), 0, eave, 0);
  const group = b.finish('templeHall'); group.userData = { width, depth, tiers, quality }; return group;
}

export function createLantern(quality = 'medium') {
  const b = builder(options(quality).quality);
  b.ring('bronze', 0, 1.72, 0, 0.065, 0.015);
  b.beam('dark', [0, 1.5, 0], [0, 1.68, 0], 0.012);
  b.ball('fabric', 0, 1.16, 0, 0.30, 1, 1.17, 1);
  for (const y of [0.84, 1.48]) b.cylinder('gold', 0, y, 0, 0.18, 0.18, 0.07);
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4;
    b.path('cushion', [0.86, 1.02, 1.28, 1.46].map(y => {
      const radius = 0.16 + 0.14 * Math.sin((y - 0.84) / 0.64 * Math.PI);
      return [Math.cos(a) * radius, y, Math.sin(a) * radius];
    }), 0.009, 3);
  }
  b.cylinder('gold', 0, 0.75, 0, 0.04, 0.04, 0.12);
  for (let i = 0; i < 7; i++) b.beam('fabric', [(i - 3) * 0.014, 0.69, 0], [(i - 3) * 0.026, 0.35, 0], 0.008);
  return b.finish('lantern');
}

export function createCushion(quality = 'medium') {
  const b = builder(options(quality).quality);
  b.cylinder('fabric', 0, 0.09, 0, 0.38, 0.4, 0.18);
  b.cylinder('cushion', 0, 0.19, 0, 0.34, 0.36, 0.04);
  b.ring('gold', 0, 0.19, 0, 0.36, 0.012, Math.PI / 2); return b.finish('cushion');
}

export function createBookshelf(quality = 'medium') {
  const b = builder(options(quality).quality);
  b.box('wood', 0, 0.92, -0.22, 1.6, 1.84, 0.06);
  for (const x of [-0.77, 0.77]) b.box('wood', x, 0.92, 0, 0.10, 1.84, 0.52);
  b.box('woodLight', 0, 1.88, 0, 1.75, 0.12, 0.60);
  const colors = ['fabric', 'blue', 'green', 'cushion', 'ivory'];
  for (let row = 0; row < 3; row++) {
    const y = 0.15 + row * 0.56;
    b.box('woodLight', 0, y, 0, 1.5, 0.08, 0.52);
    for (let col = 0; col < 9; col++) {
      const x = -0.62 + col * 0.153, h = 0.32 + ((col + row) % 3) * 0.05;
      b.box(colors[(col + row) % colors.length], x, y + 0.04 + h / 2, 0.025, 0.115, h, 0.32);
      for (const dy of [0.08, h - 0.04]) b.box('gold', x, y + dy, 0.19, 0.12, 0.015, 0.012);
    }
  }
  return b.finish('bookshelf');
}

export function createStoneTable(quality = 'medium') {
  const b = builder(options(quality).quality);
  b.cylinder('stone', 0, 0.36, 0, 0.15, 0.24, 0.72);
  b.cylinder('stoneLight', 0, 0.75, 0, 0.64, 0.64, 0.12);
  for (const x of [-1.0, 1.0]) {
    b.cylinder('stone', x, 0.2, 0, 0.14, 0.19, 0.4);
    b.cylinder('stoneLight', x, 0.43, 0, 0.26, 0.26, 0.08);
  }
  return b.finish('stoneTable');
}

export function createBodhiTree(quality = 'medium') {
  const b = builder(options(quality).quality);
  b.cylinder('wood', 0, 1.3, 0, 0.16, 0.36, 2.6);
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI / 3;
    b.beam('wood', [0, 0.45, 0], [Math.cos(a) * 0.65, 0.05, Math.sin(a) * 0.65], 0.10, 0.04);
    const x = Math.cos(a) * 1.05, z = Math.sin(a) * 0.95;
    b.beam('wood', [0, 1.45 + (i % 2) * 0.3, 0], [x, 2.65 + (i % 2) * 0.2, z], 0.055, 0.14);
    b.ball(i % 2 ? 'leafLight' : 'leaf', x, 2.8 + (i % 2) * 0.2, z, 0.88, 1.05, 0.64, 1);
    b.ball('leaf', x * 0.65, 3.33, z * 0.65, 0.72, 1, 0.8, 1);
  }
  b.ball('leafLight', 0, 3.67, 0, 0.8, 1.15, 0.7, 1); return b.finish('bodhiTree');
}

export function createIncenseBurner(quality = 'medium') {
  const b = builder(options(quality).quality);
  for (let i = 0; i < 3; i++) {
    const a = i * Math.PI * 2 / 3;
    b.beam('bronze', [Math.cos(a) * 0.25, 0.40, Math.sin(a) * 0.25], [Math.cos(a) * 0.34, 0.05, Math.sin(a) * 0.34], 0.055, 0.08);
  }
  b.lathe('bronze', [[0.16, 0.24], [0.32, 0.30], [0.40, 0.47], [0.38, 0.66], [0.33, 0.71]]);
  b.ring('gold', 0, 0.68, 0, 0.37, 0.035, Math.PI / 2);
  b.lathe('bronze', [[0.39, 0.72], [0.35, 0.80], [0.23, 0.91], [0.07, 0.96], [0, 0.98]]);
  for (const x of [-0.46, 0.46]) b.ring('bronze', x, 0.68, 0, 0.14, 0.035);
  b.ball('gold', 0, 1.04, 0, 0.10, 1, 0.8, 1);
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4;
    b.ball('dark', Math.cos(a) * 0.25, 0.83, Math.sin(a) * 0.25, 0.025);
  }
  return b.finish('incenseBurner');
}

export function createBell(quality = 'medium') {
  const b = builder(options(quality).quality);
  // Chuông rỗng, miệng loe, vai tròn và quai treo phía trên.
  b.lathe('bronze', [[0.43, 0.04], [0.47, 0.09], [0.41, 0.16], [0.35, 0.45],
    [0.32, 0.86], [0.25, 1.03], [0.13, 1.09], [0.06, 1.10],
    [0.08, 1.02], [0.24, 0.96], [0.28, 0.80], [0.31, 0.44], [0.37, 0.13], [0.41, 0.04]]);
  for (const [y, r] of [[0.12, 0.44], [0.38, 0.36], [0.89, 0.30]]) b.ring('gold', 0, y, 0, r, 0.018, Math.PI / 2);
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2;
    b.ball('gold', Math.cos(a) * 0.34, 0.63, Math.sin(a) * 0.34, 0.065, 1, 0.75, 1);
  }
  b.ring('bronze', 0, 1.21, 0, 0.12, 0.055); return b.finish('bell');
}

export function createWoodenFish(quality = 'medium') {
  const b = builder(options(quality).quality);
  b.merge(createCushion(quality), 0, 0, 0, 1.2, 0.7, 1);
  b.ball('woodLight', 0, 0.38, 0, 0.38, 1.25, 0.72, 1);
  b.path('dark', [[-0.36, 0.42, 0.18], [-0.18, 0.42, 0.32], [0.12, 0.42, 0.35], [0.36, 0.42, 0.19]], 0.024, 4);
  for (const x of [-0.27, 0.27]) {
    b.ball('wood', x, 0.43, 0.28, 0.075); b.ball('gold', x, 0.46, 0.33, 0.022);
  }
  b.beam('wood', [0.54, 0.04, 0.36], [0.74, 0.09, -0.22], 0.025);
  b.ball('cushion', 0.74, 0.09, -0.22, 0.085); return b.finish('woodenFish');
}

export function createBuddhaStatue(quality = 'medium') {
  const b = builder(options(quality).quality);
  b.cylinder('stone', 0, 0.12, 0, 0.94, 1.04, 0.24);
  b.cylinder('gold', 0, 0.30, 0, 0.78, 0.87, 0.16);
  for (let row = 0; row < 2; row++) for (let i = 0; i < 12; i++) {
    const a = (i + row * 0.5) * Math.PI / 6;
    const geometry = new THREE.SphereGeometry(1, 6, 4);
    geometry.scale(0.20, 0.27, 0.10); geometry.rotateZ(-0.35); geometry.rotateY(-a);
    b.add(row ? 'gold' : 'bronze', geometry, Math.sin(a) * 0.74, 0.42 + row * 0.12, Math.cos(a) * 0.74);
  }
  b.ring('gold', 0, 1.90, -0.46, 0.93, 0.055);
  b.ring('bronze', 0, 1.90, -0.47, 1.02, 0.018);
  for (let i = 0; i < 16; i++) {
    const a = i * Math.PI / 8;
    b.beam('gold', [Math.sin(a) * 1.03, 1.90 + Math.cos(a) * 1.03, -0.47],
      [Math.sin(a) * 1.12, 1.90 + Math.cos(a) * 1.12, -0.47], 0.015);
  }
  b.ball('gold', -0.36, 0.76, 0.17, 0.48, 1.25, 0.44, 0.83);
  b.ball('gold', 0.36, 0.76, 0.17, 0.48, 1.25, 0.44, 0.83);
  b.ball('gold', 0, 1.25, -0.03, 0.49, 0.82, 1.22, 0.62);
  b.ball('gold', 0, 1.98, 0, 0.29, 0.87, 1.14, 0.86);
  b.ball('bronze', 0, 2.20, -0.02, 0.26, 0.95, 0.60, 0.92);
  b.ball('gold', 0, 2.34, -0.02, 0.10, 0.8, 1.2, 0.8);
  for (const x of [-0.27, 0.27]) b.ball('gold', x, 1.96, 0, 0.07, 0.7, 1.65, 0.65);
  b.ball('gold', 0, 1.98, 0.245, 0.045, 0.75, 1, 1.2);
  for (const x of [-0.10, 0.10]) b.beam('bronze', [x - 0.045, 2.035, 0.226], [x + 0.045, 2.025, 0.232], 0.009);
  b.path('bronze', [[-0.065, 1.88, 0.226], [0, 1.866, 0.24], [0.065, 1.88, 0.226]], 0.008, 3);
  for (const sign of [-1, 1]) {
    b.beam('gold', [sign * 0.34, 1.51, 0], [sign * 0.54, 1.10, 0.10], 0.13, 0.11);
    b.beam('gold', [sign * 0.54, 1.10, 0.10], [sign * 0.16, 0.94, 0.38], 0.10, 0.08);
    b.ball('gold', sign * 0.12, 0.95, 0.39, 0.11, 1.5, 0.45, 0.8);
  }
  b.path('bronze', [[-0.29, 1.55, 0.20], [-0.10, 1.30, 0.30], [0.24, 1.02, 0.27]], 0.018);
  return b.finish('buddhaStatue');
}

export function createAltar(quality = 'medium') {
  const b = builder(options(quality).quality);
  for (const x of [-1.16, 1.16]) for (const z of [-0.44, 0.44]) {
    b.box('wood', x, 0.49, z, 0.16, 0.98, 0.16); b.box('gold', x, 0.14, z, 0.18, 0.07, 0.18);
  }
  b.box('lacquer', 0, 0.86, 0, 2.65, 0.26, 1.18);
  b.box('woodLight', 0, 1.04, 0, 2.84, 0.12, 1.32);
  b.box('fabric', 0, 1.11, 0.03, 2.76, 0.025, 1.30);
  b.box('fabric', 0, 0.90, 0.68, 2.76, 0.44, 0.025);
  b.box('gold', 0, 0.69, 0.70, 2.78, 0.035, 0.025);
  for (const x of [-0.8, 0, 0.8]) b.box('gold', x, 0.90, 0.70, 0.13, 0.13, 0.025, Math.PI / 4);
  for (let i = 0; i < 2; i++) {
    b.box('lacquer', 0, 1.25 + i * 0.27, -0.28 - i * 0.16, 2.42 - i * 0.34, 0.25, 0.58 - i * 0.22);
    b.box('gold', 0, 1.38 + i * 0.27, -0.28 - i * 0.16, 2.48 - i * 0.34, 0.035, 0.60 - i * 0.22);
  }
  return b.finish('altar');
}

export function createOfferings(quality = 'medium') {
  const b = builder(options(quality).quality);
  b.lathe('bronze', [[0, 0.02], [0.58, 0.02], [0.63, 0.07], [0.62, 0.10], [0.05, 0.06]]);
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI / 3;
    b.ball(i % 2 ? 'redFruit' : 'fruit', 0.18 + Math.cos(a) * 0.18, 0.17, Math.sin(a) * 0.19, 0.10);
  }
  b.ball('fruit', 0.18, 0.31, 0, 0.11);
  b.lathe('blue', [[0.06, 0.08], [0.10, 0.14], [0.11, 0.26], [0.055, 0.36], [0.07, 0.40]], -0.30);
  for (let i = 0; i < 4; i++) {
    const x = -0.30 + (i - 1.5) * 0.075, y = 0.66 + (i % 2) * 0.1;
    b.beam('green', [-0.30, 0.36, 0], [x, y, 0], 0.009);
    for (let j = 0; j < 5; j++) {
      const a = j * Math.PI * 2 / 5;
      b.ball('ivory', x + Math.cos(a) * 0.043, y + Math.sin(a) * 0.043, 0.01, 0.04, 1, 1, 0.5);
    }
    b.ball('gold', x, y, 0.035, 0.025);
  }
  for (const z of [-0.28, 0.28]) {
    b.cylinder('gold', 0.42, 0.13, z, 0.07, 0.10, 0.12);
    b.cylinder('ivory', 0.42, 0.30, z, 0.035, 0.035, 0.24);
    b.ball('flame', 0.42, 0.46, z, 0.033, 0.7, 1.8, 0.7);
  }
  return b.finish('offerings');
}

export function createIncenseBowl(quality = 'medium') {
  const b = builder(options(quality).quality);
  b.cylinder('bronze', 0, 0.05, 0, 0.16, 0.22, 0.10);
  b.lathe('bronze', [[0.15, 0.09], [0.25, 0.16], [0.28, 0.35], [0.30, 0.39], [0.24, 0.39], [0.22, 0.17]]);
  b.cylinder('stoneLight', 0, 0.33, 0, 0.25, 0.25, 0.03);
  b.ring('gold', 0, 0.39, 0, 0.28, 0.022, Math.PI / 2);
  for (let i = 0; i < 9; i++) {
    const a = i * 2.4, radius = 0.04 + (i % 3) * 0.04, x = Math.cos(a) * radius, z = Math.sin(a) * radius;
    const h = i < 3 ? 0.45 : 0.15 + (i % 3) * 0.05;
    b.beam('fabric', [x, 0.34, z], [x * 1.3, 0.34 + h * 0.45, z], 0.008);
    if (i < 3) {
      b.beam('woodLight', [x * 1.3, 0.34 + h * 0.45, z], [x * 1.6, 0.34 + h, z], 0.006);
      b.ball('flame', x * 1.6, 0.34 + h, z, 0.009);
    }
  }
  return b.finish('incenseBowl');
}

export function createFortuneTube(quality = 'medium') {
  const b = builder(options(quality).quality);
  b.lathe('lacquer', [[0, 0], [0.18, 0], [0.20, 0.43], [0.17, 0.43], [0.15, 0.05], [0, 0.05]]);
  for (const y of [0.06, 0.39]) b.ring('gold', 0, y, 0, 0.19, 0.014, Math.PI / 2);
  for (let i = 0; i < 17; i++) {
    const a = i * 2.4, r = 0.025 + (i % 4) * 0.03, x = Math.cos(a) * r, z = Math.sin(a) * r;
    const h = 0.57 + (i % 5) * 0.027;
    b.box('cushion', x, (h + 0.1) / 2, z, 0.025, h - 0.1, 0.018);
    b.box('fabric', x, h - 0.018, z + 0.011, 0.027, 0.06, 0.007);
  }
  return b.finish('fortuneTube');
}

export function createBellStand(quality = 'medium') {
  const b = builder(options(quality).quality);
  for (const x of [-1.02, 1.02]) {
    b.box('stone', x, 0.1, 0, 0.48, 0.2, 0.9);
    b.box('wood', x, 1.28, 0, 0.18, 2.36, 0.20);
    b.beam('woodLight', [x, 1.76, 0], [x * 0.60, 2.32, 0], 0.075);
  }
  b.box('lacquer', 0, 2.40, 0, 2.62, 0.22, 0.32);
  b.path('dark', [[0, 2.35, 0], [0, 2.15, 0]], 0.025);
  b.merge(createBell(quality), 0, 0.63, 0, 1.14);
  for (const z of [-0.25, 0.25]) b.beam('dark', [0.94, 2.3, z], [0.83, 1.15, z], 0.013);
  b.beam('woodLight', [0.57, 1.15, 0.25], [1.20, 1.15, -0.25], 0.10);
  return b.finish('bellStand');
}

export function createOilLamp(quality = 'medium') {
  const b = builder(options(quality).quality);
  b.lathe('bronze', [[0, 0], [0.17, 0], [0.16, 0.05], [0.07, 0.12], [0.04, 0.34], [0.15, 0.40], [0.19, 0.48], [0.13, 0.48], [0.02, 0.40]]);
  b.cylinder('dark', 0, 0.445, 0, 0.13, 0.13, 0.012);
  b.beam('ivory', [0.11, 0.45, 0], [0.16, 0.49, 0], 0.013);
  b.ball('flame', 0.16, 0.55, 0, 0.038, 0.7, 1.9, 0.7); return b.finish('oilLamp');
}

export function createWeaponRack(quality = 'medium') {
  const b = builder(options(quality).quality);
  for (const x of [-0.85, 0.85]) {
    b.box('wood', x, 0.09, 0, 0.38, 0.18, 0.86);
    b.box('lacquer', x, 0.95, 0, 0.12, 1.8, 0.16);
  }
  for (const y of [0.48, 1.43]) b.box('woodLight', 0, y, 0, 1.9, 0.12, 0.22);
  for (let i = 0; i < 5; i++) {
    const x = (i - 2) * 0.31;
    b.beam('wood', [x, 0.16, 0.19], [x, 1.90, 0.19], 0.024);
    b.cylinder('gold', x, 1.64, 0.19, 0.035, 0.035, 0.12);
    if (i % 2 === 0) b.add('stoneLight', new THREE.ConeGeometry(0.075, 0.36, 4), x, 2.04, 0.19);
    else {
      b.box('stoneLight', x, 1.95, 0.19, 0.085, 0.52, 0.035);
      b.box('gold', x, 1.68, 0.19, 0.23, 0.045, 0.07);
    }
  }
  return b.finish('weaponRack');
}

export function createDrum(quality = 'medium') {
  const b = builder(options(quality).quality);
  for (const x of [-0.58, 0.58]) for (const z of [-0.32, 0.32]) b.beam('wood', [x, 0.04, z * 1.5], [x, 0.85, -z], 0.065);
  b.box('wood', 0, 0.45, 0, 1.25, 0.12, 0.20);
  const drum = new THREE.LatheGeometry([[0, -0.40], [0.42, -0.40], [0.49, -0.24],
    [0.54, 0], [0.49, 0.24], [0.42, 0.40], [0, 0.40]].map(p => new THREE.Vector2(...p)), b.segments);
  b.add('lacquer', drum, 0, 1.14, 0, Math.PI / 2);
  for (const z of [-0.405, 0.405]) {
    b.add('ivory', new THREE.CircleGeometry(0.413, b.segments), 0, 1.14, z, 0, z < 0 ? Math.PI : 0);
    b.ring('gold', 0, 1.14, z, 0.42, 0.026);
    for (let i = 0; i < 12; i++) {
      const a = i * Math.PI / 6;
      b.box('bronze', Math.cos(a) * 0.38, 1.14 + Math.sin(a) * 0.38, z * 1.02, 0.027, 0.027, 0.027);
    }
  }
  b.beam('woodLight', [-0.45, 0.57, 0.35], [0.35, 0.59, 0.35], 0.025);
  b.ball('fabric', 0.35, 0.59, 0.35, 0.06); return b.finish('drum');
}

export function createBanner(quality = 'medium') {
  const b = builder(options(quality).quality);
  b.cylinder('stone', 0, 0.10, 0, 0.25, 0.32, 0.2);
  b.cylinder('wood', 0, 1.64, 0, 0.035, 0.05, 3.08);
  b.beam('gold', [-0.50, 2.95, 0], [0.50, 2.95, 0], 0.03);
  b.ball('gold', 0, 3.24, 0, 0.075);
  for (let i = 0; i < 5; i++) {
    b.box(['fabric', 'cushion', 'blue', 'ivory', 'green'][i], (i - 2) * 0.16, 2.13, 0, 0.16, 1.55, 0.018);
    b.box('gold', (i - 2) * 0.16, 1.32, 0, 0.02, 0.15 + (i % 2) * 0.12, 0.02);
  }
  return b.finish('banner');
}

export function createGate(quality = 'medium') {
  const opts = options(quality), b = builder(opts.quality);
  for (const x of [-2.65, -1.16, 1.16, 2.65]) {
    const height = Math.abs(x) < 2 ? 3.35 : 2.70;
    b.box('stone', x, 0.13, 0, 0.58, 0.26, 0.80);
    b.box('plaster', x, height / 2 + 0.20, 0, 0.38, height, 0.52);
    b.box('lacquer', x, height / 2 + 0.20, 0.28, 0.18, height - 0.3, 0.04);
    b.box('gold', x, height + 0.20, 0, 0.49, 0.12, 0.65);
  }
  b.box('lacquer', 0, 3.20, 0, 2.55, 0.50, 0.62);
  b.merge(roof({ width: 3.35, depth: 1.85, quality: opts.quality }), 0, 3.52, 0);
  for (const sign of [-1, 1]) {
    b.box('wood', sign * 1.92, 2.67, 0, 1.58, 0.28, 0.58);
    b.merge(roof({ width: 1.92, depth: 1.50, quality: opts.quality }), sign * 1.99, 2.84, 0);
  }
  b.box('stoneLight', 0, 0.06, 0, 6.15, 0.12, 1.40); return b.finish('gate');
}

// Chỉ gọi khi mọi cảnh dùng kit đã tháo; các nhóm hiện có sẽ mất tài nguyên GPU.
export function disposeKit() {
  for (const geometry of geometries) geometry.dispose();
  geometries.clear();
  for (const key of Object.keys(materials)) { materials[key].dispose(); delete materials[key]; }
}
