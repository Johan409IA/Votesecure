import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Clock, Info, Star } from 'lucide-react';
import Avatar from '../components/Avatar';
import { useAuth } from '../hooks/useAuth';
import { evaluarDelegado, verDelegado } from '../services/evaluacion.service';
import { fechaLegible } from '../utils/cursos';
import { marcarEvaluado, yaEvaluo } from '../utils/evaluacion';
import '../components/Evaluacion.css';

const NOTAS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const LIMITES = {
  estudiante: { min: 0, max: 500 },
  docente: { min: 20, max: 1000 },
};

// Evaluar al delegado de la sección (estudiante o docente) o, si eres el delegado, ver tus promedios.
// Ruta: /cursos/:id/evaluar   (id = sección)
export default function EvaluarDelegadoPage() {
  const { id } = useParams();
  const { usuario } = useAuth();
  const seccionId = Number(id);

  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');
  const [nota, setNota] = useState(0);
  const [comentario, setComentario] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [errorEnvio, setErrorEnvio] = useState('');
  const [enviada, setEnviada] = useState(false);

  useEffect(() => {
    let activo = true;
    verDelegado(seccionId)
      .then((d) => {
        if (!activo) return;
        setDatos(d);
        if (d.periodoAbierto && yaEvaluo(usuario.id, d.periodoAbierto.id)) setEnviada(true);
      })
      .catch((err) => {
        if (!activo) return;
        setError(
          err.status === 404 ? 'Todavía no hay un delegado proclamado en esta sección.'
            : err.status === 403 ? 'No perteneces a esta sección.'
            : err.message,
        );
      });
    return () => { activo = false; };
  }, [seccionId, usuario.id]);

  const volver = <Link to={`/cursos/${id}`} className="ev-volver"><ArrowLeft size={18} /> Volver al curso</Link>;

  if (error) return <div className="ev-pagina">{volver}<div className="ev-aviso ev-aviso-error" role="alert">{error}</div></div>;
  if (!datos) return <div className="ev-pagina">{volver}<p className="ev-nota">Cargando…</p></div>;

  const { delegacion, periodoAbierto, promediosPorPeriodo, promedioGlobal } = datos;
  const esDelegado = usuario.id === delegacion.delegateStudentId;
  const limites = LIMITES[usuario.tipo];

  const cabecera = (
    <div className="ev-tarjeta ev-delegado-grande">
      <Avatar nombre={delegacion.delegateName} tamano={72} />
      <div>
        <small>Delegado/a de la sección</small>
        <h2>{delegacion.delegateName}</h2>
      </div>
    </div>
  );

  // ── El propio delegado: solo ve promedios, nunca quién evaluó ──
  if (esDelegado) {
    const periodos = promediosPorPeriodo ?? [];
    return (
      <div className="ev-pagina">
        {volver}
        <h1>Mi evaluación como delegado</h1>
        <p className="ev-sub">Estos son tus promedios. Nunca verás quién te evaluó.</p>
        {cabecera}
        <section className="ev-tarjeta">
          <h3>Promedio por periodo</h3>
          {periodos.length === 0 ? (
            <p className="ev-nota">Todavía no hay promedios. Se publican cuando cierra cada periodo de evaluación.</p>
          ) : (
            <ul className="ev-promedios">
              {periodos.map((p, i) => (
                <li key={p.periodoId}>
                  <span>Periodo {i + 1} · cerró el {fechaLegible(p.cierraEn)}</span>
                  <span className="ev-barra"><i style={{ width: `${((p.promedio ?? 0) / 10) * 100}%` }} /></span>
                  <b>{p.promedio === null ? '—' : Number(p.promedio).toFixed(1)}</b>
                </li>
              ))}
            </ul>
          )}
          {promedioGlobal !== undefined && promedioGlobal !== null && (
            <p className="ev-global"><Star size={18} /> Promedio global: <b>{Number(promedioGlobal).toFixed(1)}</b> / 10</p>
          )}
        </section>
      </div>
    );
  }

  // ── Administrador: no evalúa ──
  if (!limites) {
    return (
      <div className="ev-pagina">
        {volver}
        <h1>Evaluación del delegado</h1>
        {cabecera}
        <div className="ev-aviso"><Info size={18} /> El administrador no evalúa delegados.</div>
      </div>
    );
  }

  // ── Evaluador (estudiante o docente) ──
  const obligatorio = limites.min > 0;
  const comentarioValido = comentario.trim().length >= limites.min && comentario.trim().length <= limites.max;
  const puedeEnviar = nota > 0 && comentarioValido && !enviando;

  const enviar = async (e) => {
    e.preventDefault();
    if (!puedeEnviar) return;
    setEnviando(true);
    setErrorEnvio('');
    try {
      await evaluarDelegado({
        seccionId, calificacion: nota, comentario: comentario.trim(), periodoId: periodoAbierto.id,
      });
      marcarEvaluado(usuario.id, periodoAbierto.id);
      setEnviada(true);
    } catch (err) {
      if (err.status === 409) {
        marcarEvaluado(usuario.id, periodoAbierto.id);
        setEnviada(true);
      } else {
        setErrorEnvio(err.message);
        setEnviando(false);
      }
    }
  };

  if (!periodoAbierto) {
    return (
      <div className="ev-pagina">
        {volver}
        <h1>Evaluar al delegado</h1>
        {cabecera}
        <div className="ev-aviso"><Clock size={18} /> No hay un periodo de evaluación abierto. Tu docente lo abrirá durante el ciclo.</div>
      </div>
    );
  }

  if (enviada) {
    return (
      <div className="ev-pagina">
        {volver}
        <div className="ev-tarjeta ev-exito">
          <span className="ev-exito-icono"><CheckCircle2 size={44} /></span>
          <h2>Evaluación enviada</h2>
          <p>Tu evaluación de este periodo quedó registrada y no se puede modificar.</p>
          <p className="ev-nota">El delegado solo verá promedios, nunca quién evaluó.</p>
          <Link to={`/cursos/${id}`} className="ev-boton ev-boton-rojo">Volver al curso</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="ev-pagina">
      {volver}
      <h1>Evaluar al delegado</h1>
      <p className="ev-sub">Cierra el {fechaLegible(periodoAbierto.closesAt)}</p>
      {cabecera}

      <form className="ev-tarjeta" onSubmit={enviar} noValidate>
        {periodoAbierto.instructions && (
          <div className="ev-instrucciones">
            <b><Info size={16} /> Indicaciones</b>
            <p>{periodoAbierto.instructions}</p>
          </div>
        )}

        <fieldset className="ev-campo">
          <legend>Calificación (de 1 a 10)</legend>
          <div className="ev-notas" role="radiogroup" aria-label="Calificación">
            {NOTAS.map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={nota === n}
                className={`ev-nota-btn${nota === n ? ' activa' : ''}`}
                onClick={() => setNota(n)}
              >
                {n}
              </button>
            ))}
          </div>
          <div className="ev-escala"><span>1 · Muy deficiente</span><span>10 · Excelente</span></div>
        </fieldset>

        <label className="ev-campo">
          <span className="ev-etiqueta">Comentario {obligatorio ? `(obligatorio, ${limites.min} a ${limites.max} caracteres)` : '(opcional)'}</span>
          <textarea
            rows={5}
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            maxLength={limites.max}
            placeholder="¿Qué hace bien el delegado? ¿Qué podría mejorar?"
          />
          <span className="ev-contador">{comentario.trim().length} / {limites.max}</span>
        </label>

        {errorEnvio && <div className="ev-aviso ev-aviso-error" role="alert">{errorEnvio}</div>}
        <p className="ev-nota">Solo puedes evaluar una vez por periodo y no podrás modificarla después.</p>

        <div className="ev-acciones">
          <Link to={`/cursos/${id}`} className="ev-boton ev-boton-claro">Cancelar</Link>
          <button type="submit" className="ev-boton ev-boton-rojo" disabled={!puedeEnviar}>
            {enviando ? 'Enviando…' : 'Enviar evaluación'}
          </button>
        </div>
      </form>
    </div>
  );
}
