'use strict';
/*
 * Kiểm tra tự động giao diện Sân đấu bằng trình duyệt thật (Playwright), dùng máy chủ giả trong harness.js.
 *   node tools/ui-harness/serve.js 4174 &        (chạy máy chủ tĩnh)
 *   node tools/ui-harness/arena/gen-fixtures.js  (một lần, sinh fixtures.json từ engine thật)
 *   node tools/ui-harness/arena/ui-check.js      (ảnh chụp lưu ở $SHOTS, mặc định thư mục tạm)
 * Mỗi kiểm tra mở trang mới, và cuối kiểm tra bắt buộc không có lỗi hay cảnh báo trong console.
 */
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const M = require('../../../public/js/martial');
const FX = require('./fixtures.json');

const BASE = `http://127.0.0.1:${process.env.PORT || 4174}/harness/arena/index.html`;
const SHOTS = process.env.SHOTS || path.join(os.tmpdir(), 'arena-shots');
fs.mkdirSync(SHOTS, { recursive: true });
const CTX = {
  mobile: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true },
  m740: { viewport: { width: 390, height: 740 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true },
  m640: { viewport: { width: 360, height: 640 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true },
  desk: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 },
  reduced: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true, reducedMotion: 'reduce' },
  nohall: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true }
};
// theo dõi hẹn giờ còn sống để kiểm tra hide() dừng hết
const TRACK = `(() => {
  window.__iv = new Set(); window.__raf = new Set();
  const si = window.setInterval, ci = window.clearInterval, raf = window.requestAnimationFrame, caf = window.cancelAnimationFrame;
  window.setInterval = (f, ms, ...a) => { const id = si(f, ms, ...a); window.__iv.add(id); return id; };
  window.clearInterval = id => { window.__iv.delete(id); ci(id); };
  window.requestAnimationFrame = cb => { const id = raf(t => { window.__raf.delete(id); cb(t); }); window.__raf.add(id); return id; };
  window.cancelAnimationFrame = id => { window.__raf.delete(id); caf(id); };
})();`;

const browser = { b: null, ctxs: {} };
const results = [];
async function ctxOf(kind) {
  if (browser.ctxs[kind]) return browser.ctxs[kind];
  const c = await browser.b.newContext(CTX[kind]);
  if (kind === 'nohall') await c.route('**/js/hall.js', r => r.abort());
  return (browser.ctxs[kind] = c);
}
async function open(kind, qs) {
  const pg = await (await ctxOf(kind)).newPage();
  pg.errs = [];
  pg.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') pg.errs.push(m.type() + ': ' + m.text()); });
  pg.on('pageerror', e => pg.errs.push('pageerror: ' + e.message));
  await pg.addInitScript(TRACK);
  await pg.goto(BASE + '?nopanel=1' + (qs || ''));
  await pg.waitForFunction(() => window.__ready);
  return pg;
}
async function t(name, kind, fn, qs) {
  if (process.env.ONLY && !name.includes(process.env.ONLY)) return;   // ONLY="pk:turn TRƯỚC" để chạy riêng một kiểm tra
  const t0 = Date.now();
  let pg;
  try {
    pg = await open(kind, qs);
    await fn(pg);
    assert.deepEqual(pg.errs, [], 'có lỗi / cảnh báo trong console');
    results.push([true, name, Date.now() - t0]);
    console.log(`PASS  ${name}  (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  } catch (e) {
    results.push([false, name, Date.now() - t0, e]);
    console.log(`FAIL  ${name}\n      ${String(e && e.message || e).split('\n').slice(0, 6).join('\n      ')}`);
    try { if (pg) await pg.screenshot({ path: path.join(SHOTS, 'FAIL-' + name.replace(/[^a-z0-9]+/gi, '_').slice(0, 40) + '.png') }); } catch (x) { /* bỏ qua */ }
  } finally { if (pg) await pg.close().catch(() => {}); }
}

/* ---------- trợ giúp ---------- */
const sent = (pg, ev) => pg.evaluate(e => H.socket.sent.filter(s => s.event === e).map(s => s.data), ev);
const toasts = pg => pg.evaluate(() => H.toasts.slice());
const shot = (pg, n) => pg.screenshot({ path: path.join(SHOTS, n + '.png') });
const text = (pg, sel) => pg.$eval(sel, e => e.textContent);
const count = (pg, sel) => pg.locator(sel).count();
const vis = (pg, sel) => pg.locator(sel).first().isVisible();
const waitText = (pg, sel, re, timeout) => pg.waitForFunction(([s, r]) => { const e = document.querySelector(s); return !!e && new RegExp(r).test(e.textContent); }, [sel, re], { timeout: timeout || 6000 });
async function overflowX(pg) {
  return pg.evaluate(() => {
    const W = document.documentElement.clientWidth, bad = [], place = document.querySelector('#place-arena');
    if (document.documentElement.scrollWidth > W + 1) bad.push('html ' + document.documentElement.scrollWidth + '>' + W);
    if (place.scrollWidth > place.clientWidth + 1) bad.push('place ' + place.scrollWidth + '>' + place.clientWidth);
    for (const e of place.querySelectorAll('.ar-root *')) {
      const r = e.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      const cs = getComputedStyle(e);
      if (cs.visibility === 'hidden' || cs.display === 'none') continue;
      if (r.right > W + 1 || r.left < -1) bad.push((e.className || e.tagName) + ' ' + Math.round(r.left) + '..' + Math.round(r.right));
    }
    return bad.slice(0, 6);
  });
}
const noOverflow = async (pg, where) => assert.deepEqual(await overflowX(pg), [], 'tràn ngang ở ' + where);
const matchFits = (pg) => pg.evaluate(() => { const b = document.querySelector('.ar-matchbox'); return { over: b.scrollHeight - b.clientHeight, stage: Math.round(document.querySelector('.ar-stage').getBoundingClientRect().height) }; });
/** Số lần chuỗi xuất hiện trong DOM (cả thuộc tính) ngoài các phần tử được phép. */
const leaks = (pg, needles, allow) => pg.evaluate(([ns, al]) => {
  const all = document.documentElement.outerHTML + '\n' + document.body.innerText, ok = [...document.querySelectorAll(al || '#none')].map(e => e.outerHTML + e.innerText).join('\n');
  const cnt = (s, n) => s.split(n).length - 1;
  return ns.map(n => cnt(all, n) - cnt(ok, n)).reduce((a, b) => a + Math.max(0, b), 0);
}, [needles, allow]);
function stance(pk, op) {
  if (!pk) return 'idle';
  if (pk.skill === M.REST_ID) return 'rest';
  const s = M.SKILLS[pk.skill];
  if (!s) return 'idle';
  if (pk.phase === 'release') return 'release';
  if (pk.phase === 'charge') return 'charge';
  if (s.kind === 'hybrid') { const o = op && M.SKILLS[op.skill]; return o && (o.kind === 'atk' || op.phase === 'release') ? 'parry' : 'atk'; }
  return s.kind;
}
const NAMES = { atk: 'Công', release: 'Đòn tụ lực', guard: 'Thủ', dodge: 'Né', parry: 'Đỡ', charge: 'Tụ lực', rest: 'Điều tức', idle: 'Đứng yên' };
const pairOf = p => `${NAMES[stance(p.you, p.op)]} gặp ${NAMES[stance(p.op, p.you)]}`;
const narrCount = r => r.events.filter(e => !['pick', 'rage', 'end'].includes(e.k)).length;
const skillNm = id => (M.SKILLS[id] || M.SPECIAL[id]).name;
const hpText = s => `${s.hp}/${s.hpMax}`;

/** Đợi lượt n ở trạng thái chọn chiêu. */
const waitTurn = (pg, n) => pg.waitForFunction(k => { const m = /Lượt (\d+)/.exec((document.querySelector('.ar-turn') || {}).textContent || ''); const p = document.querySelector('.ar-pickui'); return m && +m[1] === k && p && !p.hidden; }, n, { timeout: 12000 });
const waitReveal = pg => pg.waitForFunction(() => { const r = document.querySelector('.ar-reveal'); return r && !r.hidden; }, null, { timeout: 8000 });

(async () => {
  browser.b = await chromium.launch();

  /* ===== sân: danh sách, công tắc, mời, chặn ===== */
  await t('Sân đông người: hàng, trạng thái, nút mời chỉ ở người rảnh, không tràn ngang', 'mobile', async pg => {
    await pg.waitForSelector('.ar-row');
    assert.equal(await count(pg, '.ar-row'), 14);
    const free = await pg.$$eval('.ar-row', rs => rs.filter(r => r.querySelector('.ar-st-free')).length);
    const visInv = await pg.$$eval('.ar-row .ar-inv', bs => bs.filter(b => b.offsetParent !== null).length);
    assert.equal(visInv, free, 'số nút Mời phải bằng số người rảnh');
    const t = await text(pg, '.ar-list');
    for (const w of ['Rảnh', 'Đang đấu', 'Tạm nghỉ']) assert.ok(t.includes(w), 'thiếu trạng thái ' + w);
    assert.ok(await pg.$$eval('.ar-row canvas', cs => cs.every(c => c.width > 10 && c.height > 10)), 'mini nhân vật chưa vẽ');
    const h = await pg.$$eval('.ar-root button', bs => bs.filter(b => b.offsetParent !== null && b.getBoundingClientRect().height < 43 && !b.classList.contains('ar-logbtn')).map(b => b.textContent + ':' + Math.round(b.getBoundingClientRect().height)));
    assert.deepEqual(h, [], 'nút thấp hơn 44px');
    await noOverflow(pg, 'sân đông');
    await shot(pg, 'roster-crowded');
  });
  await t('Sân vắng: dòng thân thiện, không có danh sách', 'mobile', async pg => {
    assert.ok(await vis(pg, '.ar-empty'));
    assert.match(await text(pg, '.ar-empty'), /Sân đang vắng/);
    assert.ok(!(await vis(pg, '.ar-list')));
    assert.equal(await text(pg, '.ar-count'), '0');
    await noOverflow(pg, 'sân vắng'); await shot(pg, 'roster-empty');
  }, '&players=empty');
  await t('Sự kiện arena:add / upd / del cập nhật danh sách', 'mobile', async pg => {
    await pg.waitForSelector('.ar-row');
    await pg.evaluate(() => H.add(H.row(40, 'free')));
    assert.equal(await count(pg, '.ar-row'), 15);
    await pg.evaluate(() => H.upd(300, { st: 'busy', wins: 99 }));
    const r = await pg.$eval('.ar-row[data-pid="300"]', e => ({ t: e.textContent, inv: e.querySelector('.ar-inv').offsetParent !== null }));
    assert.ok(/Đang đấu/.test(r.t) && /99 thắng/.test(r.t) && !r.inv);
    await pg.evaluate(() => H.del(301));
    assert.equal(await count(pg, '.ar-row'), 14);
  });
  await t('Công tắc "Tạm không nhận lời mời": gửi arena:dnd, lỗi thì hoàn lại và báo', 'mobile', async pg => {
    await pg.waitForSelector('.ar-row');
    await pg.click('.ar-switch'); await pg.waitForFunction(() => document.querySelector('.ar-switch').getAttribute('aria-checked') === 'true');
    assert.deepEqual((await sent(pg, 'arena:dnd'))[0], { on: true });
    await pg.click('.ar-switch'); await pg.waitForFunction(() => document.querySelector('.ar-switch').getAttribute('aria-checked') === 'false');
    await pg.evaluate(() => { H.opts.fail['arena:dnd'] = { ok: false, reason: 'Thử lại sau nhé (giả lập).' }; });
    await pg.click('.ar-switch'); await pg.waitForFunction(() => H.toasts.length > 0);
    assert.equal(await pg.getAttribute('.ar-switch', 'aria-checked'), 'false');
    assert.match((await toasts(pg))[0], /giả lập/);
  });
  await t('Mời đi: hộp chọn chế độ, dải chờ + đếm ngược, hủy lời mời, khóa nút mời khác', 'mobile', async pg => {
    await pg.waitForSelector('.ar-row');
    await pg.evaluate(() => { H.opts.inviteOutcome = 'ignore'; });
    await pg.locator('.ar-row:has(.ar-st-free) .ar-inv').first().click();
    await pg.waitForSelector('dialog[open]');
    const d = await text(pg, 'dialog[open]');
    assert.ok(d.includes('Phòng cân bằng') && d.includes('Phòng có buff') && /Không buff/.test(d) && /Pháp tướng/.test(d));
    await noOverflow(pg, 'hộp chế độ'); await shot(pg, 'dlg-mode');
    await pg.click('dialog[open] .opt >> nth=1'); await pg.click('dialog[open] button[type=submit]');
    await pg.waitForSelector('.ar-out:not([hidden])');
    const sentInv = (await sent(pg, 'pk:invite'))[0];
    assert.equal(sentInv.mode, 'buff'); assert.equal(typeof sentInv.toPid, 'number');
    assert.match(await text(pg, '.ar-out'), /Đang chờ .+ nhận lời… \(còn (1\d|20) giây\)/);
    assert.equal(await pg.$$eval('.ar-inv', bs => bs.filter(b => b.offsetParent !== null && !b.disabled).length), 0, 'nút mời khác phải khóa');
    await noOverflow(pg, 'dải mời đi'); await shot(pg, 'outgoing');
    await pg.click('.ar-out button');
    await pg.waitForSelector('.ar-out', { state: 'hidden' });
    assert.equal((await sent(pg, 'pk:invite:cancel')).length, 1);
    assert.ok((await pg.$$eval('.ar-inv', bs => bs.filter(b => b.offsetParent !== null && !b.disabled).length)) > 0);
  });
  await t('Mời đi: lý do đóng lời mời → toast tiếng Việt từng lý do; lỗi ack hiện tại hộp', 'mobile', async pg => {
    await pg.waitForSelector('.ar-row');
    const cases = [['declined', /đã từ chối/], ['expired', /hết hạn/], ['busy', /đang bận/], ['left', /đã rời sân/]];
    await pg.evaluate(() => { H.opts.inviteOutcome = 'ignore'; });
    for (const [reason, re] of cases) {
      await pg.locator('.ar-row:has(.ar-st-free) .ar-inv').first().click();
      await pg.click('dialog[open] button[type=submit]');
      await pg.waitForSelector('.ar-out:not([hidden])');
      const id = await pg.evaluate(() => H.state.out.id);
      const n0 = (await toasts(pg)).length;
      await pg.evaluate(([i, r]) => H.close(i, r), [id, reason]);
      await pg.waitForSelector('.ar-out', { state: 'hidden' });
      await pg.waitForFunction(n => H.toasts.length > n, n0, { timeout: 2000 });   // "busy" báo trễ 300ms (để khỏi báo khi chính mình vừa vào sảnh)
      const ts = await toasts(pg);
      assert.match(ts[ts.length - 1], re, reason); assert.equal(ts.length, n0 + 1);
    }
    await pg.evaluate(() => { H.opts.fail['pk:invite'] = { ok: false, reason: 'Người này vừa vào trận khác.' }; });
    await pg.locator('.ar-row:has(.ar-st-free) .ar-inv').first().click();
    await pg.click('dialog[open] button[type=submit]');
    await waitText(pg, 'dialog[open] .warn', 'vừa vào trận khác');
    assert.ok(await vis(pg, 'dialog[open]'), 'hộp phải còn mở khi lỗi');
  });
  await t('Lời mời đến (cân bằng): thẻ nổi, đếm ngược, không che nút Về chánh điện, nhận / từ chối', 'mobile', async pg => {
    await pg.waitForSelector('.ar-row');
    const id = await pg.evaluate(() => H.invite({ mode: 'balanced', from: { name: 'Quảng Đức' } }));
    await pg.waitForSelector('.ar-ic');
    const c = await text(pg, '.ar-ic');
    assert.ok(c.includes('Quảng Đức') && c.includes('Phòng cân bằng') && /còn \d+s/.test(c));
    assert.equal(await count(pg, '.ar-bt'), 0, 'chế độ cân bằng không có bảng buff');
    const hit = await pg.evaluate(() => { const b = document.querySelector('.ar-back').getBoundingClientRect(), e = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2); return !!e.closest('.ar-back'); });
    assert.ok(hit, 'thẻ lời mời che nút Về chánh điện');
    const w1 = await pg.$eval('.ar-ic-bar i', e => parseFloat(e.style.width));
    await pg.waitForTimeout(1200);
    const w2 = await pg.$eval('.ar-ic-bar i', e => parseFloat(e.style.width));
    assert.ok(w2 < w1, 'thanh đếm ngược phải chạy');
    await noOverflow(pg, 'lời mời cân bằng'); await shot(pg, 'invite-bal');
    await pg.click('.ar-ic .btn.primary');
    await pg.waitForFunction(() => document.querySelector('.ar-lobby:not([hidden])'), null, { timeout: 5000 });
    assert.deepEqual((await sent(pg, 'pk:respond'))[0], { inviteId: id, accept: true });
    assert.equal(await count(pg, '.ar-ic'), 0, 'lời mời phải biến mất khi vào sảnh');
  });
  await t('Lời mời đến (buff): bảng buff hai bên, "Không có buff", từ chối, hủy, hết hạn, tối đa 3 thẻ', 'mobile', async pg => {
    await pg.waitForSelector('.ar-row');
    const id = await pg.evaluate(() => H.invite({ mode: 'buff', buffs: 'oneSide' }));
    await pg.waitForSelector('.ar-ic .ar-bt');
    const bt = await text(pg, '.ar-bt');
    assert.ok(/Không có buff/.test(bt) && /Hào quang cảnh giới 3/.test(bt) && /Pháp tướng cấp 1/.test(bt), bt);
    assert.match(await text(pg, '.ar-ic'), /bản xem trước/);
    await noOverflow(pg, 'lời mời buff'); await shot(pg, 'invite-buff');
    await pg.click('.ar-ic .btn:not(.primary)');
    await pg.waitForSelector('.ar-ic', { state: 'detached' });
    assert.deepEqual((await sent(pg, 'pk:respond'))[0], { inviteId: id, accept: false });
    const id2 = await pg.evaluate(() => H.invite({ from: { name: 'Bảo An' } }));
    await pg.waitForSelector('.ar-ic');
    await pg.evaluate(i => H.close(i, 'cancelled'), id2);
    await pg.waitForSelector('.ar-ic', { state: 'detached' });
    assert.match((await toasts(pg)).pop(), /Bảo An đã hủy lời mời/);
    await pg.evaluate(() => H.invite({ ms: 1200, from: { name: 'Tuệ Minh' } }));
    await pg.waitForSelector('.ar-ic', { state: 'detached', timeout: 4000 });
    assert.match((await toasts(pg)).pop(), /Lời mời của Tuệ Minh đã hết hạn/);
    await pg.evaluate(() => { for (let i = 0; i < 3; i++) H.invite({ mode: i === 1 ? 'buff' : 'balanced', from: { name: 'Khách ' + i, pid: 400 + i } }); });
    await pg.waitForFunction(() => document.querySelectorAll('.ar-ic').length === 3);
    const back = await pg.evaluate(() => { const b = document.querySelector('.ar-back').getBoundingClientRect(), e = document.elementFromPoint(b.left + 20, b.top + 20); return !!e.closest('.ar-back'); });
    assert.ok(back, '3 thẻ che nút Về chánh điện');
    await pg.waitForTimeout(500);
    await noOverflow(pg, '3 lời mời'); await shot(pg, 'invite-three');
  });
  await t('Chặn: xác nhận trong trang, pk:block, danh sách chặn, bỏ chặn, lỗi', 'mobile', async pg => {
    await pg.waitForSelector('.ar-row');
    const name = await pg.$eval('.ar-row .ar-rname', e => e.textContent);
    await pg.click('.ar-blk >> nth=0');
    await pg.waitForSelector('dialog[open]');
    assert.ok((await text(pg, 'dialog[open] h2')).includes('Chặn ' + name));
    await pg.click('dialog[open] .btn:has-text("Không chặn")');
    assert.equal((await sent(pg, 'pk:block')).length, 0, 'chưa xác nhận thì không gửi');
    await pg.click('.ar-blk >> nth=0'); await pg.click('dialog[open] .btn.primary');
    await pg.waitForFunction(() => H.toasts.length > 0);
    assert.equal(typeof (await sent(pg, 'pk:block'))[0].pid, 'number');
    assert.match((await toasts(pg))[0], /Đã chặn/);
    await pg.click('.ar-blocks'); await pg.waitForSelector('.ar-bli');
    assert.equal(await count(pg, '.ar-bli'), 3);
    await noOverflow(pg, 'danh sách chặn'); await shot(pg, 'blocks');
    await pg.click('.ar-bli button >> nth=0');
    await pg.waitForFunction(() => document.querySelectorAll('.ar-bli').length === 2);
    assert.equal((await sent(pg, 'pk:unblock'))[0].uid, 'u9');
    await pg.evaluate(() => { H.opts.fail['pk:unblock'] = { ok: false, reason: 'Không bỏ chặn được (giả lập).' }; });
    await pg.click('.ar-bli button >> nth=0');
    await waitText(pg, 'dialog[open] .warn', 'giả lập');
    assert.equal(await count(pg, '.ar-bli'), 2);
  });
  await t('Cần đăng nhập: thẻ mời đăng nhập, bấm gọi host.login', 'mobile', async pg => {
    assert.ok(await vis(pg, '.ar-login'));
    await pg.click('.ar-login .btn');
    assert.equal(await pg.evaluate(() => H.loginClicks), 1);
    assert.ok(!(await vis(pg, '.ar-empty')), 'không hiện "Sân đang vắng" khi chưa đăng nhập');
  }, '&login=1&players=empty');

  await t('An toàn: tên chứa HTML được hiện nguyên văn, không chạy mã', 'mobile', async pg => {
    await pg.waitForSelector('.ar-row');
    const evil = '<img src=x onerror="window.__x=1">';
    await pg.evaluate(e => { H.add(Object.assign(H.row(41, 'free'), { name: e })); H.invite({ from: { name: e, pid: 9 } }); H.invite({ mode: 'buff', from: { name: '<b>đậm</b>', pid: 10 } }); }, evil);
    await pg.waitForSelector('.ar-ic');
    await pg.waitForTimeout(300);
    assert.equal(await pg.evaluate(() => window.__x), undefined);
    assert.ok((await text(pg, '.ar-list')).includes(evil) && (await text(pg, '.ar-invites')).includes('<b>đậm</b>'));
    assert.equal(await count(pg, '.ar-list img, .ar-invites img, .ar-invites b b'), 0);
  });
  await t('Không có Hall (harness không nạp hall.js): vẫn vẽ hình đơn giản, không lỗi', 'nohall', async pg => {
    await pg.waitForSelector('.ar-row');
    assert.equal(await pg.evaluate(() => typeof window.Hall), 'undefined');
    assert.ok(await pg.$$eval('.ar-row canvas', cs => cs.every(c => { const x = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; for (let i = 0; i < x.length; i += 4) if (x[i] > 120) return true; return false; })), 'canvas trống');
    await pg.evaluate(() => H.startLobby({ buffs: 'heavy', opReady: 100 }));
    await pg.waitForSelector('.ar-lobby:not([hidden])');
    await pg.click('.ar-lb-act .btn');
    await waitTurn(pg, 1);
    assert.ok(await pg.$eval('.ar-stage canvas', c => c.width > 50));
    pg.errs = pg.errs.filter(e => !/Failed to load resource|hall\.js|ERR_FAILED|Hall is not defined/.test(e));
  });

  /* ===== luồng chính: mời → sảnh → khóa → 6 lượt → kết thúc ===== */
  await t('Luồng chính: mời → sảnh → khóa → 6 lượt (né, đỡ, phản đòn, tụ lực, sơ hở, Kim Chung) → thắng → về sân', 'mobile', async pg => {
    const A = FX.A;
    await pg.waitForSelector('.ar-row');
    await pg.evaluate(() => { H.opts.revealMs = 2600; H.opts.inviteDelay = 500; H.opts.revealDelay = 900; H.opts.opLockMs = 600000; H.opts.startDelay = 900; });
    await pg.locator('.ar-row:has(.ar-st-free) .ar-inv').first().click();
    await pg.click('dialog[open] .opt >> nth=1'); await pg.click('dialog[open] button[type=submit]');
    await pg.waitForSelector('.ar-lobby:not([hidden])', { timeout: 6000 });
    assert.ok(await pg.evaluate(() => Arena.inMatch()), 'inMatch phải đúng ở sảnh');
    // sảnh
    await pg.waitForSelector('.ar-slot.on');
    assert.equal(await count(pg, '.ar-slot.on'), 4);
    assert.match(await text(pg, '.ar-clock'), /\d+ giây/);
    const lobby = await text(pg, '.ar-lobby');
    assert.ok(lobby.includes('Pháp tướng cấp 3') && lobby.includes('Quỷ ám cấp 2') && /chụp một lần lúc nhận lời/.test(lobby));
    assert.equal(await leaks(pg, A.turns[0].loadouts.op.flatMap(id => [skillNm(id), id]), '#none'), 0, 'lộ chiêu đối thủ ở sảnh');
    assert.equal(await count(pg, '.ar-picker .ar-card'), A.you.learned.length);
    await noOverflow(pg, 'sảnh'); await shot(pg, 'lobby');
    // đổi bộ: bỏ chiêu 4, thử chọn thừa, đổi sang bộ không có chiêu công → cảnh báo vẫn khóa được
    await pg.click('.ar-slot >> nth=3');
    assert.equal(await count(pg, '.ar-slot.on'), 3);
    assert.ok(await pg.$eval('.ar-lb-act .btn', b => b.disabled), 'chưa đủ 4 chiêu thì khóa tắt');
    for (let i = 0; i < 3; i++) await pg.click('.ar-slot >> nth=0');
    for (const id of ['thiet-bich', 'anh-bo-ho-than', 'khinh-than-bo', 'kim-chung-trao']) await pg.click(`.ar-picker .ar-card[data-skill="${id}"]`);
    await pg.click('.ar-picker .ar-card[data-skill="trong-quyen"]');
    assert.match(await text(pg, '.ar-lw'), /Đủ 4 chiêu rồi/);
    assert.match(await text(pg, '.ar-lw'), /không có đòn tấn công chủ động/);
    assert.ok(!(await pg.$eval('.ar-lb-act .btn', b => b.disabled)), 'cảnh báo nhưng vẫn cho khóa');
    await shot(pg, 'lobby-warn');
    for (let i = 0; i < 4; i++) await pg.click('.ar-slot >> nth=0');
    for (const id of A.you.loadout) await pg.click(`.ar-picker .ar-card[data-skill="${id}"]`);
    assert.equal(await count(pg, '.ar-slot.on'), 4);
    await pg.click('.ar-lb-act .btn');
    await pg.waitForSelector('.ar-wait:not([hidden])');
    assert.deepEqual((await sent(pg, 'pk:loadout')).pop().skills, A.you.loadout);
    assert.ok(await pg.$eval('.ar-picker .ar-card', b => b.disabled), 'khóa rồi thì không sửa được');
    assert.match(await text(pg, '.ar-wait'), /Đang chờ đối thủ/);
    assert.ok(!(await vis(pg, '.ar-ready')));
    await shot(pg, 'lobby-locked');
    await pg.evaluate(() => H.opReady());
    await pg.waitForSelector('.ar-ready:not([hidden])', { timeout: 2000 });
    assert.match(await text(pg, '.ar-wait'), /hai bên đã sẵn sàng/i);
    await shot(pg, 'lobby-ready');
    // trận
    const seen = new Set();
    for (let i = 0; i < A.reveals.length; i++) {
      const rev = A.reveals[i], tn = A.turns[i], n = i + 1;
      await waitTurn(pg, n);
      assert.ok(await pg.evaluate(() => Arena.inMatch()));
      assert.ok(!(await pg.$eval('.ar-lockb', e => e.classList.contains('on'))), `huy hiệu "đối thủ đã khóa" phải xóa khi sang lượt ${n}`);
      if (i === 0) {
        assert.equal(await count(pg, '.ar-oploadout .ar-ol'), 4);
        const row = await text(pg, '.ar-oploadout');
        for (const id of tn.loadouts.op) assert.ok(row.includes(skillNm(id)), 'thiếu chiêu công bố ' + id);
        assert.equal((await pg.$$eval('.ar-pk', c => c.length)), 5, '4 thẻ + Điều tức');
        const m = await matchFits(pg); assert.ok(m.over <= 1, 'màn trận cuộn dọc ' + m.over); assert.ok(m.stage >= 100, 'sân khấu quá nhỏ ' + m.stage);
        await noOverflow(pg, 'trận'); await shot(pg, 'match-turn1');
      }
      assert.equal(await text(pg, '.ar-fc-you .ar-hp .ar-m-v'), hpText(tn.state.you), 'HP mình đầu lượt ' + n);
      assert.equal(await text(pg, '.ar-fc-op .ar-hp .ar-m-v'), hpText(tn.state.op), 'HP đối thủ đầu lượt ' + n);
      assert.equal(await text(pg, '.ar-fc-you .ar-mp .ar-m-v'), `${tn.state.you.mana}/${tn.state.you.manaMax}`);
      const legal = await pg.evaluate(() => H.state.match.curLegal);
      for (const c of await pg.$$('.ar-pk')) {
        const id = (await c.getAttribute('data-skill')) || 'dieu-tuc', dis = await c.isDisabled(), off = await c.evaluate(e => e.classList.contains('off'));
        assert.equal(off, !legal.includes(id), `thẻ ${id} lượt ${n}: mờ=${off}, legal=${legal.includes(id)}`);
        if (tn.forced) assert.ok(dis, 'tụ lực: mọi thẻ không chạm được');
        else assert.equal(dis, !legal.includes(id), `thẻ ${id} lượt ${n}: disabled=${dis}, legal=${legal.includes(id)}`);
      }
      const opId = rev.picks.op.skill, opHtml = await pg.$eval('.ar-oploadout', e => e.outerHTML);
      const fresh = !seen.has(opId);
      if (fresh) assert.equal(await leaks(pg, [skillNm(opId), opId], '.ar-oploadout, .ar-logpanel'), 0, `lộ chiêu đối thủ (${opId}) trước khi lật, lượt ${n}`);
      if (tn.forced) {
        assert.match(await text(pg, '.ar-status'), /Đang tụ lực, lượt này tự tung/);
        assert.equal(await pg.$$eval('.ar-pk:not(.off)', c => c.length), 1, 'tụ lực: chỉ một thẻ sáng');
        assert.equal(await pg.getAttribute('.ar-pk:not(.off)', 'data-skill'), tn.forced);
        assert.match(await text(pg, '.ar-pk:not(.off)'), /Tự tung/);
        assert.ok(await pg.$eval('.ar-lockbtn', b => b.hidden), 'tụ lực: không có nút Khóa');
        assert.ok(await pg.$eval('.ar-fc-you .ar-bd', e => /Tụ lực/.test(e.textContent)), 'thiếu huy hiệu Tụ lực');
        if (n === 4) await shot(pg, 'match-forced');
      } else {
        const youId = rev.picks.you.skill, sel = youId === 'dieu-tuc' ? '.ar-rest' : `.ar-pk[data-skill="${youId}"]`;
        await pg.click(sel);
        assert.equal(await pg.getAttribute(sel, 'aria-pressed'), 'true');
        assert.match(await text(pg, '.ar-lockbtn'), new RegExp('Khóa: ' + skillNm(youId)));
        assert.equal((await sent(pg, 'pk:pick')).filter(p => p.turn === n).length, 0, 'chạm thẻ chưa được gửi, phải bấm Khóa');
        if (n === 1) await shot(pg, 'match-selected');
        await pg.click('.ar-lockbtn');
      }
      if (!tn.forced) {
        await pg.waitForFunction(k => H.socket.sent.some(s => s.event === 'pk:pick' && s.data.turn === k), n, { timeout: 4000 });
        const pick = (await sent(pg, 'pk:pick')).find(p => p.turn === n);
        assert.equal(pick.skillId, rev.picks.you.skill); assert.equal(pick.matchId, await pg.evaluate(() => H.state.match.id));
        await waitText(pg, '.ar-status', 'Đã khóa, chờ đối thủ');
      } else assert.equal((await sent(pg, 'pk:pick')).filter(p => p.turn === n).length, 0, 'tụ lực: máy chủ tự khóa, không gửi pk:pick');
      if (n === 1) await shot(pg, 'match-locked');
      await pg.waitForSelector('.ar-lockb.on', { timeout: 3000 });
      assert.equal(await pg.$eval('.ar-oploadout', e => e.outerHTML), opHtml, 'bộ chiêu đối thủ đổi khi họ khóa');
      if (fresh) assert.equal(await leaks(pg, [skillNm(opId), opId], '.ar-oploadout, .ar-logpanel'), 0, 'lộ chiêu khi nhận pk:locked');
      assert.match(await pg.getAttribute('.ar-lockb', 'aria-label'), /Đối thủ đã khóa/);
      // lật chiêu
      await waitReveal(pg);
      await pg.waitForFunction(() => document.querySelectorAll('.ar-flip.on').length === 2, null, { timeout: 2500 });
      await waitText(pg, '.ar-pair', pairOf(rev.picks).replace(/[()]/g, '\\$&'), 3000);
      const flips = await pg.$$eval('.ar-flip', fs => fs.map(f => f.textContent));
      assert.ok(flips[0].includes(skillNm(rev.picks.you.skill)) && flips[1].includes(skillNm(opId)), 'thẻ lật: ' + flips.join(' | '));
      const need = narrCount(rev) + (rev.ended ? 1 : 0);
      await pg.waitForFunction(k => document.querySelectorAll('.ar-lines li').length >= k, need, { timeout: 4000 });
      if (n === 1) { await noOverflow(pg, 'lật chiêu'); const m = await matchFits(pg); assert.ok(m.over <= 1, 'lật chiêu làm màn cuộn ' + m.over); }
      if (n === 5) await shot(pg, 'reveal-kc');
      await pg.waitForFunction(([a, b]) => document.querySelector('.ar-fc-you .ar-hp .ar-m-v').textContent === a && document.querySelector('.ar-fc-op .ar-hp .ar-m-v').textContent === b, [hpText(rev.state.you), hpText(rev.state.op)], { timeout: 3500 });
      assert.equal(await text(pg, '.ar-fc-you .ar-rg .ar-m-v'), String(rev.state.you.rage));
      seen.add(opId);
      if (rev.ended) break;
    }
    // kết thúc
    await pg.waitForSelector('.ar-end:not([hidden])', { timeout: 8000 });
    assert.equal(await text(pg, '.ar-etitle'), 'Bạn thắng');
    assert.equal(await text(pg, '.ar-etext'), 'Đối thủ hết máu trước.');
    const et = await text(pg, '.ar-end');
    assert.ok(/Số lượt\s*6/.test(et) && /Thắng 13 · Thua 8 · Hòa 1/.test(et) && /0\/200/.test(et), et);
    assert.ok(!(await pg.evaluate(() => Arena.inMatch())), 'hết trận thì inMatch sai');
    await pg.click('.ar-edet summary');
    assert.equal(await count(pg, '.ar-end .ar-lg-h'), 6, 'nhật ký đủ 6 lượt');
    await noOverflow(pg, 'kết thúc'); await shot(pg, 'end-win');
    await pg.click('.ar-eact .btn.primary');
    await pg.waitForSelector('.ar-roster:not([hidden])');
    assert.equal(await count(pg, '.ar-row'), 14);
    assert.equal(await pg.evaluate(() => Arena.inMatch()), false);
  });

  /* ===== lật chiêu: bỏ qua, các loại sự kiện ===== */
  await t('Bỏ qua hoạt ảnh: hiện đủ dòng và thanh cuối ngay', 'mobile', async pg => {
    const rev = FX.A.reveals[1];
    await pg.evaluate(() => { H.opts.revealMs = 4000; });
    await pg.waitForSelector('.ar-pk');
    await pg.click('.ar-pk[data-skill="nhu-van-bo"]'); await pg.click('.ar-lockbtn');
    await waitReveal(pg);
    await pg.waitForTimeout(500);
    assert.ok((await count(pg, '.ar-lines li')) < narrCount(rev), 'chưa chạy hết thì phải còn thiếu dòng');
    await pg.click('.ar-skip');
    assert.equal(await count(pg, '.ar-lines li'), narrCount(rev));
    assert.equal(await text(pg, '.ar-fc-you .ar-hp .ar-m-v'), hpText(rev.state.you));
    assert.equal(await pg.$$eval('.ar-flip.on', f => f.length), 2);
    const lines = await pg.$$eval('.ar-lines li', ls => ls.map(l => l.textContent));
    const j = lines.join('\n');
    assert.ok(/Bạn né thành công nhịp 1\/2 \(\d+%\)/.test(j) && /Bạn né hụt nhịp 2\/2 \(\d+%\)/.test(j) && /Liên Hoàn Cước trúng bạn, nhịp 2\/2, gây \d+/.test(j), j);
    await waitTurn(pg, 3);
  }, '&jump=A:choosing:2');
  await t('Câu kể: đỡ, phản đòn, sơ hở, Kim Chung, thủ giảm, suy kiệt, đứng yên hết giờ', 'mobile', async pg => {
    const grab = async (qs, sel) => { const p2 = await open('mobile', qs); try { await p2.waitForSelector('.ar-pk'); await p2.click(sel); await p2.click('.ar-lockbtn'); await waitReveal(p2); await p2.click('.ar-skip'); return (await p2.$$eval('.ar-lines li', ls => ls.map(l => l.textContent))).join('\n'); } finally { await p2.close(); } };
    const l1 = await grab('&jump=A:choosing:1', '.ar-pk[data-skill="trong-quyen"]');
    assert.ok(/Đối thủ đỡ thành công nhịp 1 \(\d+%\)/.test(l1) && /Đối thủ phản đòn, bạn mất \d+/.test(l1) && /Bạn sơ hở: lượt sau nhận thêm 25% sát thương/.test(l1), l1);
    const l5 = await grab('&jump=A:choosing:5', '.ar-pk[data-skill="kim-chung-trao"]');
    assert.ok(/Bạn thủ, giảm 45% sát thương/.test(l5) && /Bạn nhận Kim Chung: trong 2 lượt tới, đòn công đầu tiên mạnh thêm 25%/.test(l5) && /trúng bạn, gây \d+/.test(l5), l5);
    const l4 = await grab('&jump=B:choosing:4', '.ar-pk[data-skill="anh-bo-ho-than"]');
    assert.ok(/Suy kiệt: cả hai mất 5/.test(l4), l4);
    const l3 = await grab('&jump=C:choosing:1', '.ar-pk[data-skill="trong-quyen"]');
    assert.ok(/Bạn hết giờ nên đứng yên/.test(l3) && /Tật Phong Quyền trúng bạn, gây \d+/.test(l3), l3);
    const l2 = await grab('&jump=A:choosing:3', '.ar-pk[data-skill="tu-luc-pha-son"]');
    assert.ok(/Bạn bắt đầu tụ lực/.test(l2) && /Liên Hoàn Cước trúng bạn, nhịp 1\/2, gây \d+/.test(l2), l2);
  });
  await t('Nhật ký trận: khay thu gọn, mở xem, đóng', 'mobile', async pg => {
    await pg.waitForSelector('.ar-logbtn');
    assert.ok(!(await vis(pg, '.ar-logpanel')));
    await pg.click('.ar-logbtn');
    assert.ok(await vis(pg, '.ar-logpanel'));
    assert.equal(await pg.getAttribute('.ar-logbtn', 'aria-expanded'), 'true');
    assert.match(await text(pg, '.ar-logpanel'), /Lượt 1: bạn ra Trọng Quyền, đối thủ ra Tiếp Kình Phản Chưởng/);
    await pg.click('.ar-logbtn');
    assert.ok(!(await vis(pg, '.ar-logpanel')));
  }, '&jump=A:reveal:1&left=3000');

  /* ===== vào lại giữa trận ===== */
  await t('Vào lại: pha chọn chiêu (lượt 3)', 'mobile', async pg => {
    await pg.waitForSelector('.ar-matchbox:not([hidden])');
    await waitTurn(pg, 3);
    assert.equal(await text(pg, '.ar-fc-you .ar-hp .ar-m-v'), hpText(FX.A.turns[2].state.you));
    assert.equal(await count(pg, '.ar-oploadout .ar-ol'), 4);
    assert.ok((await pg.$eval('.ar-hturn .ar-tsec', e => parseInt(e.textContent))) <= 14);
  }, '&jump=A:choosing:3');
  await t('Vào lại: đã khóa chiêu (myPick) và đối thủ đã khóa → hiện đúng, rồi lật', 'mobile', async pg => {
    await pg.waitForSelector('.ar-matchbox:not([hidden])');
    assert.match(await text(pg, '.ar-status'), /Đã khóa, chờ đối thủ/);
    assert.equal(await pg.getAttribute('.ar-pk[data-skill="nhu-van-bo"]', 'aria-pressed'), 'true');
    assert.ok(await pg.$eval('.ar-lockbtn', b => b.hidden));
    assert.ok(await pg.$eval('.ar-lockb', e => e.classList.contains('on')));
    await waitReveal(pg);
  }, '&jump=A:choosing:2&myPick=nhu-van-bo&opLocked=1');
  await t('Vào lại: đang lật chiêu (lastReveal) → dựng lại các dòng, rồi sang lượt kế', 'mobile', async pg => {
    await waitReveal(pg);
    await pg.waitForFunction(() => document.querySelectorAll('.ar-lines li').length >= 3);
    assert.match(await text(pg, '.ar-pair'), /Công gặp Đỡ/);
    assert.equal(await text(pg, '.ar-fc-you .ar-hp .ar-m-v'), hpText(FX.A.reveals[0].state.you));
    await waitTurn(pg, 2);
  }, '&jump=A:reveal:1&left=2200');
  await t('Vào lại: sảnh (đối thủ đã sẵn sàng, lấy danh sách chiêu đã học qua martial:state)', 'mobile', async pg => {
    await pg.waitForSelector('.ar-lobby:not([hidden])');
    await pg.waitForFunction(n => document.querySelectorAll('.ar-picker .ar-card').length === n, FX.A.you.learned.length);
    assert.ok(await vis(pg, '.ar-ready'));
    assert.equal(await count(pg, '.ar-slot.on'), 4);
  }, '&jump=A:lobby:1&opLocked=1');
  await t('Vào lại: trận đã bị hủy (không có snapshot, có message) → về sân + toast', 'mobile', async pg => {
    await pg.waitForSelector('.ar-matchbox:not([hidden])');
    await pg.evaluate(() => { H.state.match.phase = 'ended'; H.opts.resumeMessage = 'Máy chủ vừa khởi động lại, trận đã bị hủy.'; });
    await pg.evaluate(() => { H.disconnect(); return H.reconnect(); });
    await pg.waitForSelector('.ar-roster:not([hidden])');
    assert.match((await toasts(pg)).pop(), /trận đã bị hủy/);
    assert.equal(await pg.evaluate(() => Arena.inMatch()), false);
  }, '&jump=A:choosing:3');
  await t('Mất kết nối: dòng báo, khóa nút gửi; nối lại thì vào lại trận', 'mobile', async pg => {
    await waitTurn(pg, 2);
    await pg.click('.ar-pk[data-skill="nhu-van-bo"]');
    await pg.evaluate(() => H.disconnect());
    await pg.waitForSelector('.ar-off:not([hidden])', { state: 'attached' });
    assert.match(await text(pg, '.ar-off'), /Mất kết nối/);
    assert.ok(await pg.$eval('.ar-lockbtn', b => b.disabled), 'nút Khóa phải tắt khi mất mạng');
    assert.ok(await pg.$$eval('.ar-pk', cs => cs.every(c => c.disabled)));
    assert.match(await text(pg, '.ar-status'), /Mất kết nối/);
    assert.ok(await vis(pg, '.place-conn'), 'banner của Places');
    await shot(pg, 'offline-match');
    await pg.evaluate(() => H.reconnect());
    await pg.waitForSelector('.place-conn', { state: 'hidden' });
    await waitTurn(pg, 2);
    assert.ok(!(await pg.$eval('.ar-pk[data-skill="nhu-van-bo"]', b => b.disabled)));
  }, '&jump=A:choosing:2');
  await t('Mất kết nối ở sân: nút mời / chặn / công tắc khóa', 'mobile', async pg => {
    await pg.waitForSelector('.ar-row');
    await pg.evaluate(() => H.disconnect());
    await pg.waitForSelector('.place-conn:not([hidden])');
    assert.ok(!(await vis(pg, '.ar-off')), 'đã có dải của khung nơi thì không báo đôi');
    assert.equal(await pg.$$eval('.ar-inv, .ar-blk, .ar-switch, .ar-blocks', bs => bs.filter(b => b.offsetParent !== null && !b.disabled).length), 0);
    await pg.evaluate(() => H.reconnect());
    await pg.waitForSelector('.place-conn', { state: 'hidden' });
    assert.ok((await pg.$$eval('.ar-inv', bs => bs.filter(b => b.offsetParent !== null && !b.disabled).length)) > 0);
  });

  /* ===== kết thúc: mọi lý do ===== */
  const ENDS = {
    'win-ko': ['Bạn thắng', /Đối thủ hết máu trước/], 'lose-ko': ['Bạn thua', /Bạn hết máu trước/],
    'draw-double': ['Hòa', /Cả hai cùng hết máu và ngang nhau/], 'win-double': ['Bạn thắng', /bạn còn ít âm hơn/], 'lose-double': ['Bạn thua', /đối thủ còn ít âm hơn/],
    'win-limit': ['Bạn thắng', /Hết 40 lượt.*Bạn còn nhiều máu hơn/], 'lose-limit': ['Bạn thua', /Hết 40 lượt.*Đối thủ còn nhiều máu hơn/], 'draw-limit': ['Hòa', /Hết 40 lượt.*bằng máu/],
    'forfeit-op': ['Bạn thắng', /Đối thủ đã bỏ cuộc, bạn thắng/], 'forfeit-you': ['Bạn thua', /Bạn đã bỏ cuộc nên bị xử thua/],
    'idle-op': ['Bạn thắng', /Đối thủ bỏ lỡ ba lượt liên tiếp/], 'idle-you': ['Bạn thua', /Bạn bỏ lỡ ba lượt liên tiếp/],
    'both-away': ['Trận bị hủy', /Cả hai cùng vắng.*Không ai bị tính thắng hay thua/], 'void': ['Trận bị hủy', /Không ai bị tính thắng hay thua/]
  };
  for (const [kind, [title, re]] of Object.entries(ENDS)) {
    await t('Kết thúc: ' + kind, 'mobile', async pg => {
      await waitTurn(pg, 2);
      await pg.evaluate(k => { H.opts.auto = false; H.sendEnd(k); }, kind);
      await pg.waitForSelector('.ar-end:not([hidden])', { timeout: 4000 });
      assert.equal(await text(pg, '.ar-etitle'), title);
      assert.match(await text(pg, '.ar-etext'), re);
      const et = await text(pg, '.ar-end');
      if (title === 'Trận bị hủy') assert.ok(/Không tính thắng thua/.test(et) && !/\+1\)/.test(et), 'hủy: không được ghi thắng / thua');
      else assert.match(et, /Thắng \d+ · Thua \d+ · Hòa \d+ \((thắng|thua|hòa) \+1\)/);
      assert.match(et, /\d+\/200/);
      await noOverflow(pg, 'kết thúc ' + kind);
      if (['win-ko', 'lose-ko', 'draw-double', 'void', 'forfeit-op'].includes(kind)) await shot(pg, 'end-' + kind);
    }, '&jump=A:choosing:2');
  }
  await t('Kết thúc giữa lúc đang lật chiêu: chờ hết hoạt ảnh rồi mới hiện bảng kết quả', 'mobile', async pg => {
    await pg.waitForSelector('.ar-pk');
    await pg.evaluate(() => { H.opts.revealMs = 3000; });
    await pg.click('.ar-pk[data-skill="trong-quyen"]'); await pg.click('.ar-lockbtn');
    await waitReveal(pg);
    assert.ok(!(await vis(pg, '.ar-end')), 'chưa được hiện kết thúc khi đang lật');
    await pg.waitForSelector('.ar-end:not([hidden])', { timeout: 8000 });
    assert.equal(await text(pg, '.ar-etitle'), 'Bạn thắng');
  }, '&jump=A:choosing:6');

  /* ===== rời trận, nút Back, hide ===== */
  await t('Về chánh điện: không có trận thì đi luôn; có trận thì hỏi xác nhận, đồng ý thì pk:forfeit rồi về', 'mobile', async pg => {
    await pg.waitForSelector('.ar-row');
    await pg.click('.ar-back');
    await pg.waitForFunction(() => Places.current === 'hall');
    assert.equal((await sent(pg, 'pk:forfeit')).length, 0);
    await pg.click('#goArena'); await pg.waitForFunction(() => Places.current === 'arena');
    await pg.waitForSelector('.ar-row');
    assert.ok(await vis(pg, '#place-arena'));
  });
  await t('Có trận: Về chánh điện hỏi xác nhận; Ở lại đóng hộp; Bỏ cuộc gửi pk:forfeit rồi về chánh điện', 'mobile', async pg => {
    await waitTurn(pg, 2);
    await pg.click('.ar-back');
    await pg.waitForSelector('dialog[open]');
    assert.match(await text(pg, 'dialog[open]'), /Rời trận nghĩa là bỏ cuộc/);
    await noOverflow(pg, 'hộp rời trận'); await shot(pg, 'dlg-leave');
    await pg.click('dialog[open] .btn.primary');
    await pg.waitForSelector('dialog[open]', { state: 'detached' });
    assert.equal(await pg.evaluate(() => Places.current), 'arena');
    assert.equal((await sent(pg, 'pk:forfeit')).length, 0);
    await pg.click('.ar-back'); await pg.click('dialog[open] .btn:has-text("Bỏ cuộc")');
    await pg.waitForFunction(() => Places.current === 'hall');
    const f = await sent(pg, 'pk:forfeit');
    assert.equal(f.length, 1); assert.equal(f[0].matchId, await pg.evaluate(() => H.state.match.id));
    assert.ok(!(await vis(pg, '#place-arena')));
    // hide() phải dừng hết hẹn giờ và vòng vẽ
    await pg.waitForTimeout(300);
    assert.deepEqual(await pg.evaluate(() => ({ iv: window.__iv.size, raf: window.__raf.size })), { iv: 0, raf: 0 }, 'còn hẹn giờ / vòng vẽ chạy sau khi rời sân');
  }, '&jump=A:choosing:2');
  await t('Nút Back của điện thoại bị chặn khi đang có trận (Places.popstate + inMatch)', 'mobile', async pg => {
    await waitTurn(pg, 2);
    await pg.evaluate(() => history.back());
    await pg.waitForFunction(() => H.toasts.some(t => /Đang có trận/.test(t)));
    assert.equal(await pg.evaluate(() => Places.current), 'arena');
    assert.ok(await vis(pg, '.ar-matchbox'));
  }, '&jump=A:choosing:2');
  await t('Sau khi rời sân: sự kiện pk:* muộn không được vẽ gì', 'mobile', async pg => {
    await waitTurn(pg, 2);
    await pg.click('.ar-back'); await pg.click('dialog[open] .btn:has-text("Bỏ cuộc")');
    await pg.waitForFunction(() => Places.current === 'hall');
    await pg.evaluate(() => { H.sendEnd('forfeit-you'); H.send('pk:turn', { matchId: 'zzz', turn: 1 }); });
    await pg.waitForTimeout(300);
    assert.ok(!(await vis(pg, '#place-arena')));
    assert.equal(await count(pg, '.ar-end:not([hidden])'), 0);
  }, '&jump=A:choosing:2');

  /* ===== giảm chuyển động, kích thước ===== */
  await t('Giảm chuyển động: lật chiêu hiện ngay, không hoạt ảnh lật / rung / chạy số', 'reduced', async pg => {
    await pg.waitForSelector('.ar-pk');
    await pg.click('.ar-pk[data-skill="nhu-van-bo"]'); await pg.click('.ar-lockbtn');
    await waitReveal(pg);
    await pg.waitForTimeout(150);
    const rev = FX.A.reveals[1];
    assert.equal(await pg.$$eval('.ar-flip.on', f => f.length), 2, 'thẻ phải lật ngay');
    assert.equal(await count(pg, '.ar-lines li'), narrCount(rev), 'đủ dòng ngay');
    assert.equal(await text(pg, '.ar-fc-you .ar-hp .ar-m-v'), hpText(rev.state.you), 'HP về giá trị cuối ngay, không chạy số');
    assert.match(await text(pg, '.ar-pair'), /Né gặp Công/);
    const info = await pg.evaluate(() => ({
      tr: getComputedStyle(document.querySelector('.ar-flip-in')).transitionDuration,
      anim: document.getAnimations().filter(a => a.effect && a.effect.target && a.effect.target.closest && a.effect.target.closest('.ar-root') && a.animationName !== 'ar-fade' && a.playState === 'running').map(a => a.animationName || a.transitionProperty)
    }));
    assert.ok(parseFloat(info.tr) < 0.01, 'transition lật còn chạy: ' + info.tr);
    assert.deepEqual(info.anim, [], 'còn hoạt ảnh chạy');
    await shot(pg, 'reduced-reveal');
    await waitTurn(pg, 3);
  }, '&jump=A:choosing:2');
  await t('Vừa một màn hình 390x844: không cuộn khi chọn chiêu và khi lật chiêu', 'mobile', async pg => {
    await waitTurn(pg, 4);
    let m = await matchFits(pg); assert.ok(m.over <= 1, 'cuộn khi chọn: ' + m.over); assert.ok(m.stage >= 130, 'sân khấu: ' + m.stage);
    await pg.waitForSelector('.ar-reveal:not([hidden])', { timeout: 6000 });
    m = await matchFits(pg); assert.ok(m.over <= 1, 'cuộn khi lật: ' + m.over);
    console.log('      390x844: sân khấu cao ' + m.stage + 'px');
  }, '&jump=A:choosing:4');
  await t('Vừa màn hình 390x740 (có thanh trình duyệt): không cuộn', 'm740', async pg => {
    await pg.waitForSelector('.ar-pk');
    let m = await matchFits(pg); assert.ok(m.over <= 1, 'cuộn: ' + m.over); assert.ok(m.stage >= 90, 'sân khấu: ' + m.stage);
    await noOverflow(pg, '390x740'); await shot(pg, 'match-390x740');
    await pg.click('.ar-pk[data-skill="nhu-van-bo"]'); await pg.click('.ar-lockbtn'); await waitReveal(pg);
    m = await matchFits(pg); assert.ok(m.over <= 1, 'cuộn khi lật: ' + m.over);
    console.log('      390x740: sân khấu cao ' + m.stage + 'px');
  }, '&jump=A:choosing:2');
  await t('Màn nhỏ 360x640: không tràn ngang, thông tin cuộn dọc nếu thiếu chỗ (ghi nhận)', 'm640', async pg => {
    await pg.waitForSelector('.ar-pk');
    await noOverflow(pg, '360x640');
    const m = await matchFits(pg);
    console.log('      360x640: cuộn dư ' + m.over + 'px, sân khấu cao ' + m.stage + 'px');
    await shot(pg, 'match-360x640');
  }, '&jump=A:choosing:2');
  await t('Màn rộng 1280x800: hai cột, trận không cuộn, không tràn', 'desk', async pg => {
    await pg.waitForSelector('.ar-pk');
    const g = await pg.evaluate(() => { const a = document.querySelector('.ar-fc-op').getBoundingClientRect(), b = document.querySelector('.ar-fc-you').getBoundingClientRect(); return { sameRow: Math.abs(a.top - b.top) < 4, left: a.left < b.left }; });
    assert.ok(g.sameRow && g.left, 'hai thẻ phải nằm cạnh nhau');
    const m = await matchFits(pg); assert.ok(m.over <= 1, 'cuộn: ' + m.over); assert.ok(m.stage >= 250, 'sân khấu: ' + m.stage);
    await noOverflow(pg, 'trận 1280'); await shot(pg, 'desk-match');
  }, '&jump=A:choosing:2');
  await t('Màn rộng: sân hai cột', 'desk', async pg => {
    await pg.waitForSelector('.ar-row');
    const g = await pg.evaluate(() => { const s = document.querySelector('.ar-side').getBoundingClientRect(), l = document.querySelector('.ar-listbox').getBoundingClientRect(); return s.right <= l.left + 1 && s.width > 200; });
    assert.ok(g, 'cột điều khiển phải nằm bên trái danh sách');
    await noOverflow(pg, 'sân 1280'); await shot(pg, 'desk-roster');
  });

  /* ===== sảnh với buff nặng, thẻ chân dung ===== */
  await t('Sảnh buff nặng: chân dung hào quang / pháp tướng / quỷ vẽ được, nhãn buff đủ', 'mobile', async pg => {
    await pg.evaluate(() => H.startLobby({ buffs: 'heavy', opReady: 60000 }));
    await pg.waitForSelector('.ar-lobby:not([hidden])');
    await pg.waitForTimeout(500);
    const lab = await text(pg, '.ar-vs');
    assert.ok(/Pháp tướng cấp 5/.test(lab) && /Hào quang cảnh giới 7/.test(lab) && /Quỷ ám cấp 3/.test(lab), lab);
    const painted = await pg.$$eval('.ar-portrait', cs => cs.map(c => { const x = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 0; i < x.length; i += 40) if (x[i] > 60 || x[i + 1] > 60) n++; return n; }));
    assert.ok(painted.every(n => n > 150), 'chân dung trống: ' + painted);
    await noOverflow(pg, 'sảnh buff'); await shot(pg, 'lobby-heavy');
    await pg.waitForFunction(() => /Hết giờ|\d+/.test(document.querySelector('.ar-clock b').textContent));
  });
  await t('Sảnh: hết giờ → hiện dòng chờ máy chủ tự điền, rồi sang lượt 1', 'mobile', async pg => {
    await pg.evaluate(() => H.startLobby({ lobbyMs: 2500, opReady: 60000 }));
    await pg.waitForSelector('.ar-lobby:not([hidden])');
    await pg.waitForFunction(() => /Hết giờ/.test((document.querySelector('.ar-wait') || {}).textContent || ''), null, { timeout: 4000 });
    assert.ok(await pg.$eval('.ar-lb-act .btn', b => b.disabled || b.hidden));
    await waitTurn(pg, 1);
  });
  await t('Máy chủ gửi pk:turn TRƯỚC ack của pk:loadout: lượt 1 không bị dính trạng thái "đã khóa"', 'mobile', async pg => {
    await pg.evaluate(() => H.startLobby({ opReady: 100 }));
    await pg.waitForSelector('.ar-lobby:not([hidden])');
    await pg.waitForFunction(() => H.state.match.opLocked);
    await pg.click('.ar-lb-act .btn');
    await waitTurn(pg, 1);
    await pg.waitForTimeout(400);                                  // đủ để ack muộn đến nơi
    assert.match(await text(pg, '.ar-status'), /Chạm một chiêu để chọn/);
    await pg.click('.ar-pk[data-skill="trong-quyen"]');
    assert.equal(await pg.getAttribute('.ar-pk[data-skill="trong-quyen"]', 'aria-pressed'), 'true');
    assert.ok(!(await pg.$eval('.ar-lockbtn', b => b.hidden || b.disabled)), 'nút Khóa phải dùng được');
  });
  await t('Chỉ khóa được khi đủ 4 chiêu; lỗi pk:loadout hiện tại chỗ', 'mobile', async pg => {
    await pg.evaluate(() => H.startLobby({ opReady: 60000 }));
    await pg.waitForSelector('.ar-lobby:not([hidden])');
    await pg.evaluate(() => { H.opts.fail['pk:loadout'] = { ok: false, reason: 'Sảnh vừa đóng (giả lập).' }; });
    await pg.click('.ar-lb-act .btn');
    await waitText(pg, '.ar-lw', 'giả lập');
    assert.ok(!(await pg.$eval('.ar-lb-act .btn', b => b.hidden)), 'lỗi thì vẫn cho khóa lại');
  });

  await browser.b.close();
  const bad = results.filter(r => !r[0]);
  console.log(`\n${results.length - bad.length}/${results.length} kiểm tra đạt. Ảnh chụp: ${SHOTS}`);
  process.exit(bad.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
