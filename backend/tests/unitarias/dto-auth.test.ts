import { describe, expect, it } from 'vitest';
import { registroSchema, loginSchema } from '../../src/presentacion/dto/auth.dto';

describe('validacion de registro', () => {
  const base = {
    nombre: 'Juan Perez',
    correo: 'u20231234@utp.edu.pe',
    contrasena: 'una-clave-muy-segura'
  };

  it('acepta un registro valido', () => {
    expect(registroSchema.parse(base)).toBeTruthy();
  });

  it('rechaza contrasenas cortas (menos de 15)', () => {
    expect(() => registroSchema.parse({ ...base, contrasena: 'corta123' })).toThrow();
  });

  it('rechaza correos invalidos y nombres vacios', () => {
    expect(() => registroSchema.parse({ ...base, correo: 'no-es-correo' })).toThrow();
    expect(() => registroSchema.parse({ ...base, nombre: '  ' })).toThrow();
  });

  it('normaliza el correo a minusculas', () => {
    const r = registroSchema.parse({ ...base, correo: 'U20231234@UTP.EDU.PE' });
    expect(r.correo).toBe('u20231234@utp.edu.pe');
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
