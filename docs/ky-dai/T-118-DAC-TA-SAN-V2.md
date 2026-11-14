# Đặc tả T-118 · Sân v2: dựng cảnh 3D thật trong Blender (bản mẫu Hỏa Diệm Sơn)

> Lý do: chủ dự án chê sân v1 (13/11): nền chỉ là tấm vân phẳng, không có cảnh quanh bàn. Chuẩn chất lượng cần đạt: mức chi tiết của các sân đấu bài 3D thương mại (phiến đá từng ô có vát cạnh và vết nứt, địa hình, dung nham phát sáng, bóng đổ, cảnh vật bao quanh).
> **Chỉ lấy mức chi tiết làm chuẩn. Không chép bố cục, hoa văn, tượng hay biểu tượng của bất kỳ trò chơi nào.** Chủ đề là chùa Việt và thiên nhiên.
> Thẻ này chỉ làm **một sân mẫu `volcano`**. Chủ dự án duyệt ảnh rồi mới nhân ra 7 sân còn lại (T-118b).

## 1. Đầu ra

| File | Nội dung | Giới hạn |
|---|---|---|
| `public/img/kydao/fields2/volcano-chess.webp` | nửa sân + dải cảnh, **có** 8×4 phiến đá khớp ô cờ vua | 1408×704, ≤ 260 KB |
| `public/img/kydao/fields2/volcano-xiangqi.webp` | cùng cảnh, sàn là **một nền đá liền** (mã sẽ kẻ đường cờ tướng lên trên) | 1408×704, ≤ 260 KB |
| `tools/blender/kydao/field2.py` | script dựng cảnh + render, chạy lại được, có hạt giống cố định | — |
| `docs/ky-dai/anh/volcano-v2-*.jpg` | ảnh chụp các vòng lặp để điều phối soát | — |

Không sửa `build.py`, không sửa ảnh v1 trong `public/img/kydao/fields/`, không sửa mã JS.

## 2. Hệ toạ độ và khung hình (PHẢI đúng từng số, vì mã vẽ ô cờ đè lên ảnh)

- Blender, Z lên, đơn vị = 1 ô cờ.
- **Vùng bàn**: x ∈ [−4, 4], y ∈ [0, 4]. Đường giữa bàn ở y = 0. Mép người chơi ở y = 4.
- **Dải cảnh**: rộng 1,5 ở trái, phải và sau lưng người chơi. Toàn cảnh: x ∈ [−5,5; 5,5], y ∈ [0; 5,5].
- **Máy quay**: trực giao (ORTHO), nhìn thẳng xuống, đặt tại (0; 2,75; 20), `ortho_scale = 11`, xoay (0, 0, π) để **mép dưới ảnh là phía người chơi (y = 5,5)** và mép trên ảnh là đường giữa bàn (y = 0). Độ phân giải 1408×704 (128 px mỗi đơn vị).
- Kiểm bằng số sau khi render: ô cờ góc có tâm (−3,5; 0,5) phải rơi vào điểm ảnh quanh (1344−... ) — đừng tính tay; thay vào đó **đặt 4 khối lập phương đỏ nhỏ** ở 4 góc vùng bàn (±4; 0) và (±4; 4), render thử một tấm 352×176, đọc ảnh và xác nhận chúng nằm ở x = 1/7,33 và 6,33/7,33 chiều rộng (tức px 48 và 304 ở ảnh thử), y = mép trên và 128/176 chiều cao. Đạt rồi xoá 4 khối.
- Ánh sáng chính từ **góc trên-trái của ảnh**, bóng đổ ngắn (mặt trời cao khoảng 60°), để quân cờ vẽ đè lên sau này nhìn hợp.

## 3. Công thức dựng cảnh (làm theo thứ tự)

Làm trong một cảnh riêng tên `KyDaiV2` (không đụng cảnh khác đang mở). Mọi số ngẫu nhiên dùng `random.Random('field2:volcano')`.

### 3.1 Địa hình và dung nham (mẹo chính)

1. **Mặt dung nham**: một mặt phẳng phủ kín toàn cảnh ở z = −0,18. Vật liệu phát sáng: màu trộn theo Voronoi + Noise giữa cam `#ff5a1f`, vàng `#ffb347` và đỏ sẫm `#7a1408` (lớp vỏ nguội), cường độ phát sáng 6–10.
2. **Mặt đất đá**: lưới phủ toàn cảnh, chia nhỏ khoảng 220×110, dập nổi bằng modifier Displace với texture mây/Voronoi (hoặc tính bằng `mathutils.noise` trong bmesh) sao cho:
   - độ cao trong dải cảnh dao động từ −0,35 đến +0,45: **chỗ nào thấp hơn −0,18 thì dung nham tự lộ ra** thành hồ và sông;
   - bố cục có chủ ý, không rải đều: một **con sông dung nham** uốn lượn chạy dọc dải bên trái rồi vòng ra sau lưng người chơi, hai **hồ** ở hai góc sau, vài khe nứt nhỏ đâm về phía bàn;
   - trong vùng bàn và 0,25 quanh nó, ép độ cao về 0 (nhân với một mặt nạ mềm) để tạo **bệ đá phẳng** cho bàn.
3. Vật liệu đá: Principled, màu đá bazan `#2a1c18` → `#4a2c22` theo Noise, có Bump mạnh (Noise + Voronoi khoảng cách tới mép tạo vết nứt). Gần mép dung nham đá sáng lên màu cam (trộn theo độ cao: càng thấp càng ám cam) để có cảm giác bị nung.

### 3.2 Sàn bàn

- **Bản cờ vua** (`-chess`): 32 phiến đá riêng, mỗi phiến là khối hộp 0,94 × 0,94 × 0,14 đặt tâm tại (c − 3,5; r + 0,5; 0,07) với c = 0..7, r = 0..3. Bevel cạnh 0,035 (2 đoạn). Mỗi phiến lệch ngẫu nhiên rất nhẹ: cao ±0,012, nghiêng ±0,6°, xoay ±0,4°. Hai tông xen kẽ theo (c + r) chẵn/lẻ: phiến sáng `#b5643a` (đá nung), phiến tối `#3a1a14` (bazan). **Quy ước màu ô: ô có (c + r) lẻ là ô SÁNG khi c đếm từ trái ảnh và r đếm từ đường giữa** — sai một ô là cả bàn lệch màu, nên render thử rồi nhìn lại.
  Chi tiết phiến: Bump vết nứt (Voronoi), mép sứt; khoảng 6 phiến có **vết nứt phát sáng** (trộn Emission theo mặt nạ Voronoi mảnh). Khe giữa các phiến để lộ ánh cam từ bên dưới (đặt một mặt phẳng phát sáng yếu ở z = 0,005 dưới các phiến).
- **Bản cờ tướng** (`-xiangqi`): thay 32 phiến bằng **một tấm đá liền** 8,1 × 4,1 × 0,14 cùng chất liệu bazan sáng vừa (`#6a3a28`), có vân và vài vết nứt phát sáng mảnh, **không có lưới** (mã sẽ tự kẻ). Dải 0,5 sát đường giữa (y ∈ [0; 0,5]) là "bờ sông": đá sẫm hơn và ướt bóng hơn.
- Quanh bàn có **gờ đá** thấp (cao 0,2; rộng 0,18) ở ba phía trái, phải, sau lưng; mặt gờ khắc rãnh đơn giản; bốn góc gờ có **trụ đá vuông** nhỏ, trên mỗi trụ một bát lửa (nửa cầu + đốm phát sáng).

### 3.3 Cảnh vật trong dải (nhìn từ trên xuống phải đọc được hình)

Vì máy quay nhìn thẳng xuống, vật thể phải có **hình bóng rõ từ trên** và **đổ bóng**:
- 10–14 **tảng đá bazan** nhiều cỡ (icosphere chia 2, kéo méo, dập nhiễu), tụ thành cụm ở bờ sông dung nham.
- 2 **miệng núi lửa nhỏ** ở hai góc sau: vành đá tròn nổi cao 0,5, lòng trũng chứa dung nham sáng hơn (cường độ 12).
- 5–8 **mảnh đá vỏ chai** (khối tinh thể nhọn, đen bóng, roughness 0,1) cắm nghiêng.
- 1 **lư hương đá** hoặc **cột kinh đá** kiểu chùa Việt ở dải sau lưng (gợi chủ đề chùa; hình khối tự nghĩ, đơn giản).
- **Tàn lửa**: 40–60 đốm cầu nhỏ phát sáng lơ lửng z ∈ [0,2; 0,8], chỉ trong dải cảnh, **không** nằm trên vùng bàn.

### 3.4 Ánh sáng và render

- Engine **Cycles**, 96 mẫu, bật Denoise; nếu máy không có GPU và quá chậm (> 4 phút mỗi tấm) thì giảm còn 48 mẫu. Nếu Cycles không chạy được thì dùng EEVEE có bật bóng đổ + ambient occlusion và **ghi rõ trong báo cáo**.
- Mặt trời: năng lượng 2,5, màu ấm `#ffd9b0`, cao 60°, hướng từ góc trên-trái ảnh. World: xanh tím rất tối `#0c0a14`, cường độ 0,3 (để vùng tối có sắc lạnh, tương phản với dung nham).
- Compositor: Glare kiểu Bloom/Fog Glow, ngưỡng khoảng 1,0, để dung nham có quầng. View transform `Filmic` hoặc `AgX`, độ tương phản trung bình-cao.
- **Vùng bàn phải dễ đọc**: sau khi render, độ sáng trung bình của vùng bàn nằm trong khoảng 30–60% và không có mảng cháy trắng; dung nham sáng chói chỉ ở dải cảnh.
- Lưu `.webp` chất lượng 84; nếu vượt 260 KB thì hạ dần tới 76.

## 4. Vòng lặp chất lượng (bắt buộc)

Sau mỗi lần render: **đọc ảnh ra xem** (công cụ Read đọc được ảnh), tự chấm theo danh sách dưới, sửa script, render lại. Tối thiểu 3 vòng, tối đa 7 vòng. Lưu ảnh mỗi vòng vào `docs/ky-dai/anh/volcano-v2-vongN.jpg` (xuất thêm bản JPG nhỏ 704×352).

Danh sách tự chấm (đạt hết mới dừng):
1. Nhìn thoáng qua là biết "núi lửa", không cần đọc chữ.
2. Thấy rõ **ba lớp**: sàn bàn (phiến đá) / gờ và trụ / cảnh dung nham và đá.
3. Có **bóng đổ** thật và khối nổi; không còn cảm giác "tấm ảnh vân phẳng".
4. Sông dung nham có bố cục (uốn lượn, có hồ), không phải đốm rải đều.
5. 32 phiến đá thẳng hàng tuyệt đối với lưới 1 đơn vị (kiểm bằng 4 khối đỏ ở mục 2).
6. Hai tông ô cờ phân biệt rõ ngay cả khi thu ảnh còn 352 px ngang.
7. Vùng bàn không bị vật thể, tàn lửa hay quầng sáng che.
8. Không có lỗi hình học lộ liễu (mặt đen, khe hở, vật lơ lửng vô lý, răng cưa địa hình).

## 5. Báo cáo bàn giao

Theo mẫu `docs/agents/ORCHESTRATION.md` §6, thêm: engine và số mẫu đã dùng, thời gian render mỗi tấm, dung lượng 2 file `.webp`, số vòng lặp và điều đã sửa ở mỗi vòng, điểm nào trong danh sách tự chấm còn yếu. **Không commit** file `.blend`.
