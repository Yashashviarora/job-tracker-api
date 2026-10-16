import { useState } from 'react';
import { api, ApiError } from '../api.js';
import { STATUSES, STATUS_LABEL } from '../constants.js';

const EMPTY = {
  company: '',
  role_title: '',
  source: '',
  status: 'applied',
  applied_on: '',
  salary_expected: '',
  notes: '',
};

// Form state -> request body. Empty optionals are dropped, salary becomes a
// number. When editing, only changed fields are sent, which is what PATCH is for.
function toBody(form, original) {
  const body = {};
  for (const key of Object.keys(EMPTY)) {
    let value = form[key];
    if (key === 'salary_expected') value = value === '' ? undefined : Number(value);
    else if (value === '') value = undefined;

    if (original) {
      const before = original[key] ?? undefined;
      if (value !== undefined && value !== before) body[key] = value;
    } else if (value !== undefined) {
      body[key] = value;
    }
  }
  return body;
}

export default function ApplicationForm({ initial, onSaved, onCancel }) {
  const editing = Boolean(initial);
  const [form, setForm] = useState(() =>
    editing
      ? { ...EMPTY, ...Object.fromEntries(Object.keys(EMPTY).map((k) => [k, initial[k] ?? ''])) }
      : EMPTY,
  );
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setError(null);
    const body = toBody(form, editing ? initial : null);
    if (editing && Object.keys(body).length === 0) {
      onCancel();
      return;
    }
    setBusy(true);
    try {
      const saved = editing
        ? await api.updateApplication(initial.id, body)
        : await api.createApplication(body);
      onSaved(saved, editing ? 'updated' : 'created');
    } catch (err) {
      if (err instanceof ApiError) {
        const detail = err.details?.map((d) => `${d.field}: ${d.message}`).join('; ');
        setError(detail || err.message);
      } else {
        setError('Network error. Try again.');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card form" onSubmit={submit}>
      <h2>{editing ? `Edit ${initial.company}` : 'New application'}</h2>

      <div className="grid2">
        <label>
          Company *
          <input value={form.company} onChange={set('company')} required maxLength={255} />
        </label>
        <label>
          Role *
          <input value={form.role_title} onChange={set('role_title')} required maxLength={255} />
        </label>
        <label>
          Status
          <select value={form.status} onChange={set('status')}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Applied on
          <input type="date" value={form.applied_on} onChange={set('applied_on')} />
        </label>
        <label>
          Source
          <input value={form.source} onChange={set('source')} placeholder="LinkedIn, referral…" maxLength={100} />
        </label>
        <label>
          Expected salary
          <input type="number" min="0" step="1000" value={form.salary_expected} onChange={set('salary_expected')} />
        </label>
      </div>

      <label>
        Notes
        <textarea rows={3} value={form.notes} onChange={set('notes')} maxLength={5000} />
      </label>

      {error && <p className="error" role="alert">{error}</p>}

      <div className="row">
        <button type="submit" className="primary" disabled={busy}>
          {busy ? 'Saving…' : editing ? 'Save changes' : 'Add application'}
        </button>
        <button type="button" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
      </div>
    </form>
  );
}
