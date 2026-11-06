/*
 * Tàng Kinh Các: kệ kinh và trang đọc kinh.
 * Mỗi bộ kinh là một file Markdown trong public/kinh/ (danh sách ở public/kinh/index.json).
 *   # Tiêu đề        → một chương (mục lục)
 *   ## / ###         → tiêu đề nhỏ
 *   ![chú thích](ảnh) → hình (đường dẫn tính từ public/kinh/)
 *   > dòng           → đoạn kệ, mỗi dòng giữ nguyên
 *   - mục            → danh sách
 *   **đậm**, *nghiêng*
 * Mọi chữ đều đưa vào trang bằng textContent nên không chạy được mã lạ.
 */
(function (root) {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* bỏ qua */ } }
  };
  let hooks = {}, index = null, book = null, chapters = [], ci = 0;
  const cache = {};
  let prefs = Object.assign({ size: 17, theme: 'paper' }, store.get('ta-lib-prefs', {}));
  const progress = store.get('ta-lib-progress', {});

  /* ---------- Markdown tối giản ---------- */
  function inline(text) {
    const f = document.createDocumentFragment();
    text.split(/(\*\*[^*]+\*\*|\*[^*\s][^*]*\*)/).forEach(part => {
      if (!part) return;
      if (/^\*\*[^*]+\*\*$/.test(part)) { const b = document.createElement('strong'); b.textContent = part.slice(2, -2); f.appendChild(b); }
      else if (/^\*[^*]+\*$/.test(part)) { const i = document.createElement('em'); i.textContent = part.slice(1, -1); f.appendChild(i); }
      else f.appendChild(document.createTextNode(part));
    });
    return f;
  }
  function parse(md) {
    const out = [];
    let ch = null, para = [], quote = null, list = null;
    const need = () => { if (!ch) { ch = { title: '', blocks: [] }; out.push(ch); } };
    const flush = () => {
      if (para.length) { ch.blocks.push({ t: 'p', text: para.join(' ') }); para = []; }
      if (quote) { ch.blocks.push({ t: 'q', lines: quote }); quote = null; }
      if (list) { ch.blocks.push({ t: 'ul', items: list }); list = null; }
    };
    for (const raw of md.replace(/\r/g, '').split('\n')) {
      const line = raw.trimEnd();
      let m;
      if ((m = /^# (.+)$/.exec(line))) { if (ch) flush(); ch = { title: m[1].trim(), blocks: [] }; out.push(ch); continue; }
      need();
      if (!line.trim()) { flush(); continue; }
      if ((m = /^(#{2,3}) (.+)$/.exec(line))) { flush(); ch.blocks.push({ t: m[1].length === 2 ? 'h3' : 'h4', text: m[2].trim() }); }
      else if ((m = /^!\[([^\]]*)\]\(([^)\s]+)\)$/.exec(line.trim()))) { flush(); ch.blocks.push({ t: 'img', alt: m[1], src: m[2] }); }
      else if ((m = /^> ?(.*)$/.exec(line))) { if (para.length || list) { const q = quote; quote = null; flush(); quote = q; } (quote = quote || []).push(m[1]); }
      else if ((m = /^- (.+)$/.exec(line))) { if (para.length || quote) flush(); (list = list || []).push(m[1]); }
      else if (/^---+$/.test(line.trim())) { flush(); ch.blocks.push({ t: 'hr' }); }
      else { if (quote || list) flush(); para.push(line.trim()); }
    }
    if (ch) flush();
    return out.filter(c => c.title || c.blocks.length);
  }
  function render(c) {
    const page = $('#libPage'); page.textContent = '';
    const h2 = document.createElement('h2'); h2.className = 'lp-title'; h2.textContent = c.title || book.title; page.appendChild(h2);
    for (const b of c.blocks) {
      let el;
      if (b.t === 'p' || b.t === 'h3' || b.t === 'h4') { el = document.createElement(b.t); el.appendChild(inline(b.text)); }
      else if (b.t === 'q') {
        el = document.createElement('blockquote');
        b.lines.forEach(l => { const d = document.createElement('div'); d.appendChild(inline(l)); el.appendChild(d); });
      } else if (b.t === 'ul') {
        el = document.createElement('ul');
        b.items.forEach(it => { const li = document.createElement('li'); li.appendChild(inline(it)); el.appendChild(li); });
      } else if (b.t === 'hr') el = document.createElement('hr');
      else if (b.t === 'img') {
        el = document.createElement('figure');
        const img = document.createElement('img');
        img.loading = 'lazy'; img.decoding = 'async'; img.alt = b.alt || 'Hình minh họa';
        img.src = /^(https?:)?\//.test(b.src) ? b.src : '/kinh/' + b.src;
        el.appendChild(img);
        if (b.alt) { const fc = document.createElement('figcaption'); fc.textContent = b.alt; el.appendChild(fc); }
      }
      if (el) page.appendChild(el);
    }
  }

  /* ---------- kệ kinh ---------- */
  async function loadIndex() {
    if (!index) {
      const r = await fetch('/kinh/index.json');
      if (!r.ok) throw new Error('HTTP ' + r.status);
      index = (await r.json()).books || [];
    }
    return index;
  }
  function shelf() {
    book = null;
    $('#lib-title').textContent = 'Kệ kinh';
    $('#libSub').textContent = 'Chạm vào một bộ kinh để đọc. Chỗ bạn đọc dở được nhớ trên máy này.';
    $('#libShelf').hidden = false; $('#libReader').hidden = true; $('#libFoot').hidden = true; $('#libTools').hidden = true; $('#libBack').hidden = true;
    const box = $('#libShelf'); box.textContent = '';
    (index || []).forEach(b => {
      const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'tome ' + (b.cover || 'nghe');
      btn.dataset.book = b.id;
      const cover = document.createElement('span'); cover.className = 'tome-cover'; cover.setAttribute('aria-hidden', 'true');
      const han = document.createElement('span'); han.className = 'tome-han';
      [...(b.han || '')].forEach(ch => { const c = document.createElement('span'); c.textContent = ch; han.appendChild(c); });
      const vn = document.createElement('span'); vn.className = 'tome-vn'; vn.textContent = b.title;
      cover.append(han, vn);
      const info = document.createElement('span'); info.className = 'tome-info';
      const t = document.createElement('b'); t.textContent = b.title;
      const sub = document.createElement('small'); sub.textContent = b.sub || '';
      const d = document.createElement('span'); d.className = 'tome-desc'; d.textContent = b.desc || '';
      const go = document.createElement('span'); go.className = 'tome-go';
      go.textContent = progress[b.id] && progress[b.id].ci > 0 ? 'Đọc tiếp' : 'Mở kinh';
      info.append(t, sub, d, go);
      btn.append(cover, info);
      box.appendChild(btn);
    });
    hooks.reading && hooks.reading('');
  }

  /* ---------- đọc kinh ---------- */
  async function openBook(id, chapter) {
    const b = (index || []).find(x => x.id === id);
    if (!b) return shelf();
    book = b;
    $('#lib-title').textContent = b.title;
    $('#libSub').textContent = b.sub || '';
    $('#libShelf').hidden = true; $('#libReader').hidden = false; $('#libFoot').hidden = false; $('#libTools').hidden = false; $('#libBack').hidden = false;
    $('#libChant').hidden = !b.chant;
    $('#libPage').textContent = 'Đang mở kinh…';
    hooks.reading && hooks.reading(b.id);
    try {
      if (!cache[id]) {
        const r = await fetch('/kinh/' + b.file);
        if (!r.ok) throw new Error('HTTP ' + r.status);
        cache[id] = parse(await r.text());
      }
    } catch (e) { $('#libPage').textContent = 'Không mở được kinh. Kiểm tra mạng rồi thử lại nhé.'; return; }
    if (book !== b) return;
    chapters = cache[id];
    const toc = $('#libTocList'); toc.textContent = '';
    chapters.forEach((c, i) => {
      const a = document.createElement('button'); a.type = 'button'; a.dataset.ci = i; a.textContent = c.title || b.title;
      toc.appendChild(a);
    });
    const saved = progress[id] || {};
    go(chapter != null ? chapter : (saved.ci || 0), chapter == null ? saved.top : 0);
  }
  function go(i, top) {
    if (!chapters.length) return;
    ci = Math.max(0, Math.min(chapters.length - 1, i | 0));
    render(chapters[ci]);
    [...$('#libTocList').children].forEach((a, k) => a.setAttribute('aria-current', String(k === ci)));
    $('#libPos').textContent = `${ci + 1} / ${chapters.length}`;
    $('#libPrev').disabled = ci === 0; $('#libNext').disabled = ci === chapters.length - 1;
    $('#libNext').textContent = ci < chapters.length - 1 ? 'Chương sau ›' : 'Hết kinh';
    const page = $('#libPage');
    page.scrollTop = top || 0;
    if (!top) page.focus({ preventScroll: true });
    save();
    $('#libReader').classList.remove('toc-open');
  }
  let saveT = 0;
  function save() {
    if (!book) return;
    clearTimeout(saveT);
    saveT = setTimeout(() => { if (!book) return; progress[book.id] = { ci, top: Math.round($('#libPage').scrollTop) }; store.set('ta-lib-progress', progress); }, 300);
  }
  function applyPrefs() {
    const dlg = $('#dlg-library');
    dlg.style.setProperty('--read-size', prefs.size + 'px');
    dlg.classList.toggle('dark-read', prefs.theme === 'dark');
    $('#libTheme').textContent = prefs.theme === 'dark' ? 'Nền giấy' : 'Nền tối';
    store.set('ta-lib-prefs', prefs);
  }

  function init(h) {
    hooks = h || {};
    applyPrefs();
    $('#libShelf').addEventListener('click', e => { const b = e.target.closest('[data-book]'); if (b) openBook(b.dataset.book); });
    $('#libBack').addEventListener('click', shelf);
    $('#libTocList').addEventListener('click', e => { const a = e.target.closest('[data-ci]'); if (a) go(+a.dataset.ci); });
    $('#libToc').addEventListener('click', () => $('#libReader').classList.toggle('toc-open'));
    $('#libPrev').addEventListener('click', () => go(ci - 1));
    $('#libNext').addEventListener('click', () => { if (ci < chapters.length - 1) go(ci + 1); else shelf(); });
    $('#libSmaller').addEventListener('click', () => { prefs.size = Math.max(14, prefs.size - 1); applyPrefs(); });
    $('#libBigger').addEventListener('click', () => { prefs.size = Math.min(26, prefs.size + 1); applyPrefs(); });
    $('#libTheme').addEventListener('click', () => { prefs.theme = prefs.theme === 'dark' ? 'paper' : 'dark'; applyPrefs(); });
    $('#libChant').addEventListener('click', () => { if (book && book.chant && hooks.chant) hooks.chant(book.chant); });
    $('#libPage').addEventListener('scroll', save, { passive: true });
    $('#dlg-library').addEventListener('close', () => { book = null; hooks.reading && hooks.reading(''); });
    $('#dlg-library').addEventListener('keydown', e => {
      if (!book || e.target.closest('input, textarea')) return;
      if (e.key === 'ArrowRight' && ci < chapters.length - 1) { go(ci + 1); e.preventDefault(); }
      if (e.key === 'ArrowLeft' && ci > 0) { go(ci - 1); e.preventDefault(); }
    });
  }

  async function open(id) {
    const d = $('#dlg-library');
    if (!d.open) { if (d.showModal) d.showModal(); else d.setAttribute('open', ''); }
    try { await loadIndex(); } catch (e) { $('#libShelf').textContent = 'Không mở được Tàng Kinh Các. Kiểm tra mạng rồi thử lại nhé.'; return; }
    if (id) openBook(id); else shelf();
  }

  root.Library = { init, open, parse, get book() { return book; } };
})(this);
