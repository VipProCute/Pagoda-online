'use strict';
/*
 * Máy chủ tĩnh nhỏ để xem thử giao diện Võ Học Các / Sân đấu với socket giả, không cần chạy cả chùa.
 *   node tools/ui-harness/serve.js [cổng]   →  http://127.0.0.1:4173/harness/dojo/  (hoặc /harness/arena/)
 * `/harness/*` lấy từ tools/ui-harness/, còn lại lấy từ public/.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const PUB = path.join(__dirname, '..', '..', 'public'), HAR = __dirname;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.mp3': 'audio/mpeg' };
http.createServer((req, res) => {
  let url = decodeURIComponent(req.url.split('?')[0]);
  if (url.endsWith('/')) url += 'index.html';
  const base = url.startsWith('/harness/') ? HAR : PUB, rel = url.startsWith('/harness/') ? url.slice('/harness/'.length) : url;
  const file = path.normalize(path.join(base, rel));
  if (!file.startsWith(base)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404); return res.end('404'); }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(buf);
  });
}).listen(Number(process.argv[2]) || 4173, '127.0.0.1', () => console.log('ui-harness: http://127.0.0.1:' + (Number(process.argv[2]) || 4173) + '/harness/'));
