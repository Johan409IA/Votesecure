import { Router } from 'express';
import * as auditoria from '../../aplicacion/casos-uso/auditoria.casos';
import { autenticar, requerirVerificado } from '../middleware/sesion';
import type { ContextoApi } from '../contexto';

export function crearRutasAuditoria(_ctx: ContextoApi): Router {
  const router = Router();

  router.get('/auditoria', autenticar, requerirVerificado, async (req, res, next) => {
    try {
      const seccionId = req.query['seccionId'];
      const eleccionId = req.query['eleccionId'];
      const eventos = await auditoria.listarAuditoria(req.usuario!, {
        seccionId: seccionId ? Number(seccionId) : undefined,
        eleccionId: eleccionId ? Number(eleccionId) : undefined
      });
      res.json({ eventos });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
