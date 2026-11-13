import { z } from 'zod';
import { boundedDate, positiveInt } from './common.dto';

export const idElectionParamSchema = z.object({
  id: positiveInt
});

export const createElectionSchema = z.object({
  seccionId: positiveInt,
  nombre: z.string().trim().min(3).max(160),
  iniciaEn: boundedDate,
  cierraEn: boundedDate,
  tipo: z.enum(['desempate', 'repeticion']).optional(),
  eleccionOrigenId: positiveInt.optional()
}).refine((data) => data.cierraEn > data.iniciaEn, {
  message: 'La fecha de cierre debe ser posterior a la de inicio',
  path: ['cierraEn']
}).refine(
  (data) =>
    (data.tipo === undefined && data.eleccionOrigenId === undefined) ||
    (data.tipo !== undefined && data.eleccionOrigenId !== undefined),
  { message: 'Las elecciones derivadas requieren tipo y eleccion de origen' }
).refine(
  // §6.2: la ventana del balotaje es corta, de 15 a 30 minutos.
  (data) => {
    if (data.tipo !== 'desempate') return true;
    const duracionMinutos =
      (data.cierraEn.getTime() - data.iniciaEn.getTime()) / 60_000;
    return duracionMinutos >= 15 && duracionMinutos <= 30;
  },
  { message: 'El desempate debe durar entre 15 y 30 minutos', path: ['cierraEn'] }
);

export const updateElectionSchema = z
  .object({
    nombre: z.string().trim().min(3).max(160).optional(),
    iniciaEn: boundedDate.optional(),
    cierraEn: boundedDate.optional()
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'Sin cambios' });

export const candidacySchema = z.object({
  matriculaId: positiveInt
});

export const voteSchema = z.object({
  candidaturaId: positiveInt
});

export const cancelSchema = z.object({
  motivo: z.string().trim().min(1).max(500)
});

export const delegationSchema = z.object({
  iniciaEn: boundedDate,
  terminaEn: boundedDate.nullable().optional()
});

export const evaluationPeriodSchema = z.object({
  delegacionId: positiveInt,
  abreEn: boundedDate,
  cierraEn: boundedDate,
  instrucciones: z.string().trim().min(20).max(1000)
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
  estudianteId: positiveInt
});

export const assignmentSchema = z.object({
  docenteId: positiveInt
});
