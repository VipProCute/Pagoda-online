'use strict';
/*
 * Bối cảnh luật cho công cụ mô phỏng: engine thật, hoặc một bản engine nạp lại với vài hằng số / số liệu chiêu bị đổi.
 * Không sửa file nào trong repo: nạp lại module trong bộ nhớ đệm rồi trả bộ nhớ đệm về như cũ.
 *
 * Khóa đổi (tham số --set):  rules.<HẰNG_SỐ>=số · skill.<id>.<đường.dẫn>=số (vd skill.tu-luc-pha-son.mana=26,
 * skill.lien-hoan-cuoc.hits.0.base=18) · mana.base=số · mana.perLevel=số
 */
const path = require('path');
const root = path.resolve(__dirname, '../..');
const file = f => require.resolve(path.join(root, f));
const FILES = ['lib/pk/engine.js', 'lib/pk/buffs.js', 'lib/pk/rules.js', 'public/js/martial.js'].map(file);

function parseSet(list) {
  const out = { rules: {}, skills: [], mana: {} };
  for (const item of [].concat(list || []).filter(Boolean)) {
    const eq = item.indexOf('=');
    if (eq < 0) throw new Error(`Thiếu "=" trong --set ${item}`);
    const key = item.slice(0, eq), val = Number(item.slice(eq + 1));
    if (!Number.isFinite(val)) throw new Error(`Giá trị không phải số: ${item}`);
    const parts = key.split('.');
    if (parts[0] === 'rules' && parts.length === 2) out.rules[parts[1]] = val;
    else if (parts[0] === 'skill' && parts.length >= 3) out.skills.push({ id: parts[1], path: parts.slice(2), val });
    else if (parts[0] === 'mana' && (parts[1] === 'base' || parts[1] === 'perLevel')) out.mana[parts[1]] = val;
    else throw new Error(`Khóa không hợp lệ: ${key} (dùng rules.X, skill.id.đường.dẫn, mana.base, mana.perLevel)`);
  }
  return out;
}

function deepFreeze(o) { if (o && typeof o === 'object') { Object.values(o).forEach(deepFreeze); Object.freeze(o); } return o; }

function build(set) {
  const saved = FILES.map(f => [f, require.cache[f]]);
  FILES.forEach(f => { delete require.cache[f]; });
  try {
    const rulesPath = file('lib/pk/rules.js');
    const baseRules = require(rulesPath);
    for (const k of Object.keys(set.rules)) if (!(k in baseRules)) throw new Error(`Không có hằng số rules.${k}`);
    require.cache[rulesPath].exports = Object.freeze({ ...baseRules, ...set.rules });
    const M = require(file('public/js/martial.js'));
    for (const s of set.skills) {
      const i = M.SKILL_LIST.findIndex(x => x.id === s.id);
      if (i < 0) throw new Error(`Không có chiêu ${s.id}`);
      const clone = JSON.parse(JSON.stringify(M.SKILLS[s.id]));
      let o = clone;
      for (const p of s.path.slice(0, -1)) { if (o[p] == null) throw new Error(`Không có trường ${s.id}.${s.path.join('.')}`); o = o[p]; }
      const last = s.path[s.path.length - 1];
      if (!(last in o) && !(['dodgeMul', 'pierce', 'failRed', 'pct', 'cap'].includes(last))) throw new Error(`Không có trường ${s.id}.${s.path.join('.')}`);
      o[last] = s.val;
      M.SKILLS[s.id] = deepFreeze(clone);
      M.SKILL_LIST[i] = clone;
    }
    if (set.mana.base != null || set.mana.perLevel != null) {
      const base = set.mana.base != null ? set.mana.base : M.MANA_BASE, per = set.mana.perLevel != null ? set.mana.perLevel : M.MANA_PER_LEVEL;
      M.manaMaxOf = level => base + per * (Math.max(1, Math.min(M.LEVEL_MAX, level | 0)) - 1);
    }
    const E = require(file('lib/pk/engine.js'));
    const B = require(file('lib/pk/buffs.js'));
    return { Duel: E.Duel, chance: E.chance, M, R: E.RULES, computeBuff: B.computeBuff, set };
  } finally {
    FILES.forEach(f => { delete require.cache[f]; });
    for (const [f, m] of saved) if (m) require.cache[f] = m;
  }
}

let real = null;
/** Bối cảnh engine thật của repo. */
function realCtx() {
  if (!real) {
    const E = require('../../lib/pk/engine'), B = require('../../lib/pk/buffs');
    real = { Duel: E.Duel, chance: E.chance, M: require('../../public/js/martial'), R: E.RULES, computeBuff: B.computeBuff, set: null };
  }
  return real;
}

/** Bối cảnh với các thay đổi (danh sách chuỗi "khóa=số" hoặc đối tượng đã parse). Không thay đổi → engine thật. */
function makeCtx(set) {
  const s = Array.isArray(set) || typeof set === 'string' ? parseSet(set) : set;
  if (!s || (!Object.keys(s.rules).length && !s.skills.length && !Object.keys(s.mana).length)) return realCtx();
  return build(s);
}

module.exports = { makeCtx, realCtx, parseSet };
