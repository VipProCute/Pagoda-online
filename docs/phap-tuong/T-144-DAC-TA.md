# Đặc tả T-144 · Nối bản mẫu vào nhân vật sau công tắc `ta-fx3d`

> Viết cho thợ. **Làm đúng đặc tả, không tự thiết kế lại.** Thấy đặc tả mâu thuẫn với mã thật thì dừng, ghi vào bàn giao.
> Thiết kế: [KE-HOACH-PHAP-TUONG-3D.md](../KE-HOACH-PHAP-TUONG-3D.md) §1.1–1.3, §2.1, §2.2. Khung đã có (T-141): `public/js/world3d/fx3d/index.mjs`, `assets.mjs`, `materials.mjs`, `placeholder.mjs`. Toán hành vi (T-143): `public/js/stand-math.js` (UMD, toàn cục `globalThis.StandMath`). Mô hình (T-142): `public/models/fx/demon-4.glb`, `lotus.glb`, `aura-kit.glb` (thông số ở cuối đặc tả này, mục 9).

## 0. File

| File | Việc |
|---|---|
| `public/js/world3d/fx3d/demon.mjs` | **mới**: quỷ hộ thân 3D (chỉ cấp 4 trong thẻ này) |
| `public/js/world3d/fx3d/lotus.mjs` | **mới**: đài sen vàng 3D (bậc 2 đến 7) |
| `public/js/world3d/fx3d/aura.mjs` | **mới**: vỏ khí 3D (chỉ bậc 5 trong thẻ này) |
| `public/js/world3d/avatar.mjs` | **CHỈ** thêm điểm nối fx3d + điều kiện `covers` (mục 4). Không định dạng lại, không đổi tên, không sửa phần khác |
| `public/js/world3d/avatar-glb.mjs` | chỉ đổi `?v=` và chuyển tiếp `fx` (mục 6) |
| `public/js/world3d/index.mjs` | chỉ hàm `updatePeople` (khoảng cách, suất) và `?v=` (mục 5, 6) |
| `public/js/world3d/scenes/arena.mjs`, `scenes/yard.mjs`, `public/js/view3d-ui.js`, `public/world3d-test.html`, `public/world3d-avatar.html` | chỉ đổi `?v=` (mục 6) |
| `public/index.html` | thêm `<script>` stand-math, đổi `?v=` (mục 6) |
| `public/world3d-fx.html` | dùng mô hình thật qua avatar (mục 7) |
| `test/world3d-avatar.test.js`, `test/world3d-fx.test.js` | thêm test (mục 8) |

**Không được chạm**: `server.js`, `hall.js`, `app.js`, giao thức, ảnh trong `public/img/fx/`, `fx3d/index.mjs`, `assets.mjs`, `materials.mjs`, `placeholder.mjs`, `stand-math.js`, mô hình `.glb`, `task.md`. Không chạy `npm`/`node`/`git` (Điều phối chạy test, xem trình duyệt và commit).

Quy ước: như các `.mjs` có sẵn (`'use strict';` dòng đầu, nháy đơn, chấm phẩy, thụt 2, chú thích tiếng Việt có dấu, không `console.*`, không `innerHTML`). Import nội bộ có `?v=1`.

Hệ toạ độ Three.js của nhân vật: gốc giữa hai bàn chân, `+Y` lên, **nhân vật nhìn về `+Z`**, sau lưng `−Z`, bên trái nhân vật `+X`. `rig.rotation.y = state.yaw`. Mô hình glTF cùng quy ước (mặt nhìn `+Z`).

## 1. `fx3d/demon.mjs`

```js
import * as THREE from 'three';
import { register } from './index.mjs?v=1';
export const DEMON_URL = Object.freeze({ 4: '/models/fx/demon-4.glb' });
export function demonPart(env) { … }        // factory
register('demon', demonPart);
```

Factory `demonPart(env)` trả `{ update(state, dt, ctx), hide(), setReducedMotion(flag), dispose() }`.

**Nạp lười:** chỉ gọi `env.assets.load(url)` lần đầu khi `state.demon?.n` có trong `DEMON_URL`. Kết quả `null` → `failed = true`, từ đó `update` luôn trả `false` (ảnh 2D thay thế). Nếu đã `dispose` trước khi nạp xong → `env.assets.release(url)` và bỏ qua.

**Dựng khi nạp xong** (`asset = { scene, animations, clone }`):
- `model = asset.clone(asset.scene)`; `holder = env.group('demon')`; `holder.add(model)`.
- Một vật liệu cho cả con: `mat = env.track(env.materials.spiritMaterial({ color: '#ffffff', rim: '#ff7a1a', glow: '#ffc23a', alpha: 1, dissolveY: [-0.75, 0.1], glowMask: true }))`; `mat.vertexColors = true`. Duyệt `model`: mọi `isMesh` → `node.material = mat`, `node.renderOrder = env.RENDER.demon`, `node.frustumCulled = false`, `node.castShadow = false`. Nếu lưới không có `geometry.attributes.color_1` thì tạo vật liệu khác với `glowMask: false` cho lưới đó.
- `mixer = new THREE.AnimationMixer(model)`; `actions = new Map(asset.animations.map(c => [c.name, mixer.clipAction(c)]))`. `emerge`, `vanish`, `taunt1`, `taunt2` đặt `setLoop(THREE.LoopOnce, 1)` + `clampWhenFinished = true`; còn lại `LoopRepeat`.

**Mỗi khung `update(state, dt, ctx)`** (`SM = globalThis.StandMath`; không có `SM` → trả `false`):
1. `n = clamp(trunc(state.demon?.n), 0, 4)`, `alpha = clamp(state.demon?.alpha ?? 1, 0, 1)`, `reduced = env.reducedMotion`, `t += dt` (khi không giảm chuyển động).
2. Theo dõi đổi cấp: nếu `n !== lastN` thì `prevN = lastN`, `lastN = n`, `since = 0`; ngược lại `since += dt`. `phase = SM.phaseOf(prevN, n, since, reduced)`.
3. Cấp đang vẽ: `shown = DEMON_URL[n] ? n : (phase === 'vanish' && DEMON_URL[prevN] ? prevN : 0)`. `shown === 0` hoặc chưa có `model` → `holder.visible = false` (nếu có), trả `false`. (Cấp 1 đến 3 trả `false` để ảnh 2D vẽ.)
4. Vị trí (bám theo có trễ, trong toạ độ thế giới):
   ```js
   const a = SM.ANCHOR[shown], yaw = Number.isFinite(state.yaw) ? state.yaw : 0;
   const c = Math.cos(yaw), s = Math.sin(yaw);
   const sitDrop = SM.isSitting(state.sit) ? 0.35 : 0;
   local.set(a.x * c + a.z * s, a.y - sitDrop, -a.x * s + a.z * c);
   target.copy(local); env.host.group.localToWorld(target);
   if (!placed || reduced) { pos = [target.x, target.y, target.z]; vel = [0, 0, 0]; placed = true; }
   else ({ pos, vel } = SM.springVec(pos, vel, [target.x, target.y, target.z], dt));
   holder.position.set(pos[0], pos[1], pos[2]); env.host.group.worldToLocal(holder.position);
   facing = reduced ? yaw : SM.turn(facing ?? yaw, yaw, dt, 0.25);
   holder.rotation.y = facing;
   ```
   (`holder` nằm dưới `fx3d` root, root dưới `host.group` với biến đổi đơn vị, nên toạ độ địa phương của `host.group` dùng thẳng được.)
5. Clip: `phase === 'emerge'` → `emerge`; `'vanish'` → `vanish`; còn lại theo `SM.poseOf(state)`: `sit` → `idle`, `scoff` → `scoff`, `peek` → `peek`, `drift` → `drift`, `idle` → `SM.tauntOf(state.id, state.now) || 'idle'`. Đổi clip: `next.reset().play()`, `crossFadeFrom(cur, 0.3, false)` (trừ lần đầu). **Giảm chuyển động**: luôn `idle`, `time = 0`, `paused = true`, `mixer.update(0)`; ngược lại `mixer.update(min(dt, 0.1))`.
6. Độ đặc: `near = shown === 4 && Number.isFinite(ctx.distance) ? clamp((ctx.distance - 1.2) / 0.8, 0.15, 1) : 1` (Ma Vương mờ dần khi máy quay gần hơn 2 m). `mat.userData.uniforms.uAlpha.value = alpha * near * vanishFade`, trong đó `vanishFade = phase === 'vanish' ? 1 - since / SM.DURATION.vanish : 1`. `env.materials.tick(mat, t)`.
7. `holder.visible = true`; trả `true`.

`hide()`: `holder.visible = false` nếu có. `setReducedMotion()`: không cần làm gì thêm (đọc `env.reducedMotion` mỗi khung). `dispose()`: `mixer?.stopAllAction()`, `mixer?.uncacheRoot(model)`, duyệt `model` gọi `node.skeleton?.dispose()` cho `isSkinnedMesh`, `holder?.removeFromParent()`, `env.assets.release(url)` nếu đã `load`. **Không** dispose geometry của `model` (dùng chung trong bộ đệm assets).

## 2. `fx3d/lotus.mjs`

```js
import * as THREE from 'three';
import { register } from './index.mjs?v=1';
export const LOTUS_URL = '/models/fx/lotus.glb';
export function lotusPart(env) { … }
register('lotus', lotusPart);
```

- Hiện khi `tier` từ 2 đến 7 (sen vàng). `tier` 8, 9 (sen hồng, pha lê: T-146) và `< 2` → ẩn, trả `false`.
- Nạp lười lần đầu cần hiện. `null` → `failed`, luôn `false`.
- Dựng: `model = asset.scene.clone(true)` (không có xương); `holder = env.group('lotus')`. Hai vật liệu riêng (qua `env.track`):
  - `petal`: `new THREE.MeshStandardMaterial({ color: '#ffffff', vertexColors: true, metalness: 0.6, roughness: 0.35, emissive: new THREE.Color('#7a4a10'), emissiveIntensity: 0.55, side: THREE.DoubleSide, transparent: true })`
  - `pod`: như trên nhưng `side: THREE.FrontSide`.
  Gán theo `node.material.name` (`'petal'` / `'pod'`; tên khác → dùng `pod`). `renderOrder = env.RENDER.lotus`, `castShadow = false`, `receiveShadow = true`.
- `layers = ['petals2', 'petals1', 'petals0'].map(n => model.getObjectByName(n))` (trong ra ngoài).
- **Nở sen**: khi `tier` chuyển từ ngoài khoảng 2..7 vào trong khoảng, hoặc `tier` tăng → `bloom = 0`. Mỗi khung `bloom += dt`. Tầng thứ `i` (0 = trong cùng): `k = smooth(clamp((bloom - i * 0.3) / 0.6, 0, 1))` với `smooth(x) = x * x * (3 - 2 * x)`; `layer.scale.set(0.35 + 0.65 * k, 0.15 + 0.85 * k, 0.35 + 0.65 * k)`. Giảm chuyển động → `k = 1` ngay.
- Nhịp thở (không giảm chuyển động): `petals0.rotation.y = t * 0.05`, `petals1.rotation.y = -t * 0.07`; `emissiveIntensity = 0.5 + 0.15 * Math.sin(t * 2.2)`. Giảm chuyển động: góc 0, cường độ 0.55.
- Mờ dần: `opacity = state.fade ?? 1` cho cả hai vật liệu.
- Hạt (chỉ khi `env.particles` trả khác `null`, tạo một lần): `env.particles(24, new THREE.PointsMaterial({ color: '#ffd36b', size: 0.05, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }))`; mỗi khung đặt hạt thứ `j` ở bán kính `0.15 + 0.1 * ((j * 7) % 5) / 5`, góc `j * 2.4 + t * 0.5`, cao `((t * 0.35 + j / 24) % 1) * 1.2 + 0.05`; gán `needsUpdate = true`. Ẩn hạt khi sen ẩn.
- `hide()`, `dispose()` như demon (`release(LOTUS_URL)`; không dispose geometry của mô hình).

## 3. `fx3d/aura.mjs`

```js
import * as THREE from 'three';
import { register } from './index.mjs?v=1';
export const AURA_KIT_URL = '/models/fx/aura-kit.glb';
export const AURA_3D_TIERS = Object.freeze([5]);   // bản mẫu: chỉ bậc 5 (T-147 mở rộng)
export function auraPart(env) { … }
register('aura', auraPart);
```

- Hiện khi `AURA_3D_TIERS.includes(state.tier)`; còn lại ẩn, trả `false`.
- Nạp lười; `null` → `failed`. Lấy `shell = asset.scene.getObjectByName('shell')`; không có hoặc không phải `isMesh` → `failed`.
- Dựng `holder = env.group('aura')`; dùng chung `shell.geometry` (không track, không dispose). Bốn lưới:
  - lớp trong: mặt sau `flameShellMaterial({ side: THREE.BackSide })` `renderOrder = RENDER.shellBack`; mặt trước `side: THREE.FrontSide` `renderOrder = RENDER.shellFront`.
  - lớp ngoài (bậc 5 "bốc cao hơn đầu"): cùng hai mặt, `scale.set(1.14, 1.32, 1.14)`, `uOpacity` nhân `0.55`. **Mức Thấp** (`env.quality === 'low'`): ẩn lớp ngoài và đặt `uDisplace = 0` cho mọi vật liệu.
  Mọi vật liệu qua `env.track`. `frustumCulled = false`, `castShadow = false`.
- Mỗi khung: `uColor.value.set(state.color || '#8fd3ff')`; `uOpacity = (state.fade ?? 1) * 0.9` (lớp ngoài × 0.55); `env.materials.tick(m, t)` (giảm chuyển động: `t` đứng yên). Ngồi (`isSitting(state.sit)`, tự viết lại hàm như avatar-glb): `holder.scale.y = 0.8`.
- Hạt mức Cao: `env.particles(32, PointsMaterial màu state.color, size 0.045, cộng sáng)`, bay lên quanh thân bán kính 0.45–0.6, cao 0..2.1, tạo một lần.
- `hide()`, `dispose()` như trên (`release(AURA_KIT_URL)`).

## 4. `avatar.mjs`: điểm nối (sửa đúng 6 chỗ)

**4.1** Ngay sau dòng `import * as THREE from 'three';` thêm:
```js
import { createFx3d } from './fx3d/index.mjs?v=1';
import './fx3d/demon.mjs?v=1';
import './fx3d/lotus.mjs?v=1';
import './fx3d/aura.mjs?v=1';
```
và ngay trên dòng `export const AVATAR_COLORS` thêm:
```js
// Pháp Tướng 3D (T-144): bật bằng localStorage['ta-fx3d'] = '1'. Tắt thì y như cũ (ảnh 2D dán tấm phẳng).
export const FX3D_SWITCH_KEY = 'ta-fx3d';
export function fx3dEnabled() {
  try { return globalThis.localStorage?.getItem(FX3D_SWITCH_KEY) === '1'; } catch (error) { return false; }
}
```
Thêm vào chú thích đầu file (khối `// opts: …`) một dòng: `// opts.fx3d: true/false (mặc định theo công tắc ta-fx3d), đối tượng fx giả, hoặc hàm host → fx (trang thử).`

**4.2** Ngay sau dòng `const effects = new THREE.Group(); effects.name = 'effects'; group.add(effects);` thêm:
```js
  const noCover = Object.freeze({ demon: false, lotus: false, aura: false, merit: false });
  const fxOption = opts.fx3d ?? fx3dEnabled();
  const fxHost = { group, rig, head };
  const fx = typeof fxOption === 'function' ? fxOption(fxHost)
    : fxOption && typeof fxOption === 'object' ? fxOption
      : fxOption ? createFx3d(fxHost, { quality: opts.quality || 'medium', reducedMotion: !!(opts.reducedMotion ?? globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches) })
        : null;
  let fxQuality = opts.quality || 'medium', fxReduced = null;
```

**4.3** Trong `update`, ngay **trước** dòng `const nextKey = …` thêm:
```js
    let covers = noCover;
    if (fx) {
      if (typeof state.quality === 'string' && state.quality !== fxQuality) { fxQuality = state.quality; fx.setQuality?.(fxQuality); }
      if (reduced !== fxReduced) { fxReduced = reduced; fx.setReducedMotion?.(reduced); }
      covers = fx.update({
        tier, color, fade, rank,
        demon: demon ? { n: demon, alpha: clamp(finite(state.demon?.alpha, 1), 0, 1) } : null,
        walking, yaw: finite(state.yaw), bow, sit: sitting ? (bench ? 'bench' : 'cushion') : false,
        talk: !!state.talk, bubble: state.bubble, id: state.id ?? state.name ?? '', now
      }, dt, {
        distance: finite(state.fx?.distance, Infinity), isSelf: !!(state.isSelf ?? opts.isSelf),
        slot: state.fx?.slot !== false, hidden: !!first
      }) || noCover;
    }
```
**4.4** Dòng `const nextKey = \`${tier}/${rank}/${demon}/${color}/${tint}\`;` đổi thành:
```js
    const nextKey = `${tier}/${rank}/${demon}/${color}/${tint}/${+!!covers.demon}${+!!covers.lotus}${+!!covers.aura}`;
```
**4.5** Ba điều kiện:
- `for (const front of [false, true]) {` ngay dưới `if (tier) {` (vẽ `aura-back`/`aura-front`): bọc vòng `for` đó trong `if (!covers.aura) { … }`. (`aura-halo`, `mandorla`, `lightning` **giữ nguyên**: bản mẫu chỉ thay vỏ khí.)
- `if (tier >= 2) {` (sen) → `if (tier >= 2 && !covers.lotus) {`
- `if (demon) {` (quỷ) → `if (demon && !covers.demon) {` (nhánh `} else following = false;` giữ nguyên).
**4.6** Trong `dispose()`, ngay trước dòng `group.clear();` thêm `fx?.dispose?.();`. Và dòng `return { group, update, setLook(nextLook) { … }, dispose };` thêm thuộc tính `fx` vào cuối: `…, dispose, fx };`.

## 5. `world3d/index.mjs`: khoảng cách và suất (chỉ hàm `updatePeople`)

Ngay sau dòng `const seen = new Set();` thêm:
```js
  // Pháp Tướng 3D: khoảng cách ngang tới máy quay và suất 3D (bảng §2.4) cho từng người.
  const cam = world.ctx.camera?.position, quality = world.ctx.quality;
  const distance = new Map(list.map(p => {
    const w = globalThis.ViewMath.toWorld(state.scene, p.x, p.z);
    return [p.id, cam ? Math.hypot(w.x - cam.x, w.z - cam.z) : Infinity];
  }));
  const SM = globalThis.StandMath;
  const pick = (key, kind) => SM ? SM.slots(list.filter(p => p[key]).map(p => ({ id: p.id, distance: distance.get(p.id) })), state.me, quality, kind) : null;
  const demonSlots = pick('demon', 'demon'), auraSlots = pick('aura', 'aura');
```
Trong lời gọi `entry.avatar.update({ ...person, now: state.now, isSelf: …, view: …, reducedMotion: … }, dt)` thêm hai khoá vào đối tượng:
```js
quality, fx: { distance: distance.get(person.id), slot: !SM || demonSlots.has(person.id) || auraSlots.has(person.id) || (!person.demon && !person.aura) }
```

## 6. Số phiên bản (`?v=`) và nạp stand-math

| File | Tìm | Đổi thành |
|---|---|---|
| `avatar-glb.mjs` | `'./avatar.mjs?v=3'` | `'./avatar.mjs?v=4'` |
| `world3d/index.mjs` | `import('./avatar-glb.mjs?v=2')` | `?v=3` |
| `scenes/arena.mjs`, `scenes/yard.mjs` | `'../avatar-glb.mjs?v=2'` | `?v=3` |
| `view3d-ui.js` | `'/js/world3d/index.mjs?v=8'` | `?v=9` |
| `world3d-test.html` | `index.mjs?v=8` | `?v=9` |
| `world3d-avatar.html` | `avatar.mjs?v=3`, `avatar-glb.mjs?v=2` | `?v=4`, `?v=3` |
| `index.html` | `<script src="/js/view3d-ui.js?v=7"></script>` | `?v=8` |

`index.html`: ngay **sau** dòng `<script src="/js/view-math.js?v=2"></script>` thêm `<script src="/js/stand-math.js?v=1"></script>`.

`avatar-glb.mjs`: ngoài `?v=`, trong `createGlbAvatar` dòng `return { group, update, setLook, dispose };` đổi thành `return { group, update, setLook, dispose, fx: base.fx };`.

## 7. Trang thử `public/world3d-fx.html`

- Đổi import `avatar.mjs?v=3` → `?v=4`. Thêm `import { placeholderParts } from '/js/world3d/fx3d/placeholder.mjs?v=1';` (thay cho `registerPlaceholders`, bỏ lời gọi `registerPlaceholders()` để không đè phần thật trong registry).
- Thay `<select>`/checkbox "Hình khối tạm" bằng `<select id="mode">` **Nguồn hiệu ứng**: `real` "Mô hình 3D thật (như trong game)" (mặc định), `temp` "Hình khối tạm", `off` "Tắt 3D (ảnh 2D cũ)". Bỏ checkbox "Hiện ảnh 2D cũ để so" (avatar tự vẽ ảnh 2D cho phần chưa có 3D).
- `buildFx()` đổi thành dựng lại nhân vật: `avatar?.dispose(); avatar = createAvatar({ g: 'nam', c: 11, h: 2 }, { quality, reducedMotion, fx3d: mode === 'real' ? true : mode === 'temp' ? host => createFx3d(host, { parts: placeholderParts(), quality, reducedMotion }) : false }); scene.add(avatar.group);`.
- Mỗi khung chỉ gọi `avatar.update({ name: 'Hắc Phong Ma Khách', id: 'hac-phong', walking, bow, sit, talk, yaw, now, reducedMotion, quality, aura: tier ? { t: tier, color } : null, meritRank: rank, demon: demon ? { n: demon, alpha } : null, fx: { distance: camera.position.distanceTo(avatar.group.position), slot: true } }, dt)`. Bỏ lời gọi `fx.update` riêng. `covers` lấy từ `avatar.fx?.covers`.
- Thêm `<select id="yaw">` **Hướng nhân vật** (0°, 90°, 180°, 270°) và checkbox **Đi vòng tròn** (khi bật: nhân vật chạy trên vòng bán kính 2 m, `yaw` theo hướng đi, `walking = true`) để thấy quỷ bám theo có trễ.
- Thêm nút **Bật Pháp Tướng 3D trong game** / **Tắt…** (giống nút `bm-use` của `world3d-avatar.html`) đổi `localStorage['ta-fx3d']` giữa `'1'` và xoá, rồi `location.reload()`; chữ nút theo trạng thái.
- `window.fxDebug = { avatar, camera, scene, renderer, setView, covers: () => ({ ...(avatar.fx?.covers || {}) }) }`.
- `setQuality`/`setReducedMotion` khi đổi bảng chọn: dựng lại nhân vật (gọi `buildFx()`).
- Trạng thái: giữ dòng "Đang hiện: …" như cũ.

## 8. Test

`test/world3d-fx.test.js` thêm (đặt `globalThis.StandMath = require('../public/js/stand-math.js')` ở đầu file):
- Hàm tạo tài sản giả: `fakeAsset({ skinned })` trả `{ scene, animations, clone: s => s.clone(true) }`, trong đó `scene` là `THREE.Group` chứa một `Mesh` (`BoxGeometry` có thêm thuộc tính `color` và `color_1` cỡ đúng số đỉnh, vật liệu `MeshStandardMaterial` tên `'spirit'`), một nút tên `shell` (Mesh), ba nút `petals0..2` và `pod` (Mesh, vật liệu tên `petal`/`pod`); `animations` là tám `new THREE.AnimationClip(name, 1, [])` cho `emerge, idle, drift, scoff, peek, taunt1, taunt2, vanish`.
1. `demon 3D chỉ phủ cấp 4 sau khi nạp xong`: `createFx3d(host, { assets: createAssets({ loadGltf: async () => fakeAsset() }), parts: { demon: demonPart } })`. Lần `update` đầu với `demon {n:4}` → `covers.demon === false`; chờ `setTimeout 0` → lần sau `true`; `n: 2` → `false`; `n: 0` sau 1 giây (`update(..., 1.0)`) → `false`.
2. `demon bám theo sau lưng và quay theo chủ`: sau nạp, `update` với `yaw: 0` nhiều khung `dt 1/60` (2 giây) → vị trí nút `fx3d-demon` gần `(0, 1.2, -0.55)` (sai số 0.02); đổi `yaw: Math.PI / 2`, chạy 2 giây → gần `(-0.55, 1.2, 0)` (sau lưng khi nhìn +X).
3. `.glb lỗi thì demon, lotus, aura đều không phủ`: `loadGltf` trả `null` → sau chờ, cả ba `covers` `false`, không ném lỗi.
4. `lotus phủ bậc 2 đến 7, aura chỉ bậc 5`: tier 5 → `lotus` và `aura` `true` sau nạp; tier 8 → `lotus false`; tier 3 → `aura false`.
5. `giảm chuyển động: không có hạt, sen nở ngay`: `quality 'high', reducedMotion true`, tier 5 → không có `isPoints`; ba nút `petals*` có `scale.x === 1`.
6. `dispose trả tài nguyên về bộ đệm`: sau `fx.dispose()`, `assets.size() === 0`.

`test/world3d-avatar.test.js` thêm (dùng `browserImages(t)` và `canvasFactory()` có sẵn trong file):
7. `covers.demon = true thì sprite quỷ ẩn; false thì sprite hiện như cũ`: `fake = { covers: { demon: false, lotus: false, aura: false, merit: false }, update() { return this.covers; }, setQuality() {}, setReducedMotion() {}, dispose() { this.disposed = true; } }`; `createAvatar({ g: 'nam', c: 0, h: 0 }, { fx3d: fake, createCanvas: canvasFactory() })`; `update({ demon: { n: 4, alpha: 1 }, aura: { t: 5, color: '#8fd3ff' } })` → `group.getObjectByName('demon')` có; `'lotus'`, `'aura-back'` có. Đặt `fake.covers.demon = true`, `update` lại → `'demon'`, `'demon-eyes'`, `'demon-fire'` không còn; `'lotus'` còn. `covers.lotus = true` → `'lotus'` mất. `covers.aura = true` → `'aura-back'`, `'aura-front'` mất nhưng `'aura-halo'` còn. `dispose()` → `fake.disposed === true`.
8. `fx nhận trạng thái chuẩn hóa và ẩn ở góc nhìn thứ nhất`: `fake.update` ghi lại `(state, dt, ctx)`; `update({ isSelf: true, view: 'first', demon: { n: 4, alpha: 0.5 }, yaw: 1, fx: { distance: 5, slot: false } }, 0.016)` → `ctx.hidden === true`, `ctx.slot === false`, `ctx.distance === 5`, `state.demon.alpha === 0.5`, `state.yaw === 1`.
9. `công tắc ta-fx3d tắt thì không tạo fx3d`: `createAvatar(look, { createCanvas })` (không có `localStorage`) → `group.getObjectByName('fx3d') === undefined` và `avatar.fx === null`.

## 9. Thông số mô hình (T-142, Điều phối điền sau khi chạy Blender)

Đo bằng dòng `RESULT` của kịch bản Blender ngày 14/11 (hình khối còn đang sửa ở vòng soát hình, nhưng **tên nút, xương, clip, thuộc tính không đổi**):

| Tệp | Nội dung |
|---|---|
| `demon-4.glb` (~210 KB, ~2.600 tam giác) | một SkinnedMesh, vật liệu `spirit`, thuộc tính `POSITION, NORMAL, COLOR_0, COLOR_1, JOINTS_0, WEIGHTS_0` (không có UV); 17 xương `root, spine, chest, neck, head, jaw, shoulder_L/R, upper_arm_L/R, forearm_L/R, hand_L/R, tail1, tail2, tail3`; 8 clip `emerge` 0,9 s, `idle` 4 s, `drift` 1,6 s, `scoff` 2 s, `peek` 2 s, `taunt1` 2 s, `taunt2` 2 s, `vanish` 0,6 s. Gốc ở thắt lưng quỷ, mặt nhìn +Z. |
| `lotus.glb` (~33 KB, ~760 tam giác) | bốn Mesh `petals0`, `petals1`, `petals2`, `pod`; vật liệu `petal` (hai mặt), `pod`; thuộc tính `POSITION, NORMAL, COLOR_0`. Gốc ở tâm mặt sàn, mặt gương sen cao ~0,05–0,06 m. |
| `aura-kit.glb` (~10 KB, 320 tam giác) | một Mesh `shell`, vật liệu `shell`, `POSITION, NORMAL, TEXCOORD_0`; cao từ y −0,05 tới 2,05, `uv.y` 0 ở đáy, 1 ở đỉnh. |

## 10. Lệnh kiểm (Điều phối chạy)

```
npm run check
node --test test/world3d-avatar.test.js test/world3d-fx.test.js test/hall-view3d.test.js test/world3d-avatar-glb.test.js test/stand-math.test.js
npm test
```
Rồi mở `/world3d-fx.html` và game thật (Tàng Kinh Các 3D, Hắc Phong Ma Khách), công tắc bật/tắt, chụp 4 góc.

## 11. Bàn giao

Ghi ngắn: file đã sửa (đánh dấu chỗ ngoài đặc tả và lý do), chỗ đặc tả chưa rõ. Không sửa `task.md`.
