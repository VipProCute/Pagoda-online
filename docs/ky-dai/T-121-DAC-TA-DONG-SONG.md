# Đặc tả T-121 (bàn 2D) và T-122 (bàn 3D) · Dòng sông giữa bàn cờ tướng

> Yêu cầu của chủ dự án (13/11): ngăn cách hai phe ở bàn cờ tướng và cờ úp là **một dòng sông sinh động**. Hai bên dùng skin gì cũng vậy, ở giữa luôn là sông. Áp dụng cả khi **không** có skin.
> Hai thẻ chạy song song được (khác file). Thấy đặc tả mâu thuẫn mã thật thì ghi vào bàn giao, chọn cách sửa nhỏ nhất.

## Quy tắc chung

- Sông nằm đúng **dải giữa hàng 4 và hàng 5** (khoảng trống không có đường dọc), chạy hết bề ngang mặt bàn.
- Nước chảy **từ trái sang phải** màn hình, chậm, êm. Không nhấp nháy, không gây mỏi mắt: mọi chuyển động có chu kỳ ≥ 3 giây, biên độ nhỏ.
- Quân đứng ở hàng 4 và hàng 5 lấn một nửa vào dải sông: **quân luôn vẽ trên sông**, sông không được che quân, dấu nước đi, ô chọn.
- Chữ `楚河 / 漢界` (hoặc `Sở Hà / Hán Giới` khi bật chữ Việt) vẫn giữ, vẽ trên mặt nước: chữ trắng ngà `#fff8e2`, viền tối `rgba(8,30,40,.75)`.
- `prefers-reduced-motion`: sông **đứng yên** (vẫn là sông, chỉ không chuyển động).
- Màu nước mặc định: sâu `#1f6f86`, giữa `#3fa3b8`, sáng `#bfeef2`, bờ cát `#d9c08a`. Không lấy màu theo skin.

---

## T-121 · Bàn 2D

**File được sửa:** `public/js/kydao-draw.js`, `public/js/kydao-ui.js` (chỉ vòng lặp chuyển động, bước 4), `public/index.html` (chỉ `?v=`), `test/kydao-draw-skins.test.js`, `test/kydao-draw-river.test.js` (mới), `public/kydao-pieces-test.html` (tuỳ chọn: bật chuyển động cho bàn mẫu).

### Bước 1 · Hàm thuần `riverWave`

Trong `kydao-draw.js`, ngay trên `function drawXiangqiBoard`, thêm hàm thuần (không đụng canvas) và xuất ra ở dòng `return { … }` cuối file:

```js
/** Độ cao gợn sóng (tính theo ô) tại hoành độ u ∈ [0,1], lớp sóng k = 0..2, thời gian t (ms). Biên độ ≤ 0.06 ô. */
function riverWave(u, k, t) {
  const sp = [0.00022, 0.00031, 0.00017][k % 3], fr = [9, 14, 6][k % 3], am = [0.05, 0.03, 0.06][k % 3];
  return Math.sin(u * fr * Math.PI * 2 - (t || 0) * sp * Math.PI * 2 + k * 1.7) * am;
}
```

### Bước 2 · Hàm `drawRiver(ctx, g, flip, vi, t)`

Thêm ngay dưới `riverWave`. Dùng `cellXY(g, c, r, flip)` để lấy toạ độ:

1. `y0 = min(P(0,4).y, P(0,5).y)`, `y1 = max(...)`; `x0 = g.ox - g.cell * 0.1`, `x1 = g.ox + g.cell * 8.1` (trùng mép khung kẻ đậm). Chiều cao `hh = y1 - y0`.
2. `ctx.save()`, clip hình chữ nhật `(x0, y0, x1 - x0, hh)`.
3. Nền nước: gradient dọc `sâu → giữa → sâu` (0, 0.5, 1).
4. Ba lớp gợn sóng (k = 0, 1, 2): mỗi lớp là một đường `beginPath/moveTo/lineTo` đi qua 33 điểm `u = i/32`, tại `y = y0 + hh * [0.3, 0.52, 0.74][k] + riverWave(u, k, t) * g.cell`, nét `rgba(191,238,242, [0.55, 0.4, 0.3][k])`, dày `max(1, g.cell * [0.045, 0.03, 0.05][k])`, `lineCap = 'round'`.
5. 10 đốm lấp lánh trôi: đốm thứ `i` ở `u = frac(i * 0.137 + (t || 0) * 0.00004 * (1 + (i % 3) * 0.4))`, `y = y0 + hh * (0.18 + 0.64 * frac(i * 0.618))`, hình elip ngang rộng `g.cell * 0.12`, cao `g.cell * 0.025`, màu `rgba(255,255,255,0.55)`. (`frac(x) = x - Math.floor(x)`.)
6. 3 lá sen trôi chậm (tốc độ bằng 1/3 đốm): hình tròn bán kính `g.cell * 0.13`, màu `#3f8f4f`, có một nét khía hình chữ V màu nước; cạnh mỗi lá một chấm hồng `#ff9fb8` bán kính `g.cell * 0.045`. Lá chỉ nằm trong khoảng `y0 + hh*0.3 … y0 + hh*0.7` để không chạm quân ở hai bờ.
7. Hai bờ: dải gradient cao `hh * 0.16` ở mép trên và mép dưới, từ `rgba(217,192,138,0.9)` (sát bờ) tới trong suốt; rồi một nét mảnh `rgba(8,30,40,.35)` đúng tại `y0` và `y1`.
8. `ctx.restore()`.
9. Chữ trên sông: như đoạn "chữ trên sông" hiện có nhưng **luôn** dùng màu chữ `#fff8e2` và viền `rgba(8,30,40,.75)` (viền vẽ trước bằng `strokeText`, dày `max(2, g.cell * 0.09)`).

### Bước 3 · Gọi `drawRiver` trong `drawXiangqiBoard`

- Thêm tham số cuối `t` vào `drawXiangqiBoard(ctx, g, flip, vi, sk, t)` và truyền `o.time` từ `draw()` (tìm chỗ gọi `drawXiangqiBoard(`).
- Trong `drawXiangqiBoard`: **xoá** đoạn "chữ trên sông" cũ (từ dòng chú thích `// chữ trên sông` tới hết 2 lệnh `fillText`) và thay bằng một lệnh `drawRiver(ctx, g, flip, vi, t);` đặt ở **cuối hàm** (sau khi kẻ lưới, kể cả nhánh có skin). Lệnh gọi `seamBand(...)` của nhánh có skin giữ nguyên (sông vẽ đè lên).
- Kiểm: `o.time` thiếu thì sông đứng yên ở pha 0, nên hai lần vẽ liên tiếp cho cùng chuỗi lệnh.

### Bước 4 · Vòng lặp chuyển động trong `kydao-ui.js`

1. Trong `redraw()`, sau khi tạo `options`, thêm: `options.time = riverTime;`
2. Cạnh các biến `let timer = 0, …` thêm: `let riverTime = 0, riverRaf = 0, riverLast = 0;`
3. Thêm hàm ngay trên `function redraw()`:
   ```js
   /** Sông cờ tướng chảy: vẽ lại khoảng 12 lần mỗi giây, chỉ khi bàn 2D đang hiện và không giảm chuyển động. */
   function riverLoop(ts) {
     riverRaf = 0;
     if (!ui || !S || (S.game !== 'xiangqi' && S.game !== 'jieqi') || reduced()) return;
     if (!ui.panel.hidden && !ui.board3d && !minimized && ts - riverLast >= 80) { riverLast = ts; riverTime = ts; if (!S.jolt) redraw(); }
     riverRaf = root.requestAnimationFrame(riverLoop);
   }
   function startRiver() { if (!riverRaf && root.requestAnimationFrame) riverRaf = root.requestAnimationFrame(riverLoop); }
   ```
   (`if (!S.jolt)`: khi đang chấn động thì hiệu ứng đã tự gọi `redraw` mỗi khung.)
4. Trong `api.open`, sau dòng `fit(); render(); tick(); flushPending();` thêm `startRiver();`
5. Trong `api.close()`, đầu hàm thêm: `if (riverRaf && root.cancelAnimationFrame) root.cancelAnimationFrame(riverRaf); riverRaf = 0;`
6. Trong `index.html` tăng `?v=` của `kydao-draw.js` và `kydao-ui.js` (thêm một số vào cuối giá trị hiện có).

### Bước 5 · Test

- `test/kydao-draw-river.test.js` (mới), tên test tiếng Việt: (1) `riverWave` biên độ không vượt 0,06 với 200 điểm ngẫu nhiên; (2) `riverWave` tuần hoàn theo `u` nguyên; (3) vẽ cờ tướng không có `time` hai lần → chuỗi lệnh Canvas giả giống hệt; (4) `time` khác nhau → chuỗi lệnh khác; (5) cờ vua không có lệnh nào mang màu nước `#1f6f86`; (6) lệnh vẽ quân (tìm theo cách test hiện có nhận diện) nằm **sau** lệnh vẽ sông.
  Dùng lại khuôn Canvas giả trong `test/kydao-draw-skins.test.js`.
- `test/kydao-draw-skins.test.js` có test so chuỗi lệnh "không có skin thì y như cũ": với cờ tướng và cờ úp chuỗi mới sẽ khác bản cũ vì có sông. Sửa test đó cho đúng ý mới: **không có skin thì vẫn có sông; có hay không `o.skins` rỗng cho cùng chuỗi lệnh**. Không được xoá test.

### Kiểm

```
npm run check
node --test test/kydao-draw-river.test.js test/kydao-draw-skins.test.js test/kydao-ui-core.test.js test/kydao-ui-games.test.js test/kydao-app.test.js
```

---

## T-122 · Bàn 3D

**File được sửa:** `public/js/world3d/board3d.mjs`, `test/kydao-board3d.test.js`, `public/world3d-board.html` (chỉ `?v=` import), `public/js/kydao-ui.js` (chỉ đổi `board3d.mjs?v=2` → `?v=3`).

1. Tìm trong `board3d.mjs` chỗ dựng **dải sông** của cờ tướng (tìm `楚河` hoặc chữ `sông`/`river`). Hiện dải này là gỗ có chữ.
2. Thay mặt dải sông bằng **mặt nước**: một `PlaneGeometry` đúng kích thước dải (bề ngang hết mặt chơi, bề dọc đúng khoảng giữa hai hàng 4 và 5), đặt cao hơn mặt bàn 0,004 để không chớp hình, vật liệu `MeshStandardMaterial` màu `#2f8aa3`, `roughness 0.15`, `metalness 0.1`, `transparent`, `opacity 0.92`, có `map` là một `CanvasTexture` 256×64 tự vẽ (nền gradient sâu–sáng + 12 vệt sóng trắng mờ ngang), `wrapS = RepeatWrapping`.
3. Chuyển động: trong vòng `render(now)` của bàn, khi game là `xiangqi`/`jieqi` và không giảm chuyển động: `water.map.offset.x = -(now * 0.00003) % 1` và gọi `requestRender()` để khung sau tiếp tục vẽ (bàn hiện chỉ vẽ khi có thay đổi: phải giữ vòng lặp sống **chỉ khi** có sông và canvas đang hiện; mức đồ họa Thấp thì cập nhật 10 lần mỗi giây thay vì mỗi khung). Giảm chuyển động: không cập nhật offset.
4. Hai bờ: hai thanh mỏng màu cát `#d9c08a` cao 0,02 dọc hai mép dải.
5. Chữ `楚河 / 漢界` (hoặc chữ Việt): giữ cách vẽ chữ hiện có nhưng đặt trên mặt nước, màu trắng ngà viền tối, cao hơn mặt nước 0,002.
6. Skin nửa sân **không** được phủ lên dải sông (hiện đã dừng ở bờ; giữ nguyên).
7. `dispose()` phải giải phóng hình, vật liệu, texture của sông (test bộ nhớ hiện có phải vẫn đạt).
8. Test: thêm test `sông cờ tướng: có ở xiangqi và jieqi, không có ở cờ vua` và `giảm chuyển động thì sông không đổi offset` (theo khuôn test hiện có trong file; phần toán offset tách thành hàm thuần export `riverOffset(now)`).

Kiểm: `npm run check`; `node --test test/kydao-board3d.test.js`.
