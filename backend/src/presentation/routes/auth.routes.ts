import { Router } from 'express';
import { CSRF_COOKIE_NAME, SESSION_COOKIE_NAME } from '../../application/services/sessions';
import * as auth from '../../application/use-cases/auth.use-cases';
import { authenticate } from '../middleware/session';
import { validate, validateData } from '../middleware/validate';
import { loginRateLimit, registerRateLimit } from '../middleware/rate-limits';
import {
  loginSchema,
  registerSchema,
  verifyQuerySchema
} from '../dto/auth.dto';
import type { ApiContext } from '../context';

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
      const isProduction = ctx.env.NODE_ENV === 'production';
      const maxAge = ctx.env.SESION_TTL_HORAS * 60 * 60 * 1000;
      res.cookie(SESSION_COOKIE_NAME, session.sessionToken, {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'lax',
        maxAge,
        path: '/'
      });
      res.cookie(CSRF_COOKIE_NAME, session.csrfToken, {
        httpOnly: false,
        secure: isProduction,
        sameSite: 'lax',
        maxAge,
        path: '/'
      });
      res.json({ usuario: session.user });
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
    res.json({ usuario: req.user });
  });

  return router;
}
