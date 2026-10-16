import { SEED_QUESTIONS } from './seed.js';

const LOCAL_KEY = 'qcm-pharma-local-data';
export const DEFAULT_SETTINGS = {
  secondsPerQuestion: 90,
  examDate: '2026-10-19',
  theme: 'bleu-rose',
  banner: {
    enabled: true,
    text: 'Résidanat pharmacie — lundi 19 octobre à Alger. Bon courage Sara !',
    link: '',
    linkLabel: '',
    style: 'degrade',
  },
};

// En développement (npm run dev) il n'y a pas de serveur Cloudflare :
// les données sont alors gardées dans le navigateur (mode local, sans mot de passe).
let localMode = false;
export const isLocalMode = () => localMode;

export class AuthError extends Error {}

function normalize(data, role) {
  return {
    questions: Array.isArray(data?.questions) ? data.questions : SEED_QUESTIONS,
    settings: {
      ...DEFAULT_SETTINGS,
      ...(data?.settings || {}),
      banner: { ...DEFAULT_SETTINGS.banner, ...(data?.settings?.banner || {}) },
    },
    role,
  };
}

function readLocal() {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// Renvoie { questions, settings, role } où role vaut 'sara' ou 'admin'.
// Lance AuthError si le mot de passe est faux.
export async function loadData(password) {
  let res;
  try {
    res = await fetch('/api/data', { headers: { accept: 'application/json', 'x-password': password || '' } });
    const isJson = (res.headers.get('content-type') || '').includes('application/json');
    if (!isJson) throw new Error('API indisponible');
  } catch (err) {
    if (!import.meta.env.DEV) throw err;
    localMode = true;
    return normalize(readLocal(), 'admin');
  }
  const body = await res.json();
  if (res.status === 401) throw new AuthError(body.error || 'Mot de passe incorrect.');
  if (!res.ok) throw new Error(body.error || `Erreur ${res.status}`);
  localMode = false;
  return normalize(body, body.role);
}

export async function saveData(data, password) {
  const payload = { questions: data.questions, settings: data.settings };
  if (localMode) {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(payload));
    return;
  }
  const res = await fetch('/api/data', {
    method: 'PUT',
    headers: { 'content-type': 'application/json', 'x-password': password },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Erreur ${res.status}`);
  }
}

/* ---------- Résultats des tests, rangés par jour ---------- */

const LOCAL_RESULTS_KEY = 'qcm-local-results';

// Date du jour à Alger, au format AAAA-MM-JJ.
export const todayInAlgiers = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Algiers' });

function readLocalResults() {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_RESULTS_KEY)) || {};
  } catch {
    return {};
  }
}

function daySummary(sessions) {
  return sessions.reduce(
    (s, x) => ({ count: s.count + 1, score: s.score + x.score, total: s.total + x.total, seconds: s.seconds + x.seconds }),
    { count: 0, score: 0, total: 0, seconds: 0 },
  );
}

async function resultsRequest(password, { method = 'GET', query = '', body } = {}) {
  const res = await fetch(`/api/results${query}`, {
    method,
    headers: { 'content-type': 'application/json', 'x-password': password || '' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`);
  return data;
}

export async function saveResult(password, day, session) {
  if (localMode) {
    const all = readLocalResults();
    all[day] = [...(all[day] || []), { ...session, id: newLocalId() }];
    localStorage.setItem(LOCAL_RESULTS_KEY, JSON.stringify(all));
    return;
  }
  await resultsRequest(password, { method: 'POST', body: { day, session } });
}

export async function loadResultDays(password) {
  if (localMode) {
    return Object.entries(readLocalResults())
      .filter(([, sessions]) => sessions.length)
      .map(([day, sessions]) => ({ day, ...daySummary(sessions) }))
      .sort((a, b) => b.day.localeCompare(a.day));
  }
  return (await resultsRequest(password)).days;
}

export async function loadResultDay(password, day) {
  if (localMode) return readLocalResults()[day] || [];
  return (await resultsRequest(password, { query: `?day=${encodeURIComponent(day)}` })).sessions;
}

export async function deleteResult(password, day, id) {
  if (localMode) {
    const all = readLocalResults();
    all[day] = (all[day] || []).filter((s) => s.id !== id);
    localStorage.setItem(LOCAL_RESULTS_KEY, JSON.stringify(all));
    return;
  }
  await resultsRequest(password, {
    method: 'DELETE',
    query: `?day=${encodeURIComponent(day)}&id=${encodeURIComponent(id)}`,
  });
}

const newLocalId = () => Date.now().toString(36) + Math.random().toString(36).slice(2);
