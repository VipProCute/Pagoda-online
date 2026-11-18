/*
 * Kỳ Đạo · Máy đánh cờ tướng (KyAiXiangqi).
 * UMD, thuần: không DOM, không timer, không I/O ở mức module. Chạy được trong Node,
 * trình duyệt và Web Worker (ai-worker.js). Cần KyXiangqi (xiangqi.js) để kiểm lại nước trả về.
 *
 *   bestMove(state, { level: 1|2|3, timeMs?, rng?, now? }) → 'h2e2' | null
 *   mateIn(state, n, { checksOnly?, nodeLimit? }) → null | { move, n, line, moves }
 *   inCheck(state, side?) → bên side (mặc định bên đang đi) có đang bị chiếu không
 *
 * Quy ước như xiangqi.js: ô = x + y*9, x = cột a..i, y = 0..9 (y = 0 là hàng cuối của Đỏ),
 * nước đi 'h2e2' (ô đi + ô đến). Bên 'a' = Đỏ (chữ hoa), 'b' = Đen.
 *
 * Lõi riêng: bàn mảng số 90 ô (Xe 1, Mã 2, Tượng 3, Sĩ 4, Tướng 5, Pháo 6, Tốt 7, Đen cộng 8),
 * bảng nước tính sẵn (cản mã, cản tượng, cung, sông), make/unmake tại chỗ, Zobrist,
 * negamax alpha-beta (PVS) + quiescence, bảng chuyển vị, nước sát thủ, history, null-move,
 * iterative deepening có hạn giờ. Luật: tướng không được đối mặt, hết nước là thua,
 * lặp thế mà một bên chiếu liên tục thì bên đó bị xử thua (như xiangqi.js).
 * Biến thể cờ úp (jieqi, có quân úp) chưa có lõi riêng: chọn nước đơn giản bằng module luật.
 */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./xiangqi.js'));
  else root.KyAiXiangqi = factory(root.KyXiangqi);
})(typeof self !== 'undefined' ? self : this, function (Rules) {
  'use strict';

  const R = 1, N = 2, B = 3, A = 4, K = 5, C = 6, P = 7, BLACK = 8;
  const LETTER = ' rnbakcp';
  const VALUE = [0, 600, 270, 120, 120, 0, 285, 30];
  const MATE = 30000, MATE_BOUND = MATE - 1000, INF = 32000;
  const PERPETUAL = 1500;

  const X = s => s % 9, Y = s => (s / 9) | 0;
  const at = (x, y) => y * 9 + x;
  const inside = (x, y) => x >= 0 && x < 9 && y >= 0 && y < 10;
  const sqName = s => String.fromCharCode(97 + X(s)) + Y(s);
  const inPalace = (x, y, c) => x >= 3 && x <= 5 && (c === 0 ? y >= 0 && y <= 2 : y >= 7 && y <= 9);
  const ownHalf = (y, c) => (c === 0 ? y <= 4 : y >= 5);

  /* ---------- Bảng nước tính sẵn ---------- */
  const RAYS = [], KN_MOVES = [], KN_ATT = [], ELE = [[], []], ADV = [[], []], KING_M = [[], []], PAWN_M = [[], []];
  for (let s = 0; s < 90; s++) { KN_ATT.push([]); }
  for (let s = 0; s < 90; s++) {
    const x = X(s), y = Y(s);
    RAYS.push([[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => {
      const ray = [];
      let nx = x + dx, ny = y + dy;
      while (inside(nx, ny)) { ray.push(at(nx, ny)); nx += dx; ny += dy; }
      return ray;
    }));
    const kn = [];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (!inside(x + dx, y + dy)) continue;
      const leg = at(x + dx, y + dy);
      for (const sign of [-1, 1]) {
        const nx = x + 2 * dx + sign * dy, ny = y + 2 * dy + sign * dx;
        if (inside(nx, ny)) { kn.push(at(nx, ny), leg); KN_ATT[at(nx, ny)].push(s, leg); }
      }
    }
    KN_MOVES.push(kn);
    for (let c = 0; c < 2; c++) {
      const e = [];
      for (const dx of [-1, 1]) for (const dy of [-1, 1]) {
        const nx = x + 2 * dx, ny = y + 2 * dy;
        if (inside(nx, ny) && ownHalf(ny, c) && ownHalf(y, c)) e.push(at(nx, ny), at(x + dx, y + dy));
      }
      ELE[c].push(e);
      const a = [];
      for (const dx of [-1, 1]) for (const dy of [-1, 1]) {
        if (inPalace(x, y, c) && inPalace(x + dx, y + dy, c)) a.push(at(x + dx, y + dy));
      }
      ADV[c].push(a);
      const k = [];
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (inPalace(x, y, c) && inPalace(x + dx, y + dy, c)) k.push(at(x + dx, y + dy));
      }
      KING_M[c].push(k);
      const p = [];
      const fy = y + (c === 0 ? 1 : -1);
      if (inside(x, fy)) p.push(at(x, fy));
      if (!ownHalf(y, c)) { if (x > 0) p.push(at(x - 1, y)); if (x < 8) p.push(at(x + 1, y)); }
      PAWN_M[c].push(p);
    }
  }

  /* ---------- Bảng vị trí (phía Đỏ; Đen lật theo hàng) ---------- */
  function pstRed(t, x, y) {
    const center = 4 - Math.abs(x - 4);
    switch (t) {
      case P:
        if (y <= 4) return y === 4 && (x === 2 || x === 4 || x === 6) ? 8 : 0;
        return [0, 0, 0, 0, 0, 40, 55, 70, 60, 15][y] + center * 5;
      case N: {
        let v = center * 5 + (y >= 5 && y <= 8 ? 12 + (y - 5) * 4 : 0);
        if (x === 0 || x === 8) v -= 10;
        if (y === 0) v -= 12;
        return v;
      }
      case C: return (x === 4 ? 12 : 0) + (y === 2 ? 4 : 0) + (y >= 7 ? -5 : 0) + center;
      case R: return center * 2 + (y >= 5 ? 10 : 0) + (y === 0 && (x === 0 || x === 8) ? -8 : 0);
      case K: return (y === 0 ? 0 : y === 1 ? -8 : -18) - (x === 4 ? 0 : 6);
      case A: return x === 4 && y === 1 ? 4 : 0;
      case B: return x === 4 && y === 2 ? 4 : 0;
      default: return 0;
    }
  }
  const PST = [];
  for (let t = 0; t < 8; t++) {
    const red = new Int16Array(90), black = new Int16Array(90);
    for (let s = 0; s < 90; s++) {
      red[s] = t ? pstRed(t, X(s), Y(s)) : 0;
      black[s] = t ? pstRed(t, X(s), 9 - Y(s)) : 0;
    }
    PST.push([red, black]);
  }

  /* ---------- Zobrist ---------- */
  let seed = 0x2545f491;
  function rand32() { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return seed | 0; }
  const Z1 = new Int32Array(16 * 90), Z2 = new Int32Array(16 * 90);
  for (let i = 0; i < Z1.length; i++) { Z1[i] = rand32(); Z2[i] = rand32(); }
  const ZS1 = rand32(), ZS2 = rand32();

  /* ---------- Thế nội bộ ---------- */
  const MAX_PLY = 96, HIST_MAX = 2048;
  function emptyPos() {
    return {
      b: new Int8Array(90), side: 0, kings: [-1, -1], half: 0, h1: 0, h2: 0, hp: 0,
      uCap: new Int8Array(HIST_MAX), uHalf: new Int32Array(HIST_MAX),
      hist1: new Int32Array(HIST_MAX), hist2: new Int32Array(HIST_MAX), histChk: new Int8Array(HIST_MAX)
    };
  }
  function pieceFromChar(ch) {
    const t = LETTER.indexOf(ch.toLowerCase());
    if (t <= 0) return 0;
    return t | (ch === ch.toLowerCase() ? BLACK : 0);
  }
  function hashOf(pos) {
    let h1 = 0, h2 = 0;
    for (let s = 0; s < 90; s++) { const p = pos.b[s]; if (p) { h1 ^= Z1[p * 90 + s]; h2 ^= Z2[p * 90 + s]; } }
    if (pos.side) { h1 ^= ZS1; h2 ^= ZS2; }
    pos.h1 = h1; pos.h2 = h2;
  }
  /** Khóa lịch sử của xiangqi.js ('placement turn') → Zobrist. */
  function hashOfKey(key) {
    if (typeof key !== 'string') return null;
    const [placement, turn] = key.split(' ');
    const rows = (placement || '').split('/');
    if (rows.length !== 10) return null;
    const pos = emptyPos();
    for (let r = 0; r < 10; r++) {
      let x = 0;
      for (const ch of rows[r]) {
        if (ch >= '1' && ch <= '9') x += ch.charCodeAt(0) - 48;
        else { if (x > 8) return null; pos.b[at(x, 9 - r)] = pieceFromChar(ch); x++; }
      }
    }
    pos.side = turn === 'b' ? BLACK : 0;
    hashOf(pos);
    return [pos.h1, pos.h2];
  }

  function fromState(state) {
    const pos = emptyPos();
    for (let s = 0; s < 90; s++) {
      const ch = state.board[s];
      const p = ch ? pieceFromChar(ch) : 0;
      pos.b[s] = p;
      if ((p & 7) === K) pos.kings[p >> 3] = s;
    }
    pos.side = state.turn === 'b' ? BLACK : 0;
    pos.half = state.halfmove | 0;
    hashOf(pos);
    const hist = Array.isArray(state.history) ? state.history.slice(-200) : [];
    for (let i = 0; i < hist.length - 1; i++) {
      const h = hashOfKey(hist[i] && hist[i].key);
      if (h) { pos.hist1[pos.hp] = h[0]; pos.hist2[pos.hp] = h[1]; pos.histChk[pos.hp] = hist[i].check ? 1 : 0; pos.hp++; }
    }
    const last = hist.length ? hist[hist.length - 1] : null;
    pos.hist1[pos.hp] = pos.h1; pos.hist2[pos.hp] = pos.h2; pos.histChk[pos.hp] = last && last.check ? 1 : 0; pos.hp++;
    return pos;
  }

  /* ---------- Tấn công, sinh nước ---------- */
  function attacked(pos, sq, by) {
    const b = pos.b;
    const rays = RAYS[sq];
    const rk = R | by, kg = K | by, cn = C | by;
    for (let d = 0; d < 4; d++) {
      const ray = rays[d];
      let i = 0;
      while (i < ray.length && !b[ray[i]]) i++;
      if (i >= ray.length) continue;
      const p = b[ray[i]];
      if (p === rk || p === kg) return true;
      i++;
      while (i < ray.length && !b[ray[i]]) i++;
      if (i < ray.length && b[ray[i]] === cn) return true;
    }
    const kn = N | by, att = KN_ATT[sq];
    for (let i = 0; i < att.length; i += 2) if (b[att[i]] === kn && !b[att[i + 1]]) return true;
    const pw = P | by, x = X(sq), y = Y(sq);
    if (by === 0) {
      if (y > 0 && b[sq - 9] === pw) return true;
      if (y >= 5) { if (x > 0 && b[sq - 1] === pw) return true; if (x < 8 && b[sq + 1] === pw) return true; }
    } else {
      if (y < 9 && b[sq + 9] === pw) return true;
      if (y <= 4) { if (x > 0 && b[sq - 1] === pw) return true; if (x < 8 && b[sq + 1] === pw) return true; }
    }
    return false;
  }
  const inCheck = pos => attacked(pos, pos.kings[pos.side >> 3], pos.side ^ 8);
  const leftInCheck = pos => attacked(pos, pos.kings[(pos.side ^ 8) >> 3], pos.side);

  const mk = (f, t) => f | (t << 7);
  const mFrom = m => m & 127, mTo = m => m >> 7;

  function genMoves(pos, buf, capsOnly) {
    const b = pos.b, side = pos.side, c = side >> 3;
    let n = 0;
    const add = (s, t) => {
      const q = b[t];
      if (!q) { if (!capsOnly) buf[n++] = mk(s, t); } else if ((q & 8) !== side) buf[n++] = mk(s, t);
    };
    for (let s = 0; s < 90; s++) {
      const p = b[s];
      if (!p || (p & 8) !== side) continue;
      const t = p & 7;
      if (t === R) {
        const rays = RAYS[s];
        for (let d = 0; d < 4; d++) {
          const ray = rays[d];
          for (let i = 0; i < ray.length; i++) {
            const q = b[ray[i]];
            if (!q) { if (!capsOnly) buf[n++] = mk(s, ray[i]); } else { if ((q & 8) !== side) buf[n++] = mk(s, ray[i]); break; }
          }
        }
      } else if (t === C) {
        const rays = RAYS[s];
        for (let d = 0; d < 4; d++) {
          const ray = rays[d];
          let i = 0;
          for (; i < ray.length && !b[ray[i]]; i++) if (!capsOnly) buf[n++] = mk(s, ray[i]);
          for (i++; i < ray.length; i++) {
            const q = b[ray[i]];
            if (q) { if ((q & 8) !== side) buf[n++] = mk(s, ray[i]); break; }
          }
        }
      } else if (t === N) {
        const l = KN_MOVES[s];
        for (let i = 0; i < l.length; i += 2) if (!b[l[i + 1]]) add(s, l[i]);
      } else if (t === B) {
        const l = ELE[c][s];
        for (let i = 0; i < l.length; i += 2) if (!b[l[i + 1]]) add(s, l[i]);
      } else if (t === A) {
        const l = ADV[c][s];
        for (let i = 0; i < l.length; i++) add(s, l[i]);
      } else if (t === K) {
        const l = KING_M[c][s];
        for (let i = 0; i < l.length; i++) add(s, l[i]);
      } else {
        const l = PAWN_M[c][s];
        for (let i = 0; i < l.length; i++) add(s, l[i]);
      }
    }
    return n;
  }

  function make(pos, m) {
    const b = pos.b, from = mFrom(m), to = mTo(m);
    const piece = b[from], cap = b[to];
    const u = pos.hp;
    pos.uCap[u] = cap; pos.uHalf[u] = pos.half;
    let h1 = pos.h1 ^ Z1[piece * 90 + from] ^ Z1[piece * 90 + to] ^ ZS1;
    let h2 = pos.h2 ^ Z2[piece * 90 + from] ^ Z2[piece * 90 + to] ^ ZS2;
    if (cap) { h1 ^= Z1[cap * 90 + to]; h2 ^= Z2[cap * 90 + to]; }
    b[to] = piece; b[from] = 0;
    if ((piece & 7) === K) pos.kings[piece >> 3] = to;
    pos.half = cap ? 0 : pos.half + 1;
    pos.side ^= 8;
    pos.h1 = h1; pos.h2 = h2;
    pos.hist1[pos.hp] = h1; pos.hist2[pos.hp] = h2; pos.histChk[pos.hp] = 0; pos.hp++;
  }
  function unmake(pos, m) {
    const b = pos.b, from = mFrom(m), to = mTo(m);
    pos.hp--;
    const u = pos.hp;
    const piece = b[to];
    b[from] = piece; b[to] = pos.uCap[u];
    if ((piece & 7) === K) pos.kings[piece >> 3] = from;
    pos.half = pos.uHalf[u];
    pos.side ^= 8;
    pos.h1 = pos.hist1[pos.hp - 1]; pos.h2 = pos.hist2[pos.hp - 1];
  }
  function makeNull(pos) {
    const u = pos.hp;
    pos.uHalf[u] = pos.half; pos.uCap[u] = 0;
    pos.side ^= 8;
    pos.h1 ^= ZS1; pos.h2 ^= ZS2;
    pos.hist1[pos.hp] = pos.h1; pos.hist2[pos.hp] = pos.h2; pos.histChk[pos.hp] = 0; pos.hp++;
  }
  function unmakeNull(pos) {
    pos.hp--;
    pos.half = pos.uHalf[pos.hp];
    pos.side ^= 8;
    pos.h1 = pos.hist1[pos.hp - 1]; pos.h2 = pos.hist2[pos.hp - 1];
  }

  function legalList(pos) {
    const buf = new Int32Array(160);
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
  const moveStr = m => sqName(mFrom(m)) + sqName(mTo(m));

  /* ---------- Lượng giá ---------- */
  function evaluate(pos) {
    const b = pos.b;
    let score = 0, attackRed = 0, attackBlack = 0, defRed = 0, defBlack = 0;
    for (let s = 0; s < 90; s++) {
      const p = b[s];
      if (!p) continue;
      const t = p & 7, c = p >> 3;
      const v = VALUE[t] + PST[t][c][s];
      if (c) {
        score -= v;
        if (t === R || t === N || t === C || (t === P && Y(s) <= 4)) attackBlack++;
        else if (t === A || t === B) defBlack++;
      } else {
        score += v;
        if (t === R || t === N || t === C || (t === P && Y(s) >= 5)) attackRed++;
        else if (t === A || t === B) defRed++;
      }
    }
    // Thiếu Sĩ Tượng khi đối phương còn quân tấn công là nguy hiểm
    score -= (4 - defRed) * attackBlack * 6;
    score += (4 - defBlack) * attackRed * 6;
    return pos.side ? -score : score;
  }

  /* ---------- Bảng chuyển vị, tìm kiếm ---------- */
  const TT_BITS = 18, TT_SIZE = 1 << TT_BITS, TT_MASK = TT_SIZE - 1;
  let ttKey = null, ttMove = null, ttScore = null, ttDepth = null, ttFlag = null;
  const TT_EXACT = 1, TT_LOWER = 2, TT_UPPER = 3;
  function ttClear() {
    if (!ttKey) {
      ttKey = new Int32Array(TT_SIZE); ttMove = new Int32Array(TT_SIZE); ttScore = new Int16Array(TT_SIZE);
      ttDepth = new Int8Array(TT_SIZE); ttFlag = new Int8Array(TT_SIZE);
    } else ttFlag.fill(0);
  }
  const toTT = (s, ply) => s > MATE_BOUND ? s + ply : s < -MATE_BOUND ? s - ply : s;
  const fromTT = (s, ply) => s > MATE_BOUND ? s - ply : s < -MATE_BOUND ? s + ply : s;

  const bufs = [], scores = [];
  for (let i = 0; i < MAX_PLY + 32; i++) { bufs.push(new Int32Array(160)); scores.push(new Int32Array(160)); }
  const killers = new Int32Array((MAX_PLY + 32) * 2);
  const history = new Int32Array(16 * 90);

  /**
   * Lặp thế (so với thế đã gặp cùng bên đi). Trả null nếu không lặp; ngược lại điểm cho bên đang đi:
   * 0 nếu hòa, ±PERPETUAL nếu một bên chiếu liên tục suốt vòng lặp (bên đó thua).
   */
  function repetition(pos) {
    const lim = Math.max(0, pos.hp - 1 - pos.half);
    for (let i = pos.hp - 3; i >= lim; i -= 2) {
      if (pos.hist1[i] !== pos.h1 || pos.hist2[i] !== pos.h2) continue;
      // Các nước trong vòng: j = i+1 .. hp-1; nước dẫn tới j = hp-1 là của đối phương (vừa đi)
      let oppAll = true, meAll = true;
      for (let j = pos.hp - 1, mine = false; j > i; j--, mine = !mine) {
        if (!pos.histChk[j]) { if (mine) meAll = false; else oppAll = false; }
      }
      if (oppAll && !meAll) return PERPETUAL;
      if (meAll && !oppAll) return -PERPETUAL;
      return 0;
    }
    return null;
  }

  function scoreMoves(pos, buf, sc, n, hashMove, ply) {
    const b = pos.b, k1 = killers[ply * 2], k2 = killers[ply * 2 + 1];
    for (let i = 0; i < n; i++) {
      const m = buf[i];
      if (m === hashMove) { sc[i] = 2000000; continue; }
      const victim = b[mTo(m)] & 7;
      if (victim) sc[i] = 1000000 + (victim === K ? 9000 : VALUE[victim]) * 10 - VALUE[b[mFrom(m)] & 7] / 10;
      else if (m === k1) sc[i] = 900000;
      else if (m === k2) sc[i] = 899999;
      else sc[i] = Math.min(800000, history[b[mFrom(m)] * 90 + mTo(m)]);
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
  function hasAttacker(pos, side) {
    const b = pos.b;
    for (let s = 0; s < 90; s++) {
      const p = b[s];
      if (p && (p & 8) === side) { const t = p & 7; if (t === R || t === N || t === C) return true; }
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
      if (stand + VALUE[pos.b[mTo(m)] & 7] + 150 < alpha) continue;
      make(pos, m);
      if (leftInCheck(pos)) { unmake(pos, m); continue; }
      const s = -quiesce(ctx, pos, -beta, -alpha, ply + 1);
      unmake(pos, m);
      if (ctx.stop) return 0;
      if (s > best) { best = s; if (s > alpha) { alpha = s; if (s >= beta) return s; } }
    }
    return best;
  }

  function search(ctx, pos, depth, alpha, beta, ply, allowNull) {
    if (timeUp(ctx)) return 0;
    const check = inCheck(pos);
    // Đánh dấu: nước vừa đi (dẫn tới thế này) có chiếu không, để xét chiếu liên tục
    pos.histChk[pos.hp - 1] = check ? 1 : 0;
    if (check && ply < MAX_PLY) depth++;
    if (ply > 0) {
      if (pos.half >= 120) return 0;
      const rep = repetition(pos);
      if (rep !== null) return rep;
      const ma = -MATE + ply, mb = MATE - ply - 1;
      if (ma > alpha) alpha = ma;
      if (mb < beta) beta = mb;
      if (alpha >= beta) return alpha;
    }
    if (depth <= 0 || ply >= MAX_PLY) return quiesce(ctx, pos, alpha, beta, ply);
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
    if (allowNull && !pv && !check && depth >= 3 && ply > 0 && hasAttacker(pos, pos.side) && evaluate(pos) >= beta) {
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
      const quiet = !pos.b[mTo(m)];
      const mover = pos.b[mFrom(m)];
      make(pos, m);
      if (leftInCheck(pos)) { unmake(pos, m); continue; }
      legal++;
      let s;
      if (legal === 1) s = -search(ctx, pos, depth - 1, -beta, -alpha, ply + 1, true);
      else {
        let red = 0;
        if (quiet && depth >= 3 && legal > 3 && !check && sc[i] < 899999 && !inCheck(pos)) red = legal > 10 ? 2 : 1;
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
              history[mover * 90 + mTo(m)] += depth * depth;
            }
            break;
          }
        }
      }
    }
    // Cờ tướng: hết nước là thua (kể cả khi không bị chiếu)
    if (!legal) return -MATE + ply;
    ttKey[ti] = pos.h2; ttMove[ti] = bestMove; ttScore[ti] = toTT(best, ply); ttDepth[ti] = depth;
    ttFlag[ti] = best >= beta ? TT_LOWER : best > a0 ? TT_EXACT : TT_UPPER;
    return best;
  }

  const LEVELS = {
    1: { timeMs: 150, maxDepth: 2 },
    2: { timeMs: 400, maxDepth: 64 },
    3: { timeMs: 1200, maxDepth: 64 }
  };

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
      const depth = rng() < 0.35 ? 1 : 2;
      let list = scoreRoot(ctx, pos, moves, depth);
      if (!list.length) list = moves.map(m => ({ m, s: 0 }));
      list.sort((a, b) => b.s - a.s);
      const top = list[0].s;
      if (top >= MATE_BOUND && rng() < 0.85) return { move: list[0].m, score: top, depth };
      const margin = rng() < 0.12 ? 250 : 40;
      const pool = list.filter(x => x.s >= top - margin && x.s > -MATE_BOUND);
      const from = pool.length ? pool : list;
      const choice = from[Math.floor(rng() * from.length) % from.length];
      return { move: choice.m, score: choice.s, depth };
    }

    const arr = Int32Array.from(moves), sc = new Int32Array(moves.length);
    scoreMoves(pos, arr, sc, arr.length, 0, 0);
    const order = Array.from(arr).map((m, i) => ({ m, s: sc[i] })).sort((a, b) => b.s - a.s).map(x => x.m);
    let best = { move: order[0], score: 0, depth: 0 };
    for (let depth = 1; depth <= cfg.maxDepth; depth++) {
      const r = rootSearch(ctx, pos, order, depth, -INF, INF);
      if (r.move) best = { move: r.move, score: r.score, depth };
      if (ctx.stop) break;
      if (Math.abs(r.score) >= MATE_BOUND && depth >= 2 * (MATE - Math.abs(r.score)) + 1) break;
      if (now() - start > timeMs * 0.55) break;
    }
    return best;
  }

  function rulesApi() {
    return Rules || (typeof self !== 'undefined' && self.KyXiangqi) || null;
  }
  const hasHidden = state => state.variant === 'jieqi' || state.board.some(p => p === 'X' || p === 'x');

  /** Cờ úp: chọn nước bằng module luật (ưu tiên ăn quân, rồi ngẫu nhiên). */
  function simpleMove(state, legal, rng) {
    const caps = legal.filter(m => {
      const x = m.charCodeAt(2) - 97, y = Number(m.slice(3));
      return !!state.board[y * 9 + x];
    });
    const pool = caps.length ? caps : legal;
    return pool[Math.floor(rng() * pool.length) % pool.length];
  }

  /** Nước tốt nhất theo mức; luôn nằm trong legalMoves(state) của KyXiangqi. null nếu hết nước. */
  function bestMove(state, opts) {
    if (!state || !Array.isArray(state.board) || state.board.length !== 90) return null;
    const rules = rulesApi();
    let legal = null;
    if (rules) {
      if (rules.status(state).over) return null;
      legal = rules.legalMoves(state);
      if (!legal.length) return null;
    }
    if (hasHidden(state)) {
      if (!legal) return null;
      return simpleMove(state, legal, opts && typeof opts.rng === 'function' ? opts.rng : Math.random);
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

  /* ---------- Giải thế chiếu hết (hết nước cũng là thua) ---------- */
  function mateSolver(opts) {
    const memo = new Map();
    const checksOnly = !!(opts && opts.checksOnly);
    const limit = opts && opts.nodeLimit ? opts.nodeLimit : Infinity;
    let nodes = 0;
    const pool = [];
    const getBuf = i => pool[i] || (pool[i] = new Int32Array(160));
    const replyBuf = new Int32Array(160);

    const defenderLost = pos => !hasLegal(pos, replyBuf);

    function canMate(pos, d, k) {
      if (++nodes > limit) throw new Error('quá giới hạn');
      const key = (pos.h1 >>> 0) * 16 + d;
      const hit = memo.get(key);
      if (hit !== undefined && Math.floor(hit / 2) === (pos.h2 >>> 0)) return hit % 2 === 1;
      const r = canMateRaw(pos, d, k);
      memo.set(key, (pos.h2 >>> 0) * 2 + (r ? 1 : 0));
      return r;
    }
    function canMateRaw(pos, d, k) {
      const buf = getBuf(k * 2);
      const n = genMoves(pos, buf, false);
      const checks = [], quiet = [];
      for (let i = 0; i < n; i++) {
        const m = buf[i];
        make(pos, m);
        if (!leftInCheck(pos)) { if (inCheck(pos)) checks.push(m); else if (!checksOnly) quiet.push(m); }
        unmake(pos, m);
      }
      for (let pass = 0; pass < 2; pass++) {
        const list = pass ? quiet : checks;
        for (let i = 0; i < list.length; i++) {
          const m = list[i];
          make(pos, m);
          const ok = d === 1 ? defenderLost(pos) : allRepliesLose(pos, d - 1, k + 1);
          unmake(pos, m);
          if (ok) return true;
        }
      }
      return false;
    }
    function allRepliesLose(pos, d, k) {
      const buf = getBuf(k * 2 + 1);
      const n = genMoves(pos, buf, false);
      for (let i = 0; i < n; i++) {
        const m = buf[i];
        make(pos, m);
        if (leftInCheck(pos)) { unmake(pos, m); continue; }
        const ok = canMate(pos, d, k);
        unmake(pos, m);
        if (!ok) return false;
      }
      return true;
    }
    function shortest(pos, max, k) {
      for (let d = 1; d <= max; d++) if (canMate(pos, d, k)) return d;
      return 0;
    }
    return { canMate, allRepliesLose, shortest, defenderLost, nodes: () => nodes };
  }

  /**
   * Tìm nước buộc thắng (chiếu hết hoặc khốn tướng) trong ≤ n nước của bên đi.
   * Trả null nếu không có; ngược lại { move, n: số nước ngắn nhất, line: đường chính (đối phương
   * chống lâu nhất), moves: mọi nước đầu thắng trong đúng ngần ấy nước }.
   * opts.checksOnly: chỉ xét nước chiếu của bên tấn công. opts.nodeLimit: vượt thì trả null.
   */
  function mateIn(state, n, opts) {
    n = Math.max(1, Math.min(6, n | 0));
    if (!state || hasHidden(state)) return null;
    const pos = fromState(state);
    if (!hasLegal(pos, new Int32Array(160))) return null;
    const solver = mateSolver(opts);
    try {
      const k = solver.shortest(pos, n, 0);
      if (!k) return null;
      const winsIn = (d) => d === 1 ? solver.defenderLost(pos) : solver.allRepliesLose(pos, d - 1, 1);
      const moves = [];
      for (const m of legalList(pos)) {
        make(pos, m);
        if (winsIn(k)) moves.push(m);
        unmake(pos, m);
      }
      const line = [], played = [];
      let d = k, m = moves[0];
      while (m) {
        line.push(moveStr(m)); make(pos, m); played.push(m);
        if (d === 1) break;
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
          const ok = winsIn(d);
          unmake(pos, a);
          if (ok) { m = a; break; }
        }
      }
      while (played.length) unmake(pos, played.pop());
      return { move: moveStr(moves[0]), n: k, line, moves: moves.map(moveStr) };
    } catch (e) {
      return null;
    }
  }

  /** Bên side ('a'|'b', mặc định bên đang đi) có đang bị chiếu (kể cả tướng đối mặt)? */
  function inCheckState(state, side) {
    const pos = fromState(state);
    const c = side === 'a' ? 0 : side === 'b' ? 1 : pos.side >> 3;
    if (pos.kings[c] < 0) return true;
    return attacked(pos, pos.kings[c], c ? 0 : BLACK);
  }

  // _think, _legalMoves: chỉ để kiểm thử lõi riêng
  const _legalMoves = state => legalList(fromState(state)).map(moveStr);
  return { bestMove, mateIn, inCheck: inCheckState, LEVELS, _think: think, _legalMoves };
});
