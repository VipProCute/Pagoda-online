'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const KyChess = require('../public/js/kydao/chess');
const KyXiangqi = require('../public/js/kydao/xiangqi');
const AiXiangqi = require('../public/js/kydao/ai-xiangqi');

const FILE = path.join(__dirname, '..', 'public', 'data', 'kydao-puzzles.json');
const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));

test('kho thế cờ nạp được và đúng định dạng gốc', () => {
  assert.equal(data.version, 1);
  assert.match(data.built, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(Array.isArray(data.chess) && data.chess.length >= 250);
  assert.ok(Array.isArray(data.xiangqi) && data.xiangqi.length >= 30);
  const ids = new Set();
  for (const p of data.chess.concat(data.xiangqi)) {
    assert.ok(!ids.has(p.id), 'mã thế trùng: ' + p.id);
    ids.add(p.id);
    assert.ok(['mate', 'draw', 'win'].includes(p.goal));
    assert.ok(Array.isArray(p.moves) && p.moves.length % 2 === 1, p.id + ': lời giải kết thúc bằng nước người giải');
    assert.equal(p.n, (p.moves.length + 1) / 2, p.id);
    assert.ok(typeof p.source === 'string' && p.source.length > 0);
  }
});

test('cờ vua: mọi nước hợp lệ, thế chiếu hết kết thúc bằng chiếu hết', () => {
  const goals = {};
  for (const p of data.chess) {
    assert.equal(p.game, 'chess');
    assert.match(p.source, /^lichess:\w+$/);
    goals[p.goal] = (goals[p.goal] || 0) + 1;
    let s = KyChess.create({ fen: p.fen });
    const solver = KyChess.turn(s);
    assert.match(p.last, /^[a-h][1-8][a-h][1-8][qrbn]?$/);
    for (const m of p.moves) {
      const r = KyChess.play(s, m);
      assert.ok(r.ok, `${p.id}: nước ${m} không hợp lệ`);
      s = r.state;
    }
    const st = KyChess.status(s);
    if (p.goal === 'mate') {
      assert.ok(st.over && st.reason === 'checkmate' && st.winner === solver, p.id + ': chưa chiếu hết');
    }
  }
  assert.ok(goals.mate >= 150 && goals.draw >= 20 && goals.win >= 30, JSON.stringify(goals));
});

test('cờ vua: trong mỗi nhóm thế cờ sắp theo rating tăng dần', () => {
  const groups = {};
  for (const p of data.chess) (groups[p.group] = groups[p.group] || []).push(p.rating);
  for (const [g, list] of Object.entries(groups)) {
    for (let i = 1; i < list.length; i++) assert.ok(list[i] >= list[i - 1], 'nhóm ' + g);
  }
});

test('cờ tướng: mọi nước hợp lệ, kết thúc bằng chiếu hết, không có lời giải ngắn hơn', () => {
  const byN = {};
  for (const p of data.xiangqi) {
    assert.equal(p.game, 'xiangqi');
    assert.equal(p.goal, 'mate');
    assert.equal(p.source, 'tao-bang-may');
    byN[p.n] = (byN[p.n] || 0) + 1;
    const start = KyXiangqi.fromFen(p.fen);
    assert.equal(start.turn, 'a');
    assert.equal(AiXiangqi.inCheck(start, 'b'), false, p.id + ': bên không đi đang bị chiếu');
    let s = start, info = null;
    for (const m of p.moves) {
      const r = KyXiangqi.play(s, m);
      assert.ok(r.ok, `${p.id}: nước ${m} không hợp lệ`);
      s = r.state; info = r.info;
    }
    const st = KyXiangqi.status(s);
    assert.ok(st.over && st.winner === 'a' && info.check, p.id + ': chưa chiếu hết');
    if (p.n > 1) assert.equal(AiXiangqi.mateIn(start, p.n - 1), null, p.id + ': có lời giải ngắn hơn');
    const m = AiXiangqi.mateIn(start, p.n);
    assert.ok(m && m.n === p.n && m.moves.length === 1 && m.move === p.moves[0], p.id + ': nước đầu không duy nhất');
  }
  assert.ok(byN[1] >= 8 && byN[2] >= 10 && byN[3] >= 8, JSON.stringify(byN));
});
