import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft, BadgeCheck, CheckCircle2, Info, Radio, RefreshCw, Scale, Trophy, User, Users,
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts';
import { useAuth } from '../hooks/useAuth';
import useResultadosEnVivo from '../hooks/useResultadosEnVivo';
import { cargarCurso } from '../services/curso.service';
import ModalProclamar from '../components/ModalProclamar';
import ModalDesempate from '../components/ModalDesempate';
import { iniciales } from '../utils/cursos';
import './Cursos.css';
import './Resultados.css';

const BANNER_PARCIAL =
  'El cómputo en vivo es parcial e informativo. Ningún candidato es proclamado ' +
  'ganador hasta el cierre formal y publicación de actas.';

// Payload en vivo y final comparten la forma de candidaturas.
function candidaturasDe(resultado) {
  return (resultado?.candidaturas ?? []).map((c) => ({
    id: c.candidaturaId,
    nombre: c.nombre,
    votos: c.votos,
  }));
}

function porcentaje(parte, total) {
  if (!total) return 0;
  return Math.round((parte / total) * 100);
}

// ── Resultado definitivo (elección cerrada) ─────────────────────────────────
function ResultadoFinal({ resultado, esGestor, alProclamarAbierto, alDesempateAbierto, proclamado }) {
  const candidaturas = candidaturasDe(resultado);
  const ganador = candidaturas.find((c) => c.id === resultado.ganadorCandidaturaId);
  const maximo = Math.max(0, ...candidaturas.map((c) => c.votos));
  const empatados = candidaturas.filter((c) => c.votos === maximo && maximo > 0);

  if (resultado.situacion === 'ganador' && ganador) {
    return (
      <>
        <section className="rs-ganador">
          <span className="rs-ganador-icono"><Trophy size={30} /></span>
          <div>
            <p className="rs-ganador-etiqueta">Delegado electo</p>
            <p className="rs-ganador-nombre">{ganador.nombre}</p>
            <p className="rs-ganador-dato">
              Participación: {resultado.porcentajeParticipacion}% de los habilitados
            </p>
          </div>
        </section>
        {esGestor && !proclamado && (
          <button type="button" className="boton boton-rojo boton-ancho" onClick={alProclamarAbierto}>
            <BadgeCheck size={20} /> Proclamar delegado
          </button>
        )}
      </>
    );
  }

  if (resultado.situacion === 'empate') {
    return (
      <>
        <section className="rs-tarjeta rs-empate">
          <span className="rs-tarjeta-icono tono-amarillo"><Scale size={26} /></span>
          <div>
            <h2>La elección terminó en empate</h2>
            <p>
              Empataron con {maximo} {maximo === 1 ? 'voto' : 'votos'}:{' '}
              <strong>{empatados.map((c) => c.nombre).join(', ')}</strong>.
            </p>
          </div>
        </section>
        {esGestor && (
          <button type="button" className="boton boton-rojo boton-ancho" onClick={alDesempateAbierto}>
            <Scale size={20} /> Iniciar desempate
          </button>
        )}
      </>
    );
  }

  return (
    <section className="rs-tarjeta rs-sinvotos">
      <span className="rs-tarjeta-icono tono-gris"><Info size={26} /></span>
      <div>
        <h2>La elección terminó sin votos</h2>
        <p>Ningún estudiante habilitado emitió su voto, por lo que no hay delegado electo.</p>
      </div>
    </section>
  );
}

// ── Resultado en vivo (elección activa) ─────────────────────────────────────
function ResultadoEnVivo({ resultado, ultimaActualizacion, conexion, yaVoto }) {
  const candidaturas = candidaturasDe(resultado);
  const ordenadas = [...candidaturas].sort((a, b) => b.votos - a.votos || a.nombre.localeCompare(b.nombre));
  const datos = ordenadas.map((c) => ({ ...c, corto: c.nombre.length > 22 ? `${c.nombre.slice(0, 21)}…` : c.nombre }));
  const sinVotos = (resultado.totalVotos ?? 0) === 0;
  const quorum = porcentaje(resultado.totalParticipantes, resultado.totalHabilitados);

  return (
    <>
      <div className="aviso aviso-info rs-banner" role="note">
        <Info size={18} /> {BANNER_PARCIAL}
      </div>

      {yaVoto && (
        <div className="aviso rs-banner aviso-exito-voto">
          <CheckCircle2 size={18} /> Ya emitiste tu voto. Gracias por participar.
        </div>
      )}

      <div className="rs-cabecera-vivo">
        <span className={`rs-conexion${conexion ? ' activa' : ''}`}>
          <Radio size={15} />
          {conexion === 'sondeo' ? 'En vivo · actualización cada 10 s' : 'En vivo · tiempo real'}
        </span>
        {ultimaActualizacion && (
          <span className="rs-actualizacion">
            <RefreshCw size={14} />
            Última actualización: {ultimaActualizacion.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
        )}
      </div>

      <section className="rs-tarjeta rs-grafico">
        {sinVotos ? (
          <div className="rs-estado-cero">
            <Users size={34} />
            <h2>Aún no hay votos registrados</h2>
            <p>Cuando alguien vote, las barras se actualizarán al instante.</p>
          </div>
        ) : (
          <div className="rs-grafico-lienzo">
            <ResponsiveContainer width="100%" height={Math.max(180, datos.length * 58 + 30)}>
              <BarChart data={datos} layout="vertical" margin={{ top: 4, right: 34, bottom: 4, left: 4 }}>
                <CartesianGrid horizontal={false} stroke="#EDF0F7" />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12, fill: '#5B6578' }} axisLine={false} tickLine={false} />
                <YAxis
                  type="category" dataKey="corto" width={150}
                  tick={{ fontSize: 13, fill: '#0B1B3B' }} axisLine={false} tickLine={false}
                />
                <Tooltip cursor={{ fill: 'rgba(200,16,46,0.05)' }} formatter={(v) => [`${v} ${v === 1 ? 'voto' : 'votos'}`, null]} />
                <Bar dataKey="votos" fill="#C8102E" radius={[0, 8, 8, 0]} barSize={26} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        <ul className="rs-ranking">
          {ordenadas.map((c, i) => (
            <li key={c.id} className="rs-ranking-fila">
              <span className="rs-puesto">{i + 1}.º</span>
              <span className="rs-ranking-nombre">{c.nombre}</span>
              <span className="rs-ranking-votos">
                {c.votos} {c.votos === 1 ? 'voto' : 'votos'} · {porcentaje(c.votos, resultado.totalVotos)}%
              </span>
            </li>
          ))}
        </ul>
      </section>

      <div className="rs-totales">
        <div className="rs-total">
          <strong>{resultado.totalHabilitados}</strong>
          <span>Habilitados para votar</span>
        </div>
        <div className="rs-total">
          <strong>{resultado.totalParticipantes}</strong>
          <span>Participaron</span>
        </div>
        <div className="rs-total">
          <strong>{resultado.totalVotos}</strong>
          <span>Votos registrados</span>
        </div>
        <div className="rs-total">
          <strong>{quorum}%</strong>
          <span>Quórum de participación</span>
        </div>
      </div>
    </>
  );
}

// ── Página ──────────────────────────────────────────────────────────────────
export default function ResultadosPage() {
  const { id } = useParams();
  const { esEstudiante, esDocente, esAdmin } = useAuth();
  const esGestor = esDocente || esAdmin;

  const [curso, setCurso] = useState(null);
  const [errorCurso, setErrorCurso] = useState('');
  const [modal, setModal] = useState(null); // 'proclamar' | 'desempate' | null
  const [proclamado, setProclamado] = useState(false);

  useEffect(() => {
    let activo = true;
    setCurso(null);
    setErrorCurso('');
    setProclamado(false);
    cargarCurso(id, esEstudiante)
      .then((datos) => { if (activo) setCurso(datos); })
      .catch((err) => {
        if (!activo) return;
        const noDisponible = err.status === 403 || err.status === 404 || err.status === 400;
        setErrorCurso(noDisponible ? 'No encontramos este curso o no perteneces a él.' : err.message);
      });
    return () => { activo = false; };
  }, [id, esEstudiante]);

  const eleccion = curso?.eleccion;
  const consultable = eleccion && (eleccion.status === 'activa' || eleccion.status === 'cerrada');
  const { resultado, ultimaActualizacion, conexion, error } = useResultadosEnVivo(
    consultable ? eleccion.id : null
  );

  const volver = (
    <Link to={`/cursos/${id}`} className="cu-volver">
      <ArrowLeft size={18} /> Volver al curso
    </Link>
  );

  if (errorCurso) {
    return (
      <div className="cursos-pagina">
        {volver}
        <div className="aviso aviso-error" role="alert">{errorCurso}</div>
      </div>
    );
  }
  if (curso === null) {
    return (
      <div className="cursos-pagina">
        {volver}
        <p className="cargando-texto">Cargando resultados…</p>
      </div>
    );
  }

  const { seccion, docente } = curso;
  const enVivo = eleccion?.status === 'activa';
  const finalizada = eleccion?.status === 'cerrada';
  const tono = enVivo ? 'rojo' : 'gris';

  let cuerpo;
  if (!eleccion || (!enVivo && !finalizada)) {
    cuerpo = (
      <div className="estado-vacio">
        <Info size={40} />
        <h2>Todavía no hay resultados para esta sección</h2>
        <p>Los resultados aparecen aquí cuando la votación está abierta o ya finalizó.</p>
      </div>
    );
  } else if (error) {
    cuerpo = <div className="aviso aviso-error" role="alert">{error.message}</div>;
  } else if (!resultado) {
    cuerpo = <p className="cargando-texto">Consultando los resultados…</p>;
  } else if (resultado.tipo === 'en_vivo') {
    cuerpo = (
      <ResultadoEnVivo
        resultado={resultado}
        ultimaActualizacion={ultimaActualizacion}
        conexion={conexion}
        yaVoto={resultado.yaVoto === true}
      />
    );
  } else {
    cuerpo = (
      <ResultadoFinal
        resultado={resultado}
        esGestor={esGestor}
        proclamado={proclamado}
        alProclamarAbierto={() => setModal('proclamar')}
        alDesempateAbierto={() => setModal('desempate')}
      />
    );
  }

  return (
    <div className="cursos-pagina">
      {volver}

      <header className="cu-cabecera">
        <div className={`curso-avatar tono-${tono}`}>
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
        <span className={`pildora tono-${tono}`}>
          {enVivo && <span className="punto"></span>}
          {enVivo ? 'Votación abierta' : 'Elección finalizada'}
        </span>
      </header>

      {cuerpo}

      {modal === 'proclamar' && (
        <ModalProclamar
          eleccionId={eleccion.id}
          nombreGanador={
            candidaturasDe(resultado).find((c) => c.id === resultado.ganadorCandidaturaId)?.nombre ?? ''
          }
          alCerrar={() => setModal(null)}
          alProclamar={() => {
            setModal(null);
            setProclamado(true);
          }}
        />
      )}
      {modal === 'desempate' && (
        <ModalDesempate
          seccion={seccion}
          eleccionOrigenId={eleccion.id}
          alCerrar={() => setModal(null)}
          alIniciado={() => setModal(null)}
        />
      )}
    </div>
  );
}
