'use strict';
// Kỳ Đạo · Bàn 2D cờ vây/caro vẽ skin đá (Canvas giả ghi lại lệnh vẽ).
const test = require('node:test');
const assert = require('node:assert/strict');
const KydaoSkins = require('../public/js/kydao-skins.js');
const KydaoDraw = require('../public/js/kydao-draw.js');

global.KydaoSkins = KydaoSkins;

function recorder() {
  const log = [];
  const ctx = new Proxy({ canvas: {} }, {
    get(t, k) {
      if (k in t) return t[k];
      if (k === 'createLinearGradient' || k === 'createRadialGradient') return (...a) => { log.push([k, ...a]); return { addColorStop: (...s) => log.push(['stop', ...s]) }; };
      return (...a) => { log.push([k, ...a]); };
    },
    set(t, k, v) { log.push(['=' + String(k), v]); return true; }
  });
  return { ctx, log };
}

const board = (game, cells) => {
  const n = game === 'go' ? 9 : 15, b = new Array(n * n).fill('');
  for (const [i, ch] of Object.entries(cells)) b[i] = ch;
  return b;
};
const base = (game, extra) => Object.assign({ game, size: game === 'go' ? 9 : 15, w: 360, h: 360, dpr: 1, board: board(game, { 0: 'a', 1: 'b' }) }, extra || {});
const run = o => { const r = recorder(); KydaoDraw.draw(r.ctx, o); return r.log.map(l => l.map(v => (v && typeof v === 'object' ? '[gradient]' : v))); };
const SKINS = { a: { field: null, pieces: 'cosmos' }, b: { field: null, pieces: 'magma' } };
const lastIndex = (log, name) => log.map(l => l[0]).lastIndexOf(name);

test('cờ vây/caro không có skin: chuỗi lệnh y như khi o.skins vắng hoặc rỗng', () => {
  for (const game of ['go', 'gomoku']) {
    const plain = run(base(game));
    assert.deepEqual(run(base(game, { skins: null })), plain);
    assert.deepEqual(run(base(game, { skins: { a: { field: null, pieces: null }, b: null } })), plain);
    assert.deepEqual(run(base(game, { skins: SKINS, hideSkins: { a: true, b: true } })), plain, 'ẩn cả hai bên thì vẽ mặc định');
  }
});

test('cờ vây có skin chưa tải ảnh: viên đá lấy gradient theo màu base của bộ', () => {
  const log = run(base('go', { skins: SKINS }));
  const stops = log.filter(l => l[0] === 'stop').map(l => l[2]);
  assert.ok(stops.some(c => /^rgb\(/.test(c)), 'gradient màu rgb pha từ base');
  assert.ok(!stops.includes('#65666a'), 'không còn màu đá đen mặc định');
  assert.ok(log.some(l => l[0] === '=strokeStyle' && l[1] === KydaoSkins.STONES.cosmos.a.accent), 'vòng mảnh màu accent');
  assert.ok(!log.some(l => l[0] === 'drawImage'));
});

test('cờ vây có skin đã tải ảnh: drawImage lấy ô trái cho bên a, ô phải cho bên b', () => {
  const had = Object.prototype.hasOwnProperty.call(global, 'Image'), old = global.Image;
  global.Image = function () {
    const img = this; img.naturalWidth = 256; img.naturalHeight = 128;
    Object.defineProperty(img, 'src', { set() { if (img.onload) img.onload(); } });
  };
  try {
    run(base('go', { skins: SKINS })); // lần đầu kích hoạt tải
    const log = run(base('go', { skins: SKINS }));
    const draws = log.filter(l => l[0] === 'drawImage');
    assert.equal(draws.length, 2);
    assert.deepEqual(draws.map(d => d[2]).sort((x, y) => x - y), [0, 128]);
    const da = draws.find(d => d[2] === 0);
    assert.equal(da[4], 128); assert.equal(da[5], 128);
    const g = KydaoDraw.layout('go', 360, 360, 9);
    assert.ok(Math.abs(da[8] - g.cell * 0.88 * 128 / 112) < 1e-9);
  } finally { if (had) global.Image = old; else delete global.Image; }
});

test('caro có skin: dấu X (bên a) và O (bên b) vẽ sau lệnh vẽ đá, màu mark', () => {
  const log = run(base('gomoku', { skins: SKINS }));
  const iMark = log.findIndex(l => l[0] === '=strokeStyle' && l[1] === KydaoSkins.STONES.cosmos.a.mark);
  const iMarkB = log.findIndex(l => l[0] === '=strokeStyle' && l[1] === KydaoSkins.STONES.magma.b.mark);
  assert.ok(iMark > 0 && iMarkB > 0);
  assert.ok(log.slice(0, iMark).some(l => l[0] === 'createRadialGradient'), 'đá vẽ trước dấu');
  const cell = KydaoDraw.layout('gomoku', 360, 360, 15).cell;
  assert.ok(log.some(l => l[0] === 'arc' && Math.abs(l[3] - cell * 0.44 * 0.5 * 0.8) < 1e-9), 'dấu O');
});

test('hideSkins: chỉ bên bị ẩn vẽ mặc định', () => {
  const full = run(base('go', { skins: SKINS }));
  const hidden = run(base('go', { skins: SKINS, hideSkins: { b: true } }));
  assert.ok(hidden.some(l => l[0] === 'stop' && l[2] === '#fffef4'), 'bên b mặc định');
  assert.ok(!full.some(l => l[0] === 'stop' && l[2] === '#fffef4'));
  assert.ok(hidden.some(l => l[0] === 'stop' && /^rgb\(/.test(l[2])), 'bên a vẫn có skin');
});

test('dãy thắng caro và đá chết cờ vây vẽ sau đá có skin', () => {
  let log = run(base('gomoku', { skins: SKINS, win: ['a1', 'b1'] }));
  assert.ok(log.findIndex(l => l[0] === '=strokeStyle' && l[1] === '#208349') > lastIndex(log, 'createRadialGradient'));
  log = run(base('go', { skins: SKINS, dead: ['A1'] }));
  assert.ok(log.findIndex(l => l[0] === '=strokeStyle' && l[1] === '#e43c27') > lastIndex(log, 'createRadialGradient'));
});
