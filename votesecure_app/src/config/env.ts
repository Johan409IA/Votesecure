import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const esquemaServidor = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  FRONTEND_URL: z.string().url(),
  DATABASE_API_URL: z.string().min(1),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  REALTIME_CANAL_SECRETO: z.string().min(32),
  SESION_TTL_HORAS: z.coerce.number().positive().max(168).default(8),
  SMTP_URL: z.string().optional()
});

export type EntornoServidor = z.infer<typeof esquemaServidor>;

export function cargarEntornoServidor(): EntornoServidor {
  return esquemaServidor.parse(process.env);
}

export function cadenaDesdeEnv(nombre: string): string {
  const resultado = z.string().min(1).safeParse(process.env[nombre]);
  if (!resultado.success) {
    throw new Error(`Variable de entorno faltante: ${nombre}`);
  }
  return resultado.data;
}
