'use strict';
/* Phát danh hiệu (lib/titles.js) và gộp điểm mùa công đức (lib/account.js): logic thuần, thời gian tiêm vào. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { createTitles, LOG_MAX } = require('../lib/titles');
const R = require('../lib/records');
const { mergeMeritSeason } = require('../lib/account');

const DAY = 86400e3;
const T0 = Date.UTC(2026, 10, 10, 5);
const KEY0 = R.seasonKey(T0);
const T1 = T0 + 45 * DAY;                 // chắc chắn sang tháng âm lịch khác
const KEY1 = R.seasonKey(T1);
const TH = { meritHistory: 100, meritSeason: 5, pkHistoryGames: 2, pkSeasonGames: 1, kyGames: 2 };

const mkdb = () => ({ merit: {}, martial: { profiles: {} }, kydao: { ratings: {} }, records: { log: [] } });
function mk(db, extra = {}) {
  const st = { t: T0, id: 0, tickers: [], titles: [], ptt: [], saved: 0 };
  const tt = createTitles({
    db, now: () => st.t, newId: () => ++st.id, thresholds: TH, env: {}, save: () => { st.saved++; },
    emit: { ticker: x => st.tickers.push(x), titles: x => st.titles.push(x), ptt: (u, c) => st.ptt.push([u, c]) },
    ...extra
  });
  return { st, tt };
}
const merit = (db, uid, name, total, key, v, at) => { db.merit[uid] = { name, total, today: 0, day: 'x', season: { key, v, at } }; };

test('KEY0 và KEY1 khác nhau (giả định của các ca dưới)', () => assert.notEqual(KEY0, KEY1));

test('lần tính đầu chỉ ghi nhận: không ticker, không ghi sổ, không ptt/titles', () => {
  const db = mkdb(); merit(db, 'u1', 'An', 500, KEY0, 50, T0);
  const { st, tt } = mk(db);
  assert.deepEqual(tt.recompute().changes, []);
  assert.equal(st.tickers.length, 0); assert.equal(st.titles.length, 0); assert.equal(st.ptt.length, 0);
  assert.equal(db.records.log.length, 0);
  assert.deepEqual(tt.codesOf('u1'), ['merit.history', 'merit.season']);
  assert.deepEqual(tt.snapshot()['merit.history'], { name: 'An', v: 500 });
});

test('đổi chủ: ghi sổ có id, ticker tiếng Việt, ptt cho cả người mất lẫn người được, titles chỉ có tên', () => {
  const db = mkdb(); merit(db, 'u1', 'An', 500, KEY0, 50, T0); merit(db, 'u2', 'Binh', 400, KEY0, 10, T0);
  const { st, tt } = mk(db);
  tt.recompute();
  st.t += 1000; db.merit.u2.total = 600; db.merit.u2.season = { key: KEY0, v: 80, at: st.t };
  tt.recompute();
  assert.deepEqual(tt.codesOf('u2'), ['merit.history', 'merit.season']);
  assert.deepEqual(tt.codesOf('u1'), []);
  assert.equal(st.tickers.length, 1, 'hai danh hiệu cùng hạng mục chỉ một ticker');
  assert.equal(st.tickers[0], 'Binh vừa trở thành Vô Lượng Công Đức.');
  assert.equal(st.titles.length, 1);
  assert.deepEqual(new Set(st.ptt.map(x => x[0])), new Set(['u1', 'u2']));
  assert.deepEqual(st.ptt.find(x => x[0] === 'u1')[1], []);
  const log = db.records.log;
  assert.equal(log.length, 2);
  assert.ok(log.every(x => Number.isInteger(x.id) && x.cat === 'merit' && x.name === 'Binh' && x.at === st.t));
  assert.deepEqual(log.map(x => x.kind).sort(), ['history', 'season']);
  assert.ok(st.saved >= 1);
  assert.ok(!JSON.stringify([st.titles, st.tickers]).includes('u2'), 'không lộ uid');
});

test('ticker tối đa 1 dòng / 5 phút / hạng mục, nhưng vẫn ghi sổ', () => {
  const db = mkdb(); merit(db, 'u1', 'An', 500, KEY0, 0, T0); merit(db, 'u2', 'Binh', 400, KEY0, 0, T0); merit(db, 'u3', 'Cuong', 300, KEY0, 0, T0);
  const { st, tt } = mk(db);
  tt.recompute();
  st.t += 1000; db.merit.u2.total = 600; tt.recompute();
  st.t += 60e3; db.merit.u3.total = 700; tt.recompute();
  assert.equal(st.tickers.length, 1, 'đổi chủ lần hai trong 5 phút không phát ticker');
  assert.equal(db.records.log.filter(x => x.kind === 'history').length, 2);
  st.t += 6 * 60e3; db.merit.u1.total = 800; tt.recompute();
  assert.equal(st.tickers.length, 2);
  assert.equal(st.tickers[1], 'An vừa trở thành Vô Lượng Công Đức.');
});

test('hết mùa: người giữ "hiện tại" của mùa cũ vào sổ (kind season, có season) rồi tính lại', () => {
  const db = mkdb(); merit(db, 'u1', 'An', 500, KEY0, 50, T0); merit(db, 'u2', 'Binh', 400, KEY0, 20, T0);
  db.martial.profiles.p1 = { name: 'Chien', wins: 3, losses: 0, draws: 0, ptsAt: T0, season: { key: KEY0, pts: 9, n: 3, at: T0 } };
  const { st, tt } = mk(db);
  tt.recompute();
  assert.equal(db.records.log.length, 0);
  st.t = T1; tt.recompute();
  const ended = db.records.log.filter(x => x.season === KEY0);
  assert.deepEqual(ended.map(x => [x.cat, x.kind, x.name, x.v]).sort(), [['merit', 'season', 'An', 50], ['pk', 'season', 'Chien', 9]]);
  assert.ok(ended.every(x => Number.isInteger(x.id)));
  assert.deepEqual(tt.codesOf('u1'), ['merit.history'], 'danh hiệu theo mùa đã trống');
  assert.equal(st.tickers.length, 0, 'mất danh hiệu do hết mùa không phát ticker');
  const n = db.records.log.length;
  st.t = T1 + 60e3; tt.recompute();
  assert.equal(db.records.log.length, n, 'không ghi trùng');
  // mùa mới có người dẫn đầu
  merit(db, 'u2', 'Binh', 400, KEY1, 7, T1 + 120e3); st.t = T1 + 120e3; tt.recompute();
  assert.deepEqual(tt.codesOf('u2'), ['merit.season']);
  assert.ok(db.records.log.some(x => x.kind === 'season' && x.name === 'Binh' && x.season === undefined));
});

test('sổ giữ tối đa 300 dòng, id không trùng', () => {
  const db = mkdb(); for (let i = 0; i < 400; i++) db.records.log.push({ id: i + 1, at: 1, cat: 'merit', kind: 'history', name: 'x', v: 1 });
  merit(db, 'u1', 'An', 500, KEY0, 0, T0); merit(db, 'u2', 'Binh', 400, KEY0, 0, T0);
  const { st, tt } = mk(db, { newId: (() => { let i = 1000; return () => ++i; })() });
  tt.recompute(); st.t += 1; db.merit.u2.total = 900; tt.recompute();
  assert.equal(db.records.log.length, LOG_MAX);
  assert.equal(new Set(db.records.log.map(x => x.id)).size, LOG_MAX);
});

test('enabled=false: không tính, không phát, không ghi', () => {
  const db = mkdb(); merit(db, 'u1', 'An', 500, KEY0, 50, T0);
  const { st, tt } = mk(db, { enabled: false });
  tt.recompute(); st.t += 1; db.merit.u1.total = 0; tt.recompute();
  assert.deepEqual(tt.codesOf('u1'), []); assert.deepEqual(tt.snapshot(), {});
  assert.equal(st.tickers.length + st.titles.length + st.ptt.length + db.records.log.length, 0);
});

test('isAccount: khách không giữ danh hiệu công đức', () => {
  const db = mkdb(); merit(db, 'khach-1', 'Khach', 900, KEY0, 90, T0); merit(db, 'google:1', 'Chu', 200, KEY0, 20, T0);
  const { tt } = mk(db, { isAccount: u => u.startsWith('google:') });
  tt.recompute();
  assert.deepEqual(tt.codesOf('khach-1'), []);
  assert.deepEqual(tt.codesOf('google:1'), ['merit.history', 'merit.season']);
});

test('mergeMeritSeason: cùng mùa cộng, khác mùa giữ mùa mới, thiếu một bên thì lấy bên kia, không sửa đầu vào', () => {
  const a = { key: '2026-10', v: 7, at: 100 }, b = { key: '2026-10', v: 10, at: 50 };
  assert.deepEqual(mergeMeritSeason(a, b), { key: '2026-10', v: 17, at: 100 });
  assert.deepEqual(a, { key: '2026-10', v: 7, at: 100 });
  assert.deepEqual(mergeMeritSeason({ key: '2026-09', v: 99, at: 1 }, b), b);
  assert.deepEqual(mergeMeritSeason(a, { key: '2026-09', v: 99, at: 1 }), a);
  assert.deepEqual(mergeMeritSeason(undefined, b), b);
  assert.deepEqual(mergeMeritSeason(a, undefined), a);
  assert.equal(mergeMeritSeason(undefined, undefined), undefined);
  assert.equal(mergeMeritSeason({ v: 1 }, null), undefined);
  assert.deepEqual(mergeMeritSeason({ key: '2025-06', v: 1 }, { key: '2025-06n', v: 2 }), { key: '2025-06n', v: 2 }, 'tháng nhuận sau tháng thường');
});
