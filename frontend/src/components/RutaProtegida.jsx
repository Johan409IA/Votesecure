import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

// roles (opcional): lista de tipos permitidos, p. ej. ['docente', 'administrador'].
export default function RutaProtegida({ children, roles }) {
  const auth = useAuth();
  const location = useLocation();

  if (auth.cargando) return <div className="spinner">Cargando…</div>;
  if (!auth.estaAutenticado) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  if (roles && !roles.includes(auth.usuario.tipo)) {
    return <Navigate to="/" replace />;
  }
  return children;
}
