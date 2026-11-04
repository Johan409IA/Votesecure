import { Router } from 'express';
import { crearRutasAuth } from './auth.rutas';
import { crearRutasSecciones } from './secciones.rutas';
import { crearRutasElecciones } from './elecciones.rutas';
import { crearRutasAuditoria } from './auditoria.rutas';
import { crearRutasEvaluaciones } from './evaluaciones.rutas';
import type { ContextoApi } from '../contexto';

export function crearEnrutadorApi(ctx: ContextoApi): Router {
  const router = Router();

  router.get('/salud', (_req, res) => {
    res.json({ estado: 'ok', servicio: 'votesecure-backend' });
  });

  router.use(crearRutasAuth(ctx));
  router.use(crearRutasSecciones(ctx));
  router.use(crearRutasElecciones(ctx));
  router.use(crearRutasAuditoria(ctx));
  router.use(crearRutasEvaluaciones(ctx));

  return router;
}
