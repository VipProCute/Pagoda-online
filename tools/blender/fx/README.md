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
- `glb` tạo `public/models/fx/demon-4.glb`, `lotus.glb`, `aura-kit.glb`. `views` tạo ảnh bốn góc tương ứng; quỷ có thêm ảnh tư thế. Sen có bốn ô 320×360: ba góc nghiêng 30° và một ô nhìn thẳng từ trên. Nếu đường dẫn thư mục tạm có dấu nháy đơn, truyền `TMP` là một thư mục không có dấu nháy.
- `check` in một dòng `RESULT` JSON gồm tam giác từng nút, tổng, kích thước GLB, xương, clip, nút, vật liệu, thuộc tính đỉnh đã xuất, cảnh báo và phần vượt ngân sách.

## Ngân sách

| Tài nguyên | Tam giác tối đa | GLB tối đa |
|---|---:|---:|
| Tiểu Quỷ | 1.200 | 120 KB |
| Ác Quỷ | 2.400 | 200 KB |
| Quỷ Vương | 3.000 | 240 KB |
| Ma Vương | 4.000 | 300 KB |
| Đài sen | 900 | 60 KB |
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