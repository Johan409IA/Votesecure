import { useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import AppRouter from './router/AppRouter';
import './components/Marco.css';

// Estas pantallas ocupan toda la ventana y no llevan barra ni pie.
const RUTAS_SIN_MARCO = ['/login', '/registro', '/verificar-correo'];
// El proyector del panel también va a pantalla completa: /panel/elecciones/:id/proyector
const RUTA_PROYECTOR = /^\/panel\/elecciones\/[^/]+\/proyector\/?$/;

export default function App() {
  const { pathname } = useLocation();

  if (RUTAS_SIN_MARCO.includes(pathname) || RUTA_PROYECTOR.test(pathname)) {
    return <AppRouter />;
  }

  return (
    <div className="marco">
      <Navbar />
      <div className={`marco-contenido${pathname.startsWith('/panel') ? ' ancho' : ''}`}>
        <AppRouter />
      </div>
      <footer className="marco-pie">
        © {new Date().getFullYear()} VoteSecure UTP. Todos los derechos reservados.
      </footer>
    </div>
  );
}
