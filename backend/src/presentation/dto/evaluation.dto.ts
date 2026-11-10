import { z } from 'zod';

export const evaluateSchema = z.object({
  seccionId: z.coerce.number().int().positive(),
  calificacion: z.coerce.number().int().min(1).max(10),
  comentario: z.string().trim().max(1000).optional()
});

export const sectionQuerySchema = z.object({
  seccionId: z.coerce.number().int().positive()
});
