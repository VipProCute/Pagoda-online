'use strict';
/* T-034: chạy khối nối thật của app.js với socket và DOM giả, không bật máy chủ con. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const app = read('public/js/app.js'), html = read('public/index.html');
const block = app.slice(app.indexOf('  /* ---------- Kỳ Đạo:'), app.indexOf('  function welcome(r)'));
const copy = data => JSON.parse(JSON.stringify(data));
const table = (extra = {}) => ({ table: 1, seats: [null, null], status: 'free', watchers: 0, ...extra });
const start = (extra = {}) => ({ gameId: 'van-1', game: 'chess', table: 1, you: 'a', a: { pid: 7 }, b: { pid: 8 }, ...extra });

function setup() {
  const elements = new Map(), events = new Map(), sent = [], applied = [], draws = [], messages = [], logins = [], timers = new Map();
  let tables = [table()], response = null, opened = null, hooks = null, timer = 0;
  function el(id) {
    if (!elements.has(id)) {
      assert.ok(html.includes(`id="${id}"`), 'Id phải có trong trang thật: ' + id);
      elements.set(id, { open: false, hidden: false, disabled: false, textContent: '', listeners: {}, addEventListener(k, fn) { this.listeners[k] = fn; } });
    }
    return elements.get(id);
  }
  const radios = { 'kd-game': ['chess', 'xiangqi'], 'kd-mode': ['friendly', 'rated'], 'kd-pace': ['normal', 'fast'] };
  for (const key of Object.keys(radios)) radios[key] = radios[key].map((value, i) => ({ value, checked: i === 0 }));
  const select = s => {
    const name = /name="([^"]+)"/.exec(s);
    if (name) return s.endsWith(':checked') ? radios[name[1]].find(x => x.checked) : radios[name[1]];
    return el(s.slice(1));
  };
  const socket = {
    on(name, fn) { events.set(name, fn); },
    emit(name, data, cb) {
      sent.push({ name, data: copy(data) });
      if (response && response(name, data, cb)) return;
      cb({ ok: true, ...(name === 'kd:tables' ? { tables: copy(tables) } : name === 'kd:resume' ? { start: null } : {}) });
    }
  };
  const ui = {
    open(s, h) { opened = copy(s); hooks = h; },
    close() { opened = null; if (hooks) hooks.onClose(); },
    apply(d) { applied.push(copy(d)); },
    isOpen() { return !!opened; }
  };
  const ctx = {
    $, $$: select, socket, KydaoUI: ui, me: 7, joined: true, cfg: { kydao: { enabled: true } }, curScene: 'yard', personId: 8,
    Places: { current: 'hall' }, SFX: { ting() {}, pop() {}, mo() {} },
    Hall: { setTables(t) { draws.push(copy(t)); }, player(id) { return { id, name: '<img onerror=1>' }; } },
    serverNow: () => 1000, toast: text => messages.push(text), needLogin: text => logins.push(text), stopTalk() {},
    openDlg: id => { el('dlg-' + id).open = true; }, closeDlg: id => { el('dlg-' + id).open = false; },
    goScene: scene => { ctx.curScene = scene; }, applyScene: scene => { ctx.curScene = scene; },
    setTimeout(fn) { timers.set(++timer, fn); return timer; }, clearTimeout(id) { timers.delete(id); }
  };
  function $(s) { return select(s); }
  vm.createContext(ctx); vm.runInContext(block, ctx);
  return {
    ctx, sent, applied, draws, messages, logins, el, radios, timers, ui,
    push: (name, data) => events.get(name)(data), click: id => el(id).listeners.click(),
    setTables(t) { tables = t; }, respond(fn) { response = fn; },
    get opened() { return opened; }, get hooks() { return hooks; }
  };
}

test('Chạm mặt bàn chọn ghế trống đầu tiên và mở hộp chờ từ gói máy chủ', () => {
  const h = setup();
  h.setTables([table({ seats: [{ pid: 8, name: 'Bạn' }, null], status: 'waiting' })]);
  h.respond((name, data, cb) => {
    if (name !== 'kd:sit') return false;
    h.push('kd:table', table({ status: 'waiting', host: 8, game: 'chess', seats: [{ pid: 8, name: 'Bạn' }, { pid: 7, name: 'Mình' }] }));
    cb({ ok: true }); return true;
  });
  h.ctx.openKydaoTable(1, -1);
  assert.deepEqual(h.sent.at(-1), { name: 'kd:sit', data: { table: 1, seat: 1 } });
  assert.equal(h.el('dlg-kd-lobby').open, true);
  assert.equal(h.el('kd-rules').disabled, true);
});

test('Ghế có người và bàn đầy không gửi lệnh ngồi', () => {
  const h = setup(); h.setTables([table({ seats: [{ pid: 8 }, { pid: 9 }] })]);
  h.ctx.openKydaoTable(1, 0); h.ctx.openKydaoTable(1, -1);
  assert.equal(h.sent.filter(x => x.name === 'kd:sit').length, 0);
});

test('Chủ bàn chọn luật; nhận start trước ack sẵn sàng không mở lại hộp chờ', () => {
  const h = setup();
  h.setTables([table({ status: 'waiting', host: 7, seats: [{ pid: 7, name: 'Mình', ready: false }, null] })]);
  h.ctx.openKydaoTable(1, 0);
  assert.equal(h.el('kd-ready').disabled, true);
  h.click('kd-setup');
  assert.deepEqual(h.sent.at(-1).data, { table: 1, game: 'chess', rated: false, pace: 'normal' });
  h.push('kd:table', table({ status: 'waiting', game: 'chess', host: 7, seats: [{ pid: 7, name: 'Mình', ready: false }, { pid: 8 }] }));
  h.respond((name, d, cb) => {
    if (name !== 'kd:ready') return false;
    h.push('kd:start', start()); cb({ ok: true }); return true;
  });
  h.click('kd-ready');
  assert.equal(h.opened.gameId, 'van-1'); assert.equal(h.el('dlg-kd-lobby').open, false);
});

test('Bàn đang đấu mở người xem; đóng bảng gửi unwatch', () => {
  const h = setup(); h.setTables([table({ status: 'playing', game: 'chess', seats: [{ pid: 8 }, { pid: 9 }] })]);
  h.respond((name, d, cb) => {
    if (name !== 'kd:watch') return false;
    h.push('kd:start', start({ you: undefined })); cb({ ok: true }); return true;
  });
  h.ctx.openKydaoTable(1, -1); assert.equal(h.opened.you, undefined);
  h.ui.close(); assert.deepEqual(h.sent.at(-1), { name: 'kd:unwatch', data: { table: 1 } });
});

test('Môn chưa có bảng không xem hoặc sẵn sàng được', () => {
  const h = setup(); h.setTables([table({ status: 'playing', game: 'go' })]);
  h.ctx.openKydaoTable(1, -1); assert.equal(h.sent.some(x => x.name === 'kd:watch'), false);
  h.setTables([table({ status: 'waiting', game: 'jieqi', seats: [{ pid: 7 }, null] })]);
  h.ctx.openKydaoTable(1, 0); assert.equal(h.el('kd-ready').disabled, true);
});

test('Đổi lựa chọn luật khóa sẵn sàng tới khi máy chủ xác nhận bộ luật mới', () => {
  const h = setup();
  const t = table({ status: 'waiting', host: 7, game: 'chess', seats: [{ pid: 7 }, null] });
  h.setTables([t]); h.ctx.openKydaoTable(1, 0);
  assert.equal(h.el('kd-ready').disabled, false);
  h.el('kd-rules').listeners.change(); assert.equal(h.el('kd-ready').disabled, true);
  h.push('kd:table', { ...t, game: 'xiangqi' }); assert.equal(h.el('kd-ready').disabled, false);
  assert.equal(h.radios['kd-game'].find(x => x.checked).value, 'xiangqi');
});

test('Đấu lại dùng ready rồi start mới đổi bên, giữ đường âm thanh của chùa', () => {
  const h = setup(), sounds = [];
  h.ctx.SFX = { mo: () => sounds.push('đi'), pop: () => sounds.push('ăn'), ting: () => sounds.push('chiếu') };
  h.push('kd:start', start()); h.push('kd:end', { gameId: 'van-1', result: 'draw' });
  h.hooks.send('kd:ready', { table: 1, ready: true });
  h.push('kd:start', start({ gameId: 'van-2', you: 'b', a: { pid: 8 }, b: { pid: 7 } }));
  assert.equal(h.opened.gameId, 'van-2'); assert.equal(h.opened.you, 'b');
  ['move', 'capture', 'check'].forEach(h.hooks.sound);
  assert.deepEqual(sounds, ['đi', 'ăn', 'chiếu']);
});

test('Gói bàn lẻ gộp vào Hall; moved trước start và end chuyển nguyên vẹn cho bảng', () => {
  const h = setup(); const t = table({ table: 2 });
  h.push('kd:table', t); assert.deepEqual(h.draws.at(-1), t);
  for (const type of ['moved', 'offer', 'end']) h.push('kd:' + type, { gameId: 'van-1', ply: 2 });
  assert.deepEqual(h.applied.map(x => x.type), ['kd:moved', 'kd:offer', 'kd:end']);
});

test('Tải lại ván thật về sân, phục hồi giờ máy chủ và nhận biết ghế mang pid cũ', () => {
  const h = setup(); h.ctx.curScene = 'hall';
  h.respond((name, d, cb) => {
    if (name !== 'kd:resume') return false;
    cb({ ok: true, start: start({ a: { pid: 70 } }) }); return true;
  });
  h.ctx.resumeKydao(); assert.equal(h.ctx.curScene, 'yard'); assert.equal(h.hooks.now(), 1000);
  h.ui.close();
  h.setTables([table({ status: 'waiting', host: 70, game: 'chess', seats: [{ pid: 70 }, { pid: 8 }] })]);
  h.ctx.openKydaoTable(1, 0);
  assert.equal(h.el('dlg-kd-lobby').open, true); assert.equal(h.el('kd-setup').hidden, false);
  assert.equal(h.sent.some(x => x.name === 'kd:sit'), false);
});

test('Bàn trong phục hồi tại chỗ, không ép sang sân', () => {
  const h = setup(); h.ctx.curScene = 'hall';
  h.respond((name, d, cb) => { if (name !== 'kd:resume') return false; cb({ ok: true, start: start({ table: null }) }); return true; });
  h.ctx.resumeKydao(); assert.equal(h.ctx.curScene, 'hall'); assert.equal(h.opened.table, null);
});

test('Nối lại người xem dùng watch; đổi cảnh đóng bảng và ngừng xem', () => {
  const h = setup(); h.push('kd:start', start({ you: undefined })); h.push('disconnect');
  h.ctx.curScene = 'hall'; h.ctx.kydaoSceneChanged(); h.ctx.resumeKydao();
  assert.equal(h.sent.some(x => x.name === 'kd:watch' && x.data.table === 1), true);
  h.push('kd:start', start({ you: undefined })); h.ctx.curScene = 'library'; h.ctx.kydaoSceneChanged();
  assert.equal(h.opened, null); assert.equal(h.sent.some(x => x.name === 'kd:unwatch'), true);
});

test('Snapshot sân đến muộn sau đổi cảnh bị bỏ, không khôi phục bàn cũ', () => {
  const h = setup(); let reply;
  h.respond((name, d, cb) => { if (name !== 'kd:tables') return false; reply = cb; return true; });
  h.ctx.fetchKydaoTables(); h.ctx.curScene = 'hall'; reply({ ok: true, tables: [table()] });
  assert.equal(h.draws.length, 0);
});

test('Mời từ hộp người chơi gửi đúng luật, tên người chơi chỉ là văn bản', () => {
  const h = setup(); h.click('person-kydao');
  assert.match(h.el('kd-lobby-info').textContent, /<img onerror=1>/);
  h.click('kd-invite-send');
  assert.deepEqual(h.sent.at(-1), { name: 'kd:invite', data: { toPid: 8, game: 'chess', rated: false, pace: 'normal' } });
});

test('Khách gặp code login giữ lời mời, nhận thành công trước ack vẫn mở ván', () => {
  const h = setup(), offer = { inviteId: 'moi-1', game: 'chess', rated: true, pace: 'normal', expiresAt: 21000, from: { name: 'Bạn' } };
  h.push('kd:invited', offer);
  h.respond((name, d, cb) => { if (name !== 'kd:respond') return false; cb({ ok: false, code: 'login', reason: 'Mời đăng nhập.' }); return true; });
  h.click('kd-invite-accept'); assert.equal(h.logins.length, 1); assert.equal(h.el('dlg-kd-invite').open, true);
  h.respond((name, d, cb) => {
    if (name !== 'kd:respond') return false;
    h.push('kd:invite:closed', { inviteId: 'moi-1', reason: 'accepted' }); h.push('kd:start', start()); cb({ ok: true }); return true;
  });
  h.click('kd-invite-accept'); assert.equal(h.opened.gameId, 'van-1'); assert.equal(h.el('dlg-kd-invite').open, false);
});

test('Lời mời hết hạn đóng hộp; môn chưa hỗ trợ không bật nút nhận', () => {
  const h = setup();
  h.push('kd:invited', { inviteId: 'moi-1', game: 'chess', expiresAt: 21000, from: { name: 'Bạn' } });
  h.ctx.serverNow = () => 22000; h.timers.values().next().value();
  assert.equal(h.el('dlg-kd-invite').open, false);
  h.push('kd:invited', { game: 'go' }); assert.equal(h.el('dlg-kd-invite').open, false);
});

test('Nạp luật, nét quân mới và bảng trước app, giữ importmap và lớp bảng trên 3D', () => {
  const files = ['kydao/chess.js', 'kydao/xiangqi.js', 'kydao-draw.js', 'kydao-ui.js', 'app.js'];
  const positions = files.map(f => html.indexOf('/js/' + f + '?v='));
  assert.ok(positions.every((p, i) => p > 0 && (!i || p > positions[i - 1])));
  assert.match(html, /type="importmap".*three/); assert.match(html, /view3d-ui\.js\?v=/);
  assert.match(html, /kydao\.css\?v=/);
  assert.match(read('public/css/kydao.css'), /\.kd-panel\s*\{[^}]*z-index: 700/);
  assert.match(read('public/js/kydao-ui.js'), /document\.body\.append\(el.panel, el.chip\)/);
  assert.match(app, /table\(id, seat\) \{ openKydaoTable\(id, seat\); \}/);
  assert.match(app, /if \(d.id === me\) applyScene\(d.scene\)/);
  assert.match(app, /Places.resume\(\).then\(resumeKydao\)/);
});
