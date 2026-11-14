# Đặc tả T-204 · Vòng hình 3 Pháp Tướng 3D

> Điều phối: Claude Opus 5.5. Nhánh `claude/T-204-vong-hinh-3-noi-ngan-sach`. Đọc trước: `AGENTS.md`, thẻ T-204 trong `task.md` (Grep `^### T-204`), `docs/phap-tuong/T-203-DAC-TA.md` (hợp đồng và các chỉnh sau trình duyệt), `docs/phap-tuong/T-203-SOAT-HINH.md` (nghiệm thu), `tools/blender/fx/README.md`.
> Ba phần việc độc lập, mỗi phần một thợ, **không thợ nào sửa file của phần khác**: **A** Ma Vương (Blender), **B** lửa hộ thân + đài sen (Blender), **C** JS/shader/test. **Không thợ nào sửa `tools/blender/fx/README.md`, `task.md`, `docs/**`** (Điều phối tự cập nhật từ báo cáo của bạn).
> Hộp cát của thợ không chạy được `node`, `blender`, `git`. Điều phối tự chạy Blender, `npm run check`, test, tự nhìn ảnh và commit. Thợ: viết mã cẩn thận, tự đọc lại ít nhất hai lượt, tính tay số tam giác.

## Vì sao làm lại (nghiệm thu T-203)

- Trong game bật `ta-fx3d` **kém hơn** bản 2D (`docs/phap-tuong/anh/game-ta-fx3d-bat.jpg` so `game-ta-fx3d-tat.jpg`): vỏ khí xanh trùm cao quá đầu, che mặt quỷ và đầu nhân vật, trông như lọ kính chứ không ra lửa. Ở Sân đấu (`game-san-dau.jpg`) máy quay sát người, quỷ bị cắt mép trên và bảng "Sân đang vắng" che mặt.
- Ma Vương 2,5/5: mặt gãy khối, mày là hai ống tròn; bàn tay đọc ra **nắm đấm có gai** vì ngón chĩa về trước rồi cong ngược lên trời (nhìn từ trước bị rút ngắn, chỉ thấy móng như gai); lửa vai là thanh gấp khúc cứng; tổng thể tối, trong game đọc ra một khối đỏ.
- Chủ dự án duyệt **nới ngân sách Ma Vương: ≤ 6.000 tam giác, ảnh bake 1024 px, `.glb` ≤ 1,5 MB**. Đài sen ≤ 1.200 tam giác, bộ hào quang ≤ 1.500 tam giác giữ nguyên.

---

## Phần A · Ma Vương vòng 3 (`build_demon.py`)

**File được sửa:** chỉ `tools/blender/fx/build_demon.py`. **Cấm chạm** mọi file khác. `public/models/fx/demon-4.glb` do Điều phối sinh bằng kịch bản.

**Giữ nguyên hợp đồng** với mã trình duyệt: lưới `demon_body` (`POSITION, NORMAL, TANGENT, TEXCOORD_0, JOINTS_0, WEIGHTS_0`) và `demon_flame`, vật liệu cùng tên, **17 xương đúng tên và cha con** (`root, spine, chest, neck, head, jaw, shoulder_L/R, upper_arm_L/R, forearm_L/R, hand_L/R, tail1..3`), vị trí xương giữ nguyên (riêng đầu xương `hand_*` được dời ≤ 6 cm nếu cần), **8 clip đúng tên và thời lượng**, gốc `root`, đỉnh sừng ~1,85 m, đuôi khói ~−1,12 m. Lửa vai vẫn gắn xương `chest`, UV `u` quanh ống 0 → 1, glTF `v` = 0 ở gốc và 1 ở ngọn (mã game dùng `uv.y` làm chiều cao lửa).

### Ảnh để nhìn (đính kèm trong lượt của bạn)
- Đích: `public/img/fx/demon-4.webp` (ảnh 2D vẽ tay).
- Bản hiện tại: `ban-mau-ma-vuong-4-goc.jpg`, cận mặt `t154_close_front.png`, cận tay `t154_close_hands.png`.

### Ngân sách mới (sửa trong `SPEC[4]` và mọi chỗ còn ghi cứng)
- `'tri_limit': 6000`, `'kb_limit': 1536`, `'img': 1024`. Tìm và đổi **mọi** số cứng: `4000`, `3860`, `360`, `600 KB`, `598`, `512` (kích thước ảnh, ảnh pháp tuyến "phải giữ 512×512", lời nhắn "tam giác GLB vượt 4.000", "GLB vượt 600 KB", "Lưới thấp vượt 4.000", `len(T) > 3860`, `len(ft) > 360`) thành biểu thức theo `S[...]`. Grep `4000\|3860\|360\|512\|600\|598` trong file để không sót.
- Phân bổ gợi ý (tổng ≤ 6.000): thân hợp sau decimate ~2.600 (`'body_tris': 2600`), dành mặt `head_refine` ~1.000 (mục tiêu **`front_head_tris` ≥ 1.600**, sửa ngưỡng 900 trong `build_low` và lời nhắn), ngón + móng ~1.000 (hiện ~600), lửa vai ≤ 640, phần phụ còn lại giữ như cũ (~1.000). `demon_body` ≤ `tri_limit − flame`. Ghi phân bổ thật vào `RESULT`.
- Ảnh bake 1024×1024: mọi chỗ tạo ảnh/raster/bake dùng `S['img']`; lan viền (dilate) và khoảng cách đảo UV quy đổi theo điểm ảnh (giữ ~8 px: khoảng cách đảo 0,016 ở 512 → 0,008 ở 1024; `margin` bake theo px tương ứng). JPEG: màu/phát sáng chất lượng 90, pháp tuyến 97; vòng giảm chất lượng khi vượt trần giữ như cũ nhưng trần là `(S['kb_limit'] − 2) × 1024`.

### Việc phải làm (theo thứ tự ưu tiên)
1. **Bàn tay xòe đủ năm ngón, đọc được từ trước** (lỗi nặng nhất). Viết lại `make_fingers` (và lòng bàn tay nếu cần):
   - Lòng bàn tay là khối dẹt **mặt lòng hướng về trước (−Y, về người xem)**, rộng ~0,20 m, cao ~0,20 m, dày ~0,07 m, tâm gần `HAND_P` (có thể nâng tâm 2–4 cm). Mu bàn tay có gờ xương.
   - Năm ngón **tỏa hình quạt trong mặt phẳng gần X–Z** (mặt phẳng nhìn thấy từ trước), không chĩa về −Y: ngón cái chĩa vào trong và hơi xuống (về phía thân, góc ~−60° so với trục đứng, phía thân), trỏ ~−22°, giữa ~0° (chĩa lên +Z), nhẫn ~+22°, út ~+45° (ra ngoài). Góc xòe tính trong hệ (lên = +Z, ra ngoài = `HAND_L` cho tay trái, đối xứng qua `both`). Ngón dài 0,15–0,19 m (cái 0,12 m), 3 đốt, gốc dày bán kính ~0,034 m thon về 0,024 m, đốt cong dần **về trước (−Y)** tổng ~45–60° như đang vồ, khớp đốt có gờ.
   - Móng đen dài 0,09–0,11 m nối đầu ngón, tiếp tục cong về trước rồi hơi xuống (móc vuốt), gốc bằng đầu ngón, chóp nhọn một đỉnh.
   - Lưới thấp (`hi=False`): ngón `seg=6`, `rings=5`; móng `seg=5`, `rings=4` (chóp một đỉnh). Tính tay: mỗi ngón ≈ 6×5×2 + nắp, mỗi móng ≈ 5×4×2 − đỉnh; ×10. Báo tổng.
   - Trọng số: toàn bàn tay, ngón, móng theo xương `hand_*` như hiện nay (`bone='hand'`).
   - Tự hỏi: nhìn ảnh 4 góc ô "trước", hai bàn tay có giống bàn tay xòe trong ảnh 2D (năm ngón rõ, móng đen cong) không?
2. **Mặt mịn, có hồn như ảnh 2D** (dùng ngân sách mới):
   - Mày: thay hai ống tròn bằng gờ mày **liền với trán** (khối ellipsoid hòa vào sọ, xếp thành chữ V giận dữ, mép dưới sắc, mặt trên dốc vào trán) để không còn hai "xúc xích" đặt lên mặt. Thêm nếp nhăn giữa mày (2–3 rãnh dọc) và nếp mũi (khắc bằng `crease_field`).
   - Má gồ, mũi bè có lỗ mũi, gò má nối liền xuống mõm; hốc mắt sâu, mắt hạnh nhân xếch phát sáng; mắt thứ ba giữa trán.
   - Lưới thấp: tăng `head_refine`, `DEC_HEAD`, `body_tris` để `front_head_tris` ≥ 1.600; chạy `refine_head` hai lượt (lượt hai chia các tam giác mặt còn lớn nhất) rồi `smooth_low_head` (có thể tăng lên 6 lượt Taubin, dịch tối đa 15 mm, vẫn chiếu về lưới cao).
   - Pháp tuyến mượt: giữ `normals_split_custom_set_from_vertices` theo diện tích, xuất `TANGENT`; bake pháp tuyến 1024 từ lưới cao.
3. **Lửa sau vai thành khối lửa mềm** (thay 8 ống gấp khúc trong `build_flame`):
   - Mỗi bên **3 lưỡi lửa béo** mọc chung một gốc sau bả vai (gốc gần `(±0.45..0.70, 0.40..0.46, 0.85..1.0)`), gốc bán kính 0,13–0,16 m, **phình** ở 25–35% chiều dài (bán kính lớn nhất, không thắt eo), rồi thon đều tới ngọn nhọn; trục cong **một nhịp mềm** (chữ C/S rất nhẹ, không gấp khúc), ngả ra ngoài và ra sau, ngọn hơi móc vào trong. Cao: lưỡi giữa ngọn ~1,80 m, lưỡi trong ~1,55 m, lưỡi ngoài ~1,35 m. Ba lưỡi chồng một phần lên nhau để đọc ra một **đám lửa**, không phải ba que.
   - Ống 8 cạnh, 8 vòng + chóp: `8×8×2 − 8 ≈ 120` tam giác/lưỡi → 6 lưỡi ≈ 720: **vượt**; dùng 8 cạnh × 6 vòng + chóp (~ 88/lưỡi) hoặc 7 cạnh × 7 vòng; tổng `demon_flame` **≤ 640**. Vòng dày ở gốc và ngọn (phân bố vòng theo `t^0.8`). Bán kính theo hàm trơn, ví dụ `r(t) = r0 * (1 + 0.35 * sin(pi * min(1, t / 0.6))) * (1 - t) ** 0.75` (chóp 0).
   - Giữ UV (u quanh, v dọc), pháp tuyến mượt, `pointed=True`, gắn `chest`.
4. **Màu sáng, tương phản hơn** (trong game đang đọc ra khối đỏ tối):
   - Da nền sáng hơn và ấm hơn: `skin` `#922326` → khoảng `#b0302c`, gờ cơ/đỉnh khối pha đỏ cam sáng (`#d0503a`), hốc/rãnh tối `#4a0f10` để khối cơ nổi. Bớt nhân AO nặng (AO tối thiểu 0,55 thay vì tối đen).
   - Ảnh phát sáng rõ hơn: ba mắt vàng cam rực (`#ffd04a`, lõi gần trắng ấm), **lòng miệng/họng phát sáng cam đỏ** (`#ff5a1a`, mạnh hơn hiện nay), **vân dung nham nhiều và dài hơn** trên ngực, bụng, vai, cẳng tay, mu bàn tay, và vài vệt trên má/trán như ảnh 2D; nứt `#ff7a1a` lõi `#ffb040`.
   - Sừng: nâu đen có vân vòng, ngọn sáng hơn một chút (`#5a3a28`) để tách khỏi nền tối.
5. Không đổi xương, clip, tư thế clip (trừ khi bàn tay mới cần chỉnh `hand_flex` cho khỏi xuyên). Nếu dời đầu xương `hand_*` thì cập nhật `SPEC`, trọng số và `make_rig`.

### Chạy và tự kiểm
- Điều phối chạy (khoảng 2–4 phút):
  `blender -b --factory-startup --python-expr "import runpy; runpy.run_path(r'<repo>/tools/blender/fx/build_demon.py', init_globals={'REPO': r'<repo>', 'OUT': ['glb','views','check'], 'PREVIEW': True, 'TMP': r'C:/t204x/a1', 'CLOSE': True})"`
  rồi gửi bạn dòng `RESULT`, lỗi (nếu có) và ảnh.
- Báo cáo: hàm nào đã sửa, dự kiến tam giác từng phần (bảng), rủi ro (Blender 5.3 API, numpy).

---

## Phần B · Lửa hộ thân (`build_aura.py`) và đài sen nhìn ngang (`build_lotus.py`)

**File được sửa:** chỉ `tools/blender/fx/build_aura.py`, `tools/blender/fx/build_lotus.py`. **Cấm chạm** mọi file khác.

### B1 · Lửa hộ thân thay vỏ khí (`build_aura.py`)
Bỏ lưới vỏ kín `shell`. Dựng lưới mới:
- **Tên nút và vật liệu: `flames`** (mã game C sẽ tìm `flames`). Thuộc tính `POSITION, NORMAL, TEXCOORD_0`. Glb trục đứng Y (Blender Z), gốc ở giữa hai bàn chân, `z = 0` là mặt đất.
- **9 lưỡi lửa** (ống kín thuôn, 6 cạnh) xếp vòng quanh chân, gốc ở bán kính 0,30–0,40 m (so le), gốc cao `z` 0,02–0,08 m, góc đều 40° cộng lệch ±8° (hạt giống cố định).
- Mỗi lưỡi: gốc bán kính 0,07–0,10 m, **phình** nhẹ ở 20–30% chiều dài, thon tới chóp nhọn một đỉnh; trục cong mềm: đi lên, **ôm vào trong** về phía thân (bán kính ở ngọn còn 0,18–0,26 m), xoắn nhẹ cùng chiều quanh trục đứng (mỗi lưỡi lệch góc 10–20° từ gốc tới ngọn), ngọn hơi móc ra ngoài như lưỡi lửa liếm.
- **Chiều cao ngọn so le, cao nhất 1,20 m, thấp nhất 0,65 m** (ngang vai nhân vật là ~1,25 m; đầu nhân vật bắt đầu từ ~1,34 m). Gợi ý chiều cao theo thứ tự góc: 1,20 / 0,80 / 1,05 / 0,70 / 1,15 / 0,85 / 1,00 / 0,65 / 0,95. Không lưỡi nào vượt 1,20 m.
- Lưới: 6 cạnh × 7 vòng + chóp; UV từng góc: `u` chạy quanh ống 0 → 1 (cột nối tách đỉnh như cách cũ), **glTF `v` = 0 ở gốc, 1 ở ngọn** (chú ý Blender lật V khi xuất: xem cách `build_demon.py`/`build_flame` ghi `(u, 1 - v)` và README "GLB có v = 0 ở gốc"). Pháp tuyến mượt từ mặt cong (không phẳng).
- Ngân sách: **≤ 1.200 tam giác** cho `flames` (9 × (6×7×2 − 6) = 702 với chóp một đỉnh; được tăng lên 8 cạnh nếu còn dưới 1.200). Đặt `BUDGET = 1500` (bộ hào quang đầy đủ), `SIZE_BUDGET = 90`, `PARTS = ['flames']`.
- Ảnh xem `vo-khi-4-goc.jpg` (giữ tên tệp): bốn góc, có hình người mẫu cao 1,6 m (hàm `preview_person` có sẵn), vật liệu xem thử phát sáng trong suốt màu xanh `#399de8`. Tự hỏi: có đọc ra **lửa bốc từ chân lên, thấp hơn vai** không, có thấy rõ đầu và vai người mẫu không?
- `check`/`RESULT`: in tam giác `flames`, chiều cao lớn nhất (`max_z`) và bán kính lớn nhất của lưới, cảnh báo nếu `max_z > 1.22`.

### B2 · Đài sen nhìn ngang ra hoa sen (`build_lotus.py`)
Giữ hợp đồng: nút `petals0` (16), `petals1` (12), `petals2` (8), `pod`, gốc mỗi nút ở tâm, vật liệu cánh `petal`, màu ở `COLOR_0`, **≤ 1.200 tam giác**, ≤ 60 KB. Hiện nhìn ngang (`ban-mau-dai-sen-4-goc.jpg`, ô thứ ba) đọc ra **vương miện gai** vì đầu cánh nhọn dựng lên và tầng ngoài xòe phẳng mỏng. Đích (`public/img/fx/aura/lotus-gold.webp`): đài thấp rộng, các cánh **bầu tròn** như những múi xếp lớp, đầu cánh tròn với mũi rất ngắn.
- **Đầu cánh bớt nhọn:** viền cánh dạng thìa/giọt nước bầu: bề rộng ở 80% chiều dài vẫn còn ≥ 55% bề rộng lớn nhất, chóp bo tròn bán kính lớn, mũi nhọn chỉ ≤ 6% chiều dài. Bụng rộng nhất ở 55–60% chiều dài. (Hiện `u^1,1 × (1−u)` làm đầu cánh nhọn sớm.)
- **Tầng ngoài xòe thấp:** góc từ 10° (gốc) cong lên 22° (đầu), chóp tầng ngoài cao ≤ 0,12 m; tầng giữa 32° → 48° (chóp ~0,20 m); tầng trong 55° → 80° khum vào (chóp ~0,26 m). Cánh khum lòng máng rõ (mép cuộn lên 18–22% bề rộng) để nhìn ngang thấy **bụng cánh tròn**, không thấy lưỡi dao.
- Đường kính tổng giữ ~1,2 m. Giữ màu vòng trước.
- Ảnh xem giữ bốn ô; **thêm một ô nhìn ngang đúng 0°–8°** (thay ô góc 30° thứ hai) để Điều phối so với ảnh 2D.

### Chạy (Điều phối chạy)
`blender -b --factory-startup --python-expr "import runpy; runpy.run_path(r'<repo>/tools/blender/fx/build_aura.py', init_globals={'REPO': r'<repo>', 'OUT': ['glb','views','check'], 'PREVIEW': True, 'TMP': r'C:/t204x/b1'})"` (tương tự `build_lotus.py`). Báo cáo: dự kiến tam giác từng nút, hàm đã sửa.

---

## Phần C · JS, shader, test

**File được sửa:** `public/js/stand-math.js`, `public/js/world3d/fx3d/{materials,demon,aura,lotus,index}.mjs`, `public/js/world3d/index.mjs` (chỉ hàm `updatePeople`), `public/js/world3d/scenes/arena.mjs` (chỉ phần suất trong `update`), `test/stand-math.test.js`, `test/world3d-fx.test.js`, `test/world3d-scene-arena.test.js`, và **chỉ dòng `?v=`** ở C6. **Cấm chạm:** `server.js`, `public/js/hall.js`, `lib/**`, `avatar.mjs` (trừ dòng `import ?v=`), mọi file 2D, `public/img/**`, `public/models/**`, `tools/**`, `task.md`, `docs/**`, `view-math.js`, `camera.mjs`. Công tắc `ta-fx3d` vẫn mặc định tắt: khi tắt, game y như trước.

### C1 · `stand-math.js`: máy quay sát chủ
Hiện `selfStand` trả `null` khi khoảng cách ngang `d < minCamera` (0,6 m), `demon.mjs` rơi về `ANCHOR[4]` với cỡ 1,1 và không mờ: quỷ khổng lồ nhảy ra trước ống kính.
- `SELF_STAND` thêm `fadeNear: 0.35, fadeFar: 1.0, fadeMin: 0.25` (giữ các khóa cũ và giá trị cũ).
- `selfStand(camera, opts)`: trả `null` **chỉ** khi thiếu/không hữu hạn hoặc `d < 1e-6`. Khi `1e-6 ≤ d < minCamera`: tính như bình thường với hướng `(cx/d, cz/d)` nhưng coi `fit = 0` (cỡ `scaleNear`, `y` theo công thức `fit = 0`) và đánh dấu `close: true`. Mọi kết quả có thêm `fade`:
  `fade = fadeMin + (1 − fadeMin) · smooth(clamp((d − fadeNear) / (fadeFar − fadeNear), 0, 1))`, với `smooth(x) = x·x·(3 − 2x)`; thiếu khóa fade trong `opts` thì `fade = 1`.
- Giữ nguyên kết quả (`x, y, z, yaw, head, scale`) cho `d ≥ minCamera` (test cũ vẫn đúng, trừ test "d < 0,6 → null" phải sửa).
- Test (`test/stand-math.test.js`, tên tiếng Việt): `d = 0.3` → không `null`, `scale === scaleNear`, `close === true`, `fade === fadeMin` (vì `d ≤ fadeNear`); `d = 0.5` → `fadeMin < fade < 1`; `d = 0.8` → `fade` lớn hơn ở `d = 0.5`; `d ≥ fadeFar` → `fade === 1`; `d ≥ minCamera` → không có `close` (hoặc `close === false`); `{x:0,z:0}`, `Infinity`, thiếu → `null`.

### C2 · `stand-math.js`: suất riêng cho pháp tướng công đức
- `LIMITS` thêm `merit: Object.freeze({ low: 2, medium: 8, high: Infinity })`; `slots(list, self, quality, kind)` nhận `kind` `'merit'` (lọc 25 m ở mức Cao như `'aura'`).
- `fxSlots(list, self, quality)`: phần tử danh sách có thêm `merit: bool`; trả `Map id → { demon, aura, merit, slot }`, `merit = !!item.merit && merits.has(item.id)`, `slot = demon || aura || merit || (!item.demon && !item.aura && !item.merit)`.
- Test: người chỉ có merit (không hào quang) ở trong suất → `{ demon: false, aura: false, merit: true, slot: true }`; người không có gì → `{ demon: false, aura: false, merit: false, slot: true }`; mức Thấp có 4 người merit + mình → mình và 2 người gần nhất `merit: true`, người thứ ba `merit: false`. Sửa test cũ có `deepEqual` cho khớp khóa mới.

### C3 · `fx3d/index.mjs`: chặn theo khóa đúng phần
Trong `update`, thay `ctx.slots[name === 'demon' ? 'demon' : 'aura'] === false` bằng khóa theo phần: `demon → 'demon'`, `lotus → 'aura'`, `aura → 'aura'`, `merit → 'merit'`. Nếu khóa `merit` không có trong `ctx.slots` (bên gọi cũ) thì **không chặn** merit. Test (`world3d-fx.test.js`): `ctx.slots = { demon: true, aura: false, merit: true }` → `merit` vẫn được `update` (dùng phần giả như test hiện có ở dòng ~800), `lotus`/`aura` bị ẩn; `{ demon: true, aura: true, merit: false }` → merit bị ẩn; `{ demon: true, aura: false }` (thiếu merit) → merit vẫn được `update`. Sửa test hiện có (`hidden`, `updates`) cho khớp.

### C4 · `world3d/index.mjs` (`updatePeople`) và `scenes/arena.mjs`
Danh sách gửi `fxSlots` thêm `merit: Number(p.meritRank) > 0` (và `player.meritRank` ở arena); `fx.slots` thêm `merit: s.merit`. Test Sân đấu hiện có: thêm một người chơi `meritRank: 2` không có `aura` → `userData.fx.slots.merit === true`.

### C5 · `fx3d/demon.mjs`: giữ chỗ đứng khi máy quay sát, mờ dần
1. Thêm biến `lastStand = null`. Ở chế độ `'face'` khi có máy quay:
   - `stand = SM.selfStand(...)`; nếu khác `null`: `lastStand = stand`.
   - nếu `null` mà có `lastStand`: dùng `lastStand` nhưng `scale = Math.min(lastStand.scale, SM.SELF_STAND.scaleNear)` và `fade = SM.SELF_STAND.fadeMin`.
   - nếu `null` và chưa có `lastStand`: giữ cách đặt neo cũ nhưng `scaleGoal = SM.SELF_STAND.scaleNear` và `fade = SM.SELF_STAND.fadeMin` (không bao giờ cỡ 1,1 sát ống kính).
2. Độ mờ chế độ `'face'`: `near = face ? fadeSmooth : (công thức cũ)`, trong đó `fadeSmooth` làm mượt `stand.fade` (hằng thời gian 0,3 giây như `selfScale`; giảm chuyển động thì đặt thẳng). Nhân vào `opacity` như `near` hiện nay. Khi máy quay chưa thấy lần nào (`!(ctx.camera || cameraSeen)`) thì `fade = 1` như cũ.
3. Test (`world3d-fx.test.js`): sửa test "máy quay sát chủ trả về neo cũ" (dòng ~763) thành: đặt máy quay xa (`z = -5`) một khung, rồi máy quay `{x: 0, y: 1.6, z: 0}` (d = 0) → nhóm quỷ **không** về `(0, 1.2, -0.55)`, ở gần vị trí khung trước (sai số 1e-6, giảm chuyển động), `scale.x === SELF_STAND.scaleNear`, `uAlpha` của vật liệu thân `=== fadeMin × alpha`. Thêm ca máy quay `z = -0.3` (d = 0,3): `scale.x === scaleNear`, `uAlpha` ≈ `fadeMin` (vì `d ≤ fadeNear`); `z = -0.7`: `uAlpha` nằm giữa `fadeMin` và 1. Ca **chưa từng thấy máy quay** (không `ctx.camera`, chưa render): giữ hành vi cũ (neo cũ, cỡ `SELF_SCALE`, không mờ) — test cũ cho ca này giữ nguyên.

### C6 · Lửa hộ thân (`fx3d/aura.mjs`, `fx3d/materials.mjs`)
Lưới mới trong `aura-kit.glb` là nút **`flames`** (9 lưỡi lửa ống kín, cao nhất 1,20 m, glTF `uv.y` = 0 ở gốc, 1 ở ngọn; xem Phần B1).
1. `materials.mjs`: `flameShellMaterial({ tongue: true, ... })` thêm nhánh `#ifdef FLAME_TONGUE` (giữ nguyên nhánh vỏ khí cũ và nhánh `FLAME_RIBBON`; test cũ phải vẫn đúng):
   - Đỉnh: `vH = uv.y;` dịch đỉnh nhẹ: `p += objectNormal * (n - 0.4) * 0.05 * smoothstep(0.3, 1.0, vH) * uDisplace; p.y += (n - 0.3) * 0.06 * smoothstep(0.6, 1.0, vH) * uDisplace; p.x += sin(uTime * 2.3 + p.y * 4.0 + uSeed * 6.0) * 0.02 * vH * uDisplace;` với `n = texture2D(uNoise, vec2(uv.x * 2.0 + uSeed, uv.y * 1.4 - uTime * 0.8)).r` (độ dịch dọc ≤ 0,06 m để ngọn không vượt vai).
   - Mảnh (mẫu, được chỉnh nhẹ):
     ```glsl
     float n1 = texture2D(uNoise, vec2(vUv.x * 2.0 + uSeed, vUv.y * 1.1 - uTime * 0.8)).r;
     float n2 = texture2D(uNoise, vec2(vUv.x * 5.0 - uSeed, vUv.y * 2.3 - uTime * 1.5)).r;
     float n = n1 * 0.6 + n2 * 0.4;
     float core = pow(abs(dot(normalize(vN), normalize(vV))), 1.2);      // giữa đặc, mép mềm: không phải lọ kính
     float base = smoothstep(0.0, 0.18, vH);                               // gốc hòa vào đài sen
     float tip = 1.0 - smoothstep(0.5 + n * 0.25, 0.92 + n * 0.08, vH);   // ngọn tan theo nhiễu
     float a = core * base * tip * (0.55 + 0.45 * n) * uOpacity;
     a *= smoothstep(0.6, 1.8, vDist);
     a = min(a, 0.75);
     vec3 deep = uColor * 0.55;
     vec3 hot = mix(uColor, vec3(1.0), 0.18);                              // lõi sáng nhẹ, không cháy trắng
     vec3 col = mix(deep, hot, core * (1.0 - vH * 0.6));
     gl_FragColor = vec4(col, a);
     ```
     sau đó vẫn `#include <tonemapping_fragment>` rồi `#include <colorspace_fragment>`. Trộn thường (`NormalBlending`), `depthWrite: false`, `toneMapped: true`, `side` mặc định `FrontSide`.
2. `aura.mjs`: tìm `asset.scene.getObjectByName('flames')`; không có thì thử `'shell'` (tệp cũ) — không có cả hai thì `failed`. **Bỏ cặp mặt sau/mặt trước**: mỗi lớp một lưới `FrontSide`, vật liệu `flameShellMaterial({ tongue: true, seed })`, `renderOrder = env.RENDER.shellFront`. Ba lớp: `{ scale: [1, 1, 1], rot: 0, opacity: 1, seed: 0 }`, `{ scale: [1.12, 0.82, 1.12], rot: Math.PI / 9, opacity: 0.75, seed: 0.37 }`, `{ scale: [0.9, 0.68, 0.9], rot: -Math.PI / 9, opacity: 0.6, seed: 0.71 }` (xoay `rotation.y` để lưỡi lớp sau nằm giữa khe lớp trước; **không lớp nào có scale Y > 1**). Mức Cao 3 lớp, Vừa 2, Thấp 1 (`uDisplace` 0 ở Thấp) như cũ. Ngồi: `holder.scale.y = 0.8` như cũ. Hạt (mức Cao): bán kính 0,3–0,45 m, cao 0 → 1,2 m (không bay quá vai).
3. Màu: `uColor` lấy `state.color` mỗi khung (9 bậc đổi màu). `uOpacity = fade × layer.opacity`.
4. `AURA_KIT_URL = '/models/fx/aura-kit.glb?v=3'`, `DEMON_URL[4] = '/models/fx/demon-4.glb?v=3'`, `LOTUS_URL = '/models/fx/lotus.glb?v=3'`.
5. Test (`world3d-fx.test.js`): sửa các test vỏ khí (dòng ~384, ~517–556) cho lưới giả tên `flames`: 3 lớp ở Cao, 2 ở Vừa, 1 ở Thấp; không lớp nào `scale.y > 1`; tất cả `side === FrontSide`; đổi `state.color` thì `uColor` đổi theo; tệp giả chỉ có `shell` vẫn chạy (dự phòng). Test vật liệu: `flameShellMaterial({ tongue: true })` có `defines.FLAME_TONGUE`, mảnh có `tonemapping_fragment` trước `colorspace_fragment`, có `a = min(a, 0.75)`, không có `AdditiveBlending`. URL mô hình `?v=3`.

### C7 · Tăng `?v=` (mỗi module đúng **một** số ở mọi nơi, kể cả test)
| Module | Cũ → mới | Nơi import |
|---|---|---|
| `stand-math.js` | v2 → v3 | `public/index.html`, `public/world3d-fx.html` |
| `fx3d/materials.mjs` | v4 → v5 | `fx3d/index.mjs`, test |
| `fx3d/index.mjs` | v4 → v5 | `demon.mjs`, `lotus.mjs`, `aura.mjs`, `placeholder.mjs`, `avatar.mjs`, `world3d-fx.html`, test |
| `fx3d/demon.mjs` | v4 → v5 | `avatar.mjs`, test |
| `fx3d/lotus.mjs` | v3 → v4 | `avatar.mjs`, test |
| `fx3d/aura.mjs` | v4 → v5 | `avatar.mjs`, test |
| `fx3d/placeholder.mjs` | v2 → v3 | `world3d-fx.html`, test |
| `avatar.mjs` | (đọc số hiện tại) +1 | mọi nơi import (Grep `avatar.mjs?v`) |
| `avatar-glb.mjs` | +1 | mọi nơi import |
| `scenes/arena.mjs` | v9 → v10 | `world3d/index.mjs`, `world3d-scene-arena.html` |
| `scenes/yard.mjs` | +1 (vì import `avatar-glb.mjs`) | `world3d/index.mjs`, `world3d-scene-yard.html` |
| `world3d/index.mjs` | +1 | `public/js/view3d-ui.js`, `public/world3d-test.html` |
| `view3d-ui.js` | +1 | `public/index.html` |
Các trang/scene khác import `avatar.mjs` hay `avatar-glb.mjs` (hall, library…) cũng tăng số của chính module đó và dòng import. Grep lại sau khi sửa: `grep -rnoE "(fx3d/[a-z]+\.mjs|stand-math\.js|avatar(-glb)?\.mjs|scenes/[a-z]+\.mjs|world3d/index\.mjs|view3d-ui\.js|models/fx/[a-z0-9-]+\.glb)\?v=[0-9]+" public test | sort | uniq` — mỗi module chỉ một số.

### Lệnh kiểm (Điều phối chạy)
```
npm run check
node --test test/stand-math.test.js test/world3d-fx.test.js test/world3d-avatar.test.js test/hall-view3d.test.js test/world3d-avatar-glb.test.js test/world3d-scene-arena.test.js
npm test
```
Báo cáo: file đã sửa, bảng `?v=` cũ → mới, test đã thêm/sửa, điều chưa chắc.

---

## Điều phối chỉnh sau khi xem trong trình duyệt (khác đặc tả ở trên)

- `SELF_STAND`: `lift` 1,3 → **0,5**, thêm **`sideNear: 0.75`** (giữ `scaleNear` 0,45, `y`, `sink`, `fitNear`, `fitFar`). Ở Sân đấu máy quay đứng cách chủ 1,0–1,5 m; với `lift` 1,3 sừng và mắt quỷ lọt dưới bảng "Sân đang vắng"; hạ thấp thì mặt quỷ nấp sau đầu và hào quang 2D của chủ, nên khi máy quay sát `selfStand` nội suy độ lệch ngang từ `side` 0,35 (máy quay ≥ `fitFar`) tới `sideNear` 0,75 (≤ `fitNear`), đẩy quỷ sang trái màn hình. Test "máy quay bị ép lại gần…" đổi ngưỡng mặt quỷ từ 1,9 m xuống 1,4 m, thêm điều kiện mặt quỷ khi sát tường thấp hơn 1,9 m và kiểm khoảng cách ngang `hypot(back, sideNear)` / `hypot(back, side)`. Đã thử một lượt `scaleNear` 0,4 nhưng quỷ quá nhỏ, nên bỏ.
- `FLAME_TONGUE` (lửa hộ thân): màu bậc thường nhạt (bậc 5 `#8fd3ff`) nên trộn thường vẫn ra xanh trắng như băng. Đổi: `deep = pow(uColor, 2.2) × 0.85`, `hot = mix(uColor, trắng, 0.08) × 0.9`, `heat` theo lõi và chiều cao (tối đa 0,8), thêm khe lửa `lick` theo nhiễu; độ đục tối đa 0,85.
- `FLAME_RIBBON` (lửa vai quỷ): hằng màu trong shader là tuyến tính, `(1, 0.62, 0.18)` cũ ra màu kem sau ánh xạ tông. Đổi thành `(1, 0.3, 0.03)` (cam rực), hệ số sáng `0.68 + n × 0.32`, độ đục `(0.25 + edge) × tongue × (0.75 + streak)` tối đa 0,92.
- Thêm vòng: Ma Vương 3 vòng (vòng 3 chỉ làm mịn giáp vai, sừng, vòng tay, đuôi bằng 600 tam giác lấy từ thân); lửa hộ thân 2 vòng; đài sen 2 vòng (vòng 2 nâng tầng ngoài theo lượt chấm thứ nhất của terra).
- Kiểm hình bằng Playwright không giao diện có GPU thật (`--use-angle=vulkan`), vì khung Browser của ứng dụng bị ẩn không vẽ được WebGL; SwiftShader chỉ đạt ~1,6 khung/giây ở Sân đấu nên ảnh từ nó sai lệch (lò xo chưa kịp hội tụ).
