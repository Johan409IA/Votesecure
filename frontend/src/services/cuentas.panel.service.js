import api from './api';

// Cuentas (solo administrador). Cada integrante del panel tiene su propio servicio:
// no editen los de otros.

// GET /usuarios?busqueda=&tipo= -> { usuarios: [{ id, nombre, correo, tipo, correoVerificado, activa }] }
// El backend devuelve como máximo 500 cuentas, sin hashes ni fotos.
export function listarCuentas({ busqueda = '', tipo = '' } = {}) {
  const consulta = new URLSearchParams();
  if (busqueda) consulta.set('busqueda', busqueda);
  if (tipo) consulta.set('tipo', tipo);
  const texto = consulta.toString();
  return api.get(`/usuarios${texto ? `?${texto}` : ''}`).then((d) => d.usuarios);
}

// PATCH /usuarios/:id { activa }. Al desactivar, el backend revoca la sesión al instante.
export const cambiarEstadoCuenta = (id, activa) => api.patch(`/usuarios/${id}`, { activa });
