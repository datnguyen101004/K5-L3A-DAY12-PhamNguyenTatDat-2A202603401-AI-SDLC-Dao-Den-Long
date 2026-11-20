# Giả định (PRD-0 / Phase 1)

| # | Chỗ mơ hồ | Giả định | Nơi áp dụng |
|---|---|---|---|
| A1 | "Ánh sáng"/máu | `flames` = máu (3). `carried` = đom đóm mang theo. Tỏa sáng tốn `pulse_cost` = 1 đom đóm. | sim |
| A2 | Nạp đèn | Nhấn `interact` (cạnh lên) khi ≤ `interact_radius` của đèn chưa sáng gần nhất; nạp `min(carried, cost - deposited)`. Đèn sáng khi deposited ≥ 5. Không nạp nếu carried = 0 (không có sự kiện). | `Game.step` |
| A3 | Nhặt đom đóm | Tự động, theo thứ tự id, dừng khi đầy (capacity 5). | sim |
| A4 | Pulse | Cần carried ≥ cost và hết cooldown; nếu không thì bỏ qua im lặng. Pulse không có Bóng Mực trong tầm vẫn tốn đom đóm và phát `pulse` với `stunned_ids: []`. Bóng Mực đang choáng bị choáng lại thì tính lại thời gian và tính điểm `per_stun` lại. | sim |
| A5 | Choáng | Đúng `pulse_stun_s*60` bước, không di chuyển/không gây sát thương. | sim |
| A6 | safe_radius | Chỉ quanh đèn **đã sáng** ("sợ đèn"). Bóng Mực bị chiếu ra mép vòng, không xuyên qua. Vị trí ban đầu từ scenario không bị đẩy cho tới khi nó di chuyển. | `clampShade` |
| A7 | Chạm | Khi Bóng Mực không choáng và khoảng cách XZ ≤ `shade_hit_radius` và hết bất tử: -1 lửa, rơi `floor(carried*0.5)` đom đóm (xuất hiện cách 2.5 m quanh Mây), bất tử 90 bước. Tối đa 1 lần chạm/bước. | sim |
| A8 | Rơi khỏi đảo | Không có. Mép đảo giới hạn ở bán kính 40 m. `fall_enabled = false`. | sim |
| A9 | Kết thúc | Thắng ngay khi mọi đèn sáng (kiểm tra mỗi bước, sau hành động của người chơi, trước Bóng Mực). Thua `no_flames` khi lửa = 0; thua `dawn` khi `time_left_s` ≤ 0. Nếu cùng bước thì thắng ưu tiên. | sim |
| A10 | Điểm | Thưởng thắng = `per_second_left * floor(time_left)` + `per_flame_left * flames` cộng một lần khi thắng, không có khi thua. Dựng scenario không cộng điểm. | sim |
| A11 | Scenario | `time_left_s` đặt cả thời lượng đêm (nên `time_left_s` giảm từ giá trị đó). Đèn lạ id (không phải L1..L5) được thêm mới nếu có `pos`. `lit: true` đặt `deposited = lantern_cost`. Bóng Mực không có `pos[1]` thì y = 1. Đèn thắng-kiểm-tra mỗi bước nên scenario có mọi đèn đã sáng sẽ thắng ở tick 1. | `Game` |
| A12 | Ngẫu nhiên | Mặc định 24 đom đóm (rải đều trên đĩa bán kính 35), bổ sung 1 đom đóm / 5 s nếu < 24; 2 Bóng Mực ban đầu ở 30–38 m, thêm 1 con / 15 s tới tối đa 6 (`shade_spawned`). Dùng mulberry32(seed). | sim |
| A13 | Input | Giữ trạng thái giữa frame; nút kích hoạt khi false→true; `jump` chỉ khi đang chạm đất. Trọng lực 22 m/s², vận tốc nhảy 8 m/s. Nhảy không né được Bóng Mực (khoảng cách chỉ tính XZ, theo contract). | sim |
| A14 | Snapshot | Thêm mảng `motes` (khuyến nghị). Snapshot cuối chỉ có khi `tick % every == 0` hoặc tick 0; trạng thái cuối luôn nằm ở dòng `end`. Sự kiện của một bước được ghi trước snapshot của bước đó. | headless |
| A15 | Mã thoát | 2 cho file inputs/scenario sai (JSON hỏng, sai kiểu, tick không tăng, move ngoài [-1,1]); 1 cho tham số CLI sai. | headless |
| A16 | Camera/điều khiển | Camera đứng sau lưng, nhìn theo +Z khi yaw = 0 nên "phải màn hình" là -X; phím D gửi move x = -1. Chỉ ảnh hưởng client, không ảnh hưởng headless. | web |

Các số tuning nằm trong `game.contract.json` (nguồn duy nhất).
