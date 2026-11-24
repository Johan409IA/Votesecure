import { Navigate, Routes, Route } from 'react-router-dom';
import RutaProtegida from '../components/RutaProtegida';
import RutaPublica from '../components/RutaPublica';

import CursoPage from '../pages/CursoPage';
import LoginPage from '../pages/LoginPage';
import MisCursosPage from '../pages/MisCursosPage';
import NotFoundPage from '../pages/NotFoundPage';
import ProximamentePage from '../pages/ProximamentePage';
import RegistroPage from '../pages/RegistroPage';
import VerificarCorreoPage from '../pages/VerificarCorreoPage';

export default function AppRouter() {
  return (
    <Routes>
      {/* Públicas */}
      <Route path="/login" element={<RutaPublica><LoginPage /></RutaPublica>} />
      <Route path="/registro" element={<RutaPublica><RegistroPage /></RutaPublica>} />
      <Route path="/verificar-correo" element={<VerificarCorreoPage />} />

      {/* Con sesión. Para limitar por rol: <RutaProtegida roles={['docente', 'administrador']}> */}
      <Route path="/" element={<Navigate to="/cursos" replace />} />
      <Route path="/cursos" element={<RutaProtegida><MisCursosPage /></RutaProtegida>} />
      <Route path="/cursos/:id" element={<RutaProtegida><CursoPage /></RutaProtegida>} />

      {/* Pantallas por construir: candidatos/votar y resultados en vivo */}
      <Route path="/cursos/:id/votar" element={<RutaProtegida><ProximamentePage /></RutaProtegida>} />
      <Route path="/cursos/:id/resultados" element={<RutaProtegida><ProximamentePage /></RutaProtegida>} />

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
