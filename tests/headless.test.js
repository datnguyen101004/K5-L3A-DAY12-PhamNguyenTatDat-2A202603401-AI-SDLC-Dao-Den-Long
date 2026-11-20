// Headless scenario tests against Test Contract v1.0. Run: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const T = JSON.parse(fs.readFileSync(path.join(root, 'game.contract.json'), 'utf8')).tuning;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lantern-'));
let n = 0;

function run({ scenario, frames, ticks = 60, seed = 1, every = 10, raw } = {}) {
  const id = ++n;
  const out = path.join(tmp, `o${id}.jsonl`);
  const args = ['src/headless.js', '--seed', String(seed), '--night', '1', '--ticks', String(ticks), '--out', out, '--snapshot-every', String(every)];
  if (scenario !== undefined || raw?.scenario !== undefined) {
    const f = path.join(tmp, `s${id}.json`);
    fs.writeFileSync(f, raw?.scenario ?? JSON.stringify(scenario));
    args.push('--scenario', f);
  }
  if (frames !== undefined || raw?.inputs !== undefined) {
    const f = path.join(tmp, `i${id}.json`);
    fs.writeFileSync(f, raw?.inputs ?? JSON.stringify({ frames }));
    args.push('--inputs', f);
  }
  const r = spawnSync('node', args, { cwd: root, encoding: 'utf8' });
  const lines = fs.existsSync(out) ? fs.readFileSync(out, 'utf8').trim().split('\n').map((l) => JSON.parse(l)) : [];
  return {
    status: r.status,
    stderr: r.stderr,
    lines,
    events: lines.filter((l) => l.type === 'event'),
    snaps: lines.filter((l) => l.type === 'snapshot'),
    end: lines.at(-1),
    raw: fs.existsSync(out) ? fs.readFileSync(out, 'utf8') : '',
  };
}

const empty = { random_motes: false, random_shades: false, motes: [], shades: [] };
const press = (tick, key) => [{ tick, [key]: true }, { tick: tick + 1, [key]: false }];

test('tick model: snapshot 0 before input, N steps, time_left, end line', () => {
  const r = run({ scenario: { ...empty, time_left_s: 300 }, frames: [{ tick: 0, move: [0, 1] }], ticks: 120 });
  assert.equal(r.status, 0);
  assert.deepEqual(r.snaps[0].player.pos, [0, 0, 0]);
  assert.equal(r.snaps[0].tick, 0);
  assert.equal(r.snaps.at(-1).tick, 120);
  assert.equal(r.snaps.at(-1).time_left_s, 298);
  assert.equal(r.snaps.at(-1).player.pos[2], T.player_speed * 2); // 120 steps at 6 m/s
  assert.deepEqual(r.end, { type: 'end', ticks: 120, state: 'playing', score: 0 });
});

test('camera yaw rotates move; diagonal is normalised', () => {
  const a = run({ scenario: empty, frames: [{ tick: 0, move: [1, 0], cam_yaw_deg: 90 }], ticks: 60 });
  const [x, , z] = a.end && a.snaps.at(-1).player.pos;
  assert.ok(Math.abs(x) < 1e-3 && Math.abs(z + T.player_speed) < 1e-3, `yaw 90, move x=1 -> -Z, got ${x},${z}`);
  const b = run({ scenario: empty, frames: [{ tick: 0, move: [1, 1] }], ticks: 60 });
  const [bx, , bz] = b.snaps.at(-1).player.pos;
  assert.ok(Math.abs(Math.hypot(bx, bz) - T.player_speed) < 2e-3);
});

test('mote pickup at pickup_radius boundary, capacity respected', () => {
  const r = run({ scenario: { ...empty, motes: [[0, 0, T.pickup_radius], [0, 0, 0.5], [0, 0, T.pickup_radius + 0.01]], player: { carried: T.carry_capacity - 2 } }, ticks: 5, every: 1 });
  assert.deepEqual(r.events.map((e) => [e.tick, e.name, e.data.carried]), [[1, 'mote_picked', T.carry_capacity - 1], [1, 'mote_picked', T.carry_capacity]]);
  assert.equal(r.snaps.at(-1).motes_active, 1);
  assert.equal(r.snaps.at(-1).score, 2 * T.score.per_mote);
});

test('deposit and light lantern; scenario does not score; win bonuses', () => {
  const lit = ['L2', 'L3', 'L4', 'L5'].map((id) => ({ id, lit: true }));
  const r = run({
    scenario: { ...empty, player: { carried: 5, flames: 2 }, lanterns: [{ id: 'L1', pos: [0, 0, 2] }, ...lit], time_left_s: 100 },
    frames: press(10, 'interact'),
    ticks: 600,
  });
  assert.equal(r.snaps[0].score, 0);
  const names = r.events.map((e) => e.name);
  assert.deepEqual(names, ['deposit', 'lantern_lit', 'game_over']);
  assert.deepEqual(r.events[0].data, { lantern_id: 'L1', amount: 5, deposited: 5 });
  assert.deepEqual(r.events[2].data, { result: 'won', reason: 'all_lit' });
  assert.equal(r.events[0].tick, 11);
  const left = Math.floor(100 - 11 / 60);
  assert.equal(r.end.score, T.score.per_lantern + T.score.per_second_left * left + T.score.per_flame_left * 2);
  assert.equal(r.end.state, 'won');
  assert.equal(r.end.ticks, 11);
});

test('partial deposit; interact out of range does nothing', () => {
  const r = run({ scenario: { ...empty, player: { carried: 3 }, lanterns: [{ id: 'L1', pos: [0, 0, T.interact_radius + 0.5] }] }, frames: press(0, 'interact'), ticks: 5 });
  assert.equal(r.events.length, 0);
  const r2 = run({ scenario: { ...empty, player: { carried: 3 }, lanterns: [{ id: 'L1', pos: [0, 0, T.interact_radius] }] }, frames: press(0, 'interact'), ticks: 5 });
  assert.deepEqual(r2.events[0].data, { lantern_id: 'L1', amount: 3, deposited: 3 });
  assert.equal(r2.snaps.at(-1).lanterns[0].lit, false);
});

test('interact fires only on false->true edge', () => {
  const r = run({ scenario: { ...empty, player: { carried: 5 }, lanterns: [{ id: 'L1', pos: [0, 0, 1], deposited: 0 }] }, frames: [{ tick: 0, interact: true }, { tick: 5, interact: false }, { tick: 6, interact: true }], ticks: 30 });
  assert.equal(r.events.filter((e) => e.name === 'deposit').length, 1); // 2nd press: nothing left to deposit
});

test('pulse: cost, stun, push, score, cooldown, no-cost-no-pulse', () => {
  const sc = { ...empty, player: { carried: 3 }, shades: [{ id: 'S1', pos: [4, 1, 0] }, { id: 'S2', pos: [T.pulse_radius, 1, 0] }, { id: 'S3', pos: [T.pulse_radius + 1, 1, 0] }] };
  const frames = [...press(0, 'pulse'), ...press(30, 'pulse')]; // 2nd inside cooldown
  const r = run({ scenario: sc, frames, ticks: 40 });
  const pulses = r.events.filter((e) => e.name === 'pulse');
  assert.equal(pulses.length, 1);
  assert.deepEqual(pulses[0].data.stunned_ids, ['S1', 'S2']);
  const s = r.snaps.at(-1);
  assert.equal(s.player.carried, 3 - T.pulse_cost);
  assert.equal(s.score, 2 * T.score.per_stun);
  assert.equal(s.shades[0].state, 'stunned');
  assert.equal(s.shades[0].pos[0], 4 + T.pulse_push_m);
  assert.notEqual(s.shades[2].state, 'stunned');
  const none = run({ scenario: { ...sc, player: { carried: 0 } }, frames: press(0, 'pulse'), ticks: 5 });
  assert.equal(none.events.length, 0);
});

test('stun lasts exactly pulse_stun_s then shade chases again', () => {
  const sc = { ...empty, player: { carried: 1 }, shades: [{ id: 'S1', pos: [6, 1, 0] }] };
  const N = Math.round(T.pulse_stun_s * 60);
  const r = run({ scenario: sc, frames: press(0, 'pulse'), ticks: N + 1, every: 1 });
  const at = (t) => r.snaps.find((s) => s.tick === t).shades[0];
  assert.equal(at(N).state, 'stunned'); // steps 1..N stunned
  assert.equal(at(N + 1).state, 'chase');
  assert.ok(at(N + 1).pos[0] < at(N).pos[0]);
});

test('shade hit: flames, drop ratio, invulnerability, loss', () => {
  const sc = { ...empty, player: { carried: 4, flames: 2 }, shades: [{ id: 'S1', pos: [T.shade_hit_radius, 1, 0] }] };
  const r = run({ scenario: sc, ticks: 600 });
  const hits = r.events.filter((e) => e.name === 'player_hit');
  assert.deepEqual(hits[0].data, { by: 'shade', flames: 1, dropped: Math.floor(4 * T.hit_drop_ratio) });
  const gap = hits[1].tick - hits[0].tick;
  assert.equal(gap, Math.round(T.invuln_s * 60));
  assert.deepEqual(r.events.at(-1).data, { result: 'lost', reason: 'no_flames' });
  assert.equal(r.end.state, 'lost');
  assert.equal(r.end.score, 0);
});

test('lit lantern safe_radius keeps shades out', () => {
  const sc = { ...empty, player: { pos: [0, 0, 0] }, lanterns: [{ id: 'L1', pos: [0, 0, 0], lit: true }], shades: [{ id: 'S1', pos: [20, 1, 0] }] };
  const r = run({ scenario: sc, ticks: 600, every: 1 });
  for (const s of r.snaps.slice(1)) assert.ok(Math.hypot(s.shades[0].pos[0], s.shades[0].pos[2]) >= T.safe_radius - 1e-3);
  assert.ok(!r.events.some((e) => e.name === 'player_hit'));
});

test('dawn loss when time runs out', () => {
  const r = run({ scenario: { ...empty, time_left_s: 1 }, ticks: 600 });
  assert.equal(r.end.ticks, 60);
  assert.equal(r.end.state, 'lost');
  assert.deepEqual(r.events.at(-1), { type: 'event', tick: 60, name: 'game_over', data: { result: 'lost', reason: 'dawn' } });
});

test('jump leaves and returns to ground', () => {
  const r = run({ scenario: empty, frames: press(0, 'jump'), ticks: 120, every: 1 });
  const ys = r.snaps.map((s) => s.player.pos[1]);
  assert.ok(Math.max(...ys) > 0.5);
  assert.equal(ys.at(-1), 0);
});

test('determinism with random motes/shades: identical output across runs', () => {
  const frames = [{ tick: 0, move: [0.3, 1] }, ...press(200, 'pulse')];
  const a = run({ seed: 7, frames, ticks: 3000 });
  const b = run({ seed: 7, frames, ticks: 3000 });
  const c = run({ seed: 8, frames, ticks: 3000 });
  assert.equal(a.status, 0);
  assert.equal(a.raw, b.raw);
  assert.notEqual(a.raw, c.raw);
  assert.ok(a.events.some((e) => e.name === 'shade_spawned'), 'random shades spawn over time');
  assert.ok(a.snaps[0].motes_active > 0);
});

test('invalid inputs/scenario exit 2 with stderr; usage errors non-zero', () => {
  const badInputs = [
    '{not json',
    '{"frames": 3}',
    '{"frames":[{"tick":5},{"tick":5}]}',
    '{"frames":[{"tick":5},{"tick":2}]}',
    '{"frames":[{"tick":0,"move":[2,0]}]}',
    '{"frames":[{"tick":0,"pulse":"yes"}]}',
  ];
  for (const inputs of badInputs) {
    const r = run({ raw: { inputs } });
    assert.equal(r.status, 2, inputs);
    assert.match(r.stderr, /inputs/);
  }
  for (const scenario of ['oops', '[]', '{"player":{"pos":[1,2]}}', '{"shades":[{"id":"S1"}]}']) {
    assert.equal(run({ raw: { scenario } }).status, 2, scenario);
  }
  const r = spawnSync('node', ['src/headless.js', '--seed', '1'], { cwd: root, encoding: 'utf8' });
  assert.notEqual(r.status, 0);
  assert.ok(r.stderr.length > 0);
});

test('stops at game end before --ticks and exits 0', () => {
  const r = run({ scenario: { ...empty, time_left_s: 0.5 }, ticks: 5000, every: 7 });
  assert.equal(r.status, 0);
  assert.equal(r.end.ticks, 30);
});

test('contract file declares all tuning keys and lantern_count_night1 = 5', () => {
  const c = JSON.parse(fs.readFileSync(path.join(root, 'game.contract.json'), 'utf8'));
  assert.equal(c.contract_version, '1.0');
  assert.equal(c.tuning.lantern_count_night1, 5);
  for (const k of ['player_speed', 'carry_capacity', 'lantern_cost', 'pickup_radius', 'interact_radius', 'pulse_cost', 'pulse_radius', 'night1_duration_s', 'flames', 'invuln_s', 'hit_drop_ratio', 'pulse_stun_s', 'pulse_push_m', 'pulse_cooldown_s', 'safe_radius', 'shade_speed', 'shade_hit_radius', 'fall_enabled', 'score']) {
    assert.ok(k in c.tuning, k);
  }
  const d = run({ ticks: 0 });
  assert.equal(d.snaps[0].lanterns.length, 5);
  assert.deepEqual(d.snaps[0].lanterns[0].pos, [0, 0, 25]);
});
