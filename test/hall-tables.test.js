'use strict';
// Bàn đá Kỳ Đạo ở Sân chùa (T-031): vẽ, biển tên, vùng chạm, tư thế ngồi bàn, biểu tượng "bàn trong".
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const merit = require('../public/js/merit');
const Actors = require('../public/js/actors');

const SIZES = [[375, 374], [768, 482], [910, 661], [360, 360]];   // cỡ canvas thật: điện thoại dọc, máy tính bảng, máy tính, màn nhỏ

function makeHall(W, H, opts) {
  opts = opts || {};
  let nextFrame;
  const rec = { labels: [], fills: [], rects: 0, hits: {} };
  const gradient = { addColorStop() {} };
  const ctx = new Proxy({}, { get(target, key) {
    if (key in target) return target[key];
    if (key === 'measureText') return text => ({ width: String(text).length * 6 });
    if (key === 'fillText') return text => { rec.labels.push(text); };
    if (key === 'fillRect') return () => { rec.rects++; };
    if (key === 'createLinearGradient' || key === 'createRadialGradient') return () => gradient;
    return () => {};
  }, set(target, key, value) { if (key === 'fillStyle') rec.fills.push(value); target[key] = value; return true; } });
  const canvas = { width: W, height: H, style: {}, listeners: {}, getContext: () => ctx,
    getBoundingClientRect: () => ({ width: W, height: H, left: 0, top: 0 }),
    addEventListener(type, fn) { this.listeners[type] = fn; } };
  const sandbox = { Math, Date, Actors, Image: class { }, MERIT: merit, devicePixelRatio: 1,
    matchMedia: q => ({ matches: /pointer: coarse/.test(q) ? !!opts.coarse : !!opts.reduce }), addEventListener() {}, performance: { now: () => 1000 },
    document: { hidden: false, createElement: () => ({ width: 0, height: 0, getContext: () => ctx }) },
    requestAnimationFrame: fn => { nextFrame = fn; } };
  vm.runInNewContext(fs.readFileSync(require.resolve('../public/js/hall.js'), 'utf8'), sandbox);
  const calls = { table: [], person: [], reader: [], npc: [] };
  sandbox.Hall.init(canvas, {
    table: (id, seat) => calls.table.push([id, seat]), person: id => calls.person.push(id),
    reader: k => calls.reader.push(k), npc: id => calls.npc.push(id)
  });
  sandbox.Hall.setMe(1);
  sandbox.Hall.setScene('yard');
  const frame = ts => nextFrame(ts);
  const tap = (x, y) => { for (const k of Object.keys(calls)) calls[k].length = 0; canvas.listeners.pointerdown({ clientX: x, clientY: y }); return calls; };
  return { Hall: sandbox.Hall, canvas, frame, tap, calls, rec, W, H };
}

const T = (table, status, extra) => ({ table, status, seats: [null, null], watchers: 0, ...extra });

test('biển bàn: "Bàn N · <môn> · <trạng thái>", không kết thúc bằng " · NPC"', () => {
  const h = makeHall(960, 600);
  h.frame(1000);
  assert.ok(h.rec.labels.includes('Bàn 1 · trống'));
  h.Hall.setTables([
    T(2, 'playing', { game: 'xiangqi', watchers: 3, seats: [{ pid: 7, name: 'A', ready: true }, { pid: 8, name: 'B', ready: true }] }),
    T(3, 'waiting', { game: 'chess', seats: [{ pid: 9, name: 'C', ready: false }, null] }),
    T(4, 'waiting', { seats: [{ pid: 10, name: 'D', ready: false }, null] })
  ]);
  h.rec.labels.length = 0; h.frame(1100);
  for (const s of ['Bàn 1 · trống', 'Bàn 2 · Cờ tướng · đang đấu · 3 người xem', 'Bàn 3 · Cờ vua · chờ người', 'Bàn 4 · chờ người']) assert.ok(h.rec.labels.includes(s), s);
  assert.equal(h.rec.labels.filter(s => s.endsWith(' · NPC')).length, 3, 'chỉ 3 nhãn NPC ở sân');
  // kd:table (một bàn) gộp vào trạng thái cũ; bàn về free thì đổi biển
  h.Hall.setTable(T(2, 'free'));
  h.rec.labels.length = 0; h.frame(1200);
  assert.ok(h.rec.labels.includes('Bàn 2 · trống'));
  assert.ok(h.rec.labels.includes('Bàn 3 · Cờ vua · chờ người'));
  // dữ liệu lạ không làm hỏng: môn không có trong danh sách bị bỏ, bàn ngoài 1–4 bị bỏ
  h.Hall.setTables([T(1, 'playing', { game: 'constructor' }), T(9, 'playing'), null, 5], true);
  h.rec.labels.length = 0; h.frame(1300);
  assert.ok(h.rec.labels.includes('Bàn 1 · đang đấu'));
  assert.ok(!h.rec.labels.some(s => s.includes('Bàn 9')));
});

test('chạm bàn/ghế gọi handlers.table(id, seat), không đè vùng chạm thầy bói ở 3 cỡ màn', () => {
  for (const [W, H] of SIZES) {
    const h = makeHall(W, H);
    h.frame(1000);
    const u = Math.min(W / 960, H / 600), k = Math.max(u, 0.6);
    const rw = Math.min(W * 0.22, 165 * k), rh = Math.min(H * 0.22, 150 * k), bottom = H * 0.63;
    const inReader = (x, y) => [0.2, 0.8].some(i => Math.abs(x - W * i) <= rw / 2 + 12 && y >= bottom - rh && y <= bottom + 38);
    const found = new Map(), overlap = [];
    for (let y = 0; y < H; y += 3) for (let x = 0; x < W; x += 3) {
      const c = h.tap(x, y);
      if (c.table.length) {
        found.set(c.table[0].join(':'), true);
        if (inReader(x, y)) overlap.push(x + ',' + y);
      }
    }
    assert.deepEqual(overlap, [], `bàn đè vùng thầy bói ở ${W}x${H}`);
    for (let id = 1; id <= 4; id++) for (const seat of [-1, 0, 1]) assert.ok(found.has(id + ':' + seat), `${W}x${H}: chạm được bàn ${id} ghế ${seat}`);
    // vẫn chạm được thầy bói ngoài vùng bàn
    const c = h.tap(W * 0.2, bottom - rh / 2);
    assert.equal(JSON.stringify(c.reader), '["horoscope"]', `${W}x${H}: thầy tử vi`);
  }
});

test('thầy bói được ưu tiên: quét cả vùng thầy bói khi 4 bàn đều có người ngồi, chỉ gọi reader, không gọi table', () => {
  for (const [W, H] of SIZES) {
    const h = makeHall(W, H);
    const specs = h.Hall.YARD_TABLES;
    const players = [], tables = [];
    for (const t of specs) {
      const seats = t.seats.map((s, i) => ({ pid: t.id * 10 + i, name: 'N' + i, ready: false }));
      t.seats.forEach(([x, z], i) => players.push({ id: t.id * 10 + i, name: 'N' + i, look: { g: 'nam', c: 1, h: 2 }, x, z, scene: 'yard' }));
      tables.push(T(t.id, 'waiting', { game: 'go', size: 9, seats }));
    }
    h.Hall.setPlayers(players);
    h.Hall.setTables(tables);
    h.frame(1000); h.frame(1100); h.frame(1200);
    const k = Math.max(Math.min(W / 960, H / 600), 0.6);
    const rw = Math.min(W * 0.22, 165 * k), rh = Math.min(H * 0.22, 150 * k), bottom = H * 0.63;
    let n = 0;
    for (const i of [0.2, 0.8]) for (let y = Math.ceil(bottom - rh); y <= bottom + 38; y += 2) for (let x = Math.ceil(W * i - rw / 2 - 12); x <= W * i + rw / 2 + 12; x += 2) {
      const c = h.tap(x, y);
      if (c.person.length) continue;                        // người đứng có quyền ưu tiên riêng
      assert.equal(c.table.length, 0, `${W}x${H}: điểm ${x},${y} trong vùng thầy bói không được mở bàn`);
      n++;
    }
    assert.ok(n > 0, `${W}x${H}: có quét vùng thầy bói`);
    // biển TỬ VI/TAROT và dòng "Chạm để xem" nằm trong vùng đó: chạm giữa vùng vẫn tới reader
    const c = h.tap(W * 0.2, bottom + 20);
    if (!c.person.length) assert.equal(JSON.stringify(c.reader), '["horoscope"]', `${W}x${H}: dòng Chạm để xem → thầy tử vi`);
  }
});

test('máy cảm ứng (pointer: coarse) ở màn rộng: vùng chạm ghế được nới', () => {
  const count = coarse => {
    const h = makeHall(1024, 768, { coarse }); h.frame(1000);
    let n = 0;
    for (let y = 0; y < 768; y += 2) for (let x = 0; x < 1024; x += 2) { const c = h.tap(x, y); if (c.table.length && c.table[0][1] >= 0) n++; }
    return n;
  };
  assert.ok(count(true) > count(false), 'cảm ứng nới vùng chạm ghế');
});

test('biển tên: nằm trong màn, không chồng nhau, không giao vùng thầy bói, chạm biển là mở bàn (6 cỡ màn)', () => {
  for (const [W, H] of [...SIZES, [768, 1024], [1280, 800]]) {
    const h = makeHall(W, H);
    const playing = id => T(id, 'playing', { game: 'xiangqi', watchers: 12, seats: [{ pid: id * 2, name: 'A', ready: true }, { pid: id * 2 + 1, name: 'B', ready: true }] });
    for (const states of [[1, 2, 3, 4].map(id => T(id, 'free')), [1, 2, 3, 4].map(playing)]) {
      h.Hall.setTables(states);
      h.frame(1000); h.frame(1100);
      const k = Math.max(Math.min(W / 960, H / 600), 0.6);
      const rw = Math.min(W * 0.22, 165 * k), rh = Math.min(H * 0.22, 150 * k), bottom = H * 0.63;
      const signs = h.Hall.tableSigns();
      assert.equal(signs.length, 4, `${W}x${H}: đủ 4 biển`);
      for (const s of signs) {
        assert.ok(s.x >= 0 && s.x + s.w <= W && s.y >= 0 && s.y + s.h <= H, `${W}x${H}: biển ${s.id} trong màn`);
        for (const i of [0.2, 0.8]) {
          const rx = W * i, hitX = [rx - rw / 2 - 12, rx + rw / 2 + 12];
          const gx = s.x < hitX[1] && s.x + s.w > hitX[0], gy = s.y < bottom + 38 && s.y + s.h > bottom - rh;
          assert.ok(!(gx && gy), `${W}x${H}: biển ${s.id} không giao vùng thầy bói`);
        }
        const c = h.tap(s.x + s.w / 2, s.y + s.h / 2);
        assert.equal(c.table.length, 1, `${W}x${H}: chạm biển ${s.id} mở một bàn`);
        assert.equal(c.table[0][0], s.id, `${W}x${H}: chạm biển ${s.id} mở đúng bàn (ghế sát biển cùng bàn cũng được)`);
      }
      for (let a = 0; a < signs.length; a++) for (let b = a + 1; b < signs.length; b++) {
        const p = signs[a], q = signs[b];
        assert.ok(p.x + p.w <= q.x || q.x + q.w <= p.x || p.y + p.h <= q.y || q.y + q.h <= p.y, `${W}x${H}: biển ${p.id} và ${q.id} không chồng`);
      }
    }
  }
});

test('setTables(object T) luôn gộp, không xoá bàn khác; mảng thì thay toàn bộ', () => {
  const h = makeHall(960, 600);
  h.Hall.setTables([T(2, 'playing', { game: 'chess' }), T(3, 'waiting', { game: 'go' })]);
  h.Hall.setTables(T(1, 'waiting', { game: 'chess' }));
  h.rec.labels.length = 0; h.frame(1000); h.frame(1100);
  for (const s of ['Bàn 1 · Cờ vua · chờ người', 'Bàn 2 · Cờ vua · đang đấu', 'Bàn 3 · Cờ vây · chờ người']) assert.ok(h.rec.labels.includes(s), s);
  h.Hall.setTables([T(4, 'free')]);
  h.rec.labels.length = 0; h.frame(1200);
  assert.ok(h.rec.labels.includes('Bàn 2 · trống'), 'mảng thay toàn bộ');
});

test('NPC xếp sau bàn đá: NPC đứng ngay bàn thì chạm bàn vẫn mở bàn; NPC đứng trước bàn thì chạm được NPC', () => {
  for (const [W, H] of [...SIZES, [360, 640], [390, 700]]) {
    const h = makeHall(W, H);
    h.frame(1000);
    const spec = h.Hall.YARD_TABLES[0];
    let ts = 1064;
    // thu vùng đi lại về một điểm: hai NPC thường dạt ra góc, Vạn Lý Độc Hành (NPC cơ duyên) đứng ở (x, z)
    const scan = (x, z) => {
      h.Hall.npc(-301).area = { x0: x, x1: x, z0: z, z1: z };
      for (const id of [-102, -103]) h.Hall.npc(id).area = { x0: 0.85, x1: 0.85, z0: 0.8, z1: 0.8 };
      for (const end = ts + 3000; ts < end; ts += 64) h.frame(ts);
      const n = h.Hall.npc(-301);
      let npcHits = 0, tableHits = 0;
      for (let y = Math.round(n.sy - 110 * n.s); y < n.sy + 6; y += 2) for (let px = Math.round(n.sx - 20 * n.s); px <= n.sx + 20 * n.s; px += 2) {
        const c = h.tap(px, y);
        if (c.npc.length) { npcHits++; assert.equal(c.npc[0], -301); assert.equal(c.table.length, 0); }
        if (c.table.length) tableHits++;
      }
      return { npcHits, tableHits };
    };
    assert.ok(scan(spec.x, spec.z).tableHits > 0, `${W}x${H}: NPC đứng đè bàn không che vùng chạm bàn`);
    assert.ok(scan(spec.x, spec.z + 0.14).npcHits > 0, `${W}x${H}: NPC đứng trước bàn vẫn chạm được`);
  }
});

test('người ngồi bàn: tư thế ngồi từ setTables, chạm vào người mở bàn (không mở hộp người chơi)', () => {
  const h = makeHall(960, 600);
  const spec = h.Hall.YARD_TABLES[0];
  h.Hall.setPlayers([
    { id: 42, name: 'Người thử', look: { g: 'nam', c: 1, h: 2 }, x: spec.seats[0][0], z: spec.seats[0][1], scene: 'yard' },
    { id: 43, name: 'Người đứng', look: { g: 'nu', c: 2, h: 1 }, x: 0.5, z: 0.7, scene: 'yard' }
  ]);
  h.frame(1000); h.frame(1100);
  assert.ok(!h.Hall.player(42).seated, 'chưa có trong bàn thì đứng');
  h.Hall.setTables([T(1, 'waiting', { game: 'go', size: 9, seats: [{ pid: 42, name: 'x', ready: false }, null] })]);
  h.frame(1200); h.frame(1300);
  assert.ok(h.Hall.player(42).seated, 'có trong ghế bàn thì ngồi');
  const p = h.Hall.player(42);
  let personHits = 0, tableHits = 0;
  for (let y = Math.round(p.sy - 90 * p.s); y < p.sy; y += 2) for (let x = Math.round(p.sx - 12 * p.s); x <= p.sx + 12 * p.s; x += 2) {
    const c = h.tap(x, y); personHits += c.person.length; if (c.table.length) { tableHits++; assert.equal(c.table[0][0], 1); assert.equal(c.table[0][1], 0); }
  }
  assert.equal(personHits, 0, 'không mở hộp người chơi khi chạm người đang ngồi bàn');
  assert.ok(tableHits > 0, 'chạm người đang ngồi là mở bàn');
  const q = h.Hall.player(43);
  assert.equal(JSON.stringify(h.tap(q.sx, q.sy - 30 * q.s).person), '[43]', 'người đứng thì vẫn mở hộp người chơi');
  // đứng dậy
  h.Hall.setTable(T(1, 'free')); h.frame(1400);
  assert.ok(!h.Hall.player(42).seated);
});

test('"bàn trong": người đang đánh có biểu tượng bàn cờ nhỏ, hết ván thì mất', () => {
  const h = makeHall(960, 600);
  h.Hall.setPlayers([{ id: 42, name: 'A', look: { g: 'nam', c: 1, h: 2 }, x: 0.45, z: 0.65, scene: 'yard' }]);
  h.frame(1000);
  const base = h.rec.rects; h.rec.rects = 0; h.frame(1100); const without = h.rec.rects; h.rec.rects = 0;
  assert.ok(base >= 0);
  h.Hall.setTable({ table: null, gameId: 'g1', inner: true, status: 'playing', game: 'chess', seats: [{ pid: 42, name: 'A' }, { pid: 43, name: 'B' }], watchers: 0 });
  h.frame(1200); h.rec.rects = 0; h.frame(1300);
  assert.equal(h.rec.rects - without, 16, 'thêm 16 ô cờ nhỏ');
  h.Hall.setTable({ table: null, gameId: 'g1', status: 'free', seats: [null, null], watchers: 0 });
  h.frame(1400); h.rec.rects = 0; h.frame(1500);
  assert.equal(h.rec.rects, without, 'hết ván thì bỏ biểu tượng');
});

test('giảm chuyển động: chấm đỏ bàn đang đấu không nhấp nháy', () => {
  const dots = reduce => {
    const h = makeHall(960, 600, { reduce });
    h.Hall.setTables([T(1, 'playing', { game: 'chess' })]);
    const seen = new Set();
    for (const ts of [1000, 1100, 1250, 1400, 1600]) { h.rec.fills.length = 0; h.frame(ts); h.rec.fills.filter(f => /^rgba\(226,70,60/.test(f)).forEach(f => seen.add(f)); }
    return seen;
  };
  assert.equal(dots(true).size, 1, 'đứng yên');
  assert.ok(dots(false).size > 1, 'bình thường thì nhấp nhẹ');
});

test('YARD_TABLES: đủ 4 bàn, ghế hai bên, chừa lối giữa x 0,40–0,60', () => {
  const h = makeHall(960, 600);
  const tabs = h.Hall.YARD_TABLES;
  assert.equal(JSON.stringify(tabs.map(t => t.id)), '[1,2,3,4]');
  for (const t of tabs) {
    assert.equal(t.seats.length, 2);
    for (const [x, z] of [[t.x, t.z], ...t.seats]) { assert.ok(x < 0.4 || x > 0.6, 'lối giữa trống'); assert.ok(z > 0.12 && z < 0.97); }
    assert.ok(t.seats[0][0] < t.x && t.x < t.seats[1][0], 'ghế A bên trái, ghế B bên phải');
  }
});
