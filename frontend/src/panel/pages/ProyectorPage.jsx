import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Info, Maximize, Minimize, Radio, Scale, Trophy } from 'lucide-react';
import Avatar from '../../components/Avatar';
import useResultadosEnVivo from '../../hooks/useResultadosEnVivo';
import { cargarDatosProyector } from '../../services/proyector.panel.service';
import { fechaLegible } from '../../utils/cursos';
import { porcentaje } from '../formato';
import '../panel.css';

const BANNER_PARCIAL =
  'El cómputo en vivo es parcial e informativo. Ningún candidato es proclamado ' +
  'ganador hasta el cierre formal y publicación de actas.';

// Ruta /panel/elecciones/:id/proyector (:id = id de la ELECCIÓN).
// Pantalla completa, sin barra ni menú (ver App.jsx): se proyecta en el salón.
// Usa el hook useResultadosEnVivo que ya existe: Realtime y, si falla, sondeo cada 10 s.
export default function ProyectorPage() {
  const { id } = useParams();
  const [meta, setMeta] = useState(null); // { eleccion, seccion, candidaturas }
  const [errorMeta, setErrorMeta] = useState('');
  const [pantallaCompleta, setPantallaCompleta] = useState(false);

  useEffect(() => {
    let activo = true;
    setMeta(null);
    setErrorMeta('');
    cargarDatosProyector(id)
      .then((datos) => { if (activo) setMeta(datos); })
      .catch((err) => {
        if (!activo) return;
        setErrorMeta([400, 403, 404].includes(err.status) ? 'No encontramos esta elección.' : err.message);
      });
    return () => { activo = false; };
  }, [id]);

  useEffect(() => {
    const alCambiar = () => setPantallaCompleta(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', alCambiar);
    return () => document.removeEventListener('fullscreenchange', alCambiar);
  }, []);

  const alternarPantallaCompleta = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen?.();
    } else {
      document.documentElement.requestFullscreen?.().catch(() => {});
    }
  };

  const estado = meta?.eleccion.status;
  const consultable = estado === 'activa' || estado === 'cerrada';
  const { resultado, ultimaActualizacion, conexion, error } = useResultadosEnVivo(
    consultable ? meta.eleccion.id : null
  );

  const controles = (
    <div className="proy-controles">
      <Link to={`/panel/elecciones/${id}`} className="proy-control">
        <ArrowLeft size={18} /> Salir
      </Link>
      <button type="button" className="proy-control" onClick={alternarPantallaCompleta}>
        {pantallaCompleta ? <Minimize size={18} /> : <Maximize size={18} />}
        {pantallaCompleta ? 'Salir de pantalla completa' : 'Pantalla completa'}
      </button>
    </div>
  );

  if (errorMeta) {
    return (
      <div className="proy">
        {controles}
        <div className="proy-mensaje"><Info size={46} /><h1>{errorMeta}</h1></div>
      </div>
    );
  }
  if (meta === null) {
    return (
      <div className="proy">
        {controles}
        <div className="proy-mensaje"><h1>Cargando…</h1></div>
      </div>
    );
  }

  const { eleccion, seccion, candidaturas } = meta;
  const enVivo = estado === 'activa';
  const fotos = new Map(candidaturas.map((c) => [c.id, c.photoUrl]));

  let cuerpo;
  if (!consultable) {
    const texto = {
      borrador: 'La elección todavía no está programada.',
      programada: `La votación comienza el ${fechaLegible(eleccion.startsAt)}.`,
      cancelada: 'La elección fue cancelada.',
    }[estado] ?? 'La elección no está disponible.';
    cuerpo = <div className="proy-mensaje"><Info size={46} /><h1>{texto}</h1></div>;
  } else if (error) {
    cuerpo = <div className="proy-mensaje"><Info size={46} /><h1>{error.message}</h1></div>;
  } else if (!resultado) {
    cuerpo = <div className="proy-mensaje"><h1>Consultando los resultados…</h1></div>;
  } else {
    const filas = (resultado.candidaturas ?? [])
      .map((c) => ({ id: c.candidaturaId, nombre: c.nombre, votos: c.votos }))
      .sort((a, b) => b.votos - a.votos || a.nombre.localeCompare(b.nombre));
    const totalVotos = resultado.totalVotos ?? filas.reduce((suma, c) => suma + c.votos, 0);
    const ganador = filas.find((c) => c.id === resultado.ganadorCandidaturaId);

    cuerpo = (
      <>
        {resultado.tipo === 'final' && resultado.situacion === 'ganador' && ganador && (
          <section className="proy-ganador">
            <Trophy size={54} />
            <div>
              <p>Delegado electo</p>
              <h2>{ganador.nombre}</h2>
            </div>
          </section>
        )}
        {resultado.tipo === 'final' && resultado.situacion === 'empate' && (
          <section className="proy-ganador empate">
            <Scale size={54} />
            <div>
              <p>Resultado</p>
              <h2>La elección terminó en empate</h2>
            </div>
          </section>
        )}

        {totalVotos === 0 ? (
          <div className="proy-mensaje">
            <h1>{resultado.tipo === 'final' ? 'La elección terminó sin votos' : 'Aún no hay votos registrados'}</h1>
            {resultado.tipo !== 'final' && <p>Las barras se actualizarán cuando alguien vote.</p>}
          </div>
        ) : (
          <ol className="proy-filas">
            {filas.map((c, i) => {
              const pct = porcentaje(c.votos, totalVotos);
              return (
                <li key={c.id} className={`proy-fila${i === 0 ? ' lider' : ''}`}>
                  <span className="proy-puesto">{i + 1}</span>
                  <Avatar nombre={c.nombre} fotoUrl={fotos.get(c.id)} tamano={76} />
                  <div className="proy-fila-cuerpo">
                    <div className="proy-fila-linea">
                      <span className="proy-nombre">{c.nombre}</span>
                      <span className="proy-votos">
                        {c.votos} {c.votos === 1 ? 'voto' : 'votos'} · <b>{pct}%</b>
                      </span>
                    </div>
                    <div className="proy-barra"><div className="proy-barra-relleno" style={{ width: `${pct}%` }} /></div>
                  </div>
                </li>
              );
            })}
          </ol>
        )}

        <div className="proy-totales">
          {resultado.tipo === 'en_vivo' ? (
            <>
              <div><strong>{resultado.totalHabilitados}</strong><span>Habilitados</span></div>
              <div><strong>{resultado.totalParticipantes}</strong><span>Participaron</span></div>
              <div><strong>{resultado.totalVotos}</strong><span>Votos registrados</span></div>
              <div><strong>{porcentaje(resultado.totalParticipantes, resultado.totalHabilitados)}%</strong><span>Participación</span></div>
            </>
          ) : (
            <>
              <div><strong>{totalVotos}</strong><span>Votos registrados</span></div>
              <div><strong>{resultado.porcentajeParticipacion}%</strong><span>Participación</span></div>
            </>
          )}
        </div>

        {resultado.tipo === 'en_vivo' && <p className="proy-nota">{BANNER_PARCIAL}</p>}
      </>
    );
  }

  return (
    <div className="proy">
      {controles}
      <header className="proy-cabecera">
        <div>
          <p className="proy-curso">{seccion.courseName} · Sección {seccion.code}</p>
          <h1>{eleccion.name}</h1>
        </div>
        <div className="proy-estado-caja">
          <span className={`proy-estado${enVivo ? ' en-vivo' : ''}`}>
            {enVivo ? <><Radio size={20} /> En vivo</> : estado === 'cerrada' ? 'Resultado final' : 'Sin votación'}
          </span>
          {enVivo && ultimaActualizacion && (
            <span className="proy-actualizacion">
              {conexion === 'sondeo' ? 'Actualiza cada 10 s · ' : ''}
              {ultimaActualizacion.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          )}
        </div>
      </header>
      {cuerpo}
    </div>
  );
}
