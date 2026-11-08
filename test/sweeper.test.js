'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createSweeper } = require('../lib/sweeper');
const merit = require('../public/js/merit');

test('Tảo Địa Tăng chỉ xuất hiện khi lần rút hiếm thành công và tự rời đi', () => {
  let time = 0, draw = 0.9;
  const s = createSweeper({ now: () => time, random: () => draw, id: () => '1234567890abcdef12345678', chance: 0.001 });
  time = 59999; assert.equal(s.tick().changed, false);
  time = 60000; assert.equal(s.tick().changed, false);
  draw = 0; time = 120000;
  assert.deepEqual(s.tick().event, { id: '1234567890abcdef12345678', x: 0.5, z: 0.55, until: 240000 });
  time = 239999; assert.ok(s.current());
  time = 240000; assert.equal(s.current(), null);
  assert.deepEqual(s.tick(), { changed: true, event: null });
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
