# tuvi-crosscheck

Đối chiếu `public/js/tuvi.js` với thư viện `iztro` (MIT, trường phái Trung Quốc). Chỉ dùng khi phát triển; **không** thêm `iztro` vào `package.json`.

```
mkdir /tmp/iztro && cd /tmp/iztro && npm i iztro          # cài tạm, ngoài repo
node tools/tuvi-crosscheck/index.js --iztro /tmp/iztro/node_modules/iztro --n 10000 --seed 1
```

- Đưa vào `iztro` **ngày âm + giờ** (`byLunar`), không đưa ngày dương: `iztro` đổi lịch theo UTC+8 nên lệch lịch Việt Nam ở một số ngày.
- So 14 chính tinh, cung Mệnh, cung Thân, Cục. Bỏ qua tháng nhuận.
- Chưa chạy được ở T-054 (máy thợ không cài được `iztro` ngoài repo). Tên trường của `iztro` (`palaces[].majorStars`, `earthlyBranchOfSoulPalace`, `fiveElementsClass`) viết theo tài liệu, cần chạy thử và chỉnh nếu khác.

## Khác biệt có chủ đích (dự kiến, ghi lại khi chạy thật; bản chính thức ở `docs/TU-VI-QUY-UOC.md` của T-055)

- Chính tinh, Mệnh, Thân, Cục: hai trường phái dùng cùng công thức, phải khớp 100% khi cùng ngày âm + giờ.
- Hỏa Tinh / Linh Tinh: Việt dùng theo hướng thuận/nghịch của Âm Dương Nam Nữ, Trung Quốc khác (`iztro` không so ở đây).
- Tứ Hóa can Canh, Khoa của can Nhâm (Tả Phù, mặc định; có `options.nhamKhoa: 'thienphu'`), Thiên Khôi/Việt của Canh, Tân: chọn theo Phụ lục B của kế hoạch.
- Giờ Tý 23h: mặc định tính sang ngày sau; `iztro` có timeIndex riêng cho giờ Tý muộn.
