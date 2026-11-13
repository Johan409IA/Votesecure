import { Router } from 'express';
import { z } from 'zod';
import * as auditUseCases from '../../application/use-cases/audit.use-cases';
import { authenticate, requireRole, requireVerified } from '../middleware/session';
import { validateData } from '../middleware/validate';
import { positiveInt } from '../dto/common.dto';
import type { ApiContext } from '../context';

const idParam = z.object({ id: positiveInt });

export function createAuditRoutes(_ctx: ApiContext): Router {
  const router = Router();

  router.get(
    '/auditoria/elecciones/:id',
    authenticate,
    requireVerified,
    requireRole('administrador'),
    async (req, res, next) => {
      try {
        const { id } = validateData(idParam, req.params);
        const events = await auditUseCases.listElectionAudit(req.user!, id);
        res.json({ eventos: events });
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}
