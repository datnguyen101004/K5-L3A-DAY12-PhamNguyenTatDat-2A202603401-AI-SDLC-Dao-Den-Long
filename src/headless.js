#!/usr/bin/env node
// Headless runner, Test Contract v1.0.
// node src/headless.js --seed N --night 1|2|3 [--scenario f] [--inputs f] --ticks N --out f.jsonl [--snapshot-every N]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Game } from './sim.js';

class UsageError extends Error {}
class FormatError extends Error {}

function fail(code, msg) {
  process.stderr.write(`error: ${msg}\n`);
  process.exit(code);
}

function parseArgs(argv) {
  const a = {};
  for (let i = 0; i < argv.length; i += 2) {
    const k = argv[i];
    if (!k.startsWith('--') || i + 1 >= argv.length) throw new UsageError(`bad argument: ${k}`);
    a[k.slice(2)] = argv[i + 1];
  }
  const int = (name, def, min) => {
    const raw = a[name];
    if (raw === undefined) {
      if (def === undefined) throw new UsageError(`missing --${name}`);
      return def;
    }
    if (!/^-?\d+$/.test(raw) || Number(raw) < min) throw new UsageError(`--${name} must be an integer >= ${min}`);
    return Number(raw);
  };
  const o = {
    seed: int('seed', 0, -Infinity),
    night: int('night', 1, 1),
    ticks: int('ticks', undefined, 0),
    every: int('snapshot-every', 10, 1),
    out: a.out,
    scenario: a.scenario,
    inputs: a.inputs,
  };
  if (!o.out) throw new UsageError('missing --out');
  if (![1, 2, 3].includes(o.night)) throw new UsageError('--night must be 1, 2 or 3');
  return o;
}

function readJson(file, what) {
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch (e) {
    throw new FormatError(`cannot read ${what} file ${file}: ${e.message}`);
  }
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new FormatError(`${what} file is not valid JSON: ${e.message}`);
  }
}

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isVec = (v, n) => Array.isArray(v) && v.length === n && v.every(isNum);

function validateScenario(s) {
  const bad = (m) => {
    throw new FormatError(`scenario: ${m}`);
  };
  if (!isObj(s)) bad('must be an object');
  if (s.player !== undefined) {
    if (!isObj(s.player)) bad('player must be an object');
    if (s.player.pos !== undefined && !isVec(s.player.pos, 3)) bad('player.pos must be [x,y,z]');
    for (const k of ['carried', 'flames', 'successful_lights', 'invuln_ticks', 'dash_cd_ticks', 'pulse_cd_ticks', 'charm_ticks']) if (s.player[k] !== undefined && !Number.isInteger(s.player[k])) bad(`player.${k} must be an integer`);
  }
  for (const k of ['random_motes', 'random_shades', 'random_drifters', 'wind_enabled']) if (s[k] !== undefined && typeof s[k] !== 'boolean') bad(`${k} must be boolean`);
  if (s.time_left_s !== undefined && !(isNum(s.time_left_s) && s.time_left_s > 0)) bad('time_left_s must be a positive number');
  const moteOk = (m) => isVec(m, 3) || (isObj(m) && isVec(m.pos, 3) && (m.kind === undefined || ['random', 'dropped'].includes(m.kind)));
  if (s.motes !== undefined && !(Array.isArray(s.motes) && s.motes.every(moteOk))) bad('motes must be an array of [x,y,z] or {pos,kind,ttl_ticks}');
  if (s.shades !== undefined) {
    if (!Array.isArray(s.shades)) bad('shades must be an array');
    for (const sh of s.shades) {
      if (!isObj(sh) || !isVec(sh.pos, 3)) bad('each shade needs pos [x,y,z]');
      if (sh.id !== undefined && typeof sh.id !== 'string') bad('shade id must be a string');
    }
  }
  const STATES = ['spawning', 'wander', 'chase', 'recoil', 'stunned', 'drain'];
  for (const sh of s.shades || []) {
    if (sh.state !== undefined && !STATES.includes(sh.state)) bad(`shade state must be one of ${STATES.join(', ')}`);
    if (sh.target_lantern_id !== undefined && typeof sh.target_lantern_id !== 'string') bad('target_lantern_id must be a string');
    if (sh.state_ticks_left !== undefined && !Number.isInteger(sh.state_ticks_left)) bad('state_ticks_left must be an integer');
  }
  if (s.drifters !== undefined) {
    if (!Array.isArray(s.drifters)) bad('drifters must be an array');
    for (const d of s.drifters) {
      if (!isObj(d) || !isVec(d.pos, 3)) bad('each drifter needs pos [x,y,z]');
      if (d.state !== undefined && !['idle', 'chase', 'flee'].includes(d.state)) bad('drifter state must be idle, chase or flee');
      if (d.stolen !== undefined && !Number.isInteger(d.stolen)) bad('drifter stolen must be an integer');
    }
  }
  if (s.charms !== undefined) {
    if (!Array.isArray(s.charms)) bad('charms must be an array');
    for (const c of s.charms) {
      if (!isObj(c) || typeof c.id !== 'string' || !isVec(c.pos, 3)) bad('each charm needs a string id and pos [x,y,z]');
      if (c.available !== undefined && typeof c.available !== 'boolean') bad('charm available must be boolean');
    }
  }
  if (s.lanterns !== undefined) {
    if (!Array.isArray(s.lanterns)) bad('lanterns must be an array');
    for (const l of s.lanterns) {
      if (!isObj(l) || typeof l.id !== 'string') bad('each lantern needs a string id');
      if (l.pos !== undefined && !isVec(l.pos, 3)) bad('lantern pos must be [x,y,z]');
      if (l.lit !== undefined && typeof l.lit !== 'boolean') bad('lantern lit must be boolean');
      if (l.deposited !== undefined && !Number.isInteger(l.deposited)) bad('lantern deposited must be an integer');
      if (l.fuel !== undefined && !(isNum(l.fuel) && l.fuel >= 0)) bad('lantern fuel must be a number >= 0');
      if (l.ever_lit !== undefined && typeof l.ever_lit !== 'boolean') bad('lantern ever_lit must be boolean');
    }
  }
  return s;
}

function validateInputs(inp) {
  const bad = (m) => {
    throw new FormatError(`inputs: ${m}`);
  };
  if (!isObj(inp) || !Array.isArray(inp.frames)) bad('must be an object with a frames array');
  let last = -1;
  for (const f of inp.frames) {
    if (!isObj(f) || !Number.isInteger(f.tick) || f.tick < 0) bad('each frame needs an integer tick >= 0');
    if (f.tick <= last) bad('frame ticks must be strictly increasing');
    last = f.tick;
    if (f.move !== undefined && !(isVec(f.move, 2) && f.move.every((c) => c >= -1 && c <= 1))) bad('move must be [x,z] within [-1,1]');
    if (f.cam_yaw_deg !== undefined && !isNum(f.cam_yaw_deg)) bad('cam_yaw_deg must be a number');
    for (const k of ['jump', 'interact', 'pulse', 'dash', 'pause']) if (f[k] !== undefined && typeof f[k] !== 'boolean') bad(`${k} must be boolean`);
  }
  return inp.frames;
}

function main() {
  let o;
  let scenario = {};
  let frames = [];
  try {
    o = parseArgs(process.argv.slice(2));
    if (o.scenario) scenario = validateScenario(readJson(o.scenario, 'scenario'));
    if (o.inputs) frames = validateInputs(readJson(o.inputs, 'inputs'));
  } catch (e) {
    if (e instanceof FormatError) fail(2, e.message);
    if (e instanceof UsageError) fail(1, e.message);
    throw e;
  }

  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const contract = JSON.parse(fs.readFileSync(path.join(root, 'game.contract.json'), 'utf8'));
  const game = new Game({ seed: o.seed, night: o.night, tuning: contract.tuning, scenario });

  const lines = [];
  const snap = () => lines.push(JSON.stringify(game.snapshot()));
  snap();
  lines.push(JSON.stringify({ type: 'event', tick: 0, name: 'night_start', data: { night: o.night } }));

  const inp = { move: [0, 0], cam_yaw_deg: 0, jump: false, interact: false, pulse: false, dash: false, pause: false };
  let fi = 0;
  for (let k = 0; k < o.ticks && game.state === 'playing'; k++) {
    while (fi < frames.length && frames[fi].tick <= k) {
      const { tick, ...fields } = frames[fi++];
      Object.assign(inp, fields);
    }
    game.step(inp);
    for (const e of game.drainEvents()) lines.push(JSON.stringify(e));
    if (game.tick % o.every === 0) snap();
  }
  lines.push(JSON.stringify(game.endLine()));

  fs.mkdirSync(path.dirname(path.resolve(o.out)), { recursive: true });
  fs.writeFileSync(o.out, lines.join('\n') + '\n');
}

try {
  main();
} catch (e) {
  fail(3, e.stack || String(e));
}
