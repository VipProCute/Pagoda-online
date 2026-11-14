'use strict';

import * as THREE from 'three';
import { register } from './index.mjs?v=1';

export const DEMON_URL = Object.freeze({ 4: '/models/fx/demon-4.glb' });
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;

export function demonPart(env) {
  let holder = null, model = null, mixer = null, current = null, currentName = '', lastReduced = null;
  let requested = false, settled = false, released = false, failed = false, disposed = false, url = null;
  let t = 0, lastN = 0, prevN = 0, since = 0, placed = false, facing = null;
  let pos = [0, 0, 0], vel = [0, 0, 0];
  const local = new THREE.Vector3(), target = new THREE.Vector3();
  const actions = new Map(), materials = [];
  function release() {
    if (!requested || released) return;
    released = true;
    env.assets.release(url);
  }
  async function request(nextUrl) {
    requested = true; url = nextUrl;
    try {
      const asset = await env.assets.load(url);
      settled = true;
      if (disposed) { release(); return; }
      if (!asset) { failed = true; return; }
      model = asset.clone(asset.scene);
      holder = env.group('demon'); holder.visible = false; holder.add(model);
      const material = glowMask => {
        const mat = env.track(env.materials.spiritMaterial({ color: '#ffffff', rim: '#a8300c', glow: '#ffc23a', alpha: 1, dissolveY: [-0.75, 0.1], glowMask }));
        mat.vertexColors = true; materials.push(mat); return mat;
      };
      const mat = material(true);
      let unmasked = null;
      model.traverse(node => {
        if (!node.isMesh) return;
        node.material = node.geometry.attributes.color_1 ? mat : (unmasked || (unmasked = material(false)));
        node.renderOrder = env.RENDER.demon;
        node.frustumCulled = false; node.castShadow = false;
      });
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
    local.set(a.x * c + a.z * s, a.y - sitDrop, -a.x * s + a.z * c);
    target.copy(local); env.host.group.localToWorld(target);
    if (!placed || reduced) { pos = [target.x, target.y, target.z]; vel = [0, 0, 0]; placed = true; }
    else ({ pos, vel } = SM.springVec(pos, vel, [target.x, target.y, target.z], dt));
    holder.position.set(pos[0], pos[1], pos[2]); env.host.group.worldToLocal(holder.position);
    facing = reduced ? yaw : SM.turn(facing ?? yaw, yaw, dt, 0.25);
    holder.rotation.y = facing;
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
    mixer.update(reduced ? 0 : Math.min(dt, 0.1));
    // Ma Vương mờ dần khi máy quay gần; quỷ của chính mình (góc thứ ba, máy quay ngay sau lưng) mờ sớm hơn để không che nhân vật.
    const fadeFrom = ctx.isSelf ? 2.5 : 1.2, fadeSpan = ctx.isSelf ? 4 : 0.8, fadeMin = ctx.isSelf ? 0.3 : 0.15;
    const near = shown === 4 && Number.isFinite(ctx.distance) ? clamp((ctx.distance - fadeFrom) / fadeSpan, fadeMin, 1) : 1;
    const vanishFade = phase === 'vanish' ? clamp(1 - since / SM.DURATION.vanish, 0, 1) : 1;
    for (const mat of materials) {
      mat.userData.uniforms.uAlpha.value = alpha * near * vanishFade;
      env.materials.tick(mat, t);
    }
    holder.visible = true;
    return true;
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    mixer?.stopAllAction(); mixer?.uncacheRoot(model);
    model?.traverse(node => { if (node.isSkinnedMesh) node.skeleton?.dispose(); });
    holder?.removeFromParent();
    // Lượt tải đang chờ tự trả tham chiếu khi hoàn tất, không trả hai lần.
    if (settled) release();
  }
  return { update, hide, setReducedMotion() {}, dispose };
}

register('demon', demonPart);
