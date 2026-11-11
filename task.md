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
| T-003 | Ghi baseline test trên Node 22 | ✅ Gộp tích hợp (chờ PR) | P0 | CORE + OPS | Claude Haiku (thay GLM Flash) |
| T-004 | `npm run check` tự quét file, không liệt kê tay | ✅ Gộp tích hợp (chờ PR) | P1 | CORE + OPS | Claude Sonnet (thay Codex) |
| T-005 | Test chống lệch các hằng số dùng chung | ✅ Gộp tích hợp (chờ PR) | P1 | CORE + PK + HALL | Claude Sonnet (thay Codex) |
| T-006 | CI GitHub Actions chạy check + test | ✅ Gộp tích hợp (chờ PR) | P1 | CORE + OPS | Claude Sonnet |
| T-007 | Sửa mục "Cấu trúc mã" trong README | 🔵 Sẵn sàng | P2 | CORE + DOCS | — |
| T-008 | Lệnh chạy ui-harness có sẵn trong package.json | ⚪ Hộp thư đến | P2 | CORE + OPS + PK | — |
| T-009 | Rà các bản làm việc rời trên máy | 🔵 Sẵn sàng 👤 | P2 | CORE | — |
| **Đợt 2026-11** | | | | | |
| T-010 | Làm thanh đổi map đồng bộ (4 nút), bỏ nút Xin xăm | ✅ Gộp tích hợp (chờ PR) | P0 | CORE + NAV + HALL | Claude Sonnet 5.5 |
| T-011 | Gọn thanh dưới còn 9 nút lễ Phật, tab Khám phá | ✅ Gộp tích hợp (chờ PR) | P0 | CORE + NAV | Claude Sonnet 5.5 |
| T-012 | Thanh đổi map trong Sân đấu | ⏳ T-010, T-011 | P1 | CORE + NAV + PK | — |
| T-020 | Chốt giao thức Kỳ Đạo | ✅ Gộp tích hợp (chờ PR) | P0 | CORE + KYDAO + DOCS | Claude Sonnet 5.5 |
| T-021 | Luật cờ vua thuần, kiểm perft | ✅ Gộp tích hợp (chờ PR) | P0 | CORE + KYDAO | Claude Sonnet 5.5 + Codex terra 6.1 |
| T-022 | Luật cờ tướng thuần, perft, ký hiệu Việt | ✅ Gộp tích hợp (chờ PR) | P0 | CORE + KYDAO | Codex terra 6.1 + Claude Sonnet 5.5 |
| T-023 | Nghiên cứu luật cờ tướng úp (揭棋) | ✅ Gộp tích hợp (chờ PR) | P1 | CORE + KYDAO + DOCS | GLM Flash + Claude Sonnet 5.5 |
| T-024 | Biến thể cờ tướng úp | ⏳ T-022, T-023 | P1 | CORE + KYDAO | — |
| T-025 | Luật cờ vây thuần | ✅ Gộp tích hợp (chờ PR) | P1 | CORE + KYDAO | Codex terra 6.1 + Claude Sonnet 5.5 |
| T-026 | Luật cờ caro thuần | ✅ Gộp tích hợp (chờ PR) | P1 | CORE + KYDAO | Claude Haiku 5.5 (thay GLM Flash) |
| T-027 | Tính Elo và điều kiện xếp hạng | ✅ Gộp tích hợp (chờ PR) | P0 | CORE + KYDAO | Claude Haiku 5.5 + GLM Flash + Claude Sonnet 5.5 |
| T-028 | Bộ quản lý ván cờ | ✅ Gộp tích hợp (chờ PR) | P0 | CORE + KYDAO + PK | Codex terra 6.1 + Claude Sonnet 5.5 |
| T-029 | Lưu bền dữ liệu Kỳ Đạo và kỷ lục 👤 merge | ✅ Gộp tích hợp (chờ PR, 👤 merge) | P0 | CORE + STORE | Claude Sonnet 5.5 |
| T-030 | Nối Kỳ Đạo vào máy chủ | ⏳ T-028, T-029, T-031, T-051 | P0 | CORE + KYDAO + HALL + AUTH | — |
| T-031 | Vẽ bàn đá và ghế ở Sân chùa | ✅ Gộp tích hợp (chờ PR) | P0 | CORE + HALL + KYDAO | Claude Sonnet 5.5 |
| T-032 | Bảng bàn cờ: khung, cờ vua, cờ tướng | ✅ Gộp tích hợp (chờ PR) | P0 | CORE + KYDAO | Claude Sonnet 5.5 |
| T-033 | Bảng bàn cờ: cờ vây, caro, cờ úp | ⏳ T-032, T-024, T-025, T-026 | P1 | CORE + KYDAO | — |
| T-034 | Nối bảng cờ vào chùa | ⏳ T-030, T-031, T-032 | P0 | CORE + KYDAO + NAV | — |
| T-035 | ui-harness cho bàn cờ | ⏳ T-032, T-033 | P1 | CORE + KYDAO + OPS | — |
| T-040 | Thống kê mùa, tính người giữ danh hiệu | ✅ Gộp tích hợp (chờ PR) | P0 | CORE + RANK + MARTIAL | Claude Sonnet 5.5 (thay Codex terra 6.1) |
| T-041 | Phát danh hiệu từ máy chủ | ⏳ T-030, T-040 | P0 | CORE + RANK | — |
| T-042 | Hiện danh hiệu trên đầu, hộp người chơi, Sân đấu | ⏳ T-041, T-031, T-034, T-064 | P1 | CORE + RANK + HALL | — |
| T-043 | Bia Bảng Vàng ở Sân chùa | ⏳ T-042 | P1 | CORE + RANK + HALL | — |
| T-044 | Màn "Kẻ mạnh nhất lịch sử… đối đầu kẻ mạnh nhất hiện tại" | ⏳ T-041, T-030 | P1 | CORE + RANK + PK + KYDAO | — |
| T-050 | Viết lại lịch âm (UTC+8 trước 1968, can chi đủ) | ✅ Gộp tích hợp (chờ PR) | P0 | CORE + FORTUNE | Codex terra 6.1 + Claude Sonnet 5.5 |
| T-051 | Máy chủ: rút tarot theo hạt giống, giới hạn xin xăm | ✅ Gộp tích hợp (chờ PR) | P0 | CORE + FORTUNE | Claude Sonnet 5.5 |
| T-052 | Nội dung 78 lá tarot theo 8 chủ đề | ✅ Gộp tích hợp (chờ PR) | P1 | CORE + FORTUNE | Claude Sonnet 5.5 (thay Gemini Flash) |
| T-053 | Giao diện tarot theo chủ đề | ✅ Gộp tích hợp (chờ PR) | P1 | CORE + FORTUNE | Claude Sonnet 5.5 |
| T-054 | Bộ máy an sao Tử Vi | ✅ Gộp tích hợp (chờ PR) | P0 | CORE + FORTUNE | Claude Sonnet 5.5 (thay Codex terra 6.1) |
| T-055 | Đối chiếu bảng tử vi, lập lá số mẫu 👤 | 🔵 Sẵn sàng | P0 | CORE + FORTUNE + DOCS | — |
| T-056 | Nội dung luận giải tử vi | ✅ Gộp tích hợp (chờ PR) | P1 | CORE + FORTUNE | Claude Sonnet 5.5 (thay Gemini Flash) |
| T-057 | Giao diện lá số tử vi | ⏳ T-054, T-056, T-053 | P1 | CORE + FORTUNE | — |
| T-060 | Quy tắc chữ, bảng thuật ngữ, danh sách bí mật | ✅ Gộp tích hợp (chờ PR) | P0 | CORE + GUIDE + DOCS | Claude Sonnet 5.5 (thay Gemini Flash) |
| T-061 | Sổ tay trong game (nút "?") | ⏳ T-060, T-011 | P1 | CORE + GUIDE + NAV | — |
| T-062 | Gợi ý lần đầu, nhãn tên không đè nhau | ⏳ T-061, T-043 | P1 | CORE + GUIDE + HALL | — |
| T-063 | Viết lại chữ Võ Học Các | ⏳ T-060, T-061 | P1 | CORE + GUIDE + MARTIAL | — |
| T-064 | Viết lại chữ Sân đấu | ⏳ T-012, T-060, T-061 | P1 | CORE + GUIDE + PK | — |
| T-065 | Viết lại chữ chánh điện, công đức, cúng dường | ⏳ T-060, T-011, T-061, T-044 | P1 | CORE + GUIDE + RITUAL | — |
| T-066 | Bài kiểm người mới (25 câu) | ⏳ T-067 (và mọi thẻ T-010 → T-065) | P1 | CORE + GUIDE | — |
| T-067 | Cập nhật README và tài liệu người chơi | ⏳ T-010 → T-065 | P2 | CORE + DOCS | — |
| T-068 | Cho máy chủ thử tắt êm trên Windows (3 test e2e) | ✅ Gộp tích hợp (chờ PR) | P0 | CORE + STORE + OPS | Claude Sonnet 5.5 |

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
- **Trạng thái**: ✅ Gộp vào nhánh tích hợp `claude/mini-game-development-plan-b7e553` (chờ PR vào `main`). Soát (Opus thay Sol): PASS vòng 1. Baseline ghi trên Node v25 vì máy không có Node 22; Node 22 do CI (T-006) chạy. 3 test trượt cố định trên Windows → thẻ T-068.
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
- **Trạng thái**: ✅ Gộp vào nhánh tích hợp (chờ PR). Soát (Opus thay Sol): PASS vòng 1. `tools/check.js` quét đệ quy `server.js`, `lib/`, `public/js/`, `tools/`, `test/` (86 file). Góp ý để sau: quét thêm `.mjs`, thêm test cho chính script.
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
- **Trạng thái**: ✅ Gộp vào nhánh tích hợp (chờ PR). Soát (Opus thay Sol): PASS vòng 1. 5 ca kiểm, không có giá trị nào đang lệch. Người làm: Claude Sonnet 5.5 (thay Codex terra 6.1), nhánh `claude/T-005-test-dong-bo`.
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
- **Trạng thái**: ✅ Gộp vào nhánh tích hợp (chờ PR). Soát (Opus thay Sol): PASS vòng 1. Chưa chạy thật trên GitHub Actions; lần chạy đầu sẽ cho baseline Node 22 + PostgreSQL. Nếu 3 test của T-068 cũng đỏ trên Linux thì CI đỏ cho tới khi T-068 xong. Người làm: Claude Sonnet 5.5, nhánh `claude/T-006-ci`.
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
- **Trạng thái**: ✅ Gộp vào nhánh tích hợp (chờ PR). Thợ: Claude Sonnet 5.5 (qua proxy). Soát: Sol 6.1 vòng 1 (2 lỗi), Opus 5.5 thay Sol/Argon các vòng sau (kênh Codex và Antigravity hết hạn mức). Điều phối tự chạy thật: đổi map 10 lần không lỗi console, 375×812 bốn nút 83×44px một hàng, dải gợi ý có ✕; test chọn bồ đoàn gần nhất được giao viết lại thành test hành vi (Điều phối thử làm hỏng: đỏ).
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
- **Trạng thái**: ✅ Gộp vào nhánh tích hợp (chờ PR). Thợ: Claude Sonnet 5.5 (qua proxy). Soát: Sol 6.1 + Opus 5.5 thay Argon; sau 2 vòng còn test giao diện yếu → giao sửa thêm (Điều phối thử làm hỏng: đỏ). Điều phối chạy thật 375×812: 9 nút, 2 hàng, nút 58px, không cuộn ngang, tab Khám phá, hộp giọng nói tự thu nhỏ.
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
- **Trạng thái**: ⏳ Chờ T-010, T-011
- **Ưu tiên**: P1 · **Đợt**: 3
- **Gói ngữ cảnh**: CORE + NAV + PK
- **Khu vực chạm**: public/js/arena.js (đầu màn, nút "← Về chánh điện", hộp rời trận), public/css/arena.css, public/index.html (`?v=`), tools/ui-harness/arena/* (nếu cần)
- **Phụ thuộc**: T-010 (`MapBar.configure/mount`), T-011 (đã sửa `e2e-real.js`)
- **Thợ**: Sonnet 5.5 (high) · **Soát**: Gemini Argon + Sol 6.1
- **Người làm**: — · **Nhánh**: —
- **Thiết kế**: KH §4.3
- **Mục tiêu**: Sân đấu có cùng thanh đổi map như các map khác (Sân đấu sáng), thay nút "← Về chánh điện".
- **Tiêu chí xong**:
  - [ ] `MapBar.mount()` ở đầu màn Sân đấu; bấm map khác khi không có trận → đi thẳng; khi có trận → dùng lại hộp xác nhận rời trận có sẵn (`ui.dLeave`) như nút cũ
  - [ ] `node tools/ui-harness/arena/gen-fixtures.js` + `ui-check.js` sạch; `e2e-real.js` sạch
  - [ ] 375×812: thanh không che công tắc "Không nhận lời mời" và dải chờ
- **Ngoài phạm vi**: viết lại chữ Sân đấu (T-064).

### Epic KD · Kỳ Đạo (năm môn cờ ngoài sân chùa)

### T-020 · Chốt giao thức Kỳ Đạo
- **Trạng thái**: ✅ Gộp vào nhánh tích hợp (chờ PR). Thợ: Claude Sonnet 5.5 (qua proxy). Soát: Sol 6.1 vòng 1 (9 lỗi), Opus 5.5 thay Sol ở vòng 2–3 vì kênh Codex hết hạn mức; điểm cuối (báo trước ván bị hạ xuống giao hữu) được Điều phối giao sửa thêm và kiểm lại.
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
- **Trạng thái**: ✅ Gộp vào nhánh tích hợp (chờ PR). Thợ: Claude Sonnet 5.5 viết bản đầu, Codex terra 6.1 (gpt-6.1-terra) sửa 2 vòng. Soát: Sol 6.1 còn 2 điểm sau 2 vòng; Điều phối xét: perft d4 cả 5 thế đã chạy đúng (Điều phối chạy, 0,5 giây); nhận diện thế cờ chết có hàng rào Tốt là ngoài phạm vi thẻ (chỉ khiến ván không tự hòa, người chơi vẫn xin hòa được) → chấp nhận, ghi vào Hộp thư đến.
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
- **Trạng thái**: ✅ Gộp vào nhánh tích hợp (chờ PR). Thợ: Codex terra 6.1 (gpt-6.1-terra); sửa vòng 1 bằng Claude Sonnet 5.5 vì kênh Codex hết hạn mức. Soát: Opus 5.5 thay Sol 6.1 và Gemini Argon (hai kênh hết hạn mức), PASS vòng 2. Perft d1–d3 đúng (44 / 1.920 / 79.666).
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
- **Trạng thái**: ✅ Gộp vào nhánh tích hợp (chờ PR). Thợ: GLM Flash (glm-4.5-flash) 2 vòng chưa đạt; Điều phối giao Claude Sonnet 5.5 viết lại. Soát: Opus 5.5 thay Gemini Argon. Luật theo D7; các điểm 👤 ở §7 của tài liệu (hòa 40 hồi hay 60 nước, lặp thế, ăn quân úp chỉ bên ăn biết).
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
- **Trạng thái**: ⏳ Chờ T-022, T-023
- **Ưu tiên**: P1 · **Đợt**: 2
- **Gói ngữ cảnh**: CORE + KYDAO
- **Khu vực chạm**: public/js/kydao/xiangqi.js, test/kydao-jieqi.test.js (mới)
- **Phụ thuộc**: T-022, T-023 (và D7 đã chốt)
- **Thợ**: Codex terra 6.1 · **Soát**: Sol 6.1 + Gemini Argon
- **Người làm**: — · **Nhánh**: —
- **Thiết kế**: KH §5.4 "Cờ tướng úp", `docs/ky-dao/CO-TUONG-UP.md`
- **Mục tiêu**: `variant:'jieqi'` chạy đúng luật đã chốt, không lộ quân úp.
- **Tiêu chí xong**:
  - [ ] `create({ variant:'jieqi', rng })` xáo 15 quân mỗi bên lên vị trí gốc, Tướng ngửa; cùng seed → cùng xáo
  - [ ] Quân úp đi theo quân chủ nhà của ô; đi xong thì lật; `play` trả `info.reveal`
  - [ ] `view(state, side)` không chứa danh tính quân chưa lật (test duyệt đệ quy mọi trường, mọi kiểu dữ liệu)
  - [ ] `legalMoves(view)` == `legalMoves(state đầy đủ)` trên 1.000 thế ngẫu nhiên (chứng minh trình duyệt tính đúng mà không biết quân thật)
  - [ ] Luật Sĩ/Tượng/Tốt sau khi lật và luật ăn quân úp theo T-023
- **Ngoài phạm vi**: giao diện (T-033).

### T-025 · Viết luật cờ vây thuần
- **Trạng thái**: ✅ Gộp vào nhánh tích hợp (chờ PR). Thợ: Codex terra 6.1 (gpt-6.1-terra), sửa bằng Claude Sonnet 5.5 (kênh Codex hết hạn mức). Soát: Opus 5.5 thay Sol/Argon. Sau 2 vòng, Điều phối quyết: chấp nhận 5 thế mẫu tự dựng (soát đã tính lại, ghi nguồn luật tính diện tích) và bắt thêm test chống bấm 'Đồng ý' hai lần (Điều phối thử làm hỏng: đỏ).
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
- **Trạng thái**: ✅ Gộp vào nhánh tích hợp (chờ PR). Thợ: Claude Haiku 5.5 (làm trước khi chuyển sang proxy). Soát: Sol 6.1 (gpt-6.1-sol) PASS vòng 1.
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
- **Trạng thái**: ✅ Gộp vào nhánh tích hợp (chờ PR). Thợ: Claude Haiku 5.5 viết bản đầu; GLM Flash (glm-4.5-flash) sửa 2 vòng nhưng làm ngược luật D6 khi tắt Google và tự sửa task.md; Điều phối giao Claude Sonnet 5.5 sửa lần cuối. Soát: Sol 6.1 vòng 1–2, Opus 5.5 vòng 3. Điều phối kiểm tay: công thức, K, sàn, điều kiện tài khoản đúng.
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
- **Trạng thái**: ✅ Gộp vào nhánh tích hợp (chờ PR). Thợ: Codex terra 6.1 (bản đầu, dừng sớm vì hạn mức), Claude Sonnet 5.5 sửa 2 vòng. Soát: Sol 6.1 (vòng 1), Opus 5.5 thay Sol (vòng 2–3) PASS. 51 test đạt, có quét mọi emit không lộ uid/quân úp.
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
- **Trạng thái**: ✅ Gộp vào nhánh tích hợp. PR vào main: 👤 chủ dự án bấm merge (đổi hình dạng dữ liệu). Thợ: Claude Sonnet 5.5 (qua proxy). Soát: Sol 6.1.
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
- **Trạng thái**: ⏳ Chờ T-028, T-029, T-031, T-051
- **Ưu tiên**: P0 · **Đợt**: 3
- **Gói ngữ cảnh**: CORE + KYDAO + HALL + AUTH
- **Khu vực chạm**: server.js (cấu hình `KYDAO_*`, `YARD_TABLES`, `kydaoOnly`, handler `kd:*`, tạo manager trong `main()`, `shutdown`, rời bàn khi đổi cảnh/place/ngắt kết nối, `linkGuest` gọi `mergeKydaoGuest` kể cả đường hoàn tác, `/api/config` thêm `kydao`), test/e2e-kydao.test.js (mới), test/sync-constants.test.js (thêm ca `YARD_TABLES`), docs/agents/ARCHITECTURE.md (§2, §4: chỉ thêm dòng của mình), README.md (biến môi trường)
- **Phụ thuộc**: T-028, T-029, T-031 (`YARD_TABLES` phía `hall.js` có trước), T-051 (thứ tự `server.js`)
- **Thợ**: Sonnet 5.5 (high) · **Soát**: Sol 6.1
- **Người làm**: — · **Nhánh**: —
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
- **Trạng thái**: ✅ Gộp vào nhánh tích hợp (chờ PR). Thợ: Claude Sonnet 5.5 (qua proxy). Soát: Opus 5.5 thay Argon/Sol; sau 2 vòng còn lỗi chạm thầy bói mở nhầm bàn ở cỡ canvas thật → giao sửa (thầy bói ưu tiên, test dùng cỡ canvas thật).
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
- **Trạng thái**: ✅ Gộp vào nhánh tích hợp (chờ PR). Thợ: Claude Sonnet 5.5 (qua proxy). Soát: Opus 5.5 thay Argon/Sol, PASS vòng 2. Điều phối xem trang thử: cờ tướng (chữ Hán, sông, cung) và cờ vua 375×812 vừa màn, nút 44px, không lỗi console.
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
- **Trạng thái**: ⏳ Chờ T-032, T-024, T-025, T-026
- **Ưu tiên**: P1 · **Đợt**: 3
- **Gói ngữ cảnh**: CORE + KYDAO
- **Khu vực chạm**: public/js/kydao-ui.js, public/js/kydao-draw.js, public/css/kydao.css
- **Phụ thuộc**: T-032, T-024, T-025, T-026
- **Thợ**: Sonnet 5.5 (high) · **Soát**: Gemini Argon + Sol 6.1
- **Người làm**: — · **Nhánh**: —
- **Thiết kế**: KH §5.4, §5.9
- **Mục tiêu**: đủ 5 môn trên bảng bàn cờ.
- **Tiêu chí xong**:
  - [ ] Cờ vây 9/13/19 có điểm sao; giai đoạn đánh dấu (chạm nhóm, Đồng ý / Đánh tiếp, đếm ngược 3 phút, điểm tạm tính)
  - [ ] Caro 15×15 X/O, tô 5 quân thắng
  - [ ] Cờ úp: quân úp vẽ mặt lưng; lật có hiệu ứng ngắn (tắt khi giảm chuyển động)
  - [ ] 375×812: caro và vây 19×19 dùng được (phóng to/kéo nếu cần)
- **Ngoài phạm vi**: bot.

### T-034 · Nối bảng cờ vào chùa
- **Trạng thái**: ⏳ Chờ T-030, T-031, T-032
- **Ưu tiên**: P0 · **Đợt**: 4
- **Gói ngữ cảnh**: CORE + KYDAO + NAV
- **Khu vực chạm**: public/js/app.js (handler chạm bàn, `socket.on('kd:*')` → `Hall.setTables` và `KydaoUI`, hộp người chơi "Mời đánh cờ", chip "Đang đánh cờ"), public/index.html (`<script>` của `kydao/*.js`, `kydao-ui.js`, `kydao-draw.js`; `<link>` của `kydao.css`; hộp mời đánh cờ trong `#dlg-person`; `?v=`)
- **Phụ thuộc**: T-030, T-031, T-032
- **Thợ**: Sonnet 5.5 (high) · **Soát**: Gemini Argon + Sol 6.1
- **Người làm**: — · **Nhánh**: —
- **Thiết kế**: KH §5.1
- **Mục tiêu**: người chơi đánh cờ được từ đầu tới cuối trong chùa thật.
- **Tiêu chí xong**:
  - [ ] Hai trình duyệt trên máy chủ thật: ngồi, chọn luật, sẵn sàng, đánh, kết quả, Đấu lại (đổi bên)
  - [ ] Mời từ hộp người chơi ở chánh điện → cả hai ra Sân chùa, ngồi bàn trống gần nhất; hết bàn → bàn trong
  - [ ] Chạm bàn đang đấu → xem trực tiếp; tải lại trang giữa ván → vào lại đúng ván
  - [ ] Khách khi bật Google: giao hữu được, xếp hạng thì mời đăng nhập (`code:'login'`)
  - [ ] Không lỗi console; ảnh 3 cỡ màn
- **Ngoài phạm vi**: danh hiệu trên bảng (T-042).

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
- **Trạng thái**: ✅ Gộp vào nhánh tích hợp (chờ PR). Thợ: Claude Sonnet 5.5 thay Codex terra 6.1 (kênh Codex lại hết hạn mức). Soát: Opus 5.5 thay Sol, PASS vòng 2. 118 test liên quan đạt.
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
- **Trạng thái**: ✅ Gộp vào nhánh tích hợp (chờ PR). Thợ: Codex terra 6.1 (gpt-6.1-terra), sửa vòng 1 bằng Claude Sonnet 5.5. Soát: Sol 6.1 (vòng 1), Opus 5.5 thay Sol/Argon (vòng 2) PASS. Điều phối kiểm tay: 10/2/1995 → 11/1/1995, Tết 1968 → 29/1, 28/1/1903 → 30/12/1902 (UTC+8). Còn mở 👤: có đổi 1900–1928 sang giờ Bắc Kinh không (ghi đầu lunar.js).
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
- **Trạng thái**: ✅ Gộp vào nhánh tích hợp (chờ PR). Thợ: Claude Sonnet 5.5 (đúng vai trong kế hoạch). Soát: Sol 6.1 (gpt-6.1-sol) NEEDS_FIX vòng 1 (2 lỗi), PASS vòng 2.
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
- **Trạng thái**: ✅ Gộp vào nhánh tích hợp (chờ PR). Thợ: Claude Sonnet 5.5 thay Gemini Flash (kênh Antigravity hết hạn mức). Soát: Opus 5.5 thay Argon/Sol; sau 2 vòng còn câu Ẩn phụ ghép khuôn gây sợ → giao viết lại riêng 99 câu cho các lá nặng.
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
- **Trạng thái**: ✅ Gộp vào nhánh tích hợp (chờ PR). Thợ: Claude Sonnet 5.5 (qua proxy). Soát: Opus 5.5 thay Argon, Sol 6.1. Điều phối chạy thật: chọn chủ đề → tình trạng → khung → 5 lá chữ thập + Lời thầy, không lỗi console.
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
- **Trạng thái**: ✅ Gộp vào nhánh tích hợp (chờ PR). Thợ: Claude Sonnet 5.5 thay Codex terra 6.1 (kênh Codex hết hạn mức giữa chừng). Soát: Opus 5.5 thay Sol/Argon, PASS vòng 2. Điều phối kiểm tay: 10/2/1995 giờ Tý nam → Mệnh Dần, Mậu Dần Thành Đầu Thổ, Thổ ngũ cục; 4 ms/lá số. Phần so 12 lá số mẫu tự bỏ qua tới khi T-055 có fixture.
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
- **Trạng thái**: 🔵 Sẵn sàng 👤
- **Ưu tiên**: P0 · **Đợt**: 1
- **Gói ngữ cảnh**: CORE + FORTUNE + DOCS
- **Khu vực chạm**: docs/TU-VI-QUY-UOC.md (mới), test/fixtures/tuvi-golden.json (mới)
- **Phụ thuộc**: không
- **Thợ**: GLM Flash (+ 👤 chủ dự án hoặc người được nhờ lập 12 lá số từ 2 công cụ tử vi Việt) · **Soát**: Gemini Argon
- **Người làm**: — · **Nhánh**: —
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
- **Trạng thái**: ✅ Gộp vào nhánh tích hợp (chờ PR). Thợ: Claude Sonnet 5.5 thay Gemini Flash (kênh Antigravity hết hạn mức). Soát: Opus 5.5 thay Gemini Argon, PASS sau sửa.
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
- **Trạng thái**: ✅ Gộp vào nhánh tích hợp (chờ PR). Thợ: Claude Sonnet 5.5 (làm trước khi chuyển sang proxy; sửa bằng Sonnet vì kênh Gemini đang hết hạn mức). Soát: Opus 5.5 thay Gemini Argon (kênh Antigravity hết hạn mức), PASS vòng 3.
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
- **Trạng thái**: ⏳ Chờ T-060, T-011
- **Ưu tiên**: P1 · **Đợt**: 2
- **Gói ngữ cảnh**: CORE + GUIDE + NAV
- **Khu vực chạm**: public/js/guide.js (mới, global `Guide`), public/data/so-tay.vi.json (mới), public/css/guide.css (mới, tiền tố `gd-`), public/index.html (nút "?" ở `header.top`, `#dlg-guide`, `<script>`, `<link>`, `?v=`), public/js/app.js (vùng thanh trên: gắn nút), public/js/martial.js (chỉ thêm `IDLE_FORFEIT_TURNS` vào `MARTIAL.PK`), test/sync-constants.test.js (ca `IDLE_FORFEIT_TURNS` khớp `lib/pk/rules.js`)
- **Phụ thuộc**: T-060, T-011
- **Thợ**: Sonnet 5.5 (high) dựng + Gemini Flash viết `so-tay.vi.json` · **Soát**: Gemini Argon + Sol 6.1
- **Người làm**: — · **Nhánh**: —
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
- **Trạng thái**: ⏳ Chờ T-060
- **Ưu tiên**: P1 · **Đợt**: 3
- **Gói ngữ cảnh**: CORE + GUIDE + MARTIAL
- **Khu vực chạm**: docs/copy/VO-HOC-CAC.md (mới, bảng chữ cũ → mới), public/js/dojo.js (chỉ chuỗi chữ + mở sẵn "Luật tu luyện" lần đầu), public/js/martial.js (chỉ chuỗi mô tả), public/index.html (`?v=`), docs/VO-HOC.md
- **Phụ thuộc**: T-060; T-061 (thứ tự `martial.js`)
- **Thợ**: Gemini Flash soạn bảng → Sonnet 5.5 áp vào mã · **Soát**: Gemini Argon (+ Sol kiểm diff chỉ là chuỗi)
- **Người làm**: — · **Nhánh**: —
- **Thiết kế**: KH §8.7
- **Mục tiêu**: người mới hiểu Võ Học Các mà không cần đọc docs.
- **Tiêu chí xong**:
  - [ ] Đủ mục KH §8.7 cho Võ Học Các; dùng đúng bảng thuật ngữ (nhãn "Danh hiệu PK" đổi thành "Bậc chiến tích" để không lẫn với danh hiệu lịch sử / hiện tại)
  - [ ] Không đổi số liệu hay logic (diff chỉ là chuỗi + 1 cờ mở sẵn)
  - [ ] `martial-data`, `martial-service` xanh; ui-harness dojo chạy được
- **Ngoài phạm vi**: cân bằng số liệu.

### T-064 · Viết lại chữ Sân đấu
- **Trạng thái**: ⏳ Chờ T-012, T-060
- **Ưu tiên**: P1 · **Đợt**: 4
- **Gói ngữ cảnh**: CORE + GUIDE + PK
- **Khu vực chạm**: docs/copy/SAN-DAU.md (mới), public/js/arena.js (chuỗi, dải "Luật nhanh", `endInfo` thêm `escape`, `MODES`), public/index.html (`?v=`)
- **Phụ thuộc**: T-012, T-060, T-061 (`MARTIAL.PK.IDLE_FORFEIT_TURNS`)
- **Thợ**: Gemini Flash soạn → Sonnet 5.5 áp · **Soát**: Gemini Argon
- **Người làm**: — · **Nhánh**: —
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
- **Trạng thái**: ✅ Gộp vào nhánh tích hợp (chờ PR). Thợ: Claude Sonnet 5.5 (qua proxy). Soát: Sol 6.1 PASS. Sau khi gộp: npm test 588 test, 585 đạt, 0 trượt, 3 bỏ qua (PostgreSQL) trên Windows/Node v25.
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

---

## Hộp thư đến (ý tưởng, chưa đủ để giao)

Lấy từ README "Việc nên làm tiếp" và lúc rà repo. Điều phối viết lại thành thẻ đủ trường khi muốn làm.

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
