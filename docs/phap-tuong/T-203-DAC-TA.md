# Đặc tả T-203 · Vòng hình 2 Pháp Tướng 3D

> Điều phối: Claude Opus 5.5. Nhánh `claude/T-203-vong-hinh-phap-tuong`. Đọc trước: `AGENTS.md`, thẻ T-203 trong `task.md` (Grep `^### T-203`), `docs/KE-HOACH-PHAP-TUONG-3D.md` §1–§2, `docs/phap-tuong/T-154-DAC-TA.md` (hợp đồng `demon-4.glb`), `docs/phap-tuong/T-154-SOAT-HINH.md`, `tools/blender/fx/README.md`.
> Ba phần việc độc lập, mỗi phần một thợ, **không thợ nào sửa file của phần khác**: **A** Ma Vương (Blender), **B** đài sen + lưới vỏ khí (Blender), **C** JS/shader/test.
> Hộp cát của thợ không chạy được `node`, `blender`, `git`. Điều phối tự chạy Blender, `npm run check`, test, tự nhìn ảnh và commit. Thợ: viết mã cẩn thận, tự đọc lại ít nhất hai lượt, tính tay số tam giác.

## Vì sao làm lại (tóm tắt nghiệm thu T-154)

- Trong game bật `ta-fx3d` **kém hơn** bản 2D: ở góc nhìn thứ ba, quỷ của mình quay lưng về máy quay, bị cắt mép khung (`docs/phap-tuong/anh/game-ta-fx3d-bat.jpg` so với `game-ta-fx3d-tat.jpg`). Ảnh 2D luôn nhìn thẳng ra người xem, đứng sừng sững sau lưng chủ.
- Ma Vương 2,5/5: mặt gãy đa giác, tay và bàn tay nhỏ, đầu nhỏ so với vai, giáp vai không rõ khối, lửa sau vai là dải phẳng.
- Đài sen 2,5/5: cánh nhọn như vương miện gai, chỉ 3 hàng đỉnh theo chiều dài nên gãy khúc.
- Vỏ khí 2/5: vẫn là quả trứng, gần máy quay thì cháy trắng; hạt là ô vuông trắng.
- Nhãn tên bị thân quỷ cắt (lượt ghi chiều sâu che nhãn).

---

## Phần A · Ma Vương vòng 2 (`build_demon.py`)

**File được sửa:** `tools/blender/fx/build_demon.py`, mục Ma Vương trong `tools/blender/fx/README.md`. **Cấm chạm:** mọi file khác (`public/**`, `build_lotus.py`, `build_aura.py`, `task.md`, `docs/**` ngoài README trên). `public/models/fx/demon-4.glb` do Điều phối sinh bằng kịch bản.

**Giữ nguyên hợp đồng** (T-154-DAC-TA.md mục "Hợp đồng"): lưới `demon_body` + `demon_flame`, vật liệu cùng tên, 17 xương đúng tên và cha con, 8 clip đúng tên và thời lượng, gốc `root`, đỉnh sừng ~1,85 m, đuôi khói ~−1,12 m. **≤ 4.000 tam giác**, **`.glb` ≤ 600 KB**, mỗi ảnh ≤ 512 px.

### Ảnh để nhìn (đính kèm trong lượt của bạn)
- Đích: `public/img/fx/demon-4.webp` (ảnh 2D vẽ tay).
- Bản hiện tại: `ban-mau-ma-vuong-4-goc.jpg`, ảnh cận mặt `t154_close_front.png`, ảnh cận tay `t154_close_hands.png`, ảnh 128 px `ma-vuong-128px.jpg` (trái là 3D, phải là 2D).

### Việc phải làm (theo thứ tự ưu tiên)
1. **Tay và bàn tay to, cơ bắp như ảnh 2D.** Trong ảnh 2D, cẳng tay và bàn tay là khối lớn nhất sau thân: bàn tay xòe rộng gần bằng cái đầu, năm ngón dày, móng đen dài cong. Hiện bàn tay chỉ bằng nửa đầu, ngón mảnh như que.
   - Tăng bán kính đường tay `SPEC[4]['arm']['path']`: vai/delta ×1,25, bắp tay ×1,3, cẳng tay ×1,4 (cẳng tay to dần về cổ tay, như găng giáp). Thêm khối cơ cẳng tay và bắp tay rõ (ellipsoid hòa).
   - Bàn tay: lòng bàn tay ×1,5, ngón dày ×1,5 và dài ×1,3, móng dài ×1,3, giữ móng nhọn một đỉnh. Ngón cong như đang vồ.
   - Giữ vị trí xương; nếu cần dời đầu xương `hand_*` theo bàn tay to hơn thì dời nhẹ (≤ 6 cm) và cập nhật cả `SPEC` lẫn trọng số; tên, cha con không đổi.
2. **Đầu lớn hơn ×1,2** (hộp sọ, hàm, mày, tai, sừng nhỏ đi theo; sừng lớn giữ chiều cao đỉnh ~1,85 m). Cổ dày hơn để đầu không như đặt trên que.
3. **Mặt mịn khi nhìn gần:** hiện các mặt phẳng lớn ở mày, má, mũi lộ rõ (xem `t154_close_front.png`).
   - Tăng ngân sách tam giác cho đầu/mặt trước (`refine_head`, `DEC_HEAD`, mục tiêu thân), lấy bớt từ khói đuôi (`tail` 180 → ≤ 110), gai lưng (`spine` 108 → ≤ 70), sừng nhỏ, cuff. Mục tiêu: `front_head_tris` ≥ 900.
   - Xuất **`TANGENT`** (`export_tangents=True`) để three.js dùng tiếp tuyến MikkTSpace giống lúc bake, thay vì tự suy từ đạo hàm màn hình (nguồn gây vệt khối và đường gãy). Thêm `TANGENT` vào danh sách thuộc tính kiểm.
   - Bake pháp tuyến với lồng (cage) hoặc `cage_extrusion` đủ lớn và `max_ray_distance` hợp lý để không có ô sai; lan viền đảo UV ≥ 4 px.
   - **Ảnh pháp tuyến không ra vệt khối:** lưu PNG 8 bit (nếu tổng `.glb` vẫn ≤ 600 KB) hoặc JPEG chất lượng ≥ 97 không lấy mẫu màu thấp. Sửa `check` cho chấp nhận PNG ở ảnh pháp tuyến và in định dạng từng ảnh.
4. **Giáp vai rõ khối:** ba phiến chồng lớp to hơn ×1,3, gờ viền vàng sẫm dày, rãnh khắc sâu hơn, hai đến ba gai cong lớn. Ở ảnh 128 px phải đọc ra "vai giáp có gai" như ảnh 2D.
5. **Lửa sau vai có thể tích:** thay sáu dải phẳng (`ribbon`, `build_flame`) bằng **ống thuôn kín** (mặt cắt 6–8 cạnh, gốc tròn bán kính 5–8 cm, ngọn nhọn một đỉnh), 5–7 lưỡi mỗi bên, mọc từ sau bả vai, cong lên và ra ngoài, xoắn nhẹ, cao thấp khác nhau (cao nhất ngang đỉnh sừng). Lưới vẫn tên `demon_flame`, vật liệu `demon_flame`, gắn xương `chest`. UV: `u` chạy **quanh** ống 0 → 1, `v = 0` ở gốc, `v = 1` ở ngọn. ≤ 400 tam giác. (Mã JS sẽ tô lửa theo `dot(N, V)` nên ống kín nhìn hướng nào cũng ra khối lửa, nhìn từ sau không còn vệt dải trắng.)
6. **Màu da:** nghiêng về đỏ rượu ấm của ảnh 2D (đang hơi xám nâu): giảm bão hòa ít hơn (18% → 8%), vùng gờ cơ sáng đỏ cam hơn. Vết nứt giữ như cũ.

### Chạy và tự kiểm
- Không chạy được Blender trong hộp cát: viết xong, Điều phối chạy
  `blender -b --factory-startup --python-expr "import runpy; runpy.run_path(r'<repo>/tools/blender/fx/build_demon.py', init_globals={'REPO': r'<repo>', 'OUT': ['glb','views','check'], 'PREVIEW': True, 'TMP': r'C:/t203x/a1', 'CLOSE': True})"`
  rồi gửi bạn dòng `RESULT`, lỗi (nếu có) và ảnh. Đọc kỹ lỗi Python có thể gặp: tên hàm Blender 5.3 (`bpy.ops.export_scene.gltf` có `export_tangents`), numpy.
- Tính tay tổng tam giác trước khi nộp: liệt kê dự kiến từng phần.
- Báo cáo: đã sửa những gì (hàm nào), dự kiến tam giác từng phần, rủi ro.

---

## Phần B · Đài sen vòng 2 (`build_lotus.py`) và lưới vỏ khí hình ngọn lửa (`build_aura.py`)

**File được sửa:** `tools/blender/fx/build_lotus.py`, `tools/blender/fx/build_aura.py`, mục đài sen/vỏ khí trong `tools/blender/fx/README.md`. **Cấm chạm** mọi file khác.

### B1 · Đài sen
- **Giữ hợp đồng:** nút `petals0` (16 cánh ngoài), `petals1` (12 cánh giữa), `petals2` (8 cánh trong), `pod`; vật liệu cánh tên `petal`; màu ở `COLOR_0`; **≤ 1.200 tam giác tổng**, ≤ 60 KB. Mã game co giãn và xoay từng nút `petals*` quanh trục đứng (nở sen), nên gốc mỗi nút ở tâm.
- Đích: `public/img/fx/aura/lotus-gold.webp` (đính kèm). Hiện tại (`ban-mau-dai-sen-4-goc.jpg`): cánh nhọn gãy, đọc ra vương miện gai/hoa hướng dương.
- **Cánh tròn đầy, cong hai chiều:** viền cánh là đường cong trơn (dạng giọt nước/hình thìa bầu), **chóp bo tròn** với một mũi rất ngắn (không dùng `abs(across)` tạo góc nhọn). Bụng rộng nhất ở 50–55% chiều dài. Cong theo chiều dài (khum vào tâm, chóp hơi ngả vào ở tầng trong, ngả ra ở tầng ngoài) **và** theo chiều ngang (lòng máng sâu hơn: mép cuộn lên rõ).
- **Đủ đỉnh để cong mượt:** ít nhất 5 hàng theo chiều dài (hiện có 3) và 5 cột ngang. Ngân sách gợi ý: lưới cánh 5 hàng × 5 cột = 32 tam giác/cánh × 36 cánh = 1.152; `pod` ≤ 48 tam giác (đĩa gương đơn giản 12 cạnh + ít hạt chỉ bằng màu đỉnh, hoặc bỏ thành đế). Hoặc chia hàng/cột khác, miễn tổng ≤ 1.200. Pháp tuyến tính từ mặt cong giải tích như hiện nay (giữ).
- **Gân cánh:** gân giữa và hai gân phụ bằng màu đỉnh (cột giữa sáng hơn một chút, hai rãnh hai bên tối hơn) và gân giữa nhô 2–3 mm ở mặt ngoài.
- **Vàng ấm có ánh sáng:** gốc cánh vàng hổ phách `#c27a14`, thân cánh vàng kim `#f2b02e`, mép và chóp vàng sáng gần trắng ấm `#ffe7a0`. Tầng trong sáng hơn tầng ngoài. Không ra màu ngà xám, không cam đỏ.
- Tầng ngoài xòe thấp và rộng như ảnh 2D (đài sen thấp, rộng, nhiều lớp so le), tầng giữa 40–50°, tầng trong 60–70° nhưng không cao quá đầu gối người.
- Ảnh xem: giữ bốn ô (ba góc nghiêng + nhìn từ trên). Tự hỏi: đặt cạnh ảnh 2D, có đọc ra **hoa sen** không?

### B2 · Lưới vỏ khí hình ngọn lửa
- **Giữ hợp đồng:** một lưới tên `shell`, vật liệu `shell`, thuộc tính `POSITION, NORMAL, TEXCOORD_0`; trục đứng của glTF là Y (trong Blender là Z), đáy ở chân (z ≈ 0), cao ~2,05–2,2 m; `u` chạy quanh (0 → 1, có đường nối tách đỉnh như hiện nay), `v` theo chiều cao. ≤ 400 tam giác (ngân sách vỏ khí bản mẫu). Mã game dùng `position.y / 2.1` làm chiều cao chuẩn hóa và đẩy đỉnh theo nhiễu.
- Dáng: **đáy rộng ôm chân** (bán kính ~0,5 m ở z 0,1–0,3), **thắt dần** lên vai (~0,4 m ở z 1,3), rồi phần trên **xé thành 5–7 lưỡi lửa** nhọn, cao thấp so le (lưỡi cao nhất ~2,2 m, thấp nhất ~1,7 m), mỗi lưỡi hơi xoắn theo một chiều. Cách làm gợi ý: lưới vòng (16–20 cột quanh) như hiện nay, nhưng ở các hàng trên, bán kính và chiều cao của từng cột thay đổi theo góc: `h(θ) = h0 + A·max(0, cos(k·θ + xoắn·z))^p` để đỉnh tách thành k lưỡi; các cột giữa hai lưỡi hạ thấp và thu vào. Không có nắp đỉnh kín (miệng lửa hở cũng được, vật liệu cộng sáng).
- Ảnh xem: bốn góc như hiện nay. Vật liệu xem thử có thể là phát sáng trong suốt; chỉ cần đọc ra **dáng ngọn lửa** ôm người.

### Chạy (Điều phối chạy)
`blender -b --factory-startup --python-expr "import runpy; runpy.run_path(r'<repo>/tools/blender/fx/build_lotus.py', init_globals={'REPO': r'<repo>', 'OUT': ['glb','views','check'], 'PREVIEW': True, 'TMP': r'C:/t203x/b1'})"` (tương tự cho `build_aura.py`). Báo cáo: dự kiến tam giác từng nút, hàm đã sửa.

---

## Phần C · JS, shader, test

**File được sửa:** `public/js/stand-math.js`, `public/js/world3d/fx3d/{materials,demon,aura,lotus,index,placeholder}.mjs`, `public/js/world3d/index.mjs` (chỉ hàm `updatePeople`), `public/js/world3d/scenes/arena.mjs` (chỉ phần suất/khoảng cách trong `update`), `public/js/world3d/avatar.mjs` (**chỉ** phần nhãn tên và đúng một dòng ctx `slots` ở C6, cộng các dòng `import ?v=`), `test/stand-math.test.js`, `test/world3d-fx.test.js`, `test/world3d-scene-arena.test.js`, `test/world3d-avatar.test.js`, và **chỉ dòng `?v=`** trong các file ở C9.
**Cấm chạm:** `server.js`, `public/js/hall.js`, `lib/**`, mọi file 2D, `public/img/**`, `public/models/**`, `tools/**`, `task.md`, `docs/**`. Công tắc `ta-fx3d` vẫn mặc định tắt: khi tắt, game phải y như main (không đổi `depthTest` nhãn, không đổi gì khác).

### C1 · `stand-math.js`: quỷ của mình ngoái mặt về máy quay
Thêm (và xuất trong `api`):
```js
// Quỷ của chính mình ở góc nhìn thứ ba: đứng ở phía bên kia chủ so với máy quay (người xem thấy quỷ sừng sững sau vai chủ),
// lệch sang trái màn hình, thân xoay 3/4 về phía chủ, đầu ngoái về máy quay.
const SELF_STAND = Object.freeze({ back: 0.7, side: 0.55, y: 1.05, bodyTurn: 0.6, headMax: 1.0, minCamera: 0.6 });
function selfStand(camera, opts = SELF_STAND) {
  // camera: { x, z } vị trí máy quay trong hệ tọa độ của chủ (chủ ở gốc). Trả null nếu thiếu hoặc quá gần.
  // Trả { x, y, z, yaw, head }: vị trí quỷ (hệ của chủ), góc quay thân (rotation.y, mô hình nhìn về +Z),
  // head = góc đầu cần quay thêm so với thân để nhìn thẳng máy quay (đã kẹp trong ±headMax).
}
```
Toán (đã kiểm tay):
- `d = hypot(cx, cz)`; `d < minCamera` hoặc không hữu hạn → `null`. `ux = cx/d, uz = cz/d` (hướng từ chủ tới máy quay).
- Vectơ phải của máy quay (nhìn từ máy quay) `r = (uz, -ux)`. Trái màn hình là `-r`.
- Vị trí: `x = -ux*back - uz*side`, `z = -uz*back + ux*side`, `y = opts.y`.
- Thân: `toCam = atan2(ux, uz)`; quỷ đứng bên trái màn hình nên xoay ngực về phía phải màn hình (về phía chủ): `yaw = toCam + bodyTurn`.
- Đầu: `look = atan2(cx - x, cz - z)` (hướng từ quỷ tới máy quay); `head = clamp(wrap(look - yaw), -headMax, headMax)`, `wrap` về (−π, π].
Test bắt buộc (`test/stand-math.test.js`, tên tiếng Việt): máy quay sau lưng chủ (0, −5) → quỷ ở phía `z > 0` (bên kia chủ), lệch sang trái màn hình (`x > 0` khi máy quay ở −z, vì trái màn hình của máy quay nhìn về +z là +x); `yaw` hướng về máy quay ± bodyTurn; `yaw + head` trùng `look` sai số < 1e-9; xoay máy quay quanh chủ (8 góc) → khoảng cách ngang quỷ–chủ luôn bằng `hypot(back, side)` và quỷ luôn ở nửa xa máy quay; thiếu máy quay hoặc `d < 0,6` → `null`.

Thêm chia suất theo từng phần:
```js
function fxSlots(list, self, quality) {
  // list: [{ id, distance, demon: bool, aura: bool }]. Trả Map id → { demon, aura, slot }.
  // demon/aura: có trong suất tương ứng (slots(..., 'demon'/'aura') chỉ trên người có phần đó).
  // slot: true nếu demon || aura || (không có cả hai phần) — giữ ý nghĩa ctx.slot cũ.
}
```
Test: người có quỷ và hào quang, ngoài suất quỷ nhưng trong suất hào quang → `{ demon: false, aura: true, slot: true }`; người không có gì → `{ demon: false, aura: false, slot: true }`; mình luôn `demon: true` nếu mình có quỷ.

### C2 · `fx3d/index.mjs`: suất từng phần
- `update(state, dt, ctx)`: giữ nhánh `ctx.hidden || ctx.slot === false` ẩn hết. Thêm: nếu `ctx.slots` là object, phần `demon` cần `ctx.slots.demon !== false`; phần `lotus`, `aura`, `merit` cần `ctx.slots.aura !== false`. Phần bị chặn: gọi `instance.hide?.()`, `covers[name] = false`, **không** gọi `update` của phần đó.
- Không đổi `RENDER` và cách tính `order`.

### C3 · `fx3d/demon.mjs`
1. `SELF_DEMON = { mode: 'face' }` (giá trị `'face'` | `'side'` | `'cover'`; mặc định mới `'face'`). Giữ `'side'`, `'cover'` như cũ để so sánh.
2. **Biết vị trí máy quay** mà không đổi `avatar.mjs`: gắn `onBeforeRender = (renderer, scene, camera) => { camera.getWorldPosition(cameraWorld); cameraSeen = true; }` vào lưới thân đầu tiên (gắn **sau** khi tạo bản sao chiều sâu). `ctx.camera` (đối tượng `{x, y, z}` vị trí thế giới) nếu có thì ưu tiên (để test và trang thử).
3. Khi `ctx.isSelf && shown === 4 && SELF_DEMON.mode === 'face'` và có máy quay: `env.host.group.updateWorldMatrix(true, false)`; đổi vị trí máy quay sang hệ của chủ (`host.group.worldToLocal`), gọi `SM.selfStand({ x, z })`. Nếu trả về khác `null`: đích local = `(r.x, r.y - sitDrop, r.z)` (không xoay theo `yaw` của chủ), hướng thân đích = `r.yaw`, góc đầu đích = `r.head`. Nếu `null` (chưa thấy máy quay): dùng cách đặt cũ.
4. Hướng thân: `facing = SM.turn(facing ?? goal, goal, dt, 0.25)` (giảm chuyển động: đặt thẳng). Góc đầu làm mượt tương tự (`headYaw`).
5. **Quay đầu bằng xương** sau `mixer.update`: lấy xương `neck` và `head` (tìm theo tên một lần sau khi nạp, `model.getObjectByName`). Chia góc: cổ 40%, đầu 60%. Xoay quanh trục đứng **của mô hình** đổi sang hệ cha của xương:
   ```js
   holder.updateMatrixWorld(true);
   for (const [bone, part] of [[neckBone, 0.4], [headBone, 0.6]]) {
     if (!bone) continue;
     bone.parent.getWorldQuaternion(parentQ);
     holder.getWorldQuaternion(holderQ);
     axis.set(0, 1, 0).applyQuaternion(holderQ).applyQuaternion(parentQ.invert()).normalize();
     turnQ.setFromAxisAngle(axis, headYaw * part);
     bone.quaternion.premultiply(turnQ);
     bone.updateMatrixWorld(true);
   }
   ```
   Chỉ làm khi `headYaw !== 0` và không phải quỷ của người khác (người khác: 0). Clip phát lại mỗi khung nên xoay không cộng dồn.
6. Độ rõ khi `'face'`: không mờ theo khoảng cách như `'side'` (ngưỡng từ 1,2 m, khoảng 0,8, tối thiểu 0,55). Mặc định (`'face'`) quỷ của mình hơi to hơn: `holder.scale.setScalar(SELF_SCALE)` với `const SELF_SCALE = 1.1` chỉ khi đang ở chế độ `'face'`, còn lại `1`.
7. **Lượt ghi chiều sâu theo độ mờ:** `const DEPTH_MIN_ALPHA = 0.6;` `pre.visible = node.visible && opacity >= DEPTH_MIN_ALPHA`. Quỷ mờ (0,1–0,55) không ghi chiều sâu nên không che nhãn tên và ảnh 2D phía sau.
8. Lửa: `flameShellMaterial({ ribbon: true, color: '#ff6a1a', side: THREE.FrontSide })` (lưới mới là ống kín). Không còn vật liệu `DoubleSide` nào trong quỷ.
9. Đổi URL mô hình kèm số phiên bản để tránh bộ đệm 10 phút: `DEMON_URL = { 4: '/models/fx/demon-4.glb?v=2' }`.

### C4 · `fx3d/materials.mjs`
1. `spiritDepthMaterial`: dùng `uAlpha` thật: thêm `uniform float uAlpha; uniform float uMinAlpha;` (giá trị mặc định `uMinAlpha = 0.6`) và `if (spiritCut < uThreshold || uAlpha < uMinAlpha) discard;`.
2. **Ảnh đốm tròn mềm** sinh bằng mã, dùng chung (giống `noiseTexture`):
   ```js
   export function dotTexture() // DataTexture 32×32 RGBA, rgb = 255, a = round(255 * (1 - smoothstep(0, 1, r))^1.5)
   // r = khoảng cách tới tâm (15.5, 15.5) chia 15.5; LinearFilter, không mipmap, needsUpdate = true.
   export function sparkMaterial(color) // PointsMaterial({ color, map: dotTexture(), size: 0.09, sizeAttenuation: true,
   //   transparent: true, depthWrite: false, blending: AdditiveBlending, toneMapped: false, alphaTest: 0.01 })
   ```
3. `flameShellMaterial`:
   - Không cháy trắng khi gần: `toneMapped: true` và thêm `#include <tonemapping_fragment>` **trước** `#include <colorspace_fragment>`. Đỉnh: thêm `varying float vDist; vDist = -mv.z;`. Mảnh vỏ khí (không phải lửa quỷ): `a *= smoothstep(0.9, 2.6, vDist);` và hệ số màu `col * 2.4` → `col * 1.6`; kẹp `a` tối đa 0,85.
   - Nhánh `FLAME_RIBBON`: thay `edge = sin(3.14159 * vUv.x)` bằng `edge = pow(abs(dot(normalize(vN), normalize(vV))), 1.3)` (ống kín: giữa đặc, mép mềm); bỏ pha trắng: `mix(uColor, vec3(1.0, 0.85, 0.55), clamp(streak * 0.35, 0.0, 0.45))`. Ngọn (`vH > 0.7`) ngả đỏ thẫm: `col = mix(col, uColor * vec3(0.8, 0.35, 0.2), smoothstep(0.7, 1.0, vH))`.
   - `side` mặc định cho `ribbon` đổi thành `FrontSide`.

### C5 · `fx3d/aura.mjs`, `fx3d/lotus.mjs`, `fx3d/placeholder.mjs`
- Hạt dùng `env.materials.sparkMaterial(color)` thay `new THREE.PointsMaterial(...)` (cả `placeholder.mjs` nếu có hạt).
- `AURA_KIT_URL = '/models/fx/aura-kit.glb?v=2'`, `LOTUS_URL = '/models/fx/lotus.glb?v=2'`.
- Lớp vỏ: giữ ba lớp ở mức Cao, hai ở Vừa, một ở Thấp (Điều phối sửa bảng §2.4 cho khớp).
- `lotus.mjs`: vật liệu cánh thêm `emissive` vàng ấm hơn `#b07818`, `emissiveIntensity` 0,42–0,5 (giảm chuyển động 0,46), `roughness: 0.3`.

### C6 · Nhãn tên và bong bóng (`avatar.mjs`, chỉ phần này)
- Khi có `fx` **và** `covers.demon || covers.aura || covers.lotus`: `nameplate.sprite.material.depthTest = false` và `bubble.sprite.material.depthTest = false`; ngược lại `true`. Đặt sau khi có `covers` trong `update`. Thứ tự vẽ đã đúng (nhóm hiệu ứng có `groupOrder` âm, nhãn `renderOrder = 6` trong nhóm thường) nên nhãn vẽ sau cùng, không bị thân quỷ cắt, không bị lửa đè.
- Truyền suất từng phần: trong lời gọi `fx.update(..., { distance, isSelf, slot, hidden })` thêm đúng một khóa `slots: state.fx?.slots`.
- Công tắc tắt (`fx === null`): không đổi gì.

### C7 · Chia suất chặt ở `world3d/index.mjs` (`updatePeople`) và `scenes/arena.mjs`
- Dùng `SM.fxSlots(list.map(p => ({ id: p.id, distance, demon: !!p.demon, aura: !!p.aura })), state.me, quality)`; truyền `fx: { distance, slot: s.slot, slots: { demon: s.demon, aura: s.aura } }`. Không có `StandMath` → `slot: true`, không `slots`.
- `arena.mjs`: ghi thêm `entry.avatar.group.userData.fx = fx` (đối tượng vừa truyền) để test và gỡ lỗi đọc được.
- Test Sân đấu (`test/world3d-scene-arena.test.js`): đặt `globalThis.StandMath = require('../public/js/stand-math.js')` (dọn lại cuối test), `ctx.camera = new THREE.PerspectiveCamera()` đặt ở một điểm; `quality: 'low'`; năm người chơi cùng có `demon` và `aura` ở khoảng cách khác nhau + mình. Kiểm: `userData.fx.distance` đúng khoảng cách ngang tới máy quay (sai số 1e-6); mình và 2 người gần nhất có `slots.demon === true`; người thứ ba có `slots.demon === false`; không có máy quay thì `distance === Infinity`.

### C8 · Test `test/world3d-fx.test.js` (tên tiếng Việt)
Sửa test cũ cho khớp (ví dụ lửa nay `FrontSide`, chế độ mặc định `'face'`), thêm:
1. **Quỷ của mình ngoái mặt:** `SELF_DEMON.mode = 'face'`, `isSelf: true`, `ctx.camera = { x: 0, y: 3.45, z: -5.4 }`, chủ ở gốc, yaw 0, giảm chuyển động: nhóm quỷ ở `z > 0.3`, `x > 0.3`; `rotation.y` ≈ `selfStand(...).yaw` (sai số 1e-6); với lưới giả có xương tên `neck`, `head` thì sau `update` quaternion của `head` khác quaternion lúc không có máy quay. Không có máy quay → vị trí như cách cũ. Người khác (`isSelf: false`) có máy quay vẫn đứng theo neo cũ, `rotation.y = yaw`. Nhớ trả `SELF_DEMON.mode` về giá trị cũ.
2. **Bắt máy quay qua onBeforeRender:** gọi `onBeforeRender(null, null, camera)` của lưới thân với một `PerspectiveCamera` đặt sẵn vị trí, rồi `update` không có `ctx.camera` → quỷ đặt theo máy quay đó.
3. **Suất từng phần:** `ctx.slots = { demon: false, aura: true }` với `{ tier: 5, demon: { n: 4 } }` sau khi nạp → `covers.demon === false`, nhóm `fx3d-demon` ẩn, `covers.aura === true`. Ngược lại `{ demon: true, aura: false }` → `covers.aura === false`, `covers.lotus === false`.
4. **Chiều sâu theo độ mờ:** độ rõ 0,55 → `pre.visible === false`; 0,7 → `true`. `spiritDepthMaterial().onBeforeCompile` sinh mảnh chứa `uAlpha < uMinAlpha`.
5. **Hạt tròn mềm:** `dotTexture()` dùng chung, 32×32, tâm alpha 255, góc alpha 0; hạt của aura/lotus ở mức Cao có `material.map === dotTexture()`.
6. **Vỏ khí không cháy trắng:** `flameShellMaterial().toneMapped === true`, mảnh chứa `tonemapping_fragment` trước `colorspace_fragment`, chứa `vDist`.
7. URL mô hình có `?v=2`.

`test/world3d-avatar.test.js`: thêm ca "fx phủ quỷ thì nhãn tên và bong bóng `depthTest === false`; fx trả covers toàn false thì `true`; không có fx thì `true`" (dùng `opts.fx3d` là đối tượng giả `{ update: () => covers, setQuality(){}, setReducedMotion(){}, dispose(){} }`).

### C9 · Tăng `?v=` (mỗi module đúng **một** URL ở mọi nơi, kể cả test)
| Module | Cũ → mới | Nơi import |
|---|---|---|
| `stand-math.js` | v1 → v2 | `public/index.html`, `public/world3d-fx.html` |
| `fx3d/materials.mjs` | v3 → v4 | `fx3d/index.mjs`, test |
| `fx3d/index.mjs` | v3 → v4 | `demon.mjs`, `lotus.mjs`, `aura.mjs`, `placeholder.mjs`, `avatar.mjs`, `world3d-fx.html`, test |
| `fx3d/demon.mjs` | v3 → v4 | `avatar.mjs`, test |
| `fx3d/lotus.mjs` | v2 → v3 | `avatar.mjs`, test |
| `fx3d/aura.mjs` | v3 → v4 | `avatar.mjs`, test |
| `fx3d/placeholder.mjs` | v1 → v2 | `world3d-fx.html`, test (test hiện import không có `?v=`: thêm `?v=2`) |
| `avatar.mjs` | v6 → v7 | `avatar-glb.mjs`, `world3d-avatar.html`, `world3d-fx.html`, `world3d-scene-hall.html`, `-library.html`, `-yard.html` |
| `avatar-glb.mjs` | v5 → v6 | `world3d/index.mjs`, `scenes/arena.mjs`, `scenes/yard.mjs`, `world3d-avatar.html` |
| `scenes/arena.mjs` | v8 → v9 | `world3d/index.mjs`, `world3d-scene-arena.html` |
| `scenes/yard.mjs` | v8 → v9 | `world3d/index.mjs`, `world3d-scene-yard.html` |
| `world3d/index.mjs` | v11 → v12 | `public/js/view3d-ui.js`, `public/world3d-test.html` |
| `view3d-ui.js` | v10 → v11 | `public/index.html` |
Grep lại sau khi sửa: `grep -rn "fx3d/\|stand-math.js?v\|avatar.mjs?v\|avatar-glb.mjs?v\|arena.mjs?v\|yard.mjs?v\|world3d/index.mjs?v\|view3d-ui.js?v" public test`.

### Lệnh kiểm (Điều phối chạy)
```
npm run check
node --test test/stand-math.test.js test/world3d-fx.test.js test/world3d-avatar.test.js test/hall-view3d.test.js test/world3d-avatar-glb.test.js test/world3d-scene-arena.test.js
npm test
```

---

## Điều phối chỉnh sau khi xem trong trình duyệt (khác đặc tả ở trên)

- `SELF_STAND` = `{ back: 1.2, side: 0.35, y: 0.8, bodyTurn: 0.6, headMax: 1.0, minCamera: 0.6, scale: 1.1, scaleNear: 0.45, fitNear: 1.0, fitFar: 3.1, lift: 1.3, sink: 0.25 }`. Máy quay mặc định trong phòng bị tường ép lại gần (Tàng Kinh Các ~3,1 m, Sân đấu có lúc ~1 m), nên `selfStand` trả thêm `scale`: từ 1,1 (máy quay ≥ 3,1 m) giảm dần tới 0,45 (≤ 1 m) và nâng điểm đặt để mặt quỷ vẫn ở trên đầu chủ. `demon.mjs` làm mượt `scale` (0,3 giây) thay cho hằng `SELF_SCALE`.
- Vỏ khí và lửa quỷ dùng **trộn thường** (`NormalBlending`) thay cho cộng sáng: cộng sáng trên nền sáng (sàn gỗ, sân đá) ngả trắng. Vỏ khí: chỉ mờ ở ngọn (`top` 0,72–0,98), tránh vùng đài sen (`smoothstep(0.04, 0.24, vH)`), màu `uColor²` → `uColor` pha 25% trắng, hệ số 1,25, độ đục tối đa 0,8. Lửa quỷ: độ đục tối đa 0,9, pha cam vàng `(1, 0.62, 0.18)` ở gốc.
- Linh thể tự sáng nhẹ: `totalEmissiveRadiance += diffuseColor.rgb * 0.18` để ban đêm quỷ không chìm đen.
- Kiểm 4:4:4 của JPEG pháp tuyến trong `build_demon.py` hạ thành cảnh báo: Blender 5.3 luôn ghi 4:2:0.
