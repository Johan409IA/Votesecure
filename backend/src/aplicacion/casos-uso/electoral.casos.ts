import { ErrorNoEncontrado, ErrorProhibido } from '../../compartido/errores';
import * as eleccionesRepo from '../../datos/repositorios/elecciones.repo';
import {
  esMiembroDeSeccion,
  obtenerResultadoFinal
} from '../../datos/repositorios/resultados.repo';
import { listarMatriculasDeEstudiante } from '../../datos/repositorios/academicos.repo';
import {
  exigirPuedeAdministrarSeccion,
  esAdmin,
  type UsuarioSesion
} from '../politicas';

export async function crearEleccion(
  usuario: UsuarioSesion,
  datos: eleccionesRepo.DatosNuevaEleccion
): Promise<eleccionesRepo.Eleccion> {
  await exigirPuedeAdministrarSeccion(usuario, datos.seccionId);
  return eleccionesRepo.crearEleccion({ ...datos, creadaPorUsuarioId: usuario.id });
}

export async function obtenerEleccion(id: number) {
  const eleccion = await eleccionesRepo.obtenerEleccion(id);
  if (!eleccion) throw new ErrorNoEncontrado('Eleccion no encontrada');
  return eleccion;
}

export async function listarElecciones(
  usuario: UsuarioSesion,
  seccionId: number
): Promise<eleccionesRepo.Eleccion[]> {
  if (esAdmin(usuario) || usuario.tipo === 'docente') {
    return eleccionesRepo.listarEleccionesPorSeccion(seccionId);
  }
  const miembro = await esMiembroDeSeccion(usuario.id, seccionId);
  if (miembro) {
    return eleccionesRepo.listarEleccionesPorSeccion(seccionId);
  }
  return eleccionesRepo
    .listarEleccionesPorSeccion(seccionId)
    .then((lista) => lista.filter((e) => e.estado === 'cerrada'));
}

export async function actualizarEleccion(
  usuario: UsuarioSesion,
  eleccionId: number,
  cambios: { nombre?: string; iniciaEn?: Date; cierraEn?: Date }
): Promise<void> {
  const eleccion = await obtenerEleccion(eleccionId);
  await exigirPuedeAdministrarSeccion(usuario, eleccion.seccionId);
  await eleccionesRepo.actualizarEleccion(eleccionId, cambios);
}

export async function agregarCandidatura(
  usuario: UsuarioSesion,
  eleccionId: number,
  matriculaId: number
): Promise<eleccionesRepo.Candidatura> {
  const eleccion = await obtenerEleccion(eleccionId);
  await exigirPuedeAdministrarSeccion(usuario, eleccion.seccionId);
  return eleccionesRepo.agregarCandidatura(eleccionId, matriculaId);
}

export async function quitarCandidatura(
  usuario: UsuarioSesion,
  eleccionId: number,
  candidaturaId: number
): Promise<void> {
  const eleccion = await obtenerEleccion(eleccionId);
  await exigirPuedeAdministrarSeccion(usuario, eleccion.seccionId);
  await eleccionesRepo.quitarCandidatura(eleccionId, candidaturaId);
}

export async function agregarHabilitacion(
  usuario: UsuarioSesion,
  eleccionId: number,
  matriculaId: number
): Promise<eleccionesRepo.Habilitacion> {
  const eleccion = await obtenerEleccion(eleccionId);
  await exigirPuedeAdministrarSeccion(usuario, eleccion.seccionId);
  return eleccionesRepo.agregarHabilitacion(eleccionId, matriculaId);
}

export async function quitarHabilitacion(
  usuario: UsuarioSesion,
  eleccionId: number,
  habilitacionId: number
): Promise<void> {
  const eleccion = await obtenerEleccion(eleccionId);
  await exigirPuedeAdministrarSeccion(usuario, eleccion.seccionId);
  await eleccionesRepo.quitarHabilitacion(eleccionId, habilitacionId);
}

export async function programarEleccion(
  usuario: UsuarioSesion,
  eleccionId: number
): Promise<void> {
  const eleccion = await obtenerEleccion(eleccionId);
  await exigirPuedeAdministrarSeccion(usuario, eleccion.seccionId);
  await eleccionesRepo.programar(eleccionId, usuario.id);
}

export async function cancelarEleccion(
  usuario: UsuarioSesion,
  eleccionId: number,
  motivo: string
): Promise<void> {
  const eleccion = await obtenerEleccion(eleccionId);
  await exigirPuedeAdministrarSeccion(usuario, eleccion.seccionId);
  await eleccionesRepo.cancelar(eleccionId, usuario.id, motivo);
}

export async function activarEleccion(
  usuario: UsuarioSesion,
  eleccionId: number
): Promise<void> {
  const eleccion = await obtenerEleccion(eleccionId);
  await exigirPuedeAdministrarSeccion(usuario, eleccion.seccionId);
  await eleccionesRepo.activar(eleccionId);
}

export async function detalleEleccion(eleccionId: number) {
  const eleccion = await obtenerEleccion(eleccionId);
  const [candidaturas, habilitaciones] = await Promise.all([
    eleccionesRepo.listarCandidaturas(eleccionId),
    eleccionesRepo.listarHabilitaciones(eleccionId)
  ]);
  return { eleccion, candidaturas, habilitaciones };
}

export async function eleccionesActivasDeEstudiante(
  usuario: UsuarioSesion
): Promise<eleccionesRepo.Eleccion[]> {
  if (usuario.tipo !== 'estudiante') {
    throw new ErrorProhibido('Solo aplica para estudiantes');
  }
  const matriculas = await listarMatriculasDeEstudiante(usuario.id);
  const activas: eleccionesRepo.Eleccion[] = [];
  for (const m of matriculas) {
    const elecciones = await eleccionesRepo.listarActivasPorSeccion(m.seccionId);
    activas.push(...elecciones);
  }
  return activas;
}

export async function proclamarDelegado(
  usuario: UsuarioSesion,
  eleccionId: number,
  iniciaEn: Date,
  terminaEn: Date | null
): Promise<number> {
  const eleccion = await obtenerEleccion(eleccionId);
  await exigirPuedeAdministrarSeccion(usuario, eleccion.seccionId);
  const resultado = await obtenerResultadoFinal(eleccionId);
  if (!resultado || resultado.situacion !== 'ganador' || !resultado.ganadorCandidaturaId) {
    throw new ErrorProhibido('Solo puede delegarse con un ganador unico publicado');
  }
  return eleccionesRepo.registrarDelegacion(
    eleccionId,
    eleccion.seccionId,
    resultado.ganadorCandidaturaId,
    iniciaEn,
    terminaEn
  );
}
