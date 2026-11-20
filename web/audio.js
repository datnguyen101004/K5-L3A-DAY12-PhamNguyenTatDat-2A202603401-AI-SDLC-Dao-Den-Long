// Âm thanh hoàn toàn bằng WebAudio (không file asset): nhạc nền nhẹ + SFX.
// AudioContext chỉ được tạo sau cú chỉ chuột/phím đầu tiên của người chơi.
export class Audio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.volume = 0.8;
    this.paused = false;
    this._noiseBuf = null;
    this._musicTimer = null;
    this._nextNote = 0;
    this._step = 0;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.volume;
    this.master.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.15;
    this.musicGain.connect(this.master);
    this._startMusic();
  }

  setVolume(v) {
    this.volume = v;
    if (this.master) this.master.gain.value = v;
  }

  // Khi tạm dừng: chỉ phát được âm thanh UI (do caller quyết định), nhạc nền nhỏ dần về 0.
  setPaused(p) {
    this.paused = p;
    if (this.musicGain) this.musicGain.gain.setTargetAtTime(p ? 0 : 0.15, this.ctx.currentTime, 0.1);
  }

  play(name) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    if (this.paused && name !== 'ui') return;
    const fn = this.sfx[name];
    if (fn) fn.call(this);
  }

  _noise() {
    if (!this._noiseBuf) {
      const len = this.ctx.sampleRate;
      this._noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this._noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    return this._noiseBuf;
  }

  tone({ type = 'sine', f = 440, f2 = null, t = 0.15, v = 0.2, delay = 0 }) {
    const c = this.ctx;
    const t0 = c.currentTime + delay;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t0);
    if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(1, f2), t0 + t);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(v, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + t);
    o.connect(g).connect(this.master);
    o.start(t0);
    o.stop(t0 + t + 0.05);
  }

  noise({ t = 0.3, v = 0.2, f = 800, f2 = null, q = 1, delay = 0 }) {
    const c = this.ctx;
    const t0 = c.currentTime + delay;
    const src = c.createBufferSource();
    src.buffer = this._noise();
    src.loop = true;
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(f, t0);
    if (f2) bp.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t0 + t);
    bp.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(v, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + t);
    src.connect(bp).connect(g).connect(this.master);
    src.start(t0);
    src.stop(t0 + t + 0.05);
  }

  get sfx() {
    return {
      ui: () => this.tone({ type: 'square', f: 660, t: 0.06, v: 0.1 }),
      mote: () => this.tone({ type: 'sine', f: 920, f2: 1380, t: 0.12, v: 0.22 }),
      deposit: () => this.tone({ type: 'triangle', f: 520, f2: 780, t: 0.14, v: 0.16 }),
      lantern: () => {
        [523.25, 659.25, 784].forEach((f, i) => this.tone({ type: 'sine', f, t: 0.7, v: 0.16, delay: i * 0.05 }));
        this.tone({ type: 'sine', f: 1046.5, t: 0.9, v: 0.1, delay: 0.2 });
      },
      pulse: () => {
        this.tone({ type: 'sawtooth', f: 180, f2: 540, t: 0.35, v: 0.22 });
        this.noise({ t: 0.3, v: 0.12, f: 400, f2: 1400, q: 0.8 });
      },
      hit: () => {
        this.tone({ type: 'square', f: 150, f2: 65, t: 0.3, v: 0.28 });
        this.noise({ t: 0.22, v: 0.18, f: 300, f2: 120, q: 0.7 });
      },
      jump: () => this.tone({ type: 'sine', f: 300, f2: 580, t: 0.13, v: 0.14 }),
      dash: () => {
        this.noise({ t: 0.24, v: 0.24, f: 950, f2: 280, q: 1.2 });
        this.tone({ type: 'sawtooth', f: 300, f2: 900, t: 0.18, v: 0.08 });
      },
      win: () => [523.25, 659.25, 784, 1046.5].forEach((f, i) => this.tone({ type: 'sine', f, t: 0.3, v: 0.2, delay: i * 0.13 })),
      lose: () => [392, 311.13, 233.08].forEach((f, i) => this.tone({ type: 'triangle', f, t: 0.34, v: 0.2, delay: i * 0.22 })),
      spawn: () => {
        this.tone({ type: 'sine', f: 95, f2: 58, t: 0.5, v: 0.24 });
        this.noise({ t: 0.4, v: 0.1, f: 200, f2: 90, q: 2 });
      },
      tick: () => this.tone({ type: 'square', f: 1050, t: 0.05, v: 0.11 }),
      whoosh: () => this.noise({ t: 1.0, v: 0.28, f: 260, f2: 1500, q: 0.6 }),
      charm: () => {
        this.tone({ type: 'sine', f: 1200, f2: 1800, t: 0.2, v: 0.18 });
        this.tone({ type: 'sine', f: 1800, t: 0.3, v: 0.12, delay: 0.12 });
      },
      steal: () => this.tone({ type: 'square', f: 230, f2: 150, t: 0.2, v: 0.18 }),
    };
  }

  // Nhạc nền: pad trầm + arpeggio pentatonic rất nhỏ, hẹn giờ bằng lookahead.
  _startMusic() {
    const c = this.ctx;
    const padGain = c.createGain();
    padGain.gain.value = 0.05;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 620;
    padGain.connect(lp).connect(this.musicGain);
    for (const f of [110, 164.81, 220]) {
      const o = c.createOscillator();
      o.type = 'triangle';
      o.frequency.value = f;
      o.detune.value = (Math.random() - 0.5) * 8;
      o.connect(padGain);
      o.start();
    }
    const lfo = c.createOscillator();
    lfo.frequency.value = 0.09;
    const lfoG = c.createGain();
    lfoG.gain.value = 0.02;
    lfo.connect(lfoG).connect(padGain.gain);
    lfo.start();

    const scale = [220, 261.63, 293.66, 329.63, 392, 440, 523.25, 587.33];
    const pattern = [0, 2, 4, 3, 5, 4, 2, 1, 0, 4, 3, 2, 5, 6, 4, 2];
    this._nextNote = c.currentTime + 0.4;
    this._musicTimer = setInterval(() => {
      if (!this.ctx) return;
      while (this._nextNote < c.currentTime + 0.35) {
        const idx = pattern[this._step % pattern.length];
        this._step++;
        const f = scale[idx] * (this._step % 16 < 8 ? 1 : 0.5);
        const t0 = this._nextNote;
        const o = c.createOscillator();
        const g = c.createGain();
        o.type = 'sine';
        o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(0.055, t0 + 0.03);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.55);
        o.connect(g).connect(this.musicGain);
        o.start(t0);
        o.stop(t0 + 0.6);
        this._nextNote += 0.42;
      }
    }, 120);
  }
}
