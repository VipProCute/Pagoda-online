'use strict';
/*
 * Engine luận võ so chiêu đồng thời. THUẦN: không timer, không socket, không đọc đồng hồ.
 * Máy chủ (lib/pk/manager.js) và công cụ mô phỏng (tools/pk-sim) dùng chung đúng module này,
 * nên số mô phỏng là số chạy thật.
 *
 * Hai chiêu được giải như cùng xảy ra: mọi phép tính dùng trạng thái ĐẦU lượt của cả hai bên,
 * thứ tự A trước hay B trước không đổi kết quả. Tốc độ chỉ vào hàm xác suất né / đỡ, không quyết định ai đánh trước.
 *
 * Thứ tự dùng ngẫu nhiên (để test tái lập): với từng bên tấn công theo thứ tự a rồi b, từng nhịp theo thứ tự:
 *   1. nếu đối thủ đang NÉ hoặc ĐỠ: một số rng() cho phép thử né / đỡ (thành công nếu số < xác suất)
 *   2. nếu nhịp trúng: một số rng() cho dao động sát thương (1 ± DMG_VAR)
 *
 * Sự kiện trả về trong `events` (side là 'a' | 'b'; manager đổi sang "you" / "op" cho từng người):
 *   { k:'pick',    side, skill, phase, auto, invalid, mana }     chiêu được công bố (phase: 'charge' | 'release' | null)
 *   { k:'dodge',   atk, def, idx, of, p, ok }                    thử né nhịp idx/of của atk; p là xác suất cuối cùng
 *   { k:'parry',   atk, def, idx, of, p, ok }                    thử đỡ
 *   { k:'hit',     atk, def, idx, of, dmg, red }                 nhịp trúng gây dmg; red = phần giảm đã áp (0..1) từ chiêu thủ / tụ lực / đỡ hụt
 *   { k:'counter', side, target, dmg }                           side phản đòn lên target
 *   { k:'guard',   side, red }                                   side đang thủ
 *   { k:'charge',  side } · { k:'release', side }                bắt đầu tụ lực · tung đòn tụ lực
 *   { k:'rest',    side } · { k:'idle', side }
 *   { k:'rage',    side, delta, value } · { k:'kc', side } · { k:'exposed', side }
 *   { k:'sudden',  dmg, streak }                                suy kiệt: cả hai mất dmg
 *   { k:'end',     result:'a'|'b'|'draw', reason }               reason: 'ko' | 'double-ko' | 'turn-limit'
 */
const M = require('../../public/js/martial');
const R = require('./rules');
const { makeRng, newSeed } = require('./rng');

const SIDES = ['a', 'b'];
const other = s => (s === 'a' ? 'b' : 'a');

/** P = Pmin + (Pmax - Pmin) / (1 + exp(-(Vphòng - Vcông) / K)) */
function chance(vDef, vAtk) {
  return R.PMIN + (R.PMAX - R.PMIN) / (1 + Math.exp(-(vDef - vAtk) / R.K));
}

function newFighter(opts) {
  const level = Math.max(1, Math.min(M.LEVEL_MAX, (opts && opts.level) | 0 || 1));
  const buff = (opts && opts.buff) || {};
  const manaMax = M.manaMaxOf(level);
  return {
    level, hp: R.HP, hpMax: R.HP, mana: manaMax, manaMax, rage: 0,
    kc: 0,               // còn bao nhiêu lượt được cộng Kim Chung (0 = không)
    exposed: 0,          // 1 = đang sơ hở (đòn lượt trước bị né / đỡ hết)
    charging: null,      // id chiêu đang tụ lực, lượt này phải tung
    offExt: buff.offExt || 0, defP: buff.defP || 0, dodgeB: buff.dodgeB || 0
  };
}

/** Bản trạng thái công khai gửi cho trình duyệt (không có số buff thô). */
function publicState(f) {
  return {
    level: f.level, hp: Math.max(0, f.hp), hpMax: f.hpMax, mana: f.mana, manaMax: f.manaMax, rage: Math.round(f.rage),
    charging: f.charging, kc: f.kc, exposed: f.exposed ? 1 : 0,
    offExt: round3(f.offExt), defP: round3(f.defP), dodgeB: round3(f.dodgeB)
  };
}
const round3 = x => Math.round(x * 1000) / 1000;

class Duel {
  /**
   * @param {{seed?:string, rng?:()=>number, mode?:string,
   *          a:{level:number, loadout:string[], buff?:object}, b:{level:number, loadout:string[], buff?:object}}} opts
   */
  constructor(opts) {
    this.seed = opts.seed || newSeed();
    this.rng = opts.rng || makeRng(this.seed);
    // Hai chỗ cắm cho công cụ mô phỏng (liệt kê nhánh kết quả); mặc định lấy từ rng theo đúng thứ tự ghi ở đầu file.
    this.roll = opts.roll || (p => this.rng() < p);   // thử né / đỡ với xác suất p
    this.vari = opts.vari || (() => this.rng());      // số trong [0,1) cho dao động sát thương
    this.mode = opts.mode || 'balanced';
    this.f = { a: newFighter(opts.a), b: newFighter(opts.b) };
    this.loadout = { a: (opts.a.loadout || []).slice(0, 4), b: (opts.b.loadout || []).slice(0, 4) };
    this.turn = 1;                // lượt sắp chơi (bắt đầu từ 1)
    this.noDamageStreak = 0;
    this.sudden = null;           // lượt bắt đầu suy kiệt
    this.over = null;             // { result, reason } khi đã kết thúc
    this.history = [];            // [{ turn, picks, events }]
  }

  /** Hành động bắt buộc của bên `side` (tung đòn tụ lực), hoặc null. */
  forced(side) { return this.f[side].charging; }

  /** Các lựa chọn hợp lệ của `side` ở lượt này: chiêu trong bộ đủ nội lực + Điều tức; nếu đang tụ lực thì chỉ còn tung đòn. */
  legal(side) {
    const f = this.f[side];
    if (f.charging) return { forced: f.charging, picks: [f.charging] };
    const picks = this.loadout[side].filter(id => M.SKILLS[id] && M.SKILLS[id].mana <= f.mana);
    picks.push(M.REST_ID);
    return { forced: null, picks };
  }

  /** Kiểm tra một lựa chọn (manager dùng trước khi khóa). */
  validatePick(side, skillId) {
    const l = this.legal(side);
    if (l.picks.includes(skillId)) return { ok: true };
    if (skillId === M.IDLE_ID) return { ok: false, reason: 'Không chọn "Đứng yên" được, hết giờ sẽ tự đứng yên.' };
    if (!this.loadout[side].includes(skillId) && skillId !== M.REST_ID) return { ok: false, reason: 'Chiêu này không có trong bộ 4 chiêu của bạn.' };
    if (l.forced) return { ok: false, reason: 'Bạn đang tụ lực, lượt này phải tung đòn.' };
    return { ok: false, reason: 'Không đủ nội lực cho chiêu này.' };
  }

  state(side) { return publicState(this.f[side]); }

  /** Bản sao độc lập để thử nước đi (bot, mô phỏng). Dùng chung rng / roll / vari với bản gốc trừ khi truyền đè. */
  clone(over) {
    const c = Object.create(Duel.prototype);
    Object.assign(c, this, over || {});
    c.f = { a: { ...this.f.a }, b: { ...this.f.b } };
    c.loadout = { a: this.loadout.a.slice(), b: this.loadout.b.slice() };
    c.history = [];
    c.over = this.over ? { ...this.over } : null;
    return c;
  }

  /**
   * Giải một lượt. pickA / pickB là id chiêu (hoặc null / không hợp lệ → Đứng yên).
   * Trả về { turn, picks, events, state:{a,b}, ended: null | {result, reason} }.
   */
  step(pickA, pickB) {
    if (this.over) throw new Error('Trận đã kết thúc.');
    const turn = this.turn, events = [];
    const acts = { a: this._action('a', pickA), b: this._action('b', pickB) };
    const F0 = { a: { ...this.f.a }, b: { ...this.f.b } };     // trạng thái đầu lượt
    const kind = {};
    for (const s of SIDES) kind[s] = this._stance(acts[s], acts[other(s)]);

    for (const s of SIDES) {
      const a = acts[s];
      events.push({ k: 'pick', side: s, skill: a.id, phase: a.phase, auto: a.auto, invalid: a.invalid, mana: a.cost });
    }

    // tuyên bố trạng thái chiêu (thủ / tụ lực / nghỉ)
    for (const s of SIDES) {
      const a = acts[s];
      if (kind[s] === 'guard') events.push({ k: 'guard', side: s, red: a.skill.guard.red });
      else if (kind[s] === 'charge') events.push({ k: 'charge', side: s });
      else if (kind[s] === 'release') events.push({ k: 'release', side: s });
      else if (kind[s] === 'rest') events.push({ k: 'rest', side: s });
      else if (kind[s] === 'idle') events.push({ k: 'idle', side: s });
    }

    // tấn công: dmg[x] = tổng sát thương x nhận được trong lượt này
    const dmg = { a: 0, b: 0 }, evaded = { a: 0, b: 0 }, dodged = { a: 0, b: 0 }, hitsTaken = { a: 0, b: 0 };
    for (const att of SIDES) {
      if (!this._attacking(kind[att])) continue;
      const def = other(att);
      const r = this._strike(att, def, F0, acts, kind, events);
      dmg[def] += r.toDef; dmg[att] += r.toAtt;
      evaded[att] = r.evaded; dodged[def] += r.dodged; hitsTaken[def] += r.landed;
    }

    // cập nhật trạng thái từng bên
    const next = { a: this.f.a, b: this.f.b };
    for (const s of SIDES) {
      const n = next[s], a = acts[s], taken = dmg[s], attacked = this._attacking(kind[s]);
      n.hp -= taken;
      n.mana = Math.min(n.manaMax, n.mana - a.cost + R.REGEN + (kind[s] === 'rest' ? R.REST_BONUS : 0));
      // sơ hở: mọi nhịp tung ra đều bị né hoặc đỡ
      const nHits = attacked ? this._hits(a, kind[s]).length : 0;
      n.exposed = attacked && nHits > 0 && evaded[s] === nHits ? 1 : 0;
      if (n.exposed) events.push({ k: 'exposed', side: s });
      // nộ và Kim Chung
      const rage0 = n.rage;
      if (attacked) { n.rage = 0; n.kc = 0; } else if (n.kc > 0) n.kc -= 1;
      let gain = R.RAGE_FROM_DMG * taken;
      if (a.skill && a.skill.guard && a.skill.guard.rageOnHit && hitsTaken[s] > 0) gain += a.skill.guard.rageOnHit;
      if (a.skill && a.skill.dodge && a.skill.dodge.rageOnDodge && dodged[s] > 0) gain += a.skill.dodge.rageOnDodge;
      n.rage = Math.min(R.RAGE_MAX, n.rage + gain);
      if (a.skill && a.skill.guard && a.skill.guard.kc && taken > 0) { n.kc = R.KC_TURNS; events.push({ k: 'kc', side: s }); }
      if (n.rage !== rage0) events.push({ k: 'rage', side: s, delta: Math.round(n.rage - rage0), value: Math.round(n.rage) });
      n.charging = kind[s] === 'charge' ? a.id : null;
    }

    // suy kiệt
    const anyDamage = dmg.a + dmg.b > 0;
    this.noDamageStreak = anyDamage ? 0 : this.noDamageStreak + 1;
    if (this.sudden == null && (turn >= R.SUDDEN_FROM_TURN || this.noDamageStreak >= R.SUDDEN_NO_DAMAGE_STREAK)) this.sudden = turn;
    if (this.sudden != null) {
      const sd = R.SUDDEN_STEP * (turn - this.sudden + 1);
      next.a.hp -= sd; next.b.hp -= sd;
      events.push({ k: 'sudden', dmg: sd, streak: this.noDamageStreak });
    }

    // kết thúc
    let ended = null;
    const ha = next.a.hp, hb = next.b.hp;
    if (ha <= 0 || hb <= 0) {
      if (ha <= 0 && hb <= 0) ended = ha === hb ? { result: 'draw', reason: 'double-ko' } : { result: ha > hb ? 'a' : 'b', reason: 'double-ko' };
      else ended = { result: ha <= 0 ? 'b' : 'a', reason: 'ko' };
    } else if (turn >= R.MAX_TURNS) {
      ended = ha === hb ? { result: 'draw', reason: 'turn-limit' } : { result: ha > hb ? 'a' : 'b', reason: 'turn-limit' };
    }
    if (ended) { this.over = ended; events.push({ k: 'end', result: ended.result, reason: ended.reason }); }
    else this.turn = turn + 1;

    const picks = { a: pickInfo(acts.a), b: pickInfo(acts.b) };
    const out = { turn, picks, events, state: { a: this.state('a'), b: this.state('b') }, ended };
    this.history.push({ turn, picks, events });
    return out;
  }

  /* ---------- nội bộ ---------- */

  /** Chuẩn hóa lựa chọn thành hành động (có kiểm tra; sai thì Đứng yên). */
  _action(side, pick) {
    const f = this.f[side], l = this.legal(side);
    if (f.charging) {
      const sk = M.SKILLS[f.charging];
      return { id: f.charging, skill: sk, phase: 'release', cost: 0, auto: pick !== f.charging, invalid: false };
    }
    if (pick === M.REST_ID) return { id: M.REST_ID, skill: null, special: 'rest', phase: null, cost: 0, auto: false, invalid: false };
    if (pick && l.picks.includes(pick)) {
      const sk = M.SKILLS[pick];
      return { id: pick, skill: sk, phase: sk.kind === 'charge' ? 'charge' : null, cost: sk.mana, auto: false, invalid: false };
    }
    return { id: M.IDLE_ID, skill: null, special: 'idle', phase: null, cost: 0, auto: true, invalid: !!pick && pick !== M.IDLE_ID };
  }

  /** Thế thực sự của một hành động trong lượt này (Đoạt Ảnh phụ thuộc đối thủ). */
  _stance(act, opp) {
    if (act.special) return act.special;                      // 'rest' | 'idle'
    const k = act.skill.kind;
    if (act.phase === 'release') return 'release';
    if (k === 'hybrid') return (opp.skill && (opp.skill.kind === 'atk' || opp.phase === 'release')) ? 'parry' : 'atk';
    return k;                                                 // atk guard dodge parry charge
  }

  _attacking(stance) { return stance === 'atk' || stance === 'release'; }

  _hits(act, stance) {
    if (stance === 'release') return [act.skill.charge.release];
    return act.skill.hits;
  }

  /** `att` đánh `def`. Trả về sát thương lên def, phản đòn lên att và thống kê nhịp. */
  _strike(att, def, F0, acts, kind, events) {
    const X = F0[att], Y = F0[def], ax = acts[att], ay = acts[def];
    const hits = this._hits(ax, kind[att]);
    const off = M.combatPower(X.level).attack * (1 + Math.min(R.OFF_CAP, R.RAGE_PCT * X.rage + (X.kc > 0 ? R.KC_BONUS : 0) + X.offExt));
    const defStance = kind[def];
    let toDef = 0, toAtt = 0, parried = 0, evaded = 0, dodged = 0, landed = 0, lastBase = 0;
    hits.forEach((h, i) => {
      const idx = i + 1, of = hits.length;
      if (defStance === 'dodge') {
        let p = Math.min(R.DODGE_CAP, Math.max(R.PMIN, chance(ay.skill.dodge.spd, h.spd) + Y.dodgeB));
        if (h.dodgeMul) p *= h.dodgeMul;
        const ok = this.roll(p);
        events.push({ k: 'dodge', atk: att, def, idx, of, p: round3(p), ok });
        if (ok) { dodged++; evaded++; return; }
      } else if (defStance === 'parry') {
        const par = ay.skill.parry;
        const p = chance(par.spd, h.spd);
        const ok = this.roll(p);
        events.push({ k: 'parry', atk: att, def, idx, of, p: round3(p), ok });
        if (ok) { parried++; evaded++; lastBase = h.base; return; }
      }
      let red = 0;
      if (defStance === 'guard') red = ay.skill.guard.red * (ax.skill.pierce ? 1 - ax.skill.pierce : 1);
      else if (defStance === 'charge') red = ay.skill.charge.red;
      else if (defStance === 'parry' && ay.skill.parry.failRed) red = ay.skill.parry.failRed;
      const vr = 1 + R.DMG_VAR * (2 * this.vari() - 1);
      const d = Math.max(1, Math.round(vr * h.base * off * (1 - red) * (1 - Y.defP) * (1 - M.combatPower(Y.level).reduction) * (1 + (Y.exposed ? R.EXPOSED_PCT : 0))));
      toDef += d; landed++;
      events.push({ k: 'hit', atk: att, def, idx, of, dmg: d, red: round3(red) });
    });
    if (parried > 0) {
      const par = ay.skill.parry;
      const c = (par.flat + Math.min(par.cap || 0, (par.pct || 0) * lastBase)) * (parried / hits.length);
      const d = Math.max(1, Math.round(c * M.combatPower(Y.level).attack * (1 + Math.min(R.OFF_CAP, Y.offExt)) * (1 - X.defP) * (1 - M.combatPower(X.level).reduction) * (1 + (X.exposed ? R.EXPOSED_PCT : 0))));
      toAtt += d;
      events.push({ k: 'counter', side: def, target: att, dmg: d });
    }
    return { toDef, toAtt, evaded, dodged, landed };
  }
}

const pickInfo = a => ({ skill: a.id, phase: a.phase, auto: a.auto, invalid: a.invalid, mana: a.cost });

module.exports = { Duel, chance, newFighter, publicState, RULES: R, SIDES, other };
