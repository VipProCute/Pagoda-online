'use strict';
// Kỳ Đạo · Bàn 2D vẽ skin nửa sân, skin quân và độ lệch jolt (Canvas giả ghi lại lệnh vẽ).
const test = require('node:test');
const assert = require('node:assert/strict');
const KydaoSkins = require('../public/js/kydao-skins.js');
const KydaoDraw = require('../public/js/kydao-draw.js');
const KyChess = require('../public/js/kydao/chess.js');
const KyXiangqi = require('../public/js/kydao/xiangqi.js');

global.KydaoSkins = KydaoSkins;

/** Canvas giả: ghi mọi lệnh gọi và mọi lần gán thuộc tính. */
function recorder(extra) {
  const log = [];
  const target = Object.assign({ canvas: {} }, extra || {});
  const ctx = new Proxy(target, {
    get(t, k) {
      if (k in t) return t[k];
      if (k === 'createLinearGradient' || k === 'createRadialGradient') {
        return (...a) => { log.push([k, ...a]); return { addColorStop: (...s) => log.push(['stop', ...s]) }; };
      }
      return (...a) => { log.push([k, ...a]); };
    },
    set(t, k, v) { log.push(['=' + String(k), v]); return true; }
  });
  return { ctx, log };
}

const opts = (game, extra) => {
  const mod = game === 'chess' ? KyChess : KyXiangqi;
  const state = mod.create(game === 'jieqi' ? { variant: 'jieqi', seed: 7 } : {});
  const dim = game === 'chess' ? { w: 400, h: 400 } : { w: 368, h: 408 };
  return Object.assign({ game, board: state.board, ...dim, dpr: 1 }, extra || {});
};
const run = o => { const r = recorder(); KydaoDraw.draw(r.ctx, o); return r.log; };
const SKINS = { a: { field: 'volcano', pieces: 'magma' }, b: { field: 'glacier', pieces: 'ice' } };

/** So hai chuỗi lệnh; báo lệnh khác đầu tiên cho dễ tìm. */
function sameLog(actual, expected, msg) {
  const n = Math.max(actual.length, expected.length);
  for (let i = 0; i < n; i++) {
    if (JSON.stringify(actual[i]) !== JSON.stringify(expected[i])) {
      assert.fail((msg || '') + ' · lệnh #' + i + ': ' + JSON.stringify(actual[i]) + ' ≠ ' + JSON.stringify(expected[i]));
    }
  }
}
const differs = (a, b) => JSON.stringify(a) !== JSON.stringify(b);

/* Công thức màu giống kydao-draw.js, để kiểm màu đã vẽ. */
const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, t) => '#' + [0, 1, 2].map(i => ('0' + Math.round(rgb(a)[i] + (rgb(b)[i] - rgb(a)[i]) * t).toString(16)).slice(-2)).join('');
const lum = h => { const v = rgb(h).map(u => u / 255).map(u => (u <= 0.03928 ? u / 12.92 : Math.pow((u + 0.055) / 1.055, 2.4))); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
const ratio = (a, b) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);

test('Không có o.skins / o.jolt (hoặc skin vô nghĩa): chuỗi lệnh vẽ y như nhau', () => {
  for (const game of ['chess', 'xiangqi', 'jieqi']) for (const flip of [false, true]) {
    const common = { flip, selected: 'e2', targets: ['e3', 'e4'], last: ['a2', 'a3'] };
    const base = run(opts(game, common));
    const same = [
      { skins: null }, { skins: {} }, { skins: { a: null, b: { field: 'khong-co', pieces: 'khong-co' } } },
      { skins: SKINS, hideSkins: { a: true, b: true } }, { jolt: null }, { jolt: {} }, { jolt: () => null },
      { jolt: { e2: { dx: 0, dy: 0 } } }
    ];
    for (const extra of same) sameLog(run(opts(game, { ...common, ...extra })), base, game + ' ' + JSON.stringify(extra));
  }
  // Cờ vây / caro bỏ qua skin và jolt không có ô.
  for (const game of ['go', 'gomoku']) {
    const o = { game, size: 9, board: Array(81).fill('').map((_, i) => (i === 10 ? 'a' : i === 11 ? 'b' : '')), w: 300, h: 300, dpr: 1 };
    sameLog(run({ ...o, skins: SKINS }), run(o), game);
  }
});

test('Skin khác mặc định; chưa có ảnh thì tô theo palette (không ném lỗi, không cần Image)', () => {
  for (const game of ['chess', 'xiangqi', 'jieqi']) {
    const base = run(opts(game));
    const skinned = run(opts(game, { skins: SKINS }));
    assert.ok(differs(skinned, base), game);
    const colors = skinned.filter(x => x[0] === '=fillStyle').map(x => String(x[1]).toLowerCase());
    if (game === 'chess') {
      assert.ok(colors.includes(KydaoSkins.FIELDS.volcano.palette.dark));
      assert.ok(colors.includes(KydaoSkins.FIELDS.glacier.palette.light));
    }
  }
});

/** Các hình chữ nhật đã tô màu `color` (chuỗi hex) trong chuỗi lệnh: [{x,y,w,h}]. */
const rectsFilled = (log, color) => log.reduce((acc, x, i) => {
  if (x[0] === 'fillRect' && i && log[i - 1][0] === '=fillStyle' && String(log[i - 1][1]).toLowerCase() === color) acc.push({ x: x[1], y: x[2], w: x[3], h: x[4] });
  return acc;
}, []);

test('Cờ vua: nửa sân đúng bên, kể cả khi lật bàn (bên a nằm dưới; lật thì nằm trên)', () => {
  const P = KydaoSkins.FIELDS;
  for (const flip of [false, true]) {
    const log = run(opts('chess', { flip, board: [], skins: { a: { field: 'volcano' }, b: { field: 'glacier' } } }));
    const a = rectsFilled(log, P.volcano.palette.dark), b = rectsFilled(log, P.glacier.palette.dark);
    assert.equal(a.length, 16, 'nửa a có 16 ô sẫm'); assert.equal(b.length, 16);
    const ya = a.map(r => r.y), yb = b.map(r => r.y);
    if (!flip) assert.ok(Math.min(...ya) > Math.max(...yb), 'a ở dưới');
    else assert.ok(Math.max(...ya) < Math.min(...yb), 'lật: a ở trên');
    assert.equal(Math.max(...ya, ...yb) - Math.min(...ya, ...yb), 350 - 0, 'phủ trọn 8 hàng');
  }
  // Chỉ một bên có skin: bên kia giữ màu ô mặc định.
  const one = run(opts('chess', { board: [], skins: { b: { field: 'glacier' } } }));
  // Nền mặc định tô đủ 32 ô sẫm; skin b phủ lên 16 ô nên bên a vẫn là màu gốc và b có màu skin.
  assert.equal(rectsFilled(one, '#b58863').length, 32);
  assert.equal(rectsFilled(one, P.glacier.palette.dark).length, 16);
});

test('Cờ tướng: mỗi nửa sân phủ đúng nửa, chia ở sông, cả hai hướng nhìn', () => {
  const g = KydaoDraw.layout('xiangqi', 368, 408);
  const mid = g.oy + g.cell * 4.5, F = KydaoSkins.FIELDS;
  const tone = id => mix(F[id].palette.light, F[id].palette.dark, 0.3);
  for (const flip of [false, true]) {
    const log = run(opts('xiangqi', { flip, board: [], skins: { a: { field: 'volcano' }, b: { field: 'river' } } }));
    const a = rectsFilled(log, tone('volcano'))[0], b = rectsFilled(log, tone('river'))[0];
    assert.ok(a && b);
    const top = flip ? a : b, bottom = flip ? b : a;
    assert.ok(Math.abs(top.y + top.h - mid) < 0.01, 'nửa trên chạm sông');
    assert.ok(Math.abs(bottom.y - mid) < 0.01, 'nửa dưới bắt đầu từ sông');
    assert.ok(top.y < g.oy && bottom.y + bottom.h > g.oy + g.cell * 9, 'phủ tới mép bàn');
  }
});

test('Quân: khóa bộ nhớ đệm có mã skin; cùng skin dùng lại, đổi skin thì vẽ lại', () => {
  for (const game of ['chess', 'xiangqi']) {
    const made = [];
    const doc = { createElement: () => { const r = recorder(); const c = { width: 0, height: 0, getContext: () => r.ctx }; made.push(c); return c; } };
    const mk = () => recorder({ canvas: { ownerDocument: doc }, getTransform: () => ({ a: 1 }) });
    KydaoDraw.draw(mk().ctx, opts(game, { skins: SKINS }));
    const n1 = made.length;
    assert.ok(n1 > 0, 'có bitmap đệm');
    KydaoDraw.draw(mk().ctx, opts(game, { skins: SKINS }));
    assert.equal(made.length, n1, 'cùng skin dùng lại bộ đệm');
    KydaoDraw.draw(mk().ctx, opts(game, { skins: { a: { pieces: 'jade' }, b: { pieces: 'ice' } } }));
    const n2 = made.length;
    assert.ok(n2 > n1, 'đổi skin quân thì vẽ lại bitmap');
    KydaoDraw.draw(mk().ctx, opts(game));
    assert.ok(made.length > n2, 'mặc định có khóa riêng');
  }
});

test('Quân cờ vua: màu theo đúng bên, quầng sáng chỉ khi skin có glow', () => {
  const stops = skins => run(opts('chess', { skins })).filter(x => x[0] === 'stop').map(x => String(x[2]).toLowerCase());
  const radial = skins => run(opts('chess', { skins })).filter(x => x[0] === 'createRadialGradient' && x[3] === 0.08).length;
  const P = KydaoSkins.PIECES;
  // Thân quân a pha từ base của a; không dính base của b khi chỉ a có skin.
  const onlyA = stops({ a: { pieces: 'wood' } });
  assert.ok(onlyA.includes(mix(P.wood.a.base, '#ffffff', 0.3)));
  assert.ok(!onlyA.includes(mix(P.wood.b.base, '#ffffff', 0.3)));
  const onlyB = stops({ b: { pieces: 'wood' } });
  assert.ok(onlyB.includes(mix(P.wood.b.base, '#ffffff', 0.3)));
  assert.equal(radial({ a: { pieces: 'jade' }, b: { pieces: 'jade' } }), 0, 'jade không có quầng sáng');
  assert.equal(radial({ a: { pieces: 'magma' } }), 16, 'magma: 16 quân bên a có quầng sáng');
  assert.equal(radial({ a: { pieces: 'magma' }, b: { pieces: 'magma' } }), 32);
});

test('Chữ cờ tướng đủ tương phản với thân quân ở cả 8 bộ quân', () => {
  for (const id of Object.keys(KydaoSkins.PIECES)) for (const side of ['a', 'b']) {
    const board = Array(90).fill(''); board[side === 'a' ? 4 : 85] = side === 'a' ? 'K' : 'k';
    const log = run({ game: 'xiangqi', board, w: 368, h: 408, dpr: 1, skins: { [side]: { pieces: id } } });
    const at = log.findLastIndex(x => x[0] === 'fillText' && x[1] === (side === 'a' ? '帥' : '將'));
    assert.ok(at > 0, id + ' ' + side + ': có vẽ chữ');
    const ink = log.slice(0, at).reverse().find(x => x[0] === '=fillStyle')[1];
    const base = KydaoSkins.PIECES[id][side].base;
    assert.match(ink, /^#[0-9a-f]{6}$/i);
    assert.ok(ratio(ink, base) >= 3, id + ' ' + side + ' ' + ink + ' trên ' + base + ' = ' + ratio(ink, base).toFixed(2));
  }
});

test('Cờ úp: quân úp cùng bên vẽ giống hệt nhau, chỉ theo skin của bên đó', () => {
  const skins = { a: { pieces: 'magma' }, b: { pieces: 'ice' } };
  const pieceCmds = (ch, idx) => {
    const b = Array(90).fill(''); b[idx] = ch;
    const empty = run({ game: 'jieqi', board: Array(90).fill(''), w: 368, h: 408, dpr: 1, skins });
    const full = run({ game: 'jieqi', board: b, w: 368, h: 408, dpr: 1, skins });
    // Bỏ phần dịch tâm quân: mọi thứ còn lại phải trùng nhau giữa các ô.
    return full.slice(empty.length).filter(x => x[0] !== 'translate' && x[0] !== 'createRadialGradient' && x[0] !== 'createLinearGradient');
  };
  sameLog(pieceCmds('X', 1), pieceCmds('X', 6), 'bên a');
  sameLog(pieceCmds('x', 82), pieceCmds('x', 87), 'bên b');
  assert.ok(differs(pieceCmds('X', 1), pieceCmds('x', 82)), 'hai bên khác skin thì khác màu');
  // Không skin thì hai bên khác nhau ở mực chữ như cũ; skin không làm lộ thêm khác biệt giữa quân úp cùng bên.
  const full = run({ game: 'jieqi', board: KyXiangqi.view(KyXiangqi.create({ variant: 'jieqi', seed: 3 })).board, w: 368, h: 408, dpr: 1, skins });
  assert.equal(full.filter(x => x[0] === 'fillText' && x[1] === '?').length, 60);
});

test('jolt: dịch quân (map theo ô và dạng hàm), không dịch bàn hay dấu', () => {
  const gx = KydaoDraw.layout('xiangqi', 368, 408);
  const board = Array(90).fill(''); board[4] = 'K';
  const o = opts('xiangqi', { board, selected: 'e0' });
  const p = KydaoDraw.cellXY(gx, 4, 0, false);
  const trans = (log, x, y) => log.filter(c => c[0] === 'translate' && c[1] === x && c[2] === y).length;
  const base = run(o);
  assert.equal(trans(base, p.x, p.y), 1);
  const byName = run({ ...o, jolt: { e0: { dx: 5, dy: -3 } } });
  assert.equal(trans(byName, p.x + 5, p.y - 3), 1, 'quân dịch (5,-3)');
  assert.equal(trans(byName, p.x, p.y), 0);
  const seen = [];
  const byFn = run({ ...o, jolt: (x, y) => { seen.push([x, y]); return { dx: 5, dy: -3 }; } });
  assert.deepEqual(seen, [[p.x, p.y]], 'hàm nhận tâm quân px CSS (chưa dịch)');
  sameLog(byFn, byName, 'dạng hàm = dạng map');
  // Dấu chọn (arc tại tâm ô) vẫn ở tâm ô gốc.
  const arcAt = log => log.some(c => c[0] === 'arc' && c[1] === p.x && c[2] === p.y);
  assert.ok(arcAt(byName) && arcAt(base));
  // Ô khác không bị dịch, ô thiếu trong map thì bỏ qua.
  const other = run({ ...o, jolt: { a9: { dx: 9, dy: 9 }, __proto__: null } });
  sameLog(other, base, 'jolt cho ô không có quân');
  // Cờ vua.
  const gc = KydaoDraw.layout('chess', 400, 400), q = KydaoDraw.cellXY(gc, 4, 0, false);
  const cl = run({ ...opts('chess'), jolt: { e1: { dx: 2, dy: 4 } } });
  assert.equal(trans(cl, q.x + 2, q.y + 4), 1);
});

test('Ảnh nửa sân: nạp lười, xoay 180° nửa trên, onAsset khi tải xong, 404 không ném lỗi', () => {
  const made = [];
  global.Image = class {
    constructor() { made.push(this); this.naturalWidth = 1024; this.naturalHeight = 512; }
  };
  try {
    let again = 0;
    const o = opts('chess', { skins: { a: { field: 'river' }, b: { field: 'forest' } }, onAsset: () => again++ });
    const first = run(o);
    assert.equal(first.filter(x => x[0] === 'drawImage').length, 0, 'chưa tải thì chưa có drawImage');
    assert.equal(made.length, 2, 'mỗi ảnh chỉ nạp một lần');
    assert.deepEqual(made.map(i => i.src).sort(), ['/img/kydao/fields/forest.webp', '/img/kydao/fields/river.webp']);
    run(o);
    assert.equal(made.length, 2);
    made.find(i => /river/.test(i.src)).onload();
    assert.equal(again, 1, 'onAsset gọi đúng một lần cho ảnh vừa xong');
    made.find(i => /forest/.test(i.src)).onerror();
    assert.doesNotThrow(() => run(o));
    const log = run(o);
    assert.equal(log.filter(x => x[0] === 'drawImage').length, 1, 'chỉ nửa sân có ảnh');
    assert.equal(log.filter(x => x[0] === 'rotate').length, 0, 'nửa a ở dưới: không xoay');
    const flipped = run({ ...o, flip: true });
    assert.deepEqual(flipped.filter(x => x[0] === 'rotate').map(x => x[1]), [Math.PI], 'lật bàn: nửa a lên trên, xoay 180°');
    // Có ảnh: ô phủ mờ để lộ vân nền.
    assert.ok(log.some(x => x[0] === '=fillStyle' && /^rgba\(/.test(x[1]) && /,0\.7\)$/.test(x[1])));
  } finally { delete global.Image; }
});
