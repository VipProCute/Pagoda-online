#!/usr/bin/env node
/*
 * render.mjs — dựng lại bộ meme chúc mừng: tools/memes/cards/*.html  ->  public/img/memes/*.jpg
 *
 * Chạy (cần Playwright + Chromium cài sẵn; đây là công cụ dev, KHÔNG phải dependency của repo):
 *   node tools/memes/render.mjs                    # dựng tất cả thẻ
 *   node tools/memes/render.mjs chuc-ngay-moi may-man   # chỉ dựng vài thẻ (theo tên file, không đuôi)
 *   node tools/memes/render.mjs --max-kb 100       # đổi ngưỡng dung lượng mỗi ảnh (mặc định 110)
 *   node tools/memes/render.mjs --png /đường/dẫn   # xuất thêm bản PNG gốc để xem/so sánh
 *
 * Nếu `require('playwright')` không tìm thấy, đặt NODE_PATH tới thư mục node_modules chứa playwright,
 * ví dụ:  NODE_PATH=$(npm root -g) node tools/memes/render.mjs
 *
 * Mỗi thẻ là một trang HTML 720x720 (SVG vẽ bằng code, xem cards/lib.js), tự đặt window.__ready = true khi
 * font đã nạp xong; script cũng in cảnh báo nếu chữ bị co/ sát lề. Ảnh được nén JPEG bằng Pillow
 * (python3 + PIL, tools/memes/to_jpeg.py) với chất lượng ~82, hạ dần nếu vượt ngưỡng KB;
 * không có Pillow thì dùng bộ nén JPEG của Chromium.
 *
 * Mọi thẻ + mã dựng là tác phẩm gốc, CC0 (xem public/img/NOTICE.txt).
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CARDS = path.join(HERE, 'cards');
const OUT = path.resolve(HERE, '../../public/img/memes');
const PY = path.join(HERE, 'to_jpeg.py');

const args = process.argv.slice(2);
let maxKb = 110;
let pngDir = null;
const only = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--max-kb') maxKb = Number(args[++i]) || maxKb;
  else if (args[i] === '--png') pngDir = path.resolve(args[++i]);
  else only.push(args[i].replace(/\.html$/, ''));
}

function pilJpeg(png, quality) {
  const r = spawnSync('python3', [PY, String(quality)], { input: png, maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0 || !r.stdout || !r.stdout.length) return null;
  return r.stdout;
}

fs.mkdirSync(OUT, { recursive: true });
if (pngDir) fs.mkdirSync(pngDir, { recursive: true });
const names = fs.readdirSync(CARDS).filter((f) => f.endsWith('.html')).map((f) => f.slice(0, -5)).sort()
  .filter((n) => !only.length || only.includes(n));
if (!names.length) { console.error('Không có thẻ nào khớp.'); process.exit(1); }

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 720, height: 720 }, deviceScaleFactor: 1 });
let total = 0;
let bad = 0;
for (const name of names) {
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(pathToFileURL(path.join(CARDS, name + '.html')).href);
  try {
    await page.waitForFunction(() => window.__ready === true, null, { timeout: 20000 });
  } catch (e) {
    console.error(`✗ ${name}: không báo __ready`, errors.join(' | '));
    bad++; await page.close(); continue;
  }
  const warn = await page.evaluate(() => window.__warn || []);
  const png = await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: 720, height: 720 } });
  if (pngDir) fs.writeFileSync(path.join(pngDir, name + '.png'), png);
  let jpg = null;
  let q = 82;
  for (; q >= 66; q -= 3) {
    jpg = pilJpeg(png, q) || (await page.screenshot({ type: 'jpeg', quality: q, clip: { x: 0, y: 0, width: 720, height: 720 } }));
    if (jpg.length <= maxKb * 1024) break;
  }
  fs.writeFileSync(path.join(OUT, name + '.jpg'), jpg);
  total += jpg.length;
  const flag = jpg.length > maxKb * 1024 ? ' !!QUÁ NẶNG' : '';
  console.log(`✓ ${name}.jpg  ${(jpg.length / 1024).toFixed(1)} KB (q${q})${flag}${warn.length ? '  ⚠ ' + warn.join('; ') : ''}${errors.length ? '  ERR ' + errors.join(' | ') : ''}`);
  await page.close();
}
await browser.close();
console.log(`Tổng ${names.length - bad} ảnh, ${(total / 1024).toFixed(0)} KB -> ${path.relative(process.cwd(), OUT) || OUT}`);
if (bad) process.exit(1);
