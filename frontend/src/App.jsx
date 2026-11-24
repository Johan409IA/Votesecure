import { useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import AppRouter from './router/AppRouter';
import './components/Marco.css';

// Estas pantallas ocupan toda la ventana y no llevan barra ni pie.
const RUTAS_SIN_MARCO = ['/login', '/registro', '/verificar-correo'];

export default function App() {
  const { pathname } = useLocation();

  if (RUTAS_SIN_MARCO.includes(pathname)) return <AppRouter />;

  return (
    <div className="marco">
      <Navbar />
      <div className="marco-contenido">
        <AppRouter />
      </div>
      <footer className="marco-pie">
        © {new Date().getFullYear()} VoteSecure UTP. Todos los derechos reservados.
      </footer>
    </div>
  );
}
