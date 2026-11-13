'use strict';
/*
 * Chụp ma trận 4 cảnh × 2 góc nhìn × 3 kích thước qua Playwright.
 * Chạy: node tools/ui-harness/world3d/run.js
 * Có thể đặt SHOTS, PORT hoặc chỉ định SHOTS=... PORT=....
 */
const { chromium } = require('playwright');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../../..');
const PUBLIC = path.join(ROOT, 'public');
const THREE = path.join(ROOT, 'node_modules/three/build');
const SHOTS = path.resolve(process.env.SHOTS || path.join(__dirname, 'artifacts'));
const PORT = Number(process.env.PORT) || 4174;
const SCENES = ['hall', 'yard', 'library', 'arena'];
const VIEWPORTS = [
  { name: 'mobile-375x812', width: 375, height: 812, mobile: true },
  { name: 'tablet-768x1024', width: 768, height: 1024, mobile: false },
  { name: 'desktop-1280x800', width: 1280, height: 800, mobile: false }
];
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' };
const errors = [];
const results = [];

function serveFile(req, res) {
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
  catch (_) { res.writeHead(400).end('Bad request'); return; }
  const base = pathname.startsWith('/vendor/three/') ? THREE : PUBLIC;
  const relative = pathname.startsWith('/vendor/three/') ? pathname.slice('/vendor/three/'.length) : pathname.slice(1);
  const file = path.resolve(base, relative);
  if (!file.startsWith(base + path.sep)) { res.writeHead(403).end(); return; }
  fs.readFile(file, (error, data) => {
    if (error) { res.writeHead(404).end('Not found'); return; }
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(data);
  });
}

function startServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer(serveFile);
    server.once('error', reject);
    server.listen(PORT, '127.0.0.1', () => resolve(server));
  });
}

async function runCase(browser, scene, viewport, view) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 1,
    isMobile: viewport.mobile,
    hasTouch: viewport.mobile,
    reducedMotion: 'reduce'
  });
  const page = await context.newPage();
  page.on('console', message => {
    // Cảnh báo của SwiftShader và lệnh loseContext chủ động không phải lỗi của game.
    if (/GPU stall due to ReadPixels|CONTEXT_LOST_WEBGL: loseContext/.test(message.text())) return;
    if (message.type() === 'error' || message.type() === 'warning') errors.push(`${scene}/${view}/${viewport.name} console ${message.type()}: ${message.text()}`);
  });
  page.on('pageerror', error => errors.push(`${scene}/${view}/${viewport.name} pageerror: ${error.message}`));
  page.on('requestfailed', request => {
    if (!/favicon\.ico/.test(request.url())) errors.push(`${scene}/${view}/${viewport.name} requestfailed: ${request.url()} (${request.failure()?.errorText || 'unknown'})`);
  });

  const url = `http://127.0.0.1:${PORT}/world3d-scene-${scene}.html?view=${view}&quality=low`;
  const started = Date.now();
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => {
    const canvas = document.querySelector('#stage canvas, #ar-world');
    const output = document.querySelector('#pick, #ar-result');
    return canvas && canvas.width > 0 && canvas.height > 0 && output && !/Đang|Chưa/.test(output.textContent);
  }, null, { timeout: 30000 });
  const viewLabel = await page.locator(scene === 'arena' ? '#ar-view' : '#view').textContent().catch(() => '');
  const expected = scene === 'arena'
    ? (view === 'first' ? 'thứ nhất' : 'thứ ba')
    : (view === 'first' ? 'Góc nhìn thứ ba' : 'Góc nhìn thứ nhất');
  if (!viewLabel.includes(expected)) throw new Error(`Nhãn góc nhìn sai: mong nút chuyển sang ${expected}, nhận "${viewLabel}"`);
  await page.waitForTimeout(1800);
  const fps = await page.evaluate(async () => new Promise(resolve => {
    let frames = 0;
    const begin = performance.now();
    function tick(now) {
      frames++;
      if (now - begin >= 1500) resolve(Math.round((frames - 1) * 1000 / (now - begin)));
      else requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }));
  const file = path.join(SHOTS, `${scene}-${view}-${viewport.name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  results.push({ scene, view, viewport: viewport.name, fps, loadMs: Date.now() - started, screenshot: file });
  await context.close();
}

(async () => {
  let server;
  let browser;
  try {
    fs.mkdirSync(SHOTS, { recursive: true });
    server = await startServer();
    browser = await chromium.launch({ headless: true, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
    for (const scene of SCENES) for (const view of ['third', 'first']) for (const viewport of VIEWPORTS) {
      const label = `${scene}/${view}/${viewport.name}`;
      try {
        await runCase(browser, scene, viewport, view);
        console.log(`PASS ${label}`);
      } catch (error) {
        errors.push(`${label}: ${error.stack || error}`);
        console.error(`FAIL ${label}: ${error.message}`);
      }
    }
  } finally {
    if (browser) await browser.close();
    if (server) await new Promise(resolve => server.close(resolve));
  }
  console.log('\nKết quả FPS (SwiftShader, chỉ so sánh tương đối):');
  for (const result of results) console.log(`${result.scene}/${result.view}/${result.viewport}: ${result.fps} FPS, tải ${result.loadMs} ms, ${result.screenshot}`);
  const report = path.join(SHOTS, 'report.json');
  fs.writeFileSync(report, JSON.stringify({ generatedAt: new Date().toISOString(), browser: 'Chromium + SwiftShader', total: 24, passed: results.length, errors, results }, null, 2) + '\n', 'utf8');
  console.log(`Báo cáo: ${report}`);
  if (errors.length) {
    console.error(`\n${errors.length} lỗi:`);
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
  } else console.log(`\nĐạt ${results.length}/24 tổ hợp; không có lỗi console, trang hoặc tải tài nguyên.`);
})().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
