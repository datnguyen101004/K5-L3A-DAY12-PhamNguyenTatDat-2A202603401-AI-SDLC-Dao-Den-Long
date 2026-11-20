# Bằng chứng Phase 2 (Ticket-02, Contract v1.1)

Tái tạo: `npm test`, `node scripts/prove.mjs 2`. Máy: Windows 11 x64, i5-12500H, Node v22.22.2, Chromium headless của công cụ `browser`.
Truy vết từng yêu cầu → test: `docs/spec/ticket-02.md`.

| Nhóm | Bằng chứng | Kết quả |
|---|---|---|
| Số chuẩn, bản đồ, tính năng mới (Gió Lạc, Bùa, gió, rơi, bục nhảy, pause...) | `npm-test.txt`: 43 test đạt (41 headless + 2 campaign), mỗi tính năng mới có ≥ 1 scenario | Đạt |
| Chuỗi 3 Đêm, tổng điểm, thua thì chơi lại | `tests/campaign.test.js` + trình duyệt (xem dưới) | Đạt |
| Tính tất định 3 Đêm | `determinism.txt`: hash 2 lần chạy 21.600 tick trùng nhau | Đạt |
| Một Đêm headless ≤ 30 s | `perf-headless.txt`: ~0.2-0.3 s mỗi Đêm | Đạt |
| ≥ 30 FPS ở 1280×720 | `window.__perf.fps` trong Chromium headless (cửa sổ 1365×768): Đêm 1 58.5, Đêm 2 59.8, Đêm 3 60.0 | Đạt (đo trên máy dev, cấu hình GPU/GL của công cụ không rõ) |
| Menu, giới thiệu Đêm, HUD, tạm dừng, cài đặt lưu, kết quả, thua | Đi tay trong trình duyệt: `ui-night1/2/3.png`, `ui-prompt.png`, `ui-result.png`, `ui-lose.png`. Tạm dừng đóng băng `simTick` (51 → 51 sau 1 s), Tiếp tục chạy lại, cài đặt 33/150 còn nguyên sau reload | Đạt |
| Hồi quy Phase 1 | Test Phase 1 không còn (đã viết lại vì số chuẩn thay đổi, xem bảng "Thay đổi yêu cầu" trong `docs/notes/assumptions.md`). Bộ test ẩn Phase 1 chưa có để chạy thử | Chưa chứng minh được |

## Hạn chế (trung thực)
- **Âm thanh:** chỉ kiểm được không có lỗi, chưa nghe được; chưa xác nhận nhạc nền và 10 hiệu ứng có phát đúng.
- **Chưa kiểm bằng mắt/tay:** màn Bình Minh, Gió Lạc và Bùa trong trình duyệt, lá bay khi gió, độ nhạy chuột thật sự thay đổi tốc độ xoay, đồng hồ đỏ nhấp nháy ≤ 30 s, bảng màu ±10% (chỉ nhìn bằng mắt, không đo pixel).
- Khi kiểm kết quả thắng/thua tôi dùng `window.__app.game` để thắp sẵn 4 đèn / đặt `duration`, rồi nhấn E thật; đó là thao tác hỗ trợ kiểm thử, không phải chơi thuần.
- Chạm Gió Lạc/Bóng Mực trong trình duyệt chưa được thử; logic chỉ được chứng minh bằng test headless.
- Các giả định A17-A34 là cách hiểu của tôi về chỗ ticket chưa chốt; test ẩn của giảng viên có thể hiểu khác (rủi ro lớn nhất: A18 góc, A24 Bóng Mực không lên tầng, A28 vùng an toàn lúc vừa thắp đèn, A30 lịch gió).
- Chưa đo FPS ở đúng 1280×720 và trên phần cứng khác.
