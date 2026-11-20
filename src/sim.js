// Pure game logic (Test Contract v1.1). No DOM, no Node APIs: shared by headless CLI and browser.
// Tick order follows Ticket-02 "Thứ tự xử lý trong một tick"; stages are marked S1..S11.
import { MAPS } from './maps.js';

export const TICK_RATE = 60;
const STEP = 0.5; // max step-up / landing tolerance
const FALL_Y = -10;
const GRAVITY = 20;
const JUMP_V = 7;
const SPAWNING_TICKS = 30;
const RECOIL_TICKS = 60;
const RECOIL_M = 2;
const PUSH_TICKS = 15;
const EXPEL_TICKS = 30;
const MOTE_TARGET_START = 20;
const MOTE_CAP = 30;
const MOTE_PERIOD = 240;
const DROPPED_TTL = 480;
const CHARM_TICKS = 600;
const CHARM_RESPAWN = 2700;
const CHARM_SPEED = 7.2;
const DRIFTER_MAX = 2;
const DRIFTER_PERIOD = 1200;
const WIND_PERIOD = 1800;
const WIND_TICKS = 300;
const WIND_WARN = 120;
const WIND_SPEED = 2;

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const r3 = (v) => {
  const x = Math.round(v * 1000) / 1000;
  return x === 0 ? 0 : x;
};
const pos3 = (p) => [r3(p[0]), r3(p[1]), r3(p[2])];
const distXZ = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const ticks = (s) => Math.round(s * TICK_RATE);
const idNum = (id) => Number(String(id).replace(/\D/g, '')) || 0;
const byId = (a, b) => idNum(a.id) - idNum(b.id) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

export class Game {
  /** @param {{seed?:number, night?:number, tuning:object, scenario?:object}} o */
  constructor({ seed = 0, night = 1, tuning, scenario = {} }) {
    this.t = tuning;
    this.night = night;
    this.map = MAPS[night];
    this.rng = mulberry32(seed);
    this.tick = 0;
    this.simTick = 0;
    this.state = 'playing';
    this.paused = false;
    this.score = 0;
    this.events = [];
    this.prev = { jump: false, interact: false, pulse: false, dash: false, pause: false };
    this.randomMotes = scenario.random_motes !== false;
    this.randomShades = scenario.random_shades !== false;
    this.randomDrifters = scenario.random_drifters !== false && this.map.drifters;
    this.windEnabled = scenario.wind_enabled !== false && this.map.wind;
    this.moteSeq = 0;
    this.shadeSeq = 0;
    this.drifterSeq = 0;
    this.pulseFx = -1e9; // render-only
    this.wind = { active: false, warning: false, dir_deg: 0 };
    this.windDir = 0;
    this.speedShade = night === 3 && tuning.shade_speed_night3 ? tuning.shade_speed_night3 : tuning.shade_speed;

    const sp = scenario.player || {};
    const start = sp.pos ? [...sp.pos] : [...this.map.start];
    this.p = {
      pos: start,
      vel: [0, 0, 0],
      facing: [0, 1],
      grounded: false,
      flames: sp.flames ?? tuning.flames,
      carried: sp.carried ?? 0,
      invuln: sp.invuln_ticks ?? 0,
      dashT: 0,
      dashDir: [0, 1],
      dashCd: sp.dash_cd_ticks ?? 0,
      pulseCd: sp.pulse_cd_ticks ?? 0,
      charm: sp.charm_ticks ?? 0,
      launch: null,
      wait: 0,
      dead: false,
      respawnNow: false,
    };
    this.p.grounded = this.p.pos[1] <= this.groundAt(start[0], start[2], start[1]) + 1e-9;
    this.duration = scenario.time_left_s ?? tuning[`night${night}_duration_s`];

    this.lanterns = this.map.lanterns.map((l) => ({ id: l.id, pos: [...l.pos], lit: false, deposited: 0 }));
    for (const u of scenario.lanterns || []) {
      let l = this.lanterns.find((x) => x.id === u.id);
      if (!l) {
        l = { id: u.id, pos: [0, 0, 0], lit: false, deposited: 0 };
        this.lanterns.push(l);
      }
      if (u.pos) l.pos = [...u.pos];
      if (u.deposited !== undefined) l.deposited = u.deposited;
      if (u.lit !== undefined) l.lit = u.lit;
      if (l.lit) l.deposited = Math.max(l.deposited, tuning.lantern_cost);
      else if (l.deposited >= tuning.lantern_cost) l.lit = true;
    }

    this.motes = [];
    if (scenario.motes) {
      for (const m of scenario.motes) {
        const o = Array.isArray(m) ? { pos: m } : m;
        const kind = o.kind ?? 'random';
        this.motes.push({
          id: `M${++this.moteSeq}`,
          pos: [...o.pos],
          kind,
          ttl: o.ttl_ticks ?? (o.ttl_s !== undefined ? ticks(o.ttl_s) : kind === 'dropped' ? DROPPED_TTL : null),
          pt: -1,
        });
      }
    } else if (this.randomMotes) {
      const idx = this.map.motePts.map((_, i) => i);
      for (let i = idx.length - 1; i > 0; i--) {
        const j = Math.floor(this.rng() * (i + 1));
        [idx[i], idx[j]] = [idx[j], idx[i]];
      }
      for (const i of idx.slice(0, MOTE_TARGET_START)) this.spawnMoteAt(i);
    }

    this.shades = [];
    const used = new Set((scenario.shades || []).map((s) => s.id).filter(Boolean));
    this.nextShadeId = () => {
      let id;
      do id = `S${++this.shadeSeq}`;
      while (used.has(id));
      used.add(id);
      return id;
    };
    for (const s of scenario.shades || []) {
      const state = s.state ?? 'wander';
      const dflt = { stunned: ticks(tuning.pulse_stun_s), recoil: RECOIL_TICKS, spawning: SPAWNING_TICKS }[state] ?? 0;
      this.shades.push({
        id: s.id ?? this.nextShadeId(),
        pos: [s.pos[0], s.pos[1], s.pos[2]],
        state,
        ticks: s.state_ticks_left ?? dflt,
        pushLeft: 0,
        pushDir: [1, 0],
        expel: 0,
        wanderDir: [1, 0],
        wanderT: 0,
      });
    }

    this.drifters = [];
    this.drifterUsed = new Set((scenario.drifters || []).map((d) => d.id).filter(Boolean));
    for (const d of scenario.drifters || []) {
      this.drifters.push({
        id: d.id ?? this.nextDrifterId(),
        pos: [...d.pos],
        state: d.state ?? 'idle',
        stolen: d.stolen ?? 0,
        hasStolen: (d.stolen ?? 0) > 0,
        ticks: d.state_ticks_left ?? 0,
        wanderDir: [1, 0],
        wanderT: 0,
      });
    }

    this.charms = (scenario.charms ?? this.map.charms).map((c) => ({
      id: c.id,
      pos: [...c.pos],
      available: c.available !== false,
      respawn: c.respawn_ticks ?? 0,
    }));
  }

  nextDrifterId() {
    let id;
    do id = `D${++this.drifterSeq}`;
    while (this.drifterUsed.has(id));
    this.drifterUsed.add(id);
    return id;
  }

  // ---------- terrain ----------
  maxTop(x, z) {
    const t = this.map.topsAt(x, z);
    return t.length ? Math.max(...t) : -Infinity;
  }
  /** Highest surface at (x,z) not above y + STEP, or -Infinity. */
  groundAt(x, z, y) {
    let g = -Infinity;
    for (const h of this.map.topsAt(x, z)) if (h <= y + STEP && h > g) g = h;
    return g;
  }

  emit(name, data) {
    this.events.push({ type: 'event', tick: this.tick, name, data });
  }

  get timeLeft() {
    return this.duration - this.simTick / TICK_RATE;
  }

  get publicState() {
    return this.paused && this.state === 'playing' ? 'paused' : this.state;
  }

  spawnMoteAt(i) {
    this.motes.push({ id: `M${++this.moteSeq}`, pos: [...this.map.motePts[i]], kind: 'random', ttl: null, pt: i });
  }

  pushMote(x, y, z, kind, ttl) {
    this.motes.push({ id: `M${++this.moteSeq}`, pos: [x, y, z], kind, ttl, pt: -1 });
  }

  // ---------- main step ----------
  /** @param {{move:number[], cam_yaw_deg:number, jump:boolean, interact:boolean, pulse:boolean, dash:boolean, pause:boolean}} inp */
  step(inp) {
    if (this.state !== 'playing') return;
    const t = this.t;
    const p = this.p;
    this.tick++;
    const e = {
      jump: inp.jump && !this.prev.jump,
      interact: inp.interact && !this.prev.interact,
      pulse: inp.pulse && !this.prev.pulse,
      dash: !!inp.dash && !this.prev.dash,
      pause: !!inp.pause && !this.prev.pause,
    };
    this.prev = { jump: inp.jump, interact: inp.interact, pulse: inp.pulse, dash: !!inp.dash, pause: !!inp.pause };

    // S1: pause
    if (e.pause) {
      if (!this.paused) {
        this.paused = true;
        this.emit('paused', {});
        return;
      }
      this.paused = false;
      this.emit('resumed', {});
    }
    if (this.paused) return;
    this.simTick++;

    // S2: counters
    if (p.invuln > 0) p.invuln--;
    if (p.pulseCd > 0) p.pulseCd--;
    if (p.dashCd > 0) p.dashCd--;
    if (p.dashT > 0) p.dashT--;
    if (p.charm > 0) p.charm--;
    if (p.wait > 0 && --p.wait === 0) p.respawnNow = true;
    for (const s of this.shades) if (s.ticks > 0 && (s.state === 'stunned' || s.state === 'spawning')) s.ticks--;
    for (const d of this.drifters) if (d.state === 'flee' && d.ticks > 0) d.ticks--;
    for (const c of this.charms) if (!c.available && c.respawn > 0 && --c.respawn === 0) c.available = true;
    for (let i = this.motes.length - 1; i >= 0; i--) {
      const m = this.motes[i];
      if (m.ttl !== null && --m.ttl <= 0) this.motes.splice(i, 1);
    }
    this.updateWind();

    // S3: player movement + fall
    this.movePlayer(inp, e);
    // S4: pickups
    this.pickup();
    // S5: lantern interaction
    if (e.interact) this.interact();
    // S6: safe zones
    this.updateSafeZones();
    // S7: pulse
    if (e.pulse) this.pulse();
    // S8: shades and drifters move
    this.moveShades();
    this.moveDrifters();
    // S9: contact
    this.contact();
    // S10: scheduled spawns
    this.spawns();
    // S11: win / loss
    if (p.flames <= 0) this.finish('lost', 'no_flames');
    else if (this.lanterns.every((l) => l.lit)) this.finish('won', 'all_lit');
    else if (this.timeLeft <= 1e-9) this.finish('lost', 'dawn');
  }

  finish(result, reason) {
    this.state = result;
    this.emit('game_over', { result, reason });
    if (result === 'won') {
      const s = this.t.score;
      this.score += s.per_second_left * Math.floor(Math.max(0, this.timeLeft) + 1e-9) + s.per_flame_left * this.p.flames;
    }
  }

  // ---------- wind (night 3) ----------
  updateWind() {
    if (!this.windEnabled) return;
    const c = Math.floor(this.simTick / WIND_PERIOD);
    const next = (c + 1) * WIND_PERIOD;
    if (this.simTick === next - WIND_WARN) this.windDir = Math.floor(this.rng() * 360);
    this.wind = {
      active: c >= 1 && this.simTick - c * WIND_PERIOD < WIND_TICKS,
      warning: this.simTick >= next - WIND_WARN,
      dir_deg: this.windDir,
    };
  }

  // ---------- S3 ----------
  movePlayer(inp, e) {
    const p = this.p;
    const t = this.t;
    if (p.dead) return;
    if (p.respawnNow) {
      p.respawnNow = false;
      p.pos = [...this.map.start];
      p.vel = [0, 0, 0];
      p.launch = null;
      p.dashT = 0;
      p.grounded = true;
      p.invuln = ticks(t.invuln_s);
      return;
    }
    if (p.wait > 0) return;

    let [mx, mz] = inp.move;
    const len = Math.hypot(mx, mz);
    if (len > 1) {
      mx /= len;
      mz /= len;
    }
    const th = (inp.cam_yaw_deg * Math.PI) / 180;
    const dx = mx * Math.cos(th) + mz * Math.sin(th);
    const dz = -mx * Math.sin(th) + mz * Math.cos(th);
    const mlen = Math.hypot(dx, dz);
    if (mlen > 1e-9) p.facing = [dx / mlen, dz / mlen];

    // launch pads
    if (!p.launch) {
      for (const pad of this.map.pads) {
        if (Math.hypot(p.pos[0] - pad.pos[0], p.pos[2] - pad.pos[2]) <= 1 && Math.abs(p.pos[1] - pad.pos[1]) <= STEP) {
          let ux = pad.dir ? pad.dir[0] : pad.to[0] - p.pos[0];
          let uz = pad.dir ? pad.dir[1] : pad.to[1] - p.pos[2];
          const ul = Math.hypot(ux, uz);
          ux /= ul;
          uz /= ul;
          p.launch = [ux * pad.h, uz * pad.h];
          p.vel[1] = pad.vy;
          p.grounded = false;
          break;
        }
      }
    }

    // dash
    if (e.dash && p.dashT === 0 && (p.dashCd === 0 || p.charm > 0)) {
      p.dashT = ticks(t.dash_duration_s);
      p.dashDir = mlen > 1e-9 ? [dx / mlen, dz / mlen] : [...p.facing];
      if (!(p.charm > 0)) p.dashCd = ticks(t.dash_cooldown_s);
      this.emit('dash', {});
    }
    const dashing = p.dashT > 0;

    let hx;
    let hz;
    if (dashing) {
      hx = p.dashDir[0] * t.dash_speed;
      hz = p.dashDir[1] * t.dash_speed;
    } else if (p.launch) {
      [hx, hz] = p.launch;
    } else {
      const sp = p.charm > 0 ? CHARM_SPEED : t.player_speed;
      hx = dx * sp;
      hz = dz * sp;
    }

    // vertical input
    if (!dashing) {
      if (e.jump && p.grounded) {
        p.vel[1] = t.jump_speed;
        p.grounded = false;
      }
      if (!p.grounded) p.vel[1] -= t.gravity / TICK_RATE;
    }

    // horizontal move (+ wind), blocked by walls
    const w = this.wind.active ? [Math.cos((this.wind.dir_deg * Math.PI) / 180), Math.sin((this.wind.dir_deg * Math.PI) / 180)] : [0, 0];
    const mvx = (hx + w[0] * WIND_SPEED) / TICK_RATE;
    const mvz = (hz + w[1] * WIND_SPEED) / TICK_RATE;
    const oldY = p.pos[1];
    const ok = (x, z) => this.maxTop(x, z) <= oldY + STEP;
    const nx = p.pos[0] + mvx;
    const nz = p.pos[2] + mvz;
    if (ok(nx, nz)) {
      p.pos[0] = nx;
      p.pos[2] = nz;
    } else if (ok(nx, p.pos[2])) {
      p.pos[0] = nx;
      if (p.launch) p.launch[1] = 0;
    } else if (ok(p.pos[0], nz)) {
      p.pos[2] = nz;
      if (p.launch) p.launch[0] = 0;
    } else if (p.launch) p.launch = [0, 0];

    // vertical move / landing
    if (dashing && !p.grounded) {
      p.vel[1] = 0;
    } else if (!p.grounded) {
      const ny = oldY + p.vel[1] / TICK_RATE;
      const g = this.groundAt(p.pos[0], p.pos[2], oldY);
      if (p.vel[1] <= 0 && ny <= g) {
        p.pos[1] = g;
        p.vel[1] = 0;
        p.grounded = true;
        p.launch = null;
      } else p.pos[1] = ny;
    } else {
      const g = this.groundAt(p.pos[0], p.pos[2], oldY);
      if (g >= oldY - STEP) p.pos[1] = g;
      else {
        p.grounded = false;
        p.vel[1] = 0;
      }
    }
    p.vel[0] = hx;
    p.vel[2] = hz;

    // fall
    if (p.pos[1] < FALL_Y) {
      const lost = p.carried;
      p.flames--;
      p.carried = 0;
      this.emit('player_hit', { by: 'fall', flames: p.flames, dropped: 0, lost });
      p.vel = [0, 0, 0];
      p.launch = null;
      p.dashT = 0;
      if (p.flames <= 0) p.dead = true;
      else p.wait = 60;
    }
  }

  // ---------- S4 ----------
  get active() {
    return !this.p.dead && this.p.wait === 0 && !this.p.respawnNow;
  }

  canReach(pos) {
    const p = this.p;
    return distXZ(p.pos, pos) <= this.t.pickup_radius + 1e-9 && Math.abs(p.pos[1] - pos[1]) <= 1.5;
  }

  pickup() {
    if (!this.active) return;
    const p = this.p;
    for (let i = 0; i < this.motes.length && p.carried < this.t.carry_capacity; ) {
      if (this.canReach(this.motes[i].pos)) {
        this.motes.splice(i, 1);
        p.carried++;
        this.emit('mote_picked', { carried: p.carried });
      } else i++;
    }
    for (const c of [...this.charms].sort(byId)) {
      if (c.available && this.canReach(c.pos)) {
        c.available = false;
        c.respawn = CHARM_RESPAWN;
        p.charm = CHARM_TICKS;
        this.emit('charm_picked', { charm_id: c.id, charm_ticks: p.charm });
      }
    }
  }

  // ---------- S5 ----------
  interact() {
    if (!this.active) return;
    const p = this.p;
    const t = this.t;
    let best = null;
    let bd = Infinity;
    for (const l of [...this.lanterns].sort(byId)) {
      if (l.lit) continue;
      const d = distXZ(p.pos, l.pos);
      if (d <= t.interact_radius + 1e-9 && d < bd - 1e-9) {
        best = l;
        bd = d;
      }
    }
    if (!best) return;
    const amount = Math.min(p.carried, t.lantern_cost - best.deposited);
    if (amount <= 0) return;
    p.carried -= amount;
    best.deposited += amount;
    this.score += t.score.per_mote * amount;
    this.emit('deposit', { lantern_id: best.id, amount, deposited: best.deposited });
    if (best.deposited >= t.lantern_cost) {
      best.lit = true;
      this.score += t.score.per_lantern;
      this.emit('lantern_lit', { lantern_id: best.id });
    }
  }

  shadeGround(s) {
    const g = this.groundAt(s.pos[0], s.pos[2], s.pos[1]);
    return Number.isFinite(g) ? g : s.pos[1] - 1;
  }

  // ---------- shade terrain helpers ----------
  /** Move a shade by (dx,dz) if the terrain allows; returns true if moved at all. */
  shadeStep(s, dx, dz) {
    const g0 = this.shadeGround(s);
    const ok = (x, z) => this.maxTop(x, z) <= g0 + STEP && this.groundAt(x, z, g0) >= g0 - STEP;
    const nx = s.pos[0] + dx;
    const nz = s.pos[2] + dz;
    let x = s.pos[0];
    let z = s.pos[2];
    if (ok(nx, nz)) {
      x = nx;
      z = nz;
    } else if (ok(nx, z)) x = nx;
    else if (ok(x, nz)) z = nz;
    else return false;
    s.pos[0] = x;
    s.pos[2] = z;
    s.pos[1] = this.groundAt(x, z, g0) + 1;
    return true;
  }

  // ---------- S6 ----------
  updateSafeZones() {
    const R = this.t.safe_radius;
    for (const s of this.shades) {
      let zone = null;
      let zd = Infinity;
      for (const l of this.lanterns) {
        if (!l.lit) continue;
        const d = distXZ(s.pos, l.pos);
        if (d < R - 1e-6 && d < zd) {
          zone = l;
          zd = d;
        }
      }
      if (zone && s.expel === 0) s.expel = EXPEL_TICKS;
      if (s.expel > 0) {
        if (!zone) s.expel = 0;
        else {
          const ux = zd > 1e-9 ? (s.pos[0] - zone.pos[0]) / zd : 1;
          const uz = zd > 1e-9 ? (s.pos[2] - zone.pos[2]) / zd : 0;
          const m = (R - zd) / s.expel; // reaches the edge by the last expel tick
          this.shadeStep(s, ux * m, uz * m);
          if (--s.expel === 0 && distXZ(s.pos, zone.pos) < R - 1e-9) {
            s.pos[0] = zone.pos[0] + ux * R;
            s.pos[2] = zone.pos[2] + uz * R;
          }
        }
      }
    }
  }

  // ---------- S7 ----------
  pulse() {
    const p = this.p;
    const t = this.t;
    if (!this.active || p.pulseCd > 0 || p.carried < t.pulse_cost) return;
    p.carried -= t.pulse_cost;
    p.pulseCd = ticks(t.pulse_cooldown_s);
    this.pulseFx = this.simTick;
    const c = [p.pos[0], p.pos[1] + 0.8, p.pos[2]];
    const ids = [];
    for (const s of this.shades) {
      if (Math.hypot(s.pos[0] - c[0], s.pos[1] - c[1], s.pos[2] - c[2]) > t.pulse_radius + 1e-9) continue;
      ids.push(s.id);
      s.state = 'stunned';
      s.ticks = ticks(t.pulse_stun_s);
      s.pushLeft = PUSH_TICKS;
      const hx = s.pos[0] - c[0];
      const hz = s.pos[2] - c[2];
      const hl = Math.hypot(hx, hz);
      s.pushDir = hl > 1e-9 ? [hx / hl, hz / hl] : [1, 0];
      this.score += t.score.per_stun;
    }
    for (const d of this.drifters) {
      if (Math.hypot(d.pos[0] - c[0], d.pos[1] - c[1], d.pos[2] - c[2]) > t.pulse_radius + 1e-9) continue;
      if (d.state === 'chase') {
        d.state = 'flee';
        d.ticks = 240;
      } else if (d.state === 'flee' && d.stolen > 0) {
        const g = this.groundAt(d.pos[0], d.pos[2], d.pos[1]);
        const y = Number.isFinite(g) ? g : d.pos[1] - 1.5;
        const amount = d.stolen;
        for (let i = 0; i < amount; i++) this.pushMote(d.pos[0], y, d.pos[2], 'dropped', DROPPED_TTL);
        d.stolen = 0;
        d.ticks = Math.min(d.ticks, 120);
        this.emit('drifter_drop', { drifter_id: d.id, amount });
      }
    }
    this.emit('pulse', { stunned_ids: ids });
  }

  // ---------- S8 ----------
  wander(o, speed) {
    if (o.wanderT <= 0) {
      const a = this.rng() * 2 * Math.PI;
      o.wanderDir = [Math.cos(a), Math.sin(a)];
      o.wanderT = 120;
    }
    o.wanderT--;
    return [o.wanderDir[0] * speed, o.wanderDir[1] * speed];
  }

  moveShades() {
    const p = this.p;
    const t = this.t;
    for (const s of this.shades) {
      if (s.state === 'spawning') {
        if (s.ticks === 0) s.state = 'wander';
        else continue;
      }
      if (s.state === 'stunned') {
        if (s.pushLeft > 0) {
          this.shadeStep(s, (s.pushDir[0] * t.pulse_push_m) / PUSH_TICKS, (s.pushDir[1] * t.pulse_push_m) / PUSH_TICKS);
          s.pushLeft--;
        }
        if (s.ticks > 0) continue;
        s.state = 'wander';
      }
      if (s.expel > 0) continue;
      const d = distXZ(p.pos, s.pos);
      if (s.state === 'recoil') {
        if (s.ticks > 0) {
          if (d > 1e-9) this.shadeStep(s, ((s.pos[0] - p.pos[0]) / d) * (RECOIL_M / RECOIL_TICKS), ((s.pos[2] - p.pos[2]) / d) * (RECOIL_M / RECOIL_TICKS));
          s.ticks--;
          continue;
        }
        s.state = 'wander';
      }
      if (s.state === 'wander' && d <= 12) s.state = 'chase';
      else if (s.state === 'chase' && d > 18) s.state = 'wander';
      const sp = this.speedShade / TICK_RATE;
      if (s.state === 'chase') {
        if (d > 1e-9) {
          const m = Math.min(d, sp);
          this.shadeStep(s, ((p.pos[0] - s.pos[0]) / d) * m, ((p.pos[2] - s.pos[2]) / d) * m);
        }
      } else {
        const [wx, wz] = this.wander(s, this.speedShade / 2);
        if (!this.shadeStep(s, wx / TICK_RATE, wz / TICK_RATE)) s.wanderT = 0;
      }
      // never end a move inside a lit lantern's zone unless being expelled (handled in S6)
      for (const l of this.lanterns) {
        if (!l.lit) continue;
        const ld = distXZ(s.pos, l.pos);
        if (ld < t.safe_radius - 1e-9 && s.expel === 0) {
          const ux = ld > 1e-9 ? (s.pos[0] - l.pos[0]) / ld : 1;
          const uz = ld > 1e-9 ? (s.pos[2] - l.pos[2]) / ld : 0;
          s.pos[0] = l.pos[0] + ux * t.safe_radius;
          s.pos[2] = l.pos[2] + uz * t.safe_radius;
        }
      }
    }
  }

  moveDrifters() {
    const p = this.p;
    for (let i = this.drifters.length - 1; i >= 0; i--) {
      const d = this.drifters[i];
      if (d.state === 'flee' && d.ticks === 0) {
        this.drifters.splice(i, 1);
        continue;
      }
      const dist = distXZ(p.pos, d.pos);
      if (d.state !== 'flee') d.state = p.carried >= 5 && dist <= 15 ? 'chase' : 'idle';
      let vx;
      let vz;
      if (d.state === 'chase') {
        const m = dist > 1e-9 ? 7 / dist : 0;
        vx = (p.pos[0] - d.pos[0]) * m;
        vz = (p.pos[2] - d.pos[2]) * m;
      } else if (d.state === 'flee') {
        const m = dist > 1e-9 ? 7 / dist : 0;
        vx = dist > 1e-9 ? (d.pos[0] - p.pos[0]) * m : 7;
        vz = dist > 1e-9 ? (d.pos[2] - p.pos[2]) * m : 0;
      } else [vx, vz] = this.wander(d, 2);
      d.pos[0] += vx / TICK_RATE;
      d.pos[2] += vz / TICK_RATE;
    }
  }

  // ---------- S9 ----------
  contact() {
    const p = this.p;
    const t = this.t;
    if (!this.active) return;
    for (const d of [...this.drifters].sort(byId)) {
      if (d.state === 'flee' || d.hasStolen || distXZ(p.pos, d.pos) > 1.2 + 1e-9) continue;
      const amount = Math.min(3, p.carried);
      if (amount <= 0) continue;
      p.carried -= amount;
      d.stolen = amount;
      d.hasStolen = true;
      d.state = 'flee';
      d.ticks = 240;
      this.emit('drifter_steal', { drifter_id: d.id, amount, carried: p.carried });
    }
    for (const s of [...this.shades].sort(byId)) {
      if (s.state === 'spawning' || s.state === 'stunned' || s.state === 'recoil' || s.expel > 0) continue;
      if (distXZ(p.pos, s.pos) > t.shade_hit_radius + 1e-9 || Math.abs(p.pos[1] - this.shadeGround(s)) > 1.5) continue;
      if (p.invuln > 0) continue;
      p.flames--;
      const dropped = Math.floor(p.carried * t.hit_drop_ratio);
      p.carried -= dropped;
      for (let i = 0; i < dropped; i++) {
        const a = ((i + this.rng()) / dropped) * 2 * Math.PI;
        const r = 1.5 + this.rng();
        const x = p.pos[0] + r * Math.cos(a);
        const z = p.pos[2] + r * Math.sin(a);
        const g = this.groundAt(x, z, p.pos[1]);
        this.pushMote(x, Number.isFinite(g) ? g : p.pos[1], z, 'dropped', DROPPED_TTL);
      }
      p.invuln = ticks(t.invuln_s);
      s.state = 'recoil';
      s.ticks = RECOIL_TICKS;
      this.emit('player_hit', { by: 'shade', flames: p.flames, dropped });
      break; // at most one flame lost per tick
    }
  }

  // ---------- S10 ----------
  spawns() {
    const p = this.p;
    const m = this.map;
    if (this.randomMotes && this.simTick % MOTE_PERIOD === 0 && this.motes.length < MOTE_CAP) {
      const free = [];
      m.motePts.forEach((pt, i) => {
        if (!this.motes.some((x) => x.pt === i || (Math.abs(x.pos[0] - pt[0]) < 1e-3 && Math.abs(x.pos[2] - pt[2]) < 1e-3 && Math.abs(x.pos[1] - pt[1]) < 1e-3))) free.push(i);
      });
      if (free.length) this.spawnMoteAt(free[Math.floor(this.rng() * free.length)]);
    }
    if (this.randomShades) {
      const sh = m.shade;
      const n = this.simTick === sh.first ? 2 : this.simTick > sh.first && (this.simTick - sh.first) % sh.interval === 0 ? 1 : 0;
      for (let k = 0; k < n && this.shades.length < sh.max; k++) {
        const valid = m.shadePts.filter(
          (pt) =>
            distXZ(pt, p.pos) >= 15 &&
            !this.shades.some((s) => distXZ(s.pos, pt) < 1) &&
            !this.lanterns.some((l) => l.lit && distXZ(l.pos, pt) < this.t.safe_radius),
        );
        if (!valid.length) continue;
        const pt = valid[Math.floor(this.rng() * valid.length)];
        const id = this.nextShadeId();
        this.shades.push({
          id,
          pos: [pt[0], pt[1] + 1, pt[2]],
          state: 'spawning',
          ticks: SPAWNING_TICKS,
          pushLeft: 0,
          pushDir: [1, 0],
          expel: 0,
          wanderDir: [1, 0],
          wanderT: 0,
        });
        this.emit('shade_spawned', { id });
      }
    }
    if (this.randomDrifters && this.simTick % DRIFTER_PERIOD === 0 && this.drifters.length < DRIFTER_MAX) {
      const pt = m.shadePts[Math.floor(this.rng() * m.shadePts.length)];
      this.drifters.push({
        id: this.nextDrifterId(),
        pos: [pt[0], pt[1] + 1.5, pt[2]],
        state: 'idle',
        stolen: 0,
        hasStolen: false,
        ticks: 0,
        wanderDir: [1, 0],
        wanderT: 0,
      });
    }
  }

  // ---------- output ----------
  snapshot() {
    const p = this.p;
    return {
      type: 'snapshot',
      tick: this.tick,
      sim_tick: this.simTick,
      state: this.publicState,
      night: this.night,
      time_left_s: r3(this.timeLeft),
      score: this.score,
      wind: { active: this.wind.active, dir_deg: this.wind.dir_deg },
      player: {
        pos: pos3(p.pos),
        vel: pos3(p.vel),
        flames: p.flames,
        carried: p.carried,
        grounded: p.grounded,
        invuln: p.invuln,
        dash_cd_s: r3(p.dashCd / TICK_RATE),
        pulse_cd_s: r3(p.pulseCd / TICK_RATE),
        charm_s: r3(p.charm / TICK_RATE),
      },
      lanterns: this.lanterns.map((l) => ({ id: l.id, pos: pos3(l.pos), lit: l.lit, deposited: l.deposited })),
      shades: this.shades.map((s) => ({ id: s.id, pos: pos3(s.pos), state: s.state, state_ticks_left: s.state === 'wander' || s.state === 'chase' ? 0 : s.ticks })),
      motes_active: this.motes.length,
      motes: this.motes.map((m) => ({ id: m.id, pos: pos3(m.pos), kind: m.kind, ttl_s: m.ttl === null ? null : r3(m.ttl / TICK_RATE) })),
      drifters: this.drifters.map((d) => ({ id: d.id, pos: pos3(d.pos), state: d.state, stolen: d.stolen })),
      charms: this.charms.map((c) => ({ id: c.id, available: c.available, respawn_s: r3(c.respawn / TICK_RATE) })),
    };
  }

  endLine() {
    return { type: 'end', ticks: this.tick, state: this.state, score: this.score };
  }

  drainEvents() {
    const e = this.events;
    this.events = [];
    return e;
  }
}
