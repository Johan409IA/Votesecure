import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import * as electionUseCases from '../../application/use-cases/election.use-cases';
import * as voteUseCases from '../../application/use-cases/vote.use-cases';
import * as resultUseCases from '../../application/use-cases/result.use-cases';
import { ForbiddenError } from '../../shared/errors';
import { authenticate, requireVerified } from '../middleware/session';
import { validate, validateData } from '../middleware/validate';
import {
  cancelSchema,
  candidacySchema,
  createElectionSchema,
  updateElectionSchema,
  delegationSchema,
  voteSchema
} from '../dto/election.dto';
import type { ApiContext } from '../context';

function requireManagement(req: Request, _res: Response, next: NextFunction): void {
  if (req.user?.type !== 'administrador' && req.user?.type !== 'docente') {
    next(new ForbiddenError('Solo administradores o docentes gestionan elecciones'));
    return;
  }
  next();
}

const management = [authenticate, requireVerified, requireManagement];

const idParam = z.object({ id: z.coerce.number().int().positive() });
const electionAndCandidacyParam = z.object({
  id: z.coerce.number().int().positive(),
  candidaturaId: z.coerce.number().int().positive()
});
const electionAndEligibilityParam = z.object({
  id: z.coerce.number().int().positive(),
  habilitacionId: z.coerce.number().int().positive()
});
const sectionQuery = z.object({ seccionId: z.coerce.number().int().positive() });

export function createElectionRoutes(ctx: ApiContext): Router {
  const router = Router();

  router.get(
    '/elecciones/activas',
    authenticate,
    requireVerified,
    async (req, res, next) => {
      try {
        res.json({ elecciones: await electionUseCases.activeElectionsForStudent(req.user!) });
      } catch (error) {
        next(error);
      }
    }
  );

  router.get('/elecciones', authenticate, requireVerified, async (req, res, next) => {
    try {
      const { seccionId } = validateData(sectionQuery, req.query);
      res.json({ elecciones: await electionUseCases.listElections(req.user!, seccionId) });
    } catch (error) {
      next(error);
    }
  });

  router.post('/elecciones', ...management, validate(createElectionSchema), async (req, res, next) => {
    try {
      const election = await electionUseCases.createElection(req.user!, {
        sectionId: req.body.seccionId,
        name: req.body.nombre,
        startsAt: req.body.iniciaEn,
        endsAt: req.body.cierraEn,
        type: req.body.tipo,
        originElectionId: req.body.eleccionOrigenId
      });
      res.status(201).json({ eleccion: election });
    } catch (error) {
      next(error);
    }
  });

  router.get('/elecciones/:id', authenticate, requireVerified, async (req, res, next) => {
    try {
      const { id } = validateData(idParam, req.params);
      const user = req.user!;
      const detail = await electionUseCases.electionDetail(id);
      if (user.type === 'estudiante') {
        const member = await resultUseCases.isSectionMember(
          user.id,
          detail.election.sectionId
        );
        if (!member && detail.election.status !== 'cerrada') {
          next(new ForbiddenError('No perteneces a la seccion de esta eleccion'));
          return;
        }
      }
      res.json(detail);
    } catch (error) {
      next(error);
    }
  });

  router.patch(
    '/elecciones/:id',
    ...management,
    validate(updateElectionSchema),
    async (req, res, next) => {
      try {
        const { id } = validateData(idParam, req.params);
        await electionUseCases.updateElection(req.user!, id, {
          name: req.body.nombre,
          startsAt: req.body.iniciaEn,
          endsAt: req.body.cierraEn
        });
        res.json({ mensaje: 'Eleccion actualizada' });
      } catch (error) {
        next(error);
      }
    }
  );

  router.post(
    '/elecciones/:id/candidaturas',
    ...management,
    validate(candidacySchema),
    async (req, res, next) => {
      try {
        const { id } = validateData(idParam, req.params);
        const candidacy = await electionUseCases.addCandidacy(
          req.user!,
          id,
          req.body.matriculaId
        );
        res.status(201).json({ candidatura: candidacy });
      } catch (error) {
        next(error);
      }
    }
  );

  router.delete(
    '/elecciones/:id/candidaturas/:candidaturaId',
    ...management,
    async (req, res, next) => {
      try {
        const { id, candidaturaId } = validateData(electionAndCandidacyParam, req.params);
        await electionUseCases.removeCandidacy(req.user!, id, candidaturaId);
        res.json({ mensaje: 'Candidatura retirada' });
      } catch (error) {
        next(error);
      }
    }
  );

  router.post(
    '/elecciones/:id/habilitaciones',
    ...management,
    validate(candidacySchema),
    async (req, res, next) => {
      try {
        const { id } = validateData(idParam, req.params);
        const eligibility = await electionUseCases.addEligibility(
          req.user!,
          id,
          req.body.matriculaId
        );
        res.status(201).json({ habilitacion: eligibility });
      } catch (error) {
        next(error);
      }
    }
  );

  router.delete(
    '/elecciones/:id/habilitaciones/:habilitacionId',
    ...management,
    async (req, res, next) => {
      try {
        const { id, habilitacionId } = validateData(electionAndEligibilityParam, req.params);
        await electionUseCases.removeEligibility(req.user!, id, habilitacionId);
        res.json({ mensaje: 'Habilitacion retirada' });
      } catch (error) {
        next(error);
      }
    }
  );

  router.post('/elecciones/:id/programar', ...management, async (req, res, next) => {
    try {
      const { id } = validateData(idParam, req.params);
      await electionUseCases.scheduleElection(req.user!, id);
      res.json({ mensaje: 'Eleccion programada' });
    } catch (error) {
      next(error);
    }
  });

  router.post('/elecciones/:id/activar', ...management, async (req, res, next) => {
    try {
      const { id } = validateData(idParam, req.params);
      await electionUseCases.activateElection(req.user!, id);
      res.json({ mensaje: 'Eleccion activada' });
    } catch (error) {
      next(error);
    }
  });

  router.post(
    '/elecciones/:id/cancelar',
    ...management,
    validate(cancelSchema),
    async (req, res, next) => {
      try {
        const { id } = validateData(idParam, req.params);
        await electionUseCases.cancelElection(req.user!, id, req.body.motivo);
        res.json({ mensaje: 'Eleccion cancelada' });
      } catch (error) {
        next(error);
      }
    }
  );

  router.post(
    '/elecciones/:id/cerrar',
    ...management,
    async (req, res, next) => {
      try {
        const { id } = validateData(idParam, req.params);
        await electionUseCases.closeElection(req.user!, ctx.publisher, id);
        res.json({ mensaje: 'Eleccion cerrada' });
      } catch (error) {
        next(error);
      }
    }
  );

  router.post(
    '/elecciones/:id/votar',
    authenticate,
    requireVerified,
    validate(voteSchema),
    async (req, res, next) => {
      try {
        const { id } = validateData(idParam, req.params);
        const confirmation = await voteUseCases.castVote(
          req.user!,
          ctx.publisher,
          id,
          req.body.candidaturaId
        );
        res.status(201).json(confirmation);
      } catch (error) {
        next(error);
      }
    }
  );

  router.get(
    '/elecciones/:id/resultados',
    authenticate,
    requireVerified,
    async (req, res, next) => {
      try {
        const { id } = validateData(idParam, req.params);
        res.json(await resultUseCases.getResults(req.user!, id));
      } catch (error) {
        next(error);
      }
    }
  );

  router.post(
    '/elecciones/:id/proclamar',
    ...management,
    validate(delegationSchema),
    async (req, res, next) => {
      try {
        const { id } = validateData(idParam, req.params);
        const delegationId = await electionUseCases.proclaimDelegate(
          req.user!,
          id,
          req.body.iniciaEn,
          req.body.terminaEn ?? null
        );
        res.status(201).json({ delegacionId: delegationId });
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}
