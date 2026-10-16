import Logo from './Logo.jsx';
import { daysUntil } from '../utils.js';

export default function Header({ route, settings }) {
  const days = daysUntil(settings.examDate);
  return (
    <header className="topbar">
      <a href="#/" className="brand">
        <Logo size={42} />
        <span className="brand-text">
          <strong>QCM Pharma</strong>
          <small>Résidanat · Alger</small>
        </span>
      </a>
      <nav className="nav">
        <a href="#/" className={route === '/' ? 'active' : ''}>
          Accueil
        </a>
        <a href="#/sara" className={route.startsWith('/sara') ? 'active' : ''}>
          Espace Sara
        </a>
        <a href="#/admin" className={route.startsWith('/admin') ? 'active' : ''}>
          Admin
        </a>
      </nav>
      {days !== null && days >= 0 && (
        <div className="exam-chip" title={`Examen le ${settings.examDate}`}>
          {days === 0 ? 'Jour J !' : `J-${days}`}
        </div>
      )}
    </header>
  );
}
