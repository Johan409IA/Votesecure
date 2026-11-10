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

  it('acepta correos institucionales de estudiante y docente (§2.1)', () => {
    expect(registerSchema.parse({ ...base, correo: 'c.perez@utp.edu.pe' })).toBeTruthy();
  });

  it('rechaza correos fuera de los regex UTP por rol', () => {
    expect(() => registerSchema.parse({ ...base, correo: 'alumno@gmail.com' })).toThrow();
    expect(() => registerSchema.parse({ ...base, correo: 'x2023@utp.edu.pe' })).toThrow();
    expect(() => registerSchema.parse({ ...base, correo: 'admin@utp.edu.pe' })).toThrow();
    expect(() => registerSchema.parse({ ...base, correo: 'u2023@utp.edu.pe.com' })).toThrow();
  });

  it('normaliza el correo a minusculas', () => {
    const result = registerSchema.parse({ ...base, correo: 'U20231234@UTP.EDU.PE' });
    expect(result.correo).toBe('u20231234@utp.edu.pe');
  });

  // Test de regresion de la migracion a Zod 4: el trim debe ocurrir antes
  // del check de formato del correo (mismo orden que en Zod 3).
  it('acepta y normaliza correos con espacios', () => {
    const result = registerSchema.parse({ ...base, correo: '  u20231234@utp.edu.pe  ' });
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
