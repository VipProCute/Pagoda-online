'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../public/js/stand-math.js');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('ANCHOR đủ 4 cấp, chiều cao đúng bảng', () => {
  assert.equal(S.ANCHOR[0], null);
  assert.deepEqual(S.ANCHOR.slice(1).map(anchor => anchor.h), [0.45, 1.3, 1.9, 2.8]);
  assert.ok(S.ANCHOR[1].x > 0 && S.ANCHOR[2].x > 0);
  assert.ok(S.ANCHOR.slice(1).every(anchor => anchor.z <= 0 && Object.isFrozen(anchor)));
  assert.ok(Object.isFrozen(S.ANCHOR));
});

test('lò xo hội tụ dưới 1 cm sau 1,5 giây và không vọt quá 15%', () => {
  let state = { pos: 0, vel: 0 };
  let maximum = 0;
  for (let index = 0; index < 90; index++) {
    state = S.spring(state.pos, state.vel, 1, 1 / 60);
    maximum = Math.max(maximum, state.pos);
  }
  assert.ok(Math.abs(state.pos - 1) < 0.01);
  assert.ok(maximum <= 1.15);
});

test('lò xo không phát nổ khi dt lớn', () => {
  let state = { pos: 0, vel: 0 };
  for (let index = 0; index < 20; index++) {
    state = S.spring(state.pos, state.vel, 1, 0.5);
    assert.ok(Number.isFinite(state.pos) && Math.abs(state.pos) < 2);
  }
  assert.ok(Math.abs(state.pos - 1) < 0.01);
  for (const dt of [0, NaN, -1]) assert.deepEqual(S.spring(2, 3, 1, dt), { pos: 2, vel: 3 });
  assert.deepEqual(S.spring(NaN, Infinity, NaN, 0.1), { pos: 0, vel: 0 });
});

test('springVec chạy từng trục và không sửa đầu vào', () => {
  const pos = [0, 0, 0];
  const vel = [0, 0, 0];
  const target = [1, -2, 0.5];
  let state = { pos, vel };
  for (let index = 0; index < 120; index++) state = S.springVec(state.pos, state.vel, target, 1 / 60);
  assert.ok(state.pos.every((value, index) => Math.abs(value - target[index]) < 0.01));
  assert.deepEqual(pos, [0, 0, 0]);
  assert.deepEqual(vel, [0, 0, 0]);
  assert.deepEqual(target, [1, -2, 0.5]);
});

test('turn đi đường ngắn qua ±π', () => {
  assert.ok(Math.abs(S.turn(3, -3, 10) - (3 + 2 * Math.PI - 6)) < 1e-6);
  assert.equal(S.turn(0, 1, 0), 0);
  assert.ok(S.turn(0, 1, 0.25) > 0.6 && S.turn(0, 1, 0.25) < 0.7);
  assert.equal(S.turn(0, 1, 0, 0), 1);
  assert.equal(S.turn(NaN, NaN, 1), 0);
});

test('poseOf theo thứ tự ngồi > vái > nói > đi > đứng', () => {
  assert.equal(S.poseOf({ sit: 'bench', bow: 1, talk: true, walking: true }), 'sit');
  assert.equal(S.poseOf({ sit: -1, bow: 0.5, talk: true, walking: true }), 'scoff');
  assert.equal(S.poseOf({ bubble: { text: ' chào ' }, walking: true }), 'peek');
  assert.equal(S.poseOf({ bubble: '   ', walking: true }), 'drift');
  assert.equal(S.poseOf({}), 'idle');
  assert.equal(S.poseOf(), 'idle');
  assert.equal(S.poseOf({ sit: 0 }), 'sit');
  assert.equal(S.poseOf({ sit: false }), 'idle');
  for (const sit of [true, 'cushion', 'bench', 0, 2]) assert.equal(S.isSitting(sit), true);
  for (const sit of [false, -1, undefined, 0.5, '0']) assert.equal(S.isSitting(sit), false);
});

test('phaseOf trồi lên, đứng yên, tan đi', () => {
  for (const [previous, current, time, reduced, expected] of [
    [0, 4, 0.3, false, 'emerge'], [0, 4, 0.95, false, 'steady'],
    [2, 4, 0.1, false, 'emerge'], [4, 0, 0.2, false, 'vanish'],
    [4, 0, 0.7, false, 'steady'], [4, 4, 0.1, false, 'steady'],
    [0, 4, 0.1, true, 'steady'], [NaN, 'x', NaN, false, 'steady']
  ]) assert.equal(S.phaseOf(previous, current, time, reduced), expected);
});

test('tauntOf ổn định theo hạt giống và giới hạn thời gian', () => {
  const seen = new Set();
  const counts = new Map();
  for (let now = 0; now <= 600000; now += 250) {
    const result = S.tauntOf('npc-hac-phong', now);
    assert.equal(result, S.tauntOf('npc-hac-phong', now));
    assert.ok([null, 'taunt1', 'taunt2'].includes(result));
    seen.add(result);
    const window = Math.floor(now / 10000);
    if (result !== null) counts.set(window, (counts.get(window) || 0) + 1);
  }
  assert.ok(seen.has('taunt1') && seen.has('taunt2'));
  assert.ok([...counts.values()].every(count => count <= 8));
  assert.equal(S.tauntOf('x', NaN), null);
});

test('slots luôn có mình và đúng số lượng ở ba mức', () => {
  const list = Array.from({ length: 30 }, (_, index) => ({ id: 'p' + index, distance: index + 1 }));
  list.push({ id: 'invalid', distance: NaN });
  const low = S.slots(list, 'p29', 'low');
  assert.equal(low.size, 3);
  for (const id of ['p29', 'p0', 'p1']) assert.ok(low.has(id));
  assert.equal(S.slots(list, 'p29', 'medium').size, 7);
  assert.equal(S.slots(list, 'p29', 'high').size, 13);
  assert.equal(S.slots(list, 'p29', 'low', 'aura').size, 3);
  assert.equal(S.slots(list, 'p29', 'medium', 'aura').size, 9);
  const high = S.slots(list, 'p29', 'high', 'aura');
  assert.equal(high.size, 26);
  for (let index = 0; index < 25; index++) assert.ok(high.has('p' + index));
  assert.ok(!high.has('invalid'));
  assert.ok(!S.slots(list, null, 'low').has(null));
  assert.deepEqual(S.slots(list, 'p29', 'xyz'), S.slots(list, 'p29', 'medium'));
  assert.deepEqual([...S.slots([{ id: 'b', distance: 1 }, { id: 'a', distance: 1 }], null, 'low')], ['a', 'b']);
});

test('chạy được trong trình duyệt không cần module', () => {
  const source = fs.readFileSync(path.join(__dirname, '../public/js/stand-math.js'), 'utf8');
  const context = {};
  vm.runInNewContext(source, context);
  assert.equal(context.StandMath.poseOf({ walking: true }), 'drift');
});
