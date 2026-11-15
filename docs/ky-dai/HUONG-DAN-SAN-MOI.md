# Hướng dẫn: dựng một sân bàn cờ ("lãnh địa") từ mô hình có sẵn

> Dùng khi: làm lại một sân đang có, hoặc thêm sân mới (kể cả sân theo phong cách riêng như hoạt hình, anime). Người đọc có thể là người hoặc agent. Làm đúng thứ tự, mỗi sân một file.

## 1. Sân là gì, nằm ở đâu

Mỗi sân là **một ảnh nhìn từ trên xuống của nửa bàn**, render bằng Blender (Cycles). Bàn 2D và bàn 3D đều dùng chung ảnh này làm mặt nửa sân.

| Thứ | File |
|---|---|
| Ảnh sân, bản cờ vua | `public/img/kydao/fields2/<mã>-chess.webp` |
| Ảnh sân, bản cờ tướng và cờ úp | `public/img/kydao/fields2/<mã>-xiangqi.webp` |
| Khung dựng chung (không sửa khi chỉ làm một sân) | `tools/blender/kydao/field2.py` |
| **Mã của riêng một sân** | `tools/blender/kydao/fields/<mã>.py` |
| Danh sách nguồn tải về | `tools/blender/kydao/assets.json` |
| Nguồn đã tải (không commit) | `assets-src/polyhaven/`, `assets-src/polyhaven-tex/`, `assets-src/custom/` |
| Bảng kê các phần trong nguồn | `assets-src/index.txt` (sinh bằng `list_assets.py`) |
| File mẫu để chép | `tools/blender/kydao/fields/forest.py` |

Ảnh rộng 1408×704, 128 px mỗi ô cờ, nặng **tối đa 255 KB**.

## 2. Ba bước nhanh

```bash
# 1. Tải nguồn (Poly Haven, CC0) theo assets.json; mô hình tự tải thì chép tay vào assets-src/custom/
node tools/blender/kydao/fetch-assets.js <mã sân>

# 2. Xem tên và kích thước từng phần trong nguồn
/h/blender.exe -b --factory-startup -P tools/blender/kydao/list_assets.py -- "<repo>"

# 3. Render thử (704×352, khoảng 40 giây) rồi mở ảnh ra xem; sửa file sân; lặp lại
/h/blender.exe -b --factory-startup -P tools/blender/kydao/field2.py -- "<repo>" <mã sân> chess prev "<thư mục ảnh thử>"
```

Ảnh thử ghi ra `<thư mục ảnh thử>/prev-<mã>-chess.png`. Khi ưng, render bản cuối cả hai biến thể (khoảng 7 phút, ghi thẳng vào `public/`):

```bash
/h/blender.exe -b --factory-startup -P tools/blender/kydao/field2.py -- "<repo>" <mã sân> both final
```

Dòng cuối in `RESULT {...}` có `kb` (dung lượng), `lum_pct` (độ sáng vùng ô cờ), `burn_pct` (phần trăm điểm cháy trắng, phải gần 0).

Trên Windows có lệnh gọn hơn, tự lọc đầu ra chỉ còn lỗi Python và dòng `RESULT` (ảnh thử ghi ở `assets-src/prev/<mã sân>/`):

```powershell
powershell -ExecutionPolicy Bypass -File tools/blender/kydao/thu-san.ps1 <mã sân> chess          # bản thử
powershell -ExecutionPolicy Bypass -File tools/blender/kydao/thu-san.ps1 <mã sân> both final     # bản cuối
```

Agent chạy trong sandbox của Codex CLI **phải dùng lệnh PowerShell này**: sandbox chặn Git Bash.

Blender của chủ dự án ở `H:\blender.exe` (Git Bash: `/h/blender.exe`), không có trên PATH. `<repo>` là đường dẫn kiểu Windows.

## 3. Toạ độ và bố cục

Mọi vị trí viết theo **toạ độ ảnh (u, v)**, đơn vị là ô cờ:

- `u` chạy ngang: −5,5 (mép trái ảnh) tới +5,5 (mép phải). `v` chạy dọc: 0 (mép trên ảnh, là **đường giữa bàn**) tới 5,5 (mép dưới, phía người chơi).
- Vùng ô cờ: `|u| < 4` và `v < 4`. Gờ đá và bốn trụ đèn chiếm tới khoảng 4,5. **Dải cảnh** là phần còn lại: hai dải dọc trái, phải (`4,6 < |u| < 5,5`) và dải ngang dưới (`4,6 < v < 5,5`). Chỉ rộng chừng **một ô**, nên vật trang trí thường to 0,3 đến 1,3 ô.
- Có thể đặt tâm một vật **ngoài khung** (ví dụ `u = 6`) để chỉ một phần của nó vươn vào ảnh.
- `ctx.free(u, v, m)` trả `True` khi điểm nằm **ngoài** vùng `|u| < 4,5 + m` và `v < 4,5 + m` (tức ngoài ô cờ và gờ đá); `ctx.tz(u, v)` là độ cao mặt đất tại đó. Hàm chỉ xét **tâm** vật: vật to đặt sát 4,5 vẫn chờm lên gờ, nên khi rải vật lớn hãy truyền `margin` khoảng nửa cỡ lớn nhất.
- Mặt trời chiếu từ **góc trái-trên ảnh**, bóng đổ sang phải-dưới. Vật cao đặt ở dải trái sẽ đổ bóng lên ô cờ: **vật cao chỉ đặt ở dải phải và dải dưới**, dải trái chỉ đặt vật thấp (cao không quá khoảng 0,5 ô). Sân rừng mẫu có hai cây non cao hơn thế ở dải trái: đó là ngoại lệ đã xem ảnh và chấp nhận vì bóng chỉ chạm gờ; đừng lấy làm chuẩn.

### Luật bất di bất dịch (K5)

Sân không được làm khó đọc thế cờ:

1. Không vật nào che ô cờ hay đường lưới. Không vật nào vượt vào trong gờ đá.
2. Không bóng đổ đậm, không đốm sáng chói rơi lên ô cờ.
3. Ô cờ giữ tương phản sáng tối như bản đang có; không đổi `slab` nếu không có lý do.
4. Cờ tướng: mặt bàn phải đủ sáng và đều để nét lưới (do game vẽ đè) đọc được.

## 4. Viết file sân

File `tools/blender/kydao/fields/<mã>.py` được `field2.py` chạy **trong chính không gian tên của nó**, nên dùng thẳng mọi hàm của khung, không cần `import`.

**Cẩn thận trùng tên:** mọi file sân dùng chung một không gian tên và nạp theo thứ tự chữ cái. Hàm hay biến cấp cao trong file sân phải đặt tiền tố `<mã>_` (hoặc khai báo bên trong hàm dựng). Đặt trùng tên với hàm của khung (`fern`, `coral`, `bolt`, `Kit`…) sẽ âm thầm ghi đè nó cho mọi sân nạp sau.

Khung tối thiểu:

```python
def build_<mã>(ctx):
    sc, rng = ctx.sc, ctx.rng        # cảnh Blender và bộ ngẫu nhiên có hạt giống cố định
    kit = Kit(ctx)
    kit.put('tree_stump_01', 'tree_stump_01', -4.95, 4.95, 1.7, rot=0.6)   # một vật chủ ở góc
    kit.scatter('fern_02', 30, (0.6, 0.95), lambda u, v: True)             # rải 30 bụi trong dải cảnh
    tune_materials(kit.mats, 1.2, 1.7)                                     # tăng độ rực và độ sáng ảnh quét
    ctx.light(-4.95, 4.95, 0.9, '#c8ff70', 16.0, 0.2)                      # đèn điểm nhấn
    ctx.motes('#d8ff70', 30.0, 30, 0.2, 0.9, 0.014, 0.03, 'fireflies')     # đốm sáng lơ lửng


FIELDS['<mã>']['build'] = build_<mã>
```

### `Kit`: đặt mô hình nguồn

| Lệnh | Ý nghĩa |
|---|---|
| `kit.put(mã, phần, u, v, cỡ, rot=0, sink=0, tilt=(0,0), z=None)` | Đặt một bản. `mã` là tên thư mục trong `assets-src/polyhaven/`, hoặc `'custom:<tên file>'` cho mô hình tự tải. `phần` là tên lưới trong `index.txt`, viết đủ hoặc chỉ **đuôi tên** (`'_b'`, `'rock11'`). `cỡ` là bề ngang lớn nhất tính theo ô cờ, đo **trước khi nghiêng**. `rot` quay quanh trục đứng (radian). `tilt=(nghiêng quanh X, nghiêng quanh Y)` quay quanh **chân vật**, không quanh tâm: muốn đặt nằm một thân cây dài thì phải dời `u, v` bù nửa chiều dài và tự đặt `z`, rồi xem ảnh kiểm lại (đã có lần thân cây đặt nằm bị vùi mất trong cát). `sink` dìm xuống đất. `z` đặt cao độ tuyệt đối thay vì bám mặt đất. |
| `kit.scatter(mã, số lượng, (cỡ nhỏ nhất, cỡ lớn nhất), where, margin=0, sink=0, tilt=0)` | Rải ngẫu nhiên trong dải cảnh, chọn ngẫu nhiên giữa các phần của mô hình. `where(u, v)` trả `False` ở chỗ cần chừa (vũng nước, chỗ đặt vật chủ). |
| `kit.names(mã)` | Danh sách tên phần. |
| `kit.mats` | Tập vật liệu đã nhập, đưa cho `tune_materials(kit.mats, độ rực, độ sáng)`. Gọi **một lần, sau** khi đặt xong mọi mô hình. |

Gốc cao độ của mô hình nguồn là mặt đất (z = 0); phần chìm sẵn dưới z = 0 của đá, gốc cây sẽ tự chìm.

### Hàm dựng bằng mã vẫn dùng được

`B(tên, vật liệu)` gom hình (`.box`, `.ico`, `.cone`, `.lathe`, `.finish(sc)`); vật liệu: `basalt_material`, `gem_material`, `glow_material`, `water_material`, `glass_material`, `cloud_material`, `rock_material`; hình có sẵn theo chủ đề: `mushroom`, `fern`, `limb`, `crystal`, `coral`, `kelp`, `lotus_flower`, `lily_pad`, `koi`, `bolt`, `palm`, `cactus`, `reeds`, `censer`. Thứ gì nguồn không có (băng, tia sét, hoa sen, dung nham, nước) thì giữ cách dựng bằng mã và chỉ thay phần đá, cây, cỏ bằng mô hình thật.

### Cấu hình sân (`FIELDS['<mã>']`)

Sân đang có đã có sẵn cấu hình trong `field2.py`; file sân chỉ ghi đè thứ cần đổi, ví dụ `FIELDS['<mã>'].update(sun=('#ffe9b8', 3.4, 60), exposure=0.1)`. Các khóa:

| Khóa | Ý nghĩa |
|---|---|
| `world=(màu, cường độ)` | ánh sáng môi trường |
| `sun=(màu, cường độ, góc cao độ)` | mặt trời |
| `exposure`, `glare=(ngưỡng, cường độ, cỡ)` | phơi sáng và quầng sáng |
| `ground=lambda: ground_material(...)` | vật liệu nền đất của dải cảnh |
| `liquid=lambda: water_material(...)`, `liquid_z` | mặt nước/dung nham lấp chỗ trũng |
| `T=dict(off, amp, freq, lo, hi, cap, depth, rim, carve=[...], flat=[...], flat_h)` | địa hình: `carve` khoét vũng (`('ell', u, v, bán kính u, bán kính v)` hoặc `('poly', [(u, v)...], độ rộng)`), `flat` san phẳng chỗ đặt vật chủ `(u, v, bán kính)` |
| `slab`, `under`, `plinth`, `ledge`, `groove`, `pillar`, `bowl`, `fire`, `top`, `xq`, `bank` | phiến ô cờ, gờ, rãnh sáng, trụ đèn, mặt bàn cờ tướng. **Giữ nguyên** nếu không chủ đích đổi. |
| `build` | hàm dựng dải cảnh |

## 5. Quy trình cho một sân

1. Đọc `fields/forest.py` (mẫu) và hàm `build_<mã>` cũ trong `field2.py` để biết sân đang có gì (vật chủ ở góc nào, vũng nước ở đâu).
2. Chọn mô hình trong `assets-src/index.txt`. Lên bố cục: **2 đến 3 vật chủ** (hai góc dưới, giữa dải dưới), **vật vừa** dọc hai dải bên (mỗi bên 4 đến 6 món, bên phải cao hơn bên trái), **thảm rải** (3 đến 6 loại nhỏ, tổng 60 đến 120 bản), vài **điểm màu** trái tông (hoa, nấm, đốm sáng).
3. Viết file sân, render thử, **mở ảnh ra xem**, sửa. Thường cần 3 đến 5 vòng. Lỗi hay gặp:
   - ảnh quét tối và xỉn: tăng `tune_materials` (độ sáng 1,4 đến 2,0), hoặc tăng `sun`, `world`;
   - vật quá nhỏ nhìn như rác: phóng to, bớt số lượng;
   - vật lơ lửng hoặc chôn mất: chỉnh `sink`, hoặc đặt `z`;
   - vật đè lên gờ đá hay ô cờ: dời ra ngoài (`|u| ≥ 4,7`, `v ≥ 4,7`), hoặc thu nhỏ;
   - dải cảnh trống một màu: thêm thảm rải và điểm màu.
4. So với bản cũ (`git show HEAD:public/img/kydao/fields2/<mã>-chess.webp`), đặt hai ảnh cạnh nhau: bản mới phải **rõ ràng đẹp hơn** và vẫn đúng chủ đề (tên sân, bảng màu trong `public/js/kydao-skins.js`). Không hơn thì **giữ bản cũ**. Bài học đợt T-210: đá quét thật màu be, xám làm sân Núi lửa và Sấm sét kém đi (mất hồ dung nham, mất gai đá đen, lệch tông), nên hai sân đó giữ bản dựng bằng mã. Mô hình quét thật hợp với sân nhiều cây cỏ, đá tự nhiên; sân cách điệu mạnh (lửa, sét, băng) cần mô hình cùng phong cách hoặc giữ dựng bằng mã.
5. Render bản cuối `both final`, kiểm `kb ≤ 255`, `burn_pct` gần 0, `lum_pct` lệch không quá 6 điểm so với bản cũ.
6. Ghi nguồn vào `public/img/NOTICE.txt` (mục 9), cập nhật `assets.json` cho đúng những mô hình thật sự dùng.

## 6. Dùng mô hình tự tải (Sketchfab, tự dựng…)

1. Tải bản **GLB** (hoặc FBX) về, đặt vào `assets-src/custom/`, đặt tên không dấu, không khoảng trắng, ví dụ `den-tho-co.glb`.
2. Chạy lại `list_assets.py`, tìm các dòng `custom:den-tho-co.glb | <tên phần> | …`.
3. Trong file sân: `kit.put('custom:den-tho-co.glb', '<tên phần>', u, v, cỡ)`.
4. Ghi vào `public/img/NOTICE.txt`: tên mô hình, tác giả, đường dẫn, giấy phép. **Chỉ dùng mô hình có giấy phép cho phép** (CC0, CC-BY; tránh NC vì chùa có nhận cúng dường). Mô hình CC-BY phải ghi công tác giả.
5. Nguồn tự tải không tải lại tự động được: lưu một bản ở nơi an toàn ngoài repo.

## 7. Thêm một sân hoàn toàn mới (ví dụ sân phong cách anime)

Ngoài file sân, một mã sân mới cần:

1. **Danh mục**: thêm mục vào `FIELDS` trong `public/js/kydao-skins.js` (`name`, `cry`, `sub`, `palette`, `fx`), tăng `?v=` của file này ở mọi trang HTML nạp nó. Máy chủ đọc chung danh mục nên mã mới tự hợp lệ; giá bán và khóa mở chỉnh ở trang quản trị (T-170).
2. **Cấu hình dựng**: trong file `fields/<mã>.py` khai báo cả mục mới, chép từ một sân gần giống rồi sửa: `FIELDS['<mã>'] = dict(FIELDS['forest'], world=…, sun=…, ground=…, slab=…, T=dict(FIELDS['forest']['T'], …), build=build_<mã>)`. `dict(...)` chỉ chép nông, nên muốn đổi địa hình phải tạo `T` mới như trên, nếu không sẽ sửa luôn địa hình của sân gốc.
3. **Ảnh và mô hình kiểu cũ** (dùng khi ảnh v2 chưa tải xong): `blender -b -P tools/blender/kydao/build.py -- <repo> <mã>` sinh `fields/<mã>.webp`, `thumbs/field-<mã>.webp`, `fields/<mã>.glb`.
4. **Huy hiệu** 256×256: `public/img/kydao/ui/crest-<mã>.webp`.
5. **Test**: chạy `npm test`; test nào liệt kê hay đếm sân thì cập nhật có chủ đích.
6. **Hiệu ứng khai mở** dùng `fx` có sẵn (`ember`, `ripple`, `leaf`, `snow`, `bubble`, `petal`, `spark`, `sand`); hiệu ứng mới là việc riêng ở `kydao-fx.js` và `board3d.mjs`.

**Về bản quyền khi làm sân theo một bộ truyện, phim:** nhân vật, biểu tượng, tên riêng của tác phẩm có chủ. Giấy phép CC trên trang tải mô hình chỉ là của người dựng, không bao gồm quyền với tác phẩm gốc. An toàn là làm sân **mang phong cách** (màu, ánh sáng, kiểu kiến trúc, không khí) mà không dùng nhân vật, logo, tên của tác phẩm; còn muốn dùng đúng tác phẩm thì chủ dự án phải tự quyết và chịu trách nhiệm. Về kỹ thuật, phong cách hoạt hình đạt được bằng: mô hình low-poly hoặc tô phẳng, `tune_materials` với độ rực cao (1,4 đến 1,8), `sun` gắt và `world` sáng để bóng rõ khối, bảng màu ít và tương phản mạnh.

## 8. Giao cho agent làm song song

- **Mỗi agent một sân, mỗi sân một file** `fields/<mã>.py`. Agent không sửa `field2.py`, không sửa file sân khác, không sửa `task.md`, không commit.
- Agent chỉ render **bản thử** vào thư mục riêng của mình. Bản cuối do điều phối render lần lượt (một card đồ hoạ, chạy chồng dễ hết bộ nhớ) sau khi đã xem ảnh thử.
- Agent không có mạng: điều phối tải nguồn và chạy `list_assets.py` trước.
- Điều phối xem ảnh từng sân, đối chiếu luật K5, rồi mới render bản cuối, ghi NOTICE, chạy `npm test`.
