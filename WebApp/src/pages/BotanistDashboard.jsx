import { useEffect, useState } from 'react';
import { fetchMyPlants, submitPlant } from '../queries/plants';
import PlantForm from '../components/PlantForm';

const TAG_CLASS = {
  pending: 'tag tag-pending',
  approved: 'tag tag-approved',
  rejected: 'tag tag-rejected',
};

export default function BotanistDashboard() {
  const [plants, setPlants] = useState([]);
  const [error, setError] = useState('');

  async function load() {
    try {
      setPlants(await fetchMyPlants());
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSubmit(fields, imageFile) {
    await submitPlant(fields, imageFile);
    load();
  }

  return (
    <div className="container page">
      <h2>Submit a Field Observation</h2>
      <div className="panel" style={{ marginBottom: '2.5rem' }}>
        <PlantForm onSubmit={handleSubmit} submitLabel="Submit for review" />
      </div>

      <h3 style={{ marginBottom: '1rem' }}>My Submissions</h3>
      {error && <div className="alert alert-error">{error}</div>}
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr><th>Name</th><th>Family</th><th>Status</th><th>Review note</th><th>Submitted</th></tr>
          </thead>
          <tbody>
            {plants.map((p) => (
              <tr key={p.id}>
                <td>
                  <div style={{ fontWeight: 600 }}>{p.common_name}</div>
                  <div className="sci">{p.scientific_name}</div>
                </td>
                <td>{p.family}</td>
                <td><span className={TAG_CLASS[p.status]}>{p.status}</span></td>
                <td className="muted">{p.review_note || '—'}</td>
                <td className="muted">{new Date(p.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
            {plants.length === 0 && (
              <tr className="empty-row"><td colSpan="5">You haven't submitted any records yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
