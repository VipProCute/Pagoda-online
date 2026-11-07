# Lưu dữ liệu bền bằng Neon (PostgreSQL miễn phí)

Trên Render bản Free, ổ đĩa chỉ là tạm. Mỗi lần deploy, khởi động lại hoặc "ngủ", file `data/db.json` mất sạch: công đức, tài khoản, lời nguyện, cúng dường...

**Neon** là dịch vụ cơ sở dữ liệu (CSDL) miễn phí, nằm ngoài Render, nên dữ liệu không mất. Bạn làm một lần, khoảng 20 phút, **ngay trên điện thoại, không cần viết mã**. Chỉ có một việc cần máy tính: nhập dữ liệu cũ (nếu có và muốn giữ).

Cách trang dùng CSDL: toàn bộ dữ liệu vẫn nằm trong bộ nhớ của máy chủ như trước. Chỉ việc **lưu** là chuyển từ file sang Neon. Mỗi 10 giây máy chủ ghi những mục vừa thay đổi. Không có gì thay đổi thì không gửi gì lên Neon (để Neon được "ngủ", tiết kiệm giờ miễn phí).

Không đặt `DATABASE_URL` thì trang chạy như cũ, lưu vào file JSON (và mất khi Render khởi động lại).

**Vài từ hay gặp**

| Từ | Nghĩa dễ hiểu |
|---|---|
| CSDL | Cuốn sổ cái của trang. Neon giữ giúp cuốn sổ này. |
| Dự án (project) | Một "hộp" trong Neon chứa CSDL của chùa. |
| Chuỗi kết nối | Một dòng chữ dài gồm địa chỉ, tên và **mật khẩu** để trang mở được sổ cái. Như chìa khóa: không đưa ai. |
| `-pooler` | Một đoạn chữ trong địa chỉ. Nó cho biết đây là cửa nối "có người điều phối". Nên dùng cửa này. |
| Deploy | Render chạy bản mới của trang. |
| Biến môi trường | Ô cài đặt bí mật trong Render. Chuỗi kết nối được dán vào đây. |
| Log | Nhật ký chạy của trang, xem trong Render. |

---

## Trước khi bắt đầu

- Chuẩn bị một tài khoản Google hoặc GitHub **của chùa** (đừng dùng tài khoản cá nhân, dễ mất khi người giữ đổi).
- Vào được Render, thấy dịch vụ của chùa.
- **Trang đang có dữ liệu thật cần giữ (công đức, cúng dường)?** Tải bản sao lưu **trước khi làm bước 5**, vì bước 5 làm Render deploy lại và dữ liệu tạm trên đó mất. Cách tải: mở `https://<tên-trang>.onrender.com/admin.html`, nhập mã quản trị (`ADMIN_KEY`, xem ở Render, mục Environment), bấm **Tải bản sao lưu (JSON)**. Nếu điện thoại không tải được, thử trình duyệt khác hoặc dùng máy tính. Cất file cẩn thận: trong đó có thông tin cá nhân.

## Làm theo thứ tự này trên điện thoại

Mỗi bước có dòng **Đúng là** để bạn biết mình đang làm đúng. Tên nút ở Neon và Render có thể khác chút, nhưng thứ tự thì vậy. Giải thích thêm nằm ở các mục sau.

1. **Tạo tài khoản Neon:** mở https://neon.com, bấm **Sign up**, đăng nhập bằng Google hoặc GitHub của chùa.
   *Đúng là:* bạn vào được trang quản lý của Neon (Neon Console) mà không bị đòi thẻ ngân hàng.

2. **Tạo dự án:** bấm **New Project**, đặt tên (ví dụ `chua-tam-an`), chọn vùng **Singapore**, bấm **Create project**.
   *Đúng là:* bạn thấy trang **Overview** của dự án, có sẵn nhánh `production` và CSDL `neondb`.

3. **Sao chép chuỗi kết nối:** bấm **Connect**, bật công tắc **Connection pooling**, rồi sao chép chuỗi hiện ra.
   *Đúng là:* chuỗi bắt đầu bằng `postgresql://`, trong tên máy có chữ `-pooler`, và gần cuối có `sslmode=require`. Mật khẩu là đoạn nằm sau `neondb_owner:` và trước dấu `@`.

4. **Có dữ liệu cũ muốn giữ?** Nếu có, dừng ở đây và làm mục "Nhập dữ liệu cũ" bên dưới (cần máy tính), xong quay lại bước 5. Nếu không có, qua bước 5.
   *Đúng là:* bạn đã biết mình thuộc trường hợp nào. Trang mới tinh thì cứ qua bước 5.

5. **Dán vào Render:** vào https://dashboard.render.com, chọn dịch vụ của chùa, mở **Environment**, bấm **+ Add Environment Variable**, ô **Key** gõ `DATABASE_URL`, ô **Value** dán chuỗi, rồi chọn **Save and deploy**.
   *Đúng là:* Render bắt đầu deploy (hiện đang build hoặc đang chạy bản mới).

6. **Chờ xong và xem log:** đợi trạng thái thành **Live**, rồi mở **Logs** của dịch vụ và gõ `[store]` vào ô tìm.
   *Đúng là:* thấy dòng `[store] Đã nạp ... tài liệu từ PostgreSQL (ep-...-pooler...)` và dòng `Lưu trữ: PostgreSQL`.

7. **Mở trang kiểm tra:** mở `https://<tên-trang>.onrender.com/healthz` trên trình duyệt điện thoại.
   *Đúng là:* thấy `"db":"pg","dbOk":true`.

8. **Thử một lần:** vào chánh điện, thắp một nén nhang (đừng chọn công khai lời nguyện), đợi 15 giây, rồi vào Neon mở **Tables** (hoặc **SQL Editor**) của nhánh `production`.
   *Đúng là:* bảng `docs` có các dòng mới (ví dụ phần `meta`, `merit`, `incense`).

9. **Thử độ bền:** ở Render bấm **Manual Deploy**, chọn **Restart service**, đợi **Live**, rồi mở lại trang.
   *Đúng là:* bảng công đức hôm nay vẫn còn cùng người, cùng số như trước khi khởi động lại.

10. **Đặt nếp sao lưu và theo dõi:** hẹn mỗi tuần một lần tải **Tải bản sao lưu (JSON)** ở trang quản trị và xem trang **Projects** của Neon.
    *Đúng là:* bạn có file `chua-tam-an-db-<ngày>.json` trong máy, và thấy mức đã dùng của **Compute** (CU-hours), **Storage**, **Network transfer**.

---

## Kiểm tra đã chạy đúng

**1. Dòng log khởi động.** Render, vào dịch vụ, mở **Logs**, gõ `[store]` vào ô tìm. Phải có:

```
[store] Đã nạp 0 tài liệu từ PostgreSQL (ep-ten-abc123-pooler.ap-southeast-1.aws.neon.tech) trong 900 ms.
...
Lưu trữ: PostgreSQL · Võ Học Các: BẬT · ...
```

- Lần chạy đầu với CSDL trống, số là `0`. Những lần sau, số **lớn hơn 0** và tăng dần khi có người dùng trang.
- Nếu bạn đã nhập dữ liệu cũ, trước dòng "Đã nạp" còn một dòng `Đã nhập dữ liệu từ ... vào PostgreSQL: ... người có công đức, ... lượt cúng dường ...`.
- Thấy `Lưu trữ: file JSON ...` nghĩa là trang chưa nhận `DATABASE_URL`. Xem mục "Nếu có sự cố".
- Log chỉ in tên máy, không in mật khẩu.

**2. Trang `/healthz`.** Mở `https://<tên-trang>.onrender.com/healthz`. Kết quả đúng (số `online`, `voice` có thể khác):

```
{"ok":true,"online":0,"voice":0,"db":"pg","dbOk":true}
```

- `"db":"pg"`: đang lưu bằng PostgreSQL. Nếu là `"json"` thì chưa nhận `DATABASE_URL`.
- `"dbOk":true`: đã nạp xong và lần ghi gần nhất không lỗi. Nếu là `false`, xem mục "Nếu có sự cố".
- Lưu ý: `dbOk:true` chưa chứng minh là đã có dữ liệu trong Neon. Muốn chắc, xem mục 3.

**3. Dữ liệu có thật trong Neon.** Vào Neon, mở nhánh `production`, mục **Postgres database**, chọn **Tables** (xem bảng `docs`) hoặc **SQL Editor** (chọn đúng nhánh và CSDL `neondb`), gõ rồi bấm **Run** (tên menu có thể khác chút):

```sql
select section, count(*) from docs group by 1 order by 1;
```

Sau khi có người thắp nhang và đợi 15 giây, phải thấy các dòng như `meta`, `merit`, `incense`. Trên điện thoại SQL Editor có thể khó dùng, khi đó dùng **Tables**.

**4. Bảng công đức không đổi.**
- Trước khi khởi động lại (hoặc trước khi đổi sang Neon), chụp màn hình "Bảng công đức hôm nay" và số công đức của bạn.
- Sau khi **Restart service** (hoặc sau khi nhập dữ liệu cũ), mở lại và so. Phải **giống** (cùng người, cùng số), chỉ khác nếu có ai vừa thắp nhang.
- Bảng này chỉ tính **hôm nay theo giờ Việt Nam**. Sang ngày mới nó trống, đó là bình thường: tổng công đức của từng người vẫn được giữ.
- Nếu bạn vừa chuyển từ file JSON sang Neon mà **chưa nhập dữ liệu cũ**, bảng sẽ trống hoặc khác. Đó không phải lỗi Neon: dữ liệu cũ chưa được nhập (xem "Nhập dữ liệu cũ").

**5. Trang quản trị.** `/admin.html`, ô "Dữ liệu lưu" phải ghi `PostgreSQL`. Nếu có chữ `LỖI GHI GẦN NHẤT` thì có sự cố ghi (xem bên dưới).

---

## Nếu có sự cố

Cứ xem **Logs** ở Render trước: dòng báo lỗi thường nói rõ nguyên nhân.

**Trang không lên, Render báo deploy lỗi, log có `Không khởi động được máy chủ: Không kết nối được CSDL PostgreSQL ...`**
Máy chủ đã thử nối 3 lần rồi dừng, có chủ ý: không chạy với dữ liệu trống kẻo ghi đè dữ liệu thật. Trong lúc deploy lỗi, Render giữ bản cũ đang chạy, nên trang chưa chết. Dòng lỗi phía sau cho biết lý do, xem các mục dưới đây. Kiểm tra thêm `DATABASE_URL` có dán đủ, không thừa dấu cách hay xuống dòng, và dự án Neon còn hoạt động.

**Sai mật khẩu: log có `password authentication failed`**
Mật khẩu sai hoặc đã đổi. Vào Neon, bấm **Connect**, sao chép chuỗi mới, vào Render sửa `DATABASE_URL`, chọn **Save and deploy**.

**Render không thấy biến: `/healthz` ra `"db":"json"` hoặc log ghi `Lưu trữ: file JSON`**
Thử lần lượt:
- Mục **Environment** có đúng một dòng `DATABASE_URL` (chữ hoa, không dấu cách, không sai chính tả), đang nằm ở **đúng dịch vụ**.
- Bạn đã chọn **Save and deploy**. Nếu lỡ chọn **Save only**, biến chưa được dùng cho đến lần deploy sau. **Restart service** cũng **không** nhận biến mới, phải deploy.
- Nếu dịch vụ tạo từ Blueprint (`render.yaml`): Render chỉ hỏi giá trị `DATABASE_URL` lúc tạo lần đầu. Dịch vụ đã có từ trước thì Render không hỏi lại, bạn tự thêm ở **Environment** như bước 5.

**Quên đổi sang chuỗi `-pooler`**
Neon khuyên dùng chuỗi `-pooler` làm mặc định. Quên đổi thì thường vẫn chạy, nhưng nếu log có `too many connections` hoặc `remaining connection slots are reserved`, hãy lấy lại chuỗi có `-pooler` (bước 3) và dán lại vào Render.

**Lỗi chứng chỉ / SSL: log có `self-signed`, `certificate`, `altnames` hoặc `SSL`**
Dùng đúng chuỗi của Neon có `?sslmode=require` và đừng xóa đoạn này. Máy chủ tự nâng lên kiểm tra đầy đủ, Neon dùng chứng chỉ công khai nên chạy được. Nếu thật sự do có proxy chặn, nhờ người rành đặt tạm `PG_SSL=no-verify` (vẫn mã hóa nhưng không kiểm chứng máy chủ), xong việc nên gỡ. Nếu log có `connection is insecure`, chuỗi đang thiếu `sslmode=require`: dán lại nguyên chuỗi từ Neon. Chạy PostgreSQL ngay trên máy tính (không SSL) mà báo lỗi SSL thì đặt `PG_SSL=0` **ở máy đó**, đừng đặt trên Render.

**Neon hết giờ tính toán (hoặc hết 5 GB truyền ra)**
Dấu hiệu: `/healthz` ra `"dbOk":false`, log lặp `Lỗi ghi PostgreSQL, sẽ thử lại`, trang **Projects** của Neon cho thấy **Compute** đã chạm 100 CU-hours. Theo Neon, khi hết hạn mức, máy tính của Neon bị tạm dừng đến kỳ sau, kết nối đang có bị ngắt và kết nối mới không mở được. Dữ liệu không bị xóa. Thông báo lỗi chính xác của Neon có thể khác chút.
- Trong lúc đó, dữ liệu mới vẫn nằm trong bộ nhớ của máy chủ và máy chủ tự thử ghi lại mỗi 5 giây. **Tải ngay bản sao lưu JSON** ở trang quản trị để giữ.
- **Nguy hiểm:** nếu Render khởi động lại đúng lúc này, trang sẽ **không lên** (vì không nối được CSDL). Cách chữa chắc nhất là nâng gói Neon (xem mục "Việc chủ dự án cần quyết").
- Cách tạm cuối cùng: xóa biến `DATABASE_URL` ở Render rồi deploy. Trang lên lại nhưng chạy bằng file, **dữ liệu trống**; dữ liệu trong Neon vẫn nguyên. Mọi thứ phát sinh trong lúc này sẽ mất khi Render khởi động lại. Khi Neon dùng được, thêm lại biến.

**Khởi động chậm vài giây rồi vẫn lên**
Neon vừa thức dậy từ chế độ ngủ (thường chưa tới một giây). Trên Render Free, lần mở trang đầu sau khi trang ngủ còn chậm hơn nữa (khoảng một phút) vì Render phải bật lại trang. Cả hai đều bình thường.

**`/healthz` có `"dbOk":false`**
Lần ghi gần nhất lỗi (thường do Neon tạm không nối được hoặc hết giờ). Máy chủ không sập, vẫn giữ dữ liệu trong bộ nhớ và thử lại mỗi 5 giây. Xem dòng log `Lỗi ghi PostgreSQL`. Kéo dài thì xem mục trên và tải ngay bản sao lưu JSON.

**Sau khi khởi động lại, số "Đã nạp ... tài liệu" về 0 hoặc dữ liệu biến mất**
Có thể trang đang nối **nhầm** CSDL: bạn đã dán chuỗi của dự án hoặc nhánh khác. So tên máy trong dòng log với tên máy trong chuỗi ở Neon. Dán lại chuỗi đúng.

**Log: `File dữ liệu ... bị hỏng nên không nhập được`**
Chỉ gặp khi CSDL còn trống mà có file JSON cũ bị hỏng. Sửa hoặc xóa file đó, hoặc đặt `PG_IMPORT_JSON=0` để bỏ qua bước nhập.

**Log: `db có khóa chưa có phần lưu`**
Lập trình viên thêm dữ liệu mới mà chưa khai báo trong `lib/store-sections.js`, nên PostgreSQL không lưu khóa đó. Báo người phát triển.

**Quên mật khẩu hoặc nghi bị lộ chuỗi kết nối**
Vào Neon, chọn dự án và nhánh, mở **Postgres database**, chọn **Roles**, mở menu của role `neondb_owner`, chọn **Reset password**, bấm **Reset**. Sao chép chuỗi mới, dán vào Render và chọn **Save and deploy**. Mật khẩu cũ ngừng dùng được từ lần kết nối kế tiếp, nên deploy lại là cách chắc để cắt hết kết nối cũ.

**Lỡ xóa hoặc ghi nhầm dữ liệu**
Trong 6 giờ: ở Neon mở nhánh `production`, **Postgres database**, **Backup & Restore**, bấm **Restore from history**, chọn thời điểm. Quá 6 giờ: dùng bản sao lưu JSON (mục "Nhập dữ liệu cũ").

---

## Việc chủ dự án cần quyết

Có ba việc. Bạn không cần quyết hết ngay, nhưng nên quyết trước khi chùa có đông người.

### 1. Dùng Neon Free hay trả phí?

- **Free (0 đồng, không cần thẻ):** 100 CU-giờ mỗi tháng, 1 GB lưu trữ, 5 GB truyền ra mỗi tháng, tự ngủ sau 5 phút không có truy vấn. Xem số liệu và nguồn ở mục "Giới hạn gói Free".
- **Điểm yếu:** CU-giờ (giờ tính toán) là thứ dễ cạn. Nếu Neon luôn thức ở mức nhỏ nhất (0,25 CU) thì 100 CU-giờ chỉ đủ khoảng 400 giờ, tức chừng 16 đến 17 ngày thức liên tục. Nếu trang lúc nào cũng có người, Neon Free có thể hết giờ trước cuối tháng. Nếu khách rải rác, trang (và Neon) có nhiều lúc ngủ nên thường đủ (đây là ước đoán, hãy theo dõi thực tế).
- **Trả phí (gói Launch):** theo trang giá của Neon (cập nhật 04/11/2026): 0,106 đô la mỗi CU-giờ, 0,35 đô la mỗi GB-tháng, không có mức tối thiểu hàng tháng, và cho phép tắt chế độ ngủ. Ước tính tự tính, chưa kiểm với hóa đơn thật: thức 24/7 ở 0,25 CU cả tháng 30 ngày là 180 CU-giờ, khoảng 19 đô la. Giá có thể đổi, xem https://neon.com/pricing.
- **Gợi ý:** bắt đầu bằng Free, xem trang **Projects** của Neon mỗi tuần. Nếu đi được nửa tháng mà **Compute** đã quá 50 CU-giờ, hoặc đã tăng `PG_FLUSH_MS` mà vẫn nhanh cạn, thì nâng gói.
- **Bạn quyết:** ......

### 2. `PG_FLUSH_MS`: bao lâu ghi xuống Neon một lần?

Giá trị mặc định là `10000` (10 giây). Số càng lớn thì Neon càng được ngủ nhiều (tiết kiệm CU-giờ), đổi lại nếu máy chủ **sập đột ngột** thì mất nhiều thay đổi hơn.

| Đặt | Khi máy chủ sập đột ngột | Neon ngủ được không (khi có người dùng trang) |
|---|---|---|
| `10000` (mặc định) | mất tối đa chừng 10 giây | gần như không, luôn thức |
| `300000` (5 phút) hoặc nhỏ hơn | mất tối đa chừng đó | **không giúp gì**: Neon cần im lặng 5 phút mới ngủ |
| `600000` (10 phút) | mất tối đa chừng 10 phút | khoảng một nửa thời gian (ước tính thô) |
| `1800000` (30 phút) | mất tối đa chừng 30 phút | khoảng một phần sáu thời gian (ước tính thô) |

- Khi **deploy hoặc tắt bình thường**, máy chủ luôn ghi nốt trước khi thoát (chờ tối đa vài giây), nên không mất gì.
- Đăng nhập và xác nhận cúng dường vẫn ghi **ngay**, không chờ.
- Đặt dưới `200` hoặc gõ sai (ví dụ chữ) thì máy chủ bỏ qua và dùng `10000`.
- **Gợi ý:** giữ `10000` lúc đầu. Chỉ khi Neon dùng giờ quá nhanh mới tăng, và chọn từ `600000` trở lên.
- **Bạn quyết:** ......

### 3. Có sao lưu ra ngoài Neon hay không?

Neon có sẵn khôi phục 6 giờ và 1 bản chụp tay. Nhưng nếu tài khoản Neon gặp chuyện (bị khóa, bạn mất quyền đăng nhập, lỗi phát hiện sau hơn 6 giờ), thì không còn gì. Ba mức:
- **A. Chỉ dùng cái có sẵn của Neon.** Ít việc nhất, rủi ro cao nhất.
- **B. Tải bản JSON thủ công mỗi tuần** ở trang quản trị. Mất khoảng 2 phút, làm được trên điện thoại. **Khuyên làm tối thiểu mức này.** Cần quyết ai tải, và cất file ở đâu (ví dụ thư mục riêng tư của chùa trên Google Drive, không chia sẻ công khai).
- **C. Tự động hằng ngày bằng GitHub Actions** (mẫu ở mục "Sao lưu"). Cần người rành giúp cài một lần, một kho GitHub riêng tư và một cụm mật khẩu giải mã do chùa giữ.

**Bạn quyết:** ......

---

## Giải thích kỹ các bước 1 đến 5

### Bước 1. Tài khoản Neon

Vào https://neon.com, bấm **Sign up**, chọn Google hoặc GitHub (Neon cũng cho đăng ký bằng email). Trang giá của Neon ghi gói Free là gói dùng mãi, không cần thẻ ngân hàng. Nếu giao diện đòi thẻ, rất có thể bạn đang chọn gói trả phí: dừng lại và quay về gói Free.

### Bước 2. Tạo dự án

1. Bấm **New Project**.
2. **Project name:** ví dụ `chua-tam-an`.
3. **Region** (vùng): chọn **Asia Pacific (Singapore)**, mã `aws-ap-southeast-1`. Đây là vùng gần Việt Nam trong danh sách của Neon. Vùng **không đổi được** sau khi tạo. Nên đặt máy chủ Render cùng khu vực (**Singapore**) để mỗi lần ghi nền không phải đi vòng nửa vòng trái đất; vùng của dịch vụ Render cũng không đổi được sau khi tạo, nên nếu dịch vụ hiện đang ở vùng khác thì vẫn chạy được, chỉ chậm hơn một chút (việc ghi là nền nên người chơi không thấy).
4. **Postgres version:** để mặc định. Nếu bắt buộc chọn, chọn 16 hoặc 17 (mã của chùa đã được thử trên bản 16).
5. Bấm **Create project**. Neon tạo sẵn nhánh `production`, CSDL `neondb` và role (tài khoản chủ) `neondb_owner`. **Không cần tạo bảng:** máy chủ chùa tự tạo bảng lần chạy đầu.

### Bước 3. Chuỗi kết nối

1. Trong dự án, bấm nút **Connect**. Cửa sổ "Connect to your branch" hiện ra.
2. Chọn nhánh `production`, CSDL `neondb`, role `neondb_owner`.
3. Bật công tắc **Connection pooling** (dự án mới thường đã bật sẵn).
4. Chuỗi hiện ra có dạng (đây là **mẫu giả**):

   ```
   postgresql://neondb_owner:MẬT_KHẨU@ep-ten-abc123-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
   ```

5. Sao chép nguyên chuỗi (nút sao chép nếu có; nếu không thì nhấn giữ để chọn hết rồi sao chép). Nếu mật khẩu bị che bằng dấu chấm, bấm nút hiện mật khẩu rồi sao chép. Tên nút có thể khác chút.

**Vì sao nên dùng `-pooler`?** Neon có hai loại địa chỉ: trực tiếp và `-pooler`. Neon khuyên dùng `-pooler` làm mặc định vì nó đi qua một "người điều phối" (PgBouncer), cho phép rất nhiều kết nối cùng lúc. Máy chủ chùa chỉ mở tối đa 3 kết nối và mọi thao tác của nó đều nằm trong giao dịch, hợp với cách này. Dùng địa chỉ trực tiếp thường vẫn chạy (cỡ nhỏ nhất của Neon cho gần 100 kết nối), nhưng dễ chạm trần hơn khi Render chạy hai bản chồng nhau.

Nếu chuỗi có thêm `&channel_binding=require`, cứ để nguyên. Thư viện kết nối trong mã của chùa bỏ qua tham số này nên không ảnh hưởng.

### Bước 4. Dữ liệu cũ

Xem mục "Nhập dữ liệu cũ (nếu có)" ở dưới. Nhớ: nếu cần giữ dữ liệu hiện có, tải bản sao lưu JSON **trước** bước 5.

### Bước 5. Dán vào Render

1. Vào https://dashboard.render.com, chọn dịch vụ của chùa.
2. Ở menu của dịch vụ chọn **Environment**. Trên điện thoại, menu này có thể nằm sau nút ba gạch ở góc trên.
3. Bấm **+ Add Environment Variable**.
4. **Key:** `DATABASE_URL`. **Value:** dán chuỗi vừa sao chép (nguyên văn, kể cả mật khẩu).
5. Ở nút lưu, mở danh sách và chọn **Save and deploy**. Cũng được: **Save, rebuild, and deploy** (chậm hơn một chút). Đừng chọn **Save only**, vì khi đó chưa có deploy nào dùng biến mới.
6. Nhìn lại ô Value: phải bắt đầu bằng `postgresql://`, không có dấu cách thừa ở đầu hay cuối.

**Tuyệt đối không** dán chuỗi này vào GitHub (kể cả file `.env`, issue, commit), vào cuộc trò chuyện, tin nhắn hay ảnh chụp màn hình. Ai có chuỗi này đọc và xóa được toàn bộ dữ liệu. Lỡ lộ: đổi mật khẩu role ở Neon (xem mục "Nếu có sự cố"), rồi dán chuỗi mới vào Render.

### Bước 6 đến 9

Xem mục "Kiểm tra đã chạy đúng" ở trên. Ghi chú về **Restart service**: nó chạy lại đúng bản đang chạy để thử dữ liệu có còn không. Vì ổ đĩa của Render Free bị xóa mỗi lần khởi động lại, nếu dữ liệu còn nghĩa là nó đang nằm trong Neon.

---

## Nhập dữ liệu cũ (nếu có)

**Nói thẳng:** nếu chùa đang chạy Render Free **không có ổ đĩa**, file `db.json` cũ đã mất mỗi lần deploy hay khởi động lại, nên có thể không còn gì để nhập. Dữ liệu hiện có (nếu còn) chỉ nằm trong bộ nhớ của máy chủ đang chạy. Việc đáng làm ngay: vào trang quản trị, bấm **Tải bản sao lưu (JSON)** để giữ một bản (xem mục "Trước khi bắt đầu"), **rồi mới** làm bước 5.

Khi **có** file JSON cũ (từ trang quản trị, từ máy khác, hoặc Render có ổ đĩa), có hai cách.

**Cách A: tự nhập ở lần khởi động đầu.** Nếu CSDL Neon còn trống và có file ở `DATA_FILE` (hoặc `data/db.json`), máy chủ tự nhập toàn bộ trong một giao dịch, ghi log số lượng, và không xóa file gốc. Từ lần sau CSDL đã có dữ liệu nên **luôn lấy từ CSDL**, file không được đọc nữa. Tắt hẳn tính năng này: đặt `PG_IMPORT_JSON=0` (đúng chữ `0`). Trên Render Free không có chỗ để đặt file nên cách này hầu như không dùng được ở đó.

**Cách B: nhập thủ công từ máy tính (khuyên dùng, có đối chiếu).**

1. Cài Node 22 (từ nodejs.org), tải mã nguồn của chùa về máy, mở cửa sổ lệnh (Terminal hoặc Command Prompt) trong thư mục mã và chạy `npm ci`.
2. Đăng nhập Neon **ngay trên máy tính đó** và sao chép chuỗi `-pooler` (đừng gửi chuỗi từ điện thoại sang máy tính qua chat).
3. Tạo file `.env` trong thư mục mã, chỉ một dòng (file này đã nằm trong `.gitignore`, không lên GitHub). Trên Windows nhớ lưu đúng tên `.env`, không phải `.env.txt`:

   ```
   DATABASE_URL=postgresql://...-pooler.../neondb?sslmode=require
   ```

4. Chạy lần lượt (thay `duong-dan/db.json` bằng đường dẫn tới file của bạn):

   ```bash
   node --env-file=.env tools/db-migrate.js import duong-dan/db.json   # nhập (từ chối nếu CSDL đã có dữ liệu)
   node --env-file=.env tools/db-migrate.js verify duong-dan/db.json   # đối chiếu từng phần, tổng công đức, tổng tiền cúng dường, số phiên
   node --env-file=.env tools/db-migrate.js stats                      # đếm tài liệu và dung lượng
   ```

5. Kết quả đúng: lệnh `import` in bảng đối chiếu rồi `OK: mọi phần khớp.`. Nếu có khác biệt, lệnh in ra phần nào và thoát với mã lỗi 1.
6. Giờ làm bước 5 (dán vào Render).

Những điều cần biết:
- **Làm trước khi trang chạy với Neon** là dễ nhất, vì CSDL còn trống. Khi trang đã chạy với Neon, CSDL đã có vài dòng (bộ đếm, nhang thử...), nên `import` sẽ **từ chối**. Lúc đó thêm `--replace --yes` (xóa mọi thứ trong CSDL rồi thay bằng nội dung file, nên xuất bản sao trước bằng lệnh `export`), tốt nhất khi vắng người, rồi ở Render chọn **Manual Deploy**, **Restart service** để trang nạp lại từ CSDL.
- File tải từ trang quản trị **không có phiên đăng nhập** (dữ liệu nhạy cảm). Nên sau khi nhập, mọi người phải đăng nhập lại; công đức và tài khoản vẫn nguyên. Vì thế `verify` chạy **sau khi** đã có người đăng nhập lại sẽ báo dòng "Số phiên đăng nhập" KHÁC: bình thường. Chạy `verify` ngay sau `import` là sạch nhất.
- File cũ bản 1 (chưa có võ học) nạp được bình thường; phần võ học được thêm mặc định.
- `--env-file` cần Node từ 20.6 trở lên. Dùng Node 22 cho chắc.

---

## Sao lưu

Có ba lớp, nên dùng cả:

1. **Khôi phục về thời điểm bất kỳ trong 6 giờ gần nhất** (gói Free của Neon, tối đa 1 GB thay đổi). Dùng khi lỡ xóa nhầm hoặc ghi sai dữ liệu: nhánh `production`, **Postgres database**, **Backup & Restore**, **Restore from history**, chọn thời điểm. Lưu ý: khôi phục ghi đè cả CSDL của nhánh đó; Neon tự giữ trạng thái ngay trước khi khôi phục ở một nhánh phụ tên dạng `production_old_<thời điểm>` (xem ở trang **Branches**) nên vẫn quay lại được. Sau 6 giờ thì không lùi được nữa, phải làm sớm.
2. **Bản chụp thủ công (Snapshot):** gói Free cho 1 bản, chỉ chụp được nhánh gốc (`production`), không tự hết hạn. Nên chụp trước mỗi lần nâng cấp lớn: vào trang **Backup & restore**, bật **Enhanced view** nếu cần, bấm **Create snapshot**. Tên menu có thể khác chút.
3. **Xuất ra file JSON định kỳ.** Đây là bản duy nhất giữ được lâu và nằm ngoài Neon. Nhẹ nhất: bấm **Tải bản sao lưu (JSON)** ở trang quản trị mỗi tuần. Từ máy tính: `node --env-file=.env tools/db-migrate.js export ten-file.json`. Tự động hóa bằng GitHub Actions: mẫu ở dưới.

File xuất ra **chứa thông tin cá nhân** (tên, tài khoản Google, lời nguyện...). Cả hai cách xuất đều **không ghi phiên đăng nhập** (dữ liệu nhạy cảm nhất). Với lệnh `export` chỉ thêm `--with-sessions` khi thật cần. Đừng đưa file lên GitHub công khai, đừng gửi qua chat.

Dùng lại bản xuất: chạy ở chế độ JSON (đặt `DATA_FILE` trỏ tới file, bỏ `DATABASE_URL`), hoặc nhập vào Neon như mục "Nhập dữ liệu cũ".

### Mẫu GitHub Actions (sao lưu hằng ngày, có mã hóa)

Chỉ làm nếu có người rành giúp. Chép vào file `.github/workflows/sao-luu.yml` **trong kho GitHub riêng tư (private)** có chứa mã của chùa. Nếu kho mã của chùa đang công khai, **đừng** đặt mẫu này ở đó; hãy tạo kho riêng tư khác. File này chỉ là mẫu trong tài liệu, dự án không tạo sẵn. Trước đó vào GitHub, **Settings**, **Secrets and variables**, **Actions**, **New repository secret**, tạo hai secret: `DATABASE_URL` (chuỗi Neon) và `BACKUP_PASSPHRASE` (một cụm mật khẩu dài do bạn đặt, **cất ở nơi an toàn**: mất cụm này thì không giải mã được bản sao lưu).

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
- Theo tài liệu GitHub, workflow theo lịch trong kho **công khai** bị tự tắt nếu 60 ngày không có hoạt động nào; kho riêng tư không bị quy tắc này. Dù vậy, thỉnh thoảng vào thẻ **Actions** xem nó còn chạy không.
- Giải mã trên máy bạn: `gpg --decrypt sao-luu-2026-11-06.json.gpg > db.json` (gpg sẽ hỏi cụm mật khẩu).
- Mỗi lần xuất tải toàn bộ dữ liệu từ Neon về (tính vào mức truyền ra 5 GB/tháng). Dữ liệu chùa nhỏ nên mỗi ngày một lần là rất nhẹ.

---

## Giới hạn gói Free và cách trang tiết kiệm

**Neon Free** (theo trang gói của Neon, cập nhật 04/11/2026, đối chiếu ngày 06/11/2026; có thể thay đổi): mỗi dự án có
- **100 CU-giờ** mỗi tháng (giờ tính toán), máy tính tự co giãn tối đa 2 CU;
- **1 GB** lưu trữ mỗi dự án (20 GB cho cả tài khoản);
- **5 GB** truyền dữ liệu ra mỗi tháng;
- máy tính của Neon **tự ngủ sau 5 phút không có truy vấn**, không tắt được; thức lại thường trong vài trăm mili giây;
- khôi phục về thời điểm trong **6 giờ** gần nhất (tối đa 1 GB thay đổi) và **1** bản chụp tay.

Chạm giới hạn giờ tính toán hoặc truyền dữ liệu thì Neon tạm dừng đến kỳ sau (kết nối đang có bị ngắt, kết nối mới không mở được). Hết 1 GB thì các thao tác làm tăng dung lượng bị lỗi. Không giới hạn nào xóa dữ liệu của bạn.

Dung lượng thật của chùa xem bằng lệnh `stats`; dữ liệu của chùa nhỏ nên 1 GB thường dư xa.

**Giờ tính toán mới là thứ dễ cạn.** Neon FAQ nói 100 CU-giờ đủ cho một máy 0,25 CU chạy khoảng 400 giờ. Chia ra thì chừng 16 đến 17 ngày thức liên tục. Nghĩa là nếu lúc nào cũng có người trên trang (mà khi có người thì cứ vài giây lại có thay đổi cần ghi) thì Neon Free **có thể hết giờ trước cuối tháng**. Trang đã tiết kiệm như sau:

- **Ghi theo lô:** gom thay đổi trong `PG_FLUSH_MS` (mặc định 10 giây) rồi ghi một lần, chỉ các mục đã đổi, trong một giao dịch.
- **Không ghi khi không đổi:** không có thay đổi thì không gửi câu lệnh nào. Đã kiểm tra: để máy chủ rảnh hơn một phút thì không có truy vấn nào lên CSDL.
- **Tự đóng kết nối rảnh:** kết nối rảnh quá 30 giây thì bị đóng, nên khi vắng người Neon ngủ được sau 5 phút.
- **Render Free cũng ngủ:** sau 15 phút không có ai vào, Render tắt trang (khi đó Neon cũng ngủ theo).

Nếu thấy giờ tính toán dùng quá nhanh: tăng `PG_FLUSH_MS` (xem bảng ở mục "Việc chủ dự án cần quyết"), hoặc nâng gói Neon (trả phí theo mức dùng).

**Render Free** (theo tài liệu Render): trang không có ai vào 15 phút thì bị ngủ, bật lại mất khoảng một phút. Mỗi tháng mỗi workspace có **750 giờ chạy** miễn phí (không dồn sang tháng sau; hết thì các dịch vụ Free bị tạm dừng đến tháng sau). Không gắn được ổ đĩa. Có hạn mức băng thông và phút build mỗi tháng; con số cụ thể chưa xác minh được, xem trang giá của Render.

**Theo dõi:** trong Neon Console, trang **Projects** hiển thị mức đã dùng trong kỳ: **Compute** (CU-giờ), **Storage**, **Network transfer**. Xem mỗi tuần một lần lúc đầu. Lệnh `node --env-file=.env tools/db-migrate.js stats` cho biết số dòng và dung lượng từng phần.

## Lưu ý khi deploy

- Khi deploy, Render chạy bản mới trước, rồi khoảng **60 giây sau** mới gửi lệnh dừng cho bản cũ (bản cũ có thêm tối đa 30 giây để dừng). Trong khoảng đó **hai bản chạy chồng nhau** và cùng ghi vào một CSDL, mỗi mục ghi đè mục cùng khóa. Hệ quả: nếu cùng một mục (ví dụ cùng một người có công đức, hoặc bộ đếm chung `meta`) bị đổi ở cả hai bản thì bản ghi sau thắng và có thể **mất vài giây thay đổi** của bản kia. Các mục khác nhau không ảnh hưởng nhau. Hai bản cũng có thể cấp trùng số thứ tự cho tin nhắn hoặc lời nguyện mới (rất hiếm, và chỉ trong khoảng đó). Muốn giảm rủi ro, tránh deploy lúc đông người.
- Khi Render dừng bản cũ (SIGTERM), máy chủ ghi nốt phần chưa lưu rồi mới thoát (chờ tối đa 8 giây).
- Nếu Neon đang ngủ, lần mở trang đầu có thể chậm thêm một chút để Neon thức dậy; máy chủ tự thử lại khi khởi động nguội (tổng 3 lần).
- Máy chủ không bao giờ tự "bắt đầu mới với dữ liệu trống" khi không nối được CSDL: không nối được sau 3 lần thử thì máy chủ không khởi động. Khi đó deploy báo lỗi và Render giữ bản cũ đang chạy. Đó là điều mong muốn: tốt hơn là không chạy còn hơn chạy với dữ liệu trống rồi ghi đè dữ liệu thật.

---

## Bảng biến môi trường

| Biến | Mặc định | Ý nghĩa |
|---|---|---|
| `DATABASE_URL` | trống | Chuỗi kết nối Neon (có `-pooler`). Có giá trị thì lưu bằng PostgreSQL, trống thì lưu file JSON. **Bí mật**, không đưa vào GitHub hay chat. |
| `PG_FLUSH_MS` | `10000` | Ghi nền xuống CSDL sau chừng này mili-giây kể từ lần thay đổi đầu. Phải từ 200 trở lên; nhỏ hơn hoặc không phải số thì dùng `10000`. Tăng lên để Neon ngủ nhiều hơn. Chế độ JSON luôn là 4 giây. |
| `PG_SSL` | trống | Trống: dùng nguyên `sslmode` trong chuỗi. `0` (hoặc `false`, `off`, `no`, `disable`): tắt SSL, chỉ khi chạy PostgreSQL cục bộ. `no-verify`: mã hóa nhưng không kiểm chứng chứng chỉ. |
| `PG_IMPORT_JSON` | bật | Đúng chữ `0`: không bao giờ tự nhập file JSON cũ vào CSDL trống. Giá trị khác (kể cả `false`) vẫn là bật. |
| `DATA_FILE` | `data/db.json` | Chế độ JSON: nơi lưu. Chế độ PostgreSQL: file JSON cũ để nhập một lần khi CSDL còn trống. |

Công cụ dòng lệnh dùng `DATABASE_URL` và `PG_SSL` giống trên. Chạy `node tools/db-migrate.js help` để xem lệnh (`import`, `verify`, `export`, `stats`). Mật khẩu trong chuỗi luôn được che (`***`) khi in.

## Dành cho lập trình viên

- Mỗi cụm dữ liệu là một "phần" khai báo trong `lib/store-sections.js` (`meta`, `merit`, `linkedGuests`, `authSessions`, `auras`, `donations`, `prayers`, `chat`, `incense`, `martial.*`). **Thêm khóa mới ở mức cao nhất của `db` thì phải thêm phần tương ứng**, nếu không PostgreSQL sẽ không lưu (kho chỉ ghi cảnh báo trong log).
- Bảng `docs(section, k, v jsonb, updated_at)`, khóa chính `(section, k)`; bảng `schema_info(key, value)` ghi phiên bản lược đồ và dấu vết lần nhập từ JSON (`imported_from_json`).
- Mã chạy qua bộ đệm trong RAM, nên đọc dữ liệu không bao giờ chạm CSDL. Chỉ `await store.flush()` mới chờ CSDL, dùng ở chỗ cần chắc chắn đã lưu (đăng nhập, xác nhận cúng dường).
- `lib/store-pg.js` đổi `sslmode=require/prefer/verify-ca` thành `verify-full` (pg 8.x vốn hiểu chúng như `verify-full` nhưng in cảnh báo). Pool tối đa 3 kết nối, đóng kết nối rảnh sau 30 giây. Mọi truy vấn nằm trong giao dịch (kể cả `pg_advisory_xact_lock` lúc tạo bảng), hợp với PgBouncer chế độ giao dịch của Neon.
- Chạy thử cục bộ: `PG_SSL=0` với `postgres://pagoda:pagoda@127.0.0.1:5432/pagoda_test`. Kiểm thử: `node --test test/store-json.test.js test/store-pg.test.js` (test PG đọc `TEST_DATABASE_URL`, tự bỏ qua nếu không nối được).
- **Chưa kiểm chứng trên Neon thật:** các lệnh và luồng khởi động/ghi/nhập/xuất đã chạy thử với PostgreSQL 16 cục bộ (không qua PgBouncer, không qua Neon). Việc chuỗi `-pooler`, tên nút trong giao diện Neon và Render (nhất là trên điện thoại), thông báo lỗi chính xác của Neon khi hết hạn mức, và con số băng thông Render là theo tài liệu hoặc suy ra từ mã, chưa tận mắt thấy.
