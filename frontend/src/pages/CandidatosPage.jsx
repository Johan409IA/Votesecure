import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Info, TriangleAlert, User } from 'lucide-react';
import Avatar from '../components/Avatar';
import CandidatoCard from '../components/CandidatoCard';
import FlujoVoto from '../components/FlujoVoto';
import { useAuth } from '../hooks/useAuth';
import api from '../services/api';
import { cargarCurso } from '../services/curso.service';
import { iniciales } from '../utils/cursos';
import './CandidatosPage.css';

// Paso 2 de 3 de la votación: elegir candidato.  Ruta: /cursos/:id/votar  (id = sección)
// Los pasos 1 (curso) y 3 (confirmar / voto registrado) viven en CursoPage y FlujoVoto.
export default function CandidatosPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { esEstudiante } = useAuth();

  const [datos, setDatos] = useState(null); // { curso, candidaturas }
  const [error, setError] = useState('');
  const [seleccion, setSeleccion] = useState(null);
  const [confirmando, setConfirmando] = useState(false);

  useEffect(() => {
    if (!esEstudiante) return undefined;
    let activo = true;
    (async () => {
      try {
        const curso = await cargarCurso(id, true);
        if (!activo) return;
        // Quien ya votó o la elección ya cerró no tienen nada que hacer aquí.
        if (curso.estado === 'participaste' || curso.estado === 'finalizada') {
          navigate(`/cursos/${id}/resultados`, { replace: true });
          return;
        }
        if (curso.estado !== 'abierta') {
          setError(
            curso.estado === 'no-habilitado'
              ? 'No estás habilitado para votar en esta elección.'
              : 'Esta elección no está abierta para votar.',
          );
          return;
        }
        const detalle = await api.get(`/elecciones/${curso.eleccion.id}`);
        if (!activo) return;
        setDatos({ curso, candidaturas: detalle.candidacies });
      } catch (err) {
        if (!activo) return;
        const noDisponible = err.status === 403 || err.status === 404 || err.status === 400;
        setError(noDisponible ? 'No encontramos este curso o no perteneces a él.' : err.message);
      }
    })();
    return () => { activo = false; };
  }, [id, esEstudiante, navigate]);

  // Solo los estudiantes votan.
  if (!esEstudiante) return <Navigate to={`/cursos/${id}`} replace />;

  const volver = (
    <Link to={`/cursos/${id}`} className="ca-volver"><ArrowLeft size={18} /> Volver al curso</Link>
  );

  if (error) {
    return (
      <div className="ca-pagina">
        {volver}
        <div className="ca-error" role="alert">{error}</div>
      </div>
    );
  }
  if (!datos) {
    return (
      <div className="ca-pagina">
        {volver}
        <p className="ca-cargando">Cargando candidatos…</p>
      </div>
    );
  }

  const { curso, candidaturas } = datos;
  const { seccion, docente, eleccion } = curso;

  return (
    <div className="ca-pagina">
      {volver}

      <header className="ca-cabecera">
        <span className="ca-curso-avatar">{iniciales(seccion.courseName, seccion.courseCode)}</span>
        <div className="ca-cabecera-info">
          <h2>{seccion.courseName}</h2>
          <p>
            <span>Sección: {seccion.code}</span>
            <span className="ca-sep">·</span>
            <span><User size={15} /> Docente: {docente}</span>
          </p>
        </div>
        <span className="ca-pildora"><span className="ca-punto" /> Votación abierta</span>
      </header>

      <p className="ca-paso"><b>Paso 2 de 3</b> · Selecciona un candidato</p>
      <h1>Candidatos</h1>
      <p className="ca-sub">Selecciona a quien deseas elegir como delegado.</p>
      <p className="ca-info"><Info size={16} /> Podrás revisar tu selección antes de confirmar el voto.</p>

      {candidaturas.length === 0 ? (
        <div className="ca-error">Esta elección todavía no tiene candidatos.</div>
      ) : (
        <div className="ca-rejilla">
          {candidaturas.map((c) => (
            <CandidatoCard
              key={c.id}
              candidatura={c}
              seleccionado={seleccion?.id === c.id}
              onSelect={setSeleccion}
            />
          ))}
        </div>
      )}

      <section className="ca-barra" aria-live="polite">
        {seleccion ? (
          <>
            <Avatar nombre={seleccion.studentName} fotoUrl={seleccion.studentPhotoUrl} tamano={52} />
            <div className="ca-barra-sel">
              <small>Tu selección</small>
              <strong>{seleccion.studentName}</strong>
              <span>Podrás revisar tu elección antes de confirmar.</span>
            </div>
          </>
        ) : (
          <div className="ca-barra-sel">
            <small>Tu selección</small>
            <strong>Aún no elegiste a nadie</strong>
            <span>Toca una tarjeta para seleccionar a un candidato.</span>
          </div>
        )}
        <span className="ca-barra-aviso">
          <TriangleAlert size={20} /> Una vez confirmado, no podrás cambiar tu voto.
        </span>
        <button type="button" className="ca-continuar" disabled={!seleccion} onClick={() => setConfirmando(true)}>
          Continuar <ArrowRight size={20} />
        </button>
      </section>

      {confirmando && seleccion && (
        <FlujoVoto
          eleccion={eleccion}
          seccion={seccion}
          candidatura={seleccion}
          alCancelar={() => setConfirmando(false)}
        />
      )}
    </div>
  );
}