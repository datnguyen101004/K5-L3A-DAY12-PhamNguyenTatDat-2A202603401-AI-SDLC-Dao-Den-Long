// Entry point của client: flow màn hình, input, vòng lặp fixed-timestep 60 Hz, sự kiện sim -> audio/fx.
import { Game, TICK_RATE } from '/src/sim.js';
import { MAPS, NIGHT_NAMES } from '/src/maps.js';
import { Campaign } from '/src/campaign.js';
import { World } from '/web/world.js';
import { HUD } from '/web/hud.js';
import { Audio } from '/web/audio.js';
import { Screens, settings, ONG_DANG_LINES } from '/web/ui.js';
import { runBench } from '/web/bench.js';
import { KeyBinder, Captions, keyLabel } from '/web/a11y.js';
import { loadBoard, renderBoard, wireForm, resetForm } from '/web/leaderboard-ui.js';

const contract = await (await fetch('/game.contract.json')).json();
const tuning = contract.tuning;

// Dev shortcut cho test/chụp màn hình: ?night=1|2|3 bỏ qua menu, vào thẳng thẻ giới thiệu của đêm đó.
const devNight = Number(new URLSearchParams(location.search).get('night'));

settings.load();

const audio = new Audio();
audio.volume = settings.volume;
const world = new World(document.getElementById('game-root'), tuning);
const hud = new HUD(tuning);

let game = null;
let campaign = new Campaign();
let screen = 'menu'; // 'menu' | 'intro' | 'playing' | 'result' | 'dawn'
let lastOutcome = 'retry';
let yaw = 0;
const keys = new Set();
let pauseQueued = false;
let resumeQueued = false;
let lastCount = -1;
let prevWindWarning = false;
let resultShown = false;

const k = (action) => keys.has(settings.keys[action]);
const captions = new Captions(document.getElementById('hud-captions'), document.getElementById('hud-spawn-arrows'));

/** Large text, reduced motion, captions + every on-screen key label follow the settings. */
function applyA11y() {
  document.documentElement.classList.toggle('large-text', settings.largeText);
  document.body.classList.toggle('reduce-motion', settings.reduceMotion);
  captions.enabled = settings.captions;
  world.reduceMotion = settings.reduceMotion;
  for (const el of document.querySelectorAll('[data-key]')) el.textContent = keyLabel(settings.keys[el.dataset.key]);
  const L = (a) => keyLabel(settings.keys[a]);
  document.getElementById('hud-help').textContent = document.getElementById('pause-help').textContent = `${L('up')}${L('left')}${L('down')}${L('right')} di chuyển · ${L('jump')} nhảy · ${L('dash')} lướt · ${L('interact')} thắp / châm dầu · ${L('pulse')} Tỏa Sáng · chuột hoặc ${L('camLeft')}/${L('camRight')} xoay camera · Esc / ${L('pause')} tạm dừng`;
  document.getElementById('intro-keys').innerHTML = [
    [`${L('up')}${L('left')}${L('down')}${L('right')}`, 'đi'], [L('jump'), 'nhảy'], [L('dash'), 'lướt'], [L('interact'), 'thắp / châm dầu'], [L('pulse'), 'Tỏa Sáng'], ['Chuột', 'xoay camera'],
  ].map(([key, what]) => `<span><kbd>${key}</kbd> ${what}</span>`).join('');
  hud.keyLabel = L;
}

function applyColorblind() {
  document.body.classList.toggle('cb', settings.colorblind);
  world.setColorblind(settings.colorblind);
}
applyColorblind();
applyA11y();

// Backdrop menu: night 1 with every lantern lit, so the menu shows the island at its prettiest.
world.buildNight(1, MAPS[1]);
const menuGame = new Game({ seed: 1, night: 1, tuning, scenario: { random_shades: false, random_drifters: false, lanterns: MAPS[1].lanterns.map((l) => ({ id: l.id, lit: true })) } });

const screens = new Screens({
  audio,
  onPlay() { campaign = new Campaign(); campaign.seed = (Math.random() * 2 ** 31) >>> 0; showIntro(campaign.night); },
  onStart() { startNight(campaign.night); },
  onNext() { showIntro(campaign.night); },
  onRetry() { if (game) startNight(game.night); },
  onMenu() { game = null; screen = 'menu'; world.buildNight(1, MAPS[1]); screens.showMenu(); },
  onResume() { resumeQueued = true; lockPointer(); },
  onRestart() { if (game) startNight(game.night); },
  onSettings(from) { screens.openSettings(from); },
  onSettingsBack() {
    screens.closeSettings();
    if (screens.settingsFrom === 'pause' && screen === 'playing' && game && game.paused) screens.setPause(true);
  },
  onVolume(v) { audio.setVolume(v); },
  onSensitivity() { /* áp dụng trực tiếp qua biến settings.sensitivity */ },
  onColorblind() { applyColorblind(); },
  onA11y() { applyA11y(); },
  onKeysReset() { binder.reset(); },
  async onLeaderboard() {
    screen = 'leaderboard';
    screens.showLeaderboard();
    renderBoard(document.getElementById('lb-table'), await loadBoard());
  },
});
const binder = new KeyBinder(document.getElementById('keybinds'), document.getElementById('bind-msg'), settings, () => { settings.save(); applyA11y(); });
// "Enter your name" after Bình Minh, or after losing any night. Score = total of the nights won so far.
const lbEntry = () => ({ score: campaign.total, nights_won: campaign.results.length, seed: campaign.seed });
wireForm(document.getElementById('lb-form-result'), lbEntry);
wireForm(document.getElementById('lb-form-dawn'), lbEntry);
audio.setVolume(settings.volume);

function showIntro(night) {
  screen = 'intro';
  world.buildNight(night, MAPS[night]);
  const n = MAPS[night].lanterns.length;
  const need = Math.ceil(tuning.win_ratio * n - 1e-9);
  screens.showIntro(night, NIGHT_NAMES[night], ONG_DANG_LINES[night], `Mục tiêu: còn ít nhất ${need}/${n} đèn sáng khi trời sáng · ${tuning[`night${night}_duration_s`] / 60} phút`);
}

function startNight(night) {
  lockPointer();
  if (campaign.seed === undefined) campaign.seed = (Math.random() * 2 ** 31) >>> 0;
  game = new Game({ seed: campaign.seed + night, night, tuning }); // reproducible from the leaderboard's seed
  captions.reset();
  world.buildNight(night, game.map);
  world.prewarm();
  hud.setMap(game.map, game);
  yaw = 0;
  pauseQueued = false;
  resumeQueued = false;
  lastCount = -1;
  prevWindWarning = false;
  resultShown = false;
  screen = 'playing';
  hud.reset();
  screens.showPlaying();
  audio.setPaused(false);
}

function onGameOver() {
  if (document.pointerLockElement) document.exitPointerLock(); // free the cursor for the result buttons
  lastOutcome = campaign.record(game); // 'next' | 'retry' | 'dawn'
  audio.play(game.state === 'won' ? 'win' : 'lose');
  setTimeout(() => {
    if (screen !== 'playing') return;
    if (lastOutcome === 'dawn') {
      screen = 'dawn';
      screens.showDawn(campaign.total, campaign.results);
      resetForm(document.getElementById('lb-form-dawn'), true);
    } else {
      screen = 'result';
      screens.showResult(game, lastOutcome, campaign.total);
      resetForm(document.getElementById('lb-form-result'), lastOutcome === 'retry'); // a loss can be saved
    }
  }, 900);
}

function primaryResultAction() {
  if (lastOutcome === 'next') showIntro(campaign.night);
  else if (game) startNight(game.night);
}

function handleEvents(evs) {
  for (const e of evs) {
    captions.onEvent(e, game);
    switch (e.name) {
      case 'mote_picked': audio.play('mote'); break;
      case 'deposit': audio.play('deposit'); break;
      case 'lantern_out': audio.play('steal'); hud.toast(`Đèn ${e.data.lantern_id} đã tắt!`, 'bad'); break;
      case 'refuel': audio.play('deposit'); hud.toast(`Châm dầu ${e.data.lantern_id} → ${Math.floor(e.data.fuel)}`); break;
      case 'lantern_lit': audio.play('lantern'); hud.toast(e.data.relight ? `Thắp lại ${e.data.lantern_id} · +${tuning.score.per_relight}` : `Thắp sáng ${e.data.lantern_id} · +${tuning.score.per_lantern}`); break;
      case 'pulse': audio.play('pulse'); break;
      case 'player_hit': audio.play('hit'); if (!settings.reduceMotion) { hud.flash(); world.shake(); } hud.toast(e.data.by === 'fall' ? 'Rơi khỏi đảo! −1 Ngọn Lửa' : `−1 Ngọn Lửa${e.data.dropped ? ` · rơi ${e.data.dropped} đom đóm` : ''}`, 'bad'); break;
      case 'shade_spawned': audio.play('spawn'); break;
      case 'dash': audio.play('dash'); break;
      case 'drifter_steal': audio.play('steal'); hud.toast(`Gió Lạc cướp ${e.data.amount} đom đóm!`, 'bad'); break;
      case 'charm_picked': audio.play('charm'); hud.toast('Bùa Gió: chạy nhanh, lướt liên tục 10 s'); break;
      case 'drifter_drop': audio.play('mote'); break;
      case 'paused': case 'resumed': audio.play('ui'); break;
      default: break;
    }
  }
}

// Client-only guard (headless unaffected): topping up a lantern that is above 90 fuel would spend a whole mote
// for less than 10 fuel (ceil rule), which is never what the player wants. Hold the press back in that case.
function refuelWouldWaste(g) {
  const p = g.p.pos;
  const full = tuning.fuel_max * 60;
  let best = null;
  let bd = Infinity;
  for (const l of g.lanterns) {
    if (l.lit && l.fuel >= full) continue;
    const d = Math.hypot(p[0] - l.pos[0], p[2] - l.pos[2]);
    if (d <= tuning.interact_radius + 1e-9 && d < bd - 1e-9) { best = l; bd = d; }
  }
  return !!best && best.lit && best.fuel > full - tuning.fuel_per_mote * 60;
}

// ---------- input ----------
addEventListener('keydown', (e) => {
  if (binder.capturing) return; // the key binder owns the keyboard while waiting for a key
  if (e.target instanceof HTMLInputElement && e.target.type !== 'checkbox' && e.target.type !== 'range') return; // typing a name
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code) || Object.values(settings.keys).includes(e.code)) e.preventDefault();
  if (e.repeat) return;
  keys.add(e.code);
  audio.ensure(); // AudioContext chỉ chạy sau cú chỉ đầu tiên
  if (e.code === 'Escape' || e.code === settings.keys.pause) {
    if (screens.settingsOpen) { screens.closeSettings(); if (screen === 'playing' && game && game.paused) screens.setPause(true); return; }
    if (screen === 'playing' && game) {
      if (game.paused) resumeQueued = true;
      else pauseQueued = true;
    }
  }
  if (e.code === 'Enter' && screen === 'intro') { audio.play('ui'); startNight(campaign.night); }
  if (e.code === 'KeyR' && screen === 'result') primaryResultAction();
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('pointerdown', () => audio.ensure(), { capture: true });

const cv = world.renderer.domElement;
// Mouse look: the night start (or a click on the scene) captures the pointer; any mouse movement turns the camera,
// captured or not, so the camera never "stops responding" while the cursor is free.
const locked = () => document.pointerLockElement === cv;
// requestPointerLock returns a promise in Chrome and rejects (e.g. within ~1 s after Esc); never let that throw.
function lockPointer() {
  if (locked()) return;
  try {
    const p = cv.requestPointerLock();
    if (p && typeof p.catch === 'function') p.catch(() => {});
  } catch { /* not allowed right now: the hint asks for a click */ }
}
cv.addEventListener('pointerdown', () => {
  if (screen === 'playing' && game && !game.paused) lockPointer();
});
addEventListener('pointermove', (e) => {
  if (screen === 'playing' && game && !game.paused) yaw -= e.movementX * 0.09 * settings.sensitivity;
});
// Esc releases the pointer lock before the page sees the key: treat that as "pause".
document.addEventListener('pointerlockchange', () => {
  if (!locked() && screen === 'playing' && game && game.state === 'playing' && !game.paused) pauseQueued = true;
});

// ---------- vòng lặp chính: fixed timestep 60 Hz, render mỗi rAF ----------
let last = performance.now();
let acc = 0;
const perfTimes = [];
window.__perf = { fps: 0 };
// Tiện ích debug/test: window.__app cho phép đọc state từ console headless.
window.__app = { world, get yaw() { return yaw; }, get game() { return game; }, campaign, get screen() { return screen; }, settings };

// Adaptive resolution: if the GPU can't hold ~60 fps, render at a lower resolution (the UI stays sharp);
// raise it again slowly when there is headroom. F3 shows the fps and the current scale.
const fpsEl = document.getElementById('hud-fps');
const lockHint = document.getElementById('hud-lockhint');
let qualityAt = 0;
let goodChecks = 0;
let fpsTextAt = 0;
function adaptQuality(now) {
  if (screen !== 'playing' || (game && game.paused) || now - qualityAt < 1500 || perfTimes.length < 60) return;
  qualityAt = now;
  const fps = window.__perf.fps;
  const cur = world.renderer.getPixelRatio();
  if (fps < 50 && cur > 0.6) {
    world.setPixelRatio(Math.max(0.6, +(cur * 0.8).toFixed(2)));
    goodChecks = 0;
    perfTimes.length = 0; // re-measure at the new resolution
  } else if (fps >= 58 && cur < world.pixelCap && ++goodChecks >= 4) {
    world.setPixelRatio(Math.min(world.pixelCap, +(cur * 1.1).toFixed(2)));
    goodChecks = 0;
    perfTimes.length = 0;
  }
}
addEventListener('keydown', (e) => { if (e.code === 'F3') { e.preventDefault(); fpsEl.classList.toggle('hidden'); } });

function frame(now) {
  requestAnimationFrame(frame);
  adaptQuality(now);
  if (!fpsEl.classList.contains('hidden') && now - fpsTextAt > 500) {
    fpsTextAt = now;
    fpsEl.textContent = `${window.__perf.fps} fps · x${world.renderer.getPixelRatio().toFixed(2)}`;
  }
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 0.25) dt = 0.25;

  perfTimes.push(now);
  if (perfTimes.length > 240) perfTimes.shift();
  if (perfTimes.length > 30) {
    window.__perf.fps = Math.round(((perfTimes.length - 1) * 1000) / (now - perfTimes[0]) * 10) / 10;
  }

  if (screen === 'playing' && game) {
    if (k('camLeft')) yaw += 80 * dt * settings.sensitivity;
    if (k('camRight')) yaw -= 80 * dt * settings.sensitivity;

    const input = {
      move: [(k('left') ? 1 : 0) - (k('right') ? 1 : 0), (k('up') ? 1 : 0) - (k('down') ? 1 : 0)],
      cam_yaw_deg: yaw,
      jump: k('jump'),
      interact: k('interact') && !refuelWouldWaste(game),
      pulse: k('pulse'),
      dash: k('dash'),
      pause: false,
    };

    if (!game.paused) {
      if (pauseQueued) { input.pause = true; pauseQueued = false; } // chỉ đúng 1 tick
      acc += dt;
      let steps = 0;
      while (acc >= 1 / TICK_RATE && steps < 5) {
        game.step(input);
        input.pause = false;
        acc -= 1 / TICK_RATE;
        steps++;
        handleEvents(game.drainEvents());
      }
      if (steps === 5) acc = 0; // bỏ bớt thời gian khi máy quá chậm

      // đếm ngược 10 giây cuối
      const tl = game.timeLeft;
      if (tl <= 10.5) {
        const c = Math.ceil(tl);
        if (c !== lastCount && c >= 1) { lastCount = c; audio.play('tick'); }
      }
      // tiếng gió rú khi cảnh báo gió (đêm 3)
      if (game.wind.warning && !prevWindWarning) audio.play('whoosh');
      prevWindWarning = !!game.wind.warning;

      world.sync(game, dt, now / 1000);
      world.updateCamera(game.p.pos, yaw, dt);
      hud.update(game, (x, y, z) => world.project(x, y, z), yaw);
      captions.update(game, (x, y, z) => world.project(x, y, z));
      if (game.state !== 'playing' && !resultShown) { resultShown = true; onGameOver(); }
    } else {
      // đang tạm dừng: logic đứng hình, chỉ cần bắt cạnh resume
      if (resumeQueued) {
        game.step({ ...input, pause: false }); // clear the held-button state so the next press is a rising edge
        game.step({ ...input, pause: true });
        resumeQueued = false;
        handleEvents(game.drainEvents());
      }
      world.sync(game, 0, world.lastT);
      hud.update(game, (x, y, z) => world.project(x, y, z), yaw);
    }
    lockHint.classList.toggle('hidden', game.paused || locked() || game.state !== 'playing');
    screens.setPause(game.paused && !screens.settingsOpen);
    if (game.paused && document.pointerLockElement) document.exitPointerLock();
    audio.setPaused(game.paused);
  } else {
    // menu / intro / result / dawn: camera quay chậm trên nền thế giới
    if (screen === 'menu' || screen === 'leaderboard') world.sync(menuGame, 0, now / 1000);
    world.menuCam(now / 1000);
  }

  world.render();
}

const qs = new URLSearchParams(location.search);
if (qs.get('bench')) {
  // Benchmark scene (scripts/bench.mjs): no menus, no input, no adaptive resolution.
  screens.showPlaying();
  runBench({ world, hud, tuning, seed: Number(qs.get('seed') ?? 42), duration: Number(qs.get('duration') ?? 30), t0: Number(qs.get('t0')) || null });
} else {
  if (devNight >= 1 && devNight <= 3) {
    campaign.night = devNight;
    showIntro(devNight);
  } else {
    screens.showMenu();
  }
  requestAnimationFrame(frame);
}
