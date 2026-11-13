import { z } from 'zod';

// F-017 (review 2026-11-12): z.coerce.number() acepta booleanos (true -> 1) y
// otras entradas ambiguas; aqui se normalizan los valores que vienen de la API.
const nonBoolean = (value: unknown) => (typeof value === 'boolean' ? undefined : value);

export const positiveInt = z.preprocess(
  nonBoolean,
  z.coerce
    .number()
    .int()
    .positive()
    .refine(Number.isSafeInteger, { message: 'Identificador invalido' })
);

export const scoreInt = z.preprocess(
  nonBoolean,
  z.coerce.number().int().min(1).max(10)
);

const MAX_DATE_OFFSET_MS = 366 * 24 * 60 * 60 * 1000;

// F-017: las fechas de entrada se limitan a una ventana de +/- 1 ano para no
// aceptar valores absurdos (ni el epoch que produce coercer un booleano).
export const boundedDate = z.coerce
  .date()
  .refine((date) => Math.abs(date.getTime() - Date.now()) <= MAX_DATE_OFFSET_MS, {
    message: 'Fecha fuera del rango permitido (+/- 1 ano)'
  });
