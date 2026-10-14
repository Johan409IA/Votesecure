const mongoose = require('mongoose');
const { Resultado, Candidato, Eleccion, Participacion } = require('../models');

/**
 * Actualiza los valores agregados después de cada voto:
 * - Resultado por candidato (cantidad + porcentaje)
 * - Totales en la Elección (totalVotos, totalParticipantes, porcentajeParticipacion)
 *
 * Usa operaciones atómicas de MongoDB para evitar race conditions.
 */
const actualizarResultados = async (eleccionId, candidatoId, io = null) => {
  // 1. Incremento atómico en Candidato
  await Candidato.findByIdAndUpdate(candidatoId, { $inc: { totalVotos: 1 } });

  // 2. Incremento atómico en Eleccion
  const eleccion = await Eleccion.findByIdAndUpdate(
    eleccionId,
    { $inc: { totalVotos: 1, totalParticipantes: 1 } },
    { new: true }
  );

  // 3. Total de votos actuales en la elección
  const totalVotos = eleccion.totalVotos;

  // 4. Recalcular porcentajes de TODOS los candidatos de esta elección
  const candidatos = await Candidato.find({ eleccion_id: eleccionId });

  const resultadosActualizados = await Promise.all(
    candidatos.map(async (c) => {
      const porcentaje = totalVotos > 0
        ? parseFloat(((c.totalVotos / totalVotos) * 100).toFixed(2))
        : 0;

      await Candidato.findByIdAndUpdate(c._id, { porcentaje });

      // Upsert en colección Resultado (para historial y queries rápidas)
      const resultado = await Resultado.findOneAndUpdate(
        { eleccion_id: eleccionId, candidato_id: c._id },
        {
          cantidadVotos:       c.totalVotos,
          porcentaje,
          ultimaActualizacion: new Date(),
        },
        { upsert: true, new: true }
      );

      return {
        candidato_id: c._id,
        nombre:       c.nombre,
        foto:         c.foto,
        cantidadVotos: c.totalVotos,
        porcentaje,
      };
    })
  );

  // 5. Calcular porcentaje de participación (si hay total de inscritos)
  // Aquí puedes agregar lógica si tienes un padrón de votantes
  const porcentajeParticipacion = parseFloat(
    ((eleccion.totalParticipantes / Math.max(eleccion.totalVotos, 1)) * 100).toFixed(2)
  );
  await Eleccion.findByIdAndUpdate(eleccionId, { porcentajeParticipacion });

  // 6. Emitir por WebSocket a todos los clientes suscritos a esta elección
  if (io) {
    io.to(`eleccion:${eleccionId}`).emit('resultados:actualizados', {
      eleccion_id:         eleccionId,
      totalVotos,
      totalParticipantes:  eleccion.totalParticipantes,
      porcentajeParticipacion,
      candidatos:          resultadosActualizados,
      timestamp:           new Date().toISOString(),
    });
  }

  return resultadosActualizados;
};

/**
 * Obtiene los resultados actuales con pipeline de agregación de MongoDB.
 * Usa $lookup y $group para calcular stats en tiempo real desde la BD.
 */
const obtenerResultadosAgregados = async (eleccionId) => {
  const pipeline = [
    { $match: { eleccion_id: new mongoose.Types.ObjectId(eleccionId) } },
    {
      $lookup: {
        from: 'candidatos',
        localField: 'candidato_id',
        foreignField: '_id',
        as: 'candidato',
      },
    },
    { $unwind: '$candidato' },
    {
      $project: {
        _id: 0,
        candidato_id: '$candidato._id',
        nombre:        '$candidato.nombre',
        foto:          '$candidato.foto',
        cantidadVotos: 1,
        porcentaje:    1,
        ultimaActualizacion: 1,
      },
    },
    { $sort: { cantidadVotos: -1 } },
  ];

  const resultados = await Resultado.aggregate(pipeline);

  // Stats globales de la elección
  const eleccion = await Eleccion.findById(eleccionId)
    .select('titulo totalVotos totalParticipantes porcentajeParticipacion estado')
    .lean();

  return { eleccion, resultados };
};

module.exports = { actualizarResultados, obtenerResultadosAgregados };
