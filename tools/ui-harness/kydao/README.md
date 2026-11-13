# Harness bảng cờ Kỳ Đạo (kiểm tay)

Trang thử thủ công cho bảng cờ thật (`KydaoUI`) với máy chủ giả trong trình duyệt. Dùng để xem bảng vẽ đúng và các hiệu ứng sự kiện mới của đợt "Kỳ Đài" mà không cần hai người chơi thật.

## Cách mở

- Harness trong `tools/ui-harness/` được `tools/ui-harness/serve.js` phục vụ dưới `/harness/`:
  `node tools/ui-harness/serve.js` rồi mở http://127.0.0.1:4173/harness/kydao/index.html
  (đường dẫn `/js`, `/css`, `/img` lấy từ `public/`).
- Cách khác, không cần harness: chạy `npm start` rồi mở http://localhost:3000/kydao-kydai-test.html
  (bản phục vụ sẵn từ `public/`, có nút cờ vua sắp phong cấp, đối thủ khai mở Băng Sơn và kết thúc chiếu hết).

## Các nút

- Cờ vua, Cờ tướng, Cờ vua (cầm Đen): mở ván thường.
- Cờ úp: ván `jieqi` (`KyXiangqi`, seed cố định 7).
- Caro: ván `gomoku`. Cờ vây 9×9: ván `go`, size 9.
- Cờ vua sắp phong cấp: ván cờ vua từ FEN `r3k2r/1P3ppp/8/8/8/8/5PPP/R3K2R w KQkq - 0 1`.
- Giả lập đối thủ đi: đi ngẫu nhiên một nước hợp lệ cho bên đối thủ.
- Mã sân + Đối thủ khai mở sân: phát `kd:skin` cho bên đối thủ với `opened: true`.
- Lý do + Kết quả + Giả lập kết thúc: phát `kd:end` với lý do (checkmate, resign, timeout, stalemate, agreed, five, score) và kết quả (a, b, draw).

Máy chủ giả xử lý `kd:skin` của chính mình (chuẩn hóa bằng `KydaoSkins.normalize`, trả ack rồi phát lại `kd:skin`). Khung log phía trên ghi mọi lệnh gửi đi và âm thanh.

## Cần nhìn khi kiểm tay

- Khẩu hiệu khi đối thủ khai mở sân (Đối thủ khai mở sân).
- Nửa sân đổi màu/hình sau khi khai mở, và nửa của mình khi tự chọn mã sân.
- Chấn động khi phong cấp (Cờ vua sắp phong cấp, đi tốt lên hàng cuối).
- Hiệu ứng riêng cho từng lý do thắng/thua (chiếu hết, đầu hàng, hết giờ, hòa cờ, thắng năm quân, thắng điểm).
- Dòng sông trên bàn cờ tướng.

## Giới hạn

- Harness không ẩn quân cờ úp: ván cờ úp truyền cả trạng thái đầy đủ cho bảng (chưa dùng `view()`), nên không kiểm được việc che quân ở phía client.
- Phong cấp chưa được điều khiển: nước phong cấp đi theo lượt ngẫu nhiên, không chọn quân.
- Chưa có kịch bản tự động `ui-check.js` cho trang này (cần Playwright, xem thẻ T-008). Kiểm bằng tay.
