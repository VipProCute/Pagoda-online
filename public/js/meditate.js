/*
 * Tọa thiền trên bồ đoàn ở Tàng Kinh Các: bảng nhỏ nổi trên cảnh để chọn công pháp và theo dõi phiên tu.
 * Dùng chung giao thức với Võ Học Các (martial:state, tu:start). Phiên tu chạy theo giờ máy chủ, nên đứng dậy
 * hay đóng web vẫn tu tiếp. Hủy phiên, hoàn thành ngay, học chiêu: vào Võ Học Các.
 *   Meditate.init(host) · open(seat) · close() · refresh() · isOpen()
 * host: { socket, el, toast, serverNow, cfg(), login(), stand(), dojo() }
 */
(function (root) {
  'use strict';
  const M = root.MARTIAL, ACK_MS = 12000;
  let host = null, sock = null, box = null, st = null, err = '', busy = false, seat = -1, mini = false, touched = false, tickT = 0, req = 0;
  const ui = {};

  const NUM = n => Number(n || 0).toLocaleString('vi-VN');
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const durText = min => { const h = Math.floor(min / 60), m = min % 60; return h === 0 ? `${m} phút` : m === 0 ? `${h} giờ` : `${h} giờ ${m} phút`; };
  function clockText(ms) {
    const s = Math.max(0, Math.ceil(ms / 1000)), p2 = n => String(n).padStart(2, '0');
    const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60;
    return h > 0 ? `${h}:${p2(m)}:${p2(s % 60)}` : `${p2(m)}:${p2(s % 60)}`;
  }
  function add(e, c) {
    if (c == null || c === false) return;
    if (Array.isArray(c)) c.forEach(x => add(e, x));
    else e.appendChild(c.nodeType ? c : document.createTextNode(String(c)));
  }
  /** h(thẻ, thuộc tính, ...con): chữ luôn đi qua text node. */
  function h(tag, props) {
    const e = document.createElement(tag);
    for (const k in props || {}) {
      const v = props[k];
      if (v == null || v === false) continue;
      if (k === 'class') e.className = v;
      else if (k === 'style') for (const s in v) e.style.setProperty(s, v[s]);
      else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? '' : v);
    }
    for (let i = 2; i < arguments.length; i++) add(e, arguments[i]);
    return e;
  }
  const online = () => !!sock && sock.connected !== false;
  const cfg = () => { try { return (host.cfg && host.cfg()) || {}; } catch (e) { return {}; } };
  const closed = () => (cfg().martial && cfg().martial.enabled === false) || (st && st.enabled === false);
  const guest = () => !!(st && st.login && st.login.required && !st.login.signedIn);

  function ask(ev, data, cb) {
    let done = false;
    const t = setTimeout(() => fin({ ok: false, reason: 'Máy chủ chưa trả lời, bạn thử lại nhé.' }), ACK_MS);
    function fin(a) { if (done) return; done = true; clearTimeout(t); cb(a && typeof a === 'object' ? a : { ok: false, reason: 'Máy chủ trả lời không rõ.' }); }
    try { sock.emit(ev, data, fin); } catch (e) { fin({ ok: false, reason: 'Chưa gửi được, bạn thử lại nhé.' }); }
  }
  function refresh() {
    if (seat < 0) return;
    if (!online()) { err = 'Mất kết nối, đang thử lại…'; render(); return; }
    const my = ++req;
    ask('martial:state', {}, a => {
      if (my !== req || seat < 0) return;
      if (a.ok) { if (!st && a.session && !touched) mini = true; st = a; err = ''; } else err = a.reason || 'Chưa tải được, bạn thử lại nhé.';
      render();
    });
  }
  function start(m, d) {
    if (busy || !online()) return;
    busy = true; render();
    ask('tu:start', { methodId: m.id, duration: d.key }, a => {
      busy = false;
      if (a.ok) { if (st) st.session = a.session; mini = true; host.toast(`Bắt đầu tu ${m.name} (${durText(d.minutes)}). Đứng dậy hay đóng web vẫn tu tiếp.`); }
      else host.toast(a.reason || 'Chưa bắt đầu được, bạn thử lại nhé.');
      render(); refresh();
    });
  }

  /* ---------- dựng bảng ---------- */
  function head() {
    const s = st && st.session, m = s && M.METHODS[s.methodId];
    const title = m ? `Đang tu ${m.name}` : 'Tọa thiền';
    if (s && mini) { ui.cd = h('span', { class: 'md-cdmini', role: 'timer' }, ''); ui.sess = s; }
    return h('div', { class: 'md-head' },
      h('div', { class: 'md-ttl' }, h('span', { class: 'eyebrow' }, `Bồ đoàn số ${seat + 1}`, s && mini ? ' · còn ' : '', s && mini ? ui.cd : null), h('b', null, title)),
      h('button', { type: 'button', class: 'md-min', 'aria-label': mini ? 'Mở rộng bảng tọa thiền' : 'Thu nhỏ bảng tọa thiền', 'aria-expanded': String(!mini), onclick: () => { mini = !mini; touched = true; render(); } }, mini ? '▴' : '▾'),
      h('button', { type: 'button', class: 'btn small md-stand', onclick: () => host.stand() }, 'Đứng dậy'));
  }
  function sessionView(s) {
    const m = M.METHODS[s.methodId] || { name: s.methodId, han: '' }, d = (m.durations || []).find(x => x.key === s.durationKey);
    const p = st.profile, raw = M.rewardOf(s.methodId, s.durationKey), real = p ? M.clampReward(p, raw) : raw;
    const br = m.branch && M.BRANCHES[m.branch];
    ui.cd = h('b', { class: 'md-cd', role: 'timer' }, '');
    ui.fill = h('i');
    ui.bar = h('div', { class: 'md-bar', role: 'progressbar', 'aria-label': 'Tiến độ phiên tu', 'aria-valuemin': '0', 'aria-valuemax': '100' }, ui.fill);
    ui.sess = s;
    tick();
    return [
      h('div', { class: 'md-sess', style: { '--bc': br ? br.color : 'var(--gold)' } },
        h('div', { class: 'md-sess-top' }, h('span', { class: 'md-han', lang: 'zh', 'aria-hidden': 'true' }, m.han || ''), ui.cd),
        ui.bar,
        h('p', { class: 'md-gain' }, [d ? durText(d.minutes) : '', real && real.congLuc > 0 ? `+${real.congLuc} công lực khi viên mãn` : 'Công lực đã đầy'].filter(Boolean).join(' · '))),
      h('p', { class: 'hint' }, 'Đứng dậy hay đóng web vẫn tu tiếp, hết giờ máy chủ tự ghi nhận. Hủy phiên hoặc hoàn thành ngay ở Võ Học Các.'),
      h('div', { class: 'md-row' }, h('button', { type: 'button', class: 'btn small', onclick: () => host.dojo() }, 'Mở Võ Học Các'))];
  }
  function methodsView() {
    const p = st.profile, out = [];
    out.push(h('p', { class: 'md-prof' }, `Nội công cấp ${p.level} · công lực ${NUM(p.congLuc)}${p.levelTo != null ? ' / ' + NUM(p.levelTo) : ' (viên mãn)'}`));
    out.push(h('p', { class: 'md-intro md-tip' }, 'Chọn thời gian để bắt đầu tu. Linh khí sẽ tụ quanh bạn, ai trong Tàng Kinh Các cũng thấy.'));
    const list = h('div', { class: 'md-list' }), locked = [];
    for (const m of M.METHOD_LIST) {
      const can = M.canCultivate(p, m.id), br = m.branch && M.BRANCHES[m.branch];
      if (!can.ok) { locked.push(m); continue; }       // công pháp chưa mở: gộp một dòng bên dưới cho gọn
      const row = h('div', { class: 'md-m' + (can.ok ? '' : ' is-locked'), style: { '--bc': br ? br.color : m.branch === 'all' ? 'var(--gold)' : 'var(--muted)' } },
        h('div', { class: 'md-m-name' }, h('i', { class: 'md-dot', 'aria-hidden': 'true' }), h('b', null, m.name), h('span', { class: 'md-han', lang: 'zh', 'aria-hidden': 'true' }, m.han)),
        null);
      const durs = h('div', { class: 'md-durs', role: 'group', 'aria-label': `Thời gian tu ${m.name}` });
      for (const d of m.durations) {
        const r = M.clampReward(p, M.rewardOf(m.id, d.key));
        durs.appendChild(h('button', {
          type: 'button', class: 'md-dur', disabled: !can.ok || busy || !online(),
          'aria-label': `Tu ${m.name} ${durText(d.minutes)}, ${r.congLuc > 0 ? 'được ' + r.congLuc + ' công lực' : 'công lực đã đầy'}`,
          onclick: () => start(m, d)
        }, h('b', null, durText(d.minutes)), h('small', null, r.congLuc > 0 ? `+${r.congLuc}` : 'đầy')));
      }
      row.appendChild(durs);
      list.appendChild(row);
    }
    out.push(list);
    if (locked.length) out.push(h('p', { class: 'hint md-locked' }, 'Chưa mở: ' + locked.map(m => `${m.name} (cấp ${m.reqLevel})`).join(', ') + '.'));
    return out;
  }
  function body() {
    if (err && !st) return [h('p', { class: 'warn' }, err), h('button', { type: 'button', class: 'btn small', onclick: refresh }, 'Thử lại')];
    if (closed()) return [h('p', { class: 'md-intro' }, 'Tu luyện nội công chưa mở. Bạn cứ ngồi tĩnh tâm, hít thở chậm.')];
    if (!st) return [h('p', { class: 'md-intro' }, h('span', { class: 'spin', 'aria-hidden': 'true' }), ' Đang mở…')];
    if (guest()) return [
      h('p', { class: 'md-intro' }, 'Bạn đang tĩnh tọa. Đăng nhập Google để tu luyện nội công: công lực và tâm đắc được lưu vào tài khoản, dùng khi luận võ ở Sân đấu.'),
      h('button', { type: 'button', class: 'btn primary', onclick: () => host.login() }, 'Đăng nhập Google')];
    const out = err ? [h('p', { class: 'warn' }, err)] : [];
    return out.concat(st.session ? sessionView(st.session) : methodsView());
  }
  function render() {
    if (!box) return;
    ui.cd = ui.fill = ui.bar = ui.sess = null;
    box.hidden = seat < 0;
    if (seat < 0) return;
    box.classList.toggle('mini', mini);
    const kids = [head()];
    if (!mini) kids.push(h('div', { class: 'md-body' }, body()));
    box.replaceChildren(...kids);
    tick();
  }
  function tick() {
    const s = ui.sess;
    if (!s || !ui.cd) return;
    const now = host.serverNow(), left = s.endsAt - now, pct = clamp((now - s.startedAt) / Math.max(1, s.endsAt - s.startedAt), 0, 1);
    ui.cd.textContent = clockText(left);
    if (ui.fill) { ui.fill.style.width = (pct * 100).toFixed(1) + '%'; ui.bar.setAttribute('aria-valuenow', String(Math.round(pct * 100))); }
    if (left <= -2500 && !tick.wait) { tick.wait = true; setTimeout(() => { tick.wait = false; refresh(); }, 2500); }
  }

  /* ---------- vòng đời ---------- */
  function init(h_) {
    host = h_; sock = h_.socket; box = h_.el;
    box.setAttribute('role', 'region'); box.setAttribute('aria-label', 'Tọa thiền trên bồ đoàn');
    sock.on('tu:update', () => { if (seat >= 0) refresh(); });
    sock.on('connect', () => { if (seat >= 0) refresh(); });
  }
  function open(i) {
    if (seat === i) return;
    seat = i; mini = false; touched = false; err = ''; busy = false;
    render(); refresh();
    clearInterval(tickT); tickT = setInterval(tick, 1000);
  }
  function close() {
    seat = -1; st = null; req++; clearInterval(tickT); tickT = 0;
    render();
  }

  root.Meditate = { init, open, close, refresh, isOpen: () => seat >= 0 };
})(this);
