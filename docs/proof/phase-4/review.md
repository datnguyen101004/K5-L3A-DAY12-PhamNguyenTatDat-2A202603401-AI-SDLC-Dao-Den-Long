# Review độc lập Phase 4 (reviewer agent, chỉ đọc)

Người review: agent `reviewer`, khác agent đã viết code, chạy chỉ đọc (không sửa repo, không chạy benchmark). Phần "Kết quả gốc" dưới đây giữ **nguyên văn**, không chỉnh sửa. Phần "Phân loại của tác giả" do tôi thêm.

## Phân loại của tác giả
| # | Mức | Kết luận | Xử lý |
|---|---|---|---|
| 1 | Trung bình | **Đúng, đã sửa.** Trong cảnh bench, Bóng Mực đứng yên sau ~13 s (dồn về đèn tắt L4/L5 hoặc về Mây) nên số đo thiếu thực tế | Chế độ bench bỏ tìm đèn và bỏ chuyển sang đuổi; chỉ lang thang. Test `crowd keeps wandering` kiểm 6 cửa sổ 5 s, ≥ 190/200 con di chuyển |
| 2 | Trung bình | **Đúng, đã sửa.** Quỹ đạo camera đi +X→+Z là chiều kim đồng hồ khi nhìn từ trên xuống; ticket yêu cầu ngược chiều | `orbitCamera` đổi dấu z (30,15,0) → (0,15,−30); test cập nhật. A53 sửa lại |
| 3 | Trung bình | **Đúng, đã sửa.** A48–A63 chưa nằm trong tag | Commit cùng đợt này, chuyển tag `phase-4` và Release |
| 4 | Trung bình | **Đúng, đã sửa tài liệu.** Không có `--lite-mode` RSS tăng ~1.27× (không phải 1.18× như tôi ghi) | A57 và proof ghi số đo của reviewer; nói rõ bài đạt nhờ cờ này. Heap thực vẫn phẳng. Thêm `--no-expose-wasm` để hết cảnh báo |
| 5 | Trung bình | **Đúng, chưa xử lý được.** Video phải do người quay | README vẫn ghi chưa có video |
| 6 | Thấp | **Đúng, đã sửa.** Seed Đêm i tính từ 0 | `soakPlan`: Đêm i (từ 1) dùng seed + i; test |
| 7 | Thấp | **Đúng, đã sửa.** `Game` Đêm đầu bị GC trước khi đo `mem_start` | Giữ tham chiếu `Game` khi đo rồi chơi đúng ván đó |
| 8 | Thấp | **Đúng, đã sửa.** Tỉ lệ nhấn thực tế thấp hơn ticket (4.7/9.0/2.9/2.0%) | Xác suất giữ phím q = (1 − √(1 − 4p))/2 để tỉ lệ cạnh lên đúng 5/3/2/10%; test đo 200.000 tick |
| 9 | Thấp | **Đúng, đã sửa.** Tên nhận cả chữ số/chữ cái không phải Latin-Việt | Chỉ `[A-Za-z0-9_]` và chữ Việt (kiểm trên dạng phân rã); thêm test các tên bị từ chối |
| 10 | Thấp | **Đúng, đã sửa.** `load_ms` đo từ lúc nạp module, không phải lúc bắt đầu tiến trình | `performance.timeOrigin` làm mốc; mốc khung đầu lấy sau khi vẽ xong |
| Linux | Cần xác nhận | **Chấp nhận, thêm `no-sandbox` trên Linux**, chưa thử trên Linux thật | `scripts/bench-main.cjs` |
| Test yếu | | **Đã tăng cường**: p95 nearest-rank, chuyển động trong cửa sổ đo, tên không hợp lệ, seed/vòng quay/tỉ lệ input của soak | `tests/*.test.js` |

**Chưa kiểm chứng sau khi sửa:** các thay đổi ở finding 1, 2, 10 chạm vào đường chạy benchmark. Hai lần chạy bench đầu tiên sau khi sửa kết thúc bằng lỗi GPU của Electron ("GPU state invalid", "Render frame was disposed"), và tôi dừng chạy lại theo yêu cầu của chủ dự án. Vì vậy `bench.json` trong repo là kết quả **trước** các sửa này (cảnh còn đứng yên một nửa thời gian) và **chưa được đo lại**. Phần logic (sim, thống kê, quỹ đạo, soak, bảng xếp hạng) được `npm test` bao phủ.

## Kết quả gốc của reviewer (nguyên văn)

I found 10 problems: 4 medium and 6 low, plus 3 weak tests. None of them is a rule or contract deviation in `src/sim.js` or `src/headless.js`. The core simulation follows the mandated tick order and the Ticket-03 fuel, drain and win rules.

I ran the following, writing only to the OS temp dir:
- `npm test`: 70 of 70 pass.
- The soak with the contract command, with `--expose-gc` only, and with no flags.
- Read-only `node` probes of the bench scene, the soak input and the name rule.
- `node server.js` on a spare port, checking the main routes.

I did not run `scripts/bench.mjs` and did not edit anything in the repo.

## Findings

**1. Medium: the bench crowd stops moving for the second half of the measured window**
- **File:** `src/sim.js:810-862` (`seekLantern` / `moveShades`) with `bench: true`; scene from `src/bench.js:18-40`.
- **Ticket vs code:** Ticket-04 §1 says shades "still move by normal wander rules" over the measured window. In the code, every "wander" shade heads for the nearest unlit lantern, and only L4 and L5 are unlit. Once a shade is within 2 m of one, it stands still. Shades within 12 m of Mây switch to chase, and those that reach her stop on top of her.
- **Evidence (probe of the bench scene, seed 42):**
  - At t=18 s: 162 shades are in wander and 38 in chase. 83 target L4, 95 target L5, 22 have no target. 38 are within 2 m of the origin.
  - Number of shades that moved more than 5 cm in each 5 s window: t 3–8 s: 121; 8–13: 45; 13–18: 0; 18–23: 0; 23–28: 0; 28–33: 0.
- **Effect:** for about 18 of the 30 measured seconds, all 200 shades sit motionless in three piles, so `avg_fps` and `p1_low_fps` measure a static scene.
- **Note:** this is how the "normal" Ticket-03 wander rule plays out, so whether it violates the ticket **needs confirmation**. The ticket clearly expects visible movement, though.
- **Fix:** in bench mode, give wander shades plain random wander (skip `seekLantern` and the 12 m chase check), or document the frozen crowd in the bench notes.

**2. Medium, needs confirmation: the camera orbit turns clockwise seen from above**
- **File:** `src/bench.js:44-46`. The code is `return [ORBIT.radius * Math.cos(a), ORBIT.height, ORBIT.radius * Math.sin(a)];`.
- **Ticket vs code:** the ticket says counter-clockwise seen from above, starting at (30,15,0). three.js is right-handed with Y up, and `web/world.js:743` itself notes that "screen right is −X" when looking along +Z, so nothing is mirrored. Seen from +Y, the path goes +X → +Z, which is clockwise. A counter-clockwise turn goes +X → −Z.
- **Documented?** Assumption A53 reuses the map-angle convention from A18. That is a defensible reading only if the ticket author also meant +X → +Z by "counter-clockwise" in the maps. As written for the bench, it is most likely a misreading.
- **Fix:** `return [R*Math.cos(a), H, -R*Math.sin(a)]`, or get the convention confirmed.

**3. Medium: the Phase 4 assumptions A48–A63 are not in the tagged release**
- **File:** `docs/notes/assumptions.md`.
- **Evidence:** `git status` shows ` M docs/notes/assumptions.md` (25 lines added: the A48–A63 table). `git rev-list -n1 phase-4` and `v1.0.0` both point to `d0d934a`, which is HEAD. `git show HEAD:docs/notes/assumptions.md` ends at A47.
- **Effect:** a fresh clone of the tag has no written justification for the orbit direction (A53), the `--lite-mode` flag (A57), the soak input rule (A58), the name rule (A59) and so on. The documented-assumption defence for findings 2, 4, 6 and 7 is therefore not in the submission.
- **Fix:** commit the file and move the `phase-4` and `v1.0.0` tags to that commit.

**4. Medium: the soak only passes because of `--lite-mode`, and the docs understate the growth without it**
- **Files:** `game.contract.json:8` (`"soak_cmd": "node --expose-gc --lite-mode src/soak.js"`) and assumption A57.
- **Ticket vs code:** the pass rule is `mem_end_mb ≤ 1.2 × mem_start_mb`. A57 says the growth is "about 1.18×" without the flag.
- **Evidence (Node 22.22.2, seed 7, 10 nights):**

| Flags | mem_start_mb → mem_end_mb | Ratio |
|---|---|---|
| `--lite-mode` (contract command) | 29.3 → 31.5 | 1.08× (pass) |
| `--expose-gc` only | 35.7 → 45.4 | **1.27× (fail)** |
| no flags | 34.8 → 44.1 | 1.27× |

- `--lite-mode` also turns off V8's optimizing compiler, so the soak does not run the code the way the game does. The contract command also prints `Warning: disabling flag --expose_wasm due to conflicting flags` to stderr.
- **Fix:** correct A57 and the proof to the measured 1.27×, and either explain the RSS growth or say plainly that the pass depends on the flag.

**5. Medium: the demo video (§7) is missing**
- **File:** `README.md:3`. It reads `**Video demo:** _(link Release v1.0.0 / docs/demo/demo.mp4, thêm khi quay xong)_` ("add when recorded").
- `docs/proof/phase-4/README.md` also marks §7 video as **"Chưa có"** (not done).
- **Fix:** record a video under 5 minutes and link it in the README and the release.

**6. Low, needs confirmation: soak night seeds count from 0, the game counts from 1**
- **File:** `src/soak.js:72`. The code is `const seed = o.seed + i;` with `i` starting at 0.
- **Ticket vs code:** the ticket says "night i uses seed 7 + i" and numbers the nights from 1 ("1→2→3"). The code gives night 1 seed 7 and night 10 seed 16. The browser campaign uses `campaign.seed + night` with night starting at 1 (`web/main.js:110`), so the repo uses both conventions.
- **Fix:** `const seed = o.seed + i + 1;`, or record the 0-based reading as an assumption.

**7. Low: `mem_start_mb` is measured after the first night has already been garbage-collected**
- **File:** `src/soak.js:76-77`. The code is `new Game({ seed, night, tuning }); memStart = measure();`, and `measure()` calls `global.gc()` first.
- **Ticket vs code:** the ticket wants RSS "after the first night has loaded". Because the new `Game` is never stored, the forced GC collects it before RSS is read. `playNight` then builds a second one. The comment "build it, measure, then play that same night" does not match the code.
- **Fix:** `const first = new Game(...); memStart = measure();`, then play `first`.

**8. Low: soak button presses come out slightly below the ticket rates**
- **File:** `src/soak.js:42-45`. Buttons are redrawn every tick, but the game only counts a press when the button goes from released to held.
- **Evidence (200,000 ticks):** effective rates are jump 4.71%, interact 8.96%, dash 2.92%, pulse 1.97%, against the ticket's 5 / 10 / 3 / 2%.
- Documented as A58, which is not committed (see finding 3).
- **Fix:** raise the draw probability to `p' = (1 − √(1 − 4p)) / 2` (e.g. 0.1127 for 10%), or state the effective rates in the docs.

**9. Low: leaderboard names accept far more than `[A-Za-z0-9_]` plus Vietnamese**
- **File:** `src/leaderboard.js:8`. The pattern is `/^[\p{Script=Latin}\p{Nd}_]{3,12}$/u`.
- **Evidence:** `normalizeName` accepts `١٢٣` (Arabic-Indic digits), `ＡＢＣ` (fullwidth), `ⅠⅡⅢ` (Roman numerals), `ªºª`, `ǅǅǅ`, `Ꜳꜳꜳ` and `٣ab`.
- **Fix:** use `0-9` instead of `\p{Nd}`, and limit letters to `A-Za-z` plus the Vietnamese letters, e.g. `[A-Za-z0-9_À-ÃÈ-ÊÌÍÒ-ÕÙÚÝà-ãè-êìíò-õùúýĂăĐđĨĩŨũƠơƯưẠ-ỹ]`.

**10. Low: `load_ms` does not start at process start**
- **Files:** `scripts/bench.mjs:10` (`const t0 = Date.now();`, which runs only after the ES-module imports have loaded) and `web/bench.js:30` (the stamp is taken at the start of the first frame callback, before that frame is drawn).
- **Ticket:** "from process start to the first frame". A54 documents the start-point choice; the error is tens of milliseconds.
- **Fix:** use `Math.round(performance.timeOrigin)` as `t0`, and take the stamp after the first `world.render()`.

### Weak tests
- **`tests/bench.test.js:45`** only checks that more than 150 shades are over 1 m from their start after 40 s. It passes while every shade has been motionless since about t=15 s (finding 1). It should check movement inside the 3–33 s window.
- **`tests/bench.test.js:49-54`** asserts that a quarter turn lands at (0,15,+30), which locks in the clockwise orbit (finding 2). The `frameStats` test data (98×10, 40, 60) gives a p95 of 10 under any percentile definition, so it does not pin down the nearest-rank choice.
- **`tests/leaderboard.test.js:15-16`** is titled "[A-Za-z0-9_]", but its rejected names are only CJK, spaces and symbols. That is why finding 9 goes unnoticed.
- **`tests/soak.test.js`** never checks the per-night seed, the 1→2→3 rotation or the input rates. It only checks that each result is `won` or `lost`. Also, every soak night ends by losing all flames between tick 821 and tick 3550, out of 14,400–18,000 ticks. The random player therefore exercises less than a quarter of each night, and nothing flags this.

**Possible break on Linux (needs confirmation, bench only):** `scripts/bench-main.cjs:9-12` does not pass `no-sandbox`. Electron from npm is known to abort on Ubuntu 23.10+ / 24.04 because of its sandbox restrictions, unless `chrome-sandbox` has been set up as SUID root. This affects only the bench command, not `npm start`. I could not test it here.

## Checked and OK
- **Tick order S1–S11:** `Game.step` runs pause, then counters + wind + fuel (lanterns at 0 go out right after), then move, pickup, interact, safe zones, pulse, shades/drifters, contact (drifters first, then shades by ascending id), spawns, win/loss. Checked by reading `src/sim.js:228-300`.
- **Fuel and drain:** fuel is kept as whole 1/60 units, decaying 1 per tick, plus 5 per tick per draining shade. `fuel_drain` fires every 60 ticks of each shade's own drain counter. `lantern_out` sets `deposited` to 0 and keeps `ever_lit`. Checked by reading, and by tests `[T3] fuel` / `drain` / `drain stacks`.
- **Refuel, lighting and capacity:** refuel uses `min(carried, ceil((6000−fuel)/600))`. Lantern choice is the nearest one that can take fuel, ties to the smaller id. Relighting costs 5 (+40 points), first lighting costs 10 (+100). Capacity is `min(20, 10+2n)`. Checked by reading `interact()` and the `[T3]` tests.
- **Safe zones and drain exits:** a zone exists when `fuel ≥ 30`. Drain exit order and the 15-point pulse on a draining shade match Ticket-03 and A41 / A46. Checked by reading and tests.
- **Win/loss:** losing all flames is checked first. At time up the night is won with `lit ≥ ceil(0.6n)`. The dawn bonus is `50+floor(fuel)` per lit lantern plus 50 per flame, with no early win. A lantern that runs dry on the last tick does not count. Checked by reading and the `[Ticket-03]` tests.
- **Contract v1.3:** `contract_version`, `bench_cmd`, `soak_cmd` and all tuning and score numbers are present and match the ticket numbers. Checked against the contract test.
- **Determinism:** all randomness comes from seeded `mulberry32`. The test hashes three nights twice and gets identical output. `npm test` passes 70 of 70.
- **Headless CLI:** exit codes 1, 2 and 3, `night_start` after snapshot 0, events written before each snapshot. Checked by reading `src/headless.js`.
- **Bench scene and output:** 200 wander shades (r ≤ 37, seed 42), 100 motes (above the gameplay cap), L1–L3 lit at 100, Mây at the origin. Bench mode skips fuel, pickup, contact, spawns and end of night. The window is exactly 1280×720 at pixel ratio 1, with vsync and frame-rate-limit switches. There is a 3 s warm-up. `avg_fps` = 1000N/Σdt; `p1_low_fps` uses k = max(1, ceil(0.01N)); p95 is nearest-rank. `bench.json` has all required fields. Checked by reading and with a probe run of the scene.
- **Soak structure:** one process, nights rotate 1→2→3, direction re-picked every 30 ticks, output fields as specified, crashes counted per night. Checked by reading and by running it (0 crashes).
- **Leaderboard:** sort by score descending, then by real `achieved_at` time, then by save order. Top 10 kept. ISO time with offset, including negative half-hour zones. Atomic disk write that survives a restart (tested). Export writes `{"entries":[...]}` in rank order. Reachable from the main menu, with a name form after a loss and after the Dawn screen. Checked by reading `server.js`, `web/main.js` and `web/leaderboard-ui.js`.
- **Accessibility:** all 9 required actions can be rebound. Duplicate keys get a message, there is a "Restore defaults" button, and keys are saved in localStorage. Captions cover a shade appearing (with an edge arrow), the wind warning, the last 10 s and lanterns below 30 fuel. Reduced motion turns off the hit flash and camera shake. Every CSS font size is `calc(≥18px * var(--fs))`, and large text sets 1.25. No canvas text. Checked by reading `web/a11y.js`, `web/main.js` and `web/style.css`.
- **Clone → install → start:** `npm start` is `node server.js`, and all browser import paths match the files' exact case. On a spare port, `/`, `/web/main.js`, three.js, the three.js addons, `/src/sim.js`, the contract and `/api/leaderboard` all returned 200. CI runs `npm install` + `npm test` on ubuntu-latest. Electron is a dev dependency of about 100 MB.
- **Docs and release:** the CHANGELOG covers 4 phases. CREDITS lists three.js, Electron, Web Audio and Claude Code. LICENSE and the retro (49 lines) are present. Tags `phase-1` to `phase-4` and `v1.0.0` exist on origin. `bench.json` and `soak.json` are committed under `docs/proof/phase-4/`.