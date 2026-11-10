import { ForbiddenError } from '../shared/errors';
import { isTeacherOfSection } from '../data/repositories/result.repo';

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
