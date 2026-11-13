import type { Pool, PoolClient } from 'pg';

// Puente transaccional para verificacion: desvia las consultas de la
// aplicacion al cliente de la transaccion del test usando SAVEPOINTs en
// lugar de BEGIN/COMMIT, de modo que todo el flujo (incluidos los
// votos, que son inmutables) queda dentro del ROLLBACK final y nada se
// persiste en la base de datos compartida.
//
// Lo comparten tests/integration (a traves de vi.mock de src/data/db) y
// scripts/dev/verify-flow.ts (a traves del reemplazo de pg.Pool).
export function createSavepointPool(getClient: () => PoolClient): Pool {
  let sequence = 0;
  // Las transacciones de la aplicacion se serializan: RELEASE SAVEPOINT y
  // ROLLBACK TO SAVEPOINT destruyen los savepoints creados despues, asi que
  // dos transacciones entrelazadas en el mismo cliente se pisarian entre si
  // (y un error de bookkeeping aborta la transaccion compartida del test).
  let tail: Promise<void> = Promise.resolve();
  return {
    connect: async (): Promise<PoolClient> => {
      let markDone: () => void = () => undefined;
      const previous = tail;
      tail = new Promise<void>((resolve) => {
        markDone = resolve;
      });
      await previous;
      const base = getClient();
      const stack: string[] = [];
      return {
        query: (async (text: string, values?: unknown[]) => {
          const sql = text.trim();
          const upper = sql.toUpperCase();
          // El backend abre con "BEGIN" o con "BEGIN; SET LOCAL ..."; ambas
          // formas se desvian al savepoint del test y el resto se ejecuta tal
          // cual sobre el cliente compartido.
          if (upper === 'BEGIN' || upper.startsWith('BEGIN;')) {
            const name = `sp_app_${++sequence}`;
            stack.push(name);
            await base.query(`SAVEPOINT ${name}`);
            const rest = sql.slice('BEGIN'.length).replace(/^\s*;\s*/, '');
            return rest.length > 0
              ? base.query(rest, values)
              : ({ rows: [], rowCount: 0, command: 'BEGIN', oid: 0, fields: [] } as never);
          }
          if (upper === 'COMMIT' || upper === 'ROLLBACK') {
            const name = stack.pop() ?? `sp_app_${++sequence}`;
            if (upper === 'ROLLBACK') {
              await base.query(`ROLLBACK TO SAVEPOINT ${name}`);
            }
            const released = await base.query(`RELEASE SAVEPOINT ${name}`);
            // SET LOCAL ROLE del backend dura hasta el fin de la transaccion
            // compartida del test: se limpia aqui para no dejar el rol aplicado
            // sobre las consultas propias del test.
            await base.query('RESET ROLE');
            return released;
          }
          return base.query(text, values);
        }) as PoolClient['query'],
        release: () => {
          markDone();
        }
      } as unknown as PoolClient;
    },
    query: (async () => {
      throw new Error('El pool transaccional no acepta consultas directas');
    }) as Pool['query'],
    end: async () => undefined
  } as unknown as Pool;
}
