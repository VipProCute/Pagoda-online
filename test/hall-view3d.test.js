'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');
const Actors = require('../public/js/actors');
const ViewMath = require('../public/js/view-math');
const MERIT = require('../public/js/merit');
const AURA = require('../public/js/aura');

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
  const sandbox = { Actors, MERIT, AURA, Math, Date: ClockDate, Image: class {}, performance: { now: () => time },
    matchMedia: () => ({ matches: false }), addEventListener() {},
    document: { hidden: false, createElement: () => ({ getContext: () => context }) },
    requestAnimationFrame: callback => { nextFrame = callback; } };
  vm.runInNewContext(fs.readFileSync(require.resolve('../public/js/hall'), 'utf8'), sandbox);
  const H = sandbox.Hall;
  H.init(canvas, handlers);
  return { H, get draws() { return draws; }, setClock(value) { clock = value; }, step(n = 1) {
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

test('snapshot giữ đúng sáu pháp tướng, bốn quỷ, 666, Obito và giờ hết hào quang của 2D', () => {
  const f = hallFixture(), H = f.H, now = 1800000000000;
  f.step(); f.setClock(now);
  H.setPlayers([{ id: 1, name: 'Người thử', look: { g: 'nam', c: 0, h: 2 } }]);
  H.view3d.hold(true);
  for (const mt of [0, 99, 100, 500, 666, 667, 1000, 5000, 10000, 50000, -1, -100, -200, -500, -1000]) {
    H.setMerit(1, mt);
    const p = H.view3d.snapshot().players[0];
    assert.equal(p.meritRank, mt === 666 ? 0 : MERIT.rankOf(mt), `${mt} công đức`);
    assert.equal(JSON.stringify(p.demon), JSON.stringify(MERIT.visualDemonOf(mt)));
    assert.equal(p.now, now);
    assert.equal(p.obito, false);
  }
  for (const tier of AURA.TIERS) {
    H.setAura(1, { t: tier.n, until: now + 20000, uid: 'khong-duoc-lo' });
    const p = H.view3d.snapshot().players[0];
    assert.equal(p.aura.t, tier.n); assert.equal(p.aura.color, tier.color);
  }
  H.setOffset(20000);
  assert.equal(H.view3d.snapshot().players[0].aura, null, 'tắt đúng giờ máy chủ, dù giờ máy khách chưa đổi');
  H.setScene('library');
  assert.ok(H.view3d.snapshot().npcs.some(p => p.role === 'obito' && p.obito));
  // Ngoại hình NPC cục bộ: kiểm trường được sao chép, không phụ thuộc lượt chọn ngẫu nhiên.
  H.setScene('hall'); H.npc(-100).look = { g: 'nu', c: 2, h: 0, npcFashion: true };
  assert.ok(H.view3d.snapshot().npcs.some(p => p.look.g === 'nu' && p.look.npcFashion));
  assert.doesNotMatch(JSON.stringify(H.view3d.snapshot()), /uid|khong-duoc-lo/);
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

test('Ảnh chụp Sân chùa truyền ngày đêm theo giờ Việt Nam thật, kể cả khi đang giữ 3D', () => {
  const f = hallFixture(); f.H.setScene('yard'); f.H.view3d.hold(true);
  for (const [hour, daylight] of [[5, false], [6, true], [17, true], [18, false], [23, false]]) {
    f.setClock(Date.parse(`2026-11-13T${String(hour).padStart(2, '0')}:00:00+07:00`));
    assert.equal(f.H.view3d.snapshot().daylight, daylight, `${hour} giờ Việt Nam`);
  }
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
  rig.view.pitch = 1.2; rig.view.dist = 9;
  rig.update({ scene: 'arena', me: 1, players: [{ id: 1, x: .5, z: .5 }] },
    { surfaceHeight: () => .54, bounds: { minX: -20, maxX: 20, minZ: -20, maxZ: 20 } });
  assert.equal(position[1], 6, 'giữ giới hạn trần bằng cách rút cả tia');
  assert.ok(Math.abs(Math.atan2(position[1] - look[1], Math.hypot(position[0] - look[0], position[2] - look[2])) - rig.view.pitch) < 1e-10);
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

function viewUIFixture(saved, loadWorld) {
  const events = eventSurface(), elements = [], holds = [], starts = [];
  const node = () => {
    const value = { ...eventSurface(), style: {}, children: [], clientLeft: 0, clientTop: 0, scrollLeft: 0, scrollTop: 0,
      setAttribute() {}, append(...children) { this.children.push(...children); children.forEach(child => { child.parentElement = this; }); },
      insertAdjacentElement(where, child) { child.parentElement = this.parentElement; } };
    elements.push(value); return value;
  };
  let stored = JSON.stringify(saved), stops = 0;
  const world = { async start(options) { starts.push(options); return { ok: true }; }, stop() { stops++; }, setView() {} };
  const H = { scene: 'arena', attach() {}, setScene(scene) { this.scene = scene; }, pause() {},
    view3d: { snapshot: () => ({ scene: H.scene }), fire() {}, hold(on) { holds.push(on); } } };
  const target = node(); target.parentElement = node(); target.style.visibility = '';
  const sandbox = { Hall: H, document: { createElement: node, body: node() }, addEventListener: events.addEventListener,
    localStorage: { getItem: () => stored, setItem(key, value) { stored = value; } },
    loadWorld: loadWorld || (() => Promise.resolve(world)) };
  const source = fs.readFileSync(require.resolve('../public/js/view3d-ui'), 'utf8');
  // Chỉ thay đầu vào tải mạng; chạy nguyên logic DOM, PK và lựa chọn đã lưu.
  assert.match(source, /import\('\/js\/world3d\/index\.mjs\?v=\d+'\)/);
  vm.runInNewContext(source.replace(/import\('\/js\/world3d\/index\.mjs\?v=\d+'\)/, 'loadWorld()'), sandbox);
  sandbox.View3D.init({ canvas: target });
  return { V: sandbox.View3D, H, target, starts, holds, events,
    get toolbar() { return elements.find(element => element.className === 'v3-controls'); },
    get layerCanvas() { return elements.find(element => element.className === 'v3-canvas'); },
    get prefs() { return JSON.parse(stored); }, get stops() { return stops; } };
}
const flushUI = () => new Promise(resolve => setImmediate(resolve));

test('PK tắt lớp 3D, ẩn nút góc nhìn, khóa V và khôi phục đúng lựa chọn cũ khi rời trận', async () => {
  for (const on of [true, false]) {
    const saved = { on, mode: 'first', quality: 'medium' }, f = viewUIFixture(saved);
    await flushUI();
    assert.equal(f.V.active, on);
    if (on) assert.equal(f.target.style.visibility, 'hidden');
    f.V.setPK(true); await flushUI();
    assert.equal(f.V.active, false); assert.equal(f.target.style.visibility, '');
    assert.equal(f.layerCanvas.hidden, true); assert.equal(f.toolbar.hidden, true);
    assert.equal(f.toolbar.children[1].hidden, true); assert.equal(f.holds.at(-1), false);
    f.events.emit('keydown', { key: 'v', target: {}, preventDefault() {} });
    assert.deepEqual(f.prefs, saved, 'không lưu đè 2D hay đổi mode khi PK');
    if (on) assert.ok(f.stops > 0);
    f.V.setPK(false); await flushUI();
    assert.equal(f.V.active, on); assert.equal(f.toolbar.hidden, false);
    assert.equal(f.toolbar.children[1].hidden, !on);
    assert.deepEqual(f.prefs, saved);
    if (on) assert.equal(f.starts.at(-1).view, 'first');
    else assert.equal(f.starts.length, 0, 'lựa chọn 2D không tự bật 3D sau PK');
  }
});

test('Vào PK lúc đang tải module 3D không cho lượt tải cũ che sàn đấu 2D', async () => {
  let resolveLoad;
  const loading = new Promise(resolve => { resolveLoad = resolve; });
  const f = viewUIFixture({ on: true, mode: 'third', quality: 'medium' }, () => loading);
  await flushUI(); f.V.setPK(true); await flushUI();
  let starts = 0;
  resolveLoad({ start() { starts++; return { ok: true }; }, stop() {} });
  await flushUI();
  assert.equal(starts, 0); assert.equal(f.V.active, false);
  assert.equal(f.target.style.visibility, ''); assert.equal(f.toolbar.hidden, true);
});

test('Arena gọi cờ PK ở sảnh, trận, kết quả và trả lại lựa chọn khi ra sân hoặc rời nơi', () => {
  const source = fs.readFileSync(require.resolve('../public/js/arena'), 'utf8');
  const go = source.slice(source.indexOf('  function go(screen) {'), source.indexOf('  let yardShown = false;'));
  const hide = source.slice(source.indexOf('  function hide() {'), source.indexOf('  root.Arena ='));
  const calls = [], section = () => ({ querySelector: () => null });
  const S = { visible: true, mounted: false, ui: { roster: { sec: section() }, lobby: section(), match: section(), end: section(),
    sub: {}, invites: {}, hturn: {}, hbar: {}, root: { dataset: {} } } };
  const noop = () => {};
  const sandbox = { S, root: { View3D: { setPK(on) { calls.push(on); } } }, yardOn: noop, renderRoster: noop,
    startPaint: noop, stopPaint: noop, refreshCtl: noop, clearInterval: noop, clearMatchTimers: noop };
  vm.runInNewContext(go + '\n' + hide + '\nthis.goScreen = go; this.leave = hide;', sandbox);
  for (const screen of ['roster', 'lobby', 'match', 'end', 'roster']) sandbox.goScreen(screen);
  sandbox.goScreen('match'); sandbox.leave();
  assert.deepEqual(calls, [false, true, true, true, false, true, false]);
});
