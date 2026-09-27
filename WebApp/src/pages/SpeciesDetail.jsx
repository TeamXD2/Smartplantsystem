import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { MapPin, ArrowLeft } from 'lucide-react';
import { fetchPublicPlant } from '../queries/plants';

export default function SpeciesDetail() {
  const { id } = useParams();
  const [plant, setPlant] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchPublicPlant(id).then(setPlant).catch((err) => setError(err.message));
  }, [id]);

  if (error) return <div className="container page"><div className="alert alert-error">{error}</div></div>;
  if (!plant) return <div className="container page"><p>Loading…</p></div>;

  return (
    <div className="container page">
      <Link to="/species" className="btn btn-ghost btn-sm" style={{ marginBottom: '1.5rem' }}>
        <ArrowLeft size={15} /> Back to catalog
      </Link>
      <div className="grid grid-2" style={{ alignItems: 'start' }}>
        <div className="specimen-photo" style={{ height: 320, borderRadius: 'var(--radius)' }}>
          {plant.image_path ? <img src={plant.image_path} alt={plant.common_name} /> : <span>No photo available</span>}
          <span className="specimen-id">SP-{String(plant.id).padStart(3, '0')}</span>
        </div>
        <div>
          <h2 style={{ marginBottom: '0.15rem' }}>{plant.common_name}</h2>
          <p className="specimen-sci" style={{ fontSize: '1.05rem', marginBottom: '1.25rem' }}>{plant.scientific_name}</p>
          <div className="table-wrap" style={{ marginBottom: '1.25rem' }}>
            <table className="data-table">
              <tbody>
                <tr><td style={{ fontWeight: 600, width: 100 }}>Family</td><td>{plant.family}</td></tr>
                <tr><td style={{ fontWeight: 600 }}>Genus</td><td>{plant.genus}</td></tr>
                <tr><td style={{ fontWeight: 600 }}>Species</td><td>{plant.species}</td></tr>
              </tbody>
            </table>
          </div>
          {plant.description && <p>{plant.description}</p>}
          {plant.latitude && plant.longitude && (
            <a
              className="btn btn-outline"
              target="_blank"
              rel="noreferrer"
              href={`https://www.google.com/maps?q=${plant.latitude},${plant.longitude}`}
            >
              <MapPin size={16} /> <span className="coord">{plant.latitude}, {plant.longitude}</span>
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
