'use strict';
/*
 * Các "phần" lưu của db, dùng chung cho nạp, so phần chênh, xuất và kiểm thử.
 * Thêm khóa mới ở mức cao nhất của db thì phải thêm một phần ở đây, nếu không PostgreSQL sẽ không lưu khóa đó.
 */

const VERSION = 2;
const COUNTERS = () => ({ incense: 0, lotus: 0, rose: 0, lamp: 0, fruit: 0, hearts: 0, mo: 0, bows: 0, bells: 0, chants: 0, visits: 0 });
const martialFresh = () => ({ profiles: {}, sessions: {}, ledger: {}, matches: [], audit: [] });
const kydaoFresh = () => ({ ratings: {}, games: [], active: {}, pairs: {} }); // ratings: uid -> { name, <môn>: {…} }; active: uid -> gameId; pairs: '<ngày>|<uidA>|<uidB>|<môn>' -> số ván xếp hạng
const recordsFresh = () => ({ log: [] });
// các khóa cấp cao là object lồng: tên -> hàm tạo mặc định (adopt và unknownKeys dùng chung)
const NESTED = { martial: martialFresh, kydao: kydaoFresh, records: recordsFresh };

function fresh() {
  return {
    version: VERSION,
    day: '',
    today: COUNTERS(),
    total: COUNTERS(),
    merit: {},        // uid -> { name, total, today, day }
    linkedGuests: {}, // uid khách -> tài khoản đã nhận điểm
    authSessions: {}, // mã băm của cookie -> { uid, until }
    prayers: [],      // lời nguyện công khai
    chat: [],         // tin nhắn gần đây
    incense: [],      // nhang đang cháy
    donations: [],    // lượt cúng dường tịnh tài
    auras: {},        // uid -> { amount, tier, until, name } hào quang cúng dường đang sáng
    martial: martialFresh(), // hồ sơ, phiên tu luyện, sổ cái, trận luận võ, nhật ký (xem docs/VO-HOC-GIAO-THUC.md mục 5)
    kydao: kydaoFresh(),     // Kỳ Đạo: Elo từng người, ván đã xong, ván đang dở (KH §6.2)
    records: recordsFresh(), // sổ "Các đời" của danh hiệu
    seq: 1
  };
}

const map = (name, label) => ({ name, kind: 'map', path: name.split('.'), label });
const list = (name, key, label) => ({ name, kind: 'array', path: name.split('.'), key, label });

const SECTIONS = [
  { name: 'meta', kind: 'meta', label: 'bộ đếm chung' },
  map('merit', 'người có công đức'),
  map('linkedGuests', 'khách đã liên kết tài khoản'),
  map('authSessions', 'phiên đăng nhập'),
  map('auras', 'hào quang'),
  map('martial.profiles', 'hồ sơ võ học'),
  map('martial.sessions', 'phiên tu luyện'),
  map('martial.ledger', 'dòng sổ cái võ học'),
  list('donations', 'code', 'lượt cúng dường'),
  list('prayers', 'id', 'lời nguyện'),
  list('chat', 'id', 'tin nhắn'),
  list('incense', 'id', 'nén nhang'),
  list('martial.matches', 'id', 'trận luận võ'),
  list('martial.audit', 'id', 'nhật ký võ học'),
  map('kydao.ratings', 'Elo Kỳ Đạo'),
  map('kydao.active', 'ván Kỳ Đạo đang dở'),
  map('kydao.pairs', 'bộ đếm xếp hạng theo cặp Kỳ Đạo'),
  list('kydao.games', 'id', 'ván Kỳ Đạo'),
  list('records.log', 'id', 'sổ các đời danh hiệu')
];
const BY_NAME = Object.fromEntries(SECTIONS.map(s => [s.name, s]));

const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
const sortKeys = v => (Array.isArray(v) ? v.map(sortKeys) : isObj(v) ? Object.fromEntries(Object.keys(v).sort().map(k => [k, sortKeys(v[k])])) : v);

function holder(root, s, create) {
  let o = root;
  for (let i = 0; i < s.path.length - 1; i++) {
    if (!isObj(o[s.path[i]])) { if (!create) return null; o[s.path[i]] = {}; }
    o = o[s.path[i]];
  }
  return o;
}
function valueOf(root, s) {
  const o = holder(root, s, false);
  return o ? o[s.path[s.path.length - 1]] : undefined;
}

/* ---- tuần tự hóa ---- */

// jsonb không nhận \u0000 và surrogate lẻ; một dòng hỏng sẽ làm cả lượt ghi thất bại mãi mãi.
const BAD = /\\u0000|\\u[dD][89a-fA-F][0-9a-fA-F]{2}/;
const LONE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;
const wellFormed = x => (x.toWellFormed ? x.toWellFormed() : x.replace(LONE, '\uFFFD'));
function ser(v) {
  let s = JSON.stringify(v);
  if (s !== undefined && BAD.test(s)) {
    s = JSON.stringify(v, (_, x) => (typeof x === 'string' ? wellFormed(x.replace(/\0/g, '')) : x));
  }
  return s;
}
const keyText = k => (k.includes('\0') ? k.replace(/\0/g, '') : k);

/** Các cặp [khóa, giá trị] của một phần. Mảng: khóa trùng hoặc thiếu được đánh dấu thêm để không mất phần tử. */
function* entries(db, s) {
  if (s.kind === 'meta') {
    // thứ tự khóa cố định: jsonb trả khóa theo thứ tự riêng, không để nó làm meta trông như đã đổi sau mỗi lần nạp
    yield ['meta', sortKeys({ version: db.version, day: db.day, today: db.today, total: db.total, seq: db.seq })];
    return;
  }
  const v = valueOf(db, s);
  if (s.kind === 'map') {
    if (isObj(v)) for (const k of Object.keys(v)) yield [keyText(k), v[k]];
  } else if (Array.isArray(v)) {
    const seen = new Set();
    for (let i = 0; i < v.length; i++) {
      const x = v[i];
      let k = x && x[s.key] != null ? keyText(String(x[s.key])) : '~' + i;
      if (seen.has(k)) k += '~' + i;
      seen.add(k);
      yield [k, x];
    }
  }
}

/** Map phần -> Map khóa -> chuỗi JSON của toàn bộ db. */
function snapshot(db) {
  const out = new Map();
  for (const s of SECTIONS) {
    const m = new Map();
    for (const [k, v] of entries(db, s)) {
      const str = ser(v);
      if (str !== undefined) m.set(k, str);
    }
    out.set(s.name, m);
  }
  return out;
}

/** Phần chênh giữa shadow (đã ghi) và snapshot hiện tại. */
function diff(shadow, cur) {
  const upserts = [], deletes = [];
  for (const [name, m] of cur) {
    const old = shadow.get(name);
    for (const [k, str] of m) if (!old || old.get(k) !== str) upserts.push([name, k, str]);
  }
  for (const [name, old] of shadow) {
    const m = cur.get(name);
    for (const k of old.keys()) if (!m || !m.has(k)) deletes.push([name, k]);
  }
  return { upserts, deletes };
}

/* ---- nạp ---- */

const num = x => (typeof x === 'number' && Number.isFinite(x) ? x : NaN);
function compareDocs(s) {
  if (s.name === 'donations') {
    return (a, b) => ((num(a.v && a.v.createdAt) || 0) - (num(b.v && b.v.createdAt) || 0)) || (a.k < b.k ? -1 : a.k > b.k ? 1 : 0);
  }
  return (a, b) => {
    const x = Number(a.v && a.v.id), y = Number(b.v && b.v.id);
    const fx = Number.isFinite(x), fy = Number.isFinite(y);
    if (fx && fy && x !== y) return x - y;
    if (fx !== fy) return fx ? -1 : 1;
    return a.k < b.k ? -1 : a.k > b.k ? 1 : 0;
  };
}

/** rows: Map phần -> [{ k, v }] (v đã parse) -> đối tượng dạng db (chưa bổ sung mặc định). */
function rowsToRaw(rows) {
  const raw = {};
  const meta = rows.get('meta');
  if (meta && meta.length) Object.assign(raw, meta[0].v);
  for (const s of SECTIONS) {
    if (s.kind === 'meta') continue;
    const r = rows.get(s.name) || [];
    const o = holder(raw, s, true), last = s.path[s.path.length - 1];
    if (s.kind === 'map') {
      const m = {};
      for (const { k, v } of r) m[k] = v;
      o[last] = m;
    } else {
      o[last] = r.slice().sort(compareDocs(s)).map(x => x.v);
    }
  }
  return raw;
}

/** Điền raw (JSON cũ hoặc từ CSDL) vào ĐÚNG đối tượng target, bổ sung mặc định. Định danh target không đổi. */
function adopt(target, raw) {
  raw = isObj(raw) ? raw : {};
  const f = fresh();
  for (const k of Object.keys(target)) delete target[k];
  Object.assign(target, f, raw);
  target.version = VERSION;
  target.today = Object.assign(COUNTERS(), isObj(raw.today) ? raw.today : null);
  target.total = Object.assign(COUNTERS(), isObj(raw.total) ? raw.total : null);
  if (typeof target.day !== 'string') target.day = '';
  for (const k of Object.keys(NESTED)) target[k] = Object.assign(NESTED[k](), isObj(raw[k]) ? raw[k] : null);
  for (const s of SECTIONS) {
    if (s.kind === 'meta') continue;
    const o = holder(target, s, true), last = s.path[s.path.length - 1];
    const ok = s.kind === 'map' ? isObj(o[last]) : Array.isArray(o[last]);
    if (!ok) o[last] = valueOf(f, s);
  }
  if (!(Number(target.seq) >= 1)) target.seq = 1;
  return target;
}

/** nextId không bao giờ lùi: seq luôn lớn hơn mọi id số đang có. */
function repairSeq(db) {
  let max = 0;
  for (const s of SECTIONS) {
    if (s.kind !== 'array' || s.key !== 'id') continue;
    for (const x of valueOf(db, s) || []) {
      const n = Number(x && x.id);
      if (Number.isFinite(n) && n > max) max = n;
    }
  }
  if (!(db.seq > max)) db.seq = Math.floor(max) + 1;
  return db;
}

/** Khóa của db mà không phần nào lưu (PostgreSQL sẽ bỏ sót chúng). */
function unknownKeys(db) {
  const known = new Set(['version', 'day', 'today', 'total', 'seq']);
  for (const s of SECTIONS) if (s.path) known.add(s.path[0]);
  const out = Object.keys(db).filter(k => !known.has(k));
  for (const name of Object.keys(NESTED)) {
    const sub = isObj(db[name]) ? db[name] : {};
    const sk = new Set(SECTIONS.filter(s => s.path && s.path[0] === name).map(s => s.path[1]));
    for (const k of Object.keys(sub)) if (!sk.has(k)) out.push(name + '.' + k);
  }
  return out;
}

/* ---- thống kê và so sánh ---- */

function counts(db) {
  const out = {};
  for (const s of SECTIONS) {
    if (s.kind === 'meta') continue;
    const v = valueOf(db, s);
    out[s.name] = Array.isArray(v) ? v.length : isObj(v) ? Object.keys(v).length : 0;
  }
  return out;
}

/** Các con số dùng để đối chiếu sau khi chuyển dữ liệu. */
function totals(db) {
  let merit = 0, donated = 0;
  for (const m of Object.values(db.merit || {})) merit += Number(m && m.total) || 0;
  for (const d of db.donations || []) if (d && d.status === 'confirmed') donated += Number(d.amount) || 0;
  return { merit, donated, sessions: Object.keys(db.authSessions || {}).length };
}

const canon = v => JSON.stringify(v, (_, x) => (isObj(x) ? Object.fromEntries(Object.keys(x).sort().map(k => [k, x[k]])) : x));

module.exports = { VERSION, COUNTERS, fresh, SECTIONS, BY_NAME, entries, ser, snapshot, diff, rowsToRaw, adopt, repairSeq, unknownKeys, counts, totals, canon, sortKeys };
