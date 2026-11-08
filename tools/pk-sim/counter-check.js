#!/usr/bin/env node
'use strict';
// Tìm khắc chế cho bộ Phá Sơn + Tứ Lạng + hai đòn nhanh, rồi kiểm chứng seed độc lập.
const M = require('../../public/js/martial');
const L = require('./loadouts');
const { series } = require('./play');
const mastery = Object.fromEntries(M.SKILL_ORDER.map(id => [id, M.MASTERY_MAX]));
const target = L.ids('TL TLB TPQ LHC');
function measure(ids, n, seed) {
  return series({ bots: ['eq', 'eq'], levels: [10, 10], mastery: [mastery, mastery],
    loadouts: { a: ids, b: target }, exact: true }, n, seed);
}
const screen = L.allSets(M).filter(s => s.ids.includes(L.CODE.TLB)).map((s, i) => ({
  set: s.name, ...measure(s.ids, 20, `counter-search:${i}`)
})).sort((a, b) => b.score - a.score);
const validation = ['TQ PC LHC TLB', 'TQ LHC LDC TLB', 'TQ TL LHC TLB', 'TL TLB TPQ LHC'].map(set => ({
  set, ...measure(L.ids(set), 1000, 'validation:' + set)
}));
console.log(JSON.stringify({ target: L.label(target), level: 10, masteryXP: 240,
  policy: 'eq one-turn, exact planning; random damage in actual matches',
  screenedSets: screen.length, screenGamesEach: 20, topScreen: screen.slice(0, 12), validation }, null, 2));
