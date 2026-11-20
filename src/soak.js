#!/usr/bin/env node
// Soak test (Ticket-04 §2): N nights in ONE process, nights 1 -> 2 -> 3 rotating, night i uses seed + i,
// random seeded input. Reports crashes and RSS before/after so leaks show up.
// node --expose-gc --lite-mode src/soak.js --seed 7 --nights 10 --out soak.json
// --lite-mode (V8's low-memory mode) keeps the engine from growing its JIT/code caches; it is not needed to
// avoid a leak (heap_used_* stays flat either way, see docs/proof/phase-4/README.md) but RSS then reflects the game.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Game, mulberry32, TICK_RATE } from './sim.js';

function args(argv) {
  const a = { seed: 7, nights: 10, out: null };
  for (let i = 0; i < argv.length; i += 2) {
    const k = argv[i].replace(/^--/, '');
    const v = argv[i + 1];
    if (!(k in a) || v === undefined) throw new Error(`bad argument ${argv[i]}`);
    a[k] = k === 'out' ? v : Number(v);
  }
  if (!a.out) throw new Error('missing --out');
  if (!Number.isInteger(a.seed) || !Number.isInteger(a.nights) || a.nights < 1) throw new Error('--seed and --nights must be integers, nights >= 1');
  return a;
}

const mb = (b) => Math.round((b / 1048576) * 10) / 10;
const measure = () => {
  if (global.gc) global.gc(); // measure live memory, not garbage waiting for collection
  const u = process.memoryUsage();
  return { rss: mb(u.rss), heap: mb(u.heapUsed) };
};

/** Seeded random player: new direction every 30 ticks; per tick 5% jump, 3% dash, 2% pulse, 10% interact. */
export function randomInput(seed) {
  const rng = mulberry32((seed * 2654435761) >>> 0);
  const inp = { move: [0, 0], cam_yaw_deg: 0, jump: false, interact: false, pulse: false, dash: false, pause: false };
  let t = 0;
  return () => {
    if (t++ % 30 === 0) {
      const a = rng() * 2 * Math.PI;
      inp.move = [Math.cos(a), Math.sin(a)];
    }
    inp.jump = rng() < 0.05;
    inp.dash = rng() < 0.03;
    inp.pulse = rng() < 0.02;
    inp.interact = rng() < 0.1;
    return inp;
  };
}

/** Plays one night to its end (or the standard duration); returns 'won' | 'lost'. */
export function playNight({ seed, night, tuning }) {
  const game = new Game({ seed, night, tuning });
  const next = randomInput(seed);
  const maxTicks = tuning[`night${night}_duration_s`] * TICK_RATE;
  while (game.state === 'playing' && game.simTick < maxTicks) {
    game.step(next());
    game.drainEvents();
  }
  return { game, result: game.state === 'won' ? 'won' : 'lost' };
}

function main() {
  const o = args(process.argv.slice(2));
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const tuning = JSON.parse(fs.readFileSync(path.join(root, 'game.contract.json'), 'utf8')).tuning;
  const t0 = process.hrtime.bigint();
  const results = [];
  let crashes = 0;
  let memStart = null;
  for (let i = 0; i < o.nights; i++) {
    const night = (i % 3) + 1;
    const seed = o.seed + i;
    try {
      if (i === 0) {
        // "after the first night has loaded": build it, measure, then play that same night
        new Game({ seed, night, tuning });
        memStart = measure();
      }
      results.push(playNight({ seed, night, tuning }).result);
    } catch (e) {
      crashes++;
      results.push('crash');
      process.stderr.write(`night ${i + 1} (Đêm ${night}, seed ${seed}) crashed: ${e.stack || e}\n`);
    }
  }
  const memEnd = measure(); // the last night's Game is out of scope: this is "after reset"
  const out = {
    nights: o.nights,
    crashes,
    results,
    mem_start_mb: memStart?.rss ?? null,
    mem_end_mb: memEnd.rss,
    heap_used_start_mb: memStart?.heap ?? null,
    heap_used_end_mb: memEnd.heap,
    duration_s: Math.round(Number(process.hrtime.bigint() - t0) / 1e8) / 10,
    gc_exposed: !!global.gc,
  };
  fs.mkdirSync(path.dirname(path.resolve(o.out)), { recursive: true });
  fs.writeFileSync(o.out, JSON.stringify(out, null, 2) + '\n');
  console.log(JSON.stringify(out));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (e) {
    process.stderr.write(`error: ${e.message}\n`);
    process.exit(1);
  }
}
