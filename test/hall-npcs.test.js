'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const merit = require('../public/js/merit');

test('vẽ NPC ở từng khu và chạm Tảo Địa Tăng trong thư viện', () => {
  let nextFrame, tapped = null, picked = null, secret = null;
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
  const sandbox = { Math, Date, Image: FakeImage, MERIT: merit, devicePixelRatio: 1,
    matchMedia: () => ({ matches: false }), addEventListener() {}, performance: { now: () => 1000 },
    document: { hidden: false, createElement: () => ({ width: 0, height: 0, getContext: () => ctx }) },
    requestAnimationFrame: fn => { nextFrame = fn; } };
  vm.runInNewContext(fs.readFileSync(require.resolve('../public/js/hall.js'), 'utf8'), sandbox);
  sandbox.Hall.init(canvas, { sweeper: id => { tapped = id; }, person: id => { picked = id; }, secretNpc: role => { secret = role; } });
  for (const scene of ['hall', 'yard', 'library', 'arena']) {
    labels.length = 0; sandbox.Hall.setScene(scene); nextFrame(1000);
    assert.equal(labels.filter(s => s.endsWith(' · NPC')).length, scene === 'arena' ? 2 : 3, scene);
    const name = { hall: 'Lão Ăn Mày · NPC', yard: 'Vạn Lý Độc Hành · NPC', library: 'Obito · NPC' }[scene];
    if (name) {
      assert.ok(labelPositions.has(name), name);
      const [x, y] = labelPositions.get(name);
      canvas.listeners.pointerdown({ clientX: x, clientY: y + 25 });
      assert.equal(secret, { hall: 'beggar', yard: 'wanderer', library: 'obito' }[scene]);
      if (scene === 'library') assert.ok(images.includes('/img/obito-sprite.png'), 'sprite Obito được vẽ lên NPC');
    }
  }
  sandbox.Hall.setScene('library');
  sandbox.Hall.setSweeper({ id: 'test-id', x: 0.5, z: 0.55, until: Date.now() + 60000 });
  labels.length = 0; nextFrame(1100);
  assert.ok(labels.some(s => s.includes('Tảo Địa Tăng')));
  canvas.listeners.pointerdown({ clientX: 480, clientY: 430 });
  assert.equal(tapped, 'test-id');
  sandbox.Hall.setSweeper(null); labels.length = 0; nextFrame(1200);
  assert.ok(!labels.some(s => s.includes('Tảo Địa Tăng')));
  sandbox.Hall.setMe(1);
  sandbox.Hall.setPlayers([{ id: 42, name: 'Người thử', look: { g: 'nam', c: 1, h: 2 }, x: 0.2, z: 0.7, scene: 'yard' }]);
  sandbox.Hall.setScene('yard'); nextFrame(1300);
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
  const sandbox = { Math, Date, Image: FakeImage, MERIT: merit, devicePixelRatio: 1,
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
  const sandbox = { Math, Date, Image: class { }, MERIT: merit, devicePixelRatio: 1,
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
