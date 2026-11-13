'use strict';

// Nạp module này bằng import() khi bật 3D; Three.js chỉ nạp trong start().
// scene: 'test' hoặc module { build(ctx) → { group, update, pick, dispose } }.
// ctx gồm THREE, scene, camera, renderer, on, quality, view, reducedMotion.
// World3D sở hữu tài nguyên GPU trong group; dispose() của cảnh dọn phần còn lại.
// setView chỉ giữ lựa chọn first/third cho bộ máy quay được nối ở thẻ sau.
let active = null;
let generation = 0;
const QUALITY = { low: 1, medium: 1.5, high: 2 };
const failure = reason => ({ ok: false, reason });

function buildTest({ THREE }) {
  const group = new THREE.Group();
  group.add(new THREE.HemisphereLight(0xffebcf, 0x665344, 2));
  const light = new THREE.DirectionalLight(0xffddb3, 3);
  light.position.set(4, 8, 3);
  light.castShadow = true;
  group.add(light);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), new THREE.MeshStandardMaterial({ color: 0x9d8567, roughness: 1 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  group.add(floor);
  const block = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), new THREE.MeshStandardMaterial({ color: 0x9a492f, roughness: 0.8 }));
  block.position.y = 1;
  block.castShadow = true;
  block.receiveShadow = true;
  group.add(block);
  return { group };
}

function release(scene) {
  if (!scene) return;
  try { scene.dispose?.(); } finally {
    // Một geometry/material/texture có thể dùng chung cho nhiều mesh.
    const resources = new Set();
    scene.group.traverse(object => {
      if (object.geometry) resources.add(object.geometry);
      if (object.shadow) resources.add(object.shadow);
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        if (!material) continue;
        resources.add(material);
        for (const value of Object.values(material)) if (value?.isTexture) resources.add(value);
      }
    });
    for (const resource of resources) resource.dispose();
    scene.group.removeFromParent();
  }
}

function resize(world) {
  const rect = world.canvas.getBoundingClientRect();
  const width = Math.max(1, rect.width), height = Math.max(1, rect.height);
  world.renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, QUALITY[world.ctx.quality]));
  world.renderer.setSize(width, height, false);
  world.ctx.camera.aspect = width / height;
  world.ctx.camera.updateProjectionMatrix();
}

function schedule(world) {
  if (active !== world || document.hidden || world.frame) return;
  world.frame = requestAnimationFrame(time => {
    world.frame = 0;
    if (active !== world || document.hidden) return;
    const dt = world.last === null ? 0 : Math.min(0.1, (time - world.last) / 1000);
    world.last = time;
    try {
      world.content.update?.(world.getState(), dt);
      world.renderer.render(world.ctx.scene, world.ctx.camera);
    } catch (error) {
      const notify = world.ctx.on.error;
      stop();
      notify?.('Chưa vẽ được cảnh 3D. Xin trở về giao diện 2D.');
      return;
    }
    schedule(world);
  });
}

export function setScene(scene = 'test') {
  if (!active) return failure('Chưa mở cảnh 3D.');
  const builder = scene === 'test' ? buildTest : scene?.build;
  if (typeof builder !== 'function') return failure('Chưa có cảnh 3D này.');
  const content = builder(active.ctx);
  if (!content?.group?.isObject3D) return failure('Cảnh 3D chưa có nhóm hình.');
  release(active.content);
  active.content = content;
  active.ctx.scene.add(content.group);
  return { ok: true };
}

export function setView(view) {
  if (!active) return failure('Chưa mở cảnh 3D.');
  if (view !== 'first' && view !== 'third') return failure('Góc nhìn chưa hợp lệ.');
  active.ctx.view = view;
  return { ok: true };
}

export function setQuality(quality) {
  if (!active) return failure('Chưa mở cảnh 3D.');
  if (!Object.hasOwn(QUALITY, quality)) return failure('Mức đồ họa chưa hợp lệ.');
  active.ctx.quality = quality;
  active.renderer.shadowMap.enabled = quality === 'high';
  active.renderer.shadowMap.type = active.ctx.THREE.PCFSoftShadowMap;
  resize(active);
  return { ok: true };
}

export function stop() {
  generation++;
  const world = active;
  active = null;
  if (!world) return;
  cancelAnimationFrame(world.frame);
  document.removeEventListener('visibilitychange', world.visibility);
  globalThis.removeEventListener('resize', world.resize);
  world.observer?.disconnect();
  world.canvas.removeEventListener('webglcontextlost', world.contextLost);
  try { release(world.content); } finally { world.renderer.dispose(); }
}

// Luôn trả kết quả thay vì ném lỗi, để bên gọi quay về 2D khi thiếu WebGL2/lỗi nạp.
export async function start({ canvas, scene = 'test', getState = () => ({}), on = {}, quality = 'medium' } = {}) {
  stop();
  const ticket = generation;
  let renderer = null;
  try {
    if (!canvas || typeof canvas.getContext !== 'function') return failure('Chưa có khung vẽ 3D.');
    const context = canvas.getContext('webgl2', { antialias: true, alpha: false });
    if (!context) return failure('Máy chưa hỗ trợ WebGL2. Xin dùng giao diện 2D.');
    const THREE = await import('three');
    if (ticket !== generation) return failure('Đã hủy mở cảnh 3D.');
    renderer = new THREE.WebGLRenderer({ canvas, context });
    const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 100);
    camera.position.set(8, 7, 10);
    camera.lookAt(0, 0.5, 0);
    const root = new THREE.Scene();
    root.background = new THREE.Color(0x292620);
    const world = {
      canvas, renderer, getState, content: null, frame: 0, last: null,
      ctx: { THREE, scene: root, camera, renderer, on, quality: 'medium', view: 'third', reducedMotion: !!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches }
    };
    world.resize = () => resize(world);
    world.visibility = () => {
      cancelAnimationFrame(world.frame);
      world.frame = 0;
      world.last = null;
      schedule(world);
    };
    world.contextLost = event => {
      event.preventDefault();
      stop();
      on.error?.('Đã mất kết nối đồ họa 3D. Xin trở về giao diện 2D.');
    };
    active = world;
    const result = setScene(scene);
    if (!result.ok) { stop(); return result; }
    setQuality(Object.hasOwn(QUALITY, quality) ? quality : 'medium');
    document.addEventListener('visibilitychange', world.visibility);
    globalThis.addEventListener('resize', world.resize);
    canvas.addEventListener('webglcontextlost', world.contextLost);
    if (globalThis.ResizeObserver) {
      world.observer = new ResizeObserver(world.resize);
      world.observer.observe(canvas);
    }
    schedule(world);
    return { ok: true };
  } catch (error) {
    if (ticket === generation) {
      if (active) stop(); else renderer?.dispose();
    }
    return failure('Chưa mở được đồ họa 3D. Xin dùng giao diện 2D.');
  }
}
