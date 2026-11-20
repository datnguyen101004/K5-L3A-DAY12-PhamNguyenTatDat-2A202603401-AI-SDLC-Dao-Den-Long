# Spec: Ticket-02 "Ba hòn đảo" (Phase 2, Contract v1.1)

Mỗi mục có tiêu chí nghiệm thu (AC) kiểm chứng được và test tương ứng (`tests/headless.test.js`, trừ khi ghi "trình duyệt"). Số chuẩn nằm ở `game.contract.json`; bản đồ ở `src/maps.js`.

## Phần 1 - số liệu chuẩn (thay mọi số tự chọn ở Phase 1)
| AC | Test |
|---|---|
| Chạy 6.0 m/s, vận tốc tức thời (≤ 0.1 s); điều khiển đầy đủ trên không | `tick model`, `camera yaw...` |
| Nhảy 7 m/s, trọng lực 20, chỉ khi chạm đất | `jump` |
| Lướt 14 m/s × 12 tick, hồi 90 tick từ lúc bắt đầu, nhấn khi đang lướt bị bỏ qua, giữ độ cao, không bất tử, đứng yên thì theo hướng nhìn | `dash...` (2 test) |
| Nhặt XZ ≤ 1.0 và lệch cao ≤ 1.5; sức chứa 10 | `pickup` |
| Đèn: nạp nhiều lần, nhớ tiến độ, gần nhất / id nhỏ, 10 đom đóm, +10/đom đóm nạp, +100/đèn | `deposit...` |
| Vùng an toàn 6 m, đèn vừa thắp đẩy Bóng Mực ra ≤ 30 tick không sát thương | `safe zone`, `lighting a lantern expels...` |
| Tỏa Sáng: 3 đom đóm, tâm +0.8 m, 3D ≤ 5 m, choáng 120, đẩy 4 m/15 tick (+X nếu trùng), +5/lần, hồi 3 s | `pulse...` (2 test) |
| Bóng Mực qua cầu / lên dốc bằng đường đi BFS khi bị chặn, thoáng thì đi thẳng (A24) | `smarter shades...` |
| Bóng Mực 4.0 m/s, phát hiện 12 / bỏ 18, chạm, 1 hit/tick, recoil 2 m/60 tick, hit lúc bất tử không làm gì | `shade AI`, `shade hit...`, `invulnerable player...` |
| Hậu quả bị đánh: -1 lửa, rơi floor(n/2) vành 1.5–2.5, TTL 480, bất tử 90 | `shade hit...`, `dropped mote TTL` |
| Rơi (Y < -10): đúng 1 lần, bỏ qua bất tử, mất hết đom đóm, chờ 60 tick, hồi sinh bất tử 90; hết lửa thì thua ngay | `fall...` (2 test) |
| Lịch sinh: đom đóm 20 + 1/240 tick (trần 30, bỏ lượt khi hết điểm); Bóng Mực 2 tại tick 300 rồi theo chu kỳ, ≥ 15 m, id S1, S2... | `spawn schedule...` (2 test) |
| Thắng/thua theo thứ tự S11 (no_flames trước, thắng cả tick hết giờ, rồi dawn); điểm chuẩn | `win...`, `loss...` |
| Tạm dừng: tick tăng, sim_tick/thời gian/hồi chiêu đứng yên, `paused`/`resumed`, state "paused" | `pause...` |

## Phần 2 - bản đồ
| AC | Test |
|---|---|
| Đêm 1/2/3: số đèn 5/6/7, thời lượng 300/330/360, vị trí đèn khớp bảng | `maps...` |
| Đêm 2: cầu tre nối hai đảo, ngoài cầu thì rơi; 2 bục nhảy bắn sang đảo kia (đáp trong ~84 tick, trong bán kính 28 m) | `night 2...` |
| Đêm 3: vách đứng chặn, dốc 30°/150° leo được lên Y=3, bục (0,3,13) đáp tầng 2, tháp chuông đặc, bước ra khỏi tầng thì rơi xuống | `night 3: cliffs...` |
| Gió mạnh Đêm 3: tick 1800k..+300, hướng ngẫu nhiên (cố định trong cơn), đẩy 2 m/s, báo trước 120 tick; `wind_enabled:false` tắt | `night 3 wind...`, `wind warning...` |

## Phần 3 - tính năng mới
| Tính năng | AC | Kiểm chứng |
|---|---|---|
| Gió Lạc | Chỉ Đêm 2-3, tối đa 2, sinh tại tick 1200k, id D1.. ; idle→chase khi mang ≥ 5 và ≤ 15 m; chạm XZ ≤ 1.2 cướp min(3, đang mang) một lần, flee 240 tick rồi biến mất; không mất lửa; không bị vùng an toàn/bất tử chặn | `drifter...`, `drifter schedule...` |
| Tỏa Sáng vs Gió Lạc | trúng đang chase → flee không cướp; trúng lúc flee có đồ → thả toàn bộ (đom đóm rơi) + biến mất sau 120 tick | `pulse: chase drifter...` |
| Bùa Gió | Nhặt như đom đóm; 600 tick: chạy 7.2 m/s, lướt không hồi chiêu (vẫn cần bấm lại); xuất hiện lại sau 2700 tick; vị trí theo đêm | `charm...` (3 test) |
| Chuỗi 3 Đêm | thắng → đêm kế; thua → chơi lại đêm đó; thắng Đêm 3 → Bình Minh; tổng điểm = tổng các Đêm đã thắng | `tests/campaign.test.js`; menu/intro/kết quả/Bình Minh: trình duyệt (xem `docs/proof/phase-2/README.md`) |
| Tạm dừng UI | Esc/P; Tiếp tục / Chơi lại Đêm / Cài đặt / Về menu; logic dừng hoàn toàn | sim: test `pause`; UI: trình duyệt |
| Cài đặt | Âm lượng + độ nhạy chuột, lưu qua lần mở sau (localStorage) | trình duyệt |
| Âm thanh | Nhạc nền đêm + 10 hiệu ứng yêu cầu (tổng hợp bằng WebAudio, không file) | trình duyệt (nghe được không tự động kiểm) |
| HUD | Bố cục theo ticket, đồng hồ đỏ nhấp nháy ≤ 30 s, thanh 10 ô, hồi chiêu, nhắc "E — Nạp ánh sáng (x/10)", mũi tên chỉ đèn | trình duyệt (ảnh chụp) |
| Bảng màu / ánh sáng | màu chuẩn ±10%; ánh sáng môi trường = 0.15 + 0.55 × (đèn sáng / tổng đèn) | trình duyệt |

## Contract v1.1
Snapshot có `night`, `wind`, `player.{vel,grounded,invuln,dash_cd_s,pulse_cd_s,charm_s}`, `motes[{id,pos,kind,ttl_s}]`, `drifters`, `charms`; scenario/input mở rộng; sự kiện mới; tên trạng thái Bóng Mực `spawning|wander|chase|recoil|stunned`; một Đêm đầy đủ ≤ 30 s (đo thực: ~0.25 s, `docs/proof/phase-2/perf-headless.txt`).
