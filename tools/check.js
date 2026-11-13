'use strict';
// Kiểm cú pháp mọi file JS/MJS của dự án bằng `node --check`.
// Tự quét, không liệt kê tay: thêm file JS/MJS mới là được kiểm ngay.
// Chạy: npm run check   (thoát mã 1 và in tên file nếu có lỗi cú pháp)

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');

// Quét đệ quy các thư mục này; server.js nằm ở gốc.
const SCAN_DIRS = ['lib', 'public/js', 'tools', 'test'];
const ROOT_FILES = ['server.js'];
const SKIP_DIRS = new Set(['node_modules', '.claude', '.git']);

function walk(dir, out) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (e) {
    return; // thư mục không tồn tại thì bỏ qua
  }
  entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  for (const ent of entries) {
    if (ent.isDirectory()) {
      if (!SKIP_DIRS.has(ent.name)) walk(path.join(dir, ent.name), out);
    } else if (ent.isFile() && /\.(?:js|mjs)$/.test(ent.name)) {
      out.push(path.join(dir, ent.name));
    }
  }
}

function collect() {
  const files = [];
  for (const f of ROOT_FILES) {
    const p = path.join(ROOT, f);
    if (fs.existsSync(p)) files.push(p);
  }
  for (const d of SCAN_DIRS) walk(path.join(ROOT, d), files);
  return files;
}

function main() {
  const files = collect();
  const failed = [];
  for (const file of files) {
    const rel = path.relative(ROOT, file).split(path.sep).join('/');
    const r = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
    if (r.status !== 0) {
      failed.push(rel);
      console.error('LỖI CÚ PHÁP: ' + rel);
      const msg = (r.stderr || r.stdout || (r.error && r.error.message) || '').trim();
      if (msg) console.error(msg);
    }
  }
  if (failed.length) {
    console.error('\nKiểm cú pháp: ' + failed.length + '/' + files.length + ' file lỗi:');
    for (const f of failed) console.error('  - ' + f);
    process.exit(1);
  }
  console.log('Kiểm cú pháp: ' + files.length + ' file JS/MJS sạch.');
}

main();
