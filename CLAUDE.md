@AGENTS.md

# Ghi chú riêng cho Claude Code

Toàn bộ quy tắc chung ở `AGENTS.md` (đã import ở trên). Phần dưới chỉ là những điều riêng của Claude Code.

- **Nạp ngữ cảnh theo gói, không đọc lan.** Đọc thẻ việc trong `task.md`, rồi đúng gói ở `docs/agents/CONTEXT-PACKS.md`. Cần tìm rộng (nhiều file, nhiều tên gọi) thì giao cho subagent `Explore` và chỉ lấy kết luận về.
- **File lớn** (`public/js/arena.js`, `hall.js`, `app.js`, `server.js`): dùng Grep tìm symbol rồi Read theo `offset`/`limit`, không đọc cả file khi không cần.
- **Đọc/ghi file bằng Read/Write/Edit**, không dùng `Get-Content`/`Set-Content` của PowerShell 5.1 (hỏng dấu tiếng Việt).
- **Làm song song nhiều thẻ:** mỗi thẻ một worktree (`.claude/worktrees/` đã có trong `.gitignore`) hoặc một session riêng; hai agent không bao giờ cùng sửa một file nóng (ORCHESTRATION.md §4).
- **Vai trò điều phối:** khi chủ dự án nhờ "điều phối", làm theo `docs/agents/ORCHESTRATION.md`: chọn thẻ sẵn sàng, dựng prompt theo mẫu §5, giao cho subagent/session, rồi kiểm tra kết quả bằng checklist §7 trước khi báo lại. Báo cáo của agent con là lời tự khai, phải xem diff và kết quả test thật.
- Commit/PR chỉ khi được yêu cầu; cuối commit message thêm dòng `Co-Authored-By` theo hướng dẫn của phiên.
