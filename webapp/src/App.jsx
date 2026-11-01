import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { ConfirmProvider } from './context/ConfirmContext';
import PrivateRoute from './components/PrivateRoute';
import PublicLayout from './components/shell/PublicLayout';
import SetupGate from './components/SetupGate';
import { ROLES } from './roles';

import Home from './pages/Home';
import SpeciesCatalog from './pages/SpeciesCatalog';
import SpeciesDetail from './pages/SpeciesDetail';
import Login from './pages/Login';
import RoleOnly from './components/RoleOnly';

// The staff area is loaded only when someone signs in, so park visitors on a phone
// download just the public pages.
const DashboardLayout = lazy(() => import('./components/DashboardLayout'));
const Account = lazy(() => import('./pages/Account'));
const Overview = lazy(() => import('./pages/Overview'));
const Reports = lazy(() => import('./pages/Reports'));
const UsersPage = lazy(() => import('./pages/UsersPage'));
const page = (name) => lazy(() => import('./pages/FeaturePages').then((m) => ({ default: m[name] })));
const RecordsPage = page('RecordsPage');
const RegisterPage = page('RegisterPage');
const RequestsPage = page('RequestsPage');
const MapPage = page('MapPage');
const IotPage = page('IotPage');
const AuditPage = page('AuditPage');

function Loading() {
  return <div className="route-loading" role="status">Loading…</div>;
}

const STAFF = [ROLES.OFFICER, ROLES.ADMIN];
const ALL = [ROLES.BOTANIST, ROLES.OFFICER, ROLES.ADMIN];

export default function App() {
  return (
    <ToastProvider>
      <ConfirmProvider>
        <AuthProvider>
          <SetupGate>
            <Suspense fallback={<Loading />}>
            <Routes>
              {/* Public site */}
              <Route element={<PublicLayout />}>
                <Route path="/" element={<Home />} />
                <Route path="/species" element={<SpeciesCatalog />} />
                {/* Public plants are identified by QR code, as in the public API */}
                <Route path="/species/:qrCode" element={<SpeciesDetail />} />
                <Route path="/login" element={<Login />} />
              </Route>

              {/* Staff area: rail + top bar + one page per feature */}
              <Route element={<PrivateRoute><DashboardLayout /></PrivateRoute>}>
                <Route path="/botanist" element={<RoleOnly roles={[ROLES.BOTANIST]}><Overview /></RoleOnly>} />
                <Route path="/officer" element={<RoleOnly roles={[ROLES.OFFICER]}><Overview /></RoleOnly>} />
                <Route path="/admin" element={<RoleOnly roles={[ROLES.ADMIN]}><Overview /></RoleOnly>} />
                <Route path="/register" element={<RoleOnly roles={[ROLES.BOTANIST]}><RegisterPage /></RoleOnly>} />
                <Route path="/records" element={<RoleOnly roles={ALL}><RecordsPage /></RoleOnly>} />
                <Route path="/requests" element={<RoleOnly roles={ALL}><RequestsPage /></RoleOnly>} />
                <Route path="/map" element={<RoleOnly roles={STAFF}><MapPage /></RoleOnly>} />
                <Route path="/iot" element={<RoleOnly roles={STAFF}><IotPage /></RoleOnly>} />
                <Route path="/reports" element={<RoleOnly roles={STAFF}><Reports /></RoleOnly>} />
                <Route path="/users" element={<RoleOnly roles={[ROLES.ADMIN]}><UsersPage /></RoleOnly>} />
                <Route path="/audit" element={<RoleOnly roles={[ROLES.ADMIN]}><AuditPage /></RoleOnly>} />
                <Route path="/account" element={<Account />} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            </Suspense>
          </SetupGate>
        </AuthProvider>
      </ConfirmProvider>
    </ToastProvider>
  );
}
