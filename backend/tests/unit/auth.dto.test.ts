import { describe, expect, it } from 'vitest';
import { registerSchema, loginSchema } from '../../src/presentation/dto/auth.dto';

describe('validacion de registro', () => {
  const base = {
    nombre: 'Juan Perez',
    correo: 'u20231234@utp.edu.pe',
    contrasena: 'una-clave-muy-segura'
  };

  it('acepta un registro valido', () => {
    expect(registerSchema.parse(base)).toBeTruthy();
  });

  it('rechaza contrasenas cortas (menos de 15)', () => {
    expect(() => registerSchema.parse({ ...base, contrasena: 'corta123' })).toThrow();
  });

  it('rechaza correos invalidos y nombres vacios', () => {
    expect(() => registerSchema.parse({ ...base, correo: 'no-es-correo' })).toThrow();
    expect(() => registerSchema.parse({ ...base, nombre: '  ' })).toThrow();
  });

  it('normaliza el correo a minusculas', () => {
    const result = registerSchema.parse({ ...base, correo: 'U20231234@UTP.EDU.PE' });
    expect(result.correo).toBe('u20231234@utp.edu.pe');
  });
});

describe('validacion de login', () => {
  it('acepta credenciales con formato valido', () => {
    expect(
      loginSchema.parse({ correo: 'U20231234@utp.edu.pe', contrasena: 'lo-que-sea' })
    ).toBeTruthy();
  });

  it('rechaza contrasena vacia', () => {
    expect(() => loginSchema.parse({ correo: 'u20231234@utp.edu.pe', contrasena: '' })).toThrow();
  });
});
