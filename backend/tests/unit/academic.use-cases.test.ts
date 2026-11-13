import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as academicRepo from '../../src/data/repositories/academic.repo';
import * as resultRepo from '../../src/data/repositories/result.repo';
import {
  createSection,
  setSectionActive
} from '../../src/application/use-cases/academic.use-cases';
import type { SessionUser } from '../../src/application/policies';

vi.mock('../../src/data/repositories/academic.repo', () => ({
  findSectionByCode: vi.fn(),
  createSection: vi.fn(),
  getSection: vi.fn(),
  setSectionActive: vi.fn()
}));

vi.mock('../../src/data/repositories/result.repo', () => ({
  isTeacherOfSection: vi.fn()
}));

const teacher: SessionUser = {
  id: 7,
  name: 'Docente Prueba',
  email: 'c.prueba@utp.edu.pe',
  type: 'docente',
  emailVerified: true
};

const admin: SessionUser = {
  id: 1,
  name: 'Admin Prueba',
  email: 'admin@utp.edu.pe',
  type: 'administrador',
  emailVerified: true
};

const DATA = {
  courseCode: 'IF7701',
  courseName: 'Arquitectura de Software',
  academicPeriod: '2026-2'
};

const SECTION_CODE = /^SEC-[A-HJ-KM-NP-Z2-9]{4}$/;

function fakeSection(code: string): academicRepo.Section {
  return {
    id: 1,
    courseCode: DATA.courseCode,
    courseName: DATA.courseName,
    academicPeriod: DATA.academicPeriod,
    code,
    active: true
  };
}

beforeEach(() => {
  vi.mocked(academicRepo.findSectionByCode).mockReset();
  vi.mocked(academicRepo.createSection).mockReset();
  vi.mocked(academicRepo.getSection).mockReset();
  vi.mocked(academicRepo.setSectionActive).mockReset();
  vi.mocked(resultRepo.isTeacherOfSection).mockReset();
  vi.mocked(academicRepo.createSection).mockImplementation(async (data) =>
    fakeSection(data.code)
  );
});

describe('generacion del codigo SEC-XXXX (§3.1)', () => {
  it('genera un codigo con el formato SEC-XXXX y sin caracteres ambiguos', async () => {
    vi.mocked(academicRepo.findSectionByCode).mockResolvedValue(null);
    const section = await createSection(teacher, DATA);
    expect(section.code).toMatch(SECTION_CODE);
  });

  it('auto-asigna al docente creador como responsable de la seccion', async () => {
    vi.mocked(academicRepo.findSectionByCode).mockResolvedValue(null);
    await createSection(teacher, DATA);
    expect(academicRepo.createSection).toHaveBeenCalledWith(
      expect.objectContaining({ courseCode: DATA.courseCode }),
      teacher.id
    );
  });

  it('no asigna responsable cuando crea un administrador', async () => {
    vi.mocked(academicRepo.findSectionByCode).mockResolvedValue(null);
    await createSection(admin, DATA);
    expect(academicRepo.createSection).toHaveBeenCalledWith(
      expect.objectContaining({ courseCode: DATA.courseCode }),
      undefined
    );
  });

  it('regenera el codigo cuando ya existe (colision unica)', async () => {
    vi.mocked(academicRepo.findSectionByCode).mockResolvedValueOnce(
      fakeSection('SEC-AAAA')
    );
    vi.mocked(academicRepo.findSectionByCode).mockResolvedValueOnce(null);
    const section = await createSection(teacher, DATA);
    const attempted = vi.mocked(academicRepo.findSectionByCode).mock.calls.map(
      (call) => call[0]
    );
    expect(attempted).toHaveLength(2);
    expect(attempted[0]).not.toBe(attempted[1]);
    expect(section.code).toBe(attempted[1]);
  });

  it('agota los reintentos si nunca encuentra un codigo libre', async () => {
    vi.mocked(academicRepo.findSectionByCode).mockResolvedValue(
      fakeSection('SEC-AAAA')
    );
    await expect(createSection(teacher, DATA)).rejects.toThrow(
      /No se pudo generar un codigo unico/
    );
    expect(academicRepo.createSection).not.toHaveBeenCalled();
  });
});

describe('bloqueo de inscripciones (§3.1)', () => {
  it('el docente responsable de la seccion puede bloquear inscripciones', async () => {
    vi.mocked(academicRepo.getSection).mockResolvedValue(fakeSection('SEC-AAAA'));
    vi.mocked(resultRepo.isTeacherOfSection).mockResolvedValue(true);
    await setSectionActive(teacher, 1, false);
    expect(resultRepo.isTeacherOfSection).toHaveBeenCalledWith(teacher.id, 1);
    expect(academicRepo.setSectionActive).toHaveBeenCalledWith(1, false);
  });

  it('el administrador puede bloquear sin asignacion en la seccion', async () => {
    vi.mocked(academicRepo.getSection).mockResolvedValue(fakeSection('SEC-AAAA'));
    await setSectionActive(admin, 1, false);
    expect(resultRepo.isTeacherOfSection).not.toHaveBeenCalled();
    expect(academicRepo.setSectionActive).toHaveBeenCalledWith(1, false);
  });

  it('un docente sin asignacion activa no puede bloquear inscripciones', async () => {
    vi.mocked(academicRepo.getSection).mockResolvedValue(fakeSection('SEC-AAAA'));
    vi.mocked(resultRepo.isTeacherOfSection).mockResolvedValue(false);
    await expect(setSectionActive(teacher, 1, false)).rejects.toThrow(
      /No administras esta seccion/
    );
    expect(academicRepo.setSectionActive).not.toHaveBeenCalled();
  });

  it('responde 404 si la seccion no existe', async () => {
    vi.mocked(academicRepo.getSection).mockResolvedValue(null);
    await expect(setSectionActive(admin, 99, false)).rejects.toThrow(
      /Seccion no encontrada/
    );
    expect(academicRepo.setSectionActive).not.toHaveBeenCalled();
  });
});
