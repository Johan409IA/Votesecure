import { randomInt } from 'node:crypto';
import { BusinessError, NotFoundError } from '../../shared/errors';
import { logger } from '../../config/logger';
import * as academicRepo from '../../data/repositories/academic.repo';
import {
  requireCanManageSection,
  requireSectionAccess,
  type SessionUser
} from '../policies';

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
  creator: SessionUser,
  data: Omit<academicRepo.NewSectionData, 'code'>
): Promise<academicRepo.Section> {
  // §3.1: el docente que crea su curso/seccion queda como su responsable.
  const assignedTeacherId = creator.type === 'docente' ? creator.id : undefined;
  for (let attempt = 0; attempt < SECTION_CODE_MAX_ATTEMPTS; attempt++) {
    const code = generateSectionCode();
    const existing = await academicRepo.findSectionByCode(code);
    if (existing) continue;
    return academicRepo.createSection({ ...data, code }, assignedTeacherId);
  }
  throw new BusinessError('No se pudo generar un codigo unico para la seccion');
}

export async function joinSection(
  code: string,
  studentId: number
): Promise<academicRepo.Section> {
  const section = await academicRepo.findSectionByCode(code);
  // F-003: los intentos fallidos dejan rastro en el log de seguridad (la API
  // no escribe en eventos_auditoria por diseno).
  if (!section) {
    logger.warn({ studentId, code }, 'Inscripcion con codigo inexistente');
    throw new NotFoundError('Seccion no encontrada');
  }
  if (!section.active) {
    logger.warn({ studentId, sectionId: section.id }, 'Inscripcion en seccion bloqueada');
    throw new BusinessError('Las inscripciones de esta seccion estan bloqueadas');
  }
  // La UNIQUE (seccion_id, estudiante_id) previene matriculas duplicadas.
  await academicRepo.createEnrollment(section.id, studentId);
  return section;
}

export async function listSections(): Promise<academicRepo.Section[]> {
  return academicRepo.listSections();
}

export async function getSection(user: SessionUser, id: number) {
  const section = await academicRepo.getSection(id);
  if (!section) throw new NotFoundError('Seccion no encontrada');
  await requireSectionAccess(user, id);
  return section;
}

export async function setSectionActive(
  user: SessionUser,
  id: number,
  active: boolean
): Promise<void> {
  const section = await academicRepo.getSection(id);
  if (!section) throw new NotFoundError('Seccion no encontrada');
  // §3.1: "Bloquear inscripciones" es una opcion del docente responsable
  // de la seccion (o del administrador).
  await requireCanManageSection(user, id);
  await academicRepo.setSectionActive(id, active);
}

export async function createEnrollment(
  sectionId: number,
  studentId: number
): Promise<academicRepo.Enrollment> {
  return academicRepo.createEnrollment(sectionId, studentId);
}

export async function listEnrollments(user: SessionUser, sectionId: number) {
  await requireSectionAccess(user, sectionId);
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

export async function listAssignments(user: SessionUser, sectionId: number) {
  await requireSectionAccess(user, sectionId);
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
  if (user.type === 'estudiante') {
    return academicRepo.listSectionsByStudent(user.id);
  }
  return academicRepo.listSectionsByTeacher(user.id);
}
