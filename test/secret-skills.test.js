'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { claim } = require('../lib/martial/secrets');
const { Duel } = require('../lib/pk/engine');

for (const [role, branch, required, id] of [
  ['wanderer', 'toc', 500, 'tau-vi-thuong-sach'],
  ['beggar', 'cuong', 2300, 'nhu-lai-than-chuong'],
  ['obito', 'nhu', 1700, 'kamui']
]) {
  test(`${role}: requires both level and maximum branch; awards only once`, () => {
    const p = { congLuc: required - 1, tam: { [branch]: 300 } };
    assert.equal(claim(p, role).ok, false);
    p.congLuc = required; p.tam[branch] = 299;
    assert.equal(claim(p, role).ok, false);
    p.tam[branch] = 300;
    assert.deepEqual(claim(p, role).id, id);
    assert.equal(claim(p, role).already, true);
    assert.deepEqual(p.secretSkills, [id]);
  });
}
test('unknown and prototype roles cannot grant skills', () => {
  for (const role of ['constructor', '__proto__', 'unknown']) assert.equal(claim({}, role).ok, false);
});

function duel(aSecrets = [], bSecrets = [], aLoadout = ['trong-quyen'], bLoadout = ['thiet-bich']) {
  return new Duel({ a: { level: 9, loadout: aLoadout, secretSkills: aSecrets }, b: { level: 9, loadout: bLoadout, secretSkills: bSecrets }, rng: () => 0.5, vari: () => 0.5 });
}
test('escape is a draw and cannot be chosen without unlocking', () => {
  const d = duel(['tau-vi-thuong-sach']);
  assert.equal(d.validatePick('b', 'tau-vi-thuong-sach').ok, false);
  const result = d.step('tau-vi-thuong-sach', 'thiet-bich');
  assert.equal(result.ended.result, 'draw');
  assert.equal(result.ended.reason, 'escape');
  assert.equal(result.state.a.hp, result.state.a.hpMax);
});
test('palm pierces defense and is single use', () => {
  const d = duel(['nhu-lai-than-chuong']);
  const r = d.step('nhu-lai-than-chuong', 'thiet-bich');
  assert.ok(r.events.some(x => x.k === 'hit' && x.trueDamage && x.red === 0));
  assert.equal(d.validatePick('a', 'nhu-lai-than-chuong').ok, false);
});
test('Tứ Lạng reflects the palm, while Kamui prevents the reflection', () => {
  const d = duel(['nhu-lai-than-chuong'], [], ['trong-quyen'], ['tu-lang-bat-thien-can']);
  const r = d.step('nhu-lai-than-chuong', 'tu-lang-bat-thien-can');
  assert.ok(r.events.some(x => x.k === 'counter' && x.reflect));
  assert.equal(r.state.b.hp, r.state.b.hpMax);
  const protectedDuel = duel(['nhu-lai-than-chuong', 'kamui'], [], ['trong-quyen'], ['tu-lang-bat-thien-can']);
  const protectedResult = protectedDuel.step('kamui:nhu-lai-than-chuong', 'tu-lang-bat-thien-can');
  assert.equal(protectedResult.state.a.hp, protectedResult.state.a.hpMax);
  assert.equal(protectedResult.state.b.hp, protectedResult.state.b.hpMax);
});
test('kamui blocks unavoidable damage while still attacking and can be used once', () => {
  const d = duel(['kamui'], ['nhu-lai-than-chuong']);
  const r = d.step('kamui:trong-quyen', 'nhu-lai-than-chuong');
  assert.equal(r.state.a.hp, r.state.a.hpMax);
  assert.ok(r.state.b.hp < r.state.b.hpMax);
  assert.equal(d.validatePick('a', 'kamui:trong-quyen').ok, false);
});
test('kamui protects against reflected charge damage', () => {
  const d = duel(['kamui'], [], ['trong-quyen'], ['tu-lang-bat-thien-can']);
  d.roll = () => true;
  const r = d.step('kamui:trong-quyen', 'tu-lang-bat-thien-can');
  assert.equal(r.state.a.hp, r.state.a.hpMax);
});
test('kamui can accompany the forced release of Phá Sơn', () => {
  const d = duel(['kamui'], [], ['tu-luc-pha-son'], ['tu-lang-bat-thien-can']);
  d.step('tu-luc-pha-son', 'dieu-tuc');
  assert.ok(d.legal('a').picks.includes('kamui:tu-luc-pha-son'));
  const hp = d.state('a').hp;
  const r = d.step('kamui:tu-luc-pha-son', 'tu-lang-bat-thien-can');
  assert.equal(r.state.a.hp, hp);
  assert.equal(d.usedSecrets.a.has('kamui'), true);
});
