'use strict';
/*
 * Thống kê mùa và người giữ danh hiệu (KH §6.1 → §6.3, D5). THUẦN: chỉ đọc object db truyền vào,
 * không timer, không socket, không I/O; thời gian (`now`) được tiêm vào.
 *
 * Mã danh hiệu (14 mã):
 *   merit.history · merit.season · pk.history · pk.season
 *   <môn>.history · <môn>.now  với <môn> ∈ chess, xiangqi, jieqi, go, gomoku
 * ("hiện tại" của công đức, PK theo mùa → hậu tố `.season`; "hiện tại" của cờ theo Elo đang có → hậu tố `.now`).
 *
 * Mùa = tháng âm lịch giờ Việt Nam (UTC+7), khóa "<năm âm>-<tháng âm 2 chữ số>[n]", ví dụ "2026-10", "2025-06n" (nhuận).
 * Hòa giá trị → ai đạt trước (mốc `at` nhỏ hơn) giữ; vẫn hòa → uid nhỏ hơn (để kết quả ổn định).
 * Kết quả `holders` có chứa uid: CHỈ dùng trong máy chủ, không gửi nguyên cho client (AGENTS.md §3.4).
 */
const Lunar = require('../public/js/lunar');

const VN_OFFSET = 7 * 3600e3;
const DAY_MS = 86400e3;

/** Các môn cờ (khóa trong db.kydao.ratings[uid]) theo thứ tự ưu tiên hiển thị. */
const GAMES = ['xiangqi', 'chess', 'jieqi', 'go', 'gomoku'];

/** Tên hiển thị của danh hiệu (một bảng duy nhất, gửi xuống qua /api/config ở T-041). */
const CATEGORIES = {
  merit: { name: 'Công Đức', history: 'Vô Lượng Công Đức', current: 'Thiện Tâm Đương Mùa', currentKey: 'season' },
  pk: { name: 'Luận Võ', history: 'Võ Lâm Chí Tôn', current: 'Đương Kim Minh Chủ', currentKey: 'season' },
  xiangqi: { name: 'Cờ Tướng', history: 'Kỳ Thánh Cờ Tướng', current: 'Kỳ Vương Cờ Tướng', currentKey: 'now' },
  chess: { name: 'Cờ Vua', history: 'Kỳ Thánh Cờ Vua', current: 'Kỳ Vương Cờ Vua', currentKey: 'now' },
  jieqi: { name: 'Cờ Tướng Úp', history: 'Kỳ Thánh Cờ Tướng Úp', current: 'Kỳ Vương Cờ Tướng Úp', currentKey: 'now' },
  go: { name: 'Cờ Vây', history: 'Kỳ Thánh Cờ Vây', current: 'Kỳ Vương Cờ Vây', currentKey: 'now' },
  gomoku: { name: 'Cờ Caro', history: 'Kỳ Thánh Cờ Caro', current: 'Kỳ Vương Cờ Caro', currentKey: 'now' }
};
const CAT_ORDER = ['pk', 'xiangqi', 'chess', 'jieqi', 'go', 'gomoku', 'merit'];

const TITLES = {};
for (const cat of CAT_ORDER) {
  const c = CATEGORIES[cat];
  TITLES[`${cat}.history`] = { cat, kind: 'history', name: c.history };
  TITLES[`${cat}.${c.currentKey}`] = { cat, kind: 'current', name: c.current };
}

/** Thứ tự ưu tiên hiện trên đầu: lịch sử trước hiện tại; PK, Cờ tướng, Cờ vua, Cờ tướng úp, Cờ vây, Caro, Công đức. */
const priority = [
  ...CAT_ORDER.map(c => `${c}.history`),
  ...CAT_ORDER.map(c => `${c}.${CATEGORIES[c].currentKey}`)
];
const CODES = priority.slice();
const RANK = Object.fromEntries(priority.map((c, i) => [c, i]));

/* ---------- ngưỡng ---------- */
const DEFAULTS = {
  meritHistory: 1000, meritSeason: 100,
  pkHistoryGames: 10, pkSeasonGames: 3,
  kyGames: 20, activeDays: 30
};
const ENV = {
  meritHistory: 'TITLE_MIN_MERIT_TOTAL', meritSeason: 'TITLE_MIN_MERIT_SEASON',
  pkHistoryGames: 'TITLE_MIN_PK_GAMES', pkSeasonGames: 'TITLE_MIN_PK_SEASON_GAMES',
  kyGames: 'TITLE_MIN_GAMES', activeDays: 'TITLE_ACTIVE_DAYS'
};
/** Ngưỡng hiện hành: mặc định → biến môi trường → `override`. Giá trị sai (không phải số ≥ 0) bị bỏ qua. */
function thresholds(override, env = process.env) {
  const out = { ...DEFAULTS };
  for (const k of Object.keys(DEFAULTS)) {
    for (const src of [env && env[ENV[k]], override && override[k]]) {
      if (src === undefined || src === null || src === '') continue;
      const n = Number(src);
      if (Number.isFinite(n) && n >= 0) out[k] = n;
    }
  }
  return out;
}

/* ---------- mùa ---------- */
const pad2 = n => (n < 10 ? '0' : '') + n;
let memo = { day: NaN, key: '' };

/** Khóa mùa của thời điểm `now` (ms): tháng âm lịch tính theo ngày Việt Nam (UTC+7). */
function seasonKey(now = Date.now()) {
  const t = Number.isFinite(now) ? now : Date.now();
  const day = Math.floor((t + VN_OFFSET) / DAY_MS);
  if (memo.day === day) return memo.key;
  const d = new Date(day * DAY_MS);
  const [, lm, ly, leap] = Lunar.toLunar(d.getUTCDate(), d.getUTCMonth() + 1, d.getUTCFullYear());
  const key = `${ly}-${pad2(lm)}${leap ? 'n' : ''}`;
  memo = { day, key };
  return key;
}

/* ---------- người giữ ---------- */
const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const num = x => (Number.isFinite(x) ? x : 0);
const atOf = x => (Number.isFinite(x) ? x : Infinity);
const isObj = x => x && typeof x === 'object' && !Array.isArray(x);
const nameOf = x => (typeof x === 'string' ? x : '');

/** Chọn người tốt hơn: giá trị lớn hơn, hòa → `at` nhỏ hơn, hòa nữa → uid nhỏ hơn. */
function better(best, uid, v, at) {
  if (!best) return true;
  if (v !== best.v) return v > best.v;
  if (at !== best.at) return at < best.at;
  return uid < best.uid;
}
function offer(res, code, uid, name, v, at) {
  if (better(res[code], uid, v, at)) res[code] = { uid, name, v, at };
}

/**
 * Ai đang giữ 14 danh hiệu. Trả { [mã]: { uid, name, v, at } } — mã nào chưa ai đạt điều kiện thì KHÔNG có khóa.
 * opts.isAccount(uid): chỉ tài khoản (không phải khách) mới giữ danh hiệu công đức; mặc định coi mọi uid là hợp lệ.
 * opts.thresholds: ghi đè ngưỡng (xem DEFAULTS).
 */
function holders(db, now = Date.now(), opts = {}) {
  const th = thresholds(opts.thresholds, opts.env);
  const isAccount = typeof opts.isAccount === 'function' ? opts.isAccount : () => true;
  const key = seasonKey(now);
  const activeMs = th.activeDays * DAY_MS;
  const res = {};
  if (!isObj(db)) return res;

  if (isObj(db.merit)) {
    for (const uid of Object.keys(db.merit)) {
      const m = db.merit[uid];
      if (!isObj(m) || !isAccount(uid)) continue;
      const total = num(m.total);
      if (total >= th.meritHistory) offer(res, 'merit.history', uid, nameOf(m.name), total, atOf(m.at));
      const s = m.season;
      if (isObj(s) && s.key === key && num(s.v) >= th.meritSeason && num(s.v) > 0) offer(res, 'merit.season', uid, nameOf(m.name), s.v, atOf(s.at));
    }
  }

  const profiles = db.martial && isObj(db.martial.profiles) ? db.martial.profiles : null;
  if (profiles) {
    for (const uid of Object.keys(profiles)) {
      const p = profiles[uid];
      if (!isObj(p)) continue;
      const games = num(p.wins) + num(p.losses) + num(p.draws);
      const pts = 3 * num(p.wins) + num(p.draws);
      if (games >= th.pkHistoryGames && pts > 0) offer(res, 'pk.history', uid, nameOf(p.name), pts, atOf(p.ptsAt));
      const s = p.season;
      if (isObj(s) && s.key === key && num(s.n) >= th.pkSeasonGames && num(s.pts) > 0) offer(res, 'pk.season', uid, nameOf(p.name), s.pts, atOf(s.at));
    }
  }

  const ratings = db.kydao && isObj(db.kydao.ratings) ? db.kydao.ratings : null;
  if (ratings) {
    for (const uid of Object.keys(ratings)) {
      const r = ratings[uid];
      if (!isObj(r)) continue;
      for (const g of GAMES) {
        if (!own(r, g)) continue;
        const st = r[g];
        if (!isObj(st) || num(st.n) < th.kyGames) continue;
        if (Number.isFinite(st.peak)) offer(res, `${g}.history`, uid, nameOf(r.name), st.peak, atOf(st.peakAt));
        if (Number.isFinite(st.r) && Number.isFinite(st.last) && now - st.last <= activeMs) offer(res, `${g}.now`, uid, nameOf(r.name), st.r, st.last);
      }
    }
  }
  return res;
}

/** Danh sách mã danh hiệu của từng người: Map<uid, mã[]> theo thứ tự ưu tiên. */
function titlesByUid(h) {
  const out = new Map();
  for (const code of priority) {
    const x = h && h[code];
    if (!x) continue;
    if (!out.has(x.uid)) out.set(x.uid, []);
    out.get(x.uid).push(code);
  }
  return out;
}

/**
 * Nhãn hiển thị của một danh sách mã (đã sắp theo ưu tiên): { code, name, crown } hoặc null.
 * Giữ cả lịch sử lẫn hiện tại của cùng hạng mục → "Thiên Hạ Vô Song · <hạng mục>" (crown: true).
 */
function labelOf(codes) {
  if (!Array.isArray(codes) || !codes.length) return null;
  const sorted = codes.filter(c => own(RANK, c)).sort((a, b) => RANK[a] - RANK[b]);
  if (!sorted.length) return null;
  for (const code of sorted) {
    const t = TITLES[code];
    const other = `${t.cat}.${t.kind === 'history' ? CATEGORIES[t.cat].currentKey : 'history'}`;
    if (sorted.includes(other)) return { code, name: `Thiên Hạ Vô Song · ${CATEGORIES[t.cat].name}`, crown: true };
  }
  return { code: sorted[0], name: TITLES[sorted[0]].name, crown: false };
}

/**
 * Các thay đổi chủ danh hiệu giữa hai ảnh chụp `holders`: [{ code, from, to }] (from/to = người giữ hoặc null).
 * Cùng uid giữ nguyên thì không tính (đổi điểm số không phải đổi chủ).
 */
function diff(prev, next) {
  const a = isObj(prev) ? prev : {}, b = isObj(next) ? next : {};
  const out = [];
  for (const code of CODES) {
    const x = own(a, code) ? a[code] : null, y = own(b, code) ? b[code] : null;
    if ((x && x.uid) === (y && y.uid)) continue;
    out.push({ code, from: x || null, to: y || null });
  }
  return out;
}

module.exports = { TITLES, CATEGORIES, GAMES, CODES, priority, DEFAULTS, thresholds, seasonKey, holders, titlesByUid, labelOf, diff };
