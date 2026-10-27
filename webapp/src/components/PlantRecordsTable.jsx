import { Fragment, useCallback, useEffect, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { useDebounced } from '../hooks';
import { fetchPlants, registerPlant, deletePlant } from '../queries/plants';
import { submitRequest } from '../queries/requests';
import PlantForm from './PlantForm';
import EditPanel from './EditPanel';
import PublishPanel from './PublishPanel';
import HistoryPanel from './HistoryPanel';
import StatusTag from './StatusTag';
import Pager from './Pager';

const LIMIT = 20;

// variant="staff":    Officer / Admin - every record; publish, edit, delete directly.
// variant="botanist": a Botanist's own records; edit (directly or as a request,
//                     depending on Internal / External) and request deletion.
// All permission rules live in the backend; this only chooses which buttons to show.
export default function PlantRecordsTable({ variant = 'staff', refreshKey = 0 }) {
  const staff = variant === 'staff';

  const [data, setData] = useState({ plants: [], total: 0 });
  const [publication, setPublication] = useState('');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounced(search);
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(null); // { id, kind: 'edit' | 'publish' | 'history' }
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [confirming, setConfirming] = useState(null); // plant_id waiting for "Yes, delete"

  const load = useCallback(async () => {
    try {
      setData(
        await fetchPlants({
          search: debouncedSearch,
          publication_status: publication,
          mine: staff ? undefined : 'true',
          page,
          limit: LIMIT,
        })
      );
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }, [debouncedSearch, publication, page, staff]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, publication]);

  function toggle(id, kind) {
    setOpen((current) => (current && current.id === id && current.kind === kind ? null : { id, kind }));
  }

  // Reload first so the message never appears next to stale rows.
  async function finished(message) {
    setOpen(null);
    await load();
    setNotice(message);
  }

  async function remove(plant) {
    setConfirming(null);
    try {
      await deletePlant(plant.plant_id);
      finished('Record deleted.');
    } catch (err) {
      setNotice('');
      setError(err.message);
    }
  }

  async function requestDelete(plant) {
    setConfirming(null);
    try {
      await submitRequest({ plantId: plant.plant_id, type: 'DELETE' });
      finished('Deletion request sent. An Officer will review it.');
    } catch (err) {
      setNotice('');
      setError(err.message);
    }
  }

  async function addRecord(payload, imageFile) {
    const result = await registerPlant(payload, imageFile);
    load();
    return result;
  }

  return (
    <div>
      {error && <div className="alert alert-error">{error}</div>}
      {notice && <div className="alert alert-success">{notice}</div>}

      <div className="row-actions" style={{ marginBottom: '1rem', justifyContent: 'space-between' }}>
        <div className="row-actions">
          <select className="input" value={publication} onChange={(e) => setPublication(e.target.value)} style={{ width: 190 }}>
            <option value="">All records</option>
            <option value="Under Research">Under Research</option>
            <option value="Published">Published</option>
          </select>
          <input
            className="input"
            style={{ width: 280 }}
            placeholder="Search scientific name, common name, family"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {staff && (
          <button className="btn btn-primary btn-sm" onClick={() => setAdding((a) => !a)}>
            {adding ? <X size={15} /> : <Plus size={15} />} {adding ? 'Close' : 'Add record'}
          </button>
        )}
      </div>

      {staff && adding && (
        <div className="panel" style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ marginBottom: '1rem' }}>New species record</h3>
          <PlantForm submitLabel="Add record" onSubmit={addRecord} />
        </div>
      )}

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Photo</th>
              <th>Name</th>
              <th>Family</th>
              <th>Registered by</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {data.plants.map((p) => {
              const isOpen = open && open.id === p.plant_id;
              return (
                <Fragment key={p.plant_id}>
                  <tr>
                    <td style={{ width: 56 }}>
                      {p.cover_photo_url ? (
                        <img
                          src={p.cover_photo_url}
                          alt={p.common_name || p.scientific_name}
                          width="48"
                          height="48"
                          loading="lazy"
                          style={{ objectFit: 'cover', borderRadius: 6 }}
                        />
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{p.common_name || '—'}</div>
                      <div className="sci">{p.scientific_name}</div>
                      <div className="muted" style={{ fontSize: '0.8rem' }}>{p.qr_code}</div>
                    </td>
                    <td>{p.family}</td>
                    <td>{p.registered_by_name}</td>
                    <td>
                      <StatusTag status={p.publication_status} />
                      {p.publication_status === 'Published' && (
                        <div className="muted" style={{ fontSize: '0.8rem', marginTop: 4 }}>
                          Location: {p.location_visibility}
                        </div>
                      )}
                    </td>
                    <td>
                      <div className="row-actions">
                        {staff && (
                          <button className="btn btn-forest btn-sm" onClick={() => toggle(p.plant_id, 'publish')}>
                            {isOpen && open.kind === 'publish' ? 'Close' : p.publication_status === 'Published' ? 'Visibility' : 'Publish'}
                          </button>
                        )}
                        <button className="btn btn-outline btn-sm" onClick={() => toggle(p.plant_id, 'edit')}>
                          {isOpen && open.kind === 'edit' ? 'Close' : 'Edit'}
                        </button>
                        <button className="btn btn-outline btn-sm" onClick={() => toggle(p.plant_id, 'history')}>
                          {isOpen && open.kind === 'history' ? 'Close' : 'History'}
                        </button>
                        {confirming === p.plant_id ? (
                          <span className="confirm-inline">
                            <span className="muted">Sure?</span>
                            <button className="btn btn-danger btn-sm" onClick={() => (staff ? remove(p) : requestDelete(p))}>{staff ? 'Yes, delete' : 'Yes, request'}</button>
                            <button className="btn btn-ghost btn-sm" onClick={() => setConfirming(null)}>No</button>
                          </span>
                        ) : (
                          <button className="btn btn-danger btn-sm" onClick={() => setConfirming(p.plant_id)}>
                            {staff ? 'Delete' : 'Request delete'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {isOpen && (
                    <tr>
                      <td colSpan="6" style={{ background: 'var(--paper)' }}>
                        {open.kind === 'edit' && <EditPanel plantId={p.plant_id} onDone={finished} />}
                        {open.kind === 'publish' && <PublishPanel plant={p} onDone={finished} />}
                        {open.kind === 'history' && <HistoryPanel plantId={p.plant_id} />}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {data.plants.length === 0 && (
              <tr className="empty-row">
                <td colSpan="6">{staff ? 'No records found.' : "You haven't registered any records yet."}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Pager page={page} limit={LIMIT} total={data.total} onChange={setPage} />
    </div>
  );
}
