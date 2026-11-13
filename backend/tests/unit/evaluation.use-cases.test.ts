import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as evaluationsRepo from '../../src/data/repositories/evaluation.repo';
import * as electionRepo from '../../src/data/repositories/election.repo';
import * as resultRepo from '../../src/data/repositories/result.repo';
import {
  evaluateDelegate,
  viewDelegate
} from '../../src/application/use-cases/evaluation.use-cases';
import type { SessionUser } from '../../src/application/policies';
import type {
  Delegation,
  EvaluationPeriod
} from '../../src/data/repositories/evaluation.repo';

vi.mock('../../src/data/repositories/evaluation.repo', () => ({
  getDelegation: vi.fn(),
  currentDelegationBySection: vi.fn(),
  currentPeriodByDelegation: vi.fn(),
  getPeriodById: vi.fn(),
  listPeriodsByDelegation: vi.fn(),
  studentAveragesByPeriod: vi.fn(),
  studentAverageByDelegation: vi.fn(),
  getEnrollmentId: vi.fn(),
  getAssignmentId: vi.fn(),
  registerStudentEvaluation: vi.fn(),
  registerTeacherEvaluation: vi.fn(),
  summaryByDelegation: vi.fn()
}));

vi.mock('../../src/data/repositories/election.repo', () => ({
  createEvaluationPeriod: vi.fn()
}));

vi.mock('../../src/data/repositories/result.repo', () => ({
  isSectionMember: vi.fn()
}));

const PAST = new Date(Date.now() - 60 * 60_000);
const FUTURE = new Date(Date.now() + 60 * 60_000);

const delegation: Delegation = {
  id: 10,
  electionId: 3,
  sectionId: 1,
  candidacyId: 7,
  delegateStudentId: 5,
  delegateName: 'Alumna Delegada',
  startsAt: new Date(Date.now() - 7 * 24 * 60 * 60_000),
  endsAt: null
};

function period(
  id: number,
  delegationId: number,
  closesAt: Date
): EvaluationPeriod {
  return {
    id,
    delegationId,
    sectionId: 1,
    opensAt: new Date(closesAt.getTime() - 60 * 60_000),
    closesAt,
    instructions: 'Instrucciones de prueba del periodo de evaluacion.'
  };
}

const delegate: SessionUser = {
  id: 5,
  name: 'Alumna Delegada',
  email: 'u.delegada@utp.edu.pe',
  type: 'estudiante',
  emailVerified: true
};

const member: SessionUser = {
  id: 6,
  name: 'Alumno Miembro',
  email: 'u.miembro@utp.edu.pe',
  type: 'estudiante',
  emailVerified: true
};

beforeEach(() => {
  vi.mocked(evaluationsRepo.currentDelegationBySection).mockReset();
  vi.mocked(evaluationsRepo.currentPeriodByDelegation).mockReset();
  vi.mocked(evaluationsRepo.getPeriodById).mockReset();
  vi.mocked(evaluationsRepo.studentAveragesByPeriod).mockReset();
  vi.mocked(evaluationsRepo.studentAverageByDelegation).mockReset();
  vi.mocked(evaluationsRepo.getEnrollmentId).mockReset();
  vi.mocked(evaluationsRepo.getAssignmentId).mockReset();
  vi.mocked(evaluationsRepo.registerStudentEvaluation).mockReset();
  vi.mocked(evaluationsRepo.registerTeacherEvaluation).mockReset();
  vi.mocked(electionRepo.createEvaluationPeriod).mockReset();
  vi.mocked(resultRepo.isSectionMember).mockReset();
  vi.mocked(resultRepo.isSectionMember).mockResolvedValue(true);
});

describe('visibilidad del delegado (§7.2)', () => {
  it('muestra promedios solo de periodos cerrados y sin global si queda uno abierto', async () => {
    vi.mocked(evaluationsRepo.currentDelegationBySection).mockResolvedValue(
      delegation
    );
    vi.mocked(evaluationsRepo.currentPeriodByDelegation).mockResolvedValue(
      period(21, 10, FUTURE)
    );
    vi.mocked(evaluationsRepo.studentAveragesByPeriod).mockResolvedValue([
      { periodId: 20, closesAt: PAST, average: 8.5 },
      { periodId: 21, closesAt: FUTURE, average: null }
    ]);

    const response = await viewDelegate(delegate, 1);

    expect(response.promediosPorPeriodo).toHaveLength(1);
    expect(response.promediosPorPeriodo?.[0]).toMatchObject({
      periodoId: 20,
      promedio: 8.5
    });
    expect(response.promedioGlobal).toBeUndefined();
    expect(
      evaluationsRepo.studentAverageByDelegation
    ).not.toHaveBeenCalled();
  });

  it('muestra el promedio global solo cuando todos los periodos cerraron', async () => {
    vi.mocked(evaluationsRepo.currentDelegationBySection).mockResolvedValue(
      delegation
    );
    vi.mocked(evaluationsRepo.currentPeriodByDelegation).mockResolvedValue(null);
    vi.mocked(evaluationsRepo.studentAveragesByPeriod).mockResolvedValue([
      { periodId: 20, closesAt: PAST, average: 8 },
      { periodId: 21, closesAt: PAST, average: 9 }
    ]);
    vi.mocked(evaluationsRepo.studentAverageByDelegation).mockResolvedValue(8.5);

    const response = await viewDelegate(delegate, 1);

    expect(response.promediosPorPeriodo).toHaveLength(2);
    expect(response.promedioGlobal).toBe(8.5);
  });

  it('un miembro que no es delegado jamas ve promedios', async () => {
    vi.mocked(evaluationsRepo.currentDelegationBySection).mockResolvedValue(
      delegation
    );
    vi.mocked(evaluationsRepo.currentPeriodByDelegation).mockResolvedValue(null);

    const response = await viewDelegate(member, 1);

    expect(response.promediosPorPeriodo).toBeUndefined();
    expect(response.promedioGlobal).toBeUndefined();
    expect(evaluationsRepo.studentAveragesByPeriod).not.toHaveBeenCalled();
  });
});

describe('evaluacion con periodoId explicito (§7.1)', () => {
  it('registra la evaluacion en el periodo indicado', async () => {
    vi.mocked(evaluationsRepo.currentDelegationBySection).mockResolvedValue(
      delegation
    );
    vi.mocked(evaluationsRepo.getPeriodById).mockResolvedValue(
      period(20, 10, FUTURE)
    );
    vi.mocked(evaluationsRepo.getEnrollmentId).mockResolvedValue(77);

    await evaluateDelegate(delegate, {
      sectionId: 1,
      grade: 8,
      periodId: 20
    });

    expect(evaluationsRepo.currentPeriodByDelegation).not.toHaveBeenCalled();
    expect(evaluationsRepo.registerStudentEvaluation).toHaveBeenCalledWith(
      20,
      77,
      8,
      null
    );
  });

  it('resuelve el periodo abierto cuando se omite periodoId', async () => {
    vi.mocked(evaluationsRepo.currentDelegationBySection).mockResolvedValue(
      delegation
    );
    vi.mocked(evaluationsRepo.currentPeriodByDelegation).mockResolvedValue(
      period(20, 10, FUTURE)
    );
    vi.mocked(evaluationsRepo.getEnrollmentId).mockResolvedValue(77);

    await evaluateDelegate(delegate, { sectionId: 1, grade: 7 });

    expect(evaluationsRepo.getPeriodById).not.toHaveBeenCalled();
    expect(evaluationsRepo.registerStudentEvaluation).toHaveBeenCalledWith(
      20,
      77,
      7,
      null
    );
  });

  it('rechaza un periodo inexistente con 404', async () => {
    vi.mocked(evaluationsRepo.currentDelegationBySection).mockResolvedValue(
      delegation
    );
    vi.mocked(evaluationsRepo.getPeriodById).mockResolvedValue(null);

    await expect(
      evaluateDelegate(delegate, { sectionId: 1, grade: 8, periodId: 99 })
    ).rejects.toThrow(/Periodo de evaluacion no encontrado/);
    expect(evaluationsRepo.registerStudentEvaluation).not.toHaveBeenCalled();
  });

  it('rechaza un periodo de otra delegacion con 422', async () => {
    vi.mocked(evaluationsRepo.currentDelegationBySection).mockResolvedValue(
      delegation
    );
    vi.mocked(evaluationsRepo.getPeriodById).mockResolvedValue(
      period(30, 99, FUTURE)
    );

    await expect(
      evaluateDelegate(delegate, { sectionId: 1, grade: 8, periodId: 30 })
    ).rejects.toThrow(/no pertenece a la delegacion vigente/);
    expect(evaluationsRepo.registerStudentEvaluation).not.toHaveBeenCalled();
  });
});
