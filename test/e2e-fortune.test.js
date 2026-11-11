'use strict';
/* Bói toán ở máy chủ: rút tarot theo hạt giống trong ngày (tarot:draw) và giới hạn tần suất xin xăm (fortune:join / leave). */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer } = require('./helpers/live');
const { connect, call, join, sleep } = require('./helpers/client');

const open = [];
test.after(() => open.forEach(s => s.close()));
async function enter(srv, name, uid) {
  const socket = await connect(srv.port);
  open.push(socket);
  const r = await join(socket, name, uid);
  assert.ok(r && r.ok, r && r.reason);
  return socket;
}
const queueEvents = socket => socket.log.filter(x => x.ev === 'fortune:queue').length;

test('tarot:draw: 5 lá khác nhau + rev, lần 2 cùng quẻ có again, không lộ uid hay hạt giống', async t => {
  const srv = await startServer({});
  t.after(() => srv.stop());
  const a = await enter(srv, 'Minh Tam', 'uid-tarot-a00001');
  const r1 = await call(a, 'tarot:draw', { topic: 'career', span: 30 });
  assert.equal(r1.ok, true, r1.reason);
  assert.deepEqual(Object.keys(r1).sort(), ['again', 'cards', 'ok'], 'không trả thêm trường nào (uid, hạt giống…)');
  assert.equal(r1.again, false);
  assert.equal(r1.cards.length, 5);
  assert.equal(new Set(r1.cards.map(c => c.id)).size, 5, 'năm lá khác nhau');
  for (const c of r1.cards) {
    assert.deepEqual(Object.keys(c).sort(), ['id', 'rev']);
    assert.ok(Number.isInteger(c.id) && c.id >= 0 && c.id <= 77);
    assert.equal(typeof c.rev, 'boolean');
  }
  const r2 = await call(a, 'tarot:draw', { topic: 'career', span: 30 });
  assert.equal(r2.ok, true);
  assert.equal(r2.again, true, 'đã rút đúng bộ này hôm nay');
  assert.deepEqual(r2.cards, r1.cards, 'quẻ vẫn vậy');

  const r3 = await call(a, 'tarot:draw', { topic: 'career', span: 7 });
  assert.equal(r3.again, false, 'khung khác là câu hỏi khác');

  // vào lại cùng uid (kết nối mới) vẫn ra y hệt nhờ hạt giống
  const a2 = await enter(srv, 'Minh Tam Hai', 'uid-tarot-a00001');
  const again2 = await call(a2, 'tarot:draw', { topic: 'career', span: 30 });
  assert.deepEqual(again2.cards, r1.cards, 'cùng uid, cùng ngày, cùng câu hỏi');
  assert.equal(again2.again, true);
});

test('tarot:draw: kiểm đầu vào, love cần status, thiếu ack hoặc chưa vào chùa thì bỏ qua', async t => {
  const srv = await startServer({});
  t.after(() => srv.stop());
  const a = await enter(srv, 'Thien Hoa', 'uid-tarot-b00001');
  // ca sai cũng tốn lượt (burst 3), nên chỉ thử ba ca trên một kết nối
  const bad1 = await call(a, 'tarot:draw', { topic: 'khong-co', span: 30 });
  assert.equal(bad1.ok, false);
  assert.ok(bad1.reason);
  const bad2 = await call(a, 'tarot:draw', { topic: 'love', span: 30 });
  assert.equal(bad2.ok, false, 'love thiếu status');
  const ok = await call(a, 'tarot:draw', { topic: 'love', span: 90, status: 'couple' });
  assert.equal(ok.ok, true, ok.reason);
  const single = await call(await enter(srv, 'Quan Am', 'uid-tarot-b00002'), 'tarot:draw', { topic: 'love', span: 90, status: 'single' });
  assert.equal(single.ok, true);
  assert.notDeepEqual(single.cards, ok.cards, 'khác người, khác tình trạng thì (gần như chắc chắn) khác quẻ');

  // chưa vào chùa: không có phản hồi (socket không có `p`)
  const lurker = await connect(srv.port);
  open.push(lurker);
  const silent = await new Promise(resolve => lurker.timeout(400).emit('tarot:draw', { topic: 'career', span: 30 }, err => resolve(Boolean(err))));
  assert.equal(silent, true, 'không ack khi chưa vào chùa');
});

test('tarot:draw: giới hạn 3 lần liền, sau đó bị chặn với lời nhắc tiếng Việt', async t => {
  const srv = await startServer({});
  t.after(() => srv.stop());
  const a = await enter(srv, 'Phap Tam', 'uid-tarot-c00001');
  const res = [];
  for (let i = 0; i < 8; i++) res.push(await call(a, 'tarot:draw', { topic: 'study', span: 7 }));
  assert.ok(res.slice(0, 3).every(r => r.ok), 'ba lần đầu qua');
  const blocked = res.filter(r => !r.ok);
  assert.ok(blocked.length >= 4, 'spam thì bị chặn: ' + JSON.stringify(res.map(r => r.ok)));
  assert.match(blocked[0].reason, /hơi nhanh/);
});

test('xin xăm: spam join/leave bị chặn, không phát fortune:queue tràn lan; vẫn xin được sau khi chờ', async t => {
  const srv = await startServer({});
  t.after(() => srv.stop());
  const watcher = await enter(srv, 'Nguoi Xem', 'uid-fort-w000001');
  const a = await enter(srv, 'Nguoi Xin', 'uid-fort-a000001');
  await sleep(100);
  const before = queueEvents(watcher);

  let blocked = 0;
  for (let i = 0; i < 20; i++) {
    const r = await call(a, 'fortune:join', null);
    if (!r.ok && /hơi nhanh/.test(r.reason)) blocked++;
    a.emit('fortune:leave');
  }
  await sleep(300);
  const events = queueEvents(watcher) - before;
  assert.ok(blocked >= 10, `phần lớn lượt spam bị chặn (chặn ${blocked}/20)`);
  assert.ok(events <= 8, `không phát hàng chờ cho mỗi lượt bị chặn (phát ${events})`);
  assert.ok(events >= 1, 'lượt hợp lệ đầu tiên vẫn phát');

  // chờ nạp lại token rồi xin lại: dọn hàng bằng leave, chờ thêm một lượt, rồi join phải thành công
  await sleep(2500);
  a.emit('fortune:leave');
  await sleep(2200);
  const again = await call(a, 'fortune:join', null);
  assert.equal(again.ok, true, 'sau khi chờ đủ lâu thì xin xăm lại được: ' + JSON.stringify(again));
});

test('xin xăm: fortune:leave ở sai cảnh không tiêu lượt', async t => {
  const srv = await startServer({});
  t.after(() => srv.stop());
  const a = await enter(srv, 'Nguoi Roi', 'uid-fort-c000001');
  assert.equal((await call(a, 'scene', 'yard')).ok, true);
  for (let i = 0; i < 6; i++) a.emit('fortune:leave');
  await sleep(200);
  assert.equal((await call(a, 'scene', 'hall')).ok, true);
  const r = await call(a, 'fortune:join', null);
  assert.equal(r.ok, true, 'leave ở sân chùa không được tốn lượt: ' + JSON.stringify(r));
});

test('xin xăm: sai cảnh vẫn báo lỗi cảnh trước, không tốn lượt', async t => {
  const srv = await startServer({});
  t.after(() => srv.stop());
  const a = await enter(srv, 'Nguoi Xin', 'uid-fort-b000001');
  assert.equal((await call(a, 'scene', 'yard')).ok, true);
  for (let i = 0; i < 10; i++) {
    const r = await call(a, 'fortune:join', null);
    assert.equal(r.ok, false);
    assert.match(r.reason, /chánh điện/, 'ở sân chùa luôn nhận lời mời về chánh điện, không bị coi là spam');
  }
  assert.equal((await call(a, 'scene', 'hall')).ok, true);
  const r = await call(a, 'fortune:join', null);
  assert.equal(r.ok, true, 'về chánh điện vẫn xin được vì chưa tốn lượt nào');
});
