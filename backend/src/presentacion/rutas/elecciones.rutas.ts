import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import * as electoral from '../../aplicacion/casos-uso/electoral.casos';
import * as votoCasos from '../../aplicacion/casos-uso/voto.casos';
import * as resultadosCasos from '../../aplicacion/casos-uso/resultados.casos';
import { ErrorProhibido } from '../../compartido/errores';
import { autenticar, requerirVerificado } from '../middleware/sesion';
import { validar, validarDato } from '../middleware/validar';
import {
  cancelarSchema,
  candidaturaSchema,
  crearEleccionSchema,
  actualizarEleccionSchema,
  delegacionSchema,
  votoSchema
} from '../dto/elecciones.dto';
import type { ContextoApi } from '../contexto';

function requerirGestion(req: Request, _res: Response, next: NextFunction): void {
  if (req.usuario?.tipo !== 'administrador' && req.usuario?.tipo !== 'docente') {
    next(new ErrorProhibido('Solo administradores o docentes gestionan elecciones'));
    return;
  }
  next();
}

const gestion = [autenticar, requerirVerificado, requerirGestion];

const idParam = z.object({ id: z.coerce.number().int().positive() });
const idYCandidaturaParam = z.object({
  id: z.coerce.number().int().positive(),
  candidaturaId: z.coerce.number().int().positive()
});
const idYHabilitacionParam = z.object({
  id: z.coerce.number().int().positive(),
  habilitacionId: z.coerce.number().int().positive()
});
const seccionQuery = z.object({ seccionId: z.coerce.number().int().positive() });

export function crearRutasElecciones(ctx: ContextoApi): Router {
  const router = Router();

  router.get(
    '/elecciones/activas',
    autenticar,
    requerirVerificado,
    async (req, res, next) => {
      try {
        res.json({ elecciones: await electoral.eleccionesActivasDeEstudiante(req.usuario!) });
      } catch (error) {
        next(error);
      }
    }
  );

  router.get('/elecciones', autenticar, requerirVerificado, async (req, res, next) => {
    try {
      const { seccionId } = validarDato(seccionQuery, req.query);
      res.json({ elecciones: await electoral.listarElecciones(req.usuario!, seccionId) });
    } catch (error) {
      next(error);
    }
  });

  router.post('/elecciones', ...gestion, validar(crearEleccionSchema), async (req, res, next) => {
    try {
      const eleccion = await electoral.crearEleccion(req.usuario!, req.body);
      res.status(201).json({ eleccion });
    } catch (error) {
      next(error);
    }
  });

  router.get('/elecciones/:id', autenticar, requerirVerificado, async (req, res, next) => {
    try {
      const { id } = validarDato(idParam, req.params);
      const usuario = req.usuario!;
      const detalle = await electoral.detalleEleccion(id);
      if (usuario.tipo === 'estudiante') {
        const miembro = await resultadosCasos.esMiembroDeLaSeccion(
          usuario.id,
          detalle.eleccion.seccionId
        );
        if (!miembro && detalle.eleccion.estado !== 'cerrada') {
          next(new ErrorProhibido('No perteneces a la seccion de esta eleccion'));
          return;
        }
      }
      res.json(detalle);
    } catch (error) {
      next(error);
    }
  });

  router.patch(
    '/elecciones/:id',
    ...gestion,
    validar(actualizarEleccionSchema),
    async (req, res, next) => {
      try {
        const { id } = validarDato(idParam, req.params);
        await electoral.actualizarEleccion(req.usuario!, id, {
          nombre: req.body.nombre,
          iniciaEn: req.body.iniciaEn,
          cierraEn: req.body.cierraEn
        });
        res.json({ mensaje: 'Eleccion actualizada' });
      } catch (error) {
        next(error);
      }
    }
  );

  router.post(
    '/elecciones/:id/candidaturas',
    ...gestion,
    validar(candidaturaSchema),
    async (req, res, next) => {
      try {
        const { id } = validarDato(idParam, req.params);
        const candidatura = await electoral.agregarCandidatura(req.usuario!, id, req.body.matriculaId);
        res.status(201).json({ candidatura });
      } catch (error) {
        next(error);
      }
    }
  );

  router.delete(
    '/elecciones/:id/candidaturas/:candidaturaId',
    ...gestion,
    async (req, res, next) => {
      try {
        const { id, candidaturaId } = validarDato(idYCandidaturaParam, req.params);
        await electoral.quitarCandidatura(req.usuario!, id, candidaturaId);
        res.json({ mensaje: 'Candidatura retirada' });
      } catch (error) {
        next(error);
      }
    }
  );

  router.post(
    '/elecciones/:id/habilitaciones',
    ...gestion,
    validar(candidaturaSchema),
    async (req, res, next) => {
      try {
        const { id } = validarDato(idParam, req.params);
        const habilitacion = await electoral.agregarHabilitacion(
          req.usuario!,
          id,
          req.body.matriculaId
        );
        res.status(201).json({ habilitacion });
      } catch (error) {
        next(error);
      }
    }
  );

  router.delete(
    '/elecciones/:id/habilitaciones/:habilitacionId',
    ...gestion,
    async (req, res, next) => {
      try {
        const { id, habilitacionId } = validarDato(idYHabilitacionParam, req.params);
        await electoral.quitarHabilitacion(req.usuario!, id, habilitacionId);
        res.json({ mensaje: 'Habilitacion retirada' });
      } catch (error) {
        next(error);
      }
    }
  );

  router.post('/elecciones/:id/programar', ...gestion, async (req, res, next) => {
    try {
      const { id } = validarDato(idParam, req.params);
      await electoral.programarEleccion(req.usuario!, id);
      res.json({ mensaje: 'Eleccion programada' });
    } catch (error) {
      next(error);
    }
  });

  router.post('/elecciones/:id/activar', ...gestion, async (req, res, next) => {
    try {
      const { id } = validarDato(idParam, req.params);
      await electoral.activarEleccion(req.usuario!, id);
      res.json({ mensaje: 'Eleccion activada' });
    } catch (error) {
      next(error);
    }
  });

  router.post(
    '/elecciones/:id/cancelar',
    ...gestion,
    validar(cancelarSchema),
    async (req, res, next) => {
      try {
        const { id } = validarDato(idParam, req.params);
        await electoral.cancelarEleccion(req.usuario!, id, req.body.motivo);
        res.json({ mensaje: 'Eleccion cancelada' });
      } catch (error) {
        next(error);
      }
    }
  );

  router.post(
    '/elecciones/:id/voto',
    autenticar,
    requerirVerificado,
    validar(votoSchema),
    async (req, res, next) => {
      try {
        const { id } = validarDato(idParam, req.params);
        const confirmacion = await votoCasos.emitirVoto(
          req.usuario!,
          ctx.publicador,
          id,
          req.body.candidaturaId
        );
        res.status(201).json(confirmacion);
      } catch (error) {
        next(error);
      }
    }
  );

  router.get(
    '/elecciones/:id/resultados',
    autenticar,
    requerirVerificado,
    async (req, res, next) => {
      try {
        const { id } = validarDato(idParam, req.params);
        res.json(await resultadosCasos.obtenerResultados(req.usuario!, id));
      } catch (error) {
        next(error);
      }
    }
  );

  router.get(
    '/elecciones/:id/resultados/suscripcion',
    autenticar,
    requerirVerificado,
    async (req, res, next) => {
      try {
        const { id } = validarDato(idParam, req.params);
        res.json(await resultadosCasos.ticketSuscripcion(req.usuario!, ctx.publicador, id));
      } catch (error) {
        next(error);
      }
    }
  );

  router.post(
    '/elecciones/:id/delegacion',
    ...gestion,
    validar(delegacionSchema),
    async (req, res, next) => {
      try {
        const { id } = validarDato(idParam, req.params);
        const delegacionId = await electoral.proclamarDelegado(
          req.usuario!,
          id,
          req.body.iniciaEn,
          req.body.terminaEn ?? null
        );
        res.status(201).json({ delegacionId });
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}
