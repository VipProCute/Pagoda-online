# T-208 · Đặc tả: tài nguyên bàn và quân MẶC ĐỊNH dựng từ mô hình, texture CC0

> **Kết quả (15/11):** thợ gpt-6.1-terra không ghi được file (công cụ vá của Codex CLI lỗi), điều phối tự viết `tools/blender/kydao/classic.py` theo đặc tả này. Lệch so với đặc tả: vua cao **1,58** (bằng bộ quân dựng bằng mã) thay vì 1,50; hai mặt bàn ghép thẳng từ ảnh vân gỗ bằng numpy, không render Cycles; đóng gói atlas bằng numpy trong Blender, không cần Pillow.

> Thợ làm đúng từng bước. Chỉ tạo file mới liệt kê ở mục 2. **Không** sửa file JS, không sửa `field2.py`, `build.py`, `pieces2d.py`, `stones.py`, không đụng `task.md`, không commit.

## 1. Bối cảnh

Bàn cờ mặc định (chưa chọn skin) đang vẽ hoàn toàn bằng mã nên xấu. Chủ dự án muốn thay bằng tài nguyên dựng từ mô hình thật. Thẻ này chỉ **sinh file tài nguyên** bằng Blender. Thẻ T-209 (người khác làm, song song) viết mã nạp các file này. Hai thẻ khớp nhau qua **đúng tên file và định dạng ở mục 3**, không được đổi.

Nguồn đã tải sẵn (CC0, Poly Haven), nằm ngoài git:

- `assets-src/polyhaven/chess_set/chess_set.gltf`: bộ cờ vua cẩm thạch. Object: `board`, `piece_king_white`, `piece_queen_white`, `piece_rook_white_01`, `piece_bishop_white_01`, `piece_knight_white_01`, `piece_pawn_white_01` (và bản `_black` tương ứng). Đơn vị mét, quân vua cao khoảng 0,09 m. Vật liệu: `chess_set_pieces_white`, `chess_set_pieces_black`, `chess_set_board`.
- `assets-src/polyhaven-tex/<id>/<id>_{diff,nor_gl,rough}.jpg` (2k) với `<id>` là: `oak_veneer_01` (gỗ sáng), `american_walnut_veneer` (gỗ tối), `rosewood_veneer1`, `cherry_veneer`, `ash_veneer`.

Blender 5.3 ở `H:\blender.exe` (trong Git Bash là `/h/blender.exe`), không có trên PATH. Chạy không giao diện:

```bash
/h/blender.exe -b --factory-startup -P tools/blender/kydao/classic.py -- "<đường dẫn repo kiểu Windows>"
```

Nếu sandbox không cho chạy Blender: **dừng thử lại**, viết xong script cho thật cẩn thận và ghi rõ trong báo cáo là chưa chạy được, điều phối sẽ chạy.

## 2. File được tạo

| File | Ghi chú |
|---|---|
| `tools/blender/kydao/classic.py` | script duy nhất, chạy lại được, hạt giống cố định, không lưu `.blend` |
| `public/models/kydao/pieces/classic.glb` | sinh bởi script |
| `public/img/kydao/pieces2d/classic.webp` | sinh bởi script |
| `public/img/kydao/boards/chess.webp` | sinh bởi script (thư mục mới) |
| `public/img/kydao/boards/xiangqi.webp` | sinh bởi script |
| `docs/ky-dai/anh/classic-xem-nhanh.jpg` | ảnh ghép xem nhanh cho điều phối (atlas + hai mặt bàn thu nhỏ) |

Đọc trước để theo đúng quy ước: `tools/blender/kydao/pieces2d.py` (toàn bộ, 235 dòng: máy quay, kích thước ô, cách ghép atlas, cách lưu webp) và trong `tools/blender/kydao/build.py` các hàm `export_glb`, `piece`, `piece_materials`, `tris`.

## 3. Hợp đồng định dạng (bắt buộc đúng)

### 3.1 `classic.glb` (quân 3D)

- Bảy nút gốc tên đúng: `K`, `Q`, `R`, `B`, `N`, `P`, `disc`. Mỗi nút là **một** lưới (gộp nếu cần), không có nút cha.
- Sáu quân cờ vua lấy từ bản `_white` của `chess_set` (hình hai màu giống nhau, màu do game tô). `disc` tự dựng: đĩa gỗ tiện tròn, bán kính 0,44, cao 0,18, mép bo, **mặt trên phẳng**, có một rãnh tròn nông gần mép.
- Toạ độ sau khi xuất glTF (+Y lên): đáy quân ở Y = 0, tâm ở X = Z = 0. Vua cao **1,50**, các quân khác giữ đúng tỉ lệ gốc so với vua (tức nhân chung một hệ số). Bề ngang lớn nhất mỗi quân ≤ 0,88; nếu quân nào rộng hơn thì thu nhỏ riêng quân đó cho vừa.
- Hướng: đầu Mã quay về **+Z** của glTF. Kiểm lại hướng của Mã trong `build.py` (hàm `piece`, nhánh `N`) và làm giống.
- Vật liệu: mỗi lưới đúng một vật liệu tên `body` (game thay vật liệu theo tên, mọi texture bị bỏ). **Không nhúng ảnh** vào glb.
- Giảm lưới bằng modifier Decimate (collapse), giữ pháp tuyến mượt (shade smooth, auto smooth nếu cần). Ngân sách: **tổng 7 nút ≤ 9.000 tam giác**, file ≤ 300 KB. Gợi ý chia: K 1.500, Q 1.400, R 1.200, B 1.300, N 1.700, P 900, disc 400.
- Xuất bằng đúng tham số của `export_glb` trong `build.py` (có `export_apply=True`).

### 3.2 `pieces2d/classic.webp` (atlas quân 2D)

Theo đúng `pieces2d.py`: ảnh **896×256**, nền trong suốt, ô 128×128, **hàng 0 = bên a (sáng), hàng 1 = bên b (tối)**, cột theo thứ tự `K Q R B N P disc`. Sáu ô cờ vua: nhìn trực giao chếch 22° từ phía trước, 67 px mỗi đơn vị, đáy quân ở y = 118 của ô. Ô `disc`: nhìn thẳng từ trên, thân đĩa đường kính 108 px, **không vẽ chữ** (chữ do game vẽ đè).

Khác với skin thường: ở đây render bằng **Cycles với texture thật** cho đẹp.

- Quân cờ vua: dùng lưới gốc chưa giảm, vật liệu gốc của `chess_set` (bên a: `chess_set_pieces_white`, bên b: `chess_set_pieces_black`), đã chuẩn hoá kích thước như mục 3.1.
- Đĩa: vật liệu gỗ từ `ash_veneer` (màu, pháp tuyến, độ nhám). Hàng a giữ màu gỗ sáng; hàng b cùng hình, nhân màu tối hơn khoảng 12% và ấm hơn một chút. Mặt đĩa phải đủ sáng để chữ đỏ `#9e2420` và chữ đen `#211d18` đọc rõ (độ tương phản ≥ 4,5).
- Ánh sáng: một đèn chính trái-trên, một đèn phụ dịu, nền trong suốt (`film_transparent`), có bóng tiếp xúc mờ dưới chân quân nằm gọn trong ô.
- Quân bên b phải **tối rõ** nhưng còn thấy khối (không thành mảng đen): nếu vật liệu đen gốc quá tối, nâng sáng 15 đến 25%.
- Dung lượng ≤ 120 KB (hạ chất lượng webp nếu vượt, không dưới 72).

### 3.3 `boards/chess.webp` (mặt 64 ô cờ vua)

- Ảnh **1024×1024**, không trong suốt, phủ **đúng vùng 8×8 ô**, mỗi ô đúng 128×128 px, không có khung, không có chữ.
- Ô **trên-trái là ô SÁNG**; ô (hàng r, cột c) tính từ trên-trái là sáng khi `(r + c) % 2 == 0`.
- Ô sáng: `oak_veneer_01`. Ô tối: `american_walnut_veneer`. Mỗi ô lấy một mảnh vân khác nhau (dịch và xoay 0°/90° UV ngẫu nhiên theo hạt giống cố định) để không lặp. Giữa các ô có khe ghép rất mảnh (1 đến 2 px, tối). Mặt gỗ phủ bóng nhẹ.
- Cách dựng chắc chắn nhất: 64 tấm phẳng 1×1 đặt đúng lưới, máy quay trực giao nhìn thẳng xuống, `ortho_scale = 8`, render 1024×1024 bằng Cycles, đèn đều (không bóng đổ dài, không loé).
- Tương phản: độ sáng trung bình ô sáng ≥ 2,2 lần ô tối. Quân trắng ngà và quân đen đều phải nổi trên cả hai loại ô: ô sáng không sáng hơn `#e8d2a6`, ô tối không tối hơn `#5a3a22` (tính trung bình ô).
- Dung lượng ≤ 180 KB.

### 3.4 `boards/xiangqi.webp` (mặt gỗ bàn cờ tướng)

- Ảnh **1152×1280** (tỉ lệ 9:10), không trong suốt: **chỉ là mặt gỗ**, không kẻ lưới, không sông, không chữ (game tự kẻ lưới màu `#5b3a1c` và vẽ sông đè lên).
- Vật liệu: `cherry_veneer`, vân chạy dọc, sáng và ấm (trung bình gần `#e2bc82`, không tối hơn `#c9a066`) để nét lưới và quân đọc rõ. Viền tối dần rất nhẹ ở bốn mép (tối đa 8%).
- Dung lượng ≤ 160 KB.

### 3.5 Ảnh xem nhanh

`docs/ky-dai/anh/classic-xem-nhanh.jpg`, rộng 1400: atlas quân đặt trên nền xám `#808080` (để thấy cả quân sáng lẫn tối), bên dưới là hai mặt bàn thu nhỏ đặt cạnh nhau.

## 4. Cấu trúc script

`classic.py` nhận đường dẫn repo sau `--`, làm việc trong cảnh riêng, dọn dữ liệu mồ côi đầu mỗi lần chạy, và in đúng một dòng cuối:

```
RESULT {"glb":{"tris":{"K":..,"Q":..,...,"total":..},"kb":..},"atlas":{"kb":..},"chess":{"kb":..,"light":"#rrggbb","dark":"#rrggbb"},"xiangqi":{"kb":..,"mean":"#rrggbb"}}
```

Trong đó `light`, `dark`, `mean` là màu trung bình đo lại từ ảnh đã lưu (đọc ảnh bằng `bpy.data.images.load`, lấy trung bình vùng tương ứng, đổi về sRGB). Script tự `raise SystemExit` kèm lý do nếu vượt bất kỳ ngân sách nào ở mục 3.

Thiếu file nguồn thì báo: `Thiếu nguồn: chạy node tools/blender/kydao/fetch-assets.js classic textures`.

Chú thích trong mã bằng tiếng Việt có dấu, lưu UTF-8.

## 5. Tự kiểm trước khi báo xong

1. Chạy script, dán dòng `RESULT` vào báo cáo.
2. Mở lại `classic.glb` bằng Blender (`bpy.ops.import_scene.gltf`) và in: tên 7 nút, số tam giác từng nút, hộp bao (min/max) từng nút, tên vật liệu. Xác nhận đáy ở 0, vua cao 1,50, bề ngang ≤ 0,88, Mã quay +Z.
3. Xem `classic-xem-nhanh.jpg` (nếu công cụ của bạn xem được ảnh) và sửa nếu: quân bị cắt mép ô, quân lệch đáy, bên b thành mảng đen, ô cờ lệch lưới, ô trên-trái không phải ô sáng.
4. Không còn file rác ngoài danh sách ở mục 2.

## 6. Báo cáo

Viết ngắn: đã tạo file nào, dòng `RESULT`, kết quả mục 5.2, điều gì chưa làm được và vì sao. Không tự khen, không sửa ngoài phạm vi.
