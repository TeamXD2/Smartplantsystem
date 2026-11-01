import { lazy, Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, X, LayoutGrid, Map as MapIcon, SearchX, Sprout } from 'lucide-react';
import { fetchPublicPlants, fetchAllPages } from '../queries/plants';
import SpecimenCard from '../components/SpecimenCard';
import Pager from '../components/Pager';
import EmptyState from '../components/ui/EmptyState';
import Breadcrumbs from '../components/ui/Breadcrumbs';
import { SkeletonCards } from '../components/ui/Skeleton';
import { useDebounced, useDocumentTitle } from '../hooks';

const PlantMap = lazy(() => import('../components/PlantMap'));
const LIMIT = 12;

// The public catalog: published plants only, as served by GET /api/public/plants.
// The search and the grid/map choice live in the address (?q=…&view=map), so a
// result can be shared and the Back button works.
export default function SpeciesCatalog() {
  useDocumentTitle('Species catalog');
  const [params, setParams] = useSearchParams();
  const view = params.get('view') === 'map' ? 'map' : 'grid';
  const [search, setSearch] = useState(params.get('q') || '');
  const debouncedSearch = useDebounced(search);
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ plants: [], total: 0 });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [mapPlants, setMapPlants] = useState([]);

  function setView(next) {
    const p = new URLSearchParams(params);
    if (next === 'map') p.set('view', 'map'); else p.delete('view');
    setParams(p, { replace: true });
  }

  // Keep ?q= in step with what was typed.
  useEffect(() => {
    const p = new URLSearchParams(params);
    if (debouncedSearch.trim()) p.set('q', debouncedSearch.trim()); else p.delete('q');
    if (p.toString() !== params.toString()) setParams(p, { replace: true });
  }, [debouncedSearch]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { setPage(1); }, [debouncedSearch]);

  // The map needs every match, not one page. The public API only sends GPS for
  // plants whose location an Officer set to "Public", so rare plants stay hidden.
  useEffect(() => {
    if (view !== 'map') return;
    fetchAllPages((p) => fetchPublicPlants(p), { search: debouncedSearch })
      .then(setMapPlants)
      .catch((err) => setError(err.message));
  }, [view, debouncedSearch]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchPublicPlants({ search: debouncedSearch, page, limit: LIMIT })
      .then((result) => { if (!cancelled) { setData(result); setError(''); } })
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [debouncedSearch, page]);

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
  const searching = debouncedSearch.trim() !== '';
  const firstLoad = loading && data.plants.length === 0;

  return (
    <div className="container page">
      <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Species catalog' }]} />
      <div className="catalog-head">
        <div>
          <h1 className="page-title">Species catalog</h1>
          <p className="page-desc" aria-live="polite">
            {firstLoad ? 'Loading species…' : `${data.total} published ${data.total === 1 ? 'species' : 'species'}${searching ? ` match “${debouncedSearch.trim()}”` : ' from Niah National Park'}`}
          </p>
        </div>
        <div className="segmented" role="group" aria-label="Catalog view">
          <button type="button" aria-pressed={view === 'grid'} onClick={() => setView('grid')}><LayoutGrid size={15} aria-hidden="true" /> Species</button>
          <button type="button" aria-pressed={view === 'map'} onClick={() => setView('map')}><MapIcon size={15} aria-hidden="true" /> Map</button>
        </div>
      </div>

      <div className="search-box search-lg" role="search">
        <Search size={18} aria-hidden="true" />
        <label htmlFor="catalog-search" className="sr-only">Search species</label>
        <input id="catalog-search" className="input" type="search" placeholder="Search by scientific name, common name or family" value={search} onChange={(e) => setSearch(e.target.value)} />
        {search && <button type="button" className="search-clear" onClick={() => setSearch('')} aria-label="Clear search"><X size={16} /></button>}
      </div>

      {error && (
        <div className="alert alert-error" role="alert">
          {error} <button type="button" className="link-btn" onClick={() => setPage((p) => p)}>Try again</button>
        </div>
      )}

      {view === 'map' && (
        <>
          <Suspense fallback={<div className="plant-map" style={{ height: 420 }} role="status" aria-label="Loading map" />}>
            <PlantMap points={mapPoints} />
          </Suspense>
          <p className="muted map-note">
            {hiddenOnMap > 0
              ? `${hiddenOnMap} protected ${hiddenOnMap === 1 ? 'species is' : 'species are'} not shown on the map to keep ${hiddenOnMap === 1 ? 'its' : 'their'} location safe.`
              : 'Exact locations of rare and endangered species are never shown publicly.'}
          </p>
        </>
      )}

      {view === 'grid' && (
        <>
          {firstLoad && <SkeletonCards count={6} />}
          {!firstLoad && data.plants.length > 0 && (
            <div className="grid grid-3" aria-busy={loading}>
              {data.plants.map((p) => <SpecimenCard key={p.qr_code} plant={p} />)}
            </div>
          )}
          {!loading && data.plants.length === 0 && !error && (
            searching ? (
              <EmptyState
                icon={SearchX}
                title="No species match your search"
                action={<button type="button" className="btn btn-outline" onClick={() => setSearch('')}>Clear search</button>}
              >
                Try a shorter name, or search by family, for example “Nepenthaceae”.
              </EmptyState>
            ) : (
              <EmptyState icon={Sprout} title="Nothing published yet">
                Species appear here once an officer has reviewed and published them. Please check back soon.
              </EmptyState>
            )
          )}
          <Pager page={page} limit={LIMIT} total={data.total} onChange={setPage} noun="species" />
        </>
      )}
    </div>
  );
}
