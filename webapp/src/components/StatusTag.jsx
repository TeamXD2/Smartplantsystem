// Coloured label for a plant's publication status or a request's status.
const CLASS = {
  'Under Research': 'tag tag-pending',
  Published: 'tag tag-approved',
  Pending: 'tag tag-pending',
  Approved: 'tag tag-approved',
  Rejected: 'tag tag-rejected',
};

export default function StatusTag({ status }) {
  return <span className={CLASS[status] || 'tag'}>{status}</span>;
}
