import { useEffect, useState } from 'react';
import { deleteResult, loadResultDay, loadResultDays } from '../api.js';
import { LETTERS, formatTime } from '../utils.js';

// #/historique                         -> liste des jours
// #/historique?day=2026-10-16          -> tests de ce jour
// #/historique?day=2026-10-16&test=ID  -> détail d'un test
const percent = (score, total) => (total ? Math.round((score / total) * 100) : 0);

const dayLabel = (day) =>
  new Date(`${day}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

const timeLabel = (iso) =>
  new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Algiers' });

function ScorePill({ score, total }) {
  const p = percent(score, total);
  return <span className={`score-badge ${p >= 50 ? 'good' : 'bad'}`}>{p} %</span>;
}

export default function History({ route, password, isAdmin }) {
  const params = new URLSearchParams(route.split('?')[1] || '');
  const day = params.get('day');
  const testId = params.get('test');

  if (day) return <DayView day={day} testId={testId} password={password} isAdmin={isAdmin} />;
  return <DaysList password={password} />;
}

function useLoader(load, deps) {
  const [state, setState] = useState({ loading: true, error: '', value: null });
  useEffect(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: '' }));
    load()
      .then((value) => alive && setState({ loading: false, error: '', value }))
      .catch((err) => alive && setState({ loading: false, error: err.message, value: null }));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return [state, setState];
}

function DaysList({ password }) {
  const [{ loading, error, value: days }] = useLoader(() => loadResultDays(password), []);

  return (
    <div className="history-page">
      <div className="section-head">
        <h1>Historique des tests</h1>
        <a href="#/sara">Nouveau test →</a>
      </div>
      {loading && <p className="muted">Chargement…</p>}
      {error && <p className="alert alert-error">{error}</p>}
      {days && !days.length && (
        <div className="card">
          <p>Aucun test enregistré pour l’instant.</p>
          <p className="muted">Chaque test terminé est enregistré automatiquement à la date du jour.</p>
        </div>
      )}
      {days?.length > 0 && (
        <ul className="day-list">
          {days.map((d) => (
            <li key={d.day}>
              <a className="day-card card" href={`#/historique?day=${d.day}`}>
                <span className="day-date">
                  <strong>{dayLabel(d.day)}</strong>
                  <span className="muted">
                    {d.count} test{d.count > 1 ? 's' : ''} · {d.score}/{d.total} bonnes réponses · {formatTime(d.seconds)}
                  </span>
                </span>
                <span className="day-score">
                  <span className="bar-track">
                    <span style={{ width: `${percent(d.score, d.total)}%` }} />
                  </span>
                  <ScorePill score={d.score} total={d.total} />
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function DayView({ day, testId, password, isAdmin }) {
  const [{ loading, error, value: sessions }, setState] = useLoader(() => loadResultDay(password, day), [day]);
  const [busy, setBusy] = useState(false);
  const test = testId && sessions?.find((s) => s.id === testId);

  async function remove(s) {
    if (!window.confirm(`Supprimer le test de ${timeLabel(s.date)} (${s.score}/${s.total}) ?`)) return;
    setBusy(true);
    try {
      await deleteResult(password, day, s.id);
      setState((st) => ({ ...st, value: st.value.filter((x) => x.id !== s.id) }));
      if (testId === s.id) window.location.hash = `#/historique?day=${day}`;
    } catch (err) {
      window.alert(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="history-page">
      <a className="back-link" href={test ? `#/historique?day=${day}` : '#/historique'}>
        ← {test ? 'Tests du jour' : 'Tous les jours'}
      </a>
      <h1 className="first-up">{dayLabel(day)}</h1>
      {loading && <p className="muted">Chargement…</p>}
      {error && <p className="alert alert-error">{error}</p>}
      {sessions && !sessions.length && <p className="card">Aucun test ce jour-là.</p>}

      {test ? (
        <TestDetail test={test} />
      ) : (
        sessions?.length > 0 && (
          <ul className="test-list">
            {[...sessions].reverse().map((s) => (
              <li key={s.id} className="card test-row">
                <div className="test-main">
                  <span className="test-time">{timeLabel(s.date)}</span>
                  <span>
                    <b>
                      {s.score}/{s.total}
                    </b>{' '}
                    <ScorePill score={s.score} total={s.total} />
                  </span>
                  <span className="muted">{formatTime(s.seconds)}</span>
                </div>
                <div className="tags">
                  {s.modules.map((m) => (
                    <span key={m} className="tag">
                      {m}
                    </span>
                  ))}
                </div>
                <div className="form-actions">
                  <a className="btn btn-sm btn-primary" href={`#/historique?day=${day}&test=${s.id}`}>
                    Voir le détail
                  </a>
                  {isAdmin && (
                    <button className="btn btn-sm btn-danger" disabled={busy} onClick={() => remove(s)}>
                      Supprimer
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )
      )}
    </div>
  );
}

function TestDetail({ test }) {
  const [onlyWrong, setOnlyWrong] = useState(false);
  const shown = onlyWrong ? test.answers.filter((a) => !a.isCorrect) : test.answers;

  return (
    <>
      <section className="card test-summary">
        <div className={`big-score ${percent(test.score, test.total) >= 50 ? 'good' : 'bad'}`}>
          <span>{percent(test.score, test.total)}%</span>
        </div>
        <div>
          <p>
            Test de <b>{timeLabel(test.date)}</b> · <b>{test.score}</b>/{test.total} bonnes réponses
          </p>
          <p className="muted">Durée {formatTime(test.seconds)}</p>
          <div className="tags">
            {test.modules.map((m) => (
              <span key={m} className="tag">
                {m}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="card">
        <div className="list-head">
          <h2>{onlyWrong ? 'Erreurs' : 'Toutes les questions'}</h2>
          <button className="btn btn-sm" onClick={() => setOnlyWrong((v) => !v)}>
            {onlyWrong ? 'Voir toutes les questions' : 'Voir seulement les erreurs'}
          </button>
        </div>
        <ol className="review">
          {shown.map((a, i) => (
            <li key={i} className={a.isCorrect ? 'review-good' : 'review-bad'}>
              <p className="review-q">{a.text}</p>
              <ul>
                {a.choices.map((c, pos) => {
                  const isRight = a.correct.includes(pos);
                  const isSel = a.selected.includes(pos);
                  return (
                    <li key={pos} className={isRight ? 'is-correct' : isSel ? 'is-wrong' : ''}>
                      <b>{LETTERS[pos]}.</b> {c} {isSel && <em>(réponse de Sara)</em>}
                    </li>
                  );
                })}
              </ul>
              {a.timedOut && <p className="muted">Temps écoulé</p>}
              {a.explanation && <p className="explanation">{a.explanation}</p>}
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}
