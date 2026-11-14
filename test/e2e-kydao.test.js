'use strict';
/*
 * Kỳ Đạo qua socket thật (T-030): bàn ở Sân chùa, lời mời từ chánh điện, người xem, vào lại, tắt bàn cờ.
 * Cờ tướng úp chưa có (T-024), nên phần quét "không lộ quân úp" làm ở đây chỉ kiểm uid và dữ liệu cờ vua;
 * ca quét quân úp bổ sung khi T-024 xong.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { startServer } = require('./helpers/live');
const { connect, call, join, waitFor, sleep } = require('./helpers/client');

const UID = { a: 'kd-uid-an-0000001', b: 'kd-uid-binh-000001', w: 'kd-uid-xem-0000001', o: 'kd-uid-ngoai-00001' };
const MATE = [['a', 'f2f3'], ['b', 'e7e5'], ['a', 'g2g4'], ['b', 'd8h4']];    // chiếu hết kiểu "đồ đệ": Đen thắng sau 4 nửa nước

async function open(t, srv, name, uid, scene) {
  const s = await connect(srv.port);
  t.after(() => s.close());
  const j = await join(s, name, uid);
  assert.equal(j.ok, true);
  if (scene) assert.equal((await call(s, 'scene', scene)).ok, true);
  return { s, pid: j.you, join: j };
}
const yard = (t, srv, name, uid) => open(t, srv, name, uid, 'yard');

/** Mọi gói (sự kiện và ack) mà một client đã thấy, dạng chuỗi JSON để quét. */
const everything = (...clients) => clients.flatMap(c => c.s.log.map(x => JSON.stringify(x.payload))).concat(clients.flatMap(c => c.acks || []));

test('hai người ngồi bàn, chơi cờ vua tới chiếu hết, Elo ghi vào db.kydao; người xem nhận nước; không lộ uid', async t => {
  const srv = await startServer(); t.after(() => srv.stop());
  const A = await yard(t, srv, 'An', UID.a), B = await yard(t, srv, 'Binh', UID.b), W = await yard(t, srv, 'Xem', UID.w), O = await yard(t, srv, 'Ngoai', UID.o);
  const acks = []; A.acks = acks; B.acks = acks; W.acks = acks; O.acks = acks;
  const ask = async (c, ev, d) => { const r = await call(c.s, ev, d); acks.push(JSON.stringify(r)); return r; };

  const tables = await ask(A, 'kd:tables', {});
  assert.equal(tables.ok, true);
  assert.equal(tables.tables.length, 4);
  assert.ok(tables.tables.every(x => x.status === 'free'));

  const arrived = waitFor(A.s, 'p', arr => arr.some(q => q[0] === A.pid && Math.abs(q[1] - 125) <= 2 && Math.abs(q[2] - 500) <= 2), 8000);
  assert.equal((await ask(A, 'kd:sit', { table: 1, seat: 0 })).ok, true);
  assert.equal((await ask(B, 'kd:sit', { table: 1, seat: 1 })).ok, true);
  await arrived;     // nhân vật đi tới ghế 0 của bàn 1 (YARD_TABLES)
  assert.equal((await ask(O,'kd:sit', { table: 1, seat: 0 })).ok, false, 'ghế đã có người');
  assert.equal((await ask(B, 'kd:setup', { table: 1, game: 'chess', rated: true, pace: 'fast' })).ok, false, 'chỉ chủ bàn chọn luật');
  assert.equal((await ask(A, 'kd:setup', { table: 1, game: 'chess', rated: true, pace: 'fast' })).ok, true);

  const startA = waitFor(A.s, 'kd:start'), startB = waitFor(B.s, 'kd:start');
  assert.equal((await ask(A, 'kd:ready', { table: 1, ready: true })).ok, true);
  assert.equal((await ask(B, 'kd:ready', { table: 1, ready: true })).ok, true);
  const sa = await startA, sb = await startB;
  assert.equal(sa.you, 'a'); assert.equal(sb.you, 'b');
  assert.equal(sa.rated, true); assert.equal(sa.table, 1);
  assert.equal(sa.a.pid, A.pid);

  // người xem vào giữa ván: nhận kd:start không có `you`, rồi nhận từng nước
  const startW = waitFor(W.s, 'kd:start');
  assert.deepEqual(await ask(W, 'kd:watch', { table: 1 }), { ok: true, table: 1 });
  const sw = await startW;
  assert.equal(sw.you, undefined);
  assert.equal(sw.resumed, true);
  // người ngoài và người xem không đi được
  assert.equal((await ask(W, 'kd:move', { gameId: sa.gameId, ply: 0, move: 'e2e4' })).ok, false);
  assert.equal((await ask(O, 'kd:resign', { gameId: sa.gameId })).ok, false);
  assert.equal((await ask(A, 'kd:move', { gameId: sa.gameId, ply: 0, move: 'x'.repeat(20) })).ok, false, 'chuỗi nước quá dài');
  assert.equal((await ask(A, 'kd:move', { gameId: sa.gameId, ply: 0, move: 'e2e5' })).ok, false, 'nước không hợp lệ');
  assert.equal((await ask(B, 'kd:move', { gameId: sa.gameId, ply: 0, move: 'e7e5' })).ok, false, 'chưa tới lượt');

  const ended = waitFor(W.s, 'kd:end');
  let ply = 0;
  for (const [who, move] of MATE) {
    const c = who === 'a' ? A : B;
    const r = await ask(c, 'kd:move', { gameId: sa.gameId, ply, move });
    assert.equal(r.ok, true, move + ': ' + r.reason);
    ply = r.ply;
  }
  assert.equal(ply, 4);
  const end = await ended;
  assert.equal(end.result, 'b'); assert.equal(end.reason, 'checkmate');
  assert.deepEqual(end.elo, { a: { from: 1200, to: 1180 }, b: { from: 1200, to: 1220 } });
  const movesSeenByW = W.s.log.filter(x => x.ev === 'kd:moved').map(x => x.payload.move);
  assert.deepEqual(movesSeenByW, MATE.map(m => m[1]));
  const lastMoved = A.s.log.filter(x => x.ev === 'kd:moved').pop().payload;
  assert.equal(lastMoved.status.over, true);

  // hết ván: bàn về chờ, hai người còn ngồi và chưa sẵn sàng
  const tAfter = (await ask(O, 'kd:tables', {})).tables.find(x => x.table === 1);
  assert.equal(tAfter.status, 'waiting');
  assert.deepEqual(tAfter.seats.map(s => s && s.ready), [false, false]);
  assert.equal((await ask(A, 'kd:stand', { table: 1 })).ok, true);

  // không gói nào (sự kiện hay ack) chứa uid của ai
  const blob = everything(A, B, W, O).join('\n');
  for (const uid of Object.values(UID)) assert.ok(!blob.includes(uid), 'lộ uid ' + uid);

  await srv.stop();
  const db = JSON.parse(fs.readFileSync(srv.dataFile, 'utf8'));
  assert.equal(db.kydao.ratings[UID.b].chess.r, 1220);
  assert.equal(db.kydao.ratings[UID.a].chess.r, 1180);
  assert.equal(db.kydao.ratings[UID.a].name, 'An');
  assert.equal(db.kydao.games.length, 1);
  assert.equal(db.kydao.games[0].result, 'b');
  assert.deepEqual(db.kydao.active, {}, 'ván xong thì xóa ván đang dở');
  assert.equal(Object.values(db.kydao.pairs)[0], 1, 'bộ đếm cặp trong ngày');
});

test('mời đánh cờ từ chánh điện: máy chủ đưa cả hai ra Sân chùa, tới ghế bàn trống gần nhất', async t => {
  const srv = await startServer(); t.after(() => srv.stop());
  const A = await open(t, srv, 'An', UID.a), B = await open(t, srv, 'Binh', UID.b);
  const bad = await call(A.s, 'kd:invite', { toPid: B.pid, game: '__proto__', rated: false, pace: 'fast' });
  assert.equal(bad.ok, false);
  const invited = waitFor(B.s, 'kd:invited');
  const sent = await call(A.s, 'kd:invite', { toPid: B.pid, game: 'chess', rated: false, pace: 'fast' });
  assert.equal(sent.ok, true);
  const inv = await invited;
  assert.equal(inv.from.pid, A.pid);
  assert.equal(JSON.stringify(inv).includes(UID.a), false);
  const moves = [waitFor(A.s, 'pscene', x => x.id === A.pid && x.scene === 'yard'), waitFor(B.s, 'pscene', x => x.id === B.pid && x.scene === 'yard')];
  const startA = waitFor(A.s, 'kd:start');
  assert.equal((await call(B.s, 'kd:respond', { inviteId: inv.inviteId, accept: true })).ok, true);
  await Promise.all(moves);
  const sa = await startA;
  assert.ok(Number.isInteger(sa.table) && sa.table >= 1 && sa.table <= 4);
  const list = await call(A.s, 'kd:tables', {});
  const tb = list.tables.find(x => x.table === sa.table);
  assert.equal(tb.status, 'playing');
  assert.deepEqual(tb.seats.map(s => s.pid), [A.pid, B.pid]);
});

test('hết bàn thì ván mời thành "bàn trong": đứng tại chỗ, không đổi cảnh, vẫn nhận kd:table', async t => {
  const srv = await startServer(); t.after(() => srv.stop());
  const sitters = [];
  for (let i = 0; i < 4; i++) {
    const c = await yard(t, srv, 'Ngoi' + i, `kd-uid-ngoi-${i}-0001`);
    assert.equal((await call(c.s, 'kd:sit', { table: i + 1, seat: 0 })).ok, true);
    sitters.push(c);
  }
  const A = await open(t, srv, 'An', UID.a), B = await open(t, srv, 'Binh', UID.b);
  const invited = waitFor(B.s, 'kd:invited');
  assert.equal((await call(A.s, 'kd:invite', { toPid: B.pid, game: 'xiangqi', rated: false, pace: 'fast' })).ok, true);
  const inv = await invited;
  const startA = waitFor(A.s, 'kd:start'), inner = waitFor(A.s, 'kd:table', x => x.table === null && x.status === 'playing');
  assert.equal((await call(B.s, 'kd:respond', { inviteId: inv.inviteId, accept: true })).ok, true);
  const sa = await startA;
  assert.equal(sa.table, null);
  assert.equal((await inner).inner, true);
  assert.equal(A.s.log.some(x => x.ev === 'pscene' && x.payload.id === A.pid), false, 'không đổi cảnh');
  // người ngồi bàn ở sân không thấy ván trong, nhưng thấy gói bàn trong để vẽ biểu tượng khi lấy kd:tables
  const seen = await call(sitters[0].s, 'kd:tables', {});
  assert.equal(seen.tables.filter(x => x.table === null).length, 1, 'bàn trong có trong kd:tables');
  const fromHall = await call(A.s, 'kd:tables', {});
  assert.equal(fromHall.ok, true);
  // đi nước đầu rồi đầu hàng: ván kết thúc, bàn trong về free
  assert.equal((await call(A.s, 'kd:move', { gameId: sa.gameId, ply: 0, move: 'h2e2' })).ok, true);
  const free = waitFor(A.s, 'kd:table', x => x.table === null && x.status === 'free');
  assert.equal((await call(B.s, 'kd:resign', { gameId: sa.gameId })).ok, true);
  await free;
});

test('đổi cảnh, ngắt kết nối và vào lại khi đang ngồi hoặc đang đấu', async t => {
  const srv = await startServer(); t.after(() => srv.stop());
  const A = await yard(t, srv, 'An', UID.a), B = await yard(t, srv, 'Binh', UID.b), W = await yard(t, srv, 'Xem', UID.w);
  assert.equal((await call(A.s, 'kd:sit', { table: 2, seat: 0 })).ok, true);
  assert.equal((await call(B.s, 'kd:sit', { table: 2, seat: 1 })).ok, true);
  // đổi cảnh khi đang ngồi chờ: tự đứng dậy
  const freed = waitFor(W.s, 'kd:table', x => x.table === 2 && x.seats[1] === null);
  assert.equal((await call(B.s, 'scene', 'hall')).ok, true);
  await freed;
  assert.equal((await call(B.s, 'kd:sit', { table: 2, seat: 1 })).ok, false, 'đang ở chánh điện, không ngồi được');
  assert.equal((await call(B.s, 'scene', 'yard')).ok, true);
  assert.equal((await call(B.s, 'kd:sit', { table: 2, seat: 1 })).ok, true);
  assert.equal((await call(A.s, 'kd:setup', { table: 2, game: 'gomoku', rated: false, pace: 'fast' })).ok, true);
  const started = waitFor(A.s, 'kd:start');
  await call(A.s, 'kd:ready', { table: 2, ready: true });
  await call(B.s, 'kd:ready', { table: 2, ready: true });
  const sa = await started;
  // A tải lại trang: ngắt kết nối rồi vào lại cùng uid; ván vẫn chạy, kd:resume trả ảnh chụp đúng phía
  A.s.close();
  await sleep(300);
  const A2 = await yard(t, srv, 'An', UID.a);
  const r = await call(A2.s, 'kd:resume', {});
  assert.equal(r.ok, true);
  assert.equal(r.start.gameId, sa.gameId);
  assert.equal(r.start.you, 'a');
  assert.equal(r.start.resumed, true);
  assert.equal(r.start.game, 'gomoku');
  // người xem tải lại: kd:resume không có ván; người chơi thì có
  assert.equal((await call(W.s, 'kd:resume', {})).start, null);
  // đang đấu thì khóa vị trí: gửi move (di chuyển) không đổi chỗ của người chơi B
  // SPEED 0,24/giây: phải chờ hơn 1,6 giây thì nếu không khóa, B mới vượt ngưỡng z > 0,88 và gọi stand (đầu hàng)
  const before = B.s.log.length;
  B.s.emit('move', { x: 0.5, z: 0.9 });
  await sleep(2200);
  assert.equal(B.s.log.slice(before).some(x => x.ev === 'kd:end'), false, 'B không bị đầu hàng');
  assert.equal(B.s.log.slice(before).some(x => x.ev === 'p' && x.payload.some(q => q[0] === B.pid && q[2] > 880)), false);
  const list = await call(W.s, 'kd:tables', {});
  const t2 = list.tables.find(x => x.table === 2);
  assert.equal(t2.status, 'playing', 'ván bàn 2 vẫn chạy');
  assert.equal(t2.seats[1].pid, B.pid, 'B vẫn ở ghế');
});

test('đang xem bàn 1 rồi ngồi bàn 2: thôi nhận gói của bàn 1', async t => {
  const srv = await startServer(); t.after(() => srv.stop());
  const A = await yard(t, srv, 'An', UID.a), B = await yard(t, srv, 'Binh', UID.b), W = await yard(t, srv, 'Xem', UID.w);
  assert.equal((await call(A.s, 'kd:sit', { table: 1, seat: 0 })).ok, true);
  assert.equal((await call(B.s, 'kd:sit', { table: 1, seat: 1 })).ok, true);
  await call(A.s, 'kd:setup', { table: 1, game: 'chess', rated: false, pace: 'fast' });
  const started = waitFor(A.s, 'kd:start');
  await call(A.s, 'kd:ready', { table: 1, ready: true });
  await call(B.s, 'kd:ready', { table: 1, ready: true });
  const sa = await started;
  assert.equal((await call(W.s, 'kd:watch', { table: 1 })).ok, true);
  assert.equal((await call(W.s, 'kd:sit', { table: 2, seat: 0 })).ok, true);
  const before = W.s.log.length;
  assert.equal((await call(A.s, 'kd:move', { gameId: sa.gameId, ply: 0, move: 'e2e4' })).ok, true);
  await sleep(300);
  assert.equal(W.s.log.slice(before).some(x => x.ev === 'kd:moved'), false, 'không còn nhận kd:moved của bàn 1');
});

test('kd:skin (T-110): người chơi đổi skin nửa sân của mình; đối thủ và người xem nhận cùng gói; ảnh chụp ván có skins', async t => {
  const srv = await startServer(); t.after(() => srv.stop());
  const A = await yard(t, srv, 'An', UID.a), B = await yard(t, srv, 'Binh', UID.b), W = await yard(t, srv, 'Xem', UID.w), O = await yard(t, srv, 'Ngoai', UID.o);
  assert.equal((await call(A.s, 'kd:sit', { table: 4, seat: 0 })).ok, true);
  assert.equal((await call(B.s, 'kd:sit', { table: 4, seat: 1 })).ok, true);
  assert.equal((await call(A.s, 'kd:setup', { table: 4, game: 'jieqi', rated: false, pace: 'fast' })).ok, true);
  const started = waitFor(A.s, 'kd:start');
  await call(A.s, 'kd:ready', { table: 4, ready: true });
  await call(B.s, 'kd:ready', { table: 4, ready: true });
  const sa = await started;
  const none = { a: { field: null, pieces: null }, b: { field: null, pieces: null } };
  assert.deepEqual(sa.skins, none, 'ván mới bắt đầu bằng null');
  const watchStart = waitFor(W.s, 'kd:start');
  assert.equal((await call(W.s, 'kd:watch', { table: 4 })).ok, true);
  assert.deepEqual((await watchStart).skins, none);

  // người xem, người ngoài không đổi được; mã lạ thành null; thiếu khóa thì báo lỗi
  assert.equal((await call(W.s, 'kd:skin', { gameId: sa.gameId, field: 'volcano' })).reason, 'Bạn không phải người chơi của ván này.');
  assert.equal((await call(O.s, 'kd:skin', { gameId: sa.gameId, field: 'volcano' })).ok, false);
  assert.equal((await call(A.s, 'kd:skin', { gameId: sa.gameId })).reason, 'Chưa chọn skin.');
  assert.deepEqual(await call(A.s, 'kd:skin', { gameId: sa.gameId, field: '__proto__', pieces: { a: 1 } }), { ok: true, field: null, pieces: null });

  const got = [A, B, W].map(c => waitFor(c.s, 'kd:skin'));
  assert.deepEqual(await call(A.s, 'kd:skin', { gameId: sa.gameId, field: 'volcano', pieces: 'magma' }), { ok: true, field: 'volcano', pieces: 'magma' });
  const expected = { gameId: sa.gameId, side: 'a', field: 'volcano', pieces: 'magma', opened: true };
  for (const p of await Promise.all(got)) assert.deepEqual(p, expected);
  const tooSoon = await call(A.s, 'kd:skin', { gameId: sa.gameId, field: 'river' });
  assert.equal(tooSoon.ok, false); assert.equal(tooSoon.code, 'rate'); assert.ok(Number.isFinite(tooSoon.retryAt));
  assert.equal((await call(B.s, 'kd:skin', { gameId: sa.gameId, pieces: 'jade' })).ok, true);

  const want = { a: { field: 'volcano', pieces: 'magma' }, b: { field: null, pieces: 'jade' } };
  assert.deepEqual((await call(B.s, 'kd:resume', {})).start.skins, want);
  const again = waitFor(W.s, 'kd:start', x => x.resumed && x.skins.b.pieces === 'jade');
  assert.equal((await call(W.s, 'kd:watch', { table: 4 })).ok, true);
  assert.deepEqual((await again).skins, want);

  // không gói nào chứa uid; kd:skin của cờ úp chỉ có mã skin
  const blob = everything(A, B, W, O).join('\n');
  for (const uid of Object.values(UID)) assert.ok(!blob.includes(uid), 'lộ uid ' + uid);
  for (const c of [A, B, W]) for (const x of c.s.log.filter(x => x.ev === 'kd:skin')) {
    assert.deepEqual(Object.keys(x.payload).sort(), ['field', 'gameId', 'opened', 'pieces', 'side']);
  }
  assert.equal(O.s.log.some(x => x.ev === 'kd:skin'), false, 'người ngoài không nhận kd:skin');
});

test('kd:skin: ván caro phát bộ đá cho hai người chơi và người xem', async t => {
  const srv = await startServer(); t.after(() => srv.stop());
  const A = await yard(t, srv, 'An', UID.a), B = await yard(t, srv, 'Binh', UID.b), W = await yard(t, srv, 'Xem', UID.w);
  assert.equal((await call(A.s, 'kd:sit', { table: 2, seat: 0 })).ok, true);
  assert.equal((await call(B.s, 'kd:sit', { table: 2, seat: 1 })).ok, true);
  assert.equal((await call(A.s, 'kd:setup', { table: 2, game: 'gomoku', rated: false, pace: 'fast' })).ok, true);
  const started = waitFor(A.s, 'kd:start');
  await call(A.s, 'kd:ready', { table: 2, ready: true });
  await call(B.s, 'kd:ready', { table: 2, ready: true });
  const start = await started;
  assert.equal((await call(W.s, 'kd:watch', { table: 2 })).ok, true);
  assert.equal((await call(W.s, 'kd:skin', { gameId: start.gameId, pieces: 'cosmos' })).ok, false);
  assert.equal((await call(A.s, 'kd:skin', { gameId: start.gameId, field: 'volcano' })).reason, 'Môn này không có skin sân.');
  const got = [A, B, W].map(client => waitFor(client.s, 'kd:skin'));
  assert.deepEqual(await call(A.s, 'kd:skin', { gameId: start.gameId, field: 'volcano', pieces: 'cosmos' }), { ok: true, field: null, pieces: 'cosmos' });
  const expected = { gameId: start.gameId, side: 'a', field: null, pieces: 'cosmos', opened: false };
  for (const payload of await Promise.all(got)) assert.deepEqual(payload, expected);
  assert.equal((await call(A.s, 'kd:skin', { gameId: start.gameId, pieces: 'forest' })).code, 'rate');
  assert.deepEqual((await call(B.s, 'kd:resume', {})).start.skins.a, { field: null, pieces: 'cosmos' });
});

test('máy chủ khởi động lại giữa ván: kd:resume báo ván bị hủy, không ai bị tính thua', async t => {
  const srv = await startServer(); t.after(() => srv.stop());
  const A = await yard(t, srv, 'An', UID.a), B = await yard(t, srv, 'Binh', UID.b);
  await call(A.s, 'kd:sit', { table: 3, seat: 0 }); await call(B.s, 'kd:sit', { table: 3, seat: 1 });
  await call(A.s, 'kd:setup', { table: 3, game: 'chess', rated: true, pace: 'fast' });
  const started = waitFor(A.s, 'kd:start');
  await call(A.s, 'kd:ready', { table: 3, ready: true }); await call(B.s, 'kd:ready', { table: 3, ready: true });
  await started;
  await sleep(300);          // cho ghi nền kịp ra file
  await srv.restart();
  const A2 = await yard(t, srv, 'An', UID.a);
  const r = await call(A2.s, 'kd:resume', {});
  assert.equal(r.ok, true); assert.equal(r.start, null);
  assert.match(r.message, /bị hủy vì máy chủ khởi động lại/);
  const again = await call(A2.s, 'kd:resume', {});
  assert.equal(again.message, undefined, 'chỉ báo một lần');
});

test('khóa lạ bị bỏ, kd:* giới hạn tần suất', async t => {
  const srv = await startServer(); t.after(() => srv.stop());
  const A = await yard(t, srv, 'An', UID.a);
  assert.equal((await call(A.s, 'kd:sit', { table: '__proto__', seat: 0 })).ok, false);
  assert.equal((await call(A.s, 'kd:sit', { table: 1, seat: 'constructor' })).ok, false);
  assert.equal((await call(A.s, 'kd:setup', { table: 1, game: 'chess', rated: false, pace: 'fast' })).ok, false, 'chưa ngồi, không phải chủ bàn');
  assert.equal((await call(A.s, 'kd:move', { gameId: '__proto__', ply: 0, move: 'e2e4' })).ok, false);
  assert.equal((await call(A.s, 'kd:resign', null)).ok, false);
  await sleep(2500);        // nạp lại thùng đếm
  const burst = await Promise.all(Array.from({ length: 40 }, () => call(A.s, 'kd:tables', {})));
  const limited = burst.filter(r => !r.ok);
  assert.ok(limited.length > 0, 'phải bị giới hạn');
  assert.ok(limited.every(r => r.code === 'rate' && r.reason === 'Bạn thao tác quá nhanh.'));
});

test('KYDAO_ENABLED=0: mọi kd:* trả "Bàn cờ chưa mở."', async t => {
  const srv = await startServer({ KYDAO_ENABLED: '0' }); t.after(() => srv.stop());
  const A = await yard(t, srv, 'An', UID.a);
  assert.deepEqual(A.join.config.kydao, { enabled: false, loginRequired: false, shop: { on: false } });
  for (const ev of ['kd:tables', 'kd:sit', 'kd:resume', 'kd:invite', 'kd:move']) {
    const r = await call(A.s, ev, { table: 1, seat: 0 });
    assert.deepEqual(r, { ok: false, code: 'off', reason: 'Bàn cờ chưa mở.' }, ev);
  }
});

test('bật đăng nhập Google: khách không chọn được ván xếp hạng (code login)', async t => {
  const srv = await startServer({ GOOGLE_CLIENT_ID: 'id-thu', GOOGLE_CLIENT_SECRET: 'bi-mat-thu', AUTH_ORIGIN: 'http://127.0.0.1:1' });
  t.after(() => srv.stop());
  const A = await yard(t, srv, 'An', UID.a);
  assert.deepEqual(A.join.config.kydao, { enabled: true, loginRequired: true, shop: { on: false } });
  await call(A.s, 'kd:sit', { table: 1, seat: 0 });
  const r = await call(A.s, 'kd:setup', { table: 1, game: 'chess', rated: true, pace: 'fast' });
  assert.equal(r.ok, false); assert.equal(r.code, 'login');
  assert.equal((await call(A.s, 'kd:setup', { table: 1, game: 'chess', rated: false, pace: 'fast' })).ok, true, 'giao hữu thì khách vẫn chơi được');
});

test('linkGuest gộp Elo Kỳ Đạo của khách và hoàn tác khi flush lỗi (nối dây trong server.js)', () => {
  // Luồng OAuth thật cần Google nên không chạy được ở đây; hàm gộp và hoàn tác được test ở test/account.test.js.
  // Ở đây kiểm dây nối: linkGuest hủy ván dở của khách, gọi mergeKydaoGuest, và đường hoàn tác gọi lại hàm hoàn tác của nó.
  const src = fs.readFileSync(require('node:path').join(__dirname, '..', 'server.js'), 'utf8');
  const body = src.slice(src.indexOf('function linkGuest('), src.indexOf('const accountOf'));
  const drop = body.indexOf('kydaoDropUser(guest)'), merge = body.indexOf('mergeKydaoGuest(db, guest, uid)');
  assert.ok(drop > 0 && merge > drop, 'phải hủy ván dở của khách trước khi gộp');
  assert.match(body, /const undoKydao = mergeKydaoGuest/);
  const undoAt = body.indexOf('return () => {');
  assert.ok(undoAt > merge && body.slice(undoAt).includes('if (undoKydao) undoKydao();'), 'đường hoàn tác phải gọi undoKydao');
});
