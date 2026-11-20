# Đảo Đèn Lồng

<!-- Video demo: (thêm link ở Phase 4) -->

Game 3D góc nhìn thứ ba. Mây, người giữ đèn nhỏ tuổi, gom đom đóm để thắp lại các Đèn Lồng Lớn qua **3 Đêm** (Đảo Bến, Đảo Cau, Đảo Chuông). Đèn lồng cạn dầu dần: mục tiêu là **giữ đảo sáng tới bình minh**, trong khi né Bóng Mực (chúng hút dầu những ngọn đèn yếu) và Gió Lạc.

## Cài đặt và chạy (Node.js >= 20, macOS/Linux/Windows)
```bash
npm install
npm start          # mở http://localhost:8081
npm test           # 59 kịch bản headless + campaign
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

## Luật chơi (Ticket-03, số chuẩn ở `game.contract.json`)
- **Đèn có dầu.** Thắp lần đầu cần 10 đom đóm (đèn sáng với 100 dầu). Dầu hao 1/giây; hết dầu đèn tắt. Nhấn **E** ở đèn đang sáng để châm dầu: mỗi đom đóm +10 dầu. Đèn đã từng sáng chỉ cần 5 đom đóm để thắp lại. Dưới 30 dầu đèn nhấp nháy chậm và mất vùng an toàn 6 m.
- **Thắng:** còn sống khi hết giờ (bình minh) và số đèn đang sáng ≥ 60% tổng (Đêm 1: 3/5, Đêm 2: 4/6, Đêm 3: 5/7). Thắp đủ đèn không kết thúc đêm. **Thua:** hết Ngọn Lửa, hoặc bình minh mà đèn sáng chưa đủ. Đêm 1/2/3 dài 240/270/300 s.
- **Sức chứa đom đóm** = 10 + 2 × số lần thắp thành công trong đêm (tối đa 20).
- **Bóng Mực** (4.0 m/s, Đêm 3: 4.5) phát hiện 12 m, bỏ đuổi 18 m. Khi lang thang chúng tìm tới đèn yếu nhất, đứng cách ≤ 2 m và hút 5 dầu/giây (cộng dồn); Mây tiến lại gần (≤ 6 m) thì chúng quay sang đuổi. Chạm: -1 Ngọn Lửa, rơi một nửa đom đóm, bất tử 1.5 s. Tỏa Sáng làm choáng 2 s, đẩy lùi 4 m (và được 15 điểm nếu nó đang hút dầu).
- Rơi khỏi đảo (Y < -10): -1 Ngọn Lửa, mất hết đom đóm, hồi sinh sau 1 s.
- Gió Lạc (Đêm 2-3) cướp tới 3 đom đóm của người mang ≥ 5; Tỏa Sáng đuổi nó và buộc nó thả lại. Bùa Gió: chạy 7.2 m/s, lướt không hồi chiêu trong 10 s. Đêm 3 có gió mạnh (báo trước 2 s).
- **Điểm:** +5 mỗi đom đóm nạp/châm, +100 thắp lần đầu, +40 thắp lại, +5 mỗi Bóng Mực trúng Tỏa Sáng; khi thắng ở bình minh: mỗi đèn sáng +50 + phần nguyên của dầu, mỗi Ngọn Lửa +50. Tổng điểm = tổng các Đêm đã thắng.
- Cài đặt (âm lượng, độ nhạy chuột, **bảng màu dễ phân biệt**) lưu trong localStorage. Âm thanh tổng hợp bằng WebAudio.

## Headless (Test Contract v1.2)
```bash
node src/headless.js --seed 1 --night 1|2|3 --ticks 600 --out out.jsonl \
  [--scenario s.json] [--inputs i.json] [--snapshot-every 10]
```
Mã thoát: 0 thành công, 2 nếu scenario/inputs sai định dạng, 1 tham số sai, 3 lỗi nội bộ. Cùng seed + scenario + inputs cho output giống hệt từng byte. Một Đêm đầy đủ (21.600 tick) chạy dưới 2 s.

## Cấu trúc
`src/sim.js` (luật, thuần) · `src/maps.js` (3 bản đồ + địa hình) · `src/campaign.js` · `src/headless.js` · `web/` (three.js, UI, âm thanh) · `tests/` · `docs/spec` (tiêu chí nghiệm thu) · `docs/notes` (giả định, nhật ký AI) · `docs/proof` (bằng chứng theo phase) · `AGENTS.md` + `.claude/` (harness).

## Sáng tạo của tôi
- Giao diện: bản đồ nhỏ xoay theo camera, bảng dầu từng đèn, thông báo sự kiện, đèn lồng Hội An, hiệu ứng phát sáng (bloom). Tất cả chỉ ở `web/`, không đổi đầu ra headless (`npm test` vẫn đạt).
Chưa thêm cơ chế ngoài yêu cầu (ưu tiên lõi đúng). Chỉ có hiệu ứng hiển thị nhỏ trong `web/` (vòng sáng Tỏa Sáng, nhấp nháy bất tử, mũi tên chỉ đèn), không ảnh hưởng headless.

## Tài liệu
[Giả định](docs/notes/assumptions.md) · [Spec Ticket-02](docs/spec/ticket-02.md) · [Spec Ticket-03](docs/spec/ticket-03.md) · [ADR](docs/adr/0001-lantern-fuel-and-dawn-victory.md) · [CHANGELOG](CHANGELOG.md) · [Bằng chứng Phase 3](docs/proof/phase-3/README.md) · [Nhật ký AI](docs/notes/ai-log.md)
