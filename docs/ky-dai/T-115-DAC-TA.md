# Đặc tả từng bước cho T-115a, T-115b, T-115c (nối skin và hiệu ứng vào bảng cờ)

> Viết cho thợ là model nhẹ. **Làm đúng thứ tự các bước, không tự thiết kế lại.** Mỗi bước có: file, chỗ sửa (tìm bằng Grep theo chuỗi ghi trong ngoặc), mã mẫu, cách kiểm.
> Ba thẻ chạy **nối tiếp** (cùng sửa `public/js/kydao-ui.js`): T-115a → T-115b → T-115c.
> Thiết kế chung: [KE-HOACH-KY-DAI.md](../KE-HOACH-KY-DAI.md). Thấy đặc tả mâu thuẫn với mã thật thì **dừng, ghi vào bàn giao**, không đoán.

## 0. Những thứ đã có sẵn (chỉ dùng, không sửa)

| Thứ | Ở đâu | Dùng thế nào |
|---|---|---|
| Danh mục skin | `public/js/kydao-skins.js` → `window.KydaoSkins` | `FIELDS`, `PIECES`, `normalize(x)`, `supports(game)`, `field(id)`, `pieces(id)`, `thumb(kind,id)` |
| Hiệu ứng 2D | `public/js/kydao-fx.js` → `window.KydaoFx` | `mount(wrapEl,{reduced})`, `unmount()`, `stop()`, `play(kind, opts)` |
| Vẽ 2D | `KydaoDraw.draw(ctx, o)` | nhận thêm `o.skins`, `o.hideSkins`, `o.jolt`, `o.onAsset` (T-114) |
| Bàn 3D | `board3d.setState(o)`, `board3d.playFx(kind, opts)` | nhận cùng `o.skins` (T-113) |
| Máy chủ | sự kiện `kd:skin` (T-110) | xem `docs/KY-DAO-GIAO-THUC.md` mục `kd:skin` |

Tên bên: `'a'` (đi trước) và `'b'`. `S.you` là bên của mình (`null` nếu là người xem). Bàn lật khi `S.you === 'b'`.

Quy tắc chung khi sửa `kydao-ui.js`:
- Sửa nhỏ, đúng chỗ; không định dạng lại file; không đổi tên hàm.
- Tạo phần tử bằng hàm `h()` có sẵn; chữ gán bằng `textContent`. **Cấm `innerHTML`.**
- Mọi `localStorage` bọc `try { … } catch (e) { /* bỏ qua */ }`.
- Mọi lời gọi `root.KydaoFx` / `root.KydaoSkins` phải kiểm tồn tại trước (`if (!root.KydaoFx) return;`): thiếu module thì bảng cờ vẫn chạy như cũ.
- Chữ giao diện tiếng Việt có dấu, ngắn. Nút cao tối thiểu 44px (lớp `.kd-btn` đã đủ).

---

## T-115a · Nạp module, giữ trạng thái skin, truyền vào hàm vẽ

**Mục tiêu:** bảng cờ biết skin của hai bên (từ `kd:start` và `kd:skin`) và vẽ đúng trên 2D lẫn 3D. Chưa có nút bấm nào.

**File được sửa:** `public/index.html`, `public/js/app.js`, `public/js/kydao-ui.js`, `test/kydao-ui-core.test.js`.

### Bước a1 · `public/index.html`: nạp script và CSS

1. Tìm dòng `<link rel="stylesheet" href="/css/kydao.css?v=2">`. Thêm ngay **sau** nó:
   ```html
   <link rel="stylesheet" href="/css/kydao-fx.css?v=1">
   ```
2. Tìm dòng `<script src="/js/kydao-draw.js?v=…"></script>`. Thêm ngay **trước** nó:
   ```html
   <script src="/js/kydao-skins.js?v=1"></script>
   <script src="/js/kydao-fx.js?v=1"></script>
   ```
3. Trên dòng `kydao-ui.js?v=…` đổi giá trị `?v=` thành `kydai1`.

### Bước a2 · `public/js/app.js`: chuyển sự kiện `kd:skin`

Tìm `['moved', 'marks', 'offer', 'end'].forEach(type => socket.on('kd:' + type`. Thêm `'skin'` vào mảng:
```js
['moved', 'marks', 'offer', 'end', 'skin'].forEach(type => socket.on('kd:' + type, d => {
```
Rồi trong `index.html` tăng `?v=` của `app.js` (thêm hậu tố `-kydai1` vào giá trị hiện có).

### Bước a3 · `kydao-ui.js`, phần "Lõi thuần": trạng thái skin

1. Ngay **trên** dòng `/** Dựng phiên ván từ StartPayload. */` thêm:
   ```js
   const NO_SKIN = () => ({ field: null, pieces: null });
   /** Chuẩn hóa skin của hai bên từ dữ liệu máy chủ; không có danh mục thì coi như mặc định. */
   function readSkins(raw) {
     const K = root.KydaoSkins, o = raw && typeof raw === 'object' ? raw : {};
     return { a: K ? K.normalize(o.a) : NO_SKIN(), b: K ? K.normalize(o.b) : NO_SKIN() };
   }
   /** Áp một gói kd:skin lên phiên. Trả true nếu gói hợp lệ và thuộc ván này. */
   function applySkin(S, ev) {
     if (!S || !ev || ev.gameId !== S.gameId || (ev.side !== 'a' && ev.side !== 'b')) return false;
     const K = root.KydaoSkins;
     S.skins[ev.side] = K ? K.normalize(ev) : NO_SKIN();
     return true;
   }
   ```
2. Trong `makeSession`, dòng có `marks: start.marks || null, win: [], zoom: 1` đổi thành:
   ```js
   marks: start.marks || null, win: [], zoom: 1, skins: readSkins(start.skins), jolt: null
   ```
3. Dòng `const core = { clockRemaining, …` thêm `readSkins, applySkin` vào cuối danh sách.

### Bước a4 · `kydao-ui.js`: công tắc ẩn skin đối thủ (chỉ biến, chưa có nút)

Ngay dưới dòng `const VI_KEY = 'kydao.vi';` thêm:
```js
const HIDE_KEY = 'kydao.hideFoeSkin';
let hideFoe = false;
try { hideFoe = root.localStorage && root.localStorage.getItem(HIDE_KEY) === '1'; } catch (e) { /* bỏ qua */ }
```

### Bước a5 · `kydao-ui.js`, hàm `redraw()`: truyền skin vào hàm vẽ

Trong `redraw()`, sau khi tạo `options` và **trước** dòng `if (ui.board3d) ui.board3d.setState(options);` thêm:
```js
if (root.KydaoSkins && root.KydaoSkins.supports(S.game)) {
  options.skins = S.skins;
  const foe = S.you === 'a' ? 'b' : S.you === 'b' ? 'a' : null;
  options.hideSkins = { a: hideFoe && foe === 'a', b: hideFoe && foe === 'b' };
  options.jolt = S.jolt || null;
  options.onAsset = () => { if (ui && S) redraw(); };
}
```

### Bước a6 · `kydao-ui.js`, `api.apply`: nhận `kd:skin`

Trong `apply(ev)`, ngay **trước** nhánh `else if (type === 'end' && …)` thêm nhánh:
```js
} else if (type === 'skin' && S) {
  if (applySkin(S, ev)) { redraw(); onSkinEvent(ev); }
```
và thêm hàm rỗng (T-115b sẽ điền) ngay trên dòng `/* ---------- API ---------- */`:
```js
/** Gọi sau khi một bên đổi skin. T-115b nối màn khai mở vào đây. */
function onSkinEvent(ev) { /* T-115b */ }
```

### Bước a7 · Test (`test/kydao-ui-core.test.js`)

Đọc đầu file để biết cách file này nạp `kydao-ui.js` trong Node. Trước khi nạp, gán `globalThis.KydaoSkins = require('../public/js/kydao-skins.js')` (nếu file nạp module lúc đầu thì đặt dòng này lên trên cùng). Thêm 3 test, tên tiếng Việt:
1. `makeSession đọc skins từ StartPayload, mã lạ thành null`: `start.skins = { a:{field:'volcano',pieces:'xyz'}, b:null }` → `S.skins` bằng `{ a:{field:'volcano',pieces:null}, b:{field:null,pieces:null} }`.
2. `applySkin chỉ nhận gói đúng ván và đúng bên`: sai `gameId` → `false` và `S.skins` không đổi; `side:'c'` → `false`; gói đúng → `true` và `S.skins.b.field === 'ocean'`.
3. `applySkin không nhận khóa nguy hiểm`: `field:'__proto__'` → `S.skins.a.field === null`.

### Kiểm T-115a

```
npm run check
node --test test/kydao-ui-core.test.js test/kydao-ui-games.test.js test/kydao-app.test.js
```
Tất cả phải đạt. Ghi số đạt/trượt thật vào bàn giao.

---

## T-115b · Bộ chọn "Lãnh địa", gửi skin, màn khai mở

**Mục tiêu:** người chơi bấm nút "Lãnh địa", chọn skin sân và skin quân, bấm "Khai mở"; cả bàn thấy khẩu hiệu và nửa sân đổi.

**File được sửa:** `public/js/kydao-ui.js`, `public/css/kydao.css`, `public/index.html` (chỉ `?v=`), `test/kydao-ui-games.test.js`.

### Bước b1 · Biến lưu lựa chọn

Dưới các dòng `HIDE_KEY` (T-115a) thêm:
```js
const SKIN_KEY = 'kydao.skin';          // { field, pieces } người chơi ưa thích
function loadPref() {
  try { const K = root.KydaoSkins; return K ? K.normalize(JSON.parse(root.localStorage.getItem(SKIN_KEY) || '{}')) : { field: null, pieces: null }; }
  catch (e) { return { field: null, pieces: null }; }
}
function savePref(p) { try { root.localStorage.setItem(SKIN_KEY, JSON.stringify(p)); } catch (e) { /* bỏ qua */ } }
let pref = { field: null, pieces: null };
let fieldSentAt = 0;                    // lần gần nhất gửi khai mở (ms), chặn bấm liên tục
```

### Bước b2 · Hàm gửi skin

Đặt ngay dưới hàm `sendMove` (sau dấu `}` đóng của nó):
```js
const canSkin = () => !!(S && S.you && !S.over && root.KydaoSkins && root.KydaoSkins.supports(S.game));
/** Gửi skin hiện có của mình lên máy chủ. openField = true khi người chơi bấm "Khai mở". */
function sendSkin(openField) {
  if (!canSkin()) return;
  const mine = S.skins[S.you];
  const data = { gameId: S.gameId, pieces: pref.pieces, field: openField ? pref.field : mine.field };
  if (openField) fieldSentAt = now();
  send('kd:skin', data, ack => { if (ack && !ack.ok) say(ack.reason || 'Chưa đổi được skin.'); });
}
```

### Bước b3 · Dựng bảng chọn trong `build()`

1. Sau dòng `el.boardBtn = btn('', 'Bàn 3D', toggleBoard3D, …);` thêm:
   ```js
   el.skinBtn = btn('', 'Lãnh địa', () => { el.skins.hidden = !el.skins.hidden; el.skinBtn.setAttribute('aria-expanded', String(!el.skins.hidden)); if (!el.skins.hidden) renderSkins(); }, { 'aria-expanded': 'false' });
   el.skins = h('div', { class: 'kd-skins', hidden: true });
   ```
2. Dòng `el.actions = h('div', { class: 'kd-actions' }, el.drawBtn, …, el.zoomBtn);` thêm `el.skinBtn` vào cuối danh sách con.
3. Dòng `el.panel = h('div', …` có danh sách `…, el.actions, el.confirm, el.moves, el.msg, el.live`: chèn `el.skins` ngay **sau** `el.actions`.

### Bước b4 · Hàm `renderSkins()`

Đặt ngay trên hàm `renderControls`. Hàm dựng lại toàn bộ nội dung `ui.skins`:
```js
function renderSkins() {
  if (!ui || !S) return;
  const K = root.KydaoSkins, box = ui.skins;
  box.textContent = '';
  if (!K) return;
  const row = (title, kind, catalog, current, pick) => {
    const list = h('div', { class: 'kd-skin-row', role: 'radiogroup', 'aria-label': title });
    const item = (id, name) => {
      const b = h('button', { type: 'button', class: 'kd-skin' + (current === id ? ' is-on' : ''), role: 'radio', 'aria-checked': String(current === id), onclick: () => pick(id) });
      if (id) { const im = h('img', { class: 'kd-skin-img', alt: '', loading: 'lazy', width: '96', height: '60' }); im.src = K.thumb(kind, id); b.appendChild(im); }
      else b.appendChild(h('span', { class: 'kd-skin-img kd-skin-none' }));
      b.appendChild(h('span', { class: 'kd-skin-name' }, name));
      return b;
    };
    list.appendChild(item(null, 'Mặc định'));
    Object.keys(catalog).forEach(id => list.appendChild(item(id, catalog[id].name)));
    return h('div', { class: 'kd-skin-group' }, h('div', { class: 'kd-skin-title' }, title), list);
  };
  box.appendChild(row('Sân của bạn', 'field', K.FIELDS, pref.field, id => { pref.field = id; savePref(pref); renderSkins(); }));
  box.appendChild(row('Quân của bạn', 'pieces', K.PIECES, pref.pieces, id => { pref.pieces = id; savePref(pref); renderSkins(); sendSkin(false); }));
  const mine = canSkin() ? S.skins[S.you] : null;
  const wait = Math.max(0, 20000 - (now() - fieldSentAt));
  const open = h('button', { type: 'button', class: 'kd-btn kd-gold', onclick: () => { sendSkin(true); ui.skins.hidden = true; ui.skinBtn.setAttribute('aria-expanded', 'false'); } }, pref.field ? 'Khai mở' : 'Về sân mặc định');
  open.disabled = !mine || mine.field === pref.field || wait > 0;
  const hide = h('button', { type: 'button', class: 'kd-btn kd-ghost', 'aria-pressed': String(hideFoe), onclick: () => {
    hideFoe = !hideFoe; try { root.localStorage.setItem(HIDE_KEY, hideFoe ? '1' : '0'); } catch (e) { /* bỏ qua */ } renderSkins(); redraw();
  } }, hideFoe ? 'Hiện skin đối thủ' : 'Ẩn skin đối thủ');
  box.appendChild(h('div', { class: 'kd-actions' }, open, hide));
  if (wait > 0) box.appendChild(h('div', { class: 'kd-skin-note' }, 'Chờ ' + Math.ceil(wait / 1000) + ' giây nữa mới khai mở lại được.'));
}
```

### Bước b5 · Hiện/ẩn nút theo ván

Trong `renderControls()`, thêm ở cuối hàm (trước dấu `}` đóng):
```js
const skinOk = canSkin();
ui.skinBtn.hidden = !skinOk;
if (!skinOk) { ui.skins.hidden = true; ui.skinBtn.setAttribute('aria-expanded', 'false'); }
```
(Người xem và các môn cờ vây, caro không thấy nút.)

### Bước b6 · Tự gửi skin quân khi vào ván

Trong `api.open`, sau dòng `fit(); render(); tick(); flushPending();` và **trước** `return true;` thêm:
```js
pref = loadPref(); fieldSentAt = 0;
if (ui.skins) { ui.skins.hidden = true; ui.skinBtn.setAttribute('aria-expanded', 'false'); }
if (canSkin() && pref.pieces && S.skins[S.you].pieces !== pref.pieces) sendSkin(false);
```
Lưu ý: **không** tự gửi skin sân; sân chỉ đổi khi người chơi bấm "Khai mở".

### Bước b7 · Màn khai mở: điền `onSkinEvent`

Thêm 2 hàm trợ giúp ngay trên `onSkinEvent`, rồi thay thân hàm:
```js
/** Độ lệch của canvas bàn cờ so với góc trên-trái của .kd-boardwrap (px CSS). */
function boardOffset() {
  const c = (ui.canvas3d || ui.canvas).getBoundingClientRect(), w = ui.wrap.getBoundingClientRect();
  return { x: c.left - w.left, y: c.top - w.top, w: c.width, h: c.height };
}
/** Nửa sân của bên `side` trên màn hình: bên mình luôn ở nửa dưới. */
function halfRect(side) {
  const o = boardOffset(), flip = S.you === 'b';
  const bottom = (side === 'a') !== flip;
  return { rect: { x: o.x, y: o.y + (bottom ? o.h / 2 : 0), w: o.w, h: o.h / 2 }, fromBottom: bottom };
}
function onSkinEvent(ev) {
  if (ui && !ui.skins.hidden) renderSkins();
  if (!ev.opened || !ev.field || !ui || ui.panel.hidden) return;
  const foe = S.you && ev.side !== S.you;
  if (foe && hideFoe) return;
  const K = root.KydaoSkins, f = K && K.field(ev.field);
  if (f) announce((S[ev.side] && S[ev.side].name ? S[ev.side].name + ': ' : '') + f.cry + ' ' + f.name + '.');
  sound('domain');
  if (ui.board3d && typeof ui.board3d.playFx === 'function') { ui.board3d.playFx('domain', { side: ev.side, fieldId: ev.field }); return; }
  if (!root.KydaoFx) return;
  root.KydaoFx.mount(ui.wrap, { reduced: reduced() });
  const hr = halfRect(ev.side);
  root.KydaoFx.play('domain', { side: ev.side, fieldId: ev.field, rect: hr.rect, fromBottom: hr.fromBottom });
}
```
`sound('domain')`: hook âm thanh của `app.js` bỏ qua tên lạ, không cần sửa thêm (nếu nó ném lỗi thì đã có `try/catch` trong `sound`).

Trong `api.close()`, trước dòng `stopBoard3D();` thêm: `if (root.KydaoFx) root.KydaoFx.unmount();`

### Bước b8 · CSS (`public/css/kydao.css`, thêm ở cuối file)

```css
/* Bộ chọn Lãnh địa */
.kd-skins { display: grid; gap: 8px; padding: 8px; border-radius: 10px; background: rgba(0,0,0,.28); max-height: 46vh; overflow: auto; }
.kd-skin-title { font-size: 13px; color: var(--muted); margin-bottom: 4px; }
.kd-skin-row { display: flex; gap: 6px; overflow-x: auto; padding-bottom: 4px; scroll-snap-type: x proximity; }
.kd-skin { flex: 0 0 auto; width: 104px; min-height: 44px; padding: 4px; display: grid; gap: 2px; justify-items: center; border-radius: 8px; border: 2px solid transparent; background: rgba(255,255,255,.06); color: inherit; cursor: pointer; scroll-snap-align: start; }
.kd-skin.is-on { border-color: var(--gold, #e7c45a); background: rgba(231,196,90,.14); }
.kd-skin-img { width: 96px; height: 60px; border-radius: 5px; object-fit: cover; display: block; background: #2a211c; }
.kd-skin-none { background: repeating-conic-gradient(#b58863 0 25%, #f0d9b5 0 50%) 0 0 / 30px 30px; }
.kd-skin-name { font-size: 12px; line-height: 1.2; text-align: center; }
.kd-skin-note { font-size: 12px; color: var(--muted); }
.kd-gold { background: var(--gold, #e7c45a); color: #2a1a05; font-weight: 700; }
.kd-gold:disabled { opacity: .5; }
```
Rồi tăng `?v=` của `kydao.css` trong `index.html` (2 → 3) và của `kydao-ui.js` (`kydai1` → `kydai2`).

### Bước b9 · Test (`test/kydao-ui-games.test.js`)

File này đã có DOM giả và nối UI thật với manager thật: đọc để dùng lại khuôn. Thêm 1 test `khai mở sân: gửi kd:skin và hai bên thấy skin`:
1. Gán `globalThis.KydaoSkins` như bước a7; đặt `localStorage` giả chứa `kydao.skin = {"field":"volcano","pieces":"magma"}` trước khi mở ván cờ vua.
2. Sau khi mở ván: kiểm đã có một lời gọi `send('kd:skin', { pieces:'magma', field:null … })` (skin quân tự gửi, sân chưa gửi).
3. Gọi `KydaoUI.apply({ type:'kd:skin', gameId, side:'a', field:'volcano', pieces:'magma', opened:true })` → không ném lỗi dù không có `KydaoFx`.
4. Mở ván caro: không có lời gọi `kd:skin` nào.

### Kiểm T-115b

```
npm run check
node --test test/kydao-ui-core.test.js test/kydao-ui-games.test.js test/kydao-app.test.js test/e2e-kydao.test.js
```

---

## T-115c · Chấn động khi phong cấp, hiệu ứng chiến thắng

**Mục tiêu:** Tốt phong cấp làm rung bàn và hất các quân khác; hết ván có hiệu ứng theo lý do thắng ở cả 5 môn.

**File được sửa:** `public/js/kydao-ui.js`, `public/index.html` (chỉ `?v=`), `test/kydao-ui-core.test.js`.

### Bước c1 · Toạ độ một ô trên lớp phủ

Đặt dưới `halfRect` (T-115b):
```js
/** Tâm ô `sq` tính bằng px CSS so với góc trên-trái của .kd-boardwrap; null nếu chưa có hình học 2D. */
function fxPoint(sq) {
  const D = root.KydaoDraw;
  if (!geom || !sq) return null;
  const q = D.parseSq(S.game, sq, S.state.size);
  if (!q) return null;
  const p = D.cellXY(geom, q.col, q.row, S.you === 'b'), o = boardOffset();
  return { x: o.x + p.x, y: o.y + p.y };
}
```
(`parseSq` và `cellXY` có trong `KydaoDraw`; xem chữ ký ở cuối `public/js/kydao-draw.js`. Nếu `cellXY` không được xuất ra thì **dừng và báo**.)

### Bước c2 · Hàm phát hiệu ứng phong cấp

Đặt dưới `fxPoint`:
```js
/** Chấn động bàn cờ khi Tốt phong cấp ở ô `sq` thành quân `piece` ('q','r','b','n'). */
function playPromote(sq, piece) {
  if (!ui || ui.panel.hidden) return;
  sound('promote');
  if (ui.board3d && typeof ui.board3d.playFx === 'function') { ui.board3d.playFx('promote', { square: sq, piece }); return; }
  const at = fxPoint(sq);
  if (!root.KydaoFx || !at) return;
  const session = S, o = boardOffset();
  root.KydaoFx.mount(ui.wrap, { reduced: reduced() });
  root.KydaoFx.play('promote', { at, piece, cell: geom.cell, onJolt: get => {
    if (S !== session || !ui) return;
    // KydaoFx tính theo toạ độ lớp phủ; hàm vẽ nhận toạ độ canvas, nên cộng độ lệch.
    S.jolt = get ? (x, y) => get(x + o.x, y + o.y) : null;
    redraw();
  } });
}
```

### Bước c3 · Gọi `playPromote` ở hai nơi

Nước phong cấp của cờ vua là nước có **5 ký tự** (ví dụ `e7e8q`); ô phong cấp là ký tự 3–4, quân là ký tự 5.

1. Nước của **mình**: trong `sendMove`, ngay sau dòng `sound(r.info.capture ? 'capture' : r.info.check ? 'check' : 'move');` thêm:
   ```js
   if (S.game === 'chess' && move.length === 5) { redraw(); playPromote(move.slice(2, 4), move[4]); }
   ```
2. Nước của **đối thủ** (và người xem): trong `onMoved`, nhánh `if (r === 'applied') {`, ngay sau dòng `render();` của nhánh đó thêm:
   ```js
   if (S.game === 'chess' && typeof ev.move === 'string' && ev.move.length === 5) playPromote(ev.move.slice(2, 4), ev.move[4]);
   ```
   (Nhánh `'synced'` là gói của chính nước mình vừa đi: **không** phát lại.)

### Bước c4 · Dãy thắng caro

`pushMove` đã ghi `S.win = r.info.line` khi caro đủ 5 quân (mảng tên ô). Không cần tính lại; chỉ dùng `S.win`.

### Bước c5 · Hiệu ứng chiến thắng

1. Thêm hàm dưới `playPromote`:
   ```js
   /** Hiệu ứng lúc hết ván. Trả số ms nên chờ trước khi hiện bảng kết quả. */
   function playWin(ev) {
     if (!ui || ui.panel.hidden || ev.result === 'abort' || reduced()) return 0;
     const mine = S.you ? (ev.result === 'draw' ? null : ev.result === S.you) : null;
     const loser = ev.result === 'a' ? 'b' : ev.result === 'b' ? 'a' : null;
     const boardGame = S.game === 'chess' || S.game === 'xiangqi' || S.game === 'jieqi';
     const kingSq = boardGame && loser ? kingSquare(S, loser) : null;
     sound(mine === false ? 'lose' : 'win');
     if (ui.board3d && typeof ui.board3d.playFx === 'function') {
       ui.board3d.playFx('win', { game: S.game, reason: ev.reason, result: ev.result, mine, kingSquare: kingSq, line: S.win || [] });
       return 2400;
     }
     if (!root.KydaoFx) return 0;
     root.KydaoFx.mount(ui.wrap, { reduced: false });
     const line = (S.win || []).map(fxPoint).filter(Boolean);
     root.KydaoFx.play('win', { game: S.game, reason: ev.reason, result: ev.result, mine, king: kingSq ? fxPoint(kingSq) : null, line });
     return 2400;
   }
   ```
2. Trong `api.apply`, nhánh `type === 'end'`, thay 2 dòng cuối
   ```js
   clearTimeout(resultTimer);
   resultTimer = setTimeout(() => { if (S && S.over && ui) showResult(ev); }, reduced() ? 0 : 450);
   ```
   bằng
   ```js
   clearTimeout(resultTimer);
   S.jolt = null;
   const wait = playWin(ev);
   resultTimer = setTimeout(() => { if (S && S.over && ui) showResult(ev); }, reduced() ? 0 : Math.max(450, wait));
   ```
3. Khi mở ván mới phải dừng hiệu ứng cũ: trong `api.open`, ngay sau dòng `clearTimeout(resultTimer);` thêm `if (root.KydaoFx) root.KydaoFx.stop();`

### Bước c6 · Test (`test/kydao-ui-core.test.js`)

Thêm test `nước phong cấp có 5 ký tự và pushMove giữ info.promotion`: dựng phiên cờ vua từ FEN có Tốt trắng ở hàng 7 (xem cách các test khác trong file tạo `start`), gọi `core.pushMove(S, 'e7e8q', 'e8=Q')` → `ok === true`, `info.promotion` có giá trị. Nếu luật trả tên trường khác (`promo`…), ghi đúng tên thật vào bàn giao.

### Bước c7 · `?v=`

Trong `index.html` đổi `kydao-ui.js?v=kydai2` → `kydai3`.

### Kiểm T-115c

```
npm run check
node --test test/kydao-*.test.js test/e2e-kydao.test.js
```

---

## Điều thợ KHÔNG làm

- Không sửa: `kydao-skins.js`, `kydao-fx.js`, `kydao-draw.js`, `board3d.mjs`, `server.js`, `lib/`.
- Không thêm chữ do người chơi tự gõ vào khẩu hiệu.
- Không push, không merge. Sandbox không cho chạy `npm`/`git commit` thì ghi rõ trong bàn giao; điều phối sẽ chạy.
- Không mở trình duyệt; điều phối xem bằng mắt và chụp ảnh.
