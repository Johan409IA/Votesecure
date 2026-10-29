import type { ErrorRequestHandler, NextFunction, Request, Response } from 'express';
import { logger } from '../../config/logger';
import { ErrorAplicacion } from '../../compartido/errores';

export const manejarErrores: ErrorRequestHandler = (
  error: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  if (error instanceof ErrorAplicacion) {
    res.status(error.estadoHttp).json({
      error: error.codigo,
      mensaje: error.message
    });
    return;
  }
  logger.error(
    { error: error instanceof Error ? error.stack : String(error), ruta: req.path },
    'Error no controlado'
  );
  res.status(500).json({ error: 'INTERNO', mensaje: 'Error interno del servidor' });
};
