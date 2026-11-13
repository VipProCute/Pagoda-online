# Kế hoạch đợt 3D · Chùa Tâm An

> Lập ngày 2026-11-13 theo yêu cầu chủ dự án: chuyển game sang đồ họa 3D, cho chọn góc nhìn thứ nhất hoặc thứ ba ở Chánh điện, Sân chùa, Tàng Kinh Các, Sân đấu; PK giữ góc nhìn thứ ba; nâng cấp quân cờ.
> Thẻ việc: T-080 → T-099 trong [task.md](../task.md). Quy trình: [agents/ORCHESTRATION.md](agents/ORCHESTRATION.md).

## 0. Đọc nhanh

- **Không viết lại game.** Máy chủ, giao thức, luật chơi giữ nguyên. Thế giới vốn đã là toạ độ sàn `x, z` trong 0..1, nên 3D chỉ là **một lớp vẽ mới** đọc cùng trạng thái mà `hall.js` đang giữ.
- **2D vẫn còn và là mặc định** cho tới khi 3D ổn. 3D bật bằng nút "3D" (lưu `ta-view`). Máy yếu, không có WebGL2, hoặc lỗi lúc nạp thì tự quay về 2D.
- Mã 3D nạp **lười** (`import()` khi người chơi bật), người dùng 2D không tốn thêm băng thông.
- Dựng hình **bằng mã** (low-poly, thủ tục), không dùng mô hình bên thứ ba ở giai đoạn đầu: nhẹ, không vướng giấy phép.
- PK (sàn đấu trong `arena.js`) **không đổi** ở đợt này: vẫn góc nhìn thứ ba như hiện tại. Bản 3D của sàn PK (máy quay cố định) để sau, thẻ T-097.

## 1. Quyết định (mặc định Điều phối chọn; chủ dự án đổi được)

| # | Việc | Mặc định | Vì sao |
|---|---|---|---|
| Q1 | Thư viện 3D | **Three.js** (MIT), cài qua `npm` (`dependencies`), máy chủ phục vụ `/vendor/three` từ `node_modules/three/build` | Không cần bundler; phiên bản khóa bằng `package-lock.json`; không chép tệp 700 KB vào repo |
| Q2 | Dạng module | ES module đuôi **`.mjs`** trong `public/js/world3d/`, nạp bằng `import()`; `index.html` có `importmap` cho `three` | Three.js bản mới chỉ có ES module; mã 2D cũ không bị đụng |
| Q3 | Mặc định 2D hay 3D | 2D mặc định; có nút đổi. Khi đủ 4 cảnh và qua bài kiểm máy yếu thì đổi mặc định sang 3D cho máy có WebGL2 | An toàn khi phát hành dần |
| Q4 | Phong cách | Low-poly mộc: gỗ nâu đỏ, ngói âm dương, vàng đồng, ánh nến ấm; bóng đổ mềm ở mức Cao | Hợp chùa Việt, chạy được trên điện thoại |
| Q5 | Góc nhìn | Thứ ba (mặc định): máy quay sau lưng, kéo để xoay, cuộn/chụm để thu phóng. Thứ nhất: ngang tầm mắt, kéo để nhìn quanh. Phím `V` hoặc nút 👁 để đổi | Theo yêu cầu |
| Q6 | Di chuyển | Giữ "chạm sàn để đi" ở cả hai góc nhìn. Thêm WASD / cần ảo: trình duyệt gửi `move` tới điểm cách 0,12 phía trước, tối đa 8 lần/giây | Không đổi giao thức; máy chủ vẫn là trọng tài vị trí |
| Q7 | PK | Không có góc nhìn thứ nhất. Sàn PK giữ nguyên 2D hiện tại | Theo yêu cầu |
| Q8 | Quân cờ | Làm 2 bước: (a) vẽ lại quân 2D đẹp hơn ngay (T-090); (b) bàn cờ 3D với quân tiện tròn, xoay được (T-091) | Bước (a) có lợi cả cho máy yếu |

## 2. Kiến trúc

```
hall.js (giữ trạng thái: người chơi, NPC, nhang, bàn đá, bồ đoàn; nội suy vị trí)
   │  Hall.view3d = { snapshot(), handlers, hold(on) }      ← T-088 (thẻ duy nhất chạm hall.js)
   ▼
public/js/world3d/
  index.mjs     World3D.start({canvas, scene, getState, on}) / setScene / setView / setQuality / stop
  camera.mjs    máy quay thứ nhất / thứ ba (dùng phần toán thuần ở view-math.js)
  input.mjs     kéo xoay, chụm, WASD, cần ảo, raycast chạm sàn / người / vật
  kit.mjs       khối dựng: mái ngói cong, cột, tường, đèn lồng, bồ đoàn, kệ, bàn đá, cây, vật liệu
  avatar.mjs    nhân vật low-poly (nam/nữ, 12 màu áo, 4 kiểu tóc), NPC, đi / vái / ngồi, nhãn tên, hào quang
  scenes/hall.mjs · yard.mjs · library.mjs · arena.mjs
  board3d.mjs   bàn cờ 3D (cờ vua, cờ tướng, cờ vây, caro)
public/js/view-math.js   UMD thuần (test bằng node): đổi toạ độ sàn ↔ thế giới, quỹ đạo máy quay, điểm đi tới theo hướng nhìn
```

Quy ước chung (mọi thẻ theo):

- Sàn `x∈[0,1], z∈[0,1]` ↔ thế giới `X = (x-0.5)·W`, `Z = (z-0.5)·D`, mét; `W, D` mỗi cảnh khai trong `view-math.js` (`SCENE_SIZE`). `z` lớn = gần người xem ở bản 2D = gần cửa ở bản 3D; bàn thờ / tượng ở phía `z` nhỏ.
- Mỗi file cảnh xuất `build(ctx) → { group, update(state, dt), pick(raycaster), dispose() }`.
- `World3D` không tự giữ trạng thái game; mỗi khung hình hỏi `getState()`.
- Chạm vật trong 3D gọi **đúng các handler mà 2D đang gọi** (`floor`, `person`, `seat`, `table`, `bowl`, `statue`, `lib`…), nên `app.js` không phải biết đang 2D hay 3D.
- Chữ người dùng (tên, bong bóng chat) vẽ lên `CanvasTexture` bằng `fillText`, không qua `innerHTML`.
- Tôn trọng `prefers-reduced-motion`: tắt lắc đầu khi đi, tắt hạt, máy quay không trượt mượt.
- Ba mức chất lượng: Thấp (không bóng đổ, tỉ lệ điểm ảnh 1), Vừa, Cao (bóng mềm, hạt khói nhang). Tự hạ mức khi dưới 30 khung hình/giây trong 3 giây.

## 3. Ý tưởng đề xuất thêm

| Ý | Giá trị | Thẻ |
|---|---|---|
| Ngày và đêm theo giờ Việt Nam, đèn lồng sáng lúc tối | cảnh sống động, đã có `yardInDaylight` | T-094 |
| Tiếng nói theo khoảng cách (WebRTC + `PannerNode`): đứng gần nghe rõ, xa nghe nhỏ | hợp với góc nhìn thứ nhất | T-095 |
| Trang trí lễ theo âm lịch (hoa đăng Rằm, Vu Lan, Phật Đản, Tết) | đã có `lunar.js` | T-096 |
| Sàn PK 3D, máy quay thứ ba cố định, chiêu có hiệu ứng hạt | nâng cảm giác PK mà không đổi cách chơi | T-097 |
| Chụp ảnh lưu niệm (ẩn giao diện, lưu PNG) | người chơi chia sẻ, quảng bá miễn phí | T-098 |
| Bản đồ nhỏ góc màn hình ở góc nhìn thứ nhất | đỡ lạc | T-099 |

Các thẻ này ở trạng thái ⚪; chủ dự án chọn thì Điều phối viết đủ trường.

## 4. Định tuyến mô hình (đo ngày 2026-11-13 qua CLIProxyAPI cổng 8317)

Dùng được: `gpt-6.1-sol`, `gpt-6.1-terra`, `gpt-6-sol`, `gpt-6-astra`, `gpt-6-luna`, `gpt-5.6-*`, `gemini-3.8-flash-high`, `gemini-3-flash`, `gemini-3.5-flash-lite`, `gemini-4-argon-high`, `grok-4.7-build-fast`. **Không dùng được hôm nay:** GLM (429 hết số dư), Kimi (403).

| Vai | Mô hình | Việc |
|---|---|---|
| Điều phối | Claude Opus 5 / Fable | chia thẻ, xem diff thật, chạy lại test, gộp |
| Thợ khó | **gpt-6.1-sol** (Codex CLI qua proxy) | nền 3D, nối file nóng, nhân vật, bàn cờ 3D |
| Thợ vừa | **gpt-6.1-terra** | toán máy quay, bộ khối dựng, từng cảnh, quân cờ 2D |
| Thợ dễ | **gpt-6-luna**, gpt-6-astra | cài đặt đồ họa, ui-harness, việc máy móc |
| Nội dung, tài liệu | gemini-3.8-flash-high, gemini-3-flash | README, Sổ tay, chữ giao diện |
| Soát giao diện | gemini-4-argon-high | ảnh chụp 3 cỡ màn, chữ |
| Soát mã | khác thợ: gpt-6-sol soát thẻ terra/luna; Claude Sonnet 5.5 soát thẻ sol | checklist ORCHESTRATION §7 |
| Dự phòng | Claude Sonnet 5.5 → Haiku 5.5 (việc nhỏ) | khi GPT kẹt quá 2 vòng |

Cách chạy thợ GPT: `codex exec --cd <worktree> --sandbox workspace-write -m <model>` với `model_providers.cliproxy.base_url=http://127.0.0.1:8317/v1` (`wire_api="responses"`, khóa lấy từ biến môi trường, không ghi vào lệnh hay log).

## 5. Lịch theo đợt và khóa vùng nóng

| Đợt | Thẻ (song song) | Vùng nóng |
|---|---|---|
| 1 | T-080 nền 3D · T-081 toán máy quay · T-090 quân cờ 2D | T-080: `server.js` (1 route), `package.json`, `tools/check.js` |
| 2 | T-082 khối dựng · T-083 nhân vật · T-089 cài đặt đồ họa · T-091 bàn cờ 3D | file mới |
| 3 | T-084 Chánh điện · T-085 Sân chùa · T-086 Tàng Kinh Các · T-087 Sân đấu | file mới |
| 4 | T-088 nối vào game (góc nhìn 1/3, nút 2D/3D) | **`hall.js`**, `app.js`, `index.html`, `arena.js` (chỉ chỗ `Hall.attach`) |
| 5 | T-092 ui-harness 3D + ảnh · T-093 README, Sổ tay | — |

Thứ tự trên `hall.js` so với đợt 2026-11: T-042 → T-043 → T-062 đang xếp hàng; **T-088 chỉ thêm API đọc, không sửa hàm vẽ**, đi sau thẻ nào đang 🟡 trên `hall.js` lúc đó. `kydao-draw.js`: T-090 trước, T-033 gộp `main` sau.

## 6. Rủi ro

| Rủi ro | Cách giảm |
|---|---|
| Điện thoại yếu, nóng máy | 3 mức chất lượng, tự hạ mức, giới hạn 30 khung hình/giây ở mức Thấp, 2D luôn sẵn |
| Say chuyển động ở góc nhìn thứ nhất | không lắc đầu mặc định, trường nhìn 70°, tôn trọng giảm chuyển động |
| Lệch vùng chạm giữa 2D và 3D (bồ đoàn, bàn đá) | toạ độ lấy từ cùng hằng số (`LIB_SEATS`, `YARD_TABLES`) qua `snapshot()`; test đồng bộ |
| Test chạy trong `node:vm` hỏng vì đổi API `Hall` | T-088 chỉ **thêm** API, không đổi tên cũ |
| Mô hình ngoài viết sai phạm vi | mỗi thẻ một worktree; Điều phối xem diff và chạy lại `npm run check` + test trước khi nhận |

## 7. Chỗ dừng (2026-11-13, 20:30)

- **Đã gộp vào nhánh tích hợp** `claude/game-3d-graphics-upgrade-c0aff2` (chưa push): toàn bộ T-080 đến T-093. 3D đã chạy trong game thật ở bốn cảnh, đổi được góc nhìn thứ nhất / thứ ba.
- **Thêm ngoài thẻ:** tượng Phật giữa Chánh điện 3D mang ảnh mặt như bản 2D (`kit.mjs` tham số `headless`, `scenes/hall.mjs`).
- **Chưa kiểm bằng tay:** trận PK thật (ẩn nút góc nhìn mới có test), điện thoại thật (cần ảo, mức Thấp), vùng chạm bàn đá và bồ đoàn trong 3D.
- **Nợ nhỏ:** quân trắng bàn cờ 3D hơi cháy sáng; bàn cờ và nút "Bàn 3D" chưa hiện trong game tới T-034.
- **Việc kế tiếp (chờ chủ dự án):** push và mở PR; chọn ý tưởng T-094 đến T-099.
