import { useEffect, useState } from 'react';
import { fetchMyRequests } from '../queries/requests';
import StatusTag from './StatusTag';
import ChangesList from './ChangesList';

// A Botanist's own edit / delete requests, with the Officer's decision and comment.
export default function MyRequestsPanel({ refreshKey = 0 }) {
  const [requests, setRequests] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchMyRequests().then(setRequests).catch((err) => setError(err.message));
  }, [refreshKey]);

  return (
    <div>
      {error && <div className="alert alert-error">{error}</div>}
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr><th>Plant</th><th>Request</th><th>Status</th><th>Officer's comment</th><th>Sent</th></tr>
          </thead>
          <tbody>
            {requests.map((r) => (
              <tr key={r.request_id}>
                <td>
                  <div className="sci">{r.plant_scientific_name_snapshot}</div>
                  <div className="muted" style={{ fontSize: '0.8rem' }}>{r.plant_qr_code_snapshot}</div>
                </td>
                <td>
                  {r.request_type === 'DELETE' ? 'Delete this record' : <ChangesList changes={r.proposed_changes} />}
                </td>
                <td><StatusTag status={r.status} /></td>
                <td className="muted">
                  {r.review_comment || '—'}
                  {r.reviewed_by_name && <div style={{ fontSize: '0.8rem' }}>by {r.reviewed_by_name}</div>}
                </td>
                <td className="muted">{new Date(r.requested_at).toLocaleDateString()}</td>
              </tr>
            ))}
            {requests.length === 0 && (
              <tr className="empty-row"><td colSpan="5">You haven't sent any requests.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
