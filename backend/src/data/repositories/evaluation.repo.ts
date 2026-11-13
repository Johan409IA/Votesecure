import { withTransaction } from '../db';

export interface Delegation {
  id: number;
  electionId: number;
  sectionId: number;
  candidacyId: number;
  delegateStudentId: number;
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
  instructions: string;
}

interface DelegationRow {
  id: string;
  eleccion_id: string;
  seccion_id: string;
  candidatura_id: string;
  estudiante_id: string;
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
  instrucciones: string;
}

function mapDelegation(row: DelegationRow): Delegation {
  return {
    id: Number(row.id),
    electionId: Number(row.eleccion_id),
    sectionId: Number(row.seccion_id),
    candidacyId: Number(row.candidatura_id),
    delegateStudentId: Number(row.estudiante_id),
    delegateName: row.nombre_delegado,
    startsAt: row.inicia_en,
    endsAt: row.termina_en
  };
}

function mapPeriod(row: PeriodRow): EvaluationPeriod {
  return {
    id: Number(row.id),
    delegationId: Number(row.delegacion_id),
    sectionId: Number(row.seccion_id),
    opensAt: row.abre_en,
    closesAt: row.cierra_en,
    instructions: row.instrucciones
  };
}

const DELEGATION_SELECT = `SELECT d.id, d.eleccion_id, d.seccion_id, d.candidatura_id,
      m.estudiante_id, u.nombre AS nombre_delegado, d.inicia_en, d.termina_en
   FROM delegaciones d
   JOIN candidaturas c ON c.id = d.candidatura_id
   JOIN matriculas m ON m.id = c.matricula_id
   JOIN usuarios u ON u.id = m.estudiante_id`;

export async function getDelegation(
  delegationId: number
): Promise<Delegation | null> {
  return withTransaction(async (client) => {
    const result = await client.query<DelegationRow>(
      `${DELEGATION_SELECT} WHERE d.id = $1`,
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
      `${DELEGATION_SELECT}
       WHERE d.seccion_id = $1
         AND d.inicia_en <= now()
         AND (d.termina_en IS NULL OR d.termina_en > now())
       ORDER BY d.inicia_en DESC
       LIMIT 1`,
      [sectionId]
    );
    const row = result.rows[0];
    return row ? mapDelegation(row) : null;
  });
}

const PERIOD_SELECT = `SELECT id, delegacion_id, seccion_id, abre_en, cierra_en,
      instrucciones
   FROM periodos_evaluacion`;

export async function currentPeriodByDelegation(
  delegationId: number
): Promise<EvaluationPeriod | null> {
  return withTransaction(async (client) => {
    const result = await client.query<PeriodRow>(
      `${PERIOD_SELECT}
       WHERE delegacion_id = $1 AND abre_en <= now() AND cierra_en > now()
       ORDER BY cierra_en DESC LIMIT 1`,
      [delegationId]
    );
    const row = result.rows[0];
    return row ? mapPeriod(row) : null;
  });
}

export async function listPeriodsByDelegation(
  delegationId: number
): Promise<EvaluationPeriod[]> {
  return withTransaction(async (client) => {
    const result = await client.query<PeriodRow>(
      `${PERIOD_SELECT} WHERE delegacion_id = $1 ORDER BY abre_en`,
      [delegationId]
    );
    return result.rows.map(mapPeriod);
  });
}

export async function getPeriodById(
  periodId: number
): Promise<EvaluationPeriod | null> {
  return withTransaction(async (client) => {
    const result = await client.query<PeriodRow>(
      `${PERIOD_SELECT} WHERE id = $1`,
      [periodId]
    );
    const row = result.rows[0];
    return row ? mapPeriod(row) : null;
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
    // §7.1: envio unico por periodo; un segundo intento choca con el UNIQUE
    // (periodo_evaluacion_id, matricula_id) y se traduce a 409.
    await client.query(
      `INSERT INTO evaluaciones_estudiantes
         (periodo_evaluacion_id, seccion_id, matricula_id, calificacion, comentario)
       VALUES ($1,
               (SELECT seccion_id FROM periodos_evaluacion WHERE id = $1),
               $2, $3, $4)`,
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
    // §7.1: envio unico por periodo; un segundo intento choca con el UNIQUE
    // (periodo_evaluacion_id, asignacion_docente_id) y se traduce a 409.
    await client.query(
      `INSERT INTO evaluaciones_docentes
         (periodo_evaluacion_id, seccion_id, asignacion_docente_id, calificacion, comentario)
       VALUES ($1,
               (SELECT seccion_id FROM periodos_evaluacion WHERE id = $1),
               $2, $3, $4)`,
      [periodId, assignmentId, grade, comment]
    );
  });
}

export interface PeriodSummary {
  periodId: number;
  opensAt: Date;
  closesAt: Date;
  instructions: string;
  studentAverage: number | null;
  totalStudentEvaluations: number;
  studentComments: string[];
  teacherAverage: number | null;
  totalTeacherRatings: number;
  teacherComments: Array<{ grade: number; comment: string }>;
}

export interface EvaluationSummary {
  delegationId: number;
  delegateName: string;
  periodos: PeriodSummary[];
  global: {
    studentAverage: number | null;
    totalStudentEvaluations: number;
    teacherAverage: number | null;
    totalTeacherRatings: number;
  };
}

// §7.2: el delegado solo consulta su promedio general, nunca evaluadores
// individuales. Media aritmetica de las evaluaciones estudiantiles (§7.1).
export async function studentAverageByDelegation(
  delegationId: number
): Promise<number | null> {
  return withTransaction(async (client) => {
    const result = await client.query<{ promedio: string | null }>(
      `SELECT round(avg(e.calificacion), 2) AS promedio
       FROM evaluaciones_estudiantes e
       JOIN periodos_evaluacion p ON p.id = e.periodo_evaluacion_id
       WHERE p.delegacion_id = $1`,
      [delegationId]
    );
    const promedio = result.rows[0]?.promedio;
    return promedio ? Number(promedio) : null;
  });
}

export interface PeriodAverage {
  periodId: number;
  closesAt: Date;
  average: number | null;
}

// Promedio estudiantil por periodo de la delegacion; el filtrado de
// periodos cerrados (visibilidad §7.2) lo decide el caso de uso.
export async function studentAveragesByPeriod(
  delegationId: number
): Promise<PeriodAverage[]> {
  return withTransaction(async (client) => {
    const result = await client.query<{
      periodo_id: string;
      cierra_en: Date;
      promedio: string | null;
    }>(
      `SELECT p.id AS periodo_id, p.cierra_en,
              round(avg(e.calificacion), 2) AS promedio
       FROM periodos_evaluacion p
       LEFT JOIN evaluaciones_estudiantes e ON e.periodo_evaluacion_id = p.id
       WHERE p.delegacion_id = $1
       GROUP BY p.id, p.cierra_en
       ORDER BY p.abre_en`,
      [delegationId]
    );
    return result.rows.map((row) => ({
      periodId: Number(row.periodo_id),
      closesAt: row.cierra_en,
      average: row.promedio ? Number(row.promedio) : null
    }));
  });
}

// §7.2: reporte para docente y administrador con el detalle de cada
// periodo del ciclo y el promedio global; comentarios anonimizados.
export async function summaryByDelegation(
  delegation: Delegation
): Promise<EvaluationSummary> {
  return withTransaction(async (client) => {
    const periods = await client.query<PeriodRow>(
      `${PERIOD_SELECT} WHERE delegacion_id = $1 ORDER BY abre_en`,
      [delegation.id]
    );

    const studentStats = await client.query<{
      periodo_id: string;
      promedio: string | null;
      total: string;
    }>(
      `SELECT e.periodo_evaluacion_id AS periodo_id,
              round(avg(e.calificacion), 2) AS promedio, count(*) AS total
       FROM evaluaciones_estudiantes e
       JOIN periodos_evaluacion p ON p.id = e.periodo_evaluacion_id
       WHERE p.delegacion_id = $1
       GROUP BY e.periodo_evaluacion_id`,
      [delegation.id]
    );
    const studentComments = await client.query<{
      periodo_id: string;
      comentario: string;
    }>(
      `SELECT e.periodo_evaluacion_id AS periodo_id, e.comentario
       FROM evaluaciones_estudiantes e
       JOIN periodos_evaluacion p ON p.id = e.periodo_evaluacion_id
       WHERE p.delegacion_id = $1 AND e.comentario IS NOT NULL
       ORDER BY e.id`,
      [delegation.id]
    );
    const teacherStats = await client.query<{
      periodo_id: string;
      promedio: string | null;
      total: string;
    }>(
      `SELECT e.periodo_evaluacion_id AS periodo_id,
              round(avg(e.calificacion), 2) AS promedio, count(*) AS total
       FROM evaluaciones_docentes e
       JOIN periodos_evaluacion p ON p.id = e.periodo_evaluacion_id
       WHERE p.delegacion_id = $1
       GROUP BY e.periodo_evaluacion_id`,
      [delegation.id]
    );
    const teacherComments = await client.query<{
      periodo_id: string;
      calificacion: number;
      comentario: string;
    }>(
      `SELECT e.periodo_evaluacion_id AS periodo_id,
              e.calificacion, e.comentario
       FROM evaluaciones_docentes e
       JOIN periodos_evaluacion p ON p.id = e.periodo_evaluacion_id
       WHERE p.delegacion_id = $1
       ORDER BY e.id`,
      [delegation.id]
    );
    const globalStudents = await client.query<{
      promedio: string | null;
      total: string;
    }>(
      `SELECT round(avg(e.calificacion), 2) AS promedio, count(*) AS total
       FROM evaluaciones_estudiantes e
       JOIN periodos_evaluacion p ON p.id = e.periodo_evaluacion_id
       WHERE p.delegacion_id = $1`,
      [delegation.id]
    );
    const globalTeachers = await client.query<{
      promedio: string | null;
      total: string;
    }>(
      `SELECT round(avg(e.calificacion), 2) AS promedio, count(*) AS total
       FROM evaluaciones_docentes e
       JOIN periodos_evaluacion p ON p.id = e.periodo_evaluacion_id
       WHERE p.delegacion_id = $1`,
      [delegation.id]
    );

    const studentByPeriod = new Map(
      studentStats.rows.map((row) => [Number(row.periodo_id), row])
    );
    const teacherByPeriod = new Map(
      teacherStats.rows.map((row) => [Number(row.periodo_id), row])
    );
    const studentCommentsByPeriod = new Map<number, string[]>();
    for (const row of studentComments.rows) {
      const key = Number(row.periodo_id);
      const list = studentCommentsByPeriod.get(key) ?? [];
      list.push(row.comentario);
      studentCommentsByPeriod.set(key, list);
    }
    const teacherCommentsByPeriod = new Map<
      number,
      Array<{ grade: number; comment: string }>
    >();
    for (const row of teacherComments.rows) {
      const key = Number(row.periodo_id);
      const list = teacherCommentsByPeriod.get(key) ?? [];
      list.push({ grade: Number(row.calificacion), comment: row.comentario });
      teacherCommentsByPeriod.set(key, list);
    }

    const globalStudentRow = globalStudents.rows[0];
    const globalTeacherRow = globalTeachers.rows[0];

    return {
      delegationId: delegation.id,
      delegateName: delegation.delegateName,
      periodos: periods.rows.map(mapPeriod).map((period) => {
        const student = studentByPeriod.get(period.id);
        const teacher = teacherByPeriod.get(period.id);
        return {
          periodId: period.id,
          opensAt: period.opensAt,
          closesAt: period.closesAt,
          instructions: period.instructions,
          studentAverage: student?.promedio ? Number(student.promedio) : null,
          totalStudentEvaluations: Number(student?.total ?? 0),
          studentComments: studentCommentsByPeriod.get(period.id) ?? [],
          teacherAverage: teacher?.promedio ? Number(teacher.promedio) : null,
          totalTeacherRatings: Number(teacher?.total ?? 0),
          teacherComments: teacherCommentsByPeriod.get(period.id) ?? []
        };
      }),
      global: {
        studentAverage: globalStudentRow?.promedio
          ? Number(globalStudentRow.promedio)
          : null,
        totalStudentEvaluations: Number(globalStudentRow?.total ?? 0),
        teacherAverage: globalTeacherRow?.promedio
          ? Number(globalTeacherRow.promedio)
          : null,
        totalTeacherRatings: Number(globalTeacherRow?.total ?? 0)
      }
    };
  });
}
