import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { menuParaRol } from './menu';
import './panel.css';

// Marco de todas las pantallas del panel: menú lateral según el rol y,
// a la derecha, la pantalla de la ruta (<Outlet />).
export default function PanelLayout() {
  const { usuario, esAdmin } = useAuth();
  const { pathname } = useLocation();
  const items = menuParaRol(usuario.tipo);

  return (
    <div className="panel">
      <aside className="panel-menu" aria-label="Menú del panel">
        <p className="panel-menu-titulo">{esAdmin ? 'Administración' : 'Panel docente'}</p>
        <nav>
          {items.map(({ to, etiqueta, icono: Icono, fin, tambien = [] }) => (
            <NavLink
              key={to}
              to={to}
              end={fin}
              className={({ isActive }) => {
                const activo = isActive || tambien.some((ruta) => pathname.startsWith(ruta));
                return `panel-menu-enlace${activo ? ' activo' : ''}`;
              }}
            >
              <Icono size={19} />
              <span>{etiqueta}</span>
            </NavLink>
          ))}
        </nav>
      </aside>

      <section className="panel-contenido">
        <Outlet />
      </section>
    </div>
  );
}
