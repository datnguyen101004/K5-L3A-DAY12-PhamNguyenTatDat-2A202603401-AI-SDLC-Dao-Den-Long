# Đảo Đèn Lồng

<!-- Video demo: (thêm link ở Phase 4) -->

Game 3D góc nhìn thứ ba. Mây, người giữ đèn nhỏ tuổi, gom đom đóm để thắp lại 5 Đèn Lồng Lớn trên Đảo Bến và né Bóng Mực trong sương đen.

## Cài đặt và chạy (Node.js >= 20, macOS/Linux/Windows)
```bash
npm install
npm start          # mở http://localhost:8080
npm test           # 16 kịch bản headless
```

## Điều khiển
| Phím | Việc |
|---|---|
| W A S D / mũi tên | Di chuyển (theo hướng camera) |
| Space | Nhảy |
| E | Nạp đom đóm vào đèn gần nhất (trong 3 m) |
| F | Tỏa sáng: xua Bóng Mực (tốn 1 đom đóm, hồi 2 s) |
| Q / Z | Xoay camera |
| R | Chơi lại (sau khi thắng/thua) |

## Luật chơi
- Đảo tròn bán kính 40 m, 5 đèn ở vòng bán kính 25 m. Mây có 3 ngọn lửa (máu), 300 giây tới bình minh.
- Đom đóm tự nhặt khi lại gần (1.5 m), mang tối đa 5. Mỗi đèn cần 5 đom đóm để sáng.
- Bóng Mực đuổi theo Mây; chạm (1 m) thì mất 1 ngọn lửa và rơi một nửa số đom đóm đang mang, rồi bất tử 1.5 s.
- Tỏa sáng: Bóng Mực trong 8 m bị choáng 3 s và bị đẩy lùi 3 m. Bóng Mực không vào được 5 m quanh đèn **đã sáng**.
- Thắng: thắp hết 5 đèn. Thua: hết lửa, hoặc hết 300 s.
- Điểm: +10 mỗi đom đóm, +100 mỗi đèn thắp, +20 mỗi Bóng Mực bị choáng; khi thắng thêm +2 mỗi giây còn lại và +50 mỗi ngọn lửa còn lại.

Đảo sáng dần (sương mỏng, ánh sáng nền tăng) mỗi khi thắp một đèn.

## Headless (Test Contract v1.0)
```bash
node src/headless.js --seed 1 --night 1 --ticks 600 --out out.jsonl \
  [--scenario s.json] [--inputs i.json] [--snapshot-every 10]
```
Khai báo trong `game.contract.json`. Mã thoát: 0 thành công, 2 nếu file scenario/inputs sai định dạng, 1 nếu thiếu/sai tham số, 3 lỗi nội bộ. Cùng seed + scenario + inputs cho output giống hệt từng byte.

`null`/`false` trong tuning: `fall_enabled = false` (không có rơi khỏi đảo; mép đảo là tường vô hình, nên không có sự kiện `player_hit` kiểu `fall`). Mọi khóa khác đều có giá trị thật.

## Cấu trúc
`src/sim.js` (toàn bộ luật, thuần) · `src/headless.js` (CLI) · `web/` (three.js, chỉ hiển thị + nhập liệu) · `tests/` · `docs/` (giả định, bằng chứng, nhật ký AI) · `AGENTS.md` + `.claude/` (harness).

## Sáng tạo của tôi
Phase 1: chưa có thêm cơ chế ngoài PRD-0 (ưu tiên lõi đúng). Hiệu ứng nhỏ chỉ ở phần hiển thị: vòng sáng lan khi tỏa sáng, Bóng Mực co lại khi choáng, Mây nhấp nháy khi bất tử.

## Tài liệu
- [Giả định](docs/notes/assumptions.md) · [Bằng chứng Phase 1](docs/proof/phase-1/README.md) · [Nhật ký AI](docs/notes/ai-log.md)
