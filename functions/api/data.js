// GET  /api/data  -> renvoie les questions et réglages (mot de passe Sara ou admin)
// PUT  /api/data  -> enregistre tout (mot de passe admin)
// Le mot de passe est envoyé dans l'en-tête x-password.
const KEY = 'data';
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

export async function onRequestGet({ request, env }) {
  if (!env.QCM_KV) return json({ error: NO_KV }, 500);
  const role = roleOf(request, env);
  if (!role) return json({ error: 'Mot de passe incorrect.' }, 401);
  const data = await env.QCM_KV.get(KEY, 'json');
  return json({ ...(data ?? { questions: null, settings: {} }), role });
}

export async function onRequestPut({ request, env }) {
  if (!env.QCM_KV) return json({ error: NO_KV }, 500);
  if (roleOf(request, env) !== 'admin') return json({ error: 'Mot de passe admin incorrect.' }, 401);
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'JSON invalide.' }, 400);
  }
  if (!body || !Array.isArray(body.questions)) return json({ error: 'Format invalide.' }, 400);

  const data = { questions: body.questions, settings: body.settings ?? {}, updatedAt: new Date().toISOString() };
  await env.QCM_KV.put(KEY, JSON.stringify(data));
  return json({ ok: true, updatedAt: data.updatedAt });
}
