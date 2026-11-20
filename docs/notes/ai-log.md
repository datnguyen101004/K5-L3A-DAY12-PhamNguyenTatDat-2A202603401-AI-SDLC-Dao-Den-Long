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

# Phase 2

| Việc | Công cụ | Ghi chú |
|---|---|---|
| Phân tích Ticket-02, tách tick thành 11 stage, viết `maps.js`/`sim.js`/`campaign.js`, test, spec | Claude Code (parent) | Viết spec test trước khi sửa sim; 42 test |
| Client trình duyệt (menu, HUD, âm thanh, 3 bản đồ) | Subagent `WebClient` | Bị dừng giữa chừng theo yêu cầu của tôi (chạy quá lâu); phần nó để lại tôi tự xem lại, sửa và kiểm trong trình duyệt |

**Token/chi phí ước tính:** khoảng 150-200k token cho Phase 2 ([INFERENCE], không đọc từ bảng chi phí). Cách tiết kiệm: sim viết một lượt rồi sửa theo test đỏ; chỉ giao việc UI (độc lập, nhiều code) cho subagent.

**Lỗi AI / bản thân**
1. Test tự viết sai kỳ vọng (không phải sim sai): 5/42 đỏ lần đầu, do (a) kỳ vọng "thắng và chết cùng tick" bất khả thi vì Bóng Mực trong vùng an toàn của đèn vừa thắp được miễn sát thương; (b) frame inputs trùng `tick` => exit 2; (c) assert ở tick không có snapshot; (d) hết đạn khi nhân vật rơi khỏi cầu vì di chuyển sai trục; (e) quên bật `wind_enabled` trong test gió. Phát hiện nhờ đọc expected/actual, sửa test chứ không nới assert; đã ghi vào mục "Past agent mistakes" của `AGENTS.md`.
2. Lỗi thật của sim: recoil đếm lệch 1 tick (59 thay vì 60 lần dịch) do giảm bộ đếm ở S2 rồi mới dùng ở S8. Phát hiện khi tính tay kỳ vọng "2 m / 60 tick"; đổi sang đếm theo lần dùng.
3. Lỗi thật của client: (a) đồng hồ không có dấu `:`; (b) bấm "Tiếp tục" không hoạt động vì sim cần cạnh false→true của `pause` mà client chỉ gửi 1 bước. Cả hai phát hiện khi chơi thử trong trình duyệt (không có test tự động cho UI); (c) nền màn giới thiệu Đêm 2/3 vẫn là Đêm 1.
4. Quản lý subagent: giao quá nhiều việc cho một subagent, chạy lâu, tôi phải dừng giữa chừng. Lần sau tách UI thành 2 phần nhỏ (flow/HUD và thế giới 3D).

**Harness:** `AGENTS.md` cập nhật cho phạm vi mới; skill `verify-headless` (bảng tính tick) và `browser-check` mới; hook Stop `npm test`; CI.
