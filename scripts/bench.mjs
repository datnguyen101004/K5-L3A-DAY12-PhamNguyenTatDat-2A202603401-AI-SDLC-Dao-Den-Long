#!/usr/bin/env node
// Benchmark (Ticket-04 §1): node scripts/bench.mjs --seed 42 --duration 30 --out bench.json
// Opens a real 1280x720 window (Electron = Chromium + Node) on the standard scene, vsync off, and writes bench.json.
// load_ms is measured from the start of THIS process to the first frame of the scene.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const t0 = Date.now();
const here = path.dirname(fileURLToPath(import.meta.url));
let electron;
try {
  electron = createRequire(import.meta.url)('electron'); // path to the Electron binary
} catch {
  process.stderr.write('error: Electron is not installed; run `npm install` first\n');
  process.exit(1);
}
const env = { ...process.env, BENCH_T0: String(t0) };
delete env.ELECTRON_RUN_AS_NODE;
const child = spawn(electron, [path.join(here, 'bench-main.cjs'), ...process.argv.slice(2)], { stdio: 'inherit', env });
child.on('exit', (code) => process.exit(code ?? 1));
