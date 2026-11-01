import { useEffect, useMemo, useState } from 'react';
import { Camera, MapPin } from 'lucide-react';
import { BASE_FIELDS, EXTRA_FIELDS, FIELD_LABELS, toFormValues, buildPayload, diffPayload } from '../plantFields';
import Field from './ui/Field';
import { useToast } from '../context/ToastContext';
import { useUnsavedChanges } from '../useUnsavedChanges';

// One form for registering and editing a plant.
//   mode="create": all registration fields; onSubmit gets the full body.
//   mode="edit":   also the conservation fields; onSubmit gets ONLY the changed
//                  fields (so the history stays clean and nothing is overwritten
//                  needlessly). Used for direct edits and for edit requests.
// onSubmit(payload, imageFile) may return the result of a registration; if it
// has a qr_code the QR code is shown below the form.
// onDirtyChange(bool) lets a parent (a table row) guard closing the form.
export default function PlantForm({ mode = 'create', initial, onSubmit, submitLabel = 'Submit record', onDirtyChange }) {
  const editing = mode === 'edit';
  const fields = editing ? [...BASE_FIELDS, ...EXTRA_FIELDS] : BASE_FIELDS;
  const toast = useToast();

  const baseline = useMemo(() => toFormValues(initial, fields), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [values, setValues] = useState(baseline);
  const [image, setImage] = useState(null);
  const [fileKey, setFileKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [errors, setErrors] = useState({});
  const [locating, setLocating] = useState(false);
  const [created, setCreated] = useState(null);
  const [preview, setPreview] = useState(null);

  const dirty = Boolean(image) || fields.some((f) => String(values[f] ?? '').trim() !== String(baseline[f] ?? '').trim());
  useUnsavedChanges(dirty && !busy);
  useEffect(() => { if (onDirtyChange) onDirtyChange(dirty); }, [dirty]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { if (onDirtyChange) onDirtyChange(false); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Show the chosen photo, like the mobile app's preview under "Take photo"
  useEffect(() => {
    if (!image) { setPreview(null); return undefined; }
    const url = URL.createObjectURL(image);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [image]);

  function update(key, value) {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => (e[key] || e.coords ? { ...e, [key]: undefined, coords: key === 'latitude' || key === 'longitude' ? undefined : e.coords } : e));
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
        setError('Could not get your current location. Allow location access, or enter the coordinates by hand.');
        setLocating(false);
      }
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setCreated(null);

    const next = {};
    if (!values.scientific_name.trim()) next.scientific_name = 'Enter the scientific name.';
    const hasLat = values.latitude.trim() !== '';
    const hasLng = values.longitude.trim() !== '';
    if (hasLat !== hasLng) next.coords = 'Enter both latitude and longitude, or leave both empty.';
    setErrors(next);
    if (Object.keys(next).length > 0) {
      setError('Check the fields marked below.');
      return;
    }

    let payload;
    if (editing) {
      payload = diffPayload(toFormValues(initial, fields), values, fields);
      if (Object.keys(payload).length === 0 && !image) {
        setError('Nothing has changed yet.');
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
        if (result && result.qr_code) {
          setCreated(result);
          toast.success('Record saved.', { detail: `QR code ${result.qr_code}` });
        }
      }
      setImage(null);
      setFileKey((k) => k + 1); // clears the file input
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const text = (key, label, extra = {}) => (
    <Field label={label} error={errors[key]}>
      <input className="input" value={values[key]} onChange={(e) => update(key, e.target.value)} {...extra} />
    </Field>
  );

  const area = (key, label, placeholder) => (
    <Field label={label || FIELD_LABELS[key]}>
      <textarea className="input" rows={3} placeholder={placeholder} value={values[key]} onChange={(e) => update(key, e.target.value)} />
    </Field>
  );

  const hasCoords = values.latitude.trim() !== '' && values.longitude.trim() !== '';

  return (
    <form onSubmit={handleSubmit} className="plant-form" noValidate>
      {error && <div className="alert alert-error" role="alert">{error}</div>}

      {text('scientific_name', 'Scientific name *', { required: true, maxLength: 150, placeholder: 'e.g. Nepenthes rafflesiana' })}
      {text('common_name', 'Common name', { maxLength: 150, placeholder: "e.g. Raffles' pitcher plant" })}
      {text('family', 'Family', { maxLength: 100, placeholder: 'e.g. Nepenthaceae' })}

      <div className="form-row">
        {text('genus', 'Genus', { maxLength: 100, placeholder: 'e.g. Nepenthes' })}
        {text('species', 'Species', { maxLength: 100, placeholder: 'e.g. rafflesiana' })}
      </div>

      <div className="form-row">
        {text('height_cm', FIELD_LABELS.height_cm, { type: 'number', step: 'any', min: 0, max: 9999.99, placeholder: 'e.g. 45', inputMode: 'decimal' })}
        {text('width_cm', FIELD_LABELS.width_cm, { type: 'number', step: 'any', min: 0, max: 9999.99, placeholder: 'e.g. 20', inputMode: 'decimal' })}
      </div>

      {area('morphological_notes', 'Description / features', 'Leaf shape, flower colour…')}

      {editing && (
        <>
          {text('conservation_status', FIELD_LABELS.conservation_status, { maxLength: 100, placeholder: 'e.g. Endangered' })}
          {area('ecological_role')}
          {area('medicinal_use')}
          {area('cultural_significance')}
        </>
      )}

      <div className="form-group">
        <label className="btn btn-outline btn-block pick-photo">
          <Camera size={18} aria-hidden="true" /> {image ? 'Change photo' : editing ? 'Add another photo' : 'Choose photo'}
          <input
            key={fileKey}
            type="file"
            className="sr-only"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => {
              const file = e.target.files[0] || null;
              if (file && file.size > 5 * 1024 * 1024) {
                setError('The photo is larger than 5 MB. Choose a smaller one.');
                e.target.value = '';
                setImage(null);
                return;
              }
              setError('');
              setImage(file);
            }}
          />
        </label>
        {preview ? <img className="photo-preview" src={preview} alt="The photo you chose" /> : <p className="form-hint">JPEG, PNG or WebP, up to 5 MB.</p>}
      </div>

      <div className="form-group">
        <button type="button" className="btn btn-outline btn-block" onClick={useCurrentLocation} disabled={locating}>
          <MapPin size={18} aria-hidden="true" /> {locating ? 'Getting location…' : hasCoords ? 'Update GPS location' : 'Get GPS location'}
        </button>
        {hasCoords && <p className="gps-text">Lat {Number(values.latitude).toFixed(5)}, Lng {Number(values.longitude).toFixed(5)}</p>}
        <details className="manual-gps" open={Boolean(errors.coords)}>
          <summary>Enter coordinates manually</summary>
          <div className="form-row">
            {text('latitude', 'Latitude', { type: 'number', step: 'any', min: -90, max: 90, inputMode: 'decimal' })}
            {text('longitude', 'Longitude', { type: 'number', step: 'any', min: -180, max: 180, inputMode: 'decimal' })}
          </div>
          {errors.coords && <p className="field-error" role="alert">{errors.coords}</p>}
        </details>
      </div>

      <button type="submit" className="btn btn-primary btn-lg btn-block save-btn" disabled={busy}>
        {busy ? 'Saving…' : submitLabel}
      </button>

      {created && (
        <div className="panel qr-result">
          <img src={created.qr_code_image} alt={`QR code ${created.qr_code}`} width="132" height="132" />
          <div className="stack">
            <strong>Record registered. It stays “Under Research” until an Officer publishes it.</strong>
            <span>QR code: <span className="id-tag">{created.qr_code}</span></span>
            <a className="btn btn-outline btn-sm" href={created.qr_code_image} download={`${created.qr_code}.png`}>Download QR code</a>
            {created.photoError && (
              <div className="alert alert-warning" role="alert">
                The record was saved, but the photo could not be uploaded: {created.photoError} You can add it by editing the record.
              </div>
            )}
          </div>
        </div>
      )}
    </form>
  );
}
