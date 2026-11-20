// Soak runner (Ticket-04 §2) through the real command from game.contract.json.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { soakPlan, randomInput, PRESS_RATES } from '../src/soak.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const contract = JSON.parse(fs.readFileSync(path.join(root, 'game.contract.json'), 'utf8'));
const runSoak = (seed, nights) => {
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'soak-')), 'soak.json');
  const [cmd, ...pre] = contract.soak_cmd.split(' ');
  const r = spawnSync(cmd, [...pre, '--seed', String(seed), '--nights', String(nights), '--out', out], { cwd: root, encoding: 'utf8' });
  return { status: r.status, out: r.status === 0 ? JSON.parse(fs.readFileSync(out, 'utf8')) : null, stderr: r.stderr };
};

test('soak: 10 nights in one process, no crash, results per night, RSS within 1.2x, deterministic results', () => {
  const a = runSoak(7, 10);
  assert.equal(a.status, 0, a.stderr);
  assert.equal(a.out.nights, 10);
  assert.equal(a.out.crashes, 0);
  assert.equal(a.out.results.length, 10);
  for (const r of a.out.results) assert.ok(r === 'won' || r === 'lost');
  assert.ok(a.out.mem_end_mb <= 1.2 * a.out.mem_start_mb, `${a.out.mem_end_mb} > 1.2 x ${a.out.mem_start_mb}`);
  assert.ok(a.out.heap_used_end_mb <= a.out.heap_used_start_mb * 1.5, 'live heap does not grow');
  assert.deepEqual(runSoak(7, 10).out.results, a.out.results);
});

test('soak: bad arguments exit non-zero', () => {
  const r = spawnSync('node', ['src/soak.js', '--nights', 'x', '--out', 'x.json'], { cwd: root, encoding: 'utf8' });
  assert.notEqual(r.status, 0);
});

test('soak plan: night i (1-based) uses seed + i, nights rotate 1 -> 2 -> 3', () => {
  assert.deepEqual(soakPlan(7, 4), [
    { index: 1, night: 1, seed: 8 },
    { index: 2, night: 2, seed: 9 },
    { index: 3, night: 3, seed: 10 },
    { index: 4, night: 1, seed: 11 },
  ]);
  assert.equal(soakPlan(7, 10).at(-1).seed, 17);
});

test('soak input: presses (false -> true) happen at the ticket rates; direction changes every 30 ticks', () => {
  const next = randomInput(123);
  const prev = { jump: false, dash: false, pulse: false, interact: false };
  const presses = { jump: 0, dash: 0, pulse: 0, interact: 0 };
  const N = 200000;
  let dirChanges = 0;
  let lastMove = null;
  for (let t = 0; t < N; t++) {
    const inp = next();
    for (const k of Object.keys(presses)) {
      if (inp[k] && !prev[k]) presses[k]++;
      prev[k] = inp[k];
    }
    if (lastMove && (inp.move[0] !== lastMove[0] || inp.move[1] !== lastMove[1])) dirChanges++;
    lastMove = [...inp.move];
  }
  for (const [k, p] of Object.entries(PRESS_RATES)) {
    const rate = presses[k] / N;
    assert.ok(Math.abs(rate - p) < 0.0035, `${k}: ${rate} vs ${p}`);
  }
  assert.equal(dirChanges, Math.ceil(N / 30) - 1);
});
