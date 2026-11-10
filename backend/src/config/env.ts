import { z } from 'zod';

const serverSchema = z
  .object({
    PORT: z.coerce.number().int().positive().default(3000),
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    FRONTEND_URL: z.string().url(),
    DATABASE_API_URL: z.string().min(1),
    SUPABASE_URL: z.string().url(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
    REALTIME_CANAL_SECRETO: z.string().min(32),
    SESION_TTL_HORAS: z.coerce.number().positive().max(168).default(8),
    RESEND_API_KEY: z.preprocess(
      (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
      z.string().min(1).optional()
    ),
    REMITENTE_CORREO: z.string().trim().pipe(z.email()).default('seguridad@votesecureapp.com')
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === 'production' && !env.RESEND_API_KEY) {
      ctx.addIssue({
        code: 'custom',
        message: 'RESEND_API_KEY es obligatoria en produccion',
        path: ['RESEND_API_KEY']
      });
    }
  });

export type ServerEnv = z.infer<typeof serverSchema>;

export function loadServerEnv(): ServerEnv {
  return serverSchema.parse(process.env);
}

export function stringFromEnv(name: string): string {
  const result = z.string().min(1).safeParse(process.env[name]);
  if (!result.success) {
    throw new Error(`Variable de entorno faltante: ${name}`);
  }
  return result.data;
}
