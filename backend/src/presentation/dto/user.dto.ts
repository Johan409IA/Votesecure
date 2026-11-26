import { z } from 'zod';

// GET /usuarios (solo administrador): listado con busqueda opcional por
// nombre o correo y filtro por tipo de cuenta.
export const listUsersQuerySchema = z.object({
  busqueda: z.string().trim().max(100).optional(),
  tipo: z.enum(['estudiante', 'docente', 'administrador']).optional()
});

// POST /usuarios/yo/foto: data URL JPEG en base64, tope 90 000 caracteres
// (mismo tope del CHECK de la columna usuarios.foto en sql/009).
export const photoSchema = z.object({
  imagen: z
    .string()
    .max(90_000)
    .regex(
      /^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/,
      'La imagen debe ser un JPEG en base64 (data URL) de hasta 90000 caracteres'
    )
});
