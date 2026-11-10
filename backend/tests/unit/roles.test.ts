import { describe, expect, it } from 'vitest';
import {
  deriveUserTypeFromEmail,
  normalizeEmail
} from '../../src/application/services/roles';

describe('derivacion de rol por correo', () => {
  it('acepta correos de estudiante UTP', () => {
    expect(deriveUserTypeFromEmail('u20231234@utp.edu.pe')).toBe('estudiante');
    expect(deriveUserTypeFromEmail('  U20231234@utp.edu.pe ')).toBe('estudiante');
  });

  it('acepta correos de docente UTP', () => {
    expect(deriveUserTypeFromEmail('c.perez@utp.edu.pe')).toBe('docente');
  });

  it('rechaza otros dominios o patrones', () => {
    expect(deriveUserTypeFromEmail('alumno@gmail.com')).toBeNull();
    expect(deriveUserTypeFromEmail('x2023@utp.edu.pe')).toBeNull();
    expect(deriveUserTypeFromEmail('utp.edu.pe')).toBeNull();
  });

  it('normaliza a minusculas y sin espacios', () => {
    expect(normalizeEmail('  U.A@UTP.edu.PE ')).toBe('u.a@utp.edu.pe');
  });
});
