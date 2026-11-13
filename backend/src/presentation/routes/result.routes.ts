import { Router } from 'express';
import { z } from 'zod';
import * as resultUseCases from '../../application/use-cases/result.use-cases';
import { authenticate, requireVerified } from '../middleware/session';
import { validateData } from '../middleware/validate';
import { positiveInt } from '../dto/common.dto';
import type { ApiContext } from '../context';

const idParam = z.object({ id: positiveInt });

export function createResultRoutes(ctx: ApiContext): Router {
  const router = Router();

  router.post(
    '/resultados/:id/suscripcion',
    authenticate,
    requireVerified,
    async (req, res, next) => {
      try {
        const { id } = validateData(idParam, req.params);
        res.json(await resultUseCases.subscriptionTicket(req.user!, ctx.publisher, id));
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}
