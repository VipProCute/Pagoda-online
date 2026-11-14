# Harness bảng cờ Kỳ Đạo

Trang thử thủ công cho bảng cờ thật (`KydaoUI`) với máy chủ giả trong trình duyệt. Dùng để xem bảng vẽ đúng và các hiệu ứng sự kiện mới của đợt "Kỳ Đài" mà không cần hai người chơi thật.

## Cách mở

- Harness trong `tools/ui-harness/` được `tools/ui-harness/serve.js` phục vụ dưới `/harness/`:
  `node tools/ui-harness/serve.js` rồi mở http://127.0.0.1:4173/harness/kydao/index.html
  (đường dẫn `/js`, `/css`, `/img` lấy từ `public/`).
- Cách khác, không cần harness: chạy `npm start` rồi mở http://localhost:3000/kydao-kydai-test.html
  (bản phục vụ sẵn từ `public/`, có nút cờ vua sắp phong cấp, đối thủ khai mở Băng Sơn và kết thúc chiếu hết).

## Kiểm tự động

Cần `playwright` hoặc `playwright-core` (không nằm trong `package.json`): cài riêng hoặc đặt `NODE_PATH` trỏ tới nơi đã cài. Chạy `node tools/ui-harness/kydao/ui-check.js`; kịch bản tự bật máy chủ tĩnh.

Biến tùy chọn: `PW_CHANNEL=chrome` dùng Chrome cài sẵn; `PORT` đổi cổng (mặc định 4175); `SHOTS` đổi thư mục ảnh; `ONLY` lọc theo tên kiểm tra.

- `mo-van-co-vua`: mở bàn, kiểm kích thước và tràn ngang.
- `lanh-dia-khai-mo`: kiểm bảng chọn, khẩu hiệu và lệnh gửi sân.
- `doi-thu-khai-mo`: kiểm hiệu ứng đối thủ và chụp nửa sân.
- `phong-cap-chan-dong`: kiểm rung bàn và chế độ giảm chuyển động.
- `ket-thuc-chieu-het`: kiểm thứ tự khẩu hiệu và kết quả.
- `co-tuong-song`: kiểm dòng sông và chế độ giảm chuyển động.
- `nam-mon-mo-duoc`: kiểm mở các môn và nút lãnh địa.
- `ban-3d`: kiểm chuyển sang bàn 3D trên desktop nếu có WebGL2.

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

## Thử đầu-cuối với máy chủ thật

`e2e-real.js` bật `server.js` thật ở cổng trống (dữ liệu tạm, qua `test/helpers/live.js`) và mở trang thật (`index.html` + `app.js` + `kydao-ui.js`) bằng hai trình duyệt Playwright ở hai context riêng (An, Bình; cùng cỡ điện thoại 390×844). Người xem C là bot socket (`test/helpers/client.js`). Hai người ngồi bàn bằng cách chạm biển tên bàn đá trên canvas Sân chùa (đường chạm thật), chọn luật ở hộp `kd-lobby`, đi quân bằng cách chạm ô trên `.kd-canvas`. Không dùng máy chủ giả.

```
PW_CHANNEL=chrome node tools/ui-harness/kydao/e2e-real.js
```

Cần `playwright` hoặc `playwright-core` (không nằm trong `package.json`): đặt `NODE_PATH` trỏ tới nơi đã cài. Biến tùy chọn: `PW_CHANNEL=chrome` dùng Chrome cài sẵn; `SHOTS` đổi thư mục ảnh (mặc định `kydao-e2e-shots` trong thư mục tạm). Thoát mã 1 nếu có bước trượt; luôn tắt trình duyệt và máy chủ ở `finally`.

Các bước:

1. A và B vào chùa, ra Sân chùa, ngồi hai ghế bàn 1, chọn cờ vua giao hữu, sẵn sàng: cả hai thấy `.kd-panel`.
2. A mở Lãnh địa, chọn Hỏa Diệm Sơn và Dung Nham, Khai mở: A và B thấy `.kdfx-banner.is-on`; canvas phía B đổi ở nửa của A (so trung bình màu từng nửa canvas).
3. B khai mở Trường Giang: A thấy khẩu hiệu.
4. A bật "Ẩn skin đối thủ": nửa B trên canvas A về mặc định, canvas B không đổi.
5. A khai mở lần hai ngay: nút bị khóa và dòng `.kd-skin-note` có chữ "giây"; ép gửi lên máy chủ thì `.kd-msg` hiện lý do "Đợi N giây…".
6. Bot C `kd:watch` bàn 1: `kd:start` có `skins` đúng của cả hai bên.
7. Đi e4, e5, Nf3, Nc6 bằng chạm canvas; A đầu hàng và xác nhận: cả hai thấy khẩu hiệu rồi `.kd-result`.
8. Cờ tướng ở bàn 3: A khai mở Trường Giang, canvas B đổi theo thời gian (băm điểm ảnh khác nhau giữa các lần lấy mẫu), B đầu hàng, hiện bảng kết quả.
9. Không `pageerror`, không `console.error`, không HTTP ≥ 500, nhật ký máy chủ không có lỗi.
10. Caro ở bàn 2: A bấm "Bộ đá", chọn Tinh Hà (đủ 8 bộ, không có nút "Khai mở", chưa có mục khóa), đặt quân giữa bàn; màu quân của A trên canvas B khác hẳn giữa lúc hiện và lúc B bấm "Ẩn skin đối thủ". A đầu hàng.
11. Máy chủ được bật với `ADMIN_KEY` thử (sinh mới mỗi lần chạy), `DONATION_MODE=test`, `BANK_ID`/`BANK_ACCOUNT` giả. Ván cờ vua ở bàn 1, A khai mở Hỏa Diệm Sơn; kịch bản gọi `POST /api/admin/kydao-shop` (`price: 20000`, `on: true`) giữa ván: nửa sân của A trên cả hai trang về mặc định.
12. A mở Lãnh địa: mọi skin có lớp `is-locked` và giá "20.000 đ", mục Mặc định không khóa. Bấm quân Dung Nham: khung xác nhận; "Cúng dường để mở": khung QR (`src` bắt đầu bằng `https://img.vietqr.io/`, ảnh được chặn bằng `route` nên không gọi ra ngoài), số tiền 20.000 đ, mã `CD` + 6 ký tự.
13. Chờ chế độ thử tự xác nhận (tối đa 20 giây): khung QR đóng, Dung Nham hết khóa ở A (skin sân khác vẫn khóa), canvas B đổi theo quân của A; B mở Lãnh địa vẫn thấy Dung Nham khóa.
14. B ép gửi `kd:skin` qua socket của trang (`window.__sock`, nối bằng `addInitScript`): máy chủ trả `code:'locked'` kèm `kind`, `id`, `price`; B bấm mục khóa thì hiện khung mua.
15. `POST /api/admin/kydao-shop` với `on: false`: cả hai hết `is-locked`; `GET` cho `stats.unlocks >= 1`.
16. Suốt các bước mới: không `pageerror`, không `console.error`, không HTTP ≥ 500, nhật ký máy chủ không có lỗi.

Ảnh chụp từng mốc nằm ở `SHOTS` (`e2e-*.png`); khi một bước trượt, ảnh cả hai trang lưu thành `fail-<số bước>-<tên>.png`. Ảnh tiêu biểu của một lần chạy đạt: `docs/ky-dai/anh/e2e-*.png`.
