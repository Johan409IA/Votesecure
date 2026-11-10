import { z } from 'zod';
import { PASSWORD_LIMITS } from '../../application/services/passwords';
import { deriveUserTypeFromEmail } from '../../application/services/roles';

export const registerSchema = z.object({
  nombre: z
    .string()
    .trim()
    .min(3)
    .max(120)
    .refine((value) => value.length > 0, { message: 'El nombre es requerido' }),
  correo: z
    .string()
    .trim()
    .toLowerCase()
    .min(3)
    .max(254)
    .pipe(z.email())
    .refine((value) => deriveUserTypeFromEmail(value) !== null, {
      message:
        'El correo debe ser institucional UTP: estudiante (u...@utp.edu.pe) o docente (c...@utp.edu.pe)'
    }),
  contrasena: z
    .string()
    .min(PASSWORD_LIMITS.min, { message: `Minimo ${PASSWORD_LIMITS.min} caracteres` })
    .max(PASSWORD_LIMITS.max, { message: `Maximo ${PASSWORD_LIMITS.max} caracteres` })
});

export const loginSchema = z.object({
  correo: z.string().trim().toLowerCase().pipe(z.email()),
  contrasena: z.string().min(1)
});

export const verifyQuerySchema = z.object({
  correo: z.string().trim().toLowerCase().pipe(z.email()),
  token: z.string().min(10)
});

export const idParamSchema = z.object({
  id: z.coerce.number().int().positive()
});
