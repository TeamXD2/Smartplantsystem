import { Fragment, useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { fetchMyPlants, reviewPlant, deletePlant, updatePlant, submitPlant } from '../queries/plants';
import PlantForm from './PlantForm';

const TAG_CLASS = {
  pending: 'tag tag-pending',
  approved: 'tag tag-approved',
  rejected: 'tag tag-rejected',
};

export default function PlantRecordsTable() {
  const [plants, setPlants] = useState([]);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    try {
      setPlants(await fetchMyPlants({ status, search }));
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, search]);

  async function review(id, decision) {
    try {
      let reviewNote = '';
      if (decision === 'rejected') {
        reviewNote = window.prompt('Reason for rejection (optional):') || '';
      }
      await reviewPlant(id, decision, reviewNote);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function remove(id) {
    if (!window.confirm('Delete this plant record permanently?')) return;
    try {
      await deletePlant(id);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function saveEdit(id, fields, imageFile) {
    await updatePlant(id, fields, imageFile);
    setEditingId(null);
    load();
  }

  async function addRecord(fields, imageFile) {
    await submitPlant(fields, imageFile);
    setAdding(false);
    load();
  }

  return (
    <div>
      {error && <div className="alert alert-error">{error}</div>}

      <div className="row-actions" style={{ marginBottom: '1rem', justifyContent: 'space-between' }}>
        <div className="row-actions">
          <select className="input" value={status} onChange={(e) => setStatus(e.target.value)} style={{ width: 170 }}>
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
          <input
            className="input"
            style={{ width: 260 }}
            placeholder="Search by scientific or common name"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setAdding((a) => !a)}>
          <Plus size={15} /> {adding ? 'Close' : 'Add record'}
        </button>
      </div>

      {adding && (
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
              <th>Submitted by</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {plants.map((p) => (
              <Fragment key={p.id}>
                <tr>
                  <td style={{ width: 56 }}>
                    {p.image_path ? (
                      <img src={p.image_path} alt={p.common_name} width="48" height="48" style={{ objectFit: 'cover', borderRadius: 6 }} />
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{p.common_name}</div>
                    <div className="sci">{p.scientific_name}</div>
                  </td>
                  <td>{p.family}</td>
                  <td>{p.submitted_by_name}</td>
                  <td><span className={TAG_CLASS[p.status]}>{p.status}</span></td>
                  <td>
                    <div className="row-actions">
                      {p.status === 'pending' && (
                        <>
                          <button className="btn btn-forest btn-sm" onClick={() => review(p.id, 'approved')}>Approve</button>
                          <button className="btn btn-danger btn-sm" onClick={() => review(p.id, 'rejected')}>Reject</button>
                        </>
                      )}
                      <button className="btn btn-outline btn-sm" onClick={() => setEditingId(editingId === p.id ? null : p.id)}>
                        {editingId === p.id ? 'Close' : 'Edit'}
                      </button>
                      <button className="btn btn-danger btn-sm" onClick={() => remove(p.id)}>Delete</button>
                    </div>
                  </td>
                </tr>
                {editingId === p.id && (
                  <tr>
                    <td colSpan="6" style={{ background: 'var(--paper)' }}>
                      <PlantForm initial={p} submitLabel="Save changes" onSubmit={(fields, image) => saveEdit(p.id, fields, image)} />
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {plants.length === 0 && (
              <tr className="empty-row"><td colSpan="6">No records found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
