'use strict';
/* Kỳ Đài · tải mô hình nguồn (Poly Haven, CC0) cho sân v2.
 * Chạy: node tools/blender/kydao/fetch-assets.js [field ...]
 * Danh sách ở tools/blender/kydao/assets.json. File ghi vào assets-src/polyhaven/<id>/ (không commit).
 * Đã có file đúng kích thước thì bỏ qua, nên chạy lại được nhiều lần. */
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const OUT = path.join(ROOT, 'assets-src', 'polyhaven');
const API = 'https://api.polyhaven.com/files/';
const HEADERS = { 'User-Agent': 'asset-fetch/1.0' };
const ID_OK = /^[A-Za-z0-9_]+$/;

async function download(url, file, size) {
  if (fs.existsSync(file) && (!size || fs.statSync(file).size === size)) return false;
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error('HTTP ' + res.status + ' khi tải ' + url);
  const buf = Buffer.from(await res.arrayBuffer());
  if (size && buf.length !== size) throw new Error('Sai kích thước: ' + url);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, buf);
  return true;
}

async function info(id) {
  const res = await fetch(API + id, { headers: HEADERS });
  if (!res.ok) throw new Error('HTTP ' + res.status + ' khi hỏi danh sách tệp của ' + id);
  return res.json();
}

// Chỉ nhận đường dẫn con nằm trong thư mục của mô hình (không cho "..", không cho đường dẫn tuyệt đối).
function safeJoin(dir, rel) {
  const file = path.resolve(dir, rel);
  if (file !== dir && !file.startsWith(dir + path.sep)) throw new Error('Đường dẫn lạ trong gói: ' + rel);
  return file;
}

// Mục trong danh sách: "ma_mo_hinh" hoặc "ma_mo_hinh@2k" (độ phân giải ảnh riêng cho mô hình đó).
async function fetchAsset(entry, defaultRes) {
  const [id, res = defaultRes] = String(entry).split('@');
  if (!/^[1248]k$/.test(res)) throw new Error('Độ phân giải không hợp lệ: ' + entry);
  if (!ID_OK.test(id)) throw new Error('Mã mô hình không hợp lệ: ' + id);
  const meta = await info(id);
  const pack = meta && meta.gltf && meta.gltf[res] && meta.gltf[res].gltf;
  if (!pack || !pack.url) throw new Error('Không có bản glTF ' + res + ' cho ' + id);
  const dir = path.join(OUT, id);
  let bytes = pack.size || 0, fresh = 0;
  fresh += await download(pack.url, safeJoin(dir, id + '.gltf'), pack.size);
  for (const [rel, f] of Object.entries(pack.include || {})) {
    bytes += f.size || 0;
    fresh += await download(f.url, safeJoin(dir, rel), f.size);
  }
  return { id, bytes, fresh };
}

// Texture (vân gỗ, đá): lấy ba ảnh màu, pháp tuyến, độ nhám dạng JPG vào assets-src/polyhaven-tex/<id>/.
async function fetchTexture(entry, defaultRes) {
  const [id, res = defaultRes] = String(entry).split('@');
  if (!/^[1248]k$/.test(res)) throw new Error('Độ phân giải không hợp lệ: ' + entry);
  if (!ID_OK.test(id)) throw new Error('Mã texture không hợp lệ: ' + id);
  const meta = await info(id);
  const dir = path.join(ROOT, 'assets-src', 'polyhaven-tex', id);
  let bytes = 0, fresh = 0;
  for (const [map, name] of [['Diffuse', 'diff'], ['nor_gl', 'nor_gl'], ['Rough', 'rough']]) {
    const f = meta && meta[map] && meta[map][res] && meta[map][res].jpg;
    if (!f || !f.url) throw new Error('Không có ảnh ' + map + ' ' + res + ' cho ' + id);
    bytes += f.size || 0;
    fresh += await download(f.url, safeJoin(dir, id + '_' + name + '.jpg'), f.size);
  }
  return { id, bytes, fresh };
}

async function main() {
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'assets.json'), 'utf8'));
  const want = process.argv.slice(2);
  const fields = want.length ? want.filter(f => f !== 'textures') : Object.keys(manifest.fields);
  for (const f of fields) if (!manifest.fields[f]) throw new Error('Không có nhóm "' + f + '" trong assets.json');
  const ids = [...new Set(fields.flatMap(f => manifest.fields[f] || []))];
  let total = 0;
  for (const id of ids) {
    const r = await fetchAsset(id, manifest.res);
    total += r.bytes;
    console.log((r.fresh ? 'tải  ' : 'có rồi ') + id + '  ' + (r.bytes / 1048576).toFixed(1) + ' MB');
  }
  if (!want.length || want.includes('textures')) {
    for (const id of manifest.textures || []) {
      const r = await fetchTexture(id, manifest.res);
      total += r.bytes;
      console.log((r.fresh ? 'tải  ' : 'có rồi ') + 'texture ' + id + '  ' + (r.bytes / 1048576).toFixed(1) + ' MB');
    }
  }
  console.log('Xong ' + ids.length + ' mô hình, ' + (total / 1048576).toFixed(1) + ' MB ở ' + path.dirname(OUT));
}

main().catch(e => { console.error(e.message); process.exit(1); });
