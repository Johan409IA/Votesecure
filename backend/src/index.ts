import { loadServerEnv } from './config/env';
import { logger } from './config/logger';
import { createApp } from './app';
import { closePool } from './data/db';
import { ElectionScheduler } from './application/services/scheduler';
import { createContext } from './presentation/context';

async function main(): Promise<void> {
  const env = loadServerEnv();
  const context = createContext(env);
  const app = createApp(env, context);
  const server = app.listen(env.PORT, () => {
    logger.info(`Backend VoteSecure escuchando en el puerto ${env.PORT}`);
  });

  const scheduler = new ElectionScheduler(20_000);
  scheduler.start();

  let closing = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (closing) return;
    closing = true;
    logger.info(`Senal ${signal}: cierre ordenado en curso`);
    await scheduler.stop();
    await context.publisher.stop();
    server.close(() => {
      void closePool().finally(() => process.exit(0));
    });
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((error) => {
  logger.error({ error: String(error) }, 'Fallo el arranque del backend');
  process.exit(1);
});
