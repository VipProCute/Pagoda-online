'use strict';

import * as THREE from 'three';
import { register } from './index.mjs?v=4';

export const DEMON_URL = Object.freeze({ 4: '/models/fx/demon-4.glb?v=2' });
export const SELF_DEMON = { mode: 'face' };
const SELF_SCALE = 1.1;
const DEPTH_MIN_ALPHA = 0.6;
const SELF_SIDE = Object.freeze({ x: 0.9, y: 0.3, z: 0.35 }); // Điều phối chỉnh khi xem trong game: đứng ngang vai trái, xa máy quay hơn để không tràn khung.
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;

export function demonPart(env) {
  let holder = null, model = null, mixer = null, current = null, currentName = '', lastReduced = null;
  let requested = false, settled = false, released = false, failed = false, disposed = false, empty = false, url = null;
  let t = 0, lastN = 0, prevN = 0, since = 0, placed = false, facing = null, headYaw = 0;
  let cameraSeen = false, neckBone = null, headBone = null, selfScale = null;
  let pos = [0, 0, 0], vel = [0, 0, 0];
  const local = new THREE.Vector3(), target = new THREE.Vector3();
  const cameraWorld = new THREE.Vector3(), cameraLocal = new THREE.Vector3(), axis = new THREE.Vector3();
  const parentQ = new THREE.Quaternion(), holderQ = new THREE.Quaternion(), turnQ = new THREE.Quaternion();
  const neckBase = new THREE.Quaternion(), headBase = new THREE.Quaternion();
  let headApplied = false;
  const actions = new Map(), materials = [], flames = [], depthMeshes = [];
  let depthMat = null;
  function release() {
    if (!requested || released || empty) return; // lượt tải lỗi đã bị bộ đệm gỡ, không trả tham chiếu thay lượt khác
    released = true;
    env.assets.release(url);
  }
  async function request(nextUrl) {
    requested = true; url = nextUrl;
    try {
      const asset = await env.assets.load(url);
      settled = true; empty = !asset;
      if (disposed) { release(); return; }
      if (!asset) { failed = true; return; }
      model = asset.clone(asset.scene);
      neckBone = model.getObjectByName('neck'); headBone = model.getObjectByName('head');
      holder = env.group('demon'); holder.visible = false; holder.add(model);
      const meshes = [];
      model.traverse(node => {
        if (node.isMesh) meshes.push(node);
      });
      depthMat = env.track(env.materials.spiritDepthMaterial({ dissolveY: [-0.75, 0.1] }));
      for (const node of meshes) {
        const source = node.material;
        node.frustumCulled = false; node.castShadow = false;
        if (node.name.startsWith('demon_flame') || source?.name === 'demon_flame') {
          const mat = env.track(env.materials.flameShellMaterial({ ribbon: true, color: '#ff6a1a', side: THREE.FrontSide }));
          node.material = mat; node.renderOrder = env.RENDER.demonFlame; flames.push(mat);
          continue;
        }
        const mat = env.track(env.materials.spiritMaterial({
          color: '#ffffff', rim: '#7a1a08', glow: '#ffc23a', alpha: 1, dissolveY: [-0.75, 0.1],
          ...(source?.map ? { map: source.map, normalMap: source.normalMap, emissiveMap: source.emissiveMap }
            : { glowMask: !!node.geometry.attributes.color_1 })
        }));
        mat.vertexColors = !source?.map && !!node.geometry.attributes.color;
        materials.push(mat); node.material = mat; node.renderOrder = env.RENDER.demon;
        // Bản sao giữ chung xương; thêm sau khi đã gom lưới để không duyệt lặp.
        const pre = node.clone(false);
        pre.name = node.name + '-depth'; pre.material = depthMat; pre.renderOrder = env.RENDER.demonDepth;
        node.parent.add(pre); depthMeshes.push({ node, pre });
        if (depthMeshes.length === 1) {
          // Gắn sau clone: lượt chiều sâu không bắt máy quay thay lưới thân.
          node.onBeforeRender = (renderer, scene, camera) => {
            camera.getWorldPosition(cameraWorld); cameraSeen = true;
          };
        }
      }
      mixer = new THREE.AnimationMixer(model);
      for (const clip of asset.animations) {
        const action = mixer.clipAction(clip);
        const once = ['emerge', 'vanish', 'taunt1', 'taunt2'].includes(clip.name);
        action.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, once ? 1 : Infinity);
        action.clampWhenFinished = once;
        actions.set(clip.name, action);
      }
    } catch (error) {
      settled = true; failed = true; hide();
      if (disposed) release();
    }
  }
  function hide() { if (holder) holder.visible = false; }
  function update(state = {}, dt = 0, ctx = {}) {
    const SM = globalThis.StandMath;
    if (disposed || failed || !SM) { hide(); return false; }
    dt = Math.max(0, finite(dt));
    const n = clamp(Math.trunc(finite(state.demon?.n)), 0, 4);
    const alpha = clamp(finite(state.demon?.alpha, 1), 0, 1), reduced = env.reducedMotion;
    if (!requested && DEMON_URL[n]) request(DEMON_URL[n]);
    if (!reduced) t += dt;
    if (n !== lastN) { prevN = lastN; lastN = n; since = 0; } else since += dt;
    const phase = SM.phaseOf(prevN, n, since, reduced);
    const shown = DEMON_URL[n] ? n : (phase === 'vanish' && DEMON_URL[prevN] ? prevN : 0);
    if (!shown || !model) { hide(); return false; }
    const a = SM.ANCHOR[shown], yaw = finite(state.yaw);
    const c = Math.cos(yaw), s = Math.sin(yaw), sitDrop = SM.isSitting(state.sit) ? 0.35 : 0;
    const side = ctx.isSelf && shown === 4 && SELF_DEMON.mode === 'side' ? SELF_SIDE : { x: 0, y: 0, z: 0 };
    const ax = a.x + side.x, az = a.z + side.z;
    local.set(ax * c + az * s, a.y + side.y - sitDrop, -ax * s + az * c);
    env.host.group.updateWorldMatrix(true, false);
    const face = ctx.isSelf && shown === 4 && SELF_DEMON.mode === 'face';
    let goal = yaw, headGoal = 0, scaleGoal = face ? SELF_SCALE : 1;
    if (face && (ctx.camera || cameraSeen)) {
      cameraLocal.copy(ctx.camera || cameraWorld);
      env.host.group.worldToLocal(cameraLocal);
      const stand = SM.selfStand({ x: cameraLocal.x, z: cameraLocal.z });
      if (stand) {
        local.set(stand.x, stand.y - sitDrop, stand.z);
        goal = stand.yaw; headGoal = stand.head;
        if (Number.isFinite(stand.scale)) scaleGoal = stand.scale;
      }
    }
    // Máy quay bị tường ép lại gần thì quỷ thu nhỏ dần (T-203), không giật theo từng khung.
    selfScale = reduced || selfScale == null ? scaleGoal : selfScale + (scaleGoal - selfScale) * (1 - Math.exp(-dt / 0.3));
    target.copy(local); env.host.group.localToWorld(target);
    if (!placed || reduced) { pos = [target.x, target.y, target.z]; vel = [0, 0, 0]; placed = true; }
    else ({ pos, vel } = SM.springVec(pos, vel, [target.x, target.y, target.z], dt));
    holder.position.set(pos[0], pos[1], pos[2]); env.host.group.worldToLocal(holder.position);
    facing = reduced ? goal : SM.turn(facing ?? goal, goal, dt, 0.25);
    headYaw = ctx.isSelf ? (reduced ? headGoal : SM.turn(headYaw, headGoal, dt, 0.25)) : 0;
    holder.rotation.y = facing;
    holder.scale.setScalar(selfScale);
    const pose = SM.poseOf(state);
    const name = reduced ? 'idle' : phase === 'emerge' || phase === 'vanish' ? phase
      : pose === 'sit' ? 'idle' : pose === 'idle' ? SM.tauntOf(state.id, state.now) || 'idle' : pose;
    const next = actions.get(name);
    if (next && (name !== currentName || reduced !== lastReduced)) {
      // Khi giảm chuyển động, bỏ pha trộn cũ để giữ đúng tư thế idle ở thời điểm 0.
      if (reduced) mixer.stopAllAction();
      next.reset().play();
      if (current && current !== next && !reduced) next.crossFadeFrom(current, 0.3, false);
      current = next; currentName = name;
    }
    lastReduced = reduced;
    if (current) {
      if (reduced) { current.time = 0; current.paused = true; }
      else current.paused = false;
    }
    // Trả tư thế gốc trước mixer, kể cả clip không có track cho cổ/đầu.
    if (headApplied) {
      if (neckBone) neckBone.quaternion.copy(neckBase);
      if (headBone) headBone.quaternion.copy(headBase);
      headApplied = false;
    }
    mixer.update(reduced ? 0 : Math.min(dt, 0.1));
    if (headYaw !== 0 && ctx.isSelf) {
      if (neckBone) neckBase.copy(neckBone.quaternion);
      if (headBone) headBase.copy(headBone.quaternion);
      holder.updateMatrixWorld(true);
      for (const [bone, part] of [[neckBone, 0.4], [headBone, 0.6]]) {
        if (!bone?.parent) continue;
        bone.parent.getWorldQuaternion(parentQ);
        holder.getWorldQuaternion(holderQ);
        axis.set(0, 1, 0).applyQuaternion(holderQ).applyQuaternion(parentQ.invert()).normalize();
        turnQ.setFromAxisAngle(axis, headYaw * part);
        bone.quaternion.premultiply(turnQ);
        bone.updateMatrixWorld(true);
      }
      headApplied = true;
    }
    // Chế độ đứng lệch giữ thân rõ; chế độ che lưng mờ sớm để thấy nhân vật.
    const cover = ctx.isSelf && SELF_DEMON.mode === 'cover';
    const fadeFrom = cover ? 2.5 : 1.2, fadeSpan = cover ? 4 : 0.8, fadeMin = cover ? 0.3 : 0.55;
    const near = !face && shown === 4 && Number.isFinite(ctx.distance) ? clamp((ctx.distance - fadeFrom) / fadeSpan, fadeMin, 1) : 1;
    const vanishFade = phase === 'vanish' ? clamp(1 - since / SM.DURATION.vanish, 0, 1) : 1;
    const opacity = alpha * near * vanishFade;
    for (const mat of [...materials, depthMat]) {
      mat.userData.uniforms.uAlpha.value = opacity;
      env.materials.tick(mat, t);
    }
    for (const mat of flames) {
      mat.uniforms.uOpacity.value = opacity * 0.9;
      mat.uniforms.uDisplace.value = reduced ? 0 : 1;
      env.materials.tick(mat, t);
    }
    for (const { node, pre } of depthMeshes) {
      pre.visible = node.visible && opacity >= DEPTH_MIN_ALPHA;
      pre.position.copy(node.position); pre.quaternion.copy(node.quaternion); pre.scale.copy(node.scale);
      pre.matrix.copy(node.matrix);
      if (node.morphTargetInfluences) pre.morphTargetInfluences = node.morphTargetInfluences;
    }
    holder.visible = true;
    return true;
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    mixer?.stopAllAction(); mixer?.uncacheRoot(model);
    const skeletons = new Set();
    model?.traverse(node => { if (node.isSkinnedMesh && node.skeleton) skeletons.add(node.skeleton); });
    skeletons.forEach(skeleton => skeleton.dispose());
    holder?.removeFromParent();
    // Lượt tải đang chờ tự trả tham chiếu khi hoàn tất, không trả hai lần.
    if (settled) release();
  }
  return { update, hide, setReducedMotion() {}, dispose };
}

register('demon', demonPart);
