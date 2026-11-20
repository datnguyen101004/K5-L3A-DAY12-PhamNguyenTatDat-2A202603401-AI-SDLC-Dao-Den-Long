// Local leaderboard rules (Ticket-04 §3). Pure: shared by server.js (disk store, export) and the browser fallback.
export const MAX_ENTRIES = 10;

// Vietnamese letters, checked on the canonical decomposition: a vowel with an optional shape mark (â ê ô / ă / ơ ư)
// and an optional tone mark (grave, acute, tilde, hook above, dot below), plus đ/Đ. Tones never sit on consonants
// (so Ñ is refused).
const TONE = '[\\u0300\\u0301\\u0303\\u0309\\u0323]?';
const VI_CHAR = new RegExp(`^(?:[A-Za-z0-9_]|[đĐ]|(?:[AaEeOo]\\u0302|[Aa]\\u0306|[OoUu]\\u031B|[AEIOUYaeiouy])${TONE})$`);

/** 3-12 characters of [A-Za-z0-9_] plus Vietnamese letters. Returns the NFC name or null. */
export function normalizeName(raw) {
  if (typeof raw !== 'string') return null;
  const name = raw.trim().normalize('NFC');
  const chars = [...name];
  if (chars.length < 3 || chars.length > 12) return null;
  return chars.every((c) => VI_CHAR.test(c.normalize('NFD'))) ? name : null;
}

/** ISO 8601 with the local UTC offset, e.g. 2026-11-20T15:01:02+07:00. */
export function isoLocal(d = new Date()) {
  const p = (n) => String(Math.abs(n)).padStart(2, '0');
  const off = -d.getTimezoneOffset();
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}${off >= 0 ? '+' : '-'}${p(Math.trunc(off / 60))}:${p(off % 60)}`;
}

const ISO_TZ = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

/** Validates and normalises one entry; throws Error with a readable message. */
export function makeEntry({ name, score, nights_won, achieved_at, seed }) {
  const n = normalizeName(name);
  if (!n) throw new Error('Tên cần 3-12 ký tự: chữ cái (có dấu được), số hoặc _');
  if (!Number.isInteger(score) || score < 0) throw new Error('score must be an integer >= 0');
  if (!Number.isInteger(nights_won) || nights_won < 0 || nights_won > 3) throw new Error('nights_won must be 0-3');
  if (typeof achieved_at !== 'string' || !ISO_TZ.test(achieved_at) || Number.isNaN(Date.parse(achieved_at))) throw new Error('achieved_at must be ISO 8601 with a timezone');
  if (!Number.isInteger(seed)) throw new Error('seed must be an integer');
  return { name: n, score, nights_won, achieved_at, seed };
}

/** Score descending; equal scores: whoever reached it first (earlier achieved_at) ranks higher. Keeps top 10. */
export function rank(entries) {
  return entries
    .map((e, i) => [e, i])
    .sort(([a, ia], [b, ib]) => b.score - a.score || Date.parse(a.achieved_at) - Date.parse(b.achieved_at) || ia - ib)
    .slice(0, MAX_ENTRIES)
    .map(([e]) => e);
}

/** Adds an entry; returns { entries, position } where position is 1-based or null if it did not make the top 10. */
export function insert(entries, entry) {
  const e = makeEntry(entry);
  const next = rank([...entries, e]);
  const idx = next.indexOf(e);
  return { entries: next, position: idx < 0 ? null : idx + 1 };
}

/** Parses a stored file leniently: drops malformed rows instead of losing the whole board. */
export function parseStore(text) {
  try {
    const data = JSON.parse(text);
    const rows = Array.isArray(data?.entries) ? data.entries : [];
    const ok = [];
    for (const r of rows) {
      try {
        ok.push(makeEntry(r));
      } catch {
        /* skip a bad row */
      }
    }
    return rank(ok);
  } catch {
    return [];
  }
}
