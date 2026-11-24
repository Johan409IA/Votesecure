// Reglas para mostrar cursos y elecciones tal como las devuelve el backend.
// Estados de elección: borrador, programada, activa, cerrada, cancelada.

const PALABRAS_IGNORADAS = new Set([
  'de', 'del', 'la', 'las', 'el', 'los', 'y', 'e', 'en', 'a', 'para', 'con', 'por',
]);
const NUMEROS_ROMANOS = /^(i|ii|iii|iv|v|vi|vii|viii|ix|x)$/i;

// "Principio de algoritmos" -> "PA", "Base de Datos I" -> "BD"
export function iniciales(nombreCurso, codigoCurso = '') {
  const palabras = nombreCurso
    .split(/\s+/)
    .filter((p) => p && !PALABRAS_IGNORADAS.has(p.toLowerCase()) && !NUMEROS_ROMANOS.test(p) && !/^\d+$/.test(p));
  const letras = palabras.slice(0, 2).map((p) => p[0]).join('');
  return (letras || codigoCurso.slice(0, 2) || '··').toUpperCase();
}

export function inicialesDeUsuario(nombre) {
  const letras = nombre.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('');
  return (letras || '·').toUpperCase();
}

// De todas las elecciones de una sección, cuál se muestra en la tarjeta:
// la que está abierta; si no, la programada; si no, la última finalizada.
// Los borradores y las canceladas no se muestran (la lista viene de más reciente a más antigua).
export function elegirEleccion(elecciones) {
  const visibles = elecciones.filter((e) => e.status !== 'borrador' && e.status !== 'cancelada');
  return (
    visibles.find((e) => e.status === 'activa') ??
    visibles.find((e) => e.status === 'programada') ??
    visibles.find((e) => e.status === 'cerrada') ??
    null
  );
}

// Estado que ve la persona en la tarjeta y en la página del curso.
export function calcularEstado(eleccion, { yaVoto, habilitado }) {
  if (!eleccion) return 'sin-eleccion';
  if (eleccion.status === 'cerrada') return 'finalizada';
  if (eleccion.status === 'programada') return 'programada';
  if (eleccion.status === 'activa') {
    if (!habilitado) return 'no-habilitado';
    return yaVoto ? 'participaste' : 'abierta';
  }
  return 'sin-eleccion';
}

// Texto y estilo de cada estado. "tono" es la clase de color del CSS.
export const ESTADOS = {
  abierta:        { etiqueta: 'Votación abierta',     tono: 'rojo',  boton: 'Participar',     destacada: true },
  participaste:   { etiqueta: 'Ya participaste',      tono: 'verde', boton: 'Ver elección' },
  finalizada:     { etiqueta: 'Elección finalizada',  tono: 'gris',  boton: 'Ver resultados' },
  programada:     { etiqueta: 'Votación programada',  tono: 'azul',  boton: 'Ver elección' },
  'no-habilitado': { etiqueta: 'No habilitado',       tono: 'gris',  boton: 'Ver curso' },
  'sin-eleccion': { etiqueta: 'Sin elección',         tono: 'gris',  boton: 'Ver curso' },
};

export function nombresDocentes(asignaciones) {
  const nombres = asignaciones.filter((a) => a.active).map((a) => a.teacherName);
  return nombres.length > 0 ? nombres.join(', ') : 'Por asignar';
}

const formatoFecha = new Intl.DateTimeFormat('es-PE', {
  day: 'numeric',
  month: 'short',
  hour: 'numeric',
  minute: '2-digit',
});

export function fechaLegible(valor) {
  if (!valor) return '';
  return formatoFecha.format(new Date(valor));
}
