import { createHmac } from 'node:crypto';
import {
  createClient,
  type RealtimeChannel,
  type SupabaseClient
} from '@supabase/supabase-js';
import { logger } from '../../config/logger';

export interface CargaResultado {
  eleccionId: number;
  estado: string;
  totalHabilitados: number;
  totalParticipantes: number;
  totalVotos: number;
  candidaturas: Array<{ candidaturaId: number; nombre: string; votos: number }>;
}

export class PublicadorResultados {
  private cliente: SupabaseClient;
  private canales = new Map<string, RealtimeChannel>();
  private suscritos = new Set<string>();

  constructor(
    url: string,
    claveServicio: string,
    private secreto: string
  ) {
    this.cliente = createClient(url, claveServicio, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
  }

  ticket(eleccionId: number): string {
    return createHmac('sha256', this.secreto)
      .update(`eleccion:${eleccionId}`)
      .digest('hex');
  }

  nombreCanal(eleccionId: number): string {
    return `resultados:${eleccionId}:${this.ticket(eleccionId)}`;
  }

  async publicar(eleccionId: number, carga: CargaResultado): Promise<void> {
    const canal = await this.obtenerCanal(eleccionId);
    const estado = await canal.send({
      type: 'broadcast',
      event: 'resultado',
      payload: carga
    });
    if (estado !== 'ok') {
      throw new Error(`Realtime rechazo la publicacion: ${estado}`);
    }
  }

  async detener(): Promise<void> {
    for (const canal of this.canales.values()) {
      await this.cliente.removeChannel(canal);
    }
    this.canales.clear();
    this.suscritos.clear();
  }

  private async obtenerCanal(eleccionId: number): Promise<RealtimeChannel> {
    const nombre = this.nombreCanal(eleccionId);
    let canal = this.canales.get(nombre);
    if (!canal) {
      canal = this.cliente.channel(nombre, {
        config: { broadcast: { self: false } }
      });
      this.canales.set(nombre, canal);
    }
    if (!this.suscritos.has(nombre)) {
      await new Promise<void>((resolver, rechazar) => {
        const temporizador = setTimeout(
          () => rechazar(new Error('Tiempo de espera agotado al suscribir canal Realtime')),
          10_000
        );
        canal!.subscribe((estado) => {
          if (estado === 'SUBSCRIBED') {
            clearTimeout(temporizador);
            resolver();
          } else if (estado === 'CHANNEL_ERROR' || estado === 'TIMED_OUT') {
            clearTimeout(temporizador);
            rechazar(new Error(`Fallo la suscripcion al canal Realtime: ${estado}`));
          }
        });
      }).catch(async (error) => {
        await this.cliente.removeChannel(canal!);
        this.canales.delete(nombre);
        throw error;
      });
      this.suscritos.add(nombre);
      logger.debug({ canal: nombre }, 'Canal Realtime suscrito');
    }
    return canal;
  }
}
