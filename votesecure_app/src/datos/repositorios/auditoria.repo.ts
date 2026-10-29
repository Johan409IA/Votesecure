import { conTransaccion } from '../db';

export interface EventoAuditoria {
  id: number;
  eleccionId: number;
  nombreEleccion: string;
  seccionId: number;
  tipoEvento: string;
  actorTipo: 'usuario' | 'sistema';
  actorUsuarioId: number | null;
  nombreActor: string | null;
  ocurridoEn: Date;
  detalle: Record<string, unknown>;
}

interface FilaEvento {
  id: string;
  eleccion_id: string;
  nombre_eleccion: string;
  seccion_id: string;
  tipo_evento: string;
  actor_tipo: string;
  actor_usuario_id: string | null;
  nombre_actor: string | null;
  ocurrido_en: Date;
  detalle: Record<string, unknown>;
}

function mapear(f: FilaEvento): EventoAuditoria {
  return {
    id: Number(f.id),
    eleccionId: Number(f.eleccion_id),
    nombreEleccion: f.nombre_eleccion,
    seccionId: Number(f.seccion_id),
    tipoEvento: f.tipo_evento,
    actorTipo: f.actor_tipo as 'usuario' | 'sistema',
    actorUsuarioId: f.actor_usuario_id ? Number(f.actor_usuario_id) : null,
    nombreActor: f.nombre_actor,
    ocurridoEn: f.ocurrido_en,
    detalle: f.detalle ?? {}
  };
}

export interface FiltrosAuditoria {
  seccionId?: number;
  eleccionId?: number;
  limite?: number;
}

export async function listarEventos(
  filtros: FiltrosAuditoria
): Promise<EventoAuditoria[]> {
  const limite = Math.min(filtros.limite ?? 200, 500);
  return conTransaccion(async (cliente) => {
    const r = await cliente.query<FilaEvento>(
      `SELECT a.id, a.eleccion_id, e.nombre AS nombre_eleccion, e.seccion_id,
              a.tipo_evento, a.actor_tipo, a.actor_usuario_id,
              u.nombre AS nombre_actor, a.ocurrido_en, a.detalle
       FROM eventos_auditoria a
       JOIN elecciones e ON e.id = a.eleccion_id
       LEFT JOIN usuarios u ON u.id = a.actor_usuario_id
       WHERE ($1::bigint IS NULL OR e.seccion_id = $1)
         AND ($2::bigint IS NULL OR a.eleccion_id = $2)
       ORDER BY a.ocurrido_en DESC
       LIMIT $3`,
      [filtros.seccionId ?? null, filtros.eleccionId ?? null, limite]
    );
    return r.rows.map(mapear);
  });
}
