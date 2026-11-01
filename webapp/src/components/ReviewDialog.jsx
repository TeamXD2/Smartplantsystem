import { useEffect, useState } from 'react';
import Dialog from './ui/Dialog';
import Field from './ui/Field';
import { plural } from '../utils/bulk';

// Approve or reject one or many requests, with one optional comment that the
// Botanist will see. A dialog fits here: it is a decision that needs a message.
export default function ReviewDialog({ open, decision, requests, busy, onClose, onSubmit }) {
  const [comment, setComment] = useState('');
  useEffect(() => { if (open) setComment(''); }, [open]);
  const approve = decision === 'Approved';
  const n = requests.length;
  const what = n === 1 ? `${requests[0].request_type === 'DELETE' ? 'deletion of' : 'edit to'} ${requests[0].plant_scientific_name_snapshot}` : plural(n, 'request');

  return (
    <Dialog
      open={open}
      onClose={busy ? () => {} : onClose}
      title={`${approve ? 'Approve' : 'Reject'} ${what}?`}
      description={approve ? 'The change is applied straight away and written to the audit log.' : 'Nothing changes on the record. The Botanist sees your reason.'}
      size="sm"
      dismissible={!busy}
      footer={(
        <>
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" form="review-form" className={`btn ${approve ? 'btn-forest' : 'btn-danger-solid'}`} disabled={busy}>
            {busy ? 'Saving…' : approve ? `Approve ${n > 1 ? n : ''}`.trim() : `Reject ${n > 1 ? n : ''}`.trim()}
          </button>
        </>
      )}
    >
      <form id="review-form" onSubmit={(e) => { e.preventDefault(); onSubmit(comment.trim()); }}>
        <Field label={approve ? 'Comment (optional)' : 'Reason (optional)'} hint="Up to 500 characters.">
          <textarea className="input" rows={3} maxLength={500} value={comment} onChange={(e) => setComment(e.target.value)} autoFocus />
        </Field>
      </form>
    </Dialog>
  );
}
