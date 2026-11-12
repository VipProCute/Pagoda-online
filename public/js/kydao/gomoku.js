/*
 * Kỳ Đạo · Cờ caro (luật thuần, không DOM, không phụ thuộc).
 * Dùng chung cho máy chủ (kiểm nước đi, quyết thắng/hòa) và trình duyệt (gợi ý nước, vẽ).
 *
 * Luật (KH §5.4, D8): bàn 15×15, X (bên 'a') đi trước, không giới hạn nước đầu.
 *  - Thắng khi có từ 5 quân liên tiếp trở lên cùng màu (ngang, dọc, hai chéo),
 *    trừ khi cả hai đầu của dãy đó đều là quân đối phương (bị chặn hai đầu).
 *    Mép bàn không tính là chặn: dãy sát mép vẫn thắng nếu đầu còn lại không bị chặn cả hai.
 *  - Kín bàn mà chưa ai thắng thì hòa.
 *
 * Ký hiệu nước đi: 'h8' (cột a–o, hàng 1–15; hàng 1 ở đáy bàn, như cờ vua và cờ vây).
 *
 * Giao diện chung của module luật (KH §5.3): create, sides, turn, legalMoves, play, status, view, notation.
 *  - play không sửa state cũ: trả state mới.
 *  - state là JSON thuần: { size, cells, ply, over, winner, reason }.
 *    cells là mảng dài size*size, chỉ số = y*size + x với y tính từ đỉnh bàn xuống (y = 0 là hàng 15).
 */
(function (root) {
  'use strict';

  const DEFAULT_SIZE = 15;
  const MIN_SIZE = 5;
  const MAX_SIZE = 15;               // cột a–o là 15 chữ cái
  const WIN_LEN = 5;
  const SIDES = ['a', 'b'];          // 'a' = X đi trước, 'b' = O
  const SYMBOL = { a: 'X', b: 'O' };
  const DIRS = [[1, 0], [0, 1], [1, 1], [1, -1]];

  function sizeOf(opts) {
    const s = opts && opts.size;
    return Number.isInteger(s) && s >= MIN_SIZE && s <= MAX_SIZE ? s : DEFAULT_SIZE;
  }

  function create(opts) {
    const size = sizeOf(opts);
    return {
      size,
      cells: new Array(size * size).fill(null),
      ply: 0,
      over: false,
      winner: null,
      reason: null
    };
  }

  function turn(state) {
    return state.ply % 2 === 0 ? 'a' : 'b';
  }

  // Tọa độ (x, y) → ký hiệu 'h8'. Hàng 1 là đáy bàn, nên hàng = size - y.
  function toNotation(x, y, size) {
    return String.fromCharCode(97 + x) + (size - y);
  }

  // Ký hiệu → { x, y } hoặc { reason } nếu sai. Không đổi state.
  function parseMove(move, size) {
    const m = typeof move === 'string' ? move.trim().toLowerCase() : '';
    const mt = /^([a-z])(\d{1,2})$/.exec(m);
    if (!mt) return { reason: 'Nước đi không hợp lệ, ví dụ h8.' };
    const x = mt[1].charCodeAt(0) - 97;
    const row = parseInt(mt[2], 10);
    if (x >= size || row < 1 || row > size) return { reason: 'Nước đi ra ngoài bàn.' };
    return { x, y: size - row, notation: m };
  }

  function legalMoves(state) {
    if (state.over) return [];
    const out = [];
    const n = state.size;
    for (let row = 1; row <= n; row++) {
      for (let x = 0; x < n; x++) {
        const y = n - row;
        if (state.cells[y * n + x] === null) out.push(toNotation(x, y, n));
      }
    }
    return out;
  }

  // Đếm dãy quân cùng màu qua (x, y) theo một hướng. Trả về độ dài, hai đầu, và danh sách ô.
  function scanLine(cells, n, x, y, color, dx, dy) {
    const line = [[x, y]];
    const inside = (cx, cy) => cx >= 0 && cy >= 0 && cx < n && cy < n;
    let cx = x + dx, cy = y + dy;
    while (inside(cx, cy) && cells[cy * n + cx] === color) { line.push([cx, cy]); cx += dx; cy += dy; }
    const fwd = inside(cx, cy) ? cells[cy * n + cx] : undefined;   // undefined = mép bàn
    cx = x - dx; cy = y - dy;
    while (inside(cx, cy) && cells[cy * n + cx] === color) { line.unshift([cx, cy]); cx -= dx; cy -= dy; }
    const back = inside(cx, cy) ? cells[cy * n + cx] : undefined;
    return { line, fwd, back };
  }

  // Quân vừa đặt có tạo dãy thắng không. Chỉ xét các dãy đi qua ô vừa đặt.
  function winningLine(cells, n, x, y, color) {
    const opp = color === 'a' ? 'b' : 'a';
    for (const [dx, dy] of DIRS) {
      const r = scanLine(cells, n, x, y, color, dx, dy);
      if (r.line.length < WIN_LEN) continue;
      const blocked = r.fwd === opp && r.back === opp;
      if (!blocked) return r.line;
    }
    return null;
  }

  function play(state, move) {
    if (state.over) return { ok: false, reason: 'Ván đã kết thúc.' };
    const p = parseMove(move, state.size);
    if (p.reason) return { ok: false, reason: p.reason };
    const n = state.size;
    const idx = p.y * n + p.x;
    if (state.cells[idx] !== null) return { ok: false, reason: 'Ô này đã có quân.' };

    const color = turn(state);
    const cells = state.cells.slice();
    cells[idx] = color;
    const next = {
      size: n,
      cells,
      ply: state.ply + 1,
      over: false,
      winner: null,
      reason: null
    };
    const info = {};
    const line = winningLine(cells, n, p.x, p.y, color);
    if (line) {
      next.over = true;
      next.winner = color;
      next.reason = 'Đủ năm quân liên tiếp.';
      info.win = true;
      info.line = line.map(([cx, cy]) => toNotation(cx, cy, n));
    } else if (cells.every(c => c !== null)) {
      next.over = true;
      next.reason = 'Bàn kín, hòa.';
    }
    return { ok: true, state: next, info };
  }

  function status(state) {
    if (!state.over) return { over: false };
    return { over: true, winner: state.winner, reason: state.reason };
  }

  // Caro không có thông tin giấu nên trả bản sao sâu, an toàn cho mọi bên.
  function view(state) {
    return JSON.parse(JSON.stringify(state));
  }

  // Chuỗi cho người đọc, ví dụ 'X h8'. Nước đi dựa trên state trước khi đi.
  function notation(state, move) {
    const p = parseMove(move, state.size);
    if (p.reason) return '';
    return SYMBOL[turn(state)] + ' ' + p.notation;
  }

  const api = { create, sides: SIDES.slice(), turn, legalMoves, play, status, view, notation };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.KyGomoku = api;
})(this);
