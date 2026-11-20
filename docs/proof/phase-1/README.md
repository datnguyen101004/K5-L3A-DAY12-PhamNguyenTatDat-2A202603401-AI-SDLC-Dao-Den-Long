# Bằng chứng Phase 1

Tái tạo: `npm test` và `node scripts/prove.mjs` (ghi lại các file ở đây). Máy: Windows 11 x64, Node v22.22.2.

| Yêu cầu (PRD-0 / Contract) | Cách kiểm chứng | Bằng chứng | Kết quả |
|---|---|---|---|
| Mô hình tick: snapshot 0, N bước, time_left, end | test `tick model` | `npm-test.txt` | Đạt |
| Di chuyển, yaw, chuẩn hóa vector | test `camera yaw...` | `npm-test.txt` | Đạt |
| Nhặt đom đóm, biên bán kính, capacity | test `mote pickup...` | `npm-test.txt` | Đạt |
| Nạp đèn, thắp đèn, thắng, điểm, scenario không cộng điểm | test `deposit and light...` + `samples/win.out.jsonl` (end score 486) | cả hai | Đạt |
| Nạp một phần, ngoài tầm, cạnh lên | tests `partial deposit`, `interact fires...` | `npm-test.txt` | Đạt |
| Tỏa sáng: tốn, choáng, đẩy, điểm, hồi chiêu | tests `pulse...`, `stun lasts...` | `npm-test.txt` | Đạt |
| Bóng Mực chạm: mất lửa, rơi, bất tử, thua | test `shade hit...` | `npm-test.txt` | Đạt |
| safe_radius quanh đèn sáng | test `lit lantern safe_radius...` | `npm-test.txt` | Đạt |
| Thua khi hết giờ (dawn), dừng sớm, thoát 0 | tests `dawn loss`, `stops at game end` | `npm-test.txt` | Đạt |
| Nhảy | test `jump...` | `npm-test.txt` | Đạt |
| Tính tất định (kể cả id tự sinh) | test `determinism...` + chạy 18000 tick 2 lần | `determinism.txt` (hash trùng) | Đạt |
| Lỗi định dạng => mã 2, stderr | test `invalid inputs...` | `npm-test.txt` | Đạt |
| Khai báo contract, 5 đèn, L1 tại (0,0,25) | test `contract file...` | `npm-test.txt` | Đạt |
| Chơi được trên trình duyệt, HUD, đèn/Mây/Bóng Mực | Chơi thử bằng Chromium headless (nhặt đom đóm, HUD cập nhật, điểm 10) | `browser-play.png` | Đạt (xem hạn chế) |

## Hạn chế (trung thực)
- Phần hiển thị chỉ được kiểm bằng chơi thử và ảnh chụp, không có test tự động; chưa chơi trọn một ván thắng/thua bằng tay trong trình duyệt (chỉ chứng minh thắng/thua qua headless).
- Các giả định A6, A9, A11 là đoán về ý định của contract; nếu giảng viên hiểu khác, test ẩn có thể lệch.
- Chưa đo hiệu năng (không yêu cầu ở Phase 1). 18000 tick chạy dưới 1 giây trên máy dev.
