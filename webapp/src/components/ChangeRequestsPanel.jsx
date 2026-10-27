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
  const [reviewing, setReviewing] = useState(null); // { id, decision }
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);

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

  // Opens a small comment box in the row (browser pop-ups are blocked in some
  // browsers, e.g. VS Code's built-in one, so no window.prompt here).
  function startReview(request, decision) {
    setReviewing({ id: request.request_id, decision });
    setComment('');
  }

  async function confirmReview(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await reviewRequest(reviewing.id, reviewing.decision, comment.trim());
      setNotice(`Request ${reviewing.decision.toLowerCase()}.`);
      setError('');
      setReviewing(null);
    } catch (err) {
      setNotice('');
      setError(err.message);
    } finally {
      setBusy(false);
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
                  {r.status === 'Pending' && (reviewing && reviewing.id === r.request_id ? (
                    <form className="review-box" onSubmit={confirmReview}>
                      <input
                        className="input"
                        autoFocus
                        maxLength={500}
                        placeholder={reviewing.decision === 'Approved' ? 'Comment (optional)' : 'Reason (optional)'}
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                      />
                      <div className="row-actions">
                        <button type="submit" className={`btn btn-sm ${reviewing.decision === 'Approved' ? 'btn-forest' : 'btn-danger'}`} disabled={busy}>
                          {busy ? 'Saving...' : reviewing.decision === 'Approved' ? 'Confirm approve' : 'Confirm reject'}
                        </button>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setReviewing(null)}>Cancel</button>
                      </div>
                    </form>
                  ) : (
                    <div className="row-actions">
                      <button className="btn btn-forest btn-sm" onClick={() => startReview(r, 'Approved')}>Approve</button>
                      <button className="btn btn-danger btn-sm" onClick={() => startReview(r, 'Rejected')}>Reject</button>
                    </div>
                  ))}
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
