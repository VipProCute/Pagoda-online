'use strict';

const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
let chromium;
try { ({ chromium } = require('playwright')); } catch (err) {
  if (err.code !== 'MODULE_NOT_FOUND' || !err.message.includes('playwright')) throw err;
  ({ chromium } = require('playwright-core'));
}
const PORT = process.env.PORT || '4175';
const ORIGIN = `http://127.0.0.1:${PORT}`;
const BASE = `${ORIGIN}/harness/kydao/index.html`;
const SHOTS = process.env.SHOTS || path.join(os.tmpdir(), 'kydao-shots');
const CTX = {
  mobile: { viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true },
  tablet: { viewport: { width: 768, height: 1024 } },
  desktop: { viewport: { width: 1280, height: 800 } },
  reduced: { viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true, reducedMotion: 'reduce' }
};
const results = [];
let browser;

async function waitServer(child) {
  const until = Date.now() + 5000;
  let spawnError;
  child.once('error', err => { spawnError = err; });
  while (Date.now() < until) {
    if (spawnError) throw spawnError;
    if (child.exitCode !== null) throw new Error(`Máy chủ thoát với mã ${child.exitCode}`);
    const ok = await new Promise(resolve => {
      const request = http.get(BASE, response => { response.resume(); resolve(response.statusCode === 200); });
      request.on('error', () => resolve(false));
      request.setTimeout(300, () => request.destroy());
    });
    if (ok) return;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('Máy chủ không sẵn sàng sau 5 giây');
}

async function t(name, kind, fn) {
  if (process.env.ONLY && !name.includes(process.env.ONLY)) return;
  let context, page, detail = '', status = 'ĐẠT';
  const errors = [];
  try {
    context = await browser.newContext(CTX[kind]);
    page = await context.newPage();
    page.on('console', msg => { if (msg.type() === 'error') errors.push(`console: ${msg.text()}`); });
    page.on('pageerror', err => errors.push(`pageerror: ${err.message}`));
    page.on('response', response => {
      const url = new URL(response.url());
      if (url.origin === ORIGIN && url.pathname !== '/favicon.ico' && response.status() >= 400) errors.push(`HTTP ${response.status()} ${url.pathname}`);
    });
    await page.goto(BASE, { waitUntil: 'load' });
    const outcome = await fn(page, kind);
    if (outcome) { status = 'BỎ QUA'; detail = outcome; }
  } catch (err) {
    status = 'TRƯỢT';
    detail = String(err.message || err).split('\n')[0];
  } finally {
    if (page) await page.close().catch(() => {});
    if (context) await context.close().catch(() => {});
    if (errors.length) { status = 'TRƯỢT'; detail = [detail, errors[0]].filter(Boolean).join('; '); }
  }
  results.push({ name, kind, status, detail });
  console.log(`${name}\t${kind}\t${status}${detail ? '\t' + detail : ''}`);
}
const shot = (page, name, kind) => page.screenshot({ path: path.join(SHOTS, `${name}-${kind}.png`) });
const harnessClick = (page, id) => page.$eval(id, element => element.click());
const button = (page, label) => page.getByRole('button', { name: label, exact: true });
async function openGame(page, id) {
  await harnessClick(page, id);
  await page.locator('.kd-panel').waitFor({ state: 'visible' });
}
async function tapCell(page, kind, column, row) {
  await page.locator('.kd-canvas').scrollIntoViewIfNeeded();
  const box = await page.locator('.kd-canvas').boundingBox();
  assert.ok(box, 'Không tìm thấy khung bàn cờ');
  const x = box.x + (column + 0.5) * box.width / 8;
  const y = box.y + (row + 0.5) * box.height / 8;
  if (kind === 'mobile' || kind === 'reduced') await page.touchscreen.tap(x, y);
  else await page.mouse.click(x, y);
}

async function main() {
  fs.mkdirSync(SHOTS, { recursive: true });
  const child = spawn(process.execPath, [path.join(__dirname, '..', 'serve.js'), PORT], { stdio: 'ignore' });
  try {
    await waitServer(child);
    browser = await chromium.launch(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {});
    const sizes = ['mobile', 'tablet', 'desktop'];
    console.log('Kiểm tra\tCỡ\tKết quả');
    for (const kind of sizes) await t('mo-van-co-vua', kind, async page => {
      await openGame(page, '#b-chess');
      assert.ok((await page.locator('.kd-canvas').boundingBox()).width > 200, 'Bàn cờ quá hẹp');
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Trang tràn ngang');
      await shot(page, 'mo-van-co-vua', kind);
    });
    for (const kind of sizes) await t('lanh-dia-khai-mo', kind, async page => {
      await openGame(page, '#b-chess');
      await button(page, 'Lãnh địa').click();
      const skins = page.locator('.kd-skins');
      await skins.waitFor({ state: 'visible' });
      assert.ok((await skins.boundingBox()).height >= 120, 'Bảng lãnh địa quá thấp');
      assert.ok(await page.locator('.kd-skin').evaluateAll(items => items.length > 0 && items.every(item => item.getBoundingClientRect().height >= 44)), 'Mục sân hoặc quân quá thấp');
      await page.getByRole('radiogroup', { name: 'Sân của bạn' }).locator('.kd-skin').nth(1).click();
      await button(page, 'Khai mở').click();
      await page.waitForFunction(() => document.querySelector('.kdfx-banner')?.classList.contains('is-on'), null, { timeout: 2000 });
      assert.ok((await page.locator('.kdfx-cry').textContent()).trim(), 'Khẩu hiệu trống');
      assert.match(await page.locator('#log').textContent(), /gửi kd:skin/);
      await shot(page, 'lanh-dia-khai-mo', kind);
      await page.waitForFunction(() => !document.querySelector('.kdfx-banner.is-on'), null, { timeout: 8000 });
    });
    for (const kind of sizes) await t('doi-thu-khai-mo', kind, async page => {
      await openGame(page, '#b-chess');
      await page.selectOption('#s-field', 'glacier');
      await harnessClick(page, '#b-foe');
      await page.waitForFunction(() => document.querySelector('.kdfx-banner')?.classList.contains('is-on'), null, { timeout: 2000 });
      await page.waitForFunction(() => !document.querySelector('.kdfx-banner.is-on'), null, { timeout: 8000 });
      await shot(page, 'doi-thu-khai-mo', kind);
    });
    for (const kind of ['mobile', 'desktop', 'reduced']) await t('phong-cap-chan-dong', kind, async page => {
      await openGame(page, '#b-promo');
      await tapCell(page, kind, 1, 1);
      await tapCell(page, kind, 0, 0);
      await page.locator('.kd-promo').waitFor({ state: 'visible' });
      // Hàm chạy trong trang: bàn có đang lệch khỏi chỗ cũ (translate hoặc transform khác không) không.
      await page.evaluate(`window.__isShifted = ${(() => {
        const style = getComputedStyle(document.querySelector('.kd-boardwrap'));
        const translate = style.translate === 'none' ? [] : style.translate.match(/-?\d+(?:\.\d+)?/g) || [];
        const match = style.transform.match(/matrix(?:3d)?\(([^)]+)\)/);
        const matrix = match ? match[1].split(',').map(Number) : [];
        return translate.some(value => Math.abs(Number(value)) > 0.01) || (matrix.length === 6 && (Math.abs(matrix[4]) > 0.01 || Math.abs(matrix[5]) > 0.01)) || (matrix.length === 16 && (Math.abs(matrix[12]) > 0.01 || Math.abs(matrix[13]) > 0.01));
      }).toString()}`);
      const queen = page.locator('.kd-promo').getByRole('button', { name: 'Hậu', exact: true });
      if (kind === 'reduced') {
        // Lấy mẫu từng khung hình ngay trong trang (không dùng timer của Node): suốt 800 ms không lần nào lệch.
        const sampling = page.evaluate(() => new Promise(resolve => {
          const end = performance.now() + 800;
          let moved = false;
          const tick = () => { if (window.__isShifted()) moved = true; if (performance.now() < end) requestAnimationFrame(tick); else resolve(moved); };
          requestAnimationFrame(tick);
        }));
        await queen.click();
        assert.equal(await sampling, false, 'Giảm chuyển động mà bàn vẫn rung');
      } else {
        const shaken = page.waitForFunction(() => window.__isShifted(), null, { timeout: 2000, polling: 'raf' });
        await queen.click();
        await shaken;
        await page.waitForFunction(() => !window.__isShifted(), null, { timeout: 3000, polling: 'raf' });
      }
      assert.ok(!(await page.evaluate(() => window.__isShifted())), 'Bàn chưa trở lại vị trí');
      await shot(page, 'phong-cap-chan-dong', kind);
    });
    for (const kind of [...sizes, 'reduced']) await t('ket-thuc-chieu-het', kind, async page => {
      await openGame(page, '#b-chess');
      await page.selectOption('#s-reason', 'checkmate');
      await page.selectOption('#s-result', 'a');
      await harnessClick(page, '#b-end');
      if (kind !== 'reduced') {
        await page.waitForFunction(() => document.querySelector('.kdfx-banner')?.classList.contains('is-on'), null, { timeout: 2000 });
        assert.ok(await page.locator('.kd-result').evaluate(element => element.hidden), 'Kết quả hiện quá sớm');
      }
      await page.locator('.kd-result').waitFor({ state: 'visible', timeout: 6000 });
      await shot(page, 'ket-thuc-chieu-het', kind);
    });
    for (const kind of [...sizes, 'reduced']) await t('co-tuong-song', kind, async page => {
      await openGame(page, '#b-xq');
      const canvas = page.locator('.kd-canvas');
      const before = await canvas.evaluate(element => element.toDataURL());
      if (kind === 'reduced') {
        // Lấy mẫu theo khung hình trong trang: suốt 800 ms ảnh bàn không đổi.
        const same = await canvas.evaluate((element, first) => new Promise(resolve => {
          const end = performance.now() + 800;
          const tick = () => { if (element.toDataURL() !== first) resolve(false); else if (performance.now() < end) requestAnimationFrame(tick); else resolve(true); };
          requestAnimationFrame(tick);
        }), before);
        assert.ok(same, 'Giảm chuyển động mà dòng sông vẫn chảy');
      } else {
        await page.waitForFunction(first => document.querySelector('.kd-canvas').toDataURL() !== first, before, { timeout: 4000 });
      }
      await shot(page, 'co-tuong-song', kind);
    });
    for (const kind of sizes) await t('nam-mon-mo-duoc', kind, async page => {
      for (const id of ['#b-xq', '#b-jieqi', '#b-caro', '#b-go']) {
        await openGame(page, id);
        assert.ok((await page.locator('.kd-canvas').boundingBox()).width > 150, `${id}: bàn cờ quá hẹp`);
        if (id === '#b-caro' || id === '#b-go') {
          assert.ok(!(await button(page, 'Lãnh địa').isVisible()), `${id}: vẫn còn chữ Lãnh địa`);
          assert.ok(await button(page, 'Bộ đá').isVisible(), `${id}: nút Bộ đá chưa hiện`);
          await button(page, 'Bộ đá').click();
          assert.ok(!(await button(page, 'Khai mở').isVisible()) && !(await button(page, 'Về sân mặc định').isVisible()), `${id}: bộ chọn đá không được có nút Khai mở`);
        }
      }
      await shot(page, 'nam-mon-mo-duoc', kind);
    });
    for (const kind of sizes) await t('da-skin-caro-co-vay', kind, async page => {
      for (const [id, name] of [['#b-caro', 'caro'], ['#b-go', 'co-vay']]) {
        await openGame(page, id);
        await button(page, 'Bộ đá').click();
        await page.locator('.kd-skin[data-kind="pieces"][data-id="cosmos"]').click();
        await page.locator('.kd-skin-stone').first().waitFor({ state: 'visible' });
        const tile = await page.locator('.kd-skin[data-kind="pieces"][data-id="cosmos"] .kd-skin-stone').evaluate(el => getComputedStyle(el).backgroundImage);
        assert.ok(tile.includes('/img/kydao/stones/cosmos.webp'), `${name}: ô chọn chưa dùng ảnh đá`);
        await tapCell(page, kind, 3, 3); await tapCell(page, kind, 5, 5);
        await harnessClick(page, '#b-foe'); await harnessClick(page, '#b-opp');
        await page.waitForTimeout(400);
        await shot(page, `da-skin-${name}`, kind);
      }
    });
    for (const kind of ['mobile', 'desktop']) await t('khoa-skin', kind, async page => {
      await openGame(page, '#b-chess');
      await harnessClick(page, '#b-shop');
      await button(page, 'Lãnh địa').click();
      await page.locator('.kd-skins').waitFor({ state: 'visible' });
      const pieces = page.getByRole('radiogroup', { name: 'Quân của bạn' });
      const locked = pieces.locator('.kd-skin.is-locked');
      await locked.first().waitFor({ state: 'visible' });
      assert.ok(await locked.count() > 0, 'Không có mục nào bị khóa');
      assert.match(await locked.first().textContent(), /20\.000\s*đ/, 'Mục khóa chưa có giá');
      assert.match(await locked.first().getAttribute('aria-label'), /đang khóa, cúng dường 20\.000\s*đ để mở/, 'aria-label mục khóa sai');
      assert.ok(await page.locator('.kd-skin').evaluateAll(items => items.every(item => item.getBoundingClientRect().height >= 44)), 'Mục skin quá thấp');
      await shot(page, 'khoa-skin-bo-chon', kind);
      // Bấm mục sân khóa rồi Esc: khung xác nhận hiện rồi đóng, chưa gửi gì.
      await page.getByRole('radiogroup', { name: 'Sân của bạn' }).locator('.kd-skin.is-locked').first().click();
      await page.locator('.kd-buy').waitFor({ state: 'visible' });
      await page.keyboard.press('Escape');
      await page.locator('.kd-buy').waitFor({ state: 'detached' });
      // Bấm mục quân khóa: khung xác nhận, chưa gửi kd:skin.
      const id = await locked.first().getAttribute('data-id');
      await locked.first().click();
      const dialog = page.locator('.kd-buy');
      await dialog.waitFor({ state: 'visible' });
      assert.match(await dialog.textContent(), /Cúng dường 20\.000\s*đ để mở skin này\. Mở rồi dùng mãi\./);
      assert.ok(!/gửi kd:skin/.test(await page.locator('#log').textContent()), 'Bấm mục khóa mà vẫn gửi kd:skin');
      await button(page, 'Cúng dường để mở').click();
      await dialog.locator('img.kd-buy-qr').waitFor({ state: 'visible' });
      assert.ok(await dialog.locator('img.kd-buy-qr').evaluate(img => img.getAttribute('src') === '/img/kydao/ui/crest-lotus.webp'), 'Ảnh QR chưa gán');
      assert.match(await dialog.textContent(), /CDTEST01/);
      await shot(page, 'khoa-skin-qr', kind);
      // Máy chủ giả phát owned sau 1,5 giây: khung đóng, mục hết khóa, gửi kd:skin.
      await page.waitForFunction(() => !document.querySelector('.kd-buy'), null, { timeout: 5000 });
      assert.equal(await pieces.locator(`.kd-skin[data-id="${id}"]`).evaluate(el => el.classList.contains('is-locked')), false, 'Mục vẫn khóa sau khi được mở');
      await page.waitForFunction(() => /gửi kd:skin/.test(document.getElementById('log').textContent), null, { timeout: 2000 });
      assert.equal(await pieces.locator(`.kd-skin[data-id="${id}"]`).getAttribute('aria-checked'), 'true', 'Skin vừa mở chưa được chọn');
      await shot(page, 'khoa-skin-da-mo', kind);
    });
    await t('ban-3d', 'desktop', async page => {
      await openGame(page, '#b-chess');
      if (!(await button(page, 'Bàn 3D').isVisible())) return 'Không có WebGL2';
      await button(page, 'Bàn 3D').click();
      await button(page, 'Bàn 2D').waitFor({ state: 'visible', timeout: 6000 });
      await shot(page, 'ban-3d', 'desktop');
    });
  } finally {
    if (browser) await browser.close().catch(() => {});
    child.kill();
  }
  const count = status => results.filter(result => result.status === status).length;
  console.log(`\nTổng: ${count('ĐẠT')} đạt, ${count('TRƯỢT')} trượt, ${count('BỎ QUA')} bỏ qua. Ảnh: ${SHOTS}`);
  if (count('TRƯỢT')) process.exitCode = 1;
}
main().catch(err => { console.error(err); process.exitCode = 1; });
