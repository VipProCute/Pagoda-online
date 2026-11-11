'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createHallNpcs, SEED, BOUNDS } = require('../lib/hall-npcs');

// rng giả luân phiên 0.25 và 0.75: điểm hẹn luôn lệch về một phía, bảo kết quả test được
function fakeRng() {
  let i = 0;
  return () => (i++ % 2 === 0 ? 0.25 : 0.75);
}

test('NPC đi về phía điểm hẹn và luôn nằm trong biên cảnh', () => {
  const sim = createHallNpcs({ rng: fakeRng() });
  let moved = false;
  for (let i = 0; i < 600; i++) {
    const changed = sim.step(0.05);
    for (const [, x, z] of sim.all()) {
      assert.ok(x >= BOUNDS.xMin * 1000 - 1 && x <= BOUNDS.xMax * 1000 + 1, 'x trong biên');
      assert.ok(z >= BOUNDS.zMin * 1000 - 1 && z <= BOUNDS.zMax * 1000 + 1, 'z trong biên');
    }
    if (changed) moved = true;
  }
  assert.ok(moved, 'NPC phải thực sự đổi chỗ trong 30 giây mô phỏng');
});

test('NPC có lúc đứng nghỉ rồi mới đi tiếp', () => {
  const sim = createHallNpcs({ rng: fakeRng() });
  let sawRest = false;
  for (let i = 0; i < 400; i++) {
    const before = sim.all();
    sim.step(0.05);
    const after = sim.all();
    if (JSON.stringify(before) === JSON.stringify(after)) sawRest = true;   // vị trí không đổi: đang nghỉ hoặc đã tới nơi
  }
  assert.ok(sawRest, 'phải tồn tại khoảng NPC đứng yên');
});

test('positions chỉ báo NPC vừa đổi chỗ và tự xóa cờ sau lần gọi đầu', () => {
  const sim = createHallNpcs({ rng: fakeRng() });
  for (let i = 0; i < 300; i++) sim.step(0.05);           // 15 giây mô phỏng: đủ vượt qua 5,5 giây nghỉ đầu tiên
  const arr = sim.positions();
  assert.ok(Array.isArray(arr) && arr.length > 0, 'có NPC đã di chuyển');
  for (const row of arr) {
    assert.equal(row.length, 3);
    assert.ok(['beggar', 'wanderer', 'obito'].includes(row[0]), 'role hợp lệ');
    assert.ok(Number.isInteger(row[1]) && Number.isInteger(row[2]), 'toạ độ làm tròn phần nghìn');
  }
  assert.deepEqual(sim.positions(), [], 'gọi lần nữa phải rỗng vì cờ dirty đã xóa');
});

test('all() đủ 3 NPC đúng role, định dạng [role, x, z]', () => {
  const sim = createHallNpcs({ rng: fakeRng() });
  const all = sim.all();
  assert.deepEqual(all.map(r => r[0]), ['beggar', 'wanderer', 'obito']);
  for (const [, x, z] of all) {
    assert.ok(Number.isInteger(x) && Number.isInteger(z), 'toạ độ là số nguyên phần nghìn');
    assert.ok(x >= 0 && x <= 1000 && z >= 0 && z <= 1000, 'toạ độ trong [0, 1000]');
  }
});

test('locate trả đúng scene với role biết và null với role lạ', () => {
  const sim = createHallNpcs({ rng: fakeRng() });
  assert.equal(sim.locate('beggar').scene, 'hall');
  assert.equal(sim.locate('wanderer').scene, 'yard');
  assert.equal(sim.locate('obito').scene, 'library');
  assert.equal(sim.locate('lady'), null);
  assert.equal(sim.locate('constructor'), null);
  assert.equal(sim.locate(undefined), null);
});

test('rng tiêm vào được dùng thay cho Math.random', () => {
  let calls = 0;
  const sim = createHallNpcs({ rng: () => { calls++; return 0.5; } });
  for (let i = 0; i < 100; i++) sim.step(0.05);
  assert.ok(calls > 0, 'step phải gọi rng để chọn điểm hẹn');
});

test('SEED giữ đúng toạ độ gốc từng NPC cơ duyên', () => {
  assert.deepEqual(SEED.map(s => [s.role, s.scene, s.x, s.z]), [
    ['beggar', 'hall', 0.68, 0.67],
    ['wanderer', 'yard', 0.32, 0.67],
    ['obito', 'library', 0.76, 0.68]
  ]);
});
