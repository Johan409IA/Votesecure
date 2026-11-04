import { ErrorProhibido } from '../compartido/errores';
import { esDocenteDeSeccion } from '../datos/repositorios/resultados.repo';

export interface UsuarioSesion {
  id: number;
  nombre: string;
  correo: string;
  tipo: 'estudiante' | 'docente' | 'administrador';
  correoVerificado: boolean;
}

export function esAdmin(usuario: UsuarioSesion): boolean {
  return usuario.tipo === 'administrador';
}

export async function puedeAdministrarSeccion(
  usuario: UsuarioSesion,
  seccionId: number
): Promise<boolean> {
  if (esAdmin(usuario)) return true;
  if (usuario.tipo === 'docente') {
    return esDocenteDeSeccion(usuario.id, seccionId);
  }
  return false;
}

export async function exigirPuedeAdministrarSeccion(
  usuario: UsuarioSesion,
  seccionId: number
): Promise<void> {
  const permitido = await puedeAdministrarSeccion(usuario, seccionId);
  if (!permitido) {
    throw new ErrorProhibido('No administras esta seccion');
  }
}
