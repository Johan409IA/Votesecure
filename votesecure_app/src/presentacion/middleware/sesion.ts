import { type NextFunction, type Request, type Response } from 'express';
import { ErrorNoAutenticado, ErrorProhibido } from '../../compartido/errores';
import { usuarioDeSesion } from '../../aplicacion/casos-uso/auth.casos';
import { hashToken, NOMBRE_COOKIE_SESION } from '../../aplicacion/servicios/sesiones';
import type { UsuarioSesion } from '../../aplicacion/politicas';

declare module 'express-serve-static-core' {
  interface Request {
    usuario?: UsuarioSesion;
  }
}

export async function autenticar(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const token = req.cookies?.[NOMBRE_COOKIE_SESION];
    if (!token || typeof token !== 'string') {
      throw new ErrorNoAutenticado();
    }
    const usuario = await usuarioDeSesion(hashToken(token));
    if (!usuario) {
      throw new ErrorNoAutenticado();
    }
    req.usuario = usuario;
    next();
  } catch (error) {
    next(error);
  }
}

export function requerirVerificado(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  if (!req.usuario) return next(new ErrorNoAutenticado());
  if (!req.usuario.correoVerificado) {
    return next(new ErrorProhibido('Debes verificar tu correo para usar esta funcion'));
  }
  next();
}

export function requerirRol(...tipos: UsuarioSesion['tipo'][]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.usuario) return next(new ErrorNoAutenticado());
    if (!tipos.includes(req.usuario.tipo)) {
      return next(new ErrorProhibido('Tu rol no permite esta operacion'));
    }
    next();
  };
}
