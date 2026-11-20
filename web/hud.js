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
    this.jumpEl = $('cd-jump');
    this.dashEl = $('cd-dash');
    this.pulseEl = $('cd-pulse');
    this.jumpTime = $('cd-jump-time');
    this.dashTime = $('cd-dash-time');
    this.pulseTime = $('cd-pulse-time');
    this.jumpFill = document.querySelector('#cd-jump .cd-fill');
    this.flameSlots = [];
    for (let i = 0; i < tuning.flames; i++) {
      const d = document.createElement('div');
      d.className = 'flame';
      this.flamesEl.appendChild(d);
      this.flameSlots.push(d);
    }
    this.moteSlots = [];
    for (let i = 0; i < tuning.capacity_max; i++) { // capacity grows with every successful light (10 .. 20)
      const d = document.createElement('div');
      d.className = 'mote';
      this.motesEl.appendChild(d);
      this.moteSlots.push(d);
    }
    this.capEl = document.createElement('span');
    this.capEl.className = 'cap-text';
    this.motesEl.appendChild(this.capEl);
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
    const need = Math.ceil(t.win_ratio * game.lanterns.length - 1e-9);
    this.set('lan', lit + '/' + game.lanterns.length + '/' + need, () => { this.lanternEl.textContent = `Đèn ${lit}/${game.lanterns.length} (cần ${need})`; });
    this.set('score', game.score, (v) => { this.scoreEl.textContent = String(v); });

    const cap = game.capacity;
    this.set('carried', p.carried + '/' + cap, () => {
      this.moteSlots.forEach((s, i) => { s.style.display = i < cap ? '' : 'none'; s.classList.toggle('filled', i < p.carried); });
      this.capEl.textContent = `${p.carried}/${cap}`;
    });

    const dashMax = t.dash_cooldown_s * 60;
    const pulseMax = t.pulse_cooldown_s * 60;
    const charm = p.charm > 0;
    const df = charm ? 0 : Math.min(1, p.dashCd / dashMax);
    const pf = Math.min(1, p.pulseCd / pulseMax);
    this.set('dashcd', Math.round(df * 100), (v) => { this.dashFill.style.background = `conic-gradient(rgba(6,8,18,.72) ${v}%, rgba(6,8,18,0) ${v}%)`; });
    this.set('pulcd', Math.round(pf * 100), (v) => { this.pulseFill.style.background = `conic-gradient(rgba(6,8,18,.72) ${v}%, rgba(6,8,18,0) ${v}%)`; });
    // Countdown text: seconds left on cooldown, or what the skill is waiting for.
    const sec = (ticks) => (ticks / 60).toFixed(1) + 's';
    const show = (key, el, timeEl, busy, text) => this.set(key, (busy ? 'b:' : 'r:') + text, () => {
      el.classList.toggle('busy', busy);
      el.classList.toggle('ready', !busy);
      timeEl.textContent = text;
    });
    show('jumpt', this.jumpEl, this.jumpTime, !p.grounded, p.grounded ? 'sẵn sàng' : 'trên không');
    this.set('jumpfill', p.grounded ? 0 : 100, (v) => { this.jumpFill.style.background = `conic-gradient(rgba(6,8,18,.72) ${v}%, rgba(6,8,18,0) ${v}%)`; });
    if (charm) show('dasht', this.dashEl, this.dashTime, false, 'không hồi');
    else if (p.dashT > 0) show('dasht', this.dashEl, this.dashTime, true, 'đang lướt');
    else show('dasht', this.dashEl, this.dashTime, p.dashCd > 0, p.dashCd > 0 ? sec(p.dashCd) : 'sẵn sàng');
    if (p.pulseCd > 0) show('pulset', this.pulseEl, this.pulseTime, true, sec(p.pulseCd));
    else if (p.carried < t.pulse_cost) show('pulset', this.pulseEl, this.pulseTime, true, `${p.carried}/${t.pulse_cost} đóm`);
    else show('pulset', this.pulseEl, this.pulseTime, false, 'sẵn sàng');

    // Prompt khi gần đèn nhận được ánh sáng: đèn chưa sáng (nạp / thắp lại) hoặc đèn sáng chưa đầy dầu (châm dầu)
    const fuelMax = t.fuel_max * 60;
    let best = null;
    let bd = Infinity;
    for (const l of game.lanterns) {
      if (l.lit && l.fuel >= fuelMax) continue;
      const d = Math.hypot(p.pos[0] - l.pos[0], p.pos[2] - l.pos[2]);
      if (d <= t.interact_radius && d < bd) { bd = d; best = l; }
    }
    if (best) {
      const text = best.lit
        ? `E — Châm dầu (${Math.floor(best.fuel / 60)}/${t.fuel_max})`
        : `E — ${best.everLit ? 'Thắp lại' : 'Nạp ánh sáng'} (${best.deposited}/${best.everLit ? t.relight_cost : t.lantern_cost})`;
      this.set('prompt', best.id + ':' + text, () => {
        this.promptEl.textContent = text;
        this.promptEl.classList.remove('hidden');
      });
    } else if (this.cache.prompt) {
      this.cache.prompt = null;
      this.promptEl.classList.add('hidden');
    }

    // Mũi tên chỉ đèn cần chú ý gần nhất (tắt hoặc sắp cạn dầu) khi nó nằm ngoài màn hình
    let near = null;
    let nd = Infinity;
    for (const l of game.lanterns) {
      if (l.lit && l.fuel >= t.low_fuel_threshold * 60) continue;
      const d = Math.hypot(p.pos[0] - l.pos[0], p.pos[2] - l.pos[2]);
      if (d < nd) { nd = d; near = l; }
    }
    if (near) {
      const pr = proj(near.pos[0], near.pos[1] + 3.2, near.pos[2]);
      if (!pr.on) {
        const dx = pr.x - window.innerWidth / 2;
        const dy = pr.y - window.innerHeight / 2;
        const ang = Math.atan2(dy, dx);
        const hw = window.innerWidth / 2 - 70; // inset rectangle: clear of the corners and the bottom bars
        const hh = window.innerHeight / 2 - 110;
        const k = Math.min(Math.abs(Math.cos(ang)) > 1e-6 ? hw / Math.abs(Math.cos(ang)) : Infinity, Math.abs(Math.sin(ang)) > 1e-6 ? hh / Math.abs(Math.sin(ang)) : Infinity);
        const ax = window.innerWidth / 2 + Math.cos(ang) * k;
        const ay = window.innerHeight / 2 + Math.sin(ang) * k;
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
