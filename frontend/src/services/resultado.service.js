import api from './api';

// Resultados de una eleccion (GET /api/elecciones/:id/resultados).
// Con la eleccion activa responde { tipo: 'en_vivo', totalHabilitados,
// totalParticipantes, totalVotos, candidaturas: [{ candidaturaId, nombre,
// votos }], yaVoto? } y con la eleccion cerrada { tipo: 'final',
// porcentajeParticipacion, situacion, ganadorCandidaturaId, candidaturas }.
export const cargarResultados = (eleccionId) =>
  api.get(`/elecciones/${eleccionId}/resultados`);

// Ticket efimero del canal de Supabase Realtime (POST /api/resultados/:id/suscripcion).
// Responde { canal, expiraEn } y hay que renovarlo antes de que venza (60 s).
export const pedirSuscripcion = (eleccionId) =>
  api.post(`/resultados/${eleccionId}/suscripcion`);

// Proclama al delegado electo (POST /api/elecciones/:id/proclamar).
// Solo funciona si la eleccion esta cerrada con un ganador unico publicado.
export const proclamarDelegado = (eleccionId, { iniciaEn, terminaEn }) =>
  api.post(`/elecciones/${eleccionId}/proclamar`, { iniciaEn, terminaEn });

export const programar = (eleccionId) =>
  api.post(`/elecciones/${eleccionId}/programar`);

export const activar = (eleccionId) =>
  api.post(`/elecciones/${eleccionId}/activar`);

// Crea la eleccion de desempate (POST /api/elecciones). El backend exige
// tipo 'desempate', eleccionOrigenId cerrada con empate y ventana de 15-30 min.
export const crearDesempate = ({ seccionId, nombre, iniciaEn, cierraEn, eleccionOrigenId }) =>
  api.post('/elecciones', { seccionId, nombre, iniciaEn, cierraEn, tipo: 'desempate', eleccionOrigenId });

// "Iniciar desempate" en un clic: crea el balotaje, lo programa y lo activa
// para que la votacion comience de inmediato. Si la activacion falla por el
// reloj (iniciaEn aun no llega), el planificador del backend la activa solo.
export async function iniciarDesempate({ seccionId, nombre, iniciaEn, cierraEn, eleccionOrigenId }) {
  const { eleccion } = await crearDesempate({ seccionId, nombre, iniciaEn, cierraEn, eleccionOrigenId });
  await programar(eleccion.id);
  try {
    await activar(eleccion.id);
  } catch {
    // El planificador la activa al llegar iniciaEn; no es un error para el docente.
  }
  return eleccion;
}
