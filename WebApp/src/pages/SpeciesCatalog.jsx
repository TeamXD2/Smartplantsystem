import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Leaf } from 'lucide-react';
import { fetchPublicPlants } from '../queries/plants';
import { useDebounced } from '../hooks';
import Pager from '../components/Pager';

const LIMIT = 12;

// The public catalog: published plants only, as served by GET /api/public/plants.
// By design the public API returns no photos and no GPS in the list.
export default function SpeciesCatalog() {
  const [data, setData] = useState({ plants: [], total: 0 });
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounced(search);
  const [page, setPage] = useState(1);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchPublicPlants({ search: debouncedSearch, page, limit: LIMIT })
      .then((result) => {
        if (!cancelled) {
          setData(result);
          setError('');
        }
      })
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [debouncedSearch, page]);

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
        {data.plants.map((p) => (
          <Link to={`/species/${encodeURIComponent(p.qr_code)}`} key={p.qr_code} className="specimen-card" style={{ textDecoration: 'none', color: 'inherit' }}>
            <div className="specimen-photo">
              <Leaf size={36} color="var(--ink-400)" />
              <span className="specimen-id">{p.qr_code}</span>
            </div>
            <div className="specimen-body">
              <div className="specimen-common">{p.common_name || p.scientific_name}</div>
              {p.common_name && <div className="specimen-sci">{p.scientific_name}</div>}
              {(p.family || p.general_location) && (
                <div className="muted" style={{ fontSize: '0.85rem', marginTop: 4 }}>
                  {[p.family, p.general_location].filter(Boolean).join(' · ')}
                </div>
              )}
            </div>
          </Link>
        ))}
      </div>

      {!loading && data.plants.length === 0 && !error && (
        <div className="empty-state">
          <p>No published species match — check back once field records have been reviewed and published.</p>
        </div>
      )}

      <Pager page={page} limit={LIMIT} total={data.total} onChange={setPage} />
    </div>
  );
}
