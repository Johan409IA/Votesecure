import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, ClipboardList, Info, Lock } from 'lucide-react';
import Avatar from './Avatar';
import { useAuth } from '../hooks/useAuth';
import { verDelegado } from '../services/evaluacion.service';
import { fechaLegible } from '../utils/cursos';
import { yaEvaluo } from '../utils/evaluacion';
import './Evaluacion.css';

// Recuadro "Evaluación del delegado" de la página del curso.
// Sin delegado proclamado se queda bloqueado; con delegado y periodo abierto lleva a /cursos/:id/evaluar.
export default function TarjetaEvaluacion({ seccionId, estado }) {
  const { usuario } = useAuth();
  const [datos, setDatos] = useState(undefined); // undefined = cargando, null = sin delegado

  useEffect(() => {
    let activo = true;
    verDelegado(seccionId)
      .then((d) => { if (activo) setDatos(d); })
      .catch(() => { if (activo) setDatos(null); }); // 404 (sin delegado) o 403
    return () => { activo = false; };
  }, [seccionId]);

  const titulo = (
    <div className="cu-tarjeta-titulo">
      <span className={`cu-icono${datos ? '' : ' gris'}`}><ClipboardList size={22} /></span>
      <h2>Evaluación del delegado</h2>
    </div>
  );

  if (datos === undefined) {
    return <aside className="cu-tarjeta">{titulo}<p className="cu-texto-lateral">Cargando…</p></aside>;
  }

  if (datos === null) {
    return (
      <aside className="cu-tarjeta">
        {titulo}
        <span className="cu-candado"><Lock size={16} /> Disponible después de la elección</span>
        <p className="cu-texto-lateral">
          {estado === 'finalizada'
            ? 'La elección terminó, pero todavía no hay un delegado proclamado. Cuando tu docente lo proclame, podrás evaluarlo aquí.'
            : 'Podrás evaluar al delegado elegido para la sección cuando el proceso haya finalizado.'}
        </p>
        <div className="cu-pie-lateral"><Info size={16} /> Habilitación posterior al proceso</div>
      </aside>
    );
  }

  const { delegacion, periodoAbierto } = datos;
  const esDelegado = usuario.id === delegacion.delegateStudentId;
  const puedeEvaluar = usuario.tipo === 'estudiante' || usuario.tipo === 'docente';
  const evaluado = periodoAbierto ? yaEvaluo(usuario.id, periodoAbierto.id) : false;

  return (
    <aside className="cu-tarjeta">
      {titulo}
      <div className="ev-delegado">
        <Avatar nombre={delegacion.delegateName} tamano={46} />
        <div>
          <small>Delegado/a de la sección</small>
          <b>{delegacion.delegateName}</b>
        </div>
      </div>

      {esDelegado ? (
        <>
          <p className="cu-texto-lateral">Eres el delegado de esta sección. Aquí verás tus promedios cuando cierre cada periodo.</p>
          <Link to={`/cursos/${seccionId}/evaluar`} className="ev-enlace">Ver mis resultados <ArrowRight size={18} /></Link>
        </>
      ) : periodoAbierto && puedeEvaluar ? (
        evaluado ? (
          <p className="ev-hecho"><CheckCircle2 size={18} /> Ya enviaste tu evaluación de este periodo.</p>
        ) : (
          <>
            <p className="cu-texto-lateral">Hay un periodo de evaluación abierto hasta el {fechaLegible(periodoAbierto.closesAt)}</p>
            <Link to={`/cursos/${seccionId}/evaluar`} className="ev-enlace ev-enlace-rojo">Evaluar al delegado <ArrowRight size={18} /></Link>
          </>
        )
      ) : (
        <p className="cu-texto-lateral">
          {periodoAbierto
            ? `Periodo de evaluación abierto hasta el ${fechaLegible(periodoAbierto.closesAt)}`
            : 'No hay un periodo de evaluación abierto. Tu docente lo abrirá durante el ciclo.'}
        </p>
      )}
    </aside>
  );
}
