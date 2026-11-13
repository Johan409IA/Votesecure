import { BusinessError, NotFoundError, ForbiddenError } from '../../shared/errors';
import * as evaluationsRepo from '../../data/repositories/evaluation.repo';
import * as electionsRepo from '../../data/repositories/election.repo';
import { isSectionMember } from '../../data/repositories/result.repo';
import {
  isAdmin,
  requireCanManageSection,
  type SessionUser
} from '../policies';

export async function createEvaluationPeriod(
  user: SessionUser,
  delegationId: number,
  opensAt: Date,
  closesAt: Date,
  instructions: string
): Promise<number> {
  const delegation = await evaluationsRepo.getDelegation(delegationId);
  if (!delegation) throw new NotFoundError('Delegacion no encontrada');
  await requireCanManageSection(user, delegation.sectionId);
  return electionsRepo.createEvaluationPeriod(
    delegation.id,
    delegation.sectionId,
    opensAt,
    closesAt,
    instructions
  );
}

export async function viewDelegate(user: SessionUser, sectionId: number) {
  const allowed =
    isAdmin(user) || (await isSectionMember(user.id, sectionId));
  if (!allowed) throw new ForbiddenError('No perteneces a esta seccion');
  const delegation = await evaluationsRepo.currentDelegationBySection(sectionId);
  if (!delegation) throw new NotFoundError('No hay delegado vigente en la seccion');
  const period = await evaluationsRepo.currentPeriodByDelegation(delegation.id);
  const response: {
    delegacion: evaluationsRepo.Delegation;
    periodoAbierto: evaluationsRepo.EvaluationPeriod | null;
    promediosPorPeriodo?: Array<{
      periodoId: number;
      cierraEn: Date;
      promedio: number | null;
    }>;
    promedioGlobal?: number | null;
  } = { delegacion: delegation, periodoAbierto: period };

  // §7.2: el delegado ve el promedio de cada periodo solo tras su cierre y
  // el global al cerrarse todos; jamas evaluadores individuales.
  if (user.id === delegation.delegateStudentId) {
    const averages = await evaluationsRepo.studentAveragesByPeriod(
      delegation.id
    );
    const closed = averages.filter(
      (item) => item.closesAt.getTime() <= Date.now()
    );
    response.promediosPorPeriodo = closed.map((item) => ({
      periodoId: item.periodId,
      cierraEn: item.closesAt,
      promedio: item.average
    }));
    if (averages.length > 0 && closed.length === averages.length) {
      response.promedioGlobal = await evaluationsRepo.studentAverageByDelegation(
        delegation.id
      );
    }
  }
  return response;
}

export async function evaluateDelegate(
  user: SessionUser,
  data: {
    sectionId: number;
    grade: number;
    comment?: string;
    periodId?: number;
  }
): Promise<void> {
  const delegation = await evaluationsRepo.currentDelegationBySection(data.sectionId);
  if (!delegation) {
    throw new NotFoundError('No hay delegado vigente en la seccion');
  }
  let period: evaluationsRepo.EvaluationPeriod | null;
  if (data.periodId !== undefined) {
    // Atribucion explicita: evita enviar la evaluacion a otro periodo
    // cuando el formulario quedo abierto y el periodo cerro (§7.1).
    period = await evaluationsRepo.getPeriodById(data.periodId);
    if (!period) throw new NotFoundError('Periodo de evaluacion no encontrado');
    if (period.delegationId !== delegation.id) {
      throw new BusinessError('El periodo no pertenece a la delegacion vigente');
    }
  } else {
    period = await evaluationsRepo.currentPeriodByDelegation(delegation.id);
  }
  if (!period) {
    throw new BusinessError('El periodo de evaluacion no esta abierto');
  }

  if (user.type === 'estudiante') {
    const comment = data.comment?.trim() ?? '';
    if (comment.length > 500) {
      throw new BusinessError('El comentario estudiantil admite hasta 500 caracteres');
    }
    const enrollmentId = await evaluationsRepo.getEnrollmentId(
      data.sectionId,
      user.id
    );
    if (!enrollmentId) {
      throw new ForbiddenError('No tienes matricula activa en la seccion');
    }
    await evaluationsRepo.registerStudentEvaluation(
      period.id,
      enrollmentId,
      data.grade,
      comment.length > 0 ? comment : null
    );
    return;
  }

  if (user.type === 'docente') {
    const comment = data.comment?.trim() ?? '';
    if (comment.length < 20 || comment.length > 1000) {
      throw new BusinessError(
        'El comentario del docente es obligatorio (entre 20 y 1000 caracteres)'
      );
    }
    const assignmentId = await evaluationsRepo.getAssignmentId(
      data.sectionId,
      user.id
    );
    if (!assignmentId) {
      throw new ForbiddenError('No tienes asignacion activa en la seccion');
    }
    await evaluationsRepo.registerTeacherEvaluation(
      period.id,
      assignmentId,
      data.grade,
      comment
    );
    return;
  }

  throw new ForbiddenError('El administrador no evalua delegados');
}

export async function evaluationSummary(
  user: SessionUser,
  sectionId: number
) {
  const allowed =
    isAdmin(user) ||
    (user.type === 'docente' &&
      (await isSectionMember(user.id, sectionId)));
  if (!allowed) {
    throw new ForbiddenError('El resumen es para docentes de la seccion o administradores');
  }
  const delegation = await evaluationsRepo.currentDelegationBySection(sectionId);
  if (!delegation) throw new NotFoundError('No hay delegado vigente en la seccion');
  return evaluationsRepo.summaryByDelegation(delegation);
}
