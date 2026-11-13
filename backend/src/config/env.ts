import { z } from 'zod';

const serverSchema = z
  .object({
    PORT: z.coerce.number().int().positive().default(3000),
    // Obligatorio (F-010): de el dependen las cookies secure y el adaptador
    // de correo; un valor por defecto oculta despliegues mal configurados.
    NODE_ENV: z.enum(['development', 'production', 'test']),
    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(0),
    FRONTEND_URL: z.string().url(),
    DATABASE_API_URL: z.string().min(1),
    STATEMENT_TIMEOUT_MS: z.preprocess(
      (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
      z.coerce.number().int().positive().max(60_000).default(10_000)
    ),
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
    if (env.NODE_ENV !== 'production') return;
    if (!env.RESEND_API_KEY) {
      ctx.addIssue({
        code: 'custom',
        message: 'RESEND_API_KEY es obligatoria en produccion',
        path: ['RESEND_API_KEY']
      });
    }
    // F-010: en produccion el frontend debe ser https para que las cookies de
    // sesion se emitan siempre con el atributo Secure.
    if (new URL(env.FRONTEND_URL).protocol !== 'https:') {
      ctx.addIssue({
        code: 'custom',
        message: 'FRONTEND_URL debe usar https en produccion',
        path: ['FRONTEND_URL']
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
