(function (root) {
  'use strict';
  // Toán hành vi quỷ hộ thân (T-143): thuần, không DOM, dùng chung Node và trình duyệt.
  // Toạ độ địa phương của chủ (mét): gốc giữa hai bàn chân, chủ nhìn về +Z, bên trái của chủ là +X.
  // ANCHOR[n]: chỗ đặt thắt lưng quỷ cấp n và chiều cao cả con (kể cả đuôi khói).
  const ANCHOR = Object.freeze([
    null,
    Object.freeze({ x: 0.20, y: 1.12, z: -0.05, h: 0.45 }),
    Object.freeze({ x: 0.42, y: 1.00, z: -0.35, h: 1.30 }),
    Object.freeze({ x: 0.00, y: 1.15, z: -0.45, h: 1.90 }),
    Object.freeze({ x: 0.00, y: 1.20, z: -0.55, h: 2.80 })
  ]);
  const DURATION = Object.freeze({ emerge: 0.9, vanish: 0.6, taunt: 2.0, window: 10 });
  const LIMITS = Object.freeze({
    demon: Object.freeze({ low: 2, medium: 6, high: 12 }),
    aura: Object.freeze({ low: 2, medium: 8, high: Infinity })
  });
  const AURA_HIGH_RANGE = 25;

  function isSitting(sit) {
    return sit === true || sit === 'cushion' || sit === 'bench' || (Number.isInteger(sit) && sit >= 0);
  }
  function spring(pos, vel, target, dt, k = 18, c = 7) {
    if (!Number.isFinite(dt) || dt <= 0) return { pos, vel };
    pos = Number.isFinite(pos) ? pos : 0;
    vel = Number.isFinite(vel) ? vel : 0;
    target = Number.isFinite(target) ? target : pos;
    dt = Math.min(dt, 0.5);
    const steps = Math.ceil(dt * 120);
    const step = dt / steps;
    for (let index = 0; index < steps; index++) {
      const acceleration = -k * (pos - target) - c * vel;
      vel += acceleration * step;
      pos += vel * step;
    }
    return { pos, vel };
  }
  function springVec(pos, vel, target, dt, k = 18, c = 7) {
    const nextPos = [];
    const nextVel = [];
    for (let index = 0; index < 3; index++) {
      const next = spring(pos[index], vel[index], target[index], dt, k, c);
      nextPos.push(next.pos);
      nextVel.push(next.vel);
    }
    return { pos: nextPos, vel: nextVel };
  }
  function turn(cur, goal, dt, lag = 0.25) {
    cur = Number.isFinite(cur) ? cur : 0;
    goal = Number.isFinite(goal) ? goal : cur;
    let delta = (goal - cur) % (Math.PI * 2);
    if (delta > Math.PI) delta -= Math.PI * 2;
    if (delta < -Math.PI) delta += Math.PI * 2;
    if (lag <= 0) return cur + delta;
    const factor = 1 - Math.exp(-Math.max(0, dt) / lag);
    return cur + delta * (factor >= 0.999 ? 1 : factor);
  }
  function poseOf(state) {
    const current = state || {};
    if (isSitting(current.sit)) return 'sit';
    if (Number(current.bow) > 0) return 'scoff';
    const bubble = current.bubble;
    const text = typeof bubble === 'string' ? bubble.trim() :
      bubble && typeof bubble.text === 'string' ? bubble.text.trim() : '';
    if (current.talk || text) return 'peek';
    if (current.walking) return 'drift';
    return 'idle';
  }
  function phaseOf(prevN, n, t, reduced = false) {
    const level = value => Number.isFinite(value) ? Math.max(0, Math.min(4, Math.trunc(value))) : 0;
    prevN = level(prevN);
    n = level(n);
    t = Number.isFinite(t) ? t : Infinity;
    if (reduced) return 'steady';
    if (n > 0 && prevN !== n && t < DURATION.emerge) return 'emerge';
    if (n === 0 && prevN > 0 && t < DURATION.vanish) return 'vanish';
    return 'steady';
  }
  function hash(text) {
    let value = 0x811c9dc5;
    for (let index = 0; index < text.length; index++) {
      value ^= text.charCodeAt(index);
      value = Math.imul(value, 0x01000193) >>> 0;
    }
    return value;
  }
  function mulberry32(seed) {
    return () => {
      seed |= 0;
      seed = seed + 0x6D2B79F5 | 0;
      let value = Math.imul(seed ^ seed >>> 15, 1 | seed);
      value = value + Math.imul(value ^ value >>> 7, 61 | value) ^ value;
      return ((value ^ value >>> 14) >>> 0) / 4294967296;
    };
  }
  function tauntOf(id, now) {
    if (!Number.isFinite(now)) return null;
    const window = Math.floor(now / 10000);
    const random = mulberry32(hash(String(id) + ':' + window));
    const first = random();
    const second = random();
    if (first < 0.2) return null;
    const start = 2 + first * 6;
    const at = (now - window * 10000) / 1000;
    if (at < start || at >= start + DURATION.taunt) return null;
    return second < 0.5 ? 'taunt1' : 'taunt2';
  }
  function slots(list, self, quality, kind = 'demon') {
    if (quality !== 'low' && quality !== 'medium' && quality !== 'high') quality = 'medium';
    if (kind !== 'demon' && kind !== 'aura') kind = 'demon';
    const result = new Set();
    if (self != null) result.add(self);
    const candidates = (Array.isArray(list) ? list : []).filter(item => item && item.id != null && item.id !== self &&
      Number.isFinite(item.distance) && !(kind === 'aura' && quality === 'high' && item.distance > AURA_HIGH_RANGE));
    candidates.sort((first, second) => {
      const distance = first.distance - second.distance;
      if (distance) return distance;
      const firstId = String(first.id);
      const secondId = String(second.id);
      return firstId < secondId ? -1 : firstId > secondId ? 1 : 0;
    });
    for (const item of candidates.slice(0, LIMITS[kind][quality])) result.add(item.id);
    return result;
  }
  const api = { ANCHOR, DURATION, LIMITS, isSitting, spring, springVec, turn, poseOf, phaseOf, tauntOf, slots };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.StandMath = api;
})(this);
