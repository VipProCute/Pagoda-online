'use strict';

import * as THREE from 'three';

// NPC có mô hình .glb riêng (hiện chỉ Obito ở Tàng Kinh Các 3D). Bản 2D không đổi.
// Bản dựng bằng mã vẫn là THẾ THÂN: giữ nhãn tên, bong bóng lời, bóng chân; .glb nạp xong thì ẩn cây `hips` của bản mã.
// Mô hình không có clip chuyển động: đi, thở, vái, nói đều xoay xương bằng mã, giảm chuyển động thì đứng yên.
// .glb lỗi hoặc 404 thì giữ nguyên thế thân, không ghi console.

export const NPC_GLB = Object.freeze({
  obito: Object.freeze({
    url: '/models/npc/obito.glb?v=1',
    height: 1.62,            // m, cao hơn khách một chút vì tóc dựng
    hide: /bomb/i,           // bỏ quả bom đất sét trên tay phải: không hợp cảnh chùa
    arm: 0.6,                // rad, hạ hai tay từ tư thế chữ A xuống: tay áo buông hai bên (0,85 thì tay lẫn vào thân áo)
    stride: 0.3              // rad, biên độ bước: áo choàng dài, bước lớn thì chân thò qua vạt áo
  })
});

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const finite = (v, fallback = 0) => Number.isFinite(v) ? v : fallback;
// Tên xương sau GLTFLoader: khoảng trắng thành '_', ví dụ 'leg_right_thigh_090'.
const plain = name => String(name || '').toLowerCase().replace(/[\s_]+/g, ' ');
const BONES = Object.freeze({
  spine: /^spine lower/, chest: /^spine upper/, neck: /^head neck lower/, head: /^head neck upper/,
  armR: /^arm right shoulder/, armL: /^arm left shoulder/, elbowR: /^arm right elbow/, elbowL: /^arm left elbow/,
  thighR: /^leg right thigh/, thighL: /^leg left thigh/, kneeR: /^leg right knee/, kneeL: /^leg left knee/,
  // Vạt áo choàng: front 1a bên trái (+x), front 2a bên phải; hai vạt sau cũng theo chân cùng bên.
  flapL: /^cloak front 1a/, flapR: /^cloak front 2a/, backL: /^cloak left back 1a/, backR: /^cloak right back 1a/
});

// Khung bao của các lưới còn hiện (bỏ quả bom đã ẩn) ở tư thế gốc.
function measure(root) {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3();
  root.traverse(node => { if (node.isMesh && node.visible) box.expandByObject(node, false); });
  return box.isEmpty() ? null : { minY: box.min.y, height: box.max.y - box.min.y };
}

// Gắn mô hình .glb cho NPC `role` lên avatar bản mã `base`. Trả cùng giao diện { group, update, setLook, dispose, fx }.
export function attachNpcGlb(base, role, opts = {}, loader) {
  const spec = NPC_GLB[role];
  const rig = base.group.getObjectByName('body');
  const standIn = rig?.children.find(node => node.name === 'hips');
  if (!spec || !rig || !standIn || !loader) return base;
  const own = new Set();
  let holder = null, bones = {}, rest = new Map(), elapsed = 0, disposed = false;
  const turn = new THREE.Quaternion(), euler = new THREE.Euler();

  function build(asset) {
    const root = (asset.clone || (scene => scene.clone(true)))(asset.scene);
    root.name = 'npc-glb-model';
    root.traverse(node => {
      const name = plain(node.name);
      for (const [key, pattern] of Object.entries(BONES)) if (!bones[key] && pattern.test(name)) { bones[key] = node; rest.set(node, node.quaternion.clone()); }
      if (!node.isMesh) return;
      if (node.isSkinnedMesh) node.frustumCulled = false;
      node.castShadow = true;
      // Vật liệu gốc là unlit: đổi sang vật liệu có ánh sáng như khách để không sáng rực trong cảnh tối.
      const list = [].concat(node.material).map(material => {
        if (spec.hide.test(material?.name || '')) node.visible = false;
        const lit = new THREE.MeshStandardMaterial({
          name: material?.name || '', map: material?.map || null, color: material?.color || 0xffffff,
          side: material?.side ?? THREE.FrontSide, transparent: !!material?.transparent, alphaTest: material?.alphaTest || 0, roughness: 0.92
        });
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

  // Xoay xương = tư thế gốc × góc thêm (trục xương trùng trục mô hình vì mô hình gốc không xoay xương).
  function pose(key, x = 0, y = 0, z = 0) {
    const bone = bones[key];
    if (!bone) return;
    bone.quaternion.copy(rest.get(bone)).multiply(turn.setFromEuler(euler.set(x, y, z)));
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
    holder.position.y = walking && !reduced ? Math.abs(swing) * 0.035 : 0;
    pose('spine', bow * 0.6);
    pose('chest', bow * 0.3 + breath);
    pose('head', bow * 0.16, 0, state.talk && !reduced ? Math.sin(elapsed * 5) * 0.05 : 0);
    pose('thighR', -swing); pose('thighL', swing);
    pose('flapR', -swing * 0.6); pose('flapL', swing * 0.6);
    pose('backR', -swing * 0.4); pose('backL', swing * 0.4);
    pose('kneeR', Math.max(0, swing) * 0.5); pose('kneeL', Math.max(0, -swing) * 0.5);
    pose('armR', swing * 0.5, 0, spec.arm); pose('armL', -swing * 0.5, 0, -spec.arm);
    pose('elbowR', -0.12); pose('elbowL', -0.12);
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
