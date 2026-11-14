# Đặc tả T-142 · Bản mẫu Blender: Ma Vương, đài sen vàng, vỏ khí

> Viết cho thợ. **Làm đúng đặc tả, không tự thiết kế lại.** Thấy đặc tả mâu thuẫn với mã thật thì dừng, ghi vào bàn giao.
> Thiết kế: [KE-HOACH-PHAP-TUONG-3D.md](../KE-HOACH-PHAP-TUONG-3D.md) §1.1, §1.2, §1.3, §2.3, §2.4. Ảnh ý tưởng: [BANG-Y-TUONG.md](BANG-Y-TUONG.md), `docs/phap-tuong/anh/y-tuong-quy-4.jpg`, `y-tuong-dai-sen.jpg`, `y-tuong-hao-quang.jpg`. Ảnh 2D gốc: `public/img/fx/demon-4.webp`.
> Mẫu kịch bản Blender: `tools/blender/avatar/build.py` (đọc kỹ: `Mesher`, `make_mesh_object`, `material`, `make_rig`, `bind`, `apply_pose`, `key_pose`, `make_clips`, `new_scene`, `stage`, `aim`, `shoot`, `montage`, `export`).

Thẻ chia hai phần cho hai thợ chạy song song, **không chạm file của nhau**:

| Phần | Thợ | File |
|---|---|---|
| A · Ma Vương | thợ khó | `tools/blender/fx/build_demon.py` |
| B · Đài sen + vỏ khí + README | thợ vừa | `tools/blender/fx/build_lotus.py`, `tools/blender/fx/build_aura.py`, `tools/blender/fx/README.md` |

Tệp `.glb` và ảnh do **Điều phối** chạy Blender sinh ra (thợ không chạy được Blender trong hộp cát). Thợ **không** tạo/sửa file `.glb`, ảnh, `task.md`, mã JS, hay bất kỳ file nào ngoài phần của mình. Không chạy lệnh, không commit.

## 0. Quy ước chung cho mọi kịch bản

- Python cho Blender 5.3, chạy không giao diện:
  `blender -b --python-expr "import runpy; runpy.run_path(r'<repo>/tools/blender/fx/build_demon.py', init_globals={'REPO': r'<repo>', 'OUT': ['glb','views','check'], 'PREVIEW': True})"`
- **Mỗi kịch bản tự đủ** (không import file kịch bản khác). Được **chép** các hàm cần từ `tools/blender/avatar/build.py` rồi sửa cho hợp (ghi chú `# chép từ avatar/build.py` ở đầu mỗi hàm chép).
- Đầu file: docstring tiếng Việt giống `avatar/build.py` (cách chạy, biến điều khiển, đầu ra, quy ước toạ độ). Biến điều khiển đọc bằng `globals().get(...)`:
  - `REPO` (bắt buộc, thiếu thì `raise SystemExit('Thiếu REPO')`)
  - `OUT`: tập con của `{'glb', 'views', 'check'}` (mặc định `['check']`)
  - `PREVIEW`: `True` (mặc định) → ảnh vào `TMP`; `False` → ảnh vào `docs/phap-tuong/anh/`
  - `TMP`: mặc định `os.path.join(tempfile.gettempdir(), 'phap_tuong')`
- `random.seed(<hằng số>)` cố định ở đầu. Không dùng thời gian.
- **Cảnh riêng**: `SCENE = 'PhapTuongDemon'` / `'PhapTuongLotus'` / `'PhapTuongAura'`. `new_scene()` chỉ xoá đối tượng **trong cảnh đó** và datablock **có tên của mình** (theo mẫu `mine = {...}` của avatar). Không đụng cảnh khác, **không lưu `.blend`**, không gọi `bpy.ops.wm.save*`.
- Toạ độ Blender: Z lên, **mặt nhìn về −Y** (xuất glTF với `export_yup=True` thành mặt nhìn +Z), bên trái của nhân vật là +X. Đơn vị mét.
- Màu `rgb(hex)` chuyển sRGB → tuyến tính như mẫu.
- `check` in **một dòng** dạng `RESULT ` + `json.dumps(res, ensure_ascii=False)`: số tam giác từng lưới và tổng, `glb_kb`, tên xương, tên clip + thời lượng, tên nút, tên vật liệu, và **danh sách thuộc tính đỉnh trong tệp `.glb` đã xuất** (đọc lại `.glb`: 12 byte đầu, khúc JSON, lấy `meshes[*].primitives[*].attributes` keys). Nếu vượt ngân sách thì vẫn in, thêm khoá `"over_budget": [...]`.
- Ảnh `views`: 4 góc **trước (0°), nghiêng 45°, ngang (90°), sau (180°)**, mỗi ô 320×720 (đài sen: 320×360), ghép 1280×720 (đài sen 1280×360) bằng `montage`. Nền tối `#1b1a20` để thấy độ phát sáng (khác avatar). Đèn 3 nguồn như mẫu. Tên ảnh: `ma-vuong-4-goc.jpg`, `dai-sen-4-goc.jpg`, `vo-khi-4-goc.jpg`.

## A · `build_demon.py` (Ma Vương, cấp 4)

Biến riêng `LEVEL = int(globals().get('LEVEL', 4))`; `LEVEL != 4` → `raise SystemExit('Cấp này làm ở T-145')`. Viết bảng `SPEC = {4: {...}}` chứa mọi số đo để T-145 thêm cấp 1..3 mà không viết lại.

### A1. Hình khối (gốc toạ độ ở **thắt lưng** quỷ = (0,0,0))

Tổng cao 2,8 m: đuôi khói từ z = −1,15 tới đỉnh sừng z ≈ +1,65.

| Bộ phận | Vị trí / kích thước (m) | Gợi ý dựng | Tam giác tối đa |
|---|---|---|---|
| Ngực, bụng, lưng | loft elip từ z 0 (rx 0,30 ry 0,22) → z 0,55 (rx 0,48 ry 0,30, ngực nở) → z 0,82 (rx 0,52 ry 0,28, ngang vai) → z 0,95 (rx 0,20 ry 0,18, gốc cổ); lưng hơi gù | `Mesher.loft`, 14 cạnh | 520 |
| Cổ + đầu | đầu tâm (0, −0,04, 1,18), bán kính (0,24, 0,24, 0,26); hàm dưới nhô ra trước (y −0,2), miệng há; tai nhọn hai bên | `sphere` 14×9 + loft hàm | 520 |
| Sừng ×2 | gốc (±0,15, 0, 1,36), cong ra ngoài rồi lên, đỉnh (±0,42, 0,05, 1,65); loft 6 cạnh, 8 vòng, bán kính 0,08 → 0,005 | loft theo đường cong | 2 × 100 |
| Ba mắt | hai mắt (±0,09, −0,22, 1,22) hình hạnh nhân dẹt, **mắt thứ ba** dọc giữa trán (0, −0,23, 1,33) | `sphere` 8×4 dẹt | 60 |
| Nanh | 4 nanh cong ở hàm (2 trên chĩa xuống, 2 dưới chĩa lên) | cone 4 cạnh | 40 |
| Giáp vai ×2 | khối dẹt phủ vai (±0,55, 0, 0,85), bán kính (0,22, 0,24, 0,14), 3 gai ngắn | `sphere` 10×6 + cone | 2 × 140 |
| Tay ×2 | vai (±0,55, 0, 0,82) → khuỷu (±0,95, −0,25, 0,62) → cổ tay (±1,15, −0,55, 0,55): **hai tay xòe ra trước như ôm lấy chủ**; bắp tay to (r 0,16 → 0,12), cẳng tay (0,13 → 0,09); vòng giáp cổ tay | loft 8 cạnh | 2 × 200 |
| Bàn tay ×2 | lòng bàn tay (0,16 × 0,08 × 0,18) hướng vào trong, **5 ngón cong**, mỗi ngón 2 đốt + vuốt đen dài 0,12 | loft 5 cạnh + cone | 2 × 330 |
| Đuôi khói | từ z 0 (rx 0,30) xuống z −1,15 thành mũi nhọn, vặn xoắn 120° quanh trục Z, có 2 sợi khói phụ tách ra ở z −0,4 và −0,7 | loft 10 cạnh, 10 vòng + 2 loft nhỏ | 420 |

**Tổng ≤ 4.000 tam giác** (bảng trên ≈ 3.600). Mọi mặt tam giác hoá trước khi tạo mesh như mẫu.

### A2. Màu đỉnh hai lớp

- Lớp `Col` (thành **`COLOR_0`**): da `#5a1418`; sừng `#2a1a14`; vuốt, nanh `#e8d8b0` (nanh) / `#1a1010` (vuốt); giáp `#3a2a22`; đuôi khói `#3a0e10`; trong miệng `#2a0606`.
- Lớp `Glow` (thành **`COLOR_1`**, chỉ dùng kênh R, G = B = R, A = 1): mắt và mắt thứ ba **1,0**; trong miệng 0,7; **vết nứt dung nham** trên ngực, bụng, bắp tay, lưng: chọn mặt theo nhiễu cố định (dùng `mathutils.noise.noise(co * 3.1)` > 0,42 → 0,85) để thành đường vân, không phải chấm lẻ; đuôi khói: đốm than 0,4 rải theo nhiễu; còn lại 0.
- Đặt `Col` là màu kích hoạt và màu render (`active_color`, `render_color_index`) như mẫu. Xuất với **`export_vertex_color='ACTIVE'` và `export_all_vertex_colors=True`** (nếu Blender 5.3 đổi tên tham số, dò `bpy.ops.export_scene.gltf.get_rna_type().properties` và ghi lại trong bàn giao). `check` phải in thấy cả `COLOR_0` và `COLOR_1`; nếu không có `COLOR_1` thì in `"over_budget": ["thiếu COLOR_1"]`.
- **Một** vật liệu tên `spirit`: Principled, Base Color nối màu đỉnh `Col`, Emission Color nối `Glow` × `#ff7a1a`, Emission Strength 3, Alpha 0,9, `blend_method`/`surface_render_method` để trong suốt nếu Blender 5.3 có (bọc `try`). Mã trình duyệt sẽ thay vật liệu này bằng `spiritMaterial`, nên vật liệu trong `.glb` chỉ cần đúng tên.

### A3. Bộ xương (dùng dấu gạch dưới, **không** dùng dấu chấm: Three.js bỏ dấu chấm khỏi tên nút)

```
root (0,0,−0,05)→(0,0,0,1)
  spine (0,0,0)→(0,0,0,45)
    chest (0,0,0,45)→(0,0,0,9)
      neck (0,0,0,9)→(0,0,1,05)
        head (0,0,1,05)→(0,0,1,45)
          jaw (0,−0,05,1,12)→(0,−0,24,1,02)
      shoulder_L (0,1,0,0,82)→(0,55,0,0,82)      shoulder_R đối xứng
        upper_arm_L (0,55,0,0,82)→(0,95,−0,25,0,62)
          forearm_L (0,95,−0,25,0,62)→(1,15,−0,55,0,55)
            hand_L (1,15,−0,55,0,55)→(1,22,−0,72,0,5)
  tail1 (0,0,0)→(0,0,−0,4)
    tail2 (0,0,−0,4)→(0,0,−0,75)
      tail3 (0,0,−0,75)→(0,0,−1,15)
```
(Dấu phẩy thập phân trong bảng trên chỉ để đọc: trong mã viết `0.82`.) Ma Vương **không** có `wing_L/R`. Trọng số đặt thẳng khi dựng như `Mesher.setw` của mẫu (vòng loft giữa hai xương chia 0,5/0,5), không dùng tự động.

### A4. Tám clip (25 khung/giây, xuất theo `NLA_TRACKS` như mẫu)

Khoá thêm **`scale` của `root`** (mẫu chỉ khoá xoay và vị trí `hips`: thêm khoá `scale` cho `root`).

| Clip | Thời lượng | Lặp | Mô tả (góc theo độ) |
|---|---|---|---|
| `emerge` | 0,9 s | không | `root`: scale 0,05 → 1,08 (khung 18) → 1,0; dời z −1,1 → 0; tay từ khép (upper_arm xoay xuống 60°) → xòe; đầu ngửa 15° rồi về 0 |
| `idle` | 4 s | có | thở: chest ±3°, spine ±1,5°; hai tay xòe ôm, đung đưa ±5° lệch pha; đầu lắc chậm ±4°; tail1..3 lắc ±8° lệch pha 0,25 vòng |
| `drift` | 1,6 s | có | spine + chest ngả về trước tổng 12°; tay kéo ra sau 25°; tail1..3 ngả ra sau 15°/20°/25° (đuôi kéo dài), lắc nhẹ ±6° |
| `scoff` | 2 s | có | chest + head quay 60° sang phải (quay mặt đi), hai tay **khoanh trước ngực** (upper_arm vào trong, forearm gập 110°), đầu hất cằm 10° |
| `peek` | 2 s | có | spine nghiêng 15° sang trái + ngả trước 20°, đầu cúi 20° và nghiêng 12° (thò đầu qua vai chủ); tay trái vịn xuống (upper_arm_L xoay 40°) |
| `taunt1` | 2 s | không | **gầm không tiếng**: jaw mở 25°, đầu ngửa 20°, hai tay giơ cao vuốt chĩa lên (khung 15 → 35), rồi về tư thế idle khung 50 |
| `taunt2` | 2 s | không | nghiêng đầu 25° nhìn chủ, tay phải vươn ra trước, ngón co duỗi (hand_R xoay ±30° ba lần), rồi về idle |
| `vanish` | 0,6 s | không | `root`: scale 1 → 0,05, dời z 0 → −1,1; tay khép; đầu cúi |

Khung đầu và cuối của clip lặp phải trùng tư thế. Clip không lặp kết thúc ở tư thế `idle` khung 0 (trừ `vanish`).

### A5. Đầu ra

- `glb`: `public/models/fx/demon-4.glb`, gồm armature + một mesh skinned `MaVuong`; `export_skins=True`, `export_animations=True`, `export_animation_mode='NLA_TRACKS'`, `export_optimize_animation_size=True`, `export_texcoords=False`. **≤ 300 KB.**
- `views`: dựng thêm một **người đứng tạm** (trụ + cầu màu xám `#9a9088`, cao 1,6 m) ở chỗ chủ: chủ đứng tại `(0, −0,55, −1,2)` so với gốc quỷ (tức quỷ ở sau lưng chủ, thắt lưng quỷ cao 1,2 m so với chân chủ: ANCHOR cấp 4 của `stand-math.js` là `x 0, y 1.2, z −0.55` theo hệ glTF). Ảnh tư thế `idle` khung giữa. Tâm ngắm z ≈ 0,3, khoảng cách máy ảnh đủ thấy cả 2,8 m.
- Thêm ảnh `ma-vuong-tu-the.jpg`: 4 ô `idle`, `drift`, `scoff`, `taunt1` (khung giữa), góc 30°.

## B · `build_lotus.py` (đài sen vàng)

### B1. Hình khối (gốc ở **mặt sàn**, tâm đài; nhân vật đứng trên gương sen)

- Đế tròn mỏng: bán kính 0,50, từ z −0,02 tới 0,02, 16 cạnh.
- `pod` (gương sen): trụ bán kính 0,20, mặt trên z 0,05, 16 cạnh, mặt trên có 7 lỗ hạt sen nông (vòng lõm nhỏ, hoặc chỉ tô màu đỉnh tối hơn nếu thiếu tam giác). Đế tròn gộp vào nút `pod`.
- Ba tầng cánh, mỗi tầng **một mesh object riêng** đặt tâm ở gốc (để mã xoay/co giãn cả tầng):
  - `petals0`: 16 cánh ngoài, gốc cánh ở bán kính 0,18, dài 0,36, rộng 0,13, nghiêng ra ngoài 62° so với trục đứng, đầu cánh cong lên.
  - `petals1`: 12 cánh giữa, lệch pha nửa cánh, gốc bán kính 0,15, dài 0,30, rộng 0,12, nghiêng 45°.
  - `petals2`: 8 cánh trong, gốc bán kính 0,12, dài 0,22, rộng 0,10, nghiêng 28°.
  - Mỗi cánh: lưới cong 2 × 4 ô (vỏ mỏng, không dày), mép nhọn ở đầu, lõm lòng như thìa; ≤ 16 tam giác/cánh.
- Vật liệu: `petal` (mọi cánh, **hai mặt**: `use_backface_culling = False` để glTF ghi `doubleSided`), `pod` (gương + đế). Màu đỉnh `Col`: cánh từ gốc `#b8862e` tới mép `#ffe39a`; gương `#d9a640`, lỗ hạt `#7a5214`. Principled: metalness 0,6, roughness 0,35 cho vàng.
- **Tổng ≤ 900 tam giác, `.glb` ≤ 60 KB.** Không có xương, không có clip.
- Đầu ra `public/models/fx/lotus.glb`, bốn nút đúng tên `petals0`, `petals1`, `petals2`, `pod`. `check` in tam giác từng nút.
- `views`: 4 góc ở độ cao máy ảnh 30° (nhìn xuống), thêm 1 ô nhìn thẳng từ trên; ghép 1280×360 (5 ô 256×360 hoặc 4 ô + bỏ ô trên, tùy, ghi rõ).

## B · `build_aura.py` (bộ hào quang, bản mẫu chỉ có vỏ khí)

- Lưới `shell`: hình trứng, **cao 2,1 m** (đáy z −0,05, đỉnh z 2,05), bán kính lớn nhất 0,55 ở z 0,85, đỉnh thon (bán kính ở z 1,7 còn 0,30). **12 vòng × 16 cạnh**, hai cực là quạt tam giác. Pháp tuyến hướng ra ngoài, mượt.
- UV: `u = i / 16` quanh thân (có đường nối, nhân đôi đỉnh ở đường nối), **`v` chạy dọc từ 0 ở đáy tới 1 ở đỉnh**. Xuất với `export_texcoords=True`.
- Vật liệu `shell` (Principled, emission `#8fd3ff` cường độ 2, alpha 0,35). Mã trình duyệt thay bằng `flameShellMaterial`.
- **≤ 400 tam giác**; cả `aura-kit.glb` ≤ 90 KB. Đầu ra `public/models/fx/aura-kit.glb`, nút `shell`. Để chỗ cho T-147 thêm nút (`halo`, `mandorla`, `infant`) vào cùng tệp: viết hàm `build_shell()` riêng và danh sách `PARTS = ['shell']`.
- `views`: 4 góc, có người đứng tạm như phần A (đặt tại gốc), vỏ khí bao quanh.

## C · `README.md` (thợ phần B viết)

Tiếng Việt, ngắn: mục đích thư mục, lệnh chạy từng kịch bản (đường dẫn Blender của chủ dự án `H:\blender.exe`, dùng `-b --python-expr` như trên), biến điều khiển, đầu ra, ngân sách (bảng §2.4), quy tắc "không sửa tay `.glb`, sửa kịch bản rồi chạy lại", bảng tên xương và clip của quỷ (chép từ A3, A4).

## D. Điều thợ KHÔNG làm

- Không sửa `tools/blender/avatar/*`, `tools/blender/kydao/*`, mã JS, `task.md`, `public/img/*`.
- Không tạo `.glb`/ảnh (Điều phối chạy Blender).
- Không dùng tài nguyên tải về; mọi hình dựng bằng mã.

## E. Điều phối kiểm

```
H:\blender.exe -b --python-expr "import runpy; runpy.run_path(r'<repo>\tools\blender\fx\build_demon.py', init_globals={'REPO': r'<repo>', 'OUT': ['glb','views','check']})"
(tương tự cho build_lotus.py, build_aura.py)
```
Đọc dòng `RESULT`, xem ảnh 4 góc, chấm theo phiếu ở `BANG-Y-TUONG.md`, gửi danh sách sửa nếu chưa đạt (tối đa 3 vòng).
