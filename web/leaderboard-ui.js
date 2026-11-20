// Leaderboard in the browser: the server keeps it on disk (data/leaderboard.json); if the page is served by a plain
// static host (no /api), the same rules run against localStorage so the feature still works.
import { insert, parseStore, isoLocal, normalizeName } from '/src/leaderboard.js';

const LOCAL = 'ddl.leaderboard';

async function serverCall(method, body) {
  const r = await fetch('/api/leaderboard', { method, body: body && JSON.stringify(body), headers: body ? { 'Content-Type': 'application/json' } : undefined });
  const data = await r.json();
  if (!r.ok) throw Object.assign(new Error(data.error || 'error'), { user: true });
  return data;
}

export async function loadBoard() {
  try {
    return (await serverCall('GET')).entries;
  } catch {
    return parseStore(localStorage.getItem(LOCAL) || '{}');
  }
}

export async function saveScore(entry) {
  try {
    return await serverCall('POST', entry);
  } catch (e) {
    if (e.user) throw e; // validation error from the server
    const res = insert(parseStore(localStorage.getItem(LOCAL) || '{}'), entry);
    localStorage.setItem(LOCAL, JSON.stringify({ entries: res.entries }));
    return res;
  }
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export function renderBoard(tableEl, entries, highlight = null) {
  if (!entries.length) {
    tableEl.innerHTML = '<tr><td colspan="5" class="empty">Chưa có ai. Hãy là người đầu tiên!</td></tr>';
    return;
  }
  tableEl.innerHTML =
    '<tr><th>#</th><th>Tên</th><th>Điểm</th><th>Đêm thắng</th><th>Ngày</th></tr>' +
    entries
      .map((e, i) => `<tr class="${highlight === i + 1 ? 'me' : ''}"><td>${i + 1}</td><td>${esc(e.name)}</td><td>${e.score}</td><td>${e.nights_won}/3</td><td>${esc(e.achieved_at.slice(0, 10))}</td></tr>`)
      .join('');
}

/** Wires one "enter your name" form. getEntry() -> {score, nights_won, seed}. */
export function wireForm(form, getEntry, onSaved) {
  const input = form.querySelector('input');
  const btn = form.querySelector('button');
  const msg = form.querySelector('.lb-msg');
  input.addEventListener('input', () => {
    const ok = normalizeName(input.value) !== null;
    msg.textContent = ok || !input.value ? '' : '3-12 ký tự: chữ (có dấu), số hoặc _';
    msg.classList.toggle('bad', !ok && !!input.value);
  });
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const name = normalizeName(input.value);
    if (!name) {
      msg.textContent = 'Tên cần 3-12 ký tự: chữ (có dấu), số hoặc _';
      msg.classList.add('bad');
      return;
    }
    btn.disabled = true;
    try {
      const res = await saveScore({ name, ...getEntry(), achieved_at: isoLocal() });
      msg.classList.remove('bad');
      msg.textContent = res.position ? `Đã lưu! Hạng ${res.position} trên bảng xếp hạng.` : 'Đã lưu, nhưng chưa đủ điểm vào top 10.';
      form.classList.add('saved');
      onSaved?.(res);
    } catch (e) {
      msg.textContent = e.message;
      msg.classList.add('bad');
      btn.disabled = false;
    }
  });
}

export function resetForm(form, show) {
  form.classList.toggle('hidden', !show);
  form.classList.remove('saved');
  form.querySelector('button').disabled = false;
  form.querySelector('.lb-msg').textContent = '';
}
