'use strict';
/*
 * Ngẫu nhiên cho luận võ. Máy chủ quyết định mọi kết quả; trình duyệt không bao giờ tự tung xúc xắc.
 * Mỗi trận có một seed lấy từ crypto, giữ kín tới hết trận rồi lưu vào lịch sử để tra lại.
 * Bộ sinh sfc32 cho cùng seed ra cùng dãy số, nên test và mô phỏng tái lập được.
 */
const crypto = require('crypto');

function newSeed() { return crypto.randomBytes(16).toString('hex'); }

function sfc32(a, b, c, d) {
  return function () {
    a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
    let t = (a + b) | 0; a = b ^ (b >>> 9); b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11); d = (d + 1) | 0; t = (t + d) | 0; c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
}

/** Bộ sinh từ chuỗi seed (hex hoặc chữ bất kỳ). Trả về hàm () => số trong [0, 1). */
function makeRng(seed) {
  const h = crypto.createHash('sha256').update(String(seed)).digest();
  const rng = sfc32(h.readUInt32LE(0), h.readUInt32LE(4), h.readUInt32LE(8), h.readUInt32LE(12));
  for (let i = 0; i < 12; i++) rng();   // bỏ vài số đầu cho đều
  return rng;
}

/** Bộ sinh trả lần lượt dãy số cho trước (dùng trong test để ép "né được", "trúng"…). Hết dãy thì lấy `fallback`. */
function fromSequence(values, fallback = 0.5) {
  let i = 0;
  const f = () => (i < values.length ? values[i++] : fallback);
  f.used = () => i;
  return f;
}

module.exports = { newSeed, makeRng, sfc32, fromSequence };
