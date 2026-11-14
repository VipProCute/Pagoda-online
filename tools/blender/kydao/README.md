# Dựng tài nguyên skin Kỳ Đài bằng Blender

`build.py` đọc danh mục `public/js/kydao-skins.js` (qua `node`) rồi dựng, chụp và xuất:

| Đầu ra | Nội dung |
|---|---|
| `public/img/kydao/fields/<id>.webp` | nền nửa sân nhìn từ trên xuống, 1024×512, mép dưới là mép người chơi |
| `public/img/kydao/thumbs/field-<id>.webp`, `pieces-<id>.webp` | ảnh xem trước 256×160 |
| `public/models/kydao/fields/<id>.glb` | bệ chữ U và đồ trang trí quanh nửa sân |
| `public/models/kydao/pieces/<id>.glb` | bộ quân, nút `K Q R B N P disc`, vật liệu `body` và `accent` |

Các file này **không sửa tay**. Muốn đổi thì sửa `build.py` hoặc danh mục rồi chạy lại.

## Cách chạy

Cần Blender 5.x và `node` trong PATH.

Từ dòng lệnh (không mở cửa sổ):

```
blender -b -P tools/blender/kydao/build.py -- <đường dẫn repo> [id ...]
```

Trong Blender đang mở (cửa sổ Python hoặc qua Blender MCP):

```python
import runpy
runpy.run_path(r'<repo>/tools/blender/kydao/build.py', init_globals={'REPO': r'<repo>', 'ONLY': None})
```

`ONLY = ['volcano', 'magma']` thì chỉ dựng lại các mã đó. Script làm việc trong cảnh riêng tên `KyDai`, không đụng cảnh đang mở.

## Quy ước

- Blender (Z lên): bàn rộng 8; nửa sân chiếm x ∈ [−4, 4], y ∈ [0, 4]; tâm bàn ở y = 0, mép người chơi ở y = +4. Sau khi xuất glTF (Y lên), mép người chơi quay về −Z.
- Quân: đáy ở cao độ 0, mọi quân nằm ở gốc toạ độ; mã tự đặt vị trí và tự tô màu theo `PIECES[id].a|b`.
- Mọi hình dựng bằng mã, có hạt giống ngẫu nhiên cố định theo mã skin, nên chạy lại ra cùng kết quả.
- Xem nhanh kết quả: mở `/kydao-skins-test.html` khi máy chủ đang chạy.

## Thêm một skin

1. Thêm mục vào `FIELDS` hoặc `PIECES` trong `public/js/kydao-skins.js`.
2. Sân: thêm một nhánh `fx` trong `ground_material` và `build_field` (hoặc dùng lại `fx` có sẵn). Quân: thêm một dòng vào `STYLE`.
3. Chạy lại script với mã mới; kiểm ngân sách ở `docs/KE-HOACH-KY-DAI.md` §4.5 (script in số tam giác và dung lượng).

## Atlas quân 2D (`pieces2d.py`, T-126a)

Render quân cờ 2D từ mô hình 3D của `build.py` (Cycles, 64 mẫu, nền trong suốt, siêu lấy mẫu 2x). Chạy trong Blender:

    import runpy; runpy.run_path(r'<repo>/tools/blender/kydao/pieces2d.py', init_globals={'REPO': r'<repo>', 'ONLY': ['magma']})

Tham số: `ONLY` (danh sách mã, mặc định cả 8 bộ), `PREVIEW` (24 mẫu, ảnh xem thử vào thư mục tạm, không đụng `public/`), `DOCS` (bộ được ghi thêm `docs/ky-dai/anh/quan-2d-<id>.jpg`), `SAMPLES`. Mỗi bộ mất khoảng một phút; gọi từng 1-2 bộ một lần. Bước ghép atlas gọi `python` hệ thống (cần Pillow).

Đầu ra `public/img/kydao/pieces2d/<id>.webp`: 896x256, lưới **7 cột x 2 hàng**, mỗi ô **128x128**, nền trong suốt.
- Hàng 0 = bên `a` (sáng), hàng 1 = bên `b` (tối). Cột: `K Q R B N P disc`.
- Quân cờ vua: nhìn từ phía trước chếch xuống 22 độ, 67 px/đơn vị mô hình, đáy quân ở y=118 (cách mép dưới 10 px), canh giữa theo chiều ngang. Chiều cao (kể cả thánh giá, chóp): K 108, Q 93, B 86, N 86, R 72, P 58 px. Mã quay mặt sang trái.
- `disc`: nhìn thẳng từ trên xuống, tâm ô, thân tròn đường kính 108 px (gai trang trí của magma, wood, ice, coral, storm nhô tới 122 px), mặt trên trống.
- Có bóng đổ mềm nhỏ dưới chân quân (alpha thấp, lệch sang trái ảnh). Không sửa tay atlas; sửa script rồi chạy lại.
