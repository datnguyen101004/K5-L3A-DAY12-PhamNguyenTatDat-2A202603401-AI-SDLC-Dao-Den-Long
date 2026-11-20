// Benchmark scene in the browser (Ticket-04 §1). Started by main.js for ?bench=1 (scripts/bench.mjs opens it).
// Night 1 with full lighting/bloom, 200 wandering shades, 100 motes, L1-L3 lit; no player input; the camera orbits.
// 3 s warm-up, then frame times are recorded for `duration` seconds; the result is left in window.__benchResult.
import { Game, TICK_RATE } from '/src/sim.js';
import { MAPS } from '/src/maps.js';
import { benchScenario, frameStats, orbitCamera, WARMUP_S } from '/src/bench.js';

export function runBench({ world, hud, tuning, seed, duration, t0 }) {
  const marks = { page: Math.round(performance.timeOrigin) - t0, run: Date.now() - t0 };
  // Render exactly 1280x720 pixels on every machine (no HiDPI upscaling), so all submissions draw the same amount.
  world.setPixelRatio(1);
  const game = new Game({ seed, night: 1, tuning, scenario: benchScenario(seed), bench: true });
  world.buildNight(1, MAPS[1], { decor: false }); // creative decor off in the standard scene
  marks.built = Date.now() - t0;
  world.prewarm();
  marks.prewarm = Date.now() - t0;
  hud.setMap(game.map, game);
  const idle = { move: [0, 0], cam_yaw_deg: 0, jump: false, interact: false, pulse: false, dash: false, pause: false };
  const dts = [];
  let start = null;
  let last = 0;
  let acc = 0;
  let firstFrameEpoch = null;
  window.__benchState = 'warmup';

  function frame(now) {
    const first = start === null;
    if (first) {
      start = now;
      last = now;
    }
    const dtMs = now - last;
    last = now;
    const t = (now - start) / 1000;
    if (t >= WARMUP_S) {
      if (t > WARMUP_S + duration) {
        const stats = frameStats(dts);
        window.__benchResult = { ...stats, load_ms: t0 ? firstFrameEpoch - t0 : null, gl: glInfo(world.renderer), marks };
        window.__benchState = 'done';
        world.render();
        return;
      }
      window.__benchState = 'measuring';
      dts.push(dtMs);
    }
    acc += Math.min(0.25, dtMs / 1000);
    let steps = 0;
    while (acc >= 1 / TICK_RATE && steps < 5) {
      game.step(idle);
      game.drainEvents();
      acc -= 1 / TICK_RATE;
      steps++;
    }
    if (steps === 5) acc = 0;
    world.sync(game, dtMs / 1000, now / 1000);
    world.benchCam(orbitCamera(t));
    hud.update(game, (x, y, z) => world.project(x, y, z), 0);
    world.render();
    if (first) firstFrameEpoch = Date.now(); // first frame of the bench scene has been drawn
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

function glInfo(renderer) {
  const gl = renderer.getContext();
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  return {
    renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
    vendor: ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR),
    version: gl.getParameter(gl.VERSION),
    pixel_ratio: renderer.getPixelRatio(),
  };
}
