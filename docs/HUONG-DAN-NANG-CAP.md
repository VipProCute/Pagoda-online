# Hướng dẫn nâng cấp Chùa Tâm An
Cẩm nang dùng khi thêm tính năng, sửa luật chơi, thay tài nguyên hoặc nâng thư viện.
Người đọc biết lập trình nhưng chưa cần biết cấu trúc repo.
Đọc kèm [`AGENTS.md`](../AGENTS.md) §3, §4, §6; tài liệu này chỉ chỉ cách áp dụng.
Tra các điểm phải sửa đồng bộ ở [`ARCHITECTURE.md`](agents/ARCHITECTURE.md) §6 trước khi chốt phạm vi.

## 1. Trước khi sửa bất cứ thứ gì

- Mở [`task.md`](../task.md), đọc thẻ và kiểm người đang giữ khu vực liên quan; chỉ nhận đúng phạm vi được giao.
- Theo [`ORCHESTRATION.md`](agents/ORCHESTRATION.md) §3–4: một thẻ, một nhánh, một PR; tránh cùng sửa file nóng.
- Xác định quyết định nào thuộc máy chủ trong `server.js`; trình duyệt chỉ gửi ý định, không tự cấp điểm hay kết quả.
- Đọc `package.json`: dự án chạy trực tiếp bằng `npm start`, không có bước build hay bundler để tự nối module.
- Với `server.js`, `public/js/app.js`, `public/js/hall.js`, `public/js/arena.js`, sửa đúng symbol; tránh định dạng lại cả file.
- Đụng JS/CSS phía trình duyệt thì cập nhật `?v=` trong `public/index.html`; kiểm cả trang thử và đường import liên quan.
- Chốt trước test cần chạy theo [`AGENTS.md`](../AGENTS.md) §6; tối thiểu `npm run check` và test của khu vực sửa.
- Thêm tài nguyên bên thứ ba thì ghi nguồn, tác giả, giấy phép vào NOTICE đúng loại; ảnh dùng `public/img/NOTICE.txt` hoặc `public/img/PHOTO-CREDITS.txt`.

## 2. Bản đồ "muốn đổi X thì sửa ở đâu"

Đọc ô “Phải sửa kèm” như danh sách **phải kiểm**: phần lớn cần sửa, một số file viết chung (như `public/js/places.js`, `lib/store.js`, `lib/store-pg.js`) thường chỉ cần đọc để chắc không phải đổi.
Tên test dưới đây là điểm bắt đầu; thay đổi giao thức hoặc máy chủ cần kiểm rộng hơn theo §6.

| Muốn làm gì | File chính | Phải sửa kèm | Test liên quan |
|---|---|---|---|
| Thêm nơi hoặc cảnh | `server.js`: `PLACES`, `SCENES` | `public/js/app.js`, `public/js/places.js`, `public/js/hall.js`, `public/js/mapbar.js` | `test/e2e-scene.test.js`, `test/sync-constants.test.js` |
| Đổi bồ đoàn hoặc bàn đá | `server.js`: `LIB_SEATS`, `YARD_TABLES` | Hai bảng cùng tên trong `public/js/hall.js`; giữ id và tọa độ khớp | `test/hall-tables.test.js`, `test/sync-constants.test.js`, `test/e2e-scene.test.js` |
| Thêm sự kiện socket | `server.js`: `socket.on` | Module nhận trong `public/js/app.js`; tài liệu giao thức của khu vực | `test/e2e-security.test.js`, test e2e cùng tính năng |
| Thêm trường lưu bền | `lib/store-sections.js`: `fresh`, `SECTIONS`, `adopt` | `lib/store.js`, `lib/store-pg.js`; hàm chuẩn hóa dữ liệu của tính năng | `test/store-json.test.js`, `test/store-pg.test.js`, `test/e2e-pg.test.js` |
| Thêm môn cờ hoặc sửa luật | `public/js/kydao/chess.js`, `lib/kydao/registry.js` | `lib/kydao/manager.js`, `public/js/kydao-ui.js`, `public/js/kydao-draw.js`, `docs/KY-DAO-GIAO-THUC.md` | `test/kydao-chess.test.js`, `test/kydao-manager.test.js`, `test/e2e-kydao.test.js` |
| Thêm sân hoặc bộ quân | `public/js/kydao-skins.js` | `tools/blender/kydao/build.py`, `tools/blender/kydao/field2.py`, `public/img/NOTICE.txt` | `test/kydao-skins.test.js`, `test/kydao-default-assets.test.js` |
| Đổi số liệu chiêu hoặc luật PK | `public/js/martial.js`, `lib/pk/rules.js` | `public/js/arena.js`, `lib/pk/buffs.js`, `docs/VO-HOC-CAN-BANG.md`, fixture sân đấu | `test/pk-engine.test.js`, `test/pk-buffs.test.js`, `test/sync-constants.test.js`; `tools/pk-sim/index.js` |
| Sửa tu luyện hoặc học chiêu | `lib/martial/service.js` | `public/js/martial.js`, `public/js/dojo.js`, `docs/VO-HOC-GIAO-THUC.md` | `test/martial-service.test.js`, `test/e2e-martial.test.js` |
| Thêm bài tụng | `public/js/chants.js`, `tools/build_chants.py` | Sinh lại `public/audio/chants/manifest.json`; kiểm `server.js`: `TRACKS`, `public/js/audio.js`; ghi `public/audio/NOTICE.txt` | `test/audio-recovery.test.js`, `test/app-incense-tracks-dom.test.js` |
| Thêm lễ vật | `server.js`: `ITEMS`, handler `offer` | `public/index.html`, `public/js/app.js`, `public/js/hall.js`; bộ đếm trong `lib/store-sections.js` nếu có | `test/e2e-scene.test.js`, `test/store-json.test.js` |
| Thêm quẻ xăm hoặc nội dung tarot | `public/js/fortune.js`: `lots`, `public/data/tarot.vi.json` | `lib/fortune-queue.js`, `lib/tarot-draw.js`, `public/js/tarot.js`, `public/data/NOTICE.txt` | `test/e2e-fortune.test.js`, `test/tarot-data.test.js`, `test/tarot-draw.test.js` |
| Thêm danh hiệu | `lib/records.js`: `TITLES`, `public/js/martial.js`: `pkTitle` | `server.js`, `public/js/hall.js`; phân biệt danh hiệu mùa với danh hiệu PK | `test/records.test.js`, `test/martial-data.test.js` |
| Thêm cảnh 3D | `public/js/world3d/index.mjs`: `SCENES` | `public/js/world3d/scenes/hall.mjs` làm mẫu; `public/js/view-math.js`: `SCENE_SIZE`; cảnh 2D tương ứng | `test/world3d-scene-hall.test.js`, `test/view-math.test.js` |
| Thêm mô hình 3D | `public/js/world3d/board-assets.mjs`, `public/js/world3d/avatar-glb.mjs`; NPC: `public/js/world3d/npc-glb.mjs` (`NPC_GLB`, `LADY_GLB`, `READER_GLB`) | `public/js/world3d/board3d.mjs` hoặc cảnh dùng mô hình; NPC dựng bằng `tools/blender/npc/build.py` ra `public/models/npc/`; `public/img/NOTICE.txt` | `test/kydao-board3d.test.js`, `test/world3d-avatar-glb.test.js` |
| Đổi giao diện một module | `public/js/dojo.js`, `public/css/dojo.css` làm mẫu | `public/index.html`: DOM, thứ tự script, `?v=` | `tools/ui-harness/dojo/test.js`; test của module |
| Thêm biến môi trường | `server.js`: `process.env` | `.env.example`, `README.md`; chỉ đụng `render.yaml` khi thẻ cho phép | Test e2e với env riêng qua `test/helpers/live.js` |
| Thêm chức năng quản trị | `public/admin.html`, `server.js`: `/api/admin/` | Dùng cơ chế kiểm khóa và `audit` đang có; bổ sung quyền và lỗi | `test/e2e-security.test.js`, `test/e2e-donation-test-mode.test.js` |
| Sửa kiểm duyệt, không nới lọc link/số | `lib/moderation.js`: `clean`, `checkMessage`, `checkName` | Các handler nhận chữ trong `server.js`; ca từ lành và ca vi phạm | `test/e2e-security.test.js` |
| Thêm luồng cúng dường | `server.js`: `addDonation`, `donationAck`, `confirmDonation` | `public/js/app.js`, `lib/martial/service.js` nếu đụng hoàn thành nhanh | `test/e2e-donation-test-mode.test.js`, `test/e2e-security.test.js`, `test/e2e-martial.test.js` |
| Thêm kinh văn | `public/kinh/index.json`, `public/js/library.js` | `server.js`: `BOOKS`, `public/kinh/NOTICE.txt`; nội dung kinh theo hướng dẫn trong `README.md` | `test/e2e-scene.test.js` |

## 3. Công thức từng loại nâng cấp

Mỗi bước chỉ tới chỗ cần tìm, không yêu cầu sửa mọi file được nhắc nếu hành vi không đổi.
Chạy lệnh ở gốc repo bằng PowerShell; đọc văn bản với `Get-Content -Encoding utf8`.

### 3.1. Thêm sự kiện socket có ack

1. Trong `server.js`, tìm `socket.on(` và handler cùng nhóm; xác định dữ liệu vào, người được gọi và phòng được nhận.
2. Trong `server.js`, tìm `martialOnly`, `inArena`, `kydaoOnly`; dùng bộ bọc đúng miền, giữ kiểm đăng nhập và giới hạn tần suất.
3. Trong `lib/moderation.js`, tìm `clean`, `checkMessage`, `checkName`; kiểm kiểu, id và chữ trước khi gọi logic nghiệp vụ trong `server.js`.
4. Trong `server.js`, theo mẫu `vo:learn`: trả `ack({ ok:true })` khi xong; lỗi dùng `ack({ ok:false, reason:'…' })`, thêm `code:'login'` khi cần đăng nhập. Không ném lỗi nghiệp vụ.
5. Trong `public/js/app.js`, tìm `socket.on` hoặc `socket.emit` liên quan; xử lý ack lỗi và dữ liệu công khai, không gửi uid người khác.
6. Trong `test/helpers/client.js`, dùng `call`, `waitFor`; thêm ca thành công, payload sai và quyền sai vào test e2e tương ứng.
7. Trong `docs/VO-HOC-GIAO-THUC.md` hoặc `docs/KY-DAO-GIAO-THUC.md`, tìm sự kiện cùng nhóm; ghi payload, ack và thứ tự phát trước khi chạy `npm test`.

Hai điều an toàn dễ quên ([`AGENTS.md`](../AGENTS.md) §3.5 và §3.7): chuỗi từ client mà dùng làm khóa object thì phải kiểm bằng `hasOwnProperty` hoặc `BAD_KEYS` trước (xem mẫu quanh `BAD_KEYS` trong `server.js`); chữ do người dùng hoặc máy chủ gửi thì phía trình duyệt gán bằng `textContent` hoặc `h()`, không dùng `innerHTML`.

Kết quả cần thấy: máy chủ từ chối thao tác sai bằng ack, giao diện vẫn tiếp tục hoạt động.
Sự kiện không tham số nên gửi `{}` kèm callback, theo quy ước giao thức.

### 3.2. Thêm trường lưu bền

1. Trong `lib/store-sections.js`, tìm `SECTIONS`; xác định trường nằm bên trong một bản ghi đã lưu hay tạo section mới.
2. Với trường lồng trong hồ sơ đã lưu, sửa `freshProfile` và `norm` trong `lib/martial/service.js` theo mẫu; bổ sung mặc định cho dữ liệu cũ, không chỉ hồ sơ mới.
3. Với khóa cấp cao mới trong db hoặc nhánh như võ học, sửa đủ `fresh`, `SECTIONS`, `adopt` trong `lib/store-sections.js`; chọn dạng map hoặc array và khóa ổn định.
4. Trong `lib/store-sections.js`, tìm `NESTED`, `martialFresh`, `unknownKeys`; thêm mặc định đúng nhánh, bảo đảm khóa mới không bị bỏ sót khi lưu PostgreSQL.
5. Trong `lib/store.js`, tìm `createStore`; trong `server.js`, tìm `store.save` và `store.flush`; chọn ghi trễ hay đợi ghi xong theo tính chất giao dịch.
6. Trong `test/store-json.test.js` và `test/store-pg.test.js`, tìm `test`; thêm ca dữ liệu cũ thiếu trường, sai kiểu, lưu rồi nạp lại và giữ nguyên tham chiếu db.
7. Trong `test/helpers/live.js`, dùng `startServer` và `restart` để kiểm hành vi sau khởi động lại; cập nhật sơ đồ dữ liệu ở `docs/agents/ARCHITECTURE.md`.

Đạt khi dữ liệu sống qua lần nạp lại ở cả hai backend, không chỉ còn trong RAM.
Nếu không chạy được PostgreSQL, ghi rõ phần đó chưa được nghiệm thu.

### 3.3. Thêm một nơi hoặc cảnh

1. Trong `server.js`, tìm `PLACES` và `SCENES`; chọn nơi là màn riêng, cảnh là không gian trong canvas chung.
2. Nếu thêm nơi, tìm `Places.register` và `martialHost` trong `public/js/app.js`; theo hợp đồng `init`, `mount`, `show`, `hide` của `public/js/dojo.js`.
3. Nếu thêm cảnh, tìm `goScene`, `applyScene` trong `public/js/app.js` và `setScene`, `frame` trong `public/js/hall.js`; thêm vẽ và tương tác cùng nhau.
4. Trong `public/js/mapbar.js`, tìm `MAPS`; khai báo đúng loại scene/place và đối chiếu thứ tự với `SCENES` trong `server.js`.
5. Trong `public/index.html`, tìm `place-dojo` và thẻ nạp `app.js`; thêm khung/nạp module nếu cần, tăng `?v=` của file đã sửa.
6. Nếu có 3D, tìm `SCENES` trong `public/js/world3d/index.mjs`, `SCENE_SIZE` trong `public/js/view-math.js`; giữ tọa độ sàn khớp 2D và máy chủ.
7. Trong `test/e2e-scene.test.js`, tìm `test`; kiểm đi vào, rời cảnh, người xem khác; chạy thêm `test/sync-constants.test.js` cho các bảng dùng chung.

Đừng suy ra cảnh nào cũng là một nơi; Sân đấu có luồng riêng qua nơi arena.
Tra hợp đồng module tại [`VO-HOC-GIAO-THUC.md`](VO-HOC-GIAO-THUC.md) §1 và §6.

### 3.4. Thêm file JS/CSS cho trình duyệt

1. Trong `public/index.html`, tìm các thẻ `script` và `stylesheet`; xác định module cần global nào trước khi chọn vị trí nạp.
2. Trong `public/js/places.js`, tìm `Places`; theo mẫu IIFE cho module trình duyệt, chỉ nối tính năng sau khi phụ thuộc đã sẵn sàng.
3. Nếu dùng chung với Node, xem `public/js/martial.js`: `MARTIAL`, hoặc `public/js/kydao/chess.js`: `KyChess`; giữ IIFE/UMD, không chạm DOM ở mức module.
4. Trong `public/js/app.js`, tìm `martialHost`; đặt phần nối ứng dụng ở đây khi phù hợp, không làm module thuần phụ thuộc socket toàn cục.
5. Trong `public/index.html`, tìm thẻ `app.js` cuối chuỗi; nạp phụ thuộc trước nơi dùng, thêm/tăng `?v=`. Với `.mjs`, kiểm thêm các `import(...)` có `?v=` trong `public/js/view3d-ui.js`, `public/js/kydao-ui.js` (`board3d.mjs?v=`) và bên trong `public/js/world3d/index.mjs`.
6. Trong `tools/check.js`, tìm `SCAN_DIRS`, `collect`; file JS/MJS trong cây được quét tự động, không thêm danh sách kiểm tay. Chạy `npm run check` rồi mở màn dùng file.

CSS theo tiền tố của module và quy ước tại [`AGENTS.md`](../AGENTS.md) §4.
Kiểm trang thử cũng dùng cùng phiên bản, tránh tưởng đã sửa khi trình duyệt vẫn nạp mã cũ.

### 3.5. Thêm môn cờ hoặc sửa luật cờ

1. Trong `docs/KY-DAO-GIAO-THUC.md`, tìm `legalMoves`, `play`, `apply`, `view`; chốt hợp đồng và thông tin công khai trước khi viết luật.
2. Trong `public/js/kydao/chess.js` hoặc `public/js/kydao/xiangqi.js`, tìm `create`, `play`, `status`; theo mẫu UMD thuần, trả state mới, không sửa state đầu vào.
3. Trong `lib/kydao/registry.js`, tìm `registry`, `movePattern`, `paces`; thêm môn hoặc sửa adapter đúng định dạng, nhịp và giới hạn nước.
4. Trong `lib/kydao/manager.js`, tìm `createKydaoManager`; kiểm xác thực lượt, `ply`, đồng hồ, kết thúc và dữ liệu qua `view`, nhất là quân úp chưa lật.
5. Trong `public/js/kydao-ui.js`, tìm `moduleFor`, `handleMoved`; trong `public/js/kydao-draw.js`, tìm `draw`, `layout`; nối luật và bàn, không tự quyết kết quả tại client.
6. Trong `public/index.html`, tìm thẻ nạp `kydao/chess.js`; thêm module trước UI nếu có file mới, tăng `?v=` và sửa `docs/KY-DAO-GIAO-THUC.md` cùng thay đổi.
7. Trong `test/kydao-chess.test.js`, `test/kydao-jieqi.test.js`, tìm `test`; kiểm nước hợp lệ, bất biến state, thông tin ẩn và perft khi phù hợp. Chạy thêm `test/kydao-manager.test.js`, `test/e2e-kydao.test.js`.

Cờ úp dùng biến thể trong `public/js/kydao/xiangqi.js`, không có module riêng để tự động nạp.
Bảng cờ không cấp công đức; máy chủ luôn kiểm lại nước đi.

### 3.6. Thêm sân hoặc bộ quân Kỳ Đài

Quy trình chi tiết: [`HUONG-DAN-SAN-MOI.md`](ky-dai/HUONG-DAN-SAN-MOI.md) và [`README.md`](../tools/blender/kydao/README.md).
Chỉ tóm tắt bốn bước; sân v2 là ảnh nửa bàn dùng chung cho bàn 2D và 3D.

1. Trong `public/js/kydao-skins.js`, tìm `FIELDS`, `PIECES`, `STONES`; thêm mã và bảng màu, kiểm loại cờ hỗ trợ, không nhận tên tự do từ client.
2. Với sân, theo `tools/blender/kydao/fields/forest.py`: `build_forest` và `tools/blender/kydao/field2.py`: `FIELDS`; với quân, xem `tools/blender/kydao/build.py`: `STYLE`, rồi sinh atlas bằng `tools/blender/kydao/pieces2d.py`.
3. Trong `tools/blender/kydao/thu-san.ps1`, tìm `param`; dùng lệnh PowerShell được hướng dẫn để render thử rồi `both final`, kiểm luật K5, dung lượng và độ sáng. Ghi nguồn vào `public/img/NOTICE.txt`.
4. Trong `public/js/kydao-skins.js`, kiểm `fieldImage2`, `piecesModel`; tăng `?v=` ở `public/index.html` và trang thử nạp danh mục, chạy `test/kydao-skins.test.js`, `test/kydao-default-assets.test.js` rồi `npm test`.

Không sửa tay ảnh hoặc mô hình sinh ra. Bộ đá dùng dây chuyền `tools/blender/kydao/stones.py`: `STONES`.
Xem ảnh cạnh bản cũ; giữ khả năng đọc nước đi và đường vẽ dự phòng khi thiếu tài nguyên.

### 3.7. Đổi cân bằng võ học và PK

1. Trong `tools/pk-sim/index.js`, tìm `roundrobin`, `parse`; chạy mốc trước sửa bằng `npm run sim -- roundrobin --games 2000 --seed 1`, lưu seed và số trận.
2. Trong `public/js/martial.js`, tìm `SKILL_LIST`, `SKILLS`, `PK`; sửa danh sách chiêu tại nguồn dùng chung. Luật giải lượt nằm ở `lib/pk/rules.js`: `RULES`, buff nằm ở `lib/pk/buffs.js`.
3. Hằng số PK có **hai cặp đồng bộ khác nhau**, đều được `test/sync-constants.test.js` canh: (a) `RAGE_MAX`, `RAGE_PCT`, `EXPOSED_PCT`, `KC_BONUS`, `KC_TURNS` trong `lib/pk/rules.js` ứng với hằng số đầu `public/js/arena.js` (bên đó ghi phần trăm nguyên); (b) `HP`, thời gian lượt, số lượt tối đa trong `lib/pk/rules.js` (mili giây) ứng với `MARTIAL.PK` trong `public/js/martial.js` (giây).
4. Trong `public/js/arena.js`, kiểm `KC_PCT`, `EXPOSED_PCT`: phần trăm nguyên khác tỉ lệ ở luật; ví dụ `KC_PCT = 25` ứng với `KC_BONUS = 0.25`.
5. Trong `lib/pk/engine.js`, tìm `rng`; giữ thứ tự dùng ngẫu nhiên nếu không chủ đích đổi. Chạy lại cùng lệnh mô phỏng, ghi `BUFF_SCALE` từ `lib/pk/rules.js` (biến môi trường tương ứng là `PK_BUFF_SCALE`) và kết quả trước/sau vào `docs/VO-HOC-CAN-BANG.md`.
6. Trong `tools/ui-harness/arena/gen-fixtures.js`, tìm `writeFileSync`; chạy `node tools/ui-harness/arena/gen-fixtures.js`, rồi `node tools/ui-harness/serve.js 4174` và `node tools/ui-harness/arena/ui-check.js` khi có Playwright.
7. Trong `test/pk-engine.test.js`, `test/pk-buffs.test.js`, `test/sync-constants.test.js`, tìm `test`; chạy các test đó và `npm test`, cập nhật `docs/VO-HOC-GIAO-THUC.md` nếu đổi giao thức và `?v=` trong `public/index.html`.

Mô phỏng là bằng chứng cân bằng, không thay thế test hành vi engine.
Giữ kín lựa chọn đối thủ cho tới sự kiện `pk:reveal`.

### 3.8. Thêm tài nguyên GLB và nạp lười

1. Trong `public/js/kydao-skins.js`, tìm `fieldModel`, `piecesModel`; với nhân vật, tìm `GLB_URL` trong `public/js/world3d/avatar-glb.mjs` để chọn nhánh nạp hiện có.
2. Trong `tools/blender/kydao/build.py`, tìm `build_field`; sinh tài nguyên Kỳ Đài bằng công cụ. Đối chiếu mô hình hiện có `public/models/kydao/pieces/classic.glb`, ghi nguồn ở `public/img/NOTICE.txt`.
3. Trong `server.js`, tìm `THREE_ADDONS`, `express.static`; mô hình được phục vụ từ cây public, loader chỉ được phục vụ qua danh sách cho phép. Không mở toàn bộ thư mục phụ trợ Three.js.
4. Trong `public/js/world3d/board-assets.mjs`, dùng `createAssetLoader`, `loadModel`; loader nạp động, cache theo URL, lỗi trả null để giữ hình dựng bằng mã.
5. Trong `public/js/world3d/board-assets.mjs`, dùng `instantiate`, `disposeAll`; bản dùng riêng phải tự giải phóng tài nguyên, không sửa hoặc hủy mẫu cache dùng chung.
6. Trong `public/js/view3d-ui.js`, tìm `refresh`; trong `public/js/world3d/index.mjs`, tìm `start`, `SCENES`; giữ chuỗi import lười và tăng phiên bản ở các import bị ảnh hưởng cùng `public/index.html`.
7. Trong `test/kydao-board3d.test.js`, `test/world3d-avatar-glb.test.js`, `test/world3d-static.test.js`, tìm `test`; kiểm tải thành công, thiếu file và giải phóng. Xem thêm `public/world3d-board.html` khi đổi bàn.

Cảnh mới theo `public/js/world3d/scenes/hall.mjs`: `build`, `update`, `pick`, `dispose`.
Kiểm cả bật/tắt 3D nhiều lần, mạng lỗi và máy yếu; không chỉ nhìn một ảnh chụp đẹp.

### 3.9. Thêm tính năng liên quan tiền hoặc cúng dường

1. Trong `server.js`, tìm `addDonation`, `donationAck`, handler `donate`; xác định nguồn số tiền và mục đích từ luật phía máy chủ.
2. Trong `server.js`, tìm `store.flush` ngay trước `donationAck`; giữ việc ghi bền trước khi trả QR, thêm ca lỗi ghi để tránh cấp mã chưa lưu.
3. Trong `server.js`, tìm `/api/webhooks/sepay`, `safeEqual`; ở live chỉ cho quản trị hoặc webhook đã xác thực xác nhận; không dùng thông báo từ client để xác nhận đã chuyển tiền.
4. Trong `server.js`, tìm `confirmDonation`, `purpose === 'speedup'`. **Bẫy về tiền:** `confirmDonation` không tự kiểm trạng thái; nó không phát thưởng hai lần chỉ vì mọi nơi gọi hiện nay đều lọc khoản `pending` trước. Nơi gọi mới **bắt buộc** kiểm `d.status === 'pending'`, nếu không sẽ cộng công đức và hào quang hai lần. Speedup chỉ đánh dấu ngân hàng, không tự hoàn thành theo webhook.
5. Trong `lib/martial/service.js`, tìm `onDonationConfirmed`; kiểm ledger của phiên và tình huống phiên đã xong. Trong `server.js`, giữ khoản đã xác nhận, không thêm luồng xóa chúng.
6. Trong `test/e2e-donation-test-mode.test.js`, `test/e2e-security.test.js`, `test/e2e-martial.test.js`, tìm `test`; thêm ca webhook lặp, giả xác nhận, thiếu quyền và flush lỗi, rồi chạy `npm test`.

Các điều cấm và ranh giới quyền quyết định xem [`AGENTS.md`](../AGENTS.md) §3.2–4.
Không đưa khóa hay tài khoản ngân hàng thật vào dữ liệu thử, log hoặc bản diff.

### 3.10. Thêm test đúng tầng

1. Trong `package.json`, tìm script `test`; dùng `node:test`, tên ca bằng tiếng Việt, theo mẫu `test/martial-service.test.js`: `test`.
2. Với logic thuần, tìm `createMartialService` trong `lib/martial/service.js` hoặc `createKydaoManager` trong `lib/kydao/manager.js`; tiêm thời gian, rng và timer thay vì đợi thời gian thật.
3. Với e2e, tìm `startServer` trong `test/helpers/live.js`; helper cấp cổng trống và `DATA_FILE` tạm, có `stop`, `restart`, `admin` để kiểm qua máy chủ thật.
4. Trong `test/helpers/client.js`, tìm `connect`, `join`, `call`, `waitFor`; dùng ack và sự kiện làm mốc, đóng socket và máy chủ trong phần dọn test.
5. Trong `test/e2e-scene.test.js`, tìm `test`; theo mẫu kiểm hai người chơi khi hành vi có phát sóng, thêm ca sai quyền và giữ dữ liệu cũ.
6. Trong `package.json`, tìm `scripts`; dùng `node --test test/martial-service.test.js` cho vùng mẫu; chạy `npm run check`, rồi `npm test` khi chạm máy chủ, store, PK hoặc giao thức theo tiêu chí repo.

Test phải kiểm hành vi người dùng hoặc hợp đồng dữ liệu, không chỉ lặp lại công thức trong mã.
Test trình duyệt bằng VM không đủ thay cho việc xem giao diện thật sau thay đổi bố cục.

## 4. Nâng cấp nền tảng

Node: `render.yaml` đặt `NODE_VERSION` là 22, dù `package.json` chấp nhận từ 18.
Dùng Node 22 để nghiệm thu production; tránh API chỉ có ở phiên bản mới hơn.
Không thêm bước build khi chưa có yêu cầu đổi kiến trúc.

Thư viện: kiểm `dependencies`, `devDependencies`, `scripts` trong `package.json` và phiên bản khóa ở `package-lock.json`.
Nâng từng nhóm nhỏ, đọc diff lockfile, kiểm khả năng chạy trên Node 22 và test hành vi bị ảnh hưởng.
Sau khi lockfile đã cập nhật, dùng `npm ci`, `npm run check`, `npm test` để kiểm cài đặt sạch.
Đừng đánh đồng cài thành công với việc giao thức hoặc giao diện vẫn tương thích.

Three.js: hiện ghim 0.187.0 trong `package.json`; mã ứng dụng nằm ở `public/js/world3d/`.
`server.js` phục vụ bản npm tại `/vendor/three/`, và ba addon qua `THREE_ADDONS` tại `/vendor/three-addons/`.
`public/index.html` ánh xạ `three` bằng import map; các trang thử như `public/world3d-board.html` cũng phải khớp phiên bản.
Kiểm import động, GLTFLoader, giải phóng GPU và đường lùi bằng `test/world3d-static.test.js`, `test/kydao-board3d.test.js` rồi xem bằng trình duyệt.

Socket.IO: kiểm đồng thời `socket.io` và `socket.io-client` trong `package.json`.
`public/index.html` lấy client tại `/socket.io/socket.io.js`; `server.js` tạo `io` với giới hạn gói tin và nhịp kết nối.
Sau nâng, kiểm ack, reconnect/vào lại, thứ tự gói, phòng nhận và WebRTC bằng các test e2e liên quan.

PostgreSQL/Neon: theo [`NEON.md`](NEON.md), đối chiếu `lib/store-pg.js` với `lib/store-sections.js` trước khi nâng `pg`.
Chạy `test/store-pg.test.js`, `test/e2e-pg.test.js` với `TEST_DATABASE_URL` của CSDL thử; ghi rõ nếu test bị skip.
Triển khai: `render.yaml` dùng `npm ci --omit=dev`, chạy trực tiếp `node server.js` để nhận tín hiệu tắt.
Chỉ đổi plan, vùng, biến production hay cấu hình deploy khi thẻ cho phép; giữ secret ở `sync: false`.

## 5. Dữ liệu cũ và tương thích ngược

Trong `lib/martial/service.js`, `freshProfile` tạo hồ sơ mới, còn `norm` bù trường cho hồ sơ đã tồn tại.
Thêm trường phải xử lý cả thiếu giá trị lẫn sai kiểu; không ghi đè số liệu hợp lệ của người cũ.
Trong `lib/store-sections.js`, `adopt` giữ định danh object db; không thay object mà các service đang giữ tham chiếu.
Không có migration tự động theo từng phiên bản; phải kiểm đường nạp qua `adopt`, chuẩn hóa tại service và `repairSeq`.

Thử dữ liệu cũ qua `test/helpers/live.js`: `startServer({ DATA_FILE: ... })`, rồi `restart` với cùng file tạm.
Chuẩn bị bản dữ liệu thử thiếu trường mới, thực hiện thao tác, tắt êm và nạp lại; đối chiếu điểm, phiên và khoản cúng dường.
Helper tự tạo file tạm nếu không truyền `DATA_FILE`; không chạy thử trên dữ liệu vận hành.
Trong PowerShell, đặt biến theo cú pháp `$env:DATA_FILE = 'đường dẫn file thử'`; không dùng cú pháp gán env của bash.

Không xóa khoản đã xác nhận để “làm sạch” dữ liệu; luồng mới phải nhận lại webhook mà không nhân đôi hiệu ứng.
Tính cả thời gian bản cũ và mới chạy chồng lúc deploy; xem `syncDonations` trong `server.js` và hướng dẫn Neon.
Nếu đổi payload, cập nhật hai phía và test vào lại; đừng giả định tab đang mở sẽ tự nạp JS mới.

## 6. Danh sách kiểm trước khi merge

- [ ] Diff đúng thẻ; không có sửa ngoài phạm vi hoặc định dạng lại file lớn.
- [ ] Đã đối chiếu bất biến ở [`AGENTS.md`](../AGENTS.md) §3 và quy ước ở §4.
- [ ] `npm run check` sạch; file JS/MJS mới đã được công cụ tự quét.
- [ ] Test khu vực sửa đạt; ca mới bắt được lỗi cần sửa, có ca sai quyền hoặc đầu vào nếu liên quan.
- [ ] Đã chạy `npm test` khi chạm `server.js`, store, PK hoặc giao thức; báo rõ test skip và phần chưa chạy.
- [ ] Đã kiểm mọi cặp đồng bộ ở [`ARCHITECTURE.md`](agents/ARCHITECTURE.md) §6 có liên quan.
- [ ] Đã tăng `?v=` trong `public/index.html`, trang thử và import liên quan; kiểm đúng bản mã bằng trình duyệt.
- [ ] Đã thử dữ liệu cũ và nạp lại bằng file tạm; khóa mới có đủ `fresh`, `SECTIONS`, `adopt`.
- [ ] Giao diện đã xem trên điện thoại và desktop; chạy ui-harness phù hợp, kiểm giảm chuyển động và đường lùi.
- [ ] Đổi cân bằng có mô phỏng trước/sau cùng seed, số trận, hệ số buff trong `docs/VO-HOC-CAN-BANG.md`.
- [ ] Đã cập nhật `README.md`, tài liệu giao thức võ học/Kỳ Đạo và bản đồ kiến trúc nếu phạm vi yêu cầu; ghi NOTICE cho tài nguyên mới.
- [ ] Người soát độc lập đã đối chiếu diff, chạy lại kiểm tra và so tiêu chí thẻ; CI xanh theo [`ORCHESTRATION.md`](agents/ORCHESTRATION.md) §7.
- [ ] Đã cập nhật thẻ trong `task.md` và bàn giao theo [`ORCHESTRATION.md`](agents/ORCHESTRATION.md) §6; chủ dự án thực hiện merge.

## 7. Bẫy đã từng dính

Các bẫy dưới đây rút từ [`CONTEXT-PACKS.md`](agents/CONTEXT-PACKS.md), `task.md` và hướng dẫn sân mới.

- PowerShell 5.1 đọc/ghi mặc định dễ hỏng dấu; đọc UTF-8 tường minh, ghi bằng công cụ giữ UTF-8.
- Quên `?v=` thì mã public có thể nằm trong cache 10 phút; trang thử cũng có thể nạp phiên bản khác trang thật.
- Thêm khóa cấp cao nhưng thiếu `SECTIONS` khiến JSON trông vẫn đúng mà PostgreSQL không lưu khóa đó.
- Chỉ đổi một nơi của hằng số PK khiến luật và chữ giao diện lệch nhau; đổi engine còn phải sinh lại fixture sân đấu.
- Xóa id DOM mà không sửa `public/js/app.js` có thể làm hỏng cả lúc vào chùa; nhiều chỗ đọc phần tử không kiểm null.
- `public/js/chants.js` là đầu vào công cụ, không được trang chính nạp; sửa nó chưa làm âm thanh hay manifest thay đổi.
- Bàn cờ cần `ply` khớp và `view` an toàn; lộ danh tính quân úp hay uid trong một gói phụ vẫn là lỗi giao thức.
- Thiếu GLB/WebP phải còn đường vẽ bằng mã; `task.md` ghi phần shader hiệu ứng 3D và hiệu năng điện thoại vẫn còn điểm chưa kiểm hết.
- Ảnh quét thật màu be/xám từng làm sân Núi lửa, Sấm sét lệch phong cách; nguồn thật không tự bảo đảm bản mới đẹp hơn.
- File sân Blender dùng chung không gian tên; tên trợ giúp trùng có thể ghi đè khung. Đặt tiền tố theo sân và xem ảnh, vì kiểm tâm vật không ngăn vật lớn chờm lên gờ.

## 8. Làm việc với AI agent

Đọc theo thứ tự `AGENTS.md` → thẻ trong `task.md` → gói tại [`CONTEXT-PACKS.md`](agents/CONTEXT-PACKS.md).
Nạp CORE và gói đúng miền; đọc phần “Đọc kỹ”, chỉ mở “Tra khi cần” lúc chạm tới.
Mỗi agent giữ một thẻ và một bản làm việc; không giao hai agent cùng sửa một file nóng hoặc cùng vùng đang khóa.
Với model nhẹ, đặc tả từng bước bằng file, symbol, đầu vào, kết quả và test cần đạt; ghi rõ ngoài phạm vi.
Giao quyết định đã chốt và báo cáo bàn giao phiên trước; không bắt agent suy ra luật từ lịch sử chat dài.
Nghiệm thu bằng diff, test và ảnh thật; người soát độc lập làm theo [`ORCHESTRATION.md`](agents/ORCHESTRATION.md) §7 trước khi chủ dự án merge.
Khi thiếu quyết định hoặc bị chặn, ghi rõ điểm cần giải quyết vào thẻ; không tự đoán luật chơi, tiền hoặc cách xóa dữ liệu.
