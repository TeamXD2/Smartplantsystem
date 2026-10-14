import { useCallback, useEffect, useState } from 'react';
import { fetchRequests, reviewRequest } from '../queries/requests';
import StatusTag from './StatusTag';
import ChangesList from './ChangesList';

// Officer / Admin: edit and delete requests from Botanists. Approving applies the
// change automatically (the backend does it and writes the audit trail).
export default function ChangeRequestsPanel() {
  const [status, setStatus] = useState('Pending');
  const [requests, setRequests] = useState([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    try {
      setRequests(await fetchRequests(status));
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }, [status]);

  useEffect(() => {
    load();
  }, [load]);

  async function review(request, decision) {
    const comment = window.prompt(
      decision === 'Approved' ? 'Comment for the botanist (optional):' : 'Reason for rejecting (optional):'
    );
    if (comment === null) return; // cancelled
    try {
      await reviewRequest(request.request_id, decision, comment.trim());
      setNotice(`Request ${decision.toLowerCase()}.`);
      setError('');
    } catch (err) {
      setNotice('');
      setError(err.message);
    }
    load();
  }

  return (
    <div>
      {error && <div className="alert alert-error">{error}</div>}
      {notice && <div className="alert alert-success">{notice}</div>}

      <div className="row-actions" style={{ marginBottom: '1rem' }}>
        <select className="input" value={status} onChange={(e) => setStatus(e.target.value)} style={{ width: 190 }}>
          <option value="Pending">Pending</option>
          <option value="Approved">Approved</option>
          <option value="Rejected">Rejected</option>
          <option value="">All requests</option>
        </select>
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr><th>Plant</th><th>Request</th><th>Requested by</th><th>Status</th><th>Sent</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {requests.map((r) => (
              <tr key={r.request_id}>
                <td>
                  <div className="sci">{r.plant_scientific_name_snapshot}</div>
                  <div className="muted" style={{ fontSize: '0.8rem' }}>{r.plant_qr_code_snapshot}</div>
                </td>
                <td>
                  {r.request_type === 'DELETE' ? <strong>Delete this record</strong> : <ChangesList changes={r.proposed_changes} />}
                </td>
                <td>{r.requested_by_name}</td>
                <td>
                  <StatusTag status={r.status} />
                  {r.review_comment && <div className="muted" style={{ fontSize: '0.8rem', marginTop: 4 }}>{r.review_comment}</div>}
                </td>
                <td className="muted">{new Date(r.requested_at).toLocaleDateString()}</td>
                <td>
                  {r.status === 'Pending' && (
                    <div className="row-actions">
                      <button className="btn btn-forest btn-sm" onClick={() => review(r, 'Approved')}>Approve</button>
                      <button className="btn btn-danger btn-sm" onClick={() => review(r, 'Rejected')}>Reject</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {requests.length === 0 && (
              <tr className="empty-row"><td colSpan="6">No requests found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
