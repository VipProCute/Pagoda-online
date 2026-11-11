'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('../lib/records');
const Lunar = require('../public/js/lunar');

const VN = 7 * 3600e3;
// ms của một thời điểm theo giờ Việt Nam (d/m/y h:mi)
const vn = (d, m, y, h = 0, mi = 0) => Date.UTC(y, m - 1, d, h, mi) - VN;
const DAY = 86400e3;
const NOW = vn(10, 11, 2026, 12);
const KEY = R.seasonKey(NOW);
const E = {}; // env rỗng: dùng ngưỡng mặc định

const emptyDb = () => ({ merit: {}, martial: { profiles: {} }, kydao: { ratings: {} }, records: { log: [] } });
const st = (o = {}) => ({ r: 1500, peak: null, peakAt: null, n: 25, w: 10, l: 10, d: 5, last: NOW - DAY, ...o });
const H = (db, now = NOW, opts = {}) => R.holders(db, now, { env: E, ...opts });

/* ---------- seasonKey ---------- */
test('seasonKey: khóa theo tháng âm, đúng định dạng', () => {
  const [ld, lm, ly, leap] = Lunar.toLunar(10, 11, 2026);
  assert.match(R.seasonKey(NOW), /^\d{4}-\d{2}n?$/);
  assert.equal(R.seasonKey(NOW), `${ly}-${String(lm).padStart(2, '0')}${leap ? 'n' : ''}`);
  assert.ok(ld >= 1);
});
test('seasonKey: 00:00 giờ Việt Nam mùng 1 âm là mùa mới, 23:59 hôm trước là mùa cũ', () => {
  const [d, m, y] = Lunar.toSolar(1, 6, 2026, 0);
  const at0 = vn(d, m, y, 0, 0);
  const before = at0 - 60e3;
  assert.notEqual(R.seasonKey(before), R.seasonKey(at0));
  assert.equal(R.seasonKey(at0), '2026-06');
  assert.equal(R.seasonKey(at0 + 20 * DAY), '2026-06');
});
test('seasonKey: tháng nhuận thêm hậu tố n', () => {
  // năm 2025 có tháng 6 nhuận
  const [d, m, y] = Lunar.toSolar(5, 6, 2025, 1);
  assert.equal(R.seasonKey(vn(d, m, y, 9)), '2025-06n');
  const [d2, m2, y2] = Lunar.toSolar(5, 6, 2025, 0);
  assert.equal(R.seasonKey(vn(d2, m2, y2, 9)), '2025-06');
});
test('seasonKey: now sai thì không ném lỗi', () => {
  assert.match(R.seasonKey(NaN), /^\d{4}-\d{2}n?$/);
});

/* ---------- TITLES / priority ---------- */
test('TITLES có đúng 14 mã, mỗi mã có tên, priority liệt kê đủ', () => {
  assert.equal(Object.keys(R.TITLES).length, 14);
  assert.equal(R.priority.length, 14);
  assert.deepEqual([...R.priority].sort(), Object.keys(R.TITLES).sort());
  for (const t of Object.values(R.TITLES)) assert.ok(t.name && t.cat);
  assert.equal(R.priority[0], 'pk.history');
  assert.equal(R.priority[7], 'pk.season');
  assert.equal(R.TITLES['xiangqi.now'].name, 'Kỳ Vương Cờ Tướng');
});

/* ---------- ngưỡng ---------- */
test('thresholds: mặc định, biến môi trường, ghi đè; giá trị sai bị bỏ qua', () => {
  assert.equal(R.thresholds({}, {}).kyGames, 20);
  assert.equal(R.thresholds({}, { TITLE_MIN_GAMES: '5' }).kyGames, 5);
  assert.equal(R.thresholds({ kyGames: 7 }, { TITLE_MIN_GAMES: '5' }).kyGames, 7);
  assert.equal(R.thresholds({}, { TITLE_MIN_GAMES: 'abc' }).kyGames, 20);
  assert.equal(R.thresholds({}, { TITLE_MIN_GAMES: '-3' }).kyGames, 20);
});

/* ---------- holders: công đức ---------- */
test('holders: db rỗng hoặc sai kiểu thì không có ai', () => {
  assert.deepEqual(H(emptyDb()), {});
  assert.deepEqual(H(null), {});
  assert.deepEqual(H({}), {});
});
test('holders: công đức lịch sử cần ≥ 1.000, chọn total cao nhất', () => {
  const db = emptyDb();
  db.merit.a = { name: 'A', total: 999, today: 0, day: '' };
  assert.equal(H(db)['merit.history'], undefined);
  db.merit.b = { name: 'B', total: 1500 };
  db.merit.c = { name: 'C', total: 3000 };
  const h = H(db)['merit.history'];
  assert.equal(h.uid, 'c'); assert.equal(h.name, 'C'); assert.equal(h.v, 3000);
});
test('holders: công đức mùa cần ≥ 100 và đúng khóa mùa hiện tại', () => {
  const db = emptyDb();
  db.merit.a = { name: 'A', total: 50, season: { key: KEY, v: 99 } };
  db.merit.b = { name: 'B', total: 50, season: { key: '1999-01', v: 9999 } };
  assert.equal(H(db)['merit.season'], undefined);
  db.merit.c = { name: 'C', total: 50, season: { key: KEY, v: 120 } };
  assert.equal(H(db)['merit.season'].uid, 'c');
});
test('holders: isAccount loại khách khỏi danh hiệu công đức', () => {
  const db = emptyDb();
  db.merit['khach-1'] = { name: 'K', total: 5000 };
  db.merit['google:1'] = { name: 'G', total: 2000 };
  const h = H(db, NOW, { isAccount: u => u.startsWith('google:') });
  assert.equal(h['merit.history'].uid, 'google:1');
});
test('holders: hòa công đức → ai đạt trước (at nhỏ hơn) giữ', () => {
  const db = emptyDb();
  db.merit.a = { name: 'A', total: 2000, at: 200 };
  db.merit.b = { name: 'B', total: 2000, at: 100 };
  assert.equal(H(db)['merit.history'].uid, 'b');
});
test('holders: hòa hoàn toàn thì ổn định theo uid, không phụ thuộc thứ tự khóa', () => {
  const x = emptyDb(), y = emptyDb();
  x.merit.b = { name: 'B', total: 2000 }; x.merit.a = { name: 'A', total: 2000 };
  y.merit.a = { name: 'A', total: 2000 }; y.merit.b = { name: 'B', total: 2000 };
  assert.equal(H(x)['merit.history'].uid, 'a');
  assert.equal(H(y)['merit.history'].uid, 'a');
});

/* ---------- holders: PK ---------- */
test('holders: PK lịch sử cần ≥ 10 trận, điểm = 3 × thắng + hòa', () => {
  const db = emptyDb();
  db.martial.profiles.a = { name: 'A', wins: 9, losses: 0, draws: 0 }; // 9 trận: chưa đủ
  db.martial.profiles.b = { name: 'B', wins: 3, losses: 5, draws: 4 }; // 12 trận, 13 điểm
  db.martial.profiles.c = { name: 'C', wins: 4, losses: 6, draws: 0 }; // 10 trận, 12 điểm
  const h = H(db)['pk.history'];
  assert.equal(h.uid, 'b'); assert.equal(h.v, 13);
});
test('holders: hòa điểm PK lịch sử → ai đạt điểm trước giữ, thua thêm (pkAt mới hơn) không mất danh hiệu', () => {
  const db = emptyDb();
  db.martial.profiles.a = { name: 'A', wins: 10, losses: 1, draws: 0, ptsAt: 100, pkAt: 300 }; // 30 điểm, vừa thua ở t=300
  db.martial.profiles.b = { name: 'B', wins: 10, losses: 0, draws: 0, ptsAt: 200, pkAt: 200 };
  assert.equal(H(db)['pk.history'].uid, 'a');
});

test('holders: PK mùa cần ≥ 3 trận trong mùa; hồ sơ mùa cũ không tính', () => {
  const db = emptyDb();
  db.martial.profiles.a = { name: 'A', wins: 1, season: { key: KEY, pts: 6, n: 2 } };
  db.martial.profiles.b = { name: 'B', wins: 1, season: { key: '2000-01', pts: 90, n: 30 } };
  assert.equal(H(db)['pk.season'], undefined);
  db.martial.profiles.c = { name: 'C', wins: 1, season: { key: KEY, pts: 4, n: 3 } };
  assert.equal(H(db)['pk.season'].uid, 'c');
});

/* ---------- holders: cờ ---------- */
test('holders: cờ cần ≥ 20 ván xếp hạng; peak → lịch sử, Elo đang có → hiện tại', () => {
  const db = emptyDb();
  db.kydao.ratings.a = { name: 'A', xiangqi: st({ n: 19, r: 2000, peak: 2000, peakAt: 5 }) };
  assert.deepEqual(H(db), {});
  db.kydao.ratings.b = { name: 'B', xiangqi: st({ r: 1600, peak: 1800, peakAt: 50 }) };
  db.kydao.ratings.c = { name: 'C', xiangqi: st({ r: 1700, peak: 1750, peakAt: 40 }) };
  const h = H(db);
  assert.equal(h['xiangqi.history'].uid, 'b'); assert.equal(h['xiangqi.history'].v, 1800);
  assert.equal(h['xiangqi.now'].uid, 'c'); assert.equal(h['xiangqi.now'].v, 1700);
});
test('holders: "hiện tại" của cờ cần ván trong 30 ngày', () => {
  const db = emptyDb();
  db.kydao.ratings.a = { name: 'A', go: st({ r: 1900, peak: 1900, peakAt: 1, last: NOW - 31 * DAY }) };
  db.kydao.ratings.b = { name: 'B', go: st({ r: 1500, peak: 1500, peakAt: 1, last: NOW - 29 * DAY }) };
  const h = H(db);
  assert.equal(h['go.history'].uid, 'a'); // lịch sử không cần hoạt động gần đây
  assert.equal(h['go.now'].uid, 'b');
});
test('holders: peak null (chưa đủ ván khi tính) không cho danh hiệu lịch sử', () => {
  const db = emptyDb();
  db.kydao.ratings.a = { name: 'A', chess: st({ peak: null }) };
  const h = H(db);
  assert.equal(h['chess.history'], undefined);
  assert.equal(h['chess.now'].uid, 'a');
});
test('holders: hòa peak → peakAt sớm hơn giữ; hòa Elo hiện tại → last sớm hơn giữ', () => {
  const db = emptyDb();
  db.kydao.ratings.a = { name: 'A', gomoku: st({ r: 1600, peak: 1700, peakAt: 90, last: NOW - 1000 }) };
  db.kydao.ratings.b = { name: 'B', gomoku: st({ r: 1600, peak: 1700, peakAt: 80, last: NOW - 2000 }) };
  const h = H(db);
  assert.equal(h['gomoku.history'].uid, 'b');
  assert.equal(h['gomoku.now'].uid, 'b');
});
test('holders: 5 môn cờ độc lập, ngưỡng đổi qua opts', () => {
  const db = emptyDb();
  for (const g of R.GAMES) db.kydao.ratings['u-' + g] = { name: g, [g]: st({ n: 5, r: 1500, peak: 1500, peakAt: 1 }) };
  assert.deepEqual(H(db), {});
  const h = H(db, NOW, { thresholds: { kyGames: 5 } });
  assert.equal(Object.keys(h).length, 10);
  assert.equal(h['jieqi.now'].uid, 'u-jieqi');
});

/* ---------- Thiên Hạ Vô Song & nhãn ---------- */
test('titlesByUid + labelOf: giữ cả lịch sử và hiện tại một hạng mục → Thiên Hạ Vô Song', () => {
  const db = emptyDb();
  db.kydao.ratings.a = { name: 'A', xiangqi: st({ r: 2000, peak: 2000, peakAt: 1 }) };
  db.merit.a = { name: 'A', total: 5000 };
  const h = H(db);
  const codes = R.titlesByUid(h).get('a');
  assert.deepEqual(codes, ['xiangqi.history', 'merit.history', 'xiangqi.now']);
  const label = R.labelOf(codes);
  assert.equal(label.crown, true);
  assert.equal(label.name, 'Thiên Hạ Vô Song · Cờ Tướng');
});
test('labelOf: một danh hiệu → tên thường, ưu tiên lịch sử trước hiện tại, danh sách rỗng → null', () => {
  assert.deepEqual(R.labelOf(['merit.season', 'pk.season']), { code: 'pk.season', name: 'Đương Kim Minh Chủ', crown: false });
  assert.equal(R.labelOf(['go.now', 'merit.history']).code, 'merit.history');
  assert.equal(R.labelOf([]), null);
  assert.equal(R.labelOf(['khong-co']), null);
});

/* ---------- diff ---------- */
test('diff: đổi chủ, mất chủ, có chủ mới; cùng uid đổi điểm thì không tính', () => {
  const prev = { 'pk.history': { uid: 'a', v: 10 }, 'go.now': { uid: 'b', v: 5 }, 'merit.history': { uid: 'c', v: 7 } };
  const next = { 'pk.history': { uid: 'x', v: 11 }, 'go.now': { uid: 'b', v: 9 }, 'chess.now': { uid: 'd', v: 1 } };
  const d = R.diff(prev, next);
  const by = Object.fromEntries(d.map(x => [x.code, x]));
  assert.equal(by['pk.history'].from.uid, 'a'); assert.equal(by['pk.history'].to.uid, 'x');
  assert.equal(by['go.now'], undefined);
  assert.equal(by['merit.history'].to, null);
  assert.equal(by['chess.now'].from, null);
  assert.equal(d.length, 3);
});
test('diff: hai ảnh chụp giống nhau hoặc đầu vào rỗng thì không có thay đổi', () => {
  assert.deepEqual(R.diff({}, {}), []);
  assert.deepEqual(R.diff(null, undefined), []);
  const s = { 'pk.history': { uid: 'a', v: 1 } };
  assert.deepEqual(R.diff(s, structuredClone(s)), []);
});

/* ---------- hồ sơ cũ thiếu trường, hiệu năng ---------- */
test('holders: hồ sơ cũ thiếu trường hoặc sai kiểu vẫn chạy', () => {
  const db = {
    merit: { a: null, b: 5, c: { total: 'x' }, d: { name: 7, total: 1200 } },
    martial: { profiles: { a: null, b: { wins: '9' }, c: {} } },
    kydao: { ratings: { a: null, b: 3, c: { xiangqi: null, go: { n: 'x' } } } }
  };
  const h = H(db);
  assert.equal(h['merit.history'].uid, 'd');
  assert.equal(h['merit.history'].name, '');
  assert.equal(Object.keys(h).length, 1);
});
test('holders: 10.000 hồ sơ mỗi loại tính dưới 50 ms', () => {
  const db = emptyDb();
  for (let i = 0; i < 10000; i++) {
    const u = 'u' + i;
    db.merit[u] = { name: u, total: i, season: { key: KEY, v: i } };
    db.martial.profiles[u] = { name: u, wins: i % 50, losses: 3, draws: 1, season: { key: KEY, pts: i % 70, n: 4 } };
    db.kydao.ratings[u] = { name: u, xiangqi: st({ r: 1000 + (i % 900), peak: 1000 + (i % 900), peakAt: i }), chess: st({ r: 1200 + (i % 500) }) };
  }
  H(db); // làm nóng
  const t0 = process.hrtime.bigint();
  const h = H(db);
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  assert.ok(h['merit.history']);
  assert.ok(ms < 50, `mất ${ms.toFixed(1)} ms`);
});
