// T-091 · Lớp vẽ độc lập; chỉ đọc thế cờ công khai, không quyết định nước đi.
'use strict';

import * as THREE from '/vendor/three/three.module.js?v=0.187.0';

const FILES = 'abcdefghijklmno';
const GO_FILES = 'ABCDEFGHJKLMNOPQRST';
const HAN = { r: ['俥', '車'], n: ['傌', '馬'], b: ['相', '象'], a: ['仕', '士'], k: ['帥', '將'], c: ['炮', '砲'], p: ['兵', '卒'] };
const VIET = { r: 'Xe', n: 'Mã', b: 'Tượng', a: 'Sĩ', k: 'Tướng', c: 'Pháo', p: 'Tốt' };

export function boardLayout(game, size) {
  if (!['chess', 'xiangqi', 'jieqi', 'go', 'gomoku'].includes(game)) throw new Error('Môn cờ chưa hỗ trợ.');
  const chess = game === 'chess', stones = game === 'go' || game === 'gomoku';
  const n = stones ? (size || (game === 'go' ? 9 : 15)) : 0;
  if (stones && !(game === 'go' ? [9, 13, 19].includes(n) : Number.isInteger(n) && n >= 5 && n <= 15)) {
    throw new Error('Kích thước bàn không hợp lệ.');
  }
  return { game, chess, stones, cols: chess ? 8 : stones ? n : 9, rows: chess ? 8 : stones ? n : 10 };
}

export function squareAtWorld(layout, x, z, flip = false) {
  const { cols, rows, chess, game } = layout;
  if (!Number.isFinite(x) || !Number.isFinite(z)) return null;
  let col = Math.round(x + (cols - 1) / 2), row = Math.round((rows - 1) / 2 - z);
  if (col < 0 || col >= cols || row < 0 || row >= rows) return null;
  if (!chess && Math.hypot(x - (col - (cols - 1) / 2), z - ((rows - 1) / 2 - row)) > 0.62) return null;
  if (flip) { col = cols - 1 - col; row = rows - 1 - row; }
  return (game === 'go' ? GO_FILES : FILES)[col] + (row + (game === 'xiangqi' || game === 'jieqi' ? 0 : 1));
}

function squareIndex(layout, name) {
  if (typeof name !== 'string') return -1;
  const files = layout.game === 'go' ? GO_FILES : FILES;
  const col = files.indexOf(name[0]);
  const row = Number(name.slice(1)) - (layout.game === 'xiangqi' || layout.game === 'jieqi' ? 0 : 1);
  return col >= 0 && col < layout.cols && Number.isInteger(row) && row >= 0 && row < layout.rows ? row * layout.cols + col : -1;
}

// Ghép danh tính hình vẽ theo ô cũ và last, kể cả nhập thành, bắt tốt qua đường, phong cấp.
// Chỉ suy diễn hoạt ảnh cho một nước có from/to; ảnh chụp nhảy xa được dựng lại ngay.
export function transitionPieces(before, after, last, layout) {
  const from = squareIndex(layout, last && last[0]), to = squareIndex(layout, last && last[layout.stones ? 0 : 1]);
  const changed = after.reduce((out, ch, i) => { if ((before[i] || '') !== (ch || '')) out.push(i); return out; }, []);
  const move = layout.stones
    ? to >= 0 && !before[to] && !!after[to] && changed.every(i => i === to || !after[i])
    : from >= 0 && to >= 0 && from !== to && !!before[from] && !after[from] && !!after[to] && changed.length <= 4;
  const pairs = new Map(), used = new Set();
  after.forEach((ch, i) => { if (ch && ch === before[i] && !(move && i === to)) { pairs.set(i, i); used.add(i); } });
  if (move && !layout.stones) { pairs.set(to, from); used.add(from); }
  after.forEach((ch, i) => {
    if (!ch || pairs.has(i)) return;
    const old = move ? before.findIndex((value, j) => value === ch && !used.has(j) && !after[j] && j !== to) : -1;
    if (old >= 0) { pairs.set(i, old); used.add(old); }
  });
  return { move, pairs, captured: move ? before.flatMap((ch, i) => ch && !used.has(i) ? [i] : []) : [] };
}

/* ---- T-113 · Hàm thuần cho skin và hiệu ứng (test bằng node:test, không đụng GPU) ---- */

/** Nhịp hiệu ứng (ms) và độ lớn. wave = tốc độ sóng phong cấp tính bằng ô/ms. */
export const FX = Object.freeze({
  domain: 1500, front: 1150,
  wave: 0.012, hop: 420, lift: 0.62, falloff: 0.3,
  shake: 560, shakeAmp: 0.16,
  strike: 220, fall: 900, pillar: 2300
});
const clamp01 = v => (v > 0 ? (v < 1 ? v : 1) : 0);
const easeOut = t => 1 - (1 - t) ** 3;
const easeOutBack = t => 1 + 2.6 * (t - 1) ** 3 + 1.6 * (t - 1) ** 2;
const easeInOut = t => (t < 0.5 ? 2 * t * t : 1 - (2 - 2 * t) ** 2 / 2);

/** Kích thước mặt bàn (không tính thành gỗ). Thành gỗ rộng thêm 0,25 mỗi chiều. */
export function boardSize(layout) {
  return { w: layout.cols + (layout.chess ? 1.2 : 0.4), d: layout.rows + (layout.chess ? 1.2 : 0.4) };
}

/** Hàng thuộc nửa sân nào: nửa của bên a là nửa có quân a lúc khai cuộc (cờ vua 4 hàng, cờ tướng chia ở sông). */
export function halfOf(layout, row) {
  if (!layout || layout.stones || !Number.isInteger(row) || row < 0 || row >= layout.rows) return null;
  return row < layout.rows / 2 ? 'a' : 'b';
}

/** Khai mở: front = mép sáng đi từ mép người chơi (0) tới giữa bàn (1); glow = độ rực của ánh palette.glow. */
export function revealProgress(elapsed, o = FX) {
  const e = Number.isFinite(elapsed) ? elapsed : elapsed > 0 ? o.domain : 0;
  const f = clamp01(e / o.front), t = clamp01(e / o.domain);
  return { front: easeOut(f), glow: f < 0.08 ? f / 0.08 : (1 - t) ** 1.4, done: t >= 1 };
}

/** Đồ trang trí ở độ sâu f (0 = mép người chơi, 1 = giữa bàn) trồi lên khi mép sáng đi qua; có nảy nhẹ quá 1. */
export function riseAt(front, f) {
  const t = clamp01((front - 0.75 * clamp01(f)) / 0.25);
  return t >= 1 ? 1 : easeOutBack(t);
}

/** Phong cấp: độ nảy của quân cách ô phong cấp `distance` ô, sau `elapsed` ms.
 * Sóng đến trễ theo khoảng cách (distance / wave), gần thì nảy cao, xa thì thấp; hai nhịp rồi đứng yên. */
export function joltLift(distance, elapsed, o = FX) {
  if (!(distance > 0) || !Number.isFinite(elapsed)) return 0;
  const tau = elapsed - distance / o.wave;
  if (tau <= 0) return 0;
  const amp = o.lift / (1 + o.falloff * Math.max(0, distance - 1));
  if (tau < o.hop) return amp * Math.sin(Math.PI * tau / o.hop);
  const tau2 = tau - o.hop, hop2 = o.hop * 0.55;
  return tau2 < hop2 ? amp * 0.28 * Math.sin(Math.PI * tau2 / hop2) : 0;
}
export function joltDuration(maxDistance, o = FX) { return Math.max(0, maxDistance) / o.wave + o.hop * 1.55; }

/** Rung máy quay, tắt dần trong o.shake ms. scale cho phép rung nhẹ hơn (chiến thắng). */
export function shakeOffset(elapsed, o = FX, scale = 1) {
  const t = elapsed / o.shake;
  if (!(t >= 0 && t < 1)) return { x: 0, y: 0 };
  const a = o.shakeAmp * scale * (1 - t) ** 2;
  return { x: a * Math.sin(elapsed * 0.085), y: a * 0.7 * Math.sin(elapsed * 0.123 + 1.3) };
}

/** Vòng sóng sáng: bán kính chạy cùng tốc độ sóng nảy, mờ dần khi ra tới mép bàn. */
export function waveRing(elapsed, maxDistance, o = FX) {
  if (!(elapsed >= 0)) return { radius: 0, opacity: 0 };
  const radius = elapsed * o.wave;
  return { radius, opacity: 0.85 * clamp01(1 - radius / (Math.max(1, maxDistance) + 0.8)) };
}

/** Vua/Tướng bên thua đổ: 'tall' (cờ vua) ngã ngửa ~90° có nảy nhẹ; 'disk' (cờ tướng, cờ úp) lật úp 180°. */
export function fallPose(kind, elapsed, o = FX) {
  const t = clamp01((elapsed - o.strike * 0.8) / o.fall);
  if (kind === 'disk') {
    const angle = Math.PI * easeInOut(t);
    return { angle, lift: 0.55 * Math.sin(Math.PI * t) + 0.285 * (1 - Math.cos(angle)) / 2, done: t >= 1 };
  }
  const end = Math.PI / 2 - 0.05, g = Math.min(1, t / 0.8);
  let angle = end * g * g;
  if (t > 0.8) angle = end - 0.14 * Math.sin(Math.PI * (t - 0.8) / 0.2);
  return { angle, lift: 0.31 * Math.sin(angle), done: t >= 1 };
}

/** Cột sáng dội xuống: reach = phần cột đã chạm tới mặt bàn (0..1), opacity tắt dần tới o.pillar ms. */
export function pillarPose(elapsed, o = FX) {
  if (!(elapsed >= 0)) return { reach: 0, opacity: 0, done: false };
  const reach = easeOut(clamp01(elapsed / o.strike)), hold = o.pillar * 0.45;
  const opacity = elapsed < o.strike ? 1
    : elapsed < hold ? 1 - 0.35 * (elapsed - o.strike) / (hold - o.strike)
    : 0.65 * clamp01((o.pillar - elapsed) / (o.pillar - hold));
  return { reach, opacity, done: elapsed >= o.pillar };
}

/** T-122 · Độ dịch ngang của texture nước ở thời điểm now (ms): chảy từ trái sang phải, một vòng khoảng 33 giây. */
export function riverOffset(now) {
  const t = Number.isFinite(now) ? now : 0;
  return -((t * 0.00003) % 1) || 0; // `|| 0` để t = 0 ra 0 chứ không phải -0
}
/** Khoảng cách tối thiểu (ms) giữa hai lần vẽ lại để sông chảy: ~30 khung/giây ở Vừa/Cao, ~10 ở Thấp. */
export function riverFrameGap(quality) { return quality === 'low' ? 100 : 33; }

/** Số giả ngẫu nhiên tất định theo chỉ số (không dùng Math.random: hình phải giống nhau mọi lần vẽ). */
export function hash01(n) {
  let x = Math.imul((n | 0) ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35); x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

/** Vị trí hạt i ở thời điểm t (0..1 của hiệu ứng). u ∈ [-1,1] theo bề ngang, v theo chiều sâu
 * (khai mở: 0 = mép người chơi, 1 = giữa bàn; 'dust'/'rise': độ lệch quanh tâm), y = độ cao. on=false là ẩn. */
export function particlePoint(kind, i, t) {
  const r1 = hash01(i * 3 + 1), r2 = hash01(i * 3 + 2), r3 = hash01(i * 3 + 3);
  const tau = (t - r2 * 0.55) / (0.45 + r3 * 0.25);
  if (!(tau >= 0 && tau <= 1)) return { u: 0, v: 0, y: 0, on: false };
  let u = r1 * 2 - 1, v = r2, y;
  switch (kind) {
    case 'snow': y = 0.05 + 1.7 * (1 - tau); u += 0.05 * Math.sin(5 * tau + i); break;
    case 'bubble': y = 0.05 + 1.2 * tau; u += 0.03 * Math.sin(12 * tau + i); break;
    case 'leaf': case 'petal': y = 0.05 + 1.3 * (1 - tau); u += 0.18 * tau; v += 0.06 * Math.sin(6 * tau + i); break;
    case 'spark': y = 0.15 + r3 * 0.9; if ((i + Math.floor(tau * 7)) % 3 === 0) return { u, v, y, on: false }; break;
    case 'sand': y = 0.06 + r3 * 0.3; u += 0.35 * tau; break;
    case 'ripple': y = 0.05 + 0.6 * Math.sin(Math.PI * tau); break;
    case 'dust': {
      const a = r1 * Math.PI * 2, r = tau * (0.8 + r3 * 1.6);
      return { u: Math.cos(a) * r, v: Math.sin(a) * r, y: 0.05 + 0.5 * Math.sin(Math.PI * tau) * (0.4 + r2), on: true };
    }
    case 'rise': {
      const a = r1 * Math.PI * 2 + tau * 2, r = 0.15 + r3 * 0.35;
      return { u: Math.cos(a) * r, v: Math.sin(a) * r, y: tau * (2 + r2 * 2), on: true };
    }
    default: y = 0.05 + 1.5 * tau; u += 0.04 * Math.sin(9 * tau + i); // ember: tàn lửa bốc lên
  }
  return { u, v, y, on: true };
}

/** Điểm đặt đồ trang trí dựng bằng mã cho nửa sân của `side` (toạ độ bàn, đặt trên sàn y = -0,5).
 * Hai bên mép ngang phía người chơi + hai góc; tránh dải giữa hai bên nơi xếp quân bị ăn (|z| < 3).
 * f = thứ tự trồi lên khi khai mở (0 = sát mép người chơi). */
export function decorAnchors(layout, side) {
  if (!layout || layout.stones || (side !== 'a' && side !== 'b')) return [];
  const { w, d } = boardSize(layout), W = (w + 0.25) / 2, E = (d + 0.25) / 2, sign = side === 'a' ? 1 : -1;
  return [[0.6, 0.74], [0.45, 0.96], [0.2, 1.12]].flatMap(([dx, zf], i) => [-1, 1].map(lr => {
    const n = i * 4 + (lr > 0 ? 1 : 0) + (sign > 0 ? 0 : 2);
    return { x: lr * (W + dx), z: sign * zf * E, f: clamp01(1 - zf), s: 0.78 + hash01(n) * 0.45, turn: hash01(n + 50) * Math.PI * 2 };
  }));
}

/** T-125 · Mặt phẳng ảnh sân v2 của một nửa (toạ độ bàn, trục y là mặt bàn). Ảnh 1408x704, 128 px = 1 ô:
 * mép trên ảnh = đường giữa bàn, mép dưới = phía người chơi, dải cảnh 1,5 ô ở hai bên và sau lưng.
 * Cờ vua: 4 ô ảnh = 4 hàng ô của nửa đó (đường giữa ở z = 0). Cờ tướng/cờ úp: 4 ô ảnh = từ hàng sát sông
 * (z = ±0,5) tới hàng cuối (z = ±4,5), dải sông ở giữa không phủ ảnh.
 * w, d = kích thước mặt phẳng; x, z = tâm; rotY = góc xoay quanh trục đứng (nửa b xoay 180°);
 * near/far = z của mép đường giữa và mép ngoài (cùng dấu với nửa sân). Trả null nếu môn/bên không hợp lệ. */
export const FIELD_MARGIN = 1.5;
export function fieldPlane(game, side) {
  if (!['chess', 'xiangqi', 'jieqi'].includes(game) || (side !== 'a' && side !== 'b')) return null;
  const sign = side === 'a' ? 1 : -1, near = game === 'chess' ? 0 : 0.5, d = 4 + FIELD_MARGIN;
  return { w: 8 + 2 * FIELD_MARGIN, d, x: 0, z: sign * (near + d / 2), rotY: side === 'a' ? 0 : Math.PI, near: sign * near, far: sign * (near + d), sign };
}

function rgb(color) {
  const m = /^#([0-9a-f]{6})$/i.exec(String(color || ''));
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const rgba = (color, alpha) => 'rgba(' + (rgb(color) || [0, 0, 0]).join(',') + ',' + alpha + ')';
export function mixColor(a, b, t) {
  const x = rgb(a) || [0, 0, 0], y = rgb(b) || [0, 0, 0], k = clamp01(t);
  return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * k).toString(16).padStart(2, '0')).join('');
}
function luminance(color) {
  const c = rgb(color) || [0, 0, 0];
  const [r, g, b] = c.map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
/** Tỉ lệ tương phản WCAG giữa hai màu #rrggbb. */
export function contrastRatio(a, b) {
  const x = luminance(a), y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
/** Màu chữ/nét trên thân quân: dùng accent nếu đủ tương phản với base, không thì đẩy dần về đen/trắng. */
export function readableInk(base, accent, min = 4.5) {
  const ink = rgb(accent) ? accent : base;
  if (contrastRatio(ink, base) >= min) return ink;
  const toward = luminance(base) > 0.3 ? '#000000' : '#ffffff';
  for (let i = 1; i <= 10; i++) {
    const c = mixColor(ink, toward, i / 10);
    if (contrastRatio(c, base) >= min) return c;
  }
  return toward;
}
/** Màu vẽ một nửa sân theo palette, đã chỉnh cho dễ đọc thế cờ (K5):
 * cờ vua: ô tối không quá tối (quân đen vẫn nổi); cờ tướng: nền là màu tương phản nhất với nét kẻ. */
export function fieldTones(palette, chess) {
  const p = palette || {};
  const light = rgb(p.light) ? p.light : '#ecd5a4', darkRaw = rgb(p.dark) ? p.dark : '#886044';
  const rim = rgb(p.rim) ? p.rim : '#58361f', glow = rgb(p.glow) ? p.glow : '#e2bb72';
  const best = (ground, list) => list.reduce((a, b) => (contrastRatio(b, ground) > contrastRatio(a, ground) ? b : a));
  if (chess) {
    let dark = darkRaw;
    for (let i = 1; luminance(dark) < 0.07 && i <= 12; i++) dark = mixColor(darkRaw, light, i * 0.05);
    const frame = mixColor(rim, dark, 0.35);
    const line = rgb(p.line) && contrastRatio(p.line, frame) >= 3 ? p.line : best(frame, [light, '#fff6dc', '#2b2118']);
    return { light, dark, frame, line, vein: light, rim, glow };
  }
  const line0 = rgb(p.line) ? p.line : '#654522';
  const ground = contrastRatio(line0, darkRaw) >= contrastRatio(line0, light) ? darkRaw : light;
  const vein = ground === darkRaw ? light : darkRaw;
  const line = contrastRatio(line0, ground) >= 3 ? line0 : best(ground, ['#fff6dc', '#2b2118']);
  return { light, dark: darkRaw, ground, vein, frame: ground, line, rim, glow };
}

/** createBoard3D({canvas, game, skins, quality, assets, models}) →
 *   setState(o), onPick(fn), setFlip, resize, dispose, playFx(kind, opts), stopFx(kind?), setQuality(q), stats().
 * o suit KydaoDraw.draw; vây thêm size, caro nhận board hoặc cells của luật (hàng trên trước).
 * o.skins = { a:{field,pieces}, b:{field,pieces} } theo danh mục KydaoSkins (mã lạ bỏ qua, thiếu = mặc định).
 * skins: danh mục KydaoSkins (mặc định globalThis.KydaoSkins); quality: 'low'|'medium'|'high';
 * assets: thay bộ nạp mô hình và ảnh (test; cần loadModel/instantiate và loadImage); models:false thì không bao giờ nạp .glb.
 * fieldImages (mặc định true): nửa sân có skin dùng ảnh sân v2 (KydaoSkins.fieldImage2) làm mặt sân kèm dải cảnh;
 * ảnh 404 hoặc fieldImages:false thì giữ cách cũ (lớp phủ palette + đồ trang trí).
 * Mặc định vẽ hoàn toàn bằng mã; chỉ nạp .glb (qua board-assets.mjs) khi có skin. Tài nguyên GPU dùng chung trong mỗi bàn.
 */
export function createBoard3D({ canvas, game, skins: catalogInput, quality: qualityInput, assets, models = true, fieldImages = true }) {
  let layout = boardLayout(game), state = {}, previous = [], pieces = new Map(), captured = [];
  let flip = false, pick = () => {}, stopped = false, frame = 0, drag = null, pinching = false;
  let yaw = 0.16, elevation = 0.93, zoom = 1, width = 0, height = 0, vi = null;
  const pointers = new Map(), resources = new Set(), templates = new Map();
  const catalog = catalogInput || globalThis.KydaoSkins || null;
  const LEVELS = ['low', 'medium', 'high'];
  let quality = LEVELS.includes(qualityInput) ? qualityInput : 'medium';
  const NO_SKIN = Object.freeze({ field: null, pieces: null });
  let skins = { a: NO_SKIN, b: NO_SKIN };
  const halves = { a: null, b: null }, pieceSkins = new Map(), effects = new Set();
  let retired = [], sceneMargin = 0, labels = null, aftermath = null, shake = { x: 0, y: 0 }, shaken = false, assetsPromise = null;
  const media = window.matchMedia('(prefers-reduced-motion: reduce)');
  // Người chơi tắt hiệu ứng (localStorage 'ta-fx' = '0') thì coi như giảm chuyển động.
  const fxOff = () => { try { return window.localStorage.getItem('ta-fx') === '0'; } catch (e) { return false; } };
  const calm = () => media.matches || fxOff();
  const oldTouchAction = canvas.style.touchAction;
  canvas.style.touchAction = 'none';
  const keep = resource => { resources.add(resource); return resource; };
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#28362f');
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 180);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = quality !== 'low';
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  const board = new THREE.Group(), markers = new THREE.Group();
  scene.add(board); board.add(markers);
  scene.add(new THREE.HemisphereLight('#fff1d7', '#526556', 2.3));
  const key = new THREE.DirectionalLight('#ffe3b5', 3.4);
  key.position.set(-5, 12, 7); key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = key.shadow.camera.bottom = -16;
  key.shadow.camera.right = key.shadow.camera.top = 16;
  key.shadow.camera.far = 45; key.shadow.normalBias = 0.035; key.shadow.bias = -0.00015;
  key.shadow.radius = 4; scene.add(key);
  const rim = new THREE.DirectionalLight('#dce8f2', 1.5); rim.position.set(5, 7, -7); scene.add(rim);

  const material = (color, roughness = 0.38, extra = {}) => keep(new THREE.MeshStandardMaterial({ color, roughness, ...extra }));
  function texture(w, h, paint, own = keep) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    paint(c.getContext('2d'), w, h);
    const map = own(new THREE.CanvasTexture(c)); map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    return map;
  }
  const grain = texture(512, 512, ctx => {
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 160; i++) {
      ctx.strokeStyle = 'rgba(68,34,12,' + (0.018 + (i % 5) * 0.008) + ')';
      ctx.lineWidth = 0.4 + (i % 3) * 0.35; ctx.beginPath();
      for (let x = 0; x <= 512; x += 16) {
        const y = i * 3.4 + Math.sin(x / 85 + i * 0.75) * 3 + Math.sin(x / 39 + i) * 0.8;
        if (!x) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  });
  const ivory = material('#f7dfae', 0.26, { map: grain, metalness: 0.04 });
  const ebony = material('#292d29', 0.25, { map: grain, metalness: 0.07 });
  const wood = material('#78462b', 0.34, { map: grain });
  const brass = material('#bd9355', 0.3, { metalness: 0.55 });
  const diskWood = material('#ddae69', 0.34, { map: grain });
  function mesh(geometry, mat, parent, x = 0, y = 0, z = 0) {
    const m = new THREE.Mesh(keep(geometry), mat); m.position.set(x, y, z);
    m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
  }
  const floor = mesh(new THREE.PlaneGeometry(180, 180), material('#354b3e', 0.95), scene, 0, -0.5);
  floor.rotation.x = -Math.PI / 2; floor.castShadow = false;
  let slab, trim, surface, boardMaterial, water = null, river = [], lastRiver = 0, dirty = true;

  // Màu gỗ mặc định của mặt bàn; skin nửa sân vẽ lại đúng các nét này bằng màu palette.
  const WOOD = { light: '#ecd5a4', dark: '#886044', vein: 'rgba(75,39,13,.07)', line: '#654522', text: '#71502e', frameOuter: '#e2bb72', frameInner: '#58361f', label: '#f5dfaf' };
  function boardTexture() {
    const { w, d } = boardSize(layout);
    return texture(1536, Math.round(1536 * d / w), (ctx, tw, th) => {
      ctx.scale(tw / w, th / d); ctx.translate(w / 2, d / 2);
      paintFace(ctx, w, d, { ...WOOD, ground: layout.chess ? '#9b683e' : '#e9c48a', river: true });
    });
  }
  /** Vẽ mặt bàn trong toạ độ bàn (x ngang, "y" của canvas = z của bàn). Nửa sân dùng lại hàm này, phần ngoài canvas tự bị cắt. */
  function paintFace(ctx, w, d, k, pattern) {
    ctx.fillStyle = k.ground; ctx.fillRect(-w / 2, -d / 2, w, d);
    if (layout.chess) for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      ctx.fillStyle = (c + r) % 2 ? k.light : k.dark; ctx.fillRect(c - 4, 3 - r, 1, 1);
    }
    ctx.lineWidth = 0.012;
    for (let i = 0; i < 220; i++) {
      const z = -d / 2 + d * i / 220;
      ctx.strokeStyle = k.vein; ctx.beginPath(); ctx.moveTo(-w / 2, z);
      ctx.bezierCurveTo(-w / 6, z + Math.sin(i) * 0.08, w / 6, z - 0.04, w / 2, z); ctx.stroke();
    }
    if (pattern) pattern(ctx);
    const x = c => c - (layout.cols - 1) / 2, z = r => (layout.rows - 1) / 2 - r;
    const line = (c, r, cc, rr) => { ctx.beginPath(); ctx.moveTo(x(c), z(r)); ctx.lineTo(x(cc), z(rr)); ctx.stroke(); };
    ctx.strokeStyle = k.line; ctx.lineWidth = 0.025;
    if (!layout.chess) {
      for (let r = 0; r < layout.rows; r++) line(0, r, layout.cols - 1, r);
      for (let c = 0; c < layout.cols; c++) {
        if (layout.stones || c === 0 || c === 8) line(c, 0, c, layout.rows - 1);
        else { line(c, 0, c, 4); line(c, 5, c, 9); }
      }
      if (!layout.stones) {
        for (const r of [0, 7]) { line(3, r, 5, r + 2); line(5, r, 3, r + 2); }
        // Dải sông (nước, bờ cát, chữ) là mô hình riêng trong rebuildBoard, không vẽ vào mặt bàn.
        // Dấu chân pháo và tốt, ngắt ở đường biên.
        ctx.lineWidth = 0.018;
        for (const r of [2, 3, 6, 7]) for (const c of (r === 2 || r === 7 ? [1, 7] : [0, 2, 4, 6, 8])) {
          for (const dx of [-1, 1]) for (const dz of [-1, 1]) {
            if (c + dx < 0 || c + dx > 8) continue;
            ctx.beginPath(); ctx.moveTo(x(c) + dx * 0.22, z(r) + dz * 0.09);
            ctx.lineTo(x(c) + dx * 0.09, z(r) + dz * 0.09); ctx.lineTo(x(c) + dx * 0.09, z(r) + dz * 0.22); ctx.stroke();
          }
        }
      } else {
        const mid = (layout.cols - 1) / 2;
        const stars = layout.cols === 9 ? [2, mid, 6] : [3, mid, layout.cols - 4];
        for (const c of stars) for (const r of stars) {
          ctx.beginPath(); ctx.arc(x(c), z(r), 0.07, 0, Math.PI * 2); ctx.fillStyle = k.line; ctx.fill();
        }
      }
    }
    ctx.strokeStyle = k.frameOuter; ctx.lineWidth = 0.025; ctx.strokeRect(-w / 2 + 0.12, -d / 2 + 0.12, w - 0.24, d - 0.24);
    ctx.strokeStyle = k.frameInner; ctx.lineWidth = 0.04; ctx.strokeRect(-w / 2 + 0.18, -d / 2 + 0.18, w - 0.36, d - 0.36);
    if (layout.chess) {
      ctx.fillStyle = k.label; ctx.font = 'bold .23px Georgia, serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (let i = 0; i < 8; i++) {
        ctx.fillText(FILES[i], i - 3.5, 4.32); ctx.fillText(String(i + 1), -4.32, 3.5 - i);
        ctx.save(); ctx.rotate(Math.PI); ctx.fillText(FILES[7 - i], i - 3.5, 4.32); ctx.fillText(String(8 - i), -4.32, 3.5 - i); ctx.restore();
      }
    }
  }

  /** Mặt nước 256x64: nền sâu–sáng và 12 vệt sóng trắng mờ; số chu kỳ nguyên nên cuộn vòng không lộ mối nối. */
  function waterTexture() {
    const map = texture(256, 64, (ctx, tw, th) => {
      const g = ctx.createLinearGradient(0, 0, 0, th);
      g.addColorStop(0, '#9fc7d2'); g.addColorStop(0.5, '#ffffff'); g.addColorStop(1, '#9fc7d2');
      ctx.fillStyle = g; ctx.fillRect(0, 0, tw, th);
      ctx.lineCap = 'round';
      for (let i = 0; i < 12; i++) {
        const y0 = (i + 0.5) * th / 12, cycles = 2 + (i % 3), amp = 1.2 + (i % 4) * 0.5;
        ctx.strokeStyle = 'rgba(255,255,255,' + (0.16 + (i % 3) * 0.07) + ')'; ctx.lineWidth = 1.2 + (i % 2) * 0.8;
        ctx.beginPath();
        for (let x = 0; x <= tw; x += 8) {
          const y = y0 + Math.sin(x / tw * Math.PI * 2 * cycles + i * 1.9) * amp;
          if (!x) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    });
    map.wrapS = THREE.RepeatWrapping;
    return map;
  }
  /** Chữ Sở Hà / Hán Giới: texture trong suốt, chữ trắng ngà có viền tối. */
  function riverLabelTexture(width) {
    return texture(1024, Math.round(1024 / width), (ctx, tw, th) => {
      ctx.scale(tw / width, th); ctx.translate(width / 2, 0.5);
      ctx.font = 'bold .38px "SimSun", "Times New Roman", serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round'; ctx.lineWidth = 0.06; ctx.strokeStyle = 'rgba(8,30,40,.75)'; ctx.fillStyle = '#fff8e2';
      for (const [text, x] of [[state.vi ? 'Sở Hà' : '楚河', -2], [state.vi ? 'Hán Giới' : '漢界', 2]]) { ctx.strokeText(text, x, 0); ctx.fillText(text, x, 0); }
    });
  }
  function disposeRiver() {
    for (const m of river) {
      board.remove(m); resources.delete(m.geometry); m.geometry.dispose();
      if (m.material.map) { resources.delete(m.material.map); m.material.map.dispose(); }
      resources.delete(m.material); m.material.dispose();
    }
    river = []; water = null;
  }
  /** Dòng sông giữa bàn cờ tướng và cờ úp: nước, hai bờ cát, chữ. Mọi skin nửa sân dừng ở bờ nên không phủ lên đây. */
  function buildRiver() {
    disposeRiver();
    if (layout.chess || layout.stones) return;
    const width = boardSize(layout).w - 0.4;
    water = mesh(new THREE.PlaneGeometry(width, 1), material('#2f8aa3', 0.15, { metalness: 0.1, transparent: true, opacity: 0.92, map: waterTexture() }), board, 0, 0.004);
    water.rotation.x = -Math.PI / 2; water.castShadow = false; water.name = 'kd-river-water';
    water.material.map.offset.x = calm() ? 0 : riverOffset(performance.now());
    river.push(water);
    const sand = material('#d9c08a', 0.8);
    for (const sign of [-1, 1]) {
      const bank = mesh(new THREE.BoxGeometry(width, 0.02, 0.05), sand, board, 0, 0.01, sign * 0.475); bank.name = 'kd-river-bank'; river.push(bank);
    }
    const label = mesh(new THREE.PlaneGeometry(width, 1), keep(new THREE.MeshBasicMaterial({ map: riverLabelTexture(width), transparent: true, depthWrite: false, toneMapped: false })), board, 0, 0.006);
    label.rotation.x = -Math.PI / 2; label.castShadow = false; label.receiveShadow = false; label.name = 'kd-river-label'; river.push(label);
  }

  function rebuildBoard() {
    for (const m of [slab, trim, surface]) if (m) { board.remove(m); resources.delete(m.geometry); m.geometry.dispose(); }
    const { w, d } = boardSize(layout);
    slab = mesh(new THREE.BoxGeometry(w + 0.25, 0.32, d + 0.25), wood, board, 0, -0.22);
    trim = mesh(new THREE.BoxGeometry(w + 0.12, 0.045, d + 0.12), brass, board, 0, -0.043);
    if (boardMaterial) { resources.delete(boardMaterial.map); boardMaterial.map.dispose(); resources.delete(boardMaterial); boardMaterial.dispose(); }
    boardMaterial = material('#ffffff', 0.48, { map: boardTexture() });
    surface = mesh(new THREE.PlaneGeometry(w, d), boardMaterial, board);
    surface.rotation.x = -Math.PI / 2; surface.castShadow = false;
    buildRiver();
    vi = !!state.vi;
  }

  function lathe(points, mat, group) {
    return mesh(new THREE.LatheGeometry(points.map(p => new THREE.Vector2(...p)), 40), mat, group);
  }
  function ring(group, radius, y, mat, tube = 0.025) {
    const m = mesh(new THREE.TorusGeometry(radius, tube, 8, 40), mat, group, 0, y); m.rotation.x = Math.PI / 2;
    m.userData.role = 'accent'; // skin quân tô chi tiết này bằng màu accent
  }
  function chessPiece(ch) {
    const group = new THREE.Group(), light = ch === ch.toUpperCase(), mat = light ? ivory : ebony, type = ch.toLowerCase();
    lathe([[0, 0.015], [0.27, 0.015], [0.31, 0.04], [0.32, 0.08], [0.31, 0.12], [0.26, 0.15],
      [0.26, 0.19], [0.22, 0.22], [0.18, 0.25], [0.14, 0.33], [0.115, 0.45], [0.13, 0.54],
      [0.19, 0.57], [0.195, 0.60], [0.16, 0.63], [0, 0.63]], mat, group);
    ring(group, 0.285, 0.115, mat, 0.018); ring(group, 0.17, 0.595, mat, 0.016);
    if (type === 'p') {
      mesh(new THREE.SphereGeometry(0.175, 24, 16), mat, group, 0, 0.77);
      group.scale.setScalar(0.87);
    } else if (type === 'n') {
      const shape = new THREE.Shape();
      shape.moveTo(-0.23, 0); shape.bezierCurveTo(-0.22, 0.18, -0.1, 0.24, -0.12, 0.36);
      shape.lineTo(-0.28, 0.30); shape.lineTo(-0.34, 0.37); shape.lineTo(-0.28, 0.48);
      shape.lineTo(-0.10, 0.66); shape.lineTo(-0.07, 0.79); shape.lineTo(0.02, 0.70);
      shape.lineTo(0.12, 0.75); shape.bezierCurveTo(0.32, 0.50, 0.22, 0.22, 0.26, 0); shape.closePath();
      const head = mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.17, bevelEnabled: true, bevelSegments: 3, steps: 1, bevelSize: 0.035, bevelThickness: 0.035, curveSegments: 16 }), mat, group, 0, 0.55, -0.085);
      head.rotation.y = light ? -Math.PI / 2 : Math.PI / 2;
      // Mắt ngựa chạm nổi hai bên, không dùng ảnh ngoài.
      const eyeMat = light ? ebony : ivory;
      for (const side of [-1, 1]) {
        const eye = mesh(new THREE.SphereGeometry(0.023, 10, 8), eyeMat, head, -0.115, 0.57, side < 0 ? -0.038 : 0.208);
        eye.scale.z = 0.4; eye.userData.role = 'accent';
      }
    } else if (type === 'r') {
      lathe([[0, 0.59], [0.19, 0.59], [0.22, 0.65], [0.23, 0.91], [0.27, 0.95], [0.27, 1.04], [0, 1.04]], mat, group);
      for (let i = 0; i < 6; i++) {
        const a = i * Math.PI / 3;
        const tooth = mesh(new THREE.BoxGeometry(0.15, 0.14, 0.14), mat, group, Math.cos(a) * 0.2, 1.08, Math.sin(a) * 0.2); tooth.rotation.y = -a;
      }
    } else if (type === 'b') {
      lathe([[0, 0.60], [0.13, 0.60], [0.18, 0.70], [0.19, 0.80], [0.13, 0.94], [0.04, 1.08], [0, 1.10]], mat, group);
      mesh(new THREE.SphereGeometry(0.045, 16, 10), mat, group, 0, 1.13);
      const cut = mesh(new THREE.BoxGeometry(0.025, 0.20, 0.015), light ? wood : brass, group, 0.07, 0.96, 0.115); cut.rotation.z = -0.45;
      cut.userData.role = 'accent';
    } else {
      lathe([[0, 0.61], [0.17, 0.61], [0.12, 0.72], [0.105, 0.86], [0.19, 0.90], [0.22, 0.96], [0.20, 1.01], [0, 1.01]], mat, group);
      if (type === 'q') {
        for (let i = 0; i < 8; i++) {
          const a = i * Math.PI / 4, x = Math.cos(a) * 0.18, z = Math.sin(a) * 0.18;
          const tip = mesh(new THREE.ConeGeometry(0.06, 0.19, 12), mat, group, x, 1.08, z);
          tip.rotation.z = -Math.cos(a) * 0.3; tip.rotation.x = Math.sin(a) * 0.3;
          mesh(new THREE.SphereGeometry(0.045, 12, 8), mat, group, x * 1.15, 1.18, z * 1.15);
        }
        mesh(new THREE.SphereGeometry(0.07, 16, 12), mat, group, 0, 1.12);
      } else {
        mesh(new THREE.SphereGeometry(0.115, 20, 12), mat, group, 0, 1.08);
        mesh(new THREE.BoxGeometry(0.065, 0.31, 0.065), mat, group, 0, 1.29);
        mesh(new THREE.BoxGeometry(0.23, 0.065, 0.065), mat, group, 0, 1.33);
      }
      group.scale.y = 1.07;
    }
    return group;
  }

  function diskPiece(ch) {
    const group = new THREE.Group(), red = ch === ch.toUpperCase(), t = ch.toLowerCase();
    lathe([[0, 0.02], [0.35, 0.02], [0.40, 0.05], [0.425, 0.10], [0.425, 0.23], [0.40, 0.28], [0, 0.28]], diskWood, group);
    const ink = red ? '#992e24' : '#302a20';
    const map = diskFaceTexture(ch, { ring: ink, ink, shade: '#fff1c8' });
    const face = mesh(new THREE.PlaneGeometry(0.80, 0.80), material('#ffffff', 0.42, { map, transparent: true, depthWrite: false }), group, 0, 0.285);
    face.rotation.x = -Math.PI / 2; face.castShadow = false; face.userData.role = 'face';
    return group;
  }
  // Mặt chữ quân tròn. Quân úp (X/x) chỉ có hoa văn lưng, giống hệt nhau, không mang danh tính nào.
  function diskFaceTexture(ch, colors, own = keep) {
    const red = ch === ch.toUpperCase(), t = ch.toLowerCase();
    return texture(256, 256, ctx => {
      ctx.clearRect(0, 0, 256, 256); ctx.strokeStyle = colors.ring; ctx.lineWidth = 3;
      for (const r of [110, 99]) { ctx.beginPath(); ctx.arc(128, 128, r, 0, Math.PI * 2); ctx.stroke(); }
      if (t === 'x') {
        ctx.lineWidth = 2; ctx.beginPath();
        for (let i = 0; i <= 16; i++) {
          const a = i * Math.PI / 8, r = i % 2 ? 28 : 57;
          if (!i) ctx.moveTo(128 + Math.cos(a) * r, 128 + Math.sin(a) * r); else ctx.lineTo(128 + Math.cos(a) * r, 128 + Math.sin(a) * r);
        }
        ctx.stroke(); return;
      }
      const word = state.vi ? VIET[t] : HAN[t] && HAN[t][red ? 0 : 1];
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = 'bold ' + (state.vi ? (word && word.length > 4 ? 43 : 55) : 125) + 'px "SimSun", "Times New Roman", serif';
      ctx.fillStyle = colors.shade; ctx.fillText(word || '?', 129, 136);
      ctx.fillStyle = colors.ink; ctx.fillText(word || '?', 128, 133);
    }, own);
  }

  /* ---- Skin quân: mỗi bên một bộ vật liệu theo KydaoSkins.PIECES[id][side]; hình nhận diện giữ nguyên (K5). ---- */
  const sideOf = ch => (layout.stones ? ch : ch === ch.toUpperCase() ? 'a' : 'b');
  const skinKey = id => (id ? (layout.stones ? 's:' + id : id) : null);
  function pieceSkinOf(ch) {
    if (!ch) return null;
    const id = skins[sideOf(ch)].pieces;
    return id ? (layout.stones ? stoneSkin(id) : pieceSkin(id)) : null;
  }
  /* ---- Skin đá cờ vây/caro (T-143): vật liệu theo KydaoSkins.STONES[id][side]; có ảnh atlas thì phủ mặt trên bằng chỏm cầu. ---- */
  function stoneSkin(id) {
    const key = 's:' + id;
    if (pieceSkins.has(key)) return pieceSkins.get(key);
    const def = catalog && typeof catalog.stones === 'function' && catalog.stones(id);
    if (!def) return null;
    const s = { id, key, def, stone: true, res: new Set(), mats: {}, cap: {}, templateIds: new Set(), model: null, img: false };
    const own = r => { s.res.add(r); return r; };
    for (const side of ['a', 'b']) {
      const c = def[side];
      const stone = own(new THREE.MeshStandardMaterial({ color: c.base, roughness: 0.25, metalness: 0.05,
        emissive: c.glow || '#000000', emissiveIntensity: c.glow ? 0.18 : 0 }));
      const mark = own(new THREE.MeshStandardMaterial({ color: c.mark, roughness: 0.4, metalness: 0.05 }));
      s.mats[side] = { stone, mark, own };
    }
    pieceSkins.set(key, s);
    loadStoneImage(s);
    return s;
  }
  function loadStoneImage(s) {
    if (!fieldImages || !catalog || typeof catalog.stonesAtlas !== 'function') return;
    let url = null;
    try { url = catalog.stonesAtlas(s.id); } catch (e) { url = null; }
    if (!url) return;
    imageApi().then(api => (api && typeof api.loadImage === 'function' ? api.loadImage(url) : null)).then(img => {
      if (!img || stopped || pieceSkins.get(s.key) !== s) return;
      const k = 0.62; // phần giữa của ô 128 px phủ vừa chỏm đá
      for (const side of ['a', 'b']) {
        const tex = s.mats[side].own(new THREE.Texture(img)); tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
        tex.repeat.set(0.5 * k, k); tex.offset.set((side === 'a' ? 0 : 0.5) + 0.25 * (1 - k), (1 - k) / 2); tex.needsUpdate = true;
        const c = s.def[side];
        s.cap[side] = s.mats[side].own(new THREE.MeshStandardMaterial({ color: '#ffffff', map: tex, roughness: 0.25, metalness: 0.05,
          emissive: c.glow || '#000000', emissiveIntensity: c.glow ? 0.18 : 0 }));
      }
      s.img = true;
      for (const id of s.templateIds) templates.delete(id);
      s.templateIds.clear();
      refreshVisuals(); requestRender();
    }).catch(() => {});
  }
  // Chỏm cầu cùng dáng viên đá, UV chiếu thẳng từ trên xuống (ô ảnh nhìn từ trên xuống).
  const stoneCapGeometry = () => sharedGeo('stonecap', () => {
    const R = 0.432, rim = 0.78, g = new THREE.SphereGeometry(R, 28, 6, 0, Math.PI * 2, 0, rim), p = g.attributes.position, uv = g.attributes.uv, span = 2 * R * Math.sin(rim);
    for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / span + 0.5, -p.getZ(i) / span + 0.5);
    uv.needsUpdate = true; return g;
  });
  function stoneTemplate(s, ch) {
    const g = new THREE.Group(), m = s.mats[ch];
    const body = mesh(sharedGeo('stone', () => new THREE.SphereGeometry(0.43, 28, 16)), m.stone, g, 0, 0.14); body.scale.y = 0.34;
    if (s.cap[ch]) { const cap = mesh(stoneCapGeometry(), s.cap[ch], g, 0, 0.14); cap.scale.y = 0.34; cap.castShadow = false; }
    if (layout.game === 'gomoku') {
      if (ch === 'a') for (const angle of [-Math.PI / 4, Math.PI / 4]) {
        const mark = mesh(sharedGeo('stone-x', () => new THREE.BoxGeometry(0.40, 0.008, 0.045)), m.mark, g, 0, 0.291); mark.rotation.y = angle;
      } else { const o = mesh(sharedGeo('stone-o', () => new THREE.TorusGeometry(0.17, 0.022, 8, 40)), m.mark, g, 0, 0.291); o.rotation.x = Math.PI / 2; }
    }
    return g;
  }
  function pieceSkin(id) {
    if (pieceSkins.has(id)) return pieceSkins.get(id);
    const def = catalog && catalog.pieces(id);
    if (!def) return null;
    const s = { id, def, res: new Set(), mats: {}, faces: new Map(), templateIds: new Set(), model: null };
    const own = r => { s.res.add(r); return r; };
    for (const side of ['a', 'b']) {
      const c = def[side], rough = Number.isFinite(def.rough) ? def.rough : 0.4, metal = Number.isFinite(def.metal) ? def.metal : 0;
      const base = own(new THREE.MeshStandardMaterial({ color: c.base, roughness: rough, metalness: metal, map: rough > 0.25 ? grain : null,
        emissive: c.glow || '#000000', emissiveIntensity: c.glow ? 0.08 : 0 }));
      const accent = own(new THREE.MeshStandardMaterial({ color: c.accent, roughness: rough * 0.7, metalness: Math.max(metal, 0.25),
        emissive: c.glow || '#000000', emissiveIntensity: c.glow ? 0.45 : 0 }));
      const glow = c.glow ? own(new THREE.MeshStandardMaterial({ color: c.glow, roughness: 0.3, emissive: c.glow, emissiveIntensity: 1.2 })) : accent;
      s.mats[side] = { base, accent, glow, own };
    }
    pieceSkins.set(id, s);
    loadPiecesModel(s);
    return s;
  }
  function faceMaterial(s, ch, side) {
    const key = ch + ':' + !!state.vi;
    if (!s.faces.has(key)) {
      const c = s.def[side], ink = readableInk(c.base, c.accent), own = s.mats[side].own;
      const map = diskFaceTexture(ch, { ring: readableInk(c.base, c.accent, 3), ink, shade: luminance(ink) < 0.4 ? 'rgba(255,255,255,.5)' : 'rgba(0,0,0,.45)' }, own);
      s.faces.set(key, own(new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.42, map, transparent: true, depthWrite: false })));
    }
    return s.faces.get(key);
  }
  function reskin(source, s, side, ch) {
    const g = source.clone(true), m = s.mats[side];
    g.traverse(o => {
      if (!o.isMesh) return;
      o.material = o.userData.role === 'face' ? faceMaterial(s, ch, side) : o.userData.role === 'accent' ? m.accent : m.base;
    });
    return g;
  }
  // Quân từ .glb: nút K,Q,R,B,N,P (cờ vua) hoặc disc (cờ tướng/úp). Vật liệu chỉ dùng TÊN để phân vai.
  function modelPiece(s, ch, side) {
    const part = s.model.parts[layout.chess ? ch.toUpperCase() : 'disc'];
    if (!part) return null;
    const inner = part.clone(true), m = s.mats[side];
    inner.traverse(o => {
      if (!o.isMesh) return;
      const name = ((o.material && o.material.name) || '') + ' ' + (o.name || '');
      o.material = /glow/i.test(name) ? m.glow : /accent/i.test(name) ? m.accent : m.base;
      o.castShadow = true; o.receiveShadow = true;
    });
    if (side === 'a') inner.rotation.y = Math.PI; // mô hình nhìn về +Z; quân bên a đứng ở +Z nên quay lại nhìn đối thủ
    const g = new THREE.Group(); g.add(inner);
    if (!layout.chess) {
      const size = Math.min(0.8, part.userData.radius * 2 * 0.94);
      const face = new THREE.Mesh(faceGeometry(), faceMaterial(s, ch, side));
      face.scale.set(size / 0.8, size / 0.8, 1); face.rotation.x = -Math.PI / 2; face.position.y = part.userData.top + 0.004;
      face.userData.role = 'face'; g.add(face);
    }
    return g;
  }
  let faceGeo = null;
  const faceGeometry = () => faceGeo || (faceGeo = keep(new THREE.PlaneGeometry(0.80, 0.80)));
  function fitPart(api, node, s) {
    const inst = api.instantiate(node, { materials: false });
    for (const r of inst.resources) s.res.add(r);
    const g = inst.root; g.position.set(0, 0, 0); g.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(g);
    if (box.isEmpty()) return null;
    const size = box.getSize(new THREE.Vector3());
    const k = Math.min(1, 1.6 / Math.max(size.y, 1e-6), 0.9 / Math.max(size.x, size.z, 1e-6));
    if (k < 1) { g.scale.multiplyScalar(k); g.updateMatrixWorld(true); box.setFromObject(g); box.getSize(size); }
    const c = box.getCenter(new THREE.Vector3());
    g.position.set(-c.x, -box.min.y, -c.z);
    const wrap = new THREE.Group(); wrap.add(g);
    wrap.userData.top = size.y; wrap.userData.radius = Math.max(size.x, size.z) / 2;
    return wrap;
  }
  function imageApi() {
    if (!assetsPromise) assetsPromise = assets ? Promise.resolve(assets) : import('/js/world3d/board-assets.mjs?v=2').catch(() => null);
    return assetsPromise;
  }
  function assetApi() { return models ? imageApi() : Promise.resolve(null); }
  function loadAsset(url) {
    if (!url) return Promise.resolve(null);
    return assetApi().then(api => (api && typeof api.loadModel === 'function' && typeof api.instantiate === 'function'
      ? Promise.resolve(api.loadModel(url)).then(root => (root ? { api, root } : null)) : null)).catch(() => null);
  }
  function loadPiecesModel(s) {
    loadAsset(catalog.piecesModel && catalog.piecesModel(s.id)).then(got => {
      if (!got || stopped || pieceSkins.get(s.id) !== s) return;
      const parts = {};
      for (const name of ['K', 'Q', 'R', 'B', 'N', 'P', 'disc']) {
        const node = got.root.getObjectByName(name);
        if (node) { const part = fitPart(got.api, node, s); if (part) parts[name] = part; }
      }
      if (!Object.keys(parts).length) return;
      s.model = { parts };
      for (const id of s.templateIds) templates.delete(id);
      s.templateIds.clear();
      refreshVisuals(); requestRender();
    }).catch(() => {});
  }
  function pruneSkins() {
    const used = new Set([skinKey(skins.a.pieces), skinKey(skins.b.pieces)]);
    for (const [id, s] of pieceSkins) if (!used.has(id)) {
      for (const tid of s.templateIds) templates.delete(tid);
      for (const r of s.res) r.dispose();
      s.res.clear(); pieceSkins.delete(id);
    }
  }
  function visualId(ch) {
    const s = pieceSkinOf(ch);
    return layout.game + ':' + ch + ':' + !!state.vi + ':' + (s ? s.id + (s.model ? '+m' : '') + (s.img ? '+i' : '') : '');
  }

  function template(ch) {
    const id = visualId(ch);
    if (!templates.has(id)) {
      const s = pieceSkinOf(ch);
      if (s) {
        const side = sideOf(ch);
        templates.set(id, s.stone ? stoneTemplate(s, ch) : (s.model && modelPiece(s, ch, side)) || reskin(baseTemplate(ch), s, side, ch));
        s.templateIds.add(id);
      } else baseTemplate(ch);
    }
    return { id, group: templates.get(id).clone(true) };
  }
  function baseTemplate(ch) {
    const id = layout.game + ':' + ch + ':' + !!state.vi + ':';
    if (!templates.has(id)) {
      let g;
      if (layout.stones) {
        g = new THREE.Group();
        const m = mesh(new THREE.SphereGeometry(0.43, 28, 16), ch === 'a' ? ebony : ivory, g, 0, 0.14); m.scale.y = 0.34;
        if (layout.game === 'gomoku') {
          const mat = ch === 'a' ? ivory : ebony;
          if (ch === 'a') for (const angle of [-Math.PI / 4, Math.PI / 4]) {
            const mark = mesh(new THREE.BoxGeometry(0.40, 0.008, 0.045), mat, g, 0, 0.289); mark.rotation.y = angle;
          }
          else ring(g, 0.17, 0.289, mat, 0.022);
        }
      } else g = layout.chess ? chessPiece(ch) : diskPiece(ch);
      templates.set(id, g);
    }
    return templates.get(id);
  }
  const targetAt = index => new THREE.Vector3(index % layout.cols - (layout.cols - 1) / 2, 0.015, (layout.rows - 1) / 2 - Math.floor(index / layout.cols));
  function visual(ch, old) {
    const id = visualId(ch);
    if (old && old.id === id) return old;
    const v = template(ch), record = { ...v, ch, target: old ? old.target.clone() : new THREE.Vector3(), from: old ? old.from.clone() : new THREE.Vector3(), started: old ? old.started : 0 };
    if (old) {
      record.group.position.copy(old.group.position);
      if (old.ch === ch) record.group.scale.copy(old.group.scale);
      board.remove(old.group);
    }
    board.add(record.group); return record;
  }
  function travel(record, target, animate) {
    record.from.copy(record.group.position); record.target.copy(target);
    record.started = animate && !calm() ? performance.now() : 0;
    if (!record.started) record.group.position.copy(target);
  }
  // Chỗ xếp quân bị ăn ở mép bàn; có dải cảnh (ảnh sân v2) thì lùi ra ngoài dải đó.
  const capturedSpot = (side, slot) => new THREE.Vector3(
    (layout.cols / 2 + 0.95 + sceneMargin + Math.floor(slot / layout.rows) * 0.65) * (side ? -1 : 1), -0.18, (slot % layout.rows) * 0.65 - (layout.rows - 1) * 0.325);
  function relayoutCaptured() {
    const count = { true: 0, false: 0 };
    for (const record of captured) {
      const side = layout.stones ? record.ch === 'a' : record.ch === record.ch.toUpperCase();
      travel(record, capturedSpot(side, count[side]++), true);
    }
  }
  const markGeometry = keep(new THREE.PlaneGeometry(0.92, 0.92));
  const dotGeometry = keep(new THREE.CircleGeometry(0.12, 24));
  const captureGeometry = keep(new THREE.RingGeometry(0.43, 0.49, 40));
  const markMats = ['#e4b94d', '#5eae76', '#c43d30', '#33714d'].map(color => material(color, 0.7, { transparent: true, opacity: 0.58, depthWrite: false }));
  function updateMarks() {
    markers.clear();
    const add = (name, kind) => {
      const index = squareIndex(layout, name); if (index < 0) return;
      const occupied = kind === 3 && !!previous[index];
      const m = new THREE.Mesh(kind === 3 ? (occupied ? captureGeometry : dotGeometry) : markGeometry, markMats[occupied ? 2 : kind]);
      m.rotation.x = -Math.PI / 2; m.position.copy(targetAt(index)); m.position.y = 0.022 + kind * 0.002; markers.add(m);
    };
    (state.last || []).forEach(n => add(n, 0)); add(state.selected, 1); add(state.checkSq, 2);
    (state.targets || []).forEach(n => add(n, 3));
  }

  /* ---- Skin nửa sân: phủ mặt bàn + thành gỗ của nửa đó theo palette, thêm đồ trang trí (.glb nếu có, không thì dựng bằng mã).
   * Lớp phủ nằm ở y≈0,0045, dưới mọi dấu nước đi (≥ 0,022) nên dấu luôn nổi trên skin. */
  function halfSpan(side) {
    const { w, d } = boardSize(layout), m = layout.chess ? 0 : 0.46; // cờ tướng: chừa dòng sông, lấn 0,04 để giữ trọn nét bờ sông
    return { w, d, m, L: d / 2 - m, sign: side === 'a' ? 1 : -1, z0: side === 'a' ? m : -d / 2 };
  }
  function paintPattern(ctx, fx, t, span) {
    const R = i => hash01(i + 977), W = span.w, x0 = -W / 2, z0 = span.z0, Z = span.L;
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const color = fx === 'ember' || fx === 'spark' ? t.glow : t.line;
    ctx.strokeStyle = color; ctx.fillStyle = color;
    const blob = (n, rx, rz, alpha, fill) => {
      ctx.globalAlpha = alpha;
      for (let i = 0; i < n; i++) {
        ctx.beginPath();
        ctx.ellipse(x0 + R(i) * W, z0 + R(i + 300) * Z, rx * (0.5 + R(i + 600)), rz * (0.5 + R(i + 600)), R(i + 900) * Math.PI, 0, Math.PI * 2);
        if (fill) ctx.fill(); else ctx.stroke();
      }
    };
    if (fx === 'ember' || fx === 'spark') {
      ctx.globalAlpha = fx === 'ember' ? 0.22 : 0.26; ctx.lineWidth = 0.022;
      for (let i = 0; i < (fx === 'ember' ? 16 : 9); i++) {
        let x = x0 + R(i) * W, z = z0 + R(i + 40) * Z;
        ctx.beginPath(); ctx.moveTo(x, z);
        for (let k = 0; k < 5; k++) {
          x += (R(i * 7 + k + 80) - 0.5) * (fx === 'spark' ? 0.9 : 0.6); z += fx === 'spark' ? 0.18 + R(i * 11 + k) * 0.2 : (R(i * 11 + k) - 0.5) * 0.6;
          ctx.lineTo(x, z);
        }
        ctx.stroke();
      }
    } else if (fx === 'ripple' || fx === 'sand') {
      ctx.globalAlpha = 0.16; ctx.lineWidth = fx === 'sand' ? 0.02 : 0.016;
      for (let z = z0 + 0.2; z < z0 + Z; z += fx === 'sand' ? 0.55 : 0.38) {
        ctx.beginPath();
        for (let x = x0; x <= x0 + W + 0.01; x += 0.2) {
          const y = z + Math.sin(x * (fx === 'sand' ? 0.9 : 2.6) + z * 3) * (fx === 'sand' ? 0.16 : 0.06);
          if (x === x0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    } else if (fx === 'leaf') blob(40, 0.12, 0.05, 0.16, true);
    else if (fx === 'petal') blob(30, 0.1, 0.045, 0.15, true);
    else if (fx === 'snow') blob(90, 0.03, 0.03, 0.3, true);
    else if (fx === 'bubble') { ctx.lineWidth = 0.015; blob(34, 0.09, 0.09, 0.2, false); }
    ctx.restore();
  }
  function buildHalf(side, id) {
    const def = catalog && catalog.field(id);
    if (!def || layout.stones) return null;
    const span = halfSpan(side), { w, d, L, sign } = span, tones = fieldTones(def.palette, layout.chess);
    const res = new Set(), own = r => { res.add(r); return r; };
    const map = texture(1024, Math.max(64, Math.round(1024 * L / w)), (ctx, tw, th) => {
      ctx.scale(tw / w, th / L); ctx.translate(w / 2, -span.z0);
      paintFace(ctx, w, d, {
        ground: tones.frame, light: tones.light, dark: tones.dark, vein: rgba(tones.vein, 0.1), line: tones.line, text: tones.line,
        frameOuter: tones.glow, frameInner: tones.rim, label: tones.line, river: false
      }, c => paintPattern(c, def.fx, tones, span));
    }, own);
    const group = new THREE.Group(); group.name = 'kd-half-' + side;
    // Trục co giãn đặt ở mép người chơi: scale.z = tiến độ khai mở, nên nửa sân "mọc" từ mép ra giữa bàn.
    const pivot = new THREE.Group(); pivot.position.z = sign * d / 2; group.add(pivot);
    const overlay = own(new THREE.MeshStandardMaterial({ map, roughness: 0.5, metalness: 0.02, emissive: tones.glow, emissiveIntensity: 0 }));
    const plane = new THREE.Mesh(own(new THREE.PlaneGeometry(w, L)), overlay);
    plane.rotation.x = -Math.PI / 2; plane.position.set(0, 0.0045, -sign * L / 2); plane.receiveShadow = true; pivot.add(plane);
    const E = (d + 0.27) / 2, rimPivot = new THREE.Group(); rimPivot.position.z = sign * E; group.add(rimPivot);
    const rimMat = own(new THREE.MeshStandardMaterial({ color: tones.rim, roughness: 0.5, metalness: 0.15, emissive: tones.glow, emissiveIntensity: 0 }));
    const rimBox = new THREE.Mesh(own(new THREE.BoxGeometry(w + 0.27, 0.335, E)), rimMat);
    rimBox.position.set(0, -0.22, -sign * E / 2); rimBox.castShadow = true; rimBox.receiveShadow = true; rimPivot.add(rimBox);
    const decor = new THREE.Group(); group.add(decor);
    const h = { id, side, def, tones, group, pivot, rimPivot, map, overlay, rimMat, decor, res, decorRes: new Set(), progress: 1, v2: null, dead: false };
    buildDecor(h);
    board.add(group);
    // Thử ảnh v2 trước; chỉ khi không có/lỗi mới nạp .glb nửa sân (không tải cả hai). Đồ trang trí dựng bằng mã vẫn hiện trong lúc chờ.
    loadFieldImage(h).then(ok => { if (!ok && !stopped && !h.dead && halves[h.side] === h) loadFieldModel(h); });
    return h;
  }
  // Đồ trang trí rẻ dựng bằng mã theo `fx` của sân (vài chục tam giác mỗi món), dùng khi chưa có .glb.
  function buildDecor(h) {
    const t = h.tones, own = r => { h.decorRes.add(r); return r; };
    const G = {}, M = {};
    const geo = (name, make) => G[name] || (G[name] = own(make()));
    const mat = (name, color, roughness, extra) => M[name] || (M[name] = own(new THREE.MeshStandardMaterial({ color, roughness, ...extra })));
    const lit = (name, color, k) => mat(name, color, 0.4, { emissive: color, emissiveIntensity: k });
    const put = (item, g, m, x, y, z, sx = 1, sy = 1, sz = 1) => {
      const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.scale.set(sx, sy, sz);
      o.castShadow = true; o.receiveShadow = true; item.add(o); return o;
    };
    for (const a of decorAnchors(layout, h.side)) {
      const item = new THREE.Group(); item.position.set(a.x, -0.5, a.z); item.rotation.y = a.turn; item.userData = { f: a.f, s: a.s };
      switch (h.def.fx) {
        case 'ripple':
          put(item, geo('pool', () => new THREE.CylinderGeometry(0.5, 0.56, 0.1, 20)), mat('water', t.dark, 0.12, { metalness: 0.2, transparent: true, opacity: 0.9 }), 0, 0.05, 0);
          put(item, geo('wave', () => new THREE.TorusGeometry(0.4, 0.025, 6, 28)), lit('crest', t.line, 0.5), 0, 0.11, 0).rotation.x = Math.PI / 2;
          put(item, geo('stone', () => new THREE.DodecahedronGeometry(0.14)), mat('rock', t.rim, 0.85), 0.3, 0.12, 0.12);
          break;
        case 'leaf':
          put(item, geo('trunk', () => new THREE.CylinderGeometry(0.05, 0.07, 0.32, 6)), mat('bark', '#5b3b22', 0.9), 0, 0.16, 0);
          put(item, geo('crown', () => new THREE.ConeGeometry(0.32, 0.6, 7)), mat('leaf', t.dark, 0.8), 0, 0.55, 0);
          put(item, geo('crown2', () => new THREE.ConeGeometry(0.24, 0.45, 7)), mat('leaf2', t.light, 0.8), 0, 0.85, 0);
          break;
        case 'snow':
          put(item, geo('ice', () => new THREE.OctahedronGeometry(0.26)), mat('ice', t.light, 0.08, { emissive: t.glow, emissiveIntensity: 0.25, transparent: true, opacity: 0.88 }), 0, 0.5, 0, 1, 2, 1);
          put(item, geo('ice', null), mat('ice'), 0.26, 0.3, 0.08, 0.6, 1.3, 0.6);
          put(item, geo('drift', () => new THREE.CylinderGeometry(0.36, 0.42, 0.08, 12)), mat('drift', '#f4fbff', 0.6), 0, 0.04, 0);
          break;
        case 'bubble':
          put(item, geo('reef', () => new THREE.DodecahedronGeometry(0.3)), mat('reef', t.rim, 0.8), 0, 0.18, 0, 1, 0.6, 1);
          put(item, geo('coral', () => new THREE.ConeGeometry(0.06, 0.5, 5)), lit('coral', t.glow, 0.35), -0.18, 0.4, 0.1);
          for (const [x, y, z, s] of [[0.1, 0.55, 0, 0.8], [-0.05, 0.78, 0.05, 1], [0.06, 0.98, -0.03, 0.7]]) {
            put(item, geo('pearl', () => new THREE.SphereGeometry(0.07, 10, 8)), mat('pearl', t.light, 0.05, { transparent: true, opacity: 0.6, emissive: t.glow, emissiveIntensity: 0.3 }), x, y, z, s, s, s);
          }
          break;
        case 'petal':
          put(item, geo('pad', () => new THREE.CylinderGeometry(0.42, 0.42, 0.03, 18)), mat('pad', '#3f7d4c', 0.7), 0, 0.02, 0);
          for (let i = 0; i < 6; i++) {
            const an = i * Math.PI / 3;
            put(item, geo('petal', () => new THREE.SphereGeometry(0.17, 10, 6)), mat('petal', t.dark, 0.6), Math.cos(an) * 0.17, 0.12, Math.sin(an) * 0.17, 1, 0.38, 0.5).rotation.y = -an;
          }
          put(item, geo('seed', () => new THREE.SphereGeometry(0.08, 10, 8)), lit('seed', t.glow, 0.9), 0, 0.18, 0);
          break;
        case 'spark':
          for (const [x, y, z, s] of [[0, 0.75, 0, 1], [0.22, 0.7, 0.05, 0.8], [-0.2, 0.72, -0.03, 0.85]]) {
            put(item, geo('cloud', () => new THREE.SphereGeometry(0.24, 10, 8)), mat('cloud', mixColor(t.light, t.dark, 0.5), 0.9), x, y, z, s, s * 0.8, s);
          }
          put(item, geo('bolt', () => new THREE.BoxGeometry(0.05, 0.42, 0.05)), lit('bolt', t.glow, 1.8), 0, 0.38, 0).rotation.z = 0.35;
          break;
        case 'sand':
          put(item, geo('dune', () => new THREE.SphereGeometry(0.55, 14, 8)), mat('dune', t.dark, 0.95), 0, 0, 0, 1.3, 0.32, 0.8);
          put(item, geo('stone', () => new THREE.DodecahedronGeometry(0.16)), mat('rock', t.rim, 0.9), 0.35, 0.08, 0.1);
          break;
        default: // ember: đá núi lửa có than hồng
          put(item, geo('rock', () => new THREE.ConeGeometry(0.34, 0.85, 6)), mat('rock', t.rim, 0.9), 0, 0.42, 0);
          put(item, geo('rock2', () => new THREE.ConeGeometry(0.2, 0.5, 5)), mat('rock'), 0.28, 0.25, 0.1);
          put(item, geo('ember', () => new THREE.SphereGeometry(0.075, 8, 6)), lit('ember', t.glow, 1.8), 0, 0.86, 0);
          put(item, geo('ember'), lit('ember'), 0.28, 0.5, 0.1, 0.7, 0.7, 0.7);
      }
      h.decor.add(item);
    }
  }
  /* ---- T-125 · Ảnh sân v2: mặt phẳng ảnh phủ nửa bàn + dải cảnh; thay lớp phủ palette, đồ trang trí và thành gỗ của nửa đó.
   * Ảnh nạp qua board-assets (dùng chung, nhớ cả kết quả thiếu); mỗi bàn tự bọc thành THREE.Texture riêng và dispose cùng nửa sân. ---- */
  function loadFieldImage(h) {
    // Trả Promise<boolean>: true khi ảnh v2 đã gắn (không cần .glb nửa sân).
    if (!fieldImages || !catalog || typeof catalog.fieldImage2 !== 'function') return Promise.resolve(false);
    let url = null;
    try { url = catalog.fieldImage2(h.id, game); } catch (e) { url = null; }
    if (!url) return Promise.resolve(false);
    return imageApi().then(api => (api && typeof api.loadImage === 'function' ? api.loadImage(url) : null)).then(img => {
      if (!img || stopped || h.dead || h.v2 || halves[h.side] !== h) return false;
      attachFieldImage(h, img);
      return !!h.v2;
    }).catch(() => false);
  }
  // Nét lưới cờ tướng của một nửa, vẽ trong toạ độ bàn (x, z) rồi ánh xạ sang ảnh của mặt phẳng.
  function paintHalfGrid(ctx, tw, th, h, fp) {
    const k = h.tones, x = c => c - (layout.cols - 1) / 2, z = r => (layout.rows - 1) / 2 - r;
    const r0 = h.side === 'a' ? 0 : 5, r1 = h.side === 'a' ? 4 : 9, paths = [];
    for (let r = r0; r <= r1; r++) paths.push([[x(0), z(r)], [x(layout.cols - 1), z(r)]]);
    for (let c = 0; c < layout.cols; c++) paths.push([[x(c), z(r0)], [x(c), z(r1)]]);
    const p = h.side === 'a' ? 0 : 7;
    paths.push([[x(3), z(p)], [x(5), z(p + 2)]], [[x(5), z(p)], [x(3), z(p + 2)]]);
    const marks = [];
    for (const r of h.side === 'a' ? [2, 3] : [6, 7]) for (const c of (r === 2 || r === 7 ? [1, 7] : [0, 2, 4, 6, 8])) {
      for (const dx of [-1, 1]) for (const dz of [-1, 1]) {
        if (c + dx < 0 || c + dx > 8) continue;
        marks.push([[x(c) + dx * 0.22, z(r) + dz * 0.09], [x(c) + dx * 0.09, z(r) + dz * 0.09], [x(c) + dx * 0.09, z(r) + dz * 0.22]]);
      }
    }
    ctx.save();
    ctx.scale(tw / fp.w, th / fp.d); ctx.translate(fp.w / 2, fp.d / 2);
    if (fp.sign < 0) ctx.scale(-1, -1);
    ctx.translate(0, -fp.z);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    // Viền tương phản (đen nếu nét sáng, sáng nếu nét tối) để lưới đọc được trên mọi cảnh.
    const halo = contrastRatio(k.line, '#000000') >= contrastRatio(k.line, '#ffffff') ? 'rgba(0,0,0,0.6)' : 'rgba(255,246,220,0.6)';
    for (const [color, wide, thin] of [[halo, 0.085, 0.05], [k.line, 0.04, 0.024]]) {
      ctx.strokeStyle = color;
      for (const [list, width] of [[paths, wide], [marks, thin]]) {
        ctx.lineWidth = width;
        for (const pts of list) { ctx.beginPath(); pts.forEach(([px, pz], i) => (i ? ctx.lineTo(px, pz) : ctx.moveTo(px, pz))); ctx.stroke(); }
      }
    }
    ctx.restore();
  }
  function attachFieldImage(h, img) {
    const fp = fieldPlane(game, h.side);
    if (!fp) return;
    const own = r => { h.res.add(r); return r; };
    const tex = own(new THREE.Texture(img)); tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy()); tex.needsUpdate = true;
    // Trục co giãn đặt ở mép NGOÀI (phía người chơi): khai mở lộ dần từ đó ra giữa bàn.
    const pivot = new THREE.Group(); pivot.position.z = fp.sign * (Math.abs(fp.near) + fp.d);
    const geometry = sharedGeo('v2plane:' + fp.w + 'x' + fp.d, () => new THREE.PlaneGeometry(fp.w, fp.d));
    const plane = new THREE.Mesh(geometry, own(new THREE.MeshStandardMaterial({ map: tex, roughness: 0.92, metalness: 0 })));
    plane.name = 'kd-field-image-' + h.side;
    plane.rotation.set(-Math.PI / 2, 0, fp.rotY); plane.position.set(fp.x, 0.0045, -fp.sign * fp.d / 2);
    plane.receiveShadow = true; pivot.add(plane);
    // Bệ gỗ dưới mặt phẳng: dải cảnh nhô ra khỏi thành bàn không lơ lửng.
    const skirt = new THREE.Mesh(own(new THREE.BoxGeometry(fp.w, 0.3, fp.d)), own(new THREE.MeshStandardMaterial({ color: h.tones.rim, roughness: 0.6 })));
    skirt.position.set(fp.x, -0.215, -fp.sign * fp.d / 2); skirt.receiveShadow = true; pivot.add(skirt);
    const v2 = { pivot, tex, gridTex: null };
    if (!layout.chess) {
      v2.gridTex = texture(1536, Math.round(1536 * fp.d / fp.w), (ctx, tw, th) => paintHalfGrid(ctx, tw, th, h, fp), own);
      const grid = new THREE.Mesh(geometry, own(new THREE.MeshBasicMaterial({ map: v2.gridTex, transparent: true, depthWrite: false })));
      grid.name = 'kd-field-grid-' + h.side; grid.renderOrder = 1;
      grid.rotation.copy(plane.rotation); grid.position.set(fp.x, 0.0055, plane.position.z); pivot.add(grid);
    }
    h.group.add(pivot); h.v2 = v2;
    h.pivot.visible = false; h.rimPivot.visible = false; h.decor.visible = false; // ảnh đã có sẵn cảnh vật
    setProgress(h, h.progress);
    syncScene(); requestRender();
  }
  // Có ảnh v2 ở ít nhất một nửa: nới máy quay và chỗ xếp quân bị ăn cho vừa dải cảnh; chữ toạ độ cờ vua vẽ lại trên ảnh.
  function syncScene() {
    const has = side => !!(halves[side] && halves[side].v2);
    const next = has('a') || has('b') ? FIELD_MARGIN : 0;
    if (next !== sceneMargin) { sceneMargin = next; relayoutCaptured(); orbit(); }
    if (labels) { board.remove(labels.mesh); for (const r of [labels.mesh.material.map, labels.mesh.material, labels.mesh.geometry]) { resources.delete(r); r.dispose(); } labels = null; }
    if (!layout.chess || !next) return;
    const { w, d } = boardSize(layout), map = texture(1024, Math.round(1024 * d / w), (ctx, tw, th) => {
      ctx.scale(tw / w, th / d); ctx.translate(w / 2, d / 2);
      ctx.font = 'bold .23px Georgia, serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round'; ctx.lineWidth = 0.07; ctx.strokeStyle = 'rgba(20,12,6,.8)'; ctx.fillStyle = '#f5dfaf';
      const put = (text, px, pz) => { if (has(pz > 0 ? 'a' : 'b')) { ctx.strokeText(text, px, pz); ctx.fillText(text, px, pz); } };
      for (let i = 0; i < 8; i++) {
        put(FILES[i], i - 3.5, 4.32); put(String(i + 1), -4.32, 3.5 - i);
        put(FILES[7 - i], 3.5 - i, -4.32); put(String(8 - i), 4.32, i - 3.5);
      }
    });
    const mesh = new THREE.Mesh(keep(new THREE.PlaneGeometry(w, d)), keep(new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false })));
    mesh.rotation.x = -Math.PI / 2; mesh.position.y = 0.006; mesh.renderOrder = 1; mesh.name = 'kd-field-labels'; board.add(mesh);
    labels = { mesh };
  }
  function loadFieldModel(h) {
    loadAsset(catalog.fieldModel && catalog.fieldModel(h.id)).then(got => {
      if (!got || stopped || halves[h.side] !== h) return;
      const inst = got.api.instantiate(got.root);
      for (const r of inst.resources) h.res.add(r);
      // Mô hình dựng cho nửa sân có mép người chơi ở −Z, bàn rộng 8: bên b dùng nguyên, bên a quay 180°.
      // Cờ tướng sâu 4,5 ô từ tâm tới mép kẻ (cờ vua 4) nên kéo giãn trục Z cho khớp.
      const holder = new THREE.Group(); holder.add(inst.root);
      holder.rotation.y = h.side === 'a' ? Math.PI : 0;
      holder.scale.set(1, 1, layout.chess ? 1 : 4.5 / 4);
      // Neo ở mặt sàn (y = -0,5) như đồ dựng bằng mã để khi khai mở mô hình trồi từ sàn lên.
      holder.position.y = 0.5;
      const item = new THREE.Group(); item.position.y = -0.5; item.userData = { f: 0.1, s: 1 }; item.add(holder);
      for (const c of [...h.decor.children]) h.decor.remove(c);
      for (const r of h.decorRes) r.dispose();
      h.decorRes.clear(); h.decor.add(item); setProgress(h, h.progress); requestRender();
    }).catch(() => {});
  }
  function setProgress(h, p) {
    const q = Math.max(1e-3, Math.min(1, p));
    h.pivot.scale.z = q; h.rimPivot.scale.z = q;
    // Texture co theo cùng tỉ lệ để hình không bị bóp: chỉ lộ phần từ mép người chơi tới mép sáng.
    h.map.repeat.set(1, q); h.map.offset.set(0, h.side === 'a' ? 0 : 1 - q);
    if (h.v2) { // ảnh v2: v = 0 luôn là mép người chơi (nửa b đã xoay 180° trong mặt phẳng)
      h.v2.pivot.scale.z = q; h.v2.tex.repeat.set(1, q); h.v2.tex.offset.set(0, 0);
      if (h.v2.gridTex) { h.v2.gridTex.repeat.set(1, q); h.v2.gridTex.offset.set(0, 0); }
    }
    for (const item of h.decor.children) {
      const r = p >= 1 ? 1 : riseAt(p, item.userData.f), s = item.userData.s || 1, k = 0.55 + 0.45 * Math.min(1, r);
      item.visible = r > 0.002; item.scale.set(s * k, s * Math.max(1e-3, r), s * k);
    }
    h.progress = p;
  }
  function disposeHalf(h) {
    h.dead = true; h.v2 = null;
    board.remove(h.group);
    for (const r of h.res) r.dispose();
    for (const r of h.decorRes) r.dispose();
    h.res.clear(); h.decorRes.clear();
  }
  function setField(side, id) {
    const old = halves[side];
    if ((old ? old.id : null) === id) return;
    if (old) retired.push(old); // giữ tới khung kế để playFx('domain') gọi ngay sau có thể đổi dần từ sân cũ
    halves[side] = id ? buildHalf(side, id) : null;
    syncScene();
  }
  function flushRetired() { for (const h of retired) disposeHalf(h); retired = []; }
  function readSkins(o) {
    const none = { a: NO_SKIN, b: NO_SKIN };
    if (!catalog) return none;
    if (layout.stones) { if (typeof catalog.supportsPieces !== 'function' || !catalog.supportsPieces(game)) return none; }
    else if (typeof catalog.supports === 'function' && !catalog.supports(game)) return none;
    const src = o && o.skins && typeof o.skins === 'object' ? o.skins : {};
    // Đá cờ vây/caro: chỉ lấy bộ đá (field luôn null), tra trong STONES.
    const pick = side => (Object.prototype.hasOwnProperty.call(src, side) ? (layout.stones ? { field: null, pieces: catalog.normalize(src[side], game).pieces } : catalog.normalize(src[side])) : NO_SKIN);
    return { a: pick('a'), b: pick('b') };
  }
  function applySkins(next) {
    for (const side of ['a', 'b']) if (next[side].field !== skins[side].field) setField(side, next[side].field);
    const changed = next.a.pieces !== skins.a.pieces || next.b.pieces !== skins.b.pieces;
    skins = next;
    return changed;
  }
  function refreshVisuals() {
    for (const [index, record] of pieces) pieces.set(index, visual(record.ch, record));
    captured = captured.map(record => visual(record.ch, record));
    if (aftermath) applyAftermath();
  }

  /* ---- Hiệu ứng playFx. Mỗi hiệu ứng có update(elapsed) mỗi khung và finish() đưa mọi thứ về trạng thái cuối. ---- */
  const fxGeo = {};
  const sharedGeo = (name, make) => fxGeo[name] || (fxGeo[name] = keep(make()));
  let spriteMap = null, beamMap = null, stripMap = null;
  const gradient = (w, h, alpha) => texture(w, h, ctx => {
    ctx.clearRect(0, 0, w, h);
    for (let y = 0; y < h; y++) { ctx.fillStyle = 'rgba(255,255,255,' + alpha(y / (h - 1)).toFixed(3) + ')'; ctx.fillRect(0, y, w, 1); }
  });
  const sprite = () => spriteMap || (spriteMap = texture(64, 64, ctx => {
    ctx.clearRect(0, 0, 64, 64);
    for (let r = 30; r > 0; r -= 3) { ctx.fillStyle = 'rgba(255,255,255,' + (0.06 + (1 - r / 30) * 0.4).toFixed(3) + ')'; ctx.beginPath(); ctx.arc(32, 32, r, 0, Math.PI * 2); ctx.fill(); }
  }));
  const beam = () => beamMap || (beamMap = gradient(4, 64, v => v ** 1.3));
  const strip = () => stripMap || (stripMap = gradient(4, 64, v => Math.sin(Math.PI * v) ** 2));
  const glowMaterial = (color, map, opacity) => new THREE.MeshBasicMaterial({
    color, map, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false
  });
  // Hạt bay: Points dùng chung một sprite tròn; mức đồ họa Thấp không có hạt.
  function burst(count, color, size, place) {
    if (quality === 'low') return null;
    const n = quality === 'high' ? Math.round(count * 1.6) : count, positions = new Float32Array(n * 3).fill(-50);
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const pm = new THREE.PointsMaterial({ color, size, map: sprite(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
    const points = new THREE.Points(geometry, pm); points.frustumCulled = false; points.renderOrder = 3; board.add(points);
    return {
      update(t) {
        for (let i = 0; i < n; i++) {
          const q = place(i, t);
          positions[i * 3] = q ? q.x : 0; positions[i * 3 + 1] = q ? q.y : -50; positions[i * 3 + 2] = q ? q.z : 0;
        }
        geometry.attributes.position.needsUpdate = true;
      },
      dispose() { board.remove(points); geometry.dispose(); pm.dispose(); }
    };
  }
  function addFx(fx) {
    fx.start = null; effects.add(fx);
    const done = new Promise(resolve => { fx.resolve = resolve; });
    requestRender();
    return done;
  }
  function endFx(fx) {
    if (!effects.delete(fx)) return;
    try { fx.finish(); } finally { fx.resolve(true); }
  }
  function stepFx(now) {
    for (const fx of [...effects]) {
      if (fx.start == null) fx.start = now;
      if (!fx.update(now - fx.start, now, fx)) endFx(fx);
    }
    return effects.size > 0;
  }
  function stopFx(kind) {
    for (const fx of [...effects]) if (!kind || fx.kind === kind) endFx(fx);
    requestRender();
  }

  function fxDomain(opts) {
    const side = opts.side;
    if ((side !== 'a' && side !== 'b') || layout.stones) return Promise.resolve(false);
    if (opts.field !== undefined && catalog) {
      const id = catalog.normalize({ field: opts.field }).field;
      setField(side, id); skins = { ...skins, [side]: { ...skins[side], field: id } };
    }
    for (const fx of [...effects]) if (fx.kind === 'domain' && fx.side === side) endFx(fx);
    const half = halves[side], k = retired.findIndex(h => h.side === side), old = k >= 0 ? retired.splice(k, 1)[0] : null;
    if (!half || calm()) {
      if (half) setProgress(half, 1);
      if (old) disposeHalf(old);
      requestRender();
      return Promise.resolve(!!half);
    }
    if (old) old.group.position.y = -0.002; // sân cũ nằm dưới, sân mới phủ dần lên
    setProgress(half, 0);
    const span = halfSpan(side), kind = half.def.fx;
    const front = new THREE.Mesh(sharedGeo('strip:' + span.w, () => new THREE.PlaneGeometry(span.w, 0.7).rotateX(-Math.PI / 2)), glowMaterial(half.tones.glow, strip(), 0));
    front.renderOrder = 2; half.group.add(front);
    const motes = burst(40, half.tones.glow, 0.09, (i, t) => {
      const q = particlePoint(kind, i, t);
      return q.on ? { x: q.u * span.w * 0.47, y: q.y, z: span.sign * (span.d / 2 - clamp01(q.v) * span.L) } : null;
    });
    return addFx({
      kind: 'domain', side,
      update(el) {
        if (calm() || halves[side] !== half) return false;
        const r = revealProgress(el);
        setProgress(half, r.front);
        half.overlay.emissiveIntensity = 0.85 * r.glow; half.rimMat.emissiveIntensity = 0.5 * r.glow;
        front.position.set(0, 0.012, span.sign * (span.d / 2 - r.front * span.L)); front.material.opacity = 0.95 * r.glow;
        if (motes) motes.update(el / FX.domain);
        return !r.done;
      },
      finish() {
        setProgress(half, 1); half.overlay.emissiveIntensity = 0; half.rimMat.emissiveIntensity = 0;
        half.group.remove(front); front.material.dispose();
        if (motes) motes.dispose();
        if (old) disposeHalf(old);
      }
    });
  }

  function fxPromote(opts) {
    const at = squareIndex(layout, opts.at);
    if (at < 0 || layout.stones) return Promise.resolve(false);
    stopFx('promote');
    if (calm()) return Promise.resolve(true); // giảm chuyển động: không rung, không nảy
    const cols = layout.cols, ac = at % cols, ar = Math.floor(at / cols);
    const maxD = Math.max(...[[0, 0], [cols - 1, 0], [0, layout.rows - 1], [cols - 1, layout.rows - 1]].map(([c, r]) => Math.hypot(c - ac, r - ar)));
    const ch = previous[at], side = opts.side === 'a' || opts.side === 'b' ? opts.side : ch ? sideOf(ch) : null;
    const color = side && halves[side] ? halves[side].tones.glow : '#ffe2a0', center = targetAt(at);
    const ring = new THREE.Mesh(sharedGeo('ring', () => new THREE.RingGeometry(0.9, 1, 72).rotateX(-Math.PI / 2)), glowMaterial(color, null, 0));
    ring.position.set(center.x, 0.031, center.z); ring.renderOrder = 2; board.add(ring);
    const flash = new THREE.Mesh(sharedGeo('disc', () => new THREE.CircleGeometry(0.62, 32).rotateX(-Math.PI / 2)), glowMaterial(color, sprite(), 0));
    flash.position.set(center.x, 0.032, center.z); flash.renderOrder = 2; board.add(flash);
    const dust = burst(26, color, 0.08, (i, t) => {
      const q = particlePoint('dust', i, t);
      return q.on ? { x: center.x + q.u, y: q.y, z: center.z + q.v } : null;
    });
    const duration = Math.max(joltDuration(maxD), FX.shake);
    let landed = false;
    return addFx({
      kind: 'promote',
      update(el, now, fx) {
        if (calm()) return false;
        if (!landed) {
          const rec = pieces.get(at);
          if (rec && rec.started) { fx.start = now; return true; } // chờ quân phong cấp trượt tới ô rồi mới dội sóng
          landed = true;
        }
        const wr = waveRing(el, maxD);
        ring.visible = wr.radius > 0.05; ring.scale.setScalar(Math.max(0.05, wr.radius)); ring.material.opacity = wr.opacity;
        const f = clamp01(1 - el / 320);
        flash.scale.setScalar(0.6 + (1 - f) * 1.6); flash.material.opacity = 0.9 * f;
        for (const [i, rec] of pieces) {
          if (i === at || (aftermath && aftermath.index === i)) continue;
          const dx = i % cols - ac, dz = Math.floor(i / cols) - ar, dist = Math.hypot(dx, dz), lift = joltLift(dist, el), tilt = lift * 0.32;
          rec.group.position.y = (rec.started ? rec.group.position.y : rec.target.y) + lift;
          rec.group.rotation.set(-dz / dist * tilt, 0, -dx / dist * tilt); // ngả ra xa tâm chấn
        }
        const s = shakeOffset(el); shake.x += s.x; shake.y += s.y;
        if (dust) dust.update(el / 900);
        return el < duration;
      },
      finish() {
        board.remove(ring); ring.material.dispose(); board.remove(flash); flash.material.dispose();
        if (dust) dust.dispose();
        for (const [i, rec] of pieces) {
          if (aftermath && aftermath.index === i) continue;
          rec.group.rotation.set(0, 0, 0);
          if (!rec.started) rec.group.position.y = rec.target.y;
        }
      }
    });
  }

  function applyAftermath() {
    const rec = pieces.get(aftermath.index);
    if (!rec) return;
    rec.group.rotation.set(aftermath.sign * aftermath.pose.angle, 0, 0);
    if (!rec.started) rec.group.position.y = rec.target.y + aftermath.pose.lift;
  }
  function clearAftermath() {
    const a = aftermath; aftermath = null;
    if (!a) return;
    const rec = pieces.get(a.index);
    if (rec) { rec.group.rotation.set(0, 0, 0); if (!rec.started) rec.group.position.y = rec.target.y; }
    if (a.disc) { board.remove(a.disc); a.disc.material.dispose(); }
  }
  function addDisc(color) {
    if (!aftermath || aftermath.disc) return;
    const m = new THREE.Mesh(sharedGeo('disc', () => new THREE.CircleGeometry(0.62, 32).rotateX(-Math.PI / 2)), glowMaterial(color, sprite(), 0.5));
    m.position.copy(targetAt(aftermath.index)); m.position.y = 0.031; m.renderOrder = 2; board.add(m); aftermath.disc = m;
  }
  function fxWin(opts) {
    const winner = opts.result === 'a' || opts.result === 'b' ? opts.result : null, loser = winner ? (winner === 'a' ? 'b' : 'a') : null;
    stopFx('win'); clearAftermath();
    let king = -1;
    if (!layout.stones && loser) {
      king = typeof opts.king === 'string' ? squareIndex(layout, opts.king) : previous.findIndex(ch => ch === (loser === 'a' ? 'K' : 'k'));
      if (king >= 0 && !pieces.has(king)) king = -1;
    }
    const spots = king >= 0 ? [king] : Array.isArray(opts.line) ? opts.line.map(n => squareIndex(layout, n)).filter(i => i >= 0).slice(0, 19) : [];
    const color = winner && halves[winner] ? halves[winner].tones.glow : winner ? '#ffe7a8' : '#dfe8f2';
    const kind = layout.chess ? 'tall' : 'disk';
    if (king >= 0) aftermath = { index: king, kind, sign: loser === 'a' ? 1 : -1, pose: fallPose(kind, 0), disc: null };
    if (calm()) { // giảm chuyển động: Vua nằm sẵn, có quầng sáng tĩnh, không cột sáng
      if (aftermath) { aftermath.pose = fallPose(kind, Infinity); addDisc(color); applyAftermath(); }
      requestRender();
      return Promise.resolve(true);
    }
    const centers = spots.length ? spots.map(i => targetAt(i)) : [new THREE.Vector3(0, 0.015, 0)];
    const H = 7, outerGeo = sharedGeo('pillar', () => new THREE.CylinderGeometry(0.42, 0.42, 1, 20, 1, true).translate(0, 0.5, 0));
    const coreGeo = sharedGeo('pillarCore', () => new THREE.CylinderGeometry(0.13, 0.13, 1, 12, 1, true).translate(0, 0.5, 0));
    const pillars = centers.map(c => {
      const outer = new THREE.Mesh(outerGeo, glowMaterial(color, beam(), 0)), core = new THREE.Mesh(coreGeo, glowMaterial('#ffffff', beam(), 0));
      for (const m of [outer, core]) { m.position.set(c.x, H, c.z); m.renderOrder = 3; board.add(m); }
      return { outer, core };
    });
    const sparks = burst(30, color, 0.1, (i, t) => {
      const q = particlePoint('rise', i, t), c = centers[i % centers.length];
      return q.on ? { x: c.x + q.u, y: q.y, z: c.z + q.v } : null;
    });
    return addFx({
      kind: 'win',
      update(el) {
        if (calm()) return false;
        const pp = pillarPose(el);
        for (const { outer, core } of pillars) {
          for (const m of [outer, core]) { m.scale.y = Math.max(1e-3, H * pp.reach); m.position.y = H * (1 - pp.reach); }
          outer.material.opacity = 0.55 * pp.opacity; core.material.opacity = 0.9 * pp.opacity;
        }
        let fallen = true;
        if (aftermath) {
          aftermath.pose = fallPose(kind, el); applyAftermath(); fallen = aftermath.pose.done;
          if (el >= FX.strike) addDisc(color);
        }
        const s = shakeOffset(el - FX.strike, FX, 0.45); shake.x += s.x; shake.y += s.y;
        if (sparks) sparks.update(el / FX.pillar);
        return !(pp.done && fallen);
      },
      finish() {
        for (const { outer, core } of pillars) for (const m of [outer, core]) { board.remove(m); m.material.dispose(); }
        if (sparks) sparks.dispose();
        if (aftermath) { aftermath.pose = fallPose(kind, Infinity); addDisc(color); applyAftermath(); }
      }
    });
  }
  function playFx(kind, opts) {
    if (stopped) return Promise.resolve(false);
    const o = opts && typeof opts === 'object' ? opts : {};
    if (kind === 'domain') return fxDomain(o);
    if (kind === 'promote') return fxPromote(o);
    if (kind === 'win') return fxWin(o);
    return Promise.resolve(false);
  }
  function setQuality(q) {
    if (!LEVELS.includes(q) || q === quality || stopped) return;
    const shadows = q !== 'low', changed = shadows !== !!renderer.shadowMap.enabled;
    quality = q; renderer.shadowMap.enabled = shadows;
    if (changed) scene.traverse(o => { for (const m of [].concat(o.material || [])) m.needsUpdate = true; });
    requestRender();
  }

  function orbit() {
    const aspect = width / height || 1;
    const pad = sceneMargin * 2; // dải cảnh của ảnh sân v2 nằm ngoài bàn: nới khung hình cho vừa
    const distance = Math.max((layout.rows + 1 + pad) * 1.55, (layout.cols + 3 + pad) / aspect * 1.55) * zoom;
    camera.position.set(Math.sin(yaw) * Math.cos(elevation) * distance, Math.sin(elevation) * distance, Math.cos(yaw) * Math.cos(elevation) * distance);
    camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
  }
  /** Sông chỉ chảy khi có sông, canvas còn trong trang, tab đang hiện và không giảm chuyển động. */
  function riverLive() {
    return !!water && !stopped && !calm() && !!canvas.isConnected && document.visibilityState !== 'hidden';
  }
  function render(now) {
    frame = 0; if (stopped) return;
    const live = riverLive(), tick = live && !(now - lastRiver < riverFrameGap(quality));
    if (!dirty && !tick) { if (live) frame = requestAnimationFrame(render); return; } // chỉ chờ tới nhịp sông kế tiếp
    dirty = false;
    if (tick) { lastRiver = now; water.material.map.offset.x = riverOffset(now); }
    if (retired.length) flushRetired();
    let moving = false;
    for (const p of [...pieces.values(), ...captured]) if (p.started) {
      const t = calm() ? 1 : Math.min(1, (now - p.started) / 360), eased = t * t * (3 - 2 * t);
      p.group.position.lerpVectors(p.from, p.target, eased);
      if (t === 1) p.started = 0; else moving = true;
    }
    shake.x = 0; shake.y = 0;
    const busy = effects.size > 0 && stepFx(now);
    if (shake.x || shake.y || shaken) {
      orbit();
      camera.position.x += shake.x; camera.position.y += shake.y; camera.updateMatrixWorld();
      shaken = !!(shake.x || shake.y);
    }
    renderer.render(scene, camera);
    if (moving || busy) requestRender(); else if (riverLive() && !frame) frame = requestAnimationFrame(render);
  }
  function requestRender() { dirty = true; if (!stopped && !frame) frame = requestAnimationFrame(render); }
  function resize() {
    if (stopped) return;
    const rect = canvas.getBoundingClientRect();
    width = Math.max(1, rect.width); height = Math.max(1, rect.height);
    renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix(); orbit(); requestRender();
  }
  function setFlip(value) { flip = !!value; board.rotation.y = flip ? Math.PI : 0; requestRender(); }
  function setState(o) {
    if (stopped) return;
    if (o.game && o.game !== game) throw new Error('Môn cờ không khớp với bàn.');
    const nextLayout = boardLayout(game, o.size || (layout.stones && Math.sqrt((o.board || o.cells || []).length)) || undefined);
    const resized = nextLayout.cols !== layout.cols;
    state = { ...o }; layout = nextLayout;
    let next = Array.from(o.board || o.cells || []);
    if (game === 'gomoku' && !o.board) next = Array.from({ length: layout.rows }, (_, r) => next.slice((layout.rows - 1 - r) * layout.cols, (layout.rows - r) * layout.cols)).flat();
    if (next.length !== layout.cols * layout.rows) throw new Error('Số ô không khớp với bàn.');
    if (resized) { previous = []; for (const p of pieces.values()) board.remove(p.group); pieces.clear(); }
    const languageChanged = vi !== !!o.vi;
    if (!surface || resized || languageChanged) rebuildBoard();
    const piecesChanged = applySkins(readSkins(o));
    if (languageChanged || piecesChanged) captured = captured.map(record => visual(record.ch, record));
    // Thế cờ đổi (ván mới, đi tiếp) thì Vua đã đổ được dựng lại.
    const boardChanged = next.length !== previous.length || next.some((ch, i) => (ch || '') !== (previous[i] || ''));
    if (boardChanged && aftermath) { stopFx('win'); clearAftermath(); }
    const delta = transitionPieces(previous, next, o.last, layout), updated = new Map(), retained = new Set();
    next.forEach((ch, index) => {
      if (!ch) return;
      const oldIndex = delta.pairs.get(index), old = pieces.get(oldIndex);
      const record = visual(ch, old); if (old) retained.add(old);
      if (!old) record.group.position.copy(targetAt(index));
      // Une sélection répétée ne redémarre pas une glissade en cours.
      const target = targetAt(index);
      if (!old || !record.target.equals(target)) travel(record, target, delta.move && !!old);
      updated.set(index, record);
    });
    if (!delta.move && next.some((ch, i) => ch !== previous[i])) {
      for (const p of captured) board.remove(p.group); captured = [];
    }
    for (const [index, record] of pieces) if (!retained.has(record)) {
      if (delta.captured.includes(index)) {
        captured.push(record);
        const side = layout.stones ? record.ch === 'a' : record.ch === record.ch.toUpperCase();
        const slot = captured.filter(p => (layout.stones ? p.ch === 'a' : p.ch === p.ch.toUpperCase()) === side).length - 1;
        travel(record, capturedSpot(side, slot), true);
        record.group.scale.multiplyScalar(0.68);
      } else board.remove(record.group);
    }
    pieces = updated; previous = next;
    if (aftermath) applyAftermath();
    pruneSkins();
    setFlip(o.flip == null ? flip : o.flip); updateMarks(); orbit(); requestRender();
  }

  const ray = new THREE.Raycaster(), pointer = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3();
  function choose(e) {
    const rect = canvas.getBoundingClientRect();
    pointer.set((e.clientX - rect.left) / rect.width * 2 - 1, -(e.clientY - rect.top) / rect.height * 2 + 1);
    ray.setFromCamera(pointer, camera);
    if (ray.ray.intersectPlane(plane, hit)) {
      const name = squareAtWorld(layout, hit.x, hit.z, flip); if (name) pick(name);
    }
  }
  const gap = () => { const p = [...pointers.values()]; return p.length === 2 ? Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y) : 0; };
  function down(e) {
    if (e.button !== 0) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY }); canvas.setPointerCapture(e.pointerId);
    if (pointers.size === 1) { pinching = false; drag = { id: e.pointerId, x: e.clientX, y: e.clientY, distance: 0 }; }
    else { pinching = true; drag = null; }
  }
  function move(e) {
    if (!pointers.has(e.pointerId)) return;
    const oldGap = gap(), p = pointers.get(e.pointerId), dx = e.clientX - p.x, dy = e.clientY - p.y;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      const newGap = gap(); if (oldGap > 0 && newGap > 0) zoom = THREE.MathUtils.clamp(zoom * oldGap / newGap, 0.65, 1.7);
    } else if (drag) {
      drag.distance = Math.max(drag.distance, Math.hypot(e.clientX - drag.x, e.clientY - drag.y));
      if (drag.distance > 6) { yaw -= dx * 0.008; elevation = THREE.MathUtils.clamp(elevation + dy * 0.006, 0.42, 1.49); }
    }
    orbit(); requestRender();
  }
  function up(e) {
    if (e.type === 'pointerup' && !pinching && drag && drag.id === e.pointerId && drag.distance <= 6) choose(e);
    pointers.delete(e.pointerId); drag = null;
    if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
  }
  function wheel(e) { e.preventDefault(); zoom = THREE.MathUtils.clamp(zoom * Math.exp(e.deltaY * 0.001), 0.65, 1.7); orbit(); requestRender(); }
  function keydown(e) {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '-', '='].includes(e.key)) return;
    e.preventDefault();
    if (e.key === 'ArrowLeft') yaw -= 0.12;
    if (e.key === 'ArrowRight') yaw += 0.12;
    if (e.key === 'ArrowUp') elevation = Math.min(1.49, elevation + 0.08);
    if (e.key === 'ArrowDown') elevation = Math.max(0.42, elevation - 0.08);
    if (e.key === '+' || e.key === '=') zoom = Math.max(0.65, zoom * 0.9);
    if (e.key === '-') zoom = Math.min(1.7, zoom / 0.9);
    orbit(); requestRender();
  }
  const events = { pointerdown: down, pointermove: move, pointerup: up, pointercancel: up, lostpointercapture: up, wheel, keydown };
  for (const [name, fn] of Object.entries(events)) canvas.addEventListener(name, fn, name === 'wheel' ? { passive: false } : undefined);
  media.addEventListener('change', requestRender);
  const onVisible = () => { if (riverLive()) requestRender(); };
  if (typeof document.addEventListener === 'function') document.addEventListener('visibilitychange', onVisible);
  const observer = new ResizeObserver(resize); observer.observe(canvas); resize();
  return {
    setState, setFlip, resize, playFx, setQuality,
    stopFx(kind) { if (!stopped) stopFx(kind); },
    onPick(fn) { pick = typeof fn === 'function' ? fn : () => {}; },
    /** Số hình và texture đang nằm trên GPU (renderer.info.memory), để kiểm rò rỉ khi đổi skin. */
    stats() {
      const m = (renderer.info && renderer.info.memory) || {};
      return { geometries: m.geometries | 0, textures: m.textures | 0, pieceSkins: pieceSkins.size, halves: +!!halves.a + +!!halves.b, effects: effects.size, fieldImages: +!!(halves.a && halves.a.v2) + +!!(halves.b && halves.b.v2) };
    },
    dispose() {
      if (stopped) return; stopped = true; cancelAnimationFrame(frame); observer.disconnect();
      stopFx(); clearAftermath();
      for (const side of ['a', 'b']) if (halves[side]) { disposeHalf(halves[side]); halves[side] = null; }
      flushRetired();
      for (const s of pieceSkins.values()) for (const r of s.res) r.dispose();
      pieceSkins.clear();
      for (const [name, fn] of Object.entries(events)) canvas.removeEventListener(name, fn);
      for (const id of pointers.keys()) if (canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id);
      pointers.clear(); media.removeEventListener('change', requestRender);
      if (typeof document.removeEventListener === 'function') document.removeEventListener('visibilitychange', onVisible);
      canvas.style.touchAction = oldTouchAction;
      for (const resource of resources) resource.dispose();
      resources.clear(); templates.clear(); pieces.clear(); captured = []; scene.clear();
      key.shadow.dispose(); renderer.dispose(); renderer.forceContextLoss(); pick = () => {};
    }
  };
}
