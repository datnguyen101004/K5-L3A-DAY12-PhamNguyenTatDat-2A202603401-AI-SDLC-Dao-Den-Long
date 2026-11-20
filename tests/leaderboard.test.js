// Leaderboard rules (Ticket-04 §3) and the disk store / export through the real server process.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { normalizeName, isoLocal, insert, rank, parseStore } from '../src/leaderboard.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const e = (name, score, at, extra = {}) => ({ name, score, nights_won: 1, achieved_at: at, seed: 1, ...extra });

test('names: 3-12 of [A-Za-z0-9_], Vietnamese letters allowed, no spaces or symbols', () => {
  for (const ok of ['Dat', 'abc', 'A_1', 'TwelveChars_', 'Mây', 'Đạt_99', 'Nguyễn']) assert.ok(normalizeName(ok), ok);
  for (const bad of ['ab', 'ThirteenChars', 'a b', 'x-y', '', '日本語名', 'abc!', 42]) assert.equal(normalizeName(bad), null, String(bad));
  // non-ASCII digits and letters that are not Vietnamese are refused (found by the independent review)
  for (const bad of ['١٢٣', 'ＡＢＣ', 'ⅠⅡⅢ', 'ªºª', 'ǅǅǅ', 'Ꜳꜳꜳ', '٣ab', 'Ñandú', 'Straße', 'Łódź']) assert.equal(normalizeName(bad), null, bad);
  for (const ok of ['Đường_Ỷ', 'Hươu99', 'ỨỪỬỮỰ']) assert.ok(normalizeName(ok), ok);
  assert.equal(normalizeName('  Mây  '), 'Mây');
  assert.equal(normalizeName('Ma\u0302\u0300y'), 'Mầy'); // decomposed input is stored as NFC
});

test('achieved_at is ISO 8601 with an offset', () => {
  assert.match(isoLocal(new Date()), /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/);
  assert.equal(Date.parse(isoLocal(new Date(1700000000000))), 1700000000000);
});

test('ranking: score desc, ties: earlier first, top 10 only, position reported', () => {
  let board = [];
  board = insert(board, e('Bob', 500, '2026-11-20T10:00:00+07:00')).entries;
  board = insert(board, e('Ann', 500, '2026-11-20T09:00:00+07:00')).entries; // same score, earlier
  board = insert(board, e('Cid', 900, '2026-11-20T11:00:00+07:00')).entries;
  assert.deepEqual(board.map((x) => x.name), ['Cid', 'Ann', 'Bob']);
  // same instant written with different offsets compares by real time
  board = insert(board, e('Zed', 500, '2026-11-20T01:30:00Z')).entries; // 08:30 +07:00, earliest of the 500s
  assert.deepEqual(board.map((x) => x.name), ['Cid', 'Zed', 'Ann', 'Bob']);
  for (let i = 0; i < 8; i++) board = insert(board, e(`P${i}xx`, 600 + i, '2026-11-20T12:00:00+07:00')).entries;
  assert.equal(board.length, 10);
  assert.ok(!board.some((x) => x.name === 'Bob' || x.name === 'Ann'), 'lowest dropped');
  const low = insert(board, e('Low', 1, '2026-11-20T13:00:00+07:00'));
  assert.equal(low.position, null);
  const top = insert(board, e('Top', 10000, '2026-11-20T13:00:00+07:00'));
  assert.equal(top.position, 1);
});

test('entries are validated (nights_won 0-3, integer score, timezone required)', () => {
  assert.throws(() => insert([], e('Dat', 10, '2026-11-20T10:00:00')));
  assert.throws(() => insert([], e('Dat', 10, '2026-11-20T10:00:00Z', { nights_won: 4 })));
  assert.throws(() => insert([], e('Dat', 1.5, '2026-11-20T10:00:00Z')));
  assert.deepEqual(parseStore('{"entries":[{"name":"x"},' + JSON.stringify(e('Okk', 3, '2026-11-20T10:00:00Z')) + ']}').map((x) => x.name), ['Okk']);
  assert.deepEqual(parseStore('not json'), []);
  assert.deepEqual(rank([]), []);
});

test('server: POST persists to disk, survives a restart, export writes {entries} in order', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ddl-lb-'));
  const env = { ...process.env, DDL_DATA_DIR: dir, PORT: String(18000 + Math.floor(Math.random() * 1000)) };
  const start = () =>
    new Promise((resolve) => {
      const p = spawn('node', ['server.js'], { cwd: root, env });
      p.stdout.once('data', () => resolve(p));
    });
  const url = `http://localhost:${env.PORT}/api/leaderboard`;
  let srv = await start();
  const post = (body) => fetch(url, { method: 'POST', body: JSON.stringify(body) }).then(async (r) => [r.status, await r.json()]);
  const [s1, r1] = await post(e('Mây', 300, '2026-11-20T10:00:00+07:00', { nights_won: 2, seed: 42 }));
  assert.equal(s1, 200);
  assert.equal(r1.position, 1);
  await post(e('Dat', 900, '2026-11-20T10:05:00+07:00', { nights_won: 3 }));
  const [bad] = await post(e('x', 900, '2026-11-20T10:05:00+07:00'));
  assert.equal(bad, 400);
  srv.kill();
  srv = await start(); // restart: still there
  const got = await fetch(url).then((r) => r.json());
  assert.deepEqual(got.entries.map((x) => x.name), ['Dat', 'Mây']);
  srv.kill();
  const out = path.join(dir, 'out.json');
  const ex = spawnSync('node', ['server.js', '--export-leaderboard', out], { cwd: root, env, encoding: 'utf8' });
  assert.equal(ex.status, 0, ex.stderr);
  const exported = JSON.parse(fs.readFileSync(out, 'utf8'));
  assert.deepEqual(Object.keys(exported), ['entries']);
  assert.deepEqual(exported.entries[1], { name: 'Mây', score: 300, nights_won: 2, achieved_at: '2026-11-20T10:00:00+07:00', seed: 42 });
});
