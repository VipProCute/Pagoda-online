'use strict';
/*
 * Kiểm tra tự động giao diện Võ Học Các bằng Chromium thật + máy chủ giả (sim.js).
 *   node tools/ui-harness/dojo/test.js            chạy mọi kiểm tra, chụp ảnh vào $DOJO_SHOTS (mặc định thư mục tạm)
 *   DOJO_SHOTS=0 node ...                          không chụp ảnh
 * Tự mở máy chủ tĩnh cổng 4173 nếu chưa có; một trình duyệt, đóng khi xong.
 */
const http = require('http');
const os = require('os');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { chromium } = require('playwright');

const PORT = 4173, BASE = `http://127.0.0.1:${PORT}/harness/dojo/`;
const SHOTS = process.env.DOJO_SHOTS === '0' ? null : (process.env.DOJO_SHOTS || path.join(os.tmpdir(), 'dojo-shots'));
const fails = [];
let passed = 0;
const ok = (cond, msg) => { if (cond) passed++; else { fails.push(msg); console.log('  HỎNG: ' + msg); } };
const section = name => console.log('\n# ' + name);
const sleep = ms => new Promise(r => setTimeout(r, ms));

const QR_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="#fff"/><g fill="#000">'
  + Array.from({ length: 150 }, (_, i) => `<rect x="${(i * 37) % 190}" y="${(i * 53) % 190}" width="12" height="12"/>`).join('') + '</g></svg>';

function serverUp() {
  return new Promise(res => { const r = http.get(BASE, x => { x.resume(); res(true); }); r.on('error', () => res(false)); r.setTimeout(1500, () => { r.destroy(); res(false); }); });
}

async function main() {
  let child = null;
  if (!(await serverUp())) {
    child = spawn(process.execPath, [path.join(__dirname, '..', 'serve.js'), String(PORT)], { stdio: 'ignore' });
    for (let i = 0; i < 30 && !(await serverUp()); i++) await sleep(200);
  }
  if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch();
  try { await run(browser); } finally { await browser.close(); if (child) child.kill(); }
  console.log(`\nĐạt ${passed} kiểm tra, hỏng ${fails.length}.`);
  if (fails.length) { fails.forEach(f => console.log(' - ' + f)); process.exitCode = 1; }
}

/** Mở một trang thử. Trả { page, ctx, errs }. */
async function open(browser, scen, o = {}) {
  const ctx = await browser.newContext({ viewport: { width: o.w || 390, height: o.h || 844 }, deviceScaleFactor: 1, reducedMotion: o.reduced ? 'reduce' : 'no-preference', permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await ctx.newPage(), errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
  await page.route('https://img.vietqr.io/**', r => r.fulfill({ contentType: 'image/svg+xml', body: QR_SVG }));
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ contentType: 'text/css', body: '' }));
  await page.addInitScript(() => {
    window.__iv = new Set(); window.__to = new Set(); window.__confirm = 0;
    const si = window.setInterval, ci = window.clearInterval, st = window.setTimeout, ct = window.clearTimeout;
    window.setInterval = (f, ms, ...a) => { const id = si(f, ms, ...a); window.__iv.add(id); return id; };
    window.clearInterval = id => { window.__iv.delete(id); return ci(id); };
    window.setTimeout = (f, ms, ...a) => { const id = st(() => { window.__to.delete(id); f(...a); }, ms); window.__to.add(id); return id; };
    window.clearTimeout = id => { window.__to.delete(id); return ct(id); };
    window.confirm = () => { window.__confirm++; return true; };
  });
  await page.goto(BASE + '?s=' + scen + (o.extra || ''));
  await page.waitForFunction(() => window.ready);
  if (o.tab) await page.evaluate(t => { try { localStorage.setItem('ta-dojo-tab', t); } catch (e) { /* bỏ qua */ } }, o.tab).then(() => page.reload()).then(() => page.waitForFunction(() => window.ready));
  await page.waitForSelector('.dj-panel > *', { timeout: 5000 });
  await sleep(120);
  return { page, ctx, errs };
}
const sent = (page, ev) => page.evaluate(e => H.sock.sent.filter(x => x.event === e).map(x => x.data), ev);
const text = (page, sel) => page.evaluate(s => { const e = document.querySelector(s); return e ? e.textContent.replace(/\s+/g, ' ').trim() : null; }, sel);
const has = async (page, sel) => (await page.$(sel)) !== null;
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, name + '.png') }); };
const toastText = page => text(page, '#toast');
const tab = async (page, id) => { await page.click(`[data-tab="${id}"]`); await sleep(120); };
const noOverflow = (page, label) => page.evaluate(() => {
  const d = document.documentElement, p = document.getElementById('place-dojo');
  const bad = [];
  p.querySelectorAll('*').forEach(e => { const r = e.getBoundingClientRect(); if (r.width && r.right > innerWidth + 1) bad.push(e.className || e.tagName); });
  return { page: d.scrollWidth <= innerWidth, place: p.scrollWidth <= p.clientWidth, bad: bad.slice(0, 5) };
}).then(r => ok(r.page && r.place && !r.bad.length, `${label}: tràn ngang ${JSON.stringify(r)}`));
const smallTargets = (page, label) => page.evaluate(() => {
  const out = [];
  document.querySelectorAll('#place-dojo button, #place-dojo summary, #place-dojo input[type=checkbox]').forEach(e => {
    const r = e.getBoundingClientRect(); if (!r.width) return;
    const lab = e.closest('label'), box = lab ? lab.getBoundingClientRect() : r;
    if (Math.max(r.height, box.height) < 43.5) out.push((e.textContent || e.className).trim().slice(0, 30) + ' ' + Math.round(r.height));
  });
  return out;
}).then(r => ok(!r.length, `${label}: vùng chạm dưới 44px: ${r.join(' | ')}`));

async function run(browser) {
  /* ---------- 1. chưa có phiên ---------- */
  section('Chưa có phiên');
  {
    const { page, ctx, errs } = await open(browser, 'idle', { tab: 'tam' });
    ok(await has(page, '.dj-prof'), 'dải hồ sơ hiện');
    ok((await text(page, '.dj-seal')).includes('3'), 'cấp nội công 3');
    ok((await text(page, '.dj-cl')).includes('180') && (await text(page, '.dj-cl')).includes('300'), 'công lực 180/300');
    ok((await text(page, '.dj-line')).includes('88'), 'nội lực tối đa 88');
    ok((await text(page, '.dj-tam')).includes('45/300'), 'tâm đắc Cương 45/300');
    ok((await text(page, '.dj-rec')).replace(/\s/g, '') === 'Thắng3·Thua1·Hòa0', 'thắng/thua/hòa');
    ok((await page.$$('.dj-m')).length === 6, '6 công pháp');
    ok((await page.$$('.dj-m.is-locked')).length === 2, '2 công pháp khóa (cấp 5 và 8)');
    ok((await text(page, '.dj-m.is-locked')).includes('Cần cấp 5'), 'khóa ghi "Cần cấp 5"');
    ok((await page.$eval('[data-fk="dur:cuu-am-tam-kinh:4h"]', e => e.disabled)), 'nút công pháp khóa bị vô hiệu');
    const t = await text(page, '[data-fk="dur:kim-cuong-tam-phap:4h"]');
    ok(t.includes('4 giờ') && t.includes('+50 công lực') && t.includes('tâm đắc Cương +50'), 'lựa chọn 4 giờ ghi +50 công lực và tâm đắc Cương +50: ' + t);
    ok((await text(page, '.dj-link')) === 'Ra sân đấu →', 'chỉ có liên kết phụ "Ra sân đấu"');
    ok(!(await page.evaluate(() => /mời đấu|Mời đấu|thách đấu/i.test(document.getElementById('place-dojo').textContent))), 'không có nút mời đấu');
    await noOverflow(page, 'idle/tam 390'); await smallTargets(page, 'idle/tam 390');
    await shot(page, 'idle-tam-390');
    // bắt đầu phiên
    await page.click('[data-fk="dur:kim-cuong-tam-phap:4h"]');
    await page.waitForSelector('.dj-sess');
    const st = await sent(page, 'tu:start');
    ok(st.length === 1 && st[0].methodId === 'kim-cuong-tam-phap' && st[0].duration === '4h', 'gửi tu:start {methodId, duration:"4h"}: ' + JSON.stringify(st));
    ok(/^\d\d:\d\d:\d\d$/.test(await text(page, '.dj-cd')), 'đồng hồ đếm ngược hh:mm:ss: ' + await text(page, '.dj-cd'));
    ok((await text(page, '.dj-keep')).includes('Có thể đóng web, hết giờ máy chủ tự ghi nhận.'), 'câu "Có thể đóng web…"');
    const c1 = await text(page, '.dj-cd'); await sleep(2100);
    ok(c1 !== await text(page, '.dj-cd'), 'đồng hồ chạy mỗi giây');
    // hủy có xác nhận ngay trong trang
    await page.click('[data-fk="cancel:open"]');
    ok(await has(page, '[role=group][aria-label="Xác nhận hủy phiên tu"]'), 'hỏi xác nhận hủy trong trang');
    ok((await text(page, '.dj-confirm')).includes('Hủy là mất hết tiến độ phiên này'), 'chữ "Hủy là mất hết tiến độ phiên này"');
    ok((await sent(page, 'tu:cancel')).length === 0, 'chưa gửi tu:cancel khi chưa xác nhận');
    ok(await page.evaluate(() => document.activeElement && document.activeElement.dataset.fk) === 'cancel:keep', 'tiêu điểm vào nút "Giữ lại"');
    await page.click('[data-fk="cancel:keep"]');
    ok(!(await has(page, '.dj-confirm')), '"Giữ lại" đóng hộp xác nhận');
    await page.click('[data-fk="cancel:open"]'); await shot(page, 'cancel-confirm-390');
    await page.click('[data-fk="cancel:yes"]');
    await page.waitForSelector('.dj-methods');
    const cc = await sent(page, 'tu:cancel');
    ok(cc.length === 1 && cc[0].sessionId === 100, 'gửi tu:cancel {sessionId}: ' + JSON.stringify(cc));
    ok((await toastText(page)).includes('Đã hủy phiên tu'), 'toast hủy: ' + await toastText(page));
    ok(await page.evaluate(() => window.__confirm) === 0, 'không dùng confirm()');
    ok(errs.length === 0, 'idle: không lỗi console: ' + errs.join('; '));
    await ctx.close();
  }

  /* ---------- 2. đang có phiên + hoàn thành ngay ---------- */
  section('Phiên đang chạy, hoàn thành ngay');
  {
    const { page, ctx, errs } = await open(browser, 'active', { tab: 'tam' });
    ok((await text(page, '.dj-cd')).startsWith('03:2'), 'đếm ngược ~03:21: ' + await text(page, '.dj-cd'));
    ok(await has(page, '.dj-sp'), 'có khối hoàn thành ngay');
    const sp = await text(page, '.dj-sp');
    for (const k of ['20.000đ', 'Ban điều hành xác nhận thủ công', 'mất vài giờ', 'Chỉ khi được xác nhận', 'công đức, hào quang và lời thông báo', 'rút ngắn thời gian', '3.000', 'nội lực tối đa vẫn chỉ tăng theo cấp nội công', 'tối đa 2 lần', 'Ẩn danh'])
      ok(sp.includes(k), 'khối hoàn thành ngay có chữ "' + k + '"');
    await noOverflow(page, 'active/tam 390'); await smallTargets(page, 'active/tam 390');
    await shot(page, 'active-390');
    await page.check('.dj-check input');
    await page.click('[data-fk="sp:go"]');
    await page.waitForSelector('.dj-qr-img');
    const r = (await sent(page, 'tu:speedup'))[0];
    ok(r && r.sessionId === 100 && r.anon === true, 'gửi tu:speedup {sessionId, anon:true}: ' + JSON.stringify(r));
    const src = await page.$eval('.dj-qr-img', e => e.src);
    ok(src.startsWith('https://img.vietqr.io/'), 'ảnh QR từ vietqr');
    await page.waitForFunction(() => document.querySelector('.dj-qr-img').naturalWidth > 0);
    const pv = await text(page, '.dj-pend');
    ok(pv.includes('Đang chờ Ban điều hành xác nhận'), 'trạng thái đang chờ');
    ok(pv.includes('20.000đ') && pv.includes('TA7400K') && pv.includes('MB Bank') && pv.includes('0123456789') && pv.includes('CHUA TAM AN'), 'số tiền, nội dung, ngân hàng, số tài khoản, tên chủ tài khoản: ' + pv.slice(0, 200));
    await page.click('[aria-label="Chép nội dung chuyển khoản"]');
    await sleep(150);
    ok((await toastText(page)).includes('Đã chép'), 'nút Chép: ' + await toastText(page));
    ok(await page.evaluate(() => navigator.clipboard.readText()) === 'TA7400K', 'clipboard có mã chuyển khoản');
    await shot(page, 'speedup-pending-390');
    // ngân hàng báo
    await page.evaluate(() => H.ctl.bankReport());
    await page.evaluate(() => Dojo.refresh()); await sleep(250);
    ok((await text(page, '.dj-status')).includes('Ngân hàng đã báo nhận, chờ Ban điều hành xác nhận'), 'bankReported hiện: ' + await text(page, '.dj-status'));
    ok(!(await has(page, '[data-fk="sp:open"]')), 'đã bankReported thì không còn nút hủy yêu cầu');
    // Ban điều hành xác nhận
    await page.evaluate(() => H.ctl.confirm());
    await page.waitForSelector('.dj-celeb');
    ok((await toastText(page)).includes('Tịnh tài đã được xác nhận'), 'toast tu:update: ' + await toastText(page));
    const cl = await text(page, '.dj-celeb');
    ok(cl.includes('đã viên mãn nhờ hoàn thành ngay') && cl.includes('+50 công lực') && cl.includes('Cương +50'), 'thẻ "vừa hoàn thành": ' + cl);
    await sleep(200);
    const seen = await sent(page, 'martial:seen');
    ok(seen.length === 1 && seen[0].ids.includes(100), 'gửi martial:seen: ' + JSON.stringify(seen));
    ok(!(await has(page, '.dj-sess')) && await has(page, '.dj-methods'), 'hết phiên thì hiện danh sách công pháp');
    ok((await text(page, '.dj-cl')).includes('230'), 'công lực cập nhật 230');
    await shot(page, 'celebrate-390');
    ok(errs.length === 0, 'active: không lỗi console: ' + errs.join('; '));
    await ctx.close();
  }
  {
    const { page, ctx } = await open(browser, 'active', { tab: 'tam' });
    await page.click('[data-fk="sp:go"]'); await page.waitForSelector('.dj-qr-img');
    ok((await sent(page, 'tu:speedup'))[0].anon === false, 'không tick Ẩn danh thì anon:false');
    // hủy yêu cầu có xác nhận
    await page.click('[data-fk="sp:open"]');
    ok((await text(page, '.dj-confirm')).includes('Nếu bạn đã chuyển khoản rồi thì đừng hủy'), 'hủy yêu cầu có hỏi lại');
    ok((await sent(page, 'tu:speedup:cancel')).length === 0, 'chưa gửi hủy yêu cầu khi chưa xác nhận');
    await page.click('[data-fk="sp:yes"]');
    await page.waitForSelector('[data-fk="sp:go"]');
    const sc = await sent(page, 'tu:speedup:cancel');
    ok(sc.length === 1 && sc[0].code === 'TA7400K', 'gửi tu:speedup:cancel {code}: ' + JSON.stringify(sc));
    // bị từ chối
    await page.click('[data-fk="sp:go"]'); await page.waitForSelector('.dj-qr-img');
    await page.evaluate(() => H.ctl.reject());
    await sleep(400);
    ok((await toastText(page)).includes('không được xác nhận'), 'speedup-rejected hiện toast');
    ok(await has(page, '[data-fk="sp:go"]'), 'sau bị từ chối hiện lại nút cúng dường');
    await ctx.close();
  }

  /* ---------- 3. mở lại trang thấy yêu cầu đang chờ ---------- */
  section('Yêu cầu hoàn thành ngay đang chờ khi mở lại');
  {
    const { page, ctx, errs } = await open(browser, 'speedup', { tab: 'tam' });
    await page.waitForSelector('.dj-qr-img');
    const r = (await sent(page, 'tu:speedup'));
    ok(r.length === 1 && r[0].anon === false, 'gọi lại tu:speedup để lấy lại QR: ' + JSON.stringify(r));
    ok((await text(page, '.dj-pend')).includes('TA7391K') && (await text(page, '.dj-pend')).includes('20.000đ'), 'hiện đúng mã và số tiền cũ');
    await noOverflow(page, 'speedup/tam 390');
    ok(errs.length === 0, 'speedup: không lỗi console: ' + errs.join('; '));
    await ctx.close();
  }
  {
    const { page, ctx } = await open(browser, 'bank', { tab: 'tam' });
    await page.waitForSelector('.dj-qr-img');
    ok((await text(page, '.dj-status')).includes('Ngân hàng đã báo nhận'), 'bank: hiện "Ngân hàng đã báo nhận"');
    ok(!(await has(page, '[data-fk="sp:open"]')), 'bank: không có nút hủy yêu cầu');
    await ctx.close();
  }
  {   // an toàn: dữ liệu máy chủ không được chạy như HTML, QR lạ không được dùng làm src
    const { page, ctx } = await open(browser, 'active', { tab: 'tam' });
    await page.evaluate(() => {
      H.sock.handlers['tu:speedup'] = () => ({ ok: true, existing: false, code: 'TA9999K', amount: 20000, qr: 'https://evil.example/q.png', bank: '<img src=x onerror="window.__xss=1">', account: '1', accountName: '<b>x</b>' });
    });
    await page.click('[data-fk="sp:go"]'); await page.waitForSelector('.dj-pend'); await sleep(300);
    ok(!(await has(page, '.dj-qr-img')), 'QR không phải img.vietqr.io thì không dùng làm src');
    ok((await text(page, '.dj-pend')).includes('<img src=x') && !(await page.evaluate(() => window.__xss)), 'chữ từ máy chủ hiện nguyên văn, không chạy');
    ok(!(await has(page, '.dj-pend img')), 'không sinh phần tử img từ dữ liệu');
    await ctx.close();
  }

  /* ---------- 4. phiếu ---------- */
  section('Phiếu hoàn thành ngay');
  {
    const { page, ctx } = await open(browser, 'vouchers', { tab: 'tam' });
    const btns = await page.$$('[data-fk^="v:"]');
    ok(btns.length === 1 && (await btns[0].textContent()).includes('20.000đ'), 'chỉ phiếu đủ giá (>= 20.000đ) có nút "Dùng phiếu"');
    ok((await text(page, '.dj-voucher')).includes('1 phiếu trị giá chưa đủ'), 'ghi chú phiếu chưa đủ');
    await shot(page, 'voucher-390');
    await btns[0].click();
    await page.waitForSelector('.dj-celeb');
    const v = await sent(page, 'tu:voucher');
    ok(v.length === 1 && v[0].voucherId === 7 && v[0].sessionId === 100, 'gửi tu:voucher: ' + JSON.stringify(v));
    ok((await text(page, '.dj-celeb')).includes('nhờ phiếu hoàn thành ngay'), 'thẻ chúc mừng ghi "nhờ phiếu"');
    await ctx.close();
  }

  /* ---------- 5. phiên vừa xong, cấp tối đa, hết giờ ---------- */
  section('Phiên vừa xong · cấp tối đa · hết giờ');
  {
    const { page, ctx } = await open(browser, 'done', { tab: 'tam' });
    const c = await text(page, '.dj-celeb');
    ok(c.includes('Kim Cương Tâm Pháp') && c.includes('+50 công lực') && c.includes('tâm đắc Cương +50') && c.includes('Nội công lên cấp 4'), 'thẻ chúc mừng có công lực, tâm đắc, lên cấp: ' + c);
    ok((await page.$$('.dj-celeb')).length === 1, 'chỉ phiên chưa seen mới có thẻ');
    await sleep(150);
    ok((await sent(page, 'martial:seen')).length === 1, 'gửi martial:seen sau khi hiện');
    await shot(page, 'done-390');
    await page.click('.dj-celeb .dj-x'); ok(!(await has(page, '.dj-celeb')), 'đóng thẻ chúc mừng');
    await ctx.close();
  }
  {
    const { page, ctx } = await open(browser, 'max', { tab: 'tam' });
    ok((await text(page, '.dj-cl')).includes('Viên mãn'), 'cấp tối đa ghi "Viên mãn"');
    ok((await text(page, '.dj-seal')).includes('10') && (await text(page, '.dj-line')).includes('116'), 'cấp 10, nội lực 116');
    ok((await text(page, '[data-fk="dur:vo-cuc-chan-kinh:12h"]')).includes('Công lực đã đầy'), 'công lực đầy thì ghi rõ');
    ok((await page.$$('.dj-m.is-locked')).length === 0, 'cấp 10 không công pháp nào khóa');
    await shot(page, 'max-390');
    await ctx.close();
  }
  {
    const { page, ctx } = await open(browser, 'ending', { tab: 'tam' });
    const before = (await page.evaluate(() => H.sim.log.length));
    await page.waitForSelector('.dj-celeb', { timeout: 9000 });
    const after = await page.evaluate(() => H.sim.log.length);
    ok(after > before, 'đếm về 0 thì hỏi lại martial:state (' + before + ' → ' + after + ')');
    ok((await text(page, '.dj-celeb')).includes('đã viên mãn'), 'nhận kết quả phiên sau khi hết giờ');
    ok(!(await has(page, '.dj-sess')), 'hết giờ thì không còn thẻ phiên');
    await ctx.close();
  }
  {   // giờ máy chủ: dùng serverNow(), không dùng đồng hồ máy
    const { page, ctx } = await open(browser, 'active', { tab: 'tam', extra: '&skew=3600000' });
    ok((await text(page, '.dj-cd')).startsWith('03:2'), 'đếm theo giờ máy chủ (lệch 1 giờ vẫn 03:2x): ' + await text(page, '.dj-cd'));
    await ctx.close();
  }

  /* ---------- 6. tab Võ học ---------- */
  section('Tab Võ học');
  {
    const { page, ctx, errs } = await open(browser, 'idle', { tab: 'vo' });
    ok((await page.$$('.dj-sk')).length === 15, '15 thẻ chiêu');
    ok((await page.$$('.dj-branch')).length === 3, '3 nhánh');
    ok((await page.$$eval('.dj-branch', n => n.map(x => x.querySelectorAll('.dj-sk').length))).join() === '5,5,5', 'mỗi nhánh 5 chiêu');
    ok((await text(page, '.dj-intro-box')).includes('không tốn gì') && (await text(page, '.dj-intro-box')).includes('Không khóa phái'), 'ghi rõ học không tốn gì, không khóa phái');
    ok((await page.$$('.dj-sk.is-learned')).length === 6 && (await page.$$('.dj-sk.is-open')).length === 1, '6 đã học, 1 học được');
    const lock = await text(page, '[data-fk="sk:phan-chan"]');
    ok(lock.includes('Còn thiếu') && /cấp nội công 5/i.test(lock) && lock.includes('120 tâm đắc Cương') && lock.includes('45/120'), 'chiêu khóa ghi điều kiện còn thiếu và tiến độ tâm đắc: ' + lock);
    ok((await page.$eval('[data-fk="sk:phan-chan"] [role=progressbar]', e => e.getAttribute('aria-valuenow'))) === '38', 'thanh tiến độ tâm đắc 45/120 ≈ 38%');
    ok(((await page.getAttribute('[data-fk="sk:kim-chung-trao"]', 'aria-label')) || '').includes('học được'), 'aria-label thẻ chiêu có trạng thái');
    await noOverflow(page, 'idle/vo 390'); await smallTargets(page, 'idle/vo 390');
    await page.click('[data-fk="learn:kim-chung-trao"]');
    await page.waitForSelector('[data-fk="sk:kim-chung-trao"].is-learned');
    const l = await sent(page, 'vo:learn');
    ok(l.length === 1 && l[0].skillId === 'kim-chung-trao', 'gửi vo:learn {skillId}');
    ok((await text(page, '[data-tab=vo]')).includes('7/15'), 'số chiêu đã học 7/15');
    ok((await toastText(page)).includes('Đã lĩnh hội Kim Chung Tráo'), 'toast lĩnh hội');
    await page.click('[data-tab=bo]'); await sleep(100);
    ok(await has(page, '[data-fk="lib:kim-chung-trao"]'), 'chiêu mới học có trong kho bộ chiêu');
    ok(errs.length === 0, 'vo: không lỗi console: ' + errs.join('; '));
    await ctx.close();
  }
  {   // lỗi ack khi học
    const { page, ctx } = await open(browser, 'idle', { tab: 'vo' });
    await page.evaluate(() => H.ctl.fail('vo:learn', { ok: false, reason: 'Thử lỗi: chưa đủ điều kiện.', code: 'req' }));
    await page.click('[data-fk="learn:kim-chung-trao"]'); await sleep(250);
    ok((await toastText(page)).includes('Thử lỗi'), 'lỗi ack hiện toast');
    ok((await text(page, '.dj-intro-box')).includes('Thử lỗi'), 'lỗi ack hiện dòng cảnh báo tại chỗ');
    await ctx.close();
  }

  /* ---------- 7. tab Bộ chiêu ---------- */
  section('Tab Bộ chiêu');
  {
    const { page, ctx, errs } = await open(browser, 'max', { tab: 'bo' });
    ok((await page.$$('.dj-slot.filled')).length === 4, '4 ô đã đầy');
    ok((await text(page, '.dj-intro-box')).includes('trong sảnh 30 giây'), 'nhắc đổi trong sảnh 30 giây');
    ok((await page.$$('.dj-lc')).length === 15, 'kho 15 chiêu đã học');
    ok((await page.$eval('[data-fk="save"]', e => e.disabled)), 'chưa đổi gì thì nút lưu mờ');
    // bỏ 2 chiêu công, chọn 2 chiêu thủ không có công
    await page.click('[data-fk="slot:tu-luc-pha-son"]');
    await page.click('[data-fk="slot:tu-lang-bat-thien-can"]');
    ok(!(await has(page, '.dj-warns')), 'chưa đủ 4 thì chưa cảnh báo');
    await page.click('[data-fk="lib:thiet-bich"]'); await page.click('[data-fk="lib:nhu-van-bo"]');
    ok((await text(page, '.dj-warns')).includes('không có đòn tấn công chủ động') && (await text(page, '.dj-warns')).includes('không có chiêu nào gây sát thương'), 'cảnh báo cục bộ ngay khi đủ 4: ' + await text(page, '.dj-warns'));
    ok(!(await page.$eval('[data-fk="save"]', e => e.disabled)), 'cảnh báo KHÔNG chặn lưu');
    await page.click('[data-fk="lib:phan-chan"]'); await sleep(80);
    ok((await text(page, '.dj-loadout')).includes('Đã đủ 4 chiêu') || (await text(page, '.dj-loadout')).includes('Đã chọn 4/4'), 'thêm chiêu thứ 5 bị chặn, có báo');
    await shot(page, 'loadout-warn-390');
    await page.click('[data-fk="save"]'); await sleep(250);
    const sv = await sent(page, 'vo:loadout');
    ok(sv.length === 1 && sv[0].skills.length === 4 && sv[0].skills.includes('thiet-bich') && sv[0].skills.includes('nhu-van-bo'), 'gửi vo:loadout {skills:[4]}: ' + JSON.stringify(sv));
    ok((await toastText(page)).includes('Đã lưu bộ chiêu'), 'toast đã lưu');
    ok((await text(page, '.dj-warns')).includes('không có đòn tấn công'), 'warnings từ ack vẫn hiện sau khi lưu');
    ok((await text(page, '[data-fk="save"]')) === 'Đã lưu bộ chiêu', 'nút lưu chuyển sang "Đã lưu bộ chiêu"');
    // gợi ý
    await page.click('[data-fk="suggest"]'); await sleep(100);
    const ids = await page.$$eval('.dj-slot.filled button', b => b.map(x => x.dataset.fk.slice(5)));
    const kinds = await page.evaluate(ids => ids.map(i => MARTIAL.SKILLS[i].kind), ids);
    ok(ids.length === 4 && new Set(ids).size === 4, 'gợi ý đủ 4 chiêu khác nhau: ' + ids);
    ok(kinds.some(k => k === 'atk') && kinds.some(k => k === 'guard' || k === 'dodge') && kinds.some(k => k === 'parry'), 'gợi ý có công, thủ/né, đỡ: ' + kinds);
    ok((await sent(page, 'vo:loadout')).length === 1, 'gợi ý không tự lưu');
    ok(!(await has(page, '.dj-warns')), 'gợi ý không bị cảnh báo');
    ok(errs.length === 0, 'bo: không lỗi console: ' + errs.join('; '));
    await noOverflow(page, 'max/bo 390'); await smallTargets(page, 'max/bo 390');
    await ctx.close();
  }
  {
    const { page, ctx } = await open(browser, 'newbie', { tab: 'bo' });
    ok((await text(page, '.dj-intro-box')).includes('chưa lưu bộ nào'), 'chưa có bộ thì nhắc');
    await page.click('[data-fk="suggest"]'); await sleep(100);
    ok((await page.$$('.dj-slot.filled')).length === 4, 'người mới bấm Gợi ý được 4 chiêu từ chiêu nhập môn');
    await shot(page, 'loadout-suggest-390');
    await ctx.close();
  }

  /* ---------- 8. đăng nhập, tắt, mất mạng ---------- */
  section('Đăng nhập · chưa mở · mất kết nối');
  {
    const { page, ctx, errs } = await open(browser, 'login', { tab: 'tam' });
    ok((await text(page, '.dj-login')).includes('Đăng nhập Google để tu luyện và lưu tiến độ'), 'lời mời đăng nhập');
    for (const t of ['vo', 'bo']) { await tab(page, t); ok(await has(page, '.dj-login'), 'tab ' + t + ' cũng chỉ có lời mời'); }
    await shot(page, 'login-390');
    await page.click('.dj-login .btn'); ok(await page.evaluate(() => H.log.login) === 1, 'nút gọi host.login()');
    await page.click('.dj-rules summary');
    ok(await page.$eval('.dj-rules', e => e.open) && (await text(page, '.dj-rules-body')).includes('Công lực có trần'), 'vẫn đọc được luật');
    ok(errs.length === 0, 'login: không lỗi console: ' + errs.join('; '));
    await ctx.close();
  }
  {
    const { page, ctx } = await open(browser, 'disabled', {});
    ok((await text(page, '.dj-panel')).includes('Võ Học Các chưa mở'), 'tắt thì hiện "Võ Học Các chưa mở"');
    ok(!(await has(page, '.dj-tabs:not([hidden])')), 'tắt thì ẩn tab');
    await shot(page, 'disabled-390');
    await ctx.close();
  }
  {
    const { page, ctx } = await open(browser, 'active', { tab: 'tam' });
    await page.evaluate(() => H.ctl.drop()); await sleep(100);
    ok(await page.$eval('.dj-offline', e => !e.hidden), 'mất kết nối hiện dòng báo');
    ok(await page.$$eval('[data-send]', b => b.length > 0 && b.every(x => x.disabled)), 'mọi nút gửi bị khóa khi mất kết nối');
    const n = (await page.evaluate(() => H.sock.sent.length));
    await page.evaluate(() => document.querySelector('[data-fk="sp:go"]').click()); await sleep(100);
    ok(n === await page.evaluate(() => H.sock.sent.length), 'không gửi gì khi mất kết nối');
    await shot(page, 'offline-390');
    await page.evaluate(() => H.ctl.rise()); await sleep(100);
    ok(await page.$eval('.dj-offline', e => e.hidden) && await page.$$eval('[data-send]', b => b.every(x => !x.disabled)), 'nối lại thì mở khóa');
    await ctx.close();
  }
  {   // lỗi tải trạng thái
    const { page, ctx } = await open(browser, 'idle', { tab: 'tam' });
    await page.evaluate(() => { H.sock.handlers['martial:state'] = () => ({ ok: false, reason: 'Bạn tải hơi nhanh, đợi một chút nhé.' }); Dojo.hide(); Dojo.show(); });
    await sleep(100);
    ok((await text(page, '.dj-panel')).includes('Bạn tải hơi nhanh'), 'lỗi ack khi tải được báo ra');
    await ctx.close();
  }

  /* ---------- 9. vòng đời: hide dừng mọi hẹn giờ, show làm mới ---------- */
  section('Vòng đời show/hide');
  {
    const { page, ctx } = await open(browser, 'active', { tab: 'tam' });
    ok(await page.evaluate(() => window.__iv.size) >= 1, 'đang hiện thì có đồng hồ');
    await page.evaluate(() => Places.go('hall'));
    await sleep(3500);
    ok(await page.evaluate(() => window.__iv.size) === 0, 'hide: không còn setInterval nào');
    ok(await page.evaluate(() => window.__to.size) === 0, 'hide: không còn setTimeout nào');
    const n = await page.evaluate(() => H.sock.sent.length); await sleep(1500);
    ok(n === await page.evaluate(() => H.sock.sent.length), 'hide: không gửi gì thêm');
    const states = await page.evaluate(() => H.sim.log.length);
    await page.click('#toDojo'); await sleep(300);
    ok(await page.evaluate(() => H.sim.log.length) === states + 1, 'show: gọi lại martial:state');
    // tu:update khi ẩn vẫn toast, khi hiện thì làm mới
    await page.evaluate(() => Places.go('hall')); await sleep(200);
    const s2 = await page.evaluate(() => H.sim.log.length);
    await page.evaluate(() => H.sock.receive('tu:update', { kind: 'completed', sessionId: 5, text: 'Phiên tu thử đã viên mãn.' }));
    ok((await toastText(page)).includes('Phiên tu thử'), 'tu:update khi ẩn vẫn toast');
    ok(await page.evaluate(() => H.sim.log.length) === s2, 'tu:update khi ẩn không gọi martial:state');
    await page.click('#toDojo'); await sleep(300);
    const s3 = await page.evaluate(() => H.sim.log.length);
    await page.evaluate(() => H.sock.receive('tu:update', { kind: 'cancelled', sessionId: 5, text: 'Cập nhật thử.' })); await sleep(500);
    ok(await page.evaluate(() => H.sim.log.length) > s3, 'tu:update khi hiện thì làm mới state');
    // nút về chánh điện / ra sân đấu
    await page.click('.dj-back'); await sleep(200);
    ok((await page.evaluate(() => H.log.goto)).includes('hall') && await page.$eval('#place-dojo', e => e.hidden), 'nút "Về chánh điện" gọi goto("hall")');
    await ctx.close();
  }
  {
    const { page, ctx } = await open(browser, 'idle', { tab: 'tam' });
    await page.click('.dj-link'); ok((await page.evaluate(() => H.log.goto)).includes('arena'), '"Ra sân đấu" gọi goto("arena")');
    await ctx.close();
    const o2 = await open(browser, 'idle', { tab: 'tam', extra: '&pk=0' });
    ok(await o2.page.$eval('.dj-link', e => e.hidden), 'sân đấu tắt thì ẩn liên kết');
    await o2.ctx.close();
  }

  /* ---------- 10. tab nhớ, bàn phím, giảm chuyển động ---------- */
  section('Tab nhớ · bàn phím · giảm chuyển động');
  {
    const { page, ctx } = await open(browser, 'idle', { tab: 'tam' });
    await tab(page, 'bo');
    ok(await page.evaluate(() => localStorage.getItem('ta-dojo-tab')) === 'bo', 'lưu tab vào ta-dojo-tab');
    await page.reload(); await page.waitForFunction(() => window.ready); await page.waitForSelector('.dj-panel > *');
    ok(await page.$eval('[data-tab=bo]', e => e.getAttribute('aria-selected')) === 'true', 'mở lại nhớ đúng tab');
    await page.focus('[data-tab=bo]'); await page.keyboard.press('ArrowLeft'); await sleep(100);
    ok(await page.$eval('[data-tab=vo]', e => e.getAttribute('aria-selected')) === 'true', 'mũi tên đổi tab');
    ok(await page.evaluate(() => document.activeElement.dataset.tab) === 'vo', 'tiêu điểm theo tab');
    await ctx.close();
  }
  {
    const { page, ctx } = await open(browser, 'done', { tab: 'tam', reduced: true });
    const css = await page.evaluate(() => ({ a: getComputedStyle(document.querySelector('.dj-celeb')).animationName, t: getComputedStyle(document.querySelector('.dj-bar i')).transitionDuration }));
    ok(css.a === 'none' && css.t === '0s', 'prefers-reduced-motion: tắt animation và transition: ' + JSON.stringify(css));
    await ctx.close();
  }

  /* ---------- 11. màn rộng 1280x800 ---------- */
  section('Màn rộng 1280x800');
  for (const [scen, t, name] of [['active', 'tam', 'active'], ['speedup', 'tam', 'speedup'], ['idle', 'tam', 'idle-tam'], ['idle', 'vo', 'idle-vo'], ['max', 'bo', 'max-bo'], ['login', 'tam', 'login'], ['done', 'tam', 'done']]) {
    const { page, ctx, errs } = await open(browser, scen, { tab: t, w: 1280, h: 800 });
    await page.waitForSelector('.dj-panel > *'); await sleep(200);
    await noOverflow(page, `${scen}/${t} 1280`);
    const lay = await page.evaluate(() => { const p = document.querySelector('.dj-prof'), m = document.querySelector('.dj-main'); const a = p.getBoundingClientRect(), b = m.getBoundingClientRect(); return { sideBySide: a.right <= b.left + 1 && Math.abs(a.top - b.top) < 120, pw: Math.round(a.width), mw: Math.round(b.width) }; });
    ok(lay.sideBySide, `${scen}/${t} 1280: hai cột (hồ sơ bên trái, nội dung bên phải) ${JSON.stringify(lay)}`);
    ok(errs.length === 0, `${scen}/${t} 1280: không lỗi console: ${errs.join('; ')}`);
    await shot(page, name + '-1280');
    await ctx.close();
  }
  for (const [scen, t, name] of [['speedup', 'tam', 'speedup'], ['idle', 'vo', 'idle-vo'], ['max', 'bo', 'max-bo'], ['done', 'tam', 'done'], ['login', 'tam', 'login'], ['vouchers', 'tam', 'vouchers']]) {
    const { page, ctx, errs } = await open(browser, scen, { tab: t });
    await sleep(200); await noOverflow(page, `${scen}/${t} 390`);
    if (scen !== 'idle') await smallTargets(page, `${scen}/${t} 390`);
    ok(errs.length === 0, `${scen}/${t} 390: không lỗi console: ${errs.join('; ')}`);
    await shot(page, name + '-390');
    await ctx.close();
  }
  // ảnh cuộn dài của một vài màn (để xem toàn bộ nội dung)
  if (SHOTS) {
    for (const [scen, t, name] of [['idle', 'tam', 'idle-tam'], ['idle', 'vo', 'idle-vo'], ['max', 'bo', 'max-bo'], ['speedup', 'tam', 'speedup']]) {
      const { page, ctx } = await open(browser, scen, { tab: t, h: 3400 });
      await sleep(150); await page.screenshot({ path: path.join(SHOTS, name + '-390-tall.png') });
      await ctx.close();
    }
  }
}

main().catch(e => { console.error(e); process.exit(1); });
