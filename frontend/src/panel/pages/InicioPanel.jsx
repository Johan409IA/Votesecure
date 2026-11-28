import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Monitor, Settings2 } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { cargarResumenPanel } from '../../services/inicio.panel.service';
import { menuParaRol } from '../menu';
import '../panel.css';

// Inicio del panel (/panel): cifras, votaciones en curso y accesos según el rol.
// Los accesos salen de menu.js, así que no hay que tocar este archivo al agregar opciones.
export default function InicioPanel() {
  const { usuario, esAdmin } = useAuth();
  const primerNombre = usuario.nombre.split(' ')[0];
  const accesos = menuParaRol(usuario.tipo).filter((item) => !item.fin);
  const [resumen, setResumen] = useState(undefined); // undefined = cargando, null = no se pudo

  useEffect(() => {
    let activo = true;
    cargarResumenPanel(esAdmin)
      .then((datos) => { if (activo) setResumen(datos); })
      .catch(() => { if (activo) setResumen(null); });
    return () => { activo = false; };
  }, [esAdmin]);

  const cifra = (valor) => (resumen ? valor : '—');

  return (
    <div className="panel-pagina">
      <div className="panel-cabecera">
        <h1>Hola, {primerNombre}</h1>
        <p>
          {esAdmin
            ? 'Desde aquí administras secciones, cuentas y la auditoría de las elecciones.'
            : 'Desde aquí gestionas tus secciones, sus elecciones y evaluaciones.'}
        </p>
      </div>

      <div className="panel-resumen">
        <div className="panel-dato"><strong>{cifra(resumen?.secciones)}</strong><span>Secciones</span></div>
        <div className="panel-dato"><strong>{cifra(resumen?.activas.length)}</strong><span>Votaciones abiertas</span></div>
        <div className="panel-dato"><strong>{cifra(resumen?.programadas)}</strong><span>Elecciones programadas</span></div>
        {esAdmin && (
          <>
            <div className="panel-dato"><strong>{cifra(resumen?.cuentas?.total)}</strong><span>Cuentas</span></div>
            <div className="panel-dato"><strong>{cifra(resumen?.cuentas?.sinVerificar)}</strong><span>Sin verificar</span></div>
          </>
        )}
      </div>

      {resumen && resumen.activas.length > 0 && (
        <section className="panel-tarjeta panel-en-curso">
          <h2>Votaciones en curso</h2>
          <ul>
            {resumen.activas.slice(0, 6).map((e) => (
              <li key={e.id}>
                <div className="panel-en-curso-info">
                  <strong>{e.name}</strong>
                  <span>{e.seccionNombre} · {e.seccionCodigo}</span>
                </div>
                <Link to={`/panel/elecciones/${e.id}/proyector`} className="panel-boton panel-boton-claro panel-boton-chico">
                  <Monitor size={16} /> Proyector
                </Link>
                <Link to={`/panel/elecciones/${e.id}`} className="panel-boton panel-boton-gris panel-boton-chico">
                  <Settings2 size={16} /> Gestionar
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="panel-rejilla">
        {accesos.map(({ to, etiqueta, descripcion, icono: Icono }) => (
          <Link key={to} to={to} className="panel-tarjeta panel-acceso">
            <span className="panel-acceso-icono"><Icono size={26} /></span>
            <div>
              <h2>{etiqueta}</h2>
              <p>{descripcion}</p>
            </div>
            <ArrowRight size={20} className="panel-acceso-flecha" />
          </Link>
        ))}
      </div>
    </div>
  );
}
