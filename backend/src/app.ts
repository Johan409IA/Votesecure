import express from 'express';
import cookieParser from 'cookie-parser';
import type { EntornoServidor } from './config/env';
import { limiteGeneral } from './presentacion/middleware/limites';
import { protegerCsrf } from './presentacion/middleware/csrf';
import { manejarErrores } from './presentacion/middleware/errores';
import { crearEnrutadorApi } from './presentacion/rutas/index.rutas';
import type { ContextoApi } from './presentacion/contexto';

export function crearApp(entorno: EntornoServidor, contexto: ContextoApi): express.Express {
  const app = express();
  app.disable('x-powered-by');

  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    next();
  });

  const origenPermitido = entorno.FRONTEND_URL;
  app.use((req, res, next) => {
    const origen = req.headers.origin;
    if (origen === origenPermitido) {
      res.setHeader('Access-Control-Allow-Origin', origenPermitido);
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
  app.use(limiteGeneral);
  app.use(protegerCsrf);
  app.use('/api', crearEnrutadorApi(contexto));

  app.use((_req, res) => {
    res.status(404).json({ error: 'NO_ENCONTRADO', mensaje: 'Ruta no encontrada' });
  });
  app.use(manejarErrores);

  return app;
}
