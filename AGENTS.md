# AGENTS.md: Đảo Đèn Lồng

Game 3D (three.js) + deterministic headless sim. Contract: `game.contract.json` (Test Contract v1.0).

## Commands
- Install: `npm install` · Play: `npm start` (http://localhost:8080) · Test: `npm test`
- Headless: `node src/headless.js --seed 1 --night 1 --ticks 600 --out out.jsonl [--scenario f] [--inputs f]`
- Regenerate proof: `node scripts/prove.mjs` (writes `docs/proof/phase-N/`)

## Layout
- `src/sim.js`: ALL game rules. Pure, no DOM/Node APIs. Shared by browser and CLI.
- `src/headless.js`: CLI, validation (bad file => exit 2), JSONL writer.
- `web/`: rendering + input only. Never put rules here.
- `game.contract.json`: single source of truth for tuning; sim reads it, never hardcode numbers.
- `tests/`: scenario tests through the real CLI.

## Rules
- 60 ticks/s fixed; timers are integer ticks (no float accumulation). Only `rng` (seeded) for randomness; never `Math.random` in sim.
- Distances are XZ, `<=` radius. Changing a rule => update contract, tests, `docs/notes/assumptions.md` in the same commit.
- Extras (creative additions) must not change headless output for scenarios with `random_*: false`.
- Do not claim done until `npm test` is green and you've read the output. Never edit proof files by hand.
- Fix bugs in the sim and add a scenario test; do not loosen assertions.
- Ambiguity: write the assumption in `docs/notes/assumptions.md`, do not invent PRD requirements.
