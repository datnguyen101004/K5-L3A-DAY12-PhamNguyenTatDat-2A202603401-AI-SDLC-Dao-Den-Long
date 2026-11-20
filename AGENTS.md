# AGENTS.md: Đảo Đèn Lồng

Game 3D (three.js) + deterministic headless sim. Contract: `game.contract.json` (Test Contract **v1.3**: 3 Đêm, lantern fuel + win at dawn, bench + soak). Specs: `docs/spec/ticket-02.md`, `docs/spec/ticket-03.md`. Decisions: `docs/adr/`. Breaking changes: `CHANGELOG.md`.

## Commands
- Install: `npm install` · Play: `npm start` (http://localhost:8081) · Test: `npm test` (~10 s)
- Headless: `node src/headless.js --seed 1 --night 1|2|3 --ticks 600 --out out.jsonl [--scenario f] [--inputs f] [--snapshot-every N]`
- Proof: `node scripts/prove.mjs <phase>` (writes `docs/proof/phase-<phase>/`)
- Bench: `node scripts/bench.mjs --seed 42 --duration 30 --out bench.json` (Electron window; close every other browser tab first, they share the GPU) · Soak: `node --expose-gc --lite-mode src/soak.js --seed 7 --nights 10 --out soak.json`
- Release bundle: `node scripts/package.mjs` (writes `release/`) · Leaderboard export: `node server.js --export-leaderboard out.json`

## Layout
- `src/sim.js`: ALL rules. Pure (no DOM/Node). Method per tick stage S1..S11 in the order mandated by the ticket; do not reorder.
- `src/maps.js`: standard maps + terrain (`topsAt`). `src/campaign.js`: night progression. `src/headless.js`: CLI + validation (bad file => exit 2).
- `src/bench.js`: bench scene + frame stats. `src/leaderboard.js`: leaderboard rules (server + browser fallback). `server.js`: static files + `/api/leaderboard` (disk store).
- `web/`: rendering, input, UI, audio only. Shades/motes are InstancedMesh: never add per-entity meshes for crowds. Never put rules here; read state from `Game`.
- `game.contract.json`: single source of truth for numbers. Never hardcode a tuning number in sim.
- `tests/`: scenario tests through the real CLI (`run({night, scenario, frames, ticks, every})`).

## Rules
- 60 ticks/s; timers are integer ticks. Only the seeded `rng` for randomness (never `Math.random` in `src/`).
- Distances: XZ unless the spec says 3D (pulse only) or height-diff (pickup/hit <= 1.5). Radii compare with `<=`.
- Fuel is an integer in 1/60 units (`FU`); never use float fuel. A lantern's safe zone is derived (`hasZone`: lit && fuel >= 30), not stored. Win is only decided at dawn (S11).
- A rule replaced by a ticket => write/extend an ADR + CHANGELOG row, rewrite (never skip) the tests that asserted it, say why.
- Angle `a` => `(cos a, sin a)` on (X, Z). Shade `pos.y` = ground + 1.
- A rule change updates contract, test, `docs/notes/assumptions.md` (and the superseded row) in the same commit.
- Creative extras must not change headless output (disable when headless / keep in `web/`).
- Not done until `npm test` is green AND you read which tests ran. Never edit `docs/proof/*` by hand; regenerate it.
- Tests: assert on the specified number (from the ticket), not on what the code happens to output. Use `every: 1` when asserting a specific tick; scenario must set `random_*: false` unless testing spawns.
- UI text >= 18 px at 1280x720 (`font-size: calc(Npx * var(--fs))`, N >= 18). Key hints come from `settings.keys` (`data-key`), never hardcode a key name.
- `Game({bench:true})` is for the benchmark only; never use it in headless or tests of rules.
- Ambiguity: write the assumption (next free A-number), never invent ticket text.

## Past agent mistakes (keep out)
- Test scenario contradicted the rule it tested (a drain test with fuel >= 30: the shade correctly left `drain`). Check the scenario against the spec numbers before blaming the sim.
- Test asserted a snapshot at a tick that is not a multiple of `every` (see first item) twice more in Phase 3.
- Assertion read a snapshot at tick 0 because `--snapshot-every` defaults to 10 (use `every: 1`).
- Duplicate `tick` in an inputs frame list => exit 2; merge fields into one frame.
- Spec-ordering slip: a lantern lit this tick makes shades inside its zone harmless (S6 before S9), so "win and die on the same tick" cannot happen.
