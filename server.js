'use strict';
/*
 * Chùa Tâm An — máy chủ chánh điện online.
 * Express phục vụ trang web, Socket.IO lo mọi thứ thời gian thực:
 * người đang có mặt, đi lại, chat, thắp nhang, dâng hoa, thả tim, vái lạy, thỉnh chuông, tụng kinh chung, cúng dường.
 */
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const express = require('express');
const { Server } = require('socket.io');
const store = require('./lib/store');
const auth = require('./lib/auth');
const { clean, checkMessage, checkName, rulesSummary } = require('./lib/moderation');
const AURA = require('./public/js/aura');
const MERITS = require('./public/js/merit');
const announce = require('./lib/announce');
const MARTIAL = require('./public/js/martial');
const { createMartialService } = require('./lib/martial/service');
const { mergeMartialGuest, donatedBy } = require('./lib/account');
const { createArenaManager } = require('./lib/pk/manager');
const fs = require('fs');

// Bài tụng dựng sẵn (tools/build_chants.py): tên, file và thời lượng thật của từng bài
const TRACKS = (() => {
  try {
    return JSON.parse(fs.readFileSync(path.join(__dirname, 'public', 'audio', 'chants', 'manifest.json'), 'utf8')).tracks;
  } catch (e) {
    console.error('Không đọc được public/audio/chants/manifest.json — chạy tools/build_chants.py để dựng bài tụng.', e.message);
    return {};
  }
})();
// Kinh trong Tàng Kinh Các (public/kinh/index.json): để kiểm tra ai đang đọc bộ nào
const BOOKS = (() => {
  try {
    return JSON.parse(fs.readFileSync(path.join(__dirname, 'public', 'kinh', 'index.json'), 'utf8')).books
      .map(b => ({ id: String(b.id), title: clean(String(b.title), 60) }));
  } catch (e) {
    console.error('Không đọc được public/kinh/index.json:', e.message);
    return [];
  }
})();

/* ---------------- cấu hình (biến môi trường) ---------------- */
const PORT = Number(process.env.PORT) || 3000;
const ADMIN_KEY = process.env.ADMIN_KEY || '';
const SITE_NAME = clean(process.env.SITE_NAME || 'Chùa Tâm An', 60);
const INCENSE_MINUTES = Math.max(1, Number(process.env.INCENSE_MINUTES) || 30);
const MAX_PLAYERS = Number(process.env.MAX_PLAYERS) || 300;
const MAX_CONN_PER_IP = Number(process.env.MAX_CONN_PER_IP) || 8;
const SEPAY_API_KEY = process.env.SEPAY_API_KEY || '';
const BANK = {
  id: (process.env.BANK_ID || '').trim(),
  account: (process.env.BANK_ACCOUNT || '').replace(/\s/g, ''),
  name: clean(process.env.BANK_ACCOUNT_NAME || '', 60),
  label: clean(process.env.BANK_LABEL || process.env.BANK_ID || '', 60)
};
const DONATION_ENABLED = !!(BANK.id && BANK.account);
// FUNDS="Tu sửa chánh điện|300000000;Bếp cơm từ thiện;Tùy nhà chùa sử dụng"  (mục tiêu là tùy chọn)
const FUNDS = (process.env.FUNDS || 'Tùy nhà chùa sử dụng').split(';').map(s => s.trim()).filter(Boolean).slice(0, 8)
  .map((s, i) => { const [name, goal] = s.split('|'); return { id: 'q' + i, name: clean(name, 60), goal: Math.max(0, parseInt(goal, 10) || 0) }; });

/* ----- Võ Học Các và Sân đấu ----- */
const MARTIAL_ENABLED = process.env.MARTIAL_ENABLED !== '0';
const PK_ENABLED = MARTIAL_ENABLED && process.env.PK_ENABLED !== '0';
const PK_MAX_MATCHES = Number(process.env.PK_MAX_MATCHES) || 20;
const PK_TIME_SCALE = Number(process.env.PK_TIME_SCALE) > 0 ? Number(process.env.PK_TIME_SCALE) : 1;   // chỉ để thử: 0.05 = mọi mốc giờ trong trận ngắn gấp 20 lần
const SPEEDUP_ENABLED = MARTIAL_ENABLED && DONATION_ENABLED && process.env.SPEEDUP_ENABLED !== '0';
const SPEEDUP_PER_DAY = Math.max(1, Number(process.env.SPEEDUP_PER_DAY) || 2);
const CULTIVATION_TIME_SCALE = Number(process.env.CULTIVATION_TIME_SCALE) > 0 ? Number(process.env.CULTIVATION_TIME_SCALE) : 1;   // chỉ để thử: 0.001 = nhanh gấp nghìn lần
const MARTIAL_SWEEP_MS = Math.max(100, Number(process.env.MARTIAL_SWEEP_MS) || 15000);
const PLACES = ['hall', 'dojo', 'arena'];     // thêm nơi mới (ví dụ coi bói, tarot) ở đây và đăng ký phía trình duyệt

const MERIT = MERITS.EARN;   // thắp nhang +10, dâng lễ +5, … ; cúng dường +1 cho mỗi 1.000đ
// Mốc công đức trong ngày → hiệu ứng chúc mừng ở trình duyệt. Máy chủ quyết định, trình duyệt chỉ hiển thị.
const MILESTONES = [[100, 'bless'], [300, 'bless'], [500, 'bless'], [666, 'scare'], [888, 'grand'], [999, 'grand']];
const MILESTONE_EVERY = 1000;   // từ 1000 trở đi: cứ mỗi 1000 là một mốc 'grand'
const ITEMS = { lotus: 'dâng một đóa sen', rose: 'dâng một bó hoa hồng', lamp: 'thắp một ngọn đèn', fruit: 'dâng một mâm ngũ quả' };
const KINDS = ['Cầu an', 'Cầu siêu', 'Tạ ơn', 'Sám hối', 'Hồi hướng'];
const PENALTY_RULES = rulesSummary();
const SPEED = 0.24;          // tốc độ đi (đơn vị sàn / giây)
const X_WEIGHT = 1.6;        // sàn rộng hơn sâu
const Z_MIN = 0.12, Z_MAX = 0.97, X_MIN = 0.03, X_MAX = 0.97;

/* ----- nói chuyện bằng giọng (WebRTC) ----- */
// Máy chủ chỉ chuyển lời mời kết nối giữa hai trình duyệt; tiếng nói đi thẳng giữa hai máy, không qua máy chủ.
const VOICE_ENABLED = process.env.VOICE !== '0';
const VOICE_MAX = Number(process.env.VOICE_MAX) || 150;
const STUN_URLS = (process.env.STUN_URLS || 'stun:stun.l.google.com:19302,stun:stun.cloudflare.com:3478').split(',').map(s => s.trim()).filter(Boolean);
const TURN = { urls: (process.env.TURN_URLS || '').split(',').map(s => s.trim()).filter(Boolean), username: process.env.TURN_USERNAME || '', credential: process.env.TURN_CREDENTIAL || '' };
const CF_TURN = { id: (process.env.CF_TURN_KEY_ID || '').trim(), token: (process.env.CF_TURN_API_TOKEN || '').trim() };

/* ---------------- tiện ích ---------------- */
const vnDay = (ms = Date.now()) => new Date(ms + 7 * 3600e3).toISOString().slice(0, 10);
const num = (v, lo, hi, d) => { const n = Number(v); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };
const rand = (a, b) => a + Math.random() * (b - a);
const CODE_ABC = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const makeCode = () => 'CD' + Array.from(crypto.randomBytes(6), b => CODE_ABC[b % CODE_ABC.length]).join('');
function safeEqual(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

/* Máy chủ STUN/TURN cho trình duyệt. TURN giúp nối được khi mạng 4G hoặc mạng công ty chặn kết nối thẳng. */
let cfIce = null, cfIceAt = 0, cfIceJob = null;
async function iceServers() {
  const list = [];
  if (STUN_URLS.length) list.push({ urls: STUN_URLS });
  if (TURN.urls.length) list.push({ urls: TURN.urls, username: TURN.username, credential: TURN.credential });
  if (!CF_TURN.id || !CF_TURN.token) return list;
  if (!cfIce || Date.now() - cfIceAt > 3600e3) {
    // Cloudflare TURN: xin thông tin đăng nhập tạm (24 giờ), dùng chung trong 1 giờ
    if (!cfIceJob) {
      cfIceJob = fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${encodeURIComponent(CF_TURN.id)}/credentials/generate-ice-servers`, {
        method: 'POST', headers: { authorization: 'Bearer ' + CF_TURN.token, 'content-type': 'application/json' },
        body: JSON.stringify({ ttl: 86400 }), signal: AbortSignal.timeout(6000)
      }).then(r => (r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status))))
        .then(j => {
          const arr = Array.isArray(j.iceServers) ? j.iceServers : [j.iceServers];
          // trình duyệt hay treo ở cổng 53, bỏ đi
          cfIce = arr.filter(x => x && x.urls).map(x => ({ ...x, urls: [].concat(x.urls).filter(u => !/:53(\?|$)/.test(u)) })).filter(x => x.urls.length);
          cfIceAt = Date.now();
        })
        .catch(e => console.error('[voice] Không lấy được TURN của Cloudflare:', e.message))
        .finally(() => { cfIceJob = null; });
    }
    await cfIceJob;
  }
  return list.concat(cfIce || []);
}

/* ---------------- dữ liệu ---------------- */
const db = store.get();    // cùng một object suốt vòng đời; main() gọi store.init() điền dữ liệu trước khi mở cổng
let martial = null, arena = null;   // dịch vụ tu luyện và quản lý sân đấu, tạo trong main() sau khi dữ liệu đã nạp
function rollDay() {
  const d = vnDay();
  if (db.day !== d) {
    db.day = d; db.today = store.COUNTERS(); statsDirty = true;
    for (const p of players.values()) p.meritDirty = true;
    store.save();
  }
}
let statsDirty = true;
function bump(key, n = 1) { rollDay(); db.today[key] += n; db.total[key] += n; statsDirty = true; store.save(); }
function addMerit(p, n) { addMeritUid(p.uid, p.name, n); }
/**
 * Cộng (hoặc trừ, n < 0) công đức theo uid; người đang có mặt thì cập nhật hình ảnh cho cả chánh điện.
 * calm: lần cộng từ cúng dường (nhảy nhiều điểm một lúc) thì không hù ở mốc 666, chỉ chúc mừng.
 */
function addMeritUid(uid, name, n, calm) {
  uid = accountOf(uid);      // khách đã gộp vào tài khoản thì cộng vào tài khoản, không tạo lại dòng mồ côi
  const d = vnDay();
  let m = db.merit[uid];
  if (!m) m = db.merit[uid] = { name, total: 0, today: 0, day: d };
  if (m.day !== d) { m.day = d; m.today = 0; }
  const before = m.total, beforeToday = m.today;
  m.name = name; m.total += n; m.today += n;
  store.save();
  const hit = n > 0 ? crossed(beforeToday, m.today, calm) : null;
  for (const p of players.values()) {
    if (accountOf(p.uid) !== uid) continue;
    // Mốc trong ngày: giữ số lúc vượt mốc phòng khi nhịp gửi rơi qua nửa đêm.
    if (hit && outranks(hit, p.milestone)) p.milestone = { ...hit, today: m.today };
    updatePlayerMerit(p, m.total, MERITS.rankOf(m.total) > MERITS.rankOf(before));
  }
}
function updatePlayerMerit(p, total, up = false) {
  p.meritDirty = true;
  // Chỉ báo cả chánh điện khi pháp tướng hoặc quỷ đổi.
  const key = MERITS.visualKey(total);
  if (key !== p.mkey) {
    p.mkey = key;
    io.emit('pm', { id: p.id, mt: total, up });
  }
}
// Mốc nào vừa bị bước qua khi công đức đi từ before lên after (mỗi lần cộng là 1..15 nên có thể nhảy qua đúng số).
// Bước qua nhiều mốc cùng lúc thì chỉ giữ một: 'scare' thắng, còn lại lấy mốc cao nhất.
function crossed(before, after, calm) {
  let best = null;
  const take = (at, kind) => { const c = { at, kind }; if (outranks(c, best)) best = c; };
  for (const [at, kind] of MILESTONES) if (before < at && after >= at) take(at, calm && kind === 'scare' ? 'grand' : kind);
  for (let k = Math.floor(Math.max(0, before) / MILESTONE_EVERY) + 1; k * MILESTONE_EVERY <= after && k <= 1000; k++) take(k * MILESTONE_EVERY, 'grand');
  return best;
}
function outranks(a, b) {
  if (!b) return true;
  if ((a.kind === 'scare') !== (b.kind === 'scare')) return a.kind === 'scare';
  return a.at > b.at;
}
const meritTotal = uid => (db.merit[uid] ? db.merit[uid].total : 0);
// Tái phạm lời tục trong 10 phút (theo uid, giữ trong bộ nhớ)
const offenses = new Map();
function penalize(p, pen, where) {
  const t = now(), list = (offenses.get(p.uid) || []).filter(x => t - x < 10 * 60e3);
  const mult = Math.min(3, 1 + 0.5 * list.length);
  const pts = Math.min(300, Math.round(pen.pts * mult));
  list.push(t); offenses.set(p.uid, list);
  addMerit(p, -pts);
  io.emit('penalty', { pid: p.id, n: pts });
  p.socket.emit('penalty:me', { n: pts, lv: pen.lv, name: pen.name, shout: !!pen.shout, mult, where, total: meritTotal(p.uid) });
  return pts;
}
function meritOf(uid) {
  const m = db.merit[uid];
  if (!m) return { today: 0, total: 0 };
  return { today: m.day === vnDay() ? m.today : 0, total: m.total };
}
function linkGuest(guest, uid) {
  if (db.linkedGuests[guest]) return null;
  const from = db.merit[guest], to = db.merit[uid];
  const guestAura = db.auras[guest], accountAura = db.auras[uid];
  if (from) {
    const day = vnDay();
    db.merit[uid] = {
      name: to?.name || from.name,
      total: (to?.total || 0) + from.total,
      today: (to?.day === day ? to.today : 0) + (from.day === day ? from.today : 0),
      day
    };
    delete db.merit[guest];
  }
  const t = now();
  const moveAura = guestAura && guestAura.until > t;
  if (moveAura) {
    const active = accountAura?.until > t ? accountAura : null;
    const amount = guestAura.amount + (active?.amount || 0);
    db.auras[uid] = {
      name: active?.name || guestAura.name,
      amount, tier: AURA.tierOf(amount), until: Math.max(guestAura.until, active?.until || 0)
    };
    delete db.auras[guest];
  }
  // hồ sơ võ học của khách (nếu có) cũng theo về tài khoản: công lực, tâm đắc, chiêu đã học, phiên tu, phiếu, thắng thua
  const undoMartial = mergeMartialGuest(db, guest, uid, now());
  db.linkedGuests[guest] = uid;
  return () => {
    if (undoMartial) undoMartial();
    delete db.linkedGuests[guest];
    if (from) {
      db.merit[guest] = from;
      if (to) db.merit[uid] = to;
      else delete db.merit[uid];
    }
    if (moveAura) {
      db.auras[guest] = guestAura;
      if (accountAura) db.auras[uid] = accountAura;
      else delete db.auras[uid];
    }
  };
}
const accountOf = uid => db.linkedGuests[uid] || uid;
function auraOf(uid) {
  const a = db.auras[uid];
  return a && a.tier && a.until > now() ? { t: a.tier, until: a.until } : 0;
}
function myAura(uid) {
  const a = db.auras[uid];
  return a && a.until > now() ? { amount: a.amount, t: a.tier, until: a.until } : null;
}
function board() {
  const d = vnDay();
  return Object.values(db.merit).filter(m => m.day === d && m.today > 0)
    .sort((a, b) => b.today - a.today).slice(0, 10).map(m => ({ name: m.name, v: m.today }));
}
const now = () => Date.now();
function activeIncense() { const t = now(); return db.incense.filter(s => s.until > t); }
function fundsSummary() {
  return FUNDS.map(f => ({
    id: f.id, name: f.name, goal: f.goal,
    raised: db.donations.filter(d => d.status === 'confirmed' && d.fund === f.id).reduce((s, d) => s + d.amount, 0)
  }));
}
const publicMsg = m => ({ id: m.id, pid: m.pid, name: m.name, c: m.c, text: m.text, t: m.t, mod: !!m.mod, sys: !!m.sys });
const publicPrayer = p => ({ id: p.id, kind: p.kind, text: p.text, name: p.name, t: p.t, n: p.n });
const publicDonation = d => ({ name: d.anon ? 'Ẩn danh' : d.name, amount: d.hide ? null : d.amount, fund: d.fundName, note: d.note, t: d.confirmedAt });

/* ---------------- máy chủ web ---------------- */
const app = express();
app.set('trust proxy', process.env.TRUST_PROXY === '0' ? false : 1);
app.disable('x-powered-by');
app.use((req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.set('X-Frame-Options', 'SAMEORIGIN');
  next();
});
app.use(express.json({ limit: '64kb' }));
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: '10m',
  setHeaders: (res, file) => { if (file.endsWith('.html')) res.set('Cache-Control', 'no-cache'); }
}));
app.get('/healthz', (req, res) => { const st = store.status(); res.json({ ok: true, online: players.size, voice: voiceCount(), db: store.backend, dbOk: !!st.ready && !st.lastError }); });
app.get('/api/config', (req, res) => res.json(clientConfig()));
app.get('/api/announce/:id', (req, res) => {
  const c = announce.get(req.params.id);
  if (!c) return res.status(404).end();
  res.set('Cache-Control', 'public, max-age=1800').type(c.type).send(c.buf);
});

/* ----- kho meme và lời chúc cho hiệu ứng mốc công đức (thả file vào thư mục là tự có) ----- */
const MEME_DIR = path.join(__dirname, 'public', 'img', 'memes');
const BLESS_DIR = path.join(__dirname, 'public', 'audio', 'blessings');
const MEME_EXT = /\.(jpe?g|png|webp|gif|avif)$/i;
const BLESS_FILE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,80}\.(mp3|ogg|m4a|wav)$/i;   // chỉ tên file thường, không có dấu / hay ..
const MAX_URL = 300;   // celebrate.js safeUrl() chỉ nhận địa chỉ ngắn hơn 300 ký tự
let fxCache = { t: 0, memes: [], blessings: [] }, fxWarned = false;
function fxAssets() {
  const t = now();
  if (fxCache.t && t - fxCache.t < 30e3) return fxCache;
  let memes = [], blessings = [];
  try {
    // tên file có byte lỗi UTF-8 (U+FFFD) thì địa chỉ sẽ 404; tên quá dài thì trình duyệt (safeUrl < 300 ký tự) từ chối
    memes = fs.readdirSync(MEME_DIR, { withFileTypes: true })
      .filter(e => e.isFile() && !e.name.startsWith('.') && e.name.length <= 120 && MEME_EXT.test(e.name) && !e.name.includes('\uFFFD'))
      .map(e => e.name).sort().map(n => '/img/memes/' + encodeURIComponent(n)).filter(u => u.length < MAX_URL).slice(0, 200);
  } catch (e) { memes = []; }
  try {
    const raw = fs.readFileSync(path.join(BLESS_DIR, 'manifest.json'), 'utf8').replace(/^\uFEFF/, '');   // Notepad / PowerShell hay thêm BOM
    const man = JSON.parse(raw);
    const lines = Array.isArray(man && man.lines) ? man.lines : [];
    for (const l of lines.slice(0, 40)) {
      const file = l && typeof l.file === 'string' ? l.file : '', text = clean(l && l.text, 160);
      if (!BLESS_FILE.test(file) || !text) continue;
      try { if (!fs.statSync(path.join(BLESS_DIR, file)).isFile()) continue; } catch (e) { continue; }
      blessings.push({ url: '/audio/blessings/' + encodeURIComponent(file), text });
    }
  } catch (e) {
    blessings = [];
    if (e.code !== 'ENOENT' && !fxWarned) { fxWarned = true; console.warn('[blessings] Không đọc được manifest.json, dùng giọng đọc của trình duyệt:', e.message); }
  }
  fxCache = { t, memes, blessings };
  return fxCache;
}

function clientConfig() {
  const fx = fxAssets();
  return {
    penaltyRules: PENALTY_RULES, meritPerVnd: MERITS.EARN.perVnd,
    siteName: SITE_NAME,
    memes: fx.memes,
    blessings: fx.blessings,
    incenseMinutes: INCENSE_MINUTES,
    donation: DONATION_ENABLED ? { bank: BANK.label, account: BANK.account, accountName: BANK.name, funds: FUNDS.map(f => ({ id: f.id, name: f.name })) } : null,
    tracks: TRACKS,
    kinds: KINDS,
    voice: VOICE_ENABLED,
    tts: announce.enabled,
    martial: { enabled: MARTIAL_ENABLED, pk: PK_ENABLED, speedup: SPEEDUP_ENABLED, loginRequired: auth.enabled }
  };
}

/* ----- bản ghi cúng dường + mã VietQR (dùng chung: cúng dường thường và hoàn thành tu luyện ngay) ----- */
function addDonation(fields) {
  const don = Object.assign({ code: makeCode(), status: 'pending', createdAt: now() }, fields);
  // đã xác nhận thì không bao giờ xóa: chỉ dọn lượt đã hủy / hết hạn cũ nhất khi quá nhiều
  db.donations.push(don);
  for (let i = 0; db.donations.length > 3000 && i < db.donations.length; ) {
    if (db.donations[i].status === 'cancelled' || db.donations[i].status === 'expired') db.donations.splice(i, 1); else i++;
  }
  store.save();
  return don;
}
function donationAck(don) {
  const qr = `https://img.vietqr.io/image/${encodeURIComponent(BANK.id)}-${encodeURIComponent(BANK.account)}-compact2.png?amount=${don.amount}&addInfo=${encodeURIComponent(don.code)}&accountName=${encodeURIComponent(BANK.name)}`;
  return { ok: true, code: don.code, amount: don.amount, fund: don.fundName, qr, bank: BANK.label, account: BANK.account, accountName: BANK.name, auto: !!SEPAY_API_KEY };
}

/* Render chạy bản cũ chồng bản mới vài chục giây lúc deploy: lượt cúng dường tạo ở bản kia chưa có trong RAM của bản này.
 * Thiếu trong RAM thì đọc thẳng từ PostgreSQL (chỉ ở chế độ PG). */
async function adoptDonation(code) {
  code = String(code || '');
  const d = db.donations.find(x => x.code === code);
  if (d || store.backend !== 'pg' || !/^[A-Z0-9]{4,20}$/.test(code)) return d || null;
  try {
    const raw = await store.fetchDoc('donations', code);
    if (!raw || typeof raw !== 'object' || raw.code !== code) return null;
    const again = db.donations.find(x => x.code === code);   // có bản khác nạp xong trong lúc chờ
    if (again) return again;
    db.donations.push(raw);
    db.donations.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    store.save();
    return raw;
  } catch (e) { return null; }
}
let donSyncAt = 0;
async function syncDonations() {
  if (store.backend !== 'pg' || now() - donSyncAt < 20e3) return;
  donSyncAt = now();
  try {
    const have = new Set(db.donations.map(x => x.code));
    let added = 0;
    for (const raw of await store.fetchDocs('donations')) {
      if (raw && typeof raw === 'object' && typeof raw.code === 'string' && !have.has(raw.code)) { db.donations.push(raw); added++; }
    }
    if (added) { db.donations.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0)); store.save(); }
  } catch (e) { /* CSDL bận: lần xem sau */ }
}

/* ----- webhook SePay: tự xác nhận khi tài khoản chùa nhận tiền ----- */
app.post('/api/webhooks/sepay', async (req, res) => {
  if (!SEPAY_API_KEY) return res.status(404).json({ success: false });
  const lock = 'sepay:' + req.ip;
  if (failLock(lock)) return res.status(429).json({ success: false });
  const key = String(req.get('authorization') || '').replace(/^Apikey\s+/i, '').trim();
  if (!safeEqual(key, SEPAY_API_KEY)) { failHit(lock); return res.status(401).json({ success: false }); }
  const b = req.body || {};
  if (b.transferType && b.transferType !== 'in') return res.json({ success: true });
  const content = String(b.content || '') + ' ' + String(b.description || '') + ' ' + String(b.code || '');
  const codes = content.toUpperCase().replace(/[^A-Z0-9]/g, ' ').match(/CD[A-Z0-9]{6}/g) || [];
  const amount = Number(b.transferAmount) || 0, ref = String(b.referenceCode || b.id || '');
  let d = null, seen = null;
  for (const c of codes) {
    const x = await adoptDonation(c);
    if (x && !seen) seen = x;
    if (x && x.status === 'pending') { d = x; break; }
  }
  // SePay gọi lại lượt đã xác nhận mà lần trước chưa ghi bền được: chỉ trả thành công khi đã ghi bền
  if (!d && seen && seen.status === 'confirmed' && seen.source === 'sepay' && seen.ref === ref) {
    return (await store.flush()) ? res.json({ success: true, matched: true, duplicate: true }) : res.status(503).json({ success: false });
  }
  if (!d) return res.json({ success: true, matched: false });
  if (amount < d.amount) return res.json({ success: true, matched: false, reason: 'amount_too_low' });
  if (d.purpose === 'speedup') {   // hoàn thành tu luyện ngay chỉ xong khi Ban điều hành bấm xác nhận: ngân hàng báo thì chỉ đánh dấu
    d.bank = { at: now(), amount, ref };
    if (!(await store.flush())) return res.status(503).json({ success: false });
    return res.json({ success: true, matched: true, manual: true });
  }
  confirmDonation(d, { amount, ref, source: 'sepay' });
  // Chỉ báo "thành công" cho ngân hàng khi đã ghi bền: SePay không gửi lại khi đã nhận success
  if (!(await store.flush())) return res.status(503).json({ success: false });
  res.json({ success: true, matched: true });
});

/* ----- quản trị ----- */
// Đếm lần nhập sai mã (quản trị, webhook SePay) theo IP, dùng chung cho HTTP và socket: 10 lần sai thì khóa 10 phút.
const authFails = new Map();      // khóa -> { n, until }
const adminFails = authFails;
const failLock = key => { const f = authFails.get(key); return f && f.n >= 10 && f.until > now() ? Math.ceil((f.until - now()) / 1000) : 0; };
function failHit(key) { const f = authFails.get(key), g = f && f.until > now() ? f : { n: 0, until: 0 }; g.n += 1; g.until = now() + 10 * 60e3; authFails.set(key, g); }
function admin(req, res, next) {
  if (!ADMIN_KEY) return res.status(503).json({ error: 'Chưa đặt ADMIN_KEY trên máy chủ.' });
  const key = 'ip:' + req.ip, wait = failLock(key);
  if (wait) return res.status(429).set('Retry-After', String(wait)).json({ error: 'Nhập sai mã quản trị quá nhiều lần. Đợi vài phút rồi thử lại.' });
  if (!safeEqual(req.get('x-admin-key') || '', ADMIN_KEY)) { failHit(key); return res.status(401).json({ error: 'Sai mã quản trị.' }); }
  authFails.delete(key);
  next();
}
/** Nhật ký thao tác quản trị (chỉ thêm; giữ 500 dòng gần nhất). Không ghi mã quản trị; IP chỉ ghi dạng băm ngắn. */
function audit(req, action, target, detail) {
  const ip = crypto.createHash('sha256').update('audit:' + (req ? req.ip : '')).digest('hex').slice(0, 10);
  db.martial.audit.push({ id: store.nextId(), at: now(), actor: 'admin', ip, action, target: String(target || ''), detail: detail || null });
  if (db.martial.audit.length > 500) db.martial.audit.splice(0, db.martial.audit.length - 500);
  store.save();
}
const speedupView = x => {
  const sess = db.martial.sessions[x.sessionId];
  return { methodName: (MARTIAL.METHODS[x.methodId] || {}).name || x.methodId, durationKey: x.durationKey, sessionStatus: sess ? sess.status : 'missing', endsAt: sess ? sess.endsAt : null, bankReported: !!x.bank };
};
app.get('/api/admin/summary', admin, async (req, res) => {
  await syncDonations();
  res.json({
    online: players.size, today: db.today, total: db.total, funds: fundsSummary(), donationEnabled: DONATION_ENABLED,
    donations: db.donations.slice(-300).reverse().map(x => (x.purpose === 'speedup' ? { ...x, speedup: speedupView(x) } : x)),
    martial: { profiles: Object.keys(db.martial.profiles).length, activeSessions: Object.values(db.martial.sessions).filter(x => x.status === 'active').length, pendingSpeedups: db.donations.filter(x => x.purpose === 'speedup' && x.status === 'pending').length, matches: db.martial.matches.length, arena: arena ? arena.stats() : null },
    db: store.status(),
    chat: db.chat.slice(-150).reverse().map(m => ({ ...publicMsg(m), hidden: !!m.hidden, reports: (m.reports || []).length, pen: m.pen || 0 })),
    prayers: db.prayers.slice(-100).reverse().map(p => ({ ...publicPrayer(p), hidden: !!p.hidden })),
    chant, voice: voiceCount(), tts: announce.enabled ? announce.voice : null,
    auras: Object.entries(db.auras).filter(([, a]) => a.tier && a.until > now())
      .map(([, a]) => ({ name: a.name, tier: a.tier, tierName: AURA.TIERS[a.tier - 1].name, amount: a.amount, until: a.until }))
      .sort((a, b) => b.tier - a.tier)
  });
});
app.post('/api/admin/donations/:code/confirm', admin, async (req, res) => {
  const d = await adoptDonation(req.params.code);
  if (!d) return res.status(404).json({ error: 'Không thấy mã này.' });
  if (d.status === 'confirmed') return res.json({ ok: true, already: true, outcome: d.outcome || null });
  const from = d.status;
  const a = confirmDonation(d, { amount: d.amount, ref: 'admin', source: 'admin' });
  audit(req, 'donation.confirm', d.code, { from, amount: d.amount, purpose: d.purpose || 'donation', outcome: d.outcome || null });
  const saved = await store.flush();     // false: đã ghi nhận trong bộ nhớ nhưng CHƯA ghi bền; hệ thống tự thử lại
  res.json({ ok: true, saved, outcome: d.outcome || null, aura: a ? { tier: a.tier, tierName: a.tier ? AURA.TIERS[a.tier - 1].name : '', up: a.up, amount: a.amount, until: a.until } : null });
});
app.post('/api/admin/donations/:code/cancel', admin, async (req, res) => {
  const d = await adoptDonation(req.params.code);
  if (!d) return res.status(404).json({ error: 'Không thấy mã này.' });
  if (d.status === 'pending') {
    d.status = 'cancelled';
    if (d.purpose === 'speedup') deliverUpdates(martial.onDonationClosed(d));
    audit(req, 'donation.cancel', d.code, { amount: d.amount, purpose: d.purpose || 'donation' });
    return res.json({ ok: true, saved: await store.flush() });
  }
  res.json({ ok: true });
});
app.get('/api/admin/audit', admin, (req, res) => res.json({ audit: db.martial.audit.slice(-200).reverse() }));
// Sao lưu toàn bộ dữ liệu ra JSON (cùng hình dạng db.json). Phiên đăng nhập là dữ liệu nhạy cảm nên mặc định không xuất.
app.get('/api/admin/export', admin, (req, res) => {
  const out = { ...db };
  if (req.query.sessions !== '1') delete out.authSessions;
  audit(req, 'export', 'db', { sessions: req.query.sessions === '1' });
  res.set('Content-Disposition', 'attachment; filename="chua-tam-an-db.json"').type('application/json').send(JSON.stringify(out));
});
app.post('/api/admin/chat/:id/hide', admin, (req, res) => { hideMessage(Number(req.params.id)); audit(req, 'chat.hide', req.params.id); res.json({ ok: true }); });
app.post('/api/admin/prayers/:id/hide', admin, (req, res) => {
  const p = db.prayers.find(x => x.id === Number(req.params.id));
  if (p) { p.hidden = true; io.emit('prayer:hide', { id: p.id }); audit(req, 'prayer.hide', p.id); store.save(); }
  res.json({ ok: true });
});
app.post('/api/admin/announce', admin, (req, res) => {
  const text = clean((req.body || {}).text, 300);
  if (!text) return res.status(400).json({ error: 'Nội dung trống.' });
  postChat({ pid: 0, uid: 'admin', name: 'Ban điều hành', c: 3, mod: true }, text);
  audit(req, 'announce', 'chat', { text: text.slice(0, 80) });
  res.json({ ok: true });
});
app.post('/api/admin/chant/stop', admin, (req, res) => { endChant(false); audit(req, 'chant.stop', 'chant'); res.json({ ok: true }); });

const server = http.createServer(app);
const io = new Server(server, { maxHttpBufferSize: 16e3, pingInterval: 20000, pingTimeout: 25000 });

/* ---------------- trạng thái phòng ---------------- */
const players = new Map();     // pid -> player
const ipCount = new Map();
let nextPid = 1;
let chant = null, chantTimer = null, lastChantEnd = 0, lastGlobalBell = 0;

auth.mount(app, {
  linkGuest,
  onGuestLinked(guest, uid) {
    const history = offenses.get(guest);
    if (history) {
      offenses.set(uid, [...(offenses.get(uid) || []), ...history].filter(t => t > now() - 10 * 60e3));
      offenses.delete(guest);
    }
    const aura = myAura(uid);
    for (const p of players.values()) {
      if (p.uid === guest) p.socket.disconnect(true);
      if (p.uid !== uid) continue;
      updatePlayerMerit(p, meritTotal(uid));
      p.socket.emit('aura:me', aura);
      io.emit('aura', { pid: p.id, au: auraOf(uid), up: false });
    }
  },
  onLogout(key) {
    for (const socket of io.sockets.sockets.values()) {
      if (socket.data.authKey === key) socket.disconnect(true);
    }
  }
});

const publicPlayer = p => ({ id: p.id, name: p.name, look: p.look, x: +p.x.toFixed(3), z: +p.z.toFixed(3), mod: p.mod, scene: p.scene || 'hall', v: p.v || 0, rd: p.rd || '', au: auraOf(p.uid), mt: meritTotal(p.uid), at: p.place && p.place !== 'hall' ? p.place : undefined });
const voiceCount = () => { let n = 0; for (const p of players.values()) if (p.v) n++; return n; };
function sys(text) {
  const m = { id: store.nextId(), pid: 0, name: '', c: 0, text, t: now(), sys: true };
  db.chat.push(m); if (db.chat.length > 250) db.chat.splice(0, db.chat.length - 250);
  io.emit('chat', publicMsg(m));
}
function postChat(p, text, pen) {
  const m = { id: store.nextId(), pid: p.id || 0, uid: p.uid, name: p.name, c: p.look ? p.look.c : p.c, text, t: now(), mod: !!p.mod };
  if (pen) m.pen = pen;
  db.chat.push(m); if (db.chat.length > 250) db.chat.splice(0, db.chat.length - 250);
  store.save();
  io.emit('chat', publicMsg(m));
}
function hideMessage(id) {
  const m = db.chat.find(x => x.id === id);
  if (m && !m.hidden) { m.hidden = true; io.emit('chat:hide', { id }); store.save(); }
}
function confirmDonation(d, info) {
  const uid = accountOf(d.uid);
  d.status = 'confirmed'; d.confirmedAt = now(); d.paidAmount = info.amount; d.ref = info.ref; d.source = info.source;
  if (info.amount > d.amount) d.amount = info.amount;
  // Hào quang: cộng dồn theo người cúng dường (ẩn danh hoặc tự tắt thì không hiện)
  let aura = null;
  if (!d.anon && d.aura !== false) {
    aura = AURA.stack(db.auras[uid], d.amount, now());
    db.auras[uid] = { amount: aura.amount, tier: aura.tier, until: aura.until, name: d.name };
    d.auraTier = aura.tier;
  }
  const tierInfo = aura && aura.tier ? AURA.TIERS[aura.tier - 1] : null;
  // Công đức: mỗi 1.000đ đã xác nhận là 1 điểm
  const gain = Math.floor(d.amount / MERITS.EARN.perVnd);
  if (gain > 0) { addMeritUid(uid, d.name, gain, true); d.merit = gain; }
  store.save();
  io.emit('donation', { d: publicDonation(d), funds: fundsSummary() });
  sys(`${d.anon ? 'Một Phật tử ẩn danh' : d.name} vừa cúng dường tịnh tài cho quỹ “${d.fundName}”. Tùy hỷ công đức.`);
  for (const p of players.values()) {
    if (p.uid !== uid) continue;
    p.socket.emit('donation:ok', { code: d.code, amount: d.amount, fund: d.fundName, merit: gain, aura: aura && { ...myAura(uid), up: aura.up } });
    if (aura) io.emit('aura', { pid: p.id, au: auraOf(p.uid), up: aura.up });
  }
  // Đọc thông báo: soạn câu, nhờ VieNeu đọc (nếu có), rồi phát cho cả chánh điện
  const msg = announce.compose(d, aura, tierInfo);
  const base = { text: msg.text, speak: msg.speak, tier: aura && aura.up ? aura.tier : 0 };
  announce.speak(msg.speak).then(r => io.emit('announce', { ...base, audio: r.audio }));
  // Cúng dường để hoàn thành tu luyện ngay: chỉ tới đây (Ban điều hành đã xác nhận) phiên mới được hoàn thành, và chỉ một lần.
  if (d.purpose === 'speedup' && martial) deliverUpdates(martial.onDonationConfirmed(d));
  return aura;
}
function endChant(completed) {
  clearTimeout(chantTimer); chantTimer = null;
  if (!chant) return;
  const title = chant.title;
  chant = null; lastChantEnd = now();
  io.emit('chant', null);
  if (completed) {
    bump('chants');
    const awarded = new Set();
    for (const p of players.values()) {
      if (awarded.has(p.uid) || (p.socket.data.authKey && !auth.sessionFor(p.socket.data.authKey))) continue;
      addMerit(p, MERIT.chantJoin);
      awarded.add(p.uid);
    }
    sys(`Khóa tụng “${title}” đã viên mãn. Hồi hướng công đức đến tất cả chúng sinh.`);
  } else sys(`Khóa tụng “${title}” đã dừng.`);
}

/* ---------------- Võ Học Các và Sân đấu: hàm hỗ trợ ---------------- */
const LOGIN_MSG = 'Cần đăng nhập Google để tu luyện và luận võ, vì tiến độ gắn với tài khoản của bạn.';
const accountReady = p => !auth.enabled || !!auth.sessionFor(p.socket.data.authKey);
const BLOCK_SECRET = crypto.randomBytes(24);     // chỉ sống trong tiến trình: mã mờ chỉ dùng trong một phiên làm việc
const blockHandle = uid => crypto.createHmac('sha256', BLOCK_SECRET).update(String(uid)).digest('base64url').slice(0, 16);
function emitToUid(uid, ev, payload) { for (const q of players.values()) if (q.uid === uid) q.socket.emit(ev, payload); }
function deliverUpdates(r) { if (r && r.updates) for (const u of r.updates) emitToUid(u.uid, 'tu:update', u.update); }
/** Cấp pháp tướng (Lc), quỷ (Lq), hào quang (Ld) ngay lúc này; lấy từ đúng dữ liệu công đức / cúng dường đang chạy. */
function buffInputsOf(uid) {
  const mt = meritTotal(uid), dm = MERITS.demonOf(mt), a = auraOf(uid);
  return { Lc: MERITS.rankOf(mt), Lq: dm ? dm.n : 0, Ld: a ? a.t : 0 };
}
const guestMartialState = () => {
  const li = MARTIAL.levelInfo(0);
  return {
    ok: true, enabled: true, serverTime: now(), login: { required: true, signedIn: false },
    profile: { congLuc: 0, level: 1, levelFrom: li.from, levelTo: li.to, pct: 0, manaMax: li.manaMax, tam: { cuong: 0, toc: 0, nhu: 0 }, learned: MARTIAL.STARTERS.slice(), loadout: [], wins: 0, losses: 0, draws: 0, vouchers: [] },
    session: null, recent: [], speedup: { enabled: false, perDay: SPEEDUP_PER_DAY, usedToday: 0 }
  };
};
const otherInArena = p => { for (const q of players.values()) if (q !== p && q.uid === p.uid && q.place === 'arena') return true; return false; };
function leaveArena(p, reason) {
  p.socket.leave('arena');
  if (!otherInArena(p)) arena.leave(p.uid, reason);     // còn tab khác của cùng tài khoản ở sân thì giữ nguyên chỗ
}

/* ---------------- kết nối ---------------- */
io.use((socket, next) => {
  const fwd = socket.handshake.headers['x-forwarded-for'];
  const ip = (process.env.TRUST_PROXY !== '0' && fwd ? String(fwd).split(',')[0].trim() : socket.handshake.address) || 'x';
  const n = ipCount.get(ip) || 0;
  if (n >= MAX_CONN_PER_IP) return next(new Error('Quá nhiều kết nối từ cùng một mạng.'));
  ipCount.set(ip, n + 1);
  socket.data.ip = ip;
  socket.data.authKey = auth.sessionKey(socket.handshake.headers);
  next();
});

const fortuneQueue = require('./lib/fortune-queue')({ broadcast: state => io.emit('fortune:queue', state) });

io.on('connection', socket => {
  let p = null;
  const authKey = socket.data.authKey;
  if (authKey) socket.use((_, next) => {
    if (auth.sessionFor(authKey)) next();
    else socket.disconnect(true);
  });
  const fail = text => socket.emit('notice', { text });
  const allow = (key, ms) => { const t = now(); if ((p.cd[key] || 0) > t) return false; p.cd[key] = t + ms; return true; };
  const bucket = (key, rate, burst) => {
    const t = now(), b = p.bk[key] || (p.bk[key] = { n: burst, t });
    b.n = Math.min(burst, b.n + (t - b.t) / 1000 * rate); b.t = t;
    if (b.n >= 1) { b.n -= 1; return true; } return false;
  };

  socket.on('time', (_, ack) => { if (typeof ack === 'function') ack(now()); });

  socket.on('join', (data, ack) => {
    if (typeof ack !== 'function') return;
    if (p) return ack({ ok: false, reason: 'Bạn đã ở trong chánh điện.' });
    if (players.size >= MAX_PLAYERS) return ack({ ok: false, reason: 'Chánh điện đang quá đông. Bạn đợi ít phút rồi vào lại nhé.' });
    data = data || {};
    // mã quản trị gửi kèm khi vào chùa: dùng chung bộ đếm sai với trang quản trị, để không thử mã vô hạn qua socket
    const modKey = 'sock:' + socket.data.ip;     // đếm riêng với trang quản trị: mã cũ còn lưu ở trình duyệt không được khóa trang quản trị
    const modTry = !!(ADMIN_KEY && data.adminKey) && !failLock(modKey);
    const isMod = modTry && safeEqual(String(data.adminKey), ADMIN_KEY);
    if (modTry) { if (isMod) authFails.delete(modKey); else failHit(modKey); }
    const nm = checkName(data.name, isMod);
    if (!nm.ok) return ack({ ok: false, reason: nm.reason });
    const session = auth.sessionFor(authKey);
    const guest = auth.guestId(data.uid);
    const uid = session?.uid || (guest && !db.linkedGuests[guest] ? guest : crypto.randomUUID());
    p = {
      id: nextPid++, uid, name: nm.name, mod: isMod, socket,
      look: { g: data.look && data.look.g === 'nam' ? 'nam' : 'nu', c: num(data.look && data.look.c, 0, 11, 0) | 0, h: num(data.look && data.look.h, 0, 3, 0) | 0 },
      x: 0.5 + rand(-0.28, 0.28), z: rand(0.68, 0.92), tx: 0, tz: 0, dirty: false, cd: {}, bk: {}, lastText: '', meritDirty: false,
      scene: 'hall', v: 0, rd: '', voiceBanUntil: 0, milestone: null, place: 'hall'
    };
    p.tx = p.x; p.tz = p.z;
    p.mkey = MERITS.visualKey(meritTotal(uid));
    players.set(p.id, p);
    socket.data.pid = p.id;
    rollDay(); bump('visits');
    ack({
      ok: true, you: p.id, uid: session ? undefined : uid, serverTime: now(), config: clientConfig(),
      auth: { enabled: auth.enabled, signedIn: Boolean(session) },
      players: [...players.values()].map(publicPlayer),
      chat: db.chat.filter(m => !m.hidden).slice(-60).map(publicMsg),
      prayers: db.prayers.filter(x => !x.hidden).slice(-40).map(publicPrayer),
      incense: activeIncense().slice(-60),
      today: db.today, total: db.total, online: players.size,
      board: board(), merit: meritOf(uid), aura: myAura(uid), hasMatch: !!(arena && arena.hasMatch(uid)),
      donations: db.donations.filter(d => d.status === 'confirmed').slice(-20).map(publicDonation),
      funds: fundsSummary(), chant, fortuneQueue: fortuneQueue.snapshot()
    });
    socket.broadcast.emit('pj', publicPlayer(p));
    if (players.size <= 80) socket.broadcast.emit('ticker', { text: `${p.name} vừa vào chánh điện` });
  });

  socket.on('scene', (scene, ack) => {
    if (!p || !['hall', 'yard'].includes(scene)) return;
    if (scene !== p.scene) {
      if (scene !== 'hall') fortuneQueue.remove(p.id);
      p.scene = scene; p.x = p.tx = 0.5; p.z = p.tz = 0.8; p.dirty = true;
      io.emit('pscene', { id: p.id, scene, x: p.x, z: p.z });
    }
    if (typeof ack === 'function') ack({ ok: true });
  });
  socket.on('fortune:join', (_, ack) => {
    if (!p || typeof ack !== 'function') return;
    if (p.scene !== 'hall' || (p.place && p.place !== 'hall')) return ack({ ok: false, reason: 'Mời bạn vào chánh điện để xin xăm.' });
    const person = p;
    const ok = fortuneQueue.join({ id: p.id, name: p.name, deliver: number => person.socket.emit('fortune:result', { number }) });
    if (ok) { p.tx = 0.5; p.tz = 0.20; }
    ack({ ok, reason: ok ? '' : 'Bạn đã có tên trong hàng chờ.' });
  });
  socket.on('fortune:leave', () => { if (p) fortuneQueue.remove(p.id); });

  socket.on('profile', (data, ack) => {
    if (!p || !data || typeof ack !== 'function') return;
    if (!allow('profile', 3000)) return ack({ ok: false, reason: 'Đợi vài giây rồi đổi tiếp nhé.' });
    const nm = checkName(data.name, p.mod);
    if (!nm.ok) return ack({ ok: false, reason: nm.reason });
    p.name = nm.name;
    p.look = { g: data.look && data.look.g === 'nam' ? 'nam' : 'nu', c: num(data.look && data.look.c, 0, 11, 0) | 0, h: num(data.look && data.look.h, 0, 3, 0) | 0 };
    io.emit('pu', { id: p.id, name: p.name, look: p.look });
    ack({ ok: true });
  });

  socket.on('move', d => {
    if (!p || !d) return;
    p.tx = num(d.x, X_MIN, X_MAX, p.x);
    p.tz = num(d.z, Z_MIN, Z_MAX, p.z);
  });

  socket.on('chat', (d, ack) => {
    if (!p || !d) return;
    const reply = r => typeof ack === 'function' && ack(r);
    if (p.mutedUntil && p.mutedUntil > now()) return reply({ ok: false, reason: 'Bạn đang tạm bị khóa chat.' });
    if (!bucket('chat', 0.5, 3)) return reply({ ok: false, reason: 'Bạn gửi hơi nhanh. Đợi một chút rồi gửi tiếp nhé.' });
    const r = checkMessage(d.text, 300);
    if (!r.ok) return reply(r);
    if (r.text === p.lastText && !allow('same', 30000)) return reply({ ok: false, reason: 'Bạn vừa gửi tin này rồi.' });
    p.lastText = r.text;
    const pen = r.pen && r.pen.pts ? penalize(p, r.pen, 'chat') : 0;
    postChat(p, r.text, pen);
    reply({ ok: true, pen });
  });

  socket.on('report', d => {
    if (!p || !d) return;
    const m = db.chat.find(x => x.id === Number(d.id));
    if (!m || m.hidden || m.mod || m.sys) return;
    m.reports = m.reports || [];
    if (!m.reports.some(uid => accountOf(uid) === p.uid)) m.reports.push(p.uid);
    if (new Set(m.reports.map(accountOf)).size >= 3) hideMessage(m.id); else store.save();
    fail('Cảm ơn bạn. Ban điều hành sẽ xem tin nhắn này.');
  });

  socket.on('mod:hide', d => { if (p && p.mod && d) hideMessage(Number(d.id)); });
  socket.on('mod:mute', d => {
    if (!p || !p.mod || !d) return;
    const t = players.get(Number(d.pid));
    if (t && !t.mod) { t.mutedUntil = now() + 10 * 60e3; t.socket.emit('notice', { text: 'Bạn bị khóa chat 10 phút do vi phạm nội quy chánh điện.' }); }
  });

  socket.on('emote', d => {
    if (!p || !d) return;
    if (d.type === 'heart') {
      if (!bucket('heart', 4, 8)) return;
      bump('hearts'); addMerit(p, MERIT.heart);
      io.volatile.emit('emote', { pid: p.id, type: 'heart' });
    } else if (d.type === 'bow') {
      if (!allow('bow', 2500)) return;
      bump('bows'); addMerit(p, MERIT.bow);
      io.emit('emote', { pid: p.id, type: 'bow' });
    }
  });

  socket.on('mo', d => {
    if (!p || !d) return;
    const n = Math.min(5, Math.max(0, Number(d.n) | 0));
    let ok = 0;
    for (let i = 0; i < n; i++) if (bucket('mo', 4, 6)) ok++;   // tối đa ~4 tiếng mõ/giây được tính công đức
    if (ok) { bump('mo', ok); addMerit(p, MERIT.mo * ok); }
  });

  socket.on('bell', () => {
    if (!p) return;
    const t = now();
    if (!allow('bell', 10000)) return fail('Chuông vẫn đang ngân. Mỗi người thỉnh chuông cách nhau 10 giây.');
    if (t - lastGlobalBell < 2500) { p.cd.bell = 0; return fail('Có người vừa thỉnh chuông. Đợi tiếng chuông ngân hết rồi thỉnh tiếp nhé.'); }
    lastGlobalBell = t;
    bump('bells'); addMerit(p, MERIT.bell);
    io.emit('bell', { pid: p.id, name: p.name });
  });

  socket.on('incense', (d, ack) => {
    if (!p || !d) return;
    const reply = r => typeof ack === 'function' && ack(r);
    if (!allow('incense', 15000)) return reply({ ok: false, reason: 'Nén nhang trước vẫn đang cháy. Đợi 15 giây rồi thắp tiếp nhé.' });
    const sticks = Number(d.sticks) === 1 ? 1 : 3;
    const kind = KINDS.includes(d.kind) ? d.kind : 'Cầu an';
    let prayer = null;
    const who = d.anon ? 'Ẩn danh' : p.name;
    if (d.text && String(d.text).trim()) {
      const r = checkMessage(d.text, 200);
      if (!r.ok) { p.cd.incense = 0; return reply(r); }
      if (r.pen && r.pen.pts) penalize(p, r.pen, 'prayer');
      if (d.pub) {
        prayer = { id: store.nextId(), kind, text: r.text, name: who, t: now(), n: 0, by: [] };
        db.prayers.push(prayer); if (db.prayers.length > 300) db.prayers.splice(0, db.prayers.length - 300);
      }
    }
    const t = now(), items = [];
    for (let i = 0; i < sticks; i++) {
      const s = { id: store.nextId(), pid: p.id, x: +rand(-0.85, 0.85).toFixed(3), tilt: +rand(-0.08, 0.08).toFixed(3), litAt: t + 300 + i * 380, until: t + 300 + i * 380 + INCENSE_MINUTES * 60e3 };
      items.push(s); db.incense.push(s);
    }
    if (db.incense.length > 120) db.incense.splice(0, db.incense.length - 120);
    bump('incense', sticks); addMerit(p, MERIT.incense);
    io.emit('incense', { pid: p.id, name: who, kind, sticks: items });
    if (prayer) io.emit('prayer', publicPrayer(prayer));
    store.save();
    reply({ ok: true });
  });

  socket.on('offer', (d, ack) => {
    if (!p || !d || !ITEMS[d.item]) return;
    const reply = r => typeof ack === 'function' && ack(r);
    if (!allow('offer', 3000)) return reply({ ok: false, reason: 'Đợi vài giây rồi dâng tiếp nhé.' });
    bump(d.item); addMerit(p, MERIT.offer);
    io.emit('offer', { pid: p.id, name: p.name, item: d.item });
    reply({ ok: true });
  });

  socket.on('rejoice', d => {
    if (!p || !d) return;
    const pr = db.prayers.find(x => x.id === Number(d.id));
    if (!pr || pr.hidden || pr.by.some(uid => accountOf(uid) === p.uid)) return;
    pr.by.push(p.uid); pr.n++;
    addMerit(p, 1);
    io.emit('prayer:n', { id: pr.id, n: pr.n });
    store.save();
  });

  socket.on('chant:start', (d, ack) => {
    if (!p || !d) return;
    const reply = r => typeof ack === 'function' && ack(r);
    if (chant) return reply({ ok: false, reason: 'Đang có khóa tụng. Bạn bật tiếng để tụng cùng mọi người nhé.' });
    if (now() - lastChantEnd < 10000 && !p.mod) return reply({ ok: false, reason: 'Vừa xong một khóa tụng. Đợi ít giây rồi khởi tụng tiếp nhé.' });
    if (!allow('chant', 30000)) return reply({ ok: false, reason: 'Bạn vừa khởi tụng. Đợi một chút nhé.' });
    const id = String(d.track), tk = TRACKS[id];
    if (!tk) return reply({ ok: false, reason: 'Không có bài này.' });
    const startedAt = now() + 3500;
    chant = { track: id, title: tk.title, startedAt, endsAt: startedAt + Math.round(tk.duration * 1000), by: p.name };
    chantTimer = setTimeout(() => endChant(true), chant.endsAt - now());
    addMerit(p, MERIT.chantStart);
    io.emit('chant', chant);
    sys(`${p.name} khởi tụng “${tk.title}”. Mời đại chúng bật tiếng tụng cùng.`);
    reply({ ok: true });
  });
  socket.on('chant:stop', () => { if (p && p.mod) endChant(false); });

  socket.on('donate', async (d, ack) => {
    if (!p || !d || typeof ack !== 'function') return;
    if (!DONATION_ENABLED) return ack({ ok: false, reason: 'Nhà chùa chưa mở nhận tịnh tài trực tuyến.' });
    if (!allow('donate', 8000)) return ack({ ok: false, reason: 'Đợi vài giây rồi tạo mã mới nhé.' });
    const amount = Math.round(Number(d.amount));
    if (!Number.isFinite(amount) || amount < 10000) return ack({ ok: false, reason: 'Số tiền tối thiểu là 10.000đ.' });
    if (amount > 100000000) return ack({ ok: false, reason: 'Lượt trên 100 triệu đồng xin liên hệ trực tiếp nhà chùa.' });
    const fund = FUNDS.find(f => f.id === d.fund) || FUNDS[0];
    let note = '';
    if (d.note && String(d.note).trim()) { const r = checkMessage(d.note, 120); if (!r.ok) return ack(r); note = r.text; }
    let name = p.name;
    if (d.name && String(d.name).trim()) { const nm = checkName(d.name, p.mod); if (!nm.ok) return ack(nm); name = nm.name; }
    const don = addDonation({ amount, fund: fund.id, fundName: fund.name, name, anon: !!d.anon, hide: !!d.hide, aura: !d.anon && d.aura !== false, note, uid: p.uid });
    // mã đã có trong sổ chùa rồi mới đưa cho người cúng dường, để webhook / admin tìm thấy được
    if (!(await store.flush())) return ack({ ok: false, reason: 'Chưa lưu được mã cúng dường. Bạn thử lại sau ít giây nhé.' });
    ack(donationAck(don));
  });

  /* ----- Tàng Kinh Các: ai đang đọc kinh gì ----- */
  socket.on('reading', d => {
    if (!p) return;
    const b = d && BOOKS.find(x => x.id === d.book);
    const rd = b ? b.id : '';
    if (rd === p.rd || !bucket('read', 1, 5)) return;
    p.rd = rd;
    io.emit('prd', { id: p.id, rd });
    if (b && players.size <= 80 && allow('readTicker', 60000)) socket.broadcast.emit('ticker', { text: `${p.name} vào Tàng Kinh Các đọc “${b.title}”` });
  });

  /* ----- nói chuyện bằng giọng ----- */
  socket.on('voice:join', async (d, ack) => {
    if (!p || typeof ack !== 'function') return;
    if (!VOICE_ENABLED) return ack({ ok: false, reason: 'Nhà chùa chưa mở nói chuyện bằng giọng.' });
    if (p.voiceBanUntil > now()) return ack({ ok: false, reason: `Bạn đang bị khóa mic thêm ${Math.ceil((p.voiceBanUntil - now()) / 60e3)} phút.` });
    if (!p.v && voiceCount() >= VOICE_MAX) return ack({ ok: false, reason: 'Đang có quá nhiều người nói chuyện. Bạn đợi ít phút nhé.' });
    if (!bucket('voiceJoin', 0.2, 3)) return ack({ ok: false, reason: 'Đợi vài giây rồi thử lại nhé.' });
    const me = p;
    const ice = await iceServers();
    if (p !== me) return;                                   // đã rời chánh điện trong lúc chờ
    p.v = d && d.mic ? 2 : 1;
    io.emit('pv', { id: p.id, v: p.v });
    ack({ ok: true, ice });
  });
  socket.on('voice:mic', d => {
    if (!p || !p.v || !d || !bucket('voiceMic', 2, 6)) return;
    const v = d.on ? 2 : 1;
    if (v !== p.v) { p.v = v; io.emit('pv', { id: p.id, v }); }
  });
  socket.on('voice:leave', () => { if (p && p.v) { p.v = 0; io.emit('pv', { id: p.id, v: 0 }); } });
  socket.on('voice:signal', d => {
    if (!p || !p.v || !d || typeof d !== 'object' || !bucket('signal', 40, 160)) return;
    const t = players.get(Number(d.to)), s = d.s;
    if (!t || t === p || !t.v || !s || typeof s !== 'object') return;
    if (!['offer', 'answer', 'ice', 'bye'].includes(s.type)) return;
    let size = 0;
    try { size = JSON.stringify(s).length; } catch (e) { return; }
    if (size > 14000) return;
    t.socket.emit('voice:signal', { from: p.id, s });
  });
  socket.on('mod:voice', d => {
    if (!p || !p.mod || !d) return;
    const t = players.get(Number(d.pid));
    if (!t || t.mod) return;
    t.voiceBanUntil = now() + 10 * 60e3;
    t.socket.emit('voice:kicked', { text: 'Ban điều hành đã khóa mic của bạn 10 phút. Mời bạn giữ lời nói hiền hòa nơi cửa Phật.' });
    if (t.v) { t.v = 0; io.emit('pv', { id: t.id, v: 0 }); }
  });

  /* ----- các nơi: chánh điện, Võ Học Các, Sân đấu ----- */
  socket.on('place:set', (d, ack) => {
    if (!p || typeof ack !== 'function') return;
    const place = d && d.place;
    if (!PLACES.includes(place)) return ack({ ok: false, reason: 'Không có nơi này.' });
    if (place !== 'hall' && !bucket('place', 0.5, 5)) return ack({ ok: false, reason: 'Bạn đổi nơi hơi nhanh, đợi một chút nhé.' });   // về chánh điện luôn được
    if (place !== 'hall' && !MARTIAL_ENABLED) return ack({ ok: false, reason: 'Nơi này chưa mở.' });
    const info = { ok: true, place };
    if (place === 'arena') {
      if (!PK_ENABLED) return ack({ ok: false, reason: 'Sân đấu chưa mở.' });
      if (!accountReady(p)) return ack({ ok: false, code: 'login', reason: LOGIN_MSG });
      const prof = martial.profile(p.uid, true);
      socket.join('arena');
      arena.join(p.uid, { pid: p.id, name: p.name, look: p.look });
      if (prof.dnd) arena.setDnd(p.uid, true);
      info.arena = { players: arena.list(), dnd: !!prof.dnd, hasMatch: arena.hasMatch(p.uid), enabled: true };
    } else if (p.place === 'arena') {
      leaveArena(p, 'left');
    }
    if (place !== 'hall') fortuneQueue.remove(p.id);   // đi sang Võ Học Các / Sân đấu thì rời hàng chờ xin xăm
    p.place = place;
    io.emit('pplace', { id: p.id, place });
    ack(info);
  });

  /* ----- những gì được lưu theo tài khoản Google (cho màn "Tài khoản đã lưu") ----- */
  socket.on('account:summary', (d, ack) => {
    if (typeof d === 'function') { ack = d; d = {}; }
    if (!p || typeof ack !== 'function') return;
    if (!bucket('acct', 1, 4)) return ack({ ok: false, reason: 'Bạn tải hơi nhanh, đợi một chút nhé.' });
    const signedIn = !!auth.sessionFor(p.socket.data.authKey);
    const out = {
      ok: true, auth: { enabled: auth.enabled, signedIn },
      merit: meritOf(p.uid), donated: donatedBy(db, p.uid, accountOf), aura: myAura(p.uid), martial: null
    };
    if (MARTIAL_ENABLED && accountReady(p)) {
      const v = martial.view(p.uid);
      out.martial = {
        level: v.level, congLuc: v.congLuc, manaMax: v.manaMax, tam: v.tam, learned: v.learned.length, totalSkills: MARTIAL.SKILL_ORDER.length,
        wins: v.wins, losses: v.losses, draws: v.draws, vouchers: v.vouchers.length
      };
    }
    ack(out);
  });

  /* ----- tu luyện và học chiêu (Võ Học Các) ----- */
  const martialOnly = fn => (d, ack) => {
    if (typeof d === 'function') { ack = d; d = {}; }          // client chỉ truyền callback
    if (!p || typeof ack !== 'function') return;
    if (!MARTIAL_ENABLED) return ack({ ok: false, reason: 'Võ Học Các chưa mở.' });
    if (!accountReady(p)) return ack({ ok: false, code: 'login', reason: LOGIN_MSG });
    if (!bucket('martial', 6, 20)) return ack({ ok: false, reason: 'Bạn thao tác hơi nhanh, đợi một chút nhé.' });
    // dịch vụ kèm `updates` (phiên vừa xong theo giờ, đã hủy…): đẩy thành tu:update cho mọi tab rồi mới trả ack
    const done = r => {
      if (r && Array.isArray(r.updates)) { const { updates, ...rest } = r; for (const u of updates) emitToUid(p.uid, 'tu:update', u.update || u); return ack(rest); }
      return ack(r);
    };
    Promise.resolve(fn(d && typeof d === 'object' ? d : {}, done)).catch(e => { console.error('[martial]', e && e.stack || e); ack({ ok: false, reason: 'Có lỗi, bạn thử lại nhé.' }); });
  };
  socket.on('martial:state', (d, ack) => {
    if (typeof d === 'function') { ack = d; d = {}; }
    if (!p || typeof ack !== 'function') return;
    if (!MARTIAL_ENABLED) return ack({ ok: true, enabled: false });
    if (!bucket('mstate', 5, 15)) return ack({ ok: false, reason: 'Bạn tải hơi nhanh, đợi một chút nhé.' });
    if (!accountReady(p)) return ack(guestMartialState());
    const st = martial.state(p.uid);
    ack({ ...st, login: { required: auth.enabled, signedIn: !!auth.sessionFor(p.socket.data.authKey) } });
  });
  socket.on('tu:start', martialOnly(async (d, ack) => {
    const r = martial.start(p.uid, String(d.methodId || ''), String(d.duration || ''));
    ack(r);                       // ghi nền (không flush ngay): phiên chạy theo giờ máy chủ nên mất vài giây thay đổi không làm mất thưởng
  }));
  socket.on('tu:cancel', martialOnly(async (d, ack) => {
    ack(martial.cancel(p.uid, String(d.sessionId || '')));
  }));
  socket.on('tu:speedup', martialOnly(async (d, ack) => {
    const r = martial.speedup(p.uid, String(d.sessionId || ''), { anon: !!d.anon, name: p.name });
    if (!r.ok) return ack(r);
    await store.flush();
    const sess = db.martial.sessions[r.donation.sessionId] || {};
    ack({ ...donationAck(r.donation), existing: !!r.existing, methodName: (MARTIAL.METHODS[r.donation.methodId] || {}).name || '', durationKey: r.donation.durationKey, endsAt: sess.endsAt || null, updates: r.updates });
  }));
  socket.on('tu:speedup:cancel', martialOnly(async (d, ack) => {
    ack(martial.cancelSpeedup(p.uid, String(d.code || '')));
  }));
  socket.on('tu:voucher', martialOnly(async (d, ack) => {
    ack(martial.useVoucher(p.uid, String(d.voucherId || ''), String(d.sessionId || '')));
  }));
  socket.on('martial:seen', martialOnly((d, ack) => { martial.markSeen(p.uid, Array.isArray(d.ids) ? d.ids.slice(0, 20).map(String) : []); ack({ ok: true }); }));
  socket.on('vo:learn', martialOnly((d, ack) => { const r = martial.learn(p.uid, String(d.skillId || '')); if (r.ok) store.save(); ack(r); }));
  socket.on('vo:loadout', martialOnly((d, ack) => { const r = martial.setLoadout(p.uid, Array.isArray(d.skills) ? d.skills.slice(0, 8).map(String) : []); if (r.ok) store.save(); ack(r); }));

  /* ----- Sân đấu: danh sách người, mời, vào trận (chỉ người đang ở sân) ----- */
  const inArena = fn => (d, ack) => {
    if (typeof d === 'function') { ack = d; d = {}; }
    if (!p || typeof ack !== 'function') return;
    if (!PK_ENABLED) return ack({ ok: false, reason: 'Sân đấu chưa mở.' });
    if (p.place !== 'arena') return ack({ ok: false, code: 'place', reason: 'Bạn cần ra Sân đấu trước.' });
    if (!accountReady(p)) return ack({ ok: false, code: 'login', reason: LOGIN_MSG });
    if (!bucket('pk', 4, 10)) return ack({ ok: false, reason: 'Bạn thao tác hơi nhanh, đợi một chút nhé.' });
    try { fn(d && typeof d === 'object' ? d : {}, ack); } catch (e) { console.error('[arena]', e && e.stack || e); ack({ ok: false, reason: 'Có lỗi, bạn thử lại nhé.' }); }
  };
  socket.on('arena:dnd', inArena((d, ack) => {
    const on = !!d.on, prof = martial.profile(p.uid, true);
    prof.dnd = on; store.save();
    arena.setDnd(p.uid, on);
    ack({ ok: true, dnd: on });
  }));
  // Danh sách chặn gửi cho client là MÃ MỜ (HMAC), không bao giờ là uid thật: uid của khách là thứ gắn với công đức của họ.
  socket.on('arena:blocks', inArena((d, ack) => ack({ ok: true, list: martial.profile(p.uid, true).blocked.map(b => ({ uid: blockHandle(b.uid), name: b.name })) })));
  socket.on('pk:block', inArena((d, ack) => {
    const t = players.get(Number(d.pid));
    if (!t || t.uid === p.uid || t.place !== 'arena') return ack({ ok: false, reason: 'Không thấy người này ở sân.' });
    const prof = martial.profile(p.uid, true);
    if (!prof.blocked.some(b => b.uid === t.uid)) { prof.blocked.push({ uid: t.uid, name: t.name }); if (prof.blocked.length > 200) prof.blocked.shift(); store.save(); }
    ack({ ok: true });
  }));
  socket.on('pk:unblock', inArena((d, ack) => {
    const prof = martial.profile(p.uid, true), before = prof.blocked.length;
    prof.blocked = prof.blocked.filter(b => blockHandle(b.uid) !== String(d.uid || ''));
    if (prof.blocked.length !== before) store.save();
    ack({ ok: true });
  }));
  socket.on('pk:invite', inArena((d, ack) => ack(arena.invite(p.uid, Number(d.toPid), d.mode))));
  socket.on('pk:invite:cancel', inArena((d, ack) => ack(arena.cancelInvite(p.uid, d.inviteId))));
  socket.on('pk:respond', inArena((d, ack) => ack(arena.respond(p.uid, d.inviteId, !!d.accept))));
  socket.on('pk:loadout', inArena((d, ack) => ack(arena.setLoadout(p.uid, d.matchId, d.skills))));
  socket.on('pk:pick', inArena((d, ack) => ack(arena.pick(p.uid, d.matchId, d.turn, d.skillId))));
  socket.on('pk:forfeit', inArena((d, ack) => ack(arena.forfeit(p.uid, d.matchId))));
  socket.on('pk:resume', inArena((d, ack) => ack(arena.resume(p.uid))));

  socket.on('disconnect', () => {
    const ip = socket.data.ip, n = (ipCount.get(ip) || 1) - 1;
    if (n <= 0) ipCount.delete(ip); else ipCount.set(ip, n);
    if (p) {
      fortuneQueue.remove(p.id);
      if (p.place === 'arena' && arena) leaveArena(p, 'disconnect');
      players.delete(p.id); io.emit('pl', { id: p.id }); p = null;
    }
  });
});

/* ---------------- vòng lặp ---------------- */
let tick = 0, lastBoard = '';
function startLoops() {
setInterval(() => {
  const dt = 0.05;
  for (const p of players.values()) {
    const dx = p.tx - p.x, dz = p.tz - p.z, dist = Math.hypot(dx * X_WEIGHT, dz);
    if (dist > 0.001) {
      const step = SPEED * dt;
      if (step >= dist) { p.x = p.tx; p.z = p.tz; } else { p.x += dx * step / dist; p.z += dz * step / dist; }
      p.dirty = true;
    }
  }
  tick++;
  if (tick % 2 === 0) {
    const arr = [];
    for (const p of players.values()) if (p.dirty) { arr.push([p.id, Math.round(p.x * 1000), Math.round(p.z * 1000)]); p.dirty = false; }
    if (arr.length) io.volatile.emit('p', arr);
  }
  if (tick % 20 === 0) {
    for (const p of players.values()) {
      const authKey = p.socket.data.authKey;
      if (authKey && !auth.sessionFor(authKey)) { p.socket.disconnect(true); continue; }
      if (p.meritDirty) { p.meritDirty = false; p.socket.emit('merit', meritOf(p.uid)); }
      // mốc công đức chỉ gửi riêng cho người đạt mốc, sau khi thẻ công đức đã cập nhật
      if (p.milestone) { p.socket.emit('milestone', { at: p.milestone.at, kind: p.milestone.kind, today: Math.max(meritOf(p.uid).today, p.milestone.today) }); p.milestone = null; }
    }
    if (statsDirty) { statsDirty = false; io.emit('stats', { today: db.today, online: players.size }); }
  }
  if (tick % 100 === 0) {
    rollDay();
    const b = JSON.stringify(board());
    if (b !== lastBoard) { lastBoard = b; io.emit('board', JSON.parse(b)); }
    io.emit('stats', { today: db.today, online: players.size });
  }
  if (tick % 1200 === 0) {
    const t = now();
    auth.pruneSessions();
    db.incense = db.incense.filter(s => s.until > t);
    for (const k in db.auras) if (db.auras[k].until < t) delete db.auras[k];
    for (const d of db.donations) {
      if (d.status === 'pending' && t - d.createdAt > 24 * 3600e3) {
        d.status = 'expired';
        if (d.purpose === 'speedup' && martial) deliverUpdates(martial.onDonationClosed(d));
      }
    }
    if (martial) martial.prune();
    for (const [k, f] of authFails) if (f.until <= t) authFails.delete(k);
    store.save();
  }
}, 50);
// phiên tu luyện tới giờ: hoàn thành và báo cho người chơi (kể cả khi họ đã đóng web, lần sau vào sẽ thấy trong Võ Học Các)
setInterval(() => {
  try {
    for (const u of martial.sweep()) emitToUid(u.uid, 'tu:update', u.update);
  } catch (e) { console.error('[martial] sweep:', e && e.stack || e); }
}, MARTIAL_SWEEP_MS);
}

let closing = false;
async function shutdown() {
  if (closing) return;
  closing = true;
  try {
    if (arena) arena.shutdown();
    const saved = await Promise.race([store.close(), new Promise(r => setTimeout(() => r(false), 8000))]);   // Render chờ SIGTERM tối đa ~30 giây
    if (!saved) console.error('[store] Cảnh báo: chưa ghi nốt được thay đổi cuối trước khi tắt.');
  } catch (e) { console.error('[store] Lỗi khi tắt:', e && e.message); }
  process.exit(0);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

async function main() {
  await store.init();     // JSON: đọc file · Postgres: kết nối, nạp, nhập từ JSON nếu CSDL còn trống
  martial = createMartialService({
    db, store, now, vnDay,
    config: { timeScale: CULTIVATION_TIME_SCALE, speedupEnabled: SPEEDUP_ENABLED, speedupPerDay: SPEEDUP_PER_DAY },
    createSpeedupDonation: f => addDonation({
      amount: f.amount, fund: FUNDS[0].id, fundName: FUNDS[0].name, name: f.name, anon: !!f.anon, hide: false, aura: !f.anon,
      note: 'Hoàn thành tu luyện ngay', uid: f.uid, purpose: 'speedup', sessionId: f.sessionId, methodId: f.methodId, durationKey: f.durationKey, price: f.amount
    })
  });
  arena = createArenaManager({
    now, setTimer: (fn, ms) => setTimeout(fn, ms), clearTimer: h => clearTimeout(h),
    // gói pk:* chỉ gửi cho tab đang ở Sân đấu (tab chánh điện của cùng tài khoản không nhận)
    emit: (uid, ev, payload) => { for (const q of players.values()) if (q.uid === uid && q.place === 'arena') q.socket.emit(ev, payload); },
    emitRoom: (ev, payload) => io.to('arena').emit(ev, payload),
    isOnline: uid => { for (const q of players.values()) if (q.uid === uid) return true; return false; },
    fighterOf: uid => martial.pkIdentity(uid),
    buffInputsOf,
    recordResult: (uid, r) => martial.recordResult(uid, r),
    setActiveMatch: (uid, id) => { martial.profile(uid, true).activeMatch = id; store.save(); },
    getActiveMatch: uid => { const pr = martial.profile(uid, false); return pr ? pr.activeMatch || null : null; },
    saveMatch: rec => { db.martial.matches.push(rec); if (db.martial.matches.length > 150) db.martial.matches.splice(0, db.martial.matches.length - 150); store.save(); },
    isBlocked: (by, other) => { const pr = martial.profile(by, false); return !!(pr && pr.blocked.some(b => b.uid === other)); },
    newId: () => store.nextId(),
    log: (...a) => console.error('[arena]', ...a),
    config: { enabled: PK_ENABLED, maxMatches: PK_MAX_MATCHES, timeScale: PK_TIME_SCALE }
  });
  startLoops();
  server.listen(PORT, () => {
    console.log(`${SITE_NAME} đang chạy tại http://localhost:${PORT}`);
    console.log(`Cúng dường tịnh tài: ${DONATION_ENABLED ? 'BẬT (' + BANK.id + ')' : 'TẮT (chưa đặt BANK_ID / BANK_ACCOUNT)'} · Tự xác nhận SePay: ${SEPAY_API_KEY ? 'BẬT' : 'TẮT'} · Quản trị: ${ADMIN_KEY ? 'BẬT' : 'TẮT (chưa đặt ADMIN_KEY)'}`);
    console.log(`Nói chuyện bằng giọng: ${VOICE_ENABLED ? 'BẬT' : 'TẮT'} (TURN: ${CF_TURN.id ? 'Cloudflare' : TURN.urls.length ? 'tự cấu hình' : 'chưa có, chỉ STUN'}) · Giọng đọc thông báo: ${announce.enabled ? 'VieNeu “' + announce.voice + '” tại ' + announce.url : 'chưa đặt TTS_URL, trình duyệt tự đọc'}`);
    console.log(`Lưu trữ: ${store.backend === 'pg' ? 'PostgreSQL' : 'file JSON ' + store.FILE} · Võ Học Các: ${MARTIAL_ENABLED ? 'BẬT' : 'TẮT'} · Sân đấu: ${PK_ENABLED ? 'BẬT' : 'TẮT'} · Hoàn thành tu luyện ngay: ${SPEEDUP_ENABLED ? 'BẬT' : 'TẮT'}`);
  });
}
main().catch(e => { console.error('Không khởi động được máy chủ:', e && e.message || e); process.exit(1); });
