'use strict';
/*
 * NPC luận võ Hắc Phong Ma Khách: đối thủ máy ở Sân đấu khi vắng người. THUẦN: không socket, không timer.
 * Ba mức (KH người chơi chọn trước trận):
 *   1 Thử chiêu  chọn ngẫu nhiên, bộ chiêu nhập môn, chưa luyện thành thạo
 *   2 Luận võ    tham lam một lượt, bộ chiêu tốt trong phạm vi cấp, thành thạo bằng trung bình của người chơi
 *   3 Toàn lực   cân bằng kéo-búa-bao trên Duel thật, NHÌN TRƯỚC 2 LƯỢT (mỗi ô ma trận lượt này cộng giá trị cân bằng
 *                của lượt sau), bốn chiêu đều Đại viên mãn (👤 chủ dự án chốt 19/11)
 * Cấp nội công của NPC luôn bằng cấp người chơi, không có chiêu bí truyền; buff Quỷ ám cấp 4 (Ma Vương) như hình ở chùa.
 * Trận với NPC không tính vào thắng / thua / điểm chiến tích PK; ghi riêng (botRecord).
 */
const M = require('../../public/js/martial');
const bots = require('./bots');
const { outcomes } = require('./enumerate');
const { Duel } = require('./engine');

const NAME = 'Hắc Phong Ma Khách';
const LOOK = Object.freeze({ g: 'nam', c: 11, h: 2 });
// Ở chùa Hắc Phong mang Ma Vương sau lưng (hall.js: demon, công đức −1000) nên vào trận cũng có Quỷ ám cấp 4,
// tính bằng đúng công thức buff của người chơi (lib/pk/buffs.js, nhân PK_BUFF_SCALE).
const BUFF_INPUT = Object.freeze({ Lc: 0, Lq: 4, Ld: 0 });
const LEVELS = Object.freeze({
  1: Object.freeze({ id: 1, name: 'Thử chiêu', kind: 'random' }),
  2: Object.freeze({ id: 2, name: 'Luận võ', kind: 'greedy' }),
  3: Object.freeze({ id: 3, name: 'Toàn lực', kind: 'eq', depth: 2 })
});
// Bộ chiêu theo thứ tự ưu tiên; lấy bộ đầu tiên mà cấp nội công của NPC học được hết (chỉ xét điều kiện cấp).
const SETS = Object.freeze({
  1: [['trong-quyen', 'tat-phong-quyen', 'thiet-bich', 'nhu-van-bo']],
  2: [
    ['trong-quyen', 'tat-phong-quyen', 'khinh-than-bo', 'tiep-kinh-phan-chuong'],
    ['trong-quyen', 'tat-phong-quyen', 'khinh-than-bo', 'thiet-bich'],
    ['trong-quyen', 'tat-phong-quyen', 'thiet-bich', 'nhu-van-bo']
  ],
  3: [
    ['trong-quyen', 'phan-chan', 'lien-hoan-cuoc', 'tu-lang-bat-thien-can'],
    ['trong-quyen', 'tat-phong-quyen', 'khinh-than-bo', 'tu-lang-bat-thien-can'],
    ['trong-quyen', 'lien-hoan-cuoc', 'tiep-kinh-phan-chuong', 'thiet-bich'],
    ['trong-quyen', 'tat-phong-quyen', 'khinh-than-bo', 'thiet-bich'],
    ['trong-quyen', 'tat-phong-quyen', 'thiet-bich', 'nhu-van-bo']
  ]
});

const levelOf = x => (Object.prototype.hasOwnProperty.call(LEVELS, x) ? LEVELS[x] : null);
const canUse = (id, level) => M.SKILLS[id] && M.SKILLS[id].req.level <= level;

/** Bộ chiêu của NPC ở cấp nội công `level`, mức `diff`. */
function loadoutFor(level, diff) {
  const list = SETS[diff] || SETS[1];
  return (list.find(set => set.every(id => canUse(id, level))) || SETS[1][0]).slice();
}

/** Độ thành thạo của NPC theo người chơi (`mastery` của người chơi trên các chiêu đã học). */
function masteryFor(player, diff, loadout) {
  const vals = Object.values(player.mastery || {}).map(Number).filter(Number.isFinite);
  const xp = diff === 3 ? M.MASTERY_MAX : diff === 1 || !vals.length ? 0 : Math.floor(vals.reduce((s, x) => s + x, 0) / vals.length);
  return M.masteryMap(Object.fromEntries(loadout.map(id => [id, xp])), loadout);
}

/** Hồ sơ đấu của NPC cho trận với người chơi `player` ({ level, mastery }). */
function fighter(player, diff) {
  const L = levelOf(diff) || LEVELS[1];
  const level = Math.max(1, Math.min(M.LEVEL_MAX, Number(player.level) | 0 || 1));
  const loadout = loadoutFor(level, L.id);
  return { level, learned: loadout.slice(), loadout, mastery: masteryFor(player, L.id, loadout), secretSkills: [], diff: L.id };
}

/**
 * Chiêu NPC chọn cho lượt này. duel: Duel thật; side: bên của NPC; rng: () => [0,1).
 * NPC chỉ biết những gì người thật ở vị trí đó biết: trạng thái công khai (máu, nội lực, đang tụ lực…) và bộ 4 chiêu
 * đã công bố. Chiêu bí truyền của người chơi (Như Lai Thần Chưởng, Kamui, Tẩu Vi) không lộ cho đối thủ trước khi dùng,
 * nên NPC suy tính trên bản sao không có chúng (mỗi chiêu bí truyền chỉ dùng một lần, dùng rồi thì cũng hết).
 * NPC không bao giờ đọc chiêu người chơi vừa khóa: manager chỉ gọi hàm này với trạng thái đầu lượt.
 */
/* ---------- nhìn trước 2 lượt (mức Toàn lực) ---------- */
// Giá trị (góc nhìn bên a) của trò chơi ma trận: pA·M·pB với chiến lược cân bằng của hai bên.
function gameValue(Mx, iters) {
  const [pa, pb] = bots.solve(Mx, iters);
  let v = 0;
  for (let i = 0; i < Mx.length; i++) for (let j = 0; j < Mx[0].length; j++) v += pa[i] * pb[j] * Mx[i][j];
  return v;
}
// Giá trị thế trận sau một lượt, có tính cả lượt kế tiếp (một lượt nhìn trước, kể cả lượt tung tụ lực như bot 'eq').
function lookValue(d) {
  if (d.over) return bots.value(d);
  return gameValue(bots.matrix(d, d.legal('a').picks, d.legal('b').picks), 150);
}
// Ma trận 2 lượt: mỗi cặp chiêu lượt này, liệt kê các nhánh né / đỡ, chấm bằng giá trị cân bằng của lượt sau.
function matrix2(d, picksA, picksB) {
  return picksA.map(pa => picksB.map(pb => {
    let v = 0;
    for (const br of outcomes(d, pa, pb)) v += br.w * lookValue(br.d);
    return v;
  }));
}
const sample = (list, p, r) => { let x = r(); for (let i = 0; i < p.length - 1; i++) { x -= p[i]; if (x < 0) return list[i]; } return list[list.length - 1]; };
// Kế hoạch của mức Toàn lực: các chiêu hợp lệ của bên `side` và xác suất chọn từng chiêu (chiến lược cân bằng).
// Tách khỏi việc bốc ngẫu nhiên để phần nặng (~40 ms) chạy được ở worker, còn rng vẫn nằm ở máy chủ chính.
function deepPlan(view, side) {
  const la = view.legal('a'), lb = view.legal('b');
  const eq = bots.solve(matrix2(view, la.picks, lb.picks));
  return side === 'a' ? { picks: la.picks.slice(), probs: eq[0].slice() } : { picks: lb.picks.slice(), probs: eq[1].slice() };
}

/** Bản nhìn của NPC: bản sao Duel không có chiêu bí truyền của đối thủ (xem chú thích ở trên). */
function viewFor(duel, side) {
  const view = duel.clone();
  view.secrets = { ...view.secrets, [side === 'a' ? 'b' : 'a']: new Set() };
  return view;
}

/**
 * Kế hoạch mức Toàn lực cho `duel` đầu lượt: { forced } nếu đang tụ lực, ngược lại { picks, probs }.
 * THUẦN và không dùng rng, nên chạy ở worker (npc-pool.js) cho cùng kết quả như chạy ngay trên luồng chính.
 */
function plan(duel, side) {
  const legal = duel.legal(side);
  if (legal.forced) return { forced: legal.forced };
  return deepPlan(viewFor(duel, side), side);
}

/** Bốc chiêu từ kế hoạch bằng rng của máy chủ; tiêu thụ đúng một số rng() như `decide` (không có số nào khi bị ép). */
function pickFromPlan(p, rng, legalPicks) {
  if (p.forced) return p.forced;
  const pick = sample(p.picks, p.probs, rng);
  return !legalPicks || legalPicks.includes(pick) ? pick : legalPicks[0];
}

/** Ảnh chụp Duel đầu lượt (chỉ dữ liệu thuần, gửi qua worker được). Đủ để engine suy tính; không cần rng hay lịch sử. */
function snapshot(d) {
  const arr = o => ({ a: [...o.a], b: [...o.b] });
  return {
    seed: d.seed, mode: d.mode, f: { a: { ...d.f.a }, b: { ...d.f.b } },
    loadout: { a: d.loadout.a.slice(), b: d.loadout.b.slice() },
    secrets: arr(d.secrets), usedSecrets: arr(d.usedSecrets),
    turn: d.turn, noDamageStreak: d.noDamageStreak, sudden: d.sudden, over: d.over ? { ...d.over } : null
  };
}

/** Dựng lại Duel từ ảnh chụp. Dùng cho suy tính (clone / legal / step với roll ghi đè), không dùng để chơi tiếp bằng rng. */
function restore(snap) {
  const d = new Duel({ seed: snap.seed, rng: () => 0.5, mode: snap.mode, a: { level: 1, loadout: [] }, b: { level: 1, loadout: [] } });
  d.f = { a: { ...snap.f.a }, b: { ...snap.f.b } };
  d.loadout = { a: snap.loadout.a.slice(), b: snap.loadout.b.slice() };
  d.secrets = { a: new Set(snap.secrets.a), b: new Set(snap.secrets.b) };
  d.usedSecrets = { a: new Set(snap.usedSecrets.a), b: new Set(snap.usedSecrets.b) };
  d.turn = snap.turn; d.noDamageStreak = snap.noDamageStreak; d.sudden = snap.sudden;
  d.over = snap.over ? { ...snap.over } : null;
  return d;
}

function decide(duel, side, diff, rng) {
  const L = levelOf(diff) || LEVELS[1];
  const legal = duel.legal(side);
  if (legal.forced) return legal.forced;
  const view = viewFor(duel, side);
  let pick;
  if (L.id === 3) { const p = deepPlan(view, side); pick = sample(p.picks, p.probs, rng); }
  else {
    const kinds = side === 'a' ? [L.kind, 'random'] : ['random', L.kind];
    pick = bots.decide(view, kinds, rng, null, '', null, M.REST_ID)[side === 'a' ? 0 : 1];
  }
  return legal.picks.includes(pick) ? pick : legal.picks[0];
}

module.exports = { NAME, LOOK, BUFF_INPUT, LEVELS, levelOf, loadoutFor, masteryFor, fighter, decide, plan, pickFromPlan, snapshot, restore };
