import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';
import { fetchPublicPlants } from '../queries/plants';

export default function SpeciesCatalog() {
  const [plants, setPlants] = useState([]);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    fetchPublicPlants(search).then(setPlants).catch((err) => setError(err.message));
  }, [search]);

  return (
    <div className="container page">
      <h2>Species Catalog</h2>

      <div className="field" style={{ maxWidth: 420, marginBottom: '1.75rem' }}>
        <div style={{ position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-400)' }} />
          <input
            className="input"
            style={{ paddingLeft: '2.2rem' }}
            placeholder="Search by scientific, common name or family…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="grid grid-3">
        {plants.map((p) => (
          <Link to={`/species/${p.id}`} key={p.id} className="specimen-card" style={{ textDecoration: 'none', color: 'inherit' }}>
            <div className="specimen-photo">
              {p.image_path ? <img src={p.image_path} alt={p.common_name} /> : <span>No photo</span>}
              <span className="specimen-id">SP-{String(p.id).padStart(3, '0')}</span>
            </div>
            <div className="specimen-body">
              <div className="specimen-common">{p.common_name}</div>
              <div className="specimen-sci">{p.scientific_name}</div>
            </div>
          </Link>
        ))}
      </div>

      {plants.length === 0 && !error && (
        <div className="empty-state">
          <p>No approved species records yet — check back once field submissions have been reviewed.</p>
        </div>
      )}
    </div>
  );
}
