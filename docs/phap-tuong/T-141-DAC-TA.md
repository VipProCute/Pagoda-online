# Đặc tả T-141 · Khung hiệu ứng 3D `fx3d` và ba vật liệu

> Viết cho thợ. **Làm đúng đặc tả, không tự thiết kế lại.** Thấy đặc tả mâu thuẫn với mã thật thì dừng, ghi vào bàn giao.
> Thiết kế chung: [KE-HOACH-PHAP-TUONG-3D.md](../KE-HOACH-PHAP-TUONG-3D.md) §2.1 (hợp đồng), §2.2 (vật liệu), §2.4 (ngân sách).
> Three.js bản `0.187.0`, nạp bằng `import * as THREE from 'three'` (trình duyệt dùng importmap, Node dùng gói `three` trong `node_modules`). Addon ở `/vendor/three-addons/...` (xem `public/js/world3d/avatar-glb.mjs`).

## 0. File

| File | Việc |
|---|---|
| `public/js/world3d/fx3d/index.mjs` | **mới**: `createFx3d`, `register`, `RENDER` |
| `public/js/world3d/fx3d/assets.mjs` | **mới**: nạp `.glb` dùng chung, đếm tham chiếu |
| `public/js/world3d/fx3d/materials.mjs` | **mới**: `spiritMaterial`, `flameShellMaterial`, `glowMaterial`, `noiseTexture` |
| `public/js/world3d/fx3d/placeholder.mjs` | **mới**: ba phần tạm (hình khối) để thử trang khi chưa có `.glb` |
| `public/world3d-fx.html` | **mới**: trang thử |
| `test/world3d-fx.test.js` | **mới** |

**Không được chạm**: `public/js/world3d/avatar.mjs`, `avatar-glb.mjs`, `index.mjs` (của world3d), `public/index.html`, `server.js`, `hall.js`, `task.md`, `package.json`, mọi file khác. Không chạy `npm`/`node`/`git` (hộp cát không cho; Điều phối chạy test và commit).

Quy ước: ES module, `'use strict';` ở dòng đầu như các `.mjs` khác trong `world3d/`, nháy đơn, dấu chấm phẩy, thụt 2 cách, chú thích tiếng Việt có dấu. Import nội bộ có `?v=1` (ví dụ `import { createAssets } from './assets.mjs?v=1';`). Không `console.*`.

## 1. `materials.mjs`

```js
import * as THREE from 'three';
export function noiseTexture() { … }          // một DataTexture 64×64 dùng chung (singleton), sinh bằng mã
export function spiritMaterial(opts) { … }
export function flameShellMaterial(opts) { … }
export function glowMaterial(color) { … }
export function tick(material, time) { … }    // cập nhật uTime cho vật liệu có uniform thời gian
```

### 1.1 `noiseTexture()`

- Trả **cùng một** `THREE.DataTexture` mỗi lần gọi (biến cấp module, tạo lần đầu).
- 64×64, định dạng `THREE.RedFormat`, kiểu `THREE.UnsignedByteType`, dữ liệu `Uint8Array(64*64)`.
- Nhiễu giá trị lặp liền mép (tileable): lưới 8×8 giá trị ngẫu nhiên từ mulberry32 hạt giống cố định `1337`, nội suy smoothstep, cộng 2 quãng (8×8 trọng số 0,65 và 16×16 trọng số 0,35), chỉ số lưới lấy `% kích thước lưới` để liền mép.
- `wrapS = wrapT = THREE.RepeatWrapping`, `magFilter = minFilter = THREE.LinearFilter`, `generateMipmaps = false`, `needsUpdate = true`.
- Hàm mulberry32 (chép nguyên):
  ```js
  function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  ```

### 1.2 `spiritMaterial({ color = '#5a1418', rim = '#ff7a1a', glow = '#ffc23a', alpha = 1, dissolveY = [-0.6, 0.15], glowMask = false } = {})`

Linh thể bán trong suốt, viền Fresnel sáng, nửa dưới tan thành khói.

- Tạo `new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.0, transparent: true, depthWrite: false, side: THREE.DoubleSide })`. (Three ≥ r151 tự vẽ vật liệu trong suốt hai mặt thành hai lượt: mặt sau rồi mặt trước. **Không** đặt `forceSinglePass`.)
- `material.userData.uniforms` = `{ uRim: { value: new THREE.Color(rim) }, uGlow: { value: new THREE.Color(glow) }, uAlpha: { value: alpha }, uDissolve: { value: new THREE.Vector2(dissolveY[0], dissolveY[1]) }, uTime: { value: 0 }, uNoise: { value: noiseTexture() } }`. Tạo **trước**, rồi trong `onBeforeCompile(shader)` gán `Object.assign(shader.uniforms, material.userData.uniforms)` để cập nhật giá trị không cần biên dịch lại.
- `glowMask: true` thì `material.defines = { SPIRIT_GLOW: '' }` (mô hình có thuộc tính đỉnh `color_1` = mặt nạ phát sáng; GLTFLoader đặt tên `COLOR_1` thành `color_1`).
- `material.customProgramCacheKey = () => 'fx-spirit' + (glowMask ? '-glow' : '')`.
- Chèn shader trong `onBeforeCompile` bằng `shader.vertexShader.replace(…)` / `shader.fragmentShader.replace(…)`:
  - Vertex, thêm khai báo ngay sau `#include <common>`:
    ```glsl
    varying float vLocalY;
    varying vec2 vNoiseUv;
    #ifdef SPIRIT_GLOW
    attribute vec3 color_1;
    varying float vGlow;
    #endif
    ```
  - Vertex, ngay sau `#include <begin_vertex>`:
    ```glsl
    vLocalY = transformed.y;
    vNoiseUv = vec2(transformed.x + transformed.z, transformed.y) * 0.9;
    #ifdef SPIRIT_GLOW
    vGlow = color_1.r;
    #endif
    ```
  - Fragment, thêm khai báo ngay sau `#include <common>`:
    ```glsl
    uniform vec3 uRim; uniform vec3 uGlow; uniform float uAlpha; uniform vec2 uDissolve; uniform float uTime; uniform sampler2D uNoise;
    varying float vLocalY; varying vec2 vNoiseUv;
    #ifdef SPIRIT_GLOW
    varying float vGlow;
    #endif
    ```
  - Fragment, thay `#include <emissivemap_fragment>` bằng chính nó cộng thêm:
    ```glsl
    #include <emissivemap_fragment>
    float spiritFr = pow(1.0 - abs(dot(normalize(normal), normalize(vViewPosition))), 2.5);
    totalEmissiveRadiance += uRim * spiritFr * 1.6;
    #ifdef SPIRIT_GLOW
    totalEmissiveRadiance += uGlow * vGlow * 2.2;
    #endif
    ```
  - Fragment, thay `#include <dithering_fragment>` bằng chính nó cộng thêm:
    ```glsl
    #include <dithering_fragment>
    float spiritN = texture2D(uNoise, vNoiseUv + vec2(0.0, -uTime * 0.35)).r;
    float spiritCut = smoothstep(uDissolve.x, uDissolve.y, vLocalY + (spiritN - 0.5) * 0.35);
    gl_FragColor.a *= uAlpha * spiritCut * mix(0.55, 1.0, spiritFr);
    #ifdef SPIRIT_GLOW
    gl_FragColor.a = max(gl_FragColor.a, vGlow * uAlpha * spiritCut);
    #endif
    ```
- Trả `material`.

### 1.3 `flameShellMaterial({ color = '#8fd3ff', height = 2.1, displace = true, opacity = 1, side = THREE.FrontSide } = {})`

Vỏ khí: cộng sáng, mép trên bập bùng như lửa.

- `new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side, toneMapped: false })`.
- `uniforms = { uColor: { value: new THREE.Color(color) }, uHeight: { value: height }, uTime: { value: 0 }, uOpacity: { value: opacity }, uDisplace: { value: displace ? 1 : 0 }, uNoise: { value: noiseTexture() } }`.
- Vertex shader (chép nguyên):
  ```glsl
  uniform float uHeight; uniform float uTime; uniform float uDisplace; uniform sampler2D uNoise;
  varying float vH; varying vec3 vN; varying vec3 vV; varying vec2 vUv2;
  void main() {
    vH = clamp(position.y / uHeight, 0.0, 1.0);
    vUv2 = vec2(uv.x * 2.0, uv.y * 1.5 - uTime * 0.55);
    float n = texture2D(uNoise, vUv2).r;
    vec3 p = position + normal * (n - 0.35) * 0.32 * smoothstep(0.35, 1.0, vH) * uDisplace;
    p.y += n * 0.25 * smoothstep(0.6, 1.0, vH) * uDisplace;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
  ```
- Fragment shader (chép nguyên):
  ```glsl
  uniform vec3 uColor; uniform float uTime; uniform float uOpacity; uniform sampler2D uNoise;
  varying float vH; varying vec3 vN; varying vec3 vV; varying vec2 vUv2;
  void main() {
    float fr = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 1.6);
    float band = texture2D(uNoise, vUv2 * vec2(1.0, 0.6)).r;
    float a = (0.25 + fr) * smoothstep(0.15, 0.75, band + 0.25) * (1.0 - vH) * smoothstep(0.0, 0.08, vH) * uOpacity;
    gl_FragColor = vec4(uColor * (0.8 + band * 0.6), a);
  }
  ```
- Trả `material`.

### 1.4 `glowMaterial(color = '#ffd36b')`

`new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })`.

### 1.5 `tick(material, time)`

Nếu `material?.userData?.uniforms?.uTime` thì gán `.value = time`; nếu là `ShaderMaterial` có `material.uniforms?.uTime` thì gán `.value = time`. Không có thì bỏ qua.

## 2. `assets.mjs`

```js
export function createAssets({ loadGltf } = {}) → { load(url), release(url), size() }
export const sharedAssets = createAssets();
```

- `loadGltf(url)` (tùy chọn, để test): trả `Promise<{ scene, animations } | null>`. Mặc định:
  ```js
  async function defaultLoad(url) {
    const [loader] = await Promise.all([import('/vendor/three-addons/loaders/GLTFLoader.js')]);
    const gltf = await new loader.GLTFLoader().loadAsync(url);
    return { scene: gltf.scene, animations: gltf.animations || [] };
  }
  ```
- `clone`: mặc định nạp lười `import('/vendor/three-addons/utils/SkeletonUtils.js')` lấy `clone`; nạp lỗi thì dùng `scene => scene.clone(true)`.
- Bộ đệm `Map<url, { promise, refs, value }>`.
- `load(url)`:
  - `url` không phải chuỗi rỗng-khác → `Promise.resolve(null)`.
  - Chưa có trong bộ đệm: tạo `promise = Promise.resolve().then(() => loadGltf(url)).then(v => v && v.scene ? v : null).catch(() => null)`, kèm lấy hàm `clone`. Giá trị trả về là `{ scene, animations, clone }` hoặc `null`. **Không ghi console.**
  - `refs += 1` mỗi lần gọi; trả `promise`.
  - Kết quả `null` thì xoá url khỏi bộ đệm (lần sau thử lại) — nhưng vẫn trả `null` cho lời gọi này.
- `release(url)`: `refs -= 1`; về `0` thì xoá khỏi bộ đệm và (nếu đã nạp xong) duyệt `value.scene` gọi `dispose()` cho mọi `geometry`, `material` (mảng hoặc đơn) và mọi `texture` là thuộc tính của material (`map`, `emissiveMap`, `normalMap`, `roughnessMap`, `metalnessMap`, `alphaMap`). Gọi `release` cho url không có trong bộ đệm: bỏ qua.
- `size()`: số url đang trong bộ đệm (để test).

## 3. `index.mjs`

```js
import * as THREE from 'three';
import { sharedAssets } from './assets.mjs?v=1';
import * as materials from './materials.mjs?v=1';

export const PARTS = Object.freeze(['demon', 'lotus', 'aura', 'merit']);
// Thứ tự vẽ các lớp trong suốt (renderOrder). Thân nhân vật là vật đục nên luôn vẽ trước.
export const RENDER = Object.freeze({ shellBack: 1, demon: 2, lotus: 3, shellFront: 4, particles: 5 });
const registry = new Map();
export function register(name, factory) { … }   // name phải thuộc PARTS; factory là hàm; trả true/false
export function registered() { return [...registry.keys()]; }
export function createFx3d(host, opts = {}) { … }
```

### 3.1 `createFx3d(host, opts)`

- `host`: `{ group, rig, head }` (nút của nhân vật trong `avatar.mjs`: `group` là gốc, `rig` là nút `body` quay theo `yaw`, `head` là nút đầu). Thiếu `host.group` → trả đối tượng rỗng an toàn: `{ root: null, covers: {demon:false,lotus:false,aura:false,merit:false}, update() { return this.covers; }, setQuality() {}, dispose() {} }`.
- `opts`: `{ quality = 'medium', reducedMotion = false, assets = sharedAssets, parts }`. `parts` (tùy chọn) là đối tượng `{ tên: factory }` dùng **thay** cho registry (để test). Không có thì dùng registry hiện tại.
- Tạo `root = new THREE.Group()`, `root.name = 'fx3d'`, `host.group.add(root)`.
- `covers` là **một đối tượng duy nhất** `{ demon: false, lotus: false, aura: false, merit: false }`, chỉ đổi giá trị thuộc tính, không thay đối tượng (avatar giữ tham chiếu).
- `tracked = new Set()`; `track(x)` thêm `x` vào tập và trả `x` (mọi geometry, material, texture riêng do phần con tạo đều phải đi qua `track`).
- `env` truyền cho mỗi factory:
  ```js
  const env = {
    THREE, materials, host, assets, RENDER,
    get quality() { return quality; }, get reducedMotion() { return reducedMotion; },
    track,
    group(name) { const g = new THREE.Group(); g.name = 'fx3d-' + name; root.add(g); return g; },
    particles(count, material) { … }
  };
  ```
  `particles(count, material)`: nếu `reducedMotion` hoặc `quality !== 'high'` → trả `null`. Ngược lại tạo `THREE.BufferGeometry` có `position` `Float32Array(min(count,48)*3)` (qua `track`), `THREE.Points(geometry, track(material))`, `renderOrder = RENDER.particles`, `frustumCulled = false`, thêm vào `root`, trả `points`.
- Với mỗi tên trong `PARTS` có factory: `instance = factory(env)`; factory ném lỗi hoặc trả không phải đối tượng có `update` → bỏ qua phần đó (không ném ra ngoài). Giữ `Map<tên, instance>`.
- `update(state = {}, dt = 0, ctx = {})`:
  - `ctx`: `{ distance, isSelf, slot = true, hidden = false }`.
  - `hidden || slot === false` → `root.visible = false`, mọi `covers[x] = false`, gọi `instance.hide?.()` cho từng phần, trả `covers`.
  - Ngược lại `root.visible = true`; với mỗi phần: `try { covers[name] = !!instance.update(state, dt, ctx); } catch (e) { covers[name] = false; }`.
  - Trả `covers`.
- `setQuality(q)`: chỉ nhận `'low' | 'medium' | 'high'`; đổi `quality`, gọi `instance.setQuality?.(q)`.
- `setReducedMotion(flag)`: đổi `reducedMotion`, gọi `instance.setReducedMotion?.(!!flag)`.
- `dispose()`: chỉ chạy một lần; gọi `instance.dispose?.()` (bọc `try`), rồi `tracked.forEach(x => x.dispose?.())`, `root.removeFromParent()`, `root.clear()`, mọi `covers` về `false`. **Không** dispose geometry/material của mô hình lấy từ `assets` (dùng chung giữa nhân vật); phần con tự `assets.release(url)` trong `dispose` của nó.
- Trả `{ root, covers, update, setQuality, setReducedMotion, dispose }`.

## 4. `placeholder.mjs` (hình khối tạm, chỉ cho trang thử)

```js
import { register } from './index.mjs?v=1';
export function placeholderParts() { return { demon, lotus, aura }; }   // ba factory
export function registerPlaceholders() { const p = placeholderParts(); for (const k in p) register(k, p[k]); }
```

Mỗi factory nhận `env`, trả `{ update(state, dt, ctx), dispose() }`, dùng `env.track` cho mọi thứ tạo ra:

- **demon**: hình trứng `SphereGeometry(0.5, 24, 16)` co giãn theo cấp `state.demon.n` (1..4) với chiều cao `[0, 0.45, 1.3, 1.9, 2.8][n]`, đặt sau lưng (`z = -0.5`), gốc ở `y = 1.1`; vật liệu `spiritMaterial({ alpha: state.demon.alpha })` (đổi `uAlpha` mỗi khung); `renderOrder = RENDER.demon`; hai quả cầu nhỏ `glowMaterial('#ffc23a')` làm mắt. Cập nhật `materials.tick(mat, t)`. `n = 0` → ẩn nhóm, trả `false`; còn lại trả `true`. Gắn nhóm vào `env.host.rig` nếu có (để quay theo nhân vật), không thì `env.group('demon')`.
- **lotus**: `state.tier >= 2` → đĩa `CylinderGeometry(0.5, 0.42, 0.08, 16)` vật liệu `MeshStandardMaterial({ color: '#d9a640', metalness: 0.6, roughness: 0.35, emissive: '#5a3a08' })` ở `y = 0.04` + vòng 16 cánh `ConeGeometry(0.09, 0.32, 4)` xòe quanh mép. Trả `true` khi hiện.
- **aura**: `state.tier >= 1` → hình trứng `SphereGeometry(0.55, 16, 12)` co `(1, 2.1/1.1, 1)` đặt `y = 1.05`, hai lưới cùng geometry: mặt sau `flameShellMaterial({ color: state.color, side: THREE.BackSide })` (`renderOrder = RENDER.shellBack`) và mặt trước `side: THREE.FrontSide` (`renderOrder = RENDER.shellFront`); `uOpacity = state.fade ?? 1`; `quality === 'low'` → `uDisplace = 0`. Mức Cao (`env.particles(32, new THREE.PointsMaterial({ color: state.color, size: 0.05, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }))`) có hạt bay lên quanh thân (đặt lại vị trí mỗi khung theo `t`). Trả `true` khi hiện.

## 5. Trang thử `public/world3d-fx.html`

Chép bố cục và CSS của `public/world3d-avatar.html` (phần đầu `<style>`, importmap, kiểu `.av-*`), gọn lại:

- Tiêu đề `<title>Pháp tướng 3D · Chùa Tâm An</title>`, kicker `CHÙA TÂM AN · XƯỞNG PHÁP TƯỚNG`, `h1` `Linh thể sau lưng, hào quang quanh thân.`
- Nạp `<script src="/js/aura.js"></script>`, `<script src="/js/merit.js?v=npc2"></script>`, `<script src="/js/stand-math.js?v=1"></script>` (file này do thẻ khác tạo; trang không bắt buộc dùng).
- Một nhân vật ở giữa: `import { createAvatar } from '/js/world3d/avatar.mjs?v=3';` dựng `createAvatar({ g: 'nam', c: 11, h: 2 }, {})`.
- `import { createFx3d, registered } from '/js/world3d/fx3d/index.mjs?v=1';` và `import { registerPlaceholders } from '/js/world3d/fx3d/placeholder.mjs?v=1';`. Nếu checkbox "Hình khối tạm" bật (mặc định bật) thì `registerPlaceholders()` trước khi tạo fx. Tạo `fx = createFx3d({ group: avatar.group, rig: avatar.group.getObjectByName('body'), head: avatar.group.getObjectByName('head') }, { quality, reducedMotion })`. Đổi checkbox thì `fx.dispose()` rồi tạo lại.
- Bảng chọn (`<select>`/`<input>`, cao ≥ 44px như trang mẫu): **Cấp quỷ** 0..4 (tên lấy từ `MERIT.DEMONS`), **Độ rõ quỷ** (range 0,12..1), **Bậc hào quang** 0..9 (tên từ `AURA.TIERS`), **Pháp tướng** 0..6 (tên từ `MERIT.RANKS`), **Mức chất lượng** thấp/vừa/cao, **Tư thế** đứng/đi/vái/nói/ngồi, checkbox **Giảm chuyển động**, checkbox **Hiện ảnh 2D cũ để so** (mặc định tắt), checkbox **Hình khối tạm** (mặc định bật).
- Mỗi khung: `const tierDef = AURA.TIERS[tier-1]`; `fxState = { tier, color: tierDef?.color || '#ffd36b', fade: 1, rank, demon: demon ? { n: demon, alpha } : null, walking, yaw: 0, bow, sit, talk, id: 'mau', now: Date.now() }`; `fx.update(fxState, dt, { distance: camera.position.distanceTo(avatar.group.position), isSelf: false, slot: true })`. Gọi `avatar.update({ name: 'Hắc Phong Ma Khách', walking, bow, sit, talk, now: Date.now(), reducedMotion, ...(show2d ? { aura: tier ? { t: tier, color } : null, meritRank: rank, demon: demon ? { n: demon, alpha } : null } : {}) }, dt)`.
- Máy quay quỹ đạo: kéo để xoay, cuộn để gần xa, phím mũi tên (chép từ trang mẫu). Thêm bốn nút góc nhanh **Trước / Nghiêng 45° / Ngang / Sau** (đặt `yaw` = `0`, `π/4`, `π/2`, `π`; `pitch` 1.32; `distance` 6).
- Nền: sàn tròn, hai đèn như trang mẫu; thêm checkbox **Đêm** đổi nền `#0d1016` và giảm đèn còn 25% (để xem độ phát sáng).
- Ô trạng thái `role="status"` ghi: các phần đã đăng ký (`registered().join(', ')`), `covers` hiện tại (ví dụ `quỷ 3D · sen 3D · vỏ khí 3D`), số tam giác và lượt vẽ từ `renderer.info.render`.
- Gắn `window.fxDebug = { fx, avatar, camera, scene, renderer, setView(yaw, pitch, distance) }` để Điều phối chụp ảnh bằng script.
- Chữ giao diện tiếng Việt có dấu. Gán chữ bằng `textContent`. Không `innerHTML`.
- Xử lý mất WebGL như trang mẫu (`webglcontextlost`, `try/catch` lúc tạo renderer, báo lý do tiếng Việt).

## 6. Test `test/world3d-fx.test.js`

Khuôn:
```js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const load = () => import('../public/js/world3d/fx3d/index.mjs');
const loadAssets = () => import('../public/js/world3d/fx3d/assets.mjs');
const loadMaterials = () => import('../public/js/world3d/fx3d/materials.mjs');
```
`THREE` lấy bằng `await import('three')`. Host giả: `const group = new THREE.Group(); const rig = new THREE.Group(); rig.name = 'body'; group.add(rig); const head = new THREE.Group(); rig.add(head);`.

Các test (tên tiếng Việt):
1. `assets giả trả null thì covers toàn false, không ném lỗi`: `assets = createAssets({ loadGltf: async () => null })`; một factory `demon` gọi `env.assets.load('/models/fx/demon-4.glb').then(a => { model = a; })` và `update` trả `!!model`. `createFx3d(host, { assets, parts: { demon } })`, `await` vài microtask (`await new Promise(r => setTimeout(r, 0))`), `update({ demon: { n: 4, alpha: 1 } }, 0.016, {})` → `covers` đúng `{ demon:false, lotus:false, aura:false, merit:false }`.
2. `loadGltf ném lỗi hoặc 404 thì load trả null và không ghi console`: thay tạm `console.error`/`console.warn` bằng hàm đếm; `loadGltf: async () => { throw new Error('404'); }` → `await load(url) === null`, đếm `0`; `size()` về `0`.
3. `bộ đệm theo URL và đếm tham chiếu`: `loadGltf` đếm số lần gọi, trả `{ scene: new THREE.Group() (có một Mesh với BoxGeometry + MeshBasicMaterial gắn spy dispose), animations: [] }`. Gọi `load(u)` hai lần → `loadGltf` gọi 1 lần, hai kết quả cùng `scene`; `release(u)` một lần → geometry chưa dispose, `size() === 1`; `release(u)` lần hai → geometry và material đã dispose, `size() === 0`.
4. `dispose gọi dispose trên mọi geometry, material đã tạo`: factory tạo `env.track(new THREE.BoxGeometry())`, `env.track(materials.spiritMaterial())`, `env.track(materials.flameShellMaterial())`, `env.track(materials.glowMaterial())` và gắn spy (bọc `dispose` gốc, đếm). Sau `fx.dispose()`: mỗi cái đúng 1 lần; `host.group.getObjectByName('fx3d')` là `undefined`; gọi `dispose()` lần hai không ném lỗi, không đếm thêm.
5. `giảm chuyển động thì không tạo THREE.Points`: factory gọi `env.particles(32, new THREE.PointsMaterial())` trong lúc tạo. `quality: 'high', reducedMotion: true` → duyệt `root` không có `isPoints`; `quality: 'high', reducedMotion: false` → có đúng một `Points`, `geometry.attributes.position.count <= 48`; `quality: 'medium'` → không có.
6. `ẩn ở góc nhìn thứ nhất hoặc ngoài suất`: factory trả `true`; `update(s, 0, { hidden: true })` → `root.visible === false` và `covers.demon === false`; `update(s, 0, { slot: false })` cũng vậy; `update(s, 0, {})` → `covers.demon === true`; `covers` luôn là cùng một đối tượng (`===`).
7. `factory lỗi không làm hỏng phần khác`: `parts: { demon: () => { throw new Error('x'); }, lotus: env => ({ update: () => true }) }` → không ném; `update` cho `covers.lotus === true`, `covers.demon === false`. Một phần có `update` ném lỗi → `covers` của nó `false`, không ném ra ngoài.
8. `register chỉ nhận tên hợp lệ`: `register('demon', () => ({ update: () => false }))` → `true`; `register('xyz', () => {})` → `false`; `register('lotus', 5)` → `false`.
9. `noiseTexture dùng chung, 64×64, lặp liền mép`: hai lần gọi `===`; `image.width === 64`, `image.height === 64`; `data.length === 4096`; giá trị không hằng (có ít nhất 20 giá trị khác nhau); `wrapS === THREE.RepeatWrapping`.
10. `vật liệu đúng cờ trong suốt`: `spiritMaterial()` → `transparent`, `depthWrite === false`, `side === THREE.DoubleSide`, có `userData.uniforms.uAlpha`; gọi `material.onBeforeCompile` với `shader = { uniforms: {}, vertexShader: THREE.ShaderLib.standard.vertexShader, fragmentShader: THREE.ShaderLib.standard.fragmentShader }` → chuỗi kết quả có `vLocalY` và `spiritCut`, `shader.uniforms.uRim` tồn tại. `flameShellMaterial({ side: THREE.BackSide })` → `blending === THREE.AdditiveBlending`, `side === THREE.BackSide`. `glowMaterial()` → `toneMapped === false`. `tick(m, 2)` đặt `uTime === 2` cho cả hai loại.
11. `placeholder vẽ được ba phần và trả covers`: `createFx3d(host, { parts: placeholderParts() })`, `update({ tier: 5, color: '#8fd3ff', fade: 1, demon: { n: 4, alpha: 0.5 } }, 0.016, {})` → `covers.demon/lotus/aura === true`, `covers.merit === false`; `update({ tier: 0, demon: null }, …)` → cả ba `false`. `dispose()` không ném.

## 7. Lệnh kiểm (Điều phối chạy)

```
npm run check
node --test test/world3d-fx.test.js
```

## 8. Bàn giao

Ghi ngắn vào cuối câu trả lời: file đã tạo, chỗ đặc tả chưa rõ, chỗ bạn đã chọn khác đặc tả và lý do. Không sửa `task.md`.
