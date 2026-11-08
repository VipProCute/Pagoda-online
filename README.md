# Chùa Tâm An · Đi chùa online

Chánh điện trực tuyến cho nhiều người cùng lúc. Mỗi người vào chùa là một nhân vật mặc áo dài, có tên trên đầu, đi lại trong chánh điện và thấy nhau theo thời gian thực.

## Chế độ cúng dường thử nghiệm

Mặc định `DONATION_MODE=test`: game tạo QR nội bộ không chứa tài khoản ngân hàng và tự xác nhận lượt thử nghiệm sau 10 giây, kể cả yêu cầu hoàn thành tu luyện. Không cần quét mã hay chuyển tiền. Các lượt giả lập được đánh dấu `mode=test`, `source=simulation`, không cộng vào tổng tiền cúng dường thật hoặc số tiền quỹ thực nhận; công đức, hào quang và tiến độ game vẫn được cấp để chơi thử. Mã chuyển khoản thật đang chờ từ trước sẽ không tự được xác nhận.

Khi chuẩn bị nhận tiền thật, cấu hình `DONATION_MODE=live`, tài khoản ngân hàng và quy trình đối soát/SePay; kiểm tra toàn bộ luồng thật trước khi mở. Phần thưởng game của các lượt thử nghiệm đã cấp sẽ vẫn nằm trong dữ liệu người chơi, cần quyết định cách xử lý trước khi chuyển production. Máy chủ cần lưu dữ liệu bền vững để khôi phục các lượt thử nghiệm đang chờ sau khi khởi động lại.

## Tính năng

| Nhóm | Có gì |
|---|---|
| Chánh điện | Ba tôn tượng, bàn thờ, bát hương, nến, đèn lồng, tủ Tàng Kinh Các. Chạm sàn (hoặc phím mũi tên / WASD) để đi lại. Chạm bát hương để thắp nhang, chạm tượng để vái lạy, chạm tủ kinh để bước vào Tàng Kinh Các. |
| Nhân vật | Tên hoặc pháp danh, giới tính, 4 kiểu tóc (có khăn vấn), 12 màu áo dài (có áo tràng lam, áo tràng nâu). |
| Lễ Phật | Thắp 1 hoặc 3 nén nhang kèm lời nguyện (nhang cháy 30 phút, khói bay, ai cũng thấy). Dâng hoa sen, hoa hồng, đèn dầu, mâm ngũ quả (hiện lên bàn thờ). Thả tim. Vái lạy (nhân vật cúi người). Gõ mõ. Thỉnh chuông (cả chánh điện cùng nghe). |
| Tụng kinh chung | Bát Nhã Tâm Kinh, Chú Đại Bi, Kinh Dược Sư (Chú Dược Sư), Niệm Phật A Di Đà, Niệm Quán Thế Âm, Chuông mõ ngồi thiền. Giọng VieNeu-TTS v3 Turbo đọc liền câu, mõ và chuông theo nghi thức (vào mõ, kết mõ). Mọi người nghe cùng một chữ (đồng bộ theo giờ máy chủ), chữ sáng lên theo tiếng mõ. Người vào muộn nghe đúng đoạn đang tụng. |
| Tàng Kinh Các | Một cảnh đi lại được như sân chùa (chạm tủ kinh ở chánh điện hoặc nút Tàng Kinh Các): cửa sổ trăng nhìn ra rừng trúc, Kệ kinh, kệ Võ học, lư trầm và **8 bồ đoàn**. Chạm bồ đoàn để đi tới ngồi thiền; ngồi rồi chọn công pháp để **tu luyện nội công ngay trên bồ đoàn**, linh khí xoáy quanh người theo màu công pháp và ai trong Tàng Kinh Các cũng thấy. Mỗi bồ đoàn một người; đi chỗ khác là đứng dậy, phiên tu vẫn chạy. Chạm kệ Võ học để sang Võ Học Các học chiêu. Kệ kinh: Dịch Cân Kinh (đủ 12 thức, 59 hình minh họa, lời thơ gốc kèm phiên âm Hán Việt), Cửu Âm Chân Kinh, Quỳ Hoa Bảo Điển, Bát Nhã Tâm Kinh. Đọc theo chương, mục lục, đổi cỡ chữ, nền giấy / nền tối, nhớ chỗ đọc dở. Ai đang đọc thì có biểu tượng sách cạnh tên. |
| Nói chuyện | Nói chuyện bằng giọng như đi chùa thật: đứng gần nghe rõ, xa nghe nhỏ dần, người bên trái nghe ở tai trái. Đang tụng kinh thì tiếng nói chuyện tự nhỏ lại. Tắt tiếng từng người; ban điều hành khóa mic 10 phút. |
| Cộng đồng | Chat chung (bong bóng chat hiện trên đầu nhân vật), tường lời nguyện có nút “Tùy hỷ”, báo cáo tin nhắn. |
| Công đức | Điểm công đức cá nhân (hôm nay / tất cả) và bảng công đức hôm nay. Có thể đăng nhập Google để giữ điểm khi đổi thiết bị. Tính từ nhang, hoa, mõ, tim, vái lạy, tụng kinh và cúng dường (1.000đ = 1 điểm). Nói tục trong chat bị trừ theo 5 mức. Công đức cao hiện **pháp tướng** sau lưng (6 mốc), công đức âm thì có **quỷ** theo sau (4 dạng). |
| Hiệu ứng mốc | Đạt 100, 300, 500, 888, 999 rồi mỗi 1.000 công đức trong ngày thì hiện lời chúc bằng giọng nữ kèm meme chọn ngẫu nhiên, hào quang vàng xoay quanh meme và cánh sen rơi. Mốc 666 thì hù một cái bằng mặt quỷ rồi hào quang hiện lên trấn an. Có công tắc tắt trong mục Công đức. |
| Cúng dường | Tạo mã VietQR có sẵn số tiền và mã đối soát. Tiền vào thẳng tài khoản của chùa. Tự xác nhận qua webhook SePay, hoặc ban điều hành xác nhận tay. Xác nhận xong: chánh điện đọc thông báo bằng giọng nữ VieNeu, người cúng dường được **hào quang 9 cảnh giới** (cộng dồn). |
| An toàn | Chặn tin có số tài khoản, số điện thoại, đường link (chống lừa đảo giả danh chùa). Che từ tục. Giới hạn tần suất. Tên “Ban điều hành / Admin / Trụ trì…” chỉ dành cho quản trị. |
| Quản trị | `/admin.html`: xác nhận/hủy lượt cúng dường, xem ai đang có hào quang, ẩn tin nhắn và lời nguyện (thấy cả số công đức bị trừ), gửi thông báo vào chánh điện. |
| Võ Học Các | Nơi **tu luyện nội công** và **học chiêu**, tách khỏi chánh điện. 6 công pháp (Tĩnh Tâm Quyết, Kim Cương / Phi Yến / Nhu Thủy Tâm Pháp, Cửu Âm Tâm Kinh, Vô Cực Chân Kinh): bắt đầu rồi đóng web cũng được, hết giờ máy chủ tự ghi nhận. 15 chiêu thuộc 3 nhánh Cương / Tốc / Nhu, không khóa phái: học đủ điều kiện (cấp nội công + tâm đắc) là học được cả ba nhánh. Có thể cúng dường để hoàn thành phiên ngay (Ban điều hành xác nhận thủ công). |
| Sân đấu | Nơi **duy nhất** luận võ 1 đấu 1, người chơi tự ra sân. Sân là một võ đường đi lại được như sân chùa (cổng Luận Võ Đường, võ đài có thái cực, giá binh khí, trống trận, mộc nhân); trên đầu mỗi người có nhãn rảnh / đang đấu / tạm nghỉ và cấp nội công, **chạm vào một người để mời luận võ** (hoặc mở Danh sách). Mời, nhận lời, chọn 4 chiêu, rồi mỗi lượt hai bên **chọn kín cùng lúc**, máy chủ lật chiêu và giải kết quả (có xác suất né / đỡ). Phòng cân bằng hoặc phòng có buff (pháp tướng, quỷ ám, hào quang). Chánh điện không có đánh nhau. |
| Khác | Lịch âm và đếm ngược đến Rằm / Mùng Một, cài lên màn hình điện thoại (PWA). |

## Các "nơi" của chùa

Mỗi nơi một màn hình riêng; chạm nút ở thanh dưới chánh điện để sang nơi khác, nút "Về chánh điện" để quay lại.

| Nơi | Dùng để | Ghi chú |
|---|---|---|
| Chánh điện | Cúng, thắp nhang, tụng kinh, trò chuyện | Không có đánh nhau, không ai bị mời đấu ở đây |
| Võ Học Các | Tu luyện, học chiêu, chọn bộ 4 chiêu | `public/js/dojo.js` |
| Sân đấu | Sân đi lại được, chạm người để mời, luận võ | `public/js/arena.js`; chỉ người đã ra sân mới thấy và mời được nhau. Sân vẽ bằng chung bộ vẽ của chánh điện (`Hall.attach` lên khung của Sân đấu, cảnh `arena`) |

Trong chùa còn có các **cảnh** dùng chung một khung vẽ: chánh điện, sân chùa, Tàng Kinh Các (`SCENES` trong `server.js`, vẽ ở `public/js/hall.js`). Bồ đoàn: `LIB_SEATS` (phải khớp giữa `server.js` và `hall.js`), sự kiện `sit` / `stand` / `psit`; bảng tọa thiền ở `public/js/meditate.js`.

Người đang ở nơi khác không hiện trong chánh điện. Thêm nơi mới (ví dụ coi bói tử vi, tarot) thì đăng ký thêm một nơi trong `PLACES` của `server.js` và `Places.register` ở `public/js/app.js`, không đụng chánh điện. Chi tiết luật chơi và giao thức: [docs/VO-HOC.md](docs/VO-HOC.md), [docs/VO-HOC-GIAO-THUC.md](docs/VO-HOC-GIAO-THUC.md), số liệu cân bằng: [docs/VO-HOC-CAN-BANG.md](docs/VO-HOC-CAN-BANG.md).

## Lưu trữ bền bằng PostgreSQL (Neon)

Mặc định ứng dụng lưu mọi thứ vào một file JSON, và trên Render Free file này **mất mỗi lần khởi động lại hoặc deploy**. Đặt biến `DATABASE_URL` (chuỗi kết nối PostgreSQL, ví dụ của Neon) thì dữ liệu được ghi nền vào PostgreSQL; nếu CSDL còn trống mà có file JSON cũ thì tự nhập một lần. Cách làm từng bước: [docs/NEON.md](docs/NEON.md). Công cụ nhập / xác minh / xuất: `node tools/db-migrate.js`.

## Bài tụng: giọng, mõ và chuông

Mỗi bài tụng là một file MP3 dựng sẵn trong `public/audio/chants/` (giọng + mõ + chuông) kèm file JSON ghi mốc từng chữ. Khi có người khởi tụng, mọi trình duyệt phát cùng một file và tự chỉnh về đúng vị trí theo giờ máy chủ, nên cả chánh điện nghe cùng một chữ; chữ trên màn hình sáng theo tiếng.

- **Giọng:** do máy tổng hợp bằng [VieNeu-TTS v3 Turbo](https://huggingface.co/pnnbao-ump/VieNeu-TTS-v3-Turbo) (Apache-2.0, tác giả Phạm Nguyễn Ngọc Bảo), nhân bản âm sắc (`--ref-mode speaker`) từ 60 giây đầu một bản đọc giọng nam do chủ dự án cung cấp; đọc **liền từng câu**. Đây là giọng tổng hợp chứ không phải bản thu âm thật, có thể đọc sai hoặc thiếu rõ một số từ Hán Việt. Đo bằng Whisper (không gợi ý lời) trên 10 dòng đầu Chú Đại Bi, giọng này nhận ra 48% số chữ, hơn giọng sẵn có “Thiền Tâm Đức” (36%) và hơn khi chép cả cách đọc của mẫu (39%); thần chú phiên âm vốn khó nhận, nên vẫn cần nghe lại và chỉnh khi cần.
- **Mõ** (theo hướng dẫn sử dụng chuông mõ của các đạo tràng): mõ gõ đúng lúc từng chữ cất lên, nương theo người tụng. Vào mõ: chữ 1 chưa gõ, chữ 2 gõ, chữ 3 không gõ, từ chữ 4 gõ đều. Thần chú nhanh hơn; niệm danh hiệu nhanh dần đều. Kết thúc lơi dần, hai tiếng mõ áp chót dính liền, tiếng cuối rời ra.
- **Chuông:** `public/audio/bell.mp3`. Một tiếng khai kinh, ba tiếng kết; cũng dùng cho nút “Thỉnh chuông”.

Dựng lại (đổi giọng, sửa kinh văn trong `public/js/chants.js`), chạy được trên CPU:

```bash
python -m venv .venv && . .venv/bin/activate && pip install vieneu librosa soundfile audiotsm faster-whisper "onnxruntime==1.22.1"
```

```bash
python tools/build_chants.py --voice "Thiền Tâm Đức"
```

Nhân bản giọng (chỉ làm khi người được nhân bản đồng ý):

```bash
python tools/build_chants.py --ref-audio /duong/dan/ngoai/repo/giong_mau.mp3 --ref-seconds 60
```

Mặc định dùng 60 giây đầu của file mẫu: âm sắc tính trên cả 60 giây, còn cách nhả chữ lấy từ khoảng 8 giây nói rõ nhất trong đó (VieNeu chỉ nhận tối đa 8 giây cho phần này). Nên chọn file một người nói rõ, ít ồn, không nhạc nền. File mẫu là dữ liệu cá nhân: để **ngoài** repo, không commit, không tải lên dịch vụ nào (công cụ từ chối đường dẫn nằm trong repo; trong MP3/JSON chỉ ghi nhãn “nhân bản từ giọng mẫu #xxxxxxxx”, không có tên hay đường dẫn). Mỗi lần dựng lại ra giọng hơi khác vì lấy mẫu ngẫu nhiên, nên nghe lại, nhất là các câu Hán Việt và chỗ vào mõ. Không có `--ref-audio` thì dùng giọng sẵn có “Thiền Tâm Đức”.

Giới hạn: VieNeu được huấn luyện để đọc, không phải để tụng, nên giọng nghe như đọc kinh chậm rãi hơn là xướng tụng. Muốn giọng tụng thật nhất, hãy thu âm chư tăng chùa đối tác (có sự đồng ý) rồi thay file MP3, giữ cùng định dạng JSON. Giọng hiện tại trầm (khoảng 97 Hz, giọng sẵn có “Thiền Tâm Đức” khoảng 103 Hz); file mẫu là giọng kể chuyện nên chỉ lấy âm sắc, cách đọc theo mô hình cho đỡ kịch tính.

## Tàng Kinh Các

Mỗi bộ kinh là một file Markdown trong `public/kinh/`, danh sách ở `public/kinh/index.json`. Thêm kinh mới: thêm một file `.md` và một dòng trong `index.json` (`id`, `title`, `han`, `sub`, `desc`, `file`, `cover` là `nghe` / `huyen` / `son` / `lam`, thêm `chant` nếu muốn có nút khởi tụng chung).

Cú pháp trong file kinh: `# Tên chương` (mỗi chương một trang, có mục lục), `##`, `###` tiêu đề nhỏ, `![chú thích](thư-mục/ảnh.png)` hình, `> dòng` đoạn kệ giữ nguyên từng dòng, `- mục` danh sách, `**đậm**`, `*nghiêng*`.

- **Dịch Cân Kinh**: chép từ tài liệu của Trần Đại Sỹ (sưu tầm từ ttvnol.com) do chủ dự án cung cấp, giữ thứ tự chữ và hình. Hình trong `public/kinh/dich-can-kinh/`. Lời thơ chữ Hán trong các hình “Nguyên bản” được chép lại kèm phiên âm Hán Việt.
- **Cửu Âm Chân Kinh**, **Quỳ Hoa Bảo Điển**: sách võ công hư cấu trong tiểu thuyết Kim Dung, ngoài đời không có toàn văn. Tiểu thuyết còn bản quyền nên Tàng Kinh Các không chép nguyên văn; nội dung là bài tự viết: lai lịch, các môn võ, câu khẩu quyết, lời bàn nơi cửa Phật, và chương 77 Đạo Đức Kinh (nguồn gốc thật của câu tổng cương Cửu Âm).
- **Bát Nhã Tâm Kinh**: bản phiên âm Hán Việt, có nút khởi tụng chung.
- **Chú Đại Bi**: khai chú và 84 câu, có nút khởi tụng chung (bài tụng `daibi`, câu 81–84 tụng ba lần).
- **Kinh Dược Sư**: toàn văn để đọc; nút khởi tụng chung mở bài tụng ngắn `duocsu` (khai kinh, Chú Dược Sư ba biến, niệm danh hiệu Đức Dược Sư).

Nên hỏi ý kiến người giữ bản quyền tài liệu Trần Đại Sỹ trước khi phát hành rộng.

## Nói chuyện bằng giọng

Bấm **Nói chuyện** rồi cho phép micro. Tiếng nói đi thẳng giữa các trình duyệt (WebRTC); máy chủ chỉ chuyển lời mời kết nối, không nghe và không ghi âm. Mỗi máy nối với tối đa 8 người gần nhất đang bật nói chuyện, nên chánh điện đông vẫn chạy được. Không cho phép micro thì vẫn nghe được mọi người.

Trang phải mở bằng **https** thì trình duyệt mới cho dùng micro (Render có sẵn https).

**TURN (nên có khi chạy thật):** hai máy ở mạng 4G hoặc mạng công ty thường không nối thẳng được với nhau, cần một máy chủ chuyển tiếp TURN. Chọn một trong hai:

- Cloudflare TURN (có gói miễn phí): tạo TURN key trong trang Cloudflare (Realtime → TURN), rồi đặt `CF_TURN_KEY_ID` và `CF_TURN_API_TOKEN`. Máy chủ chùa tự xin thông tin đăng nhập tạm (24 giờ) cho trình duyệt.
- TURN tự dựng (coturn) hoặc dịch vụ khác: đặt `TURN_URLS` (cách nhau bằng dấu phẩy), `TURN_USERNAME`, `TURN_CREDENTIAL`. Lưu ý: cách này lộ tên đăng nhập TURN cho khách.

Không đặt gì thì chỉ dùng STUN công cộng: chạy tốt khi hai người cùng mạng hoặc mạng nhà thông thường.

## Hào quang cúng dường (9 cảnh giới)

Khi nhà chùa **xác nhận đã nhận tiền** (admin bấm Xác nhận, hoặc SePay báo), nhân vật của người cúng dường tỏa hào quang quanh thân:

| Cảnh giới | Từ | Sáng | Hiệu ứng |
|---|---|---|---|
| 1. Luyện Khí | 20.000đ | 5 phút | Khí lành quấn quanh thân |
| 2. Trúc Cơ | 50.000đ | 6 phút | Đứng trên đài sen vàng |
| 3. Kim Đan | 100.000đ | 7 phút | Kim đan nơi đan điền, vầng sáng viền cánh sen sau đầu |
| 4. Nguyên Anh | 200.000đ | 8 phút | Nguyên anh bay vòng, tia sáng xoay |
| 5. Hóa Thần | 500.000đ | 9 phút | Thần hỏa xanh bốc lên quanh thân |
| 6. Luyện Hư | 1.000.000đ | 10 phút | Quang bối hư không đầy sao sau lưng |
| 7. Hợp Thể | 2.000.000đ | 11 phút | Ngũ hành châu xoay quanh |
| 8. Đại Thừa | 5.000.000đ | 12 phút | Cột sáng từ trời, quang bối kim quang, sen hồng nở, cánh sen rơi |
| 9. Độ Kiếp | 10.000.000đ | 13 phút | Lôi kiếp giáng xuống, vòng ngũ sắc, sen pha lê ngũ sắc |

Cộng dồn: còn hào quang thì số tiền mới cộng vào số cũ (3 lần 20.000đ = 60.000đ, lên Trúc Cơ). Mỗi lần cúng dường, hào quang sáng lại từ đầu theo thời gian của cảnh giới hiện tại; hết giờ thì tắt và cộng dồn về 0. Ẩn danh, hoặc bỏ chọn “Hiện hào quang”, thì không hiện. Sửa mốc trong `public/js/aura.js`.

Đài sen (vàng, hồng, pha lê), vầng sáng sau đầu và quang bối (tím, vàng kim) là hình thiết kế trên Canva, nằm trong `public/img/fx/aura/`; dựng lại từ ảnh PNG xuất từ Canva bằng `python3 -I tools/fx/prepare_aura_assets.py lotus.png halo.png mandorla.png` (cần Pillow, numpy). Các hiệu ứng còn lại (sợi khí, tia sáng, thần hỏa, nguyên anh, ngũ hành châu, cánh sen rơi, lôi kiếp) vẽ bằng mã trong `public/js/hall.js`. Hình chưa tải xong thì trình duyệt tạm vẽ bằng mã.

## Thông báo cúng dường bằng giọng nữ VieNeu

Mỗi lần xác nhận cúng dường, chánh điện thỉnh một tiếng chuông rồi đọc: tên người cúng dường, số tiền (đọc bằng chữ), và cảnh giới hào quang mới nếu vừa đột phá. Ví dụ: “Nam mô A Di Đà Phật. Chánh điện xin tùy hỷ công đức Phật tử Diệu Liên, vừa cúng dường sáu mươi nghìn đồng. Hào quang bừng sáng! Diệu Liên đã đột phá cảnh giới Trúc Cơ.”

Giọng đọc do máy chủ đọc của VieNeu-TTS (`apps.openai_speech`, có sẵn trong gói `vieneu`) tạo ra, mặc định giọng nữ **Mai Anh** (giọng Bắc, kiểu đọc tin tức). Các giọng nữ khác: Ngọc Huyền, Trúc Ly, Đoan Trang, Ngọc Linh, Quỳnh Anh (Bắc); Ngọc Trân (Trung); Thùy Dung, Thục Đoan, Mỹ Duyên, Kim Thanh (Nam). Đặt bằng `TTS_VOICE`.

Bật máy chủ đọc (cùng máy với chùa, hoặc một máy khác):

```bash
pip install vieneu fastapi uvicorn
```

```bash
VIENEU_BACKEND=onnx PORT=8000 python -m apps.openai_speech
```

Rồi đặt `TTS_URL=http://127.0.0.1:8000` cho máy chủ chùa (thêm `TTS_API_KEY` nếu máy chủ đọc đặt `VIENEU_API_KEY`). Có `ffmpeg` thì gửi MP3 cho nhẹ, không có thì gửi WAV. Thư mục `tts/` có sẵn Dockerfile để chạy máy chủ đọc trên Docker hoặc Hugging Face Spaces (xem `tts/README.md`).

Chưa đặt `TTS_URL` (ví dụ đang chạy Render miễn phí) hoặc máy chủ đọc lỗi thì trình duyệt tự đọc bằng giọng tiếng Việt có sẵn trên máy, kèm tiếng chuông và băng chữ.

## Công đức, pháp tướng và quỷ

Công đức tính trên **tổng điểm** (tất cả). Bảng đầy đủ xem ở tab Công đức → “Luật công đức, pháp tướng và quỷ”.

**Được cộng:** thắp nhang +10, cùng tụng đến hết bài +15, dâng lễ +5, khởi tụng +5, thỉnh chuông +3, vái lạy +2, gõ mõ / thả tim / tùy hỷ +1, **cúng dường +1 cho mỗi 1.000đ** đã xác nhận.

**Bị trừ khi chat hoặc viết lời nguyện tục tĩu** (không áp dụng cho nói chuyện bằng giọng). Luật ở `lib/moderation.js`:

| Mức | Trừ | Loại |
|---|---|---|
| 1. Lời thô | −5 | chửi thề nhẹ, lời cộc cằn |
| 2. Xúc phạm | −15 | mắng chửi, hạ nhục người khác |
| 3. Tục tĩu | −30 | từ thô tục, chửi thề viết tắt, lời dâm ô |
| 4. Chửi cha mẹ, trù ẻo | −60 | chửi đến cha mẹ, tổ tiên, mong người khác chết |
| 5. Báng bổ Tam Bảo | −100 | lời tục đi kèm danh hiệu Phật, Bồ Tát, chư Tăng, nhà chùa |

Nhiều từ trong một tin thì cộng dồn (mỗi từ tính tối đa 3 lần). Viết HOA gần hết (gào thét) nhân 1,5. Tái phạm trong 10 phút nhân thêm 0,5 mỗi lần, tối đa nhân 3. Một tin trừ tối đa 300. Bắt cả kiểu gõ không dấu (“dit me”), kéo dài chữ (“đụuuu”), chen dấu chấm (“đ.m”); không bắt nhầm “chim cút”, “đi ngủ”, “con chó nhà tôi”. Người bị trừ thấy số công đức bị trừ bay lên trên đầu, mọi người cũng thấy.

**Pháp tướng công đức** (vẽ sau lưng, còn mãi khi đủ điểm; từ 1.000 trở lên thì xoay):

| Mốc | Pháp tướng |
|---|---|
| 100 | Linh Quang Hoàn: vòng linh quang vàng sau đầu, kết ngọc |
| 500 | Thanh Liên Bảo Quan: vương miện sen pha lê xanh ngọc |
| 1.000 | Kim Diễm Song Dực: đôi cánh lửa vàng, vòng phù văn xoay |
| 5.000 | Vạn Kiếm Quy Tông: bánh xe kiếm bạch kim xoay |
| 10.000 | Kim Long Pháp Tướng: pháp luân hoa văn vàng son, hai vòng xoay ngược, cánh lửa son |
| 50.000 | Cửu Tiêu Thánh Luân: mặt trời gai vàng xoay, cánh ngũ sắc |

Pháp tướng (vật sau lưng, lâu dài) và hào quang cúng dường (ánh sáng quanh thân, vài phút) đi cùng nhau được: khi có cả hai, ngọc và viền pháp tướng nhuộm theo màu cảnh giới hào quang và có thêm một quầng sáng cộng hưởng.

**Quỷ theo sau khi công đức âm:** dưới 0 thì Tiểu Quỷ hiện mờ, rõ hẳn ở −100; −200 thành Ác Quỷ (sừng, cánh dơi, nanh vuốt); −500 thành Quỷ Vương (vương miện sừng, lửa tím đen); −1.000 thành Ma Vương (khổng lồ ba mắt, đứng sừng sững sau lưng). Làm việc thiện để công đức về trên 0 thì quỷ tan. Sửa mốc trong `public/js/merit.js`.

Hình 4 con quỷ vẽ trên Canva (trang 4–7 của thiết kế “Hiệu ứng Chùa Tâm An — hào quang & quỷ”), tách nền thành `public/img/fx/demon-1.webp` … `demon-4.webp` bằng `python3 -I tools/fx/prepare_demon_sprites.py quy1.png quy2.png quy3.png quy4.png` (cần Pillow và numpy; công cụ in ra vị trí mắt để chép vào `DEMON_ART` trong `public/js/hall.js`). Trong chánh điện quỷ có viền sáng đỏ (Quỷ Vương viền tím), quầng lửa, lửa bốc, tàn lửa bay và mắt rực thỉnh thoảng chớp. Thiếu ảnh thì tự vẽ hình cũ bằng code.

Máy chủ phát sự kiện `pm` (`{ id, mt, up }`) mỗi khi hình pháp tướng / quỷ của ai đó đổi; `up: true` nghĩa là vừa lên mốc pháp tướng, dùng được cho hiệu ứng chúc mừng.

## Hiệu ứng mốc công đức

Khi công đức **hôm nay** (số ở thẻ “Công đức” trên đầu trang) chạm các mốc dưới đây, trình duyệt của người đạt mốc hiện hiệu ứng chúc mừng. Không ai khác thấy.

| Mốc | Hiệu ứng |
|---|---|
| 100, 300, 500 | Lời chúc bằng giọng nữ (“Chúc bạn một ngày bình an…”) kèm một meme ngẫu nhiên. Sau meme là vòng hào quang vàng (vòng cánh sen, tia sáng) nở ra rồi xoay chậm; cánh sen và hoa giấy rơi nhẹ. |
| 666 | Hù: mặt quỷ sừng cong, mắt vàng rực phóng ra chiếm màn hình khoảng 1,4 giây (một lần chớp đỏ, sóng lửa tỏa ra, tàn lửa bay, viền đỏ thở, rung màn hình, tiếng hù, mặt dồn tới hai nhịp như tim đập), rồi mờ đi; hào quang vàng nở ra sau thẻ trấn an “Hù bạn thôi! A Di Đà Phật, chúc bạn bình an 🙏”. |
| 888, 999, 1.000, 2.000, 3.000… | Bản lớn: tiêu đề vàng to, hào quang to hơn với thêm một vòng phụ xoay ngược và tia sáng đậm hơn, nhiều hoa giấy hơn, cũng có giọng chúc và meme. |

**Cách tính.** Máy chủ quyết định, không phải trình duyệt. Mốc tính khi một lần cộng đưa công đức hôm nay từ dưới mốc lên bằng hoặc quá mốc (mỗi lần cộng là 1 đến 15 điểm nên có thể nhảy qua đúng con số). Một lần cộng bước qua nhiều mốc thì chỉ hiện một: 666 được ưu tiên, còn lại lấy mốc cao nhất. Tải lại trang hay vào lại chùa khi đã có 700 công đức không chiếu lại mốc cũ. Công đức “hôm nay” tính lại mỗi ngày theo giờ Việt Nam, nên mốc cũng vậy. Đang có một hiệu ứng (hay tab đang ẩn) thì mốc mới xếp hàng chờ: tối đa một lượt, 666 được ưu tiên hơn mọi mốc khác. Lượt chờ quá 60 giây (tab bị ẩn lâu) thì không chiếu nữa, kể cả 666, chỉ hiện dòng báo nhỏ “Bạn đã đạt N công đức”.

**Kho meme.** Thả ảnh `.jpg .jpeg .png .webp .gif .avif` vào `public/img/memes/` là tự có, không cần sửa mã (tối đa 200 ảnh, ảnh vuông khoảng 720px đẹp nhất). Máy chủ đọc lại thư mục sau tối đa 30 giây, người chơi nhận danh sách mới khi vào chùa hoặc tải lại trang. Mỗi lần chọn ngẫu nhiên và không lặp lại ảnh vừa hiện. Ảnh lỗi thì bỏ qua, hết ảnh thì thẻ chỉ còn chữ. Nên đặt tên file không dấu và ngắn: tên có byte lỗi mã hóa hay dài quá (địa chỉ từ 300 ký tự) sẽ bị bỏ qua. Bộ meme có 15 thẻ vẽ tay và 18 thẻ `anh-*.jpg` làm từ ảnh chụp có giấy phép tự do (CC0, public domain, CC BY); tên tác giả và nguồn từng ảnh nằm ở `public/img/PHOTO-CREDITS.txt`, thêm ảnh CC BY mới thì ghi tiếp vào đó. Mặt quỷ của mốc 666 là `public/img/devil.webp` (thiếu hay hỏng thì dùng bản vẽ cũ `public/img/devil.svg`, rồi tới biểu tượng 😈), hình hào quang là `public/img/fx/halo.webp` (thiếu thì chỉ còn tia sáng vẽ bằng CSS).

**Hình từ Canva.** Hào quang và mặt quỷ được tạo bằng công cụ tạo ảnh AI của Canva, đặt trong thiết kế Canva “Hiệu ứng Chùa Tâm An — hào quang & quỷ” (trang 2 và 3) rồi xuất PNG. Muốn đổi hình: sửa hoặc thay ảnh trong thiết kế đó (giữ hào quang trên nền đen, cỡ vuông; mặt quỷ khổ dọc 3:4, mắt ở khoảng 40% chiều cao), xuất hai trang thành PNG, rồi chạy `python3 -I tools/fx/prepare_canva_assets.py halo.png devil.png` (cần Pillow và numpy). Công cụ đổi nền đen của hào quang thành trong suốt và nén cả hai sang WebP.

**Giọng chúc.** Bốn câu chúc giọng nữ (VieNeu-TTS v3 Turbo, giọng “Trúc Ly”) đã có sẵn trong `public/audio/blessings/`, kèm `manifest.json`; tạo lại bằng `tools/build_blessing_voice.py`. Muốn thêm câu hay đổi giọng thì sửa `manifest.json` (lưu UTF-8, có BOM cũng được; file lỗi thì máy chủ ghi một dòng cảnh báo vào log và trình duyệt đọc bằng giọng máy):

```json
{ "lines": [
  { "file": "binh-an-1.mp3", "text": "Chúc bạn một ngày bình an." },
  { "file": "binh-an-2.mp3", "text": "A Di Đà Phật. Chúc bạn một ngày mới an lành." }
] }
```

Mỗi lần hiện, trình duyệt chọn ngẫu nhiên một dòng, phát file và hiện đúng câu `text` bên dưới meme. `file` chỉ là tên file thường (`.mp3 .ogg .m4a .wav`, chỉ gồm chữ không dấu, số, `.`, `-`, `_`, không có dấu `/`), máy chủ bỏ qua dòng sai hoặc file không tồn tại. Không có file giọng nào (hay file không tải được) thì trình duyệt tự đọc bằng `speechSynthesis` (tiếng Việt, chỉ nhận giọng nữ như HoaiMy, Linh, Google tiếng Việt; giọng nam như An, NamMinh bị loại); máy không có giọng nữ tiếng Việt hay giọng không lên tiếng thì chỉ còn tiếng chuông ting nhẹ. Nút tắt tiếng trên đầu trang tắt mọi âm thanh của hiệu ứng, kể cả giọng đọc.

**Xem thử.** Mở `http://localhost:3000/?celebrate=100` (hoặc `300`, `999`, `2000`…): hiệu ứng chạy một lần sau khi vào chùa mà không cần đủ công đức. Riêng `?celebrate=666` có hộp hỏi xác nhận trước khi hù (từ chối thì chỉ hiện thẻ chúc mừng), để liên kết gửi cho người khác không tự hù họ. Hoặc gõ `Celebrate.test(666)` trong console của trình duyệt.

**Tắt hiệu ứng.** Vào tab **Công đức**, thẻ **Hiệu ứng** có hai ô, lưu ngay trên máy (`localStorage`: `ta-fx`, `ta-scare`):

- “Hiệu ứng chúc mừng ở các mốc công đức”: tắt thì chỉ còn dòng thông báo nhỏ “Bạn đạt N công đức”, kể cả mốc 666.
- “Cho phép hù ở mốc 666”: tắt thì mốc 666 hiện lời chúc bình thường thay cho mặt quỷ.

Người bật chế độ giảm chuyển động của hệ điều hành (`prefers-reduced-motion`) không bị rung, phóng to, chớp, sóng lửa hay hạt bay: hình chỉ mờ hiện, hào quang đứng yên không xoay, mặt quỷ hiện mờ 0,2 giây không chớp đỏ. Chạm vào màn hình hoặc nhấn Esc để đóng sớm, nút × luôn đóng được. Chạm lên màn hình chỉ đóng khi trước đó đã ngừng chạm khoảng 0,9 giây (và sau 0,7 giây đầu), để người đang gõ mõ liên tục không lỡ tay tắt mất lời chúc; mỗi cú chạm bị bỏ qua làm đồng hồ này tính lại. Tab không lọt ra các nút phía sau lớp phủ. Điện thoại xoay ngang (màn thấp) thì thẻ xếp thành hàng, meme bên trái, chữ bên phải.

Nguồn và giấy phép của ảnh, mặt quỷ, giọng đọc ghi trong `public/img/NOTICE.txt` và `public/audio/NOTICE.txt`.

## Chạy trên máy

Cần Node.js 18 trở lên.

```bash
npm install
```

```bash
npm start
```

Mở http://localhost:3000. Muốn dùng file cấu hình: `cp .env.example .env`, sửa `.env`, rồi chạy `npm run start:env`.

## Cấu hình (biến môi trường)

| Biến | Ý nghĩa |
|---|---|
| `ADMIN_KEY` | Mã đăng nhập `/admin.html`. Để trống thì tắt trang quản trị. |
| `SITE_NAME` | Tên chùa hiển thị. |
| `BANK_ID`, `BANK_ACCOUNT`, `BANK_ACCOUNT_NAME`, `BANK_LABEL` | Tài khoản nhận tịnh tài (mã ngân hàng theo VietQR, ví dụ `MB`, `VCB`, `TCB`, `ACB`, `BIDV`). Để trống thì tắt cúng dường tịnh tài, chỉ còn phẩm vật tượng trưng. |
| `FUNDS` | Các quỹ, cách nhau bằng `;`. Thêm `|mục tiêu` để hiện thanh tiến độ. Ví dụ: `Tu sửa chánh điện|300000000;Bếp cơm từ thiện` |
| `SEPAY_API_KEY` | Bật tự xác nhận tiền vào qua SePay. |
| `INCENSE_MINUTES` | Thời gian một nén nhang cháy, mặc định 30. |
| `MAX_PLAYERS`, `MAX_CONN_PER_IP` | Giới hạn số người và số kết nối mỗi mạng. |
| `DATA_FILE` | Nơi lưu dữ liệu, mặc định `data/db.json`. |
| `TRUST_PROXY` | Đặt `0` nếu không chạy sau proxy (nginx, Render…). |
| `DATABASE_URL` | Chuỗi kết nối PostgreSQL (Neon). Có thì lưu vào PostgreSQL thay cho file JSON. `PG_FLUSH_MS` (mặc định 10000) là nhịp ghi nền, `PG_SSL=0` tắt SSL khi chạy cục bộ, `PG_IMPORT_JSON=0` tắt tự nhập file JSON cũ. |
| `MARTIAL_ENABLED`, `PK_ENABLED` | Đặt `0` để tắt cả Võ Học Các và Sân đấu, hoặc chỉ Sân đấu. `PK_MAX_MATCHES` (mặc định 20) là số trận cùng lúc tối đa; `PK_BUFF_SCALE` (mặc định 0,15) là hệ số buff của phòng có buff. |
| `SPEEDUP_ENABLED`, `SPEEDUP_PER_DAY` | Cúng dường để hoàn thành tu luyện ngay (cần bật cúng dường tịnh tài). `0` để tắt; mỗi người tối đa 2 lần đã xác nhận mỗi ngày. |
| `VOICE` | Đặt `0` để tắt nói chuyện bằng giọng. `VOICE_MAX`: số người tối đa bật nói chuyện cùng lúc (mặc định 150). |
| `CF_TURN_KEY_ID`, `CF_TURN_API_TOKEN` | TURN của Cloudflare cho nói chuyện bằng giọng qua 4G / mạng công ty. |
| `TURN_URLS`, `TURN_USERNAME`, `TURN_CREDENTIAL` | TURN tự dựng (coturn…). `STUN_URLS` để đổi máy chủ STUN. |
| `TTS_URL` | Địa chỉ máy chủ đọc VieNeu (`python -m apps.openai_speech`). Để trống thì trình duyệt tự đọc thông báo. |
| `TTS_VOICE`, `TTS_API_KEY`, `TTS_TIMEOUT` | Giọng đọc (mặc định `Mai Anh`), khóa của máy chủ đọc, thời gian chờ (giây, mặc định 45). |

**Chỉ điền tài khoản ngân hàng đứng tên nhà chùa, khi đã có văn bản đồng ý của nhà chùa.**

## Bật đăng nhập Google

1. Trong [Google Cloud Console](https://console.cloud.google.com/auth/clients), cấu hình màn hình đồng ý và tạo OAuth Client ID loại **Web application**.
2. Thêm **Authorized redirect URI** khớp chính xác với địa chỉ trang, ví dụ `https://chuataman.vn/api/auth/google/callback`. Khi chạy thử trên máy, đăng ký `http://localhost:3000/api/auth/google/callback`.
3. Đặt `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` và `AUTH_ORIGIN` trong cấu hình máy chủ. `AUTH_ORIGIN` là địa chỉ gốc, ví dụ `https://chuataman.vn`, không có dấu `/` ở cuối. Khởi động lại máy chủ.
4. Nếu ứng dụng Google ở chế độ **Testing**, thêm tài khoản dùng thử trong mục **Audience**.

Khách vẫn vào chánh điện như trước, nhưng **tu luyện, Võ Học Các và Sân đấu chỉ dành cho tài khoản đã đăng nhập**, và những gì khách tích chỉ nằm trên trình duyệt đó. Đăng nhập thì công đức, tịnh tài đã cúng dường, hào quang, nội công, chiêu đã học, thắng thua được lưu theo tài khoản (xem [docs/VO-HOC.md](docs/VO-HOC.md)). Khi đăng nhập, công đức khách còn gắn với trình duyệt đó được chuyển vào tài khoản một lần. Khoản cúng dường tạo trước khi đăng nhập vẫn cộng điểm vào tài khoản sau khi được xác nhận. Điểm hôm nay tính theo giờ Việt Nam. Tên hiển thị và trang phục vẫn do người dùng chọn trên mỗi thiết bị. Máy chủ chỉ lưu mã định danh tài khoản đã băm và phiên của ứng dụng.

**Lưu trữ khi triển khai:** ứng dụng dùng file JSON trên một máy chủ. Đặt `DATA_FILE` trên ổ đĩa bền vững để giữ điểm qua các lần khởi động lại hoặc triển khai. Nếu đã có dữ liệu, sao lưu và chuyển file `db.json` hiện có sang ổ mới trước khi đổi `DATA_FILE`.

## Đưa lên mạng trong ngày

### Cách 1: Render (nhanh nhất, không cần máy chủ riêng)

1. Đăng nhập https://render.com bằng GitHub.
2. Chọn **New → Blueprint**, chọn repo này. Render đọc `render.yaml` và tạo dịch vụ web.
3. Điền các biến còn trống: `BANK_ACCOUNT` (số tài khoản), `BANK_ACCOUNT_NAME` (tên chủ tài khoản, viết hoa không dấu, ví dụ `NGUYEN VAN A`), `SEPAY_API_KEY` nếu dùng. Ngân hàng đã đặt sẵn là Vietcombank (`BANK_ID=970436`). `ADMIN_KEY` được tạo ngẫu nhiên, xem trong tab Environment.
4. Đợi build xong, mở địa chỉ `https://chua-tam-an.onrender.com` (hoặc tên Render cấp).

Lưu ý: gói miễn phí của Render ngủ sau 15 phút không có ai và không giữ file dữ liệu khi khởi động lại. Khi chạy thật, nâng lên gói trả phí và gắn **Disk** (đặt `DATA_FILE=/var/data/db.json`), hoặc dùng cách 2.

### Cách 2: VPS tại Việt Nam (Ubuntu)

```bash
git clone https://github.com/VipProCute/pagoda-online.git && cd pagoda-online
```

```bash
npm ci --omit=dev && cp .env.example .env
```

Sửa `.env`, rồi chạy bằng pm2:

```bash
sudo npm i -g pm2 && pm2 start "npm run start:env" --name chua && pm2 save && pm2 startup
```

nginx (cần đủ các dòng `Upgrade` để chat thời gian thực hoạt động):

```nginx
server {
  server_name chuataman.vn;
  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

Bật HTTPS bằng `sudo certbot --nginx`.

### Cách 3: Docker

```bash
docker build -t chua-tam-an . && docker run -d -p 3000:3000 --env-file .env -v chua-data:/app/data chua-tam-an
```

## Tự xác nhận cúng dường bằng SePay

1. Tạo tài khoản https://sepay.vn, liên kết tài khoản ngân hàng của chùa.
2. Vào **Tích hợp Webhooks → Thêm webhook**:
   - URL: `https://<tên-miền>/api/webhooks/sepay`
   - Kiểu chứng thực: **API Key**, điền một chuỗi bí mật. Đặt cùng chuỗi đó vào `SEPAY_API_KEY`.
   - Chỉ nhận tiền vào.
3. Mỗi lượt cúng dường có mã dạng `CD8F3K2Q` trong nội dung chuyển khoản. Khi SePay báo có giao dịch chứa mã này và đủ số tiền, trang tự chuyển sang “Tùy hỷ công đức” và cập nhật bảng công đức.

Chưa dùng SePay thì ban điều hành đối chiếu sao kê rồi bấm **Xác nhận** trong `/admin.html`.

## Quản trị

Mở `/admin.html`, nhập `ADMIN_KEY`. Sau đó mở trang chính và vào chánh điện: tên bạn có huy hiệu Ban điều hành, được ẩn tin nhắn và dừng khóa tụng.

## Cấu trúc mã

```
server.js              máy chủ: Express + Socket.IO, toàn bộ luật chơi và API
lib/moderation.js      lọc tin nhắn, tên, số tài khoản, link; luật trừ công đức khi nói tục
lib/announce.js        soạn câu thông báo cúng dường, gọi máy chủ đọc VieNeu
lib/store.js           lưu dữ liệu ra file JSON
public/index.html      trang chánh điện
lib/store.js           kho dữ liệu: file JSON hoặc PostgreSQL (store-pg.js, store-sections.js), nhập / xuất ở tools/db-migrate.js
lib/martial/service.js tu luyện, học chiêu, bộ chiêu, hoàn thành ngay (logic thuần, có test)
lib/pk/engine.js       luật luận võ so chiêu đồng thời (thuần, dùng chung với tools/pk-sim)
lib/pk/manager.js      sân đấu: người ở sân, lời mời, sảnh, vòng lượt, giờ, vào lại
lib/pk/buffs.js        buff pháp tướng / quỷ / hào quang cho phòng có buff; rules.js, rng.js
public/js/martial.js   3 nhánh, 15 chiêu, 6 công pháp, cấp nội công (dùng chung máy chủ và trình duyệt)
public/js/places.js    chuyển giữa các nơi (chánh điện, Võ Học Các, Sân đấu); dojo.js, arena.js là giao diện hai nơi sau
public/js/hall.js      vẽ chánh điện, sân chùa, Tàng Kinh Các, Sân đấu, nhân vật (đứng, ngồi thiền), hào quang, pháp tướng, quỷ (Canvas 2D)
public/js/meditate.js  bảng tọa thiền trên bồ đoàn ở Tàng Kinh Các (chọn công pháp, đếm giờ phiên tu)
public/js/voice.js     nói chuyện bằng giọng (WebRTC, nghe theo khoảng cách)
public/js/library.js   Tàng Kinh Các: kệ kinh và trang đọc
public/js/aura.js      9 cảnh giới hào quang cúng dường (dùng chung máy chủ và trình duyệt)
public/js/merit.js     6 pháp tướng công đức và 4 dạng quỷ (dùng chung)
public/kinh/           kinh trong Tàng Kinh Các (Markdown + hình)
tts/                   Dockerfile chạy máy chủ đọc VieNeu
public/js/audio.js     phát bài tụng đồng bộ, chuông, mõ, clip lời chúc, tiếng hù (Web Audio)
public/js/celebrate.js hiệu ứng chúc mừng ở mốc công đức (meme, giọng chúc, hù 666)
public/css/celebrate.css giao diện của hiệu ứng trên
public/js/chants.js    kinh văn các bài tụng (đầu vào của tools/build_chants.py)
public/audio/          bài tụng dựng sẵn (chants/), tiếng chuông (bell.mp3)
public/audio/blessings/ giọng chúc (4 file mp3 + manifest.json)
public/img/memes/      kho meme (thả ảnh vào là tự có), nguồn ảnh ở public/img/PHOTO-CREDITS.txt
public/img/devil.webp  mặt quỷ mốc 666 (Canva), devil.svg là bản dự phòng
public/img/fx/halo.webp hào quang công đức (Canva)
public/img/fx/demon-*.webp 4 con quỷ theo sau người công đức âm (Canva)
tools/fx/prepare_demon_sprites.py tách nền xám của 4 con quỷ thành ảnh trong suốt
tools/fx/prepare_canva_assets.py chuyển PNG xuất từ Canva thành ảnh web
tools/build_chants.py  dựng bài tụng bằng VieNeu-TTS
tools/build_blessing_voice.py dựng giọng chúc (giọng nữ) bằng VieNeu-TTS
public/js/lunar.js     lịch âm
public/js/app.js       kết nối và giao diện
public/admin.html      trang quản trị
```

## Việc nên làm tiếp

- Thu âm bài tụng thật của chư tăng chùa đối tác, thay giọng mô phỏng.
- Chuyển dữ liệu sang Redis khi đông người (nhiều máy chủ); PostgreSQL đã có (xem trên).
- Chia phòng “Chánh điện 1, 2…” khi quá 300 người.
- Hỏi luật sư về giấy phép mạng xã hội (Nghị định 147/2024/NĐ-CP) và bảo vệ dữ liệu cá nhân trước khi mở rộng.
