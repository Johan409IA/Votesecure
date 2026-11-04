import { describe, expect, it } from 'vitest';
import {
  generarTokenCsrf,
  generarTokenSesion,
  generarTokenVerificacion,
  hashToken
} from '../../src/aplicacion/servicios/sesiones';

describe('tokens de sesion y verificacion', () => {
  it('el hash del token es determinista y de 32 bytes', () => {
    const hash = hashToken('abc');
    expect(hash).toHaveLength(32);
    expect(hashToken('abc')).toEqual(hash);
    expect(hashToken('abd')).not.toEqual(hash);
  });

  it('genera tokens opacos unicos', () => {
    const a = generarTokenSesion();
    const b = generarTokenSesion();
    expect(a.token).not.toBe(b.token);
    expect(a.hash).not.toEqual(b.hash);
  });

  it('los tokens de verificacion son distintos entre si', () => {
    const a = generarTokenVerificacion();
    const b = generarTokenVerificacion();
    expect(a.token).not.toBe(b.token);
    expect(generarTokenCsrf()).not.toBe(generarTokenCsrf());
  });
});
