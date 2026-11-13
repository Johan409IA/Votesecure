import express from 'express';
import cookieParser from 'cookie-parser';
import type { ServerEnv } from './config/env';
import { accessLog } from './presentation/middleware/access-log';
import { generalRateLimit } from './presentation/middleware/rate-limits';
import { createCsrfProtection } from './presentation/middleware/csrf';
import { errorHandler } from './presentation/middleware/errors';
import { createApiRouter } from './presentation/routes/index.routes';
import type { ApiContext } from './presentation/context';

export function createApp(env: ServerEnv, context: ApiContext): express.Express {
  const app = express();
  app.disable('x-powered-by');
  // Detras de un proxy inverso, el numero de saltos debe ser exacto (1 en
  // Render): nunca `true`, porque permitiria falsear X-Forwarded-For y evadir
  // los limites de tasa. Sin proxy, 0 conserva la IP real del cliente.
  app.set('trust proxy', env.TRUST_PROXY_HOPS);

  // F-021: requestId + bitacora de acceso, primero para cubrir toda peticion.
  app.use(accessLog);

  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    // F-015: defensa en profundidad para una API JSON pura: nada en cache (los
    // tickets de Realtime y los resultados son sensibles), sin frames y sin
    // recursos cruzados. HSTS lo ignora el navegador sobre http.
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000');
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
  app.use(createCsrfProtection(env.FRONTEND_URL));
  app.use('/api', createApiRouter(context));

  app.use((_req, res) => {
    res.status(404).json({ error: 'NO_ENCONTRADO', mensaje: 'Ruta no encontrada' });
  });
  app.use(errorHandler);

  return app;
}
