# Hướng dẫn viết chữ trong game · Chùa Tâm An

> Cập nhật: 2026-11-11 · Thẻ T-060 · Nguồn thiết kế: `docs/KE-HOACH-DOT-2026-11.md` §2.1, §8.2, §8.3, §8.5.
> Mọi thẻ viết chữ (T-061 Sổ tay, T-062 gợi ý lần đầu, T-063 Võ Học Các, T-064 Sân đấu, T-065 chánh điện/công đức/cúng dường, T-066 bài kiểm người mới) **đọc file này trước khi viết**.
> Cấu trúc: **1. Quy tắc chữ** · **2. Bảng thuật ngữ** · **3. Bí mật (không giải thích)** · **4. Chữ đang sai với mã** · **5. Cách dùng khi viết**.
> Mục "Sai" trong ví dụ là chữ thật đang có trong `public/` (trích ngắn). Mục "Đúng" là câu mẫu để thẻ sau tham khảo, không phải bản chốt; số liệu phải lấy từ mã (`MERIT.EARN`, `MARTIAL.PK`).

---

## 1. Quy tắc chữ

Đối tượng đọc: người **lần đầu vào chùa, chưa từng chơi game**, hay dùng điện thoại. Gọi người chơi là "bạn". Giọng hiền, nhà chùa, không văn hoa.

**Q1. Câu ngắn, tối đa 20 chữ.** Một câu một ý. Dài hơn thì tách câu.
- Sai: "Tác dụng chỉ là rút ngắn thời gian: công lực không vượt trần 1.000, và chỉ giúp bạn xong sớm, sức mạnh trong trận phụ thuộc cảnh giới đã đạt và các hào quang." (`dojo.js`, Luật hoàn thành ngay)
- Đúng: "Hoàn thành ngay chỉ giúp bạn tu xong sớm. Công lực vẫn không vượt trần."

**Q2. Hướng dẫn mở đầu bằng động từ.**
- Sai: "Nơi duy nhất để luận võ một đấu một." (`index.html`, thẻ Sân đấu: mô tả, không nói việc cần làm)
- Đúng: "Ra Sân đấu để luận võ một đấu một." Mẫu tốt đang có: "Chạm bát hương để thắp nhang" (`SCENE_HINT`, `app.js`).

**Q3. Mỗi cơ chế trả lời đủ 3 ý: làm gì, được gì, giới hạn gì** (thời gian chờ, số lần, có cần đăng nhập không). Thiếu ý nào là chữ chưa xong.
- Sai: nút "Thắp nhang" chỉ có tên; không nói được bao nhiêu công đức, phải đợi bao lâu (chỉ báo "Đợi 15 giây" khi bị từ chối, `server.js`)
- Đúng: "Thắp nhang: +10 công đức. Đợi 15 giây mới thắp tiếp."

**Q4. Có số thì ghi số, và số lấy từ mã, không gõ tay.** Không viết "một ít", "khá lâu", "nhiều".
- Sai: bảng điểm trong "Luật công đức" gõ cứng `1` cho các việc thay vì đọc `E.heart`, `E.mo`, `E.rejoice` (`app.js`); số lệch ngay khi mã đổi.
- Mẫu tốt đang có: "Nén nhang trước vẫn đang cháy. Đợi 15 giây rồi thắp tiếp nhé." (`server.js`, có số, có lý do).
- Đúng: dùng chỗ giữ chỗ như `{EARN.incense}`, `{PK.TURN_SECONDS}` (Sổ tay) hoặc đọc thẳng `MERIT.EARN`, `MARTIAL.PK`.

**Q5. Một khái niệm, một tên.** Chọn đúng một từ trong bảng thuật ngữ (mục 2) và dùng suốt. Không đổi từ cho "đỡ lặp".
- Sai: cùng một màn Võ Học Các có công lực, nội công, nội lực, tâm đắc, tâm pháp, công pháp đứng cạnh nhau, không phân biệt.
- Đúng: "Công lực" là điểm kinh nghiệm. "Nội lực" chỉ là thanh năng lượng trong trận.

**Q6. Từ mới giải thích ngay lần đầu xuất hiện**, trong cùng câu hoặc câu liền sau; hoặc có chấm "?" mở bảng thuật ngữ.
- Sai: "tâm đắc" chỉ được giải thích trong "Luật tu luyện" gập ở cuối trang Võ Học Các (`dojo.js`), không ở chỗ người chơi gặp nó.
- Đúng: "Tâm đắc: điểm hiểu biết của từng nhánh Cương, Tốc, Nhu. Cần đủ tâm đắc mới học được chiêu khó."

**Q7. Không hứa điều mã không làm, không nói sai điều mã làm.** Trước khi viết một con số hay một điều kiện, mở mã kiểm. Mục 4 liệt kê chỗ đang sai.
- Sai: "Chỉ người tự ra sân mới thấy và mời được nhau; chánh điện không có đánh nhau." (`index.html:113`; KH §2.1 mục 12: mời được cả từ chánh điện)
- Đúng: "Có thể mời nhau từ chánh điện; việc đánh nhau chỉ diễn ra ở Sân đấu." (T-064 kiểm lại trong mã rồi mới chốt câu)

**Q8. Nói rõ cái gì cần đăng nhập, cái gì khách vãng lai làm được.** Khách vẫn lễ Phật được, nhưng công đức gắn với trình duyệt này; đổi máy hay xóa dữ liệu trình duyệt là mất.
- Sai: "Cần đăng nhập Google để tu luyện và luận võ…" chỉ là dòng nhỏ ở cuối tab Nơi khác, dưới các thẻ (`index.html`), không nằm cạnh nút "Ra Sân đấu".
- Đúng: "Cần đăng nhập Google." ngay trên thẻ hoặc nút.

**Q9. Không nhắc bí mật** (mục 3). Muốn nhắc khéo thì chỉ dùng: "giang hồ còn nhiều cơ duyên chưa kể".
- Sai: "Ma Vương xuất hiện ở đúng 666 công đức và ban buff quỷ cấp 4 trong phòng PK có buff." (`app.js`)
- Đúng: "Quỷ ám đi theo khi tổng công đức âm. Làm việc thiện để công đức về lại từ 0 trở lên." (`merit.js:34`: quỷ tan khi tổng ≥ 0; câu cũ ở `app.js:994` cũng sai chỗ này, T-065 sửa luôn)

**Q10. Giọng nhà chùa, tôn trọng.** Dùng "đạo hữu", "tịnh tài", "tùy hỷ" đúng chỗ (mục 2); không đùa cợt với người chơi hay với Phật pháp, không tiếng lóng game ("farm", "buff" thì xem Q11).
- Sai: câu NPC "Thèm nhiêu anh đủ cắc?" và "Mình có thói quen cardio tại ban công." (`hall.js`; T-065 bỏ)
- Đúng: "Hoa rơi cửa Phật, vạn vật tùy duyên." (cùng NPC, đã hợp giọng)

**Q11. Tiếng Anh và tiếng lóng: tránh.** Nếu không đổi được (tên lá Tarot gốc), viết tiếng Việt trước, tên gốc trong ngoặc. "Buff" hiện còn trong giao diện Sân đấu; khi viết mới dùng "tăng sức" hoặc "tác dụng cộng thêm" và ghi rõ nguồn (pháp tướng, hào quang, quỷ ám).
- Sai: "Hai bên thấy buff của nhau trước khi nhận lời." (`arena.js:14`, `MODES.buff`)
- Đúng: "Hai bên thấy sức cộng thêm của nhau trước khi nhận lời."

**Q12. Lý do khi từ chối hay báo lỗi.** Mọi thông báo "không được" phải nói **vì sao** và **khi nào thử lại**, bằng tiếng Việt có dấu, giọng hiền.
- Sai: ván hòa do Tẩu Vi hiện trống lý do (T-064 xử lý, xem mục 4).
- Đúng: "Nén nhang trước vẫn đang cháy. Đợi 15 giây rồi thắp tiếp nhé." (`server.js:907`: có lý do và có số giây)
- Ngoại lệ: "Trận kết thúc hòa." (có chủ đích có chủ đích: không nêu lý do vì phải giữ bí mật tên chiêu ẩn, xem mục 3)

**Định dạng nhanh.** Tiền: `Intl.NumberFormat('vi-VN')` + `đ` ("10.000đ"). Số lớn có dấu chấm ("50.000"). Nút chạm: tên là động từ ngắn ("Thắp nhang", "Gửi lời mời"). Không viết HOA cả câu. Chữ do người dùng gửi vẫn gán bằng `textContent`/`h()`, không `innerHTML` (AGENTS.md §3.5).

---

## 2. Bảng thuật ngữ chuẩn

Bảng này gồm toàn bộ KH §8.3 và mọi từ "chưa giải thích" ở KH §2.1. Cột "Tránh" là từ đang dùng lẫn lộn, **không dùng nữa** (hoặc chỉ dùng trong ngoặc).

### 2.1 Công đức và hào quang

| Từ | Nghĩa dùng trong game (một câu) | Tránh / ghi chú |
|---|---|---|
| Công đức | Điểm tích được khi lễ Phật, tụng kinh, cúng dường. Có số "hôm nay" và số "tổng". | Thanh trên cùng là **hôm nay**; pháp tướng tính theo **tổng**. Luôn nói rõ là số nào. |
| Công đức hôm nay | Phần công đức bạn tích trong ngày; sang ngày mới về 0. Dùng cho bảng công đức. | |
| Tổng công đức | Công đức cộng dồn từ đầu, có thể âm. Dùng cho pháp tướng và quỷ ám. | "tổng điểm" |
| Pháp tướng | Vầng hình hiện sau lưng khi **tổng** công đức đạt mốc (100, 500, 1.000, 5.000, 10.000, 50.000). Có 6 mốc. | |
| Quỷ ám | Hình quỷ đi theo khi tổng công đức âm (do nói tục). Làm việc thiện thì quỷ tan. | "quỷ theo sau" chỉ dùng trong câu giải thích |
| Hào quang | Vòng sáng quanh người vừa cúng dường, sáng trong vài phút. Có 9 **tầng** (Luyện Khí … Độ Kiếp). | **"cảnh giới hào quang"**: không dùng (xem Cảnh giới). Theo KH §1 câu hỏi phụ: đổi thành "tầng", chốt ở T-065. |
| Tầng (hào quang) | Bậc của hào quang theo số tiền cúng dường cộng dồn trong lúc hào quang còn sáng; hào quang tắt thì tính lại từ đầu. Tầng 1 từ 20.000đ; tầng cao sáng lâu hơn. | |
| Cúng dường | Gửi tịnh tài cho nhà chùa bằng chuyển khoản (quét mã QR). Tối thiểu 10.000đ. | Ở chế độ thật (`live`), máy chủ chỉ xác nhận khi Ban điều hành hoặc cổng ngân hàng đã báo; ở chế độ thử (`test`) máy chủ tự xác nhận. |
| Tịnh tài | Tiền cúng dường. | "tiền ủng hộ" |
| Tùy hỷ | Vui theo việc lành của người khác (chạm "Tùy hỷ" dưới lời nguyện). | |
| Đạo hữu | Người cùng tu, cùng vào chùa (nghĩa gốc: bạn đồng tu, đồng đạo). | "người chơi", "user" |
| Lời nguyện | Câu bạn nói khi dâng nhang hoặc cúng dường, hiện cho mọi người cùng thấy. | |
| Mốc chúc mừng | Hiệu ứng hiện khi công đức hôm nay chạm mốc. Chỉ là hiệu ứng, **không có thưởng**. | |

### 2.2 Võ Học Các

| Từ | Nghĩa dùng trong game (một câu) | Tránh / ghi chú |
|---|---|---|
| Nội công | Hệ thống tu luyện ở Võ Học Các; có **cấp** 1–10. | |
| Công lực | Điểm kinh nghiệm nội công; đủ thì lên cấp. | Không gọi là "nội lực". |
| Cảnh giới | **Tên** của cấp nội công (Sơ Nhập Võ Đạo …). **Chỉ dùng cho nội công.** | Không dùng cho hào quang. |
| Công pháp (tâm pháp) | Bài tu nội công bạn chọn ở tab Tâm pháp; mỗi bài có thời lượng và nhánh riêng. Dùng "công pháp" cho bài tu, "Tâm pháp" chỉ là tên tab. | Không dùng lẫn "tâm pháp" và "công pháp" trong một đoạn. |
| Phiên tu | Một lần ngồi tu theo thời lượng đã chọn. Đóng web vẫn tu tiếp, hết giờ máy chủ tự ghi nhận. | "phiên thiền" |
| Tâm đắc | Điểm hiểu biết từng nhánh Cương / Tốc / Nhu; cần để học chiêu khó. | |
| Cương · Tốc · Nhu | Ba nhánh võ: mạnh và chịu đòn · nhanh và né · mềm và phản đòn. | Chỉ số nhanh/chậm của chiêu gọi đủ là "tốc độ", không gọi tắt "Tốc". |
| Võ học (tab) | Nơi học chiêu mới bằng tâm đắc và cấp nội công. | |
| Chiêu | Một đòn võ. | |
| Bộ chiêu | 4 chiêu mang vào trận. Tài khoản mới đã biết sẵn 6 chiêu. | |
| Thành thạo | Mức luyện một chiêu (tới "Đại viên mãn"). | "thuần thục" |
| Hoàn thành ngay | Cúng dường để phiên tu đang chạy xong sớm. Hiện mã không đặt giới hạn số lần mỗi ngày (`SPEEDUP_PER_DAY = null`, bỏ có chủ đích). Ở chế độ `live`, khoản này chỉ xong khi Ban điều hành xác nhận; ngân hàng báo thì chỉ được đánh dấu (`server.js:455`, AGENTS.md §3.2). Không viết "chuyển khoản là xong ngay". | Chữ "Không giới hạn" trong `dojo.js` là đúng với mã. Nếu sau này đặt lại giới hạn, lấy số từ `speedup.perDay`. |
| Phiếu hoàn thành ngay | Phiếu nhận khi tiền cúng dường tới sau lúc phiên đã xong hoặc đã hủy; dùng cho phiên sau. | |
| Nội lực | Thanh năng lượng **trong trận**; mỗi chiêu tốn nội lực, mỗi lượt hồi một ít. | Không dùng cho nghĩa khác (đặc biệt không lẫn với công lực). |

### 2.3 Sân đấu và danh hiệu

| Từ | Nghĩa dùng trong game (một câu) | Tránh / ghi chú |
|---|---|---|
| Luận võ (PK) | Đấu 1 đối 1 ở Sân đấu. | "PK" chỉ dùng trong ngoặc. |
| Lượt | Một nhịp của trận: hai bên chọn kín một chiêu trong thời hạn, rồi cùng lật. | |
| Nộ | Thanh tức giận; nhận sát thương thì đầy dần, đòn công kế tiếp mạnh hơn (tối đa +30%), dùng đòn công thì về 0. | |
| Sơ hở | Khi đòn bị né hoặc đỡ hết, lượt sau bạn nhận thêm sát thương. | |
| Kim Chung Tráo (tác dụng: Kim Chung) | Chiêu thủ; đỡ trúng thật thì đòn công kế tiếp của bạn mạnh hơn trong vài lượt. | Tên chiêu là "Kim Chung Tráo"; "Kim Chung" là tên tác dụng. |
| Tụ lực | Chiêu chuẩn bị, lượt sau tung đòn tụ lực mạnh hơn. | |
| Điều tức | Nghỉ một lượt để hồi thêm nội lực. | |
| Suy kiệt | Từ lượt 20, hoặc sau 4 lượt liền không ai mất máu, cả hai mất máu mỗi lượt: 5, 10, 15… tăng dần. | Số lấy từ `lib/pk/rules.js:39-41`. |
| Điểm chiến tích | 3 × số trận thắng + số trận hòa ở Sân đấu. | |
| Bậc chiến tích | 9 bậc theo điểm chiến tích (Tay Mơ Tập Võ … Độc Cô Cầu Bại). | **"Danh hiệu PK"**: không dùng nữa (đang ở Võ Học Các và Sân đấu), để khỏi lẫn với "Danh hiệu". |
| Danh hiệu | Chỉ dùng cho danh hiệu "lịch sử" / "hiện tại" của người đứng đầu (Kỳ Thánh, Võ Lâm Chí Tôn …). | |
| Mùa | Một tháng âm lịch, từ mùng 1 đến cuối tháng. Dùng cho danh hiệu "hiện tại". | |
| Bảng Vàng | Nơi ghi tên người giữ danh hiệu (T-043). | |

### 2.4 Bản đồ, bói toán và Kỳ Đạo

| Từ | Nghĩa dùng trong game (một câu) | Tránh / ghi chú |
|---|---|---|
| Map | Khu vực đi lại được: Chánh điện, Sân chùa, Tàng Kinh Các, Sân đấu. Đổi bằng thanh đổi map. | "cảnh" (tên trong mã) |
| Nơi | Màn hình riêng không đi lại được: Võ Học Các. | "place" |
| Thanh đổi map | Dải 4 nút để sang map khác; nút của map đang đứng sáng lên. | Không để nút việc (xin xăm, tử vi) lẫn vào. |
| Khám phá | Tab liệt kê chùa có những gì (đổi tên từ "Nơi khác"). | |
| Xin xăm | Chạm hũ xăm ở chánh điện để máy chủ rút một quẻ trong 12 quẻ. | |
| Quẻ | Một lời xăm (12 quẻ). | |
| Tarot | Trải 5 lá theo chủ đề và khung thời gian bạn chọn; chạm thầy Tarot ở Sân chùa. | Tên lá viết tiếng Việt, tên gốc trong ngoặc. |
| Lá số tử vi | Bản lập theo ngày giờ sinh, tính trên máy bạn, **không gửi đi**. | Hộp "Xem tử vi" cũ chỉ so địa chi năm sinh; không gọi là lá số. |
| Kỳ Đạo | Năm môn cờ đánh ở bàn đá ngoài Sân chùa. | |
| Elo | Điểm sức cờ từng môn; thắng người mạnh hơn được cộng nhiều. | |
| Ván xếp hạng · giao hữu | Ván có / không tính Elo. | |
| Kỳ Thánh · Kỳ Vương (kèm tên môn) | Danh hiệu cờ của một môn. "Kỳ Thánh Cờ Tướng" = người có đỉnh Elo cao nhất từng đạt (lịch sử). "Kỳ Vương Cờ Tướng" = người đang có Elo cao nhất (hiện tại). | Tên đề xuất ở KH §6.1, chốt ở T-040. |

### 2.5 Giao diện

| Từ | Nghĩa dùng trong game (một câu) | Tránh / ghi chú |
|---|---|---|
| Thanh lễ Phật | Thanh nút dưới cùng: các việc lễ Phật (thắp nhang … cúng dường). | "thanh dưới" |
| Nói chuyện (giọng nói) | Nói bằng micro với người đứng gần; đứng gần nghe rõ, xa nhỏ dần. | Hộp "Đang nghe · mic tắt": nói rõ "bạn chỉ nghe, chưa bật micro". |
| Sổ tay | Nút "?" ở thanh trên cùng, mở trang giải thích mọi cơ chế (T-061). | |

---

## 3. Bí mật: không giải thích, và cách nhắc khéo

*Ghi chú: theo giáo lý (Pháp Bảo Đàn Kinh, phẩm Nghi Vấn), cúng dường sinh "phước đức"; game gọi chung là "công đức" là quy ước có chủ đích.*

Mỗi bí mật là một điều vui khi tự khám phá. Chữ trong game, Sổ tay, gợi ý lần đầu và bài kiểm **không được** tiết lộ điều kiện hay hiệu ứng của chúng.

| Bí mật | Ở đâu trong mã | Đang lộ ở | Việc cần làm |
|---|---|---|---|
| Đúng 666 tổng công đức → Ma Vương + buff PK | `merit.js`, `server.js` | `app.js` (dòng mô tả bậc quỷ) nói rõ hiệu ứng và buff | T-065 viết lại câu đó, không nhắc 666 và buff |
| Hù ở mốc 666 trong ngày | `celebrate.js`, `server.js` | Thẻ "Hiệu ứng": "Cho phép hù ở mốc 666"; dòng nhỏ dưới liệt kê các mốc gồm 666 | Đổi công tắc thành "Cho phép hiệu ứng bất ngờ" (giữ công tắc vì có người sợ); bỏ 666 khỏi dòng liệt kê |
| `?celebrate=N` | `app.js`, `celebrate.js` | README (tài liệu vận hành, chấp nhận) | Không đưa vào Sổ tay |
| Đầu tượng Phật meme | `hall.js` | không | Giữ |
| Ba NPC bí mật và 3 chiêu ẩn (Như Lai Thần Chưởng, Tẩu Vi Thượng Sách, Kamui) | `lib/martial/secrets.js`, `engine.js`, `arena.js` | không với người chưa sở hữu (tên và mô tả chiêu có sẵn trong mã trình duyệt `arena.js:58-59, 1246`, chỉ hiện khi sở hữu) | Không nhắc tên, vị trí, điều kiện; Sổ tay chỉ nói câu nhắc khéo bên dưới. T-061 và T-064 không dùng lại dữ liệu này làm chữ chung |
| Tảo Địa Tăng | `lib/sweeper.js` | không | Giữ |
| Màn đối đầu huyền thoại (mới) | `legend.js` | không | Không giải thích, chỉ có công tắc tắt |

**Cách nhắc khéo (dùng đúng câu này, hoặc câu ngắn tương đương):**
- "Giang hồ còn nhiều cơ duyên chưa kể."
- Khi người chơi hỏi hay Sổ tay phải nhắc tới điều ẩn: "Có những chuyện, đi rồi sẽ gặp."

**Không làm:**
- Không viết con số của mốc bí mật ("666") hay tên chiêu ẩn trong bất kỳ chuỗi hiển thị nào, kể cả `title`, `aria-label`, thông báo lỗi và câu trong bài kiểm.
- Không để bài kiểm người mới (T-066) hỏi về bí mật.
- Bí mật vẫn được ghi ở **tài liệu cho nhà phát triển** (`docs/`, chú thích mã), nhưng không đưa vào chữ người chơi đọc được.
- Ghi chú: `?celebrate=666` và `Celebrate.test(666)` là công cụ thử cho người vận hành, hợp lệ trong mã và README.

---

## 4. Chữ đang sai với mã (để T-063, T-064, T-065 sửa)

Mỗi dòng: chữ hiện tại, sự thật trong mã, thẻ sửa. Danh sách đầu (mục 1 đến 3) là KH §2.1 mục 12; phần còn lại là các chỗ khác thấy khi soát chữ để viết file này.

| # | Chữ hiện tại (vị trí) | Sự thật | Thẻ |
|---|---|---|---|
| 1 | "Chỉ người tự ra sân mới thấy và mời được nhau; chánh điện không có đánh nhau." (`public/index.html`, thẻ Sân đấu trong tab Nơi khác) | KH §2.1 mục 12: mời được cả từ chánh điện; đánh nhau vẫn chỉ diễn ra ở Sân đấu. T-064 kiểm lại trong mã trước khi sửa. Chú ý chữ này nằm ở `index.html` (thẻ tab Nơi khác), không phải `arena.js` | T-064 (kèm T-011/T-065 vì sửa `index.html`) |
| 2 | "Không giới hạn số lượt hoàn thành tu luyện nhanh." (`public/js/dojo.js`, 2 chỗ) | **Chữ này ĐÚNG với mã**: `server.js:73` `SPEEDUP_PER_DAY = null`, `lib/martial/service.js:64` `perDay = () => null` (bỏ có chủ đích, commit 3615121). Tài liệu lệch là `docs/VO-HOC.md:98,145` và KH §2.1 mục 12/§8.7. Dòng cảnh báo "đã dùng đủ lượt" là mã chết (`used = false`). Đề nghị Điều phối mở thẻ sửa `docs/VO-HOC.md` và chỉnh mô tả T-063 (không sửa chữ `dojo.js`) | T-063 (chỉnh) |
| 3 | Ván hòa do Tẩu Vi Thượng Sách hiện trống lý do (`public/js/arena.js`) | Hòa có `reason: 'escape'`; chữ cần: "Trận kết thúc hòa." **không** nhắc tên chiêu ẩn | T-064 |
| 4 | Câu "phòng cân bằng" (KH §2.1/§8.7 nói sai) có thể là mô tả `MODES.balanced`: "Nội công, pháp tướng, quỷ ám và hào quang đều ảnh hưởng sức mạnh." (`arena.js`). Không tìm thấy cụm "phòng cân bằng" nguyên văn trong `public/` | Lời mời chỉ dùng chế độ `buff` (vòng lặp `['buff']`). HP chung 200, nhưng cảnh giới nội công vẫn tăng sức đánh (+4%/cấp), sức chịu đòn và nội lực tối đa (`public/js/martial.js:159-164`, `lib/pk/engine.js:282,319`). Câu cần sửa là `desc` của `MODES.buff` (thiếu nhắc nội công); `desc` của `balanced` là mã chết. T-064 xác định đúng câu | T-064 |
| 5 | "Ma Vương xuất hiện ở đúng 666 công đức và ban buff quỷ cấp 4 trong phòng PK có buff." (`app.js`, hộp mô tả bậc quỷ) | Lộ bí mật (mục 3) | T-065 |
| 6 | "Cho phép hù ở mốc 666" và dòng "Mốc 100, 300, 500, 666, 888, 999…" (`index.html`, thẻ Hiệu ứng) | Lộ bí mật (mục 3) | T-065 |
| 7 | Bảng "Được cộng" trong Luật công đức gõ cứng `1` cho các việc | Phải đọc `E.heart`, `E.mo`, `E.rejoice` (hiện cùng bằng 1 nên chưa lệch, nhưng sẽ lệch khi đổi) | T-065 |
| 8 | Thanh trên cùng hiện công đức; không nói là **hôm nay** (`app.js`, `index.html`) | Thanh trên cùng = hôm nay; pháp tướng theo tổng | T-065 |
| 9 | Thời gian chờ không báo trước (`server.js`): nhang 15 giây, chuông 10 giây mỗi người (+2,5 giây chung), dâng 3 giây, khởi tụng 30 giây mỗi người và 10 giây sau khi khóa trước kết thúc (`server.js:957-958`; Ban điều hành được bỏ qua mốc 10 giây) | Chỉ nhang và chuông nêu số giây khi bị từ chối; dâng ("vài giây") và tụng ("ít giây", "một chút") không có số | T-065 |
| 10 | Nhãn "Hiệu ứng chúc mừng ở các mốc công đức" (`index.html:161`) và dòng gợi ý (`index.html:163`): không nói không có thưởng | Mốc chúc mừng không có thưởng; thêm câu "chỉ là hiệu ứng, không có thưởng" | T-065 |
| 11 | "Xem 9 cảnh giới hào quang", "Hào quang 9 cảnh giới", "đột phá cảnh giới …" (`index.html`, `app.js`, `aura.js`, thông báo) | "Cảnh giới" chỉ dùng cho nội công; đổi "tầng" nếu chủ dự án đồng ý (KH §1 câu hỏi phụ) | T-065 |
| 12 | Toast "Tảo Địa Tăng truyền thừa: +… công lực, lên cảnh giới …" (`app.js`) | Cảnh giới ở đây là của nội công: đúng, giữ | không đổi |
| 13 | "Danh hiệu PK" (`dojo.js` dòng "Danh hiệu PK:", tiêu đề `h4`; `arena.js` dòng fact "Danh hiệu PK") | Thành "Bậc chiến tích" | T-063, T-064 |
| 14 | Dòng hướng dẫn `#stageHint` bị ẩn trên màn ≤ 900px; hộp "Đang nghe · mic tắt" che dòng hướng dẫn (KH §2.1 mục 2, 3) | Điện thoại không biết "chạm sàn để đi lại" | T-062, T-065 (viết lại `SCENE_HINT`) |
| 15 | Phím WASD / mũi tên đi được, không nơi nào nói (KH §2.1 mục 13) | Phải nói ở Sổ tay mục "Bắt đầu" | T-061 |
| 16 | Tài khoản mới đã biết sẵn 6 chiêu: không nói (KH §2.1 mục 9) | Nói ở tab Võ học | T-063 |
| 17 | "Luật tu luyện" gập ở cuối trang (KH §2.1 mục 9) | Mở sẵn lần đầu | T-063 |
| 18 | Luật chiến đấu chỉ một câu, nằm trong ngăn "Danh sách" đang đóng (KH §2.1 mục 10) | Cần dải "Luật nhanh": lượt 20 giây, bỏ 3 lượt thì thua, nộ tăng thế nào, tối đa 40 lượt | T-064 |
| 19 | NPC "Thèm nhiêu anh đủ cắc?" và "cardio tại ban công" (`hall.js`) | Không hợp giọng nhà chùa; xem Q10 | T-065 |
| 20 | Hộp "Xem tử vi" (`fortune.js`, tiêu đề "Xem tử vi sắp tới") dễ hiểu lầm là lá số | Chỉ so địa chi năm sinh với 3 tháng âm tới; sẽ thay khi làm tử vi (T-054 đến T-057; ngoài phạm vi chữ của T-060) | thẻ Bói toán |

Quy ước khi sửa: mỗi thẻ ghi trong báo cáo bàn giao bảng "chữ cũ → chữ mới" cho các dòng của mình, để T-066 dò lại.

---

## 5. Cách dùng khi viết một chuỗi mới

1. Tìm từ trong mục 2. Có rồi thì dùng đúng từ đó; chưa có thì thêm một dòng vào mục 2 cùng thẻ.
2. Viết theo Q1 đến Q3. Mở mã lấy đúng số (Q4, Q7).
3. Kiểm mục 3: câu có nhắc bí mật không? Nếu có thì bỏ.
4. Đọc to một lần: người chưa chơi game có hiểu không?
5. Sửa file trong `public/` thì tăng `?v=` trong `public/index.html` (AGENTS.md §3.13), chữ giao diện luôn tiếng Việt có dấu, UTF-8.
