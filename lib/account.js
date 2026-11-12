'use strict';
/*
 * Bảo lưu theo tài khoản Google.
 *  - mergeMartialGuest: khi khách đăng nhập Google lần đầu, hồ sơ võ học (công lực, tâm đắc, chiêu đã học, bộ chiêu,
 *    phiên tu, phiếu, thắng thua) của "khách" trên trình duyệt đó được gộp vào tài khoản. Công đức và hào quang
 *    được gộp ở linkGuest trong server.js. Khách không đăng nhập thì dữ liệu chỉ nằm trên trình duyệt đó.
 *  - donatedBy: tổng tịnh tài đã cúng dường (đã xác nhận) của một tài khoản, gồm cả các lượt tạo lúc còn là khách.
 * THUẦN: chỉ đọc / sửa object db truyền vào, không timer, không socket.
 */
const M = require('../public/js/martial');

const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const BAD = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Gộp dữ liệu võ học của `guest` vào `uid`. Trả về hàm hoàn tác (khi ghi đăng nhập thất bại) hoặc null nếu khách không có gì.
 * Quy tắc: công lực và tâm đắc cộng dồn có trần; chiêu đã học hợp lại; bộ chiêu của tài khoản được giữ nếu đã có đủ 4 chiêu;
 * phiếu, thắng / thua / hòa, danh sách chặn cộng lại; phiên tu đang chạy của tài khoản được giữ, của khách bị hủy nếu trùng;
 * mọi phiên, sổ cộng và yêu cầu hoàn thành ngay đang chờ của khách chuyển sang tài khoản (để xác nhận sau này không lạc chủ).
 */
function mergeMartialGuest(db, guest, uid, now = Date.now()) {
  const mt = db && db.martial;
  if (!mt || typeof guest !== 'string' || typeof uid !== 'string' || guest === uid || BAD.has(guest) || BAD.has(uid)) return null;
  const gp = has(mt.profiles, guest) ? mt.profiles[guest] : null;
  const ap = has(mt.profiles, uid) ? mt.profiles[uid] : null;
  const sessions = Object.values(mt.sessions).filter(s => s && s.uid === guest);
  const ledger = Object.entries(mt.ledger).filter(([, l]) => l && l.uid === guest);
  const donations = (db.donations || []).filter(d => d && d.uid === guest && d.purpose === 'speedup');
  if (!gp && !sessions.length && !ledger.length && !donations.length) return null;

  const before = {
    gp: gp && structuredClone(gp), ap: ap && structuredClone(ap),
    sessions: sessions.map(s => [s, structuredClone(s)]),
    ledger: ledger.map(([k, l]) => [k, l.uid]),
    donations: donations.map(d => [d, d.uid])
  };

  if (gp) {
    let merged;
    if (!ap) merged = { ...gp, uid };
    else {
      merged = ap;
      merged.congLuc = Math.min(M.CONG_LUC_MAX, (+ap.congLuc || 0) + (+gp.congLuc || 0));
      merged.tam = merged.tam || { cuong: 0, toc: 0, nhu: 0 };
      for (const b of M.BRANCH_ORDER) merged.tam[b] = Math.min(M.TAM_MAX, (+ap.tam?.[b] || 0) + (+gp.tam?.[b] || 0));
      merged.learned = [...new Set([...(ap.learned || []), ...(gp.learned || [])])].filter(id => has(M.SKILLS, id));
      const am = M.masteryMap(ap.mastery, merged.learned), gm = M.masteryMap(gp.mastery, merged.learned);
      merged.mastery = Object.fromEntries(merged.learned.map(id => [id, M.masteryXP(am[id] + gm[id])]));
      if (!Array.isArray(merged.loadout) || merged.loadout.length !== 4) merged.loadout = Array.isArray(gp.loadout) ? gp.loadout.slice() : [];
      merged.vouchers = [...(ap.vouchers || []), ...(gp.vouchers || [])];
      for (const k of ['wins', 'losses', 'draws']) merged[k] = (+ap[k] || 0) + (+gp[k] || 0);
      // điểm mùa PK: cùng mùa thì cộng, khác mùa thì giữ mùa mới hơn (khóa dạng "2026-10" so chuỗi được); mốc `at` lấy muộn nhất (lần cuối điểm tăng)
      const as = ap.season, gs = gp.season;
      if (gs && typeof gs === 'object' && gs.key) {
        if (!as || typeof as !== 'object' || !as.key || as.key < gs.key) merged.season = { ...gs };
        else if (as.key === gs.key) {
          const at = [as.at, gs.at].filter(Number.isFinite);
          merged.season = { key: as.key, pts: (+as.pts || 0) + (+gs.pts || 0), n: (+as.n || 0) + (+gs.n || 0), at: at.length ? Math.max(...at) : null };
        }
      }
      const pkAt = [ap.pkAt, gp.pkAt].filter(Number.isFinite);
      merged.pkAt = pkAt.length ? Math.max(...pkAt) : null;
      const ptsAt = [ap.ptsAt, gp.ptsAt].filter(Number.isFinite);
      merged.ptsAt = ptsAt.length ? Math.max(...ptsAt) : null;
      if (!ap.name && gp.name) merged.name = gp.name;
      const seen = new Set((ap.blocked || []).map(b => b && b.uid));
      merged.blocked = [...(ap.blocked || []), ...(gp.blocked || []).filter(b => b && !seen.has(b.uid))];
      if (!ap.activeSession && gp.activeSession) merged.activeSession = gp.activeSession;
    }
    merged.activeMatch = null;
    // loadout phải gồm chiêu đã học
    if (merged.loadout && merged.loadout.some(id => !merged.learned.includes(id))) merged.loadout = [];
    mt.profiles[uid] = merged;
    delete mt.profiles[guest];
  }
  const keep = mt.profiles[uid] && mt.profiles[uid].activeSession;
  for (const s of sessions) {
    s.uid = uid;
    // tài khoản đã có phiên đang tu: phiên đang chạy của khách bị hủy (mỗi người một phiên tại một thời điểm)
    if (s.status === 'active' && keep != null && String(keep) !== String(s.id)) {
      s.status = 'cancelled'; s.completedAt = now; s.reward = { congLuc: 0, tam: { cuong: 0, toc: 0, nhu: 0 } }; s.seen = true;
    }
  }
  for (const [, l] of ledger) l.uid = uid;
  for (const d of donations) d.uid = uid;

  return function undo() {
    if (before.gp) mt.profiles[guest] = before.gp; else delete mt.profiles[guest];
    if (before.ap) mt.profiles[uid] = before.ap; else delete mt.profiles[uid];
    for (const [s, copy] of before.sessions) { for (const k of Object.keys(s)) delete s[k]; Object.assign(s, copy); }
    for (const [k, owner] of before.ledger) if (has(mt.ledger, k)) mt.ledger[k].uid = owner;
    for (const [d, owner] of before.donations) d.uid = owner;
  };
}

/**
 * Gộp Elo Kỳ Đạo của `guest` vào tài khoản `uid` (db.kydao.ratings). Mỗi môn lấy bản có nhiều ván xếp hạng (n) hơn,
 * bằng nhau thì giữ bản của tài khoản; không cộng Elo (tránh bơm điểm). Tên giữ của tài khoản nếu có.
 * Ván đang dở của khách chuyển sang tài khoản nếu tài khoản chưa có ván dở, ngược lại bị bỏ.
 * Trả về hàm hoàn tác hoặc null nếu khách không có gì. Gọi từ linkGuest ở server.js (T-030).
 */
function mergeKydaoGuest(db, guest, uid) {
  const kd = db && db.kydao;
  if (!kd || !kd.ratings || typeof guest !== 'string' || typeof uid !== 'string' || guest === uid || BAD.has(guest) || BAD.has(uid)) return null;
  const active = kd.active && typeof kd.active === 'object' ? kd.active : (kd.active = {});
  const gr = has(kd.ratings, guest) ? kd.ratings[guest] : null;
  const hasActive = has(active, guest);
  if (!gr && !hasActive) return null;

  const j = JSON.stringify;
  const guestSnap = gr && structuredClone(gr);
  const gAct = hasActive ? active[guest] : undefined;
  // mỗi thay đổi của phép gộp: { ok(): còn nguyên như lúc gộp?, revert() }; hoàn tác chỉ đụng chỗ chưa bị cập nhật sau đó
  const steps = [];
  let moveStep = null;

  if (gr) {
    const ar = has(kd.ratings, uid) ? kd.ratings[uid] : null;
    if (!ar) {
      const made = { ...gr };
      kd.ratings[uid] = made;
      const after = j(made);
      steps.push({ ok: () => has(kd.ratings, uid) && j(kd.ratings[uid]) === after, revert: () => { delete kd.ratings[uid]; } });
    } else {
      for (const k of Object.keys(gr)) {
        if (BAD.has(k) || k === 'name') continue;
        const g = gr[k];
        if (!g || typeof g !== 'object') continue;
        const had = has(ar, k), a = had ? ar[k] : null;
        if (!a || (+g.n || 0) > (+a.n || 0)) {
          const prev = had ? structuredClone(a) : undefined;
          ar[k] = structuredClone(g);
          const after = j(ar[k]);
          steps.push({
            ok: () => has(kd.ratings, uid) && has(kd.ratings[uid], k) && j(kd.ratings[uid][k]) === after,
            revert: () => { if (prev === undefined) delete kd.ratings[uid][k]; else kd.ratings[uid][k] = prev; }
          });
        }
      }
      if (!ar.name && gr.name) {
        ar.name = gr.name;
        const nm = gr.name;
        steps.push({ ok: () => has(kd.ratings, uid) && kd.ratings[uid].name === nm, revert: () => { delete kd.ratings[uid].name; } });
      }
    }
    delete kd.ratings[guest];
  }
  if (hasActive) {
    if (!has(active, uid)) {
      active[uid] = gAct;
      moveStep = { ok: () => has(active, uid) && active[uid] === gAct, revert: () => { delete active[uid]; } };
      steps.push(moveStep);
    }
    delete active[guest];
  }

  return function undo() {
    // trả hồ sơ của khách; chỗ nào đã đổi sau khi gộp (vd. tài khoản vừa chơi xong ván) thì giữ nguyên
    const intact = steps.map(s => s.ok());
    const movedIntact = moveStep ? intact[steps.indexOf(moveStep)] : null;
    steps.forEach((s, i) => { if (intact[i]) s.revert(); });
    if (guestSnap && !has(kd.ratings, guest)) kd.ratings[guest] = guestSnap;
    if (hasActive && !has(active, guest)) {
      // ván đã kết thúc (có trong kd.games) hoặc con trỏ đã chuyển sang tài khoản rồi bị dọn thì không dựng lại
      const done = Array.isArray(kd.games) && kd.games.some(g => g && String(g.id) === String(gAct));
      if (!done && (movedIntact === null || movedIntact)) active[guest] = gAct;
    }
  };
}

/** Tịnh tài đã xác nhận của một tài khoản: { count, total, lastAt }. accountOf đổi uid khách đã liên kết sang tài khoản. */
function donatedBy(db, uid, accountOf = x => x) {
  let count = 0, total = 0, lastAt = 0;
  for (const d of db.donations || []) {
    if (!d || d.status !== 'confirmed' || accountOf(d.uid) !== uid) continue;
    count++; total += Number(d.paidAmount > d.amount ? d.paidAmount : d.amount) || 0;
    lastAt = Math.max(lastAt, d.confirmedAt || d.createdAt || 0);
  }
  return { count, total, lastAt: lastAt || null };
}

module.exports = { mergeMartialGuest, mergeKydaoGuest, donatedBy };
