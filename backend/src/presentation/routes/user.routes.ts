import { Router } from 'express';
import { z } from 'zod';
import * as userUseCases from '../../application/use-cases/user.use-cases';
import { authenticate, requireRole, requireVerified } from '../middleware/session';
import { validate, validateData } from '../middleware/validate';
import { activeToggleSchema } from '../dto/election.dto';
import { photoSchema, listUsersQuerySchema } from '../dto/user.dto';
import { positiveInt } from '../dto/common.dto';
import type { ApiContext } from '../context';

const idParam = z.object({ id: positiveInt });

function toPublicUserSummary(user: userUseCases.UserSummary): {
  id: number;
  nombre: string;
  correo: string;
  tipo: string;
  correoVerificado: boolean;
  activa: boolean;
} {
  return {
    id: user.id,
    nombre: user.name,
    correo: user.email,
    tipo: user.userType,
    correoVerificado: user.emailVerified,
    activa: user.active
  };
}

export function createUserRoutes(_ctx: ApiContext): Router {
  const router = Router();

  // GET /usuarios: listado y busqueda de cuentas para el administrador.
  router.get(
    '/usuarios',
    authenticate,
    requireVerified,
    requireRole('administrador'),
    async (req, res, next) => {
      try {
        const filters = validateData(listUsersQuerySchema, req.query);
        const usuarios = await userUseCases.listUsers(req.user!, filters);
        res.json({ usuarios: usuarios.map(toPublicUserSummary) });
      } catch (error) {
        next(error);
      }
    }
  );

  // Foto de perfil propia (sql/009: actualizar_foto_usuario SECURITY DEFINER).
  router.post(
    '/usuarios/yo/foto',
    authenticate,
    requireVerified,
    validate(photoSchema),
    async (req, res, next) => {
      try {
        await userUseCases.updateOwnPhoto(req.user!, req.body.imagen);
        res.status(201).json({ mensaje: 'Foto actualizada' });
      } catch (error) {
        next(error);
      }
    }
  );

  router.delete('/usuarios/yo/foto', authenticate, requireVerified, async (req, res, next) => {
    try {
      await userUseCases.removeOwnPhoto(req.user!);
      res.json({ mensaje: 'Foto eliminada' });
    } catch (error) {
      next(error);
    }
  });

  router.patch(
    '/usuarios/:id',
    authenticate,
    requireVerified,
    requireRole('administrador'),
    validate(activeToggleSchema),
    async (req, res, next) => {
      try {
        const { id } = validateData(idParam, req.params);
        await userUseCases.setUserActive(req.user!, id, req.body.activa);
        res.json({ mensaje: 'Usuario actualizado' });
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}
