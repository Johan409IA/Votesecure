import { withTransaction } from '../db';

export interface Delegation {
  id: number;
  electionId: number;
  sectionId: number;
  candidacyId: number;
  delegateName: string;
  startsAt: Date;
  endsAt: Date | null;
}

export interface EvaluationPeriod {
  id: number;
  delegationId: number;
  sectionId: number;
  opensAt: Date;
  closesAt: Date;
}

interface DelegationRow {
  id: string;
  eleccion_id: string;
  seccion_id: string;
  candidatura_id: string;
  nombre_delegado: string;
  inicia_en: Date;
  termina_en: Date | null;
}

interface PeriodRow {
  id: string;
  delegacion_id: string;
  seccion_id: string;
  abre_en: Date;
  cierra_en: Date;
}

function mapDelegation(row: DelegationRow): Delegation {
  return {
    id: Number(row.id),
    electionId: Number(row.eleccion_id),
    sectionId: Number(row.seccion_id),
    candidacyId: Number(row.candidatura_id),
    delegateName: row.nombre_delegado,
    startsAt: row.inicia_en,
    endsAt: row.termina_en
  };
}

export async function getDelegation(
  delegationId: number
): Promise<Delegation | null> {
  return withTransaction(async (client) => {
    const result = await client.query<DelegationRow>(
      `SELECT d.id, d.eleccion_id, d.seccion_id, d.candidatura_id,
              u.nombre AS nombre_delegado, d.inicia_en, d.termina_en
       FROM delegaciones d
       JOIN candidaturas c ON c.id = d.candidatura_id
       JOIN matriculas m ON m.id = c.matricula_id
       JOIN usuarios u ON u.id = m.estudiante_id
       WHERE d.id = $1`,
      [delegationId]
    );
    const row = result.rows[0];
    return row ? mapDelegation(row) : null;
  });
}

export async function currentDelegationBySection(
  sectionId: number
): Promise<Delegation | null> {
  return withTransaction(async (client) => {
    const result = await client.query<DelegationRow>(
      `SELECT d.id, d.eleccion_id, d.seccion_id, d.candidatura_id,
              u.nombre AS nombre_delegado, d.inicia_en, d.termina_en
       FROM delegaciones d
       JOIN candidaturas c ON c.id = d.candidatura_id
       JOIN matriculas m ON m.id = c.matricula_id
       JOIN usuarios u ON u.id = m.estudiante_id
       WHERE d.seccion_id = $1
         AND (d.termina_en IS NULL OR d.termina_en > now())
       ORDER BY d.inicia_en DESC
       LIMIT 1`,
      [sectionId]
    );
    const row = result.rows[0];
    return row ? mapDelegation(row) : null;
  });
}

export async function currentPeriodByDelegation(
  delegationId: number
): Promise<EvaluationPeriod | null> {
  return withTransaction(async (client) => {
    const result = await client.query<PeriodRow>(
      `SELECT id, delegacion_id, seccion_id, abre_en, cierra_en
       FROM periodos_evaluacion
       WHERE delegacion_id = $1 AND abre_en <= now() AND cierra_en > now()
       ORDER BY cierra_en DESC LIMIT 1`,
      [delegationId]
    );
    const row = result.rows[0];
    return row
      ? {
          id: Number(row.id),
          delegationId: Number(row.delegacion_id),
          sectionId: Number(row.seccion_id),
          opensAt: row.abre_en,
          closesAt: row.cierra_en
        }
      : null;
  });
}

export async function getEnrollmentId(
  sectionId: number,
  studentId: number
): Promise<number | null> {
  return withTransaction(async (client) => {
    const result = await client.query<{ id: string }>(
      `SELECT id FROM matriculas
       WHERE seccion_id = $1 AND estudiante_id = $2 AND activa`,
      [sectionId, studentId]
    );
    const id = result.rows[0]?.id;
    return id ? Number(id) : null;
  });
}

export async function getAssignmentId(
  sectionId: number,
  teacherId: number
): Promise<number | null> {
  return withTransaction(async (client) => {
    const result = await client.query<{ id: string }>(
      `SELECT id FROM asignaciones_docentes
       WHERE seccion_id = $1 AND docente_id = $2 AND activa`,
      [sectionId, teacherId]
    );
    const id = result.rows[0]?.id;
    return id ? Number(id) : null;
  });
}

export async function registerStudentEvaluation(
  periodId: number,
  enrollmentId: number,
  grade: number,
  comment: string | null
): Promise<void> {
  await withTransaction(async (client) => {
    await client.query(
      `INSERT INTO evaluaciones_estudiantes
         (periodo_evaluacion_id, seccion_id, matricula_id, calificacion, comentario)
       VALUES ($1,
               (SELECT seccion_id FROM periodos_evaluacion WHERE id = $1),
               $2, $3, $4)
       ON CONFLICT (periodo_evaluacion_id, matricula_id)
       DO UPDATE SET calificacion = EXCLUDED.calificacion,
                     comentario = EXCLUDED.comentario`,
      [periodId, enrollmentId, grade, comment]
    );
  });
}

export async function registerTeacherEvaluation(
  periodId: number,
  assignmentId: number,
  grade: number,
  comment: string
): Promise<void> {
  await withTransaction(async (client) => {
    await client.query(
      `INSERT INTO evaluaciones_docentes
         (periodo_evaluacion_id, seccion_id, asignacion_docente_id, calificacion, comentario)
       VALUES ($1,
               (SELECT seccion_id FROM periodos_evaluacion WHERE id = $1),
               $2, $3, $4)
       ON CONFLICT (periodo_evaluacion_id, asignacion_docente_id)
       DO UPDATE SET calificacion = EXCLUDED.calificacion,
                     comentario = EXCLUDED.comentario`,
      [periodId, assignmentId, grade, comment]
    );
  });
}

export interface EvaluationSummary {
  delegationId: number;
  delegateName: string;
  periodId: number | null;
  studentAverage: number | null;
  totalStudentEvaluations: number;
  teacherAverage: number | null;
  totalTeacherRatings: number;
  teacherComments: Array<{ grade: number; comment: string }>;
}

export async function summaryByDelegation(
  delegation: Delegation
): Promise<EvaluationSummary> {
  return withTransaction(async (client) => {
    const period = await client.query<PeriodRow>(
      `SELECT id, delegacion_id, seccion_id, abre_en, cierra_en
       FROM periodos_evaluacion WHERE delegacion_id = $1
       ORDER BY cierra_en DESC LIMIT 1`,
      [delegation.id]
    );
    const periodRow = period.rows[0];
    const periodId = periodRow ? Number(periodRow.id) : null;

    const students = await client.query<{ promedio: string | null; total: string }>(
      `SELECT round(avg(calificacion), 2) AS promedio, count(*) AS total
       FROM evaluaciones_estudiantes WHERE periodo_evaluacion_id = $1`,
      [periodId]
    );
    const teachers = await client.query<{ promedio: string | null; total: string }>(
      `SELECT round(avg(calificacion), 2) AS promedio, count(*) AS total
       FROM evaluaciones_docentes WHERE periodo_evaluacion_id = $1`,
      [periodId]
    );
    const comments = await client.query<{
      calificacion: number;
      comentario: string;
    }>(
      `SELECT calificacion, comentario FROM evaluaciones_docentes
       WHERE periodo_evaluacion_id = $1 ORDER BY id`,
      [periodId]
    );

    const studentRow = students.rows[0];
    const teacherRow = teachers.rows[0];
    return {
      delegationId: delegation.id,
      delegateName: delegation.delegateName,
      periodId,
      studentAverage: studentRow?.promedio ? Number(studentRow.promedio) : null,
      totalStudentEvaluations: Number(studentRow?.total ?? 0),
      teacherAverage: teacherRow?.promedio ? Number(teacherRow.promedio) : null,
      totalTeacherRatings: Number(teacherRow?.total ?? 0),
      teacherComments: comments.rows.map((row) => ({
        grade: Number(row.calificacion),
        comment: row.comentario
      }))
    };
  });
}
