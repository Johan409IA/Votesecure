import api from './api';

export const listarOrganizacionesPublico = async () => {
  const { data } = await api.get('/organizaciones/publico');
  return data;
};

export const listarOrganizaciones = async () => {
  const { data } = await api.get('/organizaciones');
  return data;
};

export const crearOrganizacion = async (payload) => {
  const { data } = await api.post('/organizaciones', payload);
  return data;
};

export const eliminarOrganizacion = async (id) => {
  const { data } = await api.delete(`/organizaciones/${id}`);
  return data;
};

export const listarElecciones = async (params = {}) => {
  const { data } = await api.get('/elecciones', { params });
  return data;
};

export const obtenerEleccion = async (id) => {
  const { data } = await api.get(`/elecciones/${id}`);
  return data;
};

export const crearEleccion = async (payload) => {
  const { data } = await api.post('/elecciones', payload);
  return data;
};

export const cambiarEstadoEleccion = async (id, estado) => {
  const { data } = await api.patch(`/elecciones/${id}/estado`, { estado });
  return data;
};

export const eliminarEleccion = async (id) => {
  const { data } = await api.delete(`/elecciones/${id}`);
  return data;
};

export const crearCandidato = async (payload) => {
  const { data } = await api.post('/candidatos', payload);
  return data;
};

export const eliminarCandidato = async (id) => {
  const { data } = await api.delete(`/candidatos/${id}`);
  return data;
};

export const obtenerResultados = async (id) => {
  const { data } = await api.get(`/elecciones/${id}/resultados`);
  return data;
};

export const obtenerAuditoria = async (params = {}) => {
  const { data } = await api.get('/auditoria', { params });
  return data;
};
