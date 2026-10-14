import { useState } from 'react';
import { MapPin } from 'lucide-react';
import { BASE_FIELDS, EXTRA_FIELDS, FIELD_LABELS, toFormValues, buildPayload, diffPayload } from '../plantFields';

// One form for registering and editing a plant.
//   mode="create": all registration fields; onSubmit gets the full body.
//   mode="edit":   also the conservation fields; onSubmit gets ONLY the changed
//                  fields (so the history stays clean and nothing is overwritten
//                  needlessly). Used for direct edits and for edit requests.
// onSubmit(payload, imageFile) may return the result of a registration; if it
// has a qr_code the QR code is shown below the form.
export default function PlantForm({ mode = 'create', initial, onSubmit, submitLabel = 'Submit record' }) {
  const editing = mode === 'edit';
  const fields = editing ? [...BASE_FIELDS, ...EXTRA_FIELDS] : BASE_FIELDS;

  const [values, setValues] = useState(toFormValues(initial, fields));
  const [image, setImage] = useState(null);
  const [fileKey, setFileKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [locating, setLocating] = useState(false);
  const [created, setCreated] = useState(null);

  function update(key, value) {
    setValues((v) => ({ ...v, [key]: value }));
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
    setCreated(null);

    const hasLat = values.latitude.trim() !== '';
    const hasLng = values.longitude.trim() !== '';
    if (hasLat !== hasLng) {
      setError('Enter both latitude and longitude, or leave both empty.');
      return;
    }

    let payload;
    if (editing) {
      payload = diffPayload(toFormValues(initial, fields), values, fields);
      if (Object.keys(payload).length === 0 && !image) {
        setError('Nothing has changed.');
        return;
      }
    } else {
      payload = buildPayload(values, fields);
    }

    setBusy(true);
    try {
      const result = await onSubmit(payload, image);
      if (!editing) {
        setValues(toFormValues(null, fields));
        if (result && result.qr_code) setCreated(result);
      }
      setImage(null);
      setFileKey((k) => k + 1); // clears the file input
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function input(field, extra = {}) {
    return (
      <input
        className="input"
        value={values[field]}
        onChange={(e) => update(field, e.target.value)}
        {...extra}
      />
    );
  }

  function area(field, rows = 3) {
    return (
      <div className="field">
        <label>{FIELD_LABELS[field]}</label>
        <textarea className="input" rows={rows} value={values[field]} onChange={(e) => update(field, e.target.value)} />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      {error && <div className="alert alert-error">{error}</div>}

      <div className="form-grid">
        <div className="field span-2">
          <label>Scientific name *</label>
          {input('scientific_name', { required: true, maxLength: 150 })}
        </div>
        <div className="field span-2">
          <label>Common name</label>
          {input('common_name', { maxLength: 150 })}
        </div>
      </div>

      <div className="form-grid-3 form-grid">
        <div className="field">
          <label>Family</label>
          {input('family', { maxLength: 100 })}
        </div>
        <div className="field">
          <label>Genus</label>
          {input('genus', { maxLength: 100 })}
        </div>
        <div className="field">
          <label>Species</label>
          {input('species', { maxLength: 100 })}
        </div>
      </div>

      <div className="form-grid">
        <div className="field">
          <label>{FIELD_LABELS.height_cm}</label>
          {input('height_cm', { type: 'number', step: 'any', min: 0, max: 9999.99 })}
        </div>
        <div className="field">
          <label>{FIELD_LABELS.width_cm}</label>
          {input('width_cm', { type: 'number', step: 'any', min: 0, max: 9999.99 })}
        </div>
      </div>

      {area('morphological_notes')}
      {area('surrounding_environment')}

      <div className="form-grid-3 form-grid" style={{ alignItems: 'end' }}>
        <div className="field">
          <label>Latitude</label>
          {input('latitude', { type: 'number', step: 'any', min: -90, max: 90 })}
        </div>
        <div className="field">
          <label>Longitude</label>
          {input('longitude', { type: 'number', step: 'any', min: -180, max: 180 })}
        </div>
        <div className="field">
          <button type="button" className="btn btn-outline btn-block" onClick={useCurrentLocation} disabled={locating}>
            <MapPin size={16} /> {locating ? 'Locating…' : 'Use my location'}
          </button>
        </div>
      </div>

      {editing && (
        <>
          <div className="form-grid">
            <div className="field span-2">
              <label>{FIELD_LABELS.conservation_status}</label>
              {input('conservation_status', { maxLength: 100, placeholder: 'e.g. Endangered' })}
            </div>
          </div>
          {area('ecological_role')}
          {area('medicinal_use')}
          {area('cultural_significance')}
        </>
      )}

      <div className="field">
        <label>{editing ? 'Add another photo' : 'Photo'}</label>
        <input
          key={fileKey}
          type="file"
          className="input"
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => {
            const file = e.target.files[0] || null;
            if (file && file.size > 5 * 1024 * 1024) {
              setError('The photo is larger than 5 MB.');
              e.target.value = '';
              setImage(null);
              return;
            }
            setImage(file);
          }}
        />
        <span className="field-hint">JPEG, PNG or WebP, up to 5 MB.</span>
      </div>

      <button type="submit" className="btn btn-primary" disabled={busy}>
        {busy ? 'Saving…' : submitLabel}
      </button>

      {created && (
        <div className="panel qr-result">
          <img src={created.qr_code_image} alt={`QR code ${created.qr_code}`} width="132" height="132" />
          <div className="stack">
            <strong>Record registered. It stays "Under Research" until an Officer publishes it.</strong>
            <span>
              QR code: <code>{created.qr_code}</code>
            </span>
            <a className="btn btn-outline btn-sm" href={created.qr_code_image} download={`${created.qr_code}.png`}>
              Download QR code
            </a>
            {created.photoError && (
              <div className="alert alert-warning">
                The record was saved, but the photo could not be uploaded: {created.photoError} You can add it
                by editing the record.
              </div>
            )}
          </div>
        </div>
      )}
    </form>
  );
}
