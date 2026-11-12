# Bảng chữ Võ Học Các (Đợt 2026-11)

Bảng đối chiếu chữ cũ và chữ mới đã áp vào `public/js/dojo.js` (T-063), theo `docs/HUONG-DAN-VIET.md` và `docs/KE-HOACH-DOT-2026-11.md` §8.7. Số dòng theo mã hiện tại. `public/js/martial.js` không đổi chữ nào.

## Bảng đối chiếu

| # | Dòng `dojo.js` | Chữ cũ | Chữ mới (đã áp) | Lý do |
|---|---|---|---|---|
| 1 | 340 | `Ra sân đấu →` | `Ra Sân đấu →` | "Sân đấu" là tên riêng trong bảng thuật ngữ. |
| 2 | 423 | `Danh hiệu PK: ` | `Bậc chiến tích: ` | Không lẫn với danh hiệu lịch sử/hiện tại. |
| 3 | 424 | `Đã đạt danh hiệu cao nhất` | `Đã đạt bậc chiến tích cao nhất` | Đúng thuật ngữ. |
| 4 | 474 | `Công lực, chiêu đã học và bộ chiêu gắn với tài khoản của bạn, nên cần đăng nhập mới tu luyện được. Luật tu luyện ở cuối trang, bạn vẫn đọc được.` | `Đăng nhập Google để lưu công lực và chiêu đã học. Luật tu luyện ở cuối trang.` | Rút gọn (Q1). Tiêu đề thẻ vẫn nói cần đăng nhập để tu luyện. |
| 5 | 606 | Hai gạch: `Phiên tu hoàn thành khi cúng dường được xác nhận.` và `Chỉ khi được xác nhận, phiên mới hoàn thành. Trong lúc chờ, phiên vẫn chạy bình thường.` | Một gạch: `Phiên tu hoàn thành khi cúng dường được xác nhận; trong lúc chờ, phiên vẫn chạy bình thường.` | Gộp hai gạch trùng ý. Không ghi "Ban điều hành" vì ở chế độ test việc xác nhận khác. |
| 6 | 608 | `Tác dụng chỉ là rút ngắn thời gian: công lực không vượt trần ${NUM(M.CONG_LUC_MAX)}, và chỉ giúp bạn xong sớm, sức mạnh trong trận phụ thuộc cảnh giới đã đạt và các hào quang.` | `Hoàn thành ngay chỉ giúp bạn tu xong sớm. Công lực vẫn không vượt trần ${NUM(M.CONG_LUC_MAX)}. Sức mạnh trong trận phụ thuộc cảnh giới đã đạt và hào quang.` | Tách ba câu ngắn; giữ số trần từ hằng số và ý cảnh giới + hào quang. |
| 7 | 622, 791 | `Không giới hạn số lượt hoàn thành tu luyện nhanh.` | `Hoàn thành ngay không giới hạn số lượt mỗi ngày.` | Khớp `SPEEDUP_PER_DAY = null` trong `server.js`. |
| 8 | 674 | `… là lĩnh hội ngay. Không khóa phái: bạn có thể học cả ba nhánh.` | `… là lĩnh hội ngay. Tài khoản mới đã biết sẵn ${M.STARTERS.length} chiêu. Không khóa phái: bạn có thể học cả ba nhánh.` | Theo §8.7; số lấy từ `M.STARTERS`, không gõ cứng. |
| 9 | 736 | `Chọn đúng 4 chiêu trong số đã học. Bộ này là mặc định; vào trận vẫn đổi được trong sảnh ${M.PK.LOADOUT_SECONDS} giây.` | `Chọn đúng 4 chiêu mang vào trận. Bộ này là mặc định; trong sảnh trước trận vẫn đổi được, ${M.PK.LOADOUT_SECONDS} giây.` | Giữ thông tin thời gian sảnh, số giây từ hằng số. |
| 10 | 771 | `<details class="card dj-rules">` | `open` ở lần đầu | Cờ localStorage `ta-dojo-rules-seen` (hàm `rulesFirstTime()`): lần đầu mở sẵn, sau đó theo trạng thái thường. |
| 11 | 781, 782, 783 | `Danh hiệu PK` (h4), `danh hiệu không ảnh hưởng sức mạnh`, cột `Danh hiệu` | `Bậc chiến tích` (h4), `bậc chiến tích không ảnh hưởng sức mạnh`, cột `Bậc chiến tích` | Đúng thuật ngữ. |
| 12 | 493, 512, 558, 575, 714 | `thuần thục` (5 chỗ); `tối đa 240 điểm` | `thành thạo`; `tối đa ${M.MASTERY_MAX} điểm` | Bảng thuật ngữ cấm "thuần thục". Chỉ đổi chữ, số lấy từ hằng số. |
| 13 | 792 | `Phiếu hoàn thành ngay: nếu phiên tự hết giờ trước khi khoản cúng dường được xác nhận, khoản đó đổi thành một phiếu dùng cho phiên sau.` | `Phiếu hoàn thành ngay: phiên tự hết giờ khi khoản cúng dường chưa được xác nhận thì khoản đó thành một phiếu. Phiếu dùng được cho phiên sau.` | Tách câu dài (Q1). |
| 14 | 415 | (không có chữ hiển thị cho ba thanh Cương·Tốc·Nhu) | Dòng nhãn `Tâm đắc ba nhánh (dùng để học chiêu):` | Thêm nhãn, không đổi logic. |

Mô tả ngắn dưới tab Tâm pháp giữ nguyên ("Chạm một thời lượng để bắt đầu tu. …"): đã ngắn và rõ.

## Câu hỏi còn mở
- `SPEEDUP_PER_DAY = null` (không giới hạn); nếu sau này bật lại giới hạn theo ngày, câu ở #7 phải đọc số từ cấu hình máy chủ.
