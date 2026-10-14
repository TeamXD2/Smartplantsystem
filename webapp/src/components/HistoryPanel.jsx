import { useEffect, useState } from 'react';
import { fetchPlantHistory } from '../queries/plants';

// Audit trail of one plant (GET /api/plants/:id/history). The backend already
// writes a ready-to-show sentence in `summary`.
export default function HistoryPanel({ plantId }) {
  const [logs, setLogs] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchPlantHistory(plantId).then(setLogs).catch((err) => setError(err.message));
  }, [plantId]);

  if (error) return <div className="alert alert-error">{error}</div>;
  if (!logs) return <p className="muted">Loading history…</p>;
  if (logs.length === 0) return <p className="muted">No history yet.</p>;

  return (
    <ul className="history-list">
      {logs.map((log) => (
        <li key={log.log_id}>
          <span>{log.summary}</span>
          <span className="muted">{new Date(log.created_at).toLocaleString()}</span>
        </li>
      ))}
    </ul>
  );
}
