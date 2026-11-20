// Entry point của client: flow màn hình, input, vòng lặp fixed-timestep 60 Hz, sự kiện sim -> audio/fx.
import { Game, TICK_RATE } from '/src/sim.js';
import { MAPS, NIGHT_NAMES } from '/src/maps.js';
import { Campaign } from '/src/campaign.js';
import { World } from '/web/world.js';
import { HUD } from '/web/hud.js';
import { Audio } from '/web/audio.js';
import { Screens, settings, ONG_DANG_LINES } from '/web/ui.js';

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

// Backdrop menu: dựng sẵn đêm 1 để quay camera phía sau menu.
world.buildNight(1, MAPS[1]);

const screens = new Screens({
  audio,
  onPlay() { campaign = new Campaign(); showIntro(campaign.night); },
  onStart() { startNight(campaign.night); },
  onNext() { showIntro(campaign.night); },
  onRetry() { if (game) startNight(game.night); },
  onMenu() { game = null; screen = 'menu'; screens.showMenu(); },
  onResume() { resumeQueued = true; try { world.renderer.domElement.requestPointerLock(); } catch { /* ignore */ } },
  onRestart() { if (game) startNight(game.night); },
  onSettings(from) { screens.openSettings(from); },
  onSettingsBack() {
    screens.closeSettings();
    if (screens.settingsFrom === 'pause' && screen === 'playing' && game && game.paused) screens.setPause(true);
  },
  onVolume(v) { audio.setVolume(v); },
  onSensitivity() { /* áp dụng trực tiếp qua biến settings.sensitivity */ },
});
audio.setVolume(settings.volume);

function showIntro(night) {
  screen = 'intro';
  world.buildNight(night, MAPS[night]);
  screens.showIntro(night, NIGHT_NAMES[night], ONG_DANG_LINES[night]);
}

function startNight(night) {
  game = new Game({ seed: (Math.random() * 2 ** 31) >>> 0, night, tuning });
  world.buildNight(night, game.map);
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
  lastOutcome = campaign.record(game); // 'next' | 'retry' | 'dawn'
  audio.play(game.state === 'won' ? 'win' : 'lose');
  setTimeout(() => {
    if (screen !== 'playing') return;
    if (lastOutcome === 'dawn') {
      screen = 'dawn';
      screens.showDawn(campaign.total, campaign.results);
    } else {
      screen = 'result';
      screens.showResult(game, lastOutcome, campaign.total);
    }
  }, 900);
}

function primaryResultAction() {
  if (lastOutcome === 'next') showIntro(campaign.night);
  else if (game) startNight(game.night);
}

function handleEvents(evs) {
  for (const e of evs) {
    switch (e.name) {
      case 'mote_picked': audio.play('mote'); break;
      case 'deposit': audio.play('deposit'); break;
      case 'lantern_lit': audio.play('lantern'); break;
      case 'pulse': audio.play('pulse'); break;
      case 'player_hit': audio.play('hit'); hud.flash(); break;
      case 'shade_spawned': audio.play('spawn'); break;
      case 'dash': audio.play('dash'); break;
      case 'charm_picked': audio.play('charm'); break;
      case 'drifter_steal': audio.play('steal'); break;
      case 'drifter_drop': audio.play('mote'); break;
      case 'paused': case 'resumed': audio.play('ui'); break;
      default: break;
    }
  }
}

// ---------- input ----------
addEventListener('keydown', (e) => {
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
  if (e.repeat) return;
  keys.add(e.code);
  audio.ensure(); // AudioContext chỉ chạy sau cú chỉ đầu tiên
  if (e.code === 'Escape' || e.code === 'KeyP') {
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
// Mouse look: click the scene to capture the pointer, then moving the mouse turns the camera.
// (Dragging still works if the browser refuses pointer lock.)
const locked = () => document.pointerLockElement === cv;
let dragging = false;
cv.addEventListener('pointerdown', (e) => {
  if (screen === 'playing' && game && !game.paused && !locked()) {
    try { cv.requestPointerLock(); } catch { /* fall back to drag */ }
  }
  dragging = true;
  try { cv.setPointerCapture(e.pointerId); } catch { /* ignore */ }
});
addEventListener('pointermove', (e) => {
  if ((locked() || dragging) && screen === 'playing' && game && !game.paused) yaw -= e.movementX * 0.09 * settings.sensitivity;
});
addEventListener('pointerup', () => { dragging = false; });
// Esc releases the pointer lock before the page sees the key: treat that as "pause".
document.addEventListener('pointerlockchange', () => {
  if (!locked() && screen === 'playing' && game && !game.paused) pauseQueued = true;
});

// ---------- vòng lặp chính: fixed timestep 60 Hz, render mỗi rAF ----------
let last = performance.now();
let acc = 0;
const perfTimes = [];
window.__perf = { fps: 0 };
// Tiện ích debug/test: window.__app cho phép đọc state từ console headless.
window.__app = { world, get game() { return game; }, campaign, get screen() { return screen; }, settings };

function frame(now) {
  requestAnimationFrame(frame);
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 0.25) dt = 0.25;

  perfTimes.push(now);
  if (perfTimes.length > 240) perfTimes.shift();
  if (perfTimes.length > 30) {
    window.__perf.fps = Math.round(((perfTimes.length - 1) * 1000) / (now - perfTimes[0]) * 10) / 10;
  }

  if (screen === 'playing' && game) {
    if (keys.has('KeyQ')) yaw += 80 * dt * settings.sensitivity;
    if (keys.has('KeyZ')) yaw -= 80 * dt * settings.sensitivity;

    const input = {
      move: [
        (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0) + (keys.has('KeyD') || keys.has('ArrowRight') ? -1 : 0),
        (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) + (keys.has('KeyS') || keys.has('ArrowDown') ? -1 : 0),
      ],
      cam_yaw_deg: yaw,
      jump: keys.has('Space'),
      interact: keys.has('KeyE'),
      pulse: keys.has('KeyF'),
      dash: keys.has('ShiftLeft') || keys.has('ShiftRight'),
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
      hud.update(game, (x, y, z) => world.project(x, y, z));
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
      hud.update(game, (x, y, z) => world.project(x, y, z));
    }
    screens.setPause(game.paused && !screens.settingsOpen);
    if (game.paused && document.pointerLockElement) document.exitPointerLock();
    audio.setPaused(game.paused);
  } else {
    // menu / intro / result / dawn: camera quay chậm trên nền thế giới
    world.menuCam(now / 1000);
  }

  world.render();
}

if (devNight >= 1 && devNight <= 3) {
  campaign.night = devNight;
  showIntro(devNight);
} else {
  screens.showMenu();
}
requestAnimationFrame(frame);
