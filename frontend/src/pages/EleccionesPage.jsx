import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { listarElecciones, listarOrganizaciones, listarOrganizacionesPublico } from '../services/eleccion.service';
import './EleccionesPage.css';

const estadosFiltro = [
  { valor: 'todas', label: 'Todas' },
  { valor: 'activa', label: 'Activas' },
  { valor: 'borrador', label: 'Borrador' },
  { valor: 'finalizada', label: 'Finalizadas' },
];

const formatFecha = (f) => f ? new Date(f).toLocaleDateString('es-PE', { day: '2-digit', month: 'short' }) : '-';

export default function EleccionesPage() {
  const auth = useAuth();
  const [elecciones, setElecciones] = useState([]);
  const [organizaciones, setOrganizaciones] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [filtroActivo, setFiltroActivo] = useState('todas');
  const [organizacionFiltro, setOrganizacionFiltro] = useState(auth.esAdmin ? '' : (auth.usuario?.organizacion_id || ''));

  const miOrganizacionNombre = useMemo(() => {
    const org = organizaciones.find((o) => o._id === auth.usuario?.organizacion_id);
    return org?.nombre || 'Sin organización asignada';
  }, [organizaciones, auth.usuario]);

  const eleccionesFiltradas = useMemo(() =>
    filtroActivo === 'todas' ? elecciones : elecciones.filter((e) => e.estado === filtroActivo),
  [elecciones, filtroActivo]);

  const cargarElecciones = useCallback(async () => {
    setCargando(true);
    try {
      const params = {};
      if (organizacionFiltro) params.organizacion_id = organizacionFiltro;
      setElecciones(await listarElecciones(params));
    } catch (e) {
      console.error(e);
    } finally {
      setCargando(false);
    }
  }, [organizacionFiltro]);

  useEffect(() => {
    (auth.esAdmin ? listarOrganizaciones() : listarOrganizacionesPublico())
      .then(setOrganizaciones).catch(console.error);
  }, [auth.esAdmin]);

  useEffect(() => { cargarElecciones(); }, [cargarElecciones]);

  return (
    <div>
      <div className="page-header">
        <h1>Elecciones</h1>
        <div className="filtros-bloque">
          {auth.esAdmin ? (
            <select value={organizacionFiltro} onChange={(e) => setOrganizacionFiltro(e.target.value)} className="select-org">
              <option value="">Todas las organizaciones</option>
              {organizaciones.map((o) => <option key={o._id} value={o._id}>{o.nombre}</option>)}
            </select>
          ) : (
            <span className="mi-org-label">{miOrganizacionNombre}</span>
          )}
          <div className="filtros">
            {estadosFiltro.map((e) => (
              <button key={e.valor} onClick={() => setFiltroActivo(e.valor)}
                className={`btn-filtro ${filtroActivo === e.valor ? 'activo' : ''}`}>{e.label}</button>
            ))}
          </div>
        </div>
      </div>

      {cargando ? (
        <div className="spinner">Cargando elecciones...</div>
      ) : eleccionesFiltradas.length === 0 ? (
        <div className="card vacio"><p>No hay elecciones {filtroActivo !== 'todas' ? `"${filtroActivo}"` : ''} disponibles.</p></div>
      ) : (
        <div className="grid-elecciones">
          {eleccionesFiltradas.map((e) => (
            <div key={e._id} className="eleccion-card card">
              <div className="eleccion-header">
                <span className={`badge-estado badge-${e.estado}`}>{e.estado}</span>
                <span className="org-nombre">{e.organizacion_id?.nombre}</span>
              </div>
              <h2>{e.titulo}</h2>
              <p className="descripcion">{e.descripcion}</p>
              <div className="eleccion-stats">
                <div className="stat"><span className="stat-val">{e.totalVotos ?? 0}</span><span className="stat-lbl">votos</span></div>
                <div className="stat"><span className="stat-val">{e.totalParticipantes ?? 0}</span><span className="stat-lbl">participantes</span></div>
                <div className="stat"><span className="stat-val">{formatFecha(e.fechaFin)}</span><span className="stat-lbl">cierra</span></div>
              </div>
              <div className="eleccion-actions">
                <Link to={`/elecciones/${e._id}`} className="btn btn-outline">Ver detalle</Link>
                {e.estado === 'activa' && <Link to={`/elecciones/${e._id}/votar`} className="btn btn-primary">Votar</Link>}
                <Link to={`/elecciones/${e._id}/resultados`} className="btn btn-outline">Resultados</Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
