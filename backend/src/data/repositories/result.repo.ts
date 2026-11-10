import { withTransaction } from '../db';

export interface FinalResult {
  electionId: number;
  totalEligible: number;
  totalParticipants: number;
  participationPercentage: number;
  situation: 'sin_votos' | 'ganador' | 'empate';
  winnerCandidacyId: number | null;
  candidacies: Array<{ candidacyId: number; name: string; votes: number }>;
}

interface SummaryRow {
  eleccion_id: string;
  total_habilitados: string;
  total_participantes: string;
  porcentaje_participacion: string;
  situacion: string;
  ganador_candidatura_id: string | null;
}

export async function getFinalResult(
  electionId: number
): Promise<FinalResult | null> {
  return withTransaction(async (client) => {
    const result = await client.query<SummaryRow>(
      `SELECT eleccion_id, total_habilitados, total_participantes,
              porcentaje_participacion, situacion, ganador_candidatura_id
       FROM resumen_resultados_publicados WHERE eleccion_id = $1`,
      [electionId]
    );
    const row = result.rows[0];
    if (!row) return null;
    const detail = await client.query<{
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
      [electionId]
    );
    return {
      electionId: Number(row.eleccion_id),
      totalEligible: Number(row.total_habilitados),
      totalParticipants: Number(row.total_participantes),
      participationPercentage: Number(row.porcentaje_participacion),
      situation: row.situacion as FinalResult['situation'],
      winnerCandidacyId: row.ganador_candidatura_id
        ? Number(row.ganador_candidatura_id)
        : null,
      candidacies: detail.rows.map((d) => ({
        candidacyId: Number(d.candidatura_id),
        name: d.nombre,
        votes: Number(d.votos_obtenidos)
      }))
    };
  });
}

export async function isEligible(
  electionId: number,
  studentId: number
): Promise<boolean> {
  return withTransaction(async (client) => {
    const result = await client.query<{ existe: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM habilitaciones_voto h
         JOIN matriculas m ON m.id = h.matricula_id
         WHERE h.eleccion_id = $1 AND m.estudiante_id = $2 AND m.activa
       ) AS existe`,
      [electionId, studentId]
    );
    return result.rows[0]?.existe === true;
  });
}

export async function hasVoted(
  electionId: number,
  studentId: number
): Promise<boolean> {
  return withTransaction(async (client) => {
    const result = await client.query<{ existe: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM habilitaciones_voto h
         JOIN matriculas m ON m.id = h.matricula_id
         WHERE h.eleccion_id = $1 AND m.estudiante_id = $2 AND h.ha_votado
       ) AS existe`,
      [electionId, studentId]
    );
    return result.rows[0]?.existe === true;
  });
}

export async function sectionsOfStudent(studentId: number): Promise<number[]> {
  return withTransaction(async (client) => {
    const result = await client.query<{ seccion_id: string }>(
      'SELECT seccion_id FROM matriculas WHERE estudiante_id = $1',
      [studentId]
    );
    return result.rows.map((row) => Number(row.seccion_id));
  });
}

export async function isTeacherOfSection(
  teacherId: number,
  sectionId: number
): Promise<boolean> {
  return withTransaction(async (client) => {
    const result = await client.query<{ existe: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM asignaciones_docentes
         WHERE docente_id = $1 AND seccion_id = $2 AND activa
       ) AS existe`,
      [teacherId, sectionId]
    );
    return result.rows[0]?.existe === true;
  });
}

export async function isSectionMember(
  userId: number,
  sectionId: number
): Promise<boolean> {
  return withTransaction(async (client) => {
    const result = await client.query<{ existe: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM matriculas WHERE estudiante_id = $1 AND seccion_id = $2 AND activa
       ) AS existe
       UNION ALL
       SELECT EXISTS (
         SELECT 1 FROM asignaciones_docentes
         WHERE docente_id = $1 AND seccion_id = $2 AND activa
       )`,
      [userId, sectionId]
    );
    return result.rows.some((row) => row.existe === true);
  });
}

export interface TiedCandidate {
  enrollmentId: number;
  name: string;
}

// Candidatos empatados en primer lugar de la eleccion origen (§6.2): los que
// obtuvieron el maximo de votos en la instantanea publicada.
export async function listTiedCandidates(
  originElectionId: number
): Promise<TiedCandidate[]> {
  return withTransaction(async (client) => {
    const result = await client.query<{ matricula_id: string; nombre: string }>(
      `WITH maximo AS (
         SELECT max(votos_obtenidos) AS votos
           FROM resultados_candidatos WHERE eleccion_id = $1
       )
       SELECT c.matricula_id, u.nombre
       FROM resultados_candidatos r
       JOIN candidaturas c ON c.id = r.candidatura_id
       JOIN matriculas m ON m.id = c.matricula_id
       JOIN usuarios u ON u.id = m.estudiante_id
       WHERE r.eleccion_id = $1
         AND r.votos_obtenidos = (SELECT votos FROM maximo)
       ORDER BY u.nombre`,
      [originElectionId]
    );
    return result.rows.map((row) => ({
      enrollmentId: Number(row.matricula_id),
      name: row.nombre
    }));
  });
}
