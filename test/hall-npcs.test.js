'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const merit = require('../public/js/merit');
const Actors = require('../public/js/actors');

// Math.random có hạt giống để NPC thường đứng chỗ cố định giữa các lần chạy
function seededMath(seed) {
  let s = seed >>> 0;
  return Object.assign(Object.create(Math), { random: () => { s = (s + 0x6d2b79f5) >>> 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; } });
}

test('mọi NPC đi lang thang, NPC cơ duyên theo giờ máy chủ, chạm thân NPC (kể cả Tảo Địa Tăng) tới handlers.npc', () => {
  let nextFrame, tapped = null, picked = null, clock = 1_800_000_000_000;
  class ClockDate extends Date { constructor(...a) { if (a.length) super(...a); else super(clock); } static now() { return clock; } }
  const labels = [];
  const labelPositions = new Map();
  const images = [];
  const gradient = { addColorStop() {} };
  const ctx = new Proxy({}, { get(target, key) {
    if (key in target) return target[key];
    if (key === 'measureText') return text => ({ width: String(text).length * 6 });
    if (key === 'fillText') return (text, x, y) => { labels.push(text); labelPositions.set(text, [x, y]); };
    if (key === 'drawImage') return image => { if (image && image.src) images.push(image.src); };
    if (key === 'createLinearGradient' || key === 'createRadialGradient') return () => gradient;
    return () => {};
  }, set(target, key, value) { target[key] = value; return true; } });
  const canvas = { width: 960, height: 600, style: {}, listeners: {}, getContext: () => ctx,
    getBoundingClientRect: () => ({ width: 960, height: 600, left: 0, top: 0 }),
    addEventListener(type, fn) { this.listeners[type] = fn; } };
  class FakeImage {
    constructor() { this.complete = false; this.naturalWidth = 0; }
    set src(v) { this._src = v; if (v === '/img/obito-sprite.png') { this.complete = true; this.naturalWidth = 1024; } }
    get src() { return this._src; }
  }
  const sandbox = { Math: seededMath(7), Date: ClockDate, Actors, Image: FakeImage, MERIT: merit, devicePixelRatio: 1,
    matchMedia: () => ({ matches: false }), addEventListener() {}, performance: { now: () => 1000 },
    document: { hidden: false, createElement: () => ({ width: 0, height: 0, getContext: () => ctx }) },
    requestAnimationFrame: fn => { nextFrame = fn; } };
  vm.runInNewContext(fs.readFileSync(require.resolve('../public/js/hall.js'), 'utf8'), sandbox);
  sandbox.Hall.init(canvas, { npc: id => { tapped = id; }, person: id => { picked = id; } });
  const H = sandbox.Hall;
  let ts = 1000;
  const frames = n => { for (let i = 0; i < n; i++) { ts += 64; clock += 64; nextFrame(ts); } };
  // chạm khắp vùng thân NPC đang vẽ: có ít nhất một điểm tới đúng NPC đó
  const tapBody = n => {
    for (let y = n.sy - 100 * n.s; y < n.sy; y += 3) for (let x = n.sx - 15 * n.s; x <= n.sx + 15 * n.s; x += 3) {
      tapped = null; canvas.listeners.pointerdown({ clientX: x, clientY: y });
      if (tapped === n.id) return true;
    }
    return false;
  };
  const near = (p, q) => Math.hypot((p.x - q.x) * 1.6, p.z - q.z) < 1e-9;
  const FORTUNE = { hall: [-300, 'beggar'], yard: [-301, 'wanderer'], library: [-302, 'obito'] };
  for (const scene of ['hall', 'yard', 'library', 'arena']) {
    labels.length = 0; H.setScene(scene); frames(1);
    assert.equal(labels.filter(s => s.endsWith(' · NPC')).length, scene === 'arena' ? 2 : 3, scene);
    if (FORTUNE[scene]) {
      const [id, role] = FORTUNE[scene], f = Actors.FORTUNE_NPCS[role], n = H.npc(id);
      assert.ok(n instanceof Actors.FortuneNpc && n instanceof Actors.Npc && n instanceof Actors.Actor, role);
      assert.equal(n.npc.role, role);
      assert.ok(near(n, Actors.wanderAt(f.seed, f.area, clock)), role + ': đứng đúng chỗ máy chủ tính');
      frames(30);                                           // để chỗ vẽ (dx, dz) đuổi kịp đích
      assert.ok(tapBody(n), role + ': chạm thân NPC cơ duyên tới handlers.npc');
      if (scene === 'library') assert.ok(images.includes('/img/obito-sprite.png'), 'sprite Obito được vẽ lên NPC');
    }
  }
  // đi lang thang: sau vài chặng, NPC cơ duyên và NPC thường đều đã đổi chỗ
  H.setScene('yard'); frames(1);
  const wand = H.npc(-301), reg = H.npc(-102);
  assert.ok(reg instanceof Actors.Npc && !(reg instanceof Actors.FortuneNpc), 'NPC thường');
  assert.deepEqual(reg.menu(), wand.menu(), 'NPC cơ duyên và NPC thường cùng lựa chọn Trò chuyện');
  const w0 = { x: wand.x, z: wand.z }, r0 = { x: reg.x, z: reg.z };
  for (let i = 0; i < 3 * Actors.LEG_MS / 640; i++) frames(10);
  assert.ok(!near(wand, w0), 'NPC cơ duyên đã đi chỗ khác');
  assert.ok(!near(reg, r0), 'NPC thường đã đi chỗ khác');
  assert.ok(near(wand, Actors.wanderAt(Actors.FORTUNE_NPCS.wanderer.seed, Actors.FLOOR, clock)), 'vẫn theo đúng giờ máy chủ');
  // trò chuyện: NPC thường đứng lại và nói một câu
  const said = H.npcTalk(-102);
  assert.ok(said && reg.npc.lines.includes(said) && reg.bubble.text === said);
  const r1 = { x: reg.x, z: reg.z }; frames(40);
  assert.ok(near(reg, r1), 'NPC thường đứng lại khi được bắt chuyện');
  // Tảo Địa Tăng cũng là NPC cơ duyên: đi lang thang theo mã sự kiện
  H.setScene('library');
  H.setSweeper({ id: 'test-id', x: 0.5, z: 0.55, until: clock + 600000 });
  labels.length = 0; frames(30);
  assert.ok(labels.some(s => s.includes('Tảo Địa Tăng')));
  const sw = H.npc(-999);
  assert.ok(sw instanceof Actors.FortuneNpc);
  assert.deepEqual(sw.gift(), { kind: 'sweeper', event: 'sweeper:claim', data: { id: 'test-id' } });
  assert.ok(near(sw, Actors.wanderAt(Actors.seedOf('test-id'), Actors.SWEEPER.area, clock)));
  assert.ok(tapBody(sw), 'chạm thân Tảo Địa Tăng tới handlers.npc');
  H.setSweeper(null); labels.length = 0; frames(1);
  assert.ok(!labels.some(s => s.includes('Tảo Địa Tăng')));
  assert.equal(H.npc(-999), null);
  H.setMe(1);
  H.setPlayers([{ id: 42, name: 'Người thử', look: { g: 'nam', c: 1, h: 2 }, x: 0.2, z: 0.7, scene: 'yard' }]);
  H.setScene('yard'); frames(1);
  canvas.listeners.pointerdown({ clientX: 160, clientY: 475 });
  assert.equal(picked, 42, 'chạm người ở sân chùa mở tương tác');
});

test('Tàng Kinh Các: chạm bồ đoàn có người ngồi tới handler bồ đoàn, không mở hộp người chơi', () => {
  let nextFrame, seat = null, picked = null;
  const gradient = { addColorStop() {} };
  const ctx = new Proxy({}, { get(target, key) {
    if (key in target) return target[key];
    if (key === 'measureText') return text => ({ width: String(text).length * 6 });
    if (key === 'createLinearGradient' || key === 'createRadialGradient') return () => gradient;
    return () => {};
  }, set(target, key, value) { target[key] = value; return true; } });
  const canvas = { width: 960, height: 600, style: {}, listeners: {}, getContext: () => ctx,
    getBoundingClientRect: () => ({ width: 960, height: 600, left: 0, top: 0 }),
    addEventListener(type, fn) { this.listeners[type] = fn; } };
  class FakeImage { constructor() { this.complete = false; this.naturalWidth = 0; } set src(v) { this._src = v; } get src() { return this._src; } }
  const sandbox = { Math, Date, Actors, Image: FakeImage, MERIT: merit, devicePixelRatio: 1,
    matchMedia: () => ({ matches: false }), addEventListener() {}, performance: { now: () => 1000 },
    document: { hidden: false, createElement: () => ({ width: 0, height: 0, getContext: () => ctx }) },
    requestAnimationFrame: fn => { nextFrame = fn; } };
  vm.runInNewContext(fs.readFileSync(require.resolve('../public/js/hall.js'), 'utf8'), sandbox);
  sandbox.Hall.init(canvas, { seat: i => { seat = i; }, person: id => { picked = id; } });
  sandbox.Hall.setMe(1);
  sandbox.Hall.setScene('library');
  const scan = () => {
    const hits = [], persons = [];
    for (let y = 150; y < 600; y += 5) for (let x = 0; x < 960; x += 5) {
      seat = null; picked = null;
      canvas.listeners.pointerdown({ clientX: x, clientY: y });
      if (seat !== null) hits.push(x + ',' + y);
      if (picked !== null) persons.push(x + ',' + y);
    }
    return { hits, persons };
  };
  nextFrame(1000);
  const empty = scan();
  assert.ok(empty.hits.length > 0, 'có vùng chạm bồ đoàn khi thư viện trống');
  sandbox.Hall.setPlayers([{ id: 42, name: 'Người thử', look: { g: 'nam', c: 1, h: 2 }, x: sandbox.Hall.seatPos(0)[0], z: sandbox.Hall.seatPos(0)[1], scene: 'library', sit: 0 }]);
  sandbox.Hall.setSit(42, 0, '');
  nextFrame(1100); nextFrame(1200);
  const seated = scan();
  const lost = empty.hits.filter(p => !seated.hits.includes(p));
  assert.deepEqual(lost, [], 'vùng bồ đoàn vẫn tới handler seat dù có người ngồi (để app.js chọn chỗ trống gần nhất)');
  assert.ok(seated.persons.length > 0, 'phần người ngồi ngoài vùng bồ đoàn vẫn mở hộp người chơi');
});

test('Hall.nearestFreeSeat chọn đúng bồ đoàn trống gần nhất, hết chỗ trả -1', () => {
  const sandbox = { Math, Date, Actors, Image: class { }, MERIT: merit, devicePixelRatio: 1,
    matchMedia: () => ({ matches: false }), addEventListener() {}, performance: { now: () => 1000 },
    document: { hidden: false, createElement: () => ({ width: 0, height: 0, getContext: () => ({}) }) },
    requestAnimationFrame() {} };
  vm.runInNewContext(fs.readFileSync(require.resolve('../public/js/hall.js'), 'utf8'), sandbox);
  const H = sandbox.Hall, n = H.seatCount;
  assert.ok(n >= 3, 'có nhiều bồ đoàn');
  const all = new Set(Array.from({ length: n }, (_, i) => i));
  // Không ai ngồi: chạm đúng vị trí bồ đoàn i thì chọn chính nó.
  for (let i = 0; i < n; i++) assert.equal(H.nearestFreeSeat(...H.seatPos(i), new Set()), i);
  // Bồ đoàn i có người: chọn chỗ trống gần nhất (đúng theo khoảng cách có trọng số), khác i.
  for (let i = 0; i < n; i++) {
    const [x, z] = H.seatPos(i), taken = new Set([i]);
    let want = -1, bd = Infinity;
    for (let j = 0; j < n; j++) {
      if (j === i) continue;
      const [sx, sz] = H.seatPos(j), d = Math.hypot((x - sx) * 1.6, z - sz);
      if (d < bd) { bd = d; want = j; }
    }
    const got = H.nearestFreeSeat(x, z, taken);
    assert.notEqual(got, i);
    assert.equal(got, want, 'bồ đoàn ' + i);
  }
  assert.equal(H.nearestFreeSeat(0.5, 0.5, all), -1, 'hết chỗ');
  const rest = new Set(all); rest.delete(n - 1);
  assert.equal(H.nearestFreeSeat(...H.seatPos(0), rest), n - 1, 'chỉ còn một chỗ trống');
});

test('app.js sitAt dùng Hall.nearestFreeSeat khi bồ đoàn có người và CSS tạm ẩn dải gợi ý khi có panel tụng', () => {
  const app = fs.readFileSync(require.resolve('../public/js/app.js'), 'utf8');
  const start = app.indexOf('function sitAt(i)');
  const body = app.slice(start, app.indexOf("socket.emit('sit'", start));
  assert.ok(start > 0);
  assert.match(body, /takenSeats\(\)\.has\(i\)/);
  assert.match(body, /nearestFreeSeat\(x, z\)/);
  assert.match(body, /best < 0\) \{ toast\(/);
  assert.match(body, /mời bạn sang bồ đoàn bên cạnh/);
  assert.match(body, /i = best;/);
  assert.match(app, /Hall\.nearestFreeSeat\(x, z, takenSeats\(\)\)/);
  const css = fs.readFileSync(require.resolve('../public/css/style.css'), 'utf8');
  assert.match(css, /\.stage:has\(\.chantbar:not\(\[hidden\]\)\) \.stage-hint \{ display: none; \}/);
  assert.match(css, /\.chantbar \{ top: 62px;/);
  // Máy bàn: bảng tụng cũng nằm dưới thanh map, không bị che.
  assert.match(css, /\.chantbar \{ position: absolute; top: 62px;/);
});
