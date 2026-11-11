'use strict';
/* Mô phỏng 3 NPC "cơ duyên" đi lại trong chùa (Lão Ăn Mày, Vạn Lý Độc Hành, Obito).
   Logic thuần: không đụng socket, timer, I/O — rng được tiêm vào để test được.
   Máy chủ gọi step(dt) mỗi tick rồi phát positions() qua sự kiện 'npc';
   trình duyệt chỉ nhận vị trí và nội suy khi vẽ. */

// toạ độ gốc từng NPC trong cảnh của họ; trình duyệt giữ danh sách gốc giống hệt trong hall.js — sửa một nơi là sửa cả nơi kia
const SEED = Object.freeze([
  Object.freeze({ role: 'beggar', scene: 'hall', x: 0.68, z: 0.67 }),
  Object.freeze({ role: 'wanderer', scene: 'yard', x: 0.32, z: 0.67 }),
  Object.freeze({ role: 'obito', scene: 'library', x: 0.76, z: 0.68 })
]);
const BOUNDS = Object.freeze({ xMin: 0.12, xMax: 0.88, zMin: 0.35, zMax: 0.82 });
const SPEED = 0.025;            // đơn vị cảnh mỗi giây — trùng tốc độ NPC phía trình duyệt trước đây
const WANDER = Object.freeze({ dx: 0.18, dz: 0.12 });   // bán kính chọn điểm đi tiếp
const REST_MIN = 2.5, REST_RANGE = 4;                  // nghỉ 2,5–6,5 giây tại chỗ rồi mới đi tiếp

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

function createHallNpcs(deps) {
  const rng = deps && typeof deps.rng === 'function' ? deps.rng : Math.random;
  const list = SEED.map(s => ({ role: s.role, scene: s.scene, x: s.x, z: s.z, tx: s.x, tz: s.z, wait: 0, dirty: false }));
  function step(dt) {
    let changed = false;
    for (const n of list) {
      if (n.wait <= 0 && Math.hypot(n.tx - n.x, n.tz - n.z) < 0.008) {      // đã tới nơi: chọn điểm mới rồi nghỉ một lúc
        n.tx = clamp(n.x + (rng() * 2 - 1) * WANDER.dx, BOUNDS.xMin, BOUNDS.xMax);
        n.tz = clamp(n.z + (rng() * 2 - 1) * WANDER.dz, BOUNDS.zMin, BOUNDS.zMax);
        n.wait = REST_MIN + rng() * REST_RANGE;
      }
      if (n.wait > 0) { n.wait -= dt; continue; }                           // đang đứng nghỉ
      const dx = n.tx - n.x, dz = n.tz - n.z, dist = Math.hypot(dx, dz);
      if (dist > 0.001) {
        const s = Math.min(dist, SPEED * dt);
        n.x += dx / dist * s; n.z += dz / dist * s;
        n.dirty = changed = true;
      }
    }
    return changed;
  }
  function positions() {                     // [role, x‰, z‰] của NPC vừa đổi chỗ, gọi lần nữa sẽ rỗng
    const arr = [];
    for (const n of list) if (n.dirty) { arr.push([n.role, Math.round(n.x * 1000), Math.round(n.z * 1000)]); n.dirty = false; }
    return arr;
  }
  function all() {                           // [role, x‰, z‰] của cả 3 NPC, gửi kèm gói join
    return list.map(n => [n.role, Math.round(n.x * 1000), Math.round(n.z * 1000)]);
  }
  function locate(role) {                    // vị trí hiện tại để máy chủ kiểm khoảng cách cơ duyên
    const n = list.find(x => x.role === role);
    return n ? Object.freeze({ role: n.role, scene: n.scene, x: n.x, z: n.z }) : null;
  }
  return { step, positions, all, locate };
}

module.exports = { createHallNpcs, SEED, BOUNDS };
