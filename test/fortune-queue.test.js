'use strict';
/* Hàng đợi xin xăm (lib/fortune-queue.js): lần lượt từng người, quẻ 1–12 từ crypto.randomInt, rời hàng thì được dọn. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const createFortuneQueue = require('../lib/fortune-queue');

const sleep = ms => new Promise(r => setTimeout(r, ms));

test('không dùng Math.random: quẻ rút bằng crypto.randomInt', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'lib', 'fortune-queue.js'), 'utf8');
  assert.doesNotMatch(src, /Math\.random/);
  assert.match(src, /crypto\.randomInt\(1, 13\)/);
});

test('quẻ mặc định nằm trong 1..12 và đủ 12 quẻ đều có thể ra', async () => {
  const q = createFortuneQueue({ broadcast: () => {}, duration: 1 });
  const seen = new Set();
  let id = 0;
  for (let i = 0; i < 400 && seen.size < 12; i++) {
    const got = await new Promise(resolve => q.join({ id: ++id, name: 'a', deliver: resolve }));
    assert.ok(Number.isInteger(got) && got >= 1 && got <= 12, 'quẻ ' + got);
    seen.add(got);
  }
  assert.equal(seen.size, 12, 'sau 400 lần phải thấy đủ 12 quẻ');
});

test('hàng chờ: lần lượt từng người, không vào hai lần, phát trạng thái mỗi khi đổi', async () => {
  const states = [];
  const q = createFortuneQueue({ broadcast: s => states.push(s), duration: 30, pick: () => 7 });
  const results = [];
  const person = (id, name) => ({ id, name, deliver: n => results.push([id, n]) });
  assert.equal(q.join(person(1, 'A')), true);
  assert.equal(q.join(person(2, 'B')), true);
  assert.equal(q.join(person(1, 'A')), false, 'đang xin thì không vào lại');
  assert.equal(q.join(person(2, 'B')), false, 'đang chờ thì không vào lại');
  let s = q.snapshot();
  assert.equal(s.current.id, 1);
  assert.deepEqual(s.waiting, [{ id: 2, name: 'B' }]);
  for (let i = 0; i < 100 && results.length < 2; i++) await sleep(20);   // chờ đủ hai lượt deliver, tối đa ~2 giây
  assert.deepEqual(results, [[1, 7], [2, 7]]);
  s = q.snapshot();
  assert.equal(s.current, null);
  assert.equal(s.waiting.length, 0);
  assert.ok(states.length >= 3);
});

test('rời hàng: người đang chờ bị bỏ, người đang xin rời thì người sau lên thay và không nhận quẻ', async () => {
  const q = createFortuneQueue({ broadcast: () => {}, duration: 40, pick: () => 3 });
  const got = [];
  const person = id => ({ id, name: 'n' + id, deliver: n => got.push([id, n]) });
  q.join(person(1)); q.join(person(2)); q.join(person(3));
  q.remove(2);
  assert.deepEqual(q.snapshot().waiting.map(p => p.id), [3]);
  q.remove(1);
  assert.equal(q.snapshot().current.id, 3, 'người sau lên thay');
  await sleep(120);
  assert.deepEqual(got, [[3, 3]]);
});
