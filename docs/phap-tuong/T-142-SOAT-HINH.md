# Soát hình T-142 · bản mẫu Ma Vương, đài sen vàng, vỏ khí

> Ngày 2026-11-14. Thợ dựng: `gpt-6.1-sol` (Ma Vương, 3 vòng), `gpt-6.1-terra` (đài sen 3 vòng, vỏ khí 1 vòng), vòng cuối đài sen do Claude Sonnet 5.5 (dự phòng). Thợ soát hình: `gemini-4-hydrogen-xhigh` (chỉ đọc, chấm theo phiếu ở [BANG-Y-TUONG.md](BANG-Y-TUONG.md) §3). Điều phối chạy Blender 5.3 và tự xem mọi ảnh.

## Kết quả

| Tài nguyên | Tam giác | `.glb` | Ngân sách | Điểm vòng 1 → 2 → 3 | Kết luận thợ soát |
|---|---:|---:|---|---|---|
| Ma Vương `demon-4.glb` | 3.530 | 250 KB | ≤ 4.000 · ≤ 300 KB | 2,50 → 3,50 → **4,00** | Đạt (vừa ngưỡng) |
| Đài sen `lotus.glb` | 808 | 36 KB | ≤ 900 · ≤ 60 KB | 2,83 → 3,67 → **3,83** (bản Sonnet) | Chưa đạt (gần ngưỡng) |
| Vỏ khí `aura-kit.glb` | 320 | 10 KB | ≤ 400 · ≤ 90 KB | không chấm riêng (chỉ là lưới trứng, hình do shader) | Điều phối nhận |

Ma Vương: 17 xương, 8 clip đúng tên, thuộc tính `COLOR_0`, `COLOR_1`, `JOINTS_0`, `WEIGHTS_0` (đọc lại từ `.glb`).

**Nhận xét riêng của Điều phối (khắt khe hơn thợ soát):** Ma Vương 3D vẫn **thua xa ảnh 2D vẽ tay** về độ dữ và chi tiết: thân còn như cái thùng, đầu tròn, vân dung nham thẳng như dây đeo. Trong game, vật liệu linh thể làm nó thành bóng đỏ trong suốt; nhìn từ sau thấy mắt và răng xuyên qua đầu (lớp phát sáng không bị che). Đài sen đã ra dáng sen khi nhìn từ trên, nhìn nghiêng cánh còn gãy góc.

## Ảnh

- Render Blender (vật liệu đục, chỉ để xem hình khối): [ban-mau-ma-vuong-4-goc.jpg](anh/ban-mau-ma-vuong-4-goc.jpg), [ban-mau-ma-vuong-tu-the.jpg](anh/ban-mau-ma-vuong-tu-the.jpg) (idle, drift, scoff, taunt1), [ban-mau-dai-sen-4-goc.jpg](anh/ban-mau-dai-sen-4-goc.jpg), [ban-mau-vo-khi-4-goc.jpg](anh/ban-mau-vo-khi-4-goc.jpg).
- Trong trình duyệt, `/world3d-fx.html` (vật liệu thật): [fx3d-truoc.jpg](anh/fx3d-truoc.jpg) (ban ngày), [fx3d-xeo.jpg](anh/fx3d-xeo.jpg), [fx3d-sau.jpg](anh/fx3d-sau.jpg) (ban đêm).
- Trong game thật, Tàng Kinh Các 3D, nhân vật thử của Điều phối (đặt công đức −1000 và hào quang bậc 5 **chỉ ở phía trình duyệt** bằng `Hall.setMerit`/`Hall.setAura` để xem): [game-ta-fx3d-bat.jpg](anh/game-ta-fx3d-bat.jpg), [game-ta-fx3d-tat.jpg](anh/game-ta-fx3d-tat.jpg).

## Phiếu chấm vòng cuối (thợ soát, nguyên văn)

## Ma Vương (cấp 4)

### Phiếu chấm 6 mục
- **1. Hình bóng và tỉ lệ khối — 4/5:** *(Tiến bộ rõ)* Hai tay đã vươn ôm về phía trước quanh trụ chủ 1,6 m, bỏ được khối ngực tròn và giữ vai rộng ~2,5 lần eo tạo dáng trùm uy nghi ở cả 4 góc, chỉ còn phần đầu hơi tròn trơn so với khối đầu–cổ vạm vỡ của ảnh ý tưởng.
- **2. Bám thiết kế — 4/5:** Có đủ cặp sừng chính cong, 2 sừng phụ giữa trán, 3 mắt, tai nhọn, miệng há có 2 răng nanh, giáp vai có gai, vòng cổ tay và bàn tay tách rõ cụm ngón vuốt cong, lược bỏ chi tiết nhỏ hợp lý trong ngưỡng 3.530 tam giác.
- **3. Màu và độ phát sáng đúng bảng màu — 4/5:** *(Tiến bộ)* Thân giữ sắc đỏ thẫm `#5a1418`, 3 mắt rực vàng `#ffc23a` và các dải mạch dung nham `#ff7a1a` liền mạch dọc ngực, tay và chữ V sau lưng, dù mép dải sáng ngực–lưng vẫn còn vài điểm lốm đốm cắt bề mặt.
- **4. Đọc được ở cỡ nhỏ (128 px) — 4/5:** *(Tiến bộ)* Khi thu nhỏ vẫn nhận ra ngay cặp sừng cong, tam giác 3 mắt sáng, hai cánh tay vươn ôm phía trước, dải chữ V phát sáng và đuôi thuôn bên dưới.
- **5. Nhìn được từ mọi phía — 4/5:** Cả 4 góc và 4 tư thế đều kín khối, không hở khe vai–cổ hay lộ ruột, mặt sau có chữ V phát sáng, chấm sống lưng và giáp vai đủ khối, chỉ còn lác đác điểm z-fighting nhỏ dọc mép dải dung nham.
- **6. Đúng chất linh thể (chấm hình khối) — 4/5:** *(Tiến bộ rõ)* Hoàn toàn không có chân, phần từ thắt lưng trở xuống thuôn thành dải đuôi khói xoắn kèm các vây khói mảnh uốn lượn ra dáng khói bay, sẵn sàng cho shader bán trong suốt và Fresnel.

**Kết luận Ma Vương:** **ĐẠT** (trung bình **4,0 / 5**, không có mục nào dưới 3).

### Nên sửa ở T-145
- **Đầu và cổ:** Đầu còn hơi tròn kiểu hình cầu; thêm gờ mày nhô `0,025 m`, vát gọn hai bên hàm dưới góc `15°` và kéo cổ cao thêm `0,05 m` (tốn thêm ~60 tam giác, vẫn dưới trần 4.000).
- **Mạch dung nham (`COLOR_1`) ngực và lưng:** Mép trên dải sáng bị lốm đốm z-fighting; đẩy offset pháp tuyến dải mạch nhô khỏi mặt thân thêm `0,004–0,006 m`.
- **Mạch sáng cẳng tay:** Đang là vạch thẳng; bẻ gãy `2` khúc lệch góc `12–15°` theo trục tay để giống vết nứt dung nham tự nhiên.
- **Đuôi khói nối thắt lưng:** Mép trên dải vây khói hơi tách nhẹ khỏi eo; kéo phần gốc vây khói lồng sâu vào lõi eo thêm `0,08 m` và thu chóp đuôi còn bán kính `≤ 0,04 m`.

---

## Đài sen vàng

### Phiếu chấm 6 mục
- **1. Hình bóng và tỉ lệ khối — 4/5:** *(Tiến bộ)* Cánh đã nở rộng hơn vòng trước tạo dáng bát sen cân đối 360° quanh gương sen phẳng đủ chỗ cho nhân vật đứng, nhưng đĩa đế tròn bên dưới vẫn loe rộng quá nhiều ra ngoài chân cánh.
- **2. Bám thiết kế (3 tầng 16/12/8, cánh bầu tròn như cánh sen, gương sen ở giữa) — 3/5:** Đủ 3 tầng `16/12/8` cánh và gương sen 13 hạt ở giữa, song ở cả góc nghiêng lẫn góc trên cánh vẫn vát cạnh thẳng nhọn kiểu hoa hướng dương/origami chứ chưa bầu tròn cong úp thìa mềm mại như cánh sen, và gương sen hơi bẹt.
- **3. Màu và độ phát sáng đúng bảng màu — 4/5:** Giữ đúng sắc vàng kim ấm của biến thể sen vàng, tách độ sáng giữa gương sen, các tầng cánh và đế (không tính phần cháy sáng do đèn render Blender).
- **4. Đọc được ở cỡ nhỏ (128 px) — 4/5:** Ở kích thước nhỏ vẫn đọc rõ đài hoa vàng 3 tầng có gương sen tròn ở tâm.
- **5. Nhìn được từ mọi phía — 4/5:** Kín khối đồng đều ở 3 góc nghiêng và góc nhìn từ trên, không có lỗ thủng hay khe hở giữa các tầng, nhưng phần chân tầng cánh trong bị gập tối sẫm tạo quầng đen quanh gương sen.
- **6. Đúng chất hiển thị (sẵn sàng nở sen và 3 biến thể vật liệu) — 4/5:** Ba tầng tách nút gọn để nở sen và gương sen phẳng tránh xuyên chân, nhưng các nếp gãy mặt phẳng trên cánh còn hơi cứng nếu áp vật liệu ngọc mờ hoặc pha lê ngũ sắc.

**Kết luận Đài sen:** **CHƯA ĐẠT** (trung bình **3,83 / 5** — dưới ngưỡng `4,0`, tuy không có mục nào dưới 3).

### Nên sửa ở T-145
- **Hình dáng cánh sen (3 tầng):** Cánh vẫn còn góc cạnh và chóp nhọn thẳng; phình rộng bụng cánh tại `45%` chiều cao thêm `18–20%`, bo cong mép cánh ở 1/3 ngọn và uốn lòng cánh khum vào tâm `12–15°` (dùng thêm tối đa ~80 tam giác từ phần dư `808/900`).
- **Đĩa đế tròn:** Đang loe quá rộng ngoài chân cánh; thu nhỏ bán kính đế lại `12–15%` để mép đế chỉ nhô khỏi vòng cánh ngoài `0,02–0,03 m`.
- **Gương sen ở giữa:** Đang hơi bẹt sát lòng đài; nâng chiều cao thành gương sen lên thêm `0,04–0,05 m` với mép vát nghiêng `10°` cho giống khối đài nhụy trong ảnh ý tưởng.
- **Độ mở tầng cánh trong và giữa:** Lòng trong cánh bị tối sẫm do góc khép gắt; mở góc dựng tầng cánh trong lên `65–72°`, tầng giữa `45–52°` và tính lại pháp tuyến mượt (`smooth shading`) cho thân cánh.
