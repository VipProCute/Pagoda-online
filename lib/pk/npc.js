'use strict';
/*
 * NPC luận võ Hắc Phong Ma Khách: đối thủ máy ở Sân đấu khi vắng người. THUẦN: không socket, không timer.
 * Ba mức (KH người chơi chọn trước trận):
 *   1 Thử chiêu  chọn ngẫu nhiên, bộ chiêu nhập môn, chưa luyện thành thạo
 *   2 Luận võ    tham lam một lượt, bộ chiêu tốt trong phạm vi cấp, thành thạo bằng trung bình của người chơi
 *   3 Toàn lực   cân bằng kéo-búa-bao trên Duel thật (bot 'eq' của công cụ mô phỏng), thành thạo bằng mức cao nhất của người chơi
 * Cấp nội công của NPC luôn bằng cấp người chơi, không có chiêu bí truyền, không có buff.
 * Trận với NPC không tính vào thắng / thua / điểm chiến tích PK; ghi riêng (botRecord).
 */
const M = require('../../public/js/martial');
const bots = require('./bots');

const NAME = 'Hắc Phong Ma Khách';
const LOOK = Object.freeze({ g: 'nam', c: 11, h: 2 });
const LEVELS = Object.freeze({
  1: Object.freeze({ id: 1, name: 'Thử chiêu', kind: 'random' }),
  2: Object.freeze({ id: 2, name: 'Luận võ', kind: 'greedy' }),
  3: Object.freeze({ id: 3, name: 'Toàn lực', kind: 'eq' })
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
  const xp = diff === 1 || !vals.length ? 0 : diff === 2 ? Math.floor(vals.reduce((s, x) => s + x, 0) / vals.length) : Math.max(...vals);
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
function decide(duel, side, diff, rng) {
  const L = levelOf(diff) || LEVELS[1];
  const legal = duel.legal(side);
  if (legal.forced) return legal.forced;
  const view = duel.clone();
  view.secrets = { ...view.secrets, [side === 'a' ? 'b' : 'a']: new Set() };
  const kinds = side === 'a' ? [L.kind, 'random'] : ['random', L.kind];
  const picks = bots.decide(view, kinds, rng, null, '', null, M.REST_ID);
  const pick = picks[side === 'a' ? 0 : 1];
  return legal.picks.includes(pick) ? pick : legal.picks[0];
}

module.exports = { NAME, LOOK, LEVELS, levelOf, loadoutFor, masteryFor, fighter, decide };
