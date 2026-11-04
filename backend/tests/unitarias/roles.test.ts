import { describe, expect, it } from 'vitest';
import {
  derivarTipoPorCorreo,
  normalizarCorreo
} from '../../src/aplicacion/servicios/roles';

describe('derivacion de rol por correo', () => {
  it('acepta correos de estudiante UTP', () => {
    expect(derivarTipoPorCorreo('u20231234@utp.edu.pe')).toBe('estudiante');
    expect(derivarTipoPorCorreo('  U20231234@utp.edu.pe ')).toBe('estudiante');
  });

  it('acepta correos de docente UTP', () => {
    expect(derivarTipoPorCorreo('c.perez@utp.edu.pe')).toBe('docente');
  });

  it('rechaza otros dominios o patrones', () => {
    expect(derivarTipoPorCorreo('alumno@gmail.com')).toBeNull();
    expect(derivarTipoPorCorreo('x2023@utp.edu.pe')).toBeNull();
    expect(derivarTipoPorCorreo('utp.edu.pe')).toBeNull();
  });

  it('normaliza a minusculas y sin espacios', () => {
    expect(normalizarCorreo('  U.A@UTP.edu.PE ')).toBe('u.a@utp.edu.pe');
  });
});
