# Dựng pháp tướng 3D

Các kịch bản dựng mô hình bằng mã, không cần tài nguyên tải về. Không sửa tay `.glb`: sửa kịch bản rồi chạy lại Blender. Tọa độ Blender dùng Z lên, mặt nhìn −Y, đơn vị mét.

## Chạy không giao diện

Thay `<repo>` bằng đường dẫn tuyệt đối tới repo; chạy từng lệnh trong PowerShell:

```powershell
H:\blender.exe -b --python-expr "import runpy; runpy.run_path(r'<repo>\tools\blender\fx\build_demon.py', init_globals={'REPO': r'<repo>', 'OUT': ['glb','views','check']})"
H:\blender.exe -b --python-expr "import runpy; runpy.run_path(r'<repo>\tools\blender\fx\build_lotus.py', init_globals={'REPO': r'<repo>', 'OUT': ['glb','views','check']})"
H:\blender.exe -b --python-expr "import runpy; runpy.run_path(r'<repo>\tools\blender\fx\build_aura.py', init_globals={'REPO': r'<repo>', 'OUT': ['glb','views','check']})"
```

- `REPO` bắt buộc. `OUT` chọn `glb`, `views`, `check`; mặc định `['check']`. Kiểm tra sen và vỏ khí xuất GLB tạm để đọc thuộc tính đỉnh, không ghi vào repo.
- `PREVIEW=True` mặc định ghi ảnh vào `TMP`; `PREVIEW=False` ghi vào `docs/phap-tuong/anh/`. `TMP` mặc định là thư mục `phap_tuong` trong thư mục tạm hệ thống.
- Quỷ dùng thêm `LEVEL=4`; cấp khác dành cho T-145. Mỗi kịch bản tạo cảnh riêng, không lưu `.blend`.
- Ma Vương còn nhận `STAGE` (`'full'` mặc định; `'hi'` chỉ dựng lưới cao và chụp 8 ảnh xem nhanh; `'low'` dựng lưới thấp không bake) và `CLOSE=True` (thêm bốn ảnh cận 800×800 vào `TMP`). Ảnh thu 128 px (`ma-vuong-128px.jpg`, cạnh ảnh 2D gốc) ghi vào `TMP`.
- `glb` tạo `public/models/fx/demon-4.glb`, `lotus.glb`, `aura-kit.glb`. `views` tạo ảnh bốn góc tương ứng; quỷ có thêm ảnh tư thế. Sen có bốn ô 320×360: ba góc nghiêng 30° và một ô nhìn thẳng từ trên. Nếu đường dẫn thư mục tạm có dấu nháy đơn, truyền `TMP` là một thư mục không có dấu nháy.
- `check` in một dòng `RESULT` JSON gồm tam giác từng nút, tổng, kích thước GLB, xương, clip, nút, vật liệu, thuộc tính đỉnh đã xuất, cảnh báo và phần vượt ngân sách.

## Ngân sách

| Tài nguyên | Tam giác tối đa | GLB tối đa |
|---|---:|---:|
| Tiểu Quỷ | 1.200 | 120 KB |
| Ác Quỷ | 2.400 | 200 KB |
| Quỷ Vương | 3.000 | 240 KB |
| Ma Vương (có ảnh bake) | 4.000 | 600 KB |
| Đài sen | 1.200 | 60 KB |
| Bộ hào quang đầy đủ | 1.500 | 90 KB |
| Vỏ khí bản mẫu | 400 | thuộc bộ hào quang |
| Bộ pháp tướng công đức | 3.000 | 180 KB |

## Xương Ma Vương

| Nhánh | Xương theo thứ tự cha → con |
|---|---|
| Thân và đầu | `root` → `spine` → `chest` → `neck` → `head` → `jaw` |
| Tay trái | `chest` → `shoulder_L` → `upper_arm_L` → `forearm_L` → `hand_L` |
| Tay phải | `chest` → `shoulder_R` → `upper_arm_R` → `forearm_R` → `hand_R` |
| Đuôi | `root` → `tail1` → `tail2` → `tail3` |

Ma Vương không có xương cánh. Tên xương dùng dấu gạch dưới.

## Clip Ma Vương

| Clip | Thời lượng | Lặp | Tư thế |
|---|---:|---|---|
| `emerge` | 0,9 giây | Không | Xuất hiện, xòe tay |
| `idle` | 4 giây | Có | Thở, tay và đuôi đung đưa |
| `drift` | 1,6 giây | Có | Ngả trước, đuôi kéo sau |
| `scoff` | 2 giây | Có | Quay mặt đi, khoanh tay |
| `peek` | 2 giây | Có | Thò đầu qua vai |
| `taunt1` | 2 giây | Không | Gầm không tiếng, giơ vuốt |
| `taunt2` | 2 giây | Không | Nghiêng đầu, vươn tay |
| `vanish` | 0,6 giây | Không | Thu nhỏ, chìm xuống |

## Ma Vương điêu khắc (T-154)

`build_demon.py` dựng Ma Vương bằng mã theo lối điêu khắc rồi bake xuống lưới thấp, không dùng tài nguyên ngoài:

1. Khối nền (ellipsoid, ống quét Catmull-Rom) hợp bằng modifier Remesh voxel (1,6 cm, rồi 1,1 cm, rồi 0,72 cm), làm mượt Taubin, thêm khối cơ (ngực, bụng sáu múi, cơ thang dốc, lưng chữ V, delta, bắp tay, cẳng tay, gờ mày, mõm nhăn). Vòng 3: cơ lưng/bả vai dẹt, hộp sọ phía sau thu gọn; thêm 18 lượt Taubin có mặt nạ phía lưng (`mu=-0.48`) để hòa chỗ nối, giữ eo thon và rãnh sống lưng lõm. Trước remesh cuối, Boolean `EXACT` khoét hốc miệng elip có thành và đáy cong; lưỡi và nanh cong trên/dưới dựng riêng, chóp nanh dùng một đỉnh.
2. Khắc bằng numpy: vảy và da sần (Voronoi; vi vảy mặt nhẹ hơn 40%), rãnh giữa các khối cơ, nứt dung nham dài ngoằn ngoèo theo đường dẫn ở ngực/bụng/cẳng tay, vài nhánh Voronoi lớn kéo dài, hốc ba mắt. Da nền `#922326`, giảm bão hòa 18% trong sRGB, gờ cơ pha nâu, hốc tối hơn; mắt `#ffc23a`, nứt `#ff7a1a`; miệng đỏ đen, họng chỉ phát sáng nhẹ. Sừng lớn cong xoắn có vân vòng; mào bảy gai cao thấp khác nhau, cong ra sau, gốc chìm vào sọ. Giáp vai ba phiến đồng đỏ viền vàng sẫm có rãnh khắc và ba gai cong ra sau. Ngực không có chuỗi đốt giáp. Đuôi là cột khói thuôn xoắn 1,25 vòng cùng hai lọn cuộn ngắn, không có vảy da; màu `#2a0a0a` → `#4a1210`, vài đốm than mờ `#ff5a1a` trên ảnh phát sáng.
3. Lưới thấp: thân hợp decimate về mục tiêu 1.730 tam giác, ưu tiên mặt trước (`DEC_HEAD=0.010` mặc định, gáy có trọng số gấp bốn; `DEC_FACTOR=1.0`), rồi bàn tay/cánh tay. Phần phụ 2.056 tam giác (nanh 128, lưỡi 16, khói 180), lửa giữ 136; tổng mục tiêu 3.922 (thân `demon_body` 3.786), kiểm ngân sách trước bake. Số thật sau decimate/xuất và số tam giác đầu/mặt trước nằm trong `RESULT`. Thân tô mượt, đặt pháp tuyến theo diện tích trước bake và giữ nguyên lúc xuất. Trọng số xương theo vùng. UV: thân chiếu phẳng theo cụm pháp tuyến, phần phụ UV phân tích, rồi xếp chung 512×512.
4. Bake: pháp tuyến và AO bằng Cycles (chọn-sang-hoạt-động); màu và phát sáng lấy theo tia vào lưới cao, riêng ba mắt và lòng miệng tính thẳng theo vị trí điểm ảnh (nên không lệch hốc mắt). Màu nhân AO. Ba ảnh JPEG nhúng vào GLB; vật liệu `demon_body` có màu, pháp tuyến, phát sáng, `emissiveFactor [1,1,1]`.
5. Lưới `demon_flame`: sáu dải lửa cong xoắn, gốc lùi sau vai, gắn xương `chest`, UV `v` = 0 ở gốc, 1 ở ngọn; mã game thay bằng shader lửa.

Hợp đồng với mã trình duyệt: lưới `demon_body` (`POSITION, NORMAL, TEXCOORD_0, JOINTS_0, WEIGHTS_0`) và `demon_flame`, 17 xương, 8 clip như bảng trên, gốc `root` ở thắt lưng, đỉnh sừng ~1,85 m, đuôi khói tới ~−1,12 m. `check` in thêm số ảnh nhúng, kích thước điểm ảnh và số byte từng ảnh.
