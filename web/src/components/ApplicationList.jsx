import { STATUS_LABEL } from '../constants.js';

function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString();
}

function formatSalary(value) {
  if (value === null || value === undefined) return '—';
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(value);
}

export default function ApplicationList({ items, loading, hasMore, onMore, onEdit, onDelete }) {
  if (!loading && items.length === 0) {
    return (
      <div className="card empty">
        <p>No applications match. Add one with the button above.</p>
      </div>
    );
  }

  return (
    <div className="card table-wrap">
      <table>
        <thead>
          <tr>
            <th>Company</th>
            <th>Role</th>
            <th>Status</th>
            <th>Applied</th>
            <th className="num">Salary</th>
            <th>Source</th>
            <th aria-label="Actions" />
          </tr>
        </thead>
        <tbody>
          {items.map((a) => (
            <tr key={a.id}>
              <td className="strong">{a.company}</td>
              <td>{a.role_title}</td>
              <td>
                <span className={`chip chip-${a.status}`}>{STATUS_LABEL[a.status] || a.status}</span>
              </td>
              <td>{formatDate(a.applied_on)}</td>
              <td className="num">{formatSalary(a.salary_expected)}</td>
              <td className="muted">{a.source || '—'}</td>
              <td className="actions">
                <button type="button" className="small" onClick={() => onEdit(a)}>
                  Edit
                </button>
                <button type="button" className="small danger" onClick={() => onDelete(a)}>
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="table-foot">
        {loading && <span className="muted">Loading…</span>}
        {!loading && hasMore && (
          <button type="button" onClick={onMore}>
            Load more
          </button>
        )}
        {!loading && !hasMore && items.length > 0 && (
          <span className="muted">{items.length} shown · end of list</span>
        )}
      </div>
    </div>
  );
}
