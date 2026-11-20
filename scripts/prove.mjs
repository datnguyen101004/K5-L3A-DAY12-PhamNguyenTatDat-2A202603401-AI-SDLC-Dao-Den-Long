// Regenerates docs/proof/phase-<N>/ : npm test report, sample headless runs per night, determinism hashes, full-night timings.
// Usage: node scripts/prove.mjs [phase]   (default 3). Proof must be regenerated at the commit that gets the tag.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import crypto from 'node:crypto';
import os from 'node:os';

const phase = process.argv[2] ?? '3';
const dir = `docs/proof/phase-${phase}`;
const sam = `${dir}/samples`;
fs.mkdirSync(sam, { recursive: true });
const hn = (args) => {
  const t0 = process.hrtime.bigint();
  const r = spawnSync('node', ['src/headless.js', ...args], { encoding: 'utf8' });
  return { status: r.status, stderr: r.stderr, ms: Number(process.hrtime.bigint() - t0) / 1e6 };
};
const hash = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const summary = [];

const test = spawnSync('npm', ['test'], { encoding: 'utf8', shell: true });
fs.writeFileSync(`${dir}/npm-test.txt`, test.stdout + test.stderr);
summary.push(`npm test exit ${test.status}`);

// Determinism: same seed/scenario/inputs twice per night, plus full-night timing (idle player, 21600 ticks).
const frames = [{ tick: 0, move: [0.3, 1] }, { tick: 200, pulse: true }, { tick: 201, pulse: false }, { tick: 300, dash: true }, { tick: 301, dash: false }, { tick: 500, move: [-1, 0.2], cam_yaw_deg: 40 }];
fs.writeFileSync(`${sam}/rand.inputs.json`, JSON.stringify({ frames }));
fs.writeFileSync(`${sam}/rand.scenario.json`, JSON.stringify({ player: { flames: 99, carried: 9 } }));
let det = `machine: ${os.type()} ${os.release()} ${os.arch()}, ${os.cpus()[0].model}, node ${process.version}\n`;
let perf = det;
for (const night of [1, 2, 3]) {
  const a = ['--seed', '42', '--night', String(night), '--scenario', `${sam}/rand.scenario.json`, '--inputs', `${sam}/rand.inputs.json`, '--ticks', '21600'];
  const r1 = hn([...a, '--out', `${sam}/night${night}.run1.jsonl`]);
  const r2 = hn([...a, '--out', `${sam}/night${night}.run2.jsonl`]);
  const h1 = hash(`${sam}/night${night}.run1.jsonl`);
  const h2 = hash(`${sam}/night${night}.run2.jsonl`);
  fs.unlinkSync(`${sam}/night${night}.run2.jsonl`);
  fs.unlinkSync(`${sam}/night${night}.run1.jsonl`); // too large to commit; the hashes above prove identity
  det += `night ${night} seed 42 21600 ticks: run1 ${h1}\n                              run2 ${h2}\n                              identical: ${h1 === h2}\n`;
  perf += `night ${night}: 21600 ticks in ${r1.ms.toFixed(0)} ms / ${r2.ms.toFixed(0)} ms (limit 30000 ms), exit ${r1.status}\n`;
  summary.push(`night ${night} deterministic=${h1 === h2} ${r1.ms.toFixed(0)}ms`);
}
fs.writeFileSync(`${dir}/determinism.txt`, det);
fs.writeFileSync(`${dir}/perf-headless.txt`, perf);

// Sample: survive night 3 to dawn with 5/7 lanterns lit (ceil(0.6 x 7) = 5): shows fuel decay, scoring and dawn_survived.
fs.writeFileSync(`${sam}/dawn3.scenario.json`, JSON.stringify({
  random_motes: false, random_shades: false, random_drifters: false, wind_enabled: false, motes: [], shades: [], drifters: [],
  player: { pos: [0, 6, 6], carried: 10, flames: 3 },
  lanterns: ['L2', 'L3', 'L4', 'L5', 'L6'].map((id) => ({ id, lit: true })).concat([{ id: 'L1', pos: [0, 6, 6.5] }]), time_left_s: 5,
}));
fs.writeFileSync(`${sam}/dawn3.inputs.json`, JSON.stringify({ frames: [{ tick: 30, interact: true }, { tick: 31, interact: false }] }));
const w = hn(['--seed', '1', '--night', '3', '--scenario', `${sam}/dawn3.scenario.json`, '--inputs', `${sam}/dawn3.inputs.json`, '--ticks', '600', '--out', `${sam}/dawn3.out.jsonl`]);
const last = fs.readFileSync(`${sam}/dawn3.out.jsonl`, 'utf8').trim().split('\n').at(-1);
summary.push(`dawn3 exit ${w.status} ${last}`);
console.log(summary.join('\n'));
