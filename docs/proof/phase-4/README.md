# Bằng chứng Phase 4 (Ticket-04 "Bình minh", Contract v1.3)

Máy dev: Windows 11 x64, Intel i5-12500H, Intel Iris Xe (đồ họa tích hợp), 16 GB RAM, Node 22, Electron 45 (Chromium 156). Số đo trên máy chấm của giảng viên sẽ khác; các số dưới đây chỉ để tham khảo.

| Yêu cầu | Cách kiểm chứng | Bằng chứng | Kết quả |
|---|---|---|---|
| §1 Benchmark: cảnh chuẩn, công thức số liệu | `tests/bench.test.js`: công thức `avg_fps`, `p1_low_fps` (k = ceil(1%)), p95; cảnh 200 Bóng Mực / 100 đom đóm / L1-L3 dầu 100; chế độ bench tắt spawn, sát thương, nhặt, hao dầu, kết thúc; quỹ đạo camera | `npm-test.txt` | Đạt |
| §1 Benchmark: số đo (avg ≥ 60, p1 ≥ 30, load ≤ 10 s) | `node scripts/bench.mjs --seed 42 --duration 30 --out docs/proof/phase-4/bench.json` | `bench.json`: avg 166.2, p1 67.3, p95 9.0 ms, load 592 ms, peak 644 MB | Đạt trên máy dev |
| §2 Soak (crashes = 0, mem_end ≤ 1.2 × mem_start) | `node --expose-gc --lite-mode src/soak.js --seed 7 --nights 10 --out docs/proof/phase-4/soak.json`; `tests/soak.test.js` | `soak.json`: 0 crash, RSS 38.4 → 40.2 MB (1.05×), heap 4.1 → 4.2 MB | Đạt |
| §3 Bảng xếp hạng: luật tên, sắp xếp, top 10, ISO có múi giờ | `tests/leaderboard.test.js` (5 test) | `npm-test.txt` | Đạt |
| §3 Lưu đĩa, còn sau khi khởi động lại, lệnh xuất | test khởi động `server.js` 2 lần với thư mục dữ liệu tạm, rồi `--export-leaderboard` | `npm-test.txt`; `leaderboard-export.json` (xuất thật từ lần chơi thử) | Đạt |
| §3 Nhập tên sau thua / Bình Minh, màn hình từ menu | Chơi trong trình duyệt: thua Đêm 1 → tên "ab" bị từ chối → "Mây_Thử" lưu hạng 1 → menu → Bảng xếp hạng | `ui-lose-save.png`, `ui-leaderboard.png` | Đạt (màn Bình Minh dùng cùng form, chưa chơi trọn 3 Đêm để thấy) |
| §4 Đổi phím: trùng phím, khôi phục, lưu | Trình duyệt: đổi "Thắp / châm dầu" sang F → báo "Phím F đang dùng cho 'Tỏa Sáng'"; sang R → lưu, còn sau reload; "Khôi phục" → E | `ui-settings.png` | Đạt |
| §4 Phụ đề / chỉ báo | Trình duyệt: tick 300 hiện "[Bóng Mực xuất hiện cách 37 m]" × 2 kèm 2 mũi tên; "[Đèn L1 sắp cạn dầu]", đếm ngược 10 s | `ui-captions.png` | Đạt (cảnh báo gió Đêm 3 dùng cùng cơ chế, chưa chụp) |
| §4 Giảm chuyển động | Trình duyệt: bật cài đặt, cho Bóng Mực chạm Mây → Ngọn Lửa 3 → 2, `#hud-flash` display none, không có rung camera | ghi lại ở trên | Đạt |
| §4 Cỡ chữ ≥ 18 px ở 1280×720, chữ lớn ×1.25 | Quét mọi nút chữ đang hiển thị trong trình duyệt 1280×720: cỡ nhỏ nhất ở menu / cài đặt / giới thiệu / HUD / tạm dừng đều = 18 px; bật chữ lớn → gốc 22.5 px | ghi lại ở trên, `ui-hud.png` | Đạt |
| §5 README, CHANGELOG 4 phase, CREDITS, LICENSE, Release | Đọc file; Release v1.0.0 có gói chơi được bằng `node server.js` | `README.md`, `CHANGELOG.md`, `CREDITS.md`, GitHub Release | Đạt |
| §6 Contract v1.3, mọi yêu cầu v1.0-v1.2 giữ nguyên | test contract; toàn bộ 57 test headless cũ vẫn đạt; tất định 3 Đêm | `npm-test.txt`, `determinism.txt`, `perf-headless.txt` | Đạt |
| §7 Retro | `docs/notes/retro.md` | | Đạt |
| §7 Video demo | Cần người quay | | **Chưa có** (xem dưới) |

## Rà soát độc lập và hệ quả cho số đo
Reviewer độc lập đã rà Phase 4: [`review.md`](review.md) (nguyên văn + phân loại). Đã sửa 10 điểm; ba điểm ảnh hưởng tới benchmark (đám Bóng Mực đứng yên sau ~13 s, quỹ đạo camera sai chiều, mốc `load_ms`). **`bench.json` và bảng dưới đây là số đo TRƯỚC các sửa này, chưa đo lại**: hai lần chạy đầu sau khi sửa kết thúc bằng lỗi GPU của Electron và tôi dừng chạy theo yêu cầu. Cảnh mới có đám Bóng Mực di chuyển suốt 30 s nên có thể nặng hơn; hãy coi số đo là tham khảo cho tới khi đo lại. Soak đã chạy lại: xem `soak.json` (không cần đo lại do không đổi kết quả).

## Dao động của benchmark (trung thực)
Đồ họa tích hợp, vsync tắt, nên nhịp khung hình dao động giữa các lần chạy. Các lần chạy tôi đã làm (cùng mã, pixel ratio 1):

| Lần | avg_fps | p1_low_fps | frame_ms_p95 | load_ms |
|---|---|---|---|---|
| thử 1 | 177.1 | 64.6 | 8.4 | 466 |
| thử 2 | 183.1 | 85.3 | 7.5 | 923 |
| thử 3 (đang ghi file song song) | 141.8 | 32.7 | 9.9 | 544 |
| chính thức (`bench.json`) | 166.2 | 67.3 | 9.0 | 592 |

Trước khi tối ưu (mỗi Bóng Mực 4-5 mesh riêng, vẽ ở 1600×900 vì màn hình HiDPI 1.25): avg 92-116, p1 16.7-42.5. Một lần chạy khi tab trình duyệt kiểm thử còn mở song song ra avg 64.1 / p1 21.4, vì hai cảnh tranh nhau GPU. Lần chạy đầu tiên ngay sau khi cài Electron có `load_ms` 19.7 s (Windows quét file mới, tạo cache shader); các lần sau 0.45-0.9 s.

## Hạn chế
- Video demo phải do người quay (chơi trực tiếp + chạy `npm test`, bench). Tôi không quay được thay.
- Chưa thử trên macOS/Linux thật; bench cần môi trường có cửa sổ (không chạy được trên máy chủ không màn hình).
- `peak_mem_mb` là tổng working set của mọi tiến trình Electron (trình duyệt, GPU, renderer), không chỉ riêng game.
- Các ảnh UI tạo tình huống bằng `window.__app.game` (rút ngắn đêm để thua nhanh, thắp sẵn đèn), không phải chơi thuần.
