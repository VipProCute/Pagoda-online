# Đặc tả T-118b · Sân v2: chỉnh Hỏa Diệm Sơn và dựng 7 sân còn lại

> Tiếp nối T-118 (`tools/blender/kydao/field2.py` đã dựng được `volcano`). Thẻ này biến `field2.py` thành script **theo chủ đề** và ra đủ 8 sân × 2 bản (cờ vua, cờ tướng).
> Giữ nguyên toàn bộ §2 của [T-118-DAC-TA-SAN-V2.md](T-118-DAC-TA-SAN-V2.md) (toạ độ, khung hình 1408×704, máy quay, hướng sáng) và vòng lặp chất lượng §4 (xem ảnh, tự chấm 8 điểm, sửa, render lại).
> **Không chép** bố cục, hoa văn, tượng hay biểu tượng của bất kỳ trò chơi nào.

## 1. Sửa chung (áp cho mọi sân, kể cả `volcano`)

Điều phối soát ảnh `volcano` vòng 3 và yêu cầu:

1. **Màu ô cờ vua**: đảo `LIGHT_PARITY`. Chuẩn: **ô góc trái-dưới của ảnh (phía người chơi) là ô TỐI**.
2. **Bỏ các vết nứt phát sáng dạng nét mảnh thẳng** trên phiến đá và tấm cờ tướng (trông như nét vẽ vector). Thay bằng: ánh sáng lọt **qua khe giữa các phiến** và 3–5 vết nứt **đi theo đúng vết nứt của Bump** (cùng texture), rộng không đều, mép mềm.
3. **Ô sáng không được phẳng**: thêm vân, vết mòn, mép sứt như ô tối; hai tông vẫn phải tách rõ khi thu ảnh còn 352 px ngang.
4. **Cảnh vật trong dải phải to và rõ hơn**: vật chính của chủ đề cao/rộng tối thiểu 0,8 đơn vị, có vùng sáng riêng (đèn điểm hoặc phát sáng) để không chìm trong bóng. Mỗi sân có **2 vật điểm nhấn** ở hai góc sau và **1 vật thờ kiểu chùa Việt** ở giữa dải sau lưng (lư hương, cột kinh, đèn đá, tượng linh thú đơn giản…; mỗi sân một kiểu).
5. **Bản cờ tướng**: dải y ∈ [0; 0,5] sát đường giữa là **bờ sông** của chủ đề đó (sỏi, cát ướt, cỏ lau, băng mỏng…), vì mã sẽ vẽ dòng sông ở giữa bàn. Phần còn lại là nền liền, vân nhẹ, **không có** hoạ tiết sáng chói (đường kẻ cờ tướng phải đọc được).
6. Vùng bàn: độ sáng trung bình 35–60%, không cháy trắng, không vật thể hay hạt nào che.
7. Mạch gạch của bệ: bỏ kiểu "lưới tường"; dùng phiến đá lát cỡ lớn không đều.

## 2. Tám chủ đề

Màu chủ đạo lấy từ `palette` trong `public/js/kydao-skins.js` (đọc qua `node` như `build.py`). Mỗi dòng: nền dải cảnh · hai tông phiến cờ vua · vật điểm nhấn · chi tiết động (tĩnh trong ảnh).

| Mã | Dải cảnh | Phiến sáng / tối | Điểm nhấn hai góc | Chi tiết |
|---|---|---|---|---|
| `volcano` | sông và hồ dung nham, đá bazan (đã có) | đá nung cam / bazan đen | miệng núi lửa | tàn lửa |
| `river` | dòng nước trong chảy quanh bàn (mặt nước thật: trong, phản sáng, thấy sỏi dưới đáy), bãi sỏi, lau sậy | đá cuội xám xanh nhạt / đá xanh rêu sẫm | cối xay nước nhỏ; thuyền nan cột ở bờ | lá trôi, gợn sóng |
| `forest` | thảm rêu, rễ cây bò vào mép bàn, dương xỉ, nấm | đá lát phủ rêu nhạt / gỗ mục sẫm | gốc cổ thụ có hốc sáng đom đóm; tảng đá phủ rêu | lá rụng, đom đóm |
| `glacier` | băng nứt, tuyết đùn, nước băng xanh sẫm lộ ở khe | băng trắng xanh / băng sẫm trong | cụm tinh thể băng lớn; hang băng nhỏ | hạt tuyết lấp lánh |
| `ocean` | đáy biển: cát, san hô, rong, vệt nắng xuyên nước (caustic) phủ lên mọi thứ | đá san hô nhạt / đá xanh thẫm | rạn san hô lớn; vỏ sò khổng lồ có ngọc phát sáng | bọt khí |
| `lotus` | hồ sen: mặt nước phẳng tối, lá sen lớn, hoa sen hồng nở, cá chép bơi dưới nước | đá cẩm thạch hồng nhạt / gỗ gụ đỏ sẫm | tòa sen lớn nở; đèn hoa đăng thả nước | cánh sen rơi |
| `thunder` | đỉnh núi đá trên biển mây: mây giông tím cuộn quanh, đá nhọn | đá phiến xám tím nhạt / đá đen tím | cột đá thu lôi có tia sét phát sáng; chuông đồng | đốm điện |
| `desert` | cồn cát gợn sóng, đá sa thạch phong hoá, ốc đảo nhỏ | sa thạch vàng nhạt / sa thạch nâu đỏ | trụ đá phong hoá; ốc đảo có nước xanh và cây | bụi cát |

Vật thờ ở giữa dải sau lưng: `volcano` lư hương đá · `river` cầu đá cong nhỏ · `forest` miếu thổ thần gỗ · `glacier` tháp đá nhỏ phủ tuyết · `ocean` chuông đồng chìm phủ hà · `lotus` đèn đá chùa · `thunder` cột kinh · `desert` tháp gạch nhỏ.

## 3. Cấu trúc script

- `field2.py` nhận `FIELD` (mã sân, hoặc `'all'`), `VARIANT` (`chess` | `xiangqi` | `both`), `PREVIEW`.
- Tách phần dùng chung (cảnh, máy quay, ánh sáng, bệ, gờ, trụ, 32 phiến, tấm cờ tướng, render, đo độ sáng) khỏi phần theo chủ đề: mỗi chủ đề một hàm `theme_<mã>(ctx)` dựng địa hình, vật liệu nền, vật điểm nhấn, hạt.
- Mẹo "địa hình dập nổi + mặt phẳng chất lỏng ở cao độ cố định" của `volcano` dùng lại cho `river` (nước), `glacier` (nước băng), `lotus` (hồ), `desert` (ốc đảo), `ocean` (không cần chất lỏng: dùng đèn có texture caustic chiếu xuống).
- Ánh sáng theo chủ đề: `volcano`, `thunder` nền tối; `river`, `forest`, `lotus`, `desert` ban ngày ấm; `glacier` ban ngày lạnh; `ocean` xanh lam có caustic. Hướng nắng vẫn từ góc trên-trái ảnh.
- Mỗi lần gọi Blender chỉ render **một** ảnh (render 96 mẫu mất khoảng 60 giây; gọi theo lô sẽ quá thời gian chờ của công cụ).

## 4. Đầu ra

- `public/img/kydao/fields2/<mã>-chess.webp` và `<mã>-xiangqi.webp` cho 8 mã (16 ảnh, mỗi ảnh ≤ 260 KB).
- `docs/ky-dai/anh/v2-<mã>.jpg`: bản thu nhỏ 704×352 của ảnh cờ vua cuối cùng, mỗi sân một tấm.
- Thứ tự làm: sửa `volcano` trước (xác nhận 7 điểm ở §1), rồi `river`, `forest`, `glacier`, `ocean`, `lotus`, `thunder`, `desert`. **Commit sau mỗi sân** (để nếu hết hạn mức giữa chừng thì phần đã xong không mất).
- Mỗi sân tối thiểu 2 vòng xem-sửa, tối đa 4.

## 5. Báo cáo

Theo mẫu `docs/agents/ORCHESTRATION.md` §6, thêm bảng: sân · dung lượng 2 ảnh · độ sáng vùng bàn · số vòng · điểm còn yếu. Nếu dừng giữa chừng, ghi rõ sân nào đã xong, sân nào chưa.
