'use strict';
/*
 * Máy chủ tĩnh nhỏ để xem thử giao diện Võ Học Các / Sân đấu với socket giả, không cần chạy cả chùa.
 *   node tools/ui-harness/serve.js [cổng]   →  http://127.0.0.1:4173/harness/dojo/  (hoặc /harness/arena/)
 * `/harness/*` lấy từ tools/ui-harness/, `/vendor/three*` lấy từ node_modules/three (cho bàn cờ 3D), còn lại lấy từ public/.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const PUB = path.join(__dirname, '..', '..', 'public'), HAR = __dirname;
const THREE = path.join(__dirname, '..', '..', 'node_modules', 'three');
// Giống server.js: /vendor/three → build, /vendor/three-addons → examples/jsm.
const VENDOR = [['/vendor/three-addons/', path.join(THREE, 'examples', 'jsm')], ['/vendor/three/', path.join(THREE, 'build')]];
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.glb': 'model/gltf-binary', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.mp3': 'audio/mpeg' };
// Xác định tệp ứng với URL. Trả { status: 200|400|403, file? }; không đọc đĩa.
function resolveFile(rawUrl) {
  let url;
  try { url = decodeURIComponent(String(rawUrl).split('?')[0]); } catch (e) { return { status: 400 }; }
  if (url.endsWith('/')) url += 'index.html';
  const vendor = VENDOR.find(v => url.startsWith(v[0]));
  const base = vendor ? vendor[1] : url.startsWith('/harness/') ? HAR : PUB;
  const rel = vendor ? url.slice(vendor[0].length) : url.startsWith('/harness/') ? url.slice('/harness/'.length) : url;
  const file = path.normalize(path.join(base, rel));
  // path.relative chặn cả thư mục anh em cùng tiền tố (build-private cạnh build).
  const back = path.relative(base, file);
  if (back.startsWith('..') || path.isAbsolute(back)) return { status: 403 };
  return { status: 200, file };
}
module.exports = { resolveFile };

if (require.main === module) {
  http.createServer((req, res) => {
    const r = resolveFile(req.url);
    if (r.status !== 200) { res.writeHead(r.status); return res.end(); }
    fs.readFile(r.file, (err, buf) => {
      if (err) { res.writeHead(404); return res.end('404'); }
      res.writeHead(200, { 'content-type': TYPES[path.extname(r.file)] || 'application/octet-stream', 'cache-control': 'no-store' });
      res.end(buf);
    });
  }).listen(Number(process.argv[2]) || 4173, '127.0.0.1', () => console.log('ui-harness: http://127.0.0.1:' + (Number(process.argv[2]) || 4173) + '/harness/'));
}
