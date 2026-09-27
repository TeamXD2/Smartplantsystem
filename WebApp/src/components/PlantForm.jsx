import { useState } from 'react';
import { MapPin } from 'lucide-react';

const EMPTY = {
  scientific_name: '',
  common_name: '',
  family: '',
  genus: '',
  species: '',
  description: '',
  latitude: '',
  longitude: '',
};

function pickEditableFields(source) {
  const picked = { ...EMPTY };
  Object.keys(EMPTY).forEach((key) => {
    if (source && source[key] != null) picked[key] = source[key];
  });
  return picked;
}

export default function PlantForm({ initial, onSubmit, submitLabel = 'Submit record' }) {
  const [fields, setFields] = useState(pickEditableFields(initial));
  const [image, setImage] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [locating, setLocating] = useState(false);

  function update(key, value) {
    setFields((f) => ({ ...f, [key]: value }));
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by this browser.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        update('latitude', pos.coords.latitude.toFixed(7));
        update('longitude', pos.coords.longitude.toFixed(7));
        setLocating(false);
      },
      () => {
        setError('Could not get your current location.');
        setLocating(false);
      }
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      // Turn form strings into the types the database expects: blank
      // optional fields become null, and lat/lng become real numbers.
      const payload = {
        ...fields,
        description: fields.description || null,
        latitude: fields.latitude ? Number(fields.latitude) : null,
        longitude: fields.longitude ? Number(fields.longitude) : null,
      };
      await onSubmit(payload, image);
      setFields(pickEditableFields());
      setImage(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {error && <div className="alert alert-error">{error}</div>}

      <div className="form-grid">
        <div className="field span-2">
          <label>Scientific name</label>
          <input className="input" required value={fields.scientific_name}
                 onChange={(e) => update('scientific_name', e.target.value)} />
        </div>
        <div className="field span-2">
          <label>Common name</label>
          <input className="input" required value={fields.common_name}
                 onChange={(e) => update('common_name', e.target.value)} />
        </div>
      </div>

      <div className="form-grid-3 form-grid">
        <div className="field">
          <label>Family</label>
          <input className="input" required value={fields.family}
                 onChange={(e) => update('family', e.target.value)} />
        </div>
        <div className="field">
          <label>Genus</label>
          <input className="input" required value={fields.genus}
                 onChange={(e) => update('genus', e.target.value)} />
        </div>
        <div className="field">
          <label>Species</label>
          <input className="input" required value={fields.species}
                 onChange={(e) => update('species', e.target.value)} />
        </div>
      </div>

      <div className="field">
        <label>Description</label>
        <textarea className="input" rows="3" value={fields.description}
                  onChange={(e) => update('description', e.target.value)} />
      </div>

      <div className="form-grid-3 form-grid" style={{ alignItems: 'end' }}>
        <div className="field">
          <label>Latitude</label>
          <input className="input" value={fields.latitude}
                 onChange={(e) => update('latitude', e.target.value)} />
        </div>
        <div className="field">
          <label>Longitude</label>
          <input className="input" value={fields.longitude}
                 onChange={(e) => update('longitude', e.target.value)} />
        </div>
        <div className="field">
          <button type="button" className="btn btn-outline btn-block" onClick={useCurrentLocation} disabled={locating}>
            <MapPin size={16} /> {locating ? 'Locating…' : 'Use my location'}
          </button>
        </div>
      </div>

      <div className="field">
        <label>Photo</label>
        <input type="file" className="input" accept="image/jpeg,image/png,image/webp"
               onChange={(e) => setImage(e.target.files[0])} />
      </div>

      <button type="submit" className="btn btn-primary" disabled={busy}>
        {busy ? 'Saving…' : submitLabel}
      </button>
    </form>
  );
}
