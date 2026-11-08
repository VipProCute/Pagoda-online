/*
 * Võ Học Các: nơi tu luyện nội công, học 15 chiêu, xếp bộ 4 chiêu. Chỉ để tu luyện, không có đánh nhau ở đây
 * (luận võ ở Sân đấu). Giao thức: docs/VO-HOC-GIAO-THUC.md mục 3 và 6.
 *   Dojo.init(host) · Dojo.mount(el) · Dojo.show(info) · Dojo.hide() · Dojo.refresh()
 */
(function (root) {
  'use strict';
  const M = root.MARTIAL;
  const TAB_KEY = 'ta-dojo-tab', ACK_MS = 12000;
  const TABS = [{ id: 'tam', label: 'Tâm pháp' }, { id: 'vo', label: 'Võ học' }, { id: 'bo', label: 'Bộ chiêu' }];
  const OFFLINE_MSG = 'Mất kết nối, các nút gửi tạm khóa cho tới khi nối lại.';
  const ICON = {
    lock: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    warn: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4l9 16H3z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M12 10v4.5M12 17.5v.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>'
  };

  let host = null, sock = null, el = null, mounted = false, visible = false;
  const ui = {};
  let st = null, loadErr = null, loading = false, again = false, reqId = 0;
  let tab = 'tam', busy = '', notes = {}, focusNext = null;
  let confirmCancel = false, confirmSp = false, anon = false;
  let sp = null, spLoading = false, sessKey = '', endTries = 0, endT = 0, tickT = 0;
  let draft = [], draftBase = [], saveWarn = null;
  let celeb = [], celebFresh = false;
  const seenSent = new Set(), upd = {}, timers = new Set();

  /* ---------- tiện ích ---------- */
  const NUM = n => Number(n || 0).toLocaleString('vi-VN');
  const vnd = n => (host && host.vnd ? host.vnd(n) : NUM(n) + 'đ');
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const sameArr = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
  const online = () => !sock || sock.connected !== false;
  const cfgOf = () => { try { return (host.cfg && host.cfg()) || {}; } catch (e) { return {}; } };
  const durText = min => { const h = Math.floor(min / 60), m = min % 60; return h === 0 ? `${m} phút` : m === 0 ? `${h} giờ` : `${h} giờ ${m} phút`; };
  const tamText = tam => {
    const bs = M.BRANCH_ORDER.filter(b => tam && tam[b] > 0);
    if (!bs.length) return '';
    if (bs.length === 3 && bs.every(b => tam[b] === tam[bs[0]])) return `tâm đắc mỗi nhánh +${tam[bs[0]]}`;
    return 'tâm đắc ' + bs.map(b => `${M.BRANCHES[b].name} +${tam[b]}`).join(', ');
  };
  function clockText(ms) {
    const s = Math.max(0, Math.ceil(ms / 1000)), p2 = n => String(n).padStart(2, '0');
    const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60;
    return h > 0 ? `${p2(h)}:${p2(m)}:${p2(s % 60)}` : `${p2(m)}:${p2(s % 60)}`;
  }
  const store = {
    get() { try { return localStorage.getItem(TAB_KEY); } catch (e) { return null; } },
    set(v) { try { localStorage.setItem(TAB_KEY, v); } catch (e) { /* bỏ qua */ } }
  };
  function later(fn, ms) { const id = setTimeout(() => { timers.delete(id); fn(); }, ms); timers.add(id); return id; }
  function stopTimers() { timers.forEach(clearTimeout); timers.clear(); clearInterval(tickT); tickT = 0; endT = 0; }

  function add(e, c) {
    if (c == null || c === false) return;
    if (Array.isArray(c)) c.forEach(x => add(e, x));
    else e.appendChild(c.nodeType ? c : document.createTextNode(String(c)));
  }
  /** h(thẻ, thuộc tính, ...con): mọi chữ đi qua text node, không innerHTML. */
  function h(tag, props) {
    const e = document.createElement(tag);
    if (props) {
      for (const k in props) {
        const v = props[k];
        if (v == null || v === false) continue;
        if (k === 'class') e.className = v;
        else if (k === 'style') { for (const s in v) e.style.setProperty(s, v[s]); }
        else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), v);
        else e.setAttribute(k, v === true ? '' : v);
      }
    }
    for (let i = 2; i < arguments.length; i++) add(e, arguments[i]);
    return e;
  }
  function ico(name) { const s = document.createElement('span'); s.className = 'dj-ico'; s.innerHTML = ICON[name]; return s; }
  function bar(pct, label, color, big) {
    const v = clamp(pct || 0, 0, 1);
    const b = h('div', { class: 'dj-bar' + (big ? ' big' : ''), role: 'progressbar', 'aria-label': label, 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(Math.round(v * 100)) },
      h('i', { style: { width: (v * 100).toFixed(1) + '%' } }));
    if (color) b.style.setProperty('--bc', color);
    return b;
  }
  /** Nút gửi lên máy chủ: bị khóa khi mất kết nối. */
  function sendBtn(label, cls, onClick, extra) {
    return h('button', Object.assign({ type: 'button', class: cls, 'data-send': '', disabled: !online(), onclick: onClick }, extra), label);
  }
  const noteEl = key => (notes[key] ? h('p', { class: 'warn dj-note-w' }, ico('warn'), h('span', null, notes[key])) : null);
  function say(text) {
    if (!ui.live) return;
    ui.live.textContent = '';
    later(() => { ui.live.textContent = text; }, 40);
  }

  /* ---------- gửi / nhận ---------- */
  function ask(ev, data, cb) {
    let fin = false;
    const t = later(() => finish({ ok: false, reason: 'Máy chủ chưa trả lời, bạn thử lại nhé.', code: 'timeout' }), ACK_MS);
    function finish(a) {
      if (fin) return;
      fin = true; clearTimeout(t); timers.delete(t);
      cb(a && typeof a === 'object' ? a : { ok: false, reason: 'Máy chủ trả lời không rõ, bạn thử lại nhé.' });
    }
    try { sock.emit(ev, data, finish); } catch (e) { finish({ ok: false, reason: 'Chưa gửi được, bạn thử lại nhé.' }); }
  }
  /** Thao tác đổi dữ liệu: một lần một việc, khóa khi mất mạng. */
  function act(key, ev, data, ok, noteKey) {
    if (busy) return;
    if (!online()) { notes[noteKey] = OFFLINE_MSG; render(); return; }
    delete notes[noteKey];
    busy = key; reqId++; paintBusy();
    ask(ev, data, a => {
      busy = ''; paintBusy();
      if (a.ok) ok(a); else fail(a, noteKey);
    });
  }
  function fail(a, key) {
    const reason = a.reason || 'Chưa làm được, bạn thử lại nhé.';
    notes[key] = reason;
    host.toast(reason); say(reason);
    if (a.code === 'login' || ['busy', 'nosession', 'done', 'limit', 'paid', 'state', 'timeout'].includes(a.code)) refresh();
    render();
  }
  function paintBusy() { if (ui.panel) ui.panel.classList.toggle('is-busy', !!busy); }

  function refresh() {
    if (!visible || !sock) return;
    if (loading) { again = true; return; }
    if (!online()) { if (!st) { loadErr = OFFLINE_MSG; render(); } return; }
    loading = true;
    const my = ++reqId;
    ask('martial:state', {}, a => {
      loading = false;
      if (visible && my === reqId) applyState(a);
      if (again) { again = false; later(refresh, 300); }
    });
  }

  function applyState(a) {
    if (!a.ok) {
      loadErr = a.reason || 'Chưa tải được Võ Học Các, bạn thử lại nhé.';
      render();
      return;
    }
    loadErr = null; st = a;
    if (st.enabled === false) { render(); return; }
    const s = st.session, key = s ? String(s.id) : '';
    if (key !== sessKey) { sessKey = key; confirmCancel = false; confirmSp = false; sp = null; endTries = 0; notes = {}; }
    if (!s || !s.speedup) sp = null;
    collectCeleb(st);
    syncDraft();
    render();
    ensureSpeedInfo();
  }

  function collectCeleb(a) {
    const p = a.profile || {};
    (a.recent || []).forEach((r, i) => {
      const id = String(r.id);
      if (r.seen || seenSent.has(id) || celeb.some(c => String(c.id) === id)) return;
      const u = upd[id] || {};
      let levelUp = !!u.levelUp, level = u.level || p.level;
      if (!u.kind && i === 0 && r.status === 'completed' && r.reward && p.level) {
        levelUp = M.levelOf(Math.max(0, (p.congLuc || 0) - (r.reward.congLuc || 0))) < p.level;
      }
      celebFresh = true;
      celeb.push({ id: r.id, methodId: r.methodId, durationKey: r.durationKey, status: r.status, via: r.via, reward: r.reward, levelUp, level });
    });
    if (celeb.length > 3) celeb = celeb.slice(-3);
  }

  function syncDraft() {
    const p = st.profile, learned = learnedSet(p), saved = (p.loadout || []).filter(id => learned.has(id));
    if (sameArr(draft, draftBase)) draft = saved.slice();
    else draft = draft.filter(id => learned.has(id));
    draftBase = saved.slice();
  }
  const learnedSet = p => new Set((p.learned || []).filter(id => M.SKILLS[id]));

  /** Mở lại trang thấy yêu cầu hoàn thành ngay đang chờ: hỏi lại máy chủ để lấy mã QR (kết quả existing). */
  function ensureSpeedInfo() {
    const s = st && st.session;
    if (!s || !s.speedup || spLoading || (sp && sp.code === s.speedup.code) || !online()) return;
    spLoading = true;
    const id = s.id;
    ask('tu:speedup', { sessionId: id, anon: false }, a => {
      spLoading = false;
      if (st && st.session && st.session.id === id && st.session.speedup) {
        if (a.ok) sp = a; else notes.speedup = a.reason || 'Chưa tải được mã chuyển khoản.';
        render();
      }
    });
  }

  /* ---------- đồng hồ ---------- */
  function tick() { updateClock(); }
  function updateClock() {
    const s = st && st.session;
    if (!s || !ui.cd || !visible) return;
    const now = host.serverNow(), left = s.endsAt - now, total = Math.max(1, s.endsAt - s.startedAt);
    const pct = clamp((now - s.startedAt) / total, 0, 1);
    ui.cd.textContent = left > 0 ? clockText(left) : '00:00';
    ui.cdFill.style.width = (pct * 100).toFixed(1) + '%';
    ui.cdBar.setAttribute('aria-valuenow', String(Math.round(pct * 100)));
    if (left <= 0) onEnded();
  }
  /** Đếm về 0: đợi chút rồi hỏi lại máy chủ để nhận kết quả; chưa có thì hỏi tiếp, tối đa vài lần. */
  function onEnded() {
    if (endT || endTries >= 8) return;
    if (ui.cdMsg) ui.cdMsg.hidden = false;
    endT = later(() => { endT = 0; endTries++; if (endTries >= 8) render(); refresh(); }, endTries ? 3000 : 1500);
  }

  function onUpdate(u) {
    if (!u || typeof u !== 'object') return;
    if (u.text) host.toast(u.text);
    if (u.sessionId != null) upd[String(u.sessionId)] = u;
    if (visible) { notes = {}; refresh(); }
  }
  function onNet() { if (mounted) { paintOffline(); lockSends(); } }
  function lockSends() {
    if (!ui.panel) return;
    const off = !online();
    ui.panel.querySelectorAll('[data-send]').forEach(b => { b.disabled = off || b.hasAttribute('data-locked'); });
  }
  function paintOffline() { if (ui.off) ui.off.hidden = online(); }

  /* ---------- hành động ---------- */
  function startSession(m, d) {
    act('start', 'tu:start', { methodId: m.id, duration: d.key }, a => {
      st.session = a.session; sessKey = String(a.session.id); confirmCancel = false; confirmSp = false; sp = null; endTries = 0;
      host.toast(`Bắt đầu tu ${m.name} (${durText(d.minutes)}).`);
      say(`Đã bắt đầu tu ${m.name}, ${durText(d.minutes)}. Có thể đóng web.`);
      render(); el.scrollTop = 0;
    }, 'start');
  }
  function cancelSession() {
    const s = st.session;
    act('cancel', 'tu:cancel', { sessionId: s.id }, () => {
      st.session = null; sessKey = ''; sp = null; confirmCancel = false; confirmSp = false;
      say('Đã hủy phiên tu.');
      render();
    }, 'session');
  }
  function requestSpeedup() {
    const s = st.session;
    act('speedup', 'tu:speedup', { sessionId: s.id, anon }, a => {
      sp = a;
      if (st.session && st.session.id === s.id) st.session.speedup = { code: a.code, amount: a.amount, status: 'pending', bankReported: false, createdAt: host.serverNow(), test: !!a.test, confirmAt: a.confirmAt || null };
      if (a.existing) refresh();
      say(a.test ? 'Đã tạo yêu cầu thử nghiệm. Hệ thống tự xác nhận sau 10 giây, không cần chuyển tiền.' : 'Đã tạo yêu cầu hoàn thành ngay. Quét mã QR để chuyển khoản, rồi đợi Ban điều hành xác nhận.');
      render();
      if (ui.spCard) ui.spCard.scrollIntoView({ block: 'nearest' });
    }, 'speedup');
  }
  function cancelSpeedup() {
    const code = st.session.speedup.code;
    act('spcancel', 'tu:speedup:cancel', { code }, () => {
      if (st.session) st.session.speedup = null;
      sp = null; confirmSp = false;
      host.toast('Đã hủy yêu cầu hoàn thành ngay.'); say('Đã hủy yêu cầu hoàn thành ngay.');
      render(); refresh();
    }, 'speedup');
  }
  function useVoucher(v) {
    const s = st.session;
    act('voucher', 'tu:voucher', { voucherId: v.id, sessionId: s.id }, () => { say('Đã dùng phiếu, phiên tu hoàn thành.'); refresh(); }, 'voucher');
  }
  function learn(id) {
    act('learn:' + id, 'vo:learn', { skillId: id }, a => {
      if (a.profile) st.profile = Object.assign({}, st.profile, a.profile);
      else st.profile.learned = (st.profile.learned || []).concat(id);
      const name = M.SKILLS[id].name;
      host.toast(`Đã lĩnh hội ${name}.`); say(`Đã lĩnh hội ${name}.`);
      focusNext = 'sk:' + id;
      syncDraft(); render();
    }, 'learn');
  }
  function toggleSkill(id) {
    const i = draft.indexOf(id);
    if (i >= 0) draft.splice(i, 1);
    else if (draft.length >= 4) { notes.loadout = 'Đã đủ 4 chiêu, hãy bỏ bớt một chiêu trước.'; say(notes.loadout); render(); return; }
    else draft.push(id);
    delete notes.loadout; saveWarn = null; focusNext = 'lib:' + id;
    render();
  }
  function saveLoadout() {
    if (draft.length !== 4) return;
    const mine = draft.slice();
    act('loadout', 'vo:loadout', { skills: mine }, a => {
      const saved = Array.isArray(a.loadout) ? a.loadout.slice() : mine;
      st.profile.loadout = saved; draftBase = saved.slice(); draft = saved.slice();
      saveWarn = Array.isArray(a.warnings) ? a.warnings : [];
      host.toast('Đã lưu bộ chiêu.');
      say('Đã lưu bộ chiêu.' + saveWarn.map(w => ' ' + w.text).join(''));
      focusNext = 'save'; render();
    }, 'loadout');
  }
  /** 4 chiêu cân bằng: 1 công, 1 thủ hoặc né, 1 đỡ nếu có, 1 chiêu bất kỳ. Chỉ gợi ý, người chơi tự bấm lưu. */
  function suggest(ids) {
    const S = ids.map(i => M.SKILLS[i]).filter(Boolean), pick = [];
    const dmg = s => (s.hits || []).reduce((a, x) => a + x.base, 0);
    const rest = f => S.filter(s => !pick.includes(s.id) && f(s));
    const take = (list, cmp) => { const s = list.slice().sort(cmp)[0]; if (s) pick.push(s.id); };
    const byDmg = (a, b) => dmg(b) - dmg(a) || a.mana - b.mana;
    const byTier = (a, b) => b.tier - a.tier || a.mana - b.mana;
    const atk = rest(s => s.kind === 'atk');
    take(atk.length ? atk : rest(s => M.isAttacking(s)), byDmg);
    take(rest(s => s.kind === 'guard' || s.kind === 'dodge'), byTier);
    take(rest(s => s.kind === 'parry'), byTier);
    if (pick.length < 3) take(rest(s => s.kind === 'hybrid'), byTier);
    take(rest(s => M.isAttacking(s)).concat(rest(() => true)), (a, b) => (M.isAttacking(b) - M.isAttacking(a)) || byTier(a, b));
    while (pick.length < 4 && rest(() => true).length) take(rest(() => true), byTier);
    return pick.slice(0, 4);
  }
  function copyText(text, node, what) {
    const fallback = () => {
      try { const r = document.createRange(); r.selectNodeContents(node); const s = getSelection(); s.removeAllRanges(); s.addRange(r); } catch (e) { /* bỏ qua */ }
      host.toast('Đã chọn nội dung, bấm sao chép trên máy của bạn.');
    };
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(() => host.toast(`Đã chép ${what}.`), fallback);
      else fallback();
    } catch (e) { fallback(); }
  }

  /* ---------- dựng giao diện ---------- */
  const closed = () => (cfgOf().martial && cfgOf().martial.enabled === false) || (st && st.enabled === false);
  const needLogin = () => !!(st && st.login && st.login.required && !st.login.signedIn);

  function mount(host_el) {
    el = host_el;
    ui.head = h('header', { class: 'dj-head' },
      h('div', { class: 'dj-top' },
        h('button', { type: 'button', class: 'btn small dj-back', onclick: () => host.goto('hall') }, '← Quay lại'),
        ui.arena = h('button', { type: 'button', class: 'dj-link', onclick: () => host.goto('arena') }, 'Ra sân đấu →')),
      h('div', { class: 'dj-title' }, h('h2', null, 'Võ Học Các'), h('span', { class: 'dj-han', lang: 'zh', 'aria-hidden': 'true' }, '武學閣')),
      h('p', { class: 'dj-sub' }, 'Nơi tu luyện nội công và học chiêu.'));
    ui.off = h('p', { class: 'dj-offline', role: 'status', hidden: true }, ico('warn'), h('span', null, OFFLINE_MSG));
    ui.prof = h('section', { class: 'card dj-prof', 'aria-label': 'Hồ sơ nội công', hidden: true });
    ui.tabs = h('div', { class: 'dj-tabs', role: 'tablist', 'aria-label': 'Các mục của Võ Học Các', onkeydown: tabKeys },
      TABS.map(t => h('button', { type: 'button', role: 'tab', id: 'dj-tab-' + t.id, 'aria-controls': 'dj-panel', 'data-tab': t.id, onclick: () => setTab(t.id) },
        h('span', null, t.label), h('small', { class: 'dj-cnt' }))));
    ui.panel = h('div', { class: 'dj-panel', id: 'dj-panel', role: 'tabpanel', tabindex: '-1' });
    ui.live = h('div', { class: 'sr', 'aria-live': 'polite' });
    ui.rules = rulesNode();
    ui.root = h('div', { class: 'dj' }, ui.head, ui.off, ui.prof, h('div', { class: 'dj-main' }, ui.tabs, ui.panel), ui.rules, ui.live);
    el.appendChild(ui.root);
    mounted = true;
    const saved = store.get();
    if (TABS.some(t => t.id === saved)) tab = saved;
    render();
  }

  function render() {
    if (!mounted) return;
    ui.arena.hidden = !(cfgOf().martial && cfgOf().martial.pk);
    paintOffline(); renderProfile(); renderTabs(); renderPanel(); paintBusy();
  }

  function setTab(id, focus) {
    if (!TABS.some(t => t.id === id)) return;
    tab = id; store.set(id); render();
    if (focus) ui.tabs.querySelector('[data-tab="' + id + '"]').focus();
  }
  function tabKeys(e) {
    const i = TABS.findIndex(t => t.id === tab);
    let n = -1;
    if (e.key === 'ArrowRight') n = (i + 1) % TABS.length;
    else if (e.key === 'ArrowLeft') n = (i + TABS.length - 1) % TABS.length;
    else if (e.key === 'Home') n = 0;
    else if (e.key === 'End') n = TABS.length - 1;
    if (n < 0) return;
    e.preventDefault(); setTab(TABS[n].id, true);
  }
  function renderTabs() {
    const p = st && st.profile, off = closed() || needLogin() || !p;
    ui.tabs.hidden = !!closed();
    ui.tabs.querySelectorAll('[role=tab]').forEach(b => {
      const id = b.dataset.tab, on = id === tab;
      b.setAttribute('aria-selected', on ? 'true' : 'false'); b.tabIndex = on ? 0 : -1;
      const c = b.querySelector('.dj-cnt');
      let t = '';
      if (!off) {
        if (id === 'tam' && st.session) t = 'đang tu';
        else if (id === 'vo') t = `${learnedSet(p).size}/${M.SKILL_LIST.length}`;
        else if (id === 'bo') t = `${(p.loadout || []).length}/4`;
      }
      c.textContent = t;
    });
    ui.panel.setAttribute('aria-labelledby', 'dj-tab-' + tab);
  }

  function renderProfile() {
    const p = st && st.profile, box = ui.prof;
    box.hidden = !p || closed();
    if (box.hidden) return;
    box.classList.toggle('is-guest', needLogin());
    const max = p.levelTo == null;
    box.textContent = '';
    add(box, [
      h('div', { class: 'dj-prof-top' },
        h('div', { class: 'dj-seal', role: 'img', 'aria-label': `Nội công cấp ${p.level}` }, h('small', null, 'Cấp'), h('b', null, String(p.level))),
        h('div', { class: 'dj-cl' },
          h('div', { class: 'dj-cl-row' }, h('span', { class: 'dj-k' }, 'Công lực'),
            h('span', { class: 'dj-cl-v' }, h('b', null, NUM(p.congLuc)), max ? '' : ' / ' + NUM(p.levelTo))),
          bar(max ? 1 : p.pct, max ? 'Công lực đã viên mãn' : `Công lực tới cấp ${p.level + 1}`, null, true),
          h('p', { class: 'dj-cl-note' }, max ? h('b', { class: 'dj-full' }, 'Viên mãn') : `Còn ${NUM(p.levelTo - p.congLuc)} để lên cấp ${p.level + 1}`))),
      h('p', { class: 'dj-line' }, 'Nội lực tối đa trong trận ', h('b', null, String(p.manaMax))),
      h('ul', { class: 'dj-tam', 'aria-label': 'Tâm đắc ba nhánh' }, M.BRANCH_ORDER.map(b => {
        const br = M.BRANCHES[b], v = (p.tam && p.tam[b]) || 0;
        return h('li', { style: { '--bc': br.color } },
          h('span', { class: 'dj-tam-k' }, h('i', { class: 'dj-dot', 'aria-hidden': 'true' }), br.name),
          h('b', null, `${v}/${M.TAM_MAX}`),
          bar(v / M.TAM_MAX, `Tâm đắc ${br.name} ${v} trên ${M.TAM_MAX}`, br.color));
      })),
      h('p', { class: 'dj-line dj-rec' }, 'Thắng ', h('b', null, String(p.wins || 0)), ' · Thua ', h('b', null, String(p.losses || 0)), ' · Hòa ', h('b', null, String(p.draws || 0)))]);
  }

  function renderPanel() {
    const a = document.activeElement, inside = a && ui.panel.contains(a);
    const explicit = !!focusNext, fk = focusNext || (inside && a.dataset ? a.dataset.fk : null);
    focusNext = null;
    ui.cd = ui.cdFill = ui.cdBar = ui.cdMsg = ui.spCard = null;
    let kids;
    if (closed()) kids = [closedCard()];
    else if (!st) kids = [loadErr ? errCard() : loadingCard()];
    else if (needLogin()) kids = [loginCard()];
    else {
      kids = tab === 'tam' ? tamTab() : tab === 'vo' ? voTab() : boTab();
      if (loadErr) kids.unshift(staleNote());
    }
    ui.panel.replaceChildren(...kids.flat(Infinity).filter(Boolean));
    if (fk) {
      const n = Array.from(ui.panel.querySelectorAll('[data-fk]')).find(x => x.dataset.fk === fk);
      if (n && !n.disabled) n.focus({ preventScroll: !explicit }); else if (inside) ui.panel.focus({ preventScroll: true });
    } else if (inside) ui.panel.focus({ preventScroll: true });
    if (tab === 'tam' && st && !closed() && !needLogin()) { if (celebFresh && celeb.length) el.scrollTop = 0; celebFresh = false; flushSeen(); }
    updateClock();
  }

  function flushSeen() {
    const fresh = celeb.filter(c => !seenSent.has(String(c.id))), ids = fresh.map(c => c.id);
    if (!ids.length || !online()) return;
    fresh.forEach(c => seenSent.add(String(c.id)));
    ask('martial:seen', { ids }, a => { if (!a.ok) fresh.forEach(c => seenSent.delete(String(c.id))); });
  }

  /* ----- trạng thái chung ----- */
  function loadingCard() { return h('div', { class: 'card dj-state dj-loading', role: 'status' }, h('span', { class: 'spin', 'aria-hidden': 'true' }), h('span', null, 'Đang mở Võ Học Các…')); }
  function errCard() {
    return h('div', { class: 'card dj-state dj-err' }, h('p', { class: 'warn' }, loadErr),
      h('button', { type: 'button', class: 'btn small', onclick: () => { loadErr = null; render(); refresh(); } }, 'Thử lại'));
  }
  function staleNote() {
    return h('p', { class: 'warn dj-note-w' }, ico('warn'), h('span', null, 'Chưa cập nhật được: ' + loadErr + ' '),
      h('button', { type: 'button', class: 'dj-link', onclick: () => refresh() }, 'Tải lại'));
  }
  function closedCard() {
    return h('div', { class: 'card dj-state' }, h('h3', { class: 'dj-h' }, 'Võ Học Các chưa mở'),
      h('p', { class: 'hint' }, 'Khi nhà chùa mở, bạn sẽ tu luyện nội công và học chiêu ở đây.'));
  }
  function loginCard() {
    return h('div', { class: 'card dj-state dj-login' },
      h('h3', { class: 'dj-h' }, 'Đăng nhập Google để tu luyện và lưu tiến độ'),
      h('p', { class: 'dj-intro' }, 'Công lực, chiêu đã học và bộ chiêu gắn với tài khoản của bạn, nên cần đăng nhập mới tu luyện được. Luật tu luyện ở cuối trang, bạn vẫn đọc được.'),
      h('button', { type: 'button', class: 'btn primary big', onclick: () => host.login() }, 'Đăng nhập Google'));
  }

  /* ----- tab Tâm pháp ----- */
  function tamTab() {
    const out = celeb.map(celebCard);
    const s = st.session;
    if (s) {
      out.push(sessionCard(s));
      const v = voucherCard(s);
      if (v) out.push(v);
      const sc = speedCard(s);
      if (sc) out.push(sc);
    } else out.push(methodsSection());
    return out;
  }

  function celebCard(c) {
    const m = M.METHODS[c.methodId], name = m ? m.name : 'nội công', d = m && m.durations.find(x => x.key === c.durationKey);
    const dur = d ? ` (${durText(d.minutes)})` : '';
    const done = c.status === 'completed', r = c.reward || { congLuc: 0, tam: {} };
    const how = c.via === 'speedup' ? ' nhờ hoàn thành ngay' : c.via === 'voucher' ? ' nhờ phiếu hoàn thành ngay' : '';
    const gains = [];
    if (done) {
      if (r.congLuc > 0) gains.push(`+${r.congLuc} công lực`);
      const tt = tamText(r.tam);
      if (tt) gains.push(tt);
    }
    return h('section', { class: 'card dj-celeb' + (c.levelUp ? ' up' : ''), 'aria-label': 'Kết quả phiên tu' },
      h('div', { class: 'dj-celeb-head' },
        h('b', null, done ? `Phiên tu ${name}${dur} đã viên mãn${how}` : `Đã hủy phiên tu ${name}${dur}`),
        h('button', { type: 'button', class: 'x dj-x', 'aria-label': 'Đóng', onclick: () => { celeb = celeb.filter(x => x !== c); render(); } }, '×')),
      done ? h('p', { class: 'dj-celeb-g' }, gains.length ? gains.join(' · ') : 'Công lực và tâm đắc đã ở mức tối đa nên không cộng thêm.') : null,
      c.levelUp ? h('p', { class: 'dj-celeb-up' }, `Nội công lên cấp ${c.level}!`) : null);
  }

  function methodsSection() {
    const p = st.profile, vs = (p.vouchers || []).length;
    return h('section', { class: 'dj-methods', 'aria-label': 'Công pháp' },
      h('h3', { class: 'dj-h' }, 'Chọn công pháp'),
      h('p', { class: 'dj-intro' }, 'Chạm một thời lượng để bắt đầu tu. Tu xong cứ đóng web, hết giờ máy chủ tự ghi nhận.'),
      vs ? h('p', { class: 'hint dj-hint-v' }, `Bạn đang có ${vs} phiếu hoàn thành ngay, dùng được khi có một phiên tu đang chạy.`) : null,
      noteEl('start'),
      h('div', { class: 'dj-mgrid' }, M.METHOD_LIST.map(methodCard)));
  }

  function gainOf(p, mid, key) {
    const raw = M.rewardOf(mid, key), real = M.clampReward(p, raw);
    const capped = real.congLuc < raw.congLuc || M.BRANCH_ORDER.some(b => real.tam[b] < raw.tam[b]);
    return { raw, real, capped };
  }
  function methodCard(m) {
    const p = st.profile, can = M.canCultivate(p, m.id), br = m.branch && M.BRANCHES[m.branch];
    const color = br ? br.color : m.branch === 'all' ? 'var(--gold)' : 'var(--muted)';
    const tag = br ? `Nhánh ${br.name}` : m.branch === 'all' ? 'Thông cả ba nhánh' : 'Không thiên nhánh nào';
    return h('article', { class: 'card dj-m' + (can.ok ? '' : ' is-locked'), style: { '--bc': color } },
      h('header', { class: 'dj-m-head' }, h('h4', null, m.name), h('span', { class: 'dj-han', lang: 'zh', 'aria-hidden': 'true' }, m.han)),
      h('div', { class: 'dj-tags' },
        h('span', { class: 'dj-tag' }, h('i', { class: 'dj-dot', 'aria-hidden': 'true' }), tag),
        can.ok ? null : h('span', { class: 'dj-tag lock' }, ico('lock'), `Cần cấp ${m.reqLevel}`)),
      h('p', { class: 'dj-m-short' }, m.short),
      h('div', { class: 'dj-durs', role: 'group', 'aria-label': `Thời lượng tu ${m.name}` }, m.durations.map(d => durBtn(m, d, can))),
      can.ok ? null : h('p', { class: 'hint' }, can.reason));
  }
  function durBtn(m, d, can) {
    const g = gainOf(st.profile, m.id, d.key), r = g.real, tt = tamText(r.tam);
    const gain = r.congLuc > 0 ? `+${r.congLuc} công lực` + (g.capped ? ' (tới trần)' : '') : 'Công lực đã đầy';
    const label = `Tu ${m.name} ${durText(d.minutes)}: ${gain}${tt ? ', ' + tt : ''}`;
    return h('button', {
      type: 'button', class: 'dj-dur', 'data-send': '', 'data-fk': `dur:${m.id}:${d.key}`, 'data-locked': can.ok ? null : '',
      disabled: !can.ok || !online(), 'aria-label': can.ok ? label : `${label}. ${can.reason}`, onclick: () => startSession(m, d)
    }, h('b', null, durText(d.minutes)), h('span', { class: 'dj-dur-g' }, gain), tt ? h('small', null, tt) : null);
  }

  function sessionCard(s) {
    const m = M.METHODS[s.methodId] || { name: s.methodId, han: '' }, d = (m.durations || []).find(x => x.key === s.durationKey);
    const g = gainOf(st.profile, s.methodId, s.durationKey), tt = g.real ? tamText(g.real.tam) : '';
    const left = s.endsAt - host.serverNow(), ended = left <= 0;
    ui.cd = h('div', { class: 'dj-cd', role: 'timer' }, clockText(left));
    ui.cdBar = bar(0, 'Tiến độ phiên tu', null, true);
    ui.cdFill = ui.cdBar.firstChild;
    ui.cdMsg = h('p', { class: 'dj-wait', hidden: !ended },
      endTries >= 8 ? h('span', null, 'Máy chủ chưa báo kết quả. ') : [h('span', { class: 'spin', 'aria-hidden': 'true' }), h('span', null, 'Đang nhận kết quả từ máy chủ…')],
      endTries >= 8 ? h('button', { type: 'button', class: 'dj-link', onclick: () => { endTries = 0; render(); refresh(); } }, 'Tải lại') : null);
    return h('section', { class: 'card dj-sess', 'aria-label': 'Phiên tu đang chạy' },
      h('div', { class: 'eyebrow' }, 'Đang tu luyện'),
      h('div', { class: 'dj-m-head' }, h('h3', { class: 'dj-sess-name' }, m.name), h('span', { class: 'dj-han', lang: 'zh', 'aria-hidden': 'true' }, m.han || '')),
      h('p', { class: 'dj-sess-sub' }, [d ? durText(d.minutes) : s.durationKey, g.real && g.real.congLuc > 0 ? `+${g.real.congLuc} công lực` : null, tt || null].filter(Boolean).join(' · ')),
      ui.cd, ui.cdBar, ui.cdMsg,
      h('p', { class: 'dj-keep' }, 'Có thể đóng web, hết giờ máy chủ tự ghi nhận.'),
      noteEl('session'),
      cancelBlock(s));
  }
  function cancelBlock(s) {
    if (!confirmCancel) {
      return h('div', { class: 'dj-acts' }, sendBtn('Hủy phiên', 'btn small', () => { confirmCancel = true; focusNext = 'cancel:keep'; render(); }, { 'data-fk': 'cancel:open' }));
    }
    return h('div', { class: 'dj-confirm', role: 'group', 'aria-label': 'Xác nhận hủy phiên tu' },
      h('p', null, h('b', null, 'Hủy là mất hết tiến độ phiên này.'),
        s.speedup ? ' Yêu cầu hoàn thành ngay đang chờ vẫn giữ nguyên; nếu bạn đã chuyển khoản, khoản đó sẽ đổi thành phiếu dùng cho phiên sau.' : ' Bạn chắc chắn chứ?'),
      h('div', { class: 'dj-acts' },
        h('button', { type: 'button', class: 'btn small', 'data-fk': 'cancel:keep', onclick: () => { confirmCancel = false; focusNext = 'cancel:open'; render(); } }, 'Giữ lại'),
        sendBtn('Hủy phiên', 'btn small dj-danger', cancelSession, { 'data-fk': 'cancel:yes' })));
  }

  function voucherCard(s) {
    const vs = (st.profile.vouchers || []), ok = vs.filter(v => v.value >= s.price), low = vs.length - ok.length;
    if (!vs.length) return null;
    return h('section', { class: 'card dj-voucher', 'aria-label': 'Phiếu hoàn thành ngay' },
      h('div', { class: 'eyebrow' }, 'Phiếu hoàn thành ngay'),
      ok.length ? h('p', { class: 'dj-intro' }, `Bạn có ${vs.length} phiếu. Dùng một phiếu thì phiên này hoàn thành ngay, không phải chờ.`) : null,
      ok.length ? h('div', { class: 'dj-acts wrap' }, ok.map(v => sendBtn(`Dùng phiếu ${vnd(v.value)}`, 'btn gold', () => useVoucher(v), { 'data-fk': 'v:' + v.id }))) : null,
      low ? h('p', { class: 'hint' }, `${low} phiếu trị giá chưa đủ cho phiên này (cần ${vnd(s.price)}).`) : null,
      noteEl('voucher'));
  }

  const speedRules = (priceText, limitText) => h('ul', { class: 'dj-list' },
    h('li', null, cfgOf().donation && cfgOf().donation.mode === 'test' ? `Cúng dường thử nghiệm ${priceText}; không chuyển tiền thật.` : `Bạn cúng dường ${priceText} bằng chuyển khoản (quét mã QR).`),
    h('li', null, cfgOf().donation && cfgOf().donation.mode === 'test' ? 'Hệ thống tự xác nhận sau 10 giây.' : 'Ban điều hành xác nhận thủ công nên có thể mất vài giờ.'),
    h('li', null, 'Chỉ khi được xác nhận, phiên mới hoàn thành. Trong lúc chờ, phiên vẫn chạy bình thường.'),
    h('li', null, 'Xác nhận xong, bạn nhận công đức, hào quang và lời thông báo như một lượt cúng dường thường.'),
    h('li', null, `Tác dụng chỉ là rút ngắn thời gian: công lực không vượt trần ${NUM(M.CONG_LUC_MAX)}, và chỉ giúp bạn xong sớm, không làm bạn mạnh hơn trong trận (nội lực tối đa vẫn chỉ tăng theo cấp nội công).`),
    h('li', null, limitText));

  function speedCard(s) {
    const sc = st.speedup || {};
    if (!sc.enabled && !s.speedup) return null;
    const m = M.METHODS[s.methodId], price = s.price || (m && m.price) || 0;
    const card = h('section', { class: 'card dj-sp', 'aria-label': 'Hoàn thành ngay' }, h('div', { class: 'eyebrow' }, 'Hoàn thành ngay'));
    ui.spCard = card;
    if (s.speedup) add(card, pendingView(s));
    else {
      const left = Math.max(0, (sc.perDay || 0) - (sc.usedToday || 0)), used = left <= 0;
      add(card, [
        h('h3', { class: 'dj-h' }, `Cúng dường ${vnd(price)} để rút ngắn phiên này`),
        speedRules(vnd(price), `Mỗi ngày dùng tối đa ${sc.perDay || 0} lần, hôm nay bạn đã dùng ${sc.usedToday || 0}.`),
        used ? h('p', { class: 'warn' }, 'Hôm nay bạn đã dùng đủ lượt hoàn thành ngay. Mai thử lại, hoặc đợi phiên tự viên mãn.') : null,
        h('label', { class: 'dj-check' }, h('input', { type: 'checkbox', checked: anon ? '' : null, onchange: e => { anon = e.target.checked; } }), h('span', null, 'Ẩn danh (không hiện tên khi thông báo cúng dường)')),
        noteEl('speedup'),
        sendBtn(`Cúng dường ${vnd(price)} để hoàn thành ngay`, 'btn gold dj-wide', requestSpeedup, { disabled: used || !online(), 'data-locked': used ? '' : null, 'data-fk': 'sp:go' })]);
    }
    return card;
  }

  function pendingView(s) {
    const pd = s.speedup, info = sp && sp.code === pd.code ? sp : null;
    const test = !!(pd.test || (info && info.test));
    const qrOk = info && typeof info.qr === 'string' && (info.qr.indexOf('https://img.vietqr.io/') === 0 || (test && /^\/api\/donation-qr\/CD[A-Z0-9]{6}\.svg$/.test(info.qr)));
    const codeNode = h('span', { class: 'code' }, pd.code);
    const accNode = h('span', null, info ? String(info.account || '') : '');
    const kv = h('dl', { class: 'kv dj-kv' },
      h('dt', null, 'Số tiền'), h('dd', null, h('b', { class: 'dj-amt' }, vnd(pd.amount))),
      h('dt', null, test ? 'Mã thử nghiệm' : 'Nội dung chuyển khoản'), h('dd', { class: 'dj-copyrow' }, codeNode, copyBtn(pd.code, codeNode, test ? 'mã thử nghiệm' : 'nội dung chuyển khoản')),
      info && !test ? [
        h('dt', null, 'Ngân hàng'), h('dd', null, info.bank || ''),
        h('dt', null, 'Số tài khoản'), h('dd', { class: 'dj-copyrow' }, accNode, copyBtn(String(info.account || ''), accNode, 'số tài khoản')),
        h('dt', null, 'Chủ tài khoản'), h('dd', null, info.accountName || '—')
      ] : null);
    return h('div', { class: 'dj-pend' },
      h('p', { class: 'dj-wait dj-status', role: 'status' }, h('span', { class: 'spin', 'aria-hidden': 'true' }),
        h('b', null, test ? 'Thử nghiệm: đang chờ tự xác nhận sau 10 giây' : pd.bankReported ? 'Ngân hàng đã báo nhận, chờ Ban điều hành xác nhận' : 'Đang chờ Ban điều hành xác nhận')),
      h('div', { class: 'dj-qr' },
        qrOk ? h('img', { class: 'dj-qr-img', src: info.qr, alt: test ? 'Mã QR thử nghiệm, không dùng để chuyển tiền' : `Mã QR chuyển khoản ${vnd(pd.amount)}, nội dung ${pd.code}`, width: '220', height: '220' })
          : h('div', { class: 'dj-qr-none' }, spLoading ? 'Đang tải mã QR…' : test ? 'Đang chờ mã QR thử nghiệm.' : 'Chưa có mã QR, bạn vẫn chuyển khoản được theo thông tin bên cạnh.'),
        kv),
      !info && !spLoading ? h('p', { class: 'hint' }, test ? 'Chưa tải được mã thử nghiệm. ' : 'Chưa tải được thông tin ngân hàng. ', h('button', { type: 'button', class: 'dj-link', onclick: () => { sp = null; ensureSpeedInfo(); render(); } }, 'Tải lại')) : null,
      h('p', { class: 'hint' }, test ? 'Không cần quét hoặc chuyển tiền. Sau 10 giây hệ thống sẽ tự xác nhận thử nghiệm.' : 'Chuyển đúng số tiền và đúng nội dung để được xác nhận. Nếu phiên tự hết giờ trước khi được xác nhận, khoản cúng dường vẫn được nhận và đổi thành phiếu hoàn thành ngay cho phiên sau.'),
      noteEl('speedup'),
      pd.bankReported ? h('p', { class: 'hint' }, 'Ngân hàng đã báo nhận tiền nên không hủy yêu cầu được.') : spCancelBlock(test));
  }
  function copyBtn(text, node, what) {
    return h('button', { type: 'button', class: 'btn small dj-copy', 'aria-label': `Chép ${what}`, onclick: () => copyText(text, node, what) }, 'Chép');
  }
  function spCancelBlock(test) {
    if (!confirmSp) return h('div', { class: 'dj-acts' }, sendBtn('Hủy yêu cầu', 'btn small', () => { confirmSp = true; focusNext = 'sp:keep'; render(); }, { 'data-fk': 'sp:open' }));
    return h('div', { class: 'dj-confirm', role: 'group', 'aria-label': 'Xác nhận hủy yêu cầu hoàn thành ngay' },
      h('p', null, h('b', null, 'Hủy yêu cầu hoàn thành ngay?'), test ? ' Thao tác này sẽ hủy yêu cầu thử nghiệm.' : ' Nếu bạn đã chuyển khoản rồi thì đừng hủy, hãy đợi Ban điều hành xác nhận.'),
      h('div', { class: 'dj-acts' },
        h('button', { type: 'button', class: 'btn small', 'data-fk': 'sp:keep', onclick: () => { confirmSp = false; focusNext = 'sp:open'; render(); } }, 'Giữ yêu cầu'),
        sendBtn('Hủy yêu cầu', 'btn small dj-danger', cancelSpeedup, { 'data-fk': 'sp:yes' })));
  }

  /* ----- tab Võ học ----- */
  function voTab() {
    const p = st.profile, learned = learnedSet(p);
    return [
      h('section', { class: 'dj-intro-box' },
        h('p', { class: 'dj-intro' }, h('b', null, 'Học chiêu không tốn gì và không cần chờ.'), ' Đủ cấp nội công và tâm đắc của nhánh là lĩnh hội ngay. Không khóa phái: bạn có thể học cả ba nhánh.'),
        h('p', { class: 'hint' }, `Đã học ${learned.size}/${M.SKILL_LIST.length} chiêu.`),
        noteEl('learn')),
      M.BRANCH_ORDER.map(b => {
        const br = M.BRANCHES[b];
        return h('section', { class: 'dj-branch', style: { '--bc': br.color }, 'aria-label': `Nhánh ${br.name}` },
          h('header', { class: 'dj-branch-head' },
            h('span', { class: 'dj-branch-han', lang: 'zh', 'aria-hidden': 'true' }, br.han),
            h('div', null, h('h3', null, `Nhánh ${br.name}`), h('p', null, br.desc))),
          h('div', { class: 'dj-sgrid' }, M.SKILL_ORDER.filter(id => M.SKILLS[id].branch === b).map(id => skillCard(id, p, learned))));
      })
    ];
  }
  function skillCard(id, p, learned) {
    const s = M.SKILLS[id], br = M.BRANCHES[s.branch], has = learned.has(id), can = has ? null : M.canLearn(p, id);
    const state = has ? 'is-learned' : can.ok ? 'is-open' : 'is-locked';
    const statusText = has ? 'đã học' : can.ok ? 'học được' : 'chưa đủ điều kiện';
    const tamNow = (p.tam && p.tam[s.branch]) || 0;
    let foot = null;
    if (can && can.ok) {
      foot = sendBtn('Lĩnh hội', 'btn gold dj-wide', () => learn(id), { 'data-fk': 'learn:' + id, 'aria-label': `Lĩnh hội ${s.name}` });
    } else if (can) {
      foot = h('div', { class: 'dj-req' },
        h('p', { class: 'dj-req-t' }, ico('lock'), 'Còn thiếu'),
        h('ul', null, (can.missing || [can.reason]).map(t => h('li', null, t.charAt(0).toUpperCase() + t.slice(1)))),
        s.req.tam > 0 ? [h('p', { class: 'dj-req-b' }, `Tâm đắc ${br.name}: ${Math.min(tamNow, s.req.tam)}/${s.req.tam}`),
          bar(tamNow / s.req.tam, `Tâm đắc ${br.name} ${tamNow} trên ${s.req.tam} cần có`, br.color)] : null);
    }
    return h('article', {
      class: 'card dj-sk ' + state, style: { '--bc': br.color }, tabindex: '-1', 'data-fk': 'sk:' + id,
      'aria-label': `${s.name}, ${M.TIER_NAMES[s.tier]}, ${M.KIND_NAMES[s.kind]}, ${statusText}`
    },
      h('header', { class: 'dj-sk-head' },
        h('h4', null, s.name),
        has ? h('span', { class: 'dj-sk-st' }, ico('check'), 'Đã học') : null),
      h('p', { class: 'dj-sk-meta' }, `${M.TIER_NAMES[s.tier]} · ${M.KIND_NAMES[s.kind]}`),
      h('p', { class: 'dj-sk-short' }, s.short),
      h('p', { class: 'dj-sk-stats' }, M.statsLine(s)),
      h('p', { class: 'dj-sk-desc' }, s.desc),
      foot);
  }

  /* ----- tab Bộ chiêu ----- */
  function boTab() {
    const p = st.profile, learned = learnedSet(p), saved = (p.loadout || []).filter(id => learned.has(id));
    const same = sameArr(draft, saved) && saved.length === (p.loadout || []).length;
    const warns = draft.length === 4 ? (same && saveWarn ? saveWarn : M.loadoutWarnings(draft)) : [];
    const lib = M.SKILL_ORDER.filter(id => learned.has(id));
    const slots = [0, 1, 2, 3].map(i => {
      const id = draft[i], s = id && M.SKILLS[id];
      if (!s) return h('li', { class: 'dj-slot empty' }, h('i', { class: 'dj-slot-n', 'aria-hidden': 'true' }, String(i + 1)), h('span', null, 'Ô trống'));
      return h('li', { class: 'dj-slot filled', style: { '--bc': M.BRANCHES[s.branch].color } },
        h('button', { type: 'button', 'data-fk': 'slot:' + id, 'aria-label': `Ô ${i + 1}: ${s.name}. Chạm để bỏ khỏi bộ chiêu`, onclick: () => toggleSkill(id) },
          h('i', { class: 'dj-slot-n', 'aria-hidden': 'true' }, String(i + 1)),
          h('b', null, s.name),
          h('small', null, `${M.KIND_NAMES[s.kind]} · Nội lực ${s.mana}`)));
    });
    return [
      h('section', { class: 'dj-intro-box' },
        h('p', { class: 'dj-intro' }, h('b', null, 'Chọn đúng 4 chiêu trong số đã học.'), ` Bộ này là mặc định; vào trận vẫn đổi được trong sảnh ${M.PK.LOADOUT_SECONDS} giây.`),
        !(p.loadout || []).length ? h('p', { class: 'hint' }, 'Bạn chưa lưu bộ nào. Nếu vào trận mà chưa lưu, hệ thống ghép 4 chiêu đã học theo thứ tự nhập môn.') : null),
      h('section', { class: 'dj-loadout', 'aria-label': 'Bộ chiêu đang chọn' },
        h('div', { class: 'dj-lo-head' }, h('h3', { class: 'dj-h' }, 'Bộ chiêu'), h('span', { class: 'dj-lo-n' }, `Đã chọn ${draft.length}/4`)),
        h('ol', { class: 'dj-slots' }, slots),
        warns.length ? h('ul', { class: 'dj-warns' }, warns.map(w => h('li', { class: 'warn' }, ico('warn'), h('span', null, w.text)))) : null,
        noteEl('loadout'),
        h('div', { class: 'dj-acts wrap' },
          h('button', { type: 'button', class: 'btn gold', 'data-fk': 'suggest', onclick: () => { draft = suggest(lib); saveWarn = null; delete notes.loadout; say('Đã gợi ý bộ chiêu. Bấm Lưu bộ chiêu nếu bạn đồng ý.'); focusNext = 'suggest'; render(); } }, 'Gợi ý'),
          draft.length ? h('button', { type: 'button', class: 'btn', 'data-fk': 'clear', onclick: () => { draft = []; saveWarn = null; delete notes.loadout; focusNext = 'clear'; render(); } }, 'Bỏ hết') : null),
        draft.length !== 4 ? h('p', { class: 'hint' }, draft.length ? `Chọn thêm ${4 - draft.length} chiêu nữa mới lưu được.` : 'Chọn 4 chiêu bên dưới, hoặc bấm Gợi ý.') : null),
      h('section', { class: 'dj-lib', 'aria-label': 'Kho chiêu đã học' },
        h('h3', { class: 'dj-h' }, `Kho chiêu đã học (${lib.length})`),
        h('div', { class: 'dj-libgrid' }, lib.map(id => libCard(id)))),
      h('div', { class: 'dj-savebar' },
        h('span', { class: 'dj-savebar-n' }, `Đã chọn ${draft.length}/4`, warns.length ? h('em', null, ' · có cảnh báo') : null),
        sendBtn(same && draft.length === 4 ? 'Đã lưu bộ chiêu' : 'Lưu bộ chiêu', 'btn primary', saveLoadout, { disabled: draft.length !== 4 || same || !online(), 'data-locked': draft.length !== 4 || same ? '' : null, 'data-fk': 'save' }))
    ];
  }
  function libCard(id) {
    const s = M.SKILLS[id], br = M.BRANCHES[s.branch], i = draft.indexOf(id), on = i >= 0;
    return h('button', {
      type: 'button', class: 'dj-lc' + (on ? ' on' : ''), style: { '--bc': br.color }, 'aria-pressed': on ? 'true' : 'false', 'data-fk': 'lib:' + id,
      'aria-label': `${s.name}, nhánh ${br.name}, ${M.KIND_NAMES[s.kind]}, ${M.statsLine(s)}${on ? `. Đang ở ô ${i + 1}` : ''}`, onclick: () => toggleSkill(id)
    },
      h('span', { class: 'dj-lc-top' }, h('b', null, s.name), on ? h('span', { class: 'dj-lc-pos' }, ico('check'), `Ô ${i + 1}`) : null),
      h('small', { class: 'dj-lc-meta' }, `${br.name} · ${M.KIND_NAMES[s.kind]} · ${M.TIER_NAMES[s.tier]}`),
      h('small', { class: 'dj-lc-stats' }, M.statsLine(s)));
  }

  /* ----- luật tu luyện ----- */
  function rulesNode() {
    const prices = M.METHOD_LIST.map(m => m.price);
    const lv = M.LEVEL_AT.map((c, i) => h('tr', null, h('td', null, String(i + 1)), h('td', null, NUM(c)), h('td', null, String(M.manaMaxOf(i + 1)))));
    const req = [1, 2, 3, 4].map(t => h('tr', null, h('td', null, M.TIER_NAMES[t]), h('td', null, `Cấp ${M.TIER_REQ[t].level}`), h('td', null, t === 1 ? 'Không cần' : `${M.TIER_REQ[t].tam} tâm đắc nhánh đó`)));
    return h('details', { class: 'card dj-rules' },
      h('summary', null, 'Luật tu luyện'),
      h('div', { class: 'dj-rules-body' },
        h('h4', null, 'Tu luyện theo giờ máy chủ'),
        h('p', null, 'Chọn công pháp và thời lượng rồi bắt đầu. Bạn có thể đóng web: hết giờ máy chủ tự ghi nhận kết quả. Mỗi lúc chỉ có một phiên. Hủy phiên là mất hết tiến độ phiên đó.'),
        h('h4', null, 'Công lực và cấp nội công'),
        h('p', null, `Công lực có trần ${NUM(M.CONG_LUC_MAX)}. Đủ mốc thì lên cấp (tối đa cấp ${M.LEVEL_MAX}). Cấp càng cao, nội lực tối đa trong trận càng nhiều: ${M.MANA_BASE} ở cấp 1, thêm ${M.MANA_PER_LEVEL} mỗi cấp.`),
        h('table', { class: 'dj-tbl' }, h('caption', { class: 'sr' }, 'Cấp nội công, công lực cần có và nội lực tối đa'),
          h('thead', null, h('tr', null, h('th', { scope: 'col' }, 'Cấp'), h('th', { scope: 'col' }, 'Công lực từ'), h('th', { scope: 'col' }, 'Nội lực tối đa'))), h('tbody', null, lv)),
        h('h4', null, 'Tâm đắc'),
        h('p', null, `Mỗi nhánh (Cương, Tốc, Nhu) có điểm tâm đắc riêng, tối đa ${M.TAM_MAX}. Công pháp thuộc nhánh nào thì cộng tâm đắc nhánh đó; công pháp thông cả ba nhánh cộng cho cả ba.`),
        h('h4', null, 'Học chiêu'),
        h('p', null, 'Học chiêu không tốn gì và không cần chờ, chỉ cần đủ cấp nội công và tâm đắc của nhánh. Không khóa phái, bạn học được cả ba nhánh. Mỗi bộ chiêu mang vào trận gồm đúng 4 chiêu.'),
        h('table', { class: 'dj-tbl' }, h('caption', { class: 'sr' }, 'Điều kiện học chiêu theo bậc'),
          h('thead', null, h('tr', null, h('th', { scope: 'col' }, 'Bậc'), h('th', { scope: 'col' }, 'Nội công'), h('th', { scope: 'col' }, 'Tâm đắc'))), h('tbody', null, req)),
        h('h4', null, 'Hoàn thành ngay'),
        speedRules(`số tiền ghi trên phiên tu (từ ${vnd(Math.min(...prices))} đến ${vnd(Math.max(...prices))} tùy công pháp)`, 'Mỗi ngày chỉ dùng được một số lần nhất định, số lần còn lại ghi ngay trên phiên tu.'),
        h('p', { class: 'hint' }, 'Phiếu hoàn thành ngay: nếu phiên tự hết giờ trước khi khoản cúng dường được xác nhận, khoản đó đổi thành một phiếu dùng cho phiên sau.'),
        h('h4', null, 'Ở đâu đánh nhau'),
        h('p', null, 'Nơi này chỉ để tu luyện. Muốn luận võ, hãy ra Sân đấu.')));
  }

  /* ---------- vòng đời ---------- */
  function init(h_) {
    host = h_; sock = h_.socket;
    sock.on('tu:update', onUpdate);
    sock.on('connect', onNet);
    sock.on('disconnect', onNet);
    document.addEventListener('visibilitychange', () => { if (visible && !document.hidden) tick(); });
  }
  function show() {
    if (!mounted) return;
    const resume = visible;
    visible = true;
    stopTimers();
    if (!resume) {
      notes = {}; celeb = []; celebFresh = false; confirmCancel = false; confirmSp = false; busy = ''; endTries = 0;
      const saved = store.get();
      if (TABS.some(t => t.id === saved)) tab = saved;
    }
    loading = false; again = false; spLoading = false;
    tickT = setInterval(tick, 1000);
    render();
    refresh();
  }
  function hide() {
    visible = false; busy = ''; loading = false; again = false; spLoading = false;
    stopTimers();
  }

  root.Dojo = { init, mount, show, hide, refresh };
})(this);
