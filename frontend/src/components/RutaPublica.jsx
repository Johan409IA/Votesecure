import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function RutaPublica({ children }) {
  const auth = useAuth();
  if (auth.estaAutenticado) return <Navigate to="/elecciones" replace />;
  return children;
}
