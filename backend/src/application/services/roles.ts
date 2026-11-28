export type UserType = 'estudiante' | 'docente' | 'administrador';

// Codigo institucional real de la UTP: estudiante u + 8 digitos,
// docente c + 5 digitos. El administrador no se deriva del correo.
const STUDENT_PATTERN = /^u\d{8}@utp\.edu\.pe$/;
const TEACHER_PATTERN = /^c\d{5}@utp\.edu\.pe$/;

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
