'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../lib/kydao/elo');

/*
 * Mười ca tính tay (KH §5.6, D6). Mỗi ca ghi công thức đã làm tròn ở tên và ở dòng "Tính:".
 * expected(A) = 1 / (1 + 10^((Rđối − Rmình) / 400)); mới = cũ + K × (điểm − expected); làm tròn; sàn 100.
 * K: 40 nếu n < 20; 20 nếu Elo < 2000; 10 nếu từ 2000. n và Elo là số TRƯỚC ván.
 */

test('ca 1: ngang nhau 1200/1200 (n = 0), A thắng → 1220 và 1180', () => {
  // Tính: expected = 1/(1+10^0) = 0,5; K = 40 cho cả hai; A: 1200 + 40×(1−0,5) = 1220; B: 1200 + 40×(0−0,5) = 1180.
  assert.deepEqual(E.update({ ra: 1200, rb: 1200, na: 0, nb: 0, score: 1 }), { ra: 1220, rb: 1180, ka: 40, kb: 40 });
});

test('ca 2: ngang nhau 1200/1200 (n = 0), hòa → không đổi', () => {
  // Tính: expected = 0,5; A: 1200 + 40×(0,5−0,5) = 1200; B tương tự = 1200.
  const r = E.update({ ra: 1200, rb: 1200, na: 0, nb: 0, score: 0.5 });
  assert.equal(r.ra, 1200);
  assert.equal(r.rb, 1200);
});

test('ca 3: đánh bại kẻ mạnh 1200 (n = 0) thắng 2000 (n = 20)', () => {
  // Tính: E_A = 1/(1+10^2) = 1/101 = 0,0099010; K_A = 40 (n < 20).
  //   A: 1200 + 40×(1−0,0099010) = 1200 + 39,604 = 1239,604 → 1240.
  // E_B = 0,9900990; K_B = 10 (n ≥ 20 và Elo từ 2000). B: 2000 + 10×(0−0,9900990) = 1990,099 → 1990.
  assert.deepEqual(E.update({ ra: 1200, rb: 2000, na: 0, nb: 20, score: 1 }), { ra: 1240, rb: 1990, ka: 40, kb: 10 });
});

test('ca 4: chênh 400 điểm, A (1200, n = 5) thắng B (1600, n = 30)', () => {
  // Tính: E_A = 1/(1+10^1) = 1/11 = 0,0909091; K_A = 40 (n < 20).
  //   A: 1200 + 40×(1−0,0909091) = 1200 + 36,364 = 1236,364 → 1236.
  // E_B = 0,9090909; K_B = 20 (n ≥ 20, Elo dưới 2000). B: 1600 + 20×(0−0,9090909) = 1581,818 → 1582.
  assert.deepEqual(E.update({ ra: 1200, rb: 1600, na: 5, nb: 30, score: 1 }), { ra: 1236, rb: 1582, ka: 40, kb: 20 });
});

test('ca 5: sàn 100 — A (100, n = 0) thua B (100, n = 0)', () => {
  // Tính: E = 0,5; K = 40. A: 100 + 40×(0−0,5) = 80 → sàn 100. B: 100 + 40×(1−0,5) = 120.
  assert.deepEqual(E.update({ ra: 100, rb: 100, na: 0, nb: 0, score: 0 }), { ra: 100, rb: 120, ka: 40, kb: 40 });
});

test('ca 6: K = 10 từ 2000 — 2100 (n = 50) thắng 2100 (n = 50)', () => {
  // Tính: E = 0,5; K = 10 cho cả hai. A: 2100 + 10×0,5 = 2105; B: 2100 − 10×0,5 = 2095.
  assert.deepEqual(E.update({ ra: 2100, rb: 2100, na: 50, nb: 50, score: 1 }), { ra: 2105, rb: 2095, ka: 10, kb: 10 });
});

test('ca 7: ranh giới K — 1999 (n = 20) thắng 1999 (n = 20)', () => {
  // Tính: n = 20 không còn dưới 20; Elo 1999 dưới 2000 → K = 20. E = 0,5.
  // A: 1999 + 20×0,5 = 2009; B: 1999 − 20×0,5 = 1989.
  assert.deepEqual(E.update({ ra: 1999, rb: 1999, na: 20, nb: 20, score: 1 }), { ra: 2009, rb: 1989, ka: 20, kb: 20 });
});

test('ca 8: ưu tiên luật n < 20 — 2100 (n = 5) thắng 2100 (n = 50)', () => {
  // Tính: A dưới 20 ván → K = 40 dù Elo từ 2000; B K = 10. E = 0,5.
  // A: 2100 + 40×0,5 = 2120; B: 2100 − 10×0,5 = 2095.
  assert.deepEqual(E.update({ ra: 2100, rb: 2100, na: 5, nb: 50, score: 1 }), { ra: 2120, rb: 2095, ka: 40, kb: 10 });
});

test('ca 9: bên mạnh hơn thắng — 1400 thắng 1200 (đều n = 30)', () => {
  // Tính: E_A = 1/(1+10^(−0,5)) = 0,7597469; K = 20 (n ≥ 20, Elo dưới 2000).
  //   A: 1400 + 20×(1−0,7597469) = 1400 + 4,805 = 1404,805 → 1405.
  // E_B = 0,2402531; B: 1200 + 20×(0−0,2402531) = 1195,195 → 1195.
  assert.deepEqual(E.update({ ra: 1400, rb: 1200, na: 30, nb: 30, score: 1 }), { ra: 1405, rb: 1195, ka: 20, kb: 20 });
});

test('ca 10: hòa khi A yếu hơn — 1000 hòa 1200 (đều n = 30)', () => {
  // Tính: E_A = 1/(1+10^0,5) = 0,2402531; K = 20.
  //   A: 1000 + 20×(0,5−0,2402531) = 1000 + 5,195 = 1005,195 → 1005.
  // E_B = 0,7597469; B: 1200 + 20×(0,5−0,7597469) = 1200 − 5,195 = 1194,805 → 1195.
  assert.deepEqual(E.update({ ra: 1000, rb: 1200, na: 30, nb: 30, score: 0.5 }), { ra: 1005, rb: 1195, ka: 20, kb: 20 });
});

test('K theo n và Elo: n < 20 luôn 40; từ 20 ván: dưới 2000 là 20, từ 2000 là 10', () => {
  assert.equal(E.kFactor(0, 100), 40);
  assert.equal(E.kFactor(19, 2500), 40);
  assert.equal(E.kFactor(20, 1999), 20);
  assert.equal(E.kFactor(20, 2000), 10);
  assert.equal(E.kFactor(500, 3000), 10);
});

test('update không ném lỗi với đầu vào thiếu hoặc lạ; kết quả luôn là số nguyên', () => {
  const r = E.update();
  assert.deepEqual(r, { ra: 1200, rb: 1200, ka: 40, kb: 40 });
  const odd = E.update({ ra: 'abc', rb: null, na: -3, nb: NaN, score: 7 });
  for (const k of ['ra', 'rb']) assert.ok(Number.isInteger(odd[k]) && odd[k] >= E.FLOOR, k + ' = ' + odd[k]);
});

test('eligible: không xếp hạng, không phải tài khoản, thiếu nước, cặp đủ 3 ván thì không tính Elo', () => {
  const ok = { rated: true, aIsAccount: true, bIsAccount: true, plies: 10, minPlies: 4, pairToday: 0 };
  assert.deepEqual(E.eligible(ok), { ok: true });

  const giaoHuu = E.eligible({ ...ok, rated: false });
  assert.deepEqual(giaoHuu, { ok: true }, 'giao hữu luôn được');

  const khachGoogleBat = E.eligible({ ...ok, bIsAccount: false });
  assert.equal(khachGoogleBat.ok, false);
  assert.match(khachGoogleBat.reason, /tài khoản/);

  const thieuNuoc = E.eligible({ ...ok, plies: 3 });
  assert.equal(thieuNuoc.ok, false);
  assert.match(thieuNuoc.reason, /số nước/);
  assert.deepEqual(E.eligible({ ...ok, plies: 4 }), { ok: true }, 'đủ đúng số nước tối thiểu thì được');

  const capNgay = E.eligible({ ...ok, pairToday: 2 });
  assert.deepEqual(capNgay, { ok: true }, 'đã có 2 ván thì ván thứ 3 vẫn được');
  const quaCap = E.eligible({ ...ok, pairToday: 3 });
  assert.equal(quaCap.ok, false);
  assert.match(quaCap.reason, /3 ván/);
});

test('eligible: Google tắt - bỏ qua kiểm tra tài khoản, vẫn kiểm nước tối thiểu và cặp/ngày', () => {
  const tat = { rated: true, aIsAccount: false, bIsAccount: false, plies: 10, minPlies: 4, pairToday: 0, googleEnabled: false };
  assert.deepEqual(E.eligible(tat), { ok: true }, 'hai khách, đủ nước, cặp chưa quá 3 ván → được');

  const thieuNuoc = E.eligible({ ...tat, plies: 3 });
  assert.equal(thieuNuoc.ok, false);
  assert.match(thieuNuoc.reason, /số nước/);

  const quaCap = E.eligible({ ...tat, pairToday: 3 });
  assert.equal(quaCap.ok, false);
  assert.match(quaCap.reason, /3 ván/);

  assert.deepEqual(E.eligible({ ...tat, rated: false }), { ok: true }, 'giao hữu vẫn được');
});

test('eligible: Google bật - một bên là khách thì từ chối; hai tài khoản thì được', () => {
  const bat = { rated: true, aIsAccount: true, bIsAccount: true, plies: 10, minPlies: 4, pairToday: 0, googleEnabled: true };
  assert.deepEqual(E.eligible(bat), { ok: true });
  const khach = E.eligible({ ...bat, bIsAccount: false });
  assert.equal(khach.ok, false);
  assert.match(khach.reason, /tài khoản/);
});

test('eligible: minPlies không hợp lệ', () => {
  // minPlies là số âm
  const minPliesAm = E.eligible({
    rated: true,
    aIsAccount: true,
    bIsAccount: true,
    plies: 10,
    minPlies: -1,
    pairToday: 0
  });
  assert.equal(minPliesAm.ok, false);
  assert.match(minPliesAm.reason, /không hợp lệ/);

  // minPlies là số thập phân
  const minPliesThapPhan = E.eligible({
    rated: true,
    aIsAccount: true,
    bIsAccount: true,
    plies: 10,
    minPlies: 4.5,
    pairToday: 0
  });
  assert.equal(minPliesThapPhan.ok, false);
  assert.match(minPliesThapPhan.reason, /không hợp lệ/);

  // minPlies là chuỗi
  const minPliesChuoi = E.eligible({
    rated: true,
    aIsAccount: true,
    bIsAccount: true,
    plies: 10,
    minPlies: 'abc',
    pairToday: 0
  });
  assert.equal(minPliesChuoi.ok, false);
  assert.match(minPliesChuoi.reason, /không hợp lệ/);
});

test('eligible: thứ tự kiểm — không xếp hạng báo trước, dù các điều kiện khác cũng không đạt', () => {
  const r = E.eligible({ rated: false, aIsAccount: false, bIsAccount: false, plies: 0, minPlies: 4, pairToday: 9 });
  assert.deepEqual(r, { ok: true }, 'giao hữu luôn được, không cần kiểm tra điều kiện khác');
});

test('peak chỉ đổi khi n ≥ 20; tạm tính khi n < 10', () => {
  let s = E.newStat();
  assert.equal(s.peak, null);
  // 19 ván đầu, Elo lên tới 1400 nhưng peak chưa đổi.
  for (let i = 1; i <= 19; i++) s = E.applyResult(s, { newR: 1200 + i * 10, score: 1, now: 1000 + i });
  assert.equal(s.n, 19);
  assert.equal(s.r, 1390);
  assert.equal(s.peak, null, 'n = 19 thì peak vẫn chưa đổi');
  assert.equal(s.peakAt, null);

  // Ván thứ 20 (Elo mới 1300, thua) làm n = 20 nên peak được ghi nhận lần đầu: 1300.
  s = E.applyResult(s, { newR: 1300, score: 0, now: 2000 });
  assert.equal(s.n, 20);
  assert.equal(s.peak, 1300);
  assert.equal(s.peakAt, 2000);
  assert.equal(s.l, 1);

  // Elo thấp hơn peak không làm peak đổi.
  s = E.applyResult(s, { newR: 1250, score: 0, now: 3000 });
  assert.equal(s.peak, 1300);
  assert.equal(s.peakAt, 2000);

  // Elo cao hơn peak sau ván 20 phải cập nhật peak mới.
  s = E.applyResult(s, { newR: 1400, score: 1, now: 4000 });
  assert.equal(s.peak, 1400);
  assert.equal(s.peakAt, 4000);

  assert.equal(E.isProvisional(0), true);
  assert.equal(E.isProvisional(9), true);
  assert.equal(E.isProvisional(10), false);
});

test('applyResult không sửa hồ sơ cũ và đếm thắng/hòa/thua đúng', () => {
  const s0 = E.newStat();
  const frozen = JSON.stringify(s0);
  const s1 = E.applyResult(s0, { newR: 1220, score: 1, now: 10 });
  const s2 = E.applyResult(s1, { newR: 1200, score: 0.5, now: 20 });
  const s3 = E.applyResult(s2, { newR: 1180, score: 0, now: 30 });
  assert.equal(JSON.stringify(s0), frozen, 'hồ sơ khởi đầu không đổi');
  assert.deepEqual([s3.n, s3.w, s3.d, s3.l, s3.r, s3.last], [3, 1, 1, 1, 1180, 30]);
});
