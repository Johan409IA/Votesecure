import { createHash, randomBytes } from 'node:crypto';
import { z } from 'zod';
import { Pool } from 'pg';
import { hash } from '@node-rs/argon2';
import { cargarEntornoServidor } from '../src/config/env';
import { logger } from '../src/config/logger';

const esquemaArgs = z
  .object({
    correo: z.string().trim().toLowerCase().email(),
    nombre: z.string().trim().min(3).max(120),
    contrasena: z.string().min(15).max(128)
  });

function parsearArgs(): z.infer<typeof esquemaArgs> {
  const args = new Map<string, string>();
  for (let i = 2; i < process.argv.length; i++) {
    const clave = process.argv[i] ?? '';
    if (clave.startsWith('--') && i + 1 < process.argv.length) {
      args.set(clave.slice(2), process.argv[i + 1] ?? '');
    }
  }
  return esquemaArgs.parse({
    correo: args.get('correo') ?? '',
    nombre: args.get('nombre') ?? '',
    contrasena: args.get('contrasena') ?? ''
  });
}

async function main(): Promise<void> {
  const args = parsearArgs();
  const entorno = cargarEntornoServidor();
  const token = randomBytes(32).toString('base64url');
  const hashToken = createHash('sha256').update(token).digest();
  const hashContrasena = await hash(args.contrasena, {
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1
  });

  const pool = new Pool({
    connectionString: process.env['DATABASE_URL'] ?? entorno.DATABASE_API_URL,
    max: 1
  });
  try {
    const cliente = await pool.connect();
    try {
      await cliente.query('BEGIN');
      await cliente.query('SET ROLE votesecure_provisionamiento');
      const existente = await cliente.query(`SELECT id FROM usuarios WHERE correo = $1`, [
        args.correo
      ]);
      if (existente.rowCount !== 0) {
        throw new Error('Ese correo ya esta registrado');
      }
      await cliente.query(
        `INSERT INTO usuarios (nombre, correo, tipo_usuario, hash_contrasena,
           verificacion_hash, verificacion_expira_en)
         VALUES ($1, $2, 'administrador', $3, $4, now() + interval '24 hours')`,
        [args.nombre, args.correo, hashContrasena, hashToken]
      );
      await cliente.query('COMMIT');
      const enlace = `${entorno.FRONTEND_URL}/verificar-correo?correo=${encodeURIComponent(args.correo)}&token=${encodeURIComponent(token)}`;
      logger.info({ enlace }, 'Administrador provisionado. Verifica el correo con este enlace');
      console.log('Administrador provisionado.');
      console.log(`Enlace de verificacion: ${enlace}`);
    } catch (error) {
      await cliente.query('ROLLBACK');
      throw error;
    } finally {
      await cliente.query('RESET ROLE');
      cliente.release();
    }
  } finally {
    await pool.end();
  }
}

void main().catch((error) => {
  console.error('Fallo el aprovisionamiento:', error instanceof Error ? error.message : error);
  process.exit(1);
});
