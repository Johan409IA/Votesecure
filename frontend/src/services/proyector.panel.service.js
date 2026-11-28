import api from './api';

// Datos de apoyo del proyector: la elección, su curso y las fotos de los candidatos.
// Los resultados en sí (y su actualización en vivo) los entrega el hook
// useResultadosEnVivo, que ya existe: no se duplica aquí.
export async function cargarDatosProyector(eleccionId) {
  const detalle = await api.get(`/elecciones/${eleccionId}`);
  const eleccion = detalle.election;
  const { seccion } = await api.get(`/secciones/${eleccion.sectionId}`);
  // candidacies: [{ id, studentName, photoUrl }] — el id coincide con candidaturaId de los resultados
  return { eleccion, seccion, candidaturas: detalle.candidacies ?? [] };
}
