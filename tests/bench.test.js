// Benchmark scene and statistics (Ticket-04 §1).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Game } from '../src/sim.js';
import { benchScenario, frameStats, orbitCamera } from '../src/bench.js';

const T = JSON.parse(fs.readFileSync(new URL('../game.contract.json', import.meta.url), 'utf8')).tuning;
const idle = { move: [0, 0], cam_yaw_deg: 0, jump: false, interact: false, pulse: false, dash: false, pause: false };

test('frame statistics follow the ticket formulas', () => {
  const dts = [...Array(98).fill(10), 40, 60]; // N = 100, k = 1
  const s = frameStats(dts);
  assert.equal(s.frames, 100);
  assert.equal(s.avg_fps, Math.round(((1000 * 100) / (980 + 100)) * 10) / 10);
  assert.equal(s.p1_low_fps, Math.round((1000 / 60) * 10) / 10);
  assert.equal(s.frame_ms_p95, 10);
  const s2 = frameStats([...Array(150).fill(10), 30, 50]); // N = 152, k = ceil(1.52) = 2 -> mean(30, 50) = 40
  assert.equal(s2.p1_low_fps, 25);
  // p95 is nearest-rank: N = 20 sorted 1..20 -> rank ceil(0.95 * 20) = 19 -> 19 (interpolation would give 19.05)
  assert.equal(frameStats(Array.from({ length: 20 }, (_, i) => 20 - i)).frame_ms_p95, 19);
});

test('scene: 200 wandering shades and 100 motes on the island, L1-L3 lit at 100, seeded', () => {
  const sc = benchScenario(42);
  assert.equal(sc.shades.length, 200);
  assert.equal(sc.motes.length, 100);
  assert.ok(sc.shades.every((s) => s.state === 'wander' && Math.hypot(s.pos[0], s.pos[2]) <= 37));
  assert.deepEqual(benchScenario(42), sc);
  assert.notDeepEqual(benchScenario(43).shades[0], sc.shades[0]);
  const g = new Game({ seed: 42, night: 1, tuning: T, scenario: sc, bench: true });
  assert.deepEqual(g.lanterns.map((l) => [l.id, l.lit, l.fuel / 60]), [['L1', true, 100], ['L2', true, 100], ['L3', true, 100], ['L4', false, 0], ['L5', false, 0]]);
  assert.equal(g.motes.length, 100); // above the gameplay cap of 30
});

test('bench mode: the crowd keeps wandering through the whole measured window (3 s .. 33 s)', () => {
  const g = new Game({ seed: 42, night: 1, tuning: T, scenario: benchScenario(42), bench: true });
  const step = (n) => { for (let i = 0; i < n; i++) g.step(idle); };
  step(3 * 60);
  for (let w = 0; w < 6; w++) { // six 5 s windows
    const a = g.shades.map((s) => [s.pos[0], s.pos[2]]);
    step(5 * 60);
    const moved = g.shades.filter((s, i) => Math.hypot(s.pos[0] - a[i][0], s.pos[2] - a[i][1]) > 0.05).length;
    assert.ok(moved >= 190, `window ${w}: only ${moved}/200 shades moved`);
    assert.ok(g.shades.every((s) => s.state === 'wander'), 'no chase or drain in the bench scene');
  }
});

test('bench mode: no spawns, damage, pickup, fuel loss or end of night', () => {
  const g = new Game({ seed: 42, night: 1, tuning: T, scenario: benchScenario(42), bench: true });
  const before = g.shades.map((s) => [...s.pos]);
  for (let i = 0; i < 60 * 40; i++) g.step(idle); // 40 s
  const ev = g.drainEvents().map((e) => e.name);
  assert.equal(g.state, 'playing');
  assert.equal(g.shades.length, 200);
  assert.equal(g.motes.length, 100);
  assert.equal(g.p.flames, T.flames);
  assert.deepEqual(g.lanterns.slice(0, 3).map((l) => l.fuel / 60), [100, 100, 100]);
  assert.ok(!ev.some((n) => ['player_hit', 'mote_picked', 'shade_spawned', 'lantern_out', 'game_over'].includes(n)), ev.join(','));
  assert.ok(g.shades.filter((s, i) => Math.hypot(s.pos[0] - before[i][0], s.pos[2] - before[i][2]) > 1).length > 150, 'shades wander');
  assert.deepEqual(g.p.pos, [0, 0, 0]);
});

test('camera orbit: starts at (30, 15, 0), counter-clockwise seen from above (quarter turn at (0, 15, -30)), one turn per 15 s', () => {
  assert.deepEqual(orbitCamera(0), [30, 15, 0]);
  const q = orbitCamera(3.75);
  assert.ok(Math.abs(q[0]) < 1e-9 && Math.abs(q[2] + 30) < 1e-9, `quarter turn ${q}`);
  const f = orbitCamera(15);
  assert.ok(Math.abs(f[0] - 30) < 1e-9 && Math.abs(f[2]) < 1e-9);
});
