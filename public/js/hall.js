/*
 * Cảnh chánh điện vẽ bằng Canvas 2D: tượng Phật, bàn thờ, bát hương, khói nhang,
 * và nhân vật mặc áo dài của mọi người đang có mặt (tên trên đầu, bong bóng chat, thả tim, vái lạy).
 * Toạ độ sàn: x 0..1 (trái → phải), z 0..1 (z = 0 sát bàn thờ, z = 1 phía trước).
 */
(function (root) {
  'use strict';
  const TAU = Math.PI * 2;
  const COLORS = [
    { n: 'Đỏ son', c: '#c0392b' }, { n: 'Vàng nghệ', c: '#e2a93b' }, { n: 'Hồng sen', c: '#e48aa5' }, { n: 'Xanh ngọc', c: '#3fa58d' },
    { n: 'Tím Huế', c: '#8e5fb8' }, { n: 'Trắng ngà', c: '#efe8da' }, { n: 'Xanh lam', c: '#3b78c2' }, { n: 'Cam', c: '#e07b39' },
    { n: 'Áo tràng lam', c: '#7b8ea6' }, { n: 'Áo tràng nâu', c: '#8a6a4c' }, { n: 'Xanh lá', c: '#5f9a4a' }, { n: 'Đen tuyền', c: '#2c2a30' }
  ];
  const HAIRS = ['Tóc dài', 'Búi tóc', 'Tóc ngắn', 'Khăn vấn'];
  const SKIN = '#f0c9a4', HAIR = '#1f1612';
  const reduceMotion = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rand = (a, b) => a + Math.random() * (b - a);

  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16), t = amt < 0 ? 0 : 255, p = Math.abs(amt);
    const f = c => Math.round((t - c) * p + c);
    return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
  }
  function circle(g, x, y, r) { g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); }
  function rrect(g, x, y, w, h, r) { g.beginPath(); if (g.roundRect) g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h); }

  /* ---------------- nhân vật áo dài ---------------- */
  function drawHead(g, look, front, col) {
    const hy = -88, r = 11.5, h = look.h, male = look.g === 'nam';
    const turban = male ? '#1d1a1f' : shade(col, -0.32);
    if (!front) {
      g.fillStyle = HAIR; circle(g, 0, hy, r + 0.5);
      if (h === 0) { g.beginPath(); g.moveTo(-9, hy + 2); g.lineTo(-7.5, -57); g.quadraticCurveTo(0, -53, 7.5, -57); g.lineTo(9, hy + 2); g.closePath(); g.fill(); }
      if (h === 1) { g.fillStyle = '#2b1f19'; circle(g, 0, hy + 3, 6.2); }
      if (h === 3) { g.fillStyle = turban; g.beginPath(); g.ellipse(0, hy - 4, r + 2.6, 6.5, 0, 0, TAU); g.fill(); g.strokeStyle = shade(col, -0.5); g.lineWidth = 0.8; g.beginPath(); g.ellipse(0, hy - 4, r + 1, 4, 0, 0, TAU); g.stroke(); }
      return;
    }
    g.fillStyle = SKIN; circle(g, 0, hy, r);
    g.fillStyle = HAIR;
    if (h === 3) {
      g.fillStyle = turban; g.beginPath(); g.ellipse(0, hy - 7, r + 2.6, 6.8, 0, 0, TAU); g.fill();
      g.strokeStyle = shade(col, -0.5); g.lineWidth = 0.8; g.beginPath(); g.ellipse(0, hy - 7, r + 1, 4.2, 0, 0, TAU); g.stroke();
    } else {
      g.beginPath(); g.arc(0, hy, r + 0.6, Math.PI, 0); g.lineTo(r + 0.6, hy - 1); g.quadraticCurveTo(3, hy - 8, -r - 0.6, hy); g.closePath(); g.fill();
      if (h === 0) { g.fillRect(-r - 0.6, hy - 2, 3.6, 17); g.fillRect(r - 3, hy - 2, 3.6, 17); }
      if (h === 1) circle(g, 0, hy - r - 2, 5.6);
    }
    g.fillStyle = '#2a1a12'; circle(g, -4, hy + 1, 1.3); circle(g, 4, hy + 1, 1.3);
    g.fillStyle = 'rgba(232,120,110,.35)'; circle(g, -6.5, hy + 4.5, 2); circle(g, 6.5, hy + 4.5, 2);
    g.strokeStyle = '#9b4a3c'; g.lineWidth = 1; g.beginPath(); g.arc(0, hy + 4.6, 2.2, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke();
  }
  // Vẽ ở hệ đơn vị: chân tại (0,0), cao ~100 đơn vị
  function drawAvatar(g, look, front, t, bow, walking) {
    const col = (COLORS[look.c] || COLORS[0]).c, dk = shade(col, -0.28), lt = shade(col, 0.2), sleeve = shade(col, -0.1);
    const male = look.g === 'nam', sw = male ? 15 : 13, ww = male ? 12 : 9.5, hem = male ? 14 : 16.5;
    const bob = walking ? Math.abs(Math.sin(t * 9)) * 2.2 : 0;
    const sway = walking ? Math.sin(t * 9) * 1.6 : Math.sin(t * 1.3) * 0.4;
    g.fillStyle = 'rgba(0,0,0,.32)'; g.beginPath(); g.ellipse(0, 0, 17, 4.5, 0, 0, TAU); g.fill();
    g.save(); g.translate(0, -bob);
    g.fillStyle = '#f3eee4'; g.fillRect(-7, -16, 5.5, 14); g.fillRect(1.5, -16, 5.5, 14);
    g.fillStyle = '#3a2418'; rrect(g, -8, -3.2, 7, 3.2, 1.5); g.fill(); rrect(g, 1, -3.2, 7, 3.2, 1.5); g.fill();
    // tà áo
    g.fillStyle = col;
    g.beginPath(); g.moveTo(-ww, -50); g.lineTo(ww, -50); g.lineTo(hem + sway, -11); g.quadraticCurveTo(sway, -8, -hem + sway, -11); g.closePath(); g.fill();
    g.strokeStyle = dk; g.lineWidth = 1.1;
    g.beginPath(); g.moveTo(-ww + 1, -50); g.lineTo(-hem + sway + 2.5, -11.5); g.moveTo(ww - 1, -50); g.lineTo(hem + sway - 2.5, -11.5); g.stroke();
    // thân trên (cúi khi vái)
    g.save();
    if (bow > 0) { g.translate(0, -50); g.scale(1, 1 - 0.2 * bow); g.translate(0, 50 + 13 * bow); }
    g.fillStyle = col;
    g.beginPath(); g.moveTo(-sw, -73); g.quadraticCurveTo(0, -77, sw, -73); g.lineTo(ww + 0.5, -49); g.lineTo(-ww - 0.5, -49); g.closePath(); g.fill();
    g.lineCap = 'round';
    if (front) {
      g.strokeStyle = sleeve; g.lineWidth = 5.5;
      g.beginPath(); g.moveTo(-sw + 1.5, -71); g.quadraticCurveTo(-sw - 1, -55, -2.5, -60); g.moveTo(sw - 1.5, -71); g.quadraticCurveTo(sw + 1, -55, 2.5, -60); g.stroke();
      g.fillStyle = SKIN; g.beginPath(); g.ellipse(0, -63.5, 2.6, 4.6, 0, 0, TAU); g.fill();
      g.fillStyle = dk; g.fillRect(-3.5, -78, 7, 4.5);
      g.strokeStyle = lt; g.lineWidth = 1; g.beginPath(); g.moveTo(0, -74); g.quadraticCurveTo(6, -72, 9, -66); g.stroke();
    } else {
      g.strokeStyle = sleeve; g.lineWidth = 5;
      g.beginPath(); g.moveTo(-sw + 1, -71); g.quadraticCurveTo(-sw - 2.5, -60, -sw + 3.5, -52); g.moveTo(sw - 1, -71); g.quadraticCurveTo(sw + 2.5, -60, sw - 3.5, -52); g.stroke();
      g.fillStyle = dk; g.fillRect(-3.5, -78, 7, 3.5);
    }
    g.fillStyle = SKIN; g.fillRect(-3, -81, 6, 5);
    drawHead(g, look, front, col);
    g.restore();
    g.restore();
  }

  /* ---------------- tượng Phật ---------------- */
  const PATH = root.Path2D ? {
    torso: new Path2D('M352,160 Q400,142 448,160 Q470,170 468,205 L463,248 L337,248 L332,205 Q330,170 352,160 Z'),
    robe: new Path2D('M358,162 Q402,200 458,236'),
    lapFold: new Path2D('M338,252 Q400,270 462,252')
  } : null;
  function petal(b, x, base, tip, w, fill) {
    b.beginPath(); b.moveTo(x - w, base);
    b.quadraticCurveTo(x - w - 1, base - (base - tip) * 0.6, x, tip);
    b.quadraticCurveTo(x + w + 1, base - (base - tip) * 0.6, x + w, base); b.closePath();
    b.fillStyle = fill; b.fill(); b.strokeStyle = '#6e4b1f'; b.lineWidth = 1; b.stroke();
  }
  function statue(b, cx, pedY, s) {
    b.save(); b.translate(cx - 400 * s, pedY - 338 * s); b.scale(s, s);
    let gr = b.createRadialGradient(400, 170, 0, 400, 170, 172);
    gr.addColorStop(0, 'rgba(245,210,124,.52)'); gr.addColorStop(0.45, 'rgba(217,164,65,.16)'); gr.addColorStop(1, 'rgba(217,164,65,0)');
    b.fillStyle = gr; b.beginPath(); b.arc(400, 170, 172, 0, TAU); b.fill();
    b.strokeStyle = 'rgba(212,171,82,.3)'; b.lineWidth = 1.2; b.beginPath();
    for (let i = 0; i < 48; i++) { const a = i / 48 * TAU, r2 = i % 2 ? 150 : 162; b.moveTo(400 + Math.cos(a) * 128, 160 + Math.sin(a) * 128); b.lineTo(400 + Math.cos(a) * r2, 160 + Math.sin(a) * r2); }
    b.stroke();
    b.strokeStyle = 'rgba(212,171,82,.45)'; b.lineWidth = 1.5; b.beginPath(); b.arc(400, 160, 112, 0, TAU); b.stroke();
    gr = b.createRadialGradient(400, 106, 0, 400, 106, 50); gr.addColorStop(0, 'rgba(255,224,140,.55)'); gr.addColorStop(1, 'rgba(255,224,140,0)');
    b.fillStyle = gr; b.beginPath(); b.arc(400, 106, 50, 0, TAU); b.fill();
    b.strokeStyle = 'rgba(232,195,110,.55)'; b.lineWidth = 1.2; b.beginPath(); b.arc(400, 106, 44, 0, TAU); b.stroke();
    // bệ
    gr = b.createLinearGradient(0, 296, 0, 338); gr.addColorStop(0, '#93261d'); gr.addColorStop(1, '#55120d');
    b.fillStyle = gr; b.fillRect(290, 296, 220, 42); b.strokeStyle = '#d4ab52'; b.lineWidth = 1.5; b.strokeRect(290, 296, 220, 42);
    b.strokeStyle = 'rgba(212,171,82,.45)'; b.lineWidth = 1; b.strokeRect(300, 304, 200, 26);
    b.fillStyle = '#6e4b1f'; b.beginPath(); b.ellipse(400, 291, 122, 12, 0, 0, TAU); b.fill();
    [340, 370, 400, 430, 460].forEach(x => petal(b, x, 288, 256, 15, '#b78637'));
    const gold = b.createLinearGradient(0, 66, 0, 280); gold.addColorStop(0, '#f1d184'); gold.addColorStop(0.55, '#cf9f45'); gold.addColorStop(1, '#8e6424');
    const side = b.createLinearGradient(330, 0, 470, 0); side.addColorStop(0, '#9c702a'); side.addColorStop(0.45, '#f0cd7c'); side.addColorStop(1, '#946827');
    b.fillStyle = gold; b.fillRect(389, 130, 22, 20);
    if (PATH) { b.fillStyle = side; b.fill(PATH.torso); b.strokeStyle = 'rgba(142,100,36,.6)'; b.lineWidth = 2; b.stroke(PATH.robe); }
    b.fillStyle = gold; b.beginPath(); b.ellipse(400, 252, 94, 24, 0, 0, TAU); b.fill();
    if (PATH) { b.strokeStyle = 'rgba(142,100,36,.5)'; b.lineWidth = 1.5; b.stroke(PATH.lapFold); }
    b.fillStyle = '#f3d58c'; b.beginPath(); b.ellipse(400, 241, 28, 9, 0, 0, TAU); b.fill();
    b.fillStyle = gold;
    b.beginPath(); b.ellipse(373, 116, 5, 13, 0, 0, TAU); b.fill();
    b.beginPath(); b.ellipse(427, 116, 5, 13, 0, 0, TAU); b.fill();
    b.beginPath(); b.ellipse(400, 109, 25, 30, 0, 0, TAU); b.fill();
    b.beginPath(); b.arc(400, 77, 10, 0, TAU); b.fill();
    const pg = b.createLinearGradient(0, 266, 0, 299); pg.addColorStop(0, '#f1d184'); pg.addColorStop(1, '#a8782e');
    [312, 341, 370, 400, 430, 459, 488].forEach(x => petal(b, x, 299, 266, 16, pg));
    b.restore();
  }

  /* ---------------- module cảnh ---------------- */
  let cv, g, W = 0, H = 0, DPR = 1, bg = null, u = 1, au = 1;
  const G = {};
  const players = new Map();
  let me = 0, offset = 0, last = 0;
  let incense = [];
  const parts = [], hearts = [], floaters = [], ripples = [];
  const altar = { lotus: 0, rose: 0, lamp: 0, fruit: 0 };
  const handlers = {};
  let clickMark = null;
  const serverNow = () => Date.now() + offset;

  function geo() {
    u = Math.min(W / 960, H / 600);
    au = Math.max(u, 0.5);
    G.hb = Math.round(H * 0.5); G.hf = H;
    G.wb = W * 0.36; G.wf = W * 0.64;
    G.pedY = G.hb - 22 * u;
    G.tw = Math.min(W * 0.22, G.wb * 0.62);
    G.ty = G.hb - 16 * u;
    G.bowl = { x: W / 2, y: G.ty - 24 * u, rx: 46 * u, ry: 6 * u };
    G.statueTop = G.pedY - 280 * 0.64 * u;
  }
  function proj(x, z) {
    const y = G.hb + (G.hf - G.hb) * z, hw = G.wb + (G.wf - G.wb) * z;
    return [W / 2 + (x - 0.5) * 2 * hw, y, 0.62 + 0.55 * z];
  }
  function unproj(sx, sy) {
    const z = (sy - G.hb) / (G.hf - G.hb), hw = G.wb + (G.wf - G.wb) * z;
    return [0.5 + (sx - W / 2) / (2 * hw), z];
  }

  function pillar(b, x, w, bottom) {
    const gr = b.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
    gr.addColorStop(0, '#3e0c09'); gr.addColorStop(0.5, '#9a271c'); gr.addColorStop(1, '#3e0c09');
    b.fillStyle = gr; b.fillRect(x - w / 2, 0, w, bottom);
    b.fillStyle = '#c99a45'; b.fillRect(x - w / 2 - 2 * u, 58 * u, w + 4 * u, 5 * u); b.fillRect(x - w / 2 - 2 * u, bottom - 34 * u, w + 4 * u, 5 * u);
    b.fillStyle = '#2e2119'; b.fillRect(x - w / 2 - 5 * u, bottom - 10 * u, w + 10 * u, 12 * u);
  }
  function lantern(b, x) {
    const y = 52 * u;
    b.strokeStyle = '#7a5a2a'; b.lineWidth = 1.2 * u; b.beginPath(); b.moveTo(x, 12 * u); b.lineTo(x, y - 18 * u); b.stroke();
    const gl = b.createRadialGradient(x, y, 0, x, y, 46 * u); gl.addColorStop(0, 'rgba(255,140,60,.35)'); gl.addColorStop(1, 'rgba(255,140,60,0)');
    b.fillStyle = gl; b.beginPath(); b.arc(x, y, 46 * u, 0, TAU); b.fill();
    const lg = b.createRadialGradient(x - 4 * u, y - 4 * u, 2 * u, x, y, 18 * u); lg.addColorStop(0, '#ff6b3d'); lg.addColorStop(1, '#a3180f');
    b.fillStyle = lg; b.beginPath(); b.ellipse(x, y, 14 * u, 18 * u, 0, 0, TAU); b.fill();
    b.strokeStyle = 'rgba(255,200,120,.35)'; b.lineWidth = 0.8 * u; b.beginPath(); b.ellipse(x, y, 7 * u, 18 * u, 0, 0, TAU); b.stroke();
    b.fillStyle = '#d4ab52'; b.fillRect(x - 7 * u, y - 20 * u, 14 * u, 4 * u); b.fillRect(x - 7 * u, y + 16 * u, 14 * u, 4 * u);
    b.strokeStyle = '#d4ab52'; b.beginPath(); b.moveTo(x, y + 20 * u); b.lineTo(x, y + 34 * u); b.stroke();
  }
  function drawBg() {
    bg = document.createElement('canvas'); bg.width = cv.width; bg.height = cv.height;
    const b = bg.getContext('2d'); b.setTransform(DPR, 0, 0, DPR, 0, 0);
    let gr = b.createRadialGradient(W / 2, H * 0.22, 10, W / 2, H * 0.3, Math.max(W, H) * 0.75);
    gr.addColorStop(0, '#5a2e18'); gr.addColorStop(0.45, '#2a140b'); gr.addColorStop(1, '#0d0705');
    b.fillStyle = gr; b.fillRect(0, 0, W, H);
    b.strokeStyle = 'rgba(120,70,40,.16)'; b.lineWidth = 1; b.beginPath();
    for (let x = (W / 2) % (30 * u); x < W; x += 30 * u) { b.moveTo(x, 14 * u); b.lineTo(x, G.hb); }
    b.stroke();
    b.fillStyle = '#5e1610'; b.fillRect(0, 0, W, 11 * u); b.fillStyle = '#c99a45'; b.fillRect(0, 11 * u, W, 2 * u);
    const sideX = G.wb * 0.64;
    statue(b, W / 2 - sideX, G.pedY + 4 * u, 0.5 * u);
    statue(b, W / 2 + sideX, G.pedY + 4 * u, 0.5 * u);
    statue(b, W / 2, G.pedY, 0.64 * u);
    lantern(b, W / 2 - G.wb * 0.82); lantern(b, W / 2 + G.wb * 0.82);
    for (const [px, pw] of [[-0.34, 24], [0.34, 24], [-1, 36], [1, 36]]) pillar(b, W / 2 + G.wb * px, pw * u, G.hb + 4 * u);
    // hoành phi
    const hw = 112 * u, hy = 18 * u;
    gr = b.createLinearGradient(0, hy, 0, hy + 40 * u); gr.addColorStop(0, '#93261d'); gr.addColorStop(1, '#55120d');
    b.fillStyle = gr; b.fillRect(W / 2 - hw, hy, hw * 2, 40 * u);
    b.strokeStyle = '#d4ab52'; b.lineWidth = 2 * u; b.strokeRect(W / 2 - hw, hy, hw * 2, 40 * u);
    b.strokeStyle = 'rgba(212,171,82,.5)'; b.lineWidth = 1; b.strokeRect(W / 2 - hw + 5 * u, hy + 5 * u, hw * 2 - 10 * u, 30 * u);
    b.fillStyle = '#e9c674'; b.font = `600 ${Math.round(22 * u)}px "Cormorant Garamond", Georgia, serif`; b.textAlign = 'center'; b.textBaseline = 'middle';
    if ('letterSpacing' in b) b.letterSpacing = `${Math.round(4 * u)}px`;
    b.fillText('TỪ BI HỶ XẢ', W / 2, hy + 21 * u);
    if ('letterSpacing' in b) b.letterSpacing = '0px';
    // sàn
    b.fillStyle = '#140904'; b.fillRect(0, G.hb, W, H - G.hb);
    b.save();
    b.beginPath(); b.moveTo(W / 2 - G.wb, G.hb); b.lineTo(W / 2 + G.wb, G.hb); b.lineTo(W / 2 + G.wf, H); b.lineTo(W / 2 - G.wf, H); b.closePath(); b.clip();
    gr = b.createLinearGradient(0, G.hb, 0, H); gr.addColorStop(0, '#3d2115'); gr.addColorStop(1, '#1f0f09');
    b.fillStyle = gr; b.fillRect(0, G.hb, W, H - G.hb);
    // thảm đỏ giữa lối đi
    const c1 = proj(0.4, 0), c2 = proj(0.6, 0), c3 = proj(0.6, 1), c4 = proj(0.4, 1);
    b.fillStyle = '#5e1610'; b.beginPath(); b.moveTo(c1[0], c1[1]); b.lineTo(c2[0], c2[1]); b.lineTo(c3[0], c3[1]); b.lineTo(c4[0], c4[1]); b.closePath(); b.fill();
    b.strokeStyle = 'rgba(212,171,82,.55)'; b.lineWidth = 1.5;
    for (const x of [0.41, 0.59]) { const a = proj(x, 0), c = proj(x, 1); b.beginPath(); b.moveTo(a[0], a[1]); b.lineTo(c[0], c[1]); b.stroke(); }
    b.strokeStyle = 'rgba(201,154,69,.1)'; b.lineWidth = 1; b.beginPath();
    for (let i = 0; i <= 16; i++) { const a = proj(i / 16, 0), c = proj(i / 16, 1); b.moveTo(a[0], a[1]); b.lineTo(c[0], c[1]); }
    for (let j = 1; j <= 10; j++) { const y = proj(0, Math.pow(j / 10, 1.35))[1]; b.moveTo(0, y); b.lineTo(W, y); }
    b.stroke();
    b.restore();
    // bàn thờ
    const tw = G.tw, ty = G.ty, fb = G.hb + 22 * u;
    b.fillStyle = 'rgba(0,0,0,.35)'; b.beginPath(); b.ellipse(W / 2, fb + 4 * u, tw + 20 * u, 8 * u, 0, 0, TAU); b.fill();
    gr = b.createLinearGradient(0, ty + 8 * u, 0, fb); gr.addColorStop(0, '#93261d'); gr.addColorStop(1, '#55120d');
    b.fillStyle = gr; b.fillRect(W / 2 - tw, ty + 8 * u, tw * 2, fb - ty - 8 * u);
    b.strokeStyle = '#d4ab52'; b.lineWidth = 1; b.strokeRect(W / 2 - tw, ty + 8 * u, tw * 2, fb - ty - 8 * u);
    b.strokeStyle = 'rgba(212,171,82,.45)'; b.strokeRect(W / 2 - tw + 6 * u, ty + 13 * u, tw * 2 - 12 * u, fb - ty - 19 * u);
    b.strokeStyle = 'rgba(212,171,82,.7)'; b.beginPath(); b.arc(W / 2, (ty + fb) / 2 + 4 * u, 8 * u, 0, TAU); b.stroke();
    for (const k of [-0.5, 0.5]) { const x = W / 2 + tw * k, y = (ty + fb) / 2 + 4 * u, d = 6 * u; b.beginPath(); b.moveTo(x, y - d); b.lineTo(x + d, y); b.lineTo(x, y + d); b.lineTo(x - d, y); b.closePath(); b.stroke(); }
    b.fillStyle = '#6e1a13'; b.fillRect(W / 2 - tw - 6 * u, ty, tw * 2 + 12 * u, 8 * u);
    b.strokeStyle = '#d4ab52'; b.lineWidth = 1.2; b.strokeRect(W / 2 - tw - 6 * u, ty, tw * 2 + 12 * u, 8 * u);
    // nến
    for (const k of [-0.62, 0.62]) {
      const x = W / 2 + tw * k;
      b.fillStyle = '#b8925a'; b.fillRect(x - 8 * u, ty - 4 * u, 16 * u, 4 * u);
      b.fillStyle = '#efe2c4'; b.fillRect(x - 4 * u, ty - 32 * u, 8 * u, 28 * u);
    }
    // bình men ngọc
    for (const k of [-0.86, 0.86]) {
      const x = W / 2 + tw * k, s = u;
      b.fillStyle = '#6f9b8c'; b.beginPath();
      b.moveTo(x - 7 * s, ty); b.quadraticCurveTo(x - 13 * s, ty - 14 * s, x - 5 * s, ty - 20 * s); b.lineTo(x - 4 * s, ty - 27 * s); b.lineTo(x + 4 * s, ty - 27 * s); b.lineTo(x + 5 * s, ty - 20 * s); b.quadraticCurveTo(x + 13 * s, ty - 14 * s, x + 7 * s, ty); b.closePath(); b.fill();
    }
    // mâm ngũ quả
    for (const k of [-0.36, 0.36]) {
      const x = W / 2 + tw * k, s = u;
      b.fillStyle = '#8fae4a'; circle(b, x, ty - 15 * s, 8 * s);
      b.fillStyle = '#c8443a'; circle(b, x - 10 * s, ty - 11 * s, 5 * s);
      b.fillStyle = '#e8c33a'; circle(b, x + 10 * s, ty - 11 * s, 5 * s);
      b.fillStyle = '#e08a2e'; circle(b, x - 5 * s, ty - 7 * s, 6 * s); circle(b, x + 5 * s, ty - 7 * s, 6 * s);
      b.fillStyle = '#b8925a'; b.beginPath(); b.ellipse(x, ty - 1.5 * s, 20 * s, 3.5 * s, 0, 0, TAU); b.fill();
    }
    // bát hương
    const bw = G.bowl;
    b.strokeStyle = '#d4ab52'; b.lineWidth = 2 * u;
    b.beginPath(); b.moveTo(bw.x - bw.rx - 3 * u, bw.y + 4 * u); b.quadraticCurveTo(bw.x - bw.rx - 11 * u, bw.y + 5 * u, bw.x - bw.rx - 8 * u, bw.y + 13 * u); b.stroke();
    b.beginPath(); b.moveTo(bw.x + bw.rx + 3 * u, bw.y + 4 * u); b.quadraticCurveTo(bw.x + bw.rx + 11 * u, bw.y + 5 * u, bw.x + bw.rx + 8 * u, bw.y + 13 * u); b.stroke();
    gr = b.createLinearGradient(0, bw.y, 0, ty); gr.addColorStop(0, '#a06e38'); gr.addColorStop(1, '#4f2d14');
    b.fillStyle = gr; b.beginPath(); b.moveTo(bw.x - bw.rx, bw.y); b.quadraticCurveTo(bw.x - bw.rx + 2 * u, ty - 2 * u, bw.x - bw.rx * 0.5, ty); b.lineTo(bw.x + bw.rx * 0.5, ty); b.quadraticCurveTo(bw.x + bw.rx - 2 * u, ty - 2 * u, bw.x + bw.rx, bw.y); b.closePath(); b.fill();
    b.strokeStyle = '#d4ab52'; b.lineWidth = 1; b.stroke();
    b.fillStyle = '#2b1a10'; b.beginPath(); b.ellipse(bw.x, bw.y, bw.rx, bw.ry + 1.5 * u, 0, 0, TAU); b.fill(); b.stroke();
    b.fillStyle = '#55463a'; b.beginPath(); b.ellipse(bw.x, bw.y + 0.5 * u, bw.rx * 0.86, bw.ry * 0.7, 0, 0, TAU); b.fill();
    b.strokeStyle = 'rgba(212,171,82,.8)'; b.beginPath(); b.arc(bw.x, bw.y + 12 * u, 5 * u, 0, TAU); b.stroke();
  }

  /* ----- phần động trên bàn thờ ----- */
  function drawAltar(now) {
    const tw = G.tw, ty = G.ty;
    // ngọn nến
    for (const k of [-0.62, 0.62]) {
      const x = W / 2 + tw * k, y = ty - 32 * u, fl = reduceMotion ? 1 : 0.85 + 0.15 * Math.sin(now / 90 + k * 7) + 0.06 * Math.sin(now / 37);
      const gl = g.createRadialGradient(x, y - 6 * u, 0, x, y - 6 * u, 30 * u); gl.addColorStop(0, `rgba(255,180,80,${0.42 * fl})`); gl.addColorStop(1, 'rgba(255,180,80,0)');
      g.fillStyle = gl; g.beginPath(); g.arc(x, y - 6 * u, 30 * u, 0, TAU); g.fill();
      g.fillStyle = '#ffd36b'; g.beginPath(); g.ellipse(x, y - 6 * u, 3 * u, 7 * u * fl, 0, 0, TAU); g.fill();
      g.fillStyle = '#fff6d2'; g.beginPath(); g.ellipse(x, y - 4.5 * u, 1.4 * u, 3.4 * u * fl, 0, 0, TAU); g.fill();
    }
    // sen trong bình
    const buds = clamp(2 + Math.ceil(Math.log2(1 + altar.lotus) * 1.3), 2, 7);
    const tips = [[0, -22], [-7, -18], [7, -19], [-12, -11], [12, -12], [-4, -27], [5, -26]];
    for (const k of [-0.86, 0.86]) {
      const x = W / 2 + tw * k, y = ty - 27 * u;
      for (let i = 0; i < buds; i++) {
        const [dx, dy] = tips[i], tx = x + dx * u, tyy = y + dy * u;
        g.strokeStyle = '#5f8a54'; g.lineWidth = 1.2 * u; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + dx * 0.4 * u, y + dy * 0.5 * u, tx, tyy + 4 * u); g.stroke();
        g.fillStyle = '#e7a1ad'; g.beginPath(); g.moveTo(tx, tyy - 6 * u); g.quadraticCurveTo(tx + 4.5 * u, tyy - 1 * u, tx, tyy + 4 * u); g.quadraticCurveTo(tx - 4.5 * u, tyy - 1 * u, tx, tyy - 6 * u); g.fill();
      }
    }
    // hoa hồng dâng lên mép bàn
    const roses = Math.min(14, altar.rose);
    for (let i = 0; i < roses; i++) {
      const side = i % 2 ? 1 : -1, j = Math.floor(i / 2);
      const x = W / 2 + side * (G.bowl.rx + 12 * u + j * ((tw - G.bowl.rx - 20 * u) / 7)), y = ty + 3 * u;
      g.fillStyle = '#3f7a3a'; g.fillRect(x - 0.6 * u, y, 1.2 * u, 5 * u);
      g.fillStyle = '#d42a4a'; circle(g, x, y, 3.4 * u); g.fillStyle = '#f0607a'; circle(g, x - 0.8 * u, y - 0.8 * u, 1.5 * u);
    }
    // hàng đèn dầu trước bàn thờ
    const lamps = Math.min(12, altar.lamp);
    for (let i = 0; i < lamps; i++) {
      const x = W / 2 - tw * 0.92 + (lamps === 1 ? tw * 0.92 : (i * tw * 1.84) / (lamps - 1)), y = G.hb + 32 * u;
      const fl = reduceMotion ? 1 : 0.85 + 0.15 * Math.sin(now / 80 + i * 1.7);
      const gl = g.createRadialGradient(x, y - 5 * u, 0, x, y - 5 * u, 14 * u); gl.addColorStop(0, `rgba(255,170,70,${0.5 * fl})`); gl.addColorStop(1, 'rgba(255,170,70,0)');
      g.fillStyle = gl; g.beginPath(); g.arc(x, y - 5 * u, 14 * u, 0, TAU); g.fill();
      g.fillStyle = '#c79a45'; g.beginPath(); g.moveTo(x - 6 * u, y - 2 * u); g.lineTo(x + 6 * u, y - 2 * u); g.quadraticCurveTo(x + 4 * u, y + 3 * u, x, y + 3 * u); g.quadraticCurveTo(x - 4 * u, y + 3 * u, x - 6 * u, y - 2 * u); g.fill();
      g.fillStyle = '#ffd36b'; g.beginPath(); g.ellipse(x, y - 6 * u, 1.8 * u, 4 * u * fl, 0, 0, TAU); g.fill();
    }
  }

  /* ----- nhang & khói ----- */
  function drawIncense(now, dt) {
    const bw = G.bowl, L0 = 74 * u, red = 16 * u;
    const lit = [];
    const list = incense.length > 45 ? incense.slice(-45) : incense;
    for (const s of list) {
      if (now < s.litAt || now > s.until) continue;
      const p = (now - s.litAt) / (s.until - s.litAt);
      const L = L0 * (1 - 0.74 * p), sx = Math.sin(s.tilt), cy = Math.cos(s.tilt);
      const bx = bw.x + s.x * bw.rx * 0.82, by = bw.y + Math.sin(s.id * 12.9898) * 2 * u;
      const rx = bx + sx * red, ry = by - cy * red, tx = bx + sx * L, ty = by - cy * L;
      g.lineCap = 'round';
      g.strokeStyle = '#b8322a'; g.lineWidth = 1.6 * u; g.beginPath(); g.moveTo(bx, by); g.lineTo(rx, ry); g.stroke();
      g.strokeStyle = s.pid === me ? '#cfa868' : '#a9804f'; g.lineWidth = 2.2 * u; g.beginPath(); g.moveTo(rx, ry); g.lineTo(tx, ty); g.stroke();
      const ex = tx + sx * 2 * u, ey = ty - cy * 2 * u, age = now - s.litAt, flare = age < 900 ? 1 - age / 900 : 0;
      const fl = 0.78 + 0.22 * Math.sin(now / 170 + s.id), R = (6 + flare * 14) * u;
      const gr = g.createRadialGradient(ex, ey, 0, ex, ey, R);
      gr.addColorStop(0, `rgba(255,170,80,${Math.min(1, 0.9 * fl + flare)})`); gr.addColorStop(1, 'rgba(255,120,40,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(ex, ey, R, 0, TAU); g.fill();
      g.fillStyle = '#ffd590'; circle(g, ex, ey, 1.2 * u);
      lit.push([ex, ey, s]);
    }
    const rate = reduceMotion ? 2 : 7;
    for (const [x, y, s] of lit) {
      s.acc = (s.acc || Math.random()) + dt * rate / 1000;
      while (s.acc >= 1) { s.acc -= 1; if (parts.length < 520) parts.push({ x, y: y - u, vx: rand(-4, 4) * u, vy: -rand(20, 32) * u, r: rand(0.9, 1.6) * u, life: 0, max: rand(4200, 6600), ph: rand(0, 6.28), amp: rand(4, 11) * u }); }
    }
    g.globalCompositeOperation = 'screen';
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i]; p.life += dt;
      if (p.life > p.max) { parts.splice(i, 1); continue; }
      const k = p.life / p.max;
      p.x += p.vx * dt / 1000; p.y += p.vy * dt / 1000;
      const sway = reduceMotion ? 0 : Math.sin(p.ph + p.life / 850) * p.amp * k;
      g.fillStyle = `rgba(228,218,204,${(0.14 * (1 - k) * Math.min(1, p.life / 260)).toFixed(3)})`;
      g.beginPath(); g.arc(p.x + sway, p.y, p.r + k * 14 * u, 0, TAU); g.fill();
    }
    g.globalCompositeOperation = 'source-over';
  }

  /* ----- người ----- */
  function heartPath(x, y, s) {
    g.beginPath(); g.moveTo(x, y + s * 0.35);
    g.bezierCurveTo(x - s * 0.1, y + s * 0.25, x - s * 0.5, y + s * 0.05, x - s * 0.5, y - s * 0.15);
    g.bezierCurveTo(x - s * 0.5, y - s * 0.45, x - s * 0.1, y - s * 0.5, x, y - s * 0.25);
    g.bezierCurveTo(x + s * 0.1, y - s * 0.5, x + s * 0.5, y - s * 0.45, x + s * 0.5, y - s * 0.15);
    g.bezierCurveTo(x + s * 0.5, y + s * 0.05, x + s * 0.1, y + s * 0.25, x, y + s * 0.35);
  }
  function wrap(text, maxW, maxLines) {
    const words = text.split(' '), lines = []; let cur = '';
    for (const w of words) {
      const t = cur ? cur + ' ' + w : w;
      if (g.measureText(t).width <= maxW || !cur) cur = t; else { lines.push(cur); cur = w; }
      if (lines.length === maxLines) break;
    }
    if (lines.length < maxLines && cur) lines.push(cur);
    if (lines.length === maxLines && lines.join(' ').length < text.length) lines[maxLines - 1] = lines[maxLines - 1].replace(/\s*\S*$/, '') + '…';
    return lines.map(l => { while (g.measureText(l).width > maxW && l.length > 2) l = l.slice(0, -2) + '…'; return l; });
  }
  function drawPlayers(now, dt) {
    const k = 1 - Math.exp(-dt / 90);
    const list = [...players.values()];
    for (const p of list) {
      const ox = p.dx, oz = p.dz;
      p.dx += (p.x - p.dx) * k; p.dz += (p.z - p.dz) * k;
      const vx = p.dx - ox, vz = p.dz - oz, sp = Math.hypot(vx * 1.6, vz);
      p.walking = sp > 0.0003;
      if (p.walking) { p.idleT = now; if (vz > 0.0004) p.front = true; else if (vz < -0.0004) p.front = false; }
      else if (now - (p.idleT || 0) > 700) p.front = false;
    }
    list.sort((a, b) => a.dz - b.dz);
    const t = now / 1000;
    for (const p of list) {
      const [sx, sy, sc] = proj(p.dx, p.dz), s = sc * au * 0.78;
      let bow = 0;
      if (p.bowAt) { const q = (now - p.bowAt) / 1500; if (q >= 1) p.bowAt = 0; else bow = Math.sin(Math.PI * q); }
      if (p.id === me) {
        const pulse = reduceMotion ? 0.6 : 0.5 + 0.3 * Math.sin(now / 300);
        g.strokeStyle = `rgba(255,211,107,${pulse})`; g.lineWidth = 2; g.beginPath(); g.ellipse(sx, sy, 22 * s, 6 * s, 0, 0, TAU); g.stroke();
      }
      g.save(); g.translate(sx, sy); g.scale(s, s);
      drawAvatar(g, p.look, p.front, t + p.id, bow, p.walking);
      g.restore();
      p.sx = sx; p.sy = sy; p.s = s;
    }
    // tên + bong bóng chat vẽ sau cùng để không bị che
    const fs = Math.round(clamp(8 + 4 * au, 10, 13));
    g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const p of list) {
      const top = p.sy - 104 * p.s;
      g.font = `600 ${fs}px "Be Vietnam Pro", system-ui, sans-serif`;
      const label = p.mod ? '✿ ' + p.name : p.name;
      const w = g.measureText(label).width + 10, h = fs + 6, y = top - h / 2 - 2;
      g.fillStyle = p.id === me ? 'rgba(60,35,8,.82)' : 'rgba(12,7,5,.6)';
      rrect(g, p.sx - w / 2, y - h / 2, w, h, h / 2); g.fill();
      if (p.id === me || p.mod) { g.strokeStyle = 'rgba(255,211,107,.8)'; g.lineWidth = 1; g.stroke(); }
      g.fillStyle = p.id === me || p.mod ? '#ffd36b' : '#f6eddc';
      g.fillText(label, p.sx, y + 0.5);
      if (p.bubble) {
        const age = now - p.bubble.t;
        if (age > 6500) { p.bubble = null; continue; }
        const a = age > 5900 ? 1 - (age - 5900) / 600 : 1;
        g.font = `500 ${fs}px "Be Vietnam Pro", system-ui, sans-serif`;
        const lines = wrap(p.bubble.text, Math.max(150, 190 * Math.min(1, au)), 3);
        const bw = Math.max(...lines.map(l => g.measureText(l).width)) + 14, bh = lines.length * (fs + 3) + 9;
        const bx = clamp(p.sx - bw / 2, 4, W - bw - 4), by = y - h / 2 - bh - 8;
        g.globalAlpha = a;
        g.fillStyle = '#fbf5e8'; rrect(g, bx, by, bw, bh, 8); g.fill();
        g.beginPath(); g.moveTo(p.sx - 5, by + bh - 0.5); g.lineTo(p.sx + 5, by + bh - 0.5); g.lineTo(p.sx, by + bh + 6); g.closePath(); g.fill();
        g.fillStyle = '#2a1a12';
        lines.forEach((l, i) => g.fillText(l, bx + bw / 2, by + 5 + (fs + 3) * (i + 0.5)));
        g.globalAlpha = 1;
      }
    }
  }
  function drawFx(now, dt) {
    for (let i = hearts.length - 1; i >= 0; i--) {
      const h = hearts[i]; h.t += dt;
      if (h.t > 1800) { hearts.splice(i, 1); continue; }
      const q = h.t / 1800, a = q < 0.1 ? q / 0.1 : 1 - (q - 0.1) / 0.9;
      const x = h.x + Math.sin(h.ph + h.t / 220) * 8 * h.k, y = h.y - q * 90 * h.k, s = (10 + q * 8) * h.k;
      g.globalAlpha = Math.max(0, a); g.fillStyle = h.c; heartPath(x, y, s); g.fill();
    }
    g.globalAlpha = 1;
    for (let i = ripples.length - 1; i >= 0; i--) {
      const r = ripples[i]; r.t += dt;
      if (r.t > 2600) { ripples.splice(i, 1); continue; }
      const q = r.t / 2600;
      g.strokeStyle = `rgba(240,200,120,${(0.7 * (1 - q)).toFixed(3)})`; g.lineWidth = 2;
      g.beginPath(); g.ellipse(G.bowl.x, G.hb, 30 * u + q * W * 0.55, (12 * u + q * W * 0.55) * 0.35, 0, 0, TAU); g.stroke();
    }
    const fs = Math.round(clamp(10 + 3 * au, 11, 14));
    g.font = `600 ${fs}px "Be Vietnam Pro", system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (let i = floaters.length - 1; i >= 0; i--) {
      const f = floaters[i]; f.t += dt;
      if (f.t > 3200) { floaters.splice(i, 1); continue; }
      const q = f.t / 3200, a = q < 0.12 ? q / 0.12 : 1 - (q - 0.12) / 0.88, y = f.y - q * 40 * au;
      const w = g.measureText(f.text).width + 18, h = fs + 10;
      g.globalAlpha = Math.max(0, a);
      g.fillStyle = 'rgba(20,10,6,.7)'; rrect(g, f.x - w / 2, y - h / 2, w, h, h / 2); g.fill();
      g.fillStyle = '#ffd36b'; g.fillText(f.text, f.x, y + 0.5);
    }
    g.globalAlpha = 1;
    if (clickMark) {
      const q = (now - clickMark.t) / 600;
      if (q >= 1) clickMark = null;
      else { g.strokeStyle = `rgba(255,211,107,${1 - q})`; g.lineWidth = 2; g.beginPath(); g.ellipse(clickMark.x, clickMark.y, 6 + q * 14, (6 + q * 14) * 0.35, 0, 0, TAU); g.stroke(); }
    }
  }

  function frame(ts) {
    const dt = Math.min(64, ts - (last || ts)); last = ts;
    if (W && H && !document.hidden) {
      if (!bg) drawBg();
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.drawImage(bg, 0, 0);
      g.setTransform(DPR, 0, 0, DPR, 0, 0);
      const now = serverNow();
      drawAltar(ts);
      drawIncense(now, dt);
      drawPlayers(ts, dt);
      drawFx(ts, dt);
    }
    requestAnimationFrame(frame);
  }

  function resize() {
    const r = cv.getBoundingClientRect();
    if (!r.width || !r.height) return;
    DPR = Math.min(2, root.devicePixelRatio || 1);
    W = r.width; H = r.height;
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
    geo(); bg = null;
  }
  const hitBowl = (x, y) => Math.abs(x - G.bowl.x) < G.bowl.rx + 14 * u && y > G.bowl.y - 84 * u && y < G.ty + 10 * u;
  const hitStatue = (x, y) => Math.abs(x - W / 2) < 82 * u && y > G.statueTop && y < G.pedY;
  function point(e) { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
  function onDown(e) {
    const [x, y] = point(e);
    if (hitBowl(x, y)) { handlers.altar && handlers.altar(); return; }
    if (hitStatue(x, y)) { handlers.statue && handlers.statue(); return; }
    if (y > G.hb + 6 * u) {
      const [wx, wz] = unproj(x, y);
      clickMark = { x, y, t: performance.now() };
      handlers.floor && handlers.floor(clamp(wx, 0.03, 0.97), clamp(wz, 0.12, 0.97));
    }
  }
  function onMove(e) { const [x, y] = point(e); cv.style.cursor = hitBowl(x, y) || hitStatue(x, y) ? 'pointer' : (y > G.hb ? 'crosshair' : 'default'); }

  function mk(p) { return { id: p.id, name: p.name, look: p.look, mod: !!p.mod, x: p.x, z: p.z, dx: p.x, dz: p.z, front: false, walking: false, bubble: null, bowAt: 0 }; }

  root.Hall = {
    COLORS, HAIRS,
    init(canvas, h) {
      cv = canvas; g = cv.getContext('2d'); Object.assign(handlers, h || {});
      if (root.ResizeObserver) new ResizeObserver(resize).observe(cv); else root.addEventListener('resize', resize);
      resize();
      cv.addEventListener('pointerdown', onDown);
      cv.addEventListener('pointermove', onMove);
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { bg = null; });
      requestAnimationFrame(frame);
    },
    setMe(id) { me = id; },
    setOffset(ms) { offset = ms; },
    setPlayers(list) { players.clear(); list.forEach(p => players.set(p.id, mk(p))); },
    addPlayer(p) { players.set(p.id, mk(p)); },
    removePlayer(id) { players.delete(id); },
    updatePlayer(d) { const p = players.get(d.id); if (p) { p.name = d.name; p.look = d.look; } },
    positions(arr) { for (const [id, x, z] of arr) { const p = players.get(id); if (p) { p.x = x / 1000; p.z = z / 1000; } } },
    player(id) { return players.get(id); },
    count() { return players.size; },
    setIncense(list) { incense = list.slice(); },
    addIncense(list) { incense.push(...list); if (incense.length > 120) incense.splice(0, incense.length - 120); },
    setAltar(today) { for (const k in altar) altar[k] = today[k] || 0; },
    heart(pid) {
      const p = players.get(pid); if (!p || p.sx == null || hearts.length > 160) return;
      const cs = ['#ff5d7a', '#ff8fa3', '#e8364f', '#ffb3c1'];
      hearts.push({ x: p.sx + rand(-6, 6), y: p.sy - 100 * p.s, t: 0, k: Math.max(0.7, au), ph: rand(0, 6), c: cs[(Math.random() * cs.length) | 0] });
    },
    bow(pid) { const p = players.get(pid); if (p) { p.bowAt = performance.now(); p.front = false; p.idleT = 0; } },
    bubble(pid, text) { const p = players.get(pid); if (p) p.bubble = { text, t: performance.now() }; },
    bell() { if (!reduceMotion) ripples.push({ t: 0 }); },
    floater(text) { floaters.push({ text, x: G.bowl ? G.bowl.x : W / 2, y: G.bowl ? G.bowl.y - 70 * u : H / 3, t: 0 }); },
    preview(canvas, look) {
      const c = canvas.getContext('2d'), w = canvas.width, h = canvas.height;
      c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, w, h);
      const gr = c.createRadialGradient(w / 2, h * 0.45, 4, w / 2, h * 0.5, w * 0.7);
      gr.addColorStop(0, '#4a2616'); gr.addColorStop(1, '#140a06');
      c.fillStyle = gr; c.fillRect(0, 0, w, h);
      const s = h / 125;
      c.save(); c.translate(w * 0.34, h * 0.92); c.scale(s, s); drawAvatar(c, look, true, 0, 0, false); c.restore();
      c.save(); c.translate(w * 0.74, h * 0.92); c.scale(s * 0.8, s * 0.8); drawAvatar(c, look, false, 0, 0, false); c.restore();
    }
  };
})(this);
