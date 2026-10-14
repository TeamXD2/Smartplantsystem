import { useState } from 'react';
import PlantRecordsTable from '../components/PlantRecordsTable';
import ChangeRequestsPanel from '../components/ChangeRequestsPanel';

export default function OfficerDashboard() {
  const [tab, setTab] = useState('records');

  return (
    <div className="container page">
      <h2>Species Record Management</h2>

      <div className="tabs">
        <button className={`tab ${tab === 'records' ? 'active' : ''}`} onClick={() => setTab('records')}>
          Species Records
        </button>
        <button className={`tab ${tab === 'requests' ? 'active' : ''}`} onClick={() => setTab('requests')}>
          Change Requests
        </button>
      </div>

      {tab === 'records' ? <PlantRecordsTable /> : <ChangeRequestsPanel />}
    </div>
  );
}
