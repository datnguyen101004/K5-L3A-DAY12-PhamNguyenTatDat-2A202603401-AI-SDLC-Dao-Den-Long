// Soak runner (Ticket-04 §2) through the real command from game.contract.json.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

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
