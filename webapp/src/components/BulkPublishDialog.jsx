import { useEffect, useState } from 'react';
import Dialog from './ui/Dialog';
import Field from './ui/Field';
import { LOCATION_HELP } from './LocationChoice';
import { plural } from '../utils/bulk';

// Publishing many records at once still needs an explicit choice about location,
// because the database default is "Public" (exact GPS). Hidden is preselected.
export default function BulkPublishDialog({ open, count, onClose, onConfirm }) {
  const [location, setLocation] = useState('Hidden');
  const [area, setArea] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) { setLocation('Hidden'); setArea(''); setError(''); }
  }, [open]);

  function submit(e) {
    e.preventDefault();
    if (location === 'Approximate' && !area.trim()) {
      setError('Enter the area name visitors should see.');
      return;
    }
    onConfirm({ location, area: area.trim() });
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Publish ${plural(count, 'record')}`}
      description="Published records appear in the public catalog straight away. Choose how much of their location visitors may see."
      size="sm"
      footer={(
        <>
          <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button type="submit" form="bulk-publish-form" className="btn btn-primary">Publish {plural(count, 'record')}</button>
        </>
      )}
    >
      <form id="bulk-publish-form" onSubmit={submit} className="stack">
        {error && <div className="alert alert-error" role="alert">{error}</div>}
        <Field label="Location shown to visitors" hint={LOCATION_HELP[location]}>
          <select className="input" value={location} onChange={(e) => setLocation(e.target.value)}>
            <option value="Hidden">Hidden (safest)</option>
            <option value="Approximate">Approximate (area name only)</option>
            <option value="Public">Public (exact GPS)</option>
          </select>
        </Field>
        {location === 'Approximate' && (
          <Field label="Area name" hint="Used for every selected record.">
            <input className="input" maxLength={150} placeholder="e.g. Niah National Park" value={area} onChange={(e) => setArea(e.target.value)} autoFocus />
          </Field>
        )}
        {location === 'Public' && (
          <div className="alert alert-warning">Exact GPS will be public for all {count}. Rare or endangered plants should stay Hidden or Approximate.</div>
        )}
      </form>
    </Dialog>
  );
}
