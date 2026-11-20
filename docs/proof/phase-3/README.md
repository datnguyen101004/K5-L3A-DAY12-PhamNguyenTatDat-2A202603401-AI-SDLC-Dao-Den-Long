# Bằng chứng Phase 3 (Ticket-03 "Đèn cạn dầu", Contract v1.2)

Tái tạo: `npm test`, `node scripts/prove.mjs 3`. Máy: Windows 11 x64, i5-12500H, Node v22. Truy vết yêu cầu → test: [`docs/spec/ticket-03.md`](../../spec/ticket-03.md). Quyết định thiết kế: [ADR 0001](../../adr/0001-lantern-fuel-and-dawn-victory.md). Thay đổi phá vỡ: [CHANGELOG](../../../CHANGELOG.md).

| Nhóm | Bằng chứng | Kết quả |
|---|---|---|
| Luật mới (dầu, châm dầu, tắt, thắp lại, ngưỡng 30, drain, thắng ở bình minh, sức chứa, điểm) | `npm-test.txt`: 59 test đạt (57 headless + 2 campaign); mỗi dòng của spec có test | Đạt |
| Test cũ bị luật mới làm sai | Viết lại có lý do, không skip: bảng ở CHANGELOG mục 3; `grep -rn "\.skip\|\.todo\|skip:" tests/` không có kết quả | Đạt |
| Hồi quy Phase 1-2 không bị thay thế | Test Phase 2 còn lại (di chuyển, lướt, nhảy, rơi, Gió Lạc, Bùa, gió, bản đồ, pause, validation, tất định) chạy lại và đạt, chỉ đổi số theo contract | Đạt (test ẩn của giảng viên chưa có để chạy) |
| Tính tất định 3 Đêm | `determinism.txt` | Đạt |
| Một Đêm headless ≤ 30 s | `perf-headless.txt`: Đêm 1 0.3 s, Đêm 2 0.4 s, Đêm 3 1.7 s | Đạt |
| Mẫu một đêm sống tới bình minh | `samples/dawn3.*`: 5/7 đèn sáng, kết thúc `dawn_survived`, điểm 1170 = 3·50+… khớp tay (xem `[T3] ambient scoring`) | Đạt |
| UI: thanh dầu, nhấp nháy, vùng an toàn chỉ khi dầu ≥ 30, hút dầu (tia tới đèn), sức chứa 8/16, "Đèn k/n (cần m)", nhắc "Châm dầu (60/100)", bảng màu dễ phân biệt (viền #00B3FF, thanh dầu trắng khi yếu), cài đặt lưu | Chơi trong trình duyệt: `ui-fuel-drain.png` (đèn yếu, Bóng Mực đang hút, chế độ mù màu bật). Đã đọc lại: prompt "E — Châm dầu (60/100)", `localStorage` có `colorblind:true` | Đạt một phần (xem dưới) |

## Hạn chế (trung thực)
- Đèn tắt "xẹp 20% với vết rách" và tia hút dầu chỉ được thấy ở khoảng cách xa trong ảnh chụp; chưa xác nhận bằng mắt ở sát cho vết rách. Việc nhấp nháy 1 Hz đã thấy ở trạng thái mờ (ảnh), nhưng chưa quay clip.
- Màn kết quả hiển thị lý do mới (`dawn_survived`) và màn Bình Minh chưa chơi tay trọn vẹn trong trình duyệt; phần logic được chứng minh bằng headless/campaign.
- Cảnh báo ⚠ kèm màu trắng chỉ kiểm bằng CSS (đồng hồ ≤ 30 s, nút hồi chiêu), chưa chụp ảnh từng chỗ.
- Âm thanh cho `lantern_out`/`refuel` dùng lại hiệu ứng có sẵn; chưa nghe.
- Test của tôi tự suy ra các giá trị ticket để ngỏ (A35-A47): tốc độ wander tới đèn (4 m/s), thời điểm bắt đầu hút (tick sau), nhịp `fuel_drain`, đèn "đầy dầu không được chọn" (chỉ có hiệu lực trong đúng tick vừa châm vì dầu hao mỗi tick). Test ẩn có thể hiểu khác.
- Hiệu năng Đêm 3 headless tăng ~7 lần (BFS cho Bóng Mực tìm đèn) nhưng vẫn rất xa ngưỡng 30 s.
