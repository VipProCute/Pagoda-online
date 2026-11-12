/*
 * Sổ tay trong game (nút "?" ở thanh trên cùng). Nội dung nằm ở public/data/so-tay.vi.json (dữ liệu, không phải HTML).
 *
 * - Số liệu viết bằng chỗ giữ chỗ, ví dụ {EARN.incense}, {PK.TURN_SECONDS}; lúc hiện mới thay bằng giá trị
 *   của MERIT.EARN, MARTIAL.PK, AURA.TIERS và /api/config (test/guide.test.js kiểm mọi chỗ giữ chỗ đều thay được).
 *   Tên có sẵn: EARN.* · PK.* · MARTIAL.LEVEL_MAX / STARTERS (số chiêu biết sẵn) · MERIT.RANKS (số mốc pháp tướng)
 *   · AURA.TIERS (số tầng) / AURA.MIN1 (tiền tối thiểu của tầng 1) · CFG.* (khóa của /api/config).
 * - Mục / đoạn có "needs": [tên tính năng] chỉ hiện khi tính năng đó đang bật (pk, martial, donation, voice, login, kydao…);
 *   "needsNot" thì ngược lại (chỉ hiện khi tính năng tắt).
 *   Tính năng chưa có phía trình duyệt thì mặc định ẩn; thẻ làm ra nó gọi Guide.setFeature('tên', true).
 * - Dựng bằng helper h() riêng của file này (textContent, không innerHTML). Chữ không bao giờ nhắc bí mật (docs/HUONG-DAN-VIET.md §3).
 *
 * Phần thuần (resolve, makeContext, visibleSections, missingPlaceholders) chạy được trong Node để test; phần giao diện chỉ chạy ở trình duyệt.
 */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Guide = api;
})(typeof self !== 'undefined' ? self : typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';
  const DATA_URL = '/data/so-tay.vi.json';
  const PH = /\{([A-Za-z_]\w*(?:\.\w+)+)\}/g;
  const NUM = n => new Intl.NumberFormat('vi-VN').format(n);

  /* ---------- phần thuần ---------- */

  /** Dựng bảng giá trị cho chỗ giữ chỗ. mods: { MERIT, MARTIAL, AURA }, cfg: /api/config (có thể null). */
  function makeContext(mods, cfg) {
    mods = mods || {};
    const ctx = { EARN: {}, PK: {}, MARTIAL: {}, MERIT: {}, AURA: {}, CFG: cfg || {} };
    if (mods.MERIT) {
      ctx.EARN = mods.MERIT.EARN || {};
      ctx.MERIT.RANKS = (mods.MERIT.RANKS || []).length;
    }
    if (mods.MARTIAL) {
      ctx.PK = mods.MARTIAL.PK || {};
      ctx.MARTIAL.LEVEL_MAX = mods.MARTIAL.LEVEL_MAX;
      ctx.MARTIAL.STARTERS = (mods.MARTIAL.STARTERS || []).length;
      const titles = mods.MARTIAL.PK_TITLES || [];
      if (titles.length) {
        ctx.MARTIAL.PK_TITLES = titles.length;
        ctx.MARTIAL.PK_TITLE_FIRST = titles[0].name;
        ctx.MARTIAL.PK_TITLE_LAST = titles[titles.length - 1].name;
      }
      if (typeof mods.MARTIAL.pkTitle === 'function') {   // điểm mỗi trận thắng / hòa lấy từ chính công thức tính bậc
        ctx.MARTIAL.WIN_POINTS = mods.MARTIAL.pkTitle(1, 0).points;
        ctx.MARTIAL.DRAW_POINTS = mods.MARTIAL.pkTitle(0, 1).points;
      }
    }
    if (mods.AURA) {
      ctx.AURA.TIERS = (mods.AURA.TIERS || []).length;
      ctx.AURA.MIN1 = mods.AURA.TIERS && mods.AURA.TIERS[0] ? mods.AURA.TIERS[0].min : undefined;
    }
    return ctx;
  }

  function lookup(ctx, key) {
    let v = ctx;
    for (const part of key.split('.')) {
      if (v == null || typeof v !== 'object' || !Object.prototype.hasOwnProperty.call(v, part)) return undefined;
      v = v[part];
    }
    return (typeof v === 'number' && Number.isFinite(v)) || (typeof v === 'string' && v) ? v : undefined;
  }

  /** Thay chỗ giữ chỗ. Trả { text, missing } (missing: các chỗ không thay được, text để dấu "…" ở đó). */
  function resolve(text, ctx) {
    const missing = [];
    const out = String(text).replace(PH, (m, key) => {
      const v = lookup(ctx, key);
      if (v === undefined) { missing.push(key); return '…'; }
      return typeof v === 'number' ? NUM(v) : v;
    });
    return { text: out, missing };
  }

  /** Mọi chuỗi trong dữ liệu (trừ id, needs) theo thứ tự, để duyệt chỗ giữ chỗ. */
  function eachText(data, fn) {
    for (const s of (data && data.sections) || []) {
      fn(s.title, s.id);
      for (const b of s.blocks || []) {
        if (typeof b.text === 'string') fn(b.text, s.id);
        for (const it of b.items || []) {
          if (typeof it === 'string') fn(it, s.id);
          else { if (it.term) fn(it.term, s.id); if (it.def) fn(it.def, s.id); }
        }
      }
    }
  }

  /** Danh sách chỗ giữ chỗ không thay được bằng ctx (rỗng là tốt). */
  function missingPlaceholders(data, ctx) {
    const miss = new Set();
    eachText(data, t => resolve(t, ctx).missing.forEach(k => miss.add(k)));
    return [...miss];
  }

  // needs: mọi tính năng phải bật · needsNot: mọi tính năng phải tắt
  const ok = (x, has) => (!x.needs || x.needs.every(n => has(n))) && (!x.needsNot || x.needsNot.every(n => !has(n)));

  /** Các mục còn hiện (bỏ mục và đoạn của tính năng tắt; mục hết đoạn thì bỏ). Không sửa dữ liệu gốc. */
  function visibleSections(data, has) {
    const out = [];
    for (const s of (data && data.sections) || []) {
      if (!ok(s, has)) continue;
      const blocks = (s.blocks || []).filter(b => ok(b, has)).map(b => {
        if (!b.items) return b;
        return Object.assign({}, b, { items: b.items.filter(it => typeof it === 'string' || ok(it, has)) });
      }).filter(b => !b.items || b.items.length);
      if (blocks.length) out.push(Object.assign({}, s, { blocks }));
    }
    return out;
  }

  /* ---------- trạng thái ---------- */
  let cfg = null, data = null, loading = null, built = false;
  const forced = Object.create(null);   // tính năng do thẻ khác bật/tắt bằng setFeature

  /** Tính năng đang bật? (cờ của /api/config, hoặc module phía trình duyệt, hoặc setFeature). */
  function has(name) {
    if (name in forced) return !!forced[name];
    const mc = (cfg && cfg.martial) || {};
    switch (name) {
      case 'martial': return !!mc.enabled;
      case 'pk': return !!mc.enabled && !!mc.pk;
      case 'speedup': return !!mc.enabled && !!mc.speedup;
      case 'login': return !!mc.loginRequired;
      case 'donation': return !!(cfg && cfg.donation);
      case 'voice': return !!(cfg && cfg.voice);
      case 'kydao': return !!(root && root.KydaoUI);
      // Thầy Tử vi / thầy Tarot đã có ở Sân chùa (fortune.js). Bản 5 lá và lá số (tuvi5, tarot5) do thẻ làm ra nó bật bằng setFeature.
      case 'fortune': case 'tuvi': case 'tarot': return !!(root && root.Fortune);
      default: return false;
    }
  }
  function setFeature(name, on) { forced[name] = !!on; if (built) render(); }
  function configure(c) { cfg = c || null; if (built) render(); }

  /* ---------- giao diện (chỉ trình duyệt) ---------- */
  /** h('p.cls', { attr }, ...con): chỉ dùng textContent cho chữ. */
  function h(tag, attrs, ...kids) {
    const [name, ...cls] = tag.split('.');
    const el = document.createElement(name || 'div');
    if (cls.length) el.className = cls.join(' ');
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === 'on') for (const [ev, fn] of Object.entries(v)) el.addEventListener(ev, fn);
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const k of kids.flat(Infinity)) if (k != null) el.append(k.nodeType ? k : document.createTextNode(String(k)));
    return el;
  }

  let ui = null, currentId = null;

  function ctxNow() { return makeContext({ MERIT: root.MERIT, MARTIAL: root.MARTIAL, AURA: root.AURA }, cfg); }

  function renderBlock(b, ctx) {
    const t = s => resolve(s, ctx).text;
    if (b.type === 'h') return h('h4', null, t(b.text));
    if (b.type === 'ul') return h('ul', null, (b.items || []).map(i => h('li', null, t(i))));
    if (b.type === 'steps') return h('ol', null, (b.items || []).map(i => h('li', null, t(i))));
    if (b.type === 'note') return h('p.gd-note', null, t(b.text));
    if (b.type === 'terms') return h('dl.gd-terms', null, (b.items || []).map(i => [h('dt', null, t(i.term)), h('dd', null, t(i.def))]));
    return h('p', null, t(b.text));
  }

  function render() {
    if (!ui || !data) return;
    const ctx = ctxNow();
    const secs = visibleSections(data, has);
    if (!secs.some(s => s.id === currentId)) currentId = null;
    ui.nav.textContent = '';
    secs.forEach((s, i) => {
      ui.nav.append(h('li', null, h('button', {
        type: 'button', 'data-gd': s.id, 'aria-current': s.id === currentId ? 'true' : null,
        on: { click: () => show(s.id) }
      }, h('span.gd-n', null, String(i + 1)), h('span', null, resolve(s.title, ctx).text))));
    });
    ui.body.textContent = '';
    const cur = secs.find(s => s.id === currentId);
    ui.root.classList.toggle('gd-reading', !!cur);
    if (cur) {
      ui.body.append(h('h3', { tabindex: '-1' }, resolve(cur.title, ctx).text), ...cur.blocks.map(b => renderBlock(b, ctx)));
    } else {
      ui.body.append(h('p.gd-empty', null, 'Chọn một mục ở bên cạnh để đọc.'));
    }
    built = true;
  }

  function show(id) {
    currentId = id; render();
    if (!ui) return;
    ui.body.scrollTop = 0;
    const hd = ui.body.querySelector('h3');
    if (hd && hd.focus) hd.focus({ preventScroll: true });
  }

  function load() {
    if (data) return Promise.resolve(data);
    if (!loading) {
      loading = fetch(DATA_URL, { cache: 'no-cache' }).then(r => { if (!r.ok) throw new Error('http ' + r.status); return r.json(); })
        .then(j => { data = j; return j; })
        .catch(e => { loading = null; throw e; });
    }
    return loading;
  }

  /** Gắn Sổ tay vào hộp thoại có sẵn trong index.html: dlg = <dialog id="dlg-guide">, button = nút "?". */
  function mount(dlg, button) {
    const nav = dlg.querySelector('[data-gd-nav]'), body = dlg.querySelector('[data-gd-body]'), wrap = dlg.querySelector('.gd');
    const back = dlg.querySelector('[data-gd-back]');
    ui = { root: wrap, nav, body };
    if (back) back.addEventListener('click', () => { currentId = null; render(); });
    if (button) button.addEventListener('click', open);
  }

  function open() {
    const dlg = document.getElementById('dlg-guide');
    if (!dlg) return;
    if (!dlg.open) { if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', ''); }
    // màn hình rộng: mở sẵn mục đầu cho thân bên phải khỏi trống
    const first = () => {
      if (!currentId && root.matchMedia && root.matchMedia('(min-width: 641px)').matches) {
        const s = visibleSections(data, has)[0];
        if (s) currentId = s.id;
      }
    };
    if (data) { first(); render(); return; }
    ui.body.textContent = '';
    ui.body.append(h('p.gd-empty', null, 'Đang mở sổ tay…'));
    load().then(() => { first(); render(); }).catch(() => {
      ui.body.textContent = '';
      ui.body.append(h('p.gd-empty', null, 'Chưa mở được sổ tay. Kiểm tra kết nối rồi bấm "?" lại nhé.'));
    });
  }

  return { makeContext, resolve, missingPlaceholders, visibleSections, setFeature, configure, mount, open, has };
});
