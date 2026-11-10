import { randomInt } from 'node:crypto';
import { BusinessError, NotFoundError } from '../../shared/errors';
import * as academicRepo from '../../data/repositories/academic.repo';
import type { SessionUser } from '../policies';

// A-Z y 2-9, excluyendo 0/1/I/L/O por ambiguedad visual.
const SECTION_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const SECTION_CODE_LENGTH = 4;
const SECTION_CODE_MAX_ATTEMPTS = 5;

function generateSectionCode(): string {
  let code = '';
  for (let i = 0; i < SECTION_CODE_LENGTH; i++) {
    code += SECTION_CODE_ALPHABET[randomInt(SECTION_CODE_ALPHABET.length)];
  }
  return `SEC-${code}`;
}

export async function createSection(
  data: Omit<academicRepo.NewSectionData, 'code'>
): Promise<academicRepo.Section> {
  for (let attempt = 0; attempt < SECTION_CODE_MAX_ATTEMPTS; attempt++) {
    const code = generateSectionCode();
    const existing = await academicRepo.findSectionByCode(code);
    if (existing) continue;
    return academicRepo.createSection({ ...data, code });
  }
  throw new BusinessError('No se pudo generar un codigo unico para la seccion');
}

export async function joinSection(
  code: string,
  studentId: number
): Promise<academicRepo.Section> {
  const section = await academicRepo.findSectionByCode(code);
  if (!section) throw new NotFoundError('Seccion no encontrada');
  if (!section.active) {
    throw new BusinessError('Las inscripciones de esta seccion estan bloqueadas');
  }
  // La UNIQUE (seccion_id, estudiante_id) previene matriculas duplicadas.
  await academicRepo.createEnrollment(section.id, studentId);
  return section;
}

export async function listSections(): Promise<academicRepo.Section[]> {
  return academicRepo.listSections();
}

export async function getSection(id: number) {
  return academicRepo.getSection(id);
}

export async function setSectionActive(
  id: number,
  active: boolean
): Promise<void> {
  const section = await academicRepo.getSection(id);
  if (!section) throw new NotFoundError('Seccion no encontrada');
  await academicRepo.setSectionActive(id, active);
}

export async function createEnrollment(
  sectionId: number,
  studentId: number
): Promise<academicRepo.Enrollment> {
  return academicRepo.createEnrollment(sectionId, studentId);
}

export async function listEnrollments(sectionId: number) {
  return academicRepo.listEnrollmentsBySection(sectionId);
}

export async function setEnrollmentActive(
  id: number,
  active: boolean
): Promise<void> {
  await academicRepo.setEnrollmentActive(id, active);
}

export async function createAssignment(
  sectionId: number,
  teacherId: number
): Promise<academicRepo.TeacherAssignment> {
  return academicRepo.createTeacherAssignment(sectionId, teacherId);
}

export async function listAssignments(sectionId: number) {
  return academicRepo.listAssignmentsBySection(sectionId);
}

export async function setAssignmentActive(
  id: number,
  active: boolean
): Promise<void> {
  await academicRepo.setAssignmentActive(id, active);
}

export async function visibleSections(
  user: SessionUser
): Promise<academicRepo.Section[]> {
  if (user.type === 'administrador') {
    return academicRepo.listSections();
  }
  const sections = new Map<number, academicRepo.Section>();
  if (user.type === 'estudiante') {
    const enrollments = await academicRepo.listEnrollmentsByStudent(user.id);
    for (const enrollment of enrollments) {
      const section = await academicRepo.getSection(enrollment.sectionId);
      if (section) sections.set(section.id, section);
    }
  } else {
    const assignments = await academicRepo.listAssignmentsByTeacher(user.id);
    for (const assignment of assignments) {
      const section = await academicRepo.getSection(assignment.sectionId);
      if (section) sections.set(section.id, section);
    }
  }
  return [...sections.values()];
}
