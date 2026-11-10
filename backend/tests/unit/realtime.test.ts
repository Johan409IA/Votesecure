import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { ResultsPublisher } from '../../src/application/services/realtime';

const SECRET = 'secreto-de-prueba';

function publisher(): ResultsPublisher {
  return new ResultsPublisher('https://ejemplo.supabase.co', 'clave-anon', SECRET);
}

function expectedTicket(electionId: number, expUnix: number): string {
  return createHmac('sha256', SECRET)
    .update(`eleccion:${electionId}:exp:${expUnix}`)
    .digest('hex');
}

describe('ticket HMAC efimero del canal de resultados', () => {
  it('deriva el ticket del formato eleccion:{id}:exp:{expUnix}', () => {
    const pub = publisher();
    const now = Date.UTC(2026, 10, 10, 12, 30, 15) / 1000;
    expect(pub.ticket(7, now * 1000)).toBe(expectedTicket(7, (Math.floor(now / 60) + 1) * 60));
  });

  it('es estable dentro de la misma ventana de un minuto', () => {
    const pub = publisher();
    const base = Date.UTC(2026, 10, 10, 12, 30, 0);
    expect(pub.ticket(7, base)).toBe(pub.ticket(7, base + 59_000));
  });

  it('rota al cambiar la ventana', () => {
    const pub = publisher();
    const base = Date.UTC(2026, 10, 10, 12, 30, 0);
    expect(pub.ticket(7, base)).not.toBe(pub.ticket(7, base + 61_000));
  });

  it('subscription devuelve canal y expiraEn coherentes con la ventana', () => {
    const pub = publisher();
    const now = Date.UTC(2026, 10, 10, 12, 30, 15);
    const { canal, expiraEn } = pub.subscription(7, now);
    expect(canal).toBe(`resultados:7:${expectedTicket(7, expiraEn)}`);
    expect(canal).toBe(pub.channelName(7, now));
    const vigenciaSegundos = expiraEn - now / 1000;
    expect(vigenciaSegundos).toBeGreaterThan(0);
    expect(vigenciaSegundos).toBeLessThanOrEqual(60);
  });

  it('publica en los canales de la ventana actual y la anterior', async () => {
    const pub = publisher();
    const base = Date.now();
    const actual = Math.floor(base / 1000 / 60);
    const canalActual = `resultados:7:${expectedTicket(7, (actual + 1) * 60)}`;
    const canalAnterior = `resultados:7:${expectedTicket(7, actual * 60)}`;
    const enviados: string[] = [];
    const fakeChannel = (name: string) => ({
      send: () => {
        enviados.push(name);
        return Promise.resolve('ok');
      }
    });
    const client = (pub as unknown as { client: { channel: (n: string) => unknown } }).client;
    client.channel = (name: string) => fakeChannel(name);
    // Evita la suscripcion real: marca los canales como ya suscritos.
    const internals = pub as unknown as {
      channels: Map<string, unknown>;
      channelWindows: Map<string, number>;
      subscribed: Set<string>;
    };
    for (const name of [canalActual, canalAnterior]) {
      internals.channels.set(name, fakeChannel(name));
      internals.channelWindows.set(name, name === canalActual ? actual : actual - 1);
      internals.subscribed.add(name);
    }
    await pub.publish(
      7,
      {
        eleccionId: 7,
        estado: 'activa',
        totalHabilitados: 0,
        totalParticipantes: 0,
        totalVotos: 0,
        candidaturas: []
      }
    );
    expect(enviados.sort()).toEqual([canalActual, canalAnterior].sort());
  });
});
