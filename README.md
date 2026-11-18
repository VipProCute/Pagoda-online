# Chùa Tâm An · Đi chùa online

Chùa Tâm An là không gian viếng chùa trực tuyến, có nhiều người cùng hiện diện theo thời gian thực.
Bạn có thể lễ Phật, đọc kinh, trò chuyện, chơi cờ hoặc tìm hiểu võ học.
Ứng dụng chạy bằng Node.js, Express và Socket.IO; trình duyệt dùng JavaScript thuần, Canvas 2D và Three.js.
Đây là dự án cộng đồng. Máy chủ quyết định mọi thứ về công đức, tiền, giờ tu luyện và kết quả chơi.

## Ảnh

![Bàn cờ mặc định](docs/ky-dai/anh/classic-xem-nhanh.jpg)
Bản xem nhanh tài nguyên bàn và quân mặc định; atlas quân 2D chưa bật trong game.

![Sân Đại Ngàn](docs/ky-dai/anh/v2-forest.jpg)
Ảnh sân Đại Ngàn trong bộ sân Kỳ Đài v2.

![Bàn cờ 3D](docs/ky-dai/anh/ban-3d-san-v2.jpg)
Bàn cờ 3D dùng ảnh nửa sân v2.

![Pháp Tướng 3D](docs/phap-tuong/anh/game-ta-fx3d-bat.jpg)
Pháp Tướng 3D trong game (bản đang hoàn thiện).

## Có gì trong chùa

| Nơi / nhóm | Nội dung và trạng thái |
|---|---|
| Chánh điện | Lễ Phật, vái lạy, thắp nhang kèm lời nguyện, dâng lễ, gõ mõ, thỉnh chuông và tụng kinh đồng bộ theo giờ máy chủ. Người vào muộn nghe đúng đoạn đang tụng. |
| Sân chùa | Đi lại, gặp NPC, xin xăm và ngồi tại bốn bàn đá Kỳ Đạo. Thanh đổi map nối Chánh điện, Sân chùa, Tàng Kinh Các và Sân đấu. |
| Tàng Kinh Các | Đọc kinh theo chương, đổi cỡ chữ, nền sáng / tối và nhớ chỗ đọc. Có tám bồ đoàn để ngồi thiền và chọn phiên tu luyện nội công. |
| Kỳ Đạo | Danh mục gồm Cờ vua, Cờ tướng, Cờ tướng úp, Cờ vây và Caro. Máy chủ kiểm nước đi, đồng hồ, kết quả và Elo; ván cờ không cộng công đức. |
| Đánh với máy, giải thế cờ | Ngồi bàn đá một mình (hoặc gặp NPC Ngọa Long Kỳ Sư đi lang thang) thì chọn đánh cờ vua / cờ tướng với máy ba mức Sơ cơ, Trung cơ, Cao cơ, hoặc giải thế cờ: chiếu hết 1 / 2 / 3 nước, tìm đường hòa, thắng thế. Thế cờ vua lấy từ kho Lichess (CC0), thế cờ tướng do công cụ trong repo dựng và kiểm. Gợi ý trừ 5 công đức mỗi lần (máy chủ trừ, cần đủ công đức); xem lời giải thì cúng dường tùy tâm (tạo xong mã QR là xem được). Chạy trên trình duyệt, không Elo, không công đức. |
| Kỳ Đài | Bàn 2D và bàn 3D; cờ vua, cờ tướng, cờ úp có lãnh địa nửa sân và bộ quân. Cờ vây, caro có bộ đá riêng; có hiệu ứng khai mở, phong cấp và kết thúc ván. |
| Võ Học Các | Sáu công pháp, 15 chiêu thuộc Cương / Tốc / Nhu, tu luyện nội công và luyện độ thành thạo chiêu. Phiên tu vẫn chạy khi đóng trang; hoàn thành ngay qua cúng dường không giới hạn lượt mỗi ngày. |
| Sân đấu | Luận võ tự nguyện 1 đấu 1 (mời ngay trong cảnh; có chặn đối thủ và chế độ không làm phiền), chọn bốn chiêu, mỗi lượt hai bên chọn kín cùng lúc. Máy chủ giải lượt; trận không cược công đức, có ghi thắng / thua / hòa. Vắng người thì đi tìm NPC Hắc Phong Ma Khách đang lang thang trong chùa để thách đấu (ba mức; không tính vào thành tích PK). |
| Bói toán | Xin xăm có hàng chờ và giới hạn từ máy chủ; tarot có 78 lá theo tám chủ đề. Tử Vi mới có bộ máy an sao và dữ liệu luận giải; giao diện lá số T-057 chưa xong. |
| Danh hiệu và Bảng Vàng | Bậc chiến tích luận võ (9 bậc theo thắng / hòa) hiện ở Sân đấu và Võ Học Các. Danh hiệu mùa đã có bộ tính nhưng máy chủ chưa phát; hiển thị trên nhân vật và bia Bảng Vàng chưa xong. |
| Cơ duyên | Tảo Địa Tăng thỉnh thoảng xuất hiện ở Tàng Kinh Các (mỗi phút rút thăm 1/512), cả chùa được báo; cao nhân đứng chờ tới khi truyền thừa cho một người rồi mới rời đi; ba NPC cơ duyên ở Chánh điện, Sân chùa và Tàng Kinh Các. Mọi lần xuất hiện do máy chủ quyết định. |
| Chế độ 3D và góc nhìn | 2D là mặc định; nút `3D` / `2D` ở góc cảnh đổi sang không gian 3D dựng bằng Three.js, có góc nhìn thứ nhất và thứ ba (phím `V`). Bàn cờ cũng có bản 3D xoay được. Phần thế giới 3D còn đang hoàn thiện. |
| Pháp Tướng 3D | Trong chế độ 3D, quỷ hộ thân, đài sen và lửa hộ thân hiện bằng mô hình 3D (bản đang hoàn thiện, bật sẵn). Chưa đủ bốn quỷ, chín bậc hào quang và sáu pháp tướng bằng lưới 3D; phần chưa có vẫn dùng hình 2D. |
| Nói chuyện bằng giọng | WebRTC cho tiếng nói theo khoảng cách và hướng trái / phải, tối đa tám người gần nhất. Máy chủ chùa chuyển tín hiệu kết nối, không ghi âm; có tắt tiếng từng người và khóa mic quản trị. |
| Chat và tường lời nguyện | Chat chung, bong bóng trên nhân vật, lời nguyện và nút Tùy hỷ. Lịch sử chat chỉ hiện tin trong 24 giờ gần nhất, tối đa 512 tin. |
| Công đức và hiệu ứng mốc | Điểm hôm nay theo giờ Việt Nam, tổng điểm, bảng công đức hôm nay, sáu pháp tướng và bốn dạng quỷ. Mốc ngày có lời chúc, meme và hiệu ứng 666; người dùng có thể tắt hiệu ứng hoặc riêng phần hù. |
| Cúng dường VietQR | Tạo QR có số tiền và mã đối soát; xác nhận bằng SePay hoặc quản trị trong chế độ thật. Có hào quang chín cảnh giới, thông báo giọng đọc và mở khóa skin khi cửa hàng được bật. |
| An toàn và kiểm duyệt | Lọc tên, tin nhắn, lời nguyện; chặn link và dãy số chống giả danh. Có che từ tục, trừ công đức, báo cáo và giới hạn tần suất / kết nối. |
| Trang quản trị | Trang `public/admin.html`, mở bằng địa chỉ `/admin.html`: duyệt cúng dường, kiểm duyệt nội dung, thông báo, sao lưu JSON và cấu hình cửa hàng skin. Cần `ADMIN_KEY`. |
| PWA, lịch âm và Sổ tay | Có manifest để cài ứng dụng, lịch âm và đếm ngược Rằm / Mùng Một. Nút `?` mở Sổ tay trong game. |

Kệ kinh có Dịch Cân Kinh, Cửu Âm Chân Kinh, Quỳ Hoa Bảo Điển, Bát Nhã Tâm Kinh, Chú Đại Bi và Kinh Dược Sư.
Bài tụng gồm Bát Nhã Tâm Kinh, Chú Đại Bi, Kinh Dược Sư / Chú Dược Sư, Niệm Phật A Di Đà, Niệm Quán Thế Âm Bồ Tát và Chuông mõ ngồi thiền.

Một số phần còn đang hoàn thiện; tiến độ từng việc ghi ở [task.md](task.md). Các file kế hoạch trong `docs/` chứa cả việc chưa làm, không phải danh sách tính năng đã phát hành.

| Danh mục Kỳ Đài | Các lựa chọn trong mã |
|---|---|
| Tám sân | Hỏa Diệm Sơn, Trường Giang, Đại Ngàn, Băng Sơn, Long Cung, Liên Hoa Đài, Lôi Vân Đỉnh, Sa Mạc Lưu Sa. |
| Tám bộ quân | Dung Nham, Ngọc Bích, Mộc Linh, Băng Tinh, San Hô, Đồng Cổ, Lôi Thạch, Sa Thạch. |
| Tám bộ đá | Tinh Hà, Lâm Tuyền, Bích Hải, Dung Nham, Băng Phách, Liên Tử, Lôi Châu, Kim Sa. |

Trong bảng cờ, chọn `Lãnh địa` để đổi nửa sân và quân; mỗi lần khai mở cách nhau ít nhất 20 giây.
Cờ vây và caro dùng nút `Bộ đá`, không đổi sân. Có nút `Ẩn skin đối thủ`.
Skin mặc định miễn phí. Quản trị có thể bật khóa và đặt giá từng mục; quyền mở được giữ theo tài khoản sau khi khoản cúng dường được duyệt.
Bàn 3D mặc định nạp mô hình quân và mặt bàn; lỗi tài nguyên thì dùng hình dựng bằng mã. Bàn 2D mặc định vẫn giữ cách vẽ cũ.

| Công đức | Quy tắc hiện hành |
|---|---|
| Cộng điểm | Nhang +10; cùng tụng hết bài +15; dâng lễ và khởi tụng +5; chuông +3; vái lạy +2; mõ, tim và Tùy hỷ +1. Cúng dường đã xác nhận: mỗi 1.000 đ được một điểm. Xin gợi ý giải thế cờ: trừ 5 (cần còn ít nhất 5). |
| Trừ điểm | Lời thô, xúc phạm, tục tĩu, chửi cha mẹ / trù ẻo, báng bổ có mức gốc lần lượt 5, 15, 30, 60, 100. Có cộng dồn và tăng khi tái phạm; tối đa 300 điểm một tin, theo `lib/moderation.js`. |
| Pháp tướng | Tổng điểm đạt 100 / 500 / 1.000 / 5.000 / 10.000 / 50.000 mở lần lượt Linh Quang Hoàn, Thanh Liên Bảo Quan, Kim Diễm Song Dực, Vạn Kiếm Quy Tông, Kim Long Pháp Tướng, Cửu Tiêu Thánh Luân. |
| Quỷ | Công đức âm hiện Tiểu Quỷ; từ −200 là Ác Quỷ, −500 là Quỷ Vương, −1.000 là Ma Vương. Mốc đặc biệt đúng 666 tổng điểm cũng có Ma Vương. |
| Mốc trong ngày | 100, 300, 500, 666, 888, 999 rồi mỗi 1.000 điểm. Máy chủ chọn mốc; tải lại trang không phát lại mốc cũ. |

Trong chế độ 3D: nút `3D` / `2D` đổi chế độ, phím `V` đổi góc nhìn; dùng WASD / mũi tên hoặc chạm sàn để đi.
Kéo để xoay, cuộn / chụm để thu phóng ở góc thứ ba; điện thoại có cần ảo. Trận PK vẫn dùng sàn 2D.
Nhân vật Blender là mặc định trong lớp 3D; nút `Người cũ` đổi về dáng dựng bằng mã. Đặt `localStorage['ta-fx3d'] = '0'` rồi tải lại để tắt bản nháp Pháp Tướng 3D.
Hiệu ứng tôn trọng `prefers-reduced-motion`; trong tab Công đức có công tắc hiệu ứng mốc và phần hù 666.

## Chạy thử trên máy

`package.json` yêu cầu Node.js từ 18. Nên dùng Node.js 22 như Render và Docker; `start:env` cần Node có hỗ trợ `--env-file`.
Chạy trong thư mục gốc repo bằng PowerShell:

```powershell
npm ci
npm start
```

Mở `http://localhost:3000`. Dùng `npm run dev` để tự khởi động lại khi sửa mã.
Muốn dùng cấu hình riêng, sao chép và sửa file mẫu trước khi chạy:

```powershell
Copy-Item .env.example .env
npm run start:env
```

Để thử nhanh tu luyện và PK, đặt biến cho phiên PowerShell rồi khởi động máy chủ:

```powershell
$env:CULTIVATION_TIME_SCALE = '0.001'
$env:PK_TIME_SCALE = '0.05'
$env:MARTIAL_SWEEP_MS = '15000'
$env:DONATION_MODE = 'test'
npm start
```

## Cấu hình

Biến được đọc khi khởi động. File [.env.example](.env.example) là mẫu; không commit `.env`, chuỗi kết nối hoặc khóa bí mật.
Mặc định dưới đây lấy từ mã, có thể khác giá trị được điền sẵn trong `render.yaml` hoặc file mẫu.

**Máy chủ và tính năng**

| Biến | Ý nghĩa | Mặc định trong mã |
|---|---|---|
| `PORT` | Cổng HTTP. | `3000` |
| `SITE_NAME` | Tên chùa, được lọc và giới hạn độ dài. | Chùa Tâm An |
| `INCENSE_MINUTES` | Số phút nhang cháy, tối thiểu một phút. | `30` |
| `MAX_PLAYERS` | Giới hạn người chơi. | `300` |
| `MAX_CONN_PER_IP` | Giới hạn kết nối mỗi IP. | `8` |
| `TRUST_PROXY` | Tin một tầng proxy; đặt `0` khi chạy trực tiếp. | Bật, một tầng |
| `MARTIAL_ENABLED` | Đặt `0` để tắt võ học và PK. | Bật |
| `PK_ENABLED` | Đặt `0` để tắt riêng PK; cần võ học bật. | Bật theo võ học |
| `PK_MAX_MATCHES` | Số trận PK đồng thời tối đa. | `20` |
| `PK_BUFF_SCALE` | Hệ số buff pháp tướng / quỷ / hào quang, từ 0 đến 1. | `0.15` |
| `KYDAO_ENABLED` | Đặt `0` để tắt Kỳ Đạo. | Bật |
| `KYDAO_MAX_GAMES` | Số ván cờ đồng thời tối đa, tính cả bàn trong. | `12` |
| `TITLES_ENABLED` | Đặt `0` để tắt danh hiệu: không tính, không phát `ptt` / `titles` / ticker. | Bật |
| `TITLE_MIN_MERIT_TOTAL`, `TITLE_MIN_MERIT_SEASON`, `TITLE_MIN_PK_GAMES`, `TITLE_MIN_PK_SEASON_GAMES`, `TITLE_MIN_GAMES`, `TITLE_ACTIVE_DAYS` | Ngưỡng để giữ danh hiệu (xem `lib/records.js`); chùa ít người có thể hạ xuống. | `1000`, `100`, `10`, `3`, `20`, `30` |

**Dữ liệu: file JSON hoặc PostgreSQL**

| Biến | Ý nghĩa | Mặc định trong mã |
|---|---|---|
| `DATA_FILE` | Đường dẫn file JSON; cũng là nguồn nhập cũ khi dùng PostgreSQL. | File `db.json` trong `data/`, được tạo khi ghi |
| `DATABASE_URL` | Chuỗi kết nối PostgreSQL; có giá trị thì chọn PostgreSQL. | Trống, dùng JSON |
| `PG_FLUSH_MS` | Nhịp ghi nền PostgreSQL, mili giây; giá trị hợp lệ từ 200. | `10000` |
| `PG_SSL` | `0` tắt SSL cục bộ; `no-verify` mã hóa nhưng bỏ kiểm chứng chứng chỉ. | Theo chuỗi kết nối; `require` được nâng thành `verify-full` |
| `PG_IMPORT_JSON` | Đặt `0` để tắt tự nhập JSON khi cơ sở dữ liệu trống. | Bật |

**Cúng dường, SePay và giọng thông báo**

| Biến | Ý nghĩa | Mặc định trong mã |
|---|---|---|
| `DONATION_MODE` | Chỉ `live` chờ xác nhận thật; các giá trị khác là thử nghiệm. | `test` |
| `BANK_ID` | Mã ngân hàng VietQR. | Trống |
| `BANK_ACCOUNT` | Tài khoản nhận; cần cả biến này và mã ngân hàng để bật QR. | Trống |
| `BANK_ACCOUNT_NAME` | Tên chủ tài khoản trên QR. | Trống |
| `BANK_LABEL` | Tên ngân hàng hiển thị. | Theo `BANK_ID` |
| `FUNDS` | Quỹ cách nhau bằng `;`, tối đa tám; thêm `\|mục tiêu` sau tên quỹ. | Tùy nhà chùa sử dụng |
| `SEPAY_API_KEY` | Khóa xác thực webhook SePay. | Trống, không bật webhook |
| `SPEEDUP_ENABLED` | Đặt `0` để tắt hoàn thành tu luyện ngay; cần võ học và QR bật. | Bật khi đủ điều kiện |
| `TTS_URL` | Địa chỉ máy chủ VieNeu đọc thông báo. | Trống, trình duyệt tự đọc |
| `TTS_VOICE` | Giọng của máy chủ đọc. | `Mai Anh` |
| `TTS_API_KEY` | Khóa truy cập máy chủ đọc, nếu cần. | Trống |
| `TTS_TIMEOUT` | Thời gian chờ TTS, giây; tối thiểu năm giây. | `45` |
| `FFMPEG_PATH` | Lệnh hoặc đường dẫn ffmpeg để nén giọng đọc sang MP3. | `ffmpeg` |

**Đăng nhập Google**

| Biến | Ý nghĩa | Mặc định trong mã |
|---|---|---|
| `GOOGLE_CLIENT_ID` | OAuth Client ID loại Web application. | Chưa đặt |
| `GOOGLE_CLIENT_SECRET` | Khóa của OAuth client. | Chưa đặt |
| `AUTH_ORIGIN` | Địa chỉ gốc HTTPS, không có `/` cuối; cho phép HTTP localhost khi thử. | Chưa đặt |

Cần đủ ba biến mới bật Google. Đăng ký redirect URI đúng địa chỉ gốc cộng `/api/auth/google/callback`; ứng dụng Google ở chế độ Testing cần thêm tài khoản thử.
Khi bật đăng nhập, võ học, luận võ và ván cờ xếp hạng (tính Elo) yêu cầu tài khoản; khách vẫn chơi được ván cờ không xếp hạng. Khách vẫn viếng chùa; dữ liệu công đức khách được gộp vào tài khoản một lần khi đăng nhập.
Tên và trang phục vẫn chọn theo thiết bị. Đừng xóa dữ liệu trình duyệt nếu đang giữ công đức bằng tài khoản khách.

**TURN và WebRTC**

| Biến | Ý nghĩa | Mặc định trong mã |
|---|---|---|
| `VOICE` | Đặt `0` để tắt nói chuyện bằng giọng. | Bật |
| `VOICE_MAX` | Số người tối đa bật nói chuyện cùng lúc. | Theo `MAX_PLAYERS` |
| `STUN_URLS` | Danh sách STUN, cách nhau bằng dấu phẩy. | `stun:stun.l.google.com:19302,stun:stun.cloudflare.com:3478` |
| `TURN_URLS` | Danh sách TURN tự dựng / dịch vụ khác, cách nhau bằng dấu phẩy. | Trống |
| `TURN_USERNAME` | Tên đăng nhập TURN tĩnh. | Trống |
| `TURN_CREDENTIAL` | Mật khẩu TURN tĩnh, được gửi cho trình duyệt để kết nối. | Trống |
| `CF_TURN_KEY_ID` | Mã khóa Cloudflare TURN. | Trống |
| `CF_TURN_API_TOKEN` | Token để máy chủ xin thông tin TURN tạm. | Trống |

Micro cần HTTPS khi đưa lên mạng. TURN giúp kết nối qua 4G hoặc mạng công ty; chọn Cloudflare TURN hoặc bộ biến TURN tĩnh.
Không cấu hình TURN thì chỉ dùng STUN công cộng. Người không cho phép micro vẫn có thể nghe.

**Quản trị**

| Biến | Ý nghĩa | Mặc định trong mã |
|---|---|---|
| `ADMIN_KEY` | Khóa quản trị cho `/admin.html` và API quản trị. | Trống, vô hiệu hóa quyền quản trị |

**Tốc độ thử nghiệm**

| Biến | Ý nghĩa | Mặc định trong mã |
|---|---|---|
| `CULTIVATION_TIME_SCALE` | Nhân thời gian phiên tu; thử bằng `0.001`. | `1` |
| `PK_TIME_SCALE` | Nhân các mốc giờ PK; thử bằng `0.05`. | `1` |
| `MARTIAL_SWEEP_MS` | Nhịp quét võ học, mili giây; tối thiểu 100. | `15000` |
| `TITLES_SWEEP_MS` | Nhịp tính lại danh hiệu, mili giây; tối thiểu 200 (chỉ hạ để thử). | `60000` |
| `KYDAO_TIME_SCALE` | Nhân các mốc giờ ván cờ; thử bằng `0.05`. | `1` |

## Cúng dường hoạt động thế nào

Chỉ cấu hình tài khoản ngân hàng của chùa khi có sự đồng ý của nhà chùa.
Cả `test` và `live` đều tạo VietQR thật theo tài khoản được cấu hình. Mã phải được ghi bền bằng `await store.flush()` trước khi trả QR.
Tạo QR chưa chứng minh ngân hàng đã nhận tiền.

| Trường hợp | Cách ghi nhận |
|---|---|
| `DONATION_MODE=test` | Tự ghi nhận sau 10 giây; lưu `mode: 'test'`, nguồn `auto` và `paidAmount=0`. Tách số thử khỏi tiền đã đối soát. |
| `DONATION_MODE=live` | Ban điều hành đối chiếu rồi xác nhận, hoặc webhook SePay đã xác thực báo giao dịch có mã khớp và đủ tiền. |
| Hoàn thành tu luyện ngay | Khoản `purpose: 'speedup'` không tự xác nhận theo ngân hàng. Trong chế độ thật, Ban điều hành phải duyệt; thông báo ngân hàng chỉ được ghi nhận để kiểm tra. |
| Gọi xác nhận lặp | Mọi nơi gọi `confirmDonation` chỉ xác nhận khoản đang chờ, nên không phát thưởng hai lần. Bản ghi đã xác nhận không bị xóa; khoản chờ quá 24 giờ thì hết hạn. |
| Mở skin | Khoản `purpose: 'skin'` được duyệt qua luồng cúng dường; quyền mở đúng skin được lưu bền theo tài khoản. |

Trong SePay, cấu hình webhook nhận tiền vào tại đường dẫn `/api/webhooks/sepay`, dùng chứng thực API Key khớp `SEPAY_API_KEY`.
Giữ nguyên mã `CD` kèm sáu ký tự trong nội dung chuyển khoản. Chưa dùng SePay thì duyệt sau khi đối chiếu sao kê tại `/admin.html`.
Hào quang có chín bậc theo `public/js/aura.js`:

| Cảnh giới hào quang | Từ | Thời gian |
|---|---|---|
| Luyện Khí | 20.000 đ | 5 phút |
| Trúc Cơ | 50.000 đ | 6 phút |
| Kim Đan | 100.000 đ | 7 phút |
| Nguyên Anh | 200.000 đ | 8 phút |
| Hóa Thần | 500.000 đ | 9 phút |
| Luyện Hư | 1.000.000 đ | 10 phút |
| Hợp Thể | 2.000.000 đ | 11 phút |
| Đại Thừa | 5.000.000 đ | 12 phút |
| Độ Kiếp | 10.000.000 đ | 13 phút |

Khoản mới cộng dồn khi hào quang còn hạn và làm mới thời gian; hết hạn thì số cộng dồn về không. Có tùy chọn ẩn danh và không hiện hào quang.
Thông báo có chuông và giọng VieNeu nếu cấu hình TTS; khi thiếu hoặc lỗi dịch vụ đọc, trình duyệt dùng giọng sẵn có. Xem [máy chủ đọc](tts/README.md).

## Triển khai

| Cách | Thiết lập trong repo |
|---|---|
| Render | Tạo Blueprint từ [render.yaml](render.yaml): Node 22, `npm ci --omit=dev`, chạy trực tiếp `node server.js`, kiểm tra `/healthz`. `ADMIN_KEY` được tạo ngẫu nhiên; điền các biến còn trống và chọn đúng chế độ cúng dường. |
| Docker | [Dockerfile](Dockerfile) dùng Node 22 Alpine, có ffmpeg và chạy bằng người dùng `node`. Gắn volume để giữ file JSON. |
| VPS | Cài phụ thuộc production, cấu hình `.env`, chạy một tiến trình bằng pm2 và đặt nginx phía trước. Bật HTTPS để dùng micro. |
| PostgreSQL Neon | Đặt `DATABASE_URL`; xem [docs/NEON.md](docs/NEON.md) để nhập dữ liệu, kiểm tra kết nối, sao lưu và xử lý sự cố. |

Render Free dùng ổ đĩa tạm, có thể ngủ khi không hoạt động; file JSON không bền qua deploy / khởi động lại.
Dùng PostgreSQL hoặc ổ bền và đặt `DATA_FILE` vào đó. Trước khi đổi nơi lưu, sao lưu rồi chuyển dữ liệu cũ.
Không chạy nhiều bản máy chủ độc lập để chia tải: trạng thái hoạt động vẫn ở RAM của một tiến trình.

```powershell
docker build -t chua-tam-an .
docker run -d -p 3000:3000 --env-file .env -v chua-data:/app/data chua-tam-an
```

Trên VPS đã có repo và Node, dùng các lệnh sau; pm2 và nginx cần được cài trên máy chủ:

```text
npm ci --omit=dev
pm2 start server.js --name chua --node-args="--env-file=.env"
pm2 save
pm2 startup
```

Ví dụ cấu hình nginx từ cách triển khai VPS; thay tên miền bằng tên miền của chùa:

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

Bật HTTPS bằng `sudo certbot --nginx` khi đã cài certbot và trỏ tên miền. Giữ các dòng nâng cấp WebSocket cho Socket.IO.
Theo dõi `/healthz`, nhất là `db` và `dbOk`; tải sao lưu JSON từ trang quản trị trước mỗi lần chuyển dữ liệu.
Render chạy Node trực tiếp để nhận tín hiệu tắt và ghi nốt dữ liệu.

## Kiến trúc trong một phút

- Không có bước build ứng dụng; máy chủ dùng Node.js CommonJS, Express 5 và Socket.IO 4.
- Một tiến trình giữ trạng thái trong RAM; `store.save()` ghi nền ra JSON hoặc PostgreSQL. JSON đợi bốn giây, PostgreSQL mặc định 10 giây.
- Việc liên quan tiền và đăng nhập chờ ghi bền trước khi trả kết quả; máy chủ tắt bình thường cũng cố ghi nốt dữ liệu.
- JavaScript thuần được nạp theo thứ tự bằng thẻ `script` trong `public/index.html`, không dùng bundler.
- Canvas 2D ở `public/js/hall.js`; Three.js chạy hoàn toàn trong trình duyệt, máy chủ chỉ phục vụ file tĩnh cho phần 3D.
- Module 3D nạp khi cần bằng `import()`; Three.js cài qua npm, được phục vụ tại `/vendor/three/`.
- `PLACES` gồm `hall`, `dojo`, `arena`; `SCENES` gồm `hall`, `yard`, `library`. Sân đấu là nơi riêng, dù dùng chung bộ vẽ cảnh.
- Logic võ học, PK và luật cờ được tách khỏi giao diện. Máy chủ kiểm lại thời gian, quyền và hành động từ người chơi.

```text
server.js             HTTP, socket, timer và điều phối
lib/                  lưu trữ, đăng nhập, kiểm duyệt, võ học, PK, Kỳ Đạo
public/js/            ứng dụng và các module giao diện / luật dùng chung
  world3d/            Three.js, cảnh, nhân vật, bàn cờ và hiệu ứng 3D
public/models/        mô hình GLB nhân vật, bàn cờ và hiệu ứng
tools/                kiểm tra, mô phỏng, dựng và chuyển đổi tài nguyên
test/                 test thuần và đầu-cuối
docs/                 hướng dẫn, giao thức, kế hoạch và bản đồ mã
```

Chi tiết tại [bản đồ kiến trúc](docs/agents/ARCHITECTURE.md); tra theo symbol trong mã vì tài liệu kế hoạch có thể chậm cập nhật trạng thái.
Trận PK đang diễn ra, lời mời và hàng chờ xin xăm không phải dữ liệu bền qua khởi động lại.

## Kiểm thử và công cụ

| Việc | Lệnh / cách dùng |
|---|---|
| Kiểm cú pháp | `npm run check`; tự quét `server.js`, `lib/`, `public/js/`, `tools/`, `test/`. |
| Toàn bộ test | `npm test`; dùng `node:test`, chạy tuần tự. Test đầu-cuối tự bật máy chủ trên cổng trống và dùng dữ liệu tạm. |
| Một file | `node --test test/pk-engine.test.js`; có thể thêm `--test-name-pattern` trước tên file để lọc ca. |
| Mô phỏng PK | `npm run sim -- roundrobin --games 2000 --seed 1`; dùng cùng engine với máy chủ. |
| Harness thủ công | `node tools/ui-harness/serve.js`; mở đường dẫn `/harness/dojo/index.html`, `/harness/arena/index.html` hoặc `/harness/kydao/index.html` trên cổng 4173. |
| Kiểm giao diện | `node tools/ui-harness/dojo/test.js` hoặc `node tools/ui-harness/kydao/ui-check.js` tự bật máy chủ tĩnh. Sân đấu: mở `node tools/ui-harness/serve.js 4174` trước, rồi ở cửa sổ khác chạy `node tools/ui-harness/arena/ui-check.js`; cần Playwright cài riêng. |
| Đầu-cuối bàn cờ | `node tools/ui-harness/kydao/e2e-real.js`; dùng máy chủ thật và hai trình duyệt. |
| Test PostgreSQL | Đặt `TEST_DATABASE_URL`, chạy `npm test`; mặc định `postgres://pagoda:pagoda@127.0.0.1:5432/pagoda_test`, không nối được thì bỏ qua các ca PG. |
| Nhập / xuất dữ liệu | `node --env-file=.env tools/db-migrate.js import`, `verify`, `export` hoặc `stats`; xem hướng dẫn Neon trước khi nhập. |
| Xem hiệu ứng mốc | Mở `http://localhost:3000/?celebrate=100`, thay bằng `666` hoặc `2000`; bản thử 666 hỏi trước khi hù. |

| Công cụ tài nguyên | Công dụng |
|---|---|
| `tools/blender/kydao/` | Dựng sân, quân, đá và tài nguyên mặc định; xem [hướng dẫn Blender](tools/blender/kydao/README.md). Sân mới làm theo [hướng dẫn riêng](docs/ky-dai/HUONG-DAN-SAN-MOI.md). |
| `tools/blender/avatar/build.py` | Dựng nhân vật Blender, tóc và trang phục. |
| `tools/blender/npc/build.py` | Dựng mô hình NPC 3D (`public/models/npc/`) từ tệp gốc ngoài repo: giảm mặt, gắn xương, gắn đạo cụ, nhuộm áo. Cách chạy ghi ở đầu script. |
| `tools/blender/fx/` | Dựng bản mẫu Ma Vương, đài sen và hào quang; xem [cách chạy](tools/blender/fx/README.md). |
| `tools/build_chants.py` | Dựng MP3 bài tụng và mốc chữ JSON bằng VieNeu-TTS; đầu vào kinh văn ở `public/js/chants.js`. |
| `tools/build_blessing_voice.py` | Dựng các clip lời chúc mốc công đức. |
| `tools/fx/` và `tools/memes/` | Chuyển ảnh hiệu ứng từ PNG sang WebP và dựng thẻ meme. |

Bài tụng có sẵn giọng tổng hợp, mõ và chuông; không cần chạy TTS khi người chơi cùng tụng. Giọng tổng hợp có thể đọc sai chữ Hán Việt, cần nghe lại khi dựng.
Cài công cụ dựng bài trên môi trường Python riêng: `pip install vieneu librosa soundfile audiotsm faster-whisper "onnxruntime==1.22.1"`.
Ví dụ dựng bài bằng giọng có sẵn: `python tools/build_chants.py --voice "Thiền Tâm Đức"`.
Nhân bản bằng tùy chọn `--ref-audio`, mặc định lấy 60 giây đầu; dùng `--ref-seconds` để đổi. Cần sự đồng ý; file mẫu phải nằm ngoài repo, không commit hoặc tải lên dịch vụ khác. Không sửa tay MP3 / JSON hay ảnh WebP sinh ra, hãy sửa đầu vào và chạy lại công cụ.
Thêm kinh bằng Markdown và mục trong `public/kinh/index.json`; có chương, mục lục, kệ, ảnh và định dạng chữ cơ bản.
Thêm meme vào `public/img/memes/`; máy chủ đọc lại danh mục, nhưng phải ghi nguồn và giấy phép trước khi dùng.

## Tài nguyên và giấy phép

Mã nguồn **chưa khai báo giấy phép cho phép sử dụng lại**: không có file `LICENSE`, `package.json` ghi `UNLICENSED` và `private: true`.
Tài nguyên có giấy phép riêng; không suy từ giấy phép của một ảnh sang toàn bộ dự án.

| Loại | Nguồn và điều kiện |
|---|---|
| Ảnh, mô hình, hiệu ứng | [public/img/NOTICE.txt](public/img/NOTICE.txt); gồm tài nguyên tự dựng, Canva và nguồn Poly Haven CC0. |
| Ảnh chụp làm meme | [public/img/PHOTO-CREDITS.txt](public/img/PHOTO-CREDITS.txt); giữ ghi công cho ảnh CC BY. |
| Âm thanh | [public/audio/NOTICE.txt](public/audio/NOTICE.txt); giọng VieNeu dùng mô hình Apache-2.0, nhạc và tiếng chuông có nguồn riêng. |
| Kinh văn và hình minh họa | [public/kinh/NOTICE.txt](public/kinh/NOTICE.txt); bản dịch Kinh Dược Sư có CC BY-SA 4.0. |
| Thư viện và nội dung bói toán | [public/data/NOTICE.txt](public/data/NOTICE.txt); Three.js theo MIT, lời tarot và tử vi do dự án viết. |

Không thêm tài nguyên còn bản quyền khi chưa có quyền sử dụng. NOTICE hiện còn ghi việc cần xác minh quyền dùng Obito, tiếng chuông và tài liệu Dịch Cân Kinh trước khi phát hành rộng.
Giấy phép của mô hình do người khác dựng không tự bao gồm quyền với nhân vật, logo hoặc tác phẩm gốc.

## Tài liệu chi tiết

| Tài liệu | Đọc khi cần |
|---|---|
| [Hướng dẫn nâng cấp](docs/HUONG-DAN-NANG-CAP.md) | Muốn đổi X thì sửa ở đâu, công thức từng loại nâng cấp, danh sách kiểm trước khi merge. |
| [Lưu trữ Neon](docs/NEON.md) | Cấu hình PostgreSQL, nhập / xuất, sao lưu và xử lý lỗi. |
| [Võ học](docs/VO-HOC.md) | Tu luyện, chiêu thức và luật luận võ; kiểm số liệu hiện hành trong mã. |
| [Giao thức võ học](docs/VO-HOC-GIAO-THUC.md) | Payload, lưu trữ và hợp đồng giao diện. |
| [Cân bằng võ học](docs/VO-HOC-CAN-BANG.md) | Số liệu, mô phỏng và quyết định cân bằng. |
| [Giao thức Kỳ Đạo](docs/KY-DAO-GIAO-THUC.md) | Năm môn cờ, Elo, socket, skin và lưu ván. |
| [Kế hoạch Kỳ Đài](docs/KE-HOACH-KY-DAI.md) | Thiết kế skin và hợp đồng tài nguyên; trạng thái xem thêm bảng việc. |
| [Làm sân mới](docs/ky-dai/HUONG-DAN-SAN-MOI.md) | Dựng sân bằng Blender, dùng mô hình nguồn và kiểm độ rõ bàn cờ. |
| [Kế hoạch 3D](docs/KE-HOACH-3D.md) | Kiến trúc lớp vẽ 3D và phần còn chờ soát. |
| [Kế hoạch Pháp Tướng 3D](docs/KE-HOACH-PHAP-TUONG-3D.md) | Bản mẫu, ngân sách mô hình và các bước chưa hoàn thành. |
| [Tử Vi quy ước](docs/TU-VI-QUY-UOC.md) | Bảng sao và khác biệt trường phái; còn thiếu đối chiếu với hai công cụ Việt. |
| [Bản đồ mã](docs/agents/ARCHITECTURE.md) | Module, dữ liệu và các điểm phải sửa đồng bộ. |
| [Gói ngữ cảnh](docs/agents/CONTEXT-PACKS.md) | Chọn đúng nhóm file trước khi làm việc. |
| [Điều phối agent](docs/agents/ORCHESTRATION.md) | Phân thẻ, vùng sửa và báo cáo bàn giao. |

## Đóng góp

Đọc [AGENTS.md](AGENTS.md), thẻ trong [task.md](task.md) và gói ngữ cảnh trước khi sửa.
Một thẻ việc, một nhánh, một PR; giữ đúng phạm vi và các điểm phải đồng bộ.
Chạy `npm run check` và test của phần thay đổi; chạy toàn bộ test khi đụng máy chủ, lưu trữ, PK hoặc giao thức.
Viết tài liệu, chú thích và chữ giao diện bằng tiếng Việt có dấu; giữ định danh mã bằng tiếng Anh.
Ghi nguồn và giấy phép tài nguyên, giữ bí mật ngoài Git, cập nhật tài liệu cùng mã.
