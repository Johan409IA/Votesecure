import { createHmac } from 'node:crypto';
import {
  createClient,
  type RealtimeChannel,
  type SupabaseClient
} from '@supabase/supabase-js';
import { logger } from '../../config/logger';

// La forma JSON de este payload es contrato de la API (§5.1): sus claves
// permanecen en espanol aunque la capa TS use identificadores en ingles.
export interface ResultLoad {
  eleccionId: number;
  estado: string;
  totalHabilitados: number;
  totalParticipantes: number;
  totalVotos: number;
  candidaturas: Array<{ candidaturaId: number; nombre: string; votos: number }>;
}

export class ResultsPublisher {
  private client: SupabaseClient;
  private channels = new Map<string, RealtimeChannel>();
  private subscribed = new Set<string>();

  constructor(
    url: string,
    serviceKey: string,
    private secret: string
  ) {
    this.client = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
  }

  ticket(electionId: number): string {
    return createHmac('sha256', this.secret)
      .update(`eleccion:${electionId}`)
      .digest('hex');
  }

  channelName(electionId: number): string {
    return `resultados:${electionId}:${this.ticket(electionId)}`;
  }

  async publish(electionId: number, load: ResultLoad): Promise<void> {
    const channel = await this.getChannel(electionId);
    const status = await channel.send({
      type: 'broadcast',
      event: 'resultado',
      payload: load
    });
    if (status !== 'ok') {
      throw new Error(`Realtime rechazo la publicacion: ${status}`);
    }
  }

  async stop(): Promise<void> {
    for (const channel of this.channels.values()) {
      await this.client.removeChannel(channel);
    }
    this.channels.clear();
    this.subscribed.clear();
  }

  private async getChannel(electionId: number): Promise<RealtimeChannel> {
    const name = this.channelName(electionId);
    let channel = this.channels.get(name);
    if (!channel) {
      channel = this.client.channel(name, {
        config: { broadcast: { self: false } }
      });
      this.channels.set(name, channel);
    }
    if (!this.subscribed.has(name)) {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error('Tiempo de espera agotado al suscribir canal Realtime')),
          10_000
        );
        channel!.subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            clearTimeout(timer);
            resolve();
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            clearTimeout(timer);
            reject(new Error(`Fallo la suscripcion al canal Realtime: ${status}`));
          }
        });
      }).catch(async (error) => {
        await this.client.removeChannel(channel!);
        this.channels.delete(name);
        throw error;
      });
      this.subscribed.add(name);
      logger.debug({ channel: name }, 'Canal Realtime suscrito');
    }
    return channel;
  }
}
