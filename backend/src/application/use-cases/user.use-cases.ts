import { BusinessError, NotFoundError, UnauthenticatedError } from '../../shared/errors';
import { logger } from '../../config/logger';
import * as usersRepo from '../../data/repositories/user.repo';
import { hashPassword, verifyPassword } from '../services/passwords';
import type { SessionUser } from '../policies';

// F-009: gestion de cuentas desde la API. La autorizacion se decide aqui y en
// la funcion SQL (SECURITY DEFINER); el rol API nunca escribe usuarios.
export async function setUserActive(
  admin: SessionUser,
  userId: number,
  active: boolean
): Promise<void> {
  const user = await usersRepo.getById(userId);
  if (!user) throw new NotFoundError('Usuario no encontrado');
  await usersRepo.setUserActive(userId, active, admin.id);
  // Log de seguridad: no hay tabla de auditoria para cuentas (§8 solo cubre
  // el ciclo electoral) y la API no escribe en eventos_auditoria.
  logger.warn(
    { adminId: admin.id, userId, active },
    'Cambio de estado de cuenta por administrador'
  );
}

export async function changePassword(
  user: SessionUser,
  currentPassword: string,
  newPassword: string
): Promise<void> {
  const record = await usersRepo.getById(user.id);
  if (!record || !record.active) throw new UnauthenticatedError();
  const valid = await verifyPassword(record.passwordHash, currentPassword);
  if (!valid) {
    throw new BusinessError('La contrasena actual no coincide');
  }
  const passwordHash = await hashPassword(newPassword);
  // cambiar_contrasena actualiza el hash e invalida la sesion vigente.
  await usersRepo.updatePasswordHash(user.id, passwordHash);
  logger.info({ userId: user.id }, 'Cambio de contrasena');
}
