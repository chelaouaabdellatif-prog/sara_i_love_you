import { useState } from 'react';
import Logo from './Logo.jsx';

// onSubmit(password) renvoie un message d'erreur, ou rien si c'est bon.
export default function PasswordForm({ title, subtitle, onSubmit }) {
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const message = await onSubmit(value);
      if (message) setError(message);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card login" onSubmit={submit}>
      <div className="login-logo">
        <Logo size={64} />
      </div>
      <h1>{title}</h1>
      <p className="muted">{subtitle}</p>
      <label className="field">
        <span>Mot de passe</span>
        <input type="password" value={value} onChange={(e) => setValue(e.target.value)} autoFocus />
      </label>
      {error && <p className="alert alert-error">{error}</p>}
      <button className="btn btn-primary btn-lg" disabled={busy || !value}>
        {busy ? 'Vérification…' : 'Entrer'}
      </button>
    </form>
  );
}
