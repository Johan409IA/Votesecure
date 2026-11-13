import type { PoolClient } from 'pg';
import { withTransaction, withClient } from '../db';
import { NotFoundError } from '../../shared/errors';

// F-012: tope maximo de las listas de lectura (mismo modelo que audit.repo).
const LIST_LIMIT = 500;

export type ElectionStatus =
  | 'borrador'
  | 'programada'
  | 'activa'
  | 'cerrada'
  | 'cancelada';

export type ElectionType = 'principal' | 'desempate' | 'repeticion';

export interface Election {
  id: number;
  sectionId: number;
  originElectionId: number | null;
  name: string;
  type: ElectionType;
  status: ElectionStatus;
  startsAt: Date;
  endsAt: Date;
  closedAt: Date | null;
  publishedAt: Date | null;
  createdByUserId: number;
  cancelledAt: Date | null;
  cancelledByUserId: number | null;
  cancellationReason: string | null;
  createdAt: Date;
}

interface ElectionRow {
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

function mapElection(row: ElectionRow): Election {
  return {
    id: Number(row.id),
    sectionId: Number(row.seccion_id),
    originElectionId: row.eleccion_origen_id ? Number(row.eleccion_origen_id) : null,
    name: row.nombre,
    type: row.tipo as ElectionType,
    status: row.estado as ElectionStatus,
    startsAt: row.inicia_en,
    endsAt: row.cierra_en,
    closedAt: row.cerrada_en,
    publishedAt: row.publicada_en,
    createdByUserId: Number(row.creada_por_usuario_id),
    cancelledAt: row.cancelada_en,
    cancelledByUserId: row.cancelada_por_usuario_id
      ? Number(row.cancelada_por_usuario_id)
      : null,
    cancellationReason: row.motivo_cancelacion,
    createdAt: row.creado_en
  };
}

const COLUMNS = `id, seccion_id, eleccion_origen_id, nombre, tipo, estado,
  inicia_en, cierra_en, cerrada_en, publicada_en, creada_por_usuario_id,
  cancelada_en, cancelada_por_usuario_id, motivo_cancelacion, creado_en`;

export interface NewElectionData {
  sectionId: number;
  name: string;
  startsAt: Date;
  endsAt: Date;
  createdByUserId: number;
  type?: 'principal' | 'desempate' | 'repeticion';
  originElectionId?: number;
  // Desempate asistido (§6.2): candidaturas a crear junto con la eleccion,
  // en la misma transaccion.
  candidacyEnrollmentIds?: number[];
}

export async function createElection(
  data: NewElectionData
): Promise<Election> {
  return withTransaction(async (client) => {
    const result = await client.query<ElectionRow>(
      `INSERT INTO elecciones
         (seccion_id, eleccion_origen_id, nombre, tipo, inicia_en, cierra_en,
          creada_por_usuario_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING ${COLUMNS}`,
      [
        data.sectionId,
        data.originElectionId ?? null,
        data.name,
        data.type ?? 'principal',
        data.startsAt,
        data.endsAt,
        data.createdByUserId
      ]
    );
    const election = mapElection(result.rows[0]!);
    for (const enrollmentId of data.candidacyEnrollmentIds ?? []) {
      await client.query(
        `INSERT INTO candidaturas (eleccion_id, seccion_id, matricula_id)
         VALUES ($1, $2, $3)`,
        [election.id, election.sectionId, enrollmentId]
      );
    }
    return election;
  });
}

export async function getElection(
  id: number,
  tx?: PoolClient
): Promise<Election | null> {
  return withClient(async (client) => {
    const result = await client.query<ElectionRow>(
      `SELECT ${COLUMNS} FROM elecciones WHERE id = $1`,
      [id]
    );
    const row = result.rows[0];
    return row ? mapElection(row) : null;
  }, tx);
}

export async function updateElection(
  id: number,
  changes: { name?: string; startsAt?: Date; endsAt?: Date }
): Promise<void> {
  await withTransaction(async (client) => {
    await client.query(
      `UPDATE elecciones
         SET nombre = coalesce($1, nombre),
             inicia_en = coalesce($2, inicia_en),
             cierra_en = coalesce($3, cierra_en)
       WHERE id = $4`,
      [changes.name ?? null, changes.startsAt ?? null, changes.endsAt ?? null, id]
    );
  });
}

export async function listElectionsBySection(
  sectionId: number
): Promise<Election[]> {
  return withTransaction(async (client) => {
    const result = await client.query<ElectionRow>(
      `SELECT ${COLUMNS} FROM elecciones
       WHERE seccion_id = $1 ORDER BY creado_en DESC
       LIMIT ${LIST_LIMIT}`,
      [sectionId]
    );
    return result.rows.map(mapElection);
  });
}

export interface Candidacy {
  id: number;
  electionId: number;
  enrollmentId: number;
  studentId: number;
  studentName: string;
  studentEmail: string;
}

interface CandidacyRow {
  id: string;
  eleccion_id: string;
  matricula_id: string;
  estudiante_id: string;
  nombre_estudiante: string;
  correo_estudiante: string;
}

function mapCandidacy(row: CandidacyRow): Candidacy {
  return {
    id: Number(row.id),
    electionId: Number(row.eleccion_id),
    enrollmentId: Number(row.matricula_id),
    studentId: Number(row.estudiante_id),
    studentName: row.nombre_estudiante,
    studentEmail: row.correo_estudiante
  };
}

const CANDIDACY_SELECT = `SELECT c.id, c.eleccion_id, c.matricula_id,
  m.estudiante_id, u.nombre AS nombre_estudiante, u.correo AS correo_estudiante
  FROM candidaturas c
  JOIN matriculas m ON m.id = c.matricula_id
  JOIN usuarios u ON u.id = m.estudiante_id`;

export async function addCandidacy(
  electionId: number,
  enrollmentId: number
): Promise<Candidacy> {
  return withTransaction(async (client) => {
    const election = await client.query<{ seccion_id: string }>(
      'SELECT seccion_id FROM elecciones WHERE id = $1',
      [electionId]
    );
    const sectionId = election.rows[0]?.seccion_id;
    if (!sectionId) throw new NotFoundError('Eleccion no encontrada');
    const result = await client.query<CandidacyRow>(
      `INSERT INTO candidaturas (eleccion_id, seccion_id, matricula_id)
       VALUES ($1, $2, $3)
       RETURNING id, eleccion_id, matricula_id,
         (SELECT estudiante_id FROM matriculas WHERE id = $3) AS estudiante_id,
         (SELECT u.nombre FROM matriculas m2 JOIN usuarios u ON u.id = m2.estudiante_id
           WHERE m2.id = $3) AS nombre_estudiante,
         (SELECT u.correo FROM matriculas m2 JOIN usuarios u ON u.id = m2.estudiante_id
           WHERE m2.id = $3) AS correo_estudiante`,
      [electionId, Number(sectionId), enrollmentId]
    );
    return mapCandidacy(result.rows[0]!);
  });
}

export async function removeCandidacy(
  electionId: number,
  candidacyId: number
): Promise<void> {
  await withTransaction(async (client) => {
    const result = await client.query(
      'DELETE FROM candidaturas WHERE id = $1 AND eleccion_id = $2',
      [candidacyId, electionId]
    );
    if (result.rowCount === 0) throw new NotFoundError('Candidatura no encontrada');
  });
}

export async function listCandidacies(
  electionId: number,
  tx?: PoolClient
): Promise<Candidacy[]> {
  return withClient(async (client) => {
    const result = await client.query<CandidacyRow>(
      `${CANDIDACY_SELECT} WHERE c.eleccion_id = $1 ORDER BY u.nombre
       LIMIT ${LIST_LIMIT}`,
      [electionId]
    );
    return result.rows.map(mapCandidacy);
  }, tx);
}

export interface Eligibility {
  id: number;
  electionId: number;
  enrollmentId: number;
  studentId: number;
  studentName: string;
  studentEmail: string;
  hasVoted: boolean;
}

interface EligibilityRow {
  id: string;
  eleccion_id: string;
  matricula_id: string;
  estudiante_id: string;
  nombre_estudiante: string;
  correo_estudiante: string;
  ha_votado: boolean;
}

function mapEligibility(row: EligibilityRow): Eligibility {
  return {
    id: Number(row.id),
    electionId: Number(row.eleccion_id),
    enrollmentId: Number(row.matricula_id),
    studentId: Number(row.estudiante_id),
    studentName: row.nombre_estudiante,
    studentEmail: row.correo_estudiante,
    hasVoted: row.ha_votado
  };
}

export async function addEligibility(
  electionId: number,
  enrollmentId: number
): Promise<Eligibility> {
  return withTransaction(async (client) => {
    const election = await client.query<{ seccion_id: string }>(
      'SELECT seccion_id FROM elecciones WHERE id = $1',
      [electionId]
    );
    const sectionId = election.rows[0]?.seccion_id;
    if (!sectionId) throw new NotFoundError('Eleccion no encontrada');
    const result = await client.query<EligibilityRow>(
      `INSERT INTO habilitaciones_voto (eleccion_id, seccion_id, matricula_id)
       VALUES ($1, $2, $3)
       RETURNING id, eleccion_id, matricula_id, ha_votado,
         (SELECT estudiante_id FROM matriculas WHERE id = $3) AS estudiante_id,
         (SELECT u.nombre FROM matriculas m2 JOIN usuarios u ON u.id = m2.estudiante_id
           WHERE m2.id = $3) AS nombre_estudiante,
         (SELECT u.correo FROM matriculas m2 JOIN usuarios u ON u.id = m2.estudiante_id
           WHERE m2.id = $3) AS correo_estudiante`,
      [electionId, Number(sectionId), enrollmentId]
    );
    return mapEligibility(result.rows[0]!);
  });
}

export async function removeEligibility(
  electionId: number,
  eligibilityId: number
): Promise<void> {
  await withTransaction(async (client) => {
    const result = await client.query(
      'DELETE FROM habilitaciones_voto WHERE id = $1 AND eleccion_id = $2',
      [eligibilityId, electionId]
    );
    if (result.rowCount === 0) throw new NotFoundError('Habilitacion no encontrada');
  });
}

export async function listEligibilities(
  electionId: number
): Promise<Eligibility[]> {
  return withTransaction(async (client) => {
    const result = await client.query<EligibilityRow>(
      `SELECT h.id, h.eleccion_id, h.matricula_id, h.ha_votado,
         m.estudiante_id, u.nombre AS nombre_estudiante, u.correo AS correo_estudiante
       FROM habilitaciones_voto h
       JOIN matriculas m ON m.id = h.matricula_id
       JOIN usuarios u ON u.id = m.estudiante_id
       WHERE h.eleccion_id = $1 ORDER BY u.nombre
       LIMIT ${LIST_LIMIT}`,
      [electionId]
    );
    return result.rows.map(mapEligibility);
  });
}

export async function schedule(
  electionId: number,
  userId: number
): Promise<void> {
  await withTransaction(async (client) => {
    await client.query('SELECT programar_eleccion($1, $2)', [electionId, userId]);
  });
}

export async function cancel(
  electionId: number,
  userId: number,
  reason: string
): Promise<void> {
  await withTransaction(async (client) => {
    await client.query('SELECT cancelar_eleccion($1, $2, $3)', [
      electionId,
      userId,
      reason
    ]);
  });
}

export async function activate(electionId: number): Promise<void> {
  await withTransaction(async (client) => {
    await client.query('SELECT activar_eleccion($1)', [electionId]);
  });
}

export async function closeAndPublish(
  electionId: number,
  early = false,
  tx?: PoolClient
): Promise<void> {
  await withClient(async (client) => {
    await client.query('SELECT cerrar_y_publicar_resultados($1, $2)', [electionId, early]);
  }, tx);
}

export interface DueTransitions {
  toActivate: Election[];
  toClose: Election[];
}

// F-018: una sola consulta con ambas transiciones pendientes del planificador
// (antes eran dos consultas por ciclo, sin LIMIT).
export async function listDueTransitions(): Promise<DueTransitions> {
  return withTransaction(async (client) => {
    const result = await client.query<ElectionRow & { accion: string }>(
      `SELECT ${COLUMNS},
              CASE WHEN estado = 'programada' THEN 'activar' ELSE 'cerrar' END AS accion
       FROM elecciones
       WHERE (estado = 'programada' AND inicia_en <= now() AND cierra_en > now())
          OR (estado = 'activa' AND cierra_en <= now())
       ORDER BY creado_en
       LIMIT ${LIST_LIMIT}`
    );
    const toActivate: Election[] = [];
    const toClose: Election[] = [];
    for (const row of result.rows) {
      (row.accion === 'activar' ? toActivate : toClose).push(mapElection(row));
    }
    return { toActivate, toClose };
  });
}

export async function listActiveByStudent(studentId: number): Promise<Election[]> {
  return withTransaction(async (client) => {
    // F-007: elecciones activas de todas las secciones del estudiante en una
    // sola consulta (antes habia una consulta por matricula).
    const result = await client.query<ElectionRow>(
      `SELECT e.* FROM elecciones e
       JOIN matriculas m ON m.seccion_id = e.seccion_id
       WHERE m.estudiante_id = $1 AND m.activa AND e.estado = 'activa'
       ORDER BY e.creado_en DESC
       LIMIT ${LIST_LIMIT}`,
      [studentId]
    );
    return result.rows.map(mapElection);
  });
}

export async function registerDelegation(
  electionId: number,
  sectionId: number,
  candidacyId: number,
  startsAt: Date,
  endsAt: Date | null
): Promise<number> {
  return withTransaction(async (client) => {
    const result = await client.query<{ id: string }>(
      `INSERT INTO delegaciones (eleccion_id, seccion_id, candidatura_id, inicia_en, termina_en)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [electionId, sectionId, candidacyId, startsAt, endsAt]
    );
    return Number(result.rows[0]?.id);
  });
}

export async function createEvaluationPeriod(
  delegationId: number,
  sectionId: number,
  opensAt: Date,
  closesAt: Date,
  instructions: string
): Promise<number> {
  return withTransaction(async (client) => {
    const result = await client.query<{ id: string }>(
      `INSERT INTO periodos_evaluacion
         (delegacion_id, seccion_id, abre_en, cierra_en, instrucciones)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [delegationId, sectionId, opensAt, closesAt, instructions]
    );
    return Number(result.rows[0]?.id);
  });
}
