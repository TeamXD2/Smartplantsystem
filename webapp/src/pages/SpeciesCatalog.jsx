import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Leaf, LayoutGrid, Map as MapIcon } from 'lucide-react';
import { fetchPublicPlants, fetchAllPages } from '../queries/plants';
import PlantMap from '../components/PlantMap';
import { useDebounced } from '../hooks';
import Pager from '../components/Pager';

const LIMIT = 12;

// The public catalog: published plants only, as served by GET /api/public/plants.
// The list has each plant's first photo (cover_photo_url); GPS only when the location is Public.
export default function SpeciesCatalog() {
  const [data, setData] = useState({ plants: [], total: 0 });
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounced(search);
  const [page, setPage] = useState(1);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('grid'); // 'grid' | 'map'
  const [mapPlants, setMapPlants] = useState([]);

  // The map needs every match, not one page. The public API only sends GPS for
  // plants whose location an Officer set to "Public", so rare plants stay hidden.
  useEffect(() => {
    if (view !== 'map') return;
    fetchAllPages((params) => fetchPublicPlants(params), { search: debouncedSearch })
      .then(setMapPlants)
      .catch((err) => setError(err.message));
  }, [view, debouncedSearch]);

  const mapPoints = mapPlants.map((p) => ({
    id: p.qr_code,
    lat: p.latitude == null ? NaN : Number(p.latitude),
    lng: p.longitude == null ? NaN : Number(p.longitude),
    title: p.common_name || p.scientific_name,
    subtitle: p.scientific_name,
    href: `/species/${encodeURIComponent(p.qr_code)}`,
    kind: 'published',
  }));
  const hiddenOnMap = mapPlants.filter((p) => p.latitude == null).length;

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

      <div className="tabs">
        <button className={`tab ${view === 'grid' ? 'active' : ''}`} onClick={() => setView('grid')}>
          <LayoutGrid size={14} /> Species
        </button>
        <button className={`tab ${view === 'map' ? 'active' : ''}`} onClick={() => setView('map')}>
          <MapIcon size={14} /> Distribution map
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {view === 'map' && (
        <>
          <PlantMap points={mapPoints} />
          <p className="muted map-note">
            {hiddenOnMap > 0
              ? `${hiddenOnMap} protected species ${hiddenOnMap === 1 ? 'is' : 'are'} not shown on the map to keep ${hiddenOnMap === 1 ? 'its' : 'their'} location safe.`
              : 'Exact locations of rare and endangered species are never shown publicly.'}
          </p>
        </>
      )}

      {view === 'grid' && (<>
      <div className="grid grid-3">
        {data.plants.map((p) => (
          <Link to={`/species/${encodeURIComponent(p.qr_code)}`} key={p.qr_code} className="specimen-card" style={{ textDecoration: 'none', color: 'inherit' }}>
            <div className="specimen-photo">
              {p.cover_photo_url
                ? <img src={p.cover_photo_url} alt={p.common_name || p.scientific_name} className="specimen-img" loading="lazy" />
                : <Leaf size={36} color="var(--ink-400)" />}
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
      </>)}
    </div>
  );
}
