# task.md · Bảng việc cho agent

> Cách dùng: xem [docs/agents/ORCHESTRATION.md](docs/agents/ORCHESTRATION.md). Mỗi thẻ ghi rõ **gói ngữ cảnh** (xem [docs/agents/CONTEXT-PACKS.md](docs/agents/CONTEXT-PACKS.md)) và **khu vực chạm** để không ai đụng ai.
> Chỉ sửa thẻ của mình. Kéo bản mới nhất trước khi sửa file này.
>
> Trạng thái: ⚪ Hộp thư đến · 🔵 Sẵn sàng · ⏳ Chờ phụ thuộc (thẻ đã đủ trường, chờ thẻ khác ✅) · 🟡 Đang làm · 🟣 Chờ soát · 🔴 Bị chặn · ✅ Xong
> Ưu tiên: P0 gấp · P1 nên làm sớm · P2 khi rảnh · 👤 = cần chủ dự án quyết hoặc tự làm
> **Đợt 2026-11** (T-010 → T-067): thiết kế ở [docs/KE-HOACH-DOT-2026-11.md](docs/KE-HOACH-DOT-2026-11.md), lịch chạy và khóa vùng nóng ở mục 10.3 của tài liệu đó. Mỗi thẻ ghi sẵn **Thợ** và **Soát** (mô hình), bảng dự phòng ở mục 10.1.

## Tổng quan

| Thẻ | Việc | Trạng thái | Ưu tiên | Gói | Người làm |
|---|---|---|---|---|---|
| T-001 | Chốt một trong hai nhánh Obito trùng nhau | ✅ Xong | P0 | CORE + PK + HALL | Claude |
| T-002 | Kiểm và dọn các nhánh đã merge | 🔵 Sẵn sàng 👤 | P1 | CORE + OPS | — |
| T-003 | Ghi baseline test trên Node 22 | ✅ Xong · PR #23 | P0 | CORE + OPS | Claude Haiku (thay GLM Flash) |
| T-004 | `npm run check` tự quét file, không liệt kê tay | ✅ Xong · PR #24 | P1 | CORE + OPS | Claude Sonnet (thay Codex) |
| T-005 | Test chống lệch các hằng số dùng chung | ✅ Xong · PR #25 | P1 | CORE + PK + HALL | Claude Sonnet (thay Codex) |
| T-006 | CI GitHub Actions chạy check + test | ✅ Xong · PR #26 | P1 | CORE + OPS | Claude Sonnet |
| T-007 | Sửa mục "Cấu trúc mã" trong README | 🔵 Sẵn sàng | P2 | CORE + DOCS | — |
| T-008 | Lệnh chạy ui-harness có sẵn trong package.json | ⚪ Hộp thư đến | P2 | CORE + OPS + PK | — |
| T-009 | Rà các bản làm việc rời trên máy | 🔵 Sẵn sàng 👤 | P2 | CORE | — |
| **Đợt 2026-11** | | | | | |
| T-010 | Làm thanh đổi map đồng bộ (4 nút), bỏ nút Xin xăm | ✅ Xong · PR #32 | P0 | CORE + NAV + HALL | Claude Sonnet 5.5 |
| T-011 | Gọn thanh dưới còn 9 nút lễ Phật, tab Khám phá | ✅ Xong · PR #38 | P0 | CORE + NAV | Claude Sonnet 5.5 |
| T-012 | Thanh đổi map trong Sân đấu | ✅ Xong · PR #49 | P1 | CORE + NAV + PK | Claude Sonnet 5.5 |
| T-020 | Chốt giao thức Kỳ Đạo | ✅ Xong · PR #31 | P0 | CORE + KYDAO + DOCS | Claude Sonnet 5.5 |
| T-021 | Luật cờ vua thuần, kiểm perft | ✅ Xong · PR #30 | P0 | CORE + KYDAO | Claude Sonnet 5.5 + Codex terra 6.1 |
| T-022 | Luật cờ tướng thuần, perft, ký hiệu Việt | ✅ Xong · PR #33 | P0 | CORE + KYDAO | Codex terra 6.1 + Claude Sonnet 5.5 |
| T-023 | Nghiên cứu luật cờ tướng úp (揭棋) | ✅ Xong · PR #47 | P1 | CORE + KYDAO + DOCS | GLM Flash + Claude Sonnet 5.5 |
| T-024 | Biến thể cờ tướng úp | 🟣 Chờ soát | P1 | CORE + KYDAO | Gemini 3.8 Flash (qua proxy) |
| T-025 | Luật cờ vây thuần | ✅ Xong · PR #34 | P1 | CORE + KYDAO | Codex terra 6.1 + Claude Sonnet 5.5 |
| T-026 | Luật cờ caro thuần | ✅ Xong · PR #27 | P1 | CORE + KYDAO | Claude Haiku 5.5 (thay GLM Flash) |
| T-027 | Tính Elo và điều kiện xếp hạng | ✅ Xong · PR #35 | P0 | CORE + KYDAO | Claude Haiku 5.5 + GLM Flash + Claude Sonnet 5.5 |
| T-028 | Bộ quản lý ván cờ | ✅ Xong · PR #39 | P0 | CORE + KYDAO + PK | Codex terra 6.1 + Claude Sonnet 5.5 |
| T-029 | Lưu bền dữ liệu Kỳ Đạo và kỷ lục 👤 merge | ✅ Xong · PR #36 | P0 | CORE + STORE | Claude Sonnet 5.5 |
| T-030 | Nối Kỳ Đạo vào máy chủ | ✅ Xong · PR #51 | P0 | CORE + KYDAO + HALL + AUTH | Claude Sonnet 5.5 |
| T-031 | Vẽ bàn đá và ghế ở Sân chùa | ✅ Xong · PR #42 | P0 | CORE + HALL + KYDAO | Claude Sonnet 5.5 |
| T-032 | Bảng bàn cờ: khung, cờ vua, cờ tướng | ✅ Xong · PR #41 | P0 | CORE + KYDAO | Claude Sonnet 5.5 |
| T-033 | Bảng bàn cờ: cờ vây, caro, cờ úp | ✅ Xong · PR #61 | P1 | CORE + KYDAO | gpt-6.1-sol (Codex CLI qua proxy) |
| T-034 | Nối bảng cờ vào chùa | 🟣 Chờ soát | P0 | CORE + KYDAO + NAV | gpt-6-astra (Codex CLI qua proxy) |
| T-035 | ui-harness cho bàn cờ | ⏳ T-032, T-033 | P1 | CORE + KYDAO + OPS | — |
| T-040 | Thống kê mùa, tính người giữ danh hiệu | ✅ Xong · PR #46 | P0 | CORE + RANK + MARTIAL | Claude Sonnet 5.5 (thay Codex terra 6.1) |
| T-041 | Phát danh hiệu từ máy chủ | ⏳ T-030, T-040 | P0 | CORE + RANK | — |
| T-042 | Hiện danh hiệu trên đầu, hộp người chơi, Sân đấu | ⏳ T-041, T-031, T-034, T-064 | P1 | CORE + RANK + HALL | — |
| T-043 | Bia Bảng Vàng ở Sân chùa | ⏳ T-042 | P1 | CORE + RANK + HALL | — |
| T-044 | Màn "Kẻ mạnh nhất lịch sử… đối đầu kẻ mạnh nhất hiện tại" | ⏳ T-041, T-030 | P1 | CORE + RANK + PK + KYDAO | — |
| T-050 | Viết lại lịch âm (UTC+8 trước 1968, can chi đủ) | ✅ Xong · PR #37 | P0 | CORE + FORTUNE | Codex terra 6.1 + Claude Sonnet 5.5 |
| T-051 | Máy chủ: rút tarot theo hạt giống, giới hạn xin xăm | ✅ Xong · PR #28 | P0 | CORE + FORTUNE | Claude Sonnet 5.5 |
| T-052 | Nội dung 78 lá tarot theo 8 chủ đề | ✅ Xong · PR #40 | P1 | CORE + FORTUNE | Claude Sonnet 5.5 (thay Gemini Flash) |
| T-053 | Giao diện tarot theo chủ đề | ✅ Xong · PR #45 | P1 | CORE + FORTUNE | Claude Sonnet 5.5 |
| T-054 | Bộ máy an sao Tử Vi | ✅ Xong · PR #48 | P0 | CORE + FORTUNE | Claude Sonnet 5.5 (thay Codex terra 6.1) |
| T-055 | Đối chiếu bảng tử vi, lập lá số mẫu 👤 | ✅ Xong · PR #52 (còn 👤) | P0 | CORE + FORTUNE + DOCS | GLM Flash + Claude Sonnet 5.5 |
| T-056 | Nội dung luận giải tử vi | ✅ Xong · PR #44 | P1 | CORE + FORTUNE | Claude Sonnet 5.5 (thay Gemini Flash) |
| T-057 | Giao diện lá số tử vi | ⏳ T-054, T-056, T-053 | P1 | CORE + FORTUNE | — |
| T-060 | Quy tắc chữ, bảng thuật ngữ, danh sách bí mật | ✅ Xong · PR #29 | P0 | CORE + GUIDE + DOCS | Claude Sonnet 5.5 (thay Gemini Flash) |
| T-061 | Sổ tay trong game (nút "?") | ✅ Xong · PR #50 | P1 | CORE + GUIDE + NAV | Claude Sonnet 5.5 |
| T-062 | Gợi ý lần đầu, nhãn tên không đè nhau | ⏳ T-061, T-043 | P1 | CORE + GUIDE + HALL | — |
| T-063 | Viết lại chữ Võ Học Các | 🟣 Chờ soát | P1 | CORE + GUIDE + MARTIAL | Gemini 3 Flash + Claude Sonnet 5.5 |
| T-064 | Viết lại chữ Sân đấu | 🟣 Chờ soát | P1 | CORE + GUIDE + PK | Gemini 3.8 Flash (soạn) + Claude Sonnet 5.5 (áp) |
| T-065 | Viết lại chữ chánh điện, công đức, cúng dường | ⏳ T-060, T-011, T-061, T-044 | P1 | CORE + GUIDE + RITUAL | — |
| T-066 | Bài kiểm người mới (25 câu) | ⏳ T-067 (và mọi thẻ T-010 → T-065) | P1 | CORE + GUIDE | — |
| T-067 | Cập nhật README và tài liệu người chơi | ⏳ T-010 → T-065 | P2 | CORE + DOCS | — |
| T-068 | Cho máy chủ thử tắt êm trên Windows (3 test e2e) | ✅ Xong · PR #43 | P0 | CORE + STORE + OPS | Claude Sonnet 5.5 |
| T-069 | Mọi NPC đi lang thang, chạm NPC để trò chuyện, lớp nhân vật chung | ✅ Xong · PR #57 | P1 | CORE + HALL + MARTIAL | Claude Opus 5.5 |
| **Đợt 3D** ([docs/KE-HOACH-3D.md](docs/KE-HOACH-3D.md)) | | | | | |
| T-080 | Dựng nền 3D (Three.js, khung World3D, trang thử) | 🟣 Chờ soát | P0 | CORE + HALL + OPS | gpt-6.1-sol (Codex CLI qua proxy) |
| T-081 | Toán máy quay góc nhìn thứ nhất / thứ ba (thuần, có test) | 🟣 Chờ soát | P0 | CORE + HALL | gpt-6.1-terra (Codex CLI qua proxy) |
| T-082 | Bộ khối dựng kiến trúc chùa (kit.mjs) | 🟣 Chờ soát | P0 | CORE + HALL | gpt-6.1-sol (Codex CLI qua proxy) |
| T-083 | Nhân vật 3D low-poly và NPC | 🟣 Chờ soát | P0 | CORE + HALL | gpt-6.1-sol (Codex CLI qua proxy) |
| T-084 | Cảnh Chánh điện 3D | 🟣 Chờ soát | P0 | CORE + HALL | gpt-6.1-sol |
| T-085 | Cảnh Sân chùa 3D | 🟣 Chờ soát | P1 | CORE + HALL + KYDAO | gpt-6.1-sol (Codex CLI qua proxy) |
| T-086 | Cảnh Tàng Kinh Các 3D | 🟣 Chờ soát | P1 | CORE + HALL | gpt-6.1-sol (Codex CLI qua proxy) |
| T-087 | Cảnh Sân đấu (khu đi lại) 3D | 🟣 Chờ soát | P1 | CORE + HALL + PK | gpt-6-astra (Codex CLI qua proxy) |
| T-088 | Nối 3D vào game: nút 2D/3D, góc nhìn 1/3, điều khiển | 🟣 Chờ soát | P0 | CORE + HALL + NAV | gpt-6.1-sol (Codex CLI qua proxy) |
| T-089 | Cài đặt đồ họa, tự dò máy yếu | 🟣 Chờ soát | P1 | CORE + HALL | gpt-6-luna |
| T-090 | Vẽ lại quân cờ 2D đẹp hơn | 🟣 Chờ soát | P1 | CORE + KYDAO | gpt-6.1-sol |
| T-091 | Bàn cờ 3D, quân tiện tròn | 🟣 Chờ soát | P1 | CORE + KYDAO | gpt-6.1-sol |
| T-092 | ui-harness và ảnh chụp cho 3D | 🟣 Chờ soát | P2 | CORE + OPS | gpt-6-luna (Codex CLI qua proxy) |
| T-093 | README, Sổ tay cho 3D và góc nhìn | 🟣 Chờ soát | P2 | CORE + DOCS | gemini-3.8-flash-high (Codex CLI qua proxy) |
| T-100 | Nhân vật 3D bám sát 2D: hào quang, pháp tướng, quỷ, trang phục, Obito | 🟣 Chờ soát | P0 | CORE + HALL | gpt-6.1-sol |
| T-101 | Nhạc riêng cho từng môn cờ | 🟣 Chờ soát | P2 | CORE + KYDAO | gpt-6-luna (Codex CLI qua proxy) |
| **Đợt Kỳ Đài** ([docs/KE-HOACH-KY-DAI.md](docs/KE-HOACH-KY-DAI.md)) | | | | | |
| T-110 | Giao thức `kd:skin` trên máy chủ | ✅ Xong · PR #61 | P0 | CORE + KYDAO + KYDAI | Claude Opus 5.5 |
| T-111 | Dây chuyền Blender và tài nguyên 8 sân, 8 bộ quân | ✅ Xong · PR #61 | P0 | CORE + KYDAI | Điều phối (Claude Fable 5.2) |
| T-112 | Module hiệu ứng 2D `KydaoFx`: khai mở, chấn động phong cấp, chiến thắng | ✅ Xong · PR #61 | P0 | CORE + KYDAO + KYDAI | Claude Sonnet 5.5 |
| T-113 | Bàn 3D: nạp `.glb`, skin nửa sân, skin quân, `playFx` | ✅ Xong · PR #61 | P0 | CORE + KYDAO + KYDAI | Claude Opus 5.5 |
| T-114 | Bàn 2D: vẽ skin nửa sân, skin quân, `jolt` | ✅ Xong · PR #61 | P0 | CORE + KYDAO + KYDAI | Claude Sonnet 5.5 |
| T-115a | Bảng cờ: nạp module, giữ trạng thái skin, truyền vào hàm vẽ | ✅ Xong · PR #61 | P0 | CORE + KYDAO + KYDAI | gpt-6.1-terra |
| T-115b | Bảng cờ: bộ chọn Lãnh địa, gửi skin, màn khai mở | ✅ Xong · PR #61 | P0 | CORE + KYDAO + KYDAI | Claude Sonnet 5.5 |
| T-115c | Bảng cờ: chấn động phong cấp, hiệu ứng chiến thắng | ✅ Xong · PR #61 | P0 | CORE + KYDAO + KYDAI | gpt-6.1-terra |
| T-116 | ui-harness, ảnh chụp, Sổ tay, README cho Kỳ Đài | ✅ Xong · PR #61 | P1 | CORE + KYDAI + DOCS | gemini-3.8-flash-high + Claude Haiku 5.5 |
| T-117 | Đồ họa 2D bằng Canva: khung khẩu hiệu, biểu tượng bộ chọn | ✅ Xong · PR #61 | P2 | CORE + KYDAI | Claude Sonnet 5.5 (Canva) |
| T-118 | Sân v2: dựng cảnh 3D thật trong Blender, bản mẫu Hỏa Diệm Sơn 👤 duyệt | ✅ Xong · PR #61 | P0 | CORE + KYDAI | Claude Sonnet 5.5 (Blender) |
| T-119 | Bàn 2D: dải cảnh quanh bàn, dùng ảnh sân v2, quân 2D từ ảnh render | ✅ Xong · PR #61 | P0 | CORE + KYDAO + KYDAI | Claude Sonnet 5.5 |
| T-120 | Bản mẫu nhân vật 3D dựng bằng Blender, đo hiệu năng 👤 duyệt | ✅ Xong · PR #61 | P1 | CORE + HALL + KYDAI | Claude Sonnet 5.5 (Blender) |
| T-121 | Bàn 2D: dòng sông sinh động giữa bàn cờ tướng và cờ úp | ✅ Xong · PR #61 | P0 | CORE + KYDAO + KYDAI | gpt-6.1-terra |
| T-122 | Bàn 3D: dòng sông sinh động giữa bàn cờ tướng và cờ úp | ✅ Xong · PR #61 | P0 | CORE + KYDAO + KYDAI | Claude Sonnet 5.5 |
| T-118b | Sân v2: chỉnh Hỏa Diệm Sơn và dựng 7 sân còn lại | ✅ Xong · PR #61 | P0 | CORE + KYDAI | Claude Sonnet 5.5 (Blender) |
| T-123 | Tăng lực chấn động khi phong cấp | ✅ Xong · PR #61 | P1 | CORE + KYDAI | gpt-6-luna |
| T-124 | Sửa lỗi từ đợt soát của GPT Sol | ✅ Xong · PR #61 | P0 | CORE + KYDAO + KYDAI | gemini-3.8-flash-high |
| T-125 | Bàn 3D dùng ảnh sân v2 có dải cảnh | ✅ Xong · PR #61 | P0 | CORE + KYDAO + KYDAI | Claude Sonnet 5.5 |
| T-126a | Ảnh quân cờ 2D render từ mô hình 3D (8 bộ) | ✅ Xong · PR #61 | P1 | CORE + KYDAI | Claude Sonnet 5.5 (Blender) |
| T-126b | Bàn 2D vẽ quân bằng ảnh render | ✅ Xong · PR #61 | P1 | CORE + KYDAO + KYDAI | Claude Sonnet 5.5 |
| T-127 | Huy hiệu chủ đề trong khẩu hiệu và bộ chọn Lãnh địa | ✅ Xong · PR #61 | P2 | CORE + KYDAI | gemini-3.8-flash-high |
| T-128 | Sửa lỗi từ đợt soát vòng 2 của Gemini 4 Argon | ✅ Xong · PR #61 | P0 | CORE + KYDAO + KYDAI | Claude Sonnet 5.5 |
| T-129 | Sửa lỗi từ lần nghiệm thu cuối của GPT Sol | ✅ Xong · PR #61 | P1 | CORE + KYDAO + KYDAI | Claude Sonnet 5.5 |
| T-130 | Nhân vật Blender dùng trong game dạng tùy chọn (4 kiểu tóc, gộp vật liệu) | ✅ Xong · PR #61 | P1 | CORE + HALL + KYDAI | Claude Sonnet 5.5 (Blender) |
| T-131 | Kịch bản kiểm giao diện tự động cho bàn cờ (`ui-check.js`) | ✅ Xong · PR #61 | P1 | CORE + KYDAI + OPS | gpt-6.1-terra |
| T-132 | Sửa lỗi từ đợt soát T-130/T-131 của GPT Sol | ✅ Xong · PR #61 | P1 | CORE + HALL + OPS | Claude Sonnet 5.5 |
| T-133 | Thử đầu-cuối bàn cờ với máy chủ thật và hai trình duyệt | ✅ Xong · PR thứ hai của đợt Kỳ Đài | P1 | CORE + KYDAI + OPS | Claude Sonnet 5.5 |
| **Đợt Pháp Tướng 3D** ([docs/KE-HOACH-PHAP-TUONG-3D.md](docs/KE-HOACH-PHAP-TUONG-3D.md)) | | | | | |
| T-140 | Bảng ý tưởng hình: 4 quỷ hộ thân, đài sen, hào quang | 🔵 Sẵn sàng | P0 | CORE + HALL | — (gợi ý: gpt-image-2.6 + gemini-4-hydrogen-xhigh) |
| T-141 | Khung hiệu ứng 3D `fx3d` và ba vật liệu (linh thể, vỏ khí, phát sáng) | 🔵 Sẵn sàng | P0 | CORE + HALL | — (gợi ý: gpt-6.1-sol) |
| T-142 | Bản mẫu Blender: Ma Vương, đài sen vàng, vỏ khí bậc 5 | ⏳ T-140 | P0 | CORE + HALL + KYDAI | — (gợi ý: gpt-6.1-sol viết kịch bản, Điều phối chạy Blender) |
| T-143 | Toán hành vi quỷ hộ thân `stand-math.js` (thuần, có test) | 🔵 Sẵn sàng | P0 | CORE + HALL | — (gợi ý: gpt-6.1-terra) |
| T-144 | Nối bản mẫu vào nhân vật sau công tắc `ta-fx3d` 👤 duyệt | ⏳ T-100, T-141, T-142, T-143 | P0 | CORE + HALL | — (gợi ý: gpt-6.1-sol) |
| T-145 | Quỷ cấp 1, 2, 3 dạng 3D (chung xương, chung clip) | ⏳ T-144 👤 | P1 | CORE + HALL + KYDAI | — (gợi ý: gpt-6.1-sol) |
| T-146 | Đài sen 3D đủ ba biến thể, nở sen, ngồi thiền trên sen | ⏳ T-144 👤 | P1 | CORE + HALL | — (gợi ý: gpt-6.1-terra) |
| T-147 | Hào quang bao phủ 3D bậc 1 đến 5 | ⏳ T-144 👤 | P1 | CORE + HALL | — (gợi ý: gpt-6.1-terra) |
| T-148 | Hào quang bao phủ 3D bậc 6 đến 9 | ⏳ T-147 | P1 | CORE + HALL | — (gợi ý: gpt-6.1-terra) |
| T-149 | Pháp tướng công đức 6 bậc dạng 3D | ⏳ T-144 👤 | P2 | CORE + HALL + KYDAI | — (gợi ý: gpt-6.1-sol) |
| T-150 | Chia suất 3D theo khoảng cách và mức chất lượng, đo hiệu năng | ⏳ T-145 → T-148 | P1 | CORE + HALL | — (gợi ý: gpt-6-luna) |
| T-151 | Bật mặc định, ảnh chụp, Sổ tay, README, NOTICE | ⏳ T-150 | P2 | CORE + DOCS + OPS | — (gợi ý: gemini-3.8-flash-high + gpt-6-luna) |
| T-154 | Nâng chất bản mẫu: Ma Vương điêu khắc, thân đặc, vỏ khí ra lửa 👤 duyệt (chặn T-145 → T-149) | ✅ Xong (bản nháp) · PR #68 | P0 | CORE + HALL + KYDAI | Điều phối Claude Opus 5.5 · Claude Sonnet 5.5 (vòng 1 Blender) · gpt-6.1-sol (các vòng sau, shader, JS) · soát hình gemini-4-argon-high |
| T-203 | Vòng hình 2 Pháp Tướng 3D: quỷ ngoái mặt, mặt và tay Ma Vương, lưới lửa, cánh sen, nhãn tên 👤 duyệt (chặn T-145 → T-149) | ✅ Xong (bản nháp, hình chưa đạt) | P0 | CORE + HALL + KYDAI | Claude Opus 5.5 điều phối, gpt-6.1-sol thực thi |
| T-152 | (Tùy chọn) Chụp lại ảnh 2D từ mô hình 3D | ⚪ Hộp thư đến 👤 | P3 | CORE + HALL | — |
| T-153 | Nghiệm thu chéo đợt Pháp Tướng 3D | ⏳ T-151 | P1 | CORE + HALL | — (gợi ý: gemini-4-argon-high soát hình, gpt-6.1-sol soát mã) |
| T-160 | Danh mục 8 bộ đá cho cờ vây và caro (`STONES`), `kd:skin` nhận theo môn | ✅ Xong · PR #64 | P1 | CORE + KYDAO + KYDAI | gpt-6.1-terra |
| T-161 | Ảnh 8 bộ đá dựng bằng Blender (`stones.py`, atlas 256×128) | ✅ Xong · PR #64 | P1 | CORE + KYDAO + KYDAI | Claude Sonnet 5.5 (Blender) |
| T-162 | Bộ chọn "Bộ đá" và vẽ đá có skin trên bàn 2D | ✅ Xong · PR #64 | P1 | CORE + KYDAO + KYDAI | Claude Sonnet 5.5 |
| T-163 | Đá có skin trên bàn 3D | ✅ Xong · PR #64 | P1 | CORE + KYDAO + KYDAI | gemini-3.8-flash |
| T-170 | Lõi cửa hàng skin (`lib/kydao/shop.js`), lưu bền `kydao.shop` và `kydao.unlocks` | ✅ Xong · PR #64 | P1 | CORE + KYDAO + KYDAI | gpt-6.1-terra |
| T-171 | Giao thức khóa và mua skin trên máy chủ (`kd:shop:state`, `kd:shop:buy`, `purpose:'skin'`) | ✅ Xong · PR #64 | P1 | CORE + KYDAO + KYDAI | Claude Sonnet 5.5 |
| T-172 | Khối "Cửa hàng skin bàn cờ" ở trang quản trị | ✅ Xong · PR #64 | P1 | CORE + KYDAO + KYDAI | gpt-6-luna |
| T-173 | Bộ chọn có khóa skin: giá, khung xác nhận, QR, tự mở khi duyệt | ✅ Xong · PR #64 | P1 | CORE + KYDAO + KYDAI | Claude Sonnet 5.5 |
| T-174 | Tài liệu người chơi và thử đầu-cuối bộ đá, mua skin bằng hai trình duyệt | ✅ Xong · PR #64 | P1 | CORE + KYDAO + KYDAI | Claude Sonnet 5.5 |
| T-175 | Sửa lệnh mua skin theo kết quả soát của Gemini 4 Argon | ✅ Xong · PR #64 | P1 | CORE + KYDAO + KYDAI | gpt-6.1-terra |
| T-176 | Bổ sung test cửa hàng skin: ghi sổ hỏng, duyệt tay bằng trình duyệt thật, gộp quyền khi khách đăng nhập | ✅ Xong · PR #65 | P2 | CORE + KYDAO + OPS | Claude Sonnet 5.5 |
| T-177 | Nhân vật Blender làm mặc định trong giao diện 3D, nút "Người cũ" đổi về dáng cũ | ✅ Xong · PR #66 | P1 | CORE + HALL | Claude Sonnet 5.5 |
| T-178 | Test tự động cho nút "Người cũ" (`view3d-ui.js`), dọn sổ việc đợt Kỳ Đài | ✅ Xong · PR #67 | P2 | CORE + HALL | Claude Sonnet 5.5 |
| T-179 | Ba ca test còn thiếu cho `kd:skin` (hết giờ chưa nổ hẹn giờ, gọi từ Chánh điện, giữ sân đổi quân trong hạn), chốt sổ việc đợt Kỳ Đài | ✅ Xong · PR #70 | P2 | CORE + KYDAO + KYDAI | Claude Sonnet 5.5 |

Thứ tự gợi ý: **T-003 → T-004 → T-006** (nối tiếp vì cùng chạm `package.json`). **T-005**, **T-007**, **T-002** làm song song được với nhóm trên.
Đợt 2026-11: làm **T-003, T-004, T-006** trước (T-004 gỡ nút thắt `package.json` cho mọi thẻ thêm file JS; T-006 là cổng "CI xanh"). Sau đó theo lịch 6 đợt ở [docs/KE-HOACH-DOT-2026-11.md §10.3](docs/KE-HOACH-DOT-2026-11.md#103-lịch-theo-đợt-và-khóa-vùng-nóng).

---

## Đang làm / Sẵn sàng

### T-001 · Chốt một trong hai nhánh Obito trùng nhau
- **Trạng thái**: ✅ Xong (2026-11-10). Chủ dự án chọn bản giao diện Obito chibi. Đã lấy `codex/obito-bi-kip-an` (đủ `?v=` và sửa test `secretSkills`), thay sprite bằng bản chibi 62 KB (256×371) của nhánh kia, thêm `lib/martial/secrets.js` vào `check`, ghi NOTICE mục 3c. Đã merge qua PR #21. Test thuần 291/291 đạt; test e2e chưa chạy (máy chưa `npm ci`). **Còn mở 👤:** quyền dùng hình Obito (nhân vật có bản quyền); xoá các nhánh `codex/bi-kip-an-obito`, `codex/obito-bi-kip-an`, `claude/T-001-obito-chibi`.
- **Ưu tiên**: P0
- **Gói ngữ cảnh**: CORE + PK + HALL + MARTIAL
- **Khu vực chạm**: lib/martial/secrets.js, lib/martial/service.js, lib/pk/engine.js, lib/pk/manager.js, public/img/obito-sprite.png, public/index.html, public/js/app.js, public/js/arena.js, public/js/hall.js, server.js, test/hall-npcs.test.js, test/martial-service.test.js, test/pk-manager.test.js, test/secret-skills.test.js
- **Phụ thuộc**: không
- **Người làm**: —
- **Nhánh**: —
- **Mục tiêu**: `origin/codex/bi-kip-an-obito` và `origin/codex/obito-bi-kip-an` cùng làm "NPC Obito và bí kíp ẩn" (cùng ngày 2026-11-09, mỗi nhánh 1 commit, chưa merge). Chọn một, mở PR, bỏ nhánh còn lại.
- **Khác nhau đã thấy** (so với `main`):
  - `obito-bi-kip-an`: thêm tăng `?v=` trong `public/index.html` và sửa `test/martial-service.test.js`; sprite **814 KB**.
  - `bi-kip-an-obito`: không có hai thay đổi trên; sprite **62 KB**.
- **Tiêu chí xong**:
  - [ ] Chủ dự án chọn nhánh (gợi ý: lấy `obito-bi-kip-an` vì đủ `?v=` và test, nhưng nén sprite xuống cỡ ~60 KB hoặc đổi sang `.webp`)
  - [ ] Nhánh được chọn gộp `main` mới nhất, `npm run check` + `npm test` sạch
  - [ ] `lib/martial/secrets.js` có trong danh sách `check`
  - [ ] Nguồn/giấy phép sprite Obito ghi vào `public/img/NOTICE.txt` (nhân vật có bản quyền: cần chủ dự án xác nhận được phép dùng)
  - [ ] PR mở; nhánh còn lại để chủ dự án xoá
- **Ngoài phạm vi**: đổi luật bí kíp, cân bằng lại số liệu.
- **Ghi chú**: đây là ví dụ thật của việc hai agent làm trùng; xem ORCHESTRATION.md §4.

### T-002 · Kiểm và dọn các nhánh đã merge
- **Trạng thái**: 🔵 Sẵn sàng 👤 (agent chỉ lập danh sách, chủ dự án xoá)
- **Ưu tiên**: P1
- **Gói ngữ cảnh**: CORE + OPS
- **Khu vực chạm**: task.md (chỉ thẻ này)
- **Phụ thuộc**: không
- **Người làm**: —
- **Nhánh**: — (không cần nhánh)
- **Mục tiêu**: GitHub đang có ~27 nhánh. Phần lớn đã merge. Lập danh sách an toàn để xoá, giúp agent sau không nhầm nhánh cũ là việc đang làm.
- **Tiêu chí xong**:
  - [ ] Danh sách nhánh đã merge hẳn (`git branch -r --merged origin/main`) → xoá được
  - [ ] Với nhánh chưa merge theo git nhưng có thể đã squash-merge (`codex/danh-hieu-pk-canh-gioi` ↔ PR #19, `codex/nhac-san-dau-va-pk` ↔ PR #20, `claude/charming-cannon-ra2cl9` ↔ nhánh `-aura` đã merge): so nội dung với `main` và ghi kết luận "đã có trong main" hoặc "còn thay đổi chưa vào main: …"
  - [ ] Dán danh sách vào Ghi chú của thẻ, kèm lệnh xoá để chủ dự án tự chạy
- **Ngoài phạm vi**: tự xoá nhánh, force-push.

### T-003 · Ghi baseline test trên Node 22
- **Trạng thái**: ✅ Xong, đã merge vào main qua PR #23 (2026-11-12, CI xanh). Soát (Opus thay Sol): PASS vòng 1. Baseline ghi trên Node v25 vì máy không có Node 22; Node 22 do CI (T-006) chạy. 3 test trượt cố định trên Windows → thẻ T-068.
- **Ưu tiên**: P0
- **Gói ngữ cảnh**: CORE + OPS
- **Khu vực chạm**: task.md, docs/agents/ARCHITECTURE.md (mục 7 nếu cần)
- **Phụ thuộc**: không
- **Người làm**: Claude Haiku 5.5 (thay GLM Flash)
- **Nhánh**: `claude/T-003-baseline-test`
- **Mục tiêu**: biết chắc `main` hiện tại có xanh không, mất bao lâu, test nào chậm/chập chờn, để các thẻ sau so được. (Lúc dựng bộ tài liệu này chưa chạy được `npm ci`; trên Node v25 của máy, 124 test thuần của `pk-engine`, `hall-npcs`, `martial-data` đạt hết trong ~5 giây.)
- **Tiêu chí xong**:
  - [ ] `npm ci` + `npm run check` + `npm test` trên Node 22 (giống production); ghi số đạt/bỏ qua/trượt và thời gian
  - [ ] Chạy `npm test` 2 lần; test nào kết quả khác nhau thì ghi là chập chờn (nghi vấn: `e2e-martial`, `e2e-donation-test-mode`, `e2e-sweeper`, `store-pg`)
  - [ ] Ghi kết quả vào mục "Baseline" cuối file này
  - [ ] Test trượt thật thì mở thẻ mới ở Hộp thư đến, không tự sửa trong thẻ này
- **Ngoài phạm vi**: sửa test.

### T-004 · `npm run check` tự quét file, không liệt kê tay
- **Trạng thái**: ✅ Xong, đã merge vào main qua PR #24 (2026-11-12, CI xanh). Soát (Opus thay Sol): PASS vòng 1. `tools/check.js` quét đệ quy `server.js`, `lib/`, `public/js/`, `tools/`, `test/` (86 file). Góp ý để sau: quét thêm `.mjs`, thêm test cho chính script.
- **Ưu tiên**: P1
- **Gói ngữ cảnh**: CORE + OPS
- **Khu vực chạm**: package.json, tools/check.js (mới), AGENTS.md (§2, §6), docs/agents/ARCHITECTURE.md (§6), docs/agents/CONTEXT-PACKS.md (gói CORE, PLACE)
- **Phụ thuộc**: T-003 (để có baseline)
- **Người làm**: Claude Sonnet 5.5 (thay Codex terra 6.1)
- **Nhánh**: `claude/T-004-check-tu-dong`
- **Mục tiêu**: hiện `check` là chuỗi `node --check` viết tay và **đang thiếu `lib/sweeper.js`**. Thay bằng script nhỏ không phụ thuộc thư viện, tự quét `server.js`, `lib/**/*.js`, `public/js/**/*.js` (**đệ quy**: đợt 2026-11 thêm thư mục `public/js/kydao/`), `tools/**/*.js` (bỏ qua `node_modules`, `.claude/`).
- **Thợ / Soát (đợt 2026-11)**: Codex terra 6.1 / Sol 6.1. Thẻ này **chặn** T-010, T-021, T-022, T-025, T-026, T-027, T-050 (để các thẻ đó không phải sửa `package.json`).
- **Tiêu chí xong**:
  - [ ] `npm run check` gọi `node tools/check.js`, quét tối thiểu đủ các file đang có trong danh sách cũ + `lib/sweeper.js`
  - [ ] Cố ý tạo lỗi cú pháp trong một file → lệnh trả mã khác 0 và in tên file
  - [ ] Chạy được trên Windows và Linux (đường dẫn bằng `path`, không dùng glob của shell)
  - [ ] Cập nhật AGENTS.md / ARCHITECTURE.md bỏ quy tắc "thêm tay vào check"
- **Ngoài phạm vi**: thêm ESLint/Prettier.

### T-005 · Test chống lệch các hằng số dùng chung
- **Trạng thái**: ✅ Xong, đã merge vào main qua PR #25 (2026-11-12, CI xanh). Soát (Opus thay Sol): PASS vòng 1. 5 ca kiểm, không có giá trị nào đang lệch. Người làm: Claude Sonnet 5.5 (thay Codex terra 6.1), nhánh `claude/T-005-test-dong-bo`.
- **Ưu tiên**: P1
- **Gói ngữ cảnh**: CORE + PK + HALL
- **Khu vực chạm**: test/sync-constants.test.js (mới)
- **Phụ thuộc**: không
- **Người làm**: —
- **Nhánh**: `<agent>/T-005-test-dong-bo`
- **Mục tiêu**: các giá trị phải khớp bằng tay (ARCHITECTURE.md §6) hiện chỉ dựa vào trí nhớ. Thêm một test đọc mã nguồn và báo đỏ khi lệch.
- **Tiêu chí xong**:
  - [ ] `LIB_SEATS` trong `server.js` == `LIB_SEATS` trong `public/js/hall.js`
  - [ ] `RAGE_MAX`, `EXPOSED_PCT`, `KC_PCT`, `KC_TURNS` đầu `public/js/arena.js` khớp `RAGE_MAX`, `EXPOSED_PCT`, `KC_BONUS`, `KC_TURNS` của `lib/pk/rules.js` (lưu ý `arena.js` ghi phần trăm nguyên `25`, `rules.js` ghi số thập phân `0.25`)
  - [ ] Các giá trị trong `MARTIAL.PK` (`public/js/martial.js`) khớp `lib/pk/rules.js`
  - [ ] Mỗi tên trong `PLACES` của `server.js` (trừ `hall`, là mặc định) có mặt trong danh sách mà vòng lặp `Places.register(name, …)` của `public/js/app.js` duyệt qua
  - [ ] Sửa thử một giá trị → test đỏ, thông báo lỗi nói rõ file nào lệch
  - [ ] Không sửa mã chạy thật (chỉ thêm test); nếu phát hiện đang lệch thật thì ghi vào Ghi chú và hỏi
- **Ngoài phạm vi**: tái cấu trúc để dùng chung một nguồn hằng số (có thể là thẻ sau).
- **Ghi chú (đợt 2026-11)**: Thợ Codex terra 6.1, Soát Sol 6.1. Sau khi T-010 và T-031 xong sẽ có thêm hai điểm đồng bộ: `MapBar.MAPS` (`public/js/mapbar.js`) ↔ `SCENES`/`PLACES` của `server.js`, và `YARD_TABLES` (`server.js` ↔ `public/js/hall.js`). Thẻ nào xong sau thì thêm ca kiểm vào `test/sync-constants.test.js`.

### T-006 · CI GitHub Actions chạy check + test
- **Trạng thái**: ✅ Xong, đã merge vào main qua PR #26 (2026-11-12, CI xanh). Soát (Opus thay Sol): PASS vòng 1. Chưa chạy thật trên GitHub Actions; lần chạy đầu sẽ cho baseline Node 22 + PostgreSQL. Nếu 3 test của T-068 cũng đỏ trên Linux thì CI đỏ cho tới khi T-068 xong. Người làm: Claude Sonnet 5.5, nhánh `claude/T-006-ci`.
- **Ưu tiên**: P1
- **Gói ngữ cảnh**: CORE + OPS
- **Khu vực chạm**: .github/workflows/ci.yml (mới)
- **Phụ thuộc**: T-003 (biết test nào chập chờn), nên sau T-004
- **Người làm**: —
- **Nhánh**: `<agent>/T-006-ci`
- **Mục tiêu**: mỗi PR của agent tự được kiểm, người soát không phải chạy tay hết.
- **Tiêu chí xong**:
  - [ ] Chạy trên `pull_request` và `push` vào `main`, Node 22, `npm ci` → `npm run check` → `npm test`
  - [ ] Có service PostgreSQL 16 và `TEST_DATABASE_URL` để test PG không bị bỏ qua
  - [ ] Không cần secret nào; không deploy
  - [ ] Ghi trong ORCHESTRATION.md §7 rằng CI xanh là điều kiện soát
- **Ngoài phạm vi**: deploy tự động lên Render.

### T-007 · Sửa mục "Cấu trúc mã" trong README
- **Trạng thái**: 🔵 Sẵn sàng
- **Ưu tiên**: P2
- **Gói ngữ cảnh**: CORE + DOCS
- **Khu vực chạm**: README.md (chỉ mục "Cấu trúc mã")
- **Phụ thuộc**: không
- **Người làm**: —
- **Nhánh**: `<agent>/T-007-readme-cau-truc`
- **Mục tiêu**: mục này đang ghi `lib/store.js` hai lần và thiếu `lib/auth.js`, `lib/account.js`, `lib/fortune-queue.js`, `lib/sweeper.js`, `public/js/fortune.js`, `public/js/dojo.js`, `public/js/arena.js`, `tools/pk-sim/`, `tools/ui-harness/`.
- **Tiêu chí xong**:
  - [ ] Mỗi file JS trong `lib/` và `public/js/` xuất hiện đúng một lần, có mô tả 1 dòng
  - [ ] Thêm dòng trỏ tới `AGENTS.md` và `docs/agents/` cho người phát triển
  - [ ] Không đổi các mục khác của README

### T-008 · Lệnh chạy ui-harness có sẵn trong package.json
- **Trạng thái**: ⚪ Hộp thư đến (cần quyết có thêm Playwright vào devDependencies không 👤)
- **Ưu tiên**: P2
- **Gói ngữ cảnh**: CORE + OPS + PK
- **Khu vực chạm**: package.json, tools/ui-harness/*
- **Mục tiêu**: hiện phải cài Playwright tay và nhớ cổng 4173/4174. Thêm `npm run ui:dojo`, `npm run ui:arena`.
- **Câu hỏi mở**: thêm `playwright` vào devDependencies (nặng ~ vài trăm MB khi cài Chromium) hay để cài tùy chọn?

### T-009 · Rà các bản làm việc rời trên máy
- **Trạng thái**: 🔵 Sẵn sàng 👤 (chủ dự án quyết giữ/xoá)
- **Ưu tiên**: P2
- **Gói ngữ cảnh**: CORE
- **Khu vực chạm**: không sửa repo; chỉ ghi kết quả vào thẻ này
- **Mục tiêu**: trên máy có các bản copy không có git của dự án do công cụ khác tạo: `C:\Users\admin'\Documents\ChatGPT\Pagoda\` (nhiều thư mục con, file `.patch`, script thử) và `C:\Users\admin'\Documents\Codex\2026-11-06\…\work\pagoda-{auth,base,google-current,library-transfer}`. Xác định có thay đổi nào **chưa có trong `main`** không.
- **Tiêu chí xong**:
  - [ ] So từng thư mục với `main` (bỏ qua `node_modules`), liệt kê file khác và đánh giá: đã có trong main / cũ hơn main / có việc chưa đưa lên
  - [ ] Phần "có việc chưa đưa lên" thì mở thẻ mới ở Hộp thư đến
  - [ ] Không xoá, không chép gì vào repo

---

## Đợt 2026-11 · Bàn cờ sân chùa, bói toán, danh hiệu, hướng dẫn, giao diện

> Thiết kế: [docs/KE-HOACH-DOT-2026-11.md](docs/KE-HOACH-DOT-2026-11.md) (viết tắt **KH** dưới đây, ví dụ "KH §5.4"). Quyết định D1–D16 ở KH §1: không ai sửa thì theo mặc định.
> Mọi thẻ: nhánh `<agent>/<mã-thẻ>-<slug>`, một PR, merge squash khi qua cổng KH §10.4. "Khu vực chạm" ghi **vùng** với `index.html`/`app.js` (KH §10.3: hai file này khóa theo vùng trong đợt này).
> Tiêu chí chung, không chép lại ở từng thẻ: `npm run check` sạch; test của gói sạch; sửa `public/` thì tăng `?v=`; chữ tiếng Việt có dấu; tôn trọng `prefers-reduced-motion`; báo cáo bàn giao theo ORCHESTRATION §6.

### Epic UI · Giao diện điều hướng

### T-010 · Làm thanh đổi map đồng bộ (4 nút), bỏ nút Xin xăm
- **Trạng thái**: ✅ Xong, đã merge vào main qua PR #32 (2026-11-12, CI xanh). Thợ: Claude Sonnet 5.5 (qua proxy). Soát: Sol 6.1 vòng 1 (2 lỗi), Opus 5.5 thay Sol/Argon các vòng sau (kênh Codex và Antigravity hết hạn mức). Điều phối tự chạy thật: đổi map 10 lần không lỗi console, 375×812 bốn nút 83×44px một hàng, dải gợi ý có ✕; test chọn bồ đoàn gần nhất được giao viết lại thành test hành vi (Điều phối thử làm hỏng: đỏ).
- **Ưu tiên**: P0 · **Đợt**: 1
- **Gói ngữ cảnh**: CORE + NAV + HALL
- **Khu vực chạm**: public/js/mapbar.js (mới), public/index.html (khối `nav.scene-nav`, `<script>`, `?v=`), public/js/app.js (`SCENE_HINT`, `applyScene`, `goScene`, các listener của scene-nav, `sitAt`), public/js/fortune.js (chỗ gắn `#go-yard`/`#go-hall`), public/css/style.css (`.scene-nav` → `.mapbar`, `.stage-hint` trên điện thoại), test/sync-constants.test.js (ca `MapBar.MAPS` ↔ `SCENES`/`PLACES`, nếu T-005 đã có file), docs/agents/ARCHITECTURE.md (§6: dòng `MapBar.MAPS`), README.md (dòng "chạm nút ở thanh dưới…"), docs/VO-HOC.md (dòng 13)
- **Phụ thuộc**: T-004 (đã xong: `npm run check` tự quét, không cần sửa `package.json`)
- **Thợ**: Sonnet 5.5 (high) · **Soát**: Sol 6.1 + Gemini Argon
- **Người làm**: Claude Sonnet 5.5 · **Nhánh**: `claude/T-010-thanh-doi-map`
- **Thiết kế**: KH §4.1, quyết định D2
- **Mục tiêu**: một thanh 4 nút cùng kiểu (Chánh điện · Sân chùa · Tàng Kinh Các · Sân đấu) ở mọi map, chỉ để đổi map. Bỏ nút "Xin xăm" và các nút việc trên cảnh; việc làm bằng chạm vật trong cảnh (xin xăm chỉ bằng hũ xăm trên bàn thờ).
- **Tiêu chí xong**:
  - [ ] `MapBar.MAPS` là nơi duy nhất khai báo map; nút đang đứng có `aria-current="page"` và nền vàng; các nút còn lại cùng cỡ, cùng kiểu
  - [ ] `app.js` gọi `MapBar.configure({ go })` **một lần**; sau đó nơi nào cũng chỉ cần `MapBar.mount(el)` (để T-012 gắn vào Sân đấu mà không cần thêm hàm vào `martialHost`)
  - [ ] Từ bất kỳ map nào sang map khác bằng 1 chạm (kể cả Tàng Kinh Các → Sân chùa)
  - [ ] Nút Sân đấu đi qua `act('arena')` (giữ `needLogin`), ẩn khi `cfg.martial.pk` tắt; `MapBar.setCurrent` và `MapBar.setEnabled` gọi trong `applyScene`
  - [ ] **Bẫy:** `applyScene` lúc vào chùa chỉ chạy qua `fortune.reset → setScene('hall')` (`fortune.js`, `app.js`). Giữ đường gọi này (hoặc gọi thẳng trong `welcome()`), có ca kiểm: vào chùa xong thì nút Chánh điện sáng
  - [ ] Không còn các id `go-yard`, `go-hall`, `go-library`, `open-lot`, `open-horoscope`, `open-tarot`, `lib-sit`, `lib-read`, `lib-dojo` trong `public/` (tìm bằng `id="<tên>"` và `#<tên>\b`; lớp CSS `.lib-reader` là thứ khác, giữ nguyên) và không chỗ nào đọc các id đó
  - [ ] Chạm bồ đoàn đang có người → tự chọn bồ đoàn trống gần nhất, báo một câu (giữ hành vi nút "Ngồi thiền" cũ)
  - [ ] Dòng gợi ý cảnh hiện trên điện thoại thành dải nhỏ có ✕, nhớ theo map (`ta-hint-<map>`, bọc try/catch)
  - [ ] 375×812: 4 nút một hàng, mỗi nút ≥ 44px cao, không cuộn. Ảnh 3 cỡ màn (375, 768, 1280) × 3 map đính kèm PR
  - [ ] `node --test test/e2e-scene.test.js test/hall-npcs.test.js` sạch; không lỗi console khi đổi map 10 lần liên tiếp
- **Ngoài phạm vi**: thanh dưới (T-011), Sân đấu bên trong (T-012), viết lại chữ gợi ý (T-065).

### T-011 · Gọn thanh dưới còn 9 nút lễ Phật, tab Khám phá
- **Trạng thái**: ✅ Xong, đã merge vào main qua PR #38 (2026-11-12, CI xanh). Thợ: Claude Sonnet 5.5 (qua proxy). Soát: Sol 6.1 + Opus 5.5 thay Argon; sau 2 vòng còn test giao diện yếu → giao sửa thêm (Điều phối thử làm hỏng: đỏ). Điều phối chạy thật 375×812: 9 nút, 2 hàng, nút 58px, không cuộn ngang, tab Khám phá, hộp giọng nói tự thu nhỏ.
- **Ưu tiên**: P0 · **Đợt**: 2
- **Gói ngữ cảnh**: CORE + NAV
- **Khu vực chạm**: public/index.html (`nav.actions`, tab/khung "Nơi khác", `#voicebar`), public/js/app.js (`act`, `welcome`, `renderVoice`, `showTab`), public/css/style.css (`.actions`, `.voicebar`), public/css/places.css, tools/ui-harness/arena/e2e-real.js, README.md, docs/VO-HOC.md, docs/VO-HOC-GIAO-THUC.md (chỉ câu ở dòng 11)
- **Phụ thuộc**: T-010
- **Thợ**: Sonnet 5.5 (high) · **Soát**: Sol 6.1 + Gemini Argon
- **Người làm**: Claude Sonnet 5.5 · **Nhánh**: `claude/T-011-thanh-le-phat`
- **Thiết kế**: KH §4.2, D3, D4
- **Mục tiêu**: thanh dưới chỉ còn việc cốt lõi của đi chùa như bản đầu; trò phụ không có nút ở dưới.
- **Tiêu chí xong**:
  - [ ] Đúng 9 nút theo thứ tự D3; không còn `data-act="library"`, `#actDojo`, `#actArena`; không còn chuỗi `actDojo|actArena` trong `public/`
  - [ ] `welcome()` chạy được khi `MARTIAL_ENABLED=0` và `PK_ENABLED=0` (thử cả hai)
  - [ ] ≤ 480px: lưới 5 + 4, ô ≥ 44px, không cuộn ngang; máy bàn một hàng
  - [ ] Tab "Nơi khác" đổi thành "Khám phá": 4 thẻ (Sân chùa, Tàng Kinh Các, Võ Học Các, Sân đấu), mỗi thẻ 1 câu + 1 nút; thẻ ẩn khi tính năng tắt
  - [ ] `#voicebar` chỉ có nút mic khi thanh dưới bị ẩn (đang ở Võ Học Các / Sân đấu); tự thu nhỏ sau 6 giây
  - [ ] Thắp nhang / dâng hoa / thỉnh chuông khi đang ở Sân chùa hoặc Tàng Kinh Các: báo rõ đã làm ở chánh điện (ví dụ "Lễ đã dâng lên bàn thờ ở chánh điện.")
  - [ ] Sửa câu sai "Chỉ người tự ra sân mới thấy và mời được nhau" (thẻ Sân đấu trong `index.html`, `docs/VO-HOC.md` dòng 11, `docs/VO-HOC-GIAO-THUC.md` dòng 11): thực tế mời được từ chánh điện qua hộp người chơi
  - [ ] `tools/ui-harness/arena/e2e-real.js` dùng nút Sân đấu của thanh đổi map và chạy qua
  - [ ] README, `docs/VO-HOC.md` không còn câu "nút ở thanh dưới" cho trò phụ
- **Ngoài phạm vi**: thêm nút mới ở thanh dưới; đổi luật công đức.

### T-012 · Thanh đổi map trong Sân đấu
- **Trạng thái**: ✅ Xong, đã merge vào main qua PR #49 (2026-11-12, CI xanh). Thợ: Claude Sonnet 5.5 (qua proxy). Soát: Opus 5.5 thay Argon, Sol 6.1. Điều phối chạy thật: vào Sân đấu, thanh 4 nút với Sân đấu sáng, không lỗi console. ui-harness arena cần Playwright, chưa chạy.
- **Ưu tiên**: P1 · **Đợt**: 3
- **Gói ngữ cảnh**: CORE + NAV + PK
- **Khu vực chạm**: public/js/arena.js (đầu màn, nút "← Về chánh điện", hộp rời trận), public/css/arena.css, public/index.html (`?v=`), tools/ui-harness/arena/* (nếu cần)
- **Phụ thuộc**: T-010 (`MapBar.configure/mount`), T-011 (đã sửa `e2e-real.js`)
- **Thợ**: Sonnet 5.5 (high) · **Soát**: Gemini Argon + Sol 6.1
- **Người làm**: Claude Sonnet 5.5 · **Nhánh**: `claude/T-012-thanh-map-san-dau`
- **Thiết kế**: KH §4.3
- **Mục tiêu**: Sân đấu có cùng thanh đổi map như các map khác (Sân đấu sáng), thay nút "← Về chánh điện".
- **Tiêu chí xong**:
  - [ ] `MapBar.mount()` ở đầu màn Sân đấu; bấm map khác khi không có trận → đi thẳng; khi có trận → dùng lại hộp xác nhận rời trận có sẵn (`ui.dLeave`) như nút cũ
  - [ ] `node tools/ui-harness/arena/gen-fixtures.js` + `ui-check.js` sạch; `e2e-real.js` sạch
  - [ ] 375×812: thanh không che công tắc "Không nhận lời mời" và dải chờ
- **Ngoài phạm vi**: viết lại chữ Sân đấu (T-064).

### Epic KD · Kỳ Đạo (năm môn cờ ngoài sân chùa)

### T-020 · Chốt giao thức Kỳ Đạo
- **Trạng thái**: ✅ Xong, đã merge vào main qua PR #31 (2026-11-12, CI xanh). Thợ: Claude Sonnet 5.5 (qua proxy). Soát: Sol 6.1 vòng 1 (9 lỗi), Opus 5.5 thay Sol ở vòng 2–3 vì kênh Codex hết hạn mức; điểm cuối (báo trước ván bị hạ xuống giao hữu) được Điều phối giao sửa thêm và kiểm lại.
- **Ưu tiên**: P0 · **Đợt**: 1
- **Gói ngữ cảnh**: CORE + KYDAO + DOCS
- **Khu vực chạm**: docs/KY-DAO-GIAO-THUC.md (mới), docs/agents/ARCHITECTURE.md (§1, §4, §6), docs/agents/CONTEXT-PACKS.md (gói KYDAO)
- **Phụ thuộc**: không (theo D1, D6–D9, D16)
- **Thợ**: Sonnet 5.5 (high) · **Soát**: Sol 6.1
- **Người làm**: Claude Sonnet 5.5 · **Nhánh**: `claude/T-020-giao-thuc-ky-dao`
- **Thiết kế**: KH §5.3 → §5.8
- **Mục tiêu**: hợp đồng ràng buộc cho mọi thẻ KD, viết theo kiểu `docs/VO-HOC-GIAO-THUC.md`.
- **Tiêu chí xong**:
  - [ ] Giao diện module luật (`create/turn/legalMoves/play/status/view/notation`) có ví dụ cụ thể cho cả 5 môn và định dạng nước đi từng môn (regex)
  - [ ] Mỗi sự kiện `kd:*`: ai gửi, điều kiện, payload (kiểu từng trường), ack, lỗi (`reason` tiếng Việt, `code`)
  - [ ] Mục "Bất biến bảo mật" (quân úp chưa lật, uid, người xem) và "Thứ tự gói tin" (vào lại giữa ván, `kd:moved` tới trước `kd:start`)
  - [ ] Đồng hồ, hủy ván, hết giờ, vắng mặt, khởi động lại máy chủ, Elo, chống cày, lưu bền (`db.kydao`)
  - [ ] `YARD_TABLES` và cách chọn "bàn trong" khi hết bàn
  - [ ] ARCHITECTURE.md: sơ đồ, bảng sự kiện §4 (chỉ nhóm `kd:*`), điểm đồng bộ §6 (dòng `YARD_TABLES`; dòng `MapBar.MAPS` là của T-010)
- **Ngoài phạm vi**: viết mã.

### T-021 · Viết luật cờ vua thuần và kiểm perft
- **Trạng thái**: ✅ Xong, đã merge vào main qua PR #30 (2026-11-12, CI xanh). Thợ: Claude Sonnet 5.5 viết bản đầu, Codex terra 6.1 (gpt-6.1-terra) sửa 2 vòng. Soát: Sol 6.1 còn 2 điểm sau 2 vòng; Điều phối xét: perft d4 cả 5 thế đã chạy đúng (Điều phối chạy, 0,5 giây); nhận diện thế cờ chết có hàng rào Tốt là ngoài phạm vi thẻ (chỉ khiến ván không tự hòa, người chơi vẫn xin hòa được) → chấp nhận, ghi vào Hộp thư đến.
- **Ưu tiên**: P0 · **Đợt**: 1
- **Gói ngữ cảnh**: CORE + KYDAO
- **Khu vực chạm**: public/js/kydao/chess.js (mới), test/kydao-chess.test.js (mới)
- **Phụ thuộc**: T-004. Giao diện module theo KH §5.3 (làm song song với T-020; lệch thì báo Điều phối)
- **Thợ**: Codex terra 6.1 · **Soát**: Sol 6.1
- **Người làm**: Claude Sonnet 5.5 + Codex terra 6.1 · **Nhánh**: `claude/T-021-luat-co-vua`
- **Thiết kế**: KH §5.3, §5.4 "Cờ vua", Phụ lục A
- **Mục tiêu**: luật cờ vua đầy đủ, đúng tuyệt đối, dùng chung máy chủ và trình duyệt.
- **Tiêu chí xong**:
  - [ ] UMD, global `KyChess`, không DOM, không phụ thuộc; `require` được ở Node
  - [ ] perft d1–d3 đúng cả 5 thế ở Phụ lục A; d4 chạy khi `PERFT_DEEP=1`
  - [ ] Ca riêng: nhập thành bị cấm khi đi qua ô bị chiếu; bắt tốt qua đường làm lộ vua bị cấm; phong cấp 4 loại; chiếu hết; hết nước (hòa); lặp 3 lần; 50 nước; 4 ca không đủ quân
  - [ ] `notation` ra SAN đúng (`+`, `#`, `O-O`, phân biệt cột/hàng khi hai quân cùng tới một ô)
  - [ ] FEN vào/ra khứ hồi; `play` không sửa state cũ (test `Object.freeze`)
  - [ ] perft d3 thế đầu < 1 giây
- **Ngoài phạm vi**: giao diện, đồng hồ, bot.

### T-022 · Viết luật cờ tướng thuần, perft, ký hiệu Việt
- **Trạng thái**: ✅ Xong, đã merge vào main qua PR #33 (2026-11-12, CI xanh). Thợ: Codex terra 6.1 (gpt-6.1-terra); sửa vòng 1 bằng Claude Sonnet 5.5 vì kênh Codex hết hạn mức. Soát: Opus 5.5 thay Sol 6.1 và Gemini Argon (hai kênh hết hạn mức), PASS vòng 2. Perft d1–d3 đúng (44 / 1.920 / 79.666).
- **Ưu tiên**: P0 · **Đợt**: 1
- **Gói ngữ cảnh**: CORE + KYDAO
- **Khu vực chạm**: public/js/kydao/xiangqi.js (mới), test/kydao-xiangqi.test.js (mới)
- **Phụ thuộc**: T-004
- **Thợ**: Codex terra 6.1 · **Soát**: Sol 6.1 + Gemini Argon (luật lặp thế)
- **Người làm**: Codex terra 6.1 + Claude Sonnet 5.5 · **Nhánh**: `claude/T-022-luat-co-tuong`
- **Thiết kế**: KH §5.4 "Cờ tướng", Phụ lục A
- **Mục tiêu**: luật cờ tướng đầy đủ, ký hiệu kiểu Việt, sẵn chỗ cho biến thể cờ úp.
- **Tiêu chí xong**:
  - [ ] UMD, global `KyXiangqi`; perft thế đầu d1 = 44, d2 = 1.920, d3 = 79.666 (Sol đối chiếu nguồn thứ hai)
  - [ ] Ca riêng: lộ mặt tướng bị cấm; cản mắt tượng; cản chân mã; pháo ăn cần đúng một ngòi; tốt qua sông đi ngang; tượng không qua sông; sĩ/tướng không ra cung
  - [ ] Hết nước hợp lệ = thua; lặp thế lần 3 mà một bên chiếu liên tục trong vòng lặp → bên đó thua, không thì hòa; 60 nước mỗi bên không ăn quân → hòa
  - [ ] `notation` ký hiệu Việt: `P2-5`, `M8.7`, `X1/1`; hai quân cùng cột dùng `t`/`s`
  - [ ] FEN cờ tướng khứ hồi; state có sẵn trường cho biến thể (`variant`, `hidden`) nhưng chưa làm cờ úp
- **Ngoài phạm vi**: cờ úp (T-024), giao diện.

### T-023 · Nghiên cứu luật cờ tướng úp (揭棋)
- **Trạng thái**: ✅ Xong, đã merge vào main qua PR #47 (2026-11-12, CI xanh). Thợ: GLM Flash (glm-4.5-flash) 2 vòng chưa đạt; Điều phối giao Claude Sonnet 5.5 viết lại. Soát: Opus 5.5 thay Gemini Argon. Luật theo D7; các điểm 👤 ở §7 của tài liệu (hòa 40 hồi hay 60 nước, lặp thế, ăn quân úp chỉ bên ăn biết).
- **Ưu tiên**: P1 · **Đợt**: 1
- **Gói ngữ cảnh**: CORE + KYDAO + DOCS
- **Khu vực chạm**: docs/ky-dao/CO-TUONG-UP.md (mới)
- **Phụ thuộc**: không
- **Thợ**: GLM Flash · **Soát**: Gemini Argon
- **Người làm**: GLM Flash + Claude Sonnet 5.5 · **Nhánh**: `claude/T-023-nghien-cuu-co-up`
- **Thiết kế**: KH §5.4 "Cờ tướng úp", D7
- **Mục tiêu**: bộ luật cờ úp rõ ràng, có nguồn, để T-024 làm không phải đoán.
- **Tiêu chí xong**:
  - [ ] ≥ 3 nguồn (≥ 2 tiếng Trung), ghi link và ngày truy cập
  - [ ] Trả lời rõ: quân nào úp; xáo thế nào; quân úp đi theo gì; khi nào lật; Sĩ/Tượng đã lật có bị giới hạn không; Tốt lật ra ở hàng cuối; ăn quân úp thì ai thấy; lặp thế và hòa; các biến thể phổ biến (ví dụ 天天象棋)
  - [ ] Bảng so sánh với mặc định D7, đề xuất cuối cùng; nếu khác D7 thì ghi "👤 cần chủ dự án chốt"
  - [ ] 5 tình huống minh họa bằng sơ đồ chữ
- **Ngoài phạm vi**: mã.

### T-024 · Thêm biến thể cờ tướng úp
- **Trạng thái**: 🟣 Chờ soát
- **Ưu tiên**: P1 · **Đợt**: 2
- **Gói ngữ cảnh**: CORE + KYDAO
- **Khu vực chạm**: public/js/kydao/xiangqi.js, test/kydao-jieqi.test.js (mới)
- **Phụ thuộc**: T-022, T-023 (và D7 đã chốt)
- **Thợ**: Codex terra 6.1 · **Soát**: Sol 6.1 + Gemini Argon
- **Người làm**: Gemini 3.8 Flash (qua proxy) · **Nhánh**: gemini/T-024-co-tuong-up
- **Thiết kế**: KH §5.4 "Cờ tướng úp", `docs/ky-dao/CO-TUONG-UP.md`
- **Mục tiêu**: `variant:'jieqi'` chạy đúng luật đã chốt, không lộ quân úp.
- **Tiêu chí xong**:
  - [x] `create({ variant:'jieqi', rng })` xáo 15 quân mỗi bên lên vị trí gốc, Tướng ngửa; cùng seed → cùng xáo
  - [x] Quân úp đi theo quân chủ nhà của ô; đi xong thì lật; `play` trả `info.reveal`
  - [x] `view(state, side)` không chứa danh tính quân chưa lật (test duyệt đệ quy mọi trường, mọi kiểu dữ liệu)
  - [x] `legalMoves(view)` == `legalMoves(state đầy đủ)` trên 1.000 thế ngẫu nhiên (chứng minh trình duyệt tính đúng mà không biết quân thật)
  - [x] Luật Sĩ/Tượng/Tốt sau khi lật và luật ăn quân úp theo T-023
- **Ngoài phạm vi**: giao diện (T-033).
- **Ghi chú**: Đã hoàn thành variant:'jieqi' trong KyXiangqi theo luật D7. Đã cập nhật test/kydao-jieqi.test.js theo soát nghiệp vụ: sửa test không chiếu từ ô ban đầu, thêm lặp thế 3 lần cho jieqi, hoàn thiện TH1/TH4/TH5 và kiểm tra rò rỉ view. Sửa dòng 53 của test/kydao-xiangqi.test.js vì jieqi nay đã được hỗ trợ chính thức.

### T-025 · Viết luật cờ vây thuần
- **Trạng thái**: ✅ Xong, đã merge vào main qua PR #34 (2026-11-12, CI xanh). Thợ: Codex terra 6.1 (gpt-6.1-terra), sửa bằng Claude Sonnet 5.5 (kênh Codex hết hạn mức). Soát: Opus 5.5 thay Sol/Argon. Sau 2 vòng, Điều phối quyết: chấp nhận 5 thế mẫu tự dựng (soát đã tính lại, ghi nguồn luật tính diện tích) và bắt thêm test chống bấm 'Đồng ý' hai lần (Điều phối thử làm hỏng: đỏ).
- **Ưu tiên**: P1 · **Đợt**: 1
- **Gói ngữ cảnh**: CORE + KYDAO
- **Khu vực chạm**: public/js/kydao/go.js (mới), test/kydao-go.test.js (mới)
- **Phụ thuộc**: T-004
- **Thợ**: Codex terra 6.1 · **Soát**: Sol 6.1 + Gemini Argon
- **Người làm**: Codex terra 6.1 + Claude Sonnet 5.5 · **Nhánh**: `claude/T-025-luat-co-vay`
- **Thiết kế**: KH §5.4 "Cờ vây", D9
- **Mục tiêu**: cờ vây 9/13/19, luật Trung Quốc, tính điểm tự động sau khi hai bên thống nhất quân chết.
- **Tiêu chí xong**:
  - [ ] UMD, global `KyGo`; bắt quân, bắt nhóm; cấm tự sát; siêu cô theo vị trí (Zobrist) có ca "ba cô"
  - [ ] `pass`; hai lần `pass` liên tiếp → giai đoạn đánh dấu (`mark`, `agree`, `resumePlay`); đổi dấu thì mất đồng ý
  - [ ] Tính điểm quân + đất, komi 7,5; seki: quân sống, khí chung không là đất; 5 ván mẫu có điểm biết trước (ghi nguồn)
  - [ ] Ký hiệu `D4` (bỏ chữ I), `pass`, `mark:D4`
- **Ngoài phạm vi**: chấp quân, giao diện.

### T-026 · Viết luật cờ caro thuần
- **Trạng thái**: ✅ Xong, đã merge vào main qua PR #27 (2026-11-12, CI xanh). Thợ: Claude Haiku 5.5 (làm trước khi chuyển sang proxy). Soát: Sol 6.1 (gpt-6.1-sol) PASS vòng 1.
- **Ưu tiên**: P1 · **Đợt**: 1
- **Gói ngữ cảnh**: CORE + KYDAO
- **Khu vực chạm**: public/js/kydao/gomoku.js (mới), test/kydao-gomoku.test.js (mới)
- **Phụ thuộc**: T-004
- **Thợ**: GLM Flash · **Soát**: Sol 6.1
- **Người làm**: Claude Haiku 5.5 (thay GLM Flash) · **Nhánh**: `claude/T-026-luat-caro`
- **Thiết kế**: KH §5.4 "Cờ caro", D8
- **Mục tiêu**: caro 15×15 luật "chặn hai đầu".
- **Tiêu chí xong**:
  - [ ] UMD, global `KyGomoku`; thắng ở 4 hướng; bị chặn hai đầu không thắng; chặn một đầu vẫn thắng; 6 quân vẫn thắng; sát mép vẫn thắng (mép không tính là chặn)
  - [ ] Kín bàn = hòa; nước ra ngoài bàn hoặc vào ô có quân bị từ chối với `reason` tiếng Việt
  - [ ] Ký hiệu `h8` (cột a–o, hàng 1–15)
- **Ngoài phạm vi**: luật mở ván Swap2.

### T-027 · Tính Elo và điều kiện xếp hạng
- **Trạng thái**: ✅ Xong, đã merge vào main qua PR #35 (2026-11-12, CI xanh). Thợ: Claude Haiku 5.5 viết bản đầu; GLM Flash (glm-4.5-flash) sửa 2 vòng nhưng làm ngược luật D6 khi tắt Google và tự sửa task.md; Điều phối giao Claude Sonnet 5.5 sửa lần cuối. Soát: Sol 6.1 vòng 1–2, Opus 5.5 vòng 3. Điều phối kiểm tay: công thức, K, sàn, điều kiện tài khoản đúng.
- **Ưu tiên**: P0 · **Đợt**: 1
- **Gói ngữ cảnh**: CORE + KYDAO
- **Khu vực chạm**: lib/kydao/elo.js (mới), test/kydao-elo.test.js (mới)
- **Phụ thuộc**: T-004
- **Thợ**: GLM Flash · **Soát**: Sol 6.1
- **Người làm**: Claude Haiku 5.5 + GLM Flash + Claude Sonnet 5.5 · **Nhánh**: `claude/T-027-elo`
- **Thiết kế**: KH §5.6, D6
- **Mục tiêu**: hàm thuần tính Elo và quyết định một ván có được xếp hạng không.
- **Tiêu chí xong**:
  - [ ] `update({ ra, rb, na, nb, score })` theo công thức và bảng K của D6, sàn 100, làm tròn số nguyên
  - [ ] `eligible({ rated, aIsAccount, bIsAccount, plies, minPlies, pairToday })` trả `{ ok }` hoặc `{ ok:false, reason }` tiếng Việt
  - [ ] `peak` chỉ đổi khi `n ≥ 20`; dấu "tạm tính" khi `n < 10`
  - [ ] 10 ca tính tay (ghi cách tính trong test)
- **Ngoài phạm vi**: lưu bền.

### T-028 · Viết bộ quản lý ván cờ
- **Trạng thái**: ✅ Xong, đã merge vào main qua PR #39 (2026-11-12, CI xanh). Thợ: Codex terra 6.1 (bản đầu, dừng sớm vì hạn mức), Claude Sonnet 5.5 sửa 2 vòng. Soát: Sol 6.1 (vòng 1), Opus 5.5 thay Sol (vòng 2–3) PASS. 51 test đạt, có quét mọi emit không lộ uid/quân úp.
- **Ưu tiên**: P0 · **Đợt**: 2
- **Gói ngữ cảnh**: CORE + KYDAO + PK (tham khảo khuôn `lib/pk/manager.js`)
- **Khu vực chạm**: lib/kydao/manager.js (mới), lib/kydao/registry.js (mới), test/kydao-manager.test.js (mới)
- **Phụ thuộc**: T-020, T-021, T-022, T-027 (vây/caro/úp nối thêm khi T-024–T-026 xong, không chặn)
- **Thợ**: Codex terra 6.1 · **Soát**: Sol 6.1
- **Người làm**: Codex terra 6.1 + Claude Sonnet 5.5 · **Nhánh**: `claude/T-028-quan-ly-van`
- **Thiết kế**: KH §5.5, §5.6, §5.8, `docs/KY-DAO-GIAO-THUC.md`
- **Mục tiêu**: bộ quản lý thuần (deps tiêm vào) cho bàn, ghế, lời mời, đồng hồ, nước đi, người xem, kết quả, vào lại.
- **Tiêu chí xong**:
  - [ ] Không `require` socket/timer/fs; mọi thời gian qua `deps.now/setTimer`; `timeScale` áp cho mọi mốc
  - [ ] Ngồi / chọn luật / sẵn sàng / bắt đầu; mời 20 giây, 1 lời mời đi, ≤ 3 lời mời đến, giãn 10 giây, bị từ chối chờ 5 phút
  - [ ] `move` kiểm lượt, `ply`, luật; đồng hồ Fischer; hết giờ (cờ vua: đối thủ không đủ quân → hòa)
  - [ ] Hủy ván: chưa đi nước đầu sau 30 giây; kết thúc khi chưa đủ số nước (KH §5.5); hai bên vắng 60 giây
  - [ ] Đầu hàng, xin hòa, hòa tự động; cờ vây: đánh dấu, đồng ý, 3 phút không thống nhất thì tính theo dấu hiện có
  - [ ] `finish()` gọi nhiều lần chỉ ghi Elo một lần; chống cày 3 ván/cặp/ngày/môn; không cộng công đức
  - [ ] `resume` trả ảnh chụp đúng phía; sau khởi động lại trả câu "Ván trước bị hủy…" (nhờ `deps.getActive/setActive`, lưu ở `db.kydao.active`); người xem ≤ 50 nhận `kd:moved`
  - [ ] "Bàn trong" (ván mời khi hết bàn) dùng chung luật và giới hạn `KYDAO_MAX_GAMES` như bàn thật, được xếp hạng bình thường
  - [ ] Test quét **mọi** lần `emit`: không có uid, không có danh tính quân úp chưa lật
  - [ ] Bọc `safe()`; `KYDAO_MAX_GAMES`
- **Ngoài phạm vi**: socket thật (T-030), lưu bền (T-029).

### T-029 · Lưu bền dữ liệu Kỳ Đạo và kỷ lục
- **Trạng thái**: ✅ Xong, đã merge vào main qua PR #36 (2026-11-12, CI xanh). PR vào main: 👤 chủ dự án bấm merge (đổi hình dạng dữ liệu). Thợ: Claude Sonnet 5.5 (qua proxy). Soát: Sol 6.1.
- **Ưu tiên**: P0 · **Đợt**: 2 · **👤 chủ dự án bấm merge**
- **Gói ngữ cảnh**: CORE + STORE + AUTH
- **Khu vực chạm**: lib/store-sections.js, lib/account.js (hàm mới `mergeKydaoGuest`), test/store-json.test.js, test/store-pg.test.js, test/account.test.js
- **Phụ thuộc**: T-020
- **Thợ**: Sonnet 5.5 (high) · **Soát**: Sol 6.1
- **Người làm**: Claude Sonnet 5.5 · **Nhánh**: `claude/T-029-luu-ben-kydao`
- **Thiết kế**: KH §6.2, AGENTS.md §3.11
- **Mục tiêu**: hai khóa cấp cao mới `db.kydao = { ratings:{}, games:[], active:{} }` và `db.records = { log:[] }` được lưu đủ ở JSON và PostgreSQL.
- **Tiêu chí xong**:
  - [ ] Có trong `fresh()`, `SECTIONS`, `adopt()` (gộp lồng như `martial`), `unknownKeys` (kiểm cả khóa con)
  - [ ] `kydao.games` và `records.log` là danh sách có khóa `id` (lấy từ `db.seq` qua `store.nextId()`), để PostgreSQL ghi theo chênh lệch, không ghi lại cả mục khi cắt bớt
  - [ ] `kydao.active` (uid → gameId) để phát hiện ván dở sau khi máy chủ khởi động lại (giống `setActiveMatch` của PK)
  - [ ] `fill()` của `store-json.test.js` và `store-pg.test.js` có dữ liệu mới; test PG chạy hoặc ghi rõ bỏ qua vì thiếu `TEST_DATABASE_URL`
  - [ ] Dữ liệu cũ (không có hai khóa) nạp vẫn chạy
  - [ ] `mergeKydaoGuest(guest, account)` trong `lib/account.js`: Elo mỗi môn lấy bản có nhiều ván hơn; có hàm hoàn tác như các hàm gộp khác; test. (Gọi từ `linkGuest` trong `server.js` là việc của T-030.)
- **Ngoài phạm vi**: logic ván, logic danh hiệu, sửa `server.js`.

### T-030 · Nối Kỳ Đạo vào máy chủ
- **Trạng thái**: ✅ Xong, đã merge vào main qua PR #51 (2026-11-12, CI xanh). Thợ: Claude Sonnet 5.5 (qua proxy). Soát: Opus 5.5 thay Sol, PASS vòng 2. Sau gộp: npm test 702 test, 698 đạt, 0 trượt, 4 bỏ qua (PostgreSQL).
- **Ưu tiên**: P0 · **Đợt**: 3
- **Gói ngữ cảnh**: CORE + KYDAO + HALL + AUTH
- **Khu vực chạm**: server.js (cấu hình `KYDAO_*`, `YARD_TABLES`, `kydaoOnly`, handler `kd:*`, tạo manager trong `main()`, `shutdown`, rời bàn khi đổi cảnh/place/ngắt kết nối, `linkGuest` gọi `mergeKydaoGuest` kể cả đường hoàn tác, `/api/config` thêm `kydao`), test/e2e-kydao.test.js (mới), test/sync-constants.test.js (thêm ca `YARD_TABLES`), docs/agents/ARCHITECTURE.md (§2, §4: chỉ thêm dòng của mình), README.md (biến môi trường)
- **Phụ thuộc**: T-028, T-029, T-031 (`YARD_TABLES` phía `hall.js` có trước), T-051 (thứ tự `server.js`)
- **Thợ**: Sonnet 5.5 (high) · **Soát**: Sol 6.1
- **Người làm**: Claude Sonnet 5.5 · **Nhánh**: `claude/T-030-noi-ky-dao-may-chu`
- **Thiết kế**: KH §5.7, `docs/KY-DAO-GIAO-THUC.md`
- **Mục tiêu**: chơi được cờ qua socket thật, máy chủ trọng tài.
- **Tiêu chí xong**:
  - [ ] e2e: hai người ngồi bàn, chọn cờ vua, đánh tới chiếu hết; Elo ghi vào `db.kydao`
  - [ ] e2e cờ úp: không gói nào gửi cho B hay người xem chứa quân úp chưa lật của A
  - [ ] e2e: người xem nhận nước; đổi cảnh / ngắt kết nối khi đang ngồi được xử lý đúng; `kd:resume` sau tải lại
  - [ ] e2e: nhận lời mời đánh cờ từ chánh điện → máy chủ đưa cả hai sang Sân chùa (`pscene`) và cho đi tới ghế bàn trống gần nhất; hết bàn → "bàn trong" (người chơi đứng tại chỗ)
  - [ ] Tư thế ngồi bàn lấy từ danh sách ghế trong `kd:table` (theo `pid`), không thêm trường vào `publicPlayer`
  - [ ] Gộp khách → tài khoản gọi `mergeKydaoGuest` trong `linkGuest`, hoàn tác đúng khi flush lỗi (test)
  - [ ] Ca `YARD_TABLES` (`server.js` ↔ `hall.js`) trong `test/sync-constants.test.js`
  - [ ] `bucket('kd', 5, 15)`; khóa lạ bị bỏ (`hasOwnProperty`, như các handler khác); `move` sai định dạng bị từ chối
  - [ ] `KYDAO_ENABLED=0` → mọi `kd:*` trả "Bàn cờ chưa mở."; không cộng công đức (D16)
  - [ ] `npm test` toàn bộ xanh
- **Ngoài phạm vi**: giao diện.

### T-031 · Vẽ bàn đá và ghế ở Sân chùa
- **Trạng thái**: ✅ Xong, đã merge vào main qua PR #42 (2026-11-12, CI xanh). Thợ: Claude Sonnet 5.5 (qua proxy). Soát: Opus 5.5 thay Argon/Sol; sau 2 vòng còn lỗi chạm thầy bói mở nhầm bàn ở cỡ canvas thật → giao sửa (thầy bói ưu tiên, test dùng cỡ canvas thật).
- **Ưu tiên**: P0 · **Đợt**: 2
- **Gói ngữ cảnh**: CORE + HALL + KYDAO
- **Khu vực chạm**: public/js/hall.js (`YARD_TABLES`, vẽ bàn/ghế, `tableAt`, hover, `personAt` bỏ qua người đang ngồi bàn, tư thế ngồi bàn, biển tên, biểu tượng bàn cờ nhỏ trên đầu người chơi "bàn trong", `Hall.setTables`), test/hall-npcs.test.js (thêm ca nếu cần), test/hall-tables.test.js (mới), public/index.html (`?v=` của hall.js)
- **Phụ thuộc**: T-020
- **Thợ**: Sonnet 5.5 (high) · **Soát**: Gemini Argon + Sol 6.1
- **Người làm**: Claude Sonnet 5.5 · **Nhánh**: `claude/T-031-ban-da-san-chua`
- **Thiết kế**: KH §5.2
- **Mục tiêu**: 4 bàn đá có ghế ở Sân chùa, chạm được, hiện trạng thái bàn.
- **Tiêu chí xong**:
  - [ ] Toạ độ theo KH §5.2, kiểm bằng ảnh rằng không đè vùng chạm thầy bói (vùng này tính theo toạ độ màn hình, đổi ra toạ độ sàn ở cả 3 cỡ màn). Chỉnh thì sửa cả KH §5.2 và `docs/KY-DAO-GIAO-THUC.md` trong cùng PR để T-030 khớp
  - [ ] Vật xếp theo chiều sâu như `ARENA_PROPS`; mặt bàn vẽ ô thu nhỏ theo môn; vẽ bằng mã, không cần ảnh
  - [ ] Biển "Bàn N · <môn> · <trạng thái>" không kết thúc bằng `' · NPC'`; `hall-npcs` vẫn đúng số nhãn NPC (3 ở chánh điện, sân, Tàng Kinh Các; 2 ở sân đấu); chạm NPC bí mật ở (0,32; 0,67) vẫn tới `secretNpc`
  - [ ] Chạm bàn/ghế gọi `handlers.table(i, seat)`; kiểm tra đặt **sau** NPC bí mật, **trước** thầy bói. `personAt` bỏ qua người đang ngồi bàn, nên chạm vào người đang đánh cờ là mở bàn (xem), không mở hộp người chơi
  - [ ] `Hall.setTables(list)` nhận danh sách bàn từ `kd:table` (ghế theo `pid`) và là nguồn duy nhất cho tư thế ngồi bàn; người chơi ở "bàn trong" có biểu tượng bàn cờ nhỏ trên đầu
  - [ ] Ảnh 3 cỡ màn; giảm chuyển động thì không nhấp nháy
- **Ngoài phạm vi**: socket, bảng bàn cờ.

### T-032 · Bảng bàn cờ: khung, đồng hồ, cờ vua, cờ tướng
- **Trạng thái**: ✅ Xong, đã merge vào main qua PR #41 (2026-11-12, CI xanh). Thợ: Claude Sonnet 5.5 (qua proxy). Soát: Opus 5.5 thay Argon/Sol, PASS vòng 2. Điều phối xem trang thử: cờ tướng (chữ Hán, sông, cung) và cờ vua 375×812 vừa màn, nút 44px, không lỗi console.
- **Ưu tiên**: P0 · **Đợt**: 2
- **Gói ngữ cảnh**: CORE + KYDAO
- **Khu vực chạm**: public/js/kydao-ui.js (mới), public/js/kydao-draw.js (mới), public/css/kydao.css (mới), tools/ui-harness/kydao/index.html (trang thử tối thiểu), public/img/NOTICE.txt (nếu dùng bộ quân cburnett)
- **Phụ thuộc**: T-020, T-021, T-022
- **Thợ**: Sonnet 5.5 (high) · **Soát**: Gemini Argon + Sol 6.1
- **Người làm**: Claude Sonnet 5.5 · **Nhánh**: `claude/T-032-bang-ban-co`
- **Thiết kế**: KH §5.9
- **Mục tiêu**: bảng bàn cờ dùng được trên điện thoại và máy bàn (chưa nối vào `index.html`; T-034 nối).
- **Tiêu chí xong**:
  - [ ] `KydaoUI.open/close/apply(event)`; `KydaoDraw` vẽ 8×8 và 9×10 (sông, cung), bên mình ở dưới
  - [ ] Chạm quân → chấm ô hợp lệ (từ module luật); tô nước cuối; tô Vua/Tướng bị chiếu; hộp phong cấp
  - [ ] Đồng hồ theo giờ máy chủ (`offset`); danh sách nước + `aria-live`; nút Xin hòa / Đầu hàng (hỏi lại) / Thu nhỏ; màn kết quả + "Đấu lại"
  - [ ] Công tắc "Chữ Việt" cho cờ tướng; quân cờ vua SVG cburnett (ghi NOTICE) hoặc vẽ bằng mã, không dùng ký tự ♔
  - [ ] 375×812 bàn cờ vừa màn, nút ≥ 44px; chữ qua `textContent` hoặc helper `h()` riêng của file (không có `h()` dùng chung); tiền tố CSS `kd-`
- **Ngoài phạm vi**: cờ vây, caro, cờ úp (T-033); nối socket (T-034).

### T-033 · Bảng bàn cờ: cờ vây, caro, cờ úp
- **Trạng thái**: 🟣 Chờ soát. Điều phối soát 13/11 (thợ gpt-6.1-sol): check sạch 158 file, npm test 857 đạt 0 trượt 3 bỏ qua. Đọc diff manager/registry: cờ úp chỉ phát view đã che, có test khẳng định payload không chứa quân úp, seed. Thử hai trình duyệt: bảng chọn luật đủ 5 môn; ván cờ vây 9×9 mở được, hai bên đi quân đồng bộ, đồng hồ và điểm tạm tính chạy. CHƯA đánh thử caro và cờ úp trên trình duyệt, chưa thử 375×812, chưa thử giai đoạn đánh dấu quân chết.
- **Ưu tiên**: P1 · **Đợt**: 3
- **Gói ngữ cảnh**: CORE + KYDAO
- **Khu vực chạm**: public/js/kydao-ui.js, public/js/kydao-draw.js, public/css/kydao.css
- **Phụ thuộc**: T-032, T-024, T-025, T-026
- **Thợ**: Sonnet 5.5 (high) · **Soát**: Gemini Argon + Sol 6.1
- **Người làm**: gpt-6.1-sol (Codex CLI qua proxy) · **Nhánh**: `codex/T-033-bang-co-vay-caro-up`
- **Thiết kế**: KH §5.4, §5.9
- **Mục tiêu**: đủ 5 môn trên bảng bàn cờ.
- **Tiêu chí xong**:
  - [x] Cờ vây 9/13/19 có điểm sao; giai đoạn đánh dấu (chạm nhóm, Đồng ý / Đánh tiếp, đếm ngược 3 phút, điểm tạm tính)
  - [x] Caro 15×15 X/O, tô 5 quân thắng
  - [x] Cờ úp: quân úp vẽ mặt lưng; lật có hiệu ứng ngắn (tắt khi giảm chuyển động)
  - [ ] 375×812: caro và vây 19×19 dùng được (phóng to/kéo nếu cần)
- **Ngoài phạm vi**: bot.
- **Ghi chú bàn giao**: Đã nối đủ năm môn vào chọn luật, lời mời, nhạc và bảng thật; vây 13/19 chỉ giao hữu. Mở rộng theo giao việc: registry/manager để bật jieqi, seed máy chủ và chuyển reveal/final; index nạp luật/cache; app chọn môn/cỡ và chuyển tiếp kd:marks (bắt buộc để tính điểm trong game); test và docs Kỳ Đạo. Test trực tiếp Node v25: 187 đạt, 0 trượt, 1 bỏ qua (perft sâu); node --check 9 file sạch. npm run check, node --test, npm test gặp spawn EPERM; E2E trực tiếp 1 đạt, 9 lỗi spawn EPERM. Test DOM giả + manager thật đã qua vây 19 đánh dấu/đánh tiếp/đồng ý, caro thắng, cờ úp lật/giảm chuyển động; quét gói tin jieqi 40 nước cho hai người chơi, vào lại và người xem. Chưa thử trình duyệt thật/ảnh 375×812, cần điều phối xác minh. Không add/commit/push theo chỉ dẫn sandbox cuối giao việc. Báo cáo BAN-GIAO-T-033.md không commit.

### T-034 · Nối bảng cờ vào chùa
- **Trạng thái**: 🟣 Chờ soát. Điều phối soát 13/11 (thợ gpt-6-astra): check sạch, npm test 841 đạt 0 trượt 3 bỏ qua. Thử trên trình duyệt 2D: chạm Bàn 3 ở Sân chùa thì ngồi được, hiện bảng chọn luật (cờ vua, cờ tướng; ba môn kia ghi sắp có). CHƯA thử ván hai người từ đầu tới cuối, chưa thử mời từ hộp người chơi, chưa thử chạm bàn trong 3D.
- **Ưu tiên**: P0 · **Đợt**: 4
- **Gói ngữ cảnh**: CORE + KYDAO + NAV
- **Khu vực chạm**: public/js/app.js (handler chạm bàn, `socket.on('kd:*')` → `Hall.setTables` và `KydaoUI`, hộp người chơi "Mời đánh cờ", chip "Đang đánh cờ"), public/index.html (`<script>` của `kydao/*.js`, `kydao-ui.js`, `kydao-draw.js`; `<link>` của `kydao.css`; hộp mời đánh cờ trong `#dlg-person`; `?v=`)
- **Phụ thuộc**: T-030, T-031, T-032
- **Thợ**: Sonnet 5.5 (high) · **Soát**: Gemini Argon + Sol 6.1
- **Người làm**: gpt-6-astra (Codex CLI qua proxy) · **Nhánh**: codex/T-034-noi-bang-co
- **Thiết kế**: KH §5.1
- **Mục tiêu**: người chơi đánh cờ được từ đầu tới cuối trong chùa thật.
- **Tiêu chí xong**:
  - [ ] Hai trình duyệt trên máy chủ thật: ngồi, chọn luật, sẵn sàng, đánh, kết quả, Đấu lại (đổi bên)
  - [ ] Mời từ hộp người chơi ở chánh điện → cả hai ra Sân chùa, ngồi bàn trống gần nhất; hết bàn → bàn trong
  - [ ] Chạm bàn đang đấu → xem trực tiếp; tải lại trang giữa ván → vào lại đúng ván
  - [ ] Khách khi bật Google: giao hữu được, xếp hạng thì mời đăng nhập (`code:'login'`)
  - [ ] Không lỗi console; ảnh 3 cỡ màn
- **Ngoài phạm vi**: danh hiệu trên bảng (T-042).
- **Ghi chú bàn giao**: Đã nối handler bàn dùng chung 2D/3D, chọn luật/sẵn sàng, lời mời, xem và phục hồi ván; nạp nét quân T-090 và nút Bàn 3D T-091, chỉ cho chọn cờ vua/cờ tướng. Test trực tiếp: 169 đạt, 0 trượt, 1 bỏ qua (perft sâu); trong đó test nối mới 16/16. `npm run check`, `node --test` và E2E bị sandbox chặn spawn EPERM; `node --check` hai file JS sạch. Điều phối kiểm hai trình duyệt/ảnh ba cỡ/WebGL, chạy lại bộ kiểm chuẩn và commit theo giao việc; thợ chưa add/commit. Báo cáo `BAN-GIAO-T-034.md` không commit; tiêu chí kiểm bằng trình duyệt còn để trống tới lúc điều phối xác minh.

### T-035 · Dựng ui-harness cho bàn cờ
- **Trạng thái**: ⏳ Chờ T-032, T-033
- **Ưu tiên**: P1 · **Đợt**: 4
- **Gói ngữ cảnh**: CORE + KYDAO + OPS
- **Khu vực chạm**: tools/ui-harness/kydao/* (mở rộng từ trang thử tối thiểu của T-032)
- **Phụ thuộc**: T-032, T-033 (kịch bản cờ úp lật và cờ vây đánh dấu cần giao diện của T-033)
- **Thợ**: Gemini Flash-Lite · **Soát**: Gemini Argon
- **Người làm**: — · **Nhánh**: —
- **Thiết kế**: KH §5.9, khuôn `tools/ui-harness/arena/`
- **Mục tiêu**: kiểm giao diện bàn cờ không cần máy chủ thật.
- **Tiêu chí xong**:
  - [ ] Máy chủ giả phát `kd:*` theo kịch bản: bắt đầu, đi, chiếu, phong cấp, hết giờ, kết quả, người xem, cờ úp lật, cờ vây đánh dấu
  - [ ] `ui-check.js` chụp 375/768/1280; lỗi console là trượt
  - [ ] README trong thư mục: cách chạy
- **Ngoài phạm vi**: thêm Playwright vào `package.json` (xem T-008).

### Epic DH · Danh hiệu, Bảng Vàng, màn đối đầu

### T-040 · Thống kê mùa và tính người giữ danh hiệu
- **Trạng thái**: ✅ Xong, đã merge vào main qua PR #46 (2026-11-12, CI xanh). Thợ: Claude Sonnet 5.5 thay Codex terra 6.1 (kênh Codex lại hết hạn mức). Soát: Opus 5.5 thay Sol, PASS vòng 2. 118 test liên quan đạt.
- **Ưu tiên**: P0 · **Đợt**: 2
- **Gói ngữ cảnh**: CORE + RANK + MARTIAL
- **Khu vực chạm**: lib/records.js (mới), lib/martial/service.js (`norm`: `season`, `name`; `recordResult` cộng điểm mùa; hàm `setName(uid, name)`), lib/account.js (gộp `season` trong `mergeMartialGuest`), test/records.test.js (mới), test/martial-service.test.js
- **Phụ thuộc**: T-020 (khung), T-029 (`account.js`), T-050 (`lunar.js` xuất được bằng `require`)
- **Thợ**: Codex terra 6.1 · **Soát**: Sol 6.1
- **Người làm**: Claude Sonnet 5.5 (thay Codex terra 6.1) · **Nhánh**: `claude/T-040-ky-luc-danh-hieu`
- **Thiết kế**: KH §6.1 → §6.3, D5
- **Mục tiêu**: hàm thuần biết ai đang giữ 14 danh hiệu.
- **Tiêu chí xong**:
  - [ ] `seasonKey(now)` theo tháng âm, giờ Việt Nam; test quanh 00:00 mùng 1, tháng nhuận
  - [ ] `holders(db, now)` đủ 14 danh hiệu theo bảng KH §6.1 (điều kiện, ngưỡng, hòa → ai đạt trước); ca "Thiên Hạ Vô Song"
  - [ ] `TITLES` (tên hiển thị) và `priority` ở một nơi
  - [ ] Hồ sơ cũ thiếu trường vẫn chạy (`norm`); điểm mùa reset lười khi sang mùa
  - [ ] `diff(prevHolders, nextHolders)` trả các thay đổi chủ danh hiệu (để T-041 ghi "Các đời" và phát ticker)
  - [ ] ≥ 20 ca test; 10.000 hồ sơ tính < 50 ms
- **Ngoài phạm vi**: phát qua socket, gọi `setName` từ máy chủ (T-041).

### T-041 · Phát danh hiệu từ máy chủ
- **Trạng thái**: ⏳ Chờ T-030, T-040
- **Ưu tiên**: P0 · **Đợt**: 4
- **Gói ngữ cảnh**: CORE + RANK
- **Khu vực chạm**: server.js (`addMeritUid` cộng `season`; `linkGuest` gộp `season` của công đức; lớp bọc `recordResult` gọi `setName` để hồ sơ võ học có tên; vòng 60 giây tính `holders`; ghi `db.records.log` khi đổi chủ hoặc hết mùa; `publicPlayer.tt`; sự kiện `ptt` và `titles`; ticker đổi chủ; `TITLES_ENABLED`; `/api/config.titles`), test/e2e-titles.test.js (mới), test/e2e-security.test.js (thêm ca)
- **Phụ thuộc**: T-030 (thứ tự `server.js`), T-040
- **Thợ**: Sonnet 5.5 (high) · **Soát**: Sol 6.1
- **Người làm**: — · **Nhánh**: —
- **Thiết kế**: KH §6.3
- **Mục tiêu**: máy chủ biết và báo ai giữ danh hiệu, không lộ uid.
- **Tiêu chí xong**:
  - [ ] e2e: cộng công đức cho người thứ hai vượt người thứ nhất → `ptt` đổi đúng, `titles` đổi đúng, `db.records.log` có dòng mới (có `id`)
  - [ ] Hết mùa (giả lập giờ): người giữ "hiện tại" của mùa cũ được ghi vào `db.records.log`, rồi tính lại
  - [ ] Gộp khách → tài khoản giữ đúng `season` của công đức (test)
  - [ ] `e2e-security`: không gói `ptt`/`titles`/`kd:*` nào chứa uid người khác
  - [ ] Ticker đổi chủ tối đa 1 / 5 phút / hạng mục; `TITLES_ENABLED=0` không phát gì
- **Ngoài phạm vi**: vẽ danh hiệu (T-042).

### T-042 · Hiện danh hiệu trên đầu, trong hộp người chơi và ở Sân đấu
- **Trạng thái**: ⏳ Chờ T-041, T-031, T-034, T-064
- **Ưu tiên**: P1 · **Đợt**: 5
- **Gói ngữ cảnh**: CORE + RANK + HALL
- **Khu vực chạm**: public/js/hall.js (`mk`, `Hall.setTitles`, viên danh hiệu ở mọi cảnh), public/js/app.js (`socket.on('ptt'|'titles')`, mục Danh hiệu trong hộp người chơi), public/index.html (`#dlg-person`, `?v=`), public/css/style.css, public/js/arena.js (danh sách người ở sân)
- **Phụ thuộc**: T-041; thứ tự file nóng: T-031 (`hall.js`), T-034 (`app.js`), T-064 (`arena.js`)
- **Thợ**: Sonnet 5.5 (high) · **Soát**: Gemini Argon + Sol 6.1
- **Người làm**: — · **Nhánh**: —
- **Thiết kế**: KH §6.1, §6.4
- **Mục tiêu**: người chơi thấy ai đang giữ danh hiệu.
- **Tiêu chí xong**:
  - [ ] Một viên danh hiệu trên tên theo thứ tự ưu tiên; màu lịch sử / hiện tại; Sân đấu vẫn có nhãn "Cấp N"
  - [ ] Hộp người chơi liệt kê đủ danh hiệu, mỗi cái 1 câu giải thích
  - [ ] `hall-npcs` xanh; ảnh 3 cỡ màn
- **Ngoài phạm vi**: Bảng Vàng (T-043).

### T-043 · Dựng Bia Bảng Vàng ở Sân chùa
- **Trạng thái**: ⏳ Chờ T-042
- **Ưu tiên**: P1 · **Đợt**: 6
- **Gói ngữ cảnh**: CORE + RANK + HALL
- **Khu vực chạm**: public/js/hall.js (bia, hit-test), server.js (`records:board` có `bucket('hof', 1, 3)`: người giữ + top 10 + Các đời, chỉ tên), public/js/app.js (mở hộp, thẻ Khám phá), public/index.html (`#dlg-hof`, `<link>`, `?v=`), public/css/hof.css (mới, tiền tố `hof-`), test/e2e-titles.test.js (thêm ca)
- **Phụ thuộc**: T-042
- **Thợ**: Sonnet 5.5 (high) · **Soát**: Gemini Argon + Sol 6.1
- **Người làm**: — · **Nhánh**: —
- **Thiết kế**: KH §6.4
- **Mục tiêu**: một nơi trong sân để xem bảng xếp hạng và người giữ danh hiệu.
- **Tiêu chí xong**:
  - [ ] Bia ở ≈ (0,5; 0,34), nhãn "BẢNG VÀNG · Chạm để xem"; không đè vùng chạm thầy bói/bàn cờ
  - [ ] 7 tab; mỗi tab: 2 thẻ người giữ, top 10 hiện tại, Các đời
  - [ ] Mở được từ bia và tab Khám phá; không có uid; 375×812 dùng được
- **Ngoài phạm vi**: thưởng cho người giữ danh hiệu.

### T-044 · Làm màn "Kẻ mạnh nhất lịch sử… đối đầu kẻ mạnh nhất hiện tại"
- **Trạng thái**: ⏳ Chờ T-041, T-030
- **Ưu tiên**: P1 · **Đợt**: 5
- **Gói ngữ cảnh**: CORE + RANK + PK + KYDAO
- **Khu vực chạm**: public/js/legend.js (mới), public/css/legend.css (mới, tiền tố `lg-`), public/index.html (`<script>`, `<link>`, công tắc trong thẻ "Hiệu ứng", `?v=`), public/js/app.js (`socket.on('legend:vs')`), server.js (gửi `legend:vs` + ticker), lib/pk/manager.js (hook `deps.onMatchStart`), lib/kydao/manager.js (hook `onGameStart`), test/legend.test.js (mới), public/img/NOTICE.txt
- **Phụ thuộc**: T-041, T-030
- **Thợ**: Sonnet 5.5 (high) · **Soát**: Gemini Argon + Sol 6.1
- **Người làm**: — · **Nhánh**: —
- **Thiết kế**: KH §6.5, D13
- **Mục tiêu**: khi người giữ "lịch sử" và người giữ "hiện tại" của cùng hạng mục gặp nhau (PK hoặc cùng môn cờ), cả hai và người xem thấy màn đối đầu kiểu truyện tranh.
- **Tiêu chí xong**:
  - [ ] Điều kiện đúng (test): cùng một người giữ cả hai → không hiện; khác hạng mục → không hiện; PK kích ở `pk:lobby`, cờ kích ở `kd:start`
  - [ ] Gửi cho 2 người chơi + người xem; ticker toàn chùa tối đa 1 / 30 phút / cặp; không có uid
  - [ ] Hình vẽ bằng mã từ chính nhân vật hai người; hai nhịp khung chữ "KẺ MẠNH NHẤT LỊCH SỬ…" / "…ĐỐI ĐẦU KẺ MẠNH NHẤT HIỆN TẠI."; không dùng ảnh ngoài
  - [ ] 4,5 giây, chạm bỏ qua sau 0,9 giây; giảm chuyển động: ảnh tĩnh 3 giây; công tắc tắt (`ta-legend`)
  - [ ] Không làm trễ đồng hồ sảnh PK / đồng hồ cờ (màn chạy song song, không chặn thao tác)
  - [ ] Argon xác nhận hình không giống tranh gốc; NOTICE ghi "vẽ bằng mã"
- **Ngoài phạm vi**: thêm âm thanh từ file ngoài.

### Epic BT · Bói toán

### T-050 · Viết lại lịch âm (UTC+8 trước 1968, can chi đủ)
- **Trạng thái**: ✅ Xong, đã merge vào main qua PR #37 (2026-11-12, CI xanh). Thợ: Codex terra 6.1 (gpt-6.1-terra), sửa vòng 1 bằng Claude Sonnet 5.5. Soát: Sol 6.1 (vòng 1), Opus 5.5 thay Sol/Argon (vòng 2) PASS. Điều phối kiểm tay: 10/2/1995 → 11/1/1995, Tết 1968 → 29/1, 28/1/1903 → 30/12/1902 (UTC+8). Còn mở 👤: có đổi 1900–1928 sang giờ Bắc Kinh không (ghi đầu lunar.js).
- **Ưu tiên**: P0 · **Đợt**: 1
- **Gói ngữ cảnh**: CORE + FORTUNE
- **Khu vực chạm**: public/js/lunar.js, test/lunar.test.js (mới), public/index.html (thêm `?v=` cho `lunar.js`)
- **Phụ thuộc**: T-004; D12 (mặc định: viết lại độc lập)
- **Thợ**: Codex terra 6.1 · **Soát**: Sol 6.1 + Gemini Argon (mốc múi giờ, bảng Tết)
- **Người làm**: Codex terra 6.1 + Claude Sonnet 5.5 · **Nhánh**: `claude/T-050-lich-am`
- **Thiết kế**: KH §7.3 "Lịch âm", §2.3
- **Mục tiêu**: lịch âm đúng mọi năm 1900–2100 và đủ hàm cho tử vi, mùa, lễ hội.
- **Tiêu chí xong**:
  - [ ] Viết độc lập, không chép mã Hồ Ngọc Đức; đầu file ghi nguồn công thức (Meeus)
  - [ ] Giữ `Lunar.toLunar`, `Lunar.describe`; thêm `toSolar`, can chi ngày/tháng/giờ, nạp âm, tiết khí
  - [ ] UMD thật: ở Node `require('./public/js/lunar.js')` trả thẳng API (`module.exports = api`), trình duyệt vẫn có `window.Lunar` (hiện tại Node nhận `{ Lunar }` qua `this`)
  - [ ] Múi giờ 8 trước 1968, 7 từ 1968 (Argon xác nhận mốc bằng nguồn)
  - [ ] Test: Tết 1900–2100 so bảng có nguồn; 4 ngày lệch trước 1968 ở KH §2.3; tháng nhuận 2017–2033; khứ hồi âm ↔ dương mọi ngày 1900–2100
  - [ ] Đầu trang vẫn hiện "Mùng X tháng Y năm …" đúng
- **Ngoài phạm vi**: tử vi.

### T-051 · Máy chủ: rút tarot theo hạt giống, giới hạn xin xăm
- **Trạng thái**: ✅ Xong, đã merge vào main qua PR #28 (2026-11-12, CI xanh). Thợ: Claude Sonnet 5.5 (đúng vai trong kế hoạch). Soát: Sol 6.1 (gpt-6.1-sol) NEEDS_FIX vòng 1 (2 lỗi), PASS vòng 2.
- **Ưu tiên**: P0 · **Đợt**: 1
- **Gói ngữ cảnh**: CORE + FORTUNE
- **Khu vực chạm**: server.js (handler `tarot:draw`, `bucket` cho `fortune:join`/`fortune:leave`), lib/fortune-queue.js (`crypto.randomInt`), test/e2e-fortune.test.js (mới), test/fortune-queue.test.js (mới), test/e2e-scene.test.js (chỉ khi phải chỉnh), docs/agents/ARCHITECTURE.md (§4, chỉ thêm dòng `tarot:draw`)
- **Phụ thuộc**: không
- **Thợ**: Sonnet 5.5 (high) · **Soát**: Sol 6.1
- **Người làm**: Claude Sonnet 5.5 · **Nhánh**: `claude/T-051-tarot-may-chu`
- **Thiết kế**: KH §7.1, §7.2 "Rút bài ở máy chủ", D10
- **Mục tiêu**: tarot rút ở máy chủ, ổn định trong ngày; xin xăm không bị spam.
- **Tiêu chí xong**:
  - [ ] `tarot:draw` kiểm `topic` (8 mã, `love` có `status`), `span` ∈ {7, 30, 90}; trả 5 lá khác nhau + `rev`
  - [ ] Cùng uid / ngày / topic / span → cùng kết quả, lần 2 có `again:true`; khác ngày → khác (hàm hạt giống tách riêng để test)
  - [ ] `bucket('tarot', 0.2, 3)`; `fortune:join/leave` có `bucket('fortune', 0.5, 4)` đặt **sau** kiểm tra cảnh, không phát `fortune:queue` khi bị chặn
  - [ ] `test/e2e-scene.test.js` vẫn xanh (test này gọi `fortune:join` 4 lần trong khoảng 1 giây, lần cuối phải `ok:true`); spam 20 lần/giây thì bị chặn
  - [ ] Xăm dùng `crypto.randomInt`; không cộng công đức
- **Ngoài phạm vi**: giao diện (T-053).

### T-052 · Viết nội dung 78 lá tarot theo 8 chủ đề
- **Trạng thái**: ✅ Xong, đã merge vào main qua PR #40 (2026-11-12, CI xanh). Thợ: Claude Sonnet 5.5 thay Gemini Flash (kênh Antigravity hết hạn mức). Soát: Opus 5.5 thay Argon/Sol; sau 2 vòng còn câu Ẩn phụ ghép khuôn gây sợ → giao viết lại riêng 99 câu cho các lá nặng.
- **Ưu tiên**: P1 · **Đợt**: 1
- **Gói ngữ cảnh**: CORE + FORTUNE
- **Khu vực chạm**: public/data/tarot.vi.json (mới), public/data/NOTICE.txt (mới), test/tarot-data.test.js (mới), AGENTS.md (§3.14: thêm `public/data/NOTICE.txt` vào danh sách nơi ghi nguồn, một dòng)
- **Phụ thuộc**: không
- **Thợ**: Gemini Flash · **Soát**: Gemini Argon (nội dung) + Sol 6.1 (định dạng, an toàn)
- **Người làm**: Claude Sonnet 5.5 (thay Gemini Flash) · **Nhánh**: `claude/T-052-noi-dung-tarot`
- **Thiết kế**: KH §7.2 "Nội dung"
- **Mục tiêu**: nội dung tiếng Việt đầy đủ, đúng tinh thần tarot truyền thống, viết mới.
- **Tiêu chí xong**:
  - [ ] Đúng khung JSON ở KH §7.2; 78 lá đủ mọi trường; `id` theo quy ước KH §7.2 (0–21 Ẩn chính, rồi Gậy, Cốc, Kiếm, Tiền); tên Việt theo bảng KH §7.2
  - [ ] Test: đủ trường, không câu trùng, độ dài 20–260 ký tự, không HTML, không chuỗi rỗng
  - [ ] Argon đối chiếu 22 lá Ẩn chính + 8 lá ngẫu nhiên với Waite (1910) và 1 nguồn khác, ghi nhận xét vào PR
  - [ ] Không chép câu từ web; Cái Chết, Tòa Tháp, Ác Quỷ viết không gây sợ; chủ đề sức khỏe/tiền bạc có câu nhắc giới hạn
  - [ ] NOTICE ghi nguồn ý nghĩa (Waite 1910, phạm vi công cộng)
- **Ngoài phạm vi**: ảnh lá bài.

### T-053 · Làm giao diện tarot theo chủ đề
- **Trạng thái**: ✅ Xong, đã merge vào main qua PR #45 (2026-11-12, CI xanh). Thợ: Claude Sonnet 5.5 (qua proxy). Soát: Opus 5.5 thay Argon, Sol 6.1. Điều phối chạy thật: chọn chủ đề → tình trạng → khung → 5 lá chữ thập + Lời thầy, không lỗi console.
- **Ưu tiên**: P1 · **Đợt**: 2
- **Gói ngữ cảnh**: CORE + FORTUNE
- **Khu vực chạm**: public/js/tarot.js (mới, global `Tarot`), public/js/fortune.js (bỏ khối tarot cũ, gọi `Tarot`), public/index.html (khối tarot trong `#dlg-fortune`, `<script>`, `?v=`), public/css/style.css (khối `.tarot-*`)
- **Phụ thuộc**: T-051, T-052, T-010 (cùng sửa `fortune.js`)
- **Thợ**: Sonnet 5.5 (high) · **Soát**: Gemini Argon + Sol 6.1
- **Người làm**: Claude Sonnet 5.5 · **Nhánh**: `claude/T-053-giao-dien-tarot`
- **Thiết kế**: KH §7.2, D10
- **Mục tiêu**: chọn chủ đề → chọn khung → trải 5 lá → lời thầy tổng hợp, không cần gõ chữ.
- **Tiêu chí xong**:
  - [ ] 4 bước KH §7.2; không còn ô gõ câu hỏi; "Tình duyên" hỏi thêm Đang một mình / Đang có đôi
  - [ ] 5 lá hình chữ thập; lá Lời khuyên nổi bật; lật lần lượt, chạm để lật nhanh
  - [ ] Hàm tổng hợp thuần (test riêng) theo đủ luật KH §7.2
  - [ ] `again` hiện đúng câu; nạp `tarot.vi.json` khi mở hộp lần đầu
  - [ ] Sửa luôn đếm ngược hàng chờ xin xăm trong `fortune.js`: dùng giờ máy chủ (`offset`), dừng `setInterval` khi đóng hộp
  - [ ] 375×812 lá xếp dọc dùng được; giảm chuyển động; tuyên bố tham khảo
- **Ngoài phạm vi**: ảnh lá bài.

### T-054 · Viết bộ máy an sao Tử Vi
- **Trạng thái**: ✅ Xong, đã merge vào main qua PR #48 (2026-11-12, CI xanh). Thợ: Claude Sonnet 5.5 thay Codex terra 6.1 (kênh Codex hết hạn mức giữa chừng). Soát: Opus 5.5 thay Sol/Argon, PASS vòng 2. Điều phối kiểm tay: 10/2/1995 giờ Tý nam → Mệnh Dần, Mậu Dần Thành Đầu Thổ, Thổ ngũ cục; 4 ms/lá số. Phần so 12 lá số mẫu tự bỏ qua tới khi T-055 có fixture.
- **Ưu tiên**: P0 · **Đợt**: 2
- **Gói ngữ cảnh**: CORE + FORTUNE
- **Khu vực chạm**: public/js/tuvi.js (mới, UMD `TUVI`), test/tuvi.test.js (mới), tools/tuvi-crosscheck/ (mới, chỉ dùng khi phát triển, không thêm vào `package.json`)
- **Phụ thuộc**: T-050; bảng và lá số mẫu từ T-055 (gộp test khi T-055 xong)
- **Thợ**: Codex terra 6.1 · **Soát**: Sol 6.1 + Gemini Argon
- **Người làm**: Claude Sonnet 5.5 (thay Codex terra 6.1) · **Nhánh**: `claude/T-054-may-an-sao`
- **Thiết kế**: KH §7.3, Phụ lục B, D11, `docs/TU-VI-QUY-UOC.md`
- **Mục tiêu**: lập lá số Tử Vi Đẩu Số đúng trường phái Việt, tính trên trình duyệt.
- **Tiêu chí xong**:
  - [ ] `TUVI.chart({ date:{ solar | lunar, leap }, hour | null, gender, viewYear, options })` trả JSON: 12 cung (can chi, sao, độ sáng), Mệnh, Thân, Cục, bản mệnh, đại vận, tiểu vận, lưu niên
  - [ ] Đủ công thức Phụ lục B và bảng của T-055
  - [ ] Test bất biến KH §7.3; bảng an Tử Vi 5 Cục × 30 ngày; 12 lá số mẫu khớp 100% phần chính
  - [ ] Không giờ sinh → bỏ phần cần giờ, trả cờ `noHour`
  - [ ] Dùng đúng mã sao / mã cung ở KH Phụ lục B "Mã dữ liệu" (T-056 viết nội dung theo các mã này)
  - [ ] `tools/tuvi-crosscheck/` so với `iztro` bằng **ngày âm + giờ** (không đưa ngày dương, vì `iztro` đổi lịch theo UTC+8 của Trung Quốc); danh sách khác biệt có chủ đích ghi trong `docs/TU-VI-QUY-UOC.md`
  - [ ] < 10 ms một lá số
- **Ngoài phạm vi**: luận giải, giao diện.

### T-055 · Đối chiếu bảng tử vi và lập lá số mẫu
- **Trạng thái**: ✅ Xong, đã merge vào main qua PR #52 (2026-11-12, CI xanh). Thợ: GLM Flash 2 vòng chưa đạt → Claude Sonnet 5.5 làm lại. Có bảng độ sáng 14×12, quy ước trường phái, 12 lá số mẫu từ iztro (ngày âm + giờ); test của T-054 so 12 mẫu: đạt. Còn 👤: đối chiếu 12 lá số với 2 công cụ tử vi Việt.
- **Ưu tiên**: P0 · **Đợt**: 1
- **Gói ngữ cảnh**: CORE + FORTUNE + DOCS
- **Khu vực chạm**: docs/TU-VI-QUY-UOC.md (mới), test/fixtures/tuvi-golden.json (mới)
- **Phụ thuộc**: không
- **Thợ**: GLM Flash (+ 👤 chủ dự án hoặc người được nhờ lập 12 lá số từ 2 công cụ tử vi Việt) · **Soát**: Gemini Argon
- **Người làm**: GLM Flash + Claude Sonnet 5.5 · **Nhánh**: `claude/T-055-tu-vi-quy-uoc`
- **Thiết kế**: KH §7.3 "Kiểm chứng", Phụ lục B
- **Mục tiêu**: có "đáp án" để kiểm bộ máy an sao.
- **Tiêu chí xong**:
  - [ ] Mọi bảng ở Phụ lục B đối chiếu ≥ 2 nguồn (Việt + Trung), ghi chỗ khác trường phái và lựa chọn của game
  - [ ] Thêm bảng: độ sáng 14 chính tinh × 12 cung, nạp âm 60 hoa giáp, chủ mệnh, chủ thân, Thiên Hình, Thiên Diêu
  - [ ] 12 lá số mẫu đa dạng (nam/nữ, âm/dương, đủ 5 Cục, tháng nhuận, giờ Tý 23h, trước 1968): ngày giờ đầu vào + vị trí 14 chính tinh, Mệnh, Thân, Cục, Tứ Hóa; ghi công cụ đã dùng
  - [ ] Lá số trước 1968: chọn ngày **không** nằm trong 927 ngày lệch giữa UTC+7 và UTC+8 (phần lớn công cụ Việt dùng UTC+7 cho mọi năm), hoặc ghi rõ lá số đó theo quy ước nào
  - [ ] Ghi các điểm khác trường phái cần chủ dự án biết: Tứ Hóa can Canh, Khoa của can Nhâm (Tả Phù hay Thiên Phủ), Hỏa/Linh, tuổi tính đại vận (tuổi âm/tuổi mụ)
- **Ngoài phạm vi**: mã.

### T-056 · Viết nội dung luận giải tử vi
- **Trạng thái**: ✅ Xong, đã merge vào main qua PR #44 (2026-11-12, CI xanh). Thợ: Claude Sonnet 5.5 thay Gemini Flash (kênh Antigravity hết hạn mức). Soát: Opus 5.5 thay Gemini Argon, PASS sau sửa.
- **Ưu tiên**: P1 · **Đợt**: 2
- **Gói ngữ cảnh**: CORE + FORTUNE
- **Khu vực chạm**: public/data/tuvi.vi.json (mới), public/data/NOTICE.txt, test/tuvi-data.test.js (mới)
- **Phụ thuộc**: khóa dữ liệu (tên sao, mã cung) theo Phụ lục B; khớp lại khi T-054 xong
- **Thợ**: Gemini Flash · **Soát**: Gemini Argon
- **Người làm**: Claude Sonnet 5.5 (thay Gemini Flash) · **Nhánh**: `claude/T-056-noi-dung-tu-vi`
- **Thiết kế**: KH §7.3 "Đầu ra"
- **Mục tiêu**: lời luận giải tiếng Việt cho lá số, giọng hiền, viết mới.
- **Tiêu chí xong**:
  - [ ] Đủ khung: 14 chính tinh × 12 cung × 2 nhóm sáng; ~25 phụ tinh; ~40 cách cục; Tứ Hóa × 12 cung; Tuần/Triệt; đại vận; lưu niên; sinh khắc Bản mệnh–Cục
  - [ ] Test đủ khóa, không trùng câu, độ dài hợp lý, không HTML
  - [ ] Không phán chết chóc, bệnh nặng, tai nạn; không chép sách còn bản quyền
- **Ngoài phạm vi**: giao diện.

### T-057 · Làm giao diện lá số tử vi
- **Trạng thái**: ⏳ Chờ T-054, T-056, T-053
- **Ưu tiên**: P1 · **Đợt**: 3
- **Gói ngữ cảnh**: CORE + FORTUNE
- **Khu vực chạm**: public/js/tuvi-ui.js (mới), public/js/fortune.js (khối tử vi), public/index.html (khối tử vi trong `#dlg-fortune`, `<script>`, `<link>`, `?v=`), public/css/tuvi.css (mới, tiền tố `tv-`)
- **Phụ thuộc**: T-054, T-056, T-053 (cùng sửa `fortune.js` và `#dlg-fortune`)
- **Thợ**: Sonnet 5.5 (high) · **Soát**: Gemini Argon + Sol 6.1
- **Người làm**: — · **Nhánh**: —
- **Thiết kế**: KH §7.3, D11
- **Mục tiêu**: người chơi lập và đọc được lá số ngay trong chùa.
- **Tiêu chí xong**:
  - [ ] Form đủ trường KH §7.3 (dương/âm, nhuận, 12 canh giờ có khoảng giờ, Không nhớ giờ, giới tính, năm xem, Nâng cao)
  - [ ] Máy bàn: lưới 4 × 4; điện thoại: ô thông tin + danh sách 12 cung + sơ đồ thu nhỏ
  - [ ] Chạm cung đọc luận; đại vận hiện tại; năm xem; "3 tháng tới theo tuổi" giữ lại và thêm lục hợp/hình/hại/phá
  - [ ] Sol xác nhận: không socket/fetch nào mang ngày giờ sinh; "Nhớ trên máy này" mặc định tắt
  - [ ] Tuyên bố tham khảo
- **Ngoài phạm vi**: in / chia sẻ lá số.

### Epic HD · Hướng dẫn cho người mới

### T-060 · Viết quy tắc chữ, bảng thuật ngữ và danh sách bí mật
- **Trạng thái**: ✅ Xong, đã merge vào main qua PR #29 (2026-11-12, CI xanh). Thợ: Claude Sonnet 5.5 (làm trước khi chuyển sang proxy; sửa bằng Sonnet vì kênh Gemini đang hết hạn mức). Soát: Opus 5.5 thay Gemini Argon (kênh Antigravity hết hạn mức), PASS vòng 3.
- **Ưu tiên**: P0 · **Đợt**: 1
- **Gói ngữ cảnh**: CORE + GUIDE + DOCS
- **Khu vực chạm**: docs/HUONG-DAN-VIET.md (mới)
- **Phụ thuộc**: không
- **Thợ**: Gemini Flash · **Soát**: Gemini Argon (+ Điều phối đọc duyệt)
- **Người làm**: Claude Sonnet 5.5 (thay Gemini Flash) · **Nhánh**: `claude/T-060-quy-tac-chu`
- **Thiết kế**: KH §8.2, §8.3, §8.5, §2.1
- **Mục tiêu**: luật viết chung cho mọi thẻ chữ.
- **Tiêu chí xong**:
  - [ ] Quy tắc ≤ 2 trang, mỗi quy tắc có ví dụ đúng / sai lấy từ chữ thật trong game
  - [ ] Bảng thuật ngữ đủ mọi từ ở KH §8.3 và mọi từ "chưa giải thích" trong KH §2.1
  - [ ] Bảng bí mật KH §8.5 và cách nhắc khéo ("giang hồ còn nhiều cơ duyên chưa kể")
  - [ ] Danh sách "chữ đang sai với mã" (KH §2.1 mục 12) để T-063/T-064/T-065 sửa
- **Ngoài phạm vi**: sửa mã.

### T-061 · Làm Sổ tay trong game (nút "?")
- **Trạng thái**: ✅ Xong, đã merge vào main qua PR #50 (2026-11-12, CI xanh). Thợ: Claude Sonnet 5.5 (dựng + viết nội dung thay Gemini Flash). Soát: Sol PASS; Opus 5.5 thay Argon còn 2 câu sai với mã sau 2 vòng → giao sửa. Điều phối chạy thật: nút '?' mở Sổ tay 10 mục, không lỗi console.
- **Ưu tiên**: P1 · **Đợt**: 2
- **Gói ngữ cảnh**: CORE + GUIDE + NAV
- **Khu vực chạm**: public/js/guide.js (mới, global `Guide`), public/data/so-tay.vi.json (mới), public/css/guide.css (mới, tiền tố `gd-`), public/index.html (nút "?" ở `header.top`, `#dlg-guide`, `<script>`, `<link>`, `?v=`), public/js/app.js (vùng thanh trên: gắn nút), public/js/martial.js (chỉ thêm `IDLE_FORFEIT_TURNS` vào `MARTIAL.PK`), test/sync-constants.test.js (ca `IDLE_FORFEIT_TURNS` khớp `lib/pk/rules.js`)
- **Phụ thuộc**: T-060, T-011
- **Thợ**: Sonnet 5.5 (high) dựng + Gemini Flash viết `so-tay.vi.json` · **Soát**: Gemini Argon + Sol 6.1
- **Người làm**: Claude Sonnet 5.5 · **Nhánh**: `claude/T-061-so-tay`
- **Thiết kế**: KH §8.4, D15
- **Mục tiêu**: một chỗ đọc đủ mọi cơ chế, viết cho người mới.
- **Tiêu chí xong**:
  - [ ] 13 mục KH §8.4; mục của tính năng đang tắt hoặc chưa có thì ẩn
  - [ ] Số liệu viết bằng chỗ giữ chỗ, ví dụ `{EARN.incense}`, `{PK.TURN_SECONDS}`, `{PK.IDLE_FORFEIT_TURNS}`, thay bằng giá trị từ `MERIT.EARN`, `MARTIAL.PK`, `/api/config` lúc hiện; test: **mọi** chỗ giữ chỗ đều thay được
  - [ ] Thêm `IDLE_FORFEIT_TURNS: 3` vào `MARTIAL.PK` và ca kiểm khớp `lib/pk/rules.js` trong `test/sync-constants.test.js`
  - [ ] Dựng bằng helper `h()` riêng trong `guide.js` (`h()` của `dojo.js`/`arena.js` là hàm cục bộ, không dùng chung được); không `innerHTML` với dữ liệu; 375×812 dùng được
  - [ ] Không lộ bí mật ở KH §8.5
- **Ngoài phạm vi**: gợi ý lần đầu (T-062).

### T-062 · Thêm gợi ý lần đầu, sửa nhãn tên đè nhau
- **Trạng thái**: ⏳ Chờ T-061, T-043
- **Ưu tiên**: P1 · **Đợt**: 6
- **Gói ngữ cảnh**: CORE + GUIDE + HALL
- **Khu vực chạm**: public/js/guide.js (gợi ý), public/js/hall.js (dời nhãn khi chồng; 2 câu NPC nếu chủ dự án đồng ý bỏ), public/js/app.js (gọi gợi ý khi vào map / nơi), public/css/guide.css, public/index.html (`?v=`)
- **Phụ thuộc**: T-061; thứ tự `hall.js`: sau T-043
- **Thợ**: Sonnet 5.5 (high) · **Soát**: Gemini Argon
- **Người làm**: — · **Nhánh**: —
- **Thiết kế**: KH §8.6
- **Mục tiêu**: người mới được chỉ đúng việc, đúng chỗ, một lần.
- **Tiêu chí xong**:
  - [ ] Đủ gợi ý ở bảng KH §8.6, mỗi cái hiện một lần (`ta-tips`), tắt hết được trong Sổ tay
  - [ ] Nhãn tên không chồng nhau (ảnh: 5 người + 3 NPC đứng sát nhau)
  - [ ] `hall-npcs` xanh (vẫn đúng số nhãn `' · NPC'`: 3 ở chánh điện, sân, Tàng Kinh Các; 2 ở sân đấu)
- **Ngoài phạm vi**: viết lại chữ các màn.

### T-063 · Viết lại chữ Võ Học Các
- **Trạng thái**: 🟣 Chờ soát
- **Ưu tiên**: P1 · **Đợt**: 3
- **Gói ngữ cảnh**: CORE + GUIDE + MARTIAL
- **Khu vực chạm**: docs/copy/VO-HOC-CAC.md (mới, bảng chữ cũ → mới), public/js/dojo.js (chỉ chuỗi chữ + mở sẵn "Luật tu luyện" lần đầu), public/js/martial.js (chỉ chuỗi mô tả), public/index.html (`?v=`), docs/VO-HOC.md
- **Phụ thuộc**: T-060; T-061 (thứ tự `martial.js`)
- **Thợ**: Gemini Flash soạn bảng → Sonnet 5.5 áp vào mã · **Soát**: Gemini Argon (+ Sol kiểm diff chỉ là chuỗi)
- **Người làm**: Gemini 3 Flash (soạn) + Claude Sonnet 5.5 (áp) · **Nhánh**: gemini/T-063-chu-vo-hoc-cac
- **Thiết kế**: KH §8.7
- **Mục tiêu**: người mới hiểu Võ Học Các mà không cần đọc docs.
- **Tiêu chí xong**:
  - [ ] Đủ mục KH §8.7 cho Võ Học Các; dùng đúng bảng thuật ngữ (nhãn "Danh hiệu PK" đổi thành "Bậc chiến tích" để không lẫn với danh hiệu lịch sử / hiện tại)
  - [ ] Không đổi số liệu hay logic (diff chỉ là chuỗi + 1 cờ mở sẵn)
  - [ ] `martial-data`, `martial-service` xanh; ui-harness dojo chạy được
- **Ngoài phạm vi**: cân bằng số liệu.
- **Ghi chú**: Chỉ sửa `dojo.js` + `?v=` (không có chuỗi mô tả nào ở `martial.js` cần đổi). Bỏ dòng 5 của bảng Flash (`(chưa có)` không tồn tại trong mã); dòng 9 dùng `M.STARTERS.length`, dòng 10 giữ `M.PK.LOADOUT_SECONDS`; cờ mở sẵn là `ta-dojo-rules-seen`.

### T-064 · Viết lại chữ Sân đấu
- **Trạng thái**: 🟣 Chờ soát
- **Ưu tiên**: P1 · **Đợt**: 4
- **Gói ngữ cảnh**: CORE + GUIDE + PK
- **Khu vực chạm**: docs/copy/SAN-DAU.md (mới), public/js/arena.js (chuỗi, dải "Luật nhanh", `endInfo` thêm `escape`, `MODES`), public/index.html (`?v=`)
- **Phụ thuộc**: T-012, T-060, T-061 (`MARTIAL.PK.IDLE_FORFEIT_TURNS`)
- **Thợ**: Gemini Flash soạn → Sonnet 5.5 áp · **Soát**: Gemini Argon
- **Người làm**: Gemini 3.8 Flash (soạn) + Claude Sonnet 5.5 (áp) · **Nhánh**: gemini/T-064-chu-san-dau
- **Thiết kế**: KH §8.7
- **Mục tiêu**: luật một trận hiện rõ ngay trên màn đấu.
- **Tiêu chí xong**:
  - [ ] Dải "Luật nhanh" mở được ở màn chờ và màn đấu; giải thích nộ, sơ hở, Kim Chung, tụ lực, Suy kiệt, 20 giây/lượt, bỏ 3 lượt thì thua, 40 lượt
  - [ ] Nhãn "Danh hiệu PK" trong danh sách người ở sân và màn kết quả đổi thành "Bậc chiến tích" (theo bảng thuật ngữ)
  - [ ] Kiểm `MODES.balanced` (mô tả nói buff có tác dụng, trong khi giao diện chỉ mở phòng buff): sửa câu cho khớp hành vi thật hoặc bỏ nếu không dùng
  - [ ] Hòa `escape` có lý do ("Trận kết thúc hòa.") mà không nói tên chiêu ẩn
  - [ ] Số lượt bỏ lỡ bị xử thua đọc từ `MARTIAL.PK.IDLE_FORFEIT_TURNS` (T-061 thêm), không gõ cứng
  - [ ] Fixture ui-harness arena tạo lại nếu cần; `ui-check.js` sạch
- **Ngoài phạm vi**: đổi luật PK.
- **Ghi chú**: đã áp docs/copy/SAN-DAU.md vào arena.js (bỏ qua dòng 1 của index.html; giữ `MODES.balanced`, chỉ sửa mô tả). Dải "Luật nhanh" là `quickRules()`, số liệu lấy từ `M.PK` và hằng số đầu file. Chưa chạy ui-harness arena (máy chưa cài Playwright). Đã tăng `?v=` của arena.js và arena.css.

### T-065 · Viết lại chữ chánh điện, công đức, cúng dường, tụng kinh
- **Trạng thái**: ⏳ Chờ T-060, T-011, T-061, T-044
- **Ưu tiên**: P1 · **Đợt**: 6
- **Gói ngữ cảnh**: CORE + GUIDE + RITUAL
- **Khu vực chạm**: docs/copy/CHANH-DIEN.md (mới), public/index.html (hộp luật công đức, thẻ "Hiệu ứng", hộp nhang / hoa / tụng / cúng dường, hộp hào quang), public/js/app.js (`SCENE_HINT`, `renderRank`, khối dựng luật, toast)
- **Phụ thuộc**: T-060, T-011, T-061 (vùng `index.html`), T-044 (cùng sửa thẻ "Hiệu ứng": T-044 thêm công tắc trước, T-065 viết lại chữ sau)
- **Thợ**: Gemini Flash soạn → Sonnet 5.5 áp · **Soát**: Gemini Argon
- **Người làm**: — · **Nhánh**: —
- **Thiết kế**: KH §8.5, §8.7
- **Mục tiêu**: chánh điện tự giải thích đủ cho người mới.
- **Tiêu chí xong**:
  - [ ] Bảng điểm trong "Luật công đức" lấy `E.heart`/`E.mo`/`E.rejoice` (không gõ cứng `1`); có cột thời gian chờ
  - [ ] Nói rõ thanh trên cùng là công đức **hôm nay**, pháp tướng tính theo **tổng**; mốc chúc mừng chỉ là hiệu ứng
  - [ ] Sửa 2 chỗ lộ bí mật (KH §8.5); `SCENE_HINT` viết lại cho 3 cảnh + Sân đấu
  - [ ] Đổi "cảnh giới hào quang" → "tầng" nếu chủ dự án đồng ý (câu hỏi phụ ở KH §1)
- **Ngoài phạm vi**: đổi luật công đức.

### T-066 · Chạy bài kiểm người mới
- **Trạng thái**: ⏳ Chờ T-067 (tức là sau mọi thẻ T-010 → T-065)
- **Ưu tiên**: P1 · **Đợt**: 6 (thẻ cuối cùng của đợt)
- **Gói ngữ cảnh**: CORE + GUIDE
- **Khu vực chạm**: docs/BAO-CAO-NGUOI-MOI.md (mới), docs/BAO-CAO-NGUOI-MOI-DAP-AN.md (mới, Argon viết trước khi kiểm), task.md (Hộp thư đến)
- **Phụ thuộc**: T-067
- **Thợ**: Gemini Flash-Lite (đóng vai người mới) · **Chấm**: Gemini Argon (viết đáp án từ mã **trước** khi Flash-Lite làm bài; Điều phối duyệt đáp án)
- **Người làm**: — · **Nhánh**: —
- **Thiết kế**: KH §8.8, Phụ lục D
- **Mục tiêu**: chứng minh người mới hiểu game chỉ nhờ giao diện.
- **Tiêu chí xong**:
  - [ ] Đầu vào chỉ là chữ và ảnh giao diện từng màn (không mã, không docs)
  - [ ] Trả lời 25 câu Phụ lục D; Argon chấm theo đáp án lấy từ mã
  - [ ] ≥ 23/25 đúng; mỗi câu sai → một thẻ ⚪ ở Hộp thư đến (chữ nào thiếu, ở màn nào)
- **Ngoài phạm vi**: tự sửa chữ.

### T-067 · Cập nhật README và tài liệu người chơi
- **Trạng thái**: ⏳ Chờ T-010 → T-065
- **Ưu tiên**: P2 · **Đợt**: 6
- **Gói ngữ cảnh**: CORE + DOCS
- **Khu vực chạm**: README.md (Tính năng, Các nơi, Cấu hình, Cấu trúc mã: phối hợp T-007), docs/VO-HOC.md, docs/agents/ARCHITECTURE.md (ngày cập nhật, sơ đồ)
- **Phụ thuộc**: T-010 → T-065 (không phụ thuộc T-066)
- **Thợ**: Gemini Flash-Lite · **Soát**: Gemini Argon
- **Người làm**: — · **Nhánh**: —
- **Mục tiêu**: tài liệu khớp với game sau đợt.
- **Tiêu chí xong**:
  - [ ] Mọi tính năng mới có dòng trong bảng Tính năng; biến `KYDAO_*`, `TITLES_ENABLED` trong Cấu hình
  - [ ] Không lộ bí mật mới (màn đối đầu)
- **Ngoài phạm vi**: viết lại các mục vận hành.

### Phát sinh trong đợt

### T-068 · Cho máy chủ thử tắt êm trên Windows để 3 test e2e hết trượt
- **Trạng thái**: ✅ Xong, đã merge vào main qua PR #43 (2026-11-12, CI xanh). Thợ: Claude Sonnet 5.5 (qua proxy). Soát: Sol 6.1 PASS. Sau khi gộp: npm test 588 test, 585 đạt, 0 trượt, 3 bỏ qua (PostgreSQL) trên Windows/Node v25.
- **Ưu tiên**: P0 · **Đợt**: 2
- **Gói ngữ cảnh**: CORE + STORE + OPS
- **Khu vực chạm**: test/helpers/live.js (`restart`/`stop`: gửi thông điệp IPC `'shutdown'` rồi chờ tiến trình tự thoát, chỉ `kill` khi quá hạn), server.js (khi chạy có kênh IPC, `process.on('message')` nhận `'shutdown'` thì gọi đúng hàm tắt của `SIGTERM`)
- **Phụ thuộc**: T-051 (thứ tự `server.js`)
- **Thợ**: Sonnet 5.5 (high) · **Soát**: Sol 6.1 (dự phòng Opus 5.5)
- **Người làm**: Claude Sonnet 5.5 · **Nhánh**: `claude/T-068-tat-em-windows`
- **Mục tiêu**: trên Windows, `child.kill('SIGTERM')` giết tiến trình ngay nên `store.flush` khi tắt không chạy. Vì vậy 3 test trượt cố định ở baseline: `e2e-auth` (dòng 98), `e2e-donation-test-mode` (dòng 52), `e2e-martial` (dòng 156). Sửa để `npm test` xanh cả trên Windows.
- **Tiêu chí xong**:
  - [ ] 3 test trên xanh trên Windows (Node v25 ở máy) và không làm hỏng CI Linux
  - [ ] `npm test` toàn bộ xanh, trừ 2 test PostgreSQL bỏ qua khi không có `TEST_DATABASE_URL`
  - [ ] Hành vi production không đổi: không có IPC thì không đăng ký lắng nghe; `SIGTERM` vẫn như cũ
  - [ ] Nếu một test vẫn đỏ vì lý do khác (không phải flush khi tắt): ghi rõ nguyên nhân, mở thẻ ⚪ mới, không sửa logic nghiệp vụ trong thẻ này
- **Ngoài phạm vi**: sửa logic tu luyện, cúng dường, đăng nhập.
- **Ghi chú**: phát hiện ở T-003 (2026-11-11). Soát T-003 thử hạ thời gian ghi JSON xuống 200 ms thì `e2e-donation-test-mode` xanh, hai test kia vẫn đỏ.

### T-069 · Mọi NPC đi lang thang, chạm NPC để trò chuyện, lớp nhân vật chung
- **Trạng thái**: ✅ Xong, merge vào main qua PR #57 (2026-11-12) theo yêu cầu của chủ dự án. Đã thử trên trình duyệt với NPC cơ duyên; chưa thử NPC thường trên trình duyệt và màn điện thoại.
- **Ưu tiên**: P1
- **Gói ngữ cảnh**: CORE + HALL + MARTIAL
- **Khu vực chạm**: public/js/actors.js (mới), public/js/hall.js (`randomizeNpcs`, `updateNpcs`, `personAt`/`npcAt`, `onDown`, `onMove`, `mk`, `setSweeper`, `Hall.npc`/`npcTalk`/`npcHold`), public/js/app.js (`openPerson`, `talkTo`, `finishTalk`, bỏ handler `sweeper`/`secretNpc`), server.js (`martial:secret-encounter`, `sweeper:claim`), public/index.html (nút Trò chuyện, `?v=`), test/actors.test.js, test/e2e-npc-wander.test.js, test/helpers/npc-chase.js (mới), test/hall-npcs.test.js, test/hall-tables.test.js, test/e2e-sweeper.test.js, docs/agents/ARCHITECTURE.md
- **Người làm**: Claude Opus 5.5 · **Nhánh**: `claude/npc-random-movement-interaction-528715`
- **Mục tiêu**: chủ dự án muốn mọi NPC (kể cả NPC cơ duyên và Tảo Địa Tăng) đi lang thang như nhau; chạm vào thân NPC mở hộp tương tác giống người chơi, chỉ có "Trò chuyện"; người chơi và NPC cùng kế thừa một lớp chung. NPC cơ duyên trò chuyện xong thì còn có bí kíp ẩn hoặc truyền công lực.
- **Cách làm**: `Actor` → `Player` / `Npc` → `FortuneNpc`. Mọi NPC đi theo `wanderAt(seed, area, t)` (chặng 18 giây: đứng rồi đi thẳng 0,08 đv/giây). NPC cơ duyên tính theo giờ máy chủ nên mọi máy cùng thấy, máy chủ tính lại vị trí (`distanceTo`, chừa 2 giây) trước khi cho nhận quà. Bỏ toạ độ cố định trong `server.js`. NPC xếp sau đồ vật khi chạm (bàn, bồ đoàn, kệ, thầy bói, bát hương, tượng, tủ kinh), trước chạm sàn; người chơi vẫn đứng đầu.
- **Tiêu chí xong**:
  - [x] `npm run check` sạch; `npm test` 720 test, 717 đạt, 0 trượt, 3 bỏ qua (PostgreSQL) trên Windows/Node v25
  - [x] NPC cơ duyên ở đúng chỗ máy chủ tính, có đổi chỗ theo thời gian; NPC thường đứng lại khi được bắt chuyện
  - [x] Máy chủ báo `far` kèm chỗ NPC đang đứng; đuổi kịp thì thôi báo `far` (e2e)
  - [ ] Chủ dự án thử trên trình duyệt: chạm NPC ở 4 cảnh, trò chuyện với NPC thường và NPC cơ duyên, màn điện thoại
- **Ngoài phạm vi**: đổi danh sách NPC, câu thoại, điều kiện nhận bí kíp; đồng bộ NPC thường giữa các máy (vẫn ngẫu nhiên riêng từng máy như trước).

---

## Đợt 3D · Đồ họa 3D, góc nhìn thứ nhất / thứ ba, quân cờ

Thiết kế và quy ước chung: [docs/KE-HOACH-3D.md](docs/KE-HOACH-3D.md) (đọc §1, §2 trước khi làm bất kỳ thẻ nào dưới đây). Thợ mặc định là các mô hình GPT qua CLIProxyAPI (§4 của tài liệu đó).

### T-080 · Dựng nền 3D (Three.js, khung World3D, trang thử)
- **Trạng thái**: 🟣 Chờ soát. Thợ không chạy được test trong hộp cát (spawn EPERM); Điều phối đã chạy lại: `npm run check` 132 file sạch, `node --test test/world3d-static.test.js test/hall-npcs.test.js` 6/6, trang thử hiện cảnh 3D, console không lỗi.
- **Ưu tiên**: P0
- **Gói ngữ cảnh**: CORE + HALL + OPS
- **Khu vực chạm**: package.json, package-lock.json, server.js (chỉ thêm 1 route tĩnh `/vendor/three`), tools/check.js (quét thêm `.mjs`), public/js/world3d/index.mjs (mới), public/world3d-test.html (mới, trang thử), public/data/NOTICE.txt, test/world3d-static.test.js (mới)
- **Phụ thuộc**: không
- **Thợ**: gpt-6.1-sol · **Soát**: Claude Sonnet 5.5
- **Người làm**: gpt-6.1-sol (Codex CLI qua proxy)
- **Nhánh**: codex/T-080-nen-3d
- **Mục tiêu**: Có Three.js chạy được không cần bundler và một khung `World3D` nạp lười, hiện một sàn + ánh sáng + khối thử trên trang thử. Game 2D không đổi gì.
- **Tiêu chí xong**:
  - [ ] `three` nằm trong `dependencies` (khóa đúng một phiên bản); máy chủ phục vụ `GET /vendor/three/three.module.min.js` (hoặc tên tệp build tương đương) từ `node_modules/three/build`, có cache; không lộ thư mục khác của `node_modules`
  - [ ] `public/js/world3d/index.mjs` xuất `start({ canvas, scene, getState, on, quality })`, `setScene`, `setView`, `setQuality`, `stop`; kiểm WebGL2, không có thì `start` trả `{ ok:false, reason }` chứ không ném lỗi; dừng vòng vẽ khi `document.hidden`; `stop()` giải phóng geometry, material, renderer
  - [ ] `tools/check.js` kiểm cả `.mjs`; `npm run check` sạch
  - [ ] Trang thử `public/world3d-test.html` (có `importmap` cho `three`) hiện cảnh thử khi mở `http://localhost:3000/world3d-test.html`
  - [ ] Test e2e: route trả 200 + `content-type` JavaScript, đường dẫn `..` bị từ chối; `npm test` không thêm ca trượt so với baseline
  - [ ] Ghi Three.js (MIT, phiên bản) vào `public/data/NOTICE.txt`
- **Ngoài phạm vi**: không sửa `index.html`, `hall.js`, `app.js`; chưa dựng cảnh chùa; chưa làm máy quay.
- **Ghi chú**: Đã có mã nền 3D và test trong worktree, chưa commit. `npm run check` bị `spawnSync EPERM`; `npm test`: 0 đạt, 53 file trượt ngay khi tạo tiến trình, không chạy được các ca bên trong nên chưa so baseline. Chạy `node --check` trực tiếp từ PowerShell: 132/132 file sạch. Cần môi trường cho phép Node tạo tiến trình con để tiếp tục kiểm tra và bàn giao Chờ soát. Báo cáo cục bộ: `BAN-GIAO-T-080.md` (không commit).

### T-081 · Toán máy quay góc nhìn thứ nhất / thứ ba (thuần, có test)
- **Trạng thái**: 🟣 Chờ soát. Thợ không chạy được test trong hộp cát (spawn EPERM); Điều phối đã chạy lại: `npm run check` sạch, `node --test test/view-math.test.js` 30/30, thử làm hỏng 2 chỗ (kẹp biên sàn, kẹp góc 70°) thì 2 ca đỏ. Lưu ý cho T-088: `pitch` dương ở góc thứ nhất là nhìn lên, ở góc thứ ba là máy quay lên cao; đổi góc nhìn nên đặt lại `pitch`.
- **Ưu tiên**: P0
- **Gói ngữ cảnh**: CORE + HALL
- **Khu vực chạm**: public/js/view-math.js (mới, UMD như `actors.js`), test/view-math.test.js (mới)
- **Phụ thuộc**: không
- **Thợ**: gpt-6.1-terra · **Soát**: gpt-6-sol
- **Người làm**: gpt-6.1-terra (Codex CLI qua proxy)
- **Nhánh**: codex/T-081-toan-may-quay
- **Ghi chú**: Đã viết module và 30 test; chạy trực tiếp đạt 30/30. Cần chạy lại `npm run check` và `node --test test/view-math.test.js` ngoài môi trường bị chặn trước khi chuyển chờ soát.
- **Mục tiêu**: Một module thuần, không phụ thuộc, chạy được trong Node, chứa mọi phép tính mà lớp 3D cần, để máy quay và điều khiển kiểm được bằng test.
- **Tiêu chí xong**:
  - [ ] `SCENE_SIZE` cho `hall`, `yard`, `library`, `arena` (mét); `toWorld(scene, x, z)` và `toFloor(scene, X, Z)` nghịch đảo nhau
  - [ ] `createView({ mode })`: trạng thái `mode ('first'|'third')`, `yaw`, `pitch`, `dist`; `rotate(dx, dy)`, `zoom(k)`, `setMode`; kẹp `pitch` (thứ nhất −60°..60°, thứ ba 5°..70°), `dist` 2..9 m
  - [ ] `cameraPose(view, target, bounds)` → `{ pos, look }`; ở góc thứ ba máy quay không ra ngoài tường (kẹp theo `bounds`) và không thấp hơn 0,3 m; góc thứ nhất đặt ở tầm mắt 1,55 m
  - [ ] `moveTarget(scene, x, z, yaw, fwd, strafe, step)` → điểm sàn `(x, z)` tiếp theo, đã kẹp theo biên mà `hall.js` `walkTo` đang dùng (0,03..0,97 và 0,12..0,97)
  - [ ] `smooth(cur, goal, dt, reduceMotion)`: nội suy mượt, `reduceMotion` thì nhảy thẳng
  - [ ] ≥ 15 ca test tên tiếng Việt, gồm ca biên; `node --test test/view-math.test.js` đạt; `npm run check` sạch
- **Ngoài phạm vi**: không import Three.js, không đụng DOM, không sửa file có sẵn.

### T-082 · Bộ khối dựng kiến trúc chùa (kit.mjs)
- **Trạng thái**: 🟣 Chờ soát. Vòng 1 (gpt-6.1-terra) còn thô, vòng 2 (gpt-6.1-sol) đạt. Điều phối chạy lại: npm run check sạch, test world3d 20/20, xem /world3d-kit.html: 26 khối, mái cong đầu đao, console không lỗi.
- **Ưu tiên**: P0
- **Gói ngữ cảnh**: CORE + HALL
- **Khu vực chạm**: public/js/world3d/kit.mjs (mới), public/world3d-kit.html (mới, trang thử)
- **Phụ thuộc**: T-080
- **Thợ**: gpt-6.1-terra · **Soát**: gpt-6-sol + Gemini Argon (ảnh)
- **Người làm**: gpt-6.1-sol (Codex CLI qua proxy)
- **Nhánh**: codex/T-082-khoi-dung
- **Mục tiêu**: Thư viện hàm dựng hình bằng mã, dùng chung cho 4 cảnh: mái ngói cong đầu đao, cột gỗ, tường, cửa bức bàn, nền gạch, bậc đá, đèn lồng, bồ đoàn, kệ kinh, bàn đá + ghế, cây bồ đề, lư hương, chuông, mõ; bảng vật liệu dùng chung (gỗ, ngói, đá, đồng, vải).
- **Tiêu chí xong**:
  - [x] Mỗi hàm trả `THREE.Group` gốc ở mặt sàn, đơn vị mét; nhận `quality` để giảm số mặt; gộp geometry tĩnh; vật liệu lấy từ một bảng dùng chung (không tạo mới mỗi lần gọi)
  - [x] `disposeKit()` giải phóng hết
  - [ ] Trang thử bày toàn bộ khối trên lưới, có nhãn tên; chụp ảnh gửi kèm bàn giao
  - [x] Toàn bộ khối trên trang thử < 60 nghìn tam giác ở mức Vừa
- **Ngoài phạm vi**: không dựng cảnh hoàn chỉnh, không tải mô hình/ảnh ngoài.

- **Ghi chú**: Vòng 2 giữ 14 API cũ, thêm 11 khối và `roof({width, depth, tiers, quality})`, `templeHall({width, depth, quality})`. Mái bốn phía có đầu đao cong, ngói ống từng viên, kìm nóc và chồng diêm; chánh điện thân nhà 16×10 m. Trang thử bày 26 khối có nhãn, nền tối, tự căn toàn cảnh và chọn xem gần; 55.874 tam giác khối dựng (55.876 kể cả nền) ở mức Vừa. `node test/world3d-kit.test.js`: 8/8 đạt; kiểm cú pháp trực tiếp đạt. Theo chỉ dẫn vòng 2: không tạo tiến trình con, không stage/commit; điều phối chạy kiểm tổng, mở trình duyệt và chụp ảnh. Bàn giao cục bộ: `BAN-GIAO-T-082.md` (không commit).

### T-083 · Nhân vật 3D low-poly và NPC
- **Trạng thái**: 🟣 Chờ soát
- **Người làm**: gpt-6.1-sol (Codex CLI qua proxy)
- **Nhánh**: codex/T-083-nhan-vat-3d
- **Ưu tiên**: P0
- **Gói ngữ cảnh**: CORE + HALL
- **Khu vực chạm**: public/js/world3d/avatar.mjs (mới), public/world3d-avatar.html (mới, trang thử)
- **Phụ thuộc**: T-080
- **Thợ**: gpt-6.1-sol · **Soát**: Claude Sonnet 5.5 + Gemini Argon (ảnh)
- **Mục tiêu**: Nhân vật 3D khớp với nhân vật 2D hiện có (`look = { g:'nam'|'nu', c:0..11, h:0..3 }`, xem `drawAvatar` trong `hall.js`), và các NPC (`drawNpcAccessory`).
- **Tiêu chí xong**:
  - [x] `createAvatar(look, opts)` → `{ group, update(state, dt), setLook, dispose }`; `state` có `walking`, `yaw`, `bow` (0..1), `sit`, `talk`, `aura`, `name`, `tag`, `bubble`
  - [x] Hoạt cảnh đi, đứng thở, vái lạy, ngồi bồ đoàn, ngồi ghế đá; giảm chuyển động thì chỉ đổi tư thế
  - [x] Nhãn tên + bong bóng chat là sprite `CanvasTexture` (chữ vẽ bằng `fillText`), luôn quay về máy quay, ẩn với chính mình ở góc nhìn thứ nhất
  - [x] NPC: Lão Ăn Mày, Vạn Lý Độc Hành, Obito, Tảo Địa Tăng, thầy bói (phụ kiện theo vai)
  - [ ] ≤ 600 tam giác mỗi nhân vật; 60 nhân vật vẫn ≥ 30 khung hình/giây trên máy bàn (ghi số đo)
- **Ngoài phạm vi**: không sửa `hall.js`; không đổi dữ liệu `look`.
- **Ghi chú bàn giao**: Đã có `/world3d-avatar.html`, kéo xoay/cuộn thu phóng, đổi ngoại hình/tư thế và đo 60 nhân vật (khởi động 2 giây + lấy mẫu 10 giây, kết quả tại `window.avatarBenchmark`). Tối đa 492 tam giác/người kể cả hào quang, bóng tiếp xúc và hai nhãn; 576 cấu hình đã kiểm bằng test. Kiểm cú pháp trực tiếp 134 file sạch; test mới 4/4 và `hall-npcs` 4/4 đạt. `npm run check`, `node --test` và e2e cảnh gặp EPERM khi tạo tiến trình con; điều phối chạy lại và kiểm ảnh/FPS. Thêm `test/world3d-avatar.test.js` ngoài khu vực để kiểm hợp đồng mới. Chi tiết trong `BAN-GIAO-T-083.md` (không commit).

### T-084 · Cảnh Chánh điện 3D
- **Trạng thái**: 🟣 Chờ soát. Điều phối chạy lại: npm run check sạch, test cảnh 8/8, xem /world3d-scene-hall.html ở cả hai góc nhìn: tam thế Phật, bàn thờ, bát hương, hoành phi, console không lỗi.
- **Người làm**: gpt-6.1-sol (Codex CLI qua proxy)
- **Nhánh**: codex/T-084-canh-chanh-dien
- **Ưu tiên**: P0
- **Gói ngữ cảnh**: CORE + HALL
- **Khu vực chạm**: public/js/world3d/scenes/hall.mjs (mới)
- **Phụ thuộc**: T-080, T-082
- **Thợ**: gpt-6.1-sol · **Soát**: Claude Sonnet 5.5 + Gemini Argon
- **Mục tiêu**: Chánh điện 3D có đủ vật mà bản 2D có và chạm được: tượng Phật, bàn thờ + lễ vật theo `altar`, bát hương + nén nhang theo `incense` (khói ở mức Cao), chuông, mõ, ống xăm, cửa sang Tàng Kinh Các.
- **Tiêu chí xong**:
  - [x] `build(ctx)` → `{ group, update(state, dt), pick(raycaster), bounds, dispose }`; `pick` trả `{ kind:'floor'|'bowl'|'statue'|'lib'|'jar', x, z }`; ghi ánh xạ handler ở đầu module
  - [x] Vị trí vật theo toạ độ sàn của `geo()`/`drawBg()` trong `hall.js`; tủ trái nằm ngoài hàng cột như 2D
  - [x] Ánh nến ấm, tượng có ánh vàng; mức Thấp không bóng đổ (đã kiểm bằng Three thật; chờ soát ảnh)
  - [ ] Ảnh chụp 2 góc nhìn × 3 cỡ màn trong bàn giao
- **Ngoài phạm vi**: không nối vào game (T-088).
- **Ghi chú**: Có trang thử `public/world3d-scene-hall.html` với 6 khách và nhân vật mình, WASD/chạm sàn, kéo/cuộn/chụm, góc nhìn 1/3 và ba mức đồ họa. Test cảnh trực tiếp đạt 8/8, Hall NPC đạt 4/4; `node --check` sạch. Theo chỉ dẫn điều phối, chưa chạy lệnh tạo tiến trình con, chưa chụp ảnh và chưa add/commit; chi tiết ở `BAN-GIAO-T-084.md` (không commit file bàn giao).

### T-085 · Cảnh Sân chùa 3D
- **Trạng thái**: 🟣 Chờ soát. Điều phối soát 13/11: vòng 2 (gpt-6.1-sol, bị cắt vì hết hạn mức nhưng mã đã đủ) đạt về hình; check sạch, test 9/9; đã sửa tiêu đề trang thử. Chưa soát kỹ góc nhìn thứ nhất và pick trên trình duyệt. · **Ưu tiên**: P1 · **Gói ngữ cảnh**: CORE + HALL + KYDAO
- **Người làm**: gpt-6.1-sol (Codex CLI qua proxy) · **Nhánh**: codex/T-085-canh-san-chua
- **Khu vực chạm**: public/js/world3d/scenes/yard.mjs (mới)
- **Phụ thuộc**: T-080, T-082 · **Thợ**: gpt-6.1-terra · **Soát**: gpt-6-sol + Gemini Argon
- **Mục tiêu**: Sân chùa 3D: mặt tiền chánh điện, 4 bàn đá đúng `YARD_TABLES` (biển tên bàn, người ngồi), hai thầy bói, cây, trời ngày/đêm theo `state.daylight`.
- **Tiêu chí xong**:
  - [ ] Cùng giao diện `build/update/pick/dispose`; `pick` trả `table` (id 1–4), `reader`, `floor`
  - [ ] Toạ độ bàn/ghế lấy từ `state.tables`, không chép số
  - [ ] Ảnh ngày và đêm trong bàn giao
- **Ngoài phạm vi**: không sửa `hall.js`, `server.js`.

### T-086 · Cảnh Tàng Kinh Các 3D
- **Trạng thái**: 🟣 Chờ soát. Điều phối soát 13/11: vòng 2 (gpt-6.1-sol, dừng vì hết hạn mức nhưng mã đã đủ) đạt về hình; check sạch, test 11/11. Chưa soát kỹ góc nhìn thứ nhất và pick chỗ ngồi trên trình duyệt. · **Ưu tiên**: P1 · **Gói ngữ cảnh**: CORE + HALL
- **Người làm**: gpt-6.1-sol (Codex CLI qua proxy)
- **Nhánh**: `codex/T-086-canh-tang-kinh-cac`
- **Khu vực chạm**: public/js/world3d/scenes/library.mjs (mới)
- **Phụ thuộc**: T-080, T-082 · **Thợ**: gpt-6.1-terra · **Soát**: gpt-6-sol + Gemini Argon
- **Mục tiêu**: Tàng Kinh Các 3D: kệ kinh quanh tường, 8 bồ đoàn đúng `state.seats`, đèn dầu, cửa sổ có nắng.
- **Tiêu chí xong**:
  - [ ] `pick` trả `seat` (chỉ số 0–7), `shelf`, `floor`; bồ đoàn có người ngồi thì nhân vật ở tư thế ngồi
  - [ ] Ảnh 2 góc nhìn trong bàn giao
- **Ghi chú**: Đã dựng cảnh và trang thử; kiểm thử trực tiếp 2/2 đạt. Điều phối cần kiểm giao diện, chụp ảnh hai góc và chạy các lệnh còn lại.
- **Ngoài phạm vi**: không sửa `LIB_SEATS`.

### T-087 · Cảnh Sân đấu (khu đi lại) 3D
- **Trạng thái**: 🟣 Chờ soát. Điều phối chạy lại: npm run check sạch, test cảnh 10/10, xem /world3d-scene-arena.html: võ đài thái cực, giá binh khí, cờ phướn, console không lỗi. Không đụng arena.js. · **Ưu tiên**: P1 · **Gói ngữ cảnh**: CORE + HALL + PK
- **Người làm**: gpt-6-astra (Codex CLI qua proxy)
- **Nhánh**: `codex/T-087-canh-san-dau`
- **Khu vực chạm**: public/js/world3d/scenes/arena.mjs (mới); bổ sung theo giao việc: public/world3d-scene-arena.html, test/world3d-scene-arena.test.js (mới)
- **Phụ thuộc**: T-080, T-082 · **Thợ**: gpt-6-astra · **Soát**: gpt-6-sol + Gemini Argon
- **Mục tiêu**: Khu đi lại của Sân đấu ở dạng 3D (đối chiếu `drawArenaYard`, `drawArenaLive` trong `hall.js`): võ đài đá, giá binh khí, trống, cờ.
- **Tiêu chí xong**:
  - [x] Cùng giao diện cảnh; `pick` trả `person`, `floor`
  - [x] **Không** đụng sàn PK trong `arena.js` (PK giữ nguyên góc nhìn thứ ba hiện tại)
- **Ghi chú bàn giao**: Cảnh dùng kit, khớp PLAT và vị trí đồ vật 2D; trang thử có 6 khách + mình, WASD/chạm sàn, góc nhìn 1/3, đồ họa và giảm chuyển động. `node --check` hai file mới sạch; chạy trực tiếp test cảnh 10/10 và hall-npcs 4/4. Theo giao việc, để điều phối chạy npm check / node --test, chụp ảnh và commit; chưa add/commit. Browser host không khả dụng nên chưa kiểm ảnh WebGL. Hợp đồng state/pick và hướng dẫn soát ở `BAN-GIAO-T-087.md` (không commit). Không đổi index.html vì chưa nạp cảnh này vào game (T-088).
- **Ngoài phạm vi**: mọi thứ trong `arena.js`.

### T-088 · Nối 3D vào game: nút 2D/3D, góc nhìn 1/3, điều khiển
- **Trạng thái**: 🟣 Chờ soát. Điều phối soát 13/11: hai vòng gpt-6.1-sol. npm run check sạch 155 file, npm test 825 đạt 0 trượt 3 bỏ qua. Chơi thử game thật trên trình duyệt: bật 3D, WASD, phím V, đủ 4 cảnh, console không lỗi; vòng 2 đã sửa máy quay chúi sàn, bảng tên quá to, Sân chùa tối. Việc ẩn nút góc nhìn khi PK mới kiểm bằng test, chưa thử trận thật; chưa thử trên điện thoại.
- **Người làm**: gpt-6.1-sol (Codex CLI qua proxy) · **Nhánh**: `codex/T-088-noi-3d-vao-game`
- **Ưu tiên**: P0
- **Gói ngữ cảnh**: CORE + HALL + NAV
- **Khu vực chạm**: public/js/hall.js (chỉ **thêm** `Hall.view3d`: `snapshot()`, `hold(on)`, `emit(kind, data)`; không sửa hàm vẽ), public/js/world3d/camera.mjs, input.mjs (mới), public/js/view3d-ui.js (mới: nút, lưu `ta-view`), public/js/app.js (vùng khởi tạo Hall + phím tắt), public/index.html (`importmap`, nút, `<script>`, `?v=`), public/css/view3d.css (mới, tiền tố `v3-`), public/js/arena.js (chỉ chỗ gọi `Hall.attach`), test/hall-view3d.test.js (mới)
- **Phụ thuộc**: T-080, T-081, T-083, T-084
- **Thợ**: gpt-6.1-sol · **Soát**: Claude Sonnet 5.5 + Gemini Argon · dự phòng thợ: Claude Sonnet 5.5
- **Mục tiêu**: Người chơi bấm "3D" là cảnh đang đứng chuyển sang 3D, đổi được góc nhìn thứ nhất / thứ ba, đi lại và chạm vật như bản 2D. Bấm "2D" quay lại như cũ.
- **Tiêu chí xong**:
  - [ ] `Hall.view3d.snapshot()` trả bản chụp chỉ đọc: `scene`, `me`, người chơi (id nội bộ, tên, look, x, z, đang đi, ngồi, vái, hào quang, bong bóng), NPC, `incense`, `altar`, `tables`, `seats`, `daylight`; **không** có uid của ai
  - [ ] `Hall.view3d.hold(true)` làm `frame()` bỏ phần vẽ 2D nhưng vẫn nội suy vị trí và cho NPC đi; các API cũ của `Hall` không đổi tên, test `hall-npcs` vẫn đạt
  - [ ] Nút "2D / 3D" và nút góc nhìn (phím `V`), ≥ 44px, lưu `ta-view` `{ on, mode, quality }`; cảnh chưa có bản 3D thì tự ở 2D
  - [ ] Góc thứ ba: kéo để xoay, cuộn/chụm để thu phóng; góc thứ nhất: kéo để nhìn; chạm sàn để đi ở cả hai; WASD + cần ảo gửi `move` ≤ 8 lần/giây qua `moveTarget` của T-081
  - [ ] Chạm người / NPC / bát hương / tượng / bồ đoàn / bàn đá gọi đúng handler mà 2D đang gọi
  - [ ] Vào PK (sàn đấu) thì nút góc nhìn ẩn; rời PK hiện lại
  - [ ] Không có WebGL2 hoặc `start` lỗi: báo một câu ngắn, ở lại 2D
  - [ ] `npm run check`, `npm test` không thêm ca trượt; ảnh 3 cỡ màn, 2 góc nhìn
- **Ngoài phạm vi**: không đổi giao thức socket, không sửa `server.js`, không sửa các hàm `draw*` của `hall.js`.
- **Ghi chú bàn giao vòng 2**: Kiểm cú pháp trực tiếp 155 file JS/MJS sạch; 8 file test trực tiếp đạt 89/89. `npm run check` / `node --test` gặp spawn EPERM; chạy trực tiếp `e2e-scene` vẫn có 2 ca lỗi spawn EPERM ở helper mở server. Chưa chạy lại toàn bộ npm test hoặc kiểm ảnh/WebGL; nhờ điều phối chơi thử bốn mục và chạy e2e ngoài sandbox. Đã tăng cache của script và chuỗi import 3D. Chi tiết bốn mục, file ngoài vùng chạm bắt buộc và giới hạn kiểm chứng trong `BAN-GIAO-T-088.md` (không commit).

### T-089 · Cài đặt đồ họa, tự dò máy yếu
- **Trạng thái**: 🟣 Chờ soát. Điều phối chạy lại: npm run check sạch, node --test test/gfx-detect.test.js 5/5. Lưu ý: điện thoại hiện luôn vào mức Thấp; nới sau khi đo máy thật. · **Ưu tiên**: P1 · **Gói ngữ cảnh**: CORE + HALL
- **Khu vực chạm**: public/js/world3d/quality.mjs (mới), public/js/gfx-detect.js (mới, UMD thuần), test/gfx-detect.test.js (mới)
- **Phụ thuộc**: T-080 (đã có trên nhánh) · **Thợ**: gpt-6-luna · **Soát**: gpt-6-sol
- **Người làm**: gpt-6-luna (Codex CLI qua proxy) · **Nhánh**: `codex/T-089-cai-dat-do-hoa`
- **Mục tiêu**: Chọn mức Thấp / Vừa / Cao tự động và tự hạ mức khi giật.
- **Tiêu chí xong**:
  - [x] `gfx-detect.js`: `pickQuality({ webgl2, cores, memory, dpr, mobile, reduceMotion })` thuần + bộ đếm `createFpsGovernor({ low:30, windowMs:3000 })` (tiêm `now`); có test
  - [x] `quality.mjs` áp mức vào renderer (tỉ lệ điểm ảnh, bóng đổ, hạt, khoảng nhìn)
- **Ghi chú bàn giao**: 5 test qua; do môi trường chặn tiến trình con, đã kiểm cú pháp từng file bằng `node --check` và chạy trực tiếp `node test/gfx-detect.test.js`. Chi tiết ở `BAN-GIAO-T-089.md`.
- **Ngoài phạm vi**: giao diện cài đặt (T-088 gọi).

### T-090 · Vẽ lại quân cờ 2D đẹp hơn
- **Trạng thái**: 🟣 Chờ soát. Vòng 1 (gpt-6.1-terra) chưa đạt, vòng 2 (gpt-6.1-sol) đạt. Điều phối chạy lại: npm run check sạch, node --test test/kydao-ui-core.test.js 12/12, xem trang /kydao-pieces-test.html: vẽ một bàn 32 quân 0,1–0,2 ms, console không lỗi. Chưa tăng ?v= vì index.html chưa nạp kydao-draw.js (T-034 nối).
- **Ưu tiên**: P1
- **Gói ngữ cảnh**: CORE + KYDAO
- **Khu vực chạm**: public/js/kydao-draw.js (chỉ `CHESS_SHAPES`, `drawChessPiece`, `drawXiangqiPiece`, `drawChessBoard`, `drawXiangqiBoard`), public/index.html (chỉ dòng `?v=` của `kydao-draw.js`), test có sẵn của kydao-draw
- **Phụ thuộc**: không (T-033 gộp `main` sau thẻ này)
- **Thợ**: gpt-6.1-sol · **Soát**: gpt-6-sol + Gemini Argon (ảnh)
- **Người làm**: gpt-6.1-sol (Codex CLI qua proxy)
- **Nhánh**: `codex/T-090-quan-co-2d`
- **Mục tiêu**: Quân cờ vua và cờ tướng trên bảng 2D trông như đồ thật: quân vua kiểu Staunton có khối (chuyển sắc, viền sáng, bóng đổ), quân cờ tướng là đĩa gỗ dày có vành, chữ khắc chìm; bàn có vân gỗ và viền.
- **Tiêu chí xong**:
  - [x] Vẫn vẽ hoàn toàn bằng mã (không tệp ảnh, không ký tự ♔), không đổi API xuất (`layout`, `squareAt`, `cellXY`, `parseSq`, `nameOf`, `draw`…) và không đổi hình học; test hiện có vẫn đạt
  - [ ] Phân biệt rõ 6 loại quân cờ vua ở cỡ ô 36px (điện thoại 375px); quân Đen/Trắng, Đỏ/Đen tương phản tốt trên nền
  - [ ] Một lần vẽ cả bàn 32 quân < 4 ms trên máy bàn (lưu sẵn quân vào canvas đệm theo cỡ ô; ghi số đo)
  - [ ] Ảnh trước/sau cho cờ vua và cờ tướng (cả chế độ chữ Việt) ở 375px và 1280px
  - [ ] `npm run check` sạch; tăng `?v=`
  - [x] Trang thử `public/kydao-pieces-test.html` nạp `/js/kydao-draw.js`, có mọi quân hai bên ở ô 36/72px, chữ Hán/Việt/quân úp, hai thế khai cuộc và đo trung bình 120 lần vẽ sau 20 lần làm nóng
- **Ghi chú vòng 2**: Chạy trực tiếp `node test/kydao-ui-core.test.js` đạt 12/12 (thêm 2 ca kiểm đường vẽ và bộ đệm); `node --check` hai file JS và kiểm cú pháp script trang thử đạt. `npm run check` / `node --test` gặp EPERM khi tạo tiến trình, điều phối sẽ chạy lại; không coi là bị chặn theo giao việc. Chưa có ảnh hoặc số đo thực tế. Trang thử bổ sung theo yêu cầu vòng 2; không tăng `?v=` vì index.html chưa nạp module. Chưa add/commit theo chỉ dẫn vòng 2; bàn giao trong `BAN-GIAO-T-090.md` (không commit).
- **Ngoài phạm vi**: `kydao-ui.js`, luật cờ, cờ vây/caro (T-033).

### T-091 · Bàn cờ 3D, quân tiện tròn
- **Trạng thái**: 🟣 Chờ soát. Điều phối chạy lại: npm run check sạch, test 18/18, xem /world3d-board.html: cờ vua và cờ tướng hiện đúng, console không lỗi. Còn lại: quân trắng hơi cháy sáng, quân cờ tướng hơi nhỏ so với ô; nút Bàn 3D chưa thấy trong game vì index.html chưa nạp KydaoUI (T-034). · **Ưu tiên**: P1 · **Gói ngữ cảnh**: CORE + KYDAO
- **Người làm**: gpt-6.1-sol (Codex CLI qua proxy) · **Nhánh**: codex/T-091-ban-co-3d
- **Khu vực chạm**: public/js/world3d/board3d.mjs (mới), public/js/kydao-ui.js (chỉ thêm nút "Bàn 3D" và chỗ gắn), public/world3d-board.html (mới, trang thử)
- **Phụ thuộc**: T-080, T-090 · **Thợ**: gpt-6.1-sol · **Soát**: Claude Sonnet 5.5 + Gemini Argon
- **Mục tiêu**: Trong bảng bàn cờ có nút đổi sang bàn 3D: quân cờ vua tiện tròn (`LatheGeometry`, mã có đầu ngựa đúc), quân cờ tướng đĩa gỗ khắc chữ, đá cờ vây bóng; xoay bàn, quân trượt khi đi, quân bị ăn rơi ra mép.
- **Tiêu chí xong**:
  - [x] Nhận cùng dữ liệu mà `KydaoDraw.draw` nhận; chạm ô trả cùng tên ô như `squareAt`
  - [x] Không có WebGL2 thì nút ẩn; 2D vẫn là mặc định (đã viết mã; chờ điều phối kiểm trình duyệt)
  - [ ] Ảnh 2 môn cờ trong bàn giao
- **Ghi chú bàn giao**: Module độc lập + trang thử `/world3d-board.html`, hai bàn khai cuộc, xoay/chụm, nước thử có ăn quân, Hán/Việt; có thêm vây/caro vì dữ liệu luật đã có. `kydao-ui.js` thêm nút nạp lười, cùng luồng chọn ô, tự về 2D khi lỗi; `index.html` chưa nạp Kỳ Đạo trong nhánh này (T-034), không tự nối ngoài phạm vi. Test trực tiếp Node: 112 đạt, 0 trượt, 1 bỏ qua (perft sâu); cú pháp 3 JS/MJS và script trang thử sạch. Theo giao việc, điều phối chạy `npm run check` / `node --test`, chụp ảnh, soát WebGL và add/commit; thợ chưa add/commit. Chi tiết trong `BAN-GIAO-T-091.md` (không commit).
- **Ngoài phạm vi**: luật cờ, giao thức `kd:*`.

### T-092 · ui-harness và ảnh chụp cho 3D
- **Trạng thái**: 🟣 Chờ soát. Điều phối soát 13/11 (thợ gpt-6-luna): check sạch, đã đọc mã. Đã cài Playwright (không ghi vào package.json) và chạy node tools/ui-harness/world3d/run.js: đạt 24/24 tổ hợp (4 cảnh × 2 góc nhìn × 3 cỡ màn hình), không lỗi console; số FPS đo bằng SwiftShader nên không đại diện máy thật. Đã lọc cảnh báo vô hại của SwiftShader. Đã thêm .gitignore cho thư mục artifacts. · **Ưu tiên**: P2 · **Gói ngữ cảnh**: CORE + OPS · **Thợ**: gpt-6-luna (Codex CLI qua proxy) · **Soát**: Gemini Argon
- **Khu vực chạm**: tools/ui-harness/world3d/* (mới)
- **Mục tiêu**: Kịch bản Playwright mở 4 cảnh × 2 góc nhìn × 3 cỡ màn, chụp ảnh, báo lỗi console và số khung hình/giây.
- **Ghi chú bàn giao**: Thêm `run.js`, phục vụ trang thử cùng Three.js, chạy 24 tổ hợp bằng Chromium + SwiftShader, xuất PNG và `report.json` vào `tools/ui-harness/world3d/artifacts/`. `node --check` sạch; môi trường thợ không cho chạy npm/Playwright hoặc git commit; xem `BAN-GIAO-T-092.md` để điều phối chạy và commit.

### T-093 · README, Sổ tay cho 3D và góc nhìn
- **Trạng thái**: 🟣 Chờ soát. Điều phối soát 13/11 (thợ gemini-3.8-flash-high): đối chiếu từng ý với mã, sửa ba chi tiết sai (lư trầm thành đèn dầu, võ đài bát quái thành thái cực, bỏ ý chọn mức đồ họa trong thanh điều khiển). check sạch, test guide và sync-constants đạt. · **Ưu tiên**: P2 · **Gói ngữ cảnh**: CORE + DOCS · **Thợ**: gemini-3.8-flash-high (Codex CLI qua proxy) · **Soát**: Gemini Argon
- **Người làm**: gemini-3.8-flash-high (Codex CLI qua proxy)
- **Nhánh**: codex/T-093-tai-lieu-3d
- **Khu vực chạm**: README.md, public/data/so-tay.vi.json, docs/agents/ARCHITECTURE.md (§1, §5, §6)
- **Mục tiêu**: Người chơi biết bật 3D, đổi góc nhìn, điều khiển; agent sau biết cấu trúc world3d/.

### T-100 · Nhân vật 3D bám sát 2D: hào quang, pháp tướng, quỷ, trang phục, Obito
- **Trạng thái**: 🟣 Chờ soát. Điều phối soát 13/11 (thợ gpt-6.1-sol): check sạch, npm test 832 đạt 0 trượt 3 bỏ qua. Xem game thật ở Tàng Kinh Các 3D: quỷ hiện sau lưng Hắc Phong Ma Khách, Obito áo choàng đen mây đỏ, dáng người thon hơn. Chưa xem tận mắt 9 bậc hào quang, pháp tướng và trang phục cô nương trong game.
- **Ưu tiên**: P0 (chủ dự án 13/11: hào quang, quỷ do cúng dường là dấu ấn của game, không được mất khi sang 3D)
- **Gói ngữ cảnh**: CORE + HALL
- **Khu vực chạm**: public/js/world3d/avatar.mjs, public/js/world3d/index.mjs (chỉ phần dựng/cập nhật nhân vật), public/js/hall.js (CHỈ hàm viewSnapshot: thêm trường còn thiếu), public/world3d-avatar.html, test/world3d-avatar.test.js, test/hall-view3d.test.js, public/js/view3d-ui.js và public/index.html (chỉ tăng ?v=)
- **Người làm**: gpt-6.1-sol (Codex CLI qua proxy) · **Nhánh**: codex/T-100-nhan-vat-3d-hao-quang
- **Mục tiêu**: bật 3D vẫn thấy đủ dấu ấn của bản 2D trên từng nhân vật.
- **Tiêu chí xong**:
  - [x] Hào quang theo bậc cúng dường: dùng lại đúng ảnh `/img/fx/aura/*.webp` và màu bậc như 2D (ảnh phẳng luôn quay về máy quay, đặt sau lưng nhân vật), mức Thấp vẫn hiện
  - [x] Pháp tướng và quỷ theo sau (`/img/fx/demon-*.webp` và các hiệu ứng tương ứng trong hall.js) hiện trong 3D đúng điều kiện như 2D
  - [x] Trang phục NPC nữ (`npcFashion`) và các kiểu tóc giống hình 2D; Obito áo choàng đen mây đỏ, mặt nạ cam xoáy
  - [x] Dáng nhân vật thon, mềm hơn (bớt khối hộp), giữ số tam giác thấp cho điện thoại
  - [x] Hết hạn hào quang thì tắt đúng giờ máy chủ; tôn trọng giảm chuyển động
  - [x] npm run check sạch; test avatar và hall-view3d đạt; trang thử /world3d-avatar.html có đủ các biến thể
- **Soát lại 14/11 (Điều phối, trước T-144, checklist ORCHESTRATION §7)**: mã T-100 đã nằm trong nhánh `claude/game-graphics-3d-redesign-9b309a`. `npm run check` sạch; `node --test test/world3d-avatar.test.js test/hall-view3d.test.js` 21/21; `npm test` 962 đạt, 0 trượt, 3 bỏ qua (không có PostgreSQL). Mở `/world3d-avatar.html` bộ "Chín hào quang · sáu pháp tướng · bốn quỷ": hiện đủ, không lỗi console. Diff đúng phạm vi (ngoại lệ đã khai: `scenes/arena.mjs` tăng `?v=`). **Kết luận: đạt, coi như chốt để làm T-144.** Vẫn chưa xem tận mắt trang phục cô nương trong game thật.
- **Ghi chú bàn giao**: Avatar 11/11, hall-view3d 10/10, hall-npcs 4/4, scene-arena 10/10 đạt khi chạy trực tiếp; cú pháp các file sửa và module trang thử đạt. `npm run check` / `node --test` bị sandbox chặn spawn EPERM; chờ điều phối chạy lại và xem trình duyệt. Hiệu ứng Canvas dùng hình tĩnh chung có nhịp thở; chi tiết chuyển động được giản lược. Một dòng ngoài khu vực: tăng import avatar ở scenes/arena.mjs để tránh cache cũ. Báo cáo: BAN-GIAO-T-100.md (không commit); để nguyên chưa commit theo chỉ dẫn điều phối.

### T-101 · Nhạc riêng cho từng môn cờ
- **Trạng thái**: 🟣 Chờ soát. Điều phối soát 13/11 (thợ gpt-6-luna): check sạch, npm test 849 đạt 0 trượt 3 bỏ qua; đã đổi nhạc cờ tướng và cờ úp cho nhau theo ý chủ dự án và sửa NOTICE cho khớp. CHƯA nghe thử trong game (điều phối không nghe được âm thanh): cần chủ dự án mở một ván để nghe chuyển nhạc và trả nhạc.
- **Ưu tiên**: P2
- **Gói ngữ cảnh**: CORE + KYDAO
- **Khu vực chạm**: public/js/audio.js, public/js/kydao-ui.js, public/audio/kydao/*.mp3, public/audio/NOTICE.txt, public/index.html (?v=)
- **Người làm**: gpt-6-luna (Codex CLI qua proxy)
- **Nhánh**: codex/T-101-nhac-co
- **Mục tiêu**: mở bàn cờ thì nhạc nền chùa nhỏ dần, phát nhạc riêng của môn (cờ vua, cờ tướng, cờ úp, cờ vây, caro); rời bàn thì trả lại nhạc cũ; theo nút tắt tiếng chung.
- **Ghi chú bàn giao**: Ánh xạ mã môn → MP3, chuyển nhạc nền và khôi phục theo cảnh; test audio 3/3, kydao-app 16/16 đạt. `npm run check` bị sandbox chặn spawn `node.exe` (EPERM); `git add`/commit bị từ chối tạo `.git/worktrees/T-101/index.lock` (Permission denied). Cú pháp file sửa đã kiểm bằng `node --check`. Xem `BAN-GIAO-T-101.md`.

**Ý tưởng của đợt 3D (⚪, chờ chủ dự án chọn; mô tả ở KE-HOACH-3D §3):** T-094 ngày đêm và đèn lồng · T-095 tiếng nói theo khoảng cách · T-096 trang trí lễ theo âm lịch · T-097 sàn PK 3D máy quay thứ ba cố định · T-098 chụp ảnh lưu niệm · T-099 bản đồ nhỏ.

### Đợt Kỳ Đài · nâng cấp đồ họa các môn cờ

> Thiết kế và hợp đồng: [docs/KE-HOACH-KY-DAI.md](docs/KE-HOACH-KY-DAI.md). Nhánh tích hợp: `claude/chess-game-graphics-upgrade-553ef6` (thợ tách nhánh từ đây). Danh mục skin `public/js/kydao-skins.js` do điều phối giữ: thợ **không sửa**, cần đổi thì ghi vào bàn giao.

### Nhật ký điều phối đợt Kỳ Đài (2026-11-13)

- **Soát độc lập**: T-110 do Gemini 4 Argon soát: PASS. Phần giao diện (T-112, T-113, T-114, T-115a/b/c) do GPT Sol soát: FAIL với 1 lỗi chặn và 4 lỗi nên sửa; T-124 đã sửa hết (đặc tả [docs/ky-dai/T-124-DAC-TA-SUA-SOAT.md](docs/ky-dai/T-124-DAC-TA-SUA-SOAT.md)); chờ soát lại khi GPT hồi hạn mức.
- **T-117**: đủ 8 huy hiệu `public/img/kydao/ui/crest-<id>.webp`. Bốn cái đầu do AI của Canva vẽ; Canva hết credit nên bốn cái sau (ocean, lotus, thunder, desert) ghép tay trong trình soạn Canva từ thành phần miễn phí, phong cách hơi khác. Khi có credit nên vẽ lại bốn cái sau. Huy hiệu chưa được dùng trong giao diện (xem Hộp thư đến).
- **T-118**: bản mẫu Hỏa Diệm Sơn v2 đã gửi chủ dự án xem; **T-118b** dựng lại theo góp ý và làm 7 sân còn lại ([docs/ky-dai/T-118b-DAC-TA-8-SAN.md](docs/ky-dai/T-118b-DAC-TA-8-SAN.md)).
- **T-121, T-122**: dòng sông giữa bàn cờ tướng và cờ úp, 2D và 3D; điều phối đã xem bằng mắt (ảnh ở docs/ky-dai/anh/).
- **T-123**: bàn rung 6–16 px theo cỡ ô, có dư chấn (thợ gpt-6-luna; GLM flash qua Codex CLI trả 429 nên không dùng được cho vòng agent).
- **Hạn mức**: GPT chạm giới hạn lúc 23:30 ngày 13/11 (hồi 00:51 ngày 14/11); Canva hết credit tạo ảnh và tạo thiết kế.
- **T-118b**: đủ 8 sân v2 × 2 bản trong `public/img/kydao/fields2/`. **T-119** (bàn 2D) và **T-125** (bàn 3D) đã dùng ảnh v2 có dải cảnh quanh bàn; điều phối đã xem bằng mắt cả hai (ảnh ở docs/ky-dai/anh/).
- **Soát vòng 2** (Gemini 4 Argon, sau T-124): các lỗi vòng 1 đã sửa đủ; tìm thêm 4 điểm (tải thừa ảnh v1, vòng lặp sông chạy ngầm, đổi cỡ bàn giữa hiệu ứng, bàn 3D tải cả .glb lẫn ảnh): **T-128** đã sửa hết.
- **Lỗi điều phối tự bắt khi xem trình duyệt**: bộ chọn "Lãnh địa" bị bóp còn 28 px trong khung flex (test DOM giả không thấy); đã sửa bằng `flex: 0 0 auto` và cuộn vào tầm nhìn khi mở.
- **T-116**: README, Sổ tay (`public/data/so-tay.vi.json`), ARCHITECTURE đã cập nhật. Phần ui-harness tự động chưa làm; hiện dùng 4 trang thử tay (`/kydao-kydai-test.html`, `/kydao-fx-test.html`, `/kydao-skins-test.html`, `/world3d-board.html`).
- **T-126a/b**: 8 atlas quân 2D render từ mô hình 3D (`public/img/kydao/pieces2d/`, mỗi bộ khoảng 40 KB); bàn 2D vẽ quân có skin bằng atlas, vector là đường dự phòng. Điều phối đã xem trên bảng cờ thật và phóng quân lên 1,12 ô cho đầy ô.
- **T-120**: bản mẫu nhân vật áo lam nam/nữ (1.156 / 1.184 tam giác, 97 KB, 15 xương, 4 hoạt ảnh idle/walk/sit/bow) và hào quang lưới; ảnh ở docs/ky-dai/anh/nhan-vat-*.jpg; trang thử `/world3d-avatar.html` khu "Bản mẫu Blender". **Chưa đo được hiệu năng**: khung trình duyệt của điều phối bị bóp còn 3 khung/giây ngay cả với 2 nhân vật, nên số đo vô nghĩa; 60 nhân vật tốn 481 lượt vẽ (8 vật liệu mỗi nhân vật), cần gộp vật liệu thành 1 (màu theo đỉnh) trước khi dùng thật. 👤 Chủ dự án mở trang thử trên trình duyệt thật, bấm "Dừng cảnh dựng bằng mã" rồi "Nhân 60" để xem số khung hình, và duyệt hình dáng trước khi làm T-121 → T-125 cũ (trang phục, tóc, hào quang 9 bậc, pháp tướng, NPC).
- `npm test` trên nhánh tích hợp sau T-126b: **942 đạt, 0 trượt, 3 bỏ qua** (2 PostgreSQL, 1 perft sâu), tổng 945.
- **Nghiệm thu lần cuối** (GPT Sol, 14/11, sau khi hồi hạn mức): không có lỗi chặn; mọi lỗi vòng 1 và vòng 2 đã sửa thật; bất biến bảo mật đều đạt; còn 5 điểm nên sửa + 1 góp ý → **T-129** đã sửa hết (tắt hiệu ứng giữa chừng, tương phản chữ quân ≥ 4,5, nút Khai mở tự hết khóa, bộ chọn dùng được bằng bàn phím, đệm nền tĩnh khi sông chảy, đồng bộ `?v=` trang thử). **Gemini 4 Argon xác nhận T-129: PASS, không còn lỗi chặn, nên sửa hay góp ý.**
- **T-116 phần harness**: `tools/ui-harness/kydao/index.html` có thêm cờ úp, caro, cờ vây, thế sắp phong cấp, đối thủ khai mở sân, kết thúc theo 7 lý do (Haiku). Chưa có kịch bản Playwright tự động (xem T-008).
- **T-120 đã đo hiệu năng** (14/11, Chrome thật điều khiển bằng playwright-core, hồ sơ tạm, 1280×800, card tích hợp AMD Radeon, không khóa khung hình): 2 nhân vật 1.002 khung/giây; **60 nhân vật 118 khung/giây đứng yên, 123 khung/giây khi đi** (70.248 tam giác, 481 lượt vẽ). Tiêu chí ≥ 30 khung/giây đạt. Số 3 khung/giây ghi trước đó là do khung trình duyệt trong app bóp requestAnimationFrame còn khoảng 4 lần/giây, không phải do mô hình.
- **T-130** (14/11): nhân vật Blender vào game dạng tùy chọn. Nút "Người mới" trên thanh 3D đặt `localStorage['ta-avatar'] = 'blender'`; lúc đó mặc định vẫn là nhân vật dựng bằng mã (từ T-177, PR #66: Blender là mặc định, khóa `code` mới về dáng cũ, nút đổi thành "Người cũ"). Mỗi nhân vật 3 lượt vẽ, ≤ 1.282 tam giác, 4 kiểu tóc, ≈115 KB. Hào quang, pháp tướng, quỷ theo sau, nhãn tên giữ nguyên từ bản mã; NPC có vai riêng (Obito, sư thầy…) vẫn dùng bản mã. Đo lại bằng Chrome thật: **60 nhân vật 158 khung/giây**. Ảnh: docs/ky-dai/anh/nhan-vat-blender-*.png, nhan-vat-toc.jpg.
- **T-131** (14/11): `tools/ui-harness/kydao/ui-check.js`, 8 nhóm kiểm × 3 cỡ màn + bản giảm chuyển động = 24 kiểm tra; điều phối chạy bằng Chrome thật (`PW_CHANNEL=chrome`, `playwright-core` cài ngoài repo): **24/24 đạt**. Máy chủ harness đã phục vụ `.mjs` và Three.js.
- **Soát T-130/T-131**: GPT Sol FAIL (1 lỗi chặn ở máy chủ harness chỉ dùng khi phát triển: kiểm ranh giới thư mục bằng tiền tố; 4 điểm nên sửa) → **T-132** sửa hết → **Gemini 4 Argon xác nhận PASS**; góp ý chặn ký tự NUL đã làm luôn.
- **Tổng kết đợt** (nhánh tích hợp `claude/chess-game-graphics-upgrade-553ef6`, CHƯA push, CHƯA mở PR): `npm run check` sạch 172 file; `npm test` **962 đạt, 0 trượt, 3 bỏ qua** trên 965 (2 PostgreSQL, 1 perft sâu); `ui-check.js` 24/24. Mọi thẻ T-110 → T-132 đã qua soát độc lập (Gemini 4 Argon hoặc GPT Sol) và điều phối đã xem bằng mắt.
- **PR #61** (14/11): chủ dự án bấm "Create PR" rồi chọn "Merge ngay"; CI "check + test (Node 22)" xanh (có PostgreSQL thật); điều phối merge theo lời chủ dự án.
- **T-133** (14/11): `tools/ui-harness/kydao/e2e-real.js` chạy `server.js` thật, hai trình duyệt Chrome thật (A, B) và một bot xem (C): ngồi bàn đá, chọn luật, khai mở lãnh địa hai chiều, ẩn skin đối thủ, khóa 20 giây do máy chủ từ chối, người xem nhận `skins`, đi quân, đầu hàng, bảng kết quả, cờ tướng có sông chảy. **9/9 bước đạt** (thợ chạy, điều phối chạy lại). Không phát hiện lỗi game. Giới hạn: chạy ở cỡ điện thoại, hai trình duyệt trên cùng một máy. Chủ dự án chọn "Push, mở PR và merge" (14/11).
- **Huy hiệu** (14/11): Canva vẫn hết credit khi thử lại; chủ dự án chọn **giữ 4 bản ghép tay**, coi như xong. Khi có credit thì vẽ lại 4 cái (Long Cung, Liên Hoa Đài, Lôi Vân Đỉnh, Sa Mạc) theo câu mô tả ghi ở `public/img/NOTICE.txt`.
- **Đợt 2 (14/11), nhánh tích hợp `claude/ky-dai-dot-2`, PR #64 (chủ dự án cho phép push, mở PR và merge). Mã thẻ đổi sang T-160…T-163, T-170…T-175 vì trùng mã đợt Pháp Tướng 3D.** Chủ dự án chốt: (a) cờ vây và caro có skin quân, bàn giữ nguyên; (b) mọi skin miễn phí, khi cần thu thì khóa ngay từ trang quản trị, người chơi cúng dường để mở **từng skin, vĩnh viễn**, mức do chủ dự án đặt ở trang quản trị, duyệt xong tự mở đúng skin đã chọn; (c) thử hai máy qua mạng chủ dự án tự làm. Đặc tả: `docs/ky-dai/T-160-DAC-TA-DA-VAY-CARO.md`, `docs/ky-dai/T-170-DAC-TA-KHOA-SKIN.md`.
- **T-160 → T-163**: 8 bộ đá (Tinh Hà, Lâm Tuyền, Bích Hải, Dung Nham, Băng Phách, Liên Tử, Lôi Châu, Kim Sa), ảnh dựng bằng Blender, dùng cho bàn 2D và 3D; cờ vây và caro không có skin sân nên không có nút Khai mở.
- **T-170 → T-173**: cửa hàng skin. Tắt thì mọi thứ như cũ. Bật (phải có mức chung) thì skin chưa mở bị khóa, skin đang dùng mà chưa mở bị gỡ ngay giữa ván; client chỉ gửi `{kind, id}`, giá do máy chủ; mã ghi bền rồi mới trả QR; webhook SePay chỉ tự xác nhận khi đủ tiền; quyền mở theo tài khoản, gộp khi khách đăng nhập.
- **Soát máy chủ cửa hàng** (Gemini 4 Argon): FAIL, 1 lỗi chặn (ghi bền hỏng ở chế độ thật để lại khoản chờ chưa có trong sổ) → **T-175** sửa. **Nghiệm thu lần cuối cả đợt** (Gemini 4 Argon, agent riêng, chỉ đọc): **PASS**, xác nhận T-175 đúng, phần giao diện đạt các quy tắc §3; 2 điểm nên sửa ở tình huống cạnh, điều phối đã sửa luôn: mã đã phát chỉ hạ theo mức mới chứ không tăng; kiểm lại trạng thái khoản sau khi ghi bền (hai lần bấm sát nhau).
- **Kết quả điều phối tự chạy**: `npm run check` sạch 177 file; `npm test` **1009 đạt, 0 trượt, 3 bỏ qua** trên 1012 (PostgreSQL và perft sâu); `ui-check.js` **29/29**; `e2e-real.js` **16/16** bằng Chrome thật; trang quản trị kiểm bằng Chrome thật với `server.js` thật. Chưa có test cho trường hợp ghi bền hỏng (không có cách gây lỗi trong bộ test) và chưa có e2e cho gộp quyền mở skin khi khách đăng nhập (có test đơn vị `mergeGuest`).
- **T-176** (14/11, sau PR #64): chỉ thêm test, không đổi mã sản phẩm. (B) `test/e2e-kydao-shop.test.js` thêm test ghi sổ hỏng khi mua skin (chặn file tạm của kho JSON bằng một thư mục trùng tên): không trả QR, khoản vừa tạo bị hủy, ghi lại được thì mua tạo mã mới. (C) `e2e-real.js` thêm pha `DONATION_MODE=live` (bước 17 → 21): không tự xác nhận, Ban điều hành duyệt thì khung QR tự đóng và mở đúng skin, duyệt lần hai không cấp thêm. Điều phối tự chạy: `npm test` 1049 đạt, 0 trượt, 3 bỏ qua trên 1052; `e2e-real.js` 21/21. (A) e2e gộp quyền mở skin khi khách đăng nhập: `test/helpers/fake-google.js` nạp trước vào tiến trình máy chủ thử (chỉ chạy khi `NODE_ENV=test`), thay `fetch` cho đúng địa chỉ lấy token của Google, không gọi mạng ngoài, không sửa mã sản phẩm; test đi hết luồng đăng nhập: quyền mở theo về tài khoản, không nhân đôi, khách khác vẫn khóa, `state` sai thì không tạo phiên. Sau phần này: `npm test` 1050 đạt, 0 trượt, 3 bỏ qua trên 1053.
- **T-177** (14/11): chủ dự án quyết **nhân vật Blender là mặc định** trong giao diện 3D. `localStorage['ta-avatar'] === 'code'` thì dùng dáng cũ dựng bằng mã; mọi giá trị khác (kể cả chưa lưu) là Blender. Nút trên thanh 3D đổi thành "Người cũ". Không nạp được `.glb` thì vẫn hiện bản mã; NPC có vai riêng vẫn dùng bản mã. Dòng T-130 ở trên ("mặc định vẫn là nhân vật dựng bằng mã") là trạng thái trước thẻ này. Thử Chrome thật: hồ sơ mới nạp `.glb`, bấm nút ghi `code`, bấm lại gỡ khóa, không lỗi console; ảnh `docs/ky-dai/anh/nhan-vat-blender-mac-dinh.png`. Nghiệm thu: Claude Opus (agent riêng, chỉ đọc) **PASS** (Gemini 4 Argon kẹt kết nối lúc đó). Còn ngỏ 👤: mức đồ họa thấp giờ cũng nạp `.glb`; số đo 60 nhân vật 158 khung/giây là trên máy bàn, chưa đo trên điện thoại yếu.
- **T-179** (14/11): ba ca test còn thiếu cho `kd:skin` từ lượt soát T-110, chỉ thêm test. (1) Hết giờ mà hẹn giờ chưa nổ: gọi skin thì ván bị xử thua hết giờ, ack `stale`, không phát `kd:skin`. (2) Người chơi rời Sân chùa, qua chánh điện rồi vào Võ Học Các vẫn đổi được skin (ghim `where: 'any'`). (3) Trong hạn 20 giây của sân: giữ sân, đổi quân thì được (`opened:false`); đổi sân thì bị từ chối và quân kèm theo cũng không đổi. `npm test` 1070 đạt, 0 trượt, 3 bỏ qua trên 1073. Nghiệm thu (Claude Opus, agent riêng): lượt đầu FAIL vì sổ việc ghi nhầm số PR (số đó đã thuộc PR của đợt Pháp Tướng) và ca (2) chưa ghim được `where` (đổi sang `hall` test vẫn đạt); đã sửa cả hai, phá mã ở cả ba ca đều làm test trượt.
- **Việc từng chờ chủ dự án quyết, nay đã chốt (14/11)**: (1) nhân vật Blender làm mặc định: **có** (T-177, PR #66); (2) cách mở khóa skin: mặc định miễn phí, khi cần thu thì bật cửa hàng ở trang quản trị, cúng dường mở từng skin vĩnh viễn (T-170 → T-175, PR #64); (4) skin cho cờ vây, caro: **có**, chỉ skin quân (T-160 → T-163, PR #64); (6) thử một ván thật giữa hai máy qua mạng: chủ dự án tự thử. **Chốt thêm (14/11, sau PR #67)**: (3) khẩu hiệu khai mở **giữ cố định** theo từng sân, không cho người chơi chọn; nhân vật Blender trên điện thoại yếu: **giữ nguyên mặc định**, chủ dự án tự thử trên máy thật, thấy giật thì mở thẻ cho mức đồ họa thấp dùng dáng cũ. Tùy chọn, không chờ quyết: vẽ lại 4 huy hiệu khi Canva có credit (chủ dự án đã chọn giữ bản ghép tay). **Đợt Kỳ Đài không còn việc treo.**
- `npm test` trên nhánh tích hợp trước T-121: 906 đạt, 0 trượt, 3 bỏ qua (2 PostgreSQL, 1 perft sâu).

### T-110 · Thêm giao thức `kd:skin` trên máy chủ
- **Trạng thái**: 🟣 Chờ soát. Đã gộp vào nhánh tích hợp (commit b35815d). Điều phối chạy lại: check sạch, 220 test Kỳ Đạo đạt. Soát độc lập Gemini 4 Argon (13/11, chỉ đọc): PASS, không lỗi chặn; góp ý thêm 3 ca test (đã ghi Hộp thư đến).
- **Ưu tiên**: P0
- **Gói ngữ cảnh**: CORE + KYDAO + KYDAI
- **Khu vực chạm**: lib/kydao/manager.js, server.js (chỉ thêm handler `kd:skin` cạnh các handler `kd:*`), docs/KY-DAO-GIAO-THUC.md, test/kydao-manager.test.js, test/e2e-kydao.test.js, test/kydao-skins.test.js (mới)
- **Phụ thuộc**: không · **Thợ**: Claude Opus 5.5 · **Soát**: Điều phối
- **Người làm**: Claude Opus 5.5 · **Nhánh**: claude/T-110-giao-thuc-skin
- **Mục tiêu**: hai người chơi và người xem thấy cùng một skin sân, skin quân của từng bên; máy chủ chỉ chuyển tiếp mã skin đã kiểm.
- **Tiêu chí xong**:
  - [x] `kd:skin { gameId, field?, pieces? }`: chỉ người đang chơi ván đó, ván chưa kết thúc, môn thuộc `KydaoSkins.GAMES`; sai thì `ack({ ok:false, reason })`, không ném lỗi
  - [x] Mã skin đi qua `KydaoSkins.normalize`; khóa lạ, kiểu lạ, `__proto__` đều thành `null` (có test)
  - [x] Phát `kd:skin { gameId, side, field, pieces, opened }` cho cả phòng ván (người chơi + người xem); `opened` đúng nghĩa KH §4.2
  - [x] Giới hạn: đổi `field` tối đa 1 lần / 20 giây mỗi người (thời gian tiêm qua `now`); đổi `pieces` tối đa 1 lần / 3 giây
  - [x] `kd:start`, `resume`, `watch` có `skins: { a, b }`; ván mới bắt đầu bằng `null`
  - [x] Payload không chứa uid; cờ úp không lộ thêm gì (quét đệ quy như test hiện có)
  - [x] `docs/KY-DAO-GIAO-THUC.md` có mục `kd:skin`; `npm run check` + `npm test` sạch
- **Ngoài phạm vi**: lưu bền, mở khóa skin, giao diện, `kydao-skins.js`.
- **Ghi chú bàn giao**: `api.skin` trong manager + một dòng `kdPass` ở server.js; giao thức ở KY-DAO-GIAO-THUC §5.4. Giới hạn tính riêng từng người trong một ván, nhân `KYDAO_TIME_SCALE`; vượt giới hạn trả `code:'rate'` + `retryAt`; gửi lại mã đang dùng thì không phát, không tính lượt. Check sạch; Kỳ Đạo 206/207 (1 bỏ qua PERFT_DEEP); npm test 866 đạt, 0 trượt, 3 bỏ qua (PG, PERFT_DEEP). Ngoài khu vực: 2 chỗ thêm tên sự kiện ở ARCHITECTURE.md §4.

### T-111 · Dựng dây chuyền Blender và tài nguyên 8 sân, 8 bộ quân
- **Trạng thái**: 🟡 Đang làm
- **Ưu tiên**: P0
- **Gói ngữ cảnh**: CORE + KYDAI
- **Khu vực chạm**: tools/blender/kydao/* (mới), public/img/kydao/** (mới), public/models/kydao/** (mới), public/img/NOTICE.txt
- **Phụ thuộc**: không · **Người làm**: Điều phối (Claude Fable 5.2, Blender MCP) · **Nhánh**: claude/chess-game-graphics-upgrade-553ef6
- **Mục tiêu**: mỗi skin trong danh mục có ảnh nửa sân 2D, ảnh xem trước và mô hình `.glb`, sinh lại được bằng script.
- **Tiêu chí xong**:
  - [ ] `tools/blender/kydao/` có script dựng cảnh theo `id`, đọc màu từ danh mục, xuất `.webp` + `.glb`; có README cách chạy
  - [ ] 8 sân + 8 bộ quân đạt ngân sách KH §4.5 (bảng số tam giác và dung lượng trong bàn giao)
  - [ ] `public/img/NOTICE.txt` ghi nguồn (tự dựng bằng Blender)
- **Ngoài phạm vi**: mã giao diện.

### T-112 · Viết module hiệu ứng 2D `KydaoFx`
- **Trạng thái**: 🟣 Chờ soát
- **Ưu tiên**: P0
- **Gói ngữ cảnh**: CORE + KYDAO + KYDAI
- **Khu vực chạm**: public/js/kydao-fx.js (mới), public/css/kydao-fx.css (mới), public/kydao-fx-test.html (mới, trang thử), test/kydao-fx.test.js (mới)
- **Phụ thuộc**: không · **Thợ**: Claude Sonnet 5.5 · **Soát**: Điều phối
- **Người làm**: Claude Sonnet 5.5 · **Nhánh**: claude/T-112-kydao-fx
- **Mục tiêu**: một module độc lập phát ba nhóm hiệu ứng trên lớp phủ của bàn cờ, theo đúng API ở KH §4.4.
- **Tiêu chí xong**:
  - [x] `domain`: khẩu hiệu `cry` + dòng `sub` của sân (lấy từ `KydaoSkins`), vệt sáng quét nửa sân từ mép người chơi ra giữa, hạt theo `fx` của sân; tối đa 1,8 giây; không bắt sự kiện chuột/chạm
  - [x] `promote`: bàn rung, vòng sóng lan từ ô phong cấp, gọi `onJolt(map)` mỗi khung để các quân khác nảy lên rồi rơi về chỗ (toán tắt dần là hàm thuần, có test); tối đa 1,2 giây
  - [x] `win`: khác nhau theo `reason`: chiếu hết / bắt Tướng (tia sáng dội xuống ô Vua, vết nứt lan), `five` (vẽ sáng dãy 5 quân theo `line`), thắng điểm cờ vây, hết giờ, xin thua, hòa (nhẹ nhàng); bên thắng thấy pháo hoa cánh sen, bên thua thấy bản dịu
  - [x] `prefers-reduced-motion` hoặc `ta-fx` tắt: chỉ còn chữ mờ dần, không rung, không hạt; `stop()` dọn sạch canvas và timer
  - [ ] Chữ gán bằng `textContent`; CSS tiền tố `kdfx-`; không phụ thuộc thư viện
  - [x] Trang thử có nút cho từng hiệu ứng × từng sân; 375×812 không tràn; ảnh chụp trong bàn giao
- **Ngoài phạm vi**: sửa `kydao-ui.js`, `kydao-draw.js`, `index.html` (T-115 nối sau); bàn 3D.

### T-113 · Bàn 3D: nạp `.glb`, skin nửa sân, skin quân, `playFx`
- **Trạng thái**: 🟣 Chờ soát. Đã gộp vào nhánh tích hợp (commit 136e24b). Thợ báo 17/17 test bàn 3D; điều phối chạy lại và xem WebGL thật.
- **Ưu tiên**: P0
- **Gói ngữ cảnh**: CORE + KYDAO + KYDAI
- **Khu vực chạm**: public/js/world3d/board3d.mjs, public/js/world3d/board-assets.mjs (mới), public/world3d-board.html (trang thử), test/kydao-board3d.test.js
- **Phụ thuộc**: không (thiếu `.glb` thì dùng `palette`) · **Thợ**: Claude Opus 5.5 · **Soát**: Điều phối
- **Người làm**: Claude Opus 5.5 · **Nhánh**: claude/T-113-ban-3d-skin
- **Mục tiêu**: bàn 3D hiện skin từng nửa sân, skin quân từng bên và ba hiệu ứng, cùng dữ liệu `o.skins` như bàn 2D.
- **Tiêu chí xong**:
  - [ ] `board-assets.mjs`: nạp lười `GLTFLoader` từ `/vendor/three-addons/loaders/GLTFLoader.js`, có bộ nhớ đệm, lỗi/404 thì trả `null` và bàn vẫn chạy
  - [ ] `setState(o)` đọc `o.skins`: mỗi nửa sân đổi vật liệu theo `palette` và gắn mô hình `fieldModel(id)` nếu có; quân mỗi bên đổi chất liệu theo `PIECES[id]`, dùng mô hình `piecesModel(id)` nếu có
  - [ ] `playFx('domain'|'promote'|'win', opts)`: khai mở (nửa sân trồi lên/đổi màu dần), phong cấp (máy quay rung, các quân nảy theo khoảng cách tới ô phong cấp, vòng sóng), chiến thắng (Vua thua đổ, ánh sáng dội)
  - [ ] Giảm chuyển động: đổi tức thì, không rung; mức đồ họa Thấp: không hạt
  - [ ] `dispose()` giải phóng hình, vật liệu, texture của skin; đổi skin 20 lần không tăng `renderer.info.memory`
  - [ ] Trang thử có bộ chọn skin từng bên và nút cho từng hiệu ứng; ảnh chụp trong bàn giao
- **Ngoài phạm vi**: `kydao-ui.js`, giao thức, cờ vây/caro (chỉ cần `playFx('win')`).

### T-114 · Bàn 2D: vẽ skin nửa sân, skin quân, `jolt`
- **Trạng thái**: 🟣 Chờ soát. Nhánh claude/T-114-ban-2d-skin (commit df1eaa3) đã gộp vào nhánh tích hợp; test 45/45 theo thợ, điều phối chạy lại và xem trình duyệt.
- **Ưu tiên**: P0
- **Gói ngữ cảnh**: CORE + KYDAO + KYDAI
- **Khu vực chạm**: public/js/kydao-draw.js, public/kydao-pieces-test.html, test/kydao-draw-skins.test.js (mới)
- **Phụ thuộc**: T-111 · **Thợ**: Claude Sonnet 5.5 · **Soát**: Điều phối
- **Người làm**: Claude Sonnet 5.5 · **Nhánh**: claude/T-114-ban-2d-skin
- **Mục tiêu**: `KydaoDraw.draw` vẽ đúng skin từng nửa sân và skin quân từng bên theo `o.skins`, và độ lệch `o.jolt`.
- **Tiêu chí xong**:
  - [ ] Nửa sân: phủ ảnh `fieldImage(id)` (nạp lười, chưa có ảnh thì tô theo `palette`), nét kẻ theo `palette.line`; lật bàn (`flip`) vẫn đúng nửa
  - [ ] Dấu nước vừa đi, ô chọn, ô bị chiếu, điểm gợi ý luôn nằm trên skin và đủ tương phản trên cả 8 sân
  - [ ] Quân: màu thân, viền, ánh sáng theo `PIECES[id].a|b`; khóa bộ nhớ đệm bitmap có mã skin; cờ úp: mọi quân úp cùng một bên vẽ **giống hệt nhau**
  - [ ] `o.jolt[ô] = {dx,dy}` dịch quân khi vẽ; không có `o.skins`/`o.jolt` thì hình ra y như cũ (test so điểm ảnh hoặc lệnh vẽ)
  - [ ] Trang thử hiện 8 sân × 8 bộ quân cho cờ vua và cờ tướng
- **Ngoài phạm vi**: `kydao-ui.js`, hiệu ứng.

### T-115a · Bảng cờ: nạp module, giữ trạng thái skin, truyền vào hàm vẽ
- **Trạng thái**: 🟣 Chờ soát. Đã gộp. Diff đúng đặc tả; điều phối chạy lại test đạt.
- **Ưu tiên**: P0
- **Gói ngữ cảnh**: CORE + KYDAO + KYDAI
- **Đặc tả từng bước (BẮT BUỘC làm theo)**: [docs/ky-dai/T-115-DAC-TA.md](docs/ky-dai/T-115-DAC-TA.md), phần T-115a
- **Khu vực chạm**: public/index.html (nạp script, `?v=`), public/js/app.js (chỉ mảng sự kiện `kd:*`), public/js/kydao-ui.js, test/kydao-ui-core.test.js
- **Phụ thuộc**: T-110, T-113, T-114 · **Thợ**: gpt-6.1-terra (Codex CLI qua proxy) · **Soát**: Gemini 4 Argon (hoặc GPT Sol) + Điều phối chạy test và xem trình duyệt
- **Người làm**: gpt-6.1-terra · **Nhánh**: codex/T-115a-trang-thai-skin
- **Mục tiêu**: bảng cờ biết skin hai bên từ `kd:start` và `kd:skin`, vẽ đúng trên 2D và 3D; chưa có nút bấm.
- **Tiêu chí xong**:
  - [x] Đủ 7 bước a1 → a7 của đặc tả
  - [x] 3 test mới (makeSession đọc skins, applySkin đúng ván/bên, khóa nguy hiểm) đạt
  - [ ] `npm run check` sạch; `node --test test/kydao-ui-core.test.js test/kydao-ui-games.test.js test/kydao-app.test.js` đạt
- **Ghi chú**: Sandbox chặn tạo tiến trình con (`spawn EPERM`); chạy trực tiếp 3 file test đạt 38/38, hai file JS qua `node --check`. Cần điều phối chạy lại `npm run check` và `node --test`.
- **Ngoài phạm vi**: mọi thứ không ghi trong phần T-115a của đặc tả; luật cờ; máy chủ; mở khóa skin.

### T-115b · Bảng cờ: bộ chọn Lãnh địa, gửi skin, màn khai mở
- **Trạng thái**: 🟣 Chờ soát. Đã gộp (commit 025225a). Điều phối chạy lại test đạt; đã thấy chạy trên trang thử.
- **Ưu tiên**: P0
- **Gói ngữ cảnh**: CORE + KYDAO + KYDAI
- **Đặc tả từng bước (BẮT BUỘC làm theo)**: [docs/ky-dai/T-115-DAC-TA.md](docs/ky-dai/T-115-DAC-TA.md), phần T-115b
- **Khu vực chạm**: public/js/kydao-ui.js, public/css/kydao.css, public/index.html (chỉ `?v=`), test/kydao-ui-games.test.js
- **Phụ thuộc**: T-115a · **Thợ**: Claude Sonnet 5.5 · **Soát**: Gemini 4 Argon (hoặc GPT Sol) + Điều phối chạy test và xem trình duyệt
- **Người làm**: Claude Sonnet 5.5 · **Nhánh**: claude/T-115b-bo-chon-lanh-dia
- **Mục tiêu**: người chơi bấm "Lãnh địa", chọn skin sân và skin quân, bấm "Khai mở"; cả bàn thấy khẩu hiệu và nửa sân đổi.
- **Tiêu chí xong**:
  - [x] Đủ 9 bước b1 → b9 của đặc tả
  - [x] Skin quân tự gửi lúc vào ván; skin sân chỉ gửi khi bấm "Khai mở"; người xem, cờ vây, caro không thấy nút
  - [x] Công tắc "Ẩn skin đối thủ" lưu `localStorage`
  - [x] Không có `innerHTML`; nút ≥ 44px; `npm run check` + 4 file test trong đặc tả đạt
- **Ngoài phạm vi**: mọi thứ không ghi trong phần T-115b của đặc tả; luật cờ; máy chủ; mở khóa skin.

### T-115c · Bảng cờ: chấn động phong cấp, hiệu ứng chiến thắng
- **Trạng thái**: 🟣 Chờ soát. Đã gộp. Diff đúng đặc tả; điều phối chạy lại test đạt.
- **Ưu tiên**: P0
- **Gói ngữ cảnh**: CORE + KYDAO + KYDAI
- **Đặc tả từng bước (BẮT BUỘC làm theo)**: [docs/ky-dai/T-115-DAC-TA.md](docs/ky-dai/T-115-DAC-TA.md), phần T-115c
- **Khu vực chạm**: public/js/kydao-ui.js, public/index.html (chỉ `?v=`), test/kydao-ui-core.test.js
- **Phụ thuộc**: T-115b · **Thợ**: gpt-6.1-terra (Codex CLI qua proxy) · **Soát**: Gemini 4 Argon (hoặc GPT Sol) + Điều phối chạy test và xem trình duyệt
- **Người làm**: gpt-6.1-terra · **Nhánh**: codex/T-115c-phong-cap-chien-thang
- **Mục tiêu**: Tốt phong cấp làm rung bàn và hất các quân khác; hết ván có hiệu ứng theo lý do thắng ở cả 5 môn, cả 2D và 3D.
- **Tiêu chí xong**:
  - [x] Đủ 7 bước c1 → c7 của đặc tả
  - [x] Phong cấp phát đúng một lần cho mỗi bên (nhánh `synced` không phát lại)
  - [x] `kd:end`: hiệu ứng chạy trước, bảng kết quả hiện sau; giảm chuyển động thì hiện ngay
  - [ ] `npm run check` sạch; `node --test test/kydao-*.test.js test/e2e-kydao.test.js` đạt
- **Ghi chú**: Đã nối hiệu ứng và test phong cấp; sandbox chặn tiến trình con (`spawn EPERM`), cần điều phối chạy lại kiểm tra và xem giao diện.
- **Ngoài phạm vi**: mọi thứ không ghi trong phần T-115c của đặc tả; luật cờ; máy chủ; mở khóa skin.

### T-116 · ui-harness, ảnh chụp, Sổ tay, README cho Kỳ Đài
- **Trạng thái**: ⏳ Chờ T-115
- **Ưu tiên**: P1 · **Gói ngữ cảnh**: CORE + KYDAI + DOCS
- **Khu vực chạm**: tools/ui-harness/kydao/*, README.md, public/js/guide.js (mục Kỳ Đạo), docs/agents/ARCHITECTURE.md
- **Phụ thuộc**: T-115c · **Thợ**: Gemini 3.8 Flash (tài liệu) + Claude Haiku 5.5 (harness) · **Soát**: GPT Sol
- **Mục tiêu**: kịch bản giả lập khai mở, phong cấp, 5 kiểu thắng; ảnh 375/768/1280; tài liệu người chơi và bản đồ mã cập nhật.
- **Tiêu chí xong**:
  - [ ] Harness phát `kd:skin`, nước phong cấp, `kd:end` từng `reason`; lỗi console là trượt
  - [ ] README và Sổ tay có mục "Lãnh địa và skin quân"; ARCHITECTURE §6 thêm điểm đồng bộ danh mục ↔ tài nguyên Blender

### T-117 · Đồ họa 2D bằng Canva: khung khẩu hiệu, biểu tượng bộ chọn
- **Trạng thái**: ⏳ Chờ T-115 (cần biết kích thước thật)
- **Ưu tiên**: P2 · **Gói ngữ cảnh**: CORE + KYDAI
- **Khu vực chạm**: public/img/kydao/ui/* (mới), public/img/NOTICE.txt
- **Thợ**: Claude Sonnet 5.5 (có công cụ Canva) · **Soát**: Điều phối xem ảnh
- **Mục tiêu**: khung nền khẩu hiệu theo từng chủ đề và 8 biểu tượng chủ đề cho bộ chọn; mỗi ảnh ≤ 40 KB, ghi nguồn.

### T-118 · Sân v2: dựng cảnh 3D thật trong Blender (bản mẫu Hỏa Diệm Sơn)
- **Trạng thái**: 🟣 Chờ soát
- **Ưu tiên**: P0 (chủ dự án 13/11: sân v1 chưa đẹp, cần đạt mức chi tiết của sân đấu bài 3D thương mại)
- **Gói ngữ cảnh**: CORE + KYDAI
- **Đặc tả từng bước (BẮT BUỘC làm theo)**: [docs/ky-dai/T-118-DAC-TA-SAN-V2.md](docs/ky-dai/T-118-DAC-TA-SAN-V2.md)
- **Khu vực chạm**: tools/blender/kydao/field2.py (mới), public/img/kydao/fields2/* (mới), docs/ky-dai/anh/*
- **Phụ thuộc**: không · **Thợ**: Claude Sonnet 5.5 (công cụ Blender) · **Soát**: Điều phối xem ảnh, rồi 👤 chủ dự án duyệt
- **Người làm**: Claude Sonnet 5.5 · **Nhánh**: claude/T-118-san-v2
- **Mục tiêu**: một sân mẫu `volcano` là cảnh 3D thật render từ trên xuống (phiến đá từng ô, địa hình, dung nham phát sáng, bóng đổ, cảnh vật quanh bàn), hai bản cờ vua và cờ tướng.
- **Tiêu chí xong**:
  - [x] Hai ảnh 1408×704 đúng khung hình ở đặc tả §2 (đã kiểm bằng 4 khối đỏ: tâm lệch dưới 1 px ở ảnh thử 352×176), mỗi ảnh ≤ 260 KB (chess ~150 KB, xiangqi ~129 KB)
  - [x] Ảnh từng vòng ở `docs/ky-dai/anh/volcano-v2-vong1..3*.jpg`; các điểm tự chấm còn yếu ghi trong báo cáo bàn giao (chờ 👤 duyệt)
  - [x] `field2.py` chạy lại ra cùng kết quả (Cycles, 96 mẫu, GPU OptiX, hạt giống cố định; khử nhiễu có thể lệch vài điểm ảnh)
- **Ghi chú kỹ thuật**: ô SÁNG theo đúng đặc tả (cột từ trái ảnh + hàng từ đường giữa) lẻ; hằng số `LIGHT_PARITY` trong `field2.py` để đảo nếu cần theo quy ước cờ vua (ô góc trái dưới là ô tối). Cường độ dung nham hạ còn 2,8 so với 6–10 ở đặc tả vì AgX làm trắng nhợt; thay Filmic bằng AgX (Blender 5.3 không còn Filmic).
- **Ngoài phạm vi**: 7 sân còn lại (T-118b sau khi duyệt), mã JS, ảnh v1.

### T-119 · Bàn 2D: dải cảnh quanh bàn, ảnh sân v2, quân 2D từ ảnh render
- **Trạng thái**: ⏳ Chờ T-118 và 👤 duyệt bản mẫu. Điều phối viết đặc tả từng bước sau khi có ảnh thật.
- **Ưu tiên**: P0 · **Gói ngữ cảnh**: CORE + KYDAO + KYDAI
- **Khu vực chạm**: public/js/kydao-draw.js, public/js/kydao-ui.js (chỉ `fit`), public/js/kydao-skins.js (điều phối sửa), tools/blender/kydao/build.py (ảnh quân)
- **Mục tiêu**: bàn 2D có dải cảnh vật quanh bàn (tự thu lại trên màn hẹp để ô cờ không nhỏ đi), dùng ảnh sân v2 theo môn; quân cờ vua 2D lấy ảnh render từ mô hình 3D của từng bộ skin.

### T-121 · Bàn 2D: dòng sông sinh động giữa bàn cờ tướng
- **Trạng thái**: 🟣 Chờ soát
- **Ưu tiên**: P0 (chủ dự án 13/11: giữa bàn cờ tướng phải là dòng sông sinh động, hai bên skin gì cũng vậy)
- **Gói ngữ cảnh**: CORE + KYDAO + KYDAI
- **Đặc tả từng bước (BẮT BUỘC làm theo)**: [docs/ky-dai/T-121-DAC-TA-DONG-SONG.md](docs/ky-dai/T-121-DAC-TA-DONG-SONG.md), phần T-121
- **Khu vực chạm**: public/js/kydao-draw.js, public/js/kydao-ui.js (chỉ vòng lặp chuyển động), public/index.html (`?v=`), test/kydao-draw-skins.test.js, test/kydao-draw-river.test.js (mới)
- **Phụ thuộc**: không · **Thợ**: gpt-6.1-terra (Codex CLI qua proxy) · **Soát**: Điều phối chạy test và xem trình duyệt
- **Người làm**: gpt-6.1-terra · **Nhánh**: codex/T-121-dong-song-2d
- **Mục tiêu**: bàn cờ tướng và cờ úp 2D có dòng sông nước chảy, gợn sóng, lá sen trôi ở giữa hai phe.
- **Tiêu chí xong**:
  - [x] Đủ các bước của đặc tả; sông có ở cờ tướng và cờ úp kể cả khi không có skin, không có ở cờ vua
  - [ ] Quân, dấu nước đi, ô chọn luôn nằm trên sông; chữ Sở Hà / Hán Giới đọc rõ (chưa xem trình duyệt)
  - [ ] Giảm chuyển động thì sông đứng yên; `npm run check` và test trong đặc tả đạt
- **Ngoài phạm vi**: luật cờ, giao thức, skin.
- **Ghi chú bàn giao**: Đã thêm sông 2D và test; 5 bộ test trực tiếp đều đạt, 4 file JS sửa qua `node --check`. Chưa xác nhận `npm run check`: sandbox chặn tiến trình con `EPERM`; chưa xem trình duyệt theo yêu cầu.

### T-122 · Bàn 3D: dòng sông sinh động giữa bàn cờ tướng
- **Trạng thái**: 🟣 Chờ soát
- **Ưu tiên**: P0 (chủ dự án 13/11: giữa bàn cờ tướng phải là dòng sông sinh động, hai bên skin gì cũng vậy)
- **Gói ngữ cảnh**: CORE + KYDAO + KYDAI
- **Đặc tả từng bước (BẮT BUỘC làm theo)**: [docs/ky-dai/T-121-DAC-TA-DONG-SONG.md](docs/ky-dai/T-121-DAC-TA-DONG-SONG.md), phần T-122
- **Khu vực chạm**: public/js/world3d/board3d.mjs, test/kydao-board3d.test.js, public/world3d-board.html (`?v=`), public/js/kydao-ui.js (chỉ `?v=` của import)
- **Phụ thuộc**: không · **Thợ**: Claude Sonnet 5.5 · **Soát**: Điều phối chạy test và xem trình duyệt
- **Người làm**: Claude Sonnet 5.5 · **Nhánh**: `claude/T-122-dong-song-3d`
- **Mục tiêu**: bàn cờ tướng và cờ úp 3D có mặt nước chảy ở dải giữa thay cho dải gỗ.
- **Tiêu chí xong**:
  - [x] Đủ các bước của đặc tả; sông có ở cờ tướng và cờ úp kể cả khi không có skin, không có ở cờ vua
  - [x] Quân, dấu nước đi, ô chọn luôn nằm trên sông; chữ Sở Hà / Hán Giới đọc rõ
  - [x] Giảm chuyển động thì sông đứng yên; `npm run check` và test trong đặc tả đạt
- **Ngoài phạm vi**: luật cờ, giao thức, skin.

### T-120 · Bản mẫu nhân vật 3D dựng bằng Blender, đo hiệu năng
- **Trạng thái**: ⏳ Chờ T-111 · 👤 chủ dự án duyệt bản mẫu trước khi làm tiếp T-121 → T-125 (trang phục, tóc, hào quang 9 bậc, pháp tướng, NPC)
- **Ưu tiên**: P1 · **Gói ngữ cảnh**: CORE + HALL + KYDAI
- **Khu vực chạm**: tools/blender/avatar/* (mới), public/models/avatar/* (mới), public/world3d-avatar.html (thêm cột so sánh)
- **Mục tiêu**: một nhân vật nam + một nữ dựng bằng Blender (có xương, đi/đứng/ngồi/lạy), một bộ trang phục, một hào quang dạng lưới 3D; đặt cạnh nhân vật dựng bằng mã để so.
- **Tiêu chí xong**:
  - [ ] ≤ 1.200 tam giác mỗi nhân vật, `.glb` ≤ 180 KB; 60 nhân vật trên màn vẫn ≥ 30 khung/giây ở mức Thấp (số đo trong bàn giao)
  - [ ] Ảnh so sánh cũ/mới gửi chủ dự án; **chưa** thay `avatar.mjs`
- **Ngoài phạm vi**: thay nhân vật trong game.

---

## Đợt Pháp Tướng 3D · đài sen, hào quang bao phủ, quỷ hộ thân

Thiết kế, hợp đồng mã, ngân sách và định tuyến mô hình: [docs/KE-HOACH-PHAP-TUONG-3D.md](docs/KE-HOACH-PHAP-TUONG-3D.md) (đọc §0, §1, §2 trước khi làm bất kỳ thẻ nào dưới đây). Trước khi giao mỗi thẻ, Điều phối viết đặc tả chi tiết vào `docs/phap-tuong/T-xxx-DAC-TA.md` theo mẫu `docs/ky-dai/T-115-DAC-TA.md` (file, chuỗi để tìm chỗ sửa, mã mẫu, lệnh kiểm). Quy tắc chung của đợt: **chỉ T-144 được chạm `public/js/world3d/avatar.mjs`**; không đổi máy chủ, giao thức, `hall.js`, bản 2D.

### T-140 · Bảng ý tưởng hình: 4 quỷ hộ thân, đài sen, hào quang
- **Trạng thái**: 🟣 Chờ soát (Điều phối đã xem tận mắt 6 ảnh, 14/11)
- **Ưu tiên**: P0 · **Gói ngữ cảnh**: CORE + HALL
- **Khu vực chạm**: docs/phap-tuong/anh/* (mới), docs/phap-tuong/BANG-Y-TUONG.md (mới)
- **Người làm**: Điều phối gọi `gpt-image-2.6` (`/v1/images/edits`, có ảnh tham chiếu; không cần dự phòng); `gemini-4-hydrogen-xhigh` soạn phiếu chấm · **Nhánh**: claude/game-graphics-3d-redesign-9b309a
- **Mục tiêu**: có hình chuẩn ba mặt cho người dựng mô hình, bám sát ảnh 2D đang có.
- **Tiêu chí xong**:
  - [x] Mỗi cấp quỷ (1 đến 4) một tấm ba mặt trước / nghiêng / sau, nửa thân trên, dưới tan thành khói; lấy `public/img/fx/demon-N.webp` làm ảnh tham chiếu; đúng bảng màu ở KE-HOACH-PHAP-TUONG-3D §1.1
  - [x] Đài sen: một tấm nhìn nghiêng 30° + nhìn từ trên, ba tầng cánh 16/12/8; ba biến thể vàng, hồng, pha lê (số cánh trong ảnh AI không đếm được chính xác 16/12/8; kịch bản Blender dựng đúng số)
  - [x] Hào quang: vỏ khí ôm người bậc 1, bậc 5 và quang bối bậc 6 gộp trong một tấm ba ô
  - [x] `BANG-Y-TUONG.md` ghi lời nhắc đã dùng, mô hình, ngày; kèm **phiếu chấm hình** (6 mục, thang 1 đến 5) để soát ảnh render ở T-142, T-145
  - [x] Lời nhắc không nêu tên nhân vật hay tác phẩm nào khác; đã thử `gemini-4-hydrogen-xhigh` qua Codex CLI (`--sandbox read-only`, có ảnh đính kèm): **dùng được**, tự đọc file, nhìn được ảnh (BANG-Y-TUONG §5)
- **Ngoài phạm vi**: đưa ảnh vào `public/`.

### T-141 · Khung hiệu ứng 3D `fx3d` và ba vật liệu
- **Trạng thái**: 🟣 Chờ soát. Điều phối soát 14/11: `npm run check` sạch (180 file), `node --test test/world3d-fx.test.js` 16/16; đọc mã `index.mjs`, `materials.mjs` khớp đặc tả; mở `/world3d-fx.html` trong trình duyệt (máy chủ thật, cổng 3141): hình khối tạm hiện đủ quỷ, sen, vỏ khí, không lỗi console, ~3.000 tam giác, 51 lượt vẽ.
- **Ưu tiên**: P0 · **Gói ngữ cảnh**: CORE + HALL
- **Khu vực chạm**: public/js/world3d/fx3d/index.mjs, assets.mjs, materials.mjs, placeholder.mjs (mới), public/world3d-fx.html (mới, trang thử), test/world3d-fx.test.js (mới)
- **Người làm**: gpt-6.1-sol (Codex CLI qua proxy, 1 vòng) · đặc tả [docs/phap-tuong/T-141-DAC-TA.md](docs/phap-tuong/T-141-DAC-TA.md) · **Nhánh**: claude/game-graphics-3d-redesign-9b309a
- **Mục tiêu**: có khung nhận trạng thái nhân vật và vẽ hiệu ứng 3D, kèm ba vật liệu dùng chung, chạy được trên trang thử với hình khối tạm (hình cầu, hình trứng) khi chưa có `.glb`.
- **Tiêu chí xong**:
  - [x] `createFx3d(host, opts)` đúng hợp đồng ở KE-HOACH-PHAP-TUONG-3D §2.1: `update(state, dt, ctx)`, `covers`, `setQuality`, `dispose` (thêm `setReducedMotion`); phần con đăng ký qua `register(name, factory)`
  - [x] `assets.mjs`: `load(url)` có bộ đệm theo URL và đếm tham chiếu (`release`), GLTFLoader + SkeletonUtils.clone; lỗi hoặc 404 trả `null`, không ghi console (có test)
  - [x] `materials.mjs`: `spiritMaterial`, `flameShellMaterial({ color, height, displace, opacity, side })` (vỏ hai lớp làm bằng hai lưới, không dùng tham số `layers`), `glowMaterial`; ảnh nhiễu 64×64 sinh bằng mã, dùng chung
  - [x] Trang thử `/world3d-fx.html`: đủ bảng chọn, 4 nút góc nhanh, chế độ đêm, kéo để xoay (xem tận mắt)
  - [x] Test: `assets` giả trả `null` thì `covers` toàn `false`; `dispose` gọi `dispose()` trên mọi geometry, material đã tạo; giảm chuyển động thì không tạo `THREE.Points`
  - [x] `npm run check` sạch; `node --test test/world3d-fx.test.js` đạt
  - [ ] Soát chéo bằng gemini-4-argon-high: chưa làm (Điều phối tự đọc mã)
- **Ngoài phạm vi**: chạm `avatar.mjs`; mô hình thật.

### T-142 · Bản mẫu Blender: Ma Vương, đài sen vàng, vỏ khí bậc 5
- **Trạng thái**: 🟣 Chờ soát (👤 chờ chủ dự án duyệt hình). Kết quả soát hình ở [docs/phap-tuong/T-142-SOAT-HINH.md](docs/phap-tuong/T-142-SOAT-HINH.md): Ma Vương 4,00/5 (vừa đạt theo thợ soát; Điều phối thấy còn thô, thua ảnh 2D), đài sen 3,83/5 (**chưa đạt**, gần ngưỡng), vỏ khí nhận.
- **Ưu tiên**: P0 · **Gói ngữ cảnh**: CORE + HALL + KYDAI
- **Khu vực chạm**: tools/blender/fx/build_demon.py, build_lotus.py, build_aura.py, README.md (mới), public/models/fx/demon-4.glb, lotus.glb, aura-kit.glb (mới, sinh bởi công cụ), docs/phap-tuong/anh/* (ảnh render), docs/phap-tuong/T-142-SOAT-HINH.md
- **Người làm**: kịch bản Ma Vương gpt-6.1-sol (3 vòng); đài sen gpt-6.1-terra (3 vòng; lượt đầu và một lượt vòng 2 hỏng vì gọi apply_patch qua PowerShell, chạy lại) rồi Claude Sonnet 5.5 viết lại phần dựng cánh (dự phòng sau 3 vòng); vỏ khí + README gpt-6.1-terra (1 vòng); Điều phối chạy Blender 5.3, sửa vặt tên engine `BLENDER_EEVEE_NEXT` → `BLENDER_EEVEE`; `gemini-4-hydrogen-xhigh` chấm 3 vòng · đặc tả [docs/phap-tuong/T-142-DAC-TA.md](docs/phap-tuong/T-142-DAC-TA.md) · **Nhánh**: claude/game-graphics-3d-redesign-9b309a
- **Mục tiêu**: ba tài nguyên 3D đầu tiên đạt phiếu chấm hình, đúng ngân sách.
- **Tiêu chí xong**:
  - [x] Kịch bản theo quy ước của `tools/blender/avatar/build.py`: biến `REPO`, `OUT`, `PREVIEW`; cảnh riêng, không lưu `.blend`, hạt giống cố định; `OUT=['check']` in số tam giác và dung lượng (đã chạy cả ba bằng `blender -b --factory-startup`)
  - [x] Ma Vương: 3.530 tam giác, 250 KB; 17 xương, 8 clip đúng tên; `COLOR_0` + `COLOR_1` có trong `.glb` (đọc lại tệp); gốc ở thắt lưng, mặt nhìn +Z
  - [x] Đài sen: 808 tam giác, 36 KB; bốn nút `petals0`, `petals1`, `petals2`, `pod`; vật liệu `petal`, `pod`
  - [x] `aura-kit.glb`: lưới `shell` hình trứng 320 tam giác, 10 KB, UV chạy dọc
  - [ ] Ảnh 4 góc của từng tài nguyên: có; phiếu chấm ≥ 4/5: **Ma Vương đạt vừa ngưỡng, đài sen chưa đạt (3,83)**
  - [x] Hiện đúng trên `/world3d-fx.html` (ảnh trong T-142-SOAT-HINH.md)
- **Ngoài phạm vi**: quỷ cấp 1 đến 3; sen hồng, sen pha lê (chỉ khác vật liệu, làm ở T-146).

### T-143 · Toán hành vi quỷ hộ thân `stand-math.js`
- **Trạng thái**: 🟣 Chờ soát. Điều phối soát 14/11: `npm run check` sạch, `node --test test/stand-math.test.js` 10/10; thử làm hỏng (bỏ nhánh vái, đổi giảm chấn c = 1) thì test đỏ. Điều phối sửa vặt: `slots` nhận `list` không phải mảng, thêm chú thích đầu file.
- **Ưu tiên**: P0 · **Gói ngữ cảnh**: CORE + HALL
- **Khu vực chạm**: public/js/stand-math.js (mới, UMD thuần như `view-math.js`), test/stand-math.test.js (mới)
- **Người làm**: gpt-6.1-terra (Codex CLI qua proxy, 1 vòng) · đặc tả [docs/phap-tuong/T-143-DAC-TA.md](docs/phap-tuong/T-143-DAC-TA.md) · **Nhánh**: claude/game-graphics-3d-redesign-9b309a
- **Mục tiêu**: mọi phép tính của hành vi quỷ nằm trong một module thuần, test được bằng node.
- **Tiêu chí xong**:
  - [x] `ANCHOR[n]` (chỗ đứng và chiều cao của 4 cấp, đúng bảng §1.1); `spring(pos, vel, target, dt, k = 18, c = 7)` trả `{ pos, vel }` (thêm `springVec`, `turn` cho quay trễ 0,25 giây)
  - [x] `poseOf(state)` trả một trong `sit | scoff | peek | drift | idle` theo ưu tiên ngồi > vái > nói > đi > đứng; `phaseOf(prevN, n, t)` trả `emerge | steady | vanish`
  - [x] `tauntOf(id, now)` trả `null | 'taunt1' | 'taunt2'`, ổn định theo hạt giống `id + floor(now / 10000)`
  - [x] `slots(list, self, quality, kind)` trả tập id được cấp suất 3D: luôn có mình, còn lại theo khoảng cách, số lượng đúng bảng §2.4 (`kind` = `demon` hoặc `aura`)
  - [x] Không đụng DOM, không phụ thuộc gì, dùng được cả bằng `require` lẫn `<script>` (AGENTS §3.10; test chạy bằng `vm` không có `module`)
  - [x] Test: lò xo hội tụ dưới 1 cm sau 1,5 giây và không vọt quá 15%; `dt` lớn (0,5 giây) không phát nổ; đủ các nhánh ưu tiên; `slots` đúng số lượng ở ba mức
  - [ ] Soát chéo bằng gpt-6.1-sol: chưa làm (để dành hạn mức GPT cho T-141, T-142, T-144; Điều phối tự đọc mã)
- **Ngoài phạm vi**: Three.js.

### T-144 · Nối bản mẫu vào nhân vật sau công tắc `ta-fx3d`
- **Trạng thái**: 🟣 Chờ soát · 👤 **chủ dự án duyệt bản mẫu** trước khi làm T-145 → T-149. Điều phối soát 14/11: `npm run check` sạch (183 file); `node --test test/world3d-avatar.test.js test/world3d-fx.test.js test/hall-view3d.test.js test/world3d-avatar-glb.test.js test/stand-math.test.js` 71/71; `npm test` 1001 đạt, 0 trượt, 3 bỏ qua (trước đợt: 962/0/3). Đọc toàn bộ diff `avatar.mjs`, `index.mjs`: đúng 6 chỗ nối + `?v=`. Xem trong game thật (máy chủ cục bộ cổng 3141, Tàng Kinh Các 3D): bật công tắc thấy Ma Vương 3D sau lưng, sen vàng, vỏ khí; tắt thì y như cũ.
- **Ưu tiên**: P0 · **Gói ngữ cảnh**: CORE + HALL
- **Khu vực chạm**: public/js/world3d/avatar.mjs (điểm nối `fx3d`, điều kiện `covers`, nhãn tên vẽ sau cùng), public/js/world3d/fx3d/demon.mjs, lotus.mjs, aura.mjs (mới), public/js/world3d/index.mjs (khoảng cách, suất), avatar-glb.mjs, scenes/arena.mjs, scenes/yard.mjs, view3d-ui.js, world3d-test.html, world3d-avatar.html (chỉ `?v=`), public/world3d-fx.html, public/index.html (stand-math, `?v=`), test/world3d-avatar.test.js, test/world3d-fx.test.js
- **Người làm**: gpt-6.1-sol (Codex CLI qua proxy, 1 vòng) · đặc tả [docs/phap-tuong/T-144-DAC-TA.md](docs/phap-tuong/T-144-DAC-TA.md) · **Nhánh**: claude/game-graphics-3d-redesign-9b309a. Điều phối sửa vặt sau khi xem trình duyệt: viền Fresnel quỷ `#ff7a1a` → `#a8300c` (trước đó cả con quỷ thành khối cam trong suốt); nhãn tên `renderOrder = 6` (trước bị quỷ che); quỷ của chính mình mờ sớm hơn (từ 2,5 m, tối thiểu 30%) vì ở góc thứ ba máy quay ngay sau lưng, Ma Vương che kín nhân vật.
- **Mục tiêu**: bật `localStorage['ta-fx3d'] = '1'` thì trong game thật thấy Ma Vương 3D đứng sau lưng như linh thể hộ thân, đài sen vàng 3D, vỏ khí bậc 5; tắt thì y như hiện nay.
- **Tiêu chí xong**:
  - [x] `demon.mjs` dùng `stand-math.js`: trồi lên, bám theo có trễ (lò xo), quay theo trễ 0,25 giây, clip theo tư thế (đi `drift`, vái `scoff`, nói `peek`, đứng `idle` + `taunt`), tan khi hết; `state.demon.alpha` điều khiển độ đặc (có test vị trí; hoạt ảnh từng clip **chưa xem tận mắt** trong trình duyệt vì khung xem bị ẩn, chỉ xem ảnh tĩnh)
  - [x] `covers.x = true` thì `avatar.mjs` không tạo sprite của phần đó; `.glb` lỗi thì sprite hiện như cũ (có test)
  - [x] Góc nhìn thứ nhất: ẩn hiệu ứng của chính mình (`hidden`, có test); giảm chuyển động: tư thế tĩnh, không hạt (có test)
  - [ ] Thứ tự vẽ đúng ở 4 góc: đã chụp trước / xéo / sau trên `/world3d-fx.html`; **lỗi thấy được**: nhìn từ sau thấy mắt và răng phát sáng của quỷ xuyên qua đầu (lớp phát sáng không bị che); chưa có ảnh góc ngang tin cậy
  - [x] `npm run check` sạch; test khu vực 71/71; `npm test` 1001/0/3, không giảm
  - [ ] Ảnh gửi chủ dự án: có ảnh trong game bật/tắt (docs/phap-tuong/anh/game-ta-fx3d-*.jpg) nhưng trên **nhân vật thử** (đặt công đức/hào quang chỉ ở trình duyệt), **không** phải Hắc Phong Ma Khách (NPC chọn ngẫu nhiên theo đợt, lúc thử không xuất hiện ở Tàng Kinh Các); chưa có đoạn quay
- **Ngoài phạm vi**: bật mặc định; quỷ cấp 1 đến 3.

### T-145 · Quỷ cấp 1, 2, 3 dạng 3D
- **Trạng thái**: ⏳ Chờ T-144 và 👤 duyệt bản mẫu · **Ưu tiên**: P1 · **Gói ngữ cảnh**: CORE + HALL + KYDAI
- **Khu vực chạm**: tools/blender/fx/build_demon.py, public/models/fx/demon-1.glb, demon-2.glb, demon-3.glb, public/js/world3d/fx3d/demon.mjs (bảng theo cấp), docs/phap-tuong/anh/*
- **Người làm**: — (gợi ý: gpt-6.1-sol; chấm hình: gemini-4-hydrogen-xhigh) · **Nhánh**: —
- **Tiêu chí xong**:
  - [ ] Ba mô hình đúng ngân sách §2.4; cấp 2 và 3 dùng chung xương và clip với cấp 4; cấp 1 xương rút gọn, ngồi trên vai, có clip `peek` riêng
  - [ ] Cấp 2 cánh dơi đập chậm (xương `wing.L/R`); cấp 3 có lớp lửa tím đen (vỏ khí nhỏ quanh thân)
  - [ ] Phiếu chấm hình ≥ 4/5 cho từng cấp; ảnh 4 góc
  - [ ] Đổi cấp trong lúc đang hiện (công đức tụt mốc): quỷ cũ tan, quỷ mới trồi lên
- **Ngoài phạm vi**: `avatar.mjs`.

### T-146 · Đài sen 3D đủ ba biến thể, nở sen
- **Trạng thái**: ⏳ Chờ T-144 và 👤 duyệt · **Ưu tiên**: P1 · **Gói ngữ cảnh**: CORE + HALL
- **Khu vực chạm**: public/js/world3d/fx3d/lotus.mjs, public/js/world3d/fx3d/materials.mjs (thêm vật liệu ngọc, pha lê), test/world3d-fx.test.js
- **Người làm**: — (gợi ý: gpt-6.1-terra; soát: gpt-6.1-sol) · **Nhánh**: —
- **Tiêu chí xong**:
  - [ ] Sen vàng (bậc 2 đến 7), sen hồng trong mờ (bậc 8), sen pha lê đổi màu theo góc nhìn (bậc 9), chung `lotus.glb`
  - [ ] Nở sen 1,2 giây khi hào quang bật hoặc lên bậc (ba tầng xòe lần lượt); giảm chuyển động thì hiện sẵn dạng nở
  - [ ] Nhân vật đứng và ngồi trên gương sen không xuyên cánh, kể cả khi ngồi bồ đoàn, ghế đá (kiểm ba tư thế trên trang thử)
  - [ ] Đốm sáng bay lên ở mức Vừa trở lên; kích thước tăng theo bậc như 2D (`72 + (tier - 2) * 3.5`)
- **Ngoài phạm vi**: `avatar.mjs`.

### T-147 · Hào quang bao phủ 3D bậc 1 đến 5
- **Trạng thái**: ⏳ Chờ T-144 và 👤 duyệt · **Ưu tiên**: P1 · **Gói ngữ cảnh**: CORE + HALL
- **Khu vực chạm**: public/js/world3d/fx3d/aura.mjs, tools/blender/fx/build_aura.py và public/models/fx/aura-kit.glb (thêm vầng sáng, nguyên anh), test/world3d-fx.test.js
- **Người làm**: — (gợi ý: gpt-6.1-terra; soát: gpt-6.1-sol) · **Nhánh**: —
- **Tiêu chí xong**:
  - [ ] Đúng bảng §1.3 cho bậc 1 đến 5: vỏ khí theo màu bậc, 3 dải khí lành bay vòng thật quanh thân, kim đan, vầng sáng sau đầu gắn xương đầu, nguyên anh có vệt đuôi, thần quang hai lớp
  - [ ] Mờ dần 20 giây cuối theo `fade`; hết hạn thì tắt đúng giờ máy chủ (`state.now`)
  - [ ] Mỗi bậc một ảnh chụp 2 góc trên trang thử, đặt cạnh ảnh 2D cùng bậc
- **Ngoài phạm vi**: bậc 6 đến 9; `avatar.mjs`.

### T-148 · Hào quang bao phủ 3D bậc 6 đến 9
- **Trạng thái**: ⏳ Chờ T-147 (chung `aura.mjs`) · **Ưu tiên**: P1 · **Gói ngữ cảnh**: CORE + HALL
- **Khu vực chạm**: public/js/world3d/fx3d/aura.mjs, tools/blender/fx/build_aura.py và aura-kit.glb (thêm quang bối), test/world3d-fx.test.js
- **Người làm**: — (gợi ý: gpt-6.1-terra; soát: gemini-4-argon-high) · **Nhánh**: —
- **Tiêu chí xong**:
  - [ ] Quang bối chạm nổi có trời sao thị sai; năm ngũ hành châu quỹ đạo nghiêng; cột sáng + cánh sen rơi vẽ theo lô (`InstancedMesh`, tối đa 24 cánh); tia sét bậc 9 đổi hình mỗi lần giáng, nhịp như 2D
  - [ ] Giảm chuyển động: không sét chớp, không cánh rơi; mức Thấp: bỏ cột sáng và cánh rơi
  - [ ] Ảnh chụp như T-147
- **Ngoài phạm vi**: `avatar.mjs`.

### T-149 · Pháp tướng công đức 6 bậc dạng 3D
- **Trạng thái**: ⏳ Chờ T-144 và 👤 duyệt · **Ưu tiên**: P2 · **Gói ngữ cảnh**: CORE + HALL + KYDAI
- **Khu vực chạm**: tools/blender/fx/build_merit.py, public/models/fx/merit-kit.glb, public/js/world3d/fx3d/merit.mjs, test/world3d-fx.test.js
- **Người làm**: — (gợi ý: gpt-6.1-sol; chấm hình: gemini-4-hydrogen-xhigh) · **Nhánh**: —
- **Tiêu chí xong**:
  - [ ] Sáu bậc đúng `MERIT.RANKS`: vòng linh quang, vương miện sen pha lê, đôi cánh lửa (vỗ bằng xương), bánh xe kiếm, pháp luân rồng hai vòng xoay ngược, thánh luân chín tầng
  - [ ] Tổng ≤ 3.000 tam giác, `.glb` ≤ 180 KB; cộng hưởng màu với hào quang cúng dường (`tint`) như 2D
  - [ ] Công đức đúng 666: không hiện pháp tướng, hiện Ma Vương (giữ luật hiện có)
- **Ngoài phạm vi**: `avatar.mjs`.

### T-150 · Chia suất 3D, mức chất lượng, đo hiệu năng
- **Trạng thái**: ⏳ Chờ T-145 → T-148 · **Ưu tiên**: P1 · **Gói ngữ cảnh**: CORE + HALL
- **Khu vực chạm**: public/js/world3d/fx3d/budget.mjs (mới), fx3d/index.mjs, public/js/world3d/index.mjs (gọi `slots` mỗi 0,5 giây), public/world3d-fx.html (chế độ 60 nhân vật)
- **Người làm**: — (gợi ý: gpt-6-luna; soát: gpt-6.1-sol) · **Nhánh**: —
- **Tiêu chí xong**:
  - [ ] Suất đúng bảng §2.4 ở ba mức; đổi suất không giật (mờ chéo 0,3 giây giữa sprite và 3D)
  - [ ] `.glb` chỉ tải khi trong cảnh có người mang hiệu ứng đó (kiểm bằng thẻ Mạng của trình duyệt)
  - [ ] Số đo trong bàn giao: 60 nhân vật, 10 quỷ, 10 hào quang, ba mức, khung hình/giây và số lượt vẽ; mức Thấp ≥ 30 khung hình/giây
  - [ ] Rời cảnh hoặc `stop()` giải phóng hết (đếm `renderer.info.memory` về mức trước khi bật)

### T-151 · Bật mặc định, ảnh chụp, Sổ tay, README, NOTICE
- **Trạng thái**: ⏳ Chờ T-150 · **Ưu tiên**: P2 · **Gói ngữ cảnh**: CORE + DOCS + OPS
- **Khu vực chạm**: public/js/world3d/fx3d/index.mjs (công tắc `ta-fx3d` thành mặc định bật, `'0'` để tắt), tools/ui-harness (thêm trang `/world3d-fx.html`), README.md, public/js/guide.js (mục hào quang, quỷ), public/img/NOTICE.txt, public/data/NOTICE.txt, docs/agents/ARCHITECTURE.md, public/index.html (`?v=`)
- **Người làm**: — (gợi ý: gemini-3.8-flash-high viết chữ, gpt-6-luna làm ui-harness) · **Nhánh**: —
- **Tiêu chí xong**:
  - [ ] Mặc định bật khi đang ở 3D; máy tự hạ mức thì suất tự giảm theo
  - [ ] Ảnh chụp 4 góc × 4 cấp quỷ × 3 mức; Sổ tay và README có đoạn mô tả ngắn, giọng nhà chùa
  - [ ] NOTICE ghi mô hình tự dựng bằng kịch bản trong `tools/blender/fx/`; ARCHITECTURE thêm thư mục `fx3d/`

### T-152 · (Tùy chọn) Chụp lại ảnh 2D từ mô hình 3D
- **Trạng thái**: ⚪ Hộp thư đến · 👤 chủ dự án quyết có làm không · **Ưu tiên**: P3
- **Ý**: render `demon-N.webp`, `lotus-*.webp` từ mô hình 3D (như T-126a với quân cờ) để bản 2D, bảng xem trước ở Võ Học Các và Sân đấu đồng nhất với 3D. Ảnh hiện tại là hình vẽ tay đẹp, chỉ nên thay khi bản render không kém hơn.

### T-154 · Nâng chất bản mẫu: Ma Vương điêu khắc, thân đặc có khối, vỏ khí ra lửa
- **Trạng thái**: ✅ Xong ở mức bản nháp · PR #68 (chủ dự án bảo merge sớm 14/11 để giữ mã; nghiệm thu độc lập: mã đạt, hình chưa đạt, làm tiếp ở T-203) · vẫn **chặn T-145 → T-149**: soát hình độc lập chấm Ma Vương 2,67/5, đài sen 2,83/5, vỏ khí 2/5 và kết luận trong game bản 3D **còn kém** bản 2D (chi tiết: [docs/phap-tuong/T-154-SOAT-HINH.md](docs/phap-tuong/T-154-SOAT-HINH.md)) · **Ưu tiên**: P0 · **Gói ngữ cảnh**: CORE + HALL + KYDAI
- **Người làm**: Điều phối Claude Opus 5.5; Claude Sonnet 5.5 (vòng 1 Ma Vương và sen, Blender không giao diện); gpt-6.1-sol qua Codex CLI (Ma Vương và sen vòng 2–4, shader và JS hai vòng); gpt-6.1-terra soát hình (Gemini argon/hydrogen/flash bị 403 TOS_VIOLATION). Đặc tả [docs/phap-tuong/T-154-DAC-TA.md](docs/phap-tuong/T-154-DAC-TA.md) · **Nhánh**: claude/T-154-nang-chat-ma-vuong
- **Kiểm (Điều phối tự chạy, sau sửa cuối)**: `npm run check` sạch (183 file); 5 file test khu vực 78/78; `npm test` 1011 test, 1008 đạt, 0 trượt, 3 bỏ qua (PostgreSQL). Xem tận mắt trong trình duyệt thật (`/world3d-fx.html`, game Tàng Kinh Các, Sân đấu).
- **Khu vực chạm**: tools/blender/fx/build_demon.py, build_lotus.py, public/models/fx/*.glb, public/js/world3d/fx3d/materials.mjs, demon.mjs, aura.mjs, public/js/world3d/scenes/arena.mjs (truyền `fx.distance`), test/world3d-fx.test.js
- **Nguồn**: nghiệm thu độc lập đợt 0 ngày 14/11 (Opus) và nhận xét của Điều phối: bật `ta-fx3d` hiện **kém hơn** bản 2D.
- **Tiêu chí xong**:
  - [~] Ma Vương dựng lại theo lối điêu khắc bằng mã (lưới cao ~330.000 tam giác → 3.994 tam giác, bake màu/pháp tuyến/phát sáng 512 px, 461 KB; ngân sách nới lên 600 KB, chờ chủ dự án xác nhận): có ba mắt, sừng lớn cong, hốc miệng có nanh, giáp vai ba phiến, vuốt, nứt dung nham. **Hình chưa đạt**: terra chấm 2,67/5, Điều phối 3/5 so với ảnh 2D (mặt còn gãy đa giác, tay nhỏ)
  - [x] Thân quỷ **đặc** ở ngực, đầu (lượt ghi chiều sâu + `FrontSide`), viền sáng chỉ ở mép (Fresnel theo `nonPerturbedNormal`), nửa dưới tan khói; xem trong trình duyệt ngày và đêm
  - [x] Không nhìn xuyên: nhìn từ sau không thấy mắt, răng (ảnh `fx3d-sau.jpg`); độ rõ 0,12 ra bóng mờ có mắt sáng (`fx3d-alpha-thap.jpg`)
  - [~] Vỏ khí: ba lớp, viền đứt thành sợi lửa, lưỡi lửa mép trên, giữa thân trong, có `colorspace_fragment` (test). Terra chấm 2/5 ("vẫn chủ yếu là quả trứng"); Điều phối 3/5. Muốn ra hình ngọn lửa cần đổi lưới vỏ ở `build_aura.py`
  - [ ] Đài sen ≥ 4/5: **chưa đạt**. Vàng kim ấm, cánh nhọn mũi giáo, 1.196 tam giác (ngân sách nới lên 1.200, chờ xác nhận); terra 2,83/5, Điều phối 3,5/5
  - [x] Sân đấu truyền khoảng cách và suất (C3); thứ tự vẽ theo `groupOrder` từng người (C5, có test); sửa lệch một khung (C7, có test); test tải lỗi rồi tải lại (C4)
  - [ ] Ảnh bật / tắt cùng chỗ (`game-ta-fx3d-bat.jpg`, `game-ta-fx3d-tat.jpg`), hai phương án quỷ của mình (`side` mặc định, `cover`), **👤 chủ dự án duyệt** rồi mới mở T-145 → T-149

### T-203 · Vòng hình 2 Pháp Tướng 3D: quỷ ngoái mặt, mặt và tay Ma Vương, lưới lửa, cánh sen, nhãn tên
- **Trạng thái**: ✅ Xong ở mức bản nháp, chủ dự án bảo merge 14/11 để giữ mã (sau công tắc `ta-fx3d` tắt). Nghiệm thu độc lập Claude Opus 14/11: mã đạt, không lỗi chặn, `npm test` 1077 test, 1074 đạt, 0 trượt, 3 bỏ qua (PostgreSQL); hình Ma Vương 2,5/5, đài sen 3/5, vỏ khí 2/5, trong game còn kém 2D; hai lỗi nên sửa và hai ghi nhận đã vào Hộp thư đến · 👤 chủ dự án chọn hướng hình tiếp (chấm của thợ: CHƯA ĐẠT, xem [docs/phap-tuong/T-203-SOAT-HINH.md](docs/phap-tuong/T-203-SOAT-HINH.md)) · **chặn T-145 → T-149** · **Ưu tiên**: P0 · **Gói ngữ cảnh**: CORE + HALL + KYDAI
- **Khu vực chạm**: tools/blender/fx/build_demon.py, build_lotus.py, build_aura.py, public/models/fx/*.glb, public/js/world3d/fx3d/*.mjs, public/js/stand-math.js, public/js/world3d/avatar.mjs (chỉ nhãn tên), public/js/world3d/index.mjs và scenes/arena.mjs (chỉ phần chia suất), test/world3d-fx.test.js, test/stand-math.test.js, public/world3d-fx.html
- **Người làm**: Claude Opus 5.5 (điều phối), gpt-6.1-sol (thực thi) · **Nhánh**: claude/T-203-vong-hinh-phap-tuong
- **Nguồn**: nghiệm thu độc lập T-154 ngày 14/11 (Ma Vương 2,5/5, đài sen 2,5/5, vỏ khí 2/5; trong game bật còn kém tắt). Công tắc `ta-fx3d` vẫn mặc định tắt.
- **Tiêu chí xong**:
  - [x] **Quỷ của chính mình ngoái mặt về máy quay** ở góc nhìn thứ ba: thân xoay nghiêng khoảng 3/4, đầu quay về phía máy quay, đứng lệch sau vai, nằm gọn trong khung (không bị cắt mép) ở khoảng cách máy quay mặc định; quỷ của người khác vẫn quay theo chủ. Toán nằm ở `stand-math.js`, có test · _Đạt ở Tàng Kinh Các (máy quay ~3,1 m); quỷ tự thu nhỏ khi máy quay sát người, Sân đấu (~1 m) vẫn bị cắt một phần sừng_
  - [ ] Ma Vương: tay và bàn tay to, cơ bắp như ảnh 2D; đầu lớn hơn, mặt không lộ đa giác khi nhìn gần; giáp vai rõ khối; lửa sau vai là khối lửa có thể tích (không phải dải phẳng), nhìn từ sau không thành vệt trắng; ảnh pháp tuyến không ra vệt khối (PNG hoặc JPEG chất lượng cao hơn, vẫn ≤ 600 KB) · _Làm một phần: tay, đầu, giáp vai, lửa ống kín, pháp tuyến JPEG 97 + TANGENT, 4.000 tam giác, 565 KB; mặt còn gãy mặt phẳng khi nhìn gần, bàn tay chưa xòe ngón rõ (terra 2,58/5)_
  - [x] Đài sen: cánh sen tròn đầy, cong hai chiều, có gân, ba tầng 16/12/8 đọc ra là hoa sen (không phải vương miện gai); vàng ấm có ánh sáng như `public/img/fx/aura/lotus-gold.webp`; ≤ 1.200 tam giác · _1.200 tam giác, 40,4 KB; terra 3,33/5 (đọc ra sen 4/5)_
  - [x] Vỏ khí: đổi lưới trong `build_aura.py` thành hình ngọn lửa (đáy rộng ôm chân, thắt dần, đỉnh xé thành nhiều lưỡi); không cháy trắng khi máy quay gần (qua tone mapping hoặc hạ cường độ); số lớp khớp bảng §2.4 (sửa mã hoặc sửa bảng cho khớp nhau) · _Lưới giọt lửa sáu thùy 400 tam giác; trộn thường + tone mapping + mờ khi máy quay < ~2,6 m; bảng §2.4 sửa thành ba lớp ở mức Cao. Terra chấm dáng lửa 2/5_
  - [x] Hạt dùng ảnh đốm tròn mềm sinh bằng mã (hết ô vuông trắng)
  - [x] Nhãn tên và bong bóng chat không bị thân quỷ cắt và không bị lửa đè (ví dụ `depthTest: false` hoặc vẽ sau cùng), kiểm bằng ảnh nhìn từ sau
  - [x] Lượt ghi chiều sâu theo độ mờ: quỷ đang mờ (0,1 đến 0,55) không che nhãn và ảnh 2D phía sau
  - [x] Chia suất chặt: người ngoài suất quỷ không được bật quỷ 3D dù lọt suất hào quang; có test cho phần Sân đấu truyền khoảng cách và suất
  - [x] `world3d-fx.html` import `placeholder.mjs` đúng số `?v=` mới
  - [ ] Xem tận mắt clip `emerge`; ảnh bật / tắt cùng góc trong game; phiếu chấm hình so trực tiếp với ảnh 2D; **👤 chủ dự án duyệt** rồi mới mở T-145 → T-149 · _Đã có ảnh emerge, ảnh bật/tắt cùng góc, phiếu chấm terra (CHƯA ĐẠT: trong game 3D vẫn kém 2D); chờ 👤 chủ dự án_
- **Ngoài phạm vi**: quỷ cấp 1 đến 3, hào quang bậc khác, bật mặc định, máy chủ, bản 2D.

### T-153 · Nghiệm thu chéo đợt Pháp Tướng 3D
- **Trạng thái**: ⏳ Chờ T-151 · **Ưu tiên**: P1 · **Gói ngữ cảnh**: CORE + HALL
- **Người làm**: — (gợi ý: gemini-4-argon-high soát hình và chữ, gpt-6.1-sol soát mã, Điều phối chốt) · **Nhánh**: —
- **Tiêu chí xong**:
  - [ ] Soát theo checklist ORCHESTRATION §7 trên toàn bộ diff của đợt; lỗi tìm được ghi thành thẻ sửa
  - [ ] Chơi thử game thật: bốn cảnh, hai góc nhìn, ba mức chất lượng, giảm chuyển động, công đức âm dần từ −1 tới −1000, cúng dường thử (`DONATION_MODE=test`) lên đủ 9 bậc
  - [ ] Ghi rõ phần chưa thử được (điện thoại thật, PostgreSQL)

---

## Hộp thư đến (ý tưởng, chưa đủ để giao)

Lấy từ README "Việc nên làm tiếp" và lúc rà repo. Điều phối viết lại thành thẻ đủ trường khi muốn làm.

- ⚪ Pháp Tướng 3D, máy quay sát chủ (nghiệm thu T-203, Claude Opus, 2026-11-14; chỉ lộ khi bật `ta-fx3d`): khi khoảng cách ngang tới máy quay < 0,6 m, `StandMath.selfStand` trả `null`, quỷ của mình trượt về `ANCHOR[4]` ngay trước ống kính với `SELF_SCALE` 1,1 và không mờ (`public/js/world3d/fx3d/demon.mjs` khoảng dòng 106–116 và 168; ở chế độ ngoái mặt `near` luôn bằng 1). Sửa: giữ chỗ đứng gần nhất hoặc dùng cỡ nhỏ nhất và cho mờ; thêm test kiểm cỡ và độ mờ (test `world3d-fx.test.js` hiện chỉ chốt "về neo cũ"). Gói: CORE + HALL.
- ⚪ Pháp Tướng 3D, suất của pháp tướng công đức (nghiệm thu T-203, 2026-11-14): `fx3d/index.mjs` gộp lotus, aura và merit vào khoá `aura` của `StandMath.fxSlots`, nên người có bậc công đức mà không có hào quang luôn nhận `aura:false` và không bao giờ thấy merit 3D. Tách suất riêng cho merit **trước khi mở T-145 → T-149**. Gói: CORE + HALL.
- ⚪ Pháp Tướng 3D, nhãn tên xuyên tường (nghiệm thu T-203, 2026-11-14): `avatar.mjs` tắt `depthTest` của nhãn tên và bong bóng khi người đó có hiệu ứng 3D, nên nhãn hiện xuyên tường, cột. 👤 chấp nhận, hoặc đổi sang vẽ sau cùng mà vẫn kiểm chiều sâu với vật đục. Gói: CORE + HALL.
- ⚪ `public/world3d-scene-arena.html` import `kit.mjs?v=1` trong khi các chỗ khác dùng `?v=2` (có từ trước T-203; nghiệm thu T-203 phát hiện 2026-11-14). Gói: CORE.
- ✅ (đã làm ở T-127, PR #61: huy hiệu hiện trong bộ chọn và cạnh khẩu hiệu) Dùng huy hiệu chủ đề `public/img/kydao/ui/crest-<id>.webp` trong bộ chọn "Lãnh địa" (cạnh tên sân) và cạnh khẩu hiệu khai mở (`.kdfx-banner`). Gói: KYDAI. Thợ gợi ý: gpt-6-luna.
- ⚪ `public/js/app.js:561–562` ghép `cfg.kinds`, `cfg.tracks` từ máy chủ vào `innerHTML` (mã có từ trước đợt Kỳ Đài; GPT Sol phát hiện 2026-11-13). Dựng phần tử và gán chữ bằng `textContent`. Gói: CORE. Trái bất biến AGENTS.md §3.5.
- ✅ (đã làm ở T-179, PR #70) Thêm 3 ca test cho `kd:skin` (soát T-110, Gemini 4 Argon, 2026-11-13): (1) gọi `skin` khi đồng hồ vừa quá hạn mà hẹn giờ chưa nổ (nhánh `expired` trong `lib/kydao/manager.js`); (2) e2e gọi `kd:skin` khi đang ở Chánh điện để ghim `where: 'any'`; (3) gửi `field` giữ nguyên + `pieces` mới khi `field` còn trong hạn 20 giây. Gói: KYDAO + KYDAI. Thợ gợi ý: gpt-6-luna.
- ⚪ Cờ vua: nhận diện thế cờ chết tổng quát (hàng rào Tốt khóa có Tốt phụ, ví dụ FEN `4k3/8/8/p1p1p1p1/P1P1P1P1/P7/8/4K3 w - - 0 1`); hiện chỉ có 4 ca thiếu quân + một mẫu hàng rào đúng khớp. Đổi tên biến tiếng Việt (`ten`, `ca`, `ds`) trong test sang tiếng Anh. Gói: KYDAO. (Soát T-021, 2026-11-11.)
- ⚪ Chưa có test nào cho `lib/moderation.js` (`checkMessage`, `checkName`, `clean`), trong khi đây là bất biến AGENTS.md §3.6 (chặn link, dãy số chống lừa đảo). Thêm test cả ca dương và ca âm ("chim cút", "đi ngủ" không bị bắt). Gói: SOCIAL. (Soát T-003 phát hiện 2026-11-11.)
- 👤 Thu âm bài tụng thật của chư tăng chùa đối tác (có sự đồng ý), thay giọng tổng hợp. Gói: CHANT.
- Chuyển trạng thái sang Redis để chạy nhiều máy chủ. Gói: STORE + OPS. Cần thiết kế trước (dùng skill/ADR), thẻ lớn.
- Chia phòng "Chánh điện 1, 2…" khi quá 300 người. Gói: HALL + PLACE + SOCIAL. Cần thiết kế trước.
- 👤 Hỏi luật sư về Nghị định 147/2024/NĐ-CP (mạng xã hội) và bảo vệ dữ liệu cá nhân trước khi mở rộng.
- 👤 Xin phép người giữ bản quyền tài liệu Trần Đại Sỹ (Dịch Cân Kinh) trước khi phát hành rộng.
- Gom hằng số PK về một nguồn (`lib/pk/rules.js` gửi qua `/api/config`) thay vì chép tay ở `martial.js` và `arena.js`. Làm sau T-005. Gói: PK.
- **Sau đợt 2026-11** (chi tiết ở KH §5.10 và §9; Điều phối viết thành thẻ đủ trường khi chủ dự án chọn):
  - T-036 Học luật tương tác 5 môn cờ. Gói: KYDAO. Thợ gợi ý: Gemini Flash (nội dung) + Sonnet (giao diện).
  - T-037 Sư Kỳ: đối thủ máy chạy trên trình duyệt (Web Worker, 3 mức, chỉ giao hữu). Gói: KYDAO. Thợ gợi ý: Codex.
  - T-038 Cờ thế mỗi ngày (kho Lichess CC0 cho cờ vua, thế cổ cho cờ tướng). Gói: KYDAO. Thợ gợi ý: Gemini Flash + Sonnet.
  - T-039 Xem lại và chia sẻ ván (PGN, biên bản cờ tướng kiểu Việt). Gói: KYDAO.
  - Kỳ Hội Rằm (giải cờ tướng nhanh đêm Rằm). Gói: KYDAO + RANK.
  - Thời khóa tu tập + chuỗi chuyên cần. Gói: RITUAL.
  - Lễ hội theo âm lịch (hoa đăng Rằm, Vu Lan, Phật Đản, Tết xin chữ). Gói: HALL + RITUAL + FORTUNE (lịch âm).
  - Thiền chung theo giờ ở Tàng Kinh Các. Gói: LIBRARY.
  - Gieo quẻ Kinh Dịch ở bàn thầy tử vi. Gói: FORTUNE.
  - Mèo chùa (bí mật). Gói: HALL.
  - Sư huynh dẫn đường, Pháp danh, Cây bồ đề chung, Đố vui văn hóa chùa, Nhịp mõ. Gói: RITUAL / SOCIAL.
  - Map "Kỳ Viên" khi 4 bàn ở sân thường xuyên kín (> 70% giờ cao điểm trong 1 tuần). Gói: HALL + KYDAO + NAV.
  - Mở rộng xin xăm lên 100 quẻ (lời viết mới). Gói: FORTUNE.
  - Ảnh lá tarot từ bản quét Rider–Waite–Smith 1909 (phạm vi công cộng). Gói: FORTUNE.
  - 👤 Ghi nguồn ảnh hai thầy bói và ảnh chánh điện ở sân (`public/img/readers/*`, `public/img/courtyard/chanh-dien.webp`) vào `public/img/NOTICE.txt` (đang thiếu, AGENTS.md §3.14). Gói: DOCS.

---

## Đã xong

| Thẻ | Việc | Ngày | PR / commit |
|---|---|---|---|
| T-001 | NPC Obito chibi và bí kíp ẩn (gộp từ `codex/obito-bi-kip-an`, sprite 62 KB) | 2026-11-10 | PR #21 (merge `80f4250`) |
| T-000 | Chuẩn hóa context cho agent: `AGENTS.md`, `CLAUDE.md`, `docs/agents/{ARCHITECTURE,CONTEXT-PACKS,ORCHESTRATION}.md`, `task.md` | 2026-11-10 | commit trên `main` ("Chuẩn hóa context cho agent…") |

---

## Baseline

**Ngày**: 2026-11-11 · **Cơ sở**: `c7a50ac` (nhánh `claude/T-003-baseline-test`) · **Máy**: Windows 11, **Node v25.0.0**, npm 11.6.2. Không có Node 22 trên máy nên các số dưới đây **không phải Node 22**; baseline Node 22 sẽ do CI (T-006) chạy.

| Lệnh | Kết quả | Thời gian |
|---|---|---|
| `npm ci` | thành công, 0 lỗ hổng, không đổi `package-lock.json` | — |
| `npm run check` | đạt, exit 0 | ~4 giây |
| `npm test` (lần 1) | 355 đạt · 3 trượt · 2 bỏ qua / 360 test (exit 1) | ~72 giây |
| `npm test` (lần 2) | 355 đạt · 3 trượt · 2 bỏ qua / 360 test (exit 1) | ~72 giây |

- **Test trượt** (giống hệt ở cả hai lần, nên tính là trượt thật, chưa rõ nguyên nhân; đã ghi vào Hộp thư đến):
  - `test/e2e-auth.test.js:19`: phiên tu không còn sau khi khởi động lại (dòng 98).
  - `test/e2e-donation-test-mode.test.js:10`: hoàn thành ngay tự xác nhận, trạng thái `confirmed` thay vì `cancelled` (dòng 52).
  - `test/e2e-martial.test.js:80`: congLuc 145 thay vì 195 sau khi khởi động lại (dòng 156).
- **Bỏ qua** (2, cùng lý do): test PostgreSQL vì không nối được `127.0.0.1:5432` (ECONNREFUSED). Chưa có PostgreSQL cục bộ.
- **Chập chờn**: không thấy trong 2 lần chạy. Số đạt/trượt/bỏ qua và danh sách test trượt giống nhau. `e2e-sweeper` đạt cả hai lần. Ba test trượt ở trên là trượt cố định, không phải chập chờn.
- **Ghi chú**: `npm run check` vẫn thiếu `lib/sweeper.js` trong danh sách viết tay (đã nằm trong thẻ T-004). Không sửa test trong thẻ này.
