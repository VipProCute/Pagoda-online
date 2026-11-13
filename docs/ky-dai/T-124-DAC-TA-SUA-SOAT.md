# Đặc tả T-124 · Sửa các lỗi từ đợt soát của GPT Sol (13/11)

> Kết luận soát: FAIL, 1 lỗi chặn + 4 lỗi nên sửa + 1 góp ý. Thẻ này sửa hết. Làm đúng từng bước; chuỗi cần tìm không khớp thì ghi vào bàn giao và chọn cách sửa nhỏ nhất.

**File được sửa:** `public/js/kydao-ui.js`, `public/js/kydao-fx.js`, `public/js/world3d/board3d.mjs`, `public/index.html` (chỉ `?v=`), `public/world3d-board.html` (chỉ `?v=` import), `test/kydao-fx.test.js`, `test/kydao-ui-games.test.js`, `test/kydao-board3d.test.js`.

## Bước 1 · `kydao-ui.js`: công tắc tắt hiệu ứng `ta-fx` có tác dụng ở mọi nơi

Tìm dòng:
```js
const reduced = () => !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches);
```
Thay bằng:
```js
/** Người chơi tắt hiệu ứng ở Chánh điện (localStorage 'ta-fx' = '0') thì bàn cờ cũng không chuyển động. */
const fxOff = () => { try { return !!root.localStorage && root.localStorage.getItem('ta-fx') === '0'; } catch (e) { return false; } };
const reduced = () => fxOff() || !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches);
```
(Mọi chỗ đang gọi `reduced()`, gồm hiệu ứng lật quân úp và vòng lặp sông, tự được sửa theo.)

## Bước 2 · `kydao-ui.js`: hiệu ứng thắng lỗi cũng không được chặn bảng kết quả (LỖI CHẶN)

Trong `api.apply`, nhánh `type === 'end'`, tìm:
```js
const wait = playWin(ev);
```
Thay bằng:
```js
let wait = 0;
try { wait = playWin(ev) || 0; } catch (e) { wait = 0; }
```
Làm tương tự cho hai chỗ gọi `playPromote(` (trong `sendMove` và trong `onMoved`): bọc lời gọi trong `try { … } catch (e) { /* hiệu ứng lỗi không được chặn nước đi */ }`. Và trong `api.apply` nhánh `type === 'skin'`: bọc `onSkinEvent(ev)` trong `try/catch` tương tự.

## Bước 3 · `kydao-ui.js`: "Ẩn skin đối thủ" áp cho cả bàn 3D

Trong `redraw()`, khối `if (root.KydaoSkins && root.KydaoSkins.supports(S.game)) { … }` hiện gán `options.skins = S.skins;` và `options.hideSkins = {…}`. Thay 3 dòng `options.skins`, `const foe`, `options.hideSkins` bằng:
```js
const foe = S.you === 'a' ? 'b' : S.you === 'b' ? 'a' : null;
const blank = { field: null, pieces: null };
// Ẩn skin đối thủ: đưa thẳng skin mặc định cho bên đó, nên bàn 2D và bàn 3D đều theo.
options.skins = { a: hideFoe && foe === 'a' ? blank : S.skins.a, b: hideFoe && foe === 'b' ? blank : S.skins.b };
```
(Bỏ `options.hideSkins`.)

## Bước 4 · `kydao-ui.js`: callback ảnh ổn định

Ngay trên `function redraw()` thêm: `const onAsset = () => { if (ui && S) redraw(); };`
Trong `redraw()` đổi `options.onAsset = () => { if (ui && S) redraw(); };` thành `options.onAsset = onAsset;`

## Bước 5 · Khẩu hiệu hiện chữ cả khi đang bật bàn 3D

1. `kydao-fx.js`, hàm `playDomain(o)`: dòng `if (isReduced()) return;` đổi thành `if (isReduced() || o.bannerOnly) return;`
2. `kydao-fx.js`, hàm phát hiệu ứng thắng (tìm hàm có `showBanner(` thứ hai, tên `playWin`): ngay sau lệnh `showBanner(...)` của nó có dòng `if (isReduced()) return;` → đổi thành `if (isReduced() || o.bannerOnly) return;` (nếu tham số của hàm tên khác `o` thì dùng đúng tên đó).
3. Thêm một dòng vào chú thích đầu file mô tả `bannerOnly: true` = chỉ hiện chữ, không vẽ lên canvas (dùng khi bàn 3D tự diễn hiệu ứng).
4. `kydao-ui.js`, `onSkinEvent`: dòng
   ```js
   if (ui.board3d && typeof ui.board3d.playFx === 'function') { ui.board3d.playFx('domain', { side: ev.side, fieldId: ev.field }); return; }
   ```
   đổi thành
   ```js
   if (ui.board3d && typeof ui.board3d.playFx === 'function') {
     ui.board3d.playFx('domain', { side: ev.side, field: ev.field });
     if (root.KydaoFx) { root.KydaoFx.mount(ui.wrap, { reduced: reduced() }); root.KydaoFx.play('domain', { side: ev.side, fieldId: ev.field, bannerOnly: true }); }
     return;
   }
   ```
5. `kydao-ui.js`, `playWin`: trong nhánh `if (ui.board3d && …) { … return 2400; }`, trước `return 2400;` thêm:
   ```js
   if (root.KydaoFx) { root.KydaoFx.mount(ui.wrap, { reduced: false }); root.KydaoFx.play('win', { game: S.game, reason: ev.reason, result: ev.result, mine, bannerOnly: true }); }
   ```

## Bước 6 · `kydao-ui.js`: cuộn hoặc đổi cỡ thì dừng hiệu ứng 2D đang chạy

1. Trong `api.open`, chỗ `resizeFn = () => { fit(); redraw(); };` đổi thành `resizeFn = () => { stopFx(); fit(); redraw(); };`
2. Trong `build()`, sau dòng tạo `el.viewport = h('div', …)`, thêm: `el.viewport.addEventListener('scroll', stopFx, { passive: true });`
3. Thêm hàm ngay trên `function build()`:
   ```js
   /** Toạ độ hiệu ứng được chụp lúc bắt đầu; bàn dịch chuyển (cuộn, đổi cỡ) thì dừng để không lệch khỏi quân. */
   function stopFx() { if (root.KydaoFx) root.KydaoFx.stop(); }
   ```
   (`KydaoFx.stop()` tự gọi `onJolt(null)` nên quân về chỗ.)

## Bước 7 · `board3d.mjs`: tôn trọng `ta-fx`

1. Tìm dòng `const media = window.matchMedia('(prefers-reduced-motion: reduce)');`. Thêm ngay dưới:
   ```js
   // Người chơi tắt hiệu ứng (localStorage 'ta-fx' = '0') thì coi như giảm chuyển động.
   const fxOff = () => { try { return window.localStorage.getItem('ta-fx') === '0'; } catch (e) { return false; } };
   const calm = () => media.matches || fxOff();
   ```
2. Trong **cùng hàm đó**, thay **mọi** `media.matches` còn lại bằng `calm()` (khoảng 10 chỗ; KHÔNG đổi 2 dòng `media.addEventListener` / `media.removeEventListener`, và không đổi dòng định nghĩa `calm`).
3. Tăng `?v=` import `board3d.mjs` thêm 1 ở cả `public/js/kydao-ui.js` và `public/world3d-board.html`.

## Bước 8 · `?v=` và test

- `index.html`: tăng `?v=` của `kydao-ui.js` và `kydao-fx.js` (cộng 1 vào số cuối).
- `test/kydao-fx.test.js`: thêm test `bannerOnly: chỉ hiện chữ, không tạo hiệu ứng canvas` nếu file có khuôn DOM giả cho `mount`; nếu file chỉ test toán thuần thì bỏ qua và ghi vào bàn giao.
- `test/kydao-ui-games.test.js`: thêm test `hiệu ứng thắng ném lỗi thì bảng kết quả vẫn hiện`: gán `KydaoFx` giả có `mount(){}`, `stop(){}`, `unmount(){}`, `play(){ throw new Error('x'); }` vào root giả, mở ván cờ vua, gọi `KydaoUI.apply({ type:'kd:end', gameId, result:'a', reason:'checkmate' })`, cho timer giả chạy, khẳng định phần tử `.kd-result` không còn `hidden`. Dùng lại khuôn `surface()`/`gameEnv()` có sẵn (đọc cách các test khác trong file điều khiển timer).
- `test/kydao-board3d.test.js`: thêm test `ta-fx tắt thì bàn 3D không rung khi phong cấp` theo khuôn test giảm chuyển động có sẵn (đặt `localStorage` giả trả `'0'` cho `'ta-fx'`).

## Kiểm

Chạy trực tiếp từng file (sandbox chặn `node --test`): `node test/kydao-fx.test.js`, `node test/kydao-ui-core.test.js`, `node test/kydao-ui-games.test.js`, `node test/kydao-app.test.js`, `node test/kydao-board3d.test.js`, `node test/kydao-draw-skins.test.js`. Mọi test phải đạt.

## Không làm

- Không sửa `public/js/app.js` (lỗi `innerHTML` ở dòng 561 là mã có sẵn từ trước, đã ghi Hộp thư đến).
- Không đổi hành vi nào ngoài 8 bước. Không commit, không push, không mở trình duyệt.
