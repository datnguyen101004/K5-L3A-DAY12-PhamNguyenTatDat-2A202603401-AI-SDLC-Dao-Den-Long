// Màn hình (menu / intro / kết quả / bình minh / tạm dừng / cài đặt) + cài đặt lưu localStorage.
export const ONG_DANG_LINES = {
  1: 'Đêm nay trời quang mây tía, Mây ạ. Thắp sáng năm ngọn đèn trên Đảo Bến trước khi đồng hồ cát cạn nhé!',
  2: 'Cây cầu tre tuy mảnh mà vững, cháu cứ đi thong thả. Nhớ canh chừng Gió Lạc — nó hay đánh cắp ánh sáng đấy.',
  3: 'Chuông đã im bao năm rồi, nhưng chỉ cần đèn tháp sáng lên là trăng lại mỉm cười. Coi chừng cơn gió lớn sắp tới nhé!',
};

export const settings = {
  volume: 0.8, // 0..1
  sensitivity: 1.0, // hệ số độ nhạy chuột
  load() {
    try {
      const s = JSON.parse(localStorage.getItem('ddl.settings') || 'null');
      if (s) {
        if (typeof s.volume === 'number') this.volume = Math.min(1, Math.max(0, s.volume));
        if (typeof s.sensitivity === 'number') this.sensitivity = Math.min(3, Math.max(0.2, s.sensitivity));
      }
    } catch { /* bỏ qua */ }
  },
  save() {
    try { localStorage.setItem('ddl.settings', JSON.stringify({ volume: this.volume, sensitivity: this.sensitivity })); } catch { /* bỏ qua */ }
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
    this.screens = { menu: $('screen-menu'), intro: $('screen-intro'), result: $('screen-result'), dawn: $('screen-dawn'), pause: $('screen-pause'), settings: $('screen-settings') };
    $('btn-play').addEventListener('click', () => { h.audio.play('ui'); h.onPlay(); });
    $('btn-settings').addEventListener('click', () => { h.audio.play('ui'); h.onSettings('menu'); });
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
  }

  _show(name) {
    for (const k of ['menu', 'intro', 'result', 'dawn']) this.screens[k].classList.toggle('hidden', k !== name);
    if (!name) for (const k of ['menu', 'intro', 'result', 'dawn']) this.screens[k].classList.add('hidden');
  }

  showMenu() { this._show('menu'); this.hud.classList.add('hidden'); this.setPause(false); }
  showIntro(night, name, line) {
    this._show('intro');
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
    const reason = won
      ? 'Tất cả đèn lồng đã được thắp sáng!'
      : game.state === 'lost' && game.p.flames <= 0
        ? 'Mây đã hết ngọn lửa trên người...'
        : 'Trời đã rạng đông mà đèn vẫn chưa đủ sáng.';
    document.getElementById('result-reason').textContent = reason;
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
