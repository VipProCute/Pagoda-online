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

## Đài sen và vỏ khí vòng 3 (T-203, phần B)

`build_lotus.py` giữ bốn nút có gốc tại tâm và màu `COLOR_0`; ba tầng cánh dùng chung vật liệu `petal`. Mỗi cánh có viền giọt nước 16 đỉnh, vòng bụng 8 đỉnh và một tâm (25 đỉnh, 32 tam giác). Viền có chín mức dọc, bề rộng tỷ lệ với `u^1,1 × (1−u)`: bụng rộng nhất gần 52% chiều dài, hai cạnh cong lồi tới chóp nhọn mềm. Tỷ lệ chiều dài cung : rộng khoảng 1,70–1,72 ở cả ba tầng. Bỏ hoàn toàn sống gân hình học; độ khum ngang giới hạn bằng 16% bề rộng để cánh hẹp không gấp như giấy. Pháp tuyến lấy từ mặt cong liên tục qua đường giữa. Gân giữa sáng và hai gân phụ tối chỉ dùng màu đỉnh. Giữ màu vòng 2: gốc hổ phách `#c27a14`, thân vàng kim `#f2b02e`, mép vàng bão hòa `#ffca37`, chỉ pha tối đa 24% màu sáng `#ffe7a0` ở chóp; tầng trong sáng hơn tầng ngoài. Gương sen cũng dùng mép vàng bão hòa; giữ đèn bù và ánh sáng nền khi xem thử.

Tầng ngoài cong từ 23° lên 37° (trung bình 30°), tầng giữa từ 45° lên 57°, tầng trong từ 68° ± 2° khum vào tới khoảng 98° ± 2°. Gốc ba tầng lùi vào bán kính 0,190 / 0,205 / 0,220 m, cao −0,008 / 0,004 / 0,010 m; nằm dưới gương sen bán kính 0,264 m để che vòng gốc và tăng chồng mép tầng ngoài. Chiều dài cánh lần lượt 0,49 / 0,36 / 0,29 m. Đường kính dự kiến khoảng 1,23 m, cao khoảng 0,30 m; chóp ba tầng lần lượt khoảng 0,24 / 0,28 / 0,29 m. Gương sen 12 cạnh bỏ đáy khuất, sáu hạt chỉ tô màu đỉnh; không còn hốc hạt hình học. Ảnh xem giữ ba góc nghiêng và một góc từ trên.

| Nút | Số cánh | Tam giác dự kiến |
|---|---:|---:|
| `petals0` | 16 | 512 |
| `petals1` | 12 | 384 |
| `petals2` | 8 | 256 |
| `pod` | — | 48 (thành 24, mặt 24) |
| Tổng đài sen | 36 | 1.200 |

`build_aura.py` giữ một lưới/vật liệu `shell`, xuất `POSITION, NORMAL, TEXCOORD_0`. Lưới giọt lửa gồm 11 vòng × 20 cột, thêm cột nối UV tách đỉnh; không bịt đáy hay nắp trên. Giữ thân vòng 2: chân thu tròn (bán kính 0,30 m ở đáy, 0,37 m ở cao 0,10 m), bụng nở 0,52–0,51 m ở cao 0,55–0,90 m, vai thu còn khoảng 0,39 m ở cao 1,30 m. Năm vòng trên tạo sáu thùy rộng liền thân, xoắn cùng chiều; mỗi gốc phủ cung 60°, vai thùy dùng cả cung cos nâng cao. Hai thùy trước/sau cao 2,20 m, bốn thùy bên cao 2,14 m; khe nâng lên 1,80–1,86 m, sâu 0,28–0,34 m so với hai chóp kề. Nâng các thùy thấp để giữ khe nông ở mọi góc. Bán kính gốc thùy 0,33 m, mép khe trên 0,23 m, chóp 0,165 m; thu theo đường cong để giữ bụng rộng thay cho gai kim. Hàm chiều cao quanh vòng liên tục, không còn chọn chiều cao theo thùy gần nhất. Cột đặt đúng chóp/khe từng thùy: hai thùy cao có bốn cột, các thùy bên có ba cột. Tọa độ và pháp tuyến trùng nhau ở đường nối, `u` chạy quanh 0 → 1 theo góc thực, `v = z / 2,2` theo chiều cao Blender (sang glTF là Y).

Nút `shell` dự kiến **400 tam giác** (`10 × 20 × 2`), đúng ngân sách. Ảnh xem bốn góc dùng xanh phát sáng nhẹ, trong suốt và giảm đèn để thấy dáng lửa ôm người. Chạy thật (T-203): sen 1.200 tam giác, 40,4 KB; vỏ khí 400 tam giác, 10,9 KB.

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

## Ma Vương điêu khắc (T-154, vòng hình T-203)

`build_demon.py` dựng Ma Vương bằng mã theo lối điêu khắc rồi bake xuống lưới thấp, không dùng tài nguyên ngoài:

1. Khối nền (ellipsoid, ống quét Catmull-Rom) hợp bằng modifier Remesh voxel (1,6 cm, rồi 1,1 cm, rồi 0,72 cm), làm mượt Taubin, thêm khối cơ (ngực, bụng sáu múi, cơ thang dốc, lưng chữ V, delta, bắp tay, cẳng tay, gờ mày, mõm nhăn). Giữ cơ lưng/bả vai dẹt, 18 lượt Taubin có mặt nạ phía lưng (`mu=-0.48`), eo thon và rãnh sống lưng lõm. T-203: bán kính tay đọc từ `SPEC[4]['arm']['path']`, vai ×1,25, bắp tay ×1,3, cẳng tay dày dần về cổ tay; thêm hai khối cơ cẳng tay. Lòng bàn tay và bề dày ngón ×1,5, ngón và móng dài ×1,3, móng cong có một chóp thật. Đầu/mặt/tai/sừng nhỏ ×1,2 quanh cằm `(0,0,0.8)` để hốc miệng không khoét xuống ngực; cổ dày hơn, mào giữa thu ngắn để thấp hơn sừng lớn. Gốc sừng lớn đi theo sọ, ngọn giữ ~1,85 m. Boolean `EXACT` khoét hốc miệng đã tăng cùng đầu; mắt, miệng và trọng số đầu dùng tọa độ đổi ngược. Giữ nguyên vị trí, tên và cha con của 17 xương.
2. Khắc bằng numpy: vảy và da sần (Voronoi; vi vảy mặt nhẹ hơn 40%), rãnh giữa các khối cơ, nứt dung nham dài ngoằn ngoèo theo đường dẫn ở ngực/bụng/cẳng tay, vài nhánh Voronoi lớn kéo dài, hốc ba mắt. Da nền `#922326`, giảm bão hòa 8% trong sRGB, gờ cơ pha đỏ cam `#a43b29`, hốc tối hơn; mắt `#ffc23a`, nứt `#ff7a1a`; miệng đỏ đen, họng chỉ phát sáng nhẹ. Sừng lớn cong xoắn có vân vòng; mào bảy gai cao thấp khác nhau, cong ra sau, gốc chìm vào sọ. Giáp vai ba phiến đồng đỏ ×1,3, so le rõ hơn, viền vàng sẫm rộng có gờ nổi 7 mm và rãnh khắc sâu 9 mm, ba gai cong lớn mỗi bên. Ngực không có chuỗi đốt giáp. Đuôi là cột khói thuôn xoắn 1,25 vòng cùng hai lọn cuộn ngắn, không có vảy da; màu `#3a0e0c` → `#5a1814`, vài đốm than mờ `#ff5a1a` trên ảnh phát sáng.
3. Lưới thấp: thân hợp decimate về mục tiêu 1.500 tam giác, ưu tiên mặt trước (`DEC_HEAD=0.003` mặc định, gáy có trọng số gấp bốn; `DEC_FACTOR=1.0`), rồi bàn tay/cánh tay. `refine_head` dành thêm tối đa 518 tam giác cho các mặt lớn ở mặt trước và hàm dưới, mục tiêu `front_head_tris ≥ 900`. Vòng sửa thứ hai chuyển 96 tam giác từ sừng lớn/gai vai và 50 tam giác thân nền sang mặt. Dự tính phần phụ: sừng lớn 240, sừng nhỏ 112, tai 40, nanh/răng 128, lưỡi 16, ngón 300, móng 300, giáp vai 180, gai vai 96, vòng cổ tay 48, gai lưng 60, khói đuôi 102; tổng 1.622. Cộng tối đa 2.018 thân hợp và 360 lửa = 4.000; `demon_body` tối đa 3.640. Kiểm ngân sách trước bake; số thật sau decimate/xuất và số tam giác đầu/mặt trước nằm trong `RESULT`. Thân tô mượt, đặt pháp tuyến theo diện tích trước bake và giữ nguyên lúc xuất. UV thân chiếu phẳng theo cụm pháp tuyến, phần phụ UV phân tích, rồi xếp chung 512×512, khoảng cách đảo 0,016.
4. Bake: pháp tuyến và AO bằng Cycles (chọn-sang-hoạt-động, `cage_extrusion=0.065`, `max_ray_distance=0.13`, lan viền 8 px); màu và phát sáng lấy theo điểm gần nhất trên lưới cao, riêng ba mắt và lòng miệng tính thẳng theo vị trí điểm ảnh. Màu nhân AO. Ba ảnh JPEG giữ nguyên 512×512: màu/phát sáng chất lượng 88, pháp tuyến 97. Pháp tuyến ghi với `Non-Color`, phép biến đổi `Raw`, phơi sáng 0 và gamma 1 để giữ dữ liệu thô. Nếu GLB thật quá 598 KB, giảm màu/phát sáng xuống 85 trước, rồi mới giảm pháp tuyến lần lượt 96, 95, cuối cùng 94; luôn nén từ mảng nguồn, không nén chồng hay thu nhỏ ảnh (chừa 2 KB cho chuẩn hóa clip). Chạy thật (T-203): màu 46 KB, phát sáng 22 KB, pháp tuyến 160 KB, GLB 565 KB. `RESULT.texture_quality`, `normal_size`, `normal_jpeg_rmse` (ở chất lượng 97 ban đầu) và `glb_images` ghi chất lượng, kích thước, sai số, định dạng, dung lượng và hệ số lấy mẫu JPEG thật; kiểm tra vẫn nhận PNG/JPEG cho pháp tuyến, bắt sai kích thước 512 px; JPEG lấy mẫu màu 4:2:0 chỉ là cảnh báo vì Blender 5.3 không có tùy chọn 4:4:4. Vật liệu `demon_body` có màu, pháp tuyến, phát sáng, `emissiveFactor [1,1,1]`.
5. Lưới `demon_flame` vòng sửa thứ ba: tám ống lửa kín (bốn mỗi bên), gom thành hai cụm sau bả vai. Gốc bán kính 8,5–11 cm, eo thắt còn 3,8–4,7 cm, thân cong chữ S và xoắn theo chiều sâu, ngọn móc ngược vào trong. Lưỡi giữa cao nhất 1,84 m; lưỡi trong 1,62 m, lưỡi bên 1,63 m và lưỡi ngoài xòe thấp 1,29 m. Mỗi ống sáu cạnh; mỗi bên có ba ống bốn vòng và một chóp (48 tam giác/ống), một ống ngoài ba vòng và một chóp (36 tam giác): `2 × (3 × 48 + 36) = 360`. Giữ gắn xương `chest`, UV từng góc với đường nối `u` quanh ống 0 → 1, GLB có `v` = 0 ở gốc, 1 ở ngọn; mã game thay bằng shader lửa. Vật liệu xem thử chỉ vẽ mặt trước.

Vòng sửa thứ hai dựng sọ thành vòm tròn, bỏ khối trán ngang; mày là hai ống cong dày tạo chữ V, giữa thấp và đuôi vểnh về thái dương. Boolean khoét cả miệng rộng hơn cùng hai hốc mắt xếch và hốc mắt thứ ba; mắt hạnh nhân phát sáng ở sâu trong hốc, mắt giữa trán có gờ hạt dọc. Mũi bè, má gồ, mõm nhăn rộng và cằm rộng hơn; nanh/răng dưới, lưỡi đi theo hàm thấp hơn. Giữ màu, tay/bàn tay, giáp vai và lửa ống đã đạt vòng trước.

Vòng sửa thứ ba chỉ làm mượt mặt và đổi đường lửa như mục 5. `smooth_low_head` chạy sau decimate và `refine_head`: bốn lượt Taubin (`lam=0.4`, `mu=-0.42`), mặt nạ theo khoảng cách tới đoạn xương `head`, giảm dần ở viền đầu/hàm và mặt bên. Dịch do Taubin tối đa 12 mm, chiếu gần nhất về thân cao chưa khắc; bỏ điểm chiếu xa quá 25 mm hoặc có pháp tuyến trái hướng để giữ mày, hốc mắt và mõm. Nếu tam giác bị lật/xẹp thì giảm bước; `RESULT.head_smooth_vertices` và `head_smooth_max_mm` ghi mức tác động thực. Sừng, tai, nanh ghép sau nên không bị kéo; giữ pháp tuyến đỉnh mượt trước bake và lúc xuất. Không đổi ngân sách: thân hợp tối đa 2.018 + phần phụ 1.622 + lửa 360 = 4.000 tam giác. Chạy thật: `front_head_tris` 1.043, tổng 4.000 tam giác.

Hợp đồng với mã trình duyệt: lưới `demon_body` (`POSITION, NORMAL, TANGENT, TEXCOORD_0, JOINTS_0, WEIGHTS_0`) và `demon_flame`, 17 xương, 8 clip như bảng trên, gốc `root` ở thắt lưng, đỉnh sừng ~1,85 m, đuôi khói tới ~−1,12 m. Xuất `export_tangents=True` để giữ cơ sở MikkTSpace dùng khi bake; `check` bắt thiếu `TANGENT` ở cả hai lưới và in định dạng PNG/JPEG, kích thước điểm ảnh, số byte từng ảnh.
