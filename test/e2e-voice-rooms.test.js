'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, sleep } = require('./helpers/live');
const { connect, call, join, waitFor } = require('./helpers/client');

test('voice tự nghe, phòng cách ly theo khu và khóa mic vẫn được nghe', async t => {
  const srv = await startServer(); t.after(() => srv.stop());
  const a = await connect(srv.port), b = await connect(srv.port), mod = await connect(srv.port);
  t.after(() => { a.close(); b.close(); mod.close(); });
  const ja = await join(a, 'Dao Huu A', 'voice-room-a-0001');
  const jb = await join(b, 'Dao Huu B', 'voice-room-b-0001');
  const jm = await call(mod, 'join', { name: 'Quan Tri', uid: 'voice-room-mod-01', adminKey: 'khoa-quan-tri-thu' });
  assert.ok(jm.ok);
  assert.ok((await call(a, 'voice:join', { mic: false })).ok);
  assert.ok((await call(b, 'voice:join', { mic: false })).ok);
  const confirmSignal = async (allowed, number) => {
    const marker = `voice-test-${number}`;
    if (allowed) {
      const got = waitFor(b, 'voice:signal', x => x.s.sdp === marker);
      a.emit('voice:signal', { to: jb.you, s: { type: 'offer', sdp: marker } });
      assert.equal((await got).from, ja.you);
    } else {
      a.emit('voice:signal', { to: jb.you, s: { type: 'offer', sdp: marker } });
      await sleep(180);
      assert.equal(b.log.some(x => x.ev === 'voice:signal' && x.payload.s.sdp === marker), false);
    }
  };
  await confirmSignal(true, 1);
  await call(a, 'scene', 'yard'); await confirmSignal(false, 2);
  await call(b, 'scene', 'yard'); await confirmSignal(true, 3);
  await call(a, 'scene', 'library'); await confirmSignal(false, 4);
  await call(b, 'scene', 'library'); await confirmSignal(true, 5);
  await call(a, 'place:set', { place: 'arena' }); await confirmSignal(false, 6);
  await call(b, 'place:set', { place: 'arena' }); await confirmSignal(true, 7);
  await call(a, 'place:set', { place: 'dojo' }); await confirmSignal(false, 8);
  await call(b, 'place:set', { place: 'dojo' }); await confirmSignal(true, 9);
  assert.equal((await call(a, 'voice:mic', { on: true })).ok, true);
  const kicked = waitFor(a, 'voice:kicked');
  mod.emit('mod:voice', { pid: ja.you }); await kicked;
  assert.equal((await call(a, 'voice:mic', { on: true })).ok, false);
  await confirmSignal(true, 10); // khóa nói không cắt quyền nghe
});
