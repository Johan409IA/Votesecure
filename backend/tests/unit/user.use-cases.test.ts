import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as usersRepo from '../../src/data/repositories/user.repo';
import {
  getOwnPhoto,
  listUsers,
  removeOwnPhoto,
  updateOwnPhoto
} from '../../src/application/use-cases/user.use-cases';
import type { SessionUser } from '../../src/application/policies';

vi.mock('../../src/data/repositories/user.repo', () => ({
  setPhoto: vi.fn(),
  getPhoto: vi.fn(),
  listUsers: vi.fn()
}));

const user: SessionUser = {
  id: 5,
  name: 'Alumno Prueba',
  email: 'u2026001@utp.edu.pe',
  type: 'estudiante',
  emailVerified: true
};

const admin: SessionUser = {
  id: 1,
  name: 'Admin Prueba',
  email: 'admin@utp.edu.pe',
  type: 'administrador',
  emailVerified: true
};

const JPEG = 'data:image/jpeg;base64,/9j/4AAQ';

beforeEach(() => {
  vi.mocked(usersRepo.setPhoto).mockReset();
  vi.mocked(usersRepo.getPhoto).mockReset();
  vi.mocked(usersRepo.listUsers).mockReset();
});

describe('foto de perfil (casos de uso)', () => {
  it('guarda un data URL con firma JPEG valida', async () => {
    await updateOwnPhoto(user, JPEG);
    expect(usersRepo.setPhoto).toHaveBeenCalledWith(user.id, JPEG);
  });

  it('rechaza base64 cuya firma no corresponde a un JPEG', async () => {
    await expect(updateOwnPhoto(user, 'data:image/jpeg;base64,SG9sYQ==')).rejects.toThrow(
      /JPEG/
    );
    expect(usersRepo.setPhoto).not.toHaveBeenCalled();
  });

  it('elimina la foto con NULL', async () => {
    await removeOwnPhoto(user);
    expect(usersRepo.setPhoto).toHaveBeenCalledWith(user.id, null);
  });

  it('lee la foto del usuario', async () => {
    vi.mocked(usersRepo.getPhoto).mockResolvedValue(JPEG);
    await expect(getOwnPhoto(user)).resolves.toBe(JPEG);
  });
});

describe('listUsers (casos de uso)', () => {
  it('trata la busqueda vacia como sin filtro', async () => {
    vi.mocked(usersRepo.listUsers).mockResolvedValue([]);
    await listUsers(admin, { busqueda: '   ' });
    expect(usersRepo.listUsers).toHaveBeenCalledWith({ search: undefined, type: undefined });
  });

  it('pasa la busqueda y el tipo normalizados', async () => {
    vi.mocked(usersRepo.listUsers).mockResolvedValue([]);
    await listUsers(admin, { busqueda: '  u2026  ', tipo: 'estudiante' });
    expect(usersRepo.listUsers).toHaveBeenCalledWith({
      search: 'u2026',
      type: 'estudiante'
    });
  });
});
