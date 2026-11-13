import { z } from 'zod';
import { positiveInt, scoreInt } from './common.dto';

export const evaluateSchema = z.object({
  seccionId: positiveInt,
  calificacion: scoreInt,
  comentario: z.string().trim().max(1000).optional(),
  // §7.1: periodo destino opcional; si se omite se usa el abierto.
  periodoId: positiveInt.optional()
});

export const sectionQuerySchema = z.object({
  seccionId: positiveInt
});
