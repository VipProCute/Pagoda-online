'use strict';
/* T-110: danh mục skin Kỳ Đài (public/js/kydao-skins.js) dùng ở máy chủ để kiểm mã client gửi lên. */
const test = require('node:test');
const assert = require('node:assert/strict');
const KydaoSkins = require('../public/js/kydao-skins.js');

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
