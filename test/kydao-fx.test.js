'use strict';
// Kỳ Đài · toán thuần của KydaoFx (không cần DOM)
const test = require('node:test');
const assert = require('node:assert/strict');
const Fx = require('../public/js/kydao-fx.js');
const Skins = require('../public/js/kydao-skins.js');

const seeded = (s = 7) => () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };

test('joltAt: chưa tới lượt và đã xong thì bằng 0, quân về đúng chỗ', () => {
  assert.deepEqual(Fx.joltAt(0, -5), { dx: 0, dy: 0 });
  assert.equal(Fx.joltAt(0, Fx.JOLT_DUR).dy, 0);
  assert.equal(Fx.joltAt(0, Fx.JOLT_DUR + 500).dy, 0);
  const d = 200, delay = d / Fx.WAVE_SPEED;
  assert.equal(Fx.joltAt(d, delay - 10).dy, 0);
  assert.equal(Fx.joltAt(d, delay + Fx.JOLT_DUR + 1).dy, 0);
});

test('joltAt: quân nảy LÊN (dy <= 0) và có lúc nảy thật', () => {
  let min = 0;
  for (let t = 0; t <= Fx.JOLT_DUR; t += 5) {
    const j = Fx.joltAt(0, t);
    assert.ok(j.dy <= 0 && Number.isFinite(j.dx));
    min = Math.min(min, j.dy);
  }
  assert.ok(min < -5);
});

test('joltAt: gần nảy mạnh và sớm hơn, xa yếu và trễ hơn (sóng lan)', () => {
  const peak = d => {
    let best = 0, at = -1;
    for (let t = 0; t <= Fx.PROMOTE_MS; t += 4) { const v = -Fx.joltAt(d, t).dy; if (v > best) { best = v; at = t; } }
    return { best, at };
  };
  const near = peak(48), mid = peak(150), far = peak(300);
  assert.ok(near.best > mid.best && mid.best > far.best, 'biên độ giảm dần theo khoảng cách');
  assert.ok(near.at < mid.at && mid.at < far.at, 'đỉnh nảy đến trễ dần');
  assert.ok(far.best > 0, 'quân ở xa vẫn nhúc nhích');
});

test('joltAt: tôn trọng cỡ ô, dữ liệu rác không ra NaN', () => {
  const a = -Fx.joltAt(0, 150, { cell: 40 }).dy, b = -Fx.joltAt(0, 150, { cell: 80 }).dy;
  assert.ok(b > a);
  for (const bad of [NaN, undefined, null, 'x', Infinity]) {
    const j = Fx.joltAt(bad, bad, { cell: bad });
    assert.ok(Number.isFinite(j.dx) && Number.isFinite(j.dy));
  }
  assert.ok(Fx.joltAt(10, 100, { dirX: 1 }).dx > 0, 'lệch ngang theo hướng ra xa tâm');
});

test('joltReach: sóng phải tới được các ô trong thời lượng 1,2 giây', () => {
  assert.ok(Fx.joltReach() > 300);
  assert.ok(Fx.PROMOTE_MS <= 1200);
  const j = Fx.joltAt(Fx.joltReach() * 0.95, Fx.PROMOTE_MS - 5);
  assert.ok(Number.isFinite(j.dy));
});

test('shakeAt: rung rồi tắt hẳn', () => {
  assert.deepEqual(Fx.shakeAt(-1), { dx: 0, dy: 0 });
  assert.deepEqual(Fx.shakeAt(10000), { dx: 0, dy: 0 });
  let max = 0;
  for (let t = 0; t < 420; t += 3) { const s = Fx.shakeAt(t, 5); max = Math.max(max, Math.abs(s.dx), Math.abs(s.dy)); assert.ok(max <= 5.01); }
  assert.ok(max > 1);
});

test('domainSweep: quét từ mép người chơi ra giữa trong tối đa 1,8 giây', () => {
  assert.ok(Fx.DOMAIN_MS <= 1800);
  assert.deepEqual(Fx.domainSweep(0), { front: 0, alpha: 0 });
  assert.equal(Fx.domainSweep(Fx.DOMAIN_MS).alpha, 0);
  let prev = -1;
  for (let t = 0; t <= Fx.DOMAIN_MS; t += 20) {
    const s = Fx.domainSweep(t);
    assert.ok(s.front >= prev && s.front >= 0 && s.front <= 1 && s.alpha >= 0 && s.alpha <= 1);
    prev = s.front;
  }
  assert.ok(Fx.domainSweep(800).front > 0.99, 'quét xong nửa sân');
  assert.ok(Fx.domainSweep(300).alpha > 0.9);
});

test('winPlan: khác nhau theo lý do và theo góc nhìn', () => {
  const m = Fx.winPlan({ game: 'chess', reason: 'checkmate', result: 'a', mine: true });
  assert.equal(m.kind, 'mate'); assert.equal(m.tone, 'win'); assert.equal(m.title, 'Chiếu hết!');
  assert.equal(Fx.winPlan({ game: 'xiangqi', reason: 'checkmate', result: 'a', mine: true }).title, 'Bắt Tướng!');
  assert.equal(Fx.winPlan({ game: 'jieqi', reason: 'capture', result: 'b', mine: false }).tone, 'lose');
  assert.equal(Fx.winPlan({ game: 'gomoku', reason: 'five', result: 'a', mine: true }).kind, 'five');
  assert.equal(Fx.winPlan({ game: 'go', reason: 'score', result: 'a', mine: true }).kind, 'score');
  assert.equal(Fx.winPlan({ game: 'chess', reason: 'timeout', result: 'a', mine: true }).kind, 'timeout');
  assert.equal(Fx.winPlan({ game: 'chess', reason: 'resign', result: 'a', mine: false }).kind, 'resign');
  const d = Fx.winPlan({ game: 'chess', reason: 'agreed', result: 'draw', mine: true });
  assert.equal(d.kind, 'draw'); assert.equal(d.tone, 'soft');
  assert.equal(Fx.winPlan({ game: 'chess', reason: 'stalemate', result: 'draw', mine: false }).tone, 'soft');
  assert.equal(Fx.winPlan({ game: 'chess', reason: 'timeout-insufficient', result: 'draw' }).kind, 'draw');
  assert.equal(Fx.winPlan({ game: 'chess', reason: 'checkmate', result: 'a', mine: null }).tone, 'soft', 'người xem');
  assert.ok(Fx.winPlan({ game: 'chess', reason: 'timeout', mine: false }).sub.length > 0);
});

test('winPlan: không bao giờ ném lỗi với dữ liệu lạ và luôn có tiêu đề', () => {
  for (const x of [undefined, null, {}, { reason: 5 }, { game: 'x', reason: 'lạ', result: 'a', mine: true }]) {
    const p = Fx.winPlan(x);
    assert.ok(p.title && ['win', 'lose', 'soft'].includes(p.tone));
  }
});

test('spawnParticle: đủ 8 kiểu hạt, nằm trong nửa sân, số hữu hạn', () => {
  const rect = { x: 10, y: 200, w: 300, h: 150 };
  assert.deepEqual(Fx.FX_KINDS.slice().sort(), Object.values(Skins.FIELDS).map(f => f.fx).sort());
  const rng = seeded();
  for (const k of Fx.FX_KINDS) {
    for (let i = 0; i < 30; i++) {
      const p = Fx.spawnParticle(k, rect, rng, '#ff8800');
      for (const key of ['x', 'y', 'vx', 'vy', 'size', 'life']) assert.ok(Number.isFinite(p[key]), k + '.' + key);
      assert.ok(p.x >= rect.x - 1 && p.x <= rect.x + rect.w + 1, k + ' x trong sân');
      assert.ok(p.y >= rect.y - 1 && p.y <= rect.y + rect.h + 1, k + ' y trong sân');
      assert.ok(p.life > 0 && p.life <= 1800);
    }
  }
});

test('stepParticle / particleAlpha: hạt chết đúng hạn, độ đậm trong [0,1]', () => {
  const p = Fx.spawnParticle('ember', { x: 0, y: 0, w: 100, h: 100 }, seeded(3), '#f00');
  let alive = true, n = 0;
  while (alive && n < 1000) { alive = Fx.stepParticle(p, 16); const a = Fx.particleAlpha(p); assert.ok(a >= 0 && a <= 1); n++; }
  assert.ok(!alive && n < 200);
  const b = Fx.burstParticle(5, 5, seeded(9));
  Fx.stepParticle(b, 100);
  assert.ok(b.vy > 0 || Math.abs(b.vy) < 0.3);
});

test('giới hạn hạt ≤ 160, hexA ra màu hợp lệ', () => {
  assert.ok(Fx.PARTICLE_MAX <= 160);
  assert.equal(Fx.hexA('#ff8000', 0.5), 'rgba(255,128,0,0.500)');
  assert.equal(Fx.hexA('#fff', 2), 'rgba(255,255,255,1.000)');
  assert.match(Fx.hexA('rác', 0.3), /^rgba\(255,255,255,/);
});

test('API: có đủ mount/play/stop, chưa mount thì play/stop không ném lỗi', () => {
  for (const k of ['mount', 'unmount', 'play', 'stop']) assert.equal(typeof Fx[k], 'function');
  assert.equal(Fx.play('domain', {}), false);
  assert.doesNotThrow(() => Fx.stop());
  assert.doesNotThrow(() => Fx.mount(null, {}));
});

test('mọi sân có khẩu hiệu và dòng phụ để banner hiện', () => {
  for (const [id, f] of Object.entries(Skins.FIELDS)) assert.ok(f.cry && f.sub && f.palette.glow, id);
});
