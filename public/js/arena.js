/*
 * Sân đấu: nơi DUY NHẤT luận võ 1 đấu 1 (chánh điện không có đánh nhau).
 * Màn: sân (danh sách, mời) → sảnh chọn bộ chiêu → trận → lật chiêu → kết quả → về sân.
 * Giao thức: docs/VO-HOC-GIAO-THUC.md mục 4 và 6. Trước pk:reveal giao diện không có, không dựng gì về chiêu đối thủ chọn.
 * API: Arena.init(host) · mount(el) · show(info) · hide() · inMatch()
 */
(function (root) {
  'use strict';
  const M = root.MARTIAL, TAU = Math.PI * 2;
  const RAGE_MAX = 100, EXPOSED_PCT = 25, KC_PCT = 25, KC_TURNS = 2;       // khớp lib/pk/rules.js
  const ST = { free: ['Rảnh', 'free'], busy: ['Đang đấu', 'busy'], dnd: ['Tạm nghỉ', 'dnd'] };
  const MODES = {
    balanced: { name: 'Phòng cân bằng', desc: 'Không buff. Chỉ chiêu thức, nội công và cách chọn chiêu quyết định thắng thua.' },
    buff: { name: 'Phòng có buff', desc: 'Pháp tướng, quỷ ám và hào quang cúng dường có tác dụng. Hai bên thấy buff của nhau trước khi nhận lời.' }
  };
  const STANCE = { atk: 'Công', release: 'Đòn tụ lực', guard: 'Thủ', dodge: 'Né', parry: 'Đỡ', charge: 'Tụ lực', rest: 'Điều tức', idle: 'Đứng yên' };
  const CLOSED_OUT = {
    declined: n => `${n} đã từ chối lời mời. Bạn mời lại được sau 5 phút.`,
    expired: n => `${n} chưa trả lời, lời mời đã hết hạn.`,
    busy: n => `${n} đang bận, chưa nhận lời mời được.`,
    left: n => `${n} đã rời sân.`
  };
  const CLOSED_IN = {
    cancelled: n => `${n} đã hủy lời mời.`,
    expired: n => `Lời mời của ${n} đã hết hạn.`,
    busy: n => `Lời mời của ${n} đã đóng vì có trận khác.`,
    left: n => `${n} đã rời sân.`
  };
  const DEF_LOOK = { c: 0, g: 'nu', h: 0 };

  const S = {
    host: null, sock: null, el: null, ui: null, mounted: false, visible: false, connected: true,
    players: new Map(), rows: new Map(), dnd: false, dndBusy: false, invites: [], out: null, lastMode: 'balanced',
    screen: 'roster', m: null, tick: 0, raf: 0, last: 0, pt: [], stage: null, fx: [], hold: { you: null, op: null }, floats: 0,
    dlg: { pid: 0, blockPid: 0 }
  };

  /* ---------- tiện ích ---------- */
  const reduced = () => !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const dpr = () => Math.min(2, root.devicePixelRatio || 1);
  const h = (tag, cls, text, attrs) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    if (attrs) for (const k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  };
  const add = (p, ...kids) => { for (const k of kids) if (k) p.appendChild(k); return p; };
  const clear = n => { while (n.firstChild) n.removeChild(n.firstChild); return n; };
  const btn = (cls, text, attrs) => h('button', cls, text, Object.assign({ type: 'button' }, attrs));
  const secs = ms => Math.max(0, Math.ceil(ms / 1000));
  const pc = x => Math.round(x * 100);
  const num = (v, d) => (Number.isFinite(+v) ? +v : d || 0);
  const nowMs = () => S.host.serverNow();
  const toast = t => { try { S.host.toast(t); } catch (e) { /* bỏ qua */ } };
  const canSend = () => S.connected && !!S.sock;
  const skillOf = id => M.SKILLS[id] || M.SPECIAL[id] || null;
  const skillName = id => (skillOf(id) || {}).name || String(id || '');
  const branchOf = s => (s && M.BRANCHES[s.branch]) || null;
  const lookOf = l => (l && typeof l === 'object' ? l : DEF_LOOK);
  const svgIcon = (cls, html, size) => { const s = h('span', cls, null, { 'aria-hidden': 'true' }); s.innerHTML = `<svg width="${size || 14}" height="${size || 14}" viewBox="0 0 24 24">${html}</svg>`; return s; };
  const ICON_LOCK = '<rect x="5" y="11" width="14" height="9" rx="2" fill="currentColor"/><path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" stroke-width="2"/>';
  const say = t => { if (S.ui) S.ui.live.textContent = t; };
  function fail(ack, fb) {
    const r = (ack && ack.reason) || fb || 'Chưa làm được, thử lại nhé.';
    toast(r);
    if (ack && ack.code === 'login') setLogin(true);
    return r;
  }

  /* ---------- vẽ canvas ---------- */
  function avatar(c, look, o) {
    const Hl = root.Hall;
    if (Hl && Hl.avatar) { try { Hl.avatar(c, lookOf(look), o); return; } catch (e) { /* vẽ hình đơn giản bên dưới */ } }
    c.save();
    c.fillStyle = 'rgba(0,0,0,.3)'; c.beginPath(); c.ellipse(0, 0, 16, 4, 0, 0, TAU); c.fill();
    c.fillStyle = '#b5302a'; c.beginPath(); c.moveTo(-10, -55); c.lineTo(10, -55); c.lineTo(15, -8); c.lineTo(-15, -8); c.closePath(); c.fill();
    c.fillStyle = '#f0c9a4'; c.beginPath(); c.arc(0, -66, 10, 0, TAU); c.fill();
    c.fillStyle = '#1f1612'; c.beginPath(); c.arc(0, -69, 10, Math.PI, 0); c.fill();
    c.restore();
  }
  /** Chân dung: có buff thì dùng hào quang / pháp tướng / quỷ của Hall, không thì nhân vật trên nền tối. */
  function paintPortrait(p, t) {
    const cv = p.cv, r = cv.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) return false;
    const k = dpr(), pw = Math.round(r.width * k), ph = Math.round(r.height * k);
    if (cv.width !== pw || cv.height !== ph) { cv.width = pw; cv.height = ph; }
    const Hl = root.Hall, b = p.buff;
    if (b && Hl) {
      try {
        if ((b.Lc || b.Lq) && Hl.meritPreview) { Hl.meritPreview(cv, lookOf(p.look), b.Lc | 0, b.Lq | 0, t); return true; }
        if (b.Ld && Hl.auraPreview) { Hl.auraPreview(cv, lookOf(p.look), b.Ld | 0, t); return true; }
      } catch (e) { /* rơi về hình đơn giản */ }
    }
    const c = cv.getContext('2d');
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, pw, ph);
    const gr = c.createRadialGradient(pw / 2, ph * 0.6, 4, pw / 2, ph * 0.55, pw * 0.9);
    gr.addColorStop(0, '#3a1d10'); gr.addColorStop(1, '#0d0705');
    c.fillStyle = gr; c.fillRect(0, 0, pw, ph);
    const s = ph / 118;
    c.save(); c.translate(pw / 2, ph * 0.93); c.scale(s, s); avatar(c, p.look, { front: true, t }); c.restore();
    return true;
  }
  const hasFx = b => !!(b && (b.Lc || b.Lq || b.Ld));
  function portrait(cls, look, buff, scope) {
    const cv = h('canvas', cls, null, { 'aria-hidden': 'true' }), p = { cv, look, buff: hasFx(buff) ? buff : null, scope, fx: hasFx(buff), done: false };
    if (scope) S.pt.push(p);
    return p;
  }
  const dropPaint = scope => { S.pt = S.pt.filter(p => p.scope !== scope); };

  /* sân khấu trận: hai nhân vật đối diện, mình ở trước (quay lưng), đối thủ ở xa (quay mặt) */
  function drawStage(ts) {
    const st = S.stage;
    if (!st) return;
    const still = reduced();
    if (still && !st.dirty) return;
    st.dirty = false;
    const cv = st.cv, r = cv.getBoundingClientRect();
    if (r.width < 8 || r.height < 8) return;
    const k = dpr(), W = Math.round(r.width), H = Math.round(r.height);
    if (cv.width !== Math.round(W * k) || cv.height !== Math.round(H * k)) { cv.width = Math.round(W * k); cv.height = Math.round(H * k); }
    const c = st.c || (st.c = cv.getContext('2d'));
    c.setTransform(k, 0, 0, k, 0, 0); c.clearRect(0, 0, W, H);
    const hz = H * 0.56, g1 = c.createLinearGradient(0, 0, 0, H);
    g1.addColorStop(0, '#1a0f0a'); g1.addColorStop(hz / H, '#2b1911'); g1.addColorStop(hz / H, '#3a2519'); g1.addColorStop(1, '#190d08');
    c.fillStyle = g1; c.fillRect(0, 0, W, H);
    for (const lx of [0.14, 0.86]) {                                   // đèn lồng hắt sáng lên tường
      const lg = c.createRadialGradient(W * lx, hz * 0.5, 2, W * lx, hz * 0.5, W * 0.3);
      lg.addColorStop(0, 'rgba(236,160,80,.22)'); lg.addColorStop(1, 'rgba(236,160,80,0)');
      c.fillStyle = lg; c.fillRect(0, 0, W, hz);
    }
    c.strokeStyle = 'rgba(212,171,82,.1)'; c.lineWidth = 1; c.beginPath();
    for (let i = -7; i <= 7; i++) { c.moveTo(W / 2 + i * W * 0.025, hz); c.lineTo(W / 2 + i * W * 0.16, H); }
    for (let j = 1; j <= 4; j++) { const y = hz + (H - hz) * Math.pow(j / 4, 1.6); c.moveTo(0, y); c.lineTo(W, y); }
    c.stroke();
    c.strokeStyle = 'rgba(212,171,82,.3)'; c.lineWidth = 1.5; c.beginPath(); c.ellipse(W / 2, H * 0.8, W * 0.43, H * 0.14, 0, 0, TAU); c.stroke();
    const base = Math.min(H / 128, W / 240), tNow = still ? 0 : ts / 1000;
    const G = { you: { x: W * 0.27, y: H * 0.94, s: base, front: false, dir: 1 }, op: { x: W * 0.73, y: H * 0.8, s: base * 0.86, front: true, dir: -1 } };
    const span = G.op.x - G.you.x, m = S.m;
    for (const side of ['op', 'you']) {
      const g = G[side], P = poseOf(side, ts, span, g.dir), look = m && m[side] ? m[side].look : DEF_LOOK;
      if (P.glow) {
        const pl = still ? 1 : 0.8 + 0.2 * Math.sin(tNow * 5), rg = c.createRadialGradient(g.x, g.y - 50 * g.s, 4, g.x, g.y - 50 * g.s, 70 * g.s * pl);
        rg.addColorStop(0, 'rgba(240,200,110,.55)'); rg.addColorStop(1, 'rgba(240,200,110,0)');
        c.fillStyle = rg; c.fillRect(g.x - 90 * g.s, g.y - 130 * g.s, 180 * g.s, 150 * g.s);
      }
      if (P.ghost > 0.05) {
        c.save(); c.globalAlpha = 0.32 * P.ghost; c.translate(g.x + P.dx - g.dir * 16 * g.s, g.y + P.dy); c.scale(g.s, g.s); avatar(c, look, { front: g.front, t: tNow }); c.restore();
      }
      c.save(); c.translate(g.x + P.dx, g.y + P.dy); c.rotate(P.rot); c.scale(g.s, g.s);
      avatar(c, look, { front: g.front, t: tNow + (side === 'op' ? 1.7 : 0), bow: P.bow });
      c.restore();
      if (P.shield) {
        c.save(); c.translate(g.x + g.dir * 16 * g.s, g.y - 50 * g.s); c.scale(g.dir, 1);
        c.strokeStyle = 'rgba(232,196,119,.85)'; c.lineWidth = 3 * g.s; c.fillStyle = 'rgba(232,196,119,.1)';
        c.beginPath(); c.arc(0, 0, 36 * g.s, -1.05, 1.05); c.stroke();
        c.beginPath(); c.arc(0, 0, 36 * g.s, -1.05, 1.05); c.lineTo(0, 0); c.closePath(); c.fill();
        c.restore();
      }
      if (P.hit > 0.05) {
        const cx = g.x, cy = g.y - 55 * g.s, rr = 26 * g.s * P.hit;
        const rg = c.createRadialGradient(cx, cy, 1, cx, cy, rr * 1.6);
        rg.addColorStop(0, 'rgba(255,230,190,.9)'); rg.addColorStop(0.4, 'rgba(236,90,70,.55)'); rg.addColorStop(1, 'rgba(236,90,70,0)');
        c.fillStyle = rg; c.fillRect(cx - rr * 2, cy - rr * 2, rr * 4, rr * 4);
        c.fillStyle = 'rgba(255,245,220,.95)'; c.beginPath();
        for (let i = 0; i < 16; i++) { const a = i * TAU / 16 + 0.3, rad = i % 2 ? rr * 0.35 : rr; c.lineTo(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad); }
        c.closePath(); c.fill();
      }
      if (P.spark > 0.05) {
        c.strokeStyle = `rgba(240,210,130,${0.9 * (1 - P.spark * 0.4)})`; c.lineWidth = 2.5;
        c.beginPath(); c.arc(g.x + g.dir * 20 * g.s, g.y - 52 * g.s, (10 + 26 * (1 - Math.abs(P.spark - 0.5))) * g.s, 0, TAU); c.stroke();
      }
    }
  }
  /** Tư thế của một bên: nắm giữ (thủ, tụ lực, nghỉ) và các cử động ngắn đang chạy. */
  function poseOf(side, ts, span, dir) {
    const P = { dx: 0, dy: 0, rot: 0, ghost: 0, hit: 0, spark: 0, shield: 0, glow: 0, bow: 0 }, hold = S.hold[side];
    if (hold === 'guard') P.shield = 1; else if (hold === 'charge') P.glow = 1; else if (hold === 'rest') P.bow = 0.55;
    if (reduced()) return P;
    for (const a of S.fx) {
      if (a.side !== side) continue;
      const p = (ts - a.t0) / a.dur;
      if (p < 0 || p > 1) continue;
      const b = Math.sin(Math.PI * p);
      if (a.type === 'atk') P.dx += dir * span * 0.3 * b;
      else if (a.type === 'hit') { P.dx -= dir * span * 0.05 * b; P.hit = Math.max(P.hit, b); }
      else if (a.type === 'dodge') { P.rot = -dir * 0.3 * b; P.dx -= dir * span * 0.07 * b; P.ghost = Math.max(P.ghost, b); }
      else if (a.type === 'parry') { P.spark = Math.max(P.spark, b); P.dx -= dir * span * 0.02 * b; }
    }
    return P;
  }
  const anim = (side, type, dur) => { if (reduced()) return; S.fx.push({ side, type, t0: performance.now(), dur: dur || 380 }); if (S.fx.length > 40) S.fx.splice(0, S.fx.length - 40); };
  const dirtyStage = () => { if (S.stage) S.stage.dirty = true; };

  function paintLoop(ts) {
    S.raf = requestAnimationFrame(paintLoop);
    if (!S.visible || ts - S.last < 33) return;
    S.last = ts;
    const still = reduced();
    for (const p of S.pt) {
      if (p.fx && !still) { if (ts - (p.at || 0) >= 66) { p.at = ts; paintPortrait(p, ts / 1000); } }   // chân dung hiệu ứng nặng: 15 hình/giây
      else if (!p.done) p.done = paintPortrait(p, 0);
    }
    if (S.screen === 'match') drawStage(ts);
    S.fx = S.fx.filter(a => ts - a.t0 < a.dur + 60);
  }
  const startPaint = () => { if (!S.raf) S.raf = requestAnimationFrame(paintLoop); };
  const stopPaint = () => { if (S.raf) cancelAnimationFrame(S.raf); S.raf = 0; };

  /* ---------- dựng khung ---------- */
  let dlgSeq = 0;
  function mkDlg(title, sub) {
    const id = 'ar-dlg-' + (++dlgSeq), dlg = h('dialog', 'dlg ar-dlg', null, { 'aria-labelledby': id }), body = h('form', 'dlg-body', null, { method: 'dialog' });
    const head = h('div', 'dlg-head'), tt = h('div'), h2 = h('h2', null, title, { id }), p = h('p', null, sub || ''), x = btn('x', '×', { 'aria-label': 'Đóng' });
    add(tt, h2, p); add(head, tt, x); add(body, head); add(dlg, body);
    x.addEventListener('click', () => dlg.close());
    dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
    const warn = h('p', 'warn', null, { role: 'status' });
    warn.hidden = true;
    return { dlg, body, h2, sub: p, warn, foot: h('div', 'dlg-foot') };
  }
  const openDlg = d => { if (!d.open) { try { d.showModal(); } catch (e) { d.setAttribute('open', ''); } } };
  const closeAllDlg = () => { if (S.ui) for (const d of S.ui.dlgs) if (d.open) d.close(); };

  function mount(el) {
    if (S.mounted) return;
    S.mounted = true; S.el = el;
    const ui = S.ui = { dlgs: [] }, wrap = h('div', 'ar-root');
    ui.root = wrap;
    // đầu trang
    const head = h('header', 'ar-head'), back = btn('btn ar-back', '← Về chánh điện'), tt = h('div', 'ar-ttl');
    ui.sub = h('span', 'ar-sub', 'Luận võ 1 đấu 1');
    add(tt, h('h2', null, 'Sân đấu'), ui.sub);
    // trong trận: số lượt, giờ còn lại, thanh đếm giờ nằm ngay trên đầu trang (đỡ chỗ cho sân khấu)
    ui.hturn = h('div', 'ar-hturn'); ui.hturn.hidden = true;
    ui.turn = h('b', 'ar-turn'); ui.tsec = h('span', 'ar-tsec', null, { role: 'timer' });
    add(ui.hturn, ui.turn, ui.tsec);
    ui.hbar = h('div', 'ar-hbar'); ui.hfill = h('i'); ui.hbar.appendChild(ui.hfill); ui.hbar.hidden = true;
    add(head, back, tt, ui.hturn, ui.hbar);
    back.addEventListener('click', onBack);
    ui.back = back;
    ui.off = h('p', 'ar-off', 'Mất kết nối. Các nút gửi tạm khóa, đang thử nối lại…', { role: 'status' }); ui.off.hidden = true;
    ui.live = h('div', 'sr', null, { 'aria-live': 'polite' });
    const main = h('div', 'ar-main');
    ui.invites = h('div', 'ar-invites', null, { 'aria-live': 'polite' });
    ui.roster = buildRoster(); ui.lobby = h('section', 'ar-screen ar-lobby', null, { 'aria-label': 'Sảnh chọn bộ chiêu' });
    ui.match = h('section', 'ar-screen ar-matchbox', null, { 'aria-label': 'Trận đấu' }); ui.end = h('section', 'ar-screen ar-end', null, { 'aria-label': 'Kết quả trận' });
    for (const s of [ui.lobby, ui.match, ui.end]) s.hidden = true;
    add(main, ui.roster.sec, ui.lobby, ui.match, ui.end, ui.invites);
    add(wrap, head, ui.off, main, ui.live);
    buildDialogs(wrap);
    el.appendChild(wrap);
  }

  function buildRoster() {
    const sec = h('section', 'ar-screen ar-roster', null, { 'aria-label': 'Danh sách người ở sân' }), r = { sec };
    const box = h('div', 'ar-rwrap'), side = h('div', 'ar-side'), list = h('div', 'ar-listbox');
    add(side, h('p', 'ar-intro', 'Hai bên cùng chọn chiêu kín, rồi lật ra một lượt. Ai hết máu trước thì thua.'));
    r.dnd = btn('ar-switch', null, { role: 'switch', 'aria-checked': 'false' });
    add(r.dnd, h('span', 'ar-knob'), h('span', 'ar-sw-t', 'Tạm không nhận lời mời'));
    r.dnd.addEventListener('click', toggleDnd);
    r.blocks = btn('btn small ar-blocks', 'Danh sách chặn');
    r.blocks.addEventListener('click', openBlocks);
    add(side, r.dnd, r.blocks);
    r.resume = h('p', 'ar-resume', null, { role: 'status' }); r.resume.hidden = true;
    add(r.resume, h('span', 'spin', null, { 'aria-hidden': 'true' }), document.createTextNode('Đang vào lại trận đang đấu dở…'));
    r.login = h('div', 'card ar-login'); r.login.hidden = true;
    const lb = btn('btn primary', 'Đăng nhập Google'); lb.addEventListener('click', () => { try { S.host.login(); } catch (e) { /* bỏ qua */ } });
    add(r.login, h('b', null, 'Cần đăng nhập Google để ra sân luận võ.'), h('span', 'hint', 'Tài khoản giữ nội công, chiêu đã học và thắng thua của bạn.'), lb);
    r.out = h('div', 'ar-out', null, { role: 'status' }); r.out.hidden = true;
    r.outText = h('span', 'ar-out-t'); r.outCancel = btn('btn small', 'Hủy lời mời');
    r.outCancel.addEventListener('click', cancelOut);
    add(r.out, h('span', 'spin', null, { 'aria-hidden': 'true' }), r.outText, r.outCancel);
    const hd = h('h3', 'ar-lh'), cnt = h('span', 'ar-count', '0');
    add(hd, h('span', null, 'Người ở sân'), cnt);
    r.count = cnt; r.list = h('ul', 'ar-list'); r.list.setAttribute('aria-label', 'Người ở sân');
    r.empty = h('div', 'ar-empty');
    r.empty.appendChild(svgIcon('ar-empty-i', '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M8 9.5h.01M16 9.5h.01M8.5 15.5c1-1.2 2.2-1.8 3.5-1.8s2.5.6 3.5 1.8" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>', 40));
    r.emptyT = h('b', null, 'Sân đang vắng.');
    r.emptyS = h('span', null, 'Chưa có đạo hữu nào ra luận võ. Bạn cứ chờ một lát, hoặc rủ bạn bè cùng ra sân. Có người vào là thấy ngay ở đây.');
    add(r.empty, r.emptyT, r.emptyS);
    add(list, r.resume, r.login, r.out, hd, r.list, r.empty);
    add(box, side, list); add(sec, box);
    return r;
  }

  function buildDialogs(wrap) {
    const ui = S.ui;
    // chọn chế độ mời
    const d1 = ui.dMode = mkDlg('Mời luận võ', ''); ui.dlgs.push(d1.dlg);
    const fs = h('fieldset'), lg = h('legend', null, 'Chế độ'), opts = h('div', 'opts one');
    for (const mode of ['balanced', 'buff']) {
      const lab = h('label', 'opt'), inp = h('input', null, null, { type: 'radio', name: 'ar-mode', value: mode }), sp = h('span');
      add(sp, h('b', null, MODES[mode].name), h('small', null, MODES[mode].desc)); add(lab, inp, sp); opts.appendChild(lab);
    }
    add(fs, lg, opts);
    const send = btn('btn primary', 'Gửi lời mời', { type: 'submit' }), later = btn('btn', 'Để sau');
    later.addEventListener('click', () => d1.dlg.close());
    add(d1.foot, later, send); add(d1.body, fs, d1.warn, d1.foot);
    d1.send = send;
    d1.body.addEventListener('submit', e => { e.preventDefault(); sendInvite(); });
    // chặn
    const d2 = ui.dBlock = mkDlg('Chặn người này?', ''); ui.dlgs.push(d2.dlg);
    const no = btn('btn', 'Không chặn'), yes = btn('btn primary', 'Chặn');
    no.addEventListener('click', () => d2.dlg.close()); yes.addEventListener('click', doBlock);
    add(d2.foot, no, yes); add(d2.body, d2.warn, d2.foot);
    d2.yes = yes;
    // danh sách chặn
    const d3 = ui.dBlocks = mkDlg('Danh sách chặn', 'Người bị chặn không mời luận võ bạn được nữa.'); ui.dlgs.push(d3.dlg);
    d3.list = h('ul', 'ar-bl'); d3.state = h('p', 'hint', null, { role: 'status' });
    add(d3.body, d3.state, d3.list, d3.warn);
    // rời trận
    const d4 = ui.dLeave = mkDlg('Rời trận là bỏ cuộc', 'Nếu rời sân bây giờ, bạn sẽ bị xử thua trận này.'); ui.dlgs.push(d4.dlg);
    const stay = btn('btn primary', 'Ở lại đấu'), quit = btn('btn', 'Bỏ cuộc, về chánh điện');
    stay.addEventListener('click', () => d4.dlg.close()); quit.addEventListener('click', doLeave);
    add(d4.foot, quit, stay); add(d4.body, d4.warn, d4.foot);
    d4.quit = quit;
    for (const d of ui.dlgs) wrap.appendChild(d);
  }

  /* ---------- chuyển màn ---------- */
  function go(screen) {
    const ui = S.ui;
    S.screen = screen;
    ui.roster.sec.hidden = screen !== 'roster'; ui.lobby.hidden = screen !== 'lobby'; ui.match.hidden = screen !== 'match'; ui.end.hidden = screen !== 'end';
    ui.sub.textContent = { roster: 'Luận võ 1 đấu 1', lobby: 'Sảnh chọn bộ chiêu', match: 'Đang đấu', end: 'Kết quả' }[screen];
    ui.invites.hidden = screen === 'lobby' || screen === 'match';
    ui.hturn.hidden = ui.hbar.hidden = screen !== 'match';
    ui.root.dataset.screen = screen;
    if (screen === 'roster') renderRoster();
    if (screen === 'lobby' || screen === 'match') startPaint(); else stopPaint();
    const first = { roster: ui.roster.sec, lobby: ui.lobby, match: ui.match, end: ui.end }[screen];
    const hd = first && first.querySelector('[data-focus]');
    if (hd) { hd.tabIndex = -1; try { hd.focus({ preventScroll: true }); } catch (e) { /* bỏ qua */ } }
    refreshCtl();
  }
  const inMatch = () => !!S.m && (S.screen === 'lobby' || S.screen === 'match');

  function onBack() {
    if (inMatch()) { S.ui.dLeave.warn.hidden = true; openDlg(S.ui.dLeave.dlg); return; }
    S.host.goto('hall');
  }
  function doLeave() {
    const m = S.m, d = S.ui.dLeave;
    if (!m) { d.dlg.close(); S.host.goto('hall'); return; }
    if (!canSend()) { d.warn.textContent = 'Mất kết nối, chưa bỏ cuộc được. Đợi nối lại rồi thử nhé.'; d.warn.hidden = false; return; }
    d.quit.disabled = true;
    S.sock.emit('pk:forfeit', { matchId: m.id }, ack => {
      d.quit.disabled = false;
      if (ack && ack.ok) { d.dlg.close(); S.host.goto('hall'); return; }
      d.warn.textContent = (ack && ack.reason) || 'Chưa bỏ cuộc được, thử lại nhé.'; d.warn.hidden = false;
      resumeMatch();                                              // có thể trận đã kết thúc: đồng bộ lại với máy chủ
    });
  }

  /* ---------- sân: danh sách người ---------- */
  const stRank = { free: 0, dnd: 1, busy: 2 };
  function sortedPlayers() {
    const me = S.host.me ? S.host.me().pid : -1;
    return [...S.players.values()].filter(p => p.pid !== me).sort((a, b) => (stRank[a.st] ?? 0) - (stRank[b.st] ?? 0) || num(b.lv) - num(a.lv) || String(a.name).localeCompare(String(b.name), 'vi'));
  }
  function rowNode() {
    const li = h('li', 'ar-row'), cv = h('canvas', 'ar-mini', null, { 'aria-hidden': 'true' }), info = h('div', 'ar-rinfo');
    const name = h('b', 'ar-rname'), meta = h('span', 'ar-rmeta'), st = h('span', 'ar-st'), act = h('div', 'ar-ract');
    const inv = btn('btn small primary ar-inv', 'Mời luận võ'), blk = btn('btn small ar-blk', 'Chặn');
    inv.addEventListener('click', () => openInvite(+li.dataset.pid)); blk.addEventListener('click', () => openBlock(+li.dataset.pid));
    add(info, name, meta); add(act, inv, blk); add(li, cv, info, st, act);
    return { li, cv, name, meta, st, inv, blk, look: null, drawn: false };
  }
  function updRow(r, p) {
    r.li.dataset.pid = p.pid;
    r.name.textContent = p.name; r.meta.textContent = `Cấp ${num(p.lv, 1)} · ${num(p.wins)} thắng · ${num(p.losses)} thua`;
    const st = ST[p.st] || ST.free;
    r.st.textContent = st[0]; r.st.className = 'ar-st ar-st-' + st[1];
    r.inv.hidden = p.st !== 'free';
    r.inv.disabled = !canSend() || !!S.out;
    r.inv.title = S.out ? 'Bạn đang chờ một lời mời khác' : '';
    r.inv.setAttribute('aria-label', `Mời ${p.name} luận võ`); r.blk.setAttribute('aria-label', `Chặn ${p.name}`);
    r.blk.disabled = !canSend();
    const lk = JSON.stringify(p.look || null);
    if (r.look !== lk) { r.look = lk; r.drawn = false; }
    r.p = p;
  }
  function renderRoster() {
    const ui = S.ui;
    if (!ui || !S.mounted) return;
    const list = sortedPlayers(), seen = new Set(), r = ui.roster;
    list.forEach((p, i) => {
      seen.add(p.pid);
      let row = S.rows.get(p.pid);
      if (!row) { row = rowNode(); S.rows.set(p.pid, row); }
      updRow(row, p);
      if (r.list.children[i] !== row.li) r.list.insertBefore(row.li, r.list.children[i] || null);
    });
    for (const [pid, row] of S.rows) if (!seen.has(pid)) { row.li.remove(); S.rows.delete(pid); }
    r.count.textContent = String(list.length);
    r.empty.hidden = list.length > 0 || S.loginNeeded;
    r.list.hidden = list.length === 0;
    if (S.screen === 'roster') for (const row of S.rows.values()) if (!row.drawn) row.drawn = paintPortrait({ cv: row.cv, look: row.p && row.p.look, buff: null }, 0);
    r.dnd.setAttribute('aria-checked', String(S.dnd)); r.dnd.classList.toggle('on', S.dnd); r.dnd.disabled = !canSend() || S.dndBusy;
    r.blocks.disabled = !canSend();
  }
  function setLogin(on) {
    S.loginNeeded = !!on;
    if (!S.ui) return;
    S.ui.roster.login.hidden = !on;
    renderRoster();
  }
  function toggleDnd() {
    if (!canSend() || S.dndBusy) return;
    const on = !S.dnd;
    S.dndBusy = true; renderRoster();
    S.sock.emit('arena:dnd', { on }, ack => {
      S.dndBusy = false;
      if (ack && ack.ok) S.dnd = ack.dnd != null ? !!ack.dnd : on; else fail(ack, 'Chưa đổi được, thử lại nhé.');
      renderRoster();
    });
  }

  /* mời đi */
  function openInvite(pid) {
    const p = S.players.get(pid), d = S.ui.dMode;
    if (!p || p.st !== 'free') { toast('Người này không còn rảnh để mời.'); return; }
    if (S.out) { toast('Bạn đang chờ một lời mời khác.'); return; }
    S.dlg.pid = pid;
    d.h2.textContent = 'Mời ' + p.name; d.sub.textContent = `Cấp ${num(p.lv, 1)} · ${num(p.wins)} thắng · ${num(p.losses)} thua. Lời mời có hiệu lực 20 giây.`;
    d.body.querySelectorAll('input[name="ar-mode"]').forEach(i => { i.checked = i.value === S.lastMode; });
    d.warn.hidden = true; d.send.disabled = !canSend();
    openDlg(d.dlg);
  }
  function sendInvite() {
    const d = S.ui.dMode, p = S.players.get(S.dlg.pid), mode = (d.body.querySelector('input[name="ar-mode"]:checked') || {}).value || 'balanced';
    if (!p) { d.dlg.close(); return; }
    if (!canSend()) { d.warn.textContent = 'Mất kết nối, chưa gửi được.'; d.warn.hidden = false; return; }
    S.lastMode = mode; d.send.disabled = true;
    S.sock.emit('pk:invite', { toPid: p.pid, mode }, ack => {
      d.send.disabled = !canSend();
      if (!ack || !ack.ok) { d.warn.textContent = (ack && ack.reason) || 'Chưa mời được, thử lại nhé.'; d.warn.hidden = false; if (ack && ack.code === 'login') setLogin(true); return; }
      d.dlg.close();
      if (S.m) return;                                            // nhận lời quá nhanh: sảnh đã mở
      S.out = { inviteId: ack.inviteId, expiresAt: num(ack.expiresAt, nowMs() + 20000), toPid: p.pid, toName: p.name, mode, total: 20000 };
      renderOut(); renderRoster();
      say(`Đã mời ${p.name}. Đang chờ nhận lời.`);
    });
  }
  function renderOut() {
    const r = S.ui.roster, o = S.out;
    r.out.hidden = !o;
    if (!o) return;
    const left = secs(o.expiresAt - nowMs());
    r.outText.textContent = `Đang chờ ${o.toName} nhận lời… (còn ${left} giây)`;
    r.outCancel.disabled = !canSend() || !!o.cancelling;
  }
  function cancelOut() {
    const o = S.out;
    if (!o || !canSend()) return;
    o.cancelling = true; renderOut();
    S.sock.emit('pk:invite:cancel', { inviteId: o.inviteId }, ack => {
      if (S.out !== o) return;
      o.cancelling = false;
      if (ack && ack.ok) { S.out = null; renderRoster(); } else fail(ack, 'Chưa hủy được lời mời.');
      renderOut();
    });
  }

  /* chặn */
  function openBlock(pid) {
    const p = S.players.get(pid), d = S.ui.dBlock;
    if (!p) return;
    S.dlg.blockPid = pid;
    d.h2.textContent = 'Chặn ' + p.name + '?';
    d.sub.textContent = 'Người bị chặn không mời luận võ bạn được nữa. Bạn bỏ chặn lúc nào cũng được trong "Danh sách chặn".';
    d.warn.hidden = true; d.yes.disabled = !canSend();
    openDlg(d.dlg);
  }
  function doBlock() {
    const d = S.ui.dBlock, p = S.players.get(S.dlg.blockPid);
    if (!p) { d.dlg.close(); return; }
    if (!canSend()) { d.warn.textContent = 'Mất kết nối, chưa chặn được.'; d.warn.hidden = false; return; }
    d.yes.disabled = true;
    S.sock.emit('pk:block', { pid: p.pid }, ack => {
      d.yes.disabled = false;
      if (ack && ack.ok) { d.dlg.close(); toast(`Đã chặn ${p.name}.`); return; }
      d.warn.textContent = (ack && ack.reason) || 'Chưa chặn được, thử lại nhé.'; d.warn.hidden = false;
    });
  }
  function openBlocks() {
    const d = S.ui.dBlocks;
    clear(d.list); d.warn.hidden = true; d.state.textContent = 'Đang tải…';
    openDlg(d.dlg);
    if (!canSend()) { d.state.textContent = 'Mất kết nối, chưa tải được danh sách.'; return; }
    S.sock.emit('arena:blocks', {}, ack => {
      if (!ack || !ack.ok) { d.state.textContent = (ack && ack.reason) || 'Chưa tải được danh sách, thử lại nhé.'; return; }
      renderBlocks(ack.list || []);
    });
  }
  function renderBlocks(list) {
    const d = S.ui.dBlocks;
    clear(d.list);
    d.state.textContent = list.length ? '' : 'Bạn chưa chặn ai.';
    for (const b of list) {
      const li = h('li', 'ar-bli'), un = btn('btn small', 'Bỏ chặn', { 'aria-label': 'Bỏ chặn ' + b.name });
      un.addEventListener('click', () => {
        if (!canSend()) { d.warn.textContent = 'Mất kết nối, chưa bỏ chặn được.'; d.warn.hidden = false; return; }
        un.disabled = true;
        S.sock.emit('pk:unblock', { uid: b.uid }, ack => {
          if (ack && ack.ok) { li.remove(); if (!d.list.children.length) d.state.textContent = 'Bạn chưa chặn ai.'; d.warn.hidden = true; }
          else { un.disabled = false; d.warn.textContent = (ack && ack.reason) || 'Chưa bỏ chặn được.'; d.warn.hidden = false; }
        });
      });
      add(li, h('span', 'ar-bname', b.name), un); d.list.appendChild(li);
    }
  }

  /* lời mời đến */
  function buffList(buff, emptyText) {
    const ul = h('ul', 'ar-bfl'), labels = buff && Array.isArray(buff.labels) ? buff.labels : [];
    if (!labels.length) ul.appendChild(h('li', 'none', emptyText || 'Không có buff'));
    for (const t of labels) ul.appendChild(h('li', null, t));
    return ul;
  }
  function onInvited(d) {
    if (!S.visible || !d || S.invites.some(i => i.inviteId === d.inviteId)) return;
    const inv = { inviteId: d.inviteId, mode: d.mode === 'buff' ? 'buff' : 'balanced', expiresAt: num(d.expiresAt), from: d.from || {}, buffs: d.buffs || null, busy: false, node: null };
    inv.total = Math.max(1000, inv.expiresAt - nowMs());
    inv.node = inviteCard(inv);
    S.invites.push(inv);
    S.ui.invites.appendChild(inv.node.card);
    updInvite(inv, nowMs());
    say(`${inv.from.name || 'Một đạo hữu'} mời bạn luận võ.`);
  }
  function inviteCard(inv) {
    const f = inv.from, card = h('article', 'ar-ic', null, { role: 'group', 'aria-label': `Lời mời luận võ từ ${f.name || 'một đạo hữu'}` });
    const top = h('div', 'ar-ic-top'), pt = portrait('ar-mini', f.look, null, null), who = h('div', 'ar-ic-who'), time = h('span', 'ar-ic-time');
    add(who, h('b', null, f.name || 'Một đạo hữu'), h('span', null, `Cấp ${num(f.lv, 1)} · ${num(f.wins)} thắng · ${num(f.losses)} thua`));
    add(top, pt.cv, who, time);
    const mode = h('p', 'ar-ic-mode'); add(mode, h('b', null, MODES[inv.mode].name), document.createTextNode(' · ' + MODES[inv.mode].desc));
    add(card, top, mode);
    if (inv.mode === 'buff') {
      const bt = h('div', 'ar-bt'), c1 = h('div', 'ar-bt-c'), c2 = h('div', 'ar-bt-c');
      add(c1, h('h4', null, 'Bạn'), buffList(inv.buffs && inv.buffs.you)); add(c2, h('h4', null, f.name || 'Đối thủ'), buffList(inv.buffs && inv.buffs.op));
      add(bt, c1, c2); add(card, bt, h('p', 'hint', inv.buffs ? 'Đây là bản xem trước. Buff thật được chụp một lần lúc bạn nhận lời.' : 'Buff sẽ được chụp một lần lúc bạn nhận lời.'));
    }
    const bar = h('div', 'ar-ic-bar'), fill = h('i'), act = h('div', 'ar-ic-act'), yes = btn('btn primary', 'Nhận lời'), no = btn('btn', 'Từ chối');
    yes.addEventListener('click', () => respond(inv, true)); no.addEventListener('click', () => respond(inv, false));
    add(bar, fill); add(act, yes, no); add(card, bar, act);
    if (pt.cv) requestAnimationFrame(() => paintPortrait(pt, 0));
    return { card, time, fill, yes, no };
  }
  function updInvite(inv, now) {
    const left = inv.expiresAt - now, n = inv.node;
    if (left <= -300) { removeInvite(inv.inviteId); toast(CLOSED_IN.expired(inv.from.name || 'Đối phương')); return; }
    n.time.textContent = left > 0 ? `còn ${secs(left)}s` : 'hết hạn';
    n.fill.style.width = Math.max(0, Math.min(100, left / inv.total * 100)) + '%';
    n.yes.disabled = n.no.disabled = inv.busy || left <= 0 || !canSend();
    n.yes.textContent = inv.accepted ? 'Đang vào sảnh…' : 'Nhận lời';
  }
  function removeInvite(id) {
    const i = S.invites.findIndex(x => x.inviteId === id);
    if (i < 0) return null;
    const inv = S.invites.splice(i, 1)[0];
    inv.node.card.remove();
    return inv;
  }
  function respond(inv, accept) {
    if (!canSend() || inv.busy) return;
    inv.busy = true; updInvite(inv, nowMs());
    S.sock.emit('pk:respond', { inviteId: inv.inviteId, accept }, ack => {
      inv.busy = false;
      if (!ack || !ack.ok) { fail(ack, 'Chưa trả lời được lời mời.'); }
      else if (accept) inv.accepted = true; else removeInvite(inv.inviteId);
      if (S.invites.includes(inv)) updInvite(inv, nowMs());
    });
  }
  function onInviteClosed(d) {
    if (!S.visible || !d) return;
    const inv = removeInvite(d.inviteId);
    // 'busy' thường đến ngay trước pk:lobby khi chính mình vừa nhận lời trận khác: chờ một chút, vào sảnh rồi thì khỏi báo
    const note = (f, n, reason) => { if (!f) return; if (reason === 'busy') setTimeout(() => { if (!S.m) toast(f(n)); }, 300); else toast(f(n)); };
    if (inv) { note(CLOSED_IN[d.reason], inv.from.name || 'Đối phương', d.reason); return; }
    const o = S.out;
    if (o && o.inviteId === d.inviteId) {
      S.out = null; renderOut(); renderRoster();
      note(CLOSED_OUT[d.reason], o.toName, d.reason);
    }
  }

  /* ---------- sảnh chọn bộ chiêu ---------- */
  function skillCard(id, o) {
    const s = skillOf(id) || { id, name: String(id), kind: 'idle' }, br = branchOf(s), b = btn('ar-card', null, { 'aria-pressed': 'false' });
    b.dataset.skill = id;
    b.style.setProperty('--bc', br ? br.color : 'var(--line)');
    const kind = (M.KIND_NAMES && M.KIND_NAMES[s.kind]) || '';
    const ck = h('span', 'ar-ck');
    if (br) ck.appendChild(h('em', null, br.name));
    ck.appendChild(document.createTextNode(kind));
    ck.appendChild(h('span', 'ar-cx'));
    add(b, h('span', 'ar-cn', s.name), ck, h('span', 'ar-cs', s.mana > 0 || s.kind !== 'rest' ? M.statsLine(s) : s.short));
    if (o && o.short && s.short) b.appendChild(h('span', 'ar-cd', s.short));
    if (o && o.no) b.appendChild(h('i', 'ar-no'));
    return b;
  }
  function buildLobby() {
    const m = S.m, sec = clear(S.ui.lobby), L = m.ui = { cards: {} };
    dropPaint('lobby'); dropPaint('match');
    const wrap = h('div', 'ar-lwrap');
    const top = h('header', 'ar-lb-top'), ttl = h('h3', null, 'Sảnh chọn bộ chiêu', { 'data-focus': '' }), clock = h('div', 'ar-clock', null, { role: 'timer' });
    L.sec = h('b'); L.secT = h('span', null, ' giây');
    add(clock, L.sec, L.secT); add(top, ttl, clock);
    L.bar = h('div', 'ar-bar'); L.barFill = h('i'); L.bar.appendChild(L.barFill);
    const vs = h('div', 'ar-vs');
    for (const side of ['you', 'op']) {
      const p = m[side], box = h('div', 'ar-lf ar-lf-' + side), pt = portrait('ar-portrait', p.look, m.buffs && m.buffs[side], 'lobby');
      L[side + 'Pt'] = pt;
      add(box, pt.cv, h('b', 'ar-lf-name', side === 'you' ? `${p.name} (bạn)` : p.name), h('span', 'ar-lf-sub', `Cấp ${num(p.level, 1)} · HP ${num(p.hpMax)} · Nội lực ${num(p.manaMax)}`));
      if (m.buffs) add(box, buffList(m.buffs[side], 'Không có buff'));
      if (side === 'op') { L.ready = h('span', 'ar-ready', 'Đối thủ đã sẵn sàng', { role: 'status' }); L.ready.hidden = true; box.appendChild(L.ready); }
      vs.appendChild(box);
      if (side === 'you') vs.appendChild(h('span', 'ar-vsm', 'đấu'));
    }
    add(wrap, top, L.bar, vs);
    if (m.buffs) wrap.appendChild(h('p', 'hint ar-note', 'Buff được chụp một lần lúc nhận lời. Hào quang hết giờ hay đổi công đức giữa trận không ảnh hưởng trận này.'));
    const hd = h('h4', 'ar-lh2'); L.cnt = h('span', 'ar-cnt');
    add(hd, h('span', null, 'Chọn đúng 4 chiêu'), L.cnt);
    L.slots = h('ol', 'ar-slots', null, { 'aria-label': 'Bộ 4 chiêu đã chọn' });
    for (let i = 0; i < 4; i++) {
      const li = h('li'), b = btn('ar-slot', null, { 'aria-label': `Ô ${i + 1}, trống` });
      b.addEventListener('click', () => { if (canEditLoadout() && m.sel[i]) { m.sel.splice(i, 1); renderLobby(); } });
      li.appendChild(b); L.slots.appendChild(li);
    }
    L.warn = h('p', 'warn ar-lw', null, { role: 'status' });
    L.pick = h('div', 'ar-picker', null, { role: 'group', 'aria-label': 'Các chiêu bạn đã học' });
    const learned = M.SKILL_ORDER.filter(id => m.learned.includes(id)).concat(m.learned.filter(id => !M.SKILLS[id] && skillOf(id)));
    for (const id of learned) {
      const c = skillCard(id, { short: true, no: true });
      c.addEventListener('click', () => togglePick(id));
      L.cards[id] = c; L.pick.appendChild(c);
    }
    L.act = h('div', 'ar-lb-act');
    L.lock = btn('btn primary big', 'Khóa bộ chiêu'); L.lock.addEventListener('click', lockLoadout);
    L.wait = h('p', 'ar-wait', null, { role: 'status' });
    add(L.act, L.lock, L.wait);
    add(wrap, hd, L.slots, L.warn, L.pick, L.act);
    sec.appendChild(wrap);
    renderLobby();
  }
  const canEditLoadout = () => { const m = S.m; return !!m && m.phase === 'lobby' && !m.locked && !m.pending && !m.timeUp && canSend(); };
  function togglePick(id) {
    const m = S.m;
    if (!canEditLoadout()) return;
    const i = m.sel.indexOf(id);
    if (i >= 0) m.sel.splice(i, 1);
    else if (m.sel.length >= 4) { m.msg = 'Đủ 4 chiêu rồi. Bỏ bớt một chiêu để chọn chiêu khác.'; renderLobby(); return; }
    else m.sel.push(id);
    m.msg = '';
    renderLobby();
  }
  function renderLobby() {
    const m = S.m, L = m && m.ui;
    if (!m || !L || !L.slots) return;
    const edit = canEditLoadout(), full = m.sel.length === 4;
    L.cnt.textContent = `${m.sel.length}/4`;
    [...L.slots.children].forEach((li, i) => {
      const b = li.firstChild, id = m.sel[i], s = id && skillOf(id);
      clear(b); b.disabled = !edit || !id;
      b.classList.toggle('on', !!id);
      if (s) { const br = branchOf(s); b.style.setProperty('--bc', br ? br.color : 'var(--line)'); add(b, h('i', null, String(i + 1)), h('span', null, s.name)); b.setAttribute('aria-label', `Ô ${i + 1}: ${s.name}${edit ? '. Chạm để bỏ chiêu này' : ''}`); }
      else { b.style.removeProperty('--bc'); add(b, h('i', null, String(i + 1)), h('span', 'empty', 'Trống')); b.setAttribute('aria-label', `Ô ${i + 1}, trống`); }
    });
    for (const id in L.cards) {
      const c = L.cards[id], i = m.sel.indexOf(id), s = skillOf(id), on = i >= 0;
      c.setAttribute('aria-pressed', String(on));
      c.disabled = !edit;
      c.classList.toggle('locked', !edit);
      c.querySelector('.ar-no').textContent = on ? String(i + 1) : '';
      c.setAttribute('aria-label', `${s.name}. ${(M.KIND_NAMES || {})[s.kind] || ''}. ${M.statsLine(s)}.${on ? ' Đã chọn, ô ' + (i + 1) + '.' : ''}`);
    }
    // cảnh báo bộ chiêu
    const ws = full ? M.loadoutWarnings(m.sel) : [];
    const lines = ws.map(w => w.text);
    if (m.msg) lines.unshift(m.msg);
    if (m.learned.length < 4) lines.unshift('Bạn mới học dưới 4 chiêu nên chưa khóa được bộ chiêu. Hãy vào Võ Học Các học thêm chiêu.');
    clear(L.warn);
    for (const t of lines) L.warn.appendChild(h('span', 'ar-wl', t));
    L.warn.hidden = !lines.length;
    L.lock.hidden = m.locked;
    L.lock.disabled = !edit || !full;
    L.lock.textContent = m.pending ? 'Đang khóa…' : full ? 'Khóa bộ chiêu' : `Chọn thêm ${4 - m.sel.length} chiêu`;
    L.wait.hidden = !(m.locked || m.timeUp);
    clear(L.wait);
    if (m.locked) { L.wait.appendChild(h('span', 'spin', null, { 'aria-hidden': 'true' })); L.wait.appendChild(document.createTextNode(m.opReady ? 'Đã khóa. Hai bên đã sẵn sàng, trận sắp bắt đầu…' : 'Đã khóa. Đang chờ đối thủ…')); }
    else if (m.timeUp) L.wait.appendChild(document.createTextNode('Hết giờ. Máy chủ đang dùng bộ chiêu có sẵn của bạn để vào trận…'));
    L.ready.hidden = !m.opReady;
  }
  function lockLoadout() {
    const m = S.m;
    if (!canEditLoadout() || m.sel.length !== 4) return;
    m.pending = true; m.msg = ''; renderLobby();
    S.sock.emit('pk:loadout', { matchId: m.id, skills: m.sel.slice() }, ack => {
      if (S.m !== m || m.phase !== 'lobby') return;              // máy chủ gửi pk:turn trước ack khi hai bên đã khóa: sảnh đã đóng
      m.pending = false;
      if (ack && ack.ok) { m.locked = true; }
      else { m.msg = (ack && ack.reason) || 'Chưa khóa được bộ chiêu, thử lại nhé.'; if (ack && ack.code === 'login') setLogin(true); }
      renderLobby();
    });
  }
  function updLobbyClock(now) {
    const m = S.m, L = m.ui, left = m.deadline - now;
    if (!L || !L.sec) return;
    L.sec.textContent = String(secs(left));
    L.barFill.style.width = Math.max(0, Math.min(100, left / (m.lobbyTotal || 30000) * 100)) + '%';
    L.sec.parentNode.classList.toggle('urgent', left <= 8000);
    if (left <= 0 && !m.timeUp && !m.locked) { m.timeUp = true; renderLobby(); }
  }

  /* ---------- thẻ người chơi trong trận ---------- */
  function meter(cls, label) {
    const w = h('div', 'ar-m ' + cls), tr = h('div', 'ar-m-t', null, { role: 'meter', 'aria-label': label, 'aria-valuemin': '0' }), f = h('i', 'ar-m-f'), v = h('span', 'ar-m-v');
    add(tr, f); add(w, h('span', 'ar-m-l', label), tr, v);
    return { w, tr, f, v };
  }
  function fighterCard(side, p, buff) {
    const root_ = h('section', 'ar-fc ar-fc-' + side, null, { 'aria-label': side === 'you' ? 'Bạn' : 'Đối thủ' });
    const pt = portrait('ar-pm', p.look, buff, 'match'), info = h('div', 'ar-fc-info'), top = h('div', 'ar-fc-top');
    const name = h('b', 'ar-fc-name', side === 'you' ? `${p.name} (bạn)` : p.name), lv = h('span', 'ar-fc-lv', `Cấp ${num(p.level, 1)}`);
    const lock = h('span', 'ar-lockb'); lock.appendChild(svgIcon('ar-lk-i', ICON_LOCK, 13)); lock.appendChild(h('span', 'ar-lk-t'));
    if (side === 'you') lock.hidden = true;
    add(top, name, lv, lock);
    const hp = meter('ar-hp', side === 'you' ? 'HP của bạn' : 'HP của đối thủ'), mp = meter('ar-mp', 'Nội lực'), rg = meter('ar-rg', 'Nộ');
    hp.w.querySelector('.ar-m-l').textContent = 'HP';
    const two = h('div', 'ar-m2'), bd = h('div', 'ar-bd');
    add(two, mp.w, rg.w); add(info, top, hp.w, two, bd); add(root_, pt.cv, info);
    return { root: root_, name, lock, lockT: lock.querySelector('.ar-lk-t'), hp, mp, rg, bd, buff, shown: null };
  }
  const chip = (cls, text, title) => h('span', 'ar-chip ' + cls, text, title ? { title, 'aria-label': title } : null);
  function setBars(c, st, only) {
    const set = (m, v, max, txt) => {
      m.f.style.width = (max > 0 ? Math.max(0, Math.min(100, v / max * 100)) : 0) + '%';
      m.v.textContent = txt; m.tr.setAttribute('aria-valuemax', String(max)); m.tr.setAttribute('aria-valuenow', String(Math.max(0, Math.round(v))));
    };
    if (!only || only === 'hp') {
      const hp = Math.max(0, Math.round(st.hp)), r = st.hpMax > 0 ? hp / st.hpMax : 0;
      set(c.hp, hp, st.hpMax, `${hp}/${st.hpMax}`); c.hp.f.dataset.lv = r > 0.5 ? 'ok' : r > 0.25 ? 'mid' : 'low';
    }
    if (!only || only === 'mp') set(c.mp, st.mana, st.manaMax, `${Math.round(st.mana)}/${st.manaMax}`);
    if (!only || only === 'rg') set(c.rg, st.rage, RAGE_MAX, String(Math.round(st.rage)));
  }
  function setBadges(c, st) {
    clear(c.bd);
    if (st.charging) c.bd.appendChild(chip('gold', 'Tụ lực'));
    if (st.kc > 0) c.bd.appendChild(chip('gold', `Kim Chung còn ${st.kc} lượt`));
    if (st.exposed) c.bd.appendChild(chip('bad', 'Sơ hở', `Sơ hở: nhận thêm ${EXPOSED_PCT}% sát thương`));
    const b = c.buff;
    if (b) {
      let i = 0;
      const lb = b.labels || [];
      if (b.Lc) c.bd.appendChild(chip('buff', `Pháp tướng ${b.Lc}`, lb[i++]));
      if (b.Lq) c.bd.appendChild(chip('buff demon', `Quỷ ám ${b.Lq}`, lb[i++]));
      if (b.Ld) c.bd.appendChild(chip('buff', `Hào quang ${b.Ld}`, lb[i++]));
    }
  }
  function setFighter(side, st) {
    const m = S.m, c = m && m.ui && m.ui.fc && m.ui.fc[side];
    if (!c || !st) return;
    setBars(c, st); setBadges(c, st);
    m.disp[side] = { hp: st.hp };
  }

  /* ---------- trận ---------- */
  function buildMatch() {
    const m = S.m, sec = clear(S.ui.match);
    clear(S.ui.lobby); dropPaint('lobby'); dropPaint('match');
    const U = m.ui = { fc: {}, cards: {} };
    m.legal = []; m.sel = null; m.forced = null; m.locked = false; m.pending = false; m.timeUp = false; m.opLocked = false;
    const wrap = h('div', 'ar-mwrap');
    U.fc.op = fighterCard('op', m.op, m.buffs && m.buffs.op); U.fc.you = fighterCard('you', m.you, m.buffs && m.buffs.you);
    U.fc.op.root.style.gridArea = 'opp'; U.fc.you.root.style.gridArea = 'me';
    // sân khấu (số lượt và đồng hồ nằm ở đầu trang)
    const box = h('div', 'ar-stagebox');
    U.turn = S.ui.turn; U.clock = S.ui.tsec; U.tfill = S.ui.hfill;
    U.logBtn = btn('ar-logbtn', 'Nhật ký', { 'aria-expanded': 'false' });
    U.logBtn.addEventListener('click', () => toggleLog());
    const stage = h('div', 'ar-stage'), cv = h('canvas', null, null, { role: 'img', 'aria-label': 'Sân đấu: bạn ở bên trái, đối thủ ở bên phải' });
    U.float = h('div', 'ar-float', null, { 'aria-hidden': 'true' });
    U.logPanel = h('div', 'ar-logpanel'); U.logPanel.hidden = true;
    const lh = h('h4', null, 'Nhật ký trận'); U.logList = h('ol', 'ar-logl');
    add(U.logPanel, lh, U.logList);
    add(stage, cv, U.float, U.logPanel, U.logBtn);
    box.appendChild(stage);
    S.stage = { cv, c: null, dirty: true };
    if (root.ResizeObserver) new ResizeObserver(dirtyStage).observe(stage);
    // bộ chiêu đối thủ (đã công bố)
    U.opl = h('ul', 'ar-oploadout', null, { 'aria-label': 'Bộ 4 chiêu của đối thủ' });
    box.style.gridArea = 'stage'; U.opl.style.gridArea = 'oplo';
    // vùng chọn chiêu + lật chiêu chồng lên nhau
    const picks = h('div', 'ar-picks');
    picks.style.gridArea = 'picks';
    const ui_ = h('div', 'ar-pickui'), grid = h('div', 'ar-grid');
    const loads = (m.loadouts && m.loadouts.you) || (m.locked && m.sel) || m.you.loadout || [];
    for (const id of loads) {
      const c = skillCard(id); c.classList.add('ar-pk');
      c.addEventListener('click', () => choose(id));
      U.cards[id] = c; grid.appendChild(c);
    }
    const act = h('div', 'ar-act');
    U.rest = skillCard(M.REST_ID); U.rest.classList.add('ar-pk', 'ar-rest'); U.rest.addEventListener('click', () => choose(M.REST_ID));
    U.lock = btn('btn primary ar-lockbtn', 'Chọn một chiêu'); U.lock.addEventListener('click', lockPick);
    add(act, U.rest, U.lock);
    U.status = h('p', 'ar-status', null, { role: 'status' });
    add(ui_, grid, act, U.status);
    // lật chiêu
    const rv = U.rv = { root: h('div', 'ar-reveal', null, { 'aria-label': 'Lật chiêu' }) };
    rv.root.hidden = true;
    rv.flipYou = flipCard('you'); rv.flipOp = flipCard('op');
    rv.label = h('div', 'ar-pair', null, { role: 'status' });
    rv.row = h('div', 'ar-frow'); add(rv.row, rv.flipYou.w, rv.label, rv.flipOp.w);
    rv.lines = h('ol', 'ar-lines', null, { 'aria-live': 'polite', 'aria-label': 'Diễn biến lượt này' });
    rv.skip = btn('btn small ar-skip', 'Bỏ qua hoạt ảnh'); rv.skip.addEventListener('click', skipReveal);
    add(rv.root, rv.row, rv.lines, rv.skip);
    add(picks, ui_, rv.root);
    U.pickui = ui_;
    add(wrap, U.fc.op.root, box, U.opl, U.fc.you.root, picks);
    sec.appendChild(wrap);
    renderOpLoadout();
  }
  function renderOpLoadout() {
    const m = S.m, U = m.ui;
    clear(U.opl);
    const loads = m.loadouts && m.loadouts.op;
    if (!loads) return;
    for (const id of loads) {
      const s = skillOf(id), br = branchOf(s), li = h('li', 'ar-ol');
      li.style.setProperty('--bc', br ? br.color : 'var(--line)');
      add(li, h('span', 'ar-ol-n', skillName(id)), h('span', 'ar-ol-k', (M.KIND_NAMES || {})[s && s.kind] || ''));
      U.opl.appendChild(li);
    }
  }
  function flipCard(side) {
    const w = h('div', 'ar-flip', null, { role: 'group', 'aria-label': side === 'you' ? 'Chiêu của bạn' : 'Chiêu của đối thủ' }), inn = h('div', 'ar-flip-in');
    const back = h('div', 'ar-face ar-fback', '?', { 'aria-hidden': 'true' }), front = h('div', 'ar-face ar-ffront', null, { 'aria-hidden': 'true' });
    const nm = h('b', 'ar-fl-name'), kd = h('span', 'ar-fl-kind'), sb = h('span', 'ar-fl-sub');
    add(front, h('span', 'ar-fl-who', side === 'you' ? 'Bạn' : 'Đối thủ'), nm, kd, sb);
    add(inn, back, front); w.appendChild(inn);
    return { w, inn, front, nm, kd, sb, side };
  }
  function fillFlip(f, pk) {
    const id = pk.skill, s = skillOf(id), br = branchOf(s);
    f.front.style.setProperty('--bc', br ? br.color : 'var(--muted)');
    f.nm.textContent = skillName(id);
    let kind = (M.KIND_NAMES && s && M.KIND_NAMES[s.kind]) || '';
    if (pk.phase === 'charge') kind = 'Tụ lực'; else if (pk.phase === 'release') kind = 'Tung đòn tụ lực';
    f.kd.textContent = (br ? br.name + ' · ' : '') + kind;
    f.sb.textContent = id === M.IDLE_ID ? (pk.auto ? 'Hết giờ chưa chọn' : '') : pk.invalid ? 'Chiêu không hợp lệ' : pk.mana > 0 ? `Nội lực −${pk.mana}` : '';
  }

  /* chọn chiêu và khóa */
  function choose(id) {
    const m = S.m;
    if (!m || m.phase !== 'choosing' || m.locked || m.pending || !m.legal.includes(id)) return;
    m.sel = m.sel === id ? null : id;
    renderPickCtl();
  }
  function reasonOff(m, id) {
    return m.forced ? (id === m.forced ? '' : 'Đang tụ lực, lượt này chỉ tung đòn đã tụ') : 'Không đủ nội lực';
  }
  function renderPickCtl() {
    const m = S.m, U = m && m.ui;
    if (!m || !U || !U.cards) return;
    const choosing = m.phase === 'choosing', frozen = !choosing || m.locked || m.pending || m.timeUp || !canSend();
    const all = Object.assign({}, U.cards, { [M.REST_ID]: U.rest });
    for (const id in all) {
      const c = all[id], legal = choosing && m.legal.includes(id), on = m.sel === id, s = skillOf(id);
      c.setAttribute('aria-pressed', String(on));
      c.disabled = !legal || frozen;
      c.classList.toggle('off', choosing && !legal);
      c.classList.toggle('frozen', frozen && legal);
      const cx = c.querySelector('.ar-cx');
      cx.textContent = m.forced === id ? 'Tự tung' : m.locked && on ? 'Đã khóa' : '';
      c.title = choosing && !legal ? reasonOff(m, id) : '';
      c.setAttribute('aria-label', `${s.name}. ${(M.KIND_NAMES || {})[s.kind] || ''}. ${id === M.REST_ID ? s.short : M.statsLine(s)}.` + (choosing && !legal ? ` Không chọn được: ${reasonOff(m, id)}.` : '') + (m.forced === id ? ' Đang tụ lực, lượt này tự tung.' : '') + (on ? (m.locked ? ' Đã khóa.' : ' Đang chọn.') : ''));
    }
    U.lock.hidden = m.locked;
    U.lock.disabled = frozen || !m.sel;
    U.lock.textContent = m.pending ? 'Đang khóa…' : m.sel ? `Khóa: ${skillName(m.sel)}` : 'Chọn một chiêu';
    // dòng trạng thái
    clear(U.status);
    U.status.className = 'ar-status';
    let txt = '';
    if (!choosing) txt = '';
    else if (!canSend()) { txt = 'Mất kết nối. Đợi nối lại để tiếp tục.'; U.status.classList.add('warn'); }
    else if (m.msg) { txt = m.msg; U.status.classList.add('warn'); }
    else if (m.locked) { U.status.appendChild(h('span', 'spin', null, { 'aria-hidden': 'true' })); txt = m.forced ? 'Đang tụ lực, lượt này tự tung. Chờ đối thủ…' : 'Đã khóa, chờ đối thủ…'; }
    else if (m.timeUp) txt = 'Hết giờ. Máy chủ sẽ cho bạn đứng yên lượt này.';
    else txt = m.sel ? 'Bấm "Khóa" để chốt chiêu. Khóa rồi không đổi được.' : 'Chạm một chiêu để chọn, rồi bấm "Khóa".';
    U.status.appendChild(document.createTextNode(txt));
    const c = U.fc.op;
    c.lock.hidden = !choosing; c.lock.classList.toggle('on', !!m.opLocked);
    c.lockT.textContent = m.opLocked ? 'Đối thủ đã khóa' : 'Đang chọn…';
    c.lock.setAttribute('aria-label', m.opLocked ? 'Đối thủ đã khóa' : 'Đối thủ đang chọn');
  }
  function lockPick() {
    const m = S.m;
    if (!m || m.phase !== 'choosing' || m.locked || m.pending || !m.sel) return;
    if (!canSend()) { renderPickCtl(); return; }
    const turn = m.turn, id = m.sel;
    m.pending = true; m.msg = ''; renderPickCtl();
    S.sock.emit('pk:pick', { matchId: m.id, turn, skillId: id }, ack => {
      if (S.m !== m || m.turn !== turn) return;
      m.pending = false;
      if (ack && ack.ok) m.locked = true;
      else { m.msg = (ack && ack.reason) || 'Chưa khóa được, thử lại nhé.'; if (ack && ack.code === 'login') setLogin(true); }
      renderPickCtl();
    });
  }
  function updTurnClock(now) {
    const m = S.m, U = m.ui;
    if (!U || !U.clock) return;
    const left = m.deadline - now, total = m.turnTotal || 20000;
    U.clock.textContent = secs(left) + 's';
    U.tfill.style.width = Math.max(0, Math.min(100, left / total * 100)) + '%';
    U.tfill.parentNode.classList.toggle('urgent', left <= 5000);
    if (left <= 0 && !m.timeUp && !m.locked) { m.timeUp = true; renderPickCtl(); }
  }
  function beginTurn(d, o) {
    const m = S.m, U = m.ui;
    o = o || {};
    cancelReveal(true);
    U.rv.root.hidden = true; U.pickui.hidden = false;
    clear(U.rv.lines); U.rv.label.textContent = ''; U.rv.label.classList.remove('on');
    for (const f of [U.rv.flipYou, U.rv.flipOp]) { f.w.classList.remove('on'); f.nm.textContent = f.kd.textContent = f.sb.textContent = ''; f.front.setAttribute('aria-hidden', 'true'); f.w.setAttribute('aria-label', f.side === 'you' ? 'Chiêu của bạn' : 'Chiêu của đối thủ'); }
    m.phase = 'choosing'; m.turn = d.turn; m.deadline = num(d.deadlineAt); m.turnTotal = Math.max(5000, m.deadline - nowMs()); m.forced = d.forced || null;
    m.legal = Array.isArray(d.legal) ? d.legal : []; m.state = d.state;
    if (d.loadouts) { m.loadouts = d.loadouts; renderOpLoadout(); }
    // đang tụ lực thì máy chủ tự khóa, không cần gửi gì
    m.sel = o.myPick || m.forced || null; m.locked = !!(o.myPick || m.forced); m.pending = false; m.timeUp = false; m.msg = ''; m.opLocked = !!o.opLocked;
    S.hold = { you: d.state.you.charging ? 'charge' : null, op: d.state.op.charging ? 'charge' : null };
    S.fx.length = 0;
    setFighter('you', d.state.you); setFighter('op', d.state.op);
    U.turn.textContent = `Lượt ${d.turn}`; U.turn.appendChild(h('small', null, ` / ${M.PK.MAX_TURNS}`));
    updTurnClock(nowMs());
    renderPickCtl(); dirtyStage();
    say(`Lượt ${d.turn}. ${m.forced ? 'Bạn đang tụ lực, lượt này tự tung đòn.' : 'Chọn chiêu của bạn.'}`);
  }
  function toggleLog(force) {
    const U = S.m && S.m.ui;
    if (!U) return;
    const open = force != null ? force : U.logPanel.hidden;
    U.logPanel.hidden = !open; U.logBtn.setAttribute('aria-expanded', String(open));
    if (open) U.logPanel.scrollTop = U.logPanel.scrollHeight;
  }

  /* ---------- lật chiêu ---------- */
  function stanceOf(pk, op) {
    if (!pk) return 'idle';
    if (pk.skill === M.REST_ID) return 'rest';
    const s = M.SKILLS[pk.skill];
    if (!s) return 'idle';
    if (pk.phase === 'release') return 'release';
    if (pk.phase === 'charge') return 'charge';
    if (s.kind === 'hybrid') { const o = op && M.SKILLS[op.skill]; return o && (o.kind === 'atk' || op.phase === 'release') ? 'parry' : 'atk'; }
    return s.kind;
  }
  const pairLabel = picks => `${STANCE[stanceOf(picks.you, picks.op)]} gặp ${STANCE[stanceOf(picks.op, picks.you)]}`;
  /** Kể từng sự kiện bằng một câu ngắn. who: bên làm việc đó ('you' | 'op' | 'both'). */
  function buildSteps(rev) {
    const P = rev.picks || {}, out = [], S_ = s => (s === 'you' ? 'Bạn' : 'Đối thủ'), tg = s => (s === 'you' ? 'bạn' : 'đối thủ'), nth = e => (e.of > 1 ? ` nhịp ${e.idx}/${e.of}` : ' nhịp 1');
    for (const e of rev.events || []) {
      switch (e.k) {
        case 'guard': out.push({ who: e.side, text: `thủ, giảm ${pc(e.red)}% sát thương`, hold: [e.side, 'guard'] }); break;
        case 'charge': out.push({ who: e.side, text: 'bắt đầu tụ lực, lượt sau tự tung đòn', hold: [e.side, 'charge'] }); break;
        case 'release': out.push({ who: e.side, text: 'tung đòn đã tụ lực', hold: [e.side, null] }); break;
        case 'rest': out.push({ who: e.side, text: 'điều tức, hồi thêm nội lực', hold: [e.side, 'rest'] }); break;
        case 'idle': out.push({ who: e.side, text: P[e.side] && P[e.side].auto ? 'hết giờ nên đứng yên' : 'đứng yên', hold: [e.side, null] }); break;
        case 'dodge':
          out.push({ who: e.def, text: e.ok ? `né thành công${nth(e)} (${pc(e.p)}%)` : `né hụt${nth(e)} (${pc(e.p)}%)`,
            fx: e.ok ? [['anim', e.def, 'dodge', 420], ['anim', e.atk, 'atk', 360], ['float', e.def, 'Né!', 'good']] : [] });
          break;
        case 'parry':
          out.push({ who: e.def, text: e.ok ? `đỡ thành công${nth(e)} (${pc(e.p)}%)` : `đỡ hụt${nth(e)} (${pc(e.p)}%)`,
            fx: e.ok ? [['anim', e.def, 'parry', 420], ['anim', e.atk, 'atk', 360], ['float', e.def, 'Đỡ!', 'good']] : [] });
          break;
        case 'hit': {
          const sk = skillName(P[e.atk] && P[e.atk].skill);
          out.push({ who: e.atk, text: `${sk} trúng ${tg(e.def)}${e.of > 1 ? `, nhịp ${e.idx}/${e.of}` : ''}, gây ${e.dmg}${e.red > 0 ? ` (giảm ${pc(e.red)}%)` : ''}`,
            fx: [['anim', e.atk, 'atk', 360], ['anim', e.def, 'hit', 380], ['hp', e.def, e.dmg], ['float', e.def, '−' + e.dmg, 'dmg']] });
          break;
        }
        case 'counter':
          out.push({ who: e.side, text: `phản đòn, ${tg(e.target)} mất ${e.dmg}`, fx: [['anim', e.target, 'hit', 380], ['hp', e.target, e.dmg], ['float', e.target, '−' + e.dmg, 'dmg']] });
          break;
        case 'exposed': out.push({ who: e.side, text: `sơ hở: lượt sau nhận thêm ${EXPOSED_PCT}% sát thương`, fx: [['float', e.side, 'Sơ hở', 'warn']] }); break;
        case 'kc': out.push({ who: e.side, text: `nhận Kim Chung: ${KC_TURNS} lượt sau đòn công đầu tiên mạnh thêm ${KC_PCT}%`, fx: [['float', e.side, 'Kim Chung', 'gold']] }); break;
        case 'sudden':
          out.push({ who: 'both', text: `Suy kiệt: cả hai mất ${e.dmg}`, plain: true, fx: [['anim', 'you', 'hit', 380], ['anim', 'op', 'hit', 380], ['hp', 'you', e.dmg], ['hp', 'op', e.dmg], ['float', 'you', '−' + e.dmg, 'warn'], ['float', 'op', '−' + e.dmg, 'warn']] });
          break;
        default: break;                                           // pick, rage, end: thể hiện bằng thẻ lật, thanh nộ và màn kết thúc
      }
    }
    for (const s of out) s.line = s.plain ? s.text : `${S_(s.who)} ${s.text}`;
    return out;
  }
  function lineEl(s) {
    const li = h('li', 'ar-ln ar-ln-' + s.who);
    if (!s.plain) li.appendChild(h('b', null, s.who === 'you' ? 'Bạn' : 'Đối thủ'));
    li.appendChild(document.createTextNode((s.plain ? '' : ' ') + s.text));
    return li;
  }
  function addLog(rev, label) {
    const m = S.m, U = m.ui, P = rev.picks || {};
    const head = h('li', 'ar-lg-h'), steps = rev.steps || buildSteps(rev);
    head.appendChild(h('b', null, `Lượt ${rev.turn}`));
    head.appendChild(document.createTextNode(`: bạn ra ${skillName(P.you && P.you.skill)}, đối thủ ra ${skillName(P.op && P.op.skill)}. ${label}.`));
    U.logList.appendChild(head);
    for (const s of steps) U.logList.appendChild(lineEl(s));
  }
  function floatAt(side, text, kind) {
    const U = S.m && S.m.ui;
    if (!U) return;
    const f = h('span', 'ar-fl ar-fl-' + (kind || 'dmg'), text), n = S.floats++;
    const lab = kind === 'warn' || kind === 'gold';
    f.style.left = (side === 'you' ? 27 : 73) + '%'; f.style.top = (side === 'you' ? (lab ? 12 : 34) : (lab ? 2 : 22)) + '%';
    f.style.marginLeft = ((n % 3) - 1) * 22 + 'px';
    U.float.appendChild(f);
    setTimeout(() => f.remove(), 1500);
  }
  function startReveal(rev, o) {
    const m = S.m, U = m.ui, rv = U.rv;
    o = o || {};
    cancelReveal(true);
    m.phase = 'reveal'; m.msg = '';
    const picks = rev.picks || {}, steps = rev.steps = buildSteps(rev), label = pairLabel(picks);
    // trạng thái hiển thị bắt đầu từ HP trước lượt (dựng lại từ dmg nếu vào lại giữa lượt)
    const before = o.before || m.state, start = {};
    for (const side of ['you', 'op']) {
      let hp = before && before[side] ? before[side].hp : rev.state[side].hp;
      if (o.resume) { hp = rev.state[side].hp; for (const s of steps) for (const f of s.fx || []) if (f[0] === 'hp' && f[1] === side) hp += f[2]; hp = Math.min(hp, rev.state[side].hpMax); }
      start[side] = hp;
    }
    m.disp = { you: { hp: start.you }, op: { hp: start.op } };
    for (const side of ['you', 'op']) setBars(U.fc[side], Object.assign({}, rev.state[side], { hp: start[side] }), 'hp');
    U.pickui.hidden = true; rv.root.hidden = false;
    toggleLog(false);
    clear(rv.lines); rv.label.textContent = ''; rv.label.classList.remove('on');
    for (const f of [rv.flipYou, rv.flipOp]) { f.w.classList.remove('on'); f.front.setAttribute('aria-hidden', 'true'); fillFlip(f, picks[f.side] || { skill: M.IDLE_ID }); }
    S.hold = { you: null, op: null }; dirtyStage();
    U.turn.textContent = `Lượt ${rev.turn}`; U.turn.appendChild(h('small', null, ` / ${M.PK.MAX_TURNS}`));
    U.clock.textContent = ''; U.tfill.style.width = '0%';
    U.fc.op.lock.hidden = true;
    addLog(rev, label);
    const R = m.rev = { rev, steps, i: 0, timers: [], done: false, flipped: false, labelled: false, label, picks };
    const avail = rev.nextAt ? rev.nextAt - nowMs() : 4000;
    const instant = o.instant || reduced() || avail < 1400;
    const doFlip = quiet => {
      if (R.flipped) return; R.flipped = true;
      for (const f of [rv.flipYou, rv.flipOp]) {
        f.w.classList.add('on'); f.front.removeAttribute('aria-hidden');
        f.w.setAttribute('aria-label', `${f.side === 'you' ? 'Chiêu của bạn' : 'Chiêu của đối thủ'}: ${f.nm.textContent}`);
      }
      for (const side of ['you', 'op']) { setBars(U.fc[side], rev.state[side], 'mp'); setBars(U.fc[side], rev.state[side], 'rg'); }
    };
    const doLabel = () => { if (R.labelled) return; R.labelled = true; rv.label.textContent = label; rv.label.classList.add('on'); };
    const doStep = (i, quiet) => {
      if (i < R.i) return; R.i = i + 1;
      const s = steps[i];
      rv.lines.appendChild(lineEl(s)); rv.lines.scrollTop = rv.lines.scrollHeight;
      if (s.hold) { S.hold[s.hold[0]] = s.hold[1]; dirtyStage(); }
      if (quiet) return;
      for (const f of s.fx || []) {
        if (f[0] === 'anim') anim(f[1], f[2], f[3]);
        else if (f[0] === 'float') floatAt(f[1], f[2], f[3]);
        else if (f[0] === 'hp') { m.disp[f[1]].hp = Math.max(0, m.disp[f[1]].hp - f[2]); setBars(U.fc[f[1]], Object.assign({}, rev.state[f[1]], { hp: m.disp[f[1]].hp }), 'hp'); }
      }
      dirtyStage();
    };
    R.finish = () => {
      if (R.done) return;
      R.done = true; R.timers.forEach(clearTimeout); R.timers = [];
      doFlip(); doLabel(); for (let i = R.i; i < steps.length; i++) doStep(i, true);
      for (const side of ['you', 'op']) setFighter(side, rev.state[side]);
      m.state = rev.state; m.holdUntil = Date.now() + (rev.ended ? 900 : 0);
      U.status.textContent = '';
      if (rev.ended) rv.lines.appendChild(h('li', 'ar-ln ar-ln-end', 'Trận đấu kết thúc…'));
      dirtyStage();
      maybeEnd();
    };
    if (instant) {
      doFlip(true); doLabel(); steps.forEach((s, i) => doStep(i, true));
      for (const f of [rv.flipYou, rv.flipOp]) f.w.classList.add('on');
      R.finish();
      return;
    }
    const total = Math.max(1200, Math.min(3700, avail - 300)), gap = Math.max(110, Math.min(420, (total - 1500) / Math.max(1, steps.length)));
    const at = (ms, fn) => R.timers.push(setTimeout(fn, ms));
    at(250, doFlip); at(850, doLabel);
    steps.forEach((s, i) => at(1300 + i * gap, () => doStep(i, false)));
    at(1300 + steps.length * gap + 250, R.finish);
  }
  /** Dừng hoạt ảnh lượt đang chạy: giữ hoặc bỏ phần còn lại (settle = true thì chốt luôn trạng thái cuối). */
  function cancelReveal(settle) {
    const m = S.m, R = m && m.rev;
    if (!R || R.done) return;
    if (settle) R.finish(); else { R.timers.forEach(clearTimeout); R.timers = []; }
  }
  function skipReveal() {
    const R = S.m && S.m.rev;
    if (!R || R.done) return;
    for (const f of [S.m.ui.rv.flipYou, S.m.ui.rv.flipOp]) f.w.classList.add('on');
    R.finish();
  }
  function maybeEnd() {
    const m = S.m;
    if (!m || !m.endData) return;
    if (m.rev && !m.rev.done) return;
    const wait = Math.max(0, (m.holdUntil || 0) - Date.now());
    clearTimeout(m.endT);
    m.endT = setTimeout(() => { if (S.m === m && m.endData) showEnd(m.endData); }, wait);
  }

  /* ---------- kết thúc ---------- */
  function endInfo(d) {
    const r = d.reason, res = d.result, who = d.who;
    if (r === 'void') return { title: 'Trận bị hủy', cls: 'void', text: 'Trận bị hủy vì máy chủ khởi động lại hoặc có sự cố. Không ai bị tính thắng hay thua.' };
    if (r === 'both-away') return { title: 'Trận bị hủy', cls: 'void', text: 'Cả hai cùng vắng quá 60 giây nên trận bị hủy. Không ai bị tính thắng hay thua.' };
    const title = res === 'win' ? 'Bạn thắng' : res === 'lose' ? 'Bạn thua' : 'Hòa', cls = res === 'win' ? 'win' : res === 'lose' ? 'lose' : 'draw';
    let text = '';
    const byWho = who || (res === 'win' ? 'op' : 'you');
    if (r === 'ko') text = res === 'win' ? 'Đối thủ hết máu trước.' : 'Bạn hết máu trước.';
    else if (r === 'double-ko') text = 'Cả hai cùng hết máu' + (res === 'win' ? ', nhưng bạn còn ít âm hơn nên thắng.' : res === 'lose' ? ', nhưng đối thủ còn ít âm hơn nên thắng.' : ' và ngang nhau nên hòa.');
    else if (r === 'turn-limit') text = `Hết ${M.PK.MAX_TURNS} lượt. ` + (res === 'win' ? 'Bạn còn nhiều máu hơn nên thắng.' : res === 'lose' ? 'Đối thủ còn nhiều máu hơn nên thắng.' : 'Hai bên còn bằng máu nhau nên hòa.');
    else if (r === 'forfeit') text = byWho === 'you' ? 'Bạn đã bỏ cuộc nên bị xử thua.' : 'Đối thủ đã bỏ cuộc, bạn thắng.';
    else if (r === 'idle-forfeit') text = byWho === 'you' ? 'Bạn bỏ lỡ ba lượt liên tiếp (hết giờ không chọn) nên bị xử thua.' : 'Đối thủ bỏ lỡ ba lượt liên tiếp (hết giờ không chọn) nên bị xử thua.';
    return { title, cls, text };
  }
  function showEnd(d) {
    const m = S.m, sec = clear(S.ui.end);
    if (m) { m.endData = null; clearTimeout(m.endT); }
    cancelReveal(true);
    stopLoopsForEnd();
    const info = endInfo(d), wrap = h('div', 'ar-ewrap ar-e-' + info.cls), card = h('div', 'ar-ecard');
    const name = (m && m.op && m.op.name) || 'Đối thủ', my = (m && m.you && m.you.name) || 'Bạn';
    add(card, h('span', 'eyebrow', info.cls === 'void' ? 'Không tính thắng thua' : 'Kết quả luận võ'), h('h3', 'ar-etitle', info.title, { 'data-focus': '' }), h('p', 'ar-etext', info.text));
    const st = d.state || (m && m.state);
    if (st) {
      const bars = h('div', 'ar-ebars');
      for (const [side, who] of [['you', my + ' (bạn)'], ['op', name]]) {
        const s = st[side], hp = Math.max(0, Math.round(s.hp)), row = h('div', 'ar-er'), tr = h('div', 'ar-m-t'), f = h('i', 'ar-m-f');
        f.style.width = (s.hpMax > 0 ? Math.max(0, Math.min(100, hp / s.hpMax * 100)) : 0) + '%'; f.dataset.lv = hp / s.hpMax > 0.5 ? 'ok' : hp / s.hpMax > 0.25 ? 'mid' : 'low';
        tr.appendChild(f); add(row, h('span', 'ar-er-n', who), tr, h('b', null, `${hp}/${s.hpMax}`)); bars.appendChild(row);
      }
      card.appendChild(bars);
    }
    const facts = h('dl', 'ar-facts');
    const fact = (k, v) => { const w = h('div'); add(w, h('dt', null, k), h('dd', null, v)); facts.appendChild(w); };
    fact('Số lượt', String(num(d.turns, m && m.turn)));
    if (d.record) {
      const r = d.record, delta = info.cls === 'win' ? ' (thắng +1)' : info.cls === 'lose' ? ' (thua +1)' : info.cls === 'draw' ? ' (hòa +1)' : ' (không đổi)';
      fact('Thành tích', `Thắng ${num(r.wins)} · Thua ${num(r.losses)} · Hòa ${num(r.draws)}${delta}`);
    }
    card.appendChild(facts);
    const act = h('div', 'ar-eact'), again = btn('btn primary big', 'Về sân'), hall = btn('btn big', 'Về chánh điện');
    again.addEventListener('click', backToRoster); hall.addEventListener('click', () => S.host.goto('hall'));
    add(act, again, hall); card.appendChild(act);
    if (m && m.ui && m.ui.logList && m.ui.logList.children.length) {
      const dt = h('details', 'ar-edet'), sm = h('summary', null, 'Xem lại nhật ký trận'), ol = h('ol', 'ar-logl');
      for (const li of m.ui.logList.children) ol.appendChild(li.cloneNode(true));
      add(dt, sm, ol); card.appendChild(dt);
    }
    wrap.appendChild(card); sec.appendChild(wrap);
    if (m) m.phase = 'ended';
    go('end');
    say(`${info.title}. ${info.text}`);
  }
  function stopLoopsForEnd() { S.fx.length = 0; }
  function backToRoster() {
    if (S.m) clearTimeout(S.m.endT);
    S.m = null; S.stage = null; dropPaint('lobby'); dropPaint('match');
    go('roster');
  }

  /* ---------- sự kiện từ máy chủ ---------- */
  function onLobby(d) {
    if (!S.visible || !d || !d.you || !d.op) return;
    closeAllDlg();
    S.invites.slice().forEach(i => removeInvite(i.inviteId));
    S.out = null; renderOut();
    clearMatchTimers();
    const youLoad = (d.you.loadout || []).filter(id => (d.you.learned || []).includes(id)).slice(0, 4);
    S.m = {
      id: d.matchId, mode: d.mode, phase: 'lobby', deadline: num(d.deadlineAt), lobbyTotal: Math.max(5000, num(d.loadoutMs, num(d.deadlineAt) - nowMs())), you: d.you, op: d.op, buffs: d.buffs || null,
      learned: Array.isArray(d.you.learned) ? d.you.learned : [], sel: youLoad, locked: false, pending: false, timeUp: false, opReady: false, msg: '', state: null, disp: { you: {}, op: {} }
    };
    buildLobby(); go('lobby'); updLobbyClock(nowMs());
    say('Đã vào sảnh. Chọn 4 chiêu rồi khóa bộ chiêu.');
  }
  function onTurn(d) {
    if (!S.visible || !d) return;
    const m = S.m;
    if (!m || m.id !== d.matchId) { resumeMatch(); return; }
    if (m.phase === 'ended') return;
    if (m.phase === 'lobby' || !m.ui.fc) {
      if (d.loadouts) m.loadouts = d.loadouts;
      m.phase = 'choosing'; buildMatch(); beginTurn(d); go('match');
      return;
    }
    beginTurn(d);
  }
  function onReveal(d) {
    const m = S.m;
    if (!S.visible || !d || !m || m.id !== d.matchId || m.phase === 'ended' || !m.ui.fc) return;
    if (S.screen !== 'match') go('match');
    startReveal(d);
  }
  function onEnd(d) {
    if (!S.visible || !d) return;
    let m = S.m;
    if (!m) { S.m = m = { id: d.matchId, phase: 'choosing', you: { name: 'Bạn' }, op: { name: 'Đối thủ' }, state: d.state, ui: {} }; showEnd(d); return; }
    if (d.matchId && m.id !== d.matchId) return;
    m.endData = d; m.msg = '';
    if (m.rev && !m.rev.done) { maybeEnd(); return; }
    if (S.screen === 'match' && m.phase === 'reveal') { maybeEnd(); return; }
    showEnd(d);
  }
  function clearMatchTimers() {
    const m = S.m;
    if (!m) return;
    clearTimeout(m.endT);
    if (m.rev) { m.rev.timers.forEach(clearTimeout); m.rev.timers = []; }
  }

  /* vào lại giữa trận */
  function resumeMatch(cb) {
    if (!S.sock || !S.connected) { if (cb) cb(); return; }
    S.sock.emit('pk:resume', {}, ack => { applyResume(ack); if (cb) cb(ack); });
  }
  function applyResume(ack) {
    if (!S.mounted || !S.visible) return;
    S.ui.roster.resume.hidden = true;
    if (!ack || !ack.ok) {
      if (ack && ack.code === 'login') setLogin(true);
      else if (ack && ack.reason && ack.code !== 'place') toast(ack.reason);
      return;
    }
    const snap = ack.snapshot;
    if (!snap) {
      const had = inMatch() || (S.m && S.m.phase !== 'ended');
      if (had) { clearMatchTimers(); S.m = null; S.stage = null; dropPaint('lobby'); dropPaint('match'); go('roster'); toast(ack.message || 'Trận trước đã kết thúc khi bạn vắng mặt.'); }
      else if (ack.message) toast(ack.message);
      return;
    }
    clearMatchTimers();
    S.invites.slice().forEach(i => removeInvite(i.inviteId)); S.out = null; renderOut();
    const m = S.m = {
      id: snap.matchId, mode: snap.mode, you: snap.you, op: snap.op, buffs: snap.buffs || null, loadouts: snap.loadouts || null, state: snap.state,
      learned: [], sel: [], locked: false, pending: false, timeUp: false, opReady: !!snap.opLocked, msg: '', disp: { you: {}, op: {} }, log: []
    };
    if (snap.phase === 'lobby') {
      m.phase = 'lobby'; m.deadline = num(snap.deadlineAt); m.lobbyTotal = Math.max(5000, M.PK.LOADOUT_SECONDS * 1000);
      m.sel = (snap.you.loadout || []).slice(0, 4); m.locked = !!snap.myLocked;
      if (snap.loadoutMs) m.lobbyTotal = Math.max(5000, num(snap.loadoutMs));
      const haveLearned = Array.isArray(snap.you.learned);
      m.learned = haveLearned ? snap.you.learned.slice() : m.sel.slice();
      buildLobby(); go('lobby'); updLobbyClock(nowMs());
      // máy chủ không gửi danh sách chiêu đã học: lấy từ hồ sơ để vẫn đổi được bộ chiêu
      if (!haveLearned && !m.locked) S.sock.emit('martial:state', {}, r => {
        if (S.m !== m || !r || !r.ok || !r.profile || !Array.isArray(r.profile.learned) || m.locked) return;
        m.learned = r.profile.learned.slice(); m.sel = m.sel.filter(id => m.learned.includes(id)); buildLobby(); updLobbyClock(nowMs());
      });
      return;
    }
    m.phase = 'choosing'; buildMatch();
    const lr = snap.lastReveal;
    if (snap.phase === 'reveal' && lr) {
      m.turn = lr.turn;
      startReveal(lr, { resume: true, instant: lr.nextAt ? lr.nextAt - nowMs() < 1800 : true });
    } else {
      if (lr) { lr.steps = buildSteps(lr); addLog(lr, pairLabel(lr.picks || {})); }
      beginTurn({ turn: snap.turn, deadlineAt: snap.deadlineAt, forced: snap.forced, legal: snap.legal, state: snap.state }, { myPick: snap.myPick, opLocked: snap.opLocked });
    }
    go('match');
  }

  /* ---------- vòng đời ---------- */
  function refreshCtl() {
    if (!S.mounted || !S.ui) return;
    S.ui.off.hidden = S.connected;
    S.ui.root.classList.toggle('ar-offline', !S.connected);
    renderRoster();
    for (const inv of S.invites) updInvite(inv, nowMs());
    if (S.out) renderOut();
    if (S.m) { if (S.m.phase === 'lobby') renderLobby(); else if (S.m.ui && S.m.ui.cards) renderPickCtl(); }
    S.ui.dMode.send.disabled = !canSend();
  }
  function tick() {
    if (!S.visible || !S.mounted) return;
    const now = nowMs();
    for (const inv of S.invites.slice()) updInvite(inv, now);
    if (S.out) {
      if (S.out.expiresAt - now < -2500) { S.out = null; renderOut(); renderRoster(); }
      else renderOut();
    }
    const m = S.m;
    if (m && S.screen === 'lobby') updLobbyClock(now);
    else if (m && S.screen === 'match' && m.phase === 'choosing') updTurnClock(now);
  }
  function setConn(on) {
    S.connected = on;
    refreshCtl();
  }

  function init(host) {
    if (S.host) return;
    S.host = host; S.sock = host.socket;
    S.connected = S.sock.connected !== false;
    const on = (ev, fn) => S.sock.on(ev, d => { try { fn(d); } catch (e) { console.error('[arena]', ev, e); } });
    on('connect', () => setConn(true)); on('disconnect', () => setConn(false));
    on('arena:add', p => { if (!p || p.pid == null) return; S.players.set(p.pid, p); if (S.mounted) renderRoster(); });
    on('arena:del', d => { if (d) { S.players.delete(d.pid); if (S.mounted) renderRoster(); } });
    on('arena:upd', d => { const p = d && S.players.get(d.pid); if (p) { Object.assign(p, d); if (S.mounted) renderRoster(); } });
    on('pk:invited', onInvited); on('pk:invite:closed', onInviteClosed);
    on('pk:lobby', onLobby);
    on('pk:lobby:status', d => { const m = S.m; if (S.visible && m && d && m.id === d.matchId && d.opLocked) { m.opReady = true; if (m.phase === 'lobby') renderLobby(); } });
    on('pk:turn', onTurn); on('pk:reveal', onReveal); on('pk:end', onEnd);
    on('pk:locked', d => { const m = S.m; if (S.visible && m && d && m.id === d.matchId && m.phase === 'choosing' && m.turn === d.turn) { m.opLocked = true; renderPickCtl(); } });
  }

  function show(info) {
    if (!S.mounted) return;
    S.visible = true;
    const a = (info && info.arena) || {}, cfg = S.host.cfg ? S.host.cfg() : {}, mc = (cfg && cfg.martial) || {};
    // vào lại / mất mạng rồi nối lại: làm mới danh sách, bỏ lời mời cũ (máy chủ đã quên)
    S.players.clear();
    for (const p of a.players || []) S.players.set(p.pid, p);
    S.dnd = !!a.dnd;
    for (const row of S.rows.values()) row.li.remove();
    S.rows.clear();
    S.invites.slice().forEach(i => removeInvite(i.inviteId)); S.out = null; renderOut();
    const au = S.host.auth ? S.host.auth() : null;
    S.loginNeeded = !!(mc.loginRequired && au && au.enabled !== false && !au.signedIn);
    S.ui.roster.login.hidden = !S.loginNeeded;
    if (a.enabled === false) { S.ui.roster.emptyT.textContent = 'Sân đấu chưa mở.'; S.ui.roster.emptyS.textContent = 'Nhà chùa chưa mở sân đấu. Bạn quay lại sau nhé.'; }
    else { S.ui.roster.emptyT.textContent = 'Sân đang vắng.'; S.ui.roster.emptyS.textContent = 'Chưa có đạo hữu nào ra luận võ. Bạn cứ chờ một lát, hoặc rủ bạn bè cùng ra sân. Có người vào là thấy ngay ở đây.'; }
    if (S.screen === 'end') { S.m = null; S.stage = null; dropPaint('lobby'); dropPaint('match'); }
    if (S.screen !== 'lobby' && S.screen !== 'match') go('roster'); else refreshCtl();
    S.ui.roster.resume.hidden = !a.hasMatch;
    clearInterval(S.tick); S.tick = setInterval(tick, 250);
    S.connected = S.sock.connected !== false;
    refreshCtl();
    if (S.loginNeeded) { S.ui.roster.resume.hidden = true; return; }
    resumeMatch(() => { S.ui.roster.resume.hidden = true; });
  }
  function hide() {
    S.visible = false;
    clearInterval(S.tick); S.tick = 0; stopPaint();
    clearMatchTimers();
    if (S.mounted) {
      closeAllDlg();
      S.invites.slice().forEach(i => removeInvite(i.inviteId)); S.out = null;
      S.m = null; S.stage = null; S.fx.length = 0; dropPaint('lobby'); dropPaint('match');
      if (S.screen !== 'roster') go('roster');
    }
  }

  root.Arena = { init, mount, show, hide, inMatch };
})(this);
