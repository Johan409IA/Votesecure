import { z } from 'zod';

export const idEleccionParamSchema = z.object({
  id: z.coerce.number().int().positive()
});

export const crearEleccionSchema = z.object({
  seccionId: z.coerce.number().int().positive(),
  nombre: z.string().trim().min(3).max(160),
  iniciaEn: z.coerce.date(),
  cierraEn: z.coerce.date(),
  tipo: z.enum(['desempate', 'repeticion']).optional(),
  eleccionOrigenId: z.coerce.number().int().positive().optional()
}).refine((d) => d.cierraEn > d.iniciaEn, {
  message: 'La fecha de cierre debe ser posterior a la de inicio',
  path: ['cierraEn']
}).refine(
  (d) =>
    (d.tipo === undefined && d.eleccionOrigenId === undefined) ||
    (d.tipo !== undefined && d.eleccionOrigenId !== undefined),
  { message: 'Las elecciones derivadas requieren tipo y eleccion de origen' }
);

export const actualizarEleccionSchema = z
  .object({
    nombre: z.string().trim().min(3).max(160).optional(),
    iniciaEn: z.coerce.date().optional(),
    cierraEn: z.coerce.date().optional()
  })
  .refine((d) => Object.keys(d).length > 0, { message: 'Sin cambios' });

export const candidaturaSchema = z.object({
  matriculaId: z.coerce.number().int().positive()
});

export const votoSchema = z.object({
  candidaturaId: z.coerce.number().int().positive()
});

export const cancelarSchema = z.object({
  motivo: z.string().trim().min(1).max(500)
});

export const delegacionSchema = z.object({
  iniciaEn: z.coerce.date(),
  terminaEn: z.coerce.date().nullable().optional()
});

export const periodoEvaluacionSchema = z.object({
  abreEn: z.coerce.date(),
  cierraEn: z.coerce.date()
}).refine((d) => d.cierraEn > d.abreEn, {
  message: 'El cierre debe ser posterior a la apertura',
  path: ['cierraEn']
});

export const seccionSchema = z.object({
  codigoCurso: z.string().trim().min(1).max(30),
  nombreCurso: z.string().trim().min(1).max(160),
  periodoAcademico: z.string().trim().min(1).max(30),
  codigo: z.string().trim().min(1).max(30)
});

export const activarToggleSchema = z.object({
  activa: z.boolean()
});

export const matriculaSchema = z.object({
  estudianteId: z.coerce.number().int().positive()
});

export const asignacionSchema = z.object({
  docenteId: z.coerce.number().int().positive()
});
