'use strict';
/* Kiểm thử các lỗi bảo mật đã được rà soát và sửa: lộ uid qua danh sách chặn, thử mã quản trị qua socket,
 * gói pk:* tới tab chánh điện, giới hạn hoàn thành ngay tính cả yêu cầu đang chờ. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer } = require('./helpers/live');
const { connect, call, join, waitFor, sleep } = require('./helpers/client');

const BANK = { BANK_ID: '970436', BANK_ACCOUNT: '0123456789', BANK_ACCOUNT_NAME: 'CHUA THU' };
const open = [];
test.after(() => open.forEach(s => s.close()));
async function enter(srv, name, uid, adminKey) {
  const socket = await connect(srv.port);
  open.push(socket);
  const r = await call(socket, 'join', { name, look: { g: 'nam', c: 1, h: 0 }, uid, adminKey });
  assert.ok(r && r.ok, r && r.reason);
  return { socket, pid: r.you, uid, join: r };
}

test('danh sách chặn không lộ uid thật; chỉ chặn được người đang ở sân; bỏ chặn bằng mã mờ', async t => {
  const srv = await startServer({});
  t.after(() => srv.stop());
  const A = await enter(srv, 'Minh Tam', 'uid-sec-a000001');
  const B = await enter(srv, 'Thien Hoa', 'uid-sec-b000001');
  const C = await enter(srv, 'Quan Am', 'uid-sec-c000001');         // ở chánh điện
  await call(A.socket, 'place:set', { place: 'arena' });
  await call(B.socket, 'place:set', { place: 'arena' });

  assert.equal((await call(A.socket, 'pk:block', { pid: C.pid })).ok, false, 'người ở chánh điện không chặn được');
  assert.ok((await call(A.socket, 'pk:block', { pid: B.pid })).ok);
  const bl = await call(A.socket, 'arena:blocks', {});
  assert.equal(bl.list.length, 1);
  assert.equal(bl.list[0].name, 'Thien Hoa');
  assert.notEqual(bl.list[0].uid, 'uid-sec-b000001', 'không được trả uid thật');
  assert.ok(!JSON.stringify(bl).includes('uid-sec-b000001'));
  assert.equal(A.socket.log.some(x => JSON.stringify(x.payload || '').includes('uid-sec-b000001')), false, 'không gói nào gửi cho A chứa uid của B');

  // B bị chặn nên không mời được A
  const inv = await call(B.socket, 'pk:invite', { toPid: A.pid, mode: 'balanced' });
  assert.equal(inv.ok, false);
  assert.ok((await call(A.socket, 'pk:unblock', { uid: bl.list[0].uid })).ok);
  assert.equal((await call(A.socket, 'arena:blocks', {})).list.length, 0);
  assert.ok((await call(B.socket, 'pk:invite', { toPid: A.pid, mode: 'balanced' })).ok, 'bỏ chặn rồi thì mời được');
});

test('mã quản trị: nhập sai qua socket bị đếm và khóa riêng; trang quản trị có bộ đếm riêng', async t => {
  const srv = await startServer({});
  t.after(() => srv.stop());
  for (let i = 0; i < 10; i++) {
    const c = await enter(srv, 'Khach Thu ' + i, 'uid-adm-bad-' + String(i).padStart(4, '0'), 'ma-sai-' + i);
    assert.equal(c.join.players.find(p => p.id === c.pid).mod, false);
    c.socket.close();
    await sleep(20);
  }
  // kênh socket đã bị khóa: mã ĐÚNG qua socket cũng không được nhận là Ban điều hành...
  const ok = await enter(srv, 'Khach Ma Dung', 'uid-adm-good-0001', 'khoa-quan-tri-thu');
  assert.equal(ok.join.players.find(p => p.id === ok.pid).mod, false, 'đang khóa thì không so mã');
  // ...nhưng trang quản trị có bộ đếm riêng nên mã cũ lưu ở trình duyệt không khóa được quản trị viên
  assert.equal((await srv.admin('/api/admin/summary')).status, 200);
  for (let i = 0; i < 10; i++) assert.equal((await srv.admin('/api/admin/summary', 'GET', null, 'sai-ma')).status, 401);
  assert.equal((await srv.admin('/api/admin/summary')).status, 429, 'sai 10 lần ở trang quản trị thì bị khóa');
  // sau khi máy chủ khởi động lại thì hết khóa
  ok.socket.close();
  await srv.restart();
  const again = await enter(srv, 'Ban Dieu Hanh', 'uid-adm-good-0002', 'khoa-quan-tri-thu');
  assert.equal(again.join.players.find(p => p.id === again.pid).mod, true);
});

test('gói pk:* chỉ tới tab đang ở Sân đấu, không tới tab chánh điện của cùng tài khoản', async t => {
  const srv = await startServer({});
  t.after(() => srv.stop());
  const tabArena = await enter(srv, 'Minh Tam', 'uid-tab-a000001');
  const tabHall = await enter(srv, 'Minh Tam Hai', 'uid-tab-a000001');
  const other = await enter(srv, 'Thien Hoa', 'uid-tab-b000001');
  await call(tabArena.socket, 'place:set', { place: 'arena' });
  await call(other.socket, 'place:set', { place: 'arena' });
  const got = waitFor(tabArena.socket, 'pk:invited');
  assert.ok((await call(other.socket, 'pk:invite', { toPid: tabArena.pid, mode: 'balanced' })).ok);
  await got;
  await sleep(150);
  assert.equal(tabHall.socket.log.filter(x => /^(pk:|arena:)/.test(x.ev)).length, 0);
});

test('hoàn thành ngay: yêu cầu đang chờ cũng tính vào giới hạn mỗi ngày', async t => {
  const srv = await startServer({ ...BANK, SPEEDUP_PER_DAY: '1' });
  t.after(() => srv.stop());
  const c = await enter(srv, 'Dieu Lien', 'uid-quota-0000001');
  const s1 = await call(c.socket, 'tu:start', { methodId: 'tinh-tam-quyet', duration: '4h' });
  const sp1 = await call(c.socket, 'tu:speedup', { sessionId: s1.session.id });
  assert.ok(sp1.ok, sp1.reason);
  assert.ok((await call(c.socket, 'tu:cancel', { sessionId: s1.session.id })).ok);   // yêu cầu cũ vẫn đang chờ xác nhận
  const s2 = await call(c.socket, 'tu:start', { methodId: 'tinh-tam-quyet', duration: '4h' });
  const sp2 = await call(c.socket, 'tu:speedup', { sessionId: s2.session.id });
  assert.equal(sp2.ok, false);
  assert.equal(sp2.code, 'limit');
  // hủy yêu cầu đang chờ thì có thể tạo yêu cầu mới
  assert.ok((await call(c.socket, 'tu:speedup:cancel', { code: sp1.code })).ok);
  assert.ok((await call(c.socket, 'tu:speedup', { sessionId: s2.session.id })).ok);
});
