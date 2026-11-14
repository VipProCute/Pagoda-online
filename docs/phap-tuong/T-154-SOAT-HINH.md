# Soát hình T-154 · nâng chất bản mẫu Pháp Tướng 3D

> Ngày 2026-11-14. Điều phối: Claude Opus 5.5. Đặc tả: [T-154-DAC-TA.md](T-154-DAC-TA.md).

## Ai làm gì

| Lượt | Mô hình | Việc |
|---|---|---|
| Ma Vương vòng 1, sen vòng 1 | Claude Sonnet 5.5 | Viết lại `build_demon.py` theo lối "điêu khắc bằng mã" (lưới cao ~330.000 tam giác → decimate → bake màu, pháp tuyến, phát sáng 512 px); sen vòng 1 |
| Ma Vương vòng 2–4, sen vòng 2–4 | gpt-6.1-sol (Codex CLI) | Mỗi vòng Điều phối chạy Blender, tự nhìn ảnh, đính kèm ảnh mới + ảnh 2D + nhận xét cho lượt sau |
| Shader, JS, test vòng 1–2 | gpt-6.1-sol | C1–C9 trong đặc tả; vòng 2 sửa viền Fresnel và vỏ khí ba lớp |
| Chỉnh số khi xem trình duyệt | Điều phối | Phần mảnh của vỏ khí (`flameShellMaterial`), chỗ đứng quỷ của mình (`SELF_SIDE`), một dòng `delaunay_2d_cdt` trong `build_lotus.py` |
| Soát hình | gpt-6.1-terra (chỉ đọc) | `gemini-4-argon-high`, `hydrogen`, `flash` đều trả **403 TOS_VIOLATION** (tài khoản Gemini của proxy bị khóa) nên chuyển sang terra, mô hình không tham gia dựng |

## Số liệu cuối

| Tài nguyên | Tam giác | `.glb` | Ảnh nhúng |
|---|---:|---:|---|
| `demon-4.glb` | 3.994 (thân 3.858, lửa 136) | 461 KB | 3 ảnh JPEG 512×512 (màu, pháp tuyến, phát sáng) |
| `lotus.glb` | 1.196 | 41,5 KB | không (màu ở `COLOR_0`) |

## Đã kiểm tận mắt trong trình duyệt

- Thân quỷ **đặc**, đỏ rượu tối, vết nứt và ba mắt phát sáng; không còn phủ cam (lỗi Fresnel dùng pháp tuyến đã bị ảnh pháp tuyến làm nhiễu, đã sửa bằng `nonPerturbedNormal`).
- Nhìn từ sau **không thấy** mắt, răng ([fx3d-sau.jpg](anh/fx3d-sau.jpg)).
- Độ rõ 0,12: bóng mờ, ba mắt sáng ([fx3d-alpha-thap.jpg](anh/fx3d-alpha-thap.jpg)).
- Vỏ khí bậc 5: viền đứt thành sợi lửa xanh, lưỡi lửa ở mép trên, giữa thân trong ([fx3d-dem.jpg](anh/fx3d-dem.jpg)); ban ngày trên nền sáng, cộng sáng làm lửa nhạt về trắng vàng ([fx3d-truoc.jpg](anh/fx3d-truoc.jpg)).
- Clip: `scoff` (vái), `peek` (nói), `drift` (đi) ([fx3d-tu-the.jpg](anh/fx3d-tu-the.jpg)); `emerge` chưa bắt được khung vì khung trình duyệt bị ẩn, ảnh chụp chậm một bước.
- Game thật, Tàng Kinh Các: [game-ta-fx3d-tat.jpg](anh/game-ta-fx3d-tat.jpg) và [game-ta-fx3d-bat.jpg](anh/game-ta-fx3d-bat.jpg) cùng chỗ; quỷ của mình phương án `cover` ([game-quy-minh-cover.jpg](anh/game-quy-minh-cover.jpg)): máy quay nằm trong thân quỷ nên gần như không thấy quỷ. Phương án `side` (mặc định) thấy quỷ lấp ló bên vai trái nhưng to, bị cắt mép khung, và chỉ thấy lưng quỷ.
- Sân đấu: [game-san-dau.jpg](anh/game-san-dau.jpg), vỏ khí và quỷ hiện, khoảng cách và suất đã truyền.

## Điểm chấm (gpt-6.1-terra, khắt khe, so trực tiếp với ảnh 2D)

| Hạng mục | Trung bình 6 mục | So với ảnh 2D | Kết luận |
|---|---:|---:|---|
| Ma Vương | 2,67 | 2/5 | Chưa đạt |
| Đài sen | 2,83 | 3/5 | Chưa đạt |
| Vỏ khí bậc 5 | 2/5 | | "Vẫn chủ yếu là quả trứng có vệt sáng" |
| Trong game, 3D so với 2D | | | **3D còn kém 2D**: thân tối, mặt quay khuất (góc thứ ba nhìn lưng quỷ), bị cắt mép |

Điều phối tự chấm (thang 5, so với ảnh 2D): Ma Vương 3, đài sen 3,5, vỏ khí 3. Hơn hẳn đợt 0 (bóng đỏ trong suốt, nhìn xuyên, trứng thủy tinh) nhưng **chưa ngang ảnh 2D vẽ tay**.

## Còn xấu, gợi ý nếu làm tiếp

- Ma Vương: mặt còn gãy đa giác khi nhìn gần, tay chưa đủ to và xòe như ảnh 2D, giáp vai chưa chạm nổi; ban đêm thân hơi tối (có thể thêm đèn viền nhẹ hoặc nâng màu nền).
- Bản chất "linh thể nhìn cùng hướng chủ": ở góc thứ ba người chơi chỉ thấy lưng quỷ của mình; ảnh 2D luôn quay mặt về máy quay nên luôn "dữ" hơn. Cần chủ dự án quyết hướng.
- Đài sen: cánh còn đều máy móc, thiếu quầng sáng mép như ảnh 2D.
- Vỏ khí: silhouette tổng vẫn là elip; muốn ra hình ngọn lửa như ảnh ý tưởng cần lưới vỏ khác (đỉnh nhọn, nhiều lớp so le) trong `build_aura.py`, ngoài phạm vi thẻ này.
