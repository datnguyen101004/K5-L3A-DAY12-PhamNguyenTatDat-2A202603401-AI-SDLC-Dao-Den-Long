// HUD: cập nhật DOM mỗi frame nhưng chỉ ghi khi giá trị thay đổi (tránh layout thrash).
export class HUD {
  constructor(tuning) {
    this.tuning = tuning;
    const $ = (id) => document.getElementById(id);
    this.flamesEl = $('hud-flames');
    this.clockEl = $('hud-clock');
    this.lanternEl = $('hud-lanterns');
    this.scoreEl = $('hud-score');
    this.motesEl = $('hud-motes');
    this.promptEl = $('hud-prompt');
    this.arrowEl = $('hud-arrow');
    this.charmEl = $('hud-charm');
    this.windEl = $('hud-wind');
    this.flashEl = $('hud-flash');
    this.dashFill = document.querySelector('#cd-dash .cd-fill');
    this.pulseFill = document.querySelector('#cd-pulse .cd-fill');
    this.dashState = $('cd-dash-state');
    this.pulseState = $('cd-pulse-state');
    this.flameSlots = [];
    for (let i = 0; i < tuning.flames; i++) {
      const d = document.createElement('div');
      d.className = 'flame';
      this.flamesEl.appendChild(d);
      this.flameSlots.push(d);
    }
    this.moteSlots = [];
    for (let i = 0; i < tuning.carry_capacity; i++) {
      const d = document.createElement('div');
      d.className = 'mote';
      this.motesEl.appendChild(d);
      this.moteSlots.push(d);
    }
    this.cache = {};
  }

  reset() { this.cache = {}; this.promptEl.classList.add('hidden'); this.arrowEl.classList.add('hidden'); }

  set(key, val, apply) {
    if (this.cache[key] !== val) { this.cache[key] = val; apply(val); }
  }

  flash() {
    this.flashEl.classList.remove('show');
    void this.flashEl.offsetWidth; // restart CSS animation
    this.flashEl.classList.add('show');
  }

  /** proj(x,y,z) -> {x, y, on, behind} (pixel màn hình; đã lật khi nằm sau camera) */
  update(game, proj) {
    const p = game.p;
    const t = this.tuning;
    this.set('flames', p.flames, (v) => this.flameSlots.forEach((s, i) => s.classList.toggle('off', i >= v)));

    const tl = Math.max(0, game.timeLeft);
    const mm = String(Math.floor(tl / 60)).padStart(2, '0');
    const ss = String(Math.floor(tl % 60)).padStart(2, '0');
    this.set('clock', mm + ':' + ss, (v) => { this.clockEl.textContent = v; });
    this.set('danger', tl <= 30, (v) => this.clockEl.classList.toggle('danger', v));

    const lit = game.lanterns.reduce((a, l) => a + (l.lit ? 1 : 0), 0);
    this.set('lan', lit + '/' + game.lanterns.length, (v) => { this.lanternEl.textContent = 'Đèn ' + v; });
    this.set('score', game.score, (v) => { this.scoreEl.textContent = String(v); });

    this.set('carried', p.carried, (v) => this.moteSlots.forEach((s, i) => s.classList.toggle('filled', i < v)));

    const dashMax = t.dash_cooldown_s * 60;
    const pulseMax = t.pulse_cooldown_s * 60;
    const charm = p.charm > 0;
    const df = charm ? 0 : Math.min(1, p.dashCd / dashMax);
    const pf = Math.min(1, p.pulseCd / pulseMax);
    this.set('dashcd', Math.round(df * 100), (v) => { this.dashFill.style.background = `conic-gradient(rgba(6,8,18,.72) ${v}%, rgba(6,8,18,0) ${v}%)`; });
    this.set('pulcd', Math.round(pf * 100), (v) => { this.pulseFill.style.background = `conic-gradient(rgba(6,8,18,.72) ${v}%, rgba(6,8,18,0) ${v}%)`; });
    this.set('charmstate', charm, (v) => { this.dashState.textContent = v ? 'sẵn sàng' : ''; });
    this.set('pulseok', p.carried >= t.pulse_cost, (v) => { this.pulseState.textContent = v ? '' : `${p.carried}/${t.pulse_cost}`; });

    // Prompt nạp đèn khi gần đèn chưa sáng
    let best = null;
    let bd = Infinity;
    for (const l of game.lanterns) {
      if (l.lit) continue;
      const d = Math.hypot(p.pos[0] - l.pos[0], p.pos[2] - l.pos[2]);
      if (d <= t.interact_radius && d < bd) { bd = d; best = l; }
    }
    if (best) {
      this.set('prompt', best.id + ':' + best.deposited, () => {
        this.promptEl.textContent = `E — Nạp ánh sáng (${best.deposited}/${t.lantern_cost})`;
        this.promptEl.classList.remove('hidden');
      });
    } else if (this.cache.prompt) {
      this.cache.prompt = null;
      this.promptEl.classList.add('hidden');
    }

    // Mũi tên chỉ đèn gần nhất chưa sáng khi nó nằm ngoài màn hình
    let near = null;
    let nd = Infinity;
    for (const l of game.lanterns) {
      if (l.lit) continue;
      const d = Math.hypot(p.pos[0] - l.pos[0], p.pos[2] - l.pos[2]);
      if (d < nd) { nd = d; near = l; }
    }
    if (near) {
      const pr = proj(near.pos[0], near.pos[1] + 3.2, near.pos[2]);
      if (!pr.on) {
        const dx = pr.x - window.innerWidth / 2;
        const dy = pr.y - window.innerHeight / 2;
        const ang = Math.atan2(dy, dx);
        const R = Math.min(window.innerWidth, window.innerHeight) / 2 - 80;
        const ax = window.innerWidth / 2 + Math.cos(ang) * R;
        const ay = window.innerHeight / 2 + Math.sin(ang) * R;
        this.arrowEl.classList.remove('hidden');
        this.arrowEl.style.transform = `translate(${(ax - 11).toFixed(1)}px, ${(ay - 11).toFixed(1)}px) rotate(${ang.toFixed(3)}rad)`;
      } else this.arrowEl.classList.add('hidden');
    } else this.arrowEl.classList.add('hidden');

    if (p.charm > 0) {
      this.charmEl.classList.remove('hidden');
      this.charmEl.textContent = `Bùa đỏ: ${(p.charm / 60).toFixed(1)}s`;
    } else this.charmEl.classList.add('hidden');

    this.set('wind', !!game.wind.warning, (v) => this.windEl.classList.toggle('hidden', !v));
  }
}
