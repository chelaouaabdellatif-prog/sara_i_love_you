import { useEffect, useState } from 'react';
import AnnouncementBar from './components/AnnouncementBar.jsx';
import Header from './components/Header.jsx';
import PasswordForm from './components/PasswordForm.jsx';
import Home from './pages/Home.jsx';
import Sara from './pages/Sara.jsx';
import Admin from './pages/Admin.jsx';
import History from './pages/History.jsx';
import { AuthError, DEFAULT_SETTINGS, isLocalMode, loadData } from './api.js';
import { storage } from './utils.js';

const PW_KEY = 'qcm-password';
const THEME_KEY = 'qcm-theme';

function useHashRoute() {
  const read = () => window.location.hash.slice(1) || '/';
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const onChange = () => {
      setRoute(read());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}

export default function App() {
  const route = useHashRoute();
  const [password, setPassword] = useState(() => storage.get(PW_KEY, ''));
  const [data, setData] = useState(null);
  const [needLogin, setNeedLogin] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadData(password)
      .then(setData)
      .catch((err) => (err instanceof AuthError ? setNeedLogin(true) : setError(err.message)));
    // Chargement initial uniquement ; les connexions suivantes passent par login().
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Le thème vient des réglages admin ; on le garde aussi en mémoire pour l'écran de connexion.
  const theme = data?.settings.theme ?? storage.get(THEME_KEY, DEFAULT_SETTINGS.theme);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    if (data) storage.set(THEME_KEY, theme);
  }, [theme, data]);

  // Essaie un mot de passe ; renvoie le rôle obtenu ('sara' | 'admin') ou null s'il est faux.
  async function login(pw) {
    try {
      const next = await loadData(pw);
      setPassword(pw);
      storage.set(PW_KEY, pw);
      setData(next);
      setNeedLogin(false);
      return next.role;
    } catch (err) {
      if (err instanceof AuthError) return null;
      throw err;
    }
  }

  function logout() {
    storage.set(PW_KEY, '');
    window.location.hash = '#/';
    window.location.reload();
  }

  let page;
  if (error) {
    page = (
      <div className="card alert alert-error">
        <strong>Impossible de charger les questions.</strong>
        <p>{error}</p>
      </div>
    );
  } else if (needLogin) {
    page = (
      <PasswordForm
        title="Bienvenue Sara"
        subtitle="Entre ton mot de passe pour commencer l’entraînement."
        onSubmit={async (pw) => ((await login(pw)) ? '' : 'Mot de passe incorrect.')}
      />
    );
  } else if (!data) {
    page = <div className="loading">Chargement…</div>;
  } else if (route.startsWith('/admin')) {
    page = <Admin data={data} onDataChange={setData} password={password} onLogin={login} />;
  } else if (route.startsWith('/sara')) {
    page = <Sara key={route} data={data} route={route} password={password} />;
  } else if (route.startsWith('/historique')) {
    page = <History route={route} password={password} isAdmin={data.role === 'admin'} />;
  } else {
    page = <Home data={data} />;
  }

  return (
    <div className="app">
      {data && <AnnouncementBar banner={data.settings.banner} />}
      <Header route={route} settings={data?.settings ?? DEFAULT_SETTINGS} />
      {data && isLocalMode() && (
        <div className="local-banner">
          Mode local : les questions sont gardées dans ce navigateur. Une fois en ligne sur Cloudflare, elles seront
          partagées.
        </div>
      )}
      <main className="container">{page}</main>
      <footer className="footer">
        Bon courage Sara — tu vas réussir ton résidanat !
        {data && !isLocalMode() && (
          <>
            {' · '}
            <button className="link-btn" onClick={logout}>
              Se déconnecter
            </button>
          </>
        )}
      </footer>
    </div>
  );
}
