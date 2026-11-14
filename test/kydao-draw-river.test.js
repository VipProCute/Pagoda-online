'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const draw = require('../public/js/kydao-draw.js');

function recorder() {
  const log = [];
  const ctx = new Proxy({ canvas: {} }, {
    get(target, key) {
      if (key in target) return target[key];
      if (key === 'createLinearGradient' || key === 'createRadialGradient') {
        return (...args) => { log.push([key, ...args]); return { addColorStop: (...stop) => log.push(['stop', ...stop]) }; };
      }
      return (...args) => { log.push([key, ...args]); };
    },
    set(target, key, value) { log.push(['=' + String(key), value]); return true; }
  });
  return { ctx, log };
}

function render(game, extra) {
  const board = Array(game === 'chess' ? 64 : 90).fill('');
  board[4] = 'K';
  const rec = recorder();
  draw.draw(rec.ctx, { game, board, w: 368, h: 408, dpr: 1, ...extra });
  return rec.log;
}

test('Biên độ gợn sóng không vượt 0,06 ô tại 200 điểm', () => {
  let seed = 17;
  for (let i = 0; i < 200; i++) {
    seed = (seed * 16807) % 2147483647;
    for (let k = 0; k < 3; k++) assert.ok(Math.abs(draw.riverWave(seed / 2147483647, k, i * 137)) <= 0.06);
  }
});

test('Gợn sóng tuần hoàn theo hoành độ nguyên', () => {
  for (let k = 0; k < 3; k++) for (let i = 0; i < 20; i++) {
    assert.ok(Math.abs(draw.riverWave(i / 20, k, 1234) - draw.riverWave(i / 20 + 1, k, 1234)) < 1e-12);
  }
});

test('Cờ tướng thiếu thời gian vẽ hai lần giống nhau', () => {
  assert.equal(JSON.stringify(render('xiangqi')), JSON.stringify(render('xiangqi')));
});

test('Thời gian khác nhau làm thay đổi dòng sông', () => {
  assert.notEqual(JSON.stringify(render('xiangqi', { time: 100 })), JSON.stringify(render('xiangqi', { time: 1000 })));
});

test('Cờ vua không vẽ màu nước', () => {
  assert.ok(!render('chess').some(entry => entry.includes('#1f6f86')));
});

test('Quân và dấu nằm trên sông ở cờ tướng và cờ úp', () => {
  for (const game of ['xiangqi', 'jieqi']) for (const flip of [false, true]) {
    const log = render(game, { flip, selected: 'e0' });
    const river = log.findIndex(entry => entry[0] === 'stop' && entry[2] === '#1f6f86');
    const mark = log.findIndex(entry => entry[0] === '=fillStyle' && entry[1] === 'rgba(80,190,120,.5)');
    const piece = log.findIndex(entry => entry[0] === 'translate');
    assert.ok(river >= 0 && mark > river && piece > mark, game);
  }
});
