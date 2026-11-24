import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, BarChart3, BookOpen, Check, ChevronRight, FileText, Inbox,
  LayoutGrid, Lock, MousePointerClick, Plus, User, Vote,
} from 'lucide-react';
import ModalUnirse from '../components/ModalUnirse';
import { useAuth } from '../hooks/useAuth';
import { cargarCursos } from '../services/curso.service';
import { ESTADOS, iniciales } from '../utils/cursos';
import './Cursos.css';

const PASOS = [
  { icono: BookOpen, titulo: 'Selecciona un curso', texto: 'Revisa las elecciones disponibles en tus cursos.' },
  { icono: FileText, titulo: 'Revisa la elección', texto: 'Conoce a los candidatos y sus propuestas.' },
  { icono: MousePointerClick, titulo: 'Emite tu voto', texto: 'Selecciona tu candidato y confirma tu decisión.' },
  { icono: Check, titulo: 'Recibe confirmación', texto: 'Tu voto quedará registrado de forma segura.' },
];

function TarjetaCurso({ curso }) {
  const { seccion, docente, estado } = curso;
  const info = ESTADOS[estado];
  const destino = estado === 'finalizada'
    ? `/cursos/${seccion.id}/resultados`
    : `/cursos/${seccion.id}`;

  return (
    <article className={`mc-tarjeta${info.destacada ? ' destacada' : ''}`}>
      <div className="mc-tarjeta-arriba">
        <div className={`curso-avatar tono-${info.tono}`}>
          {iniciales(seccion.courseName, seccion.courseCode)}
        </div>
        <div className="mc-tarjeta-info">
          <h3>{seccion.courseName}</h3>
          <p>Sección: {seccion.code}</p>
        </div>
        <span className={`pildora tono-${info.tono}`}>
          {estado === 'abierta' && <span className="punto"></span>}
          {estado === 'participaste' && <Check size={14} />}
          {estado === 'finalizada' && <Lock size={13} />}
          {info.etiqueta}
        </span>
      </div>

      <div className="mc-tarjeta-abajo">
        <div className="mc-docente">
          <User size={17} />
          <span>Docente: {docente}</span>
        </div>
        <Link to={destino} className={`boton ${estado === 'abierta' ? 'boton-rojo' : 'boton-gris'}`}>
          {info.boton} <ArrowRight size={17} />
        </Link>
      </div>
    </article>
  );
}

export default function MisCursosPage() {
  const { usuario, esEstudiante, refrescarSesion } = useAuth();
  const verificado = usuario.correoVerificado;

  const [cursos, setCursos] = useState(null);
  const [error, setError] = useState('');
  const [filtro, setFiltro] = useState('todos');
  const [verModal, setVerModal] = useState(false);
  const [recarga, setRecarga] = useState(0);
  const [sigueSinVerificar, setSigueSinVerificar] = useState(false);

  useEffect(() => {
    if (!verificado) return undefined;
    let activo = true;
    setCursos(null);
    setError('');
    cargarCursos(esEstudiante)
      .then((datos) => { if (activo) setCursos(datos); })
      .catch((err) => { if (activo) setError(err.message); });
    return () => { activo = false; };
  }, [verificado, esEstudiante, recarga]);

  const conteo = useMemo(() => {
    const lista = cursos ?? [];
    return {
      todos: lista.length,
      abierta: lista.filter((c) => c.estado === 'abierta').length,
      participaste: lista.filter((c) => c.estado === 'participaste').length,
      finalizada: lista.filter((c) => c.estado === 'finalizada').length,
    };
  }, [cursos]);

  const visibles = useMemo(() => {
    const lista = cursos ?? [];
    if (filtro === 'todos') return lista;
    return lista.filter((c) => c.estado === filtro);
  }, [cursos, filtro]);

  const yaVerifique = async () => {
    try {
      const actualizado = await refrescarSesion();
      setSigueSinVerificar(!actualizado.correoVerificado);
    } catch {
      setSigueSinVerificar(true);
    }
  };

  const alUnirse = () => {
    setVerModal(false);
    setFiltro('todos');
    setRecarga((n) => n + 1);
  };

  const FILTROS = [
    { clave: 'todos', etiqueta: 'Todos', icono: <LayoutGrid size={17} /> },
    { clave: 'abierta', etiqueta: 'Abiertas', icono: <span className="punto-rojo"></span> },
    { clave: 'participaste', etiqueta: 'Ya participaste', icono: <Check size={17} className="verde" /> },
    { clave: 'finalizada', etiqueta: 'Finalizadas', icono: <Lock size={16} /> },
  ];

  let contenido;
  if (!verificado) {
    contenido = (
      <div className="estado-vacio">
        <Inbox size={40} />
        <h2>Verifica tu correo para ver tus cursos</h2>
        <p>Te enviamos un enlace de verificación a {usuario.correo}. Ábrelo y luego vuelve aquí.</p>
        {sigueSinVerificar && (
          <div className="aviso aviso-info">Todavía no vemos tu correo como verificado.</div>
        )}
        <button type="button" className="boton boton-rojo" onClick={yaVerifique}>
          Ya verifiqué mi correo
        </button>
      </div>
    );
  } else if (error) {
    contenido = <div className="aviso aviso-error" role="alert">{error}</div>;
  } else if (cursos === null) {
    contenido = <p className="cargando-texto">Cargando tus cursos…</p>;
  } else if (cursos.length === 0) {
    contenido = (
      <div className="estado-vacio">
        <Inbox size={40} />
        <h2>Aún no tienes cursos</h2>
        {esEstudiante ? (
          <>
            <p>Únete a tu sección con el código que te dio tu docente.</p>
            <button type="button" className="boton boton-rojo" onClick={() => setVerModal(true)}>
              <Plus size={18} /> Unirse con código
            </button>
          </>
        ) : (
          <p>Todavía no tienes secciones asignadas.</p>
        )}
      </div>
    );
  } else {
    contenido = (
      <>
        <div className="mc-filtros" role="tablist" aria-label="Filtrar cursos">
          {FILTROS.map((f) => (
            <button
              key={f.clave}
              type="button"
              role="tab"
              aria-selected={filtro === f.clave}
              className={`mc-filtro${filtro === f.clave ? ' activo' : ''}`}
              onClick={() => setFiltro(f.clave)}
            >
              {f.icono} {f.etiqueta}
              <span className="cuenta">{conteo[f.clave]}</span>
            </button>
          ))}
        </div>

        {visibles.length === 0 ? (
          <div className="estado-vacio"><p>No hay cursos en esta categoría.</p></div>
        ) : (
          <div className="mc-rejilla">
            {visibles.map((curso) => <TarjetaCurso key={curso.seccion.id} curso={curso} />)}
          </div>
        )}

        <section className="mc-como">
          <div className="mc-como-titulo">
            <h2>¿Cómo funciona?</h2>
            <p>Sigue estos pasos para participar en las elecciones de delegado de tus cursos.</p>
          </div>
          <div className="mc-pasos">
            {PASOS.map((paso, i) => {
              const Icono = paso.icono;
              return (
                <div className="mc-paso" key={paso.titulo}>
                  <span className="mc-paso-num">{i + 1}</span>
                  <span className="mc-paso-icono"><Icono size={20} /></span>
                  <div>
                    <strong>{paso.titulo}</strong>
                    <span>{paso.texto}</span>
                  </div>
                  {i < PASOS.length - 1 && <ChevronRight size={18} className="mc-paso-flecha" />}
                </div>
              );
            })}
          </div>
        </section>
      </>
    );
  }

  return (
    <div className="cursos-pagina">
      <div className="mc-cabecera">
        <div className="mc-titulo">
          <h1>Mis cursos</h1>
          <p>Revisa y participa en las elecciones de delegado de tus cursos disponibles.</p>
          {esEstudiante && verificado && cursos && cursos.length > 0 && (
            <button type="button" className="boton boton-claro" onClick={() => setVerModal(true)}>
              <Plus size={18} /> Unirse con código
            </button>
          )}
        </div>

        {verificado && cursos && cursos.length > 0 && (
          <div className="mc-resumen">
            <div className="mc-dato">
              <span className="mc-dato-icono tono-rojo"><Vote size={22} /></span>
              <div>
                <strong>{conteo.abierta}</strong>
                <span>{conteo.abierta === 1 ? 'Votación abierta' : 'Votaciones abiertas'}<br />en tus cursos</span>
              </div>
            </div>
            <div className="mc-dato">
              <span className="mc-dato-icono tono-verde"><Check size={22} /></span>
              <div>
                <strong>{conteo.participaste}</strong>
                <span>Ya participaste<br />en tus cursos</span>
              </div>
            </div>
            <div className="mc-dato">
              <span className="mc-dato-icono tono-gris"><BarChart3 size={22} /></span>
              <div>
                <strong>{conteo.finalizada}</strong>
                <span>{conteo.finalizada === 1 ? 'Elección finalizada' : 'Elecciones finalizadas'}<br />en tus cursos</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {contenido}

      {verModal && <ModalUnirse alCerrar={() => setVerModal(false)} alUnirse={alUnirse} />}
    </div>
  );
}
