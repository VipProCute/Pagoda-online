# Chùa Tâm An · Đi chùa online

Chánh điện trực tuyến cho nhiều người cùng lúc. Mỗi người vào chùa là một nhân vật mặc áo dài, có tên trên đầu, đi lại trong chánh điện và thấy nhau theo thời gian thực.

## Tính năng

| Nhóm | Có gì |
|---|---|
| Chánh điện | Ba tôn tượng, bàn thờ, bát hương, nến, đèn lồng. Chạm sàn (hoặc phím mũi tên / WASD) để đi lại. Chạm bát hương để thắp nhang, chạm tượng để vái lạy. |
| Nhân vật | Tên hoặc pháp danh, giới tính, 4 kiểu tóc (có khăn vấn), 12 màu áo dài (có áo tràng lam, áo tràng nâu). |
| Lễ Phật | Thắp 1 hoặc 3 nén nhang kèm lời nguyện (nhang cháy 30 phút, khói bay, ai cũng thấy). Dâng hoa sen, hoa hồng, đèn dầu, mâm ngũ quả (hiện lên bàn thờ). Thả tim. Vái lạy (nhân vật cúi người). Gõ mõ. Thỉnh chuông (cả chánh điện cùng nghe). |
| Tụng kinh chung | Bát Nhã Tâm Kinh, Niệm Phật A Di Đà, Niệm Quán Thế Âm, Chuông mõ ngồi thiền. Giọng tụng do VieNeu-TTS v3 Turbo đọc, mỗi tiếng mõ một chữ. Mọi người nghe cùng một chữ (đồng bộ theo giờ máy chủ), chữ sáng lên theo tiếng mõ. Người vào muộn nghe đúng đoạn đang tụng. |
| Cộng đồng | Chat chung (bong bóng chat hiện trên đầu nhân vật), tường lời nguyện có nút “Tùy hỷ”, báo cáo tin nhắn. |
| Công đức | Điểm công đức cá nhân (hôm nay / tất cả) và bảng công đức hôm nay. Tính từ nhang, hoa, mõ, tim, vái lạy, tụng kinh. Không tính theo tiền. |
| Hiệu ứng mốc | Đạt 100, 300, 500, 888, 999 rồi mỗi 1.000 công đức trong ngày thì hiện lời chúc bằng giọng nữ kèm meme chọn ngẫu nhiên và cánh sen rơi. Mốc 666 thì hù một cái bằng mặt quỷ rồi trấn an. Có công tắc tắt trong mục Công đức. |
| Cúng dường | Tạo mã VietQR có sẵn số tiền và mã đối soát. Tiền vào thẳng tài khoản của chùa. Tự xác nhận qua webhook SePay, hoặc ban điều hành xác nhận tay. |
| An toàn | Chặn tin có số tài khoản, số điện thoại, đường link (chống lừa đảo giả danh chùa). Che từ tục. Giới hạn tần suất. Tên “Ban điều hành / Admin / Trụ trì…” chỉ dành cho quản trị. |
| Quản trị | `/admin.html`: xác nhận/hủy lượt cúng dường, ẩn tin nhắn và lời nguyện, gửi thông báo vào chánh điện. |
| Khác | Lịch âm và đếm ngược đến Rằm / Mùng Một, cài lên màn hình điện thoại (PWA). |

## Giọng tụng kinh (VieNeu-TTS)

Giọng tụng được tạo bằng [VieNeu-TTS v3 Turbo](https://huggingface.co/pnnbao-ump/VieNeu-TTS-v3-Turbo) (Apache-2.0, tác giả Phạm Nguyễn Ngọc Bảo), giọng mẫu “Thiền Tâm Đức”. Tụng kinh là mỗi tiếng mõ một chữ, nên `tools/build_chant_voice.py` cho mô hình đọc riêng từng chữ có trong các bài tụng (124 chữ), cắt khoảng lặng, cân âm lượng rồi ghép thành `public/audio/chant-voice.mp3` (430 KB) kèm bảng vị trí `chant-voice.json`. Trình duyệt đặt từng chữ đúng vào nhịp mõ. Mõ và chuông vẫn là tiếng gõ tạo bằng toán.

Tạo lại (đổi giọng, thêm bài mới trong `public/js/chants.js`), chạy được trên CPU:

```bash
python -m venv .venv && . .venv/bin/activate && pip install vieneu librosa soundfile "onnxruntime==1.22.1"
```

```bash
python tools/build_chant_voice.py --voice "Thiền Tâm Đức" --demo nghe-thu.mp3
```

Giới hạn: VieNeu được huấn luyện để đọc, không phải để tụng. Đọc riêng từng chữ thì chữ cuối hơi hạ giọng, nên vài chữ thanh ngang nghe gần thanh huyền. Muốn giọng tụng thật nhất, hãy thu âm chư tăng chùa đối tác rồi thay file MP3 (giữ cùng định dạng JSON).

## Hiệu ứng mốc công đức

Khi công đức **hôm nay** (số ở thẻ “Công đức” trên đầu trang) chạm các mốc dưới đây, trình duyệt của người đạt mốc hiện hiệu ứng chúc mừng. Không ai khác thấy.

| Mốc | Hiệu ứng |
|---|---|
| 100, 300, 500 | Lời chúc bằng giọng nữ (“Chúc bạn một ngày bình an…”) kèm một meme ngẫu nhiên, cánh sen và hoa giấy rơi nhẹ. |
| 666 | Hù: mặt quỷ phóng ra chiếm màn hình khoảng 1,4 giây (một lần chớp đỏ, rung màn hình, tiếng hù), rồi mờ đi và hiện thẻ trấn an “Hù bạn thôi! A Di Đà Phật, chúc bạn bình an 🙏”. |
| 888, 999, 1.000, 2.000, 3.000… | Bản lớn: tiêu đề vàng to, nhiều hoa giấy hơn, cũng có giọng chúc và meme. |

**Cách tính.** Máy chủ quyết định, không phải trình duyệt. Mốc tính khi một lần cộng đưa công đức hôm nay từ dưới mốc lên bằng hoặc quá mốc (mỗi lần cộng là 1 đến 15 điểm nên có thể nhảy qua đúng con số). Một lần cộng bước qua nhiều mốc thì chỉ hiện một: 666 được ưu tiên, còn lại lấy mốc cao nhất. Tải lại trang hay vào lại chùa khi đã có 700 công đức không chiếu lại mốc cũ. Công đức “hôm nay” tính lại mỗi ngày theo giờ Việt Nam, nên mốc cũng vậy. Đang có một hiệu ứng thì mốc mới xếp hàng chờ (tối đa một, 666 không bao giờ bị bỏ).

**Kho meme.** Thả ảnh `.jpg .jpeg .png .webp .gif .avif` vào `public/img/memes/` là tự có, không cần sửa mã (tối đa 200 ảnh, ảnh vuông khoảng 720px đẹp nhất). Máy chủ đọc lại thư mục sau tối đa 30 giây, người chơi nhận danh sách mới khi vào chùa hoặc tải lại trang. Mỗi lần chọn ngẫu nhiên và không lặp lại ảnh vừa hiện. Ảnh lỗi thì bỏ qua, hết ảnh thì thẻ chỉ còn chữ. Mặt quỷ của mốc 666 là `public/img/devil.svg`.

**Giọng chúc.** Các file giọng đọc nằm trong `public/audio/blessings/`, kèm `manifest.json`:

```json
{ "lines": [
  { "file": "binh-an-1.mp3", "text": "Chúc bạn một ngày bình an." },
  { "file": "binh-an-2.mp3", "text": "A Di Đà Phật. Chúc bạn một ngày mới an lành." }
] }
```

Mỗi lần hiện, trình duyệt chọn ngẫu nhiên một dòng, phát file và hiện đúng câu `text` bên dưới meme. `file` chỉ là tên file thường (`.mp3 .ogg .m4a .wav`, chỉ gồm chữ không dấu, số, `.`, `-`, `_`, không có dấu `/`), máy chủ bỏ qua dòng sai hoặc file không tồn tại. Không có file giọng nào thì trình duyệt tự đọc bằng `speechSynthesis` (tiếng Việt, ưu tiên giọng nữ như HoaiMy, Linh, Google tiếng Việt); máy không có giọng tiếng Việt hay giọng không lên tiếng thì chỉ còn tiếng chuông ting nhẹ. Nút tắt tiếng trên đầu trang tắt mọi âm thanh của hiệu ứng, kể cả giọng đọc.

**Xem thử.** Mở `http://localhost:3000/?celebrate=100` (hoặc `300`, `666`, `999`, `2000`…): hiệu ứng chạy một lần sau khi vào chùa mà không cần đủ công đức. Hoặc gõ `Celebrate.test(666)` trong console của trình duyệt.

**Tắt hiệu ứng.** Vào tab **Công đức**, thẻ **Hiệu ứng** có hai ô, lưu ngay trên máy (`localStorage`: `ta-fx`, `ta-scare`):

- “Hiệu ứng chúc mừng ở các mốc công đức”: tắt thì chỉ còn dòng thông báo nhỏ “Bạn đạt N công đức”, kể cả mốc 666.
- “Cho phép hù ở mốc 666”: tắt thì mốc 666 hiện lời chúc bình thường thay cho mặt quỷ.

Người bật chế độ giảm chuyển động của hệ điều hành (`prefers-reduced-motion`) không bị rung, phóng to, chớp hay hạt bay: hình chỉ mờ hiện, mặt quỷ hiện mờ 0,2 giây không chớp đỏ. Chạm vào màn hình hoặc nhấn Esc để đóng sớm (trừ khoảng 0,7 giây đầu để người đang gõ mõ liên tục không lỡ tay tắt mất).

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
lib/moderation.js      lọc tin nhắn, tên, từ tục, số tài khoản, link
lib/store.js           lưu dữ liệu ra file JSON
public/index.html      trang chánh điện
public/js/hall.js      vẽ chánh điện và nhân vật (Canvas 2D)
public/js/audio.js     mõ, chuông, giọng tụng, clip lời chúc, tiếng hù (Web Audio)
public/js/celebrate.js hiệu ứng chúc mừng ở mốc công đức (meme, giọng chúc, hù 666)
public/css/celebrate.css giao diện của hiệu ứng trên
public/img/memes/      kho meme (thả ảnh vào là tự có), public/img/devil.svg cho mốc 666
public/audio/blessings/ giọng chúc + manifest.json
public/js/chants.js    bài tụng (dùng chung cho máy chủ và trình duyệt)
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
