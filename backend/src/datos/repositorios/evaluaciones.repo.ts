import { conTransaccion } from '../db';

export interface Delegacion {
  id: number;
  eleccionId: number;
  seccionId: number;
  candidaturaId: number;
  nombreDelegado: string;
  iniciaEn: Date;
  terminaEn: Date | null;
}

export interface PeriodoEvaluacion {
  id: number;
  delegacionId: number;
  seccionId: number;
  abreEn: Date;
  cierraEn: Date;
}

interface FilaDelegacion {
  id: string;
  eleccion_id: string;
  seccion_id: string;
  candidatura_id: string;
  nombre_delegado: string;
  inicia_en: Date;
  termina_en: Date | null;
}

interface FilaPeriodo {
  id: string;
  delegacion_id: string;
  seccion_id: string;
  abre_en: Date;
  cierra_en: Date;
}

export async function obtenerDelegacion(
  delegacionId: number
): Promise<Delegacion | null> {
  return conTransaccion(async (cliente) => {
    const r = await cliente.query<FilaDelegacion>(
      `SELECT d.id, d.eleccion_id, d.seccion_id, d.candidatura_id,
              u.nombre AS nombre_delegado, d.inicia_en, d.termina_en
       FROM delegaciones d
       JOIN candidaturas c ON c.id = d.candidatura_id
       JOIN matriculas m ON m.id = c.matricula_id
       JOIN usuarios u ON u.id = m.estudiante_id
       WHERE d.id = $1`,
      [delegacionId]
    );
    const f = r.rows[0];
    return f
      ? {
          id: Number(f.id),
          eleccionId: Number(f.eleccion_id),
          seccionId: Number(f.seccion_id),
          candidaturaId: Number(f.candidatura_id),
          nombreDelegado: f.nombre_delegado,
          iniciaEn: f.inicia_en,
          terminaEn: f.termina_en
        }
      : null;
  });
}

export async function delegacionVigentePorSeccion(
  seccionId: number
): Promise<Delegacion | null> {
  return conTransaccion(async (cliente) => {
    const r = await cliente.query<FilaDelegacion>(
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
      [seccionId]
    );
    const f = r.rows[0];
    return f
      ? {
          id: Number(f.id),
          eleccionId: Number(f.eleccion_id),
          seccionId: Number(f.seccion_id),
          candidaturaId: Number(f.candidatura_id),
          nombreDelegado: f.nombre_delegado,
          iniciaEn: f.inicia_en,
          terminaEn: f.termina_en
        }
      : null;
  });
}

export async function periodoVigentePorDelegacion(
  delegacionId: number
): Promise<PeriodoEvaluacion | null> {
  return conTransaccion(async (cliente) => {
    const r = await cliente.query<FilaPeriodo>(
      `SELECT id, delegacion_id, seccion_id, abre_en, cierra_en
       FROM periodos_evaluacion
       WHERE delegacion_id = $1 AND abre_en <= now() AND cierra_en > now()
       ORDER BY cierra_en DESC LIMIT 1`,
      [delegacionId]
    );
    const f = r.rows[0];
    return f
      ? {
          id: Number(f.id),
          delegacionId: Number(f.delegacion_id),
          seccionId: Number(f.seccion_id),
          abreEn: f.abre_en,
          cierraEn: f.cierra_en
        }
      : null;
  });
}

export async function obtenerMatriculaId(
  seccionId: number,
  estudianteId: number
): Promise<number | null> {
  return conTransaccion(async (cliente) => {
    const r = await cliente.query<{ id: string }>(
      `SELECT id FROM matriculas
       WHERE seccion_id = $1 AND estudiante_id = $2 AND activa`,
      [seccionId, estudianteId]
    );
    const id = r.rows[0]?.id;
    return id ? Number(id) : null;
  });
}

export async function obtenerAsignacionId(
  seccionId: number,
  docenteId: number
): Promise<number | null> {
  return conTransaccion(async (cliente) => {
    const r = await cliente.query<{ id: string }>(
      `SELECT id FROM asignaciones_docentes
       WHERE seccion_id = $1 AND docente_id = $2 AND activa`,
      [seccionId, docenteId]
    );
    const id = r.rows[0]?.id;
    return id ? Number(id) : null;
  });
}

export async function registrarEvaluacionEstudiante(
  periodoId: number,
  matriculaId: number,
  calificacion: number,
  comentario: string | null
): Promise<void> {
  await conTransaccion(async (cliente) => {
    await cliente.query(
      `INSERT INTO evaluaciones_estudiantes
         (periodo_evaluacion_id, seccion_id, matricula_id, calificacion, comentario)
       VALUES ($1,
               (SELECT seccion_id FROM periodos_evaluacion WHERE id = $1),
               $2, $3, $4)
       ON CONFLICT (periodo_evaluacion_id, matricula_id)
       DO UPDATE SET calificacion = EXCLUDED.calificacion,
                     comentario = EXCLUDED.comentario`,
      [periodoId, matriculaId, calificacion, comentario]
    );
  });
}

export async function registrarEvaluacionDocente(
  periodoId: number,
  asignacionId: number,
  calificacion: number,
  comentario: string
): Promise<void> {
  await conTransaccion(async (cliente) => {
    await cliente.query(
      `INSERT INTO evaluaciones_docentes
         (periodo_evaluacion_id, seccion_id, asignacion_docente_id, calificacion, comentario)
       VALUES ($1,
               (SELECT seccion_id FROM periodos_evaluacion WHERE id = $1),
               $2, $3, $4)
       ON CONFLICT (periodo_evaluacion_id, asignacion_docente_id)
       DO UPDATE SET calificacion = EXCLUDED.calificacion,
                     comentario = EXCLUDED.comentario`,
      [periodoId, asignacionId, calificacion, comentario]
    );
  });
}

export interface ResumenEvaluacion {
  delegacionId: number;
  nombreDelegado: string;
  periodoId: number | null;
  promedioEstudiantil: number | null;
  totalEvaluacionesEstudiantes: number;
  promedioDocente: number | null;
  totalValoracionesDocentes: number;
  comentariosDocentes: Array<{ calificacion: number; comentario: string }>;
}

export async function resumenPorDelegacion(
  delegacion: Delegacion
): Promise<ResumenEvaluacion> {
  return conTransaccion(async (cliente) => {
    const periodo = await cliente.query<FilaPeriodo>(
      `SELECT id, delegacion_id, seccion_id, abre_en, cierra_en
       FROM periodos_evaluacion WHERE delegacion_id = $1
       ORDER BY cierra_en DESC LIMIT 1`,
      [delegacion.id]
    );
    const filaPeriodo = periodo.rows[0];
    const periodoId = filaPeriodo ? Number(filaPeriodo.id) : null;

    const estudiantes = await cliente.query<{ promedio: string | null; total: string }>(
      `SELECT round(avg(calificacion), 2) AS promedio, count(*) AS total
       FROM evaluaciones_estudiantes WHERE periodo_evaluacion_id = $1`,
      [periodoId]
    );
    const docentes = await cliente.query<{ promedio: string | null; total: string }>(
      `SELECT round(avg(calificacion), 2) AS promedio, count(*) AS total
       FROM evaluaciones_docentes WHERE periodo_evaluacion_id = $1`,
      [periodoId]
    );
    const comentarios = await cliente.query<{
      calificacion: number;
      comentario: string;
    }>(
      `SELECT calificacion, comentario FROM evaluaciones_docentes
       WHERE periodo_evaluacion_id = $1 ORDER BY id`,
      [periodoId]
    );

    const fEst = estudiantes.rows[0];
    const fDoc = docentes.rows[0];
    return {
      delegacionId: delegacion.id,
      nombreDelegado: delegacion.nombreDelegado,
      periodoId,
      promedioEstudiantil: fEst?.promedio ? Number(fEst.promedio) : null,
      totalEvaluacionesEstudiantes: Number(fEst?.total ?? 0),
      promedioDocente: fDoc?.promedio ? Number(fDoc.promedio) : null,
      totalValoracionesDocentes: Number(fDoc?.total ?? 0),
      comentariosDocentes: comentarios.rows.map((c) => ({
        calificacion: Number(c.calificacion),
        comentario: c.comentario
      }))
    };
  });
}
