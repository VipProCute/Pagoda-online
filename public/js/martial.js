/*
 * Võ học Chùa Tâm An: 3 nhánh, 15 chiêu, 6 công pháp tu nội công, cấp nội công.
 * Dùng chung cho máy chủ (luật chơi, kiểm tra điều kiện) và trình duyệt (hiển thị).
 * Mọi con số của chiêu nằm ở đây; engine (lib/pk/engine.js) đọc đúng các con số này.
 *
 * Người chơi KHÔNG chọn phái cố định: học được cả 15 chiêu nếu đủ điều kiện.
 * Nhánh (Cương / Tốc / Nhu) chỉ là nhóm chiêu và lối chơi, không cộng sát thương theo "hệ".
 */
(function (root) {
  'use strict';

  const BRANCHES = {
    cuong: { id: 'cuong', name: 'Cương', han: '剛', color: '#ec7b6c', desc: 'Đòn mạnh, chậm, chịu đòn tốt.' },
    toc: { id: 'toc', name: 'Tốc', han: '速', color: '#e8c477', desc: 'Đòn nhanh, sát thương cao, phòng thủ mỏng.' },
    nhu: { id: 'nhu', name: 'Nhu', han: '柔', color: '#86b38a', desc: 'Né, đỡ, hóa giải và phản công.' }
  };
  const BRANCH_ORDER = ['cuong', 'toc', 'nhu'];

  /* Điều kiện học theo bậc: cấp nội công + tâm đắc của nhánh đó. Bậc 1 (nhập môn) có ngay. */
  const TIER_REQ = { 1: { level: 1, tam: 0 }, 2: { level: 3, tam: 40 }, 3: { level: 5, tam: 120 }, 4: { level: 7, tam: 250 } };
  const TIER_NAMES = { 1: 'Nhập môn', 2: 'Sơ cấp', 3: 'Trung cấp', 4: 'Cao cấp' };

  /*
   * kind: atk (công) · guard (thủ) · dodge (né) · parry (đỡ, phản) · hybrid (đỡ khi đối thủ đánh, không thì đánh) · charge (tụ lực)
   *   hits   [{ base, spd }]                       atk, hybrid: từng nhịp đánh
   *   guard  { red, kc?, rageOnHit? }              giảm `red` sát thương; kc: Kim Chung (trúng thật thì đòn công kế tiếp mạnh hơn)
   *   dodge  { spd, rageOnDodge? }                 né từng nhịp theo hàm xác suất
   *   parry  { spd, flat, pct?, cap?, failRed? }   đỡ từng nhịp; thành công phản flat + min(cap, pct × đòn gốc bị chặn)
   *   charge { red, release: { base, spd, dodgeMul? } }  lượt 1 tụ lực (giảm red), lượt 2 tự tung release
   *   pierce                                       Xuyên kình: bỏ qua một phần giảm sát thương của chiêu thủ
   */
  const SKILL_LIST = [
    {
      id: 'kim-chung-trao', name: 'Kim Chung Tráo', branch: 'cuong', tier: 2, kind: 'guard', mana: 10,
      guard: { red: 0.45, kc: true },
      short: 'Gồng thân như chuông vàng',
      desc: 'Giảm 45% sát thương nhận trong lượt. Nếu thực sự bị trúng đòn, hai lượt sau đòn công chủ động đầu tiên mạnh thêm 25%. Dùng liên tiếp chỉ làm mới, không cộng dồn.'
    },
    {
      id: 'trong-quyen', name: 'Trọng Quyền', branch: 'cuong', tier: 1, kind: 'atk', mana: 14,
      hits: [{ base: 38, spd: 30 }],
      short: 'Đấm mạnh nhưng chậm',
      desc: 'Một đòn nặng, tốc độ thấp nên dễ bị né hoặc đỡ hơn các đòn nhanh.'
    },
    {
      id: 'tu-luc-pha-son', name: 'Tụ Lực Phá Sơn', branch: 'cuong', tier: 4, kind: 'charge', mana: 30,
      charge: { red: 0, release: { base: 70, spd: 20, unavoidable: true, trueDamage: true, masteryBase: [70, 90, 115, 145, 180] } },
      short: 'Chuẩn bị một lượt; xuyên thủ, chỉ sợ Tứ Lạng',
      desc: 'Lượt đầu đứng tụ lực, không tấn công và giảm 0% sát thương; đối thủ thấy bạn đang chuẩn bị. Lượt sau bắt buộc tung đòn tốc 20, chắc chắn trúng và gây sát thương chuẩn, xuyên mọi lớp giảm sát thương. Sát thương gốc theo độ thành thạo: 70 / 90 / 115 / 145 / 180. Chỉ Tứ Lạng Bạt Thiên Cân phản nguyên sát thương về bạn. Bị đánh không ngắt tụ lực; bị hạ trước lúc tung thì thua.'
    },
    {
      id: 'thiet-bich', name: 'Thiết Bích', branch: 'cuong', tier: 1, kind: 'guard', mana: 12,
      guard: { red: 0.65 },
      short: 'Thủ thuần túy',
      desc: 'Giảm 65% sát thương nhận trong lượt. Không có hiệu ứng thêm.'
    },
    {
      id: 'phan-chan', name: 'Phản Chấn', branch: 'cuong', tier: 3, kind: 'parry', mana: 10,
      parry: { spd: 50, flat: 20, failRed: 0.25 },
      short: 'Đỡ đòn rồi chấn ngược lại',
      desc: 'Đỡ thành công thì chặn đòn và phản 20 sát thương. Đỡ hụt vẫn giảm 25% sát thương nhận.'
    },
    {
      id: 'khinh-than-bo', name: 'Khinh Thân Bộ', branch: 'toc', tier: 2, kind: 'dodge', mana: 10,
      dodge: { spd: 95 },
      short: 'Bước nhẹ như không',
      desc: 'Tốc độ né rất cao. Né thành công thì tránh được sát thương của nhịp đòn đó.'
    },
    {
      id: 'anh-bo-ho-than', name: 'Ảnh Bộ Hộ Thân', branch: 'toc', tier: 1, kind: 'guard', mana: 6,
      guard: { red: 0.4 },
      short: 'Lùi bóng hộ thân',
      desc: 'Giảm 40% sát thương nhận trong lượt. Rẻ nội lực nhất.'
    },
    {
      id: 'tat-phong-quyen', name: 'Tật Phong Quyền', branch: 'toc', tier: 1, kind: 'atk', mana: 12,
      hits: [{ base: 25, spd: 95 }],
      short: 'Đấm nhanh như gió',
      desc: 'Một đòn rất nhanh, khó né và khó đỡ.'
    },
    {
      id: 'lien-hoan-cuoc', name: 'Liên Hoàn Cước', branch: 'toc', tier: 3, kind: 'atk', mana: 22,
      hits: [{ base: 16, spd: 85 }, { base: 16, spd: 85 }],
      short: 'Hai cước liền nhau',
      desc: 'Hai nhịp, mỗi nhịp 16 sát thương. Đối thủ né hoặc đỡ được từng nhịp riêng.'
    },
    {
      id: 'doat-anh-phan-kich', name: 'Đoạt Ảnh Phản Kích', branch: 'toc', tier: 4, kind: 'hybrid', mana: 22,
      parry: { spd: 80, flat: 24 }, hits: [{ base: 20, spd: 90 }],
      short: 'Thấy đòn thì đỡ, không thấy thì đánh',
      desc: 'Nếu đối thủ ra đòn tấn công: đỡ (tốc 80), thành công phản 24. Nếu không: tự đánh 20 (tốc 90). Hai bên cùng Đoạt Ảnh thì cả hai đều đánh.'
    },
    {
      id: 'nhu-van-bo', name: 'Nhu Vân Bộ', branch: 'nhu', tier: 1, kind: 'dodge', mana: 7,
      dodge: { spd: 80, rageOnDodge: 10 },
      short: 'Bước như mây trôi',
      desc: 'Né thành công thì nhận 10 nộ (một lần mỗi lượt).'
    },
    {
      id: 'tiep-kinh-phan-chuong', name: 'Tiếp Kình Phản Chưởng', branch: 'nhu', tier: 3, kind: 'parry', mana: 14,
      parry: { spd: 75, flat: 18, pct: 0.2, cap: 14 },
      short: 'Đón kình lực, trả lại',
      desc: 'Đỡ thành công thì chặn đòn và phản 18 sát thương cộng 20% sát thương gốc của đòn bị chặn (cộng tối đa 14). Đỡ hụt thì nhận đủ.'
    },
    {
      id: 'ta-luc-hoa-giai', name: 'Tá Lực Hóa Giải', branch: 'nhu', tier: 2, kind: 'guard', mana: 9,
      guard: { red: 0.55, rageOnHit: 10 },
      short: 'Mượn lực hóa giải',
      desc: 'Giảm 55% sát thương nhận trong lượt. Nếu thực sự bị trúng thì nhận thêm 10 nộ.'
    },
    {
      id: 'lieu-diep-chuong', name: 'Liễu Diệp Chưởng', branch: 'nhu', tier: 1, kind: 'atk', mana: 9,
      hits: [{ base: 22, spd: 80 }], pierce: 0.5,
      short: 'Chưởng mềm như lá liễu',
      desc: 'Một chưởng 22 sát thương (tốc 80). Xuyên kình: bỏ qua một nửa mức giảm sát thương của chiêu thủ.'
    },
    {
      id: 'tu-lang-bat-thien-can', name: 'Tứ Lạng Bạt Thiên Cân', branch: 'nhu', tier: 4, kind: 'parry', mana: 20,
      parry: { spd: 70, flat: 25, pct: 0.3, cap: 21, reflectCharge: 'tu-luc-pha-son', maxAttackSpeed: 79 },
      short: 'Phản Phá Sơn; không đỡ được đòn nhanh',
      desc: 'Chọn đúng lượt Phá Sơn tung ra: chắc chắn hóa giải và trả nguyên sát thương chuẩn về người tung, không nhân thêm sức mạnh của bạn. Với đòn chậm, đỡ theo tốc 70; thành công phản 25 cộng 30% sát thương gốc (cộng tối đa 21). Chỉ đỡ đòn tốc tối đa 79: các đòn nhanh xuyên qua và không bị phản. Không gặp đòn công thì mất lượt và nội lực.'
    }
  ];
  const SKILLS = {};
  SKILL_LIST.forEach(s => { s.req = TIER_REQ[s.tier]; SKILLS[s.id] = Object.freeze(s); });
  // thứ tự hiển thị: theo nhánh rồi theo bậc
  const SKILL_ORDER = BRANCH_ORDER.flatMap(b => SKILL_LIST.filter(s => s.branch === b).sort((x, y) => x.tier - y.tier).map(s => s.id));
  const STARTERS = SKILL_ORDER.filter(id => SKILLS[id].tier === 1);

  /* Hành động ngoài bộ 4 chiêu */
  const REST_ID = 'dieu-tuc', IDLE_ID = 'dung-yen';
  const SPECIAL = {
    [REST_ID]: { id: REST_ID, name: 'Điều tức', kind: 'rest', mana: 0, short: 'Thở sâu, hồi thêm nội lực', desc: 'Không tốn nội lực, hồi thêm 20 nội lực. Không phòng thủ.' },
    [IDLE_ID]: { id: IDLE_ID, name: 'Đứng yên', kind: 'idle', mana: 0, short: 'Hết giờ chưa chọn', desc: 'Tự chọn khi hết giờ. Không phòng thủ, chỉ hồi nội lực thường.' }
  };

  /* Cấp nội công theo công lực (mốc từng cấp, cấp 1 từ 0) */
  const LEVEL_AT = [0, 60, 150, 300, 500, 800, 1200, 1700, 2300, 3000];
  const REALM_NAMES = Object.freeze(['Sơ Nhập Võ Đạo', 'Khí Tụ Đan Điền', 'Khai Thông Kinh Mạch', 'Nội Lực Tiểu Thành', 'Nội Lực Đại Thành', 'Chân Khí Hộ Thể', 'Phản Phác Quy Chân', 'Thiên Nhân Hợp Nhất', 'Đại Thừa', 'Trấn Thước Cổ Kim']);
  const PK_TITLES = Object.freeze([
    { points: 0, name: 'Tay Mơ Tập Võ' }, { points: 9, name: 'Gà Mờ Giang Hồ' },
    { points: 30, name: 'Có Số Có Má' }, { points: 75, name: 'Cao Thủ' },
    { points: 150, name: 'Đại Cao Thủ' }, { points: 300, name: 'Võ Lâm Kỳ Hiệp' },
    { points: 600, name: 'Nhất Đại Tông Sư' }, { points: 1200, name: 'Vô Địch Thiên Hạ' },
    { points: 2400, name: 'Độc Cô Cầu Bại' }
  ].map(Object.freeze));
  function realmName(level) { return REALM_NAMES[Math.max(1, Math.min(REALM_NAMES.length, Math.floor(Number(level) || 1))) - 1]; }
  function pkTitle(wins, draws) {
    const count = n => Number.isFinite(Number(n)) ? Math.max(0, Math.floor(Number(n))) : 0;
    const points = count(wins) * 3 + count(draws);
    let index = 0;
    for (let i = 1; i < PK_TITLES.length; i++) if (points >= PK_TITLES[i].points) index = i;
    return { points, name: PK_TITLES[index].name, rank: index + 1, next: PK_TITLES[index + 1] || null };
  }
  const LEVEL_MAX = LEVEL_AT.length, CONG_LUC_MAX = LEVEL_AT[LEVEL_AT.length - 1], TAM_MAX = 300;
  const MANA_BASE = 80, MANA_PER_LEVEL = 4;

  function levelOf(congLuc) { let lv = 1; for (let i = 0; i < LEVEL_AT.length; i++) if (congLuc >= LEVEL_AT[i]) lv = i + 1; return lv; }
  function manaMaxOf(level) { const lv = Math.max(1, Math.min(LEVEL_MAX, level | 0)); return MANA_BASE + MANA_PER_LEVEL * (lv - 1); }
  // Cảnh giới tăng cả lực đánh và sức chịu đòn, ngoài nội lực tối đa.
  function combatPower(level) {
    const lv = Math.max(1, Math.min(LEVEL_MAX, level | 0));
    return { attack: 1 + 0.04 * (lv - 1), reduction: 0.015 * (lv - 1) };
  }

  // Độ thành thạo được luyện có chủ đích trong một phiên tu, không cộng bằng cách spam PK.
  const MASTERY_AT = Object.freeze([0, 20, 60, 120, 240]);
  const MASTERY_NAMES = Object.freeze(['Tiếp xúc da lông', 'Sơ nhập môn đình', 'Đăng đường nhập thất', 'Lô hỏa thuần thanh', 'Đại viên mãn']);
  const MASTERY_MAX = MASTERY_AT[MASTERY_AT.length - 1];
  function masteryXP(value) { return Math.max(0, Math.min(MASTERY_MAX, Number.isFinite(value) ? Math.floor(value) : 0)); }
  function masteryInfo(value) {
    const xp = masteryXP(value);
    let index = 0;
    for (let i = 0; i < MASTERY_AT.length; i++) if (xp >= MASTERY_AT[i]) index = i;
    const from = MASTERY_AT[index], to = MASTERY_AT[index + 1] == null ? null : MASTERY_AT[index + 1];
    return { xp, rank: index + 1, name: MASTERY_NAMES[index], from, to, pct: to == null ? 1 : (xp - from) / (to - from) };
  }
  function masteryMap(raw, ids = SKILL_ORDER) {
    const out = {};
    for (const id of ids) if (Object.prototype.hasOwnProperty.call(SKILLS, id)) out[id] = masteryXP(raw && Object.prototype.hasOwnProperty.call(raw, id) ? raw[id] : 0);
    return out;
  }
  function practiceXP(methodId, durationKey) {
    const m = Object.prototype.hasOwnProperty.call(METHODS, methodId) ? METHODS[methodId] : null, d = m && m.durations.find(x => x.key === durationKey);
    return d ? Math.floor(d.minutes * 2 / 15) : 0;
  }
  /** Bản số liệu riêng của người ra chiêu; không sửa SKILLS dùng chung. */
  function combatSkill(id, xp = 0) {
    const s = Object.prototype.hasOwnProperty.call(SKILLS, id) ? SKILLS[id] : null;
    if (!s) return null;
    const index = masteryInfo(xp).rank - 1;
    if (index === 0) return s;
    const factor = 1 + 0.05 * index, out = { ...s };
    if (s.hits) out.hits = s.hits.map(h => ({ ...h, base: h.base * factor }));
    if (s.guard) out.guard = { ...s.guard, red: Math.min(0.8, s.guard.red + 0.02 * index) };
    if (s.dodge) out.dodge = { ...s.dodge, spd: Math.min(100, s.dodge.spd + 2 * index) };
    if (s.parry) out.parry = { ...s.parry, spd: Math.min(100, s.parry.spd + 1.5 * index), flat: s.parry.flat * factor };
    if (s.charge) out.charge = { ...s.charge, release: { ...s.charge.release, base: s.charge.release.masteryBase ? s.charge.release.masteryBase[index] : s.charge.release.base * factor } };
    return out;
  }
  /** Cấp hiện tại, mốc đầu/cuối của cấp, phần trăm đã đi trong cấp. */
  function levelInfo(congLuc) {
    const cl = Math.max(0, Math.min(CONG_LUC_MAX, congLuc | 0)), level = levelOf(cl);
    const from = LEVEL_AT[level - 1], to = level < LEVEL_MAX ? LEVEL_AT[level] : null;
    return { level, from, to, pct: to == null ? 1 : (cl - from) / (to - from), manaMax: manaMaxOf(level) };
  }

  /*
   * Công pháp tu nội công. durations: mỗi lựa chọn thời gian có `minutes` và `congLuc` nhận được.
   * tam: tâm đắc cộng cho từng nhánh = floor(congLuc × tỉ lệ).
   * price: số tiền cúng dường để hoàn thành ngay (đồng). Phiên dài hiệu quả mỗi giờ thấp hơn, để người bận vẫn tiến bộ.
   */
  const METHOD_LIST = [
    {
      id: 'tinh-tam-quyet', name: 'Tĩnh Tâm Quyết', han: '靜心訣', branch: null, reqLevel: 1, price: 10000,
      tam: null,
      durations: [{ key: '15m', minutes: 15, congLuc: 5 }, { key: '1h', minutes: 60, congLuc: 15 }, { key: '4h', minutes: 240, congLuc: 45 }],
      short: 'Công pháp nhập môn, ngồi thiền tĩnh tâm',
      desc: 'Ai cũng tu được. Chỉ tăng công lực, không tăng tâm đắc nhánh nào.'
    },
    {
      id: 'kim-cuong-tam-phap', name: 'Kim Cương Tâm Pháp', han: '金剛心法', branch: 'cuong', reqLevel: 2, price: 20000,
      tam: { cuong: 1 },
      durations: [{ key: '1h', minutes: 60, congLuc: 15 }, { key: '4h', minutes: 240, congLuc: 50 }, { key: '8h', minutes: 480, congLuc: 85 }],
      short: 'Luyện gân cốt vững như kim cương',
      desc: 'Tăng công lực và tâm đắc nhánh Cương (bằng công lực nhận được).'
    },
    {
      id: 'phi-yen-tam-phap', name: 'Phi Yến Tâm Pháp', han: '飛燕心法', branch: 'toc', reqLevel: 2, price: 20000,
      tam: { toc: 1 },
      durations: [{ key: '1h', minutes: 60, congLuc: 15 }, { key: '4h', minutes: 240, congLuc: 50 }, { key: '8h', minutes: 480, congLuc: 85 }],
      short: 'Nhẹ thân như chim yến',
      desc: 'Tăng công lực và tâm đắc nhánh Tốc (bằng công lực nhận được).'
    },
    {
      id: 'nhu-thuy-tam-kinh', name: 'Nhu Thủy Tâm Kinh', han: '柔水心經', branch: 'nhu', reqLevel: 2, price: 20000,
      tam: { nhu: 1 },
      durations: [{ key: '1h', minutes: 60, congLuc: 15 }, { key: '4h', minutes: 240, congLuc: 50 }, { key: '8h', minutes: 480, congLuc: 85 }],
      short: 'Mềm như nước, thắng cương',
      desc: 'Tăng công lực và tâm đắc nhánh Nhu (bằng công lực nhận được).'
    },
    {
      id: 'cuu-am-tam-kinh', name: 'Cửu Âm Tâm Kinh', han: '九陰心經', branch: 'all', reqLevel: 5, price: 50000,
      tam: { cuong: 0.25, toc: 0.25, nhu: 0.25 },
      durations: [{ key: '4h', minutes: 240, congLuc: 70 }, { key: '8h', minutes: 480, congLuc: 120 }],
      short: 'Công pháp cao cấp, thông cả ba nhánh',
      desc: 'Tăng công lực nhiều hơn; mỗi nhánh nhận tâm đắc bằng 25% công lực.'
    },
    {
      id: 'vo-cuc-chan-kinh', name: 'Vô Cực Chân Kinh', han: '無極真經', branch: 'all', reqLevel: 8, price: 100000,
      tam: { cuong: 0.3, toc: 0.3, nhu: 0.3 },
      durations: [{ key: '8h', minutes: 480, congLuc: 170 }, { key: '12h', minutes: 720, congLuc: 230 }],
      short: 'Chân kinh tối thượng',
      desc: 'Tăng công lực rất nhiều; mỗi nhánh nhận tâm đắc bằng 30% công lực.'
    }
  ];
  const METHODS = {};
  METHOD_LIST.forEach(m => { METHODS[m.id] = Object.freeze(m); });
  const METHOD_ORDER = METHOD_LIST.map(m => m.id);

  /** Phần thưởng một phiên tu (chưa tính trần). */
  function rewardOf(methodId, durationKey) {
    const m = METHODS[methodId], d = m && m.durations.find(x => x.key === durationKey);
    if (!d) return null;
    const tam = { cuong: 0, toc: 0, nhu: 0 };
    if (m.tam) for (const b in m.tam) tam[b] = Math.floor(d.congLuc * m.tam[b]);
    return { congLuc: d.congLuc, tam };
  }
  /** Áp phần thưởng vào hồ sơ có trần: trả về phần thật sự cộng được. */
  function clampReward(profile, reward) {
    const cl = Math.max(0, Math.min(CONG_LUC_MAX - profile.congLuc, reward.congLuc));
    const tam = {};
    for (const b of BRANCH_ORDER) tam[b] = Math.max(0, Math.min(TAM_MAX - ((profile.tam && profile.tam[b]) || 0), reward.tam[b] || 0));
    return { congLuc: cl, tam };
  }

  /** Điều kiện học một chiêu. profile: { congLuc, tam: {cuong,toc,nhu}, learned: [id] } */
  function canLearn(profile, skillId) {
    const s = SKILLS[skillId];
    if (!s) return { ok: false, reason: 'Không có chiêu này.' };
    if ((profile.learned || []).includes(skillId)) return { ok: false, reason: 'Bạn đã học chiêu này.', learned: true };
    const level = levelOf(profile.congLuc || 0), tam = (profile.tam && profile.tam[s.branch]) || 0;
    const missing = [];
    if (level < s.req.level) missing.push(`cấp nội công ${s.req.level} (bạn đang cấp ${level})`);
    if (tam < s.req.tam) missing.push(`${s.req.tam} tâm đắc ${BRANCHES[s.branch].name} (bạn có ${tam})`);
    return missing.length ? { ok: false, reason: 'Cần ' + missing.join(' và ') + '.', missing } : { ok: true };
  }
  function canCultivate(profile, methodId) {
    const m = METHODS[methodId];
    if (!m) return { ok: false, reason: 'Không có công pháp này.' };
    const level = levelOf(profile.congLuc || 0);
    return level >= m.reqLevel ? { ok: true } : { ok: false, reason: `Cần cấp nội công ${m.reqLevel} (bạn đang cấp ${level}).` };
  }

  /** Chiêu có gây sát thương (đánh chủ động hoặc phản đòn) không. */
  const isDamaging = s => !!(s && (s.kind === 'atk' || s.kind === 'hybrid' || s.kind === 'charge' || s.kind === 'parry'));
  const isAttacking = s => !!(s && (s.kind === 'atk' || s.kind === 'hybrid' || s.kind === 'charge'));
  /** Cảnh báo (không chặn) cho bộ 4 chiêu. */
  function loadoutWarnings(ids) {
    const list = ids.map(id => SKILLS[id]).filter(Boolean), out = [];
    if (list.length && !list.some(isAttacking)) out.push({ code: 'no-attack', text: 'Bộ chiêu này không có đòn tấn công chủ động. Bạn chỉ gây sát thương bằng phản đòn, trận dễ kéo dài.' });
    if (list.length && !list.some(isDamaging)) out.push({ code: 'no-damage', text: 'Bộ chiêu này không có chiêu nào gây sát thương. Trận sẽ kết thúc bằng sức tàn của cả hai bên.' });
    return out;
  }
  /** Kiểm tra bộ chiêu: 4 chiêu khác nhau, đã học. */
  function validateLoadout(ids, learned) {
    if (!Array.isArray(ids) || ids.length !== 4) return { ok: false, reason: 'Cần chọn đúng 4 chiêu.' };
    if (new Set(ids).size !== 4) return { ok: false, reason: 'Bốn chiêu phải khác nhau.' };
    for (const id of ids) {
      if (!SKILLS[id]) return { ok: false, reason: 'Có chiêu không tồn tại.' };
      if (!(learned || []).includes(id)) return { ok: false, reason: `Bạn chưa học ${SKILLS[id].name}.` };
    }
    return { ok: true };
  }

  /** Dòng chỉ số ngắn cho thẻ chiêu: "Nội lực 14 · Tốc 30 · Sát thương 38". */
  function statsLine(skill) {
    const s = typeof skill === 'string' ? SKILLS[skill] : skill;
    if (!s) return '';
    const p = ['Nội lực ' + s.mana];
    if (s.kind === 'atk') p.push(s.hits.length > 1 ? `${s.hits.length} nhịp × ${s.hits[0].base}` : 'Sát thương ' + s.hits[0].base, 'Tốc ' + s.hits[0].spd);
    else if (s.kind === 'guard') p.push('Giảm ' + Math.round(s.guard.red * 100) + '%');
    else if (s.kind === 'dodge') p.push('Tốc né ' + s.dodge.spd);
    else if (s.kind === 'parry') p.push('Tốc đỡ ' + s.parry.spd, 'Phản ' + s.parry.flat + (s.parry.pct ? '+' : ''));
    else if (s.kind === 'hybrid') p.push('Đỡ ' + s.parry.spd + ' / Đánh ' + s.hits[0].base);
    else if (s.kind === 'charge') p.push('Đòn ' + s.charge.release.base, 'Tốc ' + s.charge.release.spd);
    return p.join(' · ');
  }
  const KIND_NAMES = { atk: 'Công', guard: 'Thủ', dodge: 'Né', parry: 'Đỡ', hybrid: 'Đỡ / Công', charge: 'Tụ lực', rest: 'Nghỉ', idle: 'Nghỉ' };

  /** Giá trị ngắn gọn của luật PK để giao diện hiển thị (engine dùng lib/pk/rules.js). */
  const PK = { HP: 200, TURN_SECONDS: 20, LOADOUT_SECONDS: 30, REVEAL_SECONDS: 6.5, SUDDEN_FROM_TURN: 20, MAX_TURNS: 40, IDLE_FORFEIT_TURNS: 3 };

  const api = {
    BRANCHES, BRANCH_ORDER, TIER_REQ, TIER_NAMES, SKILLS, SKILL_LIST, SKILL_ORDER, STARTERS, SPECIAL, REST_ID, IDLE_ID,
    METHODS, METHOD_LIST, METHOD_ORDER, LEVEL_AT, LEVEL_MAX, CONG_LUC_MAX, TAM_MAX, MANA_BASE, MANA_PER_LEVEL, KIND_NAMES, PK,
    levelOf, levelInfo, realmName, REALM_NAMES, PK_TITLES, pkTitle, manaMaxOf, combatPower, rewardOf, clampReward, canLearn, canCultivate,
    MASTERY_AT, MASTERY_NAMES, MASTERY_MAX, masteryXP, masteryInfo, masteryMap, practiceXP, combatSkill,
    isDamaging, isAttacking, loadoutWarnings, validateLoadout, statsLine
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.MARTIAL = api;
})(this);
