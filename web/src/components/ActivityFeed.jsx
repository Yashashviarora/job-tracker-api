import { STATUS_LABEL } from '../constants.js';

function describe(entry) {
  const label = (s) => STATUS_LABEL[s] || s;
  switch (entry.action) {
    case 'created':
      return <>Added as <b>{label(entry.to)}</b></>;
    case 'status_changed':
      return (
        <>
          <b>{label(entry.from)}</b> → <b>{label(entry.to)}</b>
        </>
      );
    case 'deleted':
      return <>Deleted (was <b>{label(entry.from)}</b>)</>;
    default:
      return entry.action;
  }
}

function relative(iso) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h ago`;
  return new Date(iso).toLocaleDateString();
}

// companyById turns application ids into company names for rows that are in
// the loaded list. Deleted applications fall back to "#id".
export default function ActivityFeed({ entries, companyById, loading }) {
  return (
    <aside className="card feed" aria-label="Recent activity">
      <h2>Recent activity</h2>
      {loading && entries.length === 0 && <p className="muted">Loading…</p>}
      {!loading && entries.length === 0 && <p className="muted">Nothing yet.</p>}
      <ul>
        {entries.map((e) => (
          <li key={e._id}>
            <div className="feed-main">
              <span className="strong">{companyById[e.application_id] || `#${e.application_id}`}</span>
              <span className="feed-text">{describe(e)}</span>
            </div>
            <time className="muted" dateTime={e.at} title={new Date(e.at).toLocaleString()}>
              {relative(e.at)}
            </time>
          </li>
        ))}
      </ul>
    </aside>
  );
}
