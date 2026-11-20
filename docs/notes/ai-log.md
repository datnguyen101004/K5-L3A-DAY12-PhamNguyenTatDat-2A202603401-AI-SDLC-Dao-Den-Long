# Nhật ký dùng AI: Phase 1

| Việc | Công cụ | Ghi chú |
|---|---|---|
| Đọc PRD-0 + contract, thiết kế (sim thuần tách khỏi render) | Claude Code (Sonnet) | 1 prompt chứa nguyên văn PRD-0 |
| Viết `sim.js`, `headless.js`, tests, client three.js | Claude Code | Test viết cùng lúc với sim; chạy `npm test` sau mỗi bước |
| Chơi thử trình duyệt, chỉnh độ sáng | Claude Code + Chromium headless | 1 vòng chỉnh vì cảnh quá tối |

**Token/chi phí ước tính:** khoảng 60-80k token tổng ([INFERENCE], chưa đọc từ bảng chi phí). Tiết kiệm: tránh đọc lại file, viết sim một lần, không dùng subagent, không dùng engine nặng.

**Lỗi AI / bản thân đã gặp**
1. `npm test` với `node --test tests/` lỗi trên Node 22 (Windows) vì coi `tests` là module. Phát hiện khi chạy thật; sửa bằng glob `tests/*.test.js`.
2. Test pickup đầu tiên sai: `--snapshot-every` mặc định 10 nên snapshot cuối ở tick 0, assert đọc nhầm. Phát hiện do test đỏ với số liệu lạ; sửa bằng `every: 1`. Bài học đã ghi vào skill `verify-headless`. Ghi chú: test `partial deposit` vẫn kiểm tra `lit` từ snapshot tick 0 nên khẳng định yếu ở dòng đó (đã có assert sự kiện bù).
3. Màn đầu tiên trong trình duyệt gần như đen, chỉ thấy khi chụp ảnh thật; tăng ánh sáng nền.

**Harness:** `AGENTS.md` (lệnh, bố cục, quy tắc), hook Stop chặn kết thúc khi `npm test` đỏ, skill `verify-headless`, CI GitHub Actions.
