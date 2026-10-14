import { useState, useEffect, useCallback } from 'react';
import { obtenerAuditoria } from '../../services/eleccion.service';
import './AdminPages.css';

const formatFechaHora = (f) => f ? new Date(f).toLocaleString('es-PE') : '-';

const coloresAccion = {
  LOGIN_EXITOSO: 'badge-activa',
  LOGIN_FALLIDO: 'badge-cancelada',
  VOTO_EMITIDO: 'badge-activa',
  ELECCION_CREADA: 'badge-borrador',
  CONSULTA_RENIEC: 'badge-finalizada',
  ACCESO_NO_AUTORIZADO: 'badge-cancelada',
};

export default function AuditoriaPage() {
  const [registros, setRegistros] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [filtroAccion, setFiltroAccion] = useState('');
  const [pagina, setPagina] = useState(1);
  const [totalPaginas, setTotalPaginas] = useState(1);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const params = { pagina, limite: 20 };
      if (filtroAccion) params.accion = filtroAccion;
      const data = await obtenerAuditoria(params);
      setRegistros(data.logs || data.registros || []);
      setTotalPaginas(Math.ceil((data.total || 0) / 20) || 1);
    } catch (e) {
      console.error(e);
    } finally {
      setCargando(false);
    }
  }, [pagina, filtroAccion]);

  useEffect(() => { cargar(); }, [cargar]);

  return (
    <div>
      <h1>Registro de auditoría</h1>
      <p className="subtitulo">Trazabilidad de todas las acciones sensibles del sistema: inicios de sesión, votos, verificaciones RENIEC y cambios administrativos.</p>

      <div className="filtros-auditoria">
        <select value={filtroAccion} onChange={(e) => { setFiltroAccion(e.target.value); setPagina(1); }}>
          <option value="">Todas las acciones</option>
          <option value="LOGIN_EXITOSO">Login exitoso</option>
          <option value="LOGIN_FALLIDO">Login fallido</option>
          <option value="VOTO_EMITIDO">Voto emitido</option>
          <option value="ELECCION_CREADA">Elección creada</option>
          <option value="CONSULTA_RENIEC">Consulta RENIEC</option>
          <option value="ACCESO_NO_AUTORIZADO">Acceso no autorizado</option>
        </select>
      </div>

      {cargando ? (
        <div className="spinner">Cargando auditoría...</div>
      ) : registros.length === 0 ? (
        <div className="card vacio"><p>No hay registros para este filtro.</p></div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="tabla-auditoria">
            <thead>
              <tr><th>Fecha</th><th>Acción</th><th>Usuario</th><th>IP</th><th>Detalle</th></tr>
            </thead>
            <tbody>
              {registros.map((r) => (
                <tr key={r._id}>
                  <td className="col-fecha">{formatFechaHora(r.fechaHora)}</td>
                  <td><span className={`badge-estado ${coloresAccion[r.accion] || 'badge-borrador'}`}>{r.accion}</span></td>
                  <td>{r.usuario_id?.nombre || 'Anónimo / público'}</td>
                  <td className="col-ip">{r.ip}</td>
                  <td className="col-detalle">{r.detalle}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPaginas > 1 && (
        <div className="paginacion">
          <button disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)} className="btn btn-outline">← Anterior</button>
          <span>Página {pagina} de {totalPaginas}</span>
          <button disabled={pagina >= totalPaginas} onClick={() => setPagina((p) => p + 1)} className="btn btn-outline">Siguiente →</button>
        </div>
      )}
    </div>
  );
}
