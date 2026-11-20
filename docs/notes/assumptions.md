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

---

# Phase 2 (Ticket-02, Contract v1.1)

## Thay đổi yêu cầu so với Phase 1 và hệ quả (ghi lý do)
| Thay đổi | Lý do (ticket) | Test cũ xử lý thế nào |
|---|---|---|
| Mọi số tuning bị thay bằng số chuẩn (tốc độ, sức chứa 10, giá đèn 10, Tỏa Sáng 3/5 m/3 s, Bóng Mực 4.0 m/s, bán kính hit/nhặt/tương tác...) | Đồng bộ cảm giác giữa các bài | Test Phase 1 đọc số từ `game.contract.json` nên chạy lại được; những assert cứng đã viết lại theo số chuẩn |
| Điểm `per_mote` tính khi **nạp** đèn (không phải khi nhặt); `per_stun` 5 | Điểm chuẩn hóa | Test `pickup` bỏ assert điểm; test `deposit` thêm assert điểm |
| Bóng Mực không còn 2 con ngay tick 0 mà 2 con tại tick 300; thêm trạng thái `spawning/wander/recoil` (bỏ `chase` mặc định) | Lịch sinh chuẩn | Test Phase 1 "random_shades" thay bằng `spawn schedule`; scenario P1 có Bóng Mực ≤ 12 m vẫn chase |
| Thắng/thua kiểm sau mọi tác động ở S11 (trước đây thắng ngay khi thắp đèn, trước Bóng Mực) | Thứ tự tick bắt buộc | Test `loss`/`win` viết lại; thêm test "Bóng Mực trong vùng an toàn vừa thắp không gây hại" |
| Bóng Mực không còn "bị đẩy ra tường tròn": bản đồ có địa hình thật (rơi, cầu, tầng) | Phần 2 | Bỏ clamp bán kính đảo; thêm test địa hình |
| `fall_enabled` đổi `false` → `true`; có sự kiện `player_hit by fall` | Phần 1 | Giả định A8 bị thay |
| Output thêm `night_start` ở tick 0 ngay sau snapshot 0 | Contract v1.1 | Test không còn assert "không có sự kiện nào" |

## Giả định mới
| # | Chỗ mơ hồ | Giả định |
|---|---|---|
| A17 | Vận tốc chạy "tăng tốc/dừng ≤ 0.1 s" | Tức thời (0 s). Có `vel` trong snapshot |
| A18 | Góc bản đồ | Điểm = (cx + r·cos a, y, cz + r·sin a); chiều "ngược kim đồng hồ" được hiểu theo cách làm các điểm tầng 1 (a ∈ 20°..160° nằm ở z > 0) thành hợp lệ |
| A19 | Đêm 2/3 hướng nhìn ban đầu | +Z |
| A20 | `invuln` trong snapshot | Số tick còn lại (nguyên); kèm `dash_cd_s`, `pulse_cd_s`, `charm_s` tính bằng giây |
| A21 | Đèn đặt tại độ cao y (Đêm 3) | Khoảng cách tương tác/vùng an toàn chỉ tính XZ (như Phase 1) |
| A22 | Điểm xuất phát Đêm 3 / hồi sinh | (0,0,30) (tầng 0, vì (0,0,0) nằm trong tháp); Đêm 2 (0,0,0) |
| A23 | Phạm vi leo | Bước lên tối đa 0.5 m (dốc đi được, vách 3 m thì không); tiếp đất khi cắt mặt phẳng từ trên xuống |
| A24 | Bóng Mực và địa hình | Chỉ đi trên cùng một mức mặt đất; bị vách/hố chặn (không tìm đường); vì vậy trên Đêm 3 Bóng Mực không lên tầng 1/2 |
| A25 | Wander | Đi chậm 2 m/s theo hướng ngẫu nhiên đổi mỗi 120 tick. `spawning` kéo dài 30 tick (không di chuyển, không gây hại) |
| A26 | `state_ticks_left` | Số tick còn lại của trạng thái; scenario không nêu thì spawning=30, recoil=60, stunned=120 |
| A27 | Recoil | Đúng 60 lần dịch 2/60 m sau hit |
| A28 | Vùng an toàn lúc đèn vừa thắp | Bóng Mực trong vùng được đẩy hướng ra mép với bước = khoảng còn lại / số tick còn lại (tới mép ở tick thứ ≤ 30), không gây sát thương, không đuổi trong thời gian đó; Bóng Mực bắt đầu trong vùng ở scenario cũng được xử lý như vậy |
| A29 | Gió Lạc | Sinh trên điểm sinh Bóng Mực của đêm, cao +1.5 m; đi lượn 2 m/s (đổi hướng/120 tick); bay xuyên địa hình; idle cũng cướp nếu chạm và đang mang ≥ 1 |
| A30 | Gió mạnh | Cơn k bắt đầu tại tick 1800k (k ≥ 1), kéo dài 300; hướng chọn bằng `rng` tại tick 1800k-120; `dir_deg` là góc nguyên (cos, sin) trên (X, Z); snapshot giữ `dir_deg` của cơn gần nhất |
| A31 | Đom đóm rơi do Gió Lạc thả | Tại vị trí XZ của Gió Lạc, độ cao mặt đất dưới nó; TTL 480 |
| A32 | `night_start` | Sự kiện tick 0 ghi ngay sau snapshot tick 0 |
| A33 | Chọn điểm sinh | `rng` chọn đều trong các điểm hợp lệ (chỉ cần đủ điều kiện khoảng cách/chưa chiếm/không trong vùng an toàn); thứ tự đặt lần lượt |
| A34 | Điểm Tổng nhiều Đêm | Tính ở `Campaign` (không thuộc headless): tổng điểm các Đêm thắng |
