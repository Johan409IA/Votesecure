import { type NextFunction, type Request, type Response } from 'express';
import { UnauthenticatedError, ForbiddenError } from '../../shared/errors';
import { userFromSession } from '../../application/use-cases/auth.use-cases';
import { hashToken, SESSION_COOKIE_NAME } from '../../application/services/sessions';
import type { SessionUser } from '../../application/policies';

declare module 'express-serve-static-core' {
  interface Request {
    user?: SessionUser;
  }
}

export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const token = req.cookies?.[SESSION_COOKIE_NAME];
    if (!token || typeof token !== 'string') {
      throw new UnauthenticatedError();
    }
    const user = await userFromSession(hashToken(token));
    if (!user) {
      throw new UnauthenticatedError();
    }
    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}

export function requireVerified(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  if (!req.user) return next(new UnauthenticatedError());
  if (!req.user.emailVerified) {
    return next(new ForbiddenError('Debes verificar tu correo para usar esta funcion'));
  }
  next();
}

export function requireRole(...types: SessionUser['type'][]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) return next(new UnauthenticatedError());
    if (!types.includes(req.user.type)) {
      return next(new ForbiddenError('Tu rol no permite esta operacion'));
    }
    next();
  };
}
