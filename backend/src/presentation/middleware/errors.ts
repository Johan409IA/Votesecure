import type { ErrorRequestHandler, NextFunction, Request, Response } from 'express';
import { logger } from '../../config/logger';
import { AppError } from '../../shared/errors';

export const errorHandler: ErrorRequestHandler = (
  error: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  if (error instanceof AppError) {
    res.status(error.httpStatus).json({
      error: error.code,
      mensaje: error.message
    });
    return;
  }
  logger.error(
    {
      requestId: req.requestId,
      error: error instanceof Error ? error.stack : String(error),
      ruta: req.path
    },
    'Error no controlado'
  );
  res.status(500).json({ error: 'INTERNO', mensaje: 'Error interno del servidor' });
};
