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

// §5.1: el ticket del canal es efímero, con vigencia de 60 s. La "ventana"
// es el minuto unix actual: el ticket de la ventana expira al comenzar la
// siguiente, de modo que todos los tickets emitidos en el mismo minuto
// derivan el mismo canal.
const WINDOW_SECONDS = 60;

function windowIndex(now: number): number {
  return Math.floor(now / 1000 / WINDOW_SECONDS);
}

export class ResultsPublisher {
  private client: SupabaseClient;
  private channels = new Map<string, RealtimeChannel>();
  private subscribed = new Set<string>();
  private channelWindows = new Map<string, number>();

  constructor(
    url: string,
    serviceKey: string,
    private secret: string
  ) {
    this.client = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
  }

  ticketFor(electionId: number, expUnix: number): string {
    return createHmac('sha256', this.secret)
      .update(`eleccion:${electionId}:exp:${expUnix}`)
      .digest('hex');
  }

  ticket(electionId: number, now: number = Date.now()): string {
    const expUnix = (windowIndex(now) + 1) * WINDOW_SECONDS;
    return this.ticketFor(electionId, expUnix);
  }

  channelName(electionId: number, now: number = Date.now()): string {
    return `resultados:${electionId}:${this.ticket(electionId, now)}`;
  }

  // Ticket y canal de la ventana actual, en una sola llamada para que ambos
  // correspondan siempre al mismo minuto.
  subscription(
    electionId: number,
    now: number = Date.now()
  ): { canal: string; expiraEn: number } {
    const index = windowIndex(now);
    const expiraEn = (index + 1) * WINDOW_SECONDS;
    return {
      canal: `resultados:${electionId}:${this.ticketFor(electionId, expiraEn)}`,
      expiraEn
    };
  }

  // Publica en los canales de la ventana actual y la anterior: los
  // suscriptores en vuelo no pierden eventos al rotar el ticket.
  async publish(electionId: number, load: ResultLoad): Promise<void> {
    const current = windowIndex(Date.now());
    const windows = current > 0 ? [current, current - 1] : [current];
    const liveNames = new Set<string>();
    for (const index of windows) {
      const expiraEn = (index + 1) * WINDOW_SECONDS;
      const name = `resultados:${electionId}:${this.ticketFor(electionId, expiraEn)}`;
      liveNames.add(name);
      const channel = await this.getChannel(name, index);
      const status = await channel.send({
        type: 'broadcast',
        event: 'resultado',
        payload: load
      });
      if (status !== 'ok') {
        throw new Error(`Realtime rechazo la publicacion: ${status}`);
      }
    }
    await this.pruneChannels(current);
  }

  // F-019: retira todos los canales de una eleccion (se invoca al cerrarla).
  async close(electionId: number): Promise<void> {
    const prefix = `resultados:${electionId}:`;
    for (const [name, channel] of [...this.channels]) {
      if (name.startsWith(prefix)) {
        await this.client.removeChannel(channel);
        this.channels.delete(name);
        this.subscribed.delete(name);
        this.channelWindows.delete(name);
        logger.debug({ channel: name }, 'Canal Realtime retirado al cerrar la eleccion');
      }
    }
  }

  async stop(): Promise<void> {
    for (const channel of this.channels.values()) {
      await this.client.removeChannel(channel);
    }
    this.channels.clear();
    this.subscribed.clear();
    this.channelWindows.clear();
  }

  // F-019: purga global por antiguedad de ventana (antes solo se purgaban los
  // canales de la eleccion publicada, y las elecciones sin trafico acumulaban
  // suscripciones para siempre).
  private async pruneChannels(currentIndex: number): Promise<void> {
    for (const [name, channel] of this.channels) {
      const index = this.channelWindows.get(name);
      if (index !== undefined && index < currentIndex - 1) {
        await this.client.removeChannel(channel);
        this.channels.delete(name);
        this.subscribed.delete(name);
        this.channelWindows.delete(name);
        logger.debug({ channel: name }, 'Canal Realtime retirado por ventana vencida');
      }
    }
  }

  private async getChannel(
    name: string,
    windowIndexValue: number
  ): Promise<RealtimeChannel> {
    let channel = this.channels.get(name);
    if (!channel) {
      channel = this.client.channel(name, {
        config: { broadcast: { self: false } }
      });
      this.channels.set(name, channel);
      this.channelWindows.set(name, windowIndexValue);
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
