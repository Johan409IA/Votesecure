import { conTransaccion } from '../db';

export interface ConteoCandidatura {
  candidaturaId: number;
  votos: number;
}

export async function votar(
  eleccionId: number,
  estudianteId: number,
  candidaturaId: number
): Promise<number> {
  return conTransaccion(async (cliente) => {
    const r = await cliente.query<{ registrar_voto: string }>(
      'SELECT registrar_voto($1, $2, $3) AS registrar_voto',
      [eleccionId, estudianteId, candidaturaId]
    );
    return Number(r.rows[0]?.registrar_voto);
  });
}

export async function contarVotosPorCandidatura(
  eleccionId: number
): Promise<ConteoCandidatura[]> {
  return conTransaccion(async (cliente) => {
    const r = await cliente.query<{ candidatura_id: string; votos: string }>(
      'SELECT candidatura_id, votos FROM contar_votos_eleccion($1)',
      [eleccionId]
    );
    return r.rows.map((f) => ({
      candidaturaId: Number(f.candidatura_id),
      votos: Number(f.votos)
    }));
  });
}

export interface Participacion {
  totalHabilitados: number;
  totalParticipantes: number;
}

export async function participacionEleccion(
  eleccionId: number
): Promise<Participacion> {
  return conTransaccion(async (cliente) => {
    const r = await cliente.query<{ total: string; participantes: string }>(
      `SELECT count(*) AS total,
              count(*) FILTER (WHERE ha_votado) AS participantes
       FROM habilitaciones_voto WHERE eleccion_id = $1`,
      [eleccionId]
    );
    const fila = r.rows[0];
    return {
      totalHabilitados: Number(fila?.total ?? 0),
      totalParticipantes: Number(fila?.participantes ?? 0)
    };
  });
}
