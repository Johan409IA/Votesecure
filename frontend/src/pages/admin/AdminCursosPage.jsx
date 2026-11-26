import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, BookOpen, Lock, LockOpen, Plus, Search } from 'lucide-react';
import { listarAsignaciones, listarSecciones } from '../../services/admin.service';
import { iniciales, nombresDocentes } from '../../utils/cursos';
import ModalCrearSeccion from './ModalCrearSeccion';
import '../Cursos.css';
import './Admin.css';

// Trae todas las secciones y, para cada una, quién la dicta.
async function cargarCursosAdmin() {
  const secciones = await listarSecciones();
  const cursos = await Promise.all(
    secciones.map(async (seccion) => {
      const asignaciones = await listarAsignaciones(seccion.id).catch(() => []);
      return { seccion, docente: nombresDocentes(asignaciones) };
    })
  );
  return cursos.sort((a, b) => a.seccion.courseName.localeCompare(b.seccion.courseName, 'es'));
}

export default function AdminCursosPage() {
  const navigate = useNavigate();
  const [cursos, setCursos] = useState(null);
  const [error, setError] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [filtro, setFiltro] = useState('todas');
  const [verModal, setVerModal] = useState(false);

  useEffect(() => {
    let activo = true;
    cargarCursosAdmin()
      .then((datos) => { if (activo) setCursos(datos); })
      .catch((err) => { if (activo) setError(err.message); });
    return () => { activo = false; };
  }, []);

  const conteo = useMemo(() => {
    const lista = cursos ?? [];
    return {
      todas: lista.length,
      abiertas: lista.filter((c) => c.seccion.active).length,
      bloqueadas: lista.filter((c) => !c.seccion.active).length,
    };
  }, [cursos]);

  const visibles = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    return (cursos ?? []).filter(({ seccion, docente }) => {
      if (filtro === 'abiertas' && !seccion.active) return false;
      if (filtro === 'bloqueadas' && seccion.active) return false;
      if (!texto) return true;
      return [seccion.courseName, seccion.courseCode, seccion.academicPeriod, seccion.code, docente]
        .some((campo) => campo.toLowerCase().includes(texto));
    });
  }, [cursos, busqueda, filtro]);

  const FILTROS = [
    { clave: 'todas', etiqueta: 'Todas' },
    { clave: 'abiertas', etiqueta: 'Inscripciones abiertas' },
    { clave: 'bloqueadas', etiqueta: 'Bloqueadas' },
  ];

  let contenido;
  if (error) {
    contenido = <div className="aviso aviso-error" role="alert">{error}</div>;
  } else if (cursos === null) {
    contenido = <p className="cargando-texto">Cargando cursos…</p>;
  } else if (cursos.length === 0) {
    contenido = (
      <div className="estado-vacio">
        <BookOpen size={40} />
        <h2>Todavía no hay secciones</h2>
        <p>Crea la primera sección para que los estudiantes puedan unirse con su código.</p>
        <button type="button" className="boton boton-rojo" onClick={() => setVerModal(true)}>
          <Plus size={18} /> Crear sección
        </button>
      </div>
    );
  } else {
    contenido = (
      <>
        <div className="ad-barra">
          <div className="ad-busqueda">
            <Search size={18} />
            <input
              type="search"
              placeholder="Buscar por curso, código, periodo o docente"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              aria-label="Buscar cursos"
            />
          </div>
          <div className="mc-filtros" role="tablist" aria-label="Filtrar por inscripciones" style={{ margin: 0 }}>
            {FILTROS.map((f) => (
              <button
                key={f.clave}
                type="button"
                role="tab"
                aria-selected={filtro === f.clave}
                className={`mc-filtro${filtro === f.clave ? ' activo' : ''}`}
                onClick={() => setFiltro(f.clave)}
              >
                {f.etiqueta}
                <span className="cuenta">{conteo[f.clave]}</span>
              </button>
            ))}
          </div>
        </div>

        {visibles.length === 0 ? (
          <div className="estado-vacio"><p>No hay cursos que coincidan con la búsqueda.</p></div>
        ) : (
          <div className="ad-tabla-caja">
            <table className="ad-tabla">
              <thead>
                <tr>
                  <th>Curso</th>
                  <th>Periodo</th>
                  <th>Sección</th>
                  <th>Docente</th>
                  <th>Inscripciones</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {visibles.map(({ seccion, docente }) => (
                  <tr key={seccion.id}>
                    <td>
                      <div className="ad-curso-celda">
                        <div className={`curso-avatar ${seccion.active ? 'tono-rojo' : 'tono-gris'}`}>
                          {iniciales(seccion.courseName, seccion.courseCode)}
                        </div>
                        <div>
                          <strong>{seccion.courseName}</strong>
                          <span>{seccion.courseCode}</span>
                        </div>
                      </div>
                    </td>
                    <td>{seccion.academicPeriod}</td>
                    <td><span className="ad-codigo">{seccion.code}</span></td>
                    <td>{docente}</td>
                    <td>
                      <span className={`pildora ${seccion.active ? 'tono-verde' : 'tono-gris'}`}>
                        {seccion.active ? <LockOpen size={13} /> : <Lock size={13} />}
                        {seccion.active ? 'Abiertas' : 'Bloqueadas'}
                      </span>
                    </td>
                    <td className="ad-derecha">
                      <Link to={`/admin/cursos/${seccion.id}`} className="boton boton-gris boton-chico">
                        Gestionar <ArrowRight size={15} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </>
    );
  }

  return (
    <div className="cursos-pagina">
      <div className="mc-cabecera">
        <div className="mc-titulo">
          <h1>Cursos</h1>
          <p>Administra las secciones, sus docentes y los estudiantes matriculados.</p>
          <button type="button" className="boton boton-rojo" onClick={() => setVerModal(true)}>
            <Plus size={18} /> Crear sección
          </button>
        </div>

        {cursos && cursos.length > 0 && (
          <div className="mc-resumen">
            <div className="mc-dato">
              <span className="mc-dato-icono tono-rojo"><BookOpen size={22} /></span>
              <div><strong>{conteo.todas}</strong><span>Secciones<br />en total</span></div>
            </div>
            <div className="mc-dato">
              <span className="mc-dato-icono tono-verde"><LockOpen size={22} /></span>
              <div><strong>{conteo.abiertas}</strong><span>Inscripciones<br />abiertas</span></div>
            </div>
            <div className="mc-dato">
              <span className="mc-dato-icono tono-gris"><Lock size={22} /></span>
              <div><strong>{conteo.bloqueadas}</strong><span>Inscripciones<br />bloqueadas</span></div>
            </div>
          </div>
        )}
      </div>

      {contenido}

      {verModal && (
        <ModalCrearSeccion
          alCerrar={() => setVerModal(false)}
          alCrear={(seccion) => navigate(`/admin/cursos/${seccion.id}`)}
        />
      )}
    </div>
  );
}
