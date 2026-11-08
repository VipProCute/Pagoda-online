'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer } = require('./helpers/live');
const { connect, join, call, waitFor } = require('./helpers/client');

test('đúng 666 công đức nhận buff Ma Vương bằng mốc -1000 trong phòng PK có buff', async t => {
  const day = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pagoda-666-'));
  const dataFile = path.join(dir, 'db.json');
  const aId = 'easter-666-user-001', bId = 'demon-negative-user-01';
  fs.writeFileSync(dataFile, JSON.stringify({ version: 2, day, merit: {
    [aId]: { name: 'Nguoi May Man', total: 666, today: 0, day },
    [bId]: { name: 'Ma Vuong', total: -1000, today: 0, day }
  } }));
  const srv = await startServer({ DATA_FILE: dataFile });
  t.after(() => srv.stop());
  const a = await connect(srv.port), b = await connect(srv.port);
  t.after(() => { a.close(); b.close(); });
  const ja = await join(a, 'Nguoi May Man', aId), jb = await join(b, 'Ma Vuong', bId);
  assert.equal(ja.merit.total, 666);
  assert.ok((await call(a, 'place:set', { place: 'arena' })).ok);
  assert.ok((await call(b, 'place:set', { place: 'arena' })).ok);
  const invitation = waitFor(b, 'pk:invited');
  const sent = await call(a, 'pk:invite', { toPid: jb.you, mode: 'buff' });
  assert.ok(sent.ok, sent.reason);
  const iv = await invitation;
  assert.equal(iv.buffs.op.Lq, 4);
  assert.equal(iv.buffs.you.Lq, 4);
  assert.equal(iv.buffs.op.Lc, 2, 'giữ cả pháp tướng theo công đức dương');
  assert.equal(iv.buffs.op.offExt, iv.buffs.you.offExt);
  assert.ok(Math.abs(iv.buffs.op.offExt - 0.024) < 1e-12);
  const lobby = waitFor(b, 'pk:lobby');
  assert.ok((await call(b, 'pk:respond', { inviteId: iv.inviteId, accept: true })).ok);
  const snapshot = await lobby;
  assert.equal(snapshot.buffs.op.Lq, 4);
  assert.equal(snapshot.buffs.op.offExt, snapshot.buffs.you.offExt);
});
