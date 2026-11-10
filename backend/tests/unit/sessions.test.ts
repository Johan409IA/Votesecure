import { describe, expect, it } from 'vitest';
import {
  generateCsrfToken,
  generateSessionToken,
  generateVerificationToken,
  hashToken
} from '../../src/application/services/sessions';

describe('tokens de sesion y verificacion', () => {
  it('el hash del token es determinista y de 32 bytes', () => {
    const hash = hashToken('abc');
    expect(hash).toHaveLength(32);
    expect(hashToken('abc')).toEqual(hash);
    expect(hashToken('abd')).not.toEqual(hash);
  });

  it('genera tokens opacos unicos', () => {
    const a = generateSessionToken();
    const b = generateSessionToken();
    expect(a.token).not.toBe(b.token);
    expect(a.hash).not.toEqual(b.hash);
  });

  it('los tokens de verificacion son distintos entre si', () => {
    const a = generateVerificationToken();
    const b = generateVerificationToken();
    expect(a.token).not.toBe(b.token);
    expect(generateCsrfToken()).not.toBe(generateCsrfToken());
  });
});
