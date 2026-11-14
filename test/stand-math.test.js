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

test('quỷ của mình đứng bên kia chủ, lệch trái màn hình và ngoái đầu về máy quay', () => {
  const camera = { x: 0, z: -5 }, stand = S.selfStand(camera);
  assert.ok(Object.isFrozen(S.SELF_STAND));
  assert.ok(stand.z > 0 && stand.x > 0);
  assert.equal(stand.y, S.SELF_STAND.y);
  assert.ok(Math.abs(stand.yaw - (Math.PI + S.SELF_STAND.bodyTurn)) < 1e-9);
  const look = Math.atan2(camera.x - stand.x, camera.z - stand.z);
  const difference = Math.atan2(Math.sin(stand.yaw + stand.head - look), Math.cos(stand.yaw + stand.head - look));
  assert.ok(Math.abs(difference) < 1e-9);
});

test('xoay máy quay tám hướng vẫn giữ bán kính và quỷ ở nửa xa máy quay', () => {
  const radius = Math.hypot(S.SELF_STAND.back, S.SELF_STAND.side);
  for (let i = 0; i < 8; i++) {
    const angle = i * Math.PI / 4, camera = { x: Math.sin(angle) * 5, z: Math.cos(angle) * 5 };
    const stand = S.selfStand(camera);
    assert.ok(Math.abs(Math.hypot(stand.x, stand.z) - radius) < 1e-9);
    assert.ok(stand.x * camera.x + stand.z * camera.z < 0);
    const look = Math.atan2(camera.x - stand.x, camera.z - stand.z);
    assert.ok(Math.abs(Math.atan2(Math.sin(stand.yaw + stand.head - look), Math.cos(stand.yaw + stand.head - look))) < 1e-9);
  }
});

test('máy quay thiếu, không hữu hạn hoặc trùng chủ không có chỗ đứng', () => {
  for (const camera of [undefined, null, {}, { x: NaN, z: 5 }, { x: 0, z: Infinity },
    { x: Infinity, z: 0 }, { x: 0, z: 0 }, { x: 0, z: 0.0000005 }]) assert.equal(S.selfStand(camera), null);
  assert.equal(S.selfStand({ x: 0, z: 1e-6 }).close, true);
  assert.ok(S.selfStand({ x: 0, z: 0.6 }));
  const stand = S.selfStand({ x: 0, z: 5 }, { ...S.SELF_STAND, bodyTurn: 2, headMax: 0.25 });
  assert.equal(stand.head, -0.25);
});

test('máy quay sát chủ vẫn có chỗ đứng nhỏ và mờ dần theo khoảng cách', () => {
  const O = S.SELF_STAND;
  const close = S.selfStand({ x: 0, z: -0.3 });
  assert.equal(close.scale, O.scaleNear);
  assert.equal(close.close, true);
  assert.equal(close.fade, O.fadeMin);
  assert.equal(close.y, O.y + (O.scale - O.scaleNear) * O.lift - O.sink);
  const half = S.selfStand({ x: 0, z: -0.5 }), farther = S.selfStand({ x: 0, z: -0.8 });
  assert.ok(half.fade > O.fadeMin && half.fade < 1);
  assert.ok(farther.fade > half.fade);
  // 0,5 m: k = 3/13, smooth = 297/2197; 0,8 m: k = 9/13, smooth = 1701/2197.
  assert.ok(Math.abs(half.fade - 772 / 2197) < 1e-12);
  assert.ok(Math.abs(farther.fade - 1825 / 2197) < 1e-12);
  for (const distance of [O.minCamera, 0.8, O.fadeFar, 5]) {
    const stand = S.selfStand({ x: distance, z: 0 });
    assert.ok(!stand.close);
    if (distance >= O.fadeFar) assert.equal(stand.fade, 1);
  }
  const { fadeNear, fadeFar, fadeMin, ...legacy } = O;
  assert.equal(S.selfStand({ x: 0.3, z: 0 }, legacy).fade, 1);
});

test('máy quay bị ép lại gần thì quỷ thu nhỏ và nâng lên, xa thì giữ cỡ đầy đủ', () => {
  const O = S.SELF_STAND;
  const far = S.selfStand({ x: 0, z: -5 }), wall = S.selfStand({ x: 0, z: -O.fitNear }), mid = S.selfStand({ x: 0, z: -(O.fitNear + O.fitFar) / 2 });
  assert.equal(far.scale, O.scale);
  assert.equal(far.y, O.y);
  assert.ok(Math.abs(wall.scale - O.scaleNear) < 1e-12);
  assert.ok(mid.scale > wall.scale && mid.scale < far.scale);
  // Mặt quỷ (khoảng 1,3 m trên thắt lưng theo cỡ quỷ) không tụt xuống dưới cổ chủ khi thu nhỏ.
  // T-204 hạ lift 0,5, scaleNear 0,45: máy quay ở trên cao nhìn xuống nên mặt quỷ (đứng sau chủ 1,2 m) vẫn hiện trên đầu chủ,
  // còn ở Sân đấu không lọt vào dưới bảng giao diện phía trên.
  for (const stand of [far, mid, wall]) assert.ok(stand.y + 1.3 * stand.scale > 1.4, `mặt quỷ ở ${stand.y + 1.3 * stand.scale}`);
  assert.ok(wall.y + 1.3 * wall.scale < 1.9, 'máy quay sát tường thì mặt quỷ hạ thấp hơn T-203');
  // Máy quay sát thì quỷ lệch ngang sideNear (sang trái màn hình), xa thì về side.
  assert.ok(Math.abs(Math.hypot(wall.x, wall.z) - Math.hypot(O.back, O.sideNear)) < 1e-12);
  assert.ok(Math.abs(Math.hypot(far.x, far.z) - Math.hypot(O.back, O.side)) < 1e-12);
  assert.ok(wall.x > far.x, 'máy quay sau lưng (z âm): trái màn hình là +x');
  // Đỉnh sừng (khoảng 1,85 m theo cỡ quỷ) khi máy quay sát tường thấp hơn lúc máy quay xa.
  assert.ok(wall.y + 1.85 * wall.scale < far.y + 1.85 * far.scale);
});

test('suất từng phần giữ hào quang khi hết suất quỷ và luôn giữ quỷ của mình', () => {
  const list = [
    { id: 'near1', distance: 1, demon: true, aura: false },
    { id: 'near2', distance: 2, demon: true, aura: false },
    { id: 'both', distance: 3, demon: true, aura: true },
    { id: 'empty', distance: 4, demon: false, aura: false },
    { id: 'self', distance: Infinity, demon: true, aura: true }
  ];
  const result = S.fxSlots(list, 'self', 'low');
  assert.deepEqual(result.get('both'), { demon: false, aura: true, merit: false, slot: true });
  assert.deepEqual(result.get('empty'), { demon: false, aura: false, merit: false, slot: true });
  assert.deepEqual(result.get('self'), { demon: true, aura: true, merit: false, slot: true });
  assert.deepEqual(S.fxSlots([{ id: 'self' }], 'self', 'low').get('self'), { demon: false, aura: false, merit: false, slot: true });
});

test('suất công đức độc lập giữ mình và hai người gần nhất ở mức Thấp', () => {
  const list = Array.from({ length: 4 }, (_, i) => ({ id: 'p' + i, distance: i + 1, merit: true }));
  list.push({ id: 'self', distance: Infinity, merit: true }, { id: 'empty', distance: 0 });
  const result = S.fxSlots(list, 'self', 'low');
  for (const id of ['self', 'p0', 'p1']) {
    assert.deepEqual(result.get(id), { demon: false, aura: false, merit: true, slot: true });
  }
  for (const id of ['p2', 'p3']) {
    assert.deepEqual(result.get(id), { demon: false, aura: false, merit: false, slot: false });
  }
  assert.deepEqual(result.get('empty'), { demon: false, aura: false, merit: false, slot: true });
  assert.ok(Object.isFrozen(S.LIMITS.merit));
});

test('suất công đức mức Vừa có tám khách, mức Cao lọc ngoài 25 mét', () => {
  const list = Array.from({ length: 30 }, (_, i) => ({ id: 'p' + i, distance: i + 1, merit: true }));
  assert.equal(S.slots(list, 'self', 'medium', 'merit').size, 9);
  const high = S.fxSlots(list, 'self', 'high');
  for (let i = 0; i < list.length; i++) assert.equal(high.get('p' + i).merit, i < 25);
});
