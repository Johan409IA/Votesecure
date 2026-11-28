import { Navigate, Routes, Route } from 'react-router-dom';
import RutaProtegida from '../components/RutaProtegida';
import RutaPublica from '../components/RutaPublica';
import { useAuth } from '../hooks/useAuth';

import CursoPage from '../pages/CursoPage';
import LoginPage from '../pages/LoginPage';
import MisCursosPage from '../pages/MisCursosPage';
import NotFoundPage from '../pages/NotFoundPage';
import RegistroPage from '../pages/RegistroPage';
import ResultadosPage from '../pages/ResultadosPage';
import VerificarCorreoPage from '../pages/VerificarCorreoPage';
import CandidatosPage from '../pages/CandidatosPage';
import EvaluarDelegadoPage from '../pages/EvaluarDelegadoPage';
import PerfilPage from '../pages/PerfilPage';

// Panel de docentes y administradores (ver src/panel/README.md)
import PanelLayout from '../panel/PanelLayout';
import { ROLES_PANEL, SOLO_ADMIN } from '../panel/menu';
import InicioPanel from '../panel/pages/InicioPanel';
import SeccionesPage from '../panel/pages/SeccionesPage';
import SeccionDetallePage from '../panel/pages/SeccionDetallePage';
import NuevaEleccionPage from '../panel/pages/NuevaEleccionPage';
import EleccionPage from '../panel/pages/EleccionPage';
import CuentasPage from '../panel/pages/CuentasPage';
import AuditoriaPage from '../panel/pages/AuditoriaPage';
import ProyectorPage from '../panel/pages/ProyectorPage';

// Después de iniciar sesión cada rol cae en su pantalla de inicio:
// docentes y administradores en el panel, estudiantes en sus cursos.
function RedireccionInicio() {
  const { esAdmin, esDocente } = useAuth();
  return <Navigate to={esAdmin || esDocente ? '/panel' : '/cursos'} replace />;
}

export default function AppRouter() {
  return (
    <Routes>
      {/* Públicas */}
      <Route path="/login" element={<RutaPublica><LoginPage /></RutaPublica>} />
      <Route path="/registro" element={<RutaPublica><RegistroPage /></RutaPublica>} />
      <Route path="/verificar-correo" element={<VerificarCorreoPage />} />

      {/* Con sesión. Para limitar por rol: <RutaProtegida roles={['docente', 'administrador']}> */}
      <Route path="/" element={<RutaProtegida><RedireccionInicio /></RutaProtegida>} />
      <Route path="/cursos" element={<RutaProtegida><MisCursosPage /></RutaProtegida>} />
      <Route path="/cursos/:id" element={<RutaProtegida><CursoPage /></RutaProtegida>} />

      {/* /votar: candidatos y voto; /resultados: resultados en vivo y finales */}
      <Route path="/cursos/:id/votar" element={<RutaProtegida><CandidatosPage /></RutaProtegida>} />
      <Route path="/cursos/:id/resultados" element={<RutaProtegida><ResultadosPage /></RutaProtegida>} />

      <Route path="/cursos/:id/evaluar" element={<RutaProtegida><EvaluarDelegadoPage /></RutaProtegida>} />
      <Route path="/perfil" element={<RutaProtegida><PerfilPage /></RutaProtegida>} />

      {/* Panel: docente y administrador. Las pantallas de cuentas y auditoría, solo administrador. */}
      <Route path="/panel" element={<RutaProtegida roles={ROLES_PANEL}><PanelLayout /></RutaProtegida>}>
        <Route index element={<InicioPanel />} />
        <Route path="secciones" element={<SeccionesPage />} />
        <Route path="secciones/:id" element={<SeccionDetallePage />} />
        <Route path="secciones/:id/elecciones/nueva" element={<NuevaEleccionPage />} />
        <Route path="elecciones/:id" element={<EleccionPage />} />
        <Route path="cuentas" element={<RutaProtegida roles={SOLO_ADMIN}><CuentasPage /></RutaProtegida>} />
        <Route path="auditoria" element={<RutaProtegida roles={SOLO_ADMIN}><AuditoriaPage /></RutaProtegida>} />
      </Route>
      {/* El proyector va fuera del PanelLayout: pantalla completa, sin barra ni pie (ver App.jsx) */}
      <Route
        path="/panel/elecciones/:id/proyector"
        element={<RutaProtegida roles={ROLES_PANEL}><ProyectorPage /></RutaProtegida>}
      />

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
