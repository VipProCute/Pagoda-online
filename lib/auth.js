'use strict';

const crypto = require('crypto');
const store = require('./store');

const CALLBACK = '/api/auth/google/callback';
const FLOW_MS = 10 * 60 * 1000;
const SESSION_MS = 30 * 24 * 60 * 60 * 1000;
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const ORIGIN = process.env.AUTH_ORIGIN;
const enabled = Boolean(CLIENT_ID && CLIENT_SECRET && ORIGIN);
const secure = enabled && ORIGIN.startsWith('https://');

if (enabled) {
  const url = new URL(ORIGIN);
  const loopback = url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.origin !== ORIGIN || (!secure && !loopback)) {
    throw new Error('AUTH_ORIGIN phải là origin HTTPS, hoặc HTTP localhost để chạy thử (không có dấu / cuối).');
  }
} else if (CLIENT_ID || CLIENT_SECRET || ORIGIN) {
  console.warn('[auth] Cần đủ GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET và AUTH_ORIGIN để bật đăng nhập Google.');
}

const prefix = secure ? '__Host-' : '';
const SESSION = prefix + 'ta-session';
const FLOW = prefix + 'ta-google-flow';
const COOKIE = { path: '/', httpOnly: true, secure, sameSite: 'lax' };
const random = () => crypto.randomBytes(32).toString('base64url');
const digest = value => crypto.createHash('sha256').update(value).digest('base64url');
const sign = value => crypto.createHmac('sha256', CLIENT_SECRET).update('pagoda-google-flow:' + value).digest('base64url');

function guestId(value) {
  return typeof value === 'string' && /^[a-zA-Z0-9_-]{8,40}$/.test(value) && !(value in Object.prototype) ? value : null;
}

function cookie(headers, name) {
  const entry = (headers.cookie || '').split(';').map(part => part.trim()).find(part => part.startsWith(name + '='));
  return entry ? entry.slice(name.length + 1) : '';
}

function sessionFor(key) {
  const session = key && store.get().authSessions[key];
  return session && session.until > Date.now() ? session : null;
}

function sessionKey(headers) {
  if (!enabled || (headers.origin && headers.origin !== ORIGIN)) return null;
  const token = cookie(headers, SESSION);
  if (!/^[\w-]{43}$/.test(token)) return null;
  const key = digest(token);
  return sessionFor(key) ? key : null;
}

function readFlow(headers) {
  const [value, mac, extra] = cookie(headers, FLOW).split('.');
  if (!value || !mac || extra !== undefined || !/^[\w-]{43}$/.test(mac)) return null;
  if (!crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(sign(value)))) return null;
  const flow = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
  return flow.until > Date.now() ? flow : null;
}

async function googleAccount(code, flow) {
  // Chỉ nhận ID token qua kết nối HTTPS trực tiếp đến máy chủ Google (OIDC Core §3.1.3.7).
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    redirect: 'error',
    signal: AbortSignal.timeout(10000),
    body: new URLSearchParams({
      code,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: ORIGIN + CALLBACK,
      grant_type: 'authorization_code',
      code_verifier: flow.verifier
    })
  });
  if (!response.ok) throw new Error('Google từ chối mã đăng nhập.');
  const { id_token: token } = await response.json();
  if (typeof token !== 'string' || !/^[\w-]+\.[\w-]+\.[\w-]+$/.test(token)) throw new Error('Thiếu ID token của Google.');
  const claims = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
  const now = Date.now() / 1000;
  if (!['https://accounts.google.com', 'accounts.google.com'].includes(claims.iss) ||
      claims.aud !== CLIENT_ID || (claims.azp !== undefined && claims.azp !== CLIENT_ID) ||
      claims.nonce !== flow.nonce || !Number.isFinite(claims.exp) || claims.exp <= now ||
      !Number.isFinite(claims.iat) || claims.iat > now + 60 ||
      typeof claims.sub !== 'string' || !/^[\x21-\x7e]{1,255}$/.test(claims.sub)) {
    throw new Error('Thông tin xác thực Google không hợp lệ.');
  }
  // Không gian khóa riêng, trình duyệt không thể tự khai qua uid của khách.
  return 'google:' + digest(claims.sub);
}

function mount(app, { linkGuest, onGuestLinked, onLogout }) {
  app.use('/api/auth', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    res.set('Referrer-Policy', 'no-referrer');
    next();
  });
  app.get('/api/auth/session', (req, res) => res.json({ enabled, signedIn: Boolean(sessionKey(req.headers)) }));
  if (!enabled) return;

  app.post('/api/auth/google', (req, res) => {
    if (req.get('origin') !== ORIGIN) return res.sendStatus(403);
    if (sessionKey(req.headers)) return res.sendStatus(409);
    const flow = {
      state: random(), nonce: random(), verifier: random(),
      guest: guestId(req.body?.guest), until: Date.now() + FLOW_MS
    };
    const value = Buffer.from(JSON.stringify(flow)).toString('base64url');
    res.cookie(FLOW, value + '.' + sign(value), { ...COOKIE, maxAge: FLOW_MS });
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.search = new URLSearchParams({
      client_id: CLIENT_ID, redirect_uri: ORIGIN + CALLBACK, response_type: 'code',
      scope: 'openid profile', prompt: 'select_account', state: flow.state, nonce: flow.nonce,
      code_challenge: digest(flow.verifier), code_challenge_method: 'S256'
    });
    res.json({ url: url.href });
  });

  app.get(CALLBACK, async (req, res) => {
    const flow = readFlow(req.headers);
    if (!flow || req.query.state !== flow.state) return res.redirect(303, '/?auth=error');
    res.clearCookie(FLOW, COOKIE);
    if (typeof req.query.code !== 'string' || !req.query.code) return res.redirect(303, '/?auth=error');
    if (sessionKey(req.headers)) return res.redirect(303, '/');
    let uid;
    try {
      uid = await googleAccount(req.query.code, flow);
    } catch {
      console.warn('[auth] Không hoàn tất được xác thực Google.');
      return res.redirect(303, '/?auth=error');
    }
    const token = random(), key = digest(token);
    const sessions = store.get().authSessions;
    const undoLink = flow.guest && linkGuest(flow.guest, uid);
    sessions[key] = { uid, until: Date.now() + SESSION_MS };
    if (!store.flush()) {
      delete sessions[key];
      if (undoLink) undoLink();
      store.save();
      return res.redirect(303, '/?auth=error');
    }
    res.cookie(SESSION, token, { ...COOKIE, maxAge: SESSION_MS });
    res.redirect(303, '/?auth=ok');
    if (undoLink) onGuestLinked(flow.guest, uid);
  });

  app.post('/api/auth/logout', (req, res) => {
    if (req.get('origin') !== ORIGIN) return res.sendStatus(403);
    const key = sessionKey(req.headers);
    if (key) {
      const sessions = store.get().authSessions;
      const session = sessions[key];
      delete sessions[key];
      if (!store.flush()) {
        sessions[key] = session;
        store.save();
        return res.sendStatus(503);
      }
    }
    res.clearCookie(SESSION, COOKIE).clearCookie(FLOW, COOKIE).sendStatus(204);
    if (key) onLogout(key);
  });
}

function pruneSessions() {
  const sessions = store.get().authSessions;
  const now = Date.now();
  for (const [key, session] of Object.entries(sessions)) {
    if (session.until <= now) delete sessions[key];
  }
}

module.exports = { enabled, guestId, mount, sessionFor, sessionKey, pruneSessions };
