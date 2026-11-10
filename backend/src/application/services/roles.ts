export type UserType = 'estudiante' | 'docente' | 'administrador';

const STUDENT_PATTERN = /^u[a-z0-9._%+-]*@utp\.edu\.pe$/;
const TEACHER_PATTERN = /^c[a-z0-9._%+-]*@utp\.edu\.pe$/;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function deriveUserTypeFromEmail(
  email: string
): 'estudiante' | 'docente' | null {
  const normalized = normalizeEmail(email);
  if (STUDENT_PATTERN.test(normalized)) return 'estudiante';
  if (TEACHER_PATTERN.test(normalized)) return 'docente';
  return null;
}
