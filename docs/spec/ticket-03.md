# Spec: Ticket-03 "Đèn cạn dầu" (Phase 3, Contract v1.2)

Tiêu chí nghiệm thu và test tương ứng (`tests/headless.test.js`, các test có tiền tố `[T3]` hoặc `[Ticket-03]`). Quyết định thiết kế: [ADR 0001](../adr/0001-lantern-fuel-and-dawn-victory.md). Thay đổi phá vỡ: [CHANGELOG](../../CHANGELOG.md).

| Yêu cầu | AC (kiểm chứng được) | Test |
|---|---|---|
| Nhiên liệu | Vừa thắp fuel = 100; hao 1/s chính xác theo 1/60 (tick 60 = 99.0, tick 600 = 90.0); snapshot có `fuel`, `ever_lit`, `relit_count`, đèn tắt fuel 0 | `[T3] fuel...` |
| Châm dầu | `used = min(mang, ceil((100-fuel)/10))`, +10 mỗi cái, trừ đom đóm, +5 điểm mỗi cái, sự kiện `refuel {lantern_id, amount, fuel}`; không mang gì thì không sự kiện/điểm | `[T3] refuel...` |
| Chọn đèn | Gần nhất trong 2 m trong các đèn nhận được (chưa sáng hoặc chưa đầy), bằng nhau thì id nhỏ | `[T3] interaction picks...` |
| Hết dầu | fuel ≤ 0 ngay sau bước 2: `lantern_out`, `deposited = 0`, `ever_lit` giữ true | `[T3] a lantern whose fuel reaches 0...` |
| Thắp lại | `ever_lit` cần 5 (+40 điểm, `relight:true`, `relit_count`+1); lần đầu cần 10 (+100); thiếu thì chưa sáng | `[T3] relight costs 5...` |
| Vùng an toàn | Mất khi fuel < 30; đúng 30 vẫn còn (đẩy Bóng Mực ra, không sát thương) | `[T3] a lantern below 30...` |
| Bóng Mực chọn đèn | Wander tìm đèn sáng fuel < 30 gần nhất (bằng nhau id nhỏ), không có thì đèn tắt gần nhất, không có thì lượn; chase không đổi mục tiêu | `[T3] wandering shades...` |
| Drain | ≤ 2 m: trạng thái `drain`, đứng yên, hút 5/s (cộng dồn, cộng cả hao 1/s), `fuel_drain` mỗi 60 tick | `[T3] drain...`, `drain stacks...` |
| Thoát drain | Mây ≤ 6 m → chase; fuel ≥ 30 → wander + đẩy ra không sát thương; đèn tắt → wander; > 2 m → wander; Tỏa Sáng → stunned (+15) | `[T3] drain exits...`, `pulse on a draining shade` |
| Luật thắng | Không thắng sớm; hết giờ: sống và đèn sáng ≥ ceil(0.6n) (3/5, 4/6, 5/7) → `dawn_survived`, ngược lại `dawn`; hết lửa luôn `no_flames`; đèn cạn đúng tick cuối không được tính | `[Ticket-03] no early win`, `win at dawn...`, `last-tick rules` |
| Thời gian | 240 / 270 / 300 s | `maps`, `contract` |
| Sức chứa | `min(20, 10 + 2 × successful_lights)`; đèn đặt sẵn không tính; HUD đang mang/sức chứa; nhặt theo sức chứa mới | `[T3] capacity...`; HUD: trình duyệt |
| Điểm | +5/đom đóm nạp, +100 lần đầu, +40 thắp lại, +5/+15 Tỏa Sáng, bình minh +50+floor(fuel) mỗi đèn sáng, +50 mỗi lửa, bỏ thưởng thời gian | `deposit`, `[T3] ambient scoring`, `win at dawn...`, `pulse on a draining shade` |
| Mù màu | Cài đặt "Bảng màu dễ phân biệt" được lưu; viền/mắt Bóng Mực #00B3FF; cảnh báo UI trắng + ⚠; đèn tắt xẹp 20% có vết rách; đèn sắp cạn nhấp nháy 1 Hz | Trình duyệt (ảnh `docs/proof/phase-3/`) |
| Contract v1.2 | `contract_version 1.2`, tuning/score keys mới, scenario/snapshot/sự kiện mới, kiểm tra định dạng | `contract v1.2...`, `validation of the new scenario fields` |
