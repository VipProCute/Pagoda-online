# Hướng dẫn điều phối nhiều agent

> Dành cho **người điều phối** (chủ dự án, hoặc một agent được giao vai điều phối) khi chia việc cho nhiều agent (Codex, Claude Code, …) làm song song mà không giẫm chân nhau.
> Quy tắc kỹ thuật chung ở `AGENTS.md`. Bảng việc ở `task.md`. Gói ngữ cảnh ở `CONTEXT-PACKS.md`.

## 1. Vai trò

| Vai | Ai | Làm gì | Không làm |
|---|---|---|---|
| **Chủ dự án** | người | quyết phạm vi, ưu tiên, duyệt và merge PR, xoá nhánh, cấp khóa bí mật | |
| **Điều phối** | người hoặc agent | viết/chia thẻ, gán gói ngữ cảnh, kiểm tra xung đột file, giao việc, kiểm tra kết quả | tự sửa mã của thẻ đang giao cho agent khác |
| **Thợ** (worker) | agent | làm **một** thẻ trên nhánh riêng, test, bàn giao | làm ngoài phạm vi thẻ, merge, xoá nhánh |
| **Soát** (reviewer) | agent khác thợ | soát PR theo checklist §7, chạy lại test | sửa thẳng trên nhánh của thợ (ghi nhận xét thôi) |

## 2. Vòng đời một thẻ

```
⚪ Hộp thư đến ──(điều phối viết đủ thẻ)──► 🔵 Sẵn sàng ──(thợ nhận)──► 🟡 Đang làm
        ▲                                                                   │
        │                                     🔴 Bị chặn ◄──(thiếu quyết định/khóa)
        │                                                                   ▼
   (lỗi mới phát hiện)                    ✅ Xong ◄──(chủ dự án merge)── 🟣 Chờ soát
```

- **Hộp thư đến**: ý tưởng, lỗi vừa thấy. Chưa đủ để giao.
- **Sẵn sàng**: có đủ các trường bắt buộc (§3), không phụ thuộc thẻ chưa xong, đã kiểm xung đột file.
- **Đang làm**: có `Người làm` + `Nhánh`. Mỗi thợ tối đa **một** thẻ đang làm.
- **Chờ soát**: đã có PR (hoặc nhánh đẩy lên) + báo cáo bàn giao.
- **Bị chặn**: ghi rõ chặn bởi gì, ai cần làm gì.
- **Xong**: đã merge vào `main`. Chuyển thẻ xuống mục "Đã xong" kèm số PR.

## 3. Mẫu thẻ việc

Chép khối này vào `task.md`. Trường có dấu * là bắt buộc trước khi chuyển sang "Sẵn sàng".

```markdown
### T-0XX · <Tên ngắn, động từ đứng đầu>
- **Trạng thái***: 🔵 Sẵn sàng
- **Ưu tiên***: P0 (gấp) | P1 (nên làm sớm) | P2 (khi rảnh)
- **Gói ngữ cảnh***: CORE + PK + BALANCE
- **Khu vực chạm***: lib/pk/rules.js, public/js/martial.js, test/pk-engine.test.js
- **Phụ thuộc**: T-0YY (phải xong trước) | không
- **Người làm**: — 
- **Nhánh**: —
- **Mục tiêu***: 1–3 câu, kết quả người dùng/chủ dự án thấy được.
- **Tiêu chí xong***:
  - [ ] điều kiện kiểm chứng được 1
  - [ ] điều kiện kiểm chứng được 2
  - [ ] `npm run check` + test của gói sạch
- **Ngoài phạm vi**: những gì KHÔNG được làm trong thẻ này.
- **Ghi chú**: link issue/PR, quyết định đã chốt, câu hỏi còn mở.
```

Quy tắc viết thẻ:
- Thẻ đủ nhỏ để một agent làm xong trong một phiên (thường < 400 dòng thay đổi). Lớn hơn thì tách.
- "Khu vực chạm" liệt kê **file**, không phải thư mục, để kiểm xung đột được.
- Tiêu chí xong phải kiểm chứng được bằng lệnh hoặc bằng mắt (có ảnh chụp, có test), không viết "chạy tốt".

## 4. Chống đụng nhau (quan trọng nhất)

Lịch sử repo đã có hai agent làm cùng một tính năng trên hai nhánh (`codex/bi-kip-an-obito` và `codex/obito-bi-kip-an`). Để không lặp lại:

1. **Một tính năng = một thẻ = một người làm.** Trước khi giao, điều phối tìm trong `task.md` và trong danh sách nhánh (`git branch -r`) xem đã có ai làm chưa.
2. **File nóng** (nhiều thẻ hay chạm, dễ xung đột merge): chỉ **một** thẻ "Đang làm" được chạm mỗi file sau cùng lúc:

   | File nóng | Vì sao |
   |---|---|
   | `server.js` | mọi handler, hằng số thế giới |
   | `public/js/app.js` | nơi nối mọi module |
   | `public/js/hall.js` | toàn bộ vẽ |
   | `public/js/arena.js` | giao diện sân đấu |
   | `public/index.html` | thứ tự script, `?v=` |
   | `package.json` | `check`, dependency |
   | `lib/store-sections.js` | hình dạng dữ liệu |
   | `public/js/martial.js` | số liệu dùng chung máy chủ + trình duyệt |
   | `docs/VO-HOC-GIAO-THUC.md` | hợp đồng giao thức |
   | `task.md` | ngoại lệ: ai cũng sửa được, nhưng **chỉ sửa thẻ của mình** và kéo bản mới trước khi sửa |

   Hai thẻ cùng cần một file nóng thì xếp nối tiếp (đặt `Phụ thuộc`) hoặc gộp thành một thẻ.
3. **Mỗi thợ một bản làm việc riêng**: git worktree (`git worktree add ../Pagoda-online-T0XX -b <nhánh> origin/main`) hoặc một bản clone riêng. Không để hai agent cùng sửa một thư mục làm việc. Claude Code có thể dùng `.claude/worktrees/` (đã được `.gitignore`).
4. **Luôn tách nhánh từ `origin/main` mới nhất**; trước khi mở PR, gộp `main` vào nhánh của mình và chạy lại test.
5. **Thứ tự merge** khi có nhiều PR cùng chờ: PR sửa dữ liệu/giao thức (`store-sections`, `martial.js`, giao thức) trước, giao diện sau; PR nhỏ trước PR lớn.

## 5. Mẫu prompt giao việc (Context Injection)

Điều phối dán prompt này cho agent thợ. Chỉ thay phần trong `<…>`. Prompt cố ý **không** chép nội dung file vào, mà chỉ đường dẫn tới đúng gói, để agent tự đọc bản mới nhất và không bị ngữ cảnh cũ.

```text
Bạn là agent thợ trong repo Pagoda-online (Chùa Tâm An), thư mục: <đường dẫn worktree>.

1. Đọc AGENTS.md (quy tắc bắt buộc) nếu công cụ của bạn chưa tự nạp.
2. Mở task.md, đọc thẻ <T-0XX>. Đó là phạm vi DUY NHẤT của bạn.
3. Đọc gói ngữ cảnh <CORE + …> trong docs/agents/CONTEXT-PACKS.md: "Đọc kỹ" trước, "Tra khi cần" chỉ khi đụng tới.
4. Nhận thẻ: điền Người làm = <tên agent>, Nhánh = <agent>/<T-0XX>-<slug>, trạng thái 🟡 Đang làm.
5. Làm việc trên nhánh đó, tách từ origin/main. Không sửa file ngoài "Khu vực chạm" trừ khi bắt buộc; nếu bắt buộc, ghi lý do vào báo cáo.
6. Kiểm theo "Định nghĩa xong" ở AGENTS.md §6 và "Tiêu chí xong" của thẻ.
7. Bàn giao theo mẫu docs/agents/ORCHESTRATION.md §6, chuyển thẻ sang 🟣 Chờ soát.
Gặp quyết định không có trong thẻ (đổi luật chơi, đổi giao thức, đụng tiền, xoá dữ liệu): dừng và hỏi, đừng đoán.

Bối cảnh thêm từ điều phối (nếu có): <quyết định đã chốt, link PR liên quan, ảnh chụp>
```

Mẹo nạp ngữ cảnh:
- Thẻ đụng 2 khu vực thì ghép gói (`CORE + PK + BALANCE`). Quá 3 gói là dấu hiệu thẻ quá lớn, nên tách.
- Cần thông tin từ phiên trước: dán **báo cáo bàn giao** (§6) của phiên đó, không dán cả lịch sử chat.
- Agent soát nhận: prompt §5 với thẻ đó + "vai Soát, làm theo ORCHESTRATION.md §7, không sửa mã".

## 6. Mẫu báo cáo bàn giao

Thợ viết ở cuối PR (và tóm tắt 1–2 dòng vào trường `Ghi chú` của thẻ):

```markdown
## Bàn giao T-0XX
**Kết quả:** <1–2 câu: đã làm được gì>
**Nhánh / PR:** <nhánh> · <link PR hoặc "chưa mở PR">
**File đã sửa:** <danh sách; đánh dấu file ngoài "Khu vực chạm" và lý do>
**Kiểm tra đã chạy:**
- `npm run check`: ✅/❌
- `node --test test/…`: <số đạt/tổng>
- `npm test`: <đạt/tổng, hoặc "chưa chạy vì …">
- ui-harness / pk-sim: <kết quả, hoặc lý do không chạy>
**Chưa làm / còn rủi ro:** <thành thật: phần chưa xong, chưa kiểm được, nghi ngờ>
**Điểm đồng bộ đã cập nhật:** <`?v=`, docs, LIB_SEATS…, hoặc "không có">
**Việc phát sinh (đã ghi vào Hộp thư đến):** <T-mới hoặc "không có">
```

## 7. Checklist soát (trước khi chủ dự án merge)

- [ ] Diff chỉ trong phạm vi thẻ; không có file lạ (`data/*.json`, `.env`, ảnh tạm, `node_modules`).
- [ ] Không lộ bí mật, không có số tài khoản/điện thoại thật, không có giọng mẫu cá nhân.
- [ ] Bất biến ở `AGENTS.md` §3 còn nguyên (máy chủ trọng tài, cúng dường, `textContent`, moderation, rate limit).
- [ ] Các điểm đồng bộ (`ARCHITECTURE.md` §6) đã sửa cả hai phía; `?v=` đã tăng nếu sửa `public/`.
- [ ] `npm run check` và test của gói chạy lại **trên máy soát** đều sạch; test mới thực sự kiểm hành vi mới (thử làm hỏng mã thì test phải đỏ).
- [ ] Giao thức đổi thì `docs/VO-HOC-GIAO-THUC.md` đổi theo; số liệu đổi thì có kết quả `pk-sim`.
- [ ] Chữ giao diện tiếng Việt có dấu, đúng giọng; có xử lý `prefers-reduced-motion` nếu thêm chuyển động.
- [ ] Báo cáo bàn giao khớp với diff thật (báo cáo là lời tự khai, phải đối chiếu).

## 8. Nhịp điều phối gợi ý

1. **Đầu đợt**: điều phối rà `task.md`, chuyển thẻ đủ điều kiện từ Hộp thư đến sang Sẵn sàng, kiểm bảng file nóng, chọn tối đa 3–4 thẻ song song không chung file nóng.
2. **Giao việc**: mỗi thẻ một agent, một worktree, prompt §5.
3. **Nhận bàn giao**: giao thẻ cho agent soát (khác thợ) theo §7.
4. **Merge**: chủ dự án merge theo thứ tự §4.5, rồi chuyển thẻ sang Đã xong.
5. **Cuối đợt**: dọn nhánh đã merge (chủ dự án xoá), cập nhật `ARCHITECTURE.md` nếu cấu trúc đổi, thêm việc phát sinh vào Hộp thư đến.
