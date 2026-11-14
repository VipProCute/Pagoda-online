# Soát hình T-204 · vòng hình 3 Pháp Tướng 3D

> Ngày 2026-11-14. Điều phối: Claude Opus 5.5. Đặc tả: [T-204-DAC-TA.md](T-204-DAC-TA.md) (cuối file có mục "Điều phối chỉnh sau khi xem trong trình duyệt").

## Ai làm gì

| Phần | Mô hình | Số vòng | Ghi chú |
|---|---|---:|---|
| A · Ma Vương (`build_demon.py`) | gpt-6.1-sol | 3 | Vòng 1: ngân sách 6.000 / 1024 px, bàn tay xòe quạt, mày liền trán, lửa vai ba lưỡi béo, màu sáng. Vòng 2: miệng hết "quả bóng đỏ", bớt vân mặt và da sần, màu đỏ rượu, vuốt dài, lửa vai thon chữ S. Vòng 3: lấy 600 tam giác từ thân cho giáp vai, sừng, vòng tay, đuôi (hết lộ mặt phẳng khi nhìn nghiêng). |
| B · Lửa hộ thân (`build_aura.py`) | gpt-6.1-sol | 2 | Vòng 1: 9 lưỡi nón thẳng (đọc ra băng). Vòng 2: trục chữ S, tiết diện elip, xoắn chung, thêm 5 lưỡi phụ, chân liền vòng. |
| B · Đài sen (`build_lotus.py`) | gpt-6.1-sol | 2 | Vòng 1: đầu cánh bầu, tầng ngoài 10°→22° (nhìn ngang thành đĩa bẹt). Vòng 2: tầng ngoài 18°→34°, mũi ngắn hơi vểnh. |
| C · JS, shader, test | gpt-6.1-sol | 1 | C1–C7 một lượt; 136 test khu vực đạt ngay. |
| Chỉnh số khi xem trình duyệt | Điều phối | — | Màu `FLAME_TONGUE`/`FLAME_RIBBON`, `SELF_STAND` (`lift` 0,5, `sideNear` 0,75). |
| Chấm hình | gpt-6.1-terra (chỉ đọc) | 2 | Lượt 2 chấm sau khi Điều phối sửa theo lượt 1. Gemini không dùng (proxy 403). |

Không phải xuống bậc mô hình: sol và terra trả lời bình thường cả phiên.

## Số liệu cuối (Điều phối tự đo: `RESULT` của Blender và header `.glb`)

| Tài nguyên | Tam giác | `.glb` | Ảnh nhúng |
|---|---:|---:|---|
| `demon-4.glb` | 6.000 (`demon_body` 5.424, `demon_flame` 576; `front_head_tris` 1.881) | 1.184.020 byte (~1,13 MB) | 3 JPEG 1024×1024: màu 165 KB (chất lượng 90), pháp tuyến 486 KB (97), phát sáng 89 KB (90); có `TANGENT` |
| `aura-kit.glb` (`flames`) | 1.056 (9 × 84 + 5 × 60) | 33,7 KB | không |
| `lotus.glb` | 1.200 (512 / 384 / 256 / 48) | 40,4 KB | không (màu ở `COLOR_0`) |

17 xương `MaVuongRig`, 8 clip giữ nguyên tên và thời lượng; tên nút `demon_body`, `demon_flame`, xương `neck`, `head` giữ nguyên. Không có đường dẫn máy trong JSON `.glb`.

## Đã kiểm tận mắt trong trình duyệt (máy chủ cổng riêng, `ta-fx3d` bật)

Khung Browser của ứng dụng bị ẩn nên không vẽ WebGL; Điều phối chụp bằng Playwright không giao diện có GPU thật (Vulkan, 60 khung/giây). Nhân vật thử có công đức −1.000 (Ma Vương) và hào quang bậc 5. Cặp ảnh bật/tắt chụp **trong cùng một phiên, cùng chỗ đứng, cùng góc**: tắt `ta-fx3d` rồi bấm "Người cũ" hai lần để cảnh dựng lại.

- **Tàng Kinh Các** ([game-ta-fx3d-bat.jpg](anh/game-ta-fx3d-bat.jpg) so [game-ta-fx3d-tat.jpg](anh/game-ta-fx3d-tat.jpg)): quỷ gọn trong khung, mặt ba mắt, sừng, nanh, vuốt xòe đọc rõ trên đầu nhân vật; lửa hộ thân xanh nằm dưới vai, không che đầu nhân vật hay mặt quỷ; đài sen 3D dưới chân.
- **Sân đấu** ([game-san-dau.jpg](anh/game-san-dau.jpg) so [game-san-dau-tat.jpg](anh/game-san-dau-tat.jpg); thêm [game-san-dau-sat.jpg](anh/game-san-dau-sat.jpg) ở chỗ xuất hiện có máy quay sát hơn): quỷ của mình nằm trọn dưới bảng "Sân đang vắng", lệch trái, mặt không bị đầu chủ che. Bản 2D cùng góc bị bảng che sừng và trán.
- **Máy quay sát chủ (< 0,6 m):** chỉ kiểm bằng test (`world3d-fx.test.js`, `stand-math.test.js`): quỷ giữ chỗ đứng gần nhất, cỡ `scaleNear`, độ rõ giảm tới `fadeMin` 0,25. Chưa tạo được tình huống này trong game thật.
- Trang thử: [fx3d-truoc.jpg](anh/fx3d-truoc.jpg), [fx3d-xeo.jpg](anh/fx3d-xeo.jpg), [fx3d-sau.jpg](anh/fx3d-sau.jpg), [fx3d-dem.jpg](anh/fx3d-dem.jpg) (ban đêm quỷ vẫn đỏ, mắt và vân sáng), [fx3d-sen-lua-gan.jpg](anh/fx3d-sen-lua-gan.jpg) (sen + lửa nhìn gần), [fx3d-can-mat.jpg](anh/fx3d-can-mat.jpg) (cắt từ ảnh Tàng Kinh Các). Lửa vai trong game là cam rực có sợi lửa, không còn màu kem.
- Blender: [ban-mau-ma-vuong-4-goc.jpg](anh/ban-mau-ma-vuong-4-goc.jpg), [ban-mau-ma-vuong-can-mat.jpg](anh/ban-mau-ma-vuong-can-mat.jpg), [ban-mau-ma-vuong-tu-the.jpg](anh/ban-mau-ma-vuong-tu-the.jpg), [ban-mau-ma-vuong-128px.jpg](anh/ban-mau-ma-vuong-128px.jpg), [ban-mau-vo-khi-4-goc.jpg](anh/ban-mau-vo-khi-4-goc.jpg) (lửa hộ thân), [ban-mau-dai-sen-4-goc.jpg](anh/ban-mau-dai-sen-4-goc.jpg). Lửa vai trong ảnh Blender là vật liệu xem thử nên trông như mảng cam đặc; trong game là shader lửa.
- Ảnh cũ không chụp lại: `fx3d-alpha-thap.jpg`, `fx3d-emerge.jpg` (T-203), `fx3d-ngang.jpg`, `fx3d-tu-the.jpg`, `game-quy-minh-cover.jpg` (T-154).
- Chỉ thấy bậc 5 (bậc duy nhất dùng lửa 3D, `AURA_3D_TIERS = [5]`); màu theo bậc có test đổi `uColor` theo `state.color`, chưa chụp các bậc khác.

## Điểm chấm (gpt-6.1-terra, khắt khe, so trực tiếp với ảnh 2D)

Nguyên văn kết luận lượt 2 (sau khi Điều phối sửa theo lượt 1, trước bản chỉnh `sideNear` cuối cùng):

| Hạng mục | Lượt 1 | Lượt 2 | T-203 |
|---|---|---|---:|
| Ma Vương | dáng 3 · mặt 3 · tay 2,5 · giáp vai 2,5 · lửa vai 2 · chất liệu 2,5 (TB 2,58) | dáng 3 · mặt 3 · tay 2,5 · giáp vai 2,5 · lửa vai 2 · chất liệu 2,5 (TB 2,58) | 2,58 |
| Đài sen | nhìn ngang 2,5 · dáng cánh 3 · màu 3,5 (TB 3,0) | nhìn ngang 3,5 · dáng cánh 3 · màu 3,5 (TB 3,33) | 3,33 |
| Lửa hộ thân | đọc ra lửa 2 · màu 2 · không che 4,5 (TB 2,83) | đọc ra lửa 2,5 · màu 2,5 · không che 4,5 (TB 3,17) | 2,67 (vỏ khí) |
| Trong game | bố cục 2,5 · **KÉM 2D** | bố cục 2,5 · **KÉM 2D** | kém 2D |

Terra lượt 2: "**CHƯA ĐẠT**". Ba việc nên sửa: (1) bố cục Sân đấu khi máy quay sát (quỷ nhỏ, bị đầu và hào quang của chủ che), kiểm nhiều chỗ xuất hiện; (2) bàn tay mở, ngón vuốt và khối vai–thân rõ hơn ở cỡ thật trong game; (3) lửa hộ thân và lửa vai bớt giống băng/gai, gốc lửa không gần trắng. Terra cũng ghi: "Bản 2D cũng bị cắt mạnh ở Sân đấu, nên không xem đó là ưu điểm của 2D."

Việc (1) Điều phối đã sửa sau lượt 2 (`sideNear` 0,75, ảnh [game-san-dau.jpg](anh/game-san-dau.jpg), [game-san-dau-sat.jpg](anh/game-san-dau-sat.jpg)); terra chưa chấm lại bản này.

## Điều phối tự chấm (thang 5, so với ảnh 2D)

| Hạng mục | Điểm | Lý do |
|---|---:|---|
| Ma Vương | 3 | Bàn tay xòe, mặt ba mắt, miệng sâu, màu đỏ rượu đúng hướng; vẫn mịn kiểu nhựa, thiếu độ chi tiết và vẻ hung tợn của tranh vẽ tay. |
| Đài sen | 3,5 | Nhìn chéo từ trên đọc ra sen rõ; nhìn ngang đúng 0° vẫn hơi dẹt. |
| Lửa hộ thân | 3 | Hết lọ kính, không che mặt quỷ/đầu người, có sợi lửa chuyển động; màu bậc 5 vốn nhạt nên vẫn hơi gợi lửa băng. |
| Trong game | 3 | Tàng Kinh Các: ngang mức đọc của 2D nhưng kém về chi tiết. Sân đấu: bố cục 3D tốt hơn 2D (2D bị bảng che sừng/trán). |

**Kết luận thẳng:** bản 3D trong game đã hết các lỗi bố cục lớn của T-203, nhưng tổng thể vẫn **KÉM bản 2D** về độ chi tiết và sức hút (terra và Điều phối cùng nhận định). Công tắc `ta-fx3d` nên tiếp tục mặc định tắt.

## Câu hỏi cho chủ dự án

- Với lối "điêu khắc bằng mã" ở 6.000 tam giác, Ma Vương đã gần trần. Muốn ngang tranh 2D có lẽ cần người dựng tay (Blender điêu khắc thật) hoặc chấp nhận phong cách 3D đơn giản hơn tranh.
- Lửa hộ thân chỉ dùng cho bậc 5 (xanh nhạt). Có muốn mở cho các bậc khác để thấy màu bậc đậm hơn không?
- Đài sen nhìn ngang 0° vẫn dẹt: chấp nhận vì góc nhìn game luôn từ trên xuống, hay làm thêm vòng?
