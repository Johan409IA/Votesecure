import { NavLink, useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import Avatar from './Avatar';
import './Navbar.css';

// Enlaces de la barra según el rol. Docentes y administradores entran al panel
// (su menú lateral está en src/panel/menu.js); los estudiantes, a sus cursos.
const ENLACES_ESTUDIANTE = [
  { to: '/cursos', label: 'Mis cursos' },
];
const ENLACES_PANEL = [
  { to: '/panel', label: 'Panel' },
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

  const enPanel = auth.esAdmin || auth.esDocente;
  const enlaces = enPanel ? ENLACES_PANEL : ENLACES_ESTUDIANTE;

  const cerrarSesion = async () => {
    await auth.logout();
    navigate('/login');
  };

  return (
    <header className="topbar">
      <NavLink to={enlaces[0].to} className="topbar-marca" aria-label="VoteSecure, ir al inicio">
        <img src="/assets/logo_votesecure.png" alt="VoteSecure UTP" />
      </NavLink>

      <nav className="topbar-enlaces">
        {enlaces.map((enlace) => (
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
        <NavLink to="/perfil" className="topbar-perfil" aria-label="Mi perfil">
          <Avatar nombre={auth.usuario.nombre} fotoUrl={auth.usuario.fotoUrl} tamano={42} />
          <div className="topbar-datos">
            <span className="topbar-nombre">{auth.usuario.nombre}</span>
            <span className="topbar-rol">{ETIQUETA_ROL[auth.usuario.tipo] ?? auth.usuario.tipo}</span>
          </div>
        </NavLink>
        <span className="topbar-separador" aria-hidden="true"></span>
        <button type="button" className="topbar-salir" onClick={cerrarSesion}>
          <LogOut size={18} /> <span>Cerrar sesión</span>
        </button>
      </div>
    </header>
  );
}
