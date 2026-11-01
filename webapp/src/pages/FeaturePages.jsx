// One page per sidebar item. Each wraps a component, so the features themselves
// are unchanged - only how you reach them and how they look.
import { Link } from 'react-router-dom';
import { Info } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ROLES, isExternalBotanist } from '../roles';
import { registerPlant } from '../queries/plants';
import { useDocumentTitle } from '../hooks';
import PageHeader from '../components/ui/PageHeader';
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
    <div className="alert alert-info">
      <Info size={17} aria-hidden="true" />
      <span>As an External Botanist you can register plants and edit them only by sending requests that an Officer reviews.</span>
    </div>
  );
}

export function RecordsPage() {
  const { user } = useAuth();
  const botanist = user.role_name === ROLES.BOTANIST;
  useDocumentTitle(botanist ? 'My records' : 'Species database');
  return (
    <div>
      <PageHeader
        title={botanist ? 'My records' : 'Species database'}
        description={botanist ? 'The plants you have registered, and where each one stands.' : 'Every species record. Review, publish, edit and export them here.'}
      />
      <ExternalNote />
      <PlantRecordsTable variant={botanist ? 'botanist' : 'staff'} />
    </div>
  );
}

export function RegisterPage() {
  useDocumentTitle('Register plant');
  async function handleSubmit(payload, imageFile) {
    return registerPlant(payload, imageFile); // the form shows the new QR code
  }
  return (
    <div>
      <PageHeader title="Register a new plant" description="Add what you know now. An Officer reviews the record before the public sees it." />
      <ExternalNote />
      <div className="panel panel-form">
        <PlantForm onSubmit={handleSubmit} submitLabel="Save record" />
      </div>
      <p className="form-footnote">Looking for plants you registered earlier? See <Link to="/records">My records</Link>.</p>
    </div>
  );
}

export function RequestsPage() {
  const { user } = useAuth();
  const botanist = user.role_name === ROLES.BOTANIST;
  useDocumentTitle(botanist ? 'My requests' : 'Change requests');
  return (
    <div>
      <PageHeader
        title={botanist ? 'My requests' : 'Change requests'}
        description={botanist ? 'Edits and deletions you have asked an Officer to approve.' : 'Edits and deletions that Botanists have asked you to approve. Approving applies the change.'}
      />
      {botanist ? <MyRequestsPanel /> : <ChangeRequestsPanel />}
    </div>
  );
}

export function MapPage() {
  useDocumentTitle('Distribution map');
  return (
    <div>
      <PageHeader title="Distribution map" description="Every plant with a GPS point, at its exact position, plus the IoT sensors." />
      <StaffMap />
    </div>
  );
}

export function IotPage() {
  useDocumentTitle('IoT monitoring');
  return (
    <div>
      <PageHeader title="IoT monitoring" description="Live readings and alerts from the sensors protecting the plants." />
      <IotDashboard />
    </div>
  );
}

export function AuditPage() {
  useDocumentTitle('Audit log');
  return (
    <div>
      <PageHeader title="Audit log" description="Every sign-in, record change, approval and account change, newest first." />
      <AuditLogPanel />
    </div>
  );
}
