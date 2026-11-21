# Retro: Đảo Đèn Lồng (4 phase, Day 12 AI SDLC)

## Số liệu
| | Phase 1 | Phase 2 | Phase 3 | Phase 4 |
|---|---|---|---|---|
| Contract | v1.0 | v1.1 | v1.2 | v1.3 |
| Test (tự viết, `npm test`) | 16 | 42 → 43 | 59 | 73 |
| Test cũ viết lại vì luật đổi | n/a | toàn bộ số Phase 1 | 7 (có lý do trong CHANGELOG) | 0 |
| Một Đêm headless (21.600 tick) | < 0.1 s | ~0.25 s | 0.2 / 0.3 / 1.3 s | không đổi |
| Bench (máy dev, Iris Xe) | n/a | n/a | n/a | xem `docs/proof/phase-4/bench.json` |
| Token ước tính ([INFERENCE]) | 60-80k | 150-200k | 200-280k | 200-250k |

Tổng ước tính khoảng **0.6-0.8 triệu token** cho cả dự án. Đây là ước lượng theo độ dài phiên, không đọc từ bảng chi phí.

## Đánh giá từng phase
- **Phase 1:** đạt toàn bộ PRD-0. Quyết định đúng nhất là tách `sim.js` thuần ngay từ đầu, để headless và trình duyệt dùng chung một bộ luật. Hạn chế: chỉ chứng minh thắng/thua qua headless.
- **Phase 2:** đạt số chuẩn, 3 bản đồ và mọi tính năng mới, mỗi tính năng có scenario. Không làm hỏng phase trước, nhưng phải viết lại test Phase 1 theo số chuẩn. Điểm yếu: giao cả client cho một subagent, nó chạy quá lâu và tôi phải dừng giữa chừng rồi tự sửa phần dở.
- **Phase 3:** luật dầu và thắng ở bình minh có ADR, CHANGELOG và 17 test mới; 7 test cũ được viết lại có lý do, không skip. Sau tag còn hai vòng sửa theo phản hồi khi chơi thử (giao diện, xoay chuột).
- **Phase 4:** benchmark, soak, bảng xếp hạng, tiếp cận và đóng gói. Thay đổi lớn nhất về kỹ thuật là chuyển Bóng Mực và đom đóm sang instancing. Bench lúc đầu không đạt `p1_low_fps`.

## Điều hiệu quả khi làm với AI
- Viết test theo số trong ticket trước, rồi mới để AI sửa sim. Test đỏ thường lộ ra lỗi của chính test (đọc snapshot ở tick không có, kịch bản mâu thuẫn với luật) trước khi lộ lỗi sim.
- Sửa theo lô bằng script nhỏ (`node -e` thay chuỗi có kiểm tra "missing") rồi chạy test ngay: ít token hơn đọc lại cả file.
- Dùng trình duyệt headless để kiểm thật (ảnh, đo góc camera, đo font) thay vì tin lời "đã sửa".

## Những lần AI sai, cách phát hiện, cách chỉnh harness
| Lỗi | Phát hiện | Chỉnh |
|---|---|---|
| Test đọc snapshot tick 0 vì `--snapshot-every` mặc định 10 (lặp 3 lần) | expected/actual vô lý | Ghi vào `AGENTS.md` mục "Past agent mistakes", skill `verify-headless` có bảng tính tick |
| Kỳ vọng "thắng và chết cùng tick" (bất khả thi vì thứ tự S6 trước S9) | test đỏ, đọc lại thứ tự tick | Ghi vào `AGENTS.md` |
| Kết luận "hết lag chuột" chỉ dựa vào FPS | người dùng báo vẫn lag | Đo đúng đại lượng người dùng phàn nàn (góc camera theo tổ hợp phím); nguyên nhân thật là mất pointer lock |
| Bench tụt 64 fps vì tab kiểm thử còn chạy game song song | so lại sau khi đóng tab | Skill `browser-check`: đóng tab trước khi đo |
| Giao một subagent quá nhiều việc UI | chạy quá lâu, người dùng yêu cầu dừng | Tự làm tuần tự từ Phase 3; nếu tách thì tách nhỏ theo file |
| Soak RSS 1.18× sát ngưỡng | đo heap sau GC: không rò rỉ, chỉ là V8 nới heap/JIT | Dùng `--lite-mode`, ghi `heap_used_*` vào `soak.json` để minh bạch |

## Harness giúp nhiều nhất
1. **`AGENTS.md`** ngắn, có lệnh, bố cục, quy tắc và "lỗi đã gặp". Nhờ nó các phiên sau không lặp lại lỗi `every`.
2. **Hook Stop chạy `npm test`**: không thể kết thúc khi test đỏ.
3. **Skill `verify-headless`** (cách viết scenario, bảng tính tick) và **`scripts/prove.mjs`** (tạo lại bằng chứng, không sửa tay).
4. CI GitHub Actions chạy `npm test` mỗi lần push.

## Tiết kiệm token
Không đọc lại file đã có; sửa bằng patch có kiểm tra; chạy test hẹp trước, cả bộ sau; chỉ chụp ảnh khi cần xác nhận hình ảnh; dừng subagent khi nó đi lạc; bỏ trao đổi dài dòng trong báo cáo.

## Nếu làm lại
- Đo hiệu năng phía client ngay từ Phase 2 (instancing sớm), không đợi tới ticket benchmark.
- Viết ADR cho các giả định lớn (địa hình Bóng Mực, nhịp gió) ngay khi đặt ra, vì đó là chỗ test ẩn dễ lệch nhất.
- Tách client thành module nhỏ từ đầu; `web/main.js` phình to và khó sửa an toàn ở Phase 4.
- Chơi thử bằng người sớm hơn: lỗi xoay chuột chỉ lộ ra khi chơi thật.
