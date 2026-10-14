const { Auditoria } = require('../models');

/**
 * Registra una acción en el log de auditoría.
 * Garantiza anonimato: NUNCA registra el candidato votado.
 */
const registrarAuditoria = async ({
  usuarioId = null,
  accion,
  ip = '',
  detalle = '',
  req = null,
}) => {
  try {
    const ipFinal = ip || (req ? (req.headers['x-forwarded-for'] || req.socket.remoteAddress) : '');
    await Auditoria.create({
      usuario_id: usuarioId,
      accion,
      ip: ipFinal,
      detalle, // Nunca incluir candidato_id aquí
      fechaHora: new Date(),
    });
  } catch (err) {
    // La auditoría nunca debe romper el flujo principal
    console.error('⚠️  Error en auditoría (no crítico):', err.message);
  }
};

// Acciones estándar del sistema
const ACCIONES = {
  LOGIN:              'LOGIN',
  LOGOUT:             'LOGOUT',
  REGISTRO:           'REGISTRO',
  VOTO_EMITIDO:       'VOTO_EMITIDO',      // Solo registra que votó, no a quién
  VER_RESULTADOS:     'VER_RESULTADOS',
  CREAR_ELECCION:     'CREAR_ELECCION',
  MODIFICAR_ELECCION: 'MODIFICAR_ELECCION',
  ELIMINAR_ELECCION:  'ELIMINAR_ELECCION',
  CREAR_CANDIDATO:    'CREAR_CANDIDATO',
  ELIMINAR_CANDIDATO: 'ELIMINAR_CANDIDATO',
  INTENTO_DOBLE_VOTO: 'INTENTO_DOBLE_VOTO',
  LOGIN_FALLIDO:      'LOGIN_FALLIDO',
  ACCESO_NO_AUTORIZADO: 'ACCESO_NO_AUTORIZADO',
  CONSULTA_RENIEC:    'CONSULTA_RENIEC', // Valor agregado: verificación de identidad
  ELECCION_FINALIZADA: 'ELECCION_FINALIZADA',
};

module.exports = { registrarAuditoria, ACCIONES };
