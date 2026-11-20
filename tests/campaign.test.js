import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Game } from '../src/sim.js';
import { MAPS } from '../src/maps.js';
import { Campaign } from '../src/campaign.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const T = JSON.parse(fs.readFileSync(path.join(root, 'game.contract.json'), 'utf8')).tuning;
const idle = { move: [0, 0], cam_yaw_deg: 0, jump: false, interact: false, pulse: false, dash: false, pause: false };

/** Finish a night: either win it (light the last lantern) or lose it (dawn). */
function finish(night, win) {
  const lanterns = MAPS[night].lanterns;
  const first = lanterns[0];
  const scenario = {
    random_motes: false, random_shades: false, random_drifters: false, wind_enabled: false, motes: [], shades: [], drifters: [],
    player: { pos: [...first.pos], carried: 10 },
    lanterns: lanterns.slice(1).map((l) => ({ id: l.id, lit: true })),
    time_left_s: win ? 100 : 0.5,
  };
  const g = new Game({ seed: 1, night, tuning: T, scenario });
  if (win) {
    g.step({ ...idle, interact: true });
    g.step(idle);
  } else for (let i = 0; i < 40; i++) g.step(idle);
  return g;
}

test('campaign: win -> next night, lose -> retry same night, total = sum of won nights, night 3 -> dawn', () => {
  const c = new Campaign();
  assert.equal(c.night, 1);
  const n1 = finish(1, true);
  assert.equal(n1.state, 'won');
  assert.equal(c.record(n1), 'next');
  assert.equal(c.night, 2);
  const lost = finish(2, false);
  assert.equal(lost.state, 'lost');
  assert.equal(c.record(lost), 'retry');
  assert.equal(c.night, 2);
  assert.equal(c.total, n1.score);
  const n2 = finish(2, true);
  assert.equal(c.record(n2), 'next');
  const n3 = finish(3, true);
  assert.equal(n3.state, 'won');
  assert.equal(c.record(n3), 'dawn');
  assert.equal(c.finished, true);
  assert.equal(c.total, n1.score + n2.score + n3.score);
  assert.deepEqual(c.results.map((r) => r.night), [1, 2, 3]);
  c.reset();
  assert.deepEqual([c.night, c.total, c.finished], [1, 0, false]);
});

test('campaign: refuses an unfinished night; flames refill each night', () => {
  const c = new Campaign();
  assert.throws(() => c.record(new Game({ seed: 1, night: 1, tuning: T })));
  assert.equal(new Game({ seed: 1, night: 2, tuning: T }).p.flames, 3);
});
