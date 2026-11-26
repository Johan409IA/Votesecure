import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft, GraduationCap, History, Lock, LockOpen, ScrollText, Search, UserPlus, Users,
} from 'lucide-react';
import {
  asignarDocente, buscarUsuarios, cambiarAsignacion, cambiarInscripciones, cambiarMatricula,
  listarAsignaciones, listarElecciones, listarMatriculas, matricularEstudiante, obtenerSeccion,
} from '../../services/admin.service';
import { ESTADO_ELECCION } from '../../utils/admin';
import { fechaLegible, iniciales, inicialesDeUsuario } from '../../utils/cursos';
import '../Cursos.css';
import './Admin.css';

export default function AdminCursoPage() {
  const { id } = useParams();
  const [seccion, setSeccion] = useState(null);
  const [asignaciones, setAsignaciones] = useState([]);
  const [matriculas, setMatriculas] = useState([]);
  const [elecciones, setElecciones] = useState([]);
  const [docentes, setDocentes] = useState([]);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState(null); // { tipo: 'ok' | 'error', texto }
  const [ocupado, setOcupado] = useState(false);

  const [docenteElegido, setDocenteElegido] = useState('');
  const [termino, setTermino] = useState('');
  const [resultados, setResultados] = useState([]);
  const [buscando, setBuscando] = useState(false);
  const [filtroMatriculas, setFiltroMatriculas] = useState('');

  // Carga inicial: la sección y todo lo que cuelga de ella.
  useEffect(() => {
    let activo = true;
    setSeccion(null);
    setError('');
    setAviso(null);
    Promise.all([
      obtenerSeccion(id),
      listarAsignaciones(id),
      listarMatriculas(id),
      listarElecciones(id).catch(() => []),
      buscarUsuarios({ tipo: 'docente' }).catch(() => []),
    ])
      .then(([s, a, m, e, d]) => {
        if (!activo) return;
        if (!s) {
          setError('No encontramos esta sección.');
          return;
        }
        setSeccion(s);
        setAsignaciones(a);
        setMatriculas(m);
        setElecciones(e);
        setDocentes(d);
      })
      .catch((err) => {
        if (!activo) return;
        setError([400, 403, 404].includes(err.status) ? 'No encontramos esta sección.' : err.message);
      });
    return () => { activo = false; };
  }, [id]);

  // Búsqueda de estudiantes para matricular (espera 300 ms después de escribir).
  useEffect(() => {
    const texto = termino.trim();
    if (texto.length < 2) {
      setResultados([]);
      return undefined;
    }
    let activo = true;
    const espera = setTimeout(() => {
      setBuscando(true);
      buscarUsuarios({ busqueda: texto, tipo: 'estudiante' })
        .then((lista) => { if (activo) setResultados(lista); })
        .catch(() => { if (activo) setResultados([]); })
        .finally(() => { if (activo) setBuscando(false); });
    }, 300);
    return () => { activo = false; clearTimeout(espera); };
  }, [termino]);

  // Ejecuta una acción y muestra el resultado arriba de las tarjetas.
  const ejecutar = async (accion, textoOk) => {
    setOcupado(true);
    setAviso(null);
    try {
      await accion();
      if (textoOk) setAviso({ tipo: 'ok', texto: textoOk });
    } catch (err) {
      setAviso({ tipo: 'error', texto: err.message });
    } finally {
      setOcupado(false);
    }
  };

  const alternarInscripciones = () =>
    ejecutar(async () => {
      await cambiarInscripciones(seccion.id, !seccion.active);
      setSeccion(await obtenerSeccion(seccion.id));
    }, seccion.active ? 'Inscripciones bloqueadas.' : 'Inscripciones abiertas.');

  const asignar = () =>
    ejecutar(async () => {
      await asignarDocente(seccion.id, Number(docenteElegido));
      setAsignaciones(await listarAsignaciones(seccion.id));
      setDocenteElegido('');
    }, 'Docente asignado.');

  const alternarAsignacion = (asignacion) =>
    ejecutar(async () => {
      await cambiarAsignacion(asignacion.id, !asignacion.active);
      setAsignaciones(await listarAsignaciones(seccion.id));
    }, asignacion.active ? 'Docente desactivado.' : 'Docente activado.');

  const matricular = (usuario) =>
    ejecutar(async () => {
      await matricularEstudiante(seccion.id, usuario.id);
      setMatriculas(await listarMatriculas(seccion.id));
      setTermino('');
    }, `${usuario.nombre} quedó matriculado.`);

  const alternarMatricula = (matricula) =>
    ejecutar(async () => {
      await cambiarMatricula(matricula.id, !matricula.active);
      setMatriculas(await listarMatriculas(seccion.id));
    }, matricula.active ? 'Matrícula desactivada.' : 'Matrícula activada.');

  const docentesDisponibles = useMemo(() => {
    const yaAsignados = new Set(asignaciones.map((a) => a.teacherId));
    return docentes.filter((d) => d.activa && !yaAsignados.has(d.id));
  }, [docentes, asignaciones]);

  const matriculasOrdenadas = useMemo(() => {
    const texto = filtroMatriculas.trim().toLowerCase();
    return [...matriculas]
      .filter((m) => !texto || `${m.studentName} ${m.studentEmail}`.toLowerCase().includes(texto))
      .sort((a, b) => a.studentName.localeCompare(b.studentName, 'es'));
  }, [matriculas, filtroMatriculas]);

  const candidatos = useMemo(() => {
    const yaMatriculados = new Set(matriculas.map((m) => m.studentId));
    return resultados.filter((u) => u.activa && !yaMatriculados.has(u.id)).slice(0, 6);
  }, [resultados, matriculas]);

  const volver = (
    <Link to="/admin/cursos" className="cu-volver">
      <ArrowLeft size={18} /> Volver a cursos
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
  if (seccion === null) {
    return (
      <div className="cursos-pagina">
        {volver}
        <p className="cargando-texto">Cargando la sección…</p>
      </div>
    );
  }

  const matriculasActivas = matriculas.filter((m) => m.active).length;

  return (
    <div className="cursos-pagina">
      {volver}

      <header className="cu-cabecera">
        <div className={`curso-avatar ${seccion.active ? 'tono-rojo' : 'tono-gris'}`}>
          {iniciales(seccion.courseName, seccion.courseCode)}
        </div>
        <div className="cu-cabecera-info">
          <h1>{seccion.courseName}</h1>
          <div className="cu-meta">
            <span>Curso: {seccion.courseCode}</span>
            <span className="sep">·</span>
            <span>Periodo: {seccion.academicPeriod}</span>
            <span className="sep">·</span>
            <span>Sección: <span className="ad-codigo">{seccion.code}</span></span>
          </div>
        </div>
        <div className="ad-cabecera-acciones">
          <span className={`pildora ${seccion.active ? 'tono-verde' : 'tono-gris'}`}>
            {seccion.active ? <LockOpen size={13} /> : <Lock size={13} />}
            {seccion.active ? 'Inscripciones abiertas' : 'Inscripciones bloqueadas'}
          </span>
          <button
            type="button"
            className={`boton boton-chico ${seccion.active ? 'boton-peligro' : 'boton-claro'}`}
            onClick={alternarInscripciones}
            disabled={ocupado}
          >
            {seccion.active ? 'Bloquear inscripciones' : 'Abrir inscripciones'}
          </button>
        </div>
      </header>

      {aviso && (
        <div className={`aviso aviso-${aviso.tipo} ad-aviso-accion`} role={aviso.tipo === 'error' ? 'alert' : 'status'}>
          {aviso.texto}
        </div>
      )}

      <div className="cu-rejilla dos-columnas">
        {/* ── Docentes ─────────────────────────────────── */}
        <section className="cu-tarjeta">
          <div className="cu-tarjeta-titulo">
            <span className="cu-icono"><GraduationCap size={22} /></span>
            <h2>Docentes asignados</h2>
          </div>

          {asignaciones.length === 0 ? (
            <p className="ad-vacio">Esta sección todavía no tiene docente.</p>
          ) : (
            <ul className="ad-lista">
              {asignaciones.map((a) => (
                <li key={a.id} className={`ad-fila${a.active ? '' : ' inactiva'}`}>
                  <span className="ad-persona-avatar">{inicialesDeUsuario(a.teacherName)}</span>
                  <div className="ad-persona">
                    <strong>{a.teacherName}</strong>
                    <span>{a.teacherEmail}</span>
                  </div>
                  <span className={`pildora ${a.active ? 'tono-verde' : 'tono-gris'}`}>
                    {a.active ? 'Activo' : 'Inactivo'}
                  </span>
                  <button
                    type="button"
                    className="boton boton-claro boton-chico"
                    onClick={() => alternarAsignacion(a)}
                    disabled={ocupado}
                  >
                    {a.active ? 'Desactivar' : 'Activar'}
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="ad-agregar">
            <select
              className="ad-select"
              value={docenteElegido}
              onChange={(e) => setDocenteElegido(e.target.value)}
              aria-label="Docente a asignar"
            >
              <option value="">Selecciona un docente…</option>
              {docentesDisponibles.map((d) => (
                <option key={d.id} value={d.id}>{d.nombre} — {d.correo}</option>
              ))}
            </select>
            <button
              type="button"
              className="boton boton-rojo"
              onClick={asignar}
              disabled={ocupado || !docenteElegido}
            >
              <UserPlus size={17} /> Asignar
            </button>
          </div>
          {docentesDisponibles.length === 0 && (
            <p className="ad-nota">No hay más docentes activos para asignar.</p>
          )}
        </section>

        {/* ── Estudiantes ──────────────────────────────── */}
        <section className="cu-tarjeta">
          <div className="cu-tarjeta-titulo">
            <span className="cu-icono"><Users size={22} /></span>
            <h2>Estudiantes matriculados</h2>
            <span className="ad-contador">{matriculasActivas} activos de {matriculas.length}</span>
          </div>

          {matriculas.length > 6 && (
            <div className="ad-busqueda" style={{ maxWidth: 'none', marginBottom: '0.6rem' }}>
              <Search size={18} />
              <input
                type="search"
                placeholder="Filtrar la lista"
                value={filtroMatriculas}
                onChange={(e) => setFiltroMatriculas(e.target.value)}
                aria-label="Filtrar estudiantes matriculados"
              />
            </div>
          )}

          {matriculas.length === 0 ? (
            <p className="ad-vacio">Todavía no hay estudiantes en esta sección.</p>
          ) : matriculasOrdenadas.length === 0 ? (
            <p className="ad-vacio">Ningún estudiante coincide con el filtro.</p>
          ) : (
            <ul className="ad-lista con-scroll">
              {matriculasOrdenadas.map((m) => (
                <li key={m.id} className={`ad-fila${m.active ? '' : ' inactiva'}`}>
                  <span className="ad-persona-avatar">{inicialesDeUsuario(m.studentName)}</span>
                  <div className="ad-persona">
                    <strong>{m.studentName}</strong>
                    <span>{m.studentEmail}</span>
                  </div>
                  <button
                    type="button"
                    className="boton boton-claro boton-chico"
                    onClick={() => alternarMatricula(m)}
                    disabled={ocupado}
                  >
                    {m.active ? 'Desactivar' : 'Activar'}
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="ad-agregar" style={{ flexDirection: 'column', gap: '0.4rem' }}>
            <input
              className="ad-campo"
              type="search"
              placeholder="Matricular: escribe nombre o correo del estudiante"
              value={termino}
              onChange={(e) => setTermino(e.target.value)}
              aria-label="Buscar estudiante para matricular"
            />
            {termino.trim().length >= 2 && (
              buscando ? (
                <p className="ad-nota">Buscando…</p>
              ) : candidatos.length === 0 ? (
                <p className="ad-nota">No hay estudiantes disponibles con ese dato.</p>
              ) : (
                <ul className="ad-resultados">
                  {candidatos.map((u) => (
                    <li key={u.id}>
                      <span className="ad-persona-avatar">{inicialesDeUsuario(u.nombre)}</span>
                      <div className="ad-persona">
                        <strong>{u.nombre}</strong>
                        <span>{u.correo}</span>
                      </div>
                      <button
                        type="button"
                        className="boton boton-rojo boton-chico"
                        onClick={() => matricular(u)}
                        disabled={ocupado}
                      >
                        Matricular
                      </button>
                    </li>
                  ))}
                </ul>
              )
            )}
          </div>
        </section>

        {/* ── Elecciones ───────────────────────────────── */}
        <section className="cu-tarjeta ad-ancho-total">
          <div className="cu-tarjeta-titulo">
            <span className="cu-icono"><ScrollText size={22} /></span>
            <h2>Elecciones de la sección</h2>
          </div>

          {elecciones.length === 0 ? (
            <p className="ad-vacio">Esta sección todavía no tiene elecciones.</p>
          ) : (
            elecciones.map((e) => {
              const estado = ESTADO_ELECCION[e.status] ?? { etiqueta: e.status, tono: 'gris' };
              return (
                <div className="ad-eleccion" key={e.id}>
                  <div className="ad-eleccion-info">
                    <strong>{e.name}</strong>
                    <span>Del {fechaLegible(e.startsAt)} al {fechaLegible(e.endsAt)}</span>
                  </div>
                  <span className={`pildora tono-${estado.tono}`}>{estado.etiqueta}</span>
                  <Link to={`/admin/auditoria?eleccion=${e.id}`} className="boton boton-claro boton-chico">
                    <History size={15} /> Ver auditoría
                  </Link>
                </div>
              );
            })
          )}
        </section>
      </div>
    </div>
  );
}
