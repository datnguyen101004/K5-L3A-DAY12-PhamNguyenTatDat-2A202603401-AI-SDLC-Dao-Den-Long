// Accessibility (Ticket-04 §4): key rebinding, captions / visual cues. Client only; never touches the sim rules.

/** Rebindable actions, in the order shown in Settings. Escape always pauses as well (it also frees the mouse). */
export const ACTIONS = [
  ['up', 'Đi tới', 'KeyW'],
  ['down', 'Đi lùi', 'KeyS'],
  ['left', 'Sang trái', 'KeyA'],
  ['right', 'Sang phải', 'KeyD'],
  ['jump', 'Nhảy', 'Space'],
  ['dash', 'Lướt', 'ShiftLeft'],
  ['interact', 'Thắp / châm dầu', 'KeyE'],
  ['pulse', 'Tỏa Sáng', 'KeyF'],
  ['pause', 'Tạm dừng', 'KeyP'],
  ['camLeft', 'Xoay camera trái', 'KeyQ'],
  ['camRight', 'Xoay camera phải', 'KeyZ'],
];
export const DEFAULT_KEYS = Object.fromEntries(ACTIONS.map(([a, , k]) => [a, k]));
const RESERVED = new Set(['Escape', 'F3', 'Tab', 'Enter', 'F5', 'F11', 'F12']);

export function keyLabel(code) {
  if (!code) return '?';
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return 'Num ' + code.slice(6);
  const names = { Space: 'Space', ShiftLeft: 'Shift', ShiftRight: 'Shift phải', ControlLeft: 'Ctrl', ControlRight: 'Ctrl phải', AltLeft: 'Alt', AltRight: 'Alt phải', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Backquote: '`', Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/', Backslash: '\\', CapsLock: 'Caps', Backspace: 'Backspace' };
  return names[code] ?? code;
}

/** Returns the action already using `code` (other than `except`), or null. */
export function conflict(keys, code, except) {
  for (const [a] of ACTIONS) if (a !== except && keys[a] === code) return a;
  return null;
}

const labelOf = (a) => ACTIONS.find((x) => x[0] === a)[1];

/** Builds the key list in #keybinds. onChange(keys) is called after every successful change. */
export class KeyBinder {
  constructor(container, msgEl, settings, onChange) {
    this.el = container;
    this.msg = msgEl;
    this.settings = settings;
    this.onChange = onChange;
    this.waiting = null; // action waiting for a key
    this.render();
    window.addEventListener('keydown', (e) => this.capture(e), true);
  }

  get capturing() {
    return this.waiting !== null;
  }

  render() {
    this.el.textContent = '';
    for (const [a, label] of ACTIONS) {
      const row = document.createElement('div');
      row.className = 'bind-row';
      const name = document.createElement('span');
      name.textContent = label;
      const btn = document.createElement('button');
      btn.className = 'btn bind' + (this.waiting === a ? ' waiting' : '');
      btn.textContent = this.waiting === a ? 'Nhấn phím…' : keyLabel(this.settings.keys[a]);
      btn.addEventListener('click', () => {
        this.waiting = a;
        this.say(`Nhấn phím mới cho “${label}” (Esc để hủy)`);
        this.render();
      });
      row.append(name, btn);
      this.el.appendChild(row);
    }
  }

  say(text, bad = false) {
    this.msg.textContent = text;
    this.msg.classList.toggle('bad', bad);
  }

  capture(e) {
    if (this.waiting === null) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    const a = this.waiting;
    if (e.code === 'Escape') {
      this.waiting = null;
      this.say('Đã hủy');
      return this.render();
    }
    if (RESERVED.has(e.code)) return this.say(`Phím ${keyLabel(e.code)} dành riêng cho hệ thống, chọn phím khác`, true);
    const other = conflict(this.settings.keys, e.code, a);
    if (other) return this.say(`Phím ${keyLabel(e.code)} đang dùng cho “${labelOf(other)}”. Hãy đổi phím đó trước hoặc chọn phím khác.`, true);
    this.settings.keys[a] = e.code;
    this.waiting = null;
    this.say(`“${labelOf(a)}” = ${keyLabel(e.code)}`);
    this.render();
    this.onChange(this.settings.keys);
  }

  reset() {
    this.settings.keys = { ...DEFAULT_KEYS };
    this.waiting = null;
    this.say('Đã khôi phục phím mặc định');
    this.render();
    this.onChange(this.settings.keys);
  }
}

/**
 * Captions and edge arrows (visual cues for sounds and off-screen danger).
 * Cues: shade appeared (+ arrow toward it for 4 s), wind coming, last 10 s countdown, lantern below 30 fuel.
 */
export class Captions {
  constructor(container, arrowLayer) {
    this.el = container;
    this.arrows = arrowLayer;
    this.enabled = true;
    this.spawnMarks = []; // { id, until, el }
    this.lowSeen = new Set();
    this.lastCount = null;
    this.windSeen = false;
  }

  reset() {
    this.el.textContent = '';
    this.arrows.textContent = '';
    this.spawnMarks = [];
    this.lowSeen.clear();
    this.lastCount = null;
    this.windSeen = false;
  }

  line(text, kind, ms = 3500) {
    if (!this.enabled) return;
    const d = document.createElement('div');
    d.className = 'caption ' + kind;
    d.textContent = text;
    this.el.appendChild(d);
    while (this.el.children.length > 3) this.el.firstChild.remove();
    setTimeout(() => d.remove(), ms);
  }

  /** Called with the events of each tick. */
  onEvent(e, game) {
    if (e.name === 'shade_spawned') {
      const s = game.shades.find((x) => x.id === e.data.id);
      if (!s) return;
      this.line(`[Bóng Mực xuất hiện ${this.side(game, s.pos)}]`, 'danger');
      if (!this.enabled) return;
      const el = document.createElement('div');
      el.className = 'spawn-arrow';
      el.innerHTML = '<div class="arrow-head"></div><span>Bóng Mực</span>';
      this.arrows.appendChild(el);
      this.spawnMarks.push({ id: s.id, until: performance.now() + 4000, el });
    } else if (e.name === 'lantern_out') this.line(`[Đèn ${e.data.lantern_id} đã tắt]`, 'danger');
  }

  side(game, pos) {
    const d = Math.hypot(pos[0] - game.p.pos[0], pos[2] - game.p.pos[2]);
    return `cách ${Math.round(d)} m`;
  }

  /** Per frame: countdown, wind, low fuel, and the spawn arrows. proj(x,y,z) -> {x,y,on}. */
  update(game, proj) {
    const t = game.t;
    if (game.wind.warning && !this.windSeen) this.line('[Gió mạnh sắp thổi, giữ chặt chân!]', 'warn');
    this.windSeen = !!game.wind.warning;
    const tl = game.timeLeft;
    if (tl <= 10 && tl > 0) {
      const c = Math.ceil(tl);
      if (c !== this.lastCount) {
        this.lastCount = c;
        this.line(c === 10 ? '[Còn 10 giây tới bình minh!]' : `[${c}]`, 'warn', 950);
      }
    }
    for (const l of game.lanterns) {
      const low = l.lit && l.fuel < t.low_fuel_threshold * 60;
      if (low && !this.lowSeen.has(l.id)) this.line(`[Đèn ${l.id} sắp cạn dầu (${Math.floor(l.fuel / 60)})]`, 'warn');
      if (low) this.lowSeen.add(l.id);
      else this.lowSeen.delete(l.id);
    }
    const now = performance.now();
    const W = window.innerWidth;
    const H = window.innerHeight;
    this.spawnMarks = this.spawnMarks.filter((m) => {
      const s = game.shades.find((x) => x.id === m.id);
      if (!s || now > m.until || !this.enabled) {
        m.el.remove();
        return false;
      }
      const pr = proj(s.pos[0], s.pos[1] + 1, s.pos[2]);
      if (pr.on) {
        m.el.style.transform = `translate(${(pr.x - 11).toFixed(0)}px, ${(pr.y - 40).toFixed(0)}px)`;
        m.el.classList.add('onscreen');
      } else {
        const ang = Math.atan2(pr.y - H / 2, pr.x - W / 2);
        const hw = W / 2 - 90;
        const hh = H / 2 - 120;
        const k = Math.min(Math.abs(Math.cos(ang)) > 1e-6 ? hw / Math.abs(Math.cos(ang)) : Infinity, Math.abs(Math.sin(ang)) > 1e-6 ? hh / Math.abs(Math.sin(ang)) : Infinity);
        m.el.classList.remove('onscreen');
        m.el.style.transform = `translate(${(W / 2 + Math.cos(ang) * k - 11).toFixed(0)}px, ${(H / 2 + Math.sin(ang) * k - 11).toFixed(0)}px)`;
        m.el.firstChild.style.transform = `rotate(${ang.toFixed(3)}rad)`;
      }
      return true;
    });
  }
}
