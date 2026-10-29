import { z } from 'zod';
import { LIMITES_CONTRASENA } from '../../aplicacion/servicios/contrasenas';

export const registroSchema = z.object({
  nombre: z
    .string()
    .trim()
    .min(3)
    .max(120)
    .refine((v) => v.length > 0, { message: 'El nombre es requerido' }),
  correo: z.string().trim().toLowerCase().min(3).max(254).email(),
  contrasena: z
    .string()
    .min(LIMITES_CONTRASENA.min, { message: `Minimo ${LIMITES_CONTRASENA.min} caracteres` })
    .max(LIMITES_CONTRASENA.max, { message: `Maximo ${LIMITES_CONTRASENA.max} caracteres` })
});

export const loginSchema = z.object({
  correo: z.string().trim().toLowerCase().email(),
  contrasena: z.string().min(1)
});

export const verificarQuerySchema = z.object({
  correo: z.string().trim().toLowerCase().email(),
  token: z.string().min(10)
});

export const idParamSchema = z.object({
  id: z.coerce.number().int().positive()
});
