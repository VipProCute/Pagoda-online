# Kế hoạch đợt Pháp Tướng 3D · đài sen, hào quang bao phủ, quỷ hộ thân

> Lập ngày 2026-11-14 theo yêu cầu chủ dự án: dựng lại đài sen, quỷ theo sau, hào quang bao phủ thành **hình khối 3D thật**; quỷ theo sau phải có cảm giác như một "linh thể hộ thân" đứng sau lưng chủ (kiểu stand).
> Thẻ việc: T-140 → T-153 trong [task.md](../task.md). Quy trình: [agents/ORCHESTRATION.md](agents/ORCHESTRATION.md). Nền 3D có sẵn: [KE-HOACH-3D.md](KE-HOACH-3D.md).

## 0. Đọc nhanh

- **Hiện trạng: chưa có bản 3D thật.** Khi bật 3D, nhân vật là khối 3D nhưng đài sen, quang bối, quỷ, pháp tướng vẫn là **ảnh 2D dán lên tấm phẳng luôn quay về máy quay** (`THREE.Sprite` trong `public/js/world3d/avatar.mjs`, hàm `imageEffect` và `canvasEffect`). Thẻ T-100 cố ý làm vậy để giữ đủ dấu ấn 2D. Xoay máy quay thì thấy rõ: quỷ không có lưng, đài sen không có chiều sâu, hào quang không ôm lấy người.
- **Đích đến:** mỗi hiệu ứng là lưới 3D có vật liệu phát sáng riêng, nhìn được từ mọi phía, có chuyển động riêng. Ảnh 2D cũ **giữ lại** làm dự phòng (máy yếu, nhân vật ở xa, tệp `.glb` lỗi).
- **Không đổi máy chủ, không đổi giao thức.** Điều kiện hiện vẫn lấy từ `AURA.TIERS` (9 bậc cúng dường), `MERIT.RANKS` (6 pháp tướng công đức), `MERIT.visualDemonOf(mt)` (4 cấp quỷ + độ rõ `alpha`). Lớp 3D chỉ đọc `state.aura`, `state.meritRank`, `state.demon`.
- **Bản 2D không đổi** trong đợt này. Thẻ T-152 (tùy chọn) mới chụp lại ảnh 2D từ mô hình 3D cho đồng nhất.
- **Làm bản mẫu trước, chủ dự án duyệt, rồi mới làm hàng loạt.** Bản mẫu: Ma Vương (cấp 4) + đài sen vàng + vỏ hào quang bậc 5, xem trên NPC Hắc Phong Ma Khách.

## 1. Định hướng mỹ thuật

### 1.1 Quỷ hộ thân (linh thể)

Ý chính: quỷ không phải con vật chạy theo. Nó là **một phần của chủ**, mọc ra từ bóng của chủ, lơ lửng sau vai, nửa thân dưới tan thành khói lửa. Thiết kế riêng của Chùa Tâm An, dựa trên bốn hình 2D đang có (`public/img/fx/demon-1..4.webp`), không phỏng theo nhân vật của tác phẩm nào.

| Cấp | Tên | Dáng | Cao | Chỗ đứng (so với chủ) | Điểm nhấn |
|---|---|---|---|---|---|
| 1 | Tiểu Quỷ | quỷ con đầu to, mắt vàng, đuôi khói đỏ | 0,45 m | ngồi vắt vẻo trên vai trái | tinh nghịch, hay thò đầu nhìn |
| 2 | Ác Quỷ | nửa thân, sừng cong, cánh dơi, vuốt | 1,3 m | sau vai trái, cao ngang đầu | cánh đập chậm |
| 3 | Quỷ Vương | nửa thân, vương miện sừng, giáp vai | 1,9 m | chính giữa sau lưng, nhô trên đầu | lửa tím đen quấn quanh |
| 4 | Ma Vương | nửa thân khổng lồ, ba mắt, hai tay xòe ôm lấy chủ | 2,8 m | chính giữa sau lưng, trùm lên chủ | mắt thứ ba, vết nứt dung nham sáng |

Quy tắc hình khối chung:
- **Nửa thân trên có khối đầy đủ** (đầu, sừng, ngực, vai, tay, bàn tay). **Từ thắt lưng trở xuống tan thành đuôi khói** nối về gót chân chủ. Không có chân: đỡ tốn tam giác, đỡ xuyên sàn, đúng chất linh thể.
- **Bán trong suốt có viền sáng.** Giữa thân tối, mép sáng lên theo góc nhìn (Fresnel). `state.demon.alpha` (0,12 → 1) điều khiển độ đặc: công đức vừa âm thì chỉ thấy bóng mờ và hai con mắt, tới −100 mới rõ hẳn.
- **Mắt và vết nứt luôn phát sáng**, không phụ thuộc đèn cảnh, để ban đêm ở Sân chùa vẫn nổi.
- Bảng màu giữ đúng 2D: đỏ thẫm `#5a1418`, dung nham `#ff7a1a`, mắt `#ffc23a`, lửa cấp 3 tím đen `#3a1450` / `#8a3cff`.

Hành vi (đây là phần tạo cảm giác "stand"):

| Tình huống của chủ | Quỷ làm gì |
|---|---|
| Vừa hiện (vào cảnh, công đức vừa âm, đổi cấp) | **Trồi lên** từ vũng bóng dưới chân chủ trong 0,9 giây, khói xoáy, rồi vào tư thế chờ |
| Đứng yên | Lơ lửng, thở, khoanh tay (cấp 2, 3) hoặc xòe tay ôm (cấp 4); 8 đến 14 giây một lần làm một động tác phụ (gầm không tiếng, nghiêng đầu, vươn vuốt) |
| Đi | Trễ nhịp sau chủ (lò xo), thân ngả về trước 12°, đuôi khói kéo dài |
| Quay người | Quỷ quay theo trễ 0,25 giây, nhìn cùng hướng với chủ |
| Vái (`state.bow > 0`) | Quay mặt đi, khoanh tay, ra vẻ không phục (hợp câu thoại NPC "quỷ sợ ăn chay") |
| Đang nói (`state.talk` hoặc có bong bóng chat) | Thò đầu qua vai chủ nhìn |
| Ngồi | Hạ thấp theo, cấp 1 ngồi lên đầu gối chủ |
| Hết quỷ (công đức về ≥ 0) | Tan thành khói trong 0,6 giây, bị hút xuống bóng |
| Giảm chuyển động | Một tư thế tĩnh, không hạt, không trồi/tan (hiện, ẩn tức thì) |

Động tác phụ chọn theo hạt giống `id nhân vật + floor(now / 10 giây)`, nên mọi máy thấy gần giống nhau mà không cần máy chủ gửi thêm gì.

### 1.2 Đài sen

- Lưới 3D thật: **ba tầng cánh** (16 cánh ngoài, 12 cánh giữa, 8 cánh trong), gương sen ở giữa, đế tròn mỏng. Nhân vật đứng (hoặc ngồi thiền) **trên gương sen**, chân không xuyên cánh.
- Ba biến thể theo bậc, **chung một lưới, khác vật liệu**: sen vàng (bậc 2 đến 7, kim loại ấm), sen hồng (bậc 8, cánh trong mờ như ngọc), sen pha lê ngũ sắc (bậc 9, đổi màu theo góc nhìn).
- **Nở sen:** lúc hào quang vừa bật hoặc lên bậc, ba tầng cánh xòe ra lần lượt trong 1,2 giây. Mỗi tầng là một nút riêng trong `.glb`, mã chỉ xoay và co giãn nút, không cần xương.
- Nhịp thở: cánh nhấp nhô rất nhẹ, mép cánh sáng lên rồi dịu xuống (giữ nhịp `pulse` của 2D). Đốm sáng bay lên từ gương sen (mức Vừa trở lên).

### 1.3 Hào quang bao phủ (9 bậc cúng dường)

Cốt lõi là **vỏ khí**: một lưới hình trứng ôm quanh người, vật liệu lửa trong suốt cộng sáng, đỉnh lưới bị đẩy lên theo nhiễu nên mép trên bập bùng như ngọn lửa. Nhìn từ hướng nào cũng thấy khí ôm lấy thân, chứ không còn là tấm ảnh sau lưng.

| Bậc | Tên | Thành phần 3D (cộng dồn từ bậc dưới) |
|---|---|---|
| 1 | Luyện Khí | vỏ khí mỏng màu `#bfe6d4` + 3 dải khí lành (dải ruy băng) bay vòng quanh thân, vòng thật trong không gian nên có lúc che trước, có lúc khuất sau |
| 2 | Trúc Cơ | + đài sen vàng (§1.2) + đốm sáng bay lên |
| 3 | Kim Đan | + viên kim đan phát sáng ở đan điền + vầng sáng sau đầu (nâng cấp `hao-quang.glb`: viền cánh sen, xoay chậm) |
| 4 | Nguyên Anh | + nguyên anh (hình người tí hon phát sáng) bay vòng quanh, có vệt đuôi + tia sáng tỏa |
| 5 | Hóa Thần | vỏ khí chuyển thành thần quang xanh bốc cao như lửa (vỏ hai lớp, lớp ngoài cao hơn đầu) |
| 6 | Luyện Hư | + quang bối sau lưng dạng đĩa chạm nổi, bên trong là trời sao có chiều sâu (thị sai) |
| 7 | Hợp Thể | + năm viên ngũ hành châu bay quỹ đạo nghiêng quanh thân |
| 8 | Đại Thừa | + cột sáng vàng từ đài sen lên trời + sen hồng + cánh sen rơi (vẽ theo lô) |
| 9 | Độ Kiếp | + tia sét giáng xuống theo nhịp (lưới gấp khúc đổi hình) + sen pha lê ngũ sắc |

Màu vỏ khí lấy từ `state.aura.color` (màu bậc), mờ dần 20 giây cuối như đang có.

### 1.4 Pháp tướng công đức (6 bậc, làm sau bản mẫu)

Vòng linh quang, vương miện sen pha lê, đôi cánh lửa, bánh xe kiếm, pháp luân rồng, thánh luân chín tầng: đều thành lưới 3D đặt sau đầu hoặc sau lưng, xoay thật trong không gian. Cánh lửa có hai xương mỗi bên để vỗ.

## 2. Kỹ thuật

### 2.1 Bố cục mã (tránh tranh chấp file nóng)

`avatar.mjs` là file nóng. Chỉ **một** thẻ (T-144) được chạm nó, để gắn một điểm nối. Mọi thứ còn lại nằm trong thư mục mới:

```
public/js/world3d/fx3d/
  index.mjs      createFx3d(host, opts) → { update(state, dt, ctx), covers, setQuality, dispose }
  assets.mjs     nạp .glb dùng chung (bộ đệm theo URL, đếm tham chiếu), lỗi thì trả null
  materials.mjs  spiritMaterial (linh thể), flameShellMaterial (vỏ khí), glowMaterial (phát sáng)
  demon.mjs      quỷ hộ thân: mô hình + bộ điều khiển hành vi
  lotus.mjs      đài sen 3 biến thể, nở sen
  aura.mjs       vỏ khí và thành phần theo bậc 1..9
  merit.mjs      pháp tướng công đức 6 bậc
  budget.mjs     chia suất 3D theo khoảng cách và mức chất lượng
public/js/stand-math.js   UMD thuần (test bằng node): lò xo bám theo, chọn tư thế, chọn động tác phụ, chia suất
public/models/fx/         demon-1..4.glb, lotus.glb, aura-kit.glb, merit-kit.glb
tools/blender/fx/         build_demon.py, build_lotus.py, build_aura.py, build_merit.py, README.md
public/world3d-fx.html    trang thử: chọn cấp quỷ, bậc hào quang, pháp tướng, mức chất lượng, xoay máy quay
```

Hợp đồng giữa `avatar.mjs` và `fx3d` (T-141 định nghĩa, T-144 nối):

```js
// host: các nút có sẵn của nhân vật
const fx = createFx3d({ group, rig, head }, { quality, reducedMotion, assets });
// mỗi khung hình, sau khi avatar tính xong tier/rank/demon:
fx.update({ tier, color, fade, rank, demon: { n, alpha }, walking, yaw, bow, sit, talk, id, now }, dt,
          { distance, isSelf, slot });           // slot: true nếu nhân vật này được cấp suất 3D
// fx.covers = { demon, lotus, aura, merit }: true khi phần đó ĐÃ nạp xong và đang vẽ bằng 3D.
// avatar.mjs: phần nào covers = true thì bỏ qua sprite của phần đó; false thì vẽ sprite như cũ.
```

Nhờ `covers`, mỗi thẻ sau bật thêm một phần mà không sửa lại `avatar.mjs`, và tệp `.glb` lỗi thì tự rơi về ảnh 2D.

### 2.2 Vật liệu

- **Linh thể (`spiritMaterial`)**: `MeshStandardMaterial` + `onBeforeCompile`. Thêm: viền Fresnel `pow(1 - dot(N, V), 2.5)` nhân màu viền; phần phát sáng lấy từ kênh màu đỉnh thứ hai (mắt, vết nứt); **tan theo chiều cao** `smoothstep(y0, y1, worldY + noise)` để nửa dưới thành khói; `opacity = alpha`. `transparent: true`, `depthWrite: false`, vẽ hai lượt (mặt sau rồi mặt trước) để không lộ ruột.
- **Vỏ khí (`flameShellMaterial`)**: `ShaderMaterial` cộng sáng. Đỉnh: đẩy theo pháp tuyến bằng nhiễu cuộn lên trên, biên độ tăng theo chiều cao. Mảnh: `alpha = fresnel × dải nhiễu × (1 - chiều cao)`. Nhiễu lấy từ một ảnh nhiễu 64×64 sinh bằng mã (không tải tệp).
- **Phát sáng (`glowMaterial`)**: `MeshBasicMaterial` cộng sáng, `toneMapped: false`, cho kim đan, châu, cột sáng, tia sét.
- Mức Cao bật thêm hạt (`THREE.Points`, tối đa 48 hạt mỗi nhân vật). Không dùng hậu kỳ bloom (nặng cho điện thoại); độ rực làm bằng lớp vỏ cộng sáng.
- Giới hạn Node 22 không liên quan (mã chạy trên trình duyệt), nhưng `stand-math.js` phải chạy được bằng `node --test`.

### 2.3 Dựng mô hình (Blender)

Theo dây chuyền đã có ở `tools/blender/avatar/build.py` và `tools/blender/kydao/`: **mọi mô hình sinh bằng kịch bản Python**, không lưu `.blend`, không sửa tay `.glb`, hạt giống cố định.

- Quỷ: dựng khối thô bằng metaball/skin modifier theo bảng xương, remesh, decimate tới ngân sách, tô màu đỉnh (màu da ở `COLOR_0`, mặt nạ phát sáng ở `COLOR_1`), gắn xương, bake clip.
- **Một bộ xương chung cho quỷ cấp 2, 3, 4**: `root, spine, chest, neck, head, jaw, shoulder.L/R, upper_arm.L/R, forearm.L/R, hand.L/R, wing.L/R (chỉ cấp 2), tail1..3 (đuôi khói)`. Cấp 1 có bộ xương rút gọn. Chung xương thì clip viết một lần.
- Clip: `emerge` (0,9 s), `idle` (lặp 4 s), `drift` (lặp, lúc chủ đi), `scoff` (lúc chủ vái), `peek` (lúc chủ nói), `taunt1`, `taunt2`, `vanish` (0,6 s).
- Blender 5.3.0 của chủ dự án ở `H:\blender.exe` (không nằm trên PATH). Cách chạy chính là không giao diện: `H:\blender.exe -b --python-expr "import runpy; runpy.run_path(r'<repo>/tools/blender/fx/build_demon.py', init_globals={...})"`. Cần xem tận mắt trong Blender thì dùng Blender MCP (chủ dự án đã bật sẵn add-on).

### 2.4 Ngân sách

| Tài nguyên | Tam giác | `.glb` | Ghi chú |
|---|---|---|---|
| Tiểu Quỷ | ≤ 1.200 | ≤ 120 KB | |
| Ác Quỷ | ≤ 2.400 | ≤ 200 KB | có cánh |
| Quỷ Vương | ≤ 3.000 | ≤ 240 KB | |
| Ma Vương | ≤ 4.000 | ≤ 300 KB | |
| Đài sen | ≤ 900 | ≤ 60 KB | 3 biến thể chung lưới |
| Bộ hào quang (`aura-kit.glb`) | ≤ 1.500 tổng | ≤ 90 KB | vỏ khí, quang bối, vầng sáng, nguyên anh |
| Bộ pháp tướng (`merit-kit.glb`) | ≤ 3.000 tổng | ≤ 180 KB | 6 bậc |

Tất cả nạp lười: chỉ tải khi trong cảnh có người đang mang hiệu ứng đó.

Suất 3D theo mức chất lượng (nhân vật ngoài suất dùng ảnh 2D như hiện nay):

| Mức | Quỷ 3D | Hào quang 3D | Hạt | Vỏ khí |
|---|---|---|---|---|
| Thấp | mình + 2 người gần nhất | mình + 2 | tắt | một lớp, không đẩy đỉnh |
| Vừa | mình + 6 | mình + 8 | tắt | hai lớp |
| Cao | mình + 12 | tất cả trong 25 m | bật | hai lớp + hạt |

Đích hiệu năng: 60 nhân vật trên màn, 10 người có quỷ, 10 người có hào quang, mức Thấp vẫn ≥ 30 khung hình/giây trên máy thử (số đo ghi trong bàn giao T-150).

### 2.5 Kiểm thử

- `test/stand-math.test.js`: lò xo hội tụ, không vọt quá 15%; chọn tư thế đúng thứ tự ưu tiên (ngồi > vái > nói > đi > đứng); động tác phụ ổn định theo hạt giống; chia suất đúng số lượng, luôn có mình.
- `test/world3d-fx.test.js`: `createFx3d` với `assets` giả; `.glb` trả `null` thì `covers` giữ `false` và không ném lỗi; `dispose` giải phóng hết geometry, material; giảm chuyển động thì không tạo hạt.
- `test/world3d-avatar.test.js` (có sẵn): thêm ca "covers.demon = true thì sprite quỷ ẩn; false thì sprite hiện như cũ".
- Ảnh chụp: `tools/ui-harness` cho 3D (T-092) chụp `/world3d-fx.html` ở 4 góc × 4 cấp quỷ × 3 mức chất lượng.

## 3. Điều phối và mô hình

Danh sách đo qua `GET /v1/models` của CLIProxyAPI ngày 2026-11-14. Có trong danh sách: `gpt-6.1-sol`, `gpt-6.1-terra`, `gpt-6-luna`, `gpt-6-astra`, `gemini-4-hydrogen-xhigh`, `gemini-4-argon-high`, `gemini-3.8-flash-high`, `gemini-3-flash`, `gemini-3.5-flash-lite`, các mô hình ảnh `gpt-image-2.6`, `gemini-3.1-flash-image`. **Không thấy mô hình nào tên "carbon"** trong danh sách; nếu chủ dự án thêm tài khoản thì bổ sung sau. `gemini-4-hydrogen-xhigh` chưa từng chạy vòng agent qua Codex CLI: T-140 thử trước một lượt ngắn.

| Vai | Mô hình | Việc trong đợt này |
|---|---|---|
| Điều phối | **Claude Opus 5.5** | chia thẻ, viết đặc tả từng thẻ (`docs/phap-tuong/T-xxx-DAC-TA.md`), chạy lại test, chạy kịch bản Blender, xem ảnh thật, gộp |
| Thợ khó | **gpt-6.1-sol** | khung `fx3d`, vật liệu shader, kịch bản Blender dựng quỷ, nối `avatar.mjs` |
| Thợ vừa | **gpt-6.1-terra** | `stand-math.js`, `demon.mjs` (hành vi), `lotus.mjs`, `aura.mjs`, `merit.mjs` |
| Thợ dễ | **gpt-6-luna**, gpt-6-astra | trang thử, `budget.mjs`, ui-harness, NOTICE, tăng `?v=` |
| Ý tưởng hình | **gpt-image-2.6** (dự phòng `gemini-3.1-flash-image`) | bảng ý tưởng: mỗi hiệu ứng một tấm trước / nghiêng / sau, làm chuẩn cho người dựng |
| Soát hình | **gemini-4-hydrogen-xhigh**, dự phòng `gemini-4-argon-high` | so ảnh render với bảng ý tưởng và ảnh 2D gốc, chấm theo phiếu (hình khối, màu, đọc được ở cỡ nhỏ) |
| Tài liệu | gemini-3.8-flash-high | README, Sổ tay, mô tả trong bảng mốc |
| Soát mã | khác thợ: gpt-6.1-sol soát thẻ terra/luna; gemini-4-argon-high (chỉ đọc) soát thẻ sol | checklist ORCHESTRATION §7 |
| Dự phòng | Claude Sonnet 5.5 (có Blender MCP) → Haiku 5.5 (việc nhỏ) | khi thợ ngoài kẹt quá 2 vòng hoặc hết hạn mức; riêng việc cần thao tác Blender trực tiếp |

Cách chạy thợ: `codex exec -m <model> -c model_provider=cliproxy … --sandbox workspace-write -C <worktree> - < prompt.txt` (chi tiết ở KE-HOACH-3D §4). Hộp cát Codex trên Windows không chạy được `node` con và không ghi được `.git`: **Điều phối tự chạy `npm run check`, test, Blender và commit thay thợ.** Thợ GPT chạm hạn mức sau khoảng 4 thẻ + 1 lượt soát mỗi cửa sổ: xếp lịch theo đó, thẻ nào kẹt thì chuyển Gemini Flash hoặc Sonnet.

Vòng dựng hình cho mỗi mô hình (tối đa 3 vòng, quá thì chuyển Sonnet + Blender MCP):
1. Thợ viết hoặc sửa kịch bản `tools/blender/fx/build_*.py` theo đặc tả và bảng ý tưởng.
2. Điều phối chạy kịch bản, xuất `.glb` và ảnh 4 góc (trước, nghiêng 45°, ngang, sau) vào thư mục tạm.
3. Mô hình soát hình chấm theo phiếu, trả danh sách sửa cụ thể (bộ phận nào, sai gì, số đo).
4. Đạt thì ghi ảnh thật vào `docs/phap-tuong/anh/`; chưa đạt thì quay lại bước 1 kèm danh sách sửa.

## 4. Lịch theo đợt và khóa vùng nóng

| Đợt | Thẻ | Song song được không | Vùng nóng |
|---|---|---|---|
| 0a | T-140 bảng ý tưởng · T-141 khung `fx3d` · T-143 `stand-math.js` | cả ba song song | file mới |
| 0b | T-142 bản mẫu Ma Vương + sen vàng + vỏ khí bậc 5 (Blender) | sau T-140 | file mới |
| 0c | T-144 nối vào `avatar.mjs` sau công tắc `ta-fx3d` → **👤 chủ dự án duyệt bản mẫu** | sau T-141, T-142, T-143 | **`avatar.mjs`**, `index.html` (`?v=`) |
| 1 | T-145 quỷ cấp 1, 2, 3 · T-146 đài sen đủ 3 biến thể · T-147 hào quang bậc 1–5 · T-148 hào quang bậc 6–9 · T-149 pháp tướng công đức | song song (mỗi thẻ một file trong `fx3d/`); T-148 sau T-147 vì chung `aura.mjs` | `fx3d/aura.mjs` |
| 2 | T-150 chia suất, mức chất lượng, đo hiệu năng | sau đợt 1 | `fx3d/index.mjs`, `budget.mjs` |
| 3 | T-151 bật mặc định, ảnh chụp, Sổ tay, README, NOTICE · T-153 nghiệm thu chéo | T-153 sau T-151 | `index.html`, `README.md` |
| tùy chọn | T-152 chụp lại ảnh 2D từ mô hình 3D | 👤 quyết | `public/img/fx/*` (file sinh bởi công cụ) |

Trước khi bắt đầu T-144 phải chốt T-100 (đang 🟣 Chờ soát, cùng chạm `avatar.mjs`).

## 5. Rủi ro

| Rủi ro | Cách giảm |
|---|---|
| Quỷ dựng bằng mã trông thô, thua hình 2D vẽ tay | bản mẫu Ma Vương duyệt trước; vòng soát hình 3 lượt; linh thể bán trong suốt + viền sáng + khói che bớt chi tiết thô; chưa đạt thì giữ sprite cho cấp đó |
| Nhiều lớp trong suốt chồng nhau vẽ sai thứ tự | `depthWrite: false`, `renderOrder` cố định: vỏ sau → quỷ → nhân vật → vỏ trước → hạt; kiểm bằng ảnh chụp 4 góc |
| Điện thoại yếu | suất 3D theo mức; nạp lười; ngoài suất dùng ảnh 2D; tự hạ mức sẵn có của World3D |
| Quỷ che mất nhân vật, nhãn tên, người đứng sau | quỷ đứng sau lưng theo hướng nhân vật; Ma Vương mờ dần khi máy quay ở gần hơn 2 m; nhãn tên vẽ sau cùng |
| Góc nhìn thứ nhất: quỷ của mình che màn hình | ẩn hiệu ứng của chính mình ở góc nhìn thứ nhất, giống thân nhân vật |
| Thợ sửa lan sang `avatar.mjs` | chỉ T-144 được chạm; các thẻ khác ghi rõ "không chạm `avatar.mjs`", Điều phối xem diff |
| Ảnh ý tưởng do AI sinh | chỉ dùng làm tham chiếu nội bộ trong `docs/phap-tuong/anh/`, ghi vào `public/img/NOTICE.txt` nếu có ảnh nào vào `public/`; không đưa hình nhân vật của tác phẩm khác vào lời nhắc |

## 6. Quyết định chờ chủ dự án

| # | Câu hỏi | Mặc định nếu không trả lời |
|---|---|---|
| D1 | Bản mẫu là Ma Vương (cấp 4), xem trên NPC Hắc Phong Ma Khách? | Có |
| D2 | Quỷ chỉ nửa thân trên, dưới tan thành khói (không có chân)? | Có |
| D3 | Lúc chủ vái, quỷ quay mặt đi cho vui? | Có |
| D4 | Làm luôn pháp tướng công đức 6 bậc (T-149) trong đợt này? | Có, sau khi duyệt bản mẫu |
| D5 | Chụp lại ảnh 2D từ mô hình 3D (T-152)? | Chưa, để sau |
| D6 | Đường dẫn `blender.exe` | Đã có (14/11): `H:\blender.exe`, bản 5.3.0, Blender MCP đã bật |
