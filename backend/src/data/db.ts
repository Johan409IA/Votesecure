import { Pool, type PoolClient } from 'pg';
import { ConflictError, BusinessError } from '../shared/errors';

const API_ROLE = 'votesecure_api';

export function createPool(connectionString: string): Pool {
  return new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000
  });
}

let singlePool: Pool | null = null;

export function getPool(): Pool {
  if (!singlePool) {
    const connectionString = process.env['DATABASE_API_URL'];
    if (!connectionString) {
      throw new Error('DATABASE_API_URL no esta configurada');
    }
    singlePool = createPool(connectionString);
  }
  return singlePool;
}

export async function closePool(): Promise<void> {
  if (singlePool) {
    await singlePool.end();
    singlePool = null;
  }
}

interface PgError {
  code?: string;
  constraint?: string;
  message?: string;
}

const CONSTRAINT_MESSAGES: Record<string, string> = {
  usuarios_correo_key: 'El correo ya esta registrado',
  secciones_codigo_curso_periodo_academico_codigo_key: 'La seccion ya existe',
  matriculas_seccion_id_estudiante_id_key: 'La matricula ya existe en la seccion',
  asignaciones_docentes_seccion_id_docente_id_key: 'La asignacion ya existe en la seccion',
  candidaturas_eleccion_id_matricula_id_key: 'La candidatura ya esta registrada',
  habilitaciones_voto_eleccion_id_matricula_id_key: 'La habilitacion ya esta registrada',
  elecciones_una_activa_por_seccion_idx: 'Ya existe una eleccion activa en la seccion',
  elecciones_una_principal_por_seccion_idx: 'La seccion ya tiene una eleccion principal'
};

function translatePgError(error: unknown): unknown {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const err = error as PgError;
    if (err.code === '23505') {
      const message = err.constraint
        ? (CONSTRAINT_MESSAGES[err.constraint] ?? 'Registro duplicado')
        : 'Registro duplicado';
      return new ConflictError(message);
    }
    if (err.code === '23503') return new BusinessError('Referencia invalida');
    if (err.code === '23514' || err.code === '23502')
      return new BusinessError('Los datos no cumplen las reglas del sistema');
    if (err.code === 'P0001')
      return new BusinessError(err.message ?? 'Operacion no permitida');
  }
  return error;
}

export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>,
  pool: Pool = getPool()
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SET ROLE ${API_ROLE}`);
    let result: T;
    try {
      result = await fn(client);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw translatePgError(error);
    }
    return result;
  } finally {
    try {
      await client.query('RESET ROLE');
    } catch {
      /* la conexion se devuelve al pool de todas formas */
    }
    client.release();
  }
}
