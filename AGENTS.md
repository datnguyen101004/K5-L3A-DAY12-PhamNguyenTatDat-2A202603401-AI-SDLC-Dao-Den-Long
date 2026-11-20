# AGENTS.md: Đảo Đèn Lồng

Game 3D (three.js) + deterministic headless sim. Contract: `game.contract.json` (Test Contract **v1.1**, 3 Đêm). Spec: `docs/spec/ticket-02.md`.

## Commands
- Install: `npm install` · Play: `npm start` (http://localhost:8080) · Test: `npm test` (~10 s)
- Headless: `node src/headless.js --seed 1 --night 1|2|3 --ticks 600 --out out.jsonl [--scenario f] [--inputs f] [--snapshot-every N]`
- Proof: `node scripts/prove.mjs <phase>` (writes `docs/proof/phase-<phase>/`)

## Layout
- `src/sim.js`: ALL rules. Pure (no DOM/Node). Method per tick stage S1..S11 in the order mandated by the ticket; do not reorder.
- `src/maps.js`: standard maps + terrain (`topsAt`). `src/campaign.js`: night progression. `src/headless.js`: CLI + validation (bad file => exit 2).
- `web/`: rendering, input, UI, audio only. Never put rules here; read state from `Game`.
- `game.contract.json`: single source of truth for numbers. Never hardcode a tuning number in sim.
- `tests/`: scenario tests through the real CLI (`run({night, scenario, frames, ticks, every})`).

## Rules
- 60 ticks/s; timers are integer ticks. Only the seeded `rng` for randomness (never `Math.random` in `src/`).
- Distances: XZ unless the spec says 3D (pulse only) or height-diff (pickup/hit <= 1.5). Radii compare with `<=`.
- Angle `a` => `(cos a, sin a)` on (X, Z). Shade `pos.y` = ground + 1.
- A rule change updates contract, test, `docs/notes/assumptions.md` (and the superseded row) in the same commit.
- Creative extras must not change headless output (disable when headless / keep in `web/`).
- Not done until `npm test` is green AND you read which tests ran. Never edit `docs/proof/*` by hand; regenerate it.
- Tests: assert on the specified number (from the ticket), not on what the code happens to output. Use `every: 1` when asserting a specific tick; scenario must set `random_*: false` unless testing spawns.
- Ambiguity: write the assumption (next free A-number), never invent ticket text.

## Past agent mistakes (keep out)
- Assertion read a snapshot at tick 0 because `--snapshot-every` defaults to 10 (use `every: 1`).
- Duplicate `tick` in an inputs frame list => exit 2; merge fields into one frame.
- Spec-ordering slip: a lantern lit this tick makes shades inside its zone harmless (S6 before S9), so "win and die on the same tick" cannot happen.
