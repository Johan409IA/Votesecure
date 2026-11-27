import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as usersRepo from '../../src/data/repositories/user.repo';
import { resendVerification, verifyEmail } from '../../src/application/use-cases/auth.use-cases';
import type { MailAdapter } from '../../src/application/services/mail';

vi.mock('../../src/data/repositories/user.repo', () => ({
  regenerateVerification: vi.fn(),
  getByEmail: vi.fn(),
  confirmEmail: vi.fn()
}));

const mail: MailAdapter = { sendVerification: vi.fn() };

beforeEach(() => {
  vi.mocked(usersRepo.regenerateVerification).mockReset();
  vi.mocked(usersRepo.getByEmail).mockReset();
  vi.mocked(usersRepo.confirmEmail).mockReset();
  vi.mocked(mail.sendVerification).mockReset();
});

describe('verifyEmail (verificacion de correo)', () => {
  it('confirma con el token cuando la cuenta aun no esta verificada', async () => {
    vi.mocked(usersRepo.getByEmail).mockResolvedValue(null);
    vi.mocked(usersRepo.confirmEmail).mockResolvedValue(true);
    await expect(verifyEmail('U2026001@utp.edu.pe', 'token')).resolves.toBeUndefined();
    expect(usersRepo.getByEmail).toHaveBeenCalledWith('u2026001@utp.edu.pe');
    expect(usersRepo.confirmEmail).toHaveBeenCalledTimes(1);
  });

  it('responde exito sin validar el token si la cuenta ya esta verificada (idempotencia ante precarga del enlace)', async () => {
    vi.mocked(usersRepo.getByEmail).mockResolvedValue({
      id: 1, name: 'x', email: 'u2026001@utp.edu.pe', userType: 'estudiante',
      passwordHash: 'h', active: true, emailVerifiedAt: new Date(),
      sessionExpiresAt: null, sessionRevokedAt: null
    });
    await expect(verifyEmail('u2026001@utp.edu.pe', 'token-consumido')).resolves.toBeUndefined();
    expect(usersRepo.confirmEmail).not.toHaveBeenCalled();
  });

  it('falla cuando el token no coincide y la cuenta no esta verificada', async () => {
    vi.mocked(usersRepo.getByEmail).mockResolvedValue(null);
    vi.mocked(usersRepo.confirmEmail).mockResolvedValue(false);
    await expect(verifyEmail('u2026001@utp.edu.pe', 'token-malo')).rejects.toThrow();
  });
});

describe('resendVerification (reenvio de verificacion)', () => {
  it('envia un nuevo enlace cuando el token rota', async () => {
    vi.mocked(usersRepo.regenerateVerification).mockResolvedValue(true);
    await resendVerification('U2026001@utp.edu.pe', mail, 'http://localhost:5173');
    expect(usersRepo.regenerateVerification).toHaveBeenCalledTimes(1);
    expect(mail.sendVerification).toHaveBeenCalledTimes(1);
    const [recipient, link] = vi.mocked(mail.sendVerification).mock.calls[0]!;
    expect(recipient).toBe('u2026001@utp.edu.pe');
    expect(link).toContain('/verificar-correo?correo=u2026001%40utp.edu.pe&token=');
  });

  it('no envia nada cuando la cuenta no existe, esta verificada o esta en cooldown', async () => {
    vi.mocked(usersRepo.regenerateVerification).mockResolvedValue(false);
    await resendVerification('u2026001@utp.edu.pe', mail, 'http://localhost:5173');
    expect(mail.sendVerification).not.toHaveBeenCalled();
  });

  it('no propaga un fallo del envio de correo (sin enumeracion de cuentas)', async () => {
    vi.mocked(usersRepo.regenerateVerification).mockResolvedValue(true);
    vi.mocked(mail.sendVerification).mockRejectedValue(new Error('Resend caido'));
    await expect(
      resendVerification('u2026001@utp.edu.pe', mail, 'http://localhost:5173')
    ).resolves.toBeUndefined();
  });
});
