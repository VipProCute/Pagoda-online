'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const M = require('../public/js/martial');
function choreography(picks, events) {
  const sandbox = { MARTIAL: M, Math, Date };
  const source = fs.readFileSync(require.resolve('../public/js/arena.js'), 'utf8').replace('root.Arena = { init,', 'root.planForTest = (rev) => choreo(buildSteps(rev), rev.picks); root.Arena = { init,');
  vm.runInNewContext(source, sandbox);
  return sandbox.planForTest({ picks, events });
}
const pick = skill => ({ skill });
test('hai đòn công được ghép cùng nhịp và cùng thời điểm va chạm', () => {
  const plan = choreography({ you: pick('trong-quyen'), op: pick('tat-phong-quyen') }, [
    { k: 'hit', atk: 'you', def: 'op', idx: 1, of: 1, dmg: 38, red: 0 },
    { k: 'hit', atk: 'op', def: 'you', idx: 1, of: 1, dmg: 26, red: 0 }
  ]);
  assert.equal(plan.length, 1);
  assert.equal(plan[0].type, 'clash');
  assert.equal(plan[0].members.length, 2);
  assert.equal(plan[0].members[0].pI, plan[0].members[1].pI);
});
test('đánh gặp thủ giữ cách diễn hiện tại; đánh nhiều nhịp bắt đầu cùng nhau', () => {
  const guarded = choreography({ you: pick('trong-quyen'), op: pick('thiet-bich') }, [
    { k: 'guard', side: 'op', red: 0.65 }, { k: 'hit', atk: 'you', def: 'op', idx: 1, of: 1, dmg: 13, red: 0.65 }
  ]);
  assert.ok(guarded.every(b => b.type !== 'clash'));
  const combo = choreography({ you: pick('lien-hoan-cuoc'), op: pick('trong-quyen') }, [
    { k: 'hit', atk: 'you', def: 'op', idx: 1, of: 2, dmg: 20, red: 0 }, { k: 'hit', atk: 'you', def: 'op', idx: 2, of: 2, dmg: 20, red: 0 },
    { k: 'hit', atk: 'op', def: 'you', idx: 1, of: 1, dmg: 38, red: 0 }
  ]);
  assert.equal(combo[0].members.length, 2);
  assert.equal(combo[1].members.length, 1);
});
