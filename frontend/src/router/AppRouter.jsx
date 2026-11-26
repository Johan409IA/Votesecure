import { Navigate, Routes, Route } from 'react-router-dom';
import RutaProtegida from '../components/RutaProtegida';
import RutaPublica from '../components/RutaPublica';
import { useAuth } from '../hooks/useAuth';

import CandidatosPage from '../pages/CandidatosPage';
import CursoPage from '../pages/CursoPage';
import LoginPage from '../pages/LoginPage';
import MisCursosPage from '../pages/MisCursosPage';
import NotFoundPage from '../pages/NotFoundPage';
import RegistroPage from '../pages/RegistroPage';
import ResultadosPage from '../pages/ResultadosPage';
import VerificarCorreoPage from '../pages/VerificarCorreoPage';
import AdminAuditoriaPage from '../pages/admin/AdminAuditoriaPage';
import AdminCursoPage from '../pages/admin/AdminCursoPage';
import AdminCursosPage from '../pages/admin/AdminCursosPage';

// Después de iniciar sesión cada rol cae en su propia pantalla de inicio.
function RedireccionInicio() {
  const { esAdmin } = useAuth();
  return <Navigate to={esAdmin ? '/admin/cursos' : '/cursos'} replace />;
}

const SOLO_ADMIN = ['administrador'];

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

      {/* Panel de administrador */}
      <Route path="/admin/cursos" element={<RutaProtegida roles={SOLO_ADMIN}><AdminCursosPage /></RutaProtegida>} />
      <Route path="/admin/cursos/:id" element={<RutaProtegida roles={SOLO_ADMIN}><AdminCursoPage /></RutaProtegida>} />
      <Route path="/admin/auditoria" element={<RutaProtegida roles={SOLO_ADMIN}><AdminAuditoriaPage /></RutaProtegida>} />

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}