import api from './api';

export const emitirVoto = async (eleccion_id, candidato_id) => {
  const { data } = await api.post('/votos', { eleccion_id, candidato_id });
  return data;
};

export const misComprobantes = async () => {
  const { data } = await api.get('/votos/mis-comprobantes');
  return data;
};

export const verificarComprobante = async (hash) => {
  const { data } = await api.get(`/votos/verificar/${hash}`);
  return data;
};
