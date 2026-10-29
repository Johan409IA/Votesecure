import { ErrorProhibido } from '../../compartido/errores';
import * as auditoriaRepo from '../../datos/repositorios/auditoria.repo';
import * as resultadosRepo from '../../datos/repositorios/resultados.repo';
import type { UsuarioSesion } from '../politicas';

export async function listarAuditoria(
  usuario: UsuarioSesion,
  filtros: { seccionId?: number; eleccionId?: number }
) {
  if (usuario.tipo === 'estudiante') {
    throw new ErrorProhibido('La auditoria no esta disponible para estudiantes');
  }
  if (usuario.tipo === 'docente') {
    const secciones = await resultadosRepo.seccionesDeDocente(usuario.id);
    if (filtros.seccionId && !secciones.includes(filtros.seccionId)) {
      throw new ErrorProhibido('No administras esta seccion');
    }
    const eventos = await Promise.all(
      secciones.map((seccionId) =>
        auditoriaRepo.listarEventos({
          seccionId,
          eleccionId: filtros.eleccionId
        })
      )
    );
    const combinados = eventos
      .flat()
      .sort((a, b) => b.ocurridoEn.getTime() - a.ocurridoEn.getTime());
    if (filtros.seccionId) {
      return combinados.filter((e) => e.seccionId === filtros.seccionId);
    }
    return combinados;
  }
  return auditoriaRepo.listarEventos(filtros);
}
