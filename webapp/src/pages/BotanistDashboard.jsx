import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { isExternalBotanist } from '../roles';
import { registerPlant } from '../queries/plants';
import PlantForm from '../components/PlantForm';
import PlantRecordsTable from '../components/PlantRecordsTable';
import MyRequestsPanel from '../components/MyRequestsPanel';

export default function BotanistDashboard() {
  const { user } = useAuth();
  const external = isExternalBotanist(user);
  const [refreshKey, setRefreshKey] = useState(0);
  const [tab, setTab] = useState('records');

  async function handleSubmit(payload, imageFile) {
    const result = await registerPlant(payload, imageFile);
    setRefreshKey((k) => k + 1);
    return result;
  }

  return (
    <div className="container page">
      <h2>Submit a Field Observation</h2>
      <div className="panel" style={{ marginBottom: '2.5rem' }}>
        <PlantForm onSubmit={handleSubmit} submitLabel="Register plant" />
      </div>

      <div className="tabs">
        <button className={`tab ${tab === 'records' ? 'active' : ''}`} onClick={() => setTab('records')}>
          My Records
        </button>
        <button className={`tab ${tab === 'requests' ? 'active' : ''}`} onClick={() => setTab('requests')}>
          My Requests
        </button>
      </div>

      {external && (
        <div className="alert alert-warning">
          As an External Botanist you can register plants and edit them only by sending requests that an Officer reviews.
        </div>
      )}

      {tab === 'records' ? (
        <PlantRecordsTable variant="botanist" refreshKey={refreshKey} />
      ) : (
        <MyRequestsPanel refreshKey={refreshKey} />
      )}
    </div>
  );
}
