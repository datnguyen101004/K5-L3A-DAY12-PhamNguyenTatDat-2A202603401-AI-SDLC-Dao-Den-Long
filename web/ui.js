// Màn hình (menu / intro / kết quả / bình minh / bảng xếp hạng / tạm dừng / cài đặt) + cài đặt lưu localStorage.
import { DEFAULT_KEYS } from '/web/a11y.js';
export const ONG_DANG_LINES = {
  1: 'Đèn rồi cũng cạn dầu, Mây ạ. Giữ cho ít nhất ba trong năm ngọn đèn trên Đảo Bến còn sáng đến bình minh. Bóng Mực sẽ lần tới những ngọn đèn yếu để hút dầu đấy!',
  2: 'Cây cầu tre tuy mảnh mà vững, cháu cứ đi thong thả. Cần giữ sáng bốn trong sáu ngọn đèn, và canh chừng Gió Lạc, nó hay đánh cắp ánh sáng.',
  3: 'Chuông đã im bao năm rồi. Năm trong bảy ngọn đèn phải sáng đến rạng đông. Đèn nào sắp tắt thì châm thêm đom đóm cho nó, và coi chừng cơn gió lớn nhé!',
};

export const settings = {
  volume: 0.8, // 0..1
  sensitivity: 1.0, // hệ số độ nhạy chuột
  colorblind: false, // bảng màu dễ phân biệt
  captions: true, // phụ đề + chỉ báo hình ảnh
  reduceMotion: typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches,
  largeText: false, // chữ ×1.25
  keys: { ...DEFAULT_KEYS },
  load() {
    try {
      const s = JSON.parse(localStorage.getItem('ddl.settings') || 'null');
      if (s) {
        if (typeof s.volume === 'number') this.volume = Math.min(1, Math.max(0, s.volume));
        if (typeof s.sensitivity === 'number') this.sensitivity = Math.min(3, Math.max(0.2, s.sensitivity));
        if (typeof s.colorblind === 'boolean') this.colorblind = s.colorblind;
        for (const k of ['captions', 'reduceMotion', 'largeText']) if (typeof s[k] === 'boolean') this[k] = s[k];
        if (s.keys && typeof s.keys === 'object') for (const a of Object.keys(DEFAULT_KEYS)) if (typeof s.keys[a] === 'string') this.keys[a] = s.keys[a];
      }
    } catch { /* bỏ qua */ }
  },
  save() {
    try { localStorage.setItem('ddl.settings', JSON.stringify({ volume: this.volume, sensitivity: this.sensitivity, colorblind: this.colorblind, captions: this.captions, reduceMotion: this.reduceMotion, largeText: this.largeText, keys: this.keys })); } catch { /* bỏ qua */ }
  },
};

export class Screens {
  /** handlers: {onPlay, onStart, onNext, onRetry, onMenu, onResume, onRestart, onSettings, onSettingsBack, onVolume, onSensitivity, audio} */
  constructor(h) {
    this.h = h;
    this.settingsOpen = false;
    this.settingsFrom = 'menu';
    const $ = (id) => document.getElementById(id);
    this.hud = $('hud');
    this.screens = { menu: $('screen-menu'), intro: $('screen-intro'), result: $('screen-result'), dawn: $('screen-dawn'), leaderboard: $('screen-leaderboard'), pause: $('screen-pause'), settings: $('screen-settings') };
    $('btn-play').addEventListener('click', () => { h.audio.play('ui'); h.onPlay(); });
    $('btn-settings').addEventListener('click', () => { h.audio.play('ui'); h.onSettings('menu'); });
    $('btn-leaderboard').addEventListener('click', () => { h.audio.play('ui'); h.onLeaderboard(); });
    $('btn-lb-back').addEventListener('click', () => { h.audio.play('ui'); h.onMenu(); });
    for (const [id, key] of [['set-captions', 'captions'], ['set-motion', 'reduceMotion'], ['set-large', 'largeText']]) {
      $(id).addEventListener('change', () => { settings[key] = $(id).checked; settings.save(); h.onA11y(); });
    }
    $('btn-keys-reset').addEventListener('click', () => { h.audio.play('ui'); h.onKeysReset(); });
    $('btn-start').addEventListener('click', () => { h.audio.play('ui'); h.onStart(); });
    $('btn-next').addEventListener('click', () => { h.audio.play('ui'); h.onNext(); });
    $('btn-retry').addEventListener('click', () => { h.audio.play('ui'); h.onRetry(); });
    $('btn-tomenu').addEventListener('click', () => { h.audio.play('ui'); h.onMenu(); });
    $('btn-dawn-menu').addEventListener('click', () => { h.audio.play('ui'); h.onMenu(); });
    $('btn-resume').addEventListener('click', () => { h.audio.play('ui'); h.onResume(); });
    $('btn-restart').addEventListener('click', () => { h.audio.play('ui'); h.onRestart(); });
    $('btn-pause-settings').addEventListener('click', () => { h.audio.play('ui'); h.onSettings('pause'); });
    $('btn-pause-menu').addEventListener('click', () => { h.audio.play('ui'); h.onMenu(); });
    $('btn-settings-back').addEventListener('click', () => { h.audio.play('ui'); h.onSettingsBack(); });

    this.cbBox = $('set-cb');
    this.cbBox.addEventListener('change', () => {
      settings.colorblind = this.cbBox.checked;
      settings.save();
      h.onColorblind(settings.colorblind);
    });
    this.volSlider = $('set-volume');
    this.sensSlider = $('set-sens');
    this.volVal = $('vol-val');
    this.sensVal = $('sens-val');
    this.volSlider.addEventListener('input', () => {
      settings.volume = this.volSlider.value / 100;
      settings.save();
      this.volVal.textContent = this.volSlider.value + '%';
      h.onVolume(settings.volume);
    });
    this.sensSlider.addEventListener('input', () => {
      settings.sensitivity = this.sensSlider.value / 100;
      settings.save();
      this.sensVal.textContent = 'x' + settings.sensitivity.toFixed(2);
      h.onSensitivity(settings.sensitivity);
    });
  }

  syncSettingsSliders() {
    this.volSlider.value = String(Math.round(settings.volume * 100));
    this.sensSlider.value = String(Math.round(settings.sensitivity * 100));
    this.volVal.textContent = Math.round(settings.volume * 100) + '%';
    this.sensVal.textContent = 'x' + settings.sensitivity.toFixed(2);
    this.cbBox.checked = settings.colorblind;
    document.getElementById('set-captions').checked = settings.captions;
    document.getElementById('set-motion').checked = settings.reduceMotion;
    document.getElementById('set-large').checked = settings.largeText;
  }

  _show(name) {
    for (const k of ['menu', 'intro', 'result', 'dawn', 'leaderboard']) this.screens[k].classList.toggle('hidden', k !== name);
    if (!name) for (const k of ['menu', 'intro', 'result', 'dawn', 'leaderboard']) this.screens[k].classList.add('hidden');
  }

  showMenu() { this._show('menu'); this.hud.classList.add('hidden'); this.setPause(false); }
  showIntro(night, name, line, goal) {
    this._show('intro');
    document.getElementById('intro-goal').textContent = goal;
    this.hud.classList.add('hidden');
    document.getElementById('intro-title').textContent = `Đêm ${night} · ${name}`;
    document.getElementById('intro-line').textContent = `“${line}”`;
  }
  showPlaying() {
    this._show(null);
    this.hud.classList.remove('hidden');
    this.setPause(false);
    this.closeSettings();
  }
  showResult(game, outcome, total) {
    this._show('result');
    this.hud.classList.add('hidden');
    this.setPause(false);
    const won = game.state === 'won';
    document.getElementById('result-title').textContent = won ? 'Đêm đã sáng rực!' : 'Màn đêm giành lại...';
    const n = game.lanterns.length;
    const lit = game.lanterns.filter((l) => l.lit).length;
    const need = Math.ceil(game.t.win_ratio * n - 1e-9);
    const reason = won
      ? `Bình minh đến và ${lit}/${n} ngọn đèn vẫn còn sáng. Đảo được cứu!`
      : game.p.flames <= 0
        ? 'Mây đã hết ngọn lửa trên người...'
        : `Trời đã rạng đông mà chỉ còn ${lit}/${n} đèn sáng (cần ${need}).`;
    document.getElementById('result-reason').textContent = reason;
    document.getElementById('result-stats').innerHTML =
      `<div><b>${lit}/${n}</b>đèn đang sáng (cần ${need})</div><div><b>${Math.max(0, game.p.flames)}</b>Ngọn Lửa còn lại</div>`;
    document.getElementById('result-score').textContent = `Điểm đêm ${game.night}: ${game.score}`;
    document.getElementById('result-total').textContent = `Tổng điểm tích lũy: ${total}`;
    document.getElementById('btn-next').classList.toggle('hidden', outcome !== 'next');
    document.getElementById('btn-retry').classList.toggle('hidden', outcome !== 'retry');
  }
  showDawn(total, results) {
    this._show('dawn');
    this.hud.classList.add('hidden');
    this.setPause(false);
    const lines = results.map((r) => `Đêm ${r.night}: ${r.score} điểm`).join(' · ');
    document.getElementById('dawn-text').textContent =
      `Ba đêm đã qua, ${lines}. Ánh sáng của cháu đã xua tan bóng tối — cảm ơn Mây!`;
    document.getElementById('dawn-total').textContent = `Tổng điểm: ${total}`;
  }
  showLeaderboard() { this._show('leaderboard'); this.hud.classList.add('hidden'); this.setPause(false); }
  setPause(v) { this.screens.pause.classList.toggle('hidden', !v); }
  openSettings(from) {
    this.settingsOpen = true;
    this.settingsFrom = from;
    this.syncSettingsSliders();
    this.screens.settings.classList.remove('hidden');
  }
  closeSettings() {
    this.settingsOpen = false;
    this.screens.settings.classList.add('hidden');
  }
}
