# Đặc tả T-143 · Toán hành vi quỷ hộ thân `stand-math.js`

> Viết cho thợ. **Làm đúng đặc tả, không tự thiết kế lại.** Thấy đặc tả mâu thuẫn với mã thật thì dừng, ghi vào bàn giao, không đoán.
> Thiết kế chung: [KE-HOACH-PHAP-TUONG-3D.md](../KE-HOACH-PHAP-TUONG-3D.md) §1.1 (bảng 4 cấp quỷ, bảng hành vi), §2.4 (bảng suất 3D).

## 0. File

| File | Việc |
|---|---|
| `public/js/stand-math.js` | **mới**, UMD thuần |
| `test/stand-math.test.js` | **mới**, `node:test` |

**Không được chạm** bất kỳ file nào khác (không sửa `index.html`, `avatar.mjs`, `task.md`, `package.json`). Không chạy `npm`, `node --test`, không `git commit`: hộp cát của bạn không chạy được; Điều phối sẽ chạy.

## 1. Khung file (chép đúng mẫu UMD của `public/js/view-math.js`)

```js
(function (root) {
  'use strict';
  // … hằng số và hàm ở mục 2 …
  const api = { ANCHOR, DURATION, LIMITS, isSitting, spring, springVec, turn, poseOf, phaseOf, tauntOf, slots };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.StandMath = api;
})(this);
```

Quy ước: `'use strict'`, `const`/`let`, nháy đơn, dấu chấm phẩy, thụt 2 cách, chú thích tiếng Việt có dấu. Không đụng DOM, không `require` gì, không dùng `Date.now()` hay `Math.random()` bên trong hàm (thời gian và hạt giống đều truyền vào).

## 2. API

Toạ độ: hệ địa phương của nhân vật, mét. Gốc ở giữa hai bàn chân, `+Y` lên, nhân vật **nhìn về `+Z`**, sau lưng là `-Z`, **bên trái của nhân vật là `+X`**.

### 2.1 `ANCHOR`

Mảng đóng băng, chỉ số là cấp quỷ (`ANCHOR[0]` là `null`). `x, y, z` là chỗ đặt **gốc mô hình quỷ (thắt lưng quỷ)**; `h` là chiều cao cả con quỷ kể cả đuôi khói.

```js
const ANCHOR = Object.freeze([
  null,
  Object.freeze({ x: 0.20, y: 1.12, z: -0.05, h: 0.45 }), // 1 Tiểu Quỷ: ngồi vắt vẻo trên vai trái
  Object.freeze({ x: 0.42, y: 1.00, z: -0.35, h: 1.30 }), // 2 Ác Quỷ: sau vai trái, đầu ngang đầu chủ
  Object.freeze({ x: 0.00, y: 1.15, z: -0.45, h: 1.90 }), // 3 Quỷ Vương: chính giữa sau lưng, nhô trên đầu
  Object.freeze({ x: 0.00, y: 1.20, z: -0.55, h: 2.80 })  // 4 Ma Vương: giữa sau lưng, trùm lên chủ
]);
```

### 2.2 `DURATION`

```js
const DURATION = Object.freeze({ emerge: 0.9, vanish: 0.6, taunt: 2.0, window: 10 });  // giây
```

### 2.3 `LIMITS` (bảng suất §2.4: số người NGOÀI mình được cấp suất 3D)

```js
const LIMITS = Object.freeze({
  demon: Object.freeze({ low: 2, medium: 6, high: 12 }),
  aura: Object.freeze({ low: 2, medium: 8, high: Infinity })
});
const AURA_HIGH_RANGE = 25;   // mức Cao: hào quang 3D cho mọi người trong 25 m
```

### 2.4 `isSitting(sit)`

Giống `isSitting` trong `public/js/world3d/avatar-glb.mjs`: `true`, `'cushion'`, `'bench'`, hoặc số nguyên `>= 0` là ngồi; còn lại (kể cả `false`, `-1`, `undefined`) là đứng.

### 2.5 `spring(pos, vel, target, dt, k = 18, c = 7)` → `{ pos, vel }`

Lò xo giảm chấn một chiều (số). Không sửa tham số vào, trả đối tượng mới.

- `dt` không phải số hữu hạn hoặc `<= 0` → trả `{ pos, vel }` như cũ.
- `dt` kẹp tối đa `0.5`. Chia thành bước con, mỗi bước `h <= 1/120` giây (`n = Math.ceil(dt * 120)`, `h = dt / n`).
- Mỗi bước con (Euler bán ẩn):
  ```js
  const a = -k * (pos - target) - c * vel;
  vel += a * h;
  pos += vel * h;
  ```
- `pos`, `vel`, `target` không hữu hạn thì coi là `0` (riêng `target` không hữu hạn → dùng `pos`).

### 2.6 `springVec(pos, vel, target, dt, k = 18, c = 7)` → `{ pos, vel }`

Như `spring` nhưng `pos`, `vel`, `target` là mảng `[x, y, z]`; trả mảng mới. Gọi `spring` cho từng thành phần.

### 2.7 `turn(cur, goal, dt, lag = 0.25)` → số (radian)

Quay theo có trễ, đi đường ngắn nhất qua mốc ±π.

```js
let d = (goal - cur) % (Math.PI * 2);
if (d > Math.PI) d -= Math.PI * 2;
if (d < -Math.PI) d += Math.PI * 2;
return cur + d * (1 - Math.exp(-Math.max(0, dt) / lag));
```
`lag <= 0` hoặc `dt` lớn tới mức `1 - exp(...)` ≥ 0.999 thì trả thẳng `cur + d`. Đầu vào không hữu hạn: `cur` → `0`, `goal` → `cur`.

### 2.8 `poseOf(state)` → `'sit' | 'scoff' | 'peek' | 'drift' | 'idle'`

Thứ tự ưu tiên: **ngồi > vái > nói > đi > đứng**.

```js
const s = state || {};
if (isSitting(s.sit)) return 'sit';
if (Number(s.bow) > 0) return 'scoff';
if (s.talk || bubbleText(s.bubble)) return 'peek';
if (s.walking) return 'drift';
return 'idle';
```
`bubbleText(b)`: `b` là chuỗi → `b.trim()`; là đối tượng có `text` chuỗi → `b.text.trim()`; còn lại `''`.

### 2.9 `phaseOf(prevN, n, t, reduced = false)` → `'emerge' | 'steady' | 'vanish'`

- `prevN`: cấp quỷ **trước lần đổi gần nhất** (0 = không có quỷ), `n`: cấp hiện tại, `t`: số giây kể từ lần đổi đó.
- Chuẩn hóa: `prevN`, `n` lấy `Math.trunc`, kẹp `0..4`, không hữu hạn thì `0`; `t` không hữu hạn thì `Infinity`.
- `reduced` → luôn `'steady'`.
- `n > 0 && prevN !== n && t < DURATION.emerge` → `'emerge'` (gồm cả đổi cấp 2 → 4).
- `n === 0 && prevN > 0 && t < DURATION.vanish` → `'vanish'`.
- Còn lại `'steady'`.

### 2.10 `tauntOf(id, now)` → `null | 'taunt1' | 'taunt2'`

Động tác phụ, ổn định theo hạt giống để mọi máy thấy gần giống nhau.

```js
const win = Math.floor(now / 10000);                  // cửa sổ 10 giây
const r = rand2(hash(String(id) + ':' + win));        // hai số [0,1)
if (r[0] < 0.2) return null;                          // 20% cửa sổ nghỉ
const start = 2 + r[0] * 6;                           // giây bắt đầu trong cửa sổ: 2..8
const at = (now - win * 10000) / 1000;
if (at < start || at >= start + DURATION.taunt) return null;
return r[1] < 0.5 ? 'taunt1' : 'taunt2';
```
- `hash(str)`: FNV-1a 32 bit (`h = 0x811c9dc5`; với mỗi mã ký tự: `h ^= code; h = Math.imul(h, 0x01000193) >>> 0`).
- `rand2(seed)`: mulberry32 gọi hai lần, trả `[a, b]`:
  ```js
  function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  ```
- `now` không hữu hạn → `null`.

### 2.11 `slots(list, self, quality, kind = 'demon')` → `Set` các id

- `list`: mảng `{ id, distance }` (khoảng cách tới máy quay, mét). `self`: id của mình (có thể `null`). `quality`: `'low' | 'medium' | 'high'` (giá trị lạ → `'medium'`). `kind`: `'demon' | 'aura'` (lạ → `'demon'`).
- Luôn có `self` trong kết quả nếu `self != null` (kể cả khi `self` không có trong `list`).
- Người khác: bỏ phần tử không có `id`, trùng `self`, hoặc `distance` không hữu hạn. Riêng `kind === 'aura' && quality === 'high'`: bỏ người có `distance > AURA_HIGH_RANGE`.
- Sắp xếp tăng dần theo `distance`; bằng nhau thì so `String(id)` (`<` / `>`) để kết quả ổn định.
- Lấy `LIMITS[kind][quality]` người đầu (Infinity = lấy hết).

## 3. Test `test/stand-math.test.js`

Khuôn đầu file:
```js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../public/js/stand-math.js');
```
Tên test tiếng Việt có dấu. Tối thiểu các test sau:

1. `ANCHOR đủ 4 cấp, chiều cao đúng bảng`: `ANCHOR[0] === null`; `h` lần lượt `0.45, 1.3, 1.9, 2.8`; cấp 1, 2 có `x > 0` (bên trái chủ); mọi cấp có `z <= 0` (sau lưng); `Object.isFrozen(S.ANCHOR)`.
2. `lò xo hội tụ dưới 1 cm sau 1,5 giây và không vọt quá 15%`: từ `pos 0, vel 0`, `target 1`, gọi `spring` 90 lần với `dt = 1/60`; ghi `max(pos)` suốt quá trình; cuối: `Math.abs(pos - 1) < 0.01`; `max <= 1.15`.
3. `lò xo không phát nổ khi dt lớn`: `target 1`, gọi 20 lần với `dt = 0.5`: mọi `pos` hữu hạn, `Math.abs(pos) < 2`, cuối `Math.abs(pos - 1) < 0.01`. Thêm: `dt = 0`, `dt = NaN`, `dt = -1` trả đúng `pos`, `vel` cũ.
4. `springVec chạy từng trục`: target `[1, -2, 0.5]`, 120 bước `dt 1/60` → mỗi trục sai số `< 0.01`; không sửa mảng đầu vào.
5. `turn đi đường ngắn qua ±π`: `turn(3.0, -3.0, 10)` gần `3.0 + (2π - 6)` (sai số `< 1e-6`); `turn(0, 1, 0)` trả `0`; `turn(0, 1, 0.25)` nằm giữa `0.6` và `0.7` (`1 - e^-1 ≈ 0.632`).
6. `poseOf theo thứ tự ngồi > vái > nói > đi > đứng`: `{ sit:'bench', bow:1, talk:true, walking:true }` → `sit`; `{ sit:-1, bow:0.5, talk:true, walking:true }` → `scoff`; `{ bubble:{ text:' chào ' }, walking:true }` → `peek`; `{ bubble:'   ', walking:true }` → `drift`; `{}` và `undefined` → `idle`; `{ sit: 0 }` → `sit`; `{ sit: false }` → `idle`.
7. `phaseOf trồi lên, đứng yên, tan đi`: `(0,4,0.3)` → emerge; `(0,4,0.95)` → steady; `(2,4,0.1)` → emerge; `(4,0,0.2)` → vanish; `(4,0,0.7)` → steady; `(4,4,0.1)` → steady; `(0,4,0.1,true)` → steady; `(NaN,'x',NaN)` → steady.
8. `tauntOf ổn định theo hạt giống`: cùng `(id, now)` gọi hai lần ra cùng kết quả; quét `now` từ `0` tới `600000` bước `250` cho `id = 'npc-hac-phong'`: có ít nhất một `taunt1` và một `taunt2`; mọi giá trị thuộc `{null,'taunt1','taunt2'}`; trong mỗi cửa sổ 10 giây số mẫu khác `null` `<= 8` (2 giây / 0,25); `tauntOf('x', NaN) === null`.
9. `slots luôn có mình và đúng số lượng ở ba mức`: dựng 30 người `id 'p0'..'p29'`, `distance = i + 1`, `self = 'p29'` (xa nhất). `demon`: low → `size 3` và có `'p29'`, `'p0'`, `'p1'`; medium → 7; high → 13. `aura`: low 3; medium 9; high → mình + những người `distance <= 25` (`p0..p24`) = 26. Thêm: phần tử `distance: NaN` bị bỏ; `self = null` thì không có `null` trong tập; `quality: 'xyz'` xử lý như `medium`.
10. `chạy được trong trình duyệt không cần module`: đọc file bằng `fs.readFileSync`, chạy bằng `vm.runInNewContext(src, ctx)` với `ctx = {}` (không có `module`) → `ctx.StandMath.poseOf({ walking: true }) === 'drift'`. (Mẫu: `test/view-math.test.js` có dùng `vm`.)

## 4. Lệnh kiểm (Điều phối chạy)

```
npm run check
node --test test/stand-math.test.js
```

## 5. Bàn giao

Ghi ngắn vào cuối câu trả lời: file đã tạo, những chỗ bạn thấy đặc tả chưa rõ. Không sửa `task.md`.
