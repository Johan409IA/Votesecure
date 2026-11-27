import api from './api';

// Delegado vigente de la sección y su periodo de evaluación abierto (si lo hay).
//   GET /api/evaluaciones/delegado?seccionId=N
//   -> { delegacion: { delegateStudentId, delegateName, ... },
//        periodoAbierto: { id, opensAt, closesAt, instructions } | null,
//        promediosPorPeriodo?, promedioGlobal? }   (los promedios solo los recibe el propio delegado)
//   404 si todavía no hay delegado; 403 si no perteneces a la sección.
export const verDelegado = (seccionId) => api.get(`/evaluaciones/delegado?seccionId=${seccionId}`);

// POST /api/evaluaciones -> 201. Una sola evaluación por periodo (un segundo intento responde 409).
// Estudiante: nota 1-10 y comentario opcional de hasta 500 caracteres.
// Docente: nota 1-10 y comentario obligatorio de 20 a 1000 caracteres.
export const evaluarDelegado = ({ seccionId, calificacion, comentario, periodoId }) =>
  api.post('/evaluaciones', {
    seccionId,
    calificacion,
    periodoId, // se envía explícito para que no caiga en otro periodo si el formulario quedó abierto
    ...(comentario ? { comentario } : {}),
  });
