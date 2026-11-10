import { createHash, randomBytes } from 'node:crypto';
import { z } from 'zod';
import { Pool } from 'pg';
import { hash } from '@node-rs/argon2';
import { loadServerEnv } from '../src/config/env';
import { logger } from '../src/config/logger';

const argsSchema = z
  .object({
    correo: z.string().trim().toLowerCase().email(),
    nombre: z.string().trim().min(3).max(120),
    contrasena: z.string().min(15).max(128)
  });

function parseArgs(): z.infer<typeof argsSchema> {
  const args = new Map<string, string>();
  for (let i = 2; i < process.argv.length; i++) {
    const key = process.argv[i] ?? '';
    if (key.startsWith('--') && i + 1 < process.argv.length) {
      args.set(key.slice(2), process.argv[i + 1] ?? '');
    }
  }
  return argsSchema.parse({
    correo: args.get('correo') ?? '',
    nombre: args.get('nombre') ?? '',
    contrasena: args.get('contrasena') ?? ''
  });
}

async function main(): Promise<void> {
  const args = parseArgs();
  const env = loadServerEnv();
  const token = randomBytes(32).toString('base64url');
  const tokenHash = createHash('sha256').update(token).digest();
  const passwordHash = await hash(args.contrasena, {
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1
  });

  const pool = new Pool({
    connectionString: process.env['DATABASE_URL'] ?? env.DATABASE_API_URL,
    max: 1
  });
  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SET ROLE votesecure_provisionamiento');
      const existing = await client.query(`SELECT id FROM usuarios WHERE correo = $1`, [
        args.correo
      ]);
      if (existing.rowCount !== 0) {
        throw new Error('Ese correo ya esta registrado');
      }
      await client.query(
        `INSERT INTO usuarios (nombre, correo, tipo_usuario, hash_contrasena,
           verificacion_hash, verificacion_expira_en)
         VALUES ($1, $2, 'administrador', $3, $4, now() + interval '24 hours')`,
        [args.nombre, args.correo, passwordHash, tokenHash]
      );
      await client.query('COMMIT');
      const link = `${env.FRONTEND_URL}/verificar-correo?correo=${encodeURIComponent(args.correo)}&token=${encodeURIComponent(token)}`;
      logger.info({ link }, 'Administrador provisionado. Verifica el correo con este enlace');
      console.log('Administrador provisionado.');
      console.log(`Enlace de verificacion: ${link}`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      await client.query('RESET ROLE');
      client.release();
    }
  } finally {
    await pool.end();
  }
}

void main().catch((error) => {
  console.error('Fallo el aprovisionamiento:', error instanceof Error ? error.message : error);
  process.exit(1);
});
