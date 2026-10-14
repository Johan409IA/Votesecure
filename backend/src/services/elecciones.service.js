const { Eleccion } = require('../models');
const { registrarAuditoria, ACCIONES } = require('./auditoria.service');

const finalizarEleccionesVencidas = async (io) => {
  try {
    const ahora = new Date();

    const eleccionesVencidas = await Eleccion.find({
      estado: 'activa',
      fechaFin: { $lte: ahora },
    });

    if (eleccionesVencidas.length === 0) return;

    for (const eleccion of eleccionesVencidas) {
      eleccion.estado = 'finalizada';
      await eleccion.save();

      await registrarAuditoria({
        usuarioId: null,
        accion: ACCIONES.ELECCION_FINALIZADA,
        ip: 'sistema',
        detalle: `Elección "${eleccion.titulo}" finalizada automáticamente por vencimiento de plazo`,
      });

      if (io) {
        io.emit('eleccion:finalizada', {
          eleccionId: eleccion._id,
          titulo: eleccion.titulo,
        });
      }

      console.log(`✅ Elección "${eleccion.titulo}" finalizada automáticamente`);
    }
  } catch (error) {
    console.error('❌ Error al finalizar elecciones vencidas:', error);
  }
};

module.exports = { finalizarEleccionesVencidas };