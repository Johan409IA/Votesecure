import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { desconectarSocket } from '../services/socket.service';

export default function Navbar() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [menuAbierto, setMenuAbierto] = useState(false);

  if (!auth.estaAutenticado) return null;

  const cerrarSesion = () => {
    desconectarSocket();
    auth.logout();
    navigate('/login');
  };

  const linkClass = ({ isActive }) => (isActive ? 'activo' : '');

  return (
    <nav className="navbar">
      <div className="nav-brand">
        <div className="escudo">
          <svg viewBox="0 0 48 48" width="30" height="30">
            <circle cx="24" cy="24" r="22" fill="none" stroke="currentColor" strokeWidth="2" />
            <path d="M24 10 L34 16 L34 26 Q34 34 24 38 Q14 34 14 26 L14 16 Z" fill="currentColor" opacity="0.15" />
            <path d="M24 10 L34 16 L34 26 Q34 34 24 38 Q14 34 14 26 L14 16 Z" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <path d="M18 24 L22 28 L31 18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div className="brand-text">
          <strong>VotoSeguro</strong>
          <span className="brand-sub">Sistema de votación digital</span>
        </div>
      </div>

      <div className={`nav-links ${menuAbierto ? 'abierto' : ''}`}>
        <NavLink to="/elecciones" className={linkClass} onClick={() => setMenuAbierto(false)}>Elecciones</NavLink>
        {auth.esAdmin && <NavLink to="/admin/organizaciones" className={linkClass} onClick={() => setMenuAbierto(false)}>Organizaciones</NavLink>}
        {auth.esAdmin && <NavLink to="/admin/elecciones/crear" className={linkClass} onClick={() => setMenuAbierto(false)}>Crear elección</NavLink>}
        {auth.esAdmin && <NavLink to="/admin/auditoria" className={linkClass} onClick={() => setMenuAbierto(false)}>Auditoría</NavLink>}
        <NavLink to="/mi-comprobante" className={linkClass} onClick={() => setMenuAbierto(false)}>Mi comprobante</NavLink>
      </div>

      <div className="nav-user">
        <span className={`badge ${auth.usuario?.rol}`}>{auth.usuario?.rol}</span>
        <span className="nav-user-nombre">{auth.usuario?.nombre}</span>
        <button onClick={cerrarSesion} className="btn-logout" aria-label="Cerrar sesión">Salir</button>
      </div>
      <button className="btn-hamburguesa" onClick={() => setMenuAbierto(!menuAbierto)} aria-label="Abrir menú">
        <span></span><span></span><span></span>
      </button>
    </nav>
  );
}
