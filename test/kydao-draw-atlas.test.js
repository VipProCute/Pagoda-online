'use strict';
// Kỳ Đạo · Quân 2D vẽ bằng atlas render 3D (Canvas giả + Image giả ghi lại lệnh vẽ).
// drawImage 9 tham số: ['drawImage', img, sx, sy, sw, sh, dx, dy, dw, dh].
const test = require('node:test');
const assert = require('node:assert/strict');
const KydaoSkins = require('../public/js/kydao-skins.js');
const KydaoDraw = require('../public/js/kydao-draw.js');
const KyChess = require('../public/js/kydao/chess.js');
const KyXiangqi = require('../public/js/kydao/xiangqi.js');

global.KydaoSkins = KydaoSkins;

function recorder() {
  const log = [];
  const ctx = new Proxy({ canvas: {} }, {
    get(t, k) {
      if (k in t) return t[k];
      if (k === 'createLinearGradient' || k === 'createRadialGradient') {
        return (...a) => { log.push([k, ...a]); return { addColorStop: (...s) => log.push(['stop', ...s]) }; };
      }
      return (...a) => { log.push([k, ...a]); };
    },
    set(t, k, v) { log.push(['=' + String(k), v]); return true; }
  });
  return { ctx, log };
}
const run = o => { const r = recorder(); KydaoDraw.draw(r.ctx, o); return r.log; };
const piecesOf = id => ({ a: { pieces: id }, b: { pieces: id } });
const atlasCalls = log => log.filter(x => x[0] === 'drawImage' && x.length === 10);

/** Image giả: ghi lại ảnh đã tạo; tải xong / lỗi do test tự gọi onload / onerror. */
function fakeImage() {
  const made = [];
  global.Image = class { constructor() { made.push(this); } };
  return made;
}
const chessOpts = (extra, board) => ({ game: 'chess', board: board || KyChess.create().board, w: 400, h: 400, dpr: 1, ...extra });
const xqOpts = (extra, board) => ({ game: 'xiangqi', board: board || KyXiangqi.create().board, w: 368, h: 408, dpr: 1, ...extra });

test('Atlas chưa tải: không có drawImage quân, vẽ vector đổi màu; không có Image cũng không lỗi', () => {
  const made = fakeImage();
  try {
    const log = run(chessOpts({ skins: piecesOf('magma') }));
    assert.equal(atlasCalls(log).length, 0);
    assert.ok(log.some(x => x[0] === 'bezierCurveTo'), 'vẽ vector');
    assert.ok(made.some(i => i.src === '/img/kydao/pieces2d/magma.webp'), 'đã yêu cầu tải atlas');
    delete global.Image;
    assert.equal(atlasCalls(run(chessOpts({ skins: piecesOf('ice') }))).length, 0);
  } finally { delete global.Image; }
});

test('Atlas tải xong: mỗi quân cờ vua đúng một drawImage, ô theo cột/hàng, đáy quân đúng chỗ, không glow', () => {
  const made = fakeImage();
  try {
    let again = 0;
    const o = chessOpts({ skins: piecesOf('jade'), onAsset: () => again++ });
    run(o);
    made.find(i => /jade/.test(i.src)).onload();
    assert.equal(again, 1, 'onAsset gọi để vẽ lại');
    const log = run(o);
    const calls = atlasCalls(log);
    assert.equal(calls.length, 32);
    assert.equal(log.filter(x => x[0] === 'createRadialGradient').length, 0, 'không glow vector');
    const keys = calls.map(c => c[2] + ',' + c[3]);
    assert.ok(keys.includes('0,0'), 'K trắng');
    assert.ok(keys.includes('128,128'), 'q đen');
    assert.ok(keys.includes('512,0'), 'N trắng');
    assert.ok(calls.every(c => c[4] === 128 && c[5] === 128 && c[8] === c[9]));
    // Ô cờ 50px: T = 1,12·ô; đáy quân (118/128) ở cy + 0,44·ô.
    const cell = 50, k = calls.find(c => c[2] === 0 && c[3] === 0), T = k[8];
    assert.ok(Math.abs(T - cell * 1.12) < 1e-9);
    const cy = k[7] + T * 118 / 128 - cell * 0.44;
    assert.ok(Math.abs((cy % cell) - cell / 2) < 1e-6, 'tâm ô nguyên, đáy quân đặt đúng');
  } finally { delete global.Image; }
});

test('Cờ tướng: thân là ô disc (cột 6) và chữ quân vẫn vẽ sau drawImage', () => {
  const made = fakeImage();
  try {
    const o = xqOpts({ skins: piecesOf('storm') });
    run(o); made.find(i => /storm/.test(i.src)).onload();
    const log = run(o);
    const calls = atlasCalls(log);
    assert.equal(calls.length, 32);
    assert.ok(calls.every(c => c[2] === 768), 'cột disc');
    assert.ok(calls.some(c => c[3] === 0) && calls.some(c => c[3] === 128), 'hai hàng theo bên');
    assert.ok(calls.every(c => Math.abs(c[8] * 108 / 128 / 0.86 - 368 / 9.2) < 3), 'thân tròn 0,86·ô');
    for (const c of calls) {
      assert.ok(log.slice(log.indexOf(c)).some(x => x[0] === 'fillText'), 'có chữ sau thân');
    }
  } finally { delete global.Image; }
});

test('Cờ úp: hai quân úp cùng bên cho lệnh vẽ giống hệt (chỉ khác vị trí)', () => {
  const made = fakeImage();
  try {
    const board = Array(90).fill(''); board[0] = 'X'; board[8] = 'X'; board[81] = 'x'; board[89] = 'x';
    const o = { game: 'jieqi', board, w: 368, h: 408, dpr: 1, skins: piecesOf('wood') };
    run(o); made.find(i => /wood/.test(i.src)).onload();
    const log = run(o);
    const calls = atlasCalls(log);
    assert.equal(calls.length, 4);
    // Chữ ngay sau thân: so cả phông, màu và nội dung.
    const sig = c => { const i = log.indexOf(c); return JSON.stringify([c.slice(1, 6), c[8], c[9], log.slice(i + 1, i + 9).map(x => x.slice(0, 2))]); };
    for (const row of [0, 128]) {
      const [p, q] = calls.filter(c => c[3] === row);
      assert.ok(p && q);
      assert.equal(sig(p), sig(q));
      assert.ok(log.slice(log.indexOf(p)).some(x => x[0] === 'fillText' && x[1] === '?'));
    }
  } finally { delete global.Image; }
});

test('Atlas 404: quay về đường vector, không ném lỗi', () => {
  const made = fakeImage();
  try {
    const o = chessOpts({ skins: piecesOf('coral') });
    run(o); made.find(i => /coral/.test(i.src)).onerror();
    let log;
    assert.doesNotThrow(() => { log = run(o); });
    assert.equal(atlasCalls(log).length, 0);
    assert.ok(log.some(x => x[0] === 'bezierCurveTo'));
    assert.doesNotThrow(() => run(xqOpts({ skins: piecesOf('coral') })));
    assert.equal(atlasCalls(run(xqOpts({ skins: piecesOf('coral') }))).length, 0);
  } finally { delete global.Image; }
});

test('jolt dịch toạ độ đích của drawImage (cờ vua và cờ tướng)', () => {
  const made = fakeImage();
  try {
    const cb = Array(64).fill(''); cb[60] = 'K';
    const xb = Array(90).fill(''); xb[4] = 'K';
    const cases = [[chessOpts, cb, KydaoDraw.nameOf('chess', 4, 7)], [xqOpts, xb, KydaoDraw.nameOf('xiangqi', 4, 0)]];
    for (const [mk, board] of cases) run(mk({ skins: piecesOf('bronze') }, board));
    made.find(i => /bronze/.test(i.src)).onload();
    for (const [mk, board, sq] of cases) {
      const base = mk({ skins: piecesOf('bronze') }, board);
      const la = run(base), lb = run({ ...base, jolt: { [sq]: { dx: 5, dy: -3 } } });
      const a = atlasCalls(la), b = atlasCalls(lb);
      assert.equal(a.length, 1); assert.equal(b.length, 1);
      // Cờ tướng vẽ ở gốc (0,0) sau translate tới tâm quân: toạ độ đích thật = translate + dx/dy.
      const origin = (log, c) => { const t = log.slice(0, log.indexOf(c)).filter(x => x[0] === 'translate').pop(); return mk === xqOpts ? [t[1], t[2]] : [0, 0]; };
      const [ax, ay] = origin(la, a[0]), [bx, by] = origin(lb, b[0]);
      assert.ok(Math.abs((b[0][6] + bx) - (a[0][6] + ax) - 5) < 1e-9, 'dx');
      assert.ok(Math.abs((b[0][7] + by) - (a[0][7] + ay) + 3) < 1e-9, 'dy');
    }
  } finally { delete global.Image; }
});
