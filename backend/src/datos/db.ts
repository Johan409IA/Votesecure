import { Pool, type PoolClient } from 'pg';
import { ErrorConflicto, ErrorNegocio } from '../compartido/errores';

const ROL_API = 'votesecure_api';

export function crearPool(cadenaConexion: string): Pool {
  return new Pool({
    connectionString: cadenaConexion,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000
  });
}

let poolUnico: Pool | null = null;

export function obtenerPool(): Pool {
  if (!poolUnico) {
    const cadena = process.env['DATABASE_API_URL'];
    if (!cadena) {
      throw new Error('DATABASE_API_URL no esta configurada');
    }
    poolUnico = crearPool(cadena);
  }
  return poolUnico;
}

export async function cerrarPool(): Promise<void> {
  if (poolUnico) {
    await poolUnico.end();
    poolUnico = null;
  }
}

interface ErrorPg {
  code?: string;
  constraint?: string;
  message?: string;
}

const MENSAJES_RESTRICCION: Record<string, string> = {
  usuarios_correo_key: 'El correo ya esta registrado',
  secciones_codigo_curso_periodo_academico_codigo_key: 'La seccion ya existe',
  matriculas_seccion_id_estudiante_id_key: 'La matricula ya existe en la seccion',
  asignaciones_docentes_seccion_id_docente_id_key: 'La asignacion ya existe en la seccion',
  candidaturas_eleccion_id_matricula_id_key: 'La candidatura ya esta registrada',
  habilitaciones_voto_eleccion_id_matricula_id_key: 'La habilitacion ya esta registrada',
  elecciones_una_activa_por_seccion_idx: 'Ya existe una eleccion activa en la seccion',
  elecciones_una_principal_por_seccion_idx: 'La seccion ya tiene una eleccion principal'
};

function traducirErrorPg(error: unknown): unknown {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const err = error as ErrorPg;
    if (err.code === '23505') {
      const mensaje = err.constraint
        ? (MENSAJES_RESTRICCION[err.constraint] ?? 'Registro duplicado')
        : 'Registro duplicado';
      return new ErrorConflicto(mensaje);
    }
    if (err.code === '23503') return new ErrorNegocio('Referencia invalida');
    if (err.code === '23514' || err.code === '23502')
      return new ErrorNegocio('Los datos no cumplen las reglas del sistema');
    if (err.code === 'P0001')
      return new ErrorNegocio(err.message ?? 'Operacion no permitida');
  }
  return error;
}

export async function conTransaccion<T>(
  fn: (cliente: PoolClient) => Promise<T>,
  pool: Pool = obtenerPool()
): Promise<T> {
  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    await cliente.query(`SET ROLE ${ROL_API}`);
    let resultado: T;
    try {
      resultado = await fn(cliente);
      await cliente.query('COMMIT');
    } catch (error) {
      await cliente.query('ROLLBACK');
      throw traducirErrorPg(error);
    }
    return resultado;
  } finally {
    try {
      await cliente.query('RESET ROLE');
    } catch {
      /* la conexion se devuelve al pool de todas formas */
    }
    cliente.release();
  }
}
