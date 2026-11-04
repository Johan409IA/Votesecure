import { ErrorProhibido, ErrorNoEncontrado } from '../../compartido/errores';
import * as eleccionesRepo from '../../datos/repositorios/elecciones.repo';
import * as resultadosRepo from '../../datos/repositorios/resultados.repo';
import type { PublicadorResultados } from '../servicios/realtime';
import { esAdmin, type UsuarioSesion } from '../politicas';
import { armarCarga } from './voto.casos';

export async function esMiembroDeLaSeccion(
  usuarioId: number,
  seccionId: number
): Promise<boolean> {
  return resultadosRepo.esMiembroDeSeccion(usuarioId, seccionId);
}

export async function obtenerResultados(
  usuario: UsuarioSesion,
  eleccionId: number
) {
  const eleccion = await eleccionesRepo.obtenerEleccion(eleccionId);
  if (!eleccion) throw new ErrorNoEncontrado('Eleccion no encontrada');

  if (eleccion.estado === 'activa') {
    if (usuario.tipo !== 'estudiante') {
      throw new ErrorProhibido('Los resultados en vivo son solo para estudiantes habilitados');
    }
    const habilitado = await resultadosRepo.estaHabilitado(eleccionId, usuario.id);
    if (!habilitado) {
      throw new ErrorProhibido('No estas habilitado en esta eleccion');
    }
    const carga = await armarCarga(eleccionId);
    if (!carga) throw new ErrorNoEncontrado('Eleccion no encontrada');
    return { tipo: 'en_vivo' as const, ...carga, yaVoto: await resultadosRepo.haVotado(eleccionId, usuario.id) };
  }

  if (eleccion.estado === 'cerrada') {
    const permitido =
      esAdmin(usuario) ||
      (await resultadosRepo.esMiembroDeSeccion(usuario.id, eleccion.seccionId));
    if (!permitido) {
      throw new ErrorProhibido('No perteneces a la seccion de esta eleccion');
    }
    const final = await resultadosRepo.obtenerResultadoFinal(eleccionId);
    if (!final) throw new ErrorNoEncontrado('Resultados no disponibles');
    return { tipo: 'final' as const, ...final };
  }

  throw new ErrorProhibido('Los resultados no estan disponibles en este estado');
}

export async function ticketSuscripcion(
  usuario: UsuarioSesion,
  publicador: PublicadorResultados,
  eleccionId: number
): Promise<{ canal: string; eleccionId: number }> {
  const eleccion = await eleccionesRepo.obtenerEleccion(eleccionId);
  if (!eleccion) throw new ErrorNoEncontrado('Eleccion no encontrada');
  if (eleccion.estado !== 'activa') {
    throw new ErrorProhibido('La eleccion no esta activa');
  }
  if (usuario.tipo !== 'estudiante') {
    throw new ErrorProhibido('Solo los estudiantes habilitados pueden suscribirse');
  }
  const habilitado = await resultadosRepo.estaHabilitado(eleccionId, usuario.id);
  if (!habilitado) {
    throw new ErrorProhibido('No estas habilitado en esta eleccion');
  }
  return { canal: publicador.nombreCanal(eleccionId), eleccionId };
}
