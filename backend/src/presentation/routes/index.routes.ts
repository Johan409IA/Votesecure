import { Router } from 'express';
import { createAuthRoutes } from './auth.routes';
import { createSectionRoutes } from './section.routes';
import { createElectionRoutes } from './election.routes';
import { createResultRoutes } from './result.routes';
import { createAuditRoutes } from './audit.routes';
import { createEvaluationRoutes } from './evaluation.routes';
import type { ApiContext } from '../context';

export function createApiRouter(ctx: ApiContext): Router {
  const router = Router();

  router.get('/salud', (_req, res) => {
    res.json({ estado: 'ok', servicio: 'votesecure-backend' });
  });

  router.use(createAuthRoutes(ctx));
  router.use(createSectionRoutes(ctx));
  router.use(createElectionRoutes(ctx));
  router.use(createResultRoutes(ctx));
  router.use(createAuditRoutes(ctx));
  router.use(createEvaluationRoutes(ctx));

  return router;
}
