// El backend permite una evaluación por periodo, pero no dice si la persona ya envió la suya.
// Se recuerda aquí solo como ayuda de pantalla; la verdad la sigue decidiendo el backend (409).
const clave = (usuarioId, periodoId) => `evaluado:${usuarioId}:${periodoId}`;

export function yaEvaluo(usuarioId, periodoId) {
  try {
    return localStorage.getItem(clave(usuarioId, periodoId)) === '1';
  } catch {
    return false;
  }
}

export function marcarEvaluado(usuarioId, periodoId) {
  try {
    localStorage.setItem(clave(usuarioId, periodoId), '1');
  } catch {
    /* sin almacenamiento: solo se pierde el recordatorio */
  }
}
