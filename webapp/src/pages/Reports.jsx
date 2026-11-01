import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { fetchPlants, fetchAllPages } from '../queries/plants';
import { downloadCsv } from '../utils/csv';
import { PLANT_COLUMNS } from '../utils/exportColumns';
import { useToast } from '../context/ToastContext';
import { useDocumentTitle } from '../hooks';
import PageHeader from '../components/ui/PageHeader';
import { SkeletonStats, SkeletonBlock } from '../components/ui/Skeleton';

// "Generate and export biodiversity reports" (Conservation Officer, project scope):
// a summary of all records, and a CSV download for Excel.
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
      <h2 className="panel-title">{title}</h2>
      {items.length === 0 && <p className="muted">No records yet.</p>}
      {items.slice(0, 8).map(([name, n]) => (
        <div key={name} className="bar-row">
          <span className="bar-label">{name}</span>
          <span className="bar-track" aria-hidden="true"><span className="bar-fill" style={{ width: `${(n / total) * 100}%` }} /></span>
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
  const toast = useToast();
  useDocumentTitle('Reports');

  useEffect(() => {
    fetchAllPages(fetchPlants).then(setRows).catch((err) => setError(err.message));
  }, []);

  function exportCsv() {
    const chosen = status ? rows.filter((r) => r.publication_status === status) : rows;
    downloadCsv(`biodiversity-report-${new Date().toISOString().slice(0, 10)}.csv`, PLANT_COLUMNS, chosen);
    toast.success(`Exported ${chosen.length} ${chosen.length === 1 ? 'record' : 'records'} to CSV.`);
  }

  const total = rows ? rows.length : 0;
  const withGps = rows ? rows.filter((r) => r.latitude != null).length : 0;

  return (
    <div>
      <PageHeader title="Reports" description="A summary of every species record, and an export that opens in Excel." />
      {error && <div className="alert alert-error" role="alert">{error}</div>}

      <div className="panel export-panel">
        <div>
          <h2 className="panel-title">Export biodiversity report</h2>
          <p className="muted" style={{ margin: 0 }}>All species records as a CSV file that opens in Excel.</p>
        </div>
        <div className="row-actions">
          <select className="input" aria-label="Which records to export" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All records</option>
            <option value="Under Research">Under Research</option>
            <option value="Published">Published</option>
          </select>
          <button className="btn btn-primary btn-sm" onClick={exportCsv} disabled={!rows}>
            <Download size={15} /> Export CSV
          </button>
        </div>
      </div>

      {!rows && !error && (<><SkeletonStats /><div className="report-grid"><SkeletonBlock height={140} /><SkeletonBlock height={140} /></div></>)}
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
