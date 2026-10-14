import { Routes, Route, Navigate } from 'react-router-dom';
import RutaProtegida from '../components/RutaProtegida';
import RutaPublica from '../components/RutaPublica';

import LoginPage from '../pages/LoginPage';
import RegistroPage from '../pages/RegistroPage';
import EleccionesPage from '../pages/EleccionesPage';
import EleccionDetallePage from '../pages/EleccionDetallePage';
import VotarPage from '../pages/VotarPage';
import ResultadosPage from '../pages/ResultadosPage';
import ComprobantePage from '../pages/ComprobantePage';
import NotFoundPage from '../pages/NotFoundPage';

import CrearEleccionPage from '../pages/admin/CrearEleccionPage';
import OrganizacionesPage from '../pages/admin/OrganizacionesPage';
import AuditoriaPage from '../pages/admin/AuditoriaPage';

export default function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/elecciones" replace />} />

      {/* Rutas públicas */}
      <Route path="/login" element={<RutaPublica><LoginPage /></RutaPublica>} />
      <Route path="/registro" element={<RutaPublica><RegistroPage /></RutaPublica>} />

      {/* Rutas protegidas (requieren sesión) */}
      <Route path="/elecciones" element={<RutaProtegida><EleccionesPage /></RutaProtegida>} />
      <Route path="/elecciones/:id" element={<RutaProtegida><EleccionDetallePage /></RutaProtegida>} />
      <Route path="/elecciones/:id/votar" element={<RutaProtegida><VotarPage /></RutaProtegida>} />
      <Route path="/elecciones/:id/resultados" element={<RutaProtegida><ResultadosPage /></RutaProtegida>} />
      <Route path="/mi-comprobante" element={<RutaProtegida><ComprobantePage /></RutaProtegida>} />

      {/* Rutas solo-admin */}
      <Route path="/admin/elecciones/crear" element={<RutaProtegida soloAdmin><CrearEleccionPage /></RutaProtegida>} />
      <Route path="/admin/organizaciones" element={<RutaProtegida soloAdmin><OrganizacionesPage /></RutaProtegida>} />
      <Route path="/admin/auditoria" element={<RutaProtegida soloAdmin><AuditoriaPage /></RutaProtegida>} />

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
