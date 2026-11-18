'use strict';
/*
 * Dựng kho thế cờ cho Kỳ Đạo: public/data/kydao-puzzles.json
 *
 * Cách chạy (từ gốc repo):
 *   node tools/kydao-puzzles/build.js --lichess <đường dẫn lichess_db_puzzle.csv>
 *   node tools/kydao-puzzles/build.js --lichess <csv> --out public/data/kydao-puzzles.json --seed 20261118
 *   node tools/kydao-puzzles/build.js            (không có --lichess: giữ nguyên phần cờ vua đang có, dựng lại cờ tướng)
 *
 * Tham số:
 *   --lichess <csv>   Kho thế cờ Lichess (CC0, https://database.lichess.org/#puzzles), đã giải nén.
 *                     Đọc được cả file rút gọn (vài trăm nghìn dòng đầu). KHÔNG commit file CSV.
 *   --out <json>      Nơi ghi (mặc định public/data/kydao-puzzles.json).
 *   --seed <số>       Hạt giống sinh thế cờ tướng (mặc định 20261118). Cùng seed, cùng CSV → cùng kết quả.
 *   --built <ngày>    Ghi vào trường built (mặc định hôm nay, dạng YYYY-MM-DD).
 *
 * Cờ vua: lọc Popularity ≥ 85, ưu tiên NbPlays cao, chia nhóm theo Themes, trải rating, kiểm từng thế
 *   bằng KyChess. Quy ước Lichess: FEN là thế TRƯỚC nước của đối phương; nước đầu trong Moves là
 *   của đối phương (ghi vào `last`), phần còn lại là lời giải.
 * Cờ tướng: không có kho mở giấy phép tự do, nên sinh thế tàn cục ngẫu nhiên rồi dùng
 *   KyAiXiangqi.mateIn tìm thế thắng đúng n nước (không ngắn hơn), nước đầu duy nhất,
 *   nước cuối là chiếu hết; xác minh lại cả dòng bằng KyXiangqi.
 */

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');
const KyChess = require(path.join(ROOT, 'public/js/kydao/chess.js'));
const KyXiangqi = require(path.join(ROOT, 'public/js/kydao/xiangqi.js'));
const KyAiXiangqi = require(path.join(ROOT, 'public/js/kydao/ai-xiangqi.js'));

/* ---------- Tham số dòng lệnh ---------- */
function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const k = a.slice(2);
      const v = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
      out[k] = v;
    }
  }
  return out;
}

/* ---------- Số ngẫu nhiên có hạt giống ---------- */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------- Cờ vua: kho Lichess ---------- */
const CHESS_GROUPS = [
  { key: 'mate1', count: 60, goal: 'mate', test: t => t.has('mateIn1') },
  { key: 'mate2', count: 80, goal: 'mate', test: t => t.has('mateIn2') },
  { key: 'mate3', count: 60, goal: 'mate', test: t => t.has('mateIn3') },
  { key: 'draw', count: 40, goal: 'draw', test: t => t.has('equality') },
  {
    key: 'win-end', count: 30, goal: 'win',
    test: t => t.has('endgame') && (t.has('advantage') || t.has('crushing')) && (t.has('short') || t.has('oneMove')) && !t.has('mate')
  },
  {
    key: 'win-mid', count: 30, goal: 'win',
    test: t => !t.has('endgame') && (t.has('advantage') || t.has('crushing')) && (t.has('short') || t.has('oneMove')) && !t.has('mate')
  }
];

function readLichess(file) {
  const text = fs.readFileSync(file, 'utf8');
  const lines = text.split(/\r?\n/);
  const head = lines[0].split(',');
  const col = name => {
    const i = head.indexOf(name);
    if (i < 0) throw new Error('CSV thiếu cột ' + name);
    return i;
  };
  const I = {
    id: col('PuzzleId'), fen: col('FEN'), moves: col('Moves'), rating: col('Rating'),
    pop: col('Popularity'), plays: col('NbPlays'), themes: col('Themes')
  };
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i]) continue;
    const f = lines[i].split(',');
    if (f.length <= I.themes) continue;
    const pop = Number(f[I.pop]);
    if (!(pop >= 85)) continue;
    rows.push({
      id: f[I.id], fen: f[I.fen], moves: f[I.moves].split(' ').filter(Boolean),
      rating: Number(f[I.rating]), pop, plays: Number(f[I.plays]), themes: new Set(f[I.themes].split(' '))
    });
  }
  return rows;
}

/** Kiểm một thế Lichess; trả thế đã chuyển định dạng hoặc null nếu lỗi. */
function convertLichess(row, goal) {
  let state;
  try { state = KyChess.create({ fen: row.fen }); } catch (e) { return null; }
  if (row.moves.length < 2 || row.moves.length % 2 !== 0) return null;
  const first = KyChess.play(state, row.moves[0]);
  if (!first.ok) return null;
  const start = first.state;
  const solver = KyChess.turn(start);
  let s = start;
  for (const m of row.moves.slice(1)) {
    const r = KyChess.play(s, m);
    if (!r.ok || r.info.move !== m) return null;
    s = r.state;
  }
  const st = KyChess.status(s);
  if (goal === 'mate' && !(st.over && st.reason === 'checkmate' && st.winner === solver)) return null;
  if (goal !== 'mate' && st.over && st.reason === 'checkmate') return null;
  const moves = row.moves.slice(1);
  return {
    id: 'cv-' + row.id, game: 'chess', fen: KyChess.toFen(start), last: row.moves[0], moves, goal,
    n: Math.ceil(moves.length / 2), rating: row.rating, source: 'lichess:' + row.id
  };
}

/** Chọn count thế trải đều theo rating trong nhóm ứng viên (đã ưu tiên lượt chơi cao). */
function spread(cands, count) {
  if (cands.length <= count) return cands.slice().sort((a, b) => a.rating - b.rating);
  const sorted = cands.slice().sort((a, b) => a.rating - b.rating || b.plays - a.plays);
  const out = [];
  const used = new Set();
  for (let i = 0; i < count; i++) {
    let j = Math.floor((i + 0.5) * sorted.length / count);
    while (used.has(j) && j < sorted.length - 1) j++;
    used.add(j);
    out.push(sorted[j]);
  }
  return out;
}

function buildChess(rows) {
  const taken = new Set();
  const result = [];
  const report = {};
  for (const g of CHESS_GROUPS) {
    // Ứng viên: đúng nhóm, lời giải không quá dài, ưu tiên lượt chơi cao (lấy tối đa 30 lần số cần)
    const pool = rows.filter(r => !taken.has(r.id) && g.test(r.themes) && r.moves.length <= 8)
      .sort((a, b) => b.plays - a.plays || (a.id < b.id ? -1 : 1))
      .slice(0, g.count * 30);
    const picked = [];
    let cands = pool;
    // Chọn trải rating; thế nào kiểm không qua thì bỏ và chọn lại từ phần còn lại
    while (picked.length < g.count && cands.length) {
      const need = g.count - picked.length;
      const choice = spread(cands, need);
      const chosenIds = new Set(choice.map(c => c.id));
      for (const c of choice) {
        const p = convertLichess(c, g.goal);
        if (p) { picked.push(p); taken.add(c.id); }
      }
      cands = cands.filter(c => !chosenIds.has(c.id));
    }
    picked.sort((a, b) => a.rating - b.rating || (a.id < b.id ? -1 : 1));
    for (const p of picked) { p.group = g.key; result.push(p); }
    report[g.key] = picked.length;
  }
  return { list: result, report };
}

/* ---------- Cờ tướng: dựng bằng máy ---------- */
const at = (x, y) => y * 9 + x;

function fenOfBoard(board, turn) {
  const rows = [];
  for (let y = 9; y >= 0; y--) {
    let row = '', empty = 0;
    for (let x = 0; x < 9; x++) {
      const p = board[at(x, y)];
      if (!p) empty++;
      else { if (empty) row += empty; empty = 0; row += p; }
    }
    if (empty) row += empty;
    rows.push(row);
  }
  return rows.join('/') + ' ' + turn + ' - - 0 1';
}

const PALACE_RED = [[3, 0], [4, 0], [5, 0], [3, 1], [4, 1], [5, 1], [3, 2], [4, 2], [5, 2]];
const ADVISOR_PTS = [[3, 0], [5, 0], [4, 1], [3, 2], [5, 2]];
const ELEPHANT_PTS = [[2, 0], [6, 0], [0, 2], [4, 2], [8, 2], [2, 4], [6, 4]];
const mirror = ([x, y]) => [x, 9 - y];

/** Sinh một thế tàn cục ngẫu nhiên: Đỏ tấn công (đi trước), Đen phòng thủ. */
function randomEndgame(rng) {
  const board = Array(90).fill(null);
  const pickFrom = arr => arr[Math.floor(rng() * arr.length)];
  const put = (sq, p) => { if (board[sq]) return false; board[sq] = p; return true; };
  // Tướng Đen hay ở hàng cuối, Tướng Đỏ ở cung mình
  const bk = rng() < 0.6 ? pickFrom([[4, 9], [3, 9], [5, 9]]) : mirror(pickFrom(PALACE_RED));
  put(at(bk[0], bk[1]), 'k');
  put(at(...pickFrom(PALACE_RED)), 'K');
  // Quân thủ của Đen
  const nAdv = Math.floor(rng() * 3), nEle = Math.floor(rng() * 3);
  for (let i = 0; i < nAdv; i++) put(at(...mirror(pickFrom(ADVISOR_PTS))), 'a');
  for (let i = 0; i < nEle; i++) put(at(...mirror(pickFrom(ELEPHANT_PTS))), 'b');
  const nBp = Math.floor(rng() * 3);
  for (let i = 0; i < nBp; i++) {
    // Tốt Đen đã qua sông (y ≤ 4) hoặc còn ở phía mình (y 5..6, cột chẵn)
    if (rng() < 0.6) put(at(Math.floor(rng() * 9), 1 + Math.floor(rng() * 4)), 'p');
    else put(at(2 * Math.floor(rng() * 5), 5 + Math.floor(rng() * 2)), 'p');
  }
  // Đen có thể còn một quân mạnh để phản công
  if (rng() < 0.45) put(Math.floor(rng() * 90), pickFrom(['r', 'n', 'c']));
  // Quân tấn công của Đỏ: 2–3 quân
  const nAtk = 2 + (rng() < 0.45 ? 1 : 0);
  for (let i = 0; i < nAtk; i++) {
    const t = pickFrom(['R', 'R', 'N', 'N', 'C', 'C', 'P', 'P']);
    if (t === 'P') put(at(Math.floor(rng() * 9), 5 + Math.floor(rng() * 5)), 'P');
    else if (t === 'N' || t === 'R') put(at(Math.floor(rng() * 9), 3 + Math.floor(rng() * 7)), t);
    else put(Math.floor(rng() * 90), t);
  }
  // Đỏ có thể còn Sĩ/Tượng giữ nhà
  if (rng() < 0.5) put(at(...pickFrom(ADVISOR_PTS)), 'A');
  if (rng() < 0.4) put(at(...pickFrom(ELEPHANT_PTS)), 'B');
  return board;
}

/** Thế hợp lệ để đố: không bên nào đang bị chiếu (kể cả tướng đối mặt), Đỏ còn nước đi. */
function validStart(board) {
  if (board.indexOf('K') < 0 || board.indexOf('k') < 0) return null;
  let s;
  try { s = KyXiangqi.fromFen(fenOfBoard(board, 'w')); } catch (e) { return null; }
  if (KyAiXiangqi.inCheck(s, 'a') || KyAiXiangqi.inCheck(s, 'b')) return null;
  if (KyXiangqi.status(s).over) return null;
  return s;
}

/** Xác minh dòng lời giải bằng module luật; trả true nếu mọi nước hợp lệ và nước cuối chiếu hết. */
function verifyXiangqiLine(fen, moves) {
  let s = KyXiangqi.fromFen(fen);
  let lastInfo = null;
  for (const m of moves) {
    const r = KyXiangqi.play(s, m);
    if (!r.ok) return false;
    s = r.state; lastInfo = r.info;
  }
  const st = KyXiangqi.status(s);
  return st.over && st.winner === 'a' && !!(lastInfo && lastInfo.check);
}

function buildXiangqi(seed, targets, log) {
  const rng = mulberry32(seed);
  const out = { 1: [], 2: [], 3: [] };
  const seen = new Set();
  let tries = 0;
  const done = () => [1, 2, 3].every(n => out[n].length >= targets[n]);
  const t0 = Date.now();
  while (!done() && tries < 400000) {
    tries++;
    const board = randomEndgame(rng);
    const fen = fenOfBoard(board, 'w');
    if (seen.has(fen)) continue;
    seen.add(fen);
    const start = validStart(board);
    if (!start) continue;
    // Lọc nhanh: chỉ xét nước chiếu
    const quick = KyAiXiangqi.mateIn(start, 3, { checksOnly: true, nodeLimit: 60000 });
    if (!quick) continue;
    const full = KyAiXiangqi.mateIn(start, 3, { nodeLimit: 3000000 });
    if (!full) continue;
    const n = full.n;
    if (out[n].length >= targets[n]) continue;
    if (full.moves.length !== 1) continue; // nước đầu phải duy nhất
    if (full.line.length !== 2 * n - 1) continue;
    // Các nước giữa của người giải cũng duy nhất (nước chiếu hết cuối cùng có thể có nhiều cách)
    let unique = true;
    let s = start;
    for (let i = 0; i < full.line.length - 1; i++) {
      s = KyXiangqi.play(s, full.line[i]).state;
      if (i % 2 === 1 && i < full.line.length - 2) {
        const rest = KyAiXiangqi.mateIn(s, n - (i + 1) / 2, { nodeLimit: 3000000 });
        if (!rest || rest.moves.length !== 1 || rest.n !== n - (i + 1) / 2) { unique = false; break; }
      }
    }
    if (!unique) continue;
    if (!verifyXiangqiLine(fen, full.line)) continue;
    // Bỏ thế mà nước đầu là ăn quân lớn hiển nhiên ở thế 2–3 nước? Giữ lại: vẫn là lời giải duy nhất.
    out[n].push({ fen, moves: full.line, n });
    if (log) log('  cờ tướng: thế ' + n + ' nước #' + out[n].length + ' (thử ' + tries + ', ' + ((Date.now() - t0) / 1000).toFixed(0) + ' s)');
  }
  const list = [];
  let k = 0;
  for (const n of [1, 2, 3]) {
    for (const p of out[n].slice(0, targets[n])) {
      k++;
      list.push({
        id: 'ct-' + String(k).padStart(3, '0'), game: 'xiangqi', fen: p.fen, moves: p.moves,
        goal: 'mate', n: p.n, source: 'tao-bang-may', group: 'mate' + p.n
      });
    }
  }
  return { list, tries };
}

/* ---------- Ghi file ---------- */
function stringify(data) {
  const head = '{"version":' + data.version + ',"built":' + JSON.stringify(data.built);
  const arr = (name, list) => '"' + name + '":[\n' + list.map(p => JSON.stringify(p)).join(',\n') + '\n]';
  return head + ',\n' + arr('chess', data.chess) + ',\n' + arr('xiangqi', data.xiangqi) + '}\n';
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const outFile = path.resolve(ROOT, typeof args.out === 'string' ? args.out : 'public/data/kydao-puzzles.json');
  const seed = Number(args.seed) || 20261118;
  const built = typeof args.built === 'string' ? args.built : new Date().toISOString().slice(0, 10);
  const log = msg => process.stdout.write(msg + '\n');

  let chess;
  if (typeof args.lichess === 'string') {
    log('Đọc kho Lichess: ' + args.lichess);
    const rows = readLichess(args.lichess);
    log('  ' + rows.length + ' thế có Popularity ≥ 85');
    const r = buildChess(rows);
    chess = r.list;
    log('  cờ vua: ' + JSON.stringify(r.report));
  } else {
    if (!fs.existsSync(outFile)) throw new Error('Thiếu --lichess và chưa có file cũ để giữ phần cờ vua');
    chess = JSON.parse(fs.readFileSync(outFile, 'utf8')).chess;
    log('Giữ nguyên ' + chess.length + ' thế cờ vua từ file cũ');
  }

  log('Dựng thế cờ tướng (seed ' + seed + ')…');
  const xq = buildXiangqi(seed, { 1: 12, 2: 16, 3: 12 }, log);
  log('  cờ tướng: ' + xq.list.length + ' thế sau ' + xq.tries + ' lần thử');

  const data = { version: 1, built, chess, xiangqi: xq.list };
  fs.writeFileSync(outFile, stringify(data));
  log('Đã ghi ' + path.relative(ROOT, outFile));
}

if (require.main === module) main();

module.exports = { readLichess, convertLichess, buildChess, buildXiangqi, fenOfBoard, verifyXiangqiLine };
