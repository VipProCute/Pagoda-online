'use strict';

import { createCamera } from './camera.mjs?v=2';
import { createInput } from './input.mjs?v=1';

// Nạp module này bằng import() khi bật 3D; Three.js chỉ nạp trong start().
// scene: 'test' hoặc module { build(ctx) → { group, update, pick, dispose } }.
// ctx gồm THREE, scene, camera, renderer, on, quality, view, reducedMotion.
// World3D sở hữu tài nguyên GPU trong group; dispose() của cảnh dọn phần còn lại.
let active = null;
let generation = 0;
const QUALITY = { low: 1, medium: 1.5, high: 2 };
const failure = reason => ({ ok: false, reason });
const SCENES = {
  hall: () => import('./scenes/hall.mjs?v=1'),
  arena: () => import('./scenes/arena.mjs?v=5'),
  yard: () => import('./scenes/yard.mjs?v=5'),
  library: () => import('./scenes/library.mjs?v=1')
};

function clearPeople(world) {
  for (const entry of world.people.values()) { entry.avatar.dispose(); entry.avatar.group.removeFromParent(); }
  world.people.clear();
}

function updatePeople(world, state, dt) {
  // Cảnh Sân đấu đã tự vẽ người chơi; lớp nối bổ sung NPC và các cảnh còn lại.
  const list = (world.sceneName === 'arena' ? [] : state.players || []).concat(state.npcs || []);
  const seen = new Set();
  for (const person of list) {
    seen.add(person.id);
    let entry = world.people.get(person.id);
    if (!entry) {
      entry = { avatar: world.createAvatar(person.look, { role: person.role }), look: '' };
      world.people.set(person.id, entry); world.ctx.scene.add(entry.avatar.group);
    }
    const look = JSON.stringify(person.look);
    if (look !== entry.look) { entry.avatar.setLook(person.look); entry.look = look; }
    const pos = globalThis.ViewMath.toWorld(state.scene, person.x, person.z);
    entry.avatar.group.position.set(pos.x, world.content.surfaceHeight?.(person.x, person.z) || 0, pos.z);
    entry.person = person;
    entry.avatar.update({ ...person, now: state.now, isSelf: person.id === state.me, view: world.ctx.view, reducedMotion: world.ctx.reducedMotion }, dt);
  }
  for (const [id, entry] of world.people) if (!seen.has(id)) {
    entry.avatar.dispose(); entry.avatar.group.removeFromParent(); world.people.delete(id);
  }
}

function choose(world, event) {
  const rect = world.canvas.getBoundingClientRect();
  world.cursor.set((event.clientX - rect.left) / rect.width * 2 - 1, 1 - (event.clientY - rect.top) / rect.height * 2);
  world.raycaster.setFromCamera(world.cursor, world.ctx.camera);
  world.ctx.scene.updateMatrixWorld(true);
  const state = world.getState();
  const visible = hit => {
    if (hit.object.userData.enabled === false) return false;
    for (let p = hit.object; p; p = p.parent) if (!p.visible) return false;
    return true;
  };
  const solid = world.raycaster.intersectObject(world.content.group, true).find(visible);
  let selected = null, distance = solid?.distance ?? Infinity;
  for (const entry of world.people.values()) {
    if (entry.person.id === state.me) continue;
    // Bảng tên và bong bóng lời (Sprite) có vùng bắt tia rất rộng, nuốt mất cú chạm vào kệ, thầy bói: chỉ tính thân nhân vật.
    const hit = world.raycaster.intersectObject(entry.avatar.group, true).find(h => !h.object.isSprite && visible(h));
    if (hit && hit.distance < distance) { selected = entry.person; distance = hit.distance; }
  }
  if (selected) {
    if (selected.onTable) {
      const table = state.tables.find(t => t.occupants.includes(selected.id));
      if (table) world.fire('table', table.id, table.occupants.indexOf(selected.id));
    } else if (selected.seated && state.scene === 'library') world.fire('seat', selected.sit);
    else world.fire(selected.role ? 'npc' : 'person', selected.id);
    return;
  }
  const hit = world.content.pick?.(world.raycaster);
  if (!hit) return;
  const kind = ({ bowl: 'altar', lib: 'library', jar: 'fortune' })[hit.kind] || hit.kind;
  if (kind === 'floor') world.fire(kind, hit.x, hit.z);
  else if (kind === 'table') world.fire(kind, hit.id ?? hit.table, hit.seat ?? -1);
  else if (kind === 'seat') world.fire(kind, hit.i ?? hit.index ?? hit.seat ?? hit.id);
  else if (kind === 'person' || kind === 'npc') world.fire(kind, hit.id);
  else if (kind === 'reader') world.fire(kind, hit.type ?? hit.id);   // cảnh Sân chùa trả id: 'horoscope' | 'tarot'
  else if (kind === 'shelf') world.fire(hit.shelf === 'dojo' ? 'dojo' : 'read');   // Tàng Kinh Các: kệ kinh / kệ Võ học
  else world.fire(kind);
}

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
      world.input?.update(time);
      const state = world.getState();
      world.content.update?.({ ...state, view: world.ctx.view }, dt);
      if (world.sceneName !== 'test') {
        updatePeople(world, state, dt);
        world.rig.update(state, world.content);
      }
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

export async function setScene(scene = 'test') {
  if (!active) return failure('Chưa mở cảnh 3D.');
  const world = active, revision = ++world.revision;
  try {
    const module = typeof scene === 'string' && Object.hasOwn(SCENES, scene) ? await SCENES[scene]() : scene;
    if (active !== world || revision !== world.revision) return failure('Đã hủy đổi cảnh 3D.');
    const builder = scene === 'test' ? buildTest : module?.build;
    if (typeof builder !== 'function') return failure('Cảnh này chưa có 3D. Xin dùng giao diện 2D.');
    const content = builder({ ...world.ctx, size: globalThis.ViewMath?.SCENE_SIZE[scene], reduceMotion: world.ctx.reducedMotion });
    if (!content?.group?.isObject3D) return failure('Cảnh 3D chưa có nhóm hình.');
    clearPeople(world); release(world.content);
    world.content = content; world.sceneName = scene;
    world.ctx.scene.add(content.group);
    return { ok: true };
  } catch (error) {
    return failure('Cảnh này chưa có 3D. Xin dùng giao diện 2D.');
  }
}

export function setView(view) {
  if (!active) return failure('Chưa mở cảnh 3D.');
  if (view !== 'first' && view !== 'third') return failure('Góc nhìn chưa hợp lệ.');
  active.ctx.view = view;
  active.rig?.setView(view);
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
  world.input?.dispose(); clearPeople(world);
  try { release(world.content); } finally { world.kit?.disposeKit(); world.renderer.dispose(); }
}

// Luôn trả kết quả thay vì ném lỗi, để bên gọi quay về 2D khi thiếu WebGL2/lỗi nạp.
export async function start({ canvas, scene = 'test', getState = () => ({}), on = {}, quality = 'medium', view = 'third', joystick } = {}) {
  stop();
  const ticket = generation;
  let renderer = null;
  try {
    if (!canvas || typeof canvas.getContext !== 'function') return failure('Chưa có khung vẽ 3D.');
    const context = canvas.getContext('webgl2', { antialias: true, alpha: false });
    if (!context) return failure('Máy chưa hỗ trợ WebGL2. Xin dùng giao diện 2D.');
    const [THREE, kit, avatars] = await Promise.all([import('three'), import('./kit.mjs?v=2'), import('./avatar-glb.mjs?v=2')]);
    if (ticket !== generation) return failure('Đã hủy mở cảnh 3D.');
    renderer = new THREE.WebGLRenderer({ canvas, context });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
    const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 100);
    camera.position.set(8, 7, 10);
    camera.lookAt(0, 0.5, 0);
    const root = new THREE.Scene();
    root.background = new THREE.Color(0x292620);
    const world = {
      canvas, renderer, getState, kit, createAvatar: avatars.makeAvatar, people: new Map(), revision: 0,
      raycaster: new THREE.Raycaster(), cursor: new THREE.Vector2(),
      content: null, frame: 0, last: null,
      fire: (kind, ...args) => on.fire ? on.fire(kind, ...args) : on[kind]?.(...args),
      ctx: { THREE, kit, scene: root, camera, renderer, on, quality: Object.hasOwn(QUALITY, quality) ? quality : 'medium', view: 'third', reducedMotion: !!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches }
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
    const result = await setScene(scene);
    if (active !== world) return failure('Đã hủy mở cảnh 3D.');
    if (!result.ok) { stop(); return result; }
    if (scene !== 'test' && globalThis.ViewMath) {
      world.rig = createCamera({ camera, math: globalThis.ViewMath, mode: view });
      world.input = createInput({ canvas, camera: world.rig, math: globalThis.ViewMath, getState, fire: world.fire, choose: event => choose(world, event), joystick });
    }
    setView(view);
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
