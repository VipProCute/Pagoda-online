# Tử Vi Quy Ước · Mã dữ liệu, bảng đối chiếu, điểm khác trường phái

> Thẻ T-055. Theo KH §7.3 và Phụ lục B (`docs/KE-HOACH-DOT-2026-11.md`), D11: trường phái Việt Nam (Thái Thứ Lang).
> **Trạng thái:** phần tra nguồn và bảng đã xong. Phần 👤 (đối chiếu 12 lá số với hai công cụ tử vi Việt) **chưa làm**: `test/fixtures/tuvi-golden.json` hiện là lá số của iztro, `verifiedByVietTools: false`. Thẻ chưa được đóng cho tới khi chủ dự án (hoặc người được nhờ) làm xong bước đó (mục 6).
> Ngày truy cập mọi trang web: **2026-11-12**. Không chép câu chữ sách; chỉ lấy dữ kiện (vị trí sao, tên sao).

## 1. Mã dữ liệu (theo Phụ lục B)

Chỉ số: Tý = 0 … Hợi = 11; Giáp = 0 … Quý = 9.

### 1.1 12 cung (đi nghịch từ Mệnh)

Cung chức thứ `i` nằm ở chi `(chi Mệnh − i) mod 12`. Mã theo thứ tự: `menh`, `phumau`, `phucduc`, `dientrach`, `quanloc`, `nopboc`, `thiendi`, `tatach`, `taibach`, `tutuc`, `phuthe`, `huynhde`.

### 1.2 14 chính tinh

`tuvi`, `thienco`, `thaiduong`, `vukhuc`, `thiendong`, `liemtrinh`, `thienphu`, `thaiam`, `thamlang`, `cumon`, `thientuong`, `thienluong`, `thatsat`, `phaquan`.

### 1.3 Phụ tinh, Tràng Sinh, độ sáng, Cục

- Phụ tinh: `taphu`, `huubat`, `vanxuong`, `vankhuc`, `thienkhoi`, `thienviet`, `locton`, `kinhduong`, `dala`, `thienma`, `hoatinh`, `linhtinh`, `diakhong`, `diakiep`, `hoaloc`, `hoaquyen`, `hoakhoa`, `hoaky`, `tuan`, `triet`, `daohoa`, `hongloan`, `thienhy`, `thienhinh`, `thiendieu`, `thaitue`.
- Tràng Sinh: `trangsinh`, `mocduc`, `quandoi`, `lamquan`, `devuong`, `suy`, `benh`, `tu`, `mo`, `tuyet`, `thai`, `duong`.
- Độ sáng: `M`, `V`, `D`, `B`, `H`; nhóm `sang` (M, V, D), `toi` (B, H).
- Cục: `thuy2`, `moc3`, `kim4`, `tho5`, `hoa6`.

## 2. Bảng đối chiếu

### 2.1 Độ sáng 14 chính tinh × 12 địa chi (bảng của game)

Nguồn Việt thứ nhất (**chọn làm gốc**, theo D11): bài "14 chính tinh", Dương Lương, hocvienlyso.org, 17/8/2022, https://hocvienlyso.org/14-chinh-tinh.html (cuối bài ghi chép lại từ soncd.wordpress.com). Bản chép lại giống từng chữ: tuvihiendai.vn, "14 chính tinh", 26/08/2020, https://tuvihiendai.vn/hoc_tu_vi/14-chinh-tinh/ (không nêu tác giả). Hai trang này tuyên bố theo hệ Thái Thứ Lang nhưng **không nêu số trang** của *Tử Vi Đẩu Số Tân Biên* (Vân Đằng Thái Thứ Lang, Sài Gòn, 1956); thợ không đọc được văn bản PDF Tân Biên (tệp quét), nên chưa đối chiếu trực tiếp trang sách. Điểm chắc: Thất Sát (Miếu Dần Thân Tý Ngọ, Vượng Tỵ Hợi, Đắc Sửu Mùi, Hãm Mão Dậu Thìn Tuất) khớp trích dẫn Thái Thứ Lang ở sonchu.vn, "Chương 21: Thuyết Miếu Hãm của các tinh diệu", https://sonchu.vn/2022/08/15/chuong-21-thuyet-mieu-ham-cua-cac-tinh-dieu/.
Nguồn Việt thứ hai (tách Miếu/Vượng): các trang trích Tân Biên cho Thiên Cơ (Miếu Thìn Tuất Mão Dậu, Vượng Tỵ Thân, Đắc Tý Ngọ Sửu Mùi, Hãm Dần Hợi) và Thái Dương (Miếu Tỵ Ngọ, Vượng Dần Mão Thìn, Đắc Sửu Mùi, Hãm Thân Dậu Tuất Hợi Tý) qua kết quả tìm kiếm tới tuvithuchanh.com (PDF Tân Biên) và thaiam.vn (Phạm Hoàng Hưng, "Đắc tính", cập nhật 06/2026, https://thaiam.vn/tu-vi-wiki/dac-tinh.html, văn xuôi cho Tử Vi, Thái Dương, Thái Âm, Tham Lang).
Nguồn Trung (Toàn Thư): bảng 14 × 12 trên tuvithienco.com (Thanh Vân Tử, 15/9/2026, "lấy theo Toàn Thư", https://tuvithienco.com/14-chinh-tinh-trong-tu-vi) và thư viện iztro (MIT) quét thật bằng lập lá số mệnh ở từng chi.
Bài so sánh: HoaManLau, "Luận bàn về tính Đắc/Hãm chính tinh", lyso.vn, 27/05/2016, https://lyso.vn/xem-tu-vi/luan-ban-ve-tinh-dac-ham-chinh-tinh-trong-tu-vi-t87319/ (Thái Thứ Lang khác Toàn Thư và Trung Châu ở Tham Lang, Thất Sát, Tử Vi/Thiên Tướng Thìn Tuất, Thiên Cơ Sửu).

**Bảng game** (cột Tý … Hợi). `M` ở ô mà nguồn Việt gộp "Miếu Vượng" thành một mục (chỉ Tử Vi, Thất Sát, Thiên Cơ, Thái Dương được tách `V` vì có nguồn tách). Với nội dung luận giải nhóm `sang` gồm cả M/V/D nên không ảnh hưởng.

| Sao | Tý | Sửu | Dần | Mão | Thìn | Tỵ | Ngọ | Mùi | Thân | Dậu | Tuất | Hợi |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Tử Vi | D | D | M | B | V | M | M | D | M | B | V | D |
| Thiên Cơ | D | D | H | M | M | V | D | D | V | M | M | H |
| Thái Dương | H | D | V | V | V | M | M | D | H | H | H | H |
| Vũ Khúc | M | M | M | D | M | H | M | M | M | D | M | H |
| Thiên Đồng | M | H | M | D | H | D | H | H | M | H | H | D |
| Liêm Trinh | M | D | M | H | M | H | M | D | M | H | M | H |
| Thiên Phủ | M | B | M | B | M | B | M | D | M | B | M | D |
| Thái Âm | M | D | H | H | H | H | H | D | M | M | M | M |
| Tham Lang | H | M | D | H | M | H | H | M | D | H | M | H |
| Cự Môn | M | H | M | M | H | H | M | H | D | M | H | D |
| Thiên Tướng | M | D | M | H | M | D | M | D | M | H | M | D |
| Thiên Lương | M | D | M | M | M | H | M | D | M | H | M | H |
| Thất Sát | M | D | M | H | H | V | M | D | M | H | H | V |
| Phá Quân | M | M | H | H | D | H | M | M | H | H | D | H |

Ô nguồn Việt không nêu, game điền theo Toàn Thư: Thiên Phủ Tỵ = B. Ô hocvienlyso xếp "Miếu Vượng" nhưng Tân Biên ghi Đắc, game theo Tân Biên: Thiên Cơ Mùi = D.

**Chỗ hai nguồn khác nhau** (game theo nguồn Việt; ô ghi `game / Toàn Thư`):
- Tử Vi: Tý D/B, Hợi D/B. Vũ Khúc: Tý, Dần, Ngọ, Thân M/V. Thiên Đồng: Tý M/V.
- Liêm Trinh: Sửu, Mùi D/B; Thìn, Tuất M/B.
- Thiên Phủ: Sửu B/M, Mão B/V, Thìn M/V, Ngọ M/V, Mùi D/M, Thân M/B, Tuất M/V, Hợi D/B.
- Thái Âm: Tý, Thân M/V. Tham Lang: Thìn, Tuất M/V.
- Cự Môn: Tý, Ngọ M/V; Thân D/M; Hợi D/V.
- Thiên Tướng: Tý, Thìn, Ngọ, Tuất M/V. Thiên Lương: Tý, Dần, Mão, Thân M/V; Sửu, Mùi D/V.
- Phá Quân: Sửu, Mùi M/V; Thìn, Tuất D/V.
- Phần lớn là khác mức M so với V (cùng nhóm `sang`). Khác nhóm `sang`/`toi` thật sự: Tử Vi Tý/Hợi (D so với B), Liêm Trinh Sửu/Mùi/Thìn/Tuất (game D/M, Toàn Thư B), Thiên Phủ Sửu/Mão (game B, Toàn Thư M/V), Thiên Phủ Thân/Hợi (game M/D, Toàn Thư B).
- Khác trường phái do lyso.vn nêu: Tham Lang Tý/Ngọ (game H, Toàn Thư V), Tham Lang Dần/Thân (game D, Toàn Thư B), Thất Sát Thìn/Tuất (game H, Toàn Thư nhập miếu), Thiên Cơ Sửu (game D, Trung Châu H).
- iztro tự khác cả hai nguồn ở nhiều ô (iztro dùng bảng riêng của Trung Quốc; danh sách đầy đủ lưu trong lá số mẫu ở `differsFromViet.brightnessCells`). T-054 **không** so độ sáng với iztro; chỉ so với bảng trên.

Lưu ý: Bửu Đình, "Đắc Hãm Miếu Vượng Địa?", 14/12/2016 (https://tuviungdung.blogspot.com/2016/12/ac-ham-mieu-vuong-ia.html) không có bảng, chỉ khuyên không dựa vào đắc hãm; ghi lại để cân nhắc khi viết luận giải (T-056).

### 2.2 Nạp âm 30 cặp can chi (60 hoa giáp)

Nguồn Việt: Đoàn Mạnh Thế, "Ngũ hành nạp âm là gì" (dangxuanxuyen.blogspot.com, 2016) và tuvisonkhiem.vn, "Lục thập hoa giáp" cho 5 cặp đầu và danh sách sáu Thổ, sáu Mộc. Nguồn Trung: thư viện `lunar-typescript` (6tail, MIT), bảng `NAYIN`. **Cả 30 nạp âm trong bảng dưới khớp bảng của `lunar-typescript`** (thợ chạy 30 can chi, năm 1984–2043).

| Cặp can chi | Nạp âm | Hành |
|---|---|---|
| Giáp Tý · Ất Sửu | Hải Trung Kim | Kim |
| Bính Dần · Đinh Mão | Lô Trung Hỏa | Hỏa |
| Mậu Thìn · Kỷ Tỵ | Đại Lâm Mộc | Mộc |
| Canh Ngọ · Tân Mùi | Lộ Bàng Thổ | Thổ |
| Nhâm Thân · Quý Dậu | Kiếm Phong Kim | Kim |
| Giáp Tuất · Ất Hợi | Sơn Đầu Hỏa | Hỏa |
| Bính Tý · Đinh Sửu | Giản Hạ Thủy | Thủy |
| Mậu Dần · Kỷ Mão | Thành Đầu Thổ | Thổ |
| Canh Thìn · Tân Tỵ | Bạch Lạp Kim | Kim |
| Nhâm Ngọ · Quý Mùi | Dương Liễu Mộc | Mộc |
| Giáp Thân · Ất Dậu | Tuyền Trung Thủy | Thủy |
| Bính Tuất · Đinh Hợi | Ốc Thượng Thổ | Thổ |
| Mậu Tý · Kỷ Sửu | Tích Lịch Hỏa | Hỏa |
| Canh Dần · Tân Mão | Tùng Bách Mộc | Mộc |
| Nhâm Thìn · Quý Tỵ | Trường Lưu Thủy | Thủy |
| Giáp Ngọ · Ất Mùi | Sa Trung Kim | Kim |
| Bính Thân · Đinh Dậu | Sơn Hạ Hỏa | Hỏa |
| Mậu Tuất · Kỷ Hợi | Bình Địa Mộc | Mộc |
| Canh Tý · Tân Sửu | Bích Thượng Thổ | Thổ |
| Nhâm Dần · Quý Mão | Kim Bạc Kim | Kim |
| Giáp Thìn · Ất Tỵ | Phú Đăng Hỏa | Hỏa |
| Bính Ngọ · Đinh Mùi | Thiên Hà Thủy | Thủy |
| Mậu Thân · Kỷ Dậu | Đại Dịch Thổ | Thổ |
| Canh Tuất · Tân Hợi | Thoa Xuyến Kim | Kim |
| Nhâm Tý · Quý Sửu | Tang Đố Mộc | Mộc |
| Giáp Dần · Ất Mão | Đại Khê Thủy | Thủy |
| Bính Thìn · Đinh Tỵ | Sa Trung Thổ | Thổ |
| Mậu Ngọ · Kỷ Mùi | Thiên Thượng Hỏa | Hỏa |
| Canh Thân · Tân Dậu | Thạch Lựu Mộc | Mộc |
| Nhâm Tuất · Quý Hợi | Đại Hải Thủy | Thủy |

Cục: hành nạp âm của can chi cung Mệnh: Thủy → 2, Mộc → 3, Kim → 4, Thổ → 5, Hỏa → 6 (Phụ lục B; iztro cho cùng Cục ở cả 12 lá số mẫu).
Chỉ có tên "Lô/Lư Trung Hỏa" viết hai cách; game dùng "Lô".

### 2.3 Chủ mệnh và chủ thân

- **Chủ mệnh** (theo chi cung Mệnh): Tý Tham Lang · Sửu, Hợi Cự Môn · Dần, Tuất Lộc Tồn · Mão, Dậu Văn Khúc · Thìn, Thân Liêm Trinh · Tỵ, Mùi Vũ Khúc · Ngọ Phá Quân. Nguồn Việt: Quản Xuân Thịnh, *Số Tử vi kinh nghiệm* (1950, tr. 38, theo các trang lyso.vn, khoahoc.tuvichanco.net dẫn lại); tuvisonkhiem.vn (Sơn Khiêm) nêu cùng bảng. Nguồn Trung: các bài 命主 trên zhihu.com, sina blog, chinazwds.com (cùng bảng, theo chi cung Mệnh); iztro cho cùng sao ở cả 12 chi Mệnh (thợ chạy). **Khớp hoàn toàn.** Ghi chú: tuvisonkhiem.vn cho biết đa số cổ thư tra theo chi năm sinh, số ít (Trung Châu) theo chi cung Mệnh; game theo cung Mệnh như iztro và Phụ lục B.
- **Chủ thân** (theo chi năm sinh): Sửu, Mùi Thiên Tướng · Dần, Thân Thiên Lương · Mão, Dậu Thiên Đồng · Thìn, Tuất Văn Xương · Tỵ, Hợi Thiên Cơ. **Hai chi khác nhau giữa trường phái** (mục 3.4): Tý và Ngọ.

### 2.4 Thiên Hình và Thiên Diêu

Thiên Hình khởi Dậu tháng Giêng, thuận theo tháng. Thiên Diêu khởi Sửu tháng Giêng, thuận theo tháng. Nguồn Việt: tuvi.lethuc.com, "Thiên Hình – Thiên Diêu – Thiên Y" (2023); hocvienlyso.org, "Tự học tử vi đẩu số bài 13: an các sao theo tháng sinh". Nguồn Trung: iztro (`getMonthlyStarIndex`: Thiên Hình = Dậu + tháng, Thiên Diêu đọc từ cùng hàm). **Khớp.** Ví dụ: tháng 4, Hình ở Tý, Diêu ở Thìn. Không khác trường phái.

### 2.5 An Tử Vi (5 Cục × 30 ngày)

Công thức Phụ lục B. Thợ đã chạy công thức cho 12 lá số mẫu và **khớp iztro cả 12 lá** (Tử Vi, Mệnh, Thân). Bảng 150 ô sẽ do T-054 sinh từ công thức và so với iztro trong `tools/tuvi-crosscheck/`; không chép tay bảng ở đây. Ca kiểm: Thủy nhị cục ngày 1 → Sửu, ngày 2 → Dần; `p + t ≡ 4 (mod 12)` (Thiên Phủ).

### 2.6 Đối chiếu các bảng còn lại của Phụ lục B

| Bảng Phụ lục B | Nguồn Việt | Nguồn Trung | Kết quả |
|---|---|---|---|
| Mệnh/Thân `2+(m−1)∓h` | hocvienlyso.org (bài an cung Mệnh); công thức khớp mọi lá số mẫu | iztro | Khớp (12/12 lá, kể cả giờ Tý muộn) |
| Tả Phù/Hữu Bật, Xương/Khúc, Không/Kiếp | hocvienlyso.org (bài 13, an sao theo tháng/giờ) | iztro | **Chưa so từng ô**; việc của T-054 (`tools/tuvi-crosscheck/`) |
| Lộc Tồn, Kình, Đà | tuvi.cohoc.net (bài an sao theo can) | iztro | **Chưa so từng ô**; việc của T-054 |
| Thiên Khôi/Việt | Thái Thứ Lang (tuvicaimenh.com, thaiam.vn, Thiên Lương *Tử vi nghiệm lý toàn thư*) | iztro | **Khác ở Canh** (mục 3.3) |
| Hỏa/Linh (cung khởi theo chi năm) | hoctuvi.blogspot.com (Tori Trump, 3/2/2014) | iztro (`getHuoLingIndex`, bảng khởi giống hệt) | Cung khởi khớp; **chiều đi khác** (mục 3.2) |
| Tứ Hóa 10 can | Bửu Đình, tuviungdung.blogspot.com, 8/6/2010 (bình luận 25/6/2010) | iztro (thợ so ở các can có trong 12 mẫu: Giáp, Ất, Bính, Canh, Kỷ, Mậu, Nhâm, Quý; chưa so Đinh, Tân) | Khớp Phụ lục B ở các can đã so; Tân khác Thái Thứ Lang (mục 3.1) |
| Chủ mệnh | Quản Xuân Thịnh 1950 | iztro, zhihu | Khớp |
| Chủ thân | Quản Xuân Thịnh 1950 | iztro | Khác Tý (mục 3.4) |
| Nạp âm 30 cặp | Đoàn Mạnh Thế, Sơn Khiêm | `lunar-typescript` | Khớp 30/30 |
| Thiên Hình/Diêu | lethuc.com, hocvienlyso.org | iztro | Khớp |
| Mã, Đào Hoa, Hồng Loan, Tuần, Triệt, Tràng Sinh, Đại vận, Tiểu vận, lưu niên | Phụ lục B (đã Argon xác nhận) | iztro cho Mã, Đào Hoa, Tràng Sinh, Đại vận | Chưa đối chiếu riêng ở T-055; T-054 so với iztro bằng `tools/tuvi-crosscheck/` |

## 3. Điểm khác trường phái (để chủ dự án chốt)

### 3.1 Tứ Hóa can Canh và can Tân

Mỗi can đều có đủ bốn Hóa; khác biệt là **sao nào** đứng ở Khoa và Kỵ.

| Can | Cách "Thái Thứ Lang" (Phụ lục B) | Cách còn lại |
|---|---|---|
| Canh | **Nhật Vũ Âm Đồng**: Lộc Thái Dương, Quyền Vũ Khúc, **Khoa Thái Âm, Kỵ Thiên Đồng** | **Nhật Vũ Đồng Âm**: Lộc Thái Dương, Quyền Vũ Khúc, **Khoa Thiên Đồng, Kỵ Thái Âm** (Thiên Lương trong *Tử vi nghiệm lý*; Việt Viêm Tử; một số bản Toàn Thư) |
| Tân | **Cự Lương Khúc Xương**: Lộc Cự Môn, **Quyền Thiên Lương**, Khoa Văn Khúc, Kỵ Văn Xương (Thái Thứ Lang theo lời người hỏi trên blog Bửu Đình) | **Cự Dương Khúc Xương**: Lộc Cự Môn, **Quyền Thái Dương**, Khoa Văn Khúc, Kỵ Văn Xương (Thiên Lương, Bửu Đình, Toàn Thư) |

Nguồn: Bửu Đình, "Hỏi và Đáp - Blog tử vi Bửu Đình" (blog "Rong chơi cùng thời đại", trả lời 25/06/2010, http://rongchoicungthoidai.blogspot.com/2012/12/hoi-va-ap-blog-tu-vi-buu-inh.html) và bài "Tử Vi Hoàn Toàn Khoa Học" (8/6/2010, https://tuviungdung.blogspot.com/2010/06/tu-vi-hoan-toan-khoa-hoc.html): bảng Bửu Đình viết Canh "Nhật Vũ Âm Đồng", Tân "Cự Dương Khúc Xương". Người hỏi cho biết nhiều trang an sao Việt theo Thái Thứ Lang (Canh Âm Đồng, Tân Cự Lương). tuvi.cohoc.net, "Luận về sao Thiên Đồng": Toàn Thư có câu "Canh Nhật Vũ Đồng Âm… Tân Cự Dương Khúc Xương" và tác giả ghi Trung Châu thì chủ Âm Đồng. Thợ chạy iztro (nguồn Trung) trên mẫu Canh: iztro cho **Âm Khoa, Đồng Kỵ** (giống Phụ lục B). Can Tân thợ chưa chạy iztro.

**Kiểm Phụ lục B:** Phụ lục B ghi Canh "Thái Dương, Vũ Khúc, Thái Âm, Thiên Đồng" (Âm Đồng, theo Thái Thứ Lang), và Tân "Cự Môn, **Thái Dương**, Văn Khúc, Văn Xương" (Cự Dương). Nhưng Thái Thứ Lang (theo lời người hỏi ở blog Bửu Đình) ghi Tân là **Cự Lương**. Vậy Phụ lục B ở can Tân **khác Thái Thứ Lang**, trùng Toàn Thư/iztro/Bửu Đình. **Cần chủ dự án chốt** Tân: Quyền Thái Dương (Phụ lục B hiện tại) hay Quyền Thiên Lương (Thái Thứ Lang). Thợ chưa mở được văn bản Tân Biên để kiểm trực tiếp; đây là điều cần mở sách (bản PDF https://tuvithuchanh.com/wp-content/uploads/2022/11/Tu-vi-dau-so.pdf, scan, không đọc được bằng WebFetch). Lá số mẫu hiện không có can Tân nên không bị ảnh hưởng. Đề xuất: giữ Phụ lục B (Cự Dương) cho tới khi kiểm sách.

### 3.2 Hỏa Tinh và Linh Tinh (chiều đi)

- **Việt (Thái Thứ Lang)**: cung khởi theo chi năm (Dần Ngọ Tuất: Hỏa Sửu, Linh Mão · Thân Tý Thìn: Hỏa Dần, Linh Tuất · Tỵ Dậu Sửu: Hỏa Mão, Linh Tuất · Hợi Mão Mùi: Hỏa Dậu, Linh Tuất); Dương Nam/Âm Nữ thì Hỏa thuận, Linh nghịch; Âm Nam/Dương Nữ thì Hỏa nghịch, Linh thuận. Nguồn: "Tori Trump", hoctuvi.blogspot.com, 3/2/2014 (https://hoctuvi.blogspot.com/2014/02/ban-luan-ve-sao-hoa-tinh-linh-tinh-theo.html); Đông Phương Lý Số, 2015, tán thành cách này.
- **Trung Quốc (iztro, Toàn Thư)**: cùng bảng cung khởi nhưng **cả hai sao đi thuận cố định** theo giờ, không phân Âm Dương Nam Nữ (thợ đọc `getHuoLingIndex` của iztro: `+ timeIndex`, không có nhánh theo giới/can). Thợ cũng chạy tuổi Canh Ngọ nam và nữ: iztro cho Hỏa/Linh giống nhau.
- Khác nữa: Việt Viêm Tử (cả hai thuận, Nam khởi Hỏa trước, Nữ khởi Linh trước); Đắc Lộc (tuổi Tỵ Dậu Sửu đổi Hỏa Tuất/Linh Mão).
- **Game:** theo Thái Thứ Lang (Phụ lục B). Hệ quả: lá số có Hỏa/Linh **khác iztro** với Âm Nam/Dương Nữ. T-054 chỉ so Hỏa/Linh với iztro với Dương Nam/Âm Nữ.

### 3.3 Thiên Khôi và Thiên Việt (Canh, Tân)

| Can | Thái Thứ Lang = Phụ lục B (Khôi / Việt) | Trường phái "Giáp Mậu Canh Ngưu Dương" (iztro) |
|---|---|---|
| Giáp, Mậu | Sửu / Mùi | Sửu / Mùi |
| Canh | **Ngọ / Dần** (cùng với Tân) | **Sửu / Mùi** (cùng nhóm Giáp Mậu) |
| Tân | Ngọ / Dần | Ngọ / Dần |

Nguồn Việt: Thiên Lương, *Tử Vi Nghiệm Lý Toàn Thư* (dangxuanxuyen.blogspot.com, 2015, nói cách xếp Canh cùng Giáp Mậu là in nhầm ở một số sách); Tam Nguyên (tamnguyen999.blogspot.com, 2013); tuvicaimenh.com; thaiam.vn. Nguồn Trung: iztro (`getKuiYueIndex`: Canh cùng nhóm Giáp, Mậu, Khôi Sửu, Việt Mùi). Thợ chạy: iztro cho tuổi Canh Ngọ Khôi Sửu, Việt Mùi; tuổi Tân Mùi Khôi Ngọ, Việt Dần. Tuvisonkhiem.vn mô tả đây là hai trường phái (văn vần "Giáp Mậu Canh Ngưu Dương" so với suy từ Tiên Thiên/Hậu Thiên bát quái). **Game:** Canh Ngọ/Dần theo Phụ lục B (Thái Thứ Lang, Thiên Lương).

### 3.4 Chủ thân tuổi Tý (và Ngọ)

- **Việt:** Tý → **Linh Tinh**; Ngọ → Hỏa Tinh. Nguồn: Quản Xuân Thịnh, *Số Tử vi kinh nghiệm* (1950, tr. 38), theo các trang lyso.vn và khoahoc.tuvichanco.net dẫn lại (thợ dựa vào kết quả tìm kiếm tóm tắt; chưa mở trang sách).
- **Trung Quốc (iztro, zhihu, chinazwds.com):** Tý và Ngọ đều **Hỏa Tinh**. Thợ chạy iztro: năm Tý và Ngọ đều Hỏa Tinh.
- **Đề xuất theo D11:** Tý Linh Tinh, Ngọ Hỏa Tinh; ghi trong fixture khi lá số có chi năm Tý. Mẫu S04 (Canh Tý), S05 (Nhâm Tý) sẽ có `than` giống iztro nhưng khác chủ thân: kiểm chủ thân bằng quy ước Việt, không so với iztro.

### 3.5 Khoa của can Nhâm

"Nhâm Lương Tử Phủ Vũ": Phụ lục B chọn **Tả Phù** (Khoa), iztro cho Tả Phù (thợ chạy mẫu Nhâm Tý). Bửu Đình cũng viết "Lương Vi Phụ Vũ" (Phụ = Tả Phù). Một số sách đọc "Phủ" là Thiên Phủ. **Game:** Tả Phù; cần chủ dự án chốt nếu muốn đổi.

### 3.6 Tuổi tính đại vận

Tuổi âm (tuổi mụ), ghi rõ trên lá số (KH đã chốt).

## 4. Lưu ý lập lá số mẫu

### 4.1 Lịch trước 1968 (UTC+7 / UTC+8)

Thợ chạy thuật toán Hồ Ngọc Đức hai lần (UTC+7, UTC+8) trên 1900–2050 (55 122 ngày): **927 ngày lệch trong 1900–1967** (khớp con số của KH), và thêm 1 107 ngày lệch từ 1968 trở đi (do trăng mới sát nửa đêm). Thuật toán UTC+8 này lệch với `lunar-typescript` (iztro) ở 93 ngày (ví dụ 1914-11-17..), nên 12 mẫu chỉ chọn ngày mà **ba kết quả cùng bằng nhau** (UTC+7, UTC+8, `lunar-typescript`). Vì vậy mẫu trước 1968 đúng với cả công cụ Việt (UTC+7) lẫn quy ước UTC+8. Có 7 mẫu trước 1968: 1938, 1939, 1945, 1950, 1953, 1960 (tháng nhuận), 1965.

### 4.2 Giờ sinh

- Giờ Tý 23:00–23:59 tính sang ngày hôm sau (D11). Mẫu S03 là loại này (`lateTy: true`); đã kiểm iztro "giờ Tý muộn" cho cùng kết quả với "ngày kế + giờ Tý đầu".
- Đầu vào chi giờ 0–11, không phải giờ đồng hồ.

### 4.3 Tháng nhuận

Tính như tháng chính (D11). Mẫu S04: 1960, tháng 6 nhuận, ngày 27 (iztro `fixLeap=false`, tức tính như tháng chính, đúng D11).

## 5. Nguồn

| Nguồn | Loại | Dùng cho |
|---|---|---|
| Vân Đằng Thái Thứ Lang, *Tử Vi Đẩu Số Tân Biên*, Sài Gòn, 1956 | Sách (Việt) | Gốc trường phái; thợ chỉ đọc qua bản chép lại, chưa đọc văn bản PDF |
| Dương Lương, hocvienlyso.org, 17/8/2022; tuvihiendai.vn, 26/08/2020 | Web (Việt) | Độ sáng 14 × 12 |
| sonchu.vn, "Thuyết Miếu Hãm của các tinh diệu" | Web (Việt, trích Thái Thứ Lang) | Kiểm Thất Sát |
| Phạm Hoàng Hưng, thaiam.vn, 06/2026 | Web (Việt) | Độ sáng một số sao; Khôi Việt |
| HoaManLau, lyso.vn, 27/05/2016 | Web (Việt) | Thái Thứ Lang khác Toàn Thư/Trung Châu |
| Thanh Vân Tử, tuvithienco.com, 15/9/2026 | Web (Việt, theo Toàn Thư) | Bảng độ sáng 14 × 12 của Toàn Thư |
| Bửu Đình, tuviungdung.blogspot.com, 2010 và 2016 | Blog (Việt) | Tứ Hóa 10 can |
| Quản Xuân Thịnh, *Số Tử vi kinh nghiệm*, 1950 | Sách (Việt), qua lyso.vn, tuvichanco.net | Chủ mệnh, chủ thân |
| Thiên Lương, *Tử Vi Nghiệm Lý Toàn Thư* (dangxuanxuyen.blogspot.com, 2015) | Sách (Việt) | Khôi Việt, Tứ Hóa Canh/Tân |
| "Tori Trump", hoctuvi.blogspot.com, 3/2/2014 | Blog (Việt) | Hỏa/Linh |
| tuvi.lethuc.com, hocvienlyso.org (bài 13) | Web (Việt) | Thiên Hình/Diêu |
| Đoàn Mạnh Thế, dangxuanxuyen.blogspot.com, 2016; Sơn Khiêm (tuvisonkhiem.vn) | Web (Việt) | Nạp âm |
| iztro (SylarLong, MIT, v2.x), https://github.com/SylarLong/iztro | Thư viện (Trung Quốc, Toàn Thư) | Đối chiếu bảng; lá số mẫu |
| `lunar-typescript` (6tail, MIT) | Thư viện (Trung Quốc) | Nạp âm; lịch âm |
| zhihu.com/p/2331683569 (không mở được, chỉ qua tìm kiếm), sina blog, chinazwds.com | Web (Trung) | Chủ mệnh, chủ thân |

Hạn chế trung thực: thợ không đọc được chữ trong PDF Tân Biên, nên nhiều dòng "Thái Thứ Lang" đến từ trang Việt chép lại, không từ trang sách. Không dùng bản dịch Toàn Thư gốc của Trung Quốc: nguồn Trung ở đây là iztro và `lunar-typescript` (cài tạm ngoài repo, không thêm vào `package.json`) cùng vài trang tiếng Trung đọc qua kết quả tìm kiếm.

## 6. Việc còn lại

| Hạng mục | Trạng thái | Ai |
|---|---|---|
| Mã dữ liệu, bảng 2.1–2.6, điểm khác 3.1–3.6 | Xong (tra nguồn) | — |
| Chốt: Tân (Cự Dương hay Cự Lương), Khoa Nhâm, Hỏa/Linh, Khôi Việt Canh, chủ thân Tý | Chờ quyết định | 👤 chủ dự án |
| 12 lá số mẫu | Đã lập bằng iztro (`verifiedByVietTools: false`) | — |
| **Đối chiếu 12 lá số với hai công cụ tử vi Việt** (ghi công cụ, URL, ngày truy cập; đầu vào ngày âm + chi giờ + cờ nhuận) | **CHƯA LÀM, chặn đóng thẻ** | 👤 chủ dự án hoặc người được nhờ |
| Mở văn bản *Tân Biên* kiểm Tân, độ sáng Miếu/Vượng | Chưa | 👤 |
| Danh sách 927 ngày lệch | Chưa lập thành file (cần thuật toán lịch của T-050) | Thợ T-050 |
