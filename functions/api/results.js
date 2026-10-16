// Résultats des tests, rangés par jour (une clé KV par date : "results:2026-10-16").
// GET    /api/results             -> liste des jours avec un résumé
// GET    /api/results?day=AAAA-MM-JJ -> tests de ce jour, avec le détail des réponses
// POST   /api/results             -> enregistre un test { day, session } (Sara ou admin)
// DELETE /api/results?day=…&id=…  -> supprime un test (admin)
const PREFIX = 'results:';
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const NO_KV = 'Le stockage KV "QCM_KV" n’est pas configuré sur Cloudflare.';

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });

function roleOf(request, env) {
  const pw = request.headers.get('x-password') || '';
  if (env.ADMIN_PASSWORD && pw === env.ADMIN_PASSWORD) return 'admin';
  if (!env.SARA_PASSWORD || pw === env.SARA_PASSWORD) return 'sara';
  return null;
}

function summary(sessions) {
  return sessions.reduce(
    (s, x) => ({ count: s.count + 1, score: s.score + x.score, total: s.total + x.total, seconds: s.seconds + x.seconds }),
    { count: 0, score: 0, total: 0, seconds: 0 },
  );
}

async function writeDay(env, day, sessions) {
  if (!sessions.length) return env.QCM_KV.delete(PREFIX + day);
  return env.QCM_KV.put(PREFIX + day, JSON.stringify(sessions), { metadata: summary(sessions) });
}

export async function onRequest({ request, env }) {
  if (!env.QCM_KV) return json({ error: NO_KV }, 500);
  const role = roleOf(request, env);
  if (!role) return json({ error: 'Mot de passe incorrect.' }, 401);

  const url = new URL(request.url);
  const day = url.searchParams.get('day');
  if (day !== null && !DAY_RE.test(day)) return json({ error: 'Date invalide.' }, 400);

  if (request.method === 'GET') {
    if (day) return json({ day, sessions: (await env.QCM_KV.get(PREFIX + day, 'json')) ?? [] });
    const days = [];
    let cursor;
    do {
      const page = await env.QCM_KV.list({ prefix: PREFIX, cursor });
      page.keys.forEach((k) => days.push({ day: k.name.slice(PREFIX.length), ...(k.metadata || {}) }));
      cursor = page.list_complete ? undefined : page.cursor;
    } while (cursor);
    days.sort((a, b) => b.day.localeCompare(a.day));
    return json({ days });
  }

  if (request.method === 'POST') {
    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'JSON invalide.' }, 400);
    }
    const s = body?.session;
    if (!DAY_RE.test(body?.day || '') || !s || !Number.isFinite(s.score) || !Number.isFinite(s.total) || !Array.isArray(s.answers)) {
      return json({ error: 'Format invalide.' }, 400);
    }
    if (s.answers.length > 500) return json({ error: 'Test trop long.' }, 400);
    const session = {
      id: crypto.randomUUID(),
      date: typeof s.date === 'string' ? s.date : new Date().toISOString(),
      score: s.score,
      total: s.total,
      seconds: Number(s.seconds) || 0,
      modules: Array.isArray(s.modules) ? s.modules.slice(0, 30) : [],
      answers: s.answers,
    };
    const sessions = (await env.QCM_KV.get(PREFIX + body.day, 'json')) ?? [];
    sessions.push(session);
    await writeDay(env, body.day, sessions);
    return json({ ok: true, id: session.id });
  }

  if (request.method === 'DELETE') {
    if (role !== 'admin') return json({ error: 'Réservé à l’admin.' }, 403);
    const id = url.searchParams.get('id');
    if (!day || !id) return json({ error: 'Paramètres manquants.' }, 400);
    const sessions = (await env.QCM_KV.get(PREFIX + day, 'json')) ?? [];
    await writeDay(env, day, sessions.filter((x) => x.id !== id));
    return json({ ok: true });
  }

  return json({ error: 'Méthode non autorisée.' }, 405);
}
