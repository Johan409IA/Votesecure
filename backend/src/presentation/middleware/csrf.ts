import type { NextFunction, Request, Response } from 'express';
import { ForbiddenError } from '../../shared/errors';
import { CSRF_COOKIE_NAME, SESSION_COOKIE_NAME } from '../../application/services/sessions';

const MUTATING_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

export function csrfProtection(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  if (!MUTATING_METHODS.has(req.method)) {
    next();
    return;
  }
  const sessionCookie = req.cookies?.[SESSION_COOKIE_NAME];
  if (!sessionCookie) {
    next();
    return;
  }
  const header = req.headers['x-csrf-token'];
  const csrfCookie = req.cookies?.[CSRF_COOKIE_NAME];
  if (
    typeof header !== 'string' ||
    typeof csrfCookie !== 'string' ||
    header.length !== csrfCookie.length ||
    header !== csrfCookie
  ) {
    next(new ForbiddenError('Token CSRF invalido'));
    return;
  }
  next();
}
