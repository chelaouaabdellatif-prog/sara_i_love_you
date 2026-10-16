export const LETTERS = 'ABCDEFGH';
export const HISTORY_KEY = 'qcm-sara-history';

export const MODULES = [
  'Pharmacologie',
  'Pharmacie galénique',
  'Chimie analytique',
  'Chimie thérapeutique',
  'Biochimie',
  'Microbiologie',
  'Parasitologie',
  'Hématologie',
  'Immunologie',
  'Toxicologie',
  'Pharmacognosie',
  'Botanique',
  'Physiologie',
  'Biophysique',
  'Législation pharmaceutique',
];

export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function formatTime(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const pad = (n) => String(n).padStart(2, '0');
  return h ? `${h}:${pad(m)}:${pad(s % 60)}` : `${pad(m)}:${pad(s % 60)}`;
}

export const sameSet = (a, b) => a.length === b.length && a.every((x) => b.includes(x));

export const newId = () =>
  globalThis.crypto?.randomUUID?.() ?? Date.now().toString(36) + Math.random().toString(36).slice(2);

export function daysUntil(dateStr) {
  if (!dateStr) return null;
  const target = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(target.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target - today) / 86400000);
}

export const moduleOf = (q) => q.module?.trim() || 'Général';

export function countByModule(questions) {
  const counts = new Map();
  questions.forEach((q) => counts.set(moduleOf(q), (counts.get(moduleOf(q)) || 0) + 1));
  return [...counts].map(([name, count]) => ({ name, count })).sort((a, b) => a.name.localeCompare(b.name));
}

// localStorage peut être bloqué (navigation privée) : on ne plante jamais.
export const storage = {
  get(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* stockage indisponible */
    }
  },
};
