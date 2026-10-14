import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { MapPin, ArrowLeft, Leaf } from 'lucide-react';
import { fetchPublicPlant } from '../queries/plants';

// Decimals arrive as strings ("50.00"); show them as plain numbers.
const cm = (value) => (value == null ? null : `${Number(value)} cm`);

export default function SpeciesDetail() {
  const { qrCode } = useParams();
  const [plant, setPlant] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setPlant(null);
    setError('');
    fetchPublicPlant(qrCode).then(setPlant).catch((err) => setError(err.message));
  }, [qrCode]);

  if (error) return <div className="container page"><div className="alert alert-error">{error}</div></div>;
  if (!plant) return <div className="container page"><p>Loading…</p></div>;

  const rows = [
    ['Family', plant.family],
    ['Genus', plant.genus],
    ['Species', plant.species],
    ['Conservation status', plant.conservation_status],
    ['Height', cm(plant.height_cm)],
    ['Width', cm(plant.width_cm)],
  ].filter(([, value]) => value);

  const sections = [
    ['Appearance', plant.morphological_notes],
    ['Habitat', plant.surrounding_environment],
    ['Ecological role', plant.ecological_role],
    ['Medicinal use', plant.medicinal_use],
    ['Cultural significance', plant.cultural_significance],
  ].filter(([, value]) => value);

  const hasPoint = plant.latitude != null && plant.longitude != null;

  return (
    <div className="container page">
      <Link to="/species" className="btn btn-ghost btn-sm" style={{ marginBottom: '1.5rem' }}>
        <ArrowLeft size={15} /> Back to catalog
      </Link>
      <div className="grid grid-2" style={{ alignItems: 'start' }}>
        <div className="specimen-photo" style={{ height: 320, borderRadius: 'var(--radius)' }}>
          <Leaf size={56} color="var(--ink-400)" />
          <span className="specimen-id">{plant.qr_code}</span>
        </div>
        <div>
          <h2 style={{ marginBottom: '0.15rem' }}>{plant.common_name || plant.scientific_name}</h2>
          {plant.common_name && (
            <p className="specimen-sci" style={{ fontSize: '1.05rem', marginBottom: '1.25rem' }}>{plant.scientific_name}</p>
          )}

          {rows.length > 0 && (
            <div className="table-wrap" style={{ marginBottom: '1.25rem' }}>
              <table className="data-table">
                <tbody>
                  {rows.map(([label, value]) => (
                    <tr key={label}><td style={{ fontWeight: 600, width: 160 }}>{label}</td><td>{value}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {sections.map(([title, text]) => (
            <div key={title} style={{ marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1rem', marginBottom: '0.25rem' }}>{title}</h3>
              <p>{text}</p>
            </div>
          ))}

          {hasPoint ? (
            <a
              className="btn btn-outline"
              target="_blank"
              rel="noreferrer"
              href={`https://www.google.com/maps?q=${plant.latitude},${plant.longitude}`}
            >
              <MapPin size={16} /> <span className="coord">{Number(plant.latitude)}, {Number(plant.longitude)}</span>
            </a>
          ) : (
            plant.general_location && (
              <p><MapPin size={16} style={{ verticalAlign: 'text-bottom' }} /> {plant.general_location}</p>
            )
          )}
        </div>
      </div>
    </div>
  );
}
