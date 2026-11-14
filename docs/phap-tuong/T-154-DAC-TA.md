# Đặc tả T-154 · Nâng chất bản mẫu Pháp Tướng 3D

> Điều phối: Claude Opus 5.5. Nhánh `claude/T-154-nang-chat-ma-vuong`. Đọc trước: `AGENTS.md`, thẻ T-154 trong `task.md`, `docs/KE-HOACH-PHAP-TUONG-3D.md` §1–§2, `docs/phap-tuong/T-142-SOAT-HINH.md`, `tools/blender/fx/README.md`.
> Ba phần việc độc lập, mỗi phần một thợ: **A** dựng lại Ma Vương (Blender), **B** dựng lại đài sen (Blender), **C** shader và mã JS. Không thợ nào sửa file của phần khác.

## Vì sao làm lại

Bật `ta-fx3d` hiện **kém hơn** bản 2D (so `docs/phap-tuong/anh/game-ta-fx3d-bat.jpg` với `game-ta-fx3d-tat.jpg` và `public/img/fx/demon-4.webp`):
1. Ma Vương low-poly kiểu đồ chơi: thân thùng, đầu cầu, vân dung nham là vạch thẳng; trong game thành bóng đỏ trong suốt.
2. Vật liệu linh thể `DoubleSide` + `depthWrite:false` + `alpha = max(a, vGlow)`: nhìn xuyên như tia X, mắt và răng sáng xuyên qua đầu khi nhìn từ sau.
3. Vỏ khí là quả trứng thủy tinh bọc kín người, không ra lửa; thiếu `#include <colorspace_fragment>`.
4. Đài sen 3,83/5: cánh gãy góc, màu ngà nhạt thay vì vàng ấm như `public/img/fx/aura/lotus-gold.webp`.
5. Lỗi mã: Sân đấu không truyền khoảng cách/suất; thứ tự vẽ toàn cục 1..5 làm hiệu ứng người xa đè người gần; quỷ dùng `matrixWorld` khung trước; thiếu test "tải lỗi rồi tải lại".

## Hợp đồng `demon-4.glb` mới (A làm ra, C đọc vào)

| Mục | Yêu cầu |
|---|---|
| Xương | Giữ nguyên 17 xương, đúng tên, cha con như `tools/blender/fx/README.md` |
| Clip | Giữ nguyên 8 clip đúng tên và thời lượng: `emerge, idle, drift, scoff, peek, taunt1, taunt2, vanish` |
| Kích thước | Như cũ: gốc `root` ở gốc tọa độ, đỉnh sừng khoảng 1,8 m, đuôi khói xuống khoảng −1,15 m (trục lên của glTF là Y). Thân đặc ở trên y ≈ 0,1; dưới đó tan dần thành khói |
| Lưới `demon_body` | `SkinnedMesh`, thuộc tính `POSITION, NORMAL, TEXCOORD_0, JOINTS_0, WEIGHTS_0` (không cần `COLOR_0/1`). Vật liệu tên `demon_body` có `baseColorTexture` (màu đã nhân AO, sRGB), `normalTexture` (pháp tuyến không gian tiếp tuyến, quy ước OpenGL như glTF), `emissiveTexture` (mắt, lòng miệng, vết nứt dung nham; sRGB), `emissiveFactor = [1,1,1]` |
| Lưới `demon_flame` (nên có) | Dải lửa khói sau vai, gắn xương `chest` (skin hoặc con của xương). `TEXCOORD_0`: `v = 0` ở gốc lửa, `v = 1` ở ngọn; `u` chạy ngang dải 0 → 1. Vật liệu tên `demon_flame` (mã JS thay bằng shader lửa) |
| Ảnh bake | Mỗi ảnh ≤ 512 px, JPEG (pháp tuyến JPEG chất lượng cao hoặc PNG), nhúng trong `.glb` |
| Ngân sách | ≤ 4.000 tam giác tổng; `.glb` ≤ **600 KB** (nới từ 300 KB vì có ảnh bake; Điều phối ghi vào kế hoạch §2.4) |

Mã JS phải **vẫn chạy được với `.glb` cũ** (màu đỉnh, không ảnh) để test và phòng hờ.

---

## Phần A · Dựng lại Ma Vương theo lối điêu khắc (thợ: Claude Sonnet 5.5, Blender MCP)

**File được sửa:** `tools/blender/fx/build_demon.py`, `public/models/fx/demon-4.glb` (chỉ do kịch bản sinh), `tools/blender/fx/README.md` (mục Ma Vương), ảnh `docs/phap-tuong/anh/ban-mau-ma-vuong-4-goc.jpg`, `ban-mau-ma-vuong-tu-the.jpg`. **Cấm chạm:** mọi thứ khác (đặc biệt `public/js/**`, `build_lotus.py`, `build_aura.py`, `task.md`).

### Nhìn trước khi làm
- Ảnh gốc 2D: `public/img/fx/demon-4.webp`. Ảnh ý tưởng ba góc: `docs/phap-tuong/anh/y-tuong-quy-4.jpg`. Bản cũ (đừng lặp lại): `docs/phap-tuong/anh/ban-mau-ma-vuong-4-goc.jpg`.
- Đích: bóng dáng dữ, **sừng lớn cong xoắn** vút lên rồi cong vào, hàng sừng nhỏ/gai trên đỉnh đầu, **ba mắt** (mắt thứ ba dọc giữa trán), mày gồ nặng, tai nhọn, **hàm há có nanh** trên dưới, **vai giáp gai** chạm nổi, **ngực và tay cơ bắp có khối** (ngực, bụng, delta, bắp tay, cẳng tay), vòng giáp cổ tay, **hai bàn tay vuốt xòe** năm ngón móng đen dài, vảy/da sần, **vết nứt dung nham phát sáng** chạy ngoằn ngoèo (không phải vạch thẳng), **lửa khói sau vai**, nửa dưới tan thành đuôi khói xoắn.

### Dây chuyền (tất cả phải nằm trong kịch bản, chạy lại được bằng `H:\blender.exe -b`)
1. **Khối nền:** dựng các khối (ellipsoid, metaball, skin modifier, đường cong có bevel và taper cho sừng/nanh/móng) theo tỉ lệ ảnh gốc; giữ vị trí xương cũ làm khung (có thể dời nhẹ đầu xương cho khớp hình mới, giữ tên và cha con).
2. **"Điêu khắc" bằng mã:** gộp khối → voxel remesh mịn (vd. 0,01–0,015 m) → khối cơ thêm bằng các ellipsoid hòa (union rồi remesh lại) → làm mượt → displace bằng texture thủ tục (Voronoi cho vảy, nhiễu cho da sần, khe nứt theo cạnh Voronoi) có mặt nạ theo vùng. Bàn chải sculpt trong chế độ nền không tin cậy; dùng modifier là đủ.
3. **Lưới thấp:** từ lưới cao, decimate (hoặc dựng lưới thấp riêng rồi shrinkwrap) về ≤ ~3.600 tam giác cho thân, chừa ≤ ~400 cho `demon_flame`. Giữ bóng dáng: sừng, ngón, móng phải còn nhọn.
4. **UV + bake (Cycles, mẫu thấp cho nhanh):** smart UV project có lề; bake chọn-sang-hoạt-động từ lưới cao xuống lưới thấp: pháp tuyến 512, màu nền (đỏ thẫm `#5a1418` biến sắc theo khối, chỗ lõm tối hơn, sừng nâu đen có vòng, móng đen, nanh ngà, giáp đồng tối viền vàng sẫm) nhân AO, phát sáng (mắt `#ffc23a` rực, vết nứt `#ff7a1a`, lòng miệng cam đỏ). Lưu JPEG, nhúng vào `.glb`.
5. **Xương và trọng số:** giữ `make_rig`, `make_clips`, các hàm tư thế; trọng số tự động (`ARMATURE_AUTO`) hoặc hàm trọng số theo vùng có sẵn. Xem tư thế từng clip có rách lưới không.
6. **Xuất:** đúng hợp đồng ở trên; cập nhật `inspect_glb`/`check` để in thêm số ảnh, kích thước ảnh, số byte ảnh.
7. **Ảnh xem:** 4 góc (trước, xéo, ngang, sau) + bảng tư thế (idle, drift, scoff, taunt1) bằng vật liệu dùng chính ảnh bake (màu + pháp tuyến + phát sáng), nền tối; thêm một ảnh thu 128 px để tự kiểm "đọc ra hình ở cỡ nhỏ".

### Cách làm việc
- Dùng Blender MCP (`mcp__Blender__*`) để thử và **nhìn** nhanh: tạo **cảnh riêng** (vd. `T154_thu`), không đụng cảnh đang mở, không lưu `.blend`, xong thì xóa cảnh thử. Bước nào đạt thì chép vào kịch bản.
- Lặp **render → nhìn → so với `demon-4.webp` → sửa** ít nhất ba vòng. Tự hỏi thẳng: đặt cạnh ảnh 2D ở cỡ 128 px, có nhận ra cùng một con quỷ không?
- Chạy cuối bằng không giao diện:
  `H:\blender.exe -b --python-expr "import runpy; runpy.run_path(r'<repo>\tools\blender\fx\build_demon.py', init_globals={'REPO': r'<repo>', 'OUT': ['glb','views','check'], 'PREVIEW': False})"`
  (`<repo>` = thư mục worktree). Nếu đường dẫn tạm có dấu nháy đơn, truyền `TMP` là thư mục không có dấu nháy.
- Báo cáo: dòng `RESULT` của `check`, đường dẫn ảnh, thời gian chạy kịch bản, những gì còn kém so với ảnh 2D.

---

## Phần B · Dựng lại đài sen vàng (thợ: Claude Sonnet 5.5, chỉ chạy Blender không giao diện)

**File được sửa:** `tools/blender/fx/build_lotus.py`, `public/models/fx/lotus.glb` (do kịch bản sinh), ảnh `docs/phap-tuong/anh/ban-mau-dai-sen-4-goc.jpg`. **Cấm chạm** mọi thứ khác. **Không dùng Blender MCP** (thợ A đang dùng); chạy `H:\blender.exe -b` rồi Read ảnh để nhìn.

- Nhìn: `public/img/fx/aura/lotus-gold.webp` (đích), `docs/phap-tuong/anh/y-tuong-dai-sen.jpg`, bản cũ `ban-mau-dai-sen-4-goc.jpg`, phiếu chấm vòng cuối trong `T-142-SOAT-HINH.md` (mục "Nên sửa").
- Giữ hợp đồng: nút `petals0`, `petals1`, `petals2`, `pod`; vật liệu cánh tên `petal` (mã `lotus.mjs` dò theo tên này), màu ở `COLOR_0`; ≤ 900 tam giác, ≤ 60 KB.
- Cánh **cong mượt hình thìa**: viền cánh bo tròn, bụng phình ở khoảng 45% chiều dài, lòng cánh khum vào tâm, chóp hơi nhọn và hơi cong ra ngoài; tô bóng mượt (pháp tuyến mượt, không gãy mặt). Tầng trong dựng cao (65–72°), tầng giữa 45–52°, tầng ngoài xòe. Gương sen nhô cao thêm 0,04–0,05 m, có hạt. Đế thu gọn.
- **Màu vàng ấm kim loại** như ảnh 2D: gốc cánh vàng đậm hổ phách, giữa cánh vàng kim, mép và chóp sáng vàng nhạt gần trắng ấm (không phải màu ngà xám). Màu ở `COLOR_0` đã ở không gian tuyến tính đúng cách để trong three.js ra đúng sắc.
- Lặp render → nhìn → so ảnh 2D. Đích phiếu chấm ≥ 4/5, mục 2 (bám thiết kế) ≥ 4.
- Báo cáo: dòng `RESULT`, đường dẫn ảnh.

---

## Phần C · Shader và mã JS (thợ: gpt-6.1-sol qua Codex CLI)

Hộp cát không chạy được `node`; Điều phối tự chạy `npm run check` và test. Viết mã cẩn thận, tự đọc lại.

**File được sửa:** `public/js/world3d/fx3d/materials.mjs`, `demon.mjs`, `aura.mjs`, `lotus.mjs`, `index.mjs` (fx3d), `public/js/world3d/scenes/arena.mjs`, `test/world3d-fx.test.js`, và **chỉ dòng `?v=`** ở các file trong mục C8. **Cấm chạm:** `server.js`, `hall.js`, `public/js/world3d/avatar.mjs` ngoài dòng import `?v=`, mọi file 2D, `public/img/fx/**`, `tools/**`, `public/models/**`, `task.md`.

### C1 · `materials.mjs`: linh thể đặc, không nhìn xuyên
- `spiritMaterial(opts)` nhận thêm `map, normalMap, emissiveMap` (texture, tùy chọn). Có `map` thì dùng nhánh ảnh (define `SPIRIT_TEX`): `MeshStandardMaterial({ color:'#ffffff', map, normalMap, emissiveMap, emissive:'#ffffff', roughness:0.62, metalness:0.05 })`; không có thì giữ nhánh màu đỉnh cũ (`glowMask` → `color_1`).
- **Cả hai nhánh:** `side: THREE.FrontSide`, `transparent: true`, `depthWrite: false`, `depthFunc: THREE.LessEqualDepth`. Bỏ hẳn `DoubleSide`.
- Viền Fresnel chỉ ở mép: `fr = pow(1 - abs(dot(N, V)), 3.0)`, cộng `uRim * fr * 1.2` vào phát sáng.
- Độ đục (ở cuối shader, thay đoạn cũ):
  ```glsl
  float spiritN = texture2D(uNoise, vNoiseUv + vec2(0.0, -uTime * 0.35)).r;
  float spiritCut = smoothstep(uDissolve.x, uDissolve.y, vLocalY + (spiritN - 0.5) * 0.35);
  float body = uAlpha * spiritCut;                 // thân đặc theo độ rõ
  float rimA = fr * spiritCut * min(1.0, uAlpha * 2.0 + 0.25); // mép luôn hiện mờ
  float glowA = spiritGlow * spiritCut;             // mắt, nứt: luôn sáng
  gl_FragColor.a = clamp(max(body, max(rimA, glowA)), 0.0, 1.0);
  ```
  `spiritGlow` = độ sáng lớn nhất của ảnh phát sáng đã lấy mẫu (nhánh ảnh: `max(max(e.r, e.g), e.b)` của `emissiveMap` tại `vEmissiveMapUv`/`vUv` tùy bản three r187, xem `emissivemap_fragment`), nhánh màu đỉnh là `vGlow`. Khi `uAlpha` nhỏ (0,12), thân chỉ còn bóng mờ, viền mờ và mắt sáng.
- Thêm `spiritDepthMaterial({ dissolveY, threshold = 0.55 })`: `MeshBasicMaterial({ colorWrite: false, depthWrite: true, transparent: true, side: THREE.FrontSide })` + `onBeforeCompile` tính cùng `spiritCut` theo `vLocalY` (cùng nhiễu, cùng `uTime`, dùng chung bảng `uniforms` truyền vào hoặc tự có `uTime` để `tick` cập nhật) và `discard` khi `spiritCut < threshold`. `customProgramCacheKey` riêng. Đây là **lượt ghi chiều sâu trước**: nằm trong danh sách trong suốt (nên phải `transparent: true`) để vẽ sau mọi vật đục của cảnh, rồi lượt màu `LessEqual` chỉ vẽ mặt trước nhất. Kết quả: nhìn từ sau không thấy mắt/răng; ở độ rõ thấp vẫn không thấy ruột.
- `tick(material, time)` phải cập nhật `uTime` cho cả vật liệu chiều sâu.

### C2 · `materials.mjs`: vỏ khí ra lửa
Viết lại `flameShellMaterial({ color, height = 2.1, displace = true, opacity = 1, side, ribbon = false })`:
- Đỉnh: như cũ, nhưng ngọn lửa đẩy mạnh hơn ở phần trên: `p += normal * (n - 0.3) * 0.22 * smoothstep(0.4, 1.0, vH) * uDisplace; p.y += n * 0.45 * smoothstep(0.55, 1.0, vH) * uDisplace;` với `n` lấy nhiễu cuộn lên (`uv.y * 1.5 - uTime * 0.7`).
- Mảnh (gợi ý, Điều phối sẽ chỉnh số khi nhìn):
  ```glsl
  float fr = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 3.0);      // giữa thân ~0
  float n1 = texture2D(uNoise, vec2(vUv.x * 3.0, vUv.y * 1.2 - uTime * 0.9)).r;
  float n2 = texture2D(uNoise, vec2(vUv.x * 7.0 + 0.3, vUv.y * 2.4 - uTime * 1.6)).r;
  float n = n1 * 0.65 + n2 * 0.35;
  float tongue = smoothstep(0.0, 0.25, (1.0 - vH) * 0.9 + n * 0.55 - 0.45); // mép trên xé thành lưỡi lửa
  float streak = pow(texture2D(uNoise, vec2(vUv.x * 9.0, vUv.y * 0.35 - uTime * 0.8)).r, 4.0); // dải sáng chạy dọc
  float a = (fr * 1.15 + streak * 0.35 * (0.3 + fr)) * tongue * smoothstep(0.0, 0.1, vH) * uOpacity;
  vec3 col = mix(uColor, vec3(1.0, 0.97, 0.9), clamp(fr * fr * 0.6 + streak * 0.3, 0.0, 0.7));
  gl_FragColor = vec4(col * (0.9 + n * 0.5), a);
  #include <colorspace_fragment>
  ```
  Bắt buộc có `#include <colorspace_fragment>` cuối mảnh (C6). Vẫn `AdditiveBlending`, `depthWrite:false`, `transparent:true`, `toneMapped:false`.
- `ribbon: true` (cho `demon_flame`): `vH = uv.y` thay cho `position.y / uHeight`, bỏ Fresnel, thay bằng `edge = sin(3.14159 * uv.x)`; `a = edge * tongue * (0.35 + streak) * uOpacity`. Mặc định màu `#ff6a1a`, `side: DoubleSide` (riêng dải lửa phẳng thì được hai mặt).

### C3 · `demon.mjs`
- Khi duyệt lưới: lưới có `material.map` (glb mới) → `spiritMaterial({ map, normalMap, emissiveMap, rim:'#c2410c', alpha:1, dissolveY:[-0.75, 0.1] })` (lấy texture từ vật liệu gốc của glb; không `vertexColors`). Lưới không có `map` → nhánh cũ màu đỉnh. Lưới tên bắt đầu `demon_flame` (hoặc vật liệu tên `demon_flame`) → `flameShellMaterial({ ribbon:true, color:'#ff6a1a' })`, `renderOrder = RENDER.demonFlame`.
- Với **mỗi lưới thân** (không phải lửa): thêm bản sao ghi chiều sâu `pre = node.clone(false)`; `pre.material = depthMat` (một `spiritDepthMaterial` dùng chung, `env.track`), `pre.renderOrder = RENDER.demonDepth`, cùng cha với `node`. `SkinnedMesh.clone` giữ chung `skeleton` và `bindMatrix`. Gom danh sách lưới trước rồi mới thêm (không thêm con trong lúc `traverse`). Lưới thân `renderOrder = RENDER.demon`.
- Độ rõ: mọi vật liệu thân, chiều sâu, lửa nhận `alpha * near * vanishFade` (lửa nhân thêm 0,9). Vật liệu chiều sâu: khi độ rõ tổng < 0,05 thì ẩn bản sao (`pre.visible = false`) để quỷ tan hẳn không để lại "lỗ chiều sâu".
- **C7 lệch một khung:** trước `localToWorld`/`worldToLocal` gọi `env.host.group.updateWorldMatrix(true, false)`.
- **Phương án quỷ của chính mình:** `export const SELF_DEMON = { mode: 'side' };` (giá trị `'side'` | `'cover'`). Khi `ctx.isSelf && shown === 4`:
  - `'cover'`: như hiện nay (đứng chính giữa sau lưng, mờ sớm từ 2,5 m, tối thiểu 0,3).
  - `'side'`: dời điểm neo trong hệ tọa độ của chủ thêm `SELF_SIDE = { x: 0.75, y: 0.35, z: -0.25 }` (+x là bên **trái** của chủ khi chủ nhìn về +z; xoay theo `yaw` như neo cũ), không mờ sớm (dùng ngưỡng như người khác: từ 1,2 m, khoảng 0,8, tối thiểu 0,55).
  Trang thử và Điều phối đổi bằng `import('/js/world3d/fx3d/demon.mjs?v=N').then(m => m.SELF_DEMON.mode = 'cover')`.

### C4 · `index.mjs` (fx3d): thứ tự vẽ theo từng người
- `RENDER = { shellBack: 1, demonDepth: 2, demon: 3, demonFlame: 4, lotus: 5, shellFront: 6, particles: 7 }`.
- Trong `update`, tính `order = Number.isFinite(ctx.distance) ? -1 - Math.min(9998, Math.round(ctx.distance * 10)) : -9999` (xa hơn thì số âm hơn, vẽ trước). Gán `renderOrder = order` cho **mọi `Group`** trong `root` (kể cả `root`, các nhóm `env.group(...)` và cảnh glb nhân bản), vì three r187 lấy `groupOrder` từ `Group` gần nhất và sắp xếp theo nó trước `renderOrder`. Duyệt mỗi khung là được (ít nút), hoặc chỉ khi `order` đổi hoặc số con đổi.
- Âm để mọi hiệu ứng 3D vẽ trước bảng tên (bảng tên ở nhóm thường, `groupOrder = 0`).

### C5 · `aura.mjs`
- Dùng vỏ khí mới. Lớp trong: scale `(1.0, 1.0, 1.0)`; lớp ngoài: `(1.12, 1.4, 1.12)`, độ đục 0,5. Mặt sau (`BackSide`) độ đục nhân 0,45 để giữa thân không bị cộng sáng hai lần. Giữ hạt như cũ.

### C6 · `lotus.mjs`
- Vật liệu vàng ấm: `metalness: 0.45, roughness: 0.32, emissive: '#9a6414', emissiveIntensity` dao động 0,32–0,42 (giảm chuyển động: 0,38). Giữ `vertexColors`.

### C7 · `scenes/arena.mjs` (C3 trong thẻ)
- Trong `update`, với mỗi người chơi: `distance` = khoảng cách ngang từ `ctx.camera.position` tới vị trí thế giới của người đó (tính sau khi biết `wx, wz`; không có máy quay thì `Infinity`). Suất: nếu có `globalThis.StandMath`, dùng `StandMath.slots(list, state.me, quality, 'demon')` và `'aura'` như `public/js/world3d/index.mjs` dòng 31–38 (danh sách người có `demon`/`aura`). Truyền vào `entry.avatar.update({ ...player, isSelf, view, reducedMotion, quality, now: state.now, fx: { distance, slot } }, step)`. `state.now` không có thì bỏ qua (avatar tự lấy `Date.now()`).

### C8 · Tăng `?v=` (cùng một module dùng đúng **một** URL ở mọi nơi)
Kiểm bằng Grep sau khi sửa. Chuỗi phụ thuộc:
- `fx3d/materials.mjs` v1→v2 (nơi import: `fx3d/index.mjs`).
- `fx3d/index.mjs` v1→v2 (nơi import: `demon.mjs`, `lotus.mjs`, `aura.mjs`, `placeholder.mjs` nếu có, `avatar.mjs`, `public/world3d-fx.html`).
- `fx3d/demon.mjs`, `lotus.mjs`, `aura.mjs` v1→v2 (nơi import: `avatar.mjs`, và nơi khác nếu Grep thấy).
- `avatar.mjs` v4→v5 (nơi import: `avatar-glb.mjs`, `public/world3d-avatar.html`, `public/world3d-fx.html`, `public/world3d-scene-hall.html`, `-library.html`, `-yard.html`).
- `avatar-glb.mjs` v3→v4 (nơi import: `world3d/index.mjs`, `scenes/arena.mjs`, `scenes/yard.mjs`, `public/world3d-avatar.html`).
- `scenes/arena.mjs` v6→v7, `scenes/yard.mjs` v6→v7 (nơi import: `world3d/index.mjs`, `public/world3d-scene-arena.html`, `-yard.html`).
- `world3d/index.mjs` v9→v10 (nơi import: `public/js/view3d-ui.js`, `public/world3d-test.html`).
- `view3d-ui.js` v8→v9 trong `public/index.html`.

### C9 · Test (`test/world3d-fx.test.js`, tên test tiếng Việt)
Sửa các test cũ cho khớp thiết kế mới (không còn `DoubleSide` ở linh thể), thêm:
1. **Tải lỗi rồi tải lại không hỏng đếm tham chiếu:** `createAssets` với `loadGltf` lần 1 ném lỗi, lần sau trả cảnh thật. `demonPart` thứ nhất tải lỗi rồi `dispose` (không được gọi `release`); hai phần sau tải thành công cùng URL; `dispose` phần thứ hai thì tài nguyên chưa bị dọn và `assets.size() === 1`; `dispose` phần thứ ba thì geometry đã `dispose` và `size() === 0`.
2. **Thứ tự vẽ theo khoảng cách:** hai `createFx3d`, `distance` 3 và 12: mọi `Group` trong `root` của người xa có `renderOrder` nhỏ hơn người gần; đều âm.
3. **Không lệch khung:** đặt `host.group.position` mới, **không** gọi `updateMatrixWorld`, gọi `update` với `reducedMotion` (đặt ngay): vị trí thế giới của nhóm quỷ khớp neo tính từ vị trí mới (sai số < 1e-6).
4. **Lượt chiều sâu:** với glb giả có `SkinnedMesh` dùng vật liệu có `map`: sau khi nạp có thêm một bản sao chung `skeleton`, vật liệu `colorWrite === false`, `depthWrite === true`; vật liệu thân `side === FrontSide`, `depthWrite === false`; không còn vật liệu nào của quỷ là `DoubleSide` ngoại trừ dải lửa.
5. **Vỏ khí:** `flameShellMaterial().fragmentShader` chứa `colorspace_fragment`.
6. **Quỷ của mình đứng lệch:** `SELF_DEMON.mode = 'side'`, `isSelf: true`, yaw 0 → vị trí x của nhóm quỷ lớn hơn khi `'cover'` ít nhất 0,5 (nhớ trả lại mode cũ cuối test).

### Lệnh kiểm (Điều phối chạy)
```
npm run check
node --test test/stand-math.test.js test/world3d-fx.test.js test/world3d-avatar.test.js test/hall-view3d.test.js test/world3d-avatar-glb.test.js
npm test
```
