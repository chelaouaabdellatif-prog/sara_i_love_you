import Logo from '../components/Logo.jsx';
import { countByModule, daysUntil } from '../utils.js';

export default function Home({ data }) {
  const modules = countByModule(data.questions);
  const days = daysUntil(data.settings.examDate);

  return (
    <div className="home">
      <section className="hero card">
        <Logo size={96} />
        <div>
          <h1>Bonjour Sara</h1>
          <p className="muted">
            Entraînement QCM pour le concours de résidanat en pharmacie — Alger. La correction s’affiche après chaque
            question.
          </p>
          {days !== null && days >= 0 && (
            <p className="countdown">
              {days === 0 ? (
                <>C’est le jour J. Respire, tu es prête !</>
              ) : (
                <>
                  Plus que <strong>{days}</strong> jour{days > 1 ? 's' : ''} avant l’examen.
                </>
              )}
            </p>
          )}
          <a href="#/sara" className="btn btn-primary btn-lg">
            Commencer l’entraînement
          </a>
        </div>
      </section>

      <section className="stats">
        <div className="stat card">
          <span className="stat-value">{data.questions.length}</span>
          <span className="stat-label">questions</span>
        </div>
        <div className="stat card">
          <span className="stat-value">{modules.length}</span>
          <span className="stat-label">modules</span>
        </div>
        <div className="stat card">
          <span className="stat-value">{data.settings.secondsPerQuestion || '∞'}</span>
          <span className="stat-label">secondes / question</span>
        </div>
      </section>

      {modules.length > 0 && (
        <section className="card">
          <h2>Modules disponibles</h2>
          <div className="tags">
            {modules.map((m) => (
              <span key={m.name} className="tag">
                {m.name} <b>{m.count}</b>
              </span>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
