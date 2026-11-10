import { describe, expect, it } from 'vitest';
import {
  createElectionSchema,
  evaluationPeriodSchema
} from '../../src/presentation/dto/election.dto';

function datosDesempate(duracionMinutos: number) {
  const iniciaEn = new Date('2026-11-10T14:00:00Z');
  return {
    seccionId: 1,
    nombre: 'Desempate delegado',
    iniciaEn,
    cierraEn: new Date(iniciaEn.getTime() + duracionMinutos * 60_000),
    tipo: 'desempate' as const,
    eleccionOrigenId: 3
  };
}

describe('ventana del balotaje en createElectionSchema', () => {
  it('acepta duraciones entre 15 y 30 minutos', () => {
    expect(createElectionSchema.safeParse(datosDesempate(15)).success).toBe(true);
    expect(createElectionSchema.safeParse(datosDesempate(20)).success).toBe(true);
    expect(createElectionSchema.safeParse(datosDesempate(30)).success).toBe(true);
  });

  it('rechaza duraciones fuera de la ventana', () => {
    expect(createElectionSchema.safeParse(datosDesempate(14)).success).toBe(false);
    expect(createElectionSchema.safeParse(datosDesempate(31)).success).toBe(false);
  });

  it('no aplica la ventana a la eleccion principal', () => {
    const base = datosDesempate(60);
    const principal = {
      seccionId: base.seccionId,
      nombre: 'Eleccion principal',
      iniciaEn: base.iniciaEn,
      cierraEn: new Date(base.iniciaEn.getTime() + 60 * 60_000)
    };
    expect(createElectionSchema.safeParse(principal).success).toBe(true);
  });
});

describe('instrucciones del periodo de evaluacion (§7.1)', () => {
  const base = {
    delegacionId: 1,
    abreEn: new Date('2026-11-10T14:00:00Z'),
    cierraEn: new Date('2026-11-17T14:00:00Z'),
    instrucciones: 'Evalua el desempeno del delegado durante la semana.'
  };

  it('acepta instrucciones de 20 a 1000 caracteres', () => {
    expect(evaluationPeriodSchema.safeParse(base).success).toBe(true);
    expect(
      evaluationPeriodSchema.safeParse({ ...base, instrucciones: 'x'.repeat(1000) }).success
    ).toBe(true);
  });

  it('rechaza instrucciones cortas o largas', () => {
    expect(
      evaluationPeriodSchema.safeParse({ ...base, instrucciones: 'muy corta' }).success
    ).toBe(false);
    expect(
      evaluationPeriodSchema.safeParse({ ...base, instrucciones: 'x'.repeat(1001) }).success
    ).toBe(false);
    expect(
      evaluationPeriodSchema.safeParse({ ...base, instrucciones: '   ' }).success
    ).toBe(false);
  });
});
