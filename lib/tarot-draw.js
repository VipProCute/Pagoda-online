'use strict';
/*
 * Rút bài tarot ở máy chủ (KH §7.2). Logic thuần: giờ (vnDay) được tiêm vào, không đụng socket hay I/O.
 * Hạt giống = sha256(uid | ngày VN | chủ đề | khung | tình trạng) nên cùng người, cùng ngày, cùng câu hỏi
 * thì ra cùng 5 lá. Hạt giống và uid không bao giờ trả cho trình duyệt.
 * Quy ước id lá: 0–21 Ẩn chính (Rider–Waite), 22–35 Gậy, 36–49 Cốc, 50–63 Kiếm, 64–77 Tiền.
 */
const crypto = require('crypto');
const { makeRng } = require('./pk/rng');

const TOPICS = ['overview', 'career', 'work', 'money', 'love', 'family', 'health', 'study'];
const SPANS = [7, 30, 90];
const STATUSES = ['single', 'couple'];
const DECK_SIZE = 78;
const SPREAD = 5;
const MAX_REMEMBER = 50000;   // chặn RAM: vượt thì quên người cũ nhất về "đã rút hôm nay" (kết quả vẫn y hệt nhờ hạt giống)

/** Kiểm đầu vào từ client. Trả { ok, topic, span, status } hoặc { ok:false, reason }. */
function normalizeAsk(data) {
  if (!data || typeof data !== 'object') return { ok: false, reason: 'Câu hỏi chưa hợp lệ.' };
  const topic = data.topic;
  if (typeof topic !== 'string' || !TOPICS.includes(topic)) return { ok: false, reason: 'Chủ đề chưa hợp lệ.' };
  const span = data.span;
  if (typeof span !== 'number' || !SPANS.includes(span)) return { ok: false, reason: 'Khung thời gian chưa hợp lệ.' };
  let status = '';
  if (topic === 'love') {
    if (typeof data.status !== 'string' || !STATUSES.includes(data.status)) return { ok: false, reason: 'Hãy chọn "đang một mình" hoặc "đang có đôi".' };
    status = data.status;
  }
  return { ok: true, topic, span, status };
}

/** Hạt giống (hex) của một lần hỏi trong một ngày. */
function tarotSeed(uid, day, topic, span, status) {
  return crypto.createHash('sha256').update([uid, day, topic, span, status || ''].join('|')).digest('hex');
}

/** Rút 5 lá khác nhau từ bộ 78 lá bằng Fisher–Yates, mỗi lá ngược nếu rng() < 0.5. */
function drawCards(seed) {
  const rng = makeRng(seed);
  const deck = Array.from({ length: DECK_SIZE }, (_, i) => i);
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = deck[i]; deck[i] = deck[j]; deck[j] = t;
  }
  return deck.slice(0, SPREAD).map(id => ({ id, rev: rng() < 0.5 }));
}

/** Chỉ số tổ hợp (chủ đề, khung, tình trạng) trong 0..71. */
function comboIndex(ask) {
  return (TOPICS.indexOf(ask.topic) * SPANS.length + SPANS.indexOf(ask.span)) * (STATUSES.length + 1) + (ask.status ? STATUSES.indexOf(ask.status) + 1 : 0);
}

function createTarotDrawer({ vnDay }) {
  let day = '';
  let seen = new Map();   // uid -> bitmask (BigInt) các tổ hợp câu hỏi đã rút trong ngày
  return {
    /** ask đã qua normalizeAsk. Trả { cards, again }. */
    draw(uid, ask) {
      const today = vnDay();
      if (today !== day) { day = today; seen = new Map(); }
      const seed = tarotSeed(uid, today, ask.topic, ask.span, ask.status);
      const bit = 1n << BigInt(comboIndex(ask));
      const mask = seen.get(uid);
      const again = mask !== undefined && (mask & bit) !== 0n;
      if (mask === undefined) {
        // Vượt ngưỡng thì chỉ quên người cũ nhất, không xoá lịch sử của mọi người.
        if (seen.size >= MAX_REMEMBER) seen.delete(seen.keys().next().value);
        seen.set(uid, bit);
      } else if (!again) seen.set(uid, mask | bit);
      return { cards: drawCards(seed), again };
    }
  };
}

module.exports = { TOPICS, SPANS, STATUSES, DECK_SIZE, SPREAD, normalizeAsk, tarotSeed, drawCards, createTarotDrawer };
