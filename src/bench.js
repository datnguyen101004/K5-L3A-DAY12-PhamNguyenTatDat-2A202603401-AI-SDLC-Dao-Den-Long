// Ticket-04 benchmark: the standard scene and the frame-time statistics. Pure (shared by the browser and tests).
import { mulberry32 } from './sim.js';
import { MAPS } from './maps.js';

export const BENCH_SHADES = 200;
export const BENCH_MOTES = 100;
export const WARMUP_S = 3;
export const ORBIT = { radius: 30, height: 15, period_s: 15 };

/** Uniform point on night 1's island (r <= 37 m, inside the 40 m shore). */
function spread(rng) {
  const a = rng() * 2 * Math.PI;
  const r = 37 * Math.sqrt(rng());
  return [r * Math.cos(a), r * Math.sin(a)];
}

/** Night 1, 200 wandering shades and 100 motes spread evenly with `seed`, L1-L3 lit at fuel 100, Mây at the origin. */
export function benchScenario(seed = 42) {
  const rng = mulberry32(seed);
  const shades = [];
  for (let i = 0; i < BENCH_SHADES; i++) {
    const [x, z] = spread(rng);
    shades.push({ id: `S${i + 1}`, pos: [x, 1, z], state: 'wander' });
  }
  const motes = [];
  for (let i = 0; i < BENCH_MOTES; i++) {
    const [x, z] = spread(rng);
    motes.push([x, 0, z]);
  }
  return {
    player: { pos: [0, 0, 0] },
    random_motes: false,
    random_shades: false,
    random_drifters: false,
    wind_enabled: false,
    shades,
    motes,
    drifters: [],
    lanterns: MAPS[1].lanterns.slice(0, 3).map((l) => ({ id: l.id, lit: true, fuel: 100 })),
  };
}

/** Camera on a circle around the origin, starting at (30, 15, 0), turning COUNTER-clockwise seen from above (+Y):
 *  +X -> -Z -> -X -> +Z (three.js is right-handed, so that is z = -r sin a). */
export function orbitCamera(t) {
  const a = (2 * Math.PI * t) / ORBIT.period_s;
  return [ORBIT.radius * Math.cos(a), ORBIT.height, -ORBIT.radius * Math.sin(a) + 0]; // + 0 turns -0 into 0
}

const r1 = (v) => Math.round(v * 10) / 10;

/** dts: frame times in ms inside the measured window. Formulas from Ticket-04 §1. */
export function frameStats(dts) {
  const N = dts.length;
  if (!N) return { frames: 0, avg_fps: 0, p1_low_fps: 0, frame_ms_p95: 0 };
  const sum = dts.reduce((a, b) => a + b, 0);
  const sorted = [...dts].sort((a, b) => a - b);
  const k = Math.max(1, Math.ceil(0.01 * N));
  const worst = sorted.slice(N - k);
  const p95 = sorted[Math.min(N - 1, Math.ceil(0.95 * N) - 1)]; // nearest-rank
  return {
    frames: N,
    avg_fps: r1((1000 * N) / sum),
    p1_low_fps: r1(1000 / (worst.reduce((a, b) => a + b, 0) / k)),
    frame_ms_p95: r1(p95),
  };
}
