// Static server for the browser client + the local leaderboard store.
//   node server.js                                   -> http://localhost:8081 (PORT overrides)
//   node server.js --export-leaderboard out.json     -> writes {"entries": [...]} in rank order and exits
// The leaderboard lives in data/leaderboard.json (DDL_DATA_DIR overrides), so it survives restarts.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { insert, parseStore } from './src/leaderboard.js';

const root = path.dirname(fileURLToPath(import.meta.url));
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml' };
const allowed = ['/web/', '/src/', '/node_modules/three/', '/game.contract.json'];

export const storeFile = () => path.join(process.env.DDL_DATA_DIR || path.join(root, 'data'), 'leaderboard.json');

export function readBoard() {
  try {
    return parseStore(fs.readFileSync(storeFile(), 'utf8'));
  } catch {
    return [];
  }
}

function writeBoard(entries) {
  const file = storeFile();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify({ entries }, null, 2) + '\n');
  fs.renameSync(tmp, file); // atomic replace: a crash never leaves half a file
}

function json(res, code, body) {
  res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }).end(JSON.stringify(body));
}

function api(req, res) {
  if (req.method === 'GET') return json(res, 200, { entries: readBoard() });
  if (req.method !== 'POST') return json(res, 405, { error: 'method not allowed' });
  let body = '';
  req.on('data', (c) => {
    body += c;
    if (body.length > 4096) req.destroy();
  });
  req.on('end', () => {
    try {
      const { entries, position } = insert(readBoard(), JSON.parse(body));
      writeBoard(entries);
      json(res, 200, { entries, position });
    } catch (e) {
      json(res, 400, { error: e.message });
    }
  });
}

export function createServer() {
  return http.createServer((req, res) => {
    let url;
    try {
      url = decodeURIComponent(req.url.split('?')[0]);
    } catch {
      return res.writeHead(400).end('bad request');
    }
    if (url === '/api/leaderboard') return api(req, res);
    if (url === '/') url = '/web/index.html';
    const file = path.join(root, url);
    if (!file.startsWith(root) || !allowed.some((a) => url.startsWith(a) || url === a)) return res.writeHead(404).end('not found');
    fs.readFile(file, (err, data) => {
      if (err) return res.writeHead(404).end('not found');
      res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' }).end(data);
    });
  });
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const i = process.argv.indexOf('--export-leaderboard');
  if (i >= 0) {
    const out = process.argv[i + 1];
    if (!out) {
      process.stderr.write('error: --export-leaderboard needs an output file\n');
      process.exit(1);
    }
    fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
    fs.writeFileSync(out, JSON.stringify({ entries: readBoard() }, null, 2) + '\n');
    console.log(`exported ${readBoard().length} entries to ${out}`);
  } else {
    const port = Number(process.env.PORT) || 8081;
    createServer().listen(port, () => console.log(`Dao Den Long: http://localhost:${port}`));
  }
}
