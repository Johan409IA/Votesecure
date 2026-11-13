import { describe, expect, it } from 'vitest';
import {
  boundedDate,
  positiveInt,
  scoreInt
} from '../../src/presentation/dto/common.dto';

// F-017: la validacion de entrada no debe aceptar booleanos ni valores
// ambiguos que z.coerce interpreta de forma silenciosa.
describe('validacion de entrada de la API (F-017)', () => {
  it('rechaza booleanos y no-enteros como identificadores', () => {
    expect(positiveInt.safeParse(true).success).toBe(false);
    expect(positiveInt.safeParse('true').success).toBe(false);
    expect(positiveInt.safeParse(1.9).success).toBe(false);
    expect(positiveInt.safeParse(-1).success).toBe(false);
    expect(positiveInt.safeParse('1').success).toBe(true);
    expect(positiveInt.safeParse(7).success).toBe(true);
  });

  it('rechaza booleanos y valores fuera de rango en calificaciones', () => {
    expect(scoreInt.safeParse(true).success).toBe(false);
    expect(scoreInt.safeParse(11).success).toBe(false);
    expect(scoreInt.safeParse(0).success).toBe(false);
    expect(scoreInt.safeParse(8).success).toBe(true);
  });

  it('limita las fechas a una ventana de +/- 1 ano', () => {
    expect(boundedDate.safeParse(new Date().toISOString()).success).toBe(true);
    expect(boundedDate.safeParse('1970-01-01T00:00:00Z').success).toBe(false);
    // new Date(true) es el epoch: la ventana tambien lo rechaza.
    expect(boundedDate.safeParse(true).success).toBe(false);
    expect(boundedDate.safeParse('no-es-fecha').success).toBe(false);
  });
});
