import { NavLink, useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { inicialesDeUsuario } from '../utils/cursos';
import './Navbar.css';

// Enlaces de la barra. Se irán agregando aquí al construir cada pantalla.
const ENLACES = [
  { to: '/cursos', label: 'Mis cursos' },
];

const ETIQUETA_ROL = {
  estudiante: 'Estudiante',
  docente: 'Docente',
  administrador: 'Administrador',
};

export default function Navbar() {
  const auth = useAuth();
  const navigate = useNavigate();

  if (!auth.estaAutenticado) return null;

  const cerrarSesion = async () => {
    await auth.logout();
    navigate('/login');
  };

  return (
    <header className="topbar">
      <NavLink to="/cursos" className="topbar-marca" aria-label="VoteSecure, ir a mis cursos">
        <img src="/assets/logo_votesecure.png" alt="VoteSecure UTP" />
      </NavLink>

      <nav className="topbar-enlaces">
        {ENLACES.map((enlace) => (
          <NavLink
            key={enlace.to}
            to={enlace.to}
            className={({ isActive }) => (isActive ? 'activo' : '')}
          >
            {enlace.label}
          </NavLink>
        ))}
      </nav>

      <div className="topbar-usuario">
        <span className="topbar-avatar" aria-hidden="true">{inicialesDeUsuario(auth.usuario.nombre)}</span>
        <div className="topbar-datos">
          <span className="topbar-nombre">{auth.usuario.nombre}</span>
          <span className="topbar-rol">{ETIQUETA_ROL[auth.usuario.tipo] ?? auth.usuario.tipo}</span>
        </div>
        <span className="topbar-separador" aria-hidden="true"></span>
        <button type="button" className="topbar-salir" onClick={cerrarSesion}>
          <LogOut size={18} /> <span>Cerrar sesión</span>
        </button>
      </div>
    </header>
  );
}
