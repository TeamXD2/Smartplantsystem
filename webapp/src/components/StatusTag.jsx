import { CheckCircle2, Clock, XCircle } from 'lucide-react';

// Coloured label for a plant's publication status or a request's status. The
// icon means the status never depends on colour alone.
const KIND = {
  'Under Research': ['tag tag-pending', Clock],
  Published: ['tag tag-approved', CheckCircle2],
  Pending: ['tag tag-pending', Clock],
  Approved: ['tag tag-approved', CheckCircle2],
  Rejected: ['tag tag-rejected', XCircle],
};

export default function StatusTag({ status }) {
  const [className, Icon] = KIND[status] || ['tag', null];
  return <span className={className}>{Icon && <Icon size={13} aria-hidden="true" />}{status}</span>;
}
