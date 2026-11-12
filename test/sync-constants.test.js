'use strict';
/*
 * Chống lệch các hằng số phải đồng bộ bằng tay (docs/agents/ARCHITECTURE.md §6).
 * Test đọc thẳng mã nguồn (không chạy server, không dựng DOM) rồi so sánh. Lệch thì báo rõ file nào, giá trị nào.
 *
 * Thêm một điểm đồng bộ mới (ví dụ MapBar.MAPS, YARD_TABLES, IDLE_FORFEIT_TURNS):
 *   const v = readConst('public/js/mapbar.js', 'MAPS');      // đọc mảng/số/chuỗi/đối tượng dạng literal
 *   same(v, readConst('server.js', 'SCENES'), 'MapBar.MAPS', 'SCENES');
 * Hằng số nằm trong module CommonJS hoặc UMD thì require trực tiếp (như rules.js, martial.js ở dưới).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const sources = new Map();

/** Nội dung UTF-8 của file (đường dẫn tính từ gốc repo, dùng dấu /), có nhớ đệm. */
function src(rel) {
  if (!sources.has(rel)) sources.set(rel, fs.readFileSync(path.join(ROOT, rel), 'utf8'));
  return sources.get(rel);
}

/** Từ vị trí `from` (ngay sau dấu `=`), lấy biểu thức tới dấu `,` hoặc `;` ở mức lồng 0 (bỏ qua chuỗi và ngoặc). */
function sliceExpression(text, from) {
  let depth = 0, quote = null, i = from;
  for (; i < text.length; i++) {
    const c = text[i];
    if (quote) { if (c === '\\') i++; else if (c === quote) quote = null; continue; }
    if (c === '\'' || c === '"' || c === '`') quote = c;
    else if (c === '(' || c === '[' || c === '{') depth++;
    else if (c === ')' || c === ']' || c === '}') { if (--depth < 0) break; }
    else if (depth === 0 && (c === ',' || c === ';')) break;
  }
  return text.slice(from, i).trim();
}

/**
 * Đọc giá trị literal của khai báo `const|let|var NAME = …` (kể cả khi khai báo chung một dòng:
 * `const A = 1, B = 2, C = 3;`) trong file. Biểu thức chỉ được là literal/phép tính thuần (chạy trong vm trống).
 * Ném lỗi nêu rõ file và tên nếu không tìm thấy, để đổi tên/ chuyển chỗ khai báo cũng làm test đỏ.
 */
function readConst(rel, name) {
  const text = src(rel);
  const re = new RegExp('(?:\\b(?:const|let|var)\\s+|,\\s*)' + name + '\\s*=(?!=)', 'g');
  const m = re.exec(text);
  if (!m) throw new Error(`Không tìm thấy khai báo "${name}" trong ${rel} (đã đổi tên hoặc chuyển chỗ? cập nhật test/sync-constants.test.js)`);
  const expr = sliceExpression(text, m.index + m[0].length);
  // JSON qua lại để mảng/đối tượng thuộc realm của test (deepStrictEqual so prototype nên vm trả thẳng sẽ lệch oan)
  try { return JSON.parse(JSON.stringify(vm.runInNewContext('(' + expr + ')', Object.create(null), { timeout: 200 }))); }
  catch (e) { throw new Error(`Không đọc được giá trị "${name}" trong ${rel}: ${expr.slice(0, 80)} (${e.message})`); }
}

/** Từ vị trí dấu `[` mở, trả về literal mảng tới dấu `]` đóng tương ứng (bỏ qua chuỗi). */
function bracketSlice(text, open, label) {
  let depth = 0, quote = null;
  for (let i = open; i < text.length; i++) {
    const c = text[i];
    if (quote) { if (c === '\\') i++; else if (c === quote) quote = null; continue; }
    if (c === '\'' || c === '"' || c === '`') quote = c;
    else if (c === '[') depth++;
    else if (c === ']' && --depth === 0) return text.slice(open, i + 1);
  }
  throw new Error(`Mảng trong ${label} không đóng ngoặc`);
}

/** Tên các nơi mà app.js đăng ký bằng `Places.register(name, …)` trong vòng lặp `for (const [name, …] of [['dojo', …], …])`. */
function placesRegisteredInApp(rel = 'public/js/app.js') {
  const text = src(rel);
  const reg = text.indexOf('Places.register(');
  if (reg < 0) throw new Error(`Không thấy Places.register( trong ${rel}`);
  const head = text.lastIndexOf('for (const [name', reg);
  const ofAt = head < 0 ? -1 : text.indexOf(' of [', head);
  if (ofAt < 0 || ofAt > reg) throw new Error(`Không thấy vòng lặp "for (const [name, …] of [...])" ngay trước Places.register trong ${rel}`);
  const list = bracketSlice(text, ofAt + 4, rel);
  return Array.from(list.matchAll(/\[\s*'([\w-]+)'\s*,/g), m => m[1]);
}

/** So sánh sâu; lệch thì báo tên hai nơi và hai giá trị. */
function same(a, b, labelA, labelB, what) {
  assert.deepStrictEqual(a, b, `${what ? what + ': ' : ''}LỆCH GIỮA ${labelA} = ${JSON.stringify(a)} VÀ ${labelB} = ${JSON.stringify(b)}. Phải sửa cho khớp (ARCHITECTURE.md §6).`);
}

/* ---------- tự kiểm các hàm đọc ---------- */
test('Hàm đọc mã nguồn: bắt được số, mảng lồng, khai báo chung dòng; báo lỗi rõ khi thiếu', () => {
  assert.deepEqual(readConst('server.js', 'LIB_SEATS')[0], [0.22, 0.44]);
  assert.equal(readConst('public/js/arena.js', 'KC_TURNS'), 2);
  assert.deepEqual(readConst('server.js', 'PLACES').slice(0, 2), ['hall', 'dojo']);
  assert.throws(() => readConst('server.js', 'KHONG_CO_TEN_NAY'), /Không tìm thấy khai báo "KHONG_CO_TEN_NAY" trong server\.js/);
});

/* ---------- bồ đoàn Tàng Kinh Các ---------- */
test('Bồ đoàn: LIB_SEATS của server.js khớp public/js/hall.js', () => {
  const server = readConst('server.js', 'LIB_SEATS');
  const hall = readConst('public/js/hall.js', 'LIB_SEATS');
  assert.ok(Array.isArray(server) && server.length > 0, 'LIB_SEATS trong server.js rỗng');
  same(server, hall, 'LIB_SEATS (server.js)', 'LIB_SEATS (public/js/hall.js)');
});

/* ---------- bàn đá Kỳ Đạo ---------- */
test('Bàn đá Kỳ Đạo: YARD_TABLES của server.js khớp public/js/hall.js', () => {
  const server = readConst('server.js', 'YARD_TABLES');
  const hall = readConst('public/js/hall.js', 'YARD_TABLES');
  assert.ok(Array.isArray(server) && server.length === 4, 'YARD_TABLES trong server.js phải có 4 bàn');
  same(server, hall, 'YARD_TABLES (server.js)', 'YARD_TABLES (public/js/hall.js)');
});

/* ---------- hằng số PK ---------- */
test('Hằng số PK: đầu arena.js khớp lib/pk/rules.js (arena.js ghi phần trăm nguyên)', () => {
  const R = require('../lib/pk/rules');
  const A = 'public/js/arena.js';
  assert.equal(readConst(A, 'RAGE_MAX'), R.RAGE_MAX, `RAGE_MAX: ${A} lệch lib/pk/rules.js (${R.RAGE_MAX})`);
  assert.equal(readConst(A, 'RAGE_PCT'), Math.round(R.RAGE_PCT * 100000) / 1000, `RAGE_PCT: ${A} lệch lib/pk/rules.js RAGE_PCT (${R.RAGE_PCT}, ghi phần trăm mỗi điểm nộ)`);
  assert.equal(readConst(A, 'EXPOSED_PCT'), Math.round(R.EXPOSED_PCT * 100), `EXPOSED_PCT: ${A} lệch lib/pk/rules.js EXPOSED_PCT (${R.EXPOSED_PCT} = ${Math.round(R.EXPOSED_PCT * 100)}%)`);
  assert.equal(readConst(A, 'KC_PCT'), Math.round(R.KC_BONUS * 100), `KC_PCT: ${A} lệch lib/pk/rules.js KC_BONUS (${R.KC_BONUS} = ${Math.round(R.KC_BONUS * 100)}%)`);
  assert.equal(readConst(A, 'KC_TURNS'), R.KC_TURNS, `KC_TURNS: ${A} lệch lib/pk/rules.js (${R.KC_TURNS})`);
});

test('Hằng số PK: MARTIAL.PK (public/js/martial.js) khớp lib/pk/rules.js', () => {
  const R = require('../lib/pk/rules');
  const PK = require('../public/js/martial').PK;
  assert.ok(PK && typeof PK === 'object', 'MARTIAL.PK không tồn tại trong public/js/martial.js');
  // MARTIAL.PK ghi giây, rules.js ghi mili giây. Khoá nào của PK cũng phải có nơi so; khoá lạ làm test đỏ để người thêm bổ sung ca kiểm.
  const expected = {
    HP: R.HP,
    TURN_SECONDS: R.TURN_MS / 1000,
    LOADOUT_SECONDS: R.LOADOUT_MS / 1000,
    REVEAL_SECONDS: R.REVEAL_MS / 1000,
    SUDDEN_FROM_TURN: R.SUDDEN_FROM_TURN,
    MAX_TURNS: R.MAX_TURNS,
    IDLE_FORFEIT_TURNS: R.IDLE_FORFEIT_TURNS   // Sổ tay (T-061) đọc số lượt bỏ lỡ bị xử thua từ đây
  };
  for (const k of Object.keys(PK)) assert.ok(k in expected, `MARTIAL.PK.${k} (public/js/martial.js) chưa có ca đối chiếu với lib/pk/rules.js trong test/sync-constants.test.js`);
  for (const [k, v] of Object.entries(expected)) assert.equal(PK[k], v, `MARTIAL.PK.${k} (public/js/martial.js) = ${PK[k]} lệch lib/pk/rules.js (${v})`);
});

/* ---------- danh sách nơi ---------- */
test('Danh sách nơi: mỗi tên trong PLACES của server.js (trừ hall) được app.js đăng ký bằng Places.register', () => {
  const places = readConst('server.js', 'PLACES');
  const registered = placesRegisteredInApp();
  assert.ok(registered.length > 0, 'Không đọc được danh sách nơi trong vòng lặp Places.register của public/js/app.js');
  const missing = places.filter(p => p !== 'hall' && !registered.includes(p));
  assert.deepEqual(missing, [], `PLACES (server.js) có ${JSON.stringify(missing)} mà public/js/app.js chưa đăng ký Places.register (đã đăng ký: ${JSON.stringify(registered)})`);
  // chiều ngược: nơi trình duyệt đăng ký mà máy chủ không biết thì lệnh 'place' sẽ bị từ chối
  const extra = registered.filter(p => !places.includes(p));
  assert.deepEqual(extra, [], `public/js/app.js đăng ký ${JSON.stringify(extra)} mà PLACES (server.js) không có`);
});

/* ---------- thanh đổi map ---------- */
test('Thanh đổi map: MapBar.MAPS (public/js/mapbar.js) khớp SCENES và PLACES của server.js', () => {
  const maps = readConst('public/js/mapbar.js', 'MAPS');
  assert.ok(Array.isArray(maps) && maps.length > 0, 'MapBar.MAPS rỗng');
  assert.equal(new Set(maps.map(m => m.id)).size, maps.length, 'MapBar.MAPS có id trùng');
  for (const m of maps) {
    assert.ok(m.kind === 'scene' || m.kind === 'place', `MapBar.MAPS "${m.id}": kind phải là 'scene' hoặc 'place'`);
    assert.ok(m.label && m.short && m.icon, `MapBar.MAPS "${m.id}": thiếu label/short/icon`);
  }
  // mọi cảnh của máy chủ đều có nút, theo đúng thứ tự (lệnh 'scene' của máy chủ từ chối cảnh lạ)
  same(maps.filter(m => m.kind === 'scene').map(m => m.id), Object.keys(readConst('server.js', 'SCENES')), 'MapBar.MAPS (kind scene)', 'SCENES (server.js)');
  // nút nơi (Sân đấu…) phải là nơi máy chủ biết; Võ Học Các không có nút trên thanh nên không đòi chiều ngược lại
  const places = readConst('server.js', 'PLACES');
  const unknown = maps.filter(m => m.kind === 'place').map(m => m.id).filter(id => !places.includes(id));
  assert.deepEqual(unknown, [], `MapBar.MAPS có nơi ${JSON.stringify(unknown)} mà PLACES (server.js) không có`);
});

module.exports = { src, readConst, bracketSlice, placesRegisteredInApp, same };
