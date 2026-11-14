'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const KydaoSkins = require('../public/js/kydao-skins.js');

test('đá cờ vây và caro có mã riêng, màu hai bên luôn phân biệt', () => {
  const hex = /^#[0-9a-f]{6}$/i;
  const luminance = color => {
    const channels = [1, 3, 5].map(index => parseInt(color.slice(index, index + 2), 16) / 255)
      .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  };
  for (const game of ['go', 'gomoku']) {
    assert.equal(KydaoSkins.supportsPieces(game), true);
    for (const id of Object.keys(KydaoSkins.STONES)) {
      assert.deepEqual(KydaoSkins.normalize({ field: 'volcano', pieces: id }, game), { field: null, pieces: id });
    }
    for (const id of ['jade', '__proto__']) assert.deepEqual(KydaoSkins.normalize({ pieces: id }, game), { field: null, pieces: null });
  }
  assert.deepEqual(KydaoSkins.normalize({ pieces: 'cosmos' }), { field: null, pieces: null });
  const stones = Object.values(KydaoSkins.STONES);
  assert.equal(stones.length, 8);
  for (const stone of stones) for (const side of ['a', 'b']) for (const key of ['base', 'accent', 'mark']) assert.match(stone[side][key], hex);
  for (const dark of stones) for (const light of stones) assert.ok(luminance(dark.a.base) < luminance(light.b.base));
});
/* T-110: danh mục skin Kỳ Đài (public/js/kydao-skins.js) dùng ở máy chủ để kiểm mã client gửi lên. */
test('normalize: mã hợp lệ giữ nguyên, mã lạ và kiểu lạ thành null', () => {
  assert.deepEqual(KydaoSkins.normalize({ field: 'volcano', pieces: 'magma' }), { field: 'volcano', pieces: 'magma' });
  assert.deepEqual(KydaoSkins.normalize({ field: 'river' }), { field: 'river', pieces: null });
  for (const input of [undefined, null, 0, 'volcano', [], ['volcano'], () => 'volcano']) {
    assert.deepEqual(KydaoSkins.normalize(input), { field: null, pieces: null }, String(input));
  }
  const bad = ['__proto__', 'constructor', 'prototype', 'toString', 'valueOf', 'hasOwnProperty', 'isPrototypeOf',
    'VOLCANO', ' volcano', 'volcano\u0000', '', 1, 1.5, true, NaN, {}, { id: 'volcano' }, ['volcano'], null];
  for (const v of bad) {
    assert.deepEqual(KydaoSkins.normalize({ field: v, pieces: v }), { field: null, pieces: null }, JSON.stringify(v));
  }
  // Mã sân không dùng được làm mã quân và ngược lại.
  assert.deepEqual(KydaoSkins.normalize({ field: 'magma', pieces: 'volcano' }), { field: null, pieces: null });
});

test('normalize: object JSON có khóa riêng "__proto__" không lọt mã nào, không làm bẩn prototype', () => {
  // normalize đọc o.field trực tiếp, nên khóa kế thừa do máy chủ tự lọc bằng hasOwn trước (lib/kydao/manager.js, có test riêng).
  const parsed = JSON.parse('{"__proto__":{"field":"volcano","pieces":"magma"}}');
  assert.deepEqual(KydaoSkins.normalize(parsed), { field: null, pieces: null });
  assert.equal({}.field, undefined);
  assert.equal(Object.prototype.field, undefined);
  // Kết quả là object mới, sửa không ảnh hưởng danh mục.
  const out = KydaoSkins.normalize({ field: 'lotus' });
  out.field = 'x';
  assert.ok(KydaoSkins.FIELDS.lotus);
});

test('supports: chỉ cờ vua, cờ tướng, cờ úp có skin', () => {
  assert.deepEqual(KydaoSkins.GAMES, ['chess', 'xiangqi', 'jieqi']);
  for (const g of KydaoSkins.GAMES) assert.equal(KydaoSkins.supports(g), true);
  for (const g of ['go', 'gomoku', '__proto__', 'toString', '', null, undefined, 1]) assert.equal(KydaoSkins.supports(g), false, String(g));
});

test('danh mục: id an toàn cho đường dẫn, đủ trường hợp đồng, hai bên quân khác màu', () => {
  const hex = /^#[0-9a-f]{6}$/i;
  for (const [id, f] of Object.entries(KydaoSkins.FIELDS)) {
    assert.match(id, /^[a-z]+$/);
    for (const k of ['name', 'cry', 'sub', 'fx']) assert.equal(typeof f[k], 'string', id + '.' + k);
    for (const k of ['light', 'dark', 'line', 'glow', 'rim']) assert.match(f.palette[k], hex, id + '.palette.' + k);
    assert.equal(KydaoSkins.fieldImage(id), `/img/kydao/fields/${id}.webp`);
    assert.equal(KydaoSkins.fieldModel(id), `/models/kydao/fields/${id}.glb`);
    assert.equal(KydaoSkins.thumb('field', id), `/img/kydao/thumbs/field-${id}.webp`);
  }
  for (const [id, p] of Object.entries(KydaoSkins.PIECES)) {
    assert.match(id, /^[a-z]+$/);
    assert.equal(typeof p.name, 'string');
    for (const s of ['a', 'b']) {
      assert.match(p[s].base, hex); assert.match(p[s].accent, hex);
      assert.ok(p[s].glow === null || hex.test(p[s].glow));
    }
    assert.notEqual(p.a.base.toLowerCase(), p.b.base.toLowerCase(), id + ': hai bên phải tương phản');
    assert.equal(KydaoSkins.piecesModel(id), `/models/kydao/pieces/${id}.glb`);
    assert.equal(KydaoSkins.thumb('pieces', id), `/img/kydao/thumbs/pieces-${id}.webp`);
  }
  for (const id of ['__proto__', 'toString', '../x', 'volcano']) {
    assert.equal(KydaoSkins.piecesModel(id), null);
    assert.equal(KydaoSkins.thumb('pieces', id), null);
  }
  for (const id of ['__proto__', 'toString', '../x', 'magma']) {
    assert.equal(KydaoSkins.fieldImage(id), null);
    assert.equal(KydaoSkins.fieldModel(id), null);
    assert.equal(KydaoSkins.field(id), null);
  }
  assert.equal(KydaoSkins.thumb('other', 'volcano'), null);
  assert.equal(KydaoSkins.pieces('constructor'), null);
});
