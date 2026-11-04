export type TipoUsuario = 'estudiante' | 'docente' | 'administrador';

const PATRON_ESTUDIANTE = /^u[a-z0-9._%+-]*@utp\.edu\.pe$/;
const PATRON_DOCENTE = /^c[a-z0-9._%+-]*@utp\.edu\.pe$/;

export function normalizarCorreo(correo: string): string {
  return correo.trim().toLowerCase();
}

export function derivarTipoPorCorreo(
  correo: string
): 'estudiante' | 'docente' | null {
  const normalizado = normalizarCorreo(correo);
  if (PATRON_ESTUDIANTE.test(normalizado)) return 'estudiante';
  if (PATRON_DOCENTE.test(normalizado)) return 'docente';
  return null;
}
