'use strict';
/*
 * Hằng số luật luận võ. Một chỗ duy nhất để chỉnh cân bằng.
 * Các con số này đã chạy thử bằng tools/pk-sim (bot cân bằng một lượt); xem docs/VO-HOC-CAN-BANG.md.
 */
// Hệ số buff của phòng có buff. Mô phỏng cho thấy buff rất nhạy (xem docs/VO-HOC-CAN-BANG.md), nên mặc định thấp;
// chủ dự án chỉnh bằng biến môi trường PK_BUFF_SCALE (0 = buff không có tác dụng, 1 = đủ số gốc).
const scaleEnv = String(process.env.PK_BUFF_SCALE || '').trim();
const BUFF_SCALE = scaleEnv !== '' && Number.isFinite(Number(scaleEnv)) && Number(scaleEnv) >= 0 ? Math.min(1, Number(scaleEnv)) : 0.15;

const RULES = Object.freeze({
  // cơ bản
  HP: 200,                    // HP chung, không phụ thuộc nhánh hay nội công
  REGEN: 6,                   // hồi nội lực mỗi lượt
  REST_BONUS: 20,             // Điều tức hồi thêm
  // nộ
  RAGE_MAX: 100,
  RAGE_FROM_DMG: 0.8,         // mỗi điểm sát thương nhận được cộng nộ
  RAGE_PCT: 0.003,            // 100 nộ = +30% đòn công chủ động kế tiếp
  // Kim Chung Tráo
  KC_BONUS: 0.25,
  KC_TURNS: 2,
  // trần cộng dồn (chống bất tử, chống né 100%)
  OFF_CAP: 0.5,               // tổng tăng sát thương gây ra (nộ + Kim Chung + buff ngoài)
  DEF_PASSIVE_CAP: 0.15,      // tổng giảm sát thương bị động (pháp tướng + hào quang)
  DODGE_BONUS_CAP: 0.08,      // tổng cộng xác suất né từ buff (8 điểm %)
  DODGE_CAP: 0.9,             // xác suất né tối đa
  // hàm xác suất né / đỡ: P = PMIN + (PMAX - PMIN) / (1 + exp(-(Vphòng - Vcông) / K))
  PMIN: 0.1,
  PMAX: 0.9,
  K: 20,
  // sơ hở: đòn bị né hoặc đỡ hết thì lượt sau nhận thêm
  EXPOSED_PCT: 0.25,
  // dao động sát thương mỗi nhịp trúng: ±10%
  DMG_VAR: 0.1,
  // trận không dứt điểm
  SUDDEN_FROM_TURN: 20,       // từ lượt này cả hai mất máu mỗi lượt
  SUDDEN_NO_DAMAGE_STREAK: 4, // hoặc sớm hơn nếu bốn lượt liền không ai mất máu
  SUDDEN_STEP: 5,             // 5, 10, 15… mỗi lượt
  MAX_TURNS: 40,
  // thời gian (ms)
  LOADOUT_MS: 30000,
  TURN_MS: 20000,
  REVEAL_MS: 4000,            // dừng cho người chơi xem màn lật chiêu
  INVITE_MS: 20000,
  // quá giờ liên tiếp thì xử thua / hủy
  IDLE_FORFEIT_TURNS: 3,
  BOTH_AWAY_MS: 60000,
  // buff của phòng có buff
  BUFF_SCALE                  // hệ số nhân cho các con số buff gốc (xem lib/pk/buffs.js)
});

module.exports = RULES;
