import { Router } from 'express';
import { z } from 'zod';
import * as evaluacion from '../../aplicacion/casos-uso/evaluacion.casos';
import { autenticar, requerirVerificado } from '../middleware/sesion';
import { validar, validarDato } from '../middleware/validar';
import { periodoEvaluacionSchema } from '../dto/elecciones.dto';
import { evaluarSchema, seccionQuerySchema } from '../dto/evaluacion.dto';
import type { ContextoApi } from '../contexto';

const idParam = z.object({ id: z.coerce.number().int().positive() });

export function crearRutasEvaluaciones(_ctx: ContextoApi): Router {
  const router = Router();

  router.get(
    '/evaluaciones/delegado',
    autenticar,
    requerirVerificado,
    async (req, res, next) => {
      try {
        const { seccionId } = validarDato(seccionQuerySchema, req.query);
        res.json(await evaluacion.verDelegado(req.usuario!, seccionId));
      } catch (error) {
        next(error);
      }
    }
  );

  router.post(
    '/evaluaciones',
    autenticar,
    requerirVerificado,
    validar(evaluarSchema),
    async (req, res, next) => {
      try {
        await evaluacion.evaluarDelegado(req.usuario!, req.body);
        res.status(201).json({ mensaje: 'Evaluacion registrada' });
      } catch (error) {
        next(error);
      }
    }
  );

  router.get(
    '/evaluaciones/resumen',
    autenticar,
    requerirVerificado,
    async (req, res, next) => {
      try {
        const { seccionId } = validarDato(seccionQuerySchema, req.query);
        res.json({ resumen: await evaluacion.resumenEvaluacion(req.usuario!, seccionId) });
      } catch (error) {
        next(error);
      }
    }
  );

  router.post(
    '/delegaciones/:id/periodo-evaluacion',
    autenticar,
    requerirVerificado,
    validar(periodoEvaluacionSchema),
    async (req, res, next) => {
      try {
        const { id } = validarDato(idParam, req.params);
        const periodoId = await evaluacion.crearPeriodoEvaluacion(
          req.usuario!,
          id,
          req.body.abreEn,
          req.body.cierraEn
        );
        res.status(201).json({ periodoId });
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}
