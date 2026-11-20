# Changelog

## Unreleased (after tag phase-3): client only, headless output unchanged
- Visuals: bloom post-processing, gradient night sky + moon, procedural textures (grass, sand, wood, silk lantern, straw hat), Hội An style silk lanterns, new Mây model, inky shades that face their target, low decor (grass tufts, flowers, pebbles).
- HUD: heading-up minimap (lanterns with fuel ring, shades, drain links, motes), per-lantern fuel panel, event toasts, SVG flame icons, intro shows the night goal and keys, result shows lit lanterns / flames left.
- Mouse look: the pointer is captured when a night starts (Bắt đầu / Enter / R) and on resume; mouse movement turns the camera even when the pointer is not captured; a hint asks for a click when it is not; rejected lock requests no longer throw; the cursor is released on the result screen.
- Gameplay guard (client): pressing E at a lantern above 90 fuel is ignored (it would spend a whole mote for < 10 fuel); prompt says the lantern is still full.

## Phase 3 (Ticket-03 "Đèn cạn dầu", Contract v1.2): BREAKING CHANGES
Rules replaced. Design note: [ADR 0001](docs/adr/0001-lantern-fuel-and-dawn-victory.md).

| # | Breaking change | Replaces | Migration / what happened to old tests |
|---|---|---|---|
| 1 | Lanterns have `fuel` (max 100, -1/s). Lit lanterns accept motes (refuel +10 each); empty lanterns go out (`lantern_out`) | "a lit lantern accepts nothing" | `deposit` test unchanged; new `[T3] refuel/fuel/out` tests |
| 2 | Relight costs 5 (`ever_lit`), first light still 10; `lantern_lit` has `relight` | single cost 10 | `lantern_lit` assertions in the deposit test now expect `relight:false` |
| 3 | **No early win.** Win = alive at dawn with `>= ceil(0.6 x lanterns)` lit (3/5, 4/6, 5/7); reasons `dawn_survived` / `dawn` / `no_flames`; `all_lit` is gone | win when every lantern is lit | Tests `win: all lit => won...` and `a shade inside the zone ... victory stands` **rewritten** (they asserted the removed rule); new tests `no early win`, `win at dawn needs ceil(0.6 x lanterns)`, `last-tick rules` |
| 4 | Night length 240/270/300 s (was 300/330/360); time bonus removed | durations, `per_second_left` | contract-number test and `maps` test updated; `tick model` expects 238 s at tick 120 |
| 5 | Safe zone exists only while `lit && fuel >= 30` (exactly 30 keeps it) | "lit lantern always has a zone" | existing zone tests still pass (their lanterns are full); new threshold test |
| 6 | Shade state `drain`; wandering shades hunt weak lanterns (else unlit ones) and drain 5/s | wander = random walk | Wander tests only assert state, unaffected; new `[T3] wandering shades go for...`, `drain...` tests |
| 7 | Carry capacity = `min(20, 10 + 2 x successful_lights)`; `player.capacity` in snapshots | fixed 10 | pickup test (cap 10 at 0 lights) unchanged; new capacity test |
| 8 | Score: +5 per mote (deposit/refuel), +100 first light, +40 relight, +5 per stunned shade (+15 if it was draining), dawn: +50 + floor(fuel) per lit lantern, +50 per flame | +10/mote, +2 x seconds left, ... | formulas in tests derive from `game.contract.json`; `deposit` test updated to 5/mote |
| 9 | Contract `1.2`: tuning keys `fuel_max, fuel_decay_per_s, fuel_per_mote, relight_cost, win_ratio, drain_per_s, low_fuel_threshold, capacity_max`; score keys `per_relight, per_stun_drain, per_lit_at_dawn`; scenario `fuel, ever_lit, successful_lights, target_lantern_id`; events `refuel, lantern_out, fuel_drain` | v1.1 | validation rules and tests extended |
| 10 | Client: fuel bar, 1 Hz blink under 30, torn/squashed unlit lantern, capacity bar, "Đèn k/n (cần m)", refuel prompt, high-contrast palette setting | n/a | UI only |

No test was skipped or disabled. Campaign tests were rewritten to finish a night by surviving to dawn.

## Phase 2
Ticket-02 "Ba hòn đảo": standard numbers, 3 maps, Gió Lạc, Bùa Gió, wind, pause, 3-night campaign, UI.
## Phase 1
Night 1, headless Test Contract v1.0.
