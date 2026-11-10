import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { ZodError, type ZodType } from 'zod';
import { ValidationError } from '../../shared/errors';

function zodMessage(error: ZodError): string {
  return (
    error.issues
      .map((issue) => `${issue.path.join('.') || 'dato'}: ${issue.message}`)
      .join('; ') || 'Datos invalidos'
  );
}

export function validate<T>(schema: ZodType<T>): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        next(new ValidationError(zodMessage(error)));
        return;
      }
      next(error);
    }
  };
}

export function validateData<T>(schema: ZodType<T>, data: unknown): T {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new ValidationError(zodMessage(error));
    }
    throw error;
  }
}
