import { useCallback, useEffect, useState } from 'react';
import { api, hasSession, clearTokens, ApiError } from './api.js';
import AuthForm from './components/AuthForm.jsx';
import Dashboard from './components/Dashboard.jsx';

// Top-level state machine: 'booting' -> 'anon' | 'authed'.
// Also pings /health on load so the free-tier API starts waking up while the
// user is still looking at the login form.
export default function App() {
  const [phase, setPhase] = useState('booting');
  const [user, setUser] = useState(null);
  const [waking, setWaking] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const slow = setTimeout(() => setWaking(true), 2500);

    (async () => {
      try {
        if (hasSession()) {
          const me = await api.me();
          if (!cancelled) {
            setUser(me);
            setPhase('authed');
          }
        } else {
          await api.health().catch(() => {});
          if (!cancelled) setPhase('anon');
        }
      } catch (err) {
        // A dead refresh token or a 401 means "not logged in", not an error.
        if (err instanceof ApiError && err.status === 401) clearTokens();
        if (!cancelled) setPhase('anon');
      } finally {
        clearTimeout(slow);
        if (!cancelled) setWaking(false);
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(slow);
    };
  }, []);

  const handleAuthed = useCallback((u) => {
    setUser(u);
    setPhase('authed');
  }, []);

  const handleLogout = useCallback(async () => {
    await api.logout();
    setUser(null);
    setPhase('anon');
  }, []);

  if (phase === 'booting') {
    return (
      <main className="centered">
        <p className="muted">
          {waking ? 'Waking up the server (free tier, up to a minute)…' : 'Loading…'}
        </p>
      </main>
    );
  }

  if (phase === 'anon') {
    return <AuthForm onAuthed={handleAuthed} waking={waking} />;
  }

  return <Dashboard user={user} onLogout={handleLogout} />;
}
