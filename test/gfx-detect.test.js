'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const GfxDetect = require('../public/js/gfx-detect.js');

test('tự chọn thấp khi thiếu WebGL2 hoặc máy yếu', () => {
  assert.equal(GfxDetect.pickQuality({ webgl2: false }), 'low');
  assert.equal(GfxDetect.pickQuality({ webgl2: true, cores: 4 }), 'low');
  assert.equal(GfxDetect.pickQuality({ webgl2: true, memory: 4 }), 'low');
  assert.equal(GfxDetect.pickQuality({ webgl2: true, mobile: true }), 'low');
  assert.equal(GfxDetect.pickQuality({ webgl2: true, reduceMotion: true }), 'low');
});

test('chọn cao cho máy mạnh, còn thiếu dữ liệu thì chọn vừa', () => {
  assert.equal(GfxDetect.pickQuality({ webgl2: true, cores: 8, memory: 8, dpr: 1 }), 'high');
  assert.equal(GfxDetect.pickQuality({ webgl2: true }), 'medium');
});

test('bộ điều tốc hạ từng bậc sau cửa sổ FPS thấp', () => {
  let time = 0;
  const governor = GfxDetect.createFpsGovernor({ low: 30, windowMs: 3000, initial: 'high', now: () => time });
  for (let i = 1; i < 60; i++) assert.equal(governor.frame(i * 50), null);
  assert.equal(governor.frame(3000), 'medium');
  for (let i = 1; i < 60; i++) governor.frame(3000 + i * 50);
  assert.equal(governor.frame(6000), 'low');
  assert.equal(governor.quality, 'low');
});

test('mức thấp giữ nguyên khi khung hình vẫn chậm', () => {
  const governor = GfxDetect.createFpsGovernor({ low: 30, windowMs: 1000, initial: 'low', now: () => 0 });
  assert.equal(governor.frame(1000), null);
  assert.equal(governor.quality, 'low');
});

test('áp cấu hình đồ họa và chuyển tiếp mức cho World3D', async () => {
  const { applyQuality } = await import('../public/js/world3d/quality.mjs');
  let selected;
  const result = applyQuality({ setQuality(value) { selected = value; return { ok: true }; } }, 'high');
  assert.equal(selected, 'high');
  assert.deepEqual(result.settings, { pixelRatio: 2, shadows: true, particles: true, viewDistance: 100 });
});
