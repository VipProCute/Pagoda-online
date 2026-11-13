'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const math = require('../public/js/view-math.js');
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-10, `${actual} khác ${expected}`);
const bounds = { minX: -4, maxX: 4, minZ: -3, maxZ: 3 };
const target = { x: 0, y: 0, z: 0 };

test('Có kích thước dương cho bốn cảnh', () => {
  assert.deepEqual(Object.keys(math.SCENE_SIZE), ['hall', 'yard', 'library', 'arena']);
  for (const size of Object.values(math.SCENE_SIZE)) assert.ok(size.width > 0 && size.depth > 0);
});
for (const scene of ['hall', 'yard', 'library', 'arena']) {
  test(`Đổi tọa độ hai chiều nghịch đảo tại ${scene}`, () => {
    for (const [x, z] of [[0, 0], [0.5, 0.5], [1, 1], [0.13, 0.72]]) {
      const world = math.toWorld(scene, x, z);
      const floor = math.toFloor(scene, world.x, world.z);
      close(floor.x, x); close(floor.z, z);
    }
  });
}
test('Tâm sàn là gốc thế giới', () => assert.deepEqual(math.toWorld('hall', 0.5, 0.5), { x: 0, z: 0 }));
test('Mặc định là góc thứ ba', () => assert.equal(math.createView().mode, 'third'));
test('Chọn góc thứ nhất khi tạo', () => assert.equal(math.createView({ mode: 'first' }).mode, 'first'));
test('Từ chối góc nhìn không hợp lệ', () => assert.throws(() => math.createView().setMode('other'), RangeError));
test('Góc thứ nhất kẹp ngẩng tối đa 60 độ', () => { const view = math.createView({ mode: 'first' }); view.rotate(0, 100); close(view.pitch, Math.PI / 3); });
test('Góc thứ nhất kẹp cúi tối đa 60 độ', () => { const view = math.createView({ mode: 'first' }); view.rotate(0, -100); close(view.pitch, -Math.PI / 3); });
test('Góc thứ ba kẹp góc thấp nhất 5 độ', () => { const view = math.createView(); view.rotate(0, -100); close(view.pitch, Math.PI / 36); });
test('Góc thứ ba kẹp góc cao nhất 70 độ', () => { const view = math.createView(); view.rotate(0, 100); close(view.pitch, 7 * Math.PI / 18); });
test('Đổi góc nhìn kẹp lại góc dọc', () => { const view = math.createView({ mode: 'first' }); view.rotate(0, -100); view.setMode('third'); close(view.pitch, Math.PI / 36); });
test('Thu phóng kẹp khoảng cách hai đầu', () => { const view = math.createView(); view.zoom(0.01); assert.equal(view.dist, 2); view.zoom(100); assert.equal(view.dist, 9); });
test('Xoay ngang tích lũy theo radian', () => { const view = math.createView(); view.rotate(1, 0); view.rotate(0.5, 0); close(view.yaw, 1.5); });
test('Máy quay thứ nhất ở tầm mắt và nhìn về phía bàn thờ', () => { const pose = math.cameraPose(math.createView({ mode: 'first' }), target, bounds); close(pose.pos.y, 1.55); assert.ok(pose.look.z < pose.pos.z); });
test('Máy quay thứ nhất theo độ cao mục tiêu', () => { const pose = math.cameraPose(math.createView({ mode: 'first' }), { x: 1, y: 2, z: 3 }, bounds); close(pose.pos.y, 3.55); });
test('Máy quay thứ ba ở sau lưng và nhìn mục tiêu', () => { const pose = math.cameraPose(math.createView(), target, bounds); assert.equal(pose.pos.z, 3); assert.deepEqual(pose.look, { x: 0, y: 1.55, z: 0 }); });
test('Máy quay thứ ba không ra ngoài tường', () => { const view = math.createView(); view.rotate(Math.PI / 2, 0); const pose = math.cameraPose(view, target, bounds); close(pose.pos.x, -4); });
test('Máy quay thứ ba không thấp hơn sàn', () => { const pose = math.cameraPose(math.createView(), { x: 0, y: -20, z: 0 }, bounds); assert.equal(pose.pos.y, 0.3); });
test('Đi thẳng theo hướng nhìn', () => { const next = math.moveTarget('hall', 0.5, 0.5, 0, 1, 0, 0.12); close(next.x, 0.5); close(next.z, 0.38); });
test('Đi ngang sang phải theo máy quay', () => { const next = math.moveTarget('hall', 0.5, 0.5, 0, 0, 1, 0.12); assert.ok(next.x > 0.5); close(next.z, 0.5); });
test('Xoay hướng nhìn đổi hướng di chuyển', () => { const next = math.moveTarget('hall', 0.5, 0.5, Math.PI / 2, 1, 0, 0.12); assert.ok(next.x > 0.5); close(next.z, 0.5); });
test('Đi chéo không nhanh hơn đi thẳng trong thế giới', () => { const straight = math.moveTarget('hall', 0.5, 0.5, 0, 1, 0, 0.12); const diagonal = math.moveTarget('hall', 0.5, 0.5, 0, 1, 1, 0.12); const one = math.toWorld('hall', straight.x, straight.z); const two = math.toWorld('hall', diagonal.x, diagonal.z); close(Math.hypot(one.x, one.z), Math.hypot(two.x, two.z)); });
test('Đi tới được kẹp theo bốn biên sàn', () => { assert.deepEqual(math.moveTarget('hall', 0, 0, 0, 1, -1, 10), { x: 0.03, z: 0.12 }); assert.deepEqual(math.moveTarget('hall', 1, 1, 0, -1, 1, 10), { x: 0.97, z: 0.97 }); });
test('Nội suy không vượt đích và không lùi khi thời gian âm', () => { assert.ok(math.smooth(0, 10, 0.1, false) > 0 && math.smooth(0, 10, 0.1, false) < 10); assert.equal(math.smooth(0, 10, -1, false), 0); });
test('Nội suy không phụ thuộc chia bước thời gian', () => { const halfway = math.smooth(0, 10, 0.1, false); close(math.smooth(halfway, 10, 0.1, false), math.smooth(0, 10, 0.2, false)); });
test('Giảm chuyển động đến đích ngay', () => assert.equal(math.smooth(1, 8, 0, true), 8));
test('Nạp trên trình duyệt không cần DOM', () => { const context = {}; vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../public/js/view-math.js'), 'utf8'), context); assert.equal(typeof context.ViewMath.cameraPose, 'function'); });
