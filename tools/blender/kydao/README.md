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
