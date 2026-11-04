import { describe, expect, it } from 'vitest';
import { hashearContrasena, verificarContrasena } from '../../src/aplicacion/servicios/contrasenas';

describe('hash de contrasenas con Argon2id', () => {
  it('hashea y verifica correctamente', async () => {
    const hash = await hashearContrasena('una-clave-muy-segura');
    expect(hash).not.toContain('una-clave-muy-segura');
    await expect(verificarContrasena(hash, 'una-clave-muy-segura')).resolves.toBe(true);
    await expect(verificarContrasena(hash, 'otra-clave-incorrecta')).resolves.toBe(false);
  });

  it('produce hashes distintos por sal aleatoria', async () => {
    const a = await hashearContrasena('mismo-secreto-largo');
    const b = await hashearContrasena('mismo-secreto-largo');
    expect(a).not.toBe(b);
  });
});
