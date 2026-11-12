/*
 * Nhân vật trong cảnh chùa: một lớp chung cho người chơi và NPC.
 *
 *   Actor           vị trí (x, z là đích, dx, dz là chỗ đang vẽ), bong bóng lời nói, các lựa chọn khi bị chạm
 *   ├─ Player       người chơi thật: máy chủ lái (đích đến tới từ gói 'p'). Chạm vào: tắt tiếng, thách đấu
 *   └─ Npc          khách trong chùa: tự đi lang thang, chạm vào để trò chuyện
 *      └─ FortuneNpc  NPC cơ duyên: đi lang thang như NPC thường nhưng đường đi tính theo giờ máy chủ,
 *                     nên mọi máy thấy cùng một chỗ và máy chủ kiểm được ai đứng gần.
 *                     Trò chuyện xong còn có quà (bí kíp ẩn, truyền công lực), máy chủ quyết có nhận được không.
 *
 * Cách đi lang thang (wanderAt) dùng chung cho mọi NPC: thời gian chia thành chặng LEG_MS,
 * mỗi chặng đứng ngắm cảnh một lúc rồi đi thẳng, đều tốc, tới điểm kế tiếp (giống người chơi đi tới chỗ chạm).
 * Điểm thứ k lấy từ hàm băm (seed, k), nên vị trí ở thời điểm t tính ngay được, không cần lưu gì.
 *
 * Dùng chung Node + trình duyệt (UMD), không phụ thuộc gì, không đụng DOM.
 * Máy chủ dùng FORTUNE_NPCS, SWEEPER, seedOf, wanderAt, distanceTo để kiểm tra khoảng cách trò chuyện.
 */
(function (root) {
  'use strict';
  const X_WEIGHT = 1.6;            // sàn rộng hơn sâu, khớp X_WEIGHT ở server.js
  const LEG_MS = 18000;            // một chặng: đứng một lúc rồi đi tới điểm kế tiếp
  const MIN_REST_MS = 3000;        // chặng dài nhất vẫn đứng ít nhất chừng này
  const WALK_SPEED = 0.08;         // đơn vị sàn (có trọng số) mỗi giây; người chơi đi 0,24
  const TALK_RANGE = 0.22;         // máy chủ nhận trò chuyện trong khoảng này
  const TALK_SLACK_MS = 2000;      // NPC vẫn đi trong lúc gói tin bay: nhận nếu gần NPC trong 2 giây vừa qua
  const FLOOR = Object.freeze({ x0: 0.15, x1: 0.85, z0: 0.45, z1: 0.8 });   // sàn chánh điện, sân chùa, Sân đấu
  const LIBRARY = Object.freeze({ x0: 0.15, x1: 0.85, z0: 0.5, z1: 0.82 }); // Tàng Kinh Các: tránh dãy kệ phía sau

  // NPC cơ duyên: cảnh, hạt giống đường đi, vùng đi lại. Máy chủ và trình duyệt cùng đọc bảng này.
  const FORTUNE_NPCS = Object.freeze({
    beggar: Object.freeze({ scene: 'hall', seed: 0x5eed0001, area: FLOOR }),
    wanderer: Object.freeze({ scene: 'yard', seed: 0x5eed0002, area: FLOOR }),
    obito: Object.freeze({ scene: 'library', seed: 0x5eed0003, area: LIBRARY })
  });
  // Tảo Địa Tăng: hạt giống lấy từ mã sự kiện (seedOf(event.id)), mỗi lần xuất hiện đi một đường khác.
  const SWEEPER = Object.freeze({ scene: 'library', area: LIBRARY });

  /** Số giả ngẫu nhiên trong [0, 1) từ (seed, k), cùng kết quả ở mọi máy. */
  function hash01(seed, k) {
    let h = (seed ^ Math.imul((k | 0) + 0x9e3779b9 | 0, 0x85ebca6b)) >>> 0;
    h = Math.imul(h ^ (h >>> 16), 0x7feb352d);
    h = Math.imul(h ^ (h >>> 15), 0x846ca68b);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  /** Hạt giống từ chuỗi (FNV-1a). */
  function seedOf(str) {
    let h = 0x811c9dc5;
    const s = String(str);
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
    return h >>> 0;
  }
  function waypoint(seed, k, a) {
    return { x: a.x0 + hash01(seed, 2 * k) * (a.x1 - a.x0), z: a.z0 + hash01(seed, 2 * k + 1) * (a.z1 - a.z0) };
  }
  /** Vị trí NPC ở thời điểm t (ms): { x, z, walking }. */
  function wanderAt(seed, area, t) {
    const a = area || FLOOR, k = Math.floor(t / LEG_MS), into = t - k * LEG_MS;
    const A = waypoint(seed >>> 0, k, a), B = waypoint(seed >>> 0, k + 1, a);
    const dist = Math.hypot((B.x - A.x) * X_WEIGHT, B.z - A.z);
    const walk = Math.min(LEG_MS - MIN_REST_MS, dist / WALK_SPEED * 1000), rest = LEG_MS - walk;
    if (walk <= 0 || into <= rest) return { x: A.x, z: A.z, walking: false };
    const q = (into - rest) / walk;
    return { x: A.x + (B.x - A.x) * q, z: A.z + (B.z - A.z) * q, walking: true };
  }
  /** Khoảng cách (có trọng số) gần nhất từ (x, z) tới NPC trong khoảng [t − slack, t]. */
  function distanceTo(seed, area, x, z, t, slack) {
    const span = slack == null ? TALK_SLACK_MS : slack;
    let best = Infinity;
    for (let dt = 0; dt <= span; dt += 250) {
      const p = wanderAt(seed, area, t - dt);
      best = Math.min(best, Math.hypot((x - p.x) * X_WEIGHT, z - p.z));
    }
    return best;
  }

  class Actor {
    constructor(o) {
      this.id = o.id; this.name = o.name; this.look = o.look;
      this.scene = o.scene || 'hall'; this.place = o.at || 'hall';
      this.sit = o.sit >= 0 ? o.sit : -1; this.cm = o.cm || '';
      this.x = o.x; this.z = o.z; this.dx = o.x; this.dz = o.z;   // x, z: đích đến · dx, dz: chỗ đang vẽ, đuổi dần theo đích
      this.lift = 0; this.hy = 104; this.front = false; this.walking = false;
      this.mod = !!o.mod; this.v = o.v || 0; this.rd = o.rd || ''; this.au = o.au || 0; this.mt = o.mt || 0;
      this.bubble = null; this.bowAt = 0; this.talk = 0; this.burst = null; this.pens = []; this.rburst = 0; this.dmp = null;
    }
    get isNpc() { return false; }
    /** Các lựa chọn khi người khác chạm vào nhân vật này. */
    menu() { return []; }
    say(text, now) { this.bubble = { text: String(text), t: now }; }
    /** Bộ não mỗi khung hình. Mặc định đứng yên, chờ ai đó đặt đích đến. */
    think() {}
  }

  class Player extends Actor {
    menu() { return ['mute', 'challenge']; }
  }

  class Npc extends Actor {
    /** o.seed: hạt giống đường đi, o.area: vùng đi lại, o.t: giờ máy chủ lúc tạo (để đứng đúng chỗ ngay khung đầu). */
    constructor(o, def) {
      super(o);
      this.npc = def || { role: 'visitor', lines: [] };
      this.seed = (o.seed || 0) >>> 0; this.area = o.area || FLOOR;
      this.lag = 0; this.holdUntil = 0;
      const p = wanderAt(this.seed, this.area, o.t || 0);
      this.x = this.dx = p.x; this.z = this.dz = p.z;
    }
    get isNpc() { return true; }
    menu() { return ['talk']; }
    /** Đứng lại một lúc (có người đang tới trò chuyện). */
    hold(ms, now) { this.holdUntil = Math.max(this.holdUntil, now + ms); }
    /** still: đứng yên khung này (giảm chuyển động). Lúc đứng thì đồng hồ riêng lùi lại, đi tiếp đúng chỗ vừa dừng. */
    think(now, dt, srvNow, still) {
      if (still || now < this.holdUntil) this.lag += dt;
      const p = wanderAt(this.seed, this.area, srvNow - this.lag);
      this.x = p.x; this.z = p.z;
    }
    /** Một câu chém gió ngẫu nhiên. */
    line(rnd) {
      const L = this.npc.lines || [];
      return L.length ? L[Math.floor((rnd || Math.random)() * L.length)] : '';
    }
    /** Quà sau khi trò chuyện: NPC thường không có. */
    gift() { return null; }
  }

  class FortuneNpc extends Npc {
    constructor(o, def) { super(o, def); this.eventId = o.eventId || ''; this.until = o.until || Infinity; }
    // Đường đi theo giờ máy chủ nên không đứng lại riêng ở một máy (máy chủ phải biết NPC đang ở đâu).
    hold() {}
    think(now, dt, srvNow) {
      const p = wanderAt(this.seed, this.area, srvNow);
      this.x = p.x; this.z = p.z;
    }
    gift() {
      if (this.npc.role === 'sweeper') return { kind: 'sweeper', event: 'sweeper:claim', data: { id: this.eventId } };
      return { kind: 'secret', event: 'martial:secret-encounter', data: { role: this.npc.role } };
    }
  }

  const api = {
    X_WEIGHT, LEG_MS, WALK_SPEED, TALK_RANGE, TALK_SLACK_MS, FLOOR, LIBRARY, FORTUNE_NPCS, SWEEPER,
    seedOf, wanderAt, distanceTo, Actor, Player, Npc, FortuneNpc
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Actors = api;
})(this);
