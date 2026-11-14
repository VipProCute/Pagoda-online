'use strict';

import * as THREE from 'three';
import { sharedAssets } from './assets.mjs?v=1';
import * as materials from './materials.mjs?v=5';

export const PARTS = Object.freeze(['demon', 'lotus', 'aura', 'merit']);
// Trong mỗi người, ghi chiều sâu của quỷ trước lượt màu và dải lửa.
export const RENDER = Object.freeze({ shellBack: 1, demonDepth: 2, demon: 3, demonFlame: 4, lotus: 5, shellFront: 6, particles: 7 });
const registry = new Map();

export function register(name, factory) {
  if (!PARTS.includes(name) || typeof factory !== 'function') return false;
  registry.set(name, factory);
  return true;
}

export function registered() { return [...registry.keys()]; }

export function createFx3d(host, opts = {}) {
  const covers = { demon: false, lotus: false, aura: false, merit: false };
  const resetCovers = () => { for (const name of PARTS) covers[name] = false; };
  if (!host?.group) {
    return { root: null, covers, update() { return covers; }, setQuality() {}, setReducedMotion() {}, dispose() {} };
  }
  let { quality = 'medium', reducedMotion = false, assets = sharedAssets } = opts;
  let disposed = false;
  const root = new THREE.Group();
  root.name = 'fx3d';
  host.group.add(root);
  const tracked = new Set(), instances = new Map();
  const track = value => { tracked.add(value); return value; };
  const env = {
    THREE, materials, host, assets, RENDER,
    get quality() { return quality; },
    get reducedMotion() { return reducedMotion; },
    track,
    group(name) {
      const group = new THREE.Group();
      group.name = 'fx3d-' + name;
      root.add(group);
      return group;
    },
    particles(count, material) {
      if (reducedMotion || quality !== 'high') return null;
      const size = Number.isFinite(count) ? Math.max(0, Math.min(48, Math.floor(count))) : 0;
      const geometry = track(new THREE.BufferGeometry());
      geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(size * 3), 3));
      const points = new THREE.Points(geometry, track(material));
      points.renderOrder = RENDER.particles;
      points.frustumCulled = false;
      root.add(points);
      return points;
    }
  };
  for (const name of PARTS) {
    const factory = opts.parts ? opts.parts[name] : registry.get(name);
    if (typeof factory !== 'function') continue;
    try {
      const instance = factory(env);
      if (instance && typeof instance === 'object' && typeof instance.update === 'function') instances.set(name, instance);
    } catch (error) { /* Phần lỗi để ảnh 2D tiếp tục hiển thị. */ }
  }
  function notify(method, value) {
    for (const instance of instances.values()) {
      try { instance[method]?.(value); } catch (error) { /* Một phần lỗi không chặn phần còn lại. */ }
    }
  }
  function update(state = {}, dt = 0, ctx = {}) {
    if (disposed) return covers;
    if (ctx.hidden || ctx.slot === false) {
      root.visible = false;
      resetCovers();
      notify('hide');
      return covers;
    }
    root.visible = true;
    for (const [name, instance] of instances) {
      try {
        const slotKey = name === 'lotus' ? 'aura' : name;
        if (ctx.slots && typeof ctx.slots === 'object' && ctx.slots[slotKey] === false) {
          covers[name] = false;
          instance.hide?.();
          continue;
        }
        covers[name] = !!instance.update(state, dt, ctx);
      } catch (error) { covers[name] = false; }
    }
    // Three.js lấy groupOrder từ Group gần nhất, kể cả nhóm trong glTF.
    const order = Number.isFinite(ctx.distance) ? -1 - Math.min(9998, Math.round(ctx.distance * 10)) : -9999;
    root.traverse(node => { if (node.isGroup) node.renderOrder = order; });
    return covers;
  }
  function setQuality(q) {
    if (disposed || !['low', 'medium', 'high'].includes(q)) return;
    quality = q;
    notify('setQuality', q);
  }
  function setReducedMotion(flag) {
    if (disposed) return;
    reducedMotion = !!flag;
    notify('setReducedMotion', reducedMotion);
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    notify('dispose');
    for (const resource of tracked) {
      try { resource?.dispose?.(); } catch (error) { /* Tiếp tục dọn các tài nguyên còn lại. */ }
    }
    tracked.clear(); instances.clear();
    root.removeFromParent(); root.clear();
    resetCovers();
  }
  return { root, covers, update, setQuality, setReducedMotion, dispose };
}
