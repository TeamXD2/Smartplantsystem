import { Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import PrivateRoute from './components/PrivateRoute';
import Navbar from './components/Navbar';

import Home from './pages/Home';
import SpeciesCatalog from './pages/SpeciesCatalog';
import SpeciesDetail from './pages/SpeciesDetail';
import Login from './pages/Login';
import Register from './pages/Register';
import BotanistDashboard from './pages/BotanistDashboard';
import OfficerDashboard from './pages/OfficerDashboard';
import AdminDashboard from './pages/AdminDashboard';

export default function App() {
  return (
    <AuthProvider>
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/species" element={<SpeciesCatalog />} />
        <Route path="/species/:id" element={<SpeciesDetail />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        <Route
          path="/botanist"
          element={
            <PrivateRoute roles={['botanist']}>
              <BotanistDashboard />
            </PrivateRoute>
          }
        />
        <Route
          path="/officer"
          element={
            <PrivateRoute roles={['conservation_officer']}>
              <OfficerDashboard />
            </PrivateRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <PrivateRoute roles={['admin']}>
              <AdminDashboard />
            </PrivateRoute>
          }
        />
      </Routes>
    </AuthProvider>
  );
}
