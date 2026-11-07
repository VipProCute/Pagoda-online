'use strict';
/*
 * Sinh dữ liệu trận mẫu cho trang thử Sân đấu, chạy bằng ĐÚNG engine thật (lib/pk/engine.js) nên sự kiện đúng hình dạng thật.
 *   node tools/ui-harness/arena/gen-fixtures.js     → ghi tools/ui-harness/arena/fixtures.json
 * Mỗi kịch bản là chuỗi cặp chiêu cho từng lượt; thử seed 1, 2, 3… tới khi các sự kiện mong muốn xảy ra đúng chỗ.
 */
const fs = require('fs');
const path = require('path');
const M = require('../../../public/js/martial');
const { Duel } = require('../../../lib/pk/engine');
const { makeRng } = require('../../../lib/pk/rng');
const { computeBuff } = require('../../../lib/pk/buffs');

const side = s => (s === 'a' ? 'you' : 'op');
const conv = e => {
  const o = { ...e };
  for (const k of ['side', 'atk', 'def', 'target']) if (o[k]) o[k] = side(o[k]);
  if (e.k === 'end') o.result = e.result === 'draw' ? 'draw' : side(e.result);
  return o;
};
const view = r => ({
  turn: r.turn,
  picks: { you: r.picks.a, op: r.picks.b },
  events: r.events.map(conv),
  state: { you: r.state.a, op: r.state.b },
  ended: r.ended ? { result: r.ended.result === 'draw' ? 'draw' : r.ended.result === 'a' ? 'win' : 'lose', reason: r.ended.reason } : null
});

const LEARNED = ['trong-quyen', 'thiet-bich', 'kim-chung-trao', 'phan-chan', 'tu-luc-pha-son', 'anh-bo-ho-than', 'tat-phong-quyen', 'khinh-than-bo', 'nhu-van-bo', 'lieu-diep-chuong'];
const LOOK_YOU = { c: 3, g: 'nam', h: 2 }, LOOK_OP = { c: 0, g: 'nu', h: 0 };

/** script: [[pickA, pickB, trước-lượt?(duel)]…]; want(results) → true nếu seed này cho đúng các sự kiện mong muốn. */
function build({ name, a, b, script, want, buffs }) {
  for (let seed = 1; seed < 20000; seed++) {
    const d = new Duel({ rng: makeRng(name + seed), a: { level: a.level, loadout: a.loadout, buff: buffs && buffs.you }, b: { level: b.level, loadout: b.loadout, buff: buffs && buffs.op } });
    const turns = [], reveals = [];
    let ok = true;
    for (let i = 0; i < script.length && !d.over; i++) {
      const [pa, pb, pre] = script[i];
      if (pre) pre(d);
      const lg = d.legal('a');
      const t = { turn: d.turn, forced: lg.forced, legal: lg.picks, state: { you: d.state('a'), op: d.state('b') } };
      if (i === 0) t.loadouts = { you: a.loadout, op: b.loadout };
      turns.push(t);
      const r = d.step(pa, pb);
      reveals.push(view(r));
      if (r.ended) break;
    }
    if (want(reveals, turns)) {
      const last = reveals[reveals.length - 1];
      const end = last.ended ? { result: last.ended.result, reason: last.ended.reason, turns: last.turn, state: last.state, record: { wins: 13, losses: 8, draws: 1 } } : null;
      return {
        seed: name + seed,
        you: { pid: 101, name: 'Diệu Liên', look: LOOK_YOU, level: a.level, hpMax: 200, manaMax: M.manaMaxOf(a.level), learned: LEARNED, loadout: a.loadout, warnings: [] },
        op: { pid: 202, name: 'Huyền Trang', look: LOOK_OP, level: b.level, hpMax: 200, manaMax: M.manaMaxOf(b.level) },
        turns, reveals, end
      };
    }
  }
  throw new Error('Không tìm được seed cho ' + name);
}

const has = (r, f) => r.events.some(f);
const A = build({
  name: 'A',
  a: { level: 7, loadout: ['trong-quyen', 'kim-chung-trao', 'nhu-van-bo', 'tu-luc-pha-son'] },
  b: { level: 6, loadout: ['lien-hoan-cuoc', 'doat-anh-phan-kich', 'tiep-kinh-phan-chuong', 'ta-luc-hoa-giai'] },
  script: [
    ['trong-quyen', 'tiep-kinh-phan-chuong'],
    ['nhu-van-bo', 'lien-hoan-cuoc'],
    ['tu-luc-pha-son', 'lien-hoan-cuoc'],
    ['tu-luc-pha-son', 'ta-luc-hoa-giai'],
    ['kim-chung-trao', 'doat-anh-phan-kich'],
    ['trong-quyen', 'lien-hoan-cuoc', d => { d.f.b.hp = 30; }]
  ],
  want: R => R.length === 6 && has(R[0], e => e.k === 'parry' && e.ok) && has(R[0], e => e.k === 'counter') && has(R[0], e => e.k === 'exposed') &&
    has(R[1], e => e.k === 'dodge' && e.ok) && has(R[1], e => e.k === 'dodge' && !e.ok) && has(R[3], e => e.k === 'hit') && has(R[4], e => e.k === 'kc') &&
    R[5].ended && R[5].ended.result === 'win'
});

// Trận bị đẩy tới suy kiệt: bốn lượt liền không ai mất máu
const B = build({
  name: 'B',
  a: { level: 4, loadout: ['thiet-bich', 'anh-bo-ho-than', 'trong-quyen', 'nhu-van-bo'] },
  b: { level: 4, loadout: ['ta-luc-hoa-giai', 'thiet-bich', 'tat-phong-quyen', 'khinh-than-bo'] },
  script: [['thiet-bich', 'ta-luc-hoa-giai'], ['anh-bo-ho-than', 'thiet-bich'], ['thiet-bich', 'ta-luc-hoa-giai'], ['anh-bo-ho-than', 'thiet-bich']],
  want: R => R.length === 4 && has(R[3], e => e.k === 'sudden')
});
B.you.loadout = ['thiet-bich', 'anh-bo-ho-than', 'trong-quyen', 'nhu-van-bo'];

// Trận hết giờ chọn: bên mình đứng yên (hết giờ), bên kia điều tức
const C = build({
  name: 'C',
  a: { level: 3, loadout: ['trong-quyen', 'thiet-bich', 'nhu-van-bo', 'tat-phong-quyen'] },
  b: { level: 3, loadout: ['tat-phong-quyen', 'thiet-bich', 'nhu-van-bo', 'lieu-diep-chuong'] },
  script: [[null, 'tat-phong-quyen'], ['dieu-tuc', 'lieu-diep-chuong']],
  want: R => R.length === 2 && has(R[0], e => e.k === 'hit' && e.atk === 'op')
});

const buff = {
  mid: { you: computeBuff({ Lc: 3, Ld: 4 }), op: computeBuff({ Lq: 2 }) },
  heavy: { you: computeBuff({ Lc: 5, Ld: 7 }), op: computeBuff({ Lq: 3 }) },
  aura: { you: computeBuff({ Ld: 5 }), op: computeBuff({ Lc: 2 }) },
  oneSide: { you: computeBuff({}), op: computeBuff({ Ld: 3, Lc: 1 }) }
};

const out = { A, B, C, buff };
fs.writeFileSync(path.join(__dirname, 'fixtures.json'), JSON.stringify(out, null, 1));
const summary = f => f.reveals.map(r => `L${r.turn}: ${r.events.map(e => e.k).join(',')}`).join('\n  ');
console.log('A seed', A.seed, '\n  ' + summary(A), '\n  end:', JSON.stringify(A.end && { r: A.end.result, why: A.end.reason }));
console.log('B seed', B.seed, '\n  ' + summary(B));
console.log('C seed', C.seed, '\n  ' + summary(C));
