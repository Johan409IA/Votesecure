import pino from 'pino';

const isProduction = process.env.NODE_ENV === 'production';

export const logger = pino(
  isProduction
    ? { level: process.env.LOG_LEVEL ?? 'info' }
    : {
        level: process.env.LOG_LEVEL ?? 'debug',
        transport: {
          target: 'pino-pretty',
          options: { translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname' }
        }
      }
);
