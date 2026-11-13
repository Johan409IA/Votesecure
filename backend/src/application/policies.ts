import { ForbiddenError } from '../shared/errors';
import {
  isTeacherOfSection,
  isSectionMember
} from '../data/repositories/result.repo';

export interface SessionUser {
  id: number;
  name: string;
  email: string;
  type: 'estudiante' | 'docente' | 'administrador';
  emailVerified: boolean;
}

export function isAdmin(user: SessionUser): boolean {
  return user.type === 'administrador';
}

export async function canManageSection(
  user: SessionUser,
  sectionId: number
): Promise<boolean> {
  if (isAdmin(user)) return true;
  if (user.type === 'docente') {
    return isTeacherOfSection(user.id, sectionId);
  }
  return false;
}

export async function requireCanManageSection(
  user: SessionUser,
  sectionId: number
): Promise<void> {
  const allowed = await canManageSection(user, sectionId);
  if (!allowed) {
    throw new ForbiddenError('No administras esta seccion');
  }
}

// Policy por recurso (F-001): la autorizacion de lectura es por pertenencia a
// la seccion, no solo por rol. El administrador accede a todo; docentes y
// estudiantes solo a sus propias secciones (asignacion/matricula activa).
export async function canViewSection(
  user: SessionUser,
  sectionId: number
): Promise<boolean> {
  if (isAdmin(user)) return true;
  return isSectionMember(user.id, sectionId);
}

export async function requireSectionAccess(
  user: SessionUser,
  sectionId: number
): Promise<void> {
  const allowed = await canViewSection(user, sectionId);
  if (!allowed) {
    throw new ForbiddenError('No perteneces a esta seccion');
  }
}
