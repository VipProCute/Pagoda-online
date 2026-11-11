# AGENTS.md · Hướng dẫn cho mọi AI agent làm việc trên Chùa Tâm An

> Đây là **nguồn duy nhất** cho quy tắc làm việc của agent (Codex, Claude Code, Cursor…). `CLAUDE.md` chỉ import file này rồi thêm vài ghi chú riêng cho Claude. Sửa quy tắc thì sửa ở đây.
>
> Thứ tự đọc khi nhận việc: **file này → [task.md](task.md) (thẻ việc của bạn) → gói ngữ cảnh ghi trong thẻ ở [docs/agents/CONTEXT-PACKS.md](docs/agents/CONTEXT-PACKS.md)**. Không đọc cả repo: chỉ đọc đúng gói được giao. Bản đồ mã đầy đủ: [docs/agents/ARCHITECTURE.md](docs/agents/ARCHITECTURE.md). Quy trình điều phối nhiều agent: [docs/agents/ORCHESTRATION.md](docs/agents/ORCHESTRATION.md).

## 1. Dự án trong 5 dòng

- "Chùa Tâm An": chánh điện online nhiều người chơi theo thời gian thực (thắp nhang, tụng kinh đồng bộ, chat, nói chuyện WebRTC, cúng dường VietQR), kèm game võ học (tu luyện, học chiêu, luận võ PK 1 đấu 1).
- Máy chủ: **Node.js CommonJS, Express 5 + Socket.IO 4**, không có bước build. Một tiến trình, toàn bộ trạng thái nằm trong RAM (`store.get()`), ghi nền ra file JSON hoặc PostgreSQL (Neon).
- Trình duyệt: **JS thuần, không bundler**, các file `public/js/*.js` nạp bằng `<script>` theo thứ tự trong `public/index.html`; vẽ bằng Canvas 2D (`hall.js`).
- Máy chủ quyết định mọi thứ (công đức, tiền, kết quả PK, giờ tu luyện). Trình duyệt chỉ hiển thị.
- Triển khai: Render (`render.yaml`, Node 22), Docker, hoặc VPS + pm2 + nginx.

## 2. Lệnh

| Việc | Lệnh |
|---|---|
| Cài | `npm ci` (Node ≥ 18; production dùng Node 22) |
| Chạy | `npm start` → http://localhost:3000 · có `.env`: `npm run start:env` · tự nạp lại: `npm run dev` |
| Kiểm cú pháp | `npm run check` (chạy `tools/check.js`: tự quét `server.js`, `lib/`, `public/js/` (đệ quy), `tools/`, `test/`; không cần liệt kê file JS mới) |
| Toàn bộ test | `npm test` (`node:test`, chạy tuần tự, test e2e tự bật `server.js` trên cổng trống với `DATA_FILE` tạm) |
| Một file test | `node --test test/pk-engine.test.js` · lọc theo tên: `--test-name-pattern "…"` (tên test bằng tiếng Việt) |
| Test PostgreSQL | đặt `TEST_DATABASE_URL` (mặc định `postgres://pagoda:pagoda@127.0.0.1:5432/pagoda_test`); không kết nối được thì tự `skip` |
| Mô phỏng cân bằng PK | `npm run sim -- roundrobin --games 2000 --seed 1` (xem `tools/pk-sim/index.js`) |
| Kiểm giao diện Võ Học Các / Sân đấu | `tools/ui-harness/` (server giả, cần Playwright cài riêng, xem CONTEXT-PACKS → gói `PK`) |
| Xem thử hiệu ứng mốc | `http://localhost:3000/?celebrate=100` (hoặc `666`, `2000`) |

Thử nhanh trên máy: `CULTIVATION_TIME_SCALE=0.001`, `PK_TIME_SCALE=0.05`, `MARTIAL_SWEEP_MS=15000`, `DONATION_MODE=test` (mặc định).

## 3. Quy tắc bất biến (không được phá)

**Bảo mật và tiền**
1. **Máy chủ là trọng tài.** Không bao giờ tin số liệu client gửi lên ngoài id đã kiểm tra. Công đức, mốc, rng, kết quả PK, giờ tu luyện, sự kiện Tảo Địa Tăng, quẻ xăm đều do máy chủ quyết.
2. **Cúng dường:** mã phải `await store.flush()` trước khi trả QR; ở `live` chỉ Ban điều hành hoặc webhook SePay đã xác thực mới xác nhận; khoản "hoàn thành tu luyện ngay" (`purpose:'speedup'`) **không bao giờ** tự xác nhận theo ngân hàng; không xoá khoản đã xác nhận; `confirmDonation` phải idempotent.
3. **Bí mật:** không commit `.env`, `DATABASE_URL`, khóa SePay/TURN/Google, `ADMIN_KEY`. Không in chúng ra log hay chat. Không điền tài khoản ngân hàng thật nếu chủ dự án chưa đưa.
4. **Dữ liệu cá nhân:** file giọng mẫu để nhân bản giọng nằm **ngoài** repo (`tools/build_chants.py` chặn đường dẫn trong repo). uid của khách là "chìa khóa" công đức của họ: không gửi uid người này cho client khác (danh sách chặn dùng mã HMAC).
5. **Chống XSS:** chữ do người dùng hoặc máy chủ gửi gán bằng `textContent` / helper `h()`, không dùng `innerHTML`.
6. **Mọi chuỗi người dùng nhập** đi qua `lib/moderation.js` (`clean`, `checkMessage`, `checkName`). Không nới bộ lọc link / dãy số (chống lừa đảo giả danh chùa).
7. Giữ nguyên rate limit, giới hạn kết nối, `maxHttpBufferSize`, kiểm tra `BAD_KEYS` / `hasOwn` (chống prototype pollution).

**Kiến trúc**
8. Socket handler trả lỗi nghiệp vụ bằng `ack({ ok:false, reason:'…tiếng Việt…', code? })`, **không ném lỗi**. `code:'login'` để giao diện mời đăng nhập.
9. Logic thuần (`lib/martial/service.js`, `lib/pk/engine.js`, `buffs.js`, `rules.js`) không đụng socket, timer, I/O. Thời gian và rng được tiêm vào (`now`, `setTimer`, `rng`) để test được.
10. File dùng chung Node + trình duyệt (`public/js/martial.js`, `aura.js`, `merit.js`, `chants.js`, `lunar.js`, `tarot.js`) giữ dạng IIFE/UMD, không phụ thuộc gì, không đụng DOM ở mức module.
11. **Thêm trường lưu bền:** trường lồng trong section có sẵn thì tự lưu (nhớ thêm bước mặc định cho dữ liệu cũ, ví dụ `norm()` trong service.js). **Thêm khóa cấp cao mới** trong `db` (hoặc trong `db.martial`) thì phải thêm vào `fresh()` + `SECTIONS` + `adopt()` ở `lib/store-sections.js`, nếu không PostgreSQL âm thầm bỏ mất.
12. **Những chỗ phải sửa đồng bộ bằng tay** (sửa một nơi là sửa cả nơi kia, danh sách đầy đủ ở ARCHITECTURE.md §6): `LIB_SEATS` (server.js ↔ hall.js) · `PLACES`/`SCENES` (server.js ↔ đăng ký phía trình duyệt) · hằng số PK (`lib/pk/rules.js` ↔ `MARTIAL.PK` trong martial.js ↔ đầu `arena.js`) · giao thức võ học (mã ↔ `docs/VO-HOC-GIAO-THUC.md`) · fixture `tools/ui-harness/arena` sau khi đổi engine.
13. Sửa file JS/CSS trong `public/` thì **tăng `?v=` tương ứng** trong `public/index.html` (static cache 10 phút).
14. Thêm ảnh/âm thanh/văn bản bên thứ ba thì ghi nguồn và giấy phép vào `public/img/NOTICE.txt`, `public/img/PHOTO-CREDITS.txt`, `public/audio/NOTICE.txt`, `public/kinh/NOTICE.txt` hoặc `public/data/NOTICE.txt`. Không chép nguyên văn tác phẩm còn bản quyền.
15. Không sửa tay file sinh ra bởi công cụ (`public/audio/chants/*.mp3|json`, ảnh `.webp` trong `public/img/fx/`); sửa đầu vào rồi chạy lại công cụ trong `tools/`.

## 4. Quy ước viết mã

- `'use strict'`, CommonJS, dấu chấm phẩy, nháy đơn, thụt 2 dấu cách, `const`/`let` (không `var`). Kiểu nhà máy: `createX(deps)`.
- **Định danh tiếng Anh**, trừ thuật ngữ miền đã có: `congLuc`, `tam.cuong/toc/nhu`, `tu:*`, `vo:*`, `Lc/Lq/Ld`. **Chú thích, log, chữ giao diện, tên test: tiếng Việt có dấu**, lưu UTF-8.
- Chữ giao diện ngắn gọn, giọng nhà chùa, đúng phong cách màn hình đang có. Tiền định dạng `Intl.NumberFormat('vi-VN')` + `đ`.
- CSS theo tiền tố module: `ar-` (sân đấu), `dj-` (Võ Học Các), `fx-` (hiệu ứng), `lib-`, `md-`, `vc-`, `aura-`. Nút chạm tối thiểu 44px. Luôn tôn trọng `prefers-reduced-motion`.
- File lớn, rủi ro cao (`arena.js`, `hall.js`, `app.js`, `server.js`, `dojo.js`): sửa nhỏ, đúng chỗ, không định dạng lại cả file, không đổi tên hàm hàng loạt.
- Tài liệu người dùng (README, docs/) viết tiếng Việt, câu ngắn, cập nhật cùng lúc với mã.

## 5. Môi trường (máy Windows của chủ dự án)

- Repo ở `I:\AnhTu\Side_Project\Pagoda-online`. Shell mặc định là **PowerShell 5.1**: `Get-Content` không có `-Encoding utf8` sẽ làm hỏng dấu tiếng Việt (file không BOM). Dùng công cụ Read của agent, hoặc `Get-Content -Encoding utf8`; ghi file bằng công cụ Write/Edit, không dùng `Set-Content` mặc định.
- Node trên máy có thể mới hơn production (đã thấy v25); production là Node 22. Không dùng API chỉ có ở Node > 22.
- Không có `gh` CLI. Thao tác GitHub (PR, xoá nhánh) để chủ dự án làm hoặc hỏi trước.
- Không có PostgreSQL cục bộ thì các test PG tự bỏ qua; ghi rõ điều đó trong báo cáo.

## 6. Định nghĩa "xong" (Definition of Done)

Trước khi báo xong, tự kiểm theo thứ tự:
1. `npm run check` sạch (tự quét file JS mới, không phải thêm tay).
2. Chạy test của khu vực mình sửa (`node --test test/<file>`), rồi `npm test` nếu đụng `server.js`, `lib/store*`, `lib/pk/*` hoặc giao thức. Thêm/sửa test cho hành vi mới; test e2e dùng `test/helpers/live.js` và `client.js`.
3. Đụng giao diện Võ Học Các / Sân đấu: chạy ui-harness tương ứng (hoặc ghi rõ là chưa chạy được và vì sao).
4. Đổi số liệu chiêu/luật PK: chạy `npm run sim` và ghi kết quả trước/sau vào PR hoặc `docs/VO-HOC-CAN-BANG.md`.
5. Đã cập nhật tài liệu liên quan (README, `docs/VO-HOC-GIAO-THUC.md`, ARCHITECTURE.md nếu đổi cấu trúc) và các điểm đồng bộ ở §3.12–13.
6. Cập nhật thẻ việc trong [task.md](task.md) và viết báo cáo bàn giao theo mẫu ở ORCHESTRATION.md §6.

## 7. Git và phối hợp nhiều agent

- **Một thẻ việc = một nhánh = một PR.** Tên nhánh: `<agent>/<mã-thẻ>-<slug-không-dấu>`, ví dụ `codex/T-003-check-tu-dong`, `claude/T-006-test-dong-bo`. Không commit thẳng lên `main` trừ khi chủ dự án bảo.
- Commit message tiếng Việt, câu mệnh lệnh ngắn, mô tả kết quả (theo lịch sử repo: "Thêm danh hiệu PK và tên cảnh giới nội công").
- **Trước khi bắt đầu:** mở `task.md`, kiểm tra thẻ không có ai nhận và các thẻ "Đang làm" khác không chạm cùng file nóng (ORCHESTRATION.md §4). Nhận thẻ bằng cách điền `Người làm` + `Nhánh` + chuyển trạng thái sang `🟡 Đang làm`.
- **Không làm việc ngoài phạm vi thẻ.** Thấy lỗi khác thì ghi thành thẻ mới trong `task.md` mục "Hộp thư đến", không tự sửa.
- Không force-push, không xoá nhánh, không rebase nhánh của agent khác, không merge PR, không đổi cấu hình deploy nếu thẻ không nói rõ.
- Bị chặn (thiếu quyết định, thiếu khóa, test hỏng không do mình): dừng, ghi lý do vào thẻ (`🔴 Bị chặn`) và hỏi chủ dự án, không đoán.
