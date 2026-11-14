'use strict';

import * as THREE from 'three';
import { createFx3d } from './fx3d/index.mjs?v=1';
import './fx3d/demon.mjs?v=1';
import './fx3d/lotus.mjs?v=1';
import './fx3d/aura.mjs?v=1';

// Đơn vị mét, chân ở y=0, mặt hướng +Z; yaw tính bằng radian.
// opts: role (beggar/wanderer/obito/sweeper/fortune), isSelf, view,
// reducedMotion, createCanvas (tùy chọn để kiểm thử không cần DOM).
// opts.fx3d: true/false (mặc định theo công tắc ta-fx3d), đối tượng fx giả, hoặc hàm host → fx (trang thử).
// state.reducedMotion/view có thể ghi đè lựa chọn của opts khi đổi cài đặt.
// update nhận ảnh chụp trạng thái đầy đủ, dt tính bằng giây; không tự đổi vị trí.
// sit: false/-1 = đứng, true/0..n/'cushion' = bồ đoàn, 'bench' = ghế đá.
// aura: { t, until, color }, meritRank, demon: { n, alpha }, obito, now (giờ máy chủ).
// Texture hiệu ứng dùng chung có đếm tham chiếu; không tải ảnh khi không có DOM.
// Pháp Tướng 3D (T-144): bật bằng localStorage['ta-fx3d'] = '1'. Tắt thì y như cũ (ảnh 2D dán tấm phẳng).
export const FX3D_SWITCH_KEY = 'ta-fx3d';
export function fx3dEnabled() {
  try { return globalThis.localStorage?.getItem(FX3D_SWITCH_KEY) === '1'; } catch (error) { return false; }
}

export const AVATAR_COLORS = Object.freeze([
  '#c0392b', '#e2a93b', '#e48aa5', '#3fa58d', '#8e5fb8', '#efe8da',
  '#3b78c2', '#e07b39', '#7b8ea6', '#8a6a4c', '#5f9a4a', '#2c2a30'
]);

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const finite = (v, fallback = 0) => Number.isFinite(v) ? v : fallback;
const textOf = (value, length) => Array.from(typeof value === 'string' ? value : '').slice(0, length).join('');
const normalize = look => ({
  g: look?.g === 'nu' ? 'nu' : 'nam',
  c: Number.isInteger(look?.c) && look.c >= 0 && look.c < 12 ? look.c : 0,
  h: Number.isInteger(look?.h) && look.h >= 0 && look.h < 4 ? look.h : 0,
  ...(look?.npcFashion && look?.g === 'nu' ? { npcFashion: true } : {})
});
const DEMON_ART = [null,
  { h: 64, ar: 0.544, er: 0.07, eyes: [[0.331, 0.359], [0.666, 0.358]], fire: ['#ff5a1f', '#ff2848'] },
  { h: 82, ar: 1.155, er: 0.05, eyes: [[0.449, 0.422], [0.55, 0.422]], fire: ['#ff3a1a', '#ff2848'] },
  { h: 106, ar: 0.757, er: 0.03, eyes: [[0.453, 0.357], [0.548, 0.357], [0.501, 0.329]], fire: ['#8a2cff', '#ff3355'] },
  { h: 168, ar: 1.161, er: 0.035, eyes: [[0.445, 0.38], [0.544, 0.381], [0.493, 0.317]], fire: ['#ff4a14', '#a020ff'] }
];

const effectTextures = new Map();
const defaultCanvas = () => globalThis.document?.createElement('canvas');
const noPick = object => { object.raycast = () => {}; object.userData.enabled = false; return object; };
function sharedTexture(key, create) {
  let entry = effectTextures.get(key);
  if (!entry) {
    entry = { refs: 0, ready: false, texture: null };
    entry.texture = create(entry);
    if (!entry.texture) return null;
    entry.texture.colorSpace = THREE.SRGBColorSpace;
    effectTextures.set(key, entry);
  }
  entry.refs++;
  return { entry, release() {
    if (--entry.refs === 0) { entry.texture.dispose(); effectTextures.delete(key); }
  } };
}
function imageTexture(url) {
  if (!globalThis.document) return null;
  return sharedTexture(url, entry => new THREE.TextureLoader().load(url,
    () => { entry.ready = true; }, undefined, () => { entry.ready = false; }));
}
function canvasTexture(key, draw, createCanvas = defaultCanvas) {
  return sharedTexture(key, entry => {
    const canvas = createCanvas(), c = canvas?.getContext('2d');
    if (!c) return null;
    canvas.width = canvas.height = 512;
    draw(c);
    entry.ready = true;
    return new THREE.CanvasTexture(canvas);
  });
}

// Hình mây tự vẽ, cùng áo choàng đen và cổ đỏ của Obito ở bản 2D.
function cloakTexture(createCanvas) {
  return canvasTexture('obito-clouds', c => {
    c.fillStyle = '#17151c'; c.fillRect(0, 0, 512, 512);
    for (const [x, y, size] of [[110, 150, 1], [360, 320, 1.15], [85, 440, 0.8], [400, 75, 0.65]]) {
      c.save(); c.translate(x, y); c.scale(size, size);
      c.beginPath(); c.moveTo(-55, 14); c.bezierCurveTo(-84, -6, -49, -36, -28, -20);
      c.bezierCurveTo(-23, -61, 33, -53, 32, -23); c.bezierCurveTo(72, -43, 89, -4, 58, 13);
      c.bezierCurveTo(82, 32, 29, 53, 4, 30); c.bezierCurveTo(-20, 48, -45, 39, -55, 14);
      c.closePath(); c.fillStyle = '#b92832'; c.strokeStyle = '#eee8df'; c.lineWidth = 5; c.fill(); c.stroke(); c.restore();
    }
  }, createCanvas);
}

// Giữ đường nét Canvas của 2D: khí, đan, thần hỏa, ngũ hành, cánh, kiếm và thánh luân.
// Chỉ chụp một lần mỗi bậc/màu; nhịp thở do Sprite thực hiện, không vẽ lại Canvas mỗi khung.
const drawEffectCanvas = (() => {
  const TAU = Math.PI * 2, reduceMotion = true;
  const LOTUS_FEET = 0.22;
  const RAINBOW = ['#ff6b6b', '#ffb84d', '#ffe66b', '#6be08a', '#6bb8ff', '#b98bff'];
  const ELEM = ['#f2d16b', '#7fd38a', '#6bb8ff', '#ff7a5c', '#c9a27a'];
  const circle = (c, x, y, r) => { c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); };
  const sprite = () => true; // Sen/quang bối dùng Sprite ảnh gốc riêng, không ghép vào Canvas.
  function rgba(hex, a) { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${Math.max(0, Math.min(1, a)).toFixed(3)})`; }
  function glow(c, x, y, r, col, a) {
    if (a <= 0.003 || r <= 0) return;
    const gr = c.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, rgba(col, a)); gr.addColorStop(0.55, rgba(col, a * 0.35)); gr.addColorStop(1, rgba(col, 0));
    c.fillStyle = gr; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
  }
  function flame(c, x, y, s, col, a) {                    // ngọn lửa hình giọt nước, đầu nhọn hướng lên
    if (a <= 0.01 || s <= 0) return;
    const gr = c.createRadialGradient(x, y + s * 0.3, 0, x, y, s * 1.5);
    gr.addColorStop(0, rgba('#ffffff', 0.85 * a)); gr.addColorStop(0.35, rgba(col, 0.65 * a)); gr.addColorStop(1, rgba(col, 0));
    c.fillStyle = gr; c.beginPath(); c.moveTo(x, y - s * 1.7);
    c.quadraticCurveTo(x + s * 0.95, y - s * 0.2, x + s * 0.55, y + s * 0.55);
    c.quadraticCurveTo(x, y + s * 1.05, x - s * 0.55, y + s * 0.55);
    c.quadraticCurveTo(x - s * 0.95, y - s * 0.2, x, y - s * 1.7); c.fill();
  }
  function sparkle(c, x, y, r, col, a) {                  // sao bốn cánh lấp lánh
    if (a <= 0.01) return;
    glow(c, x, y, r * 1.8, col, 0.55 * a);
    c.fillStyle = rgba('#ffffff', 0.95 * a); c.beginPath(); c.moveTo(x, y - r);
    c.quadraticCurveTo(x, y, x + r, y); c.quadraticCurveTo(x, y, x, y + r);
    c.quadraticCurveTo(x, y, x - r, y); c.quadraticCurveTo(x, y, x, y - r); c.fill();
  }
  function wisps(c, T, t, seed, col, a, back) {           // sợi khí lành bay vòng quanh người, có đuôi mờ dần
    const mo = reduceMotion ? 0 : 1, n = 3 + Math.min(T, 6), R = 20 + T * 1.5, tail = 4;
    for (let i = 0; i < n; i++) {
      const base = t * 0.9 * mo + i * TAU / n + seed, yy = -24 - (i % 3) * 24;
      for (let k = 0; k < tail; k++) {
        const an = base - k * 0.16;
        if ((Math.sin(an) < 0) !== back) continue;
        glow(c, Math.cos(an) * R, yy + Math.sin(an) * 6, (4 + T * 0.4) * (1 - k * 0.15), col, (back ? 0.32 : 0.5) * a * (1 - k / tail));
      }
    }
  }
  function aura(c, T, t, a, seed, front, color) {
    const col = color, mo = reduceMotion ? 0 : 1;
    const pulse = 0.82 + 0.18 * Math.sin(t * 2.2 + seed) * mo;
    c.save(); c.globalCompositeOperation = 'lighter'; c.lineCap = 'round';
    if (!front) {
      if (T >= 8) {                                                   // Đại Thừa: cột sáng từ trời
        const gr = c.createLinearGradient(0, -300, 0, 0);
        gr.addColorStop(0, rgba('#fff2c0', 0)); gr.addColorStop(0.6, rgba('#ffe7a0', 0.16 * a)); gr.addColorStop(1, rgba('#ffd36b', 0.28 * a));
        c.fillStyle = gr; c.beginPath(); c.moveTo(-14, -300); c.lineTo(14, -300); c.lineTo(34, 0); c.lineTo(-34, 0); c.closePath(); c.fill();
      }
      if (T >= 6) {                                                   // Luyện Hư: quang bối lá đề đầy sao sau lưng (Đại Thừa trở lên: kim quang)
        const w = (92 + (T - 6) * 4) * (1 + 0.012 * Math.sin(t * 1.3 + seed) * mo);
        if (!sprite(c, T >= 8 ? 'mandorla-gold' : 'mandorla-violet', 0, 7, w, 0.5, 1, (T >= 8 ? 0.55 : 0.78) * (0.8 + 0.2 * pulse) * a)) {
          const H = 72 + (T - 6) * 8, Wd = 34 + (T - 6) * 4;
          const gr = c.createLinearGradient(0, -H * 1.55, 0, 0);
          gr.addColorStop(0, rgba(T >= 8 ? '#ffd36b' : '#6f5bd6', 0.32 * a)); gr.addColorStop(1, rgba(T >= 8 ? '#ff9f43' : '#2c3a8c', 0.12 * a));
          c.fillStyle = gr; c.strokeStyle = rgba(T >= 8 ? '#ffe39a' : col, 0.75 * a); c.lineWidth = 1.6;
          c.beginPath(); c.moveTo(0, -H * 1.55); c.bezierCurveTo(Wd * 1.2, -H * 1.1, Wd, -H * 0.1, 0, 2); c.bezierCurveTo(-Wd, -H * 0.1, -Wd * 1.2, -H * 1.1, 0, -H * 1.55); c.fill(); c.stroke();
        }
        for (let i = 0; i < 9; i++) {                                 // sao lấp lánh trong quang bối
          const sx = Math.sin(i * 12.9 + seed) * w * 0.3, sy = -16 - ((i * 0.37 + seed) % 1) * w * 1.2;
          sparkle(c, sx, sy, 2.4, T >= 8 ? '#ffe39a' : '#c9b8ff', (0.5 + 0.5 * Math.sin(t * 3 * mo + i * 2.1)) * 0.8 * a);
        }
      }
      if (T >= 4) {                                                   // Nguyên Anh: tia sáng xoay chậm, mờ dần ra ngoài
        const n = 12 + (T - 4) * 2, rot = t * 0.18 * mo + seed, cy = -62, r1 = 58 + T * 7, rc = T >= 8 ? '#ffe7a0' : col, ra = T >= 8 ? 0.2 : 0.32;
        for (let i = 0; i < n; i++) {
          const an = rot + i * TAU / n, L = r1 * (i % 2 ? 0.7 : 1), w = i % 2 ? 0.045 : 0.075;
          const ex = Math.cos(an) * L, ey = cy + Math.sin(an) * L, gr = c.createLinearGradient(0, cy, ex, ey);
          gr.addColorStop(0, rgba(rc, ra * a)); gr.addColorStop(0.45, rgba(rc, ra * 0.38 * a)); gr.addColorStop(1, rgba(rc, 0));
          c.fillStyle = gr; c.beginPath();
          c.moveTo(Math.cos(an - w) * 14, cy + Math.sin(an - w) * 14); c.lineTo(ex, ey); c.lineTo(Math.cos(an + w) * 14, cy + Math.sin(an + w) * 14);
          c.closePath(); c.fill();
        }
      }
      const gT = Math.min(T, 6);                                      // cảnh giới cao đã có quang bối, quầng sáng không to thêm để khỏi chói
      glow(c, 0, -52, 40 + gT * 7, col, (0.2 + gT * 0.03) * a * pulse);  // Luyện Khí trở lên: khí lành quanh thân
      wisps(c, T, t, seed, col, a, true);                             // nửa sau của sợi khí
      if (T >= 3) {                                                   // Kim Đan: vầng sáng viền cánh sen sau đầu, xoay rất chậm
        c.save(); c.translate(0, -88); c.rotate(t * 0.06 * mo);
        if (!sprite(c, 'halo-gold', 0, 0, 66 + (T - 3) * 2.5, 0.5, 0.5, (0.78 + 0.22 * pulse) * a)) {
          glow(c, 0, 0, 22 + T, '#fff0b0', 0.42 * a);
          c.strokeStyle = rgba('#ffd36b', 0.85 * a); c.lineWidth = 1.6; c.beginPath(); c.arc(0, 0, 16, 0, TAU); c.stroke();
        }
        c.restore();
      }
      if (T >= 9) {                                                   // Độ Kiếp: vòng ngũ sắc quanh đầu
        RAINBOW.forEach((rc, i) => {
          c.strokeStyle = rgba(rc, 0.6 * a); c.lineWidth = 1.4;
          c.beginPath(); c.arc(0, -88, 23 + i * 2.6, t * (0.6 + i * 0.1) * mo + i, t * (0.6 + i * 0.1) * mo + i + Math.PI * 1.4); c.stroke();
        });
      }
      if (T >= 2) {                                                   // Trúc Cơ: đứng trên đài sen (Đại Thừa: sen hồng; Độ Kiếp: sen pha lê ngũ sắc)
        const w = 72 + (T - 2) * 3.5, name = T >= 9 ? 'lotus-rainbow' : T >= 8 ? 'lotus-pink' : 'lotus-gold';
        c.save(); c.scale(1, 0.32); glow(c, 0, 10, w * 0.62, T >= 8 ? '#ffc2d6' : '#ffd77a', 0.5 * a * pulse); c.restore();
        if (sprite(c, name, 0, 1.5, w, 0.5, LOTUS_FEET, a, 'source-over')) {
          sprite(c, name, 0, 1.5, w, 0.5, LOTUS_FEET, 0.3 * a * (pulse - 0.64) / 0.36);   // đài sen sáng lên rồi dịu xuống
        } else {
          c.save(); c.scale(1, 0.3); glow(c, 0, 0, 30 + T * 3.5, '#ffd77a', 0.55 * a * pulse);
          c.strokeStyle = rgba('#ffe29a', 0.55 * a); c.lineWidth = 2; c.beginPath(); c.arc(0, 0, 24 + T * 1.5, 0, TAU); c.stroke(); c.restore();
        }
      }
    } else {
      wisps(c, T, t, seed, col, a, false);                            // nửa trước của sợi khí
      if (T >= 2) {                                                   // đốm sáng bay lên từ đài sen
        const n = 4 + T, mc = T >= 8 ? '#ffd6e4' : '#ffe29a';
        for (let i = 0; i < n; i++) {
          const ph = (t * 0.35 * mo + i * 0.37 + seed) % 1;
          glow(c, Math.sin(i * 9.7 + seed) * (22 + T * 1.6), -2 - ph * (38 + T * 4), 2.6, mc, Math.sin(ph * Math.PI) * 0.75 * a);
        }
      }
      if (T >= 3) { glow(c, 0, -47, 10, '#ffd36b', 0.7 * a * pulse); sparkle(c, 0, -47, 3.4 + 1.4 * pulse, '#ffd36b', 0.9 * a); }   // kim đan
      if (T >= 4) {                                                   // nguyên anh bay vòng, kéo đuôi sáng
        for (let k = 5; k >= 0; k--) {
          const an = t * 1.3 * mo + seed - k * 0.13, ox = Math.cos(an) * 30, oy = -66 + Math.sin(an) * 9;
          glow(c, ox, oy, 11 - k * 1.4, '#f2a6ff', (k ? 0.28 : 0.7) * a * (1 - k / 7));
          if (!k) { c.fillStyle = rgba('#fff0ff', 0.95 * a); circle(c, ox, oy, 2.4); }
        }
      }
      if (T >= 5) {                                                   // Hóa Thần: thần hỏa xanh bốc lên quanh thân (Đại Thừa trở lên: lửa trắng ngà, nhẹ hơn)
        const n = 6 + Math.min(T, 7) * 2, fc = T >= 8 ? '#fff1c9' : '#7fd0ff', fa = T >= 8 ? 0.45 : 0.75;
        for (let i = 0; i < n; i++) {
          const ph = ((t * (0.32 + T * 0.02) * mo) + i * 0.618 + seed) % 1;
          const px = Math.sin(i * 7.31 + seed) * (17 + T * 2.2) + Math.sin(t * 3 + i) * 2 * mo, py = -4 - ph * (64 + T * 8);
          flame(c, px, py, (3.2 + T * 0.3) * (1 - ph * 0.55), i % 4 ? fc : '#e8f7ff', Math.sin(ph * Math.PI) * fa * a);
        }
      }
      if (T >= 7) {                                                   // Hợp Thể: ngũ hành châu xoay quanh, có đuôi
        for (let i = 0; i < 5; i++) {
          for (let k = 3; k >= 0; k--) {
            const an = t * 0.8 * mo + i * TAU / 5 + seed - k * 0.12, ox = Math.cos(an) * 36, oy = -50 + Math.sin(an) * 12;
            glow(c, ox, oy, 8 - k * 1.3, ELEM[i], (k ? 0.25 : 0.65) * a * (1 - k / 5));
            if (!k) { c.fillStyle = rgba(ELEM[i], 0.95 * a); circle(c, ox, oy, 2.6); }
          }
        }
      }
      if (T >= 8) {                                                   // Đại Thừa: cánh sen hồng rơi nhẹ
        for (let i = 0; i < 7; i++) {
          const ph = (t * 0.12 * mo + i / 7 + seed * 0.1) % 1, x = Math.sin(i * 4.1 + seed) * 42 + Math.sin(t * 1.1 + i) * 6 * mo, y = -150 + ph * 150;
          c.save(); c.translate(x, y); c.rotate(Math.sin(t * 1.7 + i) * 0.8 * mo + i);
          c.fillStyle = rgba(i % 2 ? '#ffb3cc' : '#ffe0ea', Math.sin(ph * Math.PI) * 0.7 * a);
          c.beginPath(); c.moveTo(0, -4.5); c.quadraticCurveTo(3.4, 0, 0, 4.5); c.quadraticCurveTo(-3.4, 0, 0, -4.5); c.fill(); c.restore();
        }
      }
      if (T >= 9 && mo) {                                             // Độ Kiếp: lôi kiếp
        const cyc = (t + seed) % 2.6;
        if (cyc < 0.32) {
          const fl = 1 - cyc / 0.32, sx = Math.sin(Math.floor((t + seed) / 2.6) * 3.7) * 18;
          glow(c, 0, -90, 70, '#cfe3ff', 0.35 * fl * a);
          c.strokeStyle = rgba('#e8f2ff', 0.95 * fl * a); c.lineWidth = 2.2; c.beginPath();
          let lx = sx, ly = -240; c.moveTo(lx, ly);
          for (let j = 1; j <= 7; j++) { lx = sx * (1 - j / 7) + Math.sin(j * 5.1 + seed + Math.floor(t / 2.6)) * 9; ly = -240 + j * 20; c.lineTo(lx, ly); }
          c.stroke();
          c.strokeStyle = rgba('#8fb8ff', 0.6 * fl * a); c.lineWidth = 5; c.stroke();
        }
      }
    }
    c.restore();
  }

  /* ----- pháp tướng công đức (6 mốc, vẽ sau lưng) ----- */
  // tint: màu hào quang cúng dường đang sáng (nếu có) để hai lớp bổ trợ nhau: ngọc và viền pháp tướng nhuộm theo hào quang.
  function wing(c, side, t, cols, len, n, flap) {
    for (let i = 0; i < n; i++) {
      const k = i / (n - 1), an = -0.25 - k * 1.25 + Math.sin(t * 1.6) * flap * (0.4 + k);
      const L = len * (0.62 + 0.38 * Math.sin(Math.PI * (0.25 + k * 0.6)));
      const bx = side * 9, by = -70, tx = bx + side * Math.cos(an) * L, ty = by + Math.sin(an) * L;
      const gr = c.createLinearGradient(bx, by, tx, ty);
      gr.addColorStop(0, rgba(cols[0], 0.85)); gr.addColorStop(0.55, rgba(cols[1], 0.6)); gr.addColorStop(1, rgba(cols[2] || cols[1], 0));
      c.fillStyle = gr;
      const dx = (tx - bx) / L, dy = (ty - by) / L, nx = -dy * side, ny = dx * side, w = 8 - k * 2.5;
      const mx = (bx + tx) / 2, my = (by + ty) / 2;
      c.beginPath(); c.moveTo(bx, by);
      c.quadraticCurveTo(mx + nx * w, my + ny * w, tx, ty);
      c.quadraticCurveTo(mx - nx * w * 0.5, my - ny * w * 0.5, bx, by + 2);
      c.fill();
    }
  }
  function crown(c, t, tint, a) {                         // vương miện sen pha lê sau đầu
    for (let i = 0; i < 9; i++) {
      const an = -Math.PI * (0.12 + 0.76 * i / 8), L = 30 + (i % 2 ? 0 : 9), w = 6.5;
      const cx = Math.cos(an), cy = Math.sin(an), x0 = cx * 12, y0 = -86 + cy * 12, x1 = cx * (12 + L), y1 = -86 + cy * (12 + L);
      const gr = c.createLinearGradient(x0, y0, x1, y1);
      gr.addColorStop(0, rgba('#e9fffa', 0.55 * a)); gr.addColorStop(1, rgba('#7fe0cf', 0.18 * a));
      c.fillStyle = gr; c.strokeStyle = rgba(tint || '#f3e1a0', 0.75 * a); c.lineWidth = 0.9;
      c.beginPath(); c.moveTo(x0, y0);
      c.quadraticCurveTo((x0 + x1) / 2 - cy * w, (y0 + y1) / 2 + cx * w, x1, y1);
      c.quadraticCurveTo((x0 + x1) / 2 + cy * w, (y0 + y1) / 2 - cx * w, x0, y0); c.fill(); c.stroke();
    }
  }
  function headRing(c, r, t, tint, spin) {
    c.strokeStyle = rgba('#ffd36b', 0.9); c.lineWidth = 2.2; c.beginPath(); c.arc(0, -88, r, 0, TAU); c.stroke();
    const n = 8, rot = spin ? t * 0.6 : 0;
    for (let i = 0; i < n; i++) {
      const an = rot + i * TAU / n, x = Math.cos(an) * r, y = -88 + Math.sin(an) * r;
      if (tint) glow(c, x, y, 5, tint, 0.8);
      c.fillStyle = tint || '#7fe0c4'; circle(c, x, y, 1.8);
    }
    if (spin) {                                           // vòng phù văn xoay
      c.save(); c.translate(0, -88); c.rotate(-t * 0.45);
      c.strokeStyle = rgba(tint || '#ffe7a0', 0.7); c.lineWidth = 1.1; c.setLineDash([3, 4]);
      c.beginPath(); c.arc(0, 0, r + 6, 0, TAU); c.stroke(); c.setLineDash([]);
      for (let i = 0; i < 12; i++) { c.rotate(TAU / 12); c.beginPath(); c.moveTo(r + 3, 0); c.lineTo(r + 9, 0); c.stroke(); }
      c.restore();
    }
  }
  function meritHalo(c, R, t, tint) {
    const mo = reduceMotion ? 0 : 1, tt = t * mo;
    c.save(); c.globalCompositeOperation = 'lighter'; c.lineCap = 'round'; c.lineJoin = 'round';
    if (tint) glow(c, 0, -62, 70 + R * 10, tint, 0.16);   // cộng hưởng với hào quang cúng dường
    if (R >= 6) {                                         // Cửu Tiêu Thánh Luân: mặt trời gai vàng + cánh ngũ sắc
      c.save(); c.translate(0, -66); c.rotate(tt * 0.12);
      for (let i = 0; i < 28; i++) {
        const an = i * TAU / 28, L = i % 2 ? 84 : 118, w = i % 2 ? 0.05 : 0.07;
        const gr = c.createLinearGradient(0, 0, Math.cos(an) * L, Math.sin(an) * L);
        gr.addColorStop(0, rgba('#fff3c4', 0.7)); gr.addColorStop(1, rgba('#ffb52e', 0));
        c.fillStyle = gr; c.beginPath();
        c.moveTo(Math.cos(an - w) * 40, Math.sin(an - w) * 40); c.lineTo(Math.cos(an) * L, Math.sin(an) * L); c.lineTo(Math.cos(an + w) * 40, Math.sin(an + w) * 40); c.fill();
      }
      c.restore();
      wing(c, -1, tt, ['#c9a2ff', '#6ad6ff', '#ff6b9a'], 92, 7, 0.08); wing(c, 1, tt, ['#c9a2ff', '#6ad6ff', '#ff6b9a'], 92, 7, 0.08);
    }
    if (R >= 5) {                                         // Kim Long Pháp Tướng: hai vòng hoa văn xoay ngược, lửa son
      c.save(); c.translate(0, -64);
      c.save(); c.rotate(tt * 0.3);
      c.strokeStyle = rgba('#ffcf5a', 0.95); c.lineWidth = 3; c.beginPath(); c.arc(0, 0, 70, 0, TAU); c.stroke();
      for (let i = 0; i < 16; i++) {
        c.rotate(TAU / 16);
        c.strokeStyle = rgba('#ffe39a', 0.85); c.lineWidth = 1.4; c.beginPath(); c.arc(70, 0, 5, Math.PI * 0.5, Math.PI * 2.2); c.stroke();
        if (i % 2 === 0) {
          const f = 0.8 + 0.2 * Math.sin(tt * 6 + i);
          c.fillStyle = rgba('#ff5a36', 0.7 * f); c.beginPath(); c.moveTo(74, -4); c.quadraticCurveTo(90 * f, 0, 74, 4); c.fill();
        }
      }
      c.restore();
      c.save(); c.rotate(-tt * 0.45);
      c.strokeStyle = rgba(tint || '#ff9a5c', 0.85); c.lineWidth = 1.6; c.setLineDash([10, 5, 2, 5]);
      c.beginPath(); c.arc(0, 0, 54, 0, TAU); c.stroke(); c.setLineDash([]);
      c.restore(); c.restore();
      if (R < 6) { wing(c, -1, tt, ['#fff1b0', '#ff7a3c', '#c0181a'], 80, 6, 0.07); wing(c, 1, tt, ['#fff1b0', '#ff7a3c', '#c0181a'], 80, 6, 0.07); }
    }
    if (R >= 4) {                                         // Vạn Kiếm Quy Tông: bánh xe kiếm bạch kim xoay
      c.save(); c.translate(0, -60); c.rotate(-tt * 0.22);
      const n = 14;
      for (let i = 0; i < n; i++) {
        c.rotate(TAU / n);
        const gr = c.createLinearGradient(26, 0, 80, 0);
        gr.addColorStop(0, rgba('#ffffff', R >= 5 ? 0.35 : 0.85)); gr.addColorStop(1, rgba('#cfe0ff', 0.05));
        c.fillStyle = gr; c.beginPath(); c.moveTo(30, -2.6); c.lineTo(80, 0); c.lineTo(30, 2.6); c.closePath(); c.fill();
        c.fillStyle = rgba(tint || '#ffd36b', 0.9); c.fillRect(27, -4, 2.2, 8);
      }
      c.restore();
    }
    if (R === 3 || R === 4) { wing(c, -1, tt, ['#fff6c8', '#ffc23a', '#ff8a1a'], 70, 6, 0.08); wing(c, 1, tt, ['#fff6c8', '#ffc23a', '#ff8a1a'], 70, 6, 0.08); }
    if (R >= 2) crown(c, tt, tint, R >= 4 ? 0.75 : 1);
    glow(c, 0, -88, 26 + R * 2, '#ffe9a8', 0.28);
    headRing(c, R >= 2 ? 19 : 21, tt, tint, R >= 3);
    c.restore();
  }


  function demonGlow(c, n, front) {
    const art = DEMON_ART[n], h = art.h, w = h * art.ar;
    c.setTransform(1.6, 0, 0, 1.6, 256, 256);
    if (front) {
      for (const [ex, ey] of art.eyes) {
        const x = (ex - 0.5) * w, y = (ey - 0.5) * h;
        glow(c, x, y, h * art.er + 2, '#ff9a1a', 0.65);
        glow(c, x, y, h * art.er * 0.38 + 0.8, '#fff1c0', 0.9);
      }
    } else {
      glow(c, 0, 0, h * 0.62, art.fire[0], 0.3);
      glow(c, 0, h * 0.12, h * 0.42, art.fire[1], 0.22);
      for (let i = 0; i < 6 + n * 3; i++) {
        const ph = (i * 0.618) % 1, x = Math.sin(i * 7.31) * w * 0.42, y = h * 0.28 - ph * h * 1.05;
        glow(c, x, y, h * 0.075 * (1 - ph * 0.6), art.fire[i % 2], 0.42 * Math.sin(Math.PI * ph));
        c.fillStyle = '#ffb347'; circle(c, x, y, 0.9);
      }
    }
  }
  return (c, tier, rank, color, front, demon = 0) => {
    if (demon) { demonGlow(c, demon, front); return; }
    c.setTransform(1.6, 0, 0, 1.6, 256, 400);
    if (tier) aura(c, tier, 0, 1, 0, front, color);
    if (rank) meritHalo(c, rank, 0, color);
  };
})();

function drawLightning(c) {
  c.setTransform(1.6, 0, 0, 1.6, 256, 400);
  c.strokeStyle = '#e8f2ff'; c.lineWidth = 2.2; c.beginPath(); c.moveTo(0, -240);
  for (let i = 1; i <= 7; i++) c.lineTo(Math.sin(i * 5.1) * 9, -240 + i * 20);
  c.stroke();
}

function wrap(ctx, text, width, limit) {
  const lines = [];
  let line = '';
  for (const character of text.replace(/\s+/g, ' ').trim()) {
    if (ctx.measureText(line + character).width > width && line) {
      lines.push(line.trim());
      line = '';
      if (lines.length === limit) break;
    }
    line += character;
  }
  if (line && lines.length < limit) lines.push(line.trim());
  if (lines.length === limit) lines[limit - 1] = lines[limit - 1].replace(/.{0,3}$/u, '…');
  return lines;
}

function makeLabel(createCanvas, bubble = false) {
  const canvas = createCanvas();
  const ctx = canvas?.getContext('2d');
  const material = new THREE.SpriteMaterial({ transparent: true, depthWrite: false, toneMapped: false });
  const sprite = noPick(new THREE.Sprite(material));
  sprite.name = bubble ? 'bubble' : 'nameplate';
  sprite.visible = false;
  let texture = null, previous = null;
  const labelPosition = new THREE.Vector3(), cameraPosition = new THREE.Vector3(), parentScale = new THREE.Vector3(), cameraSpace = new THREE.Vector3();
  let baseWidth = 1, baseHeight = 1, contentRatio = 1;
  // Tính theo pixel CSS, độc lập DPR, áp dụng cả nhân vật do từng cảnh dựng.
  sprite.onBeforeRender = (renderer, scene, camera) => {
    sprite.getWorldPosition(labelPosition);
    camera.getWorldPosition(cameraPosition);
    const distance = labelPosition.distanceTo(cameraPosition);
    material.opacity = clamp((distance - 1.2) / 1.2, 0, 1);
    const depth = -cameraSpace.copy(labelPosition).applyMatrix4(camera.matrixWorldInverse).z;
    const pixels = renderer.domElement.getBoundingClientRect().height;
    const maxHeight = (bubble ? 96 : 28) * 2 * Math.max(0, depth) / (contentRatio * camera.projectionMatrix.elements[5] * Math.max(1, pixels));
    sprite.parent?.getWorldScale(parentScale);
    const factor = Math.min(1, maxHeight / (baseHeight * Math.abs(parentScale.y || 1)));
    sprite.scale.set(baseWidth * factor, baseHeight * factor, 1);
    sprite.updateWorldMatrix(false, false);
  };
  function set(text, tag = '') {
    text = text.trim(); tag = tag.trim();
    const key = text + '\n' + tag;
    if (key === previous) return;
    previous = key;
    sprite.visible = !!text && !!ctx;
    if (!ctx || !text) return;
    canvas.width = 512;
    canvas.height = bubble ? 256 : 128;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = `${bubble ? 26 : 30}px system-ui, sans-serif`;
    const lines = bubble ? wrap(ctx, text, 456, 5) : [text];
    const height = bubble ? lines.length * 34 + 28 : tag ? 100 : 64;
    contentRatio = (height + 12) / canvas.height;
    ctx.fillStyle = bubble ? '#fff1d7' : 'rgba(45,30,24,0.90)';
    ctx.strokeStyle = bubble ? '#bc8b49' : '#ae8650';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(6, 6, 500, height, 18);
    ctx.fill(); ctx.stroke();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = bubble ? '#4a2e20' : '#fff1d7';
    lines.forEach((line, i) => ctx.fillText(line, 256, bubble ? 36 + i * 34 : 39, 456));
    if (tag) {
      ctx.font = '23px system-ui, sans-serif';
      ctx.fillStyle = '#e6bc72';
      ctx.fillText(tag, 256, 79, 456);
    }
    if (!texture) {
      texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      material.map = texture;
      material.needsUpdate = true;
    }
    texture.needsUpdate = true;
    // Khung chữ dùng kích thước cố định để không nhảy khi đổi nội dung.
    baseWidth = bubble ? 2 : 1.55; baseHeight = baseWidth * canvas.height / canvas.width;
    sprite.scale.set(baseWidth, baseHeight, 1);
    sprite.center.set(0.5, 1 - (height / 2 + 6) / canvas.height);
  }
  return { sprite, set, dispose() { texture?.dispose(); material.dispose(); } };
}

export function createAvatar(initialLook = {}, opts = {}) {
  const group = new THREE.Group();
  group.name = 'avatar';
  const rig = new THREE.Group();
  rig.name = 'body';
  group.add(rig);
  const geometries = new Set(), materials = new Set();
  const createCanvas = opts.createCanvas || defaultCanvas;
  const effectParts = new Map();
  const geometry = value => { geometries.add(value); return value; };
  const material = (color, extra = {}) => {
    const value = new THREE.MeshStandardMaterial({ color, roughness: 0.92, ...extra });
    materials.add(value);
    return value;
  };
  const cloth = material(AVATAR_COLORS[0]);
  const trim = material('#825b35');
  const skin = material('#f0c9a4');
  const hair = material('#1f1612');
  const ivory = material('#efe8da');
  const wood = material('#68432e');
  const straw = material('#c5a36a');
  const ink = material('#2c2a30');
  const gold = material('#c99b50', { metalness: 0.25 });
  const clay = material('#b96d38');
  const box = geometry(new THREE.BoxGeometry(1, 1, 1));
  const cylinder = geometry(new THREE.CylinderGeometry(1, 1, 1, 6, 1, true));
  const ball = geometry(new THREE.SphereGeometry(1, 8, 4));
  function mesh(parent, shape, mat, size, position, name) {
    const object = new THREE.Mesh(shape, mat);
    object.scale.set(...size);
    object.position.set(...position);
    object.name = name || '';
    object.castShadow = true;
    parent.add(object);
    return object;
  }
  const part = (parent, name, position) => {
    const node = new THREE.Group(); node.name = name; node.position.set(...position); parent.add(node); return node;
  };
  const hips = part(rig, 'hips', [0, 0.6425, 0]);
  const torso = part(hips, 'torso', [0, 0, 0]);
  const closedCylinder = geometry(new THREE.CylinderGeometry(1, 1, 1, 6));
  const coat = mesh(torso, geometry(new THREE.CylinderGeometry(1.12, 0.84, 1, 8)), cloth, [0.18, 0.43, 0.125], [0, 0.235, 0], 'coat');
  const collar = mesh(torso, cylinder, trim, [0.075, 0.06, 0.067], [0, 0.465, 0]);
  const neckline = mesh(torso, geometry(new THREE.SphereGeometry(1, 6, 2)), skin, [0.17, 0.06, 0.10], [0, 0.445, 0], 'neckline');
  const seam = mesh(torso, box, ivory, [0.008, 0.27, 0.008], [0.10, 0.24, 0.124]); seam.rotation.z = 0.16;
  mesh(torso, cylinder, skin, [0.055, 0.09, 0.055], [0, 0.51, 0]);
  const head = part(torso, 'head', [0, 0.70, 0]);
  mesh(head, ball, skin, [0.165, 0.195, 0.15], [0, 0, 0]);
  for (const x of [-0.055, 0.055]) mesh(head, box, ink, [0.023, 0.025, 0.018], [x, 0.008, 0.143]);
  mesh(head, box, clay, [0.043, 0.01, 0.012], [0, -0.067, 0.139]);
  const hairRoot = part(head, 'hair', [0, 0, 0]);
  const hairCap = mesh(hairRoot, geometry(new THREE.SphereGeometry(1, 8, 2, 0, Math.PI * 2, 0, Math.PI / 2)), hair,
    [0.176, 0.16, 0.16], [0, 0.065, -0.012]);
  const longHair = mesh(hairRoot, closedCylinder, hair, [0.145, 0.34, 0.055], [0, -0.10, -0.126], 'long-hair');
  const sideLocks = [-1, 1].map(sign => mesh(hairRoot, cylinder, hair, [0.025, 0.21, 0.025], [sign * 0.145, -0.055, 0.03]));
  const bun = mesh(hairRoot, geometry(new THREE.IcosahedronGeometry(1, 0)), hair, [0.09, 0.09, 0.08], [0, 0.20, -0.055], 'bun');
  const turban = mesh(hairRoot, closedCylinder, trim, [0.197, 0.10, 0.18], [0, 0.16, 0], 'turban');
  const skirt = part(hips, 'skirt', [0, 0, 0]);
  // Hai tà rời để còn thấy quần trắng và khoảng xẻ hai bên áo dài.
  const panelGeometry = geometry(new THREE.CylinderGeometry(0.16, 0.255, 0.48, 4, 1, false));
  for (const z of [-0.075, 0.075]) mesh(skirt, panelGeometry, cloth, [1, 1, 0.39], [0, -0.22, z]);
  const legs = [], knees = [], arms = [], elbows = [];
  const limb = geometry(new THREE.CylinderGeometry(0.85, 1, 1, 4));
  const shoulderShape = geometry(new THREE.SphereGeometry(1, 6, 3));
  const shoulders = [];
  for (const sign of [-1, 1]) {
    const leg = part(hips, sign < 0 ? 'left-leg' : 'right-leg', [sign * 0.095, -0.01, 0]);
    mesh(leg, limb, ivory, [0.071, 0.27, 0.071], [0, -0.135, 0], 'upper-leg');
    const knee = part(leg, 'knee', [0, -0.27, 0]);
    mesh(knee, limb, ivory, [0.064, 0.28, 0.064], [0, -0.14, 0], 'lower-leg');
    mesh(knee, box, wood, [0.13, 0.065, 0.22], [0, -0.33, 0.045]);
    legs.push(leg); knees.push(knee);
    const arm = part(torso, sign < 0 ? 'left-arm' : 'right-arm', [sign * 0.225, 0.38, 0]);
    shoulders.push(mesh(arm, shoulderShape, cloth, [0.078, 0.078, 0.073], [0, 0, 0], 'shoulder'));
    mesh(arm, cylinder, cloth, [0.073, 0.22, 0.073], [0, -0.11, 0]);
    const elbow = part(arm, 'elbow', [0, -0.22, 0]);
    mesh(elbow, cylinder, cloth, [0.06, 0.18, 0.06], [0, -0.09, 0]);
    mesh(elbow, box, skin, [0.06, 0.11, 0.055], [0, -0.215, 0]);
    arms.push(arm); elbows.push(elbow);
  }
  const accessory = part(torso, 'accessory', [0, 0, 0]);
  const role = opts.role;
  if (role === 'beggar') {
    hair.color.set('#b8ad98');
    mesh(head, box, ivory, [0.06, 0.15, 0.035], [0, -0.16, 0.12]);
    const bowl = geometry(new THREE.CylinderGeometry(0.13, 0.065, 0.08, 8, 1, true));
    mesh(accessory, bowl, wood, [1, 1, 1], [0.28, 0.03, 0.23]);
    mesh(accessory, geometry(new THREE.CircleGeometry(0.115, 8)), ink, [1, 1, 1], [0.28, 0.055, 0.23]).rotation.x = -Math.PI / 2;
    mesh(torso, box, straw, [0.085, 0.10, 0.012], [-0.095, 0.19, 0.126]).rotation.z = 0.18;
  } else if (role === 'wanderer') {
    mesh(head, geometry(new THREE.ConeGeometry(0.33, 0.18, 10)), straw, [1, 1, 1], [0, 0.21, 0]);
    mesh(torso, box, wood, [0.15, 0.39, 0.13], [0.10, 0.20, -0.19]).rotation.z = -0.25;
    mesh(torso, box, straw, [0.035, 0.43, 0.035], [-0.08, 0.21, 0.14]).rotation.z = -0.38;
  }
  const obito = part(torso, 'obito-cloak', [0, 0, 0]);
  mesh(obito, geometry(new THREE.CylinderGeometry(0.21, 0.29, 1.02, 8)), cloth, [1, 1, 1], [0, -0.02, 0]);
  mesh(obito, cylinder, ink, [0.13, 0.19, 0.105], [0, 0.43, 0]);
  mesh(obito, cylinder, material('#98242b'), [0.12, 0.16, 0.097], [0, 0.44, 0]);
  const maskRoot = part(head, 'obito-mask', [0, 0, 0]);
  {
    const mask = mesh(maskRoot, geometry(new THREE.CircleGeometry(0.16, 10)), material('#e87924'), [1, 1.1, 1], [0, 0, 0.163]);
    // Đường xoắn tự dựng, không dùng ảnh ngoài.
    const points = [];
    for (let i = 0; i <= 28; i++) {
      const angle = i / 28 * Math.PI * 4, radius = 0.012 + i / 28 * 0.13;
      points.push(new THREE.Vector3(0.04 + Math.cos(angle) * radius * 0.75, Math.sin(angle) * radius, 0.002));
    }
    const lineMat = new THREE.LineBasicMaterial({ color: '#633b26' }); materials.add(lineMat);
    mask.add(new THREE.Line(geometry(new THREE.BufferGeometry().setFromPoints(points)), lineMat));
    mesh(maskRoot, ball, ink, [0.018, 0.016, 0.008], [0.04, 0, 0.18]);
  }
  if (role === 'sweeper') {
    const broom = part(accessory, 'broom', [0.35, -0.6325, 0.15]);
    broom.rotation.z = 0.16;
    mesh(broom, cylinder, wood, [0.018, 1.12, 0.018], [0, 0.63, 0]);
    mesh(broom, geometry(new THREE.CylinderGeometry(0.035, 0.15, 0.22, 6)), straw, [1, 1, 0.55], [0, 0.10, 0]);
    mesh(broom, cylinder, wood, [0.047, 0.03, 0.036], [0, 0.20, 0]);
  } else if (role === 'fortune' || role === 'reader') {
    hair.color.set('#b8ad98');
    mesh(accessory, box, wood, [0.25, 0.035, 0.17], [0, 0.11, 0.27]).rotation.x = 0.2;
    mesh(accessory, box, ivory, [0.225, 0.016, 0.15], [0, 0.134, 0.27]).rotation.x = 0.2;
    mesh(head, box, ivory, [0.055, 0.19, 0.04], [0, -0.18, 0.12]);
  }
  const auraMaterial = new THREE.MeshBasicMaterial({ color: '#e7bc67', transparent: true, opacity: 0.65, side: THREE.DoubleSide, depthWrite: false });
  materials.add(auraMaterial);
  // Bóng tiếp xúc nhẹ vẫn có ở mức Vừa, không cần bản đồ bóng cho từng người.
  const shadowMaterial = new THREE.MeshBasicMaterial({ color: '#281c14', transparent: true, opacity: 0.18, depthWrite: false });
  materials.add(shadowMaterial);
  const shadow = mesh(rig, geometry(new THREE.CircleGeometry(1, 12)), shadowMaterial, [0.29, 0.18, 1], [0, 0.004, 0], 'contact-shadow');
  shadow.rotation.x = -Math.PI / 2; shadow.castShadow = false;
  const aura = mesh(rig, geometry(new THREE.RingGeometry(0.38, 0.41, 16)), auraMaterial, [1, 1, 1], [0, 0.012, 0], 'aura');
  aura.rotation.x = -Math.PI / 2; aura.castShadow = false;
  const halo = mesh(head, geometry(new THREE.RingGeometry(0.225, 0.24, 16)), auraMaterial, [1, 1, 1], [0, 0.02, -0.20], 'halo');
  halo.castShadow = false;
  const nameplate = makeLabel(createCanvas), bubble = makeLabel(createCanvas, true);
  group.add(nameplate.sprite, bubble.sprite);
  noPick(aura); noPick(halo); noPick(shadow);
  const effects = new THREE.Group(); effects.name = 'effects'; group.add(effects);
  const noCover = Object.freeze({ demon: false, lotus: false, aura: false, merit: false });
  const fxOption = opts.fx3d ?? fx3dEnabled();
  const fxHost = { group, rig, head };
  const fx = typeof fxOption === 'function' ? fxOption(fxHost)
    : fxOption && typeof fxOption === 'object' ? fxOption
      : fxOption ? createFx3d(fxHost, { quality: opts.quality || 'medium', reducedMotion: !!(opts.reducedMotion ?? globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches) })
        : null;
  // Nhãn tên vẽ sau lớp Pháp Tướng 3D (renderOrder 1..5); công tắc tắt thì giữ thứ tự vẽ cũ.
  if (fx) nameplate.sprite.renderOrder = bubble.sprite.renderOrder = 6;
  let fxQuality = opts.quality || 'medium', fxReduced = null;
  const cameraPosition = new THREE.Vector3(), origin = new THREE.Vector3(), parentRotation = new THREE.Quaternion();
  const follower = new THREE.Vector3(), followDelta = new THREE.Vector3(), localDelta = new THREE.Vector3();
  let following = false;
  function effect(name, resource, width, height, x, y, depth, center = [0.5, 0.5]) {
    let node = effectParts.get(name);
    if (!node && resource) {
      const mat = new THREE.SpriteMaterial({ map: resource.entry.texture, transparent: true, depthWrite: false, toneMapped: false });
      node = { sprite: noPick(new THREE.Sprite(mat)), resource };
      node.sprite.name = name;
      node.sprite.onBeforeRender = (renderer, scene, camera) => {
        camera.getWorldPosition(cameraPosition); group.getWorldPosition(origin);
        group.getWorldQuaternion(parentRotation);
        effects.quaternion.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, Math.atan2(cameraPosition.x - origin.x, cameraPosition.z - origin.z));
        effects.quaternion.premultiply(parentRotation.invert());
        effects.updateWorldMatrix(false, true);
        if (name.startsWith('demon')) {
          localDelta.copy(followDelta).applyQuaternion(effects.getWorldQuaternion(parentRotation).invert());
          node.sprite.position.copy(node.anchor).add(localDelta);
          node.sprite.updateWorldMatrix(false, false);
        }
      };
      node.anchor = new THREE.Vector3(); effects.add(node.sprite); effectParts.set(name, node);
    } else resource?.release();
    if (!node) return null;
    node.sprite.visible = node.resource.entry.ready;
    node.sprite.scale.set(width, height, 1); node.sprite.position.set(x, y, depth); node.sprite.center.set(...center);
    node.anchor.copy(node.sprite.position);
    return node.sprite;
  }
  function removeEffect(name) {
    const node = effectParts.get(name);
    if (node) { node.resource.release(); node.sprite.material.dispose(); node.sprite.removeFromParent(); effectParts.delete(name); }
  }
  function imageEffect(name, url, width, x, y, depth, center) {
    const resource = effectParts.has(name) ? null : imageTexture(url);
    const texture = effectParts.get(name)?.resource.entry.texture || resource?.entry.texture;
    const image = texture?.image;
    return effect(name, resource, width, image?.width ? width * image.height / image.width : width, x, y, depth, center);
  }
  let effectKey = '', cloakResource = null;
  let look, elapsed = 0, disposed = false, lastState = {};
  function setLook(nextLook) {
    if (disposed) return;
    look = normalize(nextLook);
    group.userData.look = { ...look };
    cloth.color.set(AVATAR_COLORS[look.c]);
    trim.color.copy(cloth.color).multiplyScalar(0.62);
    coat.scale.x = look.g === 'nu' ? 0.16 : 0.18;
    coat.scale.y = look.npcFashion ? 0.35 : 0.43;
    coat.position.y = look.npcFashion ? 0.195 : 0.235;
    neckline.visible = !!look.npcFashion;
    collar.visible = seam.visible = !look.npcFashion;
    shoulders.forEach(shoulder => { shoulder.material = look.npcFashion ? skin : cloth; });
    for (const leg of legs) leg.traverse(node => {
      if (node.name === 'upper-leg' || node.name === 'lower-leg') node.material = look.npcFashion ? skin : ivory;
    });
    for (const panel of skirt.children) { panel.scale.y = look.npcFashion ? 0.48 : 1; panel.position.y = look.npcFashion ? -0.02 : -0.22; }
    skirt.scale.x = look.g === 'nu' ? 1.08 : 1;
    hairCap.visible = look.h !== 3;
    longHair.visible = look.h === 0;
    sideLocks.forEach(lock => { lock.visible = look.h === 0; });
    bun.visible = look.h === 1;
    turban.visible = look.h === 3;
    turban.material = look.g === 'nam' ? ink : trim;
  }
  function update(state = {}, dt = 0) {
    if (disposed) return;
    lastState = state;
    const reduced = state.reducedMotion ?? opts.reducedMotion ?? !!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (!reduced) elapsed += clamp(finite(dt), 0, 0.1);
    const sitting = state.sit === true || state.sit === 'cushion' || state.sit === 'bench' || (Number.isInteger(state.sit) && state.sit >= 0);
    const bench = state.sit === 'bench';
    const bow = clamp(finite(state.bow), 0, 1);
    const walking = !!state.walking && !sitting && !bow;
    const swing = walking && !reduced ? Math.sin(elapsed * 8) * 0.45 : 0;
    const breath = reduced || walking ? 0 : Math.sin(elapsed * 1.8) * 0.006;
    const first = (state.isSelf ?? opts.isSelf) && (state.view || opts.view) === 'first';
    const isObito = !!state.obito || role === 'obito';
    obito.visible = maskRoot.visible = isObito;
    coat.visible = skirt.visible = !isObito;
    collar.visible = !isObito && !look.npcFashion;
    seam.visible = !isObito && !look.npcFashion;
    neckline.visible = !isObito && !!look.npcFashion;
    if (isObito && !cloakResource) cloakResource = cloakTexture(createCanvas);
    cloth.map = isObito ? cloakResource?.entry.texture || null : null;
    cloth.color.set(isObito ? '#ffffff' : AVATAR_COLORS[look.c]);
    if (isObito && !cloth.map) cloth.color.set('#17151c');
    if (cloth.userData.obito !== isObito) { cloth.needsUpdate = true; cloth.userData.obito = isObito; }
    rig.visible = !first;
    rig.rotation.y = finite(state.yaw);
    hips.position.y = (sitting ? bench ? 0.41 : 0.36 : 0.6425) + (walking && !reduced ? Math.abs(swing) * 0.035 : 0);
    torso.position.y = breath;
    torso.rotation.x = bow * 0.9;
    head.rotation.x = bow * 0.16;
    skirt.scale.y = sitting ? 0.55 : 1;
    skirt.scale.z = sitting ? 0.4 : 1;
    skirt.rotation.x = sitting ? -Math.PI / 2 : swing * 0.08;
    for (let i = 0; i < 2; i++) {
      const sign = i ? 1 : -1;
      legs[i].rotation.set(sitting ? -Math.PI / 2 : sign * swing, 0, sitting && !bench ? sign * 0.88 : 0);
      knees[i].rotation.set(sitting ? bench ? Math.PI / 2 : 3 : Math.max(0, -sign * swing) * 0.5, 0, sitting && !bench ? -sign * 0.6 : 0);
      const prayer = !walking;
      arms[i].rotation.set(prayer ? -0.28 : -sign * swing, 0, prayer ? -sign * 0.30 : sign * 0.06);
      elbows[i].rotation.set(prayer ? -0.8 : -0.12, 0, prayer ? -sign * 0.78 : 0);
    }
    // Khi nói chỉ hơi nghiêng đầu; chế độ giảm chuyển động giữ nguyên tư thế.
    head.rotation.z = state.talk && !reduced ? Math.sin(elapsed * 5) * 0.025 : 0;
    const now = finite(state.now, Date.now());
    const alive = !!state.aura && (state.aura.until === undefined || state.aura.until > now);
    const tier = alive ? clamp(Math.trunc(finite(state.aura?.t, 1)), 1, 9) : 0;
    const rank = clamp(Math.trunc(finite(state.meritRank)), 0, 6);
    const demon = clamp(Math.trunc(finite(state.demon?.n)), 0, 4);
    const fade = alive && Number.isFinite(state.aura.until) ? clamp((state.aura.until - now) / 20000, 0, 1) : 1;
    aura.visible = alive; halo.visible = alive && tier >= 3;
    const auraColor = typeof state.aura === 'string' ? state.aura : state.aura?.color;
    auraMaterial.color.set(typeof auraColor === 'string' ? auraColor : '#e7bc67');
    auraMaterial.opacity = fade * (reduced ? 0.65 : 0.60 + Math.sin(elapsed * 2) * 0.10);
    effects.visible = !first;
    const color = typeof auraColor === 'string' ? auraColor : '#ffd36b';
    const tint = alive && fade > 0.3 ? color : null;
    let covers = noCover;
    if (fx) {
      if (typeof state.quality === 'string' && state.quality !== fxQuality) { fxQuality = state.quality; fx.setQuality?.(fxQuality); }
      if (reduced !== fxReduced) { fxReduced = reduced; fx.setReducedMotion?.(reduced); }
      covers = fx.update({
        tier, color, fade, rank,
        demon: demon ? { n: demon, alpha: clamp(finite(state.demon?.alpha, 1), 0, 1) } : null,
        walking, yaw: finite(state.yaw), bow, sit: sitting ? (bench ? 'bench' : 'cushion') : false,
        talk: !!state.talk, bubble: state.bubble, id: state.id ?? state.name ?? '', now
      }, dt, {
        distance: finite(state.fx?.distance, Infinity), isSelf: !!(state.isSelf ?? opts.isSelf),
        slot: state.fx?.slot !== false, hidden: !!first
      }) || noCover;
    }
    const nextKey = `${tier}/${rank}/${demon}/${color}/${tint}/${+!!covers.demon}${+!!covers.lotus}${+!!covers.aura}`;
    if (effectKey !== nextKey) { [...effectParts.keys()].forEach(removeEffect); effectKey = nextKey; }
    const scale = sitting ? (104 - 27) / 104 : 1;
    const pulse = reduced ? 1 : 1 + Math.sin(elapsed * 2.2) * 0.015;
    const canvasEffect = (name, t, r, col, front = false) => {
      const resource = effectParts.has(name) ? null : canvasTexture(`fx/${name}/${t}/${r}/${col}`, c => name === 'lightning' ? drawLightning(c) : drawEffectCanvas(c, t, r, col, front), createCanvas);
      return effect(name, resource, 4.8 * pulse, 4.8 * scale * pulse, 0, 0, front ? 0.25 : -0.35, [0.5, 1 - 400 / 512]);
    };
    if (tier) {
      if (!covers.aura) {
        for (const front of [false, true]) {
          const node = canvasEffect(front ? 'aura-front' : 'aura-back', tier, 0, color, front);
          if (node) node.material.opacity = fade * 0.85;
        }
      }
      if (tier >= 2 && !covers.lotus) {
        const name = tier >= 9 ? 'lotus-rainbow' : tier >= 8 ? 'lotus-pink' : 'lotus-gold';
        const node = imageEffect('lotus', `/img/fx/aura/${name}.webp`, (72 + (tier - 2) * 3.5) * 0.015, 0, -0.0225, -0.1, [0.5, 0.78]);
        if (node) node.material.opacity = fade;
      }
      if (tier >= 3) {
        const node = imageEffect('aura-halo', '/img/fx/aura/halo-gold.webp', (66 + (tier - 3) * 2.5) * 0.015, 0, 1.32 * scale, -0.32);
        if (node) node.material.opacity = fade * 0.85;
      }
      if (tier >= 6) {
        const name = tier >= 8 ? 'mandorla-gold' : 'mandorla-violet';
        const node = imageEffect('mandorla', `/img/fx/aura/${name}.webp`, (92 + (tier - 6) * 4) * 0.015 * pulse, 0, -0.105, -0.4, [0.5, 0]);
        if (node) { node.scale.y *= scale; node.material.opacity = fade * (tier >= 8 ? 0.55 : 0.78); }
      }
      if (tier >= 9) {
        const node = canvasEffect('lightning', 0, 0, color, true);
        if (node) { node.visible = !reduced && elapsed % 2.6 < 0.32; node.material.opacity = fade * (1 - (elapsed % 2.6) / 0.32); }
      }
    }
    if (rank) canvasEffect('merit-form', 0, rank, tint);
    if (demon && !covers.demon) {
      group.getWorldPosition(origin);
      if (!following || reduced) follower.copy(origin);
      else follower.lerp(origin, 1 - Math.exp(-clamp(finite(dt), 0, 0.1) / 0.38));
      following = true; followDelta.copy(follower).sub(origin);
      const h = DEMON_ART[demon].h, width = h * DEMON_ART[demon].ar;
      const x = demon >= 4 ? 0 : -(10 + width * 0.42) * 0.015;
      const y = (demon >= 4 ? 114 : 40 + h / 2) * 0.015 + (reduced ? 0 : Math.sin(elapsed * 1.9) * 0.04);
      const alpha = clamp(finite(state.demon.alpha, 1), 0, 1);
      const node = imageEffect('demon', `/img/fx/demon-${demon}.webp`, width * 0.015 * pulse, x, y, -0.55);
      if (node) node.material.opacity = clamp(finite(state.demon.alpha, 1), 0, 1);
      for (const front of [false, true]) {
        const name = front ? 'demon-eyes' : 'demon-fire';
        const resource = effectParts.has(name) ? null : canvasTexture(`fx/${name}/${demon}`, c => drawEffectCanvas(c, 0, 0, null, front, demon), createCanvas);
        const glow = effect(name, resource, 4.8 * pulse, 4.8 * pulse, x, y, front ? -0.53 : -0.58);
        if (glow) glow.material.opacity = alpha * (front && !reduced && elapsed % 4.3 < 0.12 ? 0.1 : 1);
      }
    } else following = false;
    const name = textOf(state.name, 48).trim(), tag = textOf(state.tag, 64).trim();
    const speech = textOf(typeof state.bubble === 'string' ? state.bubble : state.bubble?.text, 180).trim();
    nameplate.set(name, tag);
    bubble.set(speech);
    nameplate.sprite.visible = !first && !!name && !!nameplate.sprite.material.map;
    bubble.sprite.visible = !first && !!speech && !!bubble.sprite.material.map;
    const top = hips.position.y + 1.10 - bow * 0.24;
    nameplate.sprite.position.set(0, top, 0);
    bubble.sprite.position.set(0, top + (state.tag ? 0.55 : 0.46), 0);
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    group.removeFromParent();
    nameplate.dispose(); bubble.dispose();
    [...effectParts.keys()].forEach(removeEffect); cloakResource?.release();
    geometries.forEach(value => value.dispose());
    materials.forEach(value => value.dispose());
    fx?.dispose?.();
    group.clear();
  }
  setLook(initialLook);
  update(opts.state || {}, 0);
  return { group, update, setLook(nextLook) { setLook(nextLook); update(lastState, 0); }, dispose, fx };
}
