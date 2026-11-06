# Chùa Tâm An · Đi chùa online

Chánh điện trực tuyến cho nhiều người cùng lúc. Mỗi người vào chùa là một nhân vật mặc áo dài, có tên trên đầu, đi lại trong chánh điện và thấy nhau theo thời gian thực.

## Tính năng

| Nhóm | Có gì |
|---|---|
| Chánh điện | Ba tôn tượng, bàn thờ, bát hương, nến, đèn lồng, tủ Tàng Kinh Các. Chạm sàn (hoặc phím mũi tên / WASD) để đi lại. Chạm bát hương để thắp nhang, chạm tượng để vái lạy, chạm tủ kinh để đọc kinh. |
| Nhân vật | Tên hoặc pháp danh, giới tính, 4 kiểu tóc (có khăn vấn), 12 màu áo dài (có áo tràng lam, áo tràng nâu). |
| Lễ Phật | Thắp 1 hoặc 3 nén nhang kèm lời nguyện (nhang cháy 30 phút, khói bay, ai cũng thấy). Dâng hoa sen, hoa hồng, đèn dầu, mâm ngũ quả (hiện lên bàn thờ). Thả tim. Vái lạy (nhân vật cúi người). Gõ mõ. Thỉnh chuông (cả chánh điện cùng nghe). |
| Tụng kinh chung | Bát Nhã Tâm Kinh, Niệm Phật A Di Đà, Niệm Quán Thế Âm, Chuông mõ ngồi thiền. Giọng VieNeu-TTS v3 Turbo đọc liền câu, mõ và chuông theo nghi thức (vào mõ, kết mõ). Mọi người nghe cùng một chữ (đồng bộ theo giờ máy chủ), chữ sáng lên theo tiếng mõ. Người vào muộn nghe đúng đoạn đang tụng. |
| Tàng Kinh Các | Kệ kinh: Dịch Cân Kinh (đủ 12 thức, 59 hình minh họa, lời thơ gốc kèm phiên âm Hán Việt), Cửu Âm Chân Kinh, Quỳ Hoa Bảo Điển, Bát Nhã Tâm Kinh. Đọc theo chương, mục lục, đổi cỡ chữ, nền giấy / nền tối, nhớ chỗ đọc dở. Ai đang đọc thì có biểu tượng sách cạnh tên. |
| Nói chuyện | Nói chuyện bằng giọng như đi chùa thật: đứng gần nghe rõ, xa nghe nhỏ dần, người bên trái nghe ở tai trái. Đang tụng kinh thì tiếng nói chuyện tự nhỏ lại. Tắt tiếng từng người; ban điều hành khóa mic 10 phút. |
| Cộng đồng | Chat chung (bong bóng chat hiện trên đầu nhân vật), tường lời nguyện có nút “Tùy hỷ”, báo cáo tin nhắn. |
| Công đức | Điểm công đức cá nhân (hôm nay / tất cả) và bảng công đức hôm nay. Tính từ nhang, hoa, mõ, tim, vái lạy, tụng kinh và cúng dường (1.000đ = 1 điểm). Nói tục trong chat bị trừ theo 5 mức. Công đức cao hiện **pháp tướng** sau lưng (6 mốc), công đức âm thì có **quỷ** theo sau (4 dạng). |
| Cúng dường | Tạo mã VietQR có sẵn số tiền và mã đối soát. Tiền vào thẳng tài khoản của chùa. Tự xác nhận qua webhook SePay, hoặc ban điều hành xác nhận tay. Xác nhận xong: chánh điện đọc thông báo bằng giọng nữ VieNeu, người cúng dường được **hào quang 9 cảnh giới** (cộng dồn). |
| An toàn | Chặn tin có số tài khoản, số điện thoại, đường link (chống lừa đảo giả danh chùa). Che từ tục. Giới hạn tần suất. Tên “Ban điều hành / Admin / Trụ trì…” chỉ dành cho quản trị. |
| Quản trị | `/admin.html`: xác nhận/hủy lượt cúng dường, xem ai đang có hào quang, ẩn tin nhắn và lời nguyện (thấy cả số công đức bị trừ), gửi thông báo vào chánh điện. |
| Khác | Lịch âm và đếm ngược đến Rằm / Mùng Một, cài lên màn hình điện thoại (PWA). |

## Bài tụng: giọng, mõ và chuông

Mỗi bài tụng là một file MP3 dựng sẵn trong `public/audio/chants/` (giọng + mõ + chuông) kèm file JSON ghi mốc từng chữ. Khi có người khởi tụng, mọi trình duyệt phát cùng một file và tự chỉnh về đúng vị trí theo giờ máy chủ, nên cả chánh điện nghe cùng một chữ; chữ trên màn hình sáng theo tiếng.

- **Giọng:** [VieNeu-TTS v3 Turbo](https://huggingface.co/pnnbao-ump/VieNeu-TTS-v3-Turbo) (Apache-2.0, tác giả Phạm Nguyễn Ngọc Bảo), giọng mẫu “Thiền Tâm Đức”, đọc **liền từng câu**. Đo bằng Whisper: đọc liền rõ chữ nhất (sai ~33% trên bản có mõ và chuông), cắt rời từng chữ sai trên 50%.
- **Mõ** (theo hướng dẫn sử dụng chuông mõ của các đạo tràng): mõ gõ đúng lúc từng chữ cất lên, nương theo người tụng. Vào mõ: chữ 1 chưa gõ, chữ 2 gõ, chữ 3 không gõ, từ chữ 4 gõ đều. Thần chú nhanh hơn; niệm danh hiệu nhanh dần đều. Kết thúc lơi dần, hai tiếng mõ áp chót dính liền, tiếng cuối rời ra.
- **Chuông:** `public/audio/bell.mp3`. Một tiếng khai kinh, ba tiếng kết; cũng dùng cho nút “Thỉnh chuông”.

Dựng lại (đổi giọng, sửa kinh văn trong `public/js/chants.js`), chạy được trên CPU:

```bash
python -m venv .venv && . .venv/bin/activate && pip install vieneu librosa soundfile audiotsm faster-whisper "onnxruntime==1.22.1"
```

```bash
python tools/build_chants.py --voice "Thiền Tâm Đức"
```

Giới hạn: VieNeu được huấn luyện để đọc, không phải để tụng, nên giọng nghe như đọc kinh chậm rãi hơn là xướng tụng. Muốn giọng tụng thật nhất, hãy thu âm chư tăng chùa đối tác (có sự đồng ý) rồi thay file MP3, giữ cùng định dạng JSON.

## Tàng Kinh Các

Mỗi bộ kinh là một file Markdown trong `public/kinh/`, danh sách ở `public/kinh/index.json`. Thêm kinh mới: thêm một file `.md` và một dòng trong `index.json` (`id`, `title`, `han`, `sub`, `desc`, `file`, `cover` là `nghe` / `huyen` / `son` / `lam`, thêm `chant` nếu muốn có nút khởi tụng chung).

Cú pháp trong file kinh: `# Tên chương` (mỗi chương một trang, có mục lục), `##`, `###` tiêu đề nhỏ, `![chú thích](thư-mục/ảnh.png)` hình, `> dòng` đoạn kệ giữ nguyên từng dòng, `- mục` danh sách, `**đậm**`, `*nghiêng*`.

- **Dịch Cân Kinh**: chép từ tài liệu của Trần Đại Sỹ (sưu tầm từ ttvnol.com) do chủ dự án cung cấp, giữ thứ tự chữ và hình. Hình trong `public/kinh/dich-can-kinh/`. Lời thơ chữ Hán trong các hình “Nguyên bản” được chép lại kèm phiên âm Hán Việt.
- **Cửu Âm Chân Kinh**, **Quỳ Hoa Bảo Điển**: sách võ công hư cấu trong tiểu thuyết Kim Dung, ngoài đời không có toàn văn. Tiểu thuyết còn bản quyền nên Tàng Kinh Các không chép nguyên văn; nội dung là bài tự viết: lai lịch, các môn võ, câu khẩu quyết, lời bàn nơi cửa Phật, và chương 77 Đạo Đức Kinh (nguồn gốc thật của câu tổng cương Cửu Âm).
- **Bát Nhã Tâm Kinh**: bản phiên âm Hán Việt, có nút khởi tụng chung.

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
| 2. Trúc Cơ | 50.000đ | 6 phút | Đài sáng dưới chân |
| 3. Kim Đan | 100.000đ | 7 phút | Kim đan nơi đan điền, vầng sáng trên đầu |
| 4. Nguyên Anh | 200.000đ | 8 phút | Nguyên anh bay vòng, tia sáng xoay |
| 5. Hóa Thần | 500.000đ | 9 phút | Thần quang bốc lên như lửa |
| 6. Luyện Hư | 1.000.000đ | 10 phút | Vòng hư không đầy sao |
| 7. Hợp Thể | 2.000.000đ | 11 phút | Ngũ hành châu xoay quanh |
| 8. Đại Thừa | 5.000.000đ | 12 phút | Cột sáng từ trời, hoa sen nở |
| 9. Độ Kiếp | 10.000.000đ | 13 phút | Lôi kiếp giáng xuống, vòng ngũ sắc |

Cộng dồn: còn hào quang thì số tiền mới cộng vào số cũ (3 lần 20.000đ = 60.000đ, lên Trúc Cơ). Mỗi lần cúng dường, hào quang sáng lại từ đầu theo thời gian của cảnh giới hiện tại; hết giờ thì tắt và cộng dồn về 0. Ẩn danh, hoặc bỏ chọn “Hiện hào quang”, thì không hiện. Sửa mốc trong `public/js/aura.js`.

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

**Quỷ theo sau khi công đức âm:** dưới 0 thì Tiểu Quỷ hiện mờ, rõ hẳn ở −100; −200 thành Ác Quỷ (sừng, cánh dơi, nanh vuốt); −500 thành Quỷ Vương (vương miện sừng, lửa đen); −1.000 thành Ma Vương (bóng khổng lồ ba mắt). Làm việc thiện để công đức về trên 0 thì quỷ tan. Sửa mốc trong `public/js/merit.js`.

Máy chủ phát sự kiện `pm` (`{ id, mt, up }`) mỗi khi hình pháp tướng / quỷ của ai đó đổi; `up: true` nghĩa là vừa lên mốc pháp tướng, dùng được cho hiệu ứng chúc mừng.

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
| `VOICE` | Đặt `0` để tắt nói chuyện bằng giọng. `VOICE_MAX`: số người tối đa bật nói chuyện cùng lúc (mặc định 150). |
| `CF_TURN_KEY_ID`, `CF_TURN_API_TOKEN` | TURN của Cloudflare cho nói chuyện bằng giọng qua 4G / mạng công ty. |
| `TURN_URLS`, `TURN_USERNAME`, `TURN_CREDENTIAL` | TURN tự dựng (coturn…). `STUN_URLS` để đổi máy chủ STUN. |
| `TTS_URL` | Địa chỉ máy chủ đọc VieNeu (`python -m apps.openai_speech`). Để trống thì trình duyệt tự đọc thông báo. |
| `TTS_VOICE`, `TTS_API_KEY`, `TTS_TIMEOUT` | Giọng đọc (mặc định `Mai Anh`), khóa của máy chủ đọc, thời gian chờ (giây, mặc định 45). |

**Chỉ điền tài khoản ngân hàng đứng tên nhà chùa, khi đã có văn bản đồng ý của nhà chùa.**

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
public/js/hall.js      vẽ chánh điện, tủ kinh, nhân vật, hào quang, pháp tướng, quỷ (Canvas 2D)
public/js/voice.js     nói chuyện bằng giọng (WebRTC, nghe theo khoảng cách)
public/js/library.js   Tàng Kinh Các: kệ kinh và trang đọc
public/js/aura.js      9 cảnh giới hào quang cúng dường (dùng chung máy chủ và trình duyệt)
public/js/merit.js     6 pháp tướng công đức và 4 dạng quỷ (dùng chung)
public/kinh/           kinh trong Tàng Kinh Các (Markdown + hình)
tts/                   Dockerfile chạy máy chủ đọc VieNeu
public/js/audio.js     phát bài tụng đồng bộ, chuông, mõ
public/js/chants.js    kinh văn các bài tụng (đầu vào của tools/build_chants.py)
public/audio/          bài tụng dựng sẵn, tiếng chuông
tools/build_chants.py  dựng bài tụng bằng VieNeu-TTS
public/js/lunar.js     lịch âm
public/js/app.js       kết nối và giao diện
public/admin.html      trang quản trị
```

## Việc nên làm tiếp

- Thu âm bài tụng thật của chư tăng chùa đối tác, thay giọng mô phỏng.
- Chuyển dữ liệu sang PostgreSQL + Redis khi đông người (nhiều máy chủ).
- Đăng nhập Google / Zalo để giữ công đức khi đổi máy.
- Chia phòng “Chánh điện 1, 2…” khi quá 300 người.
- Hỏi luật sư về giấy phép mạng xã hội (Nghị định 147/2024/NĐ-CP) và bảo vệ dữ liệu cá nhân trước khi mở rộng.
