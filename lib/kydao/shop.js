'use strict';
/*
 * Cửa hàng skin bàn cờ Kỳ Đạo: cấu hình khóa/giá và quyền sở hữu (T-170, xem docs/ky-dai/T-170-DAC-TA-KHOA-SKIN.md).
 * Logic thuần: không socket, không timer, không I/O. Thời gian tiêm qua `now`, dữ liệu sống qua `getState()`.
 *
 * Dữ liệu (nằm trong db.kydao, lưu bền bằng hai section ở lib/store-sections.js):
 *   shop    = { on, price, prices: { 'field:volcano': đồng }, updatedAt }
 *   unlocks = { <uid tài khoản>: { 'field:volcano': { at, code } } }
 * Người gọi phải đưa uid đã qua accountOf(); module không biết gì về tài khoản.
 * Không ném lỗi với đầu vào lạ: trả false / null / { ok:false, reason }.
 */

const KINDS = ['field', 'pieces', 'stones'];
const TABLE = { field: 'FIELDS', pieces: 'PIECES', stones: 'STONES' };
const MIN_PRICE = 10000;
const MAX_PRICE = 100000000;

const hasOwn = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const validPrice = n => typeof n === 'number' && Number.isInteger(n) && n >= MIN_PRICE && n <= MAX_PRICE;
const validUid = u => typeof u === 'string' && u.length > 0;

function createShop(deps) {
  const getState = deps.getState;
  const catalog = deps.catalog;
  const now = deps.now || Date.now;

  /** Đối tượng sống, bổ sung khóa thiếu để dữ liệu cũ hoặc test dựng tay vẫn chạy. */
  function shopState() {
    const st = getState();
    if (!isObj(st.shop)) st.shop = {};
    const sh = st.shop;
    if (typeof sh.on !== 'boolean') sh.on = false;
    if (!validPrice(sh.price)) delete sh.price; // chưa có mức chung = không có khóa (không lưu null)
    if (!isObj(sh.prices)) sh.prices = {};
    if (!Number.isFinite(sh.updatedAt)) sh.updatedAt = 0;
    return sh;
  }
  function unlocksState() {
    const st = getState();
    if (!isObj(st.unlocks)) st.unlocks = {};
    return st.unlocks;
  }

  /** 'field:volcano' hoặc null nếu loại/id không có trong danh mục. */
  function keyOf(kind, id) {
    if (typeof kind !== 'string' || typeof id !== 'string' || KINDS.indexOf(kind) === -1) return null;
    const table = catalog[TABLE[kind]];
    return table && hasOwn(table, id) ? kind + ':' + id : null;
  }

  function keyValid(key) {
    if (typeof key !== 'string') return false;
    const i = key.indexOf(':');
    return i > 0 && keyOf(key.slice(0, i), key.slice(i + 1)) === key;
  }

  function publicConfig() {
    const sh = shopState();
    const prices = {};
    for (const k of Object.keys(sh.prices)) if (keyValid(k) && validPrice(sh.prices[k])) prices[k] = sh.prices[k];
    return { on: sh.on, price: validPrice(sh.price) ? sh.price : null, prices };
  }

  function setConfig(input) {
    if (!isObj(input)) return { ok: false, reason: 'Dữ liệu cấu hình không hợp lệ.' };
    const sh = shopState();
    let on = sh.on, price = validPrice(sh.price) ? sh.price : null;
    const prices = Object.assign({}, sh.prices);
    if (hasOwn(input, 'on')) {
      if (typeof input.on !== 'boolean') return { ok: false, reason: 'Trạng thái bật/tắt không hợp lệ.' };
      on = input.on;
    }
    if (hasOwn(input, 'price')) {
      if (input.price === null) price = null;
      else if (validPrice(input.price)) price = input.price;
      else return { ok: false, reason: 'Mức chung phải là số nguyên đồng từ 10.000 đến 100.000.000.' };
    }
    if (hasOwn(input, 'prices')) {
      if (!isObj(input.prices)) return { ok: false, reason: 'Bảng mức riêng không hợp lệ.' };
      for (const k of Object.keys(input.prices)) {
        if (!keyValid(k)) continue; // khóa lạ (kể cả __proto__, constructor) bị bỏ
        const v = input.prices[k];
        if (v === null) delete prices[k];
        else if (validPrice(v)) prices[k] = v;
        else return { ok: false, reason: 'Mức riêng của skin phải là số nguyên đồng từ 10.000 đến 100.000.000.' };
      }
    }
    if (on && !validPrice(price)) return { ok: false, reason: 'Chưa đặt mức chung hợp lệ nên chưa thể bật thu tiền.' };
    sh.on = on; sh.prices = prices; sh.updatedAt = now();
    if (price === null) delete sh.price; else sh.price = price;
    return { ok: true, config: publicConfig() };
  }

  /** Mức riêng trước, rồi mức chung; skin không hợp lệ hoặc chưa có giá thì null. */
  function priceOf(kind, id) {
    const key = keyOf(kind, id);
    if (!key) return null;
    const sh = shopState();
    if (hasOwn(sh.prices, key) && validPrice(sh.prices[key])) return sh.prices[key];
    return validPrice(sh.price) ? sh.price : null;
  }

  function owns(uid, kind, id) {
    if (id == null) return true; // mặc định luôn miễn phí
    const key = keyOf(kind, id);
    if (!key || !validUid(uid)) return false;
    const un = unlocksState();
    return hasOwn(un, uid) && isObj(un[uid]) && hasOwn(un[uid], key);
  }

  function allowed(uid, kind, id) {
    return !shopState().on || owns(uid, kind, id);
  }

  function grant(uid, kind, id, code) {
    const key = keyOf(kind, id);
    if (!key) return { ok: false, reason: 'Skin không có trong danh mục.' };
    if (!validUid(uid)) return { ok: false, reason: 'Thiếu người nhận.' };
    const un = unlocksState();
    if (!hasOwn(un, uid) || !isObj(un[uid])) un[uid] = {};
    if (hasOwn(un[uid], key)) return { ok: true, added: false };
    un[uid][key] = { at: now(), code: typeof code === 'string' ? code : null };
    return { ok: true, added: true };
  }

  function owned(uid) {
    if (!validUid(uid)) return [];
    const un = unlocksState();
    if (!hasOwn(un, uid) || !isObj(un[uid])) return [];
    return Object.keys(un[uid]).filter(keyValid).sort();
  }

  /** Gộp quyền sở hữu của khách vào tài khoản (giữ mốc `at` sớm hơn). Trả hàm hoàn tác. */
  function mergeGuest(guestUid, accountUid) {
    const noop = () => {};
    if (!validUid(guestUid) || !validUid(accountUid) || guestUid === accountUid) return noop;
    const un = unlocksState();
    if (!hasOwn(un, guestUid) || !isObj(un[guestUid])) return noop;
    const before = {
      guest: JSON.parse(JSON.stringify(un[guestUid])),
      account: hasOwn(un, accountUid) ? JSON.parse(JSON.stringify(un[accountUid])) : undefined
    };
    if (!hasOwn(un, accountUid) || !isObj(un[accountUid])) un[accountUid] = {};
    const acc = un[accountUid];
    for (const key of Object.keys(un[guestUid])) {
      if (!keyValid(key)) continue;
      const g = un[guestUid][key];
      if (!isObj(g)) continue;
      if (!hasOwn(acc, key) || !isObj(acc[key])) acc[key] = { at: g.at, code: g.code };
      else if (Number.isFinite(g.at) && !(acc[key].at <= g.at)) acc[key] = { at: g.at, code: g.code };
    }
    delete un[guestUid];
    return function undo() {
      const u = unlocksState();
      u[guestUid] = before.guest;
      if (before.account === undefined) delete u[accountUid];
      else u[accountUid] = before.account;
    };
  }

  return { keyOf, publicConfig, setConfig, priceOf, owns, allowed, grant, owned, mergeGuest, MIN_PRICE, MAX_PRICE };
}

module.exports = { createShop, KINDS, MIN_PRICE, MAX_PRICE };
