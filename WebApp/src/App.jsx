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
import BotanistDashboard from './pages/BotanistDashboard';
import OfficerDashboard from './pages/OfficerDashboard';
import AdminDashboard from './pages/AdminDashboard';

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

          <Route
            path="/botanist"
            element={
              <PrivateRoute roles={[ROLES.BOTANIST]}>
                <BotanistDashboard />
              </PrivateRoute>
            }
          />
          <Route
            path="/officer"
            element={
              <PrivateRoute roles={[ROLES.OFFICER]}>
                <OfficerDashboard />
              </PrivateRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <PrivateRoute roles={[ROLES.ADMIN]}>
                <AdminDashboard />
              </PrivateRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </SetupGate>
    </AuthProvider>
  );
}
