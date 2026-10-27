import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import PrivateRoute from './components/PrivateRoute';
import Navbar from './components/Navbar';
import SetupGate from './components/SetupGate';
import { ROLES } from './roles';

import Home from './pages/Home';
import SpeciesCatalog from './pages/SpeciesCatalog';
import SpeciesDetail from './pages/SpeciesDetail';
import Login from './pages/Login';
import Account from './pages/Account';
import Overview from './pages/Overview';
import Reports from './pages/Reports';
import UsersPage from './pages/UsersPage';
import { RecordsPage, RegisterPage, RequestsPage, MapPage, IotPage, AuditPage } from './pages/FeaturePages';
import DashboardLayout from './components/DashboardLayout';
import RoleOnly from './components/RoleOnly';

const STAFF = [ROLES.OFFICER, ROLES.ADMIN];
const ALL = [ROLES.BOTANIST, ROLES.OFFICER, ROLES.ADMIN];

export default function App() {
  return (
    <AuthProvider>
      <SetupGate>
        <Navbar />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/species" element={<SpeciesCatalog />} />
          {/* Public plants are identified by QR code, as in the public API */}
          <Route path="/species/:qrCode" element={<SpeciesDetail />} />
          <Route path="/login" element={<Login />} />

          {/* Staff area: sidebar + one page per feature */}
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
      </SetupGate>
    </AuthProvider>
  );
}
