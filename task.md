# task.md · Bảng việc cho agent

> Cách dùng: xem [docs/agents/ORCHESTRATION.md](docs/agents/ORCHESTRATION.md). Mỗi thẻ ghi rõ **gói ngữ cảnh** (xem [docs/agents/CONTEXT-PACKS.md](docs/agents/CONTEXT-PACKS.md)) và **khu vực chạm** để không ai đụng ai.
> Chỉ sửa thẻ của mình. Kéo bản mới nhất trước khi sửa file này.
>
> Trạng thái: ⚪ Hộp thư đến · 🔵 Sẵn sàng · 🟡 Đang làm · 🟣 Chờ soát · 🔴 Bị chặn · ✅ Xong
> Ưu tiên: P0 gấp · P1 nên làm sớm · P2 khi rảnh · 👤 = cần chủ dự án quyết hoặc tự làm

## Tổng quan

| Thẻ | Việc | Trạng thái | Ưu tiên | Gói | Người làm |
|---|---|---|---|---|---|
| T-001 | Chốt một trong hai nhánh Obito trùng nhau | 🔴 Bị chặn 👤 | P0 | CORE + PK + HALL | — |
| T-002 | Kiểm và dọn các nhánh đã merge | 🔵 Sẵn sàng 👤 | P1 | CORE + OPS | — |
| T-003 | Ghi baseline test trên Node 22 | 🔵 Sẵn sàng | P0 | CORE + OPS | — |
| T-004 | `npm run check` tự quét file, không liệt kê tay | 🔵 Sẵn sàng | P1 | CORE + OPS | — |
| T-005 | Test chống lệch các hằng số dùng chung | 🔵 Sẵn sàng | P1 | CORE + PK + HALL | — |
| T-006 | CI GitHub Actions chạy check + test | 🔵 Sẵn sàng | P1 | CORE + OPS | — |
| T-007 | Sửa mục "Cấu trúc mã" trong README | 🔵 Sẵn sàng | P2 | CORE + DOCS | — |
| T-008 | Lệnh chạy ui-harness có sẵn trong package.json | ⚪ Hộp thư đến | P2 | CORE + OPS + PK | — |
| T-009 | Rà các bản làm việc rời trên máy | 🔵 Sẵn sàng 👤 | P2 | CORE | — |

Thứ tự gợi ý: **T-003 → T-004 → T-006** (nối tiếp vì cùng chạm `package.json`). **T-005**, **T-007**, **T-002** làm song song được với nhóm trên. **T-001** chờ chủ dự án quyết.

---

## Đang làm / Sẵn sàng

### T-001 · Chốt một trong hai nhánh Obito trùng nhau
- **Trạng thái**: 🔴 Bị chặn 👤 (cần chủ dự án chọn nhánh)
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
- **Trạng thái**: 🔵 Sẵn sàng
- **Ưu tiên**: P0
- **Gói ngữ cảnh**: CORE + OPS
- **Khu vực chạm**: task.md, docs/agents/ARCHITECTURE.md (mục 7 nếu cần)
- **Phụ thuộc**: không
- **Người làm**: —
- **Nhánh**: `<agent>/T-003-baseline-test`
- **Mục tiêu**: biết chắc `main` hiện tại có xanh không, mất bao lâu, test nào chậm/chập chờn, để các thẻ sau so được. (Lúc dựng bộ tài liệu này chưa chạy được `npm ci`; trên Node v25 của máy, 124 test thuần của `pk-engine`, `hall-npcs`, `martial-data` đạt hết trong ~5 giây.)
- **Tiêu chí xong**:
  - [ ] `npm ci` + `npm run check` + `npm test` trên Node 22 (giống production); ghi số đạt/bỏ qua/trượt và thời gian
  - [ ] Chạy `npm test` 2 lần; test nào kết quả khác nhau thì ghi là chập chờn (nghi vấn: `e2e-martial`, `e2e-donation-test-mode`, `e2e-sweeper`, `store-pg`)
  - [ ] Ghi kết quả vào mục "Baseline" cuối file này
  - [ ] Test trượt thật thì mở thẻ mới ở Hộp thư đến, không tự sửa trong thẻ này
- **Ngoài phạm vi**: sửa test.

### T-004 · `npm run check` tự quét file, không liệt kê tay
- **Trạng thái**: 🔵 Sẵn sàng
- **Ưu tiên**: P1
- **Gói ngữ cảnh**: CORE + OPS
- **Khu vực chạm**: package.json, tools/check.js (mới), AGENTS.md (§2, §3.12 bỏ ghi chú "thêm vào check"), docs/agents/ARCHITECTURE.md (§6)
- **Phụ thuộc**: T-003 (để có baseline)
- **Người làm**: —
- **Nhánh**: `<agent>/T-004-check-tu-dong`
- **Mục tiêu**: hiện `check` là chuỗi `node --check` viết tay và **đang thiếu `lib/sweeper.js`**. Thay bằng script nhỏ không phụ thuộc thư viện, tự quét `server.js`, `lib/**/*.js`, `public/js/*.js`, `tools/**/*.js` (bỏ qua `node_modules`, `.claude/`).
- **Tiêu chí xong**:
  - [ ] `npm run check` gọi `node tools/check.js`, quét tối thiểu đủ các file đang có trong danh sách cũ + `lib/sweeper.js`
  - [ ] Cố ý tạo lỗi cú pháp trong một file → lệnh trả mã khác 0 và in tên file
  - [ ] Chạy được trên Windows và Linux (đường dẫn bằng `path`, không dùng glob của shell)
  - [ ] Cập nhật AGENTS.md / ARCHITECTURE.md bỏ quy tắc "thêm tay vào check"
- **Ngoài phạm vi**: thêm ESLint/Prettier.

### T-005 · Test chống lệch các hằng số dùng chung
- **Trạng thái**: 🔵 Sẵn sàng
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

### T-006 · CI GitHub Actions chạy check + test
- **Trạng thái**: 🔵 Sẵn sàng
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

## Hộp thư đến (ý tưởng, chưa đủ để giao)

Lấy từ README "Việc nên làm tiếp" và lúc rà repo. Điều phối viết lại thành thẻ đủ trường khi muốn làm.

- 👤 Thu âm bài tụng thật của chư tăng chùa đối tác (có sự đồng ý), thay giọng tổng hợp. Gói: CHANT.
- Chuyển trạng thái sang Redis để chạy nhiều máy chủ. Gói: STORE + OPS. Cần thiết kế trước (dùng skill/ADR), thẻ lớn.
- Chia phòng "Chánh điện 1, 2…" khi quá 300 người. Gói: HALL + PLACE + SOCIAL. Cần thiết kế trước.
- 👤 Hỏi luật sư về Nghị định 147/2024/NĐ-CP (mạng xã hội) và bảo vệ dữ liệu cá nhân trước khi mở rộng.
- 👤 Xin phép người giữ bản quyền tài liệu Trần Đại Sỹ (Dịch Cân Kinh) trước khi phát hành rộng.
- Gom hằng số PK về một nguồn (`lib/pk/rules.js` gửi qua `/api/config`) thay vì chép tay ở `martial.js` và `arena.js`. Làm sau T-005. Gói: PK.

---

## Đã xong

| Thẻ | Việc | Ngày | PR / commit |
|---|---|---|---|
| T-000 | Chuẩn hóa context cho agent: `AGENTS.md`, `CLAUDE.md`, `docs/agents/{ARCHITECTURE,CONTEXT-PACKS,ORCHESTRATION}.md`, `task.md` | 2026-11-10 | commit trên `main` ("Chuẩn hóa context cho agent…") |

---

## Baseline

_(T-003 điền: ngày, commit, phiên bản Node, số test đạt/bỏ qua/trượt, thời gian, test chập chờn.)_
