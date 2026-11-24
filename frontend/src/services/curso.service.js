import api from './api';
import { calcularEstado, elegirEleccion, nombresDocentes } from '../utils/cursos';

// Arma un curso con todo lo que necesitan las pantallas:
// docente(s), elección que se muestra, si ya votó y el estado resultante.
async function armarCurso(seccion, esEstudiante) {
  const [asignaciones, elecciones] = await Promise.all([
    api.get(`/secciones/${seccion.id}/asignaciones`).then((d) => d.asignaciones).catch(() => []),
    api.get(`/elecciones?seccionId=${seccion.id}`).then((d) => d.elecciones).catch(() => []),
  ]);

  const eleccion = elegirEleccion(elecciones);
  let yaVoto = false;
  let habilitado = true;

  // Solo para estudiantes y con la elección abierta: el backend informa si ya votó.
  // Responde 403 cuando la persona no está en el padrón (se matriculó tarde).
  if (esEstudiante && eleccion?.status === 'activa') {
    try {
      const resultado = await api.get(`/elecciones/${eleccion.id}/resultados`);
      yaVoto = resultado.yaVoto === true;
    } catch (error) {
      if (error.status === 403) habilitado = false;
    }
  }

  return {
    seccion,
    docente: nombresDocentes(asignaciones),
    eleccion,
    yaVoto,
    estado: calcularEstado(eleccion, { yaVoto, habilitado }),
  };
}

export async function cargarCursos(esEstudiante) {
  const { secciones } = await api.get('/secciones');
  return Promise.all(secciones.map((s) => armarCurso(s, esEstudiante)));
}

export async function cargarCurso(id, esEstudiante) {
  const { seccion } = await api.get(`/secciones/${id}`);
  return armarCurso(seccion, esEstudiante);
}

// Solo estudiantes. codigo con formato SEC-XXXX.
export const unirseConCodigo = (codigo) => api.post('/secciones/unirse', { codigo });
