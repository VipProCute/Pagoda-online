# Cờ tướng úp (揭棋) · Nghiên cứu luật (T-023)

> Ngày nghiên cứu: 2026-11-12. Mục tiêu: bộ luật rõ ràng, có nguồn, để T-024 làm không phải đoán.
> Quy ước chung: **một bộ luật đề xuất duy nhất theo D7 + KH §5.4**. Chỗ nào nguồn khác mặc định thì để ở mục 👤 riêng (§7).

## 1. Nguồn

Đã mở trực tiếp (xác minh nguyên văn, 2026-11-12):

1. Wikipedia tiếng Trung, 揭棋: https://zh.wikipedia.org/wiki/揭棋
2. 天天象棋, 揭棋玩法说明 (luật chính thức): https://image.qqchess.qq.com/test_160324/activity/html/jieqiguize.html

Chỉ đọc được qua kết quả tìm kiếm (trang trả lỗi khi mở: CSDN HTTP 521, 简书 HTTP 403), nên coi là **chưa xác minh nguyên văn**:

3. CSDN, 《揭棋人工智能探秘》 (tác giả nói luật "không ai biết quân bị ăn" là thiết kế riêng của mình; truyền thống là bên ăn thấy): https://blog.csdn.net/zhyjie2008/article/details/129221368
4. 简书, 揭棋: https://www.jianshu.com/p/9e3f6c6aa6ad (cùng câu với Wikipedia)
5. Hi8, 揭棋在线玩 (bản web, lật cho cả hai bên): https://hi8.com/g/jieqixiangqi

## 2. Luật đề xuất

### 2.1 Bố cục và xáo

- Mỗi bên: **Tướng ngửa** ở cung (e0 / e9). 15 quân còn lại (2 Sĩ, 2 Tượng, 2 Mã, 2 Xe, 2 Pháo, 5 Tốt) **úp mặt**, xáo ngẫu nhiên lên 15 ô ban đầu của bên mình.
- Máy chủ xáo bằng `makeRng(seed)` + Fisher–Yates; seed giữ kín tới hết ván (KH §5.4).
- Nguồn: Wikipedia, 天天象棋 (quân úp đi theo ô đang đứng).

### 2.2 Quân úp đi và lật

- **Quân úp luôn đứng ở ô ban đầu** (vì đi là lật). Nó đi theo quân **chủ nhà của ô** (ô Mã đi như Mã, ô Pháo đi như Pháo, ô Tốt chỉ tiến 1 bước, ô Sĩ đi chéo 1 trong cung, ô Tượng đi chéo 2 có cản mắt, ở phần sân nhà). Nó đóng vai quân cản/ngòi như mọi quân khác, có thể ăn và bị ăn.
- Đi xong **lật lên** thành quân thật, từ đó đi theo quân thật. Nước lật báo cho cả hai bên (`reveal`).
- Nguồn: Wikipedia ("暗子的走法依其所在位置而定", "走子完毕后，必须翻开").

### 2.3 Quân đã lật

- Xe, Mã, Pháo: luật cờ tướng thường.
- **Sĩ/Tượng đã lật (D7):** vẫn giữ **cách đi** (Sĩ chéo 1 ô; Tượng chéo 2 ô, bị cản mắt), nhưng **bỏ giới hạn cung và sông**: Sĩ ra khỏi cung được, Tượng qua sông được. Nguồn: Wikipedia ("相（象）和仕（士）允许过河"; Sĩ ngửa "可以出九宫并过河"), 天天象棋 ("揭开后的士、象可以过河").
- **Sĩ úp (ô Sĩ):** vẫn chỉ đi chéo 1 ô **trong cung**, tức chỉ đi tới e1 / e8 (Wikipedia: "依然不能走出九宫"). Quân úp ở ô Tượng đi như Tượng: chéo 2 ô, cản mắt, không qua sông (không có chuyện "ra khỏi cung", Tượng vốn ở ngoài cung).
- **Tốt:** theo vị trí hiện tại, như cờ tướng thường (Wikipedia: lật rồi "按照中国象棋的行棋规则走棋"): chưa qua sông chỉ tiến; qua sông thêm đi ngang; **ở hàng cuối đối phương chỉ đi ngang** (suy ra từ luật cờ tướng, nguồn không nói riêng).
- Tướng: như cờ tướng (trong cung, không lộ mặt).

### 2.4 Ăn quân úp (D7)

- Quân úp bị ăn **lật công khai cho cả hai bên** (và người xem): gói tin nước đi kèm danh tính quân bị ăn. Không có quân bị ăn nào còn bí mật. Quân úp **chưa** bị ăn thì tuyệt đối không lộ.
- Phương án khác (chỉ bên ăn biết) xem §7.

### 2.5 Kết thúc ván

Tách hai nhóm:

**Thua**
- Bị chiếu hết hoặc hết nước đi hợp lệ (Wikipedia: "将死、困毙"); hết giờ; xin thua.
- Lặp thế lần 3 mà một bên **chiếu ở mọi nước trong vòng lặp** thì bên đó thua (KH §5.4, bản rút gọn; Wikipedia chỉ nói "长打" là bên thua).

**Hòa**
- Lặp thế lần 3 mà **không ai** chiếu liên tục: hòa (KH §5.4).
- Không ăn quân **60 nước mỗi bên (120 nửa nước)**: hòa (KH §5.4).
- Hai bên đồng ý hòa.

**Hồi (回合)** = 1 nước của Đỏ + 1 nước của Đen = **2 nửa nước**. Vì vậy "40 hồi" của 天天象棋 = 80 nửa nước, còn KH dùng 120 nửa nước. Các hằng số này nên đọc từ một chỗ để đổi được (👤 §7).

### 2.6 Bất biến bảo mật

- `view(state, side)` không chứa danh tính quân chưa lật, với cả hai bên và người xem. Test duyệt đệ quy mọi gói `kd:*`.
- `legalMoves(view) == legalMoves(state đầy đủ)`: nước hợp lệ chỉ phụ thuộc ô chủ nhà, không phụ thuộc quân thật.

## 3. Ký hiệu trong sơ đồ

Cột a–i, hàng 0–9, Đỏ ở hàng 0 (ICCS, KH §5.4). Chữ hoa = Đỏ, chữ thường = Đen. `K/k` Tướng, `S/s` Sĩ, `T/t` Tượng, `M/m` Mã, `X/x` Xe, `P/p` Pháo, `O/o` Tốt. **`■` = quân úp Đỏ, `□` = quân úp Đen.** `+ * !` = ô đến (xem từng hình). Ký hiệu Việt: Đỏ đếm cột từ phải sang trái (i=1 … a=9), Đen đếm ngược lại.

## 4. Năm tình huống minh họa

### TH1. Quân úp ở ô Mã đi như Mã rồi lật

Đỏ có quân úp ở h0 (ô Mã phải). Nó đi như Mã tới g2 (nước h0g2, ký hiệu `M2.3`, ghi theo quân chủ nhà), rồi lật: ra **Pháo**. Từ g2 trở đi nó đi như Pháo. Cả hai bên thấy lật.

```
Trước                    Sau (lật ra Pháo)
  a b c d e f g h i        a b c d e f g h i
9 . . . . . k . . .      9 . . . . . k . . .
8 . . . . . . . . .      8 . . . . . . . . .
7 . . . . . . . . .      7 . . . . . . . . .
6 . . . . . . . . .      6 . . . . . . . . .
5 . . . . . . . . .      5 . . . . . . . . .
  ~ ~ ~ ~ sông ~ ~ ~ ~     ~ ~ ~ ~ sông ~ ~ ~ ~
4 . . . . . . . . .      4 . . . . . . . . .
3 . . . . . . . . .      3 . . . . . . . . .
2 . . . . . . . . .      2 . . . . . . P . .
1 . . . . . . . . .      1 . . . . . . . . .
0 . . . . K . . ■ .      0 . . . . K . . . .
```

### TH2. Ăn quân úp: ai thấy

Đen có Xe ở i7; Đỏ có quân úp ở i3 (ô Tốt phải). Xe đi dọc cột i ăn quân úp (`i7i3`, `X9.4`). Quân bị ăn lật ra **Mã** và, theo D7, **cả hai bên cùng thấy** "Đỏ mất Mã".

```
Trước                    Sau (Xe ăn, bị ăn là Mã Đỏ)
  a b c d e f g h i        a b c d e f g h i
9 . . . . . k . . .      9 . . . . . k . . .
8 . . . . . . . . .      8 . . . . . . . . .
7 . . . . . . . . x      7 . . . . . . . . .
6 . . . . . . . . .      6 . . . . . . . . .
5 . . . . . . . . .      5 . . . . . . . . .
  ~ ~ ~ ~ sông ~ ~ ~ ~     ~ ~ ~ ~ sông ~ ~ ~ ~
4 . . . . . . . . .      4 . . . . . . . . .
3 . . . . . . . . ■      3 . . . . . . . . x
2 . . . . . . . . .      2 . . . . . . . . .
1 . . . . . . . . .      1 . . . . . . . . .
0 . . . . K . . . .      0 . . . . K . . . .
```

### TH3. Sĩ/Tượng đã lật đi tự do

Đỏ có Sĩ đã lật ở e4 (ngoài cung), Tượng đã lật ở c4, Tốt Đen ở d5, và quân úp ở f0 (ô Sĩ). Sĩ ngửa vẫn đi chéo 1 ô nhưng được ra khỏi cung và qua sông: `+` là ô đi được, `!` là ăn Tốt d5 (`S5.6`). Tượng ngửa vẫn chéo 2 ô: `*` là ô đi được (a6 qua sông, `T7.9`; a2; e2); **e6 không đi được vì bị cản mắt ở d5**. Quân úp ở f0 (ô Sĩ) chỉ đi f0e1.

```
Thế cờ                   Nước đi
  a b c d e f g h i        a b c d e f g h i
9 . . . . . k . . .      9 . . . . . k . . .
8 . . . . . . . . .      8 . . . . . . . . .
7 . . . . . . . . .      7 . . . . . . . . .
6 . . . . . . . . .      6 * . . . . . . . .
5 . . . o . . . . .      5 . . . ! . + . . .
  ~ ~ ~ ~ sông ~ ~ ~ ~     ~ ~ ~ ~ sông ~ ~ ~ ~
4 . . T . S . . . .      4 . . T . S . . . .
3 . . . . . . . . .      3 . . . + . + . . .
2 . . . . . . . . .      2 * . . . * . . . .
1 . . . . . . . . .      1 . . . . . . . . .
0 . . . . K ■ . . .      0 . . . . K ■ . . .
```

### TH4. Tốt lật ra ở hàng cuối đối phương

Đỏ có quân úp ở a0 (ô Xe), cột a thông. Nó đi như Xe tới a9 (`a0a9`, `X9.9`), lật ra **Tốt**. Tốt ở hàng cuối Đen chỉ còn đi ngang: nước tiếp theo chỉ có a9b9 (ăn quân úp Đen ở b9, ô Mã; quân đó lật công khai theo D7).

```
Trước                    Sau (lật ra Tốt)
  a b c d e f g h i        a b c d e f g h i
9 . □ . . . k . . .      9 O □ . . . k . . .
8 . . . . . . . . .      8 . . . . . . . . .
7 . . . . . . . . .      7 . . . . . . . . .
6 . . . . . . . . .      6 . . . . . . . . .
5 . . . . . . . . .      5 . . . . . . . . .
  ~ ~ ~ ~ sông ~ ~ ~ ~     ~ ~ ~ ~ sông ~ ~ ~ ~
4 . . . . . . . . .      4 . . . . . . . . .
3 . . . . . . . . .      3 . . . . . . . . .
2 . . . . . . . . .      2 . . . . . . . . .
1 . . . . . . . . .      1 . . . . . . . . .
0 ■ . . . K . . . .      0 . . . . K . . . .
```

### TH5. Quân úp bị ghim

Đen có Xe ở i0 trên hàng 0, Đỏ có Tướng e0 và quân úp ở f0 (ô Sĩ) đứng giữa, g0 và h0 trống. Quân úp f0 bị ghim: nó chỉ có nước f0e1 (theo ô Sĩ), mà nước đó mở hàng 0 cho Xe chiếu Tướng nên **cấm**. Dù quân thật là Xe (đáng lẽ ăn được Xe i0) thì vẫn bị ghim, vì nước đi chỉ tính theo ô chủ nhà. Kiểm chiếu cũng tính theo ô chủ nhà, không theo quân thật.

```
Thế cờ                   Nước giả định f0e1 (cấm)
  a b c d e f g h i        a b c d e f g h i
9 . . . k . . . . .      9 . . . k . . . . .
8 . . . . . . . . .      8 . . . . . . . . .
7 . . . . . . . . .      7 . . . . . . . . .
6 . . . . . . . . .      6 . . . . . . . . .
5 . . . . . . . . .      5 . . . . . . . . .
  ~ ~ ~ ~ sông ~ ~ ~ ~     ~ ~ ~ ~ sông ~ ~ ~ ~
4 . . . . . . . . .      4 . . . . . . . . .
3 . . . . . . . . .      3 . . . . . . . . .
2 . . . . . . . . .      2 . . . . . . . . .
1 . . . . . . . . .      1 . . . . ■ . . . .
0 . . . . K ■ . . x      0 . . . . K . . . x
```

Ghi chú: do bố cục, quân úp **không bao giờ chiếu được Tướng** (từ ô gốc nó không với tới cung đối phương); chỉ quân ngửa hoặc quân vừa lật mới chiếu. Nên có test cho điều này ở T-024.

## 5. Bảng so sánh

| Yếu tố | Nguồn tìm thấy | Mặc định KH (D7 + §5.4) | Đề xuất |
|---|---|---|---|
| Quân úp bị ăn | Wikipedia, 天天象棋: bên bị ăn không được xem; Hi8: lật cho cả hai; CSDN (biến thể): không ai biết | Lật công khai cho cả hai (D7) | **Theo D7** |
| Sĩ/Tượng đã lật | Wikipedia, 天天象棋: qua sông; Wikipedia: Sĩ ngửa ra cung | Đi tự do (D7), giữ cách đi chéo | **Theo D7** |
| Sĩ úp | Wikipedia: không ra cung | Không nói | Chỉ e1/e8 trong cung |
| Tốt lật ra | Wikipedia: theo luật thường | Hàng cuối chỉ đi ngang | Theo KH |
| Hòa không ăn quân | 天天象棋: 40 hồi (80 nửa nước) | 60 nước mỗi bên (120 nửa nước) | Theo KH, 👤 §7 |
| Lặp thế | Wikipedia: 长打 thua; 天天象棋: 长将/长捉 quá 6 hồi thì 禁着 (cấm nước đó) | Lặp lần 3: chiếu liên tục thua, không thì hòa | Theo KH, 👤 §7 |
| Xin hòa | 天天象棋: chỉ sau hồi 7 | Không nói | Không làm ở bản đầu |

## 6. Biến thể phổ biến

- **天天象棋:** quân úp bị ăn thì bên bị ăn không thấy; Sĩ/Tượng lật được qua sông; 长将/长捉 quá 6 hồi thì cấm nước đó (禁着, không phải thua); 40 hồi không ăn quân hòa.
- **Hi8 (web):** lật cho cả hai bên khi bị ăn.
- **Biến thể "không ai biết":** CSDN nêu ra, tác giả nhận là thiết kế riêng.
- **暗棋 / banqi** (cờ úp trên nửa bàn) là trò khác, không phải 揭棋.

## 7. 👤 Cần chủ dự án chốt (khác mặc định KH)

1. **Quân úp bị ăn chỉ bên ăn biết** (Wikipedia, 天天象棋: bên bị ăn không được xem; truyền thống bên ăn thấy). Giữ bí mật hơn nhưng `view` phải gửi khác nhau cho bên ăn, bên bị ăn và người xem; ở bản đề xuất hiện tại (D7) thì không cần.
2. **Hòa 40 hồi** (80 nửa nước, 天天象棋) thay vì 60 nước mỗi bên.
3. **长将/长捉 quá 6 hồi thì cấm nước đó** (天天象棋) thay cho luật lặp thế rút gọn của KH.
4. Xin hòa chỉ sau hồi 7 (天天象棋).

Nếu chủ dự án không đổi gì, T-024 làm đúng §2.

## 8. Ghi chú cho T-024

- Ghi nước kèm `info.reveal` (quân vừa lật) và `info.captured` (danh tính quân bị ăn, nếu là quân úp), gửi cho mọi bên.
- Sinh nước và kiểm chiếu cho quân úp dùng **loại quân của ô chủ nhà**; quân vừa lật được tính theo thân phận thật từ sau nước đi.
- Sổ tay ghi rõ luật lặp thế/hòa là bản rút gọn.
