import { useMemo, useState } from 'react';
import { saveData } from '../api.js';
import { parseBulk } from '../bulk.js';
import AnnouncementBar, { isSafeLink } from '../components/AnnouncementBar.jsx';
import PasswordForm from '../components/PasswordForm.jsx';
import { LETTERS, MODULES, countByModule, moduleOf, newId } from '../utils.js';

export default function Admin({ data, onDataChange, password, onLogin }) {
  if (data.role !== 'admin') {
    return (
      <PasswordForm
        title="Espace admin"
        subtitle="Entrez le mot de passe admin pour ajouter ou modifier les questions."
        onSubmit={async (pw) => ((await onLogin(pw)) === 'admin' ? '' : 'Mot de passe admin incorrect.')}
      />
    );
  }
  return <Dashboard data={data} onDataChange={onDataChange} password={password} />;
}

function Dashboard({ data, onDataChange, password }) {
  const [tab, setTab] = useState('questions');
  const [status, setStatus] = useState(null); // { type: 'ok' | 'error' | 'saving', text }

  async function persist(next, okText = 'Enregistré') {
    setStatus({ type: 'saving', text: 'Enregistrement…' });
    try {
      await saveData(next, password);
      onDataChange(next);
      setStatus({ type: 'ok', text: okText });
      return true;
    } catch (err) {
      setStatus({ type: 'error', text: `Erreur : ${err.message}` });
      return false;
    }
  }

  const tabs = [
    ['questions', `Questions (${data.questions.length})`],
    ['bulk', 'Ajout rapide'],
    ['settings', 'Apparence & réglages'],
  ];

  return (
    <div className="admin">
      <div className="admin-head">
        <h1>Administration</h1>
        {status && <span className={`status status-${status.type}`}>{status.text}</span>}
      </div>
      <div className="tabs" role="tablist">
        {tabs.map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>
      {tab === 'questions' && <QuestionsTab data={data} persist={persist} />}
      {tab === 'bulk' && <BulkTab data={data} persist={persist} onDone={() => setTab('questions')} />}
      {tab === 'settings' && <SettingsTab data={data} persist={persist} />}
    </div>
  );
}

/* ---------- Questions : formulaire + liste ---------- */

function QuestionsTab({ data, persist }) {
  const [editing, setEditing] = useState(null); // question en cours de modification
  const [formKey, setFormKey] = useState(0);
  const [filter, setFilter] = useState('');
  const [search, setSearch] = useState('');
  const [lastModule, setLastModule] = useState('');

  const modules = countByModule(data.questions);
  const moduleOptions = [...new Set([...MODULES, ...modules.map((m) => m.name)])];

  const visible = data.questions.filter(
    (q) =>
      (!filter || moduleOf(q) === filter) &&
      (!search || `${q.text} ${q.choices.join(' ')}`.toLowerCase().includes(search.toLowerCase())),
  );

  async function submit(question) {
    const exists = data.questions.some((q) => q.id === question.id);
    const questions = exists
      ? data.questions.map((q) => (q.id === question.id ? question : q))
      : [...data.questions, question];
    const ok = await persist({ ...data, questions }, exists ? 'Question modifiée' : 'Question ajoutée');
    if (ok) {
      setLastModule(question.module);
      setEditing(null);
      setFormKey((k) => k + 1);
    }
    return ok;
  }

  async function remove(q) {
    if (!window.confirm(`Supprimer cette question ?\n\n${q.text}`)) return;
    await persist({ ...data, questions: data.questions.filter((x) => x.id !== q.id) }, 'Question supprimée');
    if (editing?.id === q.id) setEditing(null);
  }

  function edit(q) {
    setEditing(q);
    setFormKey((k) => k + 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <>
      <QuestionForm
        key={formKey}
        initial={editing}
        defaultModule={lastModule}
        moduleOptions={moduleOptions}
        onSubmit={submit}
        onCancel={() => {
          setEditing(null);
          setFormKey((k) => k + 1);
        }}
      />

      <section className="card">
        <div className="list-head">
          <h2>Liste des questions</h2>
          <div className="list-filters">
            <select value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="">Tous les modules</option>
              {modules.map((m) => (
                <option key={m.name} value={m.name}>
                  {m.name} ({m.count})
                </option>
              ))}
            </select>
            <input type="search" placeholder="Rechercher…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>

        {visible.length === 0 && <p className="muted">Aucune question.</p>}
        <ol className="qlist">
          {visible.map((q) => (
            <li key={q.id} className={editing?.id === q.id ? 'editing' : ''}>
              <div className="qlist-main">
                <span className="tag">{moduleOf(q)}</span>
                <p className="qlist-text">{q.text}</p>
                <ul className="qlist-choices">
                  {q.choices.map((c, i) => (
                    <li key={i} className={q.correct.includes(i) ? 'is-correct' : ''}>
                      <b>{LETTERS[i]}.</b> {c}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="qlist-actions">
                <button className="btn btn-sm" onClick={() => edit(q)}>
                  Modifier
                </button>
                <button className="btn btn-sm btn-danger" onClick={() => remove(q)}>
                  Supprimer
                </button>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}

const emptyQuestion = (module) => ({
  id: null,
  module: module || '',
  text: '',
  choices: ['', '', '', '', ''],
  correct: [],
  explanation: '',
});

// Retire les réponses vides en gardant les bonnes réponses alignées.
function cleanQuestion(q) {
  const choices = [];
  const correct = [];
  q.choices.forEach((c, i) => {
    const t = c.trim();
    if (!t) return;
    if (q.correct.includes(i)) correct.push(choices.length);
    choices.push(t);
  });
  return {
    id: q.id || newId(),
    module: q.module.trim() || 'Général',
    text: q.text.trim(),
    choices,
    correct,
    explanation: q.explanation.trim(),
  };
}

function QuestionForm({ initial, defaultModule, moduleOptions, onSubmit, onCancel }) {
  const [q, setQ] = useState(() => (initial ? structuredClone(initial) : emptyQuestion(defaultModule)));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (patch) => setQ((prev) => ({ ...prev, ...patch }));

  const setChoice = (i, value) => set({ choices: q.choices.map((c, j) => (j === i ? value : c)) });

  const toggleCorrect = (i) =>
    set({ correct: q.correct.includes(i) ? q.correct.filter((x) => x !== i) : [...q.correct, i].sort() });

  const removeChoice = (i) =>
    set({
      choices: q.choices.filter((_, j) => j !== i),
      correct: q.correct.filter((x) => x !== i).map((x) => (x > i ? x - 1 : x)),
    });

  async function submit(e) {
    e.preventDefault();
    const cleaned = cleanQuestion(q);
    if (!cleaned.text) return setError('Écrivez la question.');
    if (cleaned.choices.length < 2) return setError('Il faut au moins 2 réponses.');
    if (!cleaned.correct.length) return setError('Cochez au moins une bonne réponse.');
    setError('');
    setBusy(true);
    await onSubmit(cleaned);
    setBusy(false);
  }

  return (
    <form className="card qform" onSubmit={submit}>
      <h2>{initial ? 'Modifier la question' : 'Nouvelle question'}</h2>

      <label className="field">
        <span>Module</span>
        <input
          list="module-options"
          value={q.module}
          placeholder="ex : Pharmacologie"
          onChange={(e) => set({ module: e.target.value })}
        />
        <datalist id="module-options">
          {moduleOptions.map((m) => (
            <option key={m} value={m} />
          ))}
        </datalist>
      </label>

      <label className="field">
        <span>Question</span>
        <textarea rows={3} value={q.text} onChange={(e) => set({ text: e.target.value })} placeholder="Énoncé de la question…" />
      </label>

      <div className="field">
        <span>Réponses — cochez la ou les bonnes réponses</span>
        <div className="choice-editor">
          {q.choices.map((c, i) => (
            <div key={i} className={`choice-row ${q.correct.includes(i) ? 'is-correct' : ''}`}>
              <label className="choice-check" title="Bonne réponse">
                <input type="checkbox" checked={q.correct.includes(i)} onChange={() => toggleCorrect(i)} />
                <b>{LETTERS[i]}</b>
              </label>
              <input value={c} onChange={(e) => setChoice(i, e.target.value)} placeholder={`Réponse ${LETTERS[i]}`} />
              {q.choices.length > 2 && (
                <button type="button" className="icon-btn" onClick={() => removeChoice(i)} aria-label="Retirer">
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
        {q.choices.length < LETTERS.length && (
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => set({ choices: [...q.choices, ''] })}>
            + Ajouter une réponse
          </button>
        )}
      </div>

      <label className="field">
        <span>Explication / solution (affichée après la réponse)</span>
        <textarea
          rows={3}
          value={q.explanation}
          onChange={(e) => set({ explanation: e.target.value })}
          placeholder="Pourquoi c’est la bonne réponse…"
        />
      </label>

      {error && <p className="alert alert-error">{error}</p>}
      <div className="form-actions">
        <button className="btn btn-primary" disabled={busy}>
          {busy ? 'Enregistrement…' : initial ? 'Enregistrer les modifications' : 'Ajouter la question'}
        </button>
        {initial && (
          <button type="button" className="btn" onClick={onCancel}>
            Annuler
          </button>
        )}
      </div>
    </form>
  );
}

/* ---------- Ajout rapide ---------- */

const BULK_EXAMPLE = `Module: Pharmacologie
L'amoxicilline appartient à la famille des :
A) Macrolides
*B) Bêta-lactamines
C) Aminosides
D) Fluoroquinolones
> C'est une aminopénicilline.

Quels médicaments sont des IEC ?
A) Énalapril *
B) Losartan
C) Captopril *
D) Amlodipine
> Les IEC finissent en -pril ; les sartans sont des ARA II.`;

function BulkTab({ data, persist, onDone }) {
  const [text, setText] = useState('');
  const [module, setModule] = useState('');
  const parsed = useMemo(() => (text.trim() ? parseBulk(text, module) : null), [text, module]);

  async function add() {
    if (!parsed?.questions.length) return;
    const ok = await persist(
      { ...data, questions: [...data.questions, ...parsed.questions] },
      `${parsed.questions.length} question(s) ajoutée(s)`,
    );
    if (ok) {
      setText('');
      onDone();
    }
  }

  return (
    <section className="card">
      <h2>Ajout rapide</h2>
      <p className="muted">
        Collez plusieurs questions d’un coup. Une ligne vide entre chaque question. Mettez une <b>*</b> devant ou après les
        bonnes réponses, et <b>&gt;</b> devant l’explication. <code>Module: …</code> change le module des questions suivantes.
      </p>
      <label className="field">
        <span>Module par défaut</span>
        <input list="module-options-bulk" value={module} onChange={(e) => setModule(e.target.value)} placeholder="Général" />
        <datalist id="module-options-bulk">
          {MODULES.map((m) => (
            <option key={m} value={m} />
          ))}
        </datalist>
      </label>
      <label className="field">
        <span>Questions</span>
        <textarea rows={14} className="mono" value={text} onChange={(e) => setText(e.target.value)} placeholder={BULK_EXAMPLE} />
      </label>
      {parsed && (
        <div className="bulk-preview">
          <p>
            <b>{parsed.questions.length}</b> question(s) prête(s) à être ajoutée(s).
          </p>
          {parsed.errors.map((err) => (
            <p key={err} className="alert alert-error">
              {err}
            </p>
          ))}
        </div>
      )}
      <div className="form-actions">
        <button className="btn btn-primary" disabled={!parsed?.questions.length} onClick={add}>
          Ajouter {parsed?.questions.length || ''} question(s)
        </button>
        <button className="btn btn-ghost" onClick={() => setText(BULK_EXAMPLE)}>
          Voir un exemple
        </button>
      </div>
    </section>
  );
}

/* ---------- Réglages & sauvegarde ---------- */

function isValidQuestion(q) {
  return (
    q &&
    typeof q.text === 'string' &&
    Array.isArray(q.choices) &&
    q.choices.length >= 2 &&
    Array.isArray(q.correct) &&
    q.correct.length > 0
  );
}

const THEMES = [
  { id: 'bleu-rose', label: 'Bleu & rose', swatch: 'linear-gradient(120deg, #0b2559, #1d5fd1 55%, #e0457f)' },
  { id: 'bleu', label: 'Bleu', swatch: 'linear-gradient(120deg, #0b2559, #1d5fd1 60%, #3b7cf0)' },
  { id: 'rose', label: 'Rose', swatch: 'linear-gradient(120deg, #4f0d2c, #d13a78 60%, #8b5cf6)' },
];

// Un clic applique et enregistre le thème pour tout le site.
function ThemeCard({ data, persist }) {
  return (
    <section className="card">
      <h2>Apparence</h2>
      <p className="muted">Le thème choisi s’applique aussi sur le téléphone de Sara.</p>
      <div className="theme-picker">
        {THEMES.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`theme-option ${data.settings.theme === t.id ? 'on' : ''}`}
            aria-pressed={data.settings.theme === t.id}
            onClick={() => persist({ ...data, settings: { ...data.settings, theme: t.id } }, `Thème « ${t.label} » appliqué`)}
          >
            <span className="theme-swatch" style={{ background: t.swatch }} />
            {t.label}
          </button>
        ))}
      </div>
    </section>
  );
}

function BannerCard({ data, persist }) {
  const [banner, setBanner] = useState(data.settings.banner);
  const [error, setError] = useState('');
  const set = (patch) => setBanner((b) => ({ ...b, ...patch }));

  function save(e) {
    e.preventDefault();
    if (banner.link.trim() && !isSafeLink(banner.link)) {
      setError('Le lien doit commencer par https:// (ou http://).');
      return;
    }
    setError('');
    persist({ ...data, settings: { ...data.settings, banner: { ...banner, text: banner.text.trim() } } }, 'Bannière enregistrée');
  }

  return (
    <form className="card" onSubmit={save}>
      <h2>Bannière d’annonce (en haut de la page)</h2>
      <label className="toggles">
        <span>
          <input type="checkbox" checked={banner.enabled} onChange={(e) => set({ enabled: e.target.checked })} /> Afficher la
          bannière
        </span>
      </label>
      <label className="field">
        <span>Message</span>
        <textarea
          rows={2}
          maxLength={220}
          value={banner.text}
          onChange={(e) => set({ text: e.target.value })}
          placeholder="ex : Nouveau : 50 QCM de pharmacologie ajoutés !"
        />
      </label>
      <div className="grid-2">
        <label className="field">
          <span>Lien (optionnel)</span>
          <input type="url" value={banner.link} onChange={(e) => set({ link: e.target.value })} placeholder="https://…" />
        </label>
        <label className="field">
          <span>Texte du bouton</span>
          <input value={banner.linkLabel} onChange={(e) => set({ linkLabel: e.target.value })} placeholder="En savoir plus" />
        </label>
      </div>
      <label className="field">
        <span>Couleur</span>
        <select value={banner.style} onChange={(e) => set({ style: e.target.value })}>
          <option value="degrade">Dégradé bleu → rose</option>
          <option value="rose">Rose</option>
          <option value="bleu">Bleu</option>
        </select>
      </label>
      {banner.text.trim() && (
        <div className="field">
          <span>Aperçu</span>
          <div className="banner-preview">
            <AnnouncementBar banner={banner} preview />
          </div>
        </div>
      )}
      {error && <p className="alert alert-error">{error}</p>}
      <button className="btn btn-primary">Enregistrer la bannière</button>
    </form>
  );
}

function SettingsTab({ data, persist }) {
  const [seconds, setSeconds] = useState(data.settings.secondsPerQuestion);
  const [examDate, setExamDate] = useState(data.settings.examDate || '');
  const [importMsg, setImportMsg] = useState('');

  function saveSettings(e) {
    e.preventDefault();
    persist({ ...data, settings: { ...data.settings, secondsPerQuestion: Number(seconds) || 0, examDate } }, 'Réglages enregistrés');
  }

  function exportJson() {
    const { questions, settings } = data;
    const blob = new Blob([JSON.stringify({ questions, settings }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `qcm-pharma-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function importJson(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      const list = Array.isArray(parsed) ? parsed : parsed.questions;
      if (!Array.isArray(list)) throw new Error('Aucune liste de questions trouvée.');
      const valid = list.filter(isValidQuestion).map((q) => ({
        id: newId(),
        module: q.module || 'Général',
        text: q.text,
        choices: q.choices,
        correct: q.correct,
        explanation: q.explanation || '',
      }));
      const ok = await persist({ ...data, questions: [...data.questions, ...valid] }, `${valid.length} question(s) importée(s)`);
      if (ok) setImportMsg(`${valid.length} question(s) importée(s), ${list.length - valid.length} ignorée(s).`);
    } catch (err) {
      setImportMsg(`Fichier invalide : ${err.message}`);
    }
  }

  function clearAll() {
    const answer = window.prompt('Pour supprimer TOUTES les questions, tapez SUPPRIMER');
    if (answer === 'SUPPRIMER') persist({ ...data, questions: [] }, 'Toutes les questions ont été supprimées');
  }

  return (
    <>
      <ThemeCard data={data} persist={persist} />
      <BannerCard data={data} persist={persist} />

      <form className="card" onSubmit={saveSettings}>
        <h2>Réglages</h2>
        <div className="grid-2">
          <label className="field">
            <span>Chronomètre par question (secondes, 0 = sans limite)</span>
            <input type="number" min="0" step="5" value={seconds} onChange={(e) => setSeconds(e.target.value)} />
          </label>
          <label className="field">
            <span>Date de l’examen</span>
            <input type="date" value={examDate} onChange={(e) => setExamDate(e.target.value)} />
          </label>
        </div>
        <button className="btn btn-primary">Enregistrer les réglages</button>
      </form>

      <section className="card">
        <h2>Sauvegarde</h2>
        <p className="muted">Téléchargez une copie de toutes les questions, ou importez un fichier JSON (les questions sont ajoutées).</p>
        <div className="form-actions">
          <button className="btn" onClick={exportJson}>
            Télécharger (JSON)
          </button>
          <label className="btn">
            Importer un fichier JSON
            <input type="file" accept="application/json,.json" hidden onChange={importJson} />
          </label>
          <button className="btn btn-danger" onClick={clearAll}>
            Tout supprimer
          </button>
        </div>
        {importMsg && <p className="muted">{importMsg}</p>}
      </section>
    </>
  );
}
