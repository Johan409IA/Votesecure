import { describe, expect, it } from 'vitest';
import { listUsersQuerySchema, photoSchema } from '../../src/presentation/dto/user.dto';

describe('photoSchema (POST /usuarios/yo/foto)', () => {
  const JPEG = 'data:image/jpeg;base64,/9j/4AAQ';

  it('acepta un data URL JPEG dentro del tope', () => {
    expect(photoSchema.parse({ imagen: JPEG })).toBeTruthy();
  });

  it('rechaza formatos distintos de JPEG', () => {
    expect(() =>
      photoSchema.parse({ imagen: 'data:image/png;base64,iVBORw0KGgo' })
    ).toThrow();
  });

  it('rechaza base64 invalido', () => {
    expect(() => photoSchema.parse({ imagen: 'data:image/jpeg;base64,no!!' })).toThrow();
  });

  it('rechaza imagenes por encima de 90 000 caracteres', () => {
    const grande = 'data:image/jpeg;base64,' + 'A'.repeat(90_001);
    expect(() => photoSchema.parse({ imagen: grande })).toThrow();
  });
});

describe('listUsersQuerySchema (GET /usuarios)', () => {
  it('acepta sin filtros', () => {
    expect(listUsersQuerySchema.parse({})).toEqual({});
  });

  it('acepta busqueda y tipo validos', () => {
    expect(listUsersQuerySchema.parse({ busqueda: 'u2026', tipo: 'estudiante' })).toEqual({
      busqueda: 'u2026',
      tipo: 'estudiante'
    });
  });

  it('rechaza un tipo desconocido y busquedas largas', () => {
    expect(() => listUsersQuerySchema.parse({ tipo: 'superadmin' })).toThrow();
    expect(() => listUsersQuerySchema.parse({ busqueda: 'x'.repeat(101) })).toThrow();
  });
});
