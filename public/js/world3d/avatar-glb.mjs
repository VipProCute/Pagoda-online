'use strict';

import * as THREE from 'three';
import { createAvatar, AVATAR_COLORS } from './avatar.mjs?v=6';

// Nhân vật dựng bằng Blender (T-120/T-130), bật bằng localStorage['ta-avatar'] = 'blender'.
// createGlbAvatar trả CÙNG giao diện với createAvatar: { group, update(state, dt), setLook(look), dispose() }.
// Bản dựng bằng mã luôn được tạo trước và là THẾ THÂN: nó giữ nhãn tên, bóng, hào quang, pháp tướng, quỷ theo sau.
// Khi .glb nạp xong thì chỉ ẩn phần thân người (cây `hips` của bản mã) và hiện mô hình .glb tại cùng chỗ.
// .glb lỗi hoặc 404 thì giữ nguyên thế thân, không ghi console. Vai NPC có trang phục riêng luôn dùng bản mã.
// opts.assets (tùy chọn, để kiểm thử): { load(url) → Promise<{ scene, animations, clone? } | null> }.

export const AVATAR_SWITCH_KEY = 'ta-avatar';
export const GLB_URL = Object.freeze({ nam: '/models/avatar/nam.glb', nu: '/models/avatar/nu.glb' });
const FADE = 0.2;                                  // giây chuyển clip
const SIT_LIFT = Object.freeze({ cushion: 0.15, bench: 0.25 }); // nâng mô hình lên bồ đoàn cao 0,15 m / ghế đá
const HALO_AT = [0, 1.34, -0.36];                  // hào quang cúng dường: sau đầu mô hình, theo xương đầu
const HAIRS = 4;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const finite = (v, fallback = 0) => Number.isFinite(v) ? v : fallback;

export function blenderEnabled() {
  try { return globalThis.localStorage?.getItem(AVATAR_SWITCH_KEY) === 'blender'; } catch (error) { return false; }
}

// Tư thế ngồi giống avatar.mjs: true/'cushion'/'bench'/số nguyên không âm; false và -1 là đứng.
export function isSitting(sit) {
  return sit === true || sit === 'cushion' || sit === 'bench' || (Number.isInteger(sit) && sit >= 0);
}

// Hàm thuần: chọn clip theo ảnh chụp trạng thái. Ưu tiên ngồi > vái > đi > đứng yên.
export function clipFor(state) {
  const s = state || {};
  if (isSitting(s.sit)) return 'sit';
  if (finite(s.bow) > 0) return 'bow';
  if (s.walking) return 'walk';
  return 'idle';
}

// ───── nạp .glb dùng chung (bộ đệm theo URL) ─────
const shared = new Map();
const defaultAssets = {
  load(url) {
    if (!shared.has(url)) {
      shared.set(url, Promise.all([
        import('/vendor/three-addons/loaders/GLTFLoader.js'), import('/vendor/three-addons/utils/SkeletonUtils.js')
      ]).then(([loader, utils]) => new loader.GLTFLoader().loadAsync(url)
        .then(gltf => ({ scene: gltf.scene, animations: gltf.animations, clone: utils.clone }))).catch(() => null));
    }
    return shared.get(url);
  }
};

export function createGlbAvatar(initialLook = {}, opts = {}) {
  const base = createAvatar(initialLook, opts);
  if (opts.role) return base;                      // vai đặc biệt: luôn là bản mã (role không đổi theo thời gian)
  const { group } = base;
  const rig = group.getObjectByName('body');
  const standIn = rig?.children.find(node => node.name === 'hips');
  if (!rig || !standIn) return base;
  const assets = opts.assets || defaultAssets;
  const halo = group.getObjectByName('halo');
  halo?.updateMatrix();
  const halo0 = halo ? { parent: halo.parent, matrix: halo.matrix.clone() } : null;
  const own = new Set();                           // vật liệu nhân bản riêng cho nhân vật này
  let look = { ...group.userData.look }, gender = null, model = null, mixer = null;
  let actions = new Map(), current = null, currentName = '', pending = 0, disposed = false, lastState = {};

  const urlOf = g => GLB_URL[g] || GLB_URL.nam;
  let haloOnModel = false;
  function mountHalo(onModel) {
    if (!halo || !halo0 || haloOnModel === onModel) return;
    haloOnModel = onModel;
    const head = onModel && model?.getObjectByName('head');
    if (onModel && !head) haloOnModel = false;
    else if (head) {
      // Đặt theo tư thế gốc của mô hình rồi gắn vào xương đầu để đi theo đầu.
      model.updateMatrixWorld(true);
      const want = new THREE.Matrix4().multiplyMatrices(model.matrixWorld, new THREE.Matrix4().makeTranslation(...HALO_AT).scale(new THREE.Vector3(1.15, 1.15, 1)));
      halo.matrix.copy(head.matrixWorld).invert().multiply(want);
      halo.matrix.decompose(halo.position, halo.quaternion, halo.scale);
      head.add(halo);
    } else {
      halo.matrix.copy(halo0.matrix); halo.matrix.decompose(halo.position, halo.quaternion, halo.scale);
      halo0.parent.add(halo);
    }
  }
  function dropModel() {
    if (!model) return;
    mountHalo(false);
    mixer?.stopAllAction(); mixer?.uncacheRoot(model);
    model.traverse(node => { if (node.isSkinnedMesh) node.skeleton?.dispose(); });
    model.removeFromParent();
    own.forEach(material => material.dispose()); own.clear();
    model = mixer = current = null; currentName = ''; actions = new Map();
    standIn.visible = true;
  }
  function paint() {
    if (!model) return;
    const robe = AVATAR_COLORS[look.c] || AVATAR_COLORS[0];
    for (let i = 0; i < HAIRS; i++) {
      const node = model.getObjectByName('hair' + i);
      if (node) node.visible = i === look.h;
    }
    model.traverse(node => {
      if (!node.isMesh) return;
      for (const material of [].concat(node.material)) {
        if (material.name === 'robe') material.color.set(robe);
        else if (material.name === 'hairwrap') material.color.set(look.g === 'nam' ? '#2c2a30' : robe).multiplyScalar(look.g === 'nam' ? 1 : 0.62);
      }
    });
  }
  function build(asset, g) {
    const root = (asset.clone || (scene => scene.clone(true)))(asset.scene);
    root.name = 'avatar-glb';
    root.traverse(node => {
      if (node.isSkinnedMesh) node.frustumCulled = false;
      if (!node.isMesh) return;
      node.castShadow = true;
      const list = [].concat(node.material).map(material => {
        if (material.name !== 'robe' && material.name !== 'hairwrap') return material;
        const copy = material.clone(); own.add(copy); return copy;
      });
      node.material = Array.isArray(node.material) ? list : list[0];
    });
    model = root; gender = g;
    mixer = new THREE.AnimationMixer(root);
    rig.add(root);
    paint(); mountHalo(true);
    standIn.visible = false;
    root.userData.clips = asset.animations || [];
    for (const clip of root.userData.clips) actions.set(clip.name, mixer.clipAction(clip));
  }
  async function request(g) {
    const ticket = ++pending;
    let asset = null;
    try { asset = await assets.load(urlOf(g)); } catch (error) { asset = null; }
    if (disposed || ticket !== pending || !asset?.scene) return;
    if (model) dropModel();
    build(asset, g);
    drive(lastState, 0, true);
  }
  function syncLook() {
    if (disposed) return;
    if (look.npcFashion) {                         // trang phục NPC chỉ có ở bản mã: hủy lượt tải đang chờ, gỡ .glb, hiện thế thân
      pending++; gender = null;
      dropModel();
      standIn.visible = true;
      return;
    }
    if (model && gender !== look.g) { dropModel(); gender = null; }
    if (!model) { if (gender !== look.g) { gender = look.g; request(look.g); } } else paint();
  }

  const reducedOf = state => state.reducedMotion ?? opts.reducedMotion ?? !!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  function play(name, still) {
    const next = actions.get(name);
    if (!next) return;
    const previous = current;
    next.reset().setEffectiveWeight(1).setEffectiveTimeScale(1);
    if (name === 'bow') { next.setLoop(THREE.LoopOnce, 1); next.clampWhenFinished = true; } else next.setLoop(THREE.LoopRepeat, Infinity);
    next.play();
    if (still) { next.time = name === 'bow' ? next.getClip().duration * 0.5 : 0; next.paused = true; previous?.stop(); }
    else if (previous && previous !== next) next.crossFadeFrom(previous, FADE, false);
    current = next; currentName = name;
  }
  function drive(state, dt, force = false) {
    if (!model) return;
    const obito = !!state.obito;
    standIn.visible = obito;
    model.visible = !obito;
    mountHalo(!obito && !!model);
    const sit = isSitting(state.sit);
    model.position.y = sit ? (state.sit === 'bench' ? SIT_LIFT.bench : SIT_LIFT.cushion) : 0;
    const reduced = reducedOf(state);
    let want = clipFor(state);
    if (reduced && want === 'walk') want = 'idle';
    if (want !== currentName || force) {
      if (!(want === 'bow' && currentName === 'bow')) play(want, reduced);
    } else if (current) {
      // Clip không đổi nhưng cờ giảm chuyển động có thể đã đổi: đồng bộ trạng thái dừng theo giá trị hiện tại.
      if (reduced && !current.paused) { current.time = want === 'bow' ? current.getClip().duration * 0.5 : 0; current.paused = true; }
      else if (!reduced && current.paused) current.paused = false;
    }
    if (reduced) mixer.update(0);
    else mixer.update(clamp(finite(dt), 0, 0.1));
  }
  function update(state = {}, dt = 0) {
    if (disposed) return;
    base.update(state, dt);
    lastState = state;
    drive(state, dt);
  }
  function setLook(next) {
    if (disposed) return;
    base.setLook(next);
    look = { ...group.userData.look };
    syncLook();
  }
  function dispose() {
    if (disposed) return;
    disposed = true; pending++;
    dropModel();
    base.dispose();
  }
  syncLook();
  return { group, update, setLook, dispose, fx: base.fx };
}

// Chỗ tạo nhân vật chung cho mọi cảnh: tự chọn bản Blender hoặc bản mã theo công tắc.
export function makeAvatar(look, opts = {}) {
  const on = opts.blender ?? blenderEnabled();
  return on ? createGlbAvatar(look, opts) : createAvatar(look, opts);
}
