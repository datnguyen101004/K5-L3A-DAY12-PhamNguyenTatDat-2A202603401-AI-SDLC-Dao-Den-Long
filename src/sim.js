// Pure game logic. No DOM, no Node APIs: shared by headless CLI and browser client.
export const TICK_RATE = 60;
export const ISLAND_R = 40;
const GRAVITY = 22;
const JUMP_V = 8;
const MOTE_TARGET = 24;
const MOTE_RESPAWN_TICKS = 300;
const SHADE_SPAWN_TICKS = 900;
const SHADE_MAX = 6;

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

export class Game {
  /** @param {{seed?:number, tuning:object, scenario?:object}} o */
  constructor({ seed = 0, tuning, scenario = {} }) {
    this.t = tuning;
    this.rng = mulberry32(seed);
    this.tick = 0;
    this.state = 'playing';
    this.score = 0;
    this.events = [];
    this.prev = { jump: false, interact: false, pulse: false };
    this.randomMotes = scenario.random_motes !== false;
    this.randomShades = scenario.random_shades !== false;
    this.moteSeq = 0;
    this.shadeSeq = 0;
    this.pulseFx = 0; // render-only: tick of last pulse

    const sp = scenario.player || {};
    this.player = {
      pos: [...(sp.pos || [0, 0, 0])],
      vy: 0,
      flames: sp.flames ?? tuning.flames,
      carried: sp.carried ?? 0,
      invuln: 0,
      pulseCd: 0,
    };
    this.duration = scenario.time_left_s ?? tuning.night1_duration_s;

    // Lanterns: ring of N around the island centre, L1 at (0,0,R).
    const n = tuning.lantern_count_night1;
    this.lanterns = [];
    for (let i = 0; i < n; i++) {
      const a = (i * 2 * Math.PI) / n;
      this.lanterns.push({
        id: `L${i + 1}`,
        pos: [r3(25 * Math.sin(a)), 0, r3(25 * Math.cos(a))],
        lit: false,
        deposited: 0,
      });
    }
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
      for (const m of scenario.motes) this.motes.push({ id: `M${++this.moteSeq}`, pos: [...m] });
    } else if (this.randomMotes) {
      for (let i = 0; i < MOTE_TARGET; i++) this.spawnMote();
    }

    this.shades = [];
    const used = new Set((scenario.shades || []).map((s) => s.id).filter(Boolean));
    const nextId = () => {
      let id;
      do id = `S${++this.shadeSeq}`;
      while (used.has(id));
      used.add(id);
      return id;
    };
    if (scenario.shades) {
      for (const s of scenario.shades) {
        this.shades.push({
          id: s.id ?? nextId(),
          pos: [s.pos[0], s.pos[1] ?? 1, s.pos[2]],
          stun: 0,
          state: 'chase',
        });
      }
    } else if (this.randomShades) {
      for (let i = 0; i < 2; i++) this.shades.push(this.makeShade(nextId()));
    }
    this.nextShadeId = nextId;
  }

  spawnMote() {
    const a = this.rng() * 2 * Math.PI;
    const r = Math.sqrt(this.rng()) * 35;
    this.motes.push({ id: `M${++this.moteSeq}`, pos: [r3(r * Math.sin(a)), 0, r3(r * Math.cos(a))] });
  }

  makeShade(id) {
    const a = this.rng() * 2 * Math.PI;
    const r = 30 + this.rng() * 8;
    return { id, pos: [r3(r * Math.sin(a)), 1, r3(r * Math.cos(a))], stun: 0, state: 'chase' };
  }

  emit(name, data) {
    this.events.push({ type: 'event', tick: this.tick, name, data });
  }

  get timeLeft() {
    return this.duration - this.tick / TICK_RATE;
  }

  finish(result, reason) {
    this.state = result;
    this.emit('game_over', { result, reason });
    if (result === 'won') {
      const s = this.t.score;
      this.score += s.per_second_left * Math.floor(Math.max(0, this.timeLeft)) + s.per_flame_left * this.player.flames;
    }
  }

  /** @param {{move:number[], cam_yaw_deg:number, jump:boolean, interact:boolean, pulse:boolean}} inp */
  step(inp) {
    if (this.state !== 'playing') return;
    const t = this.t;
    const p = this.player;
    this.tick++;
    if (p.invuln > 0) p.invuln--;
    if (p.pulseCd > 0) p.pulseCd--;
    for (const s of this.shades) if (s.stun > 0) s.stun--;

    const jumpEdge = inp.jump && !this.prev.jump;
    const interactEdge = inp.interact && !this.prev.interact;
    const pulseEdge = inp.pulse && !this.prev.pulse;
    this.prev = { jump: inp.jump, interact: inp.interact, pulse: inp.pulse };

    // movement
    let [mx, mz] = inp.move;
    const len = Math.hypot(mx, mz);
    if (len > 1) {
      mx /= len;
      mz /= len;
    }
    const th = (inp.cam_yaw_deg * Math.PI) / 180;
    const dx = mx * Math.cos(th) + mz * Math.sin(th);
    const dz = -mx * Math.sin(th) + mz * Math.cos(th);
    p.pos[0] += (dx * t.player_speed) / TICK_RATE;
    p.pos[2] += (dz * t.player_speed) / TICK_RATE;
    const pr = Math.hypot(p.pos[0], p.pos[2]);
    if (pr > ISLAND_R) {
      p.pos[0] *= ISLAND_R / pr;
      p.pos[2] *= ISLAND_R / pr;
    }
    if (jumpEdge && p.pos[1] === 0 && p.vy === 0) p.vy = JUMP_V;
    if (p.pos[1] > 0 || p.vy > 0) {
      p.vy -= GRAVITY / TICK_RATE;
      p.pos[1] += p.vy / TICK_RATE;
      if (p.pos[1] <= 0) {
        p.pos[1] = 0;
        p.vy = 0;
      }
    }

    // deposit
    if (interactEdge && p.carried > 0) {
      let best = null;
      let bd = Infinity;
      for (const l of this.lanterns) {
        if (l.lit) continue;
        const d = distXZ(p.pos, l.pos);
        if (d <= t.interact_radius && d < bd) {
          best = l;
          bd = d;
        }
      }
      if (best) {
        const amount = Math.min(p.carried, t.lantern_cost - best.deposited);
        p.carried -= amount;
        best.deposited += amount;
        this.emit('deposit', { lantern_id: best.id, amount, deposited: best.deposited });
        if (best.deposited >= t.lantern_cost) {
          best.lit = true;
          this.score += t.score.per_lantern;
          this.emit('lantern_lit', { lantern_id: best.id });
        }
      }
    }

    // pickup
    for (let i = 0; i < this.motes.length && p.carried < t.carry_capacity; ) {
      if (distXZ(p.pos, this.motes[i].pos) <= t.pickup_radius) {
        this.motes.splice(i, 1);
        p.carried++;
        this.score += t.score.per_mote;
        this.emit('mote_picked', { carried: p.carried });
      } else i++;
    }

    // pulse
    if (pulseEdge && p.pulseCd === 0 && p.carried >= t.pulse_cost) {
      p.carried -= t.pulse_cost;
      p.pulseCd = ticks(t.pulse_cooldown_s);
      this.pulseFx = this.tick;
      const ids = [];
      for (const s of this.shades) {
        const d = distXZ(p.pos, s.pos);
        if (d > t.pulse_radius) continue;
        ids.push(s.id);
        s.stun = ticks(t.pulse_stun_s);
        s.state = 'stunned';
        this.score += t.score.per_stun;
        const ux = d > 1e-9 ? (s.pos[0] - p.pos[0]) / d : 1;
        const uz = d > 1e-9 ? (s.pos[2] - p.pos[2]) / d : 0;
        s.pos[0] += ux * t.pulse_push_m;
        s.pos[2] += uz * t.pulse_push_m;
        this.clampShade(s);
      }
      this.emit('pulse', { stunned_ids: ids });
    }

    if (this.lanterns.every((l) => l.lit)) return this.finish('won', 'all_lit');

    // shades
    for (const s of this.shades) {
      if (s.stun > 0) {
        s.state = 'stunned';
        continue;
      }
      s.state = 'chase';
      const d = distXZ(p.pos, s.pos);
      if (d > 1e-9) {
        const m = Math.min(d, t.shade_speed / TICK_RATE);
        s.pos[0] += ((p.pos[0] - s.pos[0]) / d) * m;
        s.pos[2] += ((p.pos[2] - s.pos[2]) / d) * m;
      }
      this.clampShade(s);
    }
    if (p.invuln === 0) {
      for (const s of this.shades) {
        if (s.stun > 0 || distXZ(p.pos, s.pos) > t.shade_hit_radius) continue;
        p.flames--;
        const dropped = Math.floor(p.carried * t.hit_drop_ratio);
        p.carried -= dropped;
        for (let i = 0; i < dropped; i++) {
          const a = (i * 2 * Math.PI) / dropped;
          this.motes.push({
            id: `M${++this.moteSeq}`,
            pos: [r3(p.pos[0] + 2.5 * Math.sin(a)), 0, r3(p.pos[2] + 2.5 * Math.cos(a))],
          });
        }
        p.invuln = ticks(t.invuln_s);
        this.emit('player_hit', { by: 'shade', flames: p.flames, dropped });
        break;
      }
      if (p.flames <= 0) return this.finish('lost', 'no_flames');
    }

    // spawns
    if (this.randomMotes && this.motes.length < MOTE_TARGET && this.tick % MOTE_RESPAWN_TICKS === 0) this.spawnMote();
    if (this.randomShades && this.shades.length < SHADE_MAX && this.tick % SHADE_SPAWN_TICKS === 0) {
      const s = this.makeShade(this.nextShadeId());
      this.shades.push(s);
      this.emit('shade_spawned', { id: s.id });
    }

    if (this.timeLeft <= 1e-9) this.finish('lost', 'dawn');
  }

  // Shades stay on the island and outside the safe radius of lit lanterns.
  clampShade(s) {
    for (const l of this.lanterns) {
      if (!l.lit) continue;
      const d = distXZ(s.pos, l.pos);
      if (d < this.t.safe_radius) {
        const ux = d > 1e-9 ? (s.pos[0] - l.pos[0]) / d : 1;
        const uz = d > 1e-9 ? (s.pos[2] - l.pos[2]) / d : 0;
        s.pos[0] = l.pos[0] + ux * this.t.safe_radius;
        s.pos[2] = l.pos[2] + uz * this.t.safe_radius;
      }
    }
    const r = Math.hypot(s.pos[0], s.pos[2]);
    if (r > ISLAND_R + 5) {
      s.pos[0] *= (ISLAND_R + 5) / r;
      s.pos[2] *= (ISLAND_R + 5) / r;
    }
  }

  snapshot() {
    return {
      type: 'snapshot',
      tick: this.tick,
      sim_tick: this.tick,
      state: this.state,
      time_left_s: r3(this.timeLeft),
      score: this.score,
      player: { pos: pos3(this.player.pos), flames: this.player.flames, carried: this.player.carried },
      lanterns: this.lanterns.map((l) => ({ id: l.id, pos: pos3(l.pos), lit: l.lit, deposited: l.deposited })),
      shades: this.shades.map((s) => ({ id: s.id, pos: pos3(s.pos), state: s.state })),
      motes_active: this.motes.length,
      motes: this.motes.map((m) => ({ id: m.id, pos: pos3(m.pos) })),
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
