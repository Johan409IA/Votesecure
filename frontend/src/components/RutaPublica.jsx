import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

// Páginas solo para quien NO ha iniciado sesión (login y registro).
export default function RutaPublica({ children }) {
  const auth = useAuth();
  const location = useLocation();

  if (auth.cargando) return <div className="spinner">Cargando…</div>;
  if (auth.estaAutenticado) {
    const destino = location.state?.from?.pathname ?? '/';
    return <Navigate to={destino} replace />;
  }
  return children;
}
