'use strict';
// Ván trên máy (public/js/kydao-local.js) chạy trong node:vm với bảng cờ giả và Web Worker giả gọi máy thật.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const PUZ = require('../public/data/kydao-puzzles.json');
const read = f => fs.readFileSync(path.join(__dirname, '..', 'public', f), 'utf8');

function sandbox() {
  const opened = [], applied = [], toasts = [];
  const ctx = {
    console, setTimeout: (fn, ms) => setTimeout(fn, Math.min(ms, 5)), clearTimeout,
    localStorage: (() => { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) }; })(),
    fetch: async () => ({ ok: true, json: async () => JSON.parse(JSON.stringify(PUZ)) }),
    KydaoUI: { open: (start, hooks) => { opened.push({ start, hooks }); return true; }, apply: ev => applied.push(ev) }
  };
  ctx.self = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  for (const f of ['js/kydao/chess.js', 'js/kydao/xiangqi.js', 'js/kydao/ai-chess.js', 'js/kydao/ai-xiangqi.js']) vm.runInContext(read(f), ctx, { filename: f });
  // Worker giả: tính ngay bằng máy thật (mức 1 cho nhanh)
  ctx.Worker = function () {
    const w = this;
    w.postMessage = msg => {
      const ai = msg.game === 'chess' ? ctx.KyAiChess : ctx.KyAiXiangqi;
      const move = ai.bestMove(msg.state, { level: 1 });
      setTimeout(() => w.onmessage({ data: { id: msg.id, move } }), 0);
    };
  };
  vm.runInContext(read('js/kydao-local.js'), ctx, { filename: 'kydao-local.js' });
  ctx.KydaoLocal.init({ name: () => 'Người Thử', toast: t => toasts.push(t), sound() {}, onOpen() {}, onClose() {} });
  return { ctx, L: ctx.KydaoLocal, opened, applied, toasts };
}
const send = (hooks, name, data) => new Promise(res => hooks.send(name, data, res));
const until = async (fn, ms = 4000) => { const t = Date.now(); while (!fn()) { if (Date.now() - t > ms) throw new Error('hết giờ chờ'); await new Promise(r => setTimeout(r, 5)); } };

test('đánh với máy: nước của người được kiểm, máy đáp bằng kd:moved hợp lệ, chịu thua thì kết thúc', async () => {
  for (const game of ['chess', 'xiangqi']) {
    const E = sandbox();
    assert.equal(E.L.playAi({ game, level: 1, side: 'a' }), true);
    const { start, hooks } = E.opened[0];
    assert.equal(start.local, 'ai');
    assert.equal(start.you, 'a');
    assert.match(start.b.name, /Ngọa Long Kỳ Sư/);
    const mod = game === 'chess' ? E.ctx.KyChess : E.ctx.KyXiangqi;
    assert.equal((await send(hooks, 'kd:move', { gameId: start.gameId, ply: 0, move: 'a1a5' })).ok, false, 'nước sai bị từ chối');
    const first = mod.legalMoves(start.state)[0];
    assert.equal((await send(hooks, 'kd:move', { gameId: start.gameId, ply: 0, move: first })).ok, true);
    await until(() => E.applied.some(e => e.type === 'kd:moved'));
    const mv = E.applied.find(e => e.type === 'kd:moved');
    assert.equal(mv.ply, 2); assert.equal(mv.side, 'b');
    const after = mod.play(start.state, first).state;
    assert.ok(mod.legalMoves(after).includes(mv.move), 'nước máy hợp lệ');
    assert.equal((await send(hooks, 'kd:draw', { act: 'offer' })).ok, false);
    assert.equal((await send(hooks, 'kd:resign', {})).ok, true);
    const end = E.applied.find(e => e.type === 'kd:end');
    assert.equal(end.result, 'b');
  }
});

test('máy đi trước khi người chọn đi sau', async () => {
  const E = sandbox();
  E.L.playAi({ game: 'chess', level: 1, side: 'b' });
  await until(() => E.applied.some(e => e.type === 'kd:moved'));
  assert.equal(E.applied[0].side, 'a');
  assert.equal(E.applied[0].ply, 1);
});

test('giải thế cờ: đi sai được thử lại, đi đúng đường thì đối phương tự đáp và báo giải đúng', async () => {
  const E = sandbox();
  await E.L.loadPuzzles();
  const cats = E.L.categories('chess');
  assert.deepEqual(Array.from(cats, c => c.key), ['mate1', 'mate2', 'mate3', 'draw', 'win-end', 'win-mid']);
  assert.ok(E.L.categories('xiangqi').length >= 3);
  for (const [game, key] of [['chess', 'mate2'], ['xiangqi', 'mate3'], ['chess', 'draw']]) {
    E.opened.length = 0; E.applied.length = 0;
    assert.equal(E.L.playPuzzle(game, key), true);
    const { start, hooks } = E.opened[0];
    const puzzle = PUZ[game].filter(x => x.group === key)[0];   // thế chưa giải đầu tiên của nhóm
    assert.match(start.title, /Bài 1\//);
    const mod = game === 'chess' ? E.ctx.KyChess : E.ctx.KyXiangqi;
    const wrong = mod.legalMoves(start.state).find(m => m !== puzzle.moves[0] && !mod.status(mod.play(start.state, m).state).over);
    assert.equal((await send(hooks, 'kd:move', { gameId: start.gameId, ply: 0, move: wrong })).ok, false);
    let ply = 0;
    for (let i = 0; i < puzzle.moves.length; i += 2) {
      assert.equal((await send(hooks, 'kd:move', { gameId: start.gameId, ply, move: puzzle.moves[i] })).ok, true, game + ' ' + puzzle.id);
      ply += 2;
      if (i + 1 < puzzle.moves.length) await until(() => E.applied.filter(e => e.type === 'kd:moved').length >= (i + 2) / 2);
    }
    await until(() => E.applied.some(e => e.type === 'kd:end'));
    const end = E.applied.find(e => e.type === 'kd:end');
    assert.equal(end.head, 'Giải đúng!');
    assert.equal(end.result, start.you);
  }
  assert.equal(E.L.categories('chess').find(c => c.key === 'mate2').solved, 1, 'đánh dấu đã giải');
});

test('xem lời giải kết thúc thế cờ và ghi đủ dòng nước', async () => {
  const E = sandbox();
  await E.L.loadPuzzles();
  E.L.playPuzzle('xiangqi', 'mate2');
  const { hooks } = E.opened[0];
  await send(hooks, 'kd:resign', {});
  const end = E.applied.find(e => e.type === 'kd:end');
  assert.equal(end.head, 'Lời giải');
  assert.equal(end.text.split(' · ').length, 3);
});

test('xem lời giải phải qua cúng dường vui: chỉ hiện sau khi host báo đã tạo mã QR; gợi ý miễn phí', async () => {
  const E = sandbox();
  let unlock = null;
  E.L.init({ name: () => 'Người Thử', toast: t => E.toasts.push(t), sound() {}, onOpen() {}, onClose() {}, unlockSolution: done => { unlock = done; } });
  await E.L.loadPuzzles();
  E.L.playPuzzle('chess', 'mate1');
  const { start, hooks } = E.opened[0];
  assert.match(start.resignLabel, /cúng dường/);
  hooks.hint();
  assert.match(E.toasts.at(-1), /Gợi ý/);
  await send(hooks, 'kd:resign', {});
  assert.equal(E.applied.filter(e => e.type === 'kd:end').length, 0, 'chưa tạo mã thì chưa có lời giải');
  assert.equal(typeof unlock, 'function');
  unlock();
  const end = E.applied.find(e => e.type === 'kd:end');
  assert.equal(end.head, 'Lời giải');
});

test('gợi ý gọi máy chủ (trừ công đức) một lần mỗi bước, lỗi thì báo lý do', async () => {
  const E = sandbox();
  const asks = [];
  let answer = { ok: false, reason: 'Cần ít nhất 5 công đức để xin gợi ý (bạn đang có 0).' };
  E.L.init({ name: () => 'Người Thử', toast: t => E.toasts.push(t), sound() {}, onOpen() {}, onClose() {}, requestHint: (id, step, cb) => { asks.push([id, step]); cb(answer); } });
  await E.L.loadPuzzles();
  E.L.playPuzzle('chess', 'mate2');
  const { hooks } = E.opened[0];
  assert.match(hooks.hintLabel, /5 công đức/);
  hooks.hint();
  assert.match(E.toasts.at(-1), /Cần ít nhất 5 công đức/);
  answer = { ok: true, square: 'e2', cost: 5 };
  hooks.hint(); hooks.hint(); hooks.hint();
  assert.equal(asks.length, 2, 'đã có gợi ý của bước này thì không hỏi (không trừ) lại');
  assert.match(E.toasts.at(-1), /ô e2/);
  assert.equal(asks[0][1], 0);
});
