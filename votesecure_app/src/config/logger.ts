import pino from 'pino';

const esProduccion = process.env.NODE_ENV === 'production';

export const logger = pino(
  esProduccion
    ? { level: process.env.LOG_LEVEL ?? 'info' }
    : {
        level: process.env.LOG_LEVEL ?? 'debug',
        transport: {
          target: 'pino-pretty',
          options: { translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname' }
        }
      }
);
