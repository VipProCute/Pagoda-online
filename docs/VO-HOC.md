# Võ học: tu luyện nội công, học chiêu, luận võ

Tài liệu cho người quản trị nhà chùa và người phát triển. Phần giao thức kỹ thuật ở [VO-HOC-GIAO-THUC.md](VO-HOC-GIAO-THUC.md), số liệu cân bằng ở [VO-HOC-CAN-BANG.md](VO-HOC-CAN-BANG.md), cách bật lưu trữ bền ở [NEON.md](NEON.md).

## Ba nơi, không lẫn nhau

| Nơi | Làm gì |
|---|---|
| **Chánh điện** | Cúng, thắp nhang, tụng kinh, trò chuyện. Không có đánh nhau. Không ai bị mời đấu hay bị kéo vào đấu ở đây. |
| **Võ Học Các** | Tu luyện nội công, học chiêu, chọn bộ 4 chiêu mặc định. |
| **Sân đấu** | Nơi duy nhất luận võ 1 đấu 1. Người chơi tự ra sân; chỉ người đang ở sân mới thấy và mời được nhau. |

Thanh đổi map ở góc trên cảnh có nút **Sân đấu** (ẩn khi `PK_ENABLED=0`; cần đăng nhập). Võ Học Các vào bằng cách chạm kệ Võ học ở Tàng Kinh Các. Ngoài thanh nút lễ Phật, cả hai nơi còn có thẻ ở tab **Nơi khác** (cho màn hình nhỏ nút bị che). Người đang có trận dở mà tải lại trang sẽ được đưa thẳng về Sân đấu. Người đi sang nơi khác thì nhân vật không hiện trong chánh điện. Máy chủ từ chối mọi sự kiện đấu nếu người gửi không ở sân đấu. Người chỉ muốn viếng chùa không cần biết đến phần này (nút "Võ học các" và "Sân đấu" nằm cuối thanh nút, tắt được bằng `MARTIAL_ENABLED=0`).

Khi nhà chùa muốn thêm nơi mới (coi bói tử vi, tarot…): thêm tên vào `PLACES` trong `server.js`, viết một module có `init / mount / show / hide` rồi `Places.register(tên, { el, mod })` trong `app.js`. Lưu ý: xin xăm, thầy Tử vi và thầy Tarot đã có sẵn ở **sân chùa**, là một *cảnh* trong chính khung chánh điện (đi bằng nút "Sân chùa" của thanh đổi map), khác với các *nơi* của tài liệu này. Hai thứ sống chung: `scene` (chánh điện / sân chùa) và `place` (chánh điện / Võ Học Các / Sân đấu). Đi sang Võ Học Các hoặc Sân đấu thì tự rời hàng chờ xin xăm. Nếu sau này muốn coi bói thành một nơi riêng thì dùng cơ chế `PLACES` ở trên.

## Tu luyện nội công

- Mỗi người có **công lực** (tối đa 3.000), **cấp nội công** 1–10 theo công lực, và **tâm đắc** ba nhánh Cương / Tốc / Nhu (mỗi nhánh tối đa 300).
- Chọn công pháp và thời lượng, bấm bắt đầu. **Có thể đóng web**: giờ do máy chủ ghi, hết giờ máy chủ tự cộng kết quả. Mỗi người một phiên tại một thời điểm. Hủy phiên là mất hết tiến độ phiên đó.
- Cấp nội công tăng **nội lực tối đa** (80 ở cấp 1, thêm 4 mỗi cấp, 116 ở cấp 10), lực đánh (+4% mỗi cấp sau cấp 1) và giảm sát thương nhận (+1,5 điểm phần trăm mỗi cấp). HP luôn 200. Phá Sơn gây sát thương chuẩn nên bỏ qua cả giảm sát thương từ nội công.

| Cấp | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|---|---|---|---|---|---|---|---|---|---|---|
| Công lực từ | 0 | 60 | 150 | 300 | 500 | 800 | 1.200 | 1.700 | 2.300 | 3.000 |
| Nội lực tối đa | 80 | 84 | 88 | 92 | 96 | 100 | 104 | 108 | 112 | 116 |

| Công pháp | Cần cấp | Thời lượng → công lực | Tâm đắc | Hoàn thành ngay |
|---|---|---|---|---|
| Tĩnh Tâm Quyết | 1 | 15 phút → 5 · 1 giờ → 15 · 4 giờ → 45 | không | 10.000đ |
| Kim Cương Tâm Pháp (Cương) | 2 | 1 giờ → 15 · 4 giờ → 50 · 8 giờ → 85 | Cương bằng công lực | 20.000đ |
| Phi Yến Tâm Pháp (Tốc) | 2 | như trên | Tốc bằng công lực | 20.000đ |
| Nhu Thủy Tâm Kinh (Nhu) | 2 | như trên | Nhu bằng công lực | 20.000đ |
| Cửu Âm Tâm Kinh | 5 | 4 giờ → 70 · 8 giờ → 120 | mỗi nhánh 25% công lực | 50.000đ |
| Vô Cực Chân Kinh | 8 | 8 giờ → 170 · 12 giờ → 230 | mỗi nhánh 30% công lực | 100.000đ |

Đạt trần công lực hoặc tâm đắc thì phần dư không cộng thêm, nên tu luyện không làm chỉ số tăng vô hạn. Phiên dài hiệu quả mỗi giờ thấp hơn, để người bận (một phiên qua đêm) vẫn tiến bộ. Số liệu nằm trong `public/js/martial.js`.

## 15 chiêu, ba nhánh, không khóa phái

Ai cũng học được cả ba nhánh. Điều kiện học theo bậc; học xong dùng ngay, không tốn thêm thời gian hay tiền.

| Bậc | Điều kiện | Cương | Tốc | Nhu |
|---|---|---|---|---|
| Nhập môn | có ngay | Trọng Quyền, Thiết Bích | Tật Phong Quyền, Ảnh Bộ Hộ Thân | Liễu Diệp Chưởng, Nhu Vân Bộ |
| Sơ cấp | cấp 3 + 40 tâm đắc nhánh | Kim Chung Tráo | Khinh Thân Bộ | Tá Lực Hóa Giải |
| Trung cấp | cấp 5 + 120 tâm đắc nhánh | Phản Chấn | Liên Hoàn Cước | Tiếp Kình Phản Chưởng |
| Cao cấp | cấp 7 + 250 tâm đắc nhánh | Tụ Lực Phá Sơn | Đoạt Ảnh Phản Kích | Tứ Lạng Bạt Thiên Cân |

Chi tiết từng chiêu (nội lực, tốc độ, sát thương, hiệu ứng) hiển thị ngay trong Võ Học Các từ `public/js/martial.js`. Quan hệ Cương – Tốc – Nhu là quan hệ giữa **nhóm chiêu và lối chơi**, không phải hệ nhân vật: không có cộng sát thương theo "hệ". Lợi thế đến từ tốc độ, nội lực, sát thương và cơ chế từng chiêu.

### Độ thành thạo từng chiêu

Học xong ở bậc Tiếp xúc da lông; chọn **Luyện chiêu này** hoặc chọn chiêu trong tab Tâm pháp trước khi bắt đầu phiên tu. Một phiên luyện một chiêu đã học, đồng thời nhận công lực/tâm đắc như cũ. Cứ 15 phút thời lượng gốc được 2 điểm thuần thục; mốc 0 / 20 / 60 / 120 / 240 tương ứng Tiếp xúc da lông / Sơ nhập môn đình / Đăng đường nhập thất / Lô hỏa thuần thanh / Đại viên mãn. Từ 0 đến tối đa mất tổng 30 giờ tu hoàn thành cho mỗi chiêu. Hoàn thành ngay/phiếu nhận cùng phần thưởng sau khi xác nhận; hủy hoặc spam PK không nhận thuần thục.

Chiêu công thông thường tăng 5% sát thương gốc mỗi bậc sau bậc đầu; chiêu thủ thêm 2 điểm phần trăm giảm sát thương mỗi bậc; né thêm 2 tốc, đỡ thêm 1,5 tốc và 5% phản phẳng mỗi bậc. Phá Sơn có thang riêng bên dưới. Dữ liệu cũ giữ nguyên công lực/chiêu đã học; các chiêu chưa luyện có thuần thục 0. Độ thành thạo chụp lúc nhận lời đấu, không thay đổi giữa trận.

## Luận võ so chiêu đồng thời

1. Hai người tự nguyện: một bên mời (phòng cân bằng hoặc phòng có buff), bên kia nhận lời. Lời mời hết hạn sau 20 giây; mỗi người gửi cách nhau 10 giây; bị từ chối thì 5 phút sau mới mời lại người đó; có chế độ "Tạm không nhận lời mời" và danh sách chặn.
2. Sảnh 30 giây: mỗi người chọn **4 chiêu bất kỳ trong số đã học** (4 chiêu thủ cũng được, 4 chiêu công cũng được; bộ không có đòn công chỉ bị cảnh báo, không bị chặn). Hai bộ chiêu được công bố khi trận bắt đầu.
3. Mỗi lượt 20 giây: hai bên **chọn kín** một chiêu (hoặc Điều tức) rồi khóa. Không ai biết bên kia chọn gì cho đến khi cả hai khóa. Khi cả hai khóa (hoặc hết giờ), máy chủ **lật chiêu** và giải kết quả một lần, mọi xác suất tính ở máy chủ, trình duyệt không tự quyết kết quả.
4. Mỗi người có máu 200 (chung, không phụ thuộc nhánh), nội lực (theo cấp nội công, hồi 6 mỗi lượt) và nộ (tối đa 100, nhận sát thương thì tăng, tăng sát thương đòn công kế tiếp, tiêu khi tung đòn kể cả khi bị né).

Cặp chiêu gặp nhau:

| | Công | Thủ | Né | Đỡ | Tụ lực | Nghỉ |
|---|---|---|---|---|---|---|
| **Công** | cả hai cùng trúng, không ai ngắt ai | sát thương giảm theo chiêu thủ | thử né từng nhịp | thử đỡ từng nhịp, đỡ được thì phản | trúng đủ | trúng đủ |
| **Thủ / Né / Đỡ / Nghỉ** | không có đòn thì không có sát thương | | | | | |

- **Xác suất né và đỡ**: `P = 10% + 80% / (1 + exp(-(tốc phòng - tốc công) / 20))`. Bằng tốc thì 50%, không bao giờ chắc chắn (10% đến 90%). Né và đỡ khác nhau: né thành công thì tránh nhịp đó; đỡ thành công thì chặn nhịp đó và có thể phản đòn; đỡ hụt có thể vẫn giảm một phần (Phản Chấn).
- **Đòn hai nhịp** (Liên Hoàn Cước): né hoặc đỡ từng nhịp; phản đòn chỉ tính một lần mỗi lượt theo tỉ lệ nhịp đỡ được.
- **Đoạt Ảnh Phản Kích**: thấy đối thủ tấn công thì đỡ, không thì đánh; hai bên cùng Đoạt Ảnh thì cả hai đánh.
- **Tụ Lực Phá Sơn**: lượt 1 chỉ tụ lực, không có giảm sát thương; lượt 2 bắt buộc tung, chắc trúng và bỏ qua mọi lớp giảm sát thương (thủ, giảm bị động, giảm từ nội công). Sát thương gốc theo độ thành thạo 70 / 90 / 115 / 145 / 180; vẫn nhân công nội lực, nộ/Kim Chung/buff công trong trần và dao động ±10%. Cấp nội công ≥7 và Đại viên mãn gây ít nhất 201 sát thương khi không bị phản, đủ hạ HP 200. Nếu bị hạ ở lượt chuẩn bị thì không được tung.
- **Tứ Lạng Bạt Thiên Cân**: chọn đúng lượt Phá Sơn tung thì chặn chắc và trả nguyên sát thương chuẩn, không nhân thêm công của người phản và không bị giáp người tung giảm. Chọn sớm trong lượt chuẩn bị không có đòn để phản. Với đòn thường chỉ thử đỡ khi tốc đòn ≤79; Tật Phong, Liên Hoàn, Liễu Diệp và đòn công của Đoạt Ảnh đều xuyên Tứ Lạng, không bị phản. Phản Chấn/Tiếp Kình/Đoạt Ảnh không hóa giải được Phá Sơn.
- **Sơ hở**: đòn của bạn bị né hoặc đỡ hết thì lượt sau bạn nhận thêm 25% sát thương.
- **Tránh hòa vô hạn**: từ lượt 20, hoặc sớm hơn nếu 4 lượt liền không ai mất máu, cả hai mất 5, 10, 15… máu mỗi lượt; tối đa 40 lượt. Cùng về 0: ai còn ít âm hơn thắng, bằng nhau thì hòa.
- **Quá giờ, mất mạng**: quá giờ thì tự "Đứng yên"; 3 lượt liền quá giờ thì thua; rớt mạng vẫn vào lại được đúng trận; cả hai vắng quá 60 giây thì hủy trận; máy chủ khởi động lại giữa trận thì hủy, không ai bị tính thua. Rời sân giữa trận là bỏ cuộc (có hỏi xác nhận). Rời hoặc bỏ ở phòng chờ chọn chiêu (trận chưa bắt đầu) thì trận **hủy, không ai bị tính thua**. Nếu trận kết thúc lúc một người đang offline thì lần vào lại sau đó, trang báo kết quả bằng một thông báo ngắn. Người không kịp chọn 4 chiêu thì máy chủ tự chọn bộ mặc định: ưu tiên chiêu bậc thấp và luôn có ít nhất một đòn công.
- PK không có thưởng, không cược công đức; chỉ ghi thắng / thua / hòa.

### Phòng có buff

Chỉ khi cả hai đồng ý. Buff được **chụp một lần lúc nhận lời** và hiện cho cả hai thấy trước; hào quang hết giờ hay công đức đổi giữa trận không đổi gì.

- Pháp tướng công đức (cấp 0–6): giảm sát thương nhận (2% mỗi cấp, tối đa 12%) và cộng xác suất **né** (1 điểm % mỗi cấp, tối đa 6 điểm).
- Quỷ ám (cấp 0–4, khi công đức âm): tăng sát thương gây ra (4% mỗi cấp, tối đa 16%).
- Hào quang cúng dường (cảnh giới 0–9): tăng sát thương (2% mỗi cấp, tối đa 18%), giảm sát thương nhận (1%, tối đa 9%), cộng né (0,5 điểm, tối đa 4,5 điểm).
- Các con số trên nhân với hệ số `PK_BUFF_SCALE` (**mặc định 0,15**; 0 = buff không có tác dụng, 1 = đủ số gốc) rồi bị chặn bởi trần chung: tăng sát thương tối đa +50% (gồm cả nộ), giảm sát thương bị động tối đa 15%, cộng né tối đa 8 điểm %, xác suất né tối đa 90%. Không ai bất tử hay né 100%.
- Buff chỉ cộng cho **né**, không cộng cho **đỡ**.
- Quỷ tăng sát thương, đúng ý chủ dự án. Cần biết rủi ro: công đức âm do nói tục khiến có quỷ, tức người chơi có thể cố ý bị trừ công đức để có buff. Hiện chỉ có hai biện pháp: cả hai bên thấy buff và phải đồng ý trước, và phòng cân bằng luôn có sẵn. Muốn chặt hơn thì đổi quỷ thành "tâm ma" (vừa tăng sát thương gây ra vừa tăng sát thương nhận) hoặc cấm người có quỷ vào phòng có buff.

## Cúng dường để hoàn thành tu luyện ngay

- Trong phiên đang tu, bấm "Hoàn thành ngay", xem giá (theo công pháp) và đọc rõ tác dụng, rồi nhận mã VietQR như cúng dường thường.
- **Chỉ khi Ban điều hành bấm Xác nhận** trong `/admin.html` thì phiên mới hoàn thành. Ngân hàng báo nhận (SePay) chỉ đánh dấu "ngân hàng đã báo nhận", không tự hoàn thành.
- Xác nhận xong, đây là một lượt cúng dường đầy đủ: người chơi nhận công đức (1 điểm mỗi 1.000đ), hào quang theo số tiền và chánh điện đọc thông báo, đồng thời phiên tu hoàn thành.
- Tác dụng chỉ là **rút ngắn thời gian**: không vượt trần công lực, không tăng chỉ số trong trận ngoài nội lực tối đa theo cấp. Tối đa 2 lần đã xác nhận mỗi ngày (`SPEEDUP_PER_DAY`).
- Tiền là lợi thế có thật (hoàn thành nhanh hơn, kèm hào quang dùng được trong phòng có buff). Biện pháp: công khai tác dụng ngay trong màn hình, giới hạn mỗi ngày, trần công lực như nhau cho mọi người, và phòng cân bằng không phụ thuộc tiền.
- Mọi trường hợp lệch giờ đều xử lý, không cộng thưởng hai lần:

| Tình huống | Kết quả |
|---|---|
| Admin bấm xác nhận hai lần, hoặc hai người bấm cùng lúc | Một lần có hiệu lực, lần sau báo "đã xác nhận" |
| Phiên tự xong theo giờ trước khi admin xác nhận | Không cộng thưởng lần hai; người chơi nhận một **phiếu hoàn thành ngay** dùng cho phiên sau (cùng giá trị hoặc thấp hơn) |
| Người chơi hủy phiên rồi tiền mới tới | Như trên (phiếu) |
| Admin từ chối | Phiên chạy bình thường, người chơi được báo |
| Quá 24 giờ chưa thấy tiền | Yêu cầu hết hạn, người chơi được báo; tiền tới muộn thì admin xác nhận có chủ đích (nút "Tiền tới trễ") và người chơi nhận phiếu |
| Mất kết nối, đăng xuất, máy chủ khởi động lại | Không ảnh hưởng, mọi thứ nằm trong cơ sở dữ liệu |

Nhà chùa cần đồng ý bằng văn bản cho việc dùng tài khoản nhận cúng dường trong trò chơi (xem cảnh báo ở README), và nên hỏi luật sư về quy định trò chơi trực tuyến trước khi mở rộng. `SPEEDUP_ENABLED=0` tắt riêng phần này.

## Đăng nhập Google và những gì được bảo lưu

Khi bật đăng nhập Google (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `AUTH_ORIGIN`), người đăng nhập được giữ **theo tài khoản** (đổi máy, đăng nhập lại là còn):

| Được lưu | Ghi chú |
|---|---|
| Công đức (hôm nay và tất cả) | Công đức đang có trên trình duyệt lúc đăng nhập lần đầu được chuyển vào tài khoản một lần |
| Tịnh tài đã cúng dường | Gồm cả các lượt tạo lúc còn là khách; xem ở màn "Tài khoản đã lưu" |
| Hào quang đang sáng | Hào quang chỉ sáng 5 đến 13 phút sau mỗi lần cúng dường, hết giờ thì tắt như thường |
| Nội công: công lực, cấp, nội lực tối đa, tâm đắc ba nhánh | |
| Võ công: chiêu đã học, bộ 4 chiêu mặc định | |
| Phiên tu đang chạy, phiếu hoàn thành ngay, thắng / thua / hòa | |

- **Tu luyện, Võ Học Các và Sân đấu chỉ dành cho tài khoản đã đăng nhập**, vì tiến độ gắn với tài khoản. Khách vãng lai vẫn vào chánh điện lễ Phật bình thường; dữ liệu của khách chỉ nằm trên trình duyệt đó và mất nếu xóa dữ liệu trình duyệt hay đổi máy. Đó là chủ ý: đăng nhập thì có quyền lợi.
- Nút "Đăng nhập" vàng, có vòng sáng nhấp nháy, luôn nằm ở thanh đầu trang khi chưa đăng nhập; thẻ mời đăng nhập hiện ngay ở hộp vào chùa và tab Công đức; bấm "Võ học các" hoặc "Sân đấu" khi chưa đăng nhập thì hiện hộp mời đăng nhập, không bị đẩy vào ngõ cụt. Đã đăng nhập thì thanh đầu trang hiện huy hiệu xanh "Đã lưu"; bấm vào để xem **Tài khoản đã lưu** (công đức, tịnh tài, hào quang, nội công, số chiêu đã học, thắng thua).
- Nếu nhà chùa từng cho khách tu luyện (lúc chưa bật đăng nhập), tiến độ võ học của khách đó cũng được gộp vào tài khoản ở lần đăng nhập đầu: công lực và tâm đắc cộng dồn (có trần), chiêu đã học hợp lại, phiên tu và yêu cầu hoàn thành ngay đang chờ theo về tài khoản. Logic ở `lib/account.js`, có test.
- Máy chủ chỉ lưu mã định danh tài khoản đã băm và phiên của ứng dụng; không đọc email hay danh bạ.
- Không bật đăng nhập (chạy thử trên máy) thì khách cũng dùng được mọi thứ, nhưng dữ liệu chỉ gắn với trình duyệt.

## Quản trị

`/admin.html` có thêm: cột "Loại" và chi tiết cho yêu cầu hoàn thành tu luyện (công pháp, thời lượng, trạng thái phiên, ngân hàng đã báo hay chưa), nút "Xác nhận và hoàn thành" / "Từ chối" / "Tiền tới trễ: xác nhận", thống kê Võ Học Các và Sân đấu, tình trạng lưu trữ, nút tải bản sao lưu JSON và nhật ký thao tác. Nhập sai mã quản trị 10 lần thì bị khóa 10 phút. Nhật ký không ghi mã quản trị, IP chỉ ghi dạng băm ngắn.

## Biến môi trường

| Biến | Mặc định | Ý nghĩa |
|---|---|---|
| `MARTIAL_ENABLED` | 1 | 0 = tắt cả Võ Học Các và Sân đấu |
| `PK_ENABLED` | 1 | 0 = chỉ tắt Sân đấu |
| `PK_MAX_MATCHES` | 20 | số trận cùng lúc tối đa |
| `PK_BUFF_SCALE` | 0,15 | hệ số nhân buff ở phòng có buff, từ 0 đến 1. Mô phỏng cho thấy buff rất nhạy: ở 0,5 bên có buff thắng 79% trở lên cả trên bộ chiêu phối hợp, nên mặc định hạ xuống 0,15 (xem [VO-HOC-CAN-BANG.md](VO-HOC-CAN-BANG.md)); muốn buff mạnh hơn thì tăng biến này |
| `SPEEDUP_ENABLED` | 1 | 0 = tắt hoàn thành tu luyện ngay (cần bật cúng dường tịnh tài) |
| `SPEEDUP_PER_DAY` | 2 | số lần hoàn thành ngay đã xác nhận mỗi người mỗi ngày |
| `CULTIVATION_TIME_SCALE`, `PK_TIME_SCALE`, `MARTIAL_SWEEP_MS` | 1, 1, 15000 | chỉ để thử: rút ngắn thời gian tu luyện / trong trận, nhịp quét phiên |

## Giới hạn đã biết

- Chưa có đo tải thật. Không khẳng định đáp ứng 100 người cùng lúc trên Render Free; xem mục đo tải trong [VO-HOC-CAN-BANG.md](VO-HOC-CAN-BANG.md).
- Người tu xong lúc đang offline thấy kết quả khi mở Võ Học Các (mục "Vừa hoàn thành"); thông báo đẩy chỉ gửi tới tab đang mở.
- Cân bằng là bản thử, dựa trên mô phỏng bot (xem giới hạn ở tài liệu cân bằng). Nên cho thử kín trước khi mở rộng, và đọc lịch sử trận (`matches` trong dữ liệu) để chỉnh tiếp.
- Coi bói tử vi và tarot hiện nằm ở sân chùa (cảnh trong chánh điện), chưa tách thành một nơi riêng; cấu trúc "nơi" đã sẵn nếu muốn tách.
