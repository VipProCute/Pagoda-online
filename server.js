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
const { clean, checkMessage, checkName, rulesSummary } = require('./lib/moderation');
const AURA = require('./public/js/aura');
const MERITS = require('./public/js/merit');
const announce = require('./lib/announce');
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

const MERIT = MERITS.EARN;   // thắp nhang +10, dâng lễ +5, … ; cúng dường +1 cho mỗi 1.000đ
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
const db = store.load();
function rollDay() {
  const d = vnDay();
  if (db.day !== d) { db.day = d; db.today = store.COUNTERS(); statsDirty = true; store.save(); }
}
let statsDirty = true;
function bump(key, n = 1) { rollDay(); db.today[key] += n; db.total[key] += n; statsDirty = true; store.save(); }
function addMerit(p, n) { addMeritUid(p.uid, p.name, n); }
/** Cộng (hoặc trừ, n < 0) công đức theo uid; người đang có mặt thì cập nhật hình ảnh cho cả chánh điện. */
function addMeritUid(uid, name, n) {
  const d = vnDay();
  let m = db.merit[uid];
  if (!m) m = db.merit[uid] = { name, total: 0, today: 0, day: d };
  if (m.day !== d) { m.day = d; m.today = 0; }
  const before = m.total;
  m.name = name; m.total += n; m.today += n;
  store.save();
  for (const p of players.values()) {
    if (p.uid !== uid) continue;
    p.meritDirty = true;
    const key = MERITS.visualKey(m.total);
    if (key !== p.mkey) {
      p.mkey = key;
      const up = MERITS.rankOf(m.total) > MERITS.rankOf(before);
      io.emit('pm', { id: p.id, mt: m.total, up });
    }
  }
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
app.get('/healthz', (req, res) => res.json({ ok: true, online: players.size, voice: voiceCount() }));
app.get('/api/config', (req, res) => res.json(clientConfig()));
app.get('/api/announce/:id', (req, res) => {
  const c = announce.get(req.params.id);
  if (!c) return res.status(404).end();
  res.set('Cache-Control', 'public, max-age=1800').type(c.type).send(c.buf);
});

function clientConfig() {
  return {
    penaltyRules: PENALTY_RULES, meritPerVnd: MERITS.EARN.perVnd,
    siteName: SITE_NAME,
    incenseMinutes: INCENSE_MINUTES,
    donation: DONATION_ENABLED ? { bank: BANK.label, account: BANK.account, accountName: BANK.name, funds: FUNDS.map(f => ({ id: f.id, name: f.name })) } : null,
    tracks: TRACKS,
    kinds: KINDS,
    voice: VOICE_ENABLED,
    tts: announce.enabled
  };
}

/* ----- webhook SePay: tự xác nhận khi tài khoản chùa nhận tiền ----- */
app.post('/api/webhooks/sepay', (req, res) => {
  if (!SEPAY_API_KEY) return res.status(404).json({ success: false });
  const key = String(req.get('authorization') || '').replace(/^Apikey\s+/i, '').trim();
  if (!safeEqual(key, SEPAY_API_KEY)) return res.status(401).json({ success: false });
  const b = req.body || {};
  if (b.transferType && b.transferType !== 'in') return res.json({ success: true });
  const content = String(b.content || '') + ' ' + String(b.description || '') + ' ' + String(b.code || '');
  const codes = content.toUpperCase().replace(/[^A-Z0-9]/g, ' ').match(/CD[A-Z0-9]{6}/g) || [];
  const amount = Number(b.transferAmount) || 0;
  const d = codes.map(c => db.donations.find(x => x.code === c && x.status === 'pending')).find(Boolean);
  if (!d) return res.json({ success: true, matched: false });
  if (amount < d.amount) return res.json({ success: true, matched: false, reason: 'amount_too_low' });
  confirmDonation(d, { amount, ref: String(b.referenceCode || b.id || ''), source: 'sepay' });
  res.json({ success: true, matched: true });
});

/* ----- quản trị ----- */
function admin(req, res, next) {
  if (!ADMIN_KEY) return res.status(503).json({ error: 'Chưa đặt ADMIN_KEY trên máy chủ.' });
  if (!safeEqual(req.get('x-admin-key') || '', ADMIN_KEY)) return res.status(401).json({ error: 'Sai mã quản trị.' });
  next();
}
app.get('/api/admin/summary', admin, (req, res) => {
  res.json({
    online: players.size, today: db.today, total: db.total, funds: fundsSummary(), donationEnabled: DONATION_ENABLED,
    donations: db.donations.slice(-300).reverse(),
    chat: db.chat.slice(-150).reverse().map(m => ({ ...publicMsg(m), hidden: !!m.hidden, reports: (m.reports || []).length, pen: m.pen || 0 })),
    prayers: db.prayers.slice(-100).reverse().map(p => ({ ...publicPrayer(p), hidden: !!p.hidden })),
    chant, voice: voiceCount(), tts: announce.enabled ? announce.voice : null,
    auras: Object.entries(db.auras).filter(([, a]) => a.tier && a.until > now())
      .map(([, a]) => ({ name: a.name, tier: a.tier, tierName: AURA.TIERS[a.tier - 1].name, amount: a.amount, until: a.until }))
      .sort((a, b) => b.tier - a.tier)
  });
});
app.post('/api/admin/donations/:code/confirm', admin, (req, res) => {
  const d = db.donations.find(x => x.code === req.params.code);
  if (!d) return res.status(404).json({ error: 'Không thấy mã này.' });
  if (d.status === 'confirmed') return res.json({ ok: true });
  const a = confirmDonation(d, { amount: d.amount, ref: 'admin', source: 'admin' });
  res.json({ ok: true, aura: a ? { tier: a.tier, tierName: a.tier ? AURA.TIERS[a.tier - 1].name : '', up: a.up, amount: a.amount, until: a.until } : null });
});
app.post('/api/admin/donations/:code/cancel', admin, (req, res) => {
  const d = db.donations.find(x => x.code === req.params.code);
  if (!d) return res.status(404).json({ error: 'Không thấy mã này.' });
  if (d.status === 'pending') { d.status = 'cancelled'; store.save(); }
  res.json({ ok: true });
});
app.post('/api/admin/chat/:id/hide', admin, (req, res) => { hideMessage(Number(req.params.id)); res.json({ ok: true }); });
app.post('/api/admin/prayers/:id/hide', admin, (req, res) => {
  const p = db.prayers.find(x => x.id === Number(req.params.id));
  if (p) { p.hidden = true; io.emit('prayer:hide', { id: p.id }); store.save(); }
  res.json({ ok: true });
});
app.post('/api/admin/announce', admin, (req, res) => {
  const text = clean((req.body || {}).text, 300);
  if (!text) return res.status(400).json({ error: 'Nội dung trống.' });
  postChat({ pid: 0, uid: 'admin', name: 'Ban điều hành', c: 3, mod: true }, text);
  res.json({ ok: true });
});
app.post('/api/admin/chant/stop', admin, (req, res) => { endChant(false); res.json({ ok: true }); });

const server = http.createServer(app);
const io = new Server(server, { maxHttpBufferSize: 16e3, pingInterval: 20000, pingTimeout: 25000 });

/* ---------------- trạng thái phòng ---------------- */
const players = new Map();     // pid -> player
const ipCount = new Map();
let nextPid = 1;
let chant = null, chantTimer = null, lastChantEnd = 0, lastGlobalBell = 0;

const publicPlayer = p => ({ id: p.id, name: p.name, look: p.look, x: +p.x.toFixed(3), z: +p.z.toFixed(3), mod: p.mod, v: p.v || 0, rd: p.rd || '', au: auraOf(p.uid), mt: meritTotal(p.uid) });
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
  d.status = 'confirmed'; d.confirmedAt = now(); d.paidAmount = info.amount; d.ref = info.ref; d.source = info.source;
  if (info.amount > d.amount) d.amount = info.amount;
  // Hào quang: cộng dồn theo người cúng dường (ẩn danh hoặc tự tắt thì không hiện)
  let aura = null;
  if (!d.anon && d.aura !== false) {
    aura = AURA.stack(db.auras[d.uid], d.amount, now());
    db.auras[d.uid] = { amount: aura.amount, tier: aura.tier, until: aura.until, name: d.name };
    d.auraTier = aura.tier;
  }
  const tierInfo = aura && aura.tier ? AURA.TIERS[aura.tier - 1] : null;
  // Công đức: mỗi 1.000đ đã xác nhận là 1 điểm
  const gain = Math.floor(d.amount / MERITS.EARN.perVnd);
  if (gain > 0) { addMeritUid(d.uid, d.name, gain); d.merit = gain; }
  store.save();
  io.emit('donation', { d: publicDonation(d), funds: fundsSummary() });
  sys(`${d.anon ? 'Một Phật tử ẩn danh' : d.name} vừa cúng dường tịnh tài cho quỹ “${d.fundName}”. Tùy hỷ công đức.`);
  for (const p of players.values()) {
    if (p.uid !== d.uid) continue;
    p.socket.emit('donation:ok', { code: d.code, amount: d.amount, fund: d.fundName, merit: gain, aura: aura && { ...myAura(d.uid), up: aura.up } });
    if (aura) io.emit('aura', { pid: p.id, au: auraOf(p.uid), up: aura.up });
  }
  // Đọc thông báo: soạn câu, nhờ VieNeu đọc (nếu có), rồi phát cho cả chánh điện
  const msg = announce.compose(d, aura, tierInfo);
  const base = { text: msg.text, speak: msg.speak, tier: aura && aura.up ? aura.tier : 0 };
  announce.speak(msg.speak).then(r => io.emit('announce', { ...base, audio: r.audio }));
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
    for (const p of players.values()) addMerit(p, MERIT.chantJoin);
    sys(`Khóa tụng “${title}” đã viên mãn. Hồi hướng công đức đến tất cả chúng sinh.`);
  } else sys(`Khóa tụng “${title}” đã dừng.`);
}

/* ---------------- kết nối ---------------- */
io.use((socket, next) => {
  const fwd = socket.handshake.headers['x-forwarded-for'];
  const ip = (process.env.TRUST_PROXY !== '0' && fwd ? String(fwd).split(',')[0].trim() : socket.handshake.address) || 'x';
  const n = ipCount.get(ip) || 0;
  if (n >= MAX_CONN_PER_IP) return next(new Error('Quá nhiều kết nối từ cùng một mạng.'));
  ipCount.set(ip, n + 1);
  socket.data.ip = ip;
  next();
});

io.on('connection', socket => {
  let p = null;
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
    const isMod = !!(ADMIN_KEY && data.adminKey && safeEqual(String(data.adminKey), ADMIN_KEY));
    const nm = checkName(data.name, isMod);
    if (!nm.ok) return ack({ ok: false, reason: nm.reason });
    const uid = /^[a-zA-Z0-9_-]{8,40}$/.test(String(data.uid || '')) ? String(data.uid) : crypto.randomUUID();
    p = {
      id: nextPid++, uid, name: nm.name, mod: isMod, socket,
      look: { g: data.look && data.look.g === 'nam' ? 'nam' : 'nu', c: num(data.look && data.look.c, 0, 11, 0) | 0, h: num(data.look && data.look.h, 0, 3, 0) | 0 },
      x: 0.5 + rand(-0.28, 0.28), z: rand(0.68, 0.92), tx: 0, tz: 0, dirty: false, cd: {}, bk: {}, lastText: '', meritDirty: false,
      v: 0, rd: '', voiceBanUntil: 0
    };
    p.tx = p.x; p.tz = p.z;
    p.mkey = MERITS.visualKey(meritTotal(uid));
    players.set(p.id, p);
    socket.data.pid = p.id;
    rollDay(); bump('visits');
    ack({
      ok: true, you: p.id, uid, serverTime: now(), config: clientConfig(),
      players: [...players.values()].map(publicPlayer),
      chat: db.chat.filter(m => !m.hidden).slice(-60).map(publicMsg),
      prayers: db.prayers.filter(x => !x.hidden).slice(-40).map(publicPrayer),
      incense: activeIncense().slice(-60),
      today: db.today, total: db.total, online: players.size,
      board: board(), merit: meritOf(uid), aura: myAura(uid),
      donations: db.donations.filter(d => d.status === 'confirmed').slice(-20).map(publicDonation),
      funds: fundsSummary(), chant
    });
    socket.broadcast.emit('pj', publicPlayer(p));
    if (players.size <= 80) socket.broadcast.emit('ticker', { text: `${p.name} vừa vào chánh điện` });
  });

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
    if (!m.reports.includes(p.uid)) m.reports.push(p.uid);
    if (m.reports.length >= 3) hideMessage(m.id); else store.save();
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
    if (!pr || pr.hidden || pr.by.includes(p.uid)) return;
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

  socket.on('donate', (d, ack) => {
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
    const code = makeCode();
    const don = { code, amount, fund: fund.id, fundName: fund.name, name, anon: !!d.anon, hide: !!d.hide, aura: !d.anon && d.aura !== false, note, uid: p.uid, status: 'pending', createdAt: now() };
    db.donations.push(don);
    if (db.donations.length > 3000) db.donations.splice(0, db.donations.length - 3000);
    store.save();
    const qr = `https://img.vietqr.io/image/${encodeURIComponent(BANK.id)}-${encodeURIComponent(BANK.account)}-compact2.png?amount=${amount}&addInfo=${encodeURIComponent(code)}&accountName=${encodeURIComponent(BANK.name)}`;
    ack({ ok: true, code, amount, fund: fund.name, qr, bank: BANK.label, account: BANK.account, accountName: BANK.name, auto: !!SEPAY_API_KEY });
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

  socket.on('disconnect', () => {
    const ip = socket.data.ip, n = (ipCount.get(ip) || 1) - 1;
    if (n <= 0) ipCount.delete(ip); else ipCount.set(ip, n);
    if (p) { players.delete(p.id); io.emit('pl', { id: p.id }); p = null; }
  });
});

/* ---------------- vòng lặp ---------------- */
let tick = 0, lastBoard = '';
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
    for (const p of players.values()) if (p.meritDirty) { p.meritDirty = false; p.socket.emit('merit', meritOf(p.uid)); }
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
    db.incense = db.incense.filter(s => s.until > t);
    for (const k in db.auras) if (db.auras[k].until < t) delete db.auras[k];
    for (const d of db.donations) if (d.status === 'pending' && t - d.createdAt > 24 * 3600e3) d.status = 'expired';
    store.save();
  }
}, 50);

function shutdown() { store.flush(); process.exit(0); }
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

server.listen(PORT, () => {
  console.log(`${SITE_NAME} đang chạy tại http://localhost:${PORT}`);
  console.log(`Cúng dường tịnh tài: ${DONATION_ENABLED ? 'BẬT (' + BANK.id + ')' : 'TẮT (chưa đặt BANK_ID / BANK_ACCOUNT)'} · Tự xác nhận SePay: ${SEPAY_API_KEY ? 'BẬT' : 'TẮT'} · Quản trị: ${ADMIN_KEY ? 'BẬT' : 'TẮT (chưa đặt ADMIN_KEY)'}`);
  console.log(`Nói chuyện bằng giọng: ${VOICE_ENABLED ? 'BẬT' : 'TẮT'} (TURN: ${CF_TURN.id ? 'Cloudflare' : TURN.urls.length ? 'tự cấu hình' : 'chưa có, chỉ STUN'}) · Giọng đọc thông báo: ${announce.enabled ? 'VieNeu “' + announce.voice + '” tại ' + announce.url : 'chưa đặt TTS_URL, trình duyệt tự đọc'}`);
});
