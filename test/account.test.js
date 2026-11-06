'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { mergeMartialGuest, donatedBy } = require('../lib/account');
const M = require('../public/js/martial');

const tam = (c = 0, t = 0, n = 0) => ({ cuong: c, toc: t, nhu: n });
function profile(uid, o = {}) {
  return { uid, congLuc: 0, tam: tam(), learned: M.STARTERS.slice(), loadout: [], activeSession: null, activeMatch: null, vouchers: [], wins: 0, losses: 0, draws: 0, dnd: false, blocked: [], createdAt: 1, ...o };
}
const mkdb = () => ({ donations: [], martial: { profiles: {}, sessions: {}, ledger: {}, matches: [], audit: [] } });
const clone = x => JSON.parse(JSON.stringify(x));

test('khách chưa có hồ sơ võ học: không có gì để gộp', () => {
  assert.equal(mergeMartialGuest(mkdb(), 'khach-0001', 'google:abc'), null);
  assert.equal(mergeMartialGuest(mkdb(), 'google:abc', 'google:abc'), null);
  assert.equal(mergeMartialGuest(mkdb(), '__proto__', 'google:abc'), null);
});

test('tài khoản chưa có hồ sơ: hồ sơ khách chuyển nguyên sang, phiên, sổ cộng, yêu cầu hoàn thành ngay đổi chủ', () => {
  const db = mkdb();
  db.martial.profiles['khach-0001'] = profile('khach-0001', { congLuc: 195, tam: tam(100), learned: [...M.STARTERS, 'kim-chung-trao'], loadout: ['thiet-bich', 'trong-quyen', 'tat-phong-quyen', 'nhu-van-bo'], wins: 3, activeSession: 9 });
  db.martial.sessions['9'] = { id: 9, uid: 'khach-0001', status: 'active', methodId: 'tinh-tam-quyet', durationKey: '4h', endsAt: 5 };
  db.martial.sessions['8'] = { id: 8, uid: 'khach-0001', status: 'completed' };
  db.martial.ledger['session:8'] = { uid: 'khach-0001', congLuc: 45, tam: tam() };
  db.donations.push({ code: 'CDAAAAAA', uid: 'khach-0001', purpose: 'speedup', status: 'pending', amount: 10000 });
  db.donations.push({ code: 'CDBBBBBB', uid: 'khach-0001', status: 'confirmed', amount: 20000 });   // cúng dường thường: tra theo accountOf, không đổi uid
  const undo = mergeMartialGuest(db, 'khach-0001', 'google:abc');
  assert.equal(typeof undo, 'function');
  assert.equal(db.martial.profiles['khach-0001'], undefined);
  const p = db.martial.profiles['google:abc'];
  assert.equal(p.uid, 'google:abc');
  assert.equal(p.congLuc, 195);
  assert.equal(p.tam.cuong, 100);
  assert.ok(p.learned.includes('kim-chung-trao'));
  assert.equal(p.wins, 3);
  assert.equal(p.activeSession, 9);
  assert.equal(db.martial.sessions['9'].uid, 'google:abc');
  assert.equal(db.martial.sessions['9'].status, 'active');
  assert.equal(db.martial.ledger['session:8'].uid, 'google:abc');
  assert.equal(db.donations[0].uid, 'google:abc', 'yêu cầu hoàn thành ngay đang chờ theo về tài khoản');
  assert.equal(db.donations[1].uid, 'khach-0001');
});

test('tài khoản đã có hồ sơ: cộng dồn có trần, hợp chiêu đã học, giữ bộ chiêu và phiên đang tu của tài khoản', () => {
  const db = mkdb();
  db.martial.profiles['google:abc'] = profile('google:abc', { congLuc: 2900, tam: tam(290, 0, 5), learned: [...M.STARTERS, 'phan-chan'], loadout: ['phan-chan', 'trong-quyen', 'thiet-bich', 'nhu-van-bo'], wins: 1, activeSession: 20, blocked: [{ uid: 'x1', name: 'X' }], vouchers: [{ id: 1, value: 10000 }] });
  db.martial.profiles['khach-0001'] = profile('khach-0001', { congLuc: 500, tam: tam(50, 20, 0), learned: [...M.STARTERS, 'khinh-than-bo'], loadout: ['khinh-than-bo', 'trong-quyen', 'thiet-bich', 'nhu-van-bo'], wins: 2, losses: 1, draws: 4, activeSession: 21, blocked: [{ uid: 'x1', name: 'X' }, { uid: 'x2', name: 'Y' }], vouchers: [{ id: 2, value: 20000 }] });
  db.martial.sessions['20'] = { id: 20, uid: 'google:abc', status: 'active' };
  db.martial.sessions['21'] = { id: 21, uid: 'khach-0001', status: 'active' };
  mergeMartialGuest(db, 'khach-0001', 'google:abc', 1234);
  const p = db.martial.profiles['google:abc'];
  assert.equal(db.martial.profiles['khach-0001'], undefined);
  assert.equal(p.congLuc, M.CONG_LUC_MAX, 'trần công lực 3.000');
  assert.equal(p.tam.cuong, M.TAM_MAX, 'trần tâm đắc 300');
  assert.equal(p.tam.toc, 20);
  assert.equal(p.tam.nhu, 5);
  assert.ok(p.learned.includes('phan-chan') && p.learned.includes('khinh-than-bo'));
  assert.equal(new Set(p.learned).size, p.learned.length, 'không trùng chiêu');
  assert.deepEqual(p.loadout, ['phan-chan', 'trong-quyen', 'thiet-bich', 'nhu-van-bo'], 'giữ bộ chiêu của tài khoản');
  assert.equal(p.wins, 3); assert.equal(p.losses, 1); assert.equal(p.draws, 4);
  assert.equal(p.vouchers.length, 2);
  assert.deepEqual(p.blocked.map(b => b.uid).sort(), ['x1', 'x2']);
  assert.equal(p.activeSession, 20, 'giữ phiên đang tu của tài khoản');
  assert.equal(db.martial.sessions['21'].status, 'cancelled', 'phiên đang chạy của khách bị hủy vì tài khoản đã có phiên');
  assert.equal(db.martial.sessions['21'].uid, 'google:abc');
  assert.equal(db.martial.sessions['20'].status, 'active');
});

test('hoàn tác trả mọi thứ về như cũ', () => {
  const db = mkdb();
  db.martial.profiles['google:abc'] = profile('google:abc', { congLuc: 100, activeSession: 20 });
  db.martial.profiles['khach-0001'] = profile('khach-0001', { congLuc: 500, activeSession: 21, learned: [...M.STARTERS, 'khinh-than-bo'] });
  db.martial.sessions['20'] = { id: 20, uid: 'google:abc', status: 'active' };
  db.martial.sessions['21'] = { id: 21, uid: 'khach-0001', status: 'active' };
  db.martial.ledger['session:3'] = { uid: 'khach-0001', congLuc: 5, tam: tam() };
  db.donations.push({ code: 'CDAAAAAA', uid: 'khach-0001', purpose: 'speedup', status: 'pending', amount: 10000 });
  const snap = clone(db);
  const undo = mergeMartialGuest(db, 'khach-0001', 'google:abc');
  assert.notDeepEqual(clone(db), snap);
  undo();
  assert.deepEqual(clone(db), snap);
});

test('tịnh tài đã cúng dường: chỉ tính lượt đã xác nhận, gồm cả lượt tạo khi còn là khách', () => {
  const db = mkdb();
  db.donations.push(
    { code: 'A', uid: 'google:abc', status: 'confirmed', amount: 50000, confirmedAt: 100 },
    { code: 'B', uid: 'khach-0001', status: 'confirmed', amount: 20000, paidAmount: 25000, confirmedAt: 300 },
    { code: 'C', uid: 'google:abc', status: 'pending', amount: 99000 },
    { code: 'D', uid: 'google:abc', status: 'cancelled', amount: 10000 },
    { code: 'E', uid: 'nguoi-khac', status: 'confirmed', amount: 70000, confirmedAt: 200 }
  );
  const accountOf = u => (u === 'khach-0001' ? 'google:abc' : u);
  assert.deepEqual(donatedBy(db, 'google:abc', accountOf), { count: 2, total: 75000, lastAt: 300 });
  assert.deepEqual(donatedBy(db, 'chua-ai', accountOf), { count: 0, total: 0, lastAt: null });
  assert.equal(donatedBy(db, 'khach-0001').total, 25000, 'không có accountOf thì tính theo uid gốc');
});
