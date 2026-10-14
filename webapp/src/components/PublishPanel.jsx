import { useState } from 'react';
import { setVisibility } from '../queries/plants';

const LOCATION_HELP = {
  Public: 'Visitors see the exact GPS point.',
  Approximate: 'Visitors see only the area name below.',
  Hidden: 'Visitors see no location at all.',
};

// Officer / Admin: publish a plant to the public catalog and decide how much of
// its location visitors may see (PATCH /api/plants/:id/visibility).
export default function PublishPanel({ plant, onDone }) {
  const [status, setStatus] = useState(plant.publication_status);
  const [location, setLocation] = useState(plant.location_visibility || 'Hidden');
  const [area, setArea] = useState(plant.general_location || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (status === 'Published' && location === 'Approximate' && !area.trim()) {
      setError('Enter the area name visitors should see, or choose a different location setting.');
      return;
    }
    setBusy(true);
    try {
      await setVisibility(plant.plant_id, {
        publication_status: status,
        location_visibility: location,
        general_location: area.trim() || null,
      });
      onDone('Visibility updated.');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="stack">
      {error && <div className="alert alert-error">{error}</div>}
      <div className="form-grid-3 form-grid">
        <div className="field">
          <label>Publication</label>
          <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="Under Research">Under Research (staff only)</option>
            <option value="Published">Published (public catalog)</option>
          </select>
        </div>
        <div className="field">
          <label>Location shown to visitors</label>
          <select className="input" value={location} onChange={(e) => setLocation(e.target.value)}>
            <option value="Hidden">Hidden</option>
            <option value="Approximate">Approximate</option>
            <option value="Public">Public (exact GPS)</option>
          </select>
          <span className="field-hint">{LOCATION_HELP[location]}</span>
        </div>
        <div className="field">
          <label>Area name</label>
          <input
            className="input"
            maxLength={150}
            placeholder="e.g. Niah National Park"
            value={area}
            onChange={(e) => setArea(e.target.value)}
          />
        </div>
      </div>
      <div>
        <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>
          {busy ? 'Saving…' : 'Save visibility'}
        </button>
      </div>
    </form>
  );
}
