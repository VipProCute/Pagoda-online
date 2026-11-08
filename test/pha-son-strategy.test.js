'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../public/js/martial');
const { Duel } = require('../lib/pk/engine');
const { computeBuff } = require('../lib/pk/buffs');
const TL = 'tu-luc-pha-son', TLB = 'tu-lang-bat-thien-can', REST = M.REST_ID;
const { createMartialService } = require('../lib/martial/service');
const { mergeMartialGuest } = require('../lib/account');

function service(db) {
  const clock = { t: 1_700_000_000_000 };
  let id = 0;
  db = db || { donations: [], martial: { profiles: {}, sessions: {}, ledger: {}, matches: [], audit: [] } };
  const svc = createMartialService({ db, store: { save() {}, nextId: () => ++id }, now: () => clock.t,
    config: { speedupEnabled: true }, vnDay: () => 'day', createSpeedupDonation: data => {
      const d = { code: 'CD' + ++id, status: 'pending', createdAt: clock.t, ...data }; db.donations.push(d); return d;
    } });
  return { svc, clock, db };
}

test('Phá Sơn chắc trúng và xuyên mọi lớp giảm: mọi chiêu trừ Tứ Lạng, nhiều cấp, độ thành thạo và RNG', () => {
  for (const level of [1, 7, 10]) for (const defLevel of [1, 10]) for (const xp of M.MASTERY_AT) for (const roll of [0, 0.5, 0.999999]) {
    for (const id of M.SKILL_ORDER.filter(id => id !== TLB)) {
      const d = new Duel({ rng: () => roll, a: { level, loadout: [TL], mastery: { [TL]: xp } },
        b: { level: defLevel, loadout: [id], mastery: { [id]: M.MASTERY_MAX }, buff: computeBuff({ Lc: 6, Ld: 9 }, 1) } });
      d.step(TL, REST);
      const out = d.step(TL, id);
      const expected = Math.round([70, 90, 115, 145, 180][M.masteryInfo(xp).rank - 1] * (1 + 0.04 * (level - 1)) * (0.9 + 0.2 * roll));
      const hit = out.events.find(e => e.k === 'hit' && e.atk === 'a');
      assert.ok(hit, `${id}: phải trúng`);
      assert.equal(hit.dmg, expected, `${id}: không được giảm sát thương`);
      assert.equal(hit.trueDamage, true);
      assert.ok(!out.events.some(e => ['dodge', 'parry'].includes(e.k) && e.atk === 'a'));
    }
  }
});

test('Tứ Lạng trả nguyên sát thương Phá Sơn, không nhân công người phản và không bị giáp người tung giảm', () => {
  for (const defLevel of [1, 10]) for (const xp of M.MASTERY_AT) for (const roll of [0, 0.999999]) {
    const a = { level: 10, loadout: [TL], mastery: { [TL]: xp }, buff: computeBuff({ Lc: 6, Ld: 9 }, 1) };
    const b = { level: defLevel, loadout: [TLB], buff: computeBuff({ Lq: 4, Ld: 9 }, 1) };
    const d = new Duel({ rng: () => roll, a, b }), baseline = new Duel({ rng: () => roll, a, b });
    d.step(TL, REST); baseline.step(TL, REST);
    const out = d.step(TL, TLB), normal = baseline.step(TL, REST);
    const reflection = out.events.find(e => e.k === 'counter');
    assert.equal(reflection.dmg, normal.events.find(e => e.k === 'hit').dmg);
    assert.equal(d.f.b.hp, 200); assert.equal(d.f.a.hp, 200 - reflection.dmg);
    assert.equal(out.events.find(e => e.k === 'parry').p, 1);
  }
});

test('mọi đòn nhanh đều xuyên Tứ Lạng, kể cả Đại viên mãn và RNG thuận lợi nhất', () => {
  const fast = M.SKILL_LIST.filter(s => s.hits && s.hits.every(h => h.spd >= 80));
  assert.ok(fast.length >= 4);
  for (const skill of fast) {
    const d = new Duel({ rng: () => 0, a: { level: 10, loadout: [skill.id] }, b: { level: 10, loadout: [TLB], mastery: { [TLB]: 240 } } });
    const out = d.step(skill.id, TLB);
    assert.equal(out.events.filter(e => e.k === 'hit').length, skill.hits.length);
    assert.ok(out.events.filter(e => e.k === 'parry').every(e => e.p === 0 && !e.ok));
    assert.equal(out.events.filter(e => e.k === 'counter').length, 0);
    assert.equal(d.f.a.hp, 200);
  }
});

test('Đại viên mãn + nội công cấp 7 trở lên đủ kết liễu kể cả sát thương thấp nhất; phản lại thì người tung thua', () => {
  for (const level of [7, 8, 9, 10]) for (const response of ['thiet-bich', TLB]) {
    const d = new Duel({ rng: () => 0, a: { level, loadout: [TL], mastery: { [TL]: 240 } },
      b: { level: 10, loadout: [response], buff: computeBuff({ Lc: 6, Ld: 9 }, 1) } });
    d.step(TL, REST); d.step(TL, response);
    assert.equal(d.over.result, response === TLB ? 'b' : 'a');
    assert.equal(d.history.length, 2);
  }
});

test('tụ lực không được phòng thủ, có thể bị hạ trước khi tung; chọn Tứ Lạng sai lượt mất nhịp', () => {
  const d = new Duel({ rng: () => 0.5, a: { level: 10, loadout: [TL] }, b: { level: 10, loadout: ['trong-quyen'] } });
  d.f.a.hp = 1;
  d.step(TL, 'trong-quyen'); assert.equal(d.over.result, 'b'); assert.equal(d.history.length, 1);
  const wrong = new Duel({ rng: () => 0.5, a: { level: 10, loadout: [TL], mastery: { [TL]: 240 } }, b: { level: 10, loadout: [TLB] } });
  const first = wrong.step(TL, TLB);
  assert.ok(!first.events.some(e => e.k === 'counter'));
  assert.equal(wrong.f.b.mana, 116 - 20 + 6);
  wrong.step(TL, REST); assert.equal(wrong.over.result, 'a');
});

test('luyện chiêu qua phiên tu: đúng một chiêu, đúng thời lượng, không cộng khi đang chờ, hủy hoặc gọi lại', () => {
  const e = service(), p = e.svc.profile('u', true), id = 'trong-quyen';
  assert.equal(e.svc.start('u', 'tinh-tam-quyet', '15m', TL).code, 'skill');
  let r = e.svc.start('u', 'tinh-tam-quyet', '15m', id);
  assert.equal(r.session.skillId, id); assert.equal(p.mastery[id], 0);
  e.clock.t = r.session.endsAt; e.svc.completeDue('u');
  assert.equal(p.mastery[id], 2); assert.equal(p.mastery['tat-phong-quyen'], 0);
  assert.equal(e.svc.complete(r.session.id, 'time'), null); assert.equal(p.mastery[id], 2);
  r = e.svc.start('u', 'tinh-tam-quyet', '4h', id); e.svc.cancel('u', r.session.id);
  e.clock.t += 24 * 3600e3; e.svc.completeDue('u'); assert.equal(p.mastery[id], 2);
  r = e.svc.start('u', 'tinh-tam-quyet', '1h', id); e.clock.t = r.session.endsAt; e.svc.completeDue('u');
  assert.equal(p.mastery[id], 10); assert.equal(e.svc.state('u').recent[0].practice.xp, 8);
});

test('hoàn thành ngay chỉ cộng thuần thục sau xác nhận; lưu/nạp JSON không cộng lại và vẫn luyện khi nội công đầy', () => {
  const e = service(), p = e.svc.profile('u', true), id = 'trong-quyen';
  p.congLuc = 3000; p.mastery[id] = 230;
  const s = e.svc.start('u', 'tinh-tam-quyet', '4h', id).session;
  const request = e.svc.speedup('u', s.id, {}); assert.equal(request.ok, true); assert.equal(p.mastery[id], 230);
  const d = request.donation; d.status = 'confirmed'; d.confirmedAt = e.clock.t;
  e.svc.onDonationConfirmed(d); assert.equal(p.mastery[id], 240);
  e.svc.onDonationConfirmed(d); assert.equal(p.mastery[id], 240);
  const restored = service(JSON.parse(JSON.stringify(e.db)));
  restored.svc.completeDue('u'); assert.equal(restored.svc.view('u').mastery[id], 240);
  assert.equal(restored.svc.start('u', 'tinh-tam-quyet', '15m', id).code, 'max');
});

test('hồ sơ cũ không bị nâng cấp ảo; map mastery chặn khóa lạ và số ngoài miền; snapshot engine không đổi theo hồ sơ', () => {
  const e = service(), p = e.svc.profile('u', true); delete p.mastery;
  const raw = JSON.parse('{"trong-quyen":9999,"__proto__":240,"constructor":240,"tu-luc-pha-son":240}');
  p.mastery = raw;
  const view = e.svc.view('u'); assert.equal(view.mastery['trong-quyen'], 240); assert.equal(view.mastery[TL], undefined);
  assert.equal(Object.hasOwn(view.mastery, '__proto__'), false);
  assert.equal(Object.hasOwn(view.mastery, 'constructor'), false);
  const fresh = e.svc.profile('old', true); delete fresh.mastery;
  assert.ok(Object.values(e.svc.view('old').mastery).every(v => v === 0));
  const mastery = { [TL]: 0 }, d = new Duel({ rng: () => 0.5, a: { level: 10, loadout: [TL], mastery }, b: { level: 10, loadout: [] } });
  mastery[TL] = 240; d.step(TL, REST);
  assert.equal(d.step(TL, REST).events.find(e => e.k === 'hit').dmg, 95);
});

test('đăng nhập gộp độ thành thạo có trần, đúng một lần và hoàn tác được nếu lưu thất bại', () => {
  const e = service(), guest = e.svc.profile('guest', true), account = e.svc.profile('account', true);
  guest.mastery['trong-quyen'] = 100; account.mastery['trong-quyen'] = 200;
  const undo = mergeMartialGuest(e.db, 'guest', 'account');
  assert.equal(e.svc.view('account').mastery['trong-quyen'], 240);
  assert.equal(mergeMartialGuest(e.db, 'guest', 'account'), null);
  undo(); assert.equal(e.svc.view('account').mastery['trong-quyen'], 200);
  assert.equal(e.svc.view('guest').mastery['trong-quyen'], 100);
});

test('ranh giới độ thành thạo không bỏ bậc và số liệu riêng không sửa dữ liệu chiêu chung', () => {
  for (let i = 1; i < M.MASTERY_AT.length; i++) {
    assert.equal(M.masteryInfo(M.MASTERY_AT[i] - 1).rank, i);
    assert.equal(M.masteryInfo(M.MASTERY_AT[i]).rank, i + 1);
  }
  assert.equal(M.masteryInfo(Infinity).xp, 0); assert.equal(M.masteryInfo(-1).xp, 0);
  const before = JSON.stringify(M.SKILLS);
  for (const id of M.SKILL_ORDER) M.combatSkill(id, 240);
  assert.equal(JSON.stringify(M.SKILLS), before);
  assert.equal(M.combatSkill(TL, 240).charge.release.base, 180);
  assert.equal(M.SKILLS[TL].charge.release.base, 70);
});
