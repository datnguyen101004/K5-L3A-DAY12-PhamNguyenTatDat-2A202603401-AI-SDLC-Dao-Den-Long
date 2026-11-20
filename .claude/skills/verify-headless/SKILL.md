---
name: verify-headless
description: Use after changing src/sim.js, src/maps.js or game.contract.json to prove behaviour with headless scenarios and save evidence. Also use when adding a ticket feature (needs >= 1 scenario test).
---
1. `npm test`: read failing subtest names and expected/actual, not just the exit code.
2. New rule or feature => add a scenario test in `tests/headless.test.js`: `run({night, scenario: {...empty, player:{...}}, frames, ticks, every: 1})`. `empty` switches off random motes/shades/drifters/wind. `press(k,key)` makes an edge-triggered press (frame k => event tick k+1). Expected numbers come from the ticket, not from running the code.
3. Tick arithmetic cheat-sheet: step k produces tick k+1; a timer set at tick t with N ticks is visible in snapshots t..t+N-1 and gone at t+N; consumption-based counters (push, recoil) move on ticks t..t+N-1 (shade hit at t: recoil moves t+1..t+N).
4. Determinism + timing + samples: `node scripts/prove.mjs <phase>`; `determinism.txt` must say `identical: true` for each night; `perf-headless.txt` <= 30000 ms.
5. Commit proof together with the code it proves; proof must match the tag. Update `docs/spec/*` acceptance rows when a rule changes.
