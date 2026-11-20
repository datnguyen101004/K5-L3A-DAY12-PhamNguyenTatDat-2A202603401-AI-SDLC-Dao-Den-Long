# Đảo Đèn Lồng

<!-- Video demo: (thêm link ở Phase 4) -->

Game 3D góc nhìn thứ ba. Mây, người giữ đèn nhỏ tuổi, gom đom đóm để thắp lại các Đèn Lồng Lớn qua **3 Đêm** (Đảo Bến, Đảo Cau, Đảo Chuông) và né Bóng Mực, Gió Lạc.

## Cài đặt và chạy (Node.js >= 20, macOS/Linux/Windows)
```bash
npm install
npm start          # mở http://localhost:8081
npm test           # 43 kịch bản headless + campaign
```
`http://localhost:8081/?night=2` (hoặc 3) bỏ qua menu để vào thẳng thẻ giới thiệu của đêm đó (dùng để kiểm thử).

## Điều khiển
| Phím | Việc |
|---|---|
| W A S D / mũi tên | Di chuyển (theo hướng camera) |
| Space | Nhảy |
| Shift | Lướt (14 m/s, 0.2 s, hồi 1.5 s) |
| E | Nạp đom đóm vào đèn gần nhất (trong 2 m) |
| F | Tỏa Sáng: xua Bóng Mực (3 đom đóm, hồi 3 s) |
| Nhấp vào màn hình, rồi rê chuột / Q, Z | Xoay camera (Esc nhả chuột và tạm dừng) |
| Esc / P | Tạm dừng (Tiếp tục / Chơi lại Đêm / Cài đặt / Về menu) |
| R / Enter | Tiếp tục ở màn kết quả / bắt đầu Đêm |

## Luật chơi (số chuẩn Ticket-02, nằm ở `game.contract.json`)
- Mang tối đa 10 đom đóm; một đèn cần 10 (nạp nhiều lần được, đèn nhớ tiến độ). Đèn sáng tạo vùng an toàn 6 m.
- Bóng Mực (4.0 m/s, Đêm 3: 4.5) phát hiện 12 m, bỏ đuổi 18 m; biết đi vòng qua cầu, lên dốc, và quanh vùng sáng của đèn khi bị chặn. Chạm: -1 Ngọn Lửa, rơi một nửa đom đóm, bất tử 1.5 s. Tỏa Sáng làm choáng 2 s và đẩy lùi 4 m.
- Rơi khỏi đảo (Y < -10): -1 Ngọn Lửa, mất hết đom đóm, hồi sinh sau 1 s.
- Gió Lạc (Đêm 2-3) cướp tới 3 đom đóm của người mang ≥ 5; Tỏa Sáng đuổi nó và buộc nó thả lại. Bùa Gió: chạy 7.2 m/s, lướt không hồi chiêu trong 10 s. Đêm 3 có gió mạnh (báo trước 2 s).
- Thắng: thắp hết đèn. Thua: hết Ngọn Lửa hoặc hết giờ. Đêm 1/2/3: 300/330/360 s.
- Điểm: +10/đom đóm nạp, +100/đèn, +5/Bóng Mực trúng Tỏa Sáng; thắng thêm 2 × giây còn lại + 50 × Ngọn Lửa. Tổng điểm = tổng các Đêm đã thắng. Thắng Đêm 3 ra màn Bình Minh.
- Cài đặt (âm lượng, độ nhạy chuột) lưu trong localStorage. Âm thanh được tổng hợp bằng WebAudio, không dùng file.

## Headless (Test Contract v1.1)
```bash
node src/headless.js --seed 1 --night 1|2|3 --ticks 600 --out out.jsonl \
  [--scenario s.json] [--inputs i.json] [--snapshot-every 10]
```
Mã thoát: 0 thành công, 2 nếu scenario/inputs sai định dạng, 1 tham số sai, 3 lỗi nội bộ. Cùng seed + scenario + inputs cho output giống hệt từng byte. Một Đêm đầy đủ (21.600 tick) chạy khoảng 0.25 s.

## Cấu trúc
`src/sim.js` (luật, thuần) · `src/maps.js` (3 bản đồ + địa hình) · `src/campaign.js` · `src/headless.js` · `web/` (three.js, UI, âm thanh) · `tests/` · `docs/spec` (tiêu chí nghiệm thu) · `docs/notes` (giả định, nhật ký AI) · `docs/proof` (bằng chứng theo phase) · `AGENTS.md` + `.claude/` (harness).

## Sáng tạo của tôi
Chưa thêm cơ chế ngoài yêu cầu (ưu tiên lõi đúng). Chỉ có hiệu ứng hiển thị nhỏ trong `web/` (vòng sáng Tỏa Sáng, nhấp nháy bất tử, mũi tên chỉ đèn), không ảnh hưởng headless.

## Tài liệu
[Giả định](docs/notes/assumptions.md) · [Spec Ticket-02](docs/spec/ticket-02.md) · [Bằng chứng Phase 2](docs/proof/phase-2/README.md) · [Nhật ký AI](docs/notes/ai-log.md)
