# T-209 · Đặc tả: bàn và quân MẶC ĐỊNH nạp từ tài nguyên (2D và 3D), vẫn lùi về hình vẽ bằng mã

> Thợ làm đúng từng bước. Chỉ sửa file ở mục 2. **Không** sửa `tools/blender/**`, không tạo hay sửa file trong `public/img/kydao/**` và `public/models/kydao/**` (thẻ T-208 sinh ra, làm song song), không đụng `task.md`, không commit, không định dạng lại file, không đổi tên hàm sẵn có.

## 1. Mục tiêu

Khi người chơi **chưa chọn skin**, bàn cờ vua, cờ tướng, cờ úp hiện bằng tài nguyên dựng sẵn thay cho hình vẽ bằng mã. Hình vẽ bằng mã **giữ nguyên làm đường lùi**: trong lúc chờ tải, khi file thiếu (404), khi `models:false`, và trong mọi test hiện có.

Tài nguyên (do T-208 sinh, tên và định dạng đã chốt):

| File | Định dạng |
|---|---|
| `/models/kydao/pieces/classic.glb` | nút `K Q R B N P disc`, vật liệu tên `body`; đáy Y=0, vua cao 1,5, bề ngang ≤ 0,88, Mã quay +Z, mặt đĩa phẳng (bán kính 0,44, cao 0,18) |
| `/img/kydao/pieces2d/classic.webp` | atlas 896×256 đúng như skin quân: ô 128, hàng 0 bên a (sáng), hàng 1 bên b (tối), cột `K Q R B N P disc`; ô disc không có chữ |
| `/img/kydao/boards/chess.webp` | 1024×1024, phủ đúng 8×8 ô, ô trên-trái là ô **sáng**, không khung, không chữ |
| `/img/kydao/boards/xiangqi.webp` | 1152×1280, chỉ là mặt gỗ sáng, không lưới, không sông (dùng cho cả cờ tướng và cờ úp) |

**Nguyên tắc an toàn:** tính năng bật bằng cờ `defaultAssets`, **mặc định là tắt** ở cả `KydaoDraw.draw` lẫn `createBoard3D`; chỉ `kydao-ui.js` bật. Nhờ vậy mọi test hiện có phải **giữ nguyên, không sửa một dòng nào** và vẫn đạt. Nếu bạn thấy phải sửa test cũ thì bạn đang làm sai hướng: dừng và ghi vào báo cáo.

## 2. File được sửa hoặc tạo

`public/js/kydao-skins.js` · `public/js/kydao-draw.js` · `public/js/world3d/board3d.mjs` · `public/js/kydao-ui.js` · `public/index.html` (chỉ tăng `?v=`) · `public/world3d-board.html` (chỉ thêm công tắc thử, tùy chọn) · `test/kydao-default-assets.test.js` (mới) · `docs/KE-HOACH-KY-DAI.md` (mục 4.5 và 6) · `docs/agents/CONTEXT-PACKS.md` (dòng "Bẫy" của gói Kỳ Đài, thêm một ý).

## 3. Bước 1 · Danh mục (`public/js/kydao-skins.js`)

Thêm ngay trên dòng `return { GAMES, ...` ba hàm, rồi thêm tên ba hàm vào object trả về. **Không** thêm mục nào vào `PIECES` hay `FIELDS` (test đếm đúng 8 bộ; `normalize` không được nhận mã `classic`).

```js
  /** Tài nguyên của bàn và quân MẶC ĐỊNH (chưa chọn skin); thiếu file thì giao diện lùi về hình vẽ bằng mã. */
  function defaultPiecesAtlas() { return '/img/kydao/pieces2d/classic.webp'; }
  function defaultPiecesModel() { return '/models/kydao/pieces/classic.glb'; }
  function defaultBoardImage(game) {
    return game === 'chess' ? '/img/kydao/boards/chess.webp' : game === 'xiangqi' || game === 'jieqi' ? '/img/kydao/boards/xiangqi.webp' : null;
  }
```

## 4. Bước 2 · Bàn 2D (`public/js/kydao-draw.js`)

Đọc trước: `loadImage` (~dòng 124), `imageState` (~144), `resolveSkins` (~157), `atlasImage` và `paintAtlasCell` (~354), `drawChessPiece` (~359, chú ý khóa đệm bitmap), `drawXiangqiLabel` (~462), `drawXiangqiPiece` (~481), `drawChessBoard` (~582), `drawXiangqiStatic` (~698), `boardCacheKey` và `drawXiangqiCached` (~779), `draw` (~900 trở đi, chỗ `const pieceSkin = …` ~947).

1. **Trạng thái mặc định.** Trong `draw(ctx, o)`, tính một lần:
   ```js
   const cat = /* danh mục đang dùng trong file này (xem resolveSkins lấy danh mục thế nào, làm giống) */;
   const dflt = o.defaultAssets && cat && typeof cat.defaultPiecesAtlas === 'function' && !isGrid(o.game)
     ? { atlas: cat.defaultPiecesAtlas(), board: cat.defaultBoardImage(o.game), onAsset: o.onAsset } : null;
   ```
   Truyền `dflt` xuống các hàm cần nó bằng **tham số thêm ở cuối** (giá trị thiếu = `null` = hành vi cũ).
2. **Quân.** Tại chỗ `const atlasImg = atlasImage(pieceSkin, sk && sk.onAsset);` đổi thành: nếu `pieceSkin` có thì như cũ; nếu không và có `dflt` thì `atlasImg = loadImage(dflt.atlas, dflt.onAsset)`. `pieceSkin` vẫn là `null`.
   - Cờ vua: `drawChessPiece` đã vẽ theo atlas khi có `atlas`. Kiểm khóa đệm bitmap của nó: khi dùng atlas mặc định, khóa phải **khác** khóa của hình vector mặc định (thêm hậu tố `:classic`), nếu không ảnh vector đã đệm sẽ che atlas vừa tải xong.
   - Cờ tướng và cờ úp: trong `drawXiangqiPiece`, điều kiện `if (atlas && skin && skin.c)` đổi thành `if (atlas && (!skin || skin.c))`. Khi `skin` là `null`: vẽ ô `disc` y như nhánh có skin (hàng 0 cho quân đỏ/chữ hoa, hàng 1 cho quân đen), còn **màu mực và mọi tham số của chữ lấy đúng như nhánh vector mặc định** (đỏ `#9e2420`, đen `#211d18`; quân úp `x` vẫn hiện `?` như cũ). Đọc kỹ nhánh có skin để tái dùng, đừng chép lệch kích thước.
   - Mọi chỗ khác gọi `drawChessPiece`/`drawXiangqiPiece` (quân đang bay, quân bị ăn, bảng phong cấp…) cũng phải dùng cùng quy tắc, nếu không quân đổi hình khi di chuyển. Tìm bằng Grep tên hai hàm và sửa cho nhất quán bằng một hàm trợ giúp nhỏ, ví dụ `pieceAtlas(pieceSkin, sk, dflt)`.
3. **Mặt bàn cờ vua.** Trong `drawChessBoard`, vòng lặp tô 64 ô: nếu có `dflt` và `loadImage(dflt.board, dflt.onAsset)` trả ảnh thì **thay vòng tô 64 ô** bằng một lệnh `ctx.drawImage(img, x0, y0, 8 * g.cell, 8 * g.cell)` phủ đúng vùng 8×8 ô (góc trên-trái là `cellXY` của ô trên-trái trừ nửa ô), và **bỏ 32 nét vân gỗ vẽ bằng mã** (ảnh đã có vân). Khung, chữ toạ độ, lớp skin nửa sân giữ nguyên thứ tự cũ. Trước khi dùng ảnh, tự kiểm bằng mã rằng ô trên-trái màn hình khi `flip=false` là ô sáng (`#f0d9b5`); khi `flip=true` bàn quay 180° nên thứ tự sáng tối không đổi, không cần xoay ảnh.
4. **Mặt bàn cờ tướng, cờ úp.** Trong `drawXiangqiStatic`: nếu có ảnh thì thay lệnh tô gradient gỗ và 40 nét vân bằng `ctx.drawImage(img, …)` phủ **đúng hình chữ nhật mà `fillRect` gỗ đang phủ** (`g.ox - m, g.oy - m, g.cell * 8 + m * 2, g.cell * 9 + m * 2`). Khung, lưới, cung, dấu vị trí, sông giữ nguyên.
5. **Đệm nền.** `boardCacheKey(o, sk)` thêm một thành phần: `o.defaultAssets ? imageState(<đường dẫn ảnh bàn mặc định>) : '-'`, để nền đệm vẽ lại khi ảnh tải xong.
6. Cập nhật chú thích JSDoc của `draw` (đoạn liệt kê tham số, ~dòng 812): thêm `defaultAssets: boolean`.

## 5. Bước 3 · Bàn 3D (`public/js/world3d/board3d.mjs`)

Đọc trước: chú thích đầu hàm (~270–277), `material`/`ivory`/`ebony`/`diskWood` (~338–342), `boardTexture` và `paintFace` (~353–411), `rebuildBoard` (~468–479), `chessPiece`/`diskPiece` (~488–550), `faceMaterial`/`diskFaceTexture` (~552–571), `modelPiece`/`fitPart` (~676–712), `assetApi`/`loadAsset`/`loadPiecesModel` (~717–737), `template`/`baseTemplate` (~751–781), `imageApi`, `stats` (~1517), `dispose`.

1. Chữ ký: `createBoard3D({ canvas, game, skins: catalogInput, quality: qualityInput, assets, models = true, fieldImages = true, defaultAssets = false })`. Sửa chú thích đầu hàm: mặc định vẽ bằng mã; `defaultAssets:true` thì nạp thêm ảnh mặt bàn và `.glb` quân mặc định.
2. **Mặt bàn.** Thêm tham số tùy chọn cho `paintFace` (ví dụ trường `face` trong object màu): khi có ảnh thì
   - cờ vua: vẽ ảnh phủ đúng vùng 8×8 ô thay cho việc tô 64 ô và các nét vân;
   - cờ tướng, cờ úp: vẽ ảnh phủ vùng mặt gỗ thay cho màu nền và nét vân; lưới, cung, dấu vẫn vẽ đè lên.
   Trong `rebuildBoard`, sau khi tạo `boardMaterial` như cũ: nếu `defaultAssets && fieldImages` và danh mục có `defaultBoardImage(game)` thì `imageApi().then(api => api && api.loadImage ? api.loadImage(url) : null)`; khi có ảnh và bàn chưa bị huỷ, chưa bị dựng lại cho môn khác (so một biến đếm thế hệ tăng mỗi lần `rebuildBoard`): **vẽ lại chính canvas của texture hiện có** với ảnh, đặt `map.needsUpdate = true`, gọi `requestRender()`. Không tạo `THREE.Texture` mới (test rò rỉ đếm số texture). Xem `texture(…)` để biết cách lấy lại canvas/hàm vẽ; nếu cần thì cho `boardTexture` nhận tham số ảnh và vẽ lại vào cùng canvas.
   Chú ý `paintFace` còn được `buildHalf` dùng để tô nửa sân theo palette: các lời gọi đó **không** truyền ảnh, hành vi giữ nguyên.
3. **Quân.** Thêm biến `let defaultModel = null; // { parts: Map<tên nút, phần đã fit> }` tách hẳn khỏi `pieceSkins`.
   - Nạp một lần khi dựng bàn nếu `defaultAssets` và môn không phải cờ vây/caro: `loadAsset(catalog.defaultPiecesModel())` (đi qua `assetApi()` nên `models:false` không bao giờ nạp). Khi về: lấy các nút `K Q R B N P disc` bằng `getObjectByName`, đưa qua `fitPart` như `loadPiecesModel`, giữ tài nguyên để `dispose()` giải phóng; rồi xoá các khuôn mặc định đã đệm trong `templates`, gọi `refreshVisuals()` và `requestRender()` (làm giống đoạn cuối `loadPiecesModel`).
   - Trong `baseTemplate(ch)`: nếu `defaultModel` có phần tương ứng (cờ vua: `ch.toUpperCase()`; cờ tướng/úp: `disc`) thì dựng quân từ phần đó, **vật liệu mặc định**: quân sáng `ivory`, quân tối `ebony`, đĩa `diskWood`; mặt chữ của đĩa dùng đúng `faceMaterial`/mặt phẳng như `diskPiece` đang làm, đặt ở `userData.top + 0.004`, cỡ `min(0.8, radius * 2 * 0.94)` như `modelPiece`. Hướng quay bên a/b làm như `modelPiece`. Không có phần thì chạy `chessPiece`/`diskPiece` như cũ.
   - `stats().pieceSkins` **không** tính mô hình mặc định. Thêm trường mới `defaultModel: +!!defaultModel` vào `stats()`.
   - Khi một bên có skin quân, bên đó dùng skin như cũ; bên còn lại dùng mô hình mặc định.
4. `dispose()`: giải phóng geometry của mô hình mặc định; sau `dispose` số geometry và texture phải về 0 như test rò rỉ hiện có.

## 6. Bước 4 · Bật trong giao diện

- `public/js/kydao-ui.js`: chỗ `createBoard3D({ canvas: panel.canvas3d, game: S.game })` thêm `defaultAssets: true`; chỗ dựng `options` cho `KydaoDraw.draw` (gần `options.onAsset = onAsset`) thêm `options.defaultAssets = true` và bảo đảm `options.onAsset` **luôn** được gán (hiện có thể chỉ gán khi có skin: đọc đoạn đó và sửa để ảnh mặc định tải xong thì bàn tự vẽ lại). Tăng `board3d.mjs?v=7` thành `?v=8`.
- `public/index.html`: tăng `?v=` của `kydao-skins.js`, `kydao-draw.js`, `kydao-ui.js` (mỗi cái thêm 1 hoặc đổi hậu tố).
- `public/world3d-board.html` (tùy chọn): nếu trang có sẵn cách đọc tham số URL thì thêm `?default=1` để bật `defaultAssets`.

## 7. Bước 5 · Test mới `test/kydao-default-assets.test.js`

Tên test tiếng Việt. Dựng theo khuôn của `test/kydao-draw-atlas.test.js` (giả `global.Image`, đếm `drawImage`) và `test/kydao-board3d.test.js` (giả `assets`, đếm URL, `stats()`, kiểm rò rỉ). Tối thiểu:

1. Danh mục: ba hàm trả đúng đường dẫn; `defaultBoardImage('go')` là `null`; `normalize({ pieces: 'classic' }).pieces` là `null`; `Object.keys(PIECES).length === 8`.
2. 2D, **không** có `defaultAssets`: chuỗi lệnh vẽ giống hệt hiện tại, không yêu cầu ảnh nào.
3. 2D cờ vua, `defaultAssets:true`, ảnh đã tải: đúng 32 lệnh `drawImage` 10 tham số (quân từ atlas) và 1 lệnh vẽ ảnh mặt bàn; không còn `fillRect` màu `#b58863`.
4. 2D cờ tướng, `defaultAssets:true`: 32 ô `disc` từ atlas, chữ dùng mực `#9e2420` và `#211d18`; cờ úp: quân úp một bên giống hệt nhau.
5. 2D, ảnh 404: chuỗi lệnh vẽ giống hệt khi không có `defaultAssets`.
6. 2D, một bên có skin quân: bên đó vẽ từ atlas của skin, bên kia từ atlas mặc định.
7. 3D, `defaultAssets:true` với `assets` giả: danh sách URL có `classic.glb` và ảnh mặt bàn; `stats().defaultModel === 1`, `stats().pieceSkins === 0`.
8. 3D, `models:false`: không có URL `.glb` nào; hình vẫn là hình dựng bằng mã.
9. 3D, `loadModel` trả `null`: bàn vẫn hiện bằng hình dựng bằng mã, không ném lỗi.
10. 3D: sau `dispose()` số geometry và texture về 0.

## 8. Tài liệu

- `docs/KE-HOACH-KY-DAI.md` mục 4.5: thêm bốn dòng tài nguyên mặc định vào bảng và sửa câu "Mọi tài nguyên nạp lười khi người chơi thật sự bật skin" thành: skin nạp lười như cũ; riêng bộ mặc định (T-209) nạp khi mở bảng cờ, thiếu thì lùi về hình vẽ bằng mã. Mục 6 (rủi ro, dòng hiệu năng) thêm ý tương ứng.
- `docs/agents/CONTEXT-PACKS.md`, dòng "Bẫy" của gói Kỳ Đài: thêm "bàn và quân mặc định cũng nạp từ file (cờ `defaultAssets`), hình vẽ bằng mã là đường lùi và phải luôn chạy được".

## 9. Tự kiểm

Chạy được thì chạy (sandbox có thể chặn `node`; nếu báo EPERM thì **không thử lại**, ghi vào báo cáo, điều phối sẽ chạy):

```bash
npm run check
node --test test/kydao-default-assets.test.js
node --test test/kydao-board3d.test.js test/kydao-draw-skins.test.js test/kydao-draw-atlas.test.js test/kydao-ui-core.test.js test/kydao-draw-cache.test.js test/kydao-skins.test.js test/kydao-draw-stones.test.js
```

## 10. Không làm

Không đổi giao thức, không đụng máy chủ, không thêm skin vào danh mục, không đổi hình quân vector hiện có, không đổi màu bàn vẽ bằng mã, không sửa test cũ, không đụng cờ vây và caro, không thêm thư viện.

## 11. Báo cáo

Ngắn gọn: file đã sửa, từng bước đã làm, test nào đã chạy và kết quả thật (hoặc "chưa chạy được vì …"), điểm nào lệch đặc tả và vì sao.
