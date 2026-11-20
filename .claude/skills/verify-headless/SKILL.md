---
name: verify-headless
description: Use after changing src/sim.js or the contract to prove behaviour with headless scenarios and save evidence.
---
1. `npm test`: read the failing subtest names, not just the exit code.
2. For a new rule, add a scenario test in `tests/headless.test.js` (use `random_motes/shades: false`, explicit `motes/shades/lanterns`, press helper for edge-triggered inputs, `every: 1` when asserting on a specific tick).
3. Determinism: `node scripts/prove.mjs`; `docs/proof/phase-N/determinism.txt` must say `identical: true`.
4. Commit proof together with the code it proves; proof must match the tag.
