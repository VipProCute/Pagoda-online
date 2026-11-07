'use strict';
/*
 * Đăng nhập Google bảo lưu dữ liệu: khách vãng lai không dùng được Võ Học Các / Sân đấu, còn tài khoản thì
 * công đức, tịnh tài đã cúng dường, nội công, chiêu đã học… đều còn nguyên sau khi khởi động lại.
 * Không đi qua Google thật: phiên đăng nhập được ghi sẵn vào file dữ liệu rồi gửi bằng cookie.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, freePort } = require('./helpers/live');
const { connect, call, join } = require('./helpers/client');

const digest = v => crypto.createHash('sha256').update(v).digest('base64url');
const M = require('../public/js/martial');

test('đăng nhập Google: công đức, tịnh tài, nội công, võ công được bảo lưu; khách thì không dùng được võ học', async t => {
  const port = await freePort();
  const token = crypto.randomBytes(32).toString('base64url');
  const acct = 'google:test-abc123', oldGuest = 'khach-cu-00001';
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chua-auth-'));
  const dataFile = path.join(dir, 'db.json');
  const day = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
  fs.writeFileSync(dataFile, JSON.stringify({
    version: 2, day,
    authSessions: { [digest(token)]: { uid: acct, until: Date.now() + 864e5 } },
    linkedGuests: { [oldGuest]: acct },
    merit: { [acct]: { name: 'Dieu Lien', total: 321, today: 21, day } },
    donations: [
      { code: 'CDAAAAAA', uid: acct, amount: 50000, fund: 'q0', fundName: 'Quy', name: 'Dieu Lien', status: 'confirmed', createdAt: 1, confirmedAt: 2 },
      { code: 'CDBBBBBB', uid: oldGuest, amount: 20000, fund: 'q0', fundName: 'Quy', name: 'Dieu Lien', status: 'confirmed', createdAt: 3, confirmedAt: 4 },
      { code: 'CDCCCCCC', uid: acct, amount: 99000, fund: 'q0', fundName: 'Quy', name: 'Dieu Lien', status: 'cancelled', createdAt: 5 }
    ],
    martial: {
      profiles: { [acct]: { uid: acct, congLuc: 195, tam: { cuong: 100, toc: 0, nhu: 0 }, learned: [...M.STARTERS, 'kim-chung-trao'], loadout: [], activeSession: null, activeMatch: null, vouchers: [], wins: 2, losses: 1, draws: 0, dnd: false, blocked: [], createdAt: 1 } },
      sessions: {}, ledger: {}, matches: [], audit: []
    }
  }));
  const env = { PORT: String(port), DATA_FILE: dataFile, GOOGLE_CLIENT_ID: 'id-thu', GOOGLE_CLIENT_SECRET: 'bi-mat-thu', AUTH_ORIGIN: `http://127.0.0.1:${port}`, CULTIVATION_TIME_SCALE: '1' };
  const srv = await startServer(env);
  t.after(() => srv.stop());
  const open = [];
  t.after(() => open.forEach(s => s.close()));
  const as = async (name, uid, cookie) => {
    const socket = await connect(port, cookie ? { extraHeaders: { cookie: 'ta-session=' + token } } : {});
    open.push(socket);
    return { socket, join: await join(socket, name, uid) };
  };

  // --- khách vãng lai ---
  const g = await as('Khach Ghe Tham', 'khach-moi-00001', false);
  assert.equal(g.join.ok, true);
  assert.deepEqual(g.join.auth, { enabled: true, signedIn: false });
  assert.equal(g.join.config.martial.loginRequired, true);
  const gs = await call(g.socket, 'martial:state', {});
  assert.equal(gs.login.signedIn, false);
  assert.equal(gs.login.required, true);
  assert.equal(gs.profile.congLuc, 0);
  assert.equal((await call(g.socket, 'tu:start', { methodId: 'tinh-tam-quyet', duration: '4h' })).code, 'login');
  assert.equal((await call(g.socket, 'vo:learn', { skillId: 'khinh-than-bo' })).code, 'login');
  assert.equal((await call(g.socket, 'place:set', { place: 'arena' })).code, 'login');
  const gsum = await call(g.socket, 'account:summary', {});
  assert.equal(gsum.auth.signedIn, false);
  assert.equal(gsum.martial, null);
  assert.equal(gsum.donated.count, 0);

  // --- tài khoản đã đăng nhập ---
  let a = await as('Dieu Lien', 'khach-cu-00001', true);
  assert.equal(a.join.auth.signedIn, true);
  assert.equal(a.join.merit.total, 321, 'công đức theo tài khoản');
  let sum = await call(a.socket, 'account:summary', {});
  assert.equal(sum.merit.total, 321);
  assert.equal(sum.donated.count, 2, 'tính cả lượt cúng dường lúc còn là khách, bỏ lượt đã hủy');
  assert.equal(sum.donated.total, 70000);
  assert.equal(sum.martial.level, 3);
  assert.equal(sum.martial.congLuc, 195);
  assert.equal(sum.martial.learned, M.STARTERS.length + 1);
  assert.equal(sum.martial.wins, 2);
  const st = await call(a.socket, 'martial:state', {});
  assert.equal(st.login.signedIn, true);
  assert.ok(st.profile.learned.includes('kim-chung-trao'));
  const s1 = await call(a.socket, 'tu:start', { methodId: 'kim-cuong-tam-phap', duration: '8h' });
  assert.ok(s1.ok, s1.reason);
  assert.ok((await call(a.socket, 'place:set', { place: 'arena' })).ok, 'tài khoản đăng nhập ra được sân đấu');

  // --- khởi động lại: mọi thứ còn nguyên, cookie đăng nhập vẫn dùng được ---
  a.socket.close();
  await srv.restart();
  a = await as('Dieu Lien', 'khach-cu-00001', true);
  assert.equal(a.join.auth.signedIn, true);
  assert.equal(a.join.merit.total, 321);
  sum = await call(a.socket, 'account:summary', {});
  assert.equal(sum.donated.total, 70000);
  assert.equal(sum.martial.congLuc, 195);
  const st2 = await call(a.socket, 'martial:state', {});
  assert.equal(st2.session.id, s1.session.id, 'phiên đang tu vẫn còn sau khi máy chủ khởi động lại');
  assert.ok(st2.session.endsAt > Date.now());
});
