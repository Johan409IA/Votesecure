import type { NextFunction, Request, Response } from 'express';
import { ErrorProhibido } from '../../compartido/errores';
import { NOMBRE_COOKIE_CSRF, NOMBRE_COOKIE_SESION } from '../../aplicacion/servicios/sesiones';

const METODOS_MUTANTES = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

export function protegerCsrf(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  if (!METODOS_MUTANTES.has(req.method)) {
    next();
    return;
  }
  const cookieSesion = req.cookies?.[NOMBRE_COOKIE_SESION];
  if (!cookieSesion) {
    next();
    return;
  }
  const header = req.headers['x-csrf-token'];
  const cookieCsrf = req.cookies?.[NOMBRE_COOKIE_CSRF];
  if (
    typeof header !== 'string' ||
    typeof cookieCsrf !== 'string' ||
    header.length !== cookieCsrf.length ||
    header !== cookieCsrf
  ) {
    next(new ErrorProhibido('Token CSRF invalido'));
    return;
  }
  next();
}
