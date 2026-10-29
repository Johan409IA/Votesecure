import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { ZodError, type ZodType } from 'zod';
import { ErrorValidacion } from '../../compartido/errores';

function mensajeZod(error: ZodError): string {
  return (
    error.issues
      .map((i) => `${i.path.join('.') || 'dato'}: ${i.message}`)
      .join('; ') || 'Datos invalidos'
  );
}

export function validar<T>(esquema: ZodType<T>): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      req.body = esquema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        next(new ErrorValidacion(mensajeZod(error)));
        return;
      }
      next(error);
    }
  };
}

export function validarDato<T>(esquema: ZodType<T>, dato: unknown): T {
  try {
    return esquema.parse(dato);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new ErrorValidacion(mensajeZod(error));
    }
    throw error;
  }
}
