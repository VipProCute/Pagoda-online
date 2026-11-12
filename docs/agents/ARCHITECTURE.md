# Bản đồ kiến trúc cho agent

> Tài liệu tra cứu, không phải để đọc hết mỗi lần. Agent chỉ đọc mục được gói ngữ cảnh chỉ tới. Vị trí ghi bằng **tên symbol** (dùng Grep để tìm), không ghi số dòng vì số dòng thay đổi liên tục.
> Cập nhật lần cuối: 2026-11-10, theo `main` @ `2740393`.

## 1. Sơ đồ tổng thể

```
Trình duyệt (public/, JS thuần)                    Máy chủ (một tiến trình Node)
──────────────────────────────                    ─────────────────────────────────────────────
index.html ─ nạp script theo thứ tự cố định         server.js  Express + Socket.IO, luật chơi, timer
  app.js  (điều khiển chính, nạp CUỐI)  ◄─ socket ─►   ├─ lib/auth.js        Google OIDC, phiên cookie
  places.js (hall | dojo | arena)                      ├─ lib/account.js     gộp dữ liệu khách → tài khoản
  hall.js (Canvas 2D: chánh điện, sân chùa,            ├─ lib/records.js     tính người giữ 14 danh hiệu, điểm mùa (thuần)
                                                       ├─ lib/moderation.js  lọc chat/tên, trừ công đức
           Tàng Kinh Các, sân đấu, nhân vật)           ├─ lib/announce.js    câu thông báo + gọi TTS VieNeu
  dojo.js (Võ Học Các) · arena.js (Sân đấu)            ├─ lib/fortune-queue.js  hàng đợi xin xăm
  audio.js · voice.js (WebRTC) · celebrate.js          ├─ lib/sweeper.js     sự kiện Tảo Địa Tăng
  library.js · meditate.js · fortune.js · tarot.js · lunar.js     ├─ lib/martial/service.js  tu luyện, học chiêu (thuần)
  tuvi.js (an sao Tử Vi, UMD, cần lunar.js; T-054)     │   (kiểm: test/tuvi.test.js · tools/tuvi-crosscheck/ đối chiếu iztro)
  ┌ dùng chung với máy chủ (UMD) ┐                     ├─ lib/pk/engine.js   Duel: giải lượt (thuần)
  │ martial · aura · merit · lunar  │ ◄── require ──── ├─ lib/pk/manager.js  sân đấu, mời, sảnh, lượt, vào lại
  └───────────────────────────────┘                    ├─ lib/pk/buffs.js · rules.js · rng.js
admin.html (trang quản trị, script nội tuyến)          └─ lib/store.js ─┬─ file JSON (data/db.json)
                                                                        └─ lib/store-pg.js (PostgreSQL/Neon)
                                                                            lib/store-sections.js (hình dạng dữ liệu)

Kỳ Đạo (năm môn cờ ở Sân chùa; hợp đồng: docs/KY-DAO-GIAO-THUC.md; mã do thẻ T-021 → T-035 thêm dần)
  public/js/kydao/*.js (UMD luật: chess, xiangqi[+jieqi], go, gomoku) ◄── require ── lib/kydao/registry.js · elo.js · manager.js
  public/js/kydao-ui.js · kydao-draw.js (bảng bàn cờ) ◄─ socket kd:* ─► server.js (kydaoOnly) ── db.kydao (ratings, games, active, pairs)
  hall.js: YARD_TABLES (4 bàn đá) ◄── đồng bộ ──► server.js: YARD_TABLES
```

## 2. server.js theo khối (đọc từ trên xuống)

| Khối | Tìm bằng | Nội dung |
|---|---|---|
| Nạp module | đầu file | nạp `public/js/aura.js`, `merit.js`, `martial.js`; `TRACKS` từ `public/audio/chants/manifest.json`, `BOOKS` từ `public/kinh/index.json` |
| Cấu hình env | `process.env` | mọi biến ở README "Cấu hình"; cờ tính năng bật khi `!== '0'` |
| Hằng số thế giới | `PLACES`, `SCENES`, `LIB_SEATS`, `MILESTONES`, `ITEMS`, `KINDS` | nơi, cảnh, bồ đoàn, mốc công đức, lễ vật |
| Kỳ Đạo | `KYDAO_*`, `YARD_TABLES`, `kd*` (hàm hỗ trợ), `kydaoOnly`, `kydaoDropUser` | cấu hình, 4 bàn đá, cầu nối `lib/kydao/manager.js` ↔ socket (gửi theo `pid`, phòng `yard`/`hall`/`kd:<bàn>`), lưu `db.kydao`, handler `kd:*` |
| Tiện ích | `vnDay` (UTC+7), `safeEqual`, `makeCode` (`CD` + 6 ký tự) | |
| Công đức | `addMeritUid`, `penalize`, `linkGuest`, `accountOf` | cộng/trừ, mốc, gộp khách vào tài khoản (có hàm hoàn tác khi flush lỗi) |
| HTTP | `app.get` / `app.post` | `/healthz`, `/api/config`, `/api/announce/:id`, `/api/webhooks/sepay`, `/api/admin/*` (header `x-admin-key`), `/api/auth/*` (trong `lib/auth.js`) |
| Cúng dường | `addDonation`, `donationAck`, `confirmDonation`, `syncDonations` | VietQR, chế độ test tự xác nhận sau 10 giây, nhận khoản từ PG khi deploy chồng |
| Quản trị | `audit(`, khóa sau 10 lần sai / 10 phút / IP | dùng chung cho HTTP và socket |
| Socket | `io.on('connection'` | toàn bộ handler (mục 4) |
| Vòng lặp | `startLoops` | 50 ms di chuyển; 100 ms vị trí; 1 s công đức/mốc/thống kê/sweeper; 5 s bảng công đức; 60 s dọn dẹp; vòng quét võ học riêng |
| Tắt máy | `SIGTERM` | flush store (tối đa 8 s). Render chạy `node server.js` trực tiếp vì `npm start` nuốt tín hiệu |
| Khởi động | `main()` | `store.init` → tạo martial service + arena manager + kydao manager → listen |

Lưu ý: `players` và `io` khai báo sau các hàm dùng chúng; đừng gọi các hàm đó ở thời điểm nạp module.

## 3. Dữ liệu (`db = store.get()`)

- Một object duy nhất trong RAM, không bao giờ thay đối tượng (`adopt` đổ dữ liệu vào chính object đó). Sửa `db` rồi gọi `store.save()` (ghi trễ: JSON 4 s, PG `PG_FLUSH_MS` 10 s). Việc liên quan tiền/đăng nhập thì `await store.flush()` trước khi ack.
- Hình dạng ở `fresh()` trong `lib/store-sections.js`:
  - meta: `version`, `day`, `today`, `total`, `seq`
  - `merit{uid→{name,total,today,day}}`, `linkedGuests{guest→uid}`, `authSessions{sha256(token)→{uid,until}}`
  - mảng: `prayers[]`, `chat[]`, `incense[]`, `donations[]` (khóa theo `code`)
  - `auras{}`
  - `martial{ profiles{}, sessions{}, ledger{}, matches[], audit[] }` (chi tiết: `docs/VO-HOC-GIAO-THUC.md` §5)
- PostgreSQL: bảng `docs(section, k, v jsonb)`; ghi theo chênh lệch với bản bóng (`shadow`) trong một transaction; khi nạp thì `seq += 100000` để hai bản Render chạy chồng không cấp trùng id.
- Không có hệ thống migration: `VERSION` + chữa dữ liệu cũ lúc nạp (`adopt`, `norm`, `repairSeq`). Công cụ: `node --env-file=.env tools/db-migrate.js import|verify|export|stats`.
- Trạng thái **mất khi khởi động lại** (chỉ trong RAM): vi phạm chat gần đây, trận PK đang đấu (vào lại nhận `RESTART_MSG` của `lib/pk/manager.js`), lời mời spar, cache clip TTS, hàng đợi xin xăm.

## 4. Sự kiện Socket.IO

Ack chuẩn: `{ ok:true, … }` hoặc `{ ok:false, reason, code? }`. Sự kiện "không tham số" vẫn nên gửi `{}` kèm callback.

**Trình duyệt → máy chủ**

| Nhóm | Sự kiện |
|---|---|
| Lõi | `time`, `join`, `scene`, `profile`, `move`, `place:set`, `account:summary` |
| Tàng Kinh Các, xin xăm, tarot | `sit`, `stand`, `reading`, `fortune:join`, `fortune:leave`, `tarot:draw` (rút 5 lá theo hạt giống trong ngày, `lib/tarot-draw.js`) |
| Chat, kiểm duyệt | `chat`, `report`, `mod:hide`, `mod:mute`, `mod:voice` |
| Lễ Phật | `emote`, `mo`, `bell`, `incense`, `offer`, `rejoice`, `chant:start`, `chant:stop`, `donate` |
| Giọng nói | `voice:join`, `voice:mic`, `voice:leave`, `voice:signal` |
| Võ học (bọc `martialOnly`) | `martial:state`, `sweeper:claim`, `tu:start`, `tu:cancel`, `tu:speedup`, `tu:speedup:cancel`, `tu:voucher`, `martial:seen`, `vo:learn`, `vo:loadout` |
| Spar | `spar:invite`, `spar:respond` |
| Sân đấu (bọc `inArena`) | `arena:dnd`, `arena:blocks`, `pk:block`, `pk:unblock`, `pk:invite`, `pk:invite:cancel`, `pk:respond`, `pk:loadout`, `pk:pick`, `pk:forfeit`, `pk:resume` |
| Kỳ Đạo (bọc `kydaoOnly`) | `kd:tables`, `kd:sit`, `kd:setup`, `kd:ready`, `kd:stand`, `kd:invite`, `kd:invite:cancel`, `kd:respond`, `kd:move`, `kd:draw`, `kd:resign`, `kd:mark`, `kd:agree`, `kd:resume-play`, `kd:watch`, `kd:unwatch`, `kd:resume` |

**Máy chủ → trình duyệt**

| Nhóm | Sự kiện |
|---|---|
| Người chơi | `pj`, `pl`, `p` (lô vị trí, volatile, ×1000), `pu`, `pscene`, `psit`, `prd`, `pv`, `pplace`, `pm` |
| Công đức | `merit`, `milestone`, `penalty`, `penalty:me`, `stats`, `board`, `ticker`, `notice` |
| Nội dung | `chat`, `chat:hide`, `prayer`, `prayer:n`, `prayer:hide`, `incense`, `offer`, `emote`, `bell`, `chant` |
| Cúng dường | `donation`, `donation:ok`, `aura`, `aura:me`, `announce` |
| Giọng nói | `voice:signal`, `voice:kicked` |
| Xin xăm, NPC | `fortune:queue`, `fortune:result`, `sweeper:appear` |
| Võ học | `tu:update`, `martial:inheritance` |
| Spar | `spar:invited`, `spar:accepted`, `spar:declined`, `spar:ready` |
| Sân đấu | `arena:add`, `arena:del`, `arena:upd`, `pk:invited`, `pk:invite:closed`, `pk:lobby`, `pk:lobby:status`, `pk:turn`, `pk:locked`, `pk:reveal`, `pk:end` |
| Kỳ Đạo | `kd:table`, `kd:invited`, `kd:invite:closed`, `kd:start`, `kd:moved`, `kd:offer`, `kd:marks`, `kd:end` |

Hợp đồng chi tiết của võ học và PK (payload, thứ tự gói tin): **`docs/VO-HOC-GIAO-THUC.md`**. Của Kỳ Đạo: **`docs/KY-DAO-GIAO-THUC.md`**. Đổi giao thức thì sửa tài liệu đó cùng PR.

## 5. Phía trình duyệt

- **Thứ tự nạp** (`public/index.html`, cuối `<body>`): `socket.io` → `lunar` → `audio` → `aura` → `merit` → `celebrate` → `hall` → `fortune` → `voice` → `library` → `martial` → `places` → `meditate` → `dojo` → `arena` → `guide` → `app.js`. Mỗi file có `?v=…` để phá cache.
- **Biến toàn cục**: `Lunar`, `SFX`, `AURA`, `MERIT`, `MARTIAL`, `Celebrate`, `Hall`, `Fortune`, `Voice`, `Library`, `Places`, `Meditate`, `Dojo`, `Arena`. `app.js` không xuất gì, là nơi nối mọi thứ (một `socket` toàn cục).
- **Sổ tay** (nút "?" ở thanh trên): `public/js/guide.js` (global `Guide`, nạp trước `app.js`) dựng hộp `#dlg-guide` từ `public/data/so-tay.vi.json`. Số liệu viết bằng chỗ giữ chỗ `{EARN.x}`, `{PK.x}`, `{MARTIAL.x}`… lấy từ `MERIT`/`MARTIAL`/`AURA`/`/api/config`; mục/đoạn có `needs`/`needsNot` ẩn theo tính năng. Tính năng chưa có phía trình duyệt (`titles`, `bangvang`, `tuvi5`, `tarot5`…) mặc định tắt, thẻ làm ra nó gọi `Guide.setFeature('tên', true)`. Test: `test/guide.test.js`.
- **Nơi (place)** = màn hình riêng: `Places.register(name, { el, mod })`, `mod` có `init(host)`, `mount(el)`, `show(info)`, `hide()`. `Places.go()` gửi `place:set`, chỉ chuyển màn khi ack `ok`. Đăng ký ở `app.js` qua object `martialHost`.
- **Cảnh (scene)** = cùng một canvas `#hall`: `hall`, `yard`, `library` (và `arena` qua `Hall.attach(canvas)`). Luồng: `goScene` → `socket.emit('scene')` → `applyScene` → `Hall.setScene`.
- **Vẽ**: `hall.js` `frame()` chọn hàm vẽ theo cảnh (`drawBg`, `drawYard`, `drawLibrary`, `drawArenaYard`), toạ độ sàn 0..1, sprite `.webp` là tùy chọn (thiếu thì vẽ bằng mã). `arena.js` có sân khấu canvas riêng (`paintLoop`); `dojo.js` dựng DOM bằng `h()`.
- **localStorage** (luôn bọc try/catch, tiền tố `ta-`): `ta-uid`, `ta-look`, `ta-name`, `ta-muted`, `ta-rj`, `ta-voice-vol`, `ta-admin`, `ta-fx`, `ta-scare`, `ta-dojo-tab`, `ta-lib-prefs`, `ta-lib-progress`. Trang admin giữ `ta-admin-key` trong sessionStorage.
- Test của file chỉ chạy trên trình duyệt chạy trong `node:vm` với canvas/DOM giả (`test/hall-npcs.test.js`, `audio-recovery.test.js`, `voice-client.test.js`): đổi tên API của `Hall` hay nhãn `' · NPC'` sẽ làm hỏng các test này.

## 6. Điểm phải đồng bộ bằng tay

Test `test/sync-constants.test.js` (T-005) tự kiểm: bồ đoàn, hằng số PK (`rules.js` ↔ `MARTIAL.PK` ↔ đầu `arena.js`), danh sách nơi, `MapBar.MAPS` ↔ `SCENES`/`PLACES`. Thêm điểm đồng bộ mới thì thêm ca vào test đó (helper đọc mã nguồn nằm sẵn trong file; khi nhiều file cần dùng thì chuyển sang `test/helpers/source.js`).

| Giá trị | Nơi 1 | Nơi 2 (và 3) |
|---|---|---|
| Bồ đoàn | `LIB_SEATS` trong `server.js` | `LIB_SEATS` trong `public/js/hall.js` |
| Danh sách nơi | `PLACES` trong `server.js` | vòng lặp gọi `Places.register(name, …)` trong `public/js/app.js` (danh sách `[['dojo', …], ['arena', …]]`; `hall` là mặc định) |
| Cảnh | `SCENES` trong `server.js` | hàm vẽ cảnh trong `hall.js`, `goScene` trong `app.js` |
| Thanh đổi map | `MapBar.MAPS` trong `public/js/mapbar.js` (nơi duy nhất khai báo map; app.js chỉ gọi `MapBar.configure({ go })` một lần rồi `MapBar.mount(el)`) | mỗi map `kind:'scene'` phải có trong `SCENES` (đúng thứ tự), mỗi map `kind:'place'` phải có trong `PLACES` (`server.js`); map mới thêm cả hàm vẽ ở `hall.js` |
| Hằng số PK | `lib/pk/rules.js` (`RAGE_MAX`, `EXPOSED_PCT`, `KC_BONUS`, `KC_TURNS`…) | `MARTIAL.PK` trong `public/js/martial.js`; `RAGE_MAX`, `EXPOSED_PCT`, `KC_PCT`, `KC_TURNS` đầu `public/js/arena.js` (ở đây ghi phần trăm nguyên: `KC_PCT = 25` ↔ `KC_BONUS: 0.25`) |
| Bậc quỷ ↔ PK | `public/js/merit.js` | `lib/pk/buffs.js` |
| Bảng điểm công đức | `MERITS.EARN` trong `merit.js` | README "Công đức", bảng luật trong giao diện |
| Độ dài URL meme | `MAX_URL` (300) trong `server.js` | `safeUrl` trong `public/js/celebrate.js` |
| Ảnh hào quang | `public/js/celebrate.js` | `public/css/celebrate.css` |
| Giao thức võ học | `server.js`, `lib/pk/manager.js`, `dojo.js`, `arena.js` | `docs/VO-HOC-GIAO-THUC.md`; giả lập `tools/ui-harness/dojo/sim.js` |
| Bàn đá Sân chùa (Kỳ Đạo, sẽ có từ T-031) | `YARD_TABLES` trong `server.js` | `YARD_TABLES` trong `public/js/hall.js` (toạ độ bàn/ghế, id 1–4; xem `docs/KY-DAO-GIAO-THUC.md` §4); mở rộng `test/sync-constants.test.js` |
| Giao thức Kỳ Đạo | `server.js`, `lib/kydao/manager.js`, `public/js/kydao-ui.js`, module luật `public/js/kydao/*` | `docs/KY-DAO-GIAO-THUC.md`; hằng số nhịp/Elo/regex nước đi ở `lib/kydao/registry.js`, `elo.js` |
| Fixture sân đấu | `lib/pk/*`, `martial.js` | chạy lại `node tools/ui-harness/arena/gen-fixtures.js` |
| Cache trình duyệt | file trong `public/js`, `public/css` | `?v=` trong `public/index.html` |
| Khóa dữ liệu cấp cao | `db.*` mới | `fresh()` + `SECTIONS` + `adopt()` trong `lib/store-sections.js` |

## 7. Triển khai và vận hành

- Render Free: ngủ sau 15 phút; ổ đĩa tạm (không có `DATABASE_URL` thì mất dữ liệu mỗi lần deploy). Khi deploy, bản cũ và bản mới chạy chồng tới ~60 giây: đó là lý do `seq` được đẩy lên và khoản cúng dường được "nhận" lại từ PG.
- `DONATION_MODE` mặc định `test`: QR VietQR thật nhưng tự ghi nhận sau 10 giây, bản ghi có `mode:'test'`, không tính vào số đã đối soát.
- Healthcheck: `GET /healthz`. Log có tiền tố `[store]`, `[martial]`, `[arena]`; `DATABASE_URL` được che trong log.
