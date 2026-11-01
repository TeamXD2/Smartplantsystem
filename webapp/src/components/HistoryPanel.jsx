import { useEffect, useState } from 'react';
import { fetchPlantHistory } from '../queries/plants';
import { Skeleton } from './ui/Skeleton';
import { relativeTime, exactTime } from '../hooks';

// Audit trail of one plant (GET /api/plants/:id/history). The backend already
// writes a ready-to-show sentence in `summary`.
export default function HistoryPanel({ plantId }) {
  const [logs, setLogs] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchPlantHistory(plantId).then(setLogs).catch((err) => setError(err.message));
  }, [plantId]);

  if (error) return <div className="alert alert-error" role="alert">{error}</div>;
  if (!logs) return <div aria-busy="true"><Skeleton width="80%" height={14} /><Skeleton width="60%" height={14} style={{ marginTop: 10 }} /></div>;
  if (logs.length === 0) return <p className="muted">No history yet.</p>;

  return (
    <ul className="history-list">
      {logs.map((log) => (
        <li key={log.log_id}>
          <span>{log.summary}</span>
          <time className="muted" dateTime={log.created_at} title={exactTime(log.created_at)}>{relativeTime(log.created_at)}</time>
        </li>
      ))}
    </ul>
  );
}
