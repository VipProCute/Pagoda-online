'use strict';
// Kỳ Đạo · Bàn 2D có dải cảnh (margin) và ảnh sân v2: hình học, khứ hồi chạm, lùi về đường cũ.
const test = require('node:test');
const assert = require('node:assert/strict');
const KydaoSkins = require('../public/js/kydao-skins.js');
const KydaoDraw = require('../public/js/kydao-draw.js');
const KyChess = require('../public/js/kydao/chess.js');
const KyXiangqi = require('../public/js/kydao/xiangqi.js');

global.KydaoSkins = KydaoSkins;

function recorder() {
  const log = [];
  const ctx = new Proxy({ canvas: {} }, {
    get(t, k) {
      if (k in t) return t[k];
      if (k === 'createLinearGradient' || k === 'createRadialGradient') return (...a) => { log.push([k, ...a]); return { addColorStop() {} }; };
      return (...a) => { log.push([k, ...a]); };
    },
    set(t, k, v) { log.push(['=' + String(k), v]); return true; }
  });
  return { ctx, log };
}

test('layout không có margin trả đúng số cũ', () => {
  const c = KydaoDraw.layout('chess', 400, 400);
  assert.equal(c.cell, 50); assert.equal(c.ox, 0); assert.equal(c.oy, 0); assert.equal(c.margin, 0);
  const x = KydaoDraw.layout('xiangqi', 460, 510);
  assert.equal(x.cell, Math.min(460 / 9.2, 510 / 10.2));
  assert.equal(x.ox, (460 - x.cell * 8) / 2); assert.equal(x.oy, (510 - x.cell * 9) / 2); assert.equal(x.margin, 0);
  assert.equal(KydaoDraw.aspect('xiangqi'), 9.2 / 10.2);
});

test('layout có margin 1.5: ô nhỏ lại đúng tỉ lệ, bàn vẫn canh giữa', () => {
  const c = KydaoDraw.layout('chess', 440, 440, undefined, 1.5);
  assert.equal(c.cell, 40); assert.equal(c.ox, 60); assert.equal(c.oy, 60); assert.equal(c.margin, 1.5);
  const x = KydaoDraw.layout('xiangqi', 440, 480, undefined, 1.5);
  assert.equal(x.cell, 40);
  assert.equal(x.ox, 60); assert.equal(x.oy, 60);
});

test('squareAt và cellXY khứ hồi đúng với margin 1.5', () => {
  for (const flip of [false, true]) {
    const c = KydaoDraw.layout('chess', 440, 440, undefined, 1.5);
    for (let col = 0; col < 8; col++) for (let row = 0; row < 8; row++) {
      const p = KydaoDraw.cellXY(c, col, row, flip);
      assert.equal(KydaoDraw.squareAt(c, p.x, p.y, flip), KydaoDraw.nameOf('chess', col, row));
    }
    const x = KydaoDraw.layout('xiangqi', 440, 480, undefined, 1.5);
    for (let col = 0; col < 9; col++) for (let row = 0; row < 10; row++) {
      const p = KydaoDraw.cellXY(x, col, row, flip);
      assert.equal(KydaoDraw.squareAt(x, p.x, p.y, flip), KydaoDraw.nameOf('xiangqi', col, row));
    }
  }
});

test('aspect có margin', () => {
  assert.equal(KydaoDraw.aspect('chess', 1.5), 1);
  assert.equal(KydaoDraw.aspect('xiangqi', 1.5), (8 + 3) / (9 + 3));
  assert.equal(KydaoDraw.aspect('jieqi', 0), 9.2 / 10.2);
  assert.equal(KydaoDraw.aspect('go', 1.5), 1);
});

test('ảnh v2 đã tải: cắt đúng vùng nguồn và xoay nửa trên', () => {
  const made = [];
  global.Image = class { constructor() { made.push(this); this.naturalWidth = 1408; this.naturalHeight = 704; } };
  try {
    const skins = { a: { field: 'forest', pieces: 'magma' }, b: { field: 'forest', pieces: 'ice' } };
    for (const [game, size] of [['chess', [440, 440]], ['xiangqi', [440, 480]]]) {
      const mod = game === 'chess' ? KyChess : KyXiangqi;
      const o = { game, w: size[0], h: size[1], dpr: 1, board: mod.create().board, skins, margin: 1.5 };
      KydaoDraw.draw(recorder().ctx, o);
      made.filter(i => /fields2/.test(i.src)).forEach(i => i.onload());
      const r = recorder();
      KydaoDraw.draw(r.ctx, o);
      const imgs = r.log.filter(x => x[0] === 'drawImage' && x.length === 10);
      assert.equal(imgs.length, 2, game + ': hai nửa dùng ảnh v2');
      imgs.forEach(x => { assert.equal(x[2], 0); assert.equal(x[3], 0); assert.equal(x[4], 1408); assert.equal(x[5], 704); });
      assert.deepEqual(r.log.filter(x => x[0] === 'rotate').map(x => x[1]), [Math.PI]);
    }
  } finally { delete global.Image; }
});

test('ảnh v2 chưa tải thì vẫn vẽ theo đường cũ, không ném lỗi', () => {
  const skins = { a: { field: 'volcano', pieces: 'magma' }, b: { field: 'glacier', pieces: 'ice' } };
  for (const flip of [false, true]) {
    const chess = recorder();
    const g1 = KydaoDraw.draw(chess.ctx, { game: 'chess', w: 440, h: 440, dpr: 1, board: KyChess.create().board, flip, skins, margin: 1.5 });
    assert.equal(g1.cell, 40);
    assert.ok(!chess.log.some(x => x[0] === 'drawImage'), 'Node không có Image nên không vẽ ảnh');
    const xq = recorder();
    const g2 = KydaoDraw.draw(xq.ctx, { game: 'xiangqi', w: 440, h: 480, dpr: 1, board: KyXiangqi.create().board, flip, skins, margin: 1.5 });
    assert.equal(g2.cell, 40);
  }
});

test('ảnh v2 đang tải thì không tải ảnh v1; v2 lỗi mới dùng v1 (cờ vua và cờ tướng)', () => {
  const made = [];
  global.Image = class { constructor() { made.push(this); this.naturalWidth = 1408; this.naturalHeight = 704; } };
  try {
    const skins = { a: { field: 'volcano', pieces: 'magma' }, b: { field: 'glacier', pieces: 'ice' } };
    for (const [game, size] of [['chess', [440, 440]], ['xiangqi', [440, 480]]]) {
      const mod = game === 'chess' ? KyChess : KyXiangqi;
      const o = { game, w: size[0], h: size[1], dpr: 1, board: mod.create().board, skins, margin: 1.5 };
      const before = made.length;
      KydaoDraw.draw(recorder().ctx, o);
      const mine = made.slice(before);
      assert.equal(mine.length, 2, game + ': chỉ hai yêu cầu ảnh v2, chưa có v1');
      assert.ok(mine.every(i => /fields2/.test(i.src)), game + ': toàn ảnh v2');
      mine.forEach(i => i.onerror());
      KydaoDraw.draw(recorder().ctx, o);
      const v1 = made.slice(before + 2); // ảnh v1 dùng chung hai môn nên môn sau có thể đã có sẵn trong bộ nhớ đệm
      assert.equal(v1.length, game === 'chess' ? 2 : 0, game + ': v2 lỗi thì tải v1');
      assert.ok(v1.every(i => /\/fields\//.test(i.src)));
      assert.equal(KydaoDraw.imageState(mine[0].src), 'err');
    }
  } finally { delete global.Image; }
});
