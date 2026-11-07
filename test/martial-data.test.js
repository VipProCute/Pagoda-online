'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../public/js/martial');
const R = require('../lib/pk/rules');
const { Duel } = require('../lib/pk/engine');
const progress = require('../tools/pk-sim/progress');

const BR = ['cuong', 'toc', 'nhu'];
const near = (x, y, eps = 1e-9) => assert.ok(Math.abs(x - y) <= eps, `${x} != ${y}`);
const pctText = x => Math.round(x * 100) + '%';

/* ---------- chiêu ---------- */

test('đúng 15 chiêu, mỗi nhánh 5, id duy nhất và đúng dạng, tên duy nhất', () => {
  assert.equal(M.SKILL_LIST.length, 15);
  assert.equal(Object.keys(M.SKILLS).length, 15);
  const ids = M.SKILL_LIST.map(s => s.id), names = M.SKILL_LIST.map(s => s.name);
  assert.equal(new Set(ids).size, 15);
  assert.equal(new Set(names).size, 15);
  for (const id of ids) assert.match(id, /^[a-z]+(-[a-z]+)*$/);
  for (const b of BR) assert.equal(M.SKILL_LIST.filter(s => s.branch === b).length, 5, b);
  assert.deepEqual(M.BRANCH_ORDER, BR);
  assert.deepEqual(Object.keys(M.BRANCHES).sort(), [...BR].sort());
  for (const s of M.SKILL_LIST) assert.ok(M.BRANCHES[s.branch], s.id);
  for (const id of [M.REST_ID, M.IDLE_ID]) { assert.ok(M.SPECIAL[id]); assert.ok(!M.SKILLS[id]); }
});

test('mỗi nhánh có đủ bậc 1, 1, 2, 3, 4; chiêu đóng băng; điều kiện học khớp bậc', () => {
  for (const b of BR) assert.deepEqual(M.SKILL_LIST.filter(s => s.branch === b).map(s => s.tier).sort(), [1, 1, 2, 3, 4], b);
  for (const s of M.SKILL_LIST) {
    assert.ok(Object.isFrozen(s), s.id);
    assert.deepEqual(s.req, M.TIER_REQ[s.tier], s.id);
    assert.ok(s.name && s.short && s.desc, s.id);
  }
});

test('điều kiện từng bậc: nhập môn có ngay, tăng dần theo cấp và tâm đắc, đạt được trong trần', () => {
  assert.deepEqual(M.TIER_REQ, { 1: { level: 1, tam: 0 }, 2: { level: 3, tam: 40 }, 3: { level: 5, tam: 120 }, 4: { level: 7, tam: 250 } });
  assert.deepEqual(Object.keys(M.TIER_NAMES), ['1', '2', '3', '4']);
  for (let t = 2; t <= 4; t++) {
    assert.ok(M.TIER_REQ[t].level > M.TIER_REQ[t - 1].level);
    assert.ok(M.TIER_REQ[t].tam > M.TIER_REQ[t - 1].tam);
  }
  for (const t of [1, 2, 3, 4]) { assert.ok(M.TIER_REQ[t].level <= M.LEVEL_MAX); assert.ok(M.TIER_REQ[t].tam <= M.TAM_MAX); }
});

const ALLOWED = {
  atk: ['hits'], guard: ['guard'], dodge: ['dodge'], parry: ['parry'], hybrid: ['parry', 'hits'], charge: ['charge']
};
const BASE_KEYS = ['id', 'name', 'branch', 'tier', 'kind', 'mana', 'short', 'desc', 'req'];

test('mỗi chiêu có đủ và chỉ các trường engine cần theo kind', () => {
  for (const s of M.SKILL_LIST) {
    assert.ok(ALLOWED[s.kind], `${s.id}: kind ${s.kind}`);
    const extra = Object.keys(s).filter(k => !BASE_KEYS.includes(k) && !ALLOWED[s.kind].includes(k) && k !== 'pierce');
    assert.deepEqual(extra, [], `${s.id} có trường thừa`);
    for (const k of ALLOWED[s.kind]) assert.ok(s[k], `${s.id} thiếu ${k}`);
    assert.ok(Number.isInteger(s.mana) && s.mana > 0 && s.mana <= M.MANA_BASE, `${s.id}: nội lực ${s.mana} phải dùng được ngay từ cấp 1`);
    const spd = x => assert.ok(Number.isFinite(x) && x > 0 && x <= 100, `${s.id}: tốc độ ${x}`);
    const base = x => assert.ok(Number.isFinite(x) && x > 0 && x < 200, `${s.id}: sát thương ${x}`);
    if (s.hits) { assert.ok(Array.isArray(s.hits) && s.hits.length >= 1 && s.hits.length <= 3); for (const h of s.hits) { base(h.base); spd(h.spd); } }
    if (s.kind === 'guard') assert.ok(s.guard.red > 0 && s.guard.red < 1);
    if (s.kind === 'dodge') spd(s.dodge.spd);
    if (s.kind === 'parry' || s.kind === 'hybrid') {
      const p = s.parry;
      spd(p.spd); assert.ok(p.flat > 0);
      if (p.pct != null) assert.ok(p.pct > 0 && p.pct <= 1 && p.cap > 0, `${s.id}: pct cần cap`);
      if (p.failRed != null) assert.ok(p.failRed > 0 && p.failRed < 1);
    }
    if (s.kind === 'charge') {
      assert.ok(s.charge.red > 0 && s.charge.red < 1);
      base(s.charge.release.base); spd(s.charge.release.spd);
      if (s.charge.release.dodgeMul != null) assert.ok(s.charge.release.dodgeMul > 0 && s.charge.release.dodgeMul < 1);
    }
    if (s.pierce != null) { assert.equal(s.kind, 'atk'); assert.ok(s.pierce > 0 && s.pierce <= 1); }
  }
});

test('số liệu của từng chiêu đúng bảng thiết kế (bắt sửa nhầm con số)', () => {
  const S = M.SKILLS;
  assert.deepEqual([S['trong-quyen'].mana, S['trong-quyen'].hits], [14, [{ base: 38, spd: 30 }]]);
  assert.deepEqual(S['tat-phong-quyen'].hits, [{ base: 25, spd: 95 }]);
  assert.deepEqual(S['lien-hoan-cuoc'].hits, [{ base: 16, spd: 85 }, { base: 16, spd: 85 }]);
  assert.deepEqual(S['lieu-diep-chuong'].hits, [{ base: 22, spd: 80 }]);
  assert.equal(S['lieu-diep-chuong'].pierce, 0.5);
  assert.deepEqual(S['thiet-bich'].guard, { red: 0.65 });
  assert.deepEqual(S['kim-chung-trao'].guard, { red: 0.45, kc: true });
  assert.deepEqual(S['anh-bo-ho-than'].guard, { red: 0.4 });
  assert.deepEqual(S['ta-luc-hoa-giai'].guard, { red: 0.55, rageOnHit: 10 });
  assert.deepEqual(S['khinh-than-bo'].dodge, { spd: 95 });
  assert.deepEqual(S['nhu-van-bo'].dodge, { spd: 80, rageOnDodge: 10 });
  assert.deepEqual(S['phan-chan'].parry, { spd: 50, flat: 20, failRed: 0.25 });
  assert.deepEqual(S['tiep-kinh-phan-chuong'].parry, { spd: 75, flat: 18, pct: 0.2, cap: 14 });
  assert.deepEqual(S['tu-lang-bat-thien-can'].parry, { spd: 70, flat: 25, pct: 0.3, cap: 21 });
  assert.deepEqual(S['doat-anh-phan-kich'].parry, { spd: 80, flat: 24 });
  assert.deepEqual(S['doat-anh-phan-kich'].hits, [{ base: 20, spd: 90 }]);
  assert.deepEqual(S['tu-luc-pha-son'].charge, { red: 0.3, release: { base: 70, spd: 20, dodgeMul: 0.5 } });
  assert.deepEqual(M.SKILL_LIST.map(s => s.mana), [10, 14, 30, 12, 10, 10, 6, 12, 22, 22, 7, 14, 9, 9, 20]);
});

test('lời mô tả nhắc đúng các con số trong dữ liệu', () => {
  for (const s of M.SKILL_LIST) {
    const d = s.desc;
    if (s.kind === 'guard') assert.ok(d.includes(pctText(s.guard.red)), `${s.id}: ${d}`);
    if (s.guard && s.guard.rageOnHit) assert.ok(d.includes(String(s.guard.rageOnHit)), s.id);
    if (s.dodge && s.dodge.rageOnDodge) assert.ok(d.includes(String(s.dodge.rageOnDodge)), s.id);
    if (s.parry) {
      assert.ok(d.includes(String(s.parry.flat)), `${s.id}: ${d}`);
      assert.ok(d.includes(String(s.parry.spd)) || s.kind === 'parry', `${s.id}: ${d}`);
      if (s.parry.failRed) assert.ok(d.includes(pctText(s.parry.failRed)), s.id);
      if (s.parry.pct) { assert.ok(d.includes(pctText(s.parry.pct)), s.id); assert.ok(d.includes(String(s.parry.cap)), s.id); }
    }
    if (s.kind === 'hybrid') assert.ok(d.includes(String(s.hits[0].base)) && d.includes(String(s.hits[0].spd)), s.id);
    if (s.kind === 'charge') {
      assert.ok(d.includes(pctText(s.charge.red)) && d.includes(String(s.charge.release.base)) && d.includes(String(s.charge.release.spd)), s.id);
    }
  }
  assert.match(M.SKILLS['kim-chung-trao'].desc, new RegExp(pctText(R.KC_BONUS)));
  assert.match(M.SKILLS['kim-chung-trao'].desc, /hai lượt/);
  assert.equal(R.KC_TURNS, 2);
  assert.match(M.SPECIAL[M.REST_ID].desc, new RegExp(String(R.REST_BONUS)));
});

test('thông số PK hiển thị cho giao diện khớp lib/pk/rules.js', () => {
  assert.equal(M.PK.HP, R.HP);
  assert.equal(M.PK.TURN_SECONDS * 1000, R.TURN_MS);
  assert.equal(M.PK.LOADOUT_SECONDS * 1000, R.LOADOUT_MS);
  assert.equal(M.PK.REVEAL_SECONDS * 1000, R.REVEAL_MS);
  assert.equal(M.PK.SUDDEN_FROM_TURN, R.SUDDEN_FROM_TURN);
  assert.equal(M.PK.MAX_TURNS, R.MAX_TURNS);
});

test('thứ tự hiển thị: theo nhánh rồi theo bậc; đủ 15 chiêu', () => {
  assert.equal(M.SKILL_ORDER.length, 15);
  assert.deepEqual([...M.SKILL_ORDER].sort(), M.SKILL_LIST.map(s => s.id).sort());
  const seq = M.SKILL_ORDER.map(id => M.SKILLS[id]);
  const bi = b => BR.indexOf(b);
  for (let i = 1; i < seq.length; i++) {
    const p = seq[i - 1], c = seq[i];
    assert.ok(bi(p.branch) < bi(c.branch) || (bi(p.branch) === bi(c.branch) && p.tier <= c.tier));
  }
});

test('chiêu khởi đầu: đúng 6 chiêu bậc 1, mỗi nhánh 2, học được ngay từ hồ sơ trống', () => {
  assert.equal(M.STARTERS.length, 6);
  assert.deepEqual(M.STARTERS.map(id => M.SKILLS[id].tier), [1, 1, 1, 1, 1, 1]);
  for (const b of BR) assert.equal(M.STARTERS.filter(id => M.SKILLS[id].branch === b).length, 2, b);
  const fresh = { congLuc: 0, tam: { cuong: 0, toc: 0, nhu: 0 }, learned: [] };
  for (const s of M.SKILL_LIST) assert.equal(M.canLearn(fresh, s.id).ok, M.STARTERS.includes(s.id), s.id);
  assert.deepEqual([...M.STARTERS].sort(), ['anh-bo-ho-than', 'lieu-diep-chuong', 'nhu-van-bo', 'tat-phong-quyen', 'thiet-bich', 'trong-quyen']);
});

test('người mới chỉ có chiêu khởi đầu vẫn lập được bộ 4 chiêu có đòn tấn công, không cảnh báo', () => {
  const four = M.STARTERS.slice(0, 4);
  assert.equal(M.validateLoadout(four, M.STARTERS).ok, true);
  assert.deepEqual(M.loadoutWarnings(four), []);
});

test('mọi số trong lời mô tả chiêu đều có trong dữ liệu chiêu (chống sửa số mà quên sửa chữ)', () => {
  const nums = (o, out = new Set()) => {
    if (typeof o === 'number') { out.add(String(o)); out.add(String(Math.round(o * 100))); out.add(String(Math.round(o * 1000) / 10)); }
    else if (o && typeof o === 'object') for (const v of Object.values(o)) nums(v, out);
    return out;
  };
  for (const s of M.SKILL_LIST) {
    const ok = nums({ ...s, desc: null, req: null, tier: null });
    ok.add(String(Math.round(R.KC_BONUS * 100)));
    for (const m of s.desc.matchAll(/\d+/g)) assert.ok(ok.has(m[0]), `${s.id}: số ${m[0]} trong mô tả không có trong dữ liệu — "${s.desc}"`);
  }
});

test('phân loại kind: isAttacking / isDamaging', () => {
  const k = id => M.SKILLS[id];
  for (const s of M.SKILL_LIST) {
    assert.equal(M.isAttacking(s), ['atk', 'hybrid', 'charge'].includes(s.kind), s.id);
    assert.equal(M.isDamaging(s), ['atk', 'hybrid', 'charge', 'parry'].includes(s.kind), s.id);
  }
  assert.equal(M.isAttacking(null), false);
  assert.equal(M.isDamaging(undefined), false);
  assert.equal(M.isAttacking(k('thiet-bich')), false);
  assert.deepEqual(Object.keys(M.KIND_NAMES).sort(), ['atk', 'charge', 'dodge', 'guard', 'hybrid', 'idle', 'parry', 'rest']);
});

/* ---------- cấp nội công ---------- */

test('cấp nội công: mốc tăng dần từ 0, 10 cấp, levelOf đúng tại và quanh từng mốc', () => {
  assert.equal(M.LEVEL_AT[0], 0);
  assert.equal(M.LEVEL_MAX, 10);
  assert.equal(M.LEVEL_AT.length, 10);
  for (let i = 1; i < M.LEVEL_AT.length; i++) assert.ok(M.LEVEL_AT[i] > M.LEVEL_AT[i - 1]);
  M.LEVEL_AT.forEach((at, i) => {
    assert.equal(M.levelOf(at), i + 1, 'tại mốc ' + at);
    if (at > 0) assert.equal(M.levelOf(at - 1), i, 'trước mốc ' + at);
  });
  assert.equal(M.levelOf(0), 1);
  assert.equal(M.levelOf(-5), 1);
  assert.equal(M.levelOf(M.CONG_LUC_MAX), 10);
  assert.equal(M.levelOf(1e9), 10);
  assert.equal(M.CONG_LUC_MAX, 3000);
});

test('nội lực tối đa theo cấp: 80 + 4 mỗi cấp, kẹp trong 1..10', () => {
  assert.deepEqual([1, 2, 5, 10].map(M.manaMaxOf), [80, 84, 96, 116]);
  assert.equal(M.manaMaxOf(0), 80);
  assert.equal(M.manaMaxOf(99), 116);
  assert.equal(M.manaMaxOf(-3), 80);
  for (let lv = 1; lv < 10; lv++) assert.ok(M.manaMaxOf(lv + 1) > M.manaMaxOf(lv));
});

test('levelInfo: mốc đầu, mốc cuối, phần trăm đã đi, cấp tối đa không có mốc cuối', () => {
  let i = M.levelInfo(0);
  assert.deepEqual(i, { level: 1, from: 0, to: 60, pct: 0, manaMax: 80 });
  i = M.levelInfo(30);
  assert.equal(i.pct, 0.5);
  i = M.levelInfo(60);
  assert.deepEqual([i.level, i.from, i.to, i.pct], [2, 60, 150, 0]);
  i = M.levelInfo(M.CONG_LUC_MAX);
  assert.deepEqual([i.level, i.from, i.to, i.pct, i.manaMax], [10, 3000, null, 1, 116]);
  i = M.levelInfo(999999);
  assert.equal(i.level, 10);
  i = M.levelInfo(-10);
  assert.equal(i.level, 1);
  for (let c = 0; c <= M.CONG_LUC_MAX; c += 7) { const x = M.levelInfo(c); assert.ok(x.pct >= 0 && x.pct <= 1); assert.ok(c >= x.from && (x.to == null || c < x.to)); }
});

/* ---------- công pháp ---------- */

test('đúng 6 công pháp, id duy nhất, thứ tự, đóng băng', () => {
  assert.equal(M.METHOD_LIST.length, 6);
  assert.equal(new Set(M.METHOD_ORDER).size, 6);
  assert.deepEqual(M.METHOD_ORDER, ['tinh-tam-quyet', 'kim-cuong-tam-phap', 'phi-yen-tam-phap', 'nhu-thuy-tam-kinh', 'cuu-am-tam-kinh', 'vo-cuc-chan-kinh']);
  for (const m of M.METHOD_LIST) { assert.ok(Object.isFrozen(m)); assert.ok(m.name && m.han && m.short && m.desc); assert.equal(M.METHODS[m.id], m); }
});

test('công pháp: mốc cấp yêu cầu tăng dần theo giá; nhánh hợp lệ; tỉ lệ tâm đắc đúng', () => {
  const req = M.METHOD_LIST.map(m => m.reqLevel);
  assert.deepEqual(req, [1, 2, 2, 2, 5, 8]);
  for (const m of M.METHOD_LIST) {
    assert.ok(m.reqLevel >= 1 && m.reqLevel <= M.LEVEL_MAX);
    assert.ok(m.price > 0 && Number.isInteger(m.price));
    assert.ok([null, 'all', ...BR].includes(m.branch), m.id);
  }
  const prices = M.METHOD_LIST.map(m => m.price);
  assert.deepEqual(prices, [10000, 20000, 20000, 20000, 50000, 100000]);
  const by = id => M.METHODS[id];
  assert.equal(by('tinh-tam-quyet').tam, null);
  assert.deepEqual(by('kim-cuong-tam-phap').tam, { cuong: 1 });
  assert.deepEqual(by('phi-yen-tam-phap').tam, { toc: 1 });
  assert.deepEqual(by('nhu-thuy-tam-kinh').tam, { nhu: 1 });
  assert.deepEqual(by('cuu-am-tam-kinh').tam, { cuong: 0.25, toc: 0.25, nhu: 0.25 });
  assert.deepEqual(by('vo-cuc-chan-kinh').tam, { cuong: 0.3, toc: 0.3, nhu: 0.3 });
});

test('thời lượng công pháp: key khớp số phút, công lực tăng theo thời gian, hiệu suất mỗi giờ giảm dần', () => {
  const keyMin = k => { const m = /^(\d+)(m|h)$/.exec(k); return m[2] === 'h' ? +m[1] * 60 : +m[1]; };
  for (const m of M.METHOD_LIST) {
    assert.equal(new Set(m.durations.map(d => d.key)).size, m.durations.length, m.id);
    let last = null;
    for (const d of m.durations) {
      assert.equal(d.minutes, keyMin(d.key), `${m.id} ${d.key}`);
      assert.ok(d.congLuc > 0 && Number.isInteger(d.congLuc));
      if (last) {
        assert.ok(d.minutes > last.minutes && d.congLuc > last.congLuc, `${m.id}: phiên dài hơn phải nhiều hơn`);
        assert.ok(d.congLuc / d.minutes < last.congLuc / last.minutes, `${m.id} ${d.key}: phiên dài hiệu quả mỗi giờ phải thấp hơn`);
      }
      last = d;
    }
  }
});

test('rewardOf: công lực theo bảng, tâm đắc = floor(công lực × tỉ lệ), không biết thì null', () => {
  assert.deepEqual(M.rewardOf('tinh-tam-quyet', '15m'), { congLuc: 5, tam: { cuong: 0, toc: 0, nhu: 0 } });
  assert.deepEqual(M.rewardOf('kim-cuong-tam-phap', '4h'), { congLuc: 50, tam: { cuong: 50, toc: 0, nhu: 0 } });
  assert.deepEqual(M.rewardOf('phi-yen-tam-phap', '8h'), { congLuc: 85, tam: { cuong: 0, toc: 85, nhu: 0 } });
  assert.deepEqual(M.rewardOf('nhu-thuy-tam-kinh', '1h'), { congLuc: 15, tam: { cuong: 0, toc: 0, nhu: 15 } });
  assert.deepEqual(M.rewardOf('cuu-am-tam-kinh', '4h'), { congLuc: 70, tam: { cuong: 17, toc: 17, nhu: 17 } });
  assert.deepEqual(M.rewardOf('vo-cuc-chan-kinh', '12h'), { congLuc: 230, tam: { cuong: 69, toc: 69, nhu: 69 } });
  assert.equal(M.rewardOf('khong-co', '1h'), null);
  assert.equal(M.rewardOf('tinh-tam-quyet', '99h'), null);
  assert.equal(M.rewardOf(undefined, undefined), null);
  for (const m of M.METHOD_LIST) for (const d of m.durations) {
    const r = M.rewardOf(m.id, d.key);
    assert.equal(r.congLuc, d.congLuc);
    for (const b of BR) assert.equal(r.tam[b], m.tam && m.tam[b] ? Math.floor(d.congLuc * m.tam[b]) : 0);
  }
});

test('clampReward: không vượt công lực 3000 và tâm đắc 300 mỗi nhánh; không âm', () => {
  const full = { congLuc: 5, tam: { cuong: 10, toc: 10, nhu: 10 } };
  assert.deepEqual(M.clampReward({ congLuc: 0, tam: {} }, full), full);
  assert.deepEqual(M.clampReward({ congLuc: 2998, tam: { cuong: 295, toc: 300, nhu: 0 } }, full), { congLuc: 2, tam: { cuong: 5, toc: 0, nhu: 10 } });
  assert.deepEqual(M.clampReward({ congLuc: 3000, tam: { cuong: 300, toc: 300, nhu: 300 } }, full), { congLuc: 0, tam: { cuong: 0, toc: 0, nhu: 0 } });
  assert.deepEqual(M.clampReward({ congLuc: 5000, tam: { cuong: 999, toc: 999, nhu: 999 } }, full), { congLuc: 0, tam: { cuong: 0, toc: 0, nhu: 0 } });
  assert.deepEqual(M.clampReward({ congLuc: 0 }, { congLuc: 10, tam: { cuong: 400 } }), { congLuc: 10, tam: { cuong: 300, toc: 0, nhu: 0 } });
});

test('canCultivate: đúng cấp yêu cầu từng công pháp, đúng tại mốc', () => {
  for (const m of M.METHOD_LIST) {
    const at = M.LEVEL_AT[m.reqLevel - 1];
    assert.equal(M.canCultivate({ congLuc: at }, m.id).ok, true, m.id);
    if (at > 0) {
      const r = M.canCultivate({ congLuc: at - 1 }, m.id);
      assert.equal(r.ok, false, m.id);
      assert.match(r.reason, new RegExp(`cấp nội công ${m.reqLevel}`));
    }
  }
  assert.equal(M.canCultivate({ congLuc: 0 }, 'tinh-tam-quyet').ok, true);
  assert.equal(M.canCultivate({}, 'tinh-tam-quyet').ok, true);
  assert.equal(M.canCultivate({ congLuc: 59 }, 'kim-cuong-tam-phap').ok, false);
  assert.equal(M.canCultivate({ congLuc: 60 }, 'kim-cuong-tam-phap').ok, true);
  assert.equal(M.canCultivate({ congLuc: 1699 }, 'vo-cuc-chan-kinh').ok, false);
  assert.equal(M.canCultivate({ congLuc: 1700 }, 'vo-cuc-chan-kinh').ok, true);
  assert.equal(M.canCultivate({ congLuc: 99999 }, 'khong-co').ok, false);
  assert.match(M.canCultivate({ congLuc: 0 }, 'khong-co').reason, /Không có công pháp/);
});

/* ---------- học chiêu ---------- */

const profile = (congLuc, tam = {}, learned = []) => ({ congLuc, tam: { cuong: 0, toc: 0, nhu: 0, ...tam }, learned });

test('canLearn: chiêu không tồn tại, đã học, thiếu cấp, thiếu tâm đắc, thiếu cả hai', () => {
  assert.deepEqual(M.canLearn(profile(0), 'khong-co'), { ok: false, reason: 'Không có chiêu này.' });
  const learned = M.canLearn(profile(9999, { cuong: 300 }, ['trong-quyen']), 'trong-quyen');
  assert.deepEqual(learned, { ok: false, reason: 'Bạn đã học chiêu này.', learned: true });
  const lv = M.canLearn(profile(0, { cuong: 100 }), 'kim-chung-trao');
  assert.equal(lv.ok, false);
  assert.match(lv.reason, /^Cần cấp nội công 3 \(bạn đang cấp 1\)\.$/);
  const tam = M.canLearn(profile(150, { cuong: 39 }), 'kim-chung-trao');
  assert.match(tam.reason, /^Cần 40 tâm đắc Cương \(bạn có 39\)\.$/);
  const both = M.canLearn(profile(0), 'tu-luc-pha-son');
  assert.match(both.reason, /^Cần cấp nội công 7 \(bạn đang cấp 1\) và 250 tâm đắc Cương \(bạn có 0\)\.$/);
  assert.equal(both.missing.length, 2);
  assert.equal(M.canLearn({}, 'trong-quyen').ok, true);
});

test('canLearn: đúng ranh giới điều kiện của MỌI chiêu (đủ → được, thiếu 1 điểm tâm đắc hoặc 1 điểm công lực → không)', () => {
  for (const s of M.SKILL_LIST) {
    const lvAt = M.LEVEL_AT[s.req.level - 1], tamNeed = s.req.tam;
    const ok = profile(lvAt, { [s.branch]: tamNeed });
    assert.equal(M.canLearn(ok, s.id).ok, true, s.id);
    if (tamNeed > 0) assert.equal(M.canLearn(profile(lvAt, { [s.branch]: tamNeed - 1 }), s.id).ok, false, s.id + ' thiếu tâm đắc');
    if (lvAt > 0) assert.equal(M.canLearn(profile(lvAt - 1, { [s.branch]: tamNeed }), s.id).ok, false, s.id + ' thiếu cấp');
    for (const other of BR.filter(b => b !== s.branch)) {
      if (tamNeed > 0) assert.equal(M.canLearn(profile(lvAt, { [other]: 300 }), s.id).ok, false, `${s.id}: tâm đắc nhánh ${other} không thay được`);
    }
    assert.equal(M.canLearn({ ...ok, learned: [s.id] }, s.id).learned, true);
  }
});

test('canLearn: một người đạt cấp 10 và đủ tâm đắc học được cả 15 chiêu', () => {
  const p = profile(M.CONG_LUC_MAX, { cuong: 300, toc: 300, nhu: 300 });
  for (const s of M.SKILL_LIST) assert.equal(M.canLearn(p, s.id).ok, true, s.id);
});

/* ---------- bộ 4 chiêu ---------- */

test('validateLoadout: đúng 4 chiêu khác nhau, tồn tại, đã học', () => {
  const all = M.SKILL_LIST.map(s => s.id);
  const L = all.slice(0, 4);
  assert.equal(M.validateLoadout(L, all).ok, true);
  for (const bad of [null, undefined, 'trong-quyen', {}, [], L.slice(0, 3), [...L, all[4]]]) assert.deepEqual(M.validateLoadout(bad, all), { ok: false, reason: 'Cần chọn đúng 4 chiêu.' });
  assert.deepEqual(M.validateLoadout([L[0], L[0], L[1], L[2]], all), { ok: false, reason: 'Bốn chiêu phải khác nhau.' });
  assert.deepEqual(M.validateLoadout([L[0], L[1], L[2], 'khong-co'], all), { ok: false, reason: 'Có chiêu không tồn tại.' });
  const r = M.validateLoadout(L, [L[0], L[1], L[2]]);
  assert.equal(r.ok, false);
  assert.equal(r.reason, `Bạn chưa học ${M.SKILLS[L[3]].name}.`);
  assert.equal(M.validateLoadout(L, undefined).ok, false);
  assert.equal(M.validateLoadout([M.REST_ID, ...L.slice(0, 3)], all).ok, false, 'Điều tức không nằm trong bộ 4');
});

test('loadoutWarnings: không có đòn chủ động / không gây sát thương; bộ bình thường không cảnh báo', () => {
  const codes = ids => M.loadoutWarnings(ids).map(w => w.code);
  assert.deepEqual(codes(['thiet-bich', 'kim-chung-trao', 'khinh-than-bo', 'anh-bo-ho-than']), ['no-attack', 'no-damage']);
  assert.deepEqual(codes(['thiet-bich', 'kim-chung-trao', 'khinh-than-bo', 'phan-chan']), ['no-attack']);
  assert.deepEqual(codes(['thiet-bich', 'kim-chung-trao', 'khinh-than-bo', 'tat-phong-quyen']), []);
  assert.deepEqual(codes(['thiet-bich', 'kim-chung-trao', 'khinh-than-bo', 'doat-anh-phan-kich']), []);
  assert.deepEqual(codes(['thiet-bich', 'kim-chung-trao', 'khinh-than-bo', 'tu-luc-pha-son']), []);
  assert.deepEqual(codes([]), []);
  assert.deepEqual(codes(['khong-co']), []);
  for (const w of M.loadoutWarnings(['thiet-bich', 'anh-bo-ho-than'])) assert.ok(w.code && w.text.length > 20);
});

test('statsLine: dòng chỉ số ngắn cho thẻ chiêu', () => {
  assert.equal(M.statsLine('trong-quyen'), 'Nội lực 14 · Sát thương 38 · Tốc 30');
  assert.equal(M.statsLine('lien-hoan-cuoc'), 'Nội lực 22 · 2 nhịp × 16 · Tốc 85');
  assert.equal(M.statsLine('thiet-bich'), 'Nội lực 12 · Giảm 65%');
  assert.equal(M.statsLine('khinh-than-bo'), 'Nội lực 10 · Tốc né 95');
  assert.equal(M.statsLine('tiep-kinh-phan-chuong'), 'Nội lực 14 · Tốc đỡ 75 · Phản 18+');
  assert.equal(M.statsLine('phan-chan'), 'Nội lực 10 · Tốc đỡ 50 · Phản 20');
  assert.equal(M.statsLine('doat-anh-phan-kich'), 'Nội lực 22 · Đỡ 80 / Đánh 20');
  assert.equal(M.statsLine('tu-luc-pha-son'), 'Nội lực 30 · Đòn 70 · Tốc 20');
  assert.equal(M.statsLine(M.SKILLS['thiet-bich']), M.statsLine('thiet-bich'));
  assert.equal(M.statsLine('khong-co'), '');
  for (const s of M.SKILL_LIST) assert.match(M.statsLine(s.id), /^Nội lực \d+ · /);
});

/* ---------- ăn khớp với engine ---------- */

test('mọi chiêu dùng được trong engine từ lượt 1 (cấp 1) và gây ra sự kiện đúng loại', () => {
  for (const s of M.SKILL_LIST) {
    const d = new Duel({ seed: 'dl-' + s.id, a: { level: 1, loadout: [s.id] }, b: { level: 1, loadout: [] } });
    assert.ok(d.legal('a').picks.includes(s.id), s.id);
    const o = d.step(s.id, M.REST_ID);
    const first = o.events.find(e => e.k === 'pick' && e.side === 'a');
    assert.equal(first.skill, s.id);
    assert.equal(first.invalid, false);
    const kinds = new Set(o.events.map(e => e.k));
    if (s.kind === 'atk' || s.kind === 'hybrid') assert.ok(kinds.has('hit'), s.id);
    if (s.kind === 'guard') assert.ok(kinds.has('guard'));
    if (s.kind === 'charge') assert.ok(kinds.has('charge') && !kinds.has('hit'));
    assert.equal(o.state.a.mana, 80 - s.mana + R.REGEN);
  }
});

/* ---------- thời gian tu luyện ---------- */

test('thời gian ước tính để học đủ 15 chiêu từ 0 (in ra, chỉ kiểm tra đạt được và nhất quán)', t => {
  const fmt = min => Number.isFinite(min) ? `${(min / 60).toFixed(1)} giờ (${(min / 1440).toFixed(1)} ngày liên tục)` : 'không đạt được';
  const rows = progress.report();
  for (const r of rows) {
    t.diagnostic(`${r.kind}: bậc 2 ${fmt(r.tiers[2].minutes)}; bậc 3 ${fmt(r.tiers[3].minutes)}; đủ 15 chiêu (bậc 4) ${fmt(r.tiers[4].minutes)}; cấp tối đa + tâm đắc đầy ${fmt(r.max.minutes)}`);
    assert.ok(Number.isFinite(r.tiers[4].minutes), r.kind);
    assert.ok(r.tiers[2].minutes < r.tiers[3].minutes && r.tiers[3].minutes < r.tiers[4].minutes && r.tiers[4].minutes < r.max.minutes);
  }
  const best = rows[0];
  assert.ok(best.tiers[4].minutes <= rows[1].tiers[4].minutes && best.tiers[4].minutes <= rows[2].tiers[4].minutes, 'không hạn chế phiên thì không thể lâu hơn');
  const need = progress.needFor(4);
  assert.deepEqual(need, { congLuc: 1200, tam: 750 });
  assert.ok(best.tiers[4].minutes >= need.congLuc / Math.max(...progress.options().map(o => o.congLuc / o.minutes)), 'không thể nhanh hơn tốc độ tối đa của công pháp tốt nhất');
});
