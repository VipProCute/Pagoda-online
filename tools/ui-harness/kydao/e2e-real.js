'use strict';
/*
 * Thử đầu-cuối Kỳ Đạo với MÁY CHỦ THẬT (server.js) và trang thật (index.html + app.js + kydao-ui.js):
 * hai trình duyệt Playwright (hai context riêng) là hai người chơi, một bot socket.io-client là người xem.
 *   node tools/ui-harness/kydao/e2e-real.js
 * Không cần chạy serve.js: tự mở server.js ở cổng trống (dữ liệu tạm), dùng test/helpers/live.js và client.js có sẵn.
 * Biến tùy chọn: PW_CHANNEL=chrome (dùng Chrome cài sẵn), SHOTS (thư mục ảnh), KEEP=1 (giữ trình duyệt mở khi trượt: không dùng).
 */
let pw;
try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }
const fs = require('fs');
const path = require('path');
const os = require('os');
const { startServer, sleep } = require('../../../test/helpers/live');
const { connect, call, join, waitFor } = require('../../../test/helpers/client');

const SHOTS = process.env.SHOTS || path.join(os.tmpdir(), 'kydao-e2e-shots');
fs.mkdirSync(SHOTS, { recursive: true });
const UID = { a: 'kd-e2e-uid-an-00001', b: 'kd-e2e-uid-binh-0001', c: 'kd-e2e-uid-xem-00001' };
const IGNORE = /Failed to load resource|favicon|fonts\.g|ERR_/;
const ADMIN = 'e2e-' + require('crypto').randomBytes(9).toString('hex');   // khóa quản trị thử, sinh mới mỗi lần chạy
const results = [];
const ctxs = [];

/** Nối socket của trang vào window.__sock và nhớ gameId mới nhất (để bước thử ép gửi kd:skin). */
const SOCK_HOOK = () => {
  let real;
  Object.defineProperty(window, 'io', {
    configurable: true,
    set(v) { real = v; },
    get() {
      if (!real) return real;
      const f = function (...a) { const s = real.apply(this, a); window.__sock = s; s.on('kd:start', p => { window.__gid = p && p.gameId; }); return s; };
      Object.assign(f, real);
      return f;
    }
  });
};
const PNG1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

/* ---------- trang ---------- */
async function newPlayer(browser, name) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
  ctxs.push(ctx);
  await ctx.addInitScript(SOCK_HOOK);
  await ctx.route('https://img.vietqr.io/**', r => r.fulfill({ status: 200, contentType: 'image/png', body: PNG1 }));   // không gọi ra ngoài
  const page = await ctx.newPage();
  page.who = name; page.errs = []; page.http5xx = [];
  page.on('console', m => { if (m.type() === 'error' && !IGNORE.test(m.text())) page.errs.push('console.error: ' + m.text()); });
  page.on('pageerror', e => page.errs.push('pageerror: ' + e.message));
  page.on('response', r => { if (r.status() >= 500) page.http5xx.push(r.status() + ' ' + r.url()); });
  return page;
}
async function enterYard(page, srv, name) {
  await page.goto(srv.url + '/', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#jName');
  await page.fill('#jName', name);
  await page.click('#joinBtn');
  await page.waitForSelector('.mapbar-btn[data-map="yard"]:not([hidden])', { timeout: 10000 });
  await page.click('.mapbar-btn[data-map="yard"]');
  await page.waitForFunction(() => Hall.tableSigns().length >= 4, null, { timeout: 8000 });
}
/** Chạm biển tên bàn đá trên canvas Sân chùa (đường chạm thật của người chơi): đi tới ghế trống và ngồi. */
async function tapTable(page, id) {
  const pt = await page.evaluate(i => {
    const s = Hall.tableSigns().find(x => x.id === i), c = document.querySelector('#hall').getBoundingClientRect();
    return s ? { x: c.left + s.x + s.w / 2, y: c.top + s.y + s.h / 2 } : null;
  }, id);
  if (!pt) throw new Error('không thấy biển bàn ' + id);
  await page.mouse.click(pt.x, pt.y);
}
async function lobbyOpen(page) { await page.waitForSelector('#dlg-kd-lobby[open]', { timeout: 8000 }); }
async function seatAndStart(A, B, table, game) {
  await tapTable(A, table); await lobbyOpen(A);
  await A.waitForFunction(i => Hall.tableSigns().length >= 4 && /Ghế|trống|Chờ|·/.test(document.querySelector('#kd-lobby-info').textContent), table);
  await tapTable(B, table); await lobbyOpen(B);
  // chủ bàn chọn luật bằng hộp thật: cờ vua/cờ tướng, giao hữu, nhanh
  await A.evaluate(g => {
    const r = (n, v) => { const e = document.querySelector(`input[name="${n}"][value="${v}"]`); e.checked = true; e.dispatchEvent(new Event('change', { bubbles: true })); };
    r('kd-game', g); r('kd-mode', 'friendly'); r('kd-pace', 'fast');
  }, game);
  await A.click('#kd-setup');
  await A.waitForFunction(() => !document.querySelector('#kd-ready').disabled, null, { timeout: 5000 });
  await B.waitForFunction(g => document.querySelector('#kd-lobby-note').textContent.length > 0 && !document.querySelector('#kd-ready').disabled, game, { timeout: 5000 });
  await A.click('#kd-ready');
  await B.waitForFunction(() => /Sẵn sàng/.test(document.querySelector('#kd-lobby-info').textContent) && document.querySelector('#kd-lobby-info').textContent.includes('· Sẵn sàng'), null, { timeout: 5000 });
  await B.click('#kd-ready');
  for (const p of [A, B]) await p.waitForSelector('.kd-panel:not([hidden])', { timeout: 8000 });
}
const shot = (pg, n) => pg.screenshot({ path: path.join(SHOTS, 'e2e-' + n + '.png') });

/** Chữ ký canvas: trung bình RGB nửa trên, nửa dưới, và băm toàn bộ điểm ảnh (để thấy hoạt ảnh theo thời gian). */
const sig = pg => pg.evaluate(() => {
  const c = document.querySelector('.kd-canvas'), g = c.getContext('2d'), w = c.width, h = c.height, d = g.getImageData(0, 0, w, h).data;
  const half = (y0, y1) => { let r = 0, gg = 0, b = 0, n = 0; for (let y = y0; y < y1; y += 2) for (let x = 0; x < w; x += 2) { const i = (y * w + x) * 4; r += d[i]; gg += d[i + 1]; b += d[i + 2]; n++; } return [r / n, gg / n, b / n]; };
  let hash = 0; for (let i = 0; i < d.length; i += 13) hash = (hash * 31 + d[i]) | 0;
  return { top: half(0, h >> 1), bot: half(h >> 1, h), hash, w, h };
});
const dist = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
const banner = pg => pg.waitForSelector('.kdfx-banner.is-on', { timeout: 3000 });

/* ---------- đi quân ---------- */
async function tapSquare(page, sq, flip) {
  const f = sq.charCodeAt(0) - 97, r = Number(sq[1]);
  const box = await page.$eval('.kd-canvas', e => { const b = e.getBoundingClientRect(); return { w: b.width, h: b.height }; });
  const cw = box.w / 8, ch = box.h / 8;
  const x = (flip ? 7 - f : f) * cw + cw / 2, y = (flip ? r - 1 : 8 - r) * ch + ch / 2;
  await page.locator('.kd-canvas').click({ position: { x, y } });
}
async function playMove(page, from, to, flip) {
  const n = await page.$eval('.kd-moves', e => e.textContent.length);
  await tapSquare(page, from, flip); await sleep(120);
  await tapSquare(page, to, flip);
  return n;
}

/* ---------- kịch bản ---------- */
function step(name, fn) {
  return (async () => {
    const t0 = Date.now();
    try { const detail = await fn(); results.push([true, name, detail || '']); console.log(`PASS  ${name}  (${((Date.now() - t0) / 1000).toFixed(1)}s)${detail ? ' ' + detail : ''}`); return true; }
    catch (e) { for (const p of stepPages) await p.screenshot({ path: path.join(SHOTS, 'fail-' + name.split('.')[0] + '-' + p.who + '.png') }).catch(() => {});
      results.push([false, name, String(e && e.message || e).split('\n')[0]]); console.log(`FAIL  ${name}\n      ${String(e && e.stack || e).split('\n').slice(0, 6).join('\n      ')}`); return false; }
  })();
}
const stepPages = [];
const ok = (c, m) => { if (!c) throw new Error(m); };

(async () => {
  const browser = await pw.chromium.launch({ channel: process.env.PW_CHANNEL || undefined, headless: true });
  let srv = null, C = null;
  try {
    srv = await startServer({ DONATION_MODE: 'test', ADMIN_KEY: ADMIN, BANK_ID: '970436', BANK_ACCOUNT: '0123456789', BANK_ACCOUNT_NAME: 'CHUA THU', SEPAY_API_KEY: '' });
    const A = await newPlayer(browser, 'An'), B = await newPlayer(browser, 'Bình');
    let before;
    stepPages.push(A, B);

    await step('1. A và B vào chùa, ra Sân chùa, ngồi bàn 1, chọn cờ vua giao hữu, sẵn sàng: cả hai thấy .kd-panel', async () => {
      await enterYard(A, srv, 'Diệu An'); await enterYard(B, srv, 'Diệu Bình');
      await shot(A, '01-san-chua');
      await seatAndStart(A, B, 1, 'chess');
      for (const p of [A, B]) { ok(await p.locator('.kd-panel').isVisible(), p.who + ': bảng cờ chưa hiện'); ok(await p.locator('.kd-canvas').isVisible(), p.who + ': thiếu canvas'); }
      ok((await A.textContent('.kd-title')).length > 0, 'bảng cờ không có tiêu đề');
      await sleep(600);
      before = { A: await sig(A), B: await sig(B) };
      await shot(A, '02-ban-co-A'); await shot(B, '02-ban-co-B');
    });

    await step('2. A mở Lãnh địa, chọn Hỏa Diệm Sơn + Dung Nham, Khai mở: A và B thấy khẩu hiệu; skin A đổi phía B', async () => {
      await A.click('.kd-actions .kd-btn:has-text("Lãnh địa")');
      await A.waitForSelector('.kd-skins:not([hidden]) .kd-skin[data-kind="field"][data-id="volcano"]');
      await A.click('.kd-skin[data-kind="field"][data-id="volcano"]');
      await A.click('.kd-skin[data-kind="pieces"][data-id="magma"]');
      await sleep(300);
      const open = A.locator('.kd-skins .kd-btn.kd-gold');
      ok(await open.isEnabled(), 'nút Khai mở bị khóa');
      const bannerB = banner(B), bannerA = banner(A);
      await open.click();
      await Promise.all([bannerA, bannerB]);
      await shot(A, '03-khai-mo-A'); await shot(B, '03-khai-mo-B-thay-khau-hieu');
      ok(/Hỏa Diệm Sơn|Khai mở|lãnh địa|lửa/i.test(await B.textContent('.kdfx-banner')), 'khẩu hiệu B: ' + await B.textContent('.kdfx-banner'));
      await sleep(3500);   // chờ khẩu hiệu tắt rồi mới lấy mẫu nền
      const now = { A: await sig(A), B: await sig(B) };
      // A là Trắng: nửa A là nửa dưới ở phía A, nửa trên ở phía B (bị lật)
      const dB = dist(before.B.top, now.B.top), dBother = dist(before.B.bot, now.B.bot), dA = dist(before.A.bot, now.A.bot);
      ok(dB > 4, `canvas phía B không đổi ở nửa của A (độ lệch ${dB.toFixed(1)})`);
      ok(dA > 4, `canvas phía A không đổi ở nửa của mình (độ lệch ${dA.toFixed(1)})`);
      before.A2 = now.A; before.B2 = now.B;
      return `độ lệch: nửa A nhìn từ B ${dB.toFixed(1)}, nửa B nhìn từ B ${dBother.toFixed(1)}, nửa A nhìn từ A ${dA.toFixed(1)}`;
    });

    await step('3. B khai mở sân khác (Trường Giang): A thấy khẩu hiệu', async () => {
      await B.click('.kd-actions .kd-btn:has-text("Lãnh địa")');
      await B.waitForSelector('.kd-skins:not([hidden]) .kd-skin[data-kind="field"][data-id="river"]');
      await B.click('.kd-skin[data-kind="field"][data-id="river"]');
      await sleep(200);
      const bannerA = banner(A);
      await B.click('.kd-skins .kd-btn.kd-gold');
      await bannerA;
      await shot(A, '04-doi-thu-khai-mo-A-thay-khau-hieu');
      await sleep(3500);
      before.A3 = await sig(A);
      ok(dist(before.A2.top, before.A3.top) > 4, 'nửa B phía A không đổi sau khi B khai mở');
    });

    await step('4. A bật "Ẩn skin đối thủ": canvas A đổi (nửa B về mặc định), B không bị ảnh hưởng', async () => {
      const bB0 = await sig(B);
      await A.click('.kd-actions .kd-btn:has-text("Lãnh địa")');
      await A.waitForSelector('.kd-skins:not([hidden])');
      await A.click('.kd-skins .kd-btn:has-text("Ẩn skin đối thủ")');
      await A.waitForSelector('.kd-skins .kd-btn:has-text("Hiện skin đối thủ")');
      await A.click('.kd-actions .kd-btn:has-text("Lãnh địa")');     // đóng bảng để cỡ canvas như lúc lấy mẫu trước
      await sleep(900);
      const a = await sig(A), bB1 = await sig(B);
      const toDefault = dist(before.A2.top, a.top), fromWithB = dist(before.A3.top, a.top);
      ok(fromWithB > 4, `canvas A không đổi sau khi ẩn (độ lệch ${fromWithB.toFixed(1)})`);
      ok(toDefault < fromWithB, 'nửa B của A phải gần mặc định hơn lúc B có skin');
      const bDiff = Math.max(dist(bB0.top, bB1.top), dist(bB0.bot, bB1.bot));
      ok(bDiff < 12, `canvas B bị ảnh hưởng (độ lệch ${bDiff.toFixed(1)})`);
      await shot(A, '05-A-an-skin-doi-thu');
      return `nửa B của A: lệch so với trước khi B khai mở ${toDefault.toFixed(1)}, so với lúc B có skin ${fromWithB.toFixed(1)}; B lệch ${bDiff.toFixed(1)}`;
    });

    await step('5. A khai mở lần hai ngay: khóa 20 giây hiện chữ "giây", ép gửi thì máy chủ từ chối, không lỗi console', async () => {
      await A.click('.kd-actions .kd-btn:has-text("Lãnh địa")');
      await A.waitForSelector('.kd-skins:not([hidden]) .kd-skin[data-kind="field"][data-id="glacier"]');
      await A.click('.kd-skin[data-kind="field"][data-id="glacier"]');
      await sleep(300);
      const open = A.locator('.kd-skins .kd-btn.kd-gold');
      ok(await open.isDisabled(), 'nút Khai mở lẽ ra phải bị khóa trong 20 giây');
      const note = await A.textContent('.kd-skin-note');
      ok(/giây/.test(note), 'dòng đếm ngược thiếu chữ giây: ' + note);
      // ép gửi lên máy chủ để kiểm máy chủ từ chối thật
      await A.evaluate(() => { const b = document.querySelector('.kd-skins .kd-btn.kd-gold'); b.disabled = false; b.click(); });
      await A.waitForFunction(() => /giây/.test(document.querySelector('.kd-msg').textContent), null, { timeout: 4000 });
      const msg = await A.textContent('.kd-msg');
      await shot(A, '06-khai-mo-lai-bi-tu-choi');
      return 'đếm ngược: "' + note + '"; máy chủ: "' + msg + '"';
    });

    await step('6. Người xem C (bot, kd:watch) nhận kd:start có skins đúng của cả hai bên', async () => {
      C = await connect(srv.port);
      const j = await join(C, 'Xem', UID.c); ok(j.ok, 'C vào chùa');
      ok((await call(C, 'scene', 'yard')).ok, 'C ra sân');
      const start = waitFor(C, 'kd:start');
      const r = await call(C, 'kd:watch', { table: 1 }); ok(r.ok, 'watch: ' + r.reason);
      const s = await start;
      ok(s.skins && s.skins.a.field === 'volcano' && s.skins.a.pieces === 'magma', 'skins A của C: ' + JSON.stringify(s.skins));
      ok(s.skins.b.field === 'river', 'skins B của C: ' + JSON.stringify(s.skins));
      return JSON.stringify(s.skins);
    });

    await step('7. Đi vài nước qua canvas (e4 e5 Nf3 Nc6), A đầu hàng + xác nhận: cả hai thấy khẩu hiệu thắng rồi .kd-result', async () => {
      await sleep(300);
      const turns = [[A, 'e2', 'e4', false], [B, 'e7', 'e5', true], [A, 'g1', 'f3', false], [B, 'b8', 'c6', true]];
      for (const [p, f, t, flip] of turns) {
        const n = await playMove(p, f, t, flip);
        await A.waitForFunction(k => document.querySelector('.kd-moves').textContent.length > k, n, { timeout: 6000 });
        await B.waitForFunction(k => document.querySelector('.kd-moves').textContent.length > k, n, { timeout: 6000 });
      }
      ok(C.log.filter(x => x.ev === 'kd:moved').length === 4, 'C phải thấy 4 nước, thấy ' + C.log.filter(x => x.ev === 'kd:moved').length);
      await shot(A, '07-sau-bon-nuoc');
      await A.click('.kd-actions .kd-danger');
      await A.click('.kd-confirm .kd-danger');
      await Promise.all([banner(A), banner(B)]);
      await shot(B, '08-khau-hieu-thang-B');
      await Promise.all([A, B].map(p => p.waitForSelector('.kd-result:not([hidden])', { timeout: 8000 })));
      ok(/thắng|thua|Đen|Trắng/i.test(await B.textContent('.kd-result')), 'bảng kết quả B: ' + await B.textContent('.kd-result'));
      await shot(A, '09-bang-ket-qua-A'); await shot(B, '09-bang-ket-qua-B');
      return 'kết quả B: ' + (await B.textContent('.kd-result-head')).trim();
    });

    await step('8. Cờ tướng: mở ván, A khai mở, canvas đổi theo thời gian (sông chảy), đầu hàng', async () => {
      for (const p of [A, B]) await p.click('.kd-result .kd-btn:has-text("Rời bàn")');
      for (const p of [A, B]) await p.waitForSelector('.kd-panel', { state: 'hidden', timeout: 5000 });
      await sleep(600);
      await seatAndStart(A, B, 3, 'xiangqi');
      await sleep(500);
      await A.click('.kd-actions .kd-btn:has-text("Lãnh địa")');
      await A.waitForSelector('.kd-skins:not([hidden]) .kd-skin[data-kind="field"][data-id="river"]');
      await A.click('.kd-skin[data-kind="field"][data-id="river"]');
      await sleep(250);
      const bannerB = banner(B);
      await A.click('.kd-skins .kd-btn.kd-gold');
      await bannerB;
      await sleep(3500);
      const hs = [];
      for (let i = 0; i < 5; i++) { hs.push((await sig(B)).hash); await sleep(350); }
      ok(new Set(hs).size >= 2, 'canvas không đổi theo thời gian: ' + hs.join(','));
      await shot(B, '10-co-tuong-song-B');
      await B.click('.kd-actions .kd-danger'); await B.click('.kd-confirm .kd-danger');
      await Promise.all([A, B].map(p => p.waitForSelector('.kd-result:not([hidden])', { timeout: 8000 })));
      await shot(A, '11-co-tuong-ket-qua-A');
      return `${new Set(hs).size}/5 mẫu băm khác nhau`;
    });

    await step('9. Không pageerror, không console.error, không HTTP >= 500 (cả hai trang và máy chủ)', async () => {
      const errs = [...A.errs.map(e => 'A ' + e), ...B.errs.map(e => 'B ' + e), ...A.http5xx.map(e => 'A ' + e), ...B.http5xx.map(e => 'B ' + e)];
      ok(!errs.length, errs.slice(0, 4).join(' | '));
      const serverErr = srv.logs.join('').split('\n').filter(l => /error|exception|unhandled/i.test(l) && !/EADDRINUSE/.test(l));
      ok(!serverErr.length, 'nhật ký máy chủ có lỗi: ' + serverErr.slice(0, 2).join(' | '));
    });

    /* ===== Đợt 2: bộ đá cờ vây/caro và khóa skin ===== */
    const shopApi = (method, body) => fetch(srv.url + '/api/admin/kydao-shop', { method, headers: { 'x-admin-key': ADMIN, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
      .then(async r => ({ status: r.status, json: await r.json().catch(() => null) }));
    const money = /20\.000\s*đ/;
    const panelOpen = async (p, label) => {
      if (await p.locator('.kd-skins:not([hidden])').count() === 0) await p.click(`.kd-actions .kd-btn:has-text("${label}")`);
      await p.waitForSelector('.kd-skins:not([hidden])');
    };
    const panelClose = async (p, label) => {
      if (await p.locator('.kd-skins:not([hidden])').count()) await p.click(`.kd-actions .kd-btn:has-text("${label}")`);
      await p.waitForSelector('.kd-skins', { state: 'hidden' });
    };
    /** Màu trung bình quanh tâm bàn (giao điểm giữa) của canvas caro. */
    const centreAvg = pg => pg.evaluate(() => {
      const c = document.querySelector('.kd-canvas'), g = c.getContext('2d'), cell = c.width / 16, r = Math.round(cell * 0.35);
      const cx = Math.round(c.width / 2), cy = Math.round(c.height / 2), d = g.getImageData(cx - r, cy - r, 2 * r, 2 * r).data;
      let R = 0, G = 0, Bl = 0, n = 0; for (let i = 0; i < d.length; i += 4) { R += d[i]; G += d[i + 1]; Bl += d[i + 2]; n++; }
      return [R / n, G / n, Bl / n];
    });
    const leaveTable = async () => {
      for (const p of [A, B]) await p.click('.kd-result .kd-btn:has-text("Rời bàn")');
      for (const p of [A, B]) await p.waitForSelector('.kd-panel', { state: 'hidden', timeout: 5000 });
      await sleep(600);
    };

    await step('10. Caro: A chọn bộ đá Tinh Hà (không có nút Khai mở), đặt quân: canvas B đổi khi hiện/ẩn skin của A', async () => {
      await leaveTable();
      await seatAndStart(A, B, 2, 'gomoku');
      await sleep(500);
      await panelOpen(A, 'Bộ đá');
      await A.waitForSelector('.kd-skin[data-kind="pieces"][data-id="cosmos"]');
      ok(await A.locator('.kd-skins .kd-btn.kd-gold').count() === 0, 'bộ chọn bộ đá không được có nút Khai mở');
      ok(await A.locator('.kd-skin.is-locked').count() === 0, 'cửa hàng tắt: không được có mục khóa');
      const ids = await A.$$eval('.kd-skin[data-kind="pieces"]', e => e.map(x => x.dataset.id).filter(Boolean));
      ok(ids.length === 8, 'phải có 8 bộ đá, thấy ' + ids.length);
      await A.click('.kd-skin[data-kind="pieces"][data-id="cosmos"]');
      await sleep(500);
      await shot(A, '12-caro-bo-da-A');
      await panelClose(A, 'Bộ đá');
      const h0 = (await sig(B)).hash;
      await A.locator('.kd-canvas').click({ position: { x: (await A.$eval('.kd-canvas', e => e.getBoundingClientRect().width)) / 2, y: (await A.$eval('.kd-canvas', e => e.getBoundingClientRect().height)) / 2 } });
      await B.waitForFunction(h => { const c = document.querySelector('.kd-canvas'), g = c.getContext('2d'), d = g.getImageData(0, 0, c.width, c.height).data; let x = 0; for (let i = 0; i < d.length; i += 13) x = (x * 31 + d[i]) | 0; return x !== h; }, h0, { timeout: 6000 });
      await sleep(1200);
      const withSkin = await centreAvg(B);
      await panelOpen(B, 'Bộ đá');
      await B.click('.kd-skins .kd-btn:has-text("Ẩn skin đối thủ")');
      await panelClose(B, 'Bộ đá');
      await sleep(600);
      const noSkin = await centreAvg(B);
      await shot(B, '13-caro-B-an-skin');
      const d = dist(withSkin, noSkin);
      ok(d > 12, `quân của A trên canvas B không đổi giữa lúc hiện và ẩn skin (độ lệch ${d.toFixed(1)}): ${withSkin.map(Math.round)} / ${noSkin.map(Math.round)}`);
      await shot(B, 'caro-da');
      await A.click('.kd-actions .kd-danger'); await A.click('.kd-confirm .kd-danger');
      await Promise.all([A, B].map(p => p.waitForSelector('.kd-result:not([hidden])', { timeout: 8000 })));
      return `màu quân A tại tâm bàn (nhìn từ B): có skin ${withSkin.map(Math.round)}, ẩn skin ${noSkin.map(Math.round)}, độ lệch ${d.toFixed(1)}`;
    });

    let withMagicB = null;
    await step('11. Bật cửa hàng qua API quản trị giữa ván cờ vua: nửa sân của A trên cả hai trang về mặc định', async () => {
      await leaveTable();
      // B bật lại hiện skin đối thủ cho các bước sau (đã ẩn ở bước 10)
      await seatAndStart(A, B, 1, 'chess');
      await sleep(500);
      await panelOpen(B, 'Lãnh địa');
      await B.click('.kd-skins .kd-btn:has-text("Hiện skin đối thủ")');
      await panelClose(B, 'Lãnh địa');
      await panelOpen(A, 'Lãnh địa');
      await A.click('.kd-skin[data-kind="field"][data-id="volcano"]');
      await sleep(200);
      const bannerB = banner(B);
      await A.click('.kd-skins .kd-btn.kd-gold');
      await bannerB;
      await sleep(3500);
      const skinned = { A: await sig(A), B: await sig(B) };
      const r0 = await shopApi('GET');
      ok(r0.status === 200 && r0.json.config.on === false, 'cửa hàng lẽ ra tắt lúc đầu: ' + JSON.stringify(r0.json && r0.json.config));
      const r = await shopApi('POST', { price: 20000, on: true });
      ok(r.status === 200 && r.json.ok && r.json.config.on === true && r.json.config.price === 20000, 'bật cửa hàng: ' + r.status + ' ' + JSON.stringify(r.json));
      await sleep(2200);
      const after = { A: await sig(A), B: await sig(B) };
      const dB = dist(skinned.B.top, after.B.top), dA = dist(skinned.A.bot, after.A.bot);
      const toDefB = dist(before.B.top, after.B.top);
      ok(dB > 4, `canvas B không đổi sau khi bật cửa hàng (độ lệch ${dB.toFixed(1)})`);
      ok(dA > 4, `canvas A không đổi sau khi bật cửa hàng (độ lệch ${dA.toFixed(1)})`);
      ok(toDefB < dB, `nửa của A trên B chưa về mặc định (cách mặc định ${toDefB.toFixed(1)}, cách lúc có skin ${dB.toFixed(1)})`);
      await shot(B, '14-cua-hang-bat-B');
      return `độ lệch khi bật: B ${dB.toFixed(1)}, A ${dA.toFixed(1)}; nửa của A trên B cách mặc định ${toDefB.toFixed(1)}`;
    });

    await step('12. A mở Lãnh địa: mục khóa hiện "20.000 đ"; bấm quân Dung Nham: khung xác nhận, rồi khung QR đúng số tiền và mã CD…', async () => {
      await panelOpen(A, 'Lãnh địa');
      await A.waitForSelector('.kd-skin.is-locked', { timeout: 5000 });
      const total = await A.locator('.kd-skin[data-id]:not([data-id=""])').count(), locked = await A.locator('.kd-skin.is-locked').count();
      ok(locked === total && total > 0, `mọi skin phải khóa (khóa ${locked}/${total})`);
      ok(await A.locator('.kd-skin[data-id=""].is-locked').count() === 0, 'mục Mặc định không được khóa');
      const price = await A.textContent('.kd-skin.is-locked .kd-skin-price');
      ok(money.test(price), 'giá hiện: ' + price);
      withMagicB = await sig(B);
      await A.click('.kd-skin[data-kind="pieces"][data-id="magma"]');
      await A.waitForSelector('.kd-buy');
      ok(/Cúng dường\s+20\.000\s*đ/.test(await A.textContent('.kd-buy')), 'khung xác nhận thiếu giá: ' + await A.textContent('.kd-buy'));
      await A.click('.kd-buy .kd-gold');
      await A.waitForSelector('.kd-buy-qr', { timeout: 6000 });
      const src = await A.getAttribute('.kd-buy-qr', 'src');
      ok(src.startsWith('https://img.vietqr.io/'), 'src QR: ' + src);
      const txt = await A.textContent('.kd-buy');
      ok(money.test(txt), 'khung QR thiếu số tiền: ' + txt);
      const code = (txt.match(/CD[A-Z0-9]{6}/) || [])[0];
      ok(code, 'khung QR thiếu mã CD…: ' + txt);
      await shot(A, 'khoa-skin');
      return `giá "${price.trim()}", mã ${code}`;
    });

    await step('13. Chế độ thử tự xác nhận: khung QR đóng, A hết khóa mục đó, quân A đổi trên canvas B; B vẫn khóa', async () => {
      await A.waitForFunction(() => !document.querySelector('.kd-buy') && !document.querySelector('.kd-skin[data-kind="pieces"][data-id="magma"].is-locked'), null, { timeout: 20000 });
      await sleep(1000);
      ok(await A.locator('.kd-skin[data-kind="pieces"][data-id="magma"].is-locked').count() === 0, 'A vẫn thấy khóa');
      ok(await A.locator('.kd-skin[data-kind="field"][data-id="river"].is-locked').count() === 1, 'skin sân khác của A phải vẫn khóa (mỗi skin mở riêng)');
      await shot(A, 'mo-khoa-xong');
      await panelClose(A, 'Lãnh địa');
      const nowB = await sig(B);
      ok(nowB.hash !== withMagicB.hash, 'canvas B không đổi khi A có quân Dung Nham');
      await panelOpen(B, 'Lãnh địa');
      ok(await B.locator('.kd-skin[data-kind="pieces"][data-id="magma"].is-locked').count() === 1, 'B phải vẫn thấy Dung Nham bị khóa');
      await panelClose(B, 'Lãnh địa');
      return `độ lệch canvas B (quân A): trên ${dist(withMagicB.top, nowB.top).toFixed(1)}, dưới ${dist(withMagicB.bot, nowB.bot).toFixed(1)}`;
    });

    await step('14. B ép gửi kd:skin chưa mở: máy chủ trả code:locked; bấm mục khóa thì giao diện B hiện khung mua', async () => {
      const gid = await B.evaluate(() => window.__gid);
      ok(gid, 'không nắm được gameId của B');
      const ack = await B.evaluate(g => new Promise(res => window.__sock.emit('kd:skin', { gameId: g, pieces: 'magma' }, res)), gid);
      ok(ack && ack.ok === false && ack.code === 'locked', 'ack: ' + JSON.stringify(ack));
      ok(ack.kind === 'pieces' && ack.id === 'magma' && ack.price === 20000, 'ack thiếu kind/id/price: ' + JSON.stringify(ack));
      await panelOpen(B, 'Lãnh địa');
      await B.click('.kd-skin[data-kind="pieces"][data-id="magma"]');
      await B.waitForSelector('.kd-buy');
      ok(/Cúng dường\s+20\.000\s*đ/.test(await B.textContent('.kd-buy')), 'khung mua của B: ' + await B.textContent('.kd-buy'));
      await B.click('.kd-buy .kd-ghost');
      await panelClose(B, 'Lãnh địa');
      return 'máy chủ: ' + ack.reason;
    });

    await step('15. Tắt cửa hàng: cả hai hết khóa; A vẫn sở hữu (stats.unlocks >= 1)', async () => {
      const r = await shopApi('POST', { on: false });
      ok(r.status === 200 && r.json.config.on === false, 'tắt cửa hàng: ' + r.status + ' ' + JSON.stringify(r.json));
      for (const p of [A, B]) {
        await panelOpen(p, 'Lãnh địa');
        await p.waitForFunction(() => !document.querySelector('.kd-skin.is-locked'), null, { timeout: 5000 });
        await panelClose(p, 'Lãnh địa');
      }
      const v = await shopApi('GET');
      ok(v.status === 200 && v.json.stats.unlocks >= 1, 'thống kê: ' + JSON.stringify(v.json && v.json.stats));
      return 'thống kê: ' + JSON.stringify(v.json.stats);
    });

    await step('16. Suốt các bước mới: không pageerror, không console.error, không HTTP >= 500, máy chủ không lỗi', async () => {
      const errs = [...A.errs.map(e => 'A ' + e), ...B.errs.map(e => 'B ' + e), ...A.http5xx.map(e => 'A ' + e), ...B.http5xx.map(e => 'B ' + e)];
      ok(!errs.length, errs.slice(0, 4).join(' | '));
      const serverErr = srv.logs.join('').split('\n').filter(l => /error|exception|unhandled/i.test(l) && !/EADDRINUSE/.test(l));
      ok(!serverErr.length, 'nhật ký máy chủ có lỗi: ' + serverErr.slice(0, 2).join(' | '));
    });
  } catch (e) {
    console.error('Lỗi dựng kịch bản:', e); results.push([false, 'dựng kịch bản', String(e && e.message || e)]);
  } finally {
    if (C) try { C.close(); } catch (e) { /* bỏ qua */ }
    for (const c of ctxs) await c.close().catch(() => {});
    await browser.close().catch(() => {});
    if (srv) await srv.stop().catch(() => {});
  }
  console.log('\nBước | Kết quả | Chi tiết');
  for (const [pass, name, detail] of results) console.log(`${pass ? 'ĐẠT ' : 'TRƯỢT'} | ${name}${detail ? ' | ' + detail : ''}`);
  const bad = results.filter(r => !r[0]);
  console.log(`\n${results.length - bad.length}/${results.length} bước đạt. Ảnh chụp: ${SHOTS}`);
  if (bad.length) process.exitCode = 1;
})();
