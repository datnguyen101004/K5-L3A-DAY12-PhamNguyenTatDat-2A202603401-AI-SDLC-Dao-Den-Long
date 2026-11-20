// Regenerates docs/proof/phase-1/*: test report, sample runs, determinism hashes.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import crypto from 'node:crypto';

const dir = 'docs/proof/phase-1';
const sam = `${dir}/samples`;
fs.mkdirSync(sam, { recursive: true });
const sh = (args) => spawnSync('node', args, { encoding: 'utf8' });
const hash = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');

const test = spawnSync('npm', ['test'], { encoding: 'utf8', shell: true });
fs.writeFileSync(`${dir}/npm-test.txt`, test.stdout + test.stderr);

fs.writeFileSync(`${sam}/win.scenario.json`, JSON.stringify({
  player: { pos: [0, 0, 0], carried: 5, flames: 3 }, random_motes: false, random_shades: false, motes: [], shades: [],
  lanterns: ['L2', 'L3', 'L4', 'L5'].map((id) => ({ id, lit: true })).concat([{ id: 'L1', pos: [0, 0, 6] }]), time_left_s: 120,
}, null, 1));
fs.writeFileSync(`${sam}/win.inputs.json`, JSON.stringify({ frames: [{ tick: 0, move: [0, 1] }, { tick: 60, move: [0, 0], interact: true }, { tick: 61, interact: false }] }));
const w = sh(['src/headless.js', '--seed', '1', '--night', '1', '--scenario', `${sam}/win.scenario.json`, '--inputs', `${sam}/win.inputs.json`, '--ticks', '600', '--out', `${sam}/win.out.jsonl`]);

fs.writeFileSync(`${sam}/rand.inputs.json`, JSON.stringify({ frames: [{ tick: 0, move: [0.3, 1] }, { tick: 200, pulse: true }, { tick: 201, pulse: false }] }));
const a = ['src/headless.js', '--seed', '42', '--night', '1', '--inputs', `${sam}/rand.inputs.json`, '--ticks', '18000'];
sh([...a, '--out', `${sam}/rand.run1.jsonl`]);
sh([...a, '--out', `${sam}/rand.run2.jsonl`]);
const h1 = hash(`${sam}/rand.run1.jsonl`);
const h2 = hash(`${sam}/rand.run2.jsonl`);
fs.unlinkSync(`${sam}/rand.run2.jsonl`);

const last = fs.readFileSync(`${sam}/win.out.jsonl`, 'utf8').trim().split('\n').at(-1);
fs.writeFileSync(`${dir}/determinism.txt`, `seed 42, 18000 ticks, run1 sha256: ${h1}\nseed 42, 18000 ticks, run2 sha256: ${h2}\nidentical: ${h1 === h2}\n`);
console.log('npm test exit:', test.status, '| win run exit:', w.status, '| win end line:', last, '| deterministic:', h1 === h2);
