import { FIELD_LABELS } from '../plantFields';

// Shows the fields of an EDIT request ({ height_cm: 150 }) in readable form.
export default function ChangesList({ changes }) {
  const entries = Object.entries(changes || {});
  if (entries.length === 0) return <span className="muted">—</span>;
  return (
    <ul className="changes-list">
      {entries.map(([field, value]) => (
        <li key={field}>
          <strong>{FIELD_LABELS[field] || field}:</strong> {value === null ? '(empty)' : String(value)}
        </li>
      ))}
    </ul>
  );
}
