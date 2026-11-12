'use strict';
/*
 * Thanh đổi map (T-010): chạy public/js/mapbar.js trong node:vm với DOM giả tối thiểu, rồi kiểm các điểm
 * mà đợt sửa giao diện dễ làm vỡ (nút sáng đúng chỗ, ẩn nút Sân đấu, không còn id nút cũ, đường gọi lúc vào chùa).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');

/** DOM giả vừa đủ cho mapbar.js: createElement, append, setAttribute, classList, addEventListener, dataset, hidden. */
function fakeEl(tag) {
  const el = {
    tag, children: [], attrs: {}, dataset: {}, className: '', hidden: false, textContent: '', listeners: {},
    classes: new Set(),
    classList: { toggle(c, on) { if (on) el.classes.add(c); else el.classes.delete(c); }, contains: c => el.classes.has(c) },
    setAttribute(k, v) { el.attrs[k] = String(v); },
    removeAttribute(k) { delete el.attrs[k]; },
    append(...kids) { el.children.push(...kids); },
    addEventListener(t, fn) { (el.listeners[t] = el.listeners[t] || []).push(fn); },
    click() { (el.listeners.click || []).forEach(fn => fn()); }
  };
  return el;
}

function load() {
  const win = { document: { createElement: fakeEl } };
  win.window = win;
  vm.runInNewContext(read('public/js/mapbar.js'), win, { filename: 'mapbar.js' });
  return win;
}

const buttons = nav => nav.children;
const byMap = (nav, id) => nav.children.find(b => b.dataset.map === id);

test('MapBar.mount: dựng đúng 4 nút trong <nav aria-label="Đổi nơi">, Chánh điện sáng sau setCurrent', () => {
  const { MapBar } = load();
  const host = fakeEl('div');
  const nav = MapBar.mount(host);
  assert.equal(nav.tag, 'nav');
  assert.equal(nav.attrs['aria-label'], 'Đổi nơi');
  assert.deepEqual(buttons(nav).map(b => b.dataset.map), ['hall', 'yard', 'library', 'arena']);
  MapBar.setCurrent('hall');
  assert.equal(byMap(nav, 'hall').attrs['aria-current'], 'page');
  assert.ok(byMap(nav, 'hall').classes.has('on'));
  for (const id of ['yard', 'library', 'arena']) {
    assert.equal(byMap(nav, id).attrs['aria-current'], undefined, `${id} không được có aria-current`);
    assert.ok(!byMap(nav, id).classes.has('on'));
  }
});

test('MapBar.setCurrent: chỉ một nút sáng; thanh mount sau vẫn nhận trạng thái hiện tại', () => {
  const { MapBar } = load();
  const a = MapBar.mount(fakeEl('div'));
  MapBar.setCurrent('library');
  const b = MapBar.mount(fakeEl('div'));          // ví dụ thanh gắn vào đầu màn Sân đấu (T-012)
  for (const nav of [a, b]) {
    assert.deepEqual(buttons(nav).filter(x => x.classes.has('on')).map(x => x.dataset.map), ['library']);
  }
  MapBar.setCurrent('arena');
  for (const nav of [a, b]) assert.equal(byMap(nav, 'arena').attrs['aria-current'], 'page');
  assert.equal(byMap(a, 'library').attrs['aria-current'], undefined);
});

test('MapBar.setEnabled: ẩn/hiện nút Sân đấu, giữ khi mount sau', () => {
  const { MapBar } = load();
  const a = MapBar.mount(fakeEl('div'));
  MapBar.setEnabled('arena', false);
  assert.equal(byMap(a, 'arena').hidden, true);
  assert.equal(byMap(a, 'hall').hidden, false);
  const b = MapBar.mount(fakeEl('div'));
  assert.equal(byMap(b, 'arena').hidden, true);
  MapBar.setEnabled('arena', true);
  assert.equal(byMap(a, 'arena').hidden, false);
  assert.equal(byMap(b, 'arena').hidden, false);
});

test('MapBar.configure: bấm nút gọi go(id) một lần; chưa cấu hình thì bấm không lỗi', () => {
  const { MapBar } = load();
  const nav = MapBar.mount(fakeEl('div'));
  assert.doesNotThrow(() => byMap(nav, 'yard').click());
  const calls = [];
  MapBar.configure({ go: id => calls.push(id) });
  byMap(nav, 'library').click();
  byMap(nav, 'arena').click();
  assert.deepEqual(calls, ['library', 'arena']);
});

test('Giao diện: không còn id nút cũ của thanh cảnh trong public/', () => {
  const gone = ['go-yard', 'go-hall', 'go-library', 'open-lot', 'open-horoscope', 'open-tarot', 'lib-sit', 'lib-read', 'lib-dojo'];
  const files = [];
  (function walk(dir) {
    for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
      const rel = dir + '/' + e.name;
      if (e.isDirectory()) { if (e.name !== 'img' && e.name !== 'audio' && e.name !== 'kinh') walk(rel); }
      else if (/\.(html|js|css)$/.test(e.name)) files.push(rel);
    }
  })('public');
  for (const rel of files) {
    const text = read(rel);
    for (const id of gone) {
      const re = new RegExp(`id=["']${id}["']|#${id}(?![\\w-])|getElementById\\(["']${id}["']\\)|\\$\\(["']${id}["']\\)`);
      assert.ok(!re.test(text), `${rel} vẫn còn dùng id "${id}" của thanh cảnh cũ`);
    }
  }
});

test('Đường gọi lúc vào chùa: fortune.reset gọi setScene("hall"), applyScene cập nhật thanh đổi map', () => {
  const fortune = read('public/js/fortune.js');
  assert.match(fortune, /reset\(queue\)\{.*setScene\('hall'\)/, 'fortune.reset phải gọi setScene(\'hall\') (đường duy nhất làm nút Chánh điện sáng lúc vào chùa)');
  const app = read('public/js/app.js').replace(/\r\n/g, '\n');
  const a = app.indexOf('function applyScene(');
  assert.ok(a >= 0, 'không thấy applyScene trong app.js');
  const body = app.slice(a, app.indexOf('\n  }\n', a));
  assert.match(body, /syncMapBar\(\)/, 'applyScene phải gọi syncMapBar()');
  const s = app.indexOf('function syncMapBar(');
  const sync = app.slice(s, app.indexOf('\n  }\n', s));
  assert.match(sync, /MapBar\.setCurrent\(/, 'syncMapBar phải gọi MapBar.setCurrent');
  assert.match(sync, /MapBar\.setEnabled\('arena'/, 'syncMapBar phải gọi MapBar.setEnabled(\'arena\', …)');
  assert.equal((app.match(/MapBar\.configure\(/g) || []).length, 1, 'MapBar.configure chỉ được gọi một lần trong app.js');
  // welcome() chạy fortune.reset(...) sau khi đã đặt cfg
  const w = app.indexOf('function welcome(');
  assert.ok(app.indexOf('cfg = r.config', w) > 0 && app.indexOf('fortune.reset(', w) > app.indexOf('cfg = r.config', w), 'welcome() phải đặt cfg trước khi fortune.reset');
});
