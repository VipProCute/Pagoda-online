# Phá Sơn, Tứ Lạng và độ thành thạo

## Hành vi

- Phá Sơn: đứng chuẩn bị một lượt, không giảm sát thương; lượt sau bắt buộc tung. Đòn tung không thử né hay đỡ thường, bỏ qua chiêu thủ, giảm bị động và giảm từ nội công.
- Tứ Lạng: chọn đúng lượt Phá Sơn tung thì phản chắc, trả nguyên sát thương chuẩn về người tung. Không nhân công/buff của người phản; giáp của người tung không làm giảm phần phản. Chọn Tứ Lạng ở lượt chuẩn bị không phản gì.
- Đòn nhanh tốc ≥80 không bị Tứ Lạng đỡ/phản: Tật Phong, Liên Hoàn, Liễu Diệp, đòn công Đoạt Ảnh. Đỡ thường của Tứ Lạng với đòn chậm vẫn theo xác suất.
- Bị hạ trong lượt chuẩn bị thì Phá Sơn không được tung. Hai người cùng tụ lực bị buộc cùng tung nên không thể đổi sang Tứ Lạng ở lượt sau.
- Độ thành thạo 0 / 20 / 60 / 120 / 240 XP; Phá Sơn có sát thương gốc 70 / 90 / 115 / 145 / 180. Cấp nội công ≥7 và Đại viên mãn gây ít nhất 201 sát thương trước đối thủ HP 200, ngay tại dao động thấp nhất và không cần nộ/buff. Phản lại cũng trả đúng lượng đó.

## Luyện và lưu tiến độ

Chọn một chiêu đã học trước khi bắt đầu phiên tu nội công; 15 phút thời lượng gốc nhận 2 XP khi hoàn thành, tối đa 240 XP/chiêu. Nội công đã đầy vẫn luyện chiêu được. Hủy phiên không nhận; hoàn thành ngay chỉ cộng khi được xác nhận, dùng phiếu cũng đi qua cùng sổ cái chống cộng trùng. Không có XP từ spam PK.

Hồ sơ cũ giữ tiến độ cũ và bắt đầu thuần thục 0. Gộp Google cộng XP có trần và hỗ trợ hoàn tác như phần hồ sơ còn lại. Trận chụp riêng độ thành thạo lúc nhận lời; tu xong giữa trận không tăng sức mạnh của trận đó. Nhật ký lưu level, mastery, seed và lựa chọn để phát lại.

## Kiểm chứng

`npm run check`; `npm test`. Các kiểm thử mới gồm ma trận nhiều cấp/bậc/RNG trước mọi chiêu; phản đúng nguyên sát thương; Tứ Lạng không phản đòn nhanh; bị hạ lúc chuẩn bị; tiến độ phiên thường/hủy/xác nhận trùng/lưu lại/gộp Google; snapshot qua manager và socket thật sau khởi động lại.

`node tools/pk-sim/audit100k.js`: đúng 100.000 trận, bao gồm 40.000 ngang cấp 1–10, 20.000 lệch cấp, 16.380 sàng lọc đủ 1.365 bộ, 6.400 kiểm chứng, 6.000 vòng tròn, 1.220 kịch bản và 10.000 buff. Metadata mô tả từng nhóm độ thành thạo; không giả định mọi nhân vật đều Đại viên mãn. Mẫu chuyên biệt có 305 trận mỗi tình huống, tất cả ở cấp 10, Đại viên mãn, không buff:

| Bên chủ động | Phản ứng | Thắng của bên chủ động |
|---|---|---|
| Phá Sơn | Tật Phong lúc chuẩn bị, Thiết Bích lúc tung | 100% |
| Phá Sơn | Tật Phong lúc chuẩn bị, Nhu Vân lúc tung | 100% |
| Phá Sơn | Tật Phong lúc chuẩn bị, Tứ Lạng lúc tung | 0% |
| Tật Phong liên tục | Tứ Lạng liên tục, đủ nội lực thì dùng | 100% |

Các tỷ lệ 100% quan sát ở trên còn được bảo đảm bằng nhánh luật tương ứng và kiểm thử biên; không phải khẳng định chiến thuật lặp một chiêu thắng mọi cách chơi khác.

`node tools/pk-sim/counter-check.js`: sàng lọc 364 bộ chứa Tứ Lạng, 20 trận/bộ, sau đó 1.000 trận kiểm chứng độc lập cho từng bộ. Đối thủ là Phá Sơn + Tứ Lạng + Tật Phong + Liên Hoàn; cả hai cấp 10, Đại viên mãn, bot eq:

| Bộ kiểm chứng | Thắng | Hòa |
|---|---:|---:|
| Trọng Quyền + Phản Chấn + Liên Hoàn + Tứ Lạng | 80,6% | 0,7% |
| Trọng Quyền + Liên Hoàn + Liễu Diệp + Tứ Lạng | 79,2% | 1,1% |
| Trọng Quyền + Phá Sơn + Liên Hoàn + Tứ Lạng | 81,4% | 0,4% |

Bot eq chỉ tính kỳ vọng một lượt cộng lượt tung tụ lực; không đọc chiêu vừa khóa của đối thủ và không tối ưu toàn trận. Có các đối khắc chế cho bộ tưởng đa dụng; chưa kết luận toàn bộ 1.365 bộ đã cân bằng tuyệt đối. Số liệu lịch sử trong `VO-HOC-CAN-BANG.md` thuộc luật cũ.
