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
    balanced: { name: 'Luận võ', desc: 'Nội công, pháp tướng, quỷ ám và hào quang đều ảnh hưởng sức mạnh.' },
    buff: { name: 'Luận võ', desc: 'Pháp tướng, quỷ ám và hào quang cúng dường có tác dụng. Hai bên thấy buff của nhau trước khi nhận lời.' }
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
    players: new Map(), rows: new Map(), dnd: false, dndBusy: false, invites: [], out: null, lastMode: 'buff',
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
  const HIDDEN_SKILLS = {
    'tau-vi-thuong-sach': { name: 'Tẩu Vi Thượng Sách', kind: 'rest', mana: 0, short: 'Cưỡng chế hòa trận', desc: 'Kết thúc trận với kết quả hòa. Mỗi trận một lần.' },
    'nhu-lai-than-chuong': { name: 'Như Lai Thần Chưởng', kind: 'atk', mana: 30, hits: [{ base: 180, spd: 20 }], short: 'Chưởng xuyên thủ', desc: 'Tung ngay sát thương chuẩn, không thể né. Mỗi trận một lần.' }
  };
  const skillOf = id => M.SKILLS[id] || M.SPECIAL[id] || HIDDEN_SKILLS[id] || null;
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

  Object.assign(S, { efx: [], parts: [], body: {}, shake: null, shieldHit: {} });
  /* ---------- sân khấu trận: lôi đài, hai nhân vật đối mặt, biên đạo theo diễn biến từng lượt ----------
     Bạn đứng bên trái, đối thủ bên phải, cả hai quay mặt ra ngoài. Mọi hình đều vẽ bằng mã (Canvas 2D), không dùng ảnh.
       S.fx    các đòn đang diễn (chuyển động nhân vật): { type: 'strike' | 'flinch', t0, dur, … }
       S.efx   hiệu ứng một lần: vòng sóng, chớp va chạm, vệt chém, chưởng bay, thái cực, nứt đất, chớp màn…
       S.parts hạt: tia lửa, bụi, lá liễu, mây, đá vụn, linh khí (giới hạn số lượng)
       S.hold  thế giữ suốt lượt của mỗi bên: thủ (chuông vàng, tường sắt, phân thân, cầu nước), tụ lực, tung đòn tụ lực, điều tức, đứng yên */
  const BR_COL = { cuong: '#ec7b6c', toc: '#e8c477', nhu: '#86b38a' };
  const STRIKE = { 'trong-quyen': 'fist', 'tat-phong-quyen': 'rush', 'lien-hoan-cuoc': 'kick', 'lieu-diep-chuong': 'palm', 'doat-anh-phan-kich': 'shadow', 'tu-luc-pha-son': 'smash' };
  const COUNTER = { 'phan-chan': 'shock', 'tiep-kinh-phan-chuong': 'taiji', 'tu-lang-bat-thien-can': 'taijiBig', 'doat-anh-phan-kich': 'shadow' };
  const SHIELD = { 'kim-chung-trao': 'bell', 'thiet-bich': 'iron', 'anh-bo-ho-than': 'clones', 'ta-luc-hoa-giai': 'water' };
  const DODGE = { 'khinh-than-bo': 'swift', 'nhu-van-bo': 'cloud' };
  const BY_BRANCH = {
    strike: { cuong: 'fist', toc: 'rush', nhu: 'palm' }, counter: { cuong: 'shock', toc: 'shadow', nhu: 'taiji' },
    shield: { cuong: 'iron', toc: 'clones', nhu: 'water' }, dodge: { cuong: 'swift', toc: 'swift', nhu: 'cloud' }
  };
  const MOTION = { fist: 'fist', rush: 'rush', kick: 'kick', palm: 'palm', shadow: 'shadow', smash: 'smash', shock: 'fist', taiji: 'palm', taijiBig: 'palm' };
  const colOf = id => { const s = skillOf(id); return (s && BR_COL[s.branch]) || '#e8c477'; };
  const styleOf = (map, kind, id) => map[id] || BY_BRANCH[kind][(skillOf(id) || {}).branch] || BY_BRANCH[kind].cuong;
  const clamp01 = x => (x < 0 ? 0 : x > 1 ? 1 : x);
  const ease = x => { x = clamp01(x); return x * x * (3 - 2 * x); };
  const easeOut = x => { x = clamp01(x); return 1 - (1 - x) * (1 - x); };
  const seg = (p, a, b) => (p - a) / (b - a);
  const bump = x => (x <= 0 || x >= 1 ? 0 : Math.sin(Math.PI * x));
  const rnd = (a, b) => a + Math.random() * (b - a);
  function rgba(hex, a) { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${clamp01(a).toFixed(3)})`; }
  function glowAt(c, x, y, r, col, a) {
    if (a <= 0.004 || r <= 0) return;
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, rgba(col, a)); g.addColorStop(0.5, rgba(col, a * 0.35)); g.addColorStop(1, rgba(col, 0));
    c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
  }
  const holdOf = side => { const v = S.hold[side]; return !v ? null : typeof v === 'string' ? { k: v, t0: 0 } : v; };

  /** Toạ độ sân khấu theo khung hiện tại: chân hai người cùng một hàng trên mặt lôi đài. */
  function stageGeo(W, H) {
    const s = Math.min(H / 152, W / 240), fy = H * 0.84;
    return { W, H, s, fy, top: H * 0.6, front: H * 0.9, span: W * 0.42, you: { x: W * 0.29, dir: 1 }, op: { x: W * 0.71, dir: -1 } };
  }

  /* nền tĩnh (vẽ một lần cho mỗi cỡ khung): trời đêm, tường chùa, sân đá, lôi đài sơn son thếp vàng */
  function stageBg(W, H, k) {
    const cv = document.createElement('canvas'); cv.width = Math.max(1, Math.round(W * k)); cv.height = Math.max(1, Math.round(H * k));
    const c = cv.getContext('2d'); c.setTransform(k, 0, 0, k, 0, 0);
    const G = stageGeo(W, H), hz = H * 0.5, wy = hz - H * 0.17;
    let g = c.createLinearGradient(0, 0, 0, hz);
    g.addColorStop(0, '#120a10'); g.addColorStop(0.65, '#2a1712'); g.addColorStop(1, '#3f2418');
    c.fillStyle = g; c.fillRect(0, 0, W, hz);
    glowAt(c, W * 0.5, wy, W * 0.5, '#d98a4a', 0.12);                                   // ánh đèn hắt lên trời
    glowAt(c, W * 0.86, H * 0.15, Math.max(20, H * 0.22), '#f3dca0', 0.16);              // trăng
    c.fillStyle = 'rgba(246,232,196,.6)'; c.beginPath(); c.arc(W * 0.86, H * 0.15, Math.max(4, H * 0.04), 0, TAU); c.fill();
    c.fillStyle = 'rgba(255,240,210,.35)';
    for (let i = 0; i < 14; i++) { const x = (Math.sin(i * 91.7) * 0.5 + 0.5) * W, y = (Math.sin(i * 37.1) * 0.5 + 0.5) * wy * 0.75; c.fillRect(x, y, 1, 1); }
    // tường chùa xa, mái ngói, cửa sổ tròn
    g = c.createLinearGradient(0, wy, 0, hz); g.addColorStop(0, '#5a3421'); g.addColorStop(1, '#3a2016');
    c.fillStyle = g; c.fillRect(0, wy, W, hz - wy);
    c.fillStyle = 'rgba(214,170,100,.1)'; c.fillRect(0, wy + (hz - wy) * 0.22, W, Math.max(1, (hz - wy) * 0.1));
    const rr = Math.max(4, (hz - wy) * 0.22);
    for (let x = W * 0.08; x < W; x += Math.max(60, W * 0.17)) {
      const y = wy + (hz - wy) * 0.6;
      c.fillStyle = '#1d0f0a'; c.beginPath(); c.arc(x, y, rr, 0, TAU); c.fill();
      c.strokeStyle = 'rgba(212,171,82,.45)'; c.lineWidth = 1; c.stroke();
      c.beginPath(); c.moveTo(x - rr, y); c.lineTo(x + rr, y); c.moveTo(x, y - rr); c.lineTo(x, y + rr); c.stroke();
    }
    const rh = H * 0.055;
    c.fillStyle = '#1f120d'; c.beginPath(); c.moveTo(-4, wy + 2); c.lineTo(W + 4, wy + 2); c.lineTo(W + 4, wy - rh * 0.55); c.quadraticCurveTo(W * 0.5, wy - rh, -4, wy - rh * 0.55); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(120,80,50,.35)'; c.lineWidth = 1; c.beginPath();
    for (let x = 4; x < W; x += Math.max(5, 7 * G.s)) { c.moveTo(x, wy + 1); c.lineTo(x, wy - rh * 0.6); }
    c.stroke();
    c.strokeStyle = '#c99a45'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(0, wy + 1.5); c.lineTo(W, wy + 1.5); c.stroke();
    // sân lát đá
    g = c.createLinearGradient(0, hz, 0, H); g.addColorStop(0, '#3d2c22'); g.addColorStop(1, '#1b120c');
    c.fillStyle = g; c.fillRect(0, hz, W, H - hz);
    c.strokeStyle = 'rgba(230,200,160,.08)'; c.lineWidth = 1; c.beginPath();
    for (let i = -10; i <= 10; i++) { c.moveTo(W / 2 + i * W * 0.06, hz); c.lineTo(W / 2 + i * W * 0.2, H); }
    for (let j = 1; j <= 5; j++) { const y = hz + (H - hz) * Math.pow(j / 5, 1.5); c.moveTo(0, y); c.lineTo(W, y); }
    c.stroke();
    // lôi đài: mặt sàn gỗ, viền vàng, mặt trước sơn son
    const bx0 = W * 0.1, bx1 = W * 0.9, fx0 = W * 0.02, fx1 = W * 0.98, tb = G.top, tf = G.front, fh = H * 0.075;
    c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.ellipse(W / 2, tf + fh, W * 0.5, H * 0.05, 0, 0, TAU); c.fill();
    g = c.createLinearGradient(0, tb, 0, tf); g.addColorStop(0, '#5a2f19'); g.addColorStop(1, '#7a4222');
    c.fillStyle = g; c.beginPath(); c.moveTo(bx0, tb); c.lineTo(bx1, tb); c.lineTo(fx1, tf); c.lineTo(fx0, tf); c.closePath(); c.fill();
    c.save(); c.clip();
    c.strokeStyle = 'rgba(30,12,6,.45)'; c.lineWidth = 1; c.beginPath();
    for (let i = 1; i < 14; i++) { const q = i / 14; c.moveTo(bx0 + (bx1 - bx0) * q, tb); c.lineTo(fx0 + (fx1 - fx0) * q, tf); }
    c.stroke();
    g = c.createLinearGradient(0, tb, 0, tf); g.addColorStop(0, 'rgba(255,214,150,0)'); g.addColorStop(0.55, 'rgba(255,214,150,.08)'); g.addColorStop(1, 'rgba(255,214,150,0)');
    c.fillStyle = g; c.fillRect(0, tb, W, tf - tb);
    c.strokeStyle = 'rgba(212,171,82,.28)'; c.lineWidth = 1.3; c.beginPath(); c.ellipse(W / 2, (tb + tf) / 2 + H * 0.02, W * 0.3, (tf - tb) * 0.32, 0, 0, TAU); c.stroke();
    c.restore();
    c.strokeStyle = '#d4ab52'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(bx0, tb); c.lineTo(bx1, tb); c.lineTo(fx1, tf); c.lineTo(fx0, tf); c.closePath(); c.stroke();
    g = c.createLinearGradient(0, tf, 0, tf + fh); g.addColorStop(0, '#9a271c'); g.addColorStop(1, '#4e100b');
    c.fillStyle = g; c.fillRect(fx0, tf, fx1 - fx0, fh);
    c.strokeStyle = '#d4ab52'; c.lineWidth = 1.2; c.strokeRect(fx0, tf, fx1 - fx0, fh);
    c.strokeStyle = 'rgba(212,171,82,.55)'; c.lineWidth = 1;
    const n = Math.max(5, Math.round(W / 70));
    for (let i = 0; i < n; i++) {                                                        // đồng tiền cổ trang trí mặt trước
      const x = fx0 + (fx1 - fx0) * (i + 0.5) / n, y = tf + fh / 2, r = Math.min(fh * 0.32, 9);
      c.beginPath(); c.arc(x, y, r, 0, TAU); c.stroke(); c.strokeRect(x - r * 0.35, y - r * 0.35, r * 0.7, r * 0.7);
    }
    // cột góc sau và dây thừng đỏ
    for (const x of [bx0, bx1]) {
      const ph = H * 0.15;
      c.fillStyle = '#6e1a13'; c.fillRect(x - 3, tb - ph, 6, ph);
      c.fillStyle = '#d4ab52'; c.beginPath(); c.arc(x, tb - ph, 4, 0, TAU); c.fill();
    }
    c.strokeStyle = '#b5302a'; c.lineWidth = 2; c.beginPath(); c.moveTo(bx0, tb - H * 0.12); c.quadraticCurveTo(W / 2, tb - H * 0.07, bx1, tb - H * 0.12); c.stroke();
    return cv;
  }

  /* phần động của nền: cờ phướn bay, đèn lồng lung linh */
  function drawProps(c, G, t) {
    const { W, H } = G;
    for (const [x, sd] of [[W * 0.1, 1], [W * 0.9, -1]]) {
      const top = H * 0.05, bw = Math.max(16, W * 0.055), bh = H * 0.3, w = Math.sin(t * 1.6 + sd) * bw * 0.12;
      c.fillStyle = '#3a2016'; c.fillRect(x - 1.5, top - 3, 3, G.top - top - H * 0.15 + 3);
      c.fillStyle = '#c99a45'; c.fillRect(x - bw * 0.7, top - 2, bw * 1.4, 3);
      c.beginPath(); c.moveTo(x - bw / 2, top); c.lineTo(x + bw / 2, top);
      c.lineTo(x + bw / 2 + w, top + bh); c.lineTo(x + w * 0.5, top + bh - bw * 0.35); c.lineTo(x - bw / 2 + w, top + bh); c.closePath();
      const g = c.createLinearGradient(x - bw / 2, 0, x + bw / 2, 0); g.addColorStop(0, '#6e1a13'); g.addColorStop(0.5, '#a3271c'); g.addColorStop(1, '#6e1a13');
      c.fillStyle = g; c.fill(); c.strokeStyle = '#d4ab52'; c.lineWidth = 1; c.stroke();
      const cy = top + bh * 0.36, r = bw * 0.36;
      c.strokeStyle = 'rgba(232,196,119,.9)'; c.beginPath(); c.arc(x + w * 0.3, cy, r, 0, TAU); c.stroke();
      c.fillStyle = '#efcd7c'; c.font = `700 ${Math.round(r * 1.2)}px "Cormorant Garamond", Georgia, serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText('武', x + w * 0.3, cy + 0.5);
    }
    const lr = Math.max(6, Math.min(H * 0.055, W * 0.03));
    for (const x of [lr + 3, W - lr - 3]) {                                            // đèn lồng hai góc
      const y = H * 0.24, r = lr, fl = 0.85 + 0.15 * Math.sin(t * 7 + x) + 0.05 * Math.sin(t * 17);
      c.strokeStyle = '#7a5a2a'; c.lineWidth = 1; c.beginPath(); c.moveTo(x, 0); c.lineTo(x, y - r); c.stroke();
      glowAt(c, x, y, r * 6, '#ff9a4a', 0.22 * fl);
      const lg = c.createRadialGradient(x - r * 0.3, y - r * 0.3, 1, x, y, r * 1.2); lg.addColorStop(0, '#ff7a45'); lg.addColorStop(1, '#a3180f');
      c.fillStyle = lg; c.beginPath(); c.ellipse(x, y, r * 0.85, r, 0, 0, TAU); c.fill();
      c.fillStyle = '#d4ab52'; c.fillRect(x - r * 0.45, y - r - 2, r * 0.9, 3); c.fillRect(x - r * 0.45, y + r - 1, r * 0.9, 3);
    }
  }

  /* ----- biên đạo: tư thế mỗi bên theo các đòn đang diễn ----- */
  function strikePose(P, side, a, p) {
    const motion = MOTION[a.style] || 'fist', pI = a.pI;
    const pA = a.first ? (motion === 'rush' ? 0.26 : motion === 'palm' ? 0.3 : motion === 'smash' ? 0.5 : 0.38) : 0;
    const pR = a.last ? Math.min(0.9, pI + (a.first ? 0.2 : 0.26)) : 2;
    if (side === a.atk) {
      P.front = true;
      const reach = a.reach;
      let x = p < pA ? reach * (motion === 'rush' ? easeOut(p / pA) : ease(p / pA)) : p < pR ? reach : reach * (1 - ease(seg(p, pR, 1)));
      if (a.result === 'parry' && p > pI) x -= 0.18 * bump(seg(p, pI, pI + 0.5)) * reach;            // bị đỡ: bật ngược lại
      P.dx += x;
      if (motion === 'smash' && a.first && p < pI) P.dy -= 34 * bump(p / pI);                       // nhảy vọt lên rồi giáng xuống
      if (motion === 'shadow' && a.first && p < pA + 0.04) P.alpha = Math.max(0.05, Math.abs(1 - 2 * clamp01(p / (pA + 0.04))));   // lướt ảnh: mờ đi, hiện ra sát đối thủ
      if (motion === 'rush' && a.first && p < pA + 0.06) P.ghosts = [[-0.1, 0.34], [-0.2, 0.22], [-0.3, 0.12]];
      const ext = p < pI ? ease(seg(p, pI - 0.15, pI)) : 1 - ease(seg(p, pI + 0.05, pI + 0.22));
      if (motion === 'kick') { P.kick = Math.max(P.kick, ext); P.rot += (a.idx % 2 ? 0 : 0.12) * ext; } else P.arm = Math.max(P.arm, ext);
      P.lean += (a.result === 'dodge' && p > pI ? 0.9 : 0.6) * ext;                              // đánh hụt thì chúi người theo đà
      P.crouch = Math.max(P.crouch, motion === 'smash' ? 0.55 * ext : 0.22);
      P.guard = Math.min(P.guard, 0.4);
      return;
    }
    if (side !== a.def || a.clash) return;
    if (a.result === 'dodge') {
      const q = seg(p, pI - 0.16, pI + 0.32), b = bump(q);
      if (b > 0) {
        P.dx -= 0.16 * b; P.dy -= (a.dstyle === 'cloud' ? 12 : 26) * b; P.lean -= 0.5 * b; P.crouch = Math.max(P.crouch, 0.2);
        P.ghosts = a.dstyle === 'swift' ? [[0.16 * b * 0.35, 0.3 * b], [0.16 * b * 0.7, 0.18 * b]] : [[0.16 * b, 0.25 * b]];
      }
      return;
    }
    if (a.result === 'parry') {
      const q = seg(p, pI - 0.22, pI + 0.3);
      if (q > 0 && q < 1) { P.guard = 1; P.crouch = Math.max(P.crouch, 0.32); P.lean -= 0.12 * bump(q); P.dx -= 0.02 * bump(q); }
      return;
    }
    if (a.tried === 'dodge' && p < pI) { const b = ease(seg(p, pI - 0.18, pI)); P.lean -= 0.3 * b; P.dx -= 0.03 * b; }
    if (a.tried === 'parry' && p < pI) P.guard = Math.max(P.guard, ease(seg(p, pI - 0.2, pI)));
    if (a.result === 'hit' && p >= pI) {
      const q = clamp01(seg(p, pI, Math.min(1, pI + 0.36))), kb = a.big ? 0.16 : 0.08;
      P.dx -= kb * (q < 0.3 ? easeOut(q / 0.3) : 1 - ease((q - 0.3) / 0.7));
      P.hit = Math.max(P.hit, 1 - q); P.lean -= 0.6 * bump(q); P.crouch = Math.max(P.crouch, 0.25 * bump(q)); P.guard = Math.min(P.guard, 0.2);
      if (a.big) P.dy -= 14 * bump(q);
    }
  }
  function poseOf(side, ts) {
    const P = { dx: 0, dy: 0, rot: 0, alpha: 1, ghosts: null, hit: 0, crouch: 0.14, lean: 0.05, arm: 0, kick: 0, guard: 0.45, bow: 0, front: false };
    const hd = holdOf(side);
    if (hd) {
      if (hd.k === 'guard') { P.guard = 0.95; P.crouch = 0.28; }
      else if (hd.k === 'charge') { P.crouch = 0.55; P.guard = 0.7; P.lean = -0.12; }
      else if (hd.k === 'release') { P.crouch = 0.6; P.guard = 0.25; P.lean = 0.2; }
      else if (hd.k === 'rest') { P.crouch = 0.85; P.guard = 0; P.bow = 0.22; P.lean = 0; }
      else if (hd.k === 'idle') { P.crouch = 0; P.guard = 0; P.lean = -0.06; }
    }
    if (reduced()) return P;
    for (const a of S.fx) {
      const p = (ts - a.t0) / a.dur;
      if (p < 0 || p > 1.05) continue;
      if (a.type === 'strike') strikePose(P, side, a, clamp01(p));
      else if (a.type === 'flinch' && a.side === side) { const b = bump(p); P.hit = Math.max(P.hit, b); P.dx -= 0.04 * b; P.lean -= 0.4 * b; P.guard = 0; }
    }
    return P;
  }
  const dirtyStage = () => { if (S.stage) S.stage.dirty = true; };
  const resetStageFx = () => { S.fx.length = 0; S.efx.length = 0; S.parts.length = 0; S.shake = null; };

  /* ----- hạt ----- */
  function part(o) { if (S.parts.length >= 260) S.parts.shift(); S.parts.push(Object.assign({ vx: 0, vy: 0, gy: 0, life: 0, max: 700, r: 2, rot: 0, vr: 0, drag: 0 }, o)); }
  function burst(x, y, n, o) {
    for (let i = 0; i < n; i++) {
      const an = (o.an != null ? o.an : 0) + rnd(-(o.spread || Math.PI), o.spread || Math.PI), sp = rnd(o.v0 || 60, o.v1 || 220);
      part({ x, y, vx: Math.cos(an) * sp, vy: Math.sin(an) * sp, gy: o.gy || 0, max: rnd(o.l0 || 380, o.l1 || 760), r: rnd(o.r0 || 1.2, o.r1 || 2.6), kind: o.kind || 'spark', col: o.col || '#ffd38a', rot: rnd(0, TAU), vr: rnd(-8, 8), drag: o.drag || 0 });
    }
  }
  function drawParts(c, dt) {
    const k = dt / 1000;
    c.save();
    for (let i = S.parts.length - 1; i >= 0; i--) {
      const p = S.parts[i];
      p.life += dt;
      if (p.life >= p.max) { S.parts.splice(i, 1); continue; }
      if (p.to) { p.x += (p.to.x - p.x) * Math.min(1, k * 3.2); p.y += (p.to.y - p.y) * Math.min(1, k * 3.2); }
      p.vy += p.gy * k; if (p.drag) { p.vx *= 1 - p.drag * k; p.vy *= 1 - p.drag * k; }
      p.x += p.vx * k; p.y += p.vy * k; p.rot += p.vr * k;
      if (p.floor && p.y > p.floor) { p.y = p.floor; p.vy *= -0.3; p.vx *= 0.6; }
      const q = p.life / p.max, a = q < 0.15 ? q / 0.15 : 1 - (q - 0.15) / 0.85;
      if (p.kind === 'spark') {
        c.globalCompositeOperation = 'lighter'; c.strokeStyle = rgba(p.col, a); c.lineWidth = p.r * 0.7; c.lineCap = 'round';
        c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x - p.vx * 0.035, p.y - p.vy * 0.035); c.stroke();
      } else if (p.kind === 'ember') { c.globalCompositeOperation = 'lighter'; glowAt(c, p.x, p.y, p.r * 3, p.col, 0.7 * a); }
      else if (p.kind === 'leaf') {
        c.globalCompositeOperation = 'source-over'; c.save(); c.translate(p.x, p.y); c.rotate(p.rot); c.fillStyle = rgba(p.col, 0.9 * a);
        c.beginPath(); c.moveTo(-p.r * 2.4, 0); c.quadraticCurveTo(0, -p.r, p.r * 2.4, 0); c.quadraticCurveTo(0, p.r, -p.r * 2.4, 0); c.fill(); c.restore();
      } else if (p.kind === 'cloud' || p.kind === 'dust') {
        c.globalCompositeOperation = 'source-over'; c.fillStyle = rgba(p.col, (p.kind === 'cloud' ? 0.32 : 0.3) * a);
        c.beginPath(); c.arc(p.x, p.y, p.r * (1 + q * 1.4), 0, TAU); c.fill();
      } else if (p.kind === 'rock') {
        c.globalCompositeOperation = 'source-over'; c.save(); c.translate(p.x, p.y); c.rotate(p.rot); c.fillStyle = rgba(p.col, Math.min(1, a * 1.5));
        c.beginPath(); c.moveTo(-p.r, -p.r * 0.6); c.lineTo(p.r * 0.8, -p.r); c.lineTo(p.r, p.r * 0.5); c.lineTo(-p.r * 0.4, p.r); c.closePath(); c.fill(); c.restore();
      }
    }
    c.restore();
  }

  /* ----- hiệu ứng một lần ----- */
  function fxAdd(k, o, delay) { if (S.efx.length > 40) S.efx.shift(); S.efx.push(Object.assign({ k, t0: performance.now() + (delay || 0), dur: 500 }, o)); }
  function taiji(c, x, y, r, rot, a, col) {
    c.save(); c.translate(x, y); c.rotate(rot); c.globalAlpha *= a;
    c.fillStyle = 'rgba(240,250,240,.85)'; c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill();
    c.fillStyle = rgba(col, 0.95); c.beginPath(); c.arc(0, 0, r, -Math.PI / 2, Math.PI / 2); c.arc(0, r / 2, r / 2, Math.PI / 2, -Math.PI / 2, true); c.arc(0, -r / 2, r / 2, Math.PI / 2, -Math.PI / 2); c.fill();
    c.fillStyle = rgba(col, 0.95); c.beginPath(); c.arc(0, -r / 2, r * 0.13, 0, TAU); c.fill();
    c.fillStyle = 'rgba(240,250,240,.95)'; c.beginPath(); c.arc(0, r / 2, r * 0.13, 0, TAU); c.fill();
    c.strokeStyle = rgba('#e8ffe9', 0.8); c.lineWidth = Math.max(1, r * 0.06); c.beginPath(); c.arc(0, 0, r, 0, TAU); c.stroke();
    c.restore();
  }
  const EFX = {
    ring(c, e, q) {                                       // vòng sóng xung kích (flat < 1: vòng trên mặt sàn)
      const r = e.r0 + (e.r1 - e.r0) * easeOut(q);
      c.globalCompositeOperation = 'lighter'; c.strokeStyle = rgba(e.col, 0.9 * (1 - q)); c.lineWidth = Math.max(1, e.w * (1 - q));
      c.beginPath(); c.ellipse(e.x, e.y, r, r * (e.flat || 1), 0, 0, TAU); c.stroke();
    },
    star(c, e, q) {                                       // chớp va chạm hình sao
      const r = e.r * (0.5 + 0.8 * easeOut(q)), a = 1 - q;
      c.globalCompositeOperation = 'lighter'; glowAt(c, e.x, e.y, r * 2.2, e.col, 0.7 * a);
      c.fillStyle = rgba('#fff6e0', 0.95 * a); c.beginPath();
      for (let i = 0; i < 20; i++) { const an = i * TAU / 20 + e.rot, rad = i % 2 ? r * 0.28 : r * (i % 4 ? 0.8 : 1); c.lineTo(e.x + Math.cos(an) * rad, e.y + Math.sin(an) * rad); }
      c.closePath(); c.fill();
    },
    slash(c, e, q) {                                      // vệt chém / vệt cước hình trăng khuyết
      const grow = easeOut(Math.min(1, q * 2.4)), a = q < 0.45 ? 1 : 1 - (q - 0.45) / 0.55;
      const a0 = e.a0, a1 = e.a0 + (e.a1 - e.a0) * grow, r = e.r;
      c.globalCompositeOperation = 'lighter';
      c.fillStyle = rgba(e.col, 0.8 * a); c.beginPath(); c.arc(e.x, e.y, r, a0, a1, e.a1 < e.a0); c.arc(e.x + Math.cos((a0 + a1) / 2) * r * 0.18, e.y + Math.sin((a0 + a1) / 2) * r * 0.18, r * 0.86, a1, a0, e.a1 >= e.a0); c.closePath(); c.fill();
      c.strokeStyle = rgba('#fff8e8', 0.85 * a); c.lineWidth = Math.max(1, r * 0.05); c.beginPath(); c.arc(e.x, e.y, r, a0, a1, e.a1 < e.a0); c.stroke();
    },
    wave(c, e, q, ts) {                                   // chưởng lực bay: lá liễu / thái cực / sóng khí
      const x = e.x0 + (e.x1 - e.x0) * easeOut(q), y = e.y0 + (e.y1 - e.y0) * q + Math.sin(q * Math.PI) * e.arc;
      c.globalCompositeOperation = 'lighter';
      for (let i = 4; i >= 0; i--) { const k = Math.max(0, q - i * 0.05), tx = e.x0 + (e.x1 - e.x0) * easeOut(k); glowAt(c, tx, e.y0 + (e.y1 - e.y0) * k + Math.sin(k * Math.PI) * e.arc, e.r * (1.6 - i * 0.18), e.col, 0.45 - i * 0.07); }
      if (e.shape === 'taiji') { c.globalCompositeOperation = 'source-over'; taiji(c, x, y, e.r * 0.9, ts / 120, 0.9, e.col); }
      else {
        c.save(); c.translate(x, y); c.scale(Math.sign(e.x1 - e.x0) || 1, 1);
        c.fillStyle = rgba('#f4ffe8', 0.9); c.beginPath(); c.moveTo(e.r * 1.4, 0); c.quadraticCurveTo(0, -e.r * 0.9, -e.r * 1.2, 0); c.quadraticCurveTo(0, e.r * 0.9, e.r * 1.4, 0); c.fill();
        c.restore();
      }
      if (Math.random() < 0.5) part({ x, y: y + rnd(-e.r, e.r) * 0.5, vx: rnd(-40, 40), vy: rnd(-30, 40), max: 600, r: Math.max(1.4, e.r * 0.22), kind: e.shape === 'taiji' ? 'ember' : 'leaf', col: e.leaf || e.col, vr: rnd(-6, 6), drag: 1.5 });
    },
    speed(c, e, q) {                                      // vệt gió khi lướt nhanh
      c.globalCompositeOperation = 'lighter'; c.strokeStyle = rgba(e.col, 0.55 * (1 - q)); c.lineCap = 'round';
      for (const l of e.lines) { c.lineWidth = l.w; c.beginPath(); const x0 = e.x0 + (e.x1 - e.x0) * l.s, x1 = x0 + (e.x1 - e.x0) * l.l * (0.4 + 0.6 * q); c.moveTo(x0, l.y); c.lineTo(x1, l.y); c.stroke(); }
    },
    taiji(c, e, q, ts) {                                  // vòng thái cực xoay khi hóa giải
      const a = q < 0.2 ? q / 0.2 : q > 0.7 ? 1 - (q - 0.7) / 0.3 : 1;
      c.globalCompositeOperation = 'lighter'; glowAt(c, e.x, e.y, e.r * 1.9, e.col, 0.45 * a);
      c.globalCompositeOperation = 'source-over'; taiji(c, e.x, e.y, e.r * (0.7 + 0.3 * easeOut(q * 2)), (e.spin || 1) * ts / 160, 0.85 * a, e.col);
    },
    crack(c, e, q) {                                      // nứt sàn lôi đài
      const len = Math.min(1, q * 3.5), a = q < 0.7 ? 1 : 1 - (q - 0.7) / 0.3;
      c.globalCompositeOperation = 'source-over'; c.lineCap = 'round'; c.lineJoin = 'round';
      for (const L of e.lines) {
        const n = Math.max(2, Math.ceil(L.length * len));
        c.strokeStyle = rgba('#140803', 0.9 * a); c.lineWidth = e.w; c.beginPath(); c.moveTo(L[0][0], L[0][1]);
        for (let i = 1; i < n; i++) c.lineTo(L[i][0], L[i][1]);
        c.stroke();
        c.strokeStyle = rgba('#ff9a4a', 0.75 * a * (1 - q)); c.lineWidth = e.w * 0.4; c.stroke();
      }
    },
    flash(c, e, q, ts, G) { c.globalCompositeOperation = 'source-over'; c.fillStyle = rgba(e.col, e.a * (1 - q)); c.fillRect(-20, -20, G.W + 40, G.H + 40); },
    bell(c, e, q) {                                       // tiếng chuông vàng ngân ra khi Kim Chung bị đánh
      c.save(); c.translate(e.x, e.y); const k = e.s * (1 + 0.45 * easeOut(q)); c.scale(k, k);
      c.globalCompositeOperation = 'lighter'; c.strokeStyle = rgba('#ffd36b', 0.8 * (1 - q)); c.lineWidth = 2.2 / (1 + q); bellPath(c); c.stroke(); c.restore();
    },
    whoosh(c, e, q) {                                     // đánh hụt: vệt gió trắng
      const a = 1 - q;
      c.globalCompositeOperation = 'lighter'; c.strokeStyle = rgba('#f4efe0', 0.7 * a); c.lineWidth = Math.max(1, e.r * 0.07 * a); c.lineCap = 'round';
      c.beginPath(); c.arc(e.x, e.y, e.r * (0.8 + 0.3 * q), e.a0, e.a1); c.stroke();
      c.beginPath(); c.arc(e.x, e.y + e.r * 0.25, e.r * (0.6 + 0.3 * q), e.a0 + 0.2, e.a1 - 0.2); c.stroke();
    }
  };
  function drawEfx(c, ts, G) {
    for (let i = S.efx.length - 1; i >= 0; i--) {
      const e = S.efx[i], q = (ts - e.t0) / e.dur;
      if (q >= 1) { S.efx.splice(i, 1); continue; }
      if (q < 0) continue;
      c.save(); EFX[e.k](c, e, q, ts, G); c.restore();
    }
  }

  /* ----- thế giữ: khiên, linh khí ----- */
  function bellPath(c) {                                  // chuông vàng Kim Chung (đơn vị nhân vật, đáy chuông ở chân)
    c.beginPath(); c.moveTo(-13, -116);
    c.bezierCurveTo(-32, -116, -35, -92, -36, -62); c.bezierCurveTo(-37, -32, -42, -14, -50, -3);
    c.lineTo(50, -3); c.bezierCurveTo(42, -14, 37, -32, 36, -62); c.bezierCurveTo(35, -92, 32, -116, 13, -116); c.closePath();
  }
  function shieldOf(side) { const h = holdOf(side); return h && h.k === 'guard' ? styleOf(SHIELD, 'shield', h.skill) : null; }
  function drawHold(c, G, side, B, t, ts, front) {
    const h = holdOf(side);
    if (!h) return;
    const still = reduced(), age = still || !h.t0 ? 1e9 : ts - h.t0, inn = ease(age / 380), x = B.x, y = B.y, s = B.s, dir = G[side].dir;
    const hitAge = S.shieldHit && S.shieldHit[side] ? ts - S.shieldHit[side] : 1e9, hf = hitAge < 420 ? 1 - hitAge / 420 : 0;
    const pulse = still ? 1 : 0.85 + 0.15 * Math.sin(t * 3.2 + (side === 'op' ? 1 : 0));
    c.save();
    if (h.k === 'guard') {
      const st = shieldOf(side);
      if (st === 'bell' && front) {
        c.translate(x, y); c.scale(s * (0.78 + 0.14 * inn), s * (0.78 + 0.14 * inn)); c.globalAlpha = inn;
        const g = c.createLinearGradient(-40, 0, 40, 0); g.addColorStop(0, 'rgba(255,211,107,.26)'); g.addColorStop(0.5, 'rgba(255,236,170,.08)'); g.addColorStop(1, 'rgba(255,211,107,.26)');
        c.fillStyle = g; bellPath(c); c.fill();
        c.strokeStyle = rgba('#ffd36b', (0.75 + 0.25 * hf) * pulse); c.lineWidth = 1.8 + 1.5 * hf; c.stroke();
        c.strokeStyle = rgba('#ffd36b', 0.45); c.lineWidth = 1;
        c.beginPath(); c.moveTo(-35, -96); c.quadraticCurveTo(0, -90, 35, -96); c.moveTo(-38, -34); c.quadraticCurveTo(0, -27, 38, -34); c.stroke();
        c.fillStyle = rgba('#ffe39a', 0.7); for (let i = -2; i <= 2; i++) { c.beginPath(); c.arc(i * 9, -76, 1.6, 0, TAU); c.fill(); }
        c.beginPath(); c.arc(0, -121, 5, 0, TAU); c.stroke();
        if (hf) { c.globalCompositeOperation = 'lighter'; glowAt(c, 0, -60, 60, '#ffd36b', 0.5 * hf); }
      } else if (st === 'iron' && front) {
        const px = dir * 30, hgt = 98 * inn;
        c.translate(x, y); c.scale(s, s);
        c.beginPath(); c.moveTo(px - 7, -2); c.lineTo(px + 7, -6); c.lineTo(px + 7, -6 - hgt); c.lineTo(px, -10 - hgt); c.lineTo(px - 7, -6 - hgt); c.closePath();
        const g = c.createLinearGradient(px - 7, 0, px + 7, 0); g.addColorStop(0, '#2c343b'); g.addColorStop(0.5, '#7d8c98'); g.addColorStop(1, '#3b4650');
        c.fillStyle = g; c.globalAlpha = 0.88; c.fill(); c.globalAlpha = 1;
        c.strokeStyle = rgba('#c6d3dc', 0.75 + 0.25 * hf); c.lineWidth = 1.1; c.stroke();
        c.save(); c.clip(); c.strokeStyle = 'rgba(20,24,28,.6)'; c.lineWidth = 0.8; c.beginPath();
        for (let yy = -14; yy > -10 - hgt; yy -= 14) { c.moveTo(px - 7, yy); c.lineTo(px, yy - 4); c.lineTo(px + 7, yy - 1); }
        c.stroke(); c.restore();
        c.fillStyle = '#d4ab52'; for (let yy = -18; yy > -6 - hgt; yy -= 28) { c.beginPath(); c.arc(px, yy, 1.4, 0, TAU); c.fill(); }
        if (hf) { c.globalCompositeOperation = 'lighter'; glowAt(c, px, -55, 40, '#cfe0ff', 0.6 * hf); }
      } else if (st === 'water' && front) {
        c.translate(x, y - 56 * s); c.scale(s * (0.8 + 0.2 * inn), s * (0.8 + 0.2 * inn)); c.globalAlpha = inn;
        const g = c.createRadialGradient(-10, -16, 4, 0, 0, 62); g.addColorStop(0, 'rgba(180,240,230,.05)'); g.addColorStop(0.75, 'rgba(110,200,200,.14)'); g.addColorStop(1, 'rgba(110,200,210,.32)');
        c.fillStyle = g; c.beginPath(); c.ellipse(0, 0, 37, 54, 0, 0, TAU); c.fill();
        c.strokeStyle = rgba('#bff3ea', 0.55 + 0.35 * hf); c.lineWidth = 1.3; c.stroke();
        c.strokeStyle = rgba('#d8fff7', 0.5); c.lineWidth = 1;
        for (let i = 0; i < 3; i++) { const r0 = t * 1.4 + i * 2.1; c.beginPath(); c.ellipse(0, 0, 37 - i * 6, 54 - i * 8, 0, r0, r0 + 1.1); c.stroke(); }
        c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 2; c.beginPath(); c.ellipse(-12, -22, 18, 26, 0, Math.PI * 1.05, Math.PI * 1.45); c.stroke();
      } else if (st === 'clones' && !front) {
        for (const k of [-1, 1]) {
          const a = (0.22 + 0.08 * Math.sin(t * 5 + k)) * inn;
          c.save(); c.globalAlpha = a; c.translate(x + k * 24 * s * inn, y); c.scale(s, s);
          avatar(c, B.look, { front: true, t: t + k, pose: { dir, guard: 0.9, crouch: 0.3 } }); c.restore();
        }
        if (!still && Math.random() < 0.3) part({ x: x + rnd(-30, 30) * s, y: y - rnd(10, 90) * s, vy: -20, max: 700, r: 1.4, kind: 'ember', col: '#e8c477' });
      }
    } else if (h.k === 'charge' || h.k === 'release') {
      const col = h.k === 'release' ? '#ff6a3a' : '#ffb04a', cy = y - 55 * s;
      if (!front) {
        c.globalCompositeOperation = 'lighter';
        c.save(); c.translate(x, y); c.scale(1, 0.28); glowAt(c, 0, 0, 70 * s, col, 0.5 * pulse * inn); c.restore();
        glowAt(c, x, cy, 64 * s, col, (h.k === 'release' ? 0.42 : 0.28) * pulse * inn);
        c.strokeStyle = rgba(col, 0.55 * inn); c.lineWidth = Math.max(1, 1.6 * s);
        for (let i = 0; i < 3; i++) { const r0 = (still ? 0 : t * (2.4 + i * 0.6)) + i * 2.1, R = (34 + i * 9) * s; c.beginPath(); c.ellipse(x, cy, R, R * 0.42, 0, r0, r0 + 1.8); c.stroke(); }
        if (!still && S.parts.length < 200 && Math.random() < (h.k === 'release' ? 0.9 : 0.55)) {
          const an = rnd(0, TAU), R = rnd(55, 80) * s;
          part({ x: x + Math.cos(an) * R, y: cy + Math.sin(an) * R * 0.6, to: { x, y: cy }, max: 520, r: rnd(1.2, 2.2), kind: 'ember', col: Math.random() < 0.5 ? col : '#ffe39a' });
        }
      }
    } else if (h.k === 'rest' && !front) {
      c.globalCompositeOperation = 'lighter';
      const br = still ? 0.5 : 0.5 + 0.5 * Math.sin(t * 2.2);
      glowAt(c, x, y - 40 * s, (46 + 14 * br) * s, '#7fd38a', 0.42 * inn);
      if (!still && S.parts.length < 200 && Math.random() < 0.35) part({ x: x + rnd(-20, 20) * s, y: y - rnd(0, 30) * s, vy: -rnd(25, 50), vx: rnd(-8, 8), max: rnd(900, 1400), r: rnd(1, 1.8), kind: 'ember', col: '#9fe6a8' });
      for (let i = 0; i < 2; i++) { const q = still ? 0.5 : (t * 0.5 + i * 0.5) % 1; c.strokeStyle = rgba('#a8e6b0', 0.5 * (1 - q) * inn); c.lineWidth = 1.2; c.beginPath(); c.ellipse(x, y - 10 * s - q * 80 * s, (22 + q * 14) * s, (6 + q * 4) * s, 0, 0, TAU); c.stroke(); }
    } else if (h.k === 'idle' && front) {
      const bx = x + 18 * s, by = y - 112 * s, n = still ? 3 : 1 + Math.floor(t * 3) % 3;
      c.fillStyle = 'rgba(251,245,232,.92)'; c.beginPath(); c.ellipse(bx, by, 15 * s, 9 * s, 0, 0, TAU); c.fill();
      c.beginPath(); c.moveTo(bx - 8 * s, by + 6 * s); c.lineTo(bx - 12 * s, by + 13 * s); c.lineTo(bx - 3 * s, by + 7 * s); c.fill();
      c.fillStyle = '#2a1a12'; for (let i = 0; i < n; i++) { c.beginPath(); c.arc(bx - 6 * s + i * 6 * s, by, 1.6 * s, 0, TAU); c.fill(); }
    }
    c.restore();
  }

  /* ----- vẽ một bên ----- */
  function drawFighter(c, G, side, P, t, look) {
    const g = G[side], s = G.s, x = g.x + g.dir * P.dx * G.span, y = G.fy + P.dy * s;
    S.body[side] = { x, y, s, look };
    const pose = { dir: g.dir, arm: P.arm, kick: P.kick, guard: P.guard, crouch: P.crouch, lean: P.lean };
    if (P.ghosts) for (const [gdx, ga] of P.ghosts) {
      if (ga <= 0.02) continue;
      c.save(); c.globalAlpha = ga; c.translate(x + g.dir * gdx * G.span, y); c.scale(s, s);
      avatar(c, look, { front: true, t, pose }); c.restore();
    }
    c.save(); c.globalAlpha = P.alpha; c.translate(x, y); c.rotate(P.rot * g.dir); c.scale(s, s);
    avatar(c, look, { front: true, t, bow: P.bow, pose });
    c.restore();
    if (P.hit > 0.03) {                                                // chớp đỏ trên người khi trúng đòn
      c.save(); c.globalCompositeOperation = 'lighter'; glowAt(c, x, y - 58 * s, 46 * s, '#ff6a50', 0.55 * P.hit); c.restore();
    }
  }

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
    if (!st.bg || st.bgKey !== W + 'x' + H + '@' + k) { st.bg = stageBg(W, H, k); st.bgKey = W + 'x' + H + '@' + k; }
    const dt = Math.min(64, Math.max(0, ts - (st.lastTs || ts))); st.lastTs = ts;
    const G = stageGeo(W, H), t = still ? 0 : ts / 1000, m = S.m;
    let sx = 0, sy = 0;
    if (S.shake && !still) {
      const q = (ts - S.shake.t0) / S.shake.dur;
      if (q >= 1) S.shake = null; else { const a = S.shake.amp * G.s * (1 - q); sx = Math.sin(ts * 0.11) * a; sy = Math.cos(ts * 0.13) * a * 0.6; }
    }
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, cv.width, cv.height);
    c.setTransform(k, 0, 0, k, 0, 0);
    c.drawImage(st.bg, 0, 0, W, H);
    c.setTransform(k, 0, 0, k, sx * k, sy * k);                       // rung màn: chỉ cờ, đèn, người và hiệu ứng rung, nền đứng yên
    drawProps(c, G, t);
    const P = { you: poseOf('you', ts), op: poseOf('op', ts) }, look = { you: m && m.you ? m.you.look : DEF_LOOK, op: m && m.op ? m.op.look : DEF_LOOK };
    const order = P.you.front && !P.op.front ? ['op', 'you'] : ['you', 'op'];          // bên đang ra đòn vẽ sau để đè lên đối thủ
    const bodyOf = side => ({ x: G[side].x + G[side].dir * P[side].dx * G.span, y: G.fy + P[side].dy * G.s, s: G.s, look: look[side] });
    for (const side of order) drawHold(c, G, side, bodyOf(side), t, ts, false);
    for (const side of order) drawFighter(c, G, side, P[side], t + (side === 'op' ? 1.7 : 0), look[side]);
    for (const side of order) drawHold(c, G, side, bodyOf(side), t, ts, true);
    if (!still) { drawEfx(c, ts, G); drawParts(c, dt); }
  }

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
    const head = h('header', 'ar-head'), tt = h('div', 'ar-ttl');
    ui.sub = h('span', 'ar-sub', 'Luận võ 1 đấu 1');
    add(tt, h('h2', null, 'Sân đấu'), ui.sub);
    // trong trận: số lượt, giờ còn lại, thanh đếm giờ nằm ngay trên đầu trang (đỡ chỗ cho sân khấu)
    ui.hturn = h('div', 'ar-hturn'); ui.hturn.hidden = true;
    ui.turn = h('b', 'ar-turn'); ui.tsec = h('span', 'ar-tsec', null, { role: 'timer' });
    add(ui.hturn, ui.turn, ui.tsec);
    ui.hbar = h('div', 'ar-hbar'); ui.hfill = h('i'); ui.hbar.appendChild(ui.hfill); ui.hbar.hidden = true;
    // thanh đổi map dùng chung (Sân đấu sáng); thay nút "← Về chánh điện" cũ
    ui.mapbar = root.MapBar ? root.MapBar.mount(head) : null;
    if (ui.mapbar) ui.mapbar.addEventListener('click', onMapBar, true);   // bắt ở pha capture để chặn khi đang có trận
    add(head, tt, ui.hturn, ui.hbar);
    ui.off = h('p', 'ar-off', 'Mất kết nối. Các nút gửi tạm khóa, đang thử nối lại…', { role: 'status' }); ui.off.hidden = true;
    ui.live = h('div', 'sr', null, { 'aria-live': 'polite' });
    const main = h('div', 'ar-main');
    ui.invites = h('div', 'ar-invites', null, { 'aria-live': 'polite' });
    ui.roster = buildRoster(); ui.lobby = h('section', 'ar-screen ar-lobby', null, { 'aria-label': 'Sảnh chọn bộ chiêu' });
    ui.match = h('section', 'ar-screen ar-matchbox', null, { 'aria-label': 'Trận đấu' }); ui.end = h('section', 'ar-screen ar-end', null, { 'aria-label': 'Kết quả trận' });
    for (const s of [ui.lobby, ui.match, ui.end]) s.hidden = true;
    add(main, ui.invites, ui.roster.sec, ui.lobby, ui.match, ui.end);   // thẻ lời mời đứng đầu để Tab / trình đọc màn hình tới trước
    add(wrap, head, ui.off, main, ui.live);
    buildDialogs(wrap);
    el.appendChild(wrap);
  }

  /* Sân đi lại được như sân chùa: khung vẽ dùng chung bộ vẽ của chánh điện (Hall, cảnh 'arena').
     Chạm một người để mời luận võ; danh sách người ở sân nằm trong ngăn kéo "Danh sách" (cho ai khó chạm trúng người). */
  function buildRoster() {
    const sec = h('section', 'ar-screen ar-roster', null, { 'aria-label': 'Sân đấu' }), r = { sec };
    const yard = h('div', 'ar-yard'), top = h('div', 'ar-ytop'), msgs = h('div', 'ar-ymsgs'), list = h('div', 'ar-listbox');
    r.cv = h('canvas', 'ar-yardcv', null, { role: 'img', 'aria-label': 'Sân đấu: võ đài giữa sân và những đạo hữu đang ở sân. Chạm vào một người để mời luận võ, chạm sân để đi lại.' });
    r.dnd = btn('ar-switch', null, { role: 'switch', 'aria-checked': 'false' });
    add(r.dnd, h('span', 'ar-knob'), h('span', 'ar-sw-t', 'Tạm không nhận lời mời'));
    r.dnd.addEventListener('click', toggleDnd);
    r.blocks = btn('btn small ar-blocks', 'Danh sách chặn');
    r.blocks.addEventListener('click', openBlocks);
    r.listBtn = btn('btn small gold ar-listbtn', 'Danh sách', { 'aria-expanded': 'false' });
    r.listBtn.addEventListener('click', () => toggleDrawer());
    add(top, r.listBtn, r.dnd);
    r.hint = h('p', 'ar-yhint', 'Chạm vào một đạo hữu để mời luận võ · chạm sân để đi lại');
    r.resume = h('p', 'ar-resume', null, { role: 'status' }); r.resume.hidden = true;
    add(r.resume, h('span', 'spin', null, { 'aria-hidden': 'true' }), document.createTextNode('Đang vào lại trận đang đấu dở…'));
    r.login = h('div', 'card ar-login'); r.login.hidden = true;
    const lb = btn('btn primary', 'Đăng nhập Google'); lb.addEventListener('click', () => { try { S.host.login(); } catch (e) { /* bỏ qua */ } });
    add(r.login, h('b', null, 'Cần đăng nhập Google để ra sân luận võ.'), h('span', 'hint', 'Tài khoản giữ nội công, chiêu đã học và thắng thua của bạn.'), lb);
    r.out = h('div', 'ar-out', null, { role: 'status' }); r.out.hidden = true;
    r.outText = h('span', 'ar-out-t'); r.outCancel = btn('btn small', 'Hủy lời mời');
    r.outCancel.addEventListener('click', cancelOut);
    add(r.out, h('span', 'spin', null, { 'aria-hidden': 'true' }), r.outText, r.outCancel);
    const hd = h('h3', 'ar-lh', null, { tabindex: '-1' }), cnt = h('span', 'ar-count', '0');
    add(hd, h('span', null, 'Người ở sân'), cnt);
    r.count = cnt; r.list = h('ul', 'ar-list'); r.list.setAttribute('aria-label', 'Người ở sân');
    r.empty = h('div', 'ar-empty');
    r.empty.appendChild(svgIcon('ar-empty-i', '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M8 9.5h.01M16 9.5h.01M8.5 15.5c1-1.2 2.2-1.8 3.5-1.8s2.5.6 3.5 1.8" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>', 28));
    r.emptyT = h('b', null, 'Sân đang vắng.');
    r.emptyS = h('span', null, 'Chưa có đạo hữu nào ra luận võ. Cứ đi dạo quanh võ đài chờ một lát, có người vào là thấy ngay.');
    add(r.empty, r.emptyT, r.emptyS);
    add(msgs, r.resume, r.login, r.out, r.empty);
    // ngăn kéo danh sách
    r.drawer = h('div', 'ar-drawer', null, { role: 'region', 'aria-label': 'Danh sách người ở sân' }); r.drawer.hidden = true;
    const dclose = btn('x ar-dclose', '×', { 'aria-label': 'Đóng danh sách' });
    dclose.addEventListener('click', () => toggleDrawer(false));
    hd.appendChild(dclose);
    r.none = h('p', 'hint ar-none', 'Chưa có ai khác ở sân.');
    add(list, hd, h('p', 'ar-intro', 'Hai bên cùng chọn chiêu kín, rồi lật ra một lượt và đánh nhau. Ai hết máu trước thì thua.'), r.list, r.none, r.blocks);
    add(r.drawer, list);
    add(yard, r.cv, top, msgs, r.hint, r.drawer);
    add(sec, yard);
    return r;
  }
  function toggleDrawer(force) {
    const r = S.ui && S.ui.roster;
    if (!r) return;
    const open = force != null ? !!force : r.drawer.hidden;
    r.drawer.hidden = !open; r.listBtn.setAttribute('aria-expanded', String(open));
    if (open) { renderRoster(); try { r.drawer.querySelector('h3').focus({ preventScroll: true }); } catch (e) { /* bỏ qua */ } }
  }
  /** Chạm vào một người trên sân (Hall báo lên qua app.js): mời luận võ, hoặc báo vì sao chưa mời được. */
  function pick(pid) {
    if (!S.visible || S.screen !== 'roster') return;
    const me = S.host.me ? S.host.me().pid : -1;
    if (pid === me) return;
    const p = S.players.get(pid);
    if (!p) { toast('Người này không còn ở sân.'); return; }
    if (S.loginNeeded) { toast('Cần đăng nhập Google để luận võ.'); return; }
    if (p.st === 'busy') { toast(`${p.name} đang đấu, đợi trận xong nhé.`); return; }
    if (p.st === 'dnd') { toast(`${p.name} đang tạm không nhận lời mời.`); return; }
    openInvite(pid);
  }
  /** Nhãn trên đầu từng người ở sân (Hall vẽ): rảnh / đang đấu / tạm nghỉ và cấp nội công. */
  function tagOf(pid) {
    const p = S.players.get(pid);
    if (!p) return null;
    const st = ST[p.st] || ST.free;
    return { text: `${st[0]} · Cấp ${num(p.lv, 1)}`, color: p.st === 'busy' ? '#ec7b6c' : p.st === 'dnd' ? '#9a8b78' : '#86b38a' };
  }
  const inYard = () => !!(S.visible && S.screen === 'roster');

  function buildDialogs(wrap) {
    const ui = S.ui;
    // chọn chế độ mời
    const d1 = ui.dMode = mkDlg('Mời luận võ', ''); ui.dlgs.push(d1.dlg);
    const fs = h('fieldset'), lg = h('legend', null, 'Chế độ'), opts = h('div', 'opts one');
    for (const mode of ['buff']) {
      const lab = h('label', 'opt'), inp = h('input', null, null, { type: 'radio', name: 'ar-mode', value: mode }), sp = h('span');
      add(sp, h('b', null, MODES[mode].name), h('small', null, MODES[mode].desc)); add(lab, inp, sp); opts.appendChild(lab);
    }
    add(fs, lg, opts); fs.hidden = true;
    const send = btn('btn primary', 'Gửi lời mời', { type: 'submit' }), later = btn('btn', 'Để sau'), blk = btn('btn small ar-dblk', 'Chặn người này');
    later.addEventListener('click', () => d1.dlg.close());
    blk.addEventListener('click', () => { const pid = S.dlg.pid; d1.dlg.close(); openBlock(pid); });
    add(d1.foot, blk, later, send); add(d1.body, fs, d1.warn, d1.foot);
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
    const d4 = ui.dLeave = mkDlg('Rời trận nghĩa là bỏ cuộc', 'Nếu rời sân bây giờ, bạn sẽ bị xử thua trận này.'); ui.dlgs.push(d4.dlg);
    const stay = btn('btn primary', 'Ở lại đấu'), quit = btn('btn', 'Bỏ cuộc, về chánh điện');
    stay.addEventListener('click', () => d4.dlg.close()); quit.addEventListener('click', doLeave);
    add(d4.foot, quit, stay); add(d4.body, d4.warn, d4.foot);
    d4.quit = quit;
    d4.dlg.addEventListener('close', () => { S.leaveTo = null; });
    for (const d of ui.dlgs) wrap.appendChild(d);
  }

  /* ---------- chuyển màn ---------- */
  function go(screen) {
    const ui = S.ui;
    S.screen = screen;
    if (S.visible && root.SFX) root.SFX.setMusicScene(screen === 'match' ? 'battle' : 'arena');
    ui.roster.sec.hidden = screen !== 'roster'; ui.lobby.hidden = screen !== 'lobby'; ui.match.hidden = screen !== 'match'; ui.end.hidden = screen !== 'end';
    ui.sub.textContent = { roster: 'Luận võ 1 đấu 1', lobby: 'Sảnh chọn bộ chiêu', match: 'Đang đấu', end: 'Kết quả' }[screen];
    ui.invites.hidden = screen === 'lobby' || screen === 'match';
    ui.hturn.hidden = ui.hbar.hidden = screen !== 'match';
    ui.root.dataset.screen = screen;
    yardOn(screen === 'roster' && S.visible);
    if (screen === 'roster') renderRoster();
    if (screen === 'lobby' || screen === 'match') startPaint(); else stopPaint();
    const first = { roster: ui.roster.sec, lobby: ui.lobby, match: ui.match, end: ui.end }[screen];
    const hd = first && first.querySelector('[data-focus]');
    if (hd) { hd.tabIndex = -1; try { hd.focus({ preventScroll: true }); } catch (e) { /* bỏ qua */ } }
    refreshCtl();
  }
  let yardShown = false;
  function yardOn(on) {
    const y = S.host && S.host.yard;
    if (!y || on === yardShown) return;
    yardShown = on;
    try { if (on) y.show(S.ui.roster.cv); else { toggleDrawer(false); y.hide(); } } catch (e) { console.error('[arena] yard', e); }
  }
  /** Đang ở sảnh / trận, hoặc đang chờ máy chủ cho biết có trận dở không (rời sân lúc đó cũng là bỏ cuộc). */
  const inMatch = () => S.resuming || (!!S.m && (S.screen === 'lobby' || S.screen === 'match'));

  /* Thanh đổi map: bấm Sân đấu (đang ở đây) thì không làm gì; bấm map khác khi không có trận → để app.js đi thẳng;
     có trận → hỏi rời trận, đồng ý rồi mới phát lại cú bấm (leaveTo). */
  let replaying = false;
  function onMapBar(e) {
    const b = e.target.closest && e.target.closest('.mapbar-btn');
    if (!b || replaying) return;
    if (b.dataset.map === 'arena') { e.stopPropagation(); return; }
    if (!inMatch()) return;
    e.stopPropagation();
    S.leaveTo = b;
    const lb = b.dataset.map === 'hall' ? 'chánh điện' : (b.getAttribute('aria-label') || 'map khác');
    S.ui.dLeave.quit.textContent = 'Bỏ cuộc, sang ' + lb;
    S.ui.dLeave.warn.hidden = true; openDlg(S.ui.dLeave.dlg);
  }
  /** Đã rời được trận: đi tới map người chơi đã chọn (phát lại cú bấm trên thanh), không chọn thì về chánh điện. */
  function leaveDone() {
    const b = S.leaveTo; S.leaveTo = null;
    if (b && b.isConnected) { replaying = true; try { b.click(); } finally { replaying = false; } return; }
    S.host.goto('hall');
  }
  function doLeave() {
    const m = S.m, d = S.ui.dLeave;
    if (!m) { d.dlg.close(); leaveDone(); return; }
    if (!canSend()) { d.warn.textContent = 'Mất kết nối, chưa bỏ cuộc được. Đợi nối lại rồi thử nhé.'; d.warn.hidden = false; return; }
    d.quit.disabled = true;
    S.sock.emit('pk:forfeit', { matchId: m.id }, ack => {
      d.quit.disabled = false;
      if (ack && ack.ok) { d.dlg.close(); leaveDone(); return; }
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
    r.name.textContent = p.name; r.meta.textContent = `${M.pkTitle(p.wins, p.draws).name} · ${M.realmName(p.lv)} · ${num(p.wins)} thắng · ${num(p.losses)} thua`;
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
    r.listBtn.textContent = `Danh sách · ${list.length}`;
    r.empty.hidden = list.length > 0 || S.loginNeeded || !r.drawer.hidden;   // ngăn kéo mở thì đã có dòng "Chưa có ai khác"
    r.list.hidden = list.length === 0; r.none.hidden = list.length > 0;
    r.hint.hidden = list.length === 0;
    if (S.screen === 'roster' && !r.drawer.hidden) for (const row of S.rows.values()) if (!row.drawn) row.drawn = paintPortrait({ cv: row.cv, look: row.p && row.p.look, buff: null }, 0);
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
    const d = S.ui.dMode, p = S.players.get(S.dlg.pid), mode = (d.body.querySelector('input[name="ar-mode"]:checked') || {}).value || 'buff';
    if (!p) { d.dlg.close(); return; }
    if (!canSend()) { d.warn.textContent = 'Mất kết nối, chưa gửi được.'; d.warn.hidden = false; return; }
    S.lastMode = mode; d.send.disabled = true;
    S.sock.emit('pk:invite', { toPid: p.pid, mode }, ack => {
      d.send.disabled = !canSend();
      if (!ack || !ack.ok) { d.warn.textContent = (ack && ack.reason) || 'Chưa mời được, thử lại nhé.'; d.warn.hidden = false; if (ack && ack.code === 'login') setLogin(true); return; }
      d.dlg.close();
      if (S.m) return;                                            // nhận lời quá nhanh: sảnh đã mở
      S.out = { inviteId: ack.inviteId, expiresAt: num(ack.expiresAt, nowMs() + 20000), toPid: p.pid, toName: p.name, mode, total: 20000 };
      toggleDrawer(false);                                        // về lại sân để thấy dải "đang chờ nhận lời"
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
    if (inv.buffs) {
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
    const original = skillOf(id), xp = S.m && S.m.mastery && S.m.mastery[id];
    const s = M.SKILLS[id] ? M.combatSkill(id, xp) : original || { id, name: String(id), kind: 'idle' }, br = branchOf(s), b = btn('ar-card', null, { 'aria-pressed': 'false' });
    b.dataset.skill = id;
    b.style.setProperty('--bc', br ? br.color : 'var(--line)');
    const kind = (M.KIND_NAMES && M.KIND_NAMES[s.kind]) || '';
    const ck = h('span', 'ar-ck');
    if (br) ck.appendChild(h('em', null, br.name));
    ck.appendChild(document.createTextNode(kind));
    ck.appendChild(h('span', 'ar-cx'));
    add(b, h('span', 'ar-cn', s.name), ck, h('span', 'ar-cs', s.mana > 0 || s.kind !== 'rest' ? M.statsLine(s) : s.short));
    if (M.SKILLS[id]) b.appendChild(h('span', 'ar-cd', M.masteryInfo(xp).name));
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
    const power = M.combatPower(p.level);
    lv.title = `Nội công: +${Math.round((power.attack - 1) * 100)}% lực đánh, giảm ${(power.reduction * 100).toFixed(1).replace('.', ',')}% sát thương nhận`;
    const lock = h('span', 'ar-lockb'); lock.appendChild(svgIcon('ar-lk-i', ICON_LOCK, 13)); lock.appendChild(h('span', 'ar-lk-t'));
    if (side === 'you') lock.hidden = true;
    add(top, name, lv, lock);
    const hp = meter('ar-hp', side === 'you' ? 'HP của bạn' : 'HP của đối thủ'), mp = meter('ar-mp', 'Nội lực'), rg = meter('ar-rg', 'Nộ');
    hp.w.querySelector('.ar-m-l').textContent = 'HP';
    rg.w.title = 'Mỗi điểm nộ tăng 0,3% sát thương đòn công kế tiếp, tối đa 30%. Đòn công tiêu hao toàn bộ nộ; tổng tăng cùng Kim Chung và hào quang tối đa 50%.';
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
    S.stage = { cv, c: null, dirty: true }; resetStageFx();
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
    U.secrets = h('div', 'ar-act');
    U.kamui = btn('btn small', 'Kamui: Tắt'); U.kamui.hidden = true;
    U.kamui.addEventListener('click', () => { if (!m.locked && !m.pending) { m.kamui = !m.kamui; renderPickCtl(); } });
    U.rest = skillCard(M.REST_ID); U.rest.classList.add('ar-pk', 'ar-rest'); U.rest.addEventListener('click', () => choose(M.REST_ID));
    U.lock = btn('btn primary ar-lockbtn', 'Chọn một chiêu'); U.lock.addEventListener('click', lockPick);
    add(act, U.rest, U.lock);
    U.status = h('p', 'ar-status', null, { role: 'status' });
    add(ui_, grid, U.secrets, U.kamui, act, U.status);
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
      const c = all[id], legal = choosing && m.legal.includes(id), on = m.sel === id, s = M.SKILLS[id] ? M.combatSkill(id, m.mastery && m.mastery[id]) : skillOf(id);
      c.setAttribute('aria-pressed', String(on));
      c.disabled = !legal || frozen;
      c.classList.toggle('off', choosing && !legal);
      c.classList.toggle('frozen', frozen && legal);
      const cx = c.querySelector('.ar-cx');
      cx.textContent = m.forced === id ? 'Tự tung' : m.locked && on ? 'Đã khóa' : '';
      c.title = choosing && !legal ? reasonOff(m, id) : s.desc || '';
      c.setAttribute('aria-label', `${s.name}. ${(M.KIND_NAMES || {})[s.kind] || ''}. ${id === M.REST_ID ? s.short : M.statsLine(s)}.` + (choosing && !legal ? ` Không chọn được: ${reasonOff(m, id)}.` : '') + (m.forced === id ? ' Đang tụ lực, lượt này tự tung.' : '') + (on ? (m.locked ? ' Đã khóa.' : ' Đang chọn.') : ''));
    }
    U.lock.hidden = m.locked;
    U.lock.disabled = frozen || !m.sel;
    U.lock.textContent = m.pending ? 'Đang khóa…' : m.sel ? `Khóa: ${skillName(m.sel)}` : 'Chọn một chiêu';
    U.kamui.textContent = `Kamui: ${m.kamui ? 'Bật' : 'Tắt'}`;
    U.kamui.disabled = frozen;
    U.kamui.setAttribute('aria-pressed', String(!!m.kamui));
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
    const turn = m.turn, id = m.kamui ? 'kamui:' + m.sel : m.sel;
    if (!m.legal.includes(id)) { m.msg = 'Không thể kết hợp Kamui với chiêu này.'; renderPickCtl(); return; }
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
    clear(U.secrets);
    for (const id of ['tau-vi-thuong-sach', 'nhu-lai-than-chuong']) {
      delete U.cards[id];
      if (m.legal.includes(id)) { const card = skillCard(id); card.classList.add('ar-pk'); card.addEventListener('click', () => choose(id)); U.cards[id] = card; U.secrets.appendChild(card); }
    }
    U.kamui.hidden = !m.legal.some(id => id.startsWith('kamui:'));
    m.kamui = !!(o.myPick && o.myPick.startsWith('kamui:'));
    if (d.loadouts) { m.loadouts = d.loadouts; renderOpLoadout(); }
    // đang tụ lực thì máy chủ tự khóa, không cần gửi gì
    m.sel = (m.kamui ? o.myPick.slice(6) : o.myPick) || m.forced || null; m.locked = !!(o.myPick || m.forced); m.pending = false; m.timeUp = false; m.msg = ''; m.opLocked = !!o.opLocked;
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
    const s = skillOf(pk.skill);
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
        case 'kamui': out.push({ who: e.side, text: 'dùng Kamui, miễn nhiễm sát thương trong lượt', fx: [['float', e.side, 'Kamui!', 'good']] }); break;
        case 'guard': out.push({ who: e.side, text: `thủ, giảm ${pc(e.red)}% sát thương`, hold: [e.side, 'guard'] }); break;
        case 'charge': out.push({ who: e.side, text: 'bắt đầu tụ lực, lượt sau tự tung đòn', hold: [e.side, 'charge'] }); break;
        case 'release': out.push({ who: e.side, text: 'tung đòn đã tụ lực', hold: [e.side, 'release'] }); break;
        case 'rest': out.push({ who: e.side, text: 'điều tức, hồi thêm nội lực', hold: [e.side, 'rest'] }); break;
        case 'idle': out.push({ who: e.side, text: P[e.side] && P[e.side].auto ? 'hết giờ nên đứng yên' : 'đứng yên', hold: [e.side, 'idle'] }); break;
        case 'dodge':
          out.push({ who: e.def, text: e.ok ? `né thành công${nth(e)} (${pc(e.p)}%)` : `né hụt${nth(e)} (${pc(e.p)}%)`,
            fx: e.ok ? [['float', e.def, 'Né!', 'good']] : [] });
          break;
        case 'parry':
          out.push({ who: e.def, text: e.reflect ? 'dùng Tứ Lạng hóa giải Phá Sơn, trả nguyên sát thương' : e.ok ? `đỡ thành công${nth(e)} (${pc(e.p)}%)` : `đỡ hụt${nth(e)} (${pc(e.p)}%)`,
            fx: e.ok ? [['float', e.def, 'Đỡ!', 'good']] : [] });
          break;
        case 'hit': {
          const sk = skillName(P[e.atk] && P[e.atk].skill);
          out.push({ who: e.atk, text: `${sk} trúng ${tg(e.def)}${e.of > 1 ? `, nhịp ${e.idx}/${e.of}` : ''}, gây ${e.dmg}${e.trueDamage ? ' sát thương chuẩn xuyên thủ' : e.red > 0 ? ` (giảm ${pc(e.red)}%)` : ''}`,
            fx: [['hp', e.def, e.dmg], ['float', e.def, '−' + e.dmg, 'dmg']] });
          break;
        }
        case 'counter':
          out.push({ who: e.side, text: `${e.reflect ? 'phản nguyên Phá Sơn' : 'phản đòn'}, ${tg(e.target)} mất ${e.dmg}`, fx: [['hp', e.target, e.dmg], ['float', e.target, '−' + e.dmg, 'dmg']] });
          break;
        case 'exposed': out.push({ who: e.side, text: `sơ hở: lượt sau nhận thêm ${EXPOSED_PCT}% sát thương`, fx: [['float', e.side, 'Sơ hở', 'warn']] }); break;
        case 'kc': out.push({ who: e.side, text: `nhận Kim Chung: trong ${KC_TURNS} lượt tới, đòn công đầu tiên mạnh thêm ${KC_PCT}%`, fx: [['float', e.side, 'Kim Chung', 'gold']] }); break;
        case 'sudden':
          { const affected = ['you', 'op'].filter(side => !(e.immune || []).includes(side));
            out.push({ who: 'both', text: `Suy kiệt: ${affected.length === 2 ? 'cả hai' : affected.length === 1 ? (affected[0] === 'you' ? 'bạn' : 'đối thủ') : 'không ai'} mất ${affected.length ? e.dmg : 0}`, plain: true, fx: affected.flatMap(side => [['hp', side, e.dmg], ['float', side, '-' + e.dmg, 'warn']]) }); }
          break;
        default: break;                                           // pick, rage, end: thể hiện bằng thẻ lật, thanh nộ và màn kết thúc
      }
      if (out.length && !out[out.length - 1].ev) out[out.length - 1].ev = e;   // sự kiện gốc: dùng để biên đạo hoạt ảnh
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
    f.style.left = (side === 'you' ? 29 : 71) + '%'; f.style.top = (lab ? 4 : 16) + '%';
    f.style.marginLeft = ((n % 3) - 1) * 22 + 'px';
    U.float.appendChild(f);
    setTimeout(() => f.remove(), 1500);
  }
  /* ---------- biên đạo một lượt: chia diễn biến thành các "nhịp" (thế giữ, đòn đánh, phản đòn, dấu hiệu) ---------- */
  const STANCE_K = { guard: 1, charge: 1, release: 1, rest: 1, idle: 1 };
  function choreo(steps, picks) {
    const beats = [];
    for (let i = 0; i < steps.length; i++) {
      const e = steps[i].ev || {};
      if (STANCE_K[e.k]) {
        const last = beats[beats.length - 1];
        if (last && last.type === 'stance') last.steps.push(i); else beats.push({ type: 'stance', steps: [i], impact: [], dur: 680 });
        continue;
      }
      if (e.k === 'hit' || e.k === 'dodge' || e.k === 'parry') {
        const b = { type: 'strike', atk: e.atk, def: e.def, idx: e.idx || 1, of: e.of || 1, steps: [], impact: [i], result: 'hit', tried: null };
        if (e.k !== 'hit') {
          if (e.ok) b.result = e.k;
          else {                                                    // né / đỡ hụt: thử né rồi vẫn trúng đòn ngay sau
            b.tried = e.k; b.steps = [i]; b.impact = [];
            const n = steps[i + 1] && steps[i + 1].ev;
            if (n && n.k === 'hit' && n.atk === e.atk && (n.idx || 1) === b.idx) { b.impact.push(i + 1); i++; } else b.result = 'miss';
          }
        }
        beats.push(b); continue;
      }
      if (e.k === 'counter') { beats.push({ type: 'strike', counter: true, atk: e.side, def: e.target, idx: 1, of: 1, steps: [], impact: [i], result: 'hit' }); continue; }
      if (e.k === 'sudden') { beats.push({ type: 'sudden', steps: [], impact: [i], dur: 820 }); continue; }
      beats.push({ type: 'mark', k: e.k, side: e.side, steps: [], impact: [i], dur: e.k === 'kc' ? 460 : 320 });
    }
    const chain = (x, y) => x && y && x.type === 'strike' && y.type === 'strike' && !x.counter && !y.counter && x.atk === y.atk && y.idx === x.idx + 1;
    beats.forEach((b, k) => {
      if (b.type !== 'strike') return;
      const ap = picks[b.atk] || {}, dp = picks[b.def] || {};
      b.first = !chain(beats[k - 1], b); b.last = !chain(b, beats[k + 1]);
      b.style = b.counter ? styleOf(COUNTER, 'counter', ap.skill) : ap.phase === 'release' ? 'smash' : styleOf(STRIKE, 'strike', ap.skill);
      b.big = b.style === 'smash' || b.style === 'taijiBig';
      b.col = colOf(ap.skill);
      b.dstyle = b.result === 'dodge' || b.tried === 'dodge' ? styleOf(DODGE, 'dodge', dp.skill) : b.result === 'parry' || b.tried === 'parry' ? styleOf(COUNTER, 'counter', dp.skill) : null;
      b.dcol = colOf(dp.skill);
      b.dur = b.counter ? 780 : b.first && b.last ? 940 : b.first ? 640 : b.last ? 600 : 420;
      if (b.style === 'smash') b.dur *= 1.3;
      const mo = MOTION[b.style];
      b.pI = !b.first ? 0.34 : mo === 'rush' ? 0.36 : mo === 'palm' ? 0.6 : mo === 'smash' ? 0.56 : 0.5;
    });
    const attacking = (pk, op) => ['atk', 'release'].includes(stanceOf(pk, op));
    if (attacking(picks.you, picks.op) && attacking(picks.op, picks.you)) {
      const strikes = beats.filter(b => b.type === 'strike'), groups = new Map();
      for (const b of strikes) {
        const i = b.idx || 1;
        if (!groups.has(i)) groups.set(i, []);
        groups.get(i).push({ ...b, clash: true, pI: 0.5 });
      }
      return [...beats.filter(b => b.type === 'stance'), ...[...groups.values()].map(members => ({ type: 'clash', members, dur: Math.max(...members.map(b => b.dur)) })), ...beats.filter(b => b.type !== 'stance' && b.type !== 'strike')];
    }
    return beats;
  }
  /** Khoảng cách lao tới (tính theo khoảng cách hai người) để tay / chân chạm đối thủ. */
  function reachOf(motion) {
    const st = S.stage, r = st && st.cv.getBoundingClientRect(), G = stageGeo(Math.max(8, r ? r.width : 360), Math.max(8, r ? r.height : 160));
    const touch = { fist: 50, rush: 50, shadow: 46, kick: 44, smash: 46 }[motion];
    return touch ? Math.max(0.2, (G.span - touch * G.s) / G.span) : 0.3;
  }
  const bodyNow = side => S.body[side] || null;
  /** Hiệu ứng lúc ra đòn (trước va chạm): chưởng bay, vệt gió, vệt cước. */
  function strikeStart(a) {
    const A = bodyNow(a.atk), D = bodyNow(a.def), st = S.stage;
    if (!A || !D || !st) return;
    const s = A.s, dir = a.atk === 'you' ? 1 : -1, mo = MOTION[a.style], tI = a.dur * a.pI;
    if (mo === 'rush' && a.first) {
      const lines = []; for (let i = 0; i < 7; i++) lines.push({ y: A.y - rnd(20, 95) * s, s: rnd(0, 0.3), l: rnd(0.25, 0.6), w: rnd(1, 2.4) });
      fxAdd('speed', { x0: A.x, x1: D.x - dir * 40 * s, lines, col: a.col, dur: tI * 1.1 });
    }
    if (mo === 'palm') {                                          // chưởng / thái cực bay từ tay sang ngực đối thủ
      const reach = a.reach * (D.x - A.x), hx = A.x + reach + dir * 42 * s, fly = a.dur * 0.24;
      fxAdd('wave', { x0: hx, y0: A.y - 69 * s, x1: D.x - dir * 6 * s, y1: D.y - 62 * s, arc: -10 * s, r: (a.big ? 16 : 11) * s, col: a.col, leaf: a.style === 'palm' ? '#9fd39f' : '#e8ffe9', shape: a.style === 'palm' ? 'leaf' : 'taiji', dur: fly }, tI - fly);
    }
    if (mo === 'kick') fxAdd('slash', { x: D.x - dir * 16 * s, y: D.y - 50 * s, r: 30 * s, a0: dir > 0 ? Math.PI * 0.75 : Math.PI * 0.25, a1: dir > 0 ? Math.PI * 1.55 : -Math.PI * 0.55, col: a.col, dur: a.dur * 0.38 }, tI - a.dur * 0.1);
    if (mo === 'smash') fxAdd('ring', { x: A.x, y: A.y, r0: 10 * s, r1: 48 * s, flat: 0.28, w: 3 * s, col: '#ff8a4a', dur: 420 });
  }
  /** Lúc va chạm: chớp sáng, sóng, hạt, rung màn; khiên của bên thủ sáng lên. */
  function strikeImpact(a) {
    const A = bodyNow(a.atk), D = bodyNow(a.def);
    if (!A || !D) return;
    const s = D.s, dir = a.atk === 'you' ? 1 : -1, hx = D.x - dir * 10 * s, hy = D.y - 60 * s, col = a.col, now = performance.now();
    const shake = amp => { S.shake = { t0: now, dur: 300 + amp * 25, amp }; };
    if (a.result === 'dodge') {
      fxAdd('whoosh', { x: hx, y: hy + 6 * s, r: 30 * s, a0: dir > 0 ? Math.PI * 0.7 : -Math.PI * 0.3, a1: dir > 0 ? Math.PI * 1.3 : Math.PI * 0.3, dur: 380 });
      if (a.dstyle === 'cloud') for (let i = 0; i < 9; i++) part({ x: D.x + rnd(-24, 24) * s, y: D.y - rnd(0, 18) * s, vx: rnd(-30, 30), vy: rnd(-24, -6), max: rnd(500, 800), r: rnd(3, 5.5) * s, kind: 'cloud', col: '#eef3f2' });
      else burst(D.x, D.y - 50 * s, 10, { col: '#ffe39a', kind: 'ember', v0: 20, v1: 90, l0: 400, l1: 800, r0: 1, r1: 2 });
      return;
    }
    if (a.result === 'miss') { fxAdd('whoosh', { x: hx, y: hy, r: 26 * s, a0: Math.PI * 0.8, a1: Math.PI * 1.2, dur: 320 }); return; }
    if (a.result === 'parry') {                                     // đỡ được: chạm chiêu tóe lửa, đòn bật lại
      fxAdd('star', { x: hx, y: hy, r: 14 * s, col: '#ffe0a0', rot: rnd(0, 1), dur: 300 });
      burst(hx, hy, 12, { col: '#ffd38a', an: dir > 0 ? Math.PI : 0, spread: 1.1, v0: 90, v1: 260, l0: 250, l1: 500, r0: 1.2, r1: 2.4 });
      if (a.dstyle === 'shock') fxAdd('ring', { x: D.x, y: D.y - 55 * s, r0: 14 * s, r1: 70 * s, w: 4 * s, col: '#ec7b6c', dur: 460 });
      else if (a.dstyle === 'taiji' || a.dstyle === 'taijiBig') fxAdd('taiji', { x: hx, y: hy, r: (a.dstyle === 'taijiBig' ? 26 : 18) * s, col: '#5f9a6a', spin: -dir, dur: 620 });
      else fxAdd('ring', { x: hx, y: hy, r0: 6 * s, r1: 36 * s, w: 3 * s, col: '#e8c477', dur: 360 });
      shake(2);
      return;
    }
    // trúng đòn
    const guard = shieldOf(a.def);
    if (guard) {
      S.shieldHit[a.def] = now;
      if (guard === 'bell') fxAdd('bell', { x: D.x, y: D.y, s: s * 0.92, dur: 520 });
      else if (guard === 'water') fxAdd('ring', { x: D.x, y: D.y - 56 * s, r0: 30 * s, r1: 62 * s, w: 2.4 * s, col: '#9fe6dc', dur: 460 });
      else if (guard === 'iron') burst(D.x - dir * 30 * s, hy, 10, { col: '#e8f0ff', an: dir > 0 ? Math.PI : 0, spread: 1.2, v0: 80, v1: 220, l0: 200, l1: 420 });
      else if (guard === 'clones') burst(D.x, hy, 8, { col: '#e8c477', kind: 'ember', v0: 30, v1: 120, l0: 300, l1: 600 });
    }
    const big = a.big;
    switch (a.style) {
      case 'fist': case 'shock':
        fxAdd('ring', { x: hx, y: hy, r0: 8 * s, r1: 58 * s, w: 5 * s, col: '#ec7b6c', dur: 420 });
        fxAdd('ring', { x: hx, y: hy, r0: 4 * s, r1: 34 * s, w: 3 * s, col: '#ffd0a0', dur: 300 });
        burst(hx, hy, 14, { col: '#ffb07a', an: dir > 0 ? 0 : Math.PI, spread: 1.3, v0: 120, v1: 320, l0: 220, l1: 480 });
        break;
      case 'rush':
        burst(hx, hy, 16, { col: '#ffe39a', an: dir > 0 ? 0 : Math.PI, spread: 0.9, v0: 160, v1: 380, l0: 180, l1: 420 });
        break;
      case 'kick':
        fxAdd('ring', { x: hx, y: D.y - 48 * s, r0: 6 * s, r1: 30 * s, w: 3 * s, col: '#e8c477', dur: 300 });
        burst(hx, D.y - 48 * s, 10, { col: '#ffe39a', an: dir > 0 ? 0 : Math.PI, spread: 1.2, v0: 100, v1: 260, l0: 200, l1: 420 });
        break;
      case 'palm':
        fxAdd('ring', { x: hx, y: hy, r0: 6 * s, r1: 44 * s, w: 2.6 * s, col: '#9fd39f', dur: 480 });
        for (let i = 0; i < 12; i++) part({ x: hx, y: hy, vx: dir * rnd(30, 170), vy: rnd(-120, 60), gy: 90, max: rnd(600, 1000), r: rnd(1.6, 2.6) * s, kind: 'leaf', col: Math.random() < 0.5 ? '#9fd39f' : '#6fae6a', vr: rnd(-9, 9), drag: 1.2 });
        break;
      case 'taiji': case 'taijiBig':
        fxAdd('taiji', { x: hx, y: hy, r: (big ? 30 : 20) * s, col: '#5f9a6a', spin: dir, dur: 700 });
        for (let i = 0; i < 10; i++) part({ x: hx, y: hy, vx: dir * rnd(40, 180), vy: rnd(-120, 40), gy: 80, max: rnd(600, 900), r: rnd(1.5, 2.4) * s, kind: 'leaf', col: '#9fd39f', vr: rnd(-9, 9), drag: 1.2 });
        break;
      case 'shadow': {
        const r = 30 * s;
        fxAdd('slash', { x: hx, y: hy, r, a0: -Math.PI * 0.85, a1: -Math.PI * 0.05, col: '#c9a24a', dur: 360 });
        fxAdd('slash', { x: hx, y: hy + 4 * s, r: r * 0.9, a0: Math.PI * 0.15, a1: Math.PI * 0.95, col: '#7a5cc0', dur: 360 }, 70);
        break;
      }
      case 'smash': {                                               // Tụ Lực Phá Sơn: nứt lôi đài, đá văng, sóng đỏ
        const gx = D.x - dir * 22 * s, gy = D.y + 2 * s, lines = [];
        for (let i = 0; i < 6; i++) {
          let x = gx, y = gy, an = (i / 6) * TAU + rnd(-0.3, 0.3); const L = [[x, y]];
          for (let j = 0; j < 6; j++) { an += rnd(-0.5, 0.5); const d = rnd(6, 13) * s; x += Math.cos(an) * d; y += Math.sin(an) * d * 0.3; L.push([x, y]); }
          lines.push(L);
        }
        fxAdd('crack', { lines, w: 2.2 * s, dur: 1300 });
        fxAdd('ring', { x: gx, y: gy, r0: 10 * s, r1: 110 * s, flat: 0.28, w: 6 * s, col: '#ff6a3a', dur: 560 });
        fxAdd('ring', { x: hx, y: hy, r0: 10 * s, r1: 80 * s, w: 6 * s, col: '#ffd36b', dur: 480 });
        fxAdd('flash', { col: '#fff1d0', a: 0.35, dur: 260 });
        for (let i = 0; i < 16; i++) part({ x: gx + rnd(-16, 16) * s, y: gy - 4, vx: rnd(-160, 160), vy: rnd(-300, -120), gy: 900, max: rnd(700, 1100), r: rnd(1.6, 3.6) * s, kind: 'rock', col: Math.random() < 0.5 ? '#6b3a1f' : '#9c7b5a', vr: rnd(-10, 10), floor: gy + 6 * s });
        for (let i = 0; i < 10; i++) part({ x: gx + rnd(-20, 20) * s, y: gy, vx: rnd(-60, 60), vy: rnd(-40, -10), max: rnd(700, 1100), r: rnd(5, 9) * s, kind: 'dust', col: '#a08060' });
        break;
      }
      default: break;
    }
    if (a.style !== 'smash') fxAdd('star', { x: hx, y: hy, r: (big ? 22 : 15) * s, col, rot: rnd(0, 1), dur: 300 });
    shake(a.style === 'smash' ? 11 : a.style === 'taijiBig' ? 6 : a.style === 'fist' || a.style === 'shock' ? 5 : 3);
  }
  function markFx(b) {
    const B = bodyNow(b.side);
    if (!B) return;
    const s = B.s;
    if (b.k === 'kc') { fxAdd('bell', { x: B.x, y: B.y, s: s * 0.92, dur: 640 }); burst(B.x, B.y - 60 * s, 12, { col: '#ffd36b', kind: 'ember', v0: 20, v1: 110, l0: 500, l1: 900 }); }
    else if (b.k === 'exposed') fxAdd('ring', { x: B.x, y: B.y, r0: 8 * s, r1: 40 * s, flat: 0.3, w: 2 * s, col: '#ec7b6c', dur: 420 });
  }
  function stanceFx(side, k) {
    const B = bodyNow(side);
    if (!B) return;
    const s = B.s;
    if (k === 'charge' || k === 'release') { fxAdd('ring', { x: B.x, y: B.y, r0: 50 * s, r1: 12 * s, flat: 0.28, w: 3 * s, col: k === 'release' ? '#ff6a3a' : '#ffb04a', dur: 520 }); if (k === 'release') fxAdd('flash', { col: '#ff8a4a', a: 0.12, dur: 300 }); }
    else if (k === 'rest') fxAdd('ring', { x: B.x, y: B.y, r0: 10 * s, r1: 46 * s, flat: 0.3, w: 2 * s, col: '#7fd38a', dur: 600 });
    else if (k === 'guard') { const g = shieldOf(side); fxAdd('ring', { x: B.x, y: B.y - 55 * s, r0: 20 * s, r1: 56 * s, w: 2 * s, col: g === 'bell' ? '#ffd36b' : g === 'water' ? '#9fe6dc' : g === 'iron' ? '#c6d3dc' : '#e8c477', dur: 420 }); }
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
    // thế giữ của lượt trước bỏ đi: lượt này dựng lại từ diễn biến (tụ lực đã tụ thì lượt này là "tung đòn")
    S.hold = { you: null, op: null }; S.fx.length = 0; S.shieldHit = {}; dirtyStage();
    U.turn.textContent = `Lượt ${rev.turn}`; U.turn.appendChild(h('small', null, ` / ${M.PK.MAX_TURNS}`));
    U.clock.textContent = ''; U.tfill.style.width = '0%';
    U.fc.op.lock.hidden = true;
    addLog(rev, label);
    const R = m.rev = { rev, steps, i: 0, timers: [], done: false, flipped: false, labelled: false, label, picks, fxDone: new Set() };
    const avail = rev.nextAt ? rev.nextAt - nowMs() : 6000;
    const beats = choreo(steps, picks), T0 = 900, budget = avail - 350 - T0;
    R.deferHp = beats.some(b => b.type === 'clash');
    const total = beats.reduce((a, b) => a + b.dur + 60, 0);
    const instant = o.instant || reduced() || avail < 1600 || budget < 700;
    const doFlip = () => {
      if (R.flipped) return; R.flipped = true;
      for (const f of [rv.flipYou, rv.flipOp]) {
        f.w.classList.add('on'); f.front.removeAttribute('aria-hidden');
        f.w.setAttribute('aria-label', `${f.side === 'you' ? 'Chiêu của bạn' : 'Chiêu của đối thủ'}: ${f.nm.textContent}`);
      }
      for (const side of ['you', 'op']) { setBars(U.fc[side], rev.state[side], 'mp'); setBars(U.fc[side], rev.state[side], 'rg'); }
    };
    const doLabel = () => { if (R.labelled) return; R.labelled = true; rv.label.textContent = label; rv.label.classList.add('on'); };
    // dòng chữ diễn biến: luôn theo đúng thứ tự
    const line = i => {
      while (R.i <= i && R.i < steps.length) {
        const s = steps[R.i]; R.i++;
        rv.lines.appendChild(lineEl(s));
        if (s.hold) setHold(s.hold[0], s.hold[1], 0);
      }
      rv.lines.scrollTop = rv.lines.scrollHeight;
    };
    const setHold = (side, k, t0) => { S.hold[side] = k ? { k, skill: picks[side] && picks[side].skill, t0 } : null; dirtyStage(); };
    const applyFx = i => {
      if (R.fxDone.has(i)) return; R.fxDone.add(i);
      for (const f of steps[i].fx || []) {
        if (f[0] === 'float') floatAt(f[1], f[2], f[3]);
        else if (f[0] === 'hp' && !R.deferHp) { m.disp[f[1]].hp = Math.max(0, m.disp[f[1]].hp - f[2]); setBars(U.fc[f[1]], Object.assign({}, rev.state[f[1]], { hp: m.disp[f[1]].hp }), 'hp'); }
      }
    };
    const at = (ms, fn) => R.timers.push(setTimeout(() => { if (!R.done) fn(); }, Math.max(0, ms)));
    const runBeat = (b, d) => {
      const now = performance.now();
      if (b.type === 'clash') { for (const member of b.members) runBeat(member, d); return; }
      if (b.type === 'stance') {
        for (const i of b.steps) {
          const s = steps[i];
          line(i - 1);
          if (s.hold && s.hold[1]) { setHold(s.hold[0], s.hold[1], now); stanceFx(s.hold[0], s.hold[1]); }
          rv.lines.appendChild(lineEl(s)); R.i = Math.max(R.i, i + 1); rv.lines.scrollTop = rv.lines.scrollHeight;
          applyFx(i);
        }
        return;
      }
      for (const i of b.steps) line(i);
      if (b.type === 'strike') {
        const mv = Object.assign({}, b, { type: 'strike', t0: now, dur: d, reach: b.clash ? 0.43 : reachOf(MOTION[b.style]) });
        S.fx.push(mv); if (S.fx.length > 12) S.fx.shift();
        strikeStart(mv);
        at(d * b.pI, () => { for (const i of b.impact) { line(i); applyFx(i); } strikeImpact(mv); });
        if (b.style === 'smash' && b.last) at(d * 0.95, () => { const hd = holdOf(b.atk); if (hd && hd.k === 'release') setHold(b.atk, null); });
        return;
      }
      for (const i of b.impact) { line(i); applyFx(i); }
      if (b.type === 'sudden') {
        fxAdd('flash', { col: '#c0181a', a: 0.35, dur: 700 });
        for (const side of ['you', 'op']) S.fx.push({ type: 'flinch', side, t0: now, dur: 520 });
        S.shake = { t0: now, dur: 420, amp: 4 };
      } else markFx(b);
    };
    R.finish = () => {
      if (R.done) return;
      R.done = true; R.timers.forEach(clearTimeout); R.timers = [];
      doFlip(); doLabel(); line(steps.length - 1);
      for (const side of ['you', 'op']) { const hd = holdOf(side); if (hd && hd.k === 'release') S.hold[side] = null; }
      S.fx.length = 0;
      for (const side of ['you', 'op']) setFighter(side, rev.state[side]);
      m.state = rev.state; m.holdUntil = Date.now() + (rev.ended ? 900 : 0);
      U.status.textContent = '';
      if (rev.ended) rv.lines.appendChild(h('li', 'ar-ln ar-ln-end', 'Trận đấu kết thúc…'));
      dirtyStage();
      maybeEnd();
    };
    if (instant) {
      doFlip(); doLabel();
      for (const f of [rv.flipYou, rv.flipOp]) f.w.classList.add('on');
      R.finish();
      return;
    }
    // dồn nhịp nếu thời gian tới lượt sau không đủ (giữ tối thiểu 40% để còn nhìn rõ)
    const k = total > budget ? Math.max(0.4, budget / total) : 1;
    at(250, doFlip); at(Math.min(850, T0 - 50), doLabel);
    let tt = T0;
    for (const b of beats) { const d = b.dur * k; at(tt, () => runBeat(b, d)); tt += d + 60 * k; }
    at(tt + 200, R.finish);
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
    else if (r === 'double-ko') {
      const dy = d.state && d.state.you && d.state.you.down, dop = d.state && d.state.op && d.state.op.down;
      const nums = Number.isFinite(dy) && Number.isFinite(dop) ? ` (bạn âm ${dy}, đối thủ âm ${dop})` : '';
      text = 'Cả hai cùng hết máu' + nums + (res === 'win' ? ', nhưng bạn còn ít âm hơn nên thắng.' : res === 'lose' ? ', nhưng đối thủ còn ít âm hơn nên thắng.' : ' và ngang nhau nên hòa.');
    }
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
      const title = M.pkTitle(r.wins, r.draws);
      fact('Danh hiệu PK', `${title.name} · ${title.points} điểm chiến tích`);
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
      learned: Array.isArray(d.you.learned) ? d.you.learned : [], mastery: d.you.mastery || {}, sel: youLoad, locked: false, pending: false, timeUp: false, opReady: false, msg: '', state: null, disp: { you: {}, op: {} }
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
    S.resuming = false;
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
      learned: [], mastery: snap.you.mastery || {}, sel: [], locked: false, pending: false, timeUp: false, opReady: !!snap.opLocked, msg: '', disp: { you: {}, op: {} }, log: []
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
    if (root.Hall && root.Hall.setTagger) root.Hall.setTagger(tagOf);
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
    if (root.SFX) root.SFX.setMusicScene(S.screen === 'match' ? 'battle' : 'arena');
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
    yardOn(S.screen === 'roster');
    S.ui.roster.resume.hidden = !a.hasMatch; S.resuming = !!a.hasMatch;
    clearInterval(S.tick); S.tick = setInterval(tick, 250);
    S.connected = S.sock.connected !== false;
    refreshCtl();
    resumeMatch(() => { S.ui.roster.resume.hidden = true; S.resuming = false; });
  }
  function hide() {
    S.visible = false; S.resuming = false;
    if (root.SFX) root.SFX.setMusicScene('temple');
    yardOn(false);
    clearInterval(S.tick); S.tick = 0; stopPaint();
    clearMatchTimers();
    if (S.mounted) {
      closeAllDlg();
      S.invites.slice().forEach(i => removeInvite(i.inviteId)); S.out = null;
      S.m = null; S.stage = null; S.fx.length = 0; dropPaint('lobby'); dropPaint('match');
      if (S.screen !== 'roster') go('roster');
    }
  }

  root.Arena = { init, mount, show, hide, inMatch, pick, inYard };
})(this);
