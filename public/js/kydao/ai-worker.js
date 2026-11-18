/*
 * Kỳ Đạo · Web Worker cho máy đánh cờ (để luồng giao diện không bị khựng khi máy nghĩ).
 *
 * Gửi:  worker.postMessage({ id, game: 'chess' | 'xiangqi', state, level: 1|2|3, timeMs? })
 * Nhận: { id, move } (move là chuỗi nước như legalMoves trả về, hoặc null nếu hết nước)
 *       hoặc { id, error: 'lời tiếng Việt' }.
 */
/* global importScripts, KyAiChess, KyAiXiangqi */
'use strict';

importScripts('/js/kydao/chess.js', '/js/kydao/xiangqi.js', '/js/kydao/ai-chess.js', '/js/kydao/ai-xiangqi.js');

self.onmessage = function (e) {
  const data = e && e.data ? e.data : {};
  const id = data.id;
  try {
    const engine = data.game === 'chess' ? KyAiChess : data.game === 'xiangqi' ? KyAiXiangqi : null;
    if (!engine) { self.postMessage({ id, error: 'Loại cờ chưa có máy đánh.' }); return; }
    if (!data.state || !Array.isArray(data.state.board)) { self.postMessage({ id, error: 'Thế cờ không hợp lệ.' }); return; }
    const opts = { level: data.level };
    if (Number.isFinite(data.timeMs) && data.timeMs > 0) opts.timeMs = Math.min(5000, data.timeMs);
    const move = engine.bestMove(data.state, opts);
    self.postMessage({ id, move });
  } catch (err) {
    self.postMessage({ id, error: 'Máy đánh cờ gặp lỗi.' });
  }
};
