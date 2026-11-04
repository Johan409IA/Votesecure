import { Router } from 'express';
import { z } from 'zod';
import * as academicos from '../../aplicacion/casos-uso/academicos.casos';
import { autenticar, requerirRol, requerirVerificado } from '../middleware/sesion';
import { validar, validarDato } from '../middleware/validar';
import {
  activarToggleSchema,
  asignacionSchema,
  matriculaSchema,
  seccionSchema
} from '../dto/elecciones.dto';
import type { ContextoApi } from '../contexto';

const idParam = z.object({ id: z.coerce.number().int().positive() });

export function crearRutasSecciones(_ctx: ContextoApi): Router {
  const router = Router();

  router.get('/secciones', autenticar, requerirVerificado, async (req, res, next) => {
    try {
      res.json({ secciones: await academicos.seccionesVisibles(req.usuario!) });
    } catch (error) {
      next(error);
    }
  });

  router.post(
    '/secciones',
    autenticar,
    requerirVerificado,
    requerirRol('administrador'),
    validar(seccionSchema),
    async (req, res, next) => {
      try {
        const seccion = await academicos.crearSeccion(req.body);
        res.status(201).json({ seccion });
      } catch (error) {
        next(error);
      }
    }
  );

  router.get('/secciones/:id', autenticar, requerirVerificado, async (req, res, next) => {
    try {
      const { id } = validarDato(idParam, req.params);
      res.json({ seccion: await academicos.obtenerSeccion(id) });
    } catch (error) {
      next(error);
    }
  });

  router.patch(
    '/secciones/:id',
    autenticar,
    requerirVerificado,
    requerirRol('administrador'),
    validar(activarToggleSchema),
    async (req, res, next) => {
      try {
        const { id } = validarDato(idParam, req.params);
        await academicos.establecerSeccionActiva(id, req.body.activa);
        res.json({ mensaje: 'Seccion actualizada' });
      } catch (error) {
        next(error);
      }
    }
  );

  router.post(
    '/secciones/:id/matriculas',
    autenticar,
    requerirVerificado,
    requerirRol('administrador'),
    validar(matriculaSchema),
    async (req, res, next) => {
      try {
        const { id } = validarDato(idParam, req.params);
        const matricula = await academicos.crearMatricula(id, req.body.estudianteId);
        res.status(201).json({ matricula });
      } catch (error) {
        next(error);
      }
    }
  );

  router.get(
    '/secciones/:id/matriculas',
    autenticar,
    requerirVerificado,
    async (req, res, next) => {
      try {
        const { id } = validarDato(idParam, req.params);
        res.json({ matriculas: await academicos.listarMatriculas(id) });
      } catch (error) {
        next(error);
      }
    }
  );

  router.patch(
    '/matriculas/:id',
    autenticar,
    requerirVerificado,
    requerirRol('administrador'),
    validar(activarToggleSchema),
    async (req, res, next) => {
      try {
        const { id } = validarDato(idParam, req.params);
        await academicos.establecerMatriculaActiva(id, req.body.activa);
        res.json({ mensaje: 'Matricula actualizada' });
      } catch (error) {
        next(error);
      }
    }
  );

  router.post(
    '/secciones/:id/asignaciones',
    autenticar,
    requerirVerificado,
    requerirRol('administrador'),
    validar(asignacionSchema),
    async (req, res, next) => {
      try {
        const { id } = validarDato(idParam, req.params);
        const asignacion = await academicos.crearAsignacion(id, req.body.docenteId);
        res.status(201).json({ asignacion });
      } catch (error) {
        next(error);
      }
    }
  );

  router.get(
    '/secciones/:id/asignaciones',
    autenticar,
    requerirVerificado,
    async (req, res, next) => {
      try {
        const { id } = validarDato(idParam, req.params);
        res.json({ asignaciones: await academicos.listarAsignaciones(id) });
      } catch (error) {
        next(error);
      }
    }
  );

  router.patch(
    '/asignaciones/:id',
    autenticar,
    requerirVerificado,
    requerirRol('administrador'),
    validar(activarToggleSchema),
    async (req, res, next) => {
      try {
        const { id } = validarDato(idParam, req.params);
        await academicos.establecerAsignacionActiva(id, req.body.activa);
        res.json({ mensaje: 'Asignacion actualizada' });
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}
