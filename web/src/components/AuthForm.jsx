import { useState } from 'react';
import { api, ApiError } from '../api.js';

export default function AuthForm({ onAuthed }) {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const user = mode === 'login' ? await api.login(email, password) : await api.register(email, password);
      onAuthed(user);
    } catch (err) {
      if (err instanceof ApiError) {
        const detail = err.details?.map((d) => `${d.field}: ${d.message}`).join('; ');
        setError(detail || err.message);
      } else {
        setError('Could not reach the server. It may be waking up; try again in a moment.');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="centered">
      <form className="card auth" onSubmit={submit}>
        <h1>Job Tracker</h1>
        <p className="muted">Track every application, from applied to offer.</p>

        <label>
          Email
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>

        <label>
          Password
          <input
            type="password"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
          />
        </label>

        {error && <p className="error" role="alert">{error}</p>}

        <button type="submit" className="primary" disabled={busy}>
          {busy ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Create account'}
        </button>

        <button
          type="button"
          className="link"
          onClick={() => {
            setMode(mode === 'login' ? 'register' : 'login');
            setError(null);
          }}
        >
          {mode === 'login' ? 'New here? Create an account' : 'Already have an account? Log in'}
        </button>
      </form>
    </main>
  );
}
