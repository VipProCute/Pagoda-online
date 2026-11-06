# Chùa Tâm An · Đi chùa online

Chánh điện trực tuyến cho nhiều người cùng lúc. Mỗi người vào chùa là một nhân vật mặc áo dài, có tên trên đầu, đi lại trong chánh điện và thấy nhau theo thời gian thực.

## Tính năng

| Nhóm | Có gì |
|---|---|
| Chánh điện | Ba tôn tượng, bàn thờ, bát hương, nến, đèn lồng. Chạm sàn (hoặc phím mũi tên / WASD) để đi lại. Chạm bát hương để thắp nhang, chạm tượng để vái lạy. |
| Nhân vật | Tên hoặc pháp danh, giới tính, 4 kiểu tóc (có khăn vấn), 12 màu áo dài (có áo tràng lam, áo tràng nâu). |
| Lễ Phật | Thắp 1 hoặc 3 nén nhang kèm lời nguyện (nhang cháy 30 phút, khói bay, ai cũng thấy). Dâng hoa sen, hoa hồng, đèn dầu, mâm ngũ quả (hiện lên bàn thờ). Thả tim. Vái lạy (nhân vật cúi người). Gõ mõ. Thỉnh chuông (cả chánh điện cùng nghe). |
| Tụng kinh chung | Bát Nhã Tâm Kinh, Niệm Phật A Di Đà, Niệm Quán Thế Âm, Chuông mõ ngồi thiền. Giọng VieNeu-TTS v3 Turbo đọc liền câu, mõ và chuông theo nghi thức (vào mõ, kết mõ). Mọi người nghe cùng một chữ (đồng bộ theo giờ máy chủ), chữ sáng lên theo tiếng mõ. Người vào muộn nghe đúng đoạn đang tụng. |
| Cộng đồng | Chat chung (bong bóng chat hiện trên đầu nhân vật), tường lời nguyện có nút “Tùy hỷ”, báo cáo tin nhắn. |
| Công đức | Điểm công đức cá nhân (hôm nay / tất cả) và bảng công đức hôm nay. Tính từ nhang, hoa, mõ, tim, vái lạy, tụng kinh. Không tính theo tiền. |
| Cúng dường | Tạo mã VietQR có sẵn số tiền và mã đối soát. Tiền vào thẳng tài khoản của chùa. Tự xác nhận qua webhook SePay, hoặc ban điều hành xác nhận tay. |
| An toàn | Chặn tin có số tài khoản, số điện thoại, đường link (chống lừa đảo giả danh chùa). Che từ tục. Giới hạn tần suất. Tên “Ban điều hành / Admin / Trụ trì…” chỉ dành cho quản trị. |
| Quản trị | `/admin.html`: xác nhận/hủy lượt cúng dường, ẩn tin nhắn và lời nguyện, gửi thông báo vào chánh điện. |
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
