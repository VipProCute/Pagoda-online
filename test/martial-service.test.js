'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../public/js/martial');
const { createMartialService } = require('../lib/martial/service');

const T0 = Date.UTC(2026, 0, 10, 3, 0, 0);           // 10:00 ngày 10/01/2026 giờ Việt Nam
const MIN = 60000, HOUR = 3600e3, DAY = 86400e3;
const vnDay = ms => new Date(ms + 7 * 3600e3).toISOString().slice(0, 10);

/** Dựng môi trường giả: db trong RAM, đồng hồ giả, store giả, hàm tạo cúng dường giả. */
function env(config = {}) {
  const clock = { t: T0 };
  const counters = { seq: 0, saves: 0, codes: 0 };
  const db = { donations: [], martial: { profiles: {}, sessions: {}, ledger: {}, matches: [], audit: [] } };
  const cfg = { timeScale: 1, speedupEnabled: true, speedupPerDay: 2, ...config };
  const store = { save() { counters.saves++; }, nextId: () => ++counters.seq };
  const hooks = { fail: false };
  const createSpeedupDonation = f => {
    if (hooks.fail) throw new Error('hỏng');
    const d = {
      code: 'CD' + String(100000 + ++counters.codes), amount: f.amount, name: f.name, anon: f.anon, uid: f.uid,
      status: 'pending', createdAt: clock.t
    };
    db.donations.push(d);
    return d;
  };
  const svc = createMartialService({ db, store, now: () => clock.t, config: cfg, createSpeedupDonation, vnDay });
  /** Giả lập server xác nhận (admin hoặc SePay) rồi gọi dịch vụ. */
  const confirm = (d, paid) => {
    d.status = 'confirmed'; d.confirmedAt = clock.t; d.paidAmount = paid == null ? d.amount : paid;
    return svc.onDonationConfirmed(d);
  };
  const giveCongLuc = (uid, n) => { svc.profile(uid, true).congLuc = n; };
  return { clock, db, cfg, svc, counters, hooks, confirm, giveCongLuc };
}

const ledgerKeys = e => Object.keys(e.db.martial.ledger);

/* ---------- hồ sơ ---------- */

test('hồ sơ: chỉ tạo khi cần, mặc định đúng', () => {
  const e = env();
  assert.equal(e.svc.profile('u1'), null);
  assert.deepEqual(Object.keys(e.db.martial.profiles), []);
  const p = e.svc.profile('u1', true);
  assert.equal(p.uid, 'u1');
  assert.equal(p.congLuc, 0);
  assert.deepEqual(p.tam, { cuong: 0, toc: 0, nhu: 0 });
  assert.deepEqual(p.learned, M.STARTERS);
  assert.equal(p.learned.length, 6);
  assert.deepEqual(p.loadout, []);
  assert.deepEqual([p.wins, p.losses, p.draws], [0, 0, 0]);
  assert.deepEqual(p.vouchers, []);
  assert.deepEqual(p.blocked, []);
  assert.equal(p.dnd, false);
  assert.equal(p.activeSession, null);
  assert.equal(e.svc.profile('u1'), p, 'lấy lại đúng hồ sơ đã lưu trong db');
  assert.equal(e.db.martial.profiles.u1, p);
});

test('view: có levelFrom, levelTo, pct, manaMax đúng theo levelInfo; không tạo hồ sơ', () => {
  const e = env();
  const v0 = e.svc.view('u1');
  assert.equal(v0.level, 1);
  assert.equal(v0.levelFrom, 0);
  assert.equal(v0.levelTo, 60);
  assert.equal(v0.pct, 0);
  assert.equal(v0.manaMax, M.manaMaxOf(1));
  assert.equal(e.svc.profile('u1'), null, 'xem không ghi gì');
  e.giveCongLuc('u1', 100);
  const v = e.svc.view('u1');
  const li = M.levelInfo(100);
  assert.equal(v.level, 2);
  assert.equal(v.levelFrom, li.from);
  assert.equal(v.levelTo, li.to);
  assert.equal(v.pct, li.pct);
  assert.equal(v.manaMax, li.manaMax);
  e.giveCongLuc('u1', 3000);
  assert.equal(e.svc.view('u1').levelTo, null, 'cấp tối đa không có mốc tiếp');
  assert.equal(e.svc.view('u1').level, 10);
});

/* ---------- bắt đầu tu ---------- */

test('start: tạo phiên đúng mốc giờ, giá, lưu activeSession', () => {
  const e = env();
  const r = e.svc.start('u1', 'tinh-tam-quyet', '4h');
  assert.equal(r.ok, true);
  const s = r.session;
  assert.equal(s.methodId, 'tinh-tam-quyet');
  assert.equal(s.durationKey, '4h');
  assert.equal(s.startedAt, T0);
  assert.equal(s.endsAt, T0 + 240 * MIN);
  assert.equal(s.price, M.METHODS['tinh-tam-quyet'].price);
  assert.equal(s.status, 'active');
  assert.equal(s.speedup, null);
  assert.equal(e.svc.profile('u1').activeSession, s.id);
  assert.equal(e.db.martial.sessions[s.id].uid, 'u1');
  assert.ok(e.counters.saves > 0);
});

test('start: công pháp / thời gian không hợp lệ, thiếu cấp', () => {
  const e = env();
  assert.deepEqual(Object.keys(e.svc.start('u1', 'khong-co', '1h')).sort(), ['code', 'ok', 'reason']);
  assert.equal(e.svc.start('u1', 'khong-co', '1h').ok, false);
  assert.equal(e.svc.start('u1', 'tinh-tam-quyet', '99h').ok, false);
  assert.equal(e.svc.start('u1', 'tinh-tam-quyet', undefined).ok, false);
  assert.equal(e.svc.start('u1', 'tinh-tam-quyet', '8h').ok, false, '8h không có ở Tĩnh Tâm Quyết');
  const low = e.svc.start('u1', 'kim-cuong-tam-phap', '1h');
  assert.equal(low.ok, false);
  assert.match(low.reason, /cấp nội công 2/);
  assert.equal(Object.keys(e.db.martial.sessions).length, 0);
  e.giveCongLuc('u1', 60);
  assert.equal(e.svc.start('u1', 'kim-cuong-tam-phap', '1h').ok, true);
});

test('start: hai phiên cùng lúc bị chặn; xong rồi mới tu tiếp được', () => {
  const e = env();
  const a = e.svc.start('u1', 'tinh-tam-quyet', '15m');
  assert.equal(a.ok, true);
  const b = e.svc.start('u1', 'tinh-tam-quyet', '1h');
  assert.equal(b.ok, false);
  assert.equal(b.code, 'busy');
  assert.equal(Object.keys(e.db.martial.sessions).length, 1);
  e.clock.t = T0 + 15 * MIN;
  const c = e.svc.start('u1', 'tinh-tam-quyet', '1h');
  assert.equal(c.ok, true, 'phiên cũ đã tới giờ nên hoàn thành rồi mới nhận phiên mới');
  assert.equal(c.updates.length, 1);
  assert.equal(c.updates[0].kind, 'completed');
  assert.equal(e.svc.profile('u1').congLuc, 5);
  assert.notEqual(c.session.id, a.session.id);
});

test('start: người khác tu song song được', () => {
  const e = env();
  assert.equal(e.svc.start('u1', 'tinh-tam-quyet', '15m').ok, true);
  assert.equal(e.svc.start('u2', 'tinh-tam-quyet', '15m').ok, true);
});

test('timeScale nhân vào thời lượng phiên', () => {
  const e = env({ timeScale: 0.001 });
  const s = e.svc.start('u1', 'tinh-tam-quyet', '15m').session;
  assert.equal(s.endsAt - s.startedAt, 900, '15 phút x 0.001 = 900ms');
  e.clock.t = T0 + 899;
  assert.equal(e.svc.sweep().length, 0);
  e.clock.t = T0 + 900;
  assert.equal(e.svc.sweep().length, 1);
});

/* ---------- hoàn thành theo giờ ---------- */

test('hoàn thành đúng mốc: trước 1ms chưa, tới giờ thì xong, đúng số và đúng câu', () => {
  const e = env();
  e.giveCongLuc('u1', 60);
  const s = e.svc.start('u1', 'kim-cuong-tam-phap', '4h').session;
  e.clock.t = s.endsAt - 1;
  assert.deepEqual(e.svc.completeDue('u1'), []);
  assert.equal(e.svc.sweep().length, 0);
  assert.equal(e.svc.profile('u1').congLuc, 60);
  assert.equal(e.db.martial.sessions[s.id].status, 'active');
  e.clock.t = s.endsAt;
  const ups = e.svc.completeDue('u1');
  assert.equal(ups.length, 1);
  const u = ups[0];
  assert.equal(u.kind, 'completed');
  assert.equal(u.sessionId, s.id);
  assert.equal(u.methodId, 'kim-cuong-tam-phap');
  assert.equal(u.durationKey, '4h');
  assert.equal(u.via, 'time');
  assert.deepEqual(u.reward, { congLuc: 50, tam: { cuong: 50, toc: 0, nhu: 0 } });
  assert.equal(u.levelUp, false);
  assert.equal(u.level, 2);
  assert.equal(u.text, 'Phiên tu Kim Cương Tâm Pháp (4 giờ) đã viên mãn: công lực +50, tâm đắc Cương +50.');
  const p = e.svc.profile('u1');
  assert.equal(p.congLuc, 110);
  assert.deepEqual(p.tam, { cuong: 50, toc: 0, nhu: 0 });
  assert.equal(p.activeSession, null);
  const rec = e.db.martial.sessions[s.id];
  assert.equal(rec.status, 'completed');
  assert.equal(rec.via, 'time');
  assert.equal(rec.completedAt, s.endsAt);
  assert.equal(rec.seen, false);
  assert.deepEqual(rec.reward, u.reward);
  assert.deepEqual(e.db.martial.ledger['session:' + s.id], { uid: 'u1', at: s.endsAt, congLuc: 50, tam: { cuong: 50, toc: 0, nhu: 0 } });
});

test('công pháp nhập môn chỉ tăng công lực; công pháp cả ba nhánh chia đều', () => {
  const e = env();
  const a = e.svc.start('u1', 'tinh-tam-quyet', '1h').session;
  e.clock.t = a.endsAt;
  const u = e.svc.completeDue('u1')[0];
  assert.deepEqual(u.reward, { congLuc: 15, tam: { cuong: 0, toc: 0, nhu: 0 } });
  assert.equal(u.text, 'Phiên tu Tĩnh Tâm Quyết (1 giờ) đã viên mãn: công lực +15.');

  e.giveCongLuc('u2', 500);
  const b = e.svc.start('u2', 'cuu-am-tam-kinh', '4h').session;
  e.clock.t = b.endsAt;
  const u2 = e.svc.completeDue('u2')[0];
  assert.deepEqual(u2.reward, { congLuc: 70, tam: { cuong: 17, toc: 17, nhu: 17 } });
  assert.match(u2.text, /công lực \+70, tâm đắc mỗi nhánh \+17\./);
});

test('nhãn thời gian trong câu: phút, giờ', () => {
  const e = env();
  const s = e.svc.start('u1', 'tinh-tam-quyet', '15m').session;
  e.clock.t = s.endsAt;
  assert.match(e.svc.completeDue('u1')[0].text, /\(15 phút\)/);
});

test('lên cấp: levelUp true, level mới, câu có "Nội công lên cấp"', () => {
  const e = env();
  e.giveCongLuc('u1', 140);
  const s = e.svc.start('u1', 'kim-cuong-tam-phap', '4h').session;
  e.clock.t = s.endsAt;
  const u = e.svc.completeDue('u1')[0];
  assert.equal(e.svc.profile('u1').congLuc, 190);
  assert.equal(u.levelUp, true);
  assert.equal(u.level, 3);
  assert.ok(u.text.endsWith('Nội công lên cấp 3!'), u.text);
});

test('trần: công lực 3000, tâm đắc 300 mỗi nhánh; sổ cộng ghi phần thật sự cộng', () => {
  const e = env();
  const p = e.svc.profile('u1', true);
  p.congLuc = 2990;
  p.tam = { cuong: 280, toc: 0, nhu: 299 };
  const s = e.svc.start('u1', 'vo-cuc-chan-kinh', '8h').session;     // +170 công lực, mỗi nhánh +51
  e.clock.t = s.endsAt;
  const u = e.svc.completeDue('u1')[0];
  assert.deepEqual(u.reward, { congLuc: 10, tam: { cuong: 20, toc: 51, nhu: 1 } });
  assert.equal(p.congLuc, 3000);
  assert.deepEqual(p.tam, { cuong: 300, toc: 51, nhu: 300 });
  assert.deepEqual(e.db.martial.ledger['session:' + s.id].tam, { cuong: 20, toc: 51, nhu: 1 });
  assert.equal(e.db.martial.ledger['session:' + s.id].congLuc, 10);
});

test('đầy trần: phiên vẫn xong, không cộng gì, câu nói rõ', () => {
  const e = env();
  const p = e.svc.profile('u1', true);
  p.congLuc = 3000;
  p.tam = { cuong: 300, toc: 300, nhu: 300 };
  const s = e.svc.start('u1', 'vo-cuc-chan-kinh', '8h').session;
  e.clock.t = s.endsAt;
  const u = e.svc.completeDue('u1')[0];
  assert.deepEqual(u.reward, { congLuc: 0, tam: { cuong: 0, toc: 0, nhu: 0 } });
  assert.match(u.text, /mức tối đa/);
  assert.equal(e.db.martial.sessions[s.id].status, 'completed');
});

test('complete idempotent: gọi hai lần cùng phiên chỉ cộng một lần', () => {
  const e = env();
  const s = e.svc.start('u1', 'tinh-tam-quyet', '4h').session;
  const first = e.svc.complete(s.id, 'time');
  assert.equal(first.kind, 'completed');
  assert.equal(e.svc.complete(s.id, 'time'), null);
  assert.equal(e.svc.complete(s.id, 'speedup'), null);
  assert.equal(e.svc.complete(String(s.id), 'voucher'), null, 'id dạng chuỗi cũng không cộng lại');
  assert.equal(e.svc.profile('u1').congLuc, 45);
  assert.deepEqual(ledgerKeys(e), ['session:' + s.id]);
});

test('sổ cộng là nguồn sự thật: phiên còn "active" mà sổ đã có khóa thì chỉ sửa trạng thái', () => {
  const e = env();
  const s = e.svc.start('u1', 'tinh-tam-quyet', '4h').session;
  e.db.martial.ledger['session:' + s.id] = { uid: 'u1', at: T0, congLuc: 45, tam: { cuong: 0, toc: 0, nhu: 0 } };
  e.svc.profile('u1').congLuc = 45;
  const u = e.svc.complete(s.id, 'time');
  assert.equal(u.kind, 'completed');
  assert.equal(u.levelUp, false);
  assert.equal(e.svc.profile('u1').congLuc, 45, 'không cộng lại');
  assert.equal(e.db.martial.sessions[s.id].status, 'completed');
  assert.equal(e.svc.profile('u1').activeSession, null);
  assert.equal(e.db.martial.ledger['session:' + s.id].congLuc, 45, 'sổ không bị ghi đè');
  // sweep cũng không cộng lại dù dữ liệu hỏng kiểu này
  const s2 = e.svc.start('u1', 'tinh-tam-quyet', '15m').session;
  e.db.martial.ledger['session:' + s2.id] = { uid: 'u1', at: T0, congLuc: 5, tam: { cuong: 0, toc: 0, nhu: 0 } };
  e.clock.t = s2.endsAt;
  assert.equal(e.svc.sweep().length, 1);
  assert.equal(e.svc.profile('u1').congLuc, 45);
});

test('sweep: trả đúng người, chỉ phiên tới giờ; chạy lại không cộng lại', () => {
  const e = env();
  const a = e.svc.start('u1', 'tinh-tam-quyet', '15m').session;
  const b = e.svc.start('u2', 'tinh-tam-quyet', '1h').session;
  const c = e.svc.start('u3', 'tinh-tam-quyet', '15m').session;
  e.svc.cancel('u3', c.id);
  e.clock.t = a.endsAt;
  let out = e.svc.sweep();
  assert.equal(out.length, 1);
  assert.equal(out[0].uid, 'u1');
  assert.equal(out[0].update.sessionId, a.id);
  assert.equal(out[0].update.kind, 'completed');
  assert.deepEqual(e.svc.sweep(), []);
  assert.equal(e.svc.profile('u1').congLuc, 5);
  assert.equal(e.svc.profile('u2').congLuc, 0);
  assert.equal(e.svc.profile('u3').congLuc, 0);
  e.clock.t = b.endsAt + 5 * HOUR;
  out = e.svc.sweep();
  assert.deepEqual(out.map(x => x.uid), ['u2']);
  assert.deepEqual(e.svc.sweep(), []);
  assert.equal(e.svc.profile('u2').congLuc, 15);
  assert.equal(e.svc.profile('u1').congLuc, 5);
  assert.equal(ledgerKeys(e).length, 2);
});

/* ---------- hủy ---------- */

test('cancel: chỉ phiên của chính mình, không cộng gì, xóa activeSession', () => {
  const e = env();
  const s = e.svc.start('u1', 'tinh-tam-quyet', '4h').session;
  const other = e.svc.cancel('u2', s.id);
  assert.equal(other.ok, false);
  assert.equal(e.db.martial.sessions[s.id].status, 'active', 'người khác không hủy được');
  const r = e.svc.cancel('u1', s.id);
  assert.equal(r.ok, true);
  assert.equal(r.updates[0].kind, 'cancelled');
  const rec = e.db.martial.sessions[s.id];
  assert.equal(rec.status, 'cancelled');
  assert.equal(e.svc.profile('u1').activeSession, null);
  assert.equal(e.svc.profile('u1').congLuc, 0);
  assert.deepEqual(ledgerKeys(e), []);
  assert.equal(e.svc.cancel('u1', s.id).ok, false, 'hủy lần hai');
  e.clock.t = s.endsAt + HOUR;
  assert.deepEqual(e.svc.sweep(), [], 'phiên đã hủy không bao giờ hoàn thành');
  assert.equal(e.svc.cancel('u1', 99999).ok, false);
  assert.equal(e.svc.start('u1', 'tinh-tam-quyet', '15m').ok, true, 'hủy xong tu lại được');
});

test('cancel đúng lúc đã tới giờ: phiên hoàn thành chứ không mất tiến độ', () => {
  const e = env();
  const s = e.svc.start('u1', 'tinh-tam-quyet', '15m').session;
  e.clock.t = s.endsAt;
  const r = e.svc.cancel('u1', s.id);
  assert.equal(r.ok, false);
  assert.equal(r.code, 'done');
  assert.equal(r.updates[0].kind, 'completed');
  assert.equal(e.svc.profile('u1').congLuc, 5);
  assert.equal(e.db.martial.sessions[s.id].status, 'completed');
});

/* ---------- state ---------- */

test('state: đủ trường, hoàn thành phiên tới giờ trước khi dựng', () => {
  const e = env();
  const st0 = e.svc.state('u1');
  assert.equal(st0.ok, true);
  assert.equal(st0.enabled, true);
  assert.equal(st0.serverTime, T0);
  assert.equal(st0.session, null);
  assert.deepEqual(st0.recent, []);
  assert.deepEqual(st0.speedup, { enabled: true, perDay: null, usedToday: 0 });
  assert.deepEqual(st0.profile.learned, M.STARTERS);
  assert.equal(e.svc.profile('u1'), null, 'state không tạo hồ sơ');
  assert.equal('login' in st0, false, 'phần login do server thêm');

  const s = e.svc.start('u1', 'tinh-tam-quyet', '15m').session;
  const st1 = e.svc.state('u1');
  assert.equal(st1.session.id, s.id);
  assert.equal(st1.session.status, 'active');
  assert.equal(st1.session.speedup, null);
  e.clock.t = s.endsAt + 1000;
  const st2 = e.svc.state('u1');
  assert.equal(st2.session, null);
  assert.equal(st2.profile.congLuc, 5);
  assert.equal(st2.recent.length, 1);
  assert.deepEqual(Object.keys(st2.recent[0]).sort(), ['completedAt', 'durationKey', 'id', 'methodId', 'reward', 'seen', 'status', 'via']);
  assert.equal(st2.recent[0].status, 'completed');
  assert.equal(st2.recent[0].via, 'time');
  assert.equal(st2.recent[0].seen, false);
});

test('state: recent tối đa 8, mới nhất trước, gồm cả phiên hủy', () => {
  const e = env();
  const ids = [];
  for (let i = 0; i < 10; i++) {
    const s = e.svc.start('u1', 'tinh-tam-quyet', '15m').session;
    ids.push(s.id);
    if (i % 3 === 2) e.svc.cancel('u1', s.id); else e.clock.t = s.endsAt;
    e.svc.completeDue('u1');
    e.clock.t += 1000;
  }
  const st = e.svc.state('u1');
  assert.equal(st.recent.length, 8);
  assert.deepEqual(st.recent.map(r => r.id), ids.slice(2).reverse());
  assert.ok(st.recent.some(r => r.status === 'cancelled'));
  const c = st.recent.find(r => r.status === 'cancelled');
  assert.deepEqual(c.reward, { congLuc: 0, tam: { cuong: 0, toc: 0, nhu: 0 } });
  assert.equal(c.via, null);
});

test('state: session.speedup của yêu cầu đang chờ, bankReported theo d.bank', () => {
  const e = env();
  const s = e.svc.start('u1', 'tinh-tam-quyet', '4h').session;
  const r = e.svc.speedup('u1', s.id, { anon: false, name: 'Lan' });
  let st = e.svc.state('u1');
  assert.deepEqual(st.session.speedup, { code: r.donation.code, amount: 10000, status: 'pending', bankReported: false, createdAt: T0 });
  r.donation.bank = { at: T0 + 1, amount: 10000, ref: 'x' };
  st = e.svc.state('u1');
  assert.equal(st.session.speedup.bankReported, true);
  r.donation.status = 'expired';
  assert.equal(e.svc.state('u1').session.speedup, null, 'không còn pending thì không hiện');
});

/* ---------- học chiêu ---------- */

test('learn: thiếu điều kiện, đã học, không tồn tại', () => {
  const e = env();
  const r1 = e.svc.learn('u1', 'tu-luc-pha-son');
  assert.equal(r1.ok, false);
  assert.match(r1.reason, /cấp nội công 7/);
  assert.match(r1.reason, /250 tâm đắc Cương/);
  const r2 = e.svc.learn('u1', 'trong-quyen');
  assert.equal(r2.ok, false);
  assert.equal(r2.code, 'learned');
  assert.equal(e.svc.learn('u1', 'khong-co').ok, false);
  assert.deepEqual(e.svc.profile('u1').learned, M.STARTERS);
});

test('learn: đủ điều kiện thì học, không tốn gì, không học trùng', () => {
  const e = env();
  const p = e.svc.profile('u1', true);
  p.congLuc = 160; p.tam.cuong = 40;
  const r = e.svc.learn('u1', 'kim-chung-trao');
  assert.equal(r.ok, true);
  assert.ok(r.profile.learned.includes('kim-chung-trao'));
  assert.equal(r.profile.congLuc, 160);
  assert.equal(r.profile.tam.cuong, 40);
  assert.equal(p.learned.length, 7);
  assert.equal(e.svc.learn('u1', 'kim-chung-trao').ok, false);
  assert.equal(p.learned.filter(x => x === 'kim-chung-trao').length, 1);
  // thiếu tâm đắc nhánh Tốc dù đủ cấp
  const t = e.svc.learn('u1', 'khinh-than-bo');
  assert.equal(t.ok, false);
  assert.match(t.reason, /40 tâm đắc Tốc/);
});

/* ---------- bộ chiêu ---------- */

test('setLoadout: không đủ 4, trùng, chưa học, không tồn tại, sai kiểu', () => {
  const e = env();
  const L = ['trong-quyen', 'thiet-bich', 'tat-phong-quyen', 'nhu-van-bo'];
  assert.equal(e.svc.setLoadout('u1', L.slice(0, 3)).ok, false);
  assert.equal(e.svc.setLoadout('u1', [...L, 'lieu-diep-chuong']).ok, false);
  assert.equal(e.svc.setLoadout('u1', ['trong-quyen', 'trong-quyen', 'thiet-bich', 'nhu-van-bo']).ok, false);
  const notLearned = e.svc.setLoadout('u1', ['trong-quyen', 'thiet-bich', 'tat-phong-quyen', 'kim-chung-trao']);
  assert.equal(notLearned.ok, false);
  assert.match(notLearned.reason, /chưa học Kim Chung Tráo/);
  assert.equal(e.svc.setLoadout('u1', ['trong-quyen', 'thiet-bich', 'tat-phong-quyen', 'dieu-tuc']).ok, false);
  assert.equal(e.svc.setLoadout('u1', 'trong-quyen').ok, false);
  assert.equal(e.svc.setLoadout('u1', [1, 2, 3, 4]).ok, false);
  assert.equal(e.svc.setLoadout('u1', ['constructor', 'thiet-bich', 'tat-phong-quyen', 'nhu-van-bo']).ok, false);
  assert.deepEqual(e.svc.profile('u1', true).loadout, [], 'bộ sai không được lưu');
});

test('setLoadout: bộ hợp lệ được lưu, không cảnh báo khi có chiêu công', () => {
  const e = env();
  const L = ['trong-quyen', 'thiet-bich', 'tat-phong-quyen', 'nhu-van-bo'];
  const r = e.svc.setLoadout('u1', L);
  assert.equal(r.ok, true);
  assert.deepEqual(r.loadout, L);
  assert.deepEqual(r.warnings, []);
  assert.deepEqual(e.svc.profile('u1').loadout, L);
  assert.equal(e.svc.view('u1').loadout.join(), L.join());
});

test('setLoadout: bộ không có chiêu công thì cảnh báo nhưng vẫn lưu', () => {
  const e = env();
  const p = e.svc.profile('u1', true);
  p.learned.push('khinh-than-bo');
  const L = ['thiet-bich', 'anh-bo-ho-than', 'nhu-van-bo', 'khinh-than-bo'];
  const r = e.svc.setLoadout('u1', L);
  assert.equal(r.ok, true);
  assert.deepEqual(p.loadout, L);
  const codes = r.warnings.map(w => w.code);
  assert.ok(codes.includes('no-attack'));
  assert.ok(codes.includes('no-damage'));
  assert.ok(r.warnings.every(w => typeof w.text === 'string' && w.text));
});

/* ---------- đã xem ---------- */

test('markSeen: chỉ phiên đã xong của chính mình', () => {
  const e = env();
  const a = e.svc.start('u1', 'tinh-tam-quyet', '15m').session;
  const b = e.svc.start('u2', 'tinh-tam-quyet', '15m').session;
  e.clock.t = a.endsAt;
  e.svc.sweep();
  assert.equal(e.db.martial.sessions[a.id].seen, false);
  assert.equal(e.svc.markSeen('u2', [a.id]).ok, true);
  assert.equal(e.db.martial.sessions[a.id].seen, false, 'người khác không đánh dấu hộ');
  assert.equal(e.svc.markSeen('u1', [a.id, b.id, 'rác', {}, null, '__proto__']).ok, true);
  assert.equal(e.db.martial.sessions[a.id].seen, true);
  assert.equal(e.svc.state('u1').recent[0].seen, true);
  assert.equal(e.svc.markSeen('u1', 'x').ok, false);
  assert.equal(e.svc.markSeen('u1', null).ok, false);
});

/* ---------- hoàn thành ngay ---------- */

test('speedup: tắt, phiên không phải của mình, đã xong', () => {
  const off = env({ speedupEnabled: false });
  const s0 = off.svc.start('u1', 'tinh-tam-quyet', '4h').session;
  const r0 = off.svc.speedup('u1', s0.id, {});
  assert.equal(r0.ok, false);
  assert.equal(r0.code, 'disabled');

  const e = env();
  const s = e.svc.start('u1', 'tinh-tam-quyet', '4h').session;
  assert.equal(e.svc.speedup('u2', s.id, {}).ok, false);
  assert.equal(e.svc.speedup('u1', 12345, {}).ok, false);
  assert.equal(e.svc.speedup('u1', undefined, {}).ok, false);
  assert.equal(e.db.donations.length, 0);
  e.clock.t = s.endsAt;
  const done = e.svc.speedup('u1', s.id, {});
  assert.equal(done.ok, false, 'đã tới giờ thì không bán hoàn thành ngay');
  assert.equal(e.svc.profile('u1').congLuc, 45, 'phiên tự xong theo giờ');
  assert.equal(e.db.donations.length, 0);
  const c = e.svc.start('u1', 'tinh-tam-quyet', '4h').session;
  e.svc.cancel('u1', c.id);
  assert.equal(e.svc.speedup('u1', c.id, {}).ok, false);
});

test('speedup: tạo yêu cầu đúng số tiền, gắn phiên, trả lại yêu cầu cũ khi gọi lại', () => {
  const e = env();
  e.giveCongLuc('u1', 60);
  const s = e.svc.start('u1', 'kim-cuong-tam-phap', '8h').session;
  const r = e.svc.speedup('u1', s.id, { anon: true, name: '  Hạnh  ' });
  assert.equal(r.ok, true);
  assert.equal(r.existing, false);
  const d = r.donation;
  assert.equal(d.amount, 20000);
  assert.equal(d.status, 'pending');
  assert.equal(d.purpose, 'speedup');
  assert.equal(d.sessionId, s.id);
  assert.equal(d.methodId, 'kim-cuong-tam-phap');
  assert.equal(d.durationKey, '8h');
  assert.equal(d.price, 20000);
  assert.equal(d.anon, true);
  assert.equal(d.name, 'Hạnh');
  assert.equal(d.uid, 'u1');
  assert.equal(e.db.martial.sessions[s.id].speedupCode, d.code);
  const again = e.svc.speedup('u1', s.id, { anon: false, name: 'Khác' });
  assert.equal(again.ok, true);
  assert.equal(again.existing, true);
  assert.equal(again.donation, d, 'đúng yêu cầu đó');
  assert.equal(e.db.donations.length, 1, 'không tạo mã mới');
});

test('speedup: hàm tạo cúng dường ném lỗi thì trả code donation, không hỏng phiên', () => {
  const e = env();
  const s = e.svc.start('u1', 'tinh-tam-quyet', '4h').session;
  e.hooks.fail = true;
  const r = e.svc.speedup('u1', s.id, {});
  assert.equal(r.ok, false);
  assert.equal(r.code, 'donation');
  assert.equal(e.db.martial.sessions[s.id].speedupCode, undefined);
  assert.equal(e.db.martial.sessions[s.id].status, 'active');
  e.hooks.fail = false;
  assert.equal(e.svc.speedup('u1', s.id, {}).ok, true);
});

test('hoàn thành ngay được xác nhận: phiên xong một lần, hai lần xác nhận vẫn một lần', () => {
  const e = env();
  const s = e.svc.start('u1', 'tinh-tam-quyet', '4h').session;
  const d = e.svc.speedup('u1', s.id, { name: 'A' }).donation;
  e.clock.t = T0 + 10 * MIN;
  const r = e.confirm(d);
  assert.equal(r.outcome, 'applied');
  assert.equal(d.outcome, 'applied');
  assert.equal(r.updates.length, 1);
  assert.equal(r.updates[0].uid, 'u1');
  const u = r.updates[0].update;
  assert.equal(u.kind, 'completed');
  assert.equal(u.via, 'speedup');
  assert.equal(u.sessionId, s.id);
  assert.deepEqual(u.reward, { congLuc: 45, tam: { cuong: 0, toc: 0, nhu: 0 } });
  const rec = e.db.martial.sessions[s.id];
  assert.equal(rec.status, 'completed');
  assert.equal(rec.via, 'speedup');
  assert.equal(rec.speedupCode, undefined);
  assert.equal(e.svc.profile('u1').congLuc, 45);
  assert.equal(e.svc.profile('u1').activeSession, null);

  const r2 = e.svc.onDonationConfirmed(d);
  assert.deepEqual(r2, { outcome: 'applied', updates: [] });
  const r3 = e.confirm(d);
  assert.equal(r3.outcome, 'applied');
  assert.deepEqual(r3.updates, []);
  assert.equal(e.svc.profile('u1').congLuc, 45, 'xác nhận lần hai không cộng');
  assert.deepEqual(ledgerKeys(e), ['session:' + s.id]);
  assert.deepEqual(e.svc.profile('u1').vouchers, []);
  // chạy sweep sau đó cũng không cộng lại
  e.clock.t = s.endsAt + HOUR;
  assert.deepEqual(e.svc.sweep(), []);
  assert.equal(e.svc.profile('u1').congLuc, 45);
});

test('onDonationConfirmed: cúng dường thường (không phải hoàn thành ngay) thì trả null', () => {
  const e = env();
  assert.equal(e.svc.onDonationConfirmed({ code: 'CDAAAAAA', status: 'confirmed', uid: 'u1', amount: 50000 }), null);
  assert.equal(e.svc.onDonationConfirmed(null), null);
  assert.equal(e.svc.onDonationConfirmed('x'), null);
  assert.equal(e.svc.profile('u1'), null);
});

test('yêu cầu hoàn thành ngay đến sau khi phiên tự xong: cộng đúng một lần, tặng phiếu', () => {
  const e = env();
  const s = e.svc.start('u1', 'tinh-tam-quyet', '4h').session;
  const d = e.svc.speedup('u1', s.id, {}).donation;
  e.clock.t = s.endsAt + 5000;           // phiên đã tới giờ, sweep chưa kịp chạy
  const r = e.confirm(d, 12000);
  assert.equal(r.outcome, 'late');
  assert.equal(d.outcome, 'late');
  const kinds = r.updates.map(x => x.update.kind);
  assert.deepEqual(kinds, ['completed', 'speedup-late']);
  const late = r.updates[1].update;
  assert.equal(r.updates[1].uid, 'u1');
  assert.equal(late.sessionId, s.id);
  assert.equal(late.voucher.value, 12000, 'giá trị phiếu theo số tiền đã nhận');
  assert.match(late.text, /đã nhận tịnh tài/);
  assert.match(late.text, /viên mãn/);
  assert.match(late.text, /phiếu hoàn thành ngay/);
  assert.match(late.text, /12\.000đ/);
  const p = e.svc.profile('u1');
  assert.equal(p.congLuc, 45, 'chỉ một phần thưởng');
  assert.equal(p.vouchers.length, 1);
  assert.equal(p.vouchers[0].value, 12000);
  assert.equal(p.vouchers[0].code, d.code);
  assert.equal(d.voucherId, p.vouchers[0].id);
  assert.equal(e.db.martial.sessions[s.id].via, 'time');
  const again = e.confirm(d, 12000);
  assert.deepEqual(again, { outcome: 'late', updates: [] });
  assert.equal(p.vouchers.length, 1, 'không tặng phiếu hai lần');
  assert.equal(p.congLuc, 45);
});

test('yêu cầu đến sau khi phiên đã được sweep xong: phiếu, không cộng thêm', () => {
  const e = env();
  const s = e.svc.start('u1', 'tinh-tam-quyet', '4h').session;
  const d = e.svc.speedup('u1', s.id, {}).donation;
  e.clock.t = s.endsAt;
  assert.equal(e.svc.sweep().length, 1);
  assert.equal(e.svc.state('u1').session, null);
  const r = e.confirm(d);
  assert.equal(r.outcome, 'late');
  assert.deepEqual(r.updates.map(x => x.update.kind), ['speedup-late']);
  assert.equal(e.svc.profile('u1').congLuc, 45);
  assert.equal(e.svc.state('u1').profile.vouchers.length, 1);
  assert.equal(e.svc.state('u1').profile.vouchers[0].value, d.amount);
});

test('yêu cầu đến sau khi hủy phiên: phiếu, không cộng thưởng', () => {
  const e = env();
  const s = e.svc.start('u1', 'tinh-tam-quyet', '4h').session;
  const d = e.svc.speedup('u1', s.id, {}).donation;
  assert.equal(e.svc.cancel('u1', s.id).ok, true);
  assert.equal(d.status, 'pending', 'hủy phiên không hủy yêu cầu đang chờ');
  const r = e.confirm(d);
  assert.equal(r.outcome, 'late');
  assert.match(r.updates[0].update.text, /hủy/);
  const p = e.svc.profile('u1');
  assert.equal(p.congLuc, 0);
  assert.equal(p.vouchers.length, 1);
  assert.deepEqual(ledgerKeys(e), []);
  assert.equal(e.db.martial.sessions[s.id].status, 'cancelled');
});

test('yêu cầu có phiên của người khác hoặc phiên không tồn tại: phiếu cho người trả tiền', () => {
  const e = env();
  const s = e.svc.start('u2', 'tinh-tam-quyet', '4h').session;
  const d1 = { code: 'CDTEST01', purpose: 'speedup', uid: 'u1', sessionId: s.id, methodId: 'tinh-tam-quyet', durationKey: '4h', amount: 10000, status: 'pending' };
  const r1 = e.confirm(d1);
  assert.equal(r1.outcome, 'late');
  assert.equal(e.db.martial.sessions[s.id].status, 'active', 'phiên của người khác không bị đụng');
  assert.equal(e.svc.profile('u1').vouchers.length, 1);
  const d2 = { code: 'CDTEST02', purpose: 'speedup', uid: 'u1', sessionId: 9999, amount: 10000, status: 'pending' };
  assert.equal(e.confirm(d2).outcome, 'late');
  assert.equal(e.svc.profile('u1').vouchers.length, 2);
});

/* ---------- phiếu ---------- */

test('useVoucher: dùng phiếu hoàn thành phiên; dùng hai lần thì không', () => {
  const e = env();
  const s1 = e.svc.start('u1', 'tinh-tam-quyet', '4h').session;
  const d = e.svc.speedup('u1', s1.id, {}).donation;
  e.svc.cancel('u1', s1.id);
  e.confirm(d, 20000);
  const vid = e.svc.profile('u1').vouchers[0].id;
  assert.equal(e.svc.state('u1').profile.vouchers.length, 1);

  const s2 = e.svc.start('u1', 'tinh-tam-quyet', '4h').session;
  const r = e.svc.useVoucher('u1', vid, s2.id);
  assert.equal(r.ok, true);
  assert.equal(r.updates.at(-1).kind, 'completed');
  assert.equal(r.updates.at(-1).via, 'voucher');
  assert.equal(e.svc.profile('u1').congLuc, 45);
  assert.equal(e.db.martial.sessions[s2.id].via, 'voucher');
  const v = e.svc.profile('u1').vouchers[0];
  assert.equal(v.usedFor, s2.id);
  assert.equal(v.usedAt, T0);
  assert.equal(e.svc.state('u1').profile.vouchers.length, 0, 'phiếu đã dùng không còn hiện');

  const s3 = e.svc.start('u1', 'tinh-tam-quyet', '4h').session;
  const again = e.svc.useVoucher('u1', vid, s3.id);
  assert.equal(again.ok, false);
  assert.equal(e.db.martial.sessions[s3.id].status, 'active');
  assert.equal(e.svc.profile('u1').congLuc, 45, 'phiếu dùng hai lần không cộng thêm');
});

test('useVoucher: giá trị không đủ, phiên không phải của mình, không có phiên, phiếu lạ', () => {
  const e = env();
  e.svc.profile('u1', true).vouchers.push({ id: 7, value: 10000, code: 'CDX', createdAt: T0 });
  e.giveCongLuc('u1', 60);
  const s = e.svc.start('u1', 'kim-cuong-tam-phap', '4h').session;       // giá 20000
  const low = e.svc.useVoucher('u1', 7, s.id);
  assert.equal(low.ok, false);
  assert.equal(low.code, 'value');
  assert.equal(e.svc.profile('u1').vouchers[0].usedAt, undefined);

  e.svc.profile('u1').vouchers.push({ id: 8, value: 50000, code: 'CDY', createdAt: T0 });
  const s2 = e.svc.start('u2', 'tinh-tam-quyet', '4h').session;
  assert.equal(e.svc.useVoucher('u1', 8, s2.id).ok, false, 'phiên người khác');
  assert.equal(e.svc.useVoucher('u2', 8, s2.id).ok, false, 'phiếu của người khác');
  assert.equal(e.svc.useVoucher('u1', 999, s.id).ok, false);
  assert.equal(e.svc.useVoucher('u1', {}, s.id).ok, false);
  assert.equal(e.svc.useVoucher('u1', 8, 999).ok, false);
  assert.equal(e.db.martial.sessions[s2.id].status, 'active');
  assert.equal(e.svc.profile('u1').vouchers.every(v => !v.usedAt), true);
  assert.equal(e.svc.useVoucher('u1', '8', s.id).ok, true, 'id dạng chuỗi vẫn khớp');
  assert.equal(e.svc.useVoucher('u1', 8, s.id).ok, false, 'phiên đã xong');
});

/* ---------- từ chối, hết hạn, hủy yêu cầu ---------- */

test('onDonationClosed: từ chối / hết hạn báo một lần, gỡ mã khỏi phiên, phiên vẫn chạy', () => {
  const e = env();
  const s = e.svc.start('u1', 'tinh-tam-quyet', '4h').session;
  const d = e.svc.speedup('u1', s.id, {}).donation;
  d.status = 'cancelled';
  const r = e.svc.onDonationClosed(d);
  assert.equal(r.updates.length, 1);
  assert.equal(r.updates[0].uid, 'u1');
  assert.equal(r.updates[0].update.kind, 'speedup-rejected');
  assert.equal(r.updates[0].update.sessionId, s.id);
  assert.match(r.updates[0].update.text, /không được xác nhận/);
  assert.equal(d.outcome, 'rejected');
  assert.equal(d.notified, true);
  assert.equal(e.db.martial.sessions[s.id].speedupCode, undefined);
  assert.equal(e.db.martial.sessions[s.id].status, 'active');
  assert.deepEqual(e.svc.onDonationClosed(d), { updates: [] }, 'idempotent');

  // phiên vẫn xin hoàn thành ngay lại được, ra mã mới
  const again = e.svc.speedup('u1', s.id, {});
  assert.equal(again.ok, true);
  assert.equal(again.existing, false);
  assert.notEqual(again.donation.code, d.code);

  // hết hạn
  const d2 = again.donation;
  d2.status = 'expired';
  const r2 = e.svc.onDonationClosed(d2);
  assert.match(r2.updates[0].update.text, /hết hạn/);
  assert.equal(d2.outcome, 'rejected');
  // không phải hoàn thành ngay
  assert.deepEqual(e.svc.onDonationClosed({ code: 'CDZ', purpose: undefined, uid: 'u1', status: 'expired' }), { updates: [] });
  assert.equal(e.svc.profile('u1').congLuc, 0);
});

test('yêu cầu đã bị từ chối mà Ban điều hành xác nhận sau thì vẫn được xử lý một lần', () => {
  const e = env();
  const s = e.svc.start('u1', 'tinh-tam-quyet', '4h').session;
  const d = e.svc.speedup('u1', s.id, {}).donation;
  d.status = 'cancelled';
  e.svc.onDonationClosed(d);
  const r = e.confirm(d);
  assert.equal(r.outcome, 'applied');
  assert.equal(e.svc.profile('u1').congLuc, 45);
  assert.equal(e.confirm(d).updates.length, 0);
  assert.equal(e.svc.profile('u1').congLuc, 45);
});

test('cancelSpeedup: chỉ yêu cầu đang chờ của chính mình', () => {
  const e = env();
  const s = e.svc.start('u1', 'tinh-tam-quyet', '4h').session;
  const d = e.svc.speedup('u1', s.id, {}).donation;
  assert.equal(e.svc.cancelSpeedup('u2', d.code).ok, false);
  assert.equal(d.status, 'pending');
  assert.equal(e.svc.cancelSpeedup('u1', 'CDKHONGCO').ok, false);
  assert.equal(e.svc.cancelSpeedup('u1', { code: 1 }).ok, false);
  assert.equal(e.svc.cancelSpeedup('u1', '__proto__').ok, false);

  d.bank = { at: T0, amount: 10000, ref: 'r' };
  assert.equal(e.svc.cancelSpeedup('u1', d.code).code, 'paid', 'ngân hàng đã báo thì không hủy');
  assert.equal(d.status, 'pending');
  delete d.bank;

  const r = e.svc.cancelSpeedup('u1', d.code);
  assert.equal(r.ok, true);
  assert.equal(d.status, 'cancelled');
  assert.equal(d.outcome, null);
  assert.equal(e.db.martial.sessions[s.id].speedupCode, undefined);
  assert.equal(e.svc.state('u1').session.speedup, null);
  assert.equal(e.svc.cancelSpeedup('u1', d.code).ok, false, 'không còn pending');
  assert.deepEqual(e.svc.onDonationClosed(d), { updates: [] }, 'tự hủy thì không báo bị từ chối');
  assert.equal(e.svc.speedup('u1', s.id, {}).existing, false);
});

/* ---------- giới hạn mỗi ngày ---------- */

test('hoàn thành nhanh hơn 20 lần cùng ngày, bỏ cấu hình giới hạn cũ', () => {
  const e = env({ speedupPerDay: 2 });
  for (let i = 0; i < 24; i++) {
    const s = e.svc.start('u1', 'tinh-tam-quyet', '15m').session;
    const r = e.svc.speedup('u1', s.id, {});
    assert.equal(r.ok, true, r.reason);
    e.confirm(r.donation);
  }
  assert.equal(e.svc.state('u1').speedup.usedToday, 24);
  assert.equal(e.svc.state('u1').speedup.perDay, null);
});

test('không đặt giới hạn ngày thì báo không giới hạn', () => {
  assert.equal(env({ speedupPerDay: undefined }).svc.state('u1').speedup.perDay, null);
});

/* ---------- kết quả luận võ, danh tính ---------- */

test('recordResult: cộng thắng, thua, hòa; kết quả lạ bị bỏ', () => {
  const e = env();
  assert.deepEqual(e.svc.recordResult('u1', 'win'), { wins: 1, losses: 0, draws: 0 });
  assert.deepEqual(e.svc.recordResult('u1', 'win'), { wins: 2, losses: 0, draws: 0 });
  assert.deepEqual(e.svc.recordResult('u1', 'loss'), { wins: 2, losses: 1, draws: 0 });
  assert.deepEqual(e.svc.recordResult('u1', 'draw'), { wins: 2, losses: 1, draws: 1 });
  assert.equal(e.svc.recordResult('u1', 'lose'), null);
  assert.equal(e.svc.recordResult('u1', '__proto__'), null);
  assert.deepEqual(e.svc.view('u1').wins, 2);
});

test('pkIdentity: tự tạo hồ sơ mặc định, trả đúng hình dạng và bản sao', () => {
  const e = env();
  const id = e.svc.pkIdentity('u1');
  assert.deepEqual(Object.keys(id).sort(), ['activeMatch', 'draws', 'learned', 'level', 'loadout', 'losses', 'mastery', 'wins']);
  assert.equal(id.level, 1);
  assert.deepEqual(id.learned, M.STARTERS);
  assert.deepEqual(id.loadout, []);
  assert.equal(id.activeMatch, null);
  assert.ok(e.svc.profile('u1'));
  id.learned.push('x');
  assert.equal(e.svc.profile('u1').learned.length, 6, 'sửa bản trả về không đổi hồ sơ');
  e.giveCongLuc('u1', 800);
  e.svc.profile('u1').activeMatch = 'm1';
  e.svc.recordResult('u1', 'win');
  const id2 = e.svc.pkIdentity('u1');
  assert.equal(id2.level, 6);
  assert.equal(id2.activeMatch, 'm1');
  assert.equal(id2.wins, 1);
  assert.equal(e.svc.pkIdentity('__proto__'), null);
});

/* ---------- dọn dữ liệu ---------- */

test('prune: bỏ phiên xong quá 60 ngày, giữ tối đa 50 mỗi người, không đụng sổ cộng và phiên đang chạy', () => {
  const e = env();
  const sess = e.db.martial.sessions, ledger = e.db.martial.ledger;
  let n = 0;
  const add = (uid, status, completedAt) => {
    const id = ++n;
    sess[id] = { id, uid, methodId: 'tinh-tam-quyet', durationKey: '15m', startedAt: completedAt, endsAt: completedAt, price: 10000, status, completedAt: status === 'active' ? null : completedAt, seen: true };
    ledger['session:' + id] = { uid, at: completedAt, congLuc: 5, tam: { cuong: 0, toc: 0, nhu: 0 } };
    return id;
  };
  const old = add('u1', 'completed', T0 - 61 * DAY);
  const edge = add('u1', 'completed', T0 - 59 * DAY);
  const oldCancelled = add('u1', 'cancelled', T0 - 100 * DAY);
  const oldActive = add('u1', 'active', T0 - 100 * DAY);
  for (let i = 0; i < 55; i++) add('u2', 'completed', T0 - i * HOUR);
  const removed = e.svc.prune();
  assert.equal(removed, 2 + 5);
  assert.equal(sess[old], undefined);
  assert.equal(sess[oldCancelled], undefined);
  assert.ok(sess[edge]);
  assert.ok(sess[oldActive], 'phiên đang chạy không bị dọn');
  const u2 = Object.values(sess).filter(s => s.uid === 'u2');
  assert.equal(u2.length, 50);
  assert.ok(u2.every(s => s.completedAt >= T0 - 49 * HOUR), 'giữ các phiên mới nhất');
  assert.equal(Object.keys(ledger).length, n, 'sổ cộng nguyên vẹn');
  assert.equal(e.svc.prune(), 0);
});

/* ---------- đầu vào độc hại ---------- */

test('khóa độc hại: __proto__, constructor, kiểu lạ không làm hỏng hay ném lỗi', () => {
  const e = env();
  const bad = ['__proto__', 'constructor', 'prototype', '', null, undefined, 42, {}, [], true];
  for (const uid of bad) {
    assert.equal(e.svc.profile(uid, true), null);
    assert.equal(e.svc.state(uid).ok, false);
    assert.equal(e.svc.start(uid, 'tinh-tam-quyet', '15m').ok, false);
    assert.equal(e.svc.learn(uid, 'trong-quyen').ok, false);
    assert.equal(e.svc.setLoadout(uid, ['trong-quyen', 'thiet-bich', 'tat-phong-quyen', 'nhu-van-bo']).ok, false);
    assert.equal(e.svc.cancel(uid, 1).ok, false);
    assert.equal(e.svc.speedup(uid, 1, {}).ok, false);
    assert.equal(e.svc.useVoucher(uid, 1, 1).ok, false);
    assert.equal(e.svc.markSeen(uid, [1]).ok, false);
    assert.deepEqual(e.svc.completeDue(uid), []);
    assert.equal(e.svc.view(uid), null);
    assert.equal(e.svc.recordResult(uid, 'win'), null);
    assert.equal(e.svc.pkIdentity(uid), null);
  }
  assert.deepEqual(Object.keys(e.db.martial.profiles), []);
  assert.equal(Object.getPrototypeOf(e.db.martial.profiles), Object.prototype);

  const s = e.svc.start('u1', 'tinh-tam-quyet', '15m').session;
  for (const m of ['__proto__', 'constructor', 'toString', 'hasOwnProperty', {}, [], 7, null]) {
    assert.equal(e.svc.start('u2', m, '15m').ok, false);
  }
  for (const d of ['__proto__', 'constructor', {}, [], 7, null, 'length']) {
    assert.equal(e.svc.start('u2', 'tinh-tam-quyet', d).ok, false);
  }
  for (const id of ['__proto__', 'constructor', 'toString', {}, [], null, true, NaN, Infinity, 'x'.repeat(1000)]) {
    assert.equal(e.svc.cancel('u1', id).ok, false);
    assert.equal(e.svc.speedup('u1', id, {}).ok, false);
    assert.equal(e.svc.useVoucher('u1', 1, id).ok, false);
    assert.equal(e.svc.complete(id, 'time'), null);
  }
  for (const sk of ['__proto__', 'constructor', 'toString', {}, [], null, 5]) {
    assert.equal(e.svc.learn('u1', sk).ok, false);
  }
  for (const code of ['__proto__', 'constructor', {}, [], null, 5]) {
    assert.equal(e.svc.cancelSpeedup('u1', code).ok, false);
  }
  assert.equal(e.svc.speedup('u1', s.id, null).ok, true, 'tham số phụ null không làm hỏng');
  assert.equal(e.svc.speedup('u1', s.id, 'rác').ok, true);
  assert.equal(e.svc.speedup('u1', s.id, { name: { x: 1 }, anon: 'yes' }).donation.anon, false);
  assert.equal(e.db.martial.sessions[s.id].status, 'active');
  assert.equal(Object.keys(e.db.martial.sessions).length, 1);
  assert.deepEqual(Object.keys(e.db.martial.ledger), []);
  assert.equal({}.polluted, undefined);
});

test('khóa độc hại: dữ liệu cúng dường lạ không phá phiên hay hồ sơ', () => {
  const e = env();
  const evil = { code: 'CDEVIL01', purpose: 'speedup', uid: '__proto__', sessionId: '__proto__', amount: 1, status: 'confirmed' };
  assert.doesNotThrow(() => e.svc.onDonationConfirmed(evil));
  assert.equal(evil.outcome, 'late');
  assert.doesNotThrow(() => e.svc.onDonationClosed({ code: 'CDEVIL02', purpose: 'speedup', uid: 'constructor', sessionId: 'constructor', status: 'cancelled' }));
  assert.deepEqual(Object.keys(e.db.martial.profiles), []);
  assert.deepEqual(Object.keys(e.db.martial.ledger), []);
});

test('hồ sơ do nơi khác tạo thiếu trường vẫn dùng được', () => {
  const e = env();
  e.db.martial.profiles.u9 = { uid: 'u9', congLuc: 70 };
  const s = e.svc.start('u9', 'kim-cuong-tam-phap', '1h');
  assert.equal(s.ok, true);
  const p = e.svc.profile('u9');
  assert.deepEqual(p.tam, { cuong: 0, toc: 0, nhu: 0 });
  assert.deepEqual(p.learned, M.STARTERS);
  assert.equal(e.svc.state('u9').ok, true);
});

test('db thiếu db.martial: dịch vụ tự dựng khung rỗng', () => {
  const db = { donations: [] };
  const store = { save() {}, nextId: (() => { let n = 0; return () => ++n; })() };
  const svc = createMartialService({ db, store, now: () => T0, config: {}, createSpeedupDonation: () => ({}), vnDay });
  assert.deepEqual(Object.keys(db.martial).sort(), ['audit', 'ledger', 'matches', 'profiles', 'sessions']);
  assert.equal(svc.start('u1', 'tinh-tam-quyet', '15m').ok, true);
  assert.equal(svc.speedup('u1', 1, {}).code, 'disabled', 'config rỗng thì hoàn thành ngay tắt');
});

test('toàn bộ luồng: tu, đủ cấp, học chiêu mới, ghép bộ chiêu', () => {
  const e = env();
  e.giveCongLuc('u1', 140);
  const s = e.svc.start('u1', 'kim-cuong-tam-phap', '8h').session;      // +85 công lực, +85 tâm đắc Cương
  e.clock.t = s.endsAt;
  const sw = e.svc.sweep();
  assert.equal(sw[0].update.levelUp, true);
  assert.equal(e.svc.view('u1').level, 3);
  const l = e.svc.learn('u1', 'kim-chung-trao');                           // bậc 2: cấp 3 và 40 tâm đắc Cương
  assert.equal(l.ok, true);
  const set = e.svc.setLoadout('u1', ['kim-chung-trao', 'trong-quyen', 'thiet-bich', 'tat-phong-quyen']);
  assert.equal(set.ok, true);
  assert.deepEqual(set.warnings, []);
  assert.equal(e.svc.pkIdentity('u1').loadout.length, 4);
});

test('dữ liệu lưu ra JSON rồi nạp lại vẫn chạy đúng, không cộng lại', () => {
  const e = env();
  e.giveCongLuc('u1', 60);
  const s = e.svc.start('u1', 'kim-cuong-tam-phap', '1h').session;
  const d = e.svc.speedup('u1', s.id, {}).donation;
  const db2 = JSON.parse(JSON.stringify(e.db));
  let seq = 100;
  const svc2 = createMartialService({
    db: db2, store: { save() {}, nextId: () => ++seq }, now: () => e.clock.t,
    config: { speedupEnabled: true }, createSpeedupDonation: () => { throw new Error('không dùng'); }, vnDay
  });
  assert.equal(svc2.state('u1').session.speedup.code, d.code);
  assert.equal(svc2.speedup('u1', s.id, {}).existing, true);
  e.clock.t = s.endsAt;
  const out = svc2.sweep();
  assert.equal(out.length, 1);
  assert.equal(svc2.profile('u1').congLuc, 75);
  assert.deepEqual(svc2.sweep(), []);
  const d2 = db2.donations[0];
  d2.status = 'confirmed'; d2.confirmedAt = e.clock.t; d2.paidAmount = d2.amount;
  assert.equal(svc2.onDonationConfirmed(d2).outcome, 'late');
  assert.equal(svc2.profile('u1').congLuc, 75);
  assert.equal(svc2.profile('u1').vouchers[0].id, 101);
});

/* ---------- bổ sung: id trùng, cấu hình lạ, chống tạo mã hàng loạt ---------- */

test('start: id trùng phiên hoặc sổ cộng cũ thì lấy id khác, không mất thưởng', () => {
  const db = { donations: [], martial: { profiles: {}, sessions: {}, ledger: {}, matches: [], audit: [] } };
  db.martial.ledger['session:1'] = { uid: 'u9', at: T0, congLuc: 5, tam: { cuong: 0, toc: 0, nhu: 0 } };
  db.martial.sessions[2] = { id: 2, uid: 'u9', methodId: 'tinh-tam-quyet', durationKey: '15m', status: 'completed', completedAt: T0 };
  const ids = [1, 1, 2, 2, 3];
  const store = { save() {}, nextId: () => ids.shift() };
  const clock = { t: T0 };
  const svc = createMartialService({ db, store, now: () => clock.t, config: {}, createSpeedupDonation: () => ({}), vnDay });
  const r = svc.start('u1', 'tinh-tam-quyet', '15m');
  assert.equal(r.ok, true);
  assert.equal(r.session.id, 3);
  assert.equal(db.martial.sessions[2].uid, 'u9', 'phiên cũ không bị ghi đè');
  clock.t += 15 * MIN;
  assert.equal(svc.sweep()[0].update.reward.congLuc, 5);
  // bộ đếm hỏng hẳn: từ chối chứ không ghi đè
  const stuck = createMartialService({ db, store: { save() {}, nextId: () => 2 }, now: () => clock.t, config: {}, createSpeedupDonation: () => ({}), vnDay });
  const bad = stuck.start('u2', 'tinh-tam-quyet', '15m');
  assert.equal(bad.ok, false);
  assert.equal(db.martial.sessions[2].uid, 'u9');
  assert.equal(stuck.profile('u2').activeSession, null);
});

test('timeScale không hợp lệ (0, âm, NaN, chuỗi) thì coi như 1', () => {
  for (const ts of [0, -1, NaN, 'abc', null, undefined, Infinity]) {
    const e = env({ timeScale: ts });
    const s = e.svc.start('u1', 'tinh-tam-quyet', '15m').session;
    assert.equal(s.endsAt - s.startedAt, 15 * MIN, `timeScale=${String(ts)}`);
  }
  const e = env({ timeScale: '0.5' });
  const s = e.svc.start('u1', 'tinh-tam-quyet', '15m').session;
  assert.equal(s.endsAt - s.startedAt, 7.5 * MIN);
});

test('cấu hình giới hạn ngày cũ không tắt tính năng; SPEEDUP_ENABLED là công tắc', () => {
  const e = env({ speedupPerDay: 0 });
  const s = e.svc.start('u1', 'tinh-tam-quyet', '4h').session;
  assert.equal(e.svc.speedup('u1', s.id, {}).ok, true);
  const off = env({ speedupEnabled: false });
  assert.equal(off.svc.state('u1').speedup.enabled, false);
});

test('chống tạo mã hàng loạt: tối đa 10 yêu cầu chưa xác nhận trong 24 giờ, đã xác nhận không tính', () => {
  const e = env({ speedupPerDay: 100 });
  const s = e.svc.start('u1', 'tinh-tam-quyet', '4h').session;
  for (let i = 0; i < 10; i++) {
    const r = e.svc.speedup('u1', s.id, {});
    assert.equal(r.ok, true, `lần ${i + 1}`);
    assert.equal(e.svc.cancelSpeedup('u1', r.donation.code).ok, true);
  }
  const blocked = e.svc.speedup('u1', s.id, {});
  assert.equal(blocked.ok, false);
  assert.equal(blocked.code, 'limit');
  assert.equal(e.db.donations.length, 10, 'không tạo thêm bản ghi');
  assert.equal(e.svc.speedup('u2', e.svc.start('u2', 'tinh-tam-quyet', '4h').session.id, {}).ok, true, 'người khác không bị ảnh hưởng');
  e.clock.t += DAY + 1;
  const s2 = e.svc.start('u1', 'tinh-tam-quyet', '4h').session;
  assert.equal(e.svc.speedup('u1', s2.id, {}).ok, true, 'sau 24 giờ tạo lại được');

  // yêu cầu đã xác nhận không chiếm chỗ
  const f = env({ speedupPerDay: 100 });
  for (let i = 0; i < 12; i++) {
    const t = f.svc.start('u1', 'tinh-tam-quyet', '4h').session;
    const r = f.svc.speedup('u1', t.id, {});
    assert.equal(r.ok, true, `đã xác nhận lần ${i + 1}`);
    f.confirm(r.donation);
  }
  assert.equal(f.svc.profile('u1').congLuc, 12 * 45);
});

test('speedup: tên quá dài bị cắt, thiếu uid ở bản ghi thì được bù', () => {
  const e = env();
  const s = e.svc.start('u1', 'tinh-tam-quyet', '4h').session;
  const d = e.svc.speedup('u1', s.id, { name: 'A'.repeat(500) }).donation;
  assert.equal(d.name.length, 60);

  const db = { donations: [], martial: { profiles: {}, sessions: {}, ledger: {}, matches: [], audit: [] } };
  const svc = createMartialService({
    db, store: { save() {}, nextId: (() => { let n = 0; return () => ++n; })() }, now: () => T0,
    config: { speedupEnabled: true }, vnDay,
    createSpeedupDonation: f => { const x = { code: 'CDBARE01', amount: f.amount, status: 'pending', createdAt: T0 }; db.donations.push(x); return x; }
  });
  const ss = svc.start('u1', 'tinh-tam-quyet', '4h').session;
  const bare = svc.speedup('u1', ss.id, {}).donation;
  assert.equal(bare.uid, 'u1');
  assert.equal(bare.purpose, 'speedup');
  assert.equal(bare.sessionId, ss.id);
  assert.equal(bare.price, 10000);
  assert.equal(svc.cancelSpeedup('u1', bare.code).ok, true, 'hủy được vì đã có uid');
});

test('speedup: hàm tạo trả về thứ lạ thì báo lỗi donation', () => {
  for (const bad of [null, undefined, 5, {}, { code: 7 }]) {
    const db = { donations: [], martial: { profiles: {}, sessions: {}, ledger: {}, matches: [], audit: [] } };
    const svc = createMartialService({
      db, store: { save() {}, nextId: (() => { let n = 0; return () => ++n; })() }, now: () => T0,
      config: { speedupEnabled: true }, vnDay, createSpeedupDonation: () => bad
    });
    const s = svc.start('u1', 'tinh-tam-quyet', '4h').session;
    const r = svc.speedup('u1', s.id, {});
    assert.equal(r.ok, false);
    assert.equal(r.code, 'donation');
    assert.equal(db.martial.sessions[s.id].speedupCode, undefined);
  }
});

/* ---------- bổ sung: mọi đường hoàn thành chỉ cộng một lần ---------- */

test('phiếu: dùng xong rồi tới giờ, sweep và xác nhận muộn đều không cộng lại', () => {
  const e = env();
  e.svc.profile('u1', true).vouchers.push({ id: 50, value: 10000, code: 'CDV', createdAt: T0 });     // đúng bằng giá: đủ
  const s = e.svc.start('u1', 'tinh-tam-quyet', '4h').session;
  const d = e.svc.speedup('u1', s.id, {}).donation;
  const r = e.svc.useVoucher('u1', 50, s.id);
  assert.equal(r.ok, true);
  assert.equal(e.svc.profile('u1').congLuc, 45);
  e.clock.t = s.endsAt + HOUR;
  assert.deepEqual(e.svc.sweep(), []);
  assert.deepEqual(e.svc.completeDue('u1'), []);
  const late = e.confirm(d);
  assert.equal(late.outcome, 'late');
  assert.equal(e.svc.profile('u1').congLuc, 45, 'tiền tới sau khi dùng phiếu: chỉ thêm phiếu, không cộng');
  assert.equal(e.svc.profile('u1').vouchers.length, 2);
  assert.equal(e.svc.state('u1').profile.vouchers.length, 1, 'chỉ phiếu mới chưa dùng hiện ra');
  assert.deepEqual(ledgerKeys(e), ['session:' + s.id]);
});

test('phiếu tặng sau đó dùng tiếp được cho phiên khác, mỗi phiếu một lần', () => {
  const e = env();
  const a = e.svc.start('u1', 'tinh-tam-quyet', '4h').session;
  const d = e.svc.speedup('u1', a.id, {}).donation;
  e.svc.cancel('u1', a.id);
  e.confirm(d, 10000);
  const vid = e.svc.profile('u1').vouchers[0].id;
  const b = e.svc.start('u1', 'tinh-tam-quyet', '1h').session;
  assert.equal(e.svc.useVoucher('u1', String(vid), b.id).ok, true);
  const c = e.svc.start('u1', 'tinh-tam-quyet', '1h').session;
  const again = e.svc.useVoucher('u1', vid, c.id);
  assert.equal(again.ok, false);
  assert.equal(again.code, 'used');
  assert.equal(e.svc.profile('u1').congLuc, 15);
  assert.equal(ledgerKeys(e).length, 1);
});

test('hai yêu cầu cho cùng một phiên (cái đã hủy vẫn được trả tiền): chỉ một lần cộng, cái còn lại thành phiếu', () => {
  const e = env();
  const s = e.svc.start('u1', 'tinh-tam-quyet', '4h').session;
  const a = e.svc.speedup('u1', s.id, {}).donation;
  e.svc.cancelSpeedup('u1', a.code);
  const b = e.svc.speedup('u1', s.id, {}).donation;
  assert.notEqual(a.code, b.code);
  const ra = e.confirm(a);
  assert.equal(ra.outcome, 'applied');
  const rb = e.confirm(b);
  assert.equal(rb.outcome, 'late');
  assert.equal(e.svc.profile('u1').congLuc, 45);
  assert.equal(e.svc.profile('u1').vouchers.length, 1);
  assert.equal(e.svc.profile('u1').vouchers[0].code, b.code);
  assert.deepEqual(ledgerKeys(e), ['session:' + s.id]);
});

test('xác nhận đúng ranh giới giờ: trước 1ms thì hoàn thành ngay, đúng giờ thì đã tự xong nên thành phiếu', () => {
  for (const [offset, outcome] of [[-1, 'applied'], [0, 'late']]) {
    const e = env();
    const s = e.svc.start('u1', 'tinh-tam-quyet', '4h').session;
    const d = e.svc.speedup('u1', s.id, {}).donation;
    e.clock.t = s.endsAt + offset;
    const r = e.confirm(d);
    assert.equal(r.outcome, outcome, `offset ${offset}`);
    assert.equal(e.svc.profile('u1').congLuc, 45);
    assert.equal(e.svc.profile('u1').vouchers.length, outcome === 'late' ? 1 : 0);
    assert.equal(ledgerKeys(e).length, 1);
  }
});

test('trần công lực khi hoàn thành ngay và khi dùng phiếu: sổ cộng ghi phần thật sự cộng', () => {
  const e = env();
  const p = e.svc.profile('u1', true);
  p.congLuc = 2995; p.tam = { cuong: 299, toc: 0, nhu: 0 };
  p.vouchers.push({ id: 60, value: 100000, code: 'CDV', createdAt: T0 });
  const s = e.svc.start('u1', 'vo-cuc-chan-kinh', '8h').session;
  const d = e.svc.speedup('u1', s.id, {}).donation;
  const r = e.confirm(d);
  assert.equal(r.outcome, 'applied');
  assert.deepEqual(r.updates[0].update.reward, { congLuc: 5, tam: { cuong: 1, toc: 51, nhu: 51 } });
  assert.equal(p.congLuc, 3000);
  assert.deepEqual(e.db.martial.ledger['session:' + s.id].tam, { cuong: 1, toc: 51, nhu: 51 });
  // phiên kế dùng phiếu khi đã đầy công lực: phiên vẫn xong, tâm đắc vẫn còn chỗ thì vẫn cộng
  const s2 = e.svc.start('u1', 'vo-cuc-chan-kinh', '8h').session;
  const v = e.svc.useVoucher('u1', 60, s2.id);
  assert.equal(v.ok, true);
  assert.deepEqual(v.updates.at(-1).reward, { congLuc: 0, tam: { cuong: 0, toc: 51, nhu: 51 } });
  assert.equal(p.congLuc, 3000);
  assert.deepEqual(p.tam, { cuong: 300, toc: 102, nhu: 102 });
});

test('tu offline nhiều ngày: sweep hoàn thành đúng một lần cho mỗi người', () => {
  const e = env();
  const a = e.svc.start('u1', 'tinh-tam-quyet', '4h').session;
  const b = e.svc.start('u2', 'tinh-tam-quyet', '15m').session;
  e.clock.t += 3 * DAY;
  const out = e.svc.sweep();
  assert.deepEqual(out.map(x => x.uid).sort(), ['u1', 'u2']);
  for (let i = 0; i < 5; i++) assert.deepEqual(e.svc.sweep(), []);
  assert.equal(e.svc.profile('u1').congLuc, 45);
  assert.equal(e.svc.profile('u2').congLuc, 5);
  const st = e.svc.state('u1');
  assert.equal(st.recent[0].id, a.id);
  assert.equal(st.recent[0].completedAt, e.clock.t, 'tính theo giờ phát hiện, không phải giờ hẹn');
  assert.ok(b.id);
});

test('completeDue của người này không đụng phiên người khác', () => {
  const e = env();
  const a = e.svc.start('u1', 'tinh-tam-quyet', '15m').session;
  e.svc.start('u2', 'tinh-tam-quyet', '15m');
  e.clock.t = a.endsAt;
  assert.equal(e.svc.completeDue('u2').length, 1);
  assert.equal(e.svc.profile('u1').congLuc, 0);
  assert.equal(e.db.martial.sessions[a.id].status, 'active');
  assert.equal(e.svc.completeDue('u2').length, 0);
});

test('learn: phiên vừa tới giờ nâng cấp trước rồi mới xét điều kiện, và trả updates', () => {
  const e = env();
  const p = e.svc.profile('u1', true);
  p.congLuc = 130; p.tam.cuong = 40;           // cấp 2: chưa đủ cấp 3 để học Kim Chung Tráo
  const s = e.svc.start('u1', 'kim-cuong-tam-phap', '1h').session;       // +15 công lực: 145... chưa đủ 150
  e.clock.t = s.endsAt;
  assert.equal(e.svc.learn('u1', 'kim-chung-trao').ok, false);
  const s2 = e.svc.start('u1', 'kim-cuong-tam-phap', '1h').session;       // 160, tâm đắc Cương 70
  e.clock.t = s2.endsAt;
  const r = e.svc.learn('u1', 'kim-chung-trao');
  assert.equal(r.ok, true, 'cấp 3 nhờ phiên vừa xong');
  assert.equal(r.updates.length, 1);
  assert.equal(r.updates[0].kind, 'completed');
  assert.equal(r.updates[0].levelUp, true);
});

/* ---------- bổ sung: hình dạng gói cập nhật, bản sao, kiểu lạ ---------- */

test('gói cập nhật đúng hợp đồng: cancelled, speedup-late, speedup-rejected', () => {
  const e = env();
  const s = e.svc.start('u1', 'tinh-tam-quyet', '4h').session;
  const d = e.svc.speedup('u1', s.id, {}).donation;
  const c = e.svc.cancel('u1', s.id).updates[0];
  assert.deepEqual(Object.keys(c).sort(), ['durationKey', 'kind', 'methodId', 'sessionId', 'text']);
  assert.match(c.text, /Đã hủy phiên tu Tĩnh Tâm Quyết \(4 giờ\)/);
  const late = e.confirm(d).updates[0].update;
  assert.deepEqual(Object.keys(late).sort(), ['durationKey', 'kind', 'methodId', 'sessionId', 'text', 'voucher']);
  assert.deepEqual(Object.keys(late.voucher).sort(), ['id', 'value']);
  const s2 = e.svc.start('u1', 'tinh-tam-quyet', '4h').session;
  const d2 = e.svc.speedup('u1', s2.id, {}).donation;
  d2.status = 'cancelled';
  const rej = e.svc.onDonationClosed(d2).updates[0].update;
  assert.deepEqual(Object.keys(rej).sort(), ['durationKey', 'kind', 'methodId', 'sessionId', 'text']);
  e.clock.t = s2.endsAt;
  const done = e.svc.sweep()[0].update;
  assert.deepEqual(Object.keys(done).sort(), ['durationKey', 'kind', 'levelUp', 'level', 'methodId', 'reward', 'sessionId', 'text', 'via'].sort());
});

test('view và state trả bản sao: sửa kết quả không đổi hồ sơ', () => {
  const e = env();
  e.svc.profile('u1', true).vouchers.push({ id: 5, value: 10000, code: 'C', createdAt: T0 });
  const v = e.svc.view('u1');
  v.learned.push('x'); v.loadout.push('y'); v.tam.cuong = 999; v.vouchers[0].value = 1;
  const p = e.svc.profile('u1');
  assert.equal(p.learned.length, 6);
  assert.deepEqual(p.loadout, []);
  assert.equal(p.tam.cuong, 0);
  assert.equal(p.vouchers[0].value, 10000);
  const s = e.svc.start('u1', 'tinh-tam-quyet', '15m').session;
  s.endsAt = 0;
  assert.equal(e.db.martial.sessions[s.id].endsAt, T0 + 15 * MIN, 'sửa phiên trả về không đổi dữ liệu');
  e.clock.t = T0 + 15 * MIN;
  const st = e.svc.state('u1');
  st.recent[0].reward.congLuc = 9999;
  assert.equal(e.db.martial.sessions[s.id].reward.congLuc, 5);
});

test('uid: dài quá 200 ký tự bị từ chối, đúng 200 thì dùng được; chuỗi lạ làm khóa vẫn an toàn', () => {
  const e = env();
  assert.equal(e.svc.start('x'.repeat(201), 'tinh-tam-quyet', '15m').ok, false);
  assert.equal(e.svc.start('x'.repeat(200), 'tinh-tam-quyet', '15m').ok, true);
  for (const uid of ['toString', 'hasOwnProperty', 'valueOf', '__defineGetter__', 'a.b', 'a b', '日本', ' ']) {
    assert.equal(e.svc.start(uid, 'tinh-tam-quyet', '15m').ok, true, uid);
    assert.equal(e.svc.profile(uid).uid, uid);
  }
  assert.equal(e.svc.profile('other'), null);
  assert.equal(Object.getPrototypeOf(e.db.martial.profiles), Object.prototype);
  assert.equal({}.congLuc, undefined);
});

test('setLoadout: mảng thưa, mảng có phần tử lạ, quá dài', () => {
  const e = env();
  assert.equal(e.svc.setLoadout('u1', new Array(4)).ok, false);
  assert.equal(e.svc.setLoadout('u1', ['trong-quyen', 'thiet-bich', 'tat-phong-quyen', { toString: () => 'nhu-van-bo' }]).ok, false);
  assert.equal(e.svc.setLoadout('u1', new Array(1e5).fill('trong-quyen')).ok, false);
  assert.equal(e.svc.setLoadout('u1', { length: 4, 0: 'a' }).ok, false);
  assert.deepEqual(e.svc.profile('u1', true).loadout, []);
});

test('cancelSpeedup: không động tới cúng dường thường hoặc yêu cầu của phiên người khác', () => {
  const e = env();
  e.db.donations.push({ code: 'CDNORMAL', uid: 'u1', status: 'pending', amount: 50000 });
  assert.equal(e.svc.cancelSpeedup('u1', 'CDNORMAL').ok, false);
  assert.equal(e.db.donations[0].status, 'pending');
  const s = e.svc.start('u2', 'tinh-tam-quyet', '4h').session;
  const d = e.svc.speedup('u2', s.id, {}).donation;
  assert.equal(e.svc.cancelSpeedup('u1', d.code).ok, false);
  assert.equal(d.status, 'pending');
  assert.equal(e.db.martial.sessions[s.id].speedupCode, d.code);
});

test('onDonationConfirmed với cúng dường thường: trả null và không sửa gì', () => {
  const e = env();
  const d = { code: 'CDN', uid: 'u1', status: 'confirmed', amount: 50000, sessionId: 1 };
  const before = JSON.stringify(d);
  assert.equal(e.svc.onDonationConfirmed(d), null);
  assert.equal(JSON.stringify(d), before);
  assert.deepEqual(e.svc.onDonationClosed(d), { updates: [] });
  assert.equal(JSON.stringify(d), before);
  assert.deepEqual(e.db.martial.profiles, {});
});

/* ---------- bổ sung: các lệnh đến cùng lúc theo mọi thứ tự ---------- */

function permutations(arr) {
  if (arr.length <= 1) return [arr];
  return arr.flatMap((x, i) => permutations([...arr.slice(0, i), ...arr.slice(i + 1)]).map(rest => [x, ...rest]));
}

test('lệnh đến cùng lúc theo mọi thứ tự (sweep, xác nhận, phiếu, hủy, state): phần thưởng không bao giờ cộng quá một lần', () => {
  for (const offset of [-1, 0, 7]) {
    for (const order of permutations(['sweep', 'confirm', 'voucher', 'cancel', 'state'])) {
      const e = env();
      e.svc.profile('u1', true).vouchers.push({ id: 70, value: 10000, code: 'CDV', createdAt: T0 });
      const s = e.svc.start('u1', 'tinh-tam-quyet', '4h').session;
      const d = e.svc.speedup('u1', s.id, {}).donation;
      e.clock.t = s.endsAt + offset;
      const ctx = `offset=${offset} thứ tự=${order.join('>')}`;
      for (const op of order) {
        if (op === 'sweep') e.svc.sweep();
        else if (op === 'confirm') e.confirm(d);
        else if (op === 'voucher') e.svc.useVoucher('u1', 70, s.id);
        else if (op === 'cancel') e.svc.cancel('u1', s.id);
        else e.svc.state('u1');
      }
      const p = e.svc.profile('u1'), rec = e.db.martial.sessions[s.id], keys = ledgerKeys(e);
      assert.ok(keys.length <= 1, ctx);
      assert.equal(p.congLuc, keys.length ? 45 : 0, ctx);
      assert.equal(rec.status === 'completed', keys.length === 1, ctx);
      assert.notEqual(rec.status, 'active', ctx);
      assert.equal(p.activeSession, null, ctx);
      assert.ok(['completed', 'cancelled'].includes(rec.status), ctx);
      // tiền đã nhận thì hoặc hoàn thành phiên hoặc thành phiếu, không bao giờ cả hai, không bao giờ không có gì
      if (order.indexOf('confirm') >= 0) {
        assert.ok(d.outcome === 'applied' || d.outcome === 'late', ctx);
        const extra = p.vouchers.filter(v => v.code === d.code).length;
        assert.equal(extra, d.outcome === 'late' ? 1 : 0, ctx);
        if (d.outcome === 'applied') assert.equal(rec.via, 'speedup', ctx);
      }
      const used = p.vouchers.find(v => v.id === 70);
      if (used.usedAt) assert.equal(rec.via, 'voucher', ctx);
      // chạy lại mọi đường một lần nữa: không có gì đổi
      const snap = JSON.stringify([e.db.martial, d]);
      e.svc.sweep(); e.confirm(d); e.svc.useVoucher('u1', 70, s.id); e.svc.cancel('u1', s.id);
      assert.equal(JSON.stringify([e.db.martial, d]), snap, ctx);
    }
  }
});

test('phiếu tặng không bị nhân đôi dù dấu outcome của cúng dường bị mất', () => {
  const e = env();
  const s = e.svc.start('u1', 'tinh-tam-quyet', '4h').session;
  const d = e.svc.speedup('u1', s.id, {}).donation;
  e.svc.cancel('u1', s.id);
  e.confirm(d);
  delete d.outcome; delete d.voucherId;
  const r = e.confirm(d);
  assert.equal(r.outcome, 'late');
  assert.equal(e.svc.profile('u1').vouchers.length, 1, 'tìm lại phiếu theo mã thay vì tặng thêm');
  assert.equal(d.voucherId, e.svc.profile('u1').vouchers[0].id);
});

test('Tảo Địa Tăng: truyền một cảnh giới, một lần mỗi lần gặp và giữ trần công lực', () => {
  const e = env(), encounter = '1234567890abcdef12345678';
  e.giveCongLuc('u1', 100);
  const first = e.svc.inheritSweeper('u1', encounter);
  assert.equal(first.ok, true);
  assert.equal(first.gain, 50);
  assert.equal(first.level, 3);
  assert.equal(e.svc.profile('u1').congLuc, 150);
  assert.equal(e.svc.inheritSweeper('u1', encounter).already, true);
  assert.equal(e.svc.profile('u1').congLuc, 150);
  assert.equal(e.svc.inheritSweeper('u2', encounter).level, 2);
  e.giveCongLuc('max', 3000);
  assert.equal(e.svc.inheritSweeper('max', encounter).code, 'max');
  e.svc.profile('busy', true).activeMatch = 'match-1';
  assert.equal(e.svc.inheritSweeper('busy', encounter).code, 'match');
  assert.equal(e.svc.inheritSweeper('u1', '__proto__').ok, false);
  const snapshot = JSON.parse(JSON.stringify(e.db));
  const restored = createMartialService({ db: snapshot, store: { save() {} }, now: () => e.clock.t, config: {}, vnDay });
  assert.equal(restored.inheritSweeper('u1', encounter).already, true);
  assert.equal(restored.profile('u1').congLuc, 150);
});
