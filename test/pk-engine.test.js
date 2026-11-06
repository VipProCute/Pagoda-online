'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../public/js/martial');
const R = require('../lib/pk/rules');
const { Duel, chance, newFighter, publicState, other } = require('../lib/pk/engine');
const { fromSequence, makeRng } = require('../lib/pk/rng');
const { computeBuff } = require('../lib/pk/buffs');

const TQ = 'trong-quyen', KCT = 'kim-chung-trao', TL = 'tu-luc-pha-son', TB = 'thiet-bich', PC = 'phan-chan';
const KTB = 'khinh-than-bo', ABH = 'anh-bo-ho-than', TPQ = 'tat-phong-quyen', LHC = 'lien-hoan-cuoc', DAP = 'doat-anh-phan-kich';
const NVB = 'nhu-van-bo', TKP = 'tiep-kinh-phan-chuong', TLH = 'ta-luc-hoa-giai', LDC = 'lieu-diep-chuong', TLB = 'tu-lang-bat-thien-can';
const REST = M.REST_ID, IDLE = M.IDLE_ID;

/* rng ép kết quả: OK = thử né / đỡ thành công, NO = hụt, V = dao động sát thương đúng 1,0 */
const OK = 0, NO = 0.999, V = 0.5;
const near = (x, y, eps = 1e-9) => assert.ok(Math.abs(x - y) <= eps, `${x} != ${y}`);

/** Dãy số ép sẵn; gọi quá dãy thì ra NaN (làm hỏng kết quả), đếm số lần gọi để kiểm tra thứ tự dùng rng. */
function seq(...xs) {
  const f = fromSequence(xs, NaN);
  let calls = 0;
  const g = () => { calls++; return f(); };
  g.calls = () => calls;
  g.want = xs.length;
  return g;
}
function duel(la, lb, o = {}) {
  return new Duel({
    seed: 'test', rng: o.rng,
    a: { level: o.lva || 1, loadout: la, buff: o.ba }, b: { level: o.lvb || 1, loadout: lb, buff: o.bb }
  });
}
const done = d => assert.equal(d.rng.calls(), d.rng.want, 'số lần gọi rng phải đúng bằng dãy ép sẵn');
const ev = (out, k, props) => out.events.filter(e => e.k === k && Object.keys(props || {}).every(x => e[x] === props[x]));
const one = (out, k, props) => { const l = ev(out, k, props); assert.equal(l.length, 1, `cần đúng một sự kiện ${k}`); return l[0]; };
const hp = d => [d.f.a.hp, d.f.b.hp];

/* ---------- hàm xác suất ---------- */

test('hàm xác suất: P = 0,1 + 0,8 / (1 + exp(-(Vphòng - Vcông) / 20)), các số trong bảng', () => {
  near(chance(95, 95), 0.5);          // Khinh Thân Bộ 95 vs Tật Phong Quyền 95
  near(chance(80, 80), 0.5);          // Nhu Vân Bộ 80 vs Liễu Diệp Chưởng 80
  near(chance(95, 85), 0.1 + 0.8 / (1 + Math.exp(-0.5)));
  assert.equal(chance(95, 85).toFixed(4), '0.5980');
  assert.equal(chance(95, 30).toFixed(4), '0.8701');   // Khinh Thân vs Trọng Quyền
  assert.equal(chance(75, 95).toFixed(4), '0.3152');   // Tiếp Kình vs Tật Phong
  assert.equal(chance(50, 85).toFixed(4), '0.2184');   // Phản Chấn vs Liên Hoàn
});

test('hàm xác suất: đối xứng P(x,y) + P(y,x) = 1, đơn điệu, nằm trong (0,1; 0,9)', () => {
  for (const [x, y] of [[95, 30], [80, 85], [20, 95], [70, 38], [50, 50]]) near(chance(x, y) + chance(y, x), 1);
  let last = 0;
  for (let v = 0; v <= 200; v += 5) { const p = chance(v, 90); assert.ok(p > last && p > R.PMIN && p < R.PMAX); last = p; }
  assert.ok(chance(1000, 0) <= R.PMAX && chance(-1000, 0) >= R.PMIN);
});

/* ---------- công gặp công / thủ ---------- */

test('công gặp công: cả hai cùng trúng, không ai ngắt ai; nội lực, nộ cập nhật', () => {
  const d = duel([TQ], [TPQ], { rng: seq(V, V) });
  const o = d.step(TQ, TPQ);
  assert.deepEqual(hp(d), [175, 162]);
  assert.equal(ev(o, 'hit').length, 2);
  assert.equal(ev(o, 'dodge').length + ev(o, 'parry').length + ev(o, 'counter').length, 0);
  assert.equal(d.f.a.mana, 80 - 14 + R.REGEN);
  assert.equal(d.f.b.mana, 80 - 12 + R.REGEN);
  near(d.f.a.rage, 0.8 * 25); near(d.f.b.rage, 0.8 * 38);
  assert.equal(o.ended, null);
  done(d);
});

test('công gặp thủ: giảm đúng phần trăm, hit.red khớp', () => {
  let d = duel([TQ], [TB], { rng: seq(V) });
  let o = d.step(TQ, TB);
  assert.equal(d.f.b.hp, 200 - 13);                                  // 38 × 0,35 = 13,3
  assert.equal(one(o, 'hit').red, 0.65);
  assert.deepEqual(one(o, 'guard'), { k: 'guard', side: 'b', red: 0.65 });
  assert.equal(d.f.b.mana, 80 - 12 + R.REGEN);
  done(d);
  d = duel([TPQ], [KCT], { rng: seq(V) });
  d.step(TPQ, KCT);
  assert.equal(d.f.b.hp, 200 - 14);                                  // 25 × 0,55 = 13,75
  d = duel([TQ], [ABH], { rng: seq(V) });
  d.step(TQ, ABH);
  assert.equal(d.f.b.hp, 200 - 23);                                  // 38 × 0,6 = 22,8
});

test('Xuyên kình (Liễu Diệp): bỏ qua một nửa mức giảm của chiêu thủ, chỉ chiêu thủ', () => {
  const cases = [[TB, 0.325, 15], [KCT, 0.225, 17], [ABH, 0.2, 18], [TLH, 0.275, 16]];   // 22 × (1 - red/2)
  for (const [g, red, dmg] of cases) {
    const d = duel([LDC], [g], { rng: seq(V) });
    const o = d.step(LDC, g);
    assert.equal(one(o, 'hit').red, red, g);
    assert.equal(d.f.b.hp, 200 - dmg, g);
  }
  const d = duel([TPQ], [TB], { rng: seq(V) });                       // không xuyên kình thì giảm đủ 65%
  d.step(TPQ, TB);
  assert.equal(d.f.b.hp, 200 - 9);
});

test('Xuyên kình không bỏ qua giảm của tụ lực hay đỡ hụt', () => {
  let d = duel([LDC], [TL], { rng: seq(V, V) });
  d.step(LDC, TL);                                                    // đối thủ tụ lực: giảm 30% giữ nguyên
  assert.equal(d.f.b.hp, 200 - 15);                                   // 22 × 0,7 = 15,4
  d = duel([LDC], [PC], { rng: seq(NO, V) });
  const o = d.step(LDC, PC);
  assert.equal(one(o, 'hit').red, 0.25);
  assert.equal(d.f.b.hp, 200 - 17);                                   // 22 × 0,75 = 16,5 → 17 (làm tròn lên)
});

/* ---------- né ---------- */

test('công gặp né: xác suất theo hàm, né được thì không trúng, kẻ đánh bị sơ hở', () => {
  let d = duel([TPQ], [KTB], { rng: seq(OK) });
  let o = d.step(TPQ, KTB);
  const e = one(o, 'dodge');
  assert.deepEqual(e, { k: 'dodge', atk: 'a', def: 'b', idx: 1, of: 1, p: 0.5, ok: true });
  assert.equal(ev(o, 'hit').length, 0);
  assert.equal(d.f.b.hp, 200);
  assert.equal(d.f.a.exposed, 1);
  assert.equal(one(o, 'exposed').side, 'a');
  assert.equal(d.f.b.mana, 80 - 10 + R.REGEN);
  done(d);
  d = duel([TPQ], [KTB], { rng: seq(NO, V) });                        // né hụt: trúng bình thường
  o = d.step(TPQ, KTB);
  assert.equal(one(o, 'dodge').ok, false);
  assert.equal(d.f.b.hp, 175);
  assert.equal(d.f.a.exposed, 0);
  assert.equal(ev(o, 'exposed').length, 0);
  done(d);
});

test('xác suất né ghi trong sự kiện khớp hàm cho nhiều cặp tốc độ', () => {
  const cases = [[TQ, KTB, 95, 30], [TPQ, NVB, 80, 95], [LDC, NVB, 80, 80], [DAP, KTB, 95, 90], [LHC, NVB, 80, 85]];
  for (const [atk, dod, vp, vc] of cases) {
    const d = duel([atk], [dod], { rng: seq(...new Array(2).fill(OK)) });
    const o = d.step(atk, dod);
    near(one(o, 'dodge', { idx: 1 }).p, Math.round(chance(vp, vc) * 1000) / 1000, 1e-9);
  }
});

test('bảng docs: Khinh Thân 95 vs Tật Phong 95 = 50%, Nhu Vân 80 vs Liễu Diệp 80 = 50%', () => {
  let d = duel([TPQ], [KTB], { rng: seq(OK) });
  assert.equal(one(d.step(TPQ, KTB), 'dodge').p, 0.5);
  d = duel([LDC], [NVB], { rng: seq(OK) });
  assert.equal(one(d.step(LDC, NVB), 'dodge').p, 0.5);
});

test('buff né cộng vào xác suất né, trần 90%', () => {
  let d = duel([TQ], [KTB], { rng: seq(OK), bb: { dodgeB: 0.03 } });
  assert.equal(one(d.step(TQ, KTB), 'dodge').p, 0.9);                 // 0,87 + 0,03 = 0,90
  d = duel([TQ], [KTB], { rng: seq(OK), bb: { dodgeB: 0.08 } });
  assert.equal(one(d.step(TQ, KTB), 'dodge').p, R.DODGE_CAP);         // 0,87 + 0,08 vượt trần
  d = duel([TPQ], [KTB], { rng: seq(OK), bb: { dodgeB: 0.05 } });
  assert.equal(one(d.step(TPQ, KTB), 'dodge').p, 0.55);
});

test('buff né KHÔNG áp dụng cho đỡ', () => {
  const d = duel([TPQ], [TKP], { rng: seq(OK), bb: { dodgeB: 0.08 } });
  near(one(d.step(TPQ, TKP), 'parry').p, Math.round(chance(75, 95) * 1000) / 1000);
});

test('Nhu Vân: né thành công +10 nộ, chỉ một lần mỗi lượt dù né hai nhịp', () => {
  let d = duel([LDC], [NVB], { rng: seq(OK) });
  let o = d.step(LDC, NVB);
  assert.deepEqual(one(o, 'rage', { side: 'b' }), { k: 'rage', side: 'b', delta: 10, value: 10 });
  assert.equal(d.f.b.mana, 80 - 7 + R.REGEN);
  d = duel([LHC], [NVB], { rng: seq(OK, OK) });
  o = d.step(LHC, NVB);
  assert.equal(ev(o, 'dodge').length, 2);
  assert.equal(d.f.b.rage, 10);
  assert.equal(d.f.a.exposed, 1);
  done(d);
  d = duel([LDC], [NVB], { rng: seq(NO, V) });                        // né hụt: không có +10, chỉ nộ do bị đánh
  d.step(LDC, NVB);
  near(d.f.b.rage, 0.8 * 22);
});

test('Nhu Vân: né một nhịp, trúng một nhịp thì +10 và nộ do sát thương nhận', () => {
  const d = duel([LHC], [NVB], { rng: seq(OK, NO, V) });
  const o = d.step(LHC, NVB);
  assert.equal(d.f.b.hp, 200 - 16);
  near(d.f.b.rage, 10 + 0.8 * 16);
  assert.equal(one(o, 'rage', { side: 'b' }).delta, 23);
  assert.equal(d.f.a.exposed, 0);
  done(d);
});

/* ---------- Chấn địa (Tụ Lực Phá Sơn) ---------- */

test('Chấn địa: xác suất NÉ giảm một nửa, ĐỠ vẫn tính bình thường', () => {
  let d = duel([TL], [KTB], { rng: seq(V, OK) });
  d.step(TL, REST);
  let o = d.step(null, KTB);
  near(one(o, 'dodge').p, Math.round(chance(95, 20) * 0.5 * 1000) / 1000);
  assert.equal(one(o, 'dodge').p, 0.441);
  done(d);
  d = duel([TL], [TKP], { rng: seq(OK) });
  d.step(TL, REST);
  o = d.step(null, TKP);
  assert.equal(one(o, 'parry').p, Math.round(chance(75, 20) * 1000) / 1000);
  assert.equal(one(o, 'parry').p, 0.852);
  done(d);
});

test('Chấn địa: kể cả có buff né, xác suất né không quá nửa trần', () => {
  const d = duel([TL], [KTB], { rng: seq(OK), bb: { dodgeB: 0.08 } });
  d.step(TL, REST);
  assert.equal(one(d.step(null, KTB), 'dodge').p, 0.45);
});

/* ---------- đỡ ---------- */

test('đỡ thành công: chặn đòn và phản đúng công thức Tiếp Kình', () => {
  let d = duel([TPQ], [TKP], { rng: seq(OK) });
  let o = d.step(TPQ, TKP);
  near(one(o, 'parry').p, 0.315, 1e-9);
  assert.deepEqual(one(o, 'counter'), { k: 'counter', side: 'b', target: 'a', dmg: 23 });   // 18 + min(14, 0,2 × 25)
  assert.equal(ev(o, 'hit').length, 0);
  assert.deepEqual(hp(d), [200 - 23, 200]);
  assert.equal(d.f.a.exposed, 1);
  assert.equal(d.f.b.mana, 80 - 14 + R.REGEN);
  near(d.f.a.rage, 0.8 * 23);
  done(d);
  d = duel([TQ], [TKP], { rng: seq(OK) });
  o = d.step(TQ, TKP);
  assert.equal(one(o, 'counter').dmg, 26);                            // 18 + 0,2 × 38 = 25,6
  d = duel([TL], [TKP], { rng: seq(V, OK) });
  d.step(TL, REST);
  o = d.step(null, TKP);
  assert.equal(one(o, 'counter').dmg, 32);                            // 18 + min(14, 0,2 × 70)
});

test('đỡ thành công: Tứ Lạng 25 + min(21, 30%), Phản Chấn chỉ 20 phẳng, Đoạt Ảnh 24 phẳng', () => {
  let d = duel([TQ], [TLB], { rng: seq(OK) });
  assert.equal(one(d.step(TQ, TLB), 'counter').dmg, 36);              // 25 + 0,3 × 38 = 36,4
  d = duel([TL], [TLB], { rng: seq(V, OK) });
  d.step(TL, REST);
  assert.equal(one(d.step(null, TLB), 'counter').dmg, 46);            // 25 + min(21, 21)
  d = duel([TQ], [PC], { rng: seq(OK) });
  assert.equal(one(d.step(TQ, PC), 'counter').dmg, 20);
  d = duel([TQ], [DAP], { rng: seq(OK) });
  assert.equal(one(d.step(TQ, DAP), 'counter').dmg, 24);
});

test('đỡ hụt: Phản Chấn giảm 25%, Tiếp Kình / Tứ Lạng / Đoạt Ảnh nhận đủ', () => {
  let d = duel([TPQ], [PC], { rng: seq(NO, V) });
  let o = d.step(TPQ, PC);
  assert.equal(one(o, 'hit').red, 0.25);
  assert.equal(d.f.b.hp, 200 - 19);                                   // 25 × 0,75 = 18,75
  assert.equal(ev(o, 'counter').length, 0);
  assert.equal(d.f.a.exposed, 0);
  for (const g of [TKP, TLB, DAP]) {
    d = duel([TPQ], [g], { rng: seq(NO, V) });
    o = d.step(TPQ, g);
    assert.equal(one(o, 'hit').red, 0, g);
    assert.equal(d.f.b.hp, 175, g);
  }
});

test('phản đòn chịu buff: Quỷ ám của người đỡ, giảm sát thương của kẻ đánh, sơ hở của kẻ đánh', () => {
  let d = duel([TPQ], [TKP], { rng: seq(OK), bb: { offExt: 0.2 } });
  d.step(TPQ, TKP);
  assert.equal(d.f.a.hp, 200 - 28);                                   // 23 × 1,2 = 27,6
  d = duel([TPQ], [TKP], { rng: seq(OK), ba: { defP: 0.1 } });
  d.step(TPQ, TKP);
  assert.equal(d.f.a.hp, 200 - 21);                                   // 23 × 0,9 = 20,7
  d = duel([TPQ, REST], [KTB, TKP], { rng: seq(OK, OK) });
  d.step(TPQ, KTB);                                                   // a bị né → sơ hở
  d.step(TPQ, TKP);
  assert.equal(d.f.a.hp, 200 - 29);                                   // 23 × 1,25 = 28,75
  done(d);
});

test('phản đòn KHÔNG nhân nộ hay Kim Chung của người đỡ, chỉ buff ngoài', () => {
  const d = duel([TPQ], [TKP], { rng: seq(OK) });
  d.f.b.rage = 100; d.f.b.kc = 2;
  d.step(TPQ, TKP);
  assert.equal(d.f.a.hp, 200 - 23);
});

/* ---------- đòn hai nhịp ---------- */

test('Liên Hoàn vs Phản Chấn: đỡ cả hai nhịp, phản MỘT lần đủ 20, kẻ đánh sơ hở', () => {
  const d = duel([LHC], [PC], { rng: seq(OK, OK) });
  const o = d.step(LHC, PC);
  assert.equal(ev(o, 'parry').length, 2);
  assert.deepEqual(ev(o, 'parry').map(e => [e.idx, e.of, e.ok]), [[1, 2, true], [2, 2, true]]);
  assert.equal(ev(o, 'counter').length, 1);
  assert.equal(one(o, 'counter').dmg, 20);
  assert.equal(ev(o, 'hit').length, 0);
  assert.deepEqual(hp(d), [180, 200]);
  assert.equal(d.f.a.exposed, 1);
  assert.equal(one(o, 'parry', { idx: 1 }).p, 0.218);
  done(d);
});

test('Liên Hoàn vs Phản Chấn: đỡ một nhịp (nhịp 1 hoặc 2), phản theo tỉ lệ, KHÔNG sơ hở', () => {
  for (const [rs, hitIdx] of [[[OK, NO, V], 2], [[NO, V, OK], 1]]) {
    const d = duel([LHC], [PC], { rng: seq(...rs) });
    const o = d.step(LHC, PC);
    assert.equal(ev(o, 'parry').length, 2);
    assert.equal(ev(o, 'hit').length, 1);
    assert.equal(one(o, 'hit').idx, hitIdx);
    assert.equal(one(o, 'hit').dmg, 12);                              // 16 × 0,75
    assert.equal(one(o, 'hit').red, 0.25);
    assert.equal(ev(o, 'counter').length, 1);
    assert.equal(one(o, 'counter').dmg, 10);                          // 20 × 1/2
    assert.deepEqual(hp(d), [190, 188]);
    assert.equal(d.f.a.exposed, 0);
    assert.equal(ev(o, 'exposed').length, 0);
    done(d);
  }
});

test('Liên Hoàn vs Phản Chấn: đỡ hụt cả hai nhịp, không phản', () => {
  const d = duel([LHC], [PC], { rng: seq(NO, V, NO, V) });
  const o = d.step(LHC, PC);
  assert.equal(ev(o, 'hit').length, 2);
  assert.equal(ev(o, 'counter').length, 0);
  assert.equal(d.f.b.hp, 200 - 24);
  assert.equal(d.f.a.exposed, 0);
  done(d);
});

test('Liên Hoàn vs Tiếp Kình: phản MỘT lần theo tỉ lệ nhịp chặn (21 hoặc 11)', () => {
  let d = duel([LHC], [TKP], { rng: seq(OK, OK) });
  assert.equal(one(d.step(LHC, TKP), 'counter').dmg, 21);            // 18 + min(14, 0,2 × 16) = 21,2
  d = duel([LHC], [TKP], { rng: seq(OK, NO, V) });
  assert.equal(one(d.step(LHC, TKP), 'counter').dmg, 11);            // 21,2 × 1/2 = 10,6
});

test('Liên Hoàn vs né: né hai nhịp → sơ hở; né một nhịp → không sơ hở', () => {
  let d = duel([LHC], [KTB], { rng: seq(OK, OK) });
  d.step(LHC, KTB);
  assert.equal(d.f.a.exposed, 1);
  d = duel([LHC], [KTB], { rng: seq(OK, NO, V) });
  d.step(LHC, KTB);
  assert.equal(d.f.a.exposed, 0);
  assert.equal(d.f.b.hp, 200 - 16);
});

test('Liên Hoàn trúng cả hai nhịp: hai sự kiện hit, mỗi nhịp 16', () => {
  const d = duel([LHC], [REST], { rng: seq(V, V) });
  const o = d.step(LHC, REST);
  assert.deepEqual(ev(o, 'hit').map(e => [e.idx, e.of, e.dmg]), [[1, 2, 16], [2, 2, 16]]);
  assert.equal(d.f.b.hp, 168);
});

/* ---------- Đoạt Ảnh Phản Kích ---------- */

test('Đoạt Ảnh gặp công → đỡ, KHÔNG đánh', () => {
  let d = duel([DAP], [TQ], { rng: seq(OK) });
  let o = d.step(DAP, TQ);
  assert.equal(one(o, 'parry').def, 'a');
  assert.equal(one(o, 'parry').p, 0.839);
  assert.equal(one(o, 'counter').dmg, 24);
  assert.equal(ev(o, 'hit').length, 0);
  assert.deepEqual(hp(d), [200, 176]);
  assert.equal(d.f.a.mana, 80 - 22 + R.REGEN);
  assert.equal(d.f.b.exposed, 1);
  assert.equal(d.f.a.exposed, 0);                                      // đỡ không phải tấn công
  done(d);
  d = duel([DAP], [TQ], { rng: seq(NO, V) });                          // đỡ hụt: nhận đủ 38
  d.step(DAP, TQ);
  assert.equal(d.f.a.hp, 162);
  assert.equal(d.f.b.hp, 200);
});

test('Đoạt Ảnh gặp tụ lực tung đòn → đỡ; gặp tụ lực lượt 1 → đánh (đối thủ giảm 30%)', () => {
  let d = duel([DAP], [TL], { rng: seq(V, OK) });
  d.step(REST, TL);
  const o = d.step(DAP, null);
  assert.equal(one(o, 'parry').p, 0.862);
  assert.equal(one(o, 'counter').dmg, 24);
  assert.equal(ev(o, 'hit').length, 0);
  d = duel([DAP], [TL], { rng: seq(V) });
  const o1 = d.step(DAP, TL);
  assert.equal(one(o1, 'hit').dmg, 14);                                // 20 × 0,7
  assert.equal(one(o1, 'hit').red, 0.3);
  assert.equal(ev(o1, 'parry').length, 0);
  done(d);
});

test('Đoạt Ảnh gặp thủ / né / nghỉ / đứng yên / chiêu hợp lệ nhưng thiếu nội lực → đánh', () => {
  let d = duel([DAP], [TB], { rng: seq(V) });
  assert.equal(one(d.step(DAP, TB), 'hit').dmg, 7);                    // 20 × 0,35
  d = duel([DAP], [KTB], { rng: seq(NO, V) });
  let o = d.step(DAP, KTB);
  assert.equal(one(o, 'dodge').p, 0.55);
  assert.equal(one(o, 'hit').dmg, 20);
  d = duel([DAP], [], { rng: seq(V) });
  assert.equal(one(d.step(DAP, REST), 'hit').dmg, 20);
  d = duel([DAP], [], { rng: seq(V) });
  assert.equal(one(d.step(DAP, null), 'hit').dmg, 20);
  d = duel([DAP], [TQ], { rng: seq(V) });
  d.f.b.mana = 5;                                                      // Trọng Quyền không đủ nội lực → Đứng yên
  o = d.step(DAP, TQ);
  assert.equal(one(o, 'pick', { side: 'b' }).skill, IDLE);
  assert.equal(one(o, 'hit').dmg, 20);
  done(d);
});

test('Đoạt Ảnh gặp đỡ → đánh (đỡ không phải tấn công)', () => {
  const d = duel([DAP], [TKP], { rng: seq(NO, V) });
  const o = d.step(DAP, TKP);
  assert.equal(one(o, 'parry').def, 'b');
  assert.equal(one(o, 'hit').dmg, 20);
});

test('Đoạt Ảnh gặp chính nó → cả hai đều đánh, không ai đỡ', () => {
  const d = duel([DAP], [DAP], { rng: seq(V, V) });
  const o = d.step(DAP, DAP);
  assert.equal(ev(o, 'parry').length, 0);
  assert.equal(ev(o, 'hit').length, 2);
  assert.deepEqual(hp(d), [180, 180]);
  assert.equal(d.f.a.rage, 0.8 * 20);
});

test('Đoạt Ảnh đánh bị né hết → sơ hở như mọi đòn đánh; đỡ rồi thì nộ không bị xóa', () => {
  let d = duel([DAP], [KTB], { rng: seq(OK) });
  d.step(DAP, KTB);
  assert.equal(d.f.a.exposed, 1);
  d = duel([DAP], [TQ], { rng: seq(NO, V) });
  d.f.a.rage = 40;
  d.step(DAP, TQ);                                                     // đỡ (không tấn công) → nộ giữ, cộng thêm do nhận đòn
  near(d.f.a.rage, 40 + 0.8 * 38);
});

/* ---------- tụ lực ---------- */

test('tụ lực: lượt 1 không tấn công, trừ nội lực, phase charge; lượt 2 bị ép tung', () => {
  const d = duel([TL, TQ], [REST], { rng: seq(V) });
  let o = d.step(TL, REST);
  assert.deepEqual(one(o, 'pick', { side: 'a' }), { k: 'pick', side: 'a', skill: TL, phase: 'charge', auto: false, invalid: false, mana: 30 });
  assert.equal(ev(o, 'charge').length, 1);
  assert.equal(ev(o, 'hit').length, 0);
  assert.equal(d.f.a.mana, 80 - 30 + R.REGEN);
  assert.equal(d.f.a.charging, TL);
  assert.equal(d.forced('a'), TL);
  assert.deepEqual(d.legal('a'), { forced: TL, picks: [TL] });
  assert.equal(d.validatePick('a', TQ).ok, false);
  assert.equal(d.validatePick('a', REST).ok, false);
  assert.equal(d.validatePick('a', TL).ok, true);
  o = d.step(TQ, REST);                                                // cố chọn chiêu khác vẫn bị ép tung
  assert.deepEqual(one(o, 'pick', { side: 'a' }), { k: 'pick', side: 'a', skill: TL, phase: 'release', auto: true, invalid: false, mana: 0 });
  assert.equal(ev(o, 'release').length, 1);
  assert.equal(one(o, 'hit').dmg, 70);
  assert.equal(d.f.b.hp, 130);
  assert.equal(d.f.a.mana, 80 - 30 + R.REGEN + R.REGEN);
  assert.equal(d.f.a.charging, null);
  assert.equal(d.forced('a'), null);
  done(d);
});

test('tụ lực: chọn đúng chiêu tụ lực ở lượt 2 thì auto = false', () => {
  const d = duel([TL], [REST], { rng: seq(V) });
  d.step(TL, REST);
  const o = d.step(TL, REST);
  assert.equal(one(o, 'pick', { side: 'a' }).auto, false);
});

test('tụ lực: lượt 1 giảm 30% sát thương nhận và KHÔNG bị ngắt khi bị đánh', () => {
  const d = duel([TL], [TQ], { rng: seq(V, V) });
  let o = d.step(TL, TQ);
  assert.equal(one(o, 'hit').red, 0.3);
  assert.equal(one(o, 'hit').dmg, 27);                                 // 38 × 0,7 = 26,6
  assert.equal(d.f.a.charging, TL);
  near(d.f.a.rage, 0.8 * 27);
  o = d.step(null, REST);                                              // lượt 2 vẫn tung, có cộng nộ đã tích
  assert.equal(ev(o, 'release').length, 1);
  assert.equal(one(o, 'hit').dmg, Math.round(70 * (1 + 0.003 * 21.6)));
  done(d);
});

test('tụ lực: lượt tung đòn không còn giảm sát thương (đang bị đánh vẫn nhận đủ)', () => {
  const d = duel([TL], [TPQ], { rng: seq(V, V, V) });
  d.step(TL, REST);
  const o = d.step(null, TPQ);
  const toA = ev(o, 'hit', { def: 'a' })[0];
  assert.equal(toA.dmg, 25);
  assert.equal(toA.red, 0);
  assert.equal(ev(o, 'hit', { def: 'b' })[0].dmg, 70);
});

test('tụ lực: hết nội lực vẫn tung, mana không âm', () => {
  const d = duel([TL], [REST], { rng: seq(V) });
  d.step(TL, REST);
  d.f.a.mana = 0;
  const o = d.step(null, REST);
  assert.equal(one(o, 'hit').dmg, 70);
  assert.equal(d.f.a.mana, R.REGEN);
});

test('tụ lực: đối thủ né → vẫn tiêu nộ và Kim Chung, kẻ tung đòn sơ hở', () => {
  const d = duel([TL], [KTB], { rng: seq(OK) });
  d.step(TL, REST);
  d.f.a.rage = 40; d.f.a.kc = 2;
  const o = d.step(null, KTB);
  assert.equal(one(o, 'dodge').ok, true);
  assert.equal(d.f.a.rage, 0);
  assert.equal(d.f.a.kc, 0);
  assert.equal(d.f.a.exposed, 1);
  assert.equal(d.f.b.hp, 200);
  done(d);
});

test('tụ lực: đối thủ đỡ → tiêu nộ, Kim Chung, bị phản', () => {
  const d = duel([TL], [TKP], { rng: seq(OK) });
  d.step(TL, REST);
  d.f.a.rage = 40; d.f.a.kc = 1;
  const o = d.step(null, TKP);
  assert.equal(one(o, 'counter').dmg, 32);
  assert.equal(d.f.a.kc, 0);
  near(d.f.a.rage, 0.8 * 32);
  assert.equal(d.f.a.exposed, 1);
});

test('tụ lực: nộ và Kim Chung cộng vào đòn tung (tính theo trạng thái đầu lượt 2)', () => {
  const d = duel([TL], [REST], { rng: seq(V) });
  d.step(TL, REST);
  d.f.a.rage = 100; d.f.a.kc = 2;
  d.step(null, REST);
  assert.equal(d.f.b.hp, 200 - 105);                                   // 70 × 1,5 (0,3 + 0,25 chưa chạm trần 0,5? có: 0,55 → 0,5)
});

test('tụ lực: tung xong có thể tụ lực lại nếu đủ nội lực', () => {
  const d = duel([TL], [REST], { rng: seq(V) });
  d.step(TL, REST);
  d.step(null, REST);
  assert.ok(d.legal('a').picks.includes(TL));
  const o = d.step(TL, REST);
  assert.equal(one(o, 'pick', { side: 'a' }).phase, 'charge');
  assert.equal(d.f.a.charging, TL);
});

test('chiêu thiếu nội lực không hợp lệ: không có trong legal, validatePick từ chối', () => {
  const d = duel([TL, TQ, ABH], [REST]);
  d.f.a.mana = 13;
  assert.deepEqual(d.legal('a').picks, [ABH, REST]);
  assert.equal(d.validatePick('a', TQ).ok, false);
  assert.match(d.validatePick('a', TQ).reason, /nội lực/);
  d.f.a.mana = 14;
  assert.deepEqual(d.legal('a').picks, [TQ, ABH, REST]);
  d.f.a.mana = 30;
  assert.ok(d.legal('a').picks.includes(TL));
  assert.equal(d.validatePick('a', IDLE).ok, false);
  assert.equal(d.validatePick('a', 'khong-co').ok, false);
  assert.match(d.validatePick('a', 'khong-co').reason, /bộ 4 chiêu/);
});

/* ---------- Kim Chung Tráo ---------- */

test('Kim Chung: chỉ cộng khi thực sự bị trúng; không bị đánh thì không', () => {
  let d = duel([KCT], [TQ], { rng: seq(V) });
  let o = d.step(KCT, TQ);
  assert.equal(d.f.a.hp, 200 - 21);                                    // 38 × 0,55 = 20,9
  assert.equal(d.f.a.kc, R.KC_TURNS);
  assert.equal(ev(o, 'kc').length, 1);
  d = duel([KCT], [], { rng: seq() });
  o = d.step(KCT, REST);
  assert.equal(d.f.a.kc, 0);
  assert.equal(ev(o, 'kc').length, 0);
  d = duel([KCT], [], { rng: seq() });
  d.step(KCT, null);
  assert.equal(d.f.a.kc, 0);
});

test('Kim Chung: đòn công chủ động kế tiếp +25% rồi hết; đòn bị né vẫn tiêu', () => {
  let d = duel([KCT, TPQ], [TQ, REST], { rng: seq(V, V) });
  d.step(KCT, TQ);
  d.f.a.rage = 0;
  d.step(TPQ, REST);
  assert.equal(d.f.b.hp, 200 - 31);                                    // 25 × 1,25 = 31,25
  assert.equal(d.f.a.kc, 0);
  done(d);
  d = duel([KCT, TPQ], [TQ, KTB], { rng: seq(V, OK) });
  d.step(KCT, TQ);
  d.step(TPQ, KTB);
  assert.equal(d.f.a.kc, 0);
  done(d);
});

test('Kim Chung: kéo dài đúng 2 lượt (nghỉ một lượt vẫn còn, nghỉ hai lượt hết)', () => {
  let d = duel([KCT, TPQ], [TQ, REST], { rng: seq(V, V) });
  d.step(KCT, TQ); d.f.a.rage = 0;
  d.step(REST, REST);
  assert.equal(d.f.a.kc, 1);
  d.step(TPQ, REST);
  assert.equal(d.f.b.hp, 200 - 31);
  done(d);
  d = duel([KCT, TPQ], [TQ, REST], { rng: seq(V, V) });
  d.step(KCT, TQ); d.f.a.rage = 0;
  d.step(REST, REST); d.step(REST, REST);
  assert.equal(d.f.a.kc, 0);
  d.step(TPQ, REST);
  assert.equal(d.f.b.hp, 200 - 25);
  done(d);
});

test('Kim Chung: dùng liên tiếp chỉ làm mới, không cộng dồn', () => {
  const d = duel([KCT, TPQ], [TQ, REST], { rng: seq(V, V, V) });
  d.step(KCT, TQ);
  d.step(KCT, TQ);
  assert.equal(d.f.a.kc, R.KC_TURNS);
  d.f.a.rage = 0;
  d.step(TPQ, REST);
  assert.equal(d.f.b.hp, 200 - 31);
  done(d);
});

test('Kim Chung dùng khi không bị đánh giữa chừng: giữ nguyên rồi đếm lùi', () => {
  const d = duel([KCT], [TQ, REST], { rng: seq(V) });
  d.step(KCT, TQ);
  d.step(KCT, REST);                                                   // không bị đánh → không làm mới, đếm lùi
  assert.equal(d.f.a.kc, 1);
});

/* ---------- nộ ---------- */

test('nộ tăng 0,8 mỗi điểm sát thương nhận, làm tròn khi hiển thị, tối đa 100', () => {
  const d = duel([TB], [TQ], { rng: seq(V, V, V, V, V, V, V, V, V, V, V, V) });
  d.f.a.rage = 90;
  const o = d.step(TB, TQ);
  assert.deepEqual(one(o, 'rage', { side: 'a' }), { k: 'rage', side: 'a', delta: 10, value: 100 });
  assert.equal(d.f.a.rage, 100);
  assert.equal(d.state('a').rage, 100);
  const e = duel([REST], [TQ], { rng: seq(V) });
  const o2 = e.step(REST, TQ);
  near(e.f.a.rage, 30.4);
  assert.deepEqual(one(o2, 'rage', { side: 'a' }), { k: 'rage', side: 'a', delta: 30, value: 30 });
});

test('nộ cộng vào đòn công chủ động (100 nộ = +30%), tiêu khi tung đòn kể cả bị né', () => {
  let d = duel([TQ], [REST], { rng: seq(V) });
  d.f.a.rage = 50;
  d.step(TQ, REST);
  assert.equal(d.f.b.hp, 200 - 44);                                    // 38 × 1,15 = 43,7
  assert.equal(d.f.a.rage, 0);
  d = duel([TQ], [REST], { rng: seq(V) });
  d.f.a.rage = 100;
  d.step(TQ, REST);
  assert.equal(d.f.b.hp, 200 - 49);                                    // 38 × 1,3 = 49,4
  d = duel([TPQ], [KTB], { rng: seq(OK) });
  d.f.a.rage = 70;
  d.step(TPQ, KTB);
  assert.equal(d.f.a.rage, 0);
});

test('nộ không mất khi thủ, né, nghỉ hay đứng yên', () => {
  for (const [sk, opp] of [[TB, REST], [KTB, REST], [REST, REST], [null, REST]]) {
    const d = duel([TB, KTB], [], { rng: seq() });
    d.f.a.rage = 60;
    const o = d.step(sk, opp);
    assert.equal(d.f.a.rage, 60);
    assert.equal(ev(o, 'rage').length, 0);
  }
});

test('nộ cộng cả từ sát thương phản đòn nhận phải', () => {
  const d = duel([TQ], [TKP], { rng: seq(OK) });
  d.step(TQ, TKP);
  near(d.f.a.rage, 0.8 * 26);
});

test('tổng tăng sát thương bị chặn ở +50% (nộ + Kim Chung + Quỷ ám/hào quang)', () => {
  const d = duel([TQ], [REST], { rng: seq(V), ba: { offExt: 0.2 } });
  d.f.a.rage = 100; d.f.a.kc = 2;                                      // 0,3 + 0,25 + 0,2 = 0,75 → 0,5
  d.step(TQ, REST);
  assert.equal(d.f.b.hp, 200 - 57);
});

test('buff Quỷ ám cộng vào sát thương; Pháp tướng giảm sát thương nhận', () => {
  let d = duel([TQ], [REST], { rng: seq(V), ba: { offExt: 0.1 } });
  d.step(TQ, REST);
  assert.equal(d.f.b.hp, 200 - 42);                                    // 38 × 1,1 = 41,8
  d = duel([TQ], [REST], { rng: seq(V), bb: { defP: 0.1 } });
  d.step(TQ, REST);
  assert.equal(d.f.b.hp, 200 - 34);                                    // 38 × 0,9 = 34,2
});

test('sát thương tối thiểu 1 mỗi nhịp trúng và mỗi lần phản đòn', () => {
  let d = duel([TPQ], [TB], { rng: seq(V), bb: { defP: 0.99 } });
  assert.equal(one(d.step(TPQ, TB), 'hit').dmg, 1);
  d = duel([TPQ], [TKP], { rng: seq(OK), ba: { defP: 0.99 } });
  assert.equal(one(d.step(TPQ, TKP), 'counter').dmg, 1);
});

/* ---------- Tá Lực ---------- */

test('Tá Lực Hóa Giải: +10 nộ chỉ khi thực sự bị trúng', () => {
  let d = duel([TLH], [TQ], { rng: seq(V) });
  let o = d.step(TLH, TQ);
  assert.equal(d.f.a.hp, 200 - 17);                                    // 38 × 0,45 = 17,1
  near(d.f.a.rage, 0.8 * 17 + 10);
  assert.equal(one(o, 'rage', { side: 'a' }).delta, 24);
  d = duel([TLH], [], { rng: seq() });
  o = d.step(TLH, REST);
  assert.equal(d.f.a.rage, 0);
  assert.equal(ev(o, 'rage').length, 0);
});

test('Tá Lực: bị Liên Hoàn đánh hai nhịp vẫn chỉ +10 một lần', () => {
  const d = duel([TLH], [LHC], { rng: seq(V, V) });
  d.step(TLH, LHC);
  assert.equal(d.f.a.hp, 200 - 2 * 7);                                 // 16 × 0,45 = 7,2 → 7 mỗi nhịp
  near(d.f.a.rage, 0.8 * 14 + 10);
});

/* ---------- sơ hở ---------- */

test('Sơ hở: lượt sau nhận +25%, chỉ một lượt', () => {
  const d = duel([TPQ, TB], [KTB, TQ], { rng: seq(OK, V, V) });
  d.step(TPQ, KTB);                                                    // a bị né hết → sơ hở
  assert.equal(d.f.a.exposed, 1);
  assert.equal(d.state('a').exposed, 1);
  const o = d.step(REST, TQ);
  assert.equal(one(o, 'hit').dmg, 48);                                 // 38 × 1,25 = 47,5
  assert.equal(d.f.a.exposed, 0);                                      // nghỉ nên hết sơ hở
  d.step(REST, TQ);
  assert.equal(d.f.a.hp, 200 - 48 - 38);
  done(d);
});

test('Sơ hở cộng với thủ: 38 × 0,35 × 1,25 và khuếch đại phản đòn lên người đang sơ hở', () => {
  let d = duel([TPQ, TB], [KTB, TQ], { rng: seq(OK, V) });
  d.step(TPQ, KTB);
  d.step(TB, TQ);
  assert.equal(d.f.a.hp, 200 - 17);                                    // 13,3 × 1,25 = 16,6
  done(d);
  d = duel([TPQ], [KTB, PC], { rng: seq(OK, OK) });
  d.step(TPQ, KTB);                                                    // a sơ hở
  const o = d.step(TPQ, PC);                                           // a lại đánh vào Phản Chấn, bị phản
  assert.equal(one(o, 'counter').dmg, 25);                             // 20 × 1,25
  assert.equal(d.f.a.exposed, 1);
  done(d);
});

test('Sơ hở cộng với buff: nhân cả giảm sát thương bị động', () => {
  const d = duel([TPQ], [KTB, TQ], { rng: seq(OK, V), ba: { defP: 0.1 } });
  d.step(TPQ, KTB);
  d.step(REST, TQ);
  assert.equal(d.f.a.hp, 200 - 43);                                    // 38 × 0,9 × 1,25 = 42,75
});

test('Sơ hở chỉ khi né / đỡ HẾT mọi nhịp, đánh trúng hoặc thủ thì không', () => {
  let d = duel([TPQ], [TB], { rng: seq(V) });
  d.step(TPQ, TB);
  assert.equal(d.f.a.exposed, 0);
  d = duel([TPQ], [KTB], { rng: seq(NO, V) });
  d.step(TPQ, KTB);
  assert.equal(d.f.a.exposed, 0);
  d = duel([TPQ], [TKP], { rng: seq(OK) });
  d.step(TPQ, TKP);
  assert.equal(d.f.a.exposed, 1);
  d = duel([TQ], [REST], { rng: seq(V) });
  d.step(TQ, REST);
  assert.equal(d.f.a.exposed, 0);
});

test('Sơ hở: bên đỡ / né không bị sơ hở; hai bên cùng đánh, một bên bị né thì chỉ bên đó sơ hở', () => {
  const d = duel([TPQ], [KTB], { rng: seq(OK) });
  d.step(TPQ, KTB);
  assert.equal(d.f.b.exposed, 0);
  const e = duel([TPQ], [TQ], { rng: seq(V, V) });
  e.step(TPQ, TQ);
  assert.deepEqual([e.f.a.exposed, e.f.b.exposed], [0, 0]);
});

/* ---------- nội lực, nghỉ, đứng yên ---------- */

test('nội lực: trừ chi phí rồi hồi 6; Điều tức hồi 6 + 20; trần manaMax; Đứng yên chỉ hồi 6', () => {
  const d = duel([TQ], [], { rng: seq(V) });
  d.step(TQ, REST);
  assert.equal(d.f.a.mana, 72);
  assert.equal(d.f.b.mana, 80);                                        // đã đầy, Điều tức không vượt trần
  d.step(REST, null);
  assert.equal(d.f.a.mana, 80, '72 + 26 bị chặn bởi manaMax');
  d.f.b.mana = 20;
  d.step(REST, null);
  assert.equal(d.f.b.mana, 26);                                        // idle: +6
  d.step(null, REST);
  assert.equal(d.f.b.mana, 52);                                        // Điều tức: +26
});

test('nội lực tối đa theo cấp nội công (80 + 4 mỗi cấp trên 1)', () => {
  const d = duel([TQ], [TQ], { lva: 1, lvb: 10 });
  assert.equal(d.f.a.mana, 80);
  assert.equal(d.f.b.mana, 116);
  assert.equal(d.state('b').manaMax, 116);
  assert.equal(newFighter({ level: 99, loadout: [] }).manaMax, 116);
  assert.equal(newFighter({ level: 0 }).level, 1);
  assert.equal(newFighter().level, 1);
});

test('Điều tức / Đứng yên: không phòng thủ (nhận đủ sát thương), có sự kiện riêng', () => {
  const d = duel([], [TQ], { rng: seq(V, V) });
  let o = d.step(REST, TQ);
  assert.equal(d.f.a.hp, 200 - 38);
  assert.equal(ev(o, 'rest', { side: 'a' }).length, 1);
  o = d.step(null, TQ);
  assert.equal(d.f.a.hp, 200 - 76);
  assert.equal(ev(o, 'idle', { side: 'a' }).length, 1);
});

test('lựa chọn không hợp lệ → Đứng yên với invalid:true (trừ chọn Đứng yên hoặc không chọn)', () => {
  const d = duel([TQ], [TQ], { rng: seq() });
  d.f.a.mana = 5;
  let o = d.step(TQ, 'khong-co-chieu-nay');
  let pa = one(o, 'pick', { side: 'a' }), pb = one(o, 'pick', { side: 'b' });
  assert.deepEqual([pa.skill, pa.invalid, pa.auto, pa.mana], [IDLE, true, true, 0]);     // thiếu nội lực
  assert.deepEqual([pb.skill, pb.invalid, pb.auto, pb.mana], [IDLE, true, true, 0]);     // chiêu không tồn tại
  const e = duel([TQ], [TQ], { rng: seq() });
  o = e.step(IDLE, undefined);
  pa = one(o, 'pick', { side: 'a' }); pb = one(o, 'pick', { side: 'b' });
  assert.deepEqual([pa.skill, pa.invalid, pa.auto], [IDLE, false, true]);
  assert.deepEqual([pb.skill, pb.invalid, pb.auto], [IDLE, false, true]);
  const f = duel([TQ], [TQ], { rng: seq() });
  o = f.step(TB, KTB);                                                 // chiêu có thật nhưng không thuộc bộ
  assert.equal(one(o, 'pick', { side: 'a' }).invalid, true);
  assert.equal(one(o, 'pick', { side: 'b' }).invalid, true);
});

/* ---------- suy kiệt và kết thúc ---------- */

test('suy kiệt từ lượt 20: cả hai mất 5, 10, 15… mỗi lượt', () => {
  const d = duel([TB], [TB], { rng: seq() });
  d.turn = 20;
  let o = d.step(REST, REST);
  assert.deepEqual(one(o, 'sudden'), { k: 'sudden', dmg: 5, streak: 1 });
  assert.deepEqual(hp(d), [195, 195]);
  o = d.step(REST, REST);
  assert.equal(one(o, 'sudden').dmg, 10);
  o = d.step(REST, REST);
  assert.equal(one(o, 'sudden').dmg, 15);
  assert.deepEqual(hp(d), [170, 170]);
});

test('suy kiệt sớm sau 4 lượt liền không ai mất máu; có sát thương thì đếm lại từ đầu', () => {
  let d = duel([], [], { rng: seq() });
  for (let i = 1; i <= 3; i++) assert.equal(ev(d.step(REST, null), 'sudden').length, 0, `lượt ${i}`);
  assert.deepEqual(hp(d), [200, 200]);
  const o = d.step(REST, null);
  assert.deepEqual(one(o, 'sudden'), { k: 'sudden', dmg: 5, streak: 4 });
  assert.equal(one(d.step(REST, REST), 'sudden').dmg, 10);
  d = duel([TQ], [], { rng: seq(V) });
  d.step(REST, REST); d.step(REST, REST); d.step(REST, REST);
  d.step(TQ, REST);                                                    // có sát thương → đếm lại
  for (let i = 1; i <= 3; i++) assert.equal(ev(d.step(REST, REST), 'sudden').length, 0);
  assert.equal(ev(d.step(REST, REST), 'sudden').length, 1);
});

test('suy kiệt: hai bên chỉ nghỉ → hòa cùng về 0 ở lượt 12 (5+10+...+45 ≥ 200)', () => {
  const d = duel([], [], { rng: seq() });
  let o;
  do o = d.step(REST, REST); while (!o.ended);
  assert.equal(o.turn, 12);
  assert.deepEqual(o.ended, { result: 'draw', reason: 'double-ko' });
  assert.deepEqual(hp(d), [-25, -25]);
  assert.equal(d.state('a').hp, 0);                                    // hiển thị không âm
});

test('hết trận: một bên về 0 → ko, bên kia thắng', () => {
  const d = duel([TQ], [], { rng: seq(V) });
  d.f.b.hp = 38;
  const o = d.step(TQ, REST);
  assert.deepEqual(o.ended, { result: 'a', reason: 'ko' });
  assert.deepEqual(one(o, 'end'), { k: 'end', result: 'a', reason: 'ko' });
  assert.equal(d.over.result, 'a');
  assert.equal(d.state('b').hp, 0);
  const e = duel([], [TQ], { rng: seq(V) });
  e.f.a.hp = 10;
  assert.deepEqual(e.step(null, TQ).ended, { result: 'b', reason: 'ko' });
});

test('cùng về 0: ai còn ít âm hơn thắng; bằng nhau thì hòa', () => {
  let d = duel([TQ], [TPQ], { rng: seq(V, V) });
  d.f.a.hp = 3; d.f.b.hp = 10;                                         // a nhận 25 → -22; b nhận 38 → -28
  let o = d.step(TQ, TPQ);
  assert.deepEqual(hp(d), [-22, -28]);
  assert.deepEqual(o.ended, { result: 'a', reason: 'double-ko' });
  d = duel([TQ], [TPQ], { rng: seq(V, V) });
  d.f.a.hp = 30; d.f.b.hp = 5;                                         // a -> 5; b -> -33... a còn sống: a thắng ko
  assert.equal(d.step(TQ, TPQ).ended.reason, 'ko');
  d = duel([TQ], [TQ], { rng: seq(V, V) });
  d.f.a.hp = 20; d.f.b.hp = 20;
  o = d.step(TQ, TQ);
  assert.deepEqual(o.ended, { result: 'draw', reason: 'double-ko' });
  d = duel([TQ], [TQ], { rng: seq(V, V) });
  d.f.a.hp = 20; d.f.b.hp = 60;                                        // b còn 22, a về -18
  assert.deepEqual(d.step(TQ, TQ).ended, { result: 'b', reason: 'ko' });
  d = duel([TQ], [TQ], { rng: seq(V, V) });
  d.f.a.hp = 50; d.f.b.hp = 40;                                        // a -> 12, b -> 2
  assert.equal(d.step(TQ, TQ).ended, null);
});

test('cùng về 0 do suy kiệt: bên còn nhiều máu hơn (ít âm hơn) thắng', () => {
  const d = duel([], [], { rng: seq() });
  d.turn = 20; d.f.a.hp = 5; d.f.b.hp = 3;
  const o = d.step(REST, REST);
  assert.deepEqual(hp(d), [0, -2]);
  assert.deepEqual(o.ended, { result: 'a', reason: 'double-ko' });
});

test('lượt 40 so HP: bên nhiều máu hơn thắng, bằng nhau hòa', () => {
  let d = duel([], [], { rng: seq() });
  d.turn = R.MAX_TURNS; d.f.a.hp = 100; d.f.b.hp = 60;
  let o = d.step(REST, REST);
  assert.deepEqual(o.ended, { result: 'a', reason: 'turn-limit' });
  assert.deepEqual(hp(d), [95, 55]);
  d = duel([], [], { rng: seq() });
  d.turn = R.MAX_TURNS; d.f.a.hp = 77; d.f.b.hp = 77;
  o = d.step(REST, REST);
  assert.deepEqual(o.ended, { result: 'draw', reason: 'turn-limit' });
  d = duel([], [], { rng: seq() });
  d.turn = R.MAX_TURNS - 1; d.f.a.hp = 100; d.f.b.hp = 100;
  assert.equal(d.step(REST, REST).ended, null);
  assert.equal(d.turn, R.MAX_TURNS);
});

test('step sau khi kết thúc ném lỗi; lượt không tăng', () => {
  const d = duel([TQ], [], { rng: seq(V) });
  d.f.b.hp = 1;
  d.step(TQ, REST);
  assert.throws(() => d.step(TQ, REST), /kết thúc/);
  assert.equal(d.history.length, 1);
});

test('lượt bắt đầu từ 1, tăng sau mỗi lượt, history ghi lại', () => {
  const d = duel([], [], { rng: seq() });
  assert.equal(d.turn, 1);
  const o = d.step(REST, REST);
  assert.equal(o.turn, 1);
  assert.equal(d.turn, 2);
  assert.equal(d.history.length, 1);
  assert.equal(d.history[0].turn, 1);
  assert.equal(o.state.a.mana, 80);
});

/* ---------- thứ tự dùng rng ---------- */

test('thứ tự rng: bên a trước, bên b sau; mỗi nhịp: thử né / đỡ rồi mới dao động', () => {
  const d = duel([TQ], [TQ], { rng: seq(0, 0.999) });                  // a: 0,9 ; b: 1,0998
  const o = d.step(TQ, TQ);
  assert.equal(ev(o, 'hit', { atk: 'a' })[0].dmg, 34);                 // 38 × 0,9 = 34,2
  assert.equal(ev(o, 'hit', { atk: 'b' })[0].dmg, 42);                 // 38 × 1,0998 = 41,8
  done(d);
});

test('thứ tự rng: nhịp né rồi mới tới dao động của chính nhịp đó; né được thì bỏ dao động', () => {
  const d = duel([LHC], [NVB], { rng: seq(NO, 0, OK) });               // nhịp 1: hụt → trúng 14,4 ; nhịp 2: né
  const o = d.step(LHC, NVB);
  assert.deepEqual(ev(o, 'dodge').map(e => e.ok), [false, true]);
  assert.equal(one(o, 'hit').idx, 1);
  assert.equal(one(o, 'hit').dmg, 14);                                 // 16 × 0,9
  done(d);
});

test('thứ tự rng: hai bên cùng tấn công vào phòng thủ né / đỡ: a thử trước, b thử sau', () => {
  const d = duel([TPQ, NVB], [TKP, TPQ], { rng: seq(NO, 0.999) });
  d.step(TPQ, TKP);                                                    // chỉ a tấn công b (đỡ): 1 thử (hụt) + 1 dao động (0,999)
  assert.equal(d.f.b.hp, 200 - 27);                                    // 25 × 1,0998 = 27,5 (27,495 → 27)
  assert.equal(d.rng.calls(), 2);
  const e = duel([DAP, TPQ], [TPQ, DAP], { rng: seq(0, 0.999) });
  e.step(DAP, TPQ);                                                    // a đỡ, b đánh: 1 thử (OK=0) → không dao động
  assert.equal(e.rng.calls(), 1);
});

test('rng: thủ / nghỉ / tụ lực lượt 1 không tiêu rng; đòn trúng thẳng chỉ tiêu một số', () => {
  let d = duel([TB, TL], [REST], { rng: seq() });
  d.step(TB, REST); d.step(TL, REST);
  assert.equal(d.rng.calls(), 0);
  d = duel([TQ], [REST], { rng: seq(V) });
  d.step(TQ, REST);
  done(d);
});

/* ---------- tái lập, sao chép ---------- */

function playRandom(seed, la, lb, bots) {
  const d = new Duel({ seed, a: { level: 3, loadout: la }, b: { level: 5, loadout: lb } });
  const r = makeRng('bot-' + seed);
  while (!d.over) {
    const pa = d.legal('a').picks, pb = d.legal('b').picks;
    d.step(pa[Math.floor(r() * pa.length)], pb[Math.floor(r() * pb.length)]);
  }
  return d;
}

test('tái lập theo seed: cùng seed và cùng lựa chọn cho đúng cùng lịch sử', () => {
  const la = [TQ, TB, KTB, DAP], lb = [LHC, TKP, TL, NVB];
  const x = playRandom('hat-giong-1', la, lb), y = playRandom('hat-giong-1', la, lb);
  assert.deepEqual(x.history, y.history);
  assert.deepEqual(x.over, y.over);
  const z = playRandom('hat-giong-2', la, lb);
  assert.notDeepEqual(x.history, z.history);
});

test('seed mặc định lấy ngẫu nhiên và lưu lại để tra', () => {
  const a = new Duel({ a: { level: 1, loadout: [] }, b: { level: 1, loadout: [] } });
  const b = new Duel({ a: { level: 1, loadout: [] }, b: { level: 1, loadout: [] } });
  assert.match(a.seed, /^[0-9a-f]{32}$/);
  assert.notEqual(a.seed, b.seed);
});

test('clone: độc lập với bản gốc, roll / vari đè được, dùng chung rng nếu không đè', () => {
  const d = duel([TPQ], [KTB], { rng: seq(OK) });
  const c = d.clone({ roll: () => true, vari: () => 0.5 });
  const o = c.step(TPQ, KTB);
  assert.equal(ev(o, 'dodge')[0].ok, true);
  assert.equal(d.turn, 1);
  assert.deepEqual(hp(d), [200, 200]);
  assert.equal(d.history.length, 0);
  assert.equal(c.history.length, 1);
  assert.equal(c.f.a.exposed, 1);
  assert.equal(d.f.a.exposed, 0);
  assert.equal(d.rng.calls(), 0, 'đè roll thì không đụng rng gốc');
  const e = d.clone();
  e.step(TPQ, KTB);                                                     // không đè: dùng rng của bản gốc
  assert.equal(d.rng.calls(), 1);
  c.f.a.charging = 'x';
  assert.equal(d.f.a.charging, null);
  c.loadout.a.push('y');
  assert.equal(d.loadout.a.length, 1);
});

test('publicState: hp không âm, rộng số buff làm tròn 3 chữ số', () => {
  const f = newFighter({ level: 2, buff: { offExt: 0.12345, defP: 0.06789, dodgeB: 0.0252 } });
  f.hp = -7; f.rage = 33.6;
  const s = publicState(f);
  assert.equal(s.hp, 0);
  assert.equal(s.rage, 34);
  assert.deepEqual([s.offExt, s.defP, s.dodgeB], [0.123, 0.068, 0.025]);
  assert.equal(s.manaMax, 84);
});

/* ---------- Đoạt Ảnh và tụ lực: phối hợp ---------- */

test('hai bên cùng tụ lực rồi cùng tung: cả hai trúng, không ai ngắt ai', () => {
  const d = duel([TL], [TL], { rng: seq(V, V) });
  d.step(TL, TL);
  const o = d.step(null, null);
  assert.deepEqual(hp(d), [130, 130]);
  assert.equal(ev(o, 'release').length, 2);
});

test('thế của hành động tụ lực: thủ trong lúc đối thủ tung đòn → chiêu thủ vẫn giảm đúng', () => {
  const d = duel([TL], [TB], { rng: seq(V) });
  d.step(TL, REST);
  const o = d.step(null, TB);
  assert.equal(one(o, 'hit').red, 0.65);
  assert.equal(d.f.b.hp, 200 - 25);                                     // 70 × 0,35 = 24,5 → 25
});

/* ---------- property: bot chọn bừa hợp lệ ---------- */

const ALL = M.SKILL_LIST.map(s => s.id);
const SCALES = [0.25, 0.5, 1, 2];

function randomLoadout(r, must) {
  const pool = ALL.filter(x => x !== must);
  const out = must ? [must] : [];
  while (out.length < 4) out.push(pool.splice(Math.floor(r() * pool.length), 1)[0]);
  return out;
}
function randomBuff(r) {
  if (r() < 0.4) return undefined;
  return computeBuff({ Lc: Math.floor(r() * 7), Lq: Math.floor(r() * 5), Ld: Math.floor(r() * 10) }, SCALES[Math.floor(r() * SCALES.length)]);
}

/** Tính lại từ sự kiện và trạng thái trước lượt, độc lập với engine, rồi so với trạng thái sau lượt. */
function verifyTurn(pre, d, out, track) {
  const post = d.f;
  const act = {};
  for (const e of ev(out, 'pick')) act[e.side] = { id: e.skill, skill: M.SKILLS[e.skill] || null, phase: e.phase, cost: e.mana };
  const stance = (a, o) => {
    if (a.id === REST) return 'rest';
    if (a.id === IDLE) return 'idle';
    if (a.phase === 'release') return 'release';
    if (a.skill.kind === 'hybrid') return (o.skill && (o.skill.kind === 'atk' || o.phase === 'release')) ? 'parry' : 'atk';
    return a.skill.kind;
  };
  const st = { a: stance(act.a, act.b), b: stance(act.b, act.a) };
  const isAtk = s => st[s] === 'atk' || st[s] === 'release';
  const dmg = { a: 0, b: 0 }, landed = { a: 0, b: 0 }, dodgedOk = { a: 0, b: 0 }, evadedAsAtk = { a: 0, b: 0 }, hitsAsAtk = { a: 0, b: 0 };
  const rnd3 = x => Math.round(x * 1000) / 1000;
  for (const s of ['a', 'b']) {
    const o = other(s), X = pre[s], Y = pre[o];
    const mine = out.events.filter(e => e.atk === s);
    if (!isAtk(s)) { assert.equal(mine.length, 0, 'bên không tấn công không có sự kiện tấn công'); continue; }
    const hits = st[s] === 'release' ? [act[s].skill.charge.release] : act[s].skill.hits;
    hitsAsAtk[s] = hits.length;
    const off = 1 + Math.min(R.OFF_CAP, R.RAGE_PCT * X.rage + (X.kc > 0 ? R.KC_BONUS : 0) + X.offExt);
    let parried = 0, lastBase = 0;
    hits.forEach((h, i) => {
      const idx = i + 1, of = hits.length;
      const dod = mine.filter(e => e.k === 'dodge' && e.idx === idx), par = mine.filter(e => e.k === 'parry' && e.idx === idx), hit = mine.filter(e => e.k === 'hit' && e.idx === idx);
      assert.equal(dod.length, st[o] === 'dodge' ? 1 : 0);
      assert.equal(par.length, st[o] === 'parry' ? 1 : 0);
      let evaded = false;
      if (dod.length) {
        let p = Math.min(R.DODGE_CAP, Math.max(R.PMIN, chance(act[o].skill.dodge.spd, h.spd) + Y.dodgeB));
        if (h.dodgeMul) p *= h.dodgeMul;
        assert.equal(dod[0].p, rnd3(p)); assert.equal(dod[0].of, of);
        assert.ok(dod[0].p <= (h.dodgeMul ? R.DODGE_CAP * h.dodgeMul : R.DODGE_CAP) + 1e-9, 'xác suất né vượt trần');
        if (dod[0].ok) { evaded = true; dodgedOk[o]++; }
      }
      if (par.length) {
        const p = chance(act[o].skill.parry.spd, h.spd);
        assert.equal(par[0].p, rnd3(p));
        if (par[0].ok) { evaded = true; parried++; lastBase = h.base; }
      }
      assert.equal(hit.length, evaded ? 0 : 1, 'nhịp trúng khi và chỉ khi không né / đỡ được');
      if (evaded) { evadedAsAtk[s]++; return; }
      let red = 0;
      if (st[o] === 'guard') red = act[o].skill.guard.red * (act[s].skill.pierce ? 1 - act[s].skill.pierce : 1);
      else if (st[o] === 'charge') red = act[o].skill.charge.red;
      else if (st[o] === 'parry') red = act[o].skill.parry.failRed || 0;
      assert.ok(Math.abs(hit[0].red - rnd3(red)) < 1e-9, `red ${hit[0].red} != ${rnd3(red)}`);
      const rawBase = h.base * off * (1 - red) * (1 - Y.defP) * (1 + (Y.exposed ? R.EXPOSED_PCT : 0));
      const lo = Math.max(1, Math.round((1 - R.DMG_VAR) * rawBase)), hi = Math.max(1, Math.round((1 + R.DMG_VAR) * rawBase));
      assert.ok(hit[0].dmg >= lo && hit[0].dmg <= hi && Number.isInteger(hit[0].dmg), `sát thương ${hit[0].dmg} ngoài [${lo}, ${hi}]`);
      dmg[o] += hit[0].dmg; landed[o]++;
    });
    const counters = out.events.filter(e => e.k === 'counter' && e.target === s);
    if (parried) {
      const pr = act[o].skill.parry;
      const c = (pr.flat + Math.min(pr.cap || 0, (pr.pct || 0) * lastBase)) * (parried / hits.length);
      const want = Math.max(1, Math.round(c * (1 + Math.min(R.OFF_CAP, Y.offExt)) * (1 - X.defP) * (1 + (X.exposed ? R.EXPOSED_PCT : 0))));
      assert.equal(counters.length, 1);
      assert.equal(counters[0].side, o);
      assert.equal(counters[0].dmg, want);
      dmg[s] += want;
    } else assert.equal(counters.length, 0);
  }
  const anyDmg = dmg.a + dmg.b > 0;
  track.streak = anyDmg ? 0 : track.streak + 1;
  if (track.sud == null && (out.turn >= R.SUDDEN_FROM_TURN || track.streak >= R.SUDDEN_NO_DAMAGE_STREAK)) track.sud = out.turn;
  const sdEv = ev(out, 'sudden');
  const sd = track.sud != null ? R.SUDDEN_STEP * (out.turn - track.sud + 1) : 0;
  assert.equal(sdEv.length, track.sud != null ? 1 : 0);
  if (sd) { assert.equal(sdEv[0].dmg, sd); assert.equal(sdEv[0].streak, track.streak); }
  for (const s of ['a', 'b']) {
    const X = pre[s], N = post[s], a = act[s];
    assert.equal(N.hp, X.hp - dmg[s] - sd, `hp ${s}`);
    near(N.mana, Math.min(N.manaMax, X.mana - a.cost + R.REGEN + (st[s] === 'rest' ? R.REST_BONUS : 0)));
    assert.ok(N.mana >= 0 && N.mana <= N.manaMax);
    const nExp = isAtk(s) && hitsAsAtk[s] > 0 && evadedAsAtk[s] === hitsAsAtk[s] ? 1 : 0;
    assert.equal(N.exposed, nExp, `sơ hở ${s}`);
    assert.equal(ev(out, 'exposed', { side: s }).length, nExp);
    let kc = isAtk(s) ? 0 : Math.max(0, X.kc - 1);
    const kcNow = a.skill && a.skill.guard && a.skill.guard.kc && dmg[s] > 0;
    if (kcNow) kc = R.KC_TURNS;
    assert.equal(N.kc, kc, `kc ${s}`);
    assert.equal(ev(out, 'kc', { side: s }).length, kcNow ? 1 : 0);
    let gain = R.RAGE_FROM_DMG * dmg[s];
    if (a.skill && a.skill.guard && a.skill.guard.rageOnHit && landed[s] > 0) gain += a.skill.guard.rageOnHit;
    if (a.skill && a.skill.dodge && a.skill.dodge.rageOnDodge && dodgedOk[s] > 0) gain += a.skill.dodge.rageOnDodge;
    const rage = Math.min(R.RAGE_MAX, (isAtk(s) ? 0 : X.rage) + gain);
    near(N.rage, rage, 1e-9);
    assert.ok(N.rage >= 0 && N.rage <= R.RAGE_MAX);
    const re = ev(out, 'rage', { side: s });
    if (N.rage !== X.rage) { assert.equal(re.length, 1); assert.equal(re[0].value, Math.round(N.rage)); assert.equal(re[0].delta, Math.round(N.rage - X.rage)); } else assert.equal(re.length, 0);
    assert.equal(N.charging, st[s] === 'charge' ? a.id : null);
    assert.ok(N.hp <= X.hp, 'HP không bao giờ tăng');
    for (const k of ['hp', 'mana', 'rage', 'kc', 'exposed', 'offExt', 'defP', 'dodgeB']) assert.ok(Number.isFinite(N[k]), `${k} không hữu hạn`);
  }
  const ha = post.a.hp, hb = post.b.hp;
  let ended = null;
  if (ha <= 0 || hb <= 0) ended = ha <= 0 && hb <= 0 ? { result: ha === hb ? 'draw' : ha > hb ? 'a' : 'b', reason: 'double-ko' } : { result: ha <= 0 ? 'b' : 'a', reason: 'ko' };
  else if (out.turn >= R.MAX_TURNS) ended = { result: ha === hb ? 'draw' : ha > hb ? 'a' : 'b', reason: 'turn-limit' };
  assert.deepEqual(out.ended, ended);
  for (const e of out.events) for (const k of ['p', 'dmg', 'red', 'delta', 'value']) if (k in e) assert.ok(Number.isFinite(e[k]));
  for (const e of out.events) if ('p' in e) assert.ok(e.p >= 0 && e.p <= 1);
}

function fuzzMatch(r, seed, la, lb, opt, force) {
  const d = new Duel({ seed, a: { level: opt.lva, loadout: la, buff: opt.ba }, b: { level: opt.lvb, loadout: lb, buff: opt.bb } });
  const track = { streak: 0, sud: null };
  const choose = side => {
    const l = d.legal(side).picks, x = r();
    if (x < 0.04) return ['khong-co', IDLE, null, undefined, ALL[Math.floor(r() * 15)]][Math.floor(r() * 5)];
    return l[Math.floor(r() * l.length)];
  };
  let n = 0;
  while (!d.over) {
    const pre = { a: { ...d.f.a }, b: { ...d.f.b } };
    const pa = n === 0 && force ? force[0] : choose('a'), pb = n === 0 && force ? force[1] : choose('b');
    const out = d.step(pa, pb);
    verifyTurn(pre, d, out, track);
    n++;
    assert.ok(n <= R.MAX_TURNS, 'trận phải kết thúc trong 40 lượt');
  }
  return { d, turns: n };
}

const suddenBound = () => { let k = 0, s = 0; while (s < R.HP) { k++; s += R.SUDDEN_STEP * k; } return R.SUDDEN_FROM_TURN + k - 1; };

test('property: mọi cặp chiêu (15 × 15, mỗi cặp ra đòn ở lượt 1) × 6 trận bot chọn bừa hợp lệ', () => {
  const r = makeRng('property-pairs');
  const seen = new Set();
  let matches = 0, longest = 0;
  for (const x of ALL) for (const y of ALL) for (let rep = 0; rep < 6; rep++) {
    const la = randomLoadout(r, x), lb = randomLoadout(r, y);
    const opt = { lva: 1 + Math.floor(r() * 10), lvb: 1 + Math.floor(r() * 10), ba: randomBuff(r), bb: randomBuff(r) };
    const { d, turns } = fuzzMatch(r, `p-${x}-${y}-${rep}`, la, lb, opt, [x, y]);
    seen.add(x + '|' + y);
    assert.ok(d.over && d.turn <= R.MAX_TURNS);
    longest = Math.max(longest, turns);
    matches++;
  }
  assert.equal(seen.size, 225);
  assert.equal(matches, 1350);
  assert.ok(longest <= suddenBound(), `trận dài nhất ${longest} lượt, cận trên theo luật suy kiệt ${suddenBound()}`);
});

test('property: 2500 trận bộ chiêu ngẫu nhiên, cấp và buff ngẫu nhiên (kể cả buff vượt trần)', () => {
  const r = makeRng('property-random');
  const ends = { a: 0, b: 0, draw: 0 };
  let sudden = 0;
  for (let i = 0; i < 2500; i++) {
    const opt = { lva: 1 + Math.floor(r() * 10), lvb: 1 + Math.floor(r() * 10), ba: randomBuff(r), bb: randomBuff(r) };
    const { d, turns } = fuzzMatch(r, 'pr-' + i, randomLoadout(r), randomLoadout(r), opt);
    assert.ok(turns <= suddenBound());
    ends[d.over.result]++;
    if (d.sudden != null) sudden++;
  }
  assert.equal(ends.a + ends.b + ends.draw, 2500);
  assert.ok(ends.a > 400 && ends.b > 400, 'hai bên đều thắng được: ' + JSON.stringify(ends));
  assert.ok(sudden > 0);
});

test('property: đối xứng a ↔ b — cùng bộ chiêu và cùng chiến thuật bot cho tỉ lệ thắng gần 50%', () => {
  const r = makeRng('property-sym');
  const la = [TQ, TPQ, KTB, TKP];
  let a = 0, b = 0;
  for (let i = 0; i < 1500; i++) {
    const { d } = fuzzMatch(r, 'sym-' + i, la, la, { lva: 5, lvb: 5 });
    if (d.over.result === 'a') a++; else if (d.over.result === 'b') b++;
  }
  const share = a / (a + b);
  assert.ok(share > 0.44 && share < 0.56, `a thắng ${a}, b thắng ${b}`);
});

test('property: bất kể bên nào ra trước, kết quả không phụ thuộc thứ tự (hoán đổi a ↔ b và dãy rng tương ứng)', () => {
  // dùng roll / vari ép sẵn theo "người tấn công" thay vì theo thứ tự gọi để so sánh hai cách đặt
  const r = makeRng('property-order');
  for (let i = 0; i < 400; i++) {
    const la = randomLoadout(r), lb = randomLoadout(r);
    const seed = 'ord-' + i;
    const mk = (A, B) => new Duel({ seed, roll: p => p >= 0.5, vari: () => 0.5, a: { level: 4, loadout: A }, b: { level: 4, loadout: B } });
    const d1 = mk(la, lb), d2 = mk(lb, la);
    let n = 0;
    while (!d1.over && n++ < 60) {
      const pa = d1.legal('a').picks[Math.floor(r() * d1.legal('a').picks.length)];
      const pb = d1.legal('b').picks[Math.floor(r() * d1.legal('b').picks.length)];
      d1.step(pa, pb); d2.step(pb, pa);
      assert.deepEqual(d1.state('a'), d2.state('b'));
      assert.deepEqual(d1.state('b'), d2.state('a'));
    }
  }
});

/* ---------- công cụ mô phỏng dùng Duel thật ---------- */

test('mô phỏng: liệt kê nhánh kết quả có tổng xác suất 1 và khớp Monte Carlo trên Duel thật', () => {
  const { outcomes, expectedValue } = require('../tools/pk-sim/enumerate');
  const cases = [[LHC, NVB], [TQ, TKP], [TPQ, PC], [DAP, TQ], [LHC, TKP], [TL, KTB]];
  for (const [x, y] of cases) {
    const d = duel([x, TQ, TL, DAP], [y, TPQ, KTB, NVB], { rng: makeRng('mc-' + x + y) });
    if (x === TL) { d.step(TL, REST); }
    const pa = x === TL ? null : x;
    const branches = outcomes(d, pa, y);
    near(branches.reduce((s, b) => s + b.w, 0), 1, 1e-9);
    const E = expectedValue(branches, s => s.f.b.hp - s.f.a.hp);
    let sum = 0, N = 20000;
    const r = makeRng('mc2-' + x + y);
    for (let i = 0; i < N; i++) {
      const c = d.clone({ roll: p => r() < p, vari: () => 0.5 });
      c.step(pa, y);
      sum += c.f.b.hp - c.f.a.hp;
    }
    assert.ok(Math.abs(sum / N - E) < 1.2, `${x} vs ${y}: MC ${(sum / N).toFixed(2)} != ${E.toFixed(2)}`);
  }
});

test('mô phỏng: cùng seed ra cùng kết quả, khác seed khác kết quả', () => {
  const { playMatch } = require('../tools/pk-sim/play');
  const L = { a: [TQ, TB, KTB, TKP], b: [LHC, DAP, NVB, TL] };
  const x = playMatch({ seed: 'tai-lap', bots: ['random', 'random'], loadouts: L, levels: [5, 5] });
  const y = playMatch({ seed: 'tai-lap', bots: ['random', 'random'], loadouts: L, levels: [5, 5] });
  assert.deepEqual(x, y);
  const outs = new Set();
  for (let i = 0; i < 20; i++) outs.add(JSON.stringify(playMatch({ seed: 'khac-' + i, bots: ['random', 'random'], loadouts: L, levels: [5, 5] })));
  assert.ok(outs.size > 5);
});
