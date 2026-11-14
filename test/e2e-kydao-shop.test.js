'use strict';
/*
 * Cửa hàng skin Kỳ Đạo qua máy chủ thật (T-171): khóa skin, cúng dường để mở, duyệt (tự xác nhận / admin / webhook SePay),
 * mở khóa idempotent, khởi động lại giữa chừng, không lộ uid. Đặc tả: docs/ky-dai/T-170-DAC-TA-KHOA-SKIN.md.
 */
const test = require('node:test');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { startServer } = require('./helpers/live');
const { connect, call, join, waitFor, sleep } = require('./helpers/client');

const BANK = { BANK_ID: '970436', BANK_ACCOUNT: '0123456789', BANK_ACCOUNT_NAME: 'CHUA' };
const UID = { a: 'shop-uid-an-00000001', b: 'shop-uid-binh-0000001' };
const WRONG = 'sai-ma-quan-tri';

async function open(t, srv, name, uid) {
  const s = await connect(srv.port);
  t.after(() => s.close());
  const j = await join(s, name, uid);
  assert.equal(j.ok, true);
  assert.equal((await call(s, 'scene', 'yard')).ok, true);
  return { s, pid: j.you, join: j };
}

/** A ngồi ghế 0, B ghế 1 bàn 1, mở ván cờ vua giao hữu; A đi nước đầu để ván không bị hủy vì "không đi". */
async function startGame(A, B) {
  assert.equal((await call(A.s, 'kd:sit', { table: 1, seat: 0 })).ok, true);
  assert.equal((await call(B.s, 'kd:sit', { table: 1, seat: 1 })).ok, true);
  assert.equal((await call(A.s, 'kd:setup', { table: 1, game: 'chess', rated: false, pace: 'fast' })).ok, true);
  const sa = waitFor(A.s, 'kd:start');
  assert.equal((await call(A.s, 'kd:ready', { table: 1, ready: true })).ok, true);
  assert.equal((await call(B.s, 'kd:ready', { table: 1, ready: true })).ok, true);
  const start = await sa;
  assert.equal((await call(A.s, 'kd:move', { gameId: start.gameId, ply: 0, move: 'e2e4' })).ok, true);
  return start.gameId;
}

const ownedIncludes = key => st => Array.isArray(st.owned) && st.owned.includes(key);

test('đổi giá khi đang có khoản chờ: mức hạ thì theo mức mới, mức tăng thì giữ mã cũ, cùng mã', async t => {
  const srv = await startServer({ DONATION_MODE: 'live', ...BANK, SEPAY_API_KEY: '' });
  t.after(() => srv.stop());
  assert.equal((await srv.admin('/api/admin/kydao-shop', 'POST', { on: true, price: 20000 })).status, 200);
  const A = await open(t, srv, 'Dao Huu A', UID.a);
  const first = await call(A.s, 'kd:shop:buy', { kind: 'field', id: 'forest' });
  assert.equal(first.ok, true); assert.equal(first.amount, 20000);
  assert.equal((await srv.admin('/api/admin/kydao-shop', 'POST', { price: 30000 })).status, 200);
  const again = await call(A.s, 'kd:shop:buy', { kind: 'field', id: 'forest' });
  assert.equal(again.ok, true); assert.equal(again.amount, 20000); assert.equal(again.code, first.code);
  assert.equal((await srv.admin('/api/admin/kydao-shop', 'POST', { price: 15000 })).status, 200);
  const lower = await call(A.s, 'kd:shop:buy', { kind: 'field', id: 'forest' });
  assert.equal(lower.ok, true); assert.equal(lower.amount, 15000); assert.equal(lower.code, first.code);
});

test('khóa skin: tắt thì tự do; bật cần giá; gỡ skin đang dùng; mua, tự duyệt, mở đúng skin, người khác vẫn khóa, không lộ uid, còn sau khi khởi động lại', async t => {
  const srv = await startServer({ DONATION_MODE: 'test', ...BANK, SEPAY_API_KEY: '' });
  t.after(() => srv.stop());
  const A = await open(t, srv, 'Dao Huu A', UID.a), B = await open(t, srv, 'Dao Huu B', UID.b);

  // cửa hàng tắt: config báo tắt, trạng thái đẩy lúc vào phòng, kd:skin tự do, mua bị từ chối
  assert.deepEqual(A.join.config.kydao.shop, { on: false });
  const first = A.s.log.find(x => x.ev === 'kd:shop:state').payload;
  assert.deepEqual(first, { ok: true, on: false, price: null, prices: {}, owned: [] });
  const gameId = await startGame(A, B);
  assert.equal((await call(A.s, 'kd:skin', { gameId, field: 'volcano', pieces: 'magma' })).ok, true);
  assert.equal((await call(B.s, 'kd:skin', { gameId, field: 'ocean' })).ok, true);
  const off = await call(A.s, 'kd:shop:buy', { kind: 'field', id: 'river' });
  assert.equal(off.ok, false); assert.equal(off.code, 'off'); assert.ok(off.reason);

  // quản trị: sai mã, bật không có giá, giá xấu, khóa lạ
  assert.equal((await srv.admin('/api/admin/kydao-shop', 'GET', undefined, WRONG)).status, 401);
  assert.equal((await srv.admin('/api/admin/kydao-shop', 'POST', { on: true }, WRONG)).status, 401);
  const noPrice = await srv.admin('/api/admin/kydao-shop', 'POST', { on: true });
  assert.equal(noPrice.status, 400); assert.equal(noPrice.json.ok, false);
  for (const price of [5000, 12345.5, '50000', null, 2e9]) {
    const bad = await srv.admin('/api/admin/kydao-shop', 'POST', { on: true, price });
    assert.equal(bad.status, 400, JSON.stringify(price));
  }
  const view = await srv.admin('/api/admin/kydao-shop');
  assert.equal(view.status, 200);
  assert.deepEqual(view.json.config, { on: false, price: null, prices: {} });
  assert.deepEqual(view.json.stats, { owners: 0, unlocks: 0 });
  assert.ok(view.json.catalog.field.some(x => x.id === 'river' && x.name));
  assert.ok(view.json.catalog.pieces.length > 0 && view.json.catalog.stones.length > 0);
  assert.equal((await call(A.s, 'kd:skin', { gameId, field: 'volcano' })).ok, true, 'cấu hình lỗi không làm đổi gì (vẫn dùng được skin)');

  // đặt giá rồi bật: ván đang chơi bị gỡ skin của cả hai bên, mọi người nhận trạng thái mới
  const gone = [waitFor(A.s, 'kd:skin', p => p.side === 'b' && p.field === null), waitFor(B.s, 'kd:skin', p => p.side === 'a' && p.pieces === null && p.field === null)];
  const pushed = waitFor(B.s, 'kd:shop:state', st => st.on === true);
  const on = await srv.admin('/api/admin/kydao-shop', 'POST', { on: true, price: 50000, prices: { 'pieces:magma': 80000, __proto__: { x: 1 }, 'field:khong-co': 9999999 }, bogus: 1 });
  assert.equal(on.status, 200); assert.equal(on.json.ok, true);
  assert.deepEqual(on.json.config, { on: true, price: 50000, prices: { 'pieces:magma': 80000 } });
  assert.ok(on.json.removed >= 2, 'gỡ skin của cả hai bên');
  await Promise.all(gone);
  assert.deepEqual(await pushed, { ok: true, on: true, price: 50000, prices: { 'pieces:magma': 80000 }, owned: [] });
  const audit = await srv.admin('/api/admin/audit');
  assert.ok(audit.json.audit.some(x => x.action === 'kydao-shop.config'));
  assert.equal((await call(A.s, 'kd:shop:state', {})).on, true);

  // skin chưa mở: bị từ chối, có giá (mức riêng đè mức chung)
  const lockedField = await call(A.s, 'kd:skin', { gameId, field: 'river' });
  assert.equal(lockedField.ok, false); assert.equal(lockedField.code, 'locked');
  assert.equal(lockedField.kind, 'field'); assert.equal(lockedField.id, 'river'); assert.equal(lockedField.price, 50000);
  const lockedPieces = await call(A.s, 'kd:skin', { gameId, pieces: 'magma' });
  assert.equal(lockedPieces.code, 'locked'); assert.equal(lockedPieces.price, 80000);
  assert.equal((await call(A.s, 'kd:skin', { gameId, field: null })).ok, true, 'về mặc định luôn được');

  // mua: lấy giá của máy chủ dù client gửi amount khác; kind/id lạ bị từ chối; gọi lại trả cùng khoản
  for (const bad of [{ kind: 'xyz', id: 'river' }, { kind: 'field', id: '__proto__' }, { kind: 'field', id: 'khong-co' }, { kind: 'field' }, { id: 'river' }, { kind: ['field'], id: 'river' }]) {
    const r = await call(A.s, 'kd:shop:buy', bad);
    assert.equal(r.ok, false, JSON.stringify(bad)); assert.ok(r.reason);
  }
  await sleep(2000);       // bộ đếm kd (5 lượt/giây, tối đa 15) đã dùng nhiều: chờ nạp lại
  const paid = waitFor(A.s, 'donation:ok', () => true, 20000);
  const unlocked = waitFor(A.s, 'kd:shop:state', ownedIncludes('field:river'), 20000);
  const buy = await call(A.s, 'kd:shop:buy', { kind: 'field', id: 'river', amount: 10000, price: 1 });
  assert.equal(buy.ok, true); assert.equal(buy.kind, 'field'); assert.equal(buy.id, 'river');
  assert.equal(buy.amount, 50000);
  assert.equal(buy.test, true); assert.ok(buy.code && buy.confirmAt > Date.now() - 1000);
  const qr = new URL(buy.qr);
  assert.equal(qr.hostname, 'img.vietqr.io'); assert.equal(qr.searchParams.get('amount'), '50000'); assert.equal(qr.searchParams.get('addInfo'), buy.code);
  const again = await call(A.s, 'kd:shop:buy', { kind: 'field', id: 'river' });
  assert.equal(again.ok, true); assert.equal(again.code, buy.code, 'không tạo khoản trùng');
  const list = await srv.admin('/api/admin/summary');
  const rec = list.json.donations.find(x => x.code === buy.code);
  assert.equal(rec.purpose, 'skin'); assert.deepEqual(rec.item, { kind: 'field', id: 'river' }); assert.equal(rec.amount, 50000); assert.equal(rec.status, 'pending');
  assert.equal(list.json.donations.filter(x => x.purpose === 'skin').length, 1);

  // chưa duyệt thì vẫn khóa; duyệt (tự xác nhận sau 10 giây) thì nhận trạng thái mới, vẫn là cúng dường thường (công đức)
  assert.equal((await call(A.s, 'kd:skin', { gameId, field: 'river' })).code, 'locked');
  const state = await unlocked;
  assert.deepEqual(state.owned, ['field:river']);
  const ok = await paid;
  assert.equal(ok.amount, 50000); assert.ok(ok.merit > 0);
  assert.deepEqual(await call(A.s, 'kd:skin', { gameId, field: 'river' }), { ok: true, field: 'river', pieces: null });
  // người khác vẫn bị khóa và không nhận trạng thái sở hữu của A
  assert.equal((await call(B.s, 'kd:skin', { gameId, field: 'river' })).code, 'locked');
  assert.deepEqual((await call(B.s, 'kd:shop:state', {})).owned, []);

  // admin bấm xác nhận lại: không lỗi, không đổi gì
  const re = await srv.admin(`/api/admin/donations/${buy.code}/confirm`, 'POST');
  assert.equal(re.status, 200); assert.equal(re.json.already, true); assert.equal(re.json.outcome, 'granted');
  assert.deepEqual((await call(A.s, 'kd:shop:state', {})).owned, ['field:river']);
  assert.equal((await call(A.s, 'kd:shop:buy', { kind: 'field', id: 'river' })).code, 'owned', 'đã sở hữu thì không mua nữa');
  const after = await srv.admin('/api/admin/kydao-shop');
  assert.deepEqual(after.json.stats, { owners: 1, unlocks: 1 });
  const sum = await srv.admin('/api/admin/summary');
  assert.equal(sum.json.donations.find(x => x.code === buy.code).outcome, 'granted');

  // không lộ uid / danh sách sở hữu của người này cho người kia
  for (const x of B.s.log) {
    const json = JSON.stringify(x.payload);
    assert.ok(!json.includes(UID.a) && !json.includes(UID.b), x.ev);
  }
  for (const x of B.s.log.filter(y => y.ev === 'kd:shop:state')) assert.deepEqual(x.payload.owned, [], 'B không nhận owned của A');

  // khởi động lại: vẫn sở hữu; vào phòng nhận ngay trạng thái của mình
  A.s.close(); B.s.close();
  await srv.restart();
  const A2 = await open(t, srv, 'Dao Huu A', UID.a), B2 = await open(t, srv, 'Dao Huu B', UID.b);
  assert.deepEqual(A2.s.log.find(x => x.ev === 'kd:shop:state').payload.owned, ['field:river']);
  assert.deepEqual(B2.s.log.find(x => x.ev === 'kd:shop:state').payload.owned, []);
  assert.equal(A2.join.config.kydao.shop.on, true);
});

test('khóa skin: khởi động lại máy chủ khi khoản đang chờ, khoản chờ nạp lại rồi tự xác nhận và mở đúng một lần', async t => {
  const srv = await startServer({ DONATION_MODE: 'test', ...BANK, SEPAY_API_KEY: '' });
  t.after(() => srv.stop());
  assert.equal((await srv.admin('/api/admin/kydao-shop', 'POST', { on: true, price: 20000 })).status, 200);
  let A = await open(t, srv, 'Dao Huu A', UID.a);
  const buy = await call(A.s, 'kd:shop:buy', { kind: 'stones', id: 'cosmos' });
  assert.equal(buy.ok, true); assert.equal(buy.amount, 20000);
  assert.ok(fs.readFileSync(srv.dataFile, 'utf8').includes(buy.code), 'mã đã được ghi bền trước khi trả QR (await store.flush)');
  A.s.close();
  await srv.restart();       // mã đã được ghi bền trước khi trả QR nên còn nguyên sau khi tắt máy chủ
  A = await open(t, srv, 'Dao Huu A', UID.a);
  assert.deepEqual(A.s.log.find(x => x.ev === 'kd:shop:state').payload.owned, []);
  const state = await waitFor(A.s, 'kd:shop:state', ownedIncludes('stones:cosmos'), 20000);
  assert.deepEqual(state.owned, ['stones:cosmos']);
  const summary = await srv.admin('/api/admin/summary');
  const mine = summary.json.donations.filter(x => x.purpose === 'skin');
  assert.equal(mine.length, 1); assert.equal(mine[0].status, 'confirmed'); assert.equal(mine[0].outcome, 'granted'); assert.equal(mine[0].code, buy.code);
  await sleep(300);
  assert.deepEqual((await call(A.s, 'kd:shop:state', {})).owned, ['stones:cosmos']);
});

test('khóa skin: webhook SePay chỉ tự mở khi nhận đủ tiền; thiếu tiền thì chờ Ban điều hành; hủy khoản không lỗi', async t => {
  const srv = await startServer({ DONATION_MODE: 'live', ...BANK, SEPAY_API_KEY: 'khoa-sepay-thu' });
  t.after(() => srv.stop());
  const hook = (code, amount, ref) => fetch(srv.url + '/api/webhooks/sepay', {
    method: 'POST', headers: { authorization: 'Apikey khoa-sepay-thu', 'content-type': 'application/json' },
    body: JSON.stringify({ transferType: 'in', content: `ck ${code}`, transferAmount: amount, referenceCode: ref })
  }).then(async r => ({ status: r.status, json: await r.json() }));
  assert.equal((await srv.admin('/api/admin/kydao-shop', 'POST', { on: true, price: 30000 })).status, 200);
  const A = await open(t, srv, 'Dao Huu A', UID.a);
  const buy = await call(A.s, 'kd:shop:buy', { kind: 'pieces', id: 'jade' });
  assert.equal(buy.ok, true); assert.equal(buy.amount, 30000); assert.equal(buy.test, false);
  assert.ok(fs.readFileSync(srv.dataFile, 'utf8').includes(buy.code), 'chế độ thật: mã đã ghi bền trước khi trả QR (await store.flush)');

  // thiếu tiền: chỉ ghi nhận, không mở
  const low = await hook(buy.code, 10000, 'REF-LOW');
  assert.equal(low.json.success, true); assert.equal(low.json.matched, true); assert.equal(low.json.manual, true);
  let sum = await srv.admin('/api/admin/summary');
  let rec = sum.json.donations.find(x => x.code === buy.code);
  assert.equal(rec.status, 'pending'); assert.equal(rec.bank.amount, 10000); assert.equal(rec.outcome, undefined);
  assert.deepEqual((await call(A.s, 'kd:shop:state', {})).owned, []);

  // đủ tiền: tự xác nhận và mở; gọi lại cùng mã giao dịch không lỗi, không đổi gì
  const unlocked = waitFor(A.s, 'kd:shop:state', ownedIncludes('pieces:jade'));
  const full = await hook(buy.code, 30000, 'REF-FULL');
  assert.equal(full.status, 200); assert.equal(full.json.matched, true);
  assert.deepEqual((await unlocked).owned, ['pieces:jade']);
  const dup = await hook(buy.code, 30000, 'REF-FULL');
  assert.equal(dup.status, 200); assert.equal(dup.json.success, true);
  assert.deepEqual((await call(A.s, 'kd:shop:state', {})).owned, ['pieces:jade']);
  sum = await srv.admin('/api/admin/summary');
  rec = sum.json.donations.find(x => x.code === buy.code);
  assert.equal(rec.status, 'confirmed'); assert.equal(rec.outcome, 'granted'); assert.equal(rec.paidAmount, 30000);

  // khoản chờ khác: Ban điều hành hủy thì không mở gì, không lỗi; hủy xong mua lại được khoản mới
  await sleep(8100);       // qua giới hạn 8 giây giữa hai lần tạo mã
  const buy2 = await call(A.s, 'kd:shop:buy', { kind: 'field', id: 'desert' });
  assert.equal(buy2.ok, true);
  const cancel = await srv.admin(`/api/admin/donations/${buy2.code}/cancel`, 'POST');
  assert.equal(cancel.status, 200); assert.equal(cancel.json.ok, true);
  assert.deepEqual((await call(A.s, 'kd:shop:state', {})).owned, ['pieces:jade']);
  assert.equal((await call(A.s, 'kd:skin', { gameId: 'khong-co', field: 'desert' })).code, 'stale');

  // Ban điều hành xác nhận khoản thiếu tiền: mở bình thường
  await sleep(8100);       // qua giới hạn 8 giây giữa hai lần tạo mã
  const buy3 = await call(A.s, 'kd:shop:buy', { kind: 'field', id: 'glacier' });
  assert.equal(buy3.ok, true); assert.notEqual(buy3.code, buy2.code);
  assert.equal((await hook(buy3.code, 5000, 'REF-3')).json.manual, true);
  const unlocked3 = waitFor(A.s, 'kd:shop:state', ownedIncludes('field:glacier'));
  const conf = await srv.admin(`/api/admin/donations/${buy3.code}/confirm`, 'POST');
  assert.equal(conf.status, 200); assert.equal(conf.json.outcome, 'granted');
  assert.deepEqual((await unlocked3).owned, ['field:glacier', 'pieces:jade']);
});

test('khóa skin: ghi sổ hỏng khi mua thì không trả QR, khoản vừa tạo bị hủy; ghi lại được thì mua bình thường', async t => {
  const srv = await startServer({ DONATION_MODE: 'live', ...BANK, SEPAY_API_KEY: '' });
  // kho JSON ghi qua file tạm `<db>.tmp` rồi đổi tên: một THƯ MỤC trùng tên file tạm làm lần ghi thất bại (cả Windows lẫn Linux)
  const blocker = srv.dataFile + '.tmp';
  const unblock = () => { try { fs.rmSync(blocker, { recursive: true, force: true }); } catch (e) { /* đã dọn */ } };
  t.after(unblock);                 // chạy trước srv.stop() (after chạy ngược thứ tự đăng ký): kho ghi lại được thì tắt máy chủ êm
  t.after(() => srv.stop());
  assert.equal((await srv.admin('/api/admin/kydao-shop', 'POST', { on: true, price: 20000 })).status, 200);
  const A = await open(t, srv, 'Dao Huu A', UID.a);

  fs.mkdirSync(blocker);
  const bad = await call(A.s, 'kd:shop:buy', { kind: 'field', id: 'forest' });
  assert.equal(bad.ok, false); assert.ok(bad.reason);
  assert.equal(bad.qr, undefined); assert.equal(bad.code, undefined, 'không trả mã chưa ghi bền');
  let sum = await srv.admin('/api/admin/summary');
  let skins = sum.json.donations.filter(x => x.purpose === 'skin');
  assert.equal(skins.length, 1);
  assert.equal(skins[0].status, 'cancelled', 'khoản chưa ghi được không còn chờ');
  assert.equal(skins.filter(x => x.status === 'pending').length, 0);
  assert.deepEqual((await call(A.s, 'kd:shop:state', {})).owned, []);

  // kho ghi được lại: qua nhịp 8 giây, mua tạo mã mới bình thường
  unblock();
  await sleep(8100);
  const ok = await call(A.s, 'kd:shop:buy', { kind: 'field', id: 'forest' });
  assert.equal(ok.ok, true); assert.ok(ok.code && ok.qr);
  assert.notEqual(ok.code, skins[0].code, 'mã mới, không dùng lại khoản đã hủy');
  assert.ok(fs.readFileSync(srv.dataFile, 'utf8').includes(ok.code), 'mã mới đã ghi bền');
  sum = await srv.admin('/api/admin/summary');
  skins = sum.json.donations.filter(x => x.purpose === 'skin');
  assert.equal(skins.filter(x => x.status === 'pending').length, 1);
  assert.equal(skins.find(x => x.status === 'pending').code, ok.code);
});

test('khóa skin: nhịp tạo mã 8 giây, khoản thường và hoàn thành tu luyện không bị ảnh hưởng', async t => {
  const srv = await startServer({ DONATION_MODE: 'test', ...BANK, SEPAY_API_KEY: '' });
  t.after(() => srv.stop());
  assert.equal((await srv.admin('/api/admin/kydao-shop', 'POST', { on: true, price: 10000 })).status, 200);
  const A = await open(t, srv, 'Dao Huu A', UID.a);
  const b1 = await call(A.s, 'kd:shop:buy', { kind: 'field', id: 'forest' });
  assert.equal(b1.ok, true);
  const b2 = await call(A.s, 'kd:shop:buy', { kind: 'field', id: 'lotus' });
  assert.equal(b2.ok, false); assert.equal(b2.code, 'rate');
  const don = await call(A.s, 'donate', { amount: 20000, fund: 'q0' });
  assert.equal(don.ok, true);
  const sum = await srv.admin('/api/admin/summary');
  const normal = sum.json.donations.find(x => x.code === don.code);
  assert.equal(normal.purpose, undefined); assert.equal(normal.item, undefined);
  // tắt cửa hàng: ai cũng dùng được, mua bị từ chối
  assert.equal((await srv.admin('/api/admin/kydao-shop', 'POST', { on: false })).status, 200);
  assert.equal((await call(A.s, 'kd:shop:buy', { kind: 'field', id: 'lotus' })).code, 'off');
});
