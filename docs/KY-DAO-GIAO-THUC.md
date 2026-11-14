# Kỳ Đạo · Giao thức và giao diện module

Tài liệu kỹ thuật cho năm môn cờ ngoài Sân chùa (cờ vua, cờ tướng, cờ tướng úp, cờ vây, caro). Đây là hợp đồng giữa máy chủ, module luật và bảng bàn cờ: sửa ở đâu thì sửa cả ba nơi và sửa tài liệu này trong cùng PR.

Nguồn thiết kế: `docs/KE-HOACH-DOT-2026-11.md` §5 (KH) và các quyết định D1, D6–D9, D16. Chỗ KH chưa rõ được chốt ở thẻ T-020 và ghi **(chốt ở T-020)**. Thẻ làm sau (T-021 → T-035) phải theo tài liệu này; thấy lệch thì báo Điều phối, không tự đổi.

## 1. Nguyên tắc

- **Máy chủ là trọng tài.** Máy chủ giữ state đầy đủ, đồng hồ, kết quả, Elo. Trình duyệt chỉ hiển thị và gợi ý nước đi; mọi nước đi đều bị máy chủ kiểm lại.
- Ván cờ **không cộng công đức** (D16). Cờ chỉ có Elo và danh hiệu.
- Chỗ chơi: **4 bàn đá ở Sân chùa** (D1) hoặc **bàn trong** (ván mời trực tiếp khi hết bàn, không vẽ trên sân).
- Mọi sự kiện `kd:*` đi qua bộ bọc `kydaoOnly(fn)` trong `server.js`: kiểm `KYDAO_ENABLED`, `bucket('kd', 5, 15)`, `try/catch`, và trả lỗi nghiệp vụ bằng `ack({ ok:false, reason, code? })`, **không ném lỗi**.
- Ack chuẩn `{ ok:true, … }` hoặc `{ ok:false, reason:'…tiếng Việt…', code? }`. Sự kiện không tham số vẫn gửi `{}` kèm callback (máy chủ cũng nhận chỉ callback).
- `code` dùng trong Kỳ Đạo:

| `code` | Khi nào | Giao diện làm gì |
|---|---|---|
| `login` | cần đăng nhập Google (ván xếp hạng, hoặc bật đăng nhập mà chưa đăng nhập) | mời đăng nhập |
| `off` | `KYDAO_ENABLED=0` | báo "Bàn cờ đang nghỉ." |
| `stale` | `ply` không khớp, ván đã đổi, ván không còn | gọi `kd:resume` để đồng bộ lại |
| `rate` | vượt giới hạn tần suất | im lặng thử lại / toast |

- Id: `gameId`, `inviteId` do máy chủ cấp (`newId`, khó đoán). `pid` là id người chơi trong phòng (như `publicPlayer.id`). **Không bao giờ gửi `uid`** cho client nào (AGENTS.md §3.4).
- Dữ liệu vào: chỉ đọc trường riêng của object (`hasOwn`), không tin kiểu; `move` là chuỗi ≤ 8 ký tự khớp regex của môn (mục 3.3); `table` là số nguyên có trong `YARD_TABLES`; `act` thuộc danh sách cho phép.

## 2. Năm môn

Id môn (`game`) và tên hiển thị:

| `game` | Tên | Module luật (UMD) | Bên `a` (đi trước) | Bên `b` |
|---|---|---|---|---|
| `chess` | Cờ vua | `KyChess` · `public/js/kydao/chess.js` | Trắng | Đen |
| `xiangqi` | Cờ tướng | `KyXiangqi` · `public/js/kydao/xiangqi.js` | Đỏ | Đen |
| `jieqi` | Cờ tướng úp | `KyXiangqi` với `create({ variant:'jieqi' })` | Đỏ | Đen |
| `go` | Cờ vây | `KyGo` · `public/js/kydao/go.js` | Đen | Trắng |
| `gomoku` | Caro | `KyGomoku` · `public/js/kydao/gomoku.js` | X | O |

Nhịp (`pace`: `fast` | `normal`), đồng hồ Fischer: `baseMs` + `incMs` cộng sau **mỗi** nước (kể cả nước đầu) **(chốt ở T-020: số mili giây)**. `minPlies` là số nửa nước tối thiểu để ván xếp hạng được tính Elo; `maxPlies` là giới hạn an toàn.

| `game` | `fast` | `normal` | `minPlies` | `maxPlies` |
|---|---|---|---|---|
| `chess` | 300000 + 3000 | 600000 + 5000 | 4 | 300 |
| `xiangqi` | 600000 + 5000 | 900000 + 10000 | 4 | 300 |
| `jieqi` | 600000 + 5000 | 900000 + 10000 | 4 | 300 |
| `go` | 300000 + 5000 | 600000 + 10000 | 20 | 9×9: 200 · 13×13: 400 · 19×19: 800 |
| `gomoku` | 180000 + 3000 | 300000 + 5000 | 10 | 225 (kín bàn) |

- Cờ vây có `size` ∈ `9` | `13` | `19` (mặc định 9). **Chỉ 9×9 được xếp hạng** (D9); 13×13 và 19×19 chỉ giao hữu. Bảng nhịp cờ vây dùng chung cho mọi cỡ **(chốt ở T-020)**. Các môn khác không có `size`.
- `lib/kydao/registry.js` (T-028) là nơi duy nhất liệt kê: `{ id, name, module, sizes?, ratedSizes?, paces, minPlies, maxPlies }`.
- `maxPlies` 400 (vây 13×13) và 800 (vây 19×19), cùng tiền tố `Ú` của ký hiệu cờ tướng úp, là quyết định mới **(chốt ở T-020)**: KH chỉ nêu 200 cho 9×9 và chưa có ký hiệu úp.
- Chạm `maxPlies` (KH §5.5): **mọi môn → hòa** (`reason:'limit'`; caro kín bàn là `'full-board'`). Cờ vây cũng vậy: chạm 200 nửa nước (9×9) là hòa, **không** chuyển sang tính điểm. Muốn đổi sang tính điểm phải được Điều phối duyệt và sửa KH trước.

## 3. Giao diện module luật

### 3.1 Hàm bắt buộc

Giống nhau cho cả bốn module (KH §5.3). Module là UMD (IIFE), không DOM, không phụ thuộc, `state` là JSON thuần.

```js
create(opts)            → state            // opts: { size?, variant?, hidden?, seed? }
sides                   = ['a','b']
turn(state)             → 'a' | 'b'
legalMoves(state)       → string[]
play(state, move)       → { ok:true, state, info:{ capture?, check?, reveal? } } | { ok:false, reason }   // state ĐẦY ĐỦ, chỉ máy chủ
apply(state, move, reveal?) → { ok:true, state, info } | { ok:false, reason }   // state CÔNG KHAI (kết quả của view), dùng ở trình duyệt
status(state)           → { over:false, phase?:'scoring', check?:true } | { over:true, winner:'a'|'b'|null, reason }
view(state, side)       → state an toàn để gửi cho một bên hoặc người xem
notation(state, move)   → chuỗi cho người đọc
```

`reveal` (cờ tướng úp) là object `{ mover?:'r', captured?:'n' }` (chữ FEN): `mover` = danh tính quân úp **vừa đi** (lật sau khi đi, đứng ở ô đến của nước); `captured` = danh tính quân úp **bị ăn** (D7). Một nước có thể có cả hai (úp ăn úp), một, hoặc không có trường nào (khi đó không có `reveal`). Cùng dạng này dùng ở `play.info.reveal`, `kd:moved.reveal`, và `r` trong `moves` (mục 5.2, 10).

Ràng buộc chung **(chốt ở T-020)**:

- `state.ply` (số nguyên) = số nửa nước đã đi. `create` cho `ply: 0`. Đây là giá trị `ply` trong gói tin (mục 6).
- `play` **không sửa** `state` cũ, trả `state` mới; trả `{ ok:false, reason }` với `reason` tiếng Việt ngắn ("Nước đi không hợp lệ.", "Chưa tới lượt bạn.") thay vì ném lỗi.
- `legalMoves`, `status`, `notation` chỉ dùng thông tin **công khai** (cờ tướng úp: quân úp đi theo quân "chủ nhà" của ô, xem mục 3.5), nên chạy được cả trên state đầy đủ lẫn `view()`. Nhờ đó trình duyệt tính được nước hợp lệ từ `view()`.
- **Hai đường áp nước.** `play(state, move)` chạy trên state đầy đủ (máy chủ; cờ tướng úp cần bảng danh tính bí mật để lật quân). `apply(state, move, reveal?)` chạy trên state công khai: với cờ tướng úp, trình duyệt truyền `reveal` nhận từ `kd:moved` để lật quân đi/bị ăn; không có `reveal` thì quân úp vẫn úp (chỉ dùng cho áp thử nước của mình rồi chờ `kd:moved`, hoặc nước không lật gì). Với bốn môn không có thông tin ẩn, `apply` giống hệt `play` và bỏ qua `reveal`. UI chỉ gọi `apply`/`legalMoves`/`status`/`notation`, không sửa cấu trúc nội bộ của state. Với `jieqi` thì `apply` luôn trả cùng `state` công khai như `view(play(...).state, side)`.
- `notation(state, move)` nhận state **trước** nước đi. Với cờ tướng úp nó **không được** đọc danh tính quân úp.
- `status` lấy từ state thôi, không biết giờ. Hết giờ, đầu hàng, xin hòa, hủy ván là việc của manager.
- Chỉ nước hợp lệ mới vào `legalMoves`; `play` chấp nhận đúng tập đó.

### 3.2 Hàm tùy chọn

- `sufficient(state, side) → boolean`: bên `side` còn đủ quân để chiếu hết không (chỉ `KyChess` có). Manager dùng khi hết giờ: nếu đối thủ của bên hết giờ **không đủ quân chiếu hết** thì hòa (`reason:'timeout-insufficient'`), không thì bên hết giờ thua. Module không có hàm này thì coi là `true`.
- `KyChess`: `fromFen(fen)` / `toFen(state)` (để test perft và cờ thế sau này).
- `KyGo` (cờ vây, giai đoạn đánh dấu quân chết):
  - `groupAt(state, point) → string[]`: các điểm của nhóm quân (hoặc vùng trống) chứa `point`; `[]` nếu điểm trống không giáp quân nào.
  - `score(state, dead) → { a, b, komi, detail }`: `dead` là mảng điểm đã đánh dấu chết; tính điểm Trung Quốc (quân + đất, `b` cộng komi 7,5). `a` và `b` là số điểm (b gồm komi, có thể là số thập phân).
  - `resume(state, side) → state`: quay lại đánh, lượt thuộc `side` **(chốt ở T-020: người bấm "Đánh tiếp" đi trước)**.
  - `status` trả `{ over:false, phase:'scoring' }` sau hai lần `pass` liên tiếp; manager đọc phase này.

### 3.3 Định dạng nước đi (regex, **chuỗi ≤ 8 ký tự**, phân biệt hoa thường)

| `game` | Regex | Ví dụ |
|---|---|---|
| `chess` | `^[a-h][1-8][a-h][1-8][qrbn]?$` (UCI; `qrbn` là quân phong cấp) | `e2e4`, `e7e8q` |
| `xiangqi`, `jieqi` | `^[a-i][0-9][a-i][0-9]$` (ICCS; hàng 0 là bên Đỏ) | `h2e2`, `b0c2` |
| `go` | `^(pass\|[A-HJ-T](1[0-9]\|[1-9]))$` (bỏ chữ I; cột A… theo cỡ bàn, hàng 1 ở dưới) | `D4`, `J9`, `pass` |
| `gomoku` | `^[a-o](1[0-5]\|[1-9])$` | `h8`, `a15` |

- Manager kiểm regex **trước**, rồi mới gọi `play` (module còn kiểm cột/hàng có nằm trong cỡ bàn không).
- `point` của `kd:mark` dùng định dạng điểm của cờ vây (`D4`, không có `pass`).
- Nước nhập thành là nước của Vua theo UCI (`e1g1`, `e1c1`). Bắt tốt qua đường là nước tốt thường (`e5d6`).
- Chuỗi hiển thị (`notation`): cờ vua SAN; cờ tướng ký hiệu Việt; cờ vây và caro giữ nguyên nước.

### 3.4 Ví dụ cụ thể

**Cờ vua**
```js
let s = KyChess.create({});
KyChess.turn(s);                  // 'a'
KyChess.legalMoves(s).length;     // 20 (perft 1)
let r = KyChess.play(s, 'e2e4');  // { ok:true, state:{ply:1,…}, info:{} }
KyChess.notation(s, 'g1f3');      // 'Nf3'
KyChess.play(s, 'e2e5');          // { ok:false, reason:'Nước đi không hợp lệ.' }
KyChess.status(r.state);          // { over:false }
// thế chiếu hết: { over:true, winner:'b', reason:'checkmate' }
```

**Cờ tướng**
```js
let s = KyXiangqi.create({});
KyXiangqi.legalMoves(s).length;   // 44 (perft 1)
KyXiangqi.notation(s, 'h2e2');    // 'P2-5'  (Pháo 2 bình 5)
KyXiangqi.notation(s, 'h0g2');    // 'M2.3'  (Mã 2 tiến 3)
let r = KyXiangqi.play(s, 'h2e2');// { ok:true, state, info:{} }
// ăn quân: info:{ capture:true }; chiếu: info:{ check:true }
// hết nước đi hợp lệ (cả bị chiếu hết lẫn "chặn hết"): { over:true, winner:'a', reason:'no-moves' } (bên hết nước thua)
```

**Cờ tướng úp**
```js
let s = KyXiangqi.create({ variant:'jieqi', seed:'<seed bí mật>' });
KyXiangqi.legalMoves(s).length;   // 44: quân úp đi theo quân chủ nhà của ô nó đứng
let v = KyXiangqi.view(s, 'a');   // quân úp của cả hai bên là 'X' (đỏ) / 'x' (đen), không có danh tính
let r = KyXiangqi.play(s, 'b0c2');// quân úp ở b0 đi như Mã; r.info = { reveal:{ mover:'r' } } (quân thật là Xe)
// úp ăn úp: r.info.reveal = { mover:'r', captured:'n' }; úp ăn quân đã lật: { mover:'r' }
KyXiangqi.apply(v, 'b0c2', { mover:'r' }); // trình duyệt: áp lên state công khai, lật quân đi
KyXiangqi.notation(s, 'b0c2');    // 'ÚM8.7': chữ Ú + ký hiệu của quân chủ nhà (Mã 8 tiến 7); KHÔNG nói quân thật là gì
// Cách đếm cột: mỗi bên đếm từ phải sang trái của chính mình. Đỏ: b=8, c=7 (khớp 'M8.7' ở KH §5.4); Đen đếm ngược lại.
```
`view` của cờ tướng úp **giống nhau cho mọi `side`** và cho người xem: không ai (kể cả chính người chơi) biết quân úp của mình.

**Cờ vây**
```js
let s = KyGo.create({ size:9 });
KyGo.legalMoves(s).length;        // 82: 81 điểm + 'pass'
let r = KyGo.play(s, 'E5');       // { ok:true, state, info:{ capture?:n } }
KyGo.play(s, 'pass');             // hai pass liền: status → { over:false, phase:'scoring' }
KyGo.groupAt(state, 'D4');        // ['D4','D5',…]
KyGo.score(state, ['D4','D5']);   // { a:41, b:47.5, komi:7.5, detail:{…} }
```

**Caro**
```js
let s = KyGomoku.create({});      // 15×15
KyGomoku.legalMoves(s).length;    // 225
KyGomoku.play(s, 'h8');           // { ok:true, state:{ply:1,…}, info:{} }
// năm quân liền không bị chặn hai đầu: { over:true, winner:'a', reason:'five' }
// kín bàn: { over:true, winner:null, reason:'full-board' }
```

### 3.5 Cờ tướng úp: quy ước dữ liệu

- Ô chứa quân úp ghi `X` (úp, bên Đỏ) hoặc `x` (úp, bên Đen) trong `view`. Ô ban đầu cho biết quân chủ nhà (Xe, Mã, Tượng, Sĩ, Pháo, Tốt) nên module không cần danh tính.
- `state` đầy đủ (chỉ máy chủ) có thêm bảng danh tính quân úp, xáo bằng `makeRng(seed)` + Fisher–Yates, hạt giống **giữ kín cho tới hết ván** (không gửi, không lộ ra log; chỉ ghi vào biên bản ván đã lưu, xem mục 10).
- `info.reveal` là object `{ mover?, captured? }` (mục 3.1), mỗi giá trị là chữ quân thật theo FEN (`r` Xe, `n` Mã, `b` Tượng, `a` Sĩ, `c` Pháo, `p` Tốt). `mover` có khi quân úp **đi** (lật sau khi đi); `captured` có khi quân úp **bị ăn** (D7: lật công khai cho cả hai). Úp ăn úp thì có cả hai.
- Sĩ/Tượng đã lật đi tự do (D7).

## 4. Bàn ở Sân chùa

### 4.1 `YARD_TABLES`

Hằng số dùng chung: `YARD_TABLES` trong `server.js` ↔ `YARD_TABLES` trong `public/js/hall.js` (điểm đồng bộ, ghi ở ARCHITECTURE.md §6, T-005 mở rộng test). Toạ độ sàn 0..1 như `LIB_SEATS`.

```js
const YARD_TABLES = [
  { id: 1, x: 0.17, z: 0.50, seats: [[0.125, 0.50], [0.215, 0.50]] },
  { id: 2, x: 0.83, z: 0.50, seats: [[0.785, 0.50], [0.875, 0.50]] },
  { id: 3, x: 0.18, z: 0.76, seats: [[0.12, 0.76], [0.24, 0.76]] },
  { id: 4, x: 0.82, z: 0.76, seats: [[0.76, 0.76], [0.88, 0.76]] }
];
```

- `id` là số nguyên 1–4 (giá trị của `table` trong mọi gói tin). `seats[0]` là ghế bên A, `seats[1]` ghế bên B; `seats[i]` là chỗ nhân vật đi tới.
- Toạ độ đã chỉnh ở T-031 (bàn 1 và 2 dịch ra sát mép, khoảng ghế ±0,045): vùng chạm của NPC bí mật (0,32; 0,67) là hình chữ nhật cao, phủ kín ghế B của bàn 1 ở toạ độ đề xuất ban đầu (0,31; 0,50). `test/hall-tables.test.js` quét ba cỡ màn để giữ cho bàn/ghế chạm được và không đè vùng thầy bói. T-030 phải dùng đúng số này ở `server.js`.
- `kd:sit` thành công → máy chủ đặt `tx,tz = seats[seat]`, nhân vật đi tới rồi trình duyệt vẽ dáng ngồi. Dáng ngồi lấy từ `kd:table` (theo `pid`), **không** thêm trường vào `publicPlayer`.

**API vẽ bàn cho giao diện (T-034 dùng):** `Hall.setTables(mảng)` thay toàn bộ trạng thái bàn (dùng cho ack `kd:tables`, hoặc thêm đối số `true` để gộp). `Hall.setTables(T)` / `Hall.setTable(T)` với **một object T** (sự kiện `kd:table`) luôn **gộp**, không xoá bàn khác. `handlers.table(id, seat)` gọi khi chạm bàn, ghế, người đang ngồi hoặc biển tên (`seat` = −1 là mặt bàn/biển). Biển tên nằm dưới chân bàn, kẹp trong màn; màn rộng < 600px dùng nhãn ngắn (bỏ trạng thái và số người xem).

### 4.2 Ai ngồi ghế nào, ai là chủ bàn **(chốt ở T-020)**

- Ván đầu của một lượt ngồi: **ghế 0 là bên `a`** (đi trước), ghế 1 là bên `b`. "Đấu lại" **đổi bên** (người ngồi ghế 0 làm bên `b`).
- **Chủ bàn** (`host`) là người ngồi trước. Chủ bàn rời ghế thì người còn lại làm chủ bàn; bàn có luật đã chọn thì giữ nguyên.
- Mỗi uid một chỗ: không ngồi hai ghế, không vừa ngồi bàn vừa có ván khác, không ngồi cả hai ghế của một bàn (hai tab cùng uid → `reason:'Bạn đang ở một bàn khác.'`). Không tự đánh với chính mình.
- Bàn `waiting` mà không bắt đầu trong **5 phút** thì tự mời người ngồi đứng dậy (giữ bàn mãi là chiếm chỗ). Giao diện biết qua `kd:table` mới.
- Người đang **đấu** ở bàn bị khóa vị trí: sự kiện `move` (di chuyển) của họ bị bỏ qua. Người đang `waiting` mà di chuyển đi khỏi ghế thì tự đứng dậy (`leave`).
- Đổi cảnh (`scene`/`place:set`) khỏi nơi chơi khi đang đấu ở bàn thật **không** là đầu hàng: tính là "vắng mặt" (mục 7.3), ván vẫn chạy. Bàn trong thì không áp dụng (mục 4.3).

### 4.3 Chọn "bàn trong" khi hết bàn

Chỉ dùng khi **nhận lời mời** từ hộp người chơi (ghép đôi tự động):

1. Chọn bàn có `status:'free'` (không người ngồi, không ván) **gần nhất** tâm bàn tới vị trí hiện tại của người mời (nếu họ đang ở chánh điện thì tính từ điểm đứng của cảnh `yard` trong `SCENES`); bằng nhau thì `id` nhỏ hơn.
2. Người mời ngồi ghế 0, người nhận lời ghế 1. Hai bên được máy chủ chuyển sang cảnh `yard` (`pscene`) và đi tới ghế.
3. **Không có bàn `free` nào** (bàn `waiting` cũng không bị chiếm): ván diễn ra ở **bàn trong**: không có ghế, hai người đứng tại chỗ, **không cho xem**, `table:null`. Bàn trong vẫn tính vào `KYDAO_MAX_GAMES`.
4. Cả hai ghép từ lời mời **tự sẵn sàng**: máy chủ gửi `kd:start` ngay khi nhận lời (nhân vật đi tới ghế trong lúc đó); luật 30 giây "không đi nước đầu" (mục 7.2) vẫn áp dụng.

Biểu tượng bàn cờ nhỏ trên đầu người chơi ở bàn trong lấy từ `kd:table` với `table:null` (mục 5.2). **(chốt ở T-020)** Vì hai người đứng tại chỗ ở chánh điện hoặc sân, gói `T` của **bàn trong** gửi cho **mọi người có `p.place` rỗng hoặc `hall`, ở cả hai cảnh** (khác bàn thật chỉ gửi cho người ở sân); `kd:tables` trả được bàn trong từ mọi nơi trong `hall`. Với bàn trong, chỉ **mất kết nối** mới tính là vắng mặt (mục 7.3); đổi cảnh trong `hall` không làm gì.

## 5. Sự kiện `kd:*`

Mặc định mọi sự kiện cần đang ở Sân chùa (`p.scene==='yard'`, `p.place` rỗng hoặc `hall`, khớp `server.js`). **Ngoại lệ vị trí** (không nới quyền người ngoài, vì mọi kiểm tra sở hữu vẫn theo `uid`):
- Sự kiện ghi "mọi nơi".
- `kd:invite`, `kd:invite:cancel`, `kd:respond`: người mời/nhận ở chánh điện hoặc sân; chỉ người mời mới hủy được lời mời của mình, chỉ người được mời mới trả lời được (nhận lời từ chánh điện là hợp lệ, máy chủ chuyển hai người ra sân, mục 4.3).
- `kd:mark`, `kd:agree`, `kd:resume-play`, `kd:move`, `kd:draw`, `kd:resign`, `kd:skin`: bất kể nơi, miễn `uid` là người chơi của `gameId` (kể cả bàn trong, nơi hai người đứng tại chỗ ở chánh điện).

Sự kiện xếp hạng cần `accountReady(p)`, không thì `{ ok:false, code:'login', reason }`.

### 5.1 Trình duyệt → máy chủ

`GameId`/`Table` ở bảng dưới: `gameId` chuỗi, `table` số nguyên 1–4. `Rules = { game, rated:boolean, pace, size? }`.

| Sự kiện | Dữ liệu | Điều kiện | Ack thành công | Lỗi (`reason`; `code`) |
|---|---|---|---|---|
| `kd:tables` | `{}` | ở sân để lấy bàn thật; bàn trong thì lấy được từ mọi nơi trong `hall` (ở chánh điện chỉ nhận các bàn trong) | `{ ok:true, tables:[T], serverTime }`; `T` ở mục 5.2 (cả bàn thật lẫn "bàn trong" đang đấu) | — |
| `kd:sit` | `{ table, seat }` `seat` ∈ 0,1 | ở sân; bàn `free` hoặc `waiting` còn ghế; chưa có chỗ khác | `{ ok:true, table, seat }` | "Không có bàn này." · "Ghế này đã có người." · "Bàn đang đấu; chạm bàn để xem." · "Bạn đang ở một bàn khác." |
| `kd:setup` | `{ table, game, rated, pace, size? }` | chỉ **chủ bàn**, bàn chưa bắt đầu; `size` chỉ với `go`; `rated` chỉ khi môn/cỡ cho phép (cờ vây 9×9) | `{ ok:true }` | "Chỉ chủ bàn chọn luật." · "Ván đã bắt đầu." · "Cờ vây chỉ xếp hạng ở bàn 9×9." (`login` nếu `rated` mà chưa đăng nhập) |
| `kd:ready` | `{ table, ready:boolean }` | đang ngồi ghế bàn đó; bàn đã có luật; ván bắt đầu khi **cả hai** đang `ready:true` với bộ luật hiện tại | `{ ok:true }` | "Chủ bàn chưa chọn luật." · `login` nếu bàn xếp hạng |
| `kd:stand` | `{ table }` | đang ngồi | `{ ok:true, resigned:boolean }`; đang đấu thì là **đầu hàng** | — |
| `kd:invite` | `{ toPid, game, rated, pace, size? }` | người gửi ở chánh điện hoặc sân (`p.place` là `hall`); người nhận cũng vậy, không phải chính mình, chưa ngồi bàn/chưa có ván | `{ ok:true, inviteId, expiresAt, downgraded?:string }` (`downgraded` có khi `rated:true` mà cặp đã đủ 3 ván hôm nay, mục 8.3) | "Người này đang bận." · "Người này không nhận lời mời." · "Bạn vừa bị từ chối, đợi 5 phút." · `login` nếu xếp hạng và người **gửi** chưa đăng nhập; cờ vây xếp hạng chỉ 9×9 (câu như `kd:setup`) |
| `kd:invite:cancel` | `{ inviteId }` | người mời | `{ ok:true }` | — |
| `kd:respond` | `{ inviteId, accept:boolean }` | người được mời; còn hạn | `{ ok:true }` | "Lời mời đã hết hạn." · "Chùa đang có quá nhiều ván cờ, thử lại sau." |
| `kd:move` | `{ gameId, ply, move }` | mọi nơi; người chơi của ván; tới lượt; `ply === state.ply` hiện tại | `{ ok:true, ply }` (`ply` sau nước này) | "Chưa tới lượt bạn." · "Nước đi không hợp lệ." · "Ván đã kết thúc." · `stale` |
| `kd:draw` | `{ gameId, act }`, `act` ∈ `offer`,`accept`,`decline` | mọi nơi; người chơi; `offer` khi đã đi ≥ 2 nước mỗi bên, mỗi người tối đa 3 lời/ván; `accept`/`decline` khi có lời đang mở | `{ ok:true }` | "Chưa thể xin hòa lúc này." · "Bạn đã xin hòa quá nhiều lần." · "Không có lời xin hòa." |
| `kd:resign` | `{ gameId }` | mọi nơi; người chơi | `{ ok:true }` | — |
| `kd:mark` | `{ gameId, point }` | cờ vây, đang `phase:'scoring'`; người chơi | `{ ok:true }` | "Chưa tới lúc đánh dấu quân." · "Điểm này không có quân." |
| `kd:agree` | `{ gameId }` | như `kd:mark` | `{ ok:true }` | như trên |
| `kd:resume-play` | `{ gameId }` | như `kd:mark` | `{ ok:true }` | như trên |
| `kd:skin` | `{ gameId, field?, pieces? }` (mã skin, mục 5.4) | mọi nơi; người chơi của ván; ván chưa kết thúc; môn thuộc `KydaoSkins.GAMES` | `{ ok:true, field, pieces }` (skin hiện tại của mình sau khi đổi) | "Môn này chưa có skin." · "Chưa chọn skin." · "Đợi N giây nữa mới đổi được sân." / "… quân." (`code:'rate'`, kèm `retryAt`) · `stale` |
| `kd:watch` | `{ table }` | ở sân; bàn đang đấu thật (không phải bàn trong); chưa đủ 50 người xem (**người đang xem đúng bàn này gọi lại thì luôn được nhận**, không tính thêm, để dựng lại ván) | `{ ok:true, table }` rồi máy chủ gửi `kd:start` (không có `you`) | "Bàn này không có ván." · "Bàn này đã đủ người xem." |
| `kd:unwatch` | `{ table }` | đang xem | `{ ok:true }` | — |
| `kd:resume` | `{}` | mọi nơi | `{ ok:true, start:null\|StartPayload, message? }` (mục 6.2) | — |

- **Lỗi chung** (mọi sự kiện, `reason` thống nhất, không ném lỗi): không ở nơi cho phép → "Hãy ra Sân chùa để chơi cờ." · `table`/`gameId`/`seat` sai kiểu hoặc không có → "Không có bàn này." / "Không có ván này." · người xem hoặc người ngoài gọi lệnh của người chơi (`kd:move`, `kd:draw`, `kd:resign`, `kd:mark`, `kd:agree`, `kd:resume-play`, `kd:skin`) → "Bạn không phải người chơi của ván này." · `kd:ready`/`kd:respond`/`kd:invite` khi đã đủ `KYDAO_MAX_GAMES` → "Chùa đang có quá nhiều ván cờ, thử lại sau." · vượt `bucket('kd', 5, 15)` → `{ ok:false, code:'rate', reason:'Bạn thao tác quá nhanh.' }`. **`code:'rate'` là mã mới** (bucket của PK không trả `code`); giao diện chỉ cần coi như lỗi thường và hiện `reason`.
- **Lời mời xếp hạng** **(chốt ở T-020)**: người được mời chưa `accountReady` → vẫn nhận lời mời; khi `kd:respond accept` mà họ chưa đăng nhập thì ack `{ ok:false, code:'login', reason }`, lời mời **giữ nguyên** tới hết hạn để họ đăng nhập rồi nhận lại. Cờ vây 13/19 không xếp hạng được (`kd:invite` báo lỗi). Quá 3 ván/ngày/môn cho cặp: ván hạ xuống giao hữu; vì ván ghép từ lời mời bắt đầu ngay, nên câu hạ bậc được báo **trước** qua `downgraded` trong `kd:invited` (người nhận thấy trước khi bấm nhận) và trong ack của `kd:invite` (người mời thấy ngay); máy chủ tính bộ đếm cặp lúc mời, **tính lại lúc nhận lời** và vẫn ghi cùng câu vào `kd:start.downgraded` (mục 8.3). Không dựa vào `kd:table.note`, vì `kd:table` luôn đến sau `kd:start` (mục 6.1.5).
- Giai đoạn đánh dấu cờ vây kết thúc khi: cả hai `kd:agree` (tính theo dấu đang có) **hoặc** hết 3 phút (`deadlineAt`) → máy chủ tính theo dấu đang có, gửi `kd:end` `reason:'score'`; hoặc một bên `kd:resume-play` (đánh tiếp, mục 6.1.7); hoặc đầu hàng.
- `kd:setup` hợp lệ (đổi môn, nhịp, `rated` hoặc `size`) **luôn xóa `ready` của cả hai ghế** rồi phát `kd:table` mới. Người kia phải bấm sẵn sàng lại với bộ luật mới; không bao giờ có ván bắt đầu với luật mà đối thủ chưa xác nhận. Người ngồi vào ghế sau cũng bắt đầu với `ready:false`.
- `kd:draw offer` của bên này, nếu bên kia **đi một nước** thì lời xin coi như bị từ chối (gửi `kd:offer` trạng thái `declined`).
- `kd:stand` ở bàn đang đấu = `kd:resign` (giao diện hỏi xác nhận "Rời bàn nghĩa là đầu hàng").
- `kd:mark` đổi dấu sống/chết cả **nhóm** (`KyGo.groupAt`) chứa `point`; mọi thay đổi dấu xóa hai chữ "đồng ý".
- Chặn người chơi: `kd:invite` tôn trọng danh sách chặn và "Không nhận lời mời" của Sân đấu (`arena:dnd`, `pk:block`): người đã chặn mình hoặc đang bật "không nhận lời mời" thì trả cùng một câu "Người này không nhận lời mời." (không lộ là bị chặn hay đang bật) (dùng cùng bộ lọc với `pk:invite`).
- Giới hạn lời mời (giống PK): hạn **20 giây**; mỗi người một lời mời đang chờ gửi đi, tối đa 3 lời đang chờ nhận; bị từ chối thì **5 phút** mới mời lại được cùng người đó.

### 5.2 Máy chủ → trình duyệt

| Sự kiện | Gửi cho | Dữ liệu |
|---|---|---|
| `kd:table` | **bàn thật**: mọi người ở sân (`scene:'yard'`). **Bàn trong** (`table:null`): mọi người trong `hall`, cả hai cảnh | một `T`, mỗi khi bàn đổi |
| `kd:invited` | người được mời | `{ inviteId, game, rated, pace, size?, expiresAt, downgraded?:string, from:{ pid, name, look, elo } }` (`downgraded`: câu báo ván xếp hạng này sẽ là giao hữu, mục 8.3) |
| `kd:invite:closed` | hai bên | `{ inviteId, reason }`, `reason` ∈ `declined`,`expired`,`cancelled`,`busy`,`accepted`,`left`,`full` |
| `kd:start` | hai người chơi + người xem | `StartPayload` |
| `kd:moved` | hai người chơi + người xem | `{ gameId, ply, move, text, side, capture?, check?, reveal?, clock, status? }` |
| `kd:offer` | cả hai người chơi | `{ gameId, kind:'draw', state:'open'\|'declined'\|'expired', from?:'a'\|'b' }` |
| `kd:marks` | hai người chơi + người xem | `{ gameId, dead:[point], agreed:{a:boolean,b:boolean}, deadlineAt:serverMs\|null, clock }` |
| `kd:skin` | hai người chơi + người xem | `{ gameId, side:'a'\|'b', field:id\|null, pieces:id\|null, opened:boolean }` (mục 5.4) |
| `kd:end` | hai người chơi + người xem | `{ gameId, result, reason, text, elo?, score?, final? }` |
| `legend:vs` | hai người chơi + người xem | Epic DH, KH §6.5 (không thuộc tài liệu này) |

**`T`** (`kd:table` và phần tử của ack `kd:tables`):
```
{ table:1|2|3|4|null,           // null = bàn trong; khi đó có thêm gameId
  gameId?:string,               // chỉ bàn trong
  inner?:true,                  // chỉ bàn trong
  status:'free'|'waiting'|'playing',
  game?:string, rated?:boolean, pace?:string, size?:number,   // luật đã chọn (khi bàn có luật)
  seats:[ {pid,name,ready}|null, {pid,name,ready}|null ],     // theo thứ tự ghế 0, 1
  host?:pid,                    // chủ bàn (khi có người ngồi)
  watchers:number,              // 0 với bàn trong
  note?:string }                // câu báo ngắn khi bàn ngồi sẽ bị hạ xuống giao hữu (mục 8.3); ván ghép từ lời mời dùng `downgraded` của `kd:invited`
```
- Bàn trong: máy chủ gửi `T` với `status:'playing'` lúc bắt đầu và `status:'free'` (`seats:[null,null]`) lúc hết ván; trình duyệt xóa biểu tượng theo `gameId`. **(chốt ở T-020: dùng lại `kd:table` thay cho sự kiện mới, vì KH cấm thêm trường vào `publicPlayer`.)**
- `seats` không chứa `uid`. `ready` chỉ có ý nghĩa khi `status:'waiting'`.

**`StartPayload`** (`kd:start`, và `start` của ack `kd:resume`):
```
{ gameId:string, table:1|2|3|4|null, game:string, rated:boolean, pace:string, size?:number,
  you?:'a'|'b',                          // người xem không có trường này
  a:{ pid, name, look, elo:number|null, prov:boolean, title?:string|null },
  b:{ pid, name, look, elo:number|null, prov:boolean, title?:string|null },
  state:view(state, you),                // người xem: view(state, 'a') (cờ tướng úp: giống nhau mọi bên)
  ply:number,                            // = state.ply
  moves:[ { m, t, r? } ],                // lịch sử nước đi: m = nước, t = chữ hiển thị, r = reveal `{ mover?, captured? }` nếu có (mục 3.1); ≤ 400 phần tử
  clock:{ a:ms, b:ms, turn:'a'|'b'|null, turnStartedAt:serverMs, incMs:number },
  marks?:{ dead:[point], agreed:{a,b}, deadlineAt },   // cờ vây đang ở giai đoạn đánh dấu
  offer?:'a'|'b'|null,                   // bên đang có lời xin hòa mở
  resumed?:true,                         // gói gửi lại khi vào lại / người xem vào giữa ván
  downgraded?:string,                    // lý do ván xếp hạng thành giao hữu (mục 8.3)
  skins:{ a:{ field, pieces }, b:{ field, pieces } } }   // skin hiện tại của hai bên (mục 5.4); ván mới: mọi giá trị null
```
- `elo` là `null` khi ván giao hữu hoặc người đó chưa có hạng. `prov:true` khi hạng ở môn này chưa đủ 10 ván (giao diện thêm dấu "?").
- `clock.a`, `clock.b` là số mili giây **còn lại tại thời điểm `turnStartedAt`** (giờ máy chủ; trình duyệt tự đếm theo `Hall.serverNow()` / `Hall.setOffset`). Khi đồng hồ chưa chạy hoặc ván tạm dừng (cờ vây đang đánh dấu) thì `turn:null`.

**`kd:moved`**: `ply` là số nửa nước đã đi **sau** nước này (bằng `ply` người đi gửi lên + 1); `side` là bên vừa đi; `status` chỉ có khi `over:true` hoặc `phase:'scoring'` (nhận từ `status(state)`); `clock` là đồng hồ **sau** nước này (đã cộng giờ cộng thêm, đã bắt đầu giờ của bên kế). `reveal` chỉ có ở cờ tướng úp, dạng `{ mover?, captured? }` (mục 3.1); trình duyệt truyền nó vào `apply(state, move, reveal)`.

**`kd:end`**:
- `result` ∈ `a`, `b`, `draw`, `abort`. `abort` = hủy ván, không tính Elo.
- `reason` (mã) và `text` (câu tiếng Việt cho người đọc, ví dụ "Đen hết giờ."). Các mã:

| `reason` | Ý nghĩa | `result` |
|---|---|---|
| `checkmate` | chiếu hết (cờ vua) | `a`/`b` |
| `stalemate` | hết nước đi không bị chiếu (cờ vua) | `draw` |
| `no-moves` | hết nước đi hợp lệ (cờ tướng, cờ tướng úp): bên hết nước **thua** | `a`/`b` |
| `perpetual` | chiếu dai (cờ tướng): bên chiếu liên tục thua | `a`/`b` |
| `threefold` | lặp thế 3 lần (không ai chiếu dai) | `draw` |
| `fifty` / `sixty` | 50 nước cờ vua / 60 nước mỗi bên cờ tướng không ăn quân | `draw` |
| `insufficient` | không đủ quân chiếu hết (cờ vua) | `draw` |
| `five` | năm quân liền (caro) | `a`/`b` |
| `full-board` | kín bàn (caro) | `draw` |
| `score` | tính điểm (cờ vây) | `a`/`b` |
| `agreed` | hai bên thỏa thuận hòa | `draw` |
| `resign` | đầu hàng (kể cả `kd:stand` khi đang đấu) | `a`/`b` |
| `timeout` | hết giờ | `a`/`b` |
| `timeout-insufficient` | hết giờ nhưng đối thủ không đủ quân chiếu hết (cờ vua) | `draw` |
| `limit` | chạm `maxPlies` (mọi môn, kể cả cờ vây; trừ caro dùng `full-board`) | `draw` |
| `account` | một người chơi vừa liên kết tài khoản Google nên chỗ khách bị dọn (mục 10) | `abort` |
| `no-start` | bên đi trước không đi nước đầu trong 30 giây | `abort` |
| `away` | cả hai vắng mặt 60 giây | `abort` |
| `too-short` | ván xếp hạng kết thúc khi chưa đủ `minPlies` | `abort` |

- `elo` (chỉ khi ván được tính Elo): `{ a:{ from, to }, b:{ from, to } }`.
- `score` (cờ vây, `reason:'score'`): `{ a, b, komi }`.
- `final` (chỉ cờ tướng úp, mọi `reason`): thế cờ **đầy đủ** (đã lật hết) để hiển thị lại sau ván. **(chốt ở T-020)**
- Hết ván: máy chủ gửi `kd:end`, rồi `kd:table` (bàn về `waiting` với cả hai còn ngồi và `ready:false`; "Đấu lại" = cả hai gửi `kd:ready`, ván mới **đổi bên**; "Rời bàn" = `kd:stand`). Bàn trong thì bàn bị xóa. **(chốt ở T-020: không thêm sự kiện "đấu lại".)**

### 5.3 Phòng Socket.IO và người xem

- Người xem vào phòng `kd:<table>` (số 1–4). **Người chơi không vào phòng này**: họ nhận gói tin bằng `emit(uid, …)` để không bị gửi hai lần.
- Tối đa **50** người xem một bàn. Người xem rời khi đóng bảng (`kd:unwatch`), đổi cảnh, hoặc ngắt kết nối.
- Người xem ở lại bàn qua nhiều ván: ván mới bắt đầu thì họ nhận `kd:start` mới.
- Người đang đấu hoặc ngồi bàn không xem bàn khác.
- `kd:table` của bàn thật gửi tới mọi người ở cảnh `yard`; của bàn trong gửi tới mọi người trong `hall` (mục 4.3). Người vừa vào sân (hoặc vào lại chánh điện) gọi `kd:tables` để có trạng thái đầy đủ.

### 5.4 Skin sân và skin quân (`kd:skin`, T-110)

Thiết kế ở `docs/KE-HOACH-KY-DAI.md` §3–4. Danh mục mã là `public/js/kydao-skins.js` (`KydaoSkins`, UMD); máy chủ nạp đúng file này để kiểm mã.

- **Chỉ môn có hai nửa sân**: `KydaoSkins.GAMES` = `chess`, `xiangqi`, `jieqi`. Cờ vây, caro trả "Môn này chưa có skin." (vẫn có `skins` toàn `null` trong `StartPayload`).
- **Client chỉ gửi mã.** `field` là id trong `KydaoSkins.FIELDS`, `pieces` là id trong `KydaoSkins.PIECES`. Máy chủ chỉ đọc hai khóa riêng (`hasOwn`) rồi đưa qua `KydaoSkins.normalize`: mã lạ, kiểu lạ (số, object, mảng), `'__proto__'`, `'toString'`… đều thành `null` (= về mặc định). Gửi `null` là bỏ skin. Khóa không gửi thì giữ nguyên. Không gửi khóa nào → "Chưa chọn skin.". Khẩu hiệu, tên sân lấy từ danh mục ở trình duyệt; không có chữ tự do nên không qua `lib/moderation.js`.
- **Ai đổi được**: chỉ người chơi của ván, cho **bên của chính mình** (`side` do máy chủ suy từ `uid`, client không gửi `side`). Người xem, người ngoài → "Bạn không phải người chơi của ván này.". Ván đã kết thúc hoặc không còn → "Không có ván này." (`stale`). Hết giờ thì máy chủ xử `timeout` trước, trả "Ván đã kết thúc." (`stale`).
- **Giới hạn** (K7, tính riêng từng người trong một ván, nhân `KYDAO_TIME_SCALE`): đổi `field` tối đa 1 lần / 20 giây; đổi `pieces` tối đa 1 lần / 3 giây. Chỉ **thay đổi thật** mới tính (gửi lại đúng mã đang dùng thì ack `ok:true`, không phát gói, không tính lượt). Vượt giới hạn: cả yêu cầu bị từ chối (không đổi phần nào), ack `{ ok:false, code:'rate', reason:'Đợi N giây nữa mới đổi được sân.', retryAt:serverMs }`. Vẫn qua `bucket('kd', 5, 15)` chung.
- **Phát**: khi có thay đổi, máy chủ gửi `kd:skin { gameId, side, field, pieces, opened }` cho hai người chơi và phòng người xem `kd:<bàn>` (bàn trong: chỉ hai người chơi), **trước** ack. `field`, `pieces` là skin hiện tại **đầy đủ** của bên `side` sau khi đổi. `opened:true` khi `field` vừa đổi sang một skin (từ `null` hoặc từ skin khác): giao diện chạy màn "Khai mở lãnh địa!"; đổi `pieces` hoặc bỏ sân (`field:null`) thì `opened:false`.
- **Ảnh chụp ván**: `kd:start`, `start` của ack `kd:resume`, và `kd:start` gửi người xem (`kd:watch`) đều có `skins:{ a:{field,pieces}, b:{field,pieces} }`. Ván mới (kể cả "Đấu lại") bắt đầu bằng `null` hết.
- **Không lưu bền** (K3): skin là trạng thái của ván trong RAM, mất khi hết ván hoặc máy chủ khởi động lại; không có trong `db.kydao`, biên bản ván hay `store-sections`. Lựa chọn ưa thích của người chơi lưu ở `localStorage` trình duyệt; muốn dùng lại ở ván mới thì giao diện (T-115) gửi lại `kd:skin`.
- **Cờ tướng úp** (K6): gói `kd:skin` chỉ chứa mã skin của một bên, không có `state`, không có thông tin quân; skin quân áp cho mọi quân úp một bên như nhau. Gói không có `uid`.

## 6. Thứ tự gói tin (giao diện phải chịu được)

### 6.1 Quy tắc dựng ván

1. Mọi gói `kd:moved` có `gameId` và `ply`. Giao diện giữ `local.ply` (từ `kd:start.ply`). Gặp `kd:moved` với:
   - `ply ≤ local.ply`: bỏ (đã áp rồi; ví dụ gói của chính nước mình vừa đi tới sau khi áp thử).
   - `ply === local.ply + 1`: áp nước đi.
   - `ply > local.ply + 1`: lỡ gói; dựng lại từ đầu: **người chơi** gọi `kd:resume`; **người xem** gọi lại `kd:watch` của bàn đang xem (ack `{ ok:true, table }`, rồi máy chủ gửi `kd:start` mới có `resumed:true` cho riêng họ, không vào phòng lần hai).
2. **`kd:moved` có thể tới trước `kd:start`** (vào lại giữa ván, hoặc người xem vừa `kd:watch` trong lúc có người đi). Nếu chưa có ván cho `gameId`, giao diện **giữ `kd:moved` trong bộ đệm theo `gameId`**; khi `kd:start` tới thì bỏ gói có `ply ≤ start.ply` rồi áp phần còn lại theo thứ tự `ply`. Bộ đệm bỏ sau 10 giây.
3. Người **đi nước cuối** nhận `kd:moved` của chính mình (và có thể là `kd:end`) **trước** ack của `kd:move` (máy chủ giải đồng bộ). Người **bấm "Sẵn sàng" cuối cùng** nhận `kd:start` có thể trước ack của `kd:ready`. Tương tự `kd:respond` và `kd:start` (ván ghép từ lời mời). Giao diện không được giả định ack đến trước.
4. Hết ván: `kd:moved` (nước cuối, có `status.over:true`) tới trước `kd:end`; chờ hoạt ảnh quân đi xong rồi mới hiện bảng kết quả. `kd:end` luôn tới sau `kd:moved` cuối cùng của ván đó. Hủy ván (`abort`) không có `kd:moved`.
5. `kd:table` luôn gửi **sau** gói của chính ván (`kd:start` rồi `kd:table`; `kd:end` rồi `kd:table`), nên một người đứng xem bàn có thể thấy bàn "đang đấu" ngay trước khi nhận `kd:start`.
6. `kd:offer` trạng thái `open` tới đối thủ **sau** `kd:moved` gần nhất của cùng ván.
7. Cờ vây: hai lần `pass` → `kd:moved` (có `status.phase:'scoring'`) rồi ngay sau là `kd:marks`. "Đánh tiếp" (`kd:resume-play`) → máy chủ gửi `kd:marks` với `dead:[]`, `agreed` cả hai `false`, `deadlineAt:null` (dấu hiệu đã thoát giai đoạn đánh dấu) và `clock` mới (lượt thuộc người bấm). **(chốt ở T-020)** `kd:marks` luôn có trường `clock` (cùng dạng như ở `kd:moved`); trong giai đoạn đánh dấu `clock.turn` là `null` (đồng hồ dừng).

Giao diện T-033 nhận đủ năm mã môn (`chess`, `xiangqi`, `jieqi`, `go`, `gomoku`), dùng cùng mã để chọn nhạc. Bàn vây 13/19 chỉ cho chọn giao hữu. `app.js` chuyển tiếp cả `kd:marks` tới bảng cờ; bảng dùng `dead` và luật `score()` để hiện điểm tạm tính, dùng `deadlineAt` theo giờ máy chủ để đếm ngược. Khán giả chỉ xem dấu và điểm. Với cờ úp, giao diện chờ `kd:moved.reveal` rồi gọi `apply`, không áp thử nước có quân úp. Mọi `kd:start` (kể cả xem và vào lại) chỉ chứa `view()` đã che; `final` chỉ lật toàn bộ sau khi ván đã kết thúc. Không thêm trường giao thức mới.

### 6.2 Vào lại (`kd:resume`) và khi máy chủ khởi động lại

`kd:resume` (không tham số, **mọi nơi**) → ack `{ ok:true, start:null | StartPayload, message? }`:

- Có ván đang đấu của người này: `start` là `StartPayload` với `resumed:true` (state hiện tại, `moves`, `clock`, `marks`…). **Không** gửi thêm `kd:start` riêng; giao diện coi `start` như `kd:start`.
- Người này đang ngồi bàn chờ (chưa có ván): `start:null` (giao diện lấy trạng thái bàn từ `kd:tables`).
- Máy chủ đã khởi động lại giữa ván: `start:null`, `message:'Ván cờ trước đã bị hủy vì máy chủ khởi động lại. Không ai bị tính thua.'`, rồi xóa `db.kydao.active[uid]`.
- Khi mở trang / nối lại mạng, `app.js` gọi `kd:resume` một lần sau khi đã `join`.
- Người xem không có `kd:resume` (ack chỉ trả ván của người chơi): nối lại hoặc lỡ gói thì gọi lại `kd:watch` của bàn hiện tại để nhận `kd:start` mới (mục 6.1.1).

Nối lại mạng: người chơi đã có `pid` cũ coi như vào lại (cùng uid); tab thứ hai của cùng uid cũng nhận gói tin và gọi được `kd:move` (máy chủ nhận nước đầu tiên hợp lệ, `ply` chặn gửi trùng).

## 7. Đồng hồ, hủy ván, hết giờ, vắng mặt, khởi động lại

### 7.1 Đồng hồ

- Máy chủ giữ giờ. Cấu trúc ở `clock` (mục 5.2). Khi bên đi nước hợp lệ: `remaining -= (now - turnStartedAt)`, rồi `remaining += incMs`, rồi sang bên kia với `turnStartedAt = now`.
- Hẹn giờ qua `arm/disarm` có chặn `m.over` (như `lib/pk/manager.js`). Hết giờ thì thua (`timeout`); riêng cờ vua có `sufficient` (mục 3.2).
- Máy chủ coi nước đi tới sau hạn là **quá giờ** (xử `timeout` trước, không nhận nước đó); không có "khoan dung" nào cho độ trễ mạng. Người chơi tự thấy đồng hồ trên màn hình.
- Trình duyệt chỉ đếm hiển thị và đồng bộ theo `clock` mỗi gói `kd:moved`/`kd:start`.
- `KYDAO_TIME_SCALE` nhân mọi khoảng thời gian (giờ, 20/30/60 giây, 3 phút đánh dấu, 5 phút giữ bàn) để test nhanh.

### 7.2 Hủy ván

`result:'abort'`, không tính Elo, không tính ván:
- Bên đi trước (`a`) không đi nước đầu trong **30 giây** kể từ `kd:start`: `no-start`.
- Cả hai vắng mặt **60 giây**: `away`.
- Ván **xếp hạng** kết thúc (đầu hàng, hết giờ…) khi chưa đủ `minPlies`: `too-short`. Ván giao hữu thì kết thúc bình thường.

### 7.3 Vắng mặt, mất kết nối

- "Vắng mặt" = người chơi không còn socket nào đang kết nối. Với **bàn thật**, đổi cảnh khỏi `yard` hoặc đổi nơi khỏi `hall` cũng tính là vắng (mục 4.2). Với **bàn trong**, chỉ mất kết nối mới tính (đổi cảnh trong `hall` không đổi gì, mục 4.3).
- **Đồng hồ vẫn chạy.** Một bên vắng mặt mà hết giờ thì thua (`timeout`). Không có "đợi người nối lại".
- Cả hai cùng vắng liên tục 60 giây → `away` (hủy).
- Bên còn lại thấy đối thủ vắng qua `kd:table` (ghế còn tên nhưng không có thay đổi) — **bản đầu không có chỉ báo trạng thái vắng riêng** (giao diện không cần). **(chốt ở T-020)**

### 7.4 Khởi động lại máy chủ

- Ván, bàn, lời mời nằm trong RAM nên mất khi máy chủ khởi động lại. Ván đang đấu **bị hủy**, **không tính Elo**, không ai bị tính thua.
- `db.kydao.active[uid] = gameId` ghi lúc `kd:start` và xóa khi hết ván, để sau khi khởi động lại `kd:resume` biết người này có ván bị hủy và báo `message` (mục 6.2). Vì chỉ biết "có ván", không ghi biên bản ván bị hủy. Người không bao giờ quay lại thì mục của họ nằm mãi (chỉ là một cặp uid → gameId, rất nhỏ): **(chốt ở T-020)** bản đầu chấp nhận, không dọn; nếu T-029 muốn dọn thì thêm mốc thời gian vào mục rồi xóa mục quá 30 ngày lúc khởi động.
- Tắt máy (`SIGTERM`): `shutdown()` của manager hủy hẹn giờ; `server.js` đã flush store như hiện nay.

### 7.5 Đầu hàng, xin hòa

- `kd:resign`/`kd:stand` khi đấu: kết thúc ngay, `reason:'resign'`.
- Xin hòa: `kd:draw offer` → đối thủ nhận `kd:offer {state:'open'}`. `accept` → ván hòa `reason:'agreed'`. `decline`, hoặc đối thủ đi một nước, hoặc quá **30 giây** → `kd:offer` trạng thái `declined`/`expired` cho cả hai. **(chốt ở T-020: 30 giây, tối đa 3 lời/người/ván, chỉ khi mỗi bên đã đi ≥ 2 nước.)**

## 8. Elo và chống "cày"

### 8.1 Công thức (theo D6)

- Mỗi người, mỗi môn (`chess`, `xiangqi`, `jieqi`, `go`, `gomoku`) lưu `{ r, peak, peakAt, n, w, l, d, last }`. Chưa có thì `r:1200, n:0`. Cờ vây chỉ có một hạng (9×9, vì chỉ 9×9 xếp hạng).
- `expected = 1 / (1 + 10^((Rđối − Rmình) / 400))`; `mới = cũ + K × (điểm − expected)`; điểm: thắng 1, hòa 0,5, thua 0. Làm tròn số nguyên (`Math.round`). Sàn **100**.
- `K` theo số ván **trước** ván này: **40** khi `n < 20`, **20** khi `r < 2000`, **10** khi `r ≥ 2000` (ưu tiên: `n < 20` trước). Mỗi bên tính `K` riêng; cả hai dùng hạng **trước** ván.
- Sau ván: `n += 1`, `w`/`l`/`d` tăng, `last = now()`. Đỉnh chỉ xét khi `n ≥ 20` sau ván này (không tính giai đoạn tạm tính): nếu chưa có đỉnh (`peak` chưa đặt, tức lần đầu đủ 20 ván) thì `peak = r`, `peakAt = now()`; nếu `r > peak` cũ thì `peak = r`, `peakAt = now()`; nếu `r ≤ peak` thì **giữ nguyên** `peak` và `peakAt` (không cập nhật timestamp), để hòa điểm đỉnh vẫn ưu tiên người đạt trước (KH §6.1). Trước khi đủ 20 ván, `peak` và `peakAt` là `null`.
- Giao diện hiện dấu "?" sau Elo khi `n < 10` (`prov:true`).
- **Không có thưởng công đức** (D16).

### 8.2 Khi nào ván được tính Elo

Tất cả điều kiện cùng đúng (`lib/kydao/elo.js` T-027 là hàm thuần quyết định):
1. Người tạo luật chọn "Xếp hạng" (`rated:true`) và môn/cỡ cho phép (cờ vây chỉ 9×9).
2. **Cả hai** `accountReady` (khi bật Google). Khi tắt Google (`!auth.enabled`) thì `accountReady` luôn đúng nên xếp hạng được; đây là chế độ thử máy.
3. Kết thúc với `result` ∈ `a`, `b`, `draw` (không phải `abort`) và đã đủ `minPlies` (không thì `too-short`, hủy).
4. Cặp này (hai uid, thứ tự không quan trọng) chưa có **3 ván xếp hạng được tính Elo trong ngày** (`vnDay`) ở môn này.

"Bàn trong" xếp hạng như bàn thật. Hai người không thể tự đánh với chính mình (cùng uid).

### 8.3 Hạ xuống giao hữu

- Quá 3 ván/ngày/môn cho cặp: ván **tự thành giao hữu** và phải **báo trước khi bắt đầu**. Với **bàn ngồi**: `kd:table` có `note:'Hai bạn đã đủ 3 ván xếp hạng hôm nay ở môn này; ván này là giao hữu.'` ngay khi bàn đủ hai người và `rated:true` (ván chỉ bắt đầu khi cả hai `kd:ready`, nên `kd:table` đến trước). Với **ván ghép từ lời mời** (bắt đầu ngay khi `kd:respond accept`, `kd:table` đến sau `kd:start`): cùng câu đó nằm trong `downgraded` của `kd:invited` và của ack `kd:invite`, máy chủ tính lúc mời và tính lại lúc nhận lời. Ở cả hai đường, `kd:start` có `rated:false` và `downgraded` mang cùng câu đó. **(chốt ở T-020)**
- Một bên không đăng nhập mà bàn chọn "Xếp hạng": `kd:ready` của người đó trả `code:'login'` (không tự hạ).

### 8.4 Bộ đếm cặp trong ngày

Chỉ tính khi ván thực sự được tính Elo (hủy thì không tính); lưu ở `db.kydao.pairs` (mục 10), xóa khi sang ngày.

## 9. Bất biến bảo mật

1. **Cờ tướng úp: không gói tin nào chứa danh tính quân chưa lật** — gửi cho đối thủ, cho **chính người chơi**, cho người xem, trong `kd:start`, `kd:moved`, `kd:marks`, `kd:end`, ack `kd:resume`, hay bất kỳ log/thông báo nào. Danh tính chỉ lộ qua `reveal` (quân vừa lật khi đi hoặc bị ăn) và `final` (hết ván). `legalMoves`, `notation`, `view` không phụ thuộc danh tính quân úp.
2. Hạt giống (`seed`) và bảng danh tính quân úp **chỉ ở máy chủ**. `seed` ghi vào biên bản ván đã lưu (`db.kydao.games`) để tái dựng; không có API/sự kiện nào trả `db.kydao.games` ra trình duyệt (kể cả trang quản trị). Nếu sau này thêm API xem ván (admin hoặc "xem lại"), phải bỏ `seed` và danh tính chưa lật cho ván đang đấu.
3. **Không bao giờ gửi `uid`**: mọi gói tin dùng `pid`. Trường `from`/`a`/`b`/`seats` chỉ có `pid, name, look, elo…`. Mã cặp trong `pairs` dùng uid nhưng không rời máy chủ.
4. Người xem **không** gọi được `kd:move`, `kd:draw`, `kd:resign`, `kd:mark`, `kd:agree`, `kd:resume-play`: máy chủ kiểm `uid` thuộc ván. Người xem chỉ nhận `view()` (cờ vua, cờ tướng, vây, caro không có thông tin ẩn nên `view` = state đầy đủ).
5. `kd:move.ply` phải bằng `state.ply`; nước phải khớp regex môn (mục 3.3) **và** nằm trong `legalMoves` của state máy chủ. Trình duyệt không bao giờ quyết định kết quả: `kd:end` do máy chủ gửi.
6. Giờ là của máy chủ: không có sự kiện nào cho trình duyệt báo "tôi hết giờ" hay "đối thủ hết giờ".
7. Dữ liệu vào: kiểm kiểu, `hasOwn`, chuỗi ≤ 8 ký tự cho `move`/`point`; không tạo khóa từ chuỗi của người dùng (tránh prototype pollution; dùng `Object.create(null)` hoặc `Map` cho bảng theo id).
8. Tên người chơi là `p.name` đã qua `lib/moderation.js`. Bảng cờ gán chữ bằng `textContent`/`h()`, không `innerHTML`.
9. Chống cày: giới hạn 3 ván xếp hạng/cặp/ngày/môn; `minPlies`; không xếp hạng với chính mình; chỉ ván hai tài khoản đăng nhập. Không có thưởng công đức nên không có động cơ tiền.
10. Giới hạn: `KYDAO_MAX_GAMES` (mặc định 12) cho tổng ván đồng thời (bàn thật + bàn trong); 50 người xem/bàn; tối đa 3 lời mời chờ nhận/người; `bucket('kd', 5, 15)` cho mọi sự kiện; `maxHttpBufferSize` không đổi.
11. Test bắt buộc (T-028, T-030, T-024): quét **mọi** gói `kd:*` gửi tới bốn nhóm người nhận (hai người chơi, người xem, người ngoài) trong một ván cờ tướng úp dài; không gói nào được chứa chữ quân thật của ô còn úp; không gói nào chứa `uid`.

## 10. Lưu bền (`db.kydao`)

Khóa cấp cao mới: **thêm vào `fresh()` + `SECTIONS` + `adopt()` trong `lib/store-sections.js`** (AGENTS.md §3.11, thẻ T-029), nếu không PostgreSQL âm thầm bỏ mất.

```
db.kydao = {
  ratings: { [uid]: { name, [game]: { r, peak, peakAt, n, w, l, d, last } } },   // game ∈ chess|xiangqi|jieqi|go|gomoku; peak/peakAt null khi n < 20
  games:   [ { id, at, game, size?, rated, pace,
               a:{ uid, name, eloFrom, eloTo }, b:{ uid, name, eloFrom, eloTo },
               result, reason, moves:[ { m, r? } ] /* r = reveal { mover?, captured? } */, seed? } ],              // giữ 500 ván gần nhất; chỉ ván kết thúc
  active:  { [uid]: gameId },                                              // ván đang đấu, để báo "bị hủy" sau khi khởi động lại
  pairs:   { '<vnDay>|<uidA>|<uidB>|<game>': count }                       // làm phẳng thành một map (khớp kiểu map của store-sections); uidA < uidB theo chuỗi; mục có ngày cũ bị xóa khi ghi mục mới (T-029 chốt chi tiết)
}
```

- `games[]` lưu cả ván `abort`? **Không**: chỉ lưu ván có `result` ∈ `a`, `b`, `draw` (kể cả giao hữu). Ván hủy không có biên bản. **(chốt ở T-020)**
- `eloFrom/eloTo` là `null` với ván giao hữu.
- `seed` chỉ có ở `jieqi`.
- `ratings[uid].name` là tên gần nhất (đã qua `lib/moderation.js`, lấy từ `p.name`), để Epic DH hiện được người giữ danh hiệu khi họ vắng và biên bản đã bị cắt khỏi 500 ván. Ghi mỗi khi một ván của người đó **được tính Elo** (cùng lúc cập nhật `ratings`); chỉ đọc tên bằng `hasOwn`, đặt tên các môn bằng danh sách cố định (không duyệt khóa của `ratings[uid]` để tìm môn, vì có khóa `name`).
- Hợp nhất khách → tài khoản **(chốt ở T-020)**. `linkGuest` nằm ở `server.js` (như KH §6.2), gọi theo thứ tự, tất cả đồng bộ trong cùng một nhịp (không `await` xen giữa):
  1. `manager.dropUser(guest)`: hủy ván đang đấu của khách (`kd:end` `result:'abort'`, `reason:'account'`, không Elo, không biên bản), đứng dậy khỏi ghế (phát `kd:table`), đóng lời mời đang chờ gửi/nhận của khách (`kd:invite:closed` `reason:'left'`), bỏ khách khỏi phòng xem, rồi xóa `active[guest]`. Nếu khách và tài khoản cùng ngồi một bàn thì việc dọn ghế khách làm trước, không có xung đột.
  2. `mergeKydaoGuest(db, guest, uid)` trong `lib/account.js`: với mỗi môn giữ bản ghi có `n` lớn hơn (không cộng điểm hai bản; hòa `n` thì giữ bản của tài khoản); `name` giữ của tài khoản, nếu tài khoản chưa có thì lấy của khách; rồi xóa `ratings[guest]`. Trả hàm hoàn tác.
  3. Nếu `store.flush()` lỗi thì chạy hoàn tác của bước 2. Bước 1 **không** hoàn tác: ván đã hủy vốn không tính gì, và socket khách bị ngắt ngay sau khi liên kết, nên không còn chỗ nào để khôi phục. Người chơi vào lại bằng uid tài khoản thấy `kd:resume` → `start:null`.
  T-029 viết `mergeKydaoGuest` và test; T-030 viết `dropUser` và nối vào `linkGuest`.
- Tính danh hiệu cờ (Epic DH) đọc `ratings`: "hiện tại" = `r` đang có, "lịch sử" = `peak` (chỉ người có `n ≥ 20`).
- `getActive(uid)` / `setActive(uid, gameId|null)` trong `deps` của manager đọc/ghi `db.kydao.active`; `saveGame(record)` đẩy vào `games` rồi cắt còn 500.

## 11. Cấu hình

| Biến môi trường | Mặc định | Ý nghĩa |
|---|---|---|
| `KYDAO_ENABLED` | bật (`!== '0'`) | tắt thì mọi `kd:*` trả `code:'off'`; không vẽ bàn |
| `KYDAO_MAX_GAMES` | 12 | tổng ván đồng thời (bàn thật + bàn trong) |
| `KYDAO_TIME_SCALE` | 1 | nhân mọi khoảng thời gian (thử nhanh: 0.05) |

`/api/config` thêm `kydao: { enabled, loginRequired }`. **(chốt ở T-020)** README "Cấu hình" ghi ba biến này khi T-030 làm.

## 12. Điểm phải đồng bộ bằng tay và test

| Giá trị | Nơi 1 | Nơi 2 |
|---|---|---|
| `YARD_TABLES` | `server.js` | `public/js/hall.js` (test chống lệch ở `test/sync-constants.test.js`, T-005 mở rộng) |
| Hằng số nhịp/Elo/`minPlies` | `lib/kydao/registry.js`, `elo.js` | bảng ở mục 2 và 8 của tài liệu này; giao diện bảng cờ (nhãn nhịp) |
| Regex nước đi | `lib/kydao/registry.js` | mục 3.3 |
| Giao thức `kd:*` | `server.js`, `lib/kydao/manager.js`, `public/js/kydao-ui.js` | tài liệu này; `docs/agents/ARCHITECTURE.md` §4 |
| Cache trình duyệt | file `public/js/kydao*.js`, `public/css/kydao.css` | `?v=` trong `public/index.html` |
| Khóa dữ liệu cấp cao | `db.kydao` | `fresh()` + `SECTIONS` + `adopt()` trong `lib/store-sections.js` |

Test cần có (mỗi thẻ làm phần của mình): perft từng module (`test/kydao-*.test.js`, `PERFT_DEEP=1` cho độ sâu lớn), manager với đồng hồ giả (`makeClock`), `test/e2e-kydao.test.js` (hai client thật qua `test/helpers/live.js`), quét gói tin cờ tướng úp (mục 9.11), ui-harness `tools/ui-harness/kydao/` (T-035).
