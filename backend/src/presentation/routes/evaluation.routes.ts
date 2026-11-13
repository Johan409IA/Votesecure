import { Router } from 'express';
import * as evaluationUseCases from '../../application/use-cases/evaluation.use-cases';
import { authenticate, requireRole, requireVerified } from '../middleware/session';
import { validate, validateData } from '../middleware/validate';
import { evaluationPeriodSchema } from '../dto/election.dto';
import { evaluateSchema, sectionQuerySchema } from '../dto/evaluation.dto';
import type { ApiContext } from '../context';

export function createEvaluationRoutes(_ctx: ApiContext): Router {
  const router = Router();

  router.get(
    '/evaluaciones/delegado',
    authenticate,
    requireVerified,
    async (req, res, next) => {
      try {
        const { seccionId } = validateData(sectionQuerySchema, req.query);
        res.json(await evaluationUseCases.viewDelegate(req.user!, seccionId));
      } catch (error) {
        next(error);
      }
    }
  );

  router.post(
    '/evaluaciones',
    authenticate,
    requireVerified,
    validate(evaluateSchema),
    async (req, res, next) => {
      try {
        await evaluationUseCases.evaluateDelegate(req.user!, {
          sectionId: req.body.seccionId,
          grade: req.body.calificacion,
          comment: req.body.comentario,
          periodId: req.body.periodoId
        });
        res.status(201).json({ mensaje: 'Evaluacion registrada' });
      } catch (error) {
        next(error);
      }
    }
  );

  router.get(
    '/evaluaciones/resumen',
    authenticate,
    requireVerified,
    async (req, res, next) => {
      try {
        const { seccionId } = validateData(sectionQuerySchema, req.query);
        res.json({
          resumen: await evaluationUseCases.evaluationSummary(req.user!, seccionId)
        });
      } catch (error) {
        next(error);
      }
    }
  );

  router.post(
    '/evaluaciones/periodos',
    authenticate,
    requireVerified,
    requireRole('docente', 'administrador'),
    validate(evaluationPeriodSchema),
    async (req, res, next) => {
      try {
        const periodId = await evaluationUseCases.createEvaluationPeriod(
          req.user!,
          req.body.delegacionId,
          req.body.abreEn,
          req.body.cierraEn,
          req.body.instrucciones
        );
        res.status(201).json({ periodoId: periodId });
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}
