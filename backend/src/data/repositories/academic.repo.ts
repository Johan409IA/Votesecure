import { withTransaction } from '../db';

export interface Section {
  id: number;
  courseCode: string;
  courseName: string;
  academicPeriod: string;
  code: string;
  active: boolean;
}

interface SectionRow {
  id: string;
  codigo_curso: string;
  nombre_curso: string;
  periodo_academico: string;
  codigo: string;
  activa: boolean;
}

function mapSection(row: SectionRow): Section {
  return {
    id: Number(row.id),
    courseCode: row.codigo_curso,
    courseName: row.nombre_curso,
    academicPeriod: row.periodo_academico,
    code: row.codigo,
    active: row.activa
  };
}

export interface NewSectionData {
  courseCode: string;
  courseName: string;
  academicPeriod: string;
  code: string;
}

export async function createSection(data: NewSectionData): Promise<Section> {
  return withTransaction(async (client) => {
    const result = await client.query<SectionRow>(
      `INSERT INTO secciones (codigo_curso, nombre_curso, periodo_academico, codigo)
       VALUES ($1, $2, $3, $4) RETURNING id, codigo_curso, nombre_curso,
         periodo_academico, codigo, activa`,
      [data.courseCode, data.courseName, data.academicPeriod, data.code]
    );
    return mapSection(result.rows[0]!);
  });
}

export async function findSectionByCode(
  code: string
): Promise<Section | null> {
  return withTransaction(async (client) => {
    const result = await client.query<SectionRow>(
      `SELECT id, codigo_curso, nombre_curso, periodo_academico, codigo, activa
       FROM secciones WHERE codigo = $1`,
      [code]
    );
    const row = result.rows[0];
    return row ? mapSection(row) : null;
  });
}

export async function listSections(): Promise<Section[]> {
  return withTransaction(async (client) => {
    const result = await client.query<SectionRow>(
      `SELECT id, codigo_curso, nombre_curso, periodo_academico, codigo, activa
       FROM secciones ORDER BY periodo_academico DESC, codigo_curso, codigo`
    );
    return result.rows.map(mapSection);
  });
}

export async function getSection(id: number): Promise<Section | null> {
  return withTransaction(async (client) => {
    const result = await client.query<SectionRow>(
      `SELECT id, codigo_curso, nombre_curso, periodo_academico, codigo, activa
       FROM secciones WHERE id = $1`,
      [id]
    );
    const row = result.rows[0];
    return row ? mapSection(row) : null;
  });
}

export async function setSectionActive(
  id: number,
  active: boolean
): Promise<void> {
  await withTransaction(async (client) => {
    const result = await client.query(
      'UPDATE secciones SET activa = $1 WHERE id = $2',
      [active, id]
    );
    if (result.rowCount === 0) throw new Error('Seccion inexistente');
  });
}

export interface Enrollment {
  id: number;
  sectionId: number;
  studentId: number;
  active: boolean;
  studentName: string;
  studentEmail: string;
}

interface EnrollmentRow {
  id: string;
  seccion_id: string;
  estudiante_id: string;
  activa: boolean;
  nombre_estudiante: string;
  correo_estudiante: string;
}

function mapEnrollment(row: EnrollmentRow): Enrollment {
  return {
    id: Number(row.id),
    sectionId: Number(row.seccion_id),
    studentId: Number(row.estudiante_id),
    active: row.activa,
    studentName: row.nombre_estudiante,
    studentEmail: row.correo_estudiante
  };
}

const ENROLLMENT_SELECT = `SELECT m.id, m.seccion_id, m.estudiante_id, m.activa,
  u.nombre AS nombre_estudiante, u.correo AS correo_estudiante
  FROM matriculas m JOIN usuarios u ON u.id = m.estudiante_id`;

export async function createEnrollment(
  sectionId: number,
  studentId: number
): Promise<Enrollment> {
  return withTransaction(async (client) => {
    const result = await client.query<EnrollmentRow>(
      `INSERT INTO matriculas (seccion_id, estudiante_id)
       VALUES ($1, $2)
       RETURNING id, seccion_id, estudiante_id, activa,
         (SELECT nombre FROM usuarios WHERE id = $2) AS nombre_estudiante,
         (SELECT correo FROM usuarios WHERE id = $2) AS correo_estudiante`,
      [sectionId, studentId]
    );
    return mapEnrollment(result.rows[0]!);
  });
}

export async function listEnrollmentsBySection(
  sectionId: number
): Promise<Enrollment[]> {
  return withTransaction(async (client) => {
    const result = await client.query<EnrollmentRow>(
      `${ENROLLMENT_SELECT} WHERE m.seccion_id = $1 ORDER BY u.nombre`,
      [sectionId]
    );
    return result.rows.map(mapEnrollment);
  });
}

export async function listEnrollmentsByStudent(
  studentId: number
): Promise<Enrollment[]> {
  return withTransaction(async (client) => {
    const result = await client.query<EnrollmentRow>(
      `${ENROLLMENT_SELECT} WHERE m.estudiante_id = $1 AND m.activa ORDER BY m.id`,
      [studentId]
    );
    return result.rows.map(mapEnrollment);
  });
}

export async function setEnrollmentActive(
  id: number,
  active: boolean
): Promise<void> {
  await withTransaction(async (client) => {
    const result = await client.query(
      'UPDATE matriculas SET activa = $1 WHERE id = $2',
      [active, id]
    );
    if (result.rowCount === 0) throw new Error('Matricula inexistente');
  });
}

export interface TeacherAssignment {
  id: number;
  sectionId: number;
  teacherId: number;
  active: boolean;
  teacherName: string;
  teacherEmail: string;
}

interface AssignmentRow {
  id: string;
  seccion_id: string;
  docente_id: string;
  activa: boolean;
  nombre_docente: string;
  correo_docente: string;
}

function mapAssignment(row: AssignmentRow): TeacherAssignment {
  return {
    id: Number(row.id),
    sectionId: Number(row.seccion_id),
    teacherId: Number(row.docente_id),
    active: row.activa,
    teacherName: row.nombre_docente,
    teacherEmail: row.correo_docente
  };
}

const ASSIGNMENT_SELECT = `SELECT a.id, a.seccion_id, a.docente_id, a.activa,
  u.nombre AS nombre_docente, u.correo AS correo_docente
  FROM asignaciones_docentes a JOIN usuarios u ON u.id = a.docente_id`;

export async function createTeacherAssignment(
  sectionId: number,
  teacherId: number
): Promise<TeacherAssignment> {
  return withTransaction(async (client) => {
    const result = await client.query<AssignmentRow>(
      `INSERT INTO asignaciones_docentes (seccion_id, docente_id)
       VALUES ($1, $2)
       RETURNING id, seccion_id, docente_id, activa,
         (SELECT nombre FROM usuarios WHERE id = $2) AS nombre_docente,
         (SELECT correo FROM usuarios WHERE id = $2) AS correo_docente`,
      [sectionId, teacherId]
    );
    return mapAssignment(result.rows[0]!);
  });
}

export async function listAssignmentsBySection(
  sectionId: number
): Promise<TeacherAssignment[]> {
  return withTransaction(async (client) => {
    const result = await client.query<AssignmentRow>(
      `${ASSIGNMENT_SELECT} WHERE a.seccion_id = $1 ORDER BY u.nombre`,
      [sectionId]
    );
    return result.rows.map(mapAssignment);
  });
}

export async function listAssignmentsByTeacher(
  teacherId: number
): Promise<TeacherAssignment[]> {
  return withTransaction(async (client) => {
    const result = await client.query<AssignmentRow>(
      `${ASSIGNMENT_SELECT} WHERE a.docente_id = $1 AND a.activa ORDER BY a.id`,
      [teacherId]
    );
    return result.rows.map(mapAssignment);
  });
}

export async function setAssignmentActive(
  id: number,
  active: boolean
): Promise<void> {
  await withTransaction(async (client) => {
    const result = await client.query(
      'UPDATE asignaciones_docentes SET activa = $1 WHERE id = $2',
      [active, id]
    );
    if (result.rowCount === 0) throw new Error('Asignacion inexistente');
  });
}
