# Kế hoạch đợt 2026-11 · Bàn cờ sân chùa, bói toán, danh hiệu, hướng dẫn và giao diện

> Lập ngày 2026-11-11 theo `main` @ `459c2b1`. Người lập: Claude (Opus 5.5), sau khi khảo sát mã và tự chơi thử như người mới.
> Đây là **tài liệu thiết kế**. Thẻ việc để giao cho agent nằm ở [task.md](../task.md) (T-010 → T-067). Quy trình điều phối chung ở [docs/agents/ORCHESTRATION.md](agents/ORCHESTRATION.md); mục 10 của tài liệu này bổ sung riêng cho đợt.
> Agent chỉ đọc mục được thẻ chỉ tới, không đọc hết.

## Mục lục

0. [Đọc nhanh](#0-đọc-nhanh)
1. [Quyết định cần chủ dự án chốt](#1-quyết-định-cần-chủ-dự-án-chốt)
2. [Hiện trạng](#2-hiện-trạng-khảo-sát-2026-11-11)
3. [Nguyên tắc chung của đợt](#3-nguyên-tắc-chung-của-đợt)
4. [Epic UI · Thanh đổi map và thanh lễ Phật](#4-epic-ui--thanh-đổi-map-và-thanh-lễ-phật)
5. [Epic KD · Kỳ Đạo: năm môn cờ ngoài sân chùa](#5-epic-kd--kỳ-đạo-năm-môn-cờ-ngoài-sân-chùa)
6. [Epic DH · Danh hiệu, Bảng Vàng, màn đối đầu](#6-epic-dh--danh-hiệu-bảng-vàng-màn-đối-đầu)
7. [Epic BT · Bói toán chính xác hơn](#7-epic-bt--bói-toán-chính-xác-hơn)
8. [Epic HD · Hướng dẫn cho người mới](#8-epic-hd--hướng-dẫn-cho-người-mới)
9. [Đề xuất cơ chế mới](#9-đề-xuất-cơ-chế-mới)
10. [Thực thi và điều phối](#10-thực-thi-và-điều-phối)
11. [Phụ lục](#11-phụ-lục)

---

## 0. Đọc nhanh

**Đợt này làm 5 nhóm việc (epic): 40 thẻ mới + 4 thẻ nền có sẵn (T-003 → T-006), khoảng 44 PR:**

| Epic | Kết quả người chơi thấy | Thẻ |
|---|---|---|
| **UI** | Thanh dưới chỉ còn 9 nút lễ Phật. Một thanh đổi map đồng bộ: Chánh điện · Sân chùa · Tàng Kinh Các · Sân đấu. Bỏ nút "Xin xăm" (chỉ xin bằng hũ xăm trên bàn thờ). | T-010 → T-012 |
| **KD** (Kỳ Đạo) | 4 bàn đá ở Sân chùa. Đánh cờ vua, cờ tướng, cờ tướng úp, cờ vây, cờ caro với người khác. Có người xem, đồng hồ, Elo riêng từng môn. | T-020 → T-035 (T-036 → T-039 để sau đợt) |
| **DH** (Danh hiệu) | Danh hiệu "lịch sử" và "hiện tại" cho công đức, PK và từng môn cờ. Bia Bảng Vàng ở sân. Màn "Kẻ mạnh nhất lịch sử… đối đầu kẻ mạnh nhất hiện tại" khi hai người giữ danh hiệu gặp nhau. | T-040 → T-044 |
| **BT** (Bói toán) | Tarot: chọn chủ đề có sẵn (không gõ chữ), trải 5 lá, có lời khuyên. Tử vi: lập lá số Tử Vi Đẩu Số thật (giờ sinh, giới tính, 12 cung, 14 chính tinh, đại vận, lưu niên). Lịch âm đúng cả ngày trước 1968. | T-050 → T-057 |
| **HD** (Hướng dẫn) | Sổ tay trong game, gợi ý lần đầu ở mỗi nơi, bảng thuật ngữ, viết lại chữ ở mọi màn. Bí mật (easter egg) vẫn giấu. | T-060 → T-067 |

**Cách chạy:** một agent Opus (effort high) làm Điều phối. Thợ: Sonnet 5.5 (high), Codex terra 6.1, Gemini Flash, Gemini Flash-Lite, GLM Flash. Soát: Sol 6.1 (mã) và Gemini Argon (nghiệp vụ, giao diện). Mỗi thẻ một nhánh, một PR, qua đủ cổng thì merge (mục 10).

**Trước khi bắt đầu:** chủ dự án đọc mục 1 (16 quyết định, đều có mặc định). Không sửa gì thì Điều phối làm theo mặc định.

**Giới hạn đã biết:** Claude Code (phiên lập kế hoạch này) chỉ gọi được mô hình Claude. Các mô hình khác (Codex, Gemini, GLM, Sol) phải chạy qua công cụ của chủ dự án; bảng định tuyến ở 10.1 có cột "dự phòng bằng Claude" nếu thiếu mô hình nào. Repo không có `gh` CLI: để Điều phối tự mở và merge PR cần cấp quyền GitHub (mục 10.4).

---

## 1. Quyết định cần chủ dự án chốt

Mỗi dòng có mặc định đề xuất. Chủ dự án sửa cột "Chốt" nếu muốn khác; để trống = theo mặc định.

| # | Câu hỏi | Mặc định đề xuất | Lý do ngắn | Thẻ bị ảnh hưởng | Chốt |
|---|---|---|---|---|---|
| D1 | Đặt bàn cờ ở đâu? | **4 bàn đá trong Sân chùa** (không tạo map mới). Ván mời trực tiếp khi hết bàn vẫn chơi được ("bàn trong"). | Đúng ý "ở ngoài sân", ít việc. Map riêng "Kỳ Viên" để dành khi bàn thường kín (mục 9, ý 16). | T-020, T-031 | |
| D2 | Thanh đổi map gồm gì? | **Đúng 4 nút cùng kiểu: Chánh điện · Sân chùa · Tàng Kinh Các · Sân đấu**, nút map đang đứng sáng lên. Bỏ hết nút việc trên cảnh (Xin xăm, Thầy tử vi, Thầy Tarot, Ngồi thiền, Đọc kinh, Học võ): việc làm bằng cách chạm vật trong cảnh. | Chủ dự án thấy trộn nút đổi map với nút việc rất khó chịu. Vật trong cảnh đã có nhãn "Chạm để…". | T-010, T-012 | |
| D3 | Thanh dưới còn những nút nào? | **9 nút:** Thắp nhang · Nói chuyện · Dâng hoa · Thả tim · Vái lạy · Gõ mõ · Thỉnh chuông · Tụng kinh · Cúng dường. Điện thoại: 2 hàng (5 + 4), không cuộn ngang. | Đúng bộ nút bản đầu (trước khi có map phụ), bỏ "Tàng Kinh Các" vì đã nằm trong thanh đổi map. | T-011 | |
| D4 | Võ Học Các vào từ đâu khi bỏ nút dưới? | Kệ **VÕ HỌC** trong Tàng Kinh Các (đã có), thẻ trong tab **"Khám phá"** (đổi tên từ "Nơi khác"), nút trong bảng tọa thiền, link từ Sân đấu. Không vào thanh đổi map vì đây là màn hình, không phải map đi lại được. | Không thêm nút mới. | T-011 | |
| D5 | "Cao nhất hiện tại" của công đức và PK tính thế nào? | **Theo mùa = tháng âm lịch** (mùng 1 đến hết tháng). "Lịch sử" = tổng tích lũy cao nhất. Với cờ: "lịch sử" = đỉnh Elo cao nhất từng đạt, "hiện tại" = Elo đang có cao nhất. | Công đức và điểm PK chỉ cộng dồn, nên nếu tính "hiện tại" bằng tổng thì người giữ hai danh hiệu luôn là một. Tính theo mùa thì có hai người khác nhau để đối đầu. | T-040, T-041 | |
| D6 | Luật Elo | Bắt đầu **1200**. K = 40 khi dưới 20 ván, 20 khi dưới 2000, 10 từ 2000. Sàn 100. Chỉ tính ván xếp hạng giữa hai tài khoản (khi bật Google). Một cặp tối đa **3 ván xếp hạng/ngày/môn**. | Giống FIDE, dễ giải thích, chống "cày" với người quen. | T-027, T-028 | |
| D7 | Cờ tướng úp: quân úp bị ăn thì sao? Sĩ/Tượng đã lật đi thế nào? | Quân úp bị ăn **lật công khai cho cả hai bên**. Sĩ/Tượng đã lật **đi tự do** (qua sông, ra khỏi cung). | Đơn giản, công bằng. T-023 kiểm lại với nguồn luật 揭棋 trước khi làm. | T-023, T-024 | |
| D8 | Luật caro | Bàn **15×15**, X đi trước. **5 quân liên tiếp trở lên thì thắng, trừ khi bị quân đối phương chặn cả hai đầu** (luật quen của người Việt). Mép bàn không tính là chặn. | Quen thuộc, vừa màn hình điện thoại. | T-026 | |
| D9 | Cờ vây | Xếp hạng chỉ bàn **9×9**. 13×13 và 19×19 là giao hữu. Luật Trung Quốc (tính quân + đất), **komi 7,5**, cấm lặp thế (siêu cô theo vị trí). | 9×9 nhanh, hợp online; tính đất Trung Quốc dễ tự động hóa. | T-025 | |
| D10 | Tarot | Chọn **1 trong 8 chủ đề** + khung thời gian (7 ngày / 30 ngày / 3 tháng). Trải **5 lá**. Cùng chủ đề + khung trong một ngày thì ra cùng kết quả (máy chủ rút theo hạt giống). | Đúng góp ý của chủ dự án; "hỏi lại cho tới khi ưng" làm quẻ mất ý nghĩa. | T-051 → T-053 | |
| D11 | Tử vi | Tính **trên máy người dùng** (giữ lời hứa "ngày sinh không gửi đi"). Theo trường phái Việt Nam (Thái Thứ Lang). Sinh 23:00–23:59 tính sang ngày hôm sau. Sinh tháng nhuận tính như tháng chính. | Riêng tư; phổ biến nhất ở Việt Nam. Hai tùy chọn sau có thể đổi trong phần "Nâng cao". | T-054 → T-057 | |
| D12 | Mã lịch âm hiện tại là bản chép thuật toán Hồ Ngọc Đức (giấy phép chỉ cho dùng cá nhân, phi thương mại; site có nhận cúng dường) | **Viết lại độc lập** từ công thức thiên văn công khai (Meeus), cùng kết quả, kiểm bằng bộ ngày đã biết. | Tránh rủi ro giấy phép. Công thức thiên văn không có bản quyền; mã thì có. | T-050 | |
| D13 | Màn đối đầu dùng hình gì? | **Tự vẽ bằng mã**: chính nhân vật của hai người chơi, vẽ kiểu truyện tranh đen trắng, khung chữ trắng viền đen. **Không** dùng hình Jujutsu Kaisen. Câu chữ: "KẺ MẠNH NHẤT LỊCH SỬ…" / "…ĐỐI ĐẦU KẺ MẠNH NHẤT HIỆN TẠI." | Hình manga có bản quyền (AGENTS.md §3.14). Câu chữ ngắn để gợi meme thì được. | T-044 | |
| D14 | Ai bấm merge? | **Điều phối (Opus) merge** khi qua đủ cổng 10.4, kiểu **squash**. Riêng PR đổi `lib/store-sections.js` (T-029) thì **chủ dự án bấm**. | Chủ dự án đã cho phép "commit, push, merge từng PR" trong yêu cầu ngày 2026-11-11; ngoại lệ này ghi ở đầu `docs/agents/ORCHESTRATION.md` (Thợ và Soát vẫn không merge, đúng AGENTS.md §7). Dữ liệu là chỗ khó hoàn tác nhất. | mọi thẻ | |
| D15 | Thêm nút "?" (Sổ tay) ở thanh trên cùng? | **Có**, một biểu tượng nhỏ cạnh nút âm thanh. | Người mới cần một chỗ để hỏi. Không chạm thanh dưới. | T-061 | |
| D16 | Đánh cờ có được cộng công đức không? | **Không.** Công đức chỉ đến từ lễ Phật và cúng dường. Cờ chỉ có Elo và danh hiệu. | Tránh "cày" công đức bằng ván cờ dàn xếp. | T-028, T-030 | |

Câu hỏi phụ (không chặn việc): đổi "9 cảnh giới hào quang" thành "9 tầng hào quang" để không trùng chữ "cảnh giới" của nội công (T-065); bỏ hai câu NPC không hợp nhà chùa ("Thèm nhiêu anh đủ cắc?", "cardio tại ban công") (T-065).

---

## 2. Hiện trạng (khảo sát 2026-11-11)

### 2.1 Chơi thử như người mới (máy bàn 1280×800 và điện thoại 375×812)

1. **Thanh dưới có 12 nút.** Trên điện thoại chỉ thấy 4 nút đầu; 8 nút còn lại nằm ngoài màn, cuộn ngang mà không có dấu hiệu gì.
2. **Hộp "Đang nghe · mic tắt"** nổi ở góc trái dưới, che mất dòng hướng dẫn "Chạm sàn để đi lại…". Trên điện thoại nó che khung chat.
3. **Dòng hướng dẫn bị ẩn hẳn trên màn ≤ 900px**, nên người chơi điện thoại không được biết "chạm sàn để đi lại".
4. **Nút đổi map không đồng bộ:** "Ra sân chùa →" viền vàng có mũi tên, "Tàng Kinh Các" nền tối, "Xin xăm" (không phải đổi map) đứng chung hàng. Ở Sân chùa lại thành "← Vào chánh điện", "Thầy tử vi", "Thầy Tarot". Muốn từ Tàng Kinh Các ra sân phải về chánh điện trước.
5. **Nhãn tên NPC đè lên nhau và đè tên mình** ("Kiếm Khách Lâm Lời · NPC" chồng "Khách Mới").
6. **Không có chỗ nào nói chùa có những gì.** Tab "Nơi khác" chỉ nhắc Võ Học Các và Sân đấu.
7. **Tarot:** ô "Câu hỏi" bị bỏ qua hoàn toàn. Mỗi lá chỉ 2–8 chữ ("thẳng thắn và minh bạch"), tên lá tiếng Anh, không có lời tổng hợp.
8. **Tử vi:** chỉ dùng địa chi năm sinh; mọi người cùng tuổi nhận cùng một câu. Tên hộp là "Xem tử vi" nên dễ hiểu lầm là lá số.
9. **Võ Học Các:** 6 từ gần nghĩa đứng cạnh nhau (công lực, nội công, nội lực, tâm đắc, tâm pháp, công pháp). "Cảnh giới" vừa là bậc nội công vừa là tầng hào quang. "Luật tu luyện" gập ở cuối trang. Không nói tài khoản mới đã biết sẵn 6 chiêu.
10. **Sân đấu:** luật chiến đấu chỉ có một câu, nằm trong ngăn "Danh sách" đang đóng. Không nói lượt 20 giây, bỏ 3 lượt thì thua, nộ tăng thế nào.
11. **Công đức:** thanh trên cùng hiện công đức *hôm nay*, pháp tướng lại theo *tổng*: không chỗ nào nói. Thời gian chờ (nhang 15 giây, chuông 10 giây…) không báo trước. Mốc công đức chỉ là hiệu ứng, không có thưởng: không nói.
12. **Chữ sai với thực tế:** "Chỉ người tự ra sân mới mời được nhau" (thực ra mời được từ chánh điện); số lượt "hoàn thành ngay" mỗi ngày (giao diện nói không giới hạn, docs nói 2); hòa do "Tẩu Vi" hiện trống lý do.
13. **Phím WASD / mũi tên** đi được nhưng không chỗ nào nói.

### 2.2 Thanh nút và điều hướng (sự thật trong mã)

- Thanh dưới: `<nav class="actions">` trong `public/index.html`, một bộ bắt sự kiện `[data-act]` → `act()` trong `public/js/app.js`. Lịch sử: bản đầu `8cc641d` có 8 nút; thêm "Nói chuyện" và "Tàng Kinh Các" ở `3cfd08c` (10 nút); thêm "Võ học các", "Sân đấu" ở `19a6744` (12 nút).
- Nút trên cảnh: `<nav class="scene-nav">` (9 nút, ẩn/hiện theo cảnh trong `applyScene`).
- **Bẫy khi xóa nút:** `app.js` đọc `#actVoice`, `#actVoiceLbl`, `#actDojo`, `#actArena` và các id của scene-nav **không kiểm null** (trong `welcome()` và `applyScene`), `fortune.js` gắn `#go-yard`/`#go-hall`. Xóa thẻ HTML mà không sửa JS là hỏng cả lúc vào chùa. `tools/ui-harness/arena/e2e-real.js` bấm `#actArena`.
- Cảnh (scene, cùng một canvas): `hall`, `yard`, `library` (`SCENES` trong `server.js`). Nơi (place, màn riêng): `dojo`, `arena` (`PLACES`). Sân đấu vừa là place `arena` vừa vẽ cảnh `arena` qua `Hall.attach`.
- Không có cửa đi bộ: đổi cảnh chỉ bằng nút hoặc chạm tủ Tàng Kinh Các.

### 2.3 Bói toán

- Toàn bộ chữ nằm cứng trong `public/js/fortune.js` (80 dòng). Không có file dữ liệu.
- **Xin xăm**: máy chủ quyết (`fortune:join`, hàng đợi 5 giây, 12 quẻ, `Math.random`). **Không giới hạn tần suất**, mỗi lần gọi phát `fortune:queue` tới mọi người (có thể bị dùng để spam).
- **Tarot**: trên trình duyệt. Đủ 78 lá, xuôi/ngược 50%, luôn 3 lá Quá khứ · Hiện tại · Khả năng sắp tới.
- **Tử vi**: trên trình duyệt. Chỉ đối chiếu địa chi năm sinh với 3 tháng âm tới (trùng / lục xung / tam hợp).
- **`public/js/lunar.js`**: chép thuật toán Hồ Ngọc Đức, múi giờ +7 cho mọi năm. Đúng với các Tết đã kiểm (2025, 2026, 2007, 1985, 1968) và tháng nhuận 2017–2033. **Sai trước 1968** (Việt Nam khi đó tính âm lịch theo UTC+8): 927 ngày trong 1900–1967 lệch, 4 ngày lệch cả năm can chi (1903-01-28, 1916-02-03, 1935-02-03, 1965-02-01). Thiếu: can chi ngày/tháng/giờ, đổi âm → dương, nạp âm.
- Ảnh hai thầy bói (`public/img/readers/*.webp`) và ảnh chánh điện ở sân (`public/img/courtyard/chanh-dien.webp`) **chưa ghi nguồn** trong `public/img/NOTICE.txt`.

### 2.4 Xếp hạng và danh hiệu

- `db.merit[uid] = { name, total, today, day }`. `total` cộng dồn, **có thể âm** (bị trừ do chửi tục). **Không có trường đỉnh (peak)**.
- Bảng công đức: chỉ **hôm nay**, top 10, phát mỗi 5 giây khi đổi. Không có bảng "mọi thời".
- PK: danh hiệu tính trên trình duyệt từ `pkTitle(wins, draws)` trong `public/js/martial.js`: điểm chiến tích = 3 × thắng + hòa, 9 bậc từ "Tay Mơ Tập Võ" tới "Độc Cô Cầu Bại". Không lưu, không có bảng xếp hạng, không có test.
- Hồ sơ võ học (`db.martial.profiles[uid]`) **không có tên**; tên chỉ ở `db.merit[uid].name` và trong biên bản trận.
- Không có Elo, không có màn mở đầu kiểu "VS". Mẫu hiệu ứng toàn màn dùng lại được: `public/js/celebrate.js`.
- Riêng tư: không bao giờ gửi uid người khác (`test/e2e-security.test.js` kiểm). Danh hiệu phải gắn theo `pid`/tên.

### 2.5 Sân chùa (cảnh `yard`)

- Vẽ trong `drawYard` + `drawReaders` (`public/js/hall.js`). Không có vật cản, không có camera.
- Hai thầy bói ở sàn ≈ (0,15; 0,26) và (0,85; 0,26), vùng chạm tới z ≈ 0,39. NPC bí mật "Vạn Lý Độc Hành" đứng cố định ở (0,32; 0,67). Điểm xuất hiện (0,5; 0,8).
- Chỗ trống đủ đặt bàn: giữa trái (0,18–0,30; 0,44–0,58), giữa phải (0,70–0,82; 0,44–0,58), trước trái và trước phải (z 0,72–0,90), trước cửa chánh điện (0,5; 0,33–0,38).
- Mẫu "ngồi vào chỗ" có sẵn: bồ đoàn ở Tàng Kinh Các (`LIB_SEATS`, sự kiện `sit`/`stand`/`psit`). Mẫu vật trang trí xếp theo chiều sâu: `ARENA_PROPS`.
- `test/hall-npcs.test.js` đếm **đúng số nhãn kết thúc bằng `' · NPC'`** (3 ở chánh điện, sân chùa, Tàng Kinh Các; 2 ở sân đấu) và chạy `hall.js` trong `node:vm` (không có `setTimeout`, không có `Path2D`). Nhãn bàn cờ không được kết thúc bằng `' · NPC'`.
- `personAt` được kiểm **trước** mọi vật khác trong `onDown`, nên người ngồi bàn sẽ "che" bàn khi chạm (T-031 xử lý).

---

## 3. Nguyên tắc chung của đợt

1. **Máy chủ là trọng tài** cho mọi thứ có thắng thua, xếp hạng, danh hiệu, rút bài/quẻ (AGENTS.md §3.1). Trình duyệt chỉ vẽ và gợi ý nước đi hợp lệ.
2. **Không thêm nút cho trò phụ ở thanh dưới.** Trò phụ vào bằng: chạm vật trong cảnh, thanh đổi map, tab "Khám phá".
3. **Mỗi map mới phải thêm vào thanh đổi map** (một mảng `MAPS` duy nhất trong `public/js/mapbar.js`), cùng kiểu với 4 nút đã có.
4. **Điện thoại trước:** mọi màn mới phải dùng được ở 375×812, nút chạm ≥ 44px, không cuộn ngang trang.
5. Tôn trọng `prefers-reduced-motion`; hiệu ứng lớn có công tắc tắt trong thẻ "Hiệu ứng".
6. Chữ do người dùng hoặc máy chủ gửi gán bằng `textContent`/`h()`. Tên người chơi đi qua `lib/moderation.js`.
7. **Không gửi uid** người khác cho trình duyệt. Danh hiệu, Elo, người xem đều gắn theo `pid` và tên.
8. File dùng chung Node + trình duyệt (luật cờ, tử vi, dữ liệu tarot) là UMD, không phụ thuộc gì, không đụng DOM.
9. Sửa `public/` thì tăng `?v=`. Thêm ảnh/chữ bên thứ ba thì ghi NOTICE. Không chép nguyên văn sách/web còn bản quyền.
10. Cờ tính năng để tắt nhanh khi có sự cố: `KYDAO_ENABLED` (mặc định 1), `TITLES_ENABLED` (1), cùng các biến số trận tối đa (`KYDAO_MAX_GAMES=40`).

---

## 4. Epic UI · Thanh đổi map và thanh lễ Phật

### 4.1 Thanh đổi map (T-010)

**Mục tiêu:** một thanh duy nhất, cùng kiểu ở mọi map, chỉ dùng để đổi map.

```
┌──────────────────────────────────────────────────────────────┐
│ [⌂ Chánh điện] [❀ Sân chùa] [▤ Tàng Kinh Các] [⚔ Sân đấu]    │   ← góc trên trái của cảnh
└──────────────────────────────────────────────────────────────┘
  nút đang đứng: nền vàng, chữ đậm, aria-current="page"
  nút khác: viền mảnh, nền tối trong suốt; cùng cỡ, cùng bo góc
```

- File mới `public/js/mapbar.js`, global `MapBar`. File chỉ chạy trên trình duyệt nên không cần dạng UMD. API:
  - `MapBar.MAPS`: mảng duy nhất `[{ id:'hall', kind:'scene', label:'Chánh điện', short:'Chánh điện', icon }, { id:'yard', kind:'scene', label:'Sân chùa', short:'Sân chùa' }, { id:'library', kind:'scene', label:'Tàng Kinh Các', short:'Kinh Các' }, { id:'arena', kind:'place', label:'Sân đấu', short:'Sân đấu', flag:'pk' }]`.
  - `MapBar.configure({ go(id) })`: `app.js` gọi một lần, giữ hàm đổi map.
  - `MapBar.mount(el)` dựng nút bằng `document.createElement`, không `innerHTML` với dữ liệu ngoài. Gọi được ở bất kỳ đâu (cảnh chánh điện, đầu màn Sân đấu) mà không cần truyền thêm hàm.
  - `MapBar.setCurrent(id)` đổi nút sáng.
  - `MapBar.setEnabled(id, bool)` ẩn nút khi tính năng tắt (Sân đấu khi `!cfg.martial.pk`).
- `app.js`:
  - `go(id)`: scene → `goScene(id)`; place `arena` → `act('arena')` (giữ `needLogin`). Đang ở Sân đấu mà bấm map khác → `Places.go('hall')` rồi `goScene(id)`.
  - `applyScene` gọi `MapBar.setCurrent` và `MapBar.setEnabled('arena', …)`.
  - **Bẫy:** lúc vào chùa, `applyScene` chỉ chạy qua `fortune.reset → setScene('hall')`. Viết lại `fortune.js` (T-010, T-053, T-057) mà bỏ đường gọi này thì thanh đổi map không sáng nút nào.
  - **Xóa** các id cũ: `#go-yard`, `#go-hall`, `#go-library`, `#open-lot`, `#open-horoscope`, `#open-tarot`, `#lib-sit`, `#lib-read`, `#lib-dojo` cùng mọi chỗ đọc chúng (`applyScene`, các `addEventListener`, `fortune.js` dòng gắn `#go-yard`/`#go-hall`). Không để lại truy cập id đã xóa.
- **Việc trên cảnh chỉ làm bằng chạm vật** (đã có sẵn trong `hall.js`): hũ "XĂM" trên bàn thờ → xin xăm; hai bàn thầy bói → tử vi / tarot; bồ đoàn → ngồi thiền; kệ kinh → đọc kinh; kệ võ học → Võ Học Các.
  - Logic "chọn bồ đoàn trống gần nhất" của nút "Ngồi thiền" chuyển vào: chạm bồ đoàn đang có người → tự chọn bồ đoàn trống gần nhất và báo "Bồ đoàn này có người, mời bạn sang bồ đoàn bên cạnh."
- **Dòng gợi ý cảnh** (`#stageHint`): trên điện thoại không ẩn hẳn mà thành một dải nhỏ có nút ✕, hiện lần đầu vào mỗi map (nhớ bằng `localStorage` khóa `ta-hint-<map>`, bọc try/catch). Nội dung viết lại ở T-065.
- Điện thoại: 4 nút vừa 375px (mỗi nút ≥ 80px × 44px, chữ `short`). Không xuống dòng, không cuộn.
- Bàn phím: thanh là `<nav aria-label="Đổi nơi">`, nút là `<button>`, Tab đi được.
- **Map mới sau này** (ví dụ "Kỳ Viên"): thêm một phần tử vào `MAPS` + `SCENES` ở `server.js` + hàm vẽ ở `hall.js`. Ghi điểm đồng bộ này vào ARCHITECTURE.md §6.

### 4.2 Thanh lễ Phật (T-011)

- Giữ đúng 9 nút: **Thắp nhang · Nói chuyện · Dâng hoa · Thả tim · Vái lạy · Gõ mõ · Thỉnh chuông · Tụng kinh · Cúng dường** (thứ tự như bản đầu, "Nói chuyện" đứng thứ 2 như hiện nay).
- Bỏ: `data-act="library"`, `#actDojo`, `#actArena`. Sửa `welcome()` cho không còn đọc `#actDojo`/`#actArena`. Hàm `act('dojo')`, `act('arena')` vẫn giữ (dùng từ tab Khám phá, kệ võ học, thanh đổi map).
- **Điện thoại ≤ 480px:** lưới 5 cột × 2 hàng, mỗi ô ≥ 44px cao, biểu tượng + chữ 11px; không cuộn ngang. Máy bàn: một hàng như cũ.
- **Nút mic trùng nhau:** thanh dưới có "Nói chuyện", hộp nổi `#voicebar` cũng có `#vbMic`. Giữ nút mic trong `#voicebar` **chỉ khi thanh dưới bị ẩn** (đang ở Võ Học Các / Sân đấu). Hộp `#voicebar` tự thu nhỏ thành một chấm trạng thái sau 6 giây không đổi, để không che gợi ý và chat.
- **Lễ từ map khác:** các nút lễ không bị chặn theo cảnh (máy chủ không kiểm cảnh). Khi bấm ở Sân chùa / Tàng Kinh Các, báo thêm một câu chung "Lễ đã dâng lên bàn thờ ở chánh điện." (thắp nhang, dâng hoa, thỉnh chuông).
- Sửa luôn câu sai "Chỉ người tự ra sân mới thấy và mời được nhau" (thẻ Sân đấu trong tab, `docs/VO-HOC.md`, `docs/VO-HOC-GIAO-THUC.md`): thực tế mời được từ chánh điện qua hộp người chơi.
- **Tab "Nơi khác" đổi thành "Khám phá"**: mỗi nơi một thẻ ngắn (tên, 1 câu "để làm gì", nút đi tới), ẩn thẻ khi tính năng tắt (hiện tại thẻ không bao giờ ẩn: lỗi nhỏ, sửa luôn):
  - Sân chùa: thầy bói, bàn cờ, Bảng Vàng → nút "Ra sân chùa"
  - Tàng Kinh Các: đọc kinh, ngồi thiền → "Vào Tàng Kinh Các"
  - Võ Học Các → "Vào Võ Học Các"
  - Sân đấu → "Ra Sân đấu"
- Cập nhật `tools/ui-harness/arena/e2e-real.js` (đang bấm `#actArena`) sang nút Sân đấu của thanh đổi map. Cập nhật README dòng "chạm nút ở thanh dưới chánh điện để sang nơi khác" và `docs/VO-HOC.md` dòng 13.

### 4.3 Thanh đổi map trong Sân đấu (T-012)

- Sân đấu là place riêng (ẩn `.layout` và `.actions`). Đầu màn có nút "← Về chánh điện". Thay nút đó bằng `MapBar.mount()` (Sân đấu sáng), đặt ở đầu màn.
- Đang có trận: bấm map khác thì dùng lại hộp xác nhận rời trận có sẵn (`ui.dLeave` trong `arena.js`).
- Chạy lại ui-harness sân đấu (fixture + `ui-check.js`) và `e2e-real.js`.

### 4.4 Tiêu chí chung cho Epic UI

- Ảnh chụp 375×812, 768×1024, 1280×800 ở cả 4 map, trước/sau, đính kèm PR.
- Không lỗi console khi vào chùa, đổi map, mở/đóng Võ Học Các, Sân đấu, Sân chùa.
- Không còn chuỗi `open-lot`, `go-yard`, `actDojo`, `actArena` trong `public/` (trừ ghi chú lịch sử).

---

## 5. Epic KD · Kỳ Đạo: năm môn cờ ngoài sân chùa

### 5.1 Hành trình người chơi

1. Ra **Sân chùa**, thấy 4 bàn đá có biển nhỏ: "Bàn 1 · trống", "Bàn 2 · Cờ tướng · đang đấu · 3 người xem".
2. **Chạm bàn trống** → nhân vật đi tới ghế, ngồi xuống → mở **bảng bàn cờ**: chọn môn (5 nút), chế độ (Xếp hạng / Giao hữu), nhịp (Nhanh / Thường) → "Mời người ngồi cùng". Biển bàn đổi thành "Bàn 1 · Cờ vua · chờ người".
3. Người khác **chạm ghế còn lại** → thấy luật đã chọn → "Vào ngồi". Cả hai bấm "Sẵn sàng" → bắt đầu.
4. Hoặc **chạm một người chơi** (ở chánh điện hay sân) → hộp người chơi có nút **"Mời đánh cờ"** → chọn môn → lời mời 20 giây → nhận lời → cả hai được đưa ra Sân chùa, ngồi vào bàn trống gần nhất. Hết bàn thì ván diễn ra ở "bàn trong" (không vẽ trên sân, hai người đứng tại chỗ, trên đầu có biểu tượng bàn cờ nhỏ).
5. **Chạm bàn đang đấu** → xem trực tiếp (người xem). Đóng bảng là thôi xem.
6. Hết ván: màn kết quả (thắng/thua/hòa, lý do, Elo trước → sau), nút "Đấu lại" (đổi bên) và "Rời bàn".

### 5.2 Bố trí 4 bàn ở Sân chùa (T-031)

| Bàn | Tâm bàn (x; z) | Ghế bên A / bên B | Ghi chú |
|---|---|---|---|
| 1 | (0,17; 0,50) | (0,125; 0,50) / (0,215; 0,50) | ngoài vùng chạm thầy tử vi; dịch trái (đề xuất cũ 0,25 làm ghế B nằm trong vùng chạm NPC bí mật), chỉnh ở T-031 |
| 2 | (0,83; 0,50) | (0,785; 0,50) / (0,875; 0,50) | ngoài vùng chạm thầy Tarot; đối xứng bàn 1 |
| 3 | (0,18; 0,76) | (0,12; 0,76) / (0,24; 0,76) | cách NPC bí mật (0,32; 0,67) đủ xa; còn thấy trên điện thoại dọc |
| 4 | (0,82; 0,76) | (0,76; 0,76) / (0,88; 0,76) | |

- Toạ độ là đề xuất; T-031 chỉnh theo ảnh chụp 3 cỡ màn và báo lại. Giữ trống lối giữa (x 0,40–0,60) vì là chỗ xuất hiện.
- **Điểm đồng bộ mới:** `YARD_TABLES` trong `server.js` ↔ `YARD_TABLES` trong `public/js/hall.js`. Ghi vào ARCHITECTURE.md §6 và mở rộng test chống lệch (T-005).
- Vẽ: bàn đá tròn + 2 ghế đá, là vật xếp theo chiều sâu như `ARENA_PROPS`. Mặt bàn vẽ ô cờ thu nhỏ của môn đang chơi (lưới 8×8, 9×10 có sông, lưới vây, lưới caro). Biển tên nổi phía trên (không kết thúc bằng `' · NPC'`). Bàn đang đấu có chấm đỏ nhẹ nhấp nháy (tắt khi giảm chuyển động).
- Người ngồi bàn dùng tư thế ngồi có sẵn (`drawSitting`), quay mặt vào bàn.
- Chạm: thêm kiểm tra bàn/ghế **sau** kiểm tra NPC bí mật và **trước** kiểm tra thầy bói trong `onDown` (sân). `personAt` bỏ qua người đang ngồi bàn, để chạm vào bàn đang đấu là mở bàn (xem), không mở hộp người chơi; muốn mời/chặn người đang ngồi thì làm từ danh sách người trong bảng bàn cờ. Con trỏ đổi thành tay khi rê lên bàn.
- Tư thế ngồi bàn lấy từ danh sách ghế trong sự kiện `kd:table` (theo `pid`) qua `Hall.setTables`; không thêm trường vào `publicPlayer`. Người chơi ở "bàn trong" có biểu tượng bàn cờ nhỏ trên đầu.

### 5.3 Kiến trúc mã

```
public/js/kydao/            (UMD, dùng chung Node + trình duyệt, không DOM, không phụ thuộc)
  chess.js     KyChess      luật cờ vua
  xiangqi.js   KyXiangqi    luật cờ tướng + biến thể 'jieqi' (cờ tướng úp)
  go.js        KyGo         luật cờ vây
  gomoku.js    KyGomoku     luật caro
lib/kydao/                  (chỉ máy chủ, thuần: không socket, không timer thật, không I/O)
  registry.js  danh sách môn: id, tên, module luật, nhịp, số nước tối thiểu để xếp hạng
  elo.js       tính Elo, điều kiện xếp hạng, chống cày
  manager.js   createKydaoManager(deps): bàn, ghế, lời mời, đồng hồ, nước đi, người xem, kết quả, vào lại
lib/records.js              tính người giữ danh hiệu (Epic DH)
public/js/kydao-ui.js       global KydaoUI: bảng bàn cờ (khung, người chơi, đồng hồ, nút, danh sách nước, kết quả)
public/js/kydao-draw.js     global KydaoDraw: vẽ 4 loại bàn lên canvas, chuyển chạm → ô
public/css/kydao.css        tiền tố CSS `kd-`
docs/KY-DAO-GIAO-THUC.md    hợp đồng giao thức (T-020)
```

**Giao diện chung của mỗi module luật** (để manager và giao diện dùng như nhau):

```js
create(opts)            → state            // opts: { size?, variant?, hidden? } ; state là JSON thuần
sides                   = ['a','b']        // 'a' đi trước: Trắng / Đỏ / Đen (vây) / X (caro)
turn(state)             → 'a' | 'b'
legalMoves(state)       → string[]         // mảng nước dạng chữ, xem 5.4
play(state, move)       → { ok:true, state, info:{ capture?, check?, reveal? } } | { ok:false, reason }
status(state)           → { over:false } | { over:true, winner:'a'|'b'|null, reason }
view(state, side)       → state an toàn để gửi cho một bên hoặc người xem (cờ úp: giấu quân chưa lật)
notation(state, move)   → chuỗi cho người đọc (SAN; ký hiệu cờ tướng kiểu Việt…)
```

- `play` không sửa `state` cũ (trả state mới) để test và vào lại dễ.
- Máy chủ giữ state đầy đủ. Trình duyệt nhận `view()` và tự tính `legalMoves` để chấm gợi ý (cùng file luật), nhưng **máy chủ luôn kiểm lại**.

### 5.4 Luật từng môn, ký hiệu nước đi, dữ liệu kiểm

#### Cờ vua (`KyChess`, T-021)

- Luật FIDE đầy đủ: nhập thành, bắt tốt qua đường, phong cấp (chọn Hậu/Xe/Tượng/Mã), chiếu, chiếu hết, hết nước đi (hòa).
- Hòa tự động: lặp thế 3 lần, 50 nước không ăn quân và không đi tốt, không đủ quân chiếu hết (Vua–Vua, Vua+Tượng–Vua, Vua+Mã–Vua, Vua+Tượng–Vua+Tượng cùng màu ô). Hòa do thỏa thuận (xin hòa / nhận hòa).
- Hết giờ: thua, **trừ khi** đối thủ không còn đủ quân để chiếu hết → hòa.
- Nước đi dạng UCI: `e2e4`, phong cấp `e7e8q`. Hiển thị SAN (`Nf3`, `O-O`, `exd5`, `e8=Q+`).
- Kiểm bằng **perft** (đếm số thế ở độ sâu n; số chuẩn ở Phụ lục A). Đạt perft là đạt luật đi quân.
- Hỗ trợ FEN vào/ra (để test và để làm cờ thế sau này).

#### Cờ tướng (`KyXiangqi`, T-022)

- Bàn 9 × 10, sông, cung. Quân: Tướng/Soái, Sĩ, Tượng (không qua sông, bị cản mắt), Xe, Mã (bị cản chân), Pháo (ăn phải có ngòi), Tốt/Binh (chưa qua sông chỉ tiến; qua sông thêm đi ngang).
- **Lộ mặt tướng** (hai tướng không được nhìn thẳng nhau không quân chắn) là nước không hợp lệ.
- Hết nước đi hợp lệ (bị chiếu hết hoặc bị "chặn hết") = **thua** (khác cờ vua).
- Lặp thế: chiếu dai / đuổi dai. Bản đầu dùng quy tắc đơn giản: thế lặp lần 3 mà một bên **chiếu ở mọi nước trong vòng lặp** thì bên đó thua; nếu không ai chiếu liên tục thì hòa. Không ăn quân 60 nước mỗi bên (120 nửa nước) thì hòa. Ghi rõ là luật rút gọn trong sổ tay.
- Nước đi dạng toạ độ ICCS: cột a–i, hàng 0–9 (bên Đỏ ở hàng 0): `h2e2`. Hiển thị **ký hiệu Việt**: `P2-5` (Pháo 2 bình 5), `M8.7` (Mã 8 tiến 7), `X1/1` (Xe 1 thoái 1); quân cùng cột dùng "t" (trước) / "s" (sau).
- Quân vẽ chữ Hán (帥仕相俥傌炮兵 / 將士象車馬砲卒), có công tắc "Chữ Việt" (Tướng, Sĩ, Tượng, Xe, Mã, Pháo, Tốt) cho người mới.
- Kiểm bằng perft từ thế đầu (Phụ lục A) + các thế đặc biệt (lộ mặt tướng, cản mắt tượng, cản chân mã, pháo cần ngòi).

#### Cờ tướng úp (biến thể `jieqi` trong `KyXiangqi`, T-023 nghiên cứu, T-024 làm)

- Mỗi bên: Tướng ngửa ở cung. **15 quân còn lại úp mặt và xáo ngẫu nhiên** lên 15 vị trí ban đầu của bên mình (máy chủ xáo bằng `makeRng(seed)` + Fisher–Yates; seed giữ kín tới hết ván).
- **Quân úp đi theo quân "chủ nhà" của ô đang đứng** (ô ban đầu của Mã thì đi như Mã…). Đi xong thì **lật lên** thành quân thật và từ đó đi theo quân thật.
- Quân úp luôn đứng ở ô ban đầu (vì đi là lật), nên trình duyệt tính được nước hợp lệ mà **không cần biết quân thật**.
- Sĩ/Tượng đã lật: đi tự do (theo D7, T-023 xác nhận). Tốt lật ra ở hàng cuối đối phương chỉ đi ngang.
- Ăn quân úp: lật công khai cho cả hai (theo D7).
- **Bất biến bảo mật (giống luật "không lộ chiêu" của PK):** không gói tin nào gửi cho đối thủ, cho chính người chơi, hay người xem chứa danh tính quân chưa lật. Test phải quét mọi gói `kd:*` gửi đi.
- Nước đi giống cờ tướng; gói `kd:moved` kèm `reveal: 'r'|'n'|…` khi có lật.

#### Cờ vây (`KyGo`, T-025)

- Bàn 9×9 (xếp hạng), 13×13, 19×19 (giao hữu). Đen đi trước.
- Bắt quân hết khí; **cấm tự sát**; **siêu cô theo vị trí** (không được tạo lại một thế đã có, dùng băm Zobrist).
- Bỏ lượt (`pass`). Hai bên bỏ lượt liên tiếp → **giai đoạn đánh dấu quân chết**: một tập đánh dấu chung, ai cũng bấm được vào một nhóm để đổi sống/chết; bấm "Đồng ý" cả hai thì tính điểm; đổi dấu thì mất đồng ý. Sau 3 phút không thống nhất thì tính theo dấu đang có. Một bên bấm "Đánh tiếp" thì quay lại đánh.
- Tính điểm Trung Quốc: quân trên bàn + đất (vùng trống chỉ giáp một màu), Trắng + komi 7,5. Seki: quân sống, khí chung không phải đất.
- Nước đi: toạ độ kiểu `D4` (bỏ chữ I như quy ước cờ vây), `pass`. Đánh dấu: `mark:D4`.
- Kiểm: bắt 1 quân, bắt nhóm, tự sát bị cấm, cô đơn, siêu cô ba cô, đếm điểm mẫu, seki.

#### Cờ caro (`KyGomoku`, T-026)

- Bàn 15×15, X đi trước, không giới hạn nước đầu.
- Thắng: **≥ 5 quân liên tiếp** (ngang, dọc, chéo), **trừ khi hai đầu đều là quân đối phương** (luật "chặn hai đầu"). Mép bàn không tính là chặn. Kín bàn = hòa.
- Nước đi: `h8` (cột a–o, hàng 1–15).
- Kiểm: 4 hướng thắng, bị chặn hai đầu, chặn một đầu vẫn thắng, 6 quân liên tiếp vẫn thắng, sát mép.

### 5.5 Nhịp thời gian và số nước tối thiểu để xếp hạng

| Môn | Nhanh | Thường | Ván xếp hạng khi đã đi ít nhất |
|---|---|---|---|
| Cờ vua | 5 phút + 3 giây/nước | 10 + 5 | 4 nửa nước (mỗi bên 2) |
| Cờ tướng | 10 + 5 | 15 + 10 | 4 nửa nước |
| Cờ tướng úp | 10 + 5 | 15 + 10 | 4 nửa nước |
| Cờ vây 9×9 | 5 + 5 | 10 + 10 | 20 nửa nước |
| Caro | 3 + 3 | 5 + 5 | 10 nửa nước |

- Đồng hồ Fischer (cộng giây sau mỗi nước). Máy chủ giữ giờ; trình duyệt chỉ đếm hiển thị và đồng bộ theo `offset` máy chủ.
- **Hủy ván** (không tính Elo): bên đi trước không đi nước đầu trong 30 giây; hoặc ván kết thúc khi chưa đủ số nước ở bảng.
- Mất kết nối: đồng hồ vẫn chạy (người rời đi tự thua khi hết giờ). Hai bên cùng vắng 60 giây → hủy ván.
- Giới hạn an toàn: cờ vua 300 nửa nước, cờ tướng 300, vây 9×9 200, caro kín bàn → hòa.
- Khởi động lại máy chủ: ván đang đấu bị hủy, không tính Elo, báo "Ván trước bị hủy vì máy chủ khởi động lại" (giống `RESTART_MSG` của PK).

### 5.6 Elo và chống "cày" (T-027)

- `expected = 1 / (1 + 10^((Rđối - Rmình)/400))`; `mới = cũ + K × (điểm - expected)`; điểm: thắng 1, hòa 0,5, thua 0. Làm tròn số nguyên. Sàn 100.
- K theo D6. Dưới 10 ván hiện dấu "?" sau Elo (tạm tính).
- **Ván xếp hạng** chỉ khi: chủ bàn chọn "Xếp hạng"; cả hai là tài khoản (khi bật Google); đủ số nước (5.5); cặp này chưa quá 3 ván xếp hạng trong ngày ở môn này (quá thì tự thành giao hữu và báo trước khi bắt đầu). "Bàn trong" xếp hạng như bàn thật và cùng tính vào `KYDAO_MAX_GAMES`.
- Mỗi người, mỗi môn lưu: `{ r, peak, peakAt, n, w, l, d, last }`. `peak` chỉ cập nhật khi `n ≥ 20` (không tính giai đoạn tạm tính).
- Không có thưởng công đức (D16).

### 5.7 Giao thức `kd:*` (bản nháp; T-020 chốt vào `docs/KY-DAO-GIAO-THUC.md`)

Ack chuẩn `{ ok:true, … }` hoặc `{ ok:false, reason, code? }`. Mọi sự kiện bọc trong `kydaoOnly(fn)`: cần `KYDAO_ENABLED`, `bucket('kd', 5, 15)`, try/catch; sự kiện xếp hạng cần `accountReady` (không thì `code:'login'`).

**Trình duyệt → máy chủ**

| Sự kiện | Dữ liệu | Ý nghĩa |
|---|---|---|
| `kd:tables` | `{}` | lấy danh sách bàn (khi vào sân) |
| `kd:sit` | `{ table, seat }` | ngồi ghế (phải đang ở sân; máy chủ cho đi tới ghế như `sit` của bồ đoàn) |
| `kd:setup` | `{ table, game, rated, pace, size? }` | chủ bàn chọn luật (chỉ khi bàn chưa bắt đầu) |
| `kd:ready` | `{ table, ready }` | bấm sẵn sàng |
| `kd:stand` | `{ table }` | rời ghế (đang đấu = đầu hàng, hỏi xác nhận ở trình duyệt) |
| `kd:invite` | `{ toPid, game, rated, pace }` | mời từ hộp người chơi |
| `kd:invite:cancel` / `kd:respond` | `{ inviteId }` / `{ inviteId, accept }` | |
| `kd:move` | `{ gameId, ply, move }` | đi một nước; `ply` phải bằng số nửa nước hiện tại |
| `kd:draw` | `{ gameId, act }`, `act` ∈ `offer`, `accept`, `decline` | xin hòa |
| `kd:resign` | `{ gameId }` | đầu hàng |
| `kd:mark` / `kd:agree` / `kd:resume-play` | `{ gameId, point }` / `{ gameId }` / `{ gameId }` | cờ vây: đánh dấu quân chết |
| `kd:watch` / `kd:unwatch` | `{ table }` | xem / thôi xem |
| `kd:resume` | `{}` | vào lại sau khi tải lại trang |

**Máy chủ → trình duyệt**

| Sự kiện | Gửi cho | Dữ liệu chính |
|---|---|---|
| `kd:table` | mọi người ở sân | `{ table, game?, status, seats, watchers }`; `status` ∈ `free`, `waiting`, `playing`; `seats` = 2 phần tử `{pid,name}` hoặc `null` |
| `kd:invited` / `kd:invite:closed` | người được mời / hai bên | như `pk:invited` |
| `kd:start` | hai người chơi + người xem | `{ gameId, table, game, rated, pace, you?, a:{pid,name,look,elo,title?}, b:{…}, state:view(), clock }`; `you` là `a` hoặc `b`, người xem không có |
| `kd:moved` | hai bên + người xem | `{ gameId, ply, move, text, reveal?, clock:{a,b,turnStartedAt}, status? }` |
| `kd:offer` | đối thủ | `{ gameId, kind:'draw' }` |
| `kd:marks` | hai bên + người xem | cờ vây: `{ gameId, dead:[…], agreed:{a,b} }` |
| `kd:end` | hai bên + người xem | `{ gameId, result, reason, elo?:{a:{from,to},b:{from,to}} }`; `result` ∈ `a`, `b`, `draw`, `abort` |
| `legend:vs` | hai bên + người xem | Epic DH, mục 6.5 |

- Người xem vào phòng Socket.IO `kd:<table>`; tối đa 50 người xem một bàn.
- Kiểm dữ liệu vào: `move` là chuỗi ≤ 8 ký tự, khớp regex của môn; `table` là số nguyên trong `YARD_TABLES`; chỉ đọc trường riêng của object (`hasOwnProperty`, như các handler khác của `server.js`).
- Người khác biết ai đang ngồi bàn nhờ `kd:table` (ghế theo `pid`), không thêm trường vào `publicPlayer`.
- Nhận lời mời đánh cờ từ chánh điện: máy chủ đổi cảnh hai người sang `yard` (`pscene`) và cho đi tới ghế của bàn trống gần nhất.
- Gộp khách → tài khoản: `linkGuest` trong `server.js` gọi `mergeKydaoGuest` (`lib/account.js`), kể cả đường hoàn tác khi flush lỗi.

### 5.8 Bộ quản lý ván (`lib/kydao/manager.js`, T-028)

Chép khuôn của `lib/pk/manager.js` (đã chạy tốt):

- `createKydaoManager(deps)` với `deps = { now, setTimer, clearTimer, newSeed, rngFor, emit(uid, ev, payload), emitRoom(room, ev, payload), isOnline(uid), isAccount(uid), saveGame(record), getRating(uid, game), setRating(uid, game, value), pairCountToday(a, b, game), getActive(uid), setActive(uid, gameId|null), newId, log, config:{ enabled, maxGames, timeScale } }`. `getActive/setActive` lưu ở `db.kydao.active` để sau khi máy chủ khởi động lại vẫn báo được "Ván trước bị hủy…".
- Trạng thái trong RAM: `tables[]`, `games` (id → ván), `gameOfUid`, `invites`, `watchers`.
- Vòng đời ván: `setup → ready → playing → (scoring, chỉ cờ vây) → over`. Hẹn giờ qua `arm/disarm`, có chặn `m.over`; `finish()` gọi bao nhiêu lần cũng chỉ ghi một lần.
- Lưu biên bản: `{ id, at, game, rated, pace, a:{uid,name,eloFrom,eloTo}, b:{…}, result, reason, moves:[…], seed? }` vào `db.kydao.games` (giữ 500 ván gần nhất).
- API công khai bọc `safe()` để không bao giờ ném lỗi ra socket: `tables, sit, stand, setup, ready, invite, cancelInvite, respond, move, draw, resign, mark, agree, resumePlay, watch, unwatch, resume, leave(uid, why), stats, shutdown`.
- Test với đồng hồ giả (`makeClock` như `test/pk-manager.test.js`).

### 5.9 Bảng bàn cờ trên trình duyệt (T-032, T-033, T-034)

```
Máy bàn (bảng 560px giữa cảnh, khung chat bên phải vẫn dùng được)      Điện thoại (toàn màn)
┌───────────────────────────────────┐                                  ┌─────────────────────┐
│ Bàn 2 · Cờ tướng · Xếp hạng  [–][✕]│                                  │ ← Bàn 2 · Cờ tướng   │
│ ● Đối thủ  Kỳ Vương  1532   04:51  │                                  │ Đối thủ 1532  04:51 │
│ ┌───────────────────────────────┐ │                                  │ ┌─────────────────┐ │
│ │          bàn cờ (canvas)        │ │                                  │ │   bàn cờ        │ │
│ └───────────────────────────────┘ │                                  │ └─────────────────┘ │
│ ● Bạn  1498?               05:00  │                                  │ Bạn 1498?    05:00  │
│ [Xin hòa] [Đầu hàng] [Nước đi ▾]  │                                  │ [Hòa][Hàng][Nước ▾] │
└───────────────────────────────────┘                                  └─────────────────────┘
```

- Bên mình luôn ở dưới. Chạm quân → chấm các ô đi được → chạm ô đích. Kéo thả là tùy chọn sau.
- Tô nước vừa đi, tô đỏ Vua/Tướng đang bị chiếu. Cờ vua có hộp chọn quân phong cấp.
- Âm thanh: tiếng gỗ khi đi, tiếng đanh khi ăn quân, tiếng chuông nhỏ khi chiếu. Tạo bằng WebAudio trong `audio.js` (không thêm file âm thanh), tắt khi tắt tiếng.
- Danh sách nước dạng chữ, có `aria-live="polite"` đọc nước của đối thủ ("Đối thủ: Pháo 2 bình 5").
- Nút "–" thu nhỏ bảng thành chip "Đang đánh cờ · 04:51" ở góc cảnh; chạm để mở lại.
- Giảm chuyển động: quân nhảy thẳng, không trượt.
- Quân cờ vua: bộ "cburnett" (giấy phép BSD/GPL/CC BY-SA, chọn BSD, ghi NOTICE) dạng SVG nội tuyến, hoặc vẽ bằng mã. Không dùng ký tự ♔ vì font điện thoại vẽ không đều.
- Quân vây: hình tròn có đổ sáng. Caro: X đỏ, O xanh vẽ nét.
- `tools/ui-harness/kydao/` (T-035): máy chủ giả + fixture các thế cờ, chụp 3 cỡ màn, lỗi console là trượt.

### 5.10 Sau đợt (thẻ ở Hộp thư đến)

- **Sư Kỳ**: đối thủ máy chạy trên trình duyệt (Web Worker), 3 mức, chỉ giao hữu. Giữ bàn cờ sống khi vắng người.
- **Học luật**: mỗi môn một bài tương tác 5 bước (chạm quân xem cách đi).
- **Cờ thế mỗi ngày**: cờ vua lấy từ kho thế cờ Lichess (giấy phép CC0), cờ tướng từ thế cổ (sách xưa, hết bản quyền) do người soạn lại.
- **Xem lại ván, chia sẻ ván** (PGN cho cờ vua, biên bản kiểu Việt cho cờ tướng).

---

## 6. Epic DH · Danh hiệu, Bảng Vàng, màn đối đầu

### 6.1 Bảng danh hiệu

| Hạng mục | "Lịch sử" (tên đề xuất) | "Hiện tại" (tên đề xuất) | Cách tính | Điều kiện để giữ |
|---|---|---|---|---|
| Công đức | **Vô Lượng Công Đức** | **Thiện Tâm Đương Mùa** | Lịch sử: `total` cao nhất. Hiện tại: công đức trong mùa (tháng âm lịch) cao nhất. | Tài khoản (khi bật Google). Lịch sử ≥ 1.000; hiện tại ≥ 100. |
| PK (luận võ) | **Võ Lâm Chí Tôn** | **Đương Kim Minh Chủ** | Lịch sử: điểm chiến tích (3 × thắng + hòa) tích lũy cao nhất. Hiện tại: điểm chiến tích trong mùa cao nhất. | Lịch sử ≥ 10 trận; hiện tại ≥ 3 trận trong mùa. |
| Cờ vua / Cờ tướng / Cờ tướng úp / Cờ vây / Caro | **Kỳ Thánh \<môn\>** | **Kỳ Vương \<môn\>** | Lịch sử: `peak` Elo cao nhất. Hiện tại: Elo đang có cao nhất. | ≥ 20 ván xếp hạng; "hiện tại" phải có ván xếp hạng trong 30 ngày. |

- Hòa điểm: ai đạt trước giữ danh hiệu (so `at` / `peakAt`).
- Các ngưỡng (1.000, 100, 10 trận, 20 ván, 30 ngày) là hằng số trong `lib/records.js`, đọc được từ biến môi trường (`TITLE_MIN_GAMES`…). Lúc đầu chùa ít người có thể hạ xuống (ví dụ 5 ván) để danh hiệu không bỏ trống quá lâu.
- Một người giữ được nhiều danh hiệu. Trên đầu chỉ hiện **1** danh hiệu (thứ tự ưu tiên: lịch sử trước hiện tại; PK, Cờ tướng, Cờ vua, Cờ tướng úp, Cờ vây, Caro, Công đức). Hộp người chơi hiện đủ.
- Một người giữ cả "lịch sử" và "hiện tại" của cùng hạng mục: hiện danh hiệu ghép "**Thiên Hạ Vô Song · \<hạng mục\>**" (vương miện vàng nhỏ).
- Màu: lịch sử = mực đen viền vàng; hiện tại = son đỏ viền vàng.
- Tên đề xuất, chủ dự án đổi được trong một bảng duy nhất (`TITLES` trong `lib/records.js`, gửi xuống qua `/api/config`).
- Hết mùa (00:00 giờ Việt Nam ngày mùng 1 âm lịch): ghi người giữ "hiện tại" của mùa cũ vào sổ "Các đời" rồi tính lại.

### 6.2 Dữ liệu cần thêm (T-029, T-040)

- `db.merit[uid]` thêm `season: { key, v }` (giống cách `today/day` reset lười). Khóa mùa: `"<năm âm>-<tháng âm>[n]"`, ví dụ `"2026-10"`, tháng nhuận thêm `n`. Tính bằng `lunar.js` (đã `require` được ở Node).
- `db.martial.profiles[uid]` thêm `season: { key, pts, n }` và `name` (tên gần nhất, để Bảng Vàng hiện được khi người đó vắng). Mặc định trong `norm()` (T-040). Tên được ghi qua `setName(uid, name)` từ lớp bọc `recordResult` trong `server.js` (T-041), vì `recordResult` gốc không nhận tên.
- `db.kydao = { ratings:{ uid:{ name, chess:{…}, xiangqi:{…}, jieqi:{…}, go:{…}, gomoku:{…} } }, games:[ { id, … } ], active:{ uid: gameId } }`.
- `db.records = { log:[ { id, at, cat, kind:'history'|'season', name, v, season? } ] }` (giữ 300 dòng) cho mục "Các đời".
- **Mọi dòng trong danh sách lưu bền phải có `id`** (lấy từ `store.nextId()`): `lib/store-sections.js` dùng `id` làm khóa khi ghi PostgreSQL theo chênh lệch; thiếu `id` thì mỗi lần cắt bớt sẽ ghi lại cả mục.
- **Gộp khách → tài khoản nằm ở `linkGuest` trong `server.js`** (không phải `lib/account.js`): hàm này dựng lại dòng công đức `{name,total,today,day}` nên phải thêm `season` (T-041); Elo cờ gộp bằng `mergeKydaoGuest` (T-029 viết, T-030 gọi); điểm mùa PK gộp trong `mergeMartialGuest` (T-040).
- Hai khóa cấp cao mới `kydao`, `records` → thêm vào `fresh()` + `SECTIONS` + `adopt()` + `unknownKeys` trong `lib/store-sections.js`, thêm vào `fill()` của `test/store-json.test.js` và `test/store-pg.test.js` (AGENTS.md §3.11). **Một thẻ duy nhất (T-029) chạm file này.**

### 6.3 Tính và phát danh hiệu (T-040, T-041)

- `lib/records.js` thuần: `holders(db, now) → { 'merit.history': {uid, name, v, at}, 'merit.season': …, 'pk.history': …, … }`, `TITLES`, `priority`, `seasonKey(now)`. Quét O(n), gọi mỗi 60 giây và khi có kết quả trận/ván, giữ kết quả trong RAM.
- Máy chủ:
  - `publicPlayer(p).tt` = mảng mã danh hiệu người đó đang giữ (ví dụ `['xiangqi.now','merit.history']`), **không có uid**.
  - Sự kiện `ptt { id, tt }` khi đổi.
  - Sự kiện `titles` (ảnh chụp người giữ: `{ cat: { name, v } }`, chỉ tên) cho Bảng Vàng.
  - Khi danh hiệu đổi chủ: dòng `ticker` "X vừa trở thành Kỳ Vương Cờ Tướng." (tối đa 1 dòng / 5 phút / hạng mục) và một dòng vào `db.records.log`.
  - Hết mùa: ghi người giữ "hiện tại" của mùa cũ vào `db.records.log` trước khi tính lại.
- Test bảo mật: mở rộng `test/e2e-security.test.js` để chắc không gói `ptt`, `titles`, `kd:*`, `legend:vs` nào chứa uid.

### 6.4 Hiển thị (T-042) và Bia Bảng Vàng (T-043)

- Trên đầu: một viên danh hiệu nhỏ phía trên tên, ở mọi cảnh (hiện chỉ cảnh `arena` có "tagger"; tổng quát hóa). Ở Sân đấu vẫn giữ nhãn "Cấp N" như cũ, danh hiệu đặt trên đó.
- Hộp người chơi (`#dlg-person`): mục "Danh hiệu" liệt kê đủ, có câu giải thích mỗi danh hiệu.
- Danh sách người ở Sân đấu: thêm danh hiệu PK (nếu có).
- **Bia Bảng Vàng**: tấm bia đá có mái nhỏ đặt trước bậc thềm chánh điện ở Sân chùa (≈ (0,5; 0,34)), nhãn "BẢNG VÀNG · Chạm để xem". Mở hộp "Bảng Vàng":
  - Tab: Công đức · Luận võ · Cờ tướng · Cờ tướng úp · Cờ vua · Cờ vây · Caro.
  - Mỗi tab: hai thẻ người giữ ("Lịch sử" / "Hiện tại"), top 10 hiện tại, mục "Các đời" (từ `db.records.log`).
  - Cũng mở được từ tab "Khám phá".

### 6.5 Màn "Kẻ mạnh nhất lịch sử… đối đầu kẻ mạnh nhất hiện tại" (T-044)

**Khi nào hiện**

- PK: lúc trận vào sảnh (`pk:lobby`), nếu một bên giữ `pk.history` và bên kia giữ `pk.season`, khác người.
- Cờ: lúc ván bắt đầu (`kd:start`), cùng môn, một bên giữ `<môn>.history`, bên kia giữ `<môn>.now`.
- Gửi `legend:vs { cat, where:'pk'|'kd', history:{ name, look, title }, now:{ name, look, title } }` cho hai người chơi và người xem. Phát `ticker` cho cả chùa: "Trận đấu của thời đại ở Bàn 2: A (Kỳ Thánh Cờ Tướng) đối đầu B (Kỳ Vương Cờ Tướng)." Mỗi cặp tối đa 1 ticker / 30 phút.
- **Là bất ngờ, không giải thích trong Sổ tay** (chỉ giải thích danh hiệu).

**Hình (tự vẽ, không dùng tranh Jujutsu Kaisen)**

```
┌────────────────────────┬─╲──────────────────────┐
│ ░░ tranh đen trắng ░░  │   ╲   ░░ tranh đen trắng│
│  nhân vật người A      │    ╲   nhân vật người B │
│  (lịch sử)             │     ╲  (hiện tại)       │
│ ┌────────────────┐     │      ╲     ┌──────────┐│
│ │KẺ MẠNH NHẤT    │     │       ╲    │…ĐỐI ĐẦU  ││
│ │LỊCH SỬ…        │     │        ╲   │KẺ MẠNH   ││
│ └────────────────┘     │         ╲  │NHẤT      ││
│  Tên A · Kỳ Thánh      │          ╲ │HIỆN TẠI. ││
│                        │           ╲└──────────┘│
└────────────────────────┴────────────╲───────────┘
```

- Hai khung truyện cách nhau bằng rãnh trắng chéo. Nhân vật là **chính hình đại diện trong game** của hai người (vẽ bằng `Hall`/`drawAvatar` lên canvas phụ, phóng to), chuyển sang kiểu mực: xám, tăng tương phản, chấm lưới (screentone) bằng CSS, nền tia tốc độ.
- Khung chữ: chữ nhật trắng, viền đen 2px, chữ in hoa có chân. Hiện theo hai nhịp: khung 1, nửa giây sau khung 2 (đúng nhịp của tranh gốc).
- Dòng nhỏ dưới mỗi bên: tên + danh hiệu. Dòng phụ: "Cờ tướng · Bàn 2" hoặc "Sân đấu".
- 4,5 giây, chạm để bỏ qua sau 0,9 giây. Giảm chuyển động: ảnh tĩnh 3 giây. Âm: một tiếng trống trầm + tiếng quét bút (WebAudio), theo công tắc âm thanh.
- Công tắc "Màn đối đầu huyền thoại" trong thẻ "Hiệu ứng" (mặc định bật, lưu `ta-legend`).
- Dựng theo khuôn `public/js/celebrate.js` (lớp phủ `popover="manual"`, khung cố định, không chèn dữ liệu người dùng qua `innerHTML`). File mới `public/js/legend.js`, `public/css/legend.css` (tiền tố `lg-`).
- Ghi vào `public/img/NOTICE.txt`: "Màn đối đầu vẽ bằng mã, lấy cảm hứng từ một câu thoại meme; không dùng hình ảnh của tác phẩm gốc."

---

## 7. Epic BT · Bói toán chính xác hơn

### 7.1 Xin xăm (T-051)

- Chỉ còn một cách: **chạm hũ "XĂM" trên bàn thờ** (nút đã bỏ ở T-010).
- Máy chủ (T-051): thêm `bucket('fortune', 0.5, 4)` cho `fortune:join`/`fortune:leave`, đặt **sau** kiểm tra cảnh (test `e2e-scene` hiện gọi `fortune:join` 4 lần trong khoảng 1 giây); đổi `Math.random` sang `crypto.randomInt`. Giữ 12 quẻ (mở rộng 100 quẻ là ý ở mục 9).
- Trình duyệt (T-053, vì thẻ này sửa `fortune.js`): đếm ngược hàng đợi dùng giờ máy chủ (`offset`) thay vì giờ máy người dùng; dừng `setInterval` khi đóng hộp.

### 7.2 Tarot theo chủ đề (T-051, T-052, T-053)

**Bước 1 · Chọn chủ đề** (lưới 2 × 4 nút lớn có biểu tượng, không ô gõ chữ):

| # | Mã | Nhãn | Ghi chú |
|---|---|---|---|
| 1 | `overview` | Tổng quan sắp tới | |
| 2 | `career` | Sự nghiệp, công danh | thăng tiến, hướng đi, chuyển việc |
| 3 | `work` | Công việc hằng ngày | đồng nghiệp, dự án, áp lực |
| 4 | `money` | Tiền bạc, tài lộc | thu chi, đầu tư (nhắc: không phải lời khuyên tài chính) |
| 5 | `love` | Tình duyên | hỏi thêm: "Đang một mình" / "Đang có đôi" |
| 6 | `family` | Gia đạo, người thân | |
| 7 | `health` | Sức khỏe, tinh thần | luôn kèm câu "Tarot không thay lời thầy thuốc" |
| 8 | `study` | Học hành, thi cử | |

**Bước 2 · Khung thời gian:** "7 ngày tới" · "30 ngày tới" (mặc định) · "3 tháng tới".

**Bước 3 · Trải 5 lá** (hình chữ thập nhỏ; lá lật lần lượt, chạm để lật nhanh):

| Vị trí | Tên | Câu dẫn |
|---|---|---|
| 1 (giữa) | Hiện tại | "Lúc này, chuyện \<chủ đề\> của bạn…" |
| 2 (trái) | Điều cản trở | "Điều đang làm bạn vướng là…" |
| 3 (phải) | Điều nâng đỡ | "Bạn có thể dựa vào…" |
| 4 (trên) | **Lời khuyên** | "Thầy khuyên bạn…" (lá này in đậm, khung vàng) |
| 5 (dưới) | Xu hướng sắp tới | "Nếu giữ hướng hiện tại, trong \<khung\> tới…" |

**Bước 4 · Lời thầy tổng hợp** (5–8 câu, giọng hiền, không hù dọa, không phán chắc):

- Từ 3 lá Ẩn chính (Major) trở lên: "giai đoạn có thay đổi lớn, nhiều điều nằm ngoài tầm tay; giữ tâm bình". Không có lá Ẩn chính: "chuyện đời thường, nằm trong tay bạn".
- Một bộ chiếm từ 2 lá: Gậy (hành động, nhiệt huyết), Cốc (cảm xúc, quan hệ), Kiếm (suy nghĩ, căng thẳng, quyết định), Tiền (tiền bạc, công việc, thân thể).
- Từ 3 lá ngược: "năng lượng đang bị chặn; nên chậm lại, xem lại cách làm".
- Từ 2 lá Hoàng gia (Tiểu Đồng, Hiệp Sĩ, Nữ Hoàng, Vua): "có người khác tác động; để ý lời họ".
- Nhắc lại ý chính của lá 4 (Lời khuyên) và lá 5 (Xu hướng).
- Câu kết theo chủ đề (sức khỏe: đi khám khi cần; tiền bạc: cân nhắc kỹ, đây không phải lời khuyên đầu tư).

**Rút bài ở máy chủ** (`tarot:draw { topic, span, status? }`):

- Hạt giống = `sha256(uid | vnDay | topic | span | status)` → `makeRng` → Fisher–Yates trên 78 lá, lấy 5 lá; mỗi lá ngược nếu `rng() < 0.5`.
- Trả `{ ok, cards:[{ id, rev }], again:boolean }`. `again = true` khi người này đã rút đúng bộ đó hôm nay (lưu trong RAM theo uid trong ngày; mất khi khởi động lại cũng không sao vì kết quả vẫn y hệt nhờ hạt giống).
- Hộp hiện "Hôm nay thầy đã trải chủ đề này cho bạn rồi. Quẻ vẫn vậy; ngày mai hãy hỏi lại." khi `again`.
- `bucket('tarot', 0.2, 3)`. Không cộng công đức. Không lưu bền.

**Nội dung** `public/data/tarot.vi.json` (nạp khi mở hộp tarot, có `?v=`):

```json
{
  "version": 1,
  "source": "Ý nghĩa truyền thống theo A. E. Waite, The Pictorial Key to the Tarot (1910, phạm vi công cộng); lời văn tiếng Việt viết mới.",
  "cards": [
    {
      "id": 0, "arcana": "major", "suit": null, "rank": 0,
      "vi": "Chàng Khờ", "en": "The Fool",
      "keys": { "up": "khởi đầu, tin tưởng, tự do", "rev": "liều lĩnh, thiếu chuẩn bị" },
      "general": { "up": "2–3 câu", "rev": "2–3 câu" },
      "topic": {
        "overview": { "up": "1–2 câu", "rev": "1–2 câu" },
        "career": { "up": "…", "rev": "…" }, "work": { … }, "money": { … },
        "love_single": { … }, "love_couple": { … },
        "family": { … }, "health": { … }, "study": { … }
      },
      "advice": { "up": "1 câu mệnh lệnh nhẹ", "rev": "1 câu" }
    }
  ],
  "positions": { "present": "…", "obstacle": "…", "support": "…", "advice": "…", "outlook": "…" },
  "synthesis": { "majorMany": "…", "majorNone": "…", "suit": { "wands": "…" }, "reversedMany": "…", "courtMany": "…", "closing": { "health": "…" } }
}
```

- 78 lá × (keys + general + 9 chủ đề + advice) × 2 chiều ≈ 1.900 câu, khoảng 180 KB. Có test kiểm đủ trường, không trùng câu, không câu rỗng, độ dài 20–260 ký tự.
- Tên tiếng Việt 22 lá Ẩn chính: Chàng Khờ, Nhà Ảo Thuật, Nữ Tư Tế, Hoàng Hậu, Hoàng Đế, Giáo Hoàng, Tình Nhân, Cỗ Xe, Sức Mạnh, Ẩn Sĩ, Bánh Xe Số Phận, Công Lý, Người Treo Ngược, Cái Chết (sự chuyển hóa), Tiết Độ, Ác Quỷ, Tòa Tháp, Ngôi Sao, Mặt Trăng, Mặt Trời, Phán Xét, Thế Giới. Bốn bộ: Gậy, Cốc, Kiếm, Tiền. Hoàng gia: Tiểu Đồng, Hiệp Sĩ, **Nữ Hoàng** (Queen, để không trùng lá Ẩn chính "Hoàng Hậu" là Empress), Vua.
- **Quy ước `id`:** 0–21 là Ẩn chính theo thứ tự Rider–Waite (Sức Mạnh = 8, Công Lý = 11); 22–35 Gậy, 36–49 Cốc, 50–63 Kiếm, 64–77 Tiền. Trong mỗi bộ `rank` 1–14: 1 Át, 2–10, 11 Tiểu Đồng, 12 Hiệp Sĩ, 13 Nữ Hoàng, 14 Vua. Máy chủ (T-051) và dữ liệu (T-052) dùng chung quy ước này.
- Mã chủ đề gửi lên máy chủ: `overview`, `career`, `work`, `money`, `love`, `family`, `health`, `study`; với `love` thêm `status` là `single` hoặc `couple`; khóa nội dung tương ứng là `love_single` / `love_couple`.
- **Không chép** từ các trang tarot hiện đại (Biddy Tarot, Labyrinthos…). Viết mới, đúng tinh thần truyền thống. Lá "Cái Chết" luôn giải thích là kết thúc để bắt đầu, không phải chết thật.
- Ảnh lá bài (tùy chọn, sau): bản quét bộ Rider–Waite–Smith 1909 gốc (phạm vi công cộng) từ Wikimedia Commons, ghi `PHOTO-CREDITS.txt`. Không dùng các bản tô màu lại có bản quyền.

### 7.3 Tử Vi Đẩu Số (T-050, T-054 → T-057)

**Nhập liệu**

- Ngày sinh: chọn **Dương lịch / Âm lịch**. Âm lịch có ô "tháng nhuận".
- Giờ sinh: 12 canh giờ, mỗi dòng ghi khoảng giờ (Tý 23:00–00:59, Sửu 01:00–02:59, …) + "Không nhớ giờ".
- Giới tính: Nam / Nữ (dùng để tính thuận/nghịch đại vận).
- Năm xem: mặc định năm âm hiện tại.
- Tên (không bắt buộc, chỉ để in lên lá số, không gửi đi).
- "Nâng cao": sinh 23:00–23:59 tính sang ngày sau (mặc định bật); tháng nhuận tính như tháng chính (mặc định).
- "Nhớ thông tin trên máy này" (không bật sẵn, lưu `ta-tuvi`).

**Tính toán (`public/js/tuvi.js`, UMD, global `TUVI`)**: các bước và công thức ở **Phụ lục B**.

1. Âm lịch, can chi năm/tháng/ngày/giờ.
2. Âm Dương Nam Nữ.
3. Cung Mệnh, cung Thân; can của 12 cung (Ngũ Hổ Độn).
4. Bản mệnh (nạp âm năm sinh), Cục (nạp âm can chi cung Mệnh).
5. An Tử Vi (theo Cục + ngày âm), Thiên Phủ, 14 chính tinh.
6. Độ sáng (miếu, vượng, đắc, bình, hãm) của 14 chính tinh theo bảng.
7. Phụ tinh bản đầu (đủ để luận cơ bản): Tả Phù, Hữu Bật, Văn Xương, Văn Khúc, Thiên Khôi, Thiên Việt, Lộc Tồn, Kình Dương, Đà La, Thiên Mã, Hỏa Tinh, Linh Tinh, Địa Không, Địa Kiếp, Tứ Hóa (Lộc, Quyền, Khoa, Kỵ), vòng Tràng Sinh 12 sao, Tuần, Triệt, Đào Hoa, Hồng Loan, Thiên Hỷ, Thiên Hình, Thiên Diêu, Thái Tuế (chi năm).
8. Đại vận (10 năm/vận, bắt đầu từ số Cục, thuận/nghịch theo Âm Dương Nam Nữ), tiểu vận, lưu niên (lưu Thái Tuế, lưu Tứ Hóa, lưu Lộc Tồn, lưu Kình Đà, lưu Thiên Mã).
9. Không nhớ giờ: chỉ hiện phần không cần giờ (bản mệnh, can chi, Tứ Hóa năm, sao theo năm, lưu niên theo tuổi); ẩn 12 cung, nói rõ vì sao.

**Đầu ra**

- **Lá số**: lưới 4 × 4 (12 cung xung quanh, ô giữa ghi thông tin: tên, ngày giờ dương/âm, Âm Dương Nam Nữ, bản mệnh, cục, chủ mệnh, chủ thân, năm xem). Điện thoại: ô thông tin + danh sách 12 cung dạng mở/gập, kèm sơ đồ 4 × 4 thu nhỏ để chạm.
- Màu sao theo ngũ hành; độ sáng ghi chữ nhỏ (M, V, Đ, B, H).
- **Luận giải** (`public/data/tuvi.vi.json`):
  - Tổng quan: Mệnh – Thân – Cục – Bản mệnh, sinh khắc giữa Bản mệnh và Cục (ví dụ "Mệnh Kim, Cục Thổ: Cục sinh Mệnh, thuận").
  - Cung Mệnh chi tiết: chính tinh + độ sáng + phụ tinh đi kèm + cách cục nổi bật.
  - 11 cung còn lại: mỗi cung 2–4 câu.
  - Đại vận đang đi (tuổi X–Y): cung nào, sao gì, ý chính.
  - Năm xem: lưu Thái Tuế, lưu Tứ Hóa rơi vào cung nào.
  - Giữ phần "3 tháng tới theo tuổi" hiện có (tam hợp / lục xung), thêm lục hợp, hình, hại, phá.
- Khung nội dung: 14 chính tinh × 12 cung × 2 nhóm sáng (miếu-vượng-đắc / bình-hãm) ≈ 336 đoạn; ~25 phụ tinh × 1 đoạn chung; ~40 cách cục (Tử Phủ đồng cung, Sát Phá Tham, Cơ Nguyệt Đồng Lương, Nhật Nguyệt tịnh minh, Tả Hữu giáp Mệnh, Lộc Mã giao trì, Không Kiếp giáp Mệnh, Mệnh vô chính diệu…); Tứ Hóa × 12 cung; Tuần/Triệt.
- Lời văn viết mới, không chép sách còn bản quyền (sách Thái Thứ Lang, Nguyễn Phát Lộc… chỉ dùng làm nguồn tra quy tắc, không chép câu).
- Tuyên bố: "Lá số để tham khảo và chiêm nghiệm, không quyết định số phận. Ngày sinh chỉ tính trên máy của bạn."

**Kiểm chứng (quan trọng nhất của phần này)**

- Test bất biến: mỗi chính tinh xuất hiện đúng một lần; Thiên Phủ đối xứng Tử Vi qua trục Dần–Thân (`phu = (4 - tuvi) mod 12`, Tý = 0); các khoảng cách trong chuỗi Tử Vi / Thiên Phủ; Tả–Hữu, Xương–Khúc đối xứng; Kình Dương và Đà La kẹp Lộc Tồn.
- Bảng an Tử Vi đủ 5 Cục × 30 ngày so với bảng in trong sách (T-055 lập).
- **12 lá số mẫu** (`test/fixtures/tuvi-golden.json`): chủ dự án hoặc T-055 lập từ **hai** công cụ tử vi Việt Nam khác nhau; phải khớp 100% vị trí 14 chính tinh, Mệnh, Thân, Cục, Tứ Hóa. Phụ tinh lệch giữa các trường phái thì ghi rõ ở `docs/TU-VI-QUY-UOC.md`. Lá số trước 1968: chọn ngày không nằm trong 927 ngày lệch UTC+7/UTC+8 (phần lớn công cụ Việt dùng UTC+7 cho mọi năm), hoặc ghi rõ quy ước.
- Đối chiếu tự động (chỉ khi phát triển, không thêm vào `package.json`; T-054 làm): công cụ `tools/tuvi-crosscheck/` dùng thư viện `iztro` (MIT, trường phái Trung Quốc) để so 14 chính tinh, Mệnh/Thân, Cục trên 10.000 bộ ngày giờ ngẫu nhiên. **Đưa vào `iztro` ngày âm + giờ**, không đưa ngày dương, vì `iztro` đổi lịch theo UTC+8 nên lệch lịch Việt Nam ở một số ngày (ví dụ Tết 1985, Tết 2007). Danh sách khác biệt có chủ đích ghi trong `docs/TU-VI-QUY-UOC.md`.

**Lịch âm (T-050)**

- Viết lại `public/js/lunar.js` độc lập (D12) từ công thức thiên văn (Jean Meeus, *Astronomical Algorithms*): ngày Julius, trăng mới, kinh độ Mặt Trời, tháng 11 chứa Đông chí, tháng nhuận là tháng không có trung khí.
- Múi giờ: **UTC+7 từ năm 1968, UTC+8 trước đó** (lịch Việt Nam trước 1968 tính theo múi giờ Trung Hoa). Đây là lý do Tết Mậu Thân 1968 ở miền Bắc và miền Nam lệch một ngày. Soát (Gemini Argon) kiểm lại mốc chuyển với nguồn trước khi merge.
- Thêm: âm → dương, can chi ngày/tháng/giờ, nạp âm 60 hoa giáp, 24 tiết khí (để dùng cho mùa và lễ hội sau này).
- Giữ API cũ (`Lunar.toLunar`, `Lunar.describe`) để đầu trang vẫn chạy.
- Test: các Tết 1900–2100 (so bảng đã biết), tháng nhuận 2017–2033, 4 ngày lệch trước 1968, ngày 23:00 chuyển giờ Tý, ngày cuối tháng 29/30.

---

## 8. Epic HD · Hướng dẫn cho người mới

### 8.1 Cách làm

1. **Quy tắc chữ + bảng thuật ngữ + danh sách bí mật** (T-060) viết trước, mọi thẻ chữ sau đều theo.
2. **Sổ tay** (T-061): một nơi đọc đủ mọi cơ chế.
3. **Gợi ý lần đầu** (T-062): ngắn, đúng chỗ, hiện một lần.
4. **Viết lại chữ từng màn** (T-063, T-064, T-065): theo bảng "chữ cũ → chữ mới".
5. **Bài kiểm người mới** (T-066): một mô hình nhỏ chỉ được xem giao diện, trả lời 25 câu hỏi; câu sai thành thẻ mới.

### 8.2 Quy tắc chữ (tóm tắt; T-060 viết đầy đủ ở `docs/HUONG-DAN-VIET.md`)

- Viết cho người **lần đầu vào chùa và chưa từng chơi game**. Gọi "bạn". Giọng hiền, nhà chùa, không văn hoa.
- Câu ≤ 20 chữ. Động từ đầu câu cho hướng dẫn ("Chạm bát hương để thắp nhang").
- Mỗi cơ chế trả lời đủ 3 ý: **làm gì → được gì → giới hạn gì** (thời gian chờ, số lần, cần đăng nhập không).
- Có số thì ghi số ("+10 công đức", "đợi 15 giây").
- **Một khái niệm, một tên.** Từ mới giải thích ngay lần đầu xuất hiện hoặc có chấm "?" mở bảng thuật ngữ.
- Không giải thích bí mật (8.5). Không hứa điều mã không làm.

### 8.3 Bảng thuật ngữ chuẩn (bản đầu, T-060 hoàn thiện)

| Từ | Nghĩa dùng trong game (một câu) | Thay cho / tránh |
|---|---|---|
| Công đức | Điểm tích được khi lễ Phật, tụng kinh, cúng dường. Có "hôm nay" và "tổng". | |
| Pháp tướng | Vầng hình hiện sau lưng khi **tổng** công đức đạt mốc (100, 500, 1.000, 5.000, 10.000, 50.000). | |
| Quỷ ám | Hình quỷ đi theo khi tổng công đức âm (do nói tục). | |
| Hào quang | Vòng sáng quanh người vừa cúng dường; có 9 **tầng**, sáng trong vài phút. | "cảnh giới hào quang" (đề xuất đổi) |
| Mùa | Một tháng âm lịch, từ mùng 1 đến cuối tháng. Dùng cho danh hiệu "hiện tại". | |
| Nội công | Hệ thống tu luyện ở Võ Học Các; có **cấp** 1–10. | |
| Công lực | Điểm kinh nghiệm nội công; đủ thì lên cấp. | |
| Cảnh giới | **Tên** của cấp nội công (Sơ Nhập Võ Đạo…). Chỉ dùng cho nội công. | |
| Tâm đắc | Điểm hiểu biết từng nhánh Cương / Tốc / Nhu; cần để học chiêu khó. | |
| Cương · Tốc · Nhu | Ba nhánh võ: mạnh và chịu đòn · nhanh và né · mềm và phản đòn. | Chỉ số nhanh/chậm của chiêu gọi đủ là "tốc độ", không gọi tắt "Tốc" để khỏi nhầm với nhánh Tốc |
| Nội lực | Thanh năng lượng **trong trận**; mỗi chiêu tốn nội lực. | không dùng cho nghĩa khác |
| Chiêu · Bộ chiêu | Một đòn võ · 4 chiêu mang vào trận. | |
| Thành thạo | Mức luyện một chiêu (tới "Đại viên mãn"). | "thuần thục" |
| Điểm chiến tích | 3 × số trận thắng + số trận hòa ở Sân đấu. | |
| Bậc chiến tích | 9 bậc theo điểm chiến tích (Tay Mơ Tập Võ … Độc Cô Cầu Bại). | "Danh hiệu PK" (đang dùng ở Võ Học Các, Sân đấu; đổi để không lẫn với danh hiệu dưới) |
| Danh hiệu | Chỉ dùng cho danh hiệu "lịch sử" / "hiện tại" của người đứng đầu (Kỳ Thánh, Võ Lâm Chí Tôn…). | |
| Map | Khu vực đi lại được: Chánh điện, Sân chùa, Tàng Kinh Các, Sân đấu. Đổi bằng thanh đổi map. | "cảnh" (tên trong mã) |
| Nơi | Màn hình riêng không đi lại được: Võ Học Các. | |
| Luận võ (PK) | Đấu 1 đối 1 ở Sân đấu. | "PK" chỉ dùng trong ngoặc |
| Elo | Điểm sức cờ từng môn; thắng người mạnh hơn được cộng nhiều. | |
| Ván xếp hạng · giao hữu | Ván có / không tính Elo. | |
| Tịnh tài | Tiền cúng dường. | |
| Tùy hỷ | Vui theo việc lành của người khác (chạm "Tùy hỷ" dưới lời nguyện). | |
| Đạo hữu | Người cùng vào chùa. | |

### 8.4 Sổ tay (T-061)

- Nút "?" ở thanh trên cùng (D15). Hộp lớn, bên trái là mục lục, bên phải là nội dung; điện thoại: mục lục là danh sách, chạm vào để đọc.
- Nội dung trong `public/data/so-tay.vi.json` (dữ liệu, không phải HTML; dựng bằng `h()`).
- Mục lục:
  1. **Bắt đầu**: đi lại (chạm sàn, phím mũi tên/WASD), đổi map, thanh lễ Phật, khung bên phải.
  2. **Lễ Phật và công đức**: từng việc được bao nhiêu điểm, đợi bao lâu; hôm nay và tổng; mốc chúc mừng (chỉ là hiệu ứng); bị trừ khi nào.
  3. **Tụng kinh chung**: ai khởi tụng, nghe cùng nhau thế nào, +15 công đức khi bài kết thúc cho người có mặt.
  4. **Cúng dường và hào quang**: tiền đi đâu, tối thiểu 10.000đ, xác nhận ra sao, 9 tầng hào quang.
  5. **Nói chuyện bằng giọng và chat**: đứng gần thì nghe rõ, điều bị chặn (số tài khoản, đường link).
  6. **Sân chùa**: thầy Tử vi, thầy Tarot, bàn cờ, Bảng Vàng.
  7. **Bàn cờ (Kỳ Đạo)**: 5 môn, cách ngồi, mời, xem, Elo, ván xếp hạng, đồng hồ, hủy ván.
  8. **Tàng Kinh Các**: đọc kinh, ngồi thiền (tu luyện nội công).
  9. **Võ Học Các**: tu luyện, học chiêu, bộ chiêu, nhánh Cương/Tốc/Nhu, hoàn thành ngay.
  10. **Sân đấu**: luật một trận (chọn kín, lật cùng lúc, 20 giây/lượt, nội lực, nộ, sơ hở, hết 40 lượt, bỏ 3 lượt là thua), mời, chặn, rời trận.
  11. **Danh hiệu**: điểm chiến tích, danh hiệu lịch sử/hiện tại, mùa.
  12. **Tài khoản**: đăng nhập Google để giữ gì; khách mất gì.
  13. **Bảng thuật ngữ** (8.3).
- Số liệu trong Sổ tay **lấy từ mã**, không gõ tay: viết chỗ giữ chỗ như `{EARN.incense}`, `{PK.TURN_SECONDS}`, thay bằng giá trị của `MERIT.EARN`, `MARTIAL.PK`, `/api/config` lúc hiện. Test kiểm mọi chỗ giữ chỗ đều thay được. `IDLE_FORFEIT_TURNS` hiện chỉ có ở `lib/pk/rules.js`: T-061 thêm vào `MARTIAL.PK` (kèm ca kiểm đồng bộ).
- `h()` của `dojo.js`/`arena.js` là hàm cục bộ; file mới tự định nghĩa helper riêng.

### 8.5 Bí mật không giải thích (và chỗ đang lộ cần sửa)

| Bí mật | Ở đâu trong mã | Đang lộ ở | Việc cần làm |
|---|---|---|---|
| Đúng 666 tổng công đức → Ma Vương + buff PK | `merit.js`, `server.js` | `app.js` (dòng mô tả bậc quỷ) nói rõ hiệu ứng và buff | T-065 viết lại câu đó, không nhắc 666 và buff |
| Hù ở mốc 666 trong ngày | `celebrate.js`, `server.js` | Thẻ "Hiệu ứng": "Cho phép hù ở mốc 666" | Đổi thành "Cho phép hiệu ứng bất ngờ" (giữ công tắc vì có người sợ) |
| `?celebrate=N` | `app.js`, `celebrate.js` | README (tài liệu vận hành, chấp nhận) | Không đưa vào Sổ tay |
| Đầu tượng Phật meme | `hall.js` | — | Giữ |
| Ba NPC bí mật và 3 chiêu ẩn (Như Lai Thần Chưởng, Tẩu Vi Thượng Sách, Kamui) | `lib/martial/secrets.js`, `engine.js`, `arena.js` | — | Không nhắc; Sổ tay chỉ nói "giang hồ còn nhiều cơ duyên chưa kể" |
| Tảo Địa Tăng | `lib/sweeper.js` | — | Giữ |
| Màn đối đầu huyền thoại (mới) | `legend.js` | — | Không giải thích, chỉ có công tắc tắt |

### 8.6 Gợi ý lần đầu (T-062)

Mỗi gợi ý là một thẻ nhỏ có mũi tên chỉ vào đúng chỗ, nút "Đã hiểu", hiện **một lần** (`ta-tips`, bọc try/catch), tắt hết được trong Sổ tay.

| Nơi | Lần thứ | Nội dung nháp |
|---|---|---|
| Chánh điện | 1 | "Chạm xuống sàn để đi lại." |
| Chánh điện | 2 | "Các nút dưới cùng là việc lễ Phật. Mỗi việc cho công đức." |
| Chánh điện | 3 | "Muốn sang nơi khác, chọn ở thanh trên cùng bên trái." |
| Chánh điện | 4 | "Hũ XĂM trên bàn thờ: chạm vào để xin một quẻ." |
| Sân chùa | 1 | "Chạm thầy Tử vi hoặc thầy Tarot để xem. Chạm bàn đá để đánh cờ." |
| Tàng Kinh Các | 1 | "Chạm kệ kinh để đọc. Chạm bồ đoàn để ngồi thiền, tu luyện nội công." |
| Võ Học Các | 1 | "Bắt đầu ở tab Tâm pháp: chọn thời gian tu. Tu xong cứ đóng web, máy chủ tự tính." |
| Sân đấu | 1 | "Chạm một đạo hữu để mời đấu. Mỗi lượt hai bên chọn kín một chiêu, rồi cùng lật." |
| Bàn cờ | 1 | "Chạm quân của bạn, rồi chạm ô có chấm để đi." |

Kèm sửa vướng giao diện cho người mới: hộp giọng nói thu nhỏ (4.2), gợi ý cảnh hiện trên điện thoại (4.1), **nhãn tên không đè nhau** (dời nhãn lên khi chồng lấn, trong `hall.js`).

### 8.7 Viết lại chữ từng màn

- **T-063 Võ Học Các** (`dojo.js`, chữ trong `martial.js`): mở sẵn "Luật tu luyện" lần đầu; mô tả ngắn dưới 3 tab; nói "Tài khoản mới đã biết sẵn 6 chiêu"; dùng đúng bảng thuật ngữ; sửa chỗ nói số lượt hoàn thành ngay; gộp hai gạch đầu dòng trùng.
- **T-064 Sân đấu** (`arena.js`): đưa luật một trận ra khỏi ngăn kéo (một dải "Luật nhanh" mở được ở màn chờ và màn đấu); giải thích nộ, sơ hở, Kim Chung, tụ lực, Suy kiệt; sửa câu "phòng cân bằng" sai; thêm lý do cho hòa `escape` mà **không** nói tên chiêu ẩn ("Trận kết thúc hòa."); sửa câu "chỉ người tự ra sân mới mời được".
- **T-065 Chánh điện, công đức, cúng dường, tụng kinh** (`index.html`, `app.js`): bảng điểm trong "Luật công đức" lấy đúng `E.heart`/`E.mo`/`E.rejoice` (đang gõ cứng `1`); ghi thời gian chờ; nói rõ thanh trên cùng là công đức **hôm nay**; sửa 2 chỗ lộ bí mật (8.5); viết lại `SCENE_HINT`; đổi "cảnh giới hào quang" → "tầng" nếu chủ dự án đồng ý.

### 8.8 Bài kiểm người mới (T-066)

- Gemini Flash-Lite đóng vai người mới. **Chỉ được xem** chữ và ảnh chụp giao diện (lấy bằng ui-harness / `get_page_text` ở từng màn), không đọc mã, không đọc docs.
- Trả lời 25 câu ở **Phụ lục D**. Gemini Argon chấm theo đáp án lấy từ mã.
- Đạt: ≥ 23/25. Mỗi câu sai thành một thẻ ở Hộp thư đến (chữ nào thiếu, ở màn nào).

---

## 9. Đề xuất cơ chế mới

Xếp theo giá trị cho người chơi / công sức. Ý nào chủ dự án chọn thì Điều phối viết thành thẻ đủ trường.

| # | Tên | Mô tả ngắn | Vì sao hợp | Dùng lại | Công sức | Ưu tiên |
|---|---|---|---|---|---|---|
| 1 | **Sư Kỳ** (đối thủ máy) | Một vị sư ngồi sẵn ở một bàn đá; chạm để đánh với máy (3 mức, giao hữu). | Chùa vắng người vẫn có cờ để chơi. | luật cờ, bảng bàn cờ | M | P1 |
| 2 | **Học luật 5 môn** | Bài tương tác: chạm từng quân xem cách đi, 5 bước mỗi môn. | Người mới không biết cờ vây/cờ úp. | bảng bàn cờ | S | P1 |
| 3 | **Cờ thế mỗi ngày** | Một thế cờ vua (kho Lichess CC0) và một thế cờ tướng cổ mỗi ngày; giải được thì có dấu trên Bảng Vàng tuần. | Lý do quay lại mỗi ngày. | luật cờ | M | P1 |
| 4 | **Kỳ Hội Rằm** | Đêm Rằm tự mở giải cờ tướng nhanh hệ Thụy Sĩ 4 vòng; quán quân giữ danh hiệu "Quán Quân Kỳ Hội" hết tháng. | Gắn với lịch âm đã có ("Còn 12 ngày đến Rằm"). | manager, danh hiệu | L | P2 |
| 5 | **Thời khóa tu tập** | Mỗi ngày 3 việc nhỏ gợi ý (thắp nhang, nghe trọn một bài kinh, ngồi thiền 15 phút); xong cả 3 được +10 công đức và giữ **chuỗi chuyên cần** (huy hiệu 7/30/100 ngày). | Dẫn người mới đi qua mọi thứ cơ bản. | merit, lunar | M | P2 |
| 6 | **Lễ hội theo âm lịch** | Rằm: thả hoa đăng trên hồ sen nhỏ ở sân; Vu Lan: cài hoa hồng; Phật Đản: tắm Phật; Tết: xin chữ, hái lộc đầu năm. | Hợp nhà chùa, tạo dịp đông người. | lunar, hall | L | P2 |
| 7 | **Thiền chung theo giờ** | Hẹn giờ ngồi thiền tập thể ở Tàng Kinh Các; chuông bắt đầu/kết thúc; hiện số người cùng ngồi. | Việc chung yên tĩnh, đúng chất chùa. | bồ đoàn, chant sync | M | P2 |
| 8 | **Xem lại và chia sẻ ván** | Mở lại ván đã đấu, tua từng nước, chép đường link ván. | Kỳ thủ thích khoe ván hay. | biên bản ván | S | P2 |
| 9 | **Gieo quẻ Kinh Dịch** | Gieo 3 đồng xu 6 lần ở bàn thầy tử vi; 64 quẻ, lời giải viết mới. | Thêm một kiểu xem, hợp văn hóa. | fortune | M | P2 |
| 10 | **Mèo chùa** (bí mật) | Một chú mèo thỉnh thoảng nằm ở bậc thềm; chạm để vuốt ve, mèo kêu. | Dễ thương, không ảnh hưởng điểm. | NPC | S | P2 |
| 11 | **Sư huynh dẫn đường** | Người chơi lâu năm nhận dẫn người mới; người mới xong Thời khóa đầu tiên thì cả hai có huy hiệu nhỏ. | Cộng đồng tự giúp nhau. | person dialog | M | P3 |
| 12 | **Pháp danh** | Tổng công đức 5.000 thì Sư trụ trì (NPC) ban pháp danh (chọn trong bộ tên đẹp) hiện cạnh tên. | Mốc ý nghĩa, không tốn tiền. | merit, moderation | S | P3 |
| 13 | **Cây bồ đề chung** | Cây ở sân lớn dần theo tổng công đức cả chùa trong mùa; mùa sau bắt đầu lại. | Mục tiêu chung, ai cũng góp. | merit season | S | P3 |
| 14 | **Đố vui văn hóa chùa** | Mỗi ngày 1 câu hỏi ngắn (lễ nghi, ý nghĩa đồ thờ); nội dung tự viết. | Học mà vui. | — | S | P3 |
| 15 | **Nhịp mõ** | Khi tụng chung, gõ mõ đúng nhịp thì hiện vòng sáng đẹp (không cộng điểm thêm để tránh cày). | Cho người nghe tụng có việc để tham gia. | audio sync | S | P3 |
| 16 | **Map "Kỳ Viên"** | Khu vườn cờ riêng 8 bàn, có ghế cho người xem. Thêm vào thanh đổi map. | Khi 4 bàn ở sân thường xuyên kín. | KD, mapbar | M | khi số liệu cho thấy > 70% bàn kín giờ cao điểm trong 1 tuần |

**Không nên làm:** cược công đức hay tiền vào ván cờ / trận PK (cờ bạc, trái tinh thần nhà chùa và pháp luật); bán Elo, bán danh hiệu; hộp quà may rủi trả tiền.

---

## 10. Thực thi và điều phối

### 10.1 Vai trò và bảng định tuyến mô hình

| Vai | Mô hình | Giao loại việc nào | Dự phòng nếu thiếu |
|---|---|---|---|
| **Điều phối** | **Opus (effort high)** | chọn thẻ, dựng prompt, kiểm xung đột file, đối chiếu báo cáo với diff, gộp nhận xét soát, merge, cập nhật `task.md`, báo cáo chủ dự án | — |
| Thợ | **Sonnet 5.5 (high)** | việc chạm file nóng và cần đọc nhiều mã cũ: nối máy chủ, `app.js`, `hall.js`, `arena.js`, giao diện mới, màn đối đầu, áp chữ vào mã | Opus 5.5 |
| Thợ | **Codex terra 6.1** | thuật toán thuần có "đáp án" để kiểm: luật cờ (perft), cờ vây, tử vi, lịch âm, bộ quản lý ván, `lib/records.js`, bot | Sonnet 5.5 |
| Thợ | **Gemini Flash** | viết nội dung tiếng Việt số lượng lớn: 78 lá tarot, luận giải tử vi, Sổ tay, bảng chữ cũ → mới, dữ liệu cờ thế | Sonnet 5.5 |
| Thợ | **Gemini Flash-Lite** | việc máy móc: ui-harness và fixture, cập nhật README/docs theo mẫu, **đóng vai người mới** trong bài kiểm | Haiku 5.5 |
| Thợ | **GLM Flash** | đọc nguồn tiếng Trung (luật 揭棋, bảng 紫微斗数) để đối chiếu; module nhỏ có test rõ: caro, Elo, sửa máy chủ nhỏ | Haiku 5.5 |
| Soát mã | **Sol 6.1** | mọi PR: checklist ORCHESTRATION §7, chạy lại test trên máy soát, **thử làm hỏng mã để chắc test đỏ**, bảo mật (uid, XSS, rate limit, lộ quân úp) | Opus 5.5 (vai Soát) |
| Soát nghiệp vụ & giao diện | **Gemini Argon** | PR có giao diện hoặc nội dung: đúng luật cờ/tarot/tử vi so với nguồn, ảnh chụp 3 cỡ màn, chữ tiếng Việt, giọng nhà chùa, dễ hiểu cho người mới | Sonnet 5.5 (vai Soát) |

Quy tắc: **thợ và soát không bao giờ là một mô hình** trên cùng một thẻ. Thẻ nội dung do Gemini Flash viết thì Gemini Argon soát nội dung, Sol soát định dạng/an toàn. Nếu dùng dự phòng làm thợ và soát trùng nhau (ví dụ thiếu Argon nên Sonnet soát thẻ Sonnet làm), soát chuyển sang dự phòng kế tiếp: **Opus 5.5**, rồi **Fable 5.2**.

### 10.2 Quy trình một thẻ

```
Điều phối chọn thẻ 🔵 (phụ thuộc đã xong, vùng nóng còn trống)
  → khóa vùng nóng (ghi "Khóa: <file/vùng>" vào thẻ)
  → giao thợ: prompt ORCHESTRATION §5 + "Bối cảnh thêm" = đường dẫn mục thiết kế trong tài liệu này
  → thợ làm trên nhánh <agent>/T-0XX-<slug>, mở PR nháp, bàn giao theo §6
  → Điều phối đối chiếu báo cáo với diff (báo cáo là lời tự khai)
  → giao soát: Sol (luôn) + Argon (khi thẻ ghi)
  → thợ sửa theo nhận xét (tối đa 2 vòng; quá 2 vòng → Điều phối giao lại cho Sonnet hoặc hỏi chủ dự án)
  → cổng merge 10.4 → merge squash → cập nhật task.md (✅, số PR) → mở khóa vùng nóng
```

**Prompt cho Sol 6.1 (soát mã)**

```text
Bạn là agent Soát (Sol 6.1) trong repo Pagoda-online. Không sửa mã, chỉ ghi nhận xét.
1. Đọc AGENTS.md, thẻ <T-0XX> trong task.md, mục thiết kế <§x.y> trong docs/KE-HOACH-DOT-2026-11.md.
2. Lấy nhánh <nhánh>, gộp origin/main mới nhất vào bản tạm của bạn.
3. Làm đủ checklist docs/agents/ORCHESTRATION.md §7.
4. Chạy: npm run check; node --test <test của thẻ>; npm test nếu thẻ chạm server.js, lib/store*, lib/pk/*, lib/kydao/*, giao thức.
5. Thử làm hỏng: sửa tạm 1–2 chỗ cốt lõi của mã mới (đảo dấu, bỏ một kiểm tra); test phải đỏ. Ghi lại.
6. Bảo mật: uid người khác có lọt gói tin nào không; chữ người dùng có đi qua textContent/h() không; có rate limit không; cờ úp có lộ quân chưa lật không.
Kết quả: PASS / CẦN SỬA, kèm danh sách vấn đề (file:dòng, mức độ, cách tái hiện).
```

**Prompt cho Gemini Argon (soát nghiệp vụ, giao diện)**

```text
Bạn là agent Soát nghiệp vụ và giao diện (Gemini Argon). Không sửa mã.
1. Đọc thẻ <T-0XX> và mục <§x.y> trong docs/KE-HOACH-DOT-2026-11.md, docs/HUONG-DAN-VIET.md (khi đã có).
2. Nghiệp vụ: đối chiếu luật/ý nghĩa với ít nhất 2 nguồn đáng tin (ghi tên nguồn). Liệt kê chỗ sai, chỗ thiếu, chỗ trường phái khác nhau.
3. Giao diện: chạy ui-harness hoặc máy chủ thật, chụp 375×812, 768×1024, 1280×800 ở mọi màn thẻ chạm; kiểm nút ≥ 44px, không cuộn ngang, giảm chuyển động, không lỗi console.
4. Chữ: tiếng Việt có dấu, câu ngắn, đúng bảng thuật ngữ, người mới đọc hiểu; không lộ bí mật ở bảng 8.5.
Kết quả: PASS / CẦN SỬA, kèm ảnh và danh sách vấn đề.
```

### 10.3 Lịch theo đợt và khóa vùng nóng

**Nới quy tắc file nóng cho đợt này (để chạy song song được):**

- `public/index.html` và `public/js/app.js` khóa **theo vùng**, không khóa cả file. Thẻ ghi rõ vùng chạm (ví dụ "index.html: khung `#dlg-fortune` + dòng `?v=` của fortune.js"). Hai thẻ song song không được chạm cùng vùng. Xung đột dòng `?v=` khi gộp thì lấy giá trị mới nhất của cả hai.
- `server.js`, `hall.js`, `arena.js`, `lib/store-sections.js`, `package.json`: vẫn **một thẻ một lúc**.
- `package.json`: làm **T-004** (check tự quét, kể cả thư mục con `public/js/kydao/`) trước mọi thẻ thêm file JS, để không thẻ nào phải sửa `package.json`.

**Đợt 0 · Nền (làm trước, ~1–2 ngày)**

| Thẻ | Thợ | Soát | Ghi chú |
|---|---|---|---|
| T-003 baseline test | GLM Flash | Sol | |
| T-004 check tự quét (đệ quy) | Codex | Sol | **chặn** mọi thẻ thêm file JS |
| T-006 CI GitHub Actions | Sonnet | Sol | cổng merge "CI xanh" cần thẻ này |
| T-005 test chống lệch | Codex | Sol | song song |

**Đợt 1 · Phần lớn là file mới (song song tối đa 8 thẻ)**

| Thẻ | Thợ | Soát | Vùng nóng |
|---|---|---|---|
| T-010 thanh đổi map | Sonnet #1 | Sol + Argon | index.html (scene-nav, `?v=`), app.js (applyScene, goScene, listeners), fortune.js |
| T-051 máy chủ: tarot + giới hạn xăm | Sonnet #2 | Sol | **server.js** |
| T-020 giao thức Kỳ Đạo | Sonnet #3 | Sol | — (docs) |
| T-021 luật cờ vua | Codex #1 | Sol | — |
| T-022 luật cờ tướng | Codex #2 | Sol + Argon | — |
| T-025 luật cờ vây | Codex #3 | Sol + Argon | — |
| T-050 lịch âm | Codex #4 | Sol + Argon | — |
| T-023 nghiên cứu cờ úp | GLM #1 | Argon | — |
| T-026 luật caro | GLM #2 | Sol | — |
| T-027 Elo | GLM #3 | Sol | — |
| T-055 đối chiếu tử vi | GLM #4 (+ 👤 lá số mẫu) | Argon | — |
| T-052 nội dung tarot | Gemini Flash #1 | Argon + Sol | — |
| T-060 quy tắc chữ + thuật ngữ | Gemini Flash #2 | Argon (+ Điều phối đọc) | — |

**Đợt 2**

| Thẻ | Thợ | Soát | Phụ thuộc | Vùng nóng |
|---|---|---|---|---|
| T-011 thanh lễ Phật | Sonnet | Sol + Argon | T-010 | index.html (`.actions`, tab Khám phá), app.js (act, welcome, renderVoice) |
| T-024 cờ tướng úp | Codex | Sol + Argon | T-022, T-023 | — |
| T-028 bộ quản lý ván | Codex | Sol | T-020, T-021/22 (giao diện module), T-027 | — |
| T-029 lưu bền kydao + records | Sonnet | Sol, 👤 merge | T-020 | **store-sections.js**, account.js |
| T-031 bàn đá ở sân | Sonnet | Argon + Sol | T-020 | **hall.js** |
| T-040 thống kê mùa + records.js | Codex | Sol | T-020, T-029 (cùng sửa `account.js`), T-050 | — (service.js, account.js) |
| T-054 máy an sao tử vi | Codex | Sol + Argon | T-050 | — |
| T-032 bảng bàn cờ (vua, tướng) | Sonnet | Sol + Argon | T-020, T-021, T-022 | — (file mới) |
| T-053 giao diện tarot | Sonnet | Argon + Sol | T-051, T-052, T-010 | index.html (`#dlg-fortune`), fortune.js |
| T-056 nội dung tử vi | Gemini Flash | Argon | mã dữ liệu ở Phụ lục B | — |
| T-061 Sổ tay | Sonnet | Argon + Sol | T-060, T-011 | index.html (thanh trên, hộp mới), app.js (vùng thanh trên), **martial.js** (thêm `IDLE_FORFEIT_TURNS`) |

**Đợt 3**

| Thẻ | Thợ | Soát | Phụ thuộc | Vùng nóng |
|---|---|---|---|---|
| T-030 nối Kỳ Đạo vào máy chủ | Sonnet | Sol | T-028, T-029, T-031, T-051 | **server.js** |
| T-033 vây, caro, cờ úp trên bảng | Sonnet | Argon + Sol | T-032, T-024, T-025, T-026 | — |
| T-057 giao diện lá số | Sonnet | Argon + Sol | T-054, T-056, T-053 | index.html (`#dlg-fortune`), fortune.js |
| T-012 thanh đổi map ở Sân đấu | Sonnet | Argon + Sol | T-010, T-011 | **arena.js** |
| T-063 chữ Võ Học Các | Gemini Flash soạn → Sonnet áp | Argon | T-060, T-061 | dojo.js, **martial.js** (chỉ chuỗi chữ) |

**Đợt 4**

| Thẻ | Thợ | Soát | Phụ thuộc | Vùng nóng |
|---|---|---|---|---|
| T-034 nối bảng cờ vào app | Sonnet | Argon + Sol | T-030, T-031, T-032 | app.js (hộp người chơi, handlers sân), index.html (`<script>`, `<link>`, hộp mời) |
| T-035 ui-harness bàn cờ | Flash-Lite | Argon | T-032, T-033 | — |
| T-041 phát danh hiệu | Sonnet | Sol | T-030, T-040 | **server.js** |
| T-064 chữ Sân đấu | Gemini Flash soạn → Sonnet áp | Argon | T-012, T-060, T-061 | **arena.js** |

**Đợt 5**

| Thẻ | Thợ | Soát | Phụ thuộc | Vùng nóng |
|---|---|---|---|---|
| T-042 hiện danh hiệu | Sonnet | Argon + Sol | T-041, T-031, T-034, T-064 | **hall.js**, **arena.js** (danh sách người ở sân), app.js (hộp người chơi) |
| T-044 màn đối đầu | Sonnet | Argon + Sol | T-041, T-030 | **server.js** (gửi `legend:vs`), app.js (vùng sự kiện), index.html (thẻ "Hiệu ứng"), `lib/pk/manager.js`, `lib/kydao/manager.js` |

**Đợt 6**

| Thẻ | Thợ | Soát | Phụ thuộc | Vùng nóng |
|---|---|---|---|---|
| T-043 Bia Bảng Vàng | Sonnet | Argon + Sol | T-042 | **hall.js**, **server.js** (sự kiện bảng), index.html |
| T-065 chữ chánh điện, công đức | Gemini Flash soạn → Sonnet áp | Argon | T-060, T-011, T-061, T-044 | index.html (hộp luật, thẻ "Hiệu ứng"), app.js (renderRank, rules) |
| T-062 gợi ý lần đầu + nhãn không đè | Sonnet | Argon | T-061, T-043 (thứ tự `hall.js`) | **hall.js** (nhãn), app.js |
| T-067 README và docs | Flash-Lite | Argon | T-010 → T-065 | — |
| T-066 bài kiểm người mới (thẻ cuối) | Flash-Lite (vai người mới) | Argon viết đáp án trước, rồi chấm | T-067 | — |

**Sau đợt:** ý ở mục 9 và 5.10 mà chủ dự án chọn.

Thứ tự trên các file nóng (để khỏi tranh nhau):

- `server.js`: T-051 → T-030 → T-041 → T-044 → T-043
- `hall.js`: T-031 → T-042 → T-043 → T-062
- `arena.js`: T-012 → T-064 → T-042
- `public/js/martial.js`: T-061 → T-063
- `lib/store-sections.js`: chỉ T-029
- `lib/account.js`: T-029 → T-040
- `public/js/fortune.js` và khung `#dlg-fortune`: T-010 → T-053 → T-057
- Thẻ "Hiệu ứng" trong `index.html`: T-044 → T-065
- `test/sync-constants.test.js` (T-005 tạo): mỗi thẻ chỉ **thêm** ca của mình (T-010, T-030, T-061); xung đột thì giữ cả hai
- `docs/agents/ARCHITECTURE.md`: mỗi thẻ chỉ thêm dòng của mình ở §4/§6; xung đột thì giữ cả hai

### 10.4 Cổng merge

Một PR chỉ được merge khi đủ:

1. **CI xanh** (`npm run check` + `npm test`, từ T-006). Trước khi có CI: Sol chạy tay và dán kết quả.
2. **Sol 6.1: PASS**, có ghi lại phép "thử làm hỏng" với test mới.
3. **Gemini Argon: PASS** nếu thẻ ghi Argon (giao diện, nội dung, luật).
4. **Điều phối** đã đối chiếu báo cáo với diff, các điểm đồng bộ (ARCHITECTURE.md §6) đã sửa hai phía, `?v=` đã tăng, nhánh đã gộp `main` mới nhất và chạy lại test.
5. Thẻ có 👤 merge: chủ dự án bấm.

Merge kiểu **squash**, tiêu đề tiếng Việt kiểu mệnh lệnh ("Thêm luật cờ tướng thuần và kiểm perft (T-022)"). Sau merge: cập nhật thẻ (✅, số PR), chuyển xuống "Đã xong", **không xoá nhánh** (để chủ dự án dọn theo T-002).

**Quyền GitHub:** máy chưa có `gh` CLI. Điều phối cần một trong ba: (a) `gh` đã đăng nhập; (b) kết nối GitHub trong ứng dụng đã cấp quyền (gõ `/mcp` để cấp); (c) chủ dự án tự bấm merge theo danh sách Điều phối gửi sau mỗi đợt.

**Hoàn tác:** mỗi PR một chức năng nên `git revert` được riêng. Kỳ Đạo và danh hiệu có cờ tắt (`KYDAO_ENABLED=0`, `TITLES_ENABLED=0`) để tắt nóng trên Render mà không cần revert.

### 10.5 Ước lượng

| Epic | Thẻ | Dòng mã thêm/sửa (ước) | Dòng nội dung |
|---|---|---|---|
| UI | 3 | ~700 | — |
| KD | 16 (+4 để sau đợt) | ~5.500 (luật ~2.500, manager ~900, giao diện ~1.800, test ~1.200) | — |
| DH | 5 | ~1.500 | — |
| BT | 8 | ~2.500 (tử vi ~1.200, lịch âm ~400, tarot ~600) | ~1.900 câu tarot + ~700 đoạn tử vi |
| HD | 8 | ~1.200 | Sổ tay ~3.000 chữ, bảng chữ ~400 dòng |
| Nền (T-003 → T-006) | 4 | ~400 | — |
| **Tổng** | **~44 PR** | **~11.400** | |

### 10.6 Rủi ro và cách giảm

| Rủi ro | Cách giảm |
|---|---|
| Luật cờ sai ở ca hiếm (nhập thành qua ô bị chiếu, lộ mặt tướng, siêu cô) | perft + bộ thế đặc biệt; Argon đối chiếu luật; Sol thử làm hỏng |
| Cờ úp lộ quân chưa lật qua gói tin | test quét mọi gói `kd:*`; Sol kiểm riêng mục này |
| Tử vi lệch trường phái, người xem chê "sai" | ghi rõ trường phái và các tùy chọn; lá số mẫu từ 2 công cụ Việt; tài liệu quy ước |
| Nội dung tarot/tử vi do mô hình viết bị chép hoặc sai ý | Argon đối chiếu nguồn; test chống trùng câu; nguồn gốc ghi trong file |
| Nhiều PR cùng sửa `index.html`/`app.js` gây xung đột | khóa theo vùng, gộp `main` trước khi soát, merge theo thứ tự 10.3 |
| Render Free yếu CPU | luật cờ thuần và nhẹ; bot chạy trên trình duyệt; `KYDAO_MAX_GAMES` |
| Danh hiệu bị "cày" bằng ván dàn xếp | giới hạn 3 ván/cặp/ngày, ≥ 20 ván để giữ danh hiệu, cần tài khoản; danh hiệu chỉ để trưng, không có thưởng |
| Giấy phép mã lịch âm | T-050 viết lại độc lập (D12) |
| Mô hình nào đó không dùng được | bảng dự phòng 10.1 |

### 10.7 Prompt khởi động cho Opus Điều phối

```text
Bạn là Điều phối (Opus, effort high) cho đợt 2026-11 của repo Pagoda-online (Chùa Tâm An).
Chủ dự án đã cho phép: giao việc cho các mô hình trong bảng 10.1, commit, push, mở PR và merge từng PR
khi qua đủ cổng 10.4 (trừ thẻ có 👤 merge).

1. Đọc: AGENTS.md; docs/agents/ORCHESTRATION.md; docs/KE-HOACH-DOT-2026-11.md mục 0, 1, 3, 10;
   task.md (thẻ T-003…T-006 và T-010…T-067).
2. Mục 1: quyết định nào có giá trị ở cột "Chốt" thì theo đó, còn lại theo mặc định. Ghi lại bảng quyết định cuối
   vào đầu báo cáo đợt 0.
3. Làm đợt 0 trước. Sau đó mỗi vòng: chọn thẻ 🔵 có phụ thuộc đã ✅, không đụng vùng nóng đang khóa (10.3),
   tối đa 8 thẻ chạy song song.
4. Giao thẻ theo cột "Thợ" của thẻ (dự phòng theo 10.1). Prompt = ORCHESTRATION §5 + "Bối cảnh thêm:
   docs/KE-HOACH-DOT-2026-11.md §<mục của thẻ>". Mỗi thợ một worktree tách từ origin/main mới nhất.
5. Thợ bàn giao → bạn xem diff thật (không tin báo cáo) → giao Sol (luôn) và Argon (khi thẻ ghi) bằng prompt 10.2.
6. Đủ cổng 10.4 → merge squash → cập nhật task.md → mở khóa vùng nóng → giao thẻ kế tiếp.
7. Hết mỗi đợt: báo chủ dự án 5–10 dòng: thẻ xong (số PR), thẻ kẹt và vì sao, quyết định cần, rủi ro mới.
Không tự viết mã của thẻ đang giao. Việc ngoài kế hoạch (đổi luật chơi, giao thức, tiền, xoá dữ liệu,
cấu hình deploy): dừng và hỏi chủ dự án.
```

---

## 11. Phụ lục

### A. Số kiểm perft

**Cờ vua** (nguồn: Chess Programming Wiki, "Perft Results")

| Thế | FEN | d1 | d2 | d3 | d4 |
|---|---|---|---|---|---|
| Đầu ván | `rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1` | 20 | 400 | 8.902 | 197.281 |
| "Kiwipete" | `r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1` | 48 | 2.039 | 97.862 | 4.085.603 |
| Thế 3 | `8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1` | 14 | 191 | 2.812 | 43.238 |
| Thế 4 | `r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1` | 6 | 264 | 9.467 | 422.333 |
| Thế 5 | `rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8` | 44 | 1.486 | 62.379 | 2.103.487 |

Test thường chạy tới d3; d4 chạy khi đặt biến `PERFT_DEEP=1` (để `npm test` không chậm).

**Cờ tướng** (thế đầu `rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w - - 0 1`): d1 = 44, d2 = 1.920, d3 = 79.666, d4 = 3.290.240. Sol kiểm lại số này với một nguồn thứ hai trước khi dùng làm chuẩn.

### B. Công thức Tử Vi (trường phái Việt Nam; T-055 đối chiếu, Argon xác nhận)

Quy ước chỉ số địa chi: Tý = 0, Sửu = 1, Dần = 2, …, Hợi = 11. Chỉ số can: Giáp = 0 … Quý = 9. Giờ sinh `h`: Tý = 0 … Hợi = 11. Tháng âm `m` = 1…12. Ngày âm `d` = 1…30.

| Bước | Công thức |
|---|---|
| Can, chi năm | can = (năm + 6) mod 10, chi = (năm + 8) mod 12 (năm âm lịch) |
| Can tháng Giêng (Ngũ Hổ Độn) | Giáp/Kỷ → Bính Dần · Ất/Canh → Mậu Dần · Bính/Tân → Canh Dần · Đinh/Nhâm → Nhâm Dần · Mậu/Quý → Giáp Dần |
| Can chi ngày | từ số ngày Julius `jd`: can = (jd + 9) mod 10, chi = (jd + 1) mod 12 |
| Can giờ Tý (Ngũ Thử Độn) | Giáp/Kỷ → Giáp Tý · Ất/Canh → Bính Tý · Bính/Tân → Mậu Tý · Đinh/Nhâm → Canh Tý · Mậu/Quý → Nhâm Tý (theo can ngày) |
| Âm Dương Nam Nữ | can năm chẵn (Giáp, Bính, Mậu, Canh, Nhâm) là Dương. Dương Nam, Âm Nữ: thuận; Âm Nam, Dương Nữ: nghịch |
| Cung Mệnh | `(2 + (m − 1) − h) mod 12` |
| Cung Thân | `(2 + (m − 1) + h) mod 12` |
| Can các cung | can cung Dần = can tháng Giêng (Ngũ Hổ Độn), đi thuận qua các cung |
| Cục | nạp âm của (can, chi) cung Mệnh: Thủy → 2, Mộc → 3, Kim → 4, Thổ → 5, Hỏa → 6 |
| An Tử Vi | tìm `x ≥ 0` nhỏ nhất để `(d + x)` chia hết cho Cục; `q = (d + x) / Cục`; vị trí gốc = `(2 + q − 1) mod 12`; `x` chẵn thì tiến `x` cung, lẻ thì lùi `x` cung |
| Chuỗi Tử Vi (đi nghịch) | Tử Vi `t`, Thiên Cơ `t−1`, Thái Dương `t−3`, Vũ Khúc `t−4`, Thiên Đồng `t−5`, Liêm Trinh `t−8` |
| Thiên Phủ | `p = (4 − t) mod 12` |
| Chuỗi Thiên Phủ (đi thuận) | Thiên Phủ `p`, Thái Âm `p+1`, Tham Lang `p+2`, Cự Môn `p+3`, Thiên Tướng `p+4`, Thiên Lương `p+5`, Thất Sát `p+6`, Phá Quân `p+10` |
| Tả Phù / Hữu Bật | Tả: `(4 + m − 1) mod 12` (khởi Thìn, thuận) · Hữu: `(10 − (m − 1)) mod 12` (khởi Tuất, nghịch) |
| Văn Xương / Văn Khúc | Xương: `(10 − h) mod 12` · Khúc: `(4 + h) mod 12` |
| Địa Kiếp / Địa Không | Kiếp: `(11 + h) mod 12` · Không: `(11 − h) mod 12` |
| Lộc Tồn (theo can năm) | Giáp Dần · Ất Mão · Bính, Mậu Tỵ · Đinh, Kỷ Ngọ · Canh Thân · Tân Dậu · Nhâm Hợi · Quý Tý. Kình Dương = Lộc Tồn + 1, Đà La = Lộc Tồn − 1 |
| Thiên Khôi / Thiên Việt | Giáp, Mậu: Sửu/Mùi · Ất, Kỷ: Tý/Thân · Bính, Đinh: Hợi/Dậu · Canh, Tân: Ngọ/Dần · Nhâm, Quý: Mão/Tỵ |
| Thiên Mã (theo chi năm) | Dần Ngọ Tuất → Thân · Thân Tý Thìn → Dần · Tỵ Dậu Sửu → Hợi · Hợi Mão Mùi → Tỵ |
| Hỏa Tinh / Linh Tinh | khởi theo chi năm: Dần Ngọ Tuất (Hỏa Sửu, Linh Mão) · Thân Tý Thìn (Hỏa Dần, Linh Tuất) · Tỵ Dậu Sửu (Hỏa Mão, Linh Tuất) · Hợi Mão Mùi (Hỏa Dậu, Linh Tuất); đếm tới giờ sinh. Trường phái Việt: Dương Nam/Âm Nữ thì Hỏa thuận Linh nghịch, ngược lại thì Hỏa nghịch Linh thuận. **Trường phái Trung Quốc khác** → ghi vào quy ước |
| Tứ Hóa (Lộc, Quyền, Khoa, Kỵ) theo can năm | Giáp: Liêm Trinh, Phá Quân, Vũ Khúc, Thái Dương · Ất: Thiên Cơ, Thiên Lương, Tử Vi, Thái Âm · Bính: Thiên Đồng, Thiên Cơ, Văn Xương, Liêm Trinh · Đinh: Thái Âm, Thiên Đồng, Thiên Cơ, Cự Môn · Mậu: Tham Lang, Thái Âm, Hữu Bật, Thiên Cơ · Kỷ: Vũ Khúc, Tham Lang, Thiên Lương, Văn Khúc · Canh: Thái Dương, Vũ Khúc, Thái Âm, Thiên Đồng · Tân: Cự Môn, Thái Dương, Văn Khúc, Văn Xương · Nhâm: Thiên Lương, Tử Vi, Tả Phù, Vũ Khúc · Quý: Phá Quân, Cự Môn, Thái Âm, Tham Lang. (Can Canh có trường phái đổi Khoa/Kỵ → ghi quy ước) |
| Vòng Tràng Sinh | khởi theo Cục: Kim → Tỵ, Mộc → Hợi, Thủy và Thổ → Thân, Hỏa → Dần; thuận/nghịch theo Âm Dương Nam Nữ. Thứ tự: Tràng Sinh, Mộc Dục, Quan Đới, Lâm Quan, Đế Vượng, Suy, Bệnh, Tử, Mộ, Tuyệt, Thai, Dưỡng |
| Tuần | tuần (10 can chi) chứa can chi năm sinh: hai chi đứng sau chi cuối của tuần, tức `(chi năm − can năm + 10) mod 12` và `+11` |
| Triệt (theo can năm) | Giáp, Kỷ: Thân–Dậu · Ất, Canh: Ngọ–Mùi · Bính, Tân: Thìn–Tỵ · Đinh, Nhâm: Dần–Mão · Mậu, Quý: Tý–Sửu |
| Đào Hoa (theo chi năm) | Thân Tý Thìn → Dậu · Dần Ngọ Tuất → Mão · Tỵ Dậu Sửu → Ngọ · Hợi Mão Mùi → Tý |
| Hồng Loan / Thiên Hỷ | Hồng Loan: khởi Mão là năm Tý, đếm nghịch tới chi năm: `(3 − chi) mod 12` · Thiên Hỷ: đối cung Hồng Loan `+6` |
| Đại vận | bắt đầu ở cung Mệnh, tuổi khởi = số Cục; mỗi vận 10 năm; thuận/nghịch theo Âm Dương Nam Nữ |
| Tiểu vận | khởi theo chi năm: Dần Ngọ Tuất → Thìn · Thân Tý Thìn → Tuất · Tỵ Dậu Sửu → Mùi · Hợi Mão Mùi → Sửu; Nam thuận, Nữ nghịch |
| Lưu niên | lưu Thái Tuế tại chi năm xem; lưu Tứ Hóa theo can năm xem; lưu Lộc Tồn, Kình, Đà, Mã theo can/chi năm xem |

Các bảng còn thiếu ở đây (độ sáng 14 chính tinh × 12 cung, chủ mệnh, chủ thân, Thiên Hình, Thiên Diêu, nạp âm 60 hoa giáp) do T-055 lập và đối chiếu từ **hai nguồn**, ghi nguồn trong `docs/TU-VI-QUY-UOC.md`.

Điểm khác trường phái phải ghi trong `docs/TU-VI-QUY-UOC.md` (T-055 tra nguồn, chủ dự án chốt nếu cần): Tứ Hóa can Canh (Khoa/Kỵ đổi chỗ ở một số sách); Khoa của can Nhâm (câu "Nhâm Lương Tử Phủ Vũ": "Phủ" là Tả Phù hay Thiên Phủ); hướng đi của Hỏa/Linh; Thiên Khôi/Việt của can Canh, Tân. **Tuổi tính đại vận dùng tuổi âm (tuổi mụ)**, ghi rõ trên lá số.

**Mã dữ liệu** (T-054 dùng trong JSON lá số, T-056 dùng làm khóa nội dung; viết thường, không dấu):

| Loại | Mã |
|---|---|
| 12 cung (theo thứ tự đi nghịch từ Mệnh) | `menh`, `phumau`, `phucduc`, `dientrach`, `quanloc`, `nopboc`, `thiendi`, `tatach`, `taibach`, `tutuc`, `phuthe`, `huynhde` |
| 14 chính tinh | `tuvi`, `thienco`, `thaiduong`, `vukhuc`, `thiendong`, `liemtrinh`, `thienphu`, `thaiam`, `thamlang`, `cumon`, `thientuong`, `thienluong`, `thatsat`, `phaquan` |
| Phụ tinh bản đầu | `taphu`, `huubat`, `vanxuong`, `vankhuc`, `thienkhoi`, `thienviet`, `locton`, `kinhduong`, `dala`, `thienma`, `hoatinh`, `linhtinh`, `diakhong`, `diakiep`, `hoaloc`, `hoaquyen`, `hoakhoa`, `hoaky`, `tuan`, `triet`, `daohoa`, `hongloan`, `thienhy`, `thienhinh`, `thiendieu`, `thaitue` |
| Vòng Tràng Sinh | `trangsinh`, `mocduc`, `quandoi`, `lamquan`, `devuong`, `suy`, `benh`, `tu`, `mo`, `tuyet`, `thai`, `duong` |
| Độ sáng | `M` (miếu), `V` (vượng), `D` (đắc), `B` (bình), `H` (hãm); nhóm nội dung: `sang` (M, V, D) và `toi` (B, H) |
| Ngũ hành cục | `thuy2`, `moc3`, `kim4`, `tho5`, `hoa6` |

Ví dụ khóa nội dung: `stars.tuvi.menh.sang`, `minor.kinhduong`, `combos.tu-phu-dong-cung`, `hoa.hoaky.taibach`.

Ca kiểm nhanh cho an Tử Vi: Thủy nhị cục, ngày 1 → Sửu; ngày 2 → Dần. Tử Vi ở Tý thì Thiên Phủ ở Thìn; Tử Vi ở Dần hoặc Thân thì Thiên Phủ cùng cung.

### C. Sự kiện socket mới (tổng hợp)

| Nhóm | Trình duyệt → máy chủ | Máy chủ → trình duyệt |
|---|---|---|
| Kỳ Đạo | `kd:tables`, `kd:sit`, `kd:setup`, `kd:ready`, `kd:stand`, `kd:invite`, `kd:invite:cancel`, `kd:respond`, `kd:move`, `kd:draw`, `kd:resign`, `kd:mark`, `kd:agree`, `kd:resume-play`, `kd:watch`, `kd:unwatch`, `kd:resume` | `kd:table`, `kd:invited`, `kd:invite:closed`, `kd:start`, `kd:moved`, `kd:offer`, `kd:marks`, `kd:end` |
| Danh hiệu | `records:board` (mở Bảng Vàng) | `ptt`, `titles`, `legend:vs` |
| Bói toán | `tarot:draw` | — |

Cập nhật bảng sự kiện ở `docs/agents/ARCHITECTURE.md` §4 trong cùng PR thêm sự kiện.

### D. 25 câu hỏi cho bài kiểm người mới

1. Làm sao để đi lại trong chùa (trên điện thoại và trên máy tính)?
2. Thắp nhang được bao nhiêu công đức? Bao lâu thì thắp tiếp được?
3. Số công đức ở thanh trên cùng là của hôm nay hay tổng?
4. Pháp tướng là gì? Mốc đầu tiên là bao nhiêu?
5. Làm sao tụng kinh cùng mọi người? Tụng xong được gì?
6. Tiền cúng dường đi đâu? Tối thiểu bao nhiêu?
7. Hào quang sáng trong bao lâu?
8. Làm sao ra Sân chùa, rồi sang Tàng Kinh Các?
9. Xin xăm ở đâu?
10. Xem Tarot cần chọn những gì? Hỏi lại cùng chủ đề trong ngày thì sao?
11. Xem tử vi cần nhập gì? Ngày sinh có bị gửi đi không?
12. Đánh cờ ở đâu? Có những môn nào?
13. Elo là gì? Ván nào được tính Elo?
14. Làm sao xem người khác đánh cờ?
15. Võ Học Các để làm gì? Đang tu luyện có cần mở web không?
16. Công lực và nội lực khác nhau thế nào?
17. Cương, Tốc, Nhu là gì?
18. Cần học mấy chiêu thì ra Sân đấu được?
19. Một lượt ở Sân đấu dài bao nhiêu giây? Bỏ lượt nhiều thì sao?
20. "Kỳ Vương Cờ Tướng" nghĩa là gì? Khác "Kỳ Thánh" thế nào?
21. Vì sao nên đăng nhập Google? Khách vãng lai mất gì?
22. Nói chuyện bằng giọng: ai nghe được mình?
23. Khi nào bị trừ công đức?
24. Bảng Vàng ở đâu?
25. Muốn tắt hiệu ứng chúc mừng thì làm sao?
