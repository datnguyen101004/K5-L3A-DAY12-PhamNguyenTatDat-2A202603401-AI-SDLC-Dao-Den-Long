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
    this.lampsEl = $('hud-lamps');
    this.toastsEl = $('hud-toasts');
    this.mapEl = $('hud-map');
    this.mapCtx = this.mapEl.getContext('2d');
    this.mapAt = 0;
    this.lampRows = [];
  }

  /** Called once per night: per-lantern rows and a pre-rendered terrain image for the minimap. */
  setMap(map, game) {
    this.lampsEl.textContent = '';
    this.lampRows = game.lanterns.map((l) => {
      const row = document.createElement('div');
      row.className = 'lamp';
      row.innerHTML = `<span class="lamp-id">${l.id}</span><span class="lamp-bar"><i></i></span><span class="lamp-val"></span>`;
      this.lampsEl.appendChild(row);
      return { row, fill: row.querySelector('i'), val: row.querySelector('.lamp-val'), key: '' };
    });
    // terrain: 2 px per metre, colour by surface height, sand on edges
    const [x0, x1, z0, z1] = map.bounds;
    const W = (x1 - x0) * 2;
    const H = (z1 - z0) * 2;
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const g = c.getContext('2d');
    const top = (x, z) => { const t = map.topsAt(x, z); return t.length ? Math.max(...t) : null; };
    for (let j = 0; j < H; j++) {
      for (let i = 0; i < W; i++) {
        const x = x0 + (i + 0.5) / 2;
        const z = z0 + (j + 0.5) / 2;
        const h = top(x, z);
        if (h === null) continue;
        const edge = top(x + 1.5, z) === null || top(x - 1.5, z) === null || top(x, z + 1.5) === null || top(x, z - 1.5) === null;
        g.fillStyle = h >= 10 ? '#6B4A2F' : h % 3 !== 0 ? '#8a6a45' : edge ? '#C9B48A' : ['#2F5D50', '#3f7563', '#518f7a'][h / 3] ?? '#2F5D50';
        g.fillRect(i, j, 1, 1);
      }
    }
    this.terrain = { img: c, x0, z0 };
  }

  toast(text, kind = 'good') {
    const d = document.createElement('div');
    d.className = 'toast ' + kind;
    d.textContent = text;
    this.toastsEl.appendChild(d);
    while (this.toastsEl.children.length > 4) this.toastsEl.firstChild.remove();
    setTimeout(() => d.remove(), 2500);
  }

  /** Heading-up minimap: the camera's forward direction is "up". Redrawn at ~12 Hz. */
  drawMap(game, yawDeg) {
    const now = performance.now();
    if (now - this.mapAt < 80 || !this.terrain) return;
    this.mapAt = now;
    const ctx = this.mapCtx;
    const S = this.mapEl.width;
    const R = S / 2;
    const range = 42; // metres from the centre to the rim
    const k = R / range;
    const th = (yawDeg * Math.PI) / 180;
    const cs = Math.cos(th);
    const sn = Math.sin(th);
    const p = game.p.pos;
    // world (x,z) -> screen: right = -dx cos + dz sin, up = dx sin + dz cos
    const sx = (x, z) => R + (-(x - p[0]) * cs + (z - p[2]) * sn) * k;
    const sy = (x, z) => R - ((x - p[0]) * sn + (z - p[2]) * cs) * k;
    const cb = document.body.classList.contains('cb');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, S, S);
    ctx.save();
    ctx.beginPath();
    ctx.arc(R, R, R - 1, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = '#12384A';
    ctx.fillRect(0, 0, S, S);
    // terrain image (2 px per metre)
    ctx.setTransform(-cs * k / 2, -sn * k / 2, sn * k / 2, -cs * k / 2, R, R);
    ctx.drawImage(this.terrain.img, (this.terrain.x0 - p[0]) * 2, (this.terrain.z0 - p[2]) * 2);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const t = this.tuning;
    const low = t.low_fuel_threshold * 60;
    const blink = ((game.simTick / 30) | 0) % 2 === 0;
    // motes and charms
    ctx.fillStyle = '#FFE58A';
    for (const m of game.motes) ctx.fillRect(sx(m.pos[0], m.pos[2]) - 1.2, sy(m.pos[0], m.pos[2]) - 1.2, 2.4, 2.4);
    ctx.fillStyle = '#C8102E';
    for (const c of game.charms) if (c.available) ctx.fillRect(sx(c.pos[0], c.pos[2]) - 3, sy(c.pos[0], c.pos[2]) - 3, 6, 6);
    // lanterns: safe zone, state, fuel arc
    for (const l of game.lanterns) {
      const x = sx(l.pos[0], l.pos[2]);
      const y = sy(l.pos[0], l.pos[2]);
      if (l.lit && l.fuel >= low) {
        ctx.fillStyle = 'rgba(255,179,71,0.16)';
        ctx.beginPath(); ctx.arc(x, y, t.safe_radius * k, 0, Math.PI * 2); ctx.fill();
      }
      ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2);
      if (!l.lit) { ctx.fillStyle = '#20253a'; ctx.fill(); ctx.strokeStyle = '#8b90a3'; ctx.lineWidth = 1.5; ctx.stroke(); }
      else { ctx.fillStyle = l.fuel < low ? (blink ? (cb ? '#ffffff' : '#FF5A5F') : '#5b3a3a') : '#FFB347'; ctx.fill(); }
      if (l.lit) {
        ctx.strokeStyle = '#FFE9B0'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(x, y, 8, -Math.PI / 2, -Math.PI / 2 + 2 * Math.PI * Math.min(1, l.fuel / (t.fuel_max * 60))); ctx.stroke();
      }
    }
    // shades (drain: line to the lantern), drifters
    const shadeC = cb ? '#00B3FF' : '#9b6bff';
    for (const s of game.shades) {
      const x = sx(s.pos[0], s.pos[2]);
      const y = sy(s.pos[0], s.pos[2]);
      if (s.state === 'drain') {
        const l = game.lanterns.find((q) => q.id === s.target);
        if (l) { ctx.strokeStyle = shadeC; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(sx(l.pos[0], l.pos[2]), sy(l.pos[0], l.pos[2])); ctx.stroke(); }
      }
      ctx.fillStyle = s.state === 'stunned' ? '#5d5675' : shadeC;
      ctx.beginPath(); ctx.arc(x, y, s.state === 'chase' ? 4.5 : 3.5, 0, Math.PI * 2); ctx.fill();
      if (s.state === 'chase') { ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.stroke(); }
    }
    ctx.fillStyle = '#8FA3B8';
    for (const d of game.drifters) ctx.fillRect(sx(d.pos[0], d.pos[2]) - 3, sy(d.pos[0], d.pos[2]) - 1.5, 6, 3);
    // player arrow (facing relative to the camera)
    const f = game.p.facing;
    const ang = Math.atan2(-f[0] * cs + f[1] * sn, f[0] * sn + f[1] * cs); // angle from "up", clockwise positive
    ctx.translate(R, R);
    ctx.rotate(ang);
    ctx.fillStyle = '#F5F1E6';
    ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(5, 5); ctx.lineTo(0, 2); ctx.lineTo(-5, 5); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  updateLamps(game) {
    const t = this.tuning;
    const low = t.low_fuel_threshold * 60;
    const draining = new Set(game.shades.filter((s) => s.state === 'drain').map((s) => s.target));
    game.lanterns.forEach((l, i) => {
      const r = this.lampRows[i];
      if (!r) return;
      const fuel = l.lit ? Math.floor(l.fuel / 60) : 0;
      const cls = 'lamp' + (!l.lit ? (l.everLit ? ' out' : ' new') : l.fuel < low ? ' low' : '') + (draining.has(l.id) ? ' drain' : '');
      const key = cls + fuel;
      if (key === r.key) return;
      r.key = key;
      r.row.className = cls;
      r.fill.style.width = (l.lit ? Math.min(100, (100 * l.fuel) / (t.fuel_max * 60)) : 0) + '%';
      r.val.textContent = l.lit ? String(fuel) : l.everLit ? '' : `${l.deposited}/${t.lantern_cost}`;
    });
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
  update(game, proj, yawDeg = 0) {
    const p = game.p;
    const t = this.tuning;
    this.updateLamps(game);
    this.drawMap(game, yawDeg);
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
      const nearlyFull = best.lit && best.fuel > (t.fuel_max - t.fuel_per_mote) * 60;
      const text = nearlyFull
        ? `Đèn còn đầy dầu (${Math.floor(best.fuel / 60)}/${t.fuel_max})`
        : best.lit
        ? `E — Châm dầu (${Math.floor(best.fuel / 60)}/${t.fuel_max})`
        : `E — ${best.everLit ? 'Thắp lại' : 'Nạp ánh sáng'} (${best.deposited}/${best.everLit ? t.relight_cost : t.lantern_cost})`;
      const empty = p.carried === 0 && !nearlyFull;
      this.set('prompt', best.id + ':' + text + empty, () => {
        this.promptEl.textContent = empty ? text + ' · cần đom đóm' : text;
        this.promptEl.classList.toggle('warn', empty);
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
