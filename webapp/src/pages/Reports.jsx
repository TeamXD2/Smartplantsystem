import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { fetchPlants, fetchAllPages } from '../queries/plants';
import { downloadCsv } from '../utils/csv';

// "Generate and export biodiversity reports" (Conservation Officer, project scope):
// a summary of all records, and a CSV download for Excel.
const COLUMNS = [
  { label: 'QR code', value: 'qr_code' },
  { label: 'Scientific name', value: 'scientific_name' },
  { label: 'Common name', value: 'common_name' },
  { label: 'Family', value: 'family' },
  { label: 'Genus', value: 'genus' },
  { label: 'Species', value: 'species' },
  { label: 'Conservation status', value: 'conservation_status' },
  { label: 'Publication status', value: 'publication_status' },
  { label: 'Location visibility', value: 'location_visibility' },
  { label: 'General location', value: 'general_location' },
  { label: 'Latitude', value: 'latitude' },
  { label: 'Longitude', value: 'longitude' },
  { label: 'Registered by', value: 'registered_by_name' },
  { label: 'Registered on', value: (r) => (r.created_at ? r.created_at.slice(0, 10) : '') },
  { label: 'Last updated', value: (r) => (r.updated_at ? r.updated_at.slice(0, 10) : '') },
];

function countBy(rows, key, empty) {
  const counts = {};
  rows.forEach((r) => {
    const k = r[key] || empty;
    counts[k] = (counts[k] || 0) + 1;
  });
  return Object.entries(counts).sort((a, b) => b[1] - a[1]);
}

function BarList({ title, items, total }) {
  return (
    <div className="panel">
      <h3>{title}</h3>
      {items.length === 0 && <p className="muted">No records yet.</p>}
      {items.slice(0, 8).map(([name, n]) => (
        <div key={name} className="bar-row">
          <span className="bar-label">{name}</span>
          <span className="bar-track"><span className="bar-fill" style={{ width: `${(n / total) * 100}%` }} /></span>
          <span className="bar-num">{n}</span>
        </div>
      ))}
    </div>
  );
}

export default function Reports() {
  const [rows, setRows] = useState(null);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    fetchAllPages(fetchPlants).then(setRows).catch((err) => setError(err.message));
  }, []);

  function exportCsv() {
    const chosen = status ? rows.filter((r) => r.publication_status === status) : rows;
    downloadCsv(`biodiversity-report-${new Date().toISOString().slice(0, 10)}.csv`, COLUMNS, chosen);
  }

  const total = rows ? rows.length : 0;
  const withGps = rows ? rows.filter((r) => r.latitude != null).length : 0;

  return (
    <div>
      <h2>Reports</h2>
      {error && <div className="alert alert-error">{error}</div>}

      <div className="panel export-panel">
        <div>
          <h3>Export biodiversity report</h3>
          <p className="muted" style={{ margin: 0 }}>All species records as a CSV file that opens in Excel.</p>
        </div>
        <div className="row-actions">
          <select className="input" value={status} onChange={(e) => setStatus(e.target.value)} style={{ width: 190 }}>
            <option value="">All records</option>
            <option value="Under Research">Under Research</option>
            <option value="Published">Published</option>
          </select>
          <button className="btn btn-primary btn-sm" onClick={exportCsv} disabled={!rows}>
            <Download size={15} /> Export CSV
          </button>
        </div>
      </div>

      {rows && (
        <>
          <div className="stat-row four">
            <div className="stat"><div className="stat-num">{total}</div><div className="stat-label">Records</div></div>
            <div className="stat"><div className="stat-num green">{rows.filter((r) => r.publication_status === 'Published').length}</div><div className="stat-label">Published</div></div>
            <div className="stat"><div className="stat-num orange">{rows.filter((r) => r.publication_status !== 'Published').length}</div><div className="stat-label">Under Research</div></div>
            <div className="stat"><div className="stat-num">{total ? Math.round((withGps / total) * 100) : 0}%</div><div className="stat-label">With GPS</div></div>
          </div>
          <div className="report-grid">
            <BarList title="Records by family" items={countBy(rows, 'family', 'Unknown family')} total={total} />
            <BarList title="Conservation status" items={countBy(rows, 'conservation_status', 'Not assessed')} total={total} />
            <BarList title="Registered by" items={countBy(rows, 'registered_by_name', 'Unknown')} total={total} />
            <BarList title="Location shown to visitors" items={countBy(rows, 'location_visibility', 'Not set')} total={total} />
          </div>
        </>
      )}
    </div>
  );
}
