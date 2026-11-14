# Đặc tả T-170 → T-174 · Khóa skin bàn cờ, cúng dường để mở

> Chủ dự án chốt ngày 2026-11-14:
> 1. Hiện tại **mọi skin miễn phí**.
> 2. Cần **cơ chế bật ngay** để khóa skin khi muốn thu tiền; người chơi **cúng dường để mở khóa**.
> 3. Mở **từng skin một**, giữ **vĩnh viễn**.
> 4. **Mức tiền do chủ dự án đặt trong trang quản trị**, không có số mặc định trong mã.
> 5. Người chơi **bấm vào skin đang khóa**, cúng dường; **khi khoản cúng dường được duyệt thì tự mở đúng skin đó**.
>
> Việc này đụng tới tiền: mọi bất biến ở `AGENTS.md` §3.1, §3.2, §3.4, §3.11 áp dụng nguyên vẹn. Thấy đặc tả mâu thuẫn mã thật thì **dừng và ghi vào bàn giao**, không đoán.

## 1. Quyết định thiết kế

| Mã | Quyết định |
|---|---|
| S1 | "Skin" gồm ba loại (`kind`): `field` (sân), `pieces` (quân cờ vua/cờ tướng/cờ úp), `stones` (đá cờ vây/caro). Khóa định danh một skin: chuỗi `kind + ':' + id`, ví dụ `field:volcano`. Bàn và quân **mặc định luôn miễn phí**. |
| S2 | Trạng thái cửa hàng lưu bền trong `db.kydao.shop = { on:false, price:null, prices:{}, updatedAt:0 }`. `on` = đang thu tiền. `price` = mức chung (đồng). `prices['field:volcano']` = mức riêng (tùy chọn) đè mức chung. |
| S3 | Không bật được (`on:true`) khi `price` chưa là số nguyên trong [10.000; 100.000.000]. Mức riêng cũng trong khoảng đó. |
| S4 | Quyền sở hữu lưu bền trong `db.kydao.unlocks[uid] = { 'field:volcano': { at, code }, … }`, khóa `uid` là **uid đã qua `accountOf`** (tài khoản nếu đã đăng nhập). Vĩnh viễn, không có hạn. |
| S5 | Khi `on:false`: mọi skin dùng được như hiện nay; `kd:skin` không kiểm sở hữu. Khi `on:true`: máy chủ từ chối `kd:skin` với mã skin chưa sở hữu (`code:'locked'`, kèm `kind`, `id`, `price`). |
| S6 | Bật khóa có hiệu lực **ngay**: các ván đang chạy bị gỡ skin mà chủ bên đó chưa sở hữu (về `null`, phát `kd:skin`); mọi client nhận trạng thái cửa hàng mới. |
| S7 | Mua: client gửi `kd:shop:buy { kind, id }`. **Giá do máy chủ lấy** từ `shop` (không nhận số tiền từ client). Máy chủ tạo khoản cúng dường `purpose:'skin'`, `item:{ kind, id }`, `amount = giá`, `await store.flush()` rồi mới trả QR. Đã có khoản `pending` cho đúng người và đúng skin thì trả lại khoản đó (không tạo trùng). Đã sở hữu thì từ chối. |
| S8 | Duyệt: dùng **đúng đường xác nhận của khoản cúng dường thường**: Ban điều hành bấm xác nhận, hoặc webhook SePay đã xác thực. Riêng `purpose:'skin'`: webhook chỉ tự xác nhận khi **số tiền nhận ≥ `d.amount`**; ít hơn thì chỉ ghi `d.bank` và để Ban điều hành quyết (giống cách xử `speedup`). `DONATION_MODE=test` tự xác nhận sau 10 giây như mọi khoản thử. |
| S9 | Khi khoản `purpose:'skin'` được xác nhận: `shop.grant(accountOf(d.uid), kind, id, d.code)`; **idempotent** bằng cờ `d.outcome = 'granted'` trên bản ghi và bằng chính bảng `unlocks`. Gửi `kd:shop:state` mới cho đúng chủ. Khoản bị hủy/hết hạn: không làm gì. Không xoá khoản đã xác nhận. |
| S10 | Khoản `purpose:'skin'` vẫn là cúng dường: vẫn cộng công đức, hào quang, vẫn hiện trong sổ cúng dường như khoản thường. |
| S11 | Khách đăng nhập: `linkGuest` gộp `unlocks[guest]` vào `unlocks[account]` (hợp, giữ mốc `at` sớm hơn), có hoàn tác như các phần gộp khác. |
| S12 | Không bao giờ gửi uid cho client khác. `kd:shop:state` chỉ gửi cho chính người đó: `{ on, price, prices, owned:[ 'field:volcano', … ] }`. `/api/config` chỉ có `kydao.shop = { on }`. |
| S13 | Mọi thay đổi cấu hình cửa hàng ghi `audit()` (ai, lúc nào, giá cũ → mới, bật/tắt). |

## 2. Các thẻ (chạy nối tiếp: T-170 → T-171 → T-172 và T-173 song song → T-174)

### T-170 · Module thuần `lib/kydao/shop.js` và lưu bền

**File:** `lib/kydao/shop.js` (mới), `lib/store-sections.js`, `test/kydao-shop.test.js` (mới), `test/store-json.test.js`, `test/store-pg.test.js`.

1. `lib/store-sections.js`: trong `kydaoFresh` (tìm hàm tạo mặc định của `kydao`) thêm `shop: { on: false, price: null, prices: {}, updatedAt: 0 }` và `unlocks: {}`; thêm section tương ứng vào `SECTIONS` theo đúng cách các khóa lồng của `kydao` đang khai (đọc cách `kydao.*` hiện có được khai: `map(...)`/`list(...)` và `NESTED`); `adopt()` phải vá dữ liệu cũ thiếu hai khóa này. Cập nhật danh sách section cứng và `fill()` trong `test/store-pg.test.js`, và test liệt kê khóa trong `test/store-json.test.js`. Thêm test: dữ liệu cũ không có `shop`/`unlocks` → sau `adopt` có mặc định; ghi rồi đọc lại (JSON) giữ nguyên `unlocks`.
2. `lib/kydao/shop.js`: logic **thuần** (không socket, không timer, không I/O; `now` tiêm vào), kiểu nhà máy:
   ```js
   createShop({ getState, catalog, now })
   // getState() → db.kydao (đối tượng sống; module chỉ đọc/ghi .shop và .unlocks)
   // catalog = require('../../public/js/kydao-skins.js')
   ```
   API:
   - `keyOf(kind, id)` → `'field:volcano'` hoặc `null` nếu `kind` không thuộc `['field','pieces','stones']` hoặc `id` không có trong bảng tương ứng của danh mục (`FIELDS`, `PIECES`, `STONES`; kiểm bằng `hasOwnProperty`, `typeof id === 'string'`).
   - `publicConfig()` → `{ on, price, prices }` (bản sao; `prices` chỉ gồm khóa hợp lệ).
   - `setConfig(input)` → `{ ok:true, config }` hoặc `{ ok:false, reason }`. Chỉ nhận các khóa `on` (boolean), `price` (số nguyên hoặc `null`), `prices` (object khóa hợp lệ → số nguyên hoặc `null` để xoá mức riêng). Kiểm S3. Không sửa gì nếu lỗi. Đặt `updatedAt = now()`. Chống prototype pollution (`__proto__`, `constructor`, `prototype` bị bỏ).
   - `priceOf(kind, id)` → số hoặc `null` (skin không hợp lệ, hoặc chưa có giá).
   - `owns(uid, kind, id)` → boolean. `id == null` (mặc định) luôn `true`.
   - `allowed(uid, kind, id)` → `true` nếu `!on` hoặc `owns`.
   - `grant(uid, kind, id, code)` → `{ ok:true, added:true|false }`; đã có thì `added:false` và **không** đổi `at`/`code`.
   - `owned(uid)` → mảng khóa đã sở hữu (đã sắp xếp).
   - `mergeGuest(guestUid, accountUid)` → trả hàm `undo()`; gộp theo S11.
3. Test `test/kydao-shop.test.js` (tên tiếng Việt), tối thiểu: không bật được khi chưa có giá; giá ngoài khoảng, số lẻ, chuỗi, `NaN` bị từ chối; `prices` với khóa lạ/`__proto__` bị bỏ; `priceOf` ưu tiên mức riêng; `allowed` đúng ở cả `on` và `off`; `grant` idempotent; `mergeGuest` + `undo` khôi phục đúng nguyên trạng; `owned` không lộ dữ liệu của uid khác.

Kiểm: `npm run check`; `node --test test/kydao-shop.test.js test/store-json.test.js`; `npm test`.

### T-171 · Nối máy chủ

**File:** `server.js`, `lib/kydao/manager.js`, `lib/account.js` (nếu `linkGuest` nằm đó, nếu không thì chỉ `server.js`), `docs/KY-DAO-GIAO-THUC.md`, `docs/agents/ARCHITECTURE.md` (§3, §4), `test/kydao-manager.test.js`, `test/e2e-kydao-shop.test.js` (mới), `.env.example` (nếu thêm biến).

Đọc trước: báo cáo khảo sát luồng cúng dường tóm tắt ở mục 3 dưới đây; các đoạn `server.js` được dẫn ở đó.

1. Khởi tạo `const shop = createShop({ getState: () => store.get().kydao, catalog: KydaoSkins, now: Date.now })` cạnh chỗ tạo `kydao` manager.
2. `lib/kydao/manager.js`, `api.skin`: thêm phụ thuộc tiêm `deps.skinAllowed(uid, kind, id)` (mặc định luôn `true` để test cũ không đổi). Sau khi chuẩn hóa `want`, với mỗi khóa đang đổi sang giá trị khác `null`: `kind` = `'field'` cho `field`; cho `pieces` thì `'stones'` nếu môn thuộc `KydaoSkins.STONE_GAMES`, ngược lại `'pieces'`. Không được phép → `return Object.assign(fail('Skin này cần cúng dường để mở.', 'locked'), { kind, id, price: deps.skinPrice ? deps.skinPrice(kind, id) : null })`. Kiểm này đứng **trước** kiểm tần suất. Thêm `api.revalidateSkins()`: duyệt mọi ván đang chạy, bên nào có skin không còn được phép thì đặt về `null` và phát `kd:skin` (với `opened:false`); trả số bên đã gỡ. Test trong `test/kydao-manager.test.js`.
3. `server.js`: truyền `skinAllowed: (uid, kind, id) => shop.allowed(accountOf(uid), kind, id)` và `skinPrice` khi tạo manager.
4. Socket `kd:shop:state` (client → máy chủ, có ack): trả `{ ok:true, on, price, prices, owned: shop.owned(accountOf(uid)) }`. Máy chủ cũng **đẩy** sự kiện `kd:shop:state` (cùng nội dung) cho đúng socket của người đó khi: vừa vào phòng (join), sau khi mở khóa, sau khi cấu hình đổi (mỗi người nhận bản của riêng mình). Dùng đúng khuôn handler `kd:*` hiện có (`kydaoOnly`/`kdPass`, rate limit `bucket('kd', …)`), không ném lỗi.
5. Socket `kd:shop:buy { kind, id }` (có ack), theo S7:
   - `shop.publicConfig().on` phải `true`, `DONATION_ENABLED` phải bật; `key = shop.keyOf(kind, id)` hợp lệ; chưa sở hữu; `price = shop.priceOf(kind, id)` là số.
   - Rate limit riêng 8 giây như socket `donate` (xem `server.js` quanh handler `donate`).
   - Tìm khoản `pending` hiện có của **đúng uid** với `purpose:'skin'` và cùng `item` → trả lại `donationAck` của nó.
   - Không có thì `addDonation({ purpose:'skin', item:{ kind, id }, amount: price, fund: <quỹ mặc định như handler donate dùng khi client không chọn>, name: <tên người chơi đã qua kiểm duyệt như handler donate>, anon:false, hide:false, aura:true, note:'', uid })`, rồi **`await store.flush()`**; flush thất bại thì hủy khoản và trả `ok:false` (làm y như handler `donate`). Sau đó làm đúng các bước handler `donate` làm sau flush (`armNewTestDonation`/`scheduleTestDonation`), trả `Object.assign({ ok:true, kind, id }, donationAck(d))`.
   - Mọi lỗi trả `ack({ ok:false, reason:'…tiếng Việt…' })`.
6. `confirmDonation(d, info)`: sau phần chung, thêm nhánh `if (d.purpose === 'skin' && d.item && d.outcome !== 'granted')`: `shop.grant(accountOf(d.uid), d.item.kind, d.item.id, d.code)`; đặt `d.outcome = 'granted'`; đẩy `kd:shop:state` cho mọi socket của người đó (tìm theo uid như cách `donation:ok` đang gửi cho đúng chủ). Phải đúng khi gọi hai lần (admin bấm lại, webhook gọi lại).
7. Webhook SePay: thêm nhánh cho `d.purpose === 'skin'` theo S8 (số tiền nhận ≥ `d.amount` mới xác nhận; nhỏ hơn thì ghi `d.bank` + flush, không xác nhận). **Không đổi** nhánh `speedup` và nhánh khoản thường.
8. `linkGuest`: gọi `shop.mergeGuest(guest, account)` và đưa `undo` vào chuỗi hoàn tác sẵn có.
9. API quản trị (sau middleware `admin`): `GET /api/admin/kydao-shop` → `{ config, catalog: { field:[{id,name}], pieces:[…], stones:[…] }, stats: { owners: <số uid có ít nhất một skin>, unlocks: <tổng số lượt mở> } }`; `POST /api/admin/kydao-shop` body `{ on?, price?, prices? }` → `shop.setConfig`, `audit(...)`, `await store.flush()`, rồi nếu `on` vừa chuyển sang `true` hoặc giá đổi: `kydao.revalidateSkins()` (chỉ khi bật) và đẩy `kd:shop:state` cho mọi socket đang nối (mỗi người bản riêng). Trả `{ ok, config }`. Body lớn/khóa lạ bị bỏ.
10. `clientConfig()` → `kydao.shop = { on }`.
11. Tài liệu: `docs/KY-DAO-GIAO-THUC.md` thêm mục "Cửa hàng skin" (sự kiện `kd:shop:state`, `kd:shop:buy`, mã lỗi `locked`, trường `purpose:'skin'`, `item`, `outcome`); `ARCHITECTURE.md` §3 (dữ liệu) và §4 (sự kiện).
12. Test `test/e2e-kydao-shop.test.js` (dùng `test/helpers/live.js`, `client.js`; `DONATION_MODE=test`, có `BANK_ID`/`BANK_ACCOUNT` giả như các test cúng dường hiện có; `ADMIN_KEY` giả):
    - cửa hàng tắt: `kd:skin` tự do; `kd:shop:buy` bị từ chối;
    - bật không có giá → 400/`ok:false`; đặt giá rồi bật → được; sai `x-admin-key` → 401/403;
    - bật khi ván đang có skin → cả hai nhận `kd:skin` gỡ về `null`;
    - `kd:skin` skin chưa mở → `code:'locked'` kèm `price`;
    - `kd:shop:buy` → ack có QR, `amount` đúng giá máy chủ (kể cả khi client gửi kèm `amount` khác), gọi lại → cùng `code`;
    - chờ tự xác nhận (test mode) → nhận `kd:shop:state` có `owned` chứa khóa đó → `kd:skin` thành công; người khác vẫn bị khóa;
    - admin xác nhận lại khoản đó → không lỗi, `owned` không đổi;
    - khởi động lại máy chủ (cách các test e2e khác làm) → vẫn sở hữu;
    - payload gửi người khác không chứa uid.
13. `npm run check`; `npm test` (đụng `server.js`, `lib/store*`, giao thức).

### T-172 · Trang quản trị

**File:** `public/admin.html` (và JS/CSS nội tuyến của nó), `?v=` nếu có.

Thêm khối "Cửa hàng skin bàn cờ": công tắc **Đang thu tiền** (bật/tắt), ô **Mức chung (đ)**, bảng mọi skin theo ba nhóm (Sân, Quân, Đá) với ô **Mức riêng** (để trống = dùng mức chung), nút **Lưu**, dòng thống kê (số người đã mở, số lượt mở), và cảnh báo rõ khi bật: "Bật thì mọi skin chưa mở sẽ bị gỡ khỏi các ván đang chơi ngay." Nút Lưu bị khóa khi bật mà chưa có mức chung. Gọi `GET/POST /api/admin/kydao-shop` với header `x-admin-key` như các lời gọi khác trong file. Chữ gán bằng `textContent`; tiền định dạng `Intl.NumberFormat('vi-VN')` + `đ`. Khoản `purpose:'skin'` trong danh sách cúng dường hiện thêm nhãn "Mở skin: <tên skin>" (đọc cách file đang phân loại `speedup`).

### T-173 · Bộ chọn trong bảng cờ

**File:** `public/js/kydao-ui.js`, `public/css/kydao.css`, `public/js/app.js` (chỉ chuyển sự kiện `kd:shop:state` và `donation:ok` cho KydaoUI như đang làm với `kd:skin`), `public/index.html` (`?v=`), `test/kydao-ui-core.test.js`, `test/kydao-ui-games.test.js`.

1. Trạng thái: `shop = { on:false, price:null, prices:{}, owned:[] }` cập nhật khi nhận `kd:shop:state` (qua `KydaoUI.apply({ type:'kd:shop:state', … })`) và hỏi một lần khi mở bảng cờ (`send('kd:shop:state', {}, cb)`).
2. Hàm thuần trong `core`: `skinLocked(shop, kind, id)` → `true` khi `shop.on`, `id` khác `null` và `kind+':'+id` không nằm trong `owned`; `skinPrice(shop, kind, id)` → mức riêng hoặc mức chung hoặc `null`.
3. `renderSkins()`: mục bị khóa có lớp `is-locked`, hiện biểu tượng khóa (ký tự "🔒" trong một `span` có `aria-hidden`) và dòng giá (`Intl.NumberFormat('vi-VN')` + ` đ`); `aria-label` của nút: "<tên>, đang khóa, cúng dường <giá> để mở".
4. Bấm mục bị khóa: **không** đổi lựa chọn, mở khung xác nhận ngay trong bộ chọn: tên skin, ảnh, câu "Cúng dường <giá> để mở skin này. Mở rồi dùng mãi.", nút "Cúng dường để mở" và "Thôi".
5. Bấm "Cúng dường để mở": `send('kd:shop:buy', { kind, id }, ack)`. `ack.ok` → hiện khung QR trong bộ chọn: ảnh QR (`img.src = ack.qr`, chỉ nhận URL bắt đầu bằng `https://img.vietqr.io/` hoặc đường dẫn cùng gốc bắt đầu bằng `/`; khác thì không gán), số tiền, nội dung chuyển khoản (`ack.code`), tên ngân hàng/tài khoản nếu có, dòng "Đang chờ Ban điều hành xác nhận…" (hoặc "Chế độ thử: tự xác nhận sau ít giây" khi `ack.test`), nút "Đóng". `ack` lỗi → hiện `ack.reason` trong `.kd-msg`.
6. Khi nhận `kd:shop:state` mà `owned` có thêm khóa đang chờ: đóng khung QR, đặt lựa chọn sang skin đó (`pref`), với skin quân/đá thì `sendSkin(false)` ngay; với skin sân thì chỉ chọn sẵn (người chơi tự bấm "Khai mở"); `say('Đã mở <tên>. Xin tùy hỷ công đức.')`.
7. `sendSkin`: ack có `code:'locked'` → hiện lý do và mở khung xác nhận mua cho đúng skin đó.
8. Lựa chọn ưa thích trong `localStorage` trỏ tới skin đang khóa: lúc vào ván không tự gửi skin đó (tránh bị từ chối liên tục).
9. Cửa hàng tắt (`on:false`): giao diện y như hiện tại, không có khóa, không có giá.
10. Nút ≥ 44 px; không `innerHTML`; khung QR có `role="dialog"` và nhãn; bàn phím: Esc đóng khung.
11. Test: `skinLocked`/`skinPrice`; ván cờ vua với `shop.on` và skin chưa mở → bấm mục không gửi `kd:skin`, gửi `kd:shop:buy` sau khi xác nhận; nhận `kd:shop:state` có `owned` → gửi `kd:skin`; URL QR lạ không được gán.

### T-174 · Tài liệu người chơi, harness, e2e hai trình duyệt

`README.md` (mục Lãnh địa: thêm đoạn "Mở khóa skin" và biến môi trường liên quan nếu có), `public/data/so-tay.vi.json` (mục Bàn cờ: 3–4 câu cho người chơi), `tools/ui-harness/kydao/index.html` (nút giả lập `kd:shop:state` bật khóa và `owned`), `tools/ui-harness/kydao/ui-check.js` (kiểm tra `khoa-skin`: mục khóa có giá; bấm mở khung; sau khi `owned` thì hết khóa), `tools/ui-harness/kydao/e2e-real.js` (bước mới: admin bật cửa hàng qua API với `ADMIN_KEY` thử, A mua một skin ở chế độ thử, chờ tự xác nhận, A dùng được, B bị khóa).

## 3. Tóm tắt luồng cúng dường hiện có (khảo sát 14/11)

- Socket `donate`: `server.js` ≈ dòng 1121–1139; giới hạn 10.000đ → 100 triệu; rate limit 8 giây; `addDonation` ≈ 393–403 (`code`, `status:'pending'`, `mode`, ở thử có `confirmAt`); **flush trước khi trả QR** ≈ 1135; `donationAck` ≈ 404–409 trả `{ qr, code, amount, fund, test, confirmAt, bank, account, accountName, auto }`.
- `confirmDonation(d, info)` ≈ 644–674: đổi uid khách đã liên kết sang tài khoản bằng `accountOf`, ghi trạng thái, cộng hào quang + công đức, phát `donation`, gửi `donation:ok` cho đúng chủ; `speedup` gọi thêm `martial.onDonationConfirmed`. Ba nơi gọi: admin ≈ 536–545, webhook SePay ≈ 462–494, hẹn giờ thử ≈ 424. **Hàm không tự chặn gọi hai lần**; idempotent nằm ở phía gọi và ở cờ `d.outcome` (speedup).
- Webhook: tìm mã `CD[A-Z0-9]{6}`; chỉ nhận bản `pending`; nhánh `speedup` ≈ 485–489 chỉ ghi `d.bank`.
- `DONATION_MODE` ≈ dòng 62 (`test` mặc định; `live` mới nhận tiền thật); `DONATION_ENABLED` cần `BANK_ID` + `BANK_ACCOUNT`.
- `linkGuest` ≈ 231–277 (gộp merit, auras, martial, Elo; có hoàn tác); `accountOf` ≈ 278.
- Admin: middleware ≈ 502–509 (`x-admin-key`, khóa 10 phút sau 10 lần sai); `audit()` ≈ 511–516; **chưa có cấu hình nào đổi được lúc chạy**.
- `clientConfig()` ≈ 374–390.
- `lib/store-sections.js`: `fresh()` ≈ 15–34, `kydaoFresh` ≈ 10, `NESTED` ≈ 13, `SECTIONS` ≈ 39–59, `adopt()` ≈ 180–198; test: `test/store-json.test.js` ≈ 78, 337–369; `test/store-pg.test.js` ≈ 54–67, 272, 319.

(Số dòng là gần đúng tại thời điểm khảo sát: luôn Grep lại theo tên hàm.)

## 4. Bẫy

1. Không `await store.flush()` trước khi trả QR.
2. Lấy số tiền từ client.
3. Mở khóa không idempotent (admin xác nhận lại, webhook gọi lại, khởi động lại giữa chừng).
4. Ghi quyền theo uid thô thay vì `accountOf(uid)`; quên gộp khi khách đăng nhập.
5. Thêm khóa lưu bền mà thiếu `fresh`/`SECTIONS`/`adopt`: PostgreSQL âm thầm bỏ mất.
6. Làm đổi hành vi `speedup` hoặc khoản cúng dường thường.
7. Lộ uid hoặc danh sách sở hữu của người khác.
8. Tin `owned` do client gửi: máy chủ luôn tự tra.
