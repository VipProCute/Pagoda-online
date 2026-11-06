# Lưu dữ liệu bền bằng Neon (PostgreSQL miễn phí)

Trên Render bản Free, ổ đĩa là tạm: mỗi lần deploy, khởi động lại hay "ngủ", file `data/db.json` mất sạch (công đức, tài khoản, lời nguyện, cúng dường...). Neon là dịch vụ cơ sở dữ liệu (CSDL) miễn phí nằm ngoài Render nên dữ liệu không mất. Làm một lần, khoảng 15 phút, không cần viết mã.

Cách trang web dùng CSDL: toàn bộ dữ liệu vẫn nằm trong bộ nhớ của máy chủ như trước, chỉ có việc **lưu** là chuyển từ file sang Neon. Mỗi mục (một người có công đức, một lượt cúng dường, một lời nguyện...) là một dòng riêng; mỗi 10 giây máy chủ chỉ ghi những dòng vừa thay đổi. Không có thay đổi thì không gửi gì lên Neon (để Neon được "ngủ" và tiết kiệm giờ miễn phí).

Không đặt `DATABASE_URL` thì trang chạy như cũ, lưu vào file JSON.

---

## Bước 1. Tạo tài khoản Neon

1. Vào https://neon.com rồi bấm **Sign up** (Đăng ký).
2. Chọn đăng nhập bằng **GitHub** hoặc **Google** (dùng tài khoản của chùa, đừng dùng tài khoản cá nhân dễ bị mất).
3. Gói **Free** không yêu cầu thẻ ngân hàng.

## Bước 2. Tạo project (dự án)

1. Sau khi đăng nhập, bấm **Create project** (Tạo dự án).
2. **Name**: ví dụ `chua-tam-an`.
3. **Postgres version**: chọn **16** hoặc **17**.
4. **Region** (vùng): chọn **AWS Asia Pacific (Singapore) - `aws-ap-southeast-1`**. Đây là vùng gần Việt Nam nhất, trả lời nhanh nhất. Vùng không đổi được sau khi tạo.
5. Bấm **Create**. Neon tự tạo sẵn một CSDL tên `neondb` và một tài khoản chủ. Không cần tạo bảng: máy chủ chùa tự tạo bảng lần chạy đầu.

> Tên nút có thể khác chút tùy phiên bản giao diện Neon, nhưng thứ tự các bước là vậy.

## Bước 3. Lấy chuỗi kết nối

1. Trong dự án, bấm nút **Connect** (Kết nối).
2. Chọn đúng nhánh `production`, CSDL `neondb` và role mặc định.
3. Bật công tắc **Connection pooling** (với dự án mới thường đã bật sẵn).
4. Chuỗi hiện ra có dạng:

   ```
   postgresql://neondb_owner:MẬT_KHẨU@ep-ten-abc123-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
   ```

   Hãy chắc là trong tên máy có chữ **`-pooler`**. Bấm biểu tượng sao chép (có nút hiện mật khẩu nếu chuỗi đang bị che).

**Vì sao dùng `-pooler`?** Gói Free cho rất ít kết nối cùng lúc. Địa chỉ `-pooler` đi qua một "người điều phối" (PgBouncer) gom nhiều kết nối lại, nên không bao giờ bị lỗi "quá nhiều kết nối", kể cả khi Render chạy hai bản chồng nhau lúc deploy. Máy chủ chùa chỉ dùng tối đa 3 kết nối và đã tương thích với cách này.

Nếu chuỗi có thêm `&channel_binding=require`, cứ để nguyên; nếu sau này gặp lỗi liên quan `channel_binding`, xóa đoạn đó đi.

## Bước 4. Dán vào Render

1. Vào https://dashboard.render.com, chọn dịch vụ của chùa.
2. Bấm **Environment** (Môi trường) rồi **Add Environment Variable**.
3. **Key**: `DATABASE_URL`. **Value**: dán chuỗi vừa sao chép (nguyên văn, kể cả mật khẩu). Bấm **Save**.

**Tuyệt đối không** dán chuỗi này vào GitHub (kể cả file `.env`, issue, commit), vào cuộc trò chuyện, tin nhắn hay ảnh chụp màn hình. Ai có chuỗi này đọc và xóa được toàn bộ dữ liệu. Lỡ lộ: vào Neon, đổi mật khẩu role (xem mục 10), rồi dán chuỗi mới vào Render.

## Bước 5. Deploy và kiểm tra

1. Render tự deploy lại sau khi lưu biến môi trường (nếu không, bấm **Manual Deploy**).
2. Xem **Logs**, phải có các dòng như:

   ```
   [store] Đã nạp 0 tài liệu từ PostgreSQL (ep-ten-abc123-pooler.ap-southeast-1.aws.neon.tech) trong 900 ms.
   Lưu trữ: PostgreSQL · ...
   ```

3. Mở `https://<tên-trang>.onrender.com/healthz`. Kết quả đúng:

   ```
   {"ok":true,"online":0,"voice":0,"db":"pg","dbOk":true}
   ```

   - `"db":"pg"`: đang lưu bằng PostgreSQL (nếu là `"json"` nghĩa là chưa nhận `DATABASE_URL`).
   - `"dbOk":true`: đã nạp xong và lần ghi gần nhất không lỗi. Nếu là `false`, xem mục 10.
4. Thử: thắp nhang, gửi một lời nguyện, rồi chờ 15 giây. Vào Neon, mục **Tables** (hoặc **SQL Editor**, gõ `select section, count(*) from docs group by 1;`) sẽ thấy dữ liệu.
5. Thử độ bền: trên Render bấm **Manual Deploy** → **Clear build cache & deploy**. Sau khi lên, lời nguyện và công đức vẫn còn.

## Bước 6. Dữ liệu cũ

**Nói thẳng:** nếu chùa đang chạy Render Free **không có ổ đĩa**, file `db.json` cũ đã không còn mỗi lần deploy hay khởi động lại, nên không có gì để nhập. Dữ liệu hiện có (nếu còn) chỉ nằm trong bộ nhớ của máy chủ đang chạy. Việc đáng làm ngay: vào trang quản trị, bấm **Tải bản sao lưu (JSON)** để giữ một bản (xem mục dưới), rồi mới bật Neon.

Khi **CÓ** file JSON cũ (từ bản sao lưu ở trang quản trị, từ máy khác, hoặc Render có đặt ổ đĩa), có hai cách:

**Cách A: nhập tự động lần đầu.** Nếu CSDL Neon còn trống và có file ở `DATA_FILE` (hoặc `data/db.json`), máy chủ tự nhập toàn bộ trong một giao dịch ngay lần khởi động đầu, ghi log số lượng (người có công đức, lượt cúng dường, phiên đăng nhập...) và không xóa file gốc. Từ lần sau CSDL đã có dữ liệu nên **luôn lấy từ CSDL**, file không được đọc nữa. Muốn tắt hẳn tính năng này: đặt `PG_IMPORT_JSON=0`.

**Cách B: nhập thủ công từ máy tính của bạn (khuyên dùng, có đối chiếu).** Cần cài Node 22 và tải mã nguồn về máy, chạy `npm ci`. Tạo file `.env` trong thư mục mã nguồn (file này đã nằm trong `.gitignore`, không đưa lên GitHub) chỉ gồm một dòng:

```
DATABASE_URL=postgresql://...-pooler.../neondb?sslmode=require
```

rồi chạy:

```bash
node --env-file=.env tools/db-migrate.js import duong-dan/db.json     # nhập (từ chối nếu CSDL đã có dữ liệu)
node --env-file=.env tools/db-migrate.js verify duong-dan/db.json     # đối chiếu từng phần, tổng công đức, tổng tiền cúng dường, số phiên
node --env-file=.env tools/db-migrate.js stats                        # đếm tài liệu và dung lượng
```

`verify` in `OK: mọi phần khớp.` nếu đúng; nếu có khác biệt, in ra phần nào và thoát với mã lỗi 1. Muốn **thay hẳn** dữ liệu đang có trong CSDL bằng nội dung file: thêm `--replace --yes` (sẽ xóa cả những gì file không có, nên xuất bản sao trước).

Làm Cách B **trước khi** trang chạy với Neon, hoặc tạm tắt trang, kẻo người dùng ghi thêm dữ liệu giữa chừng. File cũ (version 1, chưa có võ học) nạp được bình thường; phần võ học được thêm mặc định.

## Bước 7. Sao lưu

Có ba lớp, nên dùng cả:

1. **Khôi phục về thời điểm bất kỳ trong 6 giờ gần nhất** (gói Free của Neon). Dùng khi lỡ xóa nhầm hoặc có lỗi ghi sai dữ liệu: vào dự án, **Backup & Restore** → **Restore from history**, chọn thời điểm. Lưu ý: khôi phục ghi đè cả CSDL của nhánh đó, và sau 6 giờ không còn lùi được nữa, nên phải làm sớm.
2. **Bản chụp thủ công (Snapshot)**: gói Free cho 1 bản. Nên chụp trước mỗi lần nâng cấp lớn (vào **Backup & Restore** của dự án, mục snapshot).
3. **Xuất ra file JSON định kỳ** bằng `tools/db-migrate.js export`. Đây là bản sao lưu duy nhất giữ được lâu và nằm ngoài Neon. Nhẹ nhất là bấm **Tải bản sao lưu (JSON)** ở trang quản trị mỗi tuần. Tự động hóa bằng GitHub Actions: xem mẫu bên dưới.

File xuất ra **chứa thông tin cá nhân** (tên, tài khoản Google, lời nguyện...). Mặc định không ghi phiên đăng nhập (dữ liệu nhạy cảm nhất); chỉ thêm `--with-sessions` khi thật cần. Đừng đưa file lên GitHub công khai, đừng gửi qua chat.

Dùng lại bản xuất: chạy ở chế độ JSON (đặt `DATA_FILE` trỏ tới file, bỏ `DATABASE_URL`), hoặc nhập vào Neon như Bước 6.

### Mẫu GitHub Actions (sao lưu hằng ngày, có mã hóa)

Chép vào file `.github/workflows/sao-luu.yml` **trong kho riêng tư (private)** của bạn. File này chỉ là mẫu trong tài liệu, dự án không tạo sẵn. Trước đó vào GitHub → **Settings → Secrets and variables → Actions → New repository secret**, tạo hai secret: `DATABASE_URL` (chuỗi Neon) và `BACKUP_PASSPHRASE` (một cụm mật khẩu dài do bạn đặt, **cất ở nơi an toàn**: mất cụm này thì không giải mã được bản sao lưu).

```yaml
name: Sao lưu CSDL
on:
  schedule:
    - cron: '17 20 * * *'      # 03:17 sáng giờ Việt Nam mỗi ngày
  workflow_dispatch:           # cho phép bấm chạy tay
jobs:
  backup:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: npm ci --omit=dev
      - name: Xuất dữ liệu (không gồm phiên đăng nhập)
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
        run: node tools/db-migrate.js export "$RUNNER_TEMP/db.json"
      - name: Mã hóa
        env:
          BACKUP_PASSPHRASE: ${{ secrets.BACKUP_PASSPHRASE }}
        run: |
          printf '%s' "$BACKUP_PASSPHRASE" | gpg --batch --yes --pinentry-mode loopback --passphrase-fd 0 \
            --symmetric --cipher-algo AES256 -o "sao-luu-$(date +%F).json.gpg" "$RUNNER_TEMP/db.json"
      - uses: actions/upload-artifact@v4
        with:
          name: sao-luu-csdl
          path: sao-luu-*.json.gpg
          retention-days: 30
```

Cảnh báo:
- **Không bao giờ** tải lên bản chưa mã hóa. Đừng commit file sao lưu vào kho mã. Kho phải để **private**.
- GitHub tự tắt workflow theo lịch nếu kho không có hoạt động nào trong 60 ngày; nhớ vào bật lại.
- Giải mã trên máy bạn: `gpg --decrypt sao-luu-2026-11-06.json.gpg > db.json`.
- Mỗi lần xuất tải toàn bộ dữ liệu từ Neon về (tính vào mức truyền ra 5 GB/tháng). Dữ liệu chùa chỉ vài MB nên mỗi ngày một lần là rất nhỏ.

## Bước 8. Giới hạn gói Free và cách trang tiết kiệm

Neon Free (đối chiếu ngày 06/11/2026 trên tài liệu của Neon, có thể thay đổi): mỗi dự án có **100 CU-giờ/tháng** (giờ tính toán), **1 GB** lưu trữ, **5 GB** truyền dữ liệu ra mỗi tháng; máy tính của Neon **tự ngủ sau 5 phút không có truy vấn** (không tắt được, thức lại trong chừng một giây); khôi phục trong 6 giờ; 1 bản chụp thủ công. Chạm giới hạn giờ tính toán hoặc truyền dữ liệu thì Neon tạm dừng đến kỳ sau (dữ liệu không mất); hết 1 GB thì không ghi thêm được.

Dung lượng: dữ liệu của chùa nhỏ (vài chục nghìn dòng chỉ chừng vài chục MB), 1 GB dư xa.

**Giờ tính toán mới là thứ dễ cạn.** Ước lượng: nếu Neon luôn thức ở mức nhỏ nhất (thường 0,25 CU) thì 100 CU-giờ ≈ 400 giờ ≈ chừng 16 đến 17 ngày thức liên tục. Nghĩa là nếu lúc nào cũng có người trên trang (và thực tế mỗi 10 giây đều có thay đổi cần ghi) thì Neon Free **có thể hết giờ trước cuối tháng**. Trang đã tiết kiệm như sau:

- **Ghi theo lô**: gom thay đổi trong `PG_FLUSH_MS` (mặc định 10 giây) rồi ghi một lần, chỉ các dòng đã đổi, trong một giao dịch.
- **Không ghi khi không đổi**: không có thay đổi thì không gửi câu lệnh nào, nên Neon ngủ được khi trang vắng.
- Render Free cũng tự ngủ sau 15 phút không có ai vào, khi đó Neon cũng ngủ theo.

Nếu thấy giờ tính toán dùng quá nhanh: tăng `PG_FLUSH_MS`. Neon chỉ ngủ khi 5 phút liền không có truy vấn, nên chỉ khi đặt từ khoảng `600000` (10 phút) trở lên mới ngủ được đáng kể. Đổi lại, nếu máy chủ sập đột ngột thì tối đa chừng đó thời gian thay đổi chỉ nằm trong bộ nhớ và mất; còn tắt bình thường hoặc deploy thì máy chủ luôn ghi nốt trước khi thoát. Cuối cùng, nếu cần chạy 24/7 đông người, nên nâng gói Neon (trả phí theo mức dùng).

**Theo dõi**: trong Neon Console, mục **Billing** hoặc **Usage** (hoặc trang tổng quan dự án) cho thấy giờ tính toán, dung lượng và truyền dữ liệu đã dùng trong tháng. Xem mỗi tuần một lần lúc đầu. Lệnh `node --env-file=.env tools/db-migrate.js stats` cho biết số dòng và dung lượng từng phần.

## Bước 9. Lưu ý khi deploy

- Khi deploy, Render có thể chạy **bản cũ và bản mới chồng nhau** vài chục giây. Cả hai cùng ghi vào một CSDL, mỗi dòng ghi đè dòng cùng khóa. Hệ quả: nếu cùng một dòng (ví dụ cùng một người có công đức, hoặc bộ đếm chung `meta`) bị đổi ở cả hai bản trong khoảng chồng này thì bản ghi sau thắng và có thể **mất vài giây thay đổi** của bản kia. Các dòng khác nhau không ảnh hưởng nhau. Hai bản cũng có thể cấp trùng số thứ tự cho tin nhắn / lời nguyện mới trong lúc chồng nhau (rất hiếm, và chỉ trong khoảng đó).
- Khi Render dừng bản cũ (SIGTERM), máy chủ ghi nốt phần chưa lưu rồi mới thoát (chờ tối đa vài giây).
- Nếu Neon đang ngủ, lần mở trang đầu có thể chậm thêm khoảng một giây để Neon thức dậy; máy chủ tự thử lại 3 lần khi khởi động nguội.
- Muốn giảm rủi ro chồng bản, có thể tránh deploy lúc đông người.
- Máy chủ không bao giờ tự "bắt đầu mới với dữ liệu trống" khi không nối được CSDL: không nối được sau 3 lần thử thì máy chủ không khởi động và Render báo lỗi, tốt hơn là chạy với dữ liệu trống rồi ghi đè dữ liệu thật.

## Bước 10. Xử lý sự cố

| Dấu hiệu | Cách xử lý |
|---|---|
| Log: `Không kết nối được CSDL PostgreSQL ...` và trang không lên | Kiểm tra `DATABASE_URL` có dán đủ, không thừa dấu cách hay xuống dòng. Vào Neon xem dự án còn hoạt động, không bị tạm dừng vì hết giờ. |
| `password authentication failed` | Mật khẩu sai hoặc đã đổi. Neon → **Connect** → sao chép lại chuỗi mới, dán lại vào Render. |
| Lỗi về chứng chỉ / SSL (`self-signed`, `certificate`, `SSL`) | Dùng đúng chuỗi của Neon có `?sslmode=require` (máy chủ tự nâng lên kiểm chứng đầy đủ, Neon dùng chứng chỉ công khai nên chạy được). Đừng xóa `sslmode`. Nếu vẫn lỗi vì có proxy chặn, tạm đặt `PG_SSL=no-verify` (vẫn mã hóa nhưng không kiểm chứng máy chủ). |
| Chạy PostgreSQL cục bộ (không SSL) báo lỗi SSL | Đặt `PG_SSL=0` ở máy đó. Đừng đặt trên Render. |
| `too many connections` / `remaining connection slots` | Bạn đang dùng chuỗi **không có** `-pooler`. Lấy lại chuỗi có `-pooler` (Bước 3). |
| Khởi động chậm khoảng một đến vài giây rồi vẫn lên | Neon vừa thức dậy từ chế độ ngủ. Bình thường. |
| `/healthz` có `"dbOk":false` | Lần ghi gần nhất lỗi (thường do Neon tạm không nối được hoặc hết giờ). Dữ liệu vẫn nằm trong bộ nhớ và máy chủ tự thử lại mỗi 5 giây, không sập. Xem log dòng `Lỗi ghi PostgreSQL`; nếu kéo dài, xem Neon có hết giờ tính toán không, và tải bản sao lưu JSON ở trang quản trị ngay để giữ dữ liệu. |
| Log: `File dữ liệu ... bị hỏng nên không nhập được` | File JSON cũ hỏng. Sửa/xóa file đó, hoặc đặt `PG_IMPORT_JSON=0` để bỏ qua bước nhập. |
| Log: `db có khóa chưa có phần lưu` | Lập trình viên thêm dữ liệu mới vào `db` mà chưa khai báo trong `lib/store-sections.js`; PostgreSQL sẽ không lưu khóa đó. Báo người phát triển. |
| Quên mật khẩu hoặc nghi bị lộ | Neon → dự án → **Roles & Databases** → chọn role → **Reset password** (hoặc tạo role mới, xóa role cũ). Rồi dán chuỗi mới vào Render. Chuỗi cũ lập tức vô hiệu. |
| Lỡ xóa/ghi nhầm dữ liệu | Trong 6 giờ: **Backup & Restore** → **Restore from history**. Quá 6 giờ: nhập từ bản sao lưu JSON (Bước 6, Cách B). |

---

## Bảng biến môi trường

| Biến | Mặc định | Ý nghĩa |
|---|---|---|
| `DATABASE_URL` | trống | Chuỗi kết nối Neon (có `-pooler`). Có giá trị thì lưu bằng PostgreSQL, trống thì lưu file JSON. **Bí mật**, không đưa vào GitHub hay chat. |
| `PG_FLUSH_MS` | `10000` | Ghi nền xuống CSDL sau chừng này mili-giây kể từ lần thay đổi đầu (tối thiểu 200). Tăng lên để Neon ngủ nhiều hơn. Chế độ JSON luôn là 4 giây. |
| `PG_SSL` | trống | Trống: dùng nguyên `sslmode` trong chuỗi. `0` (hoặc `false`/`off`): tắt SSL, chỉ khi chạy PostgreSQL cục bộ. `no-verify`: mã hóa nhưng không kiểm chứng chứng chỉ. |
| `PG_IMPORT_JSON` | bật | `0`: không bao giờ tự nhập file JSON cũ vào CSDL trống. |
| `DATA_FILE` | `data/db.json` | Chế độ JSON: nơi lưu. Chế độ PostgreSQL: file JSON cũ để nhập một lần khi CSDL còn trống. |

Công cụ dòng lệnh dùng `DATABASE_URL` và `PG_SSL` giống trên. Chạy `node tools/db-migrate.js help` để xem lệnh. Mật khẩu trong chuỗi luôn được che (`***`) khi in.

## Dành cho lập trình viên

- Mỗi cụm dữ liệu là một "phần" khai báo trong `lib/store-sections.js` (`meta`, `merit`, `linkedGuests`, `authSessions`, `auras`, `donations`, `prayers`, `chat`, `incense`, `martial.*`). **Thêm khóa mới ở mức cao nhất của `db` thì phải thêm phần tương ứng**, nếu không PostgreSQL sẽ không lưu (kho chỉ ghi cảnh báo trong log).
- Bảng `docs(section, k, v jsonb, updated_at)`, khóa chính `(section, k)`; bảng `schema_info(key, value)` ghi phiên bản lược đồ và dấu vết lần nhập từ JSON (`imported_from_json`).
- Mã chạy qua bộ đệm trong RAM, nên đọc dữ liệu không bao giờ chạm CSDL. Chỉ `await store.flush()` mới chờ CSDL, dùng ở chỗ cần chắc chắn đã lưu (đăng nhập, xác nhận cúng dường).
- Chạy thử cục bộ: `PG_SSL=0` với `postgres://pagoda:pagoda@127.0.0.1:5432/pagoda_test`. Kiểm thử: `node --test test/store-json.test.js test/store-pg.test.js` (test PG đọc `TEST_DATABASE_URL`, tự bỏ qua nếu không nối được).
