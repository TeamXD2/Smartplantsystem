// Edit / delete requests: Botanists ask, Officers and Admins decide.
import { api } from '../api';

// Botanist. type: 'EDIT' (External Botanists; proposedChanges = changed fields) or 'DELETE'.
export function submitRequest({ plantId, type, proposedChanges }) {
  return api('/api/requests', {
    method: 'POST',
    body: { plant_id: plantId, request_type: type, proposed_changes: proposedChanges },
  });
}

// Botanist: their own requests, with status and the reviewer's comment.
export function fetchMyRequests(status) {
  return api('/api/requests/mine', { params: { status } });
}

// Officer / Admin. status: 'Pending' | 'Approved' | 'Rejected' (blank = all)
export function fetchRequests(status) {
  return api('/api/requests', { params: { status } });
}

// decision: 'Approved' | 'Rejected'. Approving applies the edit/delete automatically.
export function reviewRequest(id, decision, comment) {
  return api(`/api/requests/${id}/review`, {
    method: 'PATCH',
    body: { decision, review_comment: comment || undefined },
  });
}
