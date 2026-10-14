import api from './api';

/**
 * Consulta el DNI contra el endpoint proxy del backend (que a su vez
 * consulta RENIEC vía un proveedor intermediario). Ver backend/src/routes/reniec.routes.js
 */
export const verificarDni = async (dni) => {
  const { data } = await api.get(`/reniec/${dni}`);
  return data; // { dni, nombres, apellidoPaterno, apellidoMaterno, nombreCompleto, verificado }
};
