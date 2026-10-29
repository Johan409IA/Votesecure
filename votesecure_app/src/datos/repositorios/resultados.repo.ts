import { conTransaccion } from '../db';

export interface ResultadoFinal {
  eleccionId: number;
  totalHabilitados: number;
  totalParticipantes: number;
  porcentajeParticipacion: number;
  situacion: 'sin_votos' | 'ganador' | 'empate';
  ganadorCandidaturaId: number | null;
  candidaturas: Array<{ candidaturaId: number; nombre: string; votos: number }>;
}

interface FilaResumen {
  eleccion_id: string;
  total_habilitados: string;
  total_participantes: string;
  porcentaje_participacion: string;
  situacion: string;
  ganador_candidatura_id: string | null;
}

export async function obtenerResultadoFinal(
  eleccionId: number
): Promise<ResultadoFinal | null> {
  return conTransaccion(async (cliente) => {
    const r = await cliente.query<FilaResumen>(
      `SELECT eleccion_id, total_habilitados, total_participantes,
              porcentaje_participacion, situacion, ganador_candidatura_id
       FROM resumen_resultados_publicados WHERE eleccion_id = $1`,
      [eleccionId]
    );
    const fila = r.rows[0];
    if (!fila) return null;
    const detalle = await cliente.query<{
      candidatura_id: string;
      votos_obtenidos: string;
      nombre: string;
    }>(
      `SELECT rc.candidatura_id, rc.votos_obtenidos, u.nombre
       FROM resultados_candidatos rc
       JOIN candidaturas c ON c.id = rc.candidatura_id
       JOIN matriculas m ON m.id = c.matricula_id
       JOIN usuarios u ON u.id = m.estudiante_id
       WHERE rc.eleccion_id = $1
       ORDER BY rc.votos_obtenidos DESC, u.nombre`,
      [eleccionId]
    );
    return {
      eleccionId: Number(fila.eleccion_id),
      totalHabilitados: Number(fila.total_habilitados),
      totalParticipantes: Number(fila.total_participantes),
      porcentajeParticipacion: Number(fila.porcentaje_participacion),
      situacion: fila.situacion as ResultadoFinal['situacion'],
      ganadorCandidaturaId: fila.ganador_candidatura_id
        ? Number(fila.ganador_candidatura_id)
        : null,
      candidaturas: detalle.rows.map((d) => ({
        candidaturaId: Number(d.candidatura_id),
        nombre: d.nombre,
        votos: Number(d.votos_obtenidos)
      }))
    };
  });
}

export async function estaHabilitado(
  eleccionId: number,
  estudianteId: number
): Promise<boolean> {
  return conTransaccion(async (cliente) => {
    const r = await cliente.query<{ existe: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM habilitaciones_voto h
         JOIN matriculas m ON m.id = h.matricula_id
         WHERE h.eleccion_id = $1 AND m.estudiante_id = $2 AND m.activa
       ) AS existe`,
      [eleccionId, estudianteId]
    );
    return r.rows[0]?.existe === true;
  });
}

export async function haVotado(
  eleccionId: number,
  estudianteId: number
): Promise<boolean> {
  return conTransaccion(async (cliente) => {
    const r = await cliente.query<{ existe: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM habilitaciones_voto h
         JOIN matriculas m ON m.id = h.matricula_id
         WHERE h.eleccion_id = $1 AND m.estudiante_id = $2 AND h.ha_votado
       ) AS existe`,
      [eleccionId, estudianteId]
    );
    return r.rows[0]?.existe === true;
  });
}

export async function seccionesDeEstudiante(estudianteId: number): Promise<number[]> {
  return conTransaccion(async (cliente) => {
    const r = await cliente.query<{ seccion_id: string }>(
      'SELECT seccion_id FROM matriculas WHERE estudiante_id = $1',
      [estudianteId]
    );
    return r.rows.map((f) => Number(f.seccion_id));
  });
}

export async function esDocenteDeSeccion(
  docenteId: number,
  seccionId: number
): Promise<boolean> {
  return conTransaccion(async (cliente) => {
    const r = await cliente.query<{ existe: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM asignaciones_docentes
         WHERE docente_id = $1 AND seccion_id = $2 AND activa
       ) AS existe`,
      [docenteId, seccionId]
    );
    return r.rows[0]?.existe === true;
  });
}

export async function seccionesDeDocente(docenteId: number): Promise<number[]> {
  return conTransaccion(async (cliente) => {
    const r = await cliente.query<{ seccion_id: string }>(
      'SELECT seccion_id FROM asignaciones_docentes WHERE docente_id = $1 AND activa',
      [docenteId]
    );
    return r.rows.map((f) => Number(f.seccion_id));
  });
}

export async function esMiembroDeSeccion(
  usuarioId: number,
  seccionId: number
): Promise<boolean> {
  return conTransaccion(async (cliente) => {
    const r = await cliente.query<{ existe: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM matriculas WHERE estudiante_id = $1 AND seccion_id = $2 AND activa
       ) AS existe
       UNION ALL
       SELECT EXISTS (
         SELECT 1 FROM asignaciones_docentes
         WHERE docente_id = $1 AND seccion_id = $2 AND activa
       )`,
      [usuarioId, seccionId]
    );
    return r.rows.some((f) => f.existe === true);
  });
}
