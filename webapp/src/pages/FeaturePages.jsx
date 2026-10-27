// One page per sidebar item. Each wraps a component that already existed, so
// the features themselves are unchanged - only how you reach them changed.
import { useAuth } from '../context/AuthContext';
import { ROLES, isExternalBotanist } from '../roles';
import { registerPlant } from '../queries/plants';
import PlantForm from '../components/PlantForm';
import PlantRecordsTable from '../components/PlantRecordsTable';
import ChangeRequestsPanel from '../components/ChangeRequestsPanel';
import MyRequestsPanel from '../components/MyRequestsPanel';
import StaffMap from '../components/StaffMap';
import IotDashboard from '../components/IotDashboard';
import AuditLogPanel from '../components/AuditLogPanel';

function ExternalNote() {
  const { user } = useAuth();
  if (!isExternalBotanist(user)) return null;
  return (
    <div className="alert alert-warning">
      As an External Botanist you can register plants and edit them only by sending requests that an Officer reviews.
    </div>
  );
}

export function RecordsPage() {
  const { user } = useAuth();
  const botanist = user.role_name === ROLES.BOTANIST;
  return (
    <div>
      <h2>{botanist ? 'My Records' : 'Species Database'}</h2>
      <ExternalNote />
      <PlantRecordsTable variant={botanist ? 'botanist' : 'staff'} />
    </div>
  );
}

export function RegisterPage() {
  async function handleSubmit(payload, imageFile) {
    return registerPlant(payload, imageFile); // the form shows the new QR code
  }
  return (
    <div>
      <h2>Register New Plant</h2>
      <ExternalNote />
      <div className="panel">
        <PlantForm onSubmit={handleSubmit} submitLabel="Save Record" />
      </div>
    </div>
  );
}

export function RequestsPage() {
  const { user } = useAuth();
  const botanist = user.role_name === ROLES.BOTANIST;
  return (
    <div>
      <h2>{botanist ? 'My Requests' : 'Change Requests'}</h2>
      {botanist ? <MyRequestsPanel /> : <ChangeRequestsPanel />}
    </div>
  );
}

export function MapPage() {
  return (
    <div>
      <h2>Distribution Map</h2>
      <StaffMap />
    </div>
  );
}

export function IotPage() {
  return (
    <div>
      <h2>IoT Monitoring</h2>
      <IotDashboard />
    </div>
  );
}

export function AuditPage() {
  return (
    <div>
      <h2>Audit Log</h2>
      <AuditLogPanel />
    </div>
  );
}
