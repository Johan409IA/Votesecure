import api from './api';

// Panel de administrador. Todas estas rutas exigen tipo "administrador" y
// correo verificado. Ojo con las claves: lo que se ENVÍA va en español
// (codigoCurso, docenteId...), pero lo que se RECIBE de secciones, matrículas,
// asignaciones y elecciones viene en camelCase en inglés (courseName, studentName...).

// ── Secciones ───────────────────────────────────────────────
export const listarSecciones = () => api.get('/secciones').then((d) => d.secciones);

export const obtenerSeccion = (id) => api.get(`/secciones/${id}`).then((d) => d.seccion);

export const crearSeccion = ({ codigoCurso, nombreCurso, periodoAcademico }) =>
  api.post('/secciones', { codigoCurso, nombreCurso, periodoAcademico }).then((d) => d.seccion);

// activa=false bloquea las inscripciones con código; activa=true las vuelve a abrir.
export const cambiarInscripciones = (seccionId, activa) =>
  api.patch(`/secciones/${seccionId}`, { activa });

// ── Docentes de la sección ──────────────────────────────────
export const listarAsignaciones = (seccionId) =>
  api.get(`/secciones/${seccionId}/asignaciones`).then((d) => d.asignaciones);

export const asignarDocente = (seccionId, docenteId) =>
  api.post(`/secciones/${seccionId}/asignaciones`, { docenteId });

export const cambiarAsignacion = (asignacionId, activa) =>
  api.patch(`/asignaciones/${asignacionId}`, { activa });

// ── Estudiantes de la sección ───────────────────────────────
export const listarMatriculas = (seccionId) =>
  api.get(`/secciones/${seccionId}/matriculas`).then((d) => d.matriculas);

export const matricularEstudiante = (seccionId, estudianteId) =>
  api.post(`/secciones/${seccionId}/matriculas`, { estudianteId });

export const cambiarMatricula = (matriculaId, activa) =>
  api.patch(`/matriculas/${matriculaId}`, { activa });

// ── Cuentas (para buscar a quién asignar o matricular) ──────
// tipo: 'estudiante' | 'docente' | 'administrador'. Devuelve como máximo 500.
export function buscarUsuarios({ busqueda = '', tipo } = {}) {
  const consulta = new URLSearchParams();
  if (busqueda) consulta.set('busqueda', busqueda);
  if (tipo) consulta.set('tipo', tipo);
  const texto = consulta.toString();
  return api.get(`/usuarios${texto ? `?${texto}` : ''}`).then((d) => d.usuarios);
}

// ── Elecciones y auditoría ──────────────────────────────────
export const listarElecciones = (seccionId) =>
  api.get(`/elecciones?seccionId=${seccionId}`).then((d) => d.elecciones);

// El detalle trae { election, candidacies, eligibilities }; aquí solo interesa election.
export const obtenerEleccion = (id) => api.get(`/elecciones/${id}`).then((d) => d.election);

// Eventos de más reciente a más antiguo. Solo lectura.
export const listarAuditoria = (eleccionId) =>
  api.get(`/auditoria/elecciones/${eleccionId}`).then((d) => d.eventos);
