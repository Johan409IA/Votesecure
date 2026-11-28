import api from './api';

// Auditoría (solo administrador). Lo que se RECIBE de secciones y elecciones viene en
// camelCase en inglés (courseName, sectionId, status...); los eventos, igual.

export const listarSecciones = () => api.get('/secciones').then((d) => d.secciones);

export const listarElecciones = (seccionId) =>
  api.get(`/elecciones?seccionId=${seccionId}`).then((d) => d.elecciones);

// El detalle trae { election, candidacies, eligibilities }; aquí solo interesa election.
export const obtenerEleccion = (id) => api.get(`/elecciones/${id}`).then((d) => d.election);

// Eventos de más reciente a más antiguo. Solo lectura.
export const listarAuditoria = (eleccionId) =>
  api.get(`/auditoria/elecciones/${eleccionId}`).then((d) => d.eventos);
