import express from 'express';
import cookieParser from 'cookie-parser';
import type { ServerEnv } from './config/env';
import { generalRateLimit } from './presentation/middleware/rate-limits';
import { csrfProtection } from './presentation/middleware/csrf';
import { errorHandler } from './presentation/middleware/errors';
import { createApiRouter } from './presentation/routes/index.routes';
import type { ApiContext } from './presentation/context';

export function createApp(env: ServerEnv, context: ApiContext): express.Express {
  const app = express();
  app.disable('x-powered-by');

  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    next();
  });

  const allowedOrigin = env.FRONTEND_URL;
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin === allowedOrigin) {
      res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Vary', 'Origin');
    }
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type,X-CSRF-Token');
      res.sendStatus(204);
      return;
    }
    next();
  });

  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());
  app.use(generalRateLimit);
  app.use(csrfProtection);
  app.use('/api', createApiRouter(context));

  app.use((_req, res) => {
    res.status(404).json({ error: 'NO_ENCONTRADO', mensaje: 'Ruta no encontrada' });
  });
  app.use(errorHandler);

  return app;
}
