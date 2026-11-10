import { z } from 'zod';

export const idElectionParamSchema = z.object({
  id: z.coerce.number().int().positive()
});

export const createElectionSchema = z.object({
  seccionId: z.coerce.number().int().positive(),
  nombre: z.string().trim().min(3).max(160),
  iniciaEn: z.coerce.date(),
  cierraEn: z.coerce.date(),
  tipo: z.enum(['desempate', 'repeticion']).optional(),
  eleccionOrigenId: z.coerce.number().int().positive().optional()
}).refine((data) => data.cierraEn > data.iniciaEn, {
  message: 'La fecha de cierre debe ser posterior a la de inicio',
  path: ['cierraEn']
}).refine(
  (data) =>
    (data.tipo === undefined && data.eleccionOrigenId === undefined) ||
    (data.tipo !== undefined && data.eleccionOrigenId !== undefined),
  { message: 'Las elecciones derivadas requieren tipo y eleccion de origen' }
);

export const updateElectionSchema = z
  .object({
    nombre: z.string().trim().min(3).max(160).optional(),
    iniciaEn: z.coerce.date().optional(),
    cierraEn: z.coerce.date().optional()
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'Sin cambios' });

export const candidacySchema = z.object({
  matriculaId: z.coerce.number().int().positive()
});

export const voteSchema = z.object({
  candidaturaId: z.coerce.number().int().positive()
});

export const cancelSchema = z.object({
  motivo: z.string().trim().min(1).max(500)
});

export const delegationSchema = z.object({
  iniciaEn: z.coerce.date(),
  terminaEn: z.coerce.date().nullable().optional()
});

export const evaluationPeriodSchema = z.object({
  delegacionId: z.coerce.number().int().positive(),
  abreEn: z.coerce.date(),
  cierraEn: z.coerce.date()
}).refine((data) => data.cierraEn > data.abreEn, {
  message: 'El cierre debe ser posterior a la apertura',
  path: ['cierraEn']
});

export const sectionSchema = z.object({
  codigoCurso: z.string().trim().min(1).max(30),
  nombreCurso: z.string().trim().min(1).max(160),
  periodoAcademico: z.string().trim().min(1).max(30)
});

// Codigos SEC-XXXX: A-Z y 2-9, sin 0/1/I/L/O (ambiguos).
export const joinSectionSchema = z.object({
  codigo: z
    .string()
    .trim()
    .regex(/^SEC-[A-HJ-KM-NP-Z2-9]{4}$/, 'El codigo debe tener el formato SEC-XXXX')
});

export const activeToggleSchema = z.object({
  activa: z.boolean()
});

export const enrollmentSchema = z.object({
  estudianteId: z.coerce.number().int().positive()
});

export const assignmentSchema = z.object({
  docenteId: z.coerce.number().int().positive()
});
