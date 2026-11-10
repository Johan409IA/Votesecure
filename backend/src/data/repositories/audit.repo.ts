import { withTransaction } from '../db';

export interface AuditEvent {
  id: number;
  electionId: number;
  electionName: string;
  sectionId: number;
  eventType: string;
  actorType: 'usuario' | 'sistema';
  actorUserId: number | null;
  actorName: string | null;
  occurredAt: Date;
  detail: Record<string, unknown>;
}

interface AuditEventRow {
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

function mapAuditEvent(row: AuditEventRow): AuditEvent {
  return {
    id: Number(row.id),
    electionId: Number(row.eleccion_id),
    electionName: row.nombre_eleccion,
    sectionId: Number(row.seccion_id),
    eventType: row.tipo_evento,
    actorType: row.actor_tipo as 'usuario' | 'sistema',
    actorUserId: row.actor_usuario_id ? Number(row.actor_usuario_id) : null,
    actorName: row.nombre_actor,
    occurredAt: row.ocurrido_en,
    detail: row.detalle ?? {}
  };
}

export interface AuditFilters {
  sectionId?: number;
  electionId?: number;
  limit?: number;
}

export async function listEvents(
  filters: AuditFilters
): Promise<AuditEvent[]> {
  const limit = Math.min(filters.limit ?? 200, 500);
  return withTransaction(async (client) => {
    const result = await client.query<AuditEventRow>(
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
      [filters.sectionId ?? null, filters.electionId ?? null, limit]
    );
    return result.rows.map(mapAuditEvent);
  });
}
