# Đặc tả T-160 → T-163 · Skin đá cho cờ vây và caro

> Yêu cầu của chủ dự án (14/11): cờ vây và caro có **skin quân** đa chủ đề (vũ trụ, rừng, đại dương, dung nham…). **Bàn không cần skin.**
> Nhánh tích hợp đợt 2: `claude/ky-dai-dot-2` (tách từ `main` sau PR #62). Thợ tách nhánh từ đây.
> Danh mục đã có sẵn (điều phối giữ, thợ không sửa): `public/js/kydao-skins.js` → `STONES`, `STONE_GAMES`, `supportsPieces(game)`, `piecesTable(game)`, `normalize(input, game)`, `stones(id)`, `stonesAtlas(id)`.

## 0. Quy ước

- 8 bộ đá: `cosmos` Tinh Hà, `forest` Lâm Tuyền, `ocean` Bích Hải, `magma` Dung Nham, `glacier` Băng Phách, `lotus` Liên Tử, `thunder` Lôi Châu, `sand` Kim Sa.
- Bên `a` (cờ vây: Đen; caro: X) luôn là viên **tối**; bên `b` (Trắng; O) luôn là viên **sáng**. Hai bên phải phân biệt được ngay cả khi mỗi bên dùng một bộ khác nhau: viên tối của mọi bộ đều tối hơn viên sáng của mọi bộ.
- Mỗi người chọn bộ đá cho **quân của mình**; đối thủ thấy. "Ẩn skin đối thủ" áp dụng như ba môn kia.
- Caro: quân là viên đá có khắc dấu **X** (bên a) hoặc **O** (bên b) màu `mark`, để không lẫn với cờ vây và vẫn đọc được X/O.
- `supports(game)` giữ nghĩa cũ (môn có skin SÂN: cờ vua, cờ tướng, cờ úp). Môn có skin quân: `supportsPieces(game)` (cả 5 môn).
- Cờ vây và caro **không có** skin sân, không có nút "Khai mở", không có khẩu hiệu; đổi bộ đá áp ngay.

---

## T-160 · Máy chủ: `kd:skin` cho cờ vây và caro

**File:** `lib/kydao/manager.js`, `docs/KY-DAO-GIAO-THUC.md` (§5.4), `test/kydao-manager.test.js`, `test/kydao-skins.test.js`, `test/e2e-kydao.test.js`.

1. Trong `api.skin` (tìm `KydaoSkins.supports(g.rules.game)`): đổi điều kiện từ chối thành `!KydaoSkins.supportsPieces(g.rules.game)`.
2. Dòng chuẩn hóa `KydaoSkins.normalize({ field: …, pieces: … })`: truyền thêm tham số thứ hai `g.rules.game`.
3. Với cờ vây/caro: khóa `field` do client gửi bị bỏ qua (luôn `null`); nếu client CHỈ gửi `field` (không có `pieces`) thì trả `fail('Môn này không có skin sân.')`. `opened` luôn `false`.
4. Giới hạn tần suất `pieces` (3 giây) giữ nguyên. Payload phát đi và `skins` trong `kd:start`/`resume`/`watch` giữ nguyên hình dạng `{ field, pieces }`.
5. Tài liệu §5.4: thêm đoạn nói cờ vây và caro chỉ có `pieces`, mã tra trong `STONES`.
6. Test (tên tiếng Việt):
   - `kydao-skins`: `normalize(x, 'go')` bỏ `field`, nhận mã trong `STONES`, từ chối mã của `PIECES` không có trong `STONES` (ví dụ `'jade'`) và ngược lại `normalize({pieces:'cosmos'})` (không có game) → `null`; `__proto__` → `null`; mọi bộ trong `STONES` có đủ `a` và `b` với `base`, `accent`, `mark`; viên `a` của MỌI bộ có độ sáng tương đối thấp hơn viên `b` của MỌI bộ (tính luminance từ mã màu `base`).
   - `kydao-manager`: ván caro và ván cờ vây 9×9: đổi `pieces` hợp lệ → phát `kd:skin` có `field:null`, `opened:false`; gửi `field` kèm → `field` vẫn `null`; chỉ gửi `field` → lỗi; mã lạ → `null`; người xem không đổi được; 3 giây.
   - `e2e-kydao`: một ca socket thật trên ván caro.
7. Kiểm: `npm run check`; `node --test test/kydao-*.test.js test/e2e-kydao.test.js`.

---

## T-161 · Blender: ảnh đá 8 bộ

**File:** `tools/blender/kydao/stones.py` (mới), `tools/blender/kydao/README.md`, `public/img/kydao/stones/<id>.webp` (8 file), `public/img/NOTICE.txt`, `docs/ky-dai/anh/da-*.jpg`.

- Mỗi bộ một ảnh **256×128**, nền trong suốt, hai ô 128×128: ô trái = đá bên `a` (tối), ô phải = đá bên `b` (sáng). Nhìn **thẳng từ trên xuống**, viên đá tròn dẹt (dạng đá cờ vây: hai mặt lồi), đường kính **112 px**, tâm ô (64, 64); bóng đổ mềm nhỏ lệch xuống dưới-phải, không vượt mép ô.
- Chất liệu theo chủ đề, làm cho ĐÃ MẮT, đọc màu từ `STONES[id].a|b` (`base` thân, `accent` vân/đốm, `glow` phát sáng nếu có):
  - `cosmos`: thủy tinh tối có bụi sao và tinh vân bên trong (đốm sáng nhỏ ngẫu nhiên + dải mây màu accent); viên sáng là ngọc trai hồng có ánh tinh vân.
  - `forest`: gỗ mun có vân vòng + đốm rêu; viên sáng là gỗ bạch dương có vân.
  - `ocean`: ngọc biển sâu có vệt sóng; viên sáng là ngọc trai có ánh xà cừ.
  - `magma`: đá vỏ chai nứt, khe nứt phát sáng cam; viên sáng là hổ phách nóng có lõi sáng.
  - `glacier`: băng xanh thẫm có vết rạn trắng bên trong; viên sáng là băng tuyết trong.
  - `lotus`: hạt sen nâu bóng; viên sáng là cánh sen hồng có gân, tâm vàng nhạt.
  - `thunder`: đá giông chàm có tia sét mảnh phát sáng; viên sáng là thạch anh có ánh tím.
  - `sand`: đồng cổ có hạt cát vàng; viên sáng là sa thạch vàng vân sóng.
- Mặt trên viên đá phải đủ **phẳng màu ở giữa** (vùng đường kính 60 px) để mã khắc dấu X/O của caro lên đọc được: hoa văn mạnh dồn ra rìa.
- Engine Cycles 64 mẫu + denoise, `film_transparent`, ánh sáng trên-trái có điểm sáng bóng (highlight) rõ, ven sáng nhẹ. Mỗi atlas ≤ 40 KB (WebP có alpha, chất lượng ~88).
- Script theo khuôn `tools/blender/kydao/pieces2d.py` (đọc danh mục qua node, cảnh riêng `KyDaiStones`, tham số `REPO`, `ONLY`, `PREVIEW`; mỗi lần gọi Blender render ít; ghép atlas như `pieces2d.py`).
- Tự chấm khi xem ảnh: (1) nhìn ra chủ đề; (2) viên tối của mọi bộ rõ ràng tối hơn viên sáng của mọi bộ; (3) thu còn 28 px (cờ vây 19×19 trên điện thoại) vẫn phân biệt tối/sáng tức thì; (4) nền trong suốt sạch; (5) tròn, cân giữa.
- Ảnh xem nhanh `docs/ky-dai/anh/da-tong-hop.jpg`: 8 bộ × 2 viên trên nền gỗ bàn cờ vây (màu `#dcb35c`).

---

## T-162 · Bàn 2D và bộ chọn

**File:** `public/js/kydao-draw.js`, `public/js/kydao-ui.js`, `public/css/kydao.css`, `public/index.html` (`?v=`), các trang thử (`?v=`), `test/kydao-draw-stones.test.js` (mới), `test/kydao-ui-core.test.js`, `test/kydao-ui-games.test.js`.

### kydao-draw.js
1. `draw()` hiện bỏ qua skin khi `isGrid(o.game)` (dòng `const sk = isGrid(o.game) ? null : resolveSkins(o);`). Thêm đường riêng cho cờ vây/caro: `const stoneSkins = isGrid(o.game) ? resolveStoneSkins(o) : null;` với
   `resolveStoneSkins(o)` → `null` hoặc `{ a: null | { id, c: STONES[id].a, atlas }, b: null | { id, c: STONES[id].b, atlas }, onAsset }`: bên `a` lấy `o.skins.a.pieces`, bên `b` lấy `o.skins.b.pieces`, tra bằng `cat.stones(id)`, `atlas = cat.stonesAtlas(id)`, áp `o.hideSkins`. Danh mục thiếu `stones` thì trả `null`.
2. `drawStone(ctx, p, cell, side, game)` thêm tham số cuối `skin` (của đúng bên đó) và `onAsset`:
   - Không có `skin`: vẽ y như cũ (bất biến: chuỗi lệnh Canvas không đổi; test cũ đạt mà không sửa).
   - Có `skin` và atlas đã tải (`loadImage(skin.atlas, onAsset)`): `drawImage(img, side === 'a' ? 0 : 128, 0, 128, 128, p.x - T/2, p.y - T/2, T, T)` với `T = cell * 0.88 * 128 / 112` (đá 112 px khớp đường kính `2 * 0.44 * cell` hiện tại).
   - Có `skin` nhưng atlas chưa tải/lỗi: vẽ viên đá bằng gradient như cũ nhưng dùng màu `skin.c.base` (tâm sáng = base pha trắng 35%, rìa = base pha đen 35%) và một vòng mảnh màu `accent`.
   - Caro có `skin`: sau khi vẽ viên đá (ảnh hoặc gradient), khắc dấu X (bên a) hoặc O (bên b) màu `skin.c.mark`, nét `max(2, cell*0.09)`, kích thước 0,5 lần hiện tại (nằm gọn trong vùng giữa viên đá), có viền tương phản mảnh (màu `base`, alpha 0,6, dày gấp 1,8) vẽ trước.
3. Dấu nước vừa đi, dãy thắng caro (`o.win`), đá chết cờ vây (`o.dead`) vẫn vẽ như cũ và phải nằm TRÊN đá có skin (kiểm thứ tự vẽ hiện tại, giữ nguyên).
4. `o.jolt` nếu đang áp cho đá thì vẫn áp.

### kydao-ui.js
5. `canSkin()` hiện dùng `KydaoSkins.supports(S.game)`. Tách: `canSkin()` = người đang chơi, ván chưa hết, và `KydaoSkins.supportsPieces(S.game)`; thêm `canField()` = `canSkin() && KydaoSkins.supports(S.game)`.
6. `redraw()`: khối gán `options.skins` hiện chạy khi `supports(S.game)`; đổi điều kiện thành `supportsPieces(S.game)` (truyền `skins` cho cả cờ vây/caro). `fieldMargin` giữ nguyên (chỉ môn có sân).
7. `readSkins` / `applySkin` trong phần lõi: gọi `K.normalize(x, game)` với game của phiên (`makeSession` truyền `start.game`; `applySkin(S, ev)` dùng `S.game`).
8. Lựa chọn ưa thích lưu RIÊNG cho đá: khóa `localStorage` `kydao.stone` = `{ pieces }` (không dùng chung `kydao.skin`, vì mã bộ khác nhau). `loadPref()`/`savePref()` chọn khóa theo `S.game`.
9. `renderSkins()`: với cờ vây/caro chỉ hiện MỘT hàng "Quân của bạn" lấy từ `K.STONES`; ảnh mỗi mục là atlas của bộ đó cắt đúng ô của bên mình (dùng thẻ `div` có `background-image: url(atlas)`, `background-size: 200% 100%`, `background-position: 0 0` cho bên a hoặc `100% 0` cho bên b; đặt qua `style` thuộc tính riêng lẻ, không ghép chuỗi HTML); KHÔNG có hàng sân, KHÔNG có nút "Khai mở", KHÔNG có dòng đếm ngược; vẫn có nút "Ẩn skin đối thủ". Chọn một bộ → `sendSkin(false)` ngay (như hàng quân hiện tại).
10. `sendSkin`: với cờ vây/caro chỉ gửi `{ gameId, pieces }` (không gửi `field`).
11. `api.open`: tự gửi bộ đá ưa thích khi vào ván (như skin quân hiện tại).
12. `onSkinEvent`: cờ vây/caro không có `opened` nên không phát khẩu hiệu; chỉ vẽ lại (và cập nhật bộ chọn nếu đang mở).
13. Nút "Lãnh địa": ở cờ vây/caro đổi chữ nút thành "Bộ đá" (cùng nút, đổi `textContent` theo môn khi mở ván).
14. CSS: `.kd-skin-stone { width: 60px; height: 60px; border-radius: 50%; background-color: #dcb35c; background-repeat: no-repeat; }`.

### Test
15. `test/kydao-draw-stones.test.js`: không có skin → chuỗi lệnh y như trước (so với bản ghi khi `o.skins` vắng); có skin chưa tải ảnh → màu `base` xuất hiện trong lệnh; ảnh đã tải → `drawImage` với `sx` 0 cho bên a và 128 cho bên b; caro có dấu X/O sau lệnh vẽ đá; `hideSkins` → bên đó vẽ mặc định; dấu nước vừa đi và dãy thắng vẫn nằm sau lệnh vẽ đá.
16. `kydao-ui-core`: `readSkins(raw, 'go')` nhận mã `STONES`, bỏ `field`; `applySkin` trên phiên caro.
17. `kydao-ui-games`: ván caro với `localStorage['kydao.stone']` → có lời gọi `kd:skin` chỉ gồm `pieces`; nút "Lãnh địa"/"Bộ đá" hiện ở caro; bộ chọn không có nút "Khai mở".
18. Sửa `tools/ui-harness/kydao/ui-check.js` kiểm tra `nam-mon-mo-duoc`: trước đây khẳng định nút "Lãnh địa" ẨN ở caro và cờ vây; nay khẳng định nút hiện với chữ "Bộ đá" và bộ chọn không có nút "Khai mở".

Kiểm: `npm run check`; `node --test test/kydao-*.test.js test/e2e-kydao.test.js`.

---

## T-163 · Bàn 3D

**File:** `public/js/world3d/board3d.mjs`, `test/kydao-board3d.test.js`, `?v=` các nơi import.

1. Hiện `readSkins` trả mặc định khi `layout.stones` (cờ vây/caro). Cho phép đọc `pieces` của từng bên qua `catalog.normalize(x, game)` và `catalog.stones(id)`.
2. Đá của mỗi bên dùng vật liệu theo bộ: `MeshStandardMaterial` màu `base`, `roughness 0.25`, `metalness 0.05`; có `glow` thì `emissive = glow`, `emissiveIntensity 0.35`; nếu tải được ảnh atlas thì dùng ô của bên đó làm `map` cho mặt trên (cắt bằng `offset`/`repeat`), không tải được thì chỉ màu.
3. Caro: dấu X/O hiện có đổi sang màu `mark` khi có skin.
4. Đổi skin áp ngay; `dispose` giải phóng vật liệu/texture; test bộ nhớ sẵn có phải đạt.
5. Test: ván cờ vây có `skins.a.pieces = 'cosmos'` → đá bên a dùng màu `STONES.cosmos.a.base`; bên b không skin → mặc định; cờ vua không bị ảnh hưởng.

(Bàn 3D hiện chưa mở cho cờ vây/caro trong `kydao-ui.js`; thẻ này chỉ chuẩn bị `board3d.mjs` và trang thử `world3d-board.html`.)
