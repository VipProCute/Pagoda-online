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
  const sandbox = (() => {
    // Math giả: chỉ ghi đè random bằng bộ sinh có seed (LCG) để bố cục NPC giống nhau ở mọi lần chạy
    let seed = 987654321;
    const fakeMath = Object.create(Math); fakeMath.random = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
    return { Math: fakeMath, Date, Image: FakeImage, MERIT: merit, devicePixelRatio: 1,
      matchMedia: () => ({ matches: false }), addEventListener() {}, performance: { now: () => 1000 },
      document: { hidden: false, createElement: () => ({ width: 0, height: 0, getContext: () => ctx }) },
      requestAnimationFrame: fn => { nextFrame = fn; } };
  })();
  vm.runInNewContext(fs.readFileSync(require.resolve('../public/js/hall.js'), 'utf8'), sandbox);
  sandbox.Hall.init(canvas, { sweeper: id => { tapped = id; }, person: id => { picked = id; }, npc: def => { secret = def && def.role; } });
  for (const scene of ['hall', 'yard', 'library', 'arena']) {
    labels.length = 0; labelPositions.clear(); sandbox.Hall.setScene(scene); nextFrame(1000);
    assert.equal(labels.filter(s => s.endsWith(' · NPC')).length, scene === 'arena' ? 2 : 3, scene);
    const name = { hall: 'Lão Ăn Mày · NPC', yard: 'Vạn Lý Độc Hành · NPC', library: 'Obito · NPC' }[scene];
    const expect = { hall: 'beggar', yard: 'wanderer', library: 'obito' }[scene];
    if (name) {
      // NPC có thể bị khách vãng lai che: quét lưới lệch click quanh nhãn tên, vẫn không được thì bốc lại bố cục rồi thử tiếp
      let ok = false;
      const grid = [];
      for (const dx of [0, -18, 18, -36, 36]) for (const dy of [-40, -30, -20, -10, 0, 5, 15, 25, 35, 45, 55, 65]) grid.push([dx, dy]);
      for (let attempt = 0; attempt < 8 && !ok; attempt++) {
        const pos = labelPositions.get(name);
        if (pos) for (const [dx, dy] of grid) {
          secret = null;
          canvas.listeners.pointerdown({ clientX: pos[0] + dx, clientY: pos[1] + dy });
          if (secret === expect) { ok = true; break; }
        }
        if (!ok) { labels.length = 0; labelPositions.clear(); nextFrame(200000 + attempt); }
      }
      assert.ok(ok, name + ' mở tương tác cơ duyên');
      if (scene === 'library') assert.ok(images.includes('/img/obito-sprite.png'), 'sprite Obito được vẽ lên NPC');
    }
    // khách vãng lai thường cũng bấm được: mở bảng tương tác với đúng NPC đó
    // (NPC ma có quỷ nổi phía trên đẩy nhãn tên lên cao, nên thử cả dải lệch lớn; không được thì bốc lại bố cục)
    let ambientOk = false;
    const ambientGrid = [];
    for (const dx of [0, -18, 18, -36, 36]) for (const dy of [-40, -30, -20, -10, 0, 5, 15, 25, 35, 45, 55, 65]) ambientGrid.push([dx, dy]);
    for (let attempt = 0; attempt < 8 && !ambientOk; attempt++) {
      const ambient = [...labelPositions.entries()].filter(([t]) => t.endsWith(' · NPC') && t !== name);
      for (const [t, [ax, ay]] of ambient) {
        for (const [dx, dy] of ambientGrid) {
          secret = null;
          canvas.listeners.pointerdown({ clientX: ax + dx, clientY: ay + dy });
          if (secret) { ambientOk = true; break; }
        }
        if (ambientOk) break;
      }
      if (!ambientOk) { labels.length = 0; labelPositions.clear(); nextFrame(200000 + attempt); }
    }
    assert.ok(ambientOk, scene + ': bấm được khách vãng lai mở tương tác');
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
