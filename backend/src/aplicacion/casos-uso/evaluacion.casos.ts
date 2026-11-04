import { ErrorNegocio, ErrorNoEncontrado, ErrorProhibido } from '../../compartido/errores';
import * as evaluacionesRepo from '../../datos/repositorios/evaluaciones.repo';
import * as eleccionesRepo from '../../datos/repositorios/elecciones.repo';
import { esMiembroDeSeccion } from '../../datos/repositorios/resultados.repo';
import {
  esAdmin,
  exigirPuedeAdministrarSeccion,
  type UsuarioSesion
} from '../politicas';

export async function crearPeriodoEvaluacion(
  usuario: UsuarioSesion,
  delegacionId: number,
  abreEn: Date,
  cierraEn: Date
): Promise<number> {
  const delegacion = await evaluacionesRepo.obtenerDelegacion(delegacionId);
  if (!delegacion) throw new ErrorNoEncontrado('Delegacion no encontrada');
  await exigirPuedeAdministrarSeccion(usuario, delegacion.seccionId);
  return eleccionesRepo.crearPeriodoEvaluacion(
    delegacion.id,
    delegacion.seccionId,
    abreEn,
    cierraEn
  );
}

export async function verDelegado(usuario: UsuarioSesion, seccionId: number) {
  const permitido =
    esAdmin(usuario) || (await esMiembroDeSeccion(usuario.id, seccionId));
  if (!permitido) throw new ErrorProhibido('No perteneces a esta seccion');
  const delegacion = await evaluacionesRepo.delegacionVigentePorSeccion(seccionId);
  if (!delegacion) throw new ErrorNoEncontrado('No hay delegado vigente en la seccion');
  const periodo = await evaluacionesRepo.periodoVigentePorDelegacion(delegacion.id);
  return { delegacion, periodoAbierto: periodo };
}

export async function evaluarDelegado(
  usuario: UsuarioSesion,
  datos: {
    seccionId: number;
    calificacion: number;
    comentario?: string;
  }
): Promise<void> {
  const delegacion = await evaluacionesRepo.delegacionVigentePorSeccion(datos.seccionId);
  if (!delegacion) {
    throw new ErrorNoEncontrado('No hay delegado vigente en la seccion');
  }
  const periodo = await evaluacionesRepo.periodoVigentePorDelegacion(delegacion.id);
  if (!periodo) {
    throw new ErrorNegocio('El periodo de evaluacion no esta abierto');
  }

  if (usuario.tipo === 'estudiante') {
    const comentario = datos.comentario?.trim() ?? '';
    if (comentario.length > 500) {
      throw new ErrorNegocio('El comentario estudiantil admite hasta 500 caracteres');
    }
    const matriculaId = await evaluacionesRepo.obtenerMatriculaId(
      datos.seccionId,
      usuario.id
    );
    if (!matriculaId) {
      throw new ErrorProhibido('No tienes matricula activa en la seccion');
    }
    await evaluacionesRepo.registrarEvaluacionEstudiante(
      periodo.id,
      matriculaId,
      datos.calificacion,
      comentario.length > 0 ? comentario : null
    );
    return;
  }

  if (usuario.tipo === 'docente') {
    const comentario = datos.comentario?.trim() ?? '';
    if (comentario.length < 20 || comentario.length > 1000) {
      throw new ErrorNegocio(
        'El comentario del docente es obligatorio (entre 20 y 1000 caracteres)'
      );
    }
    const asignacionId = await evaluacionesRepo.obtenerAsignacionId(
      datos.seccionId,
      usuario.id
    );
    if (!asignacionId) {
      throw new ErrorProhibido('No tienes asignacion activa en la seccion');
    }
    await evaluacionesRepo.registrarEvaluacionDocente(
      periodo.id,
      asignacionId,
      datos.calificacion,
      comentario
    );
    return;
  }

  throw new ErrorProhibido('El administrador no evalua delegados');
}

export async function resumenEvaluacion(
  usuario: UsuarioSesion,
  seccionId: number
) {
  const permitido =
    esAdmin(usuario) ||
    (usuario.tipo === 'docente' &&
      (await esMiembroDeSeccion(usuario.id, seccionId)));
  if (!permitido) {
    throw new ErrorProhibido('El resumen es para docentes de la seccion o administradores');
  }
  const delegacion = await evaluacionesRepo.delegacionVigentePorSeccion(seccionId);
  if (!delegacion) throw new ErrorNoEncontrado('No hay delegado vigente en la seccion');
  return evaluacionesRepo.resumenPorDelegacion(delegacion);
}
