'use strict';
// Lớp nhân vật chung (public/js/actors.js): Player, Npc, FortuneNpc và cách đi lang thang dùng chung.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const A = require('../public/js/actors');

const T0 = 1_800_000_000_000;
const wd = (p, q) => Math.hypot((p.x - q.x) * A.X_WEIGHT, p.z - q.z);

test('cây lớp: Player và Npc cùng kế thừa Actor, FortuneNpc kế thừa Npc', () => {
  const pl = new A.Player({ id: 1, name: 'A', look: {}, x: 0.5, z: 0.6 });
  const npc = new A.Npc({ id: -1, name: 'B', seed: 7, t: T0 }, { role: 'visitor', lines: ['x'] });
  const fn = new A.FortuneNpc({ id: -2, name: 'C', seed: 9, t: T0 }, { role: 'beggar', lines: ['y'] });
  assert.ok(pl instanceof A.Actor && npc instanceof A.Actor && fn instanceof A.Npc);
  assert.ok(!(pl instanceof A.Npc));
  assert.equal(pl.isNpc, false); assert.equal(npc.isNpc, true); assert.equal(fn.isNpc, true);
  assert.deepEqual(pl.menu(), ['mute', 'challenge']);
  assert.deepEqual(npc.menu(), ['talk']);
  assert.deepEqual(fn.menu(), ['talk'], 'NPC cơ duyên trông như NPC thường, cùng một lựa chọn');
  assert.equal(npc.gift(), null);
  assert.deepEqual(fn.gift(), { kind: 'secret', event: 'martial:secret-encounter', data: { role: 'beggar' } });
  const sw = new A.FortuneNpc({ id: -999, name: 'D', seed: 3, t: T0, eventId: 'abc' }, { role: 'sweeper', lines: [] });
  assert.deepEqual(sw.gift(), { kind: 'sweeper', event: 'sweeper:claim', data: { id: 'abc' } });
  for (const p of [pl, npc, fn]) for (const k of ['x', 'z', 'dx', 'dz', 'bubble', 'pens', 'look', 'scene', 'place']) assert.ok(k in p, k);
  npc.say('chào', 5); assert.deepEqual(npc.bubble, { text: 'chào', t: 5 });
  assert.equal(npc.line(() => 0), 'x');
});

test('wanderAt: tất định, liền mạch, trong vùng, có lúc đứng lúc đi, không nhanh hơn trần tốc độ', () => {
  for (const seed of [1, 0x5eed0002, A.seedOf('1234567890abcdef12345678')]) {
    let prev = A.wanderAt(seed, A.FLOOR, T0), walking = 0, resting = 0;
    const maxSpeed = Math.hypot((A.FLOOR.x1 - A.FLOOR.x0) * A.X_WEIGHT, A.FLOOR.z1 - A.FLOOR.z0) / ((A.LEG_MS - 3000) / 1000);
    for (let t = T0 + 100; t < T0 + A.LEG_MS * 12; t += 100) {
      const p = A.wanderAt(seed, A.FLOOR, t);
      assert.deepEqual(p, A.wanderAt(seed, A.FLOOR, t), 'cùng thời điểm, cùng vị trí');
      assert.ok(p.x >= A.FLOOR.x0 - 1e-9 && p.x <= A.FLOOR.x1 + 1e-9 && p.z >= A.FLOOR.z0 - 1e-9 && p.z <= A.FLOOR.z1 + 1e-9);
      assert.ok(wd(p, prev) <= Math.max(A.WALK_SPEED, maxSpeed) * 0.1 + 1e-9, 'không nhảy cóc');
      if (p.walking) walking++; else resting++;
      prev = p;
    }
    assert.ok(walking > 0 && resting > 0, 'có đi, có đứng');
  }
  const a = A.wanderAt(1, A.FLOOR, T0), b = A.wanderAt(2, A.FLOOR, T0);
  assert.notDeepEqual(a, b, 'hạt giống khác nhau đi đường khác nhau');
});

test('Npc thường: đứng lại khi có người tới trò chuyện rồi đi tiếp từ đúng chỗ dừng; NPC cơ duyên không đứng riêng', () => {
  const npc = new A.Npc({ id: -1, name: 'B', seed: 11, t: T0 }, { role: 'visitor', lines: [] });
  let t = T0;
  // chạy tới lúc đang đi
  while (!A.wanderAt(11, A.FLOOR, t).walking) t += 100;
  npc.think(t, 16, t);
  const at = { x: npc.x, z: npc.z };
  npc.hold(3000, t);
  for (let k = 0; k < 149; k++) { t += 20; npc.think(t, 20, t); }   // còn trong 3 giây giữ
  assert.ok(wd(npc, at) < 1e-9, 'đứng yên trong lúc giữ');
  t += 40; npc.think(t, 20, t);
  assert.ok(wd(npc, at) < 0.01, 'đi tiếp, không nhảy');
  // giảm chuyển động: NPC thường đứng yên
  const still = new A.Npc({ id: -3, name: 'S', seed: 5, t: T0 }, {});
  const s0 = { x: still.x, z: still.z };
  for (let k = 1; k < 50; k++) still.think(T0 + k * 1000, 1000, T0 + k * 1000, true);
  assert.ok(wd(still, s0) < 1e-9);
  // NPC cơ duyên luôn ở đúng chỗ máy chủ tính
  const fn = new A.FortuneNpc({ id: -2, name: 'C', seed: 9, area: A.LIBRARY, t: T0 }, { role: 'obito' });
  fn.hold(60000, T0);
  for (const dt of [0, 5000, 17000, 40000]) {
    fn.think(T0 + dt, 16, T0 + dt);
    assert.ok(wd(fn, A.wanderAt(9, A.LIBRARY, T0 + dt)) < 1e-12);
  }
});

test('distanceTo chừa độ trễ: vừa đứng gần NPC trong 2 giây trước vẫn tính là gần', () => {
  let t = T0;
  while (!A.wanderAt(21, A.FLOOR, t).walking) t += 100;
  t += 1500;
  const before = A.wanderAt(21, A.FLOOR, t - 1500), now = A.wanderAt(21, A.FLOOR, t);
  assert.ok(A.distanceTo(21, A.FLOOR, before.x, before.z, t) < 1e-9);
  assert.ok(A.distanceTo(21, A.FLOOR, before.x, before.z, t, 0) >= wd(before, now) - 1e-9);
});

test('đồng bộ với máy chủ: X_WEIGHT khớp, máy chủ dùng bảng FORTUNE_NPCS chứ không tự giữ toạ độ', () => {
  const server = fs.readFileSync(require.resolve('../server.js'), 'utf8');
  assert.equal(Number(server.match(/const X_WEIGHT = ([\d.]+)/)[1]), A.X_WEIGHT);
  assert.match(server, /require\('\.\/public\/js\/actors'\)/);
  assert.match(server, /ACTORS\.FORTUNE_NPCS/);
  assert.match(server, /ACTORS\.SWEEPER/);
  const scenes = server.match(/const SCENES = \{([^}]*)\}/)[1];
  for (const [role, f] of Object.entries(A.FORTUNE_NPCS)) assert.ok(scenes.includes(f.scene + ':'), role);
  const html = fs.readFileSync(require.resolve('../public/index.html'), 'utf8');
  assert.ok(html.indexOf('/js/actors.js') > 0 && html.indexOf('/js/actors.js') < html.indexOf('/js/hall.js'), 'actors.js nạp trước hall.js');
});

test('npcSlotPlan: cùng đợt giờ máy chủ thì hai máy tính ra cùng cảnh, cùng hạt giống, cùng vị trí', () => {
  const SLOT = A.NPC_SLOT_MS, base = Math.floor(T0 / SLOT) * SLOT;
  // hai máy mở trang lúc khác nhau nhưng cùng một đợt
  const a = A.npcSlotPlan(A.npcSlotOf(base + 1000), 14, 8);
  const b = A.npcSlotPlan(A.npcSlotOf(base + SLOT - 1), 14, 8);
  assert.deepEqual(a, b);
  assert.equal(a.length, 8);
  assert.equal(new Set(a.map(x => x.pool)).size, 8, 'không trùng mẫu NPC');
  const area = A.FLOOR;
  for (const t of [base + 5000, base + 60000, base + SLOT - 1]) {
    for (let i = 0; i < 8; i++) assert.deepEqual(A.wanderAt(a[i].seed, area, t), A.wanderAt(b[i].seed, area, t));
  }
  // người tạo lúc khác nhau vẫn đứng cùng chỗ khi cùng giờ máy chủ
  const n1 = new A.Npc({ id: -1, seed: a[0].seed, t: base + 1000 }, { role: 'visitor', lines: [] });
  const n2 = new A.Npc({ id: -1, seed: b[0].seed, t: base + 90000 }, { role: 'visitor', lines: [] });
  n1.think(0, 16, base + 100000, false); n2.think(0, 16, base + 100000, false);
  assert.deepEqual([n1.x, n1.z], [n2.x, n2.z]);
});

test('npcSlotPlan: đợt khác thì xáo khác, mỗi cảnh vẫn đủ 2 NPC và vai Hắc Phong / Ngọa Long xuất hiện qua các đợt', () => {
  const s0 = A.npcSlotOf(T0);
  const seen = new Set();
  let different = 0;
  for (let k = 0; k < 40; k++) {
    const p = A.npcSlotPlan(s0 + k, 14, 8), q = A.npcSlotPlan(s0 + k + 1, 14, 8);
    assert.equal(p.length, 8, 'bốn cảnh × 2 NPC');
    if (JSON.stringify(p) !== JSON.stringify(q)) different++;
    p.forEach(x => seen.add(x.pool));
  }
  assert.ok(different >= 38, 'hầu hết các đợt xáo khác nhau');
  assert.equal(seen.size, 14, 'mọi mẫu (gồm Hắc Phong, Ngọa Long) đều có lúc xuất hiện');
});

test('npcRosterAt: dùng được từ Node, mỗi cảnh 2 NPC, hai thời điểm cùng đợt ra cùng danh sách và vị trí', () => {
  const roles = ['visitor', 'sword', 'lady', 'kysu', 'sword', 'lady', 'visitor', 'visitor', 'visitor', 'sword', 'visitor', 'lady', 'visitor', 'lady'];
  const base = Math.floor(T0 / A.NPC_SLOT_MS) * A.NPC_SLOT_MS;
  const r = A.npcRosterAt(base + 3000, roles);
  assert.equal(r.length, 8);
  for (const sc of A.NPC_SCENES) assert.equal(r.filter(x => x.scene === sc).length, 2, sc);
  assert.deepEqual(A.npcRosterAt(base + 3000, roles).map(x => [x.index, x.scene, x.seed]), A.npcRosterAt(base + 100000, roles).map(x => [x.index, x.scene, x.seed]));
  assert.deepEqual(r.map(x => [x.x, x.z]), A.npcRosterAt(base + 3000, roles).map(x => [x.x, x.z]));
  assert.ok(r.every(x => x.role === roles[x.index]));
});
