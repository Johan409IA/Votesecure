import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function RutaProtegida({ children, soloAdmin = false }) {
  const auth = useAuth();

  if (!auth.estaAutenticado) return <Navigate to="/login" replace />;
  if (soloAdmin && !auth.esAdmin) return <Navigate to="/elecciones" replace />;

  return children;
}
