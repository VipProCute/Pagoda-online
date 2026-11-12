/*
 * Kỳ Đạo · Luật cờ vua (KyChess).
 * Dùng chung cho máy chủ (trọng tài) và trình duyệt (gợi ý nước đi hợp lệ).
 * UMD, thuần: không DOM, không timer, không I/O, không phụ thuộc gì.
 *
 * Giao diện chung của module luật (xem docs/KE-HOACH-DOT-2026-11.md §5.3):
 *   create(opts) · turn(state) · legalMoves(state) · play(state, move)
 *   status(state) · view(state, side) · notation(state, move)
 *
 * Quy ước:
 *  - Bên 'a' = Trắng (đi trước), bên 'b' = Đen.
 *  - Nước đi dạng UCI: 'e2e4', phong cấp 'e7e8q' (q r b n). Nhập thành là nước của Vua: 'e1g1', 'e1c1'.
 *  - state là JSON thuần, KHÔNG bị sửa bởi mọi hàm ở đây (play trả state mới):
 *      { variant:'standard', board:[64 chuỗi], turn:'a'|'b', castling:'KQkq'|'-',
 *        ep:'e3'|null, halfmove, fullmove, keys:[...] }
 *    board[i] với i = hàng*8 + cột, hàng 0 = hàng 1 (Trắng), cột 0 = cột a, nên a1 = 0, h8 = 63.
 *    Ô trống là '' ; quân Trắng viết hoa 'PNBRQK', quân Đen viết thường 'pnbrqk'.
 *    keys là khóa các thế đã gặp từ nước không thể đảo ngược gần nhất (để đếm lặp thế).
 *  - status().reason: 'checkmate' | 'stalemate' | 'insufficient' | 'repetition' | 'fifty'
 *    (lời tiếng Việt: REASON_TEXT). Hòa do thỏa thuận và hết giờ do bộ quản lý ván lo.
 *  - Hòa tự động: lặp thế 3 lần, 50 nước (100 nửa nước) không ăn quân và không đi tốt,
 *    không đủ quân chiếu hết. Chiếu hết ở chính nước thứ 100 vẫn là chiếu hết.
 */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.KyChess = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ---------- Quân và ô ---------- */
  // Mã quân bên trong: loại 1..6 (P N B R Q K), bên Đen cộng thêm 8, 0 = ô trống.
  const P = 1, N = 2, B = 3, R = 4, Q = 5, K = 6, BLACK = 8;
  const LETTERS = ['', 'P', 'N', 'B', 'R', 'Q', 'K'];
  const FILES = 'abcdefgh';
  const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  // Cờ của nước đi
  const F_DOUBLE = 1, F_EP = 2, F_CK = 3, F_CQ = 4;
  // Quyền nhập thành (bit)
  const C_K = 1, C_Q = 2, C_k = 4, C_q = 8;
  // Quyền nhập thành còn lại sau khi một quân rời/bị ăn ở ô này
  const CASTLE_KEEP = new Int8Array(64).fill(15);
  CASTLE_KEEP[0] = 15 & ~C_Q; CASTLE_KEEP[4] = 15 & ~(C_K | C_Q); CASTLE_KEEP[7] = 15 & ~C_K;
  CASTLE_KEEP[56] = 15 & ~C_q; CASTLE_KEEP[60] = 15 & ~(C_k | C_q); CASTLE_KEEP[63] = 15 & ~C_k;

  const REASON_TEXT = {
    checkmate: 'Chiếu hết',
    stalemate: 'Hết nước đi (hòa)',
    insufficient: 'Không đủ quân để chiếu hết (hòa)',
    repetition: 'Lặp thế ba lần (hòa)',
    fifty: 'Năm mươi nước không ăn quân, không đi tốt (hòa)'
  };

  const file = sq => sq & 7;
  const rank = sq => sq >> 3;
  const sqName = sq => FILES[sq & 7] + String((sq >> 3) + 1);
  function sqOf(name) {
    if (typeof name !== 'string' || name.length !== 2) return -1;
    const f = FILES.indexOf(name[0]);
    const r = name.charCodeAt(1) - 49;
    return f < 0 || r < 0 || r > 7 ? -1 : r * 8 + f;
  }
  const colorOf = p => p & 8;
  const typeOf = p => p & 7;

  function pieceFromChar(c) {
    const i = 'PNBRQK'.indexOf(c.toUpperCase());
    if (i < 0) return 0;
    return (i + 1) | (c === c.toLowerCase() ? BLACK : 0);
  }
  function charOfPiece(p) {
    if (!p) return '';
    const l = LETTERS[p & 7];
    return p & BLACK ? l.toLowerCase() : l;
  }

  /* ---------- Bảng tra trước: nước Mã, Vua, tia của quân chạy ---------- */
  const KNIGHT_TO = [], KING_TO = [], RAYS = [];
  (function buildTables() {
    const KN = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];
    const DIRS = [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [1, -1], [-1, 1], [-1, -1]];
    for (let sq = 0; sq < 64; sq++) {
      const f = file(sq), r = rank(sq);
      KNIGHT_TO.push(KN.map(([df, dr]) => [f + df, r + dr]).filter(([x, y]) => x >= 0 && x < 8 && y >= 0 && y < 8).map(([x, y]) => y * 8 + x));
      KING_TO.push(DIRS.map(([df, dr]) => [f + df, r + dr]).filter(([x, y]) => x >= 0 && x < 8 && y >= 0 && y < 8).map(([x, y]) => y * 8 + x));
      // 8 hướng: 0..3 thẳng (Xe), 4..7 chéo (Tượng)
      RAYS.push(DIRS.map(([df, dr]) => {
        const ray = [];
        let x = f + df, y = r + dr;
        while (x >= 0 && x < 8 && y >= 0 && y < 8) { ray.push(y * 8 + x); x += df; y += dr; }
        return ray;
      }));
    }
  })();

  /* ---------- Thế cờ nội bộ (có thể sửa tại chỗ, dùng cho perft nhanh) ---------- */
  // pos = { b:Int8Array(64), side:0|8, castle:bit, ep:-1|ô, half, full, king:[ôVuaTrắng, ôVuaĐen] }

  function isAttacked(pos, sq, by) {
    const b = pos.b;
    const f = file(sq);
    // Tốt: Tốt Trắng ở sq-7, sq-9 ăn lên sq; Tốt Đen ở sq+7, sq+9 ăn xuống sq
    if (by === 0) {
      if (f < 7 && sq >= 7 && b[sq - 7] === P) return true;
      if (f > 0 && sq >= 9 && b[sq - 9] === P) return true;
    } else {
      const bp = P | BLACK;
      if (f > 0 && sq + 7 < 64 && b[sq + 7] === bp) return true;
      if (f < 7 && sq + 9 < 64 && b[sq + 9] === bp) return true;
    }
    const kn = N | by;
    const kt = KNIGHT_TO[sq];
    for (let i = 0; i < kt.length; i++) if (b[kt[i]] === kn) return true;
    const kg = K | by;
    const kk = KING_TO[sq];
    for (let i = 0; i < kk.length; i++) if (b[kk[i]] === kg) return true;
    const rays = RAYS[sq];
    const rk = R | by, bs = B | by, qn = Q | by;
    for (let d = 0; d < 8; d++) {
      const ray = rays[d];
      const slider = d < 4 ? rk : bs;
      for (let i = 0; i < ray.length; i++) {
        const p = b[ray[i]];
        if (p) {
          if (p === slider || p === qn) return true;
          break;
        }
      }
    }
    return false;
  }

  const inCheckPos = pos => isAttacked(pos, pos.king[pos.side >> 3], pos.side ^ 8);

  const mv = (from, to, promo, flag) => from | (to << 6) | (promo << 12) | (flag << 15);
  const mvFrom = m => m & 63;
  const mvTo = m => (m >> 6) & 63;
  const mvPromo = m => (m >> 12) & 7;
  const mvFlag = m => (m >> 15) & 7;
  const PROMOS = [Q, R, B, N];

  /** Sinh nước đi "gần hợp lệ" (chưa kiểm Vua có bị chiếu sau nước đi) cho bên đang đi. */
  function genPseudo(pos, out) {
    const b = pos.b, side = pos.side, enemy = side ^ 8;
    for (let sq = 0; sq < 64; sq++) {
      const p = b[sq];
      if (!p || (p & 8) !== side) continue;
      const t = p & 7;
      if (t === P) {
        const up = side ? -8 : 8;
        const startRank = side ? 6 : 1;
        const lastRank = side ? 0 : 7;
        const f = file(sq), r = rank(sq);
        const one = sq + up;
        if (!b[one]) {
          if (rank(one) === lastRank) for (let i = 0; i < 4; i++) out.push(mv(sq, one, PROMOS[i], 0));
          else {
            out.push(mv(sq, one, 0, 0));
            if (r === startRank && !b[one + up]) out.push(mv(sq, one + up, 0, F_DOUBLE));
          }
        }
        for (let s = -1; s <= 1; s += 2) {
          const nf = f + s;
          if (nf < 0 || nf > 7) continue;
          const to = one + s;
          const q = b[to];
          if (q && (q & 8) === enemy) {
            if (rank(to) === lastRank) for (let i = 0; i < 4; i++) out.push(mv(sq, to, PROMOS[i], 0));
            else out.push(mv(sq, to, 0, 0));
          } else if (!q && to === pos.ep && b[to - up] === (P | enemy)) out.push(mv(sq, to, 0, F_EP));
        }
      } else if (t === N || t === K) {
        const list = t === N ? KNIGHT_TO[sq] : KING_TO[sq];
        for (let i = 0; i < list.length; i++) {
          const to = list[i], q = b[to];
          if (!q || (q & 8) === enemy) out.push(mv(sq, to, 0, 0));
        }
        if (t === K) genCastle(pos, sq, out);
      } else {
        const rays = RAYS[sq];
        const from = t === B ? 4 : 0, to = t === R ? 4 : 8;
        for (let d = from; d < to; d++) {
          const ray = rays[d];
          for (let i = 0; i < ray.length; i++) {
            const q = b[ray[i]];
            if (!q) out.push(mv(sq, ray[i], 0, 0));
            else {
              if ((q & 8) === enemy) out.push(mv(sq, ray[i], 0, 0));
              break;
            }
          }
        }
      }
    }
    return out;
  }

  /** Nhập thành: Vua và Xe chưa đi, ô giữa trống, Vua không bị chiếu và không đi qua/đến ô bị chiếu. */
  function genCastle(pos, sq, out) {
    const side = pos.side, b = pos.b;
    const home = side ? 60 : 4;
    if (sq !== home) return;
    const enemy = side ^ 8;
    const kRight = side ? C_k : C_K, qRight = side ? C_q : C_Q;
    if (!(pos.castle & (kRight | qRight))) return;
    if (isAttacked(pos, home, enemy)) return;
    if ((pos.castle & kRight) && b[home + 3] === (R | side) && !b[home + 1] && !b[home + 2] &&
        !isAttacked(pos, home + 1, enemy) && !isAttacked(pos, home + 2, enemy)) out.push(mv(home, home + 2, 0, F_CK));
    if ((pos.castle & qRight) && b[home - 4] === (R | side) && !b[home - 1] && !b[home - 2] && !b[home - 3] &&
        !isAttacked(pos, home - 1, enemy) && !isAttacked(pos, home - 2, enemy)) out.push(mv(home, home - 2, 0, F_CQ));
  }

  /** Thực hiện nước đi tại chỗ; trả quân bị ăn. Hoàn lại bằng unmake với đúng các giá trị cũ. */
  function make(pos, m) {
    const b = pos.b;
    const from = mvFrom(m), to = mvTo(m), promo = mvPromo(m), flag = mvFlag(m);
    const piece = b[from];
    const color = piece & 8;
    let cap = b[to];
    b[from] = 0;
    if (flag === F_EP) {
      const capSq = color ? to + 8 : to - 8;
      cap = b[capSq];
      b[capSq] = 0;
    }
    b[to] = promo ? (promo | color) : piece;
    if (flag === F_CK) { b[to + 1] = 0; b[to - 1] = R | color; }
    else if (flag === F_CQ) { b[to - 2] = 0; b[to + 1] = R | color; }
    if ((piece & 7) === K) pos.king[color >> 3] = to;
    pos.castle &= CASTLE_KEEP[from] & CASTLE_KEEP[to];
    pos.ep = flag === F_DOUBLE ? (from + to) >> 1 : -1;
    // Bão hòa ở giới hạn số nguyên an toàn để không làm sai bộ đếm khi đi tiếp.
    pos.half = ((piece & 7) === P || cap) ? 0 : Math.min(Number.MAX_SAFE_INTEGER, pos.half + 1);
    if (color) pos.full = Math.min(Number.MAX_SAFE_INTEGER, pos.full + 1);
    pos.side = color ^ 8;
    return cap;
  }

  function unmake(pos, m, cap, castle, ep, half, full) {
    const b = pos.b;
    const from = mvFrom(m), to = mvTo(m), promo = mvPromo(m), flag = mvFlag(m);
    const color = pos.side ^ 8;
    const piece = promo ? (P | color) : b[to];
    b[from] = piece;
    if (flag === F_EP) {
      b[to] = 0;
      b[color ? to + 8 : to - 8] = cap;
    } else b[to] = cap;
    if (flag === F_CK) { b[to - 1] = 0; b[to + 1] = R | color; }
    else if (flag === F_CQ) { b[to + 1] = 0; b[to - 2] = R | color; }
    if ((piece & 7) === K) pos.king[color >> 3] = from;
    pos.castle = castle;
    pos.ep = ep;
    pos.half = half;
    pos.full = full;
    pos.side = color;
  }

  /** Nước hợp lệ (đã loại các nước để Vua mình bị chiếu). */
  function genLegal(pos) {
    const pseudo = genPseudo(pos, []);
    const out = [];
    const { castle, ep, half, full } = pos;
    const me = pos.side;
    for (let i = 0; i < pseudo.length; i++) {
      const m = pseudo[i];
      const cap = make(pos, m);
      if (!isAttacked(pos, pos.king[me >> 3], me ^ 8)) out.push(m);
      unmake(pos, m, cap, castle, ep, half, full);
    }
    return out;
  }

  function hasLegal(pos) {
    const pseudo = genPseudo(pos, []);
    const { castle, ep, half, full } = pos;
    const me = pos.side;
    for (let i = 0; i < pseudo.length; i++) {
      const m = pseudo[i];
      const cap = make(pos, m);
      const ok = !isAttacked(pos, pos.king[me >> 3], me ^ 8);
      unmake(pos, m, cap, castle, ep, half, full);
      if (ok) return true;
    }
    return false;
  }

  function perftPos(pos, depth) {
    if (depth === 0) return 1;
    const pseudo = genPseudo(pos, []);
    const { castle, ep, half, full } = pos;
    const me = pos.side;
    let n = 0;
    for (let i = 0; i < pseudo.length; i++) {
      const m = pseudo[i];
      const cap = make(pos, m);
      if (!isAttacked(pos, pos.king[me >> 3], me ^ 8)) n += depth === 1 ? 1 : perftPos(pos, depth - 1);
      unmake(pos, m, cap, castle, ep, half, full);
    }
    return n;
  }

  /* ---------- Chuyển state <-> thế nội bộ ---------- */
  function toPos(state) {
    const b = new Int8Array(64);
    const king = [-1, -1];
    for (let i = 0; i < 64; i++) {
      const p = pieceFromChar(state.board[i] || ' ');
      b[i] = p;
      if ((p & 7) === K) king[p >> 3] = i;
    }
    let castle = 0;
    const c = state.castling || '-';
    if (c.includes('K')) castle |= C_K;
    if (c.includes('Q')) castle |= C_Q;
    if (c.includes('k')) castle |= C_k;
    if (c.includes('q')) castle |= C_q;
    return {
      b, side: state.turn === 'b' ? BLACK : 0, castle,
      ep: state.ep ? sqOf(state.ep) : -1,
      half: state.halfmove, full: state.fullmove, king
    };
  }

  function castlingString(castle) {
    const s = (castle & C_K ? 'K' : '') + (castle & C_Q ? 'Q' : '') + (castle & C_k ? 'k' : '') + (castle & C_q ? 'q' : '');
    return s || '-';
  }

  /** Khóa thế để đếm lặp: quân + bên đi + quyền nhập thành + ô bắt tốt qua đường (chỉ khi thật sự bắt được). */
  function keyOf(pos) {
    let s = '';
    for (let i = 0; i < 64; i++) s += pos.b[i] ? charOfPiece(pos.b[i]) : '.';
    let ep = '-';
    if (pos.ep >= 0) {
      const moves = genLegal(pos);
      for (let i = 0; i < moves.length; i++) if (mvFlag(moves[i]) === F_EP) { ep = sqName(pos.ep); break; }
    }
    return s + (pos.side ? 'b' : 'a') + castlingString(pos.castle) + ep;
  }

  function stateFromPos(pos, keys) {
    const board = new Array(64);
    for (let i = 0; i < 64; i++) board[i] = charOfPiece(pos.b[i]);
    return {
      variant: 'standard',
      board,
      turn: pos.side ? 'b' : 'a',
      castling: castlingString(pos.castle),
      ep: pos.ep >= 0 ? sqName(pos.ep) : null,
      halfmove: pos.half,
      fullmove: pos.full,
      keys
    };
  }

  /* ---------- FEN ---------- */
  /** Đọc FEN. Trả state, hoặc null nếu FEN sai hoặc thế không hợp lệ. */
  function fromFen(fen) {
    if (typeof fen !== 'string') return null;
    const f = fen.trim().split(/\s+/);
    if (f.length < 4 || f.length > 6) return null;
    const rows = f[0].split('/');
    if (rows.length !== 8) return null;
    const b = new Int8Array(64);
    const king = [-1, -1];
    const kings = [0, 0];
    for (let i = 0; i < 8; i++) {
      const r = 7 - i;
      let x = 0;
      for (const c of rows[i]) {
        if (c >= '1' && c <= '8') { x += c.charCodeAt(0) - 48; continue; }
        const p = pieceFromChar(c);
        if (!p || x > 7) return null;
        if ((p & 7) === P && (r === 0 || r === 7)) return null;
        b[r * 8 + x] = p;
        if ((p & 7) === K) { king[p >> 3] = r * 8 + x; kings[p >> 3]++; }
        x++;
      }
      if (x !== 8) return null;
    }
    if (kings[0] !== 1 || kings[1] !== 1) return null;
    if (f[1] !== 'w' && f[1] !== 'b') return null;
    if (!/^(-|[KQkq]+)$/.test(f[2])) return null;
    let castle = 0;
    if (f[2].includes('K') && b[4] === (K) && b[7] === R) castle |= C_K;
    if (f[2].includes('Q') && b[4] === K && b[0] === R) castle |= C_Q;
    if (f[2].includes('k') && b[60] === (K | BLACK) && b[63] === (R | BLACK)) castle |= C_k;
    if (f[2].includes('q') && b[60] === (K | BLACK) && b[56] === (R | BLACK)) castle |= C_q;
    const side = f[1] === 'b' ? BLACK : 0;
    let ep = -1;
    if (f[3] !== '-') {
      ep = sqOf(f[3]);
      if (ep < 0 || rank(ep) !== (side ? 2 : 5)) return null;
      const up = side ? -8 : 8;
      if (b[ep] || b[ep - up] !== (P | (side ^ 8)) || b[ep + up]) return null;
    }
    if (f.length > 4 && !/^\d+$/.test(f[4])) return null;
    if (f.length > 5 && !/^\d+$/.test(f[5])) return null;
    const half = f.length > 4 ? Number(f[4]) : 0;
    const full = f.length > 5 ? Number(f[5]) : 1;
    if (!Number.isSafeInteger(half) || half < 0 || !Number.isSafeInteger(full) || full < 1) return null;
    const pos = { b, side, castle, ep, half, full, king };
    // Bên không có lượt mà đang bị chiếu là thế bất khả thi (sẽ làm engine ăn Vua)
    if (isAttacked(pos, king[(side ^ 8) >> 3], side)) return null;
    const s = stateFromPos(pos, []);
    // Giữ nguyên ô bắt tốt qua đường như FEN ghi (để khứ hồi đúng)
    s.keys = [keyOf(pos)];
    return s;
  }

  function toFen(state) {
    const rows = [];
    for (let r = 7; r >= 0; r--) {
      let s = '', empty = 0;
      for (let x = 0; x < 8; x++) {
        const c = state.board[r * 8 + x];
        if (!c) empty++;
        else { if (empty) { s += empty; empty = 0; } s += c; }
      }
      if (empty) s += empty;
      rows.push(s);
    }
    return rows.join('/') + ' ' + (state.turn === 'b' ? 'b' : 'w') + ' ' + (state.castling || '-') + ' ' +
      (state.ep || '-') + ' ' + state.halfmove + ' ' + state.fullmove;
  }

  /* ---------- Giao diện module ---------- */
  const sides = ['a', 'b'];

  /** Tạo ván mới. opts.fen (tuỳ chọn) để bắt đầu từ một thế cờ. Ném lỗi nếu FEN sai. */
  function create(opts) {
    const fen = opts && opts.fen !== undefined ? opts.fen : START_FEN;
    const s = fromFen(fen);
    if (!s) throw new Error('FEN cờ vua không hợp lệ');
    return s;
  }

  const turn = state => (state.turn === 'b' ? 'b' : 'a');

  function moveStr(m) {
    return sqName(mvFrom(m)) + sqName(mvTo(m)) + (mvPromo(m) ? LETTERS[mvPromo(m)].toLowerCase() : '');
  }

  function legalMoves(state) {
    return genLegal(toPos(state)).map(moveStr);
  }

  /** SAN của nước m (đã hợp lệ) trong thế pos; pos không bị đổi sau khi trả về. */
  function sanOf(pos, m, legal) {
    const from = mvFrom(m), to = mvTo(m), promo = mvPromo(m), flag = mvFlag(m);
    const piece = pos.b[from];
    const t = piece & 7;
    const isCap = !!pos.b[to] || flag === F_EP;
    let s;
    if (flag === F_CK) s = 'O-O';
    else if (flag === F_CQ) s = 'O-O-O';
    else if (t === P) {
      s = (isCap ? FILES[file(from)] + 'x' : '') + sqName(to) + (promo ? '=' + LETTERS[promo] : '');
    } else {
      let dis = '';
      let sameFile = false, sameRank = false, other = false;
      for (let i = 0; i < legal.length; i++) {
        const o = legal[i];
        if (o === m || mvTo(o) !== to || mvFrom(o) === from || pos.b[mvFrom(o)] !== piece) continue;
        other = true;
        if (file(mvFrom(o)) === file(from)) sameFile = true;
        if (rank(mvFrom(o)) === rank(from)) sameRank = true;
      }
      if (other) {
        if (!sameFile) dis = FILES[file(from)];
        else if (!sameRank) dis = String(rank(from) + 1);
        else dis = sqName(from);
      }
      s = LETTERS[t] + dis + (isCap ? 'x' : '') + sqName(to);
    }
    const { castle, ep, half, full } = pos;
    const cap = make(pos, m);
    if (inCheckPos(pos)) s += hasLegal(pos) ? '+' : '#';
    unmake(pos, m, cap, castle, ep, half, full);
    return s;
  }

  /** Tìm nước hợp lệ ứng với chuỗi UCI; trả { m } hoặc { reason }. */
  function resolve(pos, move, legal) {
    if (typeof move !== 'string' || !/^[a-h][1-8][a-h][1-8][qrbnQRBN]?$/.test(move)) {
      return { reason: 'Nước đi không đúng dạng (ví dụ e2e4).' };
    }
    const from = sqOf(move.slice(0, 2)), to = sqOf(move.slice(2, 4));
    const promo = move.length === 5 ? 'PNBRQK'.indexOf(move[4].toUpperCase()) + 1 : 0;
    const p = pos.b[from];
    if (!p || (p & 8) !== pos.side) return { reason: 'Ô xuất phát không có quân của bạn.' };
    let sawPromo = false;
    for (let i = 0; i < legal.length; i++) {
      const m = legal[i];
      if (mvFrom(m) !== from || mvTo(m) !== to) continue;
      if (mvPromo(m)) sawPromo = true;
      if (mvPromo(m) === promo) return { m };
    }
    if (sawPromo) return { reason: 'Cần chọn quân phong cấp (q, r, b hoặc n).' };
    return { reason: 'Nước đi không hợp lệ.' };
  }

  /* ---------- Kết quả ---------- */
  // Hai hàng Tốt xen kẽ cột tạo hàng rào: Vua không thể vượt, Tốt không thể ăn hay tiến.
  // Chỉ nhận diện trường hợp chắc chắn: không có quân khác và mỗi Vua ở phía của mình.
  function lockedPawnWall(pos) {
    for (let wallRank = 1; wallRank <= 5; wallRank++) {
      if (rank(pos.king[0]) >= wallRank || rank(pos.king[1]) <= wallRank + 1) continue;
      for (let parity = 0; parity < 2; parity++) {
        let matches = true;
        for (let i = 0; i < 64; i++) {
          if ((pos.b[i] & 7) === K) continue;
          const expected = file(i) % 2 === parity ? (rank(i) === wallRank ? P : rank(i) === wallRank + 1 ? P | BLACK : 0) : 0;
          if (pos.b[i] !== expected) { matches = false; break; }
        }
        if (matches) return true;
      }
    }
    return false;
  }

  /** Quân của bên `color` không đủ để chiếu hết (kể cả khi đối thủ "giúp"). */
  function insufficientFor(pos, color) {
    if (lockedPawnWall(pos)) return true;
    let own = 0, ownKnights = 0, ownBishops = 0, ownOthers = 0;
    let anyPawn = false, anyKnight = false, opp = 0;
    let darkB = false, lightB = false;
    for (let i = 0; i < 64; i++) {
      const p = pos.b[i];
      if (!p) continue;
      const t = p & 7;
      if (t === K) continue;
      if ((p & 8) === color) {
        own++;
        if (t === N) ownKnights++;
        else if (t === B) ownBishops++;
        else ownOthers++;
      } else if (t !== Q) opp++;
      if (t === P) anyPawn = true;
      if (t === N) anyKnight = true;
      if (t === B) { if ((file(i) + rank(i)) % 2 === 0) darkB = true; else lightB = true; }
    }
    if (ownOthers) return false;
    if (ownKnights) return own === 1 && opp === 0;
    if (ownBishops) return !(darkB && lightB) && !anyPawn && !anyKnight;
    return true;
  }

  // Chỉ kết luận khi chứng minh được: theo chuỗi nước bắt buộc ngắn tới thế đã biết.
  // Gặp nhánh hoặc vượt giới hạn thì giữ kết quả thận trọng là còn khả năng chiếu hết.
  function canMatePos(pos, color, depth) {
    if (insufficientFor(pos, color)) return false;
    const moves = genLegal(pos);
    if (!moves.length) return inCheckPos(pos) && pos.side !== color;
    if (moves.length !== 1 || depth === 0) return true;
    const m = moves[0];
    const { castle, ep, half, full } = pos;
    const cap = make(pos, m);
    const result = canMatePos(pos, color, depth - 1);
    unmake(pos, m, cap, castle, ep, half, full);
    return result;
  }

  const stateInsufficient = (pos) => !canMatePos(pos, 0, 8) && !canMatePos(pos, BLACK, 8);

  /** Bên `side` ('a'|'b') còn đủ quân để chiếu hết không? Bộ quản lý ván dùng khi xử hết giờ: không đủ thì hòa. */
  function canMate(state, side) {
    return canMatePos(toPos(state), side === 'b' ? BLACK : 0, 8);
  }

  function status(state) {
    const pos = toPos(state);
    const me = turn(state);
    if (!hasLegal(pos)) {
      if (inCheckPos(pos)) return { over: true, winner: me === 'a' ? 'b' : 'a', reason: 'checkmate' };
      return { over: true, winner: null, reason: 'stalemate' };
    }
    if (stateInsufficient(pos)) return { over: true, winner: null, reason: 'insufficient' };
    const keys = state.keys || [];
    const cur = keyOf(pos);
    let n = 0;
    for (let i = 0; i < keys.length; i++) if (keys[i] === cur) n++;
    if (n >= 3) return { over: true, winner: null, reason: 'repetition' };
    if (pos.half >= 100) return { over: true, winner: null, reason: 'fifty' };
    return { over: false };
  }

  /** Đi một nước (UCI). Không sửa state cũ. */
  function play(state, move) {
    const pos = toPos(state);
    if (status(state).over) return { ok: false, reason: 'Ván cờ đã kết thúc.' };
    const legal = genLegal(pos);
    const r = resolve(pos, typeof move === 'string' ? move.toLowerCase() : move, legal);
    if (r.m === undefined) return { ok: false, reason: r.reason };
    const m = r.m;
    const san = sanOf(pos, m, legal);
    const captured = pos.b[mvTo(m)] || (mvFlag(m) === F_EP ? (P | (pos.side ^ 8)) : 0);
    make(pos, m);
    const prev = (pos.half === 0) ? [] : (state.keys || []);
    const next = stateFromPos(pos, prev.concat(keyOf(pos)));
    const info = { san, move: moveStr(m) };
    if (captured) info.capture = LETTERS[captured & 7].toLowerCase();
    if (inCheckPos(pos)) info.check = true;
    if (mvPromo(m)) info.promotion = LETTERS[mvPromo(m)].toLowerCase();
    if (mvFlag(m) === F_CK) info.castle = 'K';
    else if (mvFlag(m) === F_CQ) info.castle = 'Q';
    if (mvFlag(m) === F_EP) info.enPassant = true;
    return { ok: true, state: next, info };
  }

  /** Cờ vua không có thông tin giấu: ai cũng thấy cả bàn. */
  function view(state, side) {
    return state;
  }

  /** SAN của một nước (UCI) trong thế này, ví dụ 'Nf3', 'exd5', 'O-O', 'e8=Q+'. Nước sai trả chuỗi rỗng. */
  function notation(state, move) {
    const pos = toPos(state);
    const legal = genLegal(pos);
    const r = resolve(pos, typeof move === 'string' ? move.toLowerCase() : move, legal);
    return r.m === undefined ? '' : sanOf(pos, r.m, legal);
  }

  /** Bên đang bị chiếu? (để vẽ viền đỏ quanh Vua) */
  function inCheck(state) { return inCheckPos(toPos(state)); }

  /** Số thế ở độ sâu depth (kiểm luật đi quân). */
  function perft(state, depth) { return perftPos(toPos(state), depth); }

  /** Quân ở ô (tên ô như 'e4'); '' nếu trống. */
  function pieceAt(state, name) {
    const sq = sqOf(name);
    return sq < 0 ? '' : state.board[sq];
  }

  return {
    name: 'chess', sides, START_FEN, REASON_TEXT,
    create, turn, legalMoves, play, status, view, notation,
    fromFen, toFen, perft, inCheck, canMate, pieceAt
  };
});
