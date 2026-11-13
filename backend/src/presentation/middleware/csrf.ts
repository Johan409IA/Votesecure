import type { NextFunction, Request, Response } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { ForbiddenError } from '../../shared/errors';
import { CSRF_COOKIE_NAME, SESSION_COOKIE_NAME } from '../../application/services/sessions';

const MUTATING_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

function normalizeOrigin(value: string): string {
  return value.replace(/\/+$/, '');
}

// §2.2: ademas del double-submit cookie/header, se valida que la cabecera
// Origin (cuando el cliente la envia) coincida con la URL autorizada del
// frontend. Referer no se exige: la API responde con
// Referrer-Policy: no-referrer y los navegadores no lo envian.
export function createCsrfProtection(allowedOrigin: string) {
  const target = normalizeOrigin(allowedOrigin);
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!MUTATING_METHODS.has(req.method)) {
      next();
      return;
    }
    const origin = req.headers.origin;
    if (
      typeof origin === 'string' &&
      origin.length > 0 &&
      normalizeOrigin(origin) !== target
    ) {
      next(new ForbiddenError('Origen no autorizado'));
      return;
    }
    const sessionCookie = req.cookies?.[SESSION_COOKIE_NAME];
    if (!sessionCookie) {
      next();
      return;
    }
    const header = req.headers['x-csrf-token'];
    const csrfCookie = req.cookies?.[CSRF_COOKIE_NAME];
    if (typeof header !== 'string' || typeof csrfCookie !== 'string') {
      next(new ForbiddenError('Token CSRF invalido'));
      return;
    }
    // F-011: comparacion de tiempo constante (timingSafeEqual exige longitudes
    // iguales, asi que la comparacion previa de longitud se mantiene).
    const headerBuffer = Buffer.from(header, 'utf8');
    const cookieBuffer = Buffer.from(csrfCookie, 'utf8');
    if (
      headerBuffer.length !== cookieBuffer.length ||
      !timingSafeEqual(headerBuffer, cookieBuffer)
    ) {
      next(new ForbiddenError('Token CSRF invalido'));
      return;
    }
    next();
  };
}
