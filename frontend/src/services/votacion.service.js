import api from './api';

// Emite el voto de la persona en la elección indicada.
// Backend: POST /api/elecciones/:id/votar  { candidaturaId }  ->  201 { confirmed: true }
// El voto es anónimo e irreversible. Si algo falla (ya votó, no está habilitada,
// la elección no está activa…) api.js lanza un ApiError cuyo .message es el
// texto que se le puede mostrar a la persona.
export const emitirVoto = (eleccionId, candidaturaId) =>
  api.post(`/elecciones/${eleccionId}/votar`, { candidaturaId });