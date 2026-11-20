---
name: browser-check
description: Use after changing anything in web/ to verify the real UI (HUD, menus, FPS) in a browser and save screenshots as proof.
---
1. Start `npm start` as a named service (port 8081); stop it when done.
2. Open http://localhost:8081 with the `browser` tool; use `?night=2|3` (dev shortcut, skips menu) to reach a night quickly.
3. Check: console has no errors; HUD elements present (flames, mm:ss clock, lanterns k/n + score, 10-slot mote bar, dash/pulse cooldowns); pause menu freezes the clock; settings survive a reload.
4. Read `window.__perf.fps` for 5+ s per night at 1280x720; record numbers (and that headless Chromium may use software GL).
5. Save screenshots to `docs/proof/phase-<N>/ui-*.png`; state what was NOT checked (e.g. audio is not audible to the agent).
