'use strict';
/*
 * Phát danh hiệu (KH §6.3, T-041): giữ ảnh chụp người giữ danh hiệu trong RAM, so với lần trước để ghi sổ "Các đời"
 * (`db.records.log`), báo ticker khi đổi chủ và báo người chơi nào đổi bộ danh hiệu.
 * THUẦN theo nghĩa không đụng socket, timer, I/O: thời gian, id, cách phát tin đều được tiêm vào (xem `createTitles`).
 * Kết quả `holders` có uid nên CHỈ nằm trong máy chủ; những gì đi ra ngoài (`snapshot`, ticker, `codesOf`) không có uid.
 */
const R = require('./records');

const LOG_MAX = 300;                    // sổ "Các đời" giữ tối đa 300 dòng
const TICKER_GAP_MS = 5 * 60e3;         // ticker đổi chủ: tối đa 1 dòng / 5 phút / hạng mục
const SEASON_CODES = ['merit.season', 'pk.season'];   // hai danh hiệu "hiện tại" tính theo mùa (hết mùa thì ghi sổ rồi tính lại)

/**
 * deps:
 *  - db: object db (cần db.records.log; thiếu thì tự tạo)
 *  - now(): ms · newId(): id nguyên cho dòng sổ
 *  - isAccount(uid): chỉ uid này mới giữ danh hiệu công đức (xem records.holders)
 *  - enabled: false thì không tính, không phát gì, `codesOf` luôn rỗng
 *  - thresholds / env: ghi đè ngưỡng (records.thresholds)
 *  - tickerGapMs: khoảng cách tối thiểu giữa hai ticker cùng hạng mục
 *  - emit: { ticker(text), titles(snapshot), ptt(uid, codes) } — đều là tùy chọn
 *  - save(): báo đã sửa db.records.log
 */
function createTitles(deps) {
  const { db, now, newId } = deps;
  const enabled = deps.enabled !== false;
  const gap = Number.isFinite(deps.tickerGapMs) ? deps.tickerGapMs : TICKER_GAP_MS;
  const emit = deps.emit || {};
  let prev = null;                      // ảnh chụp holders lần trước (có uid); null = chưa tính lần nào
  let prevKey = '';                     // khóa mùa lúc tính lần trước
  let byUid = new Map();                // uid -> mã danh hiệu đang giữ
  let snap = {};                        // { mã: { name, v } } gửi cho client
  let snapJson = '{}';
  const lastTicker = Object.create(null);

  const logOf = () => {
    if (!db.records || typeof db.records !== 'object') db.records = { log: [] };
    if (!Array.isArray(db.records.log)) db.records.log = [];
    return db.records.log;
  };
  function pushLog(rec) {
    const log = logOf();
    log.push({ id: newId(), ...rec });
    if (log.length > LOG_MAX) log.splice(0, log.length - LOG_MAX);
  }

  function snapshotOf(h) {
    const out = {};
    for (const code of R.CODES) if (h[code]) out[code] = { name: h[code].name || '', v: h[code].v };
    return out;
  }

  /**
   * Tính lại. Lần đầu (sau khi khởi động) chỉ ghi nhận, KHÔNG ghi sổ và KHÔNG phát ticker hàng loạt.
   * Trả { changes } (kết quả diff) để test; không bao giờ ném lỗi nghiệp vụ.
   */
  function recompute() {
    if (!enabled) return { changes: [] };
    const t = deps.now();
    const key = R.seasonKey(t);
    const next = R.holders(db, t, { isAccount: deps.isAccount, thresholds: deps.thresholds, env: deps.env });
    const first = prev === null;
    const changes = first ? [] : R.diff(prev, next);
    let dirty = false;

    if (!first) {
      // Hết mùa: người giữ "hiện tại" của mùa cũ (ảnh chụp lần trước, vẫn thuộc mùa cũ) vào sổ trước khi tính lại.
      if (key !== prevKey) {
        const log = logOf();
        for (const code of SEASON_CODES) {
          const h = prev[code];
          if (!h) continue;
          const cat = R.TITLES[code].cat;
          if (log.some(x => x.kind === 'season' && x.season === prevKey && x.cat === cat)) continue;   // không ghi trùng
          pushLog({ at: t, cat, kind: 'season', name: h.name || '', v: h.v, season: prevKey });
          dirty = true;
        }
      }
      for (const c of changes) {
        if (!c.to) continue;            // mất danh hiệu (hết mùa, mất điều kiện): không có "đời" mới để ghi
        const meta = R.TITLES[c.code];
        pushLog({ at: t, cat: meta.cat, kind: meta.kind === 'history' ? 'history' : 'season', name: c.to.name || '', v: c.to.v });
        dirty = true;
        if (typeof emit.ticker === 'function' && !(lastTicker[meta.cat] > t - gap)) {
          lastTicker[meta.cat] = t;
          emit.ticker(`${c.to.name || 'Một thí chủ'} vừa trở thành ${meta.name}.`);
        }
      }
    }

    const nextBy = new Map();
    for (const [uid, codes] of R.titlesByUid(next)) nextBy.set(uid, codes);
    const oldBy = byUid;
    prev = next; prevKey = key; byUid = nextBy;
    snap = snapshotOf(next);
    const json = JSON.stringify(snap);
    const snapChanged = json !== snapJson;
    snapJson = json;
    if (dirty && typeof deps.save === 'function') deps.save();

    if (!first) {
      if (snapChanged && typeof emit.titles === 'function') emit.titles(snap);
      if (typeof emit.ptt === 'function') {
        for (const uid of new Set([...oldBy.keys(), ...nextBy.keys()])) {
          const a = (oldBy.get(uid) || []).join(','), b = (nextBy.get(uid) || []).join(',');
          if (a !== b) emit.ptt(uid, nextBy.get(uid) ? nextBy.get(uid).slice() : []);
        }
      }
    }
    return { changes };
  }

  /** Mã danh hiệu đang giữ của một uid (đã qua accountOf ở nơi gọi); rỗng nếu tắt hoặc không giữ gì. */
  function codesOf(uid) {
    if (!enabled) return [];
    const c = byUid.get(uid);
    return c ? c.slice() : [];
  }
  /** Ảnh chụp `{ mã: { name, v } }` chỉ có tên, không uid. */
  function snapshot() { return enabled ? JSON.parse(snapJson) : {}; }

  return { recompute, codesOf, snapshot, get enabled() { return enabled; } };
}

module.exports = { createTitles, LOG_MAX, TICKER_GAP_MS };
