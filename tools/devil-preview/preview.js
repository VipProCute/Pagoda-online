// Dựng ảnh xem thử cho public/img/devil.svg bằng Playwright Chromium (chỉ là công cụ phát triển).
//   node tools/devil-preview/preview.js [thư_mục_ra]
// Ra: svg-600x800.png, cover-1280x720.png, cover-390x844.png (nạp bằng <img>, object-fit: cover),
//     inline-600x800.png (SVG nhúng trực tiếp) và in độ lệch pixel giữa <img> và inline.
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const svgPath = path.resolve(__dirname, '..', '..', 'public', 'img', 'devil.svg');
const outDir = path.resolve(process.argv[2] || path.join(__dirname, 'out'));
fs.mkdirSync(outDir, { recursive: true });
const svgUrl = 'file://' + svgPath;
const svgText = fs.readFileSync(svgPath, 'utf8');

const page = (w, h, body) => `<!doctype html><meta charset="utf-8"><style>
html,body{margin:0;background:#000;width:${w}px;height:${h}px;overflow:hidden}
img,svg{display:block;width:${w}px;height:${h}px;object-fit:cover}
</style>${body}`;

(async () => {
  const browser = await chromium.launch();
  const shots = [
    ['svg-600x800.png', 600, 800, 1],
    ['cover-1280x720.png', 1280, 720, 1],
    ['cover-390x844.png', 390, 844, 2],
  ];
  for (const [name, w, h, dpr] of shots) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr });
    const p = await ctx.newPage();
    const t0 = Date.now();
    const hp = path.join(outDir, name + '.html');
    fs.writeFileSync(hp, page(w, h, `<img id="i" src="${svgUrl}" alt="">`));
    await p.goto('file://' + hp);
    await p.evaluate(() => document.getElementById('i').decode());
    const t1 = Date.now();
    await p.screenshot({ path: path.join(outDir, name) });
    console.log(name, 'decode+layout ms:', t1 - t0);
    await ctx.close();
  }
  // inline vs <img> ở 600x800
  const ctx = await browser.newContext({ viewport: { width: 600, height: 800 }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  const ip = path.join(outDir, 'inline.html');
  fs.writeFileSync(ip, page(600, 800, svgText.replace(/<svg /, '<svg id="s" ')));
  await p.goto('file://' + ip);
  await p.screenshot({ path: path.join(outDir, 'inline-600x800.png') });
  await ctx.close();
  await browser.close();
})();
