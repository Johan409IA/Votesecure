import { Router } from 'express';
import { z } from 'zod';
import * as academicUseCases from '../../application/use-cases/academic.use-cases';
import { authenticate, requireRole, requireVerified } from '../middleware/session';
import { joinRateLimit } from '../middleware/rate-limits';
import { validate, validateData } from '../middleware/validate';
import { positiveInt } from '../dto/common.dto';
import {
  activeToggleSchema,
  assignmentSchema,
  enrollmentSchema,
  joinSectionSchema,
  sectionSchema
} from '../dto/election.dto';
import type { ApiContext } from '../context';

const idParam = z.object({ id: positiveInt });

export function createSectionRoutes(_ctx: ApiContext): Router {
  const router = Router();

  router.get('/secciones', authenticate, requireVerified, async (req, res, next) => {
    try {
      res.json({ secciones: await academicUseCases.visibleSections(req.user!) });
    } catch (error) {
      next(error);
    }
  });

  router.post(
    '/secciones',
    authenticate,
    requireVerified,
    // §10: la creacion de secciones es de Docente / Admin.
    requireRole('docente', 'administrador'),
    validate(sectionSchema),
    async (req, res, next) => {
      try {
        const section = await academicUseCases.createSection(req.user!, {
          courseCode: req.body.codigoCurso,
          courseName: req.body.nombreCurso,
          academicPeriod: req.body.periodoAcademico
        });
        res.status(201).json({ seccion: section });
      } catch (error) {
        next(error);
      }
    }
  );

  router.post(
    '/secciones/unirse',
    joinRateLimit,
    authenticate,
    requireVerified,
    requireRole('estudiante'),
    validate(joinSectionSchema),
    async (req, res, next) => {
      try {
        const section = await academicUseCases.joinSection(
          req.body.codigo,
          req.user!.id
        );
        res.json({ seccion: section });
      } catch (error) {
        next(error);
      }
    }
  );

  router.get('/secciones/:id', authenticate, requireVerified, async (req, res, next) => {
    try {
      const { id } = validateData(idParam, req.params);
      res.json({ seccion: await academicUseCases.getSection(req.user!, id) });
    } catch (error) {
      next(error);
    }
  });

  router.patch(
    '/secciones/:id',
    authenticate,
    requireVerified,
    // §3.1: "Bloquear inscripciones" es del docente responsable; el caso
    // de uso exige asignacion activa o rol administrador.
    requireRole('docente', 'administrador'),
    validate(activeToggleSchema),
    async (req, res, next) => {
      try {
        const { id } = validateData(idParam, req.params);
        await academicUseCases.setSectionActive(req.user!, id, req.body.activa);
        res.json({ mensaje: 'Seccion actualizada' });
      } catch (error) {
        next(error);
      }
    }
  );

  router.post(
    '/secciones/:id/matriculas',
    authenticate,
    requireVerified,
    requireRole('administrador'),
    validate(enrollmentSchema),
    async (req, res, next) => {
      try {
        const { id } = validateData(idParam, req.params);
        const enrollment = await academicUseCases.createEnrollment(
          id,
          req.body.estudianteId
        );
        res.status(201).json({ matricula: enrollment });
      } catch (error) {
        next(error);
      }
    }
  );

  router.get(
    '/secciones/:id/matriculas',
    authenticate,
    requireVerified,
    async (req, res, next) => {
      try {
        const { id } = validateData(idParam, req.params);
        res.json({ matriculas: await academicUseCases.listEnrollments(req.user!, id) });
      } catch (error) {
        next(error);
      }
    }
  );

  router.patch(
    '/matriculas/:id',
    authenticate,
    requireVerified,
    requireRole('administrador'),
    validate(activeToggleSchema),
    async (req, res, next) => {
      try {
        const { id } = validateData(idParam, req.params);
        await academicUseCases.setEnrollmentActive(id, req.body.activa);
        res.json({ mensaje: 'Matricula actualizada' });
      } catch (error) {
        next(error);
      }
    }
  );

  router.post(
    '/secciones/:id/asignaciones',
    authenticate,
    requireVerified,
    requireRole('administrador'),
    validate(assignmentSchema),
    async (req, res, next) => {
      try {
        const { id } = validateData(idParam, req.params);
        const assignment = await academicUseCases.createAssignment(
          id,
          req.body.docenteId
        );
        res.status(201).json({ asignacion: assignment });
      } catch (error) {
        next(error);
      }
    }
  );

  router.get(
    '/secciones/:id/asignaciones',
    authenticate,
    requireVerified,
    async (req, res, next) => {
      try {
        const { id } = validateData(idParam, req.params);
        res.json({ asignaciones: await academicUseCases.listAssignments(req.user!, id) });
      } catch (error) {
        next(error);
      }
    }
  );

  router.patch(
    '/asignaciones/:id',
    authenticate,
    requireVerified,
    requireRole('administrador'),
    validate(activeToggleSchema),
    async (req, res, next) => {
      try {
        const { id } = validateData(idParam, req.params);
        await academicUseCases.setAssignmentActive(id, req.body.activa);
        res.json({ mensaje: 'Asignacion actualizada' });
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}
