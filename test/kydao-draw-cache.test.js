'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const draw = require('../public/js/kydao-draw.js');
const Skins = require('../public/js/kydao-skins.js');

function recorder() {
  const log = [];
  const ctx = new Proxy({ canvas: {} }, {
    get(target, key) {
      if (key in target) return target[key];
      if (key === 'createLinearGradient' || key === 'createRadialGradient') {
        return (...args) => { log.push([key, ...args]); return { addColorStop: () => {} }; };
      }
      return (...args) => { log.push([key, ...args]); };
    },
    set(target, key, value) { log.push(['=' + String(key), value]); return true; }
  });
  return { ctx, log };
}

const lumOf = h => {
  const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const c = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
};
const contrastOf = (a, b) => { const x = lumOf(a), y = lumOf(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

test('chữ quân cờ tướng: cả 8 bộ, hai bên đạt tương phản ≥ 4,5 so với nền thân', () => {
  const ids = Object.keys(Skins.PIECES);
  assert.equal(ids.length, 8);
  for (const id of ids) for (const side of ['a', 'b']) {
    const c = Skins.PIECES[id][side];
    const ink = draw.readableOn(c.base, c.accent, 4.5);
    assert.ok(contrastOf(ink, c.base) >= 4.5, id + '/' + side + ' tương phản ' + contrastOf(ink, c.base).toFixed(2));
  }
});

test('readableOn không truyền ngưỡng giữ hành vi cũ (ngưỡng 3, lùi về tối/sáng theo độ sáng nền)', () => {
  assert.equal(draw.readableOn('#ffffff', '#fefefe'), '#1c140d');
  assert.equal(draw.readableOn('#000000', '#010101'), '#fff6dc');
  assert.equal(draw.readableOn('#ffffff', '#ff0000'), '#ff0000');
});

function withDocument(fn) {
  const canvases = [];
  global.document = { createElement: () => { const rec = recorder(); const cv = { width: 0, height: 0, getContext: () => rec.ctx, log: rec.log }; canvases.push(cv); return cv; } };
  try { return fn(canvases); } finally { delete global.document; }
}
function render(extra) {
  const rec = recorder();
  draw.draw(rec.ctx, { game: 'xiangqi', board: Array(90).fill(''), w: 411, h: 457, dpr: 2, catalog: Skins, ...extra });
  return rec.log;
}

test('đệm nền tĩnh: hai nhịp sông cùng khóa chỉ dựng nền một lần, nhịp hai chỉ drawImage', () => withDocument(canvases => {
  const fields = Object.keys(Skins.FIELDS);
  const mk = f => ({ a: { field: f, pieces: 'jade' }, b: { field: f, pieces: 'jade' } });
  const l1 = render({ time: 100, skins: mk(fields[0]) });
  assert.equal(canvases.length, 1);
  assert.equal(canvases[0].width, 822);
  assert.equal(canvases[0].height, 914);
  const l2 = render({ time: 200, skins: mk(fields[0]) });
  assert.equal(canvases.length, 1, 'không dựng lại đệm');
  assert.equal(l2.filter(e => e[0] === 'drawImage' && e[1] === canvases[0]).length, 1);
  assert.equal(l2.length, l1.length, 'cả hai nhịp chỉ có drawImage nền + sông + quân, nền không vẽ lại');
  assert.ok(canvases[0].log.length > 20, 'nền tĩnh nằm ở canvas phụ');
  render({ time: 300, skins: mk(fields[1]) });
  assert.equal(canvases.length, 2, 'đổi skin thì dựng lại');
}));

test('không có document / không có time / cờ vua: chạy đường cũ, không dùng đệm', () => {
  assert.doesNotThrow(() => render({ time: 5 }));
  withDocument(canvases => {
    render({});
    draw.draw(recorder().ctx, { game: 'chess', board: Array(64).fill(''), w: 400, h: 400, dpr: 1, time: 5 });
    assert.equal(canvases.length, 0);
  });
});
