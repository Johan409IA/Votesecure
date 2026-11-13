import { Router } from 'express';
import { z } from 'zod';
import * as userUseCases from '../../application/use-cases/user.use-cases';
import { authenticate, requireRole, requireVerified } from '../middleware/session';
import { validate, validateData } from '../middleware/validate';
import { activeToggleSchema } from '../dto/election.dto';
import { positiveInt } from '../dto/common.dto';
import type { ApiContext } from '../context';

const idParam = z.object({ id: positiveInt });

export function createUserRoutes(_ctx: ApiContext): Router {
  const router = Router();

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
