'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const merit = require('../public/js/merit');

test('vẽ NPC ở từng khu và chạm Tảo Địa Tăng trong thư viện', () => {
  let nextFrame, tapped = null, picked = null;
  const labels = [];
  const gradient = { addColorStop() {} };
  const ctx = new Proxy({}, { get(target, key) {
    if (key in target) return target[key];
    if (key === 'measureText') return text => ({ width: String(text).length * 6 });
    if (key === 'fillText') return text => labels.push(text);
    if (key === 'createLinearGradient' || key === 'createRadialGradient') return () => gradient;
    return () => {};
  }, set(target, key, value) { target[key] = value; return true; } });
  const canvas = { width: 960, height: 600, style: {}, listeners: {}, getContext: () => ctx,
    getBoundingClientRect: () => ({ width: 960, height: 600, left: 0, top: 0 }),
    addEventListener(type, fn) { this.listeners[type] = fn; } };
  class FakeImage { constructor() { this.complete = false; this.naturalWidth = 0; } }
  const sandbox = { Math, Date, Image: FakeImage, MERIT: merit, devicePixelRatio: 1,
    matchMedia: () => ({ matches: false }), addEventListener() {}, performance: { now: () => 1000 },
    document: { hidden: false, createElement: () => ({ width: 0, height: 0, getContext: () => ctx }) },
    requestAnimationFrame: fn => { nextFrame = fn; } };
  vm.runInNewContext(fs.readFileSync(require.resolve('../public/js/hall.js'), 'utf8'), sandbox);
  sandbox.Hall.init(canvas, { sweeper: id => { tapped = id; }, person: id => { picked = id; } });
  for (const scene of ['hall', 'yard', 'library', 'arena']) {
    labels.length = 0; sandbox.Hall.setScene(scene); nextFrame(1000);
    assert.equal(labels.filter(s => s.endsWith(' · NPC')).length, 2, scene);
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
