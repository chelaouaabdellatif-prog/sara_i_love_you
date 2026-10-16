import { SEED_QUESTIONS } from './seed.js';

const LOCAL_KEY = 'qcm-pharma-local-data';
export const DEFAULT_SETTINGS = { secondsPerQuestion: 90, examDate: '2026-10-19' };

// En développement (npm run dev) il n'y a pas de serveur Cloudflare :
// les données sont alors gardées dans le navigateur (mode local, sans mot de passe).
let localMode = false;
export const isLocalMode = () => localMode;

export class AuthError extends Error {}

function normalize(data, role) {
  return {
    questions: Array.isArray(data?.questions) ? data.questions : SEED_QUESTIONS,
    settings: { ...DEFAULT_SETTINGS, ...(data?.settings || {}) },
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
