'use strict';

// Nối UI thật với manager thật trong bộ nhớ; không cần spawn máy chủ/trình duyệt.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const Draw = require('../public/js/kydao-draw');
const { createKydaoManager } = require('../lib/kydao/manager');

function surface(reduced = false, extra = {}) {
  const elements = [], frames = [], timers = [], texts = [];
  const context = new Proxy({
    createLinearGradient: () => ({ addColorStop() {} }), createRadialGradient: () => ({ addColorStop() {} }),
    fillText: text => texts.push(text), getTransform: () => ({ a: 1 })
  }, { get: (obj, key) => key in obj ? obj[key] : () => {} });
  function element(tag) {
    const el = { tag, children: [], style: {}, dataset: {}, attrs: {}, listeners: {}, hidden: false, clientWidth: 355, scrollLeft: 0, scrollTop: 0,
      classList: { toggle() {} }, setAttribute(k, v) { this.attrs[k] = v; if (k === 'hidden') this.hidden = true; },
      addEventListener(k, fn) { this.listeners[k] = fn; }, append(...nodes) { this.children.push(...nodes); },
      appendChild(node) { this.children.push(node); }, prepend(node) { this.children.unshift(node); }, remove() {},
      getContext: type => type === '2d' ? context : null,
      getBoundingClientRect() { return { left: 0, top: 0, width: this._w, height: this._h }; }
    };
    Object.defineProperty(el, 'textContent', { get() { return this._text || ''; }, set(value) { this._text = value; this.children = []; } });
    elements.push(el); return el;
  }
  const root = {
    document: { createElement: element, createTextNode: text => ({ textContent: text }), body: element('body') },
    KydaoDraw: Draw, KyChess: require('../public/js/kydao/chess'), KyXiangqi: require('../public/js/kydao/xiangqi'),
    KyGo: require('../public/js/kydao/go'), KyGomoku: require('../public/js/kydao/gomoku'),
    innerHeight: 812, devicePixelRatio: 1, matchMedia: () => ({ matches: reduced }),
    addEventListener() {}, removeEventListener() {}, getComputedStyle: () => ({ paddingLeft: '4', paddingRight: '4' }),
    setTimeout: fn => timers.push(fn), clearTimeout() {}, setInterval() {}, clearInterval() {}, requestAnimationFrame: fn => frames.push(fn)
  };
  Object.assign(root, extra);
  vm.createContext(root);
  vm.runInContext(fs.readFileSync(require.resolve('../public/js/kydao-ui'), 'utf8'), root);
  const content = el => (el.textContent || '') + (el.children || []).map(content).join('');
  const button = label => elements.find(el => el.tag === 'button' && content(el) === label);
  return {
    api: root.KydaoUI, frames, timers, texts, button,
    click(label) { const el = button(label); assert.ok(el, label); assert.equal(el.hidden, false, label); assert.ok(!el.disabled, label); el.listeners.click(); },
    tap(game, size, square, drag = false) {
      const el = elements.find(el => el.tag === 'canvas' && el._w);
      const g = Draw.layout(game, el._w, el._h, size), q = Draw.parseSq(game, square, size), p = Draw.cellXY(g, q.col, q.row, false);
      el.listeners.pointerdown({ clientX: p.x, clientY: p.y });
      if (drag) el.listeners.pointermove({ clientX: p.x + 20, clientY: p.y, pointerType: 'mouse' });
      el.listeners.pointerup({ clientX: p.x + (drag ? 20 : 0), clientY: p.y, preventDefault() {} });
    },
    get canvas() { return elements.find(el => el.tag === 'canvas' && el._w); },
    get message() { return elements.find(el => el.className === 'kd-msg').textContent; }
  };
}

function gameEnv(game, size, reduced, extra) {
  const users = [{ uid: 'ua', pid: 'pa', name: 'An' }, { uid: 'ub', pid: 'pb', name: 'Bình' }, { uid: 'uv', pid: 'pv', name: 'Khách' }];
  const views = users.map(() => surface(reduced, extra)), sent = [], errors = [];
  let seq = 0;
  const deliver = (i, ev, payload) => {
    if (ev === 'kd:start') views[i].api.open(payload, { now: () => 1000, send: (name, data, cb) => {
      sent.push({ i, name, data });
      cb(manager[({ 'resume-play': 'resumePlay' })[name.slice(3)] || name.slice(3)](users[i], data));
    } });
    else views[i].api.apply({ type: ev, ...payload });
  };
  const manager = createKydaoManager({
    now: () => 1000, setTimer: () => ++seq, clearTimer() {}, newId: () => 'van-' + ++seq, newSeed: () => 'seed-ui',
    emit(uid, ev, p) { const i = users.findIndex(u => u.uid === uid); if (i >= 0) { try { deliver(i, ev, p); } catch (error) { errors.push(error); throw error; } } },
    emitRoom(room, ev, p) { if (room === 'kd:1') { try { deliver(2, ev, p); } catch (error) { errors.push(error); throw error; } } },
    isAccount: () => true, getRating: () => null, setRating() {}, pairCountToday: () => 0,
    saveGame() {}, setActive() {}, getActive() {}
  });
  for (const result of [manager.sit(users[0], { table: 1, seat: 0 }), manager.sit(users[1], { table: 1, seat: 1 }),
    manager.setup(users[0], { table: 1, game, ...(size ? { size } : {}), pace: 'fast', rated: false }),
    manager.ready(users[0], { table: 1, ready: true }), manager.ready(users[1], { table: 1, ready: true })]) { if (errors.length) throw errors[0]; assert.equal(result.ok, true, result.reason); }
  return { manager, users, views, sent, state: () => manager.resume(users[0]).start };
}

test('UI thật: vây 19×19 đặt quân, kéo/phóng to, hai pass, đánh dấu, vào lại, đánh tiếp và đồng ý điểm', () => {
  const e = gameEnv('go', 19), [a, b, viewer] = e.views;
  a.click('Phóng to'); assert.ok(a.canvas._w > 800);
  a.tap('go', 19, 'A1', true); assert.equal(e.sent.length, 0, 'kéo bàn không đặt đá');
  a.tap('go', 19, 'A1'); assert.equal(e.state().state.board[0], 'a');
  b.click('Bỏ lượt'); a.click('Bỏ lượt');
  assert.ok(e.state().marks); assert.equal(a.button('Bỏ lượt').hidden, true);
  a.tap('go', 19, 'A1'); assert.deepEqual(e.state().marks.dead, ['A1']);
  a.click('Đồng ý điểm'); assert.equal(a.button('Đồng ý điểm').disabled, true);
  a.api.open(e.state()); assert.equal(a.button('Đồng ý điểm').disabled, true, 'vào lại vẫn giữ dấu và đồng ý');
  b.click('Đánh tiếp'); assert.equal(e.state().clock.turn, 'b'); assert.equal(e.state().marks, undefined);
  b.click('Bỏ lượt'); a.click('Bỏ lượt');
  assert.equal(e.manager.watch(e.users[2], { table: 1 }).ok, true);
  assert.equal(viewer.button('Đồng ý điểm').hidden, true);
  assert.equal(viewer.button('Bàn 3D').hidden, true);
  b.click('Đồng ý điểm'); a.click('Đồng ý điểm');
  assert.equal(e.state(), null); assert.equal(a.button('Bỏ lượt').hidden, true);
  e.manager.shutdown();
});

test('UI thật: caro chơi tới thắng; cờ úp chờ reveal, hiệu ứng tắt khi giảm chuyển động', () => {
  const e = gameEnv('gomoku'), [a, b] = e.views;
  for (const [i, square] of ['a1', 'a2', 'b1', 'b2', 'c1', 'c2', 'd1', 'd2', 'e1'].entries()) {
    // Bên b nhìn từ trên; dùng gửi qua hook bằng core không cần xoay tọa độ giả.
    if (i % 2) {
      const s = e.state(); e.manager.move(e.users[1], { gameId: s.gameId, ply: s.ply, move: square });
    } else a.tap('gomoku', 15, square);
  }
  assert.equal(e.state(), null); assert.equal(a.button('Bàn 3D').hidden, true); e.manager.shutdown();
  for (const reduced of [false, true]) {
    const f = gameEnv('jieqi', undefined, reduced), view = f.views[0];
    view.tap('jieqi', undefined, 'a3'); view.tap('jieqi', undefined, 'a4');
    assert.equal(f.state().ply, 1); assert.notEqual(f.state().state.board[36], 'X');
    assert.match(view.message, /^Lật quân: /);
    assert.equal(view.button('Bàn 3D').hidden, true);
    assert.equal(view.frames.length > 0, !reduced);
    assert.equal(f.sent.filter(x => x.name === 'kd:move').length, 1); f.manager.shutdown();
  }
});

test('khai mở sân: gửi kd:skin và hai bên thấy skin', () => {
  const store = { 'kydao.skin': JSON.stringify({ field: 'volcano', pieces: 'magma' }) };
  const extra = { KydaoSkins: require('../public/js/kydao-skins.js'), localStorage: { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); } } };
  const e = gameEnv('chess', undefined, false, extra), [a, b] = e.views;
  const skinCalls = e.sent.filter(x => x.name === 'kd:skin');
  assert.ok(skinCalls.length >= 1, 'skin quân tự gửi khi vào ván');
  for (const c of skinCalls) { assert.equal(c.data.pieces, 'magma'); assert.equal(c.data.field, null, 'sân chưa gửi'); }
  const gid = e.state().gameId;
  assert.doesNotThrow(() => a.api.apply({ type: 'kd:skin', gameId: gid, side: 'a', field: 'volcano', pieces: 'magma', opened: true }));
  assert.doesNotThrow(() => b.api.apply({ type: 'kd:skin', gameId: gid, side: 'a', field: 'volcano', pieces: 'magma', opened: true }));
  e.manager.shutdown();
  const c = gameEnv('gomoku', undefined, false, extra);
  assert.equal(c.sent.filter(x => x.name === 'kd:skin').length, 0, 'caro không có skin');
  c.manager.shutdown();
});
