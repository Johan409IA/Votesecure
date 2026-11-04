import { ErrorNoEncontrado } from '../../compartido/errores';
import * as academicosRepo from '../../datos/repositorios/academicos.repo';
import type { UsuarioSesion } from '../politicas';

export async function crearSeccion(
  datos: academicosRepo.DatosNuevaSeccion
): Promise<academicosRepo.Seccion> {
  return academicosRepo.crearSeccion(datos);
}

export async function listarSecciones(): Promise<academicosRepo.Seccion[]> {
  return academicosRepo.listarSecciones();
}

export async function obtenerSeccion(id: number) {
  return academicosRepo.obtenerSeccion(id);
}

export async function establecerSeccionActiva(
  id: number,
  activa: boolean
): Promise<void> {
  const seccion = await academicosRepo.obtenerSeccion(id);
  if (!seccion) throw new ErrorNoEncontrado('Seccion no encontrada');
  await academicosRepo.establecerSeccionActiva(id, activa);
}

export async function crearMatricula(
  seccionId: number,
  estudianteId: number
): Promise<academicosRepo.Matricula> {
  return academicosRepo.crearMatricula(seccionId, estudianteId);
}

export async function listarMatriculas(seccionId: number) {
  return academicosRepo.listarMatriculasPorSeccion(seccionId);
}

export async function establecerMatriculaActiva(
  id: number,
  activa: boolean
): Promise<void> {
  await academicosRepo.establecerMatriculaActiva(id, activa);
}

export async function crearAsignacion(
  seccionId: number,
  docenteId: number
): Promise<academicosRepo.AsignacionDocente> {
  return academicosRepo.crearAsignacionDocente(seccionId, docenteId);
}

export async function listarAsignaciones(seccionId: number) {
  return academicosRepo.listarAsignacionesPorSeccion(seccionId);
}

export async function establecerAsignacionActiva(
  id: number,
  activa: boolean
): Promise<void> {
  await academicosRepo.establecerAsignacionActiva(id, activa);
}

export async function seccionesVisibles(
  usuario: UsuarioSesion
): Promise<academicosRepo.Seccion[]> {
  if (usuario.tipo === 'administrador') {
    return academicosRepo.listarSecciones();
  }
  const secciones = new Map<number, academicosRepo.Seccion>();
  if (usuario.tipo === 'estudiante') {
    const matriculas = await academicosRepo.listarMatriculasDeEstudiante(usuario.id);
    for (const m of matriculas) {
      const s = await academicosRepo.obtenerSeccion(m.seccionId);
      if (s) secciones.set(s.id, s);
    }
  } else {
    const asignaciones = await academicosRepo.listarAsignacionesDeDocente(usuario.id);
    for (const a of asignaciones) {
      const s = await academicosRepo.obtenerSeccion(a.seccionId);
      if (s) secciones.set(s.id, s);
    }
  }
  return [...secciones.values()];
}
