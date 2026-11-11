'use strict';
/*
 * Dịch vụ tu luyện nội công, học chiêu, bộ chiêu, hoàn thành ngay. THUẦN: đồng bộ, không socket, không timer.
 * Dữ liệu nằm trong db.martial (xem docs/VO-HOC-GIAO-THUC.md mục 5); mọi hàm trả object thường,
 * lỗi nghiệp vụ trả { ok:false, reason, code } chứ không ném lỗi.
 *
 * Sổ cộng (ledger['session:<id>']) là nguồn sự thật chống cộng trùng: phần thưởng một phiên chỉ cộng đúng một lần,
 * dù phiên xong theo giờ, hoàn thành ngay hay dùng phiếu, dù hàm được gọi lại bao nhiêu lần.
 *
 * Các hàm có thể làm phiên xong (start, cancel, speedup, useVoucher, learn) trả thêm `updates` (mảng gói tu:update
 * cho chính người đó) khi có phiên vừa hoàn thành hoặc hủy; server đẩy cho các tab. onDonationConfirmed/onDonationClosed
 * trả { updates: [{ uid, update }] } vì có thể báo cho người khác với người gọi.
 */
const M = require('../../public/js/martial');
const secrets = require('./secrets');
const { seasonKey } = require('../records');

const BAD_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const VIAS = ['time', 'speedup', 'voucher'];
const DAY_MS = 86400e3;
const KEEP_DONE_MS = 60 * DAY_MS, KEEP_DONE_MAX = 50, RECENT_MAX = 8, SEEN_MAX = 50;
const OPEN_SPEEDUP_MAX = 10;   // yêu cầu hoàn thành ngay chưa được xác nhận của một người trong 24 giờ

const hasOwn = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const fail = (code, reason) => ({ ok: false, reason, code });
const zeroTam = () => ({ cuong: 0, toc: 0, nhu: 0 });
const cloneReward = r => ({ congLuc: r.congLuc, tam: { cuong: r.tam.cuong, toc: r.tam.toc, nhu: r.tam.nhu } });
const fmtVnd = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + 'đ';
const validUid = uid => typeof uid === 'string' && uid.length > 0 && uid.length <= 200 && !BAD_KEYS.has(uid);
const sameId = (a, b) => a != null && b != null && String(a) === String(b);
const ownMethod = id => (typeof id === 'string' && hasOwn(M.METHODS, id) ? M.METHODS[id] : null);
const ownSkill = id => (typeof id === 'string' && hasOwn(M.SKILLS, id) ? M.SKILLS[id] : null);
const isCleanReward = r => r && Number.isFinite(r.congLuc) && r.tam;

function durLabel(m, key) {
  const d = m && m.durations.find(x => x.key === key);
  if (!d) return String(key);
  const h = Math.floor(d.minutes / 60), mi = d.minutes % 60;
  return h === 0 ? `${mi} phút` : mi === 0 ? `${h} giờ` : `${h} giờ ${mi} phút`;
}

function tamText(tam) {
  const bs = M.BRANCH_ORDER.filter(b => tam[b] > 0);
  if (!bs.length) return '';
  if (bs.length === 3 && bs.every(b => tam[b] === tam[bs[0]])) return `tâm đắc mỗi nhánh +${tam[bs[0]]}`;
  return 'tâm đắc ' + bs.map(b => `${M.BRANCHES[b].name} +${tam[b]}`).join(', ');
}

/**
 * @param {{db:object, store:{save:Function,nextId:Function}, now:()=>number,
 *          config?:{timeScale?:number,speedupEnabled?:boolean,speedupPerDay?:number},
 *          createSpeedupDonation:(fields:object)=>object, vnDay:(ms:number)=>string}} deps
 */
function createMartialService(deps) {
  const { db, store } = deps;
  const now = () => deps.now();
  const cfg = () => deps.config || {};
  const donations = () => db.donations || [];

  const mt = db.martial || (db.martial = {});
  for (const k of ['profiles', 'sessions', 'ledger']) if (!mt[k] || typeof mt[k] !== 'object' || Array.isArray(mt[k])) mt[k] = {};
  for (const k of ['matches', 'audit']) if (!Array.isArray(mt[k])) mt[k] = [];

  const timeScale = () => { const t = Number(cfg().timeScale); return Number.isFinite(t) && t > 0 ? t : 1; };
  const perDay = () => null; // không giới hạn số lượt đã hoàn thành

  /* ---------- hồ sơ ---------- */
  function freshProfile(uid) {
    return {
      uid, congLuc: 0, tam: zeroTam(), learned: M.STARTERS.slice(), mastery: {}, loadout: [], activeSession: null, activeMatch: null,
      vouchers: [], wins: 0, losses: 0, draws: 0, dnd: false, blocked: [], createdAt: now()
    };
  }
  /** Bù các trường còn thiếu (hồ sơ do nơi khác tạo hoặc dữ liệu cũ). */
  function norm(p) {
    if (!Number.isFinite(p.congLuc)) p.congLuc = 0;
    if (!p.tam || typeof p.tam !== 'object') p.tam = zeroTam();
    for (const b of M.BRANCH_ORDER) if (!Number.isFinite(p.tam[b])) p.tam[b] = 0;
    if (!Array.isArray(p.learned)) p.learned = M.STARTERS.slice();
    p.mastery = M.masteryMap(p.mastery, p.learned);
    for (const k of ['loadout', 'vouchers', 'blocked']) if (!Array.isArray(p[k])) p[k] = [];
    for (const k of ['wins', 'losses', 'draws']) if (!Number.isFinite(p[k])) p[k] = 0;
    if (p.activeSession === undefined) p.activeSession = null;
    if (p.activeMatch === undefined) p.activeMatch = null;
    if (typeof p.name !== 'string') p.name = '';
    if (!Number.isFinite(p.pkAt)) p.pkAt = null;
    if (!Number.isFinite(p.ptsAt)) p.ptsAt = null; // mốc lần cuối điểm chiến tích tăng (phân hòa pk.history)
    // điểm mùa PK: reset lười khi sang mùa (tháng âm lịch)
    const key = seasonKey(now());
    const s = p.season;
    if (!s || typeof s !== 'object' || s.key !== key) p.season = { key, pts: 0, n: 0, at: null };
    else {
      if (!Number.isFinite(s.pts)) s.pts = 0;
      if (!Number.isFinite(s.n)) s.n = 0;
      if (!Number.isFinite(s.at)) s.at = null;
    }
    return p;
  }
  function profile(uid, create = false) {
    if (!validUid(uid)) return null;
    let p = hasOwn(mt.profiles, uid) && mt.profiles[uid] && typeof mt.profiles[uid] === 'object' ? mt.profiles[uid] : null;
    if (!p && create) { p = mt.profiles[uid] = freshProfile(uid); store.save(); }
    return p ? norm(p) : null;
  }

  /* ---------- phiên ---------- */
  function sessionKey(id) {
    if (typeof id === 'number' && Number.isFinite(id)) return String(id);
    if (typeof id === 'string' && id.length > 0 && id.length <= 40 && !BAD_KEYS.has(id)) return id;
    return null;
  }
  function getSession(id) {
    const k = sessionKey(id);
    const s = k && hasOwn(mt.sessions, k) ? mt.sessions[k] : null;
    return s && typeof s === 'object' ? s : null;
  }
  const userSessions = uid => Object.values(mt.sessions).filter(s => s && s.uid === uid);
  function activeSessionOf(uid, p) {
    const list = userSessions(uid).filter(s => s.status === 'active');
    return list.find(s => p && sameId(p.activeSession, s.id)) || list.sort((a, b) => b.startedAt - a.startedAt)[0] || null;
  }

  function pendingDonation(s) {
    if (!s || typeof s.speedupCode !== 'string') return null;
    return donations().find(d => d && d.code === s.speedupCode && d.purpose === 'speedup' && d.status === 'pending') || null;
  }
  function sessionView(s) {
    const d = pendingDonation(s);
    return {
      id: s.id, methodId: s.methodId, durationKey: s.durationKey, startedAt: s.startedAt, endsAt: s.endsAt, price: s.price, status: 'active',
      ...(s.skillId ? { skillId: s.skillId } : {}),
      speedup: d ? { code: d.code, amount: d.amount, status: 'pending', bankReported: !!d.bank, createdAt: d.createdAt, ...(d.mode === 'test' ? { test: true, confirmAt: d.confirmAt || null } : {}) } : null
    };
  }
  function recentOf(uid) {
    return userSessions(uid).filter(s => s.status === 'completed' || s.status === 'cancelled')
      .sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0) || Number(b.id) - Number(a.id))
      .slice(0, RECENT_MAX)
      .map(s => ({
        id: s.id, methodId: s.methodId, durationKey: s.durationKey, status: s.status, via: s.via || null, completedAt: s.completedAt || null,
        reward: isCleanReward(s.reward) ? cloneReward(s.reward) : { congLuc: 0, tam: zeroTam() }, seen: !!s.seen,
        ...(s.practice ? { practice: { ...s.practice } } : {})
      }));
  }

  /** Hình dạng "profile" của martial:state. Chưa có hồ sơ thì trả bản mặc định, không ghi gì. */
  function view(uid) {
    if (!validUid(uid)) return null;
    const p = profile(uid) || freshProfile(uid), li = M.levelInfo(p.congLuc);
    return {
      congLuc: p.congLuc, level: li.level, levelFrom: li.from, levelTo: li.to, pct: li.pct, manaMax: li.manaMax,
      tam: { cuong: p.tam.cuong, toc: p.tam.toc, nhu: p.tam.nhu },
      learned: p.learned.slice(), mastery: { ...p.mastery }, loadout: p.loadout.slice(), wins: p.wins, losses: p.losses, draws: p.draws,
      vouchers: p.vouchers.filter(v => v && !v.usedAt).map(v => ({ id: v.id, value: v.value, createdAt: v.createdAt }))
    };
  }

  function usedToday(uid) {
    const day = deps.vnDay(now());
    return donations().filter(d => d && d.purpose === 'speedup' && d.status === 'confirmed' && d.uid === uid
      && deps.vnDay(d.confirmedAt || d.createdAt || 0) === day).length;
  }

  /** Yêu cầu hoàn thành ngay chưa xác nhận (đang chờ, đã hủy, bị từ chối, hết hạn) tạo trong 24 giờ qua: chặn người tạo mã hàng loạt. */
  function openSpeedups(uid) {
    const t = now();
    return donations().filter(d => d && d.purpose === 'speedup' && d.uid === uid && d.status !== 'confirmed' && t - (d.createdAt || 0) < DAY_MS).length;
  }

  /* ---------- hoàn thành ---------- */
  /**
   * Hoàn thành một phiên đang chạy. IDEMPOTENT: phiên không còn 'active' thì trả null.
   * Trả gói cập nhật tu:update (kind 'completed') hoặc null.
   */
  function complete(sessionId, via, simulated = false) {
    const s = getSession(sessionId);
    if (!s || s.status !== 'active') return null;
    const p = profile(s.uid, true);
    if (!p) return null;
    via = VIAS.includes(via) ? via : 'time';
    const t = now(), key = 'session:' + s.id, method = ownMethod(s.methodId);
    const before = M.levelOf(p.congLuc);
    let reward, levelUp = false, practice = null;
    if (hasOwn(mt.ledger, key)) {
      // Dữ liệu hỏng: sổ cộng đã có mà phiên vẫn 'active'. Chỉ sửa trạng thái, không cộng lại.
      const l = mt.ledger[key] || {};
      reward = { congLuc: Number.isFinite(l.congLuc) ? l.congLuc : 0, tam: { ...zeroTam(), ...(l.tam || {}) } };
      practice = l.practice || null;
    } else {
      const raw = method ? M.rewardOf(s.methodId, s.durationKey) : null;
      reward = M.clampReward(p, raw || { congLuc: 0, tam: zeroTam() });
      p.congLuc += reward.congLuc;
      for (const b of M.BRANCH_ORDER) p.tam[b] += reward.tam[b];
      if (ownSkill(s.skillId) && p.learned.includes(s.skillId)) {
        const beforeXP = M.masteryXP(p.mastery[s.skillId]);
        const total = M.masteryXP(beforeXP + M.practiceXP(s.methodId, s.durationKey));
        p.mastery[s.skillId] = total;
        practice = { skillId: s.skillId, xp: total - beforeXP, total, rank: M.masteryInfo(total).rank };
      }
      mt.ledger[key] = { uid: s.uid, at: t, congLuc: reward.congLuc, tam: { ...reward.tam }, ...(practice ? { practice: { ...practice } } : {}) };
      levelUp = M.levelOf(p.congLuc) > before;
    }
    s.status = 'completed'; s.via = via; s.completedAt = t; s.reward = cloneReward(reward); s.seen = false;
    if (practice) s.practice = { ...practice };
    if (sameId(p.activeSession, s.id)) p.activeSession = null;
    store.save();

    const level = M.levelOf(p.congLuc), parts = [];
    if (reward.congLuc > 0) parts.push(`công lực +${reward.congLuc}`);
    const tt = tamText(reward.tam);
    if (tt) parts.push(tt);
    if (practice && practice.xp > 0) parts.push(`${M.SKILLS[practice.skillId].name} +${practice.xp} thuần thục (${M.masteryInfo(practice.total).name})`);
    const lead = via === 'speedup' ? 'Cúng dường đã được ghi nhận. ' : via === 'voucher' ? 'Đã dùng phiếu hoàn thành ngay. ' : '';
    let text = `${lead}Phiên tu ${method ? method.name : 'nội công'} (${durLabel(method, s.durationKey)}) đã viên mãn`
      + (parts.length ? ': ' + parts.join(', ') + '.' : ', công lực và tâm đắc đã ở mức tối đa nên không cộng thêm.');
    if (levelUp) text += ` Nội công lên cấp ${level}!`;
    return {
      kind: 'completed', sessionId: s.id, methodId: s.methodId, durationKey: s.durationKey, via,
      reward: cloneReward(reward), levelUp, level, text, ...(practice ? { practice: { ...practice } } : {})
    };
  }

  /** Hoàn thành mọi phiên của uid đã tới giờ. Trả mảng gói cập nhật. */
  function completeDue(uid) {
    const out = [];
    if (!validUid(uid)) return out;
    const t = now();
    for (const s of userSessions(uid)) {
      if (s.status !== 'active' || !(s.endsAt <= t)) continue;
      const u = complete(s.id, 'time');
      if (u) out.push(u);
    }
    return out;
  }

  /** Mọi phiên đã tới giờ, của mọi người. Server gọi mỗi 15 giây rồi đẩy tu:update. */
  function sweep() {
    const t = now(), out = [];
    for (const s of Object.values(mt.sessions)) {
      if (!s || s.status !== 'active' || !(s.endsAt <= t)) continue;
      const u = complete(s.id, 'time');
      if (u) out.push({ uid: s.uid, update: u });
    }
    return out;
  }

  const withUpdates = (res, ups) => (ups.length ? Object.assign(res, { updates: ups }) : res);
  const badUid = () => fail('uid', 'Không nhận ra tài khoản.');

  /* ---------- trạng thái ---------- */
  function state(uid) {
    if (!validUid(uid)) return badUid();
    completeDue(uid);
    const p = profile(uid), act = activeSessionOf(uid, p);
    return {
      ok: true, enabled: true, serverTime: now(), profile: view(uid),
      session: act ? sessionView(act) : null, recent: recentOf(uid),
      speedup: { enabled: !!cfg().speedupEnabled, perDay: perDay(), usedToday: usedToday(uid) }
    };
  }

  /* ---------- tu luyện ---------- */
  function start(uid, methodId, durationKey, skillId = null) {
    if (!validUid(uid)) return badUid();
    const m = ownMethod(methodId);
    if (!m) return fail('method', 'Không có công pháp này.');
    const dur = typeof durationKey === 'string' ? m.durations.find(d => d.key === durationKey) : null;
    if (!dur) return fail('duration', 'Thời gian tu không hợp lệ.');
    const ups = completeDue(uid);
    const p = profile(uid, true);
    if (activeSessionOf(uid, p)) return withUpdates(fail('busy', 'Bạn đang có một phiên tu chưa xong. Hoàn thành hoặc hủy phiên đó trước nhé.'), ups);
    const can = M.canCultivate(p, methodId);
    if (!can.ok) return withUpdates(fail('level', can.reason), ups);
    if (skillId != null && (!ownSkill(skillId) || !p.learned.includes(skillId))) return withUpdates(fail('skill', 'Chỉ luyện được chiêu đã lĩnh hội.'), ups);
    if (skillId && M.masteryInfo(p.mastery[skillId]).to == null) return withUpdates(fail('max', 'Chiêu này đã đạt Đại viên mãn.'), ups);
    const t = now();
    let id = store.nextId();
    // id trùng phiên hoặc sổ cộng cũ (dữ liệu khôi phục lệch bộ đếm) thì phiên mới sẽ mất thưởng: lấy id khác
    for (let i = 0; i < 20 && (hasOwn(mt.sessions, String(id)) || hasOwn(mt.ledger, 'session:' + id)); i++) id = store.nextId();
    if (hasOwn(mt.sessions, String(id)) || hasOwn(mt.ledger, 'session:' + id)) return withUpdates(fail('busy', 'Chưa bắt đầu được phiên tu. Bạn thử lại sau nhé.'), ups);
    const s = {
      id, uid, methodId, durationKey, startedAt: t, endsAt: t + Math.round(dur.minutes * 60000 * timeScale()), price: m.price,
      status: 'active', via: null, completedAt: null, reward: null, seen: false,
      ...(skillId ? { skillId } : {})
    };
    mt.sessions[String(id)] = s;
    p.activeSession = id;
    store.save();
    return withUpdates({ ok: true, session: sessionView(s) }, ups);
  }

  function cancel(uid, sessionId) {
    if (!validUid(uid)) return badUid();
    const ups = completeDue(uid);
    const s = getSession(sessionId);
    if (!s || s.uid !== uid) return withUpdates(fail('nosession', 'Không thấy phiên tu này.'), ups);
    if (s.status === 'completed') return withUpdates(fail('done', 'Phiên tu này đã viên mãn rồi.'), ups);
    if (s.status !== 'active') return withUpdates(fail('done', 'Phiên tu này đã hủy rồi.'), ups);
    // Yêu cầu hoàn thành ngay đang chờ (nếu có) vẫn để pending: tiền tới sau sẽ thành phiếu.
    s.status = 'cancelled'; s.via = null; s.completedAt = now(); s.reward = { congLuc: 0, tam: zeroTam() }; s.seen = true;
    const p = profile(uid);
    if (p && sameId(p.activeSession, s.id)) p.activeSession = null;
    store.save();
    const m = ownMethod(s.methodId);
    ups.push({
      kind: 'cancelled', sessionId: s.id, methodId: s.methodId, durationKey: s.durationKey,
      text: `Đã hủy phiên tu ${m ? m.name : 'nội công'} (${durLabel(m, s.durationKey)}). Tiến độ phiên này không được tính.`
    });
    return { ok: true, updates: ups };
  }

  function markSeen(uid, ids) {
    if (!validUid(uid)) return badUid();
    if (!Array.isArray(ids)) return fail('invalid', 'Dữ liệu không hợp lệ.');
    let changed = false;
    for (const id of ids.slice(0, SEEN_MAX)) {
      const s = getSession(id);
      if (s && s.uid === uid && s.status !== 'active' && !s.seen) { s.seen = true; changed = true; }
    }
    if (changed) store.save();
    return { ok: true };
  }

  /* ---------- học chiêu, bộ chiêu ---------- */
  function learn(uid, skillId) {
    if (!validUid(uid)) return badUid();
    if (!ownSkill(skillId)) return fail('skill', 'Không có chiêu này.');
    const ups = completeDue(uid);
    const p = profile(uid, true), can = M.canLearn(p, skillId);
    if (!can.ok) return withUpdates(fail(can.learned ? 'learned' : 'req', can.reason), ups);
    p.learned.push(skillId);
    store.save();
    return withUpdates({ ok: true, profile: view(uid) }, ups);
  }

  function setLoadout(uid, skills) {
    if (!validUid(uid)) return badUid();
    if (!Array.isArray(skills) || skills.length !== 4) return fail('loadout', 'Cần chọn đúng 4 chiêu.');
    if (!skills.every(ownSkill)) return fail('loadout', 'Có chiêu không tồn tại.');
    const p = profile(uid, true), v = M.validateLoadout(skills, p.learned);
    if (!v.ok) return fail('loadout', v.reason);
    p.loadout = skills.slice();
    store.save();
    return { ok: true, loadout: p.loadout.slice(), warnings: M.loadoutWarnings(p.loadout) };
  }

  /* ---------- hoàn thành ngay ---------- */
  function speedup(uid, sessionId, opts) {
    if (!validUid(uid)) return badUid();
    if (!cfg().speedupEnabled) return fail('disabled', 'Nhà chùa chưa mở hoàn thành ngay.');
    const ups = completeDue(uid);
    const s = getSession(sessionId);
    if (!s || s.uid !== uid) return withUpdates(fail('nosession', 'Không thấy phiên tu này.'), ups);
    if (s.status !== 'active') {
      return withUpdates(fail('done', s.status === 'completed' ? 'Phiên tu này đã viên mãn rồi, không cần hoàn thành ngay.' : 'Phiên tu này đã hủy rồi.'), ups);
    }
    const ex = pendingDonation(s);
    if (ex) return withUpdates({ ok: true, existing: true, donation: ex }, ups);
    if (openSpeedups(uid) >= OPEN_SPEEDUP_MAX) {
      return withUpdates(fail('limit', 'Bạn đã tạo khá nhiều yêu cầu hoàn thành ngay chưa được xác nhận. Hãy đợi Ban điều hành xác nhận hoặc thử lại sau nhé.'), ups);
    }
    const o = opts && typeof opts === 'object' ? opts : {};
    const name = typeof o.name === 'string' ? o.name.trim().slice(0, 60) : '';
    const m = ownMethod(s.methodId);
    const amount = Number.isFinite(s.price) && s.price > 0 ? s.price : m && m.price;
    if (!amount) return withUpdates(fail('donation', 'Chưa tạo được mã cúng dường. Bạn thử lại sau nhé.'), ups);
    let d;
    try {
      d = deps.createSpeedupDonation({
        uid, name, amount, anon: !!o.anon, sessionId: s.id, methodId: s.methodId, durationKey: s.durationKey
      });
    } catch (e) {
      return withUpdates(fail('donation', 'Chưa tạo được mã cúng dường. Bạn thử lại sau nhé.'), ups);
    }
    if (!d || typeof d.code !== 'string') return withUpdates(fail('donation', 'Chưa tạo được mã cúng dường. Bạn thử lại sau nhé.'), ups);
    d.purpose = 'speedup';
    if (d.uid == null) d.uid = uid;
    if (d.sessionId == null) d.sessionId = s.id;
    if (!d.methodId) d.methodId = s.methodId;
    if (!d.durationKey) d.durationKey = s.durationKey;
    if (d.price == null) d.price = amount;
    s.speedupCode = d.code;
    store.save();
    return withUpdates({ ok: true, existing: false, donation: d }, ups);
  }

  function cancelSpeedup(uid, code) {
    if (!validUid(uid)) return badUid();
    if (typeof code !== 'string' || !code || code.length > 40) return fail('invalid', 'Mã không hợp lệ.');
    const d = donations().find(x => x && x.code === code && x.purpose === 'speedup' && x.uid === uid);
    if (!d) return fail('nodonation', 'Không thấy yêu cầu này.');
    if (d.status !== 'pending') return fail('state', 'Yêu cầu này không còn chờ xác nhận.');
    if (d.bank) return fail('paid', 'Ngân hàng đã báo nhận tiền, đang chờ Ban điều hành xác nhận nên không hủy được.');
    d.status = 'cancelled'; d.outcome = null; d.userCancelled = true;
    const s = getSession(d.sessionId);
    if (s && s.uid === uid && s.speedupCode === code) delete s.speedupCode;
    store.save();
    return { ok: true };
  }

  /**
   * Cúng dường hoàn thành ngay đã được xác nhận (d.status đã là 'confirmed'). IDEMPOTENT theo d.outcome.
   * Phiên còn chạy: hoàn thành ngay. Phiên đã xong theo giờ, đã hủy hoặc không còn: không cộng lần hai, tặng phiếu.
   */
  function onDonationConfirmed(d) {
    if (!d || typeof d !== 'object' || d.purpose !== 'speedup') return null;
    // 'rejected' chưa từng cộng gì: nếu Ban điều hành xác nhận về sau thì vẫn xử lý.
    if (d.outcome && d.outcome !== 'rejected') return { outcome: d.outcome, updates: [] };
    const owner = validUid(d.uid) ? d.uid : null;
    const updates = owner ? completeDue(owner).map(update => ({ uid: owner, update })) : [];
    const s = getSession(d.sessionId);
    if (owner && s && s.status === 'active' && s.uid === owner) {
      const u = complete(s.id, 'speedup', d.mode === 'test');
      if (u) updates.push({ uid: owner, update: u });
      if (s.speedupCode === d.code) delete s.speedupCode;
      d.outcome = 'applied';
      store.save();
      return { outcome: 'applied', updates };
    }
    d.outcome = 'late';
    const p = owner && profile(owner, true);
    if (p) {
      let v = p.vouchers.find(x => x && x.code === d.code);
      if (!v) {
        v = { id: store.nextId(), value: d.paidAmount || d.amount, code: d.code, createdAt: now() };
        p.vouchers.push(v);
      }
      d.voucherId = v.id;
      const methodId = d.methodId || (s && s.methodId), m = ownMethod(methodId), durationKey = d.durationKey || (s && s.durationKey);
      const what = `phiên tu ${m ? m.name : 'nội công'} (${durLabel(m, durationKey)})`;
      const why = s && s.status === 'completed' ? `${what} đã viên mãn trước đó nên không cộng thưởng lần hai`
        : s && s.status === 'cancelled' ? `${what} đã được hủy trước đó nên không còn gì để hoàn thành`
          : `không còn ${what} để hoàn thành`;
      updates.push({
        uid: owner,
        update: {
          kind: 'speedup-late', sessionId: d.sessionId, methodId, durationKey, voucher: { id: v.id, value: v.value },
          text: `Nhà chùa đã nhận tịnh tài của bạn, nhưng ${why}. Bạn được một phiếu hoàn thành ngay trị giá ${fmtVnd(v.value)}, dùng cho một phiên tu sau.`
        }
      });
    }
    store.save();
    return { outcome: 'late', updates };
  }

  /** Yêu cầu hoàn thành ngay bị từ chối (status 'cancelled' do Ban điều hành) hoặc hết hạn ('expired'). IDEMPOTENT theo d.notified. */
  function onDonationClosed(d) {
    if (!d || typeof d !== 'object' || d.purpose !== 'speedup') return { updates: [] };
    if (d.notified || d.userCancelled || d.status === 'confirmed' || d.outcome === 'applied' || d.outcome === 'late') return { updates: [] };
    d.notified = true; d.outcome = 'rejected';
    const owner = validUid(d.uid) ? d.uid : null, s = getSession(d.sessionId);
    if (s && s.uid === owner && s.speedupCode === d.code) delete s.speedupCode;
    store.save();
    if (!owner) return { updates: [] };
    const methodId = d.methodId || (s && s.methodId), m = ownMethod(methodId), durationKey = d.durationKey || (s && s.durationKey);
    const what = `phiên tu ${m ? m.name : 'nội công'} (${durLabel(m, durationKey)})`;
    const text = d.status === 'expired'
      ? `Yêu cầu hoàn thành ngay ${what} đã hết hạn vì chưa nhận được tịnh tài. Nếu bạn đã chuyển khoản, xin liên hệ nhà chùa.`
      : `Yêu cầu hoàn thành ngay ${what} không được xác nhận. Nếu bạn đã chuyển khoản, xin liên hệ nhà chùa.`;
    return { updates: [{ uid: owner, update: { kind: 'speedup-rejected', sessionId: d.sessionId, methodId, durationKey, text } }] };
  }

  function useVoucher(uid, voucherId, sessionId) {
    if (!validUid(uid)) return badUid();
    if (typeof voucherId !== 'number' && typeof voucherId !== 'string') return fail('voucher', 'Không thấy phiếu này.');
    const ups = completeDue(uid);
    const p = profile(uid), v = p && p.vouchers.find(x => x && sameId(x.id, voucherId));
    if (!v) return withUpdates(fail('voucher', 'Không thấy phiếu này.'), ups);
    if (v.usedAt) return withUpdates(fail('used', 'Phiếu này đã dùng rồi.'), ups);
    const s = getSession(sessionId);
    if (!s || s.uid !== uid) return withUpdates(fail('nosession', 'Không thấy phiên tu này.'), ups);
    if (s.status !== 'active') return withUpdates(fail('done', 'Phiên tu này đã xong, không dùng phiếu được nữa.'), ups);
    if (!(v.value >= s.price)) return withUpdates(fail('value', `Phiếu này trị giá ${fmtVnd(v.value || 0)}, chưa đủ cho phiên tu cần ${fmtVnd(s.price)}.`), ups);
    v.usedAt = now(); v.usedFor = s.id;
    const u = complete(s.id, 'voucher');
    if (u) ups.push(u);
    store.save();
    return { ok: true, updates: ups };
  }

  /* ---------- luận võ ---------- */
  function recordResult(uid, result) {
    const key = result === 'win' ? 'wins' : result === 'loss' ? 'losses' : result === 'draw' ? 'draws' : null;
    const p = key && profile(uid, true);
    if (!p) return null;
    p[key]++;
    const t = now();
    p.season.n++;
    p.season.pts += result === 'win' ? 3 : result === 'draw' ? 1 : 0; // điểm chiến tích: 3 × thắng + hòa
    p.pkAt = t;
    if (result !== 'loss') p.ptsAt = t;
    if (result !== 'loss') p.season.at = t; // mốc lần cuối điểm tăng (để phân hòa: ai đạt trước)
    store.save();
    return { wins: p.wins, losses: p.losses, draws: p.draws };
  }

  /** Ghi tên gần nhất của người chơi vào hồ sơ (để Bảng Vàng hiện được khi họ vắng). Chỉ hồ sơ đã có; trả true nếu đã ghi. */
  function setName(uid, name) {
    const p = profile(uid, false);
    const n = typeof name === 'string' ? name.trim().slice(0, 60) : '';
    if (!p || !n) return false;
    if (p.name !== n) { p.name = n; store.save(); }
    return true;
  }

  /** Danh tính để vào trận. Tự tạo hồ sơ mặc định nếu chưa có; uid sai thì null. */
  function pkIdentity(uid) {
    const p = profile(uid, true);
    if (!p) return null;
    return {
      level: M.levelOf(p.congLuc), learned: p.learned.slice(), mastery: { ...p.mastery }, loadout: p.loadout.slice(),
      wins: p.wins, losses: p.losses, draws: p.draws, activeMatch: p.activeMatch || null,
      secretSkills: Array.isArray(p.secretSkills) ? p.secretSkills.slice() : []
    };
  }

  function claimSecret(uid, role) {
    if (!validUid(uid)) return badUid();
    const updates = completeDue(uid);
    const p = profile(uid, true);
    if (p.activeMatch) return withUpdates(fail('match', 'Hãy kết thúc trận đấu trước.'), updates);
    const result = secrets.claim(p, role);
    if (!result.ok) return withUpdates(fail(result.code, 'Cơ duyên chưa tới, hãy tiếp tục tu luyện.'), updates);
    if (!result.already) store.save();
    return withUpdates(result, updates);
  }

  /** Truyền thừa một lần cho mỗi người trong mỗi lần Tảo Địa Tăng xuất hiện. */
  function inheritSweeper(uid, encounterId) {
    if (!validUid(uid) || typeof encounterId !== 'string' || !/^[a-f0-9]{24}$/.test(encounterId)) return fail('invalid', 'Không tìm thấy cơ duyên này.');
    const p = profile(uid, true), updates = completeDue(uid);
    const key = `sweeper:${encounterId}:${uid}`;
    if (hasOwn(mt.ledger, key)) return { ok: true, already: true, gain: mt.ledger[key].congLuc, level: M.levelOf(p.congLuc), congLuc: p.congLuc, updates };
    if (p.activeMatch) return { ...fail('match', 'Hãy kết thúc trận đấu trước khi nhận truyền thừa.'), updates };
    const info = M.levelInfo(p.congLuc);
    if (info.to == null) return { ...fail('max', 'Công lực đã đạt cảnh giới tối đa.'), updates };
    const gain = info.to - p.congLuc;
    p.congLuc = info.to;
    mt.ledger[key] = { uid, at: now(), congLuc: gain, tam: zeroTam(), kind: 'sweeper', encounterId };
    store.save();
    return { ok: true, gain, level: M.levelOf(p.congLuc), congLuc: p.congLuc, updates };
  }

  /** Dọn phiên đã xong quá 60 ngày, giữ tối đa 50 phiên đã xong mỗi người. Không đụng sổ cộng. Trả số phiên đã xóa. */
  function prune() {
    const t = now(), byUid = new Map();
    let removed = 0;
    for (const [k, s] of Object.entries(mt.sessions)) {
      if (!s || s.status === 'active') continue;
      const at = Number.isFinite(s.completedAt) ? s.completedAt : Number.isFinite(s.endsAt) ? s.endsAt : 0;
      if (t - at > KEEP_DONE_MS) { delete mt.sessions[k]; removed++; continue; }
      if (!byUid.has(s.uid)) byUid.set(s.uid, []);
      byUid.get(s.uid).push({ k, at });
    }
    for (const list of byUid.values()) {
      if (list.length <= KEEP_DONE_MAX) continue;
      list.sort((a, b) => b.at - a.at || Number(b.k) - Number(a.k));
      for (const x of list.slice(KEEP_DONE_MAX)) { delete mt.sessions[x.k]; removed++; }
    }
    if (removed) store.save();
    return removed;
  }

  return {
    profile, view, state, start, cancel, completeDue, sweep, complete, learn, setLoadout, markSeen,
    speedup, cancelSpeedup, onDonationConfirmed, onDonationClosed, useVoucher, recordResult, setName, pkIdentity, claimSecret, inheritSweeper, prune
  };
}

module.exports = { createMartialService };
