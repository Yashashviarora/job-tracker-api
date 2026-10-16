import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, ApiError } from '../api.js';
import { STATUSES, STATUS_LABEL, SORTS } from '../constants.js';
import Stats from './Stats.jsx';
import ApplicationList from './ApplicationList.jsx';
import ApplicationForm from './ApplicationForm.jsx';
import ActivityFeed from './ActivityFeed.jsx';

const PAGE = 20;

function useDebounce(value, ms) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export default function Dashboard({ user, onLogout }) {
  // filters: drive the list query
  const [status, setStatus] = useState('');
  const [company, setCompany] = useState('');
  const [sort, setSort] = useState('created_at');
  const [order, setOrder] = useState('desc');

  // data
  const [items, setItems] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [stats, setStats] = useState(null);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  // null | 'new' | an application object being edited
  const [editing, setEditing] = useState(null);

  const debouncedCompany = useDebounce(company.trim(), 300);
  const reqId = useRef(0);

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }, []);

  const fail = useCallback(
    (err) => {
      if (err instanceof ApiError && err.status === 401) onLogout();
      else showToast(err.message || 'Something went wrong');
    },
    [onLogout, showToast],
  );

  const filters = useMemo(
    () => ({ limit: PAGE, status, company: debouncedCompany, sort, order }),
    [status, debouncedCompany, sort, order],
  );

  // First page whenever filters change. reqId stops a slow, older response
  // from overwriting a newer one when filters change quickly.
  const loadFirst = useCallback(async () => {
    const id = ++reqId.current;
    setLoading(true);
    try {
      const res = await api.listApplications(filters);
      if (id !== reqId.current) return;
      setItems(res.data);
      setCursor(res.nextCursor);
    } catch (err) {
      fail(err);
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, [filters, fail]);

  const loadMore = useCallback(async () => {
    if (!cursor) return;
    const id = ++reqId.current;
    setLoading(true);
    try {
      const res = await api.listApplications({ ...filters, cursor });
      if (id !== reqId.current) return;
      setItems((prev) => [...prev, ...res.data]);
      setCursor(res.nextCursor);
    } catch (err) {
      fail(err);
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, [cursor, filters, fail]);

  const loadSide = useCallback(async () => {
    try {
      const [s, a] = await Promise.all([api.stats(), api.activity({ limit: 15 })]);
      setStats(s);
      setActivity(a.data);
    } catch (err) {
      fail(err);
    }
  }, [fail]);

  useEffect(() => {
    loadFirst();
  }, [loadFirst]);

  useEffect(() => {
    loadSide();
  }, [loadSide]);

  // After any write, reload list and sidebar so counts and feed stay accurate.
  const refreshAll = useCallback(() => {
    loadFirst();
    loadSide();
  }, [loadFirst, loadSide]);

  async function handleDelete(app) {
    if (!window.confirm(`Delete the ${app.company} application?`)) return;
    try {
      await api.deleteApplication(app.id);
      showToast(`Deleted ${app.company}`);
      refreshAll();
    } catch (err) {
      fail(err);
    }
  }

  function handleSaved(saved, kind) {
    setEditing(null);
    showToast(kind === 'created' ? `Added ${saved.company}` : `Updated ${saved.company}`);
    refreshAll();
  }

  const companyById = useMemo(() => Object.fromEntries(items.map((a) => [a.id, a.company])), [items]);

  return (
    <div className="layout">
      <header className="topbar">
        <h1>Job Tracker</h1>
        <div className="row">
          <span className="muted email">{user.email}</span>
          <button type="button" onClick={onLogout}>
            Log out
          </button>
        </div>
      </header>

      <main className="content">
        <Stats stats={stats} activeStatus={status} onPick={setStatus} />

        <section className="toolbar" aria-label="Filters">
          <input
            type="search"
            placeholder="Company starts with…"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            aria-label="Filter by company"
          />
          <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
            <option value="">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
          <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort by">
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setOrder(order === 'desc' ? 'asc' : 'desc')}
            aria-label={order === 'desc' ? 'Sorted descending' : 'Sorted ascending'}
            title="Toggle order"
          >
            {order === 'desc' ? '↓' : '↑'}
          </button>
          <span className="spacer" />
          <button type="button" className="primary" onClick={() => setEditing('new')} disabled={editing !== null}>
            + Add application
          </button>
        </section>

        {editing !== null && (
          <ApplicationForm
            key={editing === 'new' ? 'new' : editing.id}
            initial={editing === 'new' ? null : editing}
            onSaved={handleSaved}
            onCancel={() => setEditing(null)}
          />
        )}

        <div className="two-col">
          <ApplicationList
            items={items}
            loading={loading}
            hasMore={Boolean(cursor)}
            onMore={loadMore}
            onEdit={setEditing}
            onDelete={handleDelete}
          />
          <ActivityFeed entries={activity} companyById={companyById} loading={loading} />
        </div>
      </main>

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}
