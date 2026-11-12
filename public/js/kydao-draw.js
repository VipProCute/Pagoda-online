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
    p(ctx, paint) {
      ball(ctx, 0, -0.2, 0.13); paint();
      poly(ctx, [[-0.21, 0.3], [-0.1, -0.06], [0.1, -0.06], [0.21, 0.3]]); paint();
    },
    r(ctx, paint) {
      poly(ctx, [[-0.2, 0.3], [-0.16, -0.15], [0.16, -0.15], [0.2, 0.3]]); paint();
      poly(ctx, [[-0.24, -0.15], [-0.24, -0.36], [-0.14, -0.36], [-0.14, -0.28], [-0.05, -0.28], [-0.05, -0.36],
        [0.05, -0.36], [0.05, -0.28], [0.14, -0.28], [0.14, -0.36], [0.24, -0.36], [0.24, -0.15]]); paint();
    },
    n(ctx, paint) {
      poly(ctx, [[-0.22, 0.3], [-0.16, 0.0], [-0.05, -0.1], [-0.24, -0.1], [-0.2, -0.2], [-0.02, -0.38],
        [0.12, -0.33], [0.2, -0.1], [0.23, 0.3]]); paint();
    },
    b(ctx, paint) {
      poly(ctx, [[-0.21, 0.3], [-0.07, 0.04], [0.07, 0.04], [0.21, 0.3]]); paint();
      ctx.beginPath(); ctx.ellipse(0, -0.14, 0.13, 0.21, 0, 0, Math.PI * 2); paint();
      ball(ctx, 0, -0.4, 0.05); paint();
    },
    q(ctx, paint) {
      poly(ctx, [[-0.23, 0.3], [-0.12, -0.1], [0.12, -0.1], [0.23, 0.3]]); paint();
      poly(ctx, [[-0.13, -0.1], [-0.26, -0.32], [-0.1, -0.2], [0, -0.4], [0.1, -0.2], [0.26, -0.32], [0.13, -0.1]]); paint();
      [[-0.26, -0.34], [0, -0.42], [0.26, -0.34]].forEach(p => { ball(ctx, p[0], p[1], 0.04); paint(); });
    },
    k(ctx, paint) {
      poly(ctx, [[-0.23, 0.3], [-0.14, -0.08], [0.14, -0.08], [0.23, 0.3]]); paint();
      ctx.beginPath(); ctx.ellipse(0, -0.14, 0.17, 0.11, 0, 0, Math.PI * 2); paint();
      poly(ctx, [[-0.03, -0.46], [0.03, -0.46], [0.03, -0.38], [0.1, -0.38], [0.1, -0.32], [0.03, -0.32], [0.03, -0.22], [-0.03, -0.22], [-0.03, -0.32], [-0.1, -0.32], [-0.1, -0.38], [-0.03, -0.38]]); paint();
    }
  };

  function drawChessPiece(ctx, cx, cy, size, ch) {
    const white = ch === ch.toUpperCase();
    const shape = CHESS_SHAPES[ch.toLowerCase()];
    if (!shape) return;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(size, size);
    ctx.lineWidth = 0.04;
    ctx.lineJoin = 'round';
    ctx.fillStyle = white ? '#fbf7ee' : '#3b3029';
    ctx.strokeStyle = white ? '#3a2e22' : '#0f0a07';
    const paint = () => { ctx.fill(); ctx.stroke(); };
    shape(ctx, paint);
    // đế
    ctx.beginPath();
    ctx.rect(-0.28, 0.3, 0.56, 0.09);
    paint();
    ctx.restore();
  }

  /* ---------- Quân cờ tướng ---------- */
  const HAN = { r: ['俥', '車'], n: ['傌', '馬'], b: ['相', '象'], a: ['仕', '士'], k: ['帥', '將'], c: ['炮', '砲'], p: ['兵', '卒'] };
  const VIET = { r: 'Xe', n: 'Mã', b: 'Tượng', a: 'Sĩ', k: 'Tướng', c: 'Pháo', p: 'Tốt' };

  function drawXiangqiPiece(ctx, cx, cy, cell, ch, vi) {
    const red = ch === ch.toUpperCase();
    const t = ch.toLowerCase();
    const hidden = t === 'x';
    const rad = cell * 0.43;
    const ink = red ? '#b5302a' : '#1d1a17';
    ctx.save();
    ctx.beginPath(); ctx.arc(cx + cell * 0.02, cy + cell * 0.03, rad, 0, Math.PI * 2); ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.fill();
    ctx.beginPath(); ctx.arc(cx, cy, rad, 0, Math.PI * 2);
    ctx.fillStyle = hidden ? '#c9a76a' : '#f4e4bf'; ctx.fill();
    ctx.lineWidth = Math.max(1.5, cell * 0.05); ctx.strokeStyle = ink; ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, rad * 0.82, 0, Math.PI * 2); ctx.lineWidth = Math.max(1, cell * 0.025); ctx.stroke();
    ctx.fillStyle = ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (hidden) {
      ctx.font = '700 ' + Math.round(cell * 0.4) + 'px "Noto Serif", serif';
      ctx.fillText('?', cx, cy + cell * 0.02);
    } else if (vi) {
      const word = VIET[t] || '?';
      ctx.font = '700 ' + Math.round(cell * (word.length > 4 ? 0.22 : 0.27)) + 'px "Noto Serif", "Times New Roman", serif';
      ctx.fillText(word, cx, cy + cell * 0.02);
    } else {
      const han = HAN[t];
      ctx.font = '700 ' + Math.round(cell * 0.46) + 'px "Noto Serif CJK SC", "Noto Serif SC", "SimSun", "Microsoft YaHei", serif';
      ctx.fillText(han ? han[red ? 0 : 1] : '?', cx, cy + cell * 0.03);
    }
    ctx.restore();
  }

  /* ---------- Vẽ nền ---------- */
  function drawChessBoard(ctx, g, flip) {
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      const p = cellXY(g, c, r, flip);
      ctx.fillStyle = (c + r) % 2 === 0 ? '#b58863' : '#f0d9b5'; // ô a1 là ô sẫm
      ctx.fillRect(p.x - g.cell / 2, p.y - g.cell / 2, g.cell, g.cell);
    }
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
    ctx.fillStyle = '#e8c98a';
    ctx.fillRect(g.ox - m, g.oy - m, g.cell * 8 + m * 2, g.cell * 9 + m * 2);
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
