'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');
const Actors = require('../public/js/actors');
const ViewMath = require('../public/js/view-math');

function hallFixture(handlers = {}) {
  let nextFrame, time = 1000, clock = 1800000000000, draws = 0;
  class ClockDate extends Date { static now() { return clock; } }
  const gradient = { addColorStop() {} };
  const context = new Proxy({}, { get(target, key) {
    if (key in target) return target[key];
    if (key === 'measureText') return text => ({ width: String(text).length * 6 });
    if (key === 'createLinearGradient' || key === 'createRadialGradient') return () => gradient;
    return () => { draws++; };
  }, set(target, key, value) { target[key] = value; return true; } });
  const canvas = { width: 960, height: 600, style: {}, getContext: () => context,
    getBoundingClientRect: () => ({ width: 960, height: 600 }), addEventListener() {} };
  const sandbox = { Actors, Math, Date: ClockDate, Image: class {}, performance: { now: () => time },
    matchMedia: () => ({ matches: false }), addEventListener() {},
    document: { hidden: false, createElement: () => ({ getContext: () => context }) },
    requestAnimationFrame: callback => { nextFrame = callback; } };
  vm.runInNewContext(fs.readFileSync(require.resolve('../public/js/hall'), 'utf8'), sandbox);
  const H = sandbox.Hall;
  H.init(canvas, handlers);
  return { H, get draws() { return draws; }, step(n = 1) {
    for (let i = 0; i < n; i++) { time += 64; clock += 64; nextFrame(time); }
  } };
}

test('snapshot 3D có đủ trạng thái, đóng băng sâu và không sao chép uid', () => {
  const f = hallFixture(), H = f.H;
  H.setMe(7);
  H.setPlayers([{ id: 7, uid: 'khong-duoc-lo', name: 'An Tâm', scene: 'hall', x: 0.5, z: 0.7,
    look: { g: 'nam', c: 6, h: 1, uid: 'look-khong-duoc-lo' } }]);
  H.setAura(7, { t: 2, until: Date.now() + 9e12, uid: 'aura-khong-duoc-lo' });
  H.setTalk(7, 0.8); H.bubble(7, 'Bình an'); H.bow(7);
  H.setIncense([{ id: 1, x: 0.2, tilt: 0.1, litAt: 1, until: 9e12, uid: 'nhang-khong-duoc-lo' }]);
  H.setAltar({ lotus: 3 });
  H.setTables([{ table: 1, status: 'playing', game: 'chess', seats: [{ pid: 7, uid: 'ghe-khong-duoc-lo' }, null] }]);
  f.step(2);
  const state = H.view3d.snapshot(), person = state.players[0];
  for (const key of ['scene', 'me', 'players', 'npcs', 'incense', 'altar', 'tables', 'seats', 'daylight', 'now']) assert.ok(key in state, key);
  for (const key of ['id', 'name', 'look', 'x', 'z', 'dx', 'dz', 'yaw', 'walking', 'seated', 'sit', 'bow', 'aura', 'bubble', 'talk']) assert.ok(key in person, key);
  assert.equal(state.me, 7); assert.equal(person.bubble.text, 'Bình an'); assert.equal(person.talk, 0.8);
  assert.ok(person.bow > 0); assert.ok(person.aura); assert.equal(state.altar.lotus, 3);
  assert.ok(state.npcs.length > 0); assert.equal(state.tables[0].occupants[0], 7);
  assert.doesNotMatch(JSON.stringify(state), /uid|khong-duoc-lo/);
  function frozen(value) {
    if (!value || typeof value !== 'object') return;
    assert.ok(Object.isFrozen(value)); Object.values(value).forEach(frozen);
  }
  frozen(state);
  assert.throws(() => { person.look.c = 10; }, TypeError);
  assert.equal(H.player(7).look.c, 6);
  H.setScene('library'); H.setSweeper({ id: 'su-kien', until: 9e12 }); f.step();
  assert.ok(H.view3d.snapshot().npcs.some(p => p.id === -999 && p.role === 'sweeper'));
  const npc = H.view3d.snapshot().npcs.find(p => p.id !== -999);
  const text = H.npcTalk(npc.id);
  assert.equal(H.view3d.snapshot().npcs.find(p => p.id === npc.id).bubble.text, text);
  assert.equal(state.scene, 'hall', 'bản chụp cũ giữ nguyên sau khi đổi cảnh');
});

test('hold 3D ngừng toàn bộ lệnh vẽ, vẫn nội suy người và bước NPC; trả lại 2D và pause đúng', () => {
  const f = hallFixture(), H = f.H;
  H.setPlayers([{ id: 1, name: 'Thiện', x: 0.2, z: 0.6, look: { g: 'nam', c: 2, h: 1 } }]);
  f.step();
  const start = H.view3d.snapshot().npcs.map(p => [p.id, p.x, p.z]);
  H.positions([[1, 800, 800]]); H.view3d.hold(true);
  const draws = f.draws; f.step();
  const p = H.view3d.snapshot().players[0];
  assert.equal(f.draws, draws); assert.ok(p.x > 0.2 && p.x < 0.8); assert.ok(p.walking);
  f.step(600);
  assert.equal(f.draws, draws);
  assert.ok(H.view3d.snapshot().npcs.some(p => start.some(([id, x, z]) => id === p.id && Math.hypot(p.x - x, p.z - z) > 0.001)));
  H.pause(true); const before = H.player(1).dx; H.positions([[1, 300, 600]]); f.step();
  assert.equal(H.player(1).dx, before, 'Võ Học Các vẫn tạm dừng vòng cập nhật');
  H.pause(false); H.view3d.hold(false); f.step();
  assert.ok(f.draws > draws, 'trở lại 2D tiếp tục vẽ');
});

test('fire 3D chuyển đúng tên và tham số tới mọi handler 2D, kẹp sàn và bỏ tên lạ', () => {
  const calls = [], handlers = {};
  const cases = [['floor', 0.4, 0.6], ['altar'], ['statue'], ['library'], ['read'], ['dojo'], ['seat', 2],
    ['person', 42], ['npc', -300], ['fortune'], ['reader', 'tarot'], ['table', 3, 1]];
  for (const [kind] of cases) handlers[kind] = (...args) => { calls.push([kind, ...args]); return 'đã gọi'; };
  const { H } = hallFixture(handlers);
  for (const args of cases) assert.equal(H.view3d.fire(...args), 'đã gọi');
  assert.deepEqual(calls, cases);
  H.view3d.fire('floor', -1, 8); assert.deepEqual(calls.at(-1), ['floor', 0.03, 0.97]);
  H.view3d.fire('__proto__'); H.view3d.fire('constructor'); H.view3d.fire('floor', NaN, 0.5);
  assert.equal(calls.length, cases.length + 1);
});

test('máy quay dùng lại ViewMath và đặt lại pitch khi đổi góc nhìn', async () => {
  const { createCamera } = await import(pathToFileURL(require.resolve('../public/js/world3d/camera.mjs')).href);
  let position, look;
  const rig = createCamera({ math: ViewMath, camera: { position: { set(...args) { position = args; } },
    lookAt(...args) { look = args; }, updateMatrixWorld() {} } });
  rig.view.pitch = 1; rig.setView('first'); assert.equal(rig.view.pitch, 0.04);
  rig.update({ scene: 'hall', me: 1, players: [{ id: 1, x: 0.5, z: 0.6 }] }, { bounds: { minX: -8, maxX: 8, minZ: -5, maxZ: 5 } });
  assert.ok(look[1] > position[1], 'pitch dương ở góc thứ nhất nhìn lên');
  rig.setView('third'); assert.equal(rig.view.pitch, 0.34);
  rig.update({ scene: 'hall', players: [] }, { bounds: { minX: -8, maxX: 8, minZ: -5, maxZ: 5 } });
  assert.ok(position[1] > look[1], 'pitch dương ở góc thứ ba nâng máy quay');
});

function eventSurface() {
  const handlers = new Map();
  return { addEventListener(type, fn) { if (!handlers.has(type)) handlers.set(type, new Set()); handlers.get(type).add(fn); },
    removeEventListener(type, fn) { handlers.get(type)?.delete(fn); },
    emit(type, event = {}) { for (const fn of handlers.get(type) || []) fn({ type, ...event }); },
    setPointerCapture() {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }) };
}

test('điều khiển 3D: WASD/cần ảo tối đa 8 lần/giây, không bắt phím lúc gõ, kéo/chụm không thành chạm', async t => {
  const { createInput } = await import(pathToFileURL(require.resolve('../public/js/world3d/input.mjs')).href);
  const events = eventSurface(), doc = eventSurface(), canvas = eventSurface(), joystick = eventSurface();
  const old = Object.fromEntries(['document', 'addEventListener', 'removeEventListener'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  Object.assign(globalThis, { document: doc, addEventListener: events.addEventListener, removeEventListener: events.removeEventListener });
  t.after(() => { for (const [key, descriptor] of Object.entries(old)) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; } });
  const calls = [], picks = [], view = ViewMath.createView();
  const input = createInput({ canvas, joystick, camera: { view }, math: ViewMath,
    getState: () => ({ scene: 'hall', me: 1, players: [{ id: 1, x: 0.5, z: 0.5 }] }),
    fire: (...args) => calls.push(args), choose: event => picks.push(event) });
  const key = { key: 'w', target: { closest: () => null }, preventDefault() {} };
  events.emit('keydown', key);
  for (let time = 0; time < 1000; time++) input.update(time);
  assert.equal(calls.length, 8); assert.equal(calls[0][0], 'floor'); assert.ok(calls[0][2] < 0.5);
  events.emit('blur'); calls.length = 0;
  events.emit('keydown', { ...key, target: { closest: () => ({}) } }); input.update(1100); assert.equal(calls.length, 0);
  joystick.emit('pointerdown', { pointerId: 9, clientX: 100, clientY: 50, preventDefault() {} });
  input.update(1200); assert.ok(calls[0][1] > 0.5);
  joystick.emit('pointercancel', { pointerId: 9 }); input.update(1400); assert.equal(calls.length, 1);
  const pointer = { pointerId: 1, pointerType: 'touch', clientX: 30, clientY: 30 };
  canvas.emit('pointerdown', pointer); canvas.emit('pointerup', pointer); assert.equal(picks.length, 1);
  canvas.emit('pointerdown', pointer); canvas.emit('pointermove', { ...pointer, clientX: 70 }); canvas.emit('pointerup', pointer);
  assert.equal(picks.length, 1); assert.notEqual(view.yaw, 0);
  canvas.emit('pointerdown', pointer);
  canvas.emit('pointerdown', { ...pointer, pointerId: 2, clientX: 70 });
  canvas.emit('pointermove', { ...pointer, pointerId: 2, clientX: 90 });
  canvas.emit('pointerup', { ...pointer, pointerId: 2 }); canvas.emit('pointerup', pointer);
  assert.equal(picks.length, 1); assert.ok(view.dist < 5);
  input.dispose(); events.emit('keydown', key); input.update(2000); assert.equal(calls.length, 1);
});
