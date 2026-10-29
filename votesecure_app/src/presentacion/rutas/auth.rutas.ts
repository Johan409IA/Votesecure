import { Router } from 'express';
import { NOMBRE_COOKIE_CSRF, NOMBRE_COOKIE_SESION } from '../../aplicacion/servicios/sesiones';
import * as auth from '../../aplicacion/casos-uso/auth.casos';
import { autenticar } from '../middleware/sesion';
import { validar, validarDato } from '../middleware/validar';
import { limiteLogin, limiteRegistro } from '../middleware/limites';
import {
  loginSchema,
  registroSchema,
  verificarQuerySchema
} from '../dto/auth.dto';
import type { ContextoApi } from '../contexto';

export function crearRutasAuth(ctx: ContextoApi): Router {
  const router = Router();

  router.post('/auth/registro', limiteRegistro, validar(registroSchema), async (req, res, next) => {
    try {
      await auth.registrarUsuario(req.body, ctx.correo, ctx.entorno.FRONTEND_URL);
      res
        .status(201)
        .json({ mensaje: 'Si el correo es valido recibiras un enlace de verificacion' });
    } catch (error) {
      next(error);
    }
  });

  router.post('/auth/login', limiteLogin, validar(loginSchema), async (req, res, next) => {
    try {
      const sesion = await auth.iniciarSesion(req.body, ctx.entorno.SESION_TTL_HORAS);
      const esProduccion = ctx.entorno.NODE_ENV === 'production';
      const maxAge = ctx.entorno.SESION_TTL_HORAS * 60 * 60 * 1000;
      res.cookie(NOMBRE_COOKIE_SESION, sesion.tokenSesion, {
        httpOnly: true,
        secure: esProduccion,
        sameSite: 'lax',
        maxAge,
        path: '/'
      });
      res.cookie(NOMBRE_COOKIE_CSRF, sesion.tokenCsrf, {
        httpOnly: false,
        secure: esProduccion,
        sameSite: 'lax',
        maxAge,
        path: '/'
      });
      res.json({ usuario: sesion.usuario });
    } catch (error) {
      next(error);
    }
  });

  router.post('/auth/logout', autenticar, async (req, res, next) => {
    try {
      await auth.cerrarSesion(req.usuario!.id);
      res.clearCookie(NOMBRE_COOKIE_SESION, { path: '/' });
      res.clearCookie(NOMBRE_COOKIE_CSRF, { path: '/' });
      res.json({ mensaje: 'Sesion cerrada' });
    } catch (error) {
      next(error);
    }
  });

  router.get('/auth/verificar', async (req, res) => {
    try {
      const { correo, token } = validarDato(verificarQuerySchema, req.query);
      await auth.verificarCorreo(correo, token);
      res.redirect(`${ctx.entorno.FRONTEND_URL}/verificar-correo?estado=ok`);
    } catch {
      res.redirect(`${ctx.entorno.FRONTEND_URL}/verificar-correo?estado=error`);
    }
  });

  router.get('/auth/yo', autenticar, (req, res) => {
    res.json({ usuario: req.usuario });
  });

  return router;
}
