// Cliente HTTP de VoteSecure.
// El backend usa sesiones por cookie HttpOnly (votecure_sesion) y protección CSRF:
// en cada petición que modifica datos hay que enviar la cabecera X-CSRF-Token
// con el valor de la cookie votecure_csrf (doble envío).
// En desarrollo, Vite redirige /api al backend (puerto 3000), por eso la
// base es relativa y el navegador trata todo como mismo origen.

const BASE = '/api';
const COOKIE_CSRF = 'votecure_csrf';

export const EVENTO_SESION_EXPIRADA = 'votesecure:sesion-expirada';

export class ApiError extends Error {
  constructor(status, codigo, mensaje) {
    super(mensaje);
    this.name = 'ApiError';
    this.status = status; // código HTTP (0 = sin conexión)
    this.codigo = codigo; // VALIDACION, NO_AUTENTICADO, PROHIBIDO, NEGOCIO, LIMITE...
  }
}

function leerCookie(nombre) {
  const par = document.cookie.split('; ').find((c) => c.startsWith(`${nombre}=`));
  return par ? decodeURIComponent(par.slice(nombre.length + 1)) : null;
}

async function solicitar(metodo, ruta, cuerpo) {
  const headers = { Accept: 'application/json' };
  if (cuerpo !== undefined) headers['Content-Type'] = 'application/json';
  if (metodo !== 'GET') {
    const csrf = leerCookie(COOKIE_CSRF);
    if (csrf) headers['X-CSRF-Token'] = csrf;
  }

  let respuesta;
  try {
    respuesta = await fetch(`${BASE}${ruta}`, {
      method: metodo,
      headers,
      credentials: 'include',
      body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
    });
  } catch {
    throw new ApiError(0, 'RED', 'No se pudo conectar con el servidor. Inténtalo de nuevo en unos minutos.');
  }

  let datos = null;
  try {
    datos = await respuesta.json();
  } catch {
    // respuesta sin cuerpo JSON
  }

  if (!respuesta.ok) {
    const sinRespuestaUtil = datos === null && respuesta.status >= 500;
    const mensaje = sinRespuestaUtil
      ? 'El servidor no está disponible en este momento.'
      : datos?.mensaje ?? 'Ocurrió un error inesperado.';
    // Un 401 en una ruta que no es de /auth significa que la sesión caducó.
    // En /auth/login (credenciales malas) o /auth/yo (sin sesión) es normal.
    if (respuesta.status === 401 && !ruta.startsWith('/auth/')) {
      window.dispatchEvent(new Event(EVENTO_SESION_EXPIRADA));
    }
    throw new ApiError(respuesta.status, datos?.error ?? 'DESCONOCIDO', mensaje);
  }
  return datos;
}

const api = {
  get: (ruta) => solicitar('GET', ruta),
  post: (ruta, cuerpo) => solicitar('POST', ruta, cuerpo ?? {}),
  patch: (ruta, cuerpo) => solicitar('PATCH', ruta, cuerpo ?? {}),
  delete: (ruta) => solicitar('DELETE', ruta),
};

export default api;
