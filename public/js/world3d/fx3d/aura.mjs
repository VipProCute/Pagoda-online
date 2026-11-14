'use strict';

import * as THREE from 'three';
import { register } from './index.mjs?v=1';

export const AURA_KIT_URL = '/models/fx/aura-kit.glb';
export const AURA_3D_TIERS = Object.freeze([5]);
const isSitting = sit => sit === true || sit === 'cushion' || sit === 'bench' || (Number.isInteger(sit) && sit >= 0);

export function auraPart(env) {
  let holder = null, points = null, t = 0;
  let requested = false, settled = false, released = false, failed = false, disposed = false, empty = false;
  const shells = [];
  function release() {
    if (!requested || released || empty) return; // lượt tải lỗi đã bị bộ đệm gỡ, không trả tham chiếu thay lượt khác
    released = true; env.assets.release(AURA_KIT_URL);
  }
  async function request() {
    requested = true;
    try {
      const asset = await env.assets.load(AURA_KIT_URL);
      settled = true; empty = !asset;
      if (disposed) { release(); return; }
      const source = asset?.scene.getObjectByName('shell');
      if (!source?.isMesh) { failed = true; return; }
      holder = env.group('aura'); holder.visible = false;
      for (const outer of [false, true]) for (const side of [THREE.BackSide, THREE.FrontSide]) {
        const mat = env.track(env.materials.flameShellMaterial({ side }));
        const shell = new THREE.Mesh(source.geometry, mat);
        if (outer) shell.scale.set(1.14, 1.32, 1.14);
        shell.renderOrder = side === THREE.BackSide ? env.RENDER.shellBack : env.RENDER.shellFront;
        shell.frustumCulled = false; shell.castShadow = false;
        holder.add(shell); shells.push({ shell, mat, outer });
      }
    } catch (error) {
      settled = true; failed = true; hide();
      if (disposed) release();
    }
  }
  function syncQuality() {
    for (const { shell, mat, outer } of shells) {
      shell.visible = !outer || env.quality !== 'low';
      mat.uniforms.uDisplace.value = env.quality === 'low' ? 0 : 1;
    }
    const enabled = env.quality === 'high' && !env.reducedMotion;
    if (enabled && !points) points = env.particles(32, env.track(new THREE.PointsMaterial({ color: '#8fd3ff', size: 0.045, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })));
    if (points) points.visible = enabled && !!holder?.visible;
  }
  function hide() { if (holder) holder.visible = false; if (points) points.visible = false; }
  function update(state = {}, dt = 0) {
    if (disposed || failed || !AURA_3D_TIERS.includes(state.tier)) { hide(); return false; }
    if (!requested) request();
    if (!holder) return false;
    if (!env.reducedMotion && Number.isFinite(dt)) t += Math.max(0, dt);
    holder.visible = true; holder.scale.y = isSitting(state.sit) ? 0.8 : 1;
    syncQuality();
    for (const { mat, outer } of shells) {
      mat.uniforms.uColor.value.set(state.color || '#8fd3ff');
      mat.uniforms.uOpacity.value = (state.fade ?? 1) * 0.9 * (outer ? 0.55 : 1);
      env.materials.tick(mat, t);
    }
    if (points?.visible) {
      points.material.color.set(state.color || '#8fd3ff'); points.material.opacity = state.fade ?? 1;
      const position = points.geometry.attributes.position;
      for (let j = 0; j < position.count; j++) {
        const radius = 0.45 + 0.15 * ((j * 7) % 5) / 5, angle = j * 2.4 + t * 0.5;
        position.setXYZ(j, Math.sin(angle) * radius, ((t * 0.35 + j / 32) % 1) * 2.1, Math.cos(angle) * radius);
      }
      position.needsUpdate = true;
    }
    return true;
  }
  function dispose() {
    if (disposed) return;
    disposed = true; holder?.removeFromParent(); points?.removeFromParent();
    if (settled) release();
  }
  return { update, hide, setQuality: syncQuality, setReducedMotion: syncQuality, dispose };
}

register('aura', auraPart);
