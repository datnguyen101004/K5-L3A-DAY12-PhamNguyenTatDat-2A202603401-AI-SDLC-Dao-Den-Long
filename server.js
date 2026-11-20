// Minimal static server for the browser client. `npm start` -> http://localhost:8080
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT) || 8080;
const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css' };
const allowed = ['/web/', '/src/', '/node_modules/three/', '/game.contract.json'];

http
  .createServer((req, res) => {
    let url = decodeURIComponent(req.url.split('?')[0]);
    if (url === '/') url = '/web/index.html';
    const file = path.join(root, url);
    if (!file.startsWith(root) || !allowed.some((a) => url.startsWith(a) || url === a)) {
      res.writeHead(404).end('not found');
      return;
    }
    fs.readFile(file, (err, data) => {
      if (err) return res.writeHead(404).end('not found');
      res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' }).end(data);
    });
  })
  .listen(port, () => console.log(`Dao Den Long: http://localhost:${port}`));
