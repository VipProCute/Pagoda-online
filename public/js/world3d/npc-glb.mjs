'use strict';

import * as THREE from 'three';

// NPC có mô hình .glb riêng ở bản 3D (bản 2D không đổi):
//   Obito (T-212) · Tế Công = Lão Ăn Mày, Vạn Lý Độc Hành, Tảo Địa Tăng, bốn cô nương, thầy bói Tarot (T-213).
// Bản dựng bằng mã vẫn là THẾ THÂN: giữ nhãn tên, bong bóng lời, bóng chân; .glb nạp xong thì ẩn cây `hips` của bản mã.
// Mô hình không có clip chuyển động: đi, thở, vái, nói đều xoay xương bằng mã, giảm chuyển động thì đứng yên.
// .glb lỗi hoặc 404 thì giữ nguyên thế thân, không ghi console.
// Mô hình T-213 dựng bằng tools/blender/npc/build.py (bộ xương chung `npc`), không sửa tay tệp .glb.

const NPC_DIR = '/models/npc/';
const model = (file, v, extra) => Object.freeze({ url: NPC_DIR + file + '.glb?v=' + v, rig: 'npc', arm: 0, stride: 0.38, ...extra });

export const NPC_GLB = Object.freeze({
  obito: Object.freeze({
    url: NPC_DIR + 'obito.glb?v=1',
    rig: 'obito',
    height: 1.62,            // m, cao hơn khách một chút vì tóc dựng
    hide: /bomb/i,           // bỏ quả bom đất sét trên tay phải: không hợp cảnh chùa
    arm: 0.6,                // rad, hạ hai tay từ tư thế chữ A xuống: tay áo buông hai bên (0,85 thì tay lẫn vào thân áo)
    stride: 0.3              // rad, biên độ bước: áo choàng dài, bước lớn thì chân thò qua vạt áo
  }),
  beggar: model('te-cong', 1, { height: 1.6 }),                         // Tế Công
  wanderer: model('van-ly', 1, { height: 1.66, hold: true }),           // Vạn Lý Độc Hành, tay phải cầm đao
  sweeper: model('tao-dia', 1, { height: 1.56, hold: true, stride: 0.3 }) // Tảo Địa Tăng, tay phải cầm chổi, áo dài bước ngắn
});

// Bốn cô nương: chọn mô hình theo màu áo trong look (Đỏ 0, Hồng 2, Trắng ngà 5, Cam 7), màu đã nhuộm sẵn trong tệp.
// height đo cả dù và búi tóc; váy dài thì bước ngắn, tay áo rộng thì đánh tay nhẹ.
export const LADY_GLB = Object.freeze({
  0: model('co-nuong-do', 1, { height: 1.68, hold: true, stride: 0.22, armSwing: 0.3 }), // Hán phục đỏ cầm dù
  2: model('co-nuong-hong', 1, { height: 1.56, stride: 0.34 }),                          // sườn xám hồng sen
  5: model('co-nuong-lam', 1, { height: 1.56, stride: 0.2, armSwing: 0.25 }),            // Hán phục xanh lam
  7: model('co-nuong-cam', 1, { height: 1.54, stride: 0.28, armSwing: 0.25 })            // áo cổ trang cam đào
});

// Thầy bói ở Sân chùa (vai 'reader'): chỉ thầy bói Tarot (áo tím, c = 4) có mô hình riêng, ngồi yên, không xương.
// height 1,2 m để mặt ghế của tượng (≈ 0,45 m) khớp ghế đá trong scenes/yard.mjs. Thầy Tử Vi vẫn là bản mã.
export const READER_GLB = Object.freeze({
  4: Object.freeze({ url: NPC_DIR + 'thay-boi-tarot.glb?v=1', rig: 'none', height: 1.2, stride: 0 })
});

// Mô hình cho vai NPC (hoặc null: dùng bản mã). Cô nương chọn theo màu áo, màu lạ thì theo số dư.
export function npcModel(role, look = {}) {
  if (role === 'reader') return READER_GLB[Number(look.c)] || null;
  if (role === 'lady') {
    const keys = Object.keys(LADY_GLB);
    const c = Number(look.c) || 0;
    return LADY_GLB[c] || LADY_GLB[keys[Math.abs(c) % keys.length]];
  }
  return Object.hasOwn(NPC_GLB, role) ? NPC_GLB[role] : null;
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const finite = (v, fallback = 0) => Number.isFinite(v) ? v : fallback;
// Tên xương sau GLTFLoader: khoảng trắng thành '_', ví dụ 'leg_right_thigh_090'.
const plain = name => String(name || '').toLowerCase().replace(/[\s_]+/g, ' ');
const RIGS = Object.freeze({
  obito: Object.freeze({
    spine: /^spine lower/, chest: /^spine upper/, neck: /^head neck lower/, head: /^head neck upper/,
    armR: /^arm right shoulder/, armL: /^arm left shoulder/, elbowR: /^arm right elbow/, elbowL: /^arm left elbow/,
    thighR: /^leg right thigh/, thighL: /^leg left thigh/, kneeR: /^leg right knee/, kneeL: /^leg left knee/,
    // Vạt áo choàng: front 1a bên trái (+x), front 2a bên phải; hai vạt sau cũng theo chân cùng bên.
    flapL: /^cloak front 1a/, flapR: /^cloak front 2a/, backL: /^cloak left back 1a/, backR: /^cloak right back 1a/
  }),
  // Bộ xương của tools/blender/npc/build.py. Trục cục bộ: Y dọc xương; thân và chân xoay quanh X (+ là cúi / đưa ra sau),
  // tay xoay quanh Z (+: tay phải ra trước, tay trái ra sau), đầu nghiêng quanh Z.
  npc: Object.freeze({
    spine: /^spine$/, chest: /^chest$/, head: /^head$/,
    armR: /^arm r$/, armL: /^arm l$/, elbowR: /^forearm r$/, elbowL: /^forearm l$/,
    thighR: /^thigh r$/, thighL: /^thigh l$/, kneeR: /^shin r$/, kneeL: /^shin l$/
  })
});

// Khung bao của các lưới còn hiện (bỏ vật đã ẩn) ở tư thế gốc.
function measure(root) {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3();
  root.traverse(node => { if (node.isMesh && node.visible) box.expandByObject(node, false); });
  return box.isEmpty() ? null : { minY: box.min.y, height: box.max.y - box.min.y };
}

// Vật liệu gốc có thể là unlit hoặc kim loại: đổi sang vật liệu nhám có ánh sáng như khách, giữ ảnh màu và ảnh pháp tuyến.
function litCopy(material) {
  return new THREE.MeshStandardMaterial({
    name: material?.name || '', map: material?.map || null, normalMap: material?.normalMap || null,
    color: material?.color || 0xffffff, side: material?.side ?? THREE.FrontSide,
    transparent: !!material?.transparent, alphaTest: material?.alphaTest || 0, roughness: 0.92, metalness: 0
  });
}

// Gắn mô hình .glb cho NPC `role` lên avatar bản mã `base`. Trả cùng giao diện { group, update, setLook, dispose, fx }.
export function attachNpcGlb(base, role, opts = {}, loader) {
  const spec = npcModel(role, base.group.userData.look || {});
  const rig = base.group.getObjectByName('body');
  const standIn = rig?.children.find(node => node.name === 'hips');
  if (!spec || !rig || !standIn || !loader) return base;
  const names = RIGS[spec.rig] || {};
  const own = new Set();
  let holder = null, bones = {}, rest = new Map(), elapsed = 0, disposed = false;
  const turn = new THREE.Quaternion(), euler = new THREE.Euler();

  function build(asset) {
    const root = (asset.clone || (scene => scene.clone(true)))(asset.scene);
    root.name = 'npc-glb-model';
    root.traverse(node => {
      const name = plain(node.name);
      for (const [key, pattern] of Object.entries(names)) if (!bones[key] && pattern.test(name)) { bones[key] = node; rest.set(node, node.quaternion.clone()); }
      if (!node.isMesh) return;
      if (node.isSkinnedMesh) node.frustumCulled = false;
      node.castShadow = true;
      const list = [].concat(node.material).map(material => {
        if (spec.hide?.test(material?.name || '')) node.visible = false;
        const lit = litCopy(material);
        own.add(lit); return lit;
      });
      node.material = Array.isArray(node.material) ? list : list[0];
    });
    const size = measure(root);
    holder = new THREE.Group();
    holder.name = 'npc-glb';
    if (size && size.height > 0) {
      const k = spec.height / size.height;
      root.scale.multiplyScalar(k);
      root.position.y = -size.minY * k;
    }
    holder.add(root);
    rig.add(holder);
    standIn.visible = false;
  }
  loader(spec.url).then(asset => {
    if (disposed || !asset?.scene) return;
    build(asset);
    update(lastState, 0);
  }).catch(() => {});

  // Xoay xương = tư thế gốc × góc thêm theo trục cục bộ của xương.
  function pose(key, x = 0, y = 0, z = 0) {
    const bone = bones[key];
    if (!bone) return;
    bone.quaternion.copy(rest.get(bone)).multiply(turn.setFromEuler(euler.set(x, y, z)));
  }
  function poseObito(swing, bow, breath, tilt) {
    pose('spine', bow * 0.6);
    pose('chest', bow * 0.3 + breath);
    pose('head', bow * 0.16, 0, tilt);
    pose('thighR', -swing); pose('thighL', swing);
    pose('flapR', -swing * 0.6); pose('flapL', swing * 0.6);
    pose('backR', -swing * 0.4); pose('backL', swing * 0.4);
    pose('kneeR', Math.max(0, swing) * 0.5); pose('kneeL', Math.max(0, -swing) * 0.5);
    pose('armR', swing * 0.5, 0, spec.arm); pose('armL', -swing * 0.5, 0, -spec.arm);
    pose('elbowR', -0.12); pose('elbowL', -0.12);
  }
  // swing > 0: chân phải ra sau, chân trái ra trước; tay đánh ngược chân cùng bên.
  function poseNpc(swing, bow, breath, tilt) {
    pose('spine', bow * 0.5);
    pose('chest', bow * 0.3 + breath);
    pose('head', bow * 0.2, 0, tilt);
    pose('thighR', swing); pose('thighL', -swing);
    pose('kneeR', Math.max(0, swing) * 0.7); pose('kneeL', Math.max(0, -swing) * 0.7);
    // Tay phải cầm đạo cụ (chổi, đao, dù) thì đánh rất nhẹ để đạo cụ không quét qua người.
    const arms = spec.armSwing ?? 0.6;
    pose('armR', 0, 0, swing * (spec.hold ? 0.12 : arms));
    pose('armL', 0, 0, swing * arms);
  }
  let lastState = {};
  function update(state = {}, dt = 0) {
    if (disposed) return;
    base.update(state, dt);
    lastState = state;
    if (!holder) return;
    const reduced = state.reducedMotion ?? opts.reducedMotion ?? !!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (!reduced) elapsed += clamp(finite(dt), 0, 0.1);
    const bow = clamp(finite(state.bow), 0, 1);
    const walking = !!state.walking && !bow;
    const swing = walking && !reduced ? Math.sin(elapsed * 8) * spec.stride : 0;
    const breath = reduced || walking ? 0 : Math.sin(elapsed * 1.8) * 0.02;
    const tilt = state.talk && !reduced ? Math.sin(elapsed * 5) * 0.05 : 0;
    holder.position.y = walking && !reduced ? Math.abs(swing) * 0.035 : 0;
    if (spec.rig === 'obito') poseObito(swing, bow, breath, tilt);
    else if (spec.rig === 'npc') poseNpc(swing, bow, breath, tilt);
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    holder?.traverse(node => { if (node.isSkinnedMesh) node.skeleton?.dispose(); });
    holder?.removeFromParent();
    own.forEach(material => material.dispose()); own.clear();
    base.dispose();
  }
  return { group: base.group, update, setLook: base.setLook, dispose, fx: base.fx };
}
