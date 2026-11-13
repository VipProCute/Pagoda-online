/*
 * Kỳ Đạo · Vẽ bàn cờ bằng Canvas 2D: vua, tướng/úp, vây 9/13/19, caro 15×15.
 * Quân cờ vua vẽ bằng mã (không dùng ký tự ♔, không có tệp ảnh nên không cần ghi NOTICE).
 * Phần hình học (layout, squareAt, cellXY, nameOf, parseSq) thuần, chạy được trong Node để test.
 *
 * Quy ước toạ độ logic: col 0.. từ cột a; row 0.. tính từ phía bên 'a' (Trắng/Đỏ).
 *  - cờ vua: ô 'e4' = col 4, row 3; board[row*8 + col].
 *  - cờ tướng: ô 'e5' = col 4, row 5 (hàng 0 là bên Đỏ); board[row*9 + col]; quân nằm trên GIAO ĐIỂM.
 * flip = true (mình là bên 'b') quay bàn 180° để bên mình luôn ở dưới.
 */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.KydaoDraw = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const FILES = 'abcdefghijklmnopqrs';
  const GO_FILES = 'ABCDEFGHJKLMNOPQRST';
  const isGrid = game => game === 'go' || game === 'gomoku';
  const DIMS = { chess: { cols: 8, rows: 8 }, xiangqi: { cols: 9, rows: 10 } };
  const dimOf = (game, size) => isGrid(game) ? { cols: size || (game === 'go' ? 9 : 15), rows: size || (game === 'go' ? 9 : 15) } : (game === 'chess' ? DIMS.chess : DIMS.xiangqi);
  const isChess = game => game === 'chess';

  /** Tỉ lệ rộng/cao nên có của canvas. */
  function aspect(game, margin) {
    const m = margin > 0 ? margin : 0;
    if (isChess(game) || isGrid(game)) return 1;
    return m > 0 ? (8 + 2 * m) / (9 + 2 * m) : 9.2 / 10.2;
  }

  /** Hình học cho canvas w×h (px CSS). */
  function layout(game, w, h, size, margin) {
    const d = dimOf(game, size);
    const m = margin > 0 ? margin : 0;
    if (isGrid(game)) {
      const cell = Math.min(w, h) / (d.cols + 1);
      return { game, cols: d.cols, rows: d.rows, cell, ox: (w - cell * (d.cols - 1)) / 2, oy: (h - cell * (d.rows - 1)) / 2, w, h, margin: 0 };
    }
    if (isChess(game)) {
      const cell = Math.floor(Math.min(w, h) / (8 + 2 * m));
      return { game, cols: 8, rows: 8, cell, ox: Math.round((w - cell * 8) / 2), oy: Math.round((h - cell * 8) / 2), w, h, margin: m };
    }
    const cell = m > 0 ? Math.min(w / (8 + 2 * m), h / (9 + 2 * m)) : Math.min(w / 9.2, h / 10.2);
    return { game, cols: d.cols, rows: d.rows, cell, ox: (w - cell * 8) / 2, oy: (h - cell * 9) / 2, w, h, margin: m };
  }

  /** Tâm của ô (cờ vua) / giao điểm (cờ tướng) tại toạ độ logic. */
  function cellXY(g, col, row, flip) {
    const c = flip ? g.cols - 1 - col : col, r = flip ? g.rows - 1 - row : row;
    if (isChess(g.game)) return { x: g.ox + c * g.cell + g.cell / 2, y: g.oy + (7 - r) * g.cell + g.cell / 2 };
    return { x: g.ox + c * g.cell, y: g.oy + (g.rows - 1 - r) * g.cell };
  }

  const nameOf = (game, col, row) => (game === 'go' ? GO_FILES : FILES)[col] + (isChess(game) || isGrid(game) ? row + 1 : row);
  function parseSq(game, name, size) {
    if (typeof name !== 'string' || name.length < 2) return null;
    const col = (game === 'go' ? GO_FILES : FILES).indexOf(name[0]);
    const row = isChess(game) || isGrid(game) ? Number(name.slice(1)) - 1 : Number(name.slice(1));
    const d = dimOf(game, size);
    if (col < 0 || col >= d.cols || !Number.isInteger(row) || row < 0 || row >= d.rows) return null;
    return { col, row };
  }
  /** Chỉ số trong board của state. */
  const boardIndex = (game, col, row, size) => {
    const d = dimOf(game, size);
    return (game === 'gomoku' ? d.rows - 1 - row : row) * d.cols + col;
  };

  /** Chạm px,py → tên ô; null nếu ngoài bàn (cờ tướng: phải đủ gần một giao điểm). */
  function squareAt(g, px, py, flip) {
    let c, r;
    if (isChess(g.game)) {
      c = Math.floor((px - g.ox) / g.cell);
      r = 7 - Math.floor((py - g.oy) / g.cell);
    } else {
      c = Math.round((px - g.ox) / g.cell);
      r = g.rows - 1 - Math.round((py - g.oy) / g.cell);
      const p = cellXY(g, flip ? g.cols - 1 - c : c, flip ? g.rows - 1 - r : r, flip);
      if (Math.hypot(px - p.x, py - p.y) > g.cell * 0.62) return null;
    }
    if (c < 0 || c >= g.cols || r < 0 || r >= g.rows) return null;
    if (flip) { c = g.cols - 1 - c; r = g.rows - 1 - r; }
    return nameOf(g.game, c, r);
  }

  /* ---------- Quân cờ vua vẽ bằng mã (khung -0.5..0.5, đáy ở +0.4) ---------- */
  function poly(ctx, pts) { ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath(); }
  function ball(ctx, x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); }

  /* ---------- Skin: màu, nạp ảnh nửa sân, giải mã o.skins ---------- */
  function hex2rgb(h) {
    let s = String(h || '').replace('#', '');
    if (s.length === 3) s = s.split('').map(x => x + x).join('');
    if (!/^[0-9a-f]{6}$/i.test(s)) return [128, 128, 128];
    const n = parseInt(s, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  /** Trộn hai màu hex theo tỉ lệ t (0 = a, 1 = b), trả về hex. */
  function mixc(a, b, t) {
    const x = hex2rgb(a), y = hex2rgb(b);
    return '#' + [0, 1, 2].map(i => ('0' + Math.round(x[i] + (y[i] - x[i]) * t).toString(16)).slice(-2)).join('');
  }
  function rgba(h, a) { const c = hex2rgb(h); return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; }
  function lum(h) {
    const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    const c = hex2rgb(h);
    return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
  }
  function contrast(a, b) { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
  /** Màu chữ/nét dễ đọc trên nền base: ưu tiên accent, không đủ tương phản thì dùng tối/sáng. */
  function readableOn(base, accent) {
    if (accent && contrast(accent, base) >= 3) return accent;
    return lum(base) > 0.4 ? '#1c140d' : '#fff6dc';
  }

  const IMAGES = new Map();
  /**
   * Ảnh nửa sân theo đường dẫn; null khi chưa tải xong, 404 hoặc không có Image (Node).
   * onAsset (tuỳ chọn) được gọi một lần khi ảnh tải xong để bên ngoài vẽ lại.
   */
  function loadImage(src, onAsset) {
    if (!src || typeof Image !== 'function') return null;
    let e = IMAGES.get(src);
    if (!e) {
      e = { img: null, ready: false, failed: false, cbs: new Set() };
      IMAGES.set(src, e);
      try {
        const img = new Image();
        e.img = img;
        img.onload = () => { e.ready = true; const list = Array.from(e.cbs); e.cbs.clear(); list.forEach(cb => { try { cb(); } catch (_) { /* bên ngoài tự lo */ } }); };
        img.onerror = () => { e.failed = true; e.cbs.clear(); };
        img.src = src;
      } catch (_) { e.failed = true; }
    }
    if (e.ready) return e.img;
    if (!e.failed && typeof onAsset === 'function') e.cbs.add(onAsset);
    return null;
  }

  /** Trạng thái tải của một đường dẫn ảnh: 'none' (chưa yêu cầu) | 'loading' | 'ok' | 'err'. */
  function imageState(src) {
    const e = src ? IMAGES.get(src) : null;
    if (!e) return 'none';
    return e.ready ? 'ok' : e.failed ? 'err' : 'loading';
  }
  /** Ảnh v2 đang tải thì chưa được tải ảnh v1 (tránh yêu cầu thừa); chỉ khi v2 lỗi hoặc không có mới dùng v1. */
  const v2Pending = f => !!f.src2 && imageState(f.src2) === 'loading';

  const gameSkinnable = (cat, game) => cat && (typeof cat.supports === 'function' ? cat.supports(game) : (game === 'chess' || game === 'xiangqi' || game === 'jieqi'));
  /**
   * Giải o.skins thành { a:{field,pieces}, b:{…}, onAsset } hoặc null nếu không có gì để vẽ.
   * field = { id, pal, src }; pieces = { id, c:{base,accent,glow} }. o.hideSkins[bên] = true thì bên đó vẽ mặc định.
   */
  function resolveSkins(o) {
    const cat = o.catalog || (typeof KydaoSkins !== 'undefined' ? KydaoSkins : null);
    if (!o.skins || typeof o.skins !== 'object' || !gameSkinnable(cat, o.game)) return null;
    const out = { a: { field: null, pieces: null }, b: { field: null, pieces: null }, onAsset: o.onAsset };
    let any = false;
    for (const side of ['a', 'b']) {
      const s = o.skins[side];
      if (!s || (o.hideSkins && o.hideSkins[side])) continue;
      const f = cat.field(s.field), p = cat.pieces(s.pieces);
      if (f && f.palette) { out[side].field = { id: s.field, pal: f.palette, src: cat.fieldImage ? cat.fieldImage(s.field) : null, src2: cat.fieldImage2 ? cat.fieldImage2(s.field, o.game) : null }; any = true; }
      if (p && p[side]) { out[side].pieces = { id: s.pieces, c: p[side], atlas: cat.piecesAtlas ? cat.piecesAtlas(s.pieces) : null }; any = true; }
    }
    return any ? out : null;
  }
  const hasField = sk => !!(sk && (sk.a.field || sk.b.field));
  const sideOfChar = ch => (ch === ch.toUpperCase() ? 'a' : 'b');

  /** Hình chữ nhật mỗi nửa sân trên màn hình; rotated = nửa nằm trên (ảnh xoay 180° để mép người chơi ra mép bàn). */
  function chessHalves(g, flip) {
    const top = g.oy, bottom = g.oy + g.cell * 4, w = g.cell * 8, h = g.cell * 4;
    return [
      { side: 'a', rotated: !!flip, rect: { x: g.ox, y: flip ? top : bottom, w, h } },
      { side: 'b', rotated: !flip, rect: { x: g.ox, y: flip ? bottom : top, w, h } }
    ];
  }
  function xiangqiHalves(g, flip) {
    const m = g.cell * 0.6, mid = g.oy + g.cell * 4.5, x = g.ox - m, w = g.cell * 8 + m * 2;
    const inset = Math.max(2, g.cell * 0.09) + Math.max(0.6, g.cell * 0.02);
    const topFull = { x, y: g.oy - m, w, h: mid - (g.oy - m) }, botFull = { x, y: mid, w, h: g.oy + g.cell * 9 + m - mid };
    const topFill = { x: x + inset, y: topFull.y + inset, w: w - inset * 2, h: topFull.h - inset }, botFill = { x: x + inset, y: mid, w: w - inset * 2, h: botFull.h - inset };
    return [
      { side: 'a', rotated: !!flip, full: flip ? topFull : botFull, rect: flip ? topFill : botFill },
      { side: 'b', rotated: !flip, full: flip ? botFull : topFull, rect: flip ? botFill : topFill }
    ];
  }

  /** Phủ ảnh nửa sân (cover, giữa) vào rect; trả về true nếu đã vẽ ảnh. */
  function paintFieldImage(ctx, rect, rotated, f, onAsset) {
    const img = loadImage(f.src, onAsset);
    if (!img) return false;
    const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
    if (!iw || !ih) return false;
    const k = Math.max(rect.w / iw, rect.h / ih), dw = iw * k, dh = ih * k;
    const cx = rect.x + rect.w / 2, cy = rect.y + rect.h / 2;
    ctx.save();
    ctx.beginPath(); ctx.rect(rect.x, rect.y, rect.w, rect.h); ctx.clip();
    ctx.translate(cx, cy);
    if (rotated) ctx.rotate(Math.PI);
    ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
    ctx.restore();
    return true;
  }

  /** Vẽ ảnh sân v2 (có dải cảnh) cho một nửa. dest = hình chữ nhật đích gồm cả dải cảnh; m = bề rộng dải cảnh tính theo ô.
   *  rotated = nửa nằm phía trên màn hình (xoay 180°). Trả true nếu đã vẽ. */
  function paintField2(ctx, dest, rotated, f, m, onAsset) {
    if (!f.src2) return false;
    const img = loadImage(f.src2, onAsset);
    if (!img) return false;
    const sx = 192 - m * 128, sw = (8 + 2 * m) * 128, sh = (4 + m) * 128;
    ctx.save();
    ctx.beginPath(); ctx.rect(dest.x, dest.y, dest.w, dest.h); ctx.clip();
    if (rotated) { ctx.translate(dest.x + dest.w, dest.y + dest.h); ctx.rotate(Math.PI); ctx.drawImage(img, sx, 0, sw, sh, 0, 0, dest.w, dest.h); }
    else ctx.drawImage(img, sx, 0, sw, sh, dest.x, dest.y, dest.w, dest.h);
    ctx.restore();
    return true;
  }

  /** Dải mờ chuyển màu ngắn ở đường giữa hai nửa (không cắt cứng). */
  function seamBand(ctx, g, x, w, y, topColor, bottomColor) {
    const hh = g.cell * 0.4, mid = mixc(topColor, bottomColor, 0.5);
    const gr = ctx.createLinearGradient(0, y - hh, 0, y + hh);
    gr.addColorStop(0, rgba(topColor, 0)); gr.addColorStop(0.5, rgba(mid, 0.5)); gr.addColorStop(1, rgba(bottomColor, 0));
    ctx.fillStyle = gr; ctx.fillRect(x, y - hh, w, hh * 2);
  }
  /** Màu đại diện của nửa sân cho dải giữa: skin thì pha light/dark, không thì màu gỗ mặc định. */
  const halfTone = (f, fallback) => (f ? mixc(f.pal.light, f.pal.dark, 0.35) : fallback);

  const CHESS_SHAPES = {
    // Thân tiện lõm và vòng cổ dùng chung; đầu mỗi quân có đường nét riêng.
    stem(ctx, paint, top, width) {
      ctx.beginPath(); ctx.moveTo(-0.22, 0.27);
      ctx.bezierCurveTo(-0.2, 0.2, -0.085, 0.16, -0.085, 0.04);
      ctx.bezierCurveTo(-0.085, top + 0.08, -width, top + 0.04, -width, top);
      ctx.lineTo(width, top);
      ctx.bezierCurveTo(width, top + 0.04, 0.085, top + 0.08, 0.085, 0.04);
      ctx.bezierCurveTo(0.085, 0.16, 0.2, 0.2, 0.22, 0.27);
      ctx.closePath(); paint();
    },
    ring(ctx, paint, y, width) {
      ctx.beginPath(); ctx.moveTo(-width, y);
      ctx.bezierCurveTo(-width - 0.025, y - 0.05, width + 0.025, y - 0.05, width, y);
      ctx.lineTo(width - 0.015, y + 0.035);
      ctx.bezierCurveTo(width * 0.5, y + 0.052, -width * 0.5, y + 0.052, -width + 0.015, y + 0.035);
      ctx.closePath(); paint();
    },
    p(ctx, paint) {
      CHESS_SHAPES.stem(ctx, paint, -0.055, 0.095);
      CHESS_SHAPES.ring(ctx, paint, -0.055, 0.14);
      ball(ctx, 0, -0.205, 0.13); paint();
    },
    r(ctx, paint) {
      ctx.beginPath(); ctx.moveTo(-0.22, 0.27);
      ctx.bezierCurveTo(-0.16, 0.18, -0.135, 0.04, -0.145, -0.13);
      ctx.lineTo(0.145, -0.13);
      ctx.bezierCurveTo(0.135, 0.04, 0.16, 0.18, 0.22, 0.27);
      ctx.closePath(); paint();
      CHESS_SHAPES.ring(ctx, paint, -0.13, 0.19);
      poly(ctx, [[-0.205, -0.15], [-0.235, -0.34], [-0.235, -0.395], [-0.14, -0.395],
        [-0.14, -0.31], [-0.05, -0.31], [-0.05, -0.395], [0.05, -0.395], [0.05, -0.31],
        [0.14, -0.31], [0.14, -0.395], [0.235, -0.395], [0.235, -0.34], [0.205, -0.15]]); paint();
    },
    n(ctx, paint, detail) {
      ctx.beginPath(); ctx.moveTo(-0.2, 0.25);
      ctx.bezierCurveTo(-0.21, 0.12, -0.045, 0.025, -0.075, -0.125);
      ctx.bezierCurveTo(-0.125, -0.105, -0.17, -0.07, -0.235, -0.105);
      ctx.quadraticCurveTo(-0.28, -0.13, -0.255, -0.195);
      ctx.lineTo(-0.11, -0.325); ctx.lineTo(-0.075, -0.425);
      ctx.quadraticCurveTo(-0.025, -0.415, -0.005, -0.365);
      ctx.lineTo(0.065, -0.405);
      ctx.bezierCurveTo(0.24, -0.275, 0.19, -0.06, 0.22, 0.1);
      ctx.quadraticCurveTo(0.23, 0.19, 0.205, 0.25);
      ctx.closePath(); paint();
      // Nhấn bờm, hàm và mắt bằng nét riêng.
      ctx.beginPath(); ctx.moveTo(0.06, -0.325);
      ctx.bezierCurveTo(0.16, -0.19, 0.1, -0.04, 0.15, 0.12);
      ctx.moveTo(-0.22, -0.137); ctx.quadraticCurveTo(-0.16, -0.14, -0.12, -0.18);
      detail();
      for (let i = 0; i < 4; i++) {
        const y = -0.23 + i * 0.07;
        ctx.beginPath(); ctx.moveTo(0.115, y); ctx.lineTo(0.175, y - 0.025); detail();
      }
      ball(ctx, -0.072, -0.275, 0.021); detail(true);
      CHESS_SHAPES.ring(ctx, paint, 0.22, 0.225);
    },
    b(ctx, paint) {
      CHESS_SHAPES.stem(ctx, paint, -0.065, 0.095);
      CHESS_SHAPES.ring(ctx, paint, -0.065, 0.165);
      ctx.beginPath(); ctx.moveTo(-0.105, -0.105);
      ctx.bezierCurveTo(-0.21, -0.19, -0.09, -0.335, 0, -0.405);
      ctx.quadraticCurveTo(0.055, -0.355, 0.085, -0.305);
      ctx.lineTo(-0.025, -0.205); ctx.quadraticCurveTo(-0.035, -0.18, -0.005, -0.18);
      ctx.lineTo(0.112, -0.27);
      ctx.bezierCurveTo(0.175, -0.175, 0.155, -0.125, 0.105, -0.105);
      ctx.quadraticCurveTo(0, -0.06, -0.105, -0.105);
      ctx.closePath(); paint();
      ball(ctx, 0, -0.418, 0.029); paint();
    },
    q(ctx, paint) {
      CHESS_SHAPES.stem(ctx, paint, -0.105, 0.1);
      ctx.beginPath(); ctx.moveTo(-0.145, -0.12);
      ctx.quadraticCurveTo(-0.2, -0.22, -0.245, -0.355);
      ctx.lineTo(-0.135, -0.265); ctx.lineTo(-0.12, -0.405);
      ctx.lineTo(-0.045, -0.285); ctx.lineTo(0, -0.44);
      ctx.lineTo(0.045, -0.285); ctx.lineTo(0.12, -0.405);
      ctx.lineTo(0.135, -0.265); ctx.lineTo(0.245, -0.355);
      ctx.quadraticCurveTo(0.2, -0.22, 0.145, -0.12);
      ctx.closePath(); paint();
      [[-0.245, -0.365], [-0.12, -0.415], [0, -0.45], [0.12, -0.415], [0.245, -0.365]].forEach(p => {
        ball(ctx, p[0], p[1], 0.028); paint();
      });
      CHESS_SHAPES.ring(ctx, paint, -0.115, 0.165);
    },
    k(ctx, paint) {
      CHESS_SHAPES.stem(ctx, paint, -0.105, 0.105);
      ctx.beginPath(); ctx.moveTo(-0.12, -0.1);
      ctx.bezierCurveTo(-0.13, -0.15, -0.215, -0.21, -0.165, -0.26);
      ctx.bezierCurveTo(-0.11, -0.31, -0.06, -0.255, 0, -0.275);
      ctx.bezierCurveTo(0.06, -0.255, 0.11, -0.31, 0.165, -0.26);
      ctx.bezierCurveTo(0.215, -0.21, 0.13, -0.15, 0.12, -0.1);
      ctx.closePath(); paint();
      CHESS_SHAPES.ring(ctx, paint, -0.105, 0.165);
      poly(ctx, [[-0.035, -0.485], [0.035, -0.485], [0.035, -0.415], [0.105, -0.415],
        [0.105, -0.355], [0.035, -0.355], [0.035, -0.265], [-0.035, -0.265],
        [-0.035, -0.355], [-0.105, -0.355], [-0.105, -0.415], [-0.035, -0.415]]); paint();
    }
  };

  /** Atlas quân 2D (render 3D): ô 128×128, hàng 0 = bên a, hàng 1 = bên b; cột K Q R B N P disc. */
  const ATLAS_CELL = 128, ATLAS_COL = { k: 0, q: 1, r: 2, b: 3, n: 4, p: 5, disc: 6 };
  // Quân trong ô atlas chỉ rộng chừng 0,4 ô nên phóng 1,12 lần cho đầy ô cờ; Vua cao 0,945 ô vẫn nằm trong ô.
  const ATLAS_T = 1.12, ATLAS_BASE = 118 / 128, ATLAS_FOOT = 0.44;
  /** Ảnh atlas của skin quân nếu đã tải xong, ngược lại null (vẽ vector). */
  function atlasImage(skin, onAsset) { return skin && skin.atlas ? loadImage(skin.atlas, onAsset) : null; }
  function paintAtlasCell(ctx, img, col, row, dx, dy, T) {
    ctx.drawImage(img, col * ATLAS_CELL, row * ATLAS_CELL, ATLAS_CELL, ATLAS_CELL, dx, dy, T, T);
  }

  function drawChessPiece(ctx, cx, cy, size, ch, rendering, skin, atlas) {
    const col = ATLAS_COL[ch.toLowerCase()];
    if (atlas && col !== undefined && col !== 6) {
      // Đáy quân (y=118/128 của ô atlas) đặt ở cy + ATLAS_FOOT·ô.
      const cell = size / 0.92, T = cell * ATLAS_T;
      paintAtlasCell(ctx, atlas, col, ch === ch.toUpperCase() ? 0 : 1, cx - T / 2, cy + cell * ATLAS_FOOT - T * ATLAS_BASE, T);
      return;
    }
    if (!rendering && ctx.canvas && ctx.canvas.ownerDocument && ctx.getTransform) {
      const scale = Math.max(1, Math.abs(ctx.getTransform().a));
      const pixels = Math.ceil(size * 1.4 * scale);
      const key = ch + ':' + pixels + ':' + size + (skin ? ':' + skin.id : '');
      const cache = drawChessPiece.cache || (drawChessPiece.cache = new Map());
      if (!cache.has(key)) {
        if (cache.size >= 96) cache.clear();
        const canvas = ctx.canvas.ownerDocument.createElement('canvas');
        canvas.width = pixels; canvas.height = pixels;
        const buffer = canvas.getContext('2d');
        if (buffer) {
          buffer.scale(pixels / (size * 1.4), pixels / (size * 1.4));
          drawChessPiece(buffer, size * 0.7, size * 0.7, size, ch, true, skin);
          cache.set(key, canvas);
        }
      }
      if (cache.has(key)) {
        ctx.drawImage(cache.get(key), cx - size * 0.7, cy - size * 0.7, size * 1.4, size * 1.4);
        return;
      }
    }
    const white = ch === ch.toUpperCase();
    const shape = CHESS_SHAPES[ch.toLowerCase()];
    if (!shape) return;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(size, size);
    ctx.lineWidth = 0.024;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    // Ánh sáng bên trái; chuyển sắc ngang làm thân trông như gỗ tiện tròn.
    const material = ctx.createLinearGradient(-0.32, 0, 0.32, 0);
    let tones = white ? ['#a78b60', '#f3e7ce', '#fffbed', '#dfcba5', '#9a774d'] :
      ['#0c1010', '#45463f', '#646355', '#242826', '#080b0b'];
    let outline = white ? '#644b30' : '#080b0b', rimLine = white ? 'rgba(255,253,237,.7)' : 'rgba(221,207,170,.55)';
    let detailInk = white ? '#745a3b' : '#c5b998', detailFill = white ? '#3c3024' : '#f2e7cc';
    let gleamAlpha = white ? 'rgba(255,255,247,.6)' : 'rgba(235,229,203,.22)';
    const sc = skin && skin.c;
    if (sc) {
      // Đổi màu thân/viền/chi tiết theo skin; dáng quân giữ nguyên.
      const b = sc.base, bright = lum(b) > 0.4;
      tones = [mixc(b, '#000000', 0.42), mixc(b, '#ffffff', 0.1), mixc(b, '#ffffff', 0.3), mixc(b, '#000000', 0.18), mixc(b, '#000000', 0.5)];
      outline = mixc(b, '#000000', 0.62);
      rimLine = rgba(bright ? '#ffffff' : mixc(sc.accent || b, '#ffffff', 0.4), 0.55);
      detailInk = readableOn(b, sc.accent); detailFill = detailInk;
      gleamAlpha = bright ? 'rgba(255,255,247,.6)' : 'rgba(235,229,203,.28)';
    }
    [0, 0.24, 0.38, 0.64, 1].forEach((stop, i) => material.addColorStop(stop, tones[i]));
    const gleam = ctx.createLinearGradient(-0.23, 0, -0.06, 0);
    gleam.addColorStop(0, 'rgba(255,250,225,0)');
    gleam.addColorStop(0.4, gleamAlpha);
    gleam.addColorStop(1, 'rgba(255,250,225,0)');
    const paint = () => {
      ctx.fillStyle = material; ctx.fill();
      ctx.strokeStyle = outline; ctx.lineWidth = 0.028; ctx.stroke();
      ctx.save(); ctx.clip();
      ctx.fillStyle = gleam; ctx.fillRect(-0.32, -0.52, 0.64, 1);
      // Viền sáng mảnh giúp quân mun tách khỏi ô bàn sẫm.
      ctx.strokeStyle = rimLine;
      ctx.lineWidth = 0.014; ctx.stroke(); ctx.restore();
    };
    const detail = fill => {
      ctx.strokeStyle = detailInk;
      ctx.fillStyle = detailFill;
      ctx.lineWidth = 0.018;
      if (fill) ctx.fill(); else ctx.stroke();
    };
    if (sc && sc.glow) {
      // Quầng sáng mờ quanh quân.
      const halo = ctx.createRadialGradient(0, 0.05, 0.08, 0, 0.05, 0.66);
      halo.addColorStop(0, rgba(sc.glow, 0.5)); halo.addColorStop(1, rgba(sc.glow, 0));
      ctx.fillStyle = halo; ctx.fillRect(-0.7, -0.65, 1.4, 1.4);
    }
    ctx.beginPath(); ctx.ellipse(0.025, 0.423, 0.34, 0.057, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(24,15,8,.3)'; ctx.fill();
    shape(ctx, paint, detail);
    // Đế hai tầng, mép trên bo cong, bậc dưới rộng và nặng hơn.
    CHESS_SHAPES.ring(ctx, paint, 0.245, 0.24);
    ctx.beginPath(); ctx.moveTo(-0.24, 0.29);
    ctx.bezierCurveTo(-0.25, 0.325, -0.3, 0.315, -0.3, 0.37);
    ctx.lineTo(-0.3, 0.395);
    ctx.bezierCurveTo(-0.19, 0.435, 0.19, 0.435, 0.3, 0.395);
    ctx.lineTo(0.3, 0.37);
    ctx.bezierCurveTo(0.3, 0.315, 0.25, 0.325, 0.24, 0.29);
    ctx.closePath(); paint();
    ctx.beginPath(); ctx.moveTo(-0.285, 0.365);
    ctx.bezierCurveTo(-0.12, 0.391, 0.12, 0.391, 0.285, 0.365); detail();
    ctx.restore();
  }

  /* ---------- Quân cờ tướng ---------- */
  const HAN = { r: ['俥', '車'], n: ['傌', '馬'], b: ['相', '象'], a: ['仕', '士'], k: ['帥', '將'], c: ['炮', '砲'], p: ['兵', '卒'] };
  const VIET = { r: 'Xe', n: 'Mã', b: 'Tượng', a: 'Sĩ', k: 'Tướng', c: 'Pháo', p: 'Tốt' };

  /** Chữ (hoặc dấu ?) của quân cờ tướng, dùng chung cho đường vector và đường atlas. */
  function drawXiangqiLabel(ctx, cx, cy, cell, t, red, vi, hidden, sc, ink) {
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    let label, textY;
    if (hidden) {
      ctx.font = '700 ' + Math.round(cell * 0.4) + 'px "Noto Serif", serif';
      label = '?'; textY = cy + cell * 0.02;
    } else if (vi) {
      const word = VIET[t] || '?';
      ctx.font = '700 ' + Math.round(cell * (word.length > 4 ? 0.22 : 0.27)) + 'px "Noto Serif", "Times New Roman", serif';
      label = word; textY = cy + cell * 0.02;
    } else {
      const han = HAN[t];
      ctx.font = '700 ' + Math.round(cell * 0.46) + 'px "Noto Serif CJK SC", "Noto Serif SC", "SimSun", "Microsoft YaHei", serif';
      label = han ? han[red ? 0 : 1] : '?'; textY = cy + cell * 0.03;
    }
    ctx.fillStyle = sc ? (lum(ink) < 0.4 ? 'rgba(255,255,255,.55)' : 'rgba(0,0,0,.4)') : '#fff0c8'; ctx.fillText(label, cx + cell * 0.009, textY + cell * 0.025);
    ctx.fillStyle = ink; ctx.fillText(label, cx, textY);
  }

  function drawXiangqiPiece(ctx, cx, cy, cell, ch, vi, rendering, skin, atlas) {
    if (atlas && skin && skin.c) {
      // Thân tròn 108px của ô disc khớp đường kính quân vector (0,86·ô); chữ vẽ lên trên.
      const T = cell * 0.86 * ATLAS_CELL / 108, red = ch === ch.toUpperCase(), t = ch.toLowerCase();
      ctx.save();
      paintAtlasCell(ctx, atlas, ATLAS_COL.disc, red ? 0 : 1, cx - T / 2, cy - T / 2, T);
      drawXiangqiLabel(ctx, cx, cy, cell, t, red, vi, t === 'x', skin.c, readableOn(skin.c.base, skin.c.accent));
      ctx.restore();
      return;
    }
    if (!rendering && ctx.canvas && ctx.canvas.ownerDocument && ctx.getTransform) {
      const scale = Math.max(1, Math.abs(ctx.getTransform().a));
      const pixels = Math.ceil(cell * 1.2 * scale);
      const key = ch + ':' + vi + ':' + pixels + ':' + cell + (skin ? ':' + skin.id : '');
      const cache = drawXiangqiPiece.cache || (drawXiangqiPiece.cache = new Map());
      if (!cache.has(key)) {
        if (cache.size >= 96) cache.clear();
        const canvas = ctx.canvas.ownerDocument.createElement('canvas');
        canvas.width = pixels; canvas.height = pixels;
        const buffer = canvas.getContext('2d');
        if (buffer) {
          buffer.scale(pixels / (cell * 1.2), pixels / (cell * 1.2));
          drawXiangqiPiece(buffer, cell * 0.6, cell * 0.6, cell, ch, vi, true, skin);
          cache.set(key, canvas);
        }
      }
      if (cache.has(key)) {
        ctx.drawImage(cache.get(key), cx - cell * 0.6, cy - cell * 0.6, cell * 1.2, cell * 1.2);
        return;
      }
    }
    const red = ch === ch.toUpperCase();
    const t = ch.toLowerCase();
    const hidden = t === 'x';
    const rad = cell * 0.43;
    const depth = cell * 0.065;
    let ink = red ? '#9e2420' : '#211d18';
    const sc = skin && skin.c;
    const sb = sc ? sc.base : null;
    if (sc) ink = readableOn(sb, sc.accent);
    ctx.save();
    if (sc && sc.glow) {
      const halo = ctx.createRadialGradient(cx, cy, rad * 0.6, cx, cy, rad * 1.38);
      halo.addColorStop(0, rgba(sc.glow, 0.5)); halo.addColorStop(1, rgba(sc.glow, 0));
      ctx.fillStyle = halo; ctx.fillRect(cx - cell * 0.6, cy - cell * 0.6, cell * 1.2, cell * 1.2);
    }
    ctx.beginPath(); ctx.ellipse(cx + cell * 0.025, cy + rad * 0.87, rad * 1.04, rad * 0.3, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(35,20,7,.26)'; ctx.fill();
    // Elip dưới lệch xuống tạo thành cạnh gỗ dày, không chỉ là bóng đổ.
    const edge = ctx.createLinearGradient(cx, cy, cx, cy + rad + depth);
    if (sc) { edge.addColorStop(0, mixc(sb, '#000000', 0.15)); edge.addColorStop(0.78, mixc(sb, '#000000', 0.32)); edge.addColorStop(1, mixc(sb, '#000000', 0.58)); }
    else { edge.addColorStop(0, '#c99b5c'); edge.addColorStop(0.78, '#a6743c'); edge.addColorStop(1, '#61401f'); }
    ctx.beginPath(); ctx.ellipse(cx, cy + depth, rad, rad * 0.94, 0, 0, Math.PI * 2);
    ctx.fillStyle = edge; ctx.fill(); ctx.strokeStyle = sc ? mixc(sb, '#000000', 0.5) : '#674321'; ctx.lineWidth = Math.max(0.7, cell * 0.02); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(cx, cy + depth * 0.75, rad * 0.98, rad * 0.94, 0, 0.15, Math.PI - 0.15);
    ctx.strokeStyle = sc ? rgba(mixc(sb, '#ffffff', 0.5), 0.5) : 'rgba(255,221,157,.5)'; ctx.lineWidth = Math.max(0.5, cell * 0.012); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(cx, cy, rad, rad * 0.94, 0, 0, Math.PI * 2);
    const wood = ctx.createLinearGradient(cx - rad, cy - rad, cx + rad, cy + rad);
    if (sc) {
      wood.addColorStop(0, mixc(sb, '#ffffff', 0.25)); wood.addColorStop(0.38, sb); wood.addColorStop(1, mixc(sb, '#000000', 0.22));
    } else {
      wood.addColorStop(0, hidden ? '#efd09b' : '#fff2d1');
      wood.addColorStop(0.38, hidden ? '#dfbc80' : '#f2d8a6');
      wood.addColorStop(1, hidden ? '#ae7c40' : '#c39455');
    }
    ctx.fillStyle = wood; ctx.fill();
    ctx.strokeStyle = sc ? mixc(sb, '#000000', 0.4) : '#9b6a35'; ctx.lineWidth = Math.max(0.7, cell * 0.018); ctx.stroke();
    // Vành khắc đôi: mép sáng dưới nét khắc tối cho cảm giác lõm.
    for (const ring of [0.86, 0.76]) {
      ctx.beginPath(); ctx.ellipse(cx, cy + cell * 0.015, rad * ring, rad * ring * 0.94, 0, 0, Math.PI * 2);
      ctx.strokeStyle = sc ? rgba(mixc(sb, '#ffffff', 0.6), 0.8) : 'rgba(255,246,215,.85)'; ctx.lineWidth = Math.max(0.7, cell * 0.018); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(cx, cy, rad * ring, rad * ring * 0.94, 0, 0, Math.PI * 2);
      ctx.strokeStyle = ink; ctx.lineWidth = Math.max(0.7, cell * 0.018); ctx.stroke();
    }
    drawXiangqiLabel(ctx, cx, cy, cell, t, red, vi, hidden, sc, ink);
    ctx.restore();
  }

  /* ---------- Vẽ nền ---------- */
  /** Skin sân cờ vua: ảnh nửa sân (nếu đã tải) rồi phủ ô sáng/tối theo palette; chưa có ảnh thì tô đặc. */
  function skinChessFields(ctx, g, flip, sk) {
    const m = g.margin || 0, used = { a: false, b: false };
    for (const h of chessHalves(g, flip)) {
      const f = sk[h.side].field;
      if (!f) continue;
      const dest = h.rotated ? { x: g.ox - m * g.cell, y: g.oy - m * g.cell, w: (8 + 2 * m) * g.cell, h: (4 + m) * g.cell }
        : { x: g.ox - m * g.cell, y: g.oy + 4 * g.cell, w: (8 + 2 * m) * g.cell, h: (4 + m) * g.cell };
      const v2 = paintField2(ctx, dest, h.rotated, f, m, sk.onAsset);
      used[h.side] = v2;
      const img = v2 || (v2Pending(f) ? false : paintFieldImage(ctx, h.rect, h.rotated, f, sk.onAsset));
      for (let r = h.side === 'a' ? 0 : 4; r < (h.side === 'a' ? 4 : 8); r++) for (let c = 0; c < 8; c++) {
        const p = cellXY(g, c, r, flip), dark = (c + r) % 2 === 0;
        ctx.fillStyle = v2 ? (dark ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.06)') : img ? rgba(dark ? f.pal.dark : f.pal.light, dark ? 0.7 : 0.55) : (dark ? f.pal.dark : f.pal.light);
        ctx.fillRect(p.x - g.cell / 2, p.y - g.cell / 2, g.cell, g.cell);
      }
    }
    const seam = g.oy + g.cell * 4;
    seamBand(ctx, g, g.ox - m * g.cell, (8 + 2 * m) * g.cell, seam, halfTone(sk[flip ? 'a' : 'b'].field, '#d3b88e'), halfTone(sk[flip ? 'b' : 'a'].field, '#d3b88e'));
    return used;
  }

  function drawChessBoard(ctx, g, flip, sk) {
    const mg = g.margin || 0;
    if (mg > 0) {
      // Dải cảnh của nửa không có skin: màu gỗ sẫm để không lộ nền trong suốt.
      for (const h of chessHalves(g, flip)) {
        if (sk && sk[h.side].field) continue;
        ctx.fillStyle = '#2a1c12';
        ctx.fillRect(g.ox - mg * g.cell, h.rotated ? g.oy - mg * g.cell : g.oy + 4 * g.cell, (8 + 2 * mg) * g.cell, (4 + mg) * g.cell);
      }
    }
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      const p = cellXY(g, c, r, flip);
      ctx.fillStyle = (c + r) % 2 === 0 ? '#b58863' : '#f0d9b5'; // ô a1 là ô sẫm
      ctx.fillRect(p.x - g.cell / 2, p.y - g.cell / 2, g.cell, g.cell);
    }
    const v2 = hasField(sk) ? skinChessFields(ctx, g, flip, sk) : { a: false, b: false };
    ctx.save();
    if (v2.a && v2.b) { ctx.beginPath(); ctx.rect(0, 0, 0, 0); ctx.clip(); }
    else if (v2.a || v2.b) {
      // Vân và khung gỗ chỉ vẽ cho nửa không có ảnh v2.
      const other = chessHalves(g, flip).find(h => !v2[h.side]);
      ctx.beginPath(); ctx.rect(other.rect.x, other.rect.y, other.rect.w, other.rect.h); ctx.clip();
    }
    // Vân mảnh liên tục trên các ô, không che nhãn hay nước đi.
    ctx.strokeStyle = 'rgba(93,53,25,.09)'; ctx.lineWidth = Math.max(0.45, g.cell * 0.009);
    for (let i = 0; i < 32; i++) {
      const y = g.oy + g.cell * (i + 0.45) / 4;
      const bend = Math.sin(i * 2.3) * g.cell * 0.09;
      ctx.beginPath(); ctx.moveTo(g.ox, y);
      ctx.bezierCurveTo(g.ox + g.cell * 2.5, y + bend, g.ox + g.cell * 5, y - bend, g.ox + g.cell * 8, y);
      ctx.stroke();
    }
    // Khung nằm trong mép ngoài; giữ nguyên ô và vùng chạm đã chốt.
    const edge = Math.max(1.5, g.cell * 0.065);
    const frame = ctx.createLinearGradient(g.ox, g.oy, g.ox + g.cell * 8, g.oy + g.cell * 8);
    frame.addColorStop(0, '#d1a46a'); frame.addColorStop(0.45, '#84522d'); frame.addColorStop(1, '#492b19');
    ctx.strokeStyle = frame; ctx.lineWidth = edge;
    ctx.strokeRect(g.ox + edge / 2, g.oy + edge / 2, g.cell * 8 - edge, g.cell * 8 - edge);
    ctx.strokeStyle = 'rgba(255,227,174,.65)'; ctx.lineWidth = Math.max(0.5, g.cell * 0.012);
    ctx.strokeRect(g.ox + edge, g.oy + edge, g.cell * 8 - edge * 2, g.cell * 8 - edge * 2);
    ctx.restore();
    ctx.font = '600 ' + Math.max(9, Math.round(g.cell * 0.2)) + 'px system-ui, sans-serif';
    ctx.textBaseline = 'alphabetic';
    for (let i = 0; i < 8; i++) {
      const pf = cellXY(g, i, flip ? 7 : 0, flip), pr = cellXY(g, flip ? 7 : 0, i, flip);
      // Nhãn đổi màu theo palette khi ô nằm trên nửa sân có skin.
      const labelColor = (col, row) => {
        const f = sk && sk[row < 4 ? 'a' : 'b'].field, even = (col + row) % 2 === 0;
        return f ? (even ? f.pal.light : f.pal.dark) : (even ? '#f0d9b5' : '#b58863');
      };
      ctx.textAlign = 'right';
      ctx.fillStyle = labelColor(i, flip ? 7 : 0);
      ctx.fillText(FILES[i], pf.x + g.cell / 2 - 3, pf.y + g.cell / 2 - 3);
      ctx.textAlign = 'left';
      ctx.fillStyle = labelColor(flip ? 7 : 0, i);
      ctx.fillText(String(i + 1), pr.x - g.cell / 2 + 3, pr.y - g.cell / 2 + g.cell * 0.2 + 1);
    }
  }

  function riverWave(u, k, t) {
    const sp = [0.00022, 0.00031, 0.00017][k % 3], fr = [9, 14, 6][k % 3], am = [0.05, 0.03, 0.06][k % 3];
    return Math.sin(u * fr * Math.PI * 2 - (t || 0) * sp * Math.PI * 2 + k * 1.7) * am;
  }

  function drawRiver(ctx, g, flip, vi, t) {
    const y4 = cellXY(g, 0, 4, flip).y, y5 = cellXY(g, 0, 5, flip).y;
    const y0 = Math.min(y4, y5), y1 = Math.max(y4, y5), hh = y1 - y0;
    const mm = g.margin > 0 ? g.margin : 0.1;
    const x0 = g.ox - g.cell * mm, x1 = g.ox + g.cell * (8 + mm);
    const frac = value => value - Math.floor(value);
    ctx.save(); ctx.beginPath(); ctx.rect(x0, y0, x1 - x0, hh); ctx.clip();
    const water = ctx.createLinearGradient(0, y0, 0, y1);
    water.addColorStop(0, '#1f6f86'); water.addColorStop(0.5, '#3fa3b8'); water.addColorStop(1, '#1f6f86');
    ctx.fillStyle = water; ctx.fillRect(x0, y0, x1 - x0, hh);
    for (let k = 0; k < 3; k++) {
      ctx.beginPath(); ctx.strokeStyle = 'rgba(191,238,242,' + [0.55, 0.4, 0.3][k] + ')';
      ctx.lineWidth = Math.max(1, g.cell * [0.045, 0.03, 0.05][k]); ctx.lineCap = 'round';
      for (let i = 0; i <= 32; i++) {
        const u = i / 32, x = x0 + (x1 - x0) * u;
        const y = y0 + hh * [0.3, 0.52, 0.74][k] + riverWave(u, k, t) * g.cell;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    for (let i = 0; i < 10; i++) {
      const u = frac(i * 0.137 + (t || 0) * 0.00004 * (1 + (i % 3) * 0.4));
      ctx.beginPath(); ctx.ellipse(x0 + (x1 - x0) * u, y0 + hh * (0.18 + 0.64 * frac(i * 0.618)), g.cell * 0.06, g.cell * 0.0125, 0, 0, Math.PI * 2); ctx.fill();
    }
    for (let i = 0; i < 3; i++) {
      const x = x0 + (x1 - x0) * frac(i * 0.337 + (t || 0) * 0.00004 / 3);
      const y = y0 + hh * (0.3 + 0.4 * frac(i * 0.618));
      ctx.fillStyle = '#3f8f4f'; ctx.beginPath(); ctx.arc(x, y, g.cell * 0.13, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#1f6f86'; ctx.lineWidth = Math.max(1, g.cell * 0.025);
      ctx.beginPath(); ctx.moveTo(x + g.cell * 0.13, y - g.cell * 0.045); ctx.lineTo(x, y); ctx.lineTo(x + g.cell * 0.13, y + g.cell * 0.045); ctx.stroke();
      ctx.fillStyle = '#ff9fb8'; ctx.beginPath(); ctx.arc(x + g.cell * 0.15, y - g.cell * 0.08, g.cell * 0.045, 0, Math.PI * 2); ctx.fill();
    }
    for (const top of [true, false]) {
      const edge = top ? y0 : y1, inner = edge + hh * 0.16 * (top ? 1 : -1);
      const sand = ctx.createLinearGradient(0, edge, 0, inner);
      sand.addColorStop(0, 'rgba(217,192,138,0.9)'); sand.addColorStop(1, 'rgba(217,192,138,0)');
      ctx.fillStyle = sand; ctx.fillRect(x0, Math.min(edge, inner), x1 - x0, hh * 0.16);
      ctx.strokeStyle = 'rgba(8,30,40,.35)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x0, edge); ctx.lineTo(x1, edge); ctx.stroke();
    }
    ctx.restore();
    const mid = (y0 + y1) / 2;
    ctx.fillStyle = '#fff8e2'; ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
    ctx.font = '700 ' + Math.round(g.cell * (vi ? 0.34 : 0.42)) + 'px "Noto Serif CJK SC", "Noto Serif", "Microsoft YaHei", serif';
    const river = [vi ? 'Sở Hà' : '楚河', vi ? 'Hán Giới' : '漢界'];
    ctx.strokeStyle = 'rgba(8,30,40,.75)'; ctx.lineWidth = Math.max(2, g.cell * 0.09); ctx.lineJoin = 'round';
    if (ctx.strokeText) { ctx.strokeText(river[0], g.ox + g.cell * 2, mid); ctx.strokeText(river[1], g.ox + g.cell * 6, mid); }
    ctx.fillText(river[0], g.ox + g.cell * 2, mid); ctx.fillText(river[1], g.ox + g.cell * 6, mid);
  }

  function drawXiangqiBoard(ctx, g, flip, vi, sk, t) {
    const m = g.cell * 0.6;
    const mg = g.margin > 0 ? g.margin : 0, mv = mg > 0 ? mg : 0.6;
    const destOf = h => (h.rotated ? { x: g.ox - mv * g.cell, y: g.oy - mv * g.cell, w: (8 + 2 * mv) * g.cell, h: (4 + mv) * g.cell }
      : { x: g.ox - mv * g.cell, y: g.oy + 5 * g.cell, w: (8 + 2 * mv) * g.cell, h: (4 + mv) * g.cell });
    if (mg > 0) {
      // Dải cảnh của nửa không có skin: màu gỗ sẫm, bàn mặc định vẽ đè lên sau.
      for (const h of xiangqiHalves(g, flip)) {
        if (sk && sk[h.side].field) continue;
        const d = destOf(h);
        ctx.fillStyle = '#2a1c12'; ctx.fillRect(d.x, d.y, d.w, d.h);
      }
    }
    const wood = ctx.createLinearGradient(0, g.oy - m, g.w, g.oy + g.cell * 9 + m);
    wood.addColorStop(0, '#f5db9f'); wood.addColorStop(0.5, '#e9c88b'); wood.addColorStop(1, '#cca363');
    ctx.fillStyle = wood;
    ctx.fillRect(g.ox - m, g.oy - m, g.cell * 8 + m * 2, g.cell * 9 + m * 2);
    ctx.save();
    ctx.beginPath(); ctx.rect(g.ox - m, g.oy - m, g.cell * 8 + m * 2, g.cell * 9 + m * 2); ctx.clip();
    ctx.lineWidth = Math.max(0.45, g.cell * 0.009); ctx.strokeStyle = 'rgba(111,67,24,.1)';
    for (let i = 0; i < 40; i++) {
      const y = g.oy - m + g.cell * (i + 0.5) * 0.255;
      const bend = Math.sin(i * 1.7) * g.cell * 0.13;
      ctx.beginPath(); ctx.moveTo(g.ox - m, y);
      ctx.bezierCurveTo(g.w * 0.3, y + bend, g.w * 0.7, y - bend, g.ox + g.cell * 8 + m, y);
      ctx.stroke();
    }
    const edge = Math.max(2, g.cell * 0.09);
    ctx.lineWidth = edge; ctx.strokeStyle = '#80512d';
    ctx.strokeRect(g.ox - m + edge / 2, g.oy - m + edge / 2, g.cell * 8 + m * 2 - edge, g.cell * 9 + m * 2 - edge);
    ctx.lineWidth = Math.max(0.6, g.cell * 0.02); ctx.strokeStyle = '#f9e1ac';
    ctx.strokeRect(g.ox - m + edge, g.oy - m + edge, g.cell * 8 + m * 2 - edge * 2, g.cell * 9 + m * 2 - edge * 2);
    ctx.restore();
    const v2 = { a: false, b: false };
    if (hasField(sk)) for (const h of xiangqiHalves(g, flip)) {
      const f = sk[h.side].field;
      if (f) v2[h.side] = paintField2(ctx, destOf(h), h.rotated, f, mv, sk.onAsset);
    }
    const P = (c, r) => cellXY(g, c, r, flip);
    // style = null: nét mặc định; có style: { color, k } (k nhân độ dày nét).
    const strokeGrid = style => {
      ctx.strokeStyle = style ? style.color : '#5b3a1c'; ctx.lineWidth = Math.max(1, g.cell * 0.035) * (style ? style.k : 1); ctx.lineCap = 'round';
      const line = (a, b) => { ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); };
      for (let r = 0; r < 10; r++) line(P(0, r), P(8, r));
      line(P(0, 0), P(0, 9)); line(P(8, 0), P(8, 9));
      for (let c = 1; c < 8; c++) { line(P(c, 0), P(c, 4)); line(P(c, 5), P(c, 9)); }
      line(P(3, 0), P(5, 2)); line(P(5, 0), P(3, 2)); line(P(3, 7), P(5, 9)); line(P(5, 7), P(3, 9));
      ctx.lineWidth = Math.max(2, g.cell * 0.07) * (style ? style.k : 1);
      ctx.strokeRect(g.ox - g.cell * 0.1, g.oy - g.cell * 0.1, g.cell * 8.2, g.cell * 9.2);
    };
    const skinned = hasField(sk);
    if (!skinned) strokeGrid(null);
    else {
      const halves = xiangqiHalves(g, flip);
      const fieldOf = h => sk[h.side].field;
      for (const h of halves) {
        const f = fieldOf(h);
        if (!f) continue;
        // Nền: ảnh v2 (đã vẽ ở trên) + lớp sáng rất nhẹ; không thì ảnh v1 + lớp sáng mờ; chưa có ảnh thì tô đặc theo palette.
        if (v2[h.side]) { ctx.fillStyle = 'rgba(255,255,255,0.10)'; ctx.fillRect(h.rect.x, h.rect.y, h.rect.w, h.rect.h); continue; }
        if (!v2Pending(f) && paintFieldImage(ctx, h.rect, h.rotated, f, sk.onAsset)) ctx.fillStyle = rgba(mixc(f.pal.light, '#ffffff', 0.2), 0.38);
        else ctx.fillStyle = mixc(f.pal.light, f.pal.dark, 0.3);
        ctx.fillRect(h.rect.x, h.rect.y, h.rect.w, h.rect.h);
      }
      const top = halves.find(h => h.rotated), bottom = halves.find(h => !h.rotated);
      seamBand(ctx, g, g.ox - mv * g.cell, g.cell * (8 + 2 * mv), g.oy + g.cell * 4.5, halfTone(fieldOf(top), '#e9c88b'), halfTone(fieldOf(bottom), '#e9c88b'));
      for (const h of halves) {
        const f = fieldOf(h);
        ctx.save(); ctx.beginPath(); ctx.rect(h.full.x, h.full.y, h.full.w, h.full.h); ctx.clip();
        if (f) { strokeGrid({ color: 'rgba(12,7,3,.6)', k: 2 }); strokeGrid({ color: f.pal.line, k: 1 }); } else strokeGrid(null);
        ctx.restore();
      }
    }
    drawRiver(ctx, g, flip, vi, t);
  }

  /**
   * Vẽ cả bàn.
   * o = { game, w, h, dpr, board, flip, selected, targets:[tên ô], last:[từ, đến], checkSq, vi,
   *   skins: { a:{field,pieces}, b:{…} }   (tuỳ chọn; chỉ cờ vua/tướng/úp)
   *   hideSkins: { a, b }                  (bên nào true thì vẽ mặc định)
   *   jolt: { 'e4':{dx,dy} } | (x, y) => {dx,dy}   (độ lệch tạm của quân, px CSS)
   *   onAsset: () => void                  (gọi khi ảnh nửa sân tải xong, để vẽ lại)
   *   catalog: KydaoSkins                  (tuỳ chọn; mặc định global KydaoSkins) }
   * Trả về hình học (layout) dùng để đổi chạm → ô.
   */
  function starPoints(size) {
    const edge = size === 9 ? 2 : 3, mid = (size - 1) / 2;
    return size === 9 ? [[edge, edge], [edge, size - 1 - edge], [size - 1 - edge, edge], [size - 1 - edge, size - 1 - edge], [mid, mid]] : [edge, mid, size - 1 - edge].flatMap(x => [edge, mid, size - 1 - edge].map(y => [x, y]));
  }

  function drawGridBoard(ctx, g, flip) {
    const wood = ctx.createLinearGradient(0, 0, g.w, g.h);
    wood.addColorStop(0, '#efcf94'); wood.addColorStop(1, '#bd8d50');
    ctx.fillStyle = wood; ctx.fillRect(0, 0, g.w, g.h);
    ctx.strokeStyle = '#634525'; ctx.lineWidth = 1;
    for (let i = 0; i < g.cols; i++) {
      const a = cellXY(g, i, 0, false), b = cellXY(g, i, g.rows - 1, false);
      const c = cellXY(g, 0, i, false), d = cellXY(g, g.cols - 1, i, false);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.moveTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.stroke();
    }
    if (g.game === 'go') starPoints(g.cols).forEach(([x, y]) => {
      const p = cellXY(g, x, y, flip); ball(ctx, p.x, p.y, Math.max(2, g.cell * 0.09)); ctx.fillStyle = '#53391e'; ctx.fill();
    });
    ctx.font = Math.max(9, g.cell * 0.32) + 'px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#53391e';
    for (let i = 0; i < g.cols; i++) {
      const p = cellXY(g, i, 0, flip), q = cellXY(g, 0, i, flip);
      ctx.fillText((g.game === 'go' ? GO_FILES : FILES)[i], p.x, g.h - g.cell * 0.3);
      ctx.fillText(String(i + 1), g.cell * 0.3, q.y);
    }
  }

  function drawStone(ctx, p, cell, side, game) {
    const r = cell * 0.44;
    if (game === 'gomoku') {
      ctx.strokeStyle = side === 'a' ? '#8f2520' : '#252d37'; ctx.lineWidth = Math.max(2, cell * 0.1); ctx.lineCap = 'round';
      ctx.beginPath();
      if (side === 'a') { ctx.moveTo(p.x - r * 0.7, p.y - r * 0.7); ctx.lineTo(p.x + r * 0.7, p.y + r * 0.7); ctx.moveTo(p.x + r * 0.7, p.y - r * 0.7); ctx.lineTo(p.x - r * 0.7, p.y + r * 0.7); }
      else ctx.arc(p.x, p.y, r * 0.8, 0, Math.PI * 2);
      ctx.stroke(); return;
    }
    ctx.save(); ctx.shadowColor = 'rgba(25,15,5,.45)'; ctx.shadowBlur = cell * 0.14; ctx.shadowOffsetY = cell * 0.07;
    const shade = ctx.createRadialGradient(p.x - r * 0.35, p.y - r * 0.4, r * 0.1, p.x, p.y, r);
    shade.addColorStop(0, side === 'a' ? '#65666a' : '#fffef4'); shade.addColorStop(1, side === 'a' ? '#0c0e12' : '#bdb9ad');
    ball(ctx, p.x, p.y, r); ctx.fillStyle = shade; ctx.fill(); ctx.restore();
  }

  function draw(ctx, o) {
    const g = layout(o.game, o.w, o.h, o.size, o.margin);
    const flip = !!o.flip, chess = isChess(o.game);
    ctx.setTransform((o.dpr || 1), 0, 0, (o.dpr || 1), 0, 0);
    ctx.clearRect(0, 0, o.w, o.h);
    // Skin chỉ dành cho cờ vua / cờ tướng / cờ úp; không có o.skins thì vẽ y như cũ.
    const sk = isGrid(o.game) ? null : resolveSkins(o);
    const skinMark = hasField(sk);
    if (isGrid(o.game)) drawGridBoard(ctx, g, flip);
    else if (chess) drawChessBoard(ctx, g, flip, sk); else drawXiangqiBoard(ctx, g, flip, !!o.vi, sk, o.time);
    const at = name => { const q = parseSq(o.game, name, o.size); return q ? cellXY(g, q.col, q.row, flip) : null; };
    const mark = (name, style) => {
      const p = at(name); if (!p) return;
      ctx.fillStyle = style;
      if (chess) ctx.fillRect(p.x - g.cell / 2, p.y - g.cell / 2, g.cell, g.cell);
      else { ctx.beginPath(); ctx.arc(p.x, p.y, g.cell * 0.46, 0, Math.PI * 2); ctx.fill(); }
      if (skinMark) {
        // Viền tối–sáng để dấu vẫn nổi trên mọi nền skin.
        ctx.lineWidth = Math.max(1.5, g.cell * 0.04);
        ctx.strokeStyle = 'rgba(20,12,4,.55)';
        if (chess) ctx.strokeRect(p.x - g.cell / 2 + 1, p.y - g.cell / 2 + 1, g.cell - 2, g.cell - 2);
        else { ctx.beginPath(); ctx.arc(p.x, p.y, g.cell * 0.46, 0, Math.PI * 2); ctx.stroke(); }
      }
    };
    // Độ lệch tạm của quân khi chấn động: map theo tên ô hoặc hàm (x, y px CSS) → {dx, dy}.
    const joltAt = (name, p) => {
      if (!o.jolt) return null;
      const j = typeof o.jolt === 'function' ? o.jolt(p.x, p.y) : (Object.prototype.hasOwnProperty.call(o.jolt, name) ? o.jolt[name] : null);
      if (!j || typeof j !== 'object') return null;
      const dx = Number(j.dx) || 0, dy = Number(j.dy) || 0;
      return dx || dy ? { dx, dy } : null;
    };
    (o.last || []).forEach(n => mark(n, 'rgba(255,214,64,.42)'));
    if (o.selected) mark(o.selected, 'rgba(80,190,120,.5)');
    if (o.checkSq) {
      const p = at(o.checkSq);
      if (p) {
        const gr = ctx.createRadialGradient(p.x, p.y, g.cell * 0.05, p.x, p.y, g.cell * 0.6);
        gr.addColorStop(0, 'rgba(220,30,30,.95)'); gr.addColorStop(1, 'rgba(220,30,30,0)');
        ctx.fillStyle = gr; ctx.fillRect(p.x - g.cell * 0.6, p.y - g.cell * 0.6, g.cell * 1.2, g.cell * 1.2);
      }
    }
    const cols = g.cols, rows = g.rows;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const ch = o.board && o.board[boardIndex(o.game, c, r, o.size)];
      if (!ch) continue;
      let p = cellXY(g, c, r, flip);
      const j = o.jolt ? joltAt(nameOf(o.game, c, r), p) : null;
      if (j) p = { x: p.x + j.dx, y: p.y + j.dy };
      const pieceSkin = sk && !isGrid(o.game) ? sk[sideOfChar(ch)].pieces : null;
      const atlasImg = atlasImage(pieceSkin, sk && sk.onAsset);
      if (isGrid(o.game)) drawStone(ctx, p, g.cell, ch, o.game);
      else if (chess) drawChessPiece(ctx, p.x, p.y, g.cell * 0.92, ch, false, pieceSkin, atlasImg);
      else {
        const reveal = o.reveal && o.reveal.square === nameOf(o.game, c, r) ? o.reveal.progress : 1;
        ctx.save(); ctx.translate(p.x, p.y); ctx.scale(Math.max(0.08, Math.abs(2 * reveal - 1)), 1);
        drawXiangqiPiece(ctx, 0, 0, g.cell, reveal < 0.5 ? (ch === ch.toUpperCase() ? 'X' : 'x') : ch, !!o.vi, false, pieceSkin, atlasImg); ctx.restore();
      }
    }
    (o.dead || []).forEach(n => { const p = at(n); if (!p) return; ctx.strokeStyle = '#e43c27'; ctx.lineWidth = Math.max(2, g.cell * 0.08); ctx.beginPath(); ctx.moveTo(p.x - g.cell * 0.22, p.y - g.cell * 0.22); ctx.lineTo(p.x + g.cell * 0.22, p.y + g.cell * 0.22); ctx.moveTo(p.x + g.cell * 0.22, p.y - g.cell * 0.22); ctx.lineTo(p.x - g.cell * 0.22, p.y + g.cell * 0.22); ctx.stroke(); });
    if (o.win && o.win.length) {
      ctx.strokeStyle = '#208349'; ctx.lineWidth = Math.max(3, g.cell * 0.14); ctx.beginPath();
      o.win.forEach((n, i) => { const p = at(n); if (p) { if (i) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y); } }); ctx.stroke();
    }
    // chấm ô đi được (vẽ sau quân để thấy cả ô có quân bị ăn)
    (o.targets || []).forEach(n => {
      const p = at(n); if (!p) return;
      const q = parseSq(o.game, n);
      const occupied = !!(o.board && o.board[boardIndex(o.game, q.col, q.row)]);
      ctx.beginPath();
      if (occupied) {
        ctx.arc(p.x, p.y, g.cell * (chess ? 0.46 : 0.47), 0, Math.PI * 2);
        ctx.lineWidth = Math.max(2, g.cell * 0.07); ctx.strokeStyle = 'rgba(200,40,40,.85)'; ctx.stroke();
      } else {
        ctx.arc(p.x, p.y, g.cell * 0.14, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(40,120,70,.7)'; ctx.fill();
        if (skinMark) { ctx.lineWidth = Math.max(1.2, g.cell * 0.03); ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.stroke(); }
      }
    });
    return g;
  }

  return { aspect, layout, cellXY, squareAt, nameOf, parseSq, boardIndex, draw, starPoints, HAN, VIET, resolveSkins, loadImage, imageState, riverWave };
});
