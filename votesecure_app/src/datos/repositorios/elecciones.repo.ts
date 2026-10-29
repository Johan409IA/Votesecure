import { conTransaccion } from '../db';
import { ErrorNoEncontrado } from '../../compartido/errores';

export type EstadoEleccion =
  | 'borrador'
  | 'programada'
  | 'activa'
  | 'cerrada'
  | 'cancelada';

export type TipoEleccion = 'principal' | 'desempate' | 'repeticion';

export interface Eleccion {
  id: number;
  seccionId: number;
  eleccionOrigenId: number | null;
  nombre: string;
  tipo: TipoEleccion;
  estado: EstadoEleccion;
  iniciaEn: Date;
  cierraEn: Date;
  cerradaEn: Date | null;
  publicadaEn: Date | null;
  creadaPorUsuarioId: number;
  canceladaEn: Date | null;
  canceladaPorUsuarioId: number | null;
  motivoCancelacion: string | null;
  creadoEn: Date;
}

interface FilaEleccion {
  id: string;
  seccion_id: string;
  eleccion_origen_id: string | null;
  nombre: string;
  tipo: string;
  estado: string;
  inicia_en: Date;
  cierra_en: Date;
  cerrada_en: Date | null;
  publicada_en: Date | null;
  creada_por_usuario_id: string;
  cancelada_en: Date | null;
  cancelada_por_usuario_id: string | null;
  motivo_cancelacion: string | null;
  creado_en: Date;
}

function mapear(f: FilaEleccion): Eleccion {
  return {
    id: Number(f.id),
    seccionId: Number(f.seccion_id),
    eleccionOrigenId: f.eleccion_origen_id ? Number(f.eleccion_origen_id) : null,
    nombre: f.nombre,
    tipo: f.tipo as TipoEleccion,
    estado: f.estado as EstadoEleccion,
    iniciaEn: f.inicia_en,
    cierraEn: f.cierra_en,
    cerradaEn: f.cerrada_en,
    publicadaEn: f.publicada_en,
    creadaPorUsuarioId: Number(f.creada_por_usuario_id),
    canceladaEn: f.cancelada_en,
    canceladaPorUsuarioId: f.cancelada_por_usuario_id
      ? Number(f.cancelada_por_usuario_id)
      : null,
    motivoCancelacion: f.motivo_cancelacion,
    creadoEn: f.creado_en
  };
}

const COLUMNAS = `id, seccion_id, eleccion_origen_id, nombre, tipo, estado,
  inicia_en, cierra_en, cerrada_en, publicada_en, creada_por_usuario_id,
  cancelada_en, cancelada_por_usuario_id, motivo_cancelacion, creado_en`;

export interface DatosNuevaEleccion {
  seccionId: number;
  nombre: string;
  iniciaEn: Date;
  cierraEn: Date;
  creadaPorUsuarioId: number;
  tipo?: 'principal' | 'desempate' | 'repeticion';
  eleccionOrigenId?: number;
}

export async function crearEleccion(
  datos: DatosNuevaEleccion
): Promise<Eleccion> {
  return conTransaccion(async (cliente) => {
    const r = await cliente.query<FilaEleccion>(
      `INSERT INTO elecciones
         (seccion_id, eleccion_origen_id, nombre, tipo, inicia_en, cierra_en,
          creada_por_usuario_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING ${COLUMNAS}`,
      [
        datos.seccionId,
        datos.eleccionOrigenId ?? null,
        datos.nombre,
        datos.tipo ?? 'principal',
        datos.iniciaEn,
        datos.cierraEn,
        datos.creadaPorUsuarioId
      ]
    );
    return mapear(r.rows[0]!);
  });
}

export async function obtenerEleccion(id: number): Promise<Eleccion | null> {
  return conTransaccion(async (cliente) => {
    const r = await cliente.query<FilaEleccion>(
      `SELECT ${COLUMNAS} FROM elecciones WHERE id = $1`,
      [id]
    );
    const fila = r.rows[0];
    return fila ? mapear(fila) : null;
  });
}

export async function actualizarEleccion(
  id: number,
  cambios: { nombre?: string; iniciaEn?: Date; cierraEn?: Date }
): Promise<void> {
  await conTransaccion(async (cliente) => {
    await cliente.query(
      `UPDATE elecciones
         SET nombre = coalesce($1, nombre),
             inicia_en = coalesce($2, inicia_en),
             cierra_en = coalesce($3, cierra_en)
       WHERE id = $4`,
      [cambios.nombre ?? null, cambios.iniciaEn ?? null, cambios.cierraEn ?? null, id]
    );
  });
}

export async function listarEleccionesPorSeccion(
  seccionId: number
): Promise<Eleccion[]> {
  return conTransaccion(async (cliente) => {
    const r = await cliente.query<FilaEleccion>(
      `SELECT ${COLUMNAS} FROM elecciones
       WHERE seccion_id = $1 ORDER BY creado_en DESC`,
      [seccionId]
    );
    return r.rows.map(mapear);
  });
}

export interface Candidatura {
  id: number;
  eleccionId: number;
  matriculaId: number;
  estudianteId: number;
  nombreEstudiante: string;
  correoEstudiante: string;
}

interface FilaCandidatura {
  id: string;
  eleccion_id: string;
  matricula_id: string;
  estudiante_id: string;
  nombre_estudiante: string;
  correo_estudiante: string;
}

function mapearCandidatura(f: FilaCandidatura): Candidatura {
  return {
    id: Number(f.id),
    eleccionId: Number(f.eleccion_id),
    matriculaId: Number(f.matricula_id),
    estudianteId: Number(f.estudiante_id),
    nombreEstudiante: f.nombre_estudiante,
    correoEstudiante: f.correo_estudiante
  };
}

const SELECT_CANDIDATURA = `SELECT c.id, c.eleccion_id, c.matricula_id,
  m.estudiante_id, u.nombre AS nombre_estudiante, u.correo AS correo_estudiante
  FROM candidaturas c
  JOIN matriculas m ON m.id = c.matricula_id
  JOIN usuarios u ON u.id = m.estudiante_id`;

export async function agregarCandidatura(
  eleccionId: number,
  matriculaId: number
): Promise<Candidatura> {
  return conTransaccion(async (cliente) => {
    const eleccion = await cliente.query<{ seccion_id: string }>(
      'SELECT seccion_id FROM elecciones WHERE id = $1',
      [eleccionId]
    );
    const seccionId = eleccion.rows[0]?.seccion_id;
    if (!seccionId) throw new ErrorNoEncontrado('Eleccion no encontrada');
    const r = await cliente.query<FilaCandidatura>(
      `INSERT INTO candidaturas (eleccion_id, seccion_id, matricula_id)
       VALUES ($1, $2, $3)
       RETURNING id, eleccion_id, matricula_id,
         (SELECT estudiante_id FROM matriculas WHERE id = $3) AS estudiante_id,
         (SELECT u.nombre FROM matriculas m2 JOIN usuarios u ON u.id = m2.estudiante_id
           WHERE m2.id = $3) AS nombre_estudiante,
         (SELECT u.correo FROM matriculas m2 JOIN usuarios u ON u.id = m2.estudiante_id
           WHERE m2.id = $3) AS correo_estudiante`,
      [eleccionId, Number(seccionId), matriculaId]
    );
    return mapearCandidatura(r.rows[0]!);
  });
}

export async function quitarCandidatura(
  eleccionId: number,
  candidaturaId: number
): Promise<void> {
  await conTransaccion(async (cliente) => {
    const r = await cliente.query(
      'DELETE FROM candidaturas WHERE id = $1 AND eleccion_id = $2',
      [candidaturaId, eleccionId]
    );
    if (r.rowCount === 0) throw new ErrorNoEncontrado('Candidatura no encontrada');
  });
}

export async function listarCandidaturas(
  eleccionId: number
): Promise<Candidatura[]> {
  return conTransaccion(async (cliente) => {
    const r = await cliente.query<FilaCandidatura>(
      `${SELECT_CANDIDATURA} WHERE c.eleccion_id = $1 ORDER BY u.nombre`,
      [eleccionId]
    );
    return r.rows.map(mapearCandidatura);
  });
}

export interface Habilitacion {
  id: number;
  eleccionId: number;
  matriculaId: number;
  estudianteId: number;
  nombreEstudiante: string;
  correoEstudiante: string;
  haVotado: boolean;
}

interface FilaHabilitacion {
  id: string;
  eleccion_id: string;
  matricula_id: string;
  estudiante_id: string;
  nombre_estudiante: string;
  correo_estudiante: string;
  ha_votado: boolean;
}

function mapearHabilitacion(f: FilaHabilitacion): Habilitacion {
  return {
    id: Number(f.id),
    eleccionId: Number(f.eleccion_id),
    matriculaId: Number(f.matricula_id),
    estudianteId: Number(f.estudiante_id),
    nombreEstudiante: f.nombre_estudiante,
    correoEstudiante: f.correo_estudiante,
    haVotado: f.ha_votado
  };
}

export async function agregarHabilitacion(
  eleccionId: number,
  matriculaId: number
): Promise<Habilitacion> {
  return conTransaccion(async (cliente) => {
    const eleccion = await cliente.query<{ seccion_id: string }>(
      'SELECT seccion_id FROM elecciones WHERE id = $1',
      [eleccionId]
    );
    const seccionId = eleccion.rows[0]?.seccion_id;
    if (!seccionId) throw new ErrorNoEncontrado('Eleccion no encontrada');
    const r = await cliente.query<FilaHabilitacion>(
      `INSERT INTO habilitaciones_voto (eleccion_id, seccion_id, matricula_id)
       VALUES ($1, $2, $3)
       RETURNING id, eleccion_id, matricula_id, ha_votado,
         (SELECT estudiante_id FROM matriculas WHERE id = $3) AS estudiante_id,
         (SELECT u.nombre FROM matriculas m2 JOIN usuarios u ON u.id = m2.estudiante_id
           WHERE m2.id = $3) AS nombre_estudiante,
         (SELECT u.correo FROM matriculas m2 JOIN usuarios u ON u.id = m2.estudiante_id
           WHERE m2.id = $3) AS correo_estudiante`,
      [eleccionId, Number(seccionId), matriculaId]
    );
    return mapearHabilitacion(r.rows[0]!);
  });
}

export async function quitarHabilitacion(
  eleccionId: number,
  habilitacionId: number
): Promise<void> {
  await conTransaccion(async (cliente) => {
    const r = await cliente.query(
      'DELETE FROM habilitaciones_voto WHERE id = $1 AND eleccion_id = $2',
      [habilitacionId, eleccionId]
    );
    if (r.rowCount === 0) throw new ErrorNoEncontrado('Habilitacion no encontrada');
  });
}

export async function listarHabilitaciones(
  eleccionId: number
): Promise<Habilitacion[]> {
  return conTransaccion(async (cliente) => {
    const r = await cliente.query<FilaHabilitacion>(
      `SELECT h.id, h.eleccion_id, h.matricula_id, h.ha_votado,
         m.estudiante_id, u.nombre AS nombre_estudiante, u.correo AS correo_estudiante
       FROM habilitaciones_voto h
       JOIN matriculas m ON m.id = h.matricula_id
       JOIN usuarios u ON u.id = m.estudiante_id
       WHERE h.eleccion_id = $1 ORDER BY u.nombre`,
      [eleccionId]
    );
    return r.rows.map(mapearHabilitacion);
  });
}

export async function programar(
  eleccionId: number,
  usuarioId: number
): Promise<void> {
  await conTransaccion(async (cliente) => {
    await cliente.query('SELECT programar_eleccion($1, $2)', [eleccionId, usuarioId]);
  });
}

export async function cancelar(
  eleccionId: number,
  usuarioId: number,
  motivo: string
): Promise<void> {
  await conTransaccion(async (cliente) => {
    await cliente.query('SELECT cancelar_eleccion($1, $2, $3)', [
      eleccionId,
      usuarioId,
      motivo
    ]);
  });
}

export async function activar(eleccionId: number): Promise<void> {
  await conTransaccion(async (cliente) => {
    await cliente.query('SELECT activar_eleccion($1)', [eleccionId]);
  });
}

export async function cerrarYPublicar(eleccionId: number): Promise<void> {
  await conTransaccion(async (cliente) => {
    await cliente.query('SELECT cerrar_y_publicar_resultados($1)', [eleccionId]);
  });
}

export async function listarProgramadasParaActivar(): Promise<Eleccion[]> {
  return conTransaccion(async (cliente) => {
    const r = await cliente.query<FilaEleccion>(
      `SELECT ${COLUMNAS} FROM elecciones
       WHERE estado = 'programada' AND inicia_en <= now() AND cierra_en > now()`
    );
    return r.rows.map(mapear);
  });
}

export async function listarActivasParaCerrar(): Promise<Eleccion[]> {
  return conTransaccion(async (cliente) => {
    const r = await cliente.query<FilaEleccion>(
      `SELECT ${COLUMNAS} FROM elecciones
       WHERE estado = 'activa' AND cierra_en <= now()`
    );
    return r.rows.map(mapear);
  });
}

export async function listarActivasPorSeccion(
  seccionId: number
): Promise<Eleccion[]> {
  return conTransaccion(async (cliente) => {
    const r = await cliente.query<FilaEleccion>(
      `SELECT ${COLUMNAS} FROM elecciones
       WHERE seccion_id = $1 AND estado = 'activa'`,
      [seccionId]
    );
    return r.rows.map(mapear);
  });
}

export async function registrarDelegacion(
  eleccionId: number,
  seccionId: number,
  candidaturaId: number,
  iniciaEn: Date,
  terminaEn: Date | null
): Promise<number> {
  return conTransaccion(async (cliente) => {
    const r = await cliente.query<{ id: string }>(
      `INSERT INTO delegaciones (eleccion_id, seccion_id, candidatura_id, inicia_en, termina_en)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [eleccionId, seccionId, candidaturaId, iniciaEn, terminaEn]
    );
    return Number(r.rows[0]?.id);
  });
}

export async function crearPeriodoEvaluacion(
  delegacionId: number,
  seccionId: number,
  abreEn: Date,
  cierraEn: Date
): Promise<number> {
  return conTransaccion(async (cliente) => {
    const r = await cliente.query<{ id: string }>(
      `INSERT INTO periodos_evaluacion (delegacion_id, seccion_id, abre_en, cierra_en)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [delegacionId, seccionId, abreEn, cierraEn]
    );
    return Number(r.rows[0]?.id);
  });
}
