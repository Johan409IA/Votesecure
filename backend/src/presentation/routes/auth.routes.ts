import { Router } from 'express';
import { CSRF_COOKIE_NAME, SESSION_COOKIE_NAME } from '../../application/services/sessions';
import * as auth from '../../application/use-cases/auth.use-cases';
import * as userUseCases from '../../application/use-cases/user.use-cases';
import { authenticate } from '../middleware/session';
import { validate, validateData } from '../middleware/validate';
import { loginRateLimit, registerRateLimit } from '../middleware/rate-limits';
import {
  cambiarContrasenaSchema,
  loginSchema,
  registerSchema,
  verifyQuerySchema
} from '../dto/auth.dto';
import type { ApiContext } from '../context';
import type { SessionUser } from '../../application/policies';

// §10/Anexo B: las claves JSON del contrato van en español (convención del
// proyecto); los campos internos de TypeScript siguen en inglés.
function toPublicUser(user: SessionUser): {
  id: number;
  nombre: string;
  correo: string;
  tipo: SessionUser['type'];
  correoVerificado: boolean;
} {
  return {
    id: user.id,
    nombre: user.name,
    correo: user.email,
    tipo: user.type,
    correoVerificado: user.emailVerified
  };
}

export function createAuthRoutes(ctx: ApiContext): Router {
  const router = Router();

  router.post('/auth/registro', registerRateLimit, validate(registerSchema), async (req, res, next) => {
    try {
      await auth.registerUser(
        {
          name: req.body.nombre,
          email: req.body.correo,
          password: req.body.contrasena
        },
        ctx.mail,
        ctx.env.FRONTEND_URL
      );
      res
        .status(201)
        .json({ mensaje: 'Si el correo es valido recibiras un enlace de verificacion' });
    } catch (error) {
      next(error);
    }
  });

  router.post('/auth/login', loginRateLimit, validate(loginSchema), async (req, res, next) => {
    try {
      const session = await auth.login(
        { email: req.body.correo, password: req.body.contrasena },
        ctx.env.SESION_TTL_HORAS
      );
      // F-010: Secure se deriva del esquema del frontend (y en produccion
      // FRONTEND_URL es https por validacion), nunca de un valor por defecto.
      const secureCookies = new URL(ctx.env.FRONTEND_URL).protocol === 'https:';
      const maxAge = ctx.env.SESION_TTL_HORAS * 60 * 60 * 1000;
      res.cookie(SESSION_COOKIE_NAME, session.sessionToken, {
        httpOnly: true,
        secure: secureCookies,
        sameSite: 'lax',
        maxAge,
        path: '/'
      });
      res.cookie(CSRF_COOKIE_NAME, session.csrfToken, {
        httpOnly: false,
        secure: secureCookies,
        sameSite: 'lax',
        maxAge,
        path: '/'
      });
      res.json({ usuario: toPublicUser(session.user) });
    } catch (error) {
      next(error);
    }
  });

  router.post('/auth/logout', authenticate, async (req, res, next) => {
    try {
      await auth.logout(req.user!.id);
      res.clearCookie(SESSION_COOKIE_NAME, { path: '/' });
      res.clearCookie(CSRF_COOKIE_NAME, { path: '/' });
      res.json({ mensaje: 'Sesion cerrada' });
    } catch (error) {
      next(error);
    }
  });

  // F-009: cambio de contrasena del usuario autenticado; la sesion actual se
  // invalida en la BD, por lo que se limpian las cookies.
  router.post(
    '/auth/cambiar-contrasena',
    authenticate,
    validate(cambiarContrasenaSchema),
    async (req, res, next) => {
      try {
        await userUseCases.changePassword(
          req.user!,
          req.body.contrasenaActual,
          req.body.contrasenaNueva
        );
        res.clearCookie(SESSION_COOKIE_NAME, { path: '/' });
        res.clearCookie(CSRF_COOKIE_NAME, { path: '/' });
        res.json({ mensaje: 'Contrasena actualizada' });
      } catch (error) {
        next(error);
      }
    }
  );

  router.get('/auth/verificar', async (req, res) => {
    try {
      const { correo, token } = validateData(verifyQuerySchema, req.query);
      await auth.verifyEmail(correo, token);
      res.redirect(`${ctx.env.FRONTEND_URL}/verificar-correo?estado=ok`);
    } catch {
      res.redirect(`${ctx.env.FRONTEND_URL}/verificar-correo?estado=error`);
    }
  });

  router.get('/auth/yo', authenticate, (req, res) => {
    res.json({ usuario: toPublicUser(req.user!) });
  });

  return router;
}
