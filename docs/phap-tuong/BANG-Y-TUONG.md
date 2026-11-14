# Bảng ý tưởng hình · Pháp Tướng 3D (T-140)

> Ảnh ý tưởng do AI vẽ, **chỉ để tham chiếu nội bộ** cho người dựng mô hình (không đưa vào `public/`). Thiết kế riêng của Chùa Tâm An, lấy ảnh 2D đang có trong `public/img/fx/` làm ảnh tham chiếu; lời nhắc không nêu tên nhân vật hay tác phẩm nào khác.
> Thiết kế chung: [KE-HOACH-PHAP-TUONG-3D.md](../KE-HOACH-PHAP-TUONG-3D.md) §1.

## 1. Ảnh

| Ảnh | Nội dung | Ảnh tham chiếu đưa kèm |
|---|---|---|
| [anh/y-tuong-quy-1.jpg](anh/y-tuong-quy-1.jpg) | Tiểu Quỷ: trước / nghiêng / sau | `public/img/fx/demon-1.webp` |
| [anh/y-tuong-quy-2.jpg](anh/y-tuong-quy-2.jpg) | Ác Quỷ: trước / nghiêng / sau | `public/img/fx/demon-2.webp` |
| [anh/y-tuong-quy-3.jpg](anh/y-tuong-quy-3.jpg) | Quỷ Vương: trước / nghiêng / sau | `public/img/fx/demon-3.webp` |
| [anh/y-tuong-quy-4.jpg](anh/y-tuong-quy-4.jpg) | Ma Vương: trước / nghiêng / sau | `public/img/fx/demon-4.webp` |
| [anh/y-tuong-dai-sen.jpg](anh/y-tuong-dai-sen.jpg) | Đài sen: nghiêng 30° + từ trên (vàng); hàng dưới ba biến thể vàng, hồng, pha lê | `public/img/fx/aura/lotus-gold.webp` |
| [anh/y-tuong-hao-quang.jpg](anh/y-tuong-hao-quang.jpg) | Hào quang: bậc 1 (vỏ khí mỏng + dải khí lành), bậc 5 (thần quang xanh hai lớp + sen vàng + vầng sáng), bậc 6 (thêm quang bối trời sao) | `public/img/fx/aura/mandorla-violet.webp` |

- **Mô hình:** `gpt-image-2.6` qua CLIProxyAPI, gọi `/v1/images/edits` (đưa ảnh tham chiếu), cỡ 1536×1024, ngày **2026-11-14**. Ảnh gốc PNG ~1,8 MB được thu còn 75% và lưu JPEG chất lượng 80 (~100 KB mỗi ảnh). Không cần dự phòng `gemini-3.1-flash-image`.
- **Nhận xét của Điều phối (xem tận mắt):** cả 6 ảnh đúng bố cục yêu cầu. Quỷ cấp 1 đầu to, đuôi khói; cấp 2 cánh dơi, khoanh tay; cấp 3 vương miện sừng, giáp vai, lửa tím; cấp 4 ba mắt, tay xòe. Đài sen ra đúng ba tầng cánh và ba biến thể. Ảnh hào quang cho thấy rõ vỏ khí ôm người từ mọi phía. Ảnh Ma Vương nền trong suốt nên khi lưu JPEG nền thành xám nhạt. Ảnh ý tưởng nhiều chi tiết vảy, khắc chạm: người dựng chỉ lấy khối lớn (xem nhận xét ở §4).
- **Lệch nhỏ so với 2D:** cấp 2 có thêm vương miện nhỏ giữa trán; cấp 1 có hoa văn đỏ trên đầu. Chấp nhận, không bắt buộc dựng.

## 2. Lời nhắc đã dùng

Mỗi lời nhắc gửi kèm đúng một ảnh tham chiếu ở bảng trên.

### Quỷ cấp 4

```text
Character turnaround concept sheet for an original 3D game asset, on a plain light grey background. Use the attached image as the design reference for the creature's face, horns, skin and claws, and keep that design.
Subject: a giant demon king guardian spirit, three eyes (third eye in the middle of the forehead), large curved horns, heavy shoulders, both arms open wide with long dark claws. Only the UPPER BODY is solid (head, horns, chest, shoulders, arms, hands); from the waist down the body dissolves into a tail of dark red smoke and embers that narrows to a point. No legs.
Show THREE views side by side, same scale, same pose, aligned on a horizontal line: FRONT view (left), SIDE view facing right (middle), BACK view (right). Neutral even lighting so the 3D form is readable; semi-translucent body with a glowing orange rim; eyes and lava cracks emit light.
Strict color palette: deep crimson skin #5a1418, molten lava cracks #ff7a1a, glowing eyes #ffc23a, dark horn color, smoke dark red to black.
Style: stylized game art for a low-poly real-time model, clear silhouette, readable at small size. No text, no labels, no watermark, no frame.
```

### Quỷ cấp 1

```text
Character turnaround concept sheet for an original 3D game asset. Use the attached image as the design reference for the creature and keep that design.
Subject: a small mischievous imp guardian spirit (about 45 cm tall), oversized head, big glowing yellow eyes, small horns, cheeky grin, tiny clawed hands, tail of red smoke. Palette: deep crimson skin #5a1418, glowing eyes #ffc23a, ember accents #ff7a1a.
Show THREE views side by side, same scale, same pose, aligned on a horizontal line: FRONT view (left), SIDE view facing right (middle), BACK view (right). Only the UPPER BODY is solid; from the waist down the body dissolves into a tail of smoke and embers that narrows to a point. No legs. Neutral even lighting so the 3D form is readable; semi-translucent body with a glowing rim; eyes emit light. Stylized game art for a low-poly real-time 3D model, clear silhouette, readable at small size. Plain light grey background. No text, no labels, no watermark, no frame.
```

### Quỷ cấp 2

```text
Character turnaround concept sheet for an original 3D game asset. Use the attached image as the design reference for the creature and keep that design.
Subject: a fierce winged demon guardian spirit, curved horns, bat wings folded half open behind the shoulders, sharp claws, arms crossed in a waiting pose. Palette: deep crimson skin #5a1418, lava cracks #ff7a1a, glowing eyes #ffc23a, dark membrane wings.
Show THREE views side by side, same scale, same pose, aligned on a horizontal line: FRONT view (left), SIDE view facing right (middle), BACK view (right). Only the UPPER BODY is solid; from the waist down the body dissolves into a tail of smoke and embers that narrows to a point. No legs. Neutral even lighting so the 3D form is readable; semi-translucent body with a glowing rim; eyes emit light. Stylized game art for a low-poly real-time 3D model, clear silhouette, readable at small size. Plain light grey background. No text, no labels, no watermark, no frame.
```

### Quỷ cấp 3

```text
Character turnaround concept sheet for an original 3D game asset. Use the attached image as the design reference for the creature and keep that design.
Subject: a demon lord guardian spirit wearing a crown of horns and heavy shoulder armor, arms crossed, surrounded by wrapping purple-black flames. Palette: deep crimson skin #5a1418, flames #3a1450 and #8a3cff, glowing eyes #ffc23a, dark metal armor.
Show THREE views side by side, same scale, same pose, aligned on a horizontal line: FRONT view (left), SIDE view facing right (middle), BACK view (right). Only the UPPER BODY is solid; from the waist down the body dissolves into a tail of smoke and embers that narrows to a point. No legs. Neutral even lighting so the 3D form is readable; semi-translucent body with a glowing rim; eyes emit light. Stylized game art for a low-poly real-time 3D model, clear silhouette, readable at small size. Plain light grey background. No text, no labels, no watermark, no frame.
```

### Đài sen

```text
Concept sheet for an original 3D game asset: a lotus throne (lotus pedestal) that a person stands on. Use the attached image as the design reference for the petal shape and gold color.
Structure: a thin round base disc, then THREE rings of petals: 16 large outer petals, 12 middle petals, 8 inner petals, and a flat seed-pod platform in the center where the feet stand. Petals are thick, smooth, slightly cupped, tips pointing up and out.
Layout: top row shows the GOLD variant twice: a 30-degree elevated three-quarter view (left) and a straight top-down view (right). Bottom row shows the same 30-degree view in three material variants side by side: warm polished gold metal, translucent pink jade, and iridescent rainbow crystal.
Stylized game art for a low-poly real-time model, clean shapes, soft glow along the petal edges. Plain light grey background. No text, no labels, no watermark, no frame.
```

### Hào quang

```text
Concept sheet for an original 3D game visual effect: a protective energy aura that wraps around a standing person in traditional Vietnamese long robe (simple neutral figure, hands joined in prayer).
The aura is an egg-shaped translucent shell of flame-like light enclosing the whole body, brighter at the edges (rim glow), with the top edge flickering upward like flames. Seen from any side it wraps around the body, not a flat backdrop.
Layout: three panels side by side, all three-quarter front view: LEFT tier 1 "qi" aura: thin, soft mint green #bfe6d4 shell with three floating ribbon-like wisps of qi circling the body in 3D (some in front of the body, some behind). MIDDLE tier 5 "divine light": a tall double-layer blue flame shell #8fd3ff rising well above the head, standing on a golden lotus pedestal, a small golden halo behind the head. RIGHT tier 6: same as middle plus a large round mandorla disc behind the back with a deep starry night sky inside, violet #b39cff rim.
Stylized game art for a real-time 3D effect, additive glow, readable silhouette. Plain dark grey background. No text, no labels, no watermark, no frame.
```

## 3. Phiếu chấm hình (dùng ở T-142, T-145 đến T-149)

Do `gemini-4-hydrogen-xhigh` soạn (chạy qua Codex CLI, `--sandbox read-only`, có đính kèm ảnh Ma Vương), Điều phối giữ nguyên nội dung. Thang 1 đến 5; **đạt khi trung bình ≥ 4 và không mục nào dưới 3**. Mục 1 và 2 viết cho Ma Vương; với cấp quỷ khác, đài sen hay hào quang thì thay đặc điểm nhận diện theo KE-HOACH-PHAP-TUONG-3D §1.

### 1. Hình bóng và tỉ lệ khối
- **Câu hỏi kiểm:** Khung dáng tổng thể ở cả 4 góc (vai rộng, eo thon, tay xòe ôm, đầu đội sừng, đuôi khói bên dưới) có đúng tỉ lệ uy nghi của ảnh ý tưởng và ảnh 2D gốc không?
- **Mức 1:** Hình bóng bị méo nặng so với ảnh mẫu, bề ngang vai chỉ tương đương hoặc hẹp hơn hông, đầu quá to/nhỏ trên 30% hoặc hai tay dính sát thân mất dáng xòe ôm.
- **Mức 3:** Nhận ra đúng dáng nửa thân trên vai rộng – eo thuôn và đuôi khói bên dưới, nhưng tỉ lệ đầu/tay/sừng lệch khoảng 15–25% hoặc góc ngang thấy ngực phẳng, thiếu độ ưỡn và độ vươn tay về trước.
- **Mức 5:** Đường viền hình bóng khớp ảnh ý tưởng ở cả 4 góc với vai rộng gấp ~2,5 lần eo, tay xòe vươn về trước ôm lấy vùng đứng của chủ, đầu và sừng cân đối đúng chiều cao mục tiêu (~2,8 m cho Ma Vương).

### 2. Bám thiết kế (sừng, mắt, tay, đặc điểm riêng)
- **Câu hỏi kiểm:** Các chi tiết nhận diện cốt lõi của cấp quỷ (cặp sừng lớn cong + sừng phụ, 3 mắt, tai nhọn, hàm răng nanh, giáp vai, bàn tay có vuốt) có đủ số lượng và đúng vị trí không?
- **Mức 1:** Thiếu hoặc sai vị trí từ 2 đặc điểm nhận diện trở lên (ví dụ thiếu mắt thứ ba, chỉ có 1 cặp sừng đơn, bàn tay thành khối cụt không phân ngón/vuốt hoặc sừng mọc sai trục).
- **Mức 3:** Đủ các bộ phận nhận diện chính (cặp sừng cong, 3 mắt đúng hàng trán–mặt, giáp vai, tay có ngón vuốt), nhưng khối còn thô cứng, sừng phụ/tai/hàm hoặc khe ngón bị dính khối nhẹ ở góc nghiêng 45°.
- **Mức 5:** Đủ 100% đặc điểm nhận diện chính đặt đúng giải phẫu trên cả 4 góc, cặp sừng cong vút đối xứng, 3 mắt rõ tách biệt, giáp vai nổi khối và mỗi bàn tay tách rõ cụm ngón vuốt cong gập tự nhiên.

### 3. Màu và độ phát sáng đúng bảng màu
- **Câu hỏi kiểm:** Tông màu thân, vết nứt dung nham và mắt phát sáng có bám đúng bảng màu 2D (`#5a1418` đỏ thẫm, `#ff7a1a` dung nham, `#ffc23a` mắt, hoặc `#3a1450`/`#8a3cff` cho lửa cấp 3) và nổi rõ trên nền tối không?
- **Mức 1:** Màu da trôi sang đỏ tươi/cam/xám bệt khác hẳn `#5a1418`, hoặc mắt và vết nứt tối mờ không có độ phát sáng (kênh `COLOR_1` không tách biệt khỏi nền thân).
- **Mức 3:** Thân đúng tông đỏ sẫm và mắt/vết nứt có phát sáng vàng–cam, nhưng độ tương phản giữa da tối và mạch dung nham chưa đủ gắt hoặc vết nứt bị loang to quá 15% diện tích thân.
- **Mức 5:** Thân giữ đúng sắc đỏ thẫm `#5a1418` tạo độ sâu khối, 3 mắt rực vàng `#ffc23a` và các đường nứt dung nham sắc nét màu `#ff7a1a` tự phát sáng nổi bật ngay cả khi tắt đèn cảnh.

### 4. Đọc được ở cỡ nhỏ (ảnh thu còn 128 px)
- **Câu hỏi kiểm:** Khi thu ảnh render về kích thước 128×128 px (tương đương nhân vật đứng xa trên màn hình), người xem có nhận ra ngay hình thù, hướng mặt và cấp quỷ không?
- **Mức 1:** Ở cỡ 128 px toàn bộ mô hình bết thành một đốm đỏ–đen khó phân biệt đâu là đầu, đâu là tay hay đuôi khói.
- **Mức 3:** Ở cỡ 128 px nhận ra dáng quỷ nửa thân có sừng và hai điểm sáng của mắt, nhưng hai cánh tay bị lẫn vào thân hoặc viền sừng/vuốt mờ nhòa khó phân biệt hướng nhìn.
- **Mức 5:** Ở cỡ 128 px vẫn đọc rành mạch cặp sừng, tam giác 3 mắt sáng, hai bàn tay xòe tách khỏi thân và đuôi khói thuôn nhọn bên dưới, nhận biết ngay là Ma Vương.

### 5. Nhìn được từ mọi phía (không lộ ruột, không lỗ, mặt sau có hình)
- **Câu hỏi kiểm:** Khi soi đủ 4 góc (đặc biệt góc ngang và góc sau), lưới có kín mặt, không thủng lỗ, không xuyên cắt thô, không lộ mặt trong và mặt lưng có tạo hình hoàn chỉnh không?
- **Mức 1:** Lộ mặt rỗng bên trong khi nhìn từ dưới/ngang, hở khe giữa cổ–thân hoặc vai–tay, hoặc mặt sau phẳng lì không có khối cơ lưng/sừng/đuôi khói.
- **Mức 3:** Không có lỗ thủng lớn ở góc chính diện nhưng góc ngang hoặc sau còn lộ vết cắt khớp vai, giáp vai hở khe nhẹ trên 2 cm theo tỉ lệ hoặc lưng còn đơn điệu ít phân khối.
- **Mức 5:** Cả 4 góc kín khối hoàn toàn (không lộ mặt sau của vỏ khi bật bán trong suốt 2 lượt vẽ), không có hiện tượng chồng cắt hoặc khe hở tại cổ/vai/cổ tay, mặt sau có đầy đủ khối cơ lưng, sống lưng, giáp vai và mặt sau của sừng–khói.

### 6. Đúng chất linh thể (nửa dưới tan khói, bán trong suốt, viền sáng)
- **Câu hỏi kiểm:** Mô hình có thể hiện đúng chất liệu linh thể theo §1.1 và §2.2 (không có chân, từ thắt lưng tan dần thành đuôi khói, lõi thân tối–trong mờ còn mép viền sáng Fresnel) không?
- **Mức 1:** Mô hình trông như tượng nhựa/đá đặc hoàn toàn từ đầu tới chân, phần dưới cắt ngang cụt lủn hoặc có khối chân, và không thấy hiệu ứng viền sáng Fresnel quanh mép.
- **Mức 3:** Đã bỏ chân và có phần đuôi thuôn bên dưới, nhưng ranh giới chuyển từ thắt lưng sang khói còn cứng như hình nón đặc hoặc độ trong mờ và viền sáng Fresnel quá yếu nên nhìn vẫn nặng chất rắn.
- **Mức 5:** Từ thắt lưng trở xuống thuôn xoắn và tan mượt thành dải khói không lộ mép cắt, phần lõi thân giữ được độ mờ tối bán trong suốt không lộ ruột bên trong, đồng thời đường viền cơ thể bắt sáng Fresnel rõ rệt ở mọi góc quay.

### Luật đạt
- **Đạt** khi thỏa đồng thời cả hai điều kiện: **điểm trung bình 6 mục ≥ 4,0** và **không có mục nào dưới 3 điểm**.
- Nếu không đạt, người soát hình trả về kèm **Danh sách sửa** để quay lại vòng chỉnh sửa kịch bản Blender.

### Mẫu danh sách sửa

| Bộ phận | Sai gì | Số đo / chỉnh sửa đề nghị |
|---|---|---|
| Cặp sừng chính | Ngắn và mở quá ngang, góc 128 px khó thấy uy lực | Tăng chiều cao sừng thêm 20%, uốn cong hướng vào trong ở 1/3 ngọn, gốc sừng giữ đường kính ~0,14 m |
| Cụm ngón vuốt hai tay | 5 ngón dính liền thành khối vuông, thiếu độ xòe ôm | Rút về 4 hoặc 5 cụm tách khe rõ ≥ 0,03 m giữa các ngón, mở góc xòe 35° hướng về tâm nhân vật |
| Mặt sau (lưng & giáp vai) | Lưng phẳng và giáp vai hở khe ở góc sau | Thêm sống khối cơ lưng chữ V nổi 0,04 m, kéo mép giáp vai ôm sát cầu vai, đóng kín khe cổ–ngực |
| Đuôi khói nửa dưới | Mép tan dưới thắt lưng cắt ngang gắt, còn cảm giác đặc | Kéo dài đoạn chuyển `smoothstep` thêm 0,35 m, thu nhỏ bán kính đuôi còn ≤ 0,06 m ở chóp và xoắn lệch trục 15° |
| Mạch dung nham (`COLOR_1`) | Đường phát sáng quá mảnh, mất nét khi thu 128 px | Tăng bề rộng dải mạch chính lên ~0,025–0,035 m và giữ mật độ tối giản dọc ngực, vai, lưng |

## 4. Nhận xét ảnh ý tưởng Ma Vương cho người dựng thấp đa giác

Do `gemini-4-hydrogen-xhigh` viết.

- **Nên giữ nguyên khối lớn và tỉ lệ ba mặt:** giữ cặp sừng chính cong mạnh + 2 sừng phụ nhỏ giữa trán, bộ 3 mắt phát sáng (nhấn mạnh mắt thứ ba trên trán), tai nhọn vểnh ngang, khối ngực–vai đồ sộ gấp ~2,5 lần eo, hai cẳng tay–bàn tay to xòe rộng về phía trước và phần thân dưới thuôn thành một dải đuôi khói xoắn duy nhất.
- **Nên giữ các vệt sáng định hướng hình khối ở mặt trước lẫn mặt sau:** dùng kênh phát sáng `COLOR_1` giữ lại 3 mắt, hốc miệng hở có 2 răng nanh lớn, và **một ít** đường mạch dung nham chính chạy theo thớ cơ ngực, vai và chữ V sống lưng (nhất là góc sau trong ảnh rất tốt để lưng không bị trơ khi xoay camera).
- **Nên bỏ hoặc giản lược vảy đá, nếp nhăn da và tua rua chi tiết:** bề mặt da sần sùi kiểu dung nham nứt vụn, hàng trăm vảy giáp vai, đường viền khắc chữ trên vòng cổ tay, mặt quỷ nhỏ trước ngực kèm các dải tua rua nhỏ li ti đều không thể dựng bằng hình học trong 4.000 tam giác (nếu cố remesh sẽ vỡ thành nhiễu răng cưa); phần ngực chỉ cần khối cơ sạch, vòng tay và giáp vai giản lược thành khối giáp lớn vát cạnh sắc nét.
- **Nên giản lược ngọn lửa khói sau vai và chỏm đầu:** trong ảnh ý tưởng, các luồng khói lửa uốn lượn tách rời phía sau hai vai, trên đỉnh đầu và nhiều nhánh khói phụ quanh eo quá mỏng và nhiều xoáy cho lưới đặc; nên gộp thành 2–3 dải vây khói/lửa bản rộng ít tam giác gắn sát vai–lưng, hoặc giao cho shader/hạt ở runtime thay vì cố điêu khắc từng lưỡi lửa.
- **Nên bỏ chi tiết răng nhỏ và mạch nứt li ti:** thay vì dựng từng chiếc răng và đường nứt nhỏ dày đặc ở mặt và bắp tay (gây bệt đen khi thu 128 px), chỉ dựng khung hàm mở có 2 nanh trên, 2 nanh dưới và 2 nanh khóe miệng dạng khối chóp đơn giản, kết hợp 6–10 mạch dung nham to bản đủ đọc ở tầm xa.
- **Lưu ý tư thế bàn tay cho rigging chung (§2.3):** ảnh ý tưởng có 5 ngón tay chi tiết với đốt ngón và móng vuốt riêng; với khung xương chung và ngân sách ≤ 4.000 tam giác, nên dựng mỗi bàn tay với **4 hoặc 5 ngón gộp 1–2 đốt** (ngón cái + 3–4 ngón vuốt cong gập sẵn theo thế xòe ôm) để vừa đọc rõ ở góc trước/nghiêng vừa không ngốn hết tam giác của cả mô hình.

## 5. Thử `gemini-4-hydrogen-xhigh` làm thợ soát qua Codex CLI (14/11)

- Lệnh: `codex exec -m gemini-4-hydrogen-xhigh … --sandbox read-only --image=<ảnh>` với lời nhắc tiếng Việt.
- Kết quả: **dùng được**. Mô hình tự gọi công cụ đọc `docs/KE-HOACH-PHAP-TUONG-3D.md` (lần đầu đọc lỗi dấu do PowerShell, tự đọc lại với UTF-8), nhìn được ảnh đính kèm, trả phiếu chấm đúng 6 mục. Thời gian ~1,5 phút, ~196 nghìn token.
- Lưu ý: thợ soát chỉ đọc, Điều phối tự dán kết quả vào tài liệu. Câu chữ hơi dài nhưng cụ thể, có số đo.
