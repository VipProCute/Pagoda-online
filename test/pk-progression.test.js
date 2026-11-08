'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { Duel } = require('../lib/pk/engine');
const { computeBuff } = require('../lib/pk/buffs');
const atk = 'trong-quyen';
function duel(a, b) { return new Duel({ rng: () => 0.5, a: { level: 1, loadout: [atk], ...a }, b: { level: 1, loadout: [atk], ...b } }); }
test('tu luyện tăng lực đánh và chịu đòn, cúng dường bổ sung lợi thế cùng cảnh giới', () => {
  const baseline = duel({}, {}), trained = duel({ level: 7 }, {}), together = duel({ level: 7, buff: computeBuff({ Ld: 9 }) }, { level: 7 });
  baseline.step(atk, atk); trained.step(atk, atk); together.step(atk, atk);
  assert.ok(trained.f.b.hp < baseline.f.b.hp, 'tu luyện gây nhiều sát thương hơn');
  assert.ok(trained.f.a.hp > baseline.f.a.hp, 'tu luyện chịu ít sát thương hơn');
  assert.ok(together.f.a.hp > together.f.b.hp, 'cùng tu luyện, có hào quang cúng dường mạnh hơn');
  const freeVsDonor = duel({ level: 7 }, { buff: computeBuff({ Lc: 6, Ld: 9 }) });
  while (!freeVsDonor.over) freeVsDonor.step(freeVsDonor.f.a.mana >= 14 ? atk : 'dieu-tuc', freeVsDonor.f.b.mana >= 14 ? atk : 'dieu-tuc');
  assert.equal(freeVsDonor.over.result, 'a', 'người tu luyện đánh thắng người chỉ có hào quang khi dùng cùng đòn cơ bản');
});
test('nộ 0/10/100 tăng 0/3/30%, tiêu hao sau đòn công và chịu trần chung 50%', () => {
  for (const [rage, factor] of [[0, 1], [10, 1.03], [100, 1.3]]) {
    const d = duel({}, {}); d.f.a.rage = rage;
    const result = d.step(atk, 'dieu-tuc');
    assert.equal(result.events.find(e => e.k === 'hit').dmg, Math.round(38 * factor));
    assert.equal(d.f.a.rage, 0);
  }
  const d = duel({ buff: { offExt: 0.4 } }, {}); d.f.a.rage = 100; d.f.a.kc = 2;
  assert.equal(d.step(atk, 'dieu-tuc').events.find(e => e.k === 'hit').dmg, Math.round(38 * 1.5));
});
