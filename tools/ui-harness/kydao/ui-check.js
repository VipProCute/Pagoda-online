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
      await page.locator('.kdfx-banner.is-on').waitFor({ state: 'visible', timeout: 600 });
      assert.ok((await page.locator('.kdfx-cry').textContent()).trim(), 'Khẩu hiệu trống');
      assert.match(await page.locator('#log').textContent(), /gửi kd:skin/);
      await shot(page, 'lanh-dia-khai-mo', kind);
      await page.waitForTimeout(2500);
      assert.equal(await page.locator('.kdfx-banner.is-on').count(), 0, 'Khẩu hiệu chưa tắt');
    });
    for (const kind of sizes) await t('doi-thu-khai-mo', kind, async page => {
      await openGame(page, '#b-chess');
      await page.selectOption('#s-field', 'glacier');
      await harnessClick(page, '#b-foe');
      await page.locator('.kdfx-banner.is-on').waitFor({ state: 'visible', timeout: 600 });
      await page.waitForTimeout(2600);
      await shot(page, 'doi-thu-khai-mo', kind);
    });
    for (const kind of ['mobile', 'desktop', 'reduced']) await t('phong-cap-chan-dong', kind, async page => {
      await openGame(page, '#b-promo');
      await tapCell(page, kind, 1, 1);
      await tapCell(page, kind, 0, 0);
      await page.locator('.kd-promo').waitFor({ state: 'visible' });
      await page.evaluate(() => {
        window.__shake = [];
        window.__shakeTimer = setInterval(() => {
          const style = getComputedStyle(document.querySelector('.kd-boardwrap'));
          window.__shake.push({ translate: style.translate, transform: style.transform });
        }, 30);
      });
      await page.locator('.kd-promo').getByRole('button', { name: 'Hậu', exact: true }).click();
      await page.waitForTimeout(500);
      const samples = await page.evaluate(() => { clearInterval(window.__shakeTimer); return window.__shake; });
      const shifted = sample => {
        const translate = sample.translate === 'none' ? [] : sample.translate.match(/-?\d+(?:\.\d+)?/g) || [];
        const match = sample.transform.match(/matrix(?:3d)?\(([^)]+)\)/);
        const matrix = match ? match[1].split(',').map(Number) : [];
        return translate.some(value => Math.abs(Number(value)) > 0.01) || (matrix.length === 6 && (Math.abs(matrix[4]) > 0.01 || Math.abs(matrix[5]) > 0.01)) || (matrix.length === 16 && (Math.abs(matrix[12]) > 0.01 || Math.abs(matrix[13]) > 0.01));
      };
      assert.ok(samples.length, 'Không lấy được mẫu chuyển động');
      assert.equal(samples.some(shifted), kind !== 'reduced', 'Chấn động không đúng chế độ');
      await page.waitForTimeout(1000);
      const end = await page.locator('.kd-boardwrap').evaluate(element => ({ translate: getComputedStyle(element).translate, transform: getComputedStyle(element).transform }));
      assert.ok(!shifted(end), 'Bàn chưa trở lại vị trí');
      await shot(page, 'phong-cap-chan-dong', kind);
    });
    for (const kind of [...sizes, 'reduced']) await t('ket-thuc-chieu-het', kind, async page => {
      await openGame(page, '#b-chess');
      await page.selectOption('#s-reason', 'checkmate');
      await page.selectOption('#s-result', 'a');
      await harnessClick(page, '#b-end');
      if (kind !== 'reduced') {
        await page.locator('.kdfx-banner.is-on').waitFor({ state: 'visible', timeout: 600 });
        await page.waitForTimeout(400);
        assert.ok(await page.locator('.kd-result').evaluate(element => element.hidden), 'Kết quả hiện quá sớm');
      }
      await page.locator('.kd-result').waitFor({ state: 'visible', timeout: kind === 'reduced' ? 600 : 3100 });
      await shot(page, 'ket-thuc-chieu-het', kind);
    });
    for (const kind of [...sizes, 'reduced']) await t('co-tuong-song', kind, async page => {
      await openGame(page, '#b-xq');
      const canvas = page.locator('.kd-canvas');
      const before = await canvas.evaluate(element => element.toDataURL());
      await page.waitForTimeout(700);
      const after = await canvas.evaluate(element => element.toDataURL());
      assert.equal(before === after, kind === 'reduced', 'Dòng sông không đúng chế độ chuyển động');
      await shot(page, 'co-tuong-song', kind);
    });
    for (const kind of sizes) await t('nam-mon-mo-duoc', kind, async page => {
      for (const id of ['#b-xq', '#b-jieqi', '#b-caro', '#b-go']) {
        await openGame(page, id);
        assert.ok((await page.locator('.kd-canvas').boundingBox()).width > 150, `${id}: bàn cờ quá hẹp`);
        if (id === '#b-caro' || id === '#b-go') assert.ok(!(await button(page, 'Lãnh địa').isVisible()), `${id}: nút lãnh địa chưa ẩn`);
      }
      await shot(page, 'nam-mon-mo-duoc', kind);
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
