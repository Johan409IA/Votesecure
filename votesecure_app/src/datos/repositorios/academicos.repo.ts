import { conTransaccion } from '../db';

export interface Seccion {
  id: number;
  codigoCurso: string;
  nombreCurso: string;
  periodoAcademico: string;
  codigo: string;
  activa: boolean;
}

interface FilaSeccion {
  id: string;
  codigo_curso: string;
  nombre_curso: string;
  periodo_academico: string;
  codigo: string;
  activa: boolean;
}

function mapearSeccion(f: FilaSeccion): Seccion {
  return {
    id: Number(f.id),
    codigoCurso: f.codigo_curso,
    nombreCurso: f.nombre_curso,
    periodoAcademico: f.periodo_academico,
    codigo: f.codigo,
    activa: f.activa
  };
}

export interface DatosNuevaSeccion {
  codigoCurso: string;
  nombreCurso: string;
  periodoAcademico: string;
  codigo: string;
}

export async function crearSeccion(datos: DatosNuevaSeccion): Promise<Seccion> {
  return conTransaccion(async (cliente) => {
    const r = await cliente.query<FilaSeccion>(
      `INSERT INTO secciones (codigo_curso, nombre_curso, periodo_academico, codigo)
       VALUES ($1, $2, $3, $4) RETURNING id, codigo_curso, nombre_curso,
         periodo_academico, codigo, activa`,
      [datos.codigoCurso, datos.nombreCurso, datos.periodoAcademico, datos.codigo]
    );
    return mapearSeccion(r.rows[0]!);
  });
}

export async function listarSecciones(): Promise<Seccion[]> {
  return conTransaccion(async (cliente) => {
    const r = await cliente.query<FilaSeccion>(
      `SELECT id, codigo_curso, nombre_curso, periodo_academico, codigo, activa
       FROM secciones ORDER BY periodo_academico DESC, codigo_curso, codigo`
    );
    return r.rows.map(mapearSeccion);
  });
}

export async function obtenerSeccion(id: number): Promise<Seccion | null> {
  return conTransaccion(async (cliente) => {
    const r = await cliente.query<FilaSeccion>(
      `SELECT id, codigo_curso, nombre_curso, periodo_academico, codigo, activa
       FROM secciones WHERE id = $1`,
      [id]
    );
    const fila = r.rows[0];
    return fila ? mapearSeccion(fila) : null;
  });
}

export async function establecerSeccionActiva(
  id: number,
  activa: boolean
): Promise<void> {
  await conTransaccion(async (cliente) => {
    const r = await cliente.query(
      'UPDATE secciones SET activa = $1 WHERE id = $2',
      [activa, id]
    );
    if (r.rowCount === 0) throw new Error('Seccion inexistente');
  });
}

export interface Matricula {
  id: number;
  seccionId: number;
  estudianteId: number;
  activa: boolean;
  nombreEstudiante: string;
  correoEstudiante: string;
}

interface FilaMatricula {
  id: string;
  seccion_id: string;
  estudiante_id: string;
  activa: boolean;
  nombre_estudiante: string;
  correo_estudiante: string;
}

function mapearMatricula(f: FilaMatricula): Matricula {
  return {
    id: Number(f.id),
    seccionId: Number(f.seccion_id),
    estudianteId: Number(f.estudiante_id),
    activa: f.activa,
    nombreEstudiante: f.nombre_estudiante,
    correoEstudiante: f.correo_estudiante
  };
}

const SELECT_MATRICULA = `SELECT m.id, m.seccion_id, m.estudiante_id, m.activa,
  u.nombre AS nombre_estudiante, u.correo AS correo_estudiante
  FROM matriculas m JOIN usuarios u ON u.id = m.estudiante_id`;

export async function crearMatricula(
  seccionId: number,
  estudianteId: number
): Promise<Matricula> {
  return conTransaccion(async (cliente) => {
    const r = await cliente.query<FilaMatricula>(
      `INSERT INTO matriculas (seccion_id, estudiante_id)
       VALUES ($1, $2)
       RETURNING id, seccion_id, estudiante_id, activa,
         (SELECT nombre FROM usuarios WHERE id = $2) AS nombre_estudiante,
         (SELECT correo FROM usuarios WHERE id = $2) AS correo_estudiante`,
      [seccionId, estudianteId]
    );
    return mapearMatricula(r.rows[0]!);
  });
}

export async function listarMatriculasPorSeccion(
  seccionId: number
): Promise<Matricula[]> {
  return conTransaccion(async (cliente) => {
    const r = await cliente.query<FilaMatricula>(
      `${SELECT_MATRICULA} WHERE m.seccion_id = $1 ORDER BY u.nombre`,
      [seccionId]
    );
    return r.rows.map(mapearMatricula);
  });
}

export async function listarMatriculasDeEstudiante(
  estudianteId: number
): Promise<Matricula[]> {
  return conTransaccion(async (cliente) => {
    const r = await cliente.query<FilaMatricula>(
      `${SELECT_MATRICULA} WHERE m.estudiante_id = $1 AND m.activa ORDER BY m.id`,
      [estudianteId]
    );
    return r.rows.map(mapearMatricula);
  });
}

export async function establecerMatriculaActiva(
  id: number,
  activa: boolean
): Promise<void> {
  await conTransaccion(async (cliente) => {
    const r = await cliente.query(
      'UPDATE matriculas SET activa = $1 WHERE id = $2',
      [activa, id]
    );
    if (r.rowCount === 0) throw new Error('Matricula inexistente');
  });
}

export interface AsignacionDocente {
  id: number;
  seccionId: number;
  docenteId: number;
  activa: boolean;
  nombreDocente: string;
  correoDocente: string;
}

interface FilaAsignacion {
  id: string;
  seccion_id: string;
  docente_id: string;
  activa: boolean;
  nombre_docente: string;
  correo_docente: string;
}

function mapearAsignacion(f: FilaAsignacion): AsignacionDocente {
  return {
    id: Number(f.id),
    seccionId: Number(f.seccion_id),
    docenteId: Number(f.docente_id),
    activa: f.activa,
    nombreDocente: f.nombre_docente,
    correoDocente: f.correo_docente
  };
}

const SELECT_ASIGNACION = `SELECT a.id, a.seccion_id, a.docente_id, a.activa,
  u.nombre AS nombre_docente, u.correo AS correo_docente
  FROM asignaciones_docentes a JOIN usuarios u ON u.id = a.docente_id`;

export async function crearAsignacionDocente(
  seccionId: number,
  docenteId: number
): Promise<AsignacionDocente> {
  return conTransaccion(async (cliente) => {
    const r = await cliente.query<FilaAsignacion>(
      `INSERT INTO asignaciones_docentes (seccion_id, docente_id)
       VALUES ($1, $2)
       RETURNING id, seccion_id, docente_id, activa,
         (SELECT nombre FROM usuarios WHERE id = $2) AS nombre_docente,
         (SELECT correo FROM usuarios WHERE id = $2) AS correo_docente`,
      [seccionId, docenteId]
    );
    return mapearAsignacion(r.rows[0]!);
  });
}

export async function listarAsignacionesPorSeccion(
  seccionId: number
): Promise<AsignacionDocente[]> {
  return conTransaccion(async (cliente) => {
    const r = await cliente.query<FilaAsignacion>(
      `${SELECT_ASIGNACION} WHERE a.seccion_id = $1 ORDER BY u.nombre`,
      [seccionId]
    );
    return r.rows.map(mapearAsignacion);
  });
}

export async function listarAsignacionesDeDocente(
  docenteId: number
): Promise<AsignacionDocente[]> {
  return conTransaccion(async (cliente) => {
    const r = await cliente.query<FilaAsignacion>(
      `${SELECT_ASIGNACION} WHERE a.docente_id = $1 AND a.activa ORDER BY a.id`,
      [docenteId]
    );
    return r.rows.map(mapearAsignacion);
  });
}

export async function establecerAsignacionActiva(
  id: number,
  activa: boolean
): Promise<void> {
  await conTransaccion(async (cliente) => {
    const r = await cliente.query(
      'UPDATE asignaciones_docentes SET activa = $1 WHERE id = $2',
      [activa, id]
    );
    if (r.rowCount === 0) throw new Error('Asignacion inexistente');
  });
}
