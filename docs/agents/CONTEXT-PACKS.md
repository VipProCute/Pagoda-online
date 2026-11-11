# Gói ngữ cảnh (Context Packs)

> **Mục đích:** mỗi agent chỉ nạp đúng phần mã cần cho thẻ việc, không đọc cả repo (README 40 KB, `arena.js` 2.000 dòng, `hall.js` 1.900 dòng). Người điều phối ghi mã gói vào trường `Gói ngữ cảnh` của thẻ trong `task.md`; agent đọc **gói `CORE` + các gói ghi trong thẻ**, không hơn.
>
> Cách đọc một gói:
> - **Đọc kỹ**: đọc trước khi sửa.
> - **Tra khi cần**: chỉ mở khi đụng tới, ưu tiên Grep symbol rồi đọc đoạn quanh đó.
> - **Test**: chạy những file này sau khi sửa.
> - **Bẫy**: lỗi hay gặp ở khu vực đó.
>
> Thêm khu vực mới thì thêm gói mới ở đây, cùng định dạng.

## Chỉ mục

| Mã | Khu vực | Khi nào dùng |
|---|---|---|
| `CORE` | Nền chung | **Luôn luôn** |
| `HALL` | Chánh điện, cảnh, nhân vật, Canvas | vẽ, di chuyển, nhân vật, NPC, cảnh sân chùa / Tàng Kinh Các |
| `PLACE` | Thêm "nơi" mới | coi bói, tarot, màn hình riêng mới |
| `RITUAL` | Lễ Phật, công đức, mốc, hiệu ứng | nhang, lễ vật, điểm công đức, pháp tướng, quỷ, `celebrate` |
| `CHANT` | Tụng kinh, âm thanh, TTS | bài tụng, chuông mõ, nhạc nền, giọng chúc, thông báo đọc |
| `LIBRARY` | Tàng Kinh Các, kinh văn | thêm kinh, trình đọc, bồ đoàn ngồi thiền |
| `DONATE` | Cúng dường, hào quang, SePay | VietQR, xác nhận, hào quang 9 cảnh giới |
| `MARTIAL` | Võ Học Các | tu luyện, học chiêu, bộ chiêu, hoàn thành nhanh |
| `PK` | Sân đấu, luận võ | engine, manager, buff, giao diện sân đấu |
| `BALANCE` | Cân bằng số liệu võ học | đổi số chiêu, luật, buff |
| `AUTH` | Đăng nhập Google, tài khoản | phiên, gộp khách vào tài khoản, chặn khi chưa đăng nhập |
| `STORE` | Lưu trữ JSON / PostgreSQL | thêm dữ liệu lưu bền, Neon, công cụ migrate |
| `SOCIAL` | Chat, kiểm duyệt, giọng nói | chat, lời nguyện, báo cáo, lọc tục, WebRTC |
| `ADMIN` | Trang quản trị | `/admin.html`, API admin, nhật ký |
| `OPS` | Triển khai, CI, công cụ | Render, Docker, `package.json`, GitHub Actions |
| `DOCS` | Tài liệu | README, docs/, context cho agent |
| `NAV` | Thanh đổi map, thanh lễ Phật, tab Khám phá | nút điều hướng, thanh dưới, đổi map/nơi |
| `KYDAO` | Kỳ Đạo: bàn cờ ở Sân chùa | luật cờ, bộ quản lý ván, Elo, bảng bàn cờ |
| `RANK` | Danh hiệu, Bảng Vàng, màn đối đầu | người giữ danh hiệu, mùa, bảng xếp hạng |
| `FORTUNE` | Bói toán, lịch âm | xin xăm, tarot, tử vi, `lunar.js` |
| `GUIDE` | Hướng dẫn người mới | Sổ tay, gợi ý lần đầu, viết lại chữ giao diện |

---

## `CORE` · luôn nạp

- **Đọc kỹ**: `AGENTS.md` (tự nạp với Codex; Claude nạp qua `CLAUDE.md`), thẻ việc của mình trong `task.md`.
- **Tra khi cần**: `docs/agents/ARCHITECTURE.md` (mục liên quan), `package.json` (scripts), `.env.example`.
- **Test**: `npm run check`.
- **Bẫy**: PowerShell 5.1 làm hỏng dấu tiếng Việt khi đọc/ghi; `npm run check` tự quét file JS (`tools/check.js`), không thêm tay; sửa `public/` phải tăng `?v=`.

## `HALL` · Chánh điện và Canvas

- **Đọc kỹ**: `public/js/hall.js` (theo symbol: `frame`, `drawBg`, `drawYard`, `drawLibrary`, `drawArenaYard`, phần hit-test, `setScene`, `attach`), phần cảnh trong `public/js/app.js` (`goScene`, `applyScene`, các `socket.on('pj'|'pl'|'p'|'pu'…)`).
- **Tra khi cần**: `server.js` (`SCENES`, `LIB_SEATS`, handler `move`, `scene`, vòng lặp 50 ms trong `startLoops`), `public/css/style.css`, `public/js/aura.js`, `public/js/merit.js` (vẽ pháp tướng/quỷ).
- **Test**: `test/hall-npcs.test.js`, `test/e2e-scene.test.js`.
- **Bẫy**: toạ độ sàn 0..1; `dpr` tối đa 2; sprite là tùy chọn, luôn có đường vẽ dự phòng bằng mã; tôn trọng `prefers-reduced-motion`; `LIB_SEATS` phải khớp `server.js`; test `hall-npcs` chạy `hall.js` trong `node:vm`, đổi API `Hall` là hỏng test.

## `PLACE` · Thêm một "nơi" mới

- **Đọc kỹ**: `public/js/places.js`, đoạn `Places.register` và `martialHost` trong `public/js/app.js`, `docs/VO-HOC-GIAO-THUC.md` §1 và §6 (hợp đồng module), `public/css/places.css`.
- **Tra khi cần**: `server.js` (`PLACES`, handler `place:set`, phát `pplace`), một nơi mẫu (`public/js/dojo.js` phần `init`/`mount`/`show`/`hide`), `public/index.html` (khung `<main class="place" id="place-…" hidden>` và thứ tự script).
- **Test**: thêm test e2e theo mẫu `test/e2e-scene.test.js`.
- **Bẫy**: không đụng chánh điện; thêm tên vào `PLACES`; thêm `<script>` đúng thứ tự (trước `app.js`); module tự đăng ký `socket.on` trong `init`.

## `RITUAL` · Lễ Phật, công đức, mốc, hiệu ứng

- **Đọc kỹ**: `server.js` (`ITEMS`, `KINDS`, `MILESTONES`, `addMeritUid`, `penalize`, handler `incense`, `offer`, `emote`, `mo`, `bell`, `rejoice`), `public/js/merit.js`, `public/js/celebrate.js`.
- **Tra khi cần**: `public/css/celebrate.css`, README mục "Công đức, pháp tướng và quỷ" và "Hiệu ứng mốc công đức", `public/img/memes/`, `public/audio/blessings/manifest.json`.
- **Test**: `test/e2e-666-buff.test.js`, `test/e2e-scene.test.js`; xem thử bằng `?celebrate=100|666|2000`.
- **Bẫy**: mốc do máy chủ quyết, một lần cộng qua nhiều mốc chỉ hiện một (666 ưu tiên); "hôm nay" theo giờ Việt Nam (`vnDay`); `MAX_URL` khớp `safeUrl`; meme mới cần ghi nguồn ở `PHOTO-CREDITS.txt`.

## `CHANT` · Tụng kinh, âm thanh, TTS

- **Đọc kỹ**: `public/js/audio.js`, handler `chant:start` / `chant:stop` và `endChant` trong `server.js`, `public/audio/chants/manifest.json`.
- **Tra khi cần**: `public/js/chants.js` (kinh văn, đầu vào công cụ dựng), `tools/build_chants.py`, `tools/build_blessing_voice.py`, `lib/announce.js`, `tts/README.md`, `public/audio/NOTICE.txt`, README mục "Bài tụng" và "Thông báo cúng dường".
- **Test**: `test/audio-recovery.test.js`, `test/announce.test.js`.
- **Bẫy**: phát đồng bộ theo giờ máy chủ; Safari cần phục hồi AudioContext; **không** sửa tay MP3/JSON sinh ra, chạy lại công cụ; giọng mẫu để ngoài repo; `chants.js` không được trình duyệt nạp (chỉ dùng cho công cụ).

## `LIBRARY` · Tàng Kinh Các

- **Đọc kỹ**: `public/js/library.js`, `public/kinh/index.json`, `public/js/meditate.js` (nếu đụng bồ đoàn).
- **Tra khi cần**: handler `sit`, `stand`, `reading` và `syncCult` trong `server.js`, `drawLibrary` trong `hall.js`, README mục "Tàng Kinh Các" (cú pháp Markdown kinh), `public/kinh/NOTICE.txt`.
- **Test**: `test/e2e-scene.test.js`.
- **Bẫy**: mỗi bồ đoàn một người; đứng dậy không dừng phiên tu; kinh còn bản quyền thì không chép nguyên văn.

## `DONATE` · Cúng dường, hào quang, SePay

- **Đọc kỹ**: `server.js` (`addDonation`, `donationAck`, `confirmDonation`, `syncDonations`, route `/api/webhooks/sepay`, handler `donate`), `public/js/aura.js`.
- **Tra khi cần**: route `/api/admin/donations/*`, `lib/announce.js`, phần cúng dường trong `public/js/app.js`, README mục "Xác nhận cúng dường", "Hào quang", "SePay".
- **Test**: `test/e2e-donation-test-mode.test.js`, `test/e2e-security.test.js`, `test/e2e-martial.test.js` (phần speedup).
- **Bẫy**: xem `AGENTS.md` §3.2. `flush` trước khi trả QR; webhook trả 404 ở chế độ test; speedup chỉ đánh dấu `bank`, chỉ admin xác nhận; xác nhận phải idempotent; không tự điền số tài khoản thật.

## `MARTIAL` · Võ Học Các

- **Đọc kỹ**: `docs/VO-HOC-GIAO-THUC.md` §2, §3, §5; `lib/martial/service.js`; `public/js/martial.js`.
- **Tra khi cần**: `public/js/dojo.js`, `public/css/dojo.css`, handler `martial:state`, `tu:*`, `vo:*` (bọc `martialOnly`) trong `server.js`, `lib/account.js` (`mergeMartialGuest`), `docs/VO-HOC.md`, `tools/ui-harness/dojo/`.
- **Test**: `test/martial-service.test.js`, `test/martial-data.test.js`, `test/e2e-martial.test.js`, `test/account.test.js`, `test/sweeper.test.js` + `test/e2e-sweeper.test.js` (Tảo Địa Tăng truyền thừa, `lib/sweeper.js`); giao diện: `node tools/ui-harness/dojo/test.js` (cần Playwright).
- **Bẫy**: `ledger['session:<id>']` chống cộng thưởng hai lần; giờ do máy chủ quyết, tu luyện chạy cả khi đóng web; service thuần, không ném lỗi; khi bật Google thì mọi sự kiện đổi dữ liệu trả `code:'login'` cho khách.

## `PK` · Sân đấu và luận võ

- **Đọc kỹ**: `docs/VO-HOC-GIAO-THUC.md` §4; `lib/pk/engine.js` (thứ tự tiêu thụ rng ghi ở đầu file); `lib/pk/manager.js`.
- **Tra khi cần**: `lib/pk/rules.js`, `buffs.js`, `rng.js`, `public/js/arena.js`, `public/css/arena.css`, handler `inArena` trong `server.js`, `docs/PK-PHA-SON.md`, `tools/ui-harness/arena/`.
- **Test**: `test/pk-engine.test.js`, `pk-manager.test.js`, `pk-buffs.test.js`, `pk-progression.test.js`, `pk-clash-choreo.test.js`, `pha-son-strategy.test.js`, `e2e-spar-invite.test.js`, `e2e-666-buff.test.js` (buff quỷ trong phòng PK). Giao diện: `node tools/ui-harness/arena/gen-fixtures.js` → `node tools/ui-harness/serve.js 4174` → `node tools/ui-harness/arena/ui-check.js` (cần Playwright; lỗi console là trượt).
- **Bẫy**: **không bao giờ** để lộ chiêu đối thủ trước `pk:reveal` (kể cả gián tiếp); giao diện phải chịu được thứ tự gói tin bất thường (§4 "Ghi chú về thứ tự gói tin"); chỉ tab đang ở `arena` nhận `pk:*`; hằng số ở `rules.js` phải khớp `MARTIAL.PK` và đầu `arena.js`; đổi engine thì tạo lại fixture.

## `BALANCE` · Cân bằng số liệu

- **Đọc kỹ**: `docs/VO-HOC-CAN-BANG.md`, `docs/PK-PHA-SON.md`, `lib/pk/rules.js`, phần số liệu chiêu trong `public/js/martial.js`.
- **Tra khi cần**: `tools/pk-sim/index.js` (lệnh và tùy chọn), `tools/pk-sim/audit100k.js`, `counter-check.js`.
- **Test**: `npm run sim -- roundrobin|grid|buffs|levels|param|progress …` trước và sau khi sửa (cùng `--seed`); thử số không cần sửa file bằng `--set rules.X=n`; cuối cùng chạy nhóm test `PK`.
- **Bẫy**: luôn ghi seed, số trận, hệ số buff (`PK_BUFF_SCALE`) cùng kết quả; cập nhật bảng trong `VO-HOC-CAN-BANG.md`.

## `AUTH` · Đăng nhập Google, tài khoản

- **Đọc kỹ**: `lib/auth.js`, `lib/account.js`, `linkGuest` và `accountOf` trong `server.js`, `accountReady`.
- **Tra khi cần**: handler `join` (uid khách, mã admin), middleware `io.use`, README mục "Bật đăng nhập Google", `public/css/account.css`.
- **Test**: `test/e2e-auth.test.js` (không gọi Google thật: phiên ghi sẵn vào file dữ liệu), `test/account.test.js`.
- **Bẫy**: uid tài khoản là `'google:'+sha256(sub)`; token phiên chỉ lưu dạng băm; gộp khách có hàm hoàn tác khi flush lỗi; kiểm tra `Origin`; `AUTH_ORIGIN` không có `/` cuối.

## `STORE` · Lưu trữ

- **Đọc kỹ**: `lib/store-sections.js` (`fresh`, `SECTIONS`, `adopt`), `lib/store.js`.
- **Tra khi cần**: `lib/store-pg.js`, `tools/db-migrate.js`, `docs/NEON.md`.
- **Test**: `test/store-json.test.js`, `test/store-pg.test.js`, `test/e2e-pg.test.js` (cần `TEST_DATABASE_URL`, không có thì tự bỏ qua; ghi rõ trong báo cáo).
- **Bẫy**: xem `AGENTS.md` §3.11; không thay object `db`; chuỗi được làm sạch cho jsonb; tính tới hai bản chạy chồng khi deploy.

## `SOCIAL` · Chat, kiểm duyệt, giọng nói

- **Đọc kỹ**: `lib/moderation.js`; handler `chat`, `report`, `mod:*`, `voice:*` trong `server.js`.
- **Tra khi cần**: `public/js/voice.js`, README mục "Nói chuyện bằng giọng", "Công đức" (bảng 5 mức trừ), phần chat trong `app.js`.
- **Test**: `test/e2e-security.test.js`, `test/e2e-voice-rooms.test.js`, `test/voice-client.test.js`.
- **Bẫy**: không nới lọc link/số tài khoản; không bắt nhầm từ lành ("chim cút", "đi ngủ"), thêm cả ca dương và ca âm khi sửa bộ lọc; WebRTC tối đa 8 kết nối gần nhất; máy chủ chỉ chuyển tín hiệu, không ghi âm.

## `ADMIN` · Quản trị

- **Đọc kỹ**: `public/admin.html`, các route `/api/admin/*` và `audit(` trong `server.js`.
- **Test**: `test/e2e-security.test.js`, `test/e2e-donation-test-mode.test.js`.
- **Bẫy**: so khóa bằng `safeEqual`; khóa 10 lần sai/10 phút/IP; nhật ký băm IP, không ghi khóa; `export` mặc định không kèm phiên đăng nhập.

## `OPS` · Triển khai, CI, công cụ

- **Đọc kỹ**: `package.json`, `render.yaml`, `Dockerfile`, `.gitignore`.
- **Tra khi cần**: README mục "Đưa lên mạng trong ngày", `tts/Dockerfile`, `docs/NEON.md`.
- **Bẫy**: Render chạy `node server.js` trực tiếp (để nhận SIGTERM); secret trong `render.yaml` để `sync:false`; không đổi `plan`, vùng hay biến production nếu thẻ không nói rõ.

## `DOCS` · Tài liệu

- **Đọc kỹ**: tài liệu sẽ sửa; `docs/agents/*` nếu đổi quy trình agent.
- **Bẫy**: tiếng Việt có dấu, câu ngắn; README là tài liệu cho người vận hành, chi tiết kỹ thuật để ở `docs/`; đổi cấu trúc mã thì cập nhật `ARCHITECTURE.md` và ngày cập nhật ở đầu file.

## `NAV` · Thanh đổi map, thanh lễ Phật, tab Khám phá

- **Đọc kỹ**: `docs/KE-HOACH-DOT-2026-11.md` §4; `public/js/mapbar.js` (khi đã có); trong `public/index.html` các khối `nav.scene-nav` / `.mapbar`, `nav.actions`, tab "Nơi khác"/"Khám phá", `#voicebar`; trong `public/js/app.js` các hàm `applyScene`, `goScene`, `act`, `welcome`, `renderVoice`, `showTab`.
- **Tra khi cần**: `public/js/places.js`, `public/css/style.css` (`.actions`, `.scene-nav`, `.voicebar`, khối `@media`), `public/css/places.css`, phần đầu màn của `public/js/arena.js`.
- **Test**: `test/e2e-scene.test.js`, `test/hall-npcs.test.js`; `tools/ui-harness/arena/e2e-real.js` (bấm nút vào Sân đấu); ảnh chụp 375×812, 768×1024, 1280×800.
- **Bẫy**: `app.js` đọc nhiều id **không kiểm null** (`#actVoice`, `#actDojo`, `#actArena`, các id scene-nav trong `applyScene` và `welcome()`): xóa thẻ HTML là phải sửa JS cùng lúc, không thì hỏng cả lúc vào chùa; lúc vào chùa `applyScene` chỉ chạy qua `fortune.reset → setScene('hall')` (`fortune.js`), sửa `fortune.js` mà bỏ đường này thì thanh đổi map không sáng; bộ bắt `[data-act]` là ủy quyền nên nút `data-act` ở nơi khác vẫn chạy; `act('arena')`/`act('dojo')` có `needLogin`; không thêm nút trò phụ vào thanh dưới; map mới phải thêm vào `MapBar.MAPS`.

## `KYDAO` · Kỳ Đạo: bàn cờ ở Sân chùa

- **Đọc kỹ**: `docs/KY-DAO-GIAO-THUC.md` (sau T-020; trước đó đọc `docs/KE-HOACH-DOT-2026-11.md` §5); module luật của môn mình làm trong `public/js/kydao/`; `lib/kydao/manager.js` nếu đụng luồng ván.
- **Tra khi cần**: `lib/pk/manager.js` (khuôn manager: `arm/disarm`, `finish` idempotent, `resume`, `safe`), `test/pk-manager.test.js` (`makeClock`, env giả), `lib/pk/rng.js` (`makeRng`, `newSeed`), handler `sit` và `inArena`/`martialOnly` trong `server.js`, `ARENA_PROPS`/`seatAt`/`onDown` trong `public/js/hall.js`.
- **Test**: `test/kydao-*.test.js`, `test/e2e-kydao.test.js`; perft sâu với `PERFT_DEEP=1`; giao diện: `tools/ui-harness/kydao/`.
- **Bẫy**: máy chủ luôn kiểm lại nước đi (trình duyệt chỉ gợi ý); `ply` phải khớp; **không bao giờ** gửi danh tính quân úp chưa lật (kể cả cho chính người chơi và người xem); không gửi uid; module luật là UMD không DOM; `play` không sửa state cũ; `YARD_TABLES` phải khớp `server.js` ↔ `hall.js`; nhãn bàn không kết thúc bằng `' · NPC'`; ván cờ không cộng công đức.

## `RANK` · Danh hiệu, Bảng Vàng, màn đối đầu

- **Đọc kỹ**: `docs/KE-HOACH-DOT-2026-11.md` §6; `lib/records.js` (sau T-040).
- **Tra khi cần**: `addMeritUid`, `board`, `publicPlayer` trong `server.js`; `pkTitle` trong `public/js/martial.js`; `norm`/`recordResult` trong `lib/martial/service.js`; `lib/account.js` (gộp khách); `public/js/celebrate.js` (khuôn lớp phủ toàn màn); nhãn tên và "tagger" trong `drawPlayers` của `public/js/hall.js`.
- **Test**: `test/records.test.js`, `test/e2e-titles.test.js`, `test/e2e-security.test.js`, `test/legend.test.js`.
- **Bẫy**: danh hiệu gắn theo `pid`/tên, **không uid**; mùa = tháng âm theo giờ Việt Nam (UTC+7); hòa điểm thì ai đạt trước giữ; danh hiệu chỉ để trưng, không thưởng; màn đối đầu tự vẽ, không dùng hình tác phẩm có bản quyền, không giải thích trong Sổ tay.

## `FORTUNE` · Bói toán và lịch âm

- **Đọc kỹ**: `docs/KE-HOACH-DOT-2026-11.md` §7; `public/js/fortune.js`; `public/js/lunar.js`; với tử vi: `docs/TU-VI-QUY-UOC.md` và Phụ lục B của kế hoạch.
- **Tra khi cần**: handler `fortune:join`/`fortune:leave`/`tarot:draw` trong `server.js`, `lib/fortune-queue.js`, khối `#dlg-fortune` trong `public/index.html`, `drawReaders`/`drawFortuneJar` trong `public/js/hall.js`, `public/data/*.json`.
- **Test**: `test/lunar.test.js`, `test/tuvi.test.js`, `test/tarot-data.test.js`, `test/tuvi-data.test.js`, `test/e2e-fortune.test.js`, `test/e2e-scene.test.js` (xin xăm chỉ ở chánh điện).
- **Bẫy**: tử vi tính trên trình duyệt, **ngày giờ sinh không được gửi đi** (lời hứa đang hiện cho người dùng); xin xăm và rút tarot do máy chủ quyết; nội dung viết mới, không chép web/sách còn bản quyền, ghi nguồn vào `public/data/NOTICE.txt`; lịch âm dùng UTC+8 trước 1968; giữ API cũ của `Lunar` vì đầu trang đang dùng.

## `GUIDE` · Hướng dẫn người mới

- **Đọc kỹ**: `docs/HUONG-DAN-VIET.md` (sau T-060; trước đó `docs/KE-HOACH-DOT-2026-11.md` §8); bảng bí mật ở §8.5.
- **Tra khi cần**: màn mình viết lại (`dojo.js`, `arena.js`, `index.html`, `app.js`); `MERIT.EARN` (`public/js/merit.js`), `MARTIAL.PK` (`public/js/martial.js`) để lấy số liệu thật.
- **Test**: test của khu vực bị sửa chữ; ảnh chụp; bài kiểm người mới (T-066).
- **Bẫy**: **không giải thích bí mật** (666, NPC bí mật, chiêu ẩn, Tảo Địa Tăng, màn đối đầu); số liệu lấy từ mã, không gõ tay; một khái niệm một tên theo bảng thuật ngữ; thẻ viết chữ không đổi logic hay số liệu.
