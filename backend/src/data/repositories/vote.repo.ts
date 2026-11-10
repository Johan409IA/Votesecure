import { withTransaction } from '../db';

export interface CandidacyCount {
  candidacyId: number;
  votes: number;
}

export async function castVote(
  electionId: number,
  studentId: number,
  candidacyId: number
): Promise<number> {
  return withTransaction(async (client) => {
    const result = await client.query<{ registrar_voto: string }>(
      'SELECT registrar_voto($1, $2, $3) AS registrar_voto',
      [electionId, studentId, candidacyId]
    );
    return Number(result.rows[0]?.registrar_voto);
  });
}

export async function countVotesByCandidacy(
  electionId: number
): Promise<CandidacyCount[]> {
  return withTransaction(async (client) => {
    const result = await client.query<{ candidatura_id: string; votos: string }>(
      'SELECT candidatura_id, votos FROM contar_votos_eleccion($1)',
      [electionId]
    );
    return result.rows.map((row) => ({
      candidacyId: Number(row.candidatura_id),
      votes: Number(row.votos)
    }));
  });
}

export interface Participation {
  totalEligible: number;
  totalParticipants: number;
}

export async function electionParticipation(
  electionId: number
): Promise<Participation> {
  return withTransaction(async (client) => {
    const result = await client.query<{ total: string; participantes: string }>(
      `SELECT count(*) AS total,
              count(*) FILTER (WHERE ha_votado) AS participantes
       FROM habilitaciones_voto WHERE eleccion_id = $1`,
      [electionId]
    );
    const row = result.rows[0];
    return {
      totalEligible: Number(row?.total ?? 0),
      totalParticipants: Number(row?.participantes ?? 0)
    };
  });
}
