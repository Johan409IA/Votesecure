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
    await Promise.allSettled([scheduler.stop(), context.publisher.stop()]);
    server.close(() => {
      void closePool().finally(() => process.exit(0));
    });
    // Cierra las conexiones keep-alive vivas para que server.close complete.
    server.closeAllConnections();
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  // F-016: sin estos manejadores, un rechazo no capturado termina el proceso
  // (Node >= 15) en pleno dia de votacion en lugar de degradar una funcionalidad.
  process.on('unhandledRejection', (reason) => {
    logger.error({ error: String(reason) }, 'Promesa rechazada sin manejar');
  });
  process.on('uncaughtException', (error) => {
    logger.error(
      { error: error.stack ?? String(error) },
      'Excepcion no capturada: cierre ordenado'
    );
    void shutdown('uncaughtException');
  });
}

main().catch((error) => {
  logger.error({ error: String(error) }, 'Fallo el arranque del backend');
  process.exit(1);
});
