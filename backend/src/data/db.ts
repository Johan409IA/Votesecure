import { Pool, type PoolClient } from 'pg';
import { ConflictError, BusinessError } from '../shared/errors';

// Cliente transaccional expuesto a las capas superiores sin importar 'pg'.
export type TxClient = PoolClient;

const API_ROLE = 'votesecure_api';
const DEFAULT_STATEMENT_TIMEOUT_MS = 10_000;
const LOCK_TIMEOUT_MS = 3_000;

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
  evaluaciones_estudiantes_periodo_evaluacion_id_matricula_id_key:
    'Ya enviaste tu evaluacion en este periodo',
  evaluaciones_docentes_periodo_evaluacion_id_asignacion_docente_id_key:
    'Ya enviaste tu evaluacion en este periodo',
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

// F-008: toda operacion corre con statement_timeout y lock_timeout. Los
// valores son SET LOCAL, por lo que se revierten solos al terminar la
// transaccion y no afectan a otras conexiones del pool.
function statementTimeoutMs(): number {
  const raw = process.env['STATEMENT_TIMEOUT_MS'];
  const value = raw === undefined || raw.trim() === '' ? NaN : Number(raw);
  return Number.isInteger(value) && value > 0 ? value : DEFAULT_STATEMENT_TIMEOUT_MS;
}

// BEGIN, el rol del API y los timeouts viajan en un solo viaje (F-005):
// tres viajes por operacion (apertura, consulta, confirmacion) frente a los
// cinco anteriores. SET LOCAL ROLE se revierte solo con COMMIT/ROLLBACK, asi
// que nunca queda un rol aplicado en una conexion devuelta al pool (F-006),
// ni siquiera con PgBouncer en modo transaccion.
function beginSql(): string {
  return `BEGIN; SET LOCAL ROLE ${API_ROLE}; SET LOCAL statement_timeout = '${statementTimeoutMs()}ms'; SET LOCAL lock_timeout = '${LOCK_TIMEOUT_MS}ms'`;
}

export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>,
  pool: Pool = getPool()
): Promise<T> {
  const client = await pool.connect();
  let clean = false;
  try {
    await client.query(beginSql());
    const result = await fn(client);
    await client.query('COMMIT');
    clean = true;
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw translatePgError(error);
  } finally {
    // F-006: pg no hace rollback implicito al liberar. Si algo fallo, la
    // conexion se destruye en lugar de volver al pool con la transaccion o el
    // rol pendientes.
    if (clean) {
      client.release();
    } else {
      client.release(new Error('conexion descartada: operacion incompleta'));
    }
  }
}

// Compone varias operaciones en una sola transaccion (F-005): si ya viene un
// cliente transaccional se reutiliza; si no, se abre uno nuevo.
export function withClient<T>(
  fn: (client: PoolClient) => Promise<T>,
  client?: PoolClient
): Promise<T> {
  return client ? fn(client) : withTransaction(fn);
}
