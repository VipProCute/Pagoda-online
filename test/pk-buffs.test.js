'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('../lib/pk/rules');
const { computeBuff, NONE } = require('../lib/pk/buffs');
const { Duel } = require('../lib/pk/engine');

const near = (x, y, eps = 1e-12) => assert.ok(Math.abs(x - y) <= eps, `${x} != ${y}`);
const SCALES = [0.25, 0.5, 1];

/* công thức gốc viết lại độc lập từ comment đầu lib/pk/buffs.js */
const lc = (L, s) => ({ def: Math.min(0.02 * L, 0.12) * s, dodge: Math.min(0.01 * L, 0.06) * s });
const lq = (L, s) => ({ off: Math.min(0.04 * L, 0.16) * s });
const ld = (L, s) => ({ off: Math.min(0.02 * L, 0.18) * s, def: Math.min(0.01 * L, 0.09) * s, dodge: Math.min(0.005 * L, 0.045) * s });

test('hệ số mặc định là RULES.BUFF_SCALE; mặc định 0,5', () => {
  assert.equal(R.BUFF_SCALE, 0.5);
  assert.deepEqual(computeBuff({ Lc: 3, Lq: 2, Ld: 5 }), computeBuff({ Lc: 3, Lq: 2, Ld: 5 }, R.BUFF_SCALE));
  assert.deepEqual(computeBuff({ Lc: 3 }, undefined), computeBuff({ Lc: 3 }, 0.5));
});

test('không buff: trả NONE (đóng băng), mọi số 0, không nhãn', () => {
  for (const x of [undefined, null, {}, { Lc: 0, Lq: 0, Ld: 0 }, { Lc: -3 }, { Ld: 'abc' }, { Lq: NaN }]) assert.equal(computeBuff(x), NONE);
  assert.ok(Object.isFrozen(NONE));
  assert.deepEqual({ ...NONE }, { Lc: 0, Lq: 0, Ld: 0, offExt: 0, defP: 0, dodgeB: 0, labels: [] });
  assert.throws(() => { 'use strict'; NONE.offExt = 1; }, TypeError);
});

test('Pháp tướng Lc 1-6: giảm sát thương min(2% × Lc, 12%), cộng né min(1 điểm × Lc, 6 điểm), nhân hệ số', () => {
  for (const s of SCALES) for (let L = 1; L <= 6; L++) {
    const b = computeBuff({ Lc: L }, s);
    near(b.defP, 0.02 * L * s); near(b.dodgeB, 0.01 * L * s);
    assert.equal(b.offExt, 0);
    assert.equal(b.Lc, L);
  }
  near(computeBuff({ Lc: 6 }, 1).defP, 0.12); near(computeBuff({ Lc: 6 }, 1).dodgeB, 0.06);
  near(computeBuff({ Lc: 6 }, 0.5).defP, 0.06);
});

test('Quỷ ám Lq 1-4: tăng sát thương min(4% × Lq, 16%), không đụng phòng thủ', () => {
  for (const s of SCALES) for (let L = 1; L <= 4; L++) {
    const b = computeBuff({ Lq: L }, s);
    near(b.offExt, 0.04 * L * s);
    assert.equal(b.defP, 0); assert.equal(b.dodgeB, 0);
  }
  near(computeBuff({ Lq: 4 }, 1).offExt, 0.16);
});

test('Hào quang Ld 1-9: tăng 2% / giảm 1% / né 0,5 điểm mỗi cấp, trần 18% / 9% / 4,5 điểm', () => {
  for (const s of SCALES) for (let L = 1; L <= 9; L++) {
    const b = computeBuff({ Ld: L }, s);
    near(b.offExt, 0.02 * L * s); near(b.defP, 0.01 * L * s); near(b.dodgeB, 0.005 * L * s);
  }
  const m = computeBuff({ Ld: 9 }, 1);
  near(m.offExt, 0.18); near(m.defP, 0.09); near(m.dodgeB, 0.045);
});

test('các nguồn cộng với nhau (Lc + Lq + Ld) rồi nhân hệ số — mọi tổ hợp 7 × 5 × 10', () => {
  for (const s of SCALES) for (let a = 0; a <= 6; a++) for (let q = 0; q <= 4; q++) for (let h = 0; h <= 9; h++) {
    const b = computeBuff({ Lc: a, Lq: q, Ld: h }, s);
    const A = lc(a, s), Q = lq(q, s), H = ld(h, s);
    near(b.offExt, Math.min(R.OFF_CAP, Q.off + H.off));
    near(b.defP, Math.min(R.DEF_PASSIVE_CAP, A.def + H.def));
    near(b.dodgeB, Math.min(R.DODGE_BONUS_CAP, A.dodge + H.dodge));
    if (a || q || h) assert.deepEqual([b.Lc, b.Lq, b.Ld], [a, q, h]);
  }
});

test('hệ số tuyến tính: nhân đôi hệ số thì nhân đôi buff (khi chưa chạm trần)', () => {
  for (const lv of [{ Lc: 2 }, { Lq: 3 }, { Ld: 4 }, { Lc: 1, Lq: 1, Ld: 1 }]) {
    const x = computeBuff(lv, 0.25), y = computeBuff(lv, 0.5);
    near(y.offExt, 2 * x.offExt); near(y.defP, 2 * x.defP); near(y.dodgeB, 2 * x.dodgeB);
  }
});

test('hệ số 0: buff bằng 0 nhưng vẫn ghi cấp', () => {
  const b = computeBuff({ Lc: 6, Lq: 4, Ld: 9 }, 0);
  assert.deepEqual([b.offExt, b.defP, b.dodgeB], [0, 0, 0]);
  assert.deepEqual([b.Lc, b.Lq, b.Ld], [6, 4, 9]);
});

test('ở các hệ số 0,25 và 0,5 chưa tổ hợp nào chạm trần tổng; ở hệ số 1 giảm sát thương và né chạm trần', () => {
  for (const s of [0.25, 0.5]) {
    const b = computeBuff({ Lc: 6, Lq: 4, Ld: 9 }, s);
    assert.ok(b.defP < R.DEF_PASSIVE_CAP && b.dodgeB < R.DODGE_BONUS_CAP && b.offExt < R.OFF_CAP);
  }
  const m = computeBuff({ Lc: 6, Lq: 4, Ld: 9 }, 1);
  near(m.defP, R.DEF_PASSIVE_CAP);                 // 0,12 + 0,09 = 0,21 → chặn 0,15
  near(m.dodgeB, R.DODGE_BONUS_CAP);               // 0,06 + 0,045 = 0,105 → chặn 0,08
  near(m.offExt, 0.34);                            // 0,16 + 0,18 < 0,5
});

test('các trần tổng: tăng tối đa +50%, giảm bị động 15%, cộng né 8 điểm — kể cả hệ số rất lớn', () => {
  for (const s of [2, 10, 1000]) {
    const b = computeBuff({ Lc: 6, Lq: 4, Ld: 9 }, s);
    near(b.offExt, R.OFF_CAP); near(b.defP, R.DEF_PASSIVE_CAP); near(b.dodgeB, R.DODGE_BONUS_CAP);
  }
  assert.equal(R.OFF_CAP, 0.5); assert.equal(R.DEF_PASSIVE_CAP, 0.15); assert.equal(R.DODGE_BONUS_CAP, 0.08);
});

test('trần theo từng nguồn: Lc 6 → 12% / 6 điểm; Lq 4 → 16%; Ld 9 → 18% / 9% / 4,5 điểm (không vượt khi cấp lớn)', () => {
  const b = computeBuff({ Lc: 99, Lq: 99, Ld: 99 }, 1);
  assert.deepEqual([b.Lc, b.Lq, b.Ld], [6, 4, 9]);
  near(b.dodgeB, Math.min(0.06 + 0.045, R.DODGE_BONUS_CAP));
});

test('giá trị ngoài miền: kẹp vào [0, tối đa], làm tròn xuống, chuỗi số hợp lệ, rác thành 0', () => {
  assert.deepEqual([7, 100, 1e9, 6.9].map(x => computeBuff({ Lc: x }).Lc), [6, 6, 6, 6]);
  assert.deepEqual([5, 99, 4.99].map(x => computeBuff({ Lq: x }).Lq), [4, 4, 4]);
  assert.deepEqual([10, 99, 9.5].map(x => computeBuff({ Ld: x }).Ld), [9, 9, 9]);
  assert.equal(computeBuff({ Ld: 2.9 }).Ld, 2);
  assert.equal(computeBuff({ Lq: '3' }).Lq, 3);
  assert.equal(computeBuff({ Lc: -4, Lq: 2 }).Lc, 0);
  assert.equal(computeBuff({ Lc: 'xyz', Lq: 2 }).Lc, 0);
  assert.equal(computeBuff({ Lc: NaN, Lq: 2 }).Lc, 0);
  assert.equal(computeBuff({ Lc: null, Lq: 2 }).Lc, 0);
  const inf = computeBuff({ Lc: Infinity, Lq: 1 });
  assert.equal(inf.Lc, 0, 'Infinity không phải số hữu hạn nên bị coi là 0 (không kẹp lên tối đa)');
  for (const x of [{ Lc: 1e9, Lq: 1e9, Ld: 1e9 }, { Lc: -1e9, Lq: -1e9, Ld: 5 }]) {
    const b = computeBuff(x, 1);
    for (const k of ['offExt', 'defP', 'dodgeB']) assert.ok(Number.isFinite(b[k]) && b[k] >= 0);
  }
});

test('nhãn hiển thị đúng số (dấu phẩy thập phân, làm tròn 0,1)', () => {
  assert.deepEqual(computeBuff({ Lc: 3 }, 0.5).labels, ['Pháp tướng cấp 3: giảm 3% sát thương nhận, cộng 1,5 điểm né']);
  assert.deepEqual(computeBuff({ Lq: 4 }, 0.5).labels, ['Quỷ ám cấp 4: tăng 8% sát thương gây ra']);
  assert.deepEqual(computeBuff({ Ld: 1 }, 0.5).labels, ['Hào quang cảnh giới 1: tăng 1% sát thương, giảm 0,5% sát thương nhận, cộng 0,3 điểm né']);
  assert.deepEqual(computeBuff({ Lc: 6, Lq: 4, Ld: 9 }, 0.5).labels, [
    'Pháp tướng cấp 6: giảm 6% sát thương nhận, cộng 3 điểm né',
    'Quỷ ám cấp 4: tăng 8% sát thương gây ra',
    'Hào quang cảnh giới 9: tăng 9% sát thương, giảm 4,5% sát thương nhận, cộng 2,3 điểm né'
  ]);
  assert.deepEqual(computeBuff({ Lc: 6 }, 1).labels, ['Pháp tướng cấp 6: giảm 12% sát thương nhận, cộng 6 điểm né']);
  assert.deepEqual(computeBuff({ Lc: 1 }, 0.25).labels, ['Pháp tướng cấp 1: giảm 0,5% sát thương nhận, cộng 0,3 điểm né']);
  assert.equal(computeBuff({ Lc: 1 }).labels.length, 1);
  assert.equal(computeBuff({ Lq: 1, Ld: 1 }).labels.length, 2);
});

const NUM = '(\\d+(?:,\\d+)?)';
const num = s => parseFloat(s.replace(',', '.'));
/** Cộng các số "giảm / tăng / cộng" trong các nhãn nguồn (bỏ nhãn ghi chú trần). */
function labelTotals(labels) {
  const t = { def: 0, off: 0, dodge: 0 };
  for (const l of labels) {
    if (!/^(Pháp tướng|Quỷ ám|Hào quang)/.test(l)) continue;
    let m;
    if ((m = new RegExp('tăng ' + NUM + '% sát thương').exec(l))) t.off += num(m[1]);
    if ((m = new RegExp('giảm ' + NUM + '% sát thương nhận').exec(l))) t.def += num(m[1]);
    if ((m = new RegExp('cộng ' + NUM + ' điểm né').exec(l))) t.dodge += num(m[1]);
  }
  return t;
}

test('nhãn khớp số thật khi chưa chạm trần (mọi tổ hợp, hệ số 0,25 và 0,5)', () => {
  for (const s of [0.25, 0.5]) for (let a = 0; a <= 6; a++) for (let q = 0; q <= 4; q++) for (let h = 0; h <= 9; h++) {
    const b = computeBuff({ Lc: a, Lq: q, Ld: h }, s), t = labelTotals(b.labels);
    assert.ok(Math.abs(t.def - b.defP * 100) <= 0.1 + 1e-9, `giảm ${t.def} != ${b.defP * 100} (${a},${q},${h},${s})`);
    assert.ok(Math.abs(t.off - b.offExt * 100) <= 0.1 + 1e-9);
    assert.ok(Math.abs(t.dodge - b.dodgeB * 100) <= 0.1 + 1e-9);
    assert.equal(b.labels.length, (a ? 1 : 0) + (q ? 1 : 0) + (h ? 1 : 0), 'không có nhãn thừa khi chưa chạm trần');
  }
});

test('nhãn trung thực khi chạm trần: hoặc tổng nhãn khớp số thật, hoặc có dòng nói rõ bị chặn', () => {
  for (const s of [1, 2]) for (let a = 0; a <= 6; a++) for (let q = 0; q <= 4; q++) for (let h = 0; h <= 9; h++) {
    const b = computeBuff({ Lc: a, Lq: q, Ld: h }, s), t = labelTotals(b.labels);
    const capNote = b.labels.find(l => /chặn|tối đa/.test(l) && !/^(Pháp tướng|Quỷ ám|Hào quang)/.test(l));
    const sums = { def: t.def, off: t.off, dodge: t.dodge };
    const real = { def: b.defP * 100, off: b.offExt * 100, dodge: b.dodgeB * 100 };
    for (const k of ['def', 'off', 'dodge']) {
      if (sums[k] > real[k] + 0.15) assert.ok(capNote, `nhãn ghi ${sums[k]}% nhưng thực tế ${real[k]}% mà không nói trần (${a},${q},${h},hệ số ${s}, ${k})`);
    }
  }
});

test('nhãn ghi trần đúng số (hệ số 1, Lc 6 + Ld 9: giảm tối đa 15%, né tối đa 8 điểm)', () => {
  const l = computeBuff({ Lc: 6, Ld: 9 }, 1).labels.join(' | ');
  assert.match(l, /tối đa 15%/);
  assert.match(l, /tối đa 8 điểm/);
  assert.doesNotMatch(l, /tăng sát thương tối đa/, 'tăng sát thương chưa chạm trần thì không ghi');
});

test('buff đi vào engine đúng chỗ: Quỷ ám tăng đòn, Pháp tướng giảm đòn, buff né chỉ cho né', () => {
  const b = computeBuff({ Lq: 4, Lc: 6 }, 1);
  const d = new Duel({
    seed: 't', rng: (() => { const v = [0.5, 0.5]; let i = 0; return () => v[i++]; })(),
    a: { level: 1, loadout: ['trong-quyen'], buff: b }, b: { level: 1, loadout: ['tat-phong-quyen'], buff: b }
  });
  const o = d.step('trong-quyen', 'tat-phong-quyen');
  const toB = o.events.find(e => e.k === 'hit' && e.atk === 'a').dmg, toA = o.events.find(e => e.k === 'hit' && e.atk === 'b').dmg;
  assert.equal(toB, Math.round(38 * 1.16 * 0.88));      // 38 × (1 + 0,16) × (1 - 0,12)
  assert.equal(toA, Math.round(25 * 1.16 * 0.88));
  assert.equal(o.state.a.defP, 0.12);
  assert.equal(o.state.a.offExt, 0.16);
  assert.equal(o.state.a.dodgeB, 0.06);
});
