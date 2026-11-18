'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const KyChess = require('../public/js/kydao/chess');
const KyXiangqi = require('../public/js/kydao/xiangqi');
const AiChess = require('../public/js/kydao/ai-chess');
const AiXiangqi = require('../public/js/kydao/ai-xiangqi');

function makeRng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Đi ngẫu nhiên (ưu tiên ăn quân để tới được tàn cuộc), gom các thế gặp trên đường. */
function randomStates(Rules, isCapture, count, rng) {
  const out = [];
  while (out.length < count) {
    let s = Rules.create();
    for (let ply = 0; ply < 120 && out.length < count; ply++) {
      if (Rules.status(s).over) break;
      if (ply % 7 === 3) out.push(s);
      const legal = Rules.legalMoves(s);
      const caps = legal.filter(m => isCapture(s, m));
      const pool = caps.length && rng() < 0.5 ? caps : legal;
      s = Rules.play(s, pool[Math.floor(rng() * pool.length)]).state;
    }
  }
  return out;
}
const chessCapture = (s, m) => !!KyChess.pieceAt(s, m.slice(2, 4));
const xqCapture = (s, m) => !!s.board[Number(m.slice(3)) * 9 + m.charCodeAt(2) - 97];

const GAMES = [
  { name: 'cờ vua', Rules: KyChess, Ai: AiChess, isCapture: chessCapture },
  { name: 'cờ tướng', Rules: KyXiangqi, Ai: AiXiangqi, isCapture: xqCapture }
];

for (const g of GAMES) {
  test(`${g.name}: lõi riêng sinh đúng các nước như module luật`, () => {
    const rng = makeRng(7);
    for (const s of randomStates(g.Rules, g.isCapture, 300, rng)) {
      assert.deepEqual(g.Ai._legalMoves(s).sort(), g.Rules.legalMoves(s).sort(), g.Rules.toFen(s));
    }
  });

  test(`${g.name}: nước máy trả về luôn hợp lệ ở mọi mức trên nhiều thế ngẫu nhiên`, () => {
    const rng = makeRng(11);
    const states = randomStates(g.Rules, g.isCapture, 45, rng);
    states.forEach((s, i) => {
      const level = (i % 3) + 1;
      const move = g.Ai.bestMove(s, { level, timeMs: 25, rng });
      assert.ok(g.Rules.legalMoves(s).includes(move), `${g.Rules.toFen(s)} → ${move}`);
      // Lõi riêng cũng phải tự ra nước hợp lệ (không dựa vào nước dự phòng)
      const raw = g.Ai._think(s, { level, timeMs: 25, rng });
      assert.ok(raw && g.Ai._legalMoves(s).length > 0);
    });
  });
}

test('cờ vua: mức 3 tìm được chiếu hết 1 nước', () => {
  const cases = [
    ['6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1', 'a1a8'],
    ['r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5Q2/PPPP1PPP/RNB1K1NR w KQkq - 4 4', 'f3f7'],
    ['rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3', null]
  ];
  for (const [fen, expected] of cases) {
    const s = KyChess.create({ fen });
    const move = AiChess.bestMove(s, { level: 3 });
    if (expected) assert.equal(move, expected, fen);
    else assert.equal(move, null, 'thế đã chiếu hết thì không có nước');
  }
});

test('cờ vua: mức 3 tìm được chiếu hết 2 nước', () => {
  const cases = [
    ['kbK5/pp6/1P6/8/8/8/8/R7 w - - 0 1', 'a1a6'],
    ['r2qkb1r/pp2nppp/3p4/2pNN1B1/2BnP3/3P4/PPP2PPP/R2bK2R w KQkq - 1 1', 'd5f6']
  ];
  for (const [fen, expected] of cases) {
    const s = KyChess.create({ fen });
    assert.equal(AiChess.bestMove(s, { level: 3 }), expected, fen);
    const m = AiChess.mateIn(s, 2);
    assert.ok(m && m.n === 2 && m.move === expected && m.line.length === 3);
  }
});

test('cờ tướng: mức 3 tìm được chiếu hết 1 nước và 2 nước', () => {
  const one = KyXiangqi.fromFen('4k4/5R3/5a3/4p3R/6b2/9/9/4K4/5p3/9 w - - 0 1');
  assert.equal(AiXiangqi.bestMove(one, { level: 3 }), 'i6i9');
  const two = KyXiangqi.fromFen('2b6/4k4/b1R5R/9/9/2N6/9/3KB4/9/9 w - - 0 1');
  const move = AiXiangqi.bestMove(two, { level: 3 });
  assert.equal(move, 'c7c8');
  const m = AiXiangqi.mateIn(two, 2);
  assert.ok(m && m.n === 2 && m.moves.length === 1 && m.move === 'c7c8');
  assert.equal(AiXiangqi.mateIn(two, 1), null, 'không có chiếu hết 1 nước');
});

test('máy ăn quân bị treo', () => {
  const c = KyChess.create({ fen: '4k3/8/8/3q4/8/8/3R4/4K3 w - - 0 1' });
  assert.equal(AiChess.bestMove(c, { level: 2 }), 'd2d5');
  const x = KyXiangqi.fromFen('4k4/9/9/9/4r4/9/9/4R4/9/3K5 w - - 0 1');
  assert.equal(AiXiangqi.bestMove(x, { level: 2 }), 'e2e5');
});

test('không trả nước khi ván đã hết', () => {
  // Cờ vua: chiếu hết và hết nước (hòa)
  assert.equal(AiChess.bestMove(KyChess.create({ fen: 'R5k1/5ppp/8/8/8/8/8/6K1 b - - 0 1' }), { level: 2 }), null);
  assert.equal(AiChess.bestMove(KyChess.create({ fen: '7k/5Q2/6K1/8/8/8/8/8 b - - 0 1' }), { level: 2 }), null);
  // Cờ tướng: vừa bị chiếu hết
  const s = KyXiangqi.play(KyXiangqi.fromFen('4k4/5R3/5a3/4p3R/6b2/9/9/4K4/5p3/9 w - - 0 1'), 'i6i9').state;
  assert.ok(KyXiangqi.status(s).over);
  assert.equal(AiXiangqi.bestMove(s, { level: 2 }), null);
  assert.equal(AiChess.bestMove(null), null);
  assert.equal(AiXiangqi.bestMove({}), null);
});

test('mateIn trả null khi không có chiếu hết trong số nước cho phép', () => {
  assert.equal(AiChess.mateIn(KyChess.create(), 2), null);
  assert.equal(AiXiangqi.mateIn(KyXiangqi.create(), 2), null);
  const m = AiChess.mateIn(KyChess.create({ fen: '6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1' }), 3);
  assert.equal(m.n, 1, 'trả lời giải ngắn nhất');
  assert.deepEqual(m.line, ['a1a8']);
});

test('thời gian suy nghĩ nằm trong hạn ở mức 2 và 3', () => {
  const positions = [
    ['cờ vua', AiChess, KyChess.create(), KyChess],
    ['cờ vua', AiChess, KyChess.create({ fen: 'r1bq1rk1/pp2bppp/2n1pn2/3p4/2PP4/2N2N2/PP2BPPP/R2QKB1R w KQ - 0 9' }), KyChess],
    ['cờ tướng', AiXiangqi, KyXiangqi.create(), KyXiangqi]
  ];
  for (const [name, Ai, s, Rules] of positions) {
    for (const level of [2, 3]) {
      const limit = Ai.LEVELS[level].timeMs;
      const t0 = Date.now();
      const move = Ai.bestMove(s, { level });
      const dt = Date.now() - t0;
      assert.ok(Rules.legalMoves(s).includes(move));
      assert.ok(dt <= limit + 200, `${name} mức ${level}: ${dt} ms > ${limit + 200} ms`);
    }
  }
  // Mức 1 nhanh, có thể sơ suất nhưng vẫn hợp lệ
  const t0 = Date.now();
  AiChess.bestMove(KyChess.create(), { level: 1, rng: makeRng(3) });
  assert.ok(Date.now() - t0 < 400);
});

test('mức Sơ cơ có ngẫu nhiên theo rng tiêm vào', () => {
  const s = KyChess.create();
  const seen = new Set();
  for (let i = 0; i < 12; i++) seen.add(AiChess.bestMove(s, { level: 1, rng: makeRng(i + 1) }));
  assert.ok(seen.size >= 2, 'nhiều nước khai cuộc khác nhau');
  const a = AiChess.bestMove(s, { level: 1, rng: makeRng(5) });
  const b = AiChess.bestMove(s, { level: 1, rng: makeRng(5) });
  assert.equal(a, b, 'cùng rng thì cùng nước');
});

test('cờ tướng: inCheck nhận ra chiếu và tướng đối mặt', () => {
  const s = KyXiangqi.fromFen('4k4/9/9/9/9/9/9/9/9/4K4 w - - 0 1');
  assert.equal(AiXiangqi.inCheck(s), true);
  const t = KyXiangqi.fromFen('3k5/9/9/9/9/9/9/9/9/4K4 w - - 0 1');
  assert.equal(AiXiangqi.inCheck(t), false);
});

test('cờ úp: máy vẫn trả nước hợp lệ bằng module luật', () => {
  const s = KyXiangqi.create({ variant: 'jieqi', seed: 1 });
  const move = AiXiangqi.bestMove(s, { level: 2, rng: makeRng(1) });
  assert.ok(KyXiangqi.legalMoves(s).includes(move));
});

test('Web Worker nhận lệnh và trả nước', () => {
  const dir = path.join(__dirname, '..', 'public');
  const messages = [];
  const ctx = { postMessage: m => messages.push(m), Date, Math };
  ctx.self = ctx;
  ctx.importScripts = (...urls) => {
    for (const u of urls) vm.runInContext(fs.readFileSync(path.join(dir, u), 'utf8'), ctx, { filename: u });
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(dir, 'js/kydao/ai-worker.js'), 'utf8'), ctx);
  const chess = KyChess.create({ fen: '6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1' });
  ctx.onmessage({ data: { id: 1, game: 'chess', state: chess, level: 3 } });
  const xq = KyXiangqi.create();
  ctx.onmessage({ data: { id: 2, game: 'xiangqi', state: xq, level: 1 } });
  ctx.onmessage({ data: { id: 3, game: 'go', state: xq, level: 1 } });
  assert.equal(messages[0].id, 1);
  assert.equal(messages[0].move, 'a1a8');
  assert.equal(messages[1].id, 2);
  assert.ok(KyXiangqi.legalMoves(xq).includes(messages[1].move));
  assert.equal(messages[2].id, 3);
  assert.ok(messages[2].error);
});
