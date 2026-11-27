import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, ChevronRight, Clock, Info, User, Vote,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import TarjetaEvaluacion from '../components/TarjetaEvaluacion';
import { cargarCurso } from '../services/curso.service';
import { ESTADOS, fechaLegible, iniciales } from '../utils/cursos';
import './Cursos.css';

const PASOS = ['Revisa candidatos', 'Selecciona uno', 'Confirma tu voto'];

// Texto de la tarjeta principal según el estado de la elección.
function textosDelEstado(estado, eleccion, puedeVotar) {
  switch (estado) {
    case 'abierta':
      return puedeVotar
        ? {
            titulo: 'Elige al estudiante que deseas como delegado de esta sección.',
            sub: 'Revisa a los candidatos, selecciona uno y confirma tu voto.',
            actual: 'Esperando tu participación',
            detalle: `La votación cierra el ${fechaLegible(eleccion?.endsAt)}.`,
          }
        : {
            titulo: 'La votación de esta sección está abierta.',
            sub: 'Solo los estudiantes de la sección pueden votar.',
            actual: 'Votación en curso',
            detalle: `Cierra el ${fechaLegible(eleccion?.endsAt)}.`,
          };
    case 'participaste':
      return {
        titulo: 'Ya emitiste tu voto.',
        sub: 'Tu participación quedó registrada. Puedes seguir los resultados en vivo.',
        actual: 'Voto registrado',
        detalle: `La votación cierra el ${fechaLegible(eleccion?.endsAt)}.`,
      };
    case 'programada':
      return {
        titulo: 'La votación aún no comienza.',
        sub: 'Cuando se abra, podrás revisar a los candidatos y votar desde aquí.',
        actual: 'Votación programada',
        detalle: `Inicia el ${fechaLegible(eleccion?.startsAt)} y cierra el ${fechaLegible(eleccion?.endsAt)}.`,
      };
    case 'finalizada':
      return {
        titulo: 'La elección de esta sección ya finalizó.',
        sub: 'Consulta el resultado de la elección del delegado.',
        actual: 'Elección finalizada',
        detalle: '',
      };
    case 'no-habilitado':
      return {
        titulo: 'No estás habilitado para votar en esta elección.',
        sub: 'No figuras en el padrón de la elección. Si crees que es un error, consúltalo con tu docente.',
        actual: 'Sin habilitación para votar',
        detalle: '',
      };
    default:
      return {
        titulo: 'Todavía no hay una elección para esta sección.',
        sub: 'Cuando tu docente la programe, aparecerá aquí.',
        actual: 'Sin elección',
        detalle: '',
      };
  }
}

export default function CursoPage() {
  const { id } = useParams();
  const { esEstudiante } = useAuth();
  const [curso, setCurso] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let activo = true;
    setCurso(null);
    setError('');
    cargarCurso(id, esEstudiante)
      .then((datos) => { if (activo) setCurso(datos); })
      .catch((err) => {
        if (!activo) return;
        const noDisponible = err.status === 403 || err.status === 404 || err.status === 400;
        setError(noDisponible ? 'No encontramos este curso o no perteneces a él.' : err.message);
      });
    return () => { activo = false; };
  }, [id, esEstudiante]);

  const volver = (
    <Link to="/cursos" className="cu-volver">
      <ArrowLeft size={18} /> Volver a mis cursos
    </Link>
  );

  if (error) {
    return (
      <div className="cursos-pagina">
        {volver}
        <div className="aviso aviso-error" role="alert">{error}</div>
      </div>
    );
  }
  if (curso === null) {
    return (
      <div className="cursos-pagina">
        {volver}
        <p className="cargando-texto">Cargando el curso…</p>
      </div>
    );
  }

  const { seccion, docente, eleccion, estado } = curso;
  const info = ESTADOS[estado];
  const puedeVotar = esEstudiante && estado === 'abierta';
  const textos = textosDelEstado(estado, eleccion, puedeVotar);
  const verResultados = estado === 'participaste' || estado === 'finalizada' || (estado === 'abierta' && !esEstudiante);

  return (
    <div className="cursos-pagina">
      {volver}

      <header className="cu-cabecera">
        <div className={`curso-avatar tono-${info.tono}`}>
          {iniciales(seccion.courseName, seccion.courseCode)}
        </div>
        <div className="cu-cabecera-info">
          <h1>{seccion.courseName}</h1>
          <div className="cu-meta">
            <span>Sección: {seccion.code}</span>
            <span className="sep">·</span>
            <span className="docente"><User size={16} /> Docente: {docente}</span>
          </div>
        </div>
        <span className={`pildora tono-${info.tono}`}>
          {estado === 'abierta' && <span className="punto"></span>}
          {info.etiqueta}
        </span>
      </header>

      <div className="cu-rejilla">
        <section className="cu-tarjeta">
          <div className="cu-tarjeta-titulo">
            <span className="cu-icono"><Vote size={22} /></span>
            <h2>Elección del delegado</h2>
          </div>

          <p className="cu-lead">{textos.titulo}</p>
          <p className="cu-sublead">{textos.sub}</p>

          {puedeVotar && (
            <div className="cu-pasos" aria-label="Pasos de la votación">
              {PASOS.map((paso, i) => (
                <div key={paso} style={{ display: 'contents' }}>
                  <div className={`cu-paso${i === 0 ? ' activo' : ''}`}>
                    <span className="cu-paso-num">{i + 1}</span>
                    {paso}
                  </div>
                  {i < PASOS.length - 1 && (
                    <>
                      <span className="cu-paso-linea"></span>
                      <ChevronRight size={16} color="#9AA3B5" style={{ marginTop: 13 }} />
                      <span className="cu-paso-linea"></span>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="cu-estado" style={{ marginTop: puedeVotar ? 0 : '1.4rem' }}>
            <Clock size={18} />
            <div>
              Estado actual: <strong>{textos.actual}</strong>
              {textos.detalle && <small>{textos.detalle}</small>}
            </div>
          </div>

          {puedeVotar && (
            <>
              <div className="cu-alerta">
                <Info size={18} />
                Puedes emitir un único voto. Una vez confirmado, no podrás modificarlo.
              </div>
              <Link to={`/cursos/${seccion.id}/votar`} className="boton boton-rojo boton-ancho">
                Comenzar votación <ArrowRight size={20} />
              </Link>
            </>
          )}

          {estado === 'participaste' && (
            <div className="cu-exito">Tu voto fue registrado y no puede modificarse.</div>
          )}

          {verResultados && (
            <Link to={`/cursos/${seccion.id}/resultados`} className="boton boton-rojo boton-ancho">
              {estado === 'finalizada' ? 'Ver resultados' : 'Ver resultados en vivo'} <ArrowRight size={20} />
            </Link>
          )}
        </section>

        <TarjetaEvaluacion seccionId={seccion.id} estado={estado} />
      </div>
    </div>
  );
}
