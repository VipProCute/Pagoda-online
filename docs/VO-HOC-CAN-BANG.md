# Võ học · Báo cáo cân bằng

Số liệu từ công cụ mô phỏng `tools/pk-sim`, chạy trên **đúng engine thật** `lib/pk/engine.js`. Đây là số liệu để chủ dự án quyết định, **không phải kết luận "đã cân bằng"**. > **Lưu ý:** các số buff dưới đây đo ở `BUFF_SCALE` 0,25 / 0,5 / 1. Vì buff quá nhạy, mặc định thực tế được hạ xuống **0,15** (biến môi trường `PK_BUFF_SCALE`, có thể chỉnh 0 đến 1 mà không sửa code).

Mọi con số lấy ở luật hiện tại (`BUFF_SCALE` 0,5 lúc đo; HP 200; hồi nội lực 6; cấp nội công 7 nếu không ghi khác).

## 0. Tóm tắt

- Tam giác ý đồ **có** hình thành với bot cân bằng (eq): Cương thắng Tốc 69%, Tốc thắng Nhu 97%, Nhu thắng Cương 73%. Nhưng nhánh Tốc thắng Nhu quá nặng.
- Không có bộ nào "bất bại", nhưng các bộ phối **Trọng Quyền + Tật Phong Quyền** đứng đầu mọi lần quét. Trọng Quyền (TQ) có mặt ở 10/12 bộ chung kết của cả hai seed.
- Chiêu ít người chọn: Ảnh Bộ Hộ Thân, Tụ Lực Phá Sơn, Kim Chung Tráo, Tứ Lạng, Nhu Vân Bộ, Phản Chấn. Cả bốn chiêu thủ (Thiết Bích, Kim Chung, Tá Lực, Ảnh Bộ) đều yếu hơn trung bình.
- Buff **rất nhạy**: ở `BUFF_SCALE` 0,25 bộ nào hơi hung hãn đã thắng 85-100% khi một bên có buff. Không có giá trị nào trong 0,25 / 0,5 / 1 giữ được tổ hợp mạnh nhất dưới 70%.
- Chênh cấp nội công gần như vô nghĩa (50-56%) trừ bộ Tốc tốn nội lực (tới 98%).
- Có hai điểm ở luật cần để ý: trận không bao giờ tới lượt 40 (suy kiệt giết cả hai chậm nhất ở lượt 28), và HP 200 chia cho sát thương mỗi đòn khiến chênh vài HP đổi hẳn kết quả.

## 1. Cách chạy lại

```
node tools/pk-sim roundrobin            # 13 bộ tiêu biểu, ~25 giây
node tools/pk-sim roundrobin --sets pure --games 100     # 15 bộ thuần, có bảng tam giác
node tools/pk-sim grid                  # mọi 1365 bộ, ~30 giây
node tools/pk-sim buffs                 # ~75 giây; thêm --only max --scales 0.1,0.25
node tools/pk-sim levels
node tools/pk-sim param --key skill.tiep-kinh-phan-chuong.parry.spd --values 75,85,95
node tools/pk-sim progress              # thời gian tu luyện
```

Tùy chọn chung: `--games N --seed S --level L --mode eq|greedy|random --json --set khóa=số`. Cùng seed ra cùng số. Mặc định mỗi lệnh dưới 2 phút, một tiến trình.

Ba loại bot:

| Bot | Cách chọn |
|---|---|
| `random` | Chọn đều trong chiêu đủ nội lực; chỉ Điều tức khi nội lực ≤ 20 |
| `greedy` | Mỗi lượt chọn chiêu kỳ vọng tốt nhất nếu đối thủ chọn đều |
| `eq` | Mỗi lượt lập ma trận kỳ vọng trên Duel thật rồi chọn ngẫu nhiên theo chiến lược cân bằng kéo-búa-bao |

Viết tắt chiêu: TQ Trọng Quyền · KCT Kim Chung · TL Tụ Lực · TB Thiết Bích · PC Phản Chấn · KTB Khinh Thân · ABH Ảnh Bộ · TPQ Tật Phong · LHC Liên Hoàn · DAP Đoạt Ảnh · NVB Nhu Vân · TKP Tiếp Kình · TLH Tá Lực · LDC Liễu Diệp · TLB Tứ Lạng · ĐT Điều tức.

## 2. Cương – Tốc – Nhu

Điểm của hàng so với cột, trung bình trên mọi cặp trong 15 bộ thuần (5 bộ mỗi nhánh), 100 trận mỗi cặp (random: 300). Ý đồ: Cương > Tốc > Nhu > Cương.

| Cặp | eq | greedy | random |
|---|---|---|---|
| Cương thắng Tốc | 69% | 61% | 63% |
| Tốc thắng Nhu | 97% | 100% | 83% |
| Nhu thắng Cương | 73% | 48% | 47% |

- Cương > Tốc và Tốc > Nhu đúng ý đồ ở cả ba bot.
- Tốc > Nhu **quá nặng**: tốc 95 của Tật Phong, Đoạt Ảnh khiến né 80 và đỡ 70-75 của Nhu chỉ còn 28-36% thành công.
- Nhu > Cương chỉ đúng với bot eq; bot ngẫu nhiên và tham lam thì Nhu không hơn Cương.
- Trong từng cặp nhánh, bộ này thắng bộ kia dao động rất rộng (có cặp 0%, có cặp 100%): chọn đúng bộ quan trọng hơn chọn đúng nhánh.

Trong 15 bộ thuần chỉ một bộ không có đòn tấn công chủ động (Nhu: Nhu Vân, Tá Lực, Tiếp Kình, Tứ Lạng). Loại bộ đó thì Nhu > Cương lên 79% (eq).

## 3. Bộ tiêu biểu và bộ áp đảo

Điểm trung bình (thắng 1, hòa 0,5) của mỗi bộ so với 11 bộ còn lại. eq: 150 trận mỗi cặp; greedy 200; random 400.

| Bộ | Chiêu | eq | greedy | random |
|---|---|---|---|---|
| Phối1 | TQ TPQ KTB TLB | 73 | 69 | 59 |
| Tân thủ | TQ TPQ TB NVB | 69 | 56 | 50 |
| Tốc1 | TPQ LHC KTB DAP | 59 | 54 | 66 |
| Phối2 | TQ KTB TKP TB | 58 | 70 | 37 |
| Cương2 | TQ KCT TB PC | 56 | 62 | 26 |
| Phối3 | TPQ DAP TB TKP | 55 | 59 | 55 |
| Cuồng công | TQ TPQ LHC TL | 54 | 52 | 77 |
| Tốc2 | TPQ LHC KTB ABH | 43 | 41 | 50 |
| Nhu1 | LDC NVB TKP TLB | 42 | 28 | 47 |
| Cương1 | TQ KCT TB TL | 36 | 56 | 58 |
| Nhu2 | LDC TLH TKP TLB | 36 | 28 | 41 |
| Phản đòn | TKP TLB DAP TB | 20 | 25 | 35 |

- Thứ hạng thay đổi nhiều theo loại bot (Cuồng công thắng nhất với bot ngẫu nhiên nhưng giữa bảng với bot eq). Nhận định chắc nhất là cái **cả ba bot đồng ý**: Phối1 và Tân thủ mạnh, Phản đòn và hai bộ Nhu yếu.
- Có kéo-búa-bao thật: gần như mọi bộ đều có một bộ khắc chế nặng (điểm thấp nhất dưới 30%: Cương1 3%, Nhu1 2%, Tốc2 7%, Phối3 7%). Chỉ Phối1 (thấp nhất 43%) và Tân thủ (40%) không bị bộ nào khắc nặng.

**Quét 1365 bộ** (`grid`, seed 1 và 2, ba giai đoạn: bot ngẫu nhiên → eq → chung kết). Điểm trung bình của các bộ có chiêu đó, bot eq trên mẫu 120 bộ ngẫu nhiên:

| Chiêu | eq | ngẫu nhiên | Chiêu | eq | ngẫu nhiên |
|---|---|---|---|---|---|
| TQ | 67% | 59% | PC | 45% | 48% |
| LHC | 63% | 59% | TL | 44% | **66%** |
| TPQ | 60% | 60% | ABH | 44% | 42% |
| DAP | 54% | 55% | NVB | 44% | 44% |
| TLB | 50% | 48% | KTB | 43% | 45% |
| TKP | 49% | 49% | TLH | 43% | 43% |
| LDC | 46% | 58% | TB | 42% | 43% |
| | | | KCT | 41% | 42% |

- Chung kết: bộ tốt nhất mỗi seed đạt 68-70% so với 20 bộ mạnh nhất vòng 2 (khoảng ±9% do mẫu nhỏ) và 77-88% so với bộ ngẫu nhiên. Hai seed ra hai bộ đầu khác nhau, nên **không có một bộ áp đảo duy nhất**, mà có một họ: TQ + TPQ + một chiêu đánh/đỡ (LHC, DAP, TKP, TLB).
- Tụ Lực: với bot ngẫu nhiên là chiêu mạnh nhất (66%) vì ép tung đòn 70 không bị đoán trước; với bot biết đỡ chỉ 44%.
- Liễu Diệp: tốt khi là đòn duy nhất của bộ Nhu, nhưng bot eq chọn nó tới 63%: nó gánh cả nhánh.

## 4. Tỉ lệ dùng chiêu

Bot eq, chọn tự do khi chiêu có trong bộ (mẫu 24 bộ ngẫu nhiên, 50 trận mỗi cặp). Bộ có 4 chiêu + Điều tức; số này phụ thuộc bộ có bao nhiêu chiêu đánh.

| Nhiều | % | Ít | % |
|---|---|---|---|
| TPQ | 60 | KCT | 9 |
| LHC | 55 | TL | 8 |
| DAP | 39 | PC | 8 |
| LDC | 31 | TLB | 8 |
| TQ | 28 | NVB | 7 |
| KTB | 26 | ABH | 7 |

Điều tức được chọn khoảng 10-15% lượt. Với bot tham lam, hầu hết chiêu thủ, né và đỡ gần như không bao giờ được chọn (≤ 6%).

## 5. Độ dài trận, hòa, suy kiệt

| Bot | Lượt trung vị | Lượt trung bình | Hòa | Vào suy kiệt | Kết thúc đôi bên (double-ko) |
|---|---|---|---|---|---|
| eq | 11 | 12,2 | 0,5% | 20% | 12% |
| greedy | 7 | 7,9 | 1,3% | 0,5% | 27% |
| random | 17 | 15,9 | 0,5% | 55% | 14% |

- Trận eq trung vị 11 lượt, tối đa khoảng 5 phút kể cả 6,5 giây lật chiêu và hoạt ảnh đánh nhau mỗi lượt.
- Hòa hiếm (dưới 2%), trừ các cặp có bộ không có đòn đánh (hòa tới 5% trên 15 bộ thuần).
- **Trận không bao giờ tới lượt 40.** Suy kiệt từ lượt 20 trừ 5, 10, 15... mỗi lượt, tổng 225 ≥ 200 HP sau 9 lượt, nên trận dài nhất là 28 lượt. `MAX_TURNS = 40` không bao giờ xảy ra (đã kiểm bằng test). Vô hại, nhưng chữ "lượt 40" trong luật là thừa.
- Suy kiệt do 4 lượt liền không ai mất máu tính **ngay ở lượt thứ 4** (lượt đó đã mất 5 HP), không phải lượt thứ 5.

## 6. Buff và BUFF_SCALE

Bên A có buff, bên B không buff, **cùng bộ chiêu** (gương), bot eq. Ô = điểm của bên có buff, 50% là ngang nhau. Số buff thật của tổ hợp mạnh nhất Lc6 + Lq4 + Ld9:

| BUFF_SCALE | Tăng sát thương | Giảm sát thương nhận | Cộng né |
|---|---|---|---|
| 0,1 | 3,4% | 2,1% | 1,1 điểm |
| 0,25 | 8,5% | 5,3% | 2,6 điểm |
| 0,5 | 17% | 10,5% | 5,3 điểm |
| 1 | 34% | 15% (chạm trần) | 8 điểm (chạm trần) |

Điểm của bên có Lc6 + Lq4 + Ld9 (300 trận mỗi ô, sai số ±6 điểm):

| Bộ | 0,05 | 0,1 | 0,15 | 0,25 | 0,35 | 0,5 |
|---|---|---|---|---|---|---|
| Phối1 | 52 | 60 | 59 | 59 | 71 | 79 |
| Phối2 | 47 | 58 | 54 | 57 | 54 | 54 |
| Phối3 | 63 | 73 | 80 | 93 | 99 | 100 |
| Tân thủ | 51 | 63 | 65 | 76 | 87 | 91 |
| Cuồng công | 41 | 54 | 75 | 100 | 100 | 100 |
| Cương1 | 81 | 94 | 99 | 100 | 100 | 100 |
| Tốc1 | 58 | 81 | 92 | 99 | 100 | 99 |
| Nhu1 | 54 | 52 | 60 | 64 | 66 | 73 |

Ở `BUFF_SCALE` 1 (150 trận): Phối1 94%, Nhu1 90%, Tốc1 100%, Cương1 100%. Một nguồn buff riêng lẻ ở 0,25: Pháp tướng Lc6 giúp 54% (Phối1) tới 84% (Cương1); hào quang Ld9 giúp 56% tới 96%.

Bảng chi tiết Lc 0-6 và Lq 1-4 nhân Ld 0-9 ở 0,25 / 0,5 / 1 chạy bằng `node tools/pk-sim buffs --full --sets "Phối1"` (khoảng 90 giây mỗi bộ).

**Nhận xét**
- Độ nhạy phụ thuộc bộ chiêu. Bộ có nhiều thủ, né, đỡ (Phối2) gần như không bị buff làm lệch. Bộ trao đòn đều (Cương1, Tốc1, Cuồng công, Phối3) bị lệch rất mạnh.
- Lý do: cả hai bên đánh gần như cùng số đòn cố định (38, 25, 16...) với dao động chỉ ±10%, HP 200 hết sau khoảng 5-7 đòn. Chênh vài HP quyết định ai chạm 0 trước. Tăng dao động sát thương (DMG_VAR 0,1 → 0,3) chỉ giảm bớt một phần (Cương1 Lc6 ở 0,25: 85% → 59%; Phối3 Lc6 + Lq4 + Ld9 ở 0,25 chỉ giảm 94% → 88%).
- **Tiêu chí tôi dùng**: tổ hợp mạnh nhất không quá khoảng 65-70% trên bộ phối hợp (Phối1, Phối2, Phối3, Tân thủ, Cuồng công). Giá trị lớn nhất thỏa mãn ở cả 5 bộ là **khoảng 0,05-0,1** (0,1: Phối1 60, Phối2 58, Phối3 73, Tân thủ 63, Cuồng công 54; chỉ Phối3 vượt nhẹ). Ở 0,25 chỉ còn Phối1 và Phối2 thỏa. Bộ Cương1 và Tốc1 vẫn lệch ngay cả ở 0,1 (94% và 81%).
- **Khuyến nghị**: đưa `BUFF_SCALE` xuống 0,1-0,15 (buff tối đa chỉ cộng khoảng 3-5% sát thương, 2-3% giảm sát thương), hoặc chấp nhận 0,25 và coi buff là yếu tố quyết định thật sự trong phòng có buff. Giá trị 0,5 hiện tại làm phòng có buff thành "ai có buff cao hơn thắng" ở đa số bộ.
- Từ `BUFF_SCALE` ≈ 0,71 trở lên, giảm sát thương và cộng né chạm trần; nhãn buff trước đây ghi tổng vượt trần. Đã sửa: nhãn thêm dòng "Cộng dồn bị chặn trần" (xem `lib/pk/buffs.js`).

## 7. Chênh cấp nội công

Chỉ khác nội lực tối đa (80 + 4 mỗi cấp), cùng bộ chiêu. Điểm của bên cấp cao hơn, bot eq, 300 trận mỗi ô.

| Cấp (nội lực) | Cương1 | Tốc1 | Nhu1 | Phối1 | Phối2 | Tân thủ |
|---|---|---|---|---|---|---|
| 2 vs 1 (84 vs 80) | 50 | 81 | 45 | 49 | 50 | 47 |
| 3 vs 1 (88 vs 80) | 52 | 69 | 46 | 61 | 51 | 51 |
| 5 vs 1 (96 vs 80) | 51 | 91 | 52 | 62 | 54 | 52 |
| 7 vs 1 (104 vs 80) | 56 | 93 | 53 | 63 | 50 | 52 |
| 10 vs 1 (116 vs 80) | 46 | 98 | 56 | 65 | 54 | 52 |
| 10 vs 5 (116 vs 96) | 57 | 81 | 49 | 56 | 49 | 57 |
| 10 vs 7 (116 vs 104) | 51 | 71 | 51 | 54 | 51 | 56 |

- Với Cương1, Nhu1, Phối2, Tân thủ, nội lực thêm hầu như không đổi kết quả (45-57%, trong sai số ±6); Phối1 nhỉnh hơn (49-65%).
- Bộ Tốc1 (Liên Hoàn 22, Đoạt Ảnh 22) nhạy bất thường: 4 nội lực hơn có thể quyết định tới 98% (3 vs 2), nhưng 5 vs 3 lại 41%. Đó là hiệu ứng ngưỡng: bot dùng hết nội lực, ai còn đủ 22 ở lượt cuối thắng. Nên cân nhắc nếu muốn cấp nội công có ý nghĩa đều đặn.
- Nghĩa là cấp nội công chủ yếu có giá trị nhờ **mở khóa chiêu** (bậc 4 cần cấp 7), không nhờ nội lực.

## 8. Khuyến nghị chỉnh số

Mỗi khuyến nghị kèm số đo bằng `param` (bot eq, 40 trận mỗi cặp, mẫu nhỏ nên chỉ xem hướng). **Tôi không sửa `martial.js` / `rules.js`.**

| Vấn đề | Thử | Kết quả đo |
|---|---|---|
| Tốc thắng Nhu 97% | Tiếp Kình `parry.spd` 75 → 85 | Tốc>Nhu 78%, Nhu>Cương 75%, Nhu1 43 → 48%, Nhu2 33 → 44%, Phản đòn 18 → 26% |
| | → 95 | Tốc>Nhu 67%, nhưng suy kiệt tăng 20 → 32% |
| | Nhu Vân `dodge.spd` 80 → 95 | Tốc>Nhu chỉ 97 → 91%: không đủ |
| Tụ Lực ít được chọn (6%) | `release.spd` 20 → 80 | Chọn 6 → 15%, Cương1 37 → 45%, Nhu>Cương 72 → 57% |
| | `mana` 30 → 18 | Không đổi (6 → 7%) |
| | `release.base` 70 → 110 | Gần như không đổi (6 → 8%) |
| Ảnh Bộ Hộ Thân ít chọn (4%) | `guard.red` 0,4 → 0,55 | Chọn 4 → 9%, tam giác Cương>Tốc 72 → 66% |
| Trọng Quyền trội nhất | `mana` 14 → 22 | Phối1 vẫn 73%, nhưng Cương>Tốc rơi 72 → 35%: **không nên** |

Đọc: tốc độ đỡ / né là đòn bẩy chính; sát thương và nội lực của Tụ Lực không phải vấn đề, nó chết vì dễ bị đỡ (tốc 20 so với đỡ 70-80 thành công 85%+). Chấn địa chỉ giảm né, không giảm đỡ.

Các chiêu thủ (Thiết Bích, Kim Chung, Tá Lực) đều yếu hơn trung bình và ít được chọn; chưa thử nghiệm đủ để đề xuất con số, có thể thử `KC_BONUS` hoặc tăng `red` giống Ảnh Bộ.

Về buff xem mục 6. Về thời gian tu luyện:

| Kiểu người chơi | Bậc 2 | Bậc 3 | Đủ 15 chiêu (bậc 4) | Cấp 10 + tâm đắc đầy |
|---|---|---|---|---|
| Liên tục, phiên tối ưu | 11 giờ | 31 giờ | 69 giờ | 146 giờ |
| Chỉ phiên ≥ 4 giờ | 20 giờ | 44 giờ | 84 giờ | 176 giờ |
| Chỉ phiên ≤ 1 giờ | 11 giờ | 31 giờ | 72 giờ | 165 giờ |

Đủ 15 chiêu mất khoảng 3 ngày cày liên tục (cận dưới; giả định chia tâm đắc đều ba nhánh). Phiên ngắn hiệu quả hơn phiên dài mỗi giờ (Vô Cực 8 giờ 21 công lực/giờ, Tĩnh Tâm 15 phút 20/giờ, Kim Cương 8 giờ chỉ 10,6/giờ), nên người chăm sẽ canh phiên ngắn. Nếu chủ dự án muốn học đủ chiêu lâu hơn, đây là chỗ chỉnh. Chạy bằng `node tools/pk-sim progress`.

## 9. Giới hạn của mô phỏng

- **Bot nhìn trước đúng một lượt**, không đọc thói quen đối thủ, không nhớ lịch sử. Người thật đọc được thói quen, dụ, bluff; số thắng thật sẽ khác. Riêng Tụ Lực được tính thêm lượt tung đòn bắt buộc.
- Hàm giá trị của bot là chủ quan: máu chênh + 0,3 mỗi nội lực + 0,08 mỗi nộ + thưởng Kim Chung, phạt sơ hở, thưởng thắng dứt điểm. Bot eq chỉ hơn bot tham lam khoảng 4 điểm % trung bình trên các cặp gương và thua ở Cương1 (39%), Cương2 (43%), Phối2 (44%), tức là không tối ưu thật. Vì thế luôn so cả ba loại bot, tin điều ba bot cùng nói.
- Sai số: một cặp bộ với 100-150 trận có sai số khoảng ±8-10 điểm %; một bộ trung bình với 12 đối thủ khoảng ±2-3. Ô buff 80-300 trận: ±6-11 điểm.
- Kết quả gương (cùng bộ chiêu, một bên có buff hoặc cấp cao hơn) đo độ nhạy, không phải thế giới thật nơi hai người khác bộ.
- Mọi bộ 4 chiêu đều được xét, kể cả bộ không hợp lệ về mặt học (bậc 4 cần cấp 7, người cấp thấp không có). Cấp mặc định 7.
- Quét 1365 bộ dùng ba giai đoạn với đối thủ lấy mẫu ngẫu nhiên (24, 12 và 20 bộ), không phải đấu vòng tròn đủ 1365 × 1365.
- Thiên lệch chọn: các bộ "chung kết" được chọn vì đã thắng tốt ở vòng trước nên điểm của chúng hơi cao hơn thật.
- Không mô phỏng: quá giờ chọn, bỏ cuộc, vào lại, kết nối. Chỉ mô phỏng luật đấu của engine.
- Engine dùng dao động sát thương cố định 1,0 khi bot tính kỳ vọng (kết quả thật có ±10%).
