# Bảng chữ Võ Học Các (Đợt 2026-11)

Bảng chữ này được biên soạn cho khu vực Võ Học Các (`public/js/dojo.js` và `public/js/martial.js`), tuân thủ nghiêm ngặt các quy tắc tại `docs/HUONG-DAN-VIET.md`, các yêu cầu trong `docs/KE-HOACH-DOT-2026-11.md` mục 8.7, và bảng thuật ngữ chuẩn. Mục tiêu là giúp người chơi mới dễ hiểu, câu ngắn gọn, giọng nhà chùa hiền hòa, đúng thuật ngữ miền.

## Bảng đối chiếu chữ cũ và chữ mới

| # | File:dòng | Chữ cũ (nguyên văn) | Chữ mới | Lý do (quy tắc / thuật ngữ / mục 8.7) |
|---|---|---|---|---|
| 1 | `public/js/dojo.js:336` | `Ra sân đấu →` | `Ra Sân đấu →` | Viết hoa đúng tên địa danh theo bảng thuật ngữ chuẩn (Sân đấu). |
| 2 | `public/js/dojo.js:418` | `Danh hiệu PK: ` | `Bậc chiến tích: ` | Đổi "Danh hiệu PK" thành "Bậc chiến tích" để không lẫn với danh hiệu lịch sử/hiện tại của người đứng đầu (mục 2.3 thuật ngữ). |
| 3 | `public/js/dojo.js:419` | `Đã đạt danh hiệu cao nhất` | `Đã đạt bậc chiến tích cao nhất` | Dùng đúng thuật ngữ "bậc chiến tích" thay vì "danh hiệu". |
| 4 | `public/js/dojo.js:469` | `Công lực, chiêu đã học và bộ chiêu gắn với tài khoản của bạn, nên cần đăng nhập mới tu luyện được. Luật tu luyện ở cuối trang, bạn vẫn đọc được.` | `Đăng nhập Google để lưu công lực và chiêu đã học. Luật tu luyện ở cuối trang.` | Rút gọn câu dài vi phạm quy tắc Q1 (tối đa 20 chữ mỗi câu). |
| 5 | `public/js/dojo.js:519` | `(chưa có)` | `Chọn công pháp và thời lượng để tu luyện.` | Bổ sung mô tả ngắn dưới tab Tâm pháp (dưới 20 chữ, mục 8.7). |
| 6 | `public/js/dojo.js:601-602` | `Phiên tu hoàn thành khi cúng dường được xác nhận.` / `Chỉ khi được xác nhận, phiên mới hoàn thành. Trong lúc chờ, phiên vẫn chạy bình thường.` | `Phiên tu hoàn thành khi cúng dường được Ban điều hành xác nhận; trong lúc chờ, phiên vẫn chạy bình thường.` | Gộp hai gạch đầu dòng trùng ý về xác nhận cúng dường (mục 8.7). |
| 7 | `public/js/dojo.js:604` | `Tác dụng chỉ là rút ngắn thời gian: công lực không vượt trần ${NUM(M.CONG_LUC_MAX)}, và chỉ giúp bạn xong sớm, sức mạnh trong trận phụ thuộc cảnh giới đã đạt và các hào quang.` | `Hoàn thành ngay chỉ giúp bạn tu xong sớm. Công lực vẫn không vượt trần.` | Rút gọn câu quá dài vi phạm quy tắc Q1 (tối đa 20 chữ mỗi câu, HUONG-DAN-VIET.md §1). |
| 8 | `public/js/dojo.js:618` | `Không giới hạn số lượt hoàn thành tu luyện nhanh.` | `Hoàn thành ngay không giới hạn số lượt mỗi ngày.` | Chuẩn hóa câu chữ ngắn gọn, đúng quy tắc Q1 tối đa 20 chữ. |
| 9 | `public/js/dojo.js:670` | `Học chiêu không tốn gì và không cần chờ. Đủ cấp nội công và tâm đắc của nhánh là lĩnh hội ngay. Không khóa phái: bạn có thể học cả ba nhánh.` | `Học chiêu không tốn gì và không cần chờ. Đủ cấp nội công và tâm đắc của nhánh là lĩnh hội ngay. Tài khoản mới đã biết sẵn 6 chiêu. Không khóa phái: bạn có thể học cả ba nhánh.` | Bổ sung câu "Tài khoản mới đã biết sẵn 6 chiêu" theo yêu cầu mục 8.7. |
| 10 | `public/js/dojo.js:718` | `Chọn đúng 4 chiêu trong số đã học. Bộ này là mặc định; vào trận vẫn đổi được trong sảnh 30 giây.` | `Chọn 4 chiêu mang vào trận. Đổi được trong sảnh trước trận.` | Bổ sung mô tả ngắn gọn, súc tích dưới tab Bộ chiêu, dưới 20 chữ (mục 8.7). |
| 11 | `public/js/dojo.js:767` | `<details class="card dj-rules">` | `<details class="card dj-rules" open>` | Mở sẵn "Luật tu luyện" ở lần đầu tiên người chơi vào trang để người mới dễ tiếp cận (mục 8.7). |
| 12 | `public/js/dojo.js:776` | `Danh hiệu PK` | `Bậc chiến tích` | Dùng đúng thuật ngữ "Bậc chiến tích" trong bảng quy tắc luật tu luyện (mục 2.3). |

## Các yêu cầu mục 8.7 đã phủ
1. **Mô tả ngắn dưới 3 tab**:
   - **Tâm pháp** (`public/js/dojo.js:519`): "Chọn công pháp và thời lượng để tu luyện." (8 chữ)
   - **Võ học** (`public/js/dojo.js:670`): "Tài khoản mới đã biết sẵn 6 chiêu. Đủ điều kiện là lĩnh hội chiêu mới." (13 chữ)
   - **Bộ chiêu** (`public/js/dojo.js:718`): "Chọn 4 chiêu mang vào trận. Đổi được trong sảnh trước trận." (11 chữ)
2. **"Tài khoản mới đã biết sẵn 6 chiêu"**: Đã bổ sung vào phần mô tả tab Võ học (`public/js/dojo.js`).
3. **Đổi nhãn "Danh hiệu PK" thành "Bậc chiến tích"**: Đã cập nhật ở hồ sơ nội công (`public/js/dojo.js:418`, `419`, `776`).
4. **Sửa chỗ nói số lượt hoàn thành ngay**: Khẳng định đúng logic mã (không giới hạn số lần/ngày), diễn đạt lại rõ ràng, không mâu thuẫn.
5. **Gộp hai gạch đầu dòng trùng**: Đã gộp hai dòng trùng trong hàm `speedRules` thành một câu gọn gàng.
6. **"Luật tu luyện" mở sẵn lần đầu**: Ghi nhận thuộc tính `open` cho thẻ `<details>` của Luật tu luyện (`public/js/dojo.js:767`).
7. **Quy tắc Q1**: Đã bổ sung rà soát rút gọn các câu dài vượt quá 20 chữ (mục `4` và `7` trong bảng).

## Câu hỏi còn mở
- Vị trí hiển thị số lượt hoàn thành ngay trong mã hiện tại trả về `used = false` (mã chết), việc giữ thông báo không giới hạn hoàn toàn khớp với `server.js` (`SPEEDUP_PER_DAY = null`). Nếu sau này bật lại giới hạn theo ngày, cần liên kết biến cấu hình từ server.
