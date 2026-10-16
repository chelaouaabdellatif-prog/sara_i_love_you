import { useCallback, useEffect, useMemo, useState } from 'react';
import { saveResult, todayInAlgiers } from '../api.js';
import { HISTORY_KEY, LETTERS, countByModule, formatTime, moduleOf, sameSet, shuffle, storage } from '../utils.js';

const TIME_OPTIONS = [30, 45, 60, 90, 120, 180, 0];

// Liens depuis l'accueil : #/sara?module=Toxicologie&n=10&start=1
function readPreset(route) {
  const params = new URLSearchParams(route.split('?')[1] || '');
  return { module: params.get('module'), count: Number(params.get('n')) || 0, start: params.get('start') === '1' };
}

function quickSession({ questions, settings }, preset) {
  const pool = preset.module ? questions.filter((q) => moduleOf(q) === preset.module) : questions;
  if (!pool.length) return null;
  const items = buildItems(pool, { shuffleQuestions: true, shuffleChoices: false }).slice(0, preset.count || 20);
  return { items, secondsPerQuestion: settings.secondsPerQuestion };
}

// Une "séance" = liste d'items { q, order } (order = ordre d'affichage des réponses)
function buildItems(questions, { shuffleQuestions, shuffleChoices }) {
  const list = shuffleQuestions ? shuffle(questions) : questions;
  return list.map((q) => {
    const indexes = q.choices.map((_, i) => i);
    return { q, order: shuffleChoices ? shuffle(indexes) : indexes };
  });
}

// Copie figée du test (les questions peuvent être modifiées plus tard dans l'admin).
// Les lettres suivent l'ordre affiché à Sara.
function toSavedSession(entry, answers) {
  return {
    ...entry,
    modules: [...new Set(answers.map((a) => moduleOf(a.item.q)))],
    answers: answers.map(({ item, selected, isCorrect, timedOut }) => ({
      module: moduleOf(item.q),
      text: item.q.text,
      choices: item.order.map((i) => item.q.choices[i]),
      correct: item.order.flatMap((orig, pos) => (item.q.correct.includes(orig) ? [pos] : [])),
      selected: item.order.flatMap((orig, pos) => (selected.includes(orig) ? [pos] : [])),
      isCorrect,
      timedOut,
      explanation: item.q.explanation || '',
    })),
  };
}

export default function Sara({ data, route, password }) {
  const [saveState, setSaveState] = useState(null); // 'saving' | 'saved' | 'error'
  const [preset] = useState(() => readPreset(route));
  const [session, setSession] = useState(() => (preset.start ? quickSession(data, preset) : null));
  const [phase, setPhase] = useState(() => (session ? 'play' : 'setup'));
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState(() => storage.get(HISTORY_KEY, []));

  // On retire les paramètres de l'adresse : recharger la page ne relance pas la séance rapide.
  useEffect(() => {
    if (route.includes('?')) window.history.replaceState(null, '', '#/sara');
  }, [route]);

  function start(nextSession) {
    setSession(nextSession);
    setResult(null);
    setPhase('play');
    window.scrollTo(0, 0);
  }

  function finish(res) {
    setResult(res);
    setPhase('results');
    window.scrollTo(0, 0);
    if (!res.answers.length) return;
    const entry = {
      date: new Date().toISOString(),
      score: res.answers.filter((a) => a.isCorrect).length,
      total: res.answers.length,
      seconds: Math.round(res.totalSeconds),
    };
    const next = [entry, ...history].slice(0, 15);
    setHistory(next);
    storage.set(HISTORY_KEY, next);

    // Enregistrement en ligne sous la date du jour, avec le détail des réponses.
    setSaveState('saving');
    saveResult(password, todayInAlgiers(), toSavedSession(entry, res.answers))
      .then(() => setSaveState('saved'))
      .catch(() => setSaveState('error'));
  }

  if (!data.questions.length) {
    return (
      <div className="card">
        <h1>Pas encore de questions</h1>
        <p className="muted">Ajoutez des questions depuis la page Admin.</p>
      </div>
    );
  }

  if (phase === 'play') {
    return <Play session={session} onFinish={finish} onQuit={() => setPhase('setup')} />;
  }
  if (phase === 'results') {
    return (
      <Results
        result={result}
        saveState={saveState}
        onRestart={() => setPhase('setup')}
        onRetryWrong={(items) => start({ ...session, items: shuffle(items) })}
      />
    );
  }
  return (
    <Setup
      questions={data.questions}
      settings={data.settings}
      history={history}
      initialModule={preset.module}
      onStart={start}
    />
  );
}

/* ---------- Choix de la séance ---------- */

function Setup({ questions, settings, history, initialModule, onStart }) {
  const modules = useMemo(() => countByModule(questions), [questions]);
  const [selected, setSelected] = useState(() =>
    modules.some((m) => m.name === initialModule) ? [initialModule] : modules.map((m) => m.name),
  );
  const [count, setCount] = useState(Math.min(20, questions.length));
  const [seconds, setSeconds] = useState(settings.secondsPerQuestion ?? 90);
  const [shuffleQuestions, setShuffleQuestions] = useState(true);
  const [shuffleChoices, setShuffleChoices] = useState(false);

  const pool = questions.filter((q) => selected.includes(moduleOf(q)));
  const n = Math.max(1, Math.min(count || 1, pool.length));
  const timeOptions = [...new Set([...TIME_OPTIONS, Number(seconds)])].sort((a, b) => (a || Infinity) - (b || Infinity));

  const toggle = (name) =>
    setSelected((s) => (s.includes(name) ? s.filter((x) => x !== name) : [...s, name]));

  function start() {
    const items = buildItems(pool, { shuffleQuestions, shuffleChoices }).slice(0, n);
    onStart({ items, secondsPerQuestion: Number(seconds) });
  }

  return (
    <div className="setup">
      <section className="card">
        <h1>Nouvelle séance</h1>

        <div className="field">
          <span className="field-label-row">
            Modules
            <span>
              <button type="button" className="link-btn" onClick={() => setSelected(modules.map((m) => m.name))}>
                Tout
              </button>
              {' · '}
              <button type="button" className="link-btn" onClick={() => setSelected([])}>
                Aucun
              </button>
            </span>
          </span>
          <div className="module-picker">
            {modules.map((m) => (
              <label key={m.name} className={`chip ${selected.includes(m.name) ? 'on' : ''}`}>
                <input type="checkbox" checked={selected.includes(m.name)} onChange={() => toggle(m.name)} />
                {m.name} <b>{m.count}</b>
              </label>
            ))}
          </div>
        </div>

        <div className="grid-2">
          <label className="field">
            <span>Nombre de questions (max {pool.length})</span>
            <div className="inline">
              <input
                type="number"
                min="1"
                max={pool.length}
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
              />
              <button type="button" className="btn btn-sm" onClick={() => setCount(pool.length)}>
                Toutes
              </button>
            </div>
          </label>
          <label className="field">
            <span>Chronomètre par question</span>
            <select value={seconds} onChange={(e) => setSeconds(Number(e.target.value))}>
              {timeOptions.map((t) => (
                <option key={t} value={t}>
                  {t ? `${t} secondes` : 'Sans limite'}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="toggles">
          <label>
            <input type="checkbox" checked={shuffleQuestions} onChange={(e) => setShuffleQuestions(e.target.checked)} />
            Mélanger les questions
          </label>
          <label>
            <input type="checkbox" checked={shuffleChoices} onChange={(e) => setShuffleChoices(e.target.checked)} />
            Mélanger les réponses
          </label>
        </div>

        <button className="btn btn-primary btn-lg" disabled={!pool.length} onClick={start}>
          Commencer ({pool.length ? n : 0} question{n > 1 ? 's' : ''})
        </button>
      </section>

      {history.length > 0 && (
        <section className="card">
          <h2>Mes dernières séances</h2>
          <ul className="history">
            {history.map((h) => (
              <li key={h.date}>
                <span>{new Date(h.date).toLocaleString('fr-DZ', { dateStyle: 'short', timeStyle: 'short' })}</span>
                <b className={h.score / h.total >= 0.5 ? 'good' : 'bad'}>
                  {h.score}/{h.total} ({Math.round((h.score / h.total) * 100)} %)
                </b>
                <span className="muted">{formatTime(h.seconds)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/* ---------- Déroulement avec chronomètres ---------- */

function useNow(intervalMs = 250) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

function Play({ session, onFinish, onQuit }) {
  const { items, secondsPerQuestion: limit } = session;
  const now = useNow();
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState([]);
  const [answers, setAnswers] = useState([]);
  const [clock, setClock] = useState(() => {
    const t = Date.now();
    return { startAt: t, qStartAt: t, pausedAt: null, pausedMs: 0, qPausedMs: 0, revealedAt: null };
  });

  const item = items[index];
  const revealed = clock.revealedAt !== null;
  const paused = clock.pausedAt !== null;
  const ref = clock.pausedAt ?? now;
  const totalElapsed = (ref - clock.startAt - clock.pausedMs) / 1000;
  const qElapsed = ((clock.revealedAt ?? ref) - clock.qStartAt - clock.qPausedMs) / 1000;
  const remaining = limit ? Math.max(0, limit - qElapsed) : null;
  const answer = revealed ? answers[answers.length - 1] : null;

  const validate = useCallback(
    (timedOut = false) => {
      if (clock.revealedAt !== null || clock.pausedAt !== null) return;
      const t = Date.now();
      setAnswers((a) => [
        ...a,
        {
          item,
          selected,
          isCorrect: sameSet(selected, item.q.correct),
          timedOut,
          seconds: (t - clock.qStartAt - clock.qPausedMs) / 1000,
        },
      ]);
      setClock((c) => ({ ...c, revealedAt: t }));
    },
    [clock, item, selected],
  );

  const next = useCallback(() => {
    if (index + 1 >= items.length) {
      onFinish({ answers, totalSeconds: totalElapsed });
      return;
    }
    setIndex((i) => i + 1);
    setSelected([]);
    setClock((c) => ({ ...c, qStartAt: Date.now(), qPausedMs: 0, revealedAt: null }));
  }, [index, items.length, answers, totalElapsed, onFinish]);

  const togglePause = useCallback(() => {
    setClock((c) => {
      if (c.pausedAt === null) return { ...c, pausedAt: Date.now() };
      const delta = Date.now() - c.pausedAt;
      return {
        ...c,
        pausedAt: null,
        pausedMs: c.pausedMs + delta,
        qPausedMs: c.revealedAt === null ? c.qPausedMs + delta : c.qPausedMs,
      };
    });
  }, []);

  const toggleChoice = useCallback(
    (orig) => {
      if (revealed || paused) return;
      setSelected((s) => (s.includes(orig) ? s.filter((x) => x !== orig) : [...s, orig]));
    },
    [revealed, paused],
  );

  // Temps écoulé : on valide automatiquement et on montre la solution.
  useEffect(() => {
    if (limit && !revealed && !paused && remaining <= 0) validate(true);
  }, [limit, revealed, paused, remaining, validate]);

  // Raccourcis clavier : A–H pour cocher, Entrée pour valider / continuer, P pour pause.
  useEffect(() => {
    function onKey(e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const key = e.key.toUpperCase();
      if (key === 'P') return togglePause();
      if (paused) return;
      const pos = LETTERS.indexOf(key);
      if (key.length === 1 && pos >= 0 && pos < item.order.length) toggleChoice(item.order[pos]);
      else if (e.key === 'Enter') {
        e.preventDefault();
        if (revealed) next();
        else if (selected.length) validate();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [item, paused, revealed, selected, next, validate, toggleChoice, togglePause]);

  function quit() {
    if (!answers.length || window.confirm('Arrêter la séance ? Les questions déjà répondues seront comptées.')) {
      if (answers.length) onFinish({ answers, totalSeconds: totalElapsed });
      else onQuit();
    }
  }

  const score = answers.filter((a) => a.isCorrect).length;
  const correctLetters = item.order
    .map((orig, pos) => (item.q.correct.includes(orig) ? LETTERS[pos] : null))
    .filter(Boolean);

  return (
    <div className="play">
      <div className="play-bar card">
        <div className="play-meta">
          <span className="tag">{moduleOf(item.q)}</span>
          <span>
            Question <b>{index + 1}</b> / {items.length}
          </span>
          <span className="score-pill">
            Score {score}/{answers.length}
          </span>
        </div>
        <div className="timers">
          <div className="total-time" title="Temps total">
            <span className="muted">Total</span>
            <b>{formatTime(totalElapsed)}</b>
          </div>
          {limit > 0 && <TimerRing remaining={remaining} limit={limit} />}
          <button className="btn btn-sm" onClick={togglePause} title="Pause (P)">
            {paused ? 'Reprendre' : 'Pause'}
          </button>
        </div>
        <div className="progress">
          <div style={{ width: `${((index + (revealed ? 1 : 0)) / items.length) * 100}%` }} />
        </div>
      </div>

      <section className={`card question-card ${paused ? 'is-paused' : ''}`}>
        {paused && (
          <div className="pause-overlay">
            <p>En pause</p>
            <button className="btn btn-primary" onClick={togglePause}>
              Reprendre
            </button>
          </div>
        )}

        <h2 className="question-text">{item.q.text}</h2>
        {item.q.correct.length > 1 && !revealed && <p className="hint">Plusieurs réponses possibles</p>}

        <div className="choices">
          {item.order.map((orig, pos) => {
            const isSel = selected.includes(orig);
            const isRight = item.q.correct.includes(orig);
            let state = isSel ? 'selected' : '';
            if (revealed) state = isRight ? (isSel ? 'good' : 'missed') : isSel ? 'bad' : 'dim';
            return (
              <button key={orig} className={`choice ${state}`} onClick={() => toggleChoice(orig)} disabled={revealed}>
                <span className="choice-letter">{LETTERS[pos]}</span>
                <span className="choice-text">{item.q.choices[orig]}</span>
                {revealed && isRight && <span className="choice-mark">✓</span>}
                {revealed && !isRight && isSel && <span className="choice-mark">✗</span>}
              </button>
            );
          })}
        </div>

        {answer && (
          <div className={`feedback ${answer.isCorrect ? 'good' : 'bad'}`}>
            <p className="feedback-title">
              {answer.isCorrect ? 'Bonne réponse !' : answer.timedOut ? 'Temps écoulé' : 'Réponse incorrecte'}
            </p>
            <p>
              Réponse{correctLetters.length > 1 ? 's' : ''} juste{correctLetters.length > 1 ? 's' : ''} :{' '}
              <b>{correctLetters.join(', ')}</b>
            </p>
            {item.q.explanation && <p className="explanation">{item.q.explanation}</p>}
          </div>
        )}

        <div className="play-actions">
          <button className="btn btn-ghost" onClick={quit}>
            Arrêter
          </button>
          {revealed ? (
            <button className="btn btn-primary btn-lg" onClick={next} autoFocus>
              {index + 1 >= items.length ? 'Voir mes résultats' : 'Question suivante →'}
            </button>
          ) : (
            <button className="btn btn-primary btn-lg" onClick={() => validate()} disabled={!selected.length || paused}>
              Valider
            </button>
          )}
        </div>
      </section>
      <p className="kbd-hint muted">Clavier : A–E pour cocher · Entrée pour valider · P pour pause</p>
    </div>
  );
}

function TimerRing({ remaining, limit }) {
  const r = 22;
  const circumference = 2 * Math.PI * r;
  const fraction = Math.max(0, Math.min(1, remaining / limit));
  const level = fraction <= 0.1 ? 'danger' : fraction <= 0.25 ? 'warn' : 'ok';
  return (
    <div className={`timer-ring ${level}`} title="Temps restant pour cette question">
      <svg viewBox="0 0 52 52" width="56" height="56">
        <circle cx="26" cy="26" r={r} className="track" />
        <circle
          cx="26"
          cy="26"
          r={r}
          className="bar"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - fraction)}
        />
      </svg>
      <span>{Math.ceil(remaining)}</span>
    </div>
  );
}

/* ---------- Résultats ---------- */

const SAVE_LABELS = {
  saving: ['status-saving', 'Enregistrement du test…'],
  saved: ['status-ok', 'Test enregistré dans l’historique ✓'],
  error: ['status-error', 'Test non enregistré en ligne (connexion ?)'],
};

function Results({ result, saveState, onRestart, onRetryWrong }) {
  const [showAll, setShowAll] = useState(false);
  const { answers, totalSeconds } = result;
  const score = answers.filter((a) => a.isCorrect).length;
  const total = answers.length;
  const percent = total ? Math.round((score / total) * 100) : 0;
  const wrong = answers.filter((a) => !a.isCorrect);

  const byModule = {};
  answers.forEach((a) => {
    const m = moduleOf(a.item.q);
    byModule[m] ??= { score: 0, total: 0 };
    byModule[m].total += 1;
    if (a.isCorrect) byModule[m].score += 1;
  });

  const message =
    percent >= 80 ? 'Excellent travail, Sara !' : percent >= 50 ? 'Bien joué, continue comme ça !' : 'Courage, on révise et on recommence !';
  const shown = showAll ? answers : wrong;

  return (
    <div className="results">
      <section className="card results-hero">
        <div className={`big-score ${percent >= 50 ? 'good' : 'bad'}`}>
          <span>{percent}%</span>
        </div>
        <div>
          <h1>{message}</h1>
          <p>
            <b>{score}</b> bonne{score > 1 ? 's' : ''} réponse{score > 1 ? 's' : ''} sur <b>{total}</b>
          </p>
          <p className="muted">
            Temps total {formatTime(totalSeconds)} · moyenne {total ? Math.round(totalSeconds / total) : 0} s / question
          </p>
          {SAVE_LABELS[saveState] && (
            <p>
              <span className={`status ${SAVE_LABELS[saveState][0]}`}>{SAVE_LABELS[saveState][1]}</span>{' '}
              {saveState === 'saved' && <a href="#/historique">Voir l’historique</a>}
            </p>
          )}
          <div className="form-actions">
            <button className="btn btn-primary" onClick={onRestart}>
              Nouvelle séance
            </button>
            {wrong.length > 0 && (
              <button className="btn" onClick={() => onRetryWrong(wrong.map((a) => a.item))}>
                {wrong.length > 1 ? `Refaire mes ${wrong.length} erreurs` : 'Refaire mon erreur'}
              </button>
            )}
          </div>
        </div>
      </section>

      {Object.keys(byModule).length > 1 && (
        <section className="card">
          <h2>Par module</h2>
          <ul className="module-scores">
            {Object.entries(byModule).map(([name, s]) => (
              <li key={name}>
                <span>{name}</span>
                <div className="bar-track">
                  <div style={{ width: `${(s.score / s.total) * 100}%` }} />
                </div>
                <b>
                  {s.score}/{s.total}
                </b>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card">
        <div className="list-head">
          <h2>{showAll ? 'Toutes les questions' : `Mes erreurs (${wrong.length})`}</h2>
          <button className="btn btn-sm" onClick={() => setShowAll((v) => !v)}>
            {showAll ? 'Voir seulement les erreurs' : 'Voir toutes les questions'}
          </button>
        </div>
        {shown.length === 0 && <p className="muted">Aucune erreur, bravo !</p>}
        <ol className="review">
          {shown.map((a, i) => (
            <li key={i} className={a.isCorrect ? 'review-good' : 'review-bad'}>
              <p className="review-q">{a.item.q.text}</p>
              <ul>
                {a.item.order.map((orig, pos) => {
                  const isRight = a.item.q.correct.includes(orig);
                  const isSel = a.selected.includes(orig);
                  return (
                    <li key={orig} className={isRight ? 'is-correct' : isSel ? 'is-wrong' : ''}>
                      <b>{LETTERS[pos]}.</b> {a.item.q.choices[orig]} {isSel && <em>(ta réponse)</em>}
                    </li>
                  );
                })}
              </ul>
              {a.timedOut && <p className="muted">Temps écoulé</p>}
              {a.item.q.explanation && <p className="explanation">{a.item.q.explanation}</p>}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
