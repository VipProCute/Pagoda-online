'use strict';
// Nút "Người cũ" của lớp 3D (public/js/view3d-ui.js): chạy thật mã trình duyệt trong vm
// với DOM giả tối thiểu; chỉ thay lệnh import() động của world3d bằng hàm giả.
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');

const SOURCE = fs.readFileSync(require.resolve('../public/js/view3d-ui'), 'utf8');
const TITLE_NEW = 'Đổi về dáng nhân vật cũ (dựng bằng mã). Cảnh sẽ dựng lại.';
const TITLE_OLD = 'Đang dùng dáng nhân vật cũ; bấm để dùng dáng mới. Cảnh sẽ dựng lại.';
const flush = () => new Promise(resolve => setImmediate(resolve));

function fixture({ avatar, view = { on: false, mode: 'third', quality: 'medium' }, getThrows = false, setThrows = false } = {}) {
  const elements = [], holds = [], starts = [], notices = [], calls = [];
  const store = {};
  if (avatar !== undefined) store['ta-avatar'] = avatar;
  if (view) store['ta-view'] = JSON.stringify(view);
  const node = () => {
    const listeners = {}, attrs = {};
    const value = { style: {}, children: [], clientLeft: 0, clientTop: 0, scrollLeft: 0, scrollTop: 0, title: '',
      addEventListener(type, fn) { (listeners[type] ||= []).push(fn); },
      click() { for (const fn of listeners.click || []) fn({}); },
      setAttribute(key, val) { attrs[key] = String(val); }, getAttribute: key => (key in attrs ? attrs[key] : null),
      append(...children) { this.children.push(...children); children.forEach(child => { child.parentElement = this; }); },
      insertAdjacentElement(where, child) { child.parentElement = this.parentElement; },
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }) };
    elements.push(value); return value;
  };
  const world = { async start(options) { starts.push(options); return { ok: true }; }, stop() {}, setView() {} };
  const H = { scene: 'hall', attach() {}, setScene() {}, pause() {},
    view3d: { snapshot: () => ({}), fire() {}, hold(on) { holds.push(on); } } };
  const target = node(); target.parentElement = node();
  const sandbox = { Hall: H, document: { createElement: node, body: node() }, addEventListener() {},
    localStorage: {
      getItem(key) { if (getThrows) throw new Error('bị chặn'); return key in store ? store[key] : null; },
      setItem(key, val) { if (setThrows && key === 'ta-avatar') throw new Error('đầy bộ nhớ'); calls.push(['set', key, String(val)]); store[key] = String(val); },
      removeItem(key) { calls.push(['remove', key]); delete store[key]; } },
    loadWorld: () => Promise.resolve(world) };
  assert.match(SOURCE, /import\('\/js\/world3d\/index\.mjs\?v=\d+'\)/);
  vm.runInNewContext(SOURCE.replace(/import\('\/js\/world3d\/index\.mjs\?v=\d+'\)/, 'loadWorld()'), sandbox);
  sandbox.View3D.init({ canvas: target, notify: message => notices.push(message) });
  const toolbar = elements.find(element => element.className === 'v3-controls');
  return { V: sandbox.View3D, figure: toolbar.children[2], store, holds, starts, notices, calls };
}

test('Nút Người cũ: mặc định dùng Blender, nhãn, aria-pressed và gợi ý đúng', async () => {
  const f = fixture(); await flush();
  assert.equal(f.figure.textContent, 'Người cũ');
  assert.equal(f.figure.getAttribute('aria-pressed'), 'false');
  assert.equal(f.figure.title, TITLE_NEW);
});

test('Nút Người cũ: khóa ta-avatar = code thì aria-pressed true và gợi ý đổi sang dáng mới', async () => {
  const f = fixture({ avatar: 'code' }); await flush();
  assert.equal(f.figure.getAttribute('aria-pressed'), 'true');
  assert.equal(f.figure.title, TITLE_OLD);
});

test('Nút Người cũ: giá trị khác "code" vẫn coi là đang dùng Blender', async () => {
  const f = fixture({ avatar: 'blender' }); await flush();
  assert.equal(f.figure.getAttribute('aria-pressed'), 'false');
  assert.equal(f.figure.title, TITLE_NEW);
});

test('Nút Người cũ: localStorage ném lỗi thì coi như đang dùng Blender', async () => {
  const f = fixture({ getThrows: true }); await flush();
  assert.equal(f.figure.getAttribute('aria-pressed'), 'false');
  assert.equal(f.figure.title, TITLE_NEW);
});

test('Bấm khi đang Blender: lưu code, cập nhật nút và dựng lại cảnh', async () => {
  const f = fixture({ view: { on: true, mode: 'third', quality: 'medium' } }); await flush();
  const startsBefore = f.starts.length, holdsBefore = f.holds.length;
  f.figure.click();
  assert.deepEqual(f.calls.filter(call => call[1] === 'ta-avatar'), [['set', 'ta-avatar', 'code']]);
  assert.equal(f.store['ta-avatar'], 'code');
  assert.ok(f.holds.length > holdsBefore, 'sync() gỡ lớp 3D ngay');
  await flush();
  assert.equal(f.starts.length, startsBefore + 1, 'cảnh 3D dựng lại');
  assert.equal(f.figure.getAttribute('aria-pressed'), 'true');
  assert.equal(f.figure.title, TITLE_OLD);
  assert.deepEqual(f.notices, []);
});

test('Bấm khi đang dáng cũ: xóa khóa, về Blender và dựng lại cảnh', async () => {
  const f = fixture({ avatar: 'code', view: { on: true, mode: 'third', quality: 'medium' } }); await flush();
  const startsBefore = f.starts.length;
  f.figure.click();
  assert.deepEqual(f.calls.filter(call => call[1] === 'ta-avatar'), [['remove', 'ta-avatar']]);
  assert.equal('ta-avatar' in f.store, false);
  await flush();
  assert.equal(f.starts.length, startsBefore + 1);
  assert.equal(f.figure.getAttribute('aria-pressed'), 'false');
  assert.equal(f.figure.title, TITLE_NEW);
});

test('Bấm khi không lưu được: báo notify, không ném lỗi, không dựng lại cảnh', async () => {
  const f = fixture({ setThrows: true, view: { on: true, mode: 'third', quality: 'medium' } }); await flush();
  const startsBefore = f.starts.length, holdsBefore = f.holds.length;
  assert.doesNotThrow(() => f.figure.click());
  await flush();
  assert.deepEqual(f.notices, ['Trình duyệt không cho lưu lựa chọn nhân vật.']);
  assert.equal(f.starts.length, startsBefore);
  assert.equal(f.holds.length, holdsBefore);
});

test('Nút Người cũ ẩn khi 3D chưa bật hoặc đang ở sân đấu PK', async () => {
  const off = fixture(); await flush();
  assert.equal(off.figure.hidden, true, '3D tắt thì ẩn');
  const on = fixture({ view: { on: true, mode: 'third', quality: 'medium' } }); await flush();
  assert.equal(on.V.active, true);
  assert.equal(on.figure.hidden, false, '3D bật thì hiện');
  on.V.setPK(true); await flush();
  assert.equal(on.figure.hidden, true, 'PK thì ẩn');
  on.V.setPK(false); await flush();
  assert.equal(on.figure.hidden, false, 'rời PK thì hiện lại');
});
