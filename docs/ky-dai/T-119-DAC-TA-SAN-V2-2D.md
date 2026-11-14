# Đặc tả T-119 · Bàn 2D dùng ảnh sân v2 và có dải cảnh quanh bàn

> Ảnh sân v2 (T-118, T-118b) là ảnh render cảnh 3D thật: `public/img/kydao/fields2/<mã>-chess.webp` và `<mã>-xiangqi.webp`. Thẻ này cho bàn 2D dùng các ảnh đó, kèm **dải cảnh vật quanh bàn** khi màn hình đủ rộng.
> Làm đúng từng bước. Chuỗi cần tìm không khớp mã thật thì ghi vào bàn giao và chọn cách sửa nhỏ nhất.

**File được sửa:** `public/js/kydao-draw.js`, `public/js/kydao-ui.js` (chỉ hàm `fit` và `redraw`), `public/index.html` (chỉ `?v=`), `public/kydao-skins-test.html` (bàn mẫu), `test/kydao-draw-skins.test.js`, `test/kydao-draw-margin.test.js` (mới).
**Không sửa:** `public/js/kydao-skins.js` (điều phối đã thêm `fieldImage2(id, game)`), ảnh, luật cờ.

## 1. Hình học của ảnh v2 (số cố định)

Ảnh 1408×704 px, **128 px = 1 ô**. Mép TRÊN ảnh là đường giữa bàn; mép DƯỚI là phía người chơi.

| Vùng trong ảnh | px |
|---|---|
| Vùng bàn (8 × 4 ô) | x: 192 → 1216, y: 0 → 512 |
| Dải cảnh trái / phải | x: 0 → 192 và 1216 → 1408 (rộng 1,5 ô) |
| Dải cảnh sau lưng người chơi | y: 512 → 704 (cao 1,5 ô) |

Gọi `M` = bề rộng dải cảnh muốn hiện, tính theo ô, 0 ≤ M ≤ 1,5. Phần ảnh cần lấy cho một nửa sân:
`sx = 192 − M·128`, `sy = 0`, `sw = (8 + 2M)·128`, `sh = (4 + M)·128`.

## 2. Các bước

### Bước 1 · `layout` và `aspect` nhận `margin`

Trong `kydao-draw.js`:

1. `function aspect(game)` → `function aspect(game, margin)`. Với `m = margin > 0 ? margin : 0`:
   - cờ vua: trả `1` (lề đều bốn phía nên vẫn vuông);
   - cờ tướng / cờ úp: nếu `m === 0` trả `9.2 / 10.2` như cũ; nếu `m > 0` trả `(8 + 2 * m) / (9 + 2 * m)`;
   - cờ vây, caro: như cũ, bỏ qua `margin`.
2. `function layout(game, w, h, size)` → thêm tham số thứ 5 `margin`. Với `m = margin > 0 ? margin : 0`:
   - cờ vua: `cell = Math.floor(Math.min(w, h) / (8 + 2 * m))`; `ox`, `oy` vẫn canh giữa như cũ (`Math.round((w - cell * 8) / 2)`…). Thêm `margin: m` vào object trả về.
   - cờ tướng / cờ úp: nếu `m === 0` giữ nguyên công thức cũ; nếu `m > 0`: `cell = Math.min(w / (8 + 2 * m), h / (9 + 2 * m))`, `ox = (w - cell * 8) / 2`, `oy = (h - cell * 9) / 2`. Thêm `margin: m`.
   - cờ vây, caro: không đổi (thêm `margin: 0`).
3. Trong `draw(ctx, o)`: dòng `const g = layout(o.game, o.w, o.h, o.size);` đổi thành `const g = layout(o.game, o.w, o.h, o.size, o.margin);`
4. `squareAt`, `cellXY` không đổi (chúng chỉ dùng `ox`, `oy`, `cell`).

**Bất biến:** `margin` thiếu hoặc 0 thì mọi con số y như trước (test cũ phải vẫn đạt).

### Bước 2 · Chọn ảnh v2

1. Trong `resolveSkins(o)`, chỗ tạo `out[side].field = { id, pal, src }`: thêm trường `src2: cat.fieldImage2 ? cat.fieldImage2(s.field, o.game) : null`.
2. Thêm hàm ngay dưới `paintFieldImage`:
   ```js
   /** Vẽ ảnh sân v2 (có dải cảnh) cho một nửa. dest = hình chữ nhật đích gồm cả dải cảnh; m = bề rộng dải cảnh tính theo ô.
    *  rotated = nửa nằm phía trên màn hình (xoay 180°). Trả true nếu đã vẽ. */
   function paintField2(ctx, dest, rotated, f, m, onAsset) {
     if (!f.src2) return false;
     const img = loadImage(f.src2, onAsset);
     if (!img) return false;
     const sx = 192 - m * 128, sw = (8 + 2 * m) * 128, sh = (4 + m) * 128;
     ctx.save();
     ctx.beginPath(); ctx.rect(dest.x, dest.y, dest.w, dest.h); ctx.clip();
     if (rotated) { ctx.translate(dest.x + dest.w, dest.y + dest.h); ctx.rotate(Math.PI); ctx.drawImage(img, sx, 0, sw, sh, 0, 0, dest.w, dest.h); }
     else ctx.drawImage(img, sx, 0, sw, sh, dest.x, dest.y, dest.w, dest.h);
     ctx.restore();
     return true;
   }
   ```
   Giải thích: nửa dưới màn hình (không xoay) có đường giữa bàn ở mép trên của `dest`, đúng như ảnh. Nửa trên xoay 180° quanh tâm `dest`, nên đường giữa bàn quay xuống mép dưới của `dest`.

### Bước 3 · Cờ vua dùng ảnh v2

Tìm hàm `skinChessFields(ctx, g, flip, sk)` (được gọi trong `drawChessBoard`). Với mỗi nửa `h` trong `chessHalves(g, flip)` có `f = sk[h.side].field`:

1. Tính `m = g.margin || 0` và hình chữ nhật đích gồm dải cảnh:
   - nửa DƯỚI màn hình (`!h.rotated`): `dest = { x: g.ox - m*g.cell, y: g.oy + 4*g.cell, w: (8 + 2*m)*g.cell, h: (4 + m)*g.cell }`
   - nửa TRÊN (`h.rotated`): `dest = { x: g.ox - m*g.cell, y: g.oy - m*g.cell, w: (8 + 2*m)*g.cell, h: (4 + m)*g.cell }`
2. Thử `paintField2(ctx, dest, h.rotated, f, m, sk.onAsset)`.
   - Trả `true`: ảnh v2 đã có sẵn 32 phiến đá hai tông, nên **không** phủ lớp ô sáng/tối đậm nữa. Chỉ phủ rất nhẹ để giữ tương phản: ô sáng `rgba(255,255,255,0.06)`, ô tối `rgba(0,0,0,0.10)`.
   - Trả `false` (ảnh v2 chưa tải hoặc không có): chạy đúng mã cũ của nhánh đó (ảnh v1 + lớp phủ 0,55 / 0,7, hoặc tô đặc theo palette).
3. Khi nửa sân dùng ảnh v2: **bỏ** phần vẽ vân gỗ và khung gỗ của `drawChessBoard` trên nửa đó (vân và khung chỉ vẽ cho nửa không có ảnh v2; cách đơn giản: bọc đoạn vẽ vân + khung trong `ctx.save(); ctx.beginPath(); ctx.rect(<vùng các nửa không có v2>); ctx.clip(); … ctx.restore();`, nếu cả hai nửa đều có v2 thì bỏ qua cả đoạn). `skinChessFields` trả về danh sách bên đã vẽ được ảnh v2 (ví dụ `{ a: true, b: false }`) để `drawChessBoard` biết.
4. Nửa **không có skin** khi `m > 0`: tô dải cảnh của nửa đó bằng màu gỗ sẫm `#2a1c12` (để không lộ nền trong suốt), rồi vẽ bàn mặc định như cũ.
5. Dải mờ ở đường giữa hai nửa (`seamBand`) giữ nguyên, nhưng kéo dài hết bề ngang gồm cả dải cảnh (`x = g.ox - m*g.cell`, `w = (8 + 2*m)*g.cell`).

### Bước 4 · Cờ tướng và cờ úp dùng ảnh v2

Trong `drawXiangqiBoard`, nhánh có skin. Ảnh v2 bản `-xiangqi` là nền đá liền, mã vẫn tự kẻ lưới.
Ánh xạ: **đường giữa bàn của ảnh (y = 0) đặt tại đường hàng sát sông của nửa đó; mép bàn của ảnh (y = 512) đặt tại đường hàng cuối của nửa đó.** Tức 4 ô của ảnh = 4 ô giữa hàng sát sông và hàng cuối.

Với `m = g.margin > 0 ? g.margin : 0.6` (khi không bật lề, bàn cờ tướng vốn có viền 0,6 ô: dùng luôn phần đó làm dải cảnh), cho mỗi nửa có `f`:
- nửa DƯỚI màn hình: `dest = { x: g.ox - m*g.cell, y: g.oy + 5*g.cell, w: (8 + 2*m)*g.cell, h: (4 + m)*g.cell }`
- nửa TRÊN: `dest = { x: g.ox - m*g.cell, y: g.oy - m*g.cell, w: (8 + 2*m)*g.cell, h: (4 + m)*g.cell }`

(`g.oy` là đường hàng trên cùng; `g.oy + 4*g.cell` và `g.oy + 5*g.cell` là hai bờ sông.)

1. Thử `paintField2(ctx, dest, h.rotated, f, m, sk.onAsset)`. `true` thì phủ lớp sáng rất nhẹ `rgba(255,255,255,0.10)` chỉ trong vùng lưới của nửa đó (để nét kẻ dễ đọc) và **không** vẽ nền gỗ, vân gỗ, khung gỗ cho nửa đó; `false` thì chạy mã cũ.
2. Nét kẻ lưới: giữ cách hiện có (viền tối + nét `palette.line`).
3. Khi `g.margin > 0` và một nửa không có skin: tô dải cảnh của nửa đó bằng `#2a1c12`, bàn mặc định như cũ.
4. Nền gỗ chung vẽ ở đầu hàm (`fillRect(g.ox - m, …)` với `m = g.cell * 0.6`) giữ nguyên: nó nằm dưới, ảnh v2 phủ lên.
5. Dòng sông (`drawRiver`) vẫn vẽ sau cùng như hiện tại. Khi có lề, sông kéo dài hết bề ngang gồm dải cảnh: trong `drawRiver` đổi `x0`, `x1` thành `g.ox - mm*g.cell` và `g.ox + (8 + mm)*g.cell` với `mm = g.margin > 0 ? g.margin : 0.1`.

### Bước 5 · `kydao-ui.js`: chọn bề rộng dải cảnh theo màn hình

1. Thêm hàm ngay trên `function fit()`:
   ```js
   /** Bề rộng dải cảnh quanh bàn (tính theo ô). Chỉ bật khi có ít nhất một bên đang hiện skin sân và màn đủ rộng,
    *  để ô cờ trên điện thoại không bị nhỏ đi. */
   function fieldMargin(availW) {
     if (!S || !root.KydaoSkins || !root.KydaoSkins.supports(S.game) || ui.board3d) return 0;
     const foe = S.you === 'a' ? 'b' : S.you === 'b' ? 'a' : null;
     const shown = side => !!S.skins[side].field && !(hideFoe && foe === side);
     if (!shown('a') && !shown('b')) return 0;
     return availW >= 620 ? 1.5 : availW >= 460 ? 0.75 : 0;
   }
   ```
2. Trong `fit()`: sau khi tính `availW`, thêm `const margin = fieldMargin(availW);` và lưu `ui.canvas._margin = margin;`. Hai chỗ gọi `D.aspect(S.game)` đổi thành `D.aspect(S.game, margin)`.
3. Trong `redraw()`: thêm `margin: ui.canvas._margin || 0` vào object `options`.
4. Khi skin đổi thì cỡ bàn có thể đổi: trong `api.apply`, nhánh `type === 'skin'`, đổi `redraw();` thành `fit(); redraw();`. Trong chỗ bật/tắt "Ẩn skin đối thủ" (`hideFoe = !hideFoe; …`), đổi `redraw()` thành `fit(); redraw()`.
5. `boardOffset()`, `halfRect()`, `fxPoint()` không đổi: chúng lấy toạ độ từ `geom` và canvas. Riêng `halfRect` đang chia đôi **cả canvas**; khi có lề vẫn đúng ý (nửa sân gồm cả dải cảnh).

### Bước 6 · Trang thử và `?v=`

- `public/kydao-skins-test.html`: hai bàn mẫu truyền thêm `margin: 1.5` và tăng cỡ canvas tương ứng (cờ vua 484×484, cờ tướng 484×528) để điều phối xem bằng mắt.
- `index.html`: tăng `?v=` của `kydao-draw.js`, `kydao-ui.js`, `kydao-skins.js` (cộng 1).

### Bước 7 · Test

`test/kydao-draw-margin.test.js` (mới, tên tiếng Việt, dùng khuôn Canvas giả của `test/kydao-draw-skins.test.js`):
1. `layout không có margin trả đúng số cũ` (so với giá trị tính tay cho cờ vua 400×400 và cờ tướng 460×510).
2. `layout có margin 1.5: ô nhỏ lại đúng tỉ lệ, bàn vẫn canh giữa` (cờ vua 440×440 → `cell === 40`, `ox === 60`).
3. `squareAt và cellXY khứ hồi đúng với margin 1.5` cho 64 ô cờ vua và 90 điểm cờ tướng, cả `flip`.
4. `aspect có margin`: cờ vua 1; cờ tướng `(8+3)/(9+3)`.
5. `ảnh v2 chưa tải thì vẫn vẽ theo đường cũ, không ném lỗi` (Node không có `Image`).
Test cũ trong `kydao-draw-skins.test.js` phải vẫn đạt; chỉ sửa khi nó khẳng định điều trái với đặc tả này.

## 3. Kiểm

Chạy trực tiếp: `node test/kydao-draw-margin.test.js`, `node test/kydao-draw-skins.test.js`, `node test/kydao-draw-river.test.js`, `node test/kydao-ui-core.test.js`, `node test/kydao-ui-games.test.js`, `node test/kydao-app.test.js`. Rồi `npm run check` nếu chạy được.

## 4. Không làm

Không đổi vùng chạm, tên ô, luật. Không đụng bàn 3D. Không xoá ảnh v1. Không commit `.blend`. Không mở trình duyệt (điều phối xem).
