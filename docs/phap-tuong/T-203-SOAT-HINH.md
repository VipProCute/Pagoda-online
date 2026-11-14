# Soát hình T-203 · vòng hình 2 Pháp Tướng 3D

> Ngày 2026-11-14. Điều phối: Claude Opus 5.5. Đặc tả: [T-203-DAC-TA.md](T-203-DAC-TA.md) (cuối file có mục "Điều phối chỉnh sau khi xem trong trình duyệt").

## Ai làm gì

| Phần | Mô hình | Số vòng | Ghi chú |
|---|---|---:|---|
| A · Ma Vương (`build_demon.py`) | gpt-6.1-sol | 3 | Vòng 1: tay, bàn tay, đầu to hơn, lửa ống kín, TANGENT. Vòng 2: mày chữ V, hốc mắt sâu, sọ tròn, pháp tuyến JPEG 512 chất lượng 97. Vòng 3: làm mượt mặt lưới thấp, lửa chữ S. Giữ vòng 3 (mặt mượt hơn vòng 2 một chút). |
| B · Đài sen + lưới vỏ khí | gpt-6.1-sol | 3 | Sen: vòng 1 mảnh ngũ giác, vòng 2 tròn như mẫu đơn, vòng 3 cánh giọt nước đọc ra hoa sen. Vỏ khí: vòng 1 chuông + gai, vòng 2 giọt nước + gai, vòng 3 giọt nước + sáu thùy liền. |
| C · JS, shader, test | gpt-6.1-sol | 1 | C1–C9 một lượt, test khu vực đạt ngay. |
| Chỉnh số khi xem trình duyệt | Điều phối | — | Chỗ đứng và cỡ quỷ của mình theo khoảng cách máy quay, trộn thường cho vỏ khí/lửa, tự sáng nhẹ cho linh thể, hạ kiểm 4:4:4 thành cảnh báo. |
| Chấm hình | gpt-6.1-terra (chỉ đọc) | 1 | Không tham gia dựng. Gemini không dùng (proxy 403). |

Không phải xuống bậc mô hình: sol và terra đều trả lời bình thường.

## Số liệu cuối (Điều phối tự đo bằng `RESULT` của Blender và đọc header `.glb`)

| Tài nguyên | Tam giác | `.glb` | Ảnh nhúng |
|---|---:|---:|---|
| `demon-4.glb` | 4.000 (`front_head_tris` 1.043) | 565 KB (578.668 byte) | 3 JPEG 512×512: màu 46 KB, pháp tuyến 160 KB (chất lượng 97, 4:2:0), phát sáng 22 KB; thêm `TANGENT` |
| `lotus.glb` | 1.200 (512 / 384 / 256 / 48) | 40,4 KB | không (màu ở `COLOR_0`) |
| `aura-kit.glb` | 400 | 10,9 KB | không |

17 xương, 8 clip giữ nguyên tên và thời lượng.

## Đã kiểm tận mắt trong trình duyệt (máy chủ cổng riêng, `ta-fx3d` bật)

- **Quỷ của mình ngoái mặt:** ở góc nhìn thứ ba, quỷ đứng bên kia chủ so với máy quay, lệch trái màn hình, thân xoay 3/4, đầu (xương `neck`/`head`) ngoái về máy quay. Tàng Kinh Các: cả con nằm gọn trong khung, mặt và sừng ở trên đầu nhân vật ([game-ta-fx3d-bat.jpg](anh/game-ta-fx3d-bat.jpg) so với [game-ta-fx3d-tat.jpg](anh/game-ta-fx3d-tat.jpg), cùng chỗ, cùng góc). Quỷ của NPC vẫn quay theo chủ.
- Máy quay mặc định trong phòng bị tường ép: Tàng Kinh Các ~3,1 m, Sân đấu ~1 m. Quỷ tự thu nhỏ còn 0,45 lần khi máy quay sát người; Sân đấu vẫn bị bảng "Sân đang vắng" và mép trên che một phần sừng ([game-san-dau.jpg](anh/game-san-dau.jpg)).
- **Nhãn tên** không bị thân quỷ cắt, không bị lửa đè, kể cả nhìn từ sau ([fx3d-sau.jpg](anh/fx3d-sau.jpg)). Nhìn từ sau, lửa vai ra lưỡi lửa cam, không còn vệt trắng.
- **Độ rõ 0,12:** bóng mờ, ba mắt sáng, nhãn không bị che ([fx3d-alpha-thap.jpg](anh/fx3d-alpha-thap.jpg)).
- **Ban đêm:** thân quỷ đỏ, không chìm đen ([fx3d-dem.jpg](anh/fx3d-dem.jpg)).
- **Clip `emerge`:** bắt được một khung giữa lúc trồi lên, quỷ nhỏ và thấp hơn tư thế chờ ([fx3d-emerge.jpg](anh/fx3d-emerge.jpg)).
- **Hạt:** đốm tròn mềm, hết ô vuông. **Vỏ khí:** xanh lam theo màu bậc, không cháy trắng; máy quay gần dưới ~1 m thì vỏ mờ đi.
- Ảnh khác: [fx3d-truoc.jpg](anh/fx3d-truoc.jpg), [fx3d-xeo.jpg](anh/fx3d-xeo.jpg), [fx3d-can-mat.jpg](anh/fx3d-can-mat.jpg); Blender: [ban-mau-ma-vuong-4-goc.jpg](anh/ban-mau-ma-vuong-4-goc.jpg), [ban-mau-ma-vuong-can-mat.jpg](anh/ban-mau-ma-vuong-can-mat.jpg), [ban-mau-ma-vuong-128px.jpg](anh/ban-mau-ma-vuong-128px.jpg), [ban-mau-ma-vuong-tu-the.jpg](anh/ban-mau-ma-vuong-tu-the.jpg), [ban-mau-dai-sen-4-goc.jpg](anh/ban-mau-dai-sen-4-goc.jpg), [ban-mau-vo-khi-4-goc.jpg](anh/ban-mau-vo-khi-4-goc.jpg).
- Ảnh cũ của T-154 không chụp lại: `fx3d-ngang.jpg`, `fx3d-tu-the.jpg`, `game-quy-minh-cover.jpg`.

## Điểm chấm (gpt-6.1-terra, khắt khe, so trực tiếp với ảnh 2D)

| Hạng mục | Điểm từng mục | Trung bình | T-154 |
|---|---|---:|---:|
| Ma Vương | dáng 3 · mặt 2,5 · tay 2,5 · giáp vai 3 · lửa vai 2 · chất liệu 2,5 | 2,58 | 2,67 |
| Đài sen | đọc ra sen 4 · dáng cánh 3 · màu 3 | 3,33 | 2,83 |
| Vỏ khí | dáng lửa 2 · màu 3 · không che người 3 | 2,67 | 2 |
| Trong game | ngoái mặt và khung 3 · nhãn tên 4 · tổng thể **kém hơn 2D** | | kém hơn 2D |

Kết luận của terra: **CHƯA ĐẠT**. Ba việc nên sửa: (1) bố cục trong game: góc máy sát tường và vỏ khí che mặt quỷ; (2) mặt và bàn tay Ma Vương (bàn tay đọc ra nắm đấm có gai, chưa xòe ngón); (3) vỏ khí và lửa vai còn cứng, nhọn.

Điều phối tự chấm (thang 5, so với ảnh 2D): Ma Vương 3, đài sen 3,5, vỏ khí 3, trong game 3. Hướng mặt và khung hình đã khắc phục được lỗi lớn nhất của T-154 (chỉ thấy lưng, bị cắt mép), nhưng ảnh 2D vẽ tay vẫn chi tiết và dữ hơn rõ rệt.

## Còn xấu, câu hỏi cho chủ dự án

- Mặt Ma Vương còn gãy mặt phẳng khi nhìn gần; bàn tay xòe chưa rõ ngón. Ở 4.000 tam giác và ảnh 512 px, lối "điêu khắc bằng mã" đã gần trần; muốn ngang ảnh 2D có lẽ cần nới ngân sách (ví dụ 6.000 tam giác, ảnh 1024 px) hoặc người dựng tay.
- Vỏ khí bậc 5 trộn thường giữ được màu nhưng trông như lớp kính mỏng; cộng sáng rực hơn nhưng ngả trắng trên nền sáng. Cần chủ dự án chọn hướng.
- Máy quay góc thứ ba trong phòng hẹp và Sân đấu đứng rất sát người (1–3 m), làm mọi hiệu ứng sau lưng (cả 2D) bị to và cắt. Có nên nới giới hạn máy quay hoặc cho quỷ của mình mờ hơn khi máy quay sát?
- Nhãn tên của người có hiệu ứng 3D tắt kiểm chiều sâu nên hiện xuyên tường. Chấp nhận được không?
