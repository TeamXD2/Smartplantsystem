import { useEffect, useState } from 'react';
import { Camera, MapPin } from 'lucide-react';
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
  const [preview, setPreview] = useState(null);

  // Show the chosen photo, like the mobile app's preview under "Take photo"
  useEffect(() => {
    if (!image) { setPreview(null); return undefined; }
    const url = URL.createObjectURL(image);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [image]);

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

  // One labelled field per row, like the mobile app's Register New Plant screen
  function field(key, label, extra = {}) {
    return (
      <div className="field">
        <label>{label}</label>
        {input(key, extra)}
      </div>
    );
  }

  function area(key, label, placeholder) {
    return (
      <div className="field">
        <label>{label || FIELD_LABELS[key]}</label>
        <textarea className="input" rows={3} placeholder={placeholder} value={values[key]} onChange={(e) => update(key, e.target.value)} />
      </div>
    );
  }

  const hasCoords = values.latitude.trim() !== '' && values.longitude.trim() !== '';

  return (
    <form onSubmit={handleSubmit} className="plant-form">
      {error && <div className="alert alert-error">{error}</div>}

      {field('scientific_name', 'Scientific name *', { required: true, maxLength: 150, placeholder: 'e.g. Nepenthes rafflesiana' })}
      {field('common_name', 'Common name', { maxLength: 150, placeholder: "e.g. Raffles' pitcher plant" })}
      {field('family', 'Family', { maxLength: 100, placeholder: 'e.g. Nepenthaceae' })}

      <div className="form-row">
        {field('genus', 'Genus', { maxLength: 100, placeholder: 'e.g. Nepenthes' })}
        {field('species', 'Species', { maxLength: 100, placeholder: 'e.g. rafflesiana' })}
      </div>

      <div className="form-row">
        {field('height_cm', FIELD_LABELS.height_cm, { type: 'number', step: 'any', min: 0, max: 9999.99, placeholder: 'e.g. 45' })}
        {field('width_cm', FIELD_LABELS.width_cm, { type: 'number', step: 'any', min: 0, max: 9999.99, placeholder: 'e.g. 20' })}
      </div>

      {area('morphological_notes', 'Description / features', 'Leaf shape, flower colour...')}

      {editing && (
        <>
          {field('conservation_status', FIELD_LABELS.conservation_status, { maxLength: 100, placeholder: 'e.g. Endangered' })}
          {area('ecological_role')}
          {area('medicinal_use')}
          {area('cultural_significance')}
        </>
      )}

      {/* 📷 Photo: outline button + preview, like the app */}
      <label className="btn btn-outline btn-block pick-photo">
        <Camera size={18} /> {image ? 'Change photo' : editing ? 'Add another photo' : 'Choose photo'}
        <input
          key={fileKey}
          type="file"
          hidden
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
      </label>
      {preview ? <img className="photo-preview" src={preview} alt="Chosen plant photo" /> : <p className="form-hint">JPEG, PNG or WebP, up to 5 MB.</p>}

      {/* 📍 GPS: outline button + coordinates, like the app */}
      <button type="button" className="btn btn-outline btn-block" onClick={useCurrentLocation} disabled={locating}>
        <MapPin size={18} /> {locating ? 'Getting location...' : hasCoords ? 'Update GPS location' : 'Get GPS location'}
      </button>
      {hasCoords && (
        <p className="gps-text">
          Lat {Number(values.latitude).toFixed(5)}, Lng {Number(values.longitude).toFixed(5)}
        </p>
      )}
      <details className="manual-gps">
        <summary>Enter coordinates manually</summary>
        <div className="form-row">
          {field('latitude', 'Latitude', { type: 'number', step: 'any', min: -90, max: 90 })}
          {field('longitude', 'Longitude', { type: 'number', step: 'any', min: -180, max: 180 })}
        </div>
      </details>

      <button type="submit" className="btn btn-primary btn-block save-btn" disabled={busy}>
        {busy ? 'Saving...' : submitLabel}
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
