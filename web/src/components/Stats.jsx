import { STATUSES, STATUS_LABEL } from '../constants.js';

// Stat tiles: one hero number (total) and one tile per pipeline stage.
// Clicking a stage applies it as the list filter; clicking again clears it.
export default function Stats({ stats, activeStatus, onPick }) {
  if (!stats) return <div className="stats skeleton" aria-hidden="true" />;

  return (
    <section className="stats" aria-label="Application counts">
      <button
        type="button"
        className={`tile hero ${activeStatus === '' ? 'active' : ''}`}
        onClick={() => onPick('')}
      >
        <span className="tile-value">{stats.total}</span>
        <span className="tile-label">Total</span>
      </button>

      {STATUSES.map((s) => (
        <button
          key={s}
          type="button"
          className={`tile ${activeStatus === s ? 'active' : ''}`}
          onClick={() => onPick(activeStatus === s ? '' : s)}
        >
          <span className="tile-value">{stats.byStatus[s]}</span>
          <span className={`chip chip-${s}`}>{STATUS_LABEL[s]}</span>
        </button>
      ))}
    </section>
  );
}
