'use strict';
// Nội suy bước đi của người khác (đệm gói vị trí, vẽ chậm ~120 ms): đều, không nhảy, không chạy quá đích.
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const merit = require('../public/js/merit');
const Actors = require('../public/js/actors');

function makeHall() {
  let nextFrame, clock = 1000;
  const ctx = new Proxy({}, { get(target, key) {
    if (key in target) return target[key];
    if (key === 'measureText') return text => ({ width: String(text).length * 6 });
    if (key === 'createLinearGradient' || key === 'createRadialGradient') return () => ({ addColorStop() {} });
    return () => {};
  }, set(target, key, value) { target[key] = value; return true; } });
  const canvas = { width: 960, height: 600, style: {}, getContext: () => ctx,
    getBoundingClientRect: () => ({ width: 960, height: 600, left: 0, top: 0 }), addEventListener() {} };
  const sandbox = { Math, Date, Actors, Image: class { }, MERIT: merit, devicePixelRatio: 1,
    matchMedia: () => ({ matches: false }), addEventListener() {}, performance: { now: () => clock },
    document: { hidden: false, createElement: () => ({ width: 0, height: 0, getContext: () => ctx }) },
    requestAnimationFrame: fn => { nextFrame = fn; } };
  vm.runInNewContext(fs.readFileSync(require.resolve('../public/js/hall.js'), 'utf8'), sandbox);
  sandbox.Hall.init(canvas, {});
  sandbox.Hall.setMe(1);
  sandbox.Hall.setPlayers([{ id: 1, name: 'Tôi', look: { g: 'nam', c: 1, h: 0 }, x: 0.5, z: 0.5 }, { id: 2, name: 'Khách', look: { g: 'nu', c: 2, h: 0 }, x: 0.2, z: 0.5 }]);
  // chạy từng khung 16 ms; gói vị trí đến theo lịch (giờ nhận → [id, x, z] nghìn phần)
  return {
    Hall: sandbox.Hall,
    run(packets, until, onFrame) {
      let ts = clock;
      for (; ts <= until; ts += 16) {
        clock = ts;
        for (const p of packets.filter(q => q.at <= ts && !q.done)) { p.done = true; sandbox.Hall.positions([[2, p.x, p.z]]); }
        nextFrame(ts);
        if (onFrame) onFrame(sandbox.Hall.player(2), ts);
      }
    }
  };
}

test('đi thẳng với gói đến đều ~100 ms: vị trí vẽ mượt (vận tốc gần không đổi)', () => {
  const h = makeHall(), packets = [];
  for (let i = 0; i < 20; i++) packets.push({ at: 1100 + i * 100, x: 200 + i * 15, z: 500 });
  const steps = []; let prev = null;
  h.run(packets, 3200, (p, ts) => { if (prev !== null && ts > 1700 && ts < 2900) steps.push(p.dx - prev); prev = p.dx; });
  const m = steps.reduce((a, b) => a + b, 0) / steps.length, sd = Math.sqrt(steps.reduce((a, b) => a + (b - m) * (b - m), 0) / steps.length);
  assert.ok(m > 0, 'đang đi tới');
  assert.ok(sd / m < 0.12, `độ giật (sd/mean) ${(sd / m).toFixed(3)} phải nhỏ`);
});

test('gói đến trễ: ngoại suy ngắn rồi đứng yên, không trôi mãi', () => {
  const h = makeHall(), packets = [];
  for (let i = 0; i < 6; i++) packets.push({ at: 1100 + i * 100, x: 200 + i * 15, z: 500 });   // gói cuối ở t=1600 rồi mất mạng
  h.run(packets, 3000);
  const p = h.Hall.player(2);
  assert.ok(p.dx >= 0.275 - 1e-6, 'không lùi lại');
  assert.ok(p.dx <= 0.275 + 0.036 + 1e-6, `ngoại suy tối đa ~150 ms (dx=${p.dx})`);
});

test('bước dừng (gói cuối ngắn): không chạy quá đích', () => {
  const h = makeHall(), packets = [];
  for (let i = 0; i < 5; i++) packets.push({ at: 1100 + i * 100, x: 200 + i * 15, z: 500 });
  packets.push({ at: 1600, x: 270, z: 500 });   // bước cuối 0,01 < 0,8 bước đầy
  h.run(packets, 3000);
  assert.ok(Math.abs(h.Hall.player(2).dx - 0.27) < 1e-3, `dừng đúng đích (dx=${h.Hall.player(2).dx})`);
});

test('dịch chuyển xa: không bị nội suy, người chơi lướt tới bằng cách làm mượt cũ', () => {
  const h = makeHall();
  h.run([{ at: 1100, x: 210, z: 500 }, { at: 1200, x: 900, z: 500 }], 3000);
  assert.ok(Math.abs(h.Hall.player(2).dx - 0.9) < 0.01, 'tới đích dịch chuyển');
});
