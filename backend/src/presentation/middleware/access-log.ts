import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { logger } from '../../config/logger';

declare module 'express-serve-static-core' {
  interface Request {
    requestId?: string;
  }
}

// F-021: identificador de correlacion por peticion y bitacora de acceso. El id
// se propaga al log (incluido el de errores) y a la cabecera de respuesta.
export function accessLog(req: Request, res: Response, next: NextFunction): void {
  const requestId = randomUUID();
  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;
    logger.info(
      {
        requestId,
        metodo: req.method,
        ruta: req.originalUrl,
        estado: res.statusCode,
        duracionMs: Math.round(durationMs * 100) / 100
      },
      'Peticion atendida'
    );
  });
  next();
}
