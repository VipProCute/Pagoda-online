'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createShop } = require('../lib/kydao/shop');
const catalog = require('../public/js/kydao-skins.js');
const S = require('../lib/store-sections');

/** Dựng cửa hàng trên db.kydao mặc định, đồng hồ chạy tay. */
function make() {
  const db = S.fresh();
  const clock = { t: 1000 };
  const shop = createShop({ getState: () => db.kydao, catalog, now: () => clock.t });
  return { db, clock, shop, state: db.kydao };
}

test('keyOf: chỉ nhận loại và id có trong danh mục', () => {
  const { shop } = make();
  assert.equal(shop.keyOf('field', 'volcano'), 'field:volcano');
  assert.equal(shop.keyOf('pieces', 'jade'), 'pieces:jade');
  assert.equal(shop.keyOf('stones', 'cosmos'), 'stones:cosmos');
  assert.equal(shop.keyOf('field', 'khong-co'), null);
  assert.equal(shop.keyOf('stones', 'jade'), null, 'jade chỉ có ở pieces');
  assert.equal(shop.keyOf('board', 'volcano'), null);
  assert.equal(shop.keyOf('field', 'constructor'), null);
  assert.equal(shop.keyOf('field', '__proto__'), null);
  assert.equal(shop.keyOf('field', 5), null);
  assert.equal(shop.keyOf(null, null), null);
});

test('setConfig: không bật được khi chưa có mức chung hợp lệ, và không sửa gì khi lỗi', () => {
  const { shop, state } = make();
  const r = shop.setConfig({ on: true });
  assert.equal(r.ok, false);
  assert.equal(state.shop.on, false);
  assert.equal(state.shop.updatedAt, 0);
  // mức riêng một mình không đủ để bật
  assert.equal(shop.setConfig({ on: true, prices: { 'field:volcano': 20000 } }).ok, false);
  assert.deepEqual(shop.publicConfig(), { on: false, price: null, prices: {} });
  const ok = shop.setConfig({ on: true, price: 20000 });
  assert.equal(ok.ok, true);
  assert.deepEqual(ok.config, { on: true, price: 20000, prices: {} });
  // đang bật thì không được xóa mức chung
  assert.equal(shop.setConfig({ price: null }).ok, false);
  assert.equal(shop.publicConfig().price, 20000);
  // tắt rồi xóa mức chung thì được
  assert.equal(shop.setConfig({ on: false, price: null }).ok, true);
});

test('setConfig: giá ngoài khoảng, số lẻ, chuỗi, NaN, Infinity đều bị từ chối', () => {
  const { shop } = make();
  for (const bad of [9999, 100000001, 20000.5, '20000', NaN, Infinity, -20000, 0, true, {}, []]) {
    assert.equal(shop.setConfig({ price: bad }).ok, false, 'price ' + String(bad));
    assert.equal(shop.setConfig({ prices: { 'field:volcano': bad } }).ok, false, 'prices ' + String(bad));
  }
  assert.equal(shop.setConfig({ price: 10000 }).ok, true);
  assert.equal(shop.setConfig({ price: 100000000 }).ok, true);
  assert.equal(shop.setConfig({ on: 'true' }).ok, false);
  assert.equal(shop.setConfig(null).ok, false);
  assert.equal(shop.setConfig('x').ok, false);
  assert.equal(shop.setConfig([]).ok, false);
});

test('setConfig: lỗi ở một khóa thì không áp dụng khóa nào (nguyên tử)', () => {
  const { shop, state } = make();
  shop.setConfig({ price: 30000 });
  const before = JSON.stringify(state.shop);
  const r = shop.setConfig({ price: 40000, prices: { 'field:volcano': 50000, 'pieces:jade': 'x' } });
  assert.equal(r.ok, false);
  assert.equal(JSON.stringify(state.shop), before);
});

test('setConfig: prices bỏ khóa lạ và __proto__, không gây ô nhiễm prototype', () => {
  const { shop } = make();
  const evil = JSON.parse('{"__proto__":{"x":1},"constructor":20000,"prototype":20000,"field:khong-co":20000,"field:volcano":25000}');
  const r = shop.setConfig({ price: 20000, prices: evil });
  assert.equal(r.ok, true);
  assert.deepEqual(r.config.prices, { 'field:volcano': 25000 });
  assert.equal({}.x, undefined);
  assert.equal(Object.prototype.hasOwnProperty.call(shop.publicConfig().prices, '__proto__'), false);
  assert.equal(shop.setConfig(JSON.parse('{"__proto__":{"on":true},"price":20000}')).ok, true);
  assert.equal(shop.publicConfig().on, false, 'on không thể lọt vào qua __proto__');
});

test('setConfig: prices null xóa mức riêng; khóa không nhắc tới được giữ; updatedAt theo now', () => {
  const { shop, clock, state } = make();
  clock.t = 5000;
  shop.setConfig({ price: 20000, prices: { 'field:volcano': 30000, 'pieces:jade': 40000 } });
  assert.equal(state.shop.updatedAt, 5000);
  clock.t = 6000;
  const r = shop.setConfig({ prices: { 'field:volcano': null } });
  assert.deepEqual(r.config.prices, { 'pieces:jade': 40000 });
  assert.equal(state.shop.updatedAt, 6000);
});

test('publicConfig: bản sao, lọc khóa lạ trong dữ liệu lưu', () => {
  const { shop, state } = make();
  state.shop.prices = { 'field:volcano': 30000, 'field:ma': 30000, 'pieces:jade': 5 };
  const c = shop.publicConfig();
  assert.deepEqual(c.prices, { 'field:volcano': 30000 });
  c.prices['field:river'] = 99999;
  c.on = true;
  assert.equal(state.shop.on, false);
  assert.equal(Object.prototype.hasOwnProperty.call(state.shop.prices, 'field:river'), false);
});

test('priceOf: ưu tiên mức riêng, rồi mức chung, rồi null', () => {
  const { shop } = make();
  assert.equal(shop.priceOf('field', 'volcano'), null, 'chưa có giá');
  shop.setConfig({ price: 20000, prices: { 'field:volcano': 35000 } });
  assert.equal(shop.priceOf('field', 'volcano'), 35000);
  assert.equal(shop.priceOf('field', 'river'), 20000);
  assert.equal(shop.priceOf('field', 'khong-co'), null);
  assert.equal(shop.priceOf('x', 'river'), null);
});

test('owns/allowed: id null luôn dùng được; allowed đúng ở cả on và off', () => {
  const { shop } = make();
  assert.equal(shop.owns('u1', 'field', null), true);
  assert.equal(shop.owns('u1', 'field', 'volcano'), false);
  // tắt: mọi skin dùng được
  assert.equal(shop.allowed('u1', 'field', 'volcano'), true);
  shop.setConfig({ on: true, price: 20000 });
  assert.equal(shop.allowed('u1', 'field', 'volcano'), false);
  assert.equal(shop.allowed('u1', 'field', null), true, 'mặc định luôn miễn phí');
  shop.grant('u1', 'field', 'volcano', 'CD111111');
  assert.equal(shop.allowed('u1', 'field', 'volcano'), true);
  assert.equal(shop.allowed('u2', 'field', 'volcano'), false, 'người khác vẫn bị khóa');
  assert.equal(shop.allowed('u1', 'field', 'river'), false, 'skin khác vẫn khóa');
  assert.equal(shop.allowed('u1', 'field', 'khong-co'), false, 'skin ngoài danh mục không được phép khi đang thu tiền');
  assert.equal(shop.owns('constructor', 'field', 'volcano'), false);
  assert.equal(shop.owns(undefined, 'field', 'volcano'), false);
});

test('grant: idempotent, không đổi at/code lần sau; từ chối skin lạ và uid rỗng', () => {
  const { shop, clock, state } = make();
  clock.t = 111;
  assert.deepEqual(shop.grant('u1', 'pieces', 'jade', 'CD111111'), { ok: true, added: true });
  clock.t = 222;
  assert.deepEqual(shop.grant('u1', 'pieces', 'jade', 'CD222222'), { ok: true, added: false });
  assert.deepEqual(state.unlocks.u1['pieces:jade'], { at: 111, code: 'CD111111' });
  assert.equal(shop.grant('u1', 'pieces', 'khong-co', 'x').ok, false);
  assert.equal(shop.grant('', 'pieces', 'jade', 'x').ok, false);
  assert.equal(shop.grant(5, 'pieces', 'jade', 'x').ok, false);
  assert.deepEqual(Object.keys(state.unlocks), ['u1']);
  // uid là tên nhạy cảm của Object.prototype vẫn lưu như khóa thường, không phá prototype
  assert.equal(shop.grant('__proto__', 'pieces', 'jade', 'x').ok, true);
  assert.equal({}.hasOwnProperty.call({}, 'jade'), false);
  assert.equal(shop.owns('u9', 'pieces', 'jade'), false);
});

test('owned: sắp xếp, chỉ của đúng uid, không lộ người khác', () => {
  const { shop } = make();
  shop.grant('u1', 'stones', 'cosmos', 'a');
  shop.grant('u1', 'field', 'volcano', 'b');
  shop.grant('u2', 'pieces', 'jade', 'c');
  assert.deepEqual(shop.owned('u1'), ['field:volcano', 'stones:cosmos']);
  assert.deepEqual(shop.owned('u2'), ['pieces:jade']);
  assert.deepEqual(shop.owned('u3'), []);
  assert.deepEqual(shop.owned(null), []);
  assert.deepEqual(shop.owned('toString'), []);
  const r = shop.owned('u1');
  r.push('field:river');
  assert.deepEqual(shop.owned('u1'), ['field:volcano', 'stones:cosmos'], 'mảng trả về là bản sao');
});

test('mergeGuest: gộp hợp, giữ mốc sớm hơn; undo khôi phục đúng nguyên trạng', () => {
  const { shop, state } = make();
  state.unlocks.g1 = { 'field:volcano': { at: 10, code: 'G' }, 'pieces:jade': { at: 50, code: 'G2' } };
  state.unlocks.acc = { 'field:volcano': { at: 30, code: 'A' }, 'stones:cosmos': { at: 40, code: 'A2' } };
  const before = JSON.parse(JSON.stringify(state.unlocks));
  const undo = shop.mergeGuest('g1', 'acc');
  assert.deepEqual(state.unlocks.acc, {
    'field:volcano': { at: 10, code: 'G' },
    'pieces:jade': { at: 50, code: 'G2' },
    'stones:cosmos': { at: 40, code: 'A2' }
  });
  assert.equal(Object.prototype.hasOwnProperty.call(state.unlocks, 'g1'), false);
  assert.deepEqual(shop.owned('acc'), ['field:volcano', 'pieces:jade', 'stones:cosmos']);
  assert.deepEqual(shop.owned('g1'), []);
  undo();
  assert.deepEqual(state.unlocks, before);
});

test('mergeGuest: tài khoản chưa có bản ghi thì undo xóa hẳn; khách không có gì hoặc cùng uid là không làm gì', () => {
  const { shop, state } = make();
  state.unlocks.g1 = { 'field:river': { at: 7, code: 'G' } };
  const undo = shop.mergeGuest('g1', 'acc');
  assert.deepEqual(state.unlocks.acc, { 'field:river': { at: 7, code: 'G' } });
  undo();
  assert.deepEqual(Object.keys(state.unlocks), ['g1']);
  assert.deepEqual(state.unlocks.g1, { 'field:river': { at: 7, code: 'G' } });
  const snap = JSON.stringify(state);
  shop.mergeGuest('none', 'acc')();
  shop.mergeGuest('g1', 'g1')();
  shop.mergeGuest(null, 'acc')();
  assert.equal(JSON.stringify(state), snap);
});

test('createShop chịu được db cũ thiếu shop/unlocks', () => {
  const st = {};
  const shop = createShop({ getState: () => st, catalog, now: () => 1 });
  assert.deepEqual(shop.publicConfig(), { on: false, price: null, prices: {} });
  assert.deepEqual(shop.owned('u'), []);
  assert.equal(shop.grant('u', 'field', 'volcano', 'c').ok, true);
  assert.deepEqual(shop.owned('u'), ['field:volcano']);
});
