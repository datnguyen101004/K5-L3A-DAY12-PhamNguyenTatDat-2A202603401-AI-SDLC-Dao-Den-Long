// Headless scenario tests against Test Contract v1.1 and the Ticket-02 standard numbers. Run: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { Game } from '../src/sim.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONTRACT = JSON.parse(fs.readFileSync(path.join(root, 'game.contract.json'), 'utf8'));
const T = CONTRACT.tuning;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lantern-'));
let n = 0;

function run({ night = 1, scenario, frames, ticks = 60, seed = 1, every = 10, raw } = {}) {
  const id = ++n;
  const out = path.join(tmp, `o${id}.jsonl`);
  const args = ['src/headless.js', '--seed', String(seed), '--night', String(night), '--ticks', String(ticks), '--out', out, '--snapshot-every', String(every)];
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
  const text = fs.existsSync(out) ? fs.readFileSync(out, 'utf8') : '';
  const lines = text ? text.trim().split('\n').map((l) => JSON.parse(l)) : [];
  const snaps = lines.filter((l) => l.type === 'snapshot');
  return {
    status: r.status,
    stderr: r.stderr,
    lines,
    snaps,
    events: lines.filter((l) => l.type === 'event'),
    end: lines.at(-1),
    raw: text,
    at: (tick) => snaps.find((s) => s.tick === tick),
    ev: (name) => lines.filter((l) => l.type === 'event' && l.name === name),
  };
}

const empty = { random_motes: false, random_shades: false, random_drifters: false, wind_enabled: false, motes: [], shades: [], drifters: [], charms: [] };
const press = (k, key) => [{ tick: k, [key]: true }, { tick: k + 1, [key]: false }];
const near = (a, b, eps, msg) => assert.ok(Math.abs(a - b) <= eps, `${msg ?? ''} expected ${b} got ${a}`);
const litExcept = (...keep) => ['L1', 'L2', 'L3', 'L4', 'L5'].filter((id) => !keep.includes(id)).map((id) => ({ id, lit: true }));

// ---------------------------------------------------------------- contract & maps
test('contract v1.1 carries the standard numbers', () => {
  assert.equal(CONTRACT.contract_version, '1.1');
  const expect = {
    player_speed: 6, carry_capacity: 10, lantern_cost: 10, lantern_count_night1: 5, pickup_radius: 1, interact_radius: 2,
    pulse_cost: 3, pulse_radius: 5, pulse_cooldown_s: 3, pulse_stun_s: 2, pulse_push_m: 4, safe_radius: 6, shade_speed: 4,
    shade_hit_radius: 1, flames: 3, invuln_s: 1.5, hit_drop_ratio: 0.5, dash_speed: 14, dash_duration_s: 0.2, dash_cooldown_s: 1.5,
    night1_duration_s: 300, night2_duration_s: 330, night3_duration_s: 360, fall_enabled: true,
  };
  for (const [k, v] of Object.entries(expect)) assert.equal(T[k], v, k);
  assert.deepEqual(T.score, { per_mote: 10, per_lantern: 100, per_stun: 5, per_second_left: 2, per_flame_left: 50 });
});

test('maps: lantern counts, durations, start positions, --night 1|2|3', () => {
  const a = run({ night: 1, ticks: 0 }).at(0);
  const b = run({ night: 2, ticks: 0 }).at(0);
  const c = run({ night: 3, ticks: 0 }).at(0);
  assert.deepEqual([a.lanterns.length, b.lanterns.length, c.lanterns.length], [5, 6, 7]);
  assert.deepEqual([a.time_left_s, b.time_left_s, c.time_left_s], [300, 330, 360]);
  assert.deepEqual([a.night, b.night, c.night], [1, 2, 3]);
  assert.deepEqual(a.player.pos, [0, 0, 0]);
  assert.deepEqual(a.lanterns.map((l) => l.pos), [[0, 0, 25], [23.8, 0, 7.7], [14.7, 0, -20.2], [-14.7, 0, -20.2], [-23.8, 0, 7.7]]);
  assert.deepEqual(b.lanterns.map((l) => l.pos[0]), [0, 17, -17, 70, 87, 53]);
  assert.deepEqual(c.lanterns[0].pos, [0, 6, 6]);
  assert.equal(a.motes_active, 20);
  assert.equal(c.motes_active, 20);
  assert.equal(run({ night: 4, ticks: 0 }).status, 1);
});

test('snapshot v1.1 shape', () => {
  const s = run({ night: 3, ticks: 0 }).at(0);
  for (const k of ['night', 'wind', 'motes', 'drifters', 'charms']) assert.ok(k in s, k);
  for (const k of ['vel', 'grounded', 'invuln', 'dash_cd_s', 'pulse_cd_s', 'charm_s']) assert.ok(k in s.player, k);
  assert.deepEqual(Object.keys(s.wind).sort(), ['active', 'dir_deg']);
  assert.deepEqual(Object.keys(s.motes[0]).sort(), ['id', 'kind', 'pos', 'ttl_s']);
  assert.equal(s.motes[0].kind, 'random');
  assert.deepEqual(s.charms.map((c) => c.id), ['C1', 'C2']);
});

// ---------------------------------------------------------------- movement
test('tick model: snapshot 0 first, N steps, speed 6, night_start event', () => {
  const r = run({ scenario: empty, frames: [{ tick: 0, move: [0, 1] }], ticks: 120 });
  assert.equal(r.status, 0);
  assert.deepEqual(r.at(0).player.pos, [0, 0, 0]);
  assert.equal(r.at(120).time_left_s, 298);
  assert.equal(r.at(120).sim_tick, 120);
  near(r.at(120).player.pos[2], 12, 1e-6);
  assert.deepEqual(r.ev('night_start')[0].data, { night: 1 });
  assert.deepEqual(r.end, { type: 'end', ticks: 120, state: 'playing', score: 0 });
});

test('camera yaw rotates move; diagonal normalised', () => {
  const a = run({ scenario: empty, frames: [{ tick: 0, move: [1, 0], cam_yaw_deg: 90 }], ticks: 60 }).at(60).player.pos;
  near(a[0], 0, 1e-3);
  near(a[2], -6, 1e-3);
  const b = run({ scenario: empty, frames: [{ tick: 0, move: [1, 1] }], ticks: 60 }).at(60).player.pos;
  near(Math.hypot(b[0], b[2]), 6, 2e-3);
});

test('jump: 7 m/s, gravity 20, only from the ground', () => {
  const r = run({ scenario: empty, frames: [...press(0, 'jump'), ...press(10, 'jump')], ticks: 90, every: 1 });
  const ys = r.snaps.map((s) => s.player.pos[1]);
  assert.ok(Math.max(...ys) > 1.15 && Math.max(...ys) < 1.24, `apex ${Math.max(...ys)}`);
  assert.equal(r.at(90).player.pos[1], 0);
  assert.equal(r.at(90).player.grounded, true);
  assert.equal(r.at(1).player.grounded, false);
});

test('dash: 14 m/s for 12 ticks, cooldown 90 ticks from start, ignored while dashing, idle dashes along facing', () => {
  const frames = [...press(0, 'dash'), ...press(5, 'dash'), ...press(50, 'dash'), ...press(90, 'dash')];
  const r = run({ scenario: empty, frames, ticks: 110, every: 1 });
  assert.deepEqual(r.ev('dash').map((e) => e.tick), [1, 91]);
  near(r.at(12).player.pos[2], 2.8, 1e-6);
  near(r.at(13).player.pos[2], 2.8, 1e-6); // dash over after exactly 12 ticks
  near(r.at(1).player.vel[2], 14, 1e-6);
  assert.equal(r.at(2).player.dash_cd_s, 1.483);
  // direction follows movement when moving
  const m = run({ scenario: empty, frames: [{ tick: 0, move: [1, 0], dash: true }, { tick: 1, dash: false, move: [0, 0] }], ticks: 13, every: 1 });
  near(m.at(12).player.pos[0], 2.8, 1e-6);
});

test('dash keeps altitude in the air and is not invulnerable', () => {
  const sc = { ...empty, shades: [{ id: 'S1', pos: [0, 1, 6], state: 'chase' }] };
  const r = run({ scenario: sc, frames: [...press(0, 'jump'), ...press(20, 'dash')], ticks: 40, every: 1 });
  const y = r.at(20).player.pos[1];
  for (let t = 21; t <= 32; t++) near(r.at(t).player.pos[1], y, 1e-9, `tick ${t}`);
  assert.equal(r.at(25).player.invuln, 0);
});

// ---------------------------------------------------------------- motes & lanterns
test('pickup: XZ <= 1.0, height diff <= 1.5, capacity 10', () => {
  const r = run({
    scenario: { ...empty, player: { carried: 8 }, motes: [[0, 0, 1], [0, 0, 1.01], [0, 1.4, 0.5], [0, 1.6, 0.5], [0.2, 0, 0.2]] },
    ticks: 3,
    every: 1,
  });
  assert.deepEqual(r.ev('mote_picked').map((e) => [e.tick, e.data.carried]), [[1, 9], [1, 10]]);
  assert.equal(r.at(3).motes_active, 3);
  assert.equal(r.at(3).player.carried, 10);
});

test('dropped mote TTL: gone exactly when ttl hits 0', () => {
  const r = run({ scenario: { ...empty, motes: [{ pos: [10, 0, 10], kind: 'dropped', ttl_ticks: 3 }] }, ticks: 5, every: 1 });
  assert.deepEqual(r.snaps.map((s) => s.motes_active), [1, 1, 1, 0, 0, 0]);
  assert.equal(r.at(1).motes[0].kind, 'dropped');
  assert.equal(r.at(1).motes[0].ttl_s, 0.033);
});

test('deposit: nearest unlit lantern, ties to smaller id, remembers progress, scores 10 per mote deposited', () => {
  const sc = { ...empty, player: { carried: 4 }, lanterns: [{ id: 'L1', pos: [0, 0, 1.5], deposited: 6 }, { id: 'L2', pos: [0, 0, -1.5] }] };
  const r = run({ scenario: sc, frames: press(0, 'interact'), ticks: 3, every: 1 });
  assert.deepEqual(r.ev('deposit')[0].data, { lantern_id: 'L1', amount: 4, deposited: 10 });
  assert.deepEqual(r.ev('lantern_lit')[0].data, { lantern_id: 'L1' });
  assert.equal(r.at(3).score, 4 * T.score.per_mote + T.score.per_lantern);
  assert.equal(r.at(3).lanterns.find((l) => l.id === 'L2').deposited, 0);
  // partial deposit leaves lantern unlit; out of range / nothing carried does nothing
  const p = run({ scenario: { ...empty, player: { carried: 3 }, lanterns: [{ id: 'L1', pos: [0, 0, 2] }] }, frames: press(0, 'interact'), ticks: 2, every: 1 });
  assert.deepEqual(p.ev('deposit')[0].data, { lantern_id: 'L1', amount: 3, deposited: 3 });
  assert.equal(p.at(2).lanterns[0].lit, false);
  const far = run({ scenario: { ...empty, player: { carried: 3 }, lanterns: [{ id: 'L1', pos: [0, 0, 2.01] }] }, frames: press(0, 'interact'), ticks: 2 });
  assert.equal(far.ev('deposit').length, 0);
});

test('win: all lit => won (even on the timeout tick); bonus = floor(s left)*2 + 50*flames; scenario lit gives no points', () => {
  const sc = { ...empty, player: { carried: 10, flames: 2 }, lanterns: [{ id: 'L1', pos: [0, 0, 1] }, ...litExcept('L1')], time_left_s: 100 };
  const r = run({ scenario: sc, frames: press(5, 'interact'), ticks: 600, every: 1 });
  assert.equal(r.at(0).score, 0);
  assert.deepEqual(r.ev('game_over')[0].data, { result: 'won', reason: 'all_lit' });
  assert.equal(r.end.ticks, 6);
  assert.equal(r.end.score, 100 + 100 + 2 * Math.floor(100 - 6 / 60) + 50 * 2);
  const edge = run({ scenario: { ...sc, time_left_s: 1, player: { carried: 10, flames: 3 } }, frames: press(59, 'interact'), ticks: 100 });
  assert.equal(edge.end.state, 'won');
  assert.equal(edge.end.ticks, 60);
  assert.equal(edge.end.score, 100 + 100 + 0 + 150);
});

test('loss: dawn; no_flames when the last flame goes; score kept, no bonus', () => {
  const d = run({ scenario: { ...empty, time_left_s: 1 }, ticks: 600 });
  assert.deepEqual(d.ev('game_over')[0].data, { result: 'lost', reason: 'dawn' });
  assert.equal(d.end.ticks, 60);
  const sc = { ...empty, player: { carried: 10, flames: 1 }, shades: [{ id: 'S1', pos: [0.5, 1, 0], state: 'chase' }] };
  const r = run({ scenario: sc, ticks: 5 });
  assert.deepEqual(r.ev('game_over')[0].data, { result: 'lost', reason: 'no_flames' });
  assert.equal(r.end.score, 0);
});

test('a shade inside the zone of a lantern lit this tick cannot hurt the player (victory stands)', () => {
  const sc = { ...empty, player: { carried: 10, flames: 1 }, lanterns: [{ id: 'L1', pos: [0, 0, 1] }, ...litExcept('L1')], shades: [{ id: 'S1', pos: [0.5, 1, 0], state: 'chase' }] };
  const r = run({ scenario: sc, frames: press(0, 'interact'), ticks: 5 });
  assert.equal(r.ev('player_hit').length, 0);
  assert.deepEqual(r.ev('game_over')[0].data, { result: 'won', reason: 'all_lit' });
});

// ---------------------------------------------------------------- shades
test('shade AI: detects at 12 m, chases at 4 m/s, gives up beyond 18 m', () => {
  const a = run({ scenario: { ...empty, player: { flames: 9 }, shades: [{ id: 'S1', pos: [10, 1, 0] }] }, ticks: 60, every: 1 });
  assert.equal(a.at(1).shades[0].state, 'chase');
  near(a.at(60).shades[0].pos[0], 6, 0.01);
  const b = run({ scenario: { ...empty, shades: [{ id: 'S1', pos: [13, 1, 0] }] }, ticks: 3, every: 1 });
  assert.equal(b.at(1).shades[0].state, 'wander');
  const c = run({ scenario: { ...empty, shades: [{ id: 'S1', pos: [19, 1, 0], state: 'chase' }] }, ticks: 3, every: 1 });
  assert.equal(c.at(1).shades[0].state, 'wander');
});

test('shade hit: -1 flame, drop floor(carried/2) on a 1.5-2.5 ring, invuln 90, recoil 2 m / 60 ticks, one hit per tick', () => {
  const sc = { ...empty, player: { carried: 7, flames: 3 }, shades: [{ id: 'S1', pos: [0.5, 1, 0], state: 'chase' }, { id: 'S2', pos: [0, 1, 0.5], state: 'chase' }] };
  const r = run({ scenario: sc, ticks: 100, every: 1 });
  const hits = r.ev('player_hit');
  assert.equal(hits[0].tick, 1);
  assert.deepEqual(hits[0].data, { by: 'shade', flames: 2, dropped: 3 });
  assert.equal(hits.filter((h) => h.tick === 1).length, 1);
  assert.equal(r.at(1).player.carried, 4);
  assert.equal(r.at(1).player.invuln, 90);
  assert.equal(r.at(2).player.invuln, 89);
  const dropped = r.at(1).motes.filter((m) => m.kind === 'dropped');
  assert.equal(dropped.length, 3);
  for (const m of dropped) assert.ok(Math.hypot(m.pos[0], m.pos[2]) >= 1.5 - 1e-3 && Math.hypot(m.pos[0], m.pos[2]) <= 2.5 + 1e-3);
  assert.equal(r.at(1).motes[0].ttl_s, 8);
  const s1 = (t) => r.at(t).shades.find((s) => s.id === 'S1');
  assert.equal(s1(1).state, 'recoil');
  near(Math.hypot(s1(61).pos[0] - s1(1).pos[0], s1(61).pos[2] - s1(1).pos[2]), 2, 0.003);
  assert.equal(s1(61).state, 'recoil');
  assert.equal(s1(62).state, 'chase');
  assert.equal(hits.filter((h) => h.tick > 1 && h.tick <= 90).length, 0); // invulnerable window
});

test('invulnerable player: shade contact does nothing (no recoil); height diff > 1.5 does not hit', () => {
  const a = run({ scenario: { ...empty, player: { invuln_ticks: 50 }, shades: [{ id: 'S1', pos: [0.5, 1, 0], state: 'chase' }] }, ticks: 10, every: 1 });
  assert.equal(a.ev('player_hit').length, 0);
  assert.equal(a.at(5).shades[0].state, 'chase');
  const b = run({ scenario: { ...empty, player: { pos: [0, 1.7, 0] }, shades: [{ id: 'S1', pos: [0.5, 1, 0], state: 'chase' }] }, ticks: 1, every: 1 });
  assert.equal(b.ev('player_hit').length, 0);
});

test('spawn schedule night 1: 2 shades at tick 300 (>=15 m away, S1,S2), then 1 every 480; spawning -> wander', () => {
  const r = run({ seed: 5, scenario: { player: { flames: 99 } }, ticks: 1500, every: 1 });
  assert.deepEqual(r.ev('shade_spawned').map((e) => [e.tick, e.data.id]), [[300, 'S1'], [300, 'S2'], [780, 'S3'], [1260, 'S4']]);
  for (const s of r.at(300).shades) {
    near(Math.hypot(s.pos[0], s.pos[2]), 37, 0.01);
    near((((Math.atan2(s.pos[2], s.pos[0]) * 180) / Math.PI + 360) % 30), 15, 0.01);
    assert.equal(s.state, 'spawning');
    assert.equal(s.state_ticks_left, 30);
  }
  assert.equal(r.at(329).shades[0].state, 'spawning');
  assert.equal(r.at(330).shades[0].state, 'wander');
  const names = new Set(r.snaps.flatMap((s) => s.shades.map((x) => x.state)));
  for (const nm of names) assert.ok(['spawning', 'wander', 'chase', 'recoil', 'stunned'].includes(nm), nm);
});

test('spawn schedule: motes 20 on distinct points, +1 every 240 ticks up to 24 points, then skip', () => {
  const r = run({ seed: 9, scenario: { player: { flames: 99 }, random_shades: false }, ticks: 1300, every: 1 });
  assert.equal(r.at(0).motes_active, 20);
  const key = (m) => m.pos.join(',');
  assert.equal(new Set(r.at(0).motes.map(key)).size, 20);
  assert.equal(r.at(239).motes_active, 20);
  assert.equal(r.at(240).motes_active, 21);
  assert.equal(r.at(480).motes_active, 22);
  assert.equal(r.at(960).motes_active, 24);
  assert.equal(r.at(1200).motes_active, 24);
  for (const m of r.at(1200).motes) { const d = Math.hypot(m.pos[0], m.pos[2]); assert.ok(Math.abs(d - 12) < 0.01 || Math.abs(d - 33) < 0.01, `${d}`); }
});

// ---------------------------------------------------------------- pulse
test('pulse: costs 3, centre at feet+0.8 (3D radius 5), stun 120, push 4 m in 15 ticks, +5 each, cooldown 3 s', () => {
  const sc = {
    ...empty,
    player: { carried: 6, invuln_ticks: 400 },
    shades: [
      { id: 'S1', pos: [4, 1, 0] }, { id: 'S2', pos: [4.9, 1, 0] }, { id: 'S3', pos: [5, 1, 0] },
      { id: 'S4', pos: [0, 5.9, 0] }, { id: 'S5', pos: [0, 5.7, 0] },
    ],
  };
  const r = run({ scenario: sc, frames: [...press(0, 'pulse'), ...press(60, 'pulse'), ...press(180, 'pulse')], ticks: 190, every: 1 });
  assert.deepEqual(r.ev('pulse').map((e) => e.tick), [1, 181]); // the one at tick 61 is refused by the cooldown
  assert.deepEqual(r.ev('pulse')[0].data.stunned_ids, ['S1', 'S2', 'S5']);
  assert.equal(r.at(1).player.carried, 3);
  assert.equal(r.at(1).score, 15);
  assert.equal(r.at(1).player.pulse_cd_s, 3);
  const s = (id, t) => r.at(t).shades.find((x) => x.id === id);
  assert.equal(s('S1', 1).state, 'stunned');
  assert.equal(s('S3', 1).state === 'stunned', false);
  near(s('S1', 14).pos[0], 4 + (4 * 14) / 15, 0.002);
  near(s('S1', 15).pos[0], 8, 0.002);
  near(s('S1', 40).pos[0], 8, 0.002);
  near(s('S5', 15).pos[0], 4, 0.002); // coincident => pushed along +X
  assert.equal(r.at(181).player.carried, 0);
});

test('pulse refuses with < 3 motes; restuns (and rescores) an already stunned shade; stun lasts exactly 120 ticks', () => {
  const no = run({ scenario: { ...empty, player: { carried: 2 } }, frames: press(0, 'pulse'), ticks: 3 });
  assert.equal(no.ev('pulse').length, 0);
  assert.equal(no.at(0).player.carried, 2);
  const sc = { ...empty, player: { carried: 3 }, shades: [{ id: 'S1', pos: [3, 1, 0], state: 'stunned', state_ticks_left: 100 }] };
  const r = run({ scenario: sc, frames: press(0, 'pulse'), ticks: 125, every: 1 });
  assert.equal(r.at(1).score, 5);
  assert.equal(r.at(1).shades[0].state_ticks_left, 120);
  assert.equal(r.at(120).shades[0].state, 'stunned');
  assert.equal(r.at(120).shades[0].state_ticks_left, 1);
  assert.equal(r.at(121).shades[0].state, 'chase');
});

// ---------------------------------------------------------------- safe zone
test('safe zone: shades never enter 6 m of a lit lantern', () => {
  const sc = { ...empty, lanterns: [{ id: 'L1', pos: [0, 0, 0], lit: true }], shades: [{ id: 'S1', pos: [20, 1, 0] }] };
  const r = run({ scenario: sc, ticks: 600, every: 1 });
  for (const s of r.snaps) assert.ok(Math.hypot(s.shades[0].pos[0], s.shades[0].pos[2]) >= 6 - 1e-3);
  assert.equal(r.ev('player_hit').length, 0);
});

test('lighting a lantern expels shades inside within 30 ticks, harmlessly', () => {
  const sc = { ...empty, player: { pos: [2.5, 0, 0], carried: 10 }, lanterns: [{ id: 'L1', pos: [2.5, 0, -1.5] }], shades: [{ id: 'S1', pos: [3, 1, 0], state: 'chase' }] };
  const r = run({ scenario: sc, frames: press(0, 'interact'), ticks: 300, every: 1 });
  assert.equal(r.ev('lantern_lit').length, 1);
  assert.equal(r.ev('player_hit').length, 0);
  const sh = (t) => r.at(t).shades[0].pos;
  assert.ok(Math.hypot(sh(31)[0] - 2.5, sh(31)[2] + 1.5) >= 6 - 1e-3);
  for (let t = 31; t <= 300; t += 17) assert.ok(Math.hypot(sh(t)[0] - 2.5, sh(t)[2] + 1.5) >= 6 - 1e-3);
});

// ---------------------------------------------------------------- falling
test('fall: -1 flame, lose motes, ignores invuln, 60 tick wait, respawn at start with invuln 90', () => {
  const sc = { ...empty, player: { pos: [39, 0, 0], carried: 4, invuln_ticks: 500 } };
  const r = run({ scenario: sc, frames: [{ tick: 0, move: [1, 0] }], ticks: 200, every: 1 });
  const f = r.ev('player_hit')[0];
  assert.deepEqual(f.data, { by: 'fall', flames: 2, dropped: 0, lost: 4 });
  assert.equal(r.ev('player_hit').filter((e) => e.data.by === 'fall').length, 1);
  assert.ok(r.at(f.tick).player.pos[1] < -10);
  assert.equal(r.at(f.tick).player.carried, 0);
  const frozen = r.at(f.tick + 59).player.pos;
  assert.deepEqual(r.at(f.tick + 30).player.pos, frozen);
  const back = r.at(f.tick + 60).player;
  assert.deepEqual(back.pos, [0, 0, 0]);
  assert.deepEqual(back.vel, [0, 0, 0]);
  assert.equal(back.invuln, 90);
  assert.equal(back.grounded, true);
});

test('fall with the last flame: lost no_flames at once, no respawn', () => {
  const r = run({ scenario: { ...empty, player: { pos: [39, 0, 0], flames: 1 } }, frames: [{ tick: 0, move: [1, 0] }], ticks: 400 });
  const f = r.ev('player_hit')[0];
  assert.equal(f.data.flames, 0);
  assert.deepEqual(r.ev('game_over')[0], { type: 'event', tick: f.tick, name: 'game_over', data: { result: 'lost', reason: 'no_flames' } });
  assert.equal(r.end.ticks, f.tick);
});

// ---------------------------------------------------------------- night 2
test('night 2: bamboo bridge connects islands; off the bridge you fall; pads launch to the far island', () => {
  const walk = run({ night: 2, scenario: empty, frames: [{ tick: 0, move: [1, 0] }], ticks: 750, every: 50 });
  assert.equal(walk.ev('player_hit').length, 0);
  assert.ok(walk.at(750).player.pos[0] > 60);
  const gap = run({ night: 2, scenario: { ...empty, player: { pos: [35, 0, 3] } }, ticks: 200 });
  assert.equal(gap.ev('player_hit')[0].data.by, 'fall');
  const pad = run({ night: 2, scenario: { ...empty, player: { pos: [20, 0, 18] } }, frames: [{ tick: 0, move: [0, -1] }], ticks: 100, every: 1 });
  assert.ok(pad.at(1).player.pos[1] > 0.1);
  near(pad.at(1).player.vel[1] > 13 ? 1 : 0, 1, 0);
  const landed = pad.snaps.find((s) => s.tick > 10 && s.player.grounded);
  assert.ok(landed.tick >= 83 && landed.tick <= 87, `landing tick ${landed.tick}`);
  assert.ok(Math.hypot(landed.player.pos[0] - 70, landed.player.pos[2]) < 28, 'lands inside island B');
  assert.ok(landed.player.pos[0] > 45 && landed.player.pos[0] < 58);
  assert.equal(pad.ev('player_hit').length, 0);
  const back = run({ night: 2, scenario: { ...empty, player: { pos: [50, 0, -18] } }, ticks: 100, every: 1 });
  const l2 = back.snaps.find((s) => s.tick > 10 && s.player.grounded);
  assert.ok(Math.hypot(l2.player.pos[0], l2.player.pos[2]) < 28, 'lands inside island A');
});

test('charm: speed 7.2 and dash without cooldown while active (600 ticks)', () => {
  const sc = { ...empty, player: { pos: [35, 0, 0.5] } };
  delete sc.charms;
  const frames = [{ tick: 1, move: [1, 0] }, { tick: 100, move: [0, 0], dash: true }, { tick: 101, dash: false }, ...press(120, 'dash')];
  const r = run({ night: 2, scenario: sc, frames, ticks: 650, every: 1 });
  assert.deepEqual(r.ev('charm_picked').map((e) => [e.tick, e.data]), [[1, { charm_id: 'C1', charm_ticks: 600 }]]);
  assert.equal(r.at(1).player.charm_s, 10);
  assert.equal(r.at(1).charms[0].available, false);
  assert.equal(r.at(1).charms[0].respawn_s, 45);
  near(r.at(3).player.vel[0], 7.2, 1e-9);
  assert.deepEqual(r.ev('dash').map((e) => e.tick), [101, 121]); // 20 ticks apart: allowed only because of the charm
  assert.equal(r.at(101).player.dash_cd_s, 0);
  assert.equal(r.at(600).player.charm_s, 0.017);
  assert.equal(r.at(601).player.charm_s, 0);
  near(r.at(650).player.vel[0], 0, 1e-9);
});

test('charm respawns 2700 ticks after pickup and can be picked again', () => {
  const sc = { ...empty, player: { pos: [35, 0, 0.5] } };
  delete sc.charms;
  const r = run({ night: 2, scenario: sc, ticks: 2705, every: 1 });
  assert.deepEqual(r.ev('charm_picked').map((e) => e.tick), [1, 2701]);
  assert.equal(r.at(2700).charms[0].available, false);
  assert.equal(r.at(2700).charms[0].respawn_s, 0.017);
});

test('without the charm the second dash within 1.5 s is refused', () => {
  const r = run({ scenario: empty, frames: [...press(0, 'dash'), ...press(20, 'dash')], ticks: 40 });
  assert.equal(r.ev('dash').length, 1);
});

// ---------------------------------------------------------------- drifters
test('drifter: idle -> chase when carrying >= 5 within 15 m; steals min(3, carried) once, ignoring invuln; flees 240 ticks then vanishes', () => {
  const sc = { ...empty, player: { carried: 5, invuln_ticks: 600 }, drifters: [{ id: 'D1', pos: [10, 1.5, 0] }] };
  const r = run({ night: 2, scenario: sc, ticks: 400, every: 1 });
  assert.equal(r.at(1).drifters[0].state, 'chase');
  const s = r.ev('drifter_steal');
  assert.equal(s.length, 1);
  assert.deepEqual(s[0].data, { drifter_id: 'D1', amount: 3, carried: 2 });
  assert.ok(s[0].tick >= 70 && s[0].tick <= 80, `steal at ${s[0].tick}`);
  assert.equal(r.at(s[0].tick).drifters[0].state, 'flee');
  assert.equal(r.at(s[0].tick).drifters[0].stolen, 3);
  assert.equal(r.at(s[0].tick + 239).drifters.length, 1);
  assert.equal(r.at(s[0].tick + 240).drifters.length, 0);
  assert.equal(r.at(s[0].tick).player.flames, 3);
  assert.equal(r.ev('player_hit').length, 0);
  const idle = run({ night: 2, scenario: { ...empty, player: { carried: 4 }, drifters: [{ id: 'D1', pos: [10, 1.5, 0] }] }, ticks: 5, every: 1 });
  assert.equal(idle.at(1).drifters[0].state, 'idle');
  const lose = run({ night: 2, scenario: { ...empty, player: { carried: 5 }, drifters: [{ id: 'D1', pos: [16, 1.5, 0] }] }, ticks: 3, every: 1 });
  assert.equal(lose.at(1).drifters[0].state, 'idle'); // out of the 15 m range
});

test('pulse: chase drifter flees without stealing; fleeing drifter drops its loot (dropped motes) and vanishes after 120 ticks', () => {
  const a = run({ night: 2, scenario: { ...empty, player: { carried: 8 }, drifters: [{ id: 'D1', pos: [4, 1.5, 0], state: 'chase' }] }, frames: press(0, 'pulse'), ticks: 245, every: 1 });
  assert.equal(a.ev('drifter_steal').length, 0);
  assert.equal(a.at(1).drifters[0].state, 'flee');
  assert.equal(a.at(1).drifters[0].stolen, 0);
  assert.equal(a.at(240).drifters.length, 1);
  assert.equal(a.at(241).drifters.length, 0);
  const b = run({ night: 2, scenario: { ...empty, player: { carried: 3 }, drifters: [{ id: 'D1', pos: [4, 1.5, 0], state: 'flee', stolen: 3, state_ticks_left: 200 }] }, frames: press(0, 'pulse'), ticks: 125, every: 1 });
  assert.deepEqual(b.ev('drifter_drop')[0].data, { drifter_id: 'D1', amount: 3 });
  const dropped = b.at(1).motes.filter((m) => m.kind === 'dropped');
  assert.equal(dropped.length, 3);
  near(dropped[0].pos[0], 4, 0.01);
  assert.equal(b.at(1).drifters[0].stolen, 0);
  assert.equal(b.at(120).drifters.length, 1);
  assert.equal(b.at(121).drifters.length, 0);
});

test('drifter schedule: ticks 1200, 2400 (max 2, ids D1, D2), none on night 1', () => {
  const r = run({ night: 2, seed: 2, scenario: { player: { flames: 99 }, random_shades: false, random_motes: false }, ticks: 3700, every: 1 });
  assert.equal(r.at(1199).drifters.length, 0);
  assert.deepEqual(r.at(1200).drifters.map((d) => d.id), ['D1']);
  assert.deepEqual(r.at(2400).drifters.map((d) => d.id), ['D1', 'D2']);
  assert.equal(r.at(3600).drifters.length, 2);
  const n1 = run({ night: 1, seed: 2, scenario: { player: { flames: 99 } }, ticks: 3700, every: 100 });
  assert.ok(n1.snaps.every((s) => s.drifters.length === 0));
});

// ---------------------------------------------------------------- night 3
test('night 3: cliffs block, ramps climb, pad reaches tier 2', () => {
  const wall = run({ night: 3, scenario: { ...empty, player: { pos: [0, 0, 30] } }, frames: [{ tick: 0, move: [0, -1] }], ticks: 120 });
  const wz = wall.at(120).player.pos;
  assert.ok(wz[2] >= 24 - 0.01 && wz[2] < 24.2 && wall.at(120).player.pos[1] === 0, `blocked at ${wz}`);
  const ramp = run({ night: 3, scenario: { ...empty, player: { pos: [25.98, 0, 15] } }, frames: [{ tick: 0, move: [-0.866025, -0.5] }], ticks: 100, every: 1 });
  assert.ok(ramp.at(30).player.pos[1] > 1.2 && ramp.at(30).player.pos[1] < 1.8, `mid ramp y=${ramp.at(30).player.pos[1]}`);
  near(ramp.at(100).player.pos[1], 3, 1e-6);
  assert.equal(ramp.at(100).player.grounded, true);
  const pad = run({ night: 3, scenario: { ...empty, player: { pos: [0, 3, 13] } }, ticks: 100, every: 1 });
  const land = pad.snaps.find((s) => s.tick > 5 && s.player.grounded);
  near(land.player.pos[1], 6, 1e-6);
  assert.ok(Math.hypot(land.player.pos[0], land.player.pos[2]) < 8 && land.player.pos[2] > 5.5 && land.player.pos[2] < 7);
  assert.equal(pad.ev('player_hit').length, 0);
  // the tower is solid: walking into it from tier 2 stops at r = 2
  const tower = run({ night: 3, scenario: { ...empty, player: { pos: [0, 6, 6] } }, frames: [{ tick: 0, move: [0, -1] }], ticks: 120 });
  near(tower.at(120).player.pos[2], 2, 0.01);
  assert.equal(tower.at(120).player.pos[1], 6);
  // stepping off tier 2 drops to the tier below / ground
  const off = run({ night: 3, scenario: { ...empty, player: { pos: [0, 6, 7] } }, frames: [{ tick: 0, move: [0, 1] }], ticks: 90, every: 1 });
  assert.ok(off.at(90).player.pos[1] < 6);
});

test('night 3 wind: gusts every 30 s for 5 s at 2 m/s in a random direction; disabled by wind_enabled=false', () => {
  const sc = { ...empty, wind_enabled: true, player: { pos: [0, 0, -30] } };
  const r = run({ night: 3, seed: 4, scenario: sc, ticks: 2200, every: 1 });
  assert.equal(r.at(1799).wind.active, false);
  assert.equal(r.at(1800).wind.active, true);
  assert.equal(r.at(2099).wind.active, true);
  assert.equal(r.at(2100).wind.active, false);
  const dir = r.at(1800).wind.dir_deg;
  assert.equal(r.at(2000).wind.dir_deg, dir);
  const a = r.at(1799).player.pos;
  const b = r.at(2100).player.pos;
  near(Math.hypot(b[0] - a[0], b[2] - a[2]), 10, 0.05);
  near(((Math.atan2(b[2] - a[2], b[0] - a[0]) * 180) / Math.PI + 360) % 360, dir, 1);
  const off = run({ night: 3, seed: 4, scenario: { ...sc, wind_enabled: false }, ticks: 2200, every: 400 });
  assert.deepEqual(off.at(2000).player.pos, [0, 0, -30]);
});

test('wind warning is raised 2 s before the first gust', () => {
  const g = new Game({ seed: 1, night: 3, tuning: T, scenario: { ...empty, wind_enabled: true } });
  const idle = { move: [0, 0], cam_yaw_deg: 0, jump: false, interact: false, pulse: false, dash: false, pause: false };
  const warn = [];
  for (let i = 0; i < 1800; i++) {
    g.step(idle);
    warn.push(g.wind.warning);
  }
  assert.equal(warn[1678], false); // tick 1679
  assert.equal(warn[1679], true); // tick 1680 = 1800 - 120
  assert.equal(warn[1798], true);
});

// ---------------------------------------------------------------- pause
test('pause freezes simulation; paused/resumed events; snapshot state "paused"', () => {
  const frames = [{ tick: 0, move: [0, 1] }, ...press(10, 'pause'), ...press(50, 'pause')];
  const r = run({ scenario: empty, frames, ticks: 100, every: 1 });
  assert.deepEqual(r.ev('paused').map((e) => e.tick), [11]);
  assert.deepEqual(r.ev('resumed').map((e) => e.tick), [51]);
  assert.equal(r.at(10).state, 'playing');
  assert.equal(r.at(11).state, 'paused');
  assert.equal(r.at(50).state, 'paused');
  assert.equal(r.at(51).state, 'playing');
  assert.equal(r.at(30).sim_tick, 10);
  assert.equal(r.at(30).tick, 30);
  assert.equal(r.at(30).time_left_s, r.at(10).time_left_s);
  assert.deepEqual(r.at(30).player.pos, r.at(10).player.pos);
  assert.equal(r.at(51).sim_tick, 11);
  assert.equal(r.at(100).sim_tick, 60);
});

// ---------------------------------------------------------------- IO, determinism, perf
test('validation: bad inputs/scenario exit 2 with a message; bad CLI exits non-zero', () => {
  const badInputs = ['{not json', '{"frames": 3}', '{"frames":[{"tick":5},{"tick":5}]}', '{"frames":[{"tick":5},{"tick":2}]}', '{"frames":[{"tick":0,"move":[2,0]}]}', '{"frames":[{"tick":0,"pulse":"yes"}]}', '{"frames":[{"tick":0,"dash":1}]}', '{"frames":[{"tick":0,"pause":"x"}]}'];
  for (const inputs of badInputs) {
    const r = run({ raw: { inputs } });
    assert.equal(r.status, 2, inputs);
    assert.match(r.stderr, /inputs/);
  }
  const badScen = ['oops', '[]', '{"player":{"pos":[1,2]}}', '{"shades":[{"id":"S1"}]}', '{"shades":[{"pos":[0,0,0],"state":"foo"}]}', '{"drifters":[{"pos":[0,0]}]}', '{"charms":[{"pos":[0,0,0]}]}', '{"random_drifters":"no"}', '{"player":{"charm_ticks":1.5}}'];
  for (const scenario of badScen) assert.equal(run({ raw: { scenario } }).status, 2, scenario);
  const r = spawnSync('node', ['src/headless.js', '--seed', '1'], { cwd: root, encoding: 'utf8' });
  assert.notEqual(r.status, 0);
  assert.ok(r.stderr.length > 0);
});

test('stops at game end before --ticks and exits 0', () => {
  const r = run({ scenario: { ...empty, time_left_s: 0.5 }, ticks: 5000, every: 7 });
  assert.equal(r.status, 0);
  assert.equal(r.end.ticks, 30);
});

test('determinism: every night, random everything, identical bytes across runs; different seed differs', () => {
  const frames = [{ tick: 0, move: [0.3, 1] }, ...press(200, 'pulse'), ...press(300, 'dash'), ...press(400, 'jump'), { tick: 500, move: [-1, 0.2], cam_yaw_deg: 40 }];
  for (const night of [1, 2, 3]) {
    const a = run({ night, seed: 7, frames, ticks: 4000, scenario: { player: { flames: 99, carried: 9 } } });
    const b = run({ night, seed: 7, frames, ticks: 4000, scenario: { player: { flames: 99, carried: 9 } } });
    const c = run({ night, seed: 8, frames, ticks: 4000, scenario: { player: { flames: 99, carried: 9 } } });
    assert.equal(a.status, 0);
    assert.equal(crypto.createHash('sha256').update(a.raw).digest('hex'), crypto.createHash('sha256').update(b.raw).digest('hex'), `night ${night}`);
    assert.notEqual(a.raw, c.raw);
  }
});

test('performance: a full night (21600 ticks) runs headless in <= 30 s', () => {
  for (const night of [1, 2, 3]) {
    const t0 = Date.now();
    const r = run({ night, ticks: 21600, scenario: { player: { flames: 99 } }, seed: 3 });
    assert.equal(r.status, 0);
    assert.ok(Date.now() - t0 < 30000, `night ${night} took ${Date.now() - t0} ms`);
  }
});

// ---------------------------------------------------------------- shade navigation
test('smarter shades: path around the gap to the bridge (night 2) and up a ramp to tier 1 (night 3)', () => {
  const idleFor = { random_motes: false, random_shades: false, random_drifters: false, wind_enabled: false, motes: [], charms: [], drifters: [] };
  // straight line from island A edge to the bridge end crosses open sea; the shade must walk to the bridge
  const a = run({ night: 2, scenario: { ...idleFor, player: { pos: [42, 0, 1], flames: 99, invuln_ticks: 0 }, shades: [{ id: 'S1', pos: [27, 1, 6], state: 'chase' }] }, ticks: 900, every: 1 });
  assert.ok(a.ev('player_hit').length > 0, 'shade reached the player across the bridge');
  assert.ok(a.snaps.every((s) => s.shades[0].pos[1] === 1 || s.tick === 0), 'stays on the ground');
  // tier 1 player, shade on tier 0: only the ramps lead up
  const b = run({ night: 3, scenario: { ...idleFor, player: { pos: [18, 3, 10], flames: 99, invuln_ticks: 0 }, shades: [{ id: 'S1', pos: [30, 1, 12], state: 'chase' }] }, ticks: 900, every: 1 });
  assert.ok(b.ev('player_hit').length > 0, 'shade climbed to tier 1');
  assert.equal(b.at(900).shades[0].pos[1] >= 3.9 || b.ev('player_hit').length > 0, true);
  // open field behaviour is unchanged: straight line at 4 m/s
  const c = run({ scenario: { ...idleFor, player: { flames: 9 }, shades: [{ id: 'S1', pos: [10, 1, 0] }] }, ticks: 60, every: 1 });
  near(c.at(60).shades[0].pos[0], 6, 0.01);
});
