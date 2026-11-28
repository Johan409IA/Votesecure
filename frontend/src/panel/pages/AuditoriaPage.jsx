import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Info, Monitor, ScrollText } from 'lucide-react';
import {
  listarAuditoria, listarElecciones, listarSecciones, obtenerEleccion,
} from '../../services/auditoria.panel.service';
import { ESTADO_ELECCION, EVENTO_AUDITORIA, fechaHoraCompleta } from '../formato';
import '../panel.css';

// "motivo_cancelacion" -> "Motivo cancelacion"
function nombreLegible(clave) {
  const texto = clave.replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2');
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function Detalle({ detalle }) {
  const entradas = Object.entries(detalle ?? {});
  if (entradas.length === 0) return <span className="panel-sin-datos">—</span>;
  return (
    <ul className="panel-detalle-evento">
      {entradas.map(([clave, valor]) => (
        <li key={clave}>
          <b>{nombreLegible(clave)}:</b>{' '}
          {typeof valor === 'object' && valor !== null ? JSON.stringify(valor) : String(valor)}
        </li>
      ))}
    </ul>
  );
}

// Ruta /panel/auditoria — solo administrador. También se abre desde otras pantallas
// con /panel/auditoria?eleccion=ID (el curso se averigua solo).
export default function AuditoriaPage() {
  const [params, setParams] = useSearchParams();
  const eleccionId = params.get('eleccion') ?? '';
  const eleccionValida = /^\d+$/.test(eleccionId);

  const [secciones, setSecciones] = useState(null);
  const [seccionId, setSeccionId] = useState('');
  const [elecciones, setElecciones] = useState([]);
  const [eventos, setEventos] = useState(null);
  const [cargandoEventos, setCargandoEventos] = useState(false);
  const [error, setError] = useState('');

  // Cursos para el primer selector.
  useEffect(() => {
    let activo = true;
    listarSecciones()
      .then((lista) => { if (activo) setSecciones(lista); })
      .catch((err) => { if (activo) setError(err.message); });
    return () => { activo = false; };
  }, []);

  // Si se llega con ?eleccion=ID, se averigua su curso.
  useEffect(() => {
    if (!eleccionValida || seccionId) return undefined;
    let activo = true;
    obtenerEleccion(eleccionId)
      .then((eleccion) => { if (activo) setSeccionId(String(eleccion.sectionId)); })
      .catch((err) => { if (activo) setError(err.message); });
    return () => { activo = false; };
  }, [eleccionId, eleccionValida, seccionId]);

  // Elecciones del curso elegido.
  useEffect(() => {
    if (!seccionId) {
      setElecciones([]);
      return undefined;
    }
    let activo = true;
    listarElecciones(seccionId)
      .then((lista) => { if (activo) setElecciones(lista); })
      .catch((err) => { if (activo) setError(err.message); });
    return () => { activo = false; };
  }, [seccionId]);

  // Historial de la elección elegida.
  useEffect(() => {
    if (!eleccionValida) {
      setEventos(null);
      return undefined;
    }
    let activo = true;
    setCargandoEventos(true);
    setError('');
    listarAuditoria(eleccionId)
      .then((lista) => { if (activo) setEventos(lista); })
      .catch((err) => {
        if (!activo) return;
        setError(err.message);
        setEventos(null);
      })
      .finally(() => { if (activo) setCargandoEventos(false); });
    return () => { activo = false; };
  }, [eleccionId, eleccionValida]);

  const cambiarCurso = (e) => {
    setSeccionId(e.target.value);
    setParams({});
  };
  const cambiarEleccion = (e) => {
    setParams(e.target.value ? { eleccion: e.target.value } : {});
  };

  const eleccionActual = elecciones.find((e) => String(e.id) === eleccionId);
  const nombreEleccion = eleccionActual?.name ?? eventos?.[0]?.electionName ?? `Elección #${eleccionId}`;
  const estadoActual = eleccionActual ? (ESTADO_ELECCION[eleccionActual.status] ?? { etiqueta: eleccionActual.status, tono: 'gris' }) : null;
  const sePuedeProyectar = eleccionActual && (eleccionActual.status === 'activa' || eleccionActual.status === 'cerrada');

  let contenido;
  if (!eleccionValida) {
    contenido = (
      <div className="panel-vacio">
        <ScrollText size={40} />
        <h2>Elige una elección</h2>
        <p>Selecciona un curso y una elección para ver su historial de eventos.</p>
      </div>
    );
  } else if (cargandoEventos) {
    contenido = <p className="panel-cargando">Cargando el historial…</p>;
  } else if (eventos) {
    contenido = (
      <>
        <div className="panel-tarjeta panel-resumen-eleccion">
          <div>
            <h2>{nombreEleccion}</h2>
            <span>{eventos.length === 1 ? '1 evento registrado' : `${eventos.length} eventos registrados`}</span>
          </div>
          <div className="panel-acciones-fila">
            {estadoActual && <span className={`panel-pildora tono-${estadoActual.tono}`}>{estadoActual.etiqueta}</span>}
            {sePuedeProyectar && (
              <Link to={`/panel/elecciones/${eleccionId}/proyector`} className="panel-boton panel-boton-claro panel-boton-chico">
                <Monitor size={16} /> Abrir proyector
              </Link>
            )}
          </div>
        </div>

        {eventos.length === 0 ? (
          <div className="panel-vacio"><p>Esta elección todavía no tiene eventos.</p></div>
        ) : (
          <div className="panel-tabla-caja">
            <table className="panel-tabla">
              <thead>
                <tr>
                  <th>Fecha y hora</th>
                  <th>Evento</th>
                  <th>Realizado por</th>
                  <th>Detalle</th>
                </tr>
              </thead>
              <tbody>
                {eventos.map((evento) => {
                  const info = EVENTO_AUDITORIA[evento.eventType]
                    ?? { etiqueta: evento.eventType, tono: 'gris', ayuda: '' };
                  const actor = evento.actorType === 'sistema'
                    ? 'Sistema'
                    : evento.actorName ?? `Usuario #${evento.actorUserId}`;
                  return (
                    <tr key={evento.id}>
                      <td style={{ whiteSpace: 'nowrap' }}>{fechaHoraCompleta(evento.occurredAt)}</td>
                      <td>
                        <span className={`panel-pildora tono-${info.tono}`} title={info.ayuda}>{info.etiqueta}</span>
                      </td>
                      <td>{actor}</td>
                      <td><Detalle detalle={evento.detail} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="panel-aviso panel-aviso-info" style={{ marginTop: '1rem' }}>
          <Info size={16} style={{ verticalAlign: '-3px' }} /> El historial es de solo lectura: ningún usuario
          puede modificar ni borrar estos eventos.
        </div>
      </>
    );
  }

  return (
    <div className="panel-pagina">
      <div className="panel-cabecera">
        <h1>Auditoría</h1>
        <p>Consulta el historial de eventos de cada elección.</p>
      </div>

      <div className="panel-tarjeta panel-filtros-auditoria">
        <div>
          <label htmlFor="filtro-curso">Curso</label>
          <select
            id="filtro-curso"
            className="panel-select"
            value={seccionId}
            onChange={cambiarCurso}
            disabled={secciones === null}
          >
            <option value="">{secciones === null ? 'Cargando cursos…' : 'Selecciona un curso…'}</option>
            {(secciones ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.courseName} — {s.code} ({s.academicPeriod})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="filtro-eleccion">Elección</label>
          <select
            id="filtro-eleccion"
            className="panel-select"
            value={eleccionId}
            onChange={cambiarEleccion}
            disabled={!seccionId}
          >
            <option value="">
              {seccionId && elecciones.length === 0 ? 'Este curso no tiene elecciones' : 'Selecciona una elección…'}
            </option>
            {elecciones.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name} — {(ESTADO_ELECCION[e.status] ?? { etiqueta: e.status }).etiqueta}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && <div className="panel-aviso panel-aviso-error" role="alert">{error}</div>}

      {contenido}
    </div>
  );
}
