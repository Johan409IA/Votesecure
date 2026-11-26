import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as usersRepo from '../../src/data/repositories/user.repo';
import { resendVerification } from '../../src/application/use-cases/auth.use-cases';
import type { MailAdapter } from '../../src/application/services/mail';

vi.mock('../../src/data/repositories/user.repo', () => ({
  regenerateVerification: vi.fn()
}));

const mail: MailAdapter = { sendVerification: vi.fn() };

beforeEach(() => {
  vi.mocked(usersRepo.regenerateVerification).mockReset();
  vi.mocked(mail.sendVerification).mockReset();
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
