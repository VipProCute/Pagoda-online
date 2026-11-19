/*
 * Kỳ Đạo · Web Worker cho máy đánh cờ (để luồng giao diện không bị khựng khi máy nghĩ).
 *
 * Gửi:  worker.postMessage({ id, game: 'chess' | 'xiangqi', state, level: 1|2|3, timeMs? })
 *       worker.postMessage({ id, kind: 'defend', game, state, left })  → { id, defend: { move, escape, n } | null }
 * Nhận: { id, move } (move là chuỗi nước như legalMoves trả về, hoặc null nếu hết nước)
 *       hoặc { id, error: 'lời tiếng Việt' }.
 */
/* global importScripts, KyAiChess, KyAiXiangqi */
'use strict';

importScripts('/js/kydao/chess.js?v=1', '/js/kydao/xiangqi.js?v=1', '/js/kydao/ai-chess.js?v=2', '/js/kydao/ai-xiangqi.js?v=2');

self.onmessage = function (e) {
  const data = e && e.data ? e.data : {};
  const id = data.id;
  try {
    const engine = data.game === 'chess' ? KyAiChess : data.game === 'xiangqi' ? KyAiXiangqi : null;
    if (!engine) { self.postMessage({ id, error: 'Loại cờ chưa có máy đánh.' }); return; }
    if (!data.state || !Array.isArray(data.state.board)) { self.postMessage({ id, error: 'Thế cờ không hợp lệ.' }); return; }
    // Giải thế cờ: máy phòng thủ, tìm nước thoát chiếu hết trong `left` nước của người giải (engine.defend)
    if (data.kind === 'defend') { self.postMessage({ id, defend: engine.defend(data.state, Math.max(0, Math.min(5, data.left | 0))) }); return; }
    const opts = { level: data.level };
    if (Number.isFinite(data.timeMs) && data.timeMs > 0) opts.timeMs = Math.min(5000, data.timeMs);
    const move = engine.bestMove(data.state, opts);
    self.postMessage({ id, move });
  } catch (err) {
    self.postMessage({ id, error: 'Máy đánh cờ gặp lỗi.' });
  }
};
