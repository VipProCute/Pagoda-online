'use strict';
/*
 * CHỈ DÙNG TRONG TEST. Nạp trước vào tiến trình máy chủ thử bằng NODE_OPTIONS=--require <file này>.
 * Bọc fetch toàn cục: yêu cầu đổi mã tại https://oauth2.googleapis.com/token không đi ra mạng mà trả ID token giả,
 * để test e2e đi hết luồng đăng nhập Google mà không cần Google thật. Mọi URL khác chuyển cho fetch gốc.
 * Mã `code` do test tạo = base64url(JSON { nonce, sub }). Tuyệt đối không được chạy ngoài test: ném lỗi ngay nếu NODE_ENV khác 'test'.
 */
if (process.env.NODE_ENV !== 'test') {
  throw new Error('fake-google.js chỉ được nạp khi NODE_ENV=test.');
}

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const b64 = v => Buffer.from(typeof v === 'string' ? v : JSON.stringify(v)).toString('base64url');
const realFetch = globalThis.fetch;

globalThis.fetch = async function fakeGoogleFetch(input, init) {
  const url = typeof input === 'string' ? input : (input && input.href) || (input && input.url) || '';
  if (url !== TOKEN_URL) return realFetch(input, init);
  const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  let nonce, sub;
  try {
    const code = new URLSearchParams(String(init && init.body)).get('code');
    ({ nonce, sub } = JSON.parse(Buffer.from(code, 'base64url').toString('utf8')));
  } catch (e) {
    return json(400, { error: 'invalid_grant' });
  }
  if (typeof nonce !== 'string' || typeof sub !== 'string') return json(400, { error: 'invalid_grant' });
  const now = Math.floor(Date.now() / 1000);
  const claims = { iss: 'https://accounts.google.com', aud: process.env.GOOGLE_CLIENT_ID, nonce, sub, iat: now, exp: now + 300 };
  return json(200, { id_token: `${b64({ alg: 'none', typ: 'JWT' })}.${b64(claims)}.${b64('x')}` });
};
