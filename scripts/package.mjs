#!/usr/bin/env node
// Builds the release folder release/dao-den-long-v<version>/: everything needed to PLAY with `node server.js`
// (no npm install): web client, rules, server, contract, and only the parts of three.js the client loads.
// Benchmark/tests need the full repo (Electron is a dev dependency) and are not in the bundle.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const version = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
const out = path.join(root, 'release', `dao-den-long-v${version}`);
fs.rmSync(out, { recursive: true, force: true });

const copy = (rel) => fs.cpSync(path.join(root, rel), path.join(out, rel), { recursive: true });
for (const rel of ['web', 'src', 'server.js', 'game.contract.json', 'LICENSE', 'CREDITS.md', 'CHANGELOG.md', 'README.md', 'node_modules/three/build/three.module.js', 'node_modules/three/build/three.core.js', 'node_modules/three/package.json', 'node_modules/three/LICENSE']) {
  if (fs.existsSync(path.join(root, rel))) copy(rel);
}
// three.js addons used by web/world.js (post-processing) and what they import
for (const rel of ['postprocessing', 'shaders']) copy(`node_modules/three/examples/jsm/${rel}`);
fs.writeFileSync(path.join(out, 'package.json'), JSON.stringify({ name: 'dao-den-long', version, private: true, type: 'module', scripts: { start: 'node server.js' } }, null, 2) + '\n');
fs.writeFileSync(
  path.join(out, 'CHAY-GAME.txt'),
  `Đảo Đèn Lồng v${version}

Cần Node.js >= 20 và trình duyệt có WebGL2.
1. Giải nén thư mục này.
2. Mở terminal trong thư mục, chạy:   node server.js
3. Mở trình duyệt: http://localhost:8081   (đổi cổng: PORT=9000 node server.js)

Bảng xếp hạng lưu ở data/leaderboard.json trong thư mục này.
Xuất bảng xếp hạng: node server.js --export-leaderboard out.json
Benchmark, soak và test cần mã nguồn đầy đủ: xem README.md.
`,
);
const size = (p) => (fs.statSync(p).isDirectory() ? fs.readdirSync(p).reduce((s, f) => s + size(path.join(p, f)), 0) : fs.statSync(p).size);
console.log(`${out} (${(size(out) / 1048576).toFixed(1)} MB)`);
