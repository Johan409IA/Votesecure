// Textos y formatos compartidos por las pantallas del panel.

export const ETIQUETA_ROL = {
  estudiante: 'Estudiante',
  docente: 'Docente',
  administrador: 'Administrador',
};

// Estados de una elección (los que devuelve el backend) y su color.
export const ESTADO_ELECCION = {
  borrador:   { etiqueta: 'Borrador',   tono: 'gris' },
  programada: { etiqueta: 'Programada', tono: 'azul' },
  activa:     { etiqueta: 'Activa',     tono: 'rojo' },
  cerrada:    { etiqueta: 'Cerrada',    tono: 'gris' },
  cancelada:  { etiqueta: 'Cancelada',  tono: 'gris' },
};

// Eventos que registra la auditoría de una elección.
export const EVENTO_AUDITORIA = {
  creacion:           { etiqueta: 'Creación',             tono: 'azul',  ayuda: 'Se creó la elección.' },
  activacion:         { etiqueta: 'Activación',           tono: 'verde', ayuda: 'Se congeló el padrón y se abrió la votación.' },
  cancelacion:        { etiqueta: 'Cancelación',          tono: 'rojo',  ayuda: 'La elección fue cancelada.' },
  cierre_publicacion: { etiqueta: 'Cierre y publicación', tono: 'gris',  ayuda: 'Se cerró la votación y se publicó el resultado.' },
};

const formatoFechaHora = new Intl.DateTimeFormat('es-PE', {
  day: '2-digit', month: 'short', year: 'numeric',
  hour: '2-digit', minute: '2-digit', second: '2-digit',
});

export const fechaHoraCompleta = (valor) => (valor ? formatoFechaHora.format(new Date(valor)) : '');

export function porcentaje(parte, total) {
  if (!total) return 0;
  return Math.round((parte / total) * 100);
}
