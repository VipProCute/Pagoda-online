# Kế hoạch đợt "Kỳ Đài": nâng cấp đồ họa các môn cờ

> Lập ngày 2026-11-13 theo yêu cầu của chủ dự án. Thẻ việc: T-110 → T-125 trong [task.md](../task.md).
> Nhánh tích hợp của đợt: `claude/chess-game-graphics-upgrade-553ef6`. Thợ tách nhánh từ nhánh này, không từ `main`.

## 1. Mục tiêu

1. **Skin sân theo nửa bàn.** Ở cờ vua, cờ tướng, cờ úp, mỗi người khai mở skin cho **nửa sân của mình**. Nửa bên kia giữ skin của đối thủ (hoặc mặc định).
2. **Khẩu hiệu khai mở.** Khi đổi từ sân mặc định sang sân skin, cả bàn thấy màn "Khai mở lãnh địa!" kèm tên sân, nửa sân đổi dần từ mép người chơi ra giữa bàn.
3. **Skin quân cờ riêng**, tách khỏi skin sân. Quân của ai mang skin của người đó.
4. **Chủ đề đa dạng**: núi lửa, sông nước, rừng, núi băng, đại dương, sen, sấm, sa mạc (8 sân + 8 bộ quân ở đợt đầu).
5. **Chấn động khi phong cấp** (cờ vua): Tốt thành Hậu/Xe/Mã/Tượng thì bàn rung, các quân khác nảy lên, có vòng sóng lan từ ô phong cấp.
6. **Hiệu ứng chiến thắng** cho cả 5 môn: chiếu hết, bắt Tướng, đủ 5 quân caro, thắng điểm cờ vây, hết giờ, xin thua.
7. **Tài nguyên dựng bằng Blender** (3D) và **Canva** (2D), có script sinh lại được.
8. Giai đoạn sau: dựng lại nhân vật, trang phục, hào quang 3D bằng Blender.

## 2. Hiện trạng (đã kiểm ngày 2026-11-13)

- Bàn 2D: `public/js/kydao-draw.js` (Canvas 2D, màu viết cứng, không có chuyển động quân). Bàn 3D: `public/js/world3d/board3d.mjs` (dựng bằng mã, quân trượt 360 ms).
- Khung bảng cờ: `public/js/kydao-ui.js`. Phong cấp chỉ là ký tự thứ 5 của nước đi (`e7e8q`); `handleMoved` đang bỏ `info` của luật nên giao diện không biết có phong cấp.
- Kết quả ván: lớp phủ DOM `.kd-result`, không có hiệu ứng.
- Máy chủ chưa có trường nào cho đồ trang trí; chưa có hệ thống sở hữu skin.
- Three.js chỉ phục vụ thư mục `build`; repo chưa có file `.glb` nào. Đợt này đã mở thêm `/vendor/three-addons/` cho đúng ba file của `GLTFLoader`.
- T-033 (cờ vây, caro, cờ úp trên bảng cờ) đã gộp vào nhánh tích hợp ngày 13/11: 197 test Kỳ Đạo đạt.

## 3. Quyết định thiết kế

| Mã | Quyết định | Lý do |
|---|---|---|
| K1 | Danh mục skin là **một file dữ liệu dùng chung**: `public/js/kydao-skins.js` (UMD). Máy chủ, bàn 2D, bàn 3D, Blender đều đọc từ đây. | Một nguồn, không lệch. |
| K2 | Client chỉ gửi **mã skin**. Máy chủ kiểm bằng `KydaoSkins.normalize`, mã lạ thành `null`. Khẩu hiệu lấy từ danh mục, **người chơi không tự gõ**. | Bất biến §3.1, §3.6: không có chữ tự do nên không cần lọc, không có đường lừa đảo. |
| K3 | Skin là trạng thái của **ván** (RAM), không lưu bền trên máy chủ. Lựa chọn ưa thích lưu ở `localStorage` của trình duyệt. | Không đụng `store-sections`; không đổi dữ liệu cũ. |
| K4 | Đợt đầu **mọi skin đều miễn phí, ai cũng dùng được**. Cách mở khóa (công đức, danh hiệu, cúng dường) để 👤 chủ dự án quyết sau; danh mục đã chừa chỗ thêm trường `unlock`. | Đụng tiền thì phải hỏi (AGENTS §7). |
| K5 | Skin quân **không đổi dáng nhận diện**; hai bên luôn tương phản (`a` sáng, `b` tối). Người chơi có nút "Ẩn skin của đối thủ". | Cờ là trò đọc thế; không để skin gây nhầm quân. |
| K6 | Cờ úp: skin chỉ đổi **mặt lưng và chất liệu**; không tạo khác biệt nào giữa các quân úp. | Bất biến KYDAO: không lộ quân úp. |
| K7 | Khai mở sân: mỗi người tối đa **1 lần mỗi 20 giây**; màn khẩu hiệu dài tối đa 1,8 giây, **không chặn nước đi**, không che đồng hồ. | Không dùng hiệu ứng để quấy đối thủ. |
| K8 | Hiệu ứng nằm ở module riêng `public/js/kydao-fx.js` (2D, tiền tố CSS `kdfx-`) và `playFx` của bàn 3D. Tất cả tôn trọng `prefers-reduced-motion` và nút tắt hiệu ứng `ta-fx`. | Quy ước §4. |
| K9 | Tài nguyên: Blender sinh `.glb` (bàn 3D) **và** ảnh `.webp` chụp từ trên xuống (bàn 2D) từ cùng một cảnh. Script ở `tools/blender/kydao/`. Thiếu file thì giao diện lùi về vẽ bằng `palette`. | Một nguồn cho 2D và 3D; quy tắc §3.15. |
| K10 | Dãy thắng caro: trình duyệt tự tính bằng `KyGomoku` từ bàn cuối, **không đổi giao thức**. | Tránh đổi `kd:end`. |

## 4. Hợp đồng kỹ thuật

### 4.1 Danh mục (`KydaoSkins`)

- `FIELDS[id] = { name, cry, sub, palette:{light,dark,line,glow,rim}, fx }`
- `PIECES[id] = { name, a:{base,accent,glow}, b:{base,accent,glow}, rough, metal }`
- `normalize(x) → { field: id|null, pieces: id|null }` · `supports(game)` · `fieldImage(id)`, `fieldModel(id)`, `piecesModel(id)`, `thumb(kind,id)`.

### 4.2 Giao thức (T-110 chốt chi tiết trong `docs/KY-DAO-GIAO-THUC.md`)

- Client → máy chủ: `kd:skin { gameId, field?, pieces? }` + `ack`. Chỉ người đang chơi ván đó, môn thuộc `KydaoSkins.GAMES`.
- Máy chủ → phòng ván: `kd:skin { gameId, side:'a'|'b', field, pieces, opened }`. `opened:true` khi `field` vừa đổi từ `null`/skin khác sang một skin (để chạy màn khai mở).
- `kd:start` / `resume` / `watch` có thêm `skins: { a:{field,pieces}, b:{field,pieces} }`.

### 4.3 Dữ liệu vẽ

`KydaoDraw.draw(ctx, o)` và `board3d.setState(o)` nhận thêm:

```js
o.skins = { a: { field, pieces }, b: { field, pieces } }   // thiếu = mặc định
o.jolt  = { 'e4': { dx, dy }, ... }                         // 2D: độ lệch tạm của quân khi chấn động
```

Nửa sân của bên `a` là nửa có quân `a` lúc khai cuộc. Cờ vua 4 hàng mỗi bên; cờ tướng và cờ úp chia ở sông.

### 4.4 Hiệu ứng (`KydaoFx`)

```js
KydaoFx.mount(wrapEl, { reduced })            // gắn lớp phủ vào .kd-boardwrap
KydaoFx.play('domain',  { side, fieldId, rect })            // khẩu hiệu + nửa sân đổi dần
KydaoFx.play('promote', { at:{x,y}, piece, onJolt(map) })   // chấn động, trả độ lệch từng khung
KydaoFx.play('win',     { game, reason, result, mine, king:{x,y}, line:[{x,y}...] })
KydaoFx.stop()
```

Bàn 3D có `board.playFx(kind, opts)` cùng tên hiệu ứng, toạ độ theo tên ô.

### 4.5 Tài nguyên và ngân sách

| Loại | Đường dẫn | Giới hạn |
|---|---|---|
| Ảnh nửa sân 2D | `public/img/kydao/fields/<id>.webp` (1024×512, nhìn từ trên xuống, mép dưới là mép người chơi) | ≤ 90 KB |
| Ảnh xem trước | `public/img/kydao/thumbs/<kind>-<id>.webp` (256×160) | ≤ 14 KB |
| Mô hình nửa sân 3D | `public/models/kydao/fields/<id>.glb` (đồ trang trí quanh mép nửa bàn; gốc toạ độ ở tâm bàn, +Y lên, mép người chơi về −Z; bàn rộng 8 đơn vị) | ≤ 6.000 tam giác, ≤ 250 KB |
| Mô hình bộ quân 3D | `public/models/kydao/pieces/<id>.glb` (nút tên `K,Q,R,B,N,P`, `disc`; đáy ở Y=0, cao tối đa 1,6) | ≤ 9.000 tam giác cả bộ, ≤ 300 KB |

Mọi tài nguyên nạp lười khi người chơi thật sự bật skin. Ghi nguồn vào `public/img/NOTICE.txt`.

## 5. Chia đợt và phân công

| Đợt | Thẻ | Việc | Thợ | Chạm file nóng |
|---|---|---|---|---|
| 0 | T-033 | Gộp và kiểm 5 môn cờ | Điều phối | (đã xong) |
| 1 | T-110 | Giao thức `kd:skin` trên máy chủ | Claude Opus 5.5 | `server.js`, `lib/kydao/manager.js`, giao thức |
| 1 | T-111 | Dây chuyền Blender + tài nguyên 8 sân, 8 bộ quân | Điều phối (Fable, Blender MCP) | không |
| 1 | T-112 | Module hiệu ứng 2D `KydaoFx` (file mới, có trang thử) | Claude Sonnet 5.5 | không |
| 1 | T-113 | Bàn 3D: nạp `.glb`, skin nửa sân, skin quân, `playFx` | Claude Opus 5.5 | `board3d.mjs` |
| 2 | T-114 | Bàn 2D: vẽ skin nửa sân và skin quân, `jolt` | Claude Sonnet 5.5 | `kydao-draw.js` |
| 3 | T-115a | Bảng cờ: nạp module, giữ trạng thái skin | gpt-6.1-terra | `kydao-ui.js`, `index.html`, `app.js` |
| 3 | T-115b | Bảng cờ: bộ chọn Lãnh địa, màn khai mở | Claude Sonnet 5.5 | `kydao-ui.js` |
| 3 | T-115c | Bảng cờ: chấn động phong cấp, hiệu ứng thắng | gpt-6.1-terra | `kydao-ui.js` |
| 4 | T-116 | ui-harness, ảnh chụp 3 cỡ, Sổ tay, README | Gemini 3.8 Flash + Claude Haiku 5.5 | tài liệu |
| 4 | T-117 | Đồ họa 2D bằng Canva: khung khẩu hiệu, biểu tượng bộ chọn | Claude Sonnet 5.5 (công cụ Canva) | không |
| 5 | T-120 → T-125 | Nhân vật, trang phục, hào quang 3D bằng Blender | Claude Sonnet 5.5 (công cụ Blender), chờ 👤 duyệt bản mẫu T-120 | `avatar.mjs` |

### 5.1 Quy tắc chọn mô hình (chủ dự án chốt ngày 2026-11-13)

- **Điều phối**: Opus 5.5 (hoặc phiên chính). Điều phối viết thẻ, viết đặc tả từng bước, soát diff, chạy test, gộp nhánh; **không** tự lập trình thẻ đã giao.
- **Thực thi** (lập trình, dùng công cụ): ưu tiên mô hình nhẹ: Claude Sonnet 5.5, Claude Haiku 5.5, Gemini 3.8 Flash, gpt-6-luna, gpt-6.1-terra, GLM Flash. Thẻ đã giao cho Opus trước ngày 13/11 (T-110, T-113) giữ nguyên.
- **Nghiệm thu**: Gemini 4 Argon, GPT Sol (gpt-6.1-sol) hoặc Opus, luôn **khác** mô hình đã làm thẻ. Người soát chỉ đọc, không sửa.
- Mô hình ngoài Claude chạy bằng Codex CLI trỏ vào CLIProxyAPI (`http://127.0.0.1:8317/v1`). Sandbox của Codex trên Windows không chạy được `npm` và `git commit`: điều phối chạy test và commit thay thợ.
- Vì thợ là mô hình nhẹ, **mỗi thẻ phải có đặc tả từng bước**: file, chuỗi để tìm chỗ sửa, mã mẫu, lệnh kiểm, và danh sách "không làm". Mẫu: [ky-dai/T-115-DAC-TA.md](ky-dai/T-115-DAC-TA.md). Thẻ nào thợ phải tự thiết kế thì chưa đủ điều kiện "Sẵn sàng".
- Thợ chỉ sửa **thẻ của mình** trong `task.md`, không sửa bảng Tổng quan (điều phối cập nhật), để tránh xung đột khi gộp.

## 6. Rủi ro

- **Hiệu năng điện thoại**: `.glb` và ảnh chỉ nạp khi bật skin; mức đồ họa Thấp bỏ hạt và bóng.
- **Đọc thế cờ**: xem K5. Điểm đánh dấu nước vừa đi, ô được chọn, ô bị chiếu luôn vẽ **trên** skin.
- **Một Blender duy nhất**: việc Blender chạy nối tiếp trong phiên điều phối, không giao song song.
- **Nhân vật 3D từ Blender**: nhân vật hiện dựng bằng mã, 492 tam giác, 60 người trên màn. Phải làm bản mẫu và đo trước (T-120), không thay hàng loạt.

## 7. Câu hỏi mở cho chủ dự án 👤

1. Skin có cần **mở khóa** không (theo công đức, danh hiệu, Elo, hay cúng dường)? Đợt đầu để miễn phí (K4).
2. Có cho người chơi **chọn khẩu hiệu** trong vài câu có sẵn của mỗi sân không? Đợt đầu mỗi sân một câu.
3. Cờ vây và caro có cần skin sân/quân không? Đợt đầu chỉ có hiệu ứng chiến thắng.
