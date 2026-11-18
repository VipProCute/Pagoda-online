'use strict';
// Đầu-cuối: gợi ý giải thế cờ (kd:hint) trừ 5 công đức trên máy chủ thật; không đủ công đức thì từ chối.
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer } = require('./helpers/live');
const { connect, call, join } = require('./helpers/client');
const PUZ = require('../public/data/kydao-puzzles.json');

test('gợi ý thế cờ trừ 5 công đức, kiểm mã thế và bước, không đủ công đức thì không cho', async t => {
  const srv = await startServer({});
  t.after(() => srv.stop());
  const s = await connect(srv.port);
  t.after(() => s.close());
  assert.equal((await join(s, 'Kỳ Thủ', 'kd-hint-user-001')).ok, true);
  const p = PUZ.chess.find(x => x.group === 'mate2');

  const poor = await call(s, 'kd:hint', { puzzle: p.id, step: 0 });
  assert.equal(poor.ok, false);
  assert.equal(poor.code, 'merit');

  assert.equal((await call(s, 'incense', { sticks: 3 })).ok, true);      // +10 công đức
  assert.equal((await call(s, 'kd:hint', { puzzle: 'khong-co', step: 0 })).ok, false);
  assert.equal((await call(s, 'kd:hint', { puzzle: p.id, step: 1 })).ok, false, 'bước của đối phương không có gợi ý');
  assert.equal((await call(s, 'kd:hint', { puzzle: p.id, step: 99 })).ok, false);

  const r = await call(s, 'kd:hint', { puzzle: p.id, step: 0 });
  assert.equal(r.ok, true, r.reason);
  assert.equal(r.square, p.moves[0].slice(0, 2));
  assert.equal(r.cost, 5);
  assert.equal(r.total, 5);
  assert.equal((await call(s, 'kd:hint', { puzzle: p.id, step: 2 })).ok, false, 'xin quá nhanh');
  await new Promise(res => setTimeout(res, 1600));
  const r2 = await call(s, 'kd:hint', { puzzle: p.id, step: 2 });
  assert.equal(r2.ok, true, r2.reason);
  assert.equal(r2.total, 0);
  await new Promise(res => setTimeout(res, 1600));
  assert.equal((await call(s, 'kd:hint', { puzzle: p.id, step: 0 })).code, 'merit', 'hết công đức thì dừng, không để âm');
});
