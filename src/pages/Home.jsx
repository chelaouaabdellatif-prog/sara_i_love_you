import { useEffect, useState } from 'react';
import Logo from '../components/Logo.jsx';
import { HISTORY_KEY, countByModule, formatTime, storage } from '../utils.js';

const ICONS = {
  book: (
    <>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </>
  ),
  grid: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
    </>
  ),
  check: (
    <>
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <path d="M22 4 12 14.01l-3-3" />
    </>
  ),
  award: (
    <>
      <circle cx="12" cy="8" r="6" />
      <path d="M8.2 13.9 7 23l5-3 5 3-1.2-9.1" />
    </>
  ),
};

function Icon({ name }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICONS[name]}
    </svg>
  );
}

function greeting() {
  const h = new Date().getHours();
  return h < 5 || h >= 18 ? 'Bonsoir' : 'Bonjour';
}

function useCountdown(examDate) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);
  const target = new Date(`${examDate}T08:00:00`).getTime();
  if (!examDate || Number.isNaN(target)) return null;
  const ms = Math.max(0, target - now);
  return {
    done: ms === 0,
    days: Math.floor(ms / 86400000),
    hours: Math.floor((ms % 86400000) / 3600000),
    minutes: Math.floor((ms % 3600000) / 60000),
    label: new Date(target).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }),
  };
}

const initials = (name) =>
  name
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('') || name[0].toUpperCase();

export default function Home({ data }) {
  const modules = countByModule(data.questions);
  const countdown = useCountdown(data.settings.examDate);
  const history = storage.get(HISTORY_KEY, []);
  const last = history[0];
  const best = history.reduce((max, h) => Math.max(max, Math.round((h.score / h.total) * 100)), 0);

  const kpis = [
    { icon: 'book', value: data.questions.length, label: 'questions' },
    { icon: 'grid', value: modules.length, label: 'modules' },
    { icon: 'check', value: history.length, label: 'séances faites' },
    { icon: 'award', value: history.length ? `${best} %` : '—', label: 'meilleur score' },
  ];

  return (
    <div className="home">
      <section className="home-hero">
        <div className="home-hero-deco" aria-hidden="true">
          <Logo size={260} />
        </div>
        <div className="home-hero-text">
          <span className="eyebrow">Résidanat pharmacie · Alger</span>
          <h1>
            {greeting()}, <span className="hero-name">Sara</span>
          </h1>
          <p>QCM corrigés après chaque question, chronométrés et classés par module. Un peu chaque jour, et ça passe !</p>
          <div className="hero-actions">
            <a href="#/sara" className="btn btn-light btn-lg">
              Commencer une séance
            </a>
            <a href="#/sara?n=30&start=1" className="btn btn-outline-light btn-lg">
              Examen blanc · 30 QCM
            </a>
            <a href="#/sara?n=10&start=1" className="btn btn-outline-light btn-lg">
              Séance rapide · 10 QCM
            </a>
          </div>
        </div>

        {countdown && (
          <div className="countdown-card">
            {countdown.done ? (
              <p className="countdown-done">C’est le jour J. Respire, tu es prête !</p>
            ) : (
              <>
                <p className="countdown-title">Avant l’examen</p>
                <div className="countdown-boxes">
                  <div>
                    <b>{countdown.days}</b>
                    <span>jours</span>
                  </div>
                  <div>
                    <b>{countdown.hours}</b>
                    <span>heures</span>
                  </div>
                  <div>
                    <b>{countdown.minutes}</b>
                    <span>min</span>
                  </div>
                </div>
                <p className="countdown-date">{countdown.label}</p>
              </>
            )}
          </div>
        )}
      </section>

      <section className="kpis">
        {kpis.map((k) => (
          <div key={k.label} className="kpi card">
            <span className="kpi-icon">
              <Icon name={k.icon} />
            </span>
            <span>
              <span className="kpi-value">{k.value}</span>
              <span className="kpi-label">{k.label}</span>
            </span>
          </div>
        ))}
      </section>

      {last && (
        <section className="card last-session">
          <div>
            <p className="eyebrow-dark">Dernière séance</p>
            <p>
              <b>
                {last.score}/{last.total}
              </b>{' '}
              bonnes réponses en {formatTime(last.seconds)} ·{' '}
              {new Date(last.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
            </p>
            <div className="bar-track">
              <div style={{ width: `${(last.score / last.total) * 100}%` }} />
            </div>
          </div>
          <a href="#/sara" className="btn btn-primary">
            Continuer
          </a>
        </section>
      )}

      {modules.length > 0 && (
        <section>
          <div className="section-head">
            <h2>Tes modules</h2>
            <a href="#/sara">Personnaliser une séance →</a>
          </div>
          <div className="module-grid">
            {modules.map((m) => (
              <a key={m.name} className="module-card" href={`#/sara?module=${encodeURIComponent(m.name)}&start=1`}>
                <span className="module-icon">{initials(m.name)}</span>
                <strong>{m.name}</strong>
                <span className="muted">
                  {m.count} question{m.count > 1 ? 's' : ''}
                </span>
                <span className="module-go">S’entraîner →</span>
              </a>
            ))}
          </div>
        </section>
      )}

      <section className="steps">
        {[
          ['1', 'Choisis', 'un module ou une séance rapide de 10 QCM.'],
          ['2', 'Réponds', 'avant la fin du chronomètre, comme le jour de l’examen.'],
          ['3', 'Comprends', 'grâce à la correction, puis refais tes erreurs.'],
        ].map(([n, title, text]) => (
          <div key={n} className="step card">
            <span className="step-num">{n}</span>
            <p>
              <b>{title}</b> {text}
            </p>
          </div>
        ))}
      </section>
    </div>
  );
}
