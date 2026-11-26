import { BusinessError, NotFoundError, UnauthenticatedError, ValidationError } from '../../shared/errors';
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

export type ListUsersFilters = {
  busqueda?: string;
  tipo?: 'estudiante' | 'docente' | 'administrador';
};

export type UserSummary = usersRepo.UserSummary;

// Listado de cuentas para el administrador (la autorizacion la aplica
// requireRole en la ruta); la busqueda vacia se trata como sin filtro.
export async function listUsers(
  _admin: SessionUser,
  filters: ListUsersFilters
): Promise<usersRepo.UserSummary[]> {
  const search = filters.busqueda?.trim();
  return usersRepo.listUsers({
    search: search ? search : undefined,
    type: filters.tipo
  });
}

// La DTO (photoSchema) ya exige el formato data URL JPEG y el tope; aqui se
// valida ademas la firma real del archivo (primeros bytes FF D8 FF).
const JPEG_DATA_URL_PREFIX = 'data:image/jpeg;base64,';

function isJpegBase64(image: string): boolean {
  const head = Buffer.from(
    image.slice(JPEG_DATA_URL_PREFIX.length, JPEG_DATA_URL_PREFIX.length + 8),
    'base64'
  );
  return head.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff;
}

export async function updateOwnPhoto(user: SessionUser, image: string): Promise<void> {
  if (!isJpegBase64(image)) {
    throw new ValidationError('imagen: La imagen no es un JPEG valido');
  }
  await usersRepo.setPhoto(user.id, image);
  logger.info({ userId: user.id }, 'Foto de perfil actualizada');
}

export async function removeOwnPhoto(user: SessionUser): Promise<void> {
  await usersRepo.setPhoto(user.id, null);
  logger.info({ userId: user.id }, 'Foto de perfil eliminada');
}

export async function getOwnPhoto(user: SessionUser): Promise<string | null> {
  return usersRepo.getPhoto(user.id);
}
