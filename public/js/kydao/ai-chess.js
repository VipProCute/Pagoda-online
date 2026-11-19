/*
 * Kỳ Đạo · Máy đánh cờ vua (KyAiChess).
 * UMD, thuần: không DOM, không timer, không I/O ở mức module. Chạy được trong Node,
 * trình duyệt và Web Worker (ai-worker.js). Cần KyChess (chess.js) để kiểm lại nước trả về.
 *
 *   bestMove(state, { level: 1|2|3, timeMs?, rng?, now? }) → 'e2e4' | null
 *   mateIn(state, n, { checksOnly?, all? }) → null | { move, n, line, moves }
 *
 * Lõi riêng cho nhanh (module luật sao chép state nên chậm):
 *  - Bàn 10x12 (mailbox 120 ô), quân là số: Trắng 1..6 (P N B R Q K), Đen cộng 8, ngoài bàn = 16.
 *  - Sinh nước giả hợp lệ, make/unmake tại chỗ, khóa Zobrist hai nửa 32 bit.
 *  - Negamax alpha-beta (PVS) + quiescence (ăn quân), bảng chuyển vị, nước sát thủ, history,
 *    null-move, giảm độ sâu nước muộn, gia hạn khi bị chiếu, iterative deepening có hạn giờ.
 *  - Lượng giá: vật chất + bảng vị trí (giữa ván / tàn cuộc), tốt thông, dồn Vua khi thắng thế.
 */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./chess.js'));
  else root.KyAiChess = factory(root.KyChess);
})(typeof self !== 'undefined' ? self : this, function (Rules) {
  'use strict';

  /* ---------- Quân, ô, hướng ---------- */
  const P = 1, N = 2, B = 3, R = 4, Q = 5, K = 6, BLACK = 8, OFF = 16;
  const FILES = 'abcdefgh';
  const VALUE = [0, 100, 320, 330, 500, 900, 0];
  const PHASE_W = [0, 0, 1, 1, 2, 4, 0];
  const MATE = 30000, MATE_BOUND = MATE - 1000, INF = 32000;
  const F_DOUBLE = 1, F_EP = 2, F_CK = 3, F_CQ = 4;
  const C_K = 1, C_Q = 2, C_k = 4, C_q = 8;

  const KNIGHT_D = [8, 12, 19, 21, -8, -12, -19, -21];
  const KING_D = [1, 9, 10, 11, -1, -9, -10, -11];
  const BISHOP_D = [9, 11, -9, -11];
  const ROOK_D = [1, 10, -1, -10];

  const to120 = i => 21 + (i >> 3) * 10 + (i & 7);
  const SQ64 = new Int8Array(120).fill(-1);
  for (let i = 0; i < 64; i++) SQ64[to120(i)] = i;
  const sqName = s => FILES[SQ64[s] & 7] + String((SQ64[s] >> 3) + 1);
  function sqOf(name) {
    if (typeof name !== 'string' || name.length !== 2) return 0;
    const f = FILES.indexOf(name[0]), r = name.charCodeAt(1) - 49;
    return f < 0 || r < 0 || r > 7 ? 0 : to120(r * 8 + f);
  }

  // Quyền nhập thành còn lại khi một quân rời/bị ăn ở ô này (ô 120)
  const CASTLE_KEEP = new Int8Array(120).fill(15);
  CASTLE_KEEP[21] = 15 & ~C_Q; CASTLE_KEEP[25] = 15 & ~(C_K | C_Q); CASTLE_KEEP[28] = 15 & ~C_K;
  CASTLE_KEEP[91] = 15 & ~C_q; CASTLE_KEEP[95] = 15 & ~(C_k | C_q); CASTLE_KEEP[98] = 15 & ~C_k;

  /* ---------- Bảng vị trí (nhìn từ phía Trắng, hàng 8 ghi trước) ---------- */
  const PST_SRC = {
    1: [0, 0, 0, 0, 0, 0, 0, 0, 50, 50, 50, 50, 50, 50, 50, 50, 10, 10, 20, 30, 30, 20, 10, 10, 5, 5, 10, 25, 25, 10, 5, 5,
      0, 0, 0, 20, 20, 0, 0, 0, 5, -5, -10, 0, 0, -10, -5, 5, 5, 10, 10, -20, -20, 10, 10, 5, 0, 0, 0, 0, 0, 0, 0, 0],
    2: [-50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 0, 0, 0, -20, -40, -30, 0, 10, 15, 15, 10, 0, -30, -30, 5, 15, 20, 20, 15, 5, -30,
      -30, 0, 15, 20, 20, 15, 0, -30, -30, 5, 10, 15, 15, 10, 5, -30, -40, -20, 0, 5, 5, 0, -20, -40, -50, -40, -30, -30, -30, -30, -40, -50],
    3: [-20, -10, -10, -10, -10, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 10, 10, 5, 0, -10, -10, 5, 5, 10, 10, 5, 5, -10,
      -10, 0, 10, 10, 10, 10, 0, -10, -10, 10, 10, 10, 10, 10, 10, -10, -10, 5, 0, 0, 0, 0, 5, -10, -20, -10, -10, -10, -10, -10, -10, -20],
    4: [0, 0, 0, 0, 0, 0, 0, 0, 5, 10, 10, 10, 10, 10, 10, 5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5,
      -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, 0, 0, 0, 5, 5, 0, 0, 0],
    5: [-20, -10, -10, -5, -5, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 5, 5, 5, 0, -10, -5, 0, 5, 5, 5, 5, 0, -5,
      0, 0, 5, 5, 5, 5, 0, -5, -10, 5, 5, 5, 5, 5, 0, -10, -10, 0, 5, 0, 0, 0, 0, -10, -20, -10, -10, -5, -5, -10, -10, -20],
    6: [-30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30,
      -20, -30, -30, -40, -40, -30, -30, -20, -10, -20, -20, -20, -20, -20, -20, -10, 20, 20, 0, 0, 0, 0, 20, 20, 20, 30, 10, 0, 0, 10, 30, 20],
    7: [-50, -40, -30, -20, -20, -30, -40, -50, -30, -20, -10, 0, 0, -10, -20, -30, -30, -10, 20, 30, 30, 20, -10, -30, -30, -10, 30, 40, 40, 30, -10, -30,
      -30, -10, 30, 40, 40, 30, -10, -30, -30, -10, 20, 30, 30, 20, -10, -30, -30, -30, 0, 0, 0, 0, -30, -30, -50, -30, -30, -30, -30, -30, -30, -50]
  };
  // PST[loại][màu>>3][ô 120]; loại 7 là Vua tàn cuộc
  const PST = [];
  for (let t = 0; t <= 7; t++) {
    PST.push([new Int16Array(120), new Int16Array(120)]);
    if (!PST_SRC[t]) continue;
    for (let i = 0; i < 64; i++) {
      const r = i >> 3, f = i & 7;
      PST[t][0][to120(i)] = PST_SRC[t][(7 - r) * 8 + f];
      PST[t][1][to120(i)] = PST_SRC[t][r * 8 + f];
    }
  }
  const PASSED = [0, 5, 10, 20, 35, 60, 100, 0];

  /* ---------- Zobrist ---------- */
  let seed = 0x9e3779b9;
  function rand32() {
    seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
    return seed | 0;
  }
  const Z1 = new Int32Array(17 * 120), Z2 = new Int32Array(17 * 120);
  for (let i = 0; i < Z1.length; i++) { Z1[i] = rand32(); Z2[i] = rand32(); }
  const ZC1 = new Int32Array(16), ZC2 = new Int32Array(16);
  for (let i = 0; i < 16; i++) { ZC1[i] = rand32(); ZC2[i] = rand32(); }
  const ZS1 = rand32(), ZS2 = rand32();

  /* ---------- Thế nội bộ ---------- */
  const MAX_PLY = 96;
  const HIST_MAX = 2048;

  function emptyPos() {
    return {
      b: new Int8Array(120).fill(OFF), side: 0, castle: 0, ep: 0, half: 0, kings: [0, 0], h1: 0, h2: 0,
      u: 0,
      uCap: new Int8Array(HIST_MAX), uCastle: new Int8Array(HIST_MAX), uEp: new Int8Array(HIST_MAX),
      uHalf: new Int32Array(HIST_MAX), hist1: new Int32Array(HIST_MAX), hist2: new Int32Array(HIST_MAX), hp: 0
    };
  }

  function hashOf(pos) {
    let h1 = 0, h2 = 0;
    for (let s = 21; s < 99; s++) {
      const p = pos.b[s];
      if (p && p !== OFF) { h1 ^= Z1[p * 120 + s]; h2 ^= Z2[p * 120 + s]; }
    }
    h1 ^= ZC1[pos.castle]; h2 ^= ZC2[pos.castle];
    if (pos.ep) { h1 ^= Z1[pos.ep]; h2 ^= Z2[pos.ep]; }
    if (pos.side) { h1 ^= ZS1; h2 ^= ZS2; }
    pos.h1 = h1; pos.h2 = h2;
  }

  function pieceFromChar(c) {
    const i = 'PNBRQK'.indexOf(c.toUpperCase());
    if (i < 0) return 0;
    return (i + 1) | (c === c.toLowerCase() ? BLACK : 0);
  }

  function castleBits(c) {
    c = c || '-';
    return (c.includes('K') ? C_K : 0) | (c.includes('Q') ? C_Q : 0) | (c.includes('k') ? C_k : 0) | (c.includes('q') ? C_q : 0);
  }

  /** Khóa thế dạng chuỗi của chess.js → hai nửa Zobrist (để nhận lặp thế với lịch sử ván). */
  function hashOfKey(key) {
    if (typeof key !== 'string' || key.length < 66) return null;
    const pos = emptyPos();
    for (let i = 0; i < 64; i++) pos.b[to120(i)] = key[i] === '.' ? 0 : pieceFromChar(key[i]);
    pos.side = key[64] === 'b' ? BLACK : 0;
    const rest = key.slice(65);
    const m = /^(-|[KQkq]+)(-|[a-h][1-8])$/.exec(rest);
    if (!m) return null;
    pos.castle = castleBits(m[1]);
    pos.ep = m[2] === '-' ? 0 : sqOf(m[2]);
    hashOf(pos);
    return [pos.h1, pos.h2];
  }

  function fromState(state) {
    const pos = emptyPos();
    for (let i = 0; i < 64; i++) {
      const p = pieceFromChar(state.board[i] || ' ');
      const s = to120(i);
      pos.b[s] = p;
      if ((p & 7) === K) pos.kings[p >> 3] = s;
    }
    pos.side = state.turn === 'b' ? BLACK : 0;
    pos.castle = castleBits(state.castling);
    pos.ep = state.ep ? sqOf(state.ep) : 0;
    pos.half = state.halfmove | 0;
    hashOf(pos);
    const keys = Array.isArray(state.keys) ? state.keys.slice(-200) : [];
    for (let i = 0; i < keys.length - 1; i++) {
      const h = hashOfKey(keys[i]);
      if (h) { pos.hist1[pos.hp] = h[0]; pos.hist2[pos.hp] = h[1]; pos.hp++; }
    }
    pos.hist1[pos.hp] = pos.h1; pos.hist2[pos.hp] = pos.h2; pos.hp++;
    return pos;
  }

  /* ---------- Tấn công, sinh nước ---------- */
  function attacked(pos, sq, by) {
    const b = pos.b;
    if (by === 0) {
      if (b[sq - 9] === P || b[sq - 11] === P) return true;
    } else if (b[sq + 9] === (P | BLACK) || b[sq + 11] === (P | BLACK)) return true;
    const kn = N | by, kg = K | by;
    for (let i = 0; i < 8; i++) {
      if (b[sq + KNIGHT_D[i]] === kn) return true;
      if (b[sq + KING_D[i]] === kg) return true;
    }
    const bs = B | by, rk = R | by, qn = Q | by;
    for (let i = 0; i < 4; i++) {
      let d = BISHOP_D[i], s = sq + d;
      while (b[s] === 0) s += d;
      if (b[s] === bs || b[s] === qn) return true;
      d = ROOK_D[i]; s = sq + d;
      while (b[s] === 0) s += d;
      if (b[s] === rk || b[s] === qn) return true;
    }
    return false;
  }

  const inCheck = pos => attacked(pos, pos.kings[pos.side >> 3], pos.side ^ 8);

  const mkMove = (from, to, promo, flag) => from | (to << 7) | (promo << 14) | (flag << 17);
  const mFrom = m => m & 127;
  const mTo = m => (m >> 7) & 127;
  const mPromo = m => (m >> 14) & 7;
  const mFlag = m => (m >> 17) & 7;

  /** Sinh nước giả hợp lệ vào buf; capsOnly: chỉ ăn quân và phong Hậu. Trả số nước. */
  function genMoves(pos, buf, capsOnly) {
    const b = pos.b, side = pos.side, enemy = side ^ 8;
    let n = 0;
    for (let s = 21; s < 99; s++) {
      const p = b[s];
      if (!p || p === OFF || (p & 8) !== side) continue;
      const t = p & 7;
      if (t === P) {
        const up = side ? -10 : 10;
        const lastRow = side ? 2 : 9; // hàng (s/10|0) của hàng phong cấp
        const startRow = side ? 8 : 3;
        const one = s + up;
        if (b[one] === 0) {
          if (((one / 10) | 0) === lastRow) {
            buf[n++] = mkMove(s, one, Q, 0);
            if (!capsOnly) { buf[n++] = mkMove(s, one, N, 0); buf[n++] = mkMove(s, one, R, 0); buf[n++] = mkMove(s, one, B, 0); }
          } else if (!capsOnly) {
            buf[n++] = mkMove(s, one, 0, 0);
            if (((s / 10) | 0) === startRow && b[one + up] === 0) buf[n++] = mkMove(s, one + up, 0, F_DOUBLE);
          }
        }
        for (let k = -1; k <= 1; k += 2) {
          const to = one + k, q = b[to];
          if (q && q !== OFF && (q & 8) === enemy) {
            if (((to / 10) | 0) === lastRow) {
              buf[n++] = mkMove(s, to, Q, 0);
              if (!capsOnly) { buf[n++] = mkMove(s, to, N, 0); buf[n++] = mkMove(s, to, R, 0); buf[n++] = mkMove(s, to, B, 0); }
            } else buf[n++] = mkMove(s, to, 0, 0);
          } else if (q === 0 && to === pos.ep) buf[n++] = mkMove(s, to, 0, F_EP);
        }
      } else if (t === N || t === K) {
        const D = t === N ? KNIGHT_D : KING_D;
        for (let i = 0; i < 8; i++) {
          const to = s + D[i], q = b[to];
          if (q === OFF) continue;
          if (q === 0) { if (!capsOnly) buf[n++] = mkMove(s, to, 0, 0); } else if ((q & 8) === enemy) buf[n++] = mkMove(s, to, 0, 0);
        }
        if (t === K && !capsOnly) n = genCastle(pos, s, buf, n);
      } else {
        for (let i = 0; i < 8; i++) {
          let d;
          if (i < 4) { if (t === R) continue; d = BISHOP_D[i]; } else { if (t === B) continue; d = ROOK_D[i - 4]; }
          let to = s + d;
          while (b[to] === 0) { if (!capsOnly) buf[n++] = mkMove(s, to, 0, 0); to += d; }
          const q = b[to];
          if (q !== OFF && (q & 8) === enemy) buf[n++] = mkMove(s, to, 0, 0);
        }
      }
    }
    return n;
  }

  function genCastle(pos, s, buf, n) {
    const side = pos.side, b = pos.b, enemy = side ^ 8;
    const home = side ? 95 : 25;
    if (s !== home) return n;
    const kR = side ? C_k : C_K, qR = side ? C_q : C_Q;
    if (!(pos.castle & (kR | qR))) return n;
    if (attacked(pos, home, enemy)) return n;
    if ((pos.castle & kR) && b[home + 3] === (R | side) && !b[home + 1] && !b[home + 2] &&
      !attacked(pos, home + 1, enemy) && !attacked(pos, home + 2, enemy)) buf[n++] = mkMove(home, home + 2, 0, F_CK);
    if ((pos.castle & qR) && b[home - 4] === (R | side) && !b[home - 1] && !b[home - 2] && !b[home - 3] &&
      !attacked(pos, home - 1, enemy) && !attacked(pos, home - 2, enemy)) buf[n++] = mkMove(home, home - 2, 0, F_CQ);
    return n;
  }

  function xorPiece(pos, p, s) { pos.h1 ^= Z1[p * 120 + s]; pos.h2 ^= Z2[p * 120 + s]; }

  function make(pos, m) {
    const b = pos.b;
    const from = mFrom(m), to = mTo(m), promo = mPromo(m), flag = mFlag(m);
    const piece = b[from], color = piece & 8;
    const u = pos.u++;
    let cap = b[to];
    pos.uCastle[u] = pos.castle; pos.uEp[u] = pos.ep; pos.uHalf[u] = pos.half;
    pos.h1 ^= ZC1[pos.castle]; pos.h2 ^= ZC2[pos.castle];
    if (pos.ep) { pos.h1 ^= Z1[pos.ep]; pos.h2 ^= Z2[pos.ep]; }
    xorPiece(pos, piece, from);
    if (cap) xorPiece(pos, cap, to);
    b[from] = 0;
    if (flag === F_EP) {
      const cs = color ? to + 10 : to - 10;
      cap = b[cs];
      xorPiece(pos, cap, cs);
      b[cs] = 0;
    }
    pos.uCap[u] = cap;
    const np = promo ? (promo | color) : piece;
    b[to] = np;
    xorPiece(pos, np, to);
    if (flag === F_CK) {
      b[to + 1] = 0; b[to - 1] = R | color;
      xorPiece(pos, R | color, to + 1); xorPiece(pos, R | color, to - 1);
    } else if (flag === F_CQ) {
      b[to - 2] = 0; b[to + 1] = R | color;
      xorPiece(pos, R | color, to - 2); xorPiece(pos, R | color, to + 1);
    }
    if ((piece & 7) === K) pos.kings[color >> 3] = to;
    pos.castle &= CASTLE_KEEP[from] & CASTLE_KEEP[to];
    pos.h1 ^= ZC1[pos.castle]; pos.h2 ^= ZC2[pos.castle];
    pos.ep = flag === F_DOUBLE ? (from + to) >> 1 : 0;
    if (pos.ep) { pos.h1 ^= Z1[pos.ep]; pos.h2 ^= Z2[pos.ep]; }
    pos.half = ((piece & 7) === P || cap) ? 0 : pos.half + 1;
    pos.side = color ^ 8;
    pos.h1 ^= ZS1; pos.h2 ^= ZS2;
    pos.hist1[pos.hp] = pos.h1; pos.hist2[pos.hp] = pos.h2; pos.hp++;
  }

  function unmake(pos, m) {
    const b = pos.b;
    const u = --pos.u;
    pos.hp--;
    const from = mFrom(m), to = mTo(m), promo = mPromo(m), flag = mFlag(m);
    const color = pos.side ^ 8;
    const cap = pos.uCap[u];
    const piece = promo ? (P | color) : b[to];
    b[from] = piece;
    if (flag === F_EP) { b[to] = 0; b[color ? to + 10 : to - 10] = cap; } else b[to] = cap;
    if (flag === F_CK) { b[to - 1] = 0; b[to + 1] = R | color; } else if (flag === F_CQ) { b[to + 1] = 0; b[to - 2] = R | color; }
    if ((piece & 7) === K) pos.kings[color >> 3] = from;
    pos.castle = pos.uCastle[u]; pos.ep = pos.uEp[u]; pos.half = pos.uHalf[u];
    pos.side = color;
    pos.h1 = pos.hist1[pos.hp - 1]; pos.h2 = pos.hist2[pos.hp - 1];
  }

  function makeNull(pos) {
    const u = pos.u++;
    pos.uEp[u] = pos.ep; pos.uHalf[u] = pos.half;
    if (pos.ep) { pos.h1 ^= Z1[pos.ep]; pos.h2 ^= Z2[pos.ep]; }
    pos.ep = 0;
    pos.half++;
    pos.side ^= 8;
    pos.h1 ^= ZS1; pos.h2 ^= ZS2;
    pos.hist1[pos.hp] = pos.h1; pos.hist2[pos.hp] = pos.h2; pos.hp++;
  }
  function unmakeNull(pos) {
    const u = --pos.u;
    pos.hp--;
    pos.ep = pos.uEp[u]; pos.half = pos.uHalf[u];
    pos.side ^= 8;
    pos.h1 = pos.hist1[pos.hp - 1]; pos.h2 = pos.hist2[pos.hp - 1];
  }

  /** Nước vừa đi để Vua bên vừa đi bị chiếu? (gọi ngay sau make) */
  const leftInCheck = pos => attacked(pos, pos.kings[(pos.side ^ 8) >> 3], pos.side);

  function legalList(pos) {
    const buf = new Int32Array(256);
    const n = genMoves(pos, buf, false);
    const out = [];
    for (let i = 0; i < n; i++) {
      make(pos, buf[i]);
      if (!leftInCheck(pos)) out.push(buf[i]);
      unmake(pos, buf[i]);
    }
    return out;
  }

  function hasLegal(pos, buf) {
    const n = genMoves(pos, buf, false);
    for (let i = 0; i < n; i++) {
      make(pos, buf[i]);
      const ok = !leftInCheck(pos);
      unmake(pos, buf[i]);
      if (ok) return true;
    }
    return false;
  }

  const moveStr = m => sqName(mFrom(m)) + sqName(mTo(m)) + (mPromo(m) ? 'pnbrqk'[mPromo(m) - 1] : '');

  /* ---------- Lượng giá (điểm cho bên đang đi) ---------- */
  const pawnMax = new Int8Array(10), pawnMin = new Int8Array(10);
  function evaluate(pos) {
    const b = pos.b;
    let mg = 0, eg = 0, phase = 0, matW = 0, matB = 0, pawnsW = 0, pawnsB = 0;
    // pawnMax[f]: hàng cao nhất có Tốt Đen ở cột f; pawnMin[f]: hàng thấp nhất có Tốt Trắng
    pawnMax.fill(-1); pawnMin.fill(9);
    for (let s = 21; s < 99; s++) {
      const p = b[s];
      if (p === P) { const f = s % 10; const r = ((s / 10) | 0) - 2; if (r < pawnMin[f]) pawnMin[f] = r; }
      else if (p === (P | BLACK)) { const f = s % 10; const r = ((s / 10) | 0) - 2; if (r > pawnMax[f]) pawnMax[f] = r; }
    }
    for (let s = 21; s < 99; s++) {
      const p = b[s];
      if (!p || p === OFF) continue;
      const t = p & 7, c = p >> 3, sign = c ? -1 : 1;
      if (t === K) {
        mg += sign * PST[6][c][s];
        eg += sign * PST[7][c][s];
        continue;
      }
      const v = VALUE[t] + PST[t][c][s];
      mg += sign * v; eg += sign * v;
      phase += PHASE_W[t];
      if (c) matB += VALUE[t]; else matW += VALUE[t];
      if (t === P) {
        const f = s % 10, r = ((s / 10) | 0) - 2;
        if (c === 0) {
          pawnsW++;
          if (pawnMax[f - 1] <= r && pawnMax[f] <= r && pawnMax[f + 1] <= r) { mg += PASSED[r] >> 1; eg += PASSED[r] * 2; }
        } else {
          pawnsB++;
          if (pawnMin[f - 1] >= r && pawnMin[f] >= r && pawnMin[f + 1] >= r) { mg -= PASSED[7 - r] >> 1; eg -= PASSED[7 - r] * 2; }
        }
      }
    }
    // Không đủ quân chiếu hết
    if (!pawnsW && !pawnsB && matW <= 330 && matB <= 330) return 0;
    if (phase > 24) phase = 24;
    let score = ((mg * phase) + (eg * (24 - phase))) / 24 | 0;
    // Tàn cuộc thắng thế: dồn Vua đối phương ra mép, Vua mình áp sát
    if (phase <= 8) {
      const diff = matW - matB;
      if (Math.abs(diff) >= 300) {
        const strong = diff > 0 ? 0 : 1;
        const ks = pos.kings[strong], kw = pos.kings[1 - strong];
        const wf = kw % 10 - 1, wr = ((kw / 10) | 0) - 2;
        const sf = ks % 10 - 1, sr = ((ks / 10) | 0) - 2;
        const edge = Math.max(3 - wf, wf - 4) + Math.max(3 - wr, wr - 4);
        const dist = Math.abs(wf - sf) + Math.abs(wr - sr);
        const bonus = edge * 10 + (14 - dist) * 4;
        score += strong === 0 ? bonus : -bonus;
      }
    }
    // Không có Tốt mà chỉ hơn một quân nhẹ: khó thắng
    if (score > 0 && !pawnsW && matW - matB <= 330) score >>= 2;
    else if (score < 0 && !pawnsB && matB - matW <= 330) score >>= 2;
    return pos.side ? -score : score;
  }

  /* ---------- Bảng chuyển vị ---------- */
  const TT_BITS = 18, TT_SIZE = 1 << TT_BITS, TT_MASK = TT_SIZE - 1;
  let ttKey = null, ttMove = null, ttScore = null, ttDepth = null, ttFlag = null;
  const TT_EXACT = 1, TT_LOWER = 2, TT_UPPER = 3;
  function ttClear() {
    if (!ttKey) {
      ttKey = new Int32Array(TT_SIZE); ttMove = new Int32Array(TT_SIZE); ttScore = new Int16Array(TT_SIZE);
      ttDepth = new Int8Array(TT_SIZE); ttFlag = new Int8Array(TT_SIZE);
    } else { ttFlag.fill(0); }
  }
  const toTT = (s, ply) => s > MATE_BOUND ? s + ply : s < -MATE_BOUND ? s - ply : s;
  const fromTT = (s, ply) => s > MATE_BOUND ? s - ply : s < -MATE_BOUND ? s + ply : s;

  /* ---------- Tìm kiếm ---------- */
  const bufs = [], scores = [];
  for (let i = 0; i < MAX_PLY + 32; i++) { bufs.push(new Int32Array(256)); scores.push(new Int32Array(256)); }
  const killers = new Int32Array((MAX_PLY + 32) * 2);
  const history = new Int32Array(17 * 120);

  function isRepetition(pos) {
    const lim = Math.max(0, pos.hp - 1 - pos.half);
    for (let i = pos.hp - 3; i >= lim; i -= 2) {
      if (pos.hist1[i] === pos.h1 && pos.hist2[i] === pos.h2) return true;
    }
    return false;
  }

  function scoreMoves(pos, buf, sc, n, hashMove, ply) {
    const b = pos.b;
    const k1 = killers[ply * 2], k2 = killers[ply * 2 + 1];
    for (let i = 0; i < n; i++) {
      const m = buf[i];
      if (m === hashMove) { sc[i] = 2000000; continue; }
      const victim = mFlag(m) === F_EP ? P : (b[mTo(m)] & 7);
      const promo = mPromo(m);
      if (victim || promo === Q) sc[i] = 1000000 + VALUE[victim] * 10 + (promo === Q ? 8000 : 0) - (b[mFrom(m)] & 7);
      else if (m === k1) sc[i] = 900000;
      else if (m === k2) sc[i] = 899999;
      else sc[i] = Math.min(800000, history[b[mFrom(m)] * 120 + mTo(m)]) - (promo ? 1000 : 0);
    }
  }

  function pick(buf, sc, n, i) {
    let best = i;
    for (let j = i + 1; j < n; j++) if (sc[j] > sc[best]) best = j;
    if (best !== i) {
      const m = buf[i]; buf[i] = buf[best]; buf[best] = m;
      const s = sc[i]; sc[i] = sc[best]; sc[best] = s;
    }
    return buf[i];
  }

  function hasNonPawn(pos, side) {
    const b = pos.b;
    for (let s = 21; s < 99; s++) {
      const p = b[s];
      if (p && p !== OFF && (p & 8) === side) { const t = p & 7; if (t !== P && t !== K) return true; }
    }
    return false;
  }

  function timeUp(ctx) {
    if ((++ctx.nodes & 1023) === 0 && ctx.now() >= ctx.deadline) ctx.stop = true;
    return ctx.stop;
  }

  function quiesce(ctx, pos, alpha, beta, ply) {
    if (timeUp(ctx)) return 0;
    const stand = evaluate(pos);
    if (ply >= MAX_PLY + 20) return stand;
    if (stand >= beta) return stand;
    if (stand > alpha) alpha = stand;
    const buf = bufs[ply], sc = scores[ply];
    const n = genMoves(pos, buf, true);
    scoreMoves(pos, buf, sc, n, 0, Math.min(ply, MAX_PLY));
    let best = stand;
    for (let i = 0; i < n; i++) {
      const m = pick(buf, sc, n, i);
      // Cắt delta: ăn quân này cũng không đủ kéo alpha lên
      const victim = mFlag(m) === F_EP ? P : (pos.b[mTo(m)] & 7);
      if (!mPromo(m) && stand + VALUE[victim] + 200 < alpha) continue;
      make(pos, m);
      if (leftInCheck(pos)) { unmake(pos, m); continue; }
      const s = -quiesce(ctx, pos, -beta, -alpha, ply + 1);
      unmake(pos, m);
      if (ctx.stop) return 0;
      if (s > best) {
        best = s;
        if (s > alpha) { alpha = s; if (s >= beta) return s; }
      }
    }
    return best;
  }

  function search(ctx, pos, depth, alpha, beta, ply, allowNull) {
    if (timeUp(ctx)) return 0;
    const check = inCheck(pos);
    if (check && ply < MAX_PLY) depth++;
    if (depth <= 0 || ply >= MAX_PLY) return quiesce(ctx, pos, alpha, beta, ply);
    if (ply > 0) {
      if (pos.half >= 100 || isRepetition(pos)) return 0;
      const ma = -MATE + ply, mb = MATE - ply - 1;
      if (ma > alpha) alpha = ma;
      if (mb < beta) beta = mb;
      if (alpha >= beta) return alpha;
    }
    const pv = beta - alpha > 1;
    const ti = pos.h1 & TT_MASK;
    let hashMove = 0;
    if (ttFlag[ti] && ttKey[ti] === pos.h2) {
      hashMove = ttMove[ti];
      if (ply > 0 && !pv && ttDepth[ti] >= depth) {
        const s = fromTT(ttScore[ti], ply), f = ttFlag[ti];
        if (f === TT_EXACT || (f === TT_LOWER && s >= beta) || (f === TT_UPPER && s <= alpha)) return s;
      }
    }
    if (allowNull && !pv && !check && depth >= 3 && ply > 0 && hasNonPawn(pos, pos.side) && evaluate(pos) >= beta) {
      makeNull(pos);
      const s = -search(ctx, pos, depth - 3, -beta, -beta + 1, ply + 1, false);
      unmakeNull(pos);
      if (ctx.stop) return 0;
      if (s >= beta && s < MATE_BOUND) return beta;
    }
    const buf = bufs[ply], sc = scores[ply];
    const n = genMoves(pos, buf, false);
    scoreMoves(pos, buf, sc, n, hashMove, ply);
    let legal = 0, best = -INF, bestMove = 0;
    const a0 = alpha;
    for (let i = 0; i < n; i++) {
      const m = pick(buf, sc, n, i);
      const quiet = !(pos.b[mTo(m)] || mPromo(m) || mFlag(m) === F_EP);
      const mover = pos.b[mFrom(m)];
      make(pos, m);
      if (leftInCheck(pos)) { unmake(pos, m); continue; }
      legal++;
      let s;
      if (legal === 1) s = -search(ctx, pos, depth - 1, -beta, -alpha, ply + 1, true);
      else {
        let red = 0;
        if (quiet && depth >= 3 && legal > 3 && !check && sc[i] < 899999 && !inCheck(pos)) red = legal > 8 ? 2 : 1;
        s = -search(ctx, pos, depth - 1 - red, -alpha - 1, -alpha, ply + 1, true);
        if (s > alpha && red) s = -search(ctx, pos, depth - 1, -alpha - 1, -alpha, ply + 1, true);
        if (s > alpha && s < beta) s = -search(ctx, pos, depth - 1, -beta, -alpha, ply + 1, true);
      }
      unmake(pos, m);
      if (ctx.stop) return 0;
      if (s > best) {
        best = s; bestMove = m;
        if (s > alpha) {
          alpha = s;
          if (s >= beta) {
            if (quiet) {
              if (killers[ply * 2] !== m) { killers[ply * 2 + 1] = killers[ply * 2]; killers[ply * 2] = m; }
              history[mover * 120 + mTo(m)] += depth * depth;
            }
            break;
          }
        }
      }
    }
    if (!legal) return check ? -MATE + ply : 0;
    ttKey[ti] = pos.h2; ttMove[ti] = bestMove; ttScore[ti] = toTT(best, ply); ttDepth[ti] = depth;
    ttFlag[ti] = best >= beta ? TT_LOWER : best > a0 ? TT_EXACT : TT_UPPER;
    return best;
  }

  /* ---------- Gốc: iterative deepening ---------- */
  const LEVELS = {
    1: { timeMs: 150, maxDepth: 2 },
    2: { timeMs: 400, maxDepth: 64 },
    3: { timeMs: 1200, maxDepth: 64 }
  };

  /** Chấm điểm đầy đủ từng nước gốc ở độ sâu cố định (dùng cho mức Sơ cơ). */
  function scoreRoot(ctx, pos, moves, depth) {
    const out = [];
    for (const m of moves) {
      make(pos, m);
      const s = -search(ctx, pos, depth - 1, -INF, INF, 1, true);
      unmake(pos, m);
      if (ctx.stop) break;
      out.push({ m, s });
    }
    return out;
  }

  function rootSearch(ctx, pos, moves, depth, alpha, beta) {
    let best = -INF, bestMove = 0;
    for (let i = 0; i < moves.length; i++) {
      const m = moves[i];
      make(pos, m);
      let s;
      if (i === 0) s = -search(ctx, pos, depth - 1, -beta, -alpha, 1, true);
      else {
        s = -search(ctx, pos, depth - 1, -alpha - 1, -alpha, 1, true);
        if (!ctx.stop && s > alpha && s < beta) s = -search(ctx, pos, depth - 1, -beta, -alpha, 1, true);
      }
      unmake(pos, m);
      if (ctx.stop) break;
      if (s > best) {
        best = s; bestMove = m;
        if (s > alpha) alpha = s;
        // Đưa nước tốt nhất lên đầu cho vòng sau
        moves.splice(i, 1); moves.unshift(m);
      }
    }
    return { move: bestMove, score: best };
  }

  function think(state, opts) {
    opts = opts || {};
    const level = LEVELS[opts.level] ? Number(opts.level) : 2;
    const cfg = LEVELS[level];
    const timeMs = Number.isFinite(opts.timeMs) && opts.timeMs > 0 ? opts.timeMs : cfg.timeMs;
    const now = typeof opts.now === 'function' ? opts.now : Date.now;
    const rng = typeof opts.rng === 'function' ? opts.rng : Math.random;
    const pos = fromState(state);
    const moves = legalList(pos);
    if (!moves.length) return null;
    if (moves.length === 1) return { move: moves[0], score: 0, depth: 0 };
    ttClear();
    killers.fill(0); history.fill(0);
    const start = now();
    const ctx = { nodes: 0, stop: false, now, deadline: start + timeMs };

    if (level === 1) {
      // Sơ cơ: nhìn 1–2 nửa nước, chọn ngẫu nhiên trong các nước gần tốt nhất, thỉnh thoảng sơ suất
      const depth = rng() < 0.35 ? 1 : 2;
      let list = scoreRoot(ctx, pos, moves, depth);
      if (!list.length) list = moves.map(m => ({ m, s: 0 }));
      list.sort((a, b) => b.s - a.s);
      const top = list[0].s;
      if (top >= MATE_BOUND && rng() < 0.85) return { move: list[0].m, score: top, depth };
      const margin = rng() < 0.12 ? 350 : 60;
      const pool = list.filter(x => x.s >= top - margin && x.s > -MATE_BOUND);
      const pickFrom = pool.length ? pool : list;
      const choice = pickFrom[Math.floor(rng() * pickFrom.length) % pickFrom.length];
      return { move: choice.m, score: choice.s, depth };
    }

    // Sắp nước gốc ban đầu theo ăn quân
    const sc = new Int32Array(moves.length);
    const arr = Int32Array.from(moves);
    scoreMoves(pos, arr, sc, arr.length, 0, 0);
    const order = Array.from(arr).map((m, i) => ({ m, s: sc[i] })).sort((a, b) => b.s - a.s).map(x => x.m);
    let best = { move: order[0], score: 0, depth: 0 };
    for (let depth = 1; depth <= cfg.maxDepth; depth++) {
      const r = rootSearch(ctx, pos, order, depth, -INF, INF);
      if (r.move && (!ctx.stop || r.move === order[0])) best = { move: r.move, score: r.score, depth };
      if (ctx.stop) break;
      if (Math.abs(r.score) >= MATE_BOUND && depth >= 2 * (MATE - Math.abs(r.score)) + 1) break;
      if (now() - start > timeMs * 0.55) break;
    }
    return best;
  }

  function rulesApi() {
    return Rules || (typeof self !== 'undefined' && self.KyChess) || null;
  }

  /** Nước tốt nhất theo mức; luôn nằm trong legalMoves(state) của KyChess. null nếu hết nước. */
  function bestMove(state, opts) {
    if (!state || !Array.isArray(state.board)) return null;
    const rules = rulesApi();
    let legal = null;
    if (rules) {
      if (rules.status(state).over) return null;
      legal = rules.legalMoves(state);
      if (!legal.length) return null;
    }
    let move = null;
    try {
      const r = think(state, opts);
      move = r ? moveStr(r.move) : null;
    } catch (e) {
      move = null;
    }
    if (legal) return move && legal.includes(move) ? move : legal[0];
    return move;
  }

  /* ---------- Giải thế chiếu hết ---------- */
  // Bên đi (người tấn công) chiếu hết trong ≤ d nước? Bảng nhớ theo khóa thế + d.
  function mateSolver(opts) {
    const memo = new Map();
    const checksOnly = !!(opts && opts.checksOnly);
    let nodes = 0;
    const limit = opts && opts.nodeLimit ? opts.nodeLimit : Infinity;
    const bufPool = [];
    const getBuf = d => bufPool[d] || (bufPool[d] = new Int32Array(256));
    const replyBuf = new Int32Array(256);

    // Sau nước của người tấn công: bên phòng thủ bị chiếu hết?
    function defenderMated(pos) {
      return inCheck(pos) && !hasLegal(pos, replyBuf);
    }

    function canMate(pos, d, depthKey) {
      if (++nodes > limit) throw new Error('quá giới hạn');
      const mk = (pos.h1 >>> 0) * 16 + d;
      const hit = memo.get(mk);
      if (hit !== undefined && Math.floor(hit / 2) === (pos.h2 >>> 0)) return hit % 2 === 1;
      const r = canMateRaw(pos, d, depthKey);
      memo.set(mk, (pos.h2 >>> 0) * 2 + (r ? 1 : 0));
      return r;
    }

    function canMateRaw(pos, d, k) {
      const buf = getBuf(k * 2);
      const n = genMoves(pos, buf, false);
      // Thử nước chiếu trước
      const order = [];
      for (let i = 0; i < n; i++) {
        const m = buf[i];
        make(pos, m);
        if (!leftInCheck(pos)) {
          const chk = inCheck(pos);
          if (chk) order.unshift(m); else if (d > 1 && !checksOnly) order.push(m);
        }
        unmake(pos, m);
      }
      for (const m of order) {
        make(pos, m);
        const ok = d === 1 ? defenderMated(pos) : allRepliesLose(pos, d - 1, k + 1);
        unmake(pos, m);
        if (ok) return true;
      }
      return false;
    }

    // Bên phòng thủ đang đi: mọi nước đáp đều để người tấn công chiếu hết trong ≤ d?
    function allRepliesLose(pos, d, k) {
      const buf = getBuf(k * 2 + 1);
      const n = genMoves(pos, buf, false);
      let legal = 0;
      for (let i = 0; i < n; i++) {
        const m = buf[i];
        make(pos, m);
        if (leftInCheck(pos)) { unmake(pos, m); continue; }
        legal++;
        const ok = canMate(pos, d, k);
        unmake(pos, m);
        if (!ok) return false;
      }
      if (!legal) return inCheck(pos); // đã chiếu hết sớm hơn; hết nước mà không bị chiếu là hòa
      return true;
    }

    function shortest(pos, max, k) {
      for (let d = 1; d <= max; d++) if (canMate(pos, d, k)) return d;
      return 0;
    }

    return { canMate, allRepliesLose, shortest, defenderMated, nodes: () => nodes };
  }

  /**
   * Tìm nước buộc chiếu hết trong ≤ n nước của bên đi.
   * Trả null nếu không có; ngược lại { move, n: số nước ngắn nhất, line: đường chính
   * (đối phương chọn cách chống lâu nhất), moves: mọi nước đầu chiếu hết trong đúng ngần ấy nước }.
   * opts.checksOnly: chỉ xét nước chiếu ở mọi lượt của bên tấn công (nhanh, dùng để lọc).
   */
  function mateIn(state, n, opts) {
    n = Math.max(1, Math.min(6, n | 0));
    const pos = fromState(state);
    if (!hasLegal(pos, new Int32Array(256))) return null;
    const solver = mateSolver(opts);
    let k;
    try { k = solver.shortest(pos, n, 0); } catch (e) { return null; }
    if (!k) return null;
    const moves = [];
    for (const m of legalList(pos)) {
      make(pos, m);
      const ok = k === 1 ? solver.defenderMated(pos) : solver.allRepliesLose(pos, k - 1, 1);
      unmake(pos, m);
      if (ok) moves.push(m);
    }
    // Đường chính
    const line = [];
    const played = [];
    let d = k;
    let first = moves[0];
    let m = first;
    while (m) {
      line.push(moveStr(m)); make(pos, m); played.push(m);
      if (d === 1) break;
      // Đối phương: nước buộc người tấn công cần nhiều nước nhất
      let bestReply = 0, bestLen = -1;
      for (const r of legalList(pos)) {
        make(pos, r);
        const len = solver.shortest(pos, d - 1, 1);
        unmake(pos, r);
        if (len > bestLen) { bestLen = len; bestReply = r; }
      }
      if (!bestReply) break;
      line.push(moveStr(bestReply)); make(pos, bestReply); played.push(bestReply);
      d = bestLen;
      m = 0;
      for (const a of legalList(pos)) {
        make(pos, a);
        const ok = d === 1 ? solver.defenderMated(pos) : solver.allRepliesLose(pos, d - 1, 1);
        unmake(pos, a);
        if (ok) { m = a; break; }
      }
    }
    while (played.length) unmake(pos, played.pop());
    return { move: moveStr(first), n: k, line, moves: moves.map(moveStr) };
  }

  // _think, _legalMoves: chỉ để kiểm thử lõi riêng
  const _legalMoves = state => legalList(fromState(state)).map(moveStr);

  /**
   * Phòng thủ trong chế độ giải thế cờ (bên đang đi là bên bị chiếu): chọn nước khiến bên công KHÔNG chiếu hết được
   * trong `left` nước của họ; không có thì chọn nước kéo dài nhất. Trả { move, escape, n } hoặc null khi hết nước.
   * escape = true nghĩa là người giải đã đi sai (máy thoát được), người giải sẽ thua bài khi hết số nước.
   */
  function defend(state, left, opts) {
    const moves = Rules.legalMoves(state);
    if (!moves.length) return null;
    let best = null, bestN = -1;
    for (const m of moves) {
      const r = Rules.play(state, m);
      if (!r || !r.ok) continue;
      const st = Rules.status(r.state);
      if (st && st.over) { if (st.winner !== Rules.turn(r.state)) return { move: m, escape: true, n: 0 }; continue; }
      const mate = left > 0 ? mateIn(r.state, left, opts) : null;
      if (!mate) return { move: m, escape: true, n: 0 };
      if (mate.n > bestN) { bestN = mate.n; best = m; }
    }
    return best ? { move: best, escape: false, n: bestN } : { move: moves[0], escape: false, n: 0 };
  }
  return { bestMove, mateIn, defend, LEVELS, _think: think, _legalMoves };
});
