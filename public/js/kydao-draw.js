/*
 * Kỳ Đạo · Vẽ bàn cờ bằng Canvas 2D (KydaoDraw): cờ vua 8×8 và cờ tướng 9×10.
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

  const FILES = 'abcdefghi';
  const DIMS = { chess: { cols: 8, rows: 8 }, xiangqi: { cols: 9, rows: 10 } };
  const dimOf = game => (game === 'chess' ? DIMS.chess : DIMS.xiangqi); // jieqi dùng bàn cờ tướng
  const isChess = game => game === 'chess';

  /** Tỉ lệ rộng/cao nên có của canvas. */
  function aspect(game) { return isChess(game) ? 1 : 9.2 / 10.2; }

  /** Hình học cho canvas w×h (px CSS). */
  function layout(game, w, h) {
    const d = dimOf(game);
    if (isChess(game)) {
      const cell = Math.floor(Math.min(w, h) / 8);
      return { game, cols: 8, rows: 8, cell, ox: Math.round((w - cell * 8) / 2), oy: Math.round((h - cell * 8) / 2), w, h };
    }
    const cell = Math.min(w / 9.2, h / 10.2);
    return { game, cols: d.cols, rows: d.rows, cell, ox: (w - cell * 8) / 2, oy: (h - cell * 9) / 2, w, h };
  }

  /** Tâm của ô (cờ vua) / giao điểm (cờ tướng) tại toạ độ logic. */
  function cellXY(g, col, row, flip) {
    const c = flip ? g.cols - 1 - col : col, r = flip ? g.rows - 1 - row : row;
    if (isChess(g.game)) return { x: g.ox + c * g.cell + g.cell / 2, y: g.oy + (7 - r) * g.cell + g.cell / 2 };
    return { x: g.ox + c * g.cell, y: g.oy + (9 - r) * g.cell };
  }

  const nameOf = (game, col, row) => FILES[col] + (isChess(game) ? row + 1 : row);
  function parseSq(game, name) {
    if (typeof name !== 'string' || name.length < 2) return null;
    const col = FILES.indexOf(name[0]);
    const row = isChess(game) ? Number(name.slice(1)) - 1 : Number(name.slice(1));
    const d = dimOf(game);
    if (col < 0 || col >= d.cols || !Number.isInteger(row) || row < 0 || row >= d.rows) return null;
    return { col, row };
  }
  /** Chỉ số trong board của state. */
  const boardIndex = (game, col, row) => row * dimOf(game).cols + col;

  /** Chạm px,py → tên ô; null nếu ngoài bàn (cờ tướng: phải đủ gần một giao điểm). */
  function squareAt(g, px, py, flip) {
    let c, r;
    if (isChess(g.game)) {
      c = Math.floor((px - g.ox) / g.cell);
      r = 7 - Math.floor((py - g.oy) / g.cell);
    } else {
      c = Math.round((px - g.ox) / g.cell);
      r = 9 - Math.round((py - g.oy) / g.cell);
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

  function drawChessPiece(ctx, cx, cy, size, ch, rendering) {
    if (!rendering && ctx.canvas && ctx.canvas.ownerDocument && ctx.getTransform) {
      const scale = Math.max(1, Math.abs(ctx.getTransform().a));
      const pixels = Math.ceil(size * 1.4 * scale);
      const key = ch + ':' + pixels + ':' + size;
      const cache = drawChessPiece.cache || (drawChessPiece.cache = new Map());
      if (!cache.has(key)) {
        if (cache.size >= 96) cache.clear();
        const canvas = ctx.canvas.ownerDocument.createElement('canvas');
        canvas.width = pixels; canvas.height = pixels;
        const buffer = canvas.getContext('2d');
        if (buffer) {
          buffer.scale(pixels / (size * 1.4), pixels / (size * 1.4));
          drawChessPiece(buffer, size * 0.7, size * 0.7, size, ch, true);
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
    const tones = white ? ['#a78b60', '#f3e7ce', '#fffbed', '#dfcba5', '#9a774d'] :
      ['#0c1010', '#45463f', '#646355', '#242826', '#080b0b'];
    [0, 0.24, 0.38, 0.64, 1].forEach((stop, i) => material.addColorStop(stop, tones[i]));
    const gleam = ctx.createLinearGradient(-0.23, 0, -0.06, 0);
    gleam.addColorStop(0, 'rgba(255,250,225,0)');
    gleam.addColorStop(0.4, white ? 'rgba(255,255,247,.6)' : 'rgba(235,229,203,.22)');
    gleam.addColorStop(1, 'rgba(255,250,225,0)');
    const paint = () => {
      ctx.fillStyle = material; ctx.fill();
      ctx.strokeStyle = white ? '#644b30' : '#080b0b'; ctx.lineWidth = 0.028; ctx.stroke();
      ctx.save(); ctx.clip();
      ctx.fillStyle = gleam; ctx.fillRect(-0.32, -0.52, 0.64, 1);
      // Viền sáng mảnh giúp quân mun tách khỏi ô bàn sẫm.
      ctx.strokeStyle = white ? 'rgba(255,253,237,.7)' : 'rgba(221,207,170,.55)';
      ctx.lineWidth = 0.014; ctx.stroke(); ctx.restore();
    };
    const detail = fill => {
      ctx.strokeStyle = white ? '#745a3b' : '#c5b998';
      ctx.fillStyle = white ? '#3c3024' : '#f2e7cc';
      ctx.lineWidth = 0.018;
      if (fill) ctx.fill(); else ctx.stroke();
    };
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

  function drawXiangqiPiece(ctx, cx, cy, cell, ch, vi, rendering) {
    if (!rendering && ctx.canvas && ctx.canvas.ownerDocument && ctx.getTransform) {
      const scale = Math.max(1, Math.abs(ctx.getTransform().a));
      const pixels = Math.ceil(cell * 1.2 * scale);
      const key = ch + ':' + vi + ':' + pixels + ':' + cell;
      const cache = drawXiangqiPiece.cache || (drawXiangqiPiece.cache = new Map());
      if (!cache.has(key)) {
        if (cache.size >= 96) cache.clear();
        const canvas = ctx.canvas.ownerDocument.createElement('canvas');
        canvas.width = pixels; canvas.height = pixels;
        const buffer = canvas.getContext('2d');
        if (buffer) {
          buffer.scale(pixels / (cell * 1.2), pixels / (cell * 1.2));
          drawXiangqiPiece(buffer, cell * 0.6, cell * 0.6, cell, ch, vi, true);
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
    const ink = red ? '#9e2420' : '#211d18';
    ctx.save();
    ctx.beginPath(); ctx.ellipse(cx + cell * 0.025, cy + rad * 0.87, rad * 1.04, rad * 0.3, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(35,20,7,.26)'; ctx.fill();
    // Elip dưới lệch xuống tạo thành cạnh gỗ dày, không chỉ là bóng đổ.
    const edge = ctx.createLinearGradient(cx, cy, cx, cy + rad + depth);
    edge.addColorStop(0, '#c99b5c'); edge.addColorStop(0.78, '#a6743c'); edge.addColorStop(1, '#61401f');
    ctx.beginPath(); ctx.ellipse(cx, cy + depth, rad, rad * 0.94, 0, 0, Math.PI * 2);
    ctx.fillStyle = edge; ctx.fill(); ctx.strokeStyle = '#674321'; ctx.lineWidth = Math.max(0.7, cell * 0.02); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(cx, cy + depth * 0.75, rad * 0.98, rad * 0.94, 0, 0.15, Math.PI - 0.15);
    ctx.strokeStyle = 'rgba(255,221,157,.5)'; ctx.lineWidth = Math.max(0.5, cell * 0.012); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(cx, cy, rad, rad * 0.94, 0, 0, Math.PI * 2);
    const wood = ctx.createLinearGradient(cx - rad, cy - rad, cx + rad, cy + rad);
    wood.addColorStop(0, hidden ? '#efd09b' : '#fff2d1');
    wood.addColorStop(0.38, hidden ? '#dfbc80' : '#f2d8a6');
    wood.addColorStop(1, hidden ? '#ae7c40' : '#c39455');
    ctx.fillStyle = wood; ctx.fill();
    ctx.strokeStyle = '#9b6a35'; ctx.lineWidth = Math.max(0.7, cell * 0.018); ctx.stroke();
    // Vành khắc đôi: mép sáng dưới nét khắc tối cho cảm giác lõm.
    for (const ring of [0.86, 0.76]) {
      ctx.beginPath(); ctx.ellipse(cx, cy + cell * 0.015, rad * ring, rad * ring * 0.94, 0, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,246,215,.85)'; ctx.lineWidth = Math.max(0.7, cell * 0.018); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(cx, cy, rad * ring, rad * ring * 0.94, 0, 0, Math.PI * 2);
      ctx.strokeStyle = ink; ctx.lineWidth = Math.max(0.7, cell * 0.018); ctx.stroke();
    }
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
    ctx.fillStyle = '#fff0c8'; ctx.fillText(label, cx + cell * 0.009, textY + cell * 0.025);
    ctx.fillStyle = ink; ctx.fillText(label, cx, textY);
    ctx.restore();
  }

  /* ---------- Vẽ nền ---------- */
  function drawChessBoard(ctx, g, flip) {
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      const p = cellXY(g, c, r, flip);
      ctx.fillStyle = (c + r) % 2 === 0 ? '#b58863' : '#f0d9b5'; // ô a1 là ô sẫm
      ctx.fillRect(p.x - g.cell / 2, p.y - g.cell / 2, g.cell, g.cell);
    }
    ctx.save();
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
      ctx.textAlign = 'right';
      ctx.fillStyle = (i + (flip ? 7 : 0)) % 2 === 0 ? '#f0d9b5' : '#b58863';
      ctx.fillText(FILES[i], pf.x + g.cell / 2 - 3, pf.y + g.cell / 2 - 3);
      ctx.textAlign = 'left';
      ctx.fillStyle = (i + (flip ? 7 : 0)) % 2 === 0 ? '#f0d9b5' : '#b58863';
      ctx.fillText(String(i + 1), pr.x - g.cell / 2 + 3, pr.y - g.cell / 2 + g.cell * 0.2 + 1);
    }
  }

  function drawXiangqiBoard(ctx, g, flip, vi) {
    const m = g.cell * 0.6;
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
    ctx.strokeStyle = '#5b3a1c'; ctx.lineWidth = Math.max(1, g.cell * 0.035); ctx.lineCap = 'round';
    const P = (c, r) => cellXY(g, c, r, flip);
    const line = (a, b) => { ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); };
    for (let r = 0; r < 10; r++) line(P(0, r), P(8, r));
    line(P(0, 0), P(0, 9)); line(P(8, 0), P(8, 9));
    for (let c = 1; c < 8; c++) { line(P(c, 0), P(c, 4)); line(P(c, 5), P(c, 9)); }
    line(P(3, 0), P(5, 2)); line(P(5, 0), P(3, 2)); line(P(3, 7), P(5, 9)); line(P(5, 7), P(3, 9));
    ctx.lineWidth = Math.max(2, g.cell * 0.07);
    ctx.strokeRect(g.ox - g.cell * 0.1, g.oy - g.cell * 0.1, g.cell * 8.2, g.cell * 9.2);
    // chữ trên sông (đọc xuôi ở cả hai hướng nhìn)
    const mid = (P(0, 4).y + P(0, 5).y) / 2;
    ctx.fillStyle = '#5b3a1c'; ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
    ctx.font = '700 ' + Math.round(g.cell * (vi ? 0.34 : 0.42)) + 'px "Noto Serif CJK SC", "Noto Serif", "Microsoft YaHei", serif';
    ctx.fillText(vi ? 'Sở Hà' : '楚河', g.ox + g.cell * 2, mid);
    ctx.fillText(vi ? 'Hán Giới' : '漢界', g.ox + g.cell * 6, mid);
  }

  /**
   * Vẽ cả bàn.
   * o = { game, w, h, dpr, board, flip, selected, targets:[tên ô], last:[từ, đến], checkSq, vi }
   * Trả về hình học (layout) dùng để đổi chạm → ô.
   */
  function draw(ctx, o) {
    const g = layout(o.game, o.w, o.h);
    const flip = !!o.flip, chess = isChess(o.game);
    ctx.setTransform((o.dpr || 1), 0, 0, (o.dpr || 1), 0, 0);
    ctx.clearRect(0, 0, o.w, o.h);
    if (chess) drawChessBoard(ctx, g, flip); else drawXiangqiBoard(ctx, g, flip, !!o.vi);
    const at = name => { const q = parseSq(o.game, name); return q ? cellXY(g, q.col, q.row, flip) : null; };
    const mark = (name, style) => {
      const p = at(name); if (!p) return;
      ctx.fillStyle = style;
      if (chess) ctx.fillRect(p.x - g.cell / 2, p.y - g.cell / 2, g.cell, g.cell);
      else { ctx.beginPath(); ctx.arc(p.x, p.y, g.cell * 0.46, 0, Math.PI * 2); ctx.fill(); }
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
      const ch = o.board && o.board[boardIndex(o.game, c, r)];
      if (!ch) continue;
      const p = cellXY(g, c, r, flip);
      if (chess) drawChessPiece(ctx, p.x, p.y, g.cell * 0.92, ch);
      else drawXiangqiPiece(ctx, p.x, p.y, g.cell, ch, !!o.vi);
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
      }
    });
    return g;
  }

  return { aspect, layout, cellXY, squareAt, nameOf, parseSq, boardIndex, draw, HAN, VIET };
});
