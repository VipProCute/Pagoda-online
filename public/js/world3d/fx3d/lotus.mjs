'use strict';

import * as THREE from 'three';
import { register } from './index.mjs?v=4';

export const LOTUS_URL = '/models/fx/lotus.glb?v=2';
const active = tier => tier >= 2 && tier <= 7;
const clamp = value => Math.max(0, Math.min(1, value));

export function lotusPart(env) {
  let holder = null, model = null, petal = null, pod = null, layers = [], points = null;
  let requested = false, settled = false, released = false, failed = false, disposed = false, empty = false;
  let t = 0, bloom = 0, lastTier = 0;
  function release() {
    if (!requested || released || empty) return; // lượt tải lỗi đã bị bộ đệm gỡ, không trả tham chiếu thay lượt khác
    released = true; env.assets.release(LOTUS_URL);
  }
  async function request() {
    requested = true;
    try {
      const asset = await env.assets.load(LOTUS_URL);
      settled = true; empty = !asset;
      if (disposed) { release(); return; }
      if (!asset) { failed = true; return; }
      model = asset.scene.clone(true);
      holder = env.group('lotus'); holder.visible = false; holder.add(model);
      const material = side => env.track(new THREE.MeshStandardMaterial({ color: '#ffffff', vertexColors: true, metalness: 0.45, roughness: 0.3, emissive: new THREE.Color('#b07818'), emissiveIntensity: 0.46, side, transparent: true }));
      petal = material(THREE.DoubleSide); pod = material(THREE.FrontSide);
      model.traverse(node => {
        if (!node.isMesh) return;
        node.material = node.material?.name === 'petal' ? petal : pod;
        node.renderOrder = env.RENDER.lotus;
        node.castShadow = false; node.receiveShadow = true;
      });
      layers = ['petals2', 'petals1', 'petals0'].map(name => model.getObjectByName(name));
    } catch (error) {
      settled = true; failed = true; hide();
      if (disposed) release();
    }
  }
  function syncParticles() {
    const enabled = env.quality === 'high' && !env.reducedMotion;
    if (enabled && !points) points = env.particles(24, env.track(env.materials.sparkMaterial('#ffd36b')));
    if (points) points.visible = enabled && !!holder?.visible;
  }
  function hide() { if (holder) holder.visible = false; if (points) points.visible = false; }
  function update(state = {}, dt = 0) {
    if (disposed || failed) { hide(); return false; }
    dt = Number.isFinite(dt) ? Math.max(0, dt) : 0;
    const tier = state.tier;
    if (active(tier) && (!active(lastTier) || tier > lastTier)) bloom = 0;
    lastTier = tier;
    if (!active(tier)) { hide(); return false; }
    if (!requested) request();
    if (!model) return false;
    bloom += dt;
    if (!env.reducedMotion) t += dt;
    layers.forEach((layer, i) => {
      if (!layer) return;
      const x = clamp((bloom - i * 0.3) / 0.6), k = env.reducedMotion ? 1 : x * x * (3 - 2 * x);
      layer.scale.set(0.35 + 0.65 * k, 0.15 + 0.85 * k, 0.35 + 0.65 * k);
    });
    const outer = layers[2], middle = layers[1];
    if (outer) outer.rotation.y = env.reducedMotion ? 0 : t * 0.05;
    if (middle) middle.rotation.y = env.reducedMotion ? 0 : -t * 0.07;
    for (const mat of [petal, pod]) {
      mat.emissiveIntensity = env.reducedMotion ? 0.46 : 0.46 + 0.04 * Math.sin(t * 2.2);
      mat.opacity = state.fade ?? 1;
    }
    holder.visible = true; syncParticles();
    if (points?.visible) {
      points.material.opacity = state.fade ?? 1;
      const position = points.geometry.attributes.position;
      for (let j = 0; j < position.count; j++) {
        const radius = 0.15 + 0.1 * ((j * 7) % 5) / 5, angle = j * 2.4 + t * 0.5;
        position.setXYZ(j, Math.sin(angle) * radius, ((t * 0.35 + j / 24) % 1) * 1.2 + 0.05, Math.cos(angle) * radius);
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
  return { update, hide, setQuality: syncParticles, setReducedMotion: syncParticles, dispose };
}

register('lotus', lotusPart);
