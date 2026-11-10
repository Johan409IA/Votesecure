import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from '../../src/application/services/passwords';

describe('hash de contrasenas con Argon2id', () => {
  it('hashea y verifica correctamente', async () => {
    const hash = await hashPassword('una-clave-muy-segura');
    expect(hash).not.toContain('una-clave-muy-segura');
    await expect(verifyPassword(hash, 'una-clave-muy-segura')).resolves.toBe(true);
    await expect(verifyPassword(hash, 'otra-clave-incorrecta')).resolves.toBe(false);
  });

  it('produce hashes distintos por sal aleatoria', async () => {
    const a = await hashPassword('mismo-secreto-largo');
    const b = await hashPassword('mismo-secreto-largo');
    expect(a).not.toBe(b);
  });
});
