# Võ học · Giao thức và giao diện module

Tài liệu kỹ thuật cho phần tu luyện, học chiêu và luận võ. Đây là hợp đồng giữa máy chủ và giao diện: sửa ở đâu thì sửa cả hai phía.

## 1. Các "nơi" tách biệt

| Nơi | Là gì | Ai ở đó |
|---|---|---|
| `hall` Chánh điện | Nơi cúng và tương tác chính. **Không có đánh nhau.** | Mọi người |
| `dojo` Võ Học Các | Tu luyện nội công, học chiêu, chọn bộ 4 chiêu | Người tự đến |
| `arena` Sân đấu | Danh sách người đang ở sân, mời và đấu | Người tự ra sân |

Quy tắc cứng:

- Chỉ người đang ở `arena` mới thấy và mời được nhau. Người ở chánh điện không bao giờ bị mời, không thấy lời mời.
- Mọi sự kiện `pk:*` chỉ nhận khi người chơi đang ở `arena` (hoặc đang có trận dở, xem `pk:resume`).
- Người đi sang nơi khác thì nhân vật không hiện trong chánh điện (`pplace`).
- Nơi mới (ví dụ coi bói tử vi, tarot) thêm bằng cách đăng ký một nơi mới với `Places`, không đụng chánh điện.

`place:set {place}` → ack `{ ok, place, arena? }`. Máy chủ phát `pplace {id, place}` cho mọi người (`place` là `hall` | `dojo` | `arena`).
`publicPlayer` có thêm trường `at` (chỉ có khi khác `hall`).

## 2. Dữ liệu dùng chung

`public/js/martial.js` (biến toàn cục `MARTIAL`, `require` được trên máy chủ) là nguồn duy nhất cho: 3 nhánh, 15 chiêu, 6 công pháp, cấp nội công, điều kiện học (`canLearn`, `canCultivate`), `statsLine(skill)`, `loadoutWarnings`, `validateLoadout`.
Id chiêu dạng `trong-quyen`; hành động đặc biệt `dieu-tuc` (Điều tức, chọn được), `dung-yen` (tự chọn khi hết giờ). Id công pháp dạng `tinh-tam-quyet`. Id nhánh: `cuong` `toc` `nhu`.

## 3. Tu luyện và học chiêu (Võ Học Các)

Tu luyện chạy **offline**: bắt đầu, đóng web, hết giờ máy chủ nhận kết quả. Giờ do máy chủ quyết định.

Mọi sự kiện có ack. Lỗi nghiệp vụ trả `{ ok:false, reason:'…tiếng Việt…', code? }`, không ném lỗi.
Khi bật đăng nhập Google mà người chơi chưa đăng nhập: mọi sự kiện đổi dữ liệu trả `{ ok:false, code:'login', reason:'Cần đăng nhập Google…' }`, riêng `martial:state` vẫn trả được (để hiện lời mời đăng nhập).

### `martial:state` (không tham số) → ack
```
{ ok:true, enabled, serverTime,
  login:{ required, signedIn },
  profile:{ congLuc, level, levelFrom, levelTo, pct, manaMax, tam:{cuong,toc,nhu},
            learned:[id], loadout:[id], wins, losses, draws, vouchers:[{id, value, createdAt}] },
  session: null | { id, methodId, durationKey, startedAt, endsAt, price, status:'active',
                    speedup: null | { code, amount, status:'pending', bankReported:boolean, createdAt } },
  recent:[ { id, methodId, durationKey, status:'completed'|'cancelled', via:'time'|'speedup'|'voucher'|null,
             completedAt, reward:{congLuc,tam:{cuong,toc,nhu}}, seen:boolean } ],   // tối đa 8, mới nhất trước
  speedup:{ enabled, perDay, usedToday }
}
```
`levelTo` là `null` ở cấp tối đa. Giao diện hiển thị đếm ngược theo `endsAt` và `serverTime` (lệch giờ đã có `Hall.setOffset`/`serverNow()`).

### Sự kiện từ trình duyệt
| Sự kiện | Tham số | Ack thành công |
|---|---|---|
| `tu:start` | `{methodId, duration}` (duration là `key` như `4h`) | `{ok:true, session}` |
| `tu:cancel` | `{sessionId}` | `{ok:true}` (mất hết tiến độ phiên đó) |
| `tu:speedup` | `{sessionId, anon?:boolean}` | `{ok:true, existing:boolean, code, amount, fund, qr, bank, account, accountName, auto, methodName, durationKey, endsAt}` |
| `tu:speedup:cancel` | `{code}` | `{ok:true}` |
| `tu:voucher` | `{voucherId, sessionId}` | `{ok:true}` |
| `martial:seen` | `{ids:[sessionId]}` | `{ok:true}` |
| `vo:learn` | `{skillId}` | `{ok:true, profile}` |
| `vo:loadout` | `{skills:[4 id]}` | `{ok:true, loadout, warnings:[{code,text}]}` |

`tu:speedup` gọi lại khi đã có yêu cầu đang chờ thì trả lại đúng yêu cầu đó (`existing:true`), không tạo mã mới.
Hoàn thành ngay **chỉ** xảy ra khi Ban điều hành bấm Xác nhận; ngân hàng báo (SePay) chỉ đánh dấu `bankReported`.

### Sự kiện đẩy từ máy chủ: `tu:update`
```
{ kind:'completed'|'cancelled'|'speedup-late'|'speedup-rejected',
  sessionId, methodId, durationKey,
  via?:'time'|'speedup'|'voucher',
  reward?:{congLuc, tam:{cuong,toc,nhu}}, levelUp?:boolean, level?:number,
  voucher?:{id, value}, text:'câu thông báo tiếng Việt sẵn dùng' }
```
Gửi cho mọi tab của người chơi (kể cả khi đang ở chánh điện). Giao diện nên hiện `text` bằng toast rồi gọi lại `martial:state` nếu đang mở Võ Học Các.

## 4. Sân đấu và luận võ

### Danh sách người ở sân
`place:set {place:'arena'}` ack: `{ ok, place, arena:{ players:[Row], dnd:boolean, hasMatch:boolean, enabled:boolean } }`.
`Row = { pid, name, look, lv, wins, losses, st }` với `st` là `free` | `busy` (đang đấu) | `dnd` (không nhận lời mời).
Phát cho những ai đang ở sân: `arena:add Row` · `arena:del {pid}` · `arena:upd {pid, …trường đổi}`.
`arena:dnd {on}` → ack `{ok}`. `arena:blocks` → ack `{ok, list:[{uid,name}]}`; `pk:block {pid}` → ack; `pk:unblock {uid}` → ack.

### Mời và nhận lời
| Sự kiện | Tham số | Ack |
|---|---|---|
| `pk:invite` | `{toPid, mode:'balanced'\|'buff'}` | `{ok:true, inviteId, expiresAt}` |
| `pk:invite:cancel` | `{inviteId}` | `{ok:true}` |
| `pk:respond` | `{inviteId, accept:boolean}` | `{ok:true}` |

Máy chủ → người được mời: `pk:invited {inviteId, mode, expiresAt, from:{pid,name,look,lv,wins,losses}, buffs:null|{you:Buff,op:Buff}}`
(`buffs` chỉ có ở `mode:'buff'`, là bản xem trước; bản chụp thật lấy lúc nhận lời).
Cho cả hai khi lời mời đóng: `pk:invite:closed {inviteId, reason:'declined'|'expired'|'cancelled'|'busy'|'accepted'|'left'}`.
Hạn lời mời 20 giây. Mỗi người một lời mời đang chờ gửi đi, tối đa 3 lời mời đang chờ nhận. Bị từ chối thì 5 phút mới mời lại được cùng một người.

`Buff = { Lc, Lq, Ld, offExt, defP, dodgeB, labels:[string] }` (số thập phân: `0.03` = 3%; `dodgeB` là điểm % cộng xác suất né).

### Một trận
1. **Sảnh chọn bộ chiêu** (30 giây): `pk:lobby`
```
{ matchId, mode, deadlineAt, loadoutMs,
  you:{ pid,name,look,level,hpMax,manaMax, learned:[id], loadout:[id], warnings:[{code,text}] },
  op:{ pid,name,look,level,hpMax,manaMax },
  buffs: null | { you:Buff, op:Buff } }
```
Người chơi gửi `pk:loadout {matchId, skills:[4 id]}` → ack `{ok, locked:true, warnings}`. Đối thủ khóa xong thì nhận `pk:lobby:status {matchId, opLocked:true}`.
Hết giờ mà chưa khóa thì dùng bộ đã lưu trong hồ sơ (`profile.loadout`); chưa có bộ nào thì máy chủ ghép 4 chiêu đã học theo thứ tự nhập môn.
Khi cả hai đã khóa (hoặc hết giờ) bộ chiêu của **hai bên được công bố** và lượt 1 bắt đầu.

2. **Mỗi lượt**: `pk:turn`
```
{ matchId, turn, deadlineAt, forced:null|id, legal:[id],
  state:{ you:F, op:F },
  loadouts?:{ you:[id], op:[id] } }          // chỉ có ở lượt 1 và khi vào lại
F = { level, hp, hpMax, mana, manaMax, rage, charging:null|id, kc, exposed:0|1, offExt, defP, dodgeB }
```
`legal` là các chiêu bạn chọn được lượt này (đủ nội lực) cộng `dieu-tuc`. Đang tụ lực thì `forced` là chiêu phải tung và `legal` chỉ còn chiêu đó.
Chọn kín: `pk:pick {matchId, turn, skillId}` → ack `{ok:true, locked:true}`. Đã khóa thì không đổi được.
Khi đối thủ khóa: `pk:locked {matchId, turn}` (không kèm chiêu, không gợi ý gián tiếp).

3. **Lật chiêu**: khi cả hai khóa (hoặc hết 20 giây) máy chủ giải lượt một lần rồi gửi `pk:reveal`
```
{ matchId, turn, nextAt,                       // nextAt: giờ máy chủ lượt sau bắt đầu (null nếu hết trận)
  picks:{ you:{skill,phase,auto,invalid,mana}, op:{…} },   // phase: 'charge'|'release'|null
  events:[ … ],                                // xem bên dưới, side/atk/def/target đã đổi thành 'you' | 'op'
  state:{ you:F, op:F },
  ended:null | { result:'win'|'lose'|'draw', reason } }
```
Sau `REVEAL_MS` (4 giây) máy chủ gửi `pk:turn` của lượt kế tiếp. Trong 4 giây đó không nhận `pk:pick`.

`events` theo thứ tự xảy ra (tất cả `side`/`atk`/`def`/`target` là `'you'` hoặc `'op'`):
```
{k:'pick', side, skill, phase, auto, invalid, mana}
{k:'guard', side, red} · {k:'charge', side} · {k:'release', side} · {k:'rest', side} · {k:'idle', side}
{k:'dodge', atk, def, idx, of, p, ok}      thử né nhịp idx/of của atk; p ∈ [0,1] là xác suất cuối cùng
{k:'parry', atk, def, idx, of, p, ok}
{k:'hit', atk, def, idx, of, dmg, red}     nhịp trúng gây dmg; red là phần giảm đã áp
{k:'counter', side, target, dmg}
{k:'exposed', side} · {k:'kc', side} · {k:'rage', side, delta, value}
{k:'sudden', dmg, streak}                  suy kiệt: cả hai cùng mất dmg
{k:'end', result:'you'|'op'|'draw', reason}
```
4. **Kết thúc**: `pk:end {matchId, result:'win'|'lose'|'draw', reason, who?, turns, state:{you,op}, record:{wins,losses,draws}}`
`reason`: `ko` · `double-ko` (cùng về 0, ai còn ít âm hơn thắng) · `turn-limit` · `forfeit` · `idle-forfeit` · `both-away` · `void`. Với `forfeit`/`idle-forfeit`, `who` là `'you'` hoặc `'op'` (bên bỏ cuộc). `both-away` và `void` không tính thắng thua.

### Vào lại / mất kết nối
`pk:resume` (không tham số) → ack `{ ok, snapshot:null|Snapshot, message? }`. `message` dùng khi trận cũ đã bị hủy (máy chủ khởi động lại).
```
Snapshot = { matchId, phase:'lobby'|'choosing'|'reveal', turn, deadlineAt, mode,
             you:{pid,name,look,level,hpMax,manaMax,loadout}, op:{…}, buffs, state:{you,op},
             loadouts:{you,op}|null, legal, forced, myPick:null|id, opLocked:boolean, lastReveal:null|Reveal }
```
`pk:forfeit {matchId}` → ack `{ok}` (thua ngay).

Quá giờ chọn 20 giây: tự "Đứng yên". 3 lượt quá giờ liên tiếp: xử thua (`idle-forfeit`). Cả hai vắng quá 60 giây: hủy trận (`both-away`).
Máy chủ khởi động lại giữa trận: trận bị hủy, không ai bị tính thua.

## 5. Dữ liệu lưu bền (`db.martial`)
```
profiles[uid] = { uid, congLuc, tam:{cuong,toc,nhu}, learned:[id], loadout:[id], activeSession:id|null, activeMatch:id|null,
                  vouchers:[{id,value,code,createdAt,usedAt?,usedFor?}], wins, losses, draws, dnd, blocked:[{uid,name}], createdAt }
sessions[id]  = { id, uid, methodId, durationKey, startedAt, endsAt, price, status:'active'|'completed'|'cancelled',
                  via, completedAt, reward, seen, speedupCode }
ledger[key]   = { uid, at, congLuc, tam }          // key = 'session:<id>' — mỗi phiên chỉ được cộng một lần
matches[]     = { id, at, mode, seed, a:{uid,name}, b:{uid,name}, loadouts, buffs, result, reason, turns, log }
audit[]       = { id, at, actor, action, target, detail }
```
Cúng dường hoàn thành ngay dùng chung `db.donations` với `purpose:'speedup'`, `sessionId`, `methodId`, `durationKey`, `price`, `outcome` (`applied` | `late` | `rejected`), `bank:{at,amount,ref}` khi SePay báo.

## 6. Giao diện module phía trình duyệt

Mỗi nơi là một module đăng ký với `Places` (`public/js/places.js`). Khung (`<main class="place" id="place-dojo" hidden>`) do `index.html` cung cấp rỗng; module tự dựng nội dung.
```
Dojo.init(host)  / Arena.init(host)         host = {
    socket,                      // Socket.IO của trang
    toast(text), serverNow(),    // giờ máy chủ (ms)
    goto(place),                 // 'hall' | 'dojo' | 'arena'
    cfg(),                       // cấu hình từ máy chủ (cfg.martial = {enabled, pk, speedup, loginRequired})
    auth(),                      // {enabled, signedIn}
    login(),                     // mở đăng nhập Google
    me(),                        // {pid, name, look}
    meritTotal(),                // tổng công đức hiện tại
    vnd(n)                       // định dạng tiền
}
Dojo.mount(el) / Arena.mount(el)    dựng giao diện vào phần tử (gọi một lần)
Dojo.show(info) / Dojo.hide()        vào / rời nơi này (làm mới dữ liệu, dừng đồng hồ khi ẩn)
Arena.show(info) / Arena.hide()      info là ack của `place:set` (với sân đấu có `info.arena.players`)
```
`Places.go(name)` gửi `place:set`, rồi gọi `show(info)` của nơi đó. Khi mất mạng rồi nối lại, trang gọi lại `place:set` và `show(info)` cho nơi đang ở, nên `Arena.show` luôn phải tự gọi `pk:resume` để vào lại trận đang dở.
Trong lúc có trận, nút "Về chánh điện" của sân đấu hỏi xác nhận ("Rời trận nghĩa là bỏ cuộc"), đồng ý thì gửi `pk:forfeit` rồi mới `goto('hall')`.
Sân đấu cung cấp thêm `Arena.inMatch()` (có trận đang diễn ra hay không).
Module tự đăng ký `socket.on(...)` của mình trong `init`. Chữ trong giao diện: tiếng Việt, ngắn gọn, đúng phong cách các màn hình hiện có. Mọi chữ do người dùng hoặc máy chủ gửi phải gán bằng `textContent`, không `innerHTML`.
