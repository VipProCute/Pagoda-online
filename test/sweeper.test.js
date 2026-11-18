'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createSweeper, STAY_MS } = require('../lib/sweeper');
const merit = require('../public/js/merit');

test('Tảo Địa Tăng chỉ xuất hiện khi lần rút thành công và đứng chờ tới khi trao cơ duyên', () => {
  let time = 0, draw = 0.9;
  const s = createSweeper({ now: () => time, random: () => draw, id: () => '1234567890abcdef12345678', chance: 1 / 512 });
  time = 59999; assert.equal(s.tick().changed, false);
  time = 60000; assert.equal(s.tick().changed, false);
  draw = 0; time = 120000;
  assert.deepEqual(s.tick().event, { id: '1234567890abcdef12345678', x: 0.5, z: 0.55, at: 120000, until: 120000 + STAY_MS });
  // nhiều ngày sau vẫn còn đứng đó, không rút thêm sự kiện mới
  time = 120000 + 5 * 86400e3;
  assert.ok(s.current());
  assert.equal(s.tick().changed, false);
  assert.equal(s.release('khac'), false);
  assert.ok(s.current());
  assert.equal(s.release('1234567890abcdef12345678'), true);
  assert.equal(s.current(), null);
  // lần rút kế tiếp sau một phút
  assert.equal(s.tick().changed, false);
  time += 60000;
  assert.equal(s.tick().changed, true);
});

test('mặc định mỗi phút rút với xác suất 1/512', () => {
  let time = 0;
  const draws = [];
  const s = createSweeper({ now: () => time, random: () => { draws.push(1); return 1 / 512 - 1e-9; } });
  time = 60000;
  assert.equal(s.tick().changed, true);
  const s2 = createSweeper({ now: () => time, random: () => 1 / 512 });
  time += 60000;
  assert.equal(s2.tick().changed, false);
});

test('chính xác 666 công đức có Ma Vương cấp 4 cho cả hình ảnh và PK', () => {
  assert.equal(merit.visualDemonOf(665), null);
  assert.deepEqual(merit.visualDemonOf(666), { n: 4, alpha: 1 });
  assert.equal(merit.visualDemonOf(667), null);
  assert.deepEqual(merit.demonOf(666), { n: 4, alpha: 1 });
  assert.equal(merit.demonOf(665), null);
  assert.equal(merit.demonOf(667), null);
  assert.equal(merit.visualDemonOf(-1000).n, 4);
  assert.notEqual(merit.visualKey(665), merit.visualKey(666));
  assert.notEqual(merit.visualKey(666), merit.visualKey(667));
});
